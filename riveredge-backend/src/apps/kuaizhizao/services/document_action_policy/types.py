"""单据业务态 capabilities 类型（不含 RBAC）。"""

from __future__ import annotations

from typing import Optional

from pydantic import BaseModel, Field


class ActionCapability(BaseModel):
    allowed: bool = Field(..., description="当前业务态是否允许该动作")
    reason: Optional[str] = Field(
        None,
        description="不允许时的稳定原因码（前端 i18n key 或后端默认文案）",
    )


class QuotationCapabilities(BaseModel):
    update: ActionCapability
    delete: ActionCapability
    submit: ActionCapability
    withdraw_submit: ActionCapability
    approve: ActionCapability
    revoke_approval: ActionCapability
    confirm_customer: ActionCapability
    cancel_customer_confirm: ActionCapability
    convert_to_order: ActionCapability
    convert_to_contract: ActionCapability
    revoke_push: ActionCapability
    reopen: ActionCapability
    create_revision: ActionCapability
    print_formal: ActionCapability


class SalesOrderCapabilities(BaseModel):
    update: ActionCapability
    delete: ActionCapability
    submit: ActionCapability
    approve: ActionCapability
    close: ActionCapability
    print: ActionCapability
    withdraw_submit: ActionCapability
    revoke_approval: ActionCapability
    push_computation: ActionCapability
    withdraw_computation: ActionCapability
    push_work_order: ActionCapability
    push_shipment_notice: ActionCapability
    push_sales_delivery: ActionCapability
    push_invoice: ActionCapability
    push_sales_return: ActionCapability
    create_change_order: ActionCapability


class SalesOrderChangeCapabilities(BaseModel):
    update: ActionCapability
    delete: ActionCapability
    submit: ActionCapability
    withdraw_submit: ActionCapability
    approve: ActionCapability
    apply: ActionCapability
    preview_impact: ActionCapability
    print: ActionCapability
    reopen: ActionCapability


class SalesContractCapabilities(BaseModel):
    update: ActionCapability
    delete: ActionCapability
    submit: ActionCapability
    withdraw_submit: ActionCapability
    approve: ActionCapability
    reject: ActionCapability
    revoke_approval: ActionCapability
    push_to_sales_order: ActionCapability
    push_to_work_order: ActionCapability
    print: ActionCapability
    close: ActionCapability
    create_change: ActionCapability


class SalesForecastCapabilities(BaseModel):
    update: ActionCapability
    delete: ActionCapability
    submit: ActionCapability
    withdraw_submit: ActionCapability
    approve: ActionCapability
    reject: ActionCapability
    revoke_approval: ActionCapability
    print: ActionCapability
    push_computation: ActionCapability


class ShipmentNoticeCapabilities(BaseModel):
    update: ActionCapability
    delete: ActionCapability
    notify: ActionCapability
    withdraw: ActionCapability
    print: ActionCapability


class SalesReturnCapabilities(BaseModel):
    update: ActionCapability
    delete: ActionCapability
    confirm: ActionCapability
    withdraw: ActionCapability
    print: ActionCapability


class ProductionPlanCapabilities(BaseModel):
    update: ActionCapability
    delete: ActionCapability
    submit: ActionCapability
    withdraw_submit: ActionCapability
    approve: ActionCapability
    revoke_approval: ActionCapability
    execute: ActionCapability
    push_work_order: ActionCapability


class DemandComputationCapabilities(BaseModel):
    execute: ActionCapability
    recompute: ActionCapability
    compare: ActionCapability
    export: ActionCapability


class DemandCapabilities(BaseModel):
    merge_computation: ActionCapability


class PurchaseRequisitionCapabilities(BaseModel):
    update: ActionCapability
    delete: ActionCapability
    submit: ActionCapability
    approve: ActionCapability
    revoke_approval: ActionCapability


class PurchaseInquiryCapabilities(BaseModel):
    update: ActionCapability
    delete: ActionCapability
    submit: ActionCapability
    withdraw_submit: ActionCapability
    approve: ActionCapability
    revoke_approval: ActionCapability


class PurchaseOrderCapabilities(BaseModel):
    update: ActionCapability
    delete: ActionCapability
    submit: ActionCapability
    withdraw_submit: ActionCapability
    approve: ActionCapability
    revoke_approval: ActionCapability
    push_receipt_notice: ActionCapability
    print: ActionCapability


