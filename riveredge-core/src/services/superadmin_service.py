"""
系统级超级管理员服务模块

提供系统级超级管理员的 CRUD 操作和业务逻辑处理
注意：系统级超级管理员使用 User 模型（is_superuser=True 且 tenant_id=None）
"""

from typing import Optional, Dict, Any
from datetime import datetime

from fastapi import HTTPException, status
from loguru import logger

from models.user import User
from schemas.superadmin import SuperAdminCreate, SuperAdminUpdate
from core.security import hash_password, verify_password


class SuperAdminService:
    """
    系统级超级管理员服务类
    
    提供系统级超级管理员的 CRUD 操作和业务逻辑处理。
    注意：系统级超级管理员使用 User 模型（is_superuser=True 且 tenant_id=None）。
    """
    
    async def create_superadmin(self, data: SuperAdminCreate) -> User:
        """
        创建系统级超级管理员
        
        创建新系统级超级管理员并保存到数据库。如果用户名已存在，则抛出异常。
        
        Args:
            data: 系统级超级管理员创建数据
            
        Returns:
            User: 创建的系统级超级管理员用户对象（is_superuser=True 且 tenant_id=None）
            
        Raises:
            HTTPException: 当用户名已存在时抛出
            
        Example:
            >>> service = SuperAdminService()
            >>> admin = await service.create_superadmin(
            ...     SuperAdminCreate(
            ...         username="superadmin",
            ...         password="password123",
            ...         email="admin@example.com"
            ...     )
            ... )
        """
        # 检查用户名是否已存在（系统级超级管理员用户名全局唯一）
        existing_admin = await User.get_or_none(
            username=data.username,
            tenant_id__isnull=True,
            is_superuser=True
        )
        if existing_admin:
            raise HTTPException(
                status_code=status.HTTP_400_BAD_REQUEST,
                detail=f"用户名 {data.username} 已被使用"
            )
        
        # 创建系统级超级管理员（tenant_id=None 且 is_superuser=True）⭐ 关键
        password_hash = hash_password(data.password)
        admin = await User.create(
            username=data.username,
            tenant_id=None,  # ⭐ 关键：系统级超级管理员 tenant_id 为 None
            email=data.email if data.email else None,  # 邮箱可选
            password_hash=password_hash,
            full_name=data.full_name,
            is_active=data.is_active,
            is_superuser=True,  # ⭐ 关键：系统级超级管理员
            is_tenant_admin=False,  # 系统级超级管理员不是租户管理员
        )
        
        logger.info(f"系统级超级管理员创建成功: {admin.username} (ID: {admin.id})")
        return admin
    
    async def get_superadmin_by_id(self, admin_id: int) -> Optional[User]:
        """
        根据 ID 获取系统级超级管理员
        
        Args:
            admin_id: 系统级超级管理员 ID
            
        Returns:
            Optional[User]: 系统级超级管理员用户对象，如果不存在则返回 None
        """
        return await User.get_or_none(
            id=admin_id,
            is_superuser=True,
            tenant_id__isnull=True
        )
    
    async def get_superadmin_by_username(self, username: str) -> Optional[User]:
        """
        根据用户名获取系统级超级管理员
        
        Args:
            username: 用户名
            
        Returns:
            Optional[User]: 系统级超级管理员用户对象，如果不存在则返回 None
        """
        return await User.get_or_none(
            username=username,
            is_superuser=True,
            tenant_id__isnull=True
        )
    
    async def list_superadmins(
        self,
        page: int = 1,
        page_size: int = 10,
        keyword: Optional[str] = None,
        is_active: Optional[bool] = None
    ) -> Dict[str, Any]:
        """
        获取超级管理员列表
        
        获取超级管理员列表，支持分页、关键词搜索和状态筛选。
        
        Args:
            page: 页码（默认 1）
            page_size: 每页数量（默认 10）
            keyword: 关键词搜索（可选，搜索用户名、邮箱、全名）
            is_active: 是否激活筛选（可选）
            
        Returns:
            Dict[str, Any]: 包含 items、total、page、page_size 的字典
        """
        # 构建查询（系统级超级管理员：is_superuser=True 且 tenant_id=None）
        query = User.filter(is_superuser=True, tenant_id__isnull=True)
        
        # 关键词搜索
        if keyword:
            from tortoise import Q
            query = query.filter(
                Q(username__icontains=keyword) |
                Q(email__icontains=keyword) |
                Q(full_name__icontains=keyword)
            )
        
        # 状态筛选
        if is_active is not None:
            query = query.filter(is_active=is_active)
        
        # 获取总数
        total = await query.count()
        
        # 分页查询
        offset = (page - 1) * page_size
        items = await query.offset(offset).limit(page_size).all()
        
        return {
            "items": items,
            "total": total,
            "page": page,
            "page_size": page_size
        }
    
    async def update_superadmin(
        self,
        admin_id: int,
        data: SuperAdminUpdate
    ) -> Optional[User]:
        """
        更新系统级超级管理员信息
        
        更新系统级超级管理员的详细信息。只更新提供的字段。
        
        Args:
            admin_id: 系统级超级管理员 ID
            data: 系统级超级管理员更新数据
            
        Returns:
            Optional[User]: 更新后的系统级超级管理员用户对象，如果不存在则返回 None
        """
        admin = await User.get_or_none(
            id=admin_id,
            is_superuser=True,
            tenant_id__isnull=True
        )
        if not admin:
            return None
        
        # 更新字段
        update_data = data.model_dump(exclude_unset=True)
        
        # 如果更新密码，需要加密
        if "password" in update_data:
            update_data["password_hash"] = hash_password(update_data.pop("password"))
        
        # 更新数据库
        for field, value in update_data.items():
            setattr(admin, field, value)
        
        await admin.save()
        
        logger.info(f"系统级超级管理员更新成功: {admin.username} (ID: {admin.id})")
        return admin
    
    async def delete_superadmin(self, admin_id: int) -> bool:
        """
        删除系统级超级管理员（软删除）
        
        将系统级超级管理员状态设置为非激活，而不是真正删除数据。
        
        Args:
            admin_id: 系统级超级管理员 ID
            
        Returns:
            bool: 是否删除成功
        """
        admin = await User.get_or_none(
            id=admin_id,
            is_superuser=True,
            tenant_id__isnull=True
        )
        if not admin:
            return False
        
        # 软删除：设置为非激活
        admin.is_active = False
        await admin.save()
        
        logger.info(f"系统级超级管理员删除成功: {admin.username} (ID: {admin.id})")
        return True
    
    async def verify_superadmin_credentials(
        self,
        username: str,
        password: str
    ) -> Optional[User]:
        """
        验证系统级超级管理员凭据
        
        验证用户名和密码是否匹配。
        
        Args:
            username: 用户名
            password: 密码
            
        Returns:
            Optional[User]: 系统级超级管理员用户对象，如果验证失败则返回 None
        """
        admin = await User.get_or_none(
            username=username,
            is_superuser=True,
            tenant_id__isnull=True
        )
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

