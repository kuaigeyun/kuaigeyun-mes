"""
排班执行服务模块

提供排班执行的业务逻辑处理，支持多组织隔离。
"""

from typing import List, Optional
from apps.kuaihrm.models.scheduling import SchedulingExecution
from apps.kuaihrm.schemas.scheduling_execution_schemas import (
    SchedulingExecutionCreate, SchedulingExecutionUpdate, SchedulingExecutionResponse
)
from infra.exceptions.exceptions import NotFoundError, ValidationError


class SchedulingExecutionService:
    """排班执行服务"""
    
    @staticmethod
    async def create_scheduling_execution(
        tenant_id: int,
        data: SchedulingExecutionCreate
    ) -> SchedulingExecutionResponse:
        """创建排班执行"""
        execution = await SchedulingExecution.create(
            tenant_id=tenant_id,
            **data.dict()
        )
        
        return SchedulingExecutionResponse.model_validate(execution)
    
    @staticmethod
    async def get_scheduling_execution_by_uuid(
        tenant_id: int,
        execution_uuid: str
    ) -> SchedulingExecutionResponse:
        """根据UUID获取排班执行"""
        execution = await SchedulingExecution.filter(
            tenant_id=tenant_id,
            uuid=execution_uuid,
            deleted_at__isnull=True
        ).first()
        
        if not execution:
            raise NotFoundError(f"排班执行 {execution_uuid} 不存在")
        
        return SchedulingExecutionResponse.model_validate(execution)
    
    @staticmethod
    async def list_scheduling_executions(
        tenant_id: int,
        skip: int = 0,
        limit: int = 100,
        plan_id: Optional[int] = None,
        employee_id: Optional[int] = None,
        status: Optional[str] = None
    ) -> List[SchedulingExecutionResponse]:
        """获取排班执行列表"""
        query = SchedulingExecution.filter(
            tenant_id=tenant_id,
            deleted_at__isnull=True
        )
        
        if plan_id:
            query = query.filter(plan_id=plan_id)
        if employee_id:
            query = query.filter(employee_id=employee_id)
        if status:
            query = query.filter(status=status)
        
        executions = await query.offset(skip).limit(limit).all()
        
        return [SchedulingExecutionResponse.model_validate(e) for e in executions]
    
    @staticmethod
    async def update_scheduling_execution(
        tenant_id: int,
        execution_uuid: str,
        data: SchedulingExecutionUpdate
    ) -> SchedulingExecutionResponse:
        """更新排班执行"""
        execution = await SchedulingExecution.filter(
            tenant_id=tenant_id,
            uuid=execution_uuid,
            deleted_at__isnull=True
        ).first()
        
        if not execution:
            raise NotFoundError(f"排班执行 {execution_uuid} 不存在")
        
        update_data = data.dict(exclude_unset=True)
        for key, value in update_data.items():
            setattr(execution, key, value)
        
        await execution.save()
        
        return SchedulingExecutionResponse.model_validate(execution)
    
    @staticmethod
    async def delete_scheduling_execution(
        tenant_id: int,
        execution_uuid: str
    ) -> None:
        """删除排班执行（软删除）"""
        execution = await SchedulingExecution.filter(
            tenant_id=tenant_id,
            uuid=execution_uuid,
            deleted_at__isnull=True
        ).first()
        
        if not execution:
            raise NotFoundError(f"排班执行 {execution_uuid} 不存在")
        
        from datetime import datetime
        execution.deleted_at = datetime.now()
        await execution.save()