class PurchaseOrderChangeCapabilities(BaseModel):
    update: ActionCapability
    delete: ActionCapability
    submit: ActionCapability
    withdraw_submit: ActionCapability
    approve: ActionCapability
    apply: ActionCapability
    preview_impact: ActionCapability
    print: ActionCapability
    reopen: ActionCapability


class ReceiptNoticeCapabilities(BaseModel):
    update: ActionCapability
    delete: ActionCapability
    notify: ActionCapability
    withdraw: ActionCapability
    print: ActionCapability


class PurchaseReturnCapabilities(BaseModel):
    update: ActionCapability
    delete: ActionCapability
    confirm: ActionCapability
    withdraw: ActionCapability
    print: ActionCapability


class WorkOrderCapabilities(BaseModel):
    update: ActionCapability
    delete: ActionCapability
    release: ActionCapability
    freeze: ActionCapability
    unfreeze: ActionCapability
    cancel: ActionCapability
    set_priority: ActionCapability
    print: ActionCapability


class ReportingRecordCapabilities(BaseModel):
    update: ActionCapability
    delete: ActionCapability
    approve: ActionCapability
    revoke_approval: ActionCapability
    print: ActionCapability


class ExceptionProcessRecordCapabilities(BaseModel):
    cancel: ActionCapability
    print: ActionCapability


class PackingBindingCapabilities(BaseModel):
    update: ActionCapability
    delete: ActionCapability
    print: ActionCapability


class InboundHubCapabilities(BaseModel):
    confirm: ActionCapability
    print: ActionCapability


class OutboundHubCapabilities(BaseModel):
    confirm: ActionCapability
    withdraw: ActionCapability
    print: ActionCapability


class CustomerMaterialRegistrationCapabilities(BaseModel):
    confirm: ActionCapability
    withdraw: ActionCapability
    cancel: ActionCapability
    delete: ActionCapability
    print: ActionCapability


class InventoryAlertCapabilities(BaseModel):
    resolve: ActionCapability
    ignore: ActionCapability
    print: ActionCapability


class ReplenishmentSuggestionCapabilities(BaseModel):
    process: ActionCapability
    ignore: ActionCapability
    print: ActionCapability


class QualityInspectionCapabilities(BaseModel):
    conduct: ActionCapability
    approve: ActionCapability
    reject: ActionCapability
    create_defect: ActionCapability
    push_purchase_return: ActionCapability
    update: ActionCapability
    print: ActionCapability


class OQCInspectionCapabilities(BaseModel):
    conduct: ActionCapability
    approve: ActionCapability
    reject: ActionCapability
    revoke_approval: ActionCapability
    delete: ActionCapability
    print: ActionCapability


class EightDReportCapabilities(BaseModel):
    update: ActionCapability
    delete: ActionCapability
    transition: ActionCapability
    close: ActionCapability
    print: ActionCapability


class NonconformingLedgerCapabilities(BaseModel):
    update_disposition: ActionCapability
    start_8d: ActionCapability
    print: ActionCapability


