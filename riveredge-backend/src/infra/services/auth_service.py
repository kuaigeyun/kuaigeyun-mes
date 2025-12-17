"""
认证服务模块

提供用户认证相关的业务逻辑，包括注册、登录、Token 刷新等功能
"""

from fastapi import HTTPException, status
from loguru import logger
from starlette.requests import Request
from typing import Optional
import asyncio

from tortoise import Tortoise
from infra.infrastructure.database.database import TORTOISE_ORM

from infra.models.user import User
from infra.models.tenant import Tenant, TenantStatus, TenantPlan
from infra.schemas.auth import LoginRequest, UserRegisterRequest, PersonalRegisterRequest, OrganizationRegisterRequest
from infra.schemas.tenant import TenantCreate
from infra.domain.security.security import (
    create_token_for_user,
    verify_password,
    hash_password,
)
from infra.domain.tenant_context import set_current_tenant_id
from infra.services.tenant_service import TenantService


async def _ensure_db_connection():
    """
    确保数据库连接已初始化

    由于跳过 register_tortoise，我们需要在需要时手动初始化
    """
    try:
        # 检查是否已初始化
        Tortoise.get_connection("default")
    except:
        # 未初始化，尝试初始化
        await Tortoise.init(config=TORTOISE_ORM)
        logger.debug("Tortoise ORM 手动初始化成功")


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
            is_infra_admin=False,
            is_tenant_admin=False,
        )
        
        return user
    
    async def register_personal(
        self,
        data: PersonalRegisterRequest
    ) -> dict:
        """
        个人注册
        
        如果提供了 tenant_id，则在指定组织中创建用户；否则在默认组织中创建用户。
        如果提供了 invite_code，则验证邀请码并直接注册成功（免审核）。
        
        Args:
            data: 个人注册请求数据
            
        Returns:
            dict: 包含 success、message、user_id 的字典
            
        Raises:
            HTTPException: 当组织不存在、用户名已存在或邀请码无效时抛出
        """
        from infra.services.user_service import UserService
        from infra.services.tenant_service import TenantService
        
        user_service = UserService()
        tenant_service = TenantService()
        
        # 确定要使用的组织 ID
        tenant_id = data.tenant_id
        
        # 如果没有提供 tenant_id，使用默认组织
        if tenant_id is None:
            default_tenant = await tenant_service.get_tenant_by_domain(
                "default",
                skip_tenant_filter=True
            )
            if not default_tenant:
                # 如果默认组织不存在，创建它
                from infra.schemas.tenant import TenantCreate
                default_tenant_data = TenantCreate(
                    name="默认组织",
                    domain="default",
                    status=TenantStatus.ACTIVE,
                    plan=TenantPlan.BASIC,
                    settings={
                        "description": "系统默认组织，用于个人注册",
                        "is_default": True,
                    },
                    max_users=1000,
                    max_storage=10240,
                    expires_at=None,
                )
                default_tenant = await tenant_service.create_tenant(default_tenant_data)
                await tenant_service.initialize_tenant_data(default_tenant.id)
            tenant_id = default_tenant.id
        
        # 检查组织是否存在
        tenant = await Tenant.get_or_none(id=tenant_id)
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
        
        # 如果提供了邀请码，验证邀请码（这里简化处理，实际应该从组织设置中读取邀请码）
        if data.invite_code:
            # TODO: 实现邀请码验证逻辑
            # 如果邀请码有效，直接注册成功（免审核）
            pass
        
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
        
        # 创建用户
        from infra.schemas.user import UserCreate
        user_data = UserCreate(
            username=data.username,
            email=data.email,
            password=data.password,
            full_name=data.full_name,
            tenant_id=tenant_id,
            is_active=True,  # 个人注册直接激活
            is_infra_admin=False,
            is_tenant_admin=False,
        )
        user = await user_service.create_user(user_data, tenant_id=tenant_id)
        
        return {
            "success": True,
            "message": "注册成功",
            "user_id": user.id
        }
    
    async def register_organization(
        self,
        data: OrganizationRegisterRequest
    ) -> dict:
        """
        组织注册
        
        创建新组织并注册管理员用户。
        如果未提供 tenant_domain，则自动生成8位随机域名。
        
        Args:
            data: 组织注册请求数据
            
        Returns:
            dict: 包含 success、message、tenant_id、user_id 的字典
            
        Raises:
            HTTPException: 当域名已存在或用户名已存在时抛出
        """
        from infra.services.tenant_service import TenantService
        from infra.services.user_service import UserService
        from infra.schemas.tenant import TenantCreate
        from infra.schemas.user import UserCreate
        import random
        import string
        
        tenant_service = TenantService()
        user_service = UserService()
        
        # 确定组织域名
        tenant_domain = data.tenant_domain
        
        # 如果未提供域名，自动生成8位随机域名
        if not tenant_domain:
            # 生成8位随机字符串（小写字母和数字）
            chars = string.ascii_lowercase + string.digits
            tenant_domain = ''.join(random.choices(chars, k=8))
            
            # 确保域名唯一
            max_attempts = 10
            attempts = 0
            while await Tenant.get_or_none(domain=tenant_domain) and attempts < max_attempts:
                tenant_domain = ''.join(random.choices(chars, k=8))
                attempts += 1
            
            if attempts >= max_attempts:
                raise HTTPException(
                    status_code=status.HTTP_500_INTERNAL_SERVER_ERROR,
                    detail="无法生成唯一的组织域名，请稍后重试"
                )
        
        # 检查域名是否已存在
        existing_tenant = await Tenant.get_or_none(domain=tenant_domain)
        if existing_tenant:
            raise HTTPException(
                status_code=status.HTTP_400_BAD_REQUEST,
                detail=f"域名 {tenant_domain} 已被使用"
            )
        
        # 创建组织（状态为 INACTIVE，需要管理员审核）
        tenant_data = TenantCreate(
            name=data.tenant_name,
            domain=tenant_domain,
            status=TenantStatus.INACTIVE,  # 新注册的组织需要审核
            plan=TenantPlan.TRIAL,  # 默认体验套餐
            settings={
                "description": f"组织注册：{data.tenant_name}",
                "registered_by": data.username,
            },
            max_users=None,  # 根据套餐自动设置
            max_storage=None,  # 根据套餐自动设置
            expires_at=None,
        )
        tenant = await tenant_service.create_tenant(tenant_data)
        
        # 初始化组织数据（创建默认角色、权限等）
        await tenant_service.initialize_tenant_data(tenant.id)
        
        # 创建管理员用户
        user_data = UserCreate(
            username=data.username,
            email=data.email,
            password=data.password,
            full_name=data.full_name,
            tenant_id=tenant.id,
            is_active=True,  # 管理员直接激活
            is_infra_admin=False,
            is_tenant_admin=True,  # ⭐ 关键：设置为组织管理员
        )
        user = await user_service.create_user(user_data, tenant_id=tenant.id)
        
        logger.info(f"组织注册成功: {tenant.name} (ID: {tenant.id}, 域名: {tenant.domain}), 管理员: {user.username} (ID: {user.id})")
        
        return {
            "success": True,
            "message": "注册成功，等待管理员审核",
            "tenant_id": tenant.id,
            "user_id": user.id
        }
    
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
        # 确保数据库连接已初始化
        await _ensure_db_connection()

        logger.info(f"开始登录: username={data.username}, tenant_id={getattr(data, 'tenant_id', None)}")
        # 查找用户（仅支持用户名登录，符合中国用户使用习惯）
        # 优先查找平台管理（tenant_id=None 且 is_infra_admin=True）
        # 如果提供了 tenant_id，同时过滤组织，避免多组织用户名冲突
        # 注意：使用 register_tortoise 后，连接池会自动管理，直接使用 Tortoise ORM 原生查询
        
        # 优先查找平台管理（tenant_id=None 且 is_infra_admin=True）
        # 平台管理不需要 tenant_id，可以跨组织访问
        user = await User.get_or_none(
            username=data.username,
            tenant_id__isnull=True,
            is_infra_admin=True
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
        is_infra_admin = user.is_infra_admin
        
        # 如果提供了 tenant_id，验证用户是否属于该组织（双重验证）
        # 平台管理可以访问任何组织，不需要验证
        if data.tenant_id is not None and not is_infra_admin:
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
        if is_infra_admin:
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
            is_infra_admin=user.is_infra_admin,
            is_tenant_admin=user.is_tenant_admin,
        )
        
        # 计算过期时间（秒）
        from infra.config.infra_config import infra_settings as settings
        expires_in = settings.JWT_ACCESS_TOKEN_EXPIRE_MINUTES * 60
        
        # 查询用户所属的所有组织列表（用于多组织登录选择）
        # 查询所有具有相同 username 的用户（不同组织），获取他们的 tenant_id
        user_tenants_list = []
        if not is_infra_admin:
            # 组织管理员和普通用户：查询所有具有相同 username 的用户（不同组织）
            from infra.models.tenant import Tenant
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
            # ⚠️ 关键修复：如果用户只有一个组织，确保也返回该组织信息（用于前端显示组织名称）
            elif final_tenant_id:
                # 如果用户只有一个组织，直接查询该组织信息
                tenant = await Tenant.get_or_none(id=final_tenant_id)
                if tenant:
                    user_tenants_list = [
                        {
                            "id": tenant.id,
                            "uuid": str(tenant.uuid),
                            "name": tenant.name,
                            "domain": tenant.domain,
                            "status": tenant.status.value,
                        }
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
                "is_infra_admin": user.is_infra_admin,
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
                from core.services.online_user_service import OnlineUserService
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
        from infra.domain.security.security import get_token_payload
        
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
            is_infra_admin=user.is_infra_admin,
            is_tenant_admin=user.is_tenant_admin,
        )
        
        # 计算过期时间（秒）
        from infra.config.infra_config import infra_settings as settings
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
        # 确保数据库连接已初始化
        await _ensure_db_connection()

        from infra.schemas.tenant import TenantCreate
        from infra.schemas.user import UserCreate

        tenant_service = TenantService()
        from infra.services.user_service import UserService
        user_service = UserService()
        
        try:
            # 1. 获取或创建默认组织（domain="default"）
            logger.info("开始查找默认组织...")
            try:
                logger.info("调用 tenant_service.get_tenant_by_domain...")
                default_tenant = await tenant_service.get_tenant_by_domain(
                    "default",
                    skip_tenant_filter=True
                )
                logger.info(f"默认组织查找结果: {default_tenant}")
                if default_tenant:
                    logger.info(f"默认组织详情: id={default_tenant.id}, name={default_tenant.name}")
            except Exception as e:
                logger.error(f"查找默认组织时出错: {e}")
                import traceback
                logger.error(f"详细错误: {traceback.format_exc()}")
                raise
            
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
                if not default_tenant:
                    raise ValueError("创建默认组织失败：create_tenant 返回 None")
                await tenant_service.initialize_tenant_data(default_tenant.id)
            
            # 确保 default_tenant 不为 None（双重验证）
            if not default_tenant:
                raise ValueError("默认组织不存在或创建失败")

            logger.info(f"默认组织验证通过: id={default_tenant.id}, name={default_tenant.name}")

            # 设置组织上下文（确保后续操作使用正确的组织上下文）
            set_current_tenant_id(default_tenant.id)
            logger.info(f"组织上下文已设置: tenant_id={default_tenant.id}")
            
            # 2. 获取或创建预设的体验账户（username="guest"）
            guest_username = "guest"
            guest_password = "guest123"  # 预设密码，体验账户使用固定密码
            
            logger.info(f"查找体验账户: username={guest_username}, tenant_id={default_tenant.id}")
            guest_user = await User.get_or_none(
                username=guest_username,
                tenant_id=default_tenant.id
            )
            logger.info(f"体验账户查找结果: {guest_user.id if guest_user else 'None'}")

            if not guest_user:
                logger.info("体验账户不存在，开始创建...")
                # 如果体验账户不存在，创建它
                user_data = UserCreate(
                    username=guest_username,
                    email=None,
                    password=guest_password,
                    full_name="体验用户",
                    tenant_id=default_tenant.id,
                    is_active=True,  # 体验账户直接激活
                    is_infra_admin=False,
                    is_tenant_admin=False,  # 体验账户不是组织管理员
                )
                guest_user = await user_service.create_user(user_data, tenant_id=default_tenant.id)
                logger.info(f"体验账户创建结果: {guest_user.id if guest_user else 'None'}")

            # 验证 guest_user 是否创建成功
            if not guest_user:
                raise ValueError("创建体验账户失败：user_service.create_user 返回 None")
            
            # 3. 生成 Token（包含 tenant_id）
            logger.info(f"开始生成 Token: user_id={guest_user.id}, username={guest_user.username}, tenant_id={default_tenant.id}")
            access_token = create_token_for_user(
                user_id=guest_user.id,
                username=guest_user.username,
                tenant_id=default_tenant.id,  # ⭐ 关键：包含组织 ID
                is_infra_admin=guest_user.is_infra_admin,
                is_tenant_admin=guest_user.is_tenant_admin,
            )
            logger.info(f"Token 生成成功: length={len(access_token) if access_token else 0}")
            
            # 计算过期时间（秒）
            from infra.config.infra_config import infra_settings as settings
            expires_in = settings.JWT_ACCESS_TOKEN_EXPIRE_MINUTES * 60
            
            # 4. 返回登录响应
            # ⚠️ 关键修复：在 user 对象中包含 tenant_name，确保前端可以正确显示租户名称
            user_info_dict = {
                "id": guest_user.id,
                "uuid": str(guest_user.uuid),
                "username": guest_user.username,
                "email": guest_user.email,
                "full_name": guest_user.full_name,
                "tenant_id": default_tenant.id,
                "tenant_name": default_tenant.name,  # ⚠️ 关键修复：包含租户名称
                "is_infra_admin": guest_user.is_infra_admin,
                "is_tenant_admin": guest_user.is_tenant_admin,
            }
            
            # 确保 default_tenant 不为 None（双重验证）
            if not default_tenant:
                raise ValueError("默认组织不存在或创建失败")
            
            return {
                "access_token": access_token,
                "token_type": "bearer",
                "expires_in": expires_in,
                "user": user_info_dict,
                "tenants": None,  # 体验账户只有一个组织，不需要选择（与历史版本保持一致）
                "default_tenant_id": default_tenant.id,
                "requires_tenant_selection": False,
            }
            
        except Exception as e:
            import traceback
            error_trace = traceback.format_exc()
            logger.error(f"免注册体验登录失败: {e}")
            logger.error(f"错误堆栈:\n{error_trace}")

            # 简化错误处理，避免编码问题
            raise HTTPException(
                status_code=status.HTTP_500_INTERNAL_SERVER_ERROR,
                detail="免注册体验登录失败，请联系管理员"
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
        from infra.domain.security.security import get_token_payload
        
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
    
    async def _log_login_attempt(
        self,
        tenant_id: Optional[int],
        user_id: Optional[int],
        username: str,
        login_status: str,
        failure_reason: Optional[str],
        request: Request
    ) -> None:
        """
        记录登录尝试日志
        
        Args:
            tenant_id: 组织ID（登录失败时可能为空）
            user_id: 用户ID（登录失败时可能为空）
            username: 登录账号
            login_status: 登录状态（success、failed）
            failure_reason: 失败原因（登录失败时记录）
            request: 请求对象
        """
        try:
            from core.services.login_log_service import LoginLogService
            from core.schemas.login_log import LoginLogCreate
            
            # 获取 IP 地址
            login_ip = None
            if request.client:
                login_ip = request.client.host
            # 优先从 X-Forwarded-For 获取（代理服务器）
            forwarded_for = request.headers.get("X-Forwarded-For")
            if forwarded_for:
                login_ip = forwarded_for.split(",")[0].strip()
            # 从 X-Real-IP 获取
            if not login_ip:
                real_ip = request.headers.get("X-Real-IP")
                if real_ip:
                    login_ip = real_ip
            
            # 获取用户代理
            user_agent = request.headers.get("User-Agent", "")
            
            # 解析登录设备（简单判断）
            login_device = None
            if user_agent:
                user_agent_lower = user_agent.lower()
                if "mobile" in user_agent_lower or "android" in user_agent_lower or "iphone" in user_agent_lower:
                    login_device = "Mobile"
                elif "tablet" in user_agent_lower or "ipad" in user_agent_lower:
                    login_device = "Tablet"
                else:
                    login_device = "PC"
            
            # 解析登录浏览器（简单提取）
            login_browser = None
            if user_agent:
                if "Chrome" in user_agent:
                    login_browser = "Chrome"
                elif "Firefox" in user_agent:
                    login_browser = "Firefox"
                elif "Safari" in user_agent:
                    login_browser = "Safari"
                elif "Edge" in user_agent:
                    login_browser = "Edge"
                elif "Opera" in user_agent:
                    login_browser = "Opera"
                else:
                    login_browser = "Unknown"
            
            # 创建登录日志
            login_log_data = LoginLogCreate(
                tenant_id=tenant_id,
                user_id=user_id,
                username=username,
                login_ip=login_ip or "unknown",
                login_location=None,  # 可以根据 IP 解析地理位置（可选）
                login_device=login_device,
                login_browser=login_browser,
                login_status=login_status,
                failure_reason=failure_reason,
            )
            
            await LoginLogService.create_login_log(login_log_data)
        except Exception as e:
            # 登录日志记录失败不影响登录流程，静默处理
            logger.warning(f"记录登录日志失败: {e}")

