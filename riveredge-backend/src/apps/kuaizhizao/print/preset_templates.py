"""快制造 — 业务单据打印预设（可视化设计器 schema + 编译 HTML）。"""

from __future__ import annotations

from apps.kuaizhizao.print.equipment_card import build_equipment_card_preset
from apps.kuaizhizao.print.mold_card import build_mold_card_preset
from apps.kuaizhizao.print.styles import make_preset

KUAIZHIZAO_PRESET_PRINT_TEMPLATES = [
    make_preset(name="报价单", code="QUOTATION_PRINT", document_type="quotation"),
    make_preset(name="销售合同", code="SALES_CONTRACT_PRINT", document_type="sales_contract"),
    make_preset(name="销售订单", code="SALES_ORDER_PRINT", document_type="sales_order"),
    make_preset(name="送货单", code="DELIVERY_NOTICE_PRINT", document_type="delivery_notice"),
    make_preset(name="销售出库单", code="SALES_DELIVERY_PRINT", document_type="sales_delivery"),
    make_preset(name="采购订单", code="PURCHASE_ORDER_PRINT", document_type="purchase_order"),
    make_preset(name="采购申请", code="PURCHASE_REQUISITION_PRINT", document_type="purchase_requisition"),
    make_preset(name="采购入库单", code="PURCHASE_RECEIPT_PRINT", document_type="purchase_receipt"),
    make_preset(name="工单", code="WORK_ORDER_PRINT", document_type="work_order"),
    make_preset(name="生产领料单", code="PRODUCTION_PICKING_PRINT", document_type="production_picking"),
    make_preset(name="生产退料单", code="PRODUCTION_RETURN_PRINT", document_type="production_return"),
    make_preset(name="成品入库单", code="FINISHED_GOODS_RECEIPT_PRINT", document_type="finished_goods_receipt"),
    make_preset(
        name="半成品入库单",
        code="SEMI_FINISHED_GOODS_RECEIPT_PRINT",
        document_type="semi_finished_goods_receipt",
    ),
    make_preset(name="借料单", code="MATERIAL_BORROW_PRINT", document_type="material_borrow"),
    make_preset(name="还料单", code="MATERIAL_RETURN_PRINT", document_type="material_return"),
    make_preset(name="其他入库单", code="OTHER_INBOUND_PRINT", document_type="other_inbound"),
    make_preset(name="其他出库单", code="OTHER_OUTBOUND_PRINT", document_type="other_outbound"),
    make_preset(name="销售预测", code="SALES_FORECAST_PRINT", document_type="sales_forecast"),
    make_preset(
        name="产品合格证",
        code="PRODUCT_QUALITY_CERTIFICATE_PRINT",
        document_type="product_quality_certificate",
        page_size="A5",
        description="产品合格证（A5），挂接成品检验单；随货交付打印",
    ),
    build_equipment_card_preset(),
    build_mold_card_preset(),
]
