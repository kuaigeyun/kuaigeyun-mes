"""
单据生命周期服务：由后端控制各单据类型的生命周期节点，前端仅展示。

每个单据类型（销售订单、需求等）在此单独配置其阶段列表；
根据单据当前数据计算当前阶段及各节点状态（done/active/pending），供前端 UniLifecycleStepper 展示。

审核可视化模式（与 docs/core/document-action-contract.md 一致）：
  A — 串行门禁：lifecycle 主轴仅业务态，审核由 record.audit + 列表「审核状态」列展示
  B — 正交叠加：lifecycle 主轴仅业务态，审核由 record.audit + AuditPhaseBadge 展示
  N — 无审核：纯执行/仓储流，lifecycle 不含审核节点
  C — 审核即全部生命周期（HaoliGO 模具 sheet_status，不在本模块）
"""

from typing import Any, Dict, List, Literal, Optional

LifecycleAuditMode = Literal["A", "B", "N"]

# 各单据 lifecycle 审核可视化模式（唯一分类真源）
LIFECYCLE_AUDIT_MODE: Dict[str, LifecycleAuditMode] = {
    "sales_order": "A",
    "sales_forecast": "A",
    "purchase_order": "A",
    "demand": "A",
    "sales_contract": "A",
    "sales_order_change": "A",
    "purchase_order_change": "A",
    "purchase_requisition": "A",
    "incoming_inspection": "A",
    "process_inspection": "A",
    "finished_goods_inspection": "A",
    "oqc_inspection": "A",
    "reporting_record": "A",
    "quotation": "B",
    "purchase_inquiry": "B",
    "shipment_notice": "A",
    "sales_delivery": "A",
    "sales_contract_change": "A",
    "purchase_receipt": "N",
    "work_order": "N",
    "sales_return": "N",
    "inbound": "N",
    "outbound": "N",
    "batching_order": "N",
    "inventory_transfer": "N",
    "stocktaking": "N",
    "material_borrow": "N",
    "material_return": "N",
    "other_inbound": "N",
    "other_outbound": "N",
    "assembly_order": "N",
    "disassembly_order": "N",
    "exception_process": "N",
    "equipment_fault": "N",
    "maintenance_plan": "N",
    "scrap_record": "N",
    "demand_computation": "N",
    "rework_order": "N",
    "outsource_work_order": "N",
    "outsource_order": "N",
}
from functools import wraps
from decimal import Decimal
from loguru import logger
from core.utils.timezone_utils import to_api_isoformat

from apps.kuaizhizao.constants import (
    DemandStatus,
    ReviewStatus,
    DocumentStatus,
    LEGACY_AUDITED_VALUES,
    LEGACY_PENDING_VALUES,
    normalize_status,
)


# ---------------------------------------------------------------------------
# 销售订单生命周期节点（业务主轴，不含审核；审核态由 record.audit 独立列展示）
# ---------------------------------------------------------------------------
SALES_ORDER_MAIN_STAGES = [
    {"key": "effective", "label": "已生效"},
    {"key": "executing", "label": "执行中"},
    {"key": "delivered", "label": "已交货"},
    {"key": "invoicing", "label": "账款发票处理"},
    {"key": "completed", "label": "已完成"},
]

_MODE_A_AUDIT_LABELS = frozenset({"草稿", "待审核", "已驳回", "已审核", "审核通过", "审核驳回"})


def _audit_entity_visual_stage_key(internal_key: str, *, pre_effective: str = "effective") -> str:
    """模式 A：审核相关 internal key 映射到审核前业务阶段（仅筛选用）。"""
    if internal_key in ("pending_review", "audited", "rejected", "draft"):
        return pre_effective
    return internal_key


def _mode_a_pre_effective_lifecycle(
    stage_defs: List[Dict[str, str]],
    next_step_suggestions: Optional[List[str]] = None,
    *,
    milestones: Optional[List[Dict[str, Any]]] = None,
    sub_stages: Optional[List[Dict[str, Any]]] = None,
    status: str = "normal",
) -> Dict[str, Any]:
    """模式 A：审核未入业务主轴前，当前阶段展示 —，审核态见 record.audit 列。"""
    return {
        "current_stage_key": "",
        "current_stage_name": "—",
        "status": status,
        "main_stages": [{"key": s["key"], "label": s["label"], "status": "pending"} for s in stage_defs],
        "sub_stages": sub_stages,
        "next_step_suggestions": next_step_suggestions or [],
        "milestones": milestones or [],
    }


def _mode_a_terminal_exception_lifecycle(
    stage_name: str,
    stage_defs: List[Dict[str, str]],
    next_step_suggestions: Optional[List[str]] = None,
    *,
    milestones: Optional[List[Dict[str, Any]]] = None,
    sub_stages: Optional[List[Dict[str, Any]]] = None,
) -> Dict[str, Any]:
    """模式 A：业务终态异常（已取消等），当前阶段展示业务终态名，主轴全 pending。"""
    return {
        "current_stage_key": "",
        "current_stage_name": stage_name,
        "status": "exception",
        "main_stages": [{"key": s["key"], "label": s["label"], "status": "pending"} for s in stage_defs],
        "sub_stages": sub_stages,
        "next_step_suggestions": next_step_suggestions or [],
        "milestones": milestones or [],
    }


def _mode_a_is_audit_pre_effective(
    status: Optional[str],
    review_status: Optional[str],
    *,
    business_effective: bool = False,
) -> bool:
    """审核门禁未通过、尚未进入业务主轴。"""
    if _is_rejected(review_status):
        return True
    if _is_draft(status):
        return True
    if _is_pending_review(status) and not _is_approved(review_status):
        return True
    if not business_effective and (_is_audited(status) or _is_approved(review_status)):
        return True
    return False

SALES_ORDER_EXEC_SUB_STAGES = [
    {"key": "bom_check", "label": "BOM检查"},
    {"key": "demand_compute", "label": "需求计算"},
    {"key": "material_ready", "label": "物料齐套"},
    {"key": "work_order_create", "label": "工单建立"},
    {"key": "work_order_exec", "label": "工单执行"},
    {"key": "product_inbound", "label": "成品入库"},
    {"key": "sales_delivery", "label": "销售出库/交货"},
]


# 工单生命周期节点（草稿→已下达→执行中→已完成；已取消/已拆分为终态分支）
# ---------------------------------------------------------------------------
WORK_ORDER_MAIN_STAGES = [
    {"key": "draft", "label": "草稿"},
    {"key": "released", "label": "已下达"},
    {"key": "in_progress", "label": "执行中"},
    {"key": "completed", "label": "已完成"},
    {"key": "cancelled", "label": "已取消"},
    {"key": "split", "label": "已拆分"},
]


# ---------------------------------------------------------------------------
# 需求生命周期节点（按业务含义独立：需求由上游审核通过自动生成，无草稿；审核 + 是否下推计算）
# ---------------------------------------------------------------------------
DEMAND_MAIN_STAGES = [
    {"key": "effective", "label": "已生效"},
    {"key": "pushed", "label": "已下推计算"},
]


def _norm(s: Optional[str]) -> str:
    return (s or "").strip()


def _demand_origin_sub_stages(demand_type: Optional[str]) -> Optional[List[Dict[str, Any]]]:
    """需求来源子轨（与主线审核/下推正交），供 UniLifecycle 子 Stepper 展示。"""
    dt = _norm(demand_type)
    if dt == "sales_forecast":
        return [{"key": "from_forecast", "label": "从预测同步（自动）", "status": "done"}]
    if dt == "sales_order":
        return [{"key": "from_order", "label": "从订单同步（自动）", "status": "done"}]
    if dt == "demand_plan":
        return [{"key": "manual_plan", "label": "手工需求计划", "status": "done"}]
    return None


def _demand_next_suggestions_extra(pushed: bool, demand_type: Optional[str]) -> List[str]:
    """在主线建议基础上追加与上游/下推相关的提示。"""
    extra: List[str] = []
    dt = _norm(demand_type)
    if pushed and dt in ("sales_forecast", "sales_order"):
        extra.append("上游变更后请到需求计算重新执行计算")
    return extra


def _is_rejected(review_status: Optional[str]) -> bool:
    r = _norm(review_status)
    return r in ("REJECTED", "已驳回", "审核驳回")


def _is_approved(review_status: Optional[str]) -> bool:
    r = _norm(review_status)
    return r in ("APPROVED", "审核通过", "通过", "已通过", "已审核")


def _is_draft(status: Optional[str]) -> bool:
    s = _norm(status)
    return s in ("DRAFT", "草稿")


def _is_pending_review(status: Optional[str]) -> bool:
    s = _norm(status)
    return s in ("PENDING_REVIEW", "待审核", "已提交")


def _is_audited(status: Optional[str]) -> bool:
    s = _norm(status)
    return s in ("AUDITED", "已审核")


def _is_confirmed(status: Optional[str]) -> bool:
    s = _norm(status)
    return s in ("CONFIRMED", "已确认", "已生效")


def _is_cancelled(status: Optional[str]) -> bool:
    s = _norm(status)
    return s in ("CANCELLED", "已取消")


def _is_closed(status: Optional[str]) -> bool:
    s = _norm(status)
    return s in ("CLOSED", "已关闭", "closed")


def _sales_order_lifecycle_suggestions(
    order: Any,
    *,
    items: Optional[List[Any]] = None,
    pushed_to_computation: bool = False,
    current_stage_key: Optional[str] = None,
    exec_active_key: Optional[str] = None,
) -> List[str]:
    from apps.kuaizhizao.services.document_action_policy.lifecycle_suggestions import (
        sales_order_capabilities_to_suggestions,
    )
    from apps.kuaizhizao.services.document_action_policy.sales_order import (
        derive_sales_order_capabilities,
    )

    has_wo = any(getattr(it, "work_order_id", None) for it in (items or []))
    caps = derive_sales_order_capabilities(
        order,
        pushed_to_computation=pushed_to_computation,
        has_items=bool(items),
        has_line_work_orders=has_wo,
    )
    return sales_order_capabilities_to_suggestions(
        caps,
        current_stage_key=current_stage_key,
        exec_active_key=exec_active_key,
    )


def normalize_sales_order_lifecycle_filter(stage: Optional[str]) -> str:
    """列表 lifecycle_stage 筛选值归一化（与前端 normalizeStageName 对齐）。"""
    s = _norm(stage)
    if s == "已交货":
        return "发货出库"
    if s in ("账款发票", "invoicing"):
        return "账款发票处理"
    if s == "已确认":
        return "已生效"
    return s


def _build_main_stages(
    stage_keys: List[Dict[str, str]],
    current_stage_key: str,
    is_exception: bool = False,
) -> List[Dict[str, Any]]:
    """根据当前阶段 key 生成 main_stages，每项带 status: done | active | pending。"""
    keys = [s["key"] for s in stage_keys]
    try:
        current_idx = next(i for i, s in enumerate(stage_keys) if s["key"] == current_stage_key)
    except StopIteration:
        current_idx = 0
    result = []
    for i, s in enumerate(stage_keys):
        if current_stage_key == "completed" and s["key"] == "completed":
            status = "done"
        elif i < current_idx:
            status = "done"
        elif i == current_idx:
            status = "active"
        else:
            status = "pending"
        result.append({"key": s["key"], "label": s["label"], "status": status})
    return result


