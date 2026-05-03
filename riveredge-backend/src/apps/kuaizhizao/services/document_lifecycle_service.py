"""
单据生命周期服务：由后端控制各单据类型的生命周期节点，前端仅展示。

每个单据类型（销售订单、需求等）在此单独配置其阶段列表；
根据单据当前数据计算当前阶段及各节点状态（done/active/pending），供前端 UniLifecycleStepper 展示。
"""

from typing import Any, Dict, List, Optional
from decimal import Decimal
from loguru import logger

from apps.kuaizhizao.constants import DemandStatus, ReviewStatus, LEGACY_AUDITED_VALUES, LEGACY_PENDING_VALUES


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
    {"key": "draft", "label": "草稿"},
    {"key": "pending_review", "label": "待审核"},
    {"key": "rejected", "label": "已驳回"},
    {"key": "audited", "label": "已审核"},
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
    pushed = pushed_to_computation or getattr(order, "planning_pushed_to_computation", False)

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
        milestones = milestones or []
        actions = {m.get("action") for m in milestones}
        
        sub_stages = [
            {"key": "bom_check", "label": "BOM检查", "status": "done"},
            {"key": "demand_compute", "label": "需求计算", "status": "done" if pushed or "push_to_demand_computation" in actions else "active"},
            {"key": "production_plan", "label": "生产计划", "status": "done" if "push_to_production_plan" in actions else "pending"},
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

        # 根据当前 active 子阶段给出建议
        exec_suggestions = {
            "bom_check": ["完成 BOM 检查"],
            "demand_compute": ["执行需求计算（MRP）"],
            "production_plan": ["制定生产计划"],
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

    return {
        "current_stage_key": "audited",
        "current_stage_name": "已审核",
        "status": "normal",
        "main_stages": _build_main_stages(SALES_ORDER_MAIN_STAGES, "audited"),
        "sub_stages": None,
        "next_step_suggestions": ["下推需求计算"],
        "milestones": milestones,
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
    demand_type = getattr(demand, "demand_type", None)
    origin_sub = _demand_origin_sub_stages(demand_type if isinstance(demand_type, str) else None)

    # 1. 异常分支：驳回
    if _is_rejected(review_status):
        return {
            "current_stage_key": "rejected",
            "current_stage_name": "已驳回",
            "status": "exception",
            "main_stages": _build_main_stages(DEMAND_MAIN_STAGES, "rejected", is_exception=True),
            "sub_stages": origin_sub,
            "next_step_suggestions": ["修改后重新提交上游审核"],
        }

    # 2. 草稿
    if _is_draft(status):
        return {
            "current_stage_key": "draft",
            "current_stage_name": "草稿",
            "status": "normal",
            "main_stages": _build_main_stages(DEMAND_MAIN_STAGES, "draft"),
            "sub_stages": origin_sub,
            "next_step_suggestions": ["提交审核"],
        }

    # 3. 待审核
    if _is_pending_review(status) and not _is_approved(review_status):
        return {
            "current_stage_key": "pending_review",
            "current_stage_name": "待审核",
            "status": "normal",
            "main_stages": _build_main_stages(DEMAND_MAIN_STAGES, "pending_review"),
            "sub_stages": origin_sub,
            "next_step_suggestions": ["审核通过", "驳回"],
        }

    # 4. 已审核与下推判断
    # 兼容性判断：只要是已生效、已审核、已通过，都视为已进入审核通过态（audited）
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
            "current_stage_key": "audited",
            "current_stage_name": "已审核",
            "status": "normal",
            "main_stages": _build_main_stages(DEMAND_MAIN_STAGES, "audited"),
            "sub_stages": origin_sub,
            "next_step_suggestions": ["下推需求计算"],
        }

    # 默认兜底
    return {
        "current_stage_key": "audited" if audited else "draft",
        "current_stage_name": "已审核" if audited else "草稿",
        "status": "normal",
        "main_stages": _build_main_stages(DEMAND_MAIN_STAGES, "audited" if audited else "draft"),
        "sub_stages": origin_sub,
        "next_step_suggestions": ["下推需求计算"] if audited else ["提交审核"],
    }


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

    # 草稿
    if status in ("draft", "草稿"):
        return {
            "current_stage_key": "draft",
            "current_stage_name": "草稿",
            "status": "normal",
            "main_stages": _build_main_stages(WORK_ORDER_MAIN_STAGES, "draft"),
            "sub_stages": None,
            "next_step_suggestions": ["下达工单"],
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
# 采购订单生命周期节点（与销售订单类似：草稿→待审核→已审核→下推入库→已完成）
# ---------------------------------------------------------------------------
PURCHASE_ORDER_MAIN_STAGES = [
    {"key": "draft", "label": "草稿"},
    {"key": "pending_review", "label": "待审核"},
    {"key": "audited", "label": "已审核"},
    {"key": "pushed", "label": "已下推入库"},
    {"key": "completed", "label": "已完成"},
]


def get_purchase_order_lifecycle(
    order: Any,
    milestones: Optional[List[Dict[str, Any]]] = None
) -> Dict[str, Any]:
    """采购订单生命周期计算（与销售订单类似，增加子阶段支撑）"""
    status = _norm(getattr(order, "status", None))
    review_status = _norm(getattr(order, "review_status", None))
    milestones = milestones or []
    actions = {m.get("action") for m in milestones}

    # 1. 计算子阶段 (基于里程碑)
    sub_stages = [
        {"key": "audited", "label": "订单审核", "status": "done" if _is_approved(review_status) else "active"},
        {"key": "shipping", "label": "供应商发货", "status": "done" if "push_to_purchase_receipt" in actions or status in ("已完成", "completed") else "active" if _is_approved(review_status) else "pending"},
        {"key": "receipt", "label": "采购入库", "status": "done" if status in ("已完成", "completed") or "push_to_purchase_receipt" in actions else "pending"},
        {"key": "invoice", "label": "采购发票", "status": "active" if status in ("已完成", "completed") else "pending"},
    ]

    if _is_rejected(review_status):
        return {
            "current_stage_key": "pending_review",
            "current_stage_name": "已驳回",
            "status": "exception",
            "main_stages": _build_main_stages(PURCHASE_ORDER_MAIN_STAGES, "pending_review", is_exception=True),
            "sub_stages": sub_stages,
            "next_step_suggestions": ["修改后重新提交审核"],
            "milestones": milestones,
        }
    if _is_cancelled(status):
        return {
            "current_stage_key": "draft",
            "current_stage_name": "已取消",
            "status": "exception",
            "main_stages": _build_main_stages(PURCHASE_ORDER_MAIN_STAGES, "draft", is_exception=True),
            "sub_stages": None,
            "next_step_suggestions": [],
            "milestones": milestones,
        }
    if _is_draft(status):
        return {
            "current_stage_key": "draft",
            "current_stage_name": "草稿",
            "status": "normal",
            "main_stages": _build_main_stages(PURCHASE_ORDER_MAIN_STAGES, "draft"),
            "sub_stages": None,
            "next_step_suggestions": ["提交审核"],
            "milestones": milestones,
        }
    if _is_pending_review(status) and not _is_approved(review_status):
        return {
            "current_stage_key": "pending_review",
            "current_stage_name": "待审核",
            "status": "normal",
            "main_stages": _build_main_stages(PURCHASE_ORDER_MAIN_STAGES, "pending_review"),
            "sub_stages": sub_stages,
            "next_step_suggestions": ["审核通过", "驳回"],
            "milestones": milestones,
        }
    
    current_key = "audited"
    if status in ("已完成", "completed"):
        current_key = "completed"
    elif "push_to_purchase_receipt" in actions:
        current_key = "pushed"

    return {
        "current_stage_key": current_key,
        "current_stage_name": "已完成" if current_key == "completed" else "已下推" if current_key == "pushed" else "已审核",
        "status": "success" if current_key == "completed" else "normal",
        "main_stages": _build_main_stages(PURCHASE_ORDER_MAIN_STAGES, current_key),
        "sub_stages": sub_stages,
        "next_step_suggestions": ["下推收货通知", "下推采购发票"] if current_key != "completed" else [],
        "milestones": milestones,
    }


# ---------------------------------------------------------------------------
# 销售预测生命周期（主轴与执行子阶段与销售订单对齐：草稿→…→已生效→执行中→已交货→已完成）
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

    if _is_rejected(review_status):
        return {
            "current_stage_key": "pending_review",
            "current_stage_name": "已驳回",
            "status": "exception",
            "main_stages": _build_main_stages(SALES_ORDER_MAIN_STAGES, "pending_review", is_exception=True),
            "sub_stages": None,
            "next_step_suggestions": ["修改预测后重新提交审核"],
        }
    if status in ("已驳回", "REJECTED", "rejected"):
        return {
            "current_stage_key": "pending_review",
            "current_stage_name": "已驳回",
            "status": "exception",
            "main_stages": _build_main_stages(SALES_ORDER_MAIN_STAGES, "pending_review", is_exception=True),
            "sub_stages": None,
            "next_step_suggestions": ["修改预测后重新提交审核"],
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
    if _is_pending_review(status) and not _is_approved(review_status):
        return {
            "current_stage_key": "pending_review",
            "current_stage_name": "待审核",
            "status": "normal",
            "main_stages": _build_main_stages(SALES_ORDER_MAIN_STAGES, "pending_review"),
            "sub_stages": None,
            "next_step_suggestions": ["审核通过", "驳回", "撤回提交（回到草稿）"],
        }

    effective = _is_approved(review_status) and (_is_confirmed(status) or pushed)
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
            {"key": "production_plan", "label": "生产计划", "status": "done" if "push_to_production_plan" in actions else "pending"},
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
            "production_plan": ["制定生产计划"],
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

    return {
        "current_stage_key": "audited",
        "current_stage_name": "已审核",
        "status": "normal",
        "main_stages": _build_main_stages(SALES_ORDER_MAIN_STAGES, "audited"),
        "sub_stages": None,
        "next_step_suggestions": ["下推需求计算"],
        "milestones": milestones,
    }


# ---------------------------------------------------------------------------
# 生产计划生命周期节点（草稿→已审核→已执行）
# ---------------------------------------------------------------------------
PRODUCTION_PLAN_MAIN_STAGES = [
    {"key": "draft", "label": "草稿"},
    {"key": "audited", "label": "已审核"},
    {"key": "executed", "label": "已执行"},
]


def get_production_plan_lifecycle(
    plan: Any,
    milestones: Optional[List[Dict[str, Any]]] = None
) -> Dict[str, Any]:
    """生产计划生命周期计算"""
    status = _norm(getattr(plan, "status", None))
    execution_status = _norm(getattr(plan, "execution_status", None))
    milestones = milestones or []

    if status in ("已取消", "cancelled") or execution_status in ("已取消", "cancelled"):
        return {
            "current_stage_key": "draft",
            "current_stage_name": "已取消",
            "status": "exception",
            "main_stages": _build_main_stages(PRODUCTION_PLAN_MAIN_STAGES, "draft", is_exception=True),
            "sub_stages": None,
            "next_step_suggestions": [],
            "milestones": milestones,
        }
    if status in ("已驳回", "rejected"):
        return {
            "current_stage_key": "draft",
            "current_stage_name": "已驳回",
            "status": "exception",
            "main_stages": _build_main_stages(PRODUCTION_PLAN_MAIN_STAGES, "draft", is_exception=True),
            "sub_stages": None,
            "next_step_suggestions": ["重新编辑后再次提交审核"],
            "milestones": milestones,
        }
    if status in ("草稿", "draft"):
        return {
            "current_stage_key": "draft",
            "current_stage_name": "草稿",
            "status": "normal",
            "main_stages": _build_main_stages(PRODUCTION_PLAN_MAIN_STAGES, "draft"),
            "sub_stages": None,
            "next_step_suggestions": ["提交审核"],
            "milestones": milestones,
        }
    if execution_status in ("已执行", "executed"):
        return {
            "current_stage_key": "executed",
            "current_stage_name": "已执行",
            "status": "success",
            "main_stages": _build_main_stages(PRODUCTION_PLAN_MAIN_STAGES, "executed"),
            "sub_stages": None,
            "next_step_suggestions": [],
            "milestones": milestones,
        }
    return {
        "current_stage_key": "audited",
        "current_stage_name": "已审核",
        "status": "normal",
        "main_stages": _build_main_stages(PRODUCTION_PLAN_MAIN_STAGES, "audited"),
        "sub_stages": None,
        "next_step_suggestions": ["执行计划"],
        "milestones": milestones,
    }


# ---------------------------------------------------------------------------
# 返工单生命周期（与工单相同：草稿→已下达→执行中→已完成→已取消）
# ---------------------------------------------------------------------------
def get_rework_order_lifecycle(
    rework_order: Any,
    milestones: Optional[List[Dict[str, Any]]] = None
) -> Dict[str, Any]:
    """返工单生命周期计算（复用工单阶段）"""
    return get_work_order_lifecycle(rework_order, milestones=milestones)


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


def get_purchase_requisition_lifecycle(
    requisition: Any,
    milestones: Optional[List[Dict[str, Any]]] = None
) -> Dict[str, Any]:
    """采购申请生命周期计算"""
    status = _norm(getattr(requisition, "status", None))
    milestones = milestones or []
    status_map = {
        "草稿": "draft", "draft": "draft",
        "待审核": "pending_review", "pending_review": "pending_review",
        "已驳回": "pending_review", "rejected": "pending_review",
        "已通过": "approved", "approved": "approved",
        "部分转单": "partial", "partial": "partial",
        "全部转单": "full", "full": "full",
        "PARTIAL_CONVERTED": "partial", "FULL_CONVERTED": "full",
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
        "next_step_suggestions": ["下推采购订单"] if key in ("approved", "partial") else [],
        "milestones": milestones,
    }


# ---------------------------------------------------------------------------
# 采购入库单生命周期（待入库→已入库）
# ---------------------------------------------------------------------------
PURCHASE_RECEIPT_MAIN_STAGES = [
    {"key": "pending", "label": "待入库"},
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

    key = "completed" if status in ("已入库", "completed", "已完成") else "pending"
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
        "next_step_suggestions": ["下推报检"] if key == "pending" and "push_to_incoming_inspection" not in actions else ["确认入库"] if key == "pending" else [],
        "milestones": milestones,
    }


# ---------------------------------------------------------------------------
# 销售出库单生命周期（待出库→已出库）
# ---------------------------------------------------------------------------
SALES_DELIVERY_MAIN_STAGES = [
    {"key": "pending", "label": "待出库"},
    {"key": "completed", "label": "已出库"},
]


def get_sales_delivery_lifecycle(
    delivery: Any,
    milestones: Optional[List[Dict[str, Any]]] = None
) -> Dict[str, Any]:
    """销售出库单生命周期计算 (增加拣货、复核子阶段)"""
    status = _norm(getattr(delivery, "status", None))
    milestones = milestones or []
    
    sub_stages = [
        {"key": "picking", "label": "拣货理货", "status": "done" if status not in ("草稿", "draft", "pending") else "active"},
        {"key": "checking", "label": "出库复核", "status": "done" if status in ("已出库", "completed") else "active" if status not in ("草稿", "draft", "pending") else "pending"},
    ]

    key = "completed" if status in ("已出库", "completed", "已完成") else "pending"
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
# 发货通知单生命周期（待发货→已通知→已出库）
# ---------------------------------------------------------------------------
SHIPMENT_NOTICE_MAIN_STAGES = [
    {"key": "pending", "label": "待发货"},
    {"key": "notified", "label": "已通知"},
    {"key": "shipped", "label": "已出库"},
]


def get_shipment_notice_lifecycle(
    notice: Any,
    milestones: Optional[List[Dict[str, Any]]] = None
) -> Dict[str, Any]:
    """发货通知单生命周期计算（参考销售出库最佳实践补全通知/执行子阶段）。"""
    status = _norm(getattr(notice, "status", None))
    milestones = milestones or []

    is_shipped = status in ("已出库", "completed", "已完成") or bool(getattr(notice, "sales_delivery_id", None))
    is_notified = status in ("已通知", "notified") or is_shipped

    key = "shipped" if is_shipped else ("notified" if is_notified else "pending")
    stage_name = "已出库" if key == "shipped" else ("已通知" if key == "notified" else "待发货")

    sub_stages = [
        {"key": "notify", "label": "通知仓库", "status": "done" if is_notified else "active"},
        {"key": "picking", "label": "拣货理货", "status": "done" if is_shipped else ("active" if is_notified else "pending")},
        {"key": "checking", "label": "出库复核", "status": "done" if is_shipped else ("active" if is_notified else "pending")},
    ]

    return {
        "current_stage_key": key,
        "current_stage_name": stage_name,
        "status": "success" if key == "shipped" else "normal",
        "main_stages": _build_main_stages(SHIPMENT_NOTICE_MAIN_STAGES, key),
        "sub_stages": sub_stages,
        "next_step_suggestions": ["通知仓库", "编辑通知明细"] if key == "pending" else (["撤回通知（回到待发货）", "执行出库"] if key == "notified" else []),
        "milestones": milestones,
    }


# ---------------------------------------------------------------------------
# 销售退货单生命周期（待退货→已退货）
# ---------------------------------------------------------------------------
SALES_RETURN_MAIN_STAGES = [
    {"key": "pending", "label": "待退货"},
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
    key = "completed" if is_completed else "pending"
    stage_name = "已退货" if is_completed else "待退货"

    sub_stages = [
        {"key": "quality_check", "label": "退货验收", "status": "done" if is_completed else "active"},
        {"key": "stock_in", "label": "退货入库", "status": "done" if is_completed else "pending"},
    ]

    return {
        "current_stage_key": key,
        "current_stage_name": stage_name,
        "status": "success" if is_completed else "normal",
        "main_stages": _build_main_stages(SALES_RETURN_MAIN_STAGES, key),
        "sub_stages": sub_stages,
        "next_step_suggestions": ["确认退货"] if key == "pending" else ["撤回确认（回到待退货）"],
        "milestones": milestones,
    }


# ---------------------------------------------------------------------------
# 来料检验单生命周期（待检验→已检验→待审核→已审核/已驳回）
# ---------------------------------------------------------------------------
INCOMING_INSPECTION_MAIN_STAGES = [
    {"key": "pending", "label": "待检验"},
    {"key": "inspected", "label": "已检验"},
    {"key": "pending_review", "label": "待审核"},
    {"key": "approved", "label": "已审核"},
]


def get_incoming_inspection_lifecycle(
    inspection: Any,
    milestones: Optional[List[Dict[str, Any]]] = None
) -> Dict[str, Any]:
    """来料检验单生命周期计算"""
    status = _norm(getattr(inspection, "status", None))
    review_status = _norm(getattr(inspection, "review_status", None))
    milestones = milestones or []
    actions = {m.get("action") for m in milestones}

    # 计算子阶段
    is_done = (status in ("已审核", "audited", "approved") or _is_approved(review_status))
    sub_stages = [
        {"key": "receiving", "label": "接单", "status": "done" if status != "pending" or milestones else "active"},
        {"key": "testing", "label": "检验执行", "status": "done" if status in ("已检验", "inspected") or is_done else "active" if status == "pending" and milestones else "pending"},
        {"key": "review", "label": "结果审核", "status": "done" if is_done else "active" if status == "inspected" else "pending"},
    ]

    if _is_rejected(review_status) or status in ("已驳回", "rejected"):
        return {
            "current_stage_key": "pending_review",
            "current_stage_name": "已驳回",
            "status": "exception",
            "main_stages": _build_main_stages(INCOMING_INSPECTION_MAIN_STAGES, "pending_review", is_exception=True),
            "sub_stages": sub_stages,
            "next_step_suggestions": ["修改并重新提交"],
            "milestones": milestones,
        }
    if is_done:
        for ss in sub_stages: ss["status"] = "done"
        return {
            "current_stage_key": "approved",
            "current_stage_name": "已审核",
            "status": "success",
            "main_stages": _build_main_stages(INCOMING_INSPECTION_MAIN_STAGES, "approved"),
            "sub_stages": sub_stages,
            "next_step_suggestions": [],
            "milestones": milestones,
        }
    if status in ("已检验", "inspected"):
        return {
            "current_stage_key": "pending_review",
            "current_stage_name": "待审核",
            "status": "normal",
            "main_stages": _build_main_stages(INCOMING_INSPECTION_MAIN_STAGES, "pending_review"),
            "sub_stages": sub_stages,
            "next_step_suggestions": ["审核"],
            "milestones": milestones,
        }
    return {
        "current_stage_key": "pending",
        "current_stage_name": "待检验",
        "status": "normal",
        "main_stages": _build_main_stages(INCOMING_INSPECTION_MAIN_STAGES, "pending"),
        "sub_stages": sub_stages,
        "next_step_suggestions": ["执行检验"],
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
# 报价单生命周期（与 status / review_status 一致的可读拆分）
# 草稿 → 已发送（提交后即此状态，内含待审核/已通过）→ 已审核 → 客户确认或转订单 → 已转订单
# ---------------------------------------------------------------------------
QUOTATION_MAIN_STAGES = [
    {"key": "draft", "label": "草稿"},
    {"key": "submitted", "label": "已发送"},
    {"key": "reviewed", "label": "已审核"},
    {"key": "send_or_push", "label": "客户确认·转订单"},
    {"key": "converted", "label": "已转订单"},
]


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
# 报价单生命周期（草稿 → 已发送 → 已审核 → 客户确认·转订单 → 已转订单）
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
) -> Dict[str, Any]:
    """报价单生命周期：结合 status 与 review_status 映射为主轴五节点（见 QUOTATION_MAIN_STAGES）。"""
    status = _norm(getattr(quotation, "status", None))
    review_status = _norm(getattr(quotation, "review_status", None))
    milestones = milestones or []

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
            "main_stages": _build_main_stages(QUOTATION_MAIN_STAGES, key, is_exception=exc),
            "sub_stages": None,
            "next_step_suggestions": suggestions or [],
            "milestones": milestones,
        }

    if converted_sales_order_missing and status == "已转订单":
        return _merge_quotation_version_meta(
            quotation,
            _ret(
                "converted",
                "已转订单（下游销售订单已删除）",
                "normal",
                [
                    "可点击「撤回下推」解除与已删订单的关联并回到已接受",
                    "或直接重新下推转销售订单（系统将自动解除无效关联）",
                    "或删除本报价单",
                ],
            ),
        )

    if status in ("已拒绝", "rejected") or _is_rejected(review_status):
        return _merge_quotation_version_meta(
            quotation,
            _ret(
                "submitted",
                "已驳回",
                "exception",
                ["修改报价单后点击「重新编辑」回到草稿，再提交审核"],
                exc=True,
            ),
        )

    if status in ("草稿", "draft"):
        return _merge_quotation_version_meta(
            quotation, _ret("draft", "草稿", "normal", ["提交报价单（进入审核）"])
        )

    if status == "已转订单":
        return _merge_quotation_version_meta(
            quotation, _ret("converted", "已转订单", "success", [])
        )

    if status == "已接受":
        return _merge_quotation_version_meta(
            quotation,
            _ret(
                "send_or_push",
                "客户已确认（待下推）",
                "normal",
                ["转销售订单（下推）"],
            ),
        )

    if status == "已发送":
        if _quotation_review_pending(review_status):
            return _merge_quotation_version_meta(
                quotation,
                _ret(
                    "submitted",
                    "待审核",
                    "normal",
                    ["审核通过", "审核驳回", "撤回提交（整单回草稿）"],
                ),
            )
        if _is_approved(review_status):
            return _merge_quotation_version_meta(
                quotation,
                _ret(
                    "reviewed",
                    "已审核",
                    "normal",
                    [
                        "客户确认（标记已接受，表示已发送/客户认可）",
                        "转销售订单（下推，可直接下推不经客户确认）",
                        "撤回审核（回到待审核）",
                    ],
                ),
            )
        return _merge_quotation_version_meta(
            quotation,
            _ret(
                "submitted",
                "待审核",
                "normal",
                ["审核通过", "审核驳回", "撤回提交（整单回草稿）"],
            ),
        )

    return _merge_quotation_version_meta(
        quotation, _ret("draft", status or "草稿", "normal", [])
    )


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
# 借料单生命周期（待借出→已借出→已取消）
# ---------------------------------------------------------------------------
MATERIAL_BORROW_MAIN_STAGES = [
    {"key": "pending", "label": "待借出"},
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
        "待借出": "pending", "pending": "pending",
        "已借出": "borrowed", "borrowed": "borrowed",
        "已取消": "cancelled", "cancelled": "cancelled",
    }
    key = status_map.get(status, "pending")
    stage_name_map = {"pending": "待借出", "borrowed": "已借出", "cancelled": "已取消"}
    stage_name = stage_name_map.get(key, status or "待借出")
    return {
        "current_stage_key": key,
        "current_stage_name": stage_name,
        "status": "exception" if key == "cancelled" else "success" if key == "borrowed" else "normal",
        "main_stages": _build_main_stages(MATERIAL_BORROW_MAIN_STAGES, key, is_exception=(key == "cancelled")),
        "sub_stages": None,
        "next_step_suggestions": ["确认借出"] if key == "pending" else ["归还"] if key == "borrowed" else [],
        "milestones": milestones,
    }


# ---------------------------------------------------------------------------
# 其他入库/出库、委外单、委外工单、装配/拆解、异常处理（与工单或现有逻辑类似，复用或简化）
# ---------------------------------------------------------------------------
OTHER_INBOUND_MAIN_STAGES = [
    {"key": "pending", "label": "待入库"},
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
    status_map = {"待入库": "pending", "已入库": "received", "已取消": "cancelled"}
    key = status_map.get(status, "pending")
    stage_name_map = {"pending": "待入库", "received": "已入库", "cancelled": "已取消"}
    stage_name = stage_name_map.get(key, status or "待入库")
    return {
        "current_stage_key": key,
        "current_stage_name": stage_name,
        "status": "exception" if key == "cancelled" else "success" if key == "received" else "normal",
        "main_stages": _build_main_stages(OTHER_INBOUND_MAIN_STAGES, key, is_exception=(key == "cancelled")),
        "sub_stages": None,
        "next_step_suggestions": ["确认入库"] if key == "pending" else [],
        "milestones": milestones,
    }


OTHER_OUTBOUND_MAIN_STAGES = [
    {"key": "pending", "label": "待出库"},
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
    status_map = {"待出库": "pending", "已出库": "delivered", "已取消": "cancelled"}
    key = status_map.get(status, "pending")
    stage_name_map = {"pending": "待出库", "delivered": "已出库", "cancelled": "已取消"}
    stage_name = stage_name_map.get(key, status or "待出库")
    return {
        "current_stage_key": key,
        "current_stage_name": stage_name,
        "status": "exception" if key == "cancelled" else "success" if key == "delivered" else "normal",
        "main_stages": _build_main_stages(OTHER_OUTBOUND_MAIN_STAGES, key, is_exception=(key == "cancelled")),
        "sub_stages": None,
        "next_step_suggestions": ["确认出库"] if key == "pending" else [],
        "milestones": milestones,
    }


def get_outsource_work_order_lifecycle(record: Any) -> Dict[str, Any]:
    """委外工单生命周期（复用工单逻辑）"""
    return get_work_order_lifecycle(record)


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
    {"key": "draft", "label": "计划中"},
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
    
    key = "draft"
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
        "next_step_suggestions": ["开始执行"] if key == "draft" else ["标记完成"] if key == "active" else [],
        "milestones": milestones,
    }

# ---------------------------------------------------------------------------
# 报废单生命周期
# ---------------------------------------------------------------------------
SCRAP_RECORD_MAIN_STAGES = [
    {"key": "pending", "label": "待审核"},
    {"key": "audited", "label": "已审核"},
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
    
    if _is_approved(review_status) or status in ("已审核", "audited"):
        key = "audited"
        if status in ("已完成", "completed", "已入库"):
            key = "completed"
    else:
        key = "pending"
        
    return {
        "current_stage_key": key,
        "current_stage_name": "待审核" if key == "pending" else "已完成" if key == "completed" else "已审核",
        "status": "success" if key == "completed" else "normal",
        "main_stages": _build_main_stages(SCRAP_RECORD_MAIN_STAGES, key),
        "sub_stages": None,
        "next_step_suggestions": ["审核通过"] if key == "pending" else ["确认入库"] if key == "audited" else [],
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
                "occurred_at": t.transition_time.isoformat() if t.transition_time else None,
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
                    "occurred_at": rel_data.created_at.isoformat() if rel_data else None,
                    "status": "done"
                })
        
        # 4. 按时间排序（由近到远）
        milestones.sort(key=lambda x: x["occurred_at"] or "", reverse=True)
        
    except Exception as e:
        import loguru
        loguru.logger.warning(f"获取单据里程碑失败: {e}")
        
    return milestones

from apps.kuaizhizao.models.document_relation import DocumentRelation