# 稳定原因码 → 默认中文（API 错误与日志）
CAPABILITY_REASON_MESSAGES: dict[str, str] = {
    "quotation.delete.not_allowed": "只能删除草稿、已驳回或待审核状态的报价单",
    "quotation.delete.linked_sales_order": "已关联有效销售订单的报价单不能删除",
    "quotation.delete.linked_contract": "已关联销售合同的报价单不能删除",
    "quotation.update.not_draft": "只能更新草稿状态的报价单",
    "quotation.withdraw_submit.not_pending": "仅待审核的报价单可撤回提交",
    "quotation.approve.not_pending": "仅待审核的报价单可审核通过",
    "quotation.revoke_approval.not_allowed": "当前状态不可撤回审核",
    "quotation.revoke_approval.not_approved": "仅已审核通过的报价单可撤回审核",
    "quotation.confirm.not_sent": "仅已发送状态的报价单可客户确认",
    "quotation.confirm.not_approved": "请先完成审核通过后再标记客户确认",
    "quotation.cancel_customer_confirm.not_allowed": "当前状态不可取消客户确认",
    "quotation.cancel_customer_confirm.linked_contract": "已关联有效销售合同，请先处理合同后再取消确认",
    "quotation.convert_order.not_allowed": "当前状态不可转销售订单",
    "quotation.convert_order.linked_contract": "该报价已关联销售合同，请从销售合同下推订单",
    "quotation.convert_order.not_latest": "仅能对当前系列的最新版本报价单转销售订单",
    "quotation.convert_order.already_converted": "该报价单已转为销售订单",
    "quotation.convert_contract.not_allowed": "当前状态不可转销售合同",
    "quotation.convert_contract.linked_contract": "该报价单已关联销售合同",
    "quotation.convert_contract.linked_sales_order": "该报价单已关联销售订单",
    "quotation.convert_contract.superseded": "此为历史版本报价单，请使用系列最新版",
    "quotation.revoke_push.not_allowed": "仅已转订单且下游销售订单已删除时可撤回下推",
    "quotation.reopen.not_rejected": "仅已驳回的报价单可重新编辑",
    "quotation.revision.not_allowed": "仅非草稿的最新系列版本可新建修订版",
    "quotation.print.not_allowed": "正式报价 PDF 须在审核通过、客户确认或已转单后生成",
    "sales_order.update.not_allowed": "只能更新草稿或待审核的销售订单",
    "sales_order.update.locked": "销售订单已生效或执行中，禁止直接修改，请通过销售变更单变更",
    "sales_order.delete.not_allowed": "只能删除草稿或待审核状态的订单",
    "sales_order.submit.not_draft": "只能提交草稿状态的订单",
    "sales_order.close.not_allowed": "当前状态不可关闭订单",
    "sales_order.close.already_closed": "订单已关闭",
    "sales_order.close.cancelled": "已取消的订单不能关闭",
    "sales_order.close.completed": "已完成的订单无需关闭",
    "sales_order.close.draft_use_delete": "草稿订单请使用删除，不能关闭",
    "sales_order.close.pending_review": "待审核订单不能关闭，请先撤回或完成审核",
    "sales_order.close.rejected": "已驳回订单不能关闭",
    "sales_order.close.not_approved": "只有已审核通过的订单才能关闭",
    "sales_order.withdraw_submit.not_allowed": "只能撤回已提交且未审核的订单（待审核或已生效）",
    "sales_order.withdraw_submit.computation_pushed": "订单已下推需求计算，请先在「下推」菜单中撤回计算后再撤回提交",
    "sales_order.approve.not_pending": "只有待审核状态的订单可审核",
    "sales_order.revoke_approval.not_allowed": "当前状态不可撤销审核（仅已审核/已生效且审核通过，或已驳回时可撤销）",
    "sales_order.push.requires_approved": "只能下推已审核的销售订单",
    "sales_order.push.closed": "订单已关闭，无法继续执行",
    "sales_order.push.cancelled": "订单已取消，无法继续执行",
    "sales_order.push.completed": "订单已完成，无法继续执行",
    "sales_order.push.no_items": "销售订单无明细，无法下推",
    "sales_order.push_computation.not_allowed": "当前状态不可下推需求计算",
    "sales_order.push_computation.already_pushed": "已下推需求计算",
    "sales_order.push_computation.line_work_orders": "明细已挂工单，与需求计算下推互斥",
    "sales_order.withdraw_computation.not_allowed": "当前状态不可撤回需求计算",
    "sales_order.push_work_order.not_allowed": "当前状态不可直推工单",
    "sales_order.push_work_order.no_items": "销售订单无明细，无法直推工单",
    "sales_order.push_shipment.not_allowed": "当前状态不可下推发货通知单",
    "sales_order.push_delivery.not_allowed": "当前状态不可下推销售出库",
    "sales_order.push_invoice.not_allowed": "当前状态不可下推销售发票",
    "sales_order.push_return.not_allowed": "当前状态不可下推销售退货单",
    "sales_order.push_return.no_delivered": "销售订单暂无可退货数量（已交货数量为 0）",
    "sales_order.create_change.not_allowed": "当前状态不可新建销售变更单",
    "sales_order_change.update.not_draft": "仅草稿或待审核状态可编辑变更单",
    "sales_order_change.delete.not_draft": "仅草稿状态可删除",
    "sales_order_change.submit.not_draft": "仅草稿可提交",
    "sales_order_change.submit.no_changes": "变更单无任何变更内容，无法提交",
    "sales_order_change.withdraw_submit.not_pending": "仅待审核状态可撤回",
    "sales_order_change.approve.not_pending": "仅待审核状态可审批",
    "sales_order_change.apply.not_audited": "变更单未审核通过，无法生效",
    "sales_order_change.reopen.not_rejected": "仅已驳回的变更单可重新编辑",
    "sales_contract.update.not_draft": "仅草稿或待审核状态合同可编辑",
    "sales_contract.delete.not_draft": "仅草稿或待审核状态合同可删除",
    "sales_contract.submit.not_draft": "仅草稿状态可提交审核",
    "sales_contract.withdraw_submit.not_pending": "仅待审核合同可撤回提交",
    "sales_contract.approve.not_pending": "仅待审核合同可审批",
    "sales_contract.reject.not_pending": "仅待审核合同可驳回",
    "sales_contract.revoke_approval.not_effective": "仅已生效且未下推的合同可撤回审核",
    "sales_contract.revoke_approval.has_release": "合同已有释放记录，无法撤回审核",
    "sales_contract.revoke_approval.not_allowed": "当前状态不可撤回审核",
    "sales_contract.push.not_effective": "合同须已生效后方可下推销售订单",
    "sales_contract.push.not_approved": "合同未审核通过",
    "sales_contract.push.expired": "合同已过期，无法下推订单",
    "sales_contract.push.not_yet_valid": "合同尚未到生效日期",
    "sales_contract.push.no_items": "合同无明细",
    "sales_contract.push.no_remaining": "合同剩余额度不足",
    "sales_contract.push.no_releasable_items": "无可释放的合同明细",
    "sales_contract.print.not_allowed": "正式合同打印须在已生效、执行中或已关闭且审核通过后",
    "sales_contract.close.already_closed": "合同已关闭或已到期",
    "sales_contract.create_change.not_effective": "仅生效中合同可发起变更",
    "sales_forecast.update.not_allowed": "仅草稿、待审核或已驳回状态可编辑销售预测",
    "sales_forecast.delete.not_allowed": "仅草稿或待审核状态可删除销售预测",
    "sales_forecast.submit.not_draft": "只有草稿状态的销售预测才能提交",
    "sales_forecast.withdraw_submit.not_pending": "只有待审核状态的销售预测可撤回提交",
    "sales_forecast.approve.not_pending": "仅待审核销售预测可审批",
    "sales_forecast.reject.not_pending": "仅待审核销售预测可驳回",
    "sales_forecast.revoke_approval.not_audited": "仅已审核的销售预测支持撤回审核",
    "sales_forecast.revoke_approval.not_approved": "销售预测未审核通过，无法撤回审核",
    "sales_forecast.revoke_approval.has_downstream": "该销售预测已下推下游单据，不能撤回审核",
    "sales_forecast.push.not_approved": "只有已审核通过的销售预测才能下推到需求计算",
    "sales_forecast.push.already_pushed": "已下推需求计算",
    "sales_forecast.push.rejected": "已驳回的销售预测不能下推",
    "sales_forecast.push.cancelled": "已取消的销售预测不能下推",
    "sales_forecast.push.completed": "已完成的销售预测不能下推",
    "sales_forecast.push.no_items": "销售预测无明细，无法下推",
    "shipment_notice.update.not_pending": "只能更新待发货状态的发货通知单",
    "shipment_notice.delete.not_pending": "只能删除待发货状态的发货通知单",
    "shipment_notice.notify.not_pending": "只有待发货状态的通知单才能通知仓库",
    "shipment_notice.notify.no_warehouse": "发货通知单缺少仓库，无法通知仓库",
    "shipment_notice.notify.no_items": "发货通知单无明细，无法通知仓库",
    "shipment_notice.withdraw.not_notified": "只有已通知状态的发货通知单才能撤回",
    "shipment_notice.withdraw.delivery_processing": "关联的销售出库单已在处理中，无法撤回",
    "sales_return.update.not_editable": "仅「待退货」或「草稿」状态的销售退货单可编辑",
    "sales_return.delete.not_pending": "只有待退货状态的销售退货单才能删除",
    "sales_return.confirm.not_pending": "只有待退货状态的销售退货单才能确认退货",
    "sales_return.confirm.no_items": "销售退货单无明细，无法确认退货",
    "sales_return.confirm.already_returned": "销售退货单已确认退货",
    "sales_return.confirm.cancelled": "已取消的销售退货单不能确认退货",
    "sales_return.withdraw.not_returned": "只有已退货状态的销售退货单才能撤回",
    "production_plan.update.executed": "已执行的生产计划不允许修改",
    "production_plan.update.not_allowed": "当前状态不可修改生产计划",
    "production_plan.delete.executed": "已执行的生产计划不允许删除",
    "production_plan.submit.not_rejected": "只有已驳回状态的生产计划才能重新提交",
    "production_plan.withdraw_submit.not_pending": "只有待审核状态的生产计划可撤回提交",
    "production_plan.approve.not_pending": "只有待审核状态的生产计划可审核",
    "production_plan.revoke_approval.not_allowed": "当前状态不可撤回审核",
    "production_plan.execute.already_executed": "该生产计划已执行，请勿重复操作",
    "production_plan.execute.requires_approved": "当前配置要求生产计划审核通过后才能执行，请先审核计划",
    "production_plan.push_work_order.not_allowed": "当前状态不可下推工单",
    "production_plan.push_work_order.executed": "已执行的生产计划不可下推工单",
    "production_plan.push_work_order.no_items": "生产计划中无需要生产的明细，无法转工单",
    "production_plan.push_work_order.requires_approved": "生产计划须审核通过后方可下推工单",
    "demand_computation.execute.not_allowed": "只能执行进行中或失败状态的计算",
    "demand_computation.recompute.not_allowed": "只能对已完成或失败的计算执行重新计算",
    "demand_computation.compare.not_completed": "只能对比已完成的需求计算",
    "demand.merge_computation.not_audited": "只能对已审核通过的需求合并计算",
    "purchase_requisition.update.not_allowed": "当前状态不可编辑采购申请",
    "purchase_requisition.delete.not_allowed": "当前状态不可删除采购申请",
    "purchase_requisition.submit.not_draft": "只有草稿状态可提交",
    "purchase_requisition.approve.not_pending": "只有待审核状态的采购申请可审核",
    "purchase_requisition.revoke_approval.not_allowed": "只有已通过或转单状态的采购申请可撤回审核",
    "purchase_inquiry.update.not_draft": "只有草稿状态可编辑询价单",
    "purchase_inquiry.delete.not_draft": "只有草稿状态可删除询价单",
    "purchase_inquiry.submit.not_draft": "只有草稿状态可提交",
    "purchase_inquiry.withdraw_submit.not_pending": "只有已提交待审核的询价单可撤回",
    "purchase_inquiry.approve.not_pending": "只有待审核询价单可审批",
    "purchase_order.update.not_allowed": "只能更新草稿或待审核的采购订单",
    "purchase_order.delete.not_allowed": "只能删除草稿或待审核的采购订单",
    "purchase_order.submit.not_draft": "只能提交草稿状态的订单",
    "purchase_order.withdraw_submit.not_pending": "只有待审核状态的采购订单可撤回提交",
    "purchase_order.approve.not_pending": "只有待审核状态的采购订单可审核",
    "purchase_order.revoke_approval.not_allowed": "只能撤销审核已确认或已驳回的采购订单",
    "purchase_order.revoke_approval.has_downstream": "该采购订单已有下游单据或收货记录，不能撤销审核",
    "purchase_order.push_receipt.not_audited": "只有已审核或已确认的采购单才能下推到收货通知",
    "purchase_order.push_receipt.no_items": "采购单没有明细，无法生成收货通知单",
    "purchase_order.push_receipt.no_outstanding": "采购单已全部入库，无法生成收货通知单",
    "purchase_order_change.update.not_draft": "仅草稿或待审核状态可编辑变更单",
    "purchase_order_change.delete.not_draft": "仅草稿状态可删除",
    "purchase_order_change.submit.not_draft": "仅草稿可提交",
    "purchase_order_change.submit.no_changes": "变更单无任何变更内容，无法提交",
    "purchase_order_change.withdraw_submit.not_pending": "仅待审核状态可撤回",
    "purchase_order_change.approve.not_pending": "仅待审核状态可审批",
    "purchase_order_change.apply.not_audited": "变更单未审核通过，无法生效",
    "purchase_order_change.reopen.not_supported": "采购变更单不支持重新编辑",
    "receipt_notice.update.not_pending": "只能更新待收货状态的通知单",
    "receipt_notice.delete.not_pending": "只能删除待收货状态的通知单",
    "receipt_notice.notify.not_pending": "只有待收货状态的通知单才能通知仓库",
    "receipt_notice.notify.already_notified": "该收货通知单已关联采购入库单",
    "receipt_notice.notify.no_items": "收货通知单无明细，无法通知仓库",
    "receipt_notice.notify.no_warehouse": "收货通知单缺少仓库，无法通知仓库",
    "receipt_notice.withdraw.not_notified": "只有已通知状态的收货通知单才能撤回",
    "receipt_notice.withdraw.receipt_processing": "关联的采购入库单已在处理中，无法撤回",
    "purchase_return.update.not_pending": "只有待退货状态的采购退货单可编辑",
    "purchase_return.delete.not_pending": "只有待退货状态的采购退货单才能删除",
    "purchase_return.confirm.not_pending": "只有待退货状态的采购退货单才能确认退货",
    "purchase_return.confirm.no_items": "采购退货单无明细，无法确认退货",
    "purchase_return.confirm.already_returned": "采购退货单已确认退货",
    "purchase_return.confirm.cancelled": "已取消的采购退货单不能确认退货",
    "purchase_return.withdraw.not_returned": "只有已退货状态的采购退货单才能撤回",
    "work_order.not_applicable": "该行不是可操作的工单",
    "work_order.update.not_draft": "仅草稿状态工单可编辑",
    "work_order.delete.not_allowed": "当前状态不可删除工单",
    "work_order.release.not_draft": "只能下达草稿状态的工单",
    "work_order.release.frozen": "工单已冻结，不能下达",
    "work_order.release.split": "已拆分主工单不可下达",
    "work_order.freeze.already_frozen": "工单已冻结，不能重复冻结",
    "work_order.freeze.not_allowed": "当前状态不可冻结工单",
    "work_order.unfreeze.not_frozen": "工单未冻结，不能解冻",
    "work_order.cancel.not_allowed": "当前状态不可取消工单",
    "work_order.set_priority.not_allowed": "当前状态不可调整优先级",
    "reporting_record.update.not_pending": "仅待审核报工记录可编辑",
    "reporting_record.delete.not_pending": "仅待审核报工记录可删除",
    "reporting_record.approve.not_pending": "只有待审核状态的报工记录才可以审核",
    "reporting_record.revoke_approval.not_approved": "只有已审核通过的报工记录才可以撤回审核",
    "exception_process.cancel.already_finished": "该异常处理流程已结束，无法取消",
    "packing_binding.deleted": "装箱绑定记录已删除",
    "inbound_hub.confirm.not_pending": "当前状态不可确认入库",
    "inbound_hub.confirm.use_single_preview": "委外退料/退货请使用单行确认预览",
    "customer_material.confirm.not_pending": "仅待入库状态可确认入库",
    "customer_material.withdraw.not_processed": "仅已入库状态可撤回",
    "customer_material.cancel.not_pending": "仅待入库状态可取消",
    "customer_material.delete.not_pending": "仅待入库状态可删除",
    "outbound_hub.confirm.not_pending": "当前状态不可确认出库",
    "outbound_hub.confirm.outsource_issue": "委外发料不支持在此确认",
    "outbound_hub.withdraw.not_posted": "当前状态不可撤回出库",
    "outbound_hub.withdraw.outsource_issue": "委外发料不支持撤回",
    "inventory_alert.handle.already_handled": "该预警已处理，无法再次标记",
    "replenishment_suggestion.process.not_pending": "仅待处理状态的补货建议可处理",
    "quality_inspection.conduct.not_pending": "只有待检验状态的检验单才能执行检验",
    "quality_inspection.approve.not_pending": "检验单审核状态不是待审核",
    "quality_inspection.create_defect.not_allowed": "只有已检验且不合格的检验单才能登记不良",
    "quality_inspection.push_purchase_return.not_allowed": "只有不合格的来料检验单才能下推采购退货单",
    "quality_inspection.update.not_pending": "只能更新待检验状态的检验单",
    "oqc_inspection.conduct.not_pending": "只有待检验状态的出货检验单可执行检验",
    "oqc_inspection.approve.not_pending": "出货检验单当前不可审核",
    "oqc_inspection.revoke_approval.not_approved": "仅已审核通过的出货检验单可撤销审核",
    "oqc_inspection.delete.not_pending": "仅待检验状态的出货检验单可删除",
    "eight_d_report.update.closed": "已关闭的 8D 报告不可编辑",
    "eight_d_report.delete.closed": "已关闭的 8D 报告不可删除",
    "eight_d_report.transition.closed": "已关闭的 8D 报告不可推进阶段",
    "eight_d_report.transition.no_next": "当前阶段不可推进",
    "eight_d_report.transition.stage_incomplete": "推进前需先完善当前阶段内容",
    "eight_d_report.close.already_closed": "8D 报告已关闭",
    "eight_d_report.close.not_at_final_stage": "仅 D8 总结阶段可关闭报告",
    "eight_d_report.close.stage_incomplete": "关闭前需先完善 D8 总结内容",
    "nonconforming_ledger.update.closed": "已处理或已取消的台账不可更新处置",
    "nonconforming_ledger.start_8d.closed": "已处理或已取消的台账不可发起 8D",
    "nonconforming_ledger.start_8d.already_linked": "该台账已关联 8D 报告",
}