# ---------------------------------------------------------------------------
# 销售订单生命周期计算
# ---------------------------------------------------------------------------
def get_sales_order_lifecycle(
    order: Any,
    *,
    items: Optional[List[Any]] = None,
    delivery_progress: Optional[float] = None,
    invoice_progress: Optional[float] = None,
    invoice_amount_progress: Optional[float] = None,
    collection_progress: Optional[float] = None,
    pushed_to_computation: bool = False,
    milestones: Optional[List[Dict[str, Any]]] = None,
) -> Dict[str, Any]:
    """
    根据销售订单数据计算生命周期，返回供前端展示的结构。
    order: ORM 或具 status, review_status 的对象。
    """
    status = _norm(getattr(order, "status", None))
    review_status = _norm(getattr(order, "review_status", None))
    delivery = delivery_progress if delivery_progress is not None else 0.0
    invoice = invoice_progress if invoice_progress is not None else 0.0
    invoice_amt = invoice_amount_progress if invoice_amount_progress is not None else invoice
    collection = collection_progress if collection_progress is not None else invoice
    pushed = pushed_to_computation or getattr(order, "planning_pushed_to_computation", False)

    def _so_sugg(stage_key: str, exec_key: Optional[str] = None) -> List[str]:
        return _sales_order_lifecycle_suggestions(
            order,
            items=items,
            pushed_to_computation=pushed,
            current_stage_key=stage_key,
            exec_active_key=exec_key,
        )

    effective = _is_approved(review_status) and (
        _is_confirmed(status) or pushed
    )

    if _is_cancelled(status):
        return _mode_a_terminal_exception_lifecycle(
            "已取消",
            SALES_ORDER_MAIN_STAGES,
            milestones=milestones,
        )
    if _is_closed(status):
        return {
            "current_stage_key": "completed",
            "current_stage_name": "已关闭",
            "status": "normal",
            "main_stages": _build_main_stages(SALES_ORDER_MAIN_STAGES, "completed"),
            "sub_stages": None,
            "next_step_suggestions": [],
        }

    if _mode_a_is_audit_pre_effective(status, review_status, business_effective=effective):
        sugg_key = (
            "pending_review"
            if _is_rejected(review_status) or _is_pending_review(status)
            else "draft"
            if _is_draft(status)
            else "audited"
        )
        return _mode_a_pre_effective_lifecycle(
            SALES_ORDER_MAIN_STAGES,
            _so_sugg(sugg_key),
            milestones=milestones,
        )

    if effective and delivery >= 100 and invoice >= 100:
        return {
            "current_stage_key": "completed",
            "current_stage_name": "已完成",
            "status": "success",
            "main_stages": _build_main_stages(SALES_ORDER_MAIN_STAGES, "completed"),
            "sub_stages": None,
            "next_step_suggestions": [],
        }
    if effective and delivery >= 100 and invoice < 100:
        finance_sub_stages = [
            {
                "key": "sales_invoice",
                "label": "销售发票",
                "status": "done" if invoice_amt >= 100 else ("active" if invoice_amt > 0 else "pending"),
                "percent": round(invoice_amt, 1),
            },
            {
                "key": "receivable_collection",
                "label": "收款核销",
                "status": "done"
                if collection >= 100
                else ("active" if collection > 0 or invoice_amt >= 100 else "pending"),
                "percent": round(collection, 1),
            },
        ]
        suggestions = _so_sugg("invoicing")
        return {
            "current_stage_key": "invoicing",
            "current_stage_name": "账款发票处理",
            "status": "normal",
            "main_stages": _build_main_stages(SALES_ORDER_MAIN_STAGES, "invoicing"),
            "sub_stages": finance_sub_stages,
            "next_step_suggestions": suggestions,
        }
    # 已生效：订单已确认/已下推，但尚未开始执行（无工单、无交货进度）
    if effective and delivery <= 0:
        has_wo = False
        if items:
            has_wo = any(getattr(it, "work_order_id", None) for it in items)
        if not pushed and not has_wo:
            return {
                "current_stage_key": "effective",
                "current_stage_name": "已生效",
                "status": "normal",
                "main_stages": _build_main_stages(SALES_ORDER_MAIN_STAGES, "effective"),
                "sub_stages": None,
                "next_step_suggestions": _so_sugg("effective"),
            }
    if effective and delivery < 100:
        milestones = milestones or []
        actions = {m.get("action") for m in milestones}
        
        sub_stages = [
            {"key": "bom_check", "label": "BOM检查", "status": "done"},
            {"key": "demand_compute", "label": "需求计算", "status": "done" if pushed or "push_to_demand_computation" in actions else "active"},
            {"key": "work_order_released", "label": "工单下达", "status": "done" if "push_to_work_order" in actions else "pending"},
            {"key": "shipment_waiting", "label": "待出库", "status": "done" if "push_to_shipment_notice" in actions else "pending"},
            {"key": "delivered", "label": "已送货", "status": "done" if delivery >= 100 or "push_to_sales_delivery" in actions else "active" if delivery > 0 else "pending"},
        ]

        # 确保至少有一个 active (如果没完成)
        if not any(ss["status"] == "active" for ss in sub_stages) and any(ss["status"] == "pending" for ss in sub_stages):
            for ss in sub_stages:
                if ss["status"] == "pending":
                    ss["status"] = "active"
                    break

        active_key = next((s["key"] for s in sub_stages if s["status"] == "active"), None)
        suggestions = _so_sugg("executing", active_key)
        return {
            "current_stage_key": "executing",
            "current_stage_name": "执行中",
            "status": "normal",
            "main_stages": _build_main_stages(SALES_ORDER_MAIN_STAGES, "executing"),
            "sub_stages": sub_stages,
            "next_step_suggestions": suggestions,
            "milestones": milestones,
        }

    return _mode_a_pre_effective_lifecycle(
        SALES_ORDER_MAIN_STAGES,
        _so_sugg("audited"),
        milestones=milestones,
    )


# ---------------------------------------------------------------------------
# 需求生命周期计算（仅审核态 + 是否下推需求计算，不套用订单执行/交货/完成）
# ---------------------------------------------------------------------------
def get_demand_lifecycle(
    demand: Any,
    *,
    items: Optional[List[Any]] = None,
) -> Dict[str, Any]:
    """
    根据需求数据计算生命周期，返回供前端展示的结构。
    模式 A：审核态见 audit 列；业务主轴为「已生效 → 已下推计算」（审核通过入池后可下推 MRP）。
    """
    status = _norm(getattr(demand, "status", None))
    review_status = _norm(getattr(demand, "review_status", None))
    pushed = bool(getattr(demand, "pushed_to_computation", False))
    demand_type = getattr(demand, "demand_type", None)
    origin_sub = _demand_origin_sub_stages(demand_type if isinstance(demand_type, str) else None)
    audited = _is_approved(review_status) or _is_audited(status) or _is_confirmed(status)

    if pushed:
        extra = _demand_next_suggestions_extra(True, demand_type if isinstance(demand_type, str) else None)
        return {
            "current_stage_key": "pushed",
            "current_stage_name": "已下推计算",
            "status": "success",
            "main_stages": _build_main_stages(DEMAND_MAIN_STAGES, "pushed"),
            "sub_stages": origin_sub,
            "next_step_suggestions": extra,
        }

    if audited:
        return {
            "current_stage_key": "effective",
            "current_stage_name": "已生效",
            "status": "normal",
            "main_stages": _build_main_stages(DEMAND_MAIN_STAGES, "effective"),
            "sub_stages": origin_sub,
            "next_step_suggestions": ["下推需求计算"],
        }

    return _mode_a_pre_effective_lifecycle(
        DEMAND_MAIN_STAGES,
        ["提交审核"],
        sub_stages=origin_sub,
    )


# ---------------------------------------------------------------------------
# 工单生命周期计算
# ---------------------------------------------------------------------------
WORK_ORDER_SUB_STAGES = [
    {"key": "material_picking", "label": "生产领料"},
    {"key": "first_inspection", "label": "首检"},
    {"key": "reporting", "label": "生产报工"},
    {"key": "process_qc", "label": "过程巡检"},
    {"key": "fg_qc", "label": "成品检验"},
    {"key": "fg_receipt", "label": "入库申请"},
]

def get_work_order_lifecycle(
    work_order: Any,
    milestones: Optional[List[Dict[str, Any]]] = None
) -> Dict[str, Any]:
    """
    根据工单数据计算生命周期，返回供前端 UniLifecycleStepper 展示的结构。
    work_order: ORM 或具 status 的对象。
    """
    status = _norm(getattr(work_order, "status", None) or "")
    milestones = milestones or []

    # 1. 计算子阶段状态 (基于里程碑)
    sub_stages = []
    actions = {m.get("action") for m in milestones}
    
    # 生产领料
    picking_status = "done" if "push_to_production_picking" in actions else "pending"
    # 首检
    first_qc_status = "done" if "push_to_process_inspection" in actions else "pending"
    # 报工
    reporting_status = "done" if "push_to_finished_goods_inspection" in actions else "active" if status == "in_progress" else "pending"
    # 成品检验
    fg_qc_status = "done" if "push_to_finished_goods_inspection" in actions else "pending"
    # 入库申请
    fg_receipt_status = "done" if "push_to_finished_goods_receipt" in actions else "pending"

    sub_stages = [
        {"key": "material_picking", "label": "生产领料", "status": picking_status},
        {"key": "reporting", "label": "生产报工", "status": reporting_status},
        {"key": "fg_qc", "label": "成品检验", "status": fg_qc_status},
        {"key": "fg_receipt", "label": "入库申请", "status": fg_receipt_status},
    ]

    # 已拆分：原工单已拆成子工单，非用户取消
    if status in ("split", "已拆分"):
        return {
            "current_stage_key": "split",
            "current_stage_name": "已拆分",
            "status": "normal",
            "main_stages": _build_main_stages(WORK_ORDER_MAIN_STAGES, "split"),
            "sub_stages": None,
            "next_step_suggestions": [],
            "milestones": milestones,
        }

    # 已取消：异常分支
    if status in ("cancelled", "已取消"):
        return {
            "current_stage_key": "cancelled",
            "current_stage_name": "已取消",
            "status": "exception",
            "main_stages": _build_main_stages(WORK_ORDER_MAIN_STAGES, "cancelled", is_exception=True),
            "sub_stages": None,
            "next_step_suggestions": [],
            "milestones": milestones,
        }

    # 草稿（审核开启时先走提交/通过，再下达）
    if status in ("draft", "草稿"):
        review = _norm(getattr(work_order, "review_status", None) or "")
        if review in ("待审核", "pending_review", "pending_approval", "PENDING"):
            draft_suggestions = ["等待审核"]
        elif review in ("已驳回", "审核驳回", "rejected", "REJECTED"):
            draft_suggestions = ["修改后重新提交审核"]
        elif review in ("已通过", "审核通过", "approved", "APPROVED"):
            draft_suggestions = ["下达工单"]
        elif review in ("草稿", "draft", "DRAFT"):
            draft_suggestions = ["提交审核"]
        else:
            draft_suggestions = ["下达工单"]
        return {
            "current_stage_key": "draft",
            "current_stage_name": "草稿",
            "status": "normal",
            "main_stages": _build_main_stages(WORK_ORDER_MAIN_STAGES, "draft"),
            "sub_stages": None,
            "next_step_suggestions": draft_suggestions,
            "milestones": milestones,
        }

    # 已下达
    if status in ("released", "已下达"):
        return {
            "current_stage_key": "released",
            "current_stage_name": "已下达",
            "status": "normal",
            "main_stages": _build_main_stages(WORK_ORDER_MAIN_STAGES, "released"),
            "sub_stages": sub_stages,
            "next_step_suggestions": ["开始执行", "状态流转"],
            "milestones": milestones,
        }

    # 执行中
    if status in ("in_progress", "执行中"):
        return {
            "current_stage_key": "in_progress",
            "current_stage_name": "执行中",
            "status": "active",
            "main_stages": _build_main_stages(WORK_ORDER_MAIN_STAGES, "in_progress"),
            "sub_stages": sub_stages,
            "next_step_suggestions": ["报工", "指定结束", "状态流转"],
            "milestones": milestones,
        }

    # 已完成
    if status in ("completed", "已完成"):
        for ss in sub_stages:
            ss["status"] = "done"
        return {
            "current_stage_key": "completed",
            "current_stage_name": "已完成",
            "status": "success",
            "main_stages": _build_main_stages(WORK_ORDER_MAIN_STAGES, "completed"),
            "sub_stages": sub_stages,
            "next_step_suggestions": [],
            "milestones": milestones,
        }

    # 未知状态兜底
    return {
        "current_stage_key": "draft",
        "current_stage_name": status or "草稿",
        "status": "normal",
        "main_stages": _build_main_stages(WORK_ORDER_MAIN_STAGES, "draft"),
        "sub_stages": None,
        "next_step_suggestions": ["状态流转"],
        "milestones": milestones,
    }


# ---------------------------------------------------------------------------
# 采购订单生命周期：已确认→执行中→账款发票→已完成（审核由 record.audit 独立列展示）
# ---------------------------------------------------------------------------
PURCHASE_ORDER_MAIN_STAGES = [
    {"key": "confirmed", "label": "已确认"},
    {"key": "executing", "label": "执行中"},
    {"key": "invoicing", "label": "账款发票"},
    {"key": "completed", "label": "已完成"},
]

PURCHASE_ORDER_EXEC_SUB_STAGES = [
    {"key": "receipt_notice", "label": "收货通知"},
    {"key": "incoming_inspection", "label": "来料检验"},
    {"key": "purchase_receipt", "label": "采购入库"},
    {"key": "purchase_invoice", "label": "采购发票"},
]


