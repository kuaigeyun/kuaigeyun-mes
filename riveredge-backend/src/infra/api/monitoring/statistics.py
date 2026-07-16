"""
统计 API 模块

提供平台级统计数据相关的 API 接口。

Author: Luigi Lu
Date: 2025-12-27
"""

import socket
import sys
import platform as std_platform  # 使用标准库的 platform，避免与项目模块冲突
from datetime import datetime, timedelta, timezone
from typing import Any, Dict, List, Optional

from fastapi import APIRouter, Depends, HTTPException, Query
from tortoise import Tortoise
from tortoise.expressions import Q
from tortoise.functions import Count

from core.models.login_log import LoginLog
from infra.api.deps.deps import get_current_infra_superadmin
from infra.domain.package_config import get_all_package_configs
from infra.models.infra_superadmin import InfraSuperAdmin
from infra.models.tenant import Tenant, TenantPlan, TenantStatus
from infra.models.user import User
from core.utils.timezone_utils import to_api_isoformat

try:
    import psutil  # type: ignore
except ImportError:
    psutil = None

# 创建路由器
router = APIRouter(prefix="/monitoring", tags=["Platform - Monitoring"])

# 响应模型
class TenantStatisticsResponse:
    """组织统计响应模型"""
    def __init__(self, total: int, by_status: Dict[str, int], by_plan: Dict[str, int], updated_at: str):
        self.total = total
        self.by_status = by_status
        self.by_plan = by_plan
        self.updated_at = updated_at

@router.get("/system/info")
async def get_system_info(
    current_admin: InfraSuperAdmin = Depends(get_current_infra_superadmin)
):
    """
    获取系统监控信息

    返回服务器的系统信息，包括CPU、内存、磁盘、网络等
    """
    try:
        cpu_info = {
            "count": 0,
            "usage_percent": 0.0,
            "load_average": [0, 0, 0],
        }
        memory_info = {
            "total": 0,
            "available": 0,
            "used": 0,
            "usage_percent": 0.0,
        }
        disk_info = {
            "total": 0,
            "used": 0,
            "free": 0,
            "usage_percent": 0.0,
        }
        network_info = {"interfaces": []}
        uptime_seconds = 0

        # psutil 可选：未安装时返回基础信息与默认值，避免服务启动失败
        if psutil is not None:
            cpu_info = {
                "count": psutil.cpu_count(),
                "usage_percent": psutil.cpu_percent(interval=1),
                "load_average": psutil.getloadavg() if hasattr(psutil, 'getloadavg') else [0, 0, 0],
            }

            memory = psutil.virtual_memory()
            memory_info = {
                "total": memory.total,
                "available": memory.available,
                "used": memory.used,
                "usage_percent": memory.percent,
            }

            disk = psutil.disk_usage('/')
            disk_info = {
                "total": disk.total,
                "used": disk.used,
                "free": disk.free,
                "usage_percent": disk.percent,
            }

            for interface_name, interface_addresses in psutil.net_if_addrs().items():
                for address in interface_addresses:
                    if address.family == socket.AF_INET:
                        network_info["interfaces"].append({
                            "name": interface_name,
                            "ip_address": address.address,
                            "mac_address": "N/A",
                        })
                        break
            uptime_seconds = max(0, int(datetime.now().timestamp() - psutil.boot_time()))

        # 获取系统基本信息
        system_info = {
            "hostname": std_platform.node(),
            "platform": std_platform.system(),
            "infra_version": std_platform.version(),
            "architecture": std_platform.machine(),
            "python_version": std_platform.python_version(),
            "uptime": uptime_seconds,
            "cpu": cpu_info,
            "memory": memory_info,
            "disk": disk_info,
            "network": network_info,
        }

        return system_info
    except Exception as e:
        from loguru import logger
        logger.error(f"获取系统信息失败: {e}")
        # 返回模拟数据作为后备
        return {
            "hostname": "riveredge-server",
            "platform": "Linux",
            "infra_version": "5.4.0",
            "architecture": "x86_64",
            "python_version": "3.11.0",
            "uptime": 86400 * 7,
            "cpu": {
                "count": 8,
                "usage_percent": 45.2,
                "load_average": [1.25, 1.12, 1.05],
            },
            "memory": {
                "total": 16 * 1024 * 1024 * 1024,
                "available": 8 * 1024 * 1024 * 1024,
                "used": 8 * 1024 * 1024 * 1024,
                "usage_percent": 50.0,
            },
            "disk": {
                "total": 512 * 1024 * 1024 * 1024,
                "used": 256 * 1024 * 1024 * 1024,
                "free": 256 * 1024 * 1024 * 1024,
                "usage_percent": 50.0,
            },
            "network": {
                "interfaces": [
                    {
                        "name": "eth0",
                        "ip_address": "192.168.1.100",
                        "mac_address": "N/A",
                    },
                ],
            },
        }


