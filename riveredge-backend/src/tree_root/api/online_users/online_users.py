"""
在线用户管理 API 路由

提供在线用户的查询和会话管理功能。
"""

from typing import Optional, List
from fastapi import APIRouter, Depends, HTTPException, status, Query

from tree_root.schemas.online_user import (
    OnlineUserResponse,
    OnlineUserListResponse,
    OnlineUserStatisticsResponse,
)
from tree_root.services.online_user_service import OnlineUserService
from tree_root.api.deps.deps import get_current_tenant
from soil.api.deps.deps import get_current_user
from soil.models.user import User
from soil.exceptions.exceptions import NotFoundError

router = APIRouter(prefix="/online-users", tags=["OnlineUsers"])


@router.get("", response_model=OnlineUserListResponse)
async def list_online_users(
    tenant_id: Optional[int] = Query(None, description="组织ID（可选，管理员可以查看其他组织）"),
    current_user: User = Depends(get_current_user),
    current_tenant_id: int = Depends(get_current_tenant),
):
    """
    获取在线用户列表
    
    Args:
        tenant_id: 组织ID（可选，管理员可以查看其他组织）
        current_user: 当前用户
        current_tenant_id: 当前组织ID
        
    Returns:
        OnlineUserListResponse: 在线用户列表
    """
    # 默认只查看当前组织的在线用户
    if tenant_id is None:
        tenant_id = current_tenant_id
    
    # TODO: 权限检查（只有管理员可以查看其他组织的在线用户）
    
    online_users = await OnlineUserService.list_online_users(tenant_id=tenant_id)
    
    return OnlineUserListResponse(
        items=online_users,
        total=len(online_users),
    )


@router.get("/{user_id}", response_model=OnlineUserResponse)
async def get_online_user_by_user_id(
    user_id: int,
    current_user: User = Depends(get_current_user),
    current_tenant_id: int = Depends(get_current_tenant),
):
    """
    根据用户ID获取在线用户信息
    
    Args:
        user_id: 用户ID
        current_user: 当前用户
        current_tenant_id: 当前组织ID
        
    Returns:
        OnlineUserResponse: 在线用户信息
        
    Raises:
        HTTPException: 当在线用户不存在时抛出
    """
    online_user = await OnlineUserService.get_online_user_by_user_id(
        tenant_id=current_tenant_id,
        user_id=user_id,
    )
    
    if not online_user:
        raise HTTPException(
            status_code=status.HTTP_404_NOT_FOUND,
            detail="用户不在线或不存在"
        )
    
    return online_user


@router.delete("/{user_id}", status_code=status.HTTP_204_NO_CONTENT)
async def force_logout(
    user_id: int,
    current_user: User = Depends(get_current_user),
    current_tenant_id: int = Depends(get_current_tenant),
):
    """
    强制用户下线
    
    Args:
        user_id: 用户ID
        current_user: 当前用户
        current_tenant_id: 当前组织ID
        
    Raises:
        HTTPException: 当强制下线失败时抛出
    """
    # TODO: 权限检查（只有管理员可以强制下线）
    
    success = await OnlineUserService.force_logout(
        tenant_id=current_tenant_id,
        user_id=user_id,
    )
    
    if not success:
        raise HTTPException(
            status_code=status.HTTP_500_INTERNAL_SERVER_ERROR,
            detail="强制下线失败"
        )


@router.get("/statistics", response_model=OnlineUserStatisticsResponse)
async def get_online_user_statistics(
    tenant_id: Optional[int] = Query(None, description="组织ID（可选）"),
    current_user: User = Depends(get_current_user),
    current_tenant_id: int = Depends(get_current_tenant),
):
    """
    获取在线用户统计
    
    Args:
        tenant_id: 组织ID（可选）
        current_user: 当前用户
        current_tenant_id: 当前组织ID
        
    Returns:
        OnlineUserStatisticsResponse: 在线用户统计信息
    """
    # 默认只统计当前组织的在线用户
    if tenant_id is None:
        tenant_id = current_tenant_id
    
    # TODO: 权限检查（只有管理员可以查看其他组织的统计）
    
    return await OnlineUserService.get_online_user_statistics(tenant_id=tenant_id)