def get_purchase_order_lifecycle(
    order: Any,
    milestones: Optional[List[Dict[str, Any]]] = None
) -> Dict[str, Any]:
    """采购订单生命周期：对齐采购履约链路（确认→收货入库→发票→完成）。"""
    status = _norm(getattr(order, "status", None))
    review_status = _norm(getattr(order, "review_status", None))
    milestones = milestones or []
    actions = {m.get("action") for m in milestones}

    from apps.kuaizhizao.services.document_action_policy.lifecycle_suggestions import (
        purchase_order_capabilities_to_suggestions,
    )
    from apps.kuaizhizao.services.document_action_policy.purchase_order import (
        derive_purchase_order_capabilities,
    )

    def _po_sugg(stage_key: str) -> List[str]:
        caps = derive_purchase_order_capabilities(order)
        return purchase_order_capabilities_to_suggestions(
            caps,
            current_stage_key=stage_key,
        )

    exec_started = bool(
        actions
        & {
            "push_to_purchase_receipt",
            "push_to_receipt_notice",
            "push_to_incoming_inspection",
            "push_to_purchase_invoice",
        }
    ) or status in ("IN_PROGRESS", "执行中", "进行中")

    sub_stages = [
        {
            "key": "receipt_notice",
            "label": "收货通知",
            "status": "done"
            if "push_to_receipt_notice" in actions or status in ("已完成", "COMPLETED", "completed")
            else "active"
            if _is_approved(review_status) and (_is_confirmed(status) or status in LEGACY_AUDITED_VALUES)
            else "pending",
        },
        {
            "key": "incoming_inspection",
            "label": "来料检验",
            "status": "done"
            if "push_to_incoming_inspection" in actions or status in ("已完成", "COMPLETED", "completed")
            else "active"
            if exec_started
            else "pending",
        },
        {
            "key": "purchase_receipt",
            "label": "采购入库",
            "status": "done"
            if "push_to_purchase_receipt" in actions or status in ("已完成", "COMPLETED", "completed")
            else "active"
            if exec_started
            else "pending",
        },
        {
            "key": "purchase_invoice",
            "label": "采购发票",
            "status": "done"
            if "push_to_purchase_invoice" in actions
            else "active"
            if status in ("已完成", "COMPLETED", "completed")
            else "pending",
        },
    ]

    business_effective = _is_approved(review_status) and (
        _is_confirmed(status) or status in LEGACY_AUDITED_VALUES
    )

    if _is_rejected(review_status) or status in ("REJECTED", "已驳回", "rejected"):
        return _mode_a_pre_effective_lifecycle(
            PURCHASE_ORDER_MAIN_STAGES,
            _po_sugg("pending_review"),
            milestones=milestones,
            sub_stages=sub_stages,
        )
    if _is_cancelled(status):
        return _mode_a_terminal_exception_lifecycle(
            "已取消",
            PURCHASE_ORDER_MAIN_STAGES,
            milestones=milestones,
        )
    if _mode_a_is_audit_pre_effective(status, review_status, business_effective=business_effective):
        sugg_key = (
            "pending_review"
            if _is_pending_review(status) or _is_rejected(review_status)
            else "draft"
            if _is_draft(status)
            else "audited"
        )
        return _mode_a_pre_effective_lifecycle(
            PURCHASE_ORDER_MAIN_STAGES,
            _po_sugg(sugg_key),
            milestones=milestones,
            sub_stages=sub_stages,
        )

    if status in ("已完成", "COMPLETED", "completed"):
        return {
            "current_stage_key": "completed",
            "current_stage_name": "已完成",
            "status": "success",
            "main_stages": _build_main_stages(PURCHASE_ORDER_MAIN_STAGES, "completed"),
            "sub_stages": sub_stages,
            "next_step_suggestions": [],
            "milestones": milestones,
        }

    if exec_started and "push_to_purchase_receipt" in actions and "push_to_purchase_invoice" not in actions:
        return {
            "current_stage_key": "invoicing",
            "current_stage_name": "账款发票",
            "status": "normal",
            "main_stages": _build_main_stages(PURCHASE_ORDER_MAIN_STAGES, "invoicing"),
            "sub_stages": sub_stages,
            "next_step_suggestions": ["下推采购发票", "登记应付与付款"],
            "milestones": milestones,
        }

    if exec_started:
        return {
            "current_stage_key": "executing",
            "current_stage_name": "执行中",
            "status": "normal",
            "main_stages": _build_main_stages(PURCHASE_ORDER_MAIN_STAGES, "executing"),
            "sub_stages": sub_stages,
            "next_step_suggestions": ["下推收货通知", "下推采购入库", "跟进来料检验"],
            "milestones": milestones,
        }

    if _is_approved(review_status) and (_is_confirmed(status) or status in LEGACY_AUDITED_VALUES):
        return {
            "current_stage_key": "confirmed",
            "current_stage_name": "已确认",
            "status": "normal",
            "main_stages": _build_main_stages(PURCHASE_ORDER_MAIN_STAGES, "confirmed"),
            "sub_stages": sub_stages,
            "next_step_suggestions": ["下推收货通知", "下推采购入库"],
            "milestones": milestones,
        }

    return _mode_a_pre_effective_lifecycle(
        PURCHASE_ORDER_MAIN_STAGES,
        _po_sugg("audited"),
        milestones=milestones,
        sub_stages=sub_stages,
    )


# ---------------------------------------------------------------------------
# 销售预测生命周期（主轴与执行子阶段与销售订单对齐；审核由 record.audit 独立列展示）
# pushed_to_computation 由调用方根据关联 Demand.pushed_to_computation 传入（与订单一致）
# ---------------------------------------------------------------------------
def get_sales_forecast_lifecycle(
    forecast: Any,
    *,
    items: Optional[List[Any]] = None,
    delivery_progress: Optional[float] = None,
    invoice_progress: Optional[float] = None,
    pushed_to_computation: bool = False,
    milestones: Optional[List[Dict[str, Any]]] = None,
) -> Dict[str, Any]:
    """
    销售预测生命周期：审核/生效/执行逻辑对齐销售订单；交货/开票进度默认 0（MTS 预测无订单级交货时可不传）。
    """
    status = _norm(getattr(forecast, "status", None))
    review_status = _norm(getattr(forecast, "review_status", None))
    delivery = delivery_progress if delivery_progress is not None else 0.0
    invoice = invoice_progress if invoice_progress is not None else 0.0
    pushed = pushed_to_computation or getattr(forecast, "planning_pushed_to_computation", False)
    milestones = milestones or []

    from apps.kuaizhizao.services.document_action_policy.lifecycle_suggestions import (
        sales_forecast_capabilities_to_suggestions,
    )
    from apps.kuaizhizao.services.document_action_policy.sales_forecast import (
        derive_sales_forecast_capabilities,
    )

    def _sf_sugg(stage_key: str) -> List[str]:
        caps = derive_sales_forecast_capabilities(
            forecast,
            pushed_to_computation=pushed,
            has_items=bool(items),
        )
        return sales_forecast_capabilities_to_suggestions(
            caps,
            current_stage_key=stage_key,
        )

    effective = _is_approved(review_status) and (_is_confirmed(status) or pushed)

    if _is_cancelled(status):
        return _mode_a_terminal_exception_lifecycle(
            "已取消",
            SALES_ORDER_MAIN_STAGES,
            milestones=milestones,
        )

    if _mode_a_is_audit_pre_effective(status, review_status, business_effective=effective):
        sugg_key = (
            "pending_review"
            if _is_rejected(review_status) or status in ("已驳回", "REJECTED", "rejected") or _is_pending_review(status)
            else "draft"
            if _is_draft(status)
            else "audited"
        )
        return _mode_a_pre_effective_lifecycle(
            SALES_ORDER_MAIN_STAGES,
            _sf_sugg(sugg_key),
            milestones=milestones,
        )

    if effective and delivery >= 100 and invoice >= 100:
        return {
            "current_stage_key": "completed",
            "current_stage_name": "已完成",
            "status": "success",
            "main_stages": _build_main_stages(SALES_ORDER_MAIN_STAGES, "completed"),
            "sub_stages": None,
            "next_step_suggestions": [],
        }
    if effective and delivery >= 100 and invoice < 100:
        return {
            "current_stage_key": "invoicing",
            "current_stage_name": "账款发票处理",
            "status": "normal",
            "main_stages": _build_main_stages(SALES_ORDER_MAIN_STAGES, "invoicing"),
            "sub_stages": None,
            "next_step_suggestions": ["下推销售发票", "登记收款与对账"],
        }
    if effective and delivery <= 0:
        has_wo = False
        if items:
            has_wo = any(getattr(it, "work_order_id", None) for it in items)
        if not pushed and not has_wo:
            return {
                "current_stage_key": "effective",
                "current_stage_name": "已生效",
                "status": "normal",
                "main_stages": _build_main_stages(SALES_ORDER_MAIN_STAGES, "effective"),
                "sub_stages": None,
                "next_step_suggestions": ["前往需求计算执行 MRP", "建立工单"],
            }
    if effective and delivery < 100:
        actions = {m.get("action") for m in milestones}

        sub_stages = [
            {"key": "bom_check", "label": "BOM检查", "status": "done"},
            {"key": "demand_compute", "label": "需求计算", "status": "done" if pushed or "push_to_demand_computation" in actions else "active"},
            {"key": "work_order_released", "label": "工单下达", "status": "done" if "push_to_work_order" in actions else "pending"},
            {"key": "shipment_waiting", "label": "待出库", "status": "done" if "push_to_shipment_notice" in actions else "pending"},
            {"key": "delivered", "label": "已送货", "status": "done" if delivery >= 100 or "push_to_sales_delivery" in actions else "active" if delivery > 0 else "pending"},
        ]

        if not any(ss["status"] == "active" for ss in sub_stages) and any(ss["status"] == "pending" for ss in sub_stages):
            for ss in sub_stages:
                if ss["status"] == "pending":
                    ss["status"] = "active"
                    break

        exec_suggestions = {
            "bom_check": ["完成 BOM 检查"],
            "demand_compute": ["执行需求计算（MRP）"],
            "work_order_released": ["下达工单"],
            "shipment_waiting": ["准备出库"],
            "delivered": ["销售交货"],
        }
        active_key = next((s["key"] for s in sub_stages if s["status"] == "active"), None)
        suggestions = exec_suggestions.get(active_key, ["推进执行进度"])
        return {
            "current_stage_key": "executing",
            "current_stage_name": "执行中",
            "status": "normal",
            "main_stages": _build_main_stages(SALES_ORDER_MAIN_STAGES, "executing"),
            "sub_stages": sub_stages,
            "next_step_suggestions": suggestions,
            "milestones": milestones,
        }

    return _mode_a_pre_effective_lifecycle(
        SALES_ORDER_MAIN_STAGES,
        _sf_sugg("audited"),
        milestones=milestones,
    )


# ---------------------------------------------------------------------------
# 返工单生命周期（草稿→已下达→执行中→待复检→质量放行→已关闭）
# ---------------------------------------------------------------------------
REWORK_ORDER_MAIN_STAGES = [
    {"key": "draft", "label": "草稿"},
    {"key": "released", "label": "已下达"},
    {"key": "in_progress", "label": "执行中"},
    {"key": "pending_verification", "label": "待复检"},
    {"key": "quality_released", "label": "质量放行"},
    {"key": "closed", "label": "已关闭"},
]

REWORK_ORDER_FLOW_LABELS = {
    "draft": "草稿",
    "released": "已下达",
    "in_progress": "执行中",
    "pending_verification": "待复检",
    "quality_released": "质量放行",
    "closed": "已关闭",
    "cancelled": "已取消",
    "on_hold": "已暂停",
}


def get_rework_order_lifecycle(
    rework_order: Any,
    milestones: Optional[List[Dict[str, Any]]] = None
) -> Dict[str, Any]:
    """返工单生命周期计算"""
    status_raw = _norm(getattr(rework_order, "status", None))
    status_key = status_raw.lower() if status_raw else "draft"
    if status_key == "cancelled":
        return {
            "status_class": status_raw,
            "flow_class": "cancelled",
            "current_stage_key": "cancelled",
            "current_stage_name": "已取消",
            "status": "exception",
            "main_stages": [
                {"key": s["key"], "label": s["label"], "status": "pending"}
                for s in REWORK_ORDER_MAIN_STAGES
            ] + [{"key": "cancelled", "label": "已取消", "status": "active"}],
            "next_step_suggestions": [],
            "milestones": milestones or [],
        }
    if status_key == "on_hold":
        status_key = "in_progress"
    visual_key = status_key if status_key in REWORK_ORDER_FLOW_LABELS else "draft"
    stage_name = REWORK_ORDER_FLOW_LABELS.get(visual_key, "草稿")
    main_stages = []
    order_keys = [s["key"] for s in REWORK_ORDER_MAIN_STAGES]
    cur_idx = order_keys.index(visual_key) if visual_key in order_keys else 0
    for idx, stage in enumerate(REWORK_ORDER_MAIN_STAGES):
        st = "pending"
        if idx < cur_idx:
            st = "done"
        elif idx == cur_idx:
            st = "active"
        main_stages.append({"key": stage["key"], "label": stage["label"], "status": st})

    suggestions_map = {
        "draft": ["下达"],
        "released": ["报工"],
        "in_progress": ["报工", "下一工序", "申请完修"],
        "pending_verification": ["复检", "质量放行"],
        "quality_released": ["关闭"],
        "closed": [],
    }
    return {
        "status_class": status_raw,
        "flow_class": visual_key,
        "current_stage_key": visual_key,
        "current_stage_name": stage_name,
        "status": "success" if visual_key == "closed" else "active" if visual_key in ("in_progress", "released") else "normal",
        "main_stages": main_stages,
        "next_step_suggestions": suggestions_map.get(visual_key, []),
        "milestones": milestones or [],
    }


# ---------------------------------------------------------------------------
# 采购申请生命周期（草稿→待审核→已通过/已驳回→部分转单→全部转单）
# ---------------------------------------------------------------------------
# 采购申请 lifecycle 主轴仅业务态；待审/已审由 record.audit 独立列展示
PURCHASE_REQUISITION_MAIN_STAGES = [
    {"key": "approved", "label": "已通过"},
    {"key": "partial", "label": "部分转单"},
    {"key": "full", "label": "全部转单"},
]

PURCHASE_REQUISITION_MAIN_STAGES_NO_AUDIT = PURCHASE_REQUISITION_MAIN_STAGES

PURCHASE_REQUISITION_FLOW_LABELS = {
    "approved": "已通过",
    "partial": "部分转单",
    "full": "全部转单",
}


def normalize_purchase_requisition_lifecycle_filter(stage: Optional[str]) -> str:
    """列表 lifecycle_stage 筛选值归一化（与 get_purchase_requisition_lifecycle 的 current_stage_name 一致）。"""
    return _norm(stage)


def get_purchase_requisition_lifecycle(
    requisition: Any,
    milestones: Optional[List[Dict[str, Any]]] = None,
    *,
    audit_required: bool = True,
) -> Dict[str, Any]:
    """采购申请生命周期计算"""
    status_raw = _norm(getattr(requisition, "status", None))
    status_norm = normalize_status(status_raw)
    milestones = milestones or []
    flow_class = {
        DocumentStatus.DRAFT.value: "draft",
        DocumentStatus.PENDING_REVIEW.value: "pending_review",
        DocumentStatus.REJECTED.value: "pending_review",
        DocumentStatus.AUDITED.value: "approved",
        DocumentStatus.APPROVED.value: "approved",
        DocumentStatus.CONFIRMED.value: "approved",
        DocumentStatus.PARTIAL_CONVERTED.value: "partial",
        DocumentStatus.FULL_CONVERTED.value: "full",
    }.get(status_norm, "draft")
    if not audit_required and flow_class == "pending_review":
        flow_class = "approved"
    main_stages_def = (
        PURCHASE_REQUISITION_MAIN_STAGES if audit_required else PURCHASE_REQUISITION_MAIN_STAGES_NO_AUDIT
    )
    suggestions = ["下推采购订单"] if flow_class in ("approved", "partial") else []

    if audit_required and flow_class in ("draft", "pending_review"):
        return {
            "status_class": status_raw,
            "flow_class": flow_class,
            **_mode_a_pre_effective_lifecycle(main_stages_def, suggestions, milestones=milestones),
        }

    stage_name = PURCHASE_REQUISITION_FLOW_LABELS.get(flow_class, "已通过")
    visual_key = flow_class if flow_class in ("approved", "partial", "full") else "approved"
    return {
        "status_class": status_raw,
        "flow_class": flow_class,
        "current_stage_key": visual_key,
        "current_stage_name": stage_name,
        "status": "success" if flow_class == "full" else "normal",
        "main_stages": _build_main_stages(main_stages_def, visual_key),
        "sub_stages": None,
        "next_step_suggestions": suggestions,
        "milestones": milestones,
    }


