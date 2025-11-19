"""
认证服务模块

提供用户认证相关的业务逻辑，包括注册、登录、Token 刷新等功能
"""

from fastapi import HTTPException, status

from models.user import User
from models.tenant import Tenant, TenantStatus
from schemas.auth import LoginRequest, UserRegisterRequest
from core.security import (
    create_token_for_user,
    verify_password,
    hash_password,
)
from core.tenant_context import set_current_tenant_id


class AuthService:
    """
    认证服务类
    
    提供用户认证相关的业务逻辑处理。
    """
    
    async def register(
        self,
        data: UserRegisterRequest
    ) -> User:
        """
        用户注册
        
        在已有租户中创建新用户并自动设置租户 ID。
        
        Args:
            data: 用户注册请求数据（包含 tenant_id）
            
        Returns:
            User: 创建的用户对象
            
        Raises:
            HTTPException: 当租户不存在或用户名已存在时抛出
            
        Example:
            >>> service = AuthService()
            >>> user = await service.register(
            ...     UserRegisterRequest(
            ...         username="testuser",
            ...         email="test@example.com",  # 可选
            ...         password="password123",
            ...         tenant_id=1
            ...     )
            ... )
        """
        # 检查租户是否存在
        tenant = await Tenant.get_or_none(id=data.tenant_id)
        if not tenant:
            raise HTTPException(
                status_code=status.HTTP_404_NOT_FOUND,
                detail="租户不存在"
            )
        
        # 检查租户是否激活
        if tenant.status != TenantStatus.ACTIVE:
            raise HTTPException(
                status_code=status.HTTP_400_BAD_REQUEST,
                detail="租户未激活，无法注册"
            )
        
        # 检查租户内用户名是否已存在
        existing_username = await User.get_or_none(
            tenant_id=data.tenant_id,
            username=data.username
        )
        if existing_username:
            raise HTTPException(
                status_code=status.HTTP_400_BAD_REQUEST,
                detail="该租户下用户名已被使用"
            )
        
        # 创建用户（自动设置 tenant_id）
        password_hash = hash_password(data.password)
        user = await User.create(
            tenant_id=data.tenant_id,  # ⭐ 关键：自动设置租户 ID
            username=data.username,
            email=data.email if data.email else None,  # 邮箱可选
            password_hash=password_hash,
            full_name=data.full_name,
            is_active=True,
            is_superuser=False,
            is_tenant_admin=False,
        )
        
        return user
    
    async def login(
        self,
        data: LoginRequest
    ) -> dict:
        """
        用户登录
        
        验证用户凭据并返回 JWT Token（包含 tenant_id）。
        登录成功后自动设置租户上下文。
        
        Args:
            data: 登录请求数据（username, password, tenant_id 可选）
            
        Returns:
            dict: 包含 access_token、token_type、expires_in 和 user 信息的字典
            
        Raises:
            HTTPException: 当用户名/密码错误或用户未激活时抛出
            
        Example:
            >>> service = AuthService()
            >>> result = await service.login(
            ...     LoginRequest(
            ...         username="testuser",
            ...         password="password123",
            ...         tenant_id=1
            ...     )
            ... )
            >>> "access_token" in result
            True
        """
        # 查找用户（仅支持用户名登录，符合中国用户使用习惯）
        # 优先查找系统级超级管理员（tenant_id=None 且 is_superuser=True）
        # 如果提供了 tenant_id，同时过滤租户，避免多租户用户名冲突
        # 使用数据库连接检查和重试机制
        from core.database import db_operation_with_retry
        
        # 定义查询用户的函数
        async def query_user():
            """查询用户的内部函数"""
            # 优先查找系统级超级管理员（tenant_id=None 且 is_superuser=True）
            # 系统级超级管理员不需要 tenant_id，可以跨租户访问
            user = await User.get_or_none(
                username=data.username,
                tenant_id__isnull=True,
                is_superuser=True
            )
            
            # 如果不是系统级超级管理员，根据是否提供 tenant_id 进行查找
            if not user:
                if data.tenant_id is not None:
                    # 提供了 tenant_id，查找该租户内的用户
                    user = await User.get_or_none(
                        username=data.username,
                        tenant_id=data.tenant_id
                    )
                else:
                    # 没有提供 tenant_id，查找任意租户的用户（可能多个租户有相同用户名）
                    user = await User.get_or_none(username=data.username)
            
            return user
        
        # 使用重试机制执行查询（重试机制内部会处理连接检查）
        user = await db_operation_with_retry(query_user, max_retries=3, retry_delay=0.1)
        
        if not user:
            raise HTTPException(
                status_code=status.HTTP_401_UNAUTHORIZED,
                detail="用户名或密码错误"
            )
        
        # 验证密码
        if not verify_password(data.password, user.password_hash):
            raise HTTPException(
                status_code=status.HTTP_401_UNAUTHORIZED,
                detail="用户名或密码错误"
            )
        
        # 检查用户是否激活
        if not user.is_active:
            raise HTTPException(
                status_code=status.HTTP_403_FORBIDDEN,
                detail="用户未激活"
            )
        
        # 判断是否为系统级超级管理员
        is_system_superuser = user.is_superuser and user.tenant_id is None
        
        # 如果提供了 tenant_id，验证用户是否属于该租户（双重验证）
        # 系统级超级管理员可以访问任何租户，不需要验证
        if data.tenant_id is not None and not is_system_superuser:
            if user.tenant_id != data.tenant_id:
                raise HTTPException(
                    status_code=status.HTTP_403_FORBIDDEN,
                    detail="用户不属于指定的租户"
                )
        
        # 确定要使用的租户 ID（用于生成 Token）
        # 系统级超级管理员：如果提供了 tenant_id，使用提供的；否则使用 None
        # 普通用户：如果提供了 tenant_id，使用提供的；否则使用用户的租户
        if is_system_superuser:
            final_tenant_id = data.tenant_id if data.tenant_id is not None else None
        else:
            final_tenant_id = data.tenant_id if data.tenant_id is not None else user.tenant_id
        
        # 设置租户上下文（在查询租户列表之前设置，确保后续查询使用正确的租户上下文）
        # 系统级超级管理员可以不设置租户上下文（允许跨租户访问）
        if final_tenant_id is not None:
            set_current_tenant_id(final_tenant_id)
        
        # 生成 JWT Token（包含 tenant_id）⭐ 关键
        # 注意：在生成 Token 之前不进行额外的数据库查询，避免连接问题
        access_token = create_token_for_user(
            user_id=user.id,
            username=user.username,
            tenant_id=final_tenant_id,  # ⭐ 关键：包含租户 ID
            is_superuser=user.is_superuser,
            is_tenant_admin=user.is_tenant_admin,
        )
        
        # 计算过期时间（秒）
        from app.config import settings
        expires_in = settings.JWT_ACCESS_TOKEN_EXPIRE_MINUTES * 60
        
        # 暂时简化：不查询租户列表，不更新最后登录时间，只返回基本登录信息
        # 这些操作可以通过单独的接口或后台任务完成，避免影响登录流程
        tenants = None
        default_tenant_id = final_tenant_id
        requires_tenant_selection = False
        
        return {
            "access_token": access_token,
            "token_type": "bearer",
            "expires_in": expires_in,
            "user": {
                "id": user.id,
                "username": user.username,
                "email": user.email,
                "full_name": user.full_name,
                "tenant_id": final_tenant_id,
                "is_superuser": user.is_superuser,
                "is_tenant_admin": user.is_tenant_admin,
            },
            "tenants": tenants if tenants else None,
            "default_tenant_id": default_tenant_id,
            "requires_tenant_selection": requires_tenant_selection,
        }
    
    async def refresh_token(
        self,
        token: str
    ) -> dict:
        """
        刷新 Token
        
        验证当前 Token 并生成新的 Token。
        
        Args:
            token: 当前 JWT Token
            
        Returns:
            dict: 包含新的 access_token、token_type 和 expires_in 的字典
            
        Raises:
            HTTPException: 当 Token 无效时抛出
        """
        from core.security import get_token_payload
        
        # 验证 Token
        payload = get_token_payload(token)
        if not payload:
            raise HTTPException(
                status_code=status.HTTP_401_UNAUTHORIZED,
                detail="无效的 Token"
            )
        
        # 获取用户信息
        user_id = int(payload.get("sub"))
        user = await User.get_or_none(id=user_id)
        if not user or not user.is_active:
            raise HTTPException(
                status_code=status.HTTP_401_UNAUTHORIZED,
                detail="用户不存在或未激活"
            )
        
        # 生成新的 Token（包含 tenant_id）
        access_token = create_token_for_user(
            user_id=user.id,
            username=user.username,
            tenant_id=user.tenant_id,  # ⭐ 关键：包含租户 ID
            is_superuser=user.is_superuser,
            is_tenant_admin=user.is_tenant_admin,
        )
        
        # 计算过期时间（秒）
        from app.config import settings
        expires_in = settings.JWT_ACCESS_TOKEN_EXPIRE_MINUTES * 60
        
        return {
            "access_token": access_token,
            "token_type": "bearer",
            "expires_in": expires_in,
        }
    
    async def get_current_user(
        self,
        token: str
    ) -> User:
        """
        获取当前用户
        
        从 Token 中解析用户信息并返回用户对象。
        自动设置租户上下文。
        
        Args:
            token: JWT Token
            
        Returns:
            User: 用户对象
            
        Raises:
            HTTPException: 当 Token 无效或用户不存在时抛出
        """
        from core.security import get_token_payload
        
        # 验证 Token
        payload = get_token_payload(token)
        if not payload:
            raise HTTPException(
                status_code=status.HTTP_401_UNAUTHORIZED,
                detail="无效的 Token"
            )
        
        # 获取用户 ID
        user_id = int(payload.get("sub"))
        tenant_id = payload.get("tenant_id")  # ⭐ 关键：从 Token 中获取租户 ID
        
        # 设置租户上下文
        if tenant_id:
            set_current_tenant_id(tenant_id)
        
        # 获取用户
        user = await User.get_or_none(id=user_id)
        if not user:
            raise HTTPException(
                status_code=status.HTTP_401_UNAUTHORIZED,
                detail="用户不存在"
            )
        
        if not user.is_active:
            raise HTTPException(
                status_code=status.HTTP_403_FORBIDDEN,
                detail="用户未激活"
            )
        
        return user

