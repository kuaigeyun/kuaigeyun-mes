"""业务附件上传：category 白名单 → 模块写权限（create / update 等），替代强依赖 system.file:create。"""

from __future__ import annotations

from typing import Final

# category → 满足其一即可上传（新建/编辑业务单据时均可传附件）
# 注塑机单据族与通用设备单据族权限码并列：移动端/PC 共用同一 category，
# 入口 family=injection 时用户仅有 injection-documents-*，缺登记会 HTTP 403。
BUSINESS_FILE_UPLOAD_PERMISSIONS: Final[dict[str, tuple[str, ...]]] = {
    "haoligo_equipment": (
        "haoligo:equipment-ledger:create",
        "haoligo:equipment-ledger:update",
        "haoligo:equipment-documents-acceptance:complete",
        "haoligo:injection-documents-acceptance:complete",
    ),
    "haoligo_equipment_upkeep": (
        "haoligo:equipment-documents-upkeep-sheet:create",
        "haoligo:equipment-documents-upkeep-sheet:update",
        "haoligo:injection-documents-upkeep-sheet:create",
        "haoligo:injection-documents-upkeep-sheet:update",
    ),
    "haoligo_equipment_upkeep_complete": (
        "haoligo:equipment-documents-upkeep-complete:create",
        "haoligo:equipment-documents-upkeep-complete:update",
        "haoligo:equipment-documents-upkeep-sheet:complete",
        "haoligo:injection-documents-upkeep-complete:create",
        "haoligo:injection-documents-upkeep-complete:update",
        "haoligo:injection-documents-upkeep-sheet:complete",
    ),
    "haoligo_equipment_spot_check": (
        "haoligo:equipment-documents-spot-check:create",
        "haoligo:equipment-documents-spot-check:update",
        "haoligo:injection-documents-spot-check:create",
        "haoligo:injection-documents-spot-check:update",
    ),
    "haoligo_equipment_route_patrol": (
        "haoligo:equipment-documents-route-patrol:create",
        "haoligo:equipment-documents-route-patrol:update",
        "haoligo:injection-documents-route-patrol:create",
        "haoligo:injection-documents-route-patrol:update",
    ),
    "haoligo_equipment_acceptance": (
        "haoligo:equipment-documents-acceptance:create",
        "haoligo:equipment-documents-acceptance:update",
        "haoligo:equipment-documents-acceptance:submit",
        "haoligo:equipment-documents-acceptance:execute",
        "haoligo:equipment-documents-acceptance:complete",
        "haoligo:injection-documents-acceptance:create",
        "haoligo:injection-documents-acceptance:update",
        "haoligo:injection-documents-acceptance:submit",
        "haoligo:injection-documents-acceptance:execute",
        "haoligo:injection-documents-acceptance:complete",
    ),
    "haoligo_finance_equipment_contract": (
        "haoligo:finance-equipment-contracts:create",
        "haoligo:finance-equipment-contracts:update",
    ),
    "haoligo_finance_equipment_invoice": (
        "haoligo:finance-equipment-payables:create",
        "haoligo:finance-equipment-payables:update",
        "haoligo:finance-equipment-payables:submit",
        "haoligo:finance-equipment-payables:execute",
    ),
    "haoligo_finance_equipment_acceptance": (
        "haoligo:finance-equipment-payables:create",
        "haoligo:finance-equipment-payables:update",
        "haoligo:finance-equipment-payables:submit",
        "haoligo:finance-equipment-payables:execute",
    ),
    "haoligo_patrol_hazard": (
        "haoligo:patrol-hazards:create",
        "haoligo:patrol-hazards:update",
    ),
    "haoligo_quality_management": (
        "haoligo:quality-issue-tracking:create",
        "haoligo:quality-issue-tracking:update",
        "haoligo:quality-issue-tracking:submit",
        "haoligo:quality-issue-tracking:complete",
        "haoligo:customer-complaint:create",
        "haoligo:customer-complaint:update",
        "haoligo:customer-complaint:submit",
        "haoligo:customer-complaint:complete",
        "haoligo:line-stop-feedback:create",
        "haoligo:line-stop-feedback:update",
        "haoligo:line-stop-feedback:submit",
        "haoligo:line-stop-feedback:complete",
    ),
    "haoligo_mold_trial": (
        "haoligo:molds-documents-trial:create",
        "haoligo:molds-documents-trial:update",
    ),
    "haoligo_mold_maint": (
        "haoligo:molds-documents-upkeep:create",
        "haoligo:molds-documents-upkeep:update",
        "haoligo:molds-documents-repair:create",
        "haoligo:molds-documents-repair:update",
    ),
    "haoligo_mold_maint_complete": (
        "haoligo:molds-documents-upkeep-complete:create",
        "haoligo:molds-documents-upkeep-complete:update",
        "haoligo:molds-documents-repair-complete:create",
        "haoligo:molds-documents-repair-complete:update",
        "haoligo:molds-documents-upkeep:complete",
        "haoligo:molds-documents-repair:complete",
    ),
    "haoligo_mold_outsource_maint": (
        "haoligo:molds-documents-outsource-maintenance:create",
        "haoligo:molds-documents-outsource-maintenance:update",
    ),
    "haoligo_mold_outsource_maint_complete": (
        "haoligo:molds-documents-outsource-complete:create",
        "haoligo:molds-documents-outsource-complete:update",
        "haoligo:molds-documents-outsource-maintenance:complete",
    ),
    # kuaizhizao — 销售管理
    "customer_follow_up_attachments": (
        "kuaizhizao:customer-follow-up:create",
        "kuaizhizao:customer-follow-up:update",
    ),
    "sales_contract_attachments": (
        "kuaizhizao:sales-contract:create",
        "kuaizhizao:sales-contract:update",
    ),
    "sales_order_attachments": (
        "kuaizhizao:sales-order:create",
        "kuaizhizao:sales-order:update",
    ),
    "quotation_attachments": (
        "kuaizhizao:quotation:create",
        "kuaizhizao:quotation:update",
    ),
    "sales_forecast_attachments": (
        "kuaizhizao:sales-forecast:create",
        "kuaizhizao:sales-forecast:update",
    ),
    "sales_order_change_attachments": (
        "kuaizhizao:sales-order-change:create",
        "kuaizhizao:sales-order-change:update",
    ),
    "shipment_notice_attachments": (
        "kuaizhizao:shipment-notice:create",
        "kuaizhizao:shipment-notice:update",
    ),
    "sales_return_attachments": (
        "kuaizhizao:sales-return:create",
        "kuaizhizao:sales-return:update",
    ),
    # kuaizhizao — 采购管理
    "purchase_requisition_attachments": (
        "kuaizhizao:purchase-requisition:create",
        "kuaizhizao:purchase-requisition:update",
    ),
    "purchase_inquiry_attachments": (
        "kuaizhizao:purchase-inquiry:create",
        "kuaizhizao:purchase-inquiry:update",
    ),
    "purchase_order_attachments": (
        "kuaizhizao:purchase-order:create",
        "kuaizhizao:purchase-order:update",
    ),
    "purchase_order_change_attachments": (
        "kuaizhizao:purchase-order-change:create",
        "kuaizhizao:purchase-order-change:update",
    ),
    "receipt_notice_attachments": (
        "kuaizhizao:receipt-notice:create",
        "kuaizhizao:receipt-notice:update",
    ),
    "purchase_return_attachments": (
        "kuaizhizao:purchase-return:create",
        "kuaizhizao:purchase-return:update",
    ),
    # kuaizhizao — 生产执行
    "work_order_attachments": (
        "kuaizhizao:work-order:create",
        "kuaizhizao:work-order:update",
    ),
    "rework_order_attachments": (
        "kuaizhizao:rework-order:create",
        "kuaizhizao:rework-order:update",
    ),
    "outsource_work_order_attachments": (
        "kuaizhizao:outsource-order:create",
        "kuaizhizao:outsource-order:update",
    ),
    "outsource_order_attachments": (
        "kuaizhizao:outsource-order:create",
        "kuaizhizao:outsource-order:update",
    ),
    "packing_binding_attachments": (
        "kuaizhizao:production-execution-packing-binding:create",
        "kuaizhizao:production-execution-packing-binding:update",
    ),
    "install_execution_task_attachments": (
        "kuaizhizao:after-sales-install:assign",
        "kuaizhizao:after-sales-install:update",
    ),
    # kuaizhizao — 质量管理
    "incoming_inspection_attachments": (
        "kuaizhizao:quality-management-incoming-inspection:create",
        "kuaizhizao:quality-management-incoming-inspection:update",
        "kuaizhizao:quality-management-incoming-inspection:execute",
    ),
    "process_inspection_attachments": (
        "kuaizhizao:quality-management-process-inspection:create",
        "kuaizhizao:quality-management-process-inspection:update",
        "kuaizhizao:quality-management-process-inspection:execute",
    ),
    "finished_goods_inspection_attachments": (
        "kuaizhizao:quality-management-finished-goods-inspection:create",
        "kuaizhizao:quality-management-finished-goods-inspection:update",
        "kuaizhizao:quality-management-finished-goods-inspection:execute",
    ),
    "oqc_inspection_attachments": (
        "kuaizhizao:quality-management-oqc-inspection:create",
        "kuaizhizao:quality-management-oqc-inspection:update",
        "kuaizhizao:quality-management-oqc-inspection:execute",
    ),
    "nonconforming_ledger_attachments": (
        "kuaizhizao:quality-management-nonconforming-ledger:create",
        "kuaizhizao:quality-management-nonconforming-ledger:update",
    ),
    "quality_8d_report_attachments": (
        "kuaizhizao:quality-management-eight-d-reports:create",
        "kuaizhizao:quality-management-eight-d-reports:update",
    ),
    "inspection_plan_attachments": (
        "kuaizhizao:quality-management-inspection-plans:create",
        "kuaizhizao:quality-management-inspection-plans:update",
    ),
    "qms_system_document_attachments": (
        "kuaizhizao:quality-management-system-documents:create",
        "kuaizhizao:quality-management-system-documents:update",
    ),
    "qms_internal_audit_attachments": (
        "kuaizhizao:quality-management-internal-audits:create",
        "kuaizhizao:quality-management-internal-audits:update",
    ),
    "qms_management_review_attachments": (
        "kuaizhizao:quality-management-management-reviews:create",
        "kuaizhizao:quality-management-management-reviews:update",
    ),
    # kuaizhizao — 设备管理
    "equipment_attachments": (
        "kuaizhizao:equipment-management-equipment:create",
        "kuaizhizao:equipment-management-equipment:update",
    ),
    "equipment_photo": (
        "kuaizhizao:equipment-management-equipment:create",
        "kuaizhizao:equipment-management-equipment:update",
    ),
    "equipment_calibration_attachments": (
        "kuaizhizao:equipment-management-equipment:create",
        "kuaizhizao:equipment-management-equipment:update",
    ),
    "equipment_acceptance_attachments": (
        "kuaizhizao:equipment-acceptance:create",
        "kuaizhizao:equipment-acceptance:update",
    ),
    "mold_attachments": (
        "kuaizhizao:equipment-management-molds:create",
        "kuaizhizao:equipment-management-molds:update",
    ),
    "tool_ledger_attachments": (
        "kuaizhizao:equipment-management-tool-ledger:create",
        "kuaizhizao:equipment-management-tool-ledger:update",
    ),
    "equipment_fault_attachments": (
        "kuaizhizao:equipment-fault:create",
        "kuaizhizao:equipment-fault:update",
    ),
    "equipment_repair_attachments": (
        "kuaizhizao:equipment-fault:create",
        "kuaizhizao:equipment-fault:update",
    ),
    "equipment_spot_check": (
        "kuaizhizao:equipment-spot-check:create",
        "kuaizhizao:equipment-spot-check:update",
        "kuaizhizao:equipment-spot-check:submit",
    ),
    "equipment_spot_check_line": (
        "kuaizhizao:equipment-spot-check:create",
        "kuaizhizao:equipment-spot-check:update",
        "kuaizhizao:equipment-spot-check:submit",
    ),
    "equipment_route_patrol_line": (
        "kuaizhizao:equipment-route-patrol:create",
        "kuaizhizao:equipment-route-patrol:update",
        "kuaizhizao:equipment-route-patrol:submit",
    ),
    "maintenance_plan_attachments": (
        "kuaizhizao:maintenance-plan:create",
        "kuaizhizao:maintenance-plan:update",
    ),
    "maintenance_execution_attachments": (
        "kuaizhizao:maintenance-plan:create",
        "kuaizhizao:maintenance-plan:update",
    ),
    "maintenance_reminder_attachments": (
        "kuaizhizao:maintenance-reminder:create",
        "kuaizhizao:maintenance-reminder:update",
    ),
    "equipment_status_attachments": (
        "kuaizhizao:equipment-status:create",
        "kuaizhizao:equipment-status:update",
    ),
    "mold_usage_attachments": (
        "kuaizhizao:mold-borrow:create",
        "kuaizhizao:mold-borrow:update",
    ),
    "mold_calibration_attachments": (
        "kuaizhizao:mold-calibration:create",
        "kuaizhizao:mold-calibration:update",
    ),
    "tool_usage_attachments": (
        "kuaizhizao:tool-usage:create",
        "kuaizhizao:tool-usage:update",
    ),
    "tool_maintenance_attachments": (
        "kuaizhizao:tool-maintenance:create",
        "kuaizhizao:tool-maintenance:update",
    ),
    "tool_calibration_attachments": (
        "kuaizhizao:tool-calibration:create",
        "kuaizhizao:tool-calibration:update",
    ),
    # kuaizhizao — 仓储管理
    "batching_order_attachments": (
        "kuaizhizao:warehouse-management-batching-center:create",
        "kuaizhizao:warehouse-management-batching-center:update",
    ),
    "purchase_receipt_attachments": (
        "kuaizhizao:inbound:create",
        "kuaizhizao:inbound:update",
    ),
    "other_inbound_attachments": (
        "kuaizhizao:other-inbound:create",
        "kuaizhizao:other-inbound:update",
    ),
    "material_return_attachments": (
        "kuaizhizao:material-return:create",
        "kuaizhizao:material-return:update",
    ),
    "customer_material_registration_attachments": (
        "kuaizhizao:warehouse-management-customer-material-registration:create",
        "kuaizhizao:warehouse-management-customer-material-registration:update",
    ),
    "sales_delivery_attachments": (
        "kuaizhizao:outbound:create",
        "kuaizhizao:outbound:update",
    ),
    "other_outbound_attachments": (
        "kuaizhizao:other-outbound:create",
        "kuaizhizao:other-outbound:update",
    ),
    "material_borrow_attachments": (
        "kuaizhizao:material-borrow:create",
        "kuaizhizao:material-borrow:update",
    ),
    "delivery_notice_attachments": (
        "kuaizhizao:delivery-notice:create",
        "kuaizhizao:delivery-notice:update",
    ),
    "delivery_node_task_attachments": (
        "kuaizhizao:delivery-project:create",
        "kuaizhizao:delivery-project:update",
        "kuaizhizao:delivery-project:execute",
    ),
    "stocktaking_attachments": (
        "kuaizhizao:warehouse-management-stocktaking:create",
        "kuaizhizao:warehouse-management-stocktaking:update",
    ),
    "inventory_transfer_attachments": (
        "kuaizhizao:warehouse-management-inventory-transfer:create",
        "kuaizhizao:warehouse-management-inventory-transfer:update",
    ),
    "assembly_order_attachments": (
        "kuaizhizao:warehouse-management-assembly-orders:create",
        "kuaizhizao:warehouse-management-assembly-orders:update",
    ),
    "disassembly_order_attachments": (
        "kuaizhizao:warehouse-management-disassembly-orders:create",
        "kuaizhizao:warehouse-management-disassembly-orders:update",
    ),
    "inventory_alert_rule_attachments": (
        "kuaizhizao:warehouse-management-inventory-alert:create",
        "kuaizhizao:warehouse-management-inventory-alert:update",
    ),
    "barcode_mapping_rule_attachments": (
        "kuaizhizao:warehouse-management-barcode-mapping-rules:create",
        "kuaizhizao:warehouse-management-barcode-mapping-rules:update",
    ),
    # kuaicaiwu — 财务管理
    "receivable_attachments": (
        "kuaicaiwu:receivable:create",
        "kuaicaiwu:receivable:update",
    ),
    "receipt_attachments": (
        "kuaicaiwu:receipt:create",
        "kuaicaiwu:receipt:update",
    ),
    "payable_attachments": (
        "kuaicaiwu:payable:create",
        "kuaicaiwu:payable:update",
    ),
    "payment_attachments": (
        "kuaicaiwu:payment:create",
        "kuaicaiwu:payment:update",
    ),
    "sales_invoice_attachments": (
        "kuaicaiwu:sales-invoice:create",
        "kuaicaiwu:sales-invoice:update",
    ),
    "purchase_invoice_attachments": (
        "kuaicaiwu:purchase-invoice:create",
        "kuaicaiwu:purchase-invoice:update",
    ),
    "partner_statement_attachments": (
        "kuaicaiwu:partner-statement:create",
        "kuaicaiwu:partner-statement:update",
    ),
    "bank_account_attachments": (
        "kuaicaiwu:bank-account:create",
        "kuaicaiwu:bank-account:update",
    ),
    "gl_voucher_attachments": (
        "kuaicaiwu:gl:create",
        "kuaicaiwu:gl:update",
    ),
    "haolisales-attachment": (
        "haoligo:order-tracking:create",
        "haoligo:order-tracking:update",
        "haoligo:monthly-factory-ledger:create",
        "haoligo:monthly-factory-ledger:update",
    ),
    # kuaiplm — 项目文档 / 实验（与 PC 上传 category 一致）
    "product_firmware": (
        "kuaiplm:product-firmware:create",
        "kuaiplm:product-firmware:update",
    ),
    "production_file": (
        "kuaiplm:production-file:create",
        "kuaiplm:production-file:update",
    ),
    "rd_deliverable": (
        "kuaiplm:project:create",
        "kuaiplm:project:update",
    ),
    "sample_process": (
        "kuaiplm:sample-process:create",
        "kuaiplm:sample-process:update",
    ),
    "mold_sample_order": (
        "kuaiplm:mold-sample:create",
        "kuaiplm:mold-sample:update",
    ),
    "lab-report": (
        "kuaiplm:lab-request:create",
        "kuaiplm:lab-request:update",
    ),
    "lab-request-attachment": (
        "kuaiplm:lab-request:create",
        "kuaiplm:lab-request:update",
    ),
}


def business_upload_permission_codes(category: str | None) -> list[str] | None:
    """返回 category 对应的业务写权限码；未登记则 None（须走 system.file:create）。"""
    key = (category or "").strip()
    if not key:
        return None
    perms = BUSINESS_FILE_UPLOAD_PERMISSIONS.get(key)
    if not perms:
        return None
    return list(perms)
