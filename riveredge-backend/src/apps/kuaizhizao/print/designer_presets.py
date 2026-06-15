"""快制造打印预设 — 可视化设计器 schema 构建与编译。"""

from __future__ import annotations

import uuid
from dataclasses import dataclass, field
from typing import Any

from apps.kuaizhizao.print.document_qrcode import (
    MOBILE_INTERACTIVE_DOCUMENT_TYPES,
    qrcode_field_for_document_type,
)
from core.schemas.print_template import PrintTemplateCompileRequest
from core.services.print.print_template_service import PrintTemplateService

TABLE_STYLE = {
    "headerBgColor": "#0f4c81",
    "headerTextColor": "#ffffff",
    "headerFontWeight": "600",
    "borderStyle": "solid",
    "borderWidth": 1,
    "borderColor": "#e2e8f0",
    "zebraStripe": True,
    "zebraBgColor": "#f8fafc",
    "fontSize": "10px",
    "cellPadding": 6,
}


def _id(prefix: str) -> str:
    return f"{prefix}-{uuid.uuid4().hex[:8]}"


def _text(content: str, *, tag: str = "div", style: dict[str, Any] | None = None) -> dict[str, Any]:
    blk: dict[str, Any] = {"id": _id("txt"), "type": "text", "content": content, "tag": tag}
    if style:
        blk["style"] = style
    return blk


def _field(key: str, label: str, *, show_label: bool = True) -> dict[str, Any]:
    return {
        "id": _id("fld"),
        "type": "field",
        "key": key,
        "label": label,
        "showLabel": show_label,
    }


def _section_title(title: str) -> dict[str, Any]:
    return _text(
        title,
        style={
            "fontSize": "11px",
            "fontWeight": "700",
            "color": "#0f4c81",
            "borderLeft": "4px solid #0f4c81",
            "paddingLeft": "8px",
            "marginBottom": "4px",
        },
    )


def _detail_table(collection: str, columns: list[dict[str, str]]) -> dict[str, Any]:
    return {
        "id": _id("tbl"),
        "type": "detail_table",
        "collection": collection,
        "row_alias": "row",
        "columns": [{"key": c["key"], "label": c["label"], "type": c.get("type", "text")} for c in columns[:12]],
        "tableStyle": dict(TABLE_STYLE),
    }


def _info_columns(info_items: list[tuple[str, str]]) -> dict[str, Any]:
    mid = (len(info_items) + 1) // 2
    left, right = info_items[:mid], info_items[mid:]

    def col_blocks(items: list[tuple[str, str]]) -> list[dict[str, Any]]:
        return [_field(k, label) for label, k in items]

    return {
        "id": _id("info"),
        "type": "columns",
        "cols": [
            {"id": _id("c"), "width": "1", "blocks": col_blocks(left)},
            {"id": _id("c"), "width": "1", "blocks": col_blocks(right)},
        ],
    }


def _sign_row(labels: tuple[str, ...]) -> dict[str, Any]:
    return {
        "id": _id("sign"),
        "type": "columns",
        "cols": [
            {
                "id": _id("c"),
                "width": "1",
                "blocks": [_text(f"{label}：________________", style={"fontSize": "10px"})],
            }
            for label in labels
        ],
    }


def _qrcode_block(key: str, *, size: int = 72) -> dict[str, Any]:
    return {
        "id": _id("qr"),
        "type": "qrcode",
        "key": key,
        "size": size,
        "style": {"textAlign": "right", "marginBottom": "4px"},
    }


def _header_block(title: str, *, qrcode_key: str | None = None) -> dict[str, Any]:
    right_blocks: list[dict[str, Any]] = []
    if qrcode_key:
        right_blocks.append(_qrcode_block(qrcode_key))
    right_blocks.extend([
        _field("code", "单号"),
        _field("print_time", "打印时间"),
    ])
    return {
        "id": _id("hdr"),
        "type": "columns",
        "horizontalAlign": "space-between",
        "verticalAlign": "bottom",
        "cols": [
            {
                "id": _id("c"),
                "width": "2",
                "blocks": [
                    _text(
                        title,
                        tag="h1",
                        style={"fontSize": "20px", "fontWeight": "700", "color": "#0f4c81", "margin": "0"},
                    )
                ],
            },
            {
                "id": _id("c"),
                "width": "1",
                "horizontalAlign": "end",
                "blocks": right_blocks,
            },
        ],
    }