def _extract_status_class_from_lifecycle_args(args: tuple, kwargs: Dict[str, Any]) -> str:
    """统一提取真实状态类（单据 status 原值）。"""
    status = kwargs.get("status")
    if isinstance(status, str):
        return status
    if args:
        first = args[0]
        if isinstance(first, str):
            return first
        obj_status = getattr(first, "status", None)
        if obj_status is not None:
            return str(obj_status)
    return ""


def _lifecycle_contract_wrapper(fn):
    """为 lifecycle 结果统一注入 status_class/flow_class，避免多源竞争。"""

    @wraps(fn)
    def _wrapped(*args, **kwargs):
        payload = fn(*args, **kwargs)
        if not isinstance(payload, dict):
            return payload
        payload.setdefault("status_class", _extract_status_class_from_lifecycle_args(args, kwargs))
        payload.setdefault("flow_class", str(payload.get("current_stage_key") or "").strip())
        return payload

    return _wrapped


# ---------------------------------------------------------------------------
# 采购询价单生命周期
# ---------------------------------------------------------------------------
PURCHASE_INQUIRY_MAIN_STAGES = [
    {"key": "draft", "label": "草稿"},
    {"key": "quoting", "label": "询价中"},
    {"key": "pending_compare", "label": "待比价"},
    {"key": "awarded", "label": "已定标"},
    {"key": "converted", "label": "已转单"},
]


def normalize_purchase_inquiry_lifecycle_stage(stage: Optional[str]) -> str:
    return _norm(stage)


def get_purchase_inquiry_lifecycle(
    inquiry: Any,
    milestones: Optional[List[Dict[str, Any]]] = None,
    *,
    audit_required: bool = False,
) -> Dict[str, Any]:
    """采购询价单生命周期"""
    status = _norm(getattr(inquiry, "status", None))
    review_status = _norm(getattr(inquiry, "review_status", None))
    milestones = milestones or []
    status_map = {
        "DRAFT": "draft", "draft": "draft", "草稿": "draft",
        "QUOTING": "quoting", "quoting": "quoting", "询价中": "quoting",
        "PENDING_COMPARE": "pending_compare", "pending_compare": "pending_compare", "待比价": "pending_compare",
        "AWARDED": "awarded", "awarded": "awarded", "已定标": "awarded",
        "CONVERTED": "converted", "converted": "converted", "已转单": "converted",
        "CANCELLED": "draft", "cancelled": "draft", "已取消": "draft",
    }
    key = status_map.get(status, "draft")
    stage_name = {
        "draft": "草稿",
        "quoting": "询价中",
        "pending_compare": "待比价",
        "awarded": "已定标",
        "converted": "已转单",
    }.get(key, status or "草稿")
    if review_status in ("PENDING", "待审核") and key == "draft" and audit_required:
        stage_name = "草稿"
        key = "draft"
    from apps.kuaizhizao.services.document_action_policy.lifecycle_suggestions import (
        purchase_inquiry_capabilities_to_suggestions,
    )
    from apps.kuaizhizao.services.document_action_policy.purchase_inquiry import (
        derive_purchase_inquiry_capabilities,
    )

    cap_suggestions = purchase_inquiry_capabilities_to_suggestions(
        derive_purchase_inquiry_capabilities(inquiry),
        current_stage_key=key,
    )
    return {
        "current_stage_key": key,
        "current_stage_name": stage_name,
        "status": "success" if key == "converted" else "normal",
        "main_stages": _build_main_stages(PURCHASE_INQUIRY_MAIN_STAGES, key),
        "sub_stages": None,
        "next_step_suggestions": cap_suggestions,
        "milestones": milestones,
    }


# ---------------------------------------------------------------------------
# 采购入库单生命周期（待入库→已入库）
# ---------------------------------------------------------------------------
PURCHASE_RECEIPT_MAIN_STAGES = [
    {"key": "pending_inbound", "label": "待入库"},
    {"key": "completed", "label": "已入库"},
]


def get_purchase_receipt_lifecycle(
    receipt: Any,
    milestones: Optional[List[Dict[str, Any]]] = None
) -> Dict[str, Any]:
    """采购入库单生命周期计算 (增加理货、检验子阶段)"""
    status = _norm(getattr(receipt, "status", None))
    milestones = milestones or []
    actions = {m.get("action") for m in milestones}
    
    # 子阶段推导
    sub_stages = [
        {"key": "receiving", "label": "接单理货", "status": "active" if status in ("草稿", "draft") else "done"},
        {"key": "inspection", "label": "品质检验", "status": "done" if "push_to_incoming_inspection" in actions or status in ("已完成", "completed") else "active" if status not in ("草稿", "draft") else "pending"},
        {"key": "inbound", "label": "上架入库", "status": "done" if status in ("已完成", "completed", "已入库") else "active" if status not in ("草稿", "draft") else "pending"},
    ]

    key = "completed" if status in ("已入库", "completed", "已完成") else "pending_inbound"
    if key == "completed":
        stage_name = "已入库"
    elif status in ("草稿", "draft", "DRAFT"):
        stage_name = "草稿"
    else:
        stage_name = "待入库"
        
    return {
        "current_stage_key": key,
        "current_stage_name": stage_name,
        "status": "success" if key == "completed" else "normal",
        "main_stages": _build_main_stages(PURCHASE_RECEIPT_MAIN_STAGES, key),
        "sub_stages": sub_stages,
        "next_step_suggestions": ["下推报检"] if key == "pending_inbound" and "push_to_incoming_inspection" not in actions else ["确认入库"] if key == "pending_inbound" else [],
        "milestones": milestones,
    }


# ---------------------------------------------------------------------------
# 销售出库单生命周期（待出库→已出库）
# ---------------------------------------------------------------------------
SALES_DELIVERY_MAIN_STAGES = [
    {"key": "pending_outbound", "label": "待出库"},
    {"key": "completed", "label": "已出库"},
]


def get_sales_delivery_lifecycle(
    delivery: Any,
    milestones: Optional[List[Dict[str, Any]]] = None
) -> Dict[str, Any]:
    """销售出库单生命周期（待出库→已出库；审核态见 record.audit）。"""
    status = _norm(getattr(delivery, "status", None))
    milestones = milestones or []

    if status in ("待审核", "草稿", "draft", "已驳回", "rejected", "REJECTED"):
        return _mode_a_pre_effective_lifecycle(
            SALES_DELIVERY_MAIN_STAGES,
            ["确认出库"] if status not in ("已驳回", "rejected", "REJECTED") else [],
            milestones=milestones,
        )

    sub_stages = [
        {"key": "picking", "label": "拣货理货", "status": "done" if status not in ("草稿", "draft", "pending", "待出库") else "active"},
        {"key": "checking", "label": "出库复核", "status": "done" if status in ("已出库", "completed", "已完成") else "active" if status not in ("草稿", "draft", "pending", "待出库") else "pending"},
    ]

    key = "completed" if status in ("已出库", "completed", "已完成") else "pending_outbound"
    stage_name = "已出库" if key == "completed" else "待出库"
    return {
        "current_stage_key": key,
        "current_stage_name": stage_name,
        "status": "success" if key == "completed" else "normal",
        "main_stages": _build_main_stages(SALES_DELIVERY_MAIN_STAGES, key),
        "sub_stages": sub_stages,
        "next_step_suggestions": ["确认出库"] if key == "pending" else [],
        "milestones": milestones,
    }


# ---------------------------------------------------------------------------
# 收货通知单生命周期（待收货→已通知→已入库）
# ---------------------------------------------------------------------------
RECEIPT_NOTICE_MAIN_STAGES = [
    {"key": "pending_receive", "label": "待收货"},
    {"key": "notified", "label": "已通知"},
    {"key": "received", "label": "已入库"},
]

_RECEIPT_COMPLETED_STATUSES = frozenset({"已入库", "completed", "已完成"})


def get_receipt_notice_lifecycle(
    notice: Any,
    milestones: Optional[List[Dict[str, Any]]] = None,
    *,
    purchase_receipt_status: Optional[str] = None,
) -> Dict[str, Any]:
    """收货通知单生命周期（待收货→已通知→已入库；已入库可来自 status 或关联采购入库单状态）。"""
    status = _norm(getattr(notice, "status", None))
    milestones = milestones or []

    from apps.kuaizhizao.services.document_action_policy.lifecycle_suggestions import (
        receipt_notice_capabilities_to_suggestions,
    )
    from apps.kuaizhizao.services.document_action_policy.receipt_notice import (
        derive_receipt_notice_capabilities,
    )

    receipt_status = _norm(purchase_receipt_status) if purchase_receipt_status is not None else ""
    is_received = status in _RECEIPT_COMPLETED_STATUSES or receipt_status in _RECEIPT_COMPLETED_STATUSES
    is_notified = (
        status in ("已通知", "notified")
        or bool(getattr(notice, "purchase_receipt_id", None))
        or is_received
    )

    key = "received" if is_received else ("notified" if is_notified else "pending_receive")
    stage_name = "已入库" if key == "received" else ("已通知" if key == "notified" else "待收货")

    sub_stages = [
        {"key": "notify", "label": "通知仓库", "status": "done" if is_notified else "active"},
        {
            "key": "receiving",
            "label": "仓库收货",
            "status": "done" if is_received else ("active" if is_notified else "pending"),
        },
        {
            "key": "inbound",
            "label": "确认入库",
            "status": "done" if is_received else ("active" if is_notified else "pending"),
        },
    ]

    cap_suggestions = receipt_notice_capabilities_to_suggestions(
        derive_receipt_notice_capabilities(notice),
        current_stage_key=key,
    )

    return {
        "current_stage_key": key,
        "current_stage_name": stage_name,
        "status": "success" if key == "received" else "normal",
        "main_stages": _build_main_stages(RECEIPT_NOTICE_MAIN_STAGES, key),
        "sub_stages": sub_stages,
        "next_step_suggestions": cap_suggestions,
        "milestones": milestones,
    }


# ---------------------------------------------------------------------------
# 发货通知单生命周期（待发货→已通知→已出库）
# ---------------------------------------------------------------------------
SHIPMENT_NOTICE_MAIN_STAGES = [
    {"key": "pending_ship", "label": "待发货"},
    {"key": "notified", "label": "已通知"},
    {"key": "shipped", "label": "已出库"},
]


def get_shipment_notice_lifecycle(
    notice: Any,
    milestones: Optional[List[Dict[str, Any]]] = None
) -> Dict[str, Any]:
    """发货通知单生命周期（待发货→已通知→已出库；审核态见 record.audit）。"""
    status = _norm(getattr(notice, "status", None))
    milestones = milestones or []

    from apps.kuaizhizao.services.document_action_policy.lifecycle_suggestions import (
        shipment_notice_capabilities_to_suggestions,
    )
    from apps.kuaizhizao.services.document_action_policy.shipment_notice import (
        derive_shipment_notice_capabilities,
    )

    cap_suggestions = shipment_notice_capabilities_to_suggestions(
        derive_shipment_notice_capabilities(notice),
        current_stage_key="",
    )

    if status in ("待审核", "草稿", "draft", "已驳回", "rejected", "REJECTED"):
        return _mode_a_pre_effective_lifecycle(
            SHIPMENT_NOTICE_MAIN_STAGES,
            cap_suggestions,
            milestones=milestones,
        )

    is_shipped = status in ("已出库", "completed", "已完成") or bool(getattr(notice, "sales_delivery_id", None))
    is_notified = status in ("已通知", "notified") or is_shipped

    key = "shipped" if is_shipped else ("notified" if is_notified else "pending_ship")
    stage_name = "已出库" if key == "shipped" else ("已通知" if key == "notified" else "待发货")

    sub_stages = [
        {"key": "notify", "label": "通知仓库", "status": "done" if is_notified else "active"},
        {"key": "picking", "label": "拣货理货", "status": "done" if is_shipped else ("active" if is_notified else "pending")},
        {"key": "checking", "label": "出库复核", "status": "done" if is_shipped else ("active" if is_notified else "pending")},
    ]

    cap_suggestions = shipment_notice_capabilities_to_suggestions(
        derive_shipment_notice_capabilities(notice),
        current_stage_key=key,
    )

    return {
        "current_stage_key": key,
        "current_stage_name": stage_name,
        "status": "success" if key == "shipped" else "normal",
        "main_stages": _build_main_stages(SHIPMENT_NOTICE_MAIN_STAGES, key),
        "sub_stages": sub_stages,
        "next_step_suggestions": cap_suggestions,
        "milestones": milestones,
    }


DELIVERY_NOTICE_MAIN_STAGES = [
    {"key": "pending_send", "label": "待发送"},
    {"key": "sent", "label": "已发送"},
    {"key": "signed", "label": "已签收"},
]


