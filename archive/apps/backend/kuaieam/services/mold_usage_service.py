"""
模具使用记录服务模块

提供模具使用记录的业务逻辑处理，支持多组织隔离。
"""

from typing import List, Optional
from datetime import datetime
from apps.kuaieam.models.mold_usage import MoldUsage
from apps.kuaieam.schemas.mold_usage_schemas import (
    MoldUsageCreate, MoldUsageUpdate, MoldUsageResponse
)
from infra.exceptions.exceptions import NotFoundError, ValidationError


class MoldUsageService:
    """模具使用记录服务"""
    
    @staticmethod
    async def create_mold_usage(
        tenant_id: int,
        data: MoldUsageCreate
    ) -> MoldUsageResponse:
        """创建模具使用记录"""
        existing = await MoldUsage.filter(
            tenant_id=tenant_id,
            usage_no=data.usage_no,
            deleted_at__isnull=True
        ).first()
        
        if existing:
            raise ValidationError(f"模具使用记录编号 {data.usage_no} 已存在")
        
        usage = await MoldUsage.create(
            tenant_id=tenant_id,
            **data.dict()
        )
        
        return MoldUsageResponse.model_validate(usage)
    
    @staticmethod
    async def get_mold_usage_by_uuid(
        tenant_id: int,
        usage_uuid: str
    ) -> MoldUsageResponse:
        """根据UUID获取模具使用记录"""
        usage = await MoldUsage.filter(
            tenant_id=tenant_id,
            uuid=usage_uuid,
            deleted_at__isnull=True
        ).first()
        
        if not usage:
            raise NotFoundError(f"模具使用记录 {usage_uuid} 不存在")
        
        return MoldUsageResponse.model_validate(usage)
    
    @staticmethod
    async def list_mold_usages(
        tenant_id: int,
        skip: int = 0,
        limit: int = 100,
        mold_id: Optional[int] = None,
        status: Optional[str] = None
    ) -> List[MoldUsageResponse]:
        """获取模具使用记录列表"""
        query = MoldUsage.filter(
            tenant_id=tenant_id,
            deleted_at__isnull=True
        )
        
        if mold_id:
            query = query.filter(mold_id=mold_id)
        if status:
            query = query.filter(status=status)
        
        usages = await query.offset(skip).limit(limit).order_by("-created_at")
        
        return [MoldUsageResponse.model_validate(u) for u in usages]
    
    @staticmethod
    async def update_mold_usage(
        tenant_id: int,
        usage_uuid: str,
        data: MoldUsageUpdate
    ) -> MoldUsageResponse:
        """更新模具使用记录"""
        usage = await MoldUsage.filter(
            tenant_id=tenant_id,
            uuid=usage_uuid,
            deleted_at__isnull=True
        ).first()
        
        if not usage:
            raise NotFoundError(f"模具使用记录 {usage_uuid} 不存在")
        
        update_data = data.dict(exclude_unset=True)
        for key, value in update_data.items():
            setattr(usage, key, value)
        
        await usage.save()
        
        return MoldUsageResponse.model_validate(usage)
    
    @staticmethod
    async def delete_mold_usage(
        tenant_id: int,
        usage_uuid: str
    ) -> None:
        """删除模具使用记录（软删除）"""
        usage = await MoldUsage.filter(
            tenant_id=tenant_id,
            uuid=usage_uuid,
            deleted_at__isnull=True
        ).first()
        
        if not usage:
            raise NotFoundError(f"模具使用记录 {usage_uuid} 不存在")
        
        usage.deleted_at = datetime.utcnow()
        await usage.save()
