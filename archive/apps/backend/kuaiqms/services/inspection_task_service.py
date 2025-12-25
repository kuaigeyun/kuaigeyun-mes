"""
质量检验任务服务模块

提供质量检验任务的业务逻辑处理，支持多组织隔离。
"""

from typing import List, Optional
from datetime import datetime
from apps.kuaiqms.models.inspection_task import InspectionTask
from apps.kuaiqms.schemas.inspection_task_schemas import (
    InspectionTaskCreate, InspectionTaskUpdate, InspectionTaskResponse
)
from infra.exceptions.exceptions import NotFoundError, ValidationError


class InspectionTaskService:
    """质量检验任务服务"""
    
    @staticmethod
    async def create_inspection_task(
        tenant_id: int,
        data: InspectionTaskCreate
    ) -> InspectionTaskResponse:
        """创建质量检验任务"""
        existing = await InspectionTask.filter(
            tenant_id=tenant_id,
            task_no=data.task_no,
            deleted_at__isnull=True
        ).first()
        
        if existing:
            raise ValidationError(f"检验任务编号 {data.task_no} 已存在")
        
        task = await InspectionTask.create(
            tenant_id=tenant_id,
            **data.dict()
        )
        
        return InspectionTaskResponse.model_validate(task)
    
    @staticmethod
    async def get_inspection_task_by_uuid(
        tenant_id: int,
        task_uuid: str
    ) -> InspectionTaskResponse:
        """根据UUID获取质量检验任务"""
        task = await InspectionTask.filter(
            tenant_id=tenant_id,
            uuid=task_uuid,
            deleted_at__isnull=True
        ).first()
        
        if not task:
            raise NotFoundError(f"检验任务 {task_uuid} 不存在")
        
        return InspectionTaskResponse.model_validate(task)
    
    @staticmethod
    async def list_inspection_tasks(
        tenant_id: int,
        skip: int = 0,
        limit: int = 100,
        inspection_type: Optional[str] = None,
        status: Optional[str] = None
    ) -> List[InspectionTaskResponse]:
        """获取质量检验任务列表"""
        query = InspectionTask.filter(
            tenant_id=tenant_id,
            deleted_at__isnull=True
        )
        
        if inspection_type:
            query = query.filter(inspection_type=inspection_type)
        if status:
            query = query.filter(status=status)
        
        tasks = await query.offset(skip).limit(limit).order_by("-created_at")
        
        return [InspectionTaskResponse.model_validate(t) for t in tasks]
    
    @staticmethod
    async def update_inspection_task(
        tenant_id: int,
        task_uuid: str,
        data: InspectionTaskUpdate
    ) -> InspectionTaskResponse:
        """更新质量检验任务"""
        task = await InspectionTask.filter(
            tenant_id=tenant_id,
            uuid=task_uuid,
            deleted_at__isnull=True
        ).first()
        
        if not task:
            raise NotFoundError(f"检验任务 {task_uuid} 不存在")
        
        update_data = data.dict(exclude_unset=True)
        for key, value in update_data.items():
            setattr(task, key, value)
        
        await task.save()
        
        return InspectionTaskResponse.model_validate(task)
    
    @staticmethod
    async def delete_inspection_task(
        tenant_id: int,
        task_uuid: str
    ) -> None:
        """删除质量检验任务（软删除）"""
        task = await InspectionTask.filter(
            tenant_id=tenant_id,
            uuid=task_uuid,
            deleted_at__isnull=True
        ).first()
        
        if not task:
            raise NotFoundError(f"检验任务 {task_uuid} 不存在")
        
        task.deleted_at = datetime.utcnow()
        await task.save()
