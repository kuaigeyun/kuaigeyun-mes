"""
在线用户管理 API 路由

提供在线用户的查询和会话管理功能。
"""

from typing import Optional, List, Dict, Any
from fastapi import APIRouter, Depends, HTTPException, status, Query
import json

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
from infra.infrastructure.cache.cache import cache
from infra.config.infra_config import infra_settings
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
    # 默认只查看当前组织的在线用户
    if tenant_id is None:
        tenant_id = current_tenant_id
    
    # TODO: 权限检查（只有管理员可以查看其他组织的在线用户）
    
    # 确保当前用户的活动时间已更新（因为用户正在访问此页面，说明他们在线）
    # 这样可以避免中间件更新延迟导致的问题
    try:
        await OnlineUserService.update_user_activity(
            tenant_id=current_tenant_id,
            user_id=current_user.id,
        )
    except Exception as e:
        # 更新失败不影响查询，记录日志即可
        from loguru import logger
        logger.warning(f"更新当前用户活动时间失败: {e}")
    
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
    # 默认只统计当前组织的在线用户
    if tenant_id is None:
        tenant_id = current_tenant_id
    
    # TODO: 权限检查（只有管理员可以查看其他组织的统计）
    
    # 确保当前用户的活动时间已更新（因为用户正在访问此页面，说明他们在线）
    try:
        await OnlineUserService.update_user_activity(
            tenant_id=current_tenant_id,
            user_id=current_user.id,
        )
    except Exception as e:
        # 更新失败不影响查询，记录日志即可
        from loguru import logger
        logger.warning(f"更新当前用户活动时间失败: {e}")
    
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
        
        # 立即读取验证
        activity_key = f"user:activity:{current_tenant_id}:{current_user.id}"
        value = await cache.get(activity_key)
        
        result = {
            "success": True,
            "message": "数据写入成功",
            "key": activity_key,
            "key_exists": value is not None,
            "value": json.loads(value) if value else None,
        }
        
        return result
    except Exception as e:
        logger.error(f"测试写入失败: {e}", exc_info=True)
        return {
            "success": False,
            "error": str(e),
            "message": "数据写入失败",
        }


@router.get("/debug/redis-status", response_model=Dict[str, Any])
async def debug_redis_status(
    current_user: User = Depends(get_current_user),
    current_tenant_id: int = Depends(get_current_tenant),
):
    """
    调试端点：检查 Redis 连接状态和用户活动键
    
    用于排查在线用户功能问题，检查 Redis 连接和键的存在情况。
    
    Returns:
        Dict[str, Any]: Redis 状态信息
    """
    try:
        redis_client = cache._redis
        redis_status = {
            "redis_connected": redis_client is not None,
            "redis_config": {
                "host": infra_settings.REDIS_HOST,
                "port": infra_settings.REDIS_PORT,
                "db": infra_settings.REDIS_DB,
                "password_set": bool(infra_settings.REDIS_PASSWORD),
                "url": infra_settings.REDIS_URL.replace(infra_settings.REDIS_PASSWORD or "", "***") if infra_settings.REDIS_PASSWORD else infra_settings.REDIS_URL,
            },
            "current_user": {
                "user_id": current_user.id,
                "username": current_user.username,
                "tenant_id": current_tenant_id,
            },
            "expected_key": f"user:activity:{current_tenant_id}:{current_user.id}",
            "key_exists": False,
            "key_value": None,
            "all_activity_keys": [],
            "test_result": None,
        }
        
        if redis_client:
            try:
                # 测试 Redis 连接
                await redis_client.ping()
                redis_status["test_result"] = "连接成功"
                
                # 检查当前用户的活动键
                activity_key = f"user:activity:{current_tenant_id}:{current_user.id}"
                redis_status["expected_key"] = activity_key
                
                key_value = await cache.get(activity_key)
                redis_status["key_exists"] = key_value is not None
                if key_value:
                    try:
                        redis_status["key_value"] = json.loads(key_value)
                    except Exception:
                        redis_status["key_value"] = key_value
                
                # 获取所有活动键
                pattern = "user:activity:*"
                all_keys = []
                cursor = 0
                while True:
                    cursor, keys = await redis_client.scan(cursor, match=pattern, count=100)
                    all_keys.extend(keys)
                    if cursor == 0:
                        break
                
                redis_status["all_activity_keys"] = sorted(all_keys)
                redis_status["total_keys"] = len(all_keys)
                
                # 获取所有键的值（前10个）
                sample_keys = all_keys[:10]
                sample_data = {}
                for key in sample_keys:
                    try:
                        value = await cache.get(key)
                        if value:
                            try:
                                sample_data[key] = json.loads(value)
                            except Exception:
                                sample_data[key] = value
                    except Exception as e:
                        sample_data[key] = f"错误: {e}"
                
                redis_status["sample_keys_data"] = sample_data
                
            except Exception as e:
                redis_status["test_result"] = f"连接测试失败: {e}"
                redis_status["error"] = str(e)
                logger.error(f"Redis 调试失败: {e}", exc_info=True)
        else:
            redis_status["test_result"] = "Redis 客户端未初始化"
        
        return redis_status
    except Exception as e:
        logger.error(f"获取 Redis 状态失败: {e}", exc_info=True)
        raise HTTPException(
            status_code=status.HTTP_500_INTERNAL_SERVER_ERROR,
            detail=f"获取 Redis 状态失败: {e}"
        )

