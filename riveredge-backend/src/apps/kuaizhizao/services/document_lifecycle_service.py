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
# 各阶段含义：草稿→待审核→已审核→已生效→执行中→已交货→已完成
# - 已生效：订单已确认/已下推，可开始执行，但尚未开始生产（无工单、交货0）
# - 执行中：已开始执行（BOM/需求/工单/生产/交货进行中）
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
# 工单生命周期节点（草稿→已下达→执行中→已完成，已取消为异常分支）
# ---------------------------------------------------------------------------
WORK_ORDER_MAIN_STAGES = [
    {"key": "draft", "label": "草稿"},
    {"key": "released", "label": "已下达"},
    {"key": "in_progress", "label": "执行中"},
    {"key": "completed", "label": "已完成"},
    {"key": "cancelled", "label": "已取消"},
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
            "next_step_suggestions": ["修改订单后重新提交审核"],
        }
    if _is_cancelled(status):
        return {
            "current_stage_key": "draft",
            "current_stage_name": "已取消",
            "status": "exception",
            "main_stages": _build_main_stages(SALES_ORDER_MAIN_STAGES, "draft", is_exception=True),
            "sub_stages": None,
            "next_step_suggestions": [],
        }

    if _is_draft(status):
        return {
            "current_stage_key": "draft",
            "current_stage_name": "草稿",
            "status": "normal",
            "main_stages": _build_main_stages(SALES_ORDER_MAIN_STAGES, "draft"),
            "sub_stages": None,
            "next_step_suggestions": ["提交审核"],
        }
    # 以 review_status 为准：若已审核通过则显示已审核，避免 status 未同步导致 lifecycle 显示待审核
    if _is_pending_review(status) and not _is_approved(review_status):
        return {
            "current_stage_key": "pending_review",
            "current_stage_name": "待审核",
            "status": "normal",
            "main_stages": _build_main_stages(SALES_ORDER_MAIN_STAGES, "pending_review"),
            "sub_stages": None,
            "next_step_suggestions": ["审核通过", "驳回"],
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
            "next_step_suggestions": ["下推需求计算"],
        }

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
            "current_stage_key": "delivered",
            "current_stage_name": "已交货",
            "status": "normal",
            "main_stages": _build_main_stages(SALES_ORDER_MAIN_STAGES, "delivered"),
            "sub_stages": None,
            "next_step_suggestions": ["下推销售发票"],
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
                "next_step_suggestions": ["前往需求计算执行 MRP", "建立工单"],
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
        # 根据当前 active 子阶段给出建议
        exec_suggestions = {
            "bom_check": ["完成 BOM 检查"],
            "demand_compute": ["执行需求计算（MRP）"],
            "material_ready": ["确认物料齐套"],
            "work_order_create": ["建立工单"],
            "work_order_exec": ["执行工单生产"],
            "product_inbound": ["成品入库"],
            "sales_delivery": ["销售出库/交货"],
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
        }

    return {
        "current_stage_key": "audited",
        "current_stage_name": "已审核",
        "status": "normal",
        "main_stages": _build_main_stages(SALES_ORDER_MAIN_STAGES, "audited"),
        "sub_stages": None,
        "next_step_suggestions": ["下推需求计算"],
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
            "next_step_suggestions": ["修改后重新提交上游审核"],
        }

    # 需求由上游审核通过自动生成，无草稿阶段；若数据为草稿（极少手工创建），展示为待审核
    if _is_draft(status) or _is_pending_review(status):
        return {
            "current_stage_key": "pending_review",
            "current_stage_name": "待审核",
            "status": "normal",
            "main_stages": _build_main_stages(DEMAND_MAIN_STAGES, "pending_review"),
            "sub_stages": None,
            "next_step_suggestions": ["等待上游审核"],
        }

    if _is_audited(status) and pushed:
        return {
            "current_stage_key": "pushed",
            "current_stage_name": "已下推计算",
            "status": "success",
            "main_stages": _build_main_stages(DEMAND_MAIN_STAGES, "pushed"),
            "sub_stages": None,
            "next_step_suggestions": [],
        }
    if _is_audited(status):
        return {
            "current_stage_key": "audited",
            "current_stage_name": "已审核",
            "status": "normal",
            "main_stages": _build_main_stages(DEMAND_MAIN_STAGES, "audited"),
            "sub_stages": None,
            "next_step_suggestions": ["下推需求计算"],
        }

    return {
        "current_stage_key": "audited",
        "current_stage_name": "已审核",
        "status": "normal",
        "main_stages": _build_main_stages(DEMAND_MAIN_STAGES, "audited"),
        "sub_stages": None,
        "next_step_suggestions": ["下推需求计算"],
    }