@dataclass
class DocumentLayout:
    document_type: str
    title: str
    info_items: list[tuple[str, str]]
    table_collection: str = "items"
    table_columns: list[dict[str, str]] = field(default_factory=list)
    page_size: str = "A4"
    sign_labels: tuple[str, ...] = ("制单人", "审核人", "签收人")
    show_totals: bool = False
    notes_key: str | None = "notes"
    extra_fields: list[tuple[str, str]] = field(default_factory=list)


def _col(*pairs: tuple[str, str]) -> list[dict[str, str]]:
    return [{"key": k, "label": label} for label, k in pairs]


# 明细列与前端 printTemplateSchemas.ARRAY_TABLE_TEMPLATES 对齐
_TABLE_COLUMNS: dict[str, list[dict[str, str]]] = {
    "quotation": _col(
        ("物料编号", "material_code"),
        ("物料名称", "material_name"),
        ("规格", "material_spec"),
        ("单位", "material_unit"),
        ("数量", "quote_quantity"),
        ("单价", "unit_price"),
        ("金额", "total_amount"),
        ("备注", "notes"),
    ),
    "sales_contract": _col(
        ("物料编号", "material_code"),
        ("物料名称", "material_name"),
        ("规格", "material_spec"),
        ("单位", "material_unit"),
        ("数量", "order_quantity"),
        ("单价", "unit_price"),
        ("金额", "total_amount"),
        ("备注", "notes"),
    ),
    "sales_order": _col(
        ("物料编号", "material_code"),
        ("物料名称", "material_name"),
        ("规格", "material_spec"),
        ("单位", "material_unit"),
        ("数量", "order_quantity"),
        ("单价", "unit_price"),
        ("金额", "total_amount"),
        ("备注", "notes"),
    ),
    "delivery_notice": _col(
        ("物料编号", "material_code"),
        ("物料名称", "material_name"),
        ("规格", "material_spec"),
        ("单位", "material_unit"),
        ("送货数量", "notice_quantity"),
        ("备注", "notes"),
    ),
    "sales_delivery": _col(
        ("物料编号", "material_code"),
        ("物料名称", "material_name"),
        ("规格", "material_spec"),
        ("单位", "material_unit"),
        ("出库数量", "delivery_quantity"),
        ("库位", "location_code"),
        ("批次", "batch_number"),
        ("备注", "notes"),
    ),
    "purchase_order": _col(
        ("物料编号", "material_code"),
        ("物料名称", "material_name"),
        ("规格", "material_spec"),
        ("单位", "material_unit"),
        ("采购数量", "ordered_quantity"),
        ("单价", "unit_price"),
        ("金额", "total_amount"),
        ("备注", "notes"),
    ),
    "purchase_receipt": _col(
        ("物料编号", "material_code"),
        ("物料名称", "material_name"),
        ("规格", "material_spec"),
        ("单位", "material_unit"),
        ("入库数量", "receipt_quantity"),
        ("库位", "location_code"),
        ("批次", "batch_number"),
        ("备注", "notes"),
    ),
    "work_order": _col(
        ("工序编号", "operation_code"),
        ("工序名称", "operation_name"),
        ("工作中心", "work_center_name"),
        ("状态", "status"),
        ("完成数量", "completed_quantity"),
    ),
    "production_picking": _col(
        ("物料编号", "material_code"),
        ("物料名称", "material_name"),
        ("单位", "material_unit"),
        ("已领数量", "picked_quantity"),
        ("仓库", "warehouse_name"),
        ("库位", "location_code"),
        ("批次", "batch_number"),
        ("状态", "status"),
    ),
    "production_return": _col(
        ("物料编号", "material_code"),
        ("物料名称", "material_name"),
        ("单位", "material_unit"),
        ("退料数量", "return_quantity"),
        ("仓库", "warehouse_name"),
        ("库位", "location_code"),
        ("批次", "batch_number"),
    ),
    "finished_goods_receipt": _col(
        ("物料编号", "material_code"),
        ("物料名称", "material_name"),
        ("单位", "material_unit"),
        ("入库数量", "receipt_quantity"),
        ("合格数量", "qualified_quantity"),
        ("库位", "location_code"),
        ("批次", "batch_number"),
        ("质量状态", "quality_status"),
    ),
    "semi_finished_goods_receipt": _col(
        ("物料编号", "material_code"),
        ("物料名称", "material_name"),
        ("单位", "material_unit"),
        ("入库数量", "receipt_quantity"),
        ("库位", "location_code"),
        ("批次", "batch_number"),
    ),
    "material_borrow": _col(
        ("物料编号", "material_code"),
        ("物料名称", "material_name"),
        ("单位", "material_unit"),
        ("借出数量", "borrow_quantity"),
        ("仓库", "warehouse_name"),
    ),
    "material_return": _col(
        ("物料编号", "material_code"),
        ("物料名称", "material_name"),
        ("单位", "material_unit"),
        ("归还数量", "return_quantity"),
        ("仓库", "warehouse_name"),
    ),
    "other_inbound": _col(
        ("物料编号", "material_code"),
        ("物料名称", "material_name"),
        ("单位", "material_unit"),
        ("入库数量", "inbound_quantity"),
        ("库位", "location_code"),
        ("批次", "batch_number"),
    ),
    "other_outbound": _col(
        ("物料编号", "material_code"),
        ("物料名称", "material_name"),
        ("单位", "material_unit"),
        ("出库数量", "outbound_quantity"),
        ("库位", "location_code"),
        ("批次", "batch_number"),
    ),
    "sales_forecast": _col(
        ("物料编号", "material_code"),
        ("物料名称", "material_name"),
        ("规格", "material_spec"),
        ("单位", "material_unit"),
        ("预测数量", "forecast_quantity"),
    ),
}


