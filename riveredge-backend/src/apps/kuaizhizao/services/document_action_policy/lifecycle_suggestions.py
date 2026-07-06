"""由 capabilities 派生 lifecycle next_step_suggestions（document-action-contract 唯一路径）。"""

from __future__ import annotations

from typing import Any, List, Optional

from apps.kuaizhizao.services.document_action_policy.purchase_inquiry import (
    PurchaseInquiryCapabilities,
)
from apps.kuaizhizao.services.document_action_policy.purchase_order import (
    PurchaseOrderCapabilities,
)
from apps.kuaizhizao.services.document_action_policy.purchase_requisition import (
    PurchaseRequisitionCapabilities,
)
from apps.kuaizhizao.services.document_action_policy.quality_inspection_record import (
    QualityInspectionCapabilities,
)
from apps.kuaizhizao.services.document_action_policy.sales_contract import (
    SalesContractCapabilities,
)
from apps.kuaizhizao.services.document_action_policy.sales_forecast import (
    SalesForecastCapabilities,
)
from apps.kuaizhizao.services.document_action_policy.sales_order import (
    SalesOrderCapabilities,
)
from apps.kuaizhizao.services.document_action_policy.sales_order_change import (
    SalesOrderChangeCapabilities,
)
from apps.kuaizhizao.services.document_action_policy.sales_return import (
    SalesReturnCapabilities,
)
from apps.kuaizhizao.services.document_action_policy.shipment_notice import (
    ShipmentNoticeCapabilities,
)
from apps.kuaizhizao.services.document_action_policy.types import ActionCapability


def _append_if_allowed(
    suggestions: List[str],
    cap: ActionCapability,
    label: str,
) -> None:
    if cap.allowed and label not in suggestions:
        suggestions.append(label)


def sales_order_capabilities_to_suggestions(
    caps: SalesOrderCapabilities,
    *,
    current_stage_key: Optional[str] = None,
    exec_active_key: Optional[str] = None,
) -> List[str]:
    suggestions: List[str] = []
    _append_if_allowed(suggestions, caps.submit, "提交审核")
    _append_if_allowed(suggestions, caps.approve, "审核通过")
    if caps.approve.allowed:
        suggestions.append("驳回")
    _append_if_allowed(suggestions, caps.withdraw_submit, "撤回提交")
    _append_if_allowed(suggestions, caps.revoke_approval, "反审核")
    _append_if_allowed(suggestions, caps.push_computation, "下推需求计算")
    _append_if_allowed(suggestions, caps.push_work_order, "建立工单")
    _append_if_allowed(suggestions, caps.push_shipment_notice, "下推发货通知")
    _append_if_allowed(suggestions, caps.push_sales_delivery, "销售交货")
    _append_if_allowed(suggestions, caps.push_invoice, "下推销售发票")
    _append_if_allowed(suggestions, caps.create_change_order, "创建变更单")

    if current_stage_key == "executing" and exec_active_key and not suggestions:
        exec_map = {
            "bom_check": ["完成 BOM 检查"],
            "demand_compute": ["执行需求计算（MRP）"],
            "work_order_released": ["下达工单"],
            "shipment_waiting": ["准备出库"],
            "delivered": ["销售交货"],
        }
        return exec_map.get(exec_active_key, ["推进执行进度"])

    if current_stage_key == "effective" and caps.push_computation.allowed:
        return ["前往需求计算执行 MRP", "建立工单"]

    if current_stage_key in ("invoicing",) and caps.push_invoice.allowed:
        out = []
        _append_if_allowed(out, caps.push_invoice, "下推销售发票")
        if not out:
            out.append("登记收款与对账")
        return out

    if current_stage_key == "pending_review" and caps.approve.allowed:
        return ["审核通过", "驳回"]

    if caps.update.allowed and current_stage_key == "pending_review":
        return ["修改订单后重新提交审核"]

    return suggestions


def purchase_order_capabilities_to_suggestions(
    caps: PurchaseOrderCapabilities,
    *,
    current_stage_key: Optional[str] = None,
) -> List[str]:
    suggestions: List[str] = []
    _append_if_allowed(suggestions, caps.submit, "提交审核")
    _append_if_allowed(suggestions, caps.approve, "审核通过")
    if caps.approve.allowed:
        suggestions.append("驳回")
    _append_if_allowed(suggestions, caps.push_receipt_notice, "下推收货通知")

    if current_stage_key == "pending_review" and caps.approve.allowed:
        return ["审核通过", "驳回"]
    if caps.update.allowed and current_stage_key == "pending_review":
        return ["修改后重新提交审核"]
    if current_stage_key == "audited" and not suggestions:
        return ["确认订单", "下推收货通知"]
    if current_stage_key == "confirmed" and caps.push_receipt_notice.allowed:
        return ["下推收货通知", "下推采购入库"]
    return suggestions


