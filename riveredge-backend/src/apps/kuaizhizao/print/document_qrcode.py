"""快制造单据打印 — 手机端互动二维码 payload。"""

from __future__ import annotations

from typing import Any

from core.services.qrcode.qrcode_service import (
    QRCODE_TYPE_DOC,
    QRCODE_TYPE_WO,
    QRCodeService,
)

# 需在打印页眉展示二维码、供手机扫描的单据类型
MOBILE_INTERACTIVE_DOCUMENT_TYPES: frozenset[str] = frozenset(
    {
        "work_order",
        "production_picking",
        "production_return",
        "finished_goods_receipt",
        "semi_finished_goods_receipt",
        "other_inbound",
        "other_outbound",
        "sales_delivery",
        "purchase_receipt",
        "material_borrow",
        "material_return",
        "delivery_notice",
    }
)

# 模板变量 key（work_order 沿用既有字段名）
DOCUMENT_QRCODE_FIELD: dict[str, str] = {
    "work_order": "work_order_qrcode",
}


def qrcode_field_for_document_type(document_type: str) -> str:
    return DOCUMENT_QRCODE_FIELD.get(document_type, "document_qrcode")


def build_work_order_qrcode_text(
    *,
    work_order_uuid: str,
    work_order_code: str,
    material_code: str = "",
) -> str:
    return QRCodeService.build_qrcode_text(
        QRCODE_TYPE_WO,
        {
            "work_order_uuid": work_order_uuid,
            "work_order_code": work_order_code,
            "material_code": material_code or "",
        },
    )


def build_document_qrcode_text(
    *,
    document_type: str,
    document_uuid: str,
    document_code: str,
    document_id: int | None = None,
) -> str:
    payload: dict[str, Any] = {
        "document_type": document_type,
        "document_uuid": document_uuid,
        "document_code": document_code,
    }
    if document_id is not None:
        payload["document_id"] = document_id
    return QRCodeService.build_qrcode_text(QRCODE_TYPE_DOC, payload)


def attach_document_qrcode_fields(
    *,
    document_type: str,
    document: Any,
    data: dict[str, Any],
) -> dict[str, Any]:
    """为打印上下文补充二维码文本（Jinja qrcode 过滤器会渲染为图片）。"""
    if document_type not in MOBILE_INTERACTIVE_DOCUMENT_TYPES:
        return data
    doc_uuid = str(getattr(document, "uuid", "") or "")
    doc_code = str(data.get("code") or "").strip()
    doc_id = getattr(document, "id", None)
    if not doc_uuid or not doc_code:
        return data
    field_key = qrcode_field_for_document_type(document_type)
    if document_type == "work_order":
        data[field_key] = build_work_order_qrcode_text(
            work_order_uuid=doc_uuid,
            work_order_code=doc_code,
            material_code=str(data.get("product_code") or ""),
        )
    else:
        data[field_key] = build_document_qrcode_text(
            document_type=document_type,
            document_uuid=doc_uuid,
            document_code=doc_code,
            document_id=int(doc_id) if doc_id is not None else None,
        )
    return data
