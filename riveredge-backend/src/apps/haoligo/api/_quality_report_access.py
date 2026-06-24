"""品质报表 report_key → manifest 模块（权限唯一真源）。"""

from __future__ import annotations

from fastapi import HTTPException, Request, status

from core.api.deps.access import AuthContext, ensure_permission_codes
from core.config.permission_contract import build_permission_code

REPORT_KEY_MODULE: dict[str, str] = {
    "issue-report": "quality-reports-issues",
    "complaint-report": "quality-reports-complaints",
    "line-stop-report": "quality-reports-line-stops",
}


async def ensure_quality_report_read(
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
