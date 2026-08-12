"""
统一需求计算服务模块

提供统一需求计算相关的业务逻辑处理，合并MRP和LRP运算逻辑。

根据《☆ 用户使用全场景推演.md》的设计理念，将MRP和LRP合并为统一的需求计算模型。

Author: Luigi Lu
Date: 2025-01-14
"""

import asyncio
from typing import List, Optional, Dict, Any, Tuple
from datetime import datetime, timedelta, date, timezone, time
from decimal import Decimal, ROUND_CEILING
from tortoise.transactions import in_transaction
from loguru import logger

from apps.kuaizhizao.constants import DemandStatus, ReviewStatus, DocumentStatus
from apps.kuaizhizao.models.demand import Demand
from apps.kuaizhizao.models.demand_computation import DemandComputation
from apps.kuaizhizao.models.demand_computation_item import DemandComputationItem
from apps.kuaizhizao.models.demand_computation_snapshot import DemandComputationSnapshot
from apps.kuaizhizao.models.demand_computation_recalc_history import DemandComputationRecalcHistory
from apps.kuaizhizao.schemas.demand_computation import (
    DemandComputationCreate,
    DemandComputationUpdate,
    DemandComputationResponse,
    DemandComputationItemResponse,
)
from apps.kuaizhizao.utils.material_source_helper import (
    get_material_source_type,
    validate_material_source_config,
    get_material_source_config,
    expand_bom_with_source_control,
    explode_bom_one_level_for_mrp,
    resolve_computation_item_source_config,
    SOURCE_TYPE_MAKE,
    SOURCE_TYPE_BUY,
    SOURCE_TYPE_PHANTOM,
    SOURCE_TYPE_OUTSOURCE,
    SOURCE_TYPE_CONFIGURE,
    SOURCE_TYPE_CUSTOMER_PROVIDED,
    SOURCE_TYPE_GIFT,
    SOURCE_TYPE_SERVICE,
    MANUFACTURING_MODE_FABRICATION,
    MANUFACTURING_MODE_ASSEMBLY,
)
from apps.kuaizhizao.utils.mrp_scheduling_helper import (
    apply_bom_pegged_production_schedules,
    compute_backward_production_schedule,
    merge_requirement_delivery_date,
    normalize_schedule_direction,
    planning_date_to_work_order_end,
    planning_date_to_work_order_start,
    resolve_demand_item_delivery_date,
)
from apps.common.base_service import AppBaseService
from apps.common.audit_actor import (
    apply_create_audit,
    apply_update_audit,
    audit_response_fields,
    operator_name_from_user,
)
from infra.models.user import User
from apps.kuaizhizao.utils.inventory_helper import (
    get_material_inventory_info,
    batch_sum_open_supply_quantities,
    batch_list_open_supply_receipts_by_date,
)
from core.services.business.code_generation_service import CodeGenerationService
from infra.exceptions.exceptions import NotFoundError, ValidationError, BusinessLogicError
from infra.services.business_config_service import BusinessConfigService
from core.utils.timezone_utils import (
    make_aware,
    now_utc,
    resolve_business_datetime,
    today_site_str,
    to_api_isoformat,
)

# 草稿下推采购单时，无默认供应商的物料归入同一分组（supplier_id=0，名称「待定供应商」）
PURCHASE_ORDER_NO_SUPPLIER_GROUP = 0


def _extract_firmed_planned_orders(
    items: List[DemandComputationItem],
) -> Dict[int, Dict[str, Any]]:
    """
    从计算明细提取已确认/冻结计划订单，供重算保留。

    返回 {material_id: {"frozen": bool, "orders": [{qty, receipt_date, release_date, firm, frozen}]}}
    """
    out: Dict[int, Dict[str, Any]] = {}
    for item in items:
        detail = item.detail_results or {}
        supply = detail.get("supply_calculation") or {}
        orders = supply.get("planned_orders") or detail.get("planned_orders") or []
        frozen = bool(detail.get("planned_orders_frozen") or supply.get("frozen"))
        firm_orders: List[Dict[str, Any]] = []
        for po in orders:
            if not isinstance(po, dict):
                continue
            if not (po.get("firm") or po.get("frozen") or frozen):
                continue
            qty = float(po.get("qty") or 0)
            if qty <= 0:
                continue
            firm_orders.append({
                "qty": qty,
                "receipt_date": po.get("receipt_date"),
                "release_date": po.get("release_date"),
                "firm": True,
                "frozen": bool(po.get("frozen") or frozen),
            })
        if firm_orders or frozen:
            out[int(item.material_id)] = {
                "frozen": frozen or any(o.get("frozen") for o in firm_orders),
                "orders": firm_orders,
            }
    return out


def _to_utc_aware(dt: Optional[datetime]) -> Optional[datetime]:
    """统一为 UTC timezone-aware，避免 naive/aware datetime 比较报错。"""
    if dt is None:
        return None
    if dt.tzinfo is None:
        return make_aware(dt, "UTC")
    return dt.astimezone(timezone.utc)


def _safe_configurable_selections(cfg: Any) -> Optional[Dict[str, int]]:
    """安全转换 configurable_selections，JSON 中 value 可能为字符串"""
    if not cfg or not isinstance(cfg, dict):
        return None
    result = {}
    for k, v in cfg.items():
        if v is None:
            continue
        try:
            result[str(k)] = int(v)
        except (TypeError, ValueError):
            pass
    return result if result else None


def _preview_date_iso(d: Optional[Any]) -> Optional[str]:
    """需求计算预览：日期序列化为 YYYY-MM-DD"""
    if d is None:
        return None
    if isinstance(d, datetime):
        d = d.date()
    if hasattr(d, "isoformat"):
        return to_api_isoformat(d)
    return str(d)


def _preview_planned_date_iso(item: DemandComputationItem) -> Optional[str]:
    """
    预览「计划时间」：优先计划开工/请购日（已按提前期+排程缓冲倒推），与需求时间区分。
    若无开始日再回落到完成/到货日（与交期同日时仅后者有值的情况）。
    """
    for attr in (
        "production_start_date",
        "procurement_start_date",
        "production_completion_date",
        "procurement_completion_date",
    ):
        val = getattr(item, attr, None)
        if val is not None:
            return _preview_date_iso(val)
    return None


class _PreviewResultCarrier(Exception):
    """用于预览时携带结果并触发事务回滚（不持久化）"""
    def __init__(self, preview_data: Dict[str, Any]):
        self.preview_data = preview_data


def _safe_float(v: Any, default: float = 0.0) -> float:
    """将业务参数/主数据中的数量转为 float，忽略 None、空串及字符串 'None'/'null'。"""
    if v is None:
        return default
    if isinstance(v, str):
        s = v.strip()
        if not s or s.lower() in ("none", "null", "nan"):
            return default
    try:
        return float(v)
    except (TypeError, ValueError):
        return default


async def _get_material_safety_reorder(
    material: Any,
    computation_params: Dict[str, Any],
) -> tuple[float, float]:
    """
    从物料主数据与本次计算的 computation_params 获取安全库存、再订货点。
    优先级：computation_params > material.defaults.safetyStock（唯一数量真源）> 0
    MRP 不读取库存预警规则（规则仅覆盖执行域预警）。
    """
    safety = 0.0
    reorder = 0.0

    from apps.kuaizhizao.services.inventory_threshold_resolver import material_stock_thresholds

    safety_dec, _max_stock = material_stock_thresholds(material)
    if safety_dec is not None:
        safety = float(safety_dec)

    if material and isinstance(getattr(material, "defaults", None), dict):
        inv = material.defaults.get("inventory") if isinstance(material.defaults.get("inventory"), dict) else material.defaults
        if isinstance(inv, dict) and inv.get("reorder_point") is not None:
            reorder = _safe_float(inv.get("reorder_point"))

    if computation_params:
        if "safety_stock" in computation_params:
            safety = _safe_float(computation_params.get("safety_stock"), safety)
        if "reorder_point" in computation_params:
            reorder = _safe_float(computation_params.get("reorder_point"), reorder)

    return safety, reorder


async def _resolve_mrp_warehouse_ids(tenant_id: int, computation_params: Dict[str, Any]) -> List[int]:
    """
    参与 MRP 库存汇总的仓库 ID。
    - 若 computation_params 含非空 warehouse_ids：按用户选择
    - 否则：当前租户全部启用且 warehouse_type=normal 的仓库
    """
    raw = computation_params.get("warehouse_ids")
    if isinstance(raw, list):
        out: List[int] = []
        for x in raw:
            if x is None:
                continue
            try:
                out.append(int(x))
            except (TypeError, ValueError):
                continue
        if out:
            return out
        return []

    from apps.master_data.models.warehouse import Warehouse

    rows = await Warehouse.filter(
        tenant_id=tenant_id,
        deleted_at__isnull=True,
        is_active=True,
        warehouse_type="normal",
    ).values_list("id", flat=True)
    return list(rows)


def _mrp_planning_cutoff_date(computation_params: Dict[str, Any]) -> Optional[date]:
    """planning_horizon：从今天起的天数；None 表示不裁剪需求行交期。"""
    raw = computation_params.get("planning_horizon")
    if raw is None or raw == "":
        return None
    try:
        days = int(raw)
    except (TypeError, ValueError):
        return None
    if days <= 0:
        return None
    return date.today() + timedelta(days=days)


def _bom_max_level_from_params(computation_params: Dict[str, Any]) -> int:
    raw = computation_params.get("bom_expand_level")
    try:
        lv = int(raw) if raw is not None else 10
    except (TypeError, ValueError):
        lv = 10
    return max(1, min(lv, 100))


def _mrp_suggestion_basis(computation_params: Dict[str, Any]) -> str:
    """建议工单/采购/委外量依据：net=净需求（默认），gross=毛需求。"""
    v = computation_params.get("mrp_suggestion_basis")
    if isinstance(v, str) and v.strip().lower() == "gross":
        return "gross"
    return "net"


def _mrp_planning_suggestion_quantity(
    basis: str, gross_requirement: float, net_requirement: float
) -> float:
    if basis == "gross":
        return max(0.0, float(gross_requirement))
    return max(0.0, float(net_requirement))


def _netting_params_for_mrp_supply(computation_params: Dict[str, Any]) -> Dict[str, Any]:
    """
    供 _compute_supply_and_net 使用的参数副本。
    毛需求模式下关闭安全库存、在途、预留、再订货点等供需净算项，与前端隐藏开关一致。
    """
    if _mrp_suggestion_basis(computation_params) != "gross":
        return computation_params
    return {
        **computation_params,
        "include_safety_stock": False,
        "include_in_transit": False,
        "include_reserved": False,
        "include_reorder_point": False,
    }


def _decimal_opt(v: Any) -> Optional[Decimal]:
    if v is None or v == "":
        return None
    if isinstance(v, str) and v.strip().lower() in ("none", "null", "nan"):
        return None
    try:
        d = Decimal(str(v))
        return d if d > 0 else None
    except Exception:
        return None


def _extract_lot_rules(
    material: Any,
    source_type: Optional[str],
    computation_params: Dict[str, Any],
) -> tuple[Optional[Decimal], Optional[Decimal], Optional[Decimal], Optional[Decimal]]:
    """(min, max, multiple, fixed)；computation_params 全局键优先于物料 defaults。"""
    min_q = _decimal_opt(computation_params.get("suggested_qty_min"))
    max_q = _decimal_opt(computation_params.get("suggested_qty_max"))
    mult = _decimal_opt(computation_params.get("suggested_qty_multiple"))
    fixed_q = _decimal_opt(
        computation_params.get("suggested_qty_fixed")
        or computation_params.get("suggested_qty_fixed_lot")
    )

    defaults = getattr(material, "defaults", None) or {}
    if not isinstance(defaults, dict):
        return min_q, max_q, mult, fixed_q

    st = source_type or ""
    if st == SOURCE_TYPE_BUY:
        pur = defaults.get("purchase") if isinstance(defaults.get("purchase"), dict) else {}
        min_q = min_q or _decimal_opt(pur.get("min_order_quantity") or pur.get("min_order_qty"))
        max_q = max_q or _decimal_opt(pur.get("max_order_quantity") or pur.get("max_order_qty"))
        mult = mult or _decimal_opt(pur.get("order_multiple") or pur.get("quantity_multiple"))
        fixed_q = fixed_q or _decimal_opt(
            pur.get("fixed_order_quantity")
            or pur.get("fixed_lot_size")
            or pur.get("fixed_batch_quantity")
        )
    elif st in (SOURCE_TYPE_MAKE, SOURCE_TYPE_OUTSOURCE):
        prod = defaults.get("production") if isinstance(defaults.get("production"), dict) else {}
        min_q = min_q or _decimal_opt(
            prod.get("min_batch_quantity") or prod.get("min_batch_qty") or prod.get("min_order_quantity")
        )
        max_q = max_q or _decimal_opt(
            prod.get("max_batch_quantity") or prod.get("max_batch_qty") or prod.get("max_order_quantity")
        )
        mult = mult or _decimal_opt(
            prod.get("batch_multiple") or prod.get("order_multiple") or prod.get("quantity_multiple")
        )
        fixed_q = fixed_q or _decimal_opt(
            prod.get("fixed_batch_quantity")
            or prod.get("fixed_lot_size")
            or prod.get("fixed_order_quantity")
        )

    return min_q, max_q, mult, fixed_q


def _apply_suggested_lot_rules(
    raw: Decimal,
    min_q: Optional[Decimal],
    max_q: Optional[Decimal],
    mult: Optional[Decimal],
    fixed_q: Optional[Decimal] = None,
) -> Decimal:
    """批量规则：固定批量 FOQ → 最小 → 倍数 → 上限。"""
    if raw <= 0:
        return Decimal(0)
    q = raw
    if fixed_q is not None and fixed_q > 0:
        units = (q / fixed_q).to_integral_value(rounding=ROUND_CEILING)
        q = units * fixed_q
    else:
        if min_q is not None:
            q = max(q, min_q)
        if mult is not None and mult > 0:
            units = (q / mult).to_integral_value(rounding=ROUND_CEILING)
            q = units * mult
    if max_q is not None and q > max_q:
        q = max_q
    return q


def _apply_production_waste_to_qty(raw: Decimal, waste_rate: Any) -> Decimal:
    """按生产损耗率（百分比，如 5=5%）放大建议生产量：qty × (1 + waste/100)。"""
    if raw <= 0:
        return Decimal(0)
    try:
        waste = Decimal(str(waste_rate or 0))
    except Exception:
        return raw
    if waste <= 0:
        return raw
    if waste >= Decimal("100"):
        logger.warning(f"production_waste_rate={waste} 无效（须 < 100），忽略良率放大")
        return raw
    return (raw * (Decimal("1") + waste / Decimal("100"))).quantize(
        Decimal("0.0001"), rounding=ROUND_CEILING
    )


def _mrp_bom_as_of_datetime(delivery_date: Any, fallback: Optional[datetime] = None) -> datetime:
    """BOM 生效过滤基准：优先需求交期，否则计算日。"""
    if isinstance(delivery_date, datetime):
        return delivery_date
    if isinstance(delivery_date, date):
        return datetime.combine(delivery_date, time.min)
    return fallback or resolve_business_datetime()


def _deep_merge_dict(base: Optional[Dict[str, Any]], patch: Dict[str, Any]) -> Dict[str, Any]:
    out: Dict[str, Any] = dict(base or {})
    for key, value in patch.items():
        if isinstance(value, dict) and isinstance(out.get(key), dict):
            out[key] = _deep_merge_dict(out.get(key), value)
        else:
            out[key] = value
    return out


def _lead_time_missing(raw: Any) -> bool:
    if raw is None or raw == "":
        return True
    try:
        return int(raw) <= 0
    except (TypeError, ValueError):
        return True


def _collect_material_mrp_gaps(material: Any, source_type: Optional[str]) -> List[Dict[str, Any]]:
    """按来源类型检出 MRP 执行所需、但主数据未维护的字段。"""
    gaps: List[Dict[str, Any]] = []
    source_config = getattr(material, "source_config", None) or {}
    if not isinstance(source_config, dict):
        source_config = {}
    defaults = getattr(material, "defaults", None) or {}
    if not isinstance(defaults, dict):
        defaults = {}
    st = source_type or ""

    base = _material_readiness_snapshot(material, st)

    def add_gap(
        field: str,
        label: str,
        current: Any,
        suggested: Any,
        value_type: str = "number",
    ) -> None:
        gaps.append(
            {
                **base,
                "field": field,
                "label": label,
                "current": current,
                "suggested": suggested,
                "value_type": value_type,
            }
        )

    if st == SOURCE_TYPE_MAKE:
        cur = source_config.get("production_lead_time")
        if _lead_time_missing(cur):
            add_gap(
                "source_config.production_lead_time",
                "生产提前期(天)",
                cur,
                1,
                "int",
            )
        prod = defaults.get("production") if isinstance(defaults.get("production"), dict) else {}
        min_lot = prod.get("min_batch_quantity") or prod.get("min_batch_qty") or prod.get("min_order_quantity")
        mult = prod.get("batch_multiple") or prod.get("order_multiple") or prod.get("quantity_multiple")
        if _decimal_opt(min_lot) is None:
            add_gap("defaults.production.min_batch_quantity", "最小生产批量", min_lot, 1, "number")
        if _decimal_opt(mult) is None:
            add_gap("defaults.production.batch_multiple", "生产批量倍数", mult, 1, "number")
    elif st == SOURCE_TYPE_BUY:
        cur = source_config.get("purchase_lead_time")
        if _lead_time_missing(cur):
            add_gap(
                "source_config.purchase_lead_time",
                "采购提前期(天)",
                cur,
                7,
                "int",
            )
        if not source_config.get("default_supplier_id"):
            add_gap(
                "source_config.default_supplier_id",
                "默认供应商",
                source_config.get("default_supplier_id"),
                None,
                "supplier_id",
            )
        pur = defaults.get("purchase") if isinstance(defaults.get("purchase"), dict) else {}
        min_lot = pur.get("min_order_quantity") or pur.get("min_order_qty")
        mult = pur.get("order_multiple") or pur.get("quantity_multiple")
        if _decimal_opt(min_lot) is None:
            add_gap("defaults.purchase.min_order_quantity", "最小采购量", min_lot, 1, "number")
        if _decimal_opt(mult) is None:
            add_gap("defaults.purchase.order_multiple", "采购批量倍数", mult, 1, "number")
    elif st == SOURCE_TYPE_OUTSOURCE:
        cur = source_config.get("outsource_lead_time")
        if _lead_time_missing(cur):
            add_gap(
                "source_config.outsource_lead_time",
                "委外提前期(天)",
                cur,
                7,
                "int",
            )
        if not source_config.get("outsource_supplier_id") and not source_config.get("default_supplier_id"):
            add_gap(
                "source_config.outsource_supplier_id",
                "委外供应商",
                source_config.get("outsource_supplier_id"),
                None,
                "supplier_id",
            )
        prod = defaults.get("production") if isinstance(defaults.get("production"), dict) else {}
        min_lot = prod.get("min_batch_quantity") or prod.get("min_batch_qty") or prod.get("min_order_quantity")
        mult = prod.get("batch_multiple") or prod.get("order_multiple") or prod.get("quantity_multiple")
        if _decimal_opt(min_lot) is None:
            add_gap("defaults.production.min_batch_quantity", "最小委外批量", min_lot, 1, "number")
        if _decimal_opt(mult) is None:
            add_gap("defaults.production.batch_multiple", "委外批量倍数", mult, 1, "number")

    if st in (SOURCE_TYPE_MAKE, SOURCE_TYPE_BUY, SOURCE_TYPE_OUTSOURCE):
        from apps.kuaizhizao.services.inventory_threshold_resolver import material_stock_thresholds

        safety_dec, _ = material_stock_thresholds(material)
        if safety_dec is None:
            inv = defaults.get("inventory") if isinstance(defaults.get("inventory"), dict) else defaults
            cur_safety = None
            if isinstance(inv, dict):
                cur_safety = inv.get("safetyStock")
                if cur_safety is None:
                    cur_safety = inv.get("safety_stock")
            add_gap("defaults.safetyStock", "安全库存", cur_safety, 0, "number")

        inv = defaults.get("inventory") if isinstance(defaults.get("inventory"), dict) else defaults
        reorder_cur = inv.get("reorder_point") if isinstance(inv, dict) else None
        if reorder_cur is None and isinstance(defaults, dict):
            reorder_cur = defaults.get("reorder_point")
        if reorder_cur is None or (isinstance(reorder_cur, str) and not str(reorder_cur).strip()):
            add_gap("defaults.reorder_point", "再订货点", reorder_cur, 0, "number")

    return gaps


def _material_readiness_snapshot(material: Any, source_type: Optional[str]) -> Dict[str, Any]:
    """执行前补齐弹窗：物料展示快照（不写库）。"""
    source_config = getattr(material, "source_config", None) or {}
    if not isinstance(source_config, dict):
        source_config = {}
    st = (source_type or getattr(material, "source_type", None) or "").strip() or None
    spec = getattr(material, "specification", None)
    unit = getattr(material, "base_unit", None)
    mfg_mode = source_config.get("manufacturing_mode")
    return {
        "material_id": int(material.id),
        "material_uuid": str(getattr(material, "uuid", "") or ""),
        "material_code": str(getattr(material, "main_code", "") or ""),
        "material_name": str(getattr(material, "name", "") or ""),
        "material_spec": str(spec).strip() if spec else None,
        "material_unit": str(unit).strip() if unit else None,
        "source_type": st,
        "manufacturing_mode": str(mfg_mode).strip() if mfg_mode else None,
    }


def _material_bom_overridden(
    material_id: int,
    params: Dict[str, Any],
    *,
    is_seed: bool,
) -> bool:
    """执行参数中是否为该物料指定了 BOM 版本（与 MRP 顶层逻辑一致）。"""
    mbv = params.get("material_bom_versions") or {}
    v = mbv.get(material_id) or mbv.get(str(material_id))
    if v:
        return True
    return bool(is_seed and params.get("bom_version"))


def _collect_material_structure_gaps(
    material: Any,
    source_type: Optional[str],
    *,
    has_bom: bool,
    bom_overridden: bool,
) -> List[Dict[str, Any]]:
    """检出来源配置/BOM/工艺路线等结构性缺失（可补齐或需跳转主数据）。"""
    gaps: List[Dict[str, Any]] = []
    source_config = getattr(material, "source_config", None) or {}
    if not isinstance(source_config, dict):
        source_config = {}
    st = source_type or ""

    base = _material_readiness_snapshot(material, st)

    def add_gap(
        field: str,
        label: str,
        current: Any,
        suggested: Any,
        value_type: str = "number",
        *,
        blocking: bool = False,
    ) -> None:
        gaps.append(
            {
                **base,
                "field": field,
                "label": label,
                "current": current,
                "suggested": suggested,
                "value_type": value_type,
                "blocking": blocking,
            }
        )

    if not st:
        add_gap("source_type", "物料来源类型", None, "Make", "source_type")
        return gaps

    bom_ok = has_bom or bom_overridden
    has_process_route = bool(getattr(material, "process_route_id", None))

    if st == SOURCE_TYPE_MAKE:
        manufacturing_mode = source_config.get("manufacturing_mode")
        if not manufacturing_mode:
            add_gap(
                "source_config.manufacturing_mode",
                "制造模式",
                manufacturing_mode,
                MANUFACTURING_MODE_ASSEMBLY,
                "manufacturing_mode",
            )
        elif manufacturing_mode == MANUFACTURING_MODE_FABRICATION:
            if not has_process_route:
                add_gap("process_route_id", "工艺路线", None, None, "process_route_id")
        elif manufacturing_mode == MANUFACTURING_MODE_ASSEMBLY:
            if not bom_ok:
                add_gap(
                    "_bom",
                    "BOM配置",
                    None,
                    None,
                    "info",
                    blocking=True,
                )
        else:
            if not bom_ok:
                add_gap("_bom", "BOM配置", None, None, "info", blocking=True)
            if not has_process_route:
                add_gap("process_route_id", "工艺路线", None, None, "process_route_id")
    elif st == SOURCE_TYPE_PHANTOM:
        if not bom_ok:
            add_gap("_bom", "BOM配置", None, None, "info", blocking=True)
    elif st == SOURCE_TYPE_OUTSOURCE:
        if not source_config.get("outsource_operation"):
            add_gap(
                "source_config.outsource_operation",
                "委外工序",
                source_config.get("outsource_operation"),
                "",
                "text",
            )

    return gaps


