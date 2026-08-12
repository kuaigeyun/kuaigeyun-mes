"""
补货建议业务服务模块

提供补货建议相关的业务逻辑处理，包括生成补货建议、处理补货建议、下推采购等。

Author: Auto (AI Assistant)
Date: 2026-01-17
"""

from __future__ import annotations

import uuid
from datetime import date, datetime, timedelta
from decimal import Decimal
from typing import Any, Dict, List, Optional, Tuple

from tortoise.transactions import in_transaction

from apps.common.base_service import AppBaseService
from apps.kuaizhizao.models.inventory_alert import InventoryAlert
from apps.kuaizhizao.models.replenishment_suggestion import ReplenishmentSuggestion
from apps.kuaizhizao.schemas.replenishment_suggestion import (
    ReplenishmentSuggestionGenerateResult,
    ReplenishmentSuggestionListResponse,
    ReplenishmentSuggestionProcessRequest,
    ReplenishmentSuggestionResponse,
)
from core.utils.timezone_utils import resolve_business_datetime, to_site_date
from infra.exceptions.exceptions import BusinessLogicError, NotFoundError, ValidationError


def _to_decimal(value: Any) -> Optional[Decimal]:
    if value is None or value == "":
        return None
    try:
        return Decimal(str(value))
    except Exception:
        return None


def _apply_purchase_lot_rules(
    raw: Decimal,
    material: Any,
) -> Decimal:
    """采购批量规则：固定批量 → 最小 → 倍数 → 上限（与 MRP 口径一致）。"""
    from apps.kuaizhizao.services.demand_computation_service import _apply_suggested_lot_rules

    if raw <= 0:
        return Decimal(0)
    defaults = getattr(material, "defaults", None) or {}
    if not isinstance(defaults, dict):
        return raw
    pur = defaults.get("purchase") if isinstance(defaults.get("purchase"), dict) else {}
    min_q = _to_decimal(pur.get("min_order_quantity") or pur.get("min_order_qty"))
    max_q = _to_decimal(pur.get("max_order_quantity") or pur.get("max_order_qty"))
    mult = _to_decimal(pur.get("order_multiple") or pur.get("quantity_multiple"))
    fixed_q = _to_decimal(
        pur.get("fixed_order_quantity")
        or pur.get("fixed_lot_size")
        or pur.get("fixed_batch_quantity")
    )
    return _apply_suggested_lot_rules(raw, min_q, max_q, mult, fixed_q)


def _priority_from_stock(current: Decimal, safety: Optional[Decimal]) -> str:
    if safety is None or safety <= 0:
        return "medium"
    if current <= safety * Decimal("0.2"):
        return "high"
    if current <= safety * Decimal("0.5"):
        return "medium"
    return "low"


class ReplenishmentSuggestionService(AppBaseService[ReplenishmentSuggestion]):
    """补货建议服务类。"""

    def __init__(self):
        super().__init__(ReplenishmentSuggestion)

    async def _require_purchase_requisition(self, tenant_id: int) -> bool:
        from infra.services.business_config_service import BusinessConfigService

        biz_config = await BusinessConfigService().get_business_config(tenant_id)
        return bool(
            biz_config.get("parameters", {})
            .get("procurement", {})
            .get("require_purchase_requisition", False)
        )

    async def _get_warehouse_available_qty(
        self,
        tenant_id: int,
        material_id: int,
        warehouse_id: int,
    ) -> Decimal:
        """按仓库取可用库存（主仓批次 + 线边可用）。"""
        from tortoise.queryset import Q

        from apps.kuaizhizao.models.line_side_inventory import LineSideInventory
        from apps.master_data.constants.batch_quality_status import QUALIFIED
        from apps.master_data.models.material_batch import MaterialBatch

        today = to_site_date(resolve_business_datetime())
        batch_items = await MaterialBatch.filter(
            tenant_id=tenant_id,
            material_id=material_id,
            warehouse_id=warehouse_id,
            deleted_at__isnull=True,
            quantity__gt=0,
            quality_status=QUALIFIED,
        ).filter(~Q(status__in=["out_stock", "scrapped", "expired"])).filter(
            Q(expiry_date__isnull=True) | Q(expiry_date__gte=today)
        ).all()
        on_hand = sum((item.quantity or Decimal(0)) for item in batch_items)

        line_items = await LineSideInventory.filter(
            tenant_id=tenant_id,
            material_id=material_id,
            warehouse_id=warehouse_id,
            deleted_at__isnull=True,
            status="available",
        ).all()
        reserved = sum((item.reserved_quantity or Decimal(0)) for item in line_items)
        line_qty = sum((item.quantity or Decimal(0)) for item in line_items)
        on_hand += line_qty
        available = on_hand - reserved
        return available if available > 0 else Decimal(0)

    async def _resolve_supplier_and_lead(
        self,
        tenant_id: int,
        material_id: int,
    ) -> Tuple[Optional[int], Optional[str], Optional[int], Optional[Decimal]]:
        """返回 supplier_id, supplier_name, lead_days, purchase_price。"""
        from apps.kuaizhizao.utils.material_source_helper import get_material_source_config

        cfg = await get_material_source_config(tenant_id, material_id)
        if not cfg:
            return None, None, None, None
        lead = cfg.get("purchase_lead_time")
        try:
            lead_days = int(lead) if lead is not None else None
        except (TypeError, ValueError):
            lead_days = None
        if lead_days is not None and lead_days < 0:
            lead_days = None
        price = _to_decimal(cfg.get("purchase_price"))
        sid = cfg.get("default_supplier_id")
        try:
            supplier_id = int(sid) if sid is not None else None
        except (TypeError, ValueError):
            supplier_id = None
        if supplier_id is not None and supplier_id <= 0:
            supplier_id = None
        supplier_name = cfg.get("default_supplier_name")
        if supplier_name is not None:
            supplier_name = str(supplier_name).strip() or None
        return supplier_id, supplier_name, lead_days, price

    async def _pick_warehouse_for_material(
        self,
        tenant_id: int,
        material_id: int,
        warehouse_ids: List[int],
    ) -> Tuple[int, str]:
        """多仓时取可用库存最低仓；无库存则取首仓。"""
        from apps.master_data.models.warehouse import Warehouse

        if not warehouse_ids:
            raise BusinessLogicError("需求计算未指定仓库范围，无法生成补货建议")
        if len(warehouse_ids) == 1:
            wid = int(warehouse_ids[0])
            wh = await Warehouse.get_or_none(tenant_id=tenant_id, id=wid)
            return wid, (wh.name if wh else f"仓库({wid})")

        best_wid = int(warehouse_ids[0])
        best_qty: Optional[Decimal] = None
        for wid in warehouse_ids:
            qty = await self._get_warehouse_available_qty(tenant_id, material_id, int(wid))
            if best_qty is None or qty < best_qty:
                best_qty = qty
                best_wid = int(wid)
        wh = await Warehouse.get_or_none(tenant_id=tenant_id, id=best_wid)
        return best_wid, (wh.name if wh else f"仓库({best_wid})")

    def _enrich_response(
        self,
        suggestion: ReplenishmentSuggestion,
        *,
        require_purchase_requisition: bool,
    ) -> ReplenishmentSuggestionResponse:
        from apps.kuaizhizao.services.document_action_policy.enricher import (
            _attach_capabilities_to_response,
        )
        from apps.kuaizhizao.services.document_action_policy.replenishment_suggestion import (
            derive_replenishment_suggestion_capabilities,
        )

        resp = ReplenishmentSuggestionResponse.model_validate(suggestion)
        caps = derive_replenishment_suggestion_capabilities(
            suggestion,
            require_purchase_requisition=require_purchase_requisition,
        )
        return _attach_capabilities_to_response(resp, caps)

    async def generate_suggestions_from_alerts(
        self,
        tenant_id: int,
        alert_ids: Optional[List[int]] = None,
        *,
        created_by: Optional[int] = None,
    ) -> ReplenishmentSuggestionGenerateResult:
        """基于库存预警生成补货建议（物料主数据算量 + 供应商/交期）。"""
        from apps.kuaizhizao.services.inventory_threshold_resolver import material_stock_thresholds
        from apps.master_data.models.material import Material

        user_info = await self.get_user_info(created_by) if created_by else {"name": ""}
        created_items: List[ReplenishmentSuggestionResponse] = []
        skipped_existing = 0
        skipped_zero_qty = 0

        async with in_transaction():
            if alert_ids:
                alerts = await InventoryAlert.filter(
                    tenant_id=tenant_id,
                    id__in=alert_ids,
                    alert_type="low_stock",
                    status="pending",
                    deleted_at__isnull=True,
                ).all()
            else:
                alerts = await InventoryAlert.filter(
                    tenant_id=tenant_id,
                    alert_type="low_stock",
                    status="pending",
                    deleted_at__isnull=True,
                ).all()

            material_ids = sorted({int(a.material_id) for a in alerts if a.material_id})
            materials = (
                await Material.filter(tenant_id=tenant_id, id__in=material_ids).all()
                if material_ids
                else []
            )
            material_by_id = {int(m.id): m for m in materials}
            order_dt = resolve_business_datetime()

            for alert in alerts:
                existing = await ReplenishmentSuggestion.filter(
                    tenant_id=tenant_id,
                    material_id=alert.material_id,
                    warehouse_id=alert.warehouse_id,
                    status="pending",
                    deleted_at__isnull=True,
                ).first()
                if existing:
                    skipped_existing += 1
                    continue

                material = material_by_id.get(int(alert.material_id))
                safety, max_stock = material_stock_thresholds(material) if material else (None, None)
                if safety is None:
                    safety = _to_decimal(alert.threshold_value)

                current_quantity = await self._get_warehouse_available_qty(
                    tenant_id,
                    int(alert.material_id),
                    int(alert.warehouse_id),
                )
                target = max_stock if max_stock is not None and max_stock > 0 else safety
                if target is None:
                    skipped_zero_qty += 1
                    continue

                raw_suggested = target - current_quantity
                if raw_suggested <= 0:
                    skipped_zero_qty += 1
                    continue

                suggested_quantity = (
                    _apply_purchase_lot_rules(raw_suggested, material) if material else raw_suggested
                )
                if suggested_quantity <= 0:
                    skipped_zero_qty += 1
                    continue

                supplier_id, supplier_name, lead_days, _price = await self._resolve_supplier_and_lead(
                    tenant_id, int(alert.material_id)
                )
                priority = _priority_from_stock(current_quantity, safety)

                suggestion = await ReplenishmentSuggestion.create(
                    tenant_id=tenant_id,
                    uuid=str(uuid.uuid4()),
                    material_id=alert.material_id,
                    material_code=alert.material_code,
                    material_name=alert.material_name,
                    warehouse_id=alert.warehouse_id,
                    warehouse_name=alert.warehouse_name,
                    current_quantity=current_quantity,
                    safety_stock=safety,
                    min_stock=safety,
                    max_stock=max_stock,
                    suggested_quantity=suggested_quantity,
                    priority=priority,
                    suggestion_type="low_stock",
                    estimated_delivery_days=lead_days,
                    suggested_order_date=order_dt,
                    supplier_id=supplier_id,
                    supplier_name=supplier_name,
                    alert_id=alert.id,
                    related_demand_id=None,
                    related_demand_code=None,
                    remarks=f"基于库存预警生成：{alert.alert_message or ''}".strip(),
                    created_by=created_by,
                    created_by_name=user_info.get("name") or None,
                    updated_by=created_by,
                    updated_by_name=user_info.get("name") or None,
                )
                created_items.append(ReplenishmentSuggestionResponse.model_validate(suggestion))

        return ReplenishmentSuggestionGenerateResult(
            items=created_items,
            created=len(created_items),
            skipped_existing=skipped_existing,
            skipped_zero_qty=skipped_zero_qty,
        )

    async def generate_suggestions_from_demand_computation(
        self,
        tenant_id: int,
        demand_computation_id: int,
        *,
        created_by: Optional[int] = None,
    ) -> ReplenishmentSuggestionGenerateResult:
        """从已完成需求计算生成 demand_based 补货建议。"""
        from apps.kuaizhizao.models.demand_computation import DemandComputation
        from apps.kuaizhizao.models.demand_computation_item import DemandComputationItem
        from apps.kuaizhizao.services.inventory_threshold_resolver import material_stock_thresholds
        from apps.kuaizhizao.utils.material_source_helper import SOURCE_TYPE_BUY
        from apps.master_data.models.material import Material

        user_info = await self.get_user_info(created_by) if created_by else {"name": ""}
        created_items: List[ReplenishmentSuggestionResponse] = []
        skipped_existing = 0
        skipped_zero_qty = 0

        async with in_transaction():
            computation = await DemandComputation.get_or_none(
                tenant_id=tenant_id,
                id=demand_computation_id,
            )
            if not computation:
                raise NotFoundError(f"需求计算不存在: {demand_computation_id}")
            if computation.computation_status != "完成":
                raise BusinessLogicError("只能从已完成的需求计算生成补货建议")

            params = computation.computation_params or {}
            if not isinstance(params, dict):
                params = {}
            raw_wh = params.get("warehouse_ids") or params.get("warehouseIds") or []
            warehouse_ids = [int(x) for x in raw_wh if x is not None and str(x).strip() != ""]

            items = await DemandComputationItem.filter(
                tenant_id=tenant_id,
                computation_id=demand_computation_id,
                material_source_type=SOURCE_TYPE_BUY,
            ).all()
            buy_items = [
                i
                for i in items
                if i.suggested_purchase_order_quantity
                and Decimal(str(i.suggested_purchase_order_quantity)) > 0
            ]
            if not buy_items:
                raise BusinessLogicError("需求计算中无建议采购量，无法生成补货建议")

            material_ids = sorted({int(i.material_id) for i in buy_items if i.material_id})
            materials = (
                await Material.filter(tenant_id=tenant_id, id__in=material_ids).all()
                if material_ids
                else []
            )
            material_by_id = {int(m.id): m for m in materials}
            seen_material: set[int] = set()
            default_order_dt = resolve_business_datetime()

            for item in buy_items:
                mid = int(item.material_id)
                if mid in seen_material:
                    continue
                seen_material.add(mid)

                suggested_quantity = Decimal(str(item.suggested_purchase_order_quantity))
                if suggested_quantity <= 0:
                    skipped_zero_qty += 1
                    continue

                warehouse_id, warehouse_name = await self._pick_warehouse_for_material(
                    tenant_id, mid, warehouse_ids
                )
                existing = await ReplenishmentSuggestion.filter(
                    tenant_id=tenant_id,
                    material_id=mid,
                    warehouse_id=warehouse_id,
                    status="pending",
                    deleted_at__isnull=True,
                ).first()
                if existing:
                    skipped_existing += 1
                    continue

                material = material_by_id.get(mid)
                safety, max_stock = material_stock_thresholds(material) if material else (None, None)
                current_quantity = await self._get_warehouse_available_qty(
                    tenant_id, mid, warehouse_id
                )
                supplier_id, supplier_name, lead_days, _price = await self._resolve_supplier_and_lead(
                    tenant_id, mid
                )

                order_dt = default_order_dt
                if item.procurement_start_date:
                    order_dt = datetime.combine(item.procurement_start_date, datetime.min.time())
                    # 保持 aware：用业务时刻同日墙钟
                    site_today = to_site_date(resolve_business_datetime())
                    if item.procurement_start_date == site_today:
                        order_dt = resolve_business_datetime()
                    else:
                        # 用 resolve 的时区偏移拼到该日中午，避免 naive
                        base = resolve_business_datetime()
                        order_dt = base.replace(
                            year=item.procurement_start_date.year,
                            month=item.procurement_start_date.month,
                            day=item.procurement_start_date.day,
                            hour=12,
                            minute=0,
                            second=0,
                            microsecond=0,
                        )

                material_code = str(item.material_code or getattr(material, "main_code", None) or "").strip()
                material_name = str(item.material_name or getattr(material, "name", None) or "").strip()

                suggestion = await ReplenishmentSuggestion.create(
                    tenant_id=tenant_id,
                    uuid=str(uuid.uuid4()),
                    material_id=mid,
                    material_code=material_code or f"M{mid}",
                    material_name=material_name or material_code or f"物料{mid}",
                    warehouse_id=warehouse_id,
                    warehouse_name=warehouse_name,
                    current_quantity=current_quantity,
                    safety_stock=safety,
                    min_stock=safety,
                    max_stock=max_stock,
                    suggested_quantity=suggested_quantity,
                    priority=_priority_from_stock(current_quantity, safety),
                    suggestion_type="demand_based",
                    estimated_delivery_days=lead_days,
                    suggested_order_date=order_dt,
                    supplier_id=supplier_id,
                    supplier_name=supplier_name,
                    alert_id=None,
                    related_demand_id=computation.id,
                    related_demand_code=computation.computation_code,
                    remarks=f"基于需求计算 {computation.computation_code} 生成",
                    created_by=created_by,
                    created_by_name=user_info.get("name") or None,
                    updated_by=created_by,
                    updated_by_name=user_info.get("name") or None,
                )
                created_items.append(ReplenishmentSuggestionResponse.model_validate(suggestion))

        return ReplenishmentSuggestionGenerateResult(
            items=created_items,
            created=len(created_items),
            skipped_existing=skipped_existing,
            skipped_zero_qty=skipped_zero_qty,
        )

    async def get_suggestions(
        self,
        tenant_id: int,
        skip: int = 0,
        limit: int = 100,
        status: Optional[str] = None,
        priority: Optional[str] = None,
        suggestion_type: Optional[str] = None,
        material_id: Optional[int] = None,
        warehouse_id: Optional[int] = None,
        keyword: Optional[str] = None,
        order_by: Optional[str] = None,
        suggested_order_start_date: Optional[str] = None,
        suggested_order_end_date: Optional[str] = None,
        created_start_date: Optional[str] = None,
        created_end_date: Optional[str] = None,
        updated_start_date: Optional[str] = None,
        updated_end_date: Optional[str] = None,
    ) -> Tuple[List[ReplenishmentSuggestionListResponse], int]:
        query = ReplenishmentSuggestion.filter(
            tenant_id=tenant_id,
            deleted_at__isnull=True,
        )

        if status:
            query = query.filter(status=status)
        if priority:
            query = query.filter(priority=priority)
        if suggestion_type:
            query = query.filter(suggestion_type=suggestion_type)
        if material_id:
            query = query.filter(material_id=material_id)
        if warehouse_id:
            query = query.filter(warehouse_id=warehouse_id)

        from apps.kuaizhizao.services.warehouse_list_core import (
            REPLENISHMENT_SUGGESTION_KEYWORD_FIELDS,
            REPLENISHMENT_SUGGESTION_SORTABLE_FIELDS,
            apply_warehouse_doc_list_filters,
        )

        query, order_clause = apply_warehouse_doc_list_filters(
            query,
            keyword=keyword,
            order_by=order_by,
            allowed_fields=REPLENISHMENT_SUGGESTION_SORTABLE_FIELDS,
            default_order="-created_at",
            keyword_fields=REPLENISHMENT_SUGGESTION_KEYWORD_FIELDS,
            doc_date_field="suggested_order_date",
            doc_start_date=suggested_order_start_date,
            doc_end_date=suggested_order_end_date,
            created_start_date=created_start_date,
            created_end_date=created_end_date,
            updated_start_date=updated_start_date,
            updated_end_date=updated_end_date,
        )

        total = await query.count()
        suggestions = await query.order_by(order_clause).offset(skip).limit(limit)

        require_pr = await self._require_purchase_requisition(tenant_id)
        from apps.kuaizhizao.services.document_action_policy.enricher import (
            enrich_replenishment_suggestion_list_capabilities,
        )

        responses = [
            ReplenishmentSuggestionListResponse.model_validate(suggestion) for suggestion in suggestions
        ]
        return (
            enrich_replenishment_suggestion_list_capabilities(
                suggestions,
                responses,
                require_purchase_requisition=require_pr,
            ),
            total,
        )

    async def get_suggestion_by_id(
        self,
        tenant_id: int,
        suggestion_id: int,
    ) -> ReplenishmentSuggestionResponse:
        suggestion = await ReplenishmentSuggestion.get_or_none(
            id=suggestion_id,
            tenant_id=tenant_id,
            deleted_at__isnull=True,
        )
        if not suggestion:
            raise NotFoundError(f"补货建议不存在: {suggestion_id}")
        require_pr = await self._require_purchase_requisition(tenant_id)
        return self._enrich_response(suggestion, require_purchase_requisition=require_pr)

    async def process_suggestion(
        self,
        tenant_id: int,
        suggestion_id: int,
        process_data: ReplenishmentSuggestionProcessRequest,
        processed_by: int,
    ) -> ReplenishmentSuggestionResponse:
        async with in_transaction():
            suggestion = await ReplenishmentSuggestion.get_or_none(
                id=suggestion_id,
                tenant_id=tenant_id,
                deleted_at__isnull=True,
            )
            if not suggestion:
                raise NotFoundError(f"补货建议不存在: {suggestion_id}")

            from apps.kuaizhizao.services.document_action_policy.replenishment_suggestion import (
                assert_replenishment_suggestion_capability,
            )

            action = "process" if process_data.status == "processed" else "ignore"
            assert_replenishment_suggestion_capability(suggestion, action)

            user_info = await self.get_user_info(processed_by)
            suggestion.status = process_data.status
            suggestion.processed_by = processed_by
            suggestion.processed_by_name = user_info["name"]
            suggestion.processed_at = resolve_business_datetime()
            suggestion.processing_notes = process_data.processing_notes
            suggestion.updated_by = processed_by
            suggestion.updated_by_name = user_info["name"]
            await suggestion.save()

            require_pr = await self._require_purchase_requisition(tenant_id)
            return self._enrich_response(suggestion, require_purchase_requisition=require_pr)

    async def _load_pending_suggestions(
        self,
        tenant_id: int,
        suggestion_ids: List[int],
    ) -> List[ReplenishmentSuggestion]:
        if not suggestion_ids:
            raise ValidationError("请选择补货建议")
        suggestions = await ReplenishmentSuggestion.filter(
            tenant_id=tenant_id,
            id__in=suggestion_ids,
            deleted_at__isnull=True,
        ).all()
        by_id = {int(s.id): s for s in suggestions}
        ordered: List[ReplenishmentSuggestion] = []
        missing = []
        for sid in suggestion_ids:
            row = by_id.get(int(sid))
            if row is None:
                missing.append(sid)
            else:
                ordered.append(row)
        if missing:
            raise NotFoundError(f"补货建议不存在: {missing[0]}")
        return ordered

    def _required_date_for_suggestion(self, suggestion: ReplenishmentSuggestion) -> date:
        base = (
            to_site_date(suggestion.suggested_order_date)
            if suggestion.suggested_order_date
            else to_site_date(resolve_business_datetime())
        )
        lead = int(suggestion.estimated_delivery_days or 0)
        if lead > 0:
            return base + timedelta(days=lead)
        return base

    async def preview_push_to_purchase_requisition(
        self,
        tenant_id: int,
        suggestion_ids: List[int],
    ) -> Dict[str, Any]:
        suggestions = await self._load_pending_suggestions(tenant_id, suggestion_ids)
        require_pr = await self._require_purchase_requisition(tenant_id)
        items = []
        has_blocking = False
        blocking_reason = None
        for s in suggestions:
            from apps.kuaizhizao.services.document_action_policy.replenishment_suggestion import (
                derive_replenishment_suggestion_capabilities,
            )

            caps = derive_replenishment_suggestion_capabilities(
                s, require_purchase_requisition=require_pr
            )
            issues = []
            if not caps.push_purchase_requisition.allowed:
                issues.append(caps.push_purchase_requisition.reason or "不可下推")
                has_blocking = True
            if not s.supplier_id:
                issues.append("未配置默认供应商")
            items.append(
                {
                    "suggestion_id": s.id,
                    "material_code": s.material_code,
                    "material_name": s.material_name,
                    "quantity": float(s.suggested_quantity or 0),
                    "supplier_id": s.supplier_id,
                    "supplier_name": s.supplier_name,
                    "required_date": self._required_date_for_suggestion(s).isoformat(),
                    "issues": issues,
                }
            )
        if has_blocking and not blocking_reason:
            blocking_reason = "存在不可下推的补货建议"
        return {
            "items": items,
            "has_blocking_issues": has_blocking,
            "blocking_reason": blocking_reason,
            "summary": {"count": len(items)},
            "tip": "将合并生成一张采购申请",
        }

    async def preview_push_to_purchase_order(
        self,
        tenant_id: int,
        suggestion_ids: List[int],
    ) -> Dict[str, Any]:
        suggestions = await self._load_pending_suggestions(tenant_id, suggestion_ids)
        require_pr = await self._require_purchase_requisition(tenant_id)
        if require_pr:
            return {
                "items": [],
                "has_blocking_issues": True,
                "blocking_reason": "当前组织要求先采购申请后下单，请下推采购申请",
                "summary": {"count": 0},
                "tip": None,
            }
        items = []
        has_blocking = False
        for s in suggestions:
            from apps.kuaizhizao.services.document_action_policy.replenishment_suggestion import (
                derive_replenishment_suggestion_capabilities,
            )

            caps = derive_replenishment_suggestion_capabilities(
                s, require_purchase_requisition=require_pr
            )
            issues = []
            if not caps.push_purchase_order.allowed:
                issues.append(caps.push_purchase_order.reason or "不可下推")
                has_blocking = True
            if not s.supplier_id:
                issues.append("缺少供应商，无法下推采购订单")
                has_blocking = True
            items.append(
                {
                    "suggestion_id": s.id,
                    "material_code": s.material_code,
                    "material_name": s.material_name,
                    "quantity": float(s.suggested_quantity or 0),
                    "supplier_id": s.supplier_id,
                    "supplier_name": s.supplier_name,
                    "required_date": self._required_date_for_suggestion(s).isoformat(),
                    "issues": issues,
                }
            )
        return {
            "items": items,
            "has_blocking_issues": has_blocking,
            "blocking_reason": "存在不可下推的补货建议" if has_blocking else None,
            "summary": {"count": len(items)},
            "tip": "将按供应商分组生成采购订单",
        }

    async def _mark_suggestions_processed(
        self,
        suggestions: List[ReplenishmentSuggestion],
        processed_by: int,
        notes: str,
    ) -> None:
        user_info = await self.get_user_info(processed_by)
        now = resolve_business_datetime()
        for suggestion in suggestions:
            suggestion.status = "processed"
            suggestion.processed_by = processed_by
            suggestion.processed_by_name = user_info["name"]
            suggestion.processed_at = now
            suggestion.processing_notes = notes
            suggestion.updated_by = processed_by
            suggestion.updated_by_name = user_info["name"]
            await suggestion.save()

    async def push_to_purchase_requisition(
        self,
        tenant_id: int,
        suggestion_ids: List[int],
        created_by: int,
    ) -> Dict[str, Any]:
        from apps.kuaizhizao.schemas.document_relation import DocumentRelationCreate
        from apps.kuaizhizao.schemas.purchase_requisition import (
            PurchaseRequisitionCreate,
            PurchaseRequisitionItemCreate,
        )
        from apps.kuaizhizao.services.document_action_policy.replenishment_suggestion import (
            assert_replenishment_suggestion_capability,
        )
        from apps.kuaizhizao.services.document_relation_new_service import DocumentRelationNewService
        from apps.kuaizhizao.services.purchase_requisition_service import PurchaseRequisitionService

        from apps.master_data.models.material import Material

        suggestions = await self._load_pending_suggestions(tenant_id, suggestion_ids)
        require_pr = await self._require_purchase_requisition(tenant_id)
        for s in suggestions:
            assert_replenishment_suggestion_capability(
                s,
                "push_purchase_requisition",
                require_purchase_requisition=require_pr,
            )

        material_ids = sorted({int(s.material_id) for s in suggestions})
        materials = await Material.filter(tenant_id=tenant_id, id__in=material_ids).all()
        unit_by_material = {int(m.id): m.base_unit for m in materials}

        req_items = []
        for s in suggestions:
            _, _, _, price = await self._resolve_supplier_and_lead(tenant_id, int(s.material_id))
            req_items.append(
                PurchaseRequisitionItemCreate(
                    material_id=int(s.material_id),
                    material_code=s.material_code,
                    material_name=s.material_name,
                    unit=unit_by_material.get(int(s.material_id)),
                    quantity=Decimal(str(s.suggested_quantity)),
                    suggested_unit_price=price or Decimal(0),
                    required_date=self._required_date_for_suggestion(s),
                    supplier_id=s.supplier_id,
                    notes=f"补货建议#{s.id}",
                )
            )
        required_dates = [self._required_date_for_suggestion(s) for s in suggestions]
        source_code = f"RS-{suggestions[0].id}"
        if len(suggestions) > 1:
            source_code = f"RS-{suggestions[0].id}+{len(suggestions) - 1}"

        async with in_transaction():
            req = await PurchaseRequisitionService().create_requisition(
                tenant_id=tenant_id,
                data=PurchaseRequisitionCreate(
                    required_date=min(required_dates) if required_dates else None,
                    source_type="ReplenishmentSuggestion",
                    source_id=int(suggestions[0].id),
                    source_code=source_code,
                    notes="由补货建议下推生成",
                    items=req_items,
                ),
                created_by=created_by,
            )
            relation_service = DocumentRelationNewService()
            for s in suggestions:
                await relation_service.create_relation(
                    tenant_id=tenant_id,
                    relation_data=DocumentRelationCreate(
                        source_type="replenishment_suggestion",
                        source_id=int(s.id),
                        source_code=str(s.id),
                        source_name=s.material_name,
                        target_type="purchase_requisition",
                        target_id=req.id,
                        target_code=req.requisition_code,
                        target_name=req.requisition_name,
                        relation_type="source",
                        relation_mode="push",
                        relation_desc="从补货建议下推到采购申请",
                    ),
                    created_by=created_by,
                )
            await self._mark_suggestions_processed(
                suggestions,
                created_by,
                f"已下推采购申请 {req.requisition_code}",
            )

        return {
            "success": True,
            "message": "下推成功，已生成采购申请",
            "target_document": {
                "type": "purchase_requisition",
                "id": req.id,
                "code": req.requisition_code,
            },
        }

    async def push_to_purchase_order(
        self,
        tenant_id: int,
        suggestion_ids: List[int],
        created_by: int,
    ) -> Dict[str, Any]:
        from apps.kuaizhizao.schemas.document_relation import DocumentRelationCreate
        from apps.kuaizhizao.schemas.purchase import PurchaseOrderCreate, PurchaseOrderItemCreate
        from apps.kuaizhizao.services.document_action_policy.replenishment_suggestion import (
            assert_replenishment_suggestion_capability,
        )
        from apps.kuaizhizao.services.document_relation_new_service import DocumentRelationNewService
        from apps.kuaizhizao.services.purchase_service import PurchaseService
        from apps.master_data.models.supplier import Supplier

        require_pr = await self._require_purchase_requisition(tenant_id)
        if require_pr:
            raise BusinessLogicError("当前组织要求先采购申请后下单，请下推采购申请")

        from apps.master_data.models.material import Material

        suggestions = await self._load_pending_suggestions(tenant_id, suggestion_ids)
        for s in suggestions:
            assert_replenishment_suggestion_capability(
                s,
                "push_purchase_order",
                require_purchase_requisition=require_pr,
            )
            if not s.supplier_id:
                raise BusinessLogicError(f"补货建议#{s.id} 缺少供应商，无法下推采购订单")

        material_ids = sorted({int(s.material_id) for s in suggestions})
        materials = await Material.filter(tenant_id=tenant_id, id__in=material_ids).all()
        unit_by_material = {int(m.id): m.base_unit for m in materials}

        by_supplier: Dict[int, List[ReplenishmentSuggestion]] = {}
        for s in suggestions:
            by_supplier.setdefault(int(s.supplier_id), []).append(s)

        purchase_service = PurchaseService()
        relation_service = DocumentRelationNewService()
        target_documents = []
        order_date = to_site_date(resolve_business_datetime())

        async with in_transaction():
            for supplier_id, group in by_supplier.items():
                supplier = await Supplier.get_or_none(tenant_id=tenant_id, id=supplier_id)
                supplier_name = (
                    supplier.name
                    if supplier
                    else (group[0].supplier_name or f"供应商({supplier_id})")
                )
                po_items = []
                for s in group:
                    _, _, _, price = await self._resolve_supplier_and_lead(
                        tenant_id, int(s.material_id)
                    )
                    unit_price = price or Decimal(0)
                    qty = Decimal(str(s.suggested_quantity))
                    required = self._required_date_for_suggestion(s)
                    po_items.append(
                        PurchaseOrderItemCreate(
                            material_id=int(s.material_id),
                            material_code=s.material_code,
                            material_name=s.material_name,
                            ordered_quantity=qty,
                            unit=unit_by_material.get(int(s.material_id)),
                            unit_price=unit_price,
                            total_price=qty * unit_price,
                            required_date=required,
                            source_type="replenishment_suggestion",
                            source_id=int(s.id),
                            notes=f"补货建议#{s.id}",
                        )
                    )
                delivery_date = min(self._required_date_for_suggestion(s) for s in group)
                po = await purchase_service.create_purchase_order(
                    tenant_id=tenant_id,
                    order_data=PurchaseOrderCreate(
                        supplier_id=supplier_id,
                        supplier_name=supplier_name,
                        order_date=order_date,
                        delivery_date=delivery_date,
                        source_type="ReplenishmentSuggestion",
                        source_id=int(group[0].id),
                        notes="由补货建议下推生成",
                        items=po_items,
                    ),
                    created_by=created_by,
                )
                target_documents.append(
                    {"type": "purchase_order", "id": po.id, "code": po.order_code}
                )
                for s in group:
                    await relation_service.create_relation(
                        tenant_id=tenant_id,
                        relation_data=DocumentRelationCreate(
                            source_type="replenishment_suggestion",
                            source_id=int(s.id),
                            source_code=str(s.id),
                            source_name=s.material_name,
                            target_type="purchase_order",
                            target_id=po.id,
                            target_code=po.order_code,
                            target_name=po.order_code,
                            relation_type="source",
                            relation_mode="push",
                            relation_desc="从补货建议下推到采购订单",
                        ),
                        created_by=created_by,
                    )
                await self._mark_suggestions_processed(
                    group,
                    created_by,
                    f"已下推采购订单 {po.order_code}",
                )

        return {
            "success": True,
            "message": f"下推成功，共生成 {len(target_documents)} 张采购订单",
            "target_documents": target_documents,
        }

    async def get_suggestion_statistics(self, tenant_id: int) -> Dict[str, Any]:
        pending_count = await ReplenishmentSuggestion.filter(
            tenant_id=tenant_id,
            status="pending",
            deleted_at__isnull=True,
        ).count()
        high_count = await ReplenishmentSuggestion.filter(
            tenant_id=tenant_id,
            priority="high",
            status="pending",
            deleted_at__isnull=True,
        ).count()
        medium_count = await ReplenishmentSuggestion.filter(
            tenant_id=tenant_id,
            priority="medium",
            status="pending",
            deleted_at__isnull=True,
        ).count()
        low_count = await ReplenishmentSuggestion.filter(
            tenant_id=tenant_id,
            priority="low",
            status="pending",
            deleted_at__isnull=True,
        ).count()
        return {
            "pending_count": pending_count,
            "by_priority": {
                "high": high_count,
                "medium": medium_count,
                "low": low_count,
            },
        }
