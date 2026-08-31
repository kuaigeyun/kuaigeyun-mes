"""快制造 — 业务单据打印预设（可视化设计器 schema + 编译 HTML）。"""

from __future__ import annotations

from apps.kuaizhizao.print.equipment_card import build_equipment_card_preset
from apps.kuaizhizao.print.mold_card import build_mold_card_preset
from apps.kuaizhizao.print.styles import build_a4_document, make_preset

_DELIVERY_PROJECT_PRINT_STUB = {
    "name": "交付项目",
    "code": "DELIVERY_PROJECT_PRINT",
    "type": "html",
    "description": "快制造预置打印模板：交付项目",
    "content": build_a4_document(
        title="交付项目",
        info_items=[
            ("项目编码", "project_code"),
            ("项目名称", "project_name"),
            ("客户", "customer_name"),
            ("销售订单", "sales_order_code"),
            ("交期", "delivery_date"),
            ("负责人", "owner_name"),
            ("当前节点", "current_node_name"),
            ("进度", "progress_percent"),
        ],
        table_head="",
        table_row="",
        sign_labels=("项目负责人", "审核人"),
        notes_expr="notes",
    ),
    "config": {
        "document_type": "delivery_project",
        "engine": "jinja2",
        "strict_variables": False,
    },
}

_DELIVERY_NODE_REPORT_PRINT_STUB = {
    "name": "交付节点汇报",
    "code": "DELIVERY_NODE_REPORT_PRINT",
    "type": "html",
    "description": "快制造预置打印模板：交付节点汇报",
    "content": build_a4_document(
        title="交付节点汇报",
        info_items=[
            ("汇报单号", "report_code"),
            ("项目编码", "project_code"),
            ("节点", "node_name"),
            ("汇报日期", "report_date"),
            ("汇报人", "reporter_name"),
            ("完成进度", "progress_percent"),
        ],
        table_head="",
        table_row="",
        sign_labels=("汇报人", "审核人"),
        notes_expr="content",
    ),
    "config": {
        "document_type": "delivery_node_report",
        "engine": "jinja2",
        "strict_variables": False,
    },
}

_DELIVERY_ISSUE_PRINT_STUB = {
    "name": "交付项目问题",
    "code": "DELIVERY_ISSUE_PRINT",
    "type": "html",
    "description": "快制造预置打印模板：交付项目问题",
    "content": build_a4_document(
        title="交付项目问题",
        info_items=[
            ("问题单号", "issue_code"),
            ("项目编码", "project_code"),
            ("节点", "node_name"),
            ("类型", "issue_type"),
            ("优先级", "priority"),
            ("状态", "status"),
            ("标题", "title"),
        ],
        table_head="",
        table_row="",
        sign_labels=("责任人", "审核人"),
        notes_expr="description",
    ),
    "config": {
        "document_type": "delivery_issue",
        "engine": "jinja2",
        "strict_variables": False,
    },
}

_EIGHT_D_STAGE_PRINT_SECTIONS = "\n".join(
    f"""  <div class="section">
    <div class="section-title">{label}</div>
    <div class="text-block">{{{{ {field} | safe or "—" }}}}</div>
  </div>"""
    for field, label in [
        ("d0_prepare", "D0 准备响应"),
        ("d1_team", "D1 组建团队"),
        ("d2_problem", "D2 问题描述"),
        ("d3_containment", "D3 临时遏制"),
        ("d4_root_cause", "D4 根因分析"),
        ("d5_corrective_action", "D5 纠正措施"),
        ("d6_implement_result", "D6 实施验证"),
        ("d7_prevent_recurrence", "D7 防再发"),
        ("d8_team_congratulation", "D8 团队总结"),
    ]
)

_EIGHT_D_REPORT_PRINT_STUB = {
    "name": "8D 质量报告",
    "code": "EIGHT_D_REPORT_PRINT",
    "type": "html",
    "description": "快制造预置打印模板：8D 质量报告",
    "content": build_a4_document(
        title="8D 质量报告",
        info_items=[
            ("报告编码", "report_code"),
            ("标题", "title"),
            ("当前阶段", "status"),
            ("严重度", "severity"),
            ("负责人", "owner_name"),
            ("计划完成", "due_date"),
            ("验证结果", "verification_result"),
        ],
        table_head="",
        table_row="",
        extra_sections=_EIGHT_D_STAGE_PRINT_SECTIONS,
        sign_labels=("负责人", "审核人"),
        notes_expr="remarks",
    ),
    "config": {
        "document_type": "eight_d_report",
        "engine": "jinja2",
        "strict_variables": False,
    },
}

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
    _DELIVERY_PROJECT_PRINT_STUB,
    _DELIVERY_NODE_REPORT_PRINT_STUB,
    _DELIVERY_ISSUE_PRINT_STUB,
    _EIGHT_D_REPORT_PRINT_STUB,
]
