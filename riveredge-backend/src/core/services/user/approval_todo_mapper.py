"""将工作流审批任务映射为工作台待办项。"""

from __future__ import annotations

from datetime import datetime
from typing import Any, Dict, List, Optional

from core.models.approval_task import ApprovalTask
from core.services.approval.approval_instance_service import ApprovalInstanceService
from core.utils.timezone_utils import resolve_business_datetime

# entity_type → 列表页路径（无 id 深链时仍便于定位单据）
ENTITY_LIST_PATH: dict[str, str] = {
    "sales_order": "/apps/kuaizhizao/sales-management/sales-orders",
    "sales_order_change": "/apps/kuaizhizao/sales-management/sales-order-changes",
    "sales_forecast": "/apps/kuaizhizao/sales-management/sales-forecasts",
    "sales_contract": "/apps/kuaizhizao/sales-management/sales-contracts",
    "quotation": "/apps/kuaizhizao/sales-management/quotations",
    "shipment_notice": "/apps/kuaizhizao/sales-management/shipment-notices",
    "sales_delivery": "/apps/kuaizhizao/warehouse-management/outbound?outbound_type=sales_delivery",
    "freight_bill": "/apps/kuaizhizao/logistics-management/freight-bills",
    "sales_return": "/apps/kuaizhizao/sales-management/sales-returns",
    "sales_contract_change": "/apps/kuaizhizao/sales-management/sales-contract-changes",
    "demand": "/apps/kuaizhizao/plan-management/demand-management",
    "purchase_order": "/apps/kuaizhizao/purchase-management/purchase-orders",
    "purchase_order_change": "/apps/kuaizhizao/purchase-management/purchase-order-changes",
    "purchase_request": "/apps/kuaizhizao/purchase-management/purchase-requisitions",
    "purchase_inquiry": "/apps/kuaizhizao/purchase-management/purchase-inquiries",
    "reporting_record": "/apps/kuaizhizao/production-execution/reporting-records",
    "production_picking": "/apps/kuaizhizao/warehouse-management/outbound?outbound_type=production_picking",
    "incoming_inspection": "/apps/kuaizhizao/quality-management/incoming-inspection",
    "process_inspection": "/apps/kuaizhizao/quality-management/process-inspection",
    "finished_goods_inspection": "/apps/kuaizhizao/quality-management/finished-goods-inspection",
    "oqc_inspection": "/apps/kuaizhizao/quality-management/oqc-inspection",
    "payable": "/apps/kuaicaiwu/finance-management/payables",
    "receivable": "/apps/kuaicaiwu/finance-management/receivables",
    "purchase_invoice": "/apps/kuaicaiwu/finance-management/purchase-invoices",
    "kuaioa_form_request": "/apps/kuaioa/approval/form-requests",
    "kuaioa_asset_purchase": "/apps/kuaioa/assets/purchases",
    "kuaioa_leave": "/apps/kuaioa/hr/leave",
    "kuaioa_seal": "/apps/kuaioa/admin/seal",
    "kuaioa_special_price": "/apps/kuaioa/collaboration/special-price",
    "kuaioa_concession": "/apps/kuaioa/collaboration/concession",
    "kuaioa_process_deviation": "/apps/kuaioa/collaboration/process-deviation",
}

# entity_type → 模块中心 module 参数（与 dashboards.MODULE_TODO_ID_PREFIXES 对齐）
ENTITY_MODULE: dict[str, str] = {
    "sales_order": "sales",
    "sales_order_change": "sales",
    "sales_forecast": "sales",
    "sales_contract": "sales",
    "quotation": "sales",
    "shipment_notice": "sales",
    "sales_delivery": "sales",
    "freight_bill": "sales",
    "sales_return": "sales",
    "sales_contract_change": "sales",
    "purchase_order": "purchase",
    "purchase_order_change": "purchase",
    "purchase_request": "purchase",
    "purchase_inquiry": "purchase",
    "demand": "manufacturing",
    "reporting_record": "manufacturing",
    "production_picking": "manufacturing",
    "incoming_inspection": "quality",
    "process_inspection": "quality",
    "finished_goods_inspection": "quality",
    "oqc_inspection": "quality",
    "payable": "finance",
    "receivable": "finance",
    "purchase_invoice": "finance",
}