DOCUMENT_LAYOUTS: dict[str, DocumentLayout] = {
    "quotation": DocumentLayout(
        "quotation",
        "报价单",
        [
            ("客户名称", "customer_name"),
            ("客户联系人", "customer_contact"),
            ("客户电话", "customer_phone"),
            ("报价日期", "quotation_date"),
            ("有效期至", "valid_until"),
            ("销售员", "salesman_name"),
            ("付款条件", "payment_terms"),
            ("发货方式", "shipping_method"),
            ("收货地址", "shipping_address"),
        ],
        sign_labels=("销售员", "审核人", "客户确认"),
        show_totals=True,
    ),
    "sales_contract": DocumentLayout(
        "sales_contract",
        "销售合同",
        [
            ("合同编号", "contract_code"),
            ("合同类型", "contract_type"),
            ("客户名称", "customer_name"),
            ("客户联系人", "customer_contact"),
            ("合同日期", "contract_date"),
            ("有效期起", "valid_from"),
            ("有效期止", "valid_to"),
            ("销售员", "salesman_name"),
            ("付款条件", "payment_terms"),
            ("发货方式", "shipping_method"),
        ],
        sign_labels=("甲方（卖方）", "乙方（买方）"),
        show_totals=True,
        extra_fields=[("合同条款", "contract_terms")],
    ),
    "sales_order": DocumentLayout(
        "sales_order",
        "销售订单",
        [
            ("客户名称", "customer_name"),
            ("订单名称", "order_name"),
            ("订单日期", "order_date"),
            ("交货日期", "delivery_date"),
            ("状态", "status"),
        ],
        show_totals=True,
    ),
    "delivery_notice": DocumentLayout(
        "delivery_notice",
        "送货单",
        [
            ("客户名称", "customer_name"),
            ("客户联系人", "customer_contact"),
            ("客户电话", "customer_phone"),
            ("销售订单", "sales_order_code"),
            ("销售出库单", "sales_delivery_code"),
            ("预计送达", "planned_delivery_date"),
            ("承运商", "carrier"),
            ("运单号", "tracking_number"),
            ("收货地址", "shipping_address"),
        ],
        sign_labels=("发货方", "承运方", "客户签收"),
    ),
    "sales_delivery": DocumentLayout(
        "sales_delivery",
        "销售出库单",
        [
            ("客户名称", "customer_name"),
            ("销售订单", "sales_order_code"),
            ("出库仓库", "warehouse_name"),
            ("出库日期", "delivery_date"),
            ("经办人", "deliverer_name"),
            ("状态", "status"),
        ],
        sign_labels=("制单", "仓管", "领货人"),
    ),
    "purchase_order": DocumentLayout(
        "purchase_order",
        "采购订单",
        [
            ("供应商", "supplier_name"),
            ("采购员", "purchaser_name"),
            ("订单日期", "order_date"),
            ("要求到货", "required_date"),
            ("状态", "status"),
        ],
        sign_labels=("采购员", "审核人", "供应商确认"),
        show_totals=True,
    ),
    "purchase_receipt": DocumentLayout(
        "purchase_receipt",
        "采购入库单",
        [
            ("采购订单", "purchase_order_code"),
            ("供应商", "supplier_name"),
            ("入库仓库", "warehouse_name"),
            ("入库日期", "receipt_date"),
            ("验收人", "receiver_name"),
            ("状态", "status"),
        ],
        sign_labels=("仓管", "质检", "采购确认"),
    ),
    "work_order": DocumentLayout(
        "work_order",
        "生产工单",
        [
            ("工单名称", "name"),
            ("产品编号", "product_code"),
            ("产品名称", "product_name"),
            ("生产数量", "quantity"),
            ("车间", "workshop_name"),
            ("工作中心", "work_center_name"),
            ("计划开始", "planned_start_date"),
            ("计划结束", "planned_end_date"),
            ("状态", "status"),
        ],
        table_collection="operations",
        sign_labels=("计划员", "车间主任", "操作员"),
        notes_key="remarks",
    ),
    "production_picking": DocumentLayout(
        "production_picking",
        "生产领料单",
        [
            ("工单编号", "work_order_code"),
            ("车间", "workshop_name"),
            ("领料人", "picker_name"),
            ("领料时间", "picking_time"),
            ("状态", "status"),
        ],
        sign_labels=("领料人", "仓管", "车间确认"),
    ),
    "production_return": DocumentLayout(
        "production_return",
        "生产退料单",
        [
            ("工单编号", "work_order_code"),
            ("领料单号", "picking_code"),
            ("退料人", "returner_name"),
            ("退料仓库", "warehouse_name"),
            ("退料时间", "return_time"),
            ("状态", "status"),
        ],
        sign_labels=("退料人", "仓管", "车间确认"),
    ),
    "finished_goods_receipt": DocumentLayout(
        "finished_goods_receipt",
        "成品入库单",
        [
            ("工单编号", "work_order_code"),
            ("入库仓库", "warehouse_name"),
            ("入库人", "receiver_name"),
            ("入库时间", "receipt_time"),
            ("状态", "status"),
        ],
        sign_labels=("仓管", "质检", "生产确认"),
    ),
    "semi_finished_goods_receipt": DocumentLayout(
        "semi_finished_goods_receipt",
        "半成品入库单",
        [
            ("工单编号", "work_order_code"),
            ("入库仓库", "warehouse_name"),
            ("入库人", "receiver_name"),
            ("入库时间", "receipt_time"),
            ("状态", "status"),
        ],
        sign_labels=("仓管", "质检", "生产确认"),
    ),
    "material_borrow": DocumentLayout(
        "material_borrow",
        "借料单",
        [
            ("借料人", "borrower_name"),
            ("部门", "department"),
            ("借出仓库", "warehouse_name"),
            ("预计归还", "expected_return_date"),
            ("借出时间", "borrow_time"),
            ("状态", "status"),
        ],
        sign_labels=("借料人", "仓管", "审批人"),
    ),
    "material_return": DocumentLayout(
        "material_return",
        "还料单",
        [
            ("借料单号", "borrow_code"),
            ("归还人", "returner_name"),
            ("归还仓库", "warehouse_name"),
            ("归还时间", "return_time"),
            ("状态", "status"),
        ],
        sign_labels=("归还人", "仓管", "审批人"),
    ),
    "other_inbound": DocumentLayout(
        "other_inbound",
        "其他入库单",
        [
            ("入库仓库", "warehouse_name"),
            ("入库原因", "reason"),
            ("经办人", "operator_name"),
            ("入库时间", "inbound_time"),
            ("状态", "status"),
        ],
        sign_labels=("经办人", "仓管", "审批人"),
    ),
    "other_outbound": DocumentLayout(
        "other_outbound",
        "其他出库单",
        [
            ("出库仓库", "warehouse_name"),
            ("出库原因", "reason"),
            ("经办人", "operator_name"),
            ("出库时间", "outbound_time"),
            ("状态", "status"),
        ],
        sign_labels=("经办人", "仓管", "审批人"),
    ),
    "sales_forecast": DocumentLayout(
        "sales_forecast",
        "销售预测",
        [
            ("预测名称", "name"),
            ("预测期间", "forecast_period"),
            ("客户", "customer_name"),
            ("状态", "status"),
            ("创建时间", "created_at"),
        ],
        sign_labels=("编制人", "审核人"),
    ),
}