@router.get("/tenants/statistics")
async def get_tenant_statistics(
    current_admin: InfraSuperAdmin = Depends(get_current_infra_superadmin)
):
    """
    获取组织统计信息

    统计所有组织的总数、按状态分布、按套餐分布等信息。

    Args:
        current_admin: 当前登录的平台超级管理员

    Returns:
        Dict[str, Any]: 组织统计信息
    """
    try:
        # 获取总数
        total_tenants = await Tenant.all().count()

        # 按状态统计
        status_stats = await Tenant.annotate(
            status_count=Count('id')
        ).group_by('status').values('status', 'status_count')

        by_status = {
            'active': 0,
            'inactive': 0,
            'expired': 0,
            'suspended': 0
        }

        for stat in status_stats:
            status = stat['status']
            count = stat['status_count']
            if status in by_status:
                by_status[status] = count

        # 按套餐统计
        plan_stats = await Tenant.annotate(
            plan_count=Count('id')
        ).group_by('plan').values('plan', 'plan_count')

        by_plan = {
            'basic': 0,
            'professional': 0,
            'enterprise': 0
        }

        for stat in plan_stats:
            plan = stat['plan']
            count = stat['plan_count']
            if plan in by_plan:
                by_plan[plan] = count

        # 处理体验套餐（trial）的统计
        trial_count = await Tenant.filter(plan=TenantPlan.TRIAL).count()
        by_plan['trial'] = trial_count

        return {
            "total": total_tenants,
            "by_status": by_status,
            "by_plan": by_plan,
            "updated_at": to_api_isoformat(datetime.now())
        }

    except Exception as e:
        raise HTTPException(
            status_code=500,
            detail=f"获取组织统计信息失败: {str(e)}"
        )


def _parse_date_range(start: Optional[str], end: Optional[str]) -> tuple[Optional[datetime], Optional[datetime]]:
    """解析时间范围参数，返回 (start_dt, end_dt)"""
    start_dt = None
    end_dt = None
    if start:
        try:
            start_dt = datetime.fromisoformat(start.replace("Z", "+00:00"))
        except (ValueError, TypeError):
            pass
    if end:
        try:
            end_dt = datetime.fromisoformat(end.replace("Z", "+00:00"))
        except (ValueError, TypeError):
            pass
    return start_dt, end_dt