def _dedupe_readiness_gaps(gaps: List[Dict[str, Any]]) -> List[Dict[str, Any]]:
    seen: set[tuple[int, str]] = set()
    out: List[Dict[str, Any]] = []
    for gap in gaps:
        key = (int(gap.get("material_id") or 0), str(gap.get("field") or ""))
        if key in seen:
            continue
        seen.add(key)
        out.append(gap)
    return out


def _compute_supply_and_net(
    inventory_info: Dict[str, Any],
    safety_stock: float,
    reorder_point: float,
    gross_requirement: float,
    computation_params: Dict[str, Any],
) -> tuple[float, float, Dict[str, Any]]:
    """
    按可配置参数计算可供应量与净需求。
    公式：可供应量 = 可用库存 + [在途] - [安全库存]
    净需求 = max(0, 毛需求 - 可供应量)
    若 include_reorder_point：当可供应量 < 再订货点时，净需求至少补足到再订货点
    """
    include_safety = computation_params.get("include_safety_stock", True)
    include_in_transit = computation_params.get("include_in_transit", False)
    include_reserved = computation_params.get("include_reserved", False)
    include_reorder = computation_params.get("include_reorder_point", False)

    # available = 在库 - 预留；include_reserved 为 true 时用 available（考虑预留），否则用 on_hand（在库）
    if include_reserved:
        available = _safe_float(inventory_info.get("available_quantity"))
    else:
        available = _safe_float(
            inventory_info.get("on_hand", inventory_info.get("available_quantity"))
        )
    in_transit = _safe_float(inventory_info.get("in_transit_quantity"))
    on_hand = _safe_float(inventory_info.get("on_hand"))
    avail_col = _safe_float(inventory_info.get("available_quantity"))

    supply = available
    if include_in_transit:
        supply += in_transit
    if include_safety:
        supply -= safety_stock

    net_base = max(0.0, gross_requirement - supply)
    if include_reorder and reorder_point > 0 and supply < reorder_point:
        net_reorder = max(0.0, reorder_point - supply)
        net_requirement = max(net_base, net_reorder)
    else:
        net_requirement = net_base

    def _fmt(n: float) -> str:
        s = f"{float(n):.4f}".rstrip("0").rstrip(".")
        return s if s else "0"

    lines_zh: List[str] = []
    if include_reserved:
        lines_zh.append(
            f"净需求计算基数（可供应起点）= 可用库存 = 在库({_fmt(on_hand)}) − 线边预留 = {_fmt(avail_col)}"
        )
    else:
        lines_zh.append(
            f"净需求计算基数（可供应起点）= 在库合计（不减预留）= {_fmt(available)}（本列「可用库存」为 {_fmt(avail_col)}）"
        )
    if include_in_transit:
        lines_zh.append(f"计入在途 / 在制：+{_fmt(in_transit)}")
    if include_safety:
        lines_zh.append(f"扣减安全库存：−{_fmt(float(safety_stock))}")
    lines_zh.append(f"可供应量 = {_fmt(supply)}")
    lines_zh.append(
        f"净需求 = max(0, 毛需求({_fmt(gross_requirement)}) − 可供应量)；当前结果 = {_fmt(net_requirement)}"
    )
    if include_reorder and reorder_point > 0:
        lines_zh.append(
            f"已启用再订货点：当可供应 < 再订货点({_fmt(float(reorder_point))}) 时，净需求会与「补足到再订货点」取较大值"
        )

    calc_detail: Dict[str, Any] = {
        "include_reserved": include_reserved,
        "include_in_transit": include_in_transit,
        "include_safety_stock": include_safety,
        "include_reorder_point": include_reorder,
        "on_hand": on_hand,
        "available_quantity_column": avail_col,
        "base_for_supply": available,
        "in_transit_quantity": in_transit,
        "safety_stock": float(safety_stock),
        "reorder_point": float(reorder_point),
        "supply": supply,
        "gross_requirement": float(gross_requirement),
        "net_requirement": float(net_requirement),
        "lines_zh": lines_zh,
    }
    return supply, net_requirement, calc_detail


DEMAND_COMPUTATION_SORTABLE_FIELDS = frozenset({
    "computation_code",
    "demand_code",
    "demand_type",
    "business_mode",
    "computation_type",
    "computation_status",
    "computation_start_time",
    "computation_end_time",
    "created_at",
    "updated_at",
})