def build_certificate_designer_schema() -> dict[str, Any]:
    blocks: list[dict[str, Any]] = [
        _text(
            "产品合格证",
            tag="h1",
            style={
                "fontSize": "18px",
                "fontWeight": "700",
                "color": "#0f4c81",
                "textAlign": "center",
                "letterSpacing": "4px",
            },
        ),
        _field("release_certificate", "证书编号"),
        _info_columns(
            [
                ("产品名称", "material_name"),
                ("规格型号", "material_spec"),
                ("产品编号", "material_code"),
                ("生产批次", "batch_number"),
                ("生产数量", "quantity"),
                ("检验日期", "inspection_date"),
                ("检验员", "inspector_name"),
                ("检验结论", "inspection_result"),
            ]
        ),
        _section_title("备注"),
        _field("notes", "备注", show_label=False),
        _sign_row(("检验员（签章）", "质量部门（签章）")),
    ]
    return {
        "version": "v1",
        "pageSize": "A5",
        "orientation": "portrait",
        "margins": {"top": 10, "right": 8, "bottom": 12, "left": 8},
        "itemSpacing": 4,
        "blocks": blocks,
    }


def build_designer_schema(layout: DocumentLayout) -> dict[str, Any]:
    columns = layout.table_columns or _TABLE_COLUMNS.get(layout.document_type, [])
    qrcode_key = (
        qrcode_field_for_document_type(layout.document_type)
        if layout.document_type in MOBILE_INTERACTIVE_DOCUMENT_TYPES
        else None
    )
    blocks: list[dict[str, Any]] = [
        _header_block(layout.title, qrcode_key=qrcode_key),
        _section_title("基本信息"),
        _info_columns(layout.info_items),
    ]
    for label, key in layout.extra_fields:
        blocks.extend([_section_title(label), _field(key, label, show_label=False)])
    if columns:
        blocks.extend([_section_title("明细"), _detail_table(layout.table_collection, columns)])
    if layout.show_totals:
        blocks.append(
            _text(
                "总数量：{{ total_quantity | number }}    总金额：{{ total_amount | money }}",
                style={"textAlign": "right", "fontSize": "11px", "fontWeight": "600"},
            )
        )
    elif layout.document_type == "delivery_notice":
        blocks.append(
            _text(
                "总数量：{{ total_quantity | number }}",
                style={"textAlign": "right", "fontSize": "11px", "fontWeight": "600"},
            )
        )
    if layout.notes_key:
        blocks.extend([_section_title("备注"), _field(layout.notes_key, "备注", show_label=False)])
    blocks.append(_sign_row(layout.sign_labels))
    blocks.append(
        _text(
            "本单据由系统自动生成，盖章有效",
            style={"fontSize": "9px", "color": "#94a3b8", "textAlign": "center"},
        )
    )
    margin = {"top": 14, "right": 12, "bottom": 16, "left": 12}
    if layout.page_size == "A5":
        margin = {"top": 10, "right": 8, "bottom": 12, "left": 8}
    return {
        "version": "v1",
        "pageSize": layout.page_size,
        "orientation": "portrait",
        "margins": margin,
        "itemSpacing": 6,
        "blocks": blocks,
    }


