"""
报表 API 路由模块

提供各类报表分析的API接口。

Author: Luigi Lu
Date: 2025-01-15
"""

from datetime import datetime
from typing import Optional
from fastapi import APIRouter, Depends, Query
from loguru import logger

from core.api.deps import get_current_user, get_current_tenant
from infra.models.user import User
from infra.exceptions.exceptions import ValidationError

from apps.kuaizhizao.services.report_service import ReportService

# 初始化服务实例
report_service = ReportService()

# 创建路由
router = APIRouter(prefix="/reports", tags=["报表"])


@router.get("/inventory", summary="获取库存报表")
async def get_inventory_report(
    report_type: str = Query("summary", description="报表类型（summary/turnover/abc/slow_moving）"),
    date_start: Optional[str] = Query(None, description="开始日期（YYYY-MM-DD）"),
    date_end: Optional[str] = Query(None, description="结束日期（YYYY-MM-DD）"),
    warehouse_id: Optional[int] = Query(None, description="仓库ID"),
    current_user: User = Depends(get_current_user),
    tenant_id: int = Depends(get_current_tenant),
) -> dict:
    """
    获取库存报表数据

    支持多种报表类型：
    - summary: 库存状况分析
    - turnover: 库存周转率报表
    - abc: ABC分析报表
    - slow_moving: 呆滞料分析报表

    - **report_type**: 报表类型
    - **date_start**: 开始日期（可选）
    - **date_end**: 结束日期（可选）
    - **warehouse_id**: 仓库ID（可选）
    """
    date_start_dt = None
    date_end_dt = None

    if date_start:
        try:
            date_start_dt = datetime.strptime(date_start, "%Y-%m-%d")
        except ValueError:
            raise ValidationError("开始日期格式错误，应为YYYY-MM-DD")

    if date_end:
        try:
            date_end_dt = datetime.strptime(date_end, "%Y-%m-%d")
        except ValueError:
            raise ValidationError("结束日期格式错误，应为YYYY-MM-DD")

    return await report_service.get_inventory_report(
        tenant_id=tenant_id,
        report_type=report_type,
        date_start=date_start_dt,
        date_end=date_end_dt,
        warehouse_id=warehouse_id,
    )