def sales_forecast_capabilities_to_suggestions(
    caps: SalesForecastCapabilities,
    *,
    current_stage_key: Optional[str] = None,
) -> List[str]:
    suggestions: List[str] = []
    _append_if_allowed(suggestions, caps.submit, "提交审核")
    _append_if_allowed(suggestions, caps.approve, "审核通过")
    if caps.approve.allowed:
        suggestions.append("驳回")
    _append_if_allowed(suggestions, caps.withdraw_submit, "撤回提交（回到草稿）")
    _append_if_allowed(suggestions, caps.revoke_approval, "反审核")
    _append_if_allowed(suggestions, caps.push_computation, "下推需求计算")

    if current_stage_key == "pending_review" and caps.approve.allowed:
        return ["审核通过", "驳回", "撤回提交（回到草稿）"]
    if caps.update.allowed and current_stage_key == "pending_review":
        return ["修改预测后重新提交审核"]
    return suggestions


def sales_contract_capabilities_to_suggestions(caps: SalesContractCapabilities) -> List[str]:
    """由 capabilities 派生 lifecycle next_step_suggestions（不含审核动作，审核见 audit 列）。"""
    suggestions: List[str] = []
    _append_if_allowed(suggestions, caps.push_to_sales_order, "下推销售订单")
    _append_if_allowed(suggestions, caps.create_change, "登记变更")
    _append_if_allowed(suggestions, caps.close, "关闭合同")
    return suggestions


def sales_order_change_capabilities_to_suggestions(
    caps: SalesOrderChangeCapabilities,
    *,
    current_stage_key: Optional[str] = None,
) -> List[str]:
    suggestions: List[str] = []
    _append_if_allowed(suggestions, caps.submit, "提交审核")
    _append_if_allowed(suggestions, caps.approve, "审核通过")
    if caps.approve.allowed:
        suggestions.append("驳回")
    _append_if_allowed(suggestions, caps.apply, "生效回写")
    if current_stage_key == "draft":
        return suggestions or ["提交审核"]
    return suggestions


def shipment_notice_capabilities_to_suggestions(
    caps: ShipmentNoticeCapabilities,
    *,
    current_stage_key: Optional[str] = None,
) -> List[str]:
    suggestions: List[str] = []
    _append_if_allowed(suggestions, caps.notify, "通知仓库")
    _append_if_allowed(suggestions, caps.update, "编辑通知明细")
    _append_if_allowed(suggestions, caps.withdraw, "撤回通知（回到待发货）")
    if current_stage_key == "pending_ship" and not suggestions:
        return ["通知仓库", "编辑通知明细"]
    if current_stage_key == "notified" and not suggestions:
        return ["撤回通知（回到待发货）", "执行出库"]
    return suggestions


def sales_return_capabilities_to_suggestions(
    caps: SalesReturnCapabilities,
    *,
    current_stage_key: Optional[str] = None,
) -> List[str]:
    suggestions: List[str] = []
    _append_if_allowed(suggestions, caps.confirm, "确认退货")
    _append_if_allowed(suggestions, caps.withdraw, "撤回确认（回到待退货）")
    if current_stage_key == "pending_return_goods":
        return suggestions or ["确认退货"]
    return suggestions


def purchase_inquiry_capabilities_to_suggestions(
    caps: PurchaseInquiryCapabilities,
    *,
    current_stage_key: Optional[str] = None,
) -> List[str]:
    suggestions: List[str] = []
    _append_if_allowed(suggestions, caps.submit, "提交审核")
    _append_if_allowed(suggestions, caps.approve, "审核通过")
    if caps.approve.allowed:
        suggestions.append("审核驳回")
    _append_if_allowed(suggestions, caps.withdraw_submit, "撤回提交")

    stage_defaults = {
        "draft": ["发布询价"],
        "quoting": ["录入报价", "截止询价"],
        "pending_compare": ["比价定标"],
        "awarded": ["转采购订单"],
    }
    if suggestions:
        return suggestions
    if current_stage_key:
        return stage_defaults.get(current_stage_key, [])
    _append_if_allowed(suggestions, caps.push_purchase_order, "转采购订单")
    return suggestions


def purchase_requisition_capabilities_to_suggestions(
    caps: PurchaseRequisitionCapabilities,
) -> List[str]:
    suggestions: List[str] = []
    _append_if_allowed(suggestions, caps.submit, "提交审核")
    _append_if_allowed(suggestions, caps.approve, "审核通过")
    if caps.approve.allowed:
        suggestions.append("驳回")
    if caps.approve.allowed or caps.revoke_approval.allowed:
        pass
    if not suggestions and caps.revoke_approval.allowed:
        suggestions.append("下推采购订单")
    _append_if_allowed(suggestions, caps.push_purchase_order, "下推采购订单")
    _append_if_allowed(suggestions, caps.push_inquiry, "下推询价单")
    return suggestions


def quality_inspection_capabilities_to_suggestions(
    caps: QualityInspectionCapabilities,
    *,
    current_stage_key: Optional[str] = None,
) -> List[str]:
    suggestions: List[str] = []
    _append_if_allowed(suggestions, caps.conduct, "执行检验")
    _append_if_allowed(suggestions, caps.approve, "审核通过")
    if caps.approve.allowed:
        suggestions.append("审核驳回")
    if current_stage_key == "pending":
        return suggestions or ["执行检验"]
    if current_stage_key == "pending_review" and caps.approve.allowed:
        return ["审核通过", "审核驳回"]
    if caps.update.allowed and current_stage_key == "pending_review":
        return ["修改并重新提交"]
    return suggestions