def get_delivery_notice_lifecycle(
    record: Any,
    milestones: Optional[List[Dict[str, Any]]] = None,
) -> Dict[str, Any]:
    """送货单生命周期：待发送→已发送→已签收。"""
    status = _norm(getattr(record, "status", None))
    milestones = milestones or []
    status_map = {
        "待发送": "pending_send",
        "已发送": "sent",
        "已签收": "signed",
        "pending_send": "pending_send",
        "sent": "sent",
        "signed": "signed",
    }
    key = status_map.get(status, "pending_send")
    stage_name_map = {
        "pending_send": "待发送",
        "sent": "已发送",
        "signed": "已签收",
    }
    stage_name = stage_name_map.get(key, status or "待发送")
    next_step_suggestions: List[str] = []
    if key == "pending_send":
        next_step_suggestions = ["发送"]
    elif key == "sent":
        next_step_suggestions = ["签收"]
    return {
        "current_stage_key": key,
        "current_stage_name": stage_name,
        "status": "success" if key == "signed" else "normal",
        "main_stages": _build_main_stages(DELIVERY_NOTICE_MAIN_STAGES, key),
        "sub_stages": None,
        "next_step_suggestions": next_step_suggestions,
        "milestones": milestones,
    }


# ---------------------------------------------------------------------------
# 销售/采购变更单生命周期
# ---------------------------------------------------------------------------
ORDER_CHANGE_MAIN_STAGES = [
    {"key": "pending_apply", "label": "待生效"},
    {"key": "applied", "label": "已生效"},
]


def get_sales_order_change_lifecycle(
    status: Optional[str],
    review_status: Optional[str] = None,
    applied_at: Optional[Any] = None,
) -> Dict[str, Any]:
    s = _norm(status)
    from apps.kuaizhizao.services.document_action_policy.lifecycle_suggestions import (
        sales_order_change_capabilities_to_suggestions,
    )
    from apps.kuaizhizao.services.document_action_policy.sales_order_change import (
        derive_sales_order_change_capabilities,
    )

    class _ChangeShim:
        pass

    shim = _ChangeShim()
    shim.status = s
    shim.review_status = review_status

    if applied_at or s in ("APPLIED", "已生效"):
        cap_suggestions = sales_order_change_capabilities_to_suggestions(
            derive_sales_order_change_capabilities(shim),
            current_stage_key="applied",
        )
        return {
            "current_stage_key": "applied",
            "current_stage_name": "已生效",
            "status": "success",
            "main_stages": _build_main_stages(ORDER_CHANGE_MAIN_STAGES, "applied"),
            "sub_stages": [],
            "next_step_suggestions": cap_suggestions,
            "milestones": [],
        }

    if _is_rejected(review_status) or s in ("REJECTED", "已驳回"):
        cap_suggestions = sales_order_change_capabilities_to_suggestions(
            derive_sales_order_change_capabilities(shim),
            current_stage_key="",
        )
        return _mode_a_terminal_exception_lifecycle(
            "已驳回",
            ORDER_CHANGE_MAIN_STAGES,
            cap_suggestions,
        )

    cap_suggestions = sales_order_change_capabilities_to_suggestions(
        derive_sales_order_change_capabilities(shim),
        current_stage_key="pending_apply",
    )
    return {
        "current_stage_key": "pending_apply",
        "current_stage_name": "待生效",
        "status": "normal",
        "main_stages": _build_main_stages(ORDER_CHANGE_MAIN_STAGES, "pending_apply"),
        "sub_stages": [],
        "next_step_suggestions": cap_suggestions,
        "milestones": [],
    }


def get_purchase_order_change_lifecycle(
    status: Optional[str],
    review_status: Optional[str] = None,
    applied_at: Optional[Any] = None,
) -> Dict[str, Any]:
    return get_sales_order_change_lifecycle(status, review_status, applied_at)


# ---------------------------------------------------------------------------
# 销售退货单生命周期（待退货→已退货）
# ---------------------------------------------------------------------------
SALES_RETURN_MAIN_STAGES = [
    {"key": "pending_return_goods", "label": "待退货"},
    {"key": "completed", "label": "已退货"},
]


def get_sales_return_lifecycle(
    sales_return: Any,
    milestones: Optional[List[Dict[str, Any]]] = None
) -> Dict[str, Any]:
    """销售退货单生命周期计算（支持撤回确认建议）。"""
    status = _norm(getattr(sales_return, "status", None))
    milestones = milestones or []

    is_completed = status in ("已退货", "completed", "已完成")
    key = "completed" if is_completed else "pending_return_goods"
    stage_name = "已退货" if is_completed else "待退货"

    sub_stages = [
        {"key": "quality_check", "label": "退货验收", "status": "done" if is_completed else "active"},
        {"key": "stock_in", "label": "退货入库", "status": "done" if is_completed else "pending"},
    ]

    from apps.kuaizhizao.services.document_action_policy.lifecycle_suggestions import (
        sales_return_capabilities_to_suggestions,
    )
    from apps.kuaizhizao.services.document_action_policy.sales_return import (
        derive_sales_return_capabilities,
    )
    cap_suggestions = sales_return_capabilities_to_suggestions(
        derive_sales_return_capabilities(sales_return),
        current_stage_key=key,
    )

    return {
        "current_stage_key": key,
        "current_stage_name": stage_name,
        "status": "success" if is_completed else "normal",
        "main_stages": _build_main_stages(SALES_RETURN_MAIN_STAGES, key),
        "sub_stages": sub_stages,
        "next_step_suggestions": cap_suggestions,
        "milestones": milestones,
    }


# ---------------------------------------------------------------------------
# 采购退货单生命周期（待退货→已退货）
# ---------------------------------------------------------------------------
PURCHASE_RETURN_MAIN_STAGES = [
    {"key": "pending_return_goods", "label": "待退货"},
    {"key": "done", "label": "已退货"},
]

_PURCHASE_RETURN_CANCELLED_STATUSES = frozenset({"已取消", "CANCELLED", "cancelled"})
_PURCHASE_RETURN_COMPLETED_STATUSES = frozenset({"已退货", "completed", "已完成", "RETURNED"})


def get_purchase_return_lifecycle(
    purchase_return: Any,
    milestones: Optional[List[Dict[str, Any]]] = None,
) -> Dict[str, Any]:
    """采购退货单生命周期（待退货→已退货；已取消为异常分支）。"""
    status = _norm(getattr(purchase_return, "status", None))
    milestones = milestones or []

    from apps.kuaizhizao.services.document_action_policy.lifecycle_suggestions import (
        purchase_return_capabilities_to_suggestions,
    )
    from apps.kuaizhizao.services.document_action_policy.purchase_return import (
        derive_purchase_return_capabilities,
    )

    if status in _PURCHASE_RETURN_CANCELLED_STATUSES:
        cap_suggestions = purchase_return_capabilities_to_suggestions(
            derive_purchase_return_capabilities(purchase_return),
            current_stage_key="cancelled",
        )
        return {
            "current_stage_key": "cancelled",
            "current_stage_name": "已取消",
            "status": "exception",
            "main_stages": _build_main_stages(PURCHASE_RETURN_MAIN_STAGES, "pending_return_goods"),
            "sub_stages": None,
            "next_step_suggestions": cap_suggestions,
            "milestones": milestones,
        }

    is_completed = status in _PURCHASE_RETURN_COMPLETED_STATUSES
    key = "done" if is_completed else "pending_return_goods"
    stage_name = "已退货" if is_completed else "待退货"

    sub_stages = [
        {"key": "return_pick", "label": "拣货出库", "status": "done" if is_completed else "active"},
        {"key": "supplier_return", "label": "退回供应商", "status": "done" if is_completed else "pending"},
    ]

    cap_suggestions = purchase_return_capabilities_to_suggestions(
        derive_purchase_return_capabilities(purchase_return),
        current_stage_key=key,
    )

    return {
        "current_stage_key": key,
        "current_stage_name": stage_name,
        "status": "success" if is_completed else "normal",
        "main_stages": _build_main_stages(PURCHASE_RETURN_MAIN_STAGES, key),
        "sub_stages": sub_stages,
        "next_step_suggestions": cap_suggestions,
        "milestones": milestones,
    }


# ---------------------------------------------------------------------------
# 来料检验单生命周期（待检验→已检验；审核由 record.audit 独立列展示）
# ---------------------------------------------------------------------------
INCOMING_INSPECTION_MAIN_STAGES = [
    {"key": "pending_inspection", "label": "待检验"},
    {"key": "inspected", "label": "已检验"},
]


def get_incoming_inspection_lifecycle(
    inspection: Any,
    milestones: Optional[List[Dict[str, Any]]] = None
) -> Dict[str, Any]:
    """来料检验单生命周期计算。

    主阶段仅看业务检验完成态（status / inspection_result），不看 review_status。
    审核在执行检验之后（人工待审或合格自动通过）；创建不得预置审核结论。
    审核态由 record.audit / 审核状态列独立展示。
    """
    status = _norm(getattr(inspection, "status", None))
    review_status = _norm(getattr(inspection, "review_status", None))
    inspection_result = _norm(getattr(inspection, "inspection_result", None))
    milestones = milestones or []

    from apps.kuaizhizao.services.document_action_policy.lifecycle_suggestions import (
        quality_inspection_capabilities_to_suggestions,
    )
    from apps.kuaizhizao.services.document_action_policy.quality_inspection_record import (
        derive_quality_inspection_capabilities,
    )

    def _qi_sugg(stage_key: str) -> List[str]:
        caps = derive_quality_inspection_capabilities(inspection)
        return quality_inspection_capabilities_to_suggestions(
            caps,
            current_stage_key=stage_key,
        )

    # 业务已完成检验（含自动/人工审核后落库的「已审核」）
    inspected = status in ("已检验", "inspected", "已审核", "audited", "approved") or inspection_result in (
        "已检验",
        "inspected",
    )
    # 审核列独立；子阶段「结果审核」仅在检验完成后才可能完成
    audit_done = inspected and _is_approved(review_status)
    sub_stages = [
        {
            "key": "receiving",
            "label": "接单",
            "status": "done" if status or milestones else "active",
        },
        {
            "key": "testing",
            "label": "检验执行",
            "status": (
                "done"
                if inspected
                else "active"
                if status in ("pending", "待检验") or inspection_result in ("pending", "待检验", "")
                else "pending"
            ),
        },
        {
            "key": "review",
            "label": "结果审核",
            "status": "done" if audit_done else "active" if inspected else "pending",
        },
    ]

    if _is_rejected(review_status) or status in ("已驳回", "rejected"):
        return _mode_a_pre_effective_lifecycle(
            INCOMING_INSPECTION_MAIN_STAGES,
            _qi_sugg("pending_review"),
            milestones=milestones,
            sub_stages=sub_stages,
        )

    if inspected:
        for ss in sub_stages:
            if ss["key"] != "review" or audit_done:
                ss["status"] = "done"
        return {
            "current_stage_key": "inspected",
            "current_stage_name": "已检验",
            "status": "success" if audit_done else "normal",
            "main_stages": _build_main_stages(INCOMING_INSPECTION_MAIN_STAGES, "inspected"),
            "sub_stages": sub_stages,
            "next_step_suggestions": [] if audit_done else _qi_sugg("pending_review"),
            "milestones": milestones,
        }

    return {
        "current_stage_key": "pending_inspection",
        "current_stage_name": "待检验",
        "status": "normal",
        "main_stages": _build_main_stages(INCOMING_INSPECTION_MAIN_STAGES, "pending_inspection"),
        "sub_stages": sub_stages,
        "next_step_suggestions": _qi_sugg("pending_inspection"),
        "milestones": milestones,
    }


# ---------------------------------------------------------------------------
# 工序检验单、成品检验单生命周期（与来料检验相同：待检验→已检验→待审核→已审核/已驳回）
# ---------------------------------------------------------------------------
def get_process_inspection_lifecycle(
    inspection: Any,
    milestones: Optional[List[Dict[str, Any]]] = None
) -> Dict[str, Any]:
    """工序检验单生命周期计算（复用来料检验逻辑）"""
    return get_incoming_inspection_lifecycle(inspection, milestones=milestones)


def get_finished_goods_inspection_lifecycle(
    inspection: Any,
    milestones: Optional[List[Dict[str, Any]]] = None
) -> Dict[str, Any]:
    """成品检验单生命周期计算（复用来料检验逻辑）"""
    return get_incoming_inspection_lifecycle(inspection, milestones=milestones)


# ---------------------------------------------------------------------------
# 报工记录生命周期（已报工；审核由 record.audit 独立列展示）
# ---------------------------------------------------------------------------
REPORTING_RECORD_MAIN_STAGES = [
    {"key": "recorded", "label": "已报工"},
]

_REPORTING_APPROVED_STATUSES = frozenset({
    "approved", "已审核", "audited", "confirmed", "审核通过", "已通过",
})


def get_reporting_record_lifecycle(record: Any) -> Dict[str, Any]:
    """报工记录 lifecycle：审核未通过前展示 —，通过后展示已报工。"""
    status = _norm(getattr(record, "status", None))
    is_approved = status in _REPORTING_APPROVED_STATUSES
    if not is_approved:
        suggestions = ["审核"] if status not in ("rejected", "已驳回", "REJECTED") else []
        return _mode_a_pre_effective_lifecycle(REPORTING_RECORD_MAIN_STAGES, suggestions)
    return {
        "current_stage_key": "recorded",
        "current_stage_name": "已报工",
        "status": "success",
        "main_stages": _build_main_stages(REPORTING_RECORD_MAIN_STAGES, "recorded"),
        "sub_stages": None,
        "next_step_suggestions": [],
        "milestones": [],
    }


# ---------------------------------------------------------------------------
# 报价单生命周期（模式 B：主轴仅业务态 draft→已报价→客户确认→已转订单；审核由 record.audit 展示）
# ---------------------------------------------------------------------------
QUOTATION_MAIN_STAGES = [
    {"key": "draft", "label": "草稿"},
    {"key": "generated", "label": "已报价"},
    {"key": "customer_confirmed", "label": "客户确认"},
    {"key": "converted", "label": "已转订单"},
]

# 兼容旧引用（audit 节点已移出主轴）
QUOTATION_MAIN_STAGES_NO_AUDIT = QUOTATION_MAIN_STAGES
QUOTATION_MAIN_STAGES_AUDIT = QUOTATION_MAIN_STAGES


