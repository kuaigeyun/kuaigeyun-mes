"""
统一需求计算服务模块

提供统一需求计算相关的业务逻辑处理，合并MRP和LRP运算逻辑。

根据《☆ 用户使用全场景推演.md》的设计理念，将MRP和LRP合并为统一的需求计算模型。

Author: Luigi Lu
Date: 2025-01-14
"""

import asyncio
from typing import List, Optional, Dict, Any
from datetime import datetime, timedelta, date, timezone
from decimal import Decimal, ROUND_CEILING
from tortoise.transactions import in_transaction
from loguru import logger

from apps.kuaizhizao.constants import DemandStatus, ReviewStatus
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
    SOURCE_TYPE_MAKE,
    SOURCE_TYPE_BUY,
    SOURCE_TYPE_PHANTOM,
    SOURCE_TYPE_OUTSOURCE,
    SOURCE_TYPE_CONFIGURE,
)
from apps.kuaizhizao.utils.inventory_helper import (
    get_material_inventory_info,
    batch_sum_open_supply_quantities,
)
from core.services.business.code_generation_service import CodeGenerationService
from infra.exceptions.exceptions import NotFoundError, ValidationError, BusinessLogicError
from infra.services.business_config_service import BusinessConfigService
from core.timezone_utils import make_aware, now_utc


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
        return d.isoformat()
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


async def _get_material_safety_reorder(
    material: Any,
    computation_params: Dict[str, Any],
) -> tuple[float, float]:
    """
    从物料主数据与本次计算的 computation_params 获取安全库存、再订货点。
    优先级：computation_params > material.defaults > 0
    """
    safety = 0.0
    reorder = 0.0

    if material.defaults:
        inv = material.defaults.get("inventory") or material.defaults
        if isinstance(inv, dict):
            if inv.get("safety_stock") is not None or inv.get("safety_stock_level") is not None:
                safety = float(inv.get("safety_stock") or inv.get("safety_stock_level") or 0)
            if inv.get("reorder_point") is not None:
                reorder = float(inv.get("reorder_point", 0))

    if computation_params:
        if "safety_stock" in computation_params:
            safety = float(computation_params.get("safety_stock", safety))
        if "reorder_point" in computation_params:
            reorder = float(computation_params.get("reorder_point", reorder))

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
    try:
        d = Decimal(str(v))
        return d if d > 0 else None
    except Exception:
        return None


def _extract_lot_rules(
    material: Any,
    source_type: Optional[str],
    computation_params: Dict[str, Any],
) -> tuple[Optional[Decimal], Optional[Decimal], Optional[Decimal]]:
    """(min, max, multiple)；computation_params 全局键优先于物料 defaults。"""
    min_q = _decimal_opt(computation_params.get("suggested_qty_min"))
    max_q = _decimal_opt(computation_params.get("suggested_qty_max"))
    mult = _decimal_opt(computation_params.get("suggested_qty_multiple"))

    defaults = getattr(material, "defaults", None) or {}
    if not isinstance(defaults, dict):
        return min_q, max_q, mult

    st = source_type or ""
    if st == SOURCE_TYPE_BUY:
        pur = defaults.get("purchase") if isinstance(defaults.get("purchase"), dict) else {}
        min_q = min_q or _decimal_opt(pur.get("min_order_quantity") or pur.get("min_order_qty"))
        max_q = max_q or _decimal_opt(pur.get("max_order_quantity") or pur.get("max_order_qty"))
        mult = mult or _decimal_opt(pur.get("order_multiple") or pur.get("quantity_multiple"))
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

    return min_q, max_q, mult


def _apply_suggested_lot_rules(
    raw: Decimal,
    min_q: Optional[Decimal],
    max_q: Optional[Decimal],
    mult: Optional[Decimal],
) -> Decimal:
    if raw <= 0:
        return Decimal(0)
    q = raw
    if min_q is not None:
        q = max(q, min_q)
    if mult is not None and mult > 0:
        units = (q / mult).to_integral_value(rounding=ROUND_CEILING)
        q = units * mult
    if max_q is not None and q > max_q:
        q = max_q
    return q


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
        available = float(inventory_info.get("available_quantity", 0))
    else:
        available = float(inventory_info.get("on_hand", inventory_info.get("available_quantity", 0)))
    in_transit = float(inventory_info.get("in_transit_quantity", 0))
    on_hand = float(inventory_info.get("on_hand", 0))
    avail_col = float(inventory_info.get("available_quantity", 0))

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


