"""
实验管理服务模块

提供实验管理的业务逻辑处理，支持多组织隔离。
"""

from typing import List, Optional
from datetime import datetime
from apps.kuailims.models.experiment_management import ExperimentManagement
from apps.kuailims.schemas.experiment_management_schemas import (
    ExperimentManagementCreate, ExperimentManagementUpdate, ExperimentManagementResponse
)
from infra.exceptions.exceptions import NotFoundError, ValidationError


class ExperimentManagementService:
    """实验管理服务"""
    
    @staticmethod
    async def create_experiment_management(
        tenant_id: int,
        data: ExperimentManagementCreate
    ) -> ExperimentManagementResponse:
        """创建实验管理"""
        existing = await ExperimentManagement.filter(
            tenant_id=tenant_id,
            experiment_no=data.experiment_no,
            deleted_at__isnull=True
        ).first()
        
        if existing:
            raise ValidationError(f"实验管理编号 {data.experiment_no} 已存在")
        
        management = await ExperimentManagement.create(
            tenant_id=tenant_id,
            **data.dict()
        )
        
        return ExperimentManagementResponse.model_validate(management)
    
    @staticmethod
    async def get_experiment_management_by_uuid(
        tenant_id: int,
        management_uuid: str
    ) -> ExperimentManagementResponse:
        """根据UUID获取实验管理"""
        management = await ExperimentManagement.filter(
            tenant_id=tenant_id,
            uuid=management_uuid,
            deleted_at__isnull=True
        ).first()
        
        if not management:
            raise NotFoundError(f"实验管理 {management_uuid} 不存在")
        
        return ExperimentManagementResponse.model_validate(management)
    
    @staticmethod
    async def list_experiment_managements(
        tenant_id: int,
        skip: int = 0,
        limit: int = 100,
        experiment_type: Optional[str] = None,
        experiment_status: Optional[str] = None,
        confirmation_status: Optional[str] = None
    ) -> List[ExperimentManagementResponse]:
        """获取实验管理列表"""
        query = ExperimentManagement.filter(
            tenant_id=tenant_id,
            deleted_at__isnull=True
        )
        
        if experiment_type:
            query = query.filter(experiment_type=experiment_type)
        if experiment_status:
            query = query.filter(experiment_status=experiment_status)
        if confirmation_status:
            query = query.filter(confirmation_status=confirmation_status)
        
        managements = await query.offset(skip).limit(limit).order_by("-created_at")
        
        return [ExperimentManagementResponse.model_validate(m) for m in managements]
    
    @staticmethod
    async def update_experiment_management(
        tenant_id: int,
        management_uuid: str,
        data: ExperimentManagementUpdate
    ) -> ExperimentManagementResponse:
        """更新实验管理"""
        management = await ExperimentManagement.filter(
            tenant_id=tenant_id,
            uuid=management_uuid,
            deleted_at__isnull=True
        ).first()
        
        if not management:
            raise NotFoundError(f"实验管理 {management_uuid} 不存在")
        
        update_data = data.dict(exclude_unset=True)
        for key, value in update_data.items():
            setattr(management, key, value)
        
        await management.save()
        
        return ExperimentManagementResponse.model_validate(management)
    
    @staticmethod
    async def delete_experiment_management(
        tenant_id: int,
        management_uuid: str
    ) -> None:
        """删除实验管理（软删除）"""
        management = await ExperimentManagement.filter(
            tenant_id=tenant_id,
            uuid=management_uuid,
            deleted_at__isnull=True
        ).first()
        
        if not management:
            raise NotFoundError(f"实验管理 {management_uuid} 不存在")
        
        management.deleted_at = datetime.utcnow()
        await management.save()

