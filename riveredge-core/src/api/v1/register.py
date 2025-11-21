"""
注册 API 模块

提供个人注册和组织注册的 RESTful API 接口
"""

import random
import string
import re
from fastapi import APIRouter, HTTPException, status, Query
from loguru import logger
from typing import Optional

from schemas.tenant import TenantCreate
from schemas.auth import OrganizationRegisterRequest, RegisterResponse, PersonalRegisterRequest, TenantJoinRequest
from schemas.user import UserCreate
from services.tenant_service import TenantService
from services.auth_service import AuthService
from services.user_service import UserService
from models.tenant import TenantStatus, TenantPlan
from models.user import User

# 创建路由
router = APIRouter(prefix="/register", tags=["Register"])


@router.post("/personal", response_model=RegisterResponse, status_code=201)
async def register_personal(data: PersonalRegisterRequest):
    """
    个人注册接口
    
    在指定组织或默认组织中创建用户。
    如果提供了 tenant_id，则在指定组织中创建用户；否则在默认组织中创建用户。
    如果默认组织不存在，会自动创建。
    
    注意：在组织中注册账户的，需要由组织管理员决定是否需要审核。
    如果组织管理员设置了审核要求，注册后需要等待审核通过后才能使用。
    
    Args:
        data: 用户注册请求数据（username, email（可选）, password, full_name（可选）, tenant_id（可选））
        
    Returns:
        RegisterResponse: 注册成功的响应数据
        
    Raises:
        HTTPException: 当用户名已存在、组织不存在或组织未激活时抛出
        
    Example:
        >>> response = await register_personal(
        ...     PersonalRegisterRequest(
        ...         username="testuser",
        ...         email="test@example.com",  # 可选
        ...         password="password123",
        ...         full_name="测试用户",  # 可选
        ...         tenant_id=1  # 可选，如果提供则在指定组织中创建用户
        ...     )
        ... )
    """
    tenant_service = TenantService()
    auth_service = AuthService()
    user_service = UserService()
    
    try:
        target_tenant = None
        use_invite_code = False  # 是否使用邀请码注册
        
        # 0. 如果只提供了 invite_code 但没有 tenant_id，提示错误
        if data.invite_code and data.tenant_id is None:
            raise HTTPException(
                status_code=status.HTTP_400_BAD_REQUEST,
                detail="使用邀请码注册时，必须同时提供组织ID"
            )
        
        # 1. 如果提供了 tenant_id，使用指定组织
        if data.tenant_id is not None:
            target_tenant = await tenant_service.get_tenant_by_id(
                data.tenant_id,
                skip_tenant_filter=True
            )
            if not target_tenant:
                raise HTTPException(
                    status_code=status.HTTP_404_NOT_FOUND,
                    detail=f"组织 ID {data.tenant_id} 不存在"
                )
            
            # 检查组织是否激活
            if target_tenant.status != TenantStatus.ACTIVE:
                raise HTTPException(
                    status_code=status.HTTP_400_BAD_REQUEST,
                    detail="指定组织未激活，无法注册"
                )
            
            # 2. 如果同时提供了 tenant_id 和 invite_code，验证邀请码
            if data.invite_code:
                # 从组织 settings 中获取邀请码
                tenant_invite_code = target_tenant.settings.get("invite_code") if target_tenant.settings else None
                
                if tenant_invite_code and tenant_invite_code == data.invite_code:
                    # 邀请码验证通过，直接注册成功，无需审核
                    use_invite_code = True
                    logger.info(f"邀请码验证通过: 组织 {target_tenant.name} (ID: {target_tenant.id})")
                else:
                    raise HTTPException(
                        status_code=status.HTTP_400_BAD_REQUEST,
                        detail="邀请码无效或已过期"
                    )
            
            logger.info(f"使用指定组织: {target_tenant.name} (ID: {target_tenant.id})")
        else:
            
            # 2. 如果没有提供 tenant_id，获取或创建默认组织（domain="default"）
            target_tenant = await tenant_service.get_tenant_by_domain(
                "default",
                skip_tenant_filter=True
            )
            
            if not target_tenant:
                # 如果默认组织不存在，创建它
                logger.info("默认组织不存在，正在创建...")
                default_tenant_data = TenantCreate(
                    name="默认组织",
                    domain="default",
                    status=TenantStatus.ACTIVE,  # 默认组织直接激活
                    plan=TenantPlan.ENTERPRISE,  # 默认组织使用企业套餐（允许更多用户和存储）
                    settings={
                        "description": "系统默认组织，用于个人注册",
                        "is_default": True,
                    },
                    # max_users 和 max_storage 不指定，由套餐配置自动设置（企业套餐：1000用户，100GB存储）
                    expires_at=None,  # 默认组织永不过期
                )
                target_tenant = await tenant_service.create_tenant(default_tenant_data)
                await tenant_service.initialize_tenant_data(target_tenant.id)
                logger.info(f"默认组织创建成功: {target_tenant.name} (ID: {target_tenant.id})")
        
        # 3. 检查组织内用户名是否已存在
        existing_user = await User.get_or_none(
            username=data.username,
            tenant_id=target_tenant.id
        )
        if existing_user:
            raise HTTPException(
                status_code=status.HTTP_400_BAD_REQUEST,
                detail=f"用户名 {data.username} 已被使用"
            )
        
        # 4. 在组织中创建用户
        # 如果使用邀请码，直接激活；否则可能需要审核（由组织管理员决定）
        user_data = UserCreate(
            username=data.username,
            email=data.email if data.email else None,
            password=data.password,
            full_name=data.full_name,
            tenant_id=target_tenant.id,
            is_active=True if use_invite_code else True,  # 邀请码注册直接激活，个人注册也直接激活
            is_platform_admin=False,
            is_tenant_admin=False,
            source="invite_code" if use_invite_code else "personal",  # 标记用户来源
        )
        
        user = await user_service.create_user(user_data, tenant_id=target_tenant.id)
        source_text = "邀请码" if use_invite_code else "个人"
        logger.info(f"{source_text}注册用户创建成功: {user.username} (ID: {user.id}, Tenant ID: {target_tenant.id}, Source: {user_data.source})")
        
        # 5. 返回注册响应
        message_text = "注册成功，已自动登录"
        if use_invite_code:
            message_text = "邀请码注册成功，已自动登录"
        
        return RegisterResponse(
            id=user.id,
            username=user.username,
            email=user.email if user.email else None,
            message=message_text
        )
        
    except HTTPException:
        raise
    except Exception as e:
        logger.error(f"个人注册失败: {e}")
        raise HTTPException(
            status_code=status.HTTP_500_INTERNAL_SERVER_ERROR,
            detail=f"个人注册失败: {str(e)}"
        )