class DemandComputationService:
    """统一需求计算服务"""
    
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
            if d.status != DemandStatus.AUDITED or d.review_status != ReviewStatus.APPROVED:
                raise BusinessLogicError(
                    f"只能对已审核通过的需求进行计算，需求 {d.demand_code} 状态: {d.status}"
                )
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
                if d.status != DemandStatus.AUDITED or d.review_status != ReviewStatus.APPROVED:
                    raise BusinessLogicError(
                        f"只能对已审核通过的需求进行计算，需求 {d.demand_code} 状态: {d.status}"
                    )
                demands.append(d)

            demand = demands[0]
            # 展示“来源单号”：订单/预测优先使用 source_code，手工需求计划回退 demand_code
            source_codes = [
                (str(getattr(x, "source_code", "") or "").strip() or str(getattr(x, "demand_code", "") or "").strip())
                for x in demands
            ]
            source_codes = [c for c in source_codes if c]
            demand_codes = ",".join(source_codes[:3]) if source_codes else (demand.demand_code or "")
            if len(demands) > 3:
                demand_codes += f"等{len(demands)}个"

            computation = await DemandComputation.create(
                tenant_id=tenant_id,
                computation_code=computation_code,
                demand_id=demand.id,
                demand_ids=demand_id_list,
                demand_code=demand_codes,
                demand_type=demand.demand_type,
                business_mode=merged_business_mode,
                computation_type=persist_computation_type,
                computation_params=computation_data.computation_params,
                computation_status="进行中",
                computation_start_time=datetime.now(),
                notes=computation_data.notes,
                created_by=created_by,
            )
            
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
            await Demand.filter(tenant_id=tenant_id, id__in=demand_id_list).update(
                pushed_to_computation=True,
                computation_id=computation.id,
                computation_code=computation_code,
                updated_by=created_by,
                updated_at=datetime.now()
            )

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
        生成需求计算编码
        
        Args:
            tenant_id: 租户ID
            computation_type: 计算类型（恒为 MRP）
            
        Returns:
            str: 计算编码
        """
        try:
            # 使用编码生成服务生成编码
            code = await CodeGenerationService.generate_code(
                tenant_id=tenant_id,
                rule_code="DEMAND_COMPUTATION",
                context={"computation_type": computation_type}
            )
            return code
        except Exception as e:
            logger.warning(f"使用编码规则生成失败: {e}，使用简单编码")
            now = datetime.now()
            return f"MRP-{now.strftime('%Y%m%d')}-NEW"
    
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

        return DemandComputationResponse(
            id=computation.id,
            uuid=str(computation.uuid),
            tenant_id=computation.tenant_id,
            computation_code=computation.computation_code,
            demand_id=computation.demand_id,
            demand_code=computation.demand_code,
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
            created_by=computation.created_by,
            updated_by=computation.updated_by,
            items=item_responses,
            lifecycle=lifecycle
        )
    
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
        start_date: Optional[str] = None,
        end_date: Optional[str] = None,
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
        
        total = await query.count()
        computations = await query.offset(skip).limit(limit).order_by('-computation_start_time')
        
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
    
    async def execute_computation(
        self,
        tenant_id: int,
        computation_id: int,
        computation_params_override: Optional[Dict[str, Any]] = None,
    ) -> DemandComputationResponse:
        """
        执行需求计算
        
        Args:
            tenant_id: 租户ID
            computation_id: 计算ID
            computation_params_override: 临时覆盖的计算参数，仅本次执行生效，不持久化
            
        Returns:
            DemandComputationResponse: 计算响应
        """
        computation = await DemandComputation.get_or_none(tenant_id=tenant_id, id=computation_id)
        if not computation:
            raise NotFoundError(f"需求计算不存在: {computation_id}")

        # 允许执行：进行中（待执行）或 失败（重试）
        if computation.computation_status not in ("进行中", "失败"):
            raise BusinessLogicError(
                f"只能执行进行中或失败状态的计算，当前状态: {computation.computation_status}"
            )

        # 合并临时覆盖参数到 computation_params（仅本次执行生效，不持久化）
        if computation_params_override:
            base_params = computation.computation_params or {}
            computation.computation_params = {**base_params, **computation_params_override}

        try:
            async with in_transaction():
                # 失败重试时清理旧明细：理论上事务回滚已清理，此处为防御性保证重试从干净状态开始
                if computation.computation_status == "失败":
                    await DemandComputationItem.filter(
                        tenant_id=tenant_id,
                        computation_id=computation_id
                    ).delete()

                # 更新计算状态为计算中
                await DemandComputation.filter(tenant_id=tenant_id, id=computation_id).update(
                    computation_status="计算中",
                    computation_start_time=datetime.now()
                )

                # 统一需求计算（原 MRP/LRP 合并为单一实现，类型字段恒为 MRP）
                await self._execute_mrp_computation(tenant_id, computation)

                # 计算汇总信息 (新：计划员赋能增强，用于列表页展示)
                items = await DemandComputationItem.filter(tenant_id=tenant_id, computation_id=computation_id).all()
                shortage_count = 0
                risk_count = 0
                today = date.today()
                for item in items:
                    req_qty = float(item.gross_requirement or item.required_quantity or 0)
                    avail_qty = float(item.available_inventory or 0)
                    if req_qty > 0 and avail_qty < req_qty:
                        shortage_count += 1
                    
                    start_date = item.production_start_date or item.procurement_start_date
                    if start_date and start_date < today and (item.net_requirement or 0) > 0:
                        risk_count += 1
                
                summary = computation.computation_summary or {}
                summary["shortage_count"] = shortage_count
                summary["risk_count"] = risk_count
                summary["item_count"] = len(items)

                # 更新计算状态为完成，清除失败时的错误信息
                await DemandComputation.filter(tenant_id=tenant_id, id=computation_id).update(
                    computation_status="完成",
                    computation_end_time=datetime.now(),
                    computation_summary=summary,
                    error_message=None,
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
                    now = datetime.now()
                    err_msg = str(e).replace("'", "''")[:2000]  # 转义并截断
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
                    computation_start_time=datetime.now()
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
    ) -> DemandComputationResponse:
        """
        重新计算：仅允许对「完成」或「失败」的计算重新执行。
        重算前写入需求计算快照与重算历史；再删除原明细、重置状态并执行计算。
        """
        snapshot_id_saved: Optional[int] = None
        async with in_transaction():
            computation = await DemandComputation.get_or_none(tenant_id=tenant_id, id=computation_id)
            if not computation:
                raise NotFoundError(f"需求计算不存在: {computation_id}")
            if computation.computation_status not in ("完成", "失败"):
                raise BusinessLogicError(
                    f"只能对已完成或失败的计算执行重新计算，当前状态: {computation.computation_status}"
                )
            # 重算前快照：当前汇总 + 明细
            items_before = await DemandComputationItem.filter(
                tenant_id=tenant_id, computation_id=computation_id
            ).all()
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
                snapshot_at=datetime.now(),
                trigger="manual",
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
            await DemandComputation.filter(tenant_id=tenant_id, id=computation_id).update(
                computation_status="进行中",
                computation_end_time=None,
                error_message=None,
                computation_summary=None,
            )
        # 在事务外调用 execute，避免嵌套事务导致 TransactionManagementError
        try:
            result = await self.execute_computation(tenant_id=tenant_id, computation_id=computation_id)
            await DemandComputationRecalcHistory.create(
                tenant_id=tenant_id,
                computation_id=computation_id,
                recalc_at=datetime.now(),
                trigger="manual",
                operator_id=operator_id,
                result="success",
                snapshot_id=snapshot_id_saved,
                message="重算完成",
            )
            return result
        except Exception as e:
            await DemandComputationRecalcHistory.create(
                tenant_id=tenant_id,
                computation_id=computation_id,
                recalc_at=datetime.now(),
                trigger="manual",
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
                "recalc_at": r.recalc_at.isoformat() if r.recalc_at else None,
                "trigger": r.trigger,
                "operator_id": r.operator_id,
                "result": r.result,
                "snapshot_id": r.snapshot_id,
                "message": r.message,
            }
            for r in rows
        ]

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
                "snapshot_at": r.snapshot_at.isoformat() if r.snapshot_at else None,
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
            "snapshot_at": row.snapshot_at.isoformat() if row.snapshot_at else None,
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
        computation: DemandComputation
    ) -> None:
        """
        执行统一需求计算（原 MRP/LRP 合并为单一路径）。

        BOM 与净需求逻辑不变；有需求行交期时写入排程字段；汇总保留 demand_item_ids 追溯。
        """
        from apps.kuaizhizao.models.demand_item import DemandItem
        from apps.master_data.models.material import Material
        from apps.kuaizhizao.utils.bom_helper import get_bom_items_by_material_id

        logger.info(f"执行需求计算: {computation.computation_code}")
        # 1. 获取需求明细（支持多需求合并）
        demand_id_list = computation.demand_ids if computation.demand_ids else [computation.demand_id]
        demand_items = []
        for demand_id in demand_id_list:
            items = await DemandItem.filter(
                tenant_id=tenant_id,
                demand_id=demand_id
            ).all()
            demand_items.extend(items)
        
        if not demand_items:
            logger.warning(f"需求明细为空，计算ID: {computation.id}")
            return
        
        # 2. 计算参数（库存相关开关、BOM版本、4M 开关供后续排产扩展）
        computation_params = computation.computation_params or {}
        consider_capacity = computation_params.get("consider_capacity", True)
        consider_material_readiness = computation_params.get("consider_material_readiness", True)
        consider_equipment_availability = computation_params.get("consider_equipment_availability", False)
        consider_mold_tool_availability = computation_params.get("consider_mold_tool_availability", False)
        logger.debug(
            f"需求计算 4M 约束(供后续排产扩展): capacity={consider_capacity}, material={consider_material_readiness}, "
            f"equipment={consider_equipment_availability}, mold_tool={consider_mold_tool_availability}"
        )
        # BOM 版本：根据 bom_multi_version_allowed 决定使用指定版本或默认版本
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

        # 3. 存储所有物料需求（用于汇总）
        all_material_requirements = {}  # material_id -> requirement info

        def _append_demand_item_id(bucket: dict, did: Any) -> None:
            if did is None:
                return
            if "demand_item_ids" not in bucket:
                bucket["demand_item_ids"] = []
            if did not in bucket["demand_item_ids"]:
                bucket["demand_item_ids"].append(did)

        # 4. 处理每个需求明细
        for demand_item in demand_items:
            material_id = demand_item.material_id
            required_quantity = float(demand_item.required_quantity or 0)
            delivery_date = getattr(demand_item, "delivery_date", None)

            if required_quantity <= 0:
                continue

            if planning_cutoff and delivery_date is not None:
                dd = delivery_date.date() if hasattr(delivery_date, "date") else delivery_date
                if isinstance(dd, date) and dd > planning_cutoff:
                    continue
            
            # 获取物料信息
            material = await Material.get_or_none(tenant_id=tenant_id, id=material_id)
            if not material:
                logger.warning(f"物料不存在，物料ID: {material_id}")
                continue
            
            # 获取物料来源类型
            source_type = await get_material_source_type(tenant_id, material_id)
            
            # 验证物料来源配置
            validation_passed, validation_errors = await validate_material_source_config(
                tenant_id=tenant_id,
                material_id=material_id,
                source_type=source_type or "Make"  # 默认自制件
            )
            
            # 获取物料来源配置
            source_config = await get_material_source_config(tenant_id, material_id) or {}
            
            # 处理不同来源类型的物料
            if source_type == SOURCE_TYPE_PHANTOM:
                # 虚拟件：自动跳过，直接展开下层物料
                logger.debug(f"处理虚拟件，物料ID: {material_id}, 物料编码: {material.main_code}")
                
                # 使用物料来源控制的BOM展开逻辑
                variant_attrs = getattr(demand_item, "variant_attributes", None)
                cfg_selections = _safe_configurable_selections(getattr(demand_item, "configurable_selections", None))
                expanded_requirements = await expand_bom_with_source_control(
                    tenant_id=tenant_id,
                    material_id=material_id,
                    required_quantity=required_quantity,
                    only_approved=True,
                    max_level=bom_max_level,
                    bom_version=bom_version,
                    use_default_bom=use_default_bom,
                    material_bom_versions=material_bom_versions,
                    variant_attributes=variant_attrs,
                    configurable_selections=cfg_selections,
                )
                
                # 合并到总需求中
                for req in expanded_requirements:
                    req_material_id = req["material_id"]
                    if req_material_id not in all_material_requirements:
                        all_material_requirements[req_material_id] = {
                            "material_id": req_material_id,
                            "material_code": req["material_code"],
                            "material_name": req["material_name"],
                            "source_type": req.get("source_type"),
                            "required_quantity": 0.0,
                            "unit": req.get("unit"),
                            "delivery_date": delivery_date,
                        }
                    all_material_requirements[req_material_id]["required_quantity"] += req["required_quantity"]
                    _append_demand_item_id(all_material_requirements[req_material_id], demand_item.id)

            elif source_type == SOURCE_TYPE_CONFIGURE:
                # 配置件：按属性展开BOM（从需求明细获取 variant_attributes）
                logger.debug(f"处理配置件，物料ID: {material_id}, 物料编码: {material.main_code}")
                variant_attrs = getattr(demand_item, "variant_attributes", None)
                cfg_selections = _safe_configurable_selections(getattr(demand_item, "configurable_selections", None))
                expanded_requirements = await expand_bom_with_source_control(
                    tenant_id=tenant_id,
                    material_id=material_id,
                    required_quantity=required_quantity,
                    only_approved=True,
                    max_level=bom_max_level,
                    bom_version=bom_version,
                    use_default_bom=use_default_bom,
                    material_bom_versions=material_bom_versions,
                    variant_attributes=variant_attrs,
                    configurable_selections=cfg_selections,
                )
                
                # 合并到总需求中
                for req in expanded_requirements:
                    req_material_id = req["material_id"]
                    if req_material_id not in all_material_requirements:
                        all_material_requirements[req_material_id] = {
                            "material_id": req_material_id,
                            "material_code": req["material_code"],
                            "material_name": req["material_name"],
                            "source_type": req.get("source_type"),
                            "required_quantity": 0.0,
                            "unit": req.get("unit"),
                            "delivery_date": delivery_date,
                        }
                    all_material_requirements[req_material_id]["required_quantity"] += req["required_quantity"]
                    _append_demand_item_id(all_material_requirements[req_material_id], demand_item.id)

            else:
                # 其他类型（自制件、采购件、委外件）：正常处理
                if material_id not in all_material_requirements:
                    all_material_requirements[material_id] = {
                        "material_id": material_id,
                        "material_code": material.main_code or material.code,
                        "material_name": material.name,
                        "source_type": source_type,
                        "required_quantity": 0.0,
                        "unit": material.base_unit,
                        "delivery_date": delivery_date,
                    }
                all_material_requirements[material_id]["required_quantity"] += required_quantity
                _append_demand_item_id(all_material_requirements[material_id], demand_item.id)

                # 如果有BOM，展开BOM（顶层物料优先从 material_bom_versions 取版本）
                top_version = bom_version
                top_use_default = use_default_bom
                if material_bom_versions:
                    v = material_bom_versions.get(material_id) or material_bom_versions.get(str(material_id))
                    if v:
                        top_version = v
                        top_use_default = False
                    elif not bom_version:
                        top_use_default = True
                bom_items = await get_bom_items_by_material_id(
                    tenant_id=tenant_id,
                    material_id=material_id,
                    only_approved=True,
                    version=top_version,
                    use_default=top_use_default,
                )

                if bom_items:
                    # 展开BOM（使用物料来源控制逻辑）
                    variant_attrs = getattr(demand_item, "variant_attributes", None)
                    cfg_selections = _safe_configurable_selections(getattr(demand_item, "configurable_selections", None))
                    expanded_requirements = await expand_bom_with_source_control(
                        tenant_id=tenant_id,
                        material_id=material_id,
                        required_quantity=required_quantity,
                        only_approved=True,
                        max_level=bom_max_level,
                        bom_version=bom_version,
                        use_default_bom=use_default_bom,
                        material_bom_versions=material_bom_versions,
                        variant_attributes=variant_attrs,
                        configurable_selections=cfg_selections,
                    )

                    # 合并到总需求中
                    for req in expanded_requirements:
                        req_material_id = req["material_id"]
                        if req_material_id not in all_material_requirements:
                            all_material_requirements[req_material_id] = {
                                "material_id": req_material_id,
                                "material_code": req["material_code"],
                                "material_name": req["material_name"],
                                "source_type": req.get("source_type"),
                                "required_quantity": 0.0,
                                "unit": req.get("unit"),
                                "delivery_date": delivery_date,
                            }
                        all_material_requirements[req_material_id]["required_quantity"] += req["required_quantity"]
                        _append_demand_item_id(all_material_requirements[req_material_id], demand_item.id)
        
        in_transit_map = await batch_sum_open_supply_quantities(
            tenant_id, list(all_material_requirements.keys())
        )

        netting_params_for_supply = _netting_params_for_mrp_supply(computation_params)

        # 5. 生成计算结果明细
        for material_id, req_info in all_material_requirements.items():
            # 获取物料信息
            material = await Material.get_or_none(tenant_id=tenant_id, id=material_id)
            if not material:
                continue
            
            source_type = req_info.get("source_type") or material.source_type
            
            # 验证物料来源配置
            validation_passed, validation_errors = await validate_material_source_config(
                tenant_id=tenant_id,
                material_id=material_id,
                source_type=source_type or "Make"
            )
            
            # 获取物料来源配置
            source_config = await get_material_source_config(tenant_id, material_id) or {}
            
            # 获取库存信息与安全库存/再订货点
            transit_dec = in_transit_map.get(material_id, Decimal("0"))
            inventory_info = await get_material_inventory_info(
                tenant_id=tenant_id,
                material_id=material_id,
                warehouse_id=None,
                warehouse_ids=wh_ids,
                in_transit_quantity=float(transit_dec),
                with_breakdown=True,
            )
            safety_stock, reorder_point = await _get_material_safety_reorder(
                material=material,
                computation_params=computation_params,
            )
            _supply, net_requirement, supply_calc_detail = _compute_supply_and_net(
                inventory_info=inventory_info,
                safety_stock=safety_stock,
                reorder_point=reorder_point,
                gross_requirement=req_info["required_quantity"],
                computation_params=netting_params_for_supply,
            )
            available_inventory = float(inventory_info.get("available_quantity", 0))
            in_transit_qty = float(inventory_info.get("in_transit_quantity", 0))
            reserved_qty = float(inventory_info.get("reserved_quantity", 0))
            gross_requirement = req_info["required_quantity"]
            mrp_basis = _mrp_suggestion_basis(computation_params)
            planning_qty = _mrp_planning_suggestion_quantity(
                mrp_basis, float(gross_requirement), float(net_requirement)
            )

            delivery_date = req_info.get("delivery_date")
            production_start_date = None
            production_completion_date = None
            procurement_start_date = None
            procurement_completion_date = None

            suggested_work_order_quantity = Decimal(0)
            suggested_purchase_order_quantity = Decimal(0)
            planned_production = Decimal(0)
            planned_procurement = Decimal(0)

            try:
                schedule_buffer_days = max(0, int(computation_params.get("schedule_buffer_days") or 0))
            except (TypeError, ValueError):
                schedule_buffer_days = 0

            if source_type == SOURCE_TYPE_MAKE:
                # 自制件建议工单量不再被来源校验结果阻断：
                # 校验失败仅用于提示（source_validation_*），避免半成品因配置不完整被直接算成“-”。
                if planning_qty > 0:
                    suggested_work_order_quantity = Decimal(str(planning_qty))
                    planned_production = Decimal(str(planning_qty))
                    production_lead_time = source_config.get("source_config", {}).get("production_lead_time", 3)
                    if delivery_date:
                        production_completion_date = delivery_date
                        total_lt = int(production_lead_time) + schedule_buffer_days
                        production_start_date = delivery_date - timedelta(days=total_lt)
            elif source_type == SOURCE_TYPE_BUY:
                if planning_qty > 0:
                    suggested_purchase_order_quantity = Decimal(str(planning_qty))
                    planned_procurement = Decimal(str(planning_qty))
                    purchase_lead_time = source_config.get("source_config", {}).get("purchase_lead_time", 7)
                    if delivery_date:
                        procurement_completion_date = delivery_date
                        total_lt = int(purchase_lead_time) + schedule_buffer_days
                        procurement_start_date = delivery_date - timedelta(days=total_lt)
            elif source_type == SOURCE_TYPE_OUTSOURCE:
                if planning_qty > 0:
                    suggested_work_order_quantity = Decimal(str(planning_qty))
                    planned_production = Decimal(str(planning_qty))
                    outsource_lead_time = source_config.get("source_config", {}).get("outsource_lead_time", 5)
                    if delivery_date:
                        production_completion_date = delivery_date
                        total_lt = int(outsource_lead_time) + schedule_buffer_days
                        production_start_date = delivery_date - timedelta(days=total_lt)

            if computation_params.get("apply_lot_sizing", True):
                min_l, max_l, mul_l = _extract_lot_rules(material, source_type, computation_params)
                if source_type == SOURCE_TYPE_MAKE and suggested_work_order_quantity > 0:
                    suggested_work_order_quantity = _apply_suggested_lot_rules(
                        suggested_work_order_quantity, min_l, max_l, mul_l
                    )
                    planned_production = suggested_work_order_quantity
                elif source_type == SOURCE_TYPE_BUY and suggested_purchase_order_quantity > 0:
                    suggested_purchase_order_quantity = _apply_suggested_lot_rules(
                        suggested_purchase_order_quantity, min_l, max_l, mul_l
                    )
                    planned_procurement = suggested_purchase_order_quantity
                elif source_type == SOURCE_TYPE_OUTSOURCE and suggested_work_order_quantity > 0:
                    suggested_work_order_quantity = _apply_suggested_lot_rules(
                        suggested_work_order_quantity, min_l, max_l, mul_l
                    )
                    planned_production = suggested_work_order_quantity

            supply_for_detail = dict(supply_calc_detail)
            supply_for_detail["mrp_suggestion_basis"] = mrp_basis
            supply_for_detail["planning_suggestion_quantity"] = float(planning_qty)
            if mrp_basis == "gross":
                _lines = list(supply_for_detail.get("lines_zh") or [])
                _lines.append(
                    "建议工单/采购/委外量按「毛需求」生成；「净需求」未套用安全库存、在途/在制、预留、再订货点等供需净算项，仅按在库与毛需求估算缺口供参考。"
                )
                supply_for_detail["lines_zh"] = _lines

            await DemandComputationItem.create(
                tenant_id=tenant_id,
                computation_id=computation.id,
                material_id=material_id,
                material_code=req_info["material_code"],
                material_name=req_info["material_name"],
                material_spec=material.specification,
                material_unit=req_info["unit"],
                required_quantity=Decimal(str(gross_requirement)),
                available_inventory=Decimal(str(available_inventory)),
                net_requirement=Decimal(str(net_requirement)),
                gross_requirement=Decimal(str(gross_requirement)),
                safety_stock=Decimal(str(safety_stock))
                if netting_params_for_supply.get("include_safety_stock", True)
                else None,
                reorder_point=Decimal(str(reorder_point))
                if netting_params_for_supply.get("include_reorder_point", False)
                else None,
                delivery_date=delivery_date,
                planned_production=planned_production if planned_production > 0 else None,
                planned_procurement=planned_procurement if planned_procurement > 0 else None,
                production_start_date=production_start_date,
                production_completion_date=production_completion_date,
                procurement_start_date=procurement_start_date,
                procurement_completion_date=procurement_completion_date,
                suggested_work_order_quantity=suggested_work_order_quantity if suggested_work_order_quantity > 0 else None,
                suggested_purchase_order_quantity=suggested_purchase_order_quantity if suggested_purchase_order_quantity > 0 else None,
                material_source_type=source_type,
                material_source_config=source_config,
                source_validation_passed=validation_passed,
                source_validation_errors=validation_errors if not validation_passed else None,
                demand_item_ids=req_info.get("demand_item_ids"),
                detail_results={
                    "in_transit_quantity": in_transit_qty,
                    "reserved_quantity": reserved_qty,
                    "on_hand": float(inventory_info.get("on_hand", 0)),
                    "inventory_breakdown": inventory_info.get("breakdown") or {},
                    "supply_calculation": supply_for_detail,
                },
            )

        # 6. 需求行 BOM 生产树（供工单组下推）
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
            update_data['updated_by'] = updated_by
            
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
                        updated_at=datetime.now()
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
        already_pushed_po_material_ids = exclusions["po_material_ids"]
        
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
                # 采购件：仅当配置了默认供应商时直接生成采购单；未配置的需通过「下推到采购申请」
                # 排除已下推且仍存在的采购单中的物料，避免重复
                if item.material_id in already_pushed_po_material_ids:
                    continue
                if item.suggested_purchase_order_quantity and item.suggested_purchase_order_quantity > 0:
                    supplier_id = None
                    if item.material_source_config:
                        source_config = item.material_source_config.get("source_config", {})
                        supplier_id = source_config.get("default_supplier_id")
                    if supplier_id:
                        if supplier_id not in purchase_items_by_supplier:
                            purchase_items_by_supplier[supplier_id] = []
                        purchase_items_by_supplier[supplier_id].append(item)
                    
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
                
                # 如果有建议采购订单数量，仅当配置了默认供应商时生成采购单
                if item.material_id not in already_pushed_po_material_ids and item.suggested_purchase_order_quantity and item.suggested_purchase_order_quantity > 0:
                    supplier_id = None
                    if item.material_source_config:
                        source_config = item.material_source_config.get("source_config", {})
                        supplier_id = source_config.get("default_supplier_id")
                    if supplier_id:
                        if supplier_id not in purchase_items_by_supplier:
                            purchase_items_by_supplier[supplier_id] = []
                        purchase_items_by_supplier[supplier_id].append(item)
            
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
        from apps.kuaizhizao.models.production_plan import ProductionPlan
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
            elif tt == "production_plan":
                plan = await ProductionPlan.get_or_none(tenant_id=tenant_id, id=tid, deleted_at__isnull=True)
                target_exists = plan is not None
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
                "created_at": rel.created_at.isoformat() if rel.created_at else None,
                "target_exists": target_exists,
            })

        return {"records": records}

    async def _get_already_pushed_exclusions(
        self, tenant_id: int, computation_id: int
    ) -> Dict[str, Any]:
        """
        获取需求计算已下推且仍存在的单据对应的物料ID等排除信息。
        用于重新下推时避免重复生成。
        返回: {
            wo_material_ids: set,  # 已有工单的物料ID
            outsource_material_ids: set,  # 已有委外工单的物料ID
            po_material_ids: set,  # 已有采购单包含的物料ID
            has_purchase_requisition: bool,
        }
        """
        from apps.kuaizhizao.models.document_relation import DocumentRelation
        from apps.kuaizhizao.models.work_order import WorkOrder
        from apps.kuaizhizao.models.purchase_order import PurchaseOrder, PurchaseOrderItem
        from apps.kuaizhizao.models.purchase_requisition import PurchaseRequisition
        from apps.kuaizhizao.models.outsource_work_order import OutsourceWorkOrder

        rels = await DocumentRelation.filter(
            tenant_id=tenant_id,
            source_type="demand_computation",
            source_id=computation_id,
        ).all()

        wo_material_ids = set()
        outsource_material_ids = set()
        po_material_ids = set()
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
                po = await PurchaseOrder.get_or_none(tenant_id=tenant_id, id=tid)
                if po:
                    items = await PurchaseOrderItem.filter(order_id=tid).all()
                    for poi in items:
                        po_material_ids.add(poi.material_id)
            elif tt == "purchase_requisition":
                req = await PurchaseRequisition.get_or_none(tenant_id=tenant_id, id=tid, deleted_at__isnull=True)
                if req:
                    has_purchase_requisition = True

        return {
            "wo_material_ids": wo_material_ids,
            "outsource_material_ids": outsource_material_ids,
            "po_material_ids": po_material_ids,
            "has_purchase_requisition": has_purchase_requisition,
        }

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
                    supplier_id = None
                    if item.material_source_config:
                        sc = item.material_source_config.get("source_config", {})
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

    async def get_push_preview(
        self,
        tenant_id: int,
        computation_id: int,
        push_config: Optional[Dict[str, Any]] = None
    ) -> Dict[str, Any]:
        """
        获取下推预览（不实际执行），用于下推前展示将生成的单据数量。
        push_config: { "production": "plan"|"work_order", "purchase": "requisition"|"purchase_order" }
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
                    sc = (item.material_source_config or {}).get("source_config", {})
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
        elif purchase == "purchase_order" and purchase_items_with_supplier > 0:
            supplier_ids = set()
            for item in items:
                if item.material_source_type == SOURCE_TYPE_BUY and item.suggested_purchase_order_quantity and item.suggested_purchase_order_quantity > 0:
                    sc = (item.material_source_config or {}).get("source_config", {})
                    sid = sc.get("default_supplier_id")
                    if sid:
                        supplier_ids.add(sid)
            purchase_order_count = len(supplier_ids)

        biz_config = BusinessConfigService()
        can_direct_wo = await biz_config.can_direct_generate_work_order_from_computation(tenant_id)

        return {
            "computation_id": computation_id,
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
        一键下推：按配置执行生产计划/工单、采购申请/采购单、委外工单。
        production: "plan"|"work_order"|null
        purchase: "requisition"|"purchase_order"|null
        include_outsource: 委外工单是否包含（生产计划已含委外明细，工单模式会生成委外工单）
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

        if production == "plan":
            raise BusinessLogicError("生产计划已下线，请使用「直接生成工单」下推")

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
                    if "无采购件" not in str(e):
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
                        f"{so.order_code} · {so.customer_name}" if so.customer_name else so.order_code
                    )

            # 确定计划时间（如果有LRP的日期信息）
            planned_start_date = None
            planned_end_date = None
            if item.production_start_date:
                planned_start_date = item.production_start_date
            if item.production_completion_date:
                planned_end_date = item.production_completion_date
            
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
            mc = item.material_source_config or {}
            source_config = mc.get("source_config", mc)
            outsource_supplier_id = mc.get("outsource_supplier_id") or source_config.get("outsource_supplier_id")
            outsource_operation = mc.get("outsource_operation") or source_config.get("outsource_operation", "")
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
            supplier_name = getattr(supplier, "name", None) or source_config.get("outsource_supplier_name", "待指定")
            
            quantity = float(item.suggested_work_order_quantity or 0)
            unit_price = Decimal(str(mc.get("outsource_price") or source_config.get("outsource_price", 0)))
            total_amount = Decimal(str(quantity)) * unit_price
            
            planned_start_date = None
            planned_end_date = None
            if item.production_start_date:
                planned_start_date = datetime.combine(
                    item.production_start_date,
                    datetime.min.time()
                )
            if item.production_completion_date:
                planned_end_date = datetime.combine(
                    item.production_completion_date,
                    datetime.min.time()
                )
            
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
            from core.services.business.code_generation_service import CodeGenerationService
            from datetime import datetime, date, timedelta
            from decimal import Decimal
            
            # 生成采购订单编码
            try:
                order_code = await CodeGenerationService.generate_code(
                    tenant_id=tenant_id,
                    rule_code="PURCHASE_ORDER",
                )
            except Exception:
                # 回退到简单编码
                now = datetime.now()
                order_code = f"PO-{now.strftime('%Y%m%d')}-{computation.id}"
            
            # 从物料来源配置获取默认供应商和采购价格（物料来源控制增强）
            supplier_id = None
            supplier_name = "待指定供应商"
            unit_price = Decimal(0)
            
            if item.material_source_type == "Buy" and item.material_source_config:
                source_config = item.material_source_config.get("source_config", {})
                supplier_id = source_config.get("default_supplier_id")
                supplier_name = source_config.get("default_supplier_name", "待指定供应商")
                unit_price = Decimal(str(source_config.get("purchase_price", 0)))
            
            # 如果没有配置，使用占位值
            if not supplier_id:
                supplier_id = 1  # 需要手动指定
            
            # 确定交货日期
            delivery_date = item.procurement_completion_date or item.delivery_date
            if not delivery_date:
                # 从物料来源配置获取采购提前期
                lead_time_days = 7  # 默认7天
                if item.material_source_config:
                    source_config = item.material_source_config.get("source_config", {})
                    lead_time_days = source_config.get("purchase_lead_time", 7)
                delivery_date = date.today() + timedelta(days=lead_time_days)
            
            # 创建采购订单
            purchase_order = await PurchaseOrder.create(
                tenant_id=tenant_id,
                order_code=order_code,
                supplier_id=supplier_id,
                supplier_name=supplier_name,
                order_date=date.today(),
                delivery_date=delivery_date,
                order_type="标准采购",
                status="草稿",
                source_type="demand_computation",
                source_id=computation.id,
                notes=f"从需求计算 {computation.computation_code} 自动生成",
            )
            
            # 计算总价
            quantity = float(item.suggested_purchase_order_quantity or 0)
            total_price = float(unit_price) * quantity
            
            # 创建采购订单行
            await PurchaseOrderItem.create(
                tenant_id=tenant_id,
                order_id=purchase_order.id,
                material_id=item.material_id,
                material_code=item.material_code,
                material_name=item.material_name,
                material_spec=item.material_spec,
                ordered_quantity=Decimal(str(quantity)),
                unit=item.material_unit,
                unit_price=unit_price,
                total_price=Decimal(str(total_price)),
                required_date=delivery_date,
                inspection_required=True,
                source_type="demand_computation",
                source_id=computation.id,
            )
            
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
            
            # 验证供应商
            supplier = await Supplier.get_or_none(tenant_id=tenant_id, id=supplier_id)
            if not supplier:
                # 如果供应商不存在，尝试从第一个物料的配置中获取供应商名称
                supplier_name = "待指定供应商"
                if items and items[0].material_source_config:
                    source_config = items[0].material_source_config.get("source_config", {})
                    supplier_name = source_config.get("default_supplier_name", "待指定供应商")
            else:
                supplier_name = supplier.name
            
            # 生成采购订单编码
            try:
                order_code = await CodeGenerationService.generate_code(
                    tenant_id=tenant_id,
                    rule_code="PURCHASE_ORDER",
                )
            except Exception:
                # 回退到简单编码
                now = datetime.now()
                order_code = f"PO-{now.strftime('%Y%m%d')}-{computation.id}-{supplier_id}"
            
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
                    source_config = items[0].material_source_config.get("source_config", {})
                    lead_time_days = source_config.get("purchase_lead_time", 7)
                delivery_date = date.today() + timedelta(days=lead_time_days)
            
            # 创建采购订单
            purchase_order = await PurchaseOrder.create(
                tenant_id=tenant_id,
                order_code=order_code,
                supplier_id=supplier_id,
                supplier_name=supplier_name,
                order_date=date.today(),
                delivery_date=delivery_date,
                order_type="标准采购",
                status="草稿",
                source_type="demand_computation",
                source_id=computation.id,
                notes=f"从需求计算 {computation.computation_code} 自动生成（按供应商分组）",
                created_by=created_by,
                updated_by=created_by
            )
            
            # 创建采购订单明细并计算总金额
            total_quantity = Decimal(0)
            total_amount = Decimal(0)
            
            for item in items:
                # 从物料来源配置获取采购价格（物料来源控制增强）
                unit_price = Decimal(0)
                if item.material_source_type == "Buy" and item.material_source_config:
                    source_config = item.material_source_config.get("source_config", {})
                    unit_price = Decimal(str(source_config.get("purchase_price", 0)))
                
                # 计算数量和总价
                quantity = Decimal(str(item.suggested_purchase_order_quantity or 0))
                total_price = unit_price * quantity
                
                # 创建采购订单行
                await PurchaseOrderItem.create(
                    tenant_id=tenant_id,
                    order_id=purchase_order.id,
                    material_id=item.material_id,
                    material_code=item.material_code,
                    material_name=item.material_name,
                    material_spec=item.material_spec,
                    ordered_quantity=quantity,
                    unit=item.material_unit,
                    unit_price=unit_price,
                    total_price=total_price,
                    required_date=delivery_date,
                    inspection_required=True,
                    source_type="demand_computation",
                    source_id=computation.id,
                    created_by=created_by,
                    updated_by=created_by
                )
                
                total_quantity += quantity
                total_amount += total_price
            
            # 更新订单头金额信息
            await purchase_order.update_from_dict({
                'total_quantity': total_quantity,
                'total_amount': total_amount,
                'tax_amount': Decimal(0),  # 默认税率为0
                'net_amount': total_amount,
                'updated_by': created_by
            }).save()
            
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