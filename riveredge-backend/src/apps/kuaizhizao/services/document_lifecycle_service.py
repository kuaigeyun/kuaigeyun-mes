"""
单据生命周期服务：由后端控制各单据类型的生命周期节点，前端仅展示。

每个单据类型（销售订单、需求等）在此单独配置其阶段列表；
根据单据当前数据计算当前阶段及各节点状态（done/active/pending），供前端 UniLifecycleStepper 展示。
"""

from typing import Any, Dict, List, Optional
from decimal import Decimal

from apps.kuaizhizao.constants import DemandStatus, ReviewStatus, LEGACY_AUDITED_VALUES


# ---------------------------------------------------------------------------
# 销售订单生命周期节点（后端单独控制）
# ---------------------------------------------------------------------------
SALES_ORDER_MAIN_STAGES = [
    {"key": "draft", "label": "草稿"},
    {"key": "pending_review", "label": "待审核"},
    {"key": "audited", "label": "已审核"},
    {"key": "effective", "label": "已生效"},
    {"key": "executing", "label": "执行中"},
    {"key": "delivered", "label": "已交货"},
    {"key": "completed", "label": "已完成"},
]

SALES_ORDER_EXEC_SUB_STAGES = [
    {"key": "bom_check", "label": "BOM检查"},
    {"key": "demand_compute", "label": "需求计算"},
    {"key": "material_ready", "label": "物料齐套"},
    {"key": "work_order_create", "label": "工单建立"},
    {"key": "work_order_exec", "label": "工单执行"},
    {"key": "product_inbound", "label": "成品入库"},
    {"key": "sales_delivery", "label": "销售出库/交货"},
]


# ---------------------------------------------------------------------------
# 需求生命周期节点（按业务含义独立：需求由上游审核通过自动生成，无草稿；审核 + 是否下推计算）
# ---------------------------------------------------------------------------
DEMAND_MAIN_STAGES = [
    {"key": "pending_review", "label": "待审核"},
    {"key": "rejected", "label": "已驳回"},
    {"key": "audited", "label": "已审核"},
    {"key": "pushed", "label": "已下推计算"},
]


def _norm(s: Optional[str]) -> str:
    return (s or "").strip()


def _is_rejected(review_status: Optional[str]) -> bool:
    r = _norm(review_status)
    return r in ("REJECTED", "已驳回", "审核驳回")


