"""
API 依赖模块

定义 API 路由的依赖注入函数，如认证、权限检查等
"""

from typing import Optional
from fastapi import Depends, HTTPException, status
from fastapi.security import OAuth2PasswordBearer

from models.user import User
from core.security import get_token_payload
from core.superadmin_security import get_superadmin_token_payload
from core.tenant_context import set_current_tenant_id
from services.auth_service import AuthService

# OAuth2 密码流（用于从请求头获取 Token）
oauth2_scheme = OAuth2PasswordBearer(tokenUrl="/api/v1/auth/login")

# 超级管理员 OAuth2 密码流（用于从请求头获取超级管理员 Token）
superadmin_oauth2_scheme = OAuth2PasswordBearer(tokenUrl="/api/v1/superadmin/auth/login")


async def get_current_user(
    token: str = Depends(oauth2_scheme)
) -> User:
    """
    获取当前用户依赖
    
    从请求头中提取 JWT Token，验证并返回当前用户对象。
    自动设置租户上下文。
    
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
    # 验证 Token
    payload = get_token_payload(token)
    if not payload:
        raise HTTPException(
            status_code=status.HTTP_401_UNAUTHORIZED,
            detail="无效的 Token",
            headers={"WWW-Authenticate": "Bearer"},
        )
    
    # 获取用户 ID 和租户 ID
    user_id = int(payload.get("sub"))
    tenant_id = payload.get("tenant_id")  # ⭐ 关键：从 Token 中获取租户 ID
    
    # 设置租户上下文 ⭐ 关键：自动设置租户上下文
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


async def get_current_superadmin(
    token: str = Depends(superadmin_oauth2_scheme)
) -> User:
    """
    获取当前系统级超级管理员依赖
    
    从请求头中提取系统级超级管理员 JWT Token，验证并返回当前系统级超级管理员用户对象。
    注意：系统级超级管理员使用 User 模型（is_superuser=True 且 tenant_id=None）。
    
    Args:
        token: JWT Token（从请求头 Authorization: Bearer <token> 中提取）
        
    Returns:
        User: 当前系统级超级管理员用户对象（is_superuser=True 且 tenant_id=None）
        
    Raises:
        HTTPException: 当 Token 无效、用户不存在、不是系统级超级管理员或未激活时抛出
        
    Example:
        ```python
        @router.get("/superadmin/protected")
        async def protected_route(
            current_admin: User = Depends(get_current_superadmin)
        ):
            return {"admin_id": current_admin.id}
        ```
    """
    # 验证系统级超级管理员 Token
    payload = get_superadmin_token_payload(token)
    if not payload:
        raise HTTPException(
            status_code=status.HTTP_401_UNAUTHORIZED,
            detail="无效的 Token 或不是系统级超级管理员 Token",
            headers={"WWW-Authenticate": "Bearer"},
        )
    
    # 获取用户 ID
    user_id = int(payload.get("sub"))
    
    # 获取系统级超级管理员（is_superuser=True 且 tenant_id=None）
    user = await User.get_or_none(
        id=user_id,
        is_superuser=True,
        tenant_id__isnull=True
    )
    if not user:
        raise HTTPException(
            status_code=status.HTTP_401_UNAUTHORIZED,
            detail="系统级超级管理员不存在",
            headers={"WWW-Authenticate": "Bearer"},
        )
    
    if not user.is_active:
        raise HTTPException(
            status_code=status.HTTP_403_FORBIDDEN,
            detail="系统级超级管理员未激活",
        )
    
    return user


def require_permissions(*permission_codes: str):
    """
    权限验证装饰器（占位）
    
    用于验证用户是否具有指定的权限。
    带租户过滤：只检查当前租户内的权限。
    
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
    # 1. 从 Token 中获取用户和租户信息
    # 2. 查询用户的角色和权限（自动过滤租户）
    # 3. 检查是否具有指定权限
    # 4. 如果没有权限，抛出 403 错误
    
    def dependency(current_user: User = Depends(get_current_user)):
        # 占位实现
        return current_user
    
    return dependency