@router.get("/check-tenant")
async def check_tenant_exists(domain: str = Query(..., description="组织域名")):
    """
    检查组织是否存在
    
    用于前端在注册时检查组织域名是否已被使用。
    如果组织存在，返回组织信息，前端可以显示"申请加入组织"选项。
    
    Args:
        domain: 组织域名
        
    Returns:
        dict: 如果组织存在，返回组织信息；如果不存在，返回 None
    """
    tenant_service = TenantService()
    
    existing_tenant = await tenant_service.get_tenant_by_domain(
        domain,
        skip_tenant_filter=True
    )
    
    if existing_tenant:
        return {
            "exists": True,
            "tenant_id": existing_tenant.id,
            "tenant_name": existing_tenant.name,
            "tenant_domain": existing_tenant.domain,
            "tenant_status": existing_tenant.status.value,
        }
    else:
        return {
            "exists": False,
        }


@router.post("/join", response_model=RegisterResponse, status_code=201)
async def join_tenant(data: TenantJoinRequest):
    """
    申请加入组织
    
    在已存在的组织中创建用户账户，需要组织管理员审核后才能使用。
    
    Args:
        data: 申请加入组织的请求数据（包含组织ID、用户名、邮箱、密码等）
        
    Returns:
        RegisterResponse: 注册响应（包含用户信息）
        
    Raises:
        HTTPException: 当组织不存在、组织未激活、用户名已存在时抛出
    """
    tenant_service = TenantService()
    user_service = UserService()
    
    try:
        # 1. 检查组织是否存在
        tenant = await tenant_service.get_tenant_by_id(
            data.tenant_id,
            skip_tenant_filter=True
        )
        if not tenant:
            raise HTTPException(
                status_code=status.HTTP_404_NOT_FOUND,
                detail="组织不存在"
            )
        
        # 2. 检查组织是否激活
        if tenant.status != TenantStatus.ACTIVE:
            raise HTTPException(
                status_code=status.HTTP_400_BAD_REQUEST,
                detail="组织未激活，无法申请加入"
            )
        
        # 3. 检查组织内用户名是否已存在
        existing_user = await User.get_or_none(
            username=data.username,
            tenant_id=tenant.id
        )
        if existing_user:
            raise HTTPException(
                status_code=status.HTTP_400_BAD_REQUEST,
                detail=f"用户名 {data.username} 已被使用"
            )
        
        # 4. 创建用户（状态为未激活，需要组织管理员审核）
        user_data = UserCreate(
            username=data.username,
            email=data.email if data.email else None,
            password=data.password,
            full_name=data.full_name,
            tenant_id=tenant.id,
            is_active=False,  # 申请加入的用户需要审核后才能激活
            is_platform_admin=False,
            is_tenant_admin=False,  # 申请加入的用户不是组织管理员
        )
        
        user = await user_service.create_user(user_data, tenant_id=tenant.id)
        logger.info(f"用户申请加入组织成功: {user.username} (ID: {user.id}, Tenant ID: {tenant.id})")
        
        # 5. 返回注册响应
        return RegisterResponse(
            id=user.id,
            username=user.username,
            email=user.email if user.email else None,
            message="申请提交成功，等待组织管理员审核"
        )
        
    except HTTPException:
        raise
    except Exception as e:
        logger.error(f"申请加入组织失败: {e}")
        raise HTTPException(
            status_code=status.HTTP_500_INTERNAL_SERVER_ERROR,
            detail=f"申请失败: {str(e)}"
        )


