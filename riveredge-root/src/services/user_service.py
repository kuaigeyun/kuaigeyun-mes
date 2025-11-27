"""
用户服务模块

提供用户的 CRUD 操作和业务逻辑处理
"""

from typing import Optional, List, Dict, Any

from fastapi import HTTPException, status

from models.user import User
from schemas.user import UserCreate, UserUpdate
from core.tenant_context import get_current_tenant_id, require_tenant_context
from core.security import hash_password


class UserService:
    """
    用户服务类
    
    提供用户的 CRUD 操作和业务逻辑处理。
    所有查询自动过滤组织，所有创建操作自动设置 tenant_id。
    """
    
    async def create_user(
        self,
        data: UserCreate,
        tenant_id: Optional[int] = None
    ) -> User:
        """
        创建用户
        
        创建新用户并自动设置组织 ID。
        
        Args:
            data: 用户创建数据
            tenant_id: 组织 ID（可选，默认从上下文获取）
            
        Returns:
            User: 创建的用户对象
            
        Raises:
            HTTPException: 当邮箱已存在或组织内用户名已存在时抛出
            
        Example:
            >>> service = UserService()
            >>> user = await service.create_user(
            ...     UserCreate(
            ...         username="testuser",
            ...         email="test@example.com",
            ...         password="password123",
            ...         tenant_id=1
            ...     )
            ... )
        """
        # 获取组织 ID（从参数或上下文）
        if tenant_id is None:
            tenant_id = await require_tenant_context()
        
        # 检查组织内用户名是否已存在
        existing_username = await User.get_or_none(
            tenant_id=tenant_id,
            username=data.username
        )
        if existing_username:
            raise HTTPException(
                status_code=status.HTTP_400_BAD_REQUEST,
                detail="该组织下用户名已被使用"
            )
        
        # 创建用户（自动设置 tenant_id）⭐ 关键
        password_hash = hash_password(data.password)
        user = await User.create(
            tenant_id=tenant_id,  # ⭐ 关键：自动设置组织 ID
            username=data.username,
            email=data.email if data.email else None,  # 邮箱可选，符合中国用户使用习惯
            password_hash=password_hash,
            full_name=data.full_name,
            is_active=data.is_active,
            is_platform_admin=data.is_platform_admin,
            is_tenant_admin=data.is_tenant_admin,
            source=data.source if hasattr(data, 'source') and data.source else None,  # 用户来源
        )
        
        return user
    
    async def get_user_by_id(
        self,
        user_id: int,
        tenant_id: Optional[int] = None
    ) -> Optional[User]:
        """
        根据 ID 获取用户
        
        获取指定 ID 的用户，自动过滤组织。
        
        Args:
            user_id: 用户 ID
            tenant_id: 组织 ID（可选，默认从上下文获取）
            
        Returns:
            Optional[User]: 用户对象，如果不存在或不属于当前组织则返回 None
            
        Example:
            >>> service = UserService()
            >>> user = await service.get_user_by_id(1)
            >>> if user:
            ...     print(user.username)
        """
        # 获取组织 ID（从参数或上下文）
        if tenant_id is None:
            tenant_id = await require_tenant_context()
        
        # 查询用户（自动过滤组织）⭐ 关键
        user = await User.get_or_none(
            id=user_id,
            tenant_id=tenant_id  # ⭐ 关键：自动过滤组织
        )
        
        return user
    
    async def list_users(
        self,
        page: int = 1,
        page_size: int = 10,
        keyword: Optional[str] = None,
        is_active: Optional[bool] = None,
        tenant_id: Optional[int] = None
    ) -> Dict[str, Any]:
        """
        获取用户列表
        
        获取用户列表，支持分页、关键词搜索（支持拼音首字母搜索）和状态筛选。
        自动过滤组织：只返回当前组织的用户。
        
        Args:
            page: 页码（默认 1）
            page_size: 每页数量（默认 10）
            keyword: 关键词搜索（可选，搜索用户名、邮箱、全名，支持拼音首字母搜索）
            is_active: 是否激活筛选（可选）
            tenant_id: 组织 ID（可选，默认从上下文获取）
            
        Returns:
            Dict[str, Any]: 包含 items、total、page、page_size 的字典
            
        Example:
            >>> service = UserService()
            >>> result = await service.list_users(
            ...     page=1,
            ...     page_size=20,
            ...     keyword="test"
            ... )
            >>> len(result["items"]) >= 0
            True
        """
        from core.search_utils import list_with_search
        
        # 构建精确匹配条件
        exact_filters = {}
        if is_active is not None:
            exact_filters['is_active'] = is_active
        
        # 使用通用搜索工具（自动支持拼音首字母搜索）
        return await list_with_search(
            model=User,
            page=page,
            page_size=page_size,
            keyword=keyword,
            search_fields=['username', 'email', 'full_name'],
            exact_filters=exact_filters if exact_filters else None,
            allowed_sort_fields=['username', 'email', 'full_name', 'is_active', 'created_at', 'updated_at'],
            default_sort='-created_at',
            tenant_id=tenant_id,
            skip_tenant_filter=False
        )
    
    async def update_user(
        self,
        user_id: int,
        data: UserUpdate,
        tenant_id: Optional[int] = None
    ) -> Optional[User]:
        """
        更新用户
        
        更新用户信息，自动验证组织权限。
        
        Args:
            user_id: 用户 ID
            data: 用户更新数据
            tenant_id: 组织 ID（可选，默认从上下文获取）
            
        Returns:
            Optional[User]: 更新后的用户对象，如果不存在或不属于当前组织则返回 None
            
        Raises:
            HTTPException: 当邮箱或用户名冲突时抛出
            
        Example:
            >>> service = UserService()
            >>> user = await service.update_user(
            ...     1,
            ...     UserUpdate(full_name="新名称")
            ... )
        """
        # 获取组织 ID（从参数或上下文）
        if tenant_id is None:
            tenant_id = await require_tenant_context()
        
        # 获取用户（自动验证组织权限）⭐ 关键
        user = await self.get_user_by_id(user_id, tenant_id)
        if not user:
            return None
        
        # 检查用户名是否冲突（如果更新用户名）
        if data.username and data.username != user.username:
            existing_username = await User.get_or_none(
                tenant_id=tenant_id,
                username=data.username
            )
            if existing_username:
                raise HTTPException(
                    status_code=status.HTTP_400_BAD_REQUEST,
                    detail="该组织下用户名已被使用"
                )
        
        # 更新用户信息
        update_data = data.model_dump(exclude_unset=True)
        
        # 如果更新密码，需要加密
        if "password" in update_data:
            update_data["password_hash"] = hash_password(update_data.pop("password"))
        
        # 执行更新
        for key, value in update_data.items():
            setattr(user, key, value)
        
        await user.save()
        
        return user
    
    async def delete_user(
        self,
        user_id: int,
        tenant_id: Optional[int] = None
    ) -> bool:
        """
        删除用户（软删除）
        
        删除用户，自动验证组织权限。
        注意：当前实现为硬删除，后续可改为软删除（添加 deleted_at 字段）。
        
        Args:
            user_id: 用户 ID
            tenant_id: 组织 ID（可选，默认从上下文获取）
            
        Returns:
            bool: 删除成功返回 True，否则返回 False
            
        Example:
            >>> service = UserService()
            >>> success = await service.delete_user(1)
            >>> success
            True
        """
        # 获取组织 ID（从参数或上下文）
        if tenant_id is None:
            tenant_id = await require_tenant_context()
        
        # 获取用户（自动验证组织权限）⭐ 关键
        user = await self.get_user_by_id(user_id, tenant_id)
        if not user:
            return False
        
        # 删除用户
        await user.delete()
        
        return True
    
    async def toggle_user_status(
        self,
        user_id: int,
        tenant_id: Optional[int] = None
    ) -> Optional[User]:
        """
        切换用户状态
        
        切换用户的激活状态（激活/停用），自动验证组织权限。
        
        Args:
            user_id: 用户 ID
            tenant_id: 组织 ID（可选，默认从上下文获取）
            
        Returns:
            Optional[User]: 更新后的用户对象，如果不存在或不属于当前组织则返回 None
            
        Example:
            >>> service = UserService()
            >>> user = await service.toggle_user_status(1)
            >>> user.is_active
            False
        """
        # 获取组织 ID（从参数或上下文）
        if tenant_id is None:
            tenant_id = await require_tenant_context()
        
        # 获取用户（自动验证组织权限）⭐ 关键
        user = await self.get_user_by_id(user_id, tenant_id)
        if not user:
            return None
        
        # 切换状态
        user.is_active = not user.is_active
        await user.save()
        
        return user

