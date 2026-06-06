"""巡查报表 report_key → manifest 模块（权限唯一真源）。"""

from __future__ import annotations

from fastapi import HTTPException, Request, status

from core.api.deps.access import AuthContext, ensure_permission_codes, get_auth_context
from core.api.deps.deps import get_current_tenant
from core.config.permission_contract import build_permission_code

REPORT_KEY_MODULE: dict[str, str] = {
    "issue-type-share": "patrol-reports-group-insights",
    "keyword-cloud": "patrol-reports-group-insights",
    "status-distribution": "patrol-reports-group-insights",
    "overdue-ranking": "patrol-reports-group-insights",
    "monthly-overdue-rate": "patrol-reports-group-insights",
    "dept-headcount-trend": "patrol-reports-group-insights",
    "monthly-volume": "patrol-reports-group-volume",
    "daily-volume": "patrol-reports-group-volume",
    "node-completion-trend": "patrol-reports-group-completion",
    "monthly-completion-rate": "patrol-reports-group-completion",
    "area-volume-trend": "patrol-reports-group-area",
}


async def ensure_patrol_report_read(
    report_key: str,
    *,
    request: Request,
    auth: AuthContext,
    tenant_id: int,
) -> None:
    module = REPORT_KEY_MODULE.get((report_key or "").strip().lower())
    if not module:
        raise HTTPException(status_code=status.HTTP_404_NOT_FOUND, detail="未知报表")
    await ensure_permission_codes(
        auth,
        tenant_id,
        request,
        [build_permission_code("haoligo", module, "read")],
        require_all=True,
        check_abac=True,
    )


async def ensure_patrol_kpi_read_access(
    *,
    request: Request,
    auth: AuthContext,
    tenant_id: int,
) -> None:
    await ensure_permission_codes(
        auth,
        tenant_id,
        request,
        [build_permission_code("haoligo", "patrol-hazards", "read")],
        require_all=True,
        check_abac=True,
    )