def normalize_quotation_lifecycle_filter(stage: Optional[str]) -> str:
    """列表 lifecycle_stage 筛选值归一化（与前端展示阶段、get_quotation_lifecycle 一致）。"""
    s = _norm(stage)
    aliases = {
        "已发送": "已报价",
        "已接受": "客户确认",
        "已拒绝": "已驳回",
        "rejected": "已驳回",
    }
    return aliases.get(s, s)


def _quotation_review_pending(review_status: Optional[str]) -> bool:
    r = _norm(review_status)
    return r in LEGACY_PENDING_VALUES or r in ("",)


# ---------------------------------------------------------------------------
# 需求计算生命周期（进行中→完成/失败）
# ---------------------------------------------------------------------------
DEMAND_COMPUTATION_MAIN_STAGES = [
    {"key": "running", "label": "进行中"},
    {"key": "completed", "label": "完成"},
]


def get_demand_computation_lifecycle(
    computation: Any,
    milestones: Optional[List[Dict[str, Any]]] = None
) -> Dict[str, Any]:
    """需求计算生命周期计算：根据 computation_status 映射"""
    status = _norm(getattr(computation, "computation_status", None))
    milestones = milestones or []
    status_map = {
        "进行中": "running", "计算中": "running", "pending": "running", "running": "running",
        "完成": "completed", "completed": "completed", "success": "completed",
        "失败": "failed", "failed": "failed", "error": "failed",
    }
    key = status_map.get(status, "running")
    stage_name = {"running": "进行中", "completed": "完成", "failed": "失败"}.get(key, status or "进行中")
    if status in ("失败", "failed", "error"):
        stage_name = "失败"

    if key == "failed":
        return {
            "current_stage_key": "running",
            "current_stage_name": "失败",
            "status": "exception",
            "main_stages": _build_main_stages(DEMAND_COMPUTATION_MAIN_STAGES, "running", is_exception=True),
            "sub_stages": None,
            "next_step_suggestions": ["重新计算"],
            "milestones": milestones,
        }
    if key == "completed":
        return {
            "current_stage_key": "completed",
            "current_stage_name": "完成",
            "status": "success",
            "main_stages": _build_main_stages(DEMAND_COMPUTATION_MAIN_STAGES, "completed"),
            "sub_stages": None,
            "next_step_suggestions": ["下推工单", "下推采购单", "下推生产计划", "下推采购申请"],
            "milestones": milestones,
        }
    return {
        "current_stage_key": "running",
        "current_stage_name": "进行中",
        "status": "normal",
        "main_stages": _build_main_stages(DEMAND_COMPUTATION_MAIN_STAGES, "running"),
        "sub_stages": None,
        "next_step_suggestions": ["等待计算完成"],
        "milestones": milestones,
    }


# ---------------------------------------------------------------------------
# 报价单生命周期（草稿 → 已报价 → 客户确认 → 已转订单）
# ---------------------------------------------------------------------------
def _merge_quotation_version_meta(quotation: Any, result: Dict[str, Any]) -> Dict[str, Any]:
    """为生命周期结果附加版本系列信息，供列表/详情 UniLifecycle 与引导文案使用。"""
    vn = int(getattr(quotation, "version_no", None) or 1)
    result["version_no"] = vn
    result["quotation_series_code"] = (
        getattr(quotation, "quotation_series_code", None)
        or getattr(quotation, "quotation_code", None)
        or ""
    )
    is_latest = getattr(quotation, "is_latest_in_series", True)
    result["is_latest_in_series"] = True if is_latest is None else bool(is_latest)
    st = _norm(getattr(quotation, "status", None))
    sugg = list(result.get("next_step_suggestions") or [])
    if result["is_latest_in_series"] and st not in ("草稿", "draft"):
        tag = "新建修订版"
        if tag not in sugg:
            sugg.append(tag)
    if not result["is_latest_in_series"]:
        tag = "此为历史版本，请以系列最新版为准"
        if tag not in sugg:
            sugg.append(tag)
    result["next_step_suggestions"] = sugg
    return result


def get_quotation_lifecycle(
    quotation: Any,
    milestones: Optional[List[Dict[str, Any]]] = None,
    *,
    converted_sales_order_missing: bool = False,
    contract_downstream_missing: bool = False,
    audit_required: bool = True,
) -> Dict[str, Any]:
    """报价单生命周期：主轴四节点（模式 B）；审核相位不在 main_stages 中。"""
    from apps.kuaizhizao.services.document_action_policy.quotation import (
        derive_quotation_capabilities,
        quotation_capabilities_to_suggestions,
    )

    status = _norm(getattr(quotation, "status", None))
    review_status = _norm(getattr(quotation, "review_status", None))
    milestones = milestones or []

    caps = derive_quotation_capabilities(
        quotation,
        audit_required=audit_required,
        conversion_downstream_missing=converted_sales_order_missing,
        contract_downstream_missing=contract_downstream_missing,
    )
    cap_suggestions = quotation_capabilities_to_suggestions(
        caps,
        audit_required=audit_required,
        conversion_downstream_missing=converted_sales_order_missing,
    )

    stage_defs = QUOTATION_MAIN_STAGES

    def _ret(
        key: str,
        stage_name: str,
        st: str = "normal",
        suggestions: Optional[List[str]] = None,
        exc: bool = False,
    ) -> Dict[str, Any]:
        return {
            "current_stage_key": key,
            "current_stage_name": stage_name,
            "status": st,
            "main_stages": _build_main_stages(stage_defs, key, is_exception=exc),
            "sub_stages": None,
            "next_step_suggestions": suggestions if suggestions is not None else cap_suggestions,
            "milestones": milestones,
        }

    if converted_sales_order_missing and status == "已转订单":
        return _merge_quotation_version_meta(
            quotation,
            _ret(
                "converted",
                "下推单据已删除",
                "warning",
            ),
        )

    if status in ("已拒绝", "rejected") or _is_rejected(review_status):
        return _merge_quotation_version_meta(
            quotation,
            _ret(
                "generated",
                "已驳回",
                "exception",
                exc=True,
            ),
        )

    if status in ("草稿", "draft"):
        return _merge_quotation_version_meta(
            quotation, _ret("draft", "草稿", "normal")
        )

    contract_id = getattr(quotation, "contract_id", None)
    has_live_contract = (
        contract_id is not None
        and int(contract_id) > 0
        and not contract_downstream_missing
    )

    if status == "已转订单" or has_live_contract:
        return _merge_quotation_version_meta(
            quotation, _ret("converted", "已转订单", "success", [])
        )

    if status == "已接受":
        return _merge_quotation_version_meta(
            quotation,
            _ret(
                "customer_confirmed",
                "客户确认",
                "normal",
            ),
        )

    if status == "已发送":
        return _merge_quotation_version_meta(
            quotation,
            _ret(
                "generated",
                "已报价",
                "normal",
            ),
        )

    return _merge_quotation_version_meta(
        quotation, _ret("draft", status or "草稿", "normal", [])
    )


# ---------------------------------------------------------------------------
# 销售合同生命周期（已生效→执行中→已完成/已关闭/已到期；审核相位见 record.audit）
# ---------------------------------------------------------------------------
SALES_CONTRACT_MAIN_STAGES_FINISHED = [
    {"key": "effective", "label": "已生效"},
    {"key": "executing", "label": "执行中"},
    {"key": "finished", "label": "已完成"},
]

SALES_CONTRACT_MAIN_STAGES_CLOSED = [
    {"key": "effective", "label": "已生效"},
    {"key": "executing", "label": "执行中"},
    {"key": "closed", "label": "已关闭"},
]


def _sales_contract_pre_effective_lifecycle(
    cap_suggestions: List[str],
    *,
    stage_defs: Optional[List[Dict[str, str]]] = None,
    milestones: Optional[List[Dict[str, Any]]] = None,
) -> Dict[str, Any]:
    """尚未进入业务主轴（未生效）：列表「当前阶段」展示 —，审核态见 audit 列。"""
    defs = stage_defs or SALES_CONTRACT_MAIN_STAGES_FINISHED
    return _mode_a_pre_effective_lifecycle(defs, cap_suggestions, milestones=milestones)


def get_sales_contract_lifecycle(
    contract: Any,
    milestones: Optional[List[Dict[str, Any]]] = None,
) -> Dict[str, Any]:
    """销售合同生命周期（业务主轴；审核态不在 current_stage_name 中展示）。"""
    from apps.kuaizhizao.services.document_action_policy.lifecycle_suggestions import (
        sales_contract_capabilities_to_suggestions,
    )
    from apps.kuaizhizao.services.document_action_policy.sales_contract import (
        derive_sales_contract_capabilities,
    )

    status = _norm(getattr(contract, "status", None))
    review_status = _norm(getattr(contract, "review_status", None))
    milestones = milestones or []
    caps = derive_sales_contract_capabilities(contract)
    cap_suggestions = sales_contract_capabilities_to_suggestions(caps)

    def _ret(
        key: str,
        stage_name: str,
        st: str = "normal",
        suggestions: Optional[List[str]] = None,
        exc: bool = False,
        stage_defs: Optional[List[Dict[str, str]]] = None,
    ) -> Dict[str, Any]:
        defs = stage_defs or SALES_CONTRACT_MAIN_STAGES_FINISHED
        return {
            "current_stage_key": key,
            "current_stage_name": stage_name,
            "status": st,
            "main_stages": _build_main_stages(defs, key, is_exception=exc),
            "sub_stages": None,
            "next_step_suggestions": suggestions if suggestions is not None else cap_suggestions,
            "milestones": milestones,
        }

    if status in ("已拒绝", "rejected") or _is_rejected(review_status):
        return _sales_contract_pre_effective_lifecycle(cap_suggestions, milestones=milestones)

    if status in ("草稿", "draft", "待审核", "pending_review"):
        return _sales_contract_pre_effective_lifecycle(cap_suggestions, milestones=milestones)

    if status in ("已生效", "effective"):
        return _ret("effective", "已生效", "success")

    if status in ("执行中", "executing"):
        return _ret("executing", "执行中", "success")

    if status in ("已完成", "finished"):
        return _ret("finished", "已完成", "success", [])

    if status in ("已关闭", "closed"):
        return _ret(
            "closed",
            "已关闭",
            "normal",
            [],
            stage_defs=SALES_CONTRACT_MAIN_STAGES_CLOSED,
        )

    if status in ("已到期", "expired"):
        return _ret(
            "closed",
            "已到期",
            "warning",
            ["续签或关闭合同"],
            exc=True,
            stage_defs=SALES_CONTRACT_MAIN_STAGES_CLOSED,
        )

    return _sales_contract_pre_effective_lifecycle(cap_suggestions, milestones=milestones)


# ---------------------------------------------------------------------------
# 入库单生命周期（草稿→已确认/待退料→已退料/已完成）
# ---------------------------------------------------------------------------
INBOUND_MAIN_STAGES = [
    {"key": "draft", "label": "草稿"},
    {"key": "confirmed", "label": "已确认"},
    {"key": "completed", "label": "已完成"},
]


def get_inbound_lifecycle(
    record: Any,
    milestones: Optional[List[Dict[str, Any]]] = None
) -> Dict[str, Any]:
    """入库单生命周期计算"""
    status = _norm(getattr(record, "status", None))
    milestones = milestones or []
    status_map = {
        "草稿": "draft", "draft": "draft",
        "已确认": "confirmed", "confirmed": "confirmed",
        "待退料": "confirmed", "pending_return": "confirmed",
        "已完成": "completed", "completed": "completed",
        "已退料": "completed", "returned": "completed",
        "已取消": "draft", "cancelled": "draft",
    }
    key = status_map.get(status, "draft")
    stage_name_map = {"draft": "草稿", "confirmed": "已确认", "completed": "已完成"}
    stage_name = stage_name_map.get(key, status or "草稿")
    if status in ("待退料", "pending_return"):
        stage_name = "待退料"
    elif status in ("已退料", "returned"):
        stage_name = "已退料"
    elif status in ("已取消", "cancelled"):
        stage_name = "已取消"
    is_exception = stage_name == "已取消"
    return {
        "current_stage_key": key,
        "current_stage_name": stage_name,
        "status": "exception" if is_exception else "success" if stage_name in ("已完成", "已退料") else "normal",
        "main_stages": _build_main_stages(INBOUND_MAIN_STAGES, key, is_exception=is_exception),
        "sub_stages": None,
        "next_step_suggestions": ["确认"] if stage_name == "草稿" else ["完成"] if stage_name in ("已确认", "待退料") else [],
        "milestones": milestones,
    }


# ---------------------------------------------------------------------------
# 出库单生命周期（草稿→已确认→已完成→已取消）
# ---------------------------------------------------------------------------
OUTBOUND_MAIN_STAGES = [
    {"key": "draft", "label": "草稿"},
    {"key": "confirmed", "label": "已确认"},
    {"key": "completed", "label": "已完成"},
    {"key": "cancelled", "label": "已取消"},
]


def get_outbound_lifecycle(
    record: Any,
    milestones: Optional[List[Dict[str, Any]]] = None
) -> Dict[str, Any]:
    """出库单生命周期计算"""
    status = _norm(getattr(record, "status", None))
    milestones = milestones or []
    status_map = {
        "草稿": "draft", "draft": "draft",
        "已确认": "confirmed", "confirmed": "confirmed",
        "已完成": "completed", "completed": "completed",
        "已取消": "cancelled", "cancelled": "cancelled",
    }
    key = status_map.get(status, "draft")
    stage_name_map = {"draft": "草稿", "confirmed": "已确认", "completed": "已完成", "cancelled": "已取消"}
    stage_name = stage_name_map.get(key, status or "草稿")
    return {
        "current_stage_key": key,
        "current_stage_name": stage_name,
        "status": "exception" if key == "cancelled" else "success" if key == "completed" else "normal",
        "main_stages": _build_main_stages(OUTBOUND_MAIN_STAGES, key, is_exception=(key == "cancelled")),
        "sub_stages": None,
        "next_step_suggestions": ["确认"] if key == "draft" else ["完成"] if key == "confirmed" else [],
        "milestones": milestones,
    }