# ---------------------------------------------------------------------------
# 工单生命周期计算
# ---------------------------------------------------------------------------
def get_work_order_lifecycle(work_order: Any) -> Dict[str, Any]:
    """
    根据工单数据计算生命周期，返回供前端 UniLifecycleStepper 展示的结构。
    work_order: ORM 或具 status 的对象。
    """
    status = _norm(getattr(work_order, "status", None) or "")

    # 已取消：异常分支
    if status in ("cancelled", "已取消"):
        return {
            "current_stage_key": "cancelled",
            "current_stage_name": "已取消",
            "status": "exception",
            "main_stages": _build_main_stages(WORK_ORDER_MAIN_STAGES, "cancelled", is_exception=True),
            "sub_stages": None,
            "next_step_suggestions": [],
        }

    # 草稿
    if status in ("draft", "草稿"):
        return {
            "current_stage_key": "draft",
            "current_stage_name": "草稿",
            "status": "normal",
            "main_stages": _build_main_stages(WORK_ORDER_MAIN_STAGES, "draft"),
            "sub_stages": None,
            "next_step_suggestions": ["下达工单"],
        }

    # 已下达
    if status in ("released", "已下达"):
        return {
            "current_stage_key": "released",
            "current_stage_name": "已下达",
            "status": "normal",
            "main_stages": _build_main_stages(WORK_ORDER_MAIN_STAGES, "released"),
            "sub_stages": None,
            "next_step_suggestions": ["开始执行", "状态流转"],
        }

    # 执行中
    if status in ("in_progress", "执行中"):
        return {
            "current_stage_key": "in_progress",
            "current_stage_name": "执行中",
            "status": "active",
            "main_stages": _build_main_stages(WORK_ORDER_MAIN_STAGES, "in_progress"),
            "sub_stages": None,
            "next_step_suggestions": ["报工", "指定结束", "状态流转"],
        }

    # 已完成
    if status in ("completed", "已完成"):
        return {
            "current_stage_key": "completed",
            "current_stage_name": "已完成",
            "status": "success",
            "main_stages": _build_main_stages(WORK_ORDER_MAIN_STAGES, "completed"),
            "sub_stages": None,
            "next_step_suggestions": [],
        }

    # 未知状态兜底
    return {
        "current_stage_key": "draft",
        "current_stage_name": status or "草稿",
        "status": "normal",
        "main_stages": _build_main_stages(WORK_ORDER_MAIN_STAGES, "draft"),
        "sub_stages": None,
        "next_step_suggestions": ["状态流转"],
    }


# ---------------------------------------------------------------------------
# 采购订单生命周期节点（与销售订单类似：草稿→待审核→已审核→下推入库→已完成）
# ---------------------------------------------------------------------------
PURCHASE_ORDER_MAIN_STAGES = [
    {"key": "draft", "label": "草稿"},
    {"key": "pending_review", "label": "待审核"},
    {"key": "audited", "label": "已审核"},
    {"key": "pushed", "label": "已下推入库"},
    {"key": "completed", "label": "已完成"},
]


def get_purchase_order_lifecycle(order: Any) -> Dict[str, Any]:
    """采购订单生命周期计算（与销售订单类似，审核流程）"""
    status = _norm(getattr(order, "status", None))
    review_status = _norm(getattr(order, "review_status", None))

    if _is_rejected(review_status):
        return {
            "current_stage_key": "pending_review",
            "current_stage_name": "已驳回",
            "status": "exception",
            "main_stages": _build_main_stages(PURCHASE_ORDER_MAIN_STAGES, "pending_review", is_exception=True),
            "sub_stages": None,
            "next_step_suggestions": ["修改后重新提交审核"],
        }
    if _is_cancelled(status):
        return {
            "current_stage_key": "draft",
            "current_stage_name": "已取消",
            "status": "exception",
            "main_stages": _build_main_stages(PURCHASE_ORDER_MAIN_STAGES, "draft", is_exception=True),
            "sub_stages": None,
            "next_step_suggestions": [],
        }
    if _is_draft(status):
        return {
            "current_stage_key": "draft",
            "current_stage_name": "草稿",
            "status": "normal",
            "main_stages": _build_main_stages(PURCHASE_ORDER_MAIN_STAGES, "draft"),
            "sub_stages": None,
            "next_step_suggestions": ["提交审核"],
        }
    if _is_pending_review(status) and not _is_approved(review_status):
        return {
            "current_stage_key": "pending_review",
            "current_stage_name": "待审核",
            "status": "normal",
            "main_stages": _build_main_stages(PURCHASE_ORDER_MAIN_STAGES, "pending_review"),
            "sub_stages": None,
            "next_step_suggestions": ["审核通过", "驳回"],
        }
    if _is_audited(status) or _is_approved(review_status):
        # 简化：已审核即显示已审核，下推入库/完成由前端或后续扩展
        return {
            "current_stage_key": "audited",
            "current_stage_name": "已审核",
            "status": "normal",
            "main_stages": _build_main_stages(PURCHASE_ORDER_MAIN_STAGES, "audited"),
            "sub_stages": None,
            "next_step_suggestions": ["下推收货通知", "下推采购入库"],
        }
    return {
        "current_stage_key": "draft",
        "current_stage_name": status or "草稿",
        "status": "normal",
        "main_stages": _build_main_stages(PURCHASE_ORDER_MAIN_STAGES, "draft"),
        "sub_stages": None,
        "next_step_suggestions": ["提交审核"],
    }


