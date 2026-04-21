"""
在线用户管理 API 路由

提供在线用户的查询和会话管理功能。
"""

from typing import Optional, Dict, Any
from fastapi import APIRouter, Depends, HTTPException, status, Query

from core.schemas.online_user import (
    OnlineUserResponse,
    OnlineUserListResponse,
    OnlineUserStatisticsResponse,
)
from core.services.logging.online_user_service import OnlineUserService
from core.api.deps.deps import get_current_tenant
from infra.api.deps.deps import get_current_user
from infra.models.user import User
from infra.exceptions.exceptions import NotFoundError
from core.models.user_activity import UserActivity
from loguru import logger

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
    if tenant_id is None:
        tenant_id = current_tenant_id

    online_users = await OnlineUserService.list_online_users(tenant_id=tenant_id)
    
    return OnlineUserListResponse(
        items=online_users,
        total=len(online_users),
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
    if tenant_id is None:
        tenant_id = current_tenant_id

    return await OnlineUserService.get_online_user_statistics(tenant_id=tenant_id)


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


@router.post("/debug/test-write", response_model=Dict[str, Any])
async def debug_test_write(
    current_user: User = Depends(get_current_user),
    current_tenant_id: int = Depends(get_current_tenant),
):
    """
    调试端点：测试写入用户活动数据
    
    用于排查在线用户功能问题，直接测试数据写入。
    
    Returns:
        Dict[str, Any]: 写入测试结果
    """
    try:
        # 直接调用更新用户活动
        await OnlineUserService.update_user_activity(
            tenant_id=current_tenant_id,
            user_id=current_user.id,
            login_ip="127.0.0.1",
        )
        
        activity = await UserActivity.filter(
            tenant_id=current_tenant_id,
            user_id=current_user.id,
        ).first()
        
        result = {
            "success": True,
            "message": "数据写入成功",
            "key": f"user_activity:{current_tenant_id}:{current_user.id}",
            "key_exists": activity is not None,
            "value": {
                "last_activity_time": activity.last_activity_time.isoformat() if activity else None,
                "login_ip": activity.login_ip if activity else None,
                "login_time": activity.login_time.isoformat() if activity and activity.login_time else None,
            } if activity else None,
        }
        
        return result
    except Exception as e:
        logger.error(f"测试写入失败: {e}", exc_info=True)
        return {
            "success": False,
            "error": str(e),
            "message": "数据写入失败",
        }


@router.get("/debug/activity-status", response_model=Dict[str, Any])
async def debug_activity_status(
    current_user: User = Depends(get_current_user),
    current_tenant_id: int = Depends(get_current_tenant),
):
    """
    调试端点：检查用户活动存储状态（PostgreSQL 后端）。
    """
    try:
        payload: Dict[str, Any] = {
            "storage": "postgresql",
            "current_user": {
                "user_id": current_user.id,
                "username": current_user.username,
                "tenant_id": current_tenant_id,
            },
            "expected_key": f"user_activity:{current_tenant_id}:{current_user.id}",
            "key_exists": False,
            "key_value": None,
            "all_activity_records": [],
        }

        current = await UserActivity.filter(
            tenant_id=current_tenant_id,
            user_id=current_user.id,
        ).first()
        payload["key_exists"] = current is not None
        if current:
            payload["key_value"] = {
                "last_activity_time": current.last_activity_time.isoformat(),
                "login_ip": current.login_ip,
                "login_time": current.login_time.isoformat() if current.login_time else None,
            }

        rows = await UserActivity.all().order_by("-last_activity_time").limit(20)
        payload["all_activity_records"] = [
            {"tenant_id": r.tenant_id, "user_id": r.user_id, "last_activity_time": r.last_activity_time.isoformat()}
            for r in rows
        ]
        return payload
    except Exception as e:
        logger.error(f"获取活动状态失败: {e}", exc_info=True)
        raise HTTPException(
            status_code=status.HTTP_500_INTERNAL_SERVER_ERROR,
            detail=f"获取活动状态失败: {e}",
        )