def _is_approved(review_status: Optional[str]) -> bool:
    r = _norm(review_status)
    return r in ("APPROVED", "审核通过", "通过", "已通过")


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
    pushed_to_computation: bool = False,
) -> Dict[str, Any]:
    """
    根据销售订单数据计算生命周期，返回供前端展示的结构。
    order: ORM 或具 status, review_status 的对象。
    """
    status = _norm(getattr(order, "status", None))
    review_status = _norm(getattr(order, "review_status", None))
    delivery = delivery_progress if delivery_progress is not None else 0.0
    invoice = invoice_progress if invoice_progress is not None else 0.0
    pushed = pushed_to_computation

    if _is_rejected(review_status):
        return {
            "current_stage_key": "pending_review",
            "current_stage_name": "已驳回",
            "status": "exception",
            "main_stages": _build_main_stages(SALES_ORDER_MAIN_STAGES, "pending_review", is_exception=True),
            "sub_stages": None,
        }
    if _is_cancelled(status):
        return {
            "current_stage_key": "draft",
            "current_stage_name": "已取消",
            "status": "exception",
            "main_stages": _build_main_stages(SALES_ORDER_MAIN_STAGES, "draft", is_exception=True),
            "sub_stages": None,
        }

    if _is_draft(status):
        return {
            "current_stage_key": "draft",
            "current_stage_name": "草稿",
            "status": "normal",
            "main_stages": _build_main_stages(SALES_ORDER_MAIN_STAGES, "draft"),
            "sub_stages": None,
        }
    if _is_pending_review(status):
        return {
            "current_stage_key": "pending_review",
            "current_stage_name": "待审核",
            "status": "normal",
            "main_stages": _build_main_stages(SALES_ORDER_MAIN_STAGES, "pending_review"),
            "sub_stages": None,
        }

    effective = _is_approved(review_status) and (
        _is_confirmed(status) or pushed
    )
    if _is_audited(status) and not effective:
        return {
            "current_stage_key": "audited",
            "current_stage_name": "已审核",
            "status": "normal",
            "main_stages": _build_main_stages(SALES_ORDER_MAIN_STAGES, "audited"),
            "sub_stages": None,
        }

    if effective and delivery >= 100 and invoice >= 100:
        return {
            "current_stage_key": "completed",
            "current_stage_name": "已完成",
            "status": "success",
            "main_stages": _build_main_stages(SALES_ORDER_MAIN_STAGES, "completed"),
            "sub_stages": None,
        }
    if effective and delivery >= 100 and invoice < 100:
        return {
            "current_stage_key": "delivered",
            "current_stage_name": "已交货",
            "status": "normal",
            "main_stages": _build_main_stages(SALES_ORDER_MAIN_STAGES, "delivered"),
            "sub_stages": None,
        }
    if effective and delivery < 100:
        has_wo = False
        if items:
            has_wo = any(getattr(it, "work_order_id", None) for it in items)
        sub_stages = []
        for s in SALES_ORDER_EXEC_SUB_STAGES:
            st = "pending"
            if s["key"] == "demand_compute" and pushed:
                st = "done"
            elif s["key"] == "work_order_create" and has_wo:
                st = "done"
            elif s["key"] == "sales_delivery":
                if delivery >= 100:
                    st = "done"
                elif delivery > 0:
                    st = "active"
            sub_stages.append({"key": s["key"], "label": s["label"], "status": st})
        if not any(ss["status"] == "active" for ss in sub_stages):
            for ss in sub_stages:
                if ss["status"] == "pending":
                    ss["status"] = "active"
                    break
        return {
            "current_stage_key": "executing",
            "current_stage_name": "执行中",
            "status": "normal",
            "main_stages": _build_main_stages(SALES_ORDER_MAIN_STAGES, "executing"),
            "sub_stages": sub_stages,
        }
    if effective:
        return {
            "current_stage_key": "effective",
            "current_stage_name": "已生效",
            "status": "normal",
            "main_stages": _build_main_stages(SALES_ORDER_MAIN_STAGES, "effective"),
            "sub_stages": None,
        }

    return {
        "current_stage_key": "audited",
        "current_stage_name": "已审核",
        "status": "normal",
        "main_stages": _build_main_stages(SALES_ORDER_MAIN_STAGES, "audited"),
        "sub_stages": None,
    }


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
    需求业务含义：来自上游审核通过后进入需求池，可下推需求计算（MRP）；无执行/交货/完成阶段。
    """
    status = _norm(getattr(demand, "status", None))
    review_status = _norm(getattr(demand, "review_status", None))
    pushed = bool(getattr(demand, "pushed_to_computation", False))

    if _is_rejected(review_status):
        return {
            "current_stage_key": "rejected",
            "current_stage_name": "已驳回",
            "status": "exception",
            "main_stages": _build_main_stages(DEMAND_MAIN_STAGES, "rejected", is_exception=True),
            "sub_stages": None,
        }

    # 需求由上游审核通过自动生成，无草稿阶段；若数据为草稿（极少手工创建），展示为待审核
    if _is_draft(status) or _is_pending_review(status):
        return {
            "current_stage_key": "pending_review",
            "current_stage_name": "待审核",
            "status": "normal",
            "main_stages": _build_main_stages(DEMAND_MAIN_STAGES, "pending_review"),
            "sub_stages": None,
        }

    if _is_audited(status) and pushed:
        return {
            "current_stage_key": "pushed",
            "current_stage_name": "已下推计算",
            "status": "success",
            "main_stages": _build_main_stages(DEMAND_MAIN_STAGES, "pushed"),
            "sub_stages": None,
        }
    if _is_audited(status):
        return {
            "current_stage_key": "audited",
            "current_stage_name": "已审核",
            "status": "normal",
            "main_stages": _build_main_stages(DEMAND_MAIN_STAGES, "audited"),
            "sub_stages": None,
        }

    return {
        "current_stage_key": "audited",
        "current_stage_name": "已审核",
        "status": "normal",
        "main_stages": _build_main_stages(DEMAND_MAIN_STAGES, "audited"),
        "sub_stages": None,
    }
