"""
认证服务模块

提供用户认证相关的业务逻辑，包括注册、登录、Token 刷新等功能
"""

from fastapi import HTTPException, status
from loguru import logger
from starlette.requests import Request
from typing import Optional
import asyncio
import smtplib
from email.mime.text import MIMEText
from email.mime.multipart import MIMEMultipart
import secrets
import string
import json
from typing import Dict, Any

from infra.infrastructure.http import get_http_client

from tortoise import Tortoise
from tortoise.queryset import Q
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
from core.services.authorization.user_permission_service import UserPermissionService
from core.services.authorization.permission_version_service import PermissionVersionService
from core.services.authorization.role_service import RoleService





class AuthService:
    """
    认证服务类
    
    提供用户认证相关的业务逻辑处理。
    """

    @staticmethod
    def _is_default_tenant(tenant: Tenant) -> bool:
        """是否为系统默认组织（domain=default）。"""
        return (tenant.domain or "").strip().lower() == "default"

    @staticmethod
    async def _ensure_user_has_guest_role(user_id: int, tenant_id: int) -> None:
        """为默认组织用户绑定已存在的 GUEST（体验用户）角色（幂等）。"""
        from core.models.user_role import UserRole

        guest_role = await RoleService.get_guest_role(tenant_id)
        if not guest_role:
            raise HTTPException(
                status_code=status.HTTP_503_SERVICE_UNAVAILABLE,
                detail="默认组织未配置 GUEST（体验用户）角色，请联系管理员",
            )
        exists = await UserRole.filter(user_id=user_id, role_id=guest_role.id).exists()
        if exists:
            return
        await UserRole.create(user_id=user_id, role_id=guest_role.id)
        await PermissionVersionService.bump(tenant_id=tenant_id, user_id=user_id)

    @staticmethod
    async def _active_tenant_id_set(tenant_ids: set[int]) -> set[int]:
        """返回仍处于激活状态的组织 ID 集合。"""
        if not tenant_ids:
            return set()
        active = await Tenant.filter(
            id__in=tenant_ids,
            status=TenantStatus.ACTIVE,
        ).values_list("id", flat=True)
        return set(active)

    @staticmethod
    async def _filter_users_with_active_tenant(users: list[User]) -> list[User]:
        """剔除所属组织已删除或未激活的用户，避免孤儿账号参与登录。"""
        if not users:
            return []
        tenant_ids = {u.tenant_id for u in users if u.tenant_id is not None}
        if not tenant_ids:
            return users
        active_ids = await AuthService._active_tenant_id_set(tenant_ids)
        return [u for u in users if u.tenant_id is None or u.tenant_id in active_ids]

    async def _lookup_users_by_account(
        self,
        username_or_phone: str,
        tenant_id: Optional[int] = None,
    ) -> list[User]:
        """按账号查找未删除的活跃用户（不按组织状态过滤）。"""
        q = Q(username=username_or_phone) | Q(phone=username_or_phone)
        queryset = User.filter(q, is_active=True, deleted_at__isnull=True)
        if tenant_id is not None:
            queryset = queryset.filter(tenant_id=tenant_id)
        return await queryset.all()

    async def _resolve_login_user(
        self,
        username_or_phone: str,
        password: str,
        tenant_id: Optional[int] = None,
    ) -> User:
        """
        解析登录用户：先校验密码，再要求所属组织存在且为激活状态。

        避免「密码正确但组织未激活/已删除」被误报为用户名或密码错误。
        """
        all_users = await self._lookup_users_by_account(username_or_phone, tenant_id)
        if not all_users:
            raise HTTPException(
                status_code=status.HTTP_401_UNAUTHORIZED,
                detail="用户名或密码错误",
            )

        matched = [u for u in all_users if verify_password(password, u.password_hash)]
        if not matched:
            raise HTTPException(
                status_code=status.HTTP_401_UNAUTHORIZED,
                detail="用户名或密码错误",
            )

        valid = await self._filter_users_with_active_tenant(matched)
        if not valid:
            raise HTTPException(
                status_code=status.HTTP_403_FORBIDDEN,
                detail="账号密码正确，但没有可登录的组织（组织已删除或未激活）",
            )

        if tenant_id is not None:
            for u in valid:
                if u.tenant_id == tenant_id:
                    return u
            raise HTTPException(
                status_code=status.HTTP_403_FORBIDDEN,
                detail="用户不属于指定的组织",
            )

        return valid[0]

    async def _find_login_candidate_users(
        self,
        username_or_phone: str,
        tenant_id: Optional[int] = None,
    ) -> list[User]:
        """按账号查找可登录用户，且所属组织必须存在且为激活状态。"""
        q = Q(username=username_or_phone) | Q(phone=username_or_phone)
        queryset = User.filter(q, is_active=True, deleted_at__isnull=True)
        if tenant_id is not None:
            queryset = queryset.filter(tenant_id=tenant_id)
        users = await queryset.all()
        return await self._filter_users_with_active_tenant(users)
    
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
        
        # 检查组织内用户名是否已存在（排除已软删除的用户，允许复用被删用户的用户名）
        existing_username = await User.get_or_none(
            tenant_id=data.tenant_id,
            username=data.username,
            deleted_at__isnull=True
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
    
    def generate_verification_code(self) -> str:
        """
        生成验证码

        生成指定长度的数字验证码。

        Returns:
            str: 生成s的验证码
        """
        from infra.config.infra_config import infra_settings
        length = infra_settings.VERIFICATION_CODE_LENGTH
        return ''.join(secrets.choice(string.digits) for _ in range(length))

    async def send_sms_verification_code(self, phone: str, code: str) -> bool:
        """
        发送短信验证码

        通过阿里云短信服务发送验证码。

        Args:
            phone: 手机号
            code: 验证码

        Returns:
            bool: 发送成功返回True，否则返回False
        """
        try:
            from infra.config.infra_config import infra_settings

            # 如果没有配置短信服务，直接返回True（开发环境）
            if not infra_settings.SMS_ACCESS_KEY_ID or not infra_settings.SMS_ACCESS_KEY_SECRET:
                logger.warning("短信服务未配置，使用模拟发送")
                logger.info(f"模拟发送验证码到 {phone}: {code}")
                return True

            # 阿里云短信发送逻辑（这里简化为HTTP请求示例）
            # 实际实现需要根据阿里云SMS API文档进行调整
            response = await get_http_client().post(
                "https://dysmsapi.aliyuncs.com/",
                data={
                    "AccessKeyId": infra_settings.SMS_ACCESS_KEY_ID,
                    "Action": "SendSms",
                    "SignName": infra_settings.SMS_SIGN_NAME,
                    "TemplateCode": infra_settings.SMS_TEMPLATE_CODE,
                    "TemplateParam": json.dumps({"code": code}),
                    "PhoneNumbers": phone,
                    "Version": "2017-05-25",
                    "Format": "JSON",
                    "SignatureMethod": "HMAC-SHA1",
                    "SignatureVersion": "1.0",
                    "Timestamp": "",
                    "Signature": "",
                },
            )
            result = response.json()
            if result.get("Code") == "OK":
                logger.info(f"短信验证码发送成功: {phone}")
                return True
            else:
                logger.error(f"短信验证码发送失败: {result}")
                return False

        except Exception as e:
            logger.error(f"发送短信验证码异常: {e}")
            return False

    async def send_email_verification_code(self, email: str, code: str) -> bool:
        """
        发送邮箱验证码

        通过SMTP发送验证码邮件。

        Args:
            email: 邮箱地址
            code: 验证码

        Returns:
            bool: 发送成功返回True，否则返回False
        """
        try:
            from infra.config.infra_config import infra_settings

            # 如果没有配置邮件服务，直接返回True（开发环境）
            if not infra_settings.SMTP_USER or not infra_settings.SMTP_PASSWORD:
                logger.warning("邮件服务未配置，使用模拟发送")
                logger.info(f"模拟发送验证码到 {email}: {code}")
                return True

            # 创建邮件内容
            msg = MIMEMultipart()
            msg['From'] = infra_settings.EMAIL_FROM
            msg['To'] = email
            msg['Subject'] = "RiverEdge 验证码"

            # HTML邮件内容
            html_content = f"""
            <html>
            <body>
                <h2>RiverEdge 注册验证码</h2>
                <p>您的验证码是：<strong style="font-size: 24px; color: #1890ff;">{code}</strong></p>
                <p>验证码有效期为10分钟，请及时使用。</p>
                <p>如果这不是您的操作，请忽略此邮件。</p>
                <hr>
                <p style="color: #666; font-size: 12px;">此邮件由系统自动发送，请勿回复。</p>
            </body>
            </html>
            """

            msg.attach(MIMEText(html_content, 'html', 'utf-8'))

            # 发送邮件
            server = smtplib.SMTP(infra_settings.SMTP_HOST, infra_settings.SMTP_PORT)
            if infra_settings.SMTP_TLS:
                server.starttls()
            server.login(infra_settings.SMTP_USER, infra_settings.SMTP_PASSWORD)
            server.send_message(msg)
            server.quit()

            logger.info(f"邮箱验证码发送成功: {email}")
            return True

        except Exception as e:
            logger.error(f"发送邮箱验证码异常: {e}")
            return False

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
        # 注意：PersonalRegisterRequest 中暂未包含 invite_code 字段，后续需要添加
        # if hasattr(data, 'invite_code') and data.invite_code:
        #     # 如果邀请码有效，直接注册成功（免审核）
        #     pass
        
        from infra.domain.security.reserved_username import assert_username_not_reserved

        assert_username_not_reserved(data.username)

        # 检查组织内用户名是否已存在（排除已软删除的用户，允许复用被删用户的用户名）
        existing_username = await User.get_or_none(
            tenant_id=tenant_id,
            username=data.username,
            deleted_at__isnull=True
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
            phone=data.phone,
            email=data.email,
            password=data.password,
            full_name=data.full_name,
            tenant_id=tenant_id,
            is_active=True,  # 个人注册直接激活
            is_infra_admin=False,
            is_tenant_admin=False,
        )
        user = await user_service.create_user(user_data, tenant_id=tenant_id)

        if self._is_default_tenant(tenant):
            await self._ensure_user_has_guest_role(user.id, tenant_id)
        
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

        # 检查平台是否开启自动审核
        from infra.models.platform_settings import PlatformSettings
        platform = await PlatformSettings.first()
        auto_approve = platform and getattr(platform, "tenant_auto_approve", False)

        # 创建组织（自动审核时直接 ACTIVE，否则 INACTIVE 需管理员审核）
        # 组织名称唯一性校验在 tenant_service.create_tenant 中统一处理
        tenant_data = TenantCreate(
            name=(data.tenant_name or "").strip() or data.tenant_name,
            domain=tenant_domain,
            status=TenantStatus.ACTIVE if auto_approve else TenantStatus.INACTIVE,
            plan=TenantPlan.TRIAL,  # 默认体验套餐
            settings={
                "description": f"组织注册：{data.tenant_name}",
                "registered_by": data.phone,  # 使用手机号作为注册人标识
            },
            max_users=None,  # 根据套餐自动设置
            max_storage=None,  # 根据套餐自动设置
            expires_at=None,
        )
        tenant = await tenant_service.create_tenant(tenant_data)
        
        # 初始化组织数据（创建默认角色、权限等）
        await tenant_service.initialize_tenant_data(tenant.id)
        
        # 创建管理员用户
        # ⭐ 关键：手机号即账号，自动作为用户名
        username = data.phone
        
        user_data = UserCreate(
            username=username,  # 手机号作为用户名
            phone=data.phone,
            email=data.email,
            password=data.password,
            full_name=data.full_name,
            tenant_id=tenant.id,
            is_active=True,  # 管理员直接激活
            is_infra_admin=False,
            is_tenant_admin=True,  # ⭐ 关键：设置为组织管理员
        )
        user = await user_service.create_user(user_data, tenant_id=tenant.id)
        
        logger.info(f"组织注册成功: {tenant.name} (ID: {tenant.id}, 域名: {tenant.domain}), 管理员: {user.username} (ID: {user.id}), 自动审核: {auto_approve}")
        
        return {
            "success": True,
            "message": "注册成功，等待管理员审核" if not auto_approve else "注册成功",
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
        """

        logger.info(f"开始登录: username_or_phone={data.username}, tenant_id={getattr(data, 'tenant_id', None)}")

        # 若指定了 tenant_id，先校验组织状态
        if data.tenant_id is not None:
            target_tenant = await Tenant.get_or_none(id=data.tenant_id)
            if not target_tenant:
                raise HTTPException(
                    status_code=status.HTTP_404_NOT_FOUND,
                    detail="组织不存在"
                )
            if target_tenant.status != TenantStatus.ACTIVE:
                raise HTTPException(
                    status_code=status.HTTP_403_FORBIDDEN,
                    detail="组织已暂停或未激活，无法登录"
                )

        # 优先查找平台管理
        user = await User.get_or_none(
            username=data.username,
            tenant_id__isnull=True,
            is_infra_admin=True,
            deleted_at__isnull=True
        )

        # 如果不是系统级超级管理员，按账号解析登录用户
        if not user:
            try:
                user = await self._resolve_login_user(
                    data.username,
                    data.password,
                    data.tenant_id,
                )
            except HTTPException as exc:
                if request and exc.status_code == status.HTTP_401_UNAUTHORIZED:
                    asyncio.create_task(self._log_login_attempt(
                        tenant_id=data.tenant_id,
                        user_id=None,
                        username=data.username,
                        login_status="failed",
                        failure_reason="用户名或密码错误",
                        request=request,
                    ))
                elif request and exc.status_code == status.HTTP_403_FORBIDDEN:
                    asyncio.create_task(self._log_login_attempt(
                        tenant_id=data.tenant_id,
                        user_id=None,
                        username=data.username,
                        login_status="failed",
                        failure_reason=str(exc.detail),
                        request=request,
                    ))
                raise
        
        if not user:
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
        
        is_infra_admin = user.is_infra_admin
        
        final_tenant_id = data.tenant_id if data.tenant_id is not None else user.tenant_id

        if not is_infra_admin and final_tenant_id is not None:
            active_tenant = await Tenant.get_or_none(
                id=final_tenant_id, status=TenantStatus.ACTIVE
            )
            if not active_tenant:
                raise HTTPException(
                    status_code=status.HTTP_403_FORBIDDEN,
                    detail="所属组织不存在或已停用，无法登录",
                )
        
        # 6. 生成登录结果
        result = await self.generate_login_result(user, request, final_tenant_id)
        return result

    async def generate_login_result(
        self,
        user: User,
        request: Request = None,
        tenant_id: Optional[int] = None
    ) -> dict:
        """
        生成登录成功的响应数据（Token 和用户信息）

        Args:
            user: 用户对象
            request: 请求对象
            tenant_id: 选定的组织 ID（可选）

        Returns:
            dict: 登录成功的响应数据
        """
        # 判断是否为平台管理（系统级超级管理员）
        is_infra_admin = user.is_infra_admin
        final_tenant_id = tenant_id if tenant_id is not None else user.tenant_id
        
        # 针对平台超级管理员，如果未指定 tenant_id，则保持 None (代表全局视图)
        if is_infra_admin and tenant_id is None:
            final_tenant_id = None

        # 1. 设置组织上下文
        if final_tenant_id is not None:
            from infra.domain.tenant_context import set_current_tenant_id
            set_current_tenant_id(final_tenant_id)
        
        # 2. 生成 JWT Token
        from infra.domain.security.security import create_token_for_user
        access_token = create_token_for_user(
            user_id=user.id,
            username=user.username,
            tenant_id=final_tenant_id,
            is_infra_admin=user.is_infra_admin,
            is_tenant_admin=user.is_tenant_admin,
        )
        
        # 计算过期时间
        from infra.config.infra_config import infra_settings as settings
        expires_in = settings.JWT_ACCESS_TOKEN_EXPIRE_MINUTES * 60
        
        # 3. 构建用户组织列表（仅包含所属组织仍有效且激活的账号）
        user_tenants_list = []
        if not is_infra_admin:
            q = Q(username=user.username)
            if user.phone:
                q = q | Q(phone=user.phone)
            users_with_same_username = await User.filter(
                q,
                is_active=True,
                deleted_at__isnull=True,
            ).all()
            users_with_same_username = await self._filter_users_with_active_tenant(
                users_with_same_username
            )

            tenant_ids = [
                u.tenant_id for u in users_with_same_username if u.tenant_id is not None
            ]
            if tenant_ids:
                tenants_queryset = await Tenant.filter(
                    id__in=tenant_ids, status=TenantStatus.ACTIVE
                ).all()
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
            elif final_tenant_id:
                tenant = await Tenant.get_or_none(
                    id=final_tenant_id, status=TenantStatus.ACTIVE
                )
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

        requires_tenant_selection = len(user_tenants_list) > 1

        tenant_name = None
        if final_tenant_id is not None:
            tenant = await Tenant.get_or_none(
                id=final_tenant_id, status=TenantStatus.ACTIVE
            )
            if not tenant:
                raise HTTPException(
                    status_code=status.HTTP_403_FORBIDDEN,
                    detail="所属组织不存在或已停用，无法登录",
                )
            tenant_name = tenant.name
            if not user_tenants_list and not is_infra_admin:
                user_tenants_list = [
                    {
                        "id": tenant.id,
                        "uuid": str(tenant.uuid),
                        "name": tenant.name,
                        "domain": tenant.domain,
                        "status": tenant.status.value,
                    }
                ]

        if final_tenant_id is not None and not tenant_name:
            raise HTTPException(
                status_code=status.HTTP_403_FORBIDDEN,
                detail="所属组织不存在或已停用，无法登录",
            )

        # 4. 获取权限和扩展信息
        from core.services.authorization.user_permission_service import UserPermissionService
        from core.services.authorization.permission_version_service import PermissionVersionService
        
        permissions: list[str] = []
        permission_version = 1
        await user.fetch_related("department", "position")
        
        if final_tenant_id is not None:
            permission_set = await UserPermissionService.get_user_permissions(
                user_id=user.id,
                tenant_id=final_tenant_id,
            )
            permissions = sorted(permission_set)
            permission_version = await PermissionVersionService.get_version(
                tenant_id=final_tenant_id,
                user_id=user.id,
            )
            
        from core.services.authorization.data_scope_service import DataScopeService

        department = {"uuid": str(user.department.uuid), "name": user.department.name} if user.department else None
        position = {"uuid": str(user.position.uuid), "name": user.position.name} if user.position else None
        roles = await DataScopeService.serialize_active_roles(user.id, final_tenant_id)
        
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
                "avatar": user.avatar,
                "tenant_id": final_tenant_id,
                "tenant_name": tenant_name,
                "is_infra_admin": user.is_infra_admin,
                "is_tenant_admin": user.is_tenant_admin,
                "permissions": permissions,
                "permission_version": permission_version,
                "department": department,
                "position": position,
                "roles": roles,
            },
            "tenants": user_tenants_list if user_tenants_list else None,
            "default_tenant_id": final_tenant_id,
            "requires_tenant_selection": requires_tenant_selection,
        }

        from datetime import datetime, timezone
        user.last_login = datetime.now(timezone.utc)
        await user.save(update_fields=["last_login", "updated_at"])

        # 5. 记录登录日志和活动
        if request:
            asyncio.create_task(self._log_login_attempt(
                tenant_id=final_tenant_id,
                user_id=user.id,
                username=user.username,
                login_status="success",
                failure_reason=None,
                request=request
            ))
            
            try:
                from core.services.interfaces.service_registry import ServiceLocator
                from datetime import datetime
                user_activity_service = ServiceLocator.get_service("user_activity_service")
                login_ip = request.client.host if request.client else None
                asyncio.create_task(
                    user_activity_service.update_user_activity(
                        tenant_id=final_tenant_id,
                        user_id=user.id,
                        login_ip=login_ip,
                        login_time=datetime.now(),
                    )
                )
            except Exception as e:
                logger.warning(f"更新用户活动时间失败: {e}")
        
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
        from infra.domain.security.security import get_token_payload_for_refresh
        
        # 验证 Token（允许短时过期后的静默续期，避免前端定时器与请求竞态导致误踢出）
        payload = get_token_payload_for_refresh(token)
        if not payload:
            raise HTTPException(
                status_code=status.HTTP_401_UNAUTHORIZED,
                detail="无效的 Token"
            )
        
        # 获取用户信息（排除已软删除的用户）
        user_id = int(payload.get("sub"))
        user = await User.get_or_none(id=user_id, deleted_at__isnull=True)
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
    
    async def guest_login(self, request: Request = None) -> dict:
        """
        免注册体验登录
        
        获取或创建默认组织和预设的体验账户，直接返回登录响应。
        体验账户只有浏览权限（只读权限），无新建、编辑、删除权限。
        
        Returns:
            dict: 包含 access_token、token_type、expires_in 和 user 信息的字典
            
        Raises:
            HTTPException: 当创建体验账户失败时抛出
        """
        from infra.services.platform_settings_service import PlatformSettingsService

        platform_settings = await PlatformSettingsService().get_or_create_default_settings()
        if platform_settings.login_guest_enabled is False:
            raise HTTPException(
                status_code=status.HTTP_403_FORBIDDEN,
                detail="免注册体验登录已关闭",
            )

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
                tenant_id=default_tenant.id,
                deleted_at__isnull=True
            )
            logger.info(f"体验账户查找结果: {guest_user.id if guest_user else 'None'}")

            if not guest_user:
                logger.info("体验账户不存在，开始创建...")
                # 如果体验账户不存在，创建它
                user_data = UserCreate(
                    username=guest_username,
                    phone="13800000000",  # 体验用户手机号
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

            await self._ensure_user_has_guest_role(guest_user.id, default_tenant.id)
            
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
            permission_set = await UserPermissionService.get_user_permissions(
                user_id=guest_user.id,
                tenant_id=default_tenant.id,
            )
            permission_version = await PermissionVersionService.get_version(
                tenant_id=default_tenant.id,
                user_id=guest_user.id,
            )
            from core.services.authorization.data_scope_service import DataScopeService

            await guest_user.fetch_related("department", "position")
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
                "permissions": sorted(permission_set),
                "permission_version": permission_version,
                "department": {"uuid": str(guest_user.department.uuid), "name": guest_user.department.name} if guest_user.department else None,
                "position": {"uuid": str(guest_user.position.uuid), "name": guest_user.position.name} if guest_user.position else None,
                "roles": await DataScopeService.serialize_active_roles(guest_user.id, default_tenant.id),
            }
            
            # 确保 default_tenant 不为 None（双重验证）
            if not default_tenant:
                raise ValueError("默认组织不存在或创建失败")
            
            result = {
                "access_token": access_token,
                "token_type": "bearer",
                "expires_in": expires_in,
                "user": user_info_dict,
                "tenants": None,  # 体验账户只有一个组织，不需要选择（与历史版本保持一致）
                "default_tenant_id": default_tenant.id,
                "requires_tenant_selection": False,
            }
            
            # 记录登录成功日志（异步执行，不阻塞响应）
            if request:
                asyncio.create_task(self._log_login_attempt(
                    tenant_id=default_tenant.id,
                    user_id=guest_user.id,
                    username=guest_user.username,
                    login_status="success",
                    failure_reason=None,
                    request=request
                ))
            
            return result
            
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
        
        # 获取用户（排除已软删除的用户）
        user = await User.get_or_none(id=user_id, deleted_at__isnull=True)
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
            from core.services.interfaces.service_registry import ServiceLocator, ServiceNotFoundError

            # 获取客户端真实IP地址（优先获取外网IP）
            # 优先级：X-Forwarded-For > X-Real-IP > request.client.host
            login_ip = None
            
            # 1. 优先从 X-Forwarded-For 获取（代理服务器转发，第一个IP通常是客户端真实IP）
            forwarded_for = request.headers.get("X-Forwarded-For")
            if forwarded_for:
                # X-Forwarded-For 可能包含多个 IP（代理链），格式：client, proxy1, proxy2
                # 取第一个 IP（客户端真实IP）
                login_ip = forwarded_for.split(",")[0].strip()
            
            # 2. 如果 X-Forwarded-For 不存在，从 X-Real-IP 获取（Nginx 等代理服务器）
            if not login_ip:
                real_ip = request.headers.get("X-Real-IP")
                if real_ip:
                    login_ip = real_ip.strip()
            
            # 3. 最后从 request.client.host 获取（直接连接，可能是内网IP）
            if not login_ip and request.client:
                login_ip = request.client.host
            
            # 4. 如果都没有，使用默认值
            if not login_ip:
                login_ip = "0.0.0.0"
            
            # 5. 如果是内网IP（127.0.0.1、localhost等），尝试获取本机公网IP
            # ⚠️ 注意：这仅用于开发环境，生产环境应该通过代理服务器获取真实客户端IP
            from core.utils.ip_parser import is_private_ip, get_public_ip
            if is_private_ip(login_ip) or login_ip in ["0.0.0.0", "localhost"]:
                try:
                    # 异步获取公网IP（不阻塞，超时时间短）
                    public_ip = await get_public_ip()
                    if public_ip:
                        logger.debug(f"检测到内网IP {login_ip}，获取到公网IP: {public_ip}")
                        login_ip = public_ip
                except Exception as e:
                    # 获取公网IP失败不影响登录流程，继续使用原IP
                    logger.debug(f"获取公网IP失败，继续使用原IP {login_ip}: {e}")

            # 获取用户代理
            user_agent = request.headers.get("User-Agent", "")
            
            # 解析IP地址和User-Agent信息（异步执行，不阻塞登录流程）
            # 包括：地理位置、浏览器、设备类型
            ip_info = {}
            try:
                from core.utils.ip_parser import parse_ip_info
                ip_info = await parse_ip_info(login_ip, user_agent)
            except Exception as e:
                # IP解析失败不影响登录流程，静默处理
                logger.debug(f"IP地址解析失败: {login_ip}, 错误: {e}")

            # 通过服务接口记录登录事件
            if not ServiceLocator.has_service("audit_log_service"):
                logger.warning("audit_log_service 未注册，跳过登录日志记录（请检查服务初始化顺序）")
            else:
                audit_log_service = ServiceLocator.get_service("audit_log_service")
                await audit_log_service.log_login_event(
                    tenant_id=tenant_id or 0,  # 登录失败时可能为空
                    user_id=user_id or 0,      # 登录失败时可能为空
                    username=username,
                    login_ip=login_ip,
                    user_agent=user_agent,
                    login_location=ip_info.get("location"),  # IP地理位置
                    login_device=ip_info.get("device"),  # 设备类型
                    login_browser=ip_info.get("browser"),  # 浏览器信息
                    success=(login_status == "success"),
                    failure_reason=failure_reason,
                )
                logger.debug(f"登录日志已记录: username={username}, tenant_id={tenant_id}, status={login_status}")
        except ServiceNotFoundError as e:
            logger.warning(f"audit_log_service 未找到，无法记录登录日志: {e}")
        except Exception as e:
            # 登录日志记录失败不影响登录流程，记录详细错误便于生产环境排查
            import traceback
            logger.warning(
                f"记录登录日志失败: {e}\n"
                f"username={username}, tenant_id={tenant_id}, status={login_status}\n"
                f"traceback: {traceback.format_exc()}"
            )
