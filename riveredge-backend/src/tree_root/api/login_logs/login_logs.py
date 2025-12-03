"""
登录日志管理 API 路由

提供登录日志的查询和统计功能。
"""

from fastapi import APIRouter, Depends, HTTPException, status, Query
from typing import Optional
from datetime import datetime

from tree_root.schemas.login_log import (
    LoginLogListResponse,
    LoginLogStatsResponse,
    LoginLogResponse,
)
from tree_root.services.login_log_service import LoginLogService
from tree_root.api.deps.deps import get_current_tenant
from soil.api.deps.deps import get_current_user
from soil.models.user import User
from soil.exceptions.exceptions import NotFoundError

router = APIRouter(prefix="/login-logs", tags=["LoginLogs"])


@router.get("", response_model=LoginLogListResponse)
async def get_login_logs(
    page: int = Query(1, ge=1, description="页码"),
    page_size: int = Query(20, ge=1, le=100, description="每页数量"),
    user_id: Optional[int] = Query(None, description="用户ID过滤"),
    username: Optional[str] = Query(None, description="用户名过滤"),
    login_status: Optional[str] = Query(None, description="登录状态过滤（success、failed）"),
    login_ip: Optional[str] = Query(None, description="登录IP过滤"),
    start_time: Optional[datetime] = Query(None, description="开始时间过滤"),
    end_time: Optional[datetime] = Query(None, description="结束时间过滤"),
    current_user: User = Depends(get_current_user), # 确保用户已认证
    tenant_id: int = Depends(get_current_tenant),
):
    """
    获取登录日志列表
    """
    return await LoginLogService.get_login_logs(
        tenant_id=tenant_id,
        page=page,
        page_size=page_size,
        user_id=user_id,
        username=username,
        login_status=login_status,
        login_ip=login_ip,
        start_time=start_time,
        end_time=end_time,
    )


@router.get("/{uuid}", response_model=LoginLogResponse)
async def get_login_log(
    uuid: str,
    current_user: User = Depends(get_current_user), # 确保用户已认证
    tenant_id: int = Depends(get_current_tenant),
):
    """
    获取登录日志详情
    """
    try:
        return await LoginLogService.get_login_log_by_uuid(
            tenant_id=tenant_id,
            uuid=uuid,
        )
    except NotFoundError as e:
        raise HTTPException(
            status_code=status.HTTP_404_NOT_FOUND,
            detail=str(e)
        )


@router.get("/statistics", response_model=LoginLogStatsResponse)
async def get_login_log_stats(
    current_user: User = Depends(get_current_user), # 确保用户已认证
    tenant_id: int = Depends(get_current_tenant),
):
    """
    获取登录日志统计
    """
    return await LoginLogService.get_login_log_stats(
        tenant_id=tenant_id,
    )