@router.post("/organization", response_model=RegisterResponse, status_code=201)
async def register_organization(data: OrganizationRegisterRequest):
    """
    组织注册
    
    创建新组织并自动创建组织管理员用户。
    注册成功后，组织状态为 INACTIVE，需要超级管理员审核后才能激活。
    
    Args:
        data: 注册请求数据（包含组织信息和管理员信息）
        
    Returns:
        RegisterResponse: 注册响应（包含用户信息）
        
    Raises:
        HTTPException: 当域名已存在、用户名已存在或邮箱已存在时抛出
        
    Example:
        >>> response = await register_organization(
        ...     OrganizationRegisterRequest(
        ...         tenant_name="测试组织",
        ...         tenant_domain="test",
        ...         username="admin",
        ...         email="admin@test.com",  # 可选
        ...         password="password123",
        ...         full_name="管理员"
        ...     )
        ... )
    """
    tenant_service = TenantService()
    auth_service = AuthService()
    user_service = UserService()
    
    try:
        # 1. 处理组织域名：如果为空，则生成8位随机域名
        tenant_domain = data.tenant_domain
        if not tenant_domain or tenant_domain.strip() == "":
            # 生成8位字母+数字组合的随机域名
            max_attempts = 10  # 最多尝试10次，避免无限循环
            for attempt in range(max_attempts):
                # 生成8位随机字符串（字母+数字）
                random_domain = ''.join(random.choices(string.ascii_lowercase + string.digits, k=8))
                
                # 检查域名是否已存在
                existing_tenant = await tenant_service.get_tenant_by_domain(
                    random_domain,
                    skip_tenant_filter=True
                )
                
                if not existing_tenant:
                    tenant_domain = random_domain
                    logger.info(f"自动生成组织域名: {tenant_domain}")
                    break
            else:
                # 如果10次都失败，抛出异常
                raise HTTPException(
                    status_code=status.HTTP_500_INTERNAL_SERVER_ERROR,
                    detail="无法生成唯一域名，请稍后重试或手动输入域名"
                )
        else:
            # 如果提供了域名，先验证域名格式
            domain_pattern = re.compile(r'^[a-z0-9-]+$')
            if not domain_pattern.match(tenant_domain):
                raise HTTPException(
                    status_code=status.HTTP_400_BAD_REQUEST,
                    detail="域名格式不正确，只能包含小写字母、数字和连字符"
                )
            
            # 检查域名长度
            if len(tenant_domain) < 1 or len(tenant_domain) > 100:
                raise HTTPException(
                    status_code=status.HTTP_400_BAD_REQUEST,
                    detail="域名长度必须在 1-100 字符之间"
                )
            
            # 检查是否已存在
            existing_tenant = await tenant_service.get_tenant_by_domain(
                tenant_domain,
                skip_tenant_filter=True
            )
            if existing_tenant:
                # 如果组织已存在，返回特殊错误码，让前端显示"申请加入组织"选项
                raise HTTPException(
                    status_code=status.HTTP_409_CONFLICT,  # 使用 409 Conflict 状态码
                    detail={
                        "error": "tenant_exists",
                        "message": f"域名 {tenant_domain} 已被使用",
                        "tenant_id": existing_tenant.id,
                        "tenant_name": existing_tenant.name,
                        "tenant_status": existing_tenant.status.value,
                    }
                )
        
        # 2. 创建组织（状态为 INACTIVE，需要审核）
        tenant_data = TenantCreate(
            name=data.tenant_name,
            domain=tenant_domain,
            status=TenantStatus.INACTIVE,  # 注册时默认为未激活状态，需要审核
            plan=TenantPlan.TRIAL,  # 注册时默认为体验套餐
            settings={
                "description": f"组织 {data.tenant_name} 的配置",
                "registered_by": data.username,  # 记录注册者
                "auto_generated_domain": not data.tenant_domain or data.tenant_domain.strip() == "",  # 记录是否自动生成
            },
            # max_users 和 max_storage 不指定，由套餐配置自动设置
            expires_at=None,  # 默认永不过期
        )
        
        tenant = await tenant_service.create_tenant(tenant_data)
        logger.info(f"组织创建成功: {tenant.name} (ID: {tenant.id}, Domain: {tenant.domain})")
        
        # 3. 初始化组织数据（创建默认角色、权限等）
        await tenant_service.initialize_tenant_data(tenant.id)
        logger.info(f"组织数据初始化完成: {tenant.id}")
        
        # 4. 创建组织管理员用户
        user_data = UserCreate(
            username=data.username,
            email=data.email if data.email else None,  # 邮箱可选
            password=data.password,
            full_name=data.full_name,
            tenant_id=tenant.id,  # 关联到新创建的组织
            is_active=True,
            is_platform_admin=False,
            is_tenant_admin=True,  # 设置为组织管理员
            source="organization",  # 标记用户来源为组织注册
        )
        
        user = await user_service.create_user(user_data, tenant_id=tenant.id)
        logger.info(f"组织管理员创建成功: {user.username} (ID: {user.id}, Tenant ID: {tenant.id})")
        
        # 5. 返回注册响应（包含组织域名）
        return RegisterResponse(
            id=user.id,
            username=user.username,
            email=user.email if user.email else None,
            tenant_domain=f"riveredge.cn/{tenant.domain}",  # 返回完整域名格式
            message="注册成功，等待管理员审核"
        )
        
    except HTTPException:
        raise
    except Exception as e:
        logger.error(f"组织注册失败: {e}")
        raise HTTPException(
            status_code=status.HTTP_500_INTERNAL_SERVER_ERROR,
            detail=f"组织注册失败: {str(e)}"
        )

