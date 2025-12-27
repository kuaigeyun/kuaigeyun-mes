"""
安装记录服务模块

提供安装记录的业务逻辑处理，支持多组织隔离。
"""

from typing import List, Optional
from apps.kuaicrm.models.installation import Installation
from apps.kuaicrm.schemas.installation_schemas import (
    InstallationCreate, InstallationUpdate, InstallationResponse
)
from infra.exceptions.exceptions import NotFoundError, ValidationError


class InstallationService:
    """安装记录服务"""
    
    @staticmethod
    async def create_installation(
        tenant_id: int,
        data: InstallationCreate
    ) -> InstallationResponse:
        """
        创建安装记录
        
        Args:
            tenant_id: 租户ID
            data: 安装记录创建数据
            
        Returns:
            InstallationResponse: 创建的安装记录对象
            
        Raises:
            ValidationError: 当编号已存在时抛出
        """
        # 检查编号是否已存在
        existing = await Installation.filter(
            tenant_id=tenant_id,
            installation_no=data.installation_no,
            deleted_at__isnull=True
        ).first()
        
        if existing:
            raise ValidationError(f"安装编号 {data.installation_no} 已存在")
        
        # 创建安装记录
        installation = await Installation.create(
            tenant_id=tenant_id,
            **data.dict()
        )
        
        return InstallationResponse.model_validate(installation)
    
    @staticmethod
    async def get_installation_by_uuid(
        tenant_id: int,
        installation_uuid: str
    ) -> InstallationResponse:
        """
        根据UUID获取安装记录
        
        Args:
            tenant_id: 租户ID
            installation_uuid: 安装记录UUID
            
        Returns:
            InstallationResponse: 安装记录对象
            
        Raises:
            NotFoundError: 当安装记录不存在时抛出
        """
        installation = await Installation.filter(
            tenant_id=tenant_id,
            uuid=installation_uuid,
            deleted_at__isnull=True
        ).first()
        
        if not installation:
            raise NotFoundError(f"安装记录 {installation_uuid} 不存在")
        
        return InstallationResponse.model_validate(installation)
    
    @staticmethod
    async def list_installations(
        tenant_id: int,
        skip: int = 0,
        limit: int = 100,
        installation_status: Optional[str] = None,
        customer_id: Optional[int] = None
    ) -> List[InstallationResponse]:
        """
        获取安装记录列表
        
        Args:
            tenant_id: 租户ID
            skip: 跳过数量
            limit: 限制数量
            installation_status: 安装状态（过滤）
            customer_id: 客户ID（过滤）
            
        Returns:
            List[InstallationResponse]: 安装记录列表
        """
        query = Installation.filter(
            tenant_id=tenant_id,
            deleted_at__isnull=True
        )
        
        if installation_status:
            query = query.filter(installation_status=installation_status)
        if customer_id:
            query = query.filter(customer_id=customer_id)
        
        installations = await query.offset(skip).limit(limit).order_by("-created_at")
        
        return [InstallationResponse.model_validate(inst) for inst in installations]
    
    @staticmethod
    async def update_installation(
        tenant_id: int,
        installation_uuid: str,
        data: InstallationUpdate
    ) -> InstallationResponse:
        """
        更新安装记录
        
        Args:
            tenant_id: 租户ID
            installation_uuid: 安装记录UUID
            data: 安装记录更新数据
            
        Returns:
            InstallationResponse: 更新后的安装记录对象
            
        Raises:
            NotFoundError: 当安装记录不存在时抛出
        """
        installation = await Installation.filter(
            tenant_id=tenant_id,
            uuid=installation_uuid,
            deleted_at__isnull=True
        ).first()
        
        if not installation:
            raise NotFoundError(f"安装记录 {installation_uuid} 不存在")
        
        # 更新字段
        update_data = data.dict(exclude_unset=True)
        for key, value in update_data.items():
            setattr(installation, key, value)
        
        await installation.save()
        
        return InstallationResponse.model_validate(installation)
    
    @staticmethod
    async def delete_installation(
        tenant_id: int,
        installation_uuid: str
    ) -> None:
        """
        删除安装记录（软删除）
        
        Args:
            tenant_id: 租户ID
            installation_uuid: 安装记录UUID
            
        Raises:
            NotFoundError: 当安装记录不存在时抛出
        """
        installation = await Installation.filter(
            tenant_id=tenant_id,
            uuid=installation_uuid,
            deleted_at__isnull=True
        ).first()
        
        if not installation:
            raise NotFoundError(f"安装记录 {installation_uuid} 不存在")
        
        from datetime import datetime
        installation.deleted_at = datetime.utcnow()
        await installation.save()
