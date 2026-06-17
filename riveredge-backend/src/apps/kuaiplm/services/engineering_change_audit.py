"""工程变更统一审核辅助（BOM / 工艺路线）。"""

from __future__ import annotations

from typing import Literal

ChangeCategory = Literal["bom", "process_route"]

AUDIT_NODE_BY_CATEGORY: dict[ChangeCategory, str] = {
    "bom": "bom_change",
    "process_route": "process_route_change",
}

ECN_ALLOWED_STATUSES = frozenset(
    {"draft", "pending", "approved", "rejected", "executed", "cancelled"}
)


async def is_audit_required(tenant_id: int, category: ChangeCategory) -> bool:
    from infra.services.business_config_service import BusinessConfigService

    node_key = AUDIT_NODE_BY_CATEGORY[category]
    return await BusinessConfigService().check_audit_required(tenant_id, node_key)


def audit_node_for_category(category: ChangeCategory) -> str:
    return AUDIT_NODE_BY_CATEGORY[category]
