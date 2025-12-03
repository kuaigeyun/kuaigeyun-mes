"""
认证服务模块

提供用户认证相关的业务逻辑，包括注册、登录、Token 刷新等功能
"""

from fastapi import HTTPException, status
from loguru import logger
from starlette.requests import Request
from typing import Optional
import asyncio

from soil.models.user import User
from soil.models.tenant import Tenant, TenantStatus, TenantPlan
from soil.schemas.auth import LoginRequest, UserRegisterRequest
from soil.schemas.tenant import TenantCreate
from soil.core.security.security import (
    create_token_for_user,
    verify_password,
    hash_password,
)
from soil.core.tenant_context import set_current_tenant_id
from soil.services.tenant_service import TenantService


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
        
        在已有组织中创建新用户并自动设置组织 ID。
        
        Args:
            data: 用户注册请求数据（包含 tenant_id）
            
        Returns:
            User: 创建的用户对象
            
        Raises:
            HTTPException: 当组织不存在或用户名已存在时抛出
            
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
        # 检查组织是否存在
        tenant = await Tenant.get_or_none(id=data.tenant_id)
        if not tenant:
            raise HTTPException(
                status_code=status.HTTP_404_NOT_FOUND,
                detail="组织不存在"
            )
        
        # 检查组织是否激活
        if tenant.status != TenantStatus.ACTIVE:
            raise HTTPException(
                status_code=status.HTTP_400_BAD_REQUEST,
                detail="组织未激活，无法注册"
            )
        
        # 检查组织内用户名是否已存在
        existing_username = await User.get_or_none(
            tenant_id=data.tenant_id,
            username=data.username
        )
        if existing_username:
            raise HTTPException(
                status_code=status.HTTP_400_BAD_REQUEST,
                detail="该组织下用户名已被使用"
            )
        
        # 创建用户（自动设置 tenant_id）
        password_hash = hash_password(data.password)
        user = await User.create(
            tenant_id=data.tenant_id,  # ⭐ 关键：自动设置组织 ID
            username=data.username,
            email=data.email if data.email else None,  # 邮箱可选
            password_hash=password_hash,
            full_name=data.full_name,
            is_active=True,
            is_platform_admin=False,
            is_tenant_admin=False,
        )
        
        return user
    
    async def login(
        self,
        data: LoginRequest,
        request: Request = None
    ) -> dict:
        """
        用户登录
        
        验证用户凭据并返回 JWT Token（包含 tenant_id）。
        登录成功后自动设置组织上下文。
        
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
        # 优先查找平台管理（tenant_id=None 且 is_platform_admin=True）
        # 如果提供了 tenant_id，同时过滤组织，避免多组织用户名冲突
        # 注意：使用 register_tortoise 后，连接池会自动管理，直接使用 Tortoise ORM 原生查询
        
        # 优先查找平台管理（tenant_id=None 且 is_platform_admin=True）
        # 平台管理不需要 tenant_id，可以跨组织访问
        user = await User.get_or_none(
            username=data.username,
            tenant_id__isnull=True,
            is_platform_admin=True
        )
        
        # 如果不是系统级超级管理员，根据是否提供 tenant_id 进行查找
        if not user:
            if data.tenant_id is not None:
                # 提供了 tenant_id，查找该组织内的用户
                user = await User.get_or_none(
                    username=data.username,
                    tenant_id=data.tenant_id
                )
            else:
                # 没有提供 tenant_id，查找任意组织的用户（可能多个组织有相同用户名）
                user = await User.get_or_none(username=data.username)
        
        if not user:
            # 记录登录失败日志（用户不存在）
            if request:
                asyncio.create_task(self._log_login_attempt(
                    tenant_id=None,
                    user_id=None,
                    username=data.username,
                    login_status="failed",
                    failure_reason="用户名或密码错误",
                    request=request
                ))
            raise HTTPException(
                status_code=status.HTTP_401_UNAUTHORIZED,
                detail="用户名或密码错误"
            )
        
        # 验证密码
        if not verify_password(data.password, user.password_hash):
            # 记录登录失败日志（密码错误）
            if request:
                asyncio.create_task(self._log_login_attempt(
                    tenant_id=user.tenant_id,
                    user_id=user.id,
                    username=data.username,
                    login_status="failed",
                    failure_reason="用户名或密码错误",
                    request=request
                ))
            raise HTTPException(
                status_code=status.HTTP_401_UNAUTHORIZED,
                detail="用户名或密码错误"
            )
        
        # 检查用户是否激活
        if not user.is_active:
            # 记录登录失败日志（用户未激活）
            if request:
                asyncio.create_task(self._log_login_attempt(
                    tenant_id=user.tenant_id,
                    user_id=user.id,
                    username=data.username,
                    login_status="failed",
                    failure_reason="用户未激活",
                    request=request
                ))
            raise HTTPException(
                status_code=status.HTTP_403_FORBIDDEN,
                detail="用户未激活"
            )
        
        # 判断是否为平台管理（系统级超级管理员）
        is_platform_admin = user.is_platform_admin
        
        # 如果提供了 tenant_id，验证用户是否属于该组织（双重验证）
        # 平台管理可以访问任何组织，不需要验证
        if data.tenant_id is not None and not is_platform_admin:
            if user.tenant_id != data.tenant_id:
                # 记录登录失败日志（用户不属于指定组织）
                if request:
                    asyncio.create_task(self._log_login_attempt(
                        tenant_id=user.tenant_id,
                        user_id=user.id,
                        username=data.username,
                        login_status="failed",
                        failure_reason="用户不属于指定的组织",
                        request=request
                    ))
                raise HTTPException(
                    status_code=status.HTTP_403_FORBIDDEN,
                    detail="用户不属于指定的组织"
                )
        
        # 确定要使用的组织 ID（用于生成 Token）
        # 平台管理：如果提供了 tenant_id，使用提供的；否则使用 None
        # 组织管理员和普通用户：如果提供了 tenant_id，使用提供的；否则使用用户的组织
        if is_platform_admin:
            final_tenant_id = data.tenant_id if data.tenant_id is not None else None
        else:
            final_tenant_id = data.tenant_id if data.tenant_id is not None else user.tenant_id
        
        # 设置组织上下文（在查询组织列表之前设置，确保后续查询使用正确的组织上下文）
        # 平台管理可以不设置组织上下文（允许跨组织访问）
        if final_tenant_id is not None:
            set_current_tenant_id(final_tenant_id)
        
        # 生成 JWT Token（包含 tenant_id）⭐ 关键
        # 注意：在生成 Token 之前不进行额外的数据库查询，避免连接问题
        access_token = create_token_for_user(
            user_id=user.id,
            username=user.username,
            tenant_id=final_tenant_id,  # ⭐ 关键：包含组织 ID
            is_platform_admin=user.is_platform_admin,
            is_tenant_admin=user.is_tenant_admin,
        )
        
        # 计算过期时间（秒）
        from soil.config.platform_config import platform_settings as settings
        expires_in = settings.JWT_ACCESS_TOKEN_EXPIRE_MINUTES * 60
        
        # 查询用户所属的所有组织列表（用于多组织登录选择）
        # 查询所有具有相同 username 的用户（不同组织），获取他们的 tenant_id
        user_tenants_list = []
        if not is_platform_admin:
            # 组织管理员和普通用户：查询所有具有相同 username 的用户（不同组织）
            from soil.models.tenant import Tenant
            users_with_same_username = await User.filter(
                username=user.username,
                is_active=True
            ).all()
            
            # 获取所有有效的组织 ID（排除 None）
            tenant_ids = [u.tenant_id for u in users_with_same_username if u.tenant_id is not None]
            
            # 查询组织信息
            if tenant_ids:
                tenants_queryset = await Tenant.filter(id__in=tenant_ids).all()
                user_tenants_list = [
                    {
                        "id": tenant.id,
                        "uuid": str(tenant.uuid),
                        "name": tenant.name,
                        "domain": tenant.domain,
                        "status": tenant.status.value,
                    }
                    for tenant in tenants_queryset
                ]
        
        # 判断是否需要组织选择
        requires_tenant_selection = len(user_tenants_list) > 1
        
        # 如果没有组织列表，使用当前组织作为默认组织
        default_tenant_id = final_tenant_id
        
        result = {
            "access_token": access_token,
            "token_type": "bearer",
            "expires_in": expires_in,
            "user": {
                "id": user.id,
                "uuid": str(user.uuid),
                "username": user.username,
                "email": user.email,
                "full_name": user.full_name,
                "tenant_id": final_tenant_id,
                "is_platform_admin": user.is_platform_admin,
                "is_tenant_admin": user.is_tenant_admin,
            },
            "tenants": user_tenants_list if user_tenants_list else None,
            "default_tenant_id": default_tenant_id,
            "requires_tenant_selection": requires_tenant_selection,
        }
        
        # 记录登录成功日志（异步执行，不阻塞响应）
        if request:
            asyncio.create_task(self._log_login_attempt(
                tenant_id=final_tenant_id,
                user_id=user.id,
                username=data.username,
                login_status="success",
                failure_reason=None,
                request=request
            ))
            
            # 更新用户活动时间（记录登录时间和登录IP）
            try:
                from tree_root.services.online_user_service import OnlineUserService
                from datetime import datetime
                login_ip = request.client.host if request.client else None
                asyncio.create_task(
                    OnlineUserService.update_user_activity(
                        tenant_id=final_tenant_id,
                        user_id=user.id,
                        login_ip=login_ip,
                        login_time=datetime.now(),
                    )
                )
            except Exception:
                # 更新活动时间失败不影响登录，静默处理
                pass
        
        return result
    
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
        from soil.core.security.security import get_token_payload
        
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
            tenant_id=user.tenant_id,  # ⭐ 关键：包含组织 ID
            is_platform_admin=user.is_platform_admin,
            is_tenant_admin=user.is_tenant_admin,
        )
        
        # 计算过期时间（秒）
        from soil.config.platform_config import platform_settings as settings
        expires_in = settings.JWT_ACCESS_TOKEN_EXPIRE_MINUTES * 60
        
        return {
            "access_token": access_token,
            "token_type": "bearer",
            "expires_in": expires_in,
        }
    
    async def guest_login(self) -> dict:
        """
        免注册体验登录
        
        获取或创建默认组织和预设的体验账户，直接返回登录响应。
        体验账户只有浏览权限（只读权限），无新建、编辑、删除权限。
        
        Returns:
            dict: 包含 access_token、token_type、expires_in 和 user 信息的字典
            
        Raises:
            HTTPException: 当创建体验账户失败时抛出
        """
        from soil.schemas.tenant import TenantCreate
        from soil.schemas.user import UserCreate
        
        tenant_service = TenantService()
        from soil.services.user_service import UserService
        user_service = UserService()
        
        try:
            # 1. 获取或创建默认组织（domain="default"）
            default_tenant = await tenant_service.get_tenant_by_domain(
                "default",
                skip_tenant_filter=True
            )
            
            if not default_tenant:
                # 如果默认组织不存在，创建它
                default_tenant_data = TenantCreate(
                    name="默认组织",
                    domain="default",
                    status=TenantStatus.ACTIVE,  # 默认组织直接激活
                    plan=TenantPlan.BASIC,
                    settings={
                        "description": "系统默认组织，用于免注册体验",
                        "is_default": True,
                    },
                    max_users=1000,  # 默认组织允许更多用户
                    max_storage=10240,  # 默认组织允许更多存储空间（10GB）
                    expires_at=None,  # 默认组织永不过期
                )
                default_tenant = await tenant_service.create_tenant(default_tenant_data)
                await tenant_service.initialize_tenant_data(default_tenant.id)
            
            # 2. 获取或创建预设的体验账户（username="guest"）
            guest_username = "guest"
            guest_password = "guest123"  # 预设密码，体验账户使用固定密码
            
            guest_user = await User.get_or_none(
                username=guest_username,
                tenant_id=default_tenant.id
            )
            
            if not guest_user:
                # 如果体验账户不存在，创建它
                user_data = UserCreate(
                    username=guest_username,
                    email=None,
                    password=guest_password,
                    full_name="体验用户",
                    tenant_id=default_tenant.id,
                    is_active=True,  # 体验账户直接激活
                    is_platform_admin=False,
                    is_tenant_admin=False,  # 体验账户不是组织管理员
                )
                guest_user = await user_service.create_user(user_data, tenant_id=default_tenant.id)
            
            # 3. 生成 Token（包含 tenant_id）
            access_token = create_token_for_user(
                user_id=guest_user.id,
                username=guest_user.username,
                tenant_id=default_tenant.id,  # ⭐ 关键：包含组织 ID
                is_platform_admin=guest_user.is_platform_admin,
                is_tenant_admin=guest_user.is_tenant_admin,
            )
            
            # 计算过期时间（秒）
            from soil.config.platform_config import platform_settings as settings
            expires_in = settings.JWT_ACCESS_TOKEN_EXPIRE_MINUTES * 60
            
            # 4. 返回登录响应
            return {
                "access_token": access_token,
                "token_type": "bearer",
                "expires_in": expires_in,
                "user": {
                    "id": guest_user.id,
                    "uuid": str(guest_user.uuid),
                    "username": guest_user.username,
                    "email": guest_user.email,
                    "full_name": guest_user.full_name,
                    "tenant_id": default_tenant.id,
                    "is_platform_admin": guest_user.is_platform_admin,
                    "is_tenant_admin": guest_user.is_tenant_admin,
                },
                "tenants": None,  # 体验账户只有一个组织，不需要选择
                "default_tenant_id": default_tenant.id,
                "requires_tenant_selection": False,
            }
            
        except Exception as e:
            import traceback
            error_trace = traceback.format_exc()
            logger.error(f"免注册体验登录失败: {e}")
            logger.error(f"错误堆栈:\n{error_trace}")
            raise HTTPException(
                status_code=status.HTTP_500_INTERNAL_SERVER_ERROR,
                detail=f"免注册体验登录失败: {str(e)}"
            )
    
    async def get_current_user(
        self,
        token: str
    ) -> User:
        """
        获取当前用户
        
        从 Token 中解析用户信息并返回用户对象。
        自动设置组织上下文。
        
        Args:
            token: JWT Token
            
        Returns:
            User: 用户对象
            
        Raises:
            HTTPException: 当 Token 无效或用户不存在时抛出
        """
        from soil.core.security.security import get_token_payload
        
        # 验证 Token
        payload = get_token_payload(token)
        if not payload:
            raise HTTPException(
                status_code=status.HTTP_401_UNAUTHORIZED,
                detail="无效的 Token"
            )
        
        # 获取用户 ID
        user_id = int(payload.get("sub"))
        tenant_id = payload.get("tenant_id")  # ⭐ 关键：从 Token 中获取组织 ID
        
        # 设置组织上下文
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

