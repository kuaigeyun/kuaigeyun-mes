"""
API 依赖模块

定义 API 路由的依赖注入函数，如认证、权限检查等
"""

from typing import Optional
from fastapi import Depends, HTTPException, status
from fastapi.security import OAuth2PasswordBearer

from infra.models.user import User
from infra.models.infra_superadmin import InfraSuperAdmin
from infra.domain.security.security import get_token_payload
# 注意：SuperAdmin安全模块已移除
from infra.domain.security.infra_superadmin_security import (
    get_infra_superadmin_token_payload
)
from infra.domain.tenant_context import set_current_tenant_id
from infra.services.auth_service import AuthService

# OAuth2 密码流（用于从请求头获取 Token）
oauth2_scheme = OAuth2PasswordBearer(tokenUrl="/api/v1/auth/login", auto_error=False)

# 注意：SuperAdmin Auth已移除，使用Platform Admin Auth替代

# 平台超级管理员 OAuth2 密码流（用于从请求头获取平台超级管理员 Token）
infra_superadmin_oauth2_scheme = OAuth2PasswordBearer(
    tokenUrl="/api/v1/infra/auth/login",  # 对应 infra/ 文件夹
    auto_error=False  # ⚠️ 改回 False，允许可选认证
)


async def get_current_user(
    token: str = Depends(oauth2_scheme)
) -> User:
    """
    获取当前用户依赖
    
    从请求头中提取 JWT Token，验证并返回当前用户对象。
    自动设置组织上下文。
    ⚠️ 关键修复：支持平台超级管理员 Token（全局生效）
    
    Args:
        token: JWT Token（从请求头 Authorization: Bearer <token> 中提取）
        
    Returns:
        User: 当前用户对象
        
    Raises:
        HTTPException: 当 Token 无效、用户不存在或用户未激活时抛出
        
    Example:
        ```python
        @router.get("/protected")
        async def protected_route(current_user: User = Depends(get_current_user)):
            return {"user_id": current_user.id}
        ```
    """
    # 检查 Token 是否存在
    if not token:
        raise HTTPException(
            status_code=status.HTTP_401_UNAUTHORIZED,
            detail="Token缺失",
            headers={"WWW-Authenticate": "Bearer"},
        )

    # ⚠️ 关键修复：先尝试验证平台超级管理员 Token
    infra_superadmin_payload = get_infra_superadmin_token_payload(token)
    if infra_superadmin_payload:
        # 这是平台超级管理员 Token，允许全局访问
        # 创建一个虚拟的 User 对象，标记为平台超级管理员
        from loguru import logger
        logger.info(f"✅ 检测到平台超级管理员 Token，允许全局访问")
        
        # 获取平台超级管理员 ID
        admin_id = int(infra_superadmin_payload.get("sub"))
        admin = await InfraSuperAdmin.get_or_none(id=admin_id)
        if not admin:
            raise HTTPException(
                status_code=status.HTTP_401_UNAUTHORIZED,
                detail="平台超级管理员不存在",
                headers={"WWW-Authenticate": "Bearer"},
            )
        
        if not admin.is_active:
            raise HTTPException(
                status_code=status.HTTP_403_FORBIDDEN,
                detail="平台超级管理员未激活",
            )
        
        # ⚠️ 关键：为平台超级管理员创建一个虚拟 User 对象
        # 这个 User 对象用于兼容现有代码，但标记为平台超级管理员
        # 注意：这里不设置 tenant_id，允许全局访问
        # 使用 User 模型的构造函数创建临时对象（不保存到数据库）
        virtual_user = User()
        # 使用 setattr 确保属性正确设置（Tortoise ORM 模型需要）
        setattr(virtual_user, 'id', admin_id)
        setattr(virtual_user, 'username', admin.username)
        setattr(virtual_user, 'email', getattr(admin, 'email', None))
        setattr(virtual_user, 'is_active', True)
        setattr(virtual_user, 'tenant_id', None)  # 平台超级管理员不属于任何租户
        setattr(virtual_user, 'password_hash', "")  # 虚拟用户不需要密码
        setattr(virtual_user, 'full_name', getattr(admin, 'full_name', admin.username))
        # 设置一个标记，表示这是平台超级管理员
        setattr(virtual_user, '_is_infra_superadmin', True)
        setattr(virtual_user, '_infra_superadmin_id', admin_id)
        
        # 确保 id 属性可以直接访问
        if not hasattr(virtual_user, 'id') or virtual_user.id is None:
            virtual_user.id = admin_id
        
        return virtual_user

    # 验证普通用户 Token
    payload = get_token_payload(token)
    if not payload:
        raise HTTPException(
            status_code=status.HTTP_401_UNAUTHORIZED,
            detail="无效的 Token",
            headers={"WWW-Authenticate": "Bearer"},
        )
    
    # 获取用户 ID 和组织 ID
    user_id = int(payload.get("sub"))
    tenant_id = payload.get("tenant_id")  # ⭐ 关键：从 Token 中获取组织 ID
    
    # 设置组织上下文 ⭐ 关键：自动设置组织上下文
    if tenant_id:
        set_current_tenant_id(tenant_id)
    
    # 获取用户
    user = await User.get_or_none(id=user_id)
    if not user:
        raise HTTPException(
            status_code=status.HTTP_401_UNAUTHORIZED,
            detail="用户不存在",
            headers={"WWW-Authenticate": "Bearer"},
        )
    
    if not user.is_active:
        raise HTTPException(
            status_code=status.HTTP_403_FORBIDDEN,
            detail="用户未激活",
        )
    
    return user


