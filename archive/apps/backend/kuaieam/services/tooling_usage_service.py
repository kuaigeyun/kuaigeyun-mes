"""
工装夹具使用记录服务模块

提供工装夹具使用记录的业务逻辑处理，支持多组织隔离。
"""

from typing import List, Optional
from datetime import datetime
from apps.kuaieam.models.tooling_usage import ToolingUsage
from apps.kuaieam.schemas.tooling_usage_schemas import (
    ToolingUsageCreate, ToolingUsageUpdate, ToolingUsageResponse
)
from infra.exceptions.exceptions import NotFoundError, ValidationError


class ToolingUsageService:
    """工装夹具使用记录服务"""
    
    @staticmethod
    async def create_tooling_usage(
        tenant_id: int,
        data: ToolingUsageCreate
    ) -> ToolingUsageResponse:
        """创建工装夹具使用记录"""
        existing = await ToolingUsage.filter(
            tenant_id=tenant_id,
            usage_no=data.usage_no,
            deleted_at__isnull=True
        ).first()
        
        if existing:
            raise ValidationError(f"工装夹具使用记录编号 {data.usage_no} 已存在")
        
        usage = await ToolingUsage.create(
            tenant_id=tenant_id,
            **data.dict()
        )
        
        return ToolingUsageResponse.model_validate(usage)
    
    @staticmethod
    async def get_tooling_usage_by_uuid(
        tenant_id: int,
        usage_uuid: str
    ) -> ToolingUsageResponse:
        """根据UUID获取工装夹具使用记录"""
        usage = await ToolingUsage.filter(
            tenant_id=tenant_id,
            uuid=usage_uuid,
            deleted_at__isnull=True
        ).first()
        
        if not usage:
            raise NotFoundError(f"工装夹具使用记录 {usage_uuid} 不存在")
        
        return ToolingUsageResponse.model_validate(usage)
    
    @staticmethod
    async def list_tooling_usages(
        tenant_id: int,
        skip: int = 0,
        limit: int = 100,
        tooling_id: Optional[int] = None,
        status: Optional[str] = None
    ) -> List[ToolingUsageResponse]:
        """获取工装夹具使用记录列表"""
        query = ToolingUsage.filter(
            tenant_id=tenant_id,
            deleted_at__isnull=True
        )
        
        if tooling_id:
            query = query.filter(tooling_id=tooling_id)
        if status:
            query = query.filter(status=status)
        
        usages = await query.offset(skip).limit(limit).order_by("-created_at")
        
        return [ToolingUsageResponse.model_validate(u) for u in usages]
    
    @staticmethod
    async def update_tooling_usage(
        tenant_id: int,
        usage_uuid: str,
        data: ToolingUsageUpdate
    ) -> ToolingUsageResponse:
        """更新工装夹具使用记录"""
        usage = await ToolingUsage.filter(
            tenant_id=tenant_id,
            uuid=usage_uuid,
            deleted_at__isnull=True
        ).first()
        
        if not usage:
            raise NotFoundError(f"工装夹具使用记录 {usage_uuid} 不存在")
        
        update_data = data.dict(exclude_unset=True)
        for key, value in update_data.items():
            setattr(usage, key, value)
        
        await usage.save()
        
        return ToolingUsageResponse.model_validate(usage)
    
    @staticmethod
    async def delete_tooling_usage(
        tenant_id: int,
        usage_uuid: str
    ) -> None:
        """删除工装夹具使用记录（软删除）"""
        usage = await ToolingUsage.filter(
            tenant_id=tenant_id,
            uuid=usage_uuid,
            deleted_at__isnull=True
        ).first()
        
        if not usage:
            raise NotFoundError(f"工装夹具使用记录 {usage_uuid} 不存在")
        
        usage.deleted_at = datetime.utcnow()
        await usage.save()
