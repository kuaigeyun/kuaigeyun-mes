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
            return f"{prefix}-{now.strftime('%Y%m%d')}-{computation.id if 'computation' in locals() else 'NEW'}"