# ---------------------------------------------------------------------------
# 销售预测生命周期节点（与需求类似：草稿→待审核→已审核→已下推）
# ---------------------------------------------------------------------------
SALES_FORECAST_MAIN_STAGES = [
    {"key": "draft", "label": "草稿"},
    {"key": "pending_review", "label": "待审核"},
    {"key": "audited", "label": "已审核"},
    {"key": "pushed", "label": "已下推"},
]


def get_sales_forecast_lifecycle(forecast: Any) -> Dict[str, Any]:
    """销售预测生命周期计算"""
    status = _norm(getattr(forecast, "status", None))
    review_status = _norm(getattr(forecast, "review_status", None))
    pushed = bool(getattr(forecast, "pushed_to_demand", False) or getattr(forecast, "demand_synced", False))

    if _is_rejected(review_status):
        return {
            "current_stage_key": "pending_review",
            "current_stage_name": "已驳回",
            "status": "exception",
            "main_stages": _build_main_stages(SALES_FORECAST_MAIN_STAGES, "pending_review", is_exception=True),
            "sub_stages": None,
            "next_step_suggestions": ["修改后重新提交审核"],
        }
    if _is_draft(status):
        return {
            "current_stage_key": "draft",
            "current_stage_name": "草稿",
            "status": "normal",
            "main_stages": _build_main_stages(SALES_FORECAST_MAIN_STAGES, "draft"),
            "sub_stages": None,
            "next_step_suggestions": ["提交审核"],
        }
    if _is_pending_review(status) and not _is_approved(review_status):
        return {
            "current_stage_key": "pending_review",
            "current_stage_name": "待审核",
            "status": "normal",
            "main_stages": _build_main_stages(SALES_FORECAST_MAIN_STAGES, "pending_review"),
            "sub_stages": None,
            "next_step_suggestions": ["审核通过", "驳回"],
        }
    if pushed:
        return {
            "current_stage_key": "pushed",
            "current_stage_name": "已下推",
            "status": "success",
            "main_stages": _build_main_stages(SALES_FORECAST_MAIN_STAGES, "pushed"),
            "sub_stages": None,
            "next_step_suggestions": [],
        }
    return {
        "current_stage_key": "audited",
        "current_stage_name": "已审核",
        "status": "normal",
        "main_stages": _build_main_stages(SALES_FORECAST_MAIN_STAGES, "audited"),
        "sub_stages": None,
        "next_step_suggestions": ["下推需求"],
    }


# ---------------------------------------------------------------------------
# 生产计划生命周期节点（草稿→已审核→已执行）
# ---------------------------------------------------------------------------
PRODUCTION_PLAN_MAIN_STAGES = [
    {"key": "draft", "label": "草稿"},
    {"key": "audited", "label": "已审核"},
    {"key": "executed", "label": "已执行"},
]