async def get_current_active_user(
    current_user: User = Depends(get_current_user)
) -> User:
    """
    获取当前活跃用户依赖
    
    获取当前用户并确保用户处于活跃状态。
    这是 get_current_user 的包装，提供额外的活跃状态检查。
    
    Args:
        current_user: 当前用户（从 get_current_user 依赖获取）
        
    Returns:
        User: 当前活跃用户对象
        
    Raises:
        HTTPException: 当用户未激活时抛出（已在 get_current_user 中检查）
        
    Example:
        ```python
        @router.get("/active-only")
        async def active_only_route(
            current_user: User = Depends(get_current_active_user)
        ):
            return {"user_id": current_user.id}
        ```
    """
    # get_current_user 已经检查了 is_active，这里直接返回
    return current_user


# 注意：get_current_superadmin 函数已移除，使用 get_current_infra_superadmin 替代

async def get_current_infra_superadmin(
    token: Optional[str] = Depends(infra_superadmin_oauth2_scheme)
) -> InfraSuperAdmin:
    """
    获取当前平台超级管理员依赖
    
    从请求头中提取平台超级管理员 JWT Token，验证并返回当前平台超级管理员对象。
    平台超级管理员是平台唯一的，独立于租户系统。
    
    Args:
        token: JWT Token（从请求头 Authorization: Bearer <token> 中提取）
        
    Returns:
        InfraSuperAdmin: 当前平台超级管理员对象
        
    Raises:
        HTTPException: 当 Token 无效、平台超级管理员不存在或未激活时抛出
        
    Example:
        ```python
        @router.get("/platform-superadmin/protected")
        async def protected_route(
            current_admin: InfraSuperAdmin = Depends(get_current_infra_superadmin)
        ):
            return {"admin_id": current_admin.id}
        ```
    """
    # 验证平台超级管理员 Token
    from loguru import logger
    logger.info(f"🔍 [get_current_infra_superadmin] 开始验证平台超级管理员 Token，Token 类型: {type(token)}, Token 长度: {len(token) if token else 0}")
    
    # ⚠️ 关键修复：处理 token 为 None 的情况（当 auto_error=False 且没有 Token 时）
    if not token:
        logger.warning(f"❌ [get_current_infra_superadmin] Token 为空或 None")
        raise HTTPException(
            status_code=status.HTTP_401_UNAUTHORIZED,
            detail="未提供 Token",
            headers={"WWW-Authenticate": "Bearer"},
        )
    
    payload = get_infra_superadmin_token_payload(token)
    if not payload:
        logger.warning(f"❌ [get_current_infra_superadmin] 平台超级管理员 Token 验证失败，Token 前10个字符: {token[:10] if token else 'None'}")
        raise HTTPException(
            status_code=status.HTTP_401_UNAUTHORIZED,
            detail="无效的 Token（平台超级管理员）",
            headers={"WWW-Authenticate": "Bearer"},
        )
    logger.info(f"✅ [get_current_infra_superadmin] 平台超级管理员 Token 验证成功，admin_id: {payload.get('sub')}")
    
    # 获取平台超级管理员 ID
    admin_id = int(payload.get("sub"))
    
    # 获取平台超级管理员
    admin = await InfraSuperAdmin.get_or_none(id=admin_id)
    if not admin:
        raise HTTPException(
            status_code=status.HTTP_401_UNAUTHORIZED,
            detail="平台超级管理员不存在",
            headers={"WWW-Authenticate": "Bearer"},
        )
    
    # 检查是否激活
    if not admin.is_active:
        raise HTTPException(
            status_code=status.HTTP_403_FORBIDDEN,
            detail="平台超级管理员未激活"
        )
    
    return admin


def require_permissions(*permission_codes: str):
    """
    权限验证装饰器（占位）
    
    用于验证用户是否具有指定的权限。
    带组织过滤：只检查当前组织内的权限。
    
    Args:
        *permission_codes: 权限代码列表（格式：resource:action）
        
    Returns:
        Callable: 依赖函数
        
    Note:
        此功能将在权限服务实现后完善。
        
    Example:
        ```python
        @router.post("/users")
        @require_permissions("user:create")
        async def create_user(...):
            ...
        ```
    """
    # TODO: 实现权限验证逻辑
    # 1. 从 Token 中获取用户和组织信息
    # 2. 查询用户的角色和权限（自动过滤组织）
    # 3. 检查是否具有指定权限
    # 4. 如果没有权限，抛出 403 错误
    
    def dependency(current_user: User = Depends(get_current_user)):
        # 占位实现
        return current_user
    
    return dependency
