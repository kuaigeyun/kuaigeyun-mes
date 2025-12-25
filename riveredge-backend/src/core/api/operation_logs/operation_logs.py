"""
操作日志管理 API 路由

提供操作日志的查询和统计功能。
"""

from fastapi import APIRouter, Depends, HTTPException, status, Query
from typing import Optional
from datetime import datetime

from core.schemas.operation_log import (
    OperationLogResponse,
    OperationLogListResponse,
    OperationLogStatsResponse,
)
from core.services.logging.operation_log_service import OperationLogService
from core.api.deps.deps import get_current_tenant
from infra.api.deps.deps import get_current_user
from infra.models.user import User

router = APIRouter(prefix="/operation-logs", tags=["OperationLogs"])


@router.get("", response_model=OperationLogListResponse)
async def get_operation_logs(
    page: int = Query(1, ge=1, description="页码"),
    page_size: int = Query(20, ge=1, le=100, description="每页数量"),
    user_id: Optional[int] = Query(None, description="用户ID过滤"),
    operation_type: Optional[str] = Query(None, description="操作类型过滤"),
    operation_module: Optional[str] = Query(None, description="操作模块过滤"),
    operation_object_type: Optional[str] = Query(None, description="操作对象类型过滤"),
    start_time: Optional[datetime] = Query(None, description="开始时间过滤"),
    end_time: Optional[datetime] = Query(None, description="结束时间过滤"),
    tenant_id: int = Depends(get_current_tenant),
):
    """
    获取操作日志列表
    
    Args:
        page: 页码
        page_size: 每页数量
        user_id: 用户ID过滤
        operation_type: 操作类型过滤
        operation_module: 操作模块过滤
        operation_object_type: 操作对象类型过滤
        start_time: 开始时间过滤
        end_time: 结束时间过滤
        
    Returns:
        OperationLogListResponse: 操作日志列表
    """
    return await OperationLogService.get_operation_logs(
        tenant_id=tenant_id,
        page=page,
        page_size=page_size,
        user_id=user_id,
        operation_type=operation_type,
        operation_module=operation_module,
        operation_object_type=operation_object_type,
        start_time=start_time,
        end_time=end_time,
    )


@router.get("/stats", response_model=OperationLogStatsResponse)
async def get_operation_log_stats(
    start_time: Optional[datetime] = Query(None, description="开始时间过滤"),
    end_time: Optional[datetime] = Query(None, description="结束时间过滤"),
    tenant_id: int = Depends(get_current_tenant),
):
    """
    获取操作日志统计
    
    Args:
        start_time: 开始时间过滤
        end_time: 结束时间过滤
        
    Returns:
        OperationLogStatsResponse: 操作日志统计
    """
    return await OperationLogService.get_operation_log_stats(
        tenant_id=tenant_id,
        start_time=start_time,
        end_time=end_time,
    )