def get_production_plan_lifecycle(plan: Any) -> Dict[str, Any]:
    """生产计划生命周期计算"""
    status = _norm(getattr(plan, "status", None))
    execution_status = _norm(getattr(plan, "execution_status", None))

    if status in ("已取消", "cancelled") or execution_status in ("已取消", "cancelled"):
        return {
            "current_stage_key": "draft",
            "current_stage_name": "已取消",
            "status": "exception",
            "main_stages": _build_main_stages(PRODUCTION_PLAN_MAIN_STAGES, "draft", is_exception=True),
            "sub_stages": None,
            "next_step_suggestions": [],
        }
    if status in ("草稿", "draft"):
        return {
            "current_stage_key": "draft",
            "current_stage_name": "草稿",
            "status": "normal",
            "main_stages": _build_main_stages(PRODUCTION_PLAN_MAIN_STAGES, "draft"),
            "sub_stages": None,
            "next_step_suggestions": ["提交审核"],
        }
    if execution_status in ("已执行", "executed"):
        return {
            "current_stage_key": "executed",
            "current_stage_name": "已执行",
            "status": "success",
            "main_stages": _build_main_stages(PRODUCTION_PLAN_MAIN_STAGES, "executed"),
            "sub_stages": None,
            "next_step_suggestions": [],
        }
    return {
        "current_stage_key": "audited",
        "current_stage_name": "已审核",
        "status": "normal",
        "main_stages": _build_main_stages(PRODUCTION_PLAN_MAIN_STAGES, "audited"),
        "sub_stages": None,
        "next_step_suggestions": ["执行计划"],
    }


# ---------------------------------------------------------------------------
# 返工单生命周期（与工单相同：草稿→已下达→执行中→已完成→已取消）
# ---------------------------------------------------------------------------
def get_rework_order_lifecycle(rework_order: Any) -> Dict[str, Any]:
    """返工单生命周期计算（复用工单阶段）"""
    return get_work_order_lifecycle(rework_order)


# ---------------------------------------------------------------------------
# 采购申请生命周期（草稿→待审核→已通过/已驳回→部分转单→全部转单）
# ---------------------------------------------------------------------------
PURCHASE_REQUISITION_MAIN_STAGES = [
    {"key": "draft", "label": "草稿"},
    {"key": "pending_review", "label": "待审核"},
    {"key": "approved", "label": "已通过"},
    {"key": "partial", "label": "部分转单"},
    {"key": "full", "label": "全部转单"},
]


def get_purchase_requisition_lifecycle(requisition: Any) -> Dict[str, Any]:
    """采购申请生命周期计算"""
    status = _norm(getattr(requisition, "status", None))
    status_map = {
        "草稿": "draft", "draft": "draft",
        "待审核": "pending_review", "pending_review": "pending_review",
        "已驳回": "pending_review", "rejected": "pending_review",
        "已通过": "approved", "approved": "approved",
        "部分转单": "partial", "partial": "partial",
        "全部转单": "full", "full": "full",
    }
    key = status_map.get(status, "draft")
    stage_name = {"draft": "草稿", "pending_review": "待审核", "approved": "已通过",
                  "partial": "部分转单", "full": "全部转单"}.get(key, status or "草稿")
    if status in ("已驳回", "rejected"):
        stage_name = "已驳回"
    return {
        "current_stage_key": key,
        "current_stage_name": stage_name,
        "status": "exception" if stage_name == "已驳回" else "success" if key == "full" else "normal",
        "main_stages": _build_main_stages(PURCHASE_REQUISITION_MAIN_STAGES, key, is_exception=(stage_name == "已驳回")),
        "sub_stages": None,
        "next_step_suggestions": [],
    }


# ---------------------------------------------------------------------------
# 报价单生命周期（草稿→已发送→已接受/已拒绝→已转订单）
# ---------------------------------------------------------------------------
QUOTATION_MAIN_STAGES = [
    {"key": "draft", "label": "草稿"},
    {"key": "sent", "label": "已发送"},
    {"key": "accepted", "label": "已接受"},
    {"key": "converted", "label": "已转订单"},
]


def get_quotation_lifecycle(quotation: Any) -> Dict[str, Any]:
    """报价单生命周期计算"""
    status = _norm(getattr(quotation, "status", None))
    status_map = {
        "草稿": "draft", "draft": "draft",
        "已发送": "sent", "sent": "sent",
        "已接受": "accepted", "accepted": "accepted",
        "已拒绝": "sent", "rejected": "sent",
        "已转订单": "converted", "converted": "converted",
    }
    key = status_map.get(status, "draft")
    stage_name = {"draft": "草稿", "sent": "已发送", "accepted": "已接受",
                  "converted": "已转订单"}.get(key, status or "草稿")
    if status in ("已拒绝", "rejected"):
        stage_name = "已拒绝"
    return {
        "current_stage_key": key,
        "current_stage_name": stage_name,
        "status": "exception" if stage_name == "已拒绝" else "success" if key == "converted" else "normal",
        "main_stages": _build_main_stages(QUOTATION_MAIN_STAGES, key, is_exception=(stage_name == "已拒绝")),
        "sub_stages": None,
        "next_step_suggestions": [],
    }
