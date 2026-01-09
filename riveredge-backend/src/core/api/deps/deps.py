"""
API 依赖模块

提供 API 路由所需的依赖注入函数，包括认证、权限检查、获取当前用户等。
复用 soil 模块的依赖函数，确保一致性。
"""

from typing import Optional
from fastapi import Depends, HTTPException, status, Header, Request

# 复用 soil 模块的依赖函数
from infra.api.deps.deps import (
    get_current_user as soil_get_current_user,
    oauth2_scheme,
)
from infra.models.user import User
from infra.domain.tenant_context import get_current_tenant_id as get_tenant_id_from_context, set_current_tenant_id
from infra.domain.security.infra_superadmin_security import get_infra_superadmin_token_payload


async def get_current_user(token: str = Depends(oauth2_scheme)) -> User:
    """
    获取当前登录用户

    复用 soil 模块的 get_current_user 函数。

    Args:
        token: JWT Token（从请求头 Authorization: Bearer <token> 中提取）

    Returns:
        User: 当前用户对象

    Raises:
        HTTPException: 当认证失败时抛出
    """
    return await soil_get_current_user(token)


async def get_current_tenant(
    request: Request,
    x_tenant_id: Optional[str] = Header(None, alias="X-Tenant-ID"),
    token: Optional[str] = Depends(oauth2_scheme)
) -> int:
    """
    获取当前组织ID
    
    从请求头或上下文中获取当前组织ID，并设置到上下文中。
    ⚠️ 关键修复：支持平台超级管理员 Token（允许全局访问，tenant_id 可为 None 或从请求头获取）

    Args:
        x_tenant_id: 从请求头获取的组织ID
        token: JWT Token（用于检查是否为平台超级管理员）
    
    Returns:
        int: 当前组织ID
        
    Raises:
        HTTPException: 当组织上下文未设置时抛出（平台超级管理员除外）
    """
    # 调试日志：检查请求头
    from loguru import logger
    all_headers = dict(request.headers)
    logger.debug(f"🔍 get_current_tenant 调试信息: x_tenant_id={x_tenant_id}, all_headers={all_headers}")
    
    # ⚠️ 关键修复：检查是否为平台超级管理员 Token
    is_infra_superadmin = False
    if token:
        infra_superadmin_payload = get_infra_superadmin_token_payload(token)
        if infra_superadmin_payload:
            is_infra_superadmin = True
    
    tenant_id = None

    # 优先从请求头获取
    if x_tenant_id:
        try:
            tenant_id = int(x_tenant_id)
        except ValueError:
            raise HTTPException(
                status_code=status.HTTP_400_BAD_REQUEST,
                detail="无效的组织ID"
            )

    # 如果请求头没有，则从上下文获取
    if tenant_id is None:
        tenant_id = get_tenant_id_from_context()

    # ⚠️ 关键修复：平台超级管理员允许 tenant_id 为 None（全局访问）
    if tenant_id is None:
        if is_infra_superadmin:
            # 平台超级管理员可以访问所有租户，如果没有指定 tenant_id，使用默认租户
            from infra.services.tenant_service import TenantService
            try:
                tenant_service = TenantService()
                default_tenant = await tenant_service.get_tenant_by_domain(
                    "default",
                    skip_tenant_filter=True
                )
                if default_tenant:
                    tenant_id = default_tenant.id
                    from loguru import logger
                    logger.info(f"✅ 平台超级管理员使用默认租户 ID: {tenant_id}")
                else:
                    # 如果没有默认租户，抛出错误要求指定 tenant_id
                    raise HTTPException(
                        status_code=status.HTTP_400_BAD_REQUEST,
                        detail="平台超级管理员访问租户资源时，请通过 X-Tenant-ID 请求头指定租户ID"
                    )
            except HTTPException:
                raise
            except Exception as e:
                from loguru import logger
                logger.warning(f"⚠️ 获取默认租户失败: {e}")
                raise HTTPException(
                    status_code=status.HTTP_400_BAD_REQUEST,
                    detail="平台超级管理员访问租户资源时，请通过 X-Tenant-ID 请求头指定租户ID"
                )
        else:
            # 普通用户必须有 tenant_id
            raise HTTPException(
                status_code=status.HTTP_400_BAD_REQUEST,
                detail="组织上下文未设置"
            )

    # 设置到上下文（确保后续操作都能获取到）
    set_current_tenant_id(tenant_id)

    return tenant_id


async def get_current_user_id(user: User = Depends(get_current_user)) -> Optional[int]:
    """
    获取当前用户ID
    
    Args:
        user: 当前用户对象（依赖注入）
    
    Returns:
        Optional[int]: 当前用户ID
    """
    return user.id if user else None

