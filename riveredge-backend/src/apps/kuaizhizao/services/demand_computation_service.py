"""
统一需求计算服务模块

提供统一需求计算相关的业务逻辑处理，合并MRP和LRP运算逻辑。

根据《☆ 用户使用全场景推演.md》的设计理念，将MRP和LRP合并为统一的需求计算模型。

Author: Luigi Lu
Date: 2025-01-14
"""

from typing import List, Optional, Dict, Any
from datetime import datetime
from decimal import Decimal
from tortoise.transactions import in_transaction
from loguru import logger

from apps.kuaizhizao.models.demand import Demand
from apps.kuaizhizao.models.demand_computation import DemandComputation
from apps.kuaizhizao.models.demand_computation_item import DemandComputationItem
from apps.kuaizhizao.schemas.demand_computation import (
    DemandComputationCreate,
    DemandComputationUpdate,
    DemandComputationResponse,
    DemandComputationItemResponse,
)
from core.services.business.code_generation_service import CodeGenerationService
from infra.exceptions.exceptions import NotFoundError, ValidationError, BusinessLogicError


class DemandComputationService:
    """统一需求计算服务"""
    
    async def create_computation(
        self,
        tenant_id: int,
        computation_data: DemandComputationCreate,
        created_by: int
    ) -> DemandComputationResponse:
        """
        创建需求计算
        
        Args:
            tenant_id: 租户ID
            computation_data: 计算数据
            created_by: 创建人ID
            
        Returns:
            DemandComputationResponse: 创建的计算响应
        """
        async with in_transaction():
            # 验证需求存在
            demand = await Demand.get_or_none(tenant_id=tenant_id, id=computation_data.demand_id)
            if not demand:
                raise NotFoundError(f"需求不存在: {computation_data.demand_id}")
            
            # 验证需求状态（必须是已审核通过）
            if demand.status != "已审核" or demand.review_status != "通过":
                raise BusinessLogicError(f"只能对已审核通过的需求进行计算，当前状态: {demand.status}")
            
            # 生成计算编码
            computation_code = await self._generate_computation_code(tenant_id, computation_data.computation_type)
            
            # 创建需求计算
            computation = await DemandComputation.create(
                tenant_id=tenant_id,
                computation_code=computation_code,
                demand_id=computation_data.demand_id,
                demand_code=demand.demand_code,
                demand_type=demand.demand_type,
                business_mode=demand.business_mode,
                computation_type=computation_data.computation_type,
                computation_params=computation_data.computation_params,
                computation_status="进行中",
                computation_start_time=datetime.now(),
                notes=computation_data.notes,
                created_by=created_by,
            )
            
            # 创建计算结果明细
            items = []
            for item_data in computation_data.items or []:
                item = await DemandComputationItem.create(
                    tenant_id=tenant_id,
                    computation_id=computation.id,
                    **item_data.model_dump()
                )
                items.append(item)
            
            return await self._build_computation_response(computation, items)
    
    async def _generate_computation_code(
        self,
        tenant_id: int,
        computation_type: str
    ) -> str:
        """
        生成需求计算编码
        
        Args:
            tenant_id: 租户ID
            computation_type: 计算类型（MRP/LRP）
            
        Returns:
            str: 计算编码
        """
        try:
            # 使用编码生成服务生成编码
            code = await CodeGenerationService.generate_code(
                tenant_id=tenant_id,
                rule_code="DEMAND_COMPUTATION",
                context={"computation_type": computation_type}
            )
            return code
        except Exception as e:
            logger.warning(f"使用编码规则生成失败: {e}，使用简单编码")
            # 回退到简单编码格式
            now = datetime.now()
            prefix = "MRP" if computation_type == "MRP" else "LRP"
            return f"{prefix}-{now.strftime('%Y%m%d')}-NEW"
    
    async def _build_computation_response(
        self,
        computation: DemandComputation,
        items: List[DemandComputationItem]
    ) -> DemandComputationResponse:
        """构建计算响应对象"""
        item_responses = [
            DemandComputationItemResponse.model_validate(item) for item in items
        ]
        
        return DemandComputationResponse(
            id=computation.id,
            uuid=str(computation.uuid),
            tenant_id=computation.tenant_id,
            computation_code=computation.computation_code,
            demand_id=computation.demand_id,
            demand_code=computation.demand_code,
            demand_type=computation.demand_type,
            business_mode=computation.business_mode,
            computation_type=computation.computation_type,
            computation_params=computation.computation_params,
            computation_status=computation.computation_status,
            computation_start_time=computation.computation_start_time,
            computation_end_time=computation.computation_end_time,
            computation_summary=computation.computation_summary,
            error_message=computation.error_message,
            notes=computation.notes,
            created_at=computation.created_at,
            updated_at=computation.updated_at,
            created_by=computation.created_by,
            updated_by=computation.updated_by,
            items=item_responses
        )
    
    async def get_computation_by_id(
        self,
        tenant_id: int,
        computation_id: int,
        include_items: bool = True
    ) -> DemandComputationResponse:
        """
        根据ID获取需求计算
        
        Args:
            tenant_id: 租户ID
            computation_id: 计算ID
            include_items: 是否包含明细
            
        Returns:
            DemandComputationResponse: 计算响应
        """
        computation = await DemandComputation.get_or_none(tenant_id=tenant_id, id=computation_id)
        if not computation:
            raise NotFoundError(f"需求计算不存在: {computation_id}")
        
        items = []
        if include_items:
            items = await DemandComputationItem.filter(
                tenant_id=tenant_id,
                computation_id=computation_id
            ).all()
        
        return await self._build_computation_response(computation, items)
    
    async def list_computations(
        self,
        tenant_id: int,
        demand_id: Optional[int] = None,
        computation_type: Optional[str] = None,
        computation_status: Optional[str] = None,
        skip: int = 0,
        limit: int = 20
    ) -> Dict[str, Any]:
        """
        获取需求计算列表
        
        Args:
            tenant_id: 租户ID
            demand_id: 需求ID（可选）
            computation_type: 计算类型（可选）
            computation_status: 计算状态（可选）
            skip: 跳过数量
            limit: 限制数量
            
        Returns:
            Dict: 包含计算列表和总数的字典
        """
        query = DemandComputation.filter(tenant_id=tenant_id, deleted_at__isnull=True)
        
        if demand_id:
            query = query.filter(demand_id=demand_id)
        if computation_type:
            query = query.filter(computation_type=computation_type)
        if computation_status:
            query = query.filter(computation_status=computation_status)
        
        total = await query.count()
        computations = await query.offset(skip).limit(limit).order_by('-computation_start_time')
        
        result = []
        for computation in computations:
            items = await DemandComputationItem.filter(
                tenant_id=tenant_id,
                computation_id=computation.id
            ).all()
            result.append(await self._build_computation_response(computation, items))
        
        return {
            "data": [r.model_dump() for r in result],
            "total": total,
            "success": True
        }