def compile_designer_schema(schema: dict[str, Any]) -> str:
    result = PrintTemplateService.compile_designer_schema(
        PrintTemplateCompileRequest(source_type="designer_json", source=schema)
    )
    return str(result.get("compiled_template") or "")


def build_designer_schema_for_document_type(document_type: str) -> dict[str, Any]:
    if document_type == "product_quality_certificate":
        return build_certificate_designer_schema()
    layout = DOCUMENT_LAYOUTS.get(document_type)
    if not layout:
        raise ValueError(f"未定义设计器布局: {document_type}")
    return build_designer_schema(layout)


def _header_has_qrcode(schema: dict[str, Any]) -> bool:
    blocks = schema.get("blocks") or []
    if not blocks or not isinstance(blocks[0], dict):
        return False
    header = blocks[0]
    if header.get("type") != "columns":
        return False
    for col in header.get("cols") or []:
        if not isinstance(col, dict):
            continue
        for blk in col.get("blocks") or []:
            if isinstance(blk, dict) and blk.get("type") == "qrcode":
                return True
    return False


def ensure_header_qrcode(schema: dict[str, Any], document_type: str) -> dict[str, Any]:
    """已有模板缺少页眉二维码时补齐（不覆盖用户其它 blocks）。"""
    if document_type not in MOBILE_INTERACTIVE_DOCUMENT_TYPES:
        return schema
    if _header_has_qrcode(schema):
        return schema
    qrcode_key = qrcode_field_for_document_type(document_type)
    blocks = list(schema.get("blocks") or [])
    if not blocks or not isinstance(blocks[0], dict) or blocks[0].get("type") != "columns":
        return schema
    header = dict(blocks[0])
    cols = [dict(c) for c in (header.get("cols") or []) if isinstance(c, dict)]
    if len(cols) < 2:
        return schema
    right = dict(cols[-1])
    right_blocks = list(right.get("blocks") or [])
    right["blocks"] = [_qrcode_block(qrcode_key)] + right_blocks
    cols[-1] = right
    header["cols"] = cols
    blocks[0] = header
    return {**schema, "blocks": blocks}
