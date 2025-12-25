"""
工艺参数优化服务模块

提供工艺参数优化的业务逻辑处理，支持多组织隔离。
"""

from typing import List, Optional
from datetime import datetime
from apps.kuaimi.models.process_parameter_optimization import ProcessParameterOptimization
from apps.kuaimi.schemas.process_parameter_optimization_schemas import (
    ProcessParameterOptimizationCreate, ProcessParameterOptimizationUpdate, ProcessParameterOptimizationResponse
)
from infra.exceptions.exceptions import NotFoundError, ValidationError


class ProcessParameterOptimizationService:
    """工艺参数优化服务"""
    
    @staticmethod
    async def create_process_parameter_optimization(
        tenant_id: int,
        data: ProcessParameterOptimizationCreate
    ) -> ProcessParameterOptimizationResponse:
        """创建工艺参数优化"""
        existing = await ProcessParameterOptimization.filter(
            tenant_id=tenant_id,
            optimization_no=data.optimization_no,
            deleted_at__isnull=True
        ).first()
        
        if existing:
            raise ValidationError(f"工艺参数优化编号 {data.optimization_no} 已存在")
        
        optimization = await ProcessParameterOptimization.create(
            tenant_id=tenant_id,
            **data.dict()
        )
        
        return ProcessParameterOptimizationResponse.model_validate(optimization)
    
    @staticmethod
    async def get_process_parameter_optimization_by_uuid(
        tenant_id: int,
        optimization_uuid: str
    ) -> ProcessParameterOptimizationResponse:
        """根据UUID获取工艺参数优化"""
        optimization = await ProcessParameterOptimization.filter(
            tenant_id=tenant_id,
            uuid=optimization_uuid,
            deleted_at__isnull=True
        ).first()
        
        if not optimization:
            raise NotFoundError(f"工艺参数优化 {optimization_uuid} 不存在")
        
        return ProcessParameterOptimizationResponse.model_validate(optimization)
    
    @staticmethod
    async def list_process_parameter_optimizations(
        tenant_id: int,
        skip: int = 0,
        limit: int = 100,
        process_id: Optional[int] = None,
        improvement_status: Optional[str] = None,
        status: Optional[str] = None
    ) -> List[ProcessParameterOptimizationResponse]:
        """获取工艺参数优化列表"""
        query = ProcessParameterOptimization.filter(
            tenant_id=tenant_id,
            deleted_at__isnull=True
        )
        
        if process_id:
            query = query.filter(process_id=process_id)
        if improvement_status:
            query = query.filter(improvement_status=improvement_status)
        if status:
            query = query.filter(status=status)
        
        optimizations = await query.offset(skip).limit(limit).order_by("-created_at")
        
        return [ProcessParameterOptimizationResponse.model_validate(o) for o in optimizations]
    
    @staticmethod
    async def update_process_parameter_optimization(
        tenant_id: int,
        optimization_uuid: str,
        data: ProcessParameterOptimizationUpdate
    ) -> ProcessParameterOptimizationResponse:
        """更新工艺参数优化"""
        optimization = await ProcessParameterOptimization.filter(
            tenant_id=tenant_id,
            uuid=optimization_uuid,
            deleted_at__isnull=True
        ).first()
        
        if not optimization:
            raise NotFoundError(f"工艺参数优化 {optimization_uuid} 不存在")
        
        update_data = data.dict(exclude_unset=True)
        for key, value in update_data.items():
            setattr(optimization, key, value)
        
        await optimization.save()
        
        return ProcessParameterOptimizationResponse.model_validate(optimization)
    
    @staticmethod
    async def delete_process_parameter_optimization(
        tenant_id: int,
        optimization_uuid: str
    ) -> None:
        """删除工艺参数优化（软删除）"""
        optimization = await ProcessParameterOptimization.filter(
            tenant_id=tenant_id,
            uuid=optimization_uuid,
            deleted_at__isnull=True
        ).first()
        
        if not optimization:
            raise NotFoundError(f"工艺参数优化 {optimization_uuid} 不存在")
        
        optimization.deleted_at = datetime.utcnow()
        await optimization.save()

