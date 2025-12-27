"""
故障处理服务模块

提供故障处理的业务逻辑处理，支持多组织隔离。
"""

from typing import List, Optional
from datetime import datetime
from apps.kuaieam.models.failure_handling import FailureHandling
from apps.kuaieam.schemas.failure_handling_schemas import (
    FailureHandlingCreate, FailureHandlingUpdate, FailureHandlingResponse
)
from infra.exceptions.exceptions import NotFoundError, ValidationError


class FailureHandlingService:
    """故障处理服务"""
    
    @staticmethod
    async def create_failure_handling(
        tenant_id: int,
        data: FailureHandlingCreate
    ) -> FailureHandlingResponse:
        """创建故障处理"""
        existing = await FailureHandling.filter(
            tenant_id=tenant_id,
            handling_no=data.handling_no,
            deleted_at__isnull=True
        ).first()
        
        if existing:
            raise ValidationError(f"故障处理单编号 {data.handling_no} 已存在")
        
        handling = await FailureHandling.create(
            tenant_id=tenant_id,
            **data.dict()
        )
        
        return FailureHandlingResponse.model_validate(handling)
    
    @staticmethod
    async def get_failure_handling_by_uuid(
        tenant_id: int,
        handling_uuid: str
    ) -> FailureHandlingResponse:
        """根据UUID获取故障处理"""
        handling = await FailureHandling.filter(
            tenant_id=tenant_id,
            uuid=handling_uuid,
            deleted_at__isnull=True
        ).first()
        
        if not handling:
            raise NotFoundError(f"故障处理 {handling_uuid} 不存在")
        
        return FailureHandlingResponse.model_validate(handling)
    
    @staticmethod
    async def list_failure_handlings(
        tenant_id: int,
        skip: int = 0,
        limit: int = 100,
        report_uuid: Optional[str] = None,
        status: Optional[str] = None
    ) -> List[FailureHandlingResponse]:
        """获取故障处理列表"""
        query = FailureHandling.filter(
            tenant_id=tenant_id,
            deleted_at__isnull=True
        )
        
        if report_uuid:
            query = query.filter(report_uuid=report_uuid)
        if status:
            query = query.filter(status=status)
        
        handlings = await query.offset(skip).limit(limit).order_by("-created_at")
        
        return [FailureHandlingResponse.model_validate(h) for h in handlings]
    
    @staticmethod
    async def update_failure_handling(
        tenant_id: int,
        handling_uuid: str,
        data: FailureHandlingUpdate
    ) -> FailureHandlingResponse:
        """更新故障处理"""
        handling = await FailureHandling.filter(
            tenant_id=tenant_id,
            uuid=handling_uuid,
            deleted_at__isnull=True
        ).first()
        
        if not handling:
            raise NotFoundError(f"故障处理 {handling_uuid} 不存在")
        
        update_data = data.dict(exclude_unset=True)
        for key, value in update_data.items():
            setattr(handling, key, value)
        
        await handling.save()
        
        return FailureHandlingResponse.model_validate(handling)
    
    @staticmethod
    async def delete_failure_handling(
        tenant_id: int,
        handling_uuid: str
    ) -> None:
        """删除故障处理（软删除）"""
        handling = await FailureHandling.filter(
            tenant_id=tenant_id,
            uuid=handling_uuid,
            deleted_at__isnull=True
        ).first()
        
        if not handling:
            raise NotFoundError(f"故障处理 {handling_uuid} 不存在")
        
        handling.deleted_at = datetime.utcnow()
        await handling.save()