# entity_type → 首页待办 Tab type
ENTITY_TODO_TYPE: dict[str, str] = {
    **{k: "sales" for k in ENTITY_MODULE if ENTITY_MODULE[k] == "sales"},
    **{k: "purchase" for k in ENTITY_MODULE if ENTITY_MODULE[k] == "purchase"},
    "demand": "exception",
    "reporting_record": "work_order",
    "incoming_inspection": "quality_inspection",
    "process_inspection": "quality_inspection",
    "finished_goods_inspection": "quality_inspection",
    "oqc_inspection": "quality_inspection",
    "payable": "approval",
    "receivable": "approval",
    "purchase_invoice": "approval",
}


def build_approval_entity_link(entity_type: Optional[str], entity_id: Optional[int]) -> str:
    key = (entity_type or "").strip()
    base = ENTITY_LIST_PATH.get(key)
    if base and entity_id:
        sep = "&" if "?" in base else "?"
        return f"{base}{sep}id={entity_id}"
    if base:
        return base
    return "/personal/tasks"


def approval_task_matches_module(entity_type: Optional[str], module: str) -> bool:
    mod = (module or "").strip().lower()
    if not mod:
        return True
    return ENTITY_MODULE.get((entity_type or "").strip()) == mod


async def fetch_user_approval_todos(
    tenant_id: int,
    user_id: int,
    *,
    limit: int = 20,
) -> List[dict[str, Any]]:
    """查询当前用户待审批任务并转为 TodoItem 字段 dict。"""
    await ApprovalInstanceService.reconcile_orphaned_approval_tasks(
        tenant_id, user_id
    )
    tasks = (
        await ApprovalTask.filter(
            tenant_id=tenant_id,
            approver_id=user_id,
            status="pending",
        )
        .prefetch_related("approval_instance__process")
        .order_by("-created_at")
        .limit(limit)
    )
    if not tasks:
        return []

    submitter_ids = [
        int(inst.submitter_id)
        for task in tasks
        if (inst := task.approval_instance) and inst.submitter_id
    ]
    name_map = await ApprovalInstanceService._user_display_map(tenant_id, submitter_ids)

    items: List[dict[str, Any]] = []
    for task in tasks:
        inst = task.approval_instance
        if not inst:
            continue
        data = inst.data if isinstance(inst.data, dict) else {}
        if data.get("is_personal"):
            continue

        entity_type = str(data.get("entity_type") or "").strip()
        entity_id_raw = data.get("entity_id")
        entity_id: Optional[int] = None
        if entity_id_raw is not None:
            try:
                entity_id = int(entity_id_raw)
            except (TypeError, ValueError):
                entity_id = None

        submitter_name = None
        if inst.submitter_id:
            submitter_name = name_map.get(int(inst.submitter_id))

        title = (inst.title or "").strip() or "审批待办"
        content = (inst.content or "").strip()
        todo_type = ENTITY_TODO_TYPE.get(entity_type, "approval")
        created_at = task.created_at or inst.created_at or resolve_business_datetime()

        meta: dict[str, str] = {}
        if entity_type:
            meta["entity_type"] = entity_type
        if entity_id is not None:
            meta["entity_id"] = str(entity_id)
        if submitter_name:
            meta["submitter_name"] = submitter_name
        doc_code = data.get("order_code") or data.get("document_code") or data.get("code")
        if doc_code:
            meta["document_code"] = str(doc_code).strip()

        items.append(
            {
                "id": f"approval_task_{task.id}",
                "type": todo_type,
                "title": title,
                "description": content or None,
                "meta": meta or None,
                "priority": "high",
                "due_date": inst.remind_at,
                "status": "pending",
                "link": build_approval_entity_link(entity_type, entity_id),
                "created_at": created_at,
            }
        )
    return items
