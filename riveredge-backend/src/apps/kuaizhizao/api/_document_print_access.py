"""快智造通用单据打印鉴权（document_relations_legacy）。"""

from __future__ import annotations

from fastapi import HTTPException, Request, status

from core.api.deps.access import AuthContext, ensure_permission_codes
from core.config.permission_contract import build_permission_code

DOCUMENT_TYPE_PRINT_MODULE: dict[str, str] = {
    "work_order": "work-order",
    "production_picking": "inbound",
    "production_return": "material-return",
    "finished_goods_receipt": "inbound",
    "semi_finished_goods_receipt": "inbound",
    "sales_delivery": "outbound",
    "purchase_order": "purchase-order",
    "purchase_receipt": "inbound",
    "sales_order": "sales-order",
    "sales_forecast": "sales-forecast",
    "quotation": "quotation",
    "other_inbound": "other-inbound",
    "other_outbound": "other-outbound",
    "material_borrow": "material-borrow",
    "material_return": "material-return",
}


async def ensure_document_print_access(
    *,
    auth: AuthContext,
    tenant_id: int,
    request: Request,
    document_type: str,
) -> None:
    module = DOCUMENT_TYPE_PRINT_MODULE.get((document_type or "").strip())
    if not module:
        raise HTTPException(
            status_code=status.HTTP_400_BAD_REQUEST,
            detail=f"不支持打印的单据类型：{document_type}",
        )
    await ensure_permission_codes(
        auth,
        tenant_id,
        request,
        [build_permission_code("kuaizhizao", module, "print")],
        check_abac=False,
    )