class DemandComputationService(AppBaseService):
    """统一需求计算服务"""

    def __init__(self) -> None:
        super().__init__(DemandComputation)
    
    async def create_computation(
        self,
        tenant_id: int,
        computation_data: DemandComputationCreate,
        created_by: int
    ) -> DemandComputationResponse:
        """
        创建需求计算
        
        Args:
            tenant_id: 租户ID
            computation_data: 计算数据
            created_by: 创建人ID
            
        Returns:
            DemandComputationResponse: 创建的计算响应
        """
        # 解析需求列表（支持 demand_id 或 demand_ids）
        demand_id_list = (
            computation_data.demand_ids
            if computation_data.demand_ids
            else ([computation_data.demand_id] if computation_data.demand_id else [])
        )
        if not demand_id_list:
            raise BusinessLogicError("必须提供 demand_id 或 demand_ids")

        # 先只读校验 + 生成编码，避免编码服务（CodeSequence 等）与 Demand 更新同一大事务内长时间持锁
        demands_preview: List[Demand] = []
        for did in demand_id_list:
            d = await Demand.get_or_none(tenant_id=tenant_id, id=did, deleted_at__isnull=True)
            if not d:
                raise NotFoundError(f"需求不存在: {did}")
            from apps.kuaizhizao.services.document_action_policy.demand import (
                assert_demand_capability,
            )

            assert_demand_capability(d, "merge_computation")
            demands_preview.append(d)

        modes = {getattr(d, "business_mode", None) for d in demands_preview}
        if "MTO" in modes:
            merged_business_mode = "MTO"
        elif "ATO" in modes:
            merged_business_mode = "ATO"
        else:
            merged_business_mode = "MTS"
        persist_computation_type = "MRP"

        computation_code = await self._generate_computation_code(tenant_id, persist_computation_type)

        async with in_transaction():
            # 事务内再取一次需求，避免与校验之间状态变化；并保持 demand_id_list 顺序
            demands: List[Demand] = []
            for did in demand_id_list:
                d = await Demand.get_or_none(tenant_id=tenant_id, id=did, deleted_at__isnull=True)
                if not d:
                    raise NotFoundError(f"需求不存在: {did}")
                from apps.kuaizhizao.services.document_action_policy.demand import (
                    assert_demand_capability,
                )

                assert_demand_capability(d, "merge_computation")
                demands.append(d)

            demand = demands[0]
            # 展示“来源单号”：首个来源单号；多来源为「第一个等N个」
            source_codes = [
                (str(getattr(x, "source_code", "") or "").strip() or str(getattr(x, "demand_code", "") or "").strip())
                for x in demands
            ]
            source_codes = [c for c in source_codes if c]
            if not source_codes:
                demand_codes = demand.demand_code or ""
            elif len(demands) == 1:
                demand_codes = source_codes[0]
            else:
                demand_codes = f"{source_codes[0]}等{len(demands)}个"

            user = await User.get_or_none(id=created_by)
            create_data: Dict[str, Any] = {
                "tenant_id": tenant_id,
                "computation_code": computation_code,
                "demand_id": demand.id,
                "demand_ids": demand_id_list,
                "demand_code": demand_codes,
                "demand_type": demand.demand_type,
                "business_mode": merged_business_mode,
                "computation_type": persist_computation_type,
                "computation_params": computation_data.computation_params,
                "computation_status": "进行中",
                "computation_start_time": resolve_business_datetime(),
                "notes": computation_data.notes,
                "created_by": created_by,
            }
            apply_create_audit(create_data, user)
            computation = await DemandComputation.create(**create_data)
            
            # 2. 创建需求计算结果明细 (若创建时带了已计算好的明细)
            items = []
            for item_data in computation_data.items or []:
                item = await DemandComputationItem.create(
                    tenant_id=tenant_id,
                    computation_id=computation.id,
                    **item_data.model_dump()
                )
                items.append(item)

            # 3. 更新需求状态并建立关联
            from apps.kuaizhizao.models.document_relation import DocumentRelation
            from apps.kuaizhizao.services.demand_service import DemandService

            # 3.1 批量更新下推标记 (确保所有参与工作的需求都被标记)
            push_audit: Dict[str, Any] = {
                "pushed_to_computation": True,
                "computation_id": computation.id,
                "computation_code": computation_code,
                "updated_at": resolve_business_datetime(),
            }
            apply_update_audit(push_audit, user)
            await Demand.filter(tenant_id=tenant_id, id__in=demand_id_list).update(**push_audit)

            demand_svc = DemandService()
            for d in demands:
                await demand_svc.sync_upstream_planning_on_push(
                    tenant_id, d, computation.id, computation_code
                )

                # 建立单据关联记录（需求 -> 需求计算）
                await DocumentRelation.get_or_create(
                    tenant_id=tenant_id,
                    source_type="demand",
                    source_id=d.id,
                    target_type="demand_computation",
                    target_id=computation.id,
                    defaults={
                        "relation_type": "source",
                        "relation_mode": "push",
                        "relation_desc": f"下推到需求计算 {computation_code}",
                        "source_code": d.demand_code,
                        "target_code": computation_code,
                        "demand_id": d.id,
                        "created_by": created_by,
                    },
                )

            return await self._build_computation_response(computation, items)
    
    async def _generate_computation_code(
        self,
        tenant_id: int,
        computation_type: str
    ) -> str:
        """
        生成需求计算编码（单据编码模块：kuaizhizao-demand-computation / DEMAND_COMPUTATION_CODE）
        
        Args:
            tenant_id: 租户ID
            computation_type: 计算类型（恒为 MRP）
            
        Returns:
            str: 计算编码
        """
        from core.config.code_rule_pages import get_canonical_rule_code

        rule_code = get_canonical_rule_code("kuaizhizao-demand-computation")
        if not rule_code:
            raise ValidationError("需求计算页面未配置编码规则")
        return await CodeGenerationService.generate_code(
            tenant_id=tenant_id,
            rule_code=rule_code,
            context={"computation_type": computation_type},
        )
    
    async def _build_computation_response(
        self,
        computation: DemandComputation,
        items: List[DemandComputationItem]
    ) -> DemandComputationResponse:
        """构建计算响应对象，填充计划员赋能增强字段"""
        from apps.kuaizhizao.services.document_lifecycle_service import get_demand_computation_lifecycle

        today = date.today()
        item_responses = []
        for item in items:
            resp = DemandComputationItemResponse.model_validate(item)
            
            # 1. 计算就绪度 (Readiness)
            req_qty = float(item.gross_requirement or item.required_quantity or 0)
            avail_qty = float(item.available_inventory or 0)
            
            if req_qty <= 0:
                resp.readiness_status = "Ready"
                resp.readiness_rate = 1.0
            else:
                resp.readiness_rate = min(1.0, avail_qty / req_qty)
                if avail_qty >= req_qty:
                    resp.readiness_status = "Ready"
                elif avail_qty > 0:
                    resp.readiness_status = "Partial"
                else:
                    resp.readiness_status = "Shortage"
            
            # 2. 计算交期风险 (Lead Time Risk)
            # 如果计划开始日期早于今天，说明已经产生延迟风险
            is_risk = False
            start_date = item.production_start_date or item.procurement_start_date
            if start_date and start_date < today and (item.net_requirement or 0) > 0:
                is_risk = True
            resp.is_overdue_risk = is_risk
            
            item_responses.append(resp)

        lifecycle = get_demand_computation_lifecycle(computation)
        exclusions = await self._get_already_pushed_exclusions(computation.tenant_id, computation.id)
        downstream_push_progress = self._compute_downstream_push_progress(
            computation, items, exclusions
        )

        # 来源单号抽屉链接：按首个需求解析上游单据 ID（勿用 demand_id 冒充销售订单/预测 ID）
        source_id: Optional[int] = None
        raw_ids = computation.demand_ids
        if isinstance(raw_ids, list) and len(raw_ids) > 0:
            demand_id_list = [int(x) for x in raw_ids if x is not None and str(x).strip() != ""]
        elif computation.demand_id:
            demand_id_list = [int(computation.demand_id)]
        else:
            demand_id_list = []
        # 去重保序（JSON 异常重复时仍可链接）
        seen_demand_ids: set[int] = set()
        uniq_demand_ids: List[int] = []
        for did in demand_id_list:
            if did in seen_demand_ids:
                continue
            seen_demand_ids.add(did)
            uniq_demand_ids.append(did)
        demand_id_list = uniq_demand_ids

        display_demand_code = computation.demand_code or ""
        first_demand_row: Optional[Demand] = None
        if demand_id_list:
            first_demand_row = await Demand.get_or_none(
                tenant_id=computation.tenant_id,
                id=demand_id_list[0],
                deleted_at__isnull=True,
            )
            if first_demand_row:
                dtype = computation.demand_type or first_demand_row.demand_type
                if dtype == "demand_plan":
                    source_id = first_demand_row.id
                elif dtype in ("sales_order", "sales_forecast") and first_demand_row.source_id:
                    source_id = int(first_demand_row.source_id)

        # 多来源统一展示：第一个等N个（兼容历史逗号拼接）
        source_count = len(demand_id_list)
        if source_count > 1:
            first_code = ""
            if first_demand_row:
                first_code = (
                    str(getattr(first_demand_row, "source_code", "") or "").strip()
                    or str(getattr(first_demand_row, "demand_code", "") or "").strip()
                )
            if not first_code and display_demand_code:
                head = display_demand_code.split(",")[0].split("，")[0].strip()
                if "等" in head:
                    head = head.split("等", 1)[0].strip()
                first_code = head
            if first_code:
                display_demand_code = f"{first_code}等{source_count}个"

        response = DemandComputationResponse(
            id=computation.id,
            uuid=str(computation.uuid),
            tenant_id=computation.tenant_id,
            computation_code=computation.computation_code,
            demand_id=computation.demand_id,
            demand_ids=computation.demand_ids if computation.demand_ids else None,
            demand_code=display_demand_code,
            demand_type=computation.demand_type,
            business_mode=computation.business_mode,
            computation_type=computation.computation_type,
            computation_params=computation.computation_params,
            computation_status=computation.computation_status,
            computation_start_time=computation.computation_start_time,
            computation_end_time=computation.computation_end_time,
            computation_summary=computation.computation_summary,
            error_message=computation.error_message,
            notes=computation.notes,
            created_at=computation.created_at,
            updated_at=computation.updated_at,
            **audit_response_fields(computation),
            source_id=source_id,
            items=item_responses,
            lifecycle=lifecycle,
            downstream_push_progress=downstream_push_progress,
        )
        from apps.kuaizhizao.services.document_action_policy.enricher import (
            enrich_demand_computation_capabilities_on_response,
        )

        return enrich_demand_computation_capabilities_on_response(computation, response)
    
    async def get_computation_by_id(
        self,
        tenant_id: int,
        computation_id: int,
        include_items: bool = True
    ) -> DemandComputationResponse:
        """
        根据ID获取需求计算
        
        Args:
            tenant_id: 租户ID
            computation_id: 计算ID
            include_items: 是否包含明细
            
        Returns:
            DemandComputationResponse: 计算响应
        """
        computation = await DemandComputation.get_or_none(tenant_id=tenant_id, id=computation_id)
        if not computation:
            raise NotFoundError(f"需求计算不存在: {computation_id}")
        
        items = []
        if include_items:
            items = await DemandComputationItem.filter(
                tenant_id=tenant_id,
                computation_id=computation_id
            ).all()
        
        return await self._build_computation_response(computation, items)
    
    async def list_computations(
        self,
        tenant_id: int,
        demand_id: Optional[int] = None,
        demand_code: Optional[str] = None,
        computation_code: Optional[str] = None,
        computation_type: Optional[str] = None,
        computation_status: Optional[str] = None,
        business_mode: Optional[str] = None,
        demand_type: Optional[str] = None,
        start_date: Optional[str] = None,
        end_date: Optional[str] = None,
        created_start_date: Optional[date] = None,
        created_end_date: Optional[date] = None,
        keyword: Optional[str] = None,
        order_by: Optional[str] = None,
        skip: int = 0,
        limit: int = 20
    ) -> Dict[str, Any]:
        """
        获取需求计算列表
        
        Args:
            tenant_id: 租户ID
            demand_id: 需求ID（可选）
            demand_code: 需求编码（可选，支持模糊查询）
            computation_code: 计算编码（可选，支持模糊查询）
            computation_type: 计算类型（可选）
            computation_status: 计算状态（可选）
            business_mode: 业务模式（可选）
            start_date: 开始日期（可选，YYYY-MM-DD格式）
            end_date: 结束日期（可选，YYYY-MM-DD格式）
            skip: 跳过数量
            limit: 限制数量
            
        Returns:
            Dict: 包含计算列表和总数的字典
        """
        from tortoise.expressions import Q
        from datetime import datetime
        
        query = DemandComputation.filter(tenant_id=tenant_id)
        
        if demand_id:
            query = query.filter(demand_id=demand_id)
        if demand_code:
            query = query.filter(demand_code__icontains=demand_code)
        if computation_code:
            query = query.filter(computation_code__icontains=computation_code)
        if computation_type:
            # 兼容旧客户端：LRP → 按 MTO 筛选；MRP → 按 MTS 筛选
            if computation_type == "LRP":
                query = query.filter(business_mode="MTO")
            elif computation_type == "MRP":
                query = query.filter(business_mode="MTS")
            else:
                query = query.filter(computation_type=computation_type)
        if computation_status:
            query = query.filter(computation_status=computation_status)
        if business_mode:
            query = query.filter(business_mode=business_mode)
        if demand_type:
            query = query.filter(demand_type=demand_type)
        kw = (keyword or "").strip()
        if kw:
            query = query.filter(
                Q(computation_code__icontains=kw)
                | Q(demand_code__icontains=kw)
                | Q(notes__icontains=kw)
            )
        cc = (computation_code or "").strip()
        if cc:
            query = query.filter(computation_code__icontains=cc)
        dc = (demand_code or "").strip()
        if dc:
            query = query.filter(demand_code__icontains=dc)
        if start_date:
            try:
                start_dt = datetime.strptime(start_date, "%Y-%m-%d")
                query = query.filter(computation_start_time__gte=start_dt)
            except ValueError:
                pass  # 忽略无效的日期格式
        if end_date:
            try:
                end_dt = datetime.strptime(end_date, "%Y-%m-%d")
                # 结束日期需要包含整天，所以设置为当天的23:59:59
                from datetime import timedelta
                end_dt = end_dt + timedelta(days=1) - timedelta(seconds=1)
                query = query.filter(computation_start_time__lte=end_dt)
            except ValueError:
                pass  # 忽略无效的日期格式
        if created_start_date is not None:
            query = query.filter(created_at__gte=datetime.combine(created_start_date, time.min))
        if created_end_date is not None:
            query = query.filter(created_at__lte=datetime.combine(created_end_date, time.max))

        total = await query.count()
        order_clause = order_by if order_by else "-computation_start_time"
        computations = await query.offset(skip).limit(limit).order_by(order_clause)
        
        result = []
        for computation in computations:
            items = await DemandComputationItem.filter(
                tenant_id=tenant_id,
                computation_id=computation.id
            ).all()
            result.append(await self._build_computation_response(computation, items))
        
        return {
            "data": [r.model_dump() for r in result],
            "total": total,
            "success": True
        }
    
    async def _collect_computation_material_ids(
        self,
        tenant_id: int,
        computation: DemandComputation,
        computation_params_override: Optional[Dict[str, Any]] = None,
    ) -> tuple[List[int], set[int]]:
        """收集计算将覆盖的物料（需求明细 + BOM 展开子件），并返回种子物料 ID 集合。"""
        from apps.kuaizhizao.models.demand_item import DemandItem
        from apps.master_data.models.material import Material
        from apps.kuaizhizao.utils.bom_helper import get_bom_items_by_material_id

        demand_id_list = computation.demand_ids if computation.demand_ids else [computation.demand_id]
        seed_ids: List[int] = []
        for demand_id in demand_id_list:
            if not demand_id:
                continue
            rows = await DemandItem.filter(tenant_id=tenant_id, demand_id=demand_id).values_list(
                "material_id", flat=True
            )
            seed_ids.extend(int(x) for x in rows if x)
        seed_id_set = set(seed_ids)

        params = dict(computation.computation_params or {})
        if computation_params_override:
            params.update(computation_params_override)
        max_level = _bom_max_level_from_params(params)
        material_bom_versions = params.get("material_bom_versions") or {}
        global_bom_version = params.get("bom_version")
        seen: set[int] = set()
        queue: List[tuple[int, int]] = [(mid, 0) for mid in seed_ids]
        ordered: List[int] = []

        while queue:
            mid, level = queue.pop(0)
            if mid in seen:
                continue
            seen.add(mid)
            ordered.append(mid)
            if level >= max_level:
                continue
            material = await Material.get_or_none(tenant_id=tenant_id, id=mid, deleted_at__isnull=True)
            if not material:
                continue
            st = await get_material_source_type(tenant_id, mid)
            if st not in (SOURCE_TYPE_MAKE, SOURCE_TYPE_PHANTOM, SOURCE_TYPE_OUTSOURCE, SOURCE_TYPE_CONFIGURE):
                continue
            version = material_bom_versions.get(mid) or material_bom_versions.get(str(mid))
            if not version and mid in seed_id_set and global_bom_version:
                version = global_bom_version
            try:
                bom_items = await get_bom_items_by_material_id(
                    tenant_id=tenant_id,
                    material_id=mid,
                    only_approved=True,
                    version=version,
                    use_default=not bool(version),
                    as_of_date=_mrp_bom_as_of_datetime(None),
                )
            except Exception as e:
                logger.warning(f"readiness BOM 展开失败 material_id={mid}: {e}")
                continue
            for bi in bom_items:
                cid = getattr(bi, "component_id", None)
                if cid and int(cid) not in seen:
                    queue.append((int(cid), level + 1))
        return ordered, seed_id_set

    async def preview_computation_readiness(
        self,
        tenant_id: int,
        computation_id: int,
        computation_params_override: Optional[Dict[str, Any]] = None,
    ) -> Dict[str, Any]:
        """执行前检查物料主数据缺失项（提前期/安全库存/批量/供应商/BOM/工艺路线等）。"""
        from apps.master_data.models.material import Material
        from apps.master_data.services.material_service import MaterialService

        computation = await DemandComputation.get_or_none(tenant_id=tenant_id, id=computation_id)
        if not computation:
            raise NotFoundError(f"需求计算不存在: {computation_id}")

        params = dict(computation.computation_params or {})
        if computation_params_override:
            params.update(computation_params_override)

        material_ids, seed_id_set = await self._collect_computation_material_ids(
            tenant_id, computation, computation_params_override
        )
        bom_map = await MaterialService.batch_check_has_bom(tenant_id, material_ids)
        gaps: List[Dict[str, Any]] = []
        for mid in material_ids:
            material = await Material.get_or_none(tenant_id=tenant_id, id=mid, deleted_at__isnull=True)
            if not material:
                continue
            source_type = await get_material_source_type(tenant_id, mid)
            bom_overridden = _material_bom_overridden(mid, params, is_seed=mid in seed_id_set)
            gaps.extend(
                _collect_material_structure_gaps(
                    material,
                    source_type,
                    has_bom=bool(bom_map.get(mid)),
                    bom_overridden=bom_overridden,
                )
            )
            gaps.extend(_collect_material_mrp_gaps(material, source_type))

        gaps = _dedupe_readiness_gaps(gaps)
        return {
            "ready": len(gaps) == 0,
            "gaps": gaps,
            "material_count": len(material_ids),
            "gap_count": len(gaps),
        }

    async def backfill_materials_for_computation(
        self,
        tenant_id: int,
        items: List[Dict[str, Any]],
        *,
        updated_by: int,
        current_user: Any = None,
    ) -> Dict[str, Any]:
        """将用户确认的缺失值回写到物料主数据（source_config / defaults）。"""
        from apps.master_data.models.material import Material
        from infra.models.user import User

        if not items:
            raise ValidationError("补齐项不能为空")

        by_material: Dict[int, List[Dict[str, Any]]] = {}
        for raw in items:
            mid = int(raw.get("material_id") or 0)
            field = str(raw.get("field") or "").strip()
            if mid <= 0 or not field:
                raise ValidationError("补齐项必须包含 material_id 与 field")
            by_material.setdefault(mid, []).append({"field": field, "value": raw.get("value")})

        actor = current_user
        if actor is None and updated_by:
            actor = await User.filter(id=updated_by).first()

        updated_ids: List[int] = []
        async with in_transaction():
            for mid, patches in by_material.items():
                material = await Material.get_or_none(tenant_id=tenant_id, id=mid, deleted_at__isnull=True)
                if not material:
                    raise NotFoundError(f"物料不存在: {mid}")

                source_config = dict(material.source_config or {}) if isinstance(material.source_config, dict) else {}
                defaults = dict(material.defaults or {}) if isinstance(material.defaults, dict) else {}
                sc_changed = False
                def_changed = False
                source_type_changed = False
                route_changed = False

                for p in patches:
                    field = p["field"]
                    value = p["value"]
                    if field == "source_type":
                        if value is None or value == "":
                            raise ValidationError(f"物料 {material.main_code} 的来源类型不能为空")
                        material.source_type = str(value)
                        source_type_changed = True
                        continue
                    if field == "process_route_id":
                        if value is None or value == "":
                            raise ValidationError(f"物料 {material.main_code} 的工艺路线不能为空")
                        material.process_route_id = int(value)
                        route_changed = True
                        continue
                    if field.startswith("source_config."):
                        key = field[len("source_config.") :]
                        if key in (
                            "production_lead_time",
                            "purchase_lead_time",
                            "outsource_lead_time",
                        ):
                            if value is None or value == "":
                                raise ValidationError(f"物料 {material.main_code} 的 {field} 不能为空")
                            source_config[key] = int(value)
                        elif key in ("default_supplier_id", "outsource_supplier_id"):
                            if value is None or value == "":
                                raise ValidationError(f"物料 {material.main_code} 的 {field} 不能为空")
                            source_config[key] = int(value)
                        elif key == "manufacturing_mode":
                            if value is None or value == "":
                                raise ValidationError(f"物料 {material.main_code} 的制造模式不能为空")
                            source_config[key] = str(value)
                        elif key == "outsource_operation":
                            if value is None or str(value).strip() == "":
                                raise ValidationError(f"物料 {material.main_code} 的委外工序不能为空")
                            source_config[key] = str(value).strip()
                        else:
                            source_config[key] = value
                        sc_changed = True
                    elif field == "defaults.safetyStock":
                        if value is None or value == "":
                            raise ValidationError(f"物料 {material.main_code} 的安全库存不能为空")
                        defaults["safetyStock"] = float(value)
                        def_changed = True
                    elif field == "defaults.reorder_point":
                        if value is None or value == "":
                            raise ValidationError(f"物料 {material.main_code} 的再订货点不能为空")
                        defaults["reorder_point"] = float(value)
                        def_changed = True
                    elif field.startswith("defaults."):
                        path = field[len("defaults.") :].split(".")
                        if value is None or value == "":
                            raise ValidationError(f"物料 {material.main_code} 的 {field} 不能为空")
                        cursor: Dict[str, Any] = defaults
                        for part in path[:-1]:
                            nxt = cursor.get(part)
                            if not isinstance(nxt, dict):
                                nxt = {}
                                cursor[part] = nxt
                            cursor = nxt
                        cursor[path[-1]] = float(value) if path[-1] != "default_supplier_id" else int(value)
                        def_changed = True
                    else:
                        raise ValidationError(f"不支持的补齐字段: {field}")

                if sc_changed:
                    material.source_config = source_config
                if def_changed:
                    material.defaults = defaults
                if sc_changed or def_changed or source_type_changed or route_changed:
                    apply_update_audit(material, actor)
                    await material.save()
                    updated_ids.append(mid)

        return {
            "updated_material_ids": updated_ids,
            "updated_count": len(updated_ids),
        }

    async def execute_computation(
        self,
        tenant_id: int,
        computation_id: int,
        computation_params_override: Optional[Dict[str, Any]] = None,
        *,
        operator_id: Optional[int] = None,
        firmed_planned_orders: Optional[Dict[int, Dict[str, Any]]] = None,
    ) -> DemandComputationResponse:
        """
        执行需求计算
        
        Args:
            tenant_id: 租户ID
            computation_id: 计算ID
            computation_params_override: 临时覆盖的计算参数，仅本次执行生效，不持久化
            operator_id: 执行人 ID（写入 updated_by / updated_by_name）
            
        Returns:
            DemandComputationResponse: 计算响应
        """
        computation = await DemandComputation.get_or_none(tenant_id=tenant_id, id=computation_id)
        if not computation:
            raise NotFoundError(f"需求计算不存在: {computation_id}")

        from apps.kuaizhizao.services.document_action_policy.demand_computation import (
            assert_demand_computation_capability,
        )

        assert_demand_computation_capability(computation, "execute")

        # 允许执行：进行中（待执行）或 失败（重试）
        if computation.computation_status not in ("进行中", "失败"):
            raise BusinessLogicError(
                f"只能执行进行中或失败状态的计算，当前状态: {computation.computation_status}"
            )

        # 合并临时覆盖参数到 computation_params（仅本次执行生效，不持久化）
        if computation_params_override:
            base_params = computation.computation_params or {}
            computation.computation_params = {**base_params, **computation_params_override}

        operator = await User.get_or_none(id=operator_id) if operator_id else None

        try:
            async with in_transaction():
                # 失败重试时清理旧明细：理论上事务回滚已清理，此处为防御性保证重试从干净状态开始
                if computation.computation_status == "失败":
                    await DemandComputationItem.filter(
                        tenant_id=tenant_id,
                        computation_id=computation_id
                    ).delete()

                # 更新计算状态为计算中
                start_audit: Dict[str, Any] = {
                    "computation_status": "计算中",
                    "computation_start_time": resolve_business_datetime(),
                }
                apply_update_audit(start_audit, operator)
                await DemandComputation.filter(tenant_id=tenant_id, id=computation_id).update(
                    **start_audit
                )

                # 统一需求计算（原 MRP/LRP 合并为单一实现，类型字段恒为 MRP）
                await self._execute_mrp_computation(
                    tenant_id,
                    computation,
                    firmed_planned_orders=firmed_planned_orders,
                )

                # 计算汇总信息 (新：计划员赋能增强，用于列表页展示)
                items = await DemandComputationItem.filter(tenant_id=tenant_id, computation_id=computation_id).all()
                shortage_count = 0
                risk_count = 0
                firm_count = 0
                today = date.today()
                for item in items:
                    req_qty = float(item.gross_requirement or item.required_quantity or 0)
                    avail_qty = float(item.available_inventory or 0)
                    if req_qty > 0 and avail_qty < req_qty:
                        shortage_count += 1
                    
                    start_date = item.production_start_date or item.procurement_start_date
                    if start_date and start_date < today and (item.net_requirement or 0) > 0:
                        risk_count += 1
                    detail = item.detail_results or {}
                    supply = detail.get("supply_calculation") or {}
                    for po in supply.get("planned_orders") or []:
                        if isinstance(po, dict) and po.get("firm"):
                            firm_count += 1
                            break
                
                summary = computation.computation_summary or {}
                summary["shortage_count"] = shortage_count
                summary["risk_count"] = risk_count
                summary["item_count"] = len(items)
                summary["firm_material_count"] = firm_count

                # 更新计算状态为完成，清除失败时的错误信息
                done_audit: Dict[str, Any] = {
                    "computation_status": "完成",
                    "computation_end_time": resolve_business_datetime(),
                    "computation_summary": summary,
                    "error_message": None,
                }
                apply_update_audit(done_audit, operator)
                await DemandComputation.filter(tenant_id=tenant_id, id=computation_id).update(
                    **done_audit
                )

            return await self.get_computation_by_id(tenant_id, computation_id)

        except Exception as e:
            logger.error(f"执行需求计算失败: {e}")
            # 更新为失败状态：使用独立连接避免复用已终止事务的连接导致 TransactionManagementError
            try:
                await asyncio.sleep(0)  # 让出控制权，确保连接池有机会回收/重置连接
                from infra.infrastructure.database.database import get_db_connection
                conn = await get_db_connection()
                try:
                    now = resolve_business_datetime()
                    err_msg = str(e).replace("'", "''")[:2000]  # 转义并截断
                    if operator is not None:
                        await conn.execute(
                            """UPDATE apps_kuaizhizao_demand_computations
                               SET computation_status=$1, computation_end_time=$2, error_message=$3,
                                   updated_by=$4, updated_by_name=$5, updated_at=$6
                               WHERE tenant_id=$7 AND id=$8""",
                            "失败",
                            now,
                            err_msg,
                            int(operator.id),
                            operator_name_from_user(operator) or None,
                            now,
                            tenant_id,
                            computation_id,
                        )
                    else:
                        await conn.execute(
                            """UPDATE apps_kuaizhizao_demand_computations
                               SET computation_status=$1, computation_end_time=$2, error_message=$3
                               WHERE tenant_id=$4 AND id=$5""",
                            "失败", now, err_msg, tenant_id, computation_id
                        )
                finally:
                    await conn.close()
            except Exception as update_err:
                logger.warning(f"更新失败状态时出错: {update_err}")
            raise

    async def get_computation_dynamic_monitor(
        self,
        tenant_id: int,
        computation_id: int
    ) -> Dict[str, Any]:
        """
        获取需求计算的动态变动监控
        
        对比上游需求变动与下游执行风险，作为计划员协同的桥梁。
        """
        from apps.kuaizhizao.models.demand import Demand
        from apps.kuaizhizao.models.document_relation import DocumentRelation
        from apps.kuaizhizao.models.work_order import WorkOrder
        from apps.kuaizhizao.models.purchase_order import PurchaseOrder

        computation = await DemandComputation.get_or_none(tenant_id=tenant_id, id=computation_id)
        if not computation:
            raise NotFoundError(f"需求计算不存在: {computation_id}")

        comp_time = computation.computation_end_time or computation.updated_at
        comp_time_cmp = _to_utc_aware(comp_time)
        now = now_utc()

        # 1. 监控上游需求变动
        upstream_alerts = []
        demand_id_list = computation.demand_ids if computation.demand_ids else [computation.demand_id]
        demands = await Demand.filter(tenant_id=tenant_id, id__in=demand_id_list).all()
        for d in demands:
            du = _to_utc_aware(d.updated_at)
            if comp_time_cmp is not None and du is not None and du > comp_time_cmp:
                upstream_alerts.append({
                    "type": "demand_updated",
                    "id": d.id,
                    "code": d.demand_code,
                    "name": d.demand_name,
                    "updated_at": d.updated_at,
                    "message": f"源需求单 {d.demand_code} 在计算后发生了更新（更新于 {d.updated_at.strftime('%m-%d %H:%M')}），说明当前计算依据已偏离。"
                })
        
        # 2. 监控下游执行风险 (延期)
        downstream_alerts = []

        # 获取所有下推关系
        relations = await DocumentRelation.filter(
            tenant_id=tenant_id,
            source_type="demand_computation",
            source_id=computation_id,
            relation_mode="push"
        ).all()
        
        for rel in relations:
            if rel.target_type == "work_order":
                wo = await WorkOrder.get_or_none(tenant_id=tenant_id, id=rel.target_id)
                if wo and wo.status not in ("completed", "cancelled", "完成", "已取消"):
                    end_cmp = _to_utc_aware(wo.planned_end_date)
                    if end_cmp is not None and end_cmp < now:
                        downstream_alerts.append({
                            "type": "work_order_overdue",
                            "id": wo.id,
                            "code": wo.code,
                            "name": wo.product_name,
                            "planned_end_date": wo.planned_end_date,
                            "status": wo.status,
                            "message": f"下推工单 {wo.code} ({wo.product_name}) 已逾期，原计划结束日期: {wo.planned_end_date.strftime('%Y-%m-%d')}。"
                        })
            elif rel.target_type == "purchase_order":
                po = await PurchaseOrder.get_or_none(tenant_id=tenant_id, id=rel.target_id)
                if po and po.status not in ("已完成", "已取消", "completed", "cancelled"):
                    if po.delivery_date:
                        delivery_dt = datetime.combine(po.delivery_date, datetime.min.time())
                        delivery_cmp = _to_utc_aware(delivery_dt)
                        if delivery_cmp is not None and delivery_cmp < now:
                            downstream_alerts.append({
                                "type": "purchase_order_overdue",
                                "id": po.id,
                                "code": po.order_code,
                                "name": po.supplier_name,
                                "delivery_date": po.delivery_date,
                                "status": po.status,
                                "message": f"下推采购单 {po.order_code} ({po.supplier_name}) 预计到货已逾期，日期为 {po.delivery_date.strftime('%Y-%m-%d')}。"
                            })
                        
        return {
            "computation_id": computation_id,
            "computation_code": computation.computation_code,
            "has_upstream_change": len(upstream_alerts) > 0,
            "has_downstream_risk": len(downstream_alerts) > 0,
            "upstream_alerts": upstream_alerts,
            "downstream_alerts": downstream_alerts,
            "monitor_time": now
        }

    async def preview_execute_computation(
        self,
        tenant_id: int,
        computation_id: int,
        computation_params_override: Optional[Dict[str, Any]] = None,
    ) -> Dict[str, Any]:
        """
        预览执行结果：运行计算逻辑但不持久化，返回计算结果预览供二次确认。
        通过事务回滚实现，不写入数据库。
        """
        computation = await DemandComputation.get_or_none(tenant_id=tenant_id, id=computation_id)
        if not computation:
            raise NotFoundError(f"需求计算不存在: {computation_id}")
        if computation.computation_status not in ("进行中", "失败"):
            raise BusinessLogicError(
                f"只能预览进行中或失败状态的计算，当前状态: {computation.computation_status}"
            )

        if computation_params_override:
            base_params = computation.computation_params or {}
            computation.computation_params = {**base_params, **computation_params_override}

        try:
            async with in_transaction():
                if computation.computation_status == "失败":
                    await DemandComputationItem.filter(
                        tenant_id=tenant_id,
                        computation_id=computation_id
                    ).delete()

                await DemandComputation.filter(tenant_id=tenant_id, id=computation_id).update(
                    computation_status="计算中",
                    computation_start_time=resolve_business_datetime()
                )

                await self._execute_mrp_computation(tenant_id, computation)

                items = await DemandComputationItem.filter(
                    tenant_id=tenant_id,
                    computation_id=computation_id
                ).all()

                preview_items = []
                for item in items:
                    preview_items.append({
                        "material_id": item.material_id,
                        "material_code": item.material_code,
                        "material_name": item.material_name,
                        "material_unit": item.material_unit or "",
                        "delivery_date": _preview_date_iso(item.delivery_date),
                        "planned_date": _preview_planned_date_iso(item),
                        "required_quantity": float(item.required_quantity or 0),
                        "available_inventory": float(item.available_inventory or 0),
                        "net_requirement": float(item.net_requirement or 0),
                        "suggested_work_order_quantity": float(item.suggested_work_order_quantity or 0),
                        "suggested_purchase_order_quantity": float(item.suggested_purchase_order_quantity or 0),
                        "material_source_type": item.material_source_type,
                        "detail_results": item.detail_results,
                    })

                preview_data = {
                    "computation_code": computation.computation_code,
                    "computation_type": computation.computation_type,
                    "item_count": len(preview_items),
                    "items": preview_items,
                }
                raise _PreviewResultCarrier(preview_data)

        except _PreviewResultCarrier as e:
            return e.preview_data
        except Exception:
            raise

    async def recompute_computation(
        self,
        tenant_id: int,
        computation_id: int,
        operator_id: Optional[int] = None,
        trigger: str = "manual",
        trigger_message: Optional[str] = None,
    ) -> DemandComputationResponse:
        """
        重新计算：仅允许对「完成」或「失败」的计算重新执行。
        重算前写入需求计算快照与重算历史；再删除原明细、重置状态并执行计算。
        """
        snapshot_id_saved: Optional[int] = None
        firmed_planned_orders: Dict[int, Dict[str, Any]] = {}
        async with in_transaction():
            computation = await DemandComputation.get_or_none(tenant_id=tenant_id, id=computation_id)
            if not computation:
                raise NotFoundError(f"需求计算不存在: {computation_id}")

            from apps.kuaizhizao.services.document_action_policy.demand_computation import (
                assert_demand_computation_capability,
            )

            assert_demand_computation_capability(computation, "recompute")

            if computation.computation_status not in ("完成", "失败"):
                raise BusinessLogicError(
                    f"只能对已完成或失败的计算执行重新计算，当前状态: {computation.computation_status}"
                )
            # 重算前快照：当前汇总 + 明细
            items_before = await DemandComputationItem.filter(
                tenant_id=tenant_id, computation_id=computation_id
            ).all()
            firmed_planned_orders = _extract_firmed_planned_orders(items_before)
            summary_snapshot = computation.computation_summary
            items_snapshot = [
                {
                    "material_code": getattr(i, "material_code", None),
                    "material_name": getattr(i, "material_name", None),
                    "suggested_work_order_quantity": str(getattr(i, "suggested_work_order_quantity", 0)),
                    "suggested_purchase_order_quantity": str(getattr(i, "suggested_purchase_order_quantity", 0)),
                }
                for i in items_before
            ]
            snapshot = await DemandComputationSnapshot.create(
                tenant_id=tenant_id,
                computation_id=computation_id,
                snapshot_at=resolve_business_datetime(),
                trigger=trigger,
                computation_summary_snapshot=summary_snapshot,
                items_snapshot=items_snapshot,
            )
            snapshot_id_saved = snapshot.id
            # 删除原计算结果明细
            await DemandComputationItem.filter(
                tenant_id=tenant_id,
                computation_id=computation_id
            ).delete()
            # 重置状态与错误信息，便于走执行逻辑
            reset_audit: Dict[str, Any] = {
                "computation_status": "进行中",
                "computation_end_time": None,
                "error_message": None,
                "computation_summary": None,
            }
            operator = await User.get_or_none(id=operator_id) if operator_id else None
            apply_update_audit(reset_audit, operator)
            await DemandComputation.filter(tenant_id=tenant_id, id=computation_id).update(
                **reset_audit
            )
        # 在事务外调用 execute，避免嵌套事务导致 TransactionManagementError
        try:
            result = await self.execute_computation(
                tenant_id=tenant_id,
                computation_id=computation_id,
                operator_id=operator_id,
                firmed_planned_orders=firmed_planned_orders,
            )
            diff_summary = await self._build_recompute_diff_summary(
                tenant_id=tenant_id,
                computation_id=computation_id,
                before_items_snapshot=items_snapshot,
            )
            msg_parts = ["重算完成", diff_summary]
            if trigger_message:
                msg_parts.append(trigger_message)
            await DemandComputationRecalcHistory.create(
                tenant_id=tenant_id,
                computation_id=computation_id,
                recalc_at=resolve_business_datetime(),
                trigger=trigger,
                operator_id=operator_id,
                result="success",
                snapshot_id=snapshot_id_saved,
                message="；".join([m for m in msg_parts if m]),
            )
            return result
        except Exception as e:
            await DemandComputationRecalcHistory.create(
                tenant_id=tenant_id,
                computation_id=computation_id,
                recalc_at=resolve_business_datetime(),
                trigger=trigger,
                operator_id=operator_id,
                result="failed",
                snapshot_id=snapshot_id_saved,
                message=str(e)[:500],
            )
            raise

    async def list_computation_recalc_history(
        self, tenant_id: int, computation_id: int, limit: int = 50
    ) -> List[Dict[str, Any]]:
        """获取需求计算重算历史列表。"""
        computation = await DemandComputation.get_or_none(tenant_id=tenant_id, id=computation_id)
        if not computation:
            raise NotFoundError("需求计算", str(computation_id))
        rows = await DemandComputationRecalcHistory.filter(
            tenant_id=tenant_id, computation_id=computation_id
        ).order_by("-recalc_at").limit(limit)
        return [
            {
                "id": r.id,
                "recalc_at": to_api_isoformat(r.recalc_at) if r.recalc_at else None,
                "trigger": r.trigger,
                "operator_id": r.operator_id,
                "result": r.result,
                "snapshot_id": r.snapshot_id,
                "message": r.message,
            }
            for r in rows
        ]

    async def _build_recompute_diff_summary(
        self,
        tenant_id: int,
        computation_id: int,
        before_items_snapshot: List[Dict[str, Any]],
    ) -> str:
        """构建重算前后差异摘要，用于重算审计。"""
        after_items = await DemandComputationItem.filter(
            tenant_id=tenant_id,
            computation_id=computation_id,
        ).all()
        before_map = {str(it.get("material_code") or ""): it for it in before_items_snapshot}
        after_map = {str(it.material_code or ""): it for it in after_items}
        all_codes = set(before_map.keys()) | set(after_map.keys())
        changed = 0
        added = 0
        removed = 0
        for code in all_codes:
            b = before_map.get(code)
            a = after_map.get(code)
            if b and not a:
                removed += 1
                continue
            if a and not b:
                added += 1
                continue
            if not a or not b:
                continue
            b_wo = _safe_float(b.get("suggested_work_order_quantity"))
            b_po = _safe_float(b.get("suggested_purchase_order_quantity"))
            a_wo = float(a.suggested_work_order_quantity or 0)
            a_po = float(a.suggested_purchase_order_quantity or 0)
            if abs(b_wo - a_wo) > 1e-6 or abs(b_po - a_po) > 1e-6:
                changed += 1
        return f"差异摘要: 变更{changed}项, 新增{added}项, 删除{removed}项"

    async def list_computation_snapshots(
        self, tenant_id: int, computation_id: int, limit: int = 20
    ) -> List[Dict[str, Any]]:
        """获取需求计算快照列表。"""
        computation = await DemandComputation.get_or_none(tenant_id=tenant_id, id=computation_id)
        if not computation:
            raise NotFoundError("需求计算", str(computation_id))
        rows = await DemandComputationSnapshot.filter(
            tenant_id=tenant_id, computation_id=computation_id
        ).order_by("-snapshot_at").limit(limit)
        return [
            {
                "id": r.id,
                "snapshot_at": to_api_isoformat(r.snapshot_at) if r.snapshot_at else None,
                "trigger": r.trigger,
                "computation_summary_snapshot": r.computation_summary_snapshot,
                "items_snapshot": r.items_snapshot,
            }
            for r in rows
        ]

    async def get_computation_snapshot_by_id(
        self, tenant_id: int, computation_id: int, snapshot_id: int
    ) -> Dict[str, Any]:
        """按 ID 获取单条需求计算快照（须属于当前计算）。"""
        computation = await DemandComputation.get_or_none(tenant_id=tenant_id, id=computation_id)
        if not computation:
            raise NotFoundError(f"需求计算不存在: {computation_id}")
        row = await DemandComputationSnapshot.get_or_none(
            tenant_id=tenant_id, id=snapshot_id, computation_id=computation_id
        )
        if not row:
            raise NotFoundError(f"快照不存在或不属于该计算: {snapshot_id}")
        return {
            "id": row.id,
            "snapshot_at": to_api_isoformat(row.snapshot_at) if row.snapshot_at else None,
            "trigger": row.trigger,
            "computation_summary_snapshot": row.computation_summary_snapshot,
            "items_snapshot": row.items_snapshot,
        }

    async def compare_computations(
        self,
        tenant_id: int,
        computation_id1: int,
        computation_id2: int
    ) -> Dict[str, Any]:
        """
        对比两个需求计算结果
        
        Args:
            tenant_id: 租户ID
            computation_id1: 第一个计算ID
            computation_id2: 第二个计算ID
            
        Returns:
            Dict: 对比结果，包含差异分析
        """
        computation1 = await self.get_computation_by_id(tenant_id, computation_id1, include_items=True)
        computation2 = await self.get_computation_by_id(tenant_id, computation_id2, include_items=True)
        
        # 对比基本信息
        basic_diff = {
            "computation_type": {
                "value1": computation1.computation_type,
                "value2": computation2.computation_type,
                "same": computation1.computation_type == computation2.computation_type
            },
            "business_mode": {
                "value1": computation1.business_mode,
                "value2": computation2.business_mode,
                "same": computation1.business_mode == computation2.business_mode
            },
            "computation_params": {
                "value1": computation1.computation_params,
                "value2": computation2.computation_params,
                "same": computation1.computation_params == computation2.computation_params
            },
            "computation_summary": {
                "value1": computation1.computation_summary,
                "value2": computation2.computation_summary,
                "same": computation1.computation_summary == computation2.computation_summary
            }
        }
        
        # 对比明细项
        items1 = {item.material_id: item for item in computation1.items or []}
        items2 = {item.material_id: item for item in computation2.items or []}
        
        all_material_ids = set(items1.keys()) | set(items2.keys())
        
        items_diff = []
        for material_id in all_material_ids:
            item1 = items1.get(material_id)
            item2 = items2.get(material_id)
            
            if item1 and item2:
                # 两个计算都有该物料，对比差异
                item_diff = {
                    "material_id": material_id,
                    "material_code": item1.material_code,
                    "material_name": item1.material_name,
                    "exists_in_both": True,
                    "differences": {}
                }
                
                # 对比关键字段
                key_fields = [
                    "required_quantity", "available_inventory", "net_requirement",
                    "suggested_work_order_quantity", "suggested_purchase_order_quantity"
                ]
                
                for field in key_fields:
                    val1 = getattr(item1, field, None)
                    val2 = getattr(item2, field, None)
                    if val1 != val2:
                        item_diff["differences"][field] = {
                            "value1": float(val1) if val1 else None,
                            "value2": float(val2) if val2 else None,
                            "diff": float(val2) - float(val1) if val1 and val2 else None
                        }
                
                if item_diff["differences"]:
                    items_diff.append(item_diff)
            elif item1:
                # 只在第一个计算中存在
                items_diff.append({
                    "material_id": material_id,
                    "material_code": item1.material_code,
                    "material_name": item1.material_name,
                    "exists_in_both": False,
                    "only_in": "computation1"
                })
            elif item2:
                # 只在第二个计算中存在
                items_diff.append({
                    "material_id": material_id,
                    "material_code": item2.material_code,
                    "material_name": item2.material_name,
                    "exists_in_both": False,
                    "only_in": "computation2"
                })
        
        return {
            "computation1": {
                "id": computation1.id,
                "computation_code": computation1.computation_code,
                "computation_start_time": computation1.computation_start_time,
                "computation_end_time": computation1.computation_end_time,
            },
            "computation2": {
                "id": computation2.id,
                "computation_code": computation2.computation_code,
                "computation_start_time": computation2.computation_start_time,
                "computation_end_time": computation2.computation_end_time,
            },
            "basic_diff": basic_diff,
            "items_diff": items_diff,
            "total_differences": len(items_diff)
        }
    
    async def _execute_mrp_computation(
        self,
        tenant_id: int,
        computation: DemandComputation,
        firmed_planned_orders: Optional[Dict[int, Dict[str, Any]]] = None,
    ) -> None:
        """
        执行统一需求计算（LLC 逐层净算 + 时间分桶）。

        1. 顶层需求写入分日毛需求（含预测冲销）
        2. 按 BOM 结构计算低阶码（LLC）
        3. 自低到高逐层：分日净算 → 批量/损耗 → 按计划订单量展开一层子件
        4. 在途/在制按到期日进入对应日桶；例外写入 detail_results.exceptions
        5. 已确认计划订单重算保留（作供应 + 输出 firm）
        """
        from collections import defaultdict

        from apps.kuaizhizao.models.demand_item import DemandItem
        from apps.master_data.models.material import Material
        from apps.kuaizhizao.utils.inventory_helper import (
            get_material_inventory_info,
            batch_list_open_supply_receipts_by_date,
        )
        from apps.kuaizhizao.utils.material_source_helper import explode_bom_one_level_for_mrp
        from apps.kuaizhizao.utils.mrp_llc_engine import (
            aggregate_qty_by_date,
            merge_demand_meta,
            time_phased_net_material,
        )
        from apps.kuaizhizao.utils.forecast_consumption import (
            net_forecast_gross_by_sales_orders,
        )
        from apps.kuaizhizao.utils.work_calendar import (
            holiday_span_for_mrp,
            load_holiday_dates,
        )

        logger.info(f"执行需求计算(LLC): {computation.computation_code}")
        firmed_map = firmed_planned_orders or {}

        demand_id_list = computation.demand_ids if computation.demand_ids else [computation.demand_id]
        demand_items = []
        for demand_id in demand_id_list:
            items = await DemandItem.filter(tenant_id=tenant_id, demand_id=demand_id).all()
            demand_items.extend(items)

        if not demand_items:
            logger.warning(f"需求明细为空，计算ID: {computation.id}")
            return

        demand_by_id: Dict[int, Demand] = {}
        for demand_id in demand_id_list:
            demand_row = await Demand.get_or_none(tenant_id=tenant_id, id=demand_id)
            if demand_row:
                demand_by_id[demand_row.id] = demand_row

        computation_params = computation.computation_params or {}
        logger.debug(
            "需求计算 4M 约束(占位): capacity=%s material=%s equipment=%s mold_tool=%s",
            computation_params.get("consider_capacity", True),
            computation_params.get("consider_material_readiness", True),
            computation_params.get("consider_equipment_availability", False),
            computation_params.get("consider_mold_tool_availability", False),
        )

        biz_config = BusinessConfigService()
        bom_multi_allowed = await biz_config.get_bom_multi_version_allowed(tenant_id)
        if bom_multi_allowed:
            bom_version = computation_params.get("bom_version")
            material_bom_versions = computation_params.get("material_bom_versions")
            use_default_bom = False
        else:
            bom_version = None
            material_bom_versions = None
            use_default_bom = True

        wh_ids = await _resolve_mrp_warehouse_ids(tenant_id, computation_params)
        bom_max_level = _bom_max_level_from_params(computation_params)
        planning_cutoff = _mrp_planning_cutoff_date(computation_params)
        schedule_today = date.today()
        mrp_basis = _mrp_suggestion_basis(computation_params)
        netting_params_for_supply = _netting_params_for_mrp_supply(computation_params)
        try:
            schedule_buffer_days = max(0, int(computation_params.get("schedule_buffer_days") or 0))
        except (TypeError, ValueError):
            schedule_buffer_days = 0
        schedule_direction = normalize_schedule_direction(
            computation_params.get("schedule_direction")
        )
        use_work_calendar = computation_params.get("use_work_calendar", True)
        if isinstance(use_work_calendar, str):
            use_work_calendar = use_work_calendar.strip().lower() in ("1", "true", "yes", "y")
        else:
            use_work_calendar = bool(use_work_calendar)
        forecast_consume_enabled = computation_params.get("forecast_consume_enabled", True)
        if isinstance(forecast_consume_enabled, str):
            forecast_consume_enabled = forecast_consume_enabled.strip().lower() in (
                "1", "true", "yes", "y",
            )
        else:
            forecast_consume_enabled = bool(forecast_consume_enabled)
        try:
            fc_backward = max(0, int(computation_params.get("forecast_consume_backward_days") or 30))
        except (TypeError, ValueError):
            fc_backward = 30
        try:
            fc_forward = max(0, int(computation_params.get("forecast_consume_forward_days") or 30))
        except (TypeError, ValueError):
            fc_forward = 30

        # material_id -> date -> gross qty
        gross_by_material: Dict[int, Dict[date, float]] = defaultdict(lambda: defaultdict(float))
        # 种子层按需求类型分开，便于预测冲销
        seed_so_gross: Dict[int, Dict[date, float]] = defaultdict(lambda: defaultdict(float))
        seed_fc_gross: Dict[int, Dict[date, float]] = defaultdict(lambda: defaultdict(float))
        meta_by_material: Dict[int, Dict[str, Any]] = {}
        seed_ids: List[int] = []
        forecast_consumed_total = 0.0

        def _meta(mid: int) -> Dict[str, Any]:
            if mid not in meta_by_material:
                meta_by_material[mid] = {
                    "material_id": mid,
                    "demand_item_ids": [],
                    "parent_material_ids": set(),
                    "unit": None,
                    "material_code": None,
                    "material_name": None,
                }
            return meta_by_material[mid]

        def _add_gross(mid: int, due: date, qty: float, **meta_kw: Any) -> None:
            if qty <= 0:
                return
            gross_by_material[mid][due] += float(qty)
            merge_demand_meta(_meta(mid), **meta_kw)

        # 1) 顶层需求 → 分日毛需求（SO / 预测分开累计）
        for demand_item in demand_items:
            material_id = demand_item.material_id
            demand_hdr = demand_by_id.get(int(demand_item.demand_id))
            demand_type = (demand_hdr.demand_type if demand_hdr else None) or ""
            required_quantity = float(demand_item.required_quantity or 0)
            delivery_date = resolve_demand_item_delivery_date(demand_item, demand_by_id)
            if required_quantity <= 0:
                continue
            if planning_cutoff and delivery_date is not None:
                dd = delivery_date.date() if hasattr(delivery_date, "date") else delivery_date
                if isinstance(dd, date) and dd > planning_cutoff:
                    continue
            material = await Material.get_or_none(tenant_id=tenant_id, id=material_id)
            if not material:
                logger.warning(f"物料不存在，物料ID: {material_id}")
                continue
            due = delivery_date
            if isinstance(due, datetime):
                due = due.date()
            if not isinstance(due, date):
                due = schedule_today
            seed_ids.append(int(material_id))
            mid = int(material_id)
            merge_demand_meta(
                _meta(mid),
                demand_item_id=demand_item.id,
                unit=material.base_unit,
                material_code=material.main_code or material.code,
                material_name=material.name,
            )
            if demand_type == "sales_order":
                seed_so_gross[mid][due] += required_quantity
            elif demand_type == "sales_forecast":
                seed_fc_gross[mid][due] += required_quantity
            else:
                _add_gross(mid, due, required_quantity, demand_item_id=demand_item.id)

        # 1b) 预测冲销：同物料 SO 冲抵预测分日毛需求后写入 gross
        all_seed_mids = set(seed_so_gross.keys()) | set(seed_fc_gross.keys())
        for mid in all_seed_mids:
            so_rows = list(seed_so_gross.get(mid, {}).items())
            fc_rows = list(seed_fc_gross.get(mid, {}).items())
            if forecast_consume_enabled and so_rows and fc_rows:
                netted_fc, consumed = net_forecast_gross_by_sales_orders(
                    forecast_rows=fc_rows,
                    sales_order_rows=so_rows,
                    backward_days=fc_backward,
                    forward_days=fc_forward,
                )
                forecast_consumed_total += consumed
                for d, q in so_rows:
                    _add_gross(mid, d, q)
                for d, q in netted_fc:
                    _add_gross(mid, d, q)
            else:
                for d, q in so_rows:
                    _add_gross(mid, d, q)
                for d, q in fc_rows:
                    _add_gross(mid, d, q)

        # 无毛需求但仍有已确认计划的物料：保留进净算波次
        for mid in firmed_map:
            if mid not in gross_by_material:
                gross_by_material[mid]  # touch defaultdict key
                _meta(int(mid))

        if not gross_by_material:
            logger.warning(f"无有效需求行，计算ID: {computation.id}")
            return

        # 虚拟件顶层：先穿透到实件，不参与库存净算
        for mid in list(gross_by_material.keys()):
            st = await get_material_source_type(tenant_id, mid)
            if st != SOURCE_TYPE_PHANTOM:
                continue
            buckets = dict(gross_by_material[mid])
            parent_meta = _meta(mid)
            for due, qty in buckets.items():
                children = await explode_bom_one_level_for_mrp(
                    tenant_id=tenant_id,
                    material_id=mid,
                    planned_quantity=qty,
                    only_approved=True,
                    bom_version=bom_version,
                    use_default_bom=use_default_bom,
                    material_bom_versions=material_bom_versions,
                    as_of_date=_mrp_bom_as_of_datetime(due),
                )
                for child in children:
                    cid = int(child["material_id"])
                    _add_gross(
                        cid,
                        due,
                        float(child.get("required_quantity") or 0),
                        demand_item_id=None,
                        parent_material_id=mid,
                        unit=child.get("unit"),
                        material_code=child.get("material_code"),
                        material_name=child.get("material_name"),
                    )
                    for did in parent_meta.get("demand_item_ids") or []:
                        merge_demand_meta(_meta(cid), demand_item_id=did)
            del gross_by_material[mid]
            meta_by_material.pop(mid, None)

        # 2) 发现 BOM 边并计算 LLC（结构展开，数量=1）
        edges: List[Tuple[int, int]] = []
        seen_materials = set(gross_by_material.keys())
        queue = list(seen_materials)
        while queue:
            parent_id = queue.pop(0)
            st = await get_material_source_type(tenant_id, parent_id)
            if st in (
                SOURCE_TYPE_BUY,
                SOURCE_TYPE_CUSTOMER_PROVIDED,
                SOURCE_TYPE_GIFT,
                SOURCE_TYPE_SERVICE,
                None,
            ):
                continue
            if st == SOURCE_TYPE_PHANTOM:
                continue
            try:
                kids = await explode_bom_one_level_for_mrp(
                    tenant_id=tenant_id,
                    material_id=parent_id,
                    planned_quantity=1.0,
                    only_approved=True,
                    bom_version=bom_version,
                    use_default_bom=use_default_bom,
                    material_bom_versions=material_bom_versions,
                    as_of_date=_mrp_bom_as_of_datetime(schedule_today),
                )
            except Exception as e:
                logger.warning(f"LLC 结构展开失败 material_id={parent_id}: {e}")
                continue
            for child in kids:
                cid = int(child["material_id"])
                edges.append((parent_id, cid))
                if cid not in seen_materials:
                    seen_materials.add(cid)
                    queue.append(cid)

        llc: Dict[int, int] = {mid: 0 for mid in gross_by_material.keys()}
        for mid in seen_materials:
            llc.setdefault(mid, 0)
        changed = True
        guard = 0
        while changed and guard < 1000:
            changed = False
            guard += 1
            for parent_id, child_id in edges:
                nv = llc.get(parent_id, 0) + 1
                if nv > llc.get(child_id, 0):
                    llc[child_id] = nv
                    changed = True

        # 3) 预取分日在途（对已发现物料；后续新出现子件再补取）
        supply_receipts = await batch_list_open_supply_receipts_by_date(
            tenant_id, list(seen_materials)
        )

        # 工作日历：一次加载覆盖需求窗 + 最大提前期
        holiday_dates = set()
        if use_work_calendar:
            demand_dates: List[date] = []
            for buckets in gross_by_material.values():
                demand_dates.extend(buckets.keys())
            # 粗估最大提前期（日历日放大，保证节假日范围够用）
            max_lead_estimate = 120 + schedule_buffer_days
            h_from, h_to = holiday_span_for_mrp(
                schedule_today, demand_dates, max_lead_estimate
            )
            holiday_dates = await load_holiday_dates(tenant_id, h_from, h_to)

        results_by_material: Dict[int, Dict[str, Any]] = {}
        wave_guard = 0
        while wave_guard < 500:
            wave_guard += 1
            pending = [m for m in gross_by_material.keys() if m not in results_by_material]
            if not pending:
                break
            min_l = min(llc.get(m, 0) for m in pending)
            level_mids = sorted(m for m in pending if llc.get(m, 0) == min_l)

            # 补齐尚未拉取过的在途
            missing_supply = [m for m in level_mids if m not in supply_receipts]
            if missing_supply:
                extra = await batch_list_open_supply_receipts_by_date(tenant_id, missing_supply)
                supply_receipts.update(extra)

            for material_id in level_mids:
                material = await Material.get_or_none(
                    tenant_id=tenant_id, id=material_id, deleted_at__isnull=True
                )
                if not material:
                    continue
                source_type = await get_material_source_type(tenant_id, material_id)
                source_config = await get_material_source_config(tenant_id, material_id) or {}
                validation_passed, validation_errors = await validate_material_source_config(
                    tenant_id=tenant_id,
                    material_id=material_id,
                    source_type=source_type or "Make",
                )
                resolved_source_config = resolve_computation_item_source_config(source_config)

                inventory_info = await get_material_inventory_info(
                    tenant_id=tenant_id,
                    material_id=material_id,
                    warehouse_id=None,
                    warehouse_ids=wh_ids,
                    in_transit_quantity=0.0,
                    with_breakdown=True,
                )
                if netting_params_for_supply.get("include_reserved", False):
                    beginning = _safe_float(inventory_info.get("available_quantity"))
                else:
                    beginning = _safe_float(
                        inventory_info.get("on_hand", inventory_info.get("available_quantity"))
                    )

                safety_stock, reorder_point = await _get_material_safety_reorder(
                    material=material,
                    computation_params=computation_params,
                )

                receipt_rows = supply_receipts.get(material_id) or []
                if netting_params_for_supply.get("include_in_transit", False):
                    receipts_by_date = aggregate_qty_by_date(receipt_rows)
                else:
                    receipts_by_date = {}

                if source_type == SOURCE_TYPE_BUY:
                    lead = int(resolved_source_config.get("purchase_lead_time") or 0)
                elif source_type == SOURCE_TYPE_OUTSOURCE:
                    lead = int(resolved_source_config.get("outsource_lead_time") or 0)
                else:
                    lead = int(resolved_source_config.get("production_lead_time") or 0)

                min_l, max_l, mul_l, fixed_l = _extract_lot_rules(
                    material, source_type, computation_params
                )

                def _lot(raw: Decimal) -> Decimal:
                    q = raw
                    if source_type == SOURCE_TYPE_MAKE:
                        q = _apply_production_waste_to_qty(
                            q, resolved_source_config.get("production_waste_rate")
                        )
                    if computation_params.get("apply_lot_sizing", True):
                        q = _apply_suggested_lot_rules(q, min_l, max_l, mul_l, fixed_l)
                    return q

                firm_entry = firmed_map.get(int(material_id)) or {}
                firm_orders = firm_entry.get("orders") or []
                firm_frozen = bool(firm_entry.get("frozen"))

                tp = time_phased_net_material(
                    gross_by_date=dict(gross_by_material[material_id]),
                    receipts_by_date=receipts_by_date,
                    beginning_inventory=beginning,
                    safety_stock=float(safety_stock),
                    reorder_point=float(reorder_point),
                    lead_time_days=lead,
                    schedule_buffer_days=schedule_buffer_days,
                    include_safety_stock=bool(
                        netting_params_for_supply.get("include_safety_stock", True)
                    ),
                    include_reorder_point=bool(
                        netting_params_for_supply.get("include_reorder_point", False)
                    ),
                    apply_lot_fn=_lot,
                    suggestion_basis=mrp_basis,
                    today=schedule_today,
                    holiday_dates=holiday_dates if use_work_calendar else None,
                    use_work_calendar=use_work_calendar,
                    firm_planned_orders=firm_orders,
                    frozen=firm_frozen,
                    schedule_direction=schedule_direction,
                )

                planned_qty = float(tp["planned_order_qty"] or 0)
                gross_requirement = float(tp["gross_requirement"] or 0)
                net_requirement = float(tp["net_requirement"] or 0)
                in_transit_qty = sum(float(r.get("qty") or 0) for r in receipt_rows)
                reserved_qty = _safe_float(inventory_info.get("reserved_quantity"))
                available_inventory = _safe_float(inventory_info.get("available_quantity"))

                delivery_date = tp.get("earliest_demand_date")
                release_date = tp.get("release_date")
                receipt_date = tp.get("receipt_date")

                suggested_work_order_quantity = Decimal(0)
                suggested_purchase_order_quantity = Decimal(0)
                planned_production = Decimal(0)
                planned_procurement = Decimal(0)
                production_start_date = None
                production_completion_date = None
                procurement_start_date = None
                procurement_completion_date = None

                if source_type == SOURCE_TYPE_MAKE and planned_qty > 0:
                    suggested_work_order_quantity = Decimal(str(planned_qty))
                    planned_production = suggested_work_order_quantity
                    production_start_date = release_date
                    production_completion_date = receipt_date
                elif source_type == SOURCE_TYPE_BUY and planned_qty > 0:
                    suggested_purchase_order_quantity = Decimal(str(planned_qty))
                    planned_procurement = suggested_purchase_order_quantity
                    procurement_start_date = release_date
                    procurement_completion_date = receipt_date
                elif source_type == SOURCE_TYPE_OUTSOURCE and planned_qty > 0:
                    suggested_work_order_quantity = Decimal(str(planned_qty))
                    planned_production = suggested_work_order_quantity
                    production_start_date = release_date
                    production_completion_date = receipt_date

                meta = _meta(material_id)
                results_by_material[material_id] = {
                    "material_id": material_id,
                    "material_code": meta.get("material_code") or material.main_code or material.code,
                    "material_name": meta.get("material_name") or material.name,
                    "material_spec": material.specification,
                    "material_unit": meta.get("unit") or material.base_unit or "",
                    "gross_requirement": gross_requirement,
                    "available_inventory": available_inventory,
                    "net_requirement": net_requirement,
                    "safety_stock": safety_stock,
                    "reorder_point": reorder_point,
                    "delivery_date": delivery_date,
                    "planned_production": planned_production,
                    "planned_procurement": planned_procurement,
                    "production_start_date": production_start_date,
                    "production_completion_date": production_completion_date,
                    "procurement_start_date": procurement_start_date,
                    "procurement_completion_date": procurement_completion_date,
                    "suggested_work_order_quantity": suggested_work_order_quantity,
                    "suggested_purchase_order_quantity": suggested_purchase_order_quantity,
                    "source_type": source_type,
                    "source_config": source_config,
                    "validation_passed": validation_passed,
                    "validation_errors": validation_errors,
                    "demand_item_ids": list(meta.get("demand_item_ids") or []),
                    "parent_material_ids": set(meta.get("parent_material_ids") or set()),
                    "in_transit_qty": in_transit_qty,
                    "reserved_qty": reserved_qty,
                    "inventory_info": inventory_info,
                    "time_buckets": tp.get("time_buckets") or [],
                    "exceptions": tp.get("exceptions") or [],
                    "planned_orders": tp.get("planned_orders") or [],
                    "dated_supply": [
                        {
                            "date": r["date"].isoformat() if isinstance(r.get("date"), date) else r.get("date"),
                            "qty": r.get("qty"),
                            "source_type": r.get("source_type"),
                            "document_code": r.get("document_code"),
                        }
                        for r in receipt_rows
                    ],
                    "llc": llc.get(material_id, 0),
                }

                # 4) 父件计划订单量 → 展开一层子件毛需求
                if (
                    source_type in (SOURCE_TYPE_MAKE, SOURCE_TYPE_OUTSOURCE, SOURCE_TYPE_CONFIGURE)
                    and planned_qty > 0
                ):
                    for po in tp.get("planned_orders") or []:
                        po_qty = float(po.get("qty") or 0)
                        if po_qty <= 0:
                            continue
                        child_due = po.get("release_date") or po.get("receipt_date") or schedule_today
                        if isinstance(child_due, datetime):
                            child_due = child_due.date()
                        if not isinstance(child_due, date):
                            child_due = schedule_today
                        try:
                            children = await explode_bom_one_level_for_mrp(
                                tenant_id=tenant_id,
                                material_id=material_id,
                                planned_quantity=po_qty,
                                only_approved=True,
                                bom_version=bom_version,
                                use_default_bom=use_default_bom,
                                material_bom_versions=material_bom_versions,
                                as_of_date=_mrp_bom_as_of_datetime(child_due),
                            )
                        except Exception as e:
                            logger.warning(
                                f"LLC 子件展开失败 parent={material_id} qty={po_qty}: {e}"
                            )
                            continue
                        for child in children:
                            cid = int(child["material_id"])
                            cqty = float(child.get("required_quantity") or 0)
                            _add_gross(
                                cid,
                                child_due,
                                cqty,
                                parent_material_id=material_id,
                                unit=child.get("unit"),
                                material_code=child.get("material_code"),
                                material_name=child.get("material_name"),
                            )
                            for did in meta.get("demand_item_ids") or []:
                                merge_demand_meta(_meta(cid), demand_item_id=did)
                            # 确保子件有 LLC（若结构发现遗漏）
                            llc[cid] = max(llc.get(cid, 0), llc.get(material_id, 0) + 1)

        # 5) 落库
        pegging_rows: Dict[int, Dict[str, Any]] = {}
        for material_id, pending in results_by_material.items():
            src_cfg = pending.get("source_config") or {}
            planning_qty = float(
                pending.get("planned_production")
                or pending.get("planned_procurement")
                or 0
            )
            pegging_rows[material_id] = {
                "source_type": pending["source_type"],
                "bom_level": pending.get("llc") or 0,
                "parent_material_ids": set(pending.get("parent_material_ids") or set()),
                "planning_qty": planning_qty,
                "production_lead_time": int(src_cfg.get("production_lead_time") or 0),
                "outsource_lead_time": int(src_cfg.get("outsource_lead_time") or 0),
                "purchase_lead_time": int(src_cfg.get("purchase_lead_time") or 0),
                "schedule_buffer_days": schedule_buffer_days,
                "production_start_date": pending.get("production_start_date"),
                "production_completion_date": pending.get("production_completion_date"),
                "procurement_start_date": pending.get("procurement_start_date"),
                "procurement_completion_date": pending.get("procurement_completion_date"),
                "delivery_date": pending.get("delivery_date"),
            }

        apply_bom_pegged_production_schedules(
            pegging_rows,
            today=schedule_today,
            schedule_direction=schedule_direction,
        )

        for material_id, pending in results_by_material.items():
            peg = pegging_rows.get(material_id) or {}
            production_start_date = peg.get("production_start_date", pending["production_start_date"])
            production_completion_date = peg.get(
                "production_completion_date", pending["production_completion_date"]
            )
            procurement_start_date = peg.get(
                "procurement_start_date", pending["procurement_start_date"]
            )
            procurement_completion_date = peg.get(
                "procurement_completion_date", pending["procurement_completion_date"]
            )

            firm_entry = firmed_map.get(int(material_id)) or {}
            supply_for_detail = {
                "mrp_engine": "llc_time_phased",
                "mrp_suggestion_basis": mrp_basis,
                "llc": pending.get("llc"),
                "schedule_direction": schedule_direction,
                "use_work_calendar": use_work_calendar,
                "forecast_consume_enabled": forecast_consume_enabled,
                "forecast_consumed_total": forecast_consumed_total,
                "frozen": bool(firm_entry.get("frozen")),
                "planned_orders": [
                    {
                        "qty": po.get("qty"),
                        "receipt_date": po["receipt_date"].isoformat()
                        if isinstance(po.get("receipt_date"), date)
                        else po.get("receipt_date"),
                        "release_date": po["release_date"].isoformat()
                        if isinstance(po.get("release_date"), date)
                        else po.get("release_date"),
                        "firm": bool(po.get("firm")),
                        "frozen": bool(po.get("frozen") or firm_entry.get("frozen")),
                    }
                    for po in (pending.get("planned_orders") or [])
                ],
            }

            await DemandComputationItem.create(
                tenant_id=tenant_id,
                computation_id=computation.id,
                material_id=material_id,
                material_code=pending["material_code"],
                material_name=pending["material_name"],
                material_spec=pending["material_spec"],
                material_unit=pending["material_unit"],
                required_quantity=Decimal(str(pending["gross_requirement"])),
                available_inventory=Decimal(str(pending["available_inventory"])),
                net_requirement=Decimal(str(pending["net_requirement"])),
                gross_requirement=Decimal(str(pending["gross_requirement"])),
                safety_stock=Decimal(str(pending["safety_stock"]))
                if netting_params_for_supply.get("include_safety_stock", True)
                else None,
                reorder_point=Decimal(str(pending["reorder_point"]))
                if netting_params_for_supply.get("include_reorder_point", False)
                else None,
                delivery_date=pending["delivery_date"],
                planned_production=pending["planned_production"]
                if pending["planned_production"] > 0
                else None,
                planned_procurement=pending["planned_procurement"]
                if pending["planned_procurement"] > 0
                else None,
                production_start_date=production_start_date,
                production_completion_date=production_completion_date,
                procurement_start_date=procurement_start_date,
                procurement_completion_date=procurement_completion_date,
                suggested_work_order_quantity=pending["suggested_work_order_quantity"]
                if pending["suggested_work_order_quantity"] > 0
                else None,
                suggested_purchase_order_quantity=pending["suggested_purchase_order_quantity"]
                if pending["suggested_purchase_order_quantity"] > 0
                else None,
                material_source_type=pending["source_type"],
                material_source_config=pending["source_config"],
                source_validation_passed=pending["validation_passed"],
                source_validation_errors=pending["validation_errors"]
                if not pending["validation_passed"]
                else None,
                demand_item_ids=pending["demand_item_ids"],
                detail_results={
                    "demand_item_ids": pending["demand_item_ids"] or [],
                    "in_transit_quantity": pending["in_transit_qty"],
                    "reserved_quantity": pending["reserved_qty"],
                    "on_hand": _safe_float(pending["inventory_info"].get("on_hand")),
                    "inventory_breakdown": pending["inventory_info"].get("breakdown") or {},
                    "supply_calculation": supply_for_detail,
                    "time_buckets": pending.get("time_buckets") or [],
                    "exceptions": pending.get("exceptions") or [],
                    "dated_supply": pending.get("dated_supply") or [],
                    "llc": pending.get("llc"),
                    "planned_orders_frozen": bool(firm_entry.get("frozen")),
                },
            )

        # 6) 需求行 BOM 生产树（供工单组下推）
        from apps.kuaizhizao.utils.work_order_group_bom_tree import (
            build_production_tree_for_demand_item,
        )

        demand_item_bom_trees: List[Dict[str, Any]] = []
        for demand_item in demand_items:
            material_id = demand_item.material_id
            required_quantity = float(demand_item.required_quantity or 0)
            if required_quantity <= 0:
                continue
            delivery_date = getattr(demand_item, "delivery_date", None)
            if planning_cutoff and delivery_date is not None:
                dd = delivery_date.date() if hasattr(delivery_date, "date") else delivery_date
                if isinstance(dd, date) and dd > planning_cutoff:
                    continue
            material = await Material.get_or_none(tenant_id=tenant_id, id=material_id)
            if not material:
                continue
            source_type = await get_material_source_type(tenant_id, material_id)
            top_version = bom_version
            top_use_default = use_default_bom
            if material_bom_versions:
                v = material_bom_versions.get(material_id) or material_bom_versions.get(str(material_id))
                if v:
                    top_version = v
                    top_use_default = False
            tree = await build_production_tree_for_demand_item(
                tenant_id=tenant_id,
                demand_item_id=demand_item.id,
                material_id=material_id,
                required_quantity=required_quantity,
                material_code=material.main_code or material.code,
                material_name=material.name,
                source_type=source_type,
                unit=material.base_unit,
                bom_version=top_version,
                use_default_bom=top_use_default,
                material_bom_versions=material_bom_versions,
                variant_attributes=getattr(demand_item, "variant_attributes", None),
                configurable_selections=_safe_configurable_selections(
                    getattr(demand_item, "configurable_selections", None)
                ),
                bom_max_level=bom_max_level,
            )
            demand_item_bom_trees.append(tree)

        await DemandComputation.filter(tenant_id=tenant_id, id=computation.id).update(
            demand_item_bom_trees=demand_item_bom_trees,
        )
        computation.demand_item_bom_trees = demand_item_bom_trees

    async def firm_planned_orders(
        self,
        tenant_id: int,
        computation_id: int,
        item_id: int,
        *,
        firm: bool = True,
        frozen: bool = False,
        operator_id: Optional[int] = None,
    ) -> Dict[str, Any]:
        """确认/取消确认计算明细上的计划订单；冻结时重算保留且不再生成新计划。"""
        del operator_id
        computation = await DemandComputation.get_or_none(tenant_id=tenant_id, id=computation_id)
        if not computation:
            raise NotFoundError(f"需求计算不存在: {computation_id}")
        if computation.computation_status != "完成":
            raise BusinessLogicError(
                f"仅已完成的计算可确认计划订单，当前状态: {computation.computation_status}"
            )
        item = await DemandComputationItem.get_or_none(
            tenant_id=tenant_id, id=item_id, computation_id=computation_id
        )
        if not item:
            raise NotFoundError(f"计算明细不存在: {item_id}")

        detail = dict(item.detail_results or {})
        supply = dict(detail.get("supply_calculation") or {})
        orders = list(supply.get("planned_orders") or detail.get("planned_orders") or [])
        if not orders and firm:
            raise BusinessLogicError("该物料无计划订单可确认")

        new_orders: List[Dict[str, Any]] = []
        for po in orders:
            if not isinstance(po, dict):
                continue
            row = dict(po)
            row["firm"] = bool(firm)
            row["frozen"] = bool(frozen) if firm else False
            new_orders.append(row)

        supply["planned_orders"] = new_orders
        supply["frozen"] = bool(frozen) if firm else False
        detail["supply_calculation"] = supply
        detail["planned_orders_frozen"] = bool(frozen) if firm else False
        item.detail_results = detail
        await item.save(update_fields=["detail_results", "updated_at"])

        return {
            "item_id": item.id,
            "material_id": item.material_id,
            "firm": bool(firm),
            "frozen": bool(frozen) if firm else False,
            "planned_orders": new_orders,
        }

    async def update_computation(
        self,
        tenant_id: int,
        computation_id: int,
        computation_data: DemandComputationUpdate,
        updated_by: int
    ) -> DemandComputationResponse:
        """
        更新需求计算
        
        Args:
            tenant_id: 租户ID
            computation_id: 计算ID
            computation_data: 更新数据
            updated_by: 更新人ID
            
        Returns:
            DemandComputationResponse: 更新后的计算响应
        """
        async with in_transaction():
            computation = await DemandComputation.get_or_none(tenant_id=tenant_id, id=computation_id)
            if not computation:
                raise NotFoundError(f"需求计算不存在: {computation_id}")
            
            # 只能更新进行中或失败状态的计算
            if computation.computation_status not in ["进行中", "失败"]:
                raise BusinessLogicError(f"只能更新进行中或失败状态的计算，当前状态: {computation.computation_status}")
            
            # 准备更新数据
            update_data = computation_data.model_dump(exclude_unset=True)
            user = await User.get_or_none(id=updated_by)
            apply_update_audit(update_data, user)
            
            # 更新计算
            await DemandComputation.filter(tenant_id=tenant_id, id=computation_id).update(**update_data)
            
            # 返回更新后的计算
            items = await DemandComputationItem.filter(
                tenant_id=tenant_id,
                computation_id=computation_id
            ).all()
            return await self._build_computation_response(
                await DemandComputation.get(tenant_id=tenant_id, id=computation_id),
                items
            )

    async def delete_computation(
        self,
        tenant_id: int,
        computation_id: int
    ) -> None:
        """
        删除需求计算

        若下游单据（工单/采购单/生产计划/采购申请）未执行，允许删除并级联删除；已执行则不允许删除。
        删除时会同步清除关联的需求计算明细、快照、重算历史及单据关联关系，并更新需求的 pushed_to_computation 状态。

        Args:
            tenant_id: 租户ID
            computation_id: 计算ID

        Raises:
            NotFoundError: 需求计算不存在
            BusinessLogicError: 已有已执行的下游单据，无法删除
        """
        from apps.kuaizhizao.models.document_relation import DocumentRelation
        from apps.kuaizhizao.services.demand_service import DemandService

        DOWNSTREAM_TYPES = ("work_order", "purchase_order", "purchase_requisition")

        async with in_transaction():
            computation = await DemandComputation.get_or_none(tenant_id=tenant_id, id=computation_id)
            if not computation:
                raise NotFoundError(f"需求计算不存在: {computation_id}")

            demand_svc = DemandService()
            downstream_rels = await DocumentRelation.filter(
                tenant_id=tenant_id,
                source_type="demand_computation",
                source_id=computation_id,
                target_type__in=DOWNSTREAM_TYPES
            ).all()

            for rel in downstream_rels:
                if await demand_svc._is_downstream_executed(tenant_id, rel.target_type, rel.target_id):
                    raise BusinessLogicError(
                        "需求计算已下推的工单/采购单等下游单据已执行，无法删除。请先处理已执行的下游单据。"
                    )

            if downstream_rels:
                await demand_svc._cascade_delete_unexecuted_downstream(tenant_id, computation_id)

            demand_ids_in_comp = computation.demand_ids if computation.demand_ids else [computation.demand_id]

            # 删除明细、快照、重算历史
            await DemandComputationItem.filter(
                tenant_id=tenant_id,
                computation_id=computation_id
            ).delete()
            await DemandComputationSnapshot.filter(
                tenant_id=tenant_id,
                computation_id=computation_id
            ).delete()
            await DemandComputationRecalcHistory.filter(
                tenant_id=tenant_id,
                computation_id=computation_id
            ).delete()

            # 删除单据关联（双向）
            await DocumentRelation.filter(
                tenant_id=tenant_id,
                source_type="demand_computation",
                source_id=computation_id
            ).delete()
            await DocumentRelation.filter(
                tenant_id=tenant_id,
                target_type="demand_computation",
                target_id=computation_id
            ).delete()

            # 更新关联需求的 pushed_to_computation 状态并同步上游
            for rel_demand_id in demand_ids_in_comp:
                d_obj = await Demand.get_or_none(tenant_id=tenant_id, id=rel_demand_id)
                if d_obj:
                    await Demand.filter(tenant_id=tenant_id, id=rel_demand_id).update(
                        pushed_to_computation=False,
                        computation_id=None,
                        computation_code=None,
                        updated_at=resolve_business_datetime()
                    )
                    # 同步上游（销售订单/销售预测）
                    await demand_svc.sync_upstream_planning_on_withdraw(tenant_id, d_obj)

            # 删除需求计算主记录
            await DemandComputation.filter(tenant_id=tenant_id, id=computation_id).delete()

            logger.info(f"需求计算 {computation.computation_code} (id={computation_id}) 已删除")

    async def generate_work_orders_and_purchase_orders(
        self,
        tenant_id: int,
        computation_id: int,
        created_by: int,
        generate_mode: str = "all",
        allow_draft: bool = False,
        push_mode: Optional[str] = None,
    ) -> Dict[str, Any]:
        """
        从需求计算结果一键生成工单和采购单
        
        Args:
            tenant_id: 租户ID
            computation_id: 计算ID
            created_by: 创建人ID
            generate_mode: 生成粒度，all=全部，work_order_only=仅工单，purchase_only=仅采购
            allow_draft: 兼容旧参数；未传 push_mode 且为 True 时等价于 draft 模式
            push_mode: draft=草稿下推，confirm=正式下推（自动下达/提交）；缺省读组织配置
            
        Returns:
            Dict: 包含生成的工单和采购单信息
        """
        resolved_push_mode = str(push_mode or "").strip().lower()
        if resolved_push_mode not in ("draft", "confirm"):
            if allow_draft:
                resolved_push_mode = "draft"
            else:
                from infra.services.business_config_service import BusinessConfigService
                resolved_push_mode = await BusinessConfigService().get_push_default_mode(tenant_id)
        allow_draft = resolved_push_mode == "draft"
        push_as_confirm = resolved_push_mode == "confirm"
        # 不使用外层 in_transaction，避免与 create_work_order/create_purchase_order 内部事务嵌套，
        # 导致内层失败后 PostgreSQL 报「当前事务被终止, 事务块结束之前的查询被忽略」
        computation = await DemandComputation.get_or_none(tenant_id=tenant_id, id=computation_id)
        if not computation:
            raise NotFoundError(f"需求计算不存在: {computation_id}")
        
        # 只能从已完成的计算生成
        if computation.computation_status != "完成":
            raise BusinessLogicError(f"只能从已完成的计算生成工单和采购单，当前状态: {computation.computation_status}")
        
        # 按配置校验：若必须经生产计划，则不允许直连生成工单（委外工单单独下推不受此限制）
        needs_work_order = generate_mode in ("all", "work_order_only", "outsource_only")
        if needs_work_order:
            from infra.services.business_config_service import BusinessConfigService
            biz_config = BusinessConfigService()
            cfg = await biz_config.get_business_config(tenant_id)
            work_order_auto_generate = (
                cfg.get("parameters", {})
                .get("work_order", {})
                .get("auto_generate", False)
            )
            if not work_order_auto_generate:
                raise BusinessLogicError(
                    "当前组织未开启自动生成工单，请在参数设置中开启“自动生成工单”。"
                )
            can_direct = await biz_config.can_direct_generate_work_order_from_computation(tenant_id)
            if not can_direct:
                raise BusinessLogicError(
                    "当前配置要求经生产计划生成工单，请先「下推到生产计划」，再在生产计划中执行转工单。"
                )
        
        # 获取计算结果明细
        items = await DemandComputationItem.filter(
            tenant_id=tenant_id,
            computation_id=computation_id
        ).all()
        
        if not items:
            raise BusinessLogicError("计算结果明细为空，无法生成工单和采购单")

        # 获取已下推且仍存在的单据，用于排除重复下推
        exclusions = await self._get_already_pushed_exclusions(tenant_id, computation_id)
        already_pushed_wo_material_ids = exclusions["wo_material_ids"] | exclusions["outsource_material_ids"]
        purchase_remaining_by_material = self._get_purchase_remaining_qty_by_material(items, exclusions)
        
        # #region agent log
        try:
            import json as _json
            _log_path = r"f:\dev\riveredge\.cursor\debug.log"
            _items_debug = [{"material_code": i.material_code, "source_type": i.material_source_type, "suggested_wo_qty": getattr(i, "suggested_work_order_quantity", None), "suggested_po_qty": getattr(i, "suggested_purchase_order_quantity", None)} for i in items]
            with open(_log_path, "a", encoding="utf-8") as _f:
                _f.write(_json.dumps({"location": "demand_computation_service.py:generate_orders", "message": "items_before_loop", "data": {"computation_id": computation_id, "generate_mode": generate_mode, "items_count": len(items), "items": _items_debug}, "timestamp": __import__("time").time() * 1000, "hypothesisId": "A,B"}) + "\n")
        except Exception:
            pass
        # #endregion
        
        # 【第一阶段：预验证】先验证所有物料，如有错误且未允许草稿则立即失败
        validation_errors = []
        failed_validation_material_ids = set()  # 验证失败的物料ID，allow_draft 时用于创建草稿
        
        for item in items:
            source_type = item.material_source_type
            
            # 跳过虚拟件（虚拟件不生成工单和采购单）
            if source_type == SOURCE_TYPE_PHANTOM:
                continue
            
            # 验证物料来源配置（验证失败时收集错误）
            if source_type:
                validation_passed, errors = await validate_material_source_config(
                    tenant_id=tenant_id,
                    material_id=item.material_id,
                    source_type=source_type
                )
                
                if not validation_passed:
                    validation_errors.extend([f"物料 {item.material_code} ({item.material_name}): {err}" for err in errors])
                    failed_validation_material_ids.add(item.material_id)
        
        # 如果有验证错误且未允许草稿，立即抛出异常（此时还未创建任何工单）
        if validation_errors and not allow_draft:
            error_msg = "物料来源验证失败，无法生成工单和采购单：\n" + "\n".join(validation_errors)
            logger.error(f"预验证失败: {error_msg}")
            raise BusinessLogicError(error_msg)
        
        # 【第二阶段：创建工单和采购单】验证全部通过后，开始创建
        work_orders = []  # 生产工单（WorkOrder，在工单管理页展示）
        outsource_work_orders = []  # 委外工单（OutsourceWorkOrder，在委外管理页展示）
        work_order_groups = []
        purchase_orders = []
        
        # 按供应商分组采购件（物料来源控制增强）
        purchase_items_by_supplier: Dict[int, List[DemandComputationItem]] = {}
        
        use_group_by_demand_item = False
        group_pushed_keys: set = set()
        if needs_work_order:
            from apps.kuaizhizao.services.work_order_group_service import WorkOrderGroupService

            group_svc = WorkOrderGroupService()
            use_group_by_demand_item = await group_svc.should_group_by_demand_item(tenant_id)
            if use_group_by_demand_item:
                group_pushed_keys = await group_svc.collect_pushed_keys(tenant_id, computation_id)
        
        # 按物料聚合生产类明细（同一物料多行合并为一行，避免重复生成工单）
        def _build_aggregated_item(group: List[DemandComputationItem]):
            first = group[0]
            if len(group) == 1:
                return first
            total_qty = sum(float(g.suggested_work_order_quantity or 0) for g in group)
            start_dates = [g.production_start_date for g in group if g.production_start_date]
            end_dates = [g.production_completion_date for g in group if g.production_completion_date]
            return type("_AggregatedItem", (), {
                "material_id": first.material_id,
                "material_code": first.material_code,
                "material_name": first.material_name,
                "material_spec": first.material_spec,
                "material_unit": first.material_unit,
                "material_source_type": first.material_source_type,
                "material_source_config": first.material_source_config,
                "suggested_work_order_quantity": Decimal(str(total_qty)),
                "production_start_date": min(start_dates) if start_dates else None,
                "production_completion_date": max(end_dates) if end_dates else None,
            })()

        created_wo_material_ids: set = set(already_pushed_wo_material_ids)  # 已创建/已下推工单的物料ID，避免重复
        created_po_material_ids: set = set()  # 本次循环已加入采购分组的物料，避免重复行

        if use_group_by_demand_item and generate_mode in ("all", "work_order_only", "outsource_only"):
            from apps.kuaizhizao.services.work_order_group_service import WorkOrderGroupService

            group_svc = WorkOrderGroupService()
            group_result = await group_svc.generate_groups_from_computation(
                tenant_id=tenant_id,
                computation=computation,
                items=items,
                created_by=created_by,
                generate_mode=generate_mode,
                allow_draft=allow_draft,
                failed_validation_material_ids=failed_validation_material_ids,
                already_pushed_keys=group_pushed_keys,
            )
            work_orders = group_result["work_orders"]
            outsource_work_orders = group_result["outsource_work_orders"]
            work_order_groups = group_result.get("work_order_groups") or []
            for mid in group_pushed_keys:
                if mid[1]:
                    created_wo_material_ids.add(mid[1])

        for item in items:
            source_type = item.material_source_type
            
            # 跳过虚拟件（虚拟件不生成工单和采购单）
            if source_type == SOURCE_TYPE_PHANTOM:
                # #region agent log
                try:
                    with open(r"f:\dev\riveredge\.cursor\debug.log", "a", encoding="utf-8") as _f:
                        _f.write(__import__("json").dumps({"location": "demand_computation_service.py:loop", "message": "skip_phantom", "data": {"material_code": item.material_code}, "hypothesisId": "A"}) + "\n")
                except Exception:
                    pass
                # #endregion
                logger.debug(f"跳过虚拟件，不生成工单和采购单，物料ID: {item.material_id}")
                continue
            
            # 根据 generate_mode 决定是否生成
            if generate_mode == "purchase_only" and source_type in (SOURCE_TYPE_MAKE, SOURCE_TYPE_OUTSOURCE, SOURCE_TYPE_CONFIGURE):
                continue
            if generate_mode == "work_order_only" and source_type == SOURCE_TYPE_BUY:
                # #region agent log
                try:
                    with open(r"f:\dev\riveredge\.cursor\debug.log", "a", encoding="utf-8") as _f:
                        _f.write(__import__("json").dumps({"location": "demand_computation_service.py:loop", "message": "skip_buy_work_order_only", "data": {"material_code": item.material_code}, "hypothesisId": "A"}) + "\n")
                except Exception:
                    pass
                # #endregion
                continue
            if generate_mode == "outsource_only" and source_type != SOURCE_TYPE_OUTSOURCE:
                continue

            if use_group_by_demand_item and source_type in (
                SOURCE_TYPE_MAKE,
                SOURCE_TYPE_OUTSOURCE,
                SOURCE_TYPE_CONFIGURE,
            ):
                continue

            # 根据物料来源类型生成相应的单据
            if source_type == SOURCE_TYPE_MAKE:
                # 自制件：生成生产工单（按物料聚合，避免重复）
                if item.material_id in created_wo_material_ids:
                    continue
                sq = getattr(item, "suggested_work_order_quantity", None)
                if not (sq and sq > 0):
                    # #region agent log
                    try:
                        with open(r"f:\dev\riveredge\.cursor\debug.log", "a", encoding="utf-8") as _f:
                            _f.write(__import__("json").dumps({"location": "demand_computation_service.py:loop", "message": "skip_make_no_qty", "data": {"material_code": item.material_code, "suggested_work_order_quantity": sq}, "hypothesisId": "A"}) + "\n")
                    except Exception:
                        pass
                    # #endregion
                if item.suggested_work_order_quantity and item.suggested_work_order_quantity > 0:
                    same_material = [i for i in items if i.material_id == item.material_id and i.material_source_type == SOURCE_TYPE_MAKE and (float(i.suggested_work_order_quantity or 0) > 0)]
                    agg_item = _build_aggregated_item(same_material)
                    allow_draft_for_item = allow_draft and item.material_id in failed_validation_material_ids
                    work_order = await self._create_work_order_from_item(
                        tenant_id=tenant_id,
                        computation=computation,
                        item=agg_item,
                        created_by=created_by,
                        allow_draft=allow_draft_for_item,
                    )
                    work_orders.append(work_order)
                    created_wo_material_ids.add(item.material_id)
                    
            elif source_type == SOURCE_TYPE_BUY:
                # 采购件：正式下推须配置默认供应商；草稿下推允许无供应商（归入待定分组）
                # 按剩余可推数量补推，支持部分物料/部分数量已下推后继续下推
                if item.material_id in created_po_material_ids:
                    continue
                remaining_qty = purchase_remaining_by_material.get(int(item.material_id or 0), 0.0)
                if remaining_qty <= 0:
                    continue
                if item.suggested_purchase_order_quantity and item.suggested_purchase_order_quantity > 0:
                    supplier_id = None
                    if item.material_source_config:
                        sc = resolve_computation_item_source_config(item.material_source_config)
                        supplier_id = sc.get("default_supplier_id")
                    group_key = None
                    if supplier_id:
                        group_key = supplier_id
                    elif allow_draft:
                        group_key = PURCHASE_ORDER_NO_SUPPLIER_GROUP
                    if group_key is not None:
                        same_material = [
                            i
                            for i in items
                            if i.material_source_type == SOURCE_TYPE_BUY
                            and i.material_id == item.material_id
                            and float(i.suggested_purchase_order_quantity or 0) > 0
                        ]
                        agg_item = self._build_aggregated_purchase_item(same_material, remaining_qty)
                        if group_key not in purchase_items_by_supplier:
                            purchase_items_by_supplier[group_key] = []
                        purchase_items_by_supplier[group_key].append(agg_item)
                        created_po_material_ids.add(item.material_id)
                    
            elif source_type == SOURCE_TYPE_OUTSOURCE:
                # 委外件：生成委外工单（按物料聚合，避免重复）
                if item.material_id in created_wo_material_ids:
                    continue
                if item.suggested_work_order_quantity and item.suggested_work_order_quantity > 0:
                    same_material = [i for i in items if i.material_id == item.material_id and i.material_source_type == SOURCE_TYPE_OUTSOURCE and (float(i.suggested_work_order_quantity or 0) > 0)]
                    agg_item = _build_aggregated_item(same_material)
                    allow_draft_for_item = allow_draft and item.material_id in failed_validation_material_ids
                    work_order = await self._create_outsource_work_order_from_item(
                        tenant_id=tenant_id,
                        computation=computation,
                        item=agg_item,
                        created_by=created_by,
                        allow_draft=allow_draft_for_item,
                    )
                    outsource_work_orders.append(work_order)
                    created_wo_material_ids.add(item.material_id)
                    
            elif source_type == SOURCE_TYPE_CONFIGURE:
                # 配置件：按属性生成生产工单（按物料聚合，避免重复）
                if item.material_id in created_wo_material_ids:
                    continue
                if item.suggested_work_order_quantity and item.suggested_work_order_quantity > 0:
                    same_material = [i for i in items if i.material_id == item.material_id and i.material_source_type == SOURCE_TYPE_CONFIGURE and (float(i.suggested_work_order_quantity or 0) > 0)]
                    agg_item = _build_aggregated_item(same_material)
                    allow_draft_for_item = allow_draft and item.material_id in failed_validation_material_ids
                    work_order = await self._create_work_order_from_item(
                        tenant_id=tenant_id,
                        computation=computation,
                        item=agg_item,
                        created_by=created_by,
                        allow_draft=allow_draft_for_item,
                    )
                    work_orders.append(work_order)
                    created_wo_material_ids.add(item.material_id)
            
            # 兼容旧逻辑：如果没有物料来源类型，根据建议数量生成（向后兼容，按物料聚合）
            elif not source_type:
                # #region agent log
                try:
                    with open(r"f:\dev\riveredge\.cursor\debug.log", "a", encoding="utf-8") as _f:
                        _f.write(__import__("json").dumps({"location": "demand_computation_service.py:loop", "message": "no_source_type_legacy", "data": {"material_code": item.material_code, "suggested_wo_qty": getattr(item, "suggested_work_order_quantity", None)}, "hypothesisId": "B"}) + "\n")
                except Exception:
                    pass
                # #endregion
                # 如果有建议工单数量，生成工单（按物料聚合）
                if item.suggested_work_order_quantity and item.suggested_work_order_quantity > 0:
                    if item.material_id not in created_wo_material_ids:
                        same_material = [i for i in items if not i.material_source_type and i.material_id == item.material_id and (float(i.suggested_work_order_quantity or 0) > 0)]
                        agg_item = _build_aggregated_item(same_material) if len(same_material) > 1 else item
                        allow_draft_for_item = allow_draft and item.material_id in failed_validation_material_ids
                        work_order = await self._create_work_order_from_item(
                            tenant_id=tenant_id,
                            computation=computation,
                            item=agg_item,
                            created_by=created_by,
                            allow_draft=allow_draft_for_item,
                        )
                        work_orders.append(work_order)
                        created_wo_material_ids.add(item.material_id)
                
                # 如果有建议采购订单数量：正式下推须默认供应商，草稿下推允许无供应商
                if item.material_id not in created_po_material_ids:
                    remaining_qty = purchase_remaining_by_material.get(int(item.material_id or 0), 0.0)
                    if remaining_qty > 0 and item.suggested_purchase_order_quantity and item.suggested_purchase_order_quantity > 0:
                        supplier_id = None
                        if item.material_source_config:
                            sc = resolve_computation_item_source_config(item.material_source_config)
                            supplier_id = sc.get("default_supplier_id")
                        group_key = None
                        if supplier_id:
                            group_key = supplier_id
                        elif allow_draft:
                            group_key = PURCHASE_ORDER_NO_SUPPLIER_GROUP
                        if group_key is not None:
                            same_material = [
                                i
                                for i in items
                                if not i.material_source_type
                                and i.material_id == item.material_id
                                and float(i.suggested_purchase_order_quantity or 0) > 0
                            ]
                            agg_item = self._build_aggregated_purchase_item(same_material, remaining_qty)
                            if group_key not in purchase_items_by_supplier:
                                purchase_items_by_supplier[group_key] = []
                            purchase_items_by_supplier[group_key].append(agg_item)
                            created_po_material_ids.add(item.material_id)
            
            else:
                # #region agent log
                try:
                    with open(r"f:\dev\riveredge\.cursor\debug.log", "a", encoding="utf-8") as _f:
                        _f.write(__import__("json").dumps({"location": "demand_computation_service.py:loop", "message": "unhandled_source_type", "data": {"material_code": item.material_code, "source_type": source_type}, "hypothesisId": "B"}) + "\n")
                except Exception:
                    pass
                # #endregion
        
        # 建立需求计算→工单的追溯关系（支持全链路追溯）
        from apps.kuaizhizao.services.document_relation_new_service import DocumentRelationNewService
        from apps.kuaizhizao.schemas.document_relation import DocumentRelationCreate
        relation_service = DocumentRelationNewService()
        for wo in work_orders:
            wo_id = wo.get("id") if isinstance(wo, dict) else wo.id
            wo_code = wo.get("code") if isinstance(wo, dict) else wo.code
            wo_name = wo.get("name") if isinstance(wo, dict) else getattr(wo, "name", None)
            try:
                rel_data = DocumentRelationCreate(
                    source_type="demand_computation",
                    source_id=computation_id,
                    source_code=computation.computation_code,
                    source_name=None,
                    target_type="work_order",
                    target_id=wo_id,
                    target_code=wo_code,
                    target_name=wo_name,
                    relation_type="source",
                    relation_mode="push",
                    relation_desc="从需求计算直连生成工单",
                    business_mode=computation.business_mode,
                    demand_id=computation.demand_id,
                )
                await relation_service.create_relation(tenant_id=tenant_id, relation_data=rel_data, created_by=created_by)
            except BusinessLogicError as e:
                if "关联关系已存在" not in str(e):
                    raise
        for wo in outsource_work_orders:
            wo_id = wo.get("id") if isinstance(wo, dict) else wo.id
            wo_code = wo.get("code") if isinstance(wo, dict) else wo.code
            try:
                rel_data = DocumentRelationCreate(
                    source_type="demand_computation",
                    source_id=computation_id,
                    source_code=computation.computation_code,
                    source_name=None,
                    target_type="outsource_work_order",
                    target_id=wo_id,
                    target_code=wo_code,
                    target_name=None,
                    relation_type="source",
                    relation_mode="push",
                    relation_desc="从需求计算直连生成委外工单",
                    business_mode=computation.business_mode,
                    demand_id=computation.demand_id,
                )
                await relation_service.create_relation(tenant_id=tenant_id, relation_data=rel_data, created_by=created_by)
            except BusinessLogicError as e:
                if "关联关系已存在" not in str(e):
                    raise
        
        if (
            generate_mode == "purchase_only"
            and push_as_confirm
            and not purchase_items_by_supplier
        ):
            raise BusinessLogicError("无已配置默认供应商的采购件，无法正式下推采购订单")

        # 按供应商分组生成采购订单（物料来源控制增强）
        for supplier_id, items_for_supplier in purchase_items_by_supplier.items():
            if items_for_supplier:
                purchase_order = await self._create_purchase_order_from_items(
                    tenant_id=tenant_id,
                    computation=computation,
                    items=items_for_supplier,
                    supplier_id=supplier_id,
                    created_by=created_by
                )
                purchase_orders.append(purchase_order)

        # 建立需求计算→采购单的追溯关系（与工单/委外一致）
        for po in purchase_orders:
            po_id = po.get("id") if isinstance(po, dict) else po.id
            po_code = po.get("order_code") if isinstance(po, dict) else getattr(po, "order_code", None)
            if not po_id:
                continue
            try:
                rel_data = DocumentRelationCreate(
                    source_type="demand_computation",
                    source_id=computation_id,
                    source_code=computation.computation_code,
                    source_name=None,
                    target_type="purchase_order",
                    target_id=po_id,
                    target_code=po_code,
                    target_name=None,
                    relation_type="source",
                    relation_mode="push",
                    relation_desc="从需求计算直连生成采购订单",
                    business_mode=computation.business_mode,
                    demand_id=computation.demand_id,
                )
                await relation_service.create_relation(tenant_id=tenant_id, relation_data=rel_data, created_by=created_by)
            except BusinessLogicError as e:
                if "关联关系已存在" not in str(e):
                    raise
        
        # #region agent log
        try:
            with open(r"f:\dev\riveredge\.cursor\debug.log", "a", encoding="utf-8") as _f:
                _f.write(__import__("json").dumps({"location": "demand_computation_service.py:return", "message": "generate_orders_result", "data": {"work_order_count": len(work_orders), "outsource_work_order_count": len(outsource_work_orders), "purchase_order_count": len(purchase_orders)}, "hypothesisId": "A,C,E"}) + "\n")
        except Exception:
            pass
        # #endregion
        if push_as_confirm:
            await self._apply_push_confirm_to_generated_orders(
                tenant_id=tenant_id,
                created_by=created_by,
                work_orders=work_orders,
                outsource_work_orders=outsource_work_orders,
                purchase_orders=purchase_orders,
            )
        return {
            "computation_id": computation_id,
            "computation_code": computation.computation_code,
            "push_mode": resolved_push_mode,
            "work_orders": work_orders,
            "outsource_work_orders": outsource_work_orders,
            "purchase_orders": purchase_orders,
            "work_order_count": len(work_orders),  # 生产工单数量（工单管理页）
            "outsource_work_order_count": len(outsource_work_orders),  # 委外工单数量（委外管理页）
            "purchase_order_count": len(purchase_orders),
            "work_order_groups": work_order_groups,
            "work_order_group_count": len(work_order_groups),
        }

    async def _apply_push_confirm_to_generated_orders(
        self,
        tenant_id: int,
        created_by: int,
        work_orders: List[Dict[str, Any]],
        outsource_work_orders: List[Dict[str, Any]],
        purchase_orders: List[Dict[str, Any]],
    ) -> None:
        """下推 confirm 模式：生产工单下达、委外工单下达、采购单提交/确认。"""
        from apps.kuaizhizao.services.work_order_service import WorkOrderService
        from apps.kuaizhizao.services.outsource_work_order_service import OutsourceWorkOrderService
        from apps.kuaizhizao.services.purchase_service import PurchaseService

        wo_service = WorkOrderService()
        owo_service = OutsourceWorkOrderService()
        po_service = PurchaseService()

        for wo in work_orders:
            wo_id = wo.get("id")
            if not wo_id:
                continue
            try:
                released = await wo_service.release_work_order(
                    tenant_id=tenant_id,
                    work_order_id=wo_id,
                    released_by=created_by,
                    check_shortage=False,
                )
                wo["status"] = getattr(released, "status", "released")
            except Exception as e:
                logger.warning(f"需求计算下推自动下达生产工单 {wo_id} 失败: {e}")

        for owo in outsource_work_orders:
            owo_id = owo.get("id")
            if not owo_id:
                continue
            try:
                released = await owo_service.release_outsource_work_order(
                    tenant_id=tenant_id,
                    work_order_id=owo_id,
                    released_by=created_by,
                )
                owo["status"] = getattr(released, "status", "released")
            except Exception as e:
                logger.warning(f"需求计算下推自动下达委外工单 {owo_id} 失败: {e}")

        for po in purchase_orders:
            po_id = po.get("id")
            if not po_id:
                continue
            po_supplier_id = int(po.get("supplier_id") or 0)
            if po_supplier_id <= 0:
                logger.warning(
                    f"需求计算下推 confirm：采购单 {po_id} 未指定供应商，跳过自动提交"
                )
                continue
            try:
                submitted = await po_service.submit_purchase_order(
                    tenant_id=tenant_id,
                    order_id=po_id,
                    submitted_by=created_by,
                )
                po["status"] = getattr(submitted, "status", None)
            except Exception as e:
                logger.warning(f"需求计算下推自动提交采购单 {po_id} 失败: {e}")

    async def get_push_records(
        self,
        tenant_id: int,
        computation_id: int
    ) -> Dict[str, Any]:
        """
        获取需求计算的下推记录，包含目标单据是否仍存在的标识。
        用于详情抽屉展示下推记录，已删除的单据会标识为 target_exists=False。
        """
        computation = await DemandComputation.get_or_none(tenant_id=tenant_id, id=computation_id)
        if not computation:
            raise NotFoundError(f"需求计算不存在: {computation_id}")

        from apps.kuaizhizao.models.document_relation import DocumentRelation
        from apps.kuaizhizao.models.work_order import WorkOrder
        from apps.kuaizhizao.models.purchase_order import PurchaseOrder
        from apps.kuaizhizao.models.purchase_requisition import PurchaseRequisition
        from apps.kuaizhizao.models.outsource_work_order import OutsourceWorkOrder

        rels = await DocumentRelation.filter(
            tenant_id=tenant_id,
            source_type="demand_computation",
            source_id=computation_id,
        ).order_by("created_at").all()

        records = []
        for rel in rels:
            target_exists = False
            tt, tid = rel.target_type, rel.target_id
            if tt == "work_order":
                wo = await WorkOrder.get_or_none(tenant_id=tenant_id, id=tid, deleted_at__isnull=True)
                target_exists = wo is not None
            elif tt == "outsource_work_order":
                owo = await OutsourceWorkOrder.get_or_none(tenant_id=tenant_id, id=tid, deleted_at__isnull=True)
                target_exists = owo is not None
            elif tt == "purchase_order":
                po = await PurchaseOrder.get_or_none(tenant_id=tenant_id, id=tid)
                target_exists = po is not None
            elif tt == "purchase_requisition":
                req = await PurchaseRequisition.get_or_none(tenant_id=tenant_id, id=tid, deleted_at__isnull=True)
                target_exists = req is not None
            else:
                target_exists = True  # 未知类型默认视为存在

            records.append({
                "target_type": tt,
                "target_id": tid,
                "target_code": rel.target_code,
                "target_name": rel.target_name,
                "relation_desc": rel.relation_desc,
                "created_at": to_api_isoformat(rel.created_at) if rel.created_at else None,
                "target_exists": target_exists,
            })

        return {"records": records}

    @staticmethod
    def _aggregate_buy_suggested_qty_by_material(
        items: List[DemandComputationItem],
    ) -> Dict[int, float]:
        """采购件建议数量按 material_id 汇总。"""
        out: Dict[int, float] = {}
        for item in items:
            if item.material_source_type != SOURCE_TYPE_BUY:
                continue
            mid = item.material_id
            if mid is None:
                continue
            qty = float(item.suggested_purchase_order_quantity or 0)
            if qty <= 0:
                continue
            out[int(mid)] = out.get(int(mid), 0.0) + qty
        return out

    @staticmethod
    def _get_purchase_remaining_qty_by_material(
        items: List[DemandComputationItem],
        exclusions: Dict[str, Any],
    ) -> Dict[int, float]:
        """
        按物料计算剩余可下推采购数量。
        已下推 = 关联采购订单 ordered_quantity + 关联采购申请占用数量。
        """
        suggested = DemandComputationService._aggregate_buy_suggested_qty_by_material(items)
        po_pushed = exclusions.get("po_pushed_qty_by_material_id") or {}
        pr_committed = exclusions.get("pr_committed_qty_by_material_id") or {}
        remaining: Dict[int, float] = {}
        for mid, sug in suggested.items():
            pushed = float(po_pushed.get(mid, 0.0)) + float(pr_committed.get(mid, 0.0))
            rem = max(0.0, sug - pushed)
            if rem > 0:
                remaining[mid] = rem
        return remaining

    @staticmethod
    def _build_aggregated_purchase_item(
        group: List[DemandComputationItem],
        remaining_qty: float,
    ) -> Any:
        """同一物料多行合并为一条下推明细，数量取剩余可推。"""
        first = group[0]
        start_dates = [g.procurement_start_date for g in group if g.procurement_start_date]
        end_dates = [
            g.procurement_completion_date or g.delivery_date
            for g in group
            if g.procurement_completion_date or g.delivery_date
        ]
        return type("_AggregatedPurchaseItem", (), {
            "id": first.id,
            "material_id": first.material_id,
            "material_code": first.material_code,
            "material_name": first.material_name,
            "material_spec": first.material_spec,
            "material_unit": first.material_unit,
            "material_source_type": first.material_source_type,
            "material_source_config": first.material_source_config,
            "suggested_purchase_order_quantity": Decimal(str(remaining_qty)),
            "procurement_start_date": min(start_dates) if start_dates else None,
            "procurement_completion_date": max(end_dates) if end_dates else None,
            "delivery_date": max(end_dates) if end_dates else getattr(first, "delivery_date", None),
        })()

    @staticmethod
    async def _accumulate_po_pushed_qty_from_order(
        tenant_id: int,
        order_id: int,
        po_pushed_qty_by_material_id: Dict[int, float],
    ) -> None:
        from apps.kuaizhizao.models.purchase_order import PurchaseOrder, PurchaseOrderItem

        po = await PurchaseOrder.get_or_none(tenant_id=tenant_id, id=order_id, deleted_at__isnull=True)
        if not po or po.status == DocumentStatus.CANCELLED.value:
            return
        po_items = await PurchaseOrderItem.filter(
            tenant_id=tenant_id,
            order_id=order_id,
            deleted_at__isnull=True,
        ).all()
        for poi in po_items:
            mid = int(poi.material_id)
            qty = float(poi.ordered_quantity or 0)
            if qty <= 0:
                continue
            po_pushed_qty_by_material_id[mid] = po_pushed_qty_by_material_id.get(mid, 0.0) + qty

    @staticmethod
    def _purchase_pushed_qty_for_material(
        material_id: int,
        suggested: float,
        exclusions: Dict[str, Any],
    ) -> float:
        po_pushed = exclusions.get("po_pushed_qty_by_material_id") or {}
        pr_committed = exclusions.get("pr_committed_qty_by_material_id") or {}
        return min(
            suggested,
            float(po_pushed.get(material_id, 0.0)) + float(pr_committed.get(material_id, 0.0)),
        )

    async def _get_already_pushed_exclusions(
        self, tenant_id: int, computation_id: int
    ) -> Dict[str, Any]:
        """
        获取需求计算已下推且仍存在的单据对应的排除信息。
        采购件按已下推数量计（支持部分下推后补推剩余数量）。
        返回: {
            wo_material_ids, outsource_material_ids,
            po_material_ids,  # 兼容：仍有剩余可推数量的物料不在此集合
            po_pushed_qty_by_material_id,
            pr_committed_qty_by_material_id,
            has_purchase_requisition,
        }
        """
        from apps.kuaizhizao.models.document_relation import DocumentRelation
        from apps.kuaizhizao.models.work_order import WorkOrder
        from apps.kuaizhizao.models.purchase_order import PurchaseOrder, PurchaseOrderItem
        from apps.kuaizhizao.models.purchase_requisition import (
            PurchaseRequisition,
            PurchaseRequisitionItem,
        )
        from apps.kuaizhizao.models.outsource_work_order import OutsourceWorkOrder

        rels = await DocumentRelation.filter(
            tenant_id=tenant_id,
            source_type="demand_computation",
            source_id=computation_id,
        ).all()

        wo_material_ids = set()
        outsource_material_ids = set()
        po_pushed_qty_by_material_id: Dict[int, float] = {}
        pr_committed_qty_by_material_id: Dict[int, float] = {}
        has_purchase_requisition = False

        for rel in rels:
            tt, tid = rel.target_type, rel.target_id
            if tt == "work_order":
                wo = await WorkOrder.get_or_none(tenant_id=tenant_id, id=tid, deleted_at__isnull=True)
                if wo:
                    wo_material_ids.add(wo.product_id)
            elif tt == "outsource_work_order":
                owo = await OutsourceWorkOrder.get_or_none(tenant_id=tenant_id, id=tid, deleted_at__isnull=True)
                if owo:
                    outsource_material_ids.add(owo.product_id)
            elif tt == "purchase_order":
                await self._accumulate_po_pushed_qty_from_order(
                    tenant_id, tid, po_pushed_qty_by_material_id
                )
            elif tt == "purchase_requisition":
                req = await PurchaseRequisition.get_or_none(
                    tenant_id=tenant_id, id=tid, deleted_at__isnull=True
                )
                if req and req.status != DocumentStatus.CANCELLED.value:
                    has_purchase_requisition = True
                    req_items = await PurchaseRequisitionItem.filter(
                        tenant_id=tenant_id,
                        requisition_id=tid,
                    ).all()
                    for pri in req_items:
                        mid = int(pri.material_id)
                        qty = float(pri.quantity or 0)
                        if qty <= 0:
                            continue
                        pr_committed_qty_by_material_id[mid] = (
                            pr_committed_qty_by_material_id.get(mid, 0.0) + qty
                        )

        linked_po_ids = {rel.target_id for rel in rels if rel.target_type == "purchase_order"}
        source_pos = await PurchaseOrder.filter(
            tenant_id=tenant_id,
            source_type="demand_computation",
            source_id=computation_id,
            deleted_at__isnull=True,
        ).all()
        for po in source_pos:
            if po.id in linked_po_ids:
                continue
            await self._accumulate_po_pushed_qty_from_order(
                tenant_id, po.id, po_pushed_qty_by_material_id
            )

        # 兼容旧字段：仅当该物料在关联 PO 中出现过且剩余为 0 时视为 fully pushed
        po_material_ids = set(po_pushed_qty_by_material_id.keys())

        return {
            "wo_material_ids": wo_material_ids,
            "outsource_material_ids": outsource_material_ids,
            "po_material_ids": po_material_ids,
            "po_pushed_qty_by_material_id": po_pushed_qty_by_material_id,
            "pr_committed_qty_by_material_id": pr_committed_qty_by_material_id,
            "has_purchase_requisition": has_purchase_requisition,
        }

    def _compute_downstream_push_progress(
        self,
        computation: DemandComputation,
        items: List[DemandComputationItem],
        exclusions: Dict[str, Any],
    ) -> float:
        """按建议数量加权计算需求计算下推进度（0-100）。"""
        if getattr(computation, "computation_status", None) != "完成":
            return 0.0

        wo_material_ids = exclusions.get("wo_material_ids") or set()
        outsource_material_ids = exclusions.get("outsource_material_ids") or set()
        po_pushed = exclusions.get("po_pushed_qty_by_material_id") or {}
        pr_committed = exclusions.get("pr_committed_qty_by_material_id") or {}

        pushable = 0.0
        pushed = 0.0
        buy_suggested = self._aggregate_buy_suggested_qty_by_material(items)
        for item in items:
            st = item.material_source_type
            if st == SOURCE_TYPE_PHANTOM:
                continue
            mid = item.material_id
            if mid is None:
                continue
            if st in (SOURCE_TYPE_MAKE, SOURCE_TYPE_CONFIGURE):
                qty = float(item.suggested_work_order_quantity or 0)
                if qty <= 0:
                    continue
                pushable += qty
                if mid in wo_material_ids:
                    pushed += qty
            elif st == SOURCE_TYPE_OUTSOURCE:
                qty = float(item.suggested_work_order_quantity or 0)
                if qty <= 0:
                    continue
                pushable += qty
                if mid in outsource_material_ids:
                    pushed += qty

        for mid, sug in buy_suggested.items():
            pushable += sug
            po_qty = float(po_pushed.get(mid, 0.0))
            pr_qty = float(pr_committed.get(mid, 0.0))
            pushed += min(sug, po_qty + pr_qty)

        if pushable <= 0:
            return 0.0
        progress = (pushed / pushable) * 100.0
        if progress < 0:
            return 0.0
        if progress > 100:
            return 100.0
        return round(progress, 1)

    async def get_push_options(
        self,
        tenant_id: int,
        computation_id: int
    ) -> Dict[str, Any]:
        """
        获取需求计算的下推能力与一键下推默认配置，供前端弹窗预填。
        """
        computation = await DemandComputation.get_or_none(tenant_id=tenant_id, id=computation_id)
        if not computation:
            raise NotFoundError(f"需求计算不存在: {computation_id}")
        if computation.computation_status != "完成":
            raise BusinessLogicError("只能对已完成的计算进行下推")

        items = await DemandComputationItem.filter(
            tenant_id=tenant_id,
            computation_id=computation_id
        ).all()

        make_count = 0
        outsource_count = 0
        purchase_items_with_supplier = 0
        purchase_items_without_supplier = 0

        for item in items:
            st = item.material_source_type
            if st == SOURCE_TYPE_PHANTOM:
                continue
            if st == SOURCE_TYPE_MAKE or st == SOURCE_TYPE_CONFIGURE:
                if item.suggested_work_order_quantity and item.suggested_work_order_quantity > 0:
                    make_count += 1
            elif st == SOURCE_TYPE_OUTSOURCE:
                if item.suggested_work_order_quantity and item.suggested_work_order_quantity > 0:
                    outsource_count += 1
            elif st == SOURCE_TYPE_BUY:
                if item.suggested_purchase_order_quantity and item.suggested_purchase_order_quantity > 0:
                    sc = resolve_computation_item_source_config(item.material_source_config)
                    supplier_id = sc.get("default_supplier_id")
                    if supplier_id:
                        purchase_items_with_supplier += 1
                    else:
                        purchase_items_without_supplier += 1

        has_production_items = make_count > 0
        has_outsource_items = outsource_count > 0
        has_purchase_items = purchase_items_with_supplier > 0 or purchase_items_without_supplier > 0

        biz_config = BusinessConfigService()
        can_direct_wo = await biz_config.can_direct_generate_work_order_from_computation(tenant_id)

        default_purchase = "requisition" if purchase_items_without_supplier > 0 else "purchase_order"

        production_choices = []
        if has_production_items or has_outsource_items:
            production_choices = ["work_order"]

        purchase_choices = []
        if has_purchase_items:
            purchase_choices = ["requisition", "purchase_order"]

        return {
            "computation_id": computation_id,
            "has_production_items": has_production_items,
            "has_outsource_items": has_outsource_items,
            "has_purchase_items": has_purchase_items,
            "make_count": make_count,
            "outsource_count": outsource_count,
            "purchase_items_with_supplier": purchase_items_with_supplier,
            "purchase_items_without_supplier": purchase_items_without_supplier,
            "can_direct_work_order": can_direct_wo,
            "default_production": "work_order",
            "default_purchase": default_purchase,
            "production_choices": production_choices,
            "purchase_choices": purchase_choices,
        }

    async def preview_push_to_purchase_requisition(
        self,
        tenant_id: int,
        computation_id: int,
    ) -> Dict[str, Any]:
        """下推采购申请预览：返回将纳入采购申请的采购件明细，不实际创建。"""
        from apps.master_data.models.material import Material

        computation = await DemandComputation.get_or_none(tenant_id=tenant_id, id=computation_id)
        if not computation:
            raise NotFoundError(f"需求计算不存在: {computation_id}")
        if computation.computation_status != "完成":
            raise BusinessLogicError("只能下推已完成的需求计算")

        exclusions = await self._get_already_pushed_exclusions(tenant_id, computation_id)
        has_existing_pr = exclusions["has_purchase_requisition"]

        items = await DemandComputationItem.filter(
            tenant_id=tenant_id,
            computation_id=computation_id,
            material_source_type=SOURCE_TYPE_BUY,
        ).all()
        buy_items = [
            i
            for i in items
            if i.suggested_purchase_order_quantity and i.suggested_purchase_order_quantity > 0
        ]
        remaining_by_material = self._get_purchase_remaining_qty_by_material(items, exclusions)
        suggested_by_material = self._aggregate_buy_suggested_qty_by_material(items)

        material_ids = sorted({int(i.material_id) for i in buy_items if i.material_id is not None})
        material_rows = (
            await Material.filter(tenant_id=tenant_id, id__in=material_ids).all()
            if material_ids
            else []
        )
        material_by_id = {m.id: m for m in material_rows}

        preview_items: List[Dict[str, Any]] = []
        seen_material_ids: set = set()
        for item in buy_items:
            if item.material_id is None or item.material_id in seen_material_ids:
                continue
            seen_material_ids.add(item.material_id)
            mid = int(item.material_id)
            suggested = suggested_by_material.get(mid, 0.0)
            if suggested <= 0:
                continue
            pushed_qty = self._purchase_pushed_qty_for_material(mid, suggested, exclusions)
            remaining = 0.0 if has_existing_pr else remaining_by_material.get(mid, 0.0)
            if has_existing_pr:
                pushed_qty = suggested

            material = material_by_id.get(mid)
            material_code = str(item.material_code or "").strip()
            material_name = str(item.material_name or "").strip()
            if material:
                if not material_code:
                    material_code = str(
                        getattr(material, "main_code", None)
                        or getattr(material, "code", None)
                        or ""
                    ).strip()
                if not material_name:
                    material_name = str(getattr(material, "name", "") or "").strip()
            preview_items.append(
                {
                    "item_id": int(item.id),
                    "material_id": item.material_id,
                    "material_code": material_code or f"M{item.material_id}",
                    "material_name": material_name or material_code or f"物料{item.material_id}",
                    "quantity": suggested,
                    "pushed_quantity": pushed_qty,
                    "max_push_quantity": remaining,
                    "required_date": str(item.procurement_completion_date)
                    if item.procurement_completion_date
                    else None,
                }
            )

        no_purchase_items = len(preview_items) == 0
        pushable_count = sum(
            1 for row in preview_items if float(row.get("max_push_quantity") or 0) > 0
        )
        has_blocking = has_existing_pr or pushable_count == 0
        blocking_reason = None
        if has_existing_pr:
            blocking_reason = "demand_computation.push_purchase_requisition.already_pushed"
        elif no_purchase_items or pushable_count == 0:
            blocking_reason = "demand_computation.push_purchase_requisition.no_purchase_items"

        return {
            "target_type": "purchase_requisition",
            "computation_id": computation_id,
            "computation_code": computation.computation_code,
            "summary": (
                f"将生成采购申请，共 {pushable_count} 条采购件明细"
                if not has_blocking
                else (
                    "该需求计算已下推采购申请且仍存在，请勿重复下推"
                    if has_existing_pr
                    else "需求计算中无剩余可下推采购件，无法下推采购申请"
                )
            ),
            "items": preview_items,
            "has_blocking_issues": has_blocking,
            "blocking_reason": blocking_reason,
            "tip": "确认后将按可下推数量生成采购申请；已通过采购订单下推的物料不会重复纳入。",
        }

    async def _build_work_order_pull_preview_items(
        self,
        tenant_id: int,
        computation: DemandComputation,
        items: List[DemandComputationItem],
        *,
        generate_mode: str = "work_order_only",
    ) -> List[Dict[str, Any]]:
        """按与 generate_orders 一致的规则构建工单加载预览明细（数量三列）。"""
        from apps.kuaizhizao.services.work_order_group_service import WorkOrderGroupService
        from apps.kuaizhizao.utils.work_order_group_bom_tree import (
            flatten_production_tree,
            allocate_suggested_quantity,
            quantize_qty,
        )

        preview_items: List[Dict[str, Any]] = []

        def _append_row(
            *,
            material_id: int,
            material_code: str,
            material_name: str,
            quantity: float,
            pushed: bool,
            source_type: Optional[str],
            target_document: str,
        ) -> None:
            if quantity <= 0:
                return
            preview_items.append(
                {
                    "item_id": material_id,
                    "material_id": material_id,
                    "material_code": material_code or f"M{material_id}",
                    "material_name": material_name or material_code or f"物料{material_id}",
                    "quantity": quantity,
                    "pushed_quantity": quantity if pushed else 0.0,
                    "max_push_quantity": 0.0 if pushed else quantity,
                    "source_type": source_type,
                    "target_document": target_document,
                }
            )

        group_svc = WorkOrderGroupService()
        use_group_by_demand_item = False
        if generate_mode in ("all", "work_order_only", "outsource_only"):
            use_group_by_demand_item = await group_svc.should_group_by_demand_item(tenant_id)

        if use_group_by_demand_item:
            already_pushed_keys = await group_svc.collect_pushed_keys(tenant_id, computation.id)
            item_by_material = {i.material_id: i for i in items}
            trees = computation.demand_item_bom_trees or []
            for tree in trees:
                demand_item_id = tree.get("demand_item_id")
                if demand_item_id is None:
                    continue
                nodes = flatten_production_tree(tree)
                wo_nodes = [
                    n
                    for n in nodes
                    if n.get("source_type")
                    in (SOURCE_TYPE_MAKE, SOURCE_TYPE_CONFIGURE, SOURCE_TYPE_OUTSOURCE)
                    and float(n.get("required_quantity") or 0) > 0
                ]
                for node in wo_nodes:
                    st = node.get("source_type")
                    if generate_mode == "outsource_only" and st != SOURCE_TYPE_OUTSOURCE:
                        continue
                    mid = int(node["material_id"])
                    comp_item = item_by_material.get(mid)
                    if not comp_item:
                        continue
                    total_gross = float(comp_item.gross_requirement or comp_item.required_quantity or 0)
                    total_suggested = float(comp_item.suggested_work_order_quantity or 0)
                    qty = float(
                        quantize_qty(
                            allocate_suggested_quantity(
                                float(node.get("required_quantity") or 0),
                                total_gross,
                                total_suggested,
                            )
                        )
                    )
                    if qty <= 0:
                        continue
                    pushed = (int(demand_item_id), mid) in already_pushed_keys or (
                        None,
                        mid,
                    ) in already_pushed_keys
                    target = (
                        "outsource_work_order"
                        if st == SOURCE_TYPE_OUTSOURCE
                        else "work_order"
                    )
                    _append_row(
                        material_id=mid,
                        material_code=str(node.get("material_code") or comp_item.material_code or ""),
                        material_name=str(node.get("material_name") or comp_item.material_name or ""),
                        quantity=qty,
                        pushed=pushed,
                        source_type=st,
                        target_document=target,
                    )
            return preview_items

        exclusions = await self._get_already_pushed_exclusions(tenant_id, computation.id)
        already_pushed_materials = exclusions["wo_material_ids"] | exclusions["outsource_material_ids"]
        seen_keys: set = set()

        def _aggregate_qty(group: List[DemandComputationItem]) -> float:
            return sum(float(g.suggested_work_order_quantity or 0) for g in group)

        for item in items:
            source_type = item.material_source_type
            if source_type == SOURCE_TYPE_PHANTOM:
                continue
            if generate_mode == "purchase_only" and source_type in (
                SOURCE_TYPE_MAKE,
                SOURCE_TYPE_OUTSOURCE,
                SOURCE_TYPE_CONFIGURE,
            ):
                continue
            if generate_mode == "work_order_only" and source_type == SOURCE_TYPE_BUY:
                continue
            if generate_mode == "outsource_only" and source_type != SOURCE_TYPE_OUTSOURCE:
                continue

            if source_type == SOURCE_TYPE_MAKE:
                key = (item.material_id, SOURCE_TYPE_MAKE)
                if key in seen_keys or item.material_id in already_pushed_materials:
                    continue
                group = [
                    i
                    for i in items
                    if i.material_id == item.material_id
                    and i.material_source_type == SOURCE_TYPE_MAKE
                    and float(i.suggested_work_order_quantity or 0) > 0
                ]
                qty = _aggregate_qty(group)
                seen_keys.add(key)
                _append_row(
                    material_id=int(item.material_id),
                    material_code=str(item.material_code or ""),
                    material_name=str(item.material_name or ""),
                    quantity=qty,
                    pushed=item.material_id in already_pushed_materials,
                    source_type=SOURCE_TYPE_MAKE,
                    target_document="work_order",
                )
            elif source_type == SOURCE_TYPE_OUTSOURCE:
                key = (item.material_id, SOURCE_TYPE_OUTSOURCE)
                if key in seen_keys or item.material_id in already_pushed_materials:
                    continue
                group = [
                    i
                    for i in items
                    if i.material_id == item.material_id
                    and i.material_source_type == SOURCE_TYPE_OUTSOURCE
                    and float(i.suggested_work_order_quantity or 0) > 0
                ]
                qty = _aggregate_qty(group)
                seen_keys.add(key)
                _append_row(
                    material_id=int(item.material_id),
                    material_code=str(item.material_code or ""),
                    material_name=str(item.material_name or ""),
                    quantity=qty,
                    pushed=item.material_id in already_pushed_materials,
                    source_type=SOURCE_TYPE_OUTSOURCE,
                    target_document="outsource_work_order",
                )
            elif source_type == SOURCE_TYPE_CONFIGURE:
                key = (item.material_id, SOURCE_TYPE_CONFIGURE)
                if key in seen_keys or item.material_id in already_pushed_materials:
                    continue
                group = [
                    i
                    for i in items
                    if i.material_id == item.material_id
                    and i.material_source_type == SOURCE_TYPE_CONFIGURE
                    and float(i.suggested_work_order_quantity or 0) > 0
                ]
                qty = _aggregate_qty(group)
                seen_keys.add(key)
                _append_row(
                    material_id=int(item.material_id),
                    material_code=str(item.material_code or ""),
                    material_name=str(item.material_name or ""),
                    quantity=qty,
                    pushed=item.material_id in already_pushed_materials,
                    source_type=SOURCE_TYPE_CONFIGURE,
                    target_document="work_order",
                )
            elif not source_type and item.suggested_work_order_quantity and item.suggested_work_order_quantity > 0:
                key = (item.material_id, "legacy")
                if key in seen_keys or item.material_id in already_pushed_materials:
                    continue
                group = [
                    i
                    for i in items
                    if not i.material_source_type
                    and i.material_id == item.material_id
                    and float(i.suggested_work_order_quantity or 0) > 0
                ]
                qty = _aggregate_qty(group)
                seen_keys.add(key)
                _append_row(
                    material_id=int(item.material_id),
                    material_code=str(item.material_code or ""),
                    material_name=str(item.material_name or ""),
                    quantity=qty,
                    pushed=item.material_id in already_pushed_materials,
                    source_type=None,
                    target_document="work_order",
                )

        return preview_items

    async def _build_purchase_order_pull_preview_items(
        self,
        tenant_id: int,
        computation_id: int,
        items: List[DemandComputationItem],
        push_mode: str = "draft",
    ) -> tuple[List[Dict[str, Any]], str, str, bool, Optional[str]]:
        """按与 generate_orders(purchase_only) 一致规则构建采购订单下推预览明细。"""
        from apps.master_data.models.material import Material

        push_as_confirm = push_mode == "confirm"
        exclusions = await self._get_already_pushed_exclusions(tenant_id, computation_id)
        remaining_by_material = self._get_purchase_remaining_qty_by_material(items, exclusions)
        suggested_by_material = self._aggregate_buy_suggested_qty_by_material(items)

        material_ids = sorted(
            int(mid) for mid, qty in suggested_by_material.items() if qty > 0
        )
        material_rows = (
            await Material.filter(tenant_id=tenant_id, id__in=material_ids).all()
            if material_ids
            else []
        )
        material_by_id = {m.id: m for m in material_rows}

        preview_items: List[Dict[str, Any]] = []
        skipped_without_supplier = 0
        seen_material_ids: set = set()
        for item in items:
            if item.material_source_type != SOURCE_TYPE_BUY:
                continue
            if item.material_id is None or item.material_id in seen_material_ids:
                continue
            seen_material_ids.add(item.material_id)
            mid = int(item.material_id)
            suggested = suggested_by_material.get(mid, 0.0)
            if suggested <= 0:
                continue
            remaining = remaining_by_material.get(mid, 0.0)
            pushed_qty = self._purchase_pushed_qty_for_material(mid, suggested, exclusions)
            sc = resolve_computation_item_source_config(item.material_source_config)
            supplier_id = sc.get("default_supplier_id")
            if push_as_confirm and not supplier_id and remaining > 0:
                skipped_without_supplier += 1
            material = material_by_id.get(mid)
            material_code = str(item.material_code or "").strip()
            material_name = str(item.material_name or "").strip()
            if material:
                if not material_code:
                    material_code = str(
                        getattr(material, "main_code", None)
                        or getattr(material, "code", None)
                        or ""
                    ).strip()
                if not material_name:
                    material_name = str(getattr(material, "name", "") or "").strip()
            preview_items.append(
                {
                    "item_id": int(item.id),
                    "material_id": item.material_id,
                    "material_code": material_code or f"M{item.material_id}",
                    "material_name": material_name or material_code or f"物料{item.material_id}",
                    "quantity": suggested,
                    "pushed_quantity": pushed_qty,
                    "max_push_quantity": remaining,
                    "target_document": "purchase_order",
                    "default_supplier_id": supplier_id,
                    "supplier_pending": not bool(supplier_id),
                }
            )

        pushable_count = sum(
            1 for row in preview_items if float(row.get("max_push_quantity") or 0) > 0
        )
        pending_supplier_count = sum(1 for row in preview_items if row.get("supplier_pending"))
        has_blocking = pushable_count == 0
        blocking_reason = (
            "demand_computation.push_purchase_order.no_purchase_items" if has_blocking else None
        )
        if has_blocking:
            if push_as_confirm:
                summary = "无已配置默认供应商且未下推的采购件，无法下推采购订单"
            else:
                summary = "无未下推的采购件，无法下推采购订单"
            tip = (
                "正式下推须先为采购件配置默认供应商。"
                if push_as_confirm
                else "请确认需求计算结果中存在可下推的采购件。"
            )
        elif push_as_confirm:
            summary = (
                f"将按供应商生成采购订单，共 {pushable_count} 条已配置供应商的采购件明细"
            )
            if skipped_without_supplier > 0:
                tip = (
                    f"另有 {skipped_without_supplier} 条采购件未配置默认供应商，"
                    "正式下推将跳过；可改用草稿下推或先维护默认供应商。"
                )
            else:
                tip = "确认后将按默认供应商分组生成采购订单并自动提交。"
        elif pending_supplier_count > 0:
            summary = (
                f"将生成采购订单草稿，共 {pushable_count} 条采购件明细"
                f"（{pending_supplier_count} 条待指定供应商）"
            )
            tip = "草稿下推允许未配置默认供应商，生成后可在采购单中补充供应商再提交。"
        else:
            summary = f"将按供应商生成采购订单草稿，共 {pushable_count} 条采购件明细"
            tip = "确认后将按默认供应商分组生成采购订单草稿。"
        return preview_items, summary, tip, has_blocking, blocking_reason

    async def get_push_preview(
        self,
        tenant_id: int,
        computation_id: int,
        push_config: Optional[Dict[str, Any]] = None,
        generate_mode: Optional[str] = None,
        push_mode: Optional[str] = None,
    ) -> Dict[str, Any]:
        """
        获取下推预览（不实际执行），用于下推前展示将生成的单据数量。
        push_config: { "production": "work_order", "purchase": "requisition"|"purchase_order" }
        push_mode: draft=草稿下推，confirm=正式下推；缺省为 draft
        """
        computation = await DemandComputation.get_or_none(tenant_id=tenant_id, id=computation_id)
        if not computation:
            raise NotFoundError(f"需求计算不存在: {computation_id}")
        if computation.computation_status != "完成":
            raise BusinessLogicError("只能对已完成的计算进行下推")

        resolved_push_mode = str(push_mode or "").strip().lower()
        if resolved_push_mode not in ("draft", "confirm"):
            resolved_push_mode = "draft"

        items = await DemandComputationItem.filter(
            tenant_id=tenant_id,
            computation_id=computation_id
        ).all()

        production = (push_config or {}).get("production")
        purchase = (push_config or {}).get("purchase")
        outsource_only = (push_config or {}).get("outsource_only") is True

        work_order_count = 0
        outsource_work_order_count = 0
        purchase_requisition_count = 0
        purchase_order_count = 0
        validation_failures = []

        make_count = 0
        outsource_count = 0
        purchase_items_with_supplier = 0
        purchase_items_without_supplier = 0

        for item in items:
            st = item.material_source_type
            if st == SOURCE_TYPE_PHANTOM:
                continue
            if st in (SOURCE_TYPE_MAKE, SOURCE_TYPE_CONFIGURE):
                if item.suggested_work_order_quantity and item.suggested_work_order_quantity > 0:
                    make_count += 1
            elif st == SOURCE_TYPE_OUTSOURCE:
                if item.suggested_work_order_quantity and item.suggested_work_order_quantity > 0:
                    outsource_count += 1
                    validation_passed, errors = await validate_material_source_config(
                        tenant_id=tenant_id,
                        material_id=item.material_id,
                        source_type=SOURCE_TYPE_OUTSOURCE
                    )
                    if not validation_passed:
                        validation_failures.append({
                            "material_code": item.material_code,
                            "material_name": item.material_name,
                            "errors": errors,
                        })
            elif st == SOURCE_TYPE_BUY:
                if item.suggested_purchase_order_quantity and item.suggested_purchase_order_quantity > 0:
                    sc = resolve_computation_item_source_config(item.material_source_config)
                    if sc.get("default_supplier_id"):
                        purchase_items_with_supplier += 1
                    else:
                        purchase_items_without_supplier += 1

        if outsource_only:
            outsource_work_order_count = outsource_count
        elif production == "work_order":
            work_order_count = make_count
            outsource_work_order_count = outsource_count

        if purchase == "requisition" and (purchase_items_with_supplier > 0 or purchase_items_without_supplier > 0):
            purchase_requisition_count = 1
        elif purchase == "purchase_order":
            exclusions = await self._get_already_pushed_exclusions(tenant_id, computation_id)
            remaining_by_material = self._get_purchase_remaining_qty_by_material(items, exclusions)
            supplier_ids = set()
            has_no_supplier_group = False
            for item in items:
                if item.material_source_type != SOURCE_TYPE_BUY:
                    continue
                if item.material_id is None:
                    continue
                remaining = remaining_by_material.get(int(item.material_id), 0.0)
                if remaining <= 0:
                    continue
                if not item.suggested_purchase_order_quantity or float(item.suggested_purchase_order_quantity) <= 0:
                    continue
                sc = resolve_computation_item_source_config(item.material_source_config)
                sid = sc.get("default_supplier_id")
                if sid:
                    supplier_ids.add(sid)
                elif resolved_push_mode != "confirm":
                    has_no_supplier_group = True
            purchase_order_count = len(supplier_ids) + (1 if has_no_supplier_group else 0)

        biz_config = BusinessConfigService()
        can_direct_wo = await biz_config.can_direct_generate_work_order_from_computation(tenant_id)

        preview_items: List[Dict[str, Any]] = []
        preview_summary_parts: List[str] = []
        preview_tip_parts: List[str] = []
        blocking_reasons: List[str] = []

        if production == "work_order" and not outsource_only:
            mode = generate_mode or "work_order_only"
            wo_items = await self._build_work_order_pull_preview_items(
                tenant_id,
                computation,
                items,
                generate_mode=mode,
            )
            preview_items.extend(wo_items)
            pushable_count = sum(
                1 for row in wo_items if float(row.get("max_push_quantity") or 0) > 0
            )
            preview_summary_parts.append(
                f"需求计算 {computation.computation_code}：{pushable_count}/{len(wo_items)} 条可下推生成工单"
                if wo_items
                else f"需求计算 {computation.computation_code} 中无生产件可生成工单"
            )
            preview_tip_parts.append("确认后将按可下推数量生成生产工单/委外工单。")
            if not pushable_count:
                blocking_reasons.append(
                    "demand_computation.push_work_order.no_pushable_items"
                    if wo_items
                    else "demand_computation.push_work_order.no_production_items"
                )

        if purchase == "requisition":
            pr_preview = await self.preview_push_to_purchase_requisition(tenant_id, computation_id)
            for row in pr_preview.get("items") or []:
                preview_items.append({**row, "target_document": "purchase_requisition"})
            if pr_preview.get("summary"):
                preview_summary_parts.append(str(pr_preview["summary"]))
            if pr_preview.get("tip"):
                preview_tip_parts.append(str(pr_preview["tip"]))
            if pr_preview.get("has_blocking_issues") and pr_preview.get("blocking_reason"):
                blocking_reasons.append(str(pr_preview["blocking_reason"]))

        elif purchase == "purchase_order":
            po_items, po_summary, po_tip, po_blocking, po_reason = (
                await self._build_purchase_order_pull_preview_items(
                    tenant_id,
                    computation_id,
                    items,
                    push_mode=resolved_push_mode,
                )
            )
            preview_items.extend(po_items)
            preview_summary_parts.append(po_summary)
            preview_tip_parts.append(po_tip)
            if po_blocking and po_reason:
                blocking_reasons.append(po_reason)

        preview_summary = "；".join(preview_summary_parts) if preview_summary_parts else None
        preview_tip = " ".join(preview_tip_parts) if preview_tip_parts else None
        pushable_count = sum(
            1 for row in preview_items if float(row.get("max_push_quantity") or 0) > 0
        )
        has_blocking_issues = pushable_count == 0 and bool(production or purchase)
        blocking_reason = blocking_reasons[0] if has_blocking_issues and blocking_reasons else None

        return {
            "computation_id": computation_id,
            "computation_code": computation.computation_code,
            "work_order_count": work_order_count,
            "outsource_work_order_count": outsource_work_order_count,
            "purchase_requisition_count": purchase_requisition_count,
            "purchase_order_count": purchase_order_count,
            "validation_failures": validation_failures,
            "can_direct_work_order": can_direct_wo,
            "make_count": make_count,
            "outsource_count": outsource_count,
            "purchase_items_with_supplier": purchase_items_with_supplier,
            "purchase_items_without_supplier": purchase_items_without_supplier,
            "items": preview_items,
            "summary": preview_summary,
            "tip": preview_tip,
            "has_blocking_issues": has_blocking_issues,
            "blocking_reason": blocking_reason,
        }

    async def push_all(
        self,
        tenant_id: int,
        computation_id: int,
        created_by: int,
        production: Optional[str] = None,
        purchase: Optional[str] = None,
        include_outsource: bool = True,
        push_mode: Optional[str] = None,
    ) -> Dict[str, Any]:
        """
        一键下推：按配置执行工单、采购申请/采购单、委外工单。
        production: "work_order"|null
        purchase: "requisition"|"purchase_order"|null
        include_outsource: 委外工单是否包含（工单模式会生成委外工单）
        """
        computation = await DemandComputation.get_or_none(tenant_id=tenant_id, id=computation_id)
        if not computation:
            raise NotFoundError(f"需求计算不存在: {computation_id}")
        if computation.computation_status != "完成":
            raise BusinessLogicError("只能对已完成的计算进行下推")

        resolved_push_mode = str(push_mode or "").strip().lower()
        if resolved_push_mode not in ("draft", "confirm"):
            resolved_push_mode = await BusinessConfigService().get_push_default_mode(tenant_id)

        results = {
            "work_orders": [],
            "outsource_work_orders": [],
            "purchase_requisition": None,
            "purchase_orders": [],
        }

        if production is not None and production != "work_order":
            raise BusinessLogicError("仅支持「直接生成工单」生产路径")

        if production == "work_order":
            r = await self.generate_work_orders_and_purchase_orders(
                tenant_id=tenant_id,
                computation_id=computation_id,
                created_by=created_by,
                generate_mode="work_order_only",
                push_mode=resolved_push_mode,
            )
            results["work_orders"] = r.get("work_orders", [])
            results["outsource_work_orders"] = r.get("outsource_work_orders", [])

        if purchase == "requisition":
            exclusions = await self._get_already_pushed_exclusions(tenant_id, computation_id)
            if not exclusions["has_purchase_requisition"]:
                from apps.kuaizhizao.services.document_push_pull_service import DocumentPushPullService

                push_service = DocumentPushPullService()
                try:
                    r = await push_service.push_document(
                        tenant_id=tenant_id,
                        source_type="demand_computation",
                        source_id=computation_id,
                        target_type="purchase_requisition",
                        push_params=None,
                        created_by=created_by,
                    )
                    results["purchase_requisition"] = r.get("target_document")
                except BusinessLogicError as e:
                    msg = str(e)
                    if "无采购件" in msg:
                        pass
                    else:
                        wo_done = bool(
                            results.get("work_orders") or results.get("outsource_work_orders")
                        )
                        if wo_done:
                            raise BusinessLogicError(
                                f"工单/委外已下推成功，但采购申请失败：{msg}"
                            ) from e
                        raise

        elif purchase == "purchase_order":
            r = await self.generate_work_orders_and_purchase_orders(
                tenant_id=tenant_id,
                computation_id=computation_id,
                created_by=created_by,
                generate_mode="purchase_only",
                push_mode=resolved_push_mode,
            )
            results["purchase_orders"] = r.get("purchase_orders", [])

        return {
            "success": True,
            "message": "一键下推完成",
            "push_mode": resolved_push_mode,
            "results": results,
        }

    async def _create_work_order_from_item(
        self,
        tenant_id: int,
        computation: DemandComputation,
        item: DemandComputationItem,
        created_by: int,
        is_outsource: bool = False,
        allow_draft: bool = False
    ) -> Dict[str, Any]:
        """
        从计算结果明细创建工单
        
        Args:
            tenant_id: 租户ID
            computation: 计算对象
            item: 计算结果明细
            created_by: 创建人ID
            
        Returns:
            Dict: 创建的工单信息
        """
        try:
            from apps.kuaizhizao.services.work_order_service import WorkOrderService
            from apps.kuaizhizao.schemas.work_order import WorkOrderCreate
            from datetime import datetime, timedelta
            
            work_order_service = WorkOrderService()
            
            # 确定生产模式
            production_mode = (
                "MTO" if computation.business_mode in ("MTO", "ATO") else "MTS"
            )
            
            # MTO 时解析销售订单ID：工单表外键指向 sales_orders，需用需求的 source_id（销售订单ID），而非 demand_id（需求ID）
            sales_order_id = None
            sales_order_code = None
            sales_order_name = None
            if production_mode == "MTO":
                demand = await Demand.get_or_none(tenant_id=tenant_id, id=computation.demand_id)
                if demand and getattr(demand, "demand_type", None) == "sales_order" and getattr(demand, "source_type", None) == "sales_order" and getattr(demand, "source_id", None):
                    sales_order_id = demand.source_id
            if sales_order_id:
                from apps.kuaizhizao.models.sales_order import SalesOrder

                so = await SalesOrder.get_or_none(
                    id=sales_order_id, tenant_id=tenant_id, deleted_at__isnull=True
                )
                if so:
                    sales_order_code = so.order_code
                    sales_order_name = (
                        f"{so.order_code} - {so.customer_name}" if so.customer_name else so.order_code
                    )

            # 计划时间：倒排保留交期锚点供工序倒推；正排仅传开工，工序正推后写回结束
            schedule_direction = normalize_schedule_direction(
                (computation.computation_params or {}).get("schedule_direction")
            )
            planned_start_date = planning_date_to_work_order_start(item.production_start_date)
            if schedule_direction == "forward":
                planned_end_date = None
            else:
                planned_end_date = planning_date_to_work_order_end(item.production_completion_date)
            
            # 创建工单（物料来源控制增强）
            remarks = f"从需求计算 {computation.computation_code} 自动生成"
            if is_outsource:
                remarks += "（委外工单）"
            
            work_order_data = WorkOrderCreate(
                code_rule="WORK_ORDER_CODE",
                product_id=item.material_id,
                quantity=float(item.suggested_work_order_quantity or 0),
                production_mode=production_mode,
                sales_order_id=sales_order_id,
                sales_order_code=sales_order_code,
                sales_order_name=sales_order_name,
                planned_start_date=planned_start_date,
                planned_end_date=planned_end_date,
                remarks=remarks,
            )
            
            work_order = await work_order_service.create_work_order(
                tenant_id=tenant_id,
                work_order_data=work_order_data,
                created_by=created_by,
                allow_draft=allow_draft,
            )
            # #region agent log
            try:
                with open(r"f:\dev\riveredge\.cursor\debug.log", "a", encoding="utf-8") as _f:
                    _f.write(__import__("json").dumps({"location": "demand_computation_service.py:_create_work_order", "message": "work_order_created", "data": {"id": work_order.id, "code": work_order.code, "material_code": item.material_code}, "hypothesisId": "C,E"}) + "\n")
            except Exception:
                pass
            # #endregion
            return {
                "id": work_order.id,
                "code": work_order.code,
                "product_code": item.material_code,
                "product_name": item.material_name,
                "quantity": float(item.suggested_work_order_quantity or 0),
            }
        except Exception as e:
            logger.error(f"创建工单失败: {e}")
            raise BusinessLogicError(f"创建工单失败: {str(e)}")
    
    async def _get_or_create_placeholder_supplier(self, tenant_id: int):
        """获取或创建占位供应商「待指定」，用于 allow_draft 时委外工单无供应商的场景"""
        from apps.master_data.models.supplier import Supplier
        code = "TBD"
        supplier = await Supplier.filter(
            tenant_id=tenant_id,
            code=code,
            deleted_at__isnull=True
        ).first()
        if supplier:
            return supplier
        supplier = await Supplier.create(
            tenant_id=tenant_id,
            code=code,
            name="待指定",
        )
        return supplier

    async def _create_outsource_work_order_from_item(
        self,
        tenant_id: int,
        computation: DemandComputation,
        item: DemandComputationItem,
        created_by: int,
        allow_draft: bool = False
    ) -> Dict[str, Any]:
        """
        从计算结果明细创建委外工单（OutsourceWorkOrder）
        
        委外件必须配置 outsource_supplier_id 和 outsource_operation。
        
        Args:
            tenant_id: 租户ID
            computation: 计算对象
            item: 计算结果明细（物料来源类型为 Outsource）
            created_by: 创建人ID
            
        Returns:
            Dict: 创建的委外工单信息
        """
        try:
            from apps.kuaizhizao.services.outsource_work_order_service import OutsourceWorkOrderService
            from apps.kuaizhizao.schemas.outsource_work_order import OutsourceWorkOrderCreate
            from apps.master_data.models.supplier import Supplier
            
            # 从物料来源配置获取委外供应商信息（get_material_source_config 返回的结构）
            mc = resolve_computation_item_source_config(item.material_source_config)
            outsource_supplier_id = mc.get("outsource_supplier_id")
            outsource_operation = mc.get("outsource_operation", "")
            used_placeholder_supplier = False

            # allow_draft 时允许无供应商，使用占位供应商
            if not outsource_supplier_id:
                if not allow_draft:
                    raise BusinessLogicError(
                        f"委外件 {item.material_code} ({item.material_name}) 未配置委外供应商，"
                        "请在物料主数据中配置 source_config.outsource_supplier_id"
                    )
                # 获取或创建占位供应商「待指定」
                supplier = await self._get_or_create_placeholder_supplier(tenant_id)
                outsource_supplier_id = supplier.id
                used_placeholder_supplier = True

            # 查询供应商信息
            supplier = await Supplier.get_or_none(tenant_id=tenant_id, id=outsource_supplier_id)
            if not supplier:
                if allow_draft:
                    supplier = await self._get_or_create_placeholder_supplier(tenant_id)
                    used_placeholder_supplier = True
                else:
                    raise BusinessLogicError(
                        f"委外供应商 ID {outsource_supplier_id} 不存在，物料: {item.material_code}"
                    )
            
            supplier_code = getattr(supplier, "code", None) or str(outsource_supplier_id)
            supplier_name = getattr(supplier, "name", None) or mc.get("outsource_supplier_name", "待指定")
            
            quantity = float(item.suggested_work_order_quantity or 0)
            unit_price = Decimal(str(mc.get("outsource_price") or 0))
            total_amount = Decimal(str(quantity)) * unit_price
            
            schedule_direction = normalize_schedule_direction(
                (computation.computation_params or {}).get("schedule_direction")
            )
            planned_start_date = None
            planned_end_date = None
            if item.production_start_date:
                planned_start_date = planning_date_to_work_order_start(item.production_start_date)
            if schedule_direction != "forward" and item.production_completion_date:
                planned_end_date = planning_date_to_work_order_end(item.production_completion_date)
            
            work_order_data = OutsourceWorkOrderCreate(
                product_id=item.material_id,
                product_code=item.material_code,
                product_name=item.material_name,
                quantity=Decimal(str(quantity)),
                supplier_id=supplier.id,
                supplier_code=supplier_code,
                supplier_name=supplier_name,
                outsource_operation=outsource_operation or None,
                unit_price=unit_price,
                total_amount=total_amount,
                planned_start_date=planned_start_date,
                planned_end_date=planned_end_date,
                remarks=f"从需求计算 {computation.computation_code} 自动生成",
            )
            
            outsource_service = OutsourceWorkOrderService()
            wo = await outsource_service.create_outsource_work_order(
                tenant_id=tenant_id,
                work_order_data=work_order_data,
                created_by=created_by,
                allow_draft=allow_draft,
            )

            result: Dict[str, Any] = {
                "id": wo.id,
                "code": wo.code,
                "product_code": item.material_code,
                "product_name": item.material_name,
                "quantity": float(quantity),
            }
            if used_placeholder_supplier:
                result["used_placeholder_supplier"] = True
                logger.warning(
                    "需求计算 allow_draft：委外工单 %s 使用占位供应商「待指定」，"
                    "计算单=%s 物料=%s；正式下达前请在主数据维护真实供应商并更新工单。",
                    wo.code,
                    computation.computation_code,
                    item.material_code,
                )
            return result
        except BusinessLogicError:
            raise
        except Exception as e:
            logger.error(f"创建委外工单失败: {e}")
            raise BusinessLogicError(f"创建委外工单失败: {str(e)}")

    @staticmethod
    def _build_fallback_purchase_order_code(
        today: str,
        computation_id: int,
        supplier_id: int,
        existing_count: int,
    ) -> str:
        """编码规则不可用时的补推安全单号（同计算单+供应商分组递增序号）。"""
        return f"PO-{today}-{computation_id}-{int(supplier_id or 0)}-{existing_count + 1}"

    async def _generate_purchase_order_code(
        self,
        tenant_id: int,
        computation_id: int,
        supplier_id: int = 0,
    ) -> str:
        """生成采购单编码，与 purchase_service 一致使用 PURCHASE_ORDER_CODE 规则。"""
        from apps.kuaizhizao.models.purchase_order import PurchaseOrder

        today = today_site_str()
        try:
            return await self.generate_code(
                tenant_id,
                "PURCHASE_ORDER_CODE",
                prefix=f"PO{today}",
            )
        except Exception:
            existing_count = await PurchaseOrder.filter(
                tenant_id=tenant_id,
                source_type="demand_computation",
                source_id=computation_id,
                supplier_id=int(supplier_id or 0),
                deleted_at__isnull=True,
            ).count()
            return self._build_fallback_purchase_order_code(
                today, computation_id, supplier_id, existing_count
            )
    
    async def _create_purchase_order_from_item(
        self,
        tenant_id: int,
        computation: DemandComputation,
        item: DemandComputationItem,
        created_by: int
    ) -> Dict[str, Any]:
        """
        从计算结果明细创建采购单（物料来源控制增强）
        
        根据物料来源类型，自动填充默认供应商和采购价格。
        
        Args:
            tenant_id: 租户ID
            computation: 计算对象
            item: 计算结果明细
            created_by: 创建人ID
            
        Returns:
            Dict: 创建的采购单信息
        """
        try:
            from apps.kuaizhizao.models.purchase_order import PurchaseOrder, PurchaseOrderItem
            from datetime import date, timedelta
            from decimal import Decimal

            # 从物料来源配置获取默认供应商和采购价格（物料来源控制增强）
            supplier_id = None
            supplier_name = "待指定供应商"
            unit_price = Decimal(0)

            if item.material_source_type == "Buy" and item.material_source_config:
                source_config = resolve_computation_item_source_config(item.material_source_config)
                supplier_id = source_config.get("default_supplier_id")
                supplier_name = source_config.get("default_supplier_name", "待指定供应商")
                unit_price = Decimal(str(source_config.get("purchase_price", 0)))

            # 如果没有配置，草稿使用待定供应商占位（supplier_id=0）
            if not supplier_id:
                supplier_id = PURCHASE_ORDER_NO_SUPPLIER_GROUP
                supplier_name = "待定供应商"

            order_code = await self._generate_purchase_order_code(
                tenant_id, computation.id, int(supplier_id or 0)
            )

            # 确定交货日期
            delivery_date = item.procurement_completion_date or item.delivery_date
            if not delivery_date:
                # 从物料来源配置获取采购提前期
                lead_time_days = 7  # 默认7天
                if item.material_source_config:
                    source_config = resolve_computation_item_source_config(item.material_source_config)
                    lead_time_days = source_config.get("purchase_lead_time", 7)
                delivery_date = date.today() + timedelta(days=lead_time_days)
            
            # 创建采购订单（须写 created/updated_by_name，列表「更新时间」列依赖反范式姓名）
            user = await User.get_or_none(id=created_by)
            order_data: Dict[str, Any] = {
                "tenant_id": tenant_id,
                "order_code": order_code,
                "supplier_id": supplier_id,
                "supplier_name": supplier_name,
                "order_date": date.today(),
                "delivery_date": delivery_date,
                "order_type": "标准采购",
                "status": "草稿",
                "source_type": "demand_computation",
                "source_id": computation.id,
                "notes": f"从需求计算 {computation.computation_code} 自动生成",
            }
            apply_create_audit(order_data, user)
            purchase_order = await PurchaseOrder.create(**order_data)
            
            # 计算总价
            quantity = float(item.suggested_purchase_order_quantity or 0)
            total_price = float(unit_price) * quantity
            
            # 创建采购订单行
            item_data: Dict[str, Any] = {
                "tenant_id": tenant_id,
                "order_id": purchase_order.id,
                "material_id": item.material_id,
                "material_code": item.material_code,
                "material_name": item.material_name,
                "material_spec": item.material_spec,
                "ordered_quantity": Decimal(str(quantity)),
                "outstanding_quantity": Decimal(str(quantity)),
                "unit": item.material_unit,
                "unit_price": unit_price,
                "total_price": Decimal(str(total_price)),
                "required_date": delivery_date,
                "inspection_required": True,
                "source_type": "demand_computation",
                "source_id": computation.id,
            }
            apply_create_audit(item_data, user)
            await PurchaseOrderItem.create(**item_data)
            
            return {
                "id": purchase_order.id,
                "order_code": purchase_order.order_code,
                "material_code": item.material_code,
                "material_name": item.material_name,
                "quantity": quantity,
                "supplier_name": supplier_name,
                "unit_price": float(unit_price),
                "total_price": total_price,
            }
        except Exception as e:
            logger.error(f"创建采购单失败: {e}")
            raise BusinessLogicError(f"创建采购单失败: {str(e)}")
    
    async def _create_purchase_order_from_items(
        self,
        tenant_id: int,
        computation: DemandComputation,
        items: List[DemandComputationItem],
        supplier_id: int,
        created_by: int
    ) -> Dict[str, Any]:
        """
        从多个计算结果明细创建采购单（按供应商分组，物料来源控制增强）
        
        根据物料来源类型，自动填充默认供应商和采购价格，支持同一供应商多个物料合并到一个采购单。
        
        Args:
            tenant_id: 租户ID
            computation: 计算对象
            items: 计算结果明细列表（同一供应商的多个物料）
            supplier_id: 供应商ID
            created_by: 创建人ID
            
        Returns:
            Dict: 创建的采购单信息
        """
        try:
            from apps.kuaizhizao.models.purchase_order import PurchaseOrder, PurchaseOrderItem
            from apps.master_data.models import Supplier
            from core.services.business.code_generation_service import CodeGenerationService
            from datetime import datetime, date, timedelta
            from decimal import Decimal
            
            # 验证供应商（supplier_id<=0 为草稿待定供应商，不查主数据）
            supplier_name = "待定供应商"
            if int(supplier_id or 0) > 0:
                supplier = await Supplier.get_or_none(tenant_id=tenant_id, id=supplier_id)
                if not supplier:
                    if items and items[0].material_source_config:
                        source_config = resolve_computation_item_source_config(
                            items[0].material_source_config
                        )
                        supplier_name = source_config.get(
                            "default_supplier_name", "待定供应商"
                        )
                    else:
                        supplier_name = "待定供应商"
                else:
                    supplier_name = supplier.name
            
            order_code = await self._generate_purchase_order_code(
                tenant_id, computation.id, int(supplier_id or 0)
            )

            # 确定交货日期（取所有物料中最早的日期）
            delivery_date = None
            for item in items:
                item_delivery_date = item.procurement_completion_date or item.delivery_date
                if item_delivery_date:
                    if not delivery_date or item_delivery_date < delivery_date:
                        delivery_date = item_delivery_date
            
            if not delivery_date:
                # 从物料来源配置获取采购提前期
                lead_time_days = 7  # 默认7天
                if items and items[0].material_source_config:
                    source_config = resolve_computation_item_source_config(items[0].material_source_config)
                    lead_time_days = source_config.get("purchase_lead_time", 7)
                delivery_date = date.today() + timedelta(days=lead_time_days)
            
            # 创建采购订单（须写 created/updated_by_name，列表「更新时间」列依赖反范式姓名）
            user = await User.get_or_none(id=created_by)
            order_data: Dict[str, Any] = {
                "tenant_id": tenant_id,
                "order_code": order_code,
                "supplier_id": int(supplier_id or 0),
                "supplier_name": supplier_name,
                "order_date": date.today(),
                "delivery_date": delivery_date,
                "order_type": "标准采购",
                "status": "草稿",
                "source_type": "demand_computation",
                "source_id": computation.id,
                "notes": f"从需求计算 {computation.computation_code} 自动生成（按供应商分组）",
            }
            apply_create_audit(order_data, user)
            purchase_order = await PurchaseOrder.create(**order_data)
            
            # 创建采购订单明细并计算总金额
            total_quantity = Decimal(0)
            total_amount = Decimal(0)
            
            for item in items:
                # 从物料来源配置获取采购价格（物料来源控制增强）
                unit_price = Decimal(0)
                if item.material_source_type == "Buy" and item.material_source_config:
                    source_config = resolve_computation_item_source_config(item.material_source_config)
                    unit_price = Decimal(str(source_config.get("purchase_price", 0)))
                
                # 计算数量和总价
                quantity = Decimal(str(item.suggested_purchase_order_quantity or 0))
                total_price = unit_price * quantity
                
                # 创建采购订单行
                item_data: Dict[str, Any] = {
                    "tenant_id": tenant_id,
                    "order_id": purchase_order.id,
                    "material_id": item.material_id,
                    "material_code": item.material_code,
                    "material_name": item.material_name,
                    "material_spec": item.material_spec,
                    "ordered_quantity": quantity,
                    "outstanding_quantity": quantity,
                    "unit": item.material_unit,
                    "unit_price": unit_price,
                    "total_price": total_price,
                    "required_date": delivery_date,
                    "inspection_required": True,
                    "source_type": "demand_computation",
                    "source_id": computation.id,
                }
                apply_create_audit(item_data, user)
                await PurchaseOrderItem.create(**item_data)
                
                total_quantity += quantity
                total_amount += total_price
            
            # 更新订单头金额信息
            amount_update: Dict[str, Any] = {
                "total_quantity": total_quantity,
                "total_amount": total_amount,
                "tax_amount": Decimal(0),  # 默认税率为0
                "net_amount": total_amount,
            }
            apply_update_audit(amount_update, user)
            await purchase_order.update_from_dict(amount_update).save()
            
            return {
                "id": purchase_order.id,
                "order_code": purchase_order.order_code,
                "supplier_id": supplier_id,
                "supplier_name": supplier_name,
                "items_count": len(items),
                "total_quantity": float(total_quantity),
                "total_amount": float(total_amount),
            }
        except Exception as e:
            logger.error(f"创建采购单失败: {e}")
            raise BusinessLogicError(f"创建采购单失败: {str(e)}")