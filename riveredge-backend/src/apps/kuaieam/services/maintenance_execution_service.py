"""
维护执行记录服务模块

提供维护执行记录的业务逻辑处理，支持多组织隔离。
"""

from typing import List, Optional
from datetime import datetime
from apps.kuaieam.models.maintenance_execution import MaintenanceExecution
from apps.kuaieam.schemas.maintenance_execution_schemas import (
    MaintenanceExecutionCreate, MaintenanceExecutionUpdate, MaintenanceExecutionResponse
)
from infra.exceptions.exceptions import NotFoundError, ValidationError


class MaintenanceExecutionService:
    """维护执行记录服务"""
    
    @staticmethod
    async def create_maintenance_execution(
        tenant_id: int,
        data: MaintenanceExecutionCreate
    ) -> MaintenanceExecutionResponse:
        """创建维护执行记录"""
        existing = await MaintenanceExecution.filter(
            tenant_id=tenant_id,
            execution_no=data.execution_no,
            deleted_at__isnull=True
        ).first()
        
        if existing:
            raise ValidationError(f"维护执行记录编号 {data.execution_no} 已存在")
        
        execution = await MaintenanceExecution.create(
            tenant_id=tenant_id,
            **data.dict()
        )
        
        return MaintenanceExecutionResponse.model_validate(execution)
    
    @staticmethod
    async def get_maintenance_execution_by_uuid(
        tenant_id: int,
        execution_uuid: str
    ) -> MaintenanceExecutionResponse:
        """根据UUID获取维护执行记录"""
        execution = await MaintenanceExecution.filter(
            tenant_id=tenant_id,
            uuid=execution_uuid,
            deleted_at__isnull=True
        ).first()
        
        if not execution:
            raise NotFoundError(f"维护执行记录 {execution_uuid} 不存在")
        
        return MaintenanceExecutionResponse.model_validate(execution)
    
    @staticmethod
    async def list_maintenance_executions(
        tenant_id: int,
        skip: int = 0,
        limit: int = 100,
        workorder_uuid: Optional[str] = None,
        status: Optional[str] = None
    ) -> List[MaintenanceExecutionResponse]:
        """获取维护执行记录列表"""
        query = MaintenanceExecution.filter(
            tenant_id=tenant_id,
            deleted_at__isnull=True
        )
        
        if workorder_uuid:
            query = query.filter(workorder_uuid=workorder_uuid)
        if status:
            query = query.filter(status=status)
        
        executions = await query.offset(skip).limit(limit).order_by("-created_at")
        
        return [MaintenanceExecutionResponse.model_validate(e) for e in executions]
    
    @staticmethod
    async def update_maintenance_execution(
        tenant_id: int,
        execution_uuid: str,
        data: MaintenanceExecutionUpdate
    ) -> MaintenanceExecutionResponse:
        """更新维护执行记录"""
        execution = await MaintenanceExecution.filter(
            tenant_id=tenant_id,
            uuid=execution_uuid,
            deleted_at__isnull=True
        ).first()
        
        if not execution:
            raise NotFoundError(f"维护执行记录 {execution_uuid} 不存在")
        
        update_data = data.dict(exclude_unset=True)
        for key, value in update_data.items():
            setattr(execution, key, value)
        
        await execution.save()
        
        return MaintenanceExecutionResponse.model_validate(execution)
    
    @staticmethod
    async def delete_maintenance_execution(
        tenant_id: int,
        execution_uuid: str
    ) -> None:
        """删除维护执行记录（软删除）"""
        execution = await MaintenanceExecution.filter(
            tenant_id=tenant_id,
            uuid=execution_uuid,
            deleted_at__isnull=True
        ).first()
        
        if not execution:
            raise NotFoundError(f"维护执行记录 {execution_uuid} 不存在")
        
        execution.deleted_at = datetime.utcnow()
        await execution.save()
