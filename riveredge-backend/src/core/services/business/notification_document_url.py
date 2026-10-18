"""业务消息提醒：渲染用 PC 跳转链接（写入模板变量 document_url）。"""

from __future__ import annotations

from urllib.parse import quote

from infra.config.infra_config import infra_settings
from infra.models.tenant import Tenant

# trigger_document → PC 列表路径（组织入口 redirect 目标）
NOTIFICATION_DOCUMENT_LIST_PATHS: dict[str, str] = {
    "sales_order": "/apps/kuaizhizao/sales-management/sales-orders",
    "purchase_order": "/apps/kuaizhizao/purchase-management/purchase-orders",
    "purchase_requisition": "/apps/kuaizhizao/purchase-management/purchase-requisitions",
    "work_order": "/apps/kuaizhizao/production-management/work-orders",
    "approval": "/personal/tasks",
}


async def ensure_notification_document_url(
    tenant_id: int,
    vars_payload: dict[str, str],
    *,
    trigger_document: str,
    entity_uuid: str | None,
) -> None:
    """若调用方未提供 document_url，则按组织入口 + redirect 生成（发送前写入变量）。"""
    if str(vars_payload.get("document_url") or "").strip():
        return

    origin = (infra_settings.BASE_URL or "").strip().rstrip("/")
    if not origin:
        return

    tenant = await Tenant.get_or_none(id=tenant_id)
    if not tenant:
        return
    domain = (tenant.domain or "").strip().lower()
    if not domain:
        return

    path = NOTIFICATION_DOCUMENT_LIST_PATHS.get(str(trigger_document or "").strip())
    if not path:
        return

    redirect_target = path
    if entity_uuid and str(entity_uuid).strip():
        sep = "&" if "?" in redirect_target else "?"
        redirect_target = f"{redirect_target}{sep}open_uuid={quote(str(entity_uuid).strip())}"

    entry = f"{origin}/{domain}"
    vars_payload["document_url"] = f"{entry}?redirect={quote(redirect_target)}"