@router.get("/users/statistics")
async def get_users_statistics(
    start: Optional[str] = Query(None, description="开始时间（ISO 格式）"),
    end: Optional[str] = Query(None, description="结束时间（ISO 格式）"),
    current_admin: InfraSuperAdmin = Depends(get_current_infra_superadmin),
):
    """
    获取用户注册统计信息（平台级）

    统计业务用户（排除平台管理员、软删除）的注册数据。
    包含：总用户数、今日/本周/本月新注册、注册来源分布、注册趋势。
    """
    try:
        # 业务用户条件：tenant_id 不为空（排除平台管理员）、未软删除
        base_q = Q(tenant_id__not_isnull=True) & Q(deleted_at__isnull=True)

        total_users = await User.filter(base_q).count()

        now = datetime.now()
        today_start = now.replace(hour=0, minute=0, second=0, microsecond=0)
        week_start = today_start - timedelta(days=today_start.weekday())
        month_start = today_start.replace(day=1)

        new_today = await User.filter(base_q & Q(created_at__gte=today_start)).count()
        new_week = await User.filter(base_q & Q(created_at__gte=week_start)).count()
        new_month = await User.filter(base_q & Q(created_at__gte=month_start)).count()

        # 按 source 分组统计（保留兼容）
        source_stats = await User.filter(base_q).group_by("source").annotate(
            cnt=Count("id")
        ).values("source", "cnt")
        by_source: Dict[str, int] = {}
        for s in source_stats:
            key = s["source"] if s["source"] else "unknown"
            by_source[key] = s["cnt"]

        # 注册地区分布：按用户首次登录地点分组，TOP 10（无登录记录归入「未知」）
        conn = Tortoise.get_connection("default")
        region_sql = """
            WITH first_login AS (
                SELECT DISTINCT ON (user_id) user_id,
                    COALESCE(NULLIF(TRIM(login_location), ''), '未知') AS loc
                FROM core_login_logs
                WHERE login_status = 'success' AND user_id IS NOT NULL
                ORDER BY user_id, created_at ASC
            )
            SELECT COALESCE(fl.loc, '未知') AS region, COUNT(*) AS count
            FROM core_users u
            LEFT JOIN first_login fl ON u.id = fl.user_id
            WHERE u.tenant_id IS NOT NULL AND u.deleted_at IS NULL
            GROUP BY COALESCE(fl.loc, '未知')
            ORDER BY count DESC
            LIMIT 10
        """
        region_rows = await conn.execute_query_dict(region_sql)
        by_region: Dict[str, int] = {str(row["region"]): row["count"] for row in (region_rows or [])}

        # 注册趋势：按日分组（使用时间范围参数，默认最近 30 天）
        start_dt, end_dt = _parse_date_range(start, end)
        if not end_dt:
            end_dt = now
        if not start_dt:
            start_dt = end_dt - timedelta(days=30)
        # 限制最多 90 天
        if (end_dt - start_dt).days > 90:
            start_dt = end_dt - timedelta(days=90)

        trend_sql = """
            SELECT (created_at AT TIME ZONE 'UTC')::date AS date, COUNT(*) AS count
            FROM core_users
            WHERE tenant_id IS NOT NULL AND (deleted_at IS NULL)
              AND created_at >= $1 AND created_at <= $2
            GROUP BY (created_at AT TIME ZONE 'UTC')::date
            ORDER BY date
        """
        trend_rows = await conn.execute_query_dict(
            trend_sql,
            [start_dt, end_dt],
        )
        registration_trend: List[Dict[str, Any]] = [
            {"date": str(row["date"]), "count": row["count"]}
            for row in (trend_rows or [])
        ]

        return {
            "total_users": total_users,
            "new_today": new_today,
            "new_week": new_week,
            "new_month": new_month,
            "by_source": by_source,
            "by_region": by_region,
            "registration_trend": registration_trend,
            "updated_at": to_api_isoformat(datetime.now()),
        }
    except Exception as e:
        raise HTTPException(
            status_code=500,
            detail=f"获取用户统计信息失败: {str(e)}",
        )