# ---------------------------------------------------------------------------
# 配料单生命周期（草稿→配料中→已完成→已取消）
# ---------------------------------------------------------------------------
BATCHING_ORDER_MAIN_STAGES = [
    {"key": "draft", "label": "草稿"},
    {"key": "picking", "label": "配料中"},
    {"key": "completed", "label": "已完成"},
    {"key": "cancelled", "label": "已取消"},
]


def get_batching_order_lifecycle(
    record: Any,
    milestones: Optional[List[Dict[str, Any]]] = None
) -> Dict[str, Any]:
    """配料单生命周期计算"""
    status = _norm(getattr(record, "status", None))
    milestones = milestones or []
    status_map = {
        "草稿": "draft", "draft": "draft",
        "配料中": "picking", "picking": "picking",
        "已完成": "completed", "completed": "completed",
        "已取消": "cancelled", "cancelled": "cancelled",
    }
    key = status_map.get(status, "draft")
    stage_name_map = {"draft": "草稿", "picking": "配料中", "completed": "已完成", "cancelled": "已取消"}
    stage_name = stage_name_map.get(key, status or "草稿")
    return {
        "current_stage_key": key,
        "current_stage_name": stage_name,
        "status": "exception" if key == "cancelled" else "success" if key == "completed" else "normal",
        "main_stages": _build_main_stages(BATCHING_ORDER_MAIN_STAGES, key, is_exception=(key == "cancelled")),
        "sub_stages": None,
        "next_step_suggestions": ["确认配料"] if key == "draft" else ["完成配料"] if key == "picking" else [],
        "milestones": milestones,
    }


# ---------------------------------------------------------------------------
# 调拨单生命周期（草稿→调拨中→已完成→已取消）
# ---------------------------------------------------------------------------
INVENTORY_TRANSFER_MAIN_STAGES = [
    {"key": "draft", "label": "草稿"},
    {"key": "in_progress", "label": "调拨中"},
    {"key": "completed", "label": "已完成"},
    {"key": "cancelled", "label": "已取消"},
]


def get_inventory_transfer_lifecycle(
    record: Any,
    milestones: Optional[List[Dict[str, Any]]] = None
) -> Dict[str, Any]:
    """调拨单生命周期计算"""
    status = _norm(getattr(record, "status", None))
    milestones = milestones or []
    status_map = {
        "草稿": "draft", "draft": "draft",
        "调拨中": "in_progress", "in_progress": "in_progress",
        "已完成": "completed", "completed": "completed",
        "已取消": "cancelled", "cancelled": "cancelled",
    }
    key = status_map.get(status, "draft")
    stage_name_map = {"draft": "草稿", "in_progress": "调拨中", "completed": "已完成", "cancelled": "已取消"}
    stage_name = stage_name_map.get(key, status or "草稿")
    return {
        "current_stage_key": key,
        "current_stage_name": stage_name,
        "status": "exception" if key == "cancelled" else "success" if key == "completed" else "normal",
        "main_stages": _build_main_stages(INVENTORY_TRANSFER_MAIN_STAGES, key, is_exception=(key == "cancelled")),
        "sub_stages": None,
        "next_step_suggestions": ["执行调拨"] if key == "draft" else ["完成"] if key == "in_progress" else [],
        "milestones": milestones,
    }


# ---------------------------------------------------------------------------
# 盘点单生命周期（草稿→盘点中→已完成→已取消）
# ---------------------------------------------------------------------------
STOCKTAKING_MAIN_STAGES = [
    {"key": "draft", "label": "草稿"},
    {"key": "in_progress", "label": "盘点中"},
    {"key": "completed", "label": "已完成"},
    {"key": "cancelled", "label": "已取消"},
]


def get_stocktaking_lifecycle(
    record: Any,
    milestones: Optional[List[Dict[str, Any]]] = None
) -> Dict[str, Any]:
    """盘点单生命周期计算"""
    status = _norm(getattr(record, "status", None))
    milestones = milestones or []
    status_map = {
        "草稿": "draft", "draft": "draft",
        "盘点中": "in_progress", "in_progress": "in_progress",
        "已完成": "completed", "completed": "completed",
        "已取消": "cancelled", "cancelled": "cancelled",
    }
    key = status_map.get(status, "draft")
    stage_name_map = {"draft": "草稿", "in_progress": "盘点中", "completed": "已完成", "cancelled": "已取消"}
    stage_name = stage_name_map.get(key, status or "草稿")
    return {
        "current_stage_key": key,
        "current_stage_name": stage_name,
        "status": "exception" if key == "cancelled" else "success" if key == "completed" else "normal",
        "main_stages": _build_main_stages(STOCKTAKING_MAIN_STAGES, key, is_exception=(key == "cancelled")),
        "sub_stages": None,
        "next_step_suggestions": ["开始盘点"] if key == "draft" else ["完成盘点"] if key == "in_progress" else [],
        "milestones": milestones,
    }


# ---------------------------------------------------------------------------
# 生产领料单生命周期（待领料→已领料→已取消）
# ---------------------------------------------------------------------------
PRODUCTION_PICKING_MAIN_STAGES = [
    {"key": "draft", "label": "草稿"},
    {"key": "pending_review", "label": "待审核"},
    {"key": "pending_picking", "label": "待领料"},
    {"key": "completed", "label": "已领料"},
    {"key": "cancelled", "label": "已取消"},
]


def get_production_picking_lifecycle(
    record: Any,
    milestones: Optional[List[Dict[str, Any]]] = None,
) -> Dict[str, Any]:
    """生产领料单生命周期（草稿/待审核→待领料→已领料；与 UniAudit + 出库 Hub 对齐）。"""
    status = _norm(getattr(record, "status", None))
    milestones = milestones or []
    status_map = {
        "草稿": "draft",
        "draft": "draft",
        "待审核": "pending_review",
        "pending_review": "pending_review",
        "待领料": "pending_picking",
        "pending": "pending_picking",
        "已领料": "completed",
        "completed": "completed",
        "已完成": "completed",
        "已取消": "cancelled",
        "cancelled": "cancelled",
    }
    key = status_map.get(status, "pending_picking")
    stage_name_map = {
        "draft": "草稿",
        "pending_review": "待审核",
        "pending_picking": "待领料",
        "completed": "已领料",
        "cancelled": "已取消",
    }
    stage_name = stage_name_map.get(key, status or "待领料")
    suggestions: List[str] = []
    if key == "draft":
        suggestions = ["提交审核"]
    elif key == "pending_review":
        suggestions = ["审核"]
    elif key == "pending_picking":
        suggestions = ["确认领料"]
    return {
        "current_stage_key": key,
        "current_stage_name": stage_name,
        "status": "exception" if key == "cancelled" else "success" if key == "completed" else "normal",
        "main_stages": _build_main_stages(
            PRODUCTION_PICKING_MAIN_STAGES, key, is_exception=(key == "cancelled")
        ),
        "sub_stages": None,
        "next_step_suggestions": suggestions,
        "milestones": milestones,
    }


# ---------------------------------------------------------------------------
# 借料单生命周期（待借出→已借出→已取消）
# ---------------------------------------------------------------------------
MATERIAL_BORROW_MAIN_STAGES = [
    {"key": "pending_borrow", "label": "待借出"},
    {"key": "borrowed", "label": "已借出"},
    {"key": "cancelled", "label": "已取消"},
]


def get_material_borrow_lifecycle(
    record: Any,
    milestones: Optional[List[Dict[str, Any]]] = None
) -> Dict[str, Any]:
    """借料单生命周期计算"""
    status = _norm(getattr(record, "status", None))
    milestones = milestones or []
    status_map = {
        "待借出": "pending_borrow", "pending_borrow": "pending_borrow",
        "已借出": "borrowed", "borrowed": "borrowed",
        "已取消": "cancelled", "cancelled": "cancelled",
    }
    key = status_map.get(status, "pending_borrow")
    stage_name_map = {"pending_borrow": "待借出", "borrowed": "已借出", "cancelled": "已取消"}
    stage_name = stage_name_map.get(key, status or "待借出")
    return {
        "current_stage_key": key,
        "current_stage_name": stage_name,
        "status": "exception" if key == "cancelled" else "success" if key == "borrowed" else "normal",
        "main_stages": _build_main_stages(MATERIAL_BORROW_MAIN_STAGES, key, is_exception=(key == "cancelled")),
        "sub_stages": None,
        "next_step_suggestions": ["确认借出"] if key == "pending_borrow" else ["归还"] if key == "borrowed" else [],
        "milestones": milestones,
    }


MATERIAL_RETURN_MAIN_STAGES = [
    {"key": "pending_material_return", "label": "待归还"},
    {"key": "returned", "label": "已归还"},
    {"key": "cancelled", "label": "已取消"},
]


def get_material_return_lifecycle(
    record: Any,
    milestones: Optional[List[Dict[str, Any]]] = None,
) -> Dict[str, Any]:
    """还料单生命周期计算（与其他入库/借料列表注入方式一致）"""
    status = _norm(getattr(record, "status", None))
    milestones = milestones or []
    status_map = {
        "待归还": "pending_material_return",
        "pending_material_return": "pending_material_return",
        "已归还": "returned",
        "returned": "returned",
        "已取消": "cancelled",
        "cancelled": "cancelled",
    }
    key = status_map.get(status, "pending_material_return")
    stage_name_map = {
        "pending_material_return": "待归还",
        "returned": "已归还",
        "cancelled": "已取消",
    }
    stage_name = stage_name_map.get(key, status or "待归还")
    return {
        "current_stage_key": key,
        "current_stage_name": stage_name,
        "status": "exception" if key == "cancelled" else "success" if key == "returned" else "normal",
        "main_stages": _build_main_stages(
            MATERIAL_RETURN_MAIN_STAGES, key, is_exception=(key == "cancelled")
        ),
        "sub_stages": None,
        "next_step_suggestions": ["确认归还"] if key == "pending_material_return" else [],
        "milestones": milestones,
    }


# ---------------------------------------------------------------------------
# 其他入库/出库、委外单、委外工单、装配/拆解、异常处理（与工单或现有逻辑类似，复用或简化）
# ---------------------------------------------------------------------------
OTHER_INBOUND_MAIN_STAGES = [
    {"key": "pending_inbound", "label": "待入库"},
    {"key": "received", "label": "已入库"},
    {"key": "cancelled", "label": "已取消"},
]


def get_other_inbound_lifecycle(
    record: Any,
    milestones: Optional[List[Dict[str, Any]]] = None
) -> Dict[str, Any]:
    """其他入库单生命周期计算"""
    status = _norm(getattr(record, "status", None))
    milestones = milestones or []
    status_map = {"待入库": "pending_inbound", "已入库": "received", "已取消": "cancelled"}
    key = status_map.get(status, "pending_inbound")
    stage_name_map = {"pending_inbound": "待入库", "received": "已入库", "cancelled": "已取消"}
    stage_name = stage_name_map.get(key, status or "待入库")
    return {
        "current_stage_key": key,
        "current_stage_name": stage_name,
        "status": "exception" if key == "cancelled" else "success" if key == "received" else "normal",
        "main_stages": _build_main_stages(OTHER_INBOUND_MAIN_STAGES, key, is_exception=(key == "cancelled")),
        "sub_stages": None,
        "next_step_suggestions": ["确认入库"] if key == "pending_inbound" else [],
        "milestones": milestones,
    }


CUSTOMER_MATERIAL_REGISTRATION_MAIN_STAGES = [
    {"key": "pending_inbound", "label": "待入库"},
    {"key": "processed", "label": "已入库"},
    {"key": "cancelled", "label": "已取消"},
]


def get_customer_material_registration_lifecycle(
    record: Any,
    milestones: Optional[List[Dict[str, Any]]] = None,
) -> Dict[str, Any]:
    """代工来料（客供料登记）生命周期计算"""
    status = _norm(getattr(record, "status", None))
    milestones = milestones or []
    status_map = {
        "pending": "pending_inbound",
        "processed": "processed",
        "cancelled": "cancelled",
        "待入库": "pending_inbound",
        "已入库": "processed",
        "已取消": "cancelled",
    }
    key = status_map.get(status, "pending_inbound")
    stage_name_map = {
        "pending_inbound": "待入库",
        "processed": "已入库",
        "cancelled": "已取消",
    }
    stage_name = stage_name_map.get(key, status or "待入库")
    return {
        "current_stage_key": key,
        "current_stage_name": stage_name,
        "status": "exception" if key == "cancelled" else "success" if key == "processed" else "normal",
        "main_stages": _build_main_stages(
            CUSTOMER_MATERIAL_REGISTRATION_MAIN_STAGES, key, is_exception=(key == "cancelled")
        ),
        "sub_stages": None,
        "next_step_suggestions": ["确认入库"] if key == "pending_inbound" else [],
        "milestones": milestones,
    }


OTHER_OUTBOUND_MAIN_STAGES = [
    {"key": "pending_outbound", "label": "待出库"},
    {"key": "delivered", "label": "已出库"},
    {"key": "cancelled", "label": "已取消"},
]


