"""
API 依赖模块

提供 API 路由所需的依赖注入函数，包括认证、权限检查、获取当前用户等。
复用 soil 模块的依赖函数，确保一致性。
"""

from typing import Optional
from fastapi import Depends, HTTPException, status, Header

# 复用 soil 模块的依赖函数
from soil.api.deps.deps import (
    get_current_user as soil_get_current_user,
)
from soil.models.user import User
from soil.core.tenant_context import get_current_tenant_id as get_tenant_id_from_context, set_current_tenant_id


async def get_current_user() -> User:
    """
    获取当前登录用户
    
    复用 soil 模块的 get_current_user 函数。
    
    Returns:
        User: 当前用户对象
        
    Raises:
        HTTPException: 当认证失败时抛出
    """
    return await soil_get_current_user()


async def get_current_tenant(x_tenant_id: Optional[str] = Header(None, alias="X-Tenant-ID")) -> int:
    """
    获取当前组织ID
    
    从请求头或上下文中获取当前组织ID，并设置到上下文中。

    Args:
        x_tenant_id: 从请求头获取的组织ID
    
    Returns:
        int: 当前组织ID
        
    Raises:
        HTTPException: 当组织上下文未设置时抛出
    """
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

    if tenant_id is None:
        raise HTTPException(
            status_code=status.HTTP_400_BAD_REQUEST,
            detail="组织上下文未设置"
        )

    # 设置到上下文（确保后续操作都能获取到）
    set_current_tenant_id(tenant_id)

    return tenant_id