@router.get("/access/statistics")
async def get_access_statistics(
    start: Optional[str] = Query(None, description="开始时间（ISO 格式）"),
    end: Optional[str] = Query(None, description="结束时间（ISO 格式）"),
    current_admin: InfraSuperAdmin = Depends(get_current_infra_superadmin),
):
    """
    获取访问/登录统计信息（平台级）

    统计全平台登录日志，包含：总登录数、成功/失败、登录趋势、日活跃用户数（DAU）。
    """
    try:
        base_q = Q()

        total_logins = await LoginLog.filter(base_q).count()
        success_count = await LoginLog.filter(base_q & Q(login_status="success")).count()
        failed_count = await LoginLog.filter(base_q & Q(login_status="failed")).count()

        now = datetime.now(timezone.utc)
        start_dt, end_dt = _parse_date_range(start, end)
        if not end_dt:
            end_dt = now
        if not start_dt:
            start_dt = end_dt - timedelta(days=30)

        # 今日登录数、今日 DAU：使用前端传入的时间范围
        # 当范围为「今日」时，start/end 即用户本地今日；否则用 end 所在 UTC 日
        if (end_dt - start_dt).days < 1:
            today_start, today_end = start_dt, end_dt
        else:
            today_end = end_dt
            today_start = end_dt.replace(hour=0, minute=0, second=0, microsecond=0)
            if today_end.tzinfo is None:
                today_start = today_start.replace(tzinfo=timezone.utc)
                today_end = today_end.replace(tzinfo=timezone.utc)
        today_q = base_q & Q(created_at__gte=today_start) & Q(created_at__lte=today_end)
        logins_today = await LoginLog.filter(today_q).count()
        conn = Tortoise.get_connection("default")
        dau_sql = """
            SELECT COUNT(DISTINCT user_id) AS cnt
            FROM core_login_logs
            WHERE login_status = 'success' AND user_id IS NOT NULL
              AND created_at >= $1 AND created_at <= $2
        """
        dau_rows = await conn.execute_query_dict(dau_sql, [today_start, today_end])
        dau_today = dau_rows[0].get("cnt", 0) or 0 if dau_rows else 0

        # 登录趋势、DAU 趋势：按日分组
        if (end_dt - start_dt).days > 90:
            start_dt = end_dt - timedelta(days=90)

        login_trend_sql = """
            SELECT (created_at AT TIME ZONE 'UTC')::date AS date, COUNT(*) AS count
            FROM core_login_logs
            WHERE created_at >= $1 AND created_at <= $2
            GROUP BY (created_at AT TIME ZONE 'UTC')::date
            ORDER BY date
        """
        login_trend_rows = await conn.execute_query_dict(
            login_trend_sql,
            [start_dt, end_dt],
        )
        login_trend: List[Dict[str, Any]] = [
            {"date": str(row["date"]), "count": row["count"]}
            for row in (login_trend_rows or [])
        ]

        dau_trend_sql = """
            SELECT (created_at AT TIME ZONE 'UTC')::date AS date, COUNT(DISTINCT user_id) AS count
            FROM core_login_logs
            WHERE login_status = 'success' AND user_id IS NOT NULL
              AND created_at >= $1 AND created_at <= $2
            GROUP BY (created_at AT TIME ZONE 'UTC')::date
            ORDER BY date
        """
        dau_trend_rows = await conn.execute_query_dict(
            dau_trend_sql,
            [start_dt, end_dt],
        )
        dau_trend: List[Dict[str, Any]] = [
            {"date": str(row["date"]), "count": row["count"]}
            for row in (dau_trend_rows or [])
        ]

        # 登录地区分布：按 login_location 分组统计（成功登录），TOP 10
        region_sql = """
            SELECT COALESCE(NULLIF(TRIM(login_location), ''), '未知') AS region, COUNT(*) AS count
            FROM core_login_logs
            WHERE login_status = 'success'
            GROUP BY COALESCE(NULLIF(TRIM(login_location), ''), '未知')
            ORDER BY count DESC
            LIMIT 10
        """
        region_rows = await conn.execute_query_dict(region_sql)
        by_region: Dict[str, int] = {str(row["region"]): row["count"] for row in (region_rows or [])}

        return {
            "total_logins": total_logins,
            "success_count": success_count,
            "failed_count": failed_count,
            "logins_today": logins_today,
            "dau_today": dau_today,
            "login_trend": login_trend,
            "dau_trend": dau_trend,
            "by_region": by_region,
            "updated_at": to_api_isoformat(datetime.now()),
        }
    except Exception as e:
        raise HTTPException(
            status_code=500,
            detail=f"获取访问统计信息失败: {str(e)}",
        )
