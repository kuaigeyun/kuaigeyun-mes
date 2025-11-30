"""
平台超级管理员服务模块

提供平台超级管理员的 CRUD 操作和业务逻辑处理。
平台超级管理员是平台唯一的，独立于租户系统。
"""

from typing import Optional

from fastapi import HTTPException, status
from loguru import logger

from soil.models.platform_superadmin import PlatformSuperAdmin
from soil.schemas.platform_superadmin import (
    PlatformSuperAdminCreate,
    PlatformSuperAdminUpdate
)
from soil.core.security.security import hash_password, verify_password


class PlatformSuperAdminService:
    """
    平台超级管理员服务类
    
    提供平台超级管理员的 CRUD 操作和业务逻辑处理。
    平台超级管理员是平台唯一的，只能有一个。
    """
    
    async def get_platform_superadmin(self) -> Optional[PlatformSuperAdmin]:
        """
        获取平台超级管理员
        
        平台超级管理员是平台唯一的，只能有一个。
        
        Returns:
            Optional[PlatformSuperAdmin]: 平台超级管理员对象，如果不存在则返回 None
        """
        return await PlatformSuperAdmin.get_or_none()
    
    async def create_platform_superadmin(
        self,
        data: PlatformSuperAdminCreate
    ) -> PlatformSuperAdmin:
        """
        创建平台超级管理员
        
        创建平台超级管理员并保存到数据库。
        注意：平台超级管理员是平台唯一的，只能创建一个。
        如果已存在平台超级管理员，则抛出异常。
        
        Args:
            data: 平台超级管理员创建数据
            
        Returns:
            PlatformSuperAdmin: 创建的平台超级管理员对象
            
        Raises:
            HTTPException: 当平台超级管理员已存在或用户名已存在时抛出
            
        Example:
            >>> service = PlatformSuperAdminService()
            >>> admin = await service.create_platform_superadmin(
            ...     PlatformSuperAdminCreate(
            ...         username="platform_admin",
            ...         password="password123",
            ...         email="admin@platform.com"
            ...     )
            ... )
        """
        # 检查平台超级管理员是否已存在（平台唯一）
        existing_admin = await self.get_platform_superadmin()
        if existing_admin:
            raise HTTPException(
                status_code=status.HTTP_400_BAD_REQUEST,
                detail="平台超级管理员已存在，只能创建一个"
            )
        
        # 检查用户名是否已存在（虽然平台唯一，但为了安全还是检查一下）
        existing_username = await PlatformSuperAdmin.get_or_none(
            username=data.username
        )
        if existing_username:
            raise HTTPException(
                status_code=status.HTTP_400_BAD_REQUEST,
                detail=f"用户名 {data.username} 已被使用"
            )
        
        # 创建平台超级管理员
        password_hash = hash_password(data.password)
        admin = await PlatformSuperAdmin.create(
            username=data.username,
            email=data.email if data.email else None,
            password_hash=password_hash,
            full_name=data.full_name,
            is_active=data.is_active,
        )
        
        logger.info(f"平台超级管理员创建成功: {admin.username} (ID: {admin.id})")
        return admin
    
    async def update_platform_superadmin(
        self,
        data: PlatformSuperAdminUpdate
    ) -> Optional[PlatformSuperAdmin]:
        """
        更新平台超级管理员信息
        
        更新平台超级管理员的详细信息。只更新提供的字段。
        
        Args:
            data: 平台超级管理员更新数据
            
        Returns:
            Optional[PlatformSuperAdmin]: 更新后的平台超级管理员对象，如果不存在则返回 None
            
        Raises:
            HTTPException: 当平台超级管理员不存在时抛出
        """
        admin = await self.get_platform_superadmin()
        if not admin:
            raise HTTPException(
                status_code=status.HTTP_404_NOT_FOUND,
                detail="平台超级管理员不存在"
            )
        
        # 更新字段
        update_data = data.model_dump(exclude_unset=True)
        
        # 如果更新密码，需要加密
        if "password" in update_data:
            update_data["password_hash"] = hash_password(update_data.pop("password"))
        
        # 更新数据库
        for field, value in update_data.items():
            setattr(admin, field, value)
        
        await admin.save()
        
        logger.info(f"平台超级管理员更新成功: {admin.username} (ID: {admin.id})")
        return admin
    
    async def verify_platform_superadmin_credentials(
        self,
        username: str,
        password: str
    ) -> Optional[PlatformSuperAdmin]:
        """
        验证平台超级管理员凭据
        
        验证用户名和密码是否匹配。
        
        Args:
            username: 用户名
            password: 密码
            
        Returns:
            Optional[PlatformSuperAdmin]: 平台超级管理员对象，如果验证失败则返回 None
        """
        admin = await PlatformSuperAdmin.get_or_none(username=username)
        if not admin:
            return None
        
        if not admin.is_active:
            return None
        
        if not admin.verify_password(password):
            return None
        
        # 更新最后登录时间
        admin.update_last_login()
        await admin.save()
        
        return admin