def get_other_outbound_lifecycle(
    record: Any,
    milestones: Optional[List[Dict[str, Any]]] = None
) -> Dict[str, Any]:
    """其他出库单生命周期计算"""
    status = _norm(getattr(record, "status", None))
    milestones = milestones or []
    status_map = {"待出库": "pending_outbound", "已出库": "delivered", "已取消": "cancelled"}
    key = status_map.get(status, "pending_outbound")
    stage_name_map = {"pending_outbound": "待出库", "delivered": "已出库", "cancelled": "已取消"}
    stage_name = stage_name_map.get(key, status or "待出库")
    return {
        "current_stage_key": key,
        "current_stage_name": stage_name,
        "status": "exception" if key == "cancelled" else "success" if key == "delivered" else "normal",
        "main_stages": _build_main_stages(OTHER_OUTBOUND_MAIN_STAGES, key, is_exception=(key == "cancelled")),
        "sub_stages": None,
        "next_step_suggestions": ["确认出库"] if key == "pending_outbound" else [],
        "milestones": milestones,
    }


def get_outsource_work_order_lifecycle(record: Any) -> Dict[str, Any]:
    """委外工单生命周期：草稿→已下达→执行中→已完成/已取消。"""
    status = _norm(getattr(record, "status", None))
    status_map = {
        "draft": "draft",
        "released": "released",
        "in_progress": "in_progress",
        "completed": "completed",
        "cancelled": "cancelled",
        "草稿": "draft",
        "已下达": "released",
        "执行中": "in_progress",
        "已完成": "completed",
        "已取消": "cancelled",
    }
    key = status_map.get(status, "draft")
    stage_defs = [
        {"key": "draft", "label": "草稿"},
        {"key": "released", "label": "已下达"},
        {"key": "in_progress", "label": "执行中"},
        {"key": "completed", "label": "已完成"},
    ]
    is_exception = key == "cancelled"
    if is_exception:
        main_stages = [
            {"key": "draft", "label": "草稿", "status": "pending"},
            {"key": "released", "label": "已下达", "status": "pending"},
            {"key": "in_progress", "label": "执行中", "status": "pending"},
            {"key": "cancelled", "label": "已取消", "status": "active"},
        ]
        stage_name = "已取消"
    else:
        main_stages = _build_main_stages(stage_defs, key, is_exception=False)
        stage_name = next((s["label"] for s in stage_defs if s["key"] == key), key)

    suggestions: List[str] = []
    if key == "draft":
        suggestions = ["下达"]
    elif key == "released":
        suggestions = ["委外发料", "委外收货", "取消"]
    elif key == "in_progress":
        suggestions = ["委外发料", "委外收货", "强制结案"]

    return {
        "current_stage_key": key if not is_exception else "cancelled",
        "current_stage_name": stage_name,
        "status": "exception" if is_exception else "success" if key == "completed" else "active" if key == "in_progress" else "normal",
        "main_stages": main_stages,
        "sub_stages": None,
        "next_step_suggestions": suggestions,
        "milestones": [],
    }


def get_outsource_order_lifecycle(record: Any) -> Dict[str, Any]:
    """委外单生命周期（复用工单逻辑）"""
    return get_work_order_lifecycle(record)


ASSEMBLY_ORDER_MAIN_STAGES = [
    {"key": "draft", "label": "草稿"},
    {"key": "in_progress", "label": "组装中"},
    {"key": "completed", "label": "已完成"},
    {"key": "cancelled", "label": "已取消"},
]


def get_assembly_order_lifecycle(
    record: Any,
    milestones: Optional[List[Dict[str, Any]]] = None
) -> Dict[str, Any]:
    """组装单生命周期计算"""
    status = _norm(getattr(record, "status", None))
    milestones = milestones or []
    status_map = {
        "草稿": "draft", "draft": "draft",
        "组装中": "in_progress", "in_progress": "in_progress",
        "已完成": "completed", "completed": "completed",
        "已取消": "cancelled", "cancelled": "cancelled",
    }
    key = status_map.get(status, "draft")
    stage_name_map = {"draft": "草稿", "in_progress": "组装中", "completed": "已完成", "cancelled": "已取消"}
    stage_name = stage_name_map.get(key, status or "草稿")
    return {
        "current_stage_key": key,
        "current_stage_name": stage_name,
        "status": "exception" if key == "cancelled" else "success" if key == "completed" else "normal",
        "main_stages": _build_main_stages(ASSEMBLY_ORDER_MAIN_STAGES, key, is_exception=(key == "cancelled")),
        "sub_stages": None,
        "next_step_suggestions": ["执行组装"] if key == "draft" else ["完成"] if key == "in_progress" else [],
        "milestones": milestones,
    }


DISASSEMBLY_ORDER_MAIN_STAGES = [
    {"key": "draft", "label": "草稿"},
    {"key": "in_progress", "label": "拆卸中"},
    {"key": "completed", "label": "已完成"},
    {"key": "cancelled", "label": "已取消"},
]


def get_disassembly_order_lifecycle(
    record: Any,
    milestones: Optional[List[Dict[str, Any]]] = None
) -> Dict[str, Any]:
    """拆卸单生命周期计算"""
    status = _norm(getattr(record, "status", None))
    milestones = milestones or []
    status_map = {
        "草稿": "draft", "draft": "draft",
        "拆卸中": "in_progress", "in_progress": "in_progress",
        "已完成": "completed", "completed": "completed",
        "已取消": "cancelled", "cancelled": "cancelled",
    }
    key = status_map.get(status, "draft")
    stage_name_map = {"draft": "草稿", "in_progress": "拆卸中", "completed": "已完成", "cancelled": "已取消"}
    stage_name = stage_name_map.get(key, status or "草稿")
    return {
        "current_stage_key": key,
        "current_stage_name": stage_name,
        "status": "exception" if key == "cancelled" else "success" if key == "completed" else "normal",
        "main_stages": _build_main_stages(DISASSEMBLY_ORDER_MAIN_STAGES, key, is_exception=(key == "cancelled")),
        "sub_stages": None,
        "next_step_suggestions": ["执行拆卸"] if key == "draft" else ["完成"] if key == "in_progress" else [],
        "milestones": milestones,
    }


EXCEPTION_PROCESS_MAIN_STAGES = [
    {"key": "pending", "label": "待处理"},
    {"key": "processing", "label": "处理中"},
    {"key": "resolved", "label": "已解决"},
    {"key": "cancelled", "label": "已取消"},
]


def get_exception_process_lifecycle(
    record: Any,
    milestones: Optional[List[Dict[str, Any]]] = None
) -> Dict[str, Any]:
    """异常处理生命周期计算"""
    process_status = _norm(getattr(record, "process_status", None))
    milestones = milestones or []
    status_map = {
        "待处理": "pending", "pending": "pending",
        "处理中": "processing", "processing": "processing",
        "已解决": "resolved", "resolved": "resolved",
        "已取消": "cancelled", "cancelled": "cancelled",
    }
    key = status_map.get(process_status, "pending")
    stage_name_map = {"pending": "待处理", "processing": "处理中", "resolved": "已解决", "cancelled": "已取消"}
    stage_name = stage_name_map.get(key, process_status or "待处理")
    return {
        "current_stage_key": key,
        "current_stage_name": stage_name,
        "status": "exception" if key == "cancelled" else "success" if key == "resolved" else "normal",
        "main_stages": _build_main_stages(EXCEPTION_PROCESS_MAIN_STAGES, key, is_exception=(key == "cancelled")),
        "sub_stages": None,
        "next_step_suggestions": ["分配"] if key == "pending" else ["流转", "解决"] if key == "processing" else [],
        "milestones": milestones,
    }

# ---------------------------------------------------------------------------
# 设备管理生命周期 (故障上报、维修、保养)
# ---------------------------------------------------------------------------
EQUIPMENT_FAULT_MAIN_STAGES = [
    {"key": "pending", "label": "待处理"},
    {"key": "repairing", "label": "维修中"},
    {"key": "resolved", "label": "已修复"},
    {"key": "closed", "label": "已关闭"},
]

def get_equipment_fault_lifecycle(
    record: Any,
    milestones: Optional[List[Dict[str, Any]]] = None
) -> Dict[str, Any]:
    """设备故障生命周期计算"""
    status = _norm(getattr(record, "status", None))
    milestones = milestones or []
    
    # status_map 适配不同业务语义
    status_map = {
        "待处理": "pending", "pending": "pending",
        "维修中": "repairing", "repairing": "repairing",
        "已修复": "resolved", "resolved": "resolved",
        "已关闭": "closed", "closed": "closed",
        "已取消": "pending", # 映射到待处理，通过 exception 区分
    }
    key = status_map.get(status, "pending")
    is_cancelled = status in ("已取消", "cancelled")
    
    return {
        "current_stage_key": key,
        "current_stage_name": "已取消" if is_cancelled else status or "待处理",
        "status": "exception" if is_cancelled else "success" if key == "closed" else "normal",
        "main_stages": _build_main_stages(EQUIPMENT_FAULT_MAIN_STAGES, key, is_exception=is_cancelled),
        "sub_stages": None,
        "next_step_suggestions": ["接单维修"] if key == "pending" else ["确认完成"] if key == "repairing" else ["结案关闭"] if key == "resolved" else [],
        "milestones": milestones,
    }

MAINTENANCE_PLAN_MAIN_STAGES = [
    {"key": "planned", "label": "计划中"},
    {"key": "active", "label": "执行中"},
    {"key": "completed", "label": "已完成"},
]

def get_maintenance_plan_lifecycle(
    plan: Any,
    milestones: Optional[List[Dict[str, Any]]] = None
) -> Dict[str, Any]:
    """保养计划生命周期计算"""
    status = _norm(getattr(plan, "status", None))
    milestones = milestones or []
    
    key = "planned"
    if status in ("执行中", "active", "in_progress"):
        key = "active"
    elif status in ("已完成", "completed", "done"):
        key = "completed"
        
    return {
        "current_stage_key": key,
        "current_stage_name": status or "计划中",
        "status": "success" if key == "completed" else "normal",
        "main_stages": _build_main_stages(MAINTENANCE_PLAN_MAIN_STAGES, key),
        "sub_stages": None,
        "next_step_suggestions": ["开始执行"] if key == "planned" else ["标记完成"] if key == "active" else [],
        "milestones": milestones,
    }

# ---------------------------------------------------------------------------
# 报废单 lifecycle 主轴（审核由 record.audit 独立列展示）
# ---------------------------------------------------------------------------
SCRAP_RECORD_MAIN_STAGES = [
    {"key": "draft", "label": "草稿"},
    {"key": "completed", "label": "已入库/处理"},
]

def get_scrap_record_lifecycle(
    record: Any,
    milestones: Optional[List[Dict[str, Any]]] = None
) -> Dict[str, Any]:
    """报废单生命周期计算"""
    status = _norm(getattr(record, "status", None))
    review_status = _norm(getattr(record, "review_status", None))
    milestones = milestones or []

    if status in ("已完成", "completed", "已入库"):
        key = "completed"
        stage_name = "已入库/处理"
    else:
        key = "draft"
        stage_name = "草稿"

    return {
        "current_stage_key": key,
        "current_stage_name": stage_name,
        "status": "success" if key == "completed" else "normal",
        "main_stages": _build_main_stages(SCRAP_RECORD_MAIN_STAGES, key),
        "sub_stages": None,
        "next_step_suggestions": ["确认入库"] if key == "draft" and _is_approved(review_status) else [],
        "milestones": milestones,
    }
# ---------------------------------------------------------------------------
# 异步辅助方法：获取单据里程碑历史
# ---------------------------------------------------------------------------
async def get_document_milestones(
    tenant_id: int, 
    document_type: str, 
    document_id: int
) -> List[Dict[str, Any]]:
    """
    异步获取指定单据的里程碑历史记录。
    整合：创建信息、状态流转记录、关联单据产生的时间点。
    """
    milestones = []
    try:
        from apps.kuaizhizao.services.document_relation_new_service import DocumentRelationNewService
        from apps.kuaizhizao.models.state_transition import StateTransitionLog
        from apps.kuaizhizao.models.document_relation import DocumentRelation
        
        rel_svc = DocumentRelationNewService()
        
        # 1. 获取状态流转记录
        transitions = await StateTransitionLog.filter(
            tenant_id=tenant_id,
            entity_type=document_type,
            entity_id=document_id
        ).order_by("transition_time").all()
        
        for t in transitions:
            milestones.append({
                "action": "status_transition",
                "label": f"状态变更为: {t.to_state}",
                "operator": t.operator_name or str(t.operator_id or "系统"),
                "occurred_at": to_api_isoformat(t.transition_time) if t.transition_time else None,
                "status": "done"
            })

        # 2. 获取追溯链（向下追溯，看由此单据产生的后续动作）
        trace = await rel_svc.trace_document_chain(
            tenant_id=tenant_id,
            document_type=document_type,
            document_id=document_id,
            direction="downstream",
            max_depth=2
        )
        
        # 3. 收集关键节点
        if trace and trace.downstream_chain:
            for node in trace.downstream_chain:
                # 获取该关联关系的具体数据
                rel_data = await DocumentRelation.get_or_none(
                    tenant_id=tenant_id,
                    source_type=document_type,
                    source_id=document_id,
                    target_type=node.document_type,
                    target_id=node.document_id
                )
                
                milestones.append({
                    "action": f"push_to_{node.document_type}",
                    "label": f"推送到{node.document_type}: {node.document_code or node.document_type}",
                    "operator": "系统",
                    "occurred_at": to_api_isoformat(rel_data.created_at) if rel_data else None,
                    "status": "done"
                })
        
        # 4. 按时间排序（由近到远）
        milestones.sort(key=lambda x: x["occurred_at"] or "", reverse=True)
        
    except Exception as e:
        import loguru
        loguru.logger.warning(f"获取单据里程碑失败: {e}")
        
    return milestones

from apps.kuaizhizao.models.document_relation import DocumentRelation

# 统一生命周期契约：全局（非 haoligo）接入 status_class / flow_class。
for _name, _fn in list(globals().items()):
    if _name.startswith("get_") and _name.endswith("_lifecycle") and callable(_fn):
        globals()[_name] = _lifecycle_contract_wrapper(_fn)
