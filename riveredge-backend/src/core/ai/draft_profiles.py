"""业务 StructuredDraft 配置注册。"""

from __future__ import annotations

from typing import Any

from core.ai.structured_draft import DraftProfile, StructuredDraftService

_PROFILES_REGISTERED = False


def _sales_meaningful(result: Any) -> bool:
    from apps.kuaizhizao.schemas.sales_order_ocr import SalesOrderOcrResult

    if not isinstance(result, SalesOrderOcrResult):
        return True
    if (result.customer_name or "").strip():
        return True
    if (result.notes or "").strip() or (result.confidence_notes or "").strip():
        return True
    if any(
        [
            (result.customer_contact or "").strip(),
            (result.customer_phone or "").strip(),
            (result.shipping_address or "").strip(),
            (result.order_date or "").strip(),
            (result.delivery_date or "").strip(),
        ]
    ):
        return True
    for row in result.items or []:
        if any(
            [
                (row.material_code or "").strip(),
                (row.material_name or "").strip(),
                (row.material_spec or "").strip(),
                row.required_quantity not in (None, 0),
            ]
        ):
            return True
    return False


def _po_meaningful(result: Any) -> bool:
    from apps.kuaizhizao.schemas.purchase_order_ocr import PurchaseOrderOcrResult

    if not isinstance(result, PurchaseOrderOcrResult):
        return True
    if (result.supplier_name or "").strip():
        return True
    for row in result.items or []:
        if (row.material_name or "").strip() or (row.material_code or "").strip():
            return True
    return False


def ensure_draft_profiles() -> None:
    global _PROFILES_REGISTERED
    if _PROFILES_REGISTERED:
        return
    _PROFILES_REGISTERED = True

    StructuredDraftService.register_profile(
        DraftProfile(
            schema_name="sales_order",
            system_prompt=(
                "你是制造 ERP 销售订单结构化助手。"
                "用户会提供从单据 OCR 提取的文本、自然语言订单描述，或在已有解析草稿上的补充修改。"
                "请解析客户、日期、地址、付款与发货信息，"
                "以及明细行的产品编码、名称、规格、单位、数量、单价、税率、交货日期。"
                "对话补充时合并草稿与用户说明，覆盖冲突字段。"
                "无法确认的字段留 null，不要编造。"
                "仅输出一个 JSON 对象，不要 Markdown 代码块，不要额外说明。"
            ),
            json_spec=(
                "输出 JSON（camelCase），字段："
                "customerName, customerContact, customerPhone, shippingAddress, "
                "orderDate, deliveryDate, shippingMethod, paymentTerms, currencyCode, notes, confidenceNotes, "
                "items 数组每项含 materialCode, materialName, materialSpec, materialUnit, "
                "requiredQuantity, unitPrice, taxRate, deliveryDate, notes。"
                "日期格式 YYYY-MM-DD；数量与金额为数字。"
            ),
            ocr_user_prefix=(
                "以下是从销售订单/采购单据图片 OCR 提取的文本，可能含表格与多行明细。"
                "请尽量还原全部客户信息与每一行产品明细，不要返回空 items。"
            ),
            validate_meaningful=_sales_meaningful,
            empty_ocr_message=(
                "未能从图片中识别出有效的销售订单信息，请上传更清晰的照片，或改用文字描述录单"
            ),
        )
    )

    StructuredDraftService.register_profile(
        DraftProfile(
            schema_name="purchase_order",
            system_prompt=(
                "你是制造 ERP 采购订单结构化助手。"
                "请解析供应商、日期、付款条件及明细行的物料、数量、单价。"
                "无法确认的字段留 null，不要编造。"
                "仅输出一个 JSON 对象，不要 Markdown 代码块。"
            ),
            json_spec=(
                "输出 JSON（camelCase），字段："
                "supplierName, supplierContact, supplierPhone, orderDate, deliveryDate, "
                "paymentTerms, currencyCode, notes, confidenceNotes, "
                "items 数组每项含 materialCode, materialName, materialSpec, materialUnit, "
                "quantity, unitPrice, taxRate, deliveryDate, notes。"
            ),
            validate_meaningful=_po_meaningful,
            empty_ocr_message="未能从图片中识别出有效的采购订单信息",
        )
    )
