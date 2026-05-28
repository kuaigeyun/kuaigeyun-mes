"""
销售订单管理服务模块

提供销售订单相关的业务逻辑处理。
销售订单数据存储于 SalesOrder/SalesOrderItem 表，下推需求计算时生成 Demand（source_type=sales_order）。

Author: Luigi Lu
Date: 2026-01-19
"""

from collections import defaultdict
from typing import List, Optional, Dict, Any
from datetime import datetime, date
from decimal import Decimal, ROUND_HALF_UP
from tortoise.exceptions import IntegrityError
from tortoise.transactions import in_transaction
from loguru import logger

from apps.kuaizhizao.models.sales_order import SalesOrder
from apps.master_data.models.material import Material, BOM
from apps.master_data.models.customer import Customer
from apps.master_data.models.process import ProcessRoute
from apps.kuaizhizao.schemas.quote import QuoteBreakdownResponse, QuoteItemResponse
from apps.kuaizhizao.models.sales_order_item import SalesOrderItem
from apps.kuaizhizao.models.demand import Demand
from apps.kuaizhizao.models.demand_item import DemandItem
from apps.kuaizhizao.models.sales_delivery import SalesDelivery
from apps.kuaizhizao.models.sales_delivery_item import SalesDeliveryItem
from apps.kuaicaiwu.models.receivable import Receivable
from apps.kuaicaiwu.models.invoice import Invoice
from apps.kuaicaiwu.constants.finance_source_types import (
    RECEIVABLE_SOURCE_SALES_DELIVERY,
    RECEIVABLE_SOURCE_SALES_INVOICE,
)
from apps.kuaizhizao.models.shipment_notice import ShipmentNotice
from apps.kuaizhizao.models.shipment_notice_item import ShipmentNoticeItem
from apps.kuaizhizao.models.state_transition import StateTransitionLog
from apps.kuaizhizao.schemas.sales_order import (
    SalesOrderCreate, SalesOrderUpdate, SalesOrderResponse, SalesOrderListResponse,
    SalesOrderItemCreate, SalesOrderItemResponse,
)
from apps.kuaizhizao.constants import (
    DemandStatus,
    ReviewStatus,
    DocumentStatus,
    LEGACY_AUDITED_VALUES,
    REVIEW_STATUS_ALIASES,
    normalize_status,
)
from infra.exceptions.exceptions import NotFoundError, ValidationError, BusinessLogicError
from infra.services.business_config_service import BusinessConfigService


class SalesOrderService:
    """
    销售订单管理服务

    销售订单数据存储于 SalesOrder 表，支持与其他系统对接。
    下推需求计算时由 SalesOrder 生成 Demand（source_type=sales_order, source_id=订单ID），
    不再写入 DocumentRelation(订单→demand)；追溯图由推导直连需求计算。
    """

    def __init__(self):
        self.business_config_service = BusinessConfigService()

    @staticmethod
    def _validate_sales_item_non_negative(
        *,
        required_quantity: Decimal,
        unit_price: Decimal,
        tax_rate: Decimal,
        item_amount: Optional[Decimal],
    ) -> None:
        if required_quantity <= Decimal("0"):
            raise ValidationError("销售订单明细数量必须大于0")
        if unit_price < Decimal("0"):
            raise ValidationError("销售订单明细单价不能为负数")
        if tax_rate < Decimal("0"):
            raise ValidationError("销售订单明细税率不能为负数")
        if item_amount is not None and item_amount < Decimal("0"):
            raise ValidationError("销售订单明细金额不能为负数")

    @staticmethod
    def _validate_sales_order_non_negative(
        *,
        discount_amount: Decimal,
        total_quantity: Optional[Decimal],
        total_amount: Optional[Decimal],
        total_fee_amount: Optional[Decimal],
    ) -> None:
        if discount_amount < Decimal("0"):
            raise ValidationError("销售订单优惠金额不能为负数")
        if total_quantity is not None and total_quantity < Decimal("0"):
            raise ValidationError("销售订单总数量不能为负数")
        if total_amount is not None and total_amount < Decimal("0"):
            raise ValidationError("销售订单总金额不能为负数")
        if total_fee_amount is not None and total_fee_amount < Decimal("0"):
            raise ValidationError("销售订单费用金额不能为负数")

    @staticmethod
    def _money(value: Decimal) -> Decimal:
        return Decimal(str(value or 0)).quantize(Decimal("0.01"))

    @staticmethod
    def _merged_delivery_progress(
        order: SalesOrder,
        items: List[Any],
        shipped_qty: Decimal,
    ) -> float:
        """
        交货进度：订单明细已交货合计 与 「已出库」销售出库单出库数量合计（按订单维度）取较大比例。
        避免确认出库未回写明细时列表/详情进度与生命周期长期为 0。
        """
        total_qty = sum(
            (Decimal(str(getattr(it, "order_quantity", 0) or 0)) for it in items),
            start=Decimal("0"),
        )
        if total_qty <= 0:
            total_qty = Decimal(str(order.total_quantity or 0))
        total_line = sum(
            (Decimal(str(getattr(it, "delivered_quantity", 0) or 0)) for it in items),
            start=Decimal("0"),
        )
        if total_qty <= 0:
            return 0.0
        p_line = float(min(Decimal("100"), (total_line / total_qty) * Decimal("100")))
        ship = Decimal(str(shipped_qty or 0))
        p_ship = float(min(Decimal("100"), (ship / total_qty) * Decimal("100"))) if ship > 0 else 0.0
        return round(max(p_line, p_ship), 1)

    async def _shipped_qty_by_sales_order(
        self,
        tenant_id: int,
        order_ids: List[int],
    ) -> Dict[int, Decimal]:
        """各销售订单下，状态为已出库的销售出库单明细数量之和。"""
        if not order_ids:
            return {}
        shipped = await SalesDelivery.filter(
            tenant_id=tenant_id,
            sales_order_id__in=order_ids,
            deleted_at__isnull=True,
            status="已出库",
        ).values_list("id", "sales_order_id")
        if not shipped:
            return {}
        ship_ids = [row[0] for row in shipped]
        order_for: Dict[int, List[int]] = {}
        for did, oid in shipped:
            order_for.setdefault(int(oid), []).append(int(did))

        item_rows = await SalesDeliveryItem.filter(
            tenant_id=tenant_id,
            delivery_id__in=ship_ids,
        ).values_list("delivery_id", "delivery_quantity")
        qty_by_did: Dict[int, Decimal] = {}
        for did, q in item_rows:
            qty_by_did[int(did)] = qty_by_did.get(int(did), Decimal("0")) + Decimal(str(q or 0))

        out: Dict[int, Decimal] = {}
        for oid, dids in order_for.items():
            out[oid] = sum((qty_by_did.get(d, Decimal("0")) for d in dids), start=Decimal("0"))
        return out

    _EXCLUDED_SALES_INVOICE_STATUSES = ("已作废", "已红冲")

    async def _batch_finance_progress_by_order(
        self,
        tenant_id: int,
        orders: List[SalesOrder],
        order_to_delivery_ids: Dict[int, List[int]],
    ) -> Dict[int, Dict[str, float]]:
        """
        批量计算销售订单账款/发票进度（0-100）。
        - invoice_amount_progress：销项发票（或应收立账）相对订单金额的覆盖度
        - collection_progress：已收款相对订单金额
        - invoice_progress：二者较小值，开票与收款均完成时为 100
        """
        if not orders:
            return {}

        code_to_order_id: Dict[str, int] = {}
        for order in orders:
            code = str(order.order_code or "").strip()
            if code:
                code_to_order_id[code] = int(order.id)

        invoiced_by_order: Dict[int, Decimal] = defaultdict(lambda: Decimal("0"))
        received_by_order: Dict[int, Decimal] = defaultdict(lambda: Decimal("0"))
        receivable_total_by_order: Dict[int, Decimal] = defaultdict(lambda: Decimal("0"))

        if code_to_order_id:
            invoice_rows = await Invoice.filter(
                tenant_id=tenant_id,
                category="OUT",
                source_document_code__in=list(code_to_order_id.keys()),
            ).exclude(status__in=self._EXCLUDED_SALES_INVOICE_STATUSES).values_list(
                "id", "source_document_code", "total_amount"
            )
            invoice_id_to_order: Dict[int, int] = {}
            for invoice_id, source_code, total_amount in invoice_rows:
                oid = code_to_order_id.get(str(source_code or "").strip())
                if not oid:
                    continue
                invoice_id_to_order[int(invoice_id)] = oid
                invoiced_by_order[oid] += Decimal(str(total_amount or 0))

            if invoice_id_to_order:
                recv_from_invoice = await Receivable.filter(
                    tenant_id=tenant_id,
                    source_type=RECEIVABLE_SOURCE_SALES_INVOICE,
                    source_id__in=list(invoice_id_to_order.keys()),
                    deleted_at__isnull=True,
                ).values_list("source_id", "received_amount")
                for source_id, received_amount in recv_from_invoice:
                    oid = invoice_id_to_order.get(int(source_id))
                    if oid:
                        received_by_order[oid] += Decimal(str(received_amount or 0))

        delivery_to_order: Dict[int, int] = {}
        all_delivery_ids: List[int] = []
        for oid, dids in order_to_delivery_ids.items():
            for did in dids:
                delivery_to_order[int(did)] = int(oid)
                all_delivery_ids.append(int(did))

        if all_delivery_ids:
            recv_from_delivery = await Receivable.filter(
                tenant_id=tenant_id,
                source_type=RECEIVABLE_SOURCE_SALES_DELIVERY,
                source_id__in=all_delivery_ids,
                deleted_at__isnull=True,
            ).values_list(
                "source_id", "total_amount", "received_amount"
            )
            for source_id, total_amount, received_amount in recv_from_delivery:
                oid = delivery_to_order.get(int(source_id))
                if not oid:
                    continue
                total = Decimal(str(total_amount or 0))
                received = Decimal(str(received_amount or 0))
                receivable_total_by_order[oid] += total
                received_by_order[oid] += received

        result: Dict[int, Dict[str, float]] = {}
        for order in orders:
            order_amount = Decimal(str(order.total_amount or 0))
            if order_amount <= 0:
                result[order.id] = {
                    "invoice_progress": 0.0,
                    "invoice_amount_progress": 0.0,
                    "collection_progress": 0.0,
                }
                continue

            invoiced = max(
                invoiced_by_order.get(order.id, Decimal("0")),
                receivable_total_by_order.get(order.id, Decimal("0")),
            )

            received = received_by_order.get(order.id, Decimal("0"))
            invoice_amount_progress = float(
                min(Decimal("100"), (invoiced / order_amount) * Decimal("100"))
            )
            collection_progress = float(
                min(Decimal("100"), (received / order_amount) * Decimal("100"))
            )
            if invoice_amount_progress <= 0 and collection_progress <= 0:
                invoice_progress = 0.0
            elif invoice_amount_progress >= 100 and collection_progress >= 100:
                invoice_progress = 100.0
            else:
                invoice_progress = float(min(invoice_amount_progress, collection_progress))

            result[order.id] = {
                "invoice_progress": round(invoice_progress, 1),
                "invoice_amount_progress": round(invoice_amount_progress, 1),
                "collection_progress": round(collection_progress, 1),
            }
        return result

    async def _batch_shippable_by_order(
        self,
        tenant_id: int,
        order_ids: List[int],
    ) -> Dict[int, Dict[str, Any]]:
        """
        批量判断销售订单是否存在可发货产品（库存可用且仍有欠交数量）。
        口径与发货通知校验一致：扣除「已通知」占用后再与仓内可用库存比较。
        """
        if not order_ids:
            return {}

        from apps.kuaizhizao.utils.inventory_helper import batch_get_material_inventory

        item_rows = await SalesOrderItem.filter(
            tenant_id=tenant_id,
            sales_order_id__in=order_ids,
        ).values("id", "sales_order_id", "material_id", "order_quantity", "delivered_quantity", "remaining_quantity")

        material_ids: set[int] = set()
        items_by_order: Dict[int, List[Dict[str, Any]]] = defaultdict(list)
        for row in item_rows:
            mid = int(row.get("material_id") or 0)
            if mid <= 0:
                continue
            material_ids.add(mid)
            items_by_order[int(row["sales_order_id"])].append(row)

        if not material_ids:
            return {oid: {"has_shippable_products": False, "shippable_quantity": 0.0} for oid in order_ids}

        inventory_map = await batch_get_material_inventory(tenant_id, list(material_ids))

        notice_ids = await ShipmentNotice.filter(
            tenant_id=tenant_id,
            status="已通知",
            deleted_at__isnull=True,
        ).values_list("id", flat=True)

        reserved_by_so_item: Dict[int, Decimal] = defaultdict(lambda: Decimal("0"))
        reserved_by_material: Dict[int, Decimal] = defaultdict(lambda: Decimal("0"))
        if notice_ids:
            notice_items = await ShipmentNoticeItem.filter(
                tenant_id=tenant_id,
                notice_id__in=list(notice_ids),
            ).values("sales_order_item_id", "material_id", "notice_quantity")
            for ni in notice_items:
                qty = Decimal(str(ni.get("notice_quantity") or 0))
                if qty <= 0:
                    continue
                so_item_id = ni.get("sales_order_item_id")
                if so_item_id is not None:
                    reserved_by_so_item[int(so_item_id)] += qty
                mid = int(ni.get("material_id") or 0)
                if mid > 0:
                    reserved_by_material[mid] += qty

        result: Dict[int, Dict[str, Any]] = {}
        for oid in order_ids:
            total_shippable = Decimal("0")
            has_shippable = False
            for it in items_by_order.get(oid, []):
                order_qty = Decimal(str(it.get("order_quantity") or 0))
                delivered = Decimal(str(it.get("delivered_quantity") or 0))
                remaining_raw = it.get("remaining_quantity")
                remaining = (
                    Decimal(str(remaining_raw))
                    if remaining_raw is not None
                    else order_qty - delivered
                )
                remaining = max(Decimal("0"), remaining)
                so_item_id = int(it["id"])
                owe = remaining - reserved_by_so_item.get(so_item_id, Decimal("0"))
                owe = max(Decimal("0"), owe)
                if owe <= 0:
                    continue
                mid = int(it["material_id"])
                avail = inventory_map.get(mid, Decimal("0")) - reserved_by_material.get(mid, Decimal("0"))
                avail = max(Decimal("0"), avail)
                shippable = min(owe, avail)
                if shippable > 0:
                    has_shippable = True
                    total_shippable += shippable
            result[oid] = {
                "has_shippable_products": has_shippable,
                "shippable_quantity": float(total_shippable) if has_shippable else 0.0,
            }
        return result

    @classmethod
    def _allocate_total_amount_with_proration(
        cls,
        *,
        source_amounts: List[Decimal],
        target_total: Decimal,
    ) -> List[Decimal]:
        """
        P1-S-004: 整单金额覆盖 + 尾差平摊。
        - 按原始行金额占比分配目标总额
        - 按“最大余数法”分配分币尾差，确保行合计严格等于目标总额
        """
        if not source_amounts:
            return []

        target = cls._money(target_total)
        if target < Decimal("0"):
            target = Decimal("0")
        target_cents = int((target * 100).to_integral_value())

        normalized = [cls._money(max(Decimal("0"), Decimal(str(v or 0)))) for v in source_amounts]
        subtotal = sum(normalized, Decimal("0"))
        if subtotal <= Decimal("0"):
            out = [Decimal("0.00") for _ in normalized]
            out[0] = target
            return out

        raw_cents: List[Decimal] = [
            (Decimal(target_cents) * amt / subtotal) if amt > 0 else Decimal("0")
            for amt in normalized
        ]
        base_cents: List[int] = [int(v) for v in raw_cents]
        residual = target_cents - sum(base_cents)

        # 最大余数优先补分，保证总额守恒且分配尽量公平
        if residual > 0:
            frac_pairs = sorted(
                [(raw_cents[i] - Decimal(base_cents[i]), i) for i in range(len(base_cents))],
                key=lambda x: x[0],
                reverse=True,
            )
            for n in range(residual):
                _, idx = frac_pairs[n % len(frac_pairs)]
                base_cents[idx] += 1

        return [Decimal(c) / Decimal("100") for c in base_cents]

    async def _log_state_transition(
        self,
        tenant_id: int,
        sales_order_id: int,
        from_state: str,
        to_state: str,
        operator_id: int,
        operator_name: str,
        reason: Optional[str] = None,
        reason_extra: Optional[str] = None,
    ) -> None:
        """写入状态流转日志，供单据操作记录展示。表不存在时静默跳过，避免阻塞主流程。"""
        try:
            await StateTransitionLog.create(
                tenant_id=tenant_id,
                entity_type="sales_order",
                entity_id=sales_order_id,
                from_state=from_state,
                to_state=to_state,
                transition_reason=reason,
                transition_comment=reason_extra,
                operator_id=operator_id,
                operator_name=operator_name,
                transition_time=datetime.now(),
            )
        except Exception as e:
            logger.warning("写入状态流转日志失败（表可能未创建），跳过: %s", e)

    def _order_to_response(
        self,
        order: SalesOrder,
        items: Optional[List[SalesOrderItem]] = None,
        demand: Optional[Demand] = None,
        duration_info: Optional[dict] = None,
        delivery_progress: Optional[float] = None,
        invoice_progress: Optional[float] = None,
        invoice_amount_progress: Optional[float] = None,
        collection_progress: Optional[float] = None,
        material_code_fallback: Optional[Dict[int, str]] = None,
        material_fallback: Optional[Dict[int, Dict[str, Any]]] = None,
        milestones: Optional[List[Dict[str, Any]]] = None,
        shippable_hint: Optional[Dict[str, Any]] = None,
    ) -> SalesOrderResponse:
        """将 SalesOrder 转为 SalesOrderResponse"""
        from apps.kuaizhizao.services.document_lifecycle_service import get_sales_order_lifecycle

        lifecycle = get_sales_order_lifecycle(
            order,
            items=items,
            delivery_progress=delivery_progress,
            invoice_progress=invoice_progress,
            invoice_amount_progress=invoice_amount_progress,
            collection_progress=collection_progress,
            pushed_to_computation=bool(demand and getattr(demand, "pushed_to_computation", False)),
            milestones=milestones,
        )
        base = {
            "id": order.id,
            "uuid": str(order.uuid),
            "tenant_id": order.tenant_id,
            "order_code": order.order_code,
            "order_name": getattr(order, "order_name", None) or order.order_code,
            "order_date": order.order_date,
            "delivery_date": order.delivery_date,
            "customer_id": order.customer_id,
            "customer_name": order.customer_name,
            "customer_contact": order.customer_contact,
            "customer_phone": order.customer_phone,
            "total_quantity": order.total_quantity if order.total_quantity is not None else Decimal("0"),
            "total_amount": order.total_amount if order.total_amount is not None else Decimal("0"),
            "price_type": getattr(order, "price_type", None) or "tax_exclusive",
            "discount_amount": getattr(order, "discount_amount", None) or Decimal("0"),
            "status": order.status,
            "submit_time": getattr(order, "submit_time", None),
            "reviewer_id": getattr(order, "reviewer_id", None),
            "reviewer_name": getattr(order, "reviewer_name", None),
            "review_time": getattr(order, "review_time", None),
            "review_status": order.review_status,
            "review_remarks": getattr(order, "review_remarks", None),
            "salesman_id": getattr(order, "salesman_id", None),
            "salesman_name": getattr(order, "salesman_name", None),
            "shipping_address": order.shipping_address,
            "shipping_method": order.shipping_method,
            "payment_terms": order.payment_terms,
            "currency_code": getattr(order, "currency_code", None) or "CNY",
            "notes": order.notes,
            "attachments": getattr(order, "attachments", None),
            "fee_details": getattr(order, "fee_details", None),
            "total_fee_amount": getattr(order, "total_fee_amount", None) or Decimal("0"),
            "is_active": order.is_active,
            "created_by": order.created_by,
            "updated_by": getattr(order, "updated_by", None),
            "created_at": order.created_at,
            "updated_at": order.updated_at,
        }
        if demand:
            base["pushed_to_computation"] = demand.pushed_to_computation
            base["computation_id"] = demand.computation_id
            base["computation_code"] = demand.computation_code
        else:
            base["pushed_to_computation"] = False
            base["computation_id"] = None
            base["computation_code"] = None
        if duration_info is not None:
            base["duration_info"] = duration_info
        if delivery_progress is not None:
            base["delivery_progress"] = round(delivery_progress, 1)
        if invoice_progress is not None:
            base["invoice_progress"] = round(invoice_progress, 1)
        hint = shippable_hint or {}
        base["has_shippable_products"] = bool(hint.get("has_shippable_products"))
        base["shippable_quantity"] = float(hint.get("shippable_quantity") or 0.0)
        if base["has_shippable_products"]:
            lifecycle = dict(lifecycle)
            lifecycle["current_stage_name"] = "可发货"
            lifecycle["status"] = "success"
            if lifecycle.get("main_stages"):
                lifecycle["main_stages"] = [
                    {**ms, "label": "可发货"}
                    if ms.get("key") == "executing" and ms.get("status") == "active"
                    else ms
                    for ms in lifecycle["main_stages"]
                ]
            if lifecycle.get("sub_stages"):
                lifecycle["sub_stages"] = [
                    {**ss, "label": "可发货", "status": "active"}
                    if ss.get("key") == "shipment_waiting" and ss.get("status") != "done"
                    else ss
                    for ss in lifecycle["sub_stages"]
                ]
            suggestions = list(lifecycle.get("next_step_suggestions") or [])
            ship_tip = "下推发货通知"
            if ship_tip not in suggestions:
                lifecycle["next_step_suggestions"] = [ship_tip] + [
                    s for s in suggestions if "可发货" not in s
                ]
        base["lifecycle"] = lifecycle
        fallback = material_code_fallback or {}
        mat_fallback = material_fallback or {}

        def _material_val(it: SalesOrderItem, attr: str, mat_key: str, max_len: int = 50) -> str:
            """明细有值则用明细，否则从物料表补全"""
            val = getattr(it, attr, None)
            if val is not None and str(val).strip():
                return str(val)[:max_len]
            mf = mat_fallback.get(it.material_id) if it.material_id else None
            if mf and mat_key in mf and mf[mat_key]:
                return str(mf[mat_key])[:max_len]
            if attr == "material_code" and it.material_id and it.material_id in fallback:
                return str(fallback[it.material_id])[:max_len]
            return ""

        if items is not None:
            base["items"] = [
                SalesOrderItemResponse(
                    id=it.id,
                    uuid=str(it.uuid),
                    tenant_id=it.tenant_id,
                    sales_order_id=it.sales_order_id,
                    material_id=it.material_id,
                    material_code=_material_val(it, "material_code", "code"),
                    material_name=_material_val(it, "material_name", "name", 200),
                    material_spec=_material_val(it, "material_spec", "spec", 200),
                    material_unit=_material_val(it, "material_unit", "unit"),
                    required_quantity=it.order_quantity if getattr(it, "order_quantity", None) is not None else Decimal("0"),
                    delivery_date=getattr(it, "delivery_date", date.today()),
                    unit_price=it.unit_price if getattr(it, "unit_price", None) is not None else Decimal("0"),
                    tax_rate=getattr(it, "tax_rate", None) or Decimal("0"),
                    item_amount=it.total_amount if getattr(it, "total_amount", None) is not None else Decimal("0"),
                    notes=it.notes,
                    variant_attributes=getattr(it, "variant_attributes", None),
                    configurable_selections=getattr(it, "configurable_selections", None),
                    delivered_quantity=it.delivered_quantity if getattr(it, "delivered_quantity", None) is not None else Decimal("0"),
                    remaining_quantity=it.remaining_quantity if getattr(it, "remaining_quantity", None) is not None else Decimal("0"),
                    delivery_status=it.delivery_status,
                    work_order_id=getattr(it, "work_order_id", None),
                    work_order_code=getattr(it, "work_order_code", None),
                    created_at=it.created_at if getattr(it, "created_at", None) else datetime.now(),
                    updated_at=it.updated_at if getattr(it, "updated_at", None) else datetime.now(),
                )
                for it in items
            ]
        return SalesOrderResponse(**base)

    async def _get_linked_demand(self, tenant_id: int, sales_order_id: int) -> Optional[Demand]:
        """获取与销售订单关联的 Demand（下推时生成）"""
        return await Demand.get_or_none(
            tenant_id=tenant_id,
            source_type="sales_order",
            source_id=sales_order_id,
            deleted_at__isnull=True,
        )

    async def _is_order_pushed_to_computation(self, tenant_id: int, order: SalesOrder) -> bool:
        """订单是否已下推需求计算（planning 字段或关联 Demand）。"""
        if getattr(order, "planning_pushed_to_computation", False):
            return True
        demand = await self._get_linked_demand(tenant_id, order.id)
        return bool(demand and demand.pushed_to_computation)

    async def _sync_demand_if_exists(self, tenant_id: int, order_id: int, operator_id: int) -> bool:
        """
        历史兼容占位：销售订单不再自动同步到需求池（Demand）。
        仅保留显式「下推需求计算」路径创建/更新计算数据。
        """
        return False

    def _is_audited(self, status: str) -> bool:
        """判断是否已审核（兼容中英文状态）"""
        normalized = normalize_status(status or "")
        return (
            normalized in (DemandStatus.AUDITED.value, DemandStatus.CONFIRMED.value)
            or status in LEGACY_AUDITED_VALUES
        )

    def _normalize_review_status(self, review_status: Optional[str]) -> str:
        raw = (review_status or "").strip()
        if not raw:
            return ""
        return REVIEW_STATUS_ALIASES.get(raw, raw.upper())

    def _is_review_approved(self, review_status: Optional[str]) -> bool:
        """判断 review_status 是否已审核通过（与 document_lifecycle _is_approved 一致）"""
        return self._normalize_review_status(review_status) == ReviewStatus.APPROVED.value

    def _is_review_pending(self, review_status: Optional[str]) -> bool:
        return self._normalize_review_status(review_status) == ReviewStatus.PENDING.value

    def _is_draft(self, status: str) -> bool:
        """判断是否草稿（兼容中英文状态）"""
        return normalize_status(status or "") == DemandStatus.DRAFT.value

    def _is_confirmed(self, status: Optional[str]) -> bool:
        """是否已确认/已生效（提交免审直达，或确认后的状态）"""
        raw = str(status or "").strip()
        normalized = normalize_status(raw)
        return normalized == DemandStatus.CONFIRMED.value or raw in ("已确认", "已生效")

    def _is_strictly_audited_status(self, status: Optional[str]) -> bool:
        """是否已审核（不含已确认/已生效）"""
        if self._is_confirmed(status):
            return False
        raw = str(status or "").strip()
        normalized = normalize_status(raw)
        return normalized == DemandStatus.AUDITED.value or raw in LEGACY_AUDITED_VALUES

    def _can_withdraw_submitted_order(self, order: SalesOrder) -> bool:
        """撤回 = 撤销提交：待审核、已生效（与 lifecycle 展示一致）"""
        if self._is_pending_review_status(order.status) or self._is_confirmed(order.status):
            return True
        try:
            from apps.kuaizhizao.services.document_lifecycle_service import get_sales_order_lifecycle

            lifecycle = get_sales_order_lifecycle(
                order,
                pushed_to_computation=bool(getattr(order, "planning_pushed_to_computation", False)),
            )
            stage = str(lifecycle.get("current_stage_name") or "").strip()
            return stage in ("待审核", "已生效")
        except Exception:
            return False

    def _is_pending_review_status(self, status: Optional[str]) -> bool:
        raw = str(status or "").strip()
        normalized = normalize_status(raw)
        return normalized == DemandStatus.PENDING_REVIEW.value or raw.upper() == "PENDING"

    def _is_rejected_status(self, status: Optional[str]) -> bool:
        return normalize_status(status or "") == DemandStatus.REJECTED.value

    def _is_closed(self, status: Optional[str]) -> bool:
        raw = str(status or "").strip()
        normalized = normalize_status(raw)
        return normalized == DocumentStatus.CLOSED.value or raw in ("已关闭", "CLOSED", "closed")

    def _is_completed_status(self, status: Optional[str]) -> bool:
        raw = str(status or "").strip()
        normalized = normalize_status(raw)
        return normalized == DocumentStatus.COMPLETED.value or raw in ("已完成", "COMPLETED", "FINISHED")

    def _is_cancelled_status(self, status: Optional[str]) -> bool:
        raw = str(status or "").strip()
        normalized = normalize_status(raw)
        return normalized == DocumentStatus.CANCELLED.value or raw in ("已取消", "CANCELLED")

    def _assert_order_executable(self, order: SalesOrder) -> None:
        """已关闭/已取消/已完成的订单不可再下推或继续执行。"""
        if self._is_closed(order.status):
            raise BusinessLogicError("订单已关闭，无法继续执行")
        if self._is_cancelled_status(order.status):
            raise BusinessLogicError("订单已取消，无法继续执行")
        if self._is_completed_status(order.status):
            raise BusinessLogicError("订单已完成，无法继续执行")

    def _validate_can_close_sales_order(self, order: SalesOrder) -> None:
        if self._is_closed(order.status):
            raise BusinessLogicError("订单已关闭")
        if self._is_cancelled_status(order.status):
            raise BusinessLogicError("已取消的订单不能关闭")
        if self._is_completed_status(order.status):
            raise BusinessLogicError("已完成的订单无需关闭")
        if self._is_draft(order.status):
            raise BusinessLogicError("草稿订单请使用删除，不能关闭")
        if self._is_pending_review_status(order.status) and not self._is_review_approved(order.review_status):
            raise BusinessLogicError("待审核订单不能关闭，请先撤回或完成审核")
        if self._is_rejected_status(order.status) or self._normalize_review_status(order.review_status) == ReviewStatus.REJECTED.value:
            raise BusinessLogicError("已驳回订单不能关闭")
        if not self._is_review_approved(order.review_status):
            raise BusinessLogicError("只有已审核通过的订单才能关闭")

    async def _validate_customer_credit_limit_before_release(
        self,
        *,
        tenant_id: int,
        customer_id: Optional[int],
        customer_name: Optional[str],
        order_total_amount: Decimal,
    ) -> None:
        """
        P1-S-012: 信用额度阻断（后端硬拦截）。
        在订单提交/审核前校验：客户未收应收余额 + 当前订单金额 <= 客户信用额度。
        """
        if not customer_id:
            return

        customer = await Customer.get_or_none(
            tenant_id=tenant_id,
            id=customer_id,
            deleted_at__isnull=True,
        )
        if not customer:
            return

        credit_limit = getattr(customer, "credit_limit", None)
        if credit_limit is None:
            return
        credit_limit = Decimal(str(credit_limit))
        if credit_limit <= Decimal("0"):
            return

        outstanding_rows = await Receivable.filter(
            tenant_id=tenant_id,
            customer_id=customer_id,
            deleted_at__isnull=True,
            remaining_amount__gt=0,
        ).values_list("remaining_amount", flat=True)
        current_outstanding = sum((Decimal(str(v or 0)) for v in outstanding_rows), Decimal("0"))
        projected_exposure = current_outstanding + Decimal(str(order_total_amount or 0))

        if projected_exposure > credit_limit:
            display_name = customer_name or getattr(customer, "name", None) or str(customer_id)
            raise BusinessLogicError(
                f"客户 {display_name} 信用额度超限：当前应收{current_outstanding} + 本单{order_total_amount} > 额度{credit_limit}"
            )

    @staticmethod
    def _resolve_material_unit_cost(defaults: Any) -> Decimal:
        """从物料 defaults 提取单位成本（standard_cost -> purchase_price -> moving_average_cost）。"""
        if not isinstance(defaults, dict):
            return Decimal("0")
        for key in ("standard_cost", "purchase_price", "moving_average_cost"):
            raw = defaults.get(key)
            if raw in (None, ""):
                continue
            try:
                return Decimal(str(raw))
            except Exception:
                continue
        return Decimal("0")

    @staticmethod
    def _compute_order_estimated_margin_percent(
        *,
        order_items: List[SalesOrderItem],
        material_cost_map: Dict[int, Decimal],
    ) -> Optional[Decimal]:
        """
        计算订单预估毛利率（%）。
        若收入或可计算成本缺失，返回 None（不触发拦截）。
        """
        total_revenue = Decimal("0")
        total_cost = Decimal("0")
        has_cost_basis = False

        for item in order_items:
            qty = Decimal(str(getattr(item, "order_quantity", 0) or 0))
            revenue = Decimal(str(getattr(item, "total_amount", 0) or 0))
            total_revenue += revenue

            material_id = getattr(item, "material_id", None)
            unit_cost = material_cost_map.get(material_id or 0, Decimal("0"))
            if unit_cost > 0:
                has_cost_basis = True
                total_cost += qty * unit_cost

        if total_revenue <= 0 or not has_cost_basis:
            return None
        return ((total_revenue - total_cost) / total_revenue) * Decimal("100")

    @staticmethod
    def _resolve_material_default_sale_price(defaults: Any) -> Decimal:
        """提取物料默认销售价（兼容 camel/snake 与嵌套 sales 结构）。"""
        if not isinstance(defaults, dict):
            return Decimal("0")

        candidates = [
            defaults.get("defaultSalePrice"),
            defaults.get("default_sale_price"),
        ]
        sales_defaults = defaults.get("sales")
        if isinstance(sales_defaults, dict):
            candidates.extend(
                [
                    sales_defaults.get("defaultSalePrice"),
                    sales_defaults.get("default_sale_price"),
                    sales_defaults.get("standard_price"),
                ]
            )
        for raw in candidates:
            if raw in (None, ""):
                continue
            try:
                val = Decimal(str(raw))
            except Exception:
                continue
            if val > 0:
                return val
        return Decimal("0")

    async def _check_price_deviation_requires_approval(
        self,
        *,
        tenant_id: int,
        sales_order_id: int,
    ) -> tuple[bool, Optional[str]]:
        """
        P1-S-005: 价格偏差触发审批。
        当配置阈值>0 且存在行偏差超过阈值时，强制进入审批流程。
        """
        threshold = await self.business_config_service.get_sales_price_deviation_approval_threshold_percent(tenant_id)
        threshold_pct = Decimal(str(threshold or 0))
        if threshold_pct <= 0:
            return False, None

        order_items = await SalesOrderItem.filter(
            tenant_id=tenant_id,
            sales_order_id=sales_order_id,
        ).all()
        if not order_items:
            return False, None

        material_ids = sorted({it.material_id for it in order_items if getattr(it, "material_id", None)})
        if not material_ids:
            return False, None

        materials = await Material.filter(
            tenant_id=tenant_id,
            id__in=material_ids,
            deleted_at__isnull=True,
        ).all()
        baseline_price_map: Dict[int, Decimal] = {
            m.id: self._resolve_material_default_sale_price(getattr(m, "defaults", None)) for m in materials
        }

        max_deviation = Decimal("0")
        max_label = None
        for item in order_items:
            material_id = getattr(item, "material_id", None)
            if not material_id:
                continue
            baseline = baseline_price_map.get(int(material_id), Decimal("0"))
            if baseline <= 0:
                continue
            price = Decimal(str(getattr(item, "unit_price", 0) or 0))
            deviation = abs(price - baseline) / baseline * Decimal("100")
            if deviation > max_deviation:
                max_deviation = deviation
                max_label = getattr(item, "material_code", None) or getattr(item, "material_name", None) or str(material_id)

        if max_deviation > threshold_pct:
            detail = f"物料 {max_label} 价格偏差 {max_deviation.quantize(Decimal('0.01'))}% 超过阈值 {threshold_pct.quantize(Decimal('0.01'))}%"
            return True, detail
        return False, None

    async def _validate_sales_order_margin_before_release(
        self,
        *,
        tenant_id: int,
        sales_order_id: int,
        order_code: Optional[str],
    ) -> None:
        """
        P1-S-008: 成本联动与低毛利预警（后端硬拦截）。
        当配置了低毛利阈值时，在提交/审核前校验订单预估毛利率。
        """
        threshold = await self.business_config_service.get_sales_low_margin_threshold_percent(tenant_id)
        threshold_pct = Decimal(str(threshold or 0))
        if threshold_pct <= 0:
            return

        order_items = await SalesOrderItem.filter(
            tenant_id=tenant_id,
            sales_order_id=sales_order_id,
        ).all()
        if not order_items:
            return

        material_ids = sorted({it.material_id for it in order_items if getattr(it, "material_id", None)})
        if not material_ids:
            return

        materials = await Material.filter(
            tenant_id=tenant_id,
            id__in=material_ids,
            deleted_at__isnull=True,
        ).all()
        material_cost_map: Dict[int, Decimal] = {
            m.id: self._resolve_material_unit_cost(getattr(m, "defaults", None)) for m in materials
        }

        margin_pct = self._compute_order_estimated_margin_percent(
            order_items=order_items,
            material_cost_map=material_cost_map,
        )
        if margin_pct is None:
            return

        if margin_pct < threshold_pct:
            code = order_code or str(sales_order_id)
            raise BusinessLogicError(
                f"销售订单 {code} 预估毛利率 {margin_pct.quantize(Decimal('0.01'))}% 低于阈值 {threshold_pct.quantize(Decimal('0.01'))}%"
            )

    async def _generate_order_code(self, tenant_id: int, order_date: Optional[date]) -> str:
        """生成销售订单编码"""
        from core.config.code_rule_pages import CODE_RULE_PAGES
        from core.services.business.code_generation_service import CodeGenerationService

        rule_code = next(
            (p.get("rule_code") for p in CODE_RULE_PAGES if p.get("page_code") == "kuaizhizao-sales-order"),
            None,
        )
        context = {}
        if order_date:
            context["order_date"] = (
                order_date.isoformat()
                if hasattr(order_date, "isoformat")
                else str(order_date)
            )
        if rule_code:
            try:
                return await CodeGenerationService.generate_code(
                    tenant_id=tenant_id,
                    rule_code=rule_code,
                    context=context or None,
                )
            except Exception as e:
                logger.warning("编码规则生成失败，使用备用格式: %s", e)
        today = datetime.now().strftime("%Y%m%d")
        import uuid
        return f"SO-{today}-{uuid.uuid4().hex[:6].upper()}"

    async def create_sales_order(
        self,
        tenant_id: int,
        sales_order_data: SalesOrderCreate,
        created_by: int,
    ) -> SalesOrderResponse:
        """创建销售订单"""
        is_enabled = await self.business_config_service.check_node_enabled(tenant_id, "sales_order")
        if not is_enabled:
            raise BusinessLogicError("销售管理模块未启用，无法创建销售订单")

        if not sales_order_data.order_code:
            sales_order_data.order_code = await self._generate_order_code(
                tenant_id, sales_order_data.order_date
            )

        try:
            return await self._create_sales_order_in_tx(
                tenant_id=tenant_id,
                sales_order_data=sales_order_data,
                created_by=created_by,
            )
        except IntegrityError:
            sales_order_data.order_code = await self._generate_order_code(
                tenant_id, sales_order_data.order_date
            )
            try:
                return await self._create_sales_order_in_tx(
                    tenant_id=tenant_id,
                    sales_order_data=sales_order_data,
                    created_by=created_by,
                )
            except IntegrityError as e:
                raise ValidationError("销售订单编码已存在，请关闭弹窗后重新新建") from e

    async def _create_sales_order_in_tx(
        self,
        tenant_id: int,
        sales_order_data: SalesOrderCreate,
        created_by: int,
    ) -> SalesOrderResponse:
        """创建销售订单（事务内）。"""
        async with in_transaction():
            self._validate_sales_order_non_negative(
                discount_amount=getattr(sales_order_data, "discount_amount", Decimal("0")) or Decimal("0"),
                total_quantity=getattr(sales_order_data, "total_quantity", None),
                total_amount=getattr(sales_order_data, "total_amount", None),
                total_fee_amount=getattr(sales_order_data, "total_fee_amount", None),
            )
            order_dict = sales_order_data.model_dump(exclude={"items", "order_name"})
            order_dict["status"] = sales_order_data.status
            order_dict["review_status"] = sales_order_data.review_status
            order_dict["created_by"] = created_by
            order_dict["updated_by"] = created_by

            # 自动带出归属业务员
            if not order_dict.get("salesman_id") and order_dict.get("customer_id"):
                from apps.master_data.models.customer import Customer
                customer = await Customer.get_or_none(id=order_dict["customer_id"], deleted_at__isnull=True)
                if customer and customer.salesman_id:
                    order_dict["salesman_id"] = customer.salesman_id
                    order_dict["salesman_name"] = customer.salesman_name


            order = await SalesOrder.create(tenant_id=tenant_id, **order_dict)

            total_qty = Decimal("0")
            subtotal = Decimal("0")
            item_rows: List[Dict[str, Any]] = []
            for item_data in sales_order_data.items:
                req_qty = item_data.required_quantity
                unit_pr = item_data.unit_price or Decimal("0")
                tax_r = item_data.tax_rate or Decimal("0")
                self._validate_sales_item_non_negative(
                    required_quantity=req_qty,
                    unit_price=unit_pr,
                    tax_rate=tax_r,
                    item_amount=item_data.item_amount,
                )
                # 未税金额 = 数量×单价，价税合计 = 未税金额×(1+税率/100)
                excl_amt = req_qty * unit_pr
                item_amt = item_data.item_amount if item_data.item_amount is not None else (excl_amt * (Decimal("1") + tax_r / Decimal("100")))
                item_amt = self._money(item_amt)
                total_qty += req_qty
                subtotal += item_amt
                item_rows.append({
                    "material_id": item_data.material_id or 0,
                    "material_code": (item_data.material_code or "")[:50],
                    "material_name": (item_data.material_name or "")[:200],
                    "material_spec": (item_data.material_spec or "")[:200] or None,
                    "material_unit": (item_data.material_unit or "")[:20],
                    "order_quantity": req_qty,
                    "delivered_quantity": Decimal("0"),
                    "remaining_quantity": req_qty,
                    "unit_price": unit_pr,
                    "tax_rate": tax_r,
                    "delivery_date": item_data.delivery_date,
                    "delivery_status": "待交货",
                    "variant_attributes": getattr(item_data, "variant_attributes", None),
                    "configurable_selections": getattr(item_data, "configurable_selections", None),
                    "notes": item_data.notes,
                    "_item_amount": item_amt,
                })

            discount = Decimal(str(getattr(sales_order_data, "discount_amount", None) or 0))
            provided_total = getattr(sales_order_data, "total_amount", None)
            target_total = Decimal(str(provided_total)) if provided_total is not None else max(Decimal("0"), subtotal - discount)
            target_total = self._money(target_total)
            allocated_amounts = self._allocate_total_amount_with_proration(
                source_amounts=[row["_item_amount"] for row in item_rows],
                target_total=target_total,
            )
            for idx, row in enumerate(item_rows):
                await SalesOrderItem.create(
                    tenant_id=tenant_id,
                    sales_order_id=order.id,
                    material_id=row["material_id"],
                    material_code=row["material_code"],
                    material_name=row["material_name"],
                    material_spec=row["material_spec"],
                    material_unit=row["material_unit"],
                    order_quantity=row["order_quantity"],
                    delivered_quantity=row["delivered_quantity"],
                    remaining_quantity=row["remaining_quantity"],
                    unit_price=row["unit_price"],
                    tax_rate=row["tax_rate"],
                    total_amount=allocated_amounts[idx],
                    delivery_date=row["delivery_date"],
                    delivery_status=row["delivery_status"],
                    variant_attributes=row["variant_attributes"],
                    configurable_selections=row["configurable_selections"],
                    notes=row["notes"],
                )
            total_amt = sum(allocated_amounts, Decimal("0"))
            await SalesOrder.filter(id=order.id).update(
                total_quantity=total_qty,
                total_amount=total_amt,
            )
            order = await SalesOrder.get(id=order.id)
            items = await SalesOrderItem.filter(
                tenant_id=tenant_id, sales_order_id=order.id
            ).order_by("id")
            demand = await self._get_linked_demand(tenant_id, order.id)
            shipped_by = await self._shipped_qty_by_sales_order(tenant_id, [order.id])
            dp = self._merged_delivery_progress(order, list(items), shipped_by.get(order.id, Decimal("0")))
            return self._order_to_response(order, items=items, demand=demand, delivery_progress=dp)

    async def apply_push_default_mode_after_create(
        self,
        tenant_id: int,
        sales_order_id: int,
        created_by: int,
        push_mode: Optional[str] = None,
    ) -> SalesOrderResponse:
        """
        下推创建销售订单后，按业务自动化「下推默认生成方式」处理：
        - draft: 保持草稿
        - confirm: 自动提交（无审核→已确认，有审核→待审核）
        """
        raw = (push_mode or "").strip().lower()
        if raw not in ("draft", "confirm"):
            raw = await self.business_config_service.get_push_default_mode(tenant_id)
        logger.info(
            "销售订单 {} 下推后处理: push_mode={} resolved={}",
            sales_order_id,
            push_mode,
            raw,
        )
        if raw != "confirm":
            return await self.get_sales_order_by_id(tenant_id, sales_order_id)
        return await self.submit_sales_order(
            tenant_id=tenant_id,
            sales_order_id=sales_order_id,
            submitted_by=created_by,
        )

    async def get_sales_order_by_id(
        self,
        tenant_id: int,
        sales_order_id: int,
        include_items: bool = False,
        include_duration: bool = False,
    ) -> SalesOrderResponse:
        """获取销售订单详情"""
        order = await SalesOrder.get_or_none(
            tenant_id=tenant_id, id=sales_order_id, deleted_at__isnull=True
        )
        if not order:
            raise NotFoundError(f"销售订单不存在: {sales_order_id}")
        # 不同步时自动修复
        if self._is_review_approved(order.review_status) and not self._is_audited(order.status):
            await SalesOrder.filter(tenant_id=tenant_id, id=sales_order_id).update(status=DemandStatus.AUDITED)
            order = await SalesOrder.get(tenant_id=tenant_id, id=sales_order_id)
        elif self._is_audited(order.status) and not self._is_review_approved(order.review_status):
            await SalesOrder.filter(tenant_id=tenant_id, id=sales_order_id).update(review_status=ReviewStatus.APPROVED)
            order = await SalesOrder.get(tenant_id=tenant_id, id=sales_order_id)

        items = None
        material_code_fallback: Dict[int, str] = {}
        material_fallback: Dict[int, Dict[str, Any]] = {}
        if include_items:
            items = await SalesOrderItem.filter(
                tenant_id=tenant_id, sales_order_id=sales_order_id
            ).order_by("id").all()
            # 当明细中物料信息为空时，从物料表补全（兼容历史数据）
            need_fallback = [
                it for it in items
                if it.material_id
                and (
                    not (it.material_code and str(it.material_code).strip())
                    or not (it.material_name and str(it.material_name).strip())
                    or not (it.material_unit and str(it.material_unit).strip())
                )
            ]
            if need_fallback:
                from apps.master_data.models.material import Material
                material_ids = list({it.material_id for it in need_fallback})
                materials = await Material.filter(id__in=material_ids, deleted_at__isnull=True).all()
                for m in materials:
                    material_code_fallback[m.id] = (m.main_code or getattr(m, "code", None) or "")[:50]
                    material_fallback[m.id] = {
                        "code": (m.main_code or getattr(m, "code", None) or "")[:50],
                        "name": (m.name or "")[:200],
                        "spec": (getattr(m, "specification", None) or "")[:200],
                        "unit": (m.base_unit or "")[:20],
                    }

        demand = await self._get_linked_demand(tenant_id, sales_order_id)
        
        # 获取 UniLifecycle 里程碑历史
        from apps.kuaizhizao.services.document_lifecycle_service import get_document_milestones
        milestones = await get_document_milestones(tenant_id, "sales_order", sales_order_id)
        
        duration_info = None
        if include_duration and demand:
            duration_info = getattr(demand, "duration_info", None)

        if items is not None:
            items_for_progress: List[Any] = list(items)
        else:
            agg_rows = await SalesOrderItem.filter(
                tenant_id=tenant_id, sales_order_id=sales_order_id
            ).values_list("order_quantity", "delivered_quantity")
            items_for_progress = [
                type("_AggItem", (), {"order_quantity": q, "delivered_quantity": d})()
                for q, d in agg_rows
            ]
        shipped_by = await self._shipped_qty_by_sales_order(tenant_id, [sales_order_id])
        delivery_progress = self._merged_delivery_progress(
            order, items_for_progress, shipped_by.get(sales_order_id, Decimal("0"))
        )
        shippable_map = (
            await self._batch_shippable_by_order(tenant_id, [sales_order_id])
            if delivery_progress < 100
            else {}
        )

        deliveries = await SalesDelivery.filter(
            tenant_id=tenant_id,
            sales_order_id=sales_order_id,
            deleted_at__isnull=True,
        ).values_list("id", "sales_order_id")
        order_to_deliveries: Dict[int, List[int]] = {sales_order_id: [int(d[0]) for d in deliveries]}
        finance = (
            await self._batch_finance_progress_by_order(tenant_id, [order], order_to_deliveries)
        ).get(sales_order_id, {})

        return self._order_to_response(
            order,
            items=items,
            demand=demand,
            duration_info=duration_info,
            material_code_fallback=material_code_fallback,
            material_fallback=material_fallback,
            milestones=milestones,
            delivery_progress=delivery_progress,
            invoice_progress=finance.get("invoice_progress", 0.0),
            invoice_amount_progress=finance.get("invoice_amount_progress", 0.0),
            collection_progress=finance.get("collection_progress", 0.0),
            shippable_hint=shippable_map.get(sales_order_id),
        )

    async def _filter_orders_by_lifecycle_stage(
        self,
        tenant_id: int,
        orders: List[SalesOrder],
        lifecycle_stage: str,
    ) -> List[SalesOrder]:
        """按后端 lifecycle 计算结果筛选订单（与列表展示阶段一致）。"""
        from apps.kuaizhizao.services.document_lifecycle_service import (
            get_sales_order_lifecycle,
            normalize_sales_order_lifecycle_filter,
        )

        if not orders:
            return []

        target = normalize_sales_order_lifecycle_filter(lifecycle_stage)
        order_ids = [o.id for o in orders]

        demands = await Demand.filter(
            tenant_id=tenant_id,
            source_type="sales_order",
            source_id__in=order_ids,
            deleted_at__isnull=True,
        ).all()
        demand_by_order: Dict[int, Demand] = {d.source_id: d for d in demands}

        all_items = await SalesOrderItem.filter(
            tenant_id=tenant_id,
            sales_order_id__in=order_ids,
        ).all()
        items_by_order: Dict[int, List[SalesOrderItem]] = {}
        for it in all_items:
            items_by_order.setdefault(it.sales_order_id, []).append(it)

        deliveries = await SalesDelivery.filter(
            tenant_id=tenant_id,
            sales_order_id__in=order_ids,
            deleted_at__isnull=True,
        ).values_list("id", "sales_order_id")
        order_to_deliveries: Dict[int, List[int]] = {}
        for did, oid in deliveries:
            order_to_deliveries.setdefault(oid, []).append(did)

        finance_progress_by_order = await self._batch_finance_progress_by_order(
            tenant_id, orders, order_to_deliveries
        )
        shipped_by_order = await self._shipped_qty_by_sales_order(tenant_id, order_ids)

        matched: List[SalesOrder] = []
        for order in orders:
            items = items_by_order.get(order.id) or []
            demand = demand_by_order.get(order.id)
            ship_q = shipped_by_order.get(order.id, Decimal("0"))
            dp = self._merged_delivery_progress(order, items, ship_q)
            finance = finance_progress_by_order.get(order.id, {})
            pushed = bool(demand and getattr(demand, "pushed_to_computation", False)) or bool(
                getattr(order, "planning_pushed_to_computation", False)
            )
            lifecycle = get_sales_order_lifecycle(
                order,
                items=items,
                delivery_progress=dp,
                invoice_progress=finance.get("invoice_progress", 0.0),
                invoice_amount_progress=finance.get("invoice_amount_progress", 0.0),
                collection_progress=finance.get("collection_progress", 0.0),
                pushed_to_computation=pushed,
            )
            stage_name = normalize_sales_order_lifecycle_filter(
                lifecycle.get("current_stage_name"),
            )
            if stage_name == target:
                matched.append(order)
        return matched

    async def list_sales_orders(
        self,
        tenant_id: int,
        skip: int = 0,
        limit: int = 100,
        status: Optional[str] = None,
        review_status: Optional[str] = None,
        lifecycle_stage: Optional[str] = None,
        start_date: Optional[date] = None,
        end_date: Optional[date] = None,
        customer_name: Optional[str] = None,
        order_code: Optional[str] = None,
        keyword: Optional[str] = None,
        order_by: Optional[str] = None,
        include_items: bool = False,
    ) -> SalesOrderListResponse:
        """获取销售订单列表。order_by 如 order_code、-created_at（前缀-表示降序）"""
        from tortoise.expressions import Q

        query = SalesOrder.filter(tenant_id=tenant_id, deleted_at__isnull=True)
        lifecycle_filter = (lifecycle_stage or "").strip()
        if status and not lifecycle_filter:
            query = query.filter(status=status)
        if review_status and not lifecycle_filter:
            query = query.filter(review_status=review_status)
        if start_date:
            query = query.filter(order_date__gte=start_date)
        if end_date:
            query = query.filter(order_date__lte=end_date)
        if customer_name and str(customer_name).strip():
            query = query.filter(customer_name__icontains=customer_name.strip())
        if order_code and str(order_code).strip():
            query = query.filter(order_code__icontains=order_code.strip())
        if keyword and str(keyword).strip():
            kw = keyword.strip()
            query = query.filter(
                Q(order_code__icontains=kw) | Q(customer_name__icontains=kw)
            )
        order_clause = order_by if order_by else "-created_at"

        if lifecycle_filter:
            candidate_orders = await query.order_by(order_clause).all()
            matched_orders = await self._filter_orders_by_lifecycle_stage(
                tenant_id,
                candidate_orders,
                lifecycle_filter,
            )
            total = len(matched_orders)
            orders = matched_orders[skip : skip + limit]
        else:
            total = await query.count()
            orders = await query.offset(skip).limit(limit).order_by(order_clause)

        if not orders:
            return SalesOrderListResponse(data=[], total=total, success=True)

        order_ids = [o.id for o in orders]

        # 1. 批量状态同步（不同步时自动修复）
        need_audit_sync = []
        need_review_sync = []
        for order in orders:
            if self._is_review_approved(order.review_status) and not self._is_audited(order.status):
                need_audit_sync.append(order.id)
            elif self._is_audited(order.status) and not self._is_review_approved(order.review_status):
                need_review_sync.append(order.id)
        if need_audit_sync:
            await SalesOrder.filter(tenant_id=tenant_id, id__in=need_audit_sync).update(status=DemandStatus.AUDITED)
        if need_review_sync:
            await SalesOrder.filter(tenant_id=tenant_id, id__in=need_review_sync).update(review_status=ReviewStatus.APPROVED)
        if need_audit_sync or need_review_sync:
            refetched = await SalesOrder.filter(tenant_id=tenant_id, id__in=order_ids).order_by(order_clause)
            refetched_by_id = {o.id: o for o in refetched}
            # 安全重组订单列表，避免并发删除导致的 KeyError
            orders = [refetched_by_id[oid] for oid in order_ids if oid in refetched_by_id]

        # 2. 批量查询 Demand
        demands = await Demand.filter(
            tenant_id=tenant_id,
            source_type="sales_order",
            source_id__in=order_ids,
            deleted_at__isnull=True,
        ).all()
        demand_by_order: Dict[int, Demand] = {d.source_id: d for d in demands}

        # 3. 批量查询 SalesOrderItem
        items_by_order: Dict[int, List[SalesOrderItem]] = {}
        if include_items:
            all_items = await SalesOrderItem.filter(
                tenant_id=tenant_id,
                sales_order_id__in=order_ids,
            ).order_by("sales_order_id", "id").all()
            for it in all_items:
                items_by_order.setdefault(it.sales_order_id, []).append(it)
        else:
            # 仅需 delivery_progress：批量查询 order_quantity, delivered_quantity
            items_agg_rows = await SalesOrderItem.filter(
                tenant_id=tenant_id,
                sales_order_id__in=order_ids,
            ).values_list("sales_order_id", "order_quantity", "delivered_quantity")
            for oid, qty, delivered in items_agg_rows:
                items_by_order.setdefault(oid, []).append(
                    type("_AggItem", (), {"order_quantity": qty, "delivered_quantity": delivered})()
                )

        # 4. 批量 Material 补全（仅 include_items 时）
        material_code_fallback_all: Dict[int, Dict[int, str]] = {}
        material_fallback_all: Dict[int, Dict[int, Dict[str, Any]]] = {}
        if include_items:
            need_fallback_ids: set = set()
            for oid, items in items_by_order.items():
                for it in items:
                    if it.material_id and (
                        not (getattr(it, "material_code", None) and str(it.material_code).strip())
                        or not (getattr(it, "material_name", None) and str(it.material_name).strip())
                        or not (getattr(it, "material_spec", None) and str(it.material_spec).strip())
                        or not (getattr(it, "material_unit", None) and str(it.material_unit).strip())
                    ):
                        need_fallback_ids.add(it.material_id)
            if need_fallback_ids:
                from apps.master_data.models.material import Material
                materials = await Material.filter(
                    id__in=list(need_fallback_ids), deleted_at__isnull=True
                ).all()
                material_by_id: Dict[int, Any] = {m.id: m for m in materials}
                for oid, items in items_by_order.items():
                    fallback: Dict[int, str] = {}
                    mat_fallback: Dict[int, Dict[str, Any]] = {}
                    for it in items:
                        if not it.material_id or it.material_id not in material_by_id:
                            continue
                        if (
                            not (getattr(it, "material_code", None) and str(it.material_code).strip())
                            or not (getattr(it, "material_name", None) and str(it.material_name).strip())
                            or not (getattr(it, "material_spec", None) and str(it.material_spec).strip())
                            or not (getattr(it, "material_unit", None) and str(it.material_unit).strip())
                        ):
                            m = material_by_id[it.material_id]
                            fallback[m.id] = (m.main_code or getattr(m, "code", None) or "")[:50]
                            mat_fallback[m.id] = {
                                "code": (m.main_code or getattr(m, "code", None) or "")[:50],
                                "name": (m.name or "")[:200],
                                "spec": (getattr(m, "specification", None) or "")[:200],
                                "unit": (m.base_unit or "")[:20],
                            }
                    if fallback:
                        material_code_fallback_all[oid] = fallback
                        material_fallback_all[oid] = mat_fallback

        # 5. 批量计算账款/发票进度
        deliveries = await SalesDelivery.filter(
            tenant_id=tenant_id,
            sales_order_id__in=order_ids,
            deleted_at__isnull=True,
        ).values_list("id", "sales_order_id")
        order_to_deliveries: Dict[int, List[int]] = {}
        for did, oid in deliveries:
            order_to_deliveries.setdefault(oid, []).append(did)

        finance_progress_by_order = await self._batch_finance_progress_by_order(
            tenant_id, orders, order_to_deliveries
        )

        shipped_by_order = await self._shipped_qty_by_sales_order(tenant_id, order_ids)

        eligible_ship_check_ids: List[int] = []
        delivery_progress_by_order: Dict[int, float] = {}
        for order in orders:
            items = items_by_order.get(order.id) or []
            ship_q = shipped_by_order.get(order.id, Decimal("0"))
            dp = self._merged_delivery_progress(order, items, ship_q)
            delivery_progress_by_order[order.id] = dp
            if dp < 100:
                eligible_ship_check_ids.append(order.id)
        shippable_map = await self._batch_shippable_by_order(tenant_id, eligible_ship_check_ids)

        # 6. 组装响应
        sales_orders = []
        for order in orders:
            items = items_by_order.get(order.id) or []
            items_for_response = items if include_items else None

            delivery_progress = delivery_progress_by_order.get(order.id, 0.0)

            finance = finance_progress_by_order.get(order.id, {})
            invoice_progress_val = finance.get("invoice_progress", 0.0)
            invoice_amount_progress_val = finance.get("invoice_amount_progress", 0.0)
            collection_progress_val = finance.get("collection_progress", 0.0)

            sales_orders.append(
                self._order_to_response(
                    order,
                    items=items_for_response,
                    demand=demand_by_order.get(order.id),
                    delivery_progress=delivery_progress,
                    invoice_progress=invoice_progress_val,
                    invoice_amount_progress=invoice_amount_progress_val,
                    collection_progress=collection_progress_val,
                    material_code_fallback=material_code_fallback_all.get(order.id) if include_items else None,
                    material_fallback=material_fallback_all.get(order.id) if include_items else None,
                    shippable_hint=shippable_map.get(order.id),
                )
            )
        return SalesOrderListResponse(data=sales_orders, total=total, success=True)

    async def update_sales_order(
        self,
        tenant_id: int,
        sales_order_id: int,
        sales_order_data: SalesOrderUpdate,
        updated_by: int,
    ) -> SalesOrderResponse:
        """更新销售订单。支持草稿与已审核订单（含反审核后编辑）；已审核订单保存后同步关联需求。"""
        order = await SalesOrder.get_or_none(
            tenant_id=tenant_id, id=sales_order_id, deleted_at__isnull=True
        )
        if not order:
            raise NotFoundError(f"销售订单不存在: {sales_order_id}")
        # 允许草稿或已审核状态更新（已审核时可能为反审核后再编辑，或直接编辑已审核订单）
        if order.status not in (DemandStatus.DRAFT, DemandStatus.AUDITED, DemandStatus.PENDING_REVIEW):
            raise BusinessLogicError(f"只能更新草稿、待审核或已审核的销售订单，当前状态: {order.status}")

        old_values = {
            "order_date": str(order.order_date) if order.order_date else None,
            "delivery_date": str(order.delivery_date) if order.delivery_date else None,
            "customer_name": order.customer_name,
            "customer_contact": order.customer_contact,
            "customer_phone": order.customer_phone,
            "total_quantity": str(order.total_quantity) if order.total_quantity is not None else None,
            "total_amount": str(order.total_amount) if order.total_amount is not None else None,
            "price_type": order.price_type,
            "discount_amount": str(getattr(order, "discount_amount", 0) or 0),
            "salesman_name": order.salesman_name,
            "shipping_address": order.shipping_address,
            "shipping_method": order.shipping_method,
            "payment_terms": order.payment_terms,
            "notes": order.notes,
        }
        items_changed = sales_order_data.items is not None

        async with in_transaction():
            self._validate_sales_order_non_negative(
                discount_amount=getattr(sales_order_data, "discount_amount", Decimal("0")) or Decimal("0"),
                total_quantity=getattr(sales_order_data, "total_quantity", None),
                total_amount=getattr(sales_order_data, "total_amount", None),
                total_fee_amount=getattr(sales_order_data, "total_fee_amount", None),
            )
            upd = sales_order_data.model_dump(exclude_unset=True, exclude={"items"})
            upd["updated_by"] = updated_by
            # status/review_status 由工作流控制，禁止通过 update 修改，确保二者始终同步
            upd.pop("status", None)
            upd.pop("review_status", None)
            if upd:
                await SalesOrder.filter(id=sales_order_id).update(**upd)

            if sales_order_data.items is not None:
                await SalesOrderItem.filter(
                    tenant_id=tenant_id, sales_order_id=sales_order_id
                ).delete()
                total_qty = Decimal("0")
                subtotal = Decimal("0")
                item_rows: List[Dict[str, Any]] = []
                for item_data in sales_order_data.items:
                    req_qty = item_data.required_quantity
                    unit_pr = item_data.unit_price or Decimal("0")
                    tax_r = item_data.tax_rate or Decimal("0")
                    self._validate_sales_item_non_negative(
                        required_quantity=req_qty,
                        unit_price=unit_pr,
                        tax_rate=tax_r,
                        item_amount=item_data.item_amount,
                    )
                    excl_amt = req_qty * unit_pr
                    item_amt = item_data.item_amount if item_data.item_amount is not None else (excl_amt * (Decimal("1") + tax_r / Decimal("100")))
                    item_amt = self._money(item_amt)
                    total_qty += req_qty
                    subtotal += item_amt
                    item_rows.append({
                        "material_id": item_data.material_id or 0,
                        "material_code": (item_data.material_code or "")[:50],
                        "material_name": (item_data.material_name or "")[:200],
                        "material_spec": (item_data.material_spec or "")[:200] or None,
                        "material_unit": (item_data.material_unit or "")[:20],
                        "order_quantity": req_qty,
                        "delivered_quantity": Decimal("0"),
                        "remaining_quantity": req_qty,
                        "unit_price": unit_pr,
                        "tax_rate": tax_r,
                        "delivery_date": item_data.delivery_date,
                        "delivery_status": "待交货",
                        "variant_attributes": getattr(item_data, "variant_attributes", None),
                        "configurable_selections": getattr(item_data, "configurable_selections", None),
                        "notes": item_data.notes,
                        "_item_amount": item_amt,
                    })
                discount = Decimal(str(getattr(sales_order_data, "discount_amount", None) or 0))
                provided_total = getattr(sales_order_data, "total_amount", None)
                target_total = Decimal(str(provided_total)) if provided_total is not None else max(Decimal("0"), subtotal - discount)
                target_total = self._money(target_total)
                allocated_amounts = self._allocate_total_amount_with_proration(
                    source_amounts=[row["_item_amount"] for row in item_rows],
                    target_total=target_total,
                )
                for idx, row in enumerate(item_rows):
                    await SalesOrderItem.create(
                        tenant_id=tenant_id,
                        sales_order_id=sales_order_id,
                        material_id=row["material_id"],
                        material_code=row["material_code"],
                        material_name=row["material_name"],
                        material_spec=row["material_spec"],
                        material_unit=row["material_unit"],
                        order_quantity=row["order_quantity"],
                        delivered_quantity=row["delivered_quantity"],
                        remaining_quantity=row["remaining_quantity"],
                        unit_price=row["unit_price"],
                        tax_rate=row["tax_rate"],
                        total_amount=allocated_amounts[idx],
                        delivery_date=row["delivery_date"],
                        delivery_status=row["delivery_status"],
                        variant_attributes=row["variant_attributes"],
                        configurable_selections=row["configurable_selections"],
                        notes=row["notes"],
                    )
                total_amt = sum(allocated_amounts, Decimal("0"))
                await SalesOrder.filter(id=sales_order_id).update(
                    total_quantity=total_qty,
                    total_amount=total_amt,
                )

        result = await self.get_sales_order_by_id(tenant_id, sales_order_id, include_items=True)
        # 记录编辑操作及变更字段（含修改前后值，供操作记录展示）
        changed_fields = []
        field_changes = []
        field_labels = {
            "order_date": "订单日期", "delivery_date": "交货日期", "customer_name": "客户名称",
            "customer_contact": "客户联系人", "customer_phone": "客户电话",
            "total_quantity": "总数量", "total_amount": "总金额", "price_type": "价格类型",
            "discount_amount": "优惠金额", "salesman_name": "销售员", "shipping_address": "收货地址",
            "shipping_method": "发货方式", "payment_terms": "付款条件", "notes": "备注",
        }
        if upd:
            for k in upd:
                if k in ("updated_by",) or k not in old_values:
                    continue
                old_val = old_values.get(k)
                new_val = upd[k]
                old_str = str(old_val) if old_val is not None else ""
                new_str = str(new_val) if new_val is not None else ""
                if old_str != new_str:
                    label = field_labels.get(k, k)
                    changed_fields.append(label)
                    field_changes.append({
                        "field": k,
                        "label": label,
                        "from": old_str,
                        "to": new_str,
                    })
        if items_changed:
            changed_fields.append("订单明细")
            field_changes.append({"field": "items", "label": "订单明细", "from": "", "to": "已修改"})
        if changed_fields:
            import json as _json
            from apps.common.base_service import AppBaseService
            operator_name = await AppBaseService().get_user_name(updated_by)
            reason_extra = _json.dumps(
                {"changed_fields": changed_fields, "field_changes": field_changes},
                ensure_ascii=False,
            )
            await self._log_state_transition(
                tenant_id, sales_order_id,
                order.status or "DRAFT", order.status or "DRAFT",
                updated_by, operator_name,
                reason="编辑",
                reason_extra=reason_extra,
            )
        # 若是自动审核配置，撤回审核后的订单（当前待审核）编辑保存后自动再次审核
        if self._is_pending_review_status(order.status):
            audit_required = await self.business_config_service.check_audit_required(
                tenant_id, "sales_order"
            )
            force_approval, force_reason = await self._check_price_deviation_requires_approval(
                tenant_id=tenant_id,
                sales_order_id=sales_order_id,
            )
            if force_approval:
                audit_required = True
                logger.info("销售订单 %s 命中价格偏差审批阈值，编辑后保持待审核: %s", sales_order_id, force_reason)
            if not audit_required:
                logger.info("销售订单 %s 为待审核且无需审核，保存后自动通过", sales_order_id)
                return await self.approve_sales_order(tenant_id, sales_order_id, updated_by, is_auto_approve=True)

        # 只要有关联需求，订单任意保存都同步需求内容，使需求管理动态随上游变化（策略 A）
        demand_synced = await self._sync_demand_if_exists(tenant_id, sales_order_id, updated_by)
        # 计划锁定策略：上游变更时，对 draft/submitted 计划标记待重算
        try:
            from apps.kuaizhizao.services.document_relation_service import DocumentRelationService
            doc_svc = DocumentRelationService()
            await doc_svc.apply_upstream_change_impact(tenant_id, "sales_order", sales_order_id)
        except Exception as e:
            logger.warning("apply_upstream_change_impact failed: %s", e)
        delivery_changed = any(
            fc.get("field") == "delivery_date"
            for fc in (field_changes if changed_fields else [])
        ) or (
            upd
            and "delivery_date" in upd
            and str(upd.get("delivery_date")) != str(old_values.get("delivery_date"))
        )
        if delivery_changed or items_changed:
            try:
                from apps.kuaizhizao.models.work_order import WorkOrder
                from apps.kuaizhizao.workflows.functions.work_order_score_workflow import (
                    dispatch_work_order_score_recalc,
                )

                related_wo_ids = await WorkOrder.filter(
                    tenant_id=tenant_id,
                    sales_order_id=sales_order_id,
                    deleted_at__isnull=True,
                ).values_list("id", flat=True)
                for wo_id in related_wo_ids:
                    await dispatch_work_order_score_recalc(int(wo_id), include_kitting=True)
            except Exception as e:
                logger.warning("销售订单 %s 交期变更后工单打分重算投递失败: %s", sales_order_id, e)
        out = result.model_dump()
        out["demand_synced"] = demand_synced
        return SalesOrderResponse(**out)

    async def submit_sales_order(
        self,
        tenant_id: int,
        sales_order_id: int,
        submitted_by: int,
    ) -> SalesOrderResponse:
        """提交销售订单"""
        order = await self.get_sales_order_by_id(tenant_id, sales_order_id)

        # 已审核订单无需重复提交，直接返回（避免编辑流程中 update 已自动审核后，前端再调 submit 产生重复日志）
        if self._is_audited(order.status):
            return await self.get_sales_order_by_id(tenant_id, sales_order_id)

        await self._validate_customer_credit_limit_before_release(
            tenant_id=tenant_id,
            customer_id=order.customer_id,
            customer_name=order.customer_name,
            order_total_amount=Decimal(str(order.total_amount or 0)),
        )
        await self._validate_sales_order_margin_before_release(
            tenant_id=tenant_id,
            sales_order_id=sales_order_id,
            order_code=order.order_code,
        )

        # 蓝图设置 auditRequired=False 时表示自动审核，优先于审批流程
        audit_required = await self.business_config_service.check_audit_required(
            tenant_id, "sales_order"
        )
        force_approval, force_reason = await self._check_price_deviation_requires_approval(
            tenant_id=tenant_id,
            sales_order_id=sales_order_id,
        )
        if force_approval:
            audit_required = True
            logger.info("销售订单 %s 命中价格偏差审批阈值，强制走审批: %s", sales_order_id, force_reason)
        if not audit_required:
            logger.info("销售订单 %s 审核流程关闭，提交后直接进入已确认", sales_order_id)
            from apps.common.base_service import AppBaseService
            submitter_name = await AppBaseService().get_user_name(submitted_by)
            async with in_transaction():
                await SalesOrder.filter(tenant_id=tenant_id, id=sales_order_id).update(
                    status=DemandStatus.CONFIRMED,
                    review_status=ReviewStatus.APPROVED,
                    reviewer_id=submitted_by,
                    reviewer_name=submitter_name,
                    review_time=datetime.now(),
                    updated_by=submitted_by,
                )
                await self._log_state_transition(
                    tenant_id, sales_order_id,
                    DemandStatus.DRAFT, DemandStatus.CONFIRMED,
                    submitted_by, submitter_name, "提交并自动确认",
                )
                # 不再在提交时自动创建/同步 Demand，避免形成「订单→需求计划」隐式链路。
            return await self.get_sales_order_by_id(tenant_id, sales_order_id)

        from core.services.approval.approval_instance_service import ApprovalInstanceService
        instance = await ApprovalInstanceService.start_approval(
            tenant_id=tenant_id,
            user_id=submitted_by,
            process_code="sales_order",
            entity_type="sales_order",
            entity_id=order.id,
            entity_uuid=str(order.uuid),
            title=f"销售订单审批: {order.order_code}",
            content=f"客户: {order.customer_name}, 金额: {order.total_amount}",
        )
        if instance:
            from apps.common.base_service import AppBaseService
            submitter_name = await AppBaseService().get_user_name(submitted_by)
            async with in_transaction():
                await SalesOrder.filter(tenant_id=tenant_id, id=sales_order_id).update(
                    status=DemandStatus.PENDING_REVIEW,
                    review_status=ReviewStatus.PENDING,
                    updated_by=submitted_by,
                )
                await self._log_state_transition(
                    tenant_id, sales_order_id,
                    DemandStatus.DRAFT, DemandStatus.PENDING_REVIEW,
                    submitted_by, submitter_name, "提交",
                )
            return await self.get_sales_order_by_id(tenant_id, sales_order_id)

        # 审批流程不存在，设为待审核，需手动调用审核接口
        from apps.common.base_service import AppBaseService
        submitter_name = await AppBaseService().get_user_name(submitted_by)
        async with in_transaction():
            await SalesOrder.filter(tenant_id=tenant_id, id=sales_order_id).update(
                status=DemandStatus.PENDING_REVIEW,
                review_status=ReviewStatus.PENDING,
                updated_by=submitted_by,
            )
            await self._log_state_transition(
                tenant_id, sales_order_id,
                DemandStatus.DRAFT, DemandStatus.PENDING_REVIEW,
                submitted_by, submitter_name, "提交",
            )
        return await self.get_sales_order_by_id(tenant_id, sales_order_id)

    async def approve_sales_order(
        self,
        tenant_id: int,
        sales_order_id: int,
        approved_by: int,
        is_auto_approve: bool = False,
    ) -> SalesOrderResponse:
        """审核通过销售订单"""
        order = await SalesOrder.get_or_none(
            tenant_id=tenant_id, id=sales_order_id, deleted_at__isnull=True
        )
        if not order:
            raise NotFoundError(f"销售订单不存在: {sales_order_id}")
        if not self._is_review_pending(order.review_status):
            raise BusinessLogicError(f"只能审核待审核状态的订单，当前: {order.review_status}")

        await self._validate_customer_credit_limit_before_release(
            tenant_id=tenant_id,
            customer_id=order.customer_id,
            customer_name=order.customer_name,
            order_total_amount=Decimal(str(order.total_amount or 0)),
        )
        await self._validate_sales_order_margin_before_release(
            tenant_id=tenant_id,
            sales_order_id=sales_order_id,
            order_code=order.order_code,
        )

        from apps.common.base_service import AppBaseService
        approver_name = await AppBaseService().get_user_name(approved_by)

        async with in_transaction():
            await SalesOrder.filter(tenant_id=tenant_id, id=sales_order_id).update(
                reviewer_id=approved_by,
                reviewer_name=approver_name,
                review_time=datetime.now(),
                review_status=ReviewStatus.APPROVED,
                status=DemandStatus.AUDITED,
                updated_by=approved_by,
            )
            await self._log_state_transition(
                tenant_id, sales_order_id,
                DemandStatus.PENDING_REVIEW, DemandStatus.AUDITED,
                approved_by, approver_name, "自动审核" if is_auto_approve else "审核通过",
            )
            # 审核通过后不再自动创建/同步 Demand。
            demand_synced = False
        result = await self.get_sales_order_by_id(tenant_id, sales_order_id)
        auto_push_result = await self._try_auto_push_order_to_computation(
            tenant_id=tenant_id,
            sales_order_id=sales_order_id,
            operator_id=approved_by,
        )
        out = result.model_dump()
        out["demand_synced"] = demand_synced
        if auto_push_result:
            out["auto_computation"] = auto_push_result
        return SalesOrderResponse(**out)

    async def reject_sales_order(
        self,
        tenant_id: int,
        sales_order_id: int,
        approved_by: int,
        rejection_reason: str,
    ) -> SalesOrderResponse:
        """驳回销售订单"""
        order = await SalesOrder.get_or_none(
            tenant_id=tenant_id, id=sales_order_id, deleted_at__isnull=True
        )
        if not order:
            raise NotFoundError(f"销售订单不存在: {sales_order_id}")
        if not self._is_review_pending(order.review_status):
            raise BusinessLogicError(f"只能审核待审核状态的订单，当前: {order.review_status}")

        from apps.common.base_service import AppBaseService
        approver_name = await AppBaseService().get_user_name(approved_by)

        async with in_transaction():
            await SalesOrder.filter(tenant_id=tenant_id, id=sales_order_id).update(
                reviewer_id=approved_by,
                reviewer_name=approver_name,
                review_time=datetime.now(),
                review_status=ReviewStatus.REJECTED,
                review_remarks=rejection_reason,
                status=DemandStatus.REJECTED,
                updated_by=approved_by,
            )
            await self._log_state_transition(
                tenant_id, sales_order_id,
                DemandStatus.PENDING_REVIEW, DemandStatus.REJECTED,
                approved_by, approver_name, f"驳回: {rejection_reason}",
            )
        return await self.get_sales_order_by_id(tenant_id, sales_order_id)

    async def unapprove_sales_order(
        self,
        tenant_id: int,
        sales_order_id: int,
        unapproved_by: int,
    ) -> SalesOrderResponse:
        """反审核销售订单"""
        order = await SalesOrder.get_or_none(
            tenant_id=tenant_id, id=sales_order_id, deleted_at__isnull=True
        )
        if not order:
            raise NotFoundError(f"销售订单不存在: {sales_order_id}")
        # 反审核 = 撤销审核：仅「已审核」，不含已确认/已生效
        can_unapprove = (
            self._is_strictly_audited_status(order.status)
            or self._is_rejected_status(order.status)
        )
        if not can_unapprove:
            raise BusinessLogicError(
                f"只能反审核已审核或已驳回的订单，当前: status={order.status}, review_status={order.review_status}"
            )

        if self._is_strictly_audited_status(order.status) and not self._is_review_approved(order.review_status):
            await SalesOrder.filter(tenant_id=tenant_id, id=sales_order_id).update(
                review_status=ReviewStatus.APPROVED
            )
            order = await SalesOrder.get(tenant_id=tenant_id, id=sales_order_id)

        # 历史兼容：若历史订单曾产生 Demand 且已下推需求计算，则先执行撤回下推。
        demand = await self._get_linked_demand(tenant_id, sales_order_id)
        if demand and demand.pushed_to_computation:
            await self.withdraw_sales_order_from_computation(tenant_id, sales_order_id)

        from apps.common.base_service import AppBaseService
        unapprover_name = await AppBaseService().get_user_name(unapproved_by)
        async with in_transaction():
            await SalesOrder.filter(tenant_id=tenant_id, id=sales_order_id).update(
                status=DemandStatus.PENDING_REVIEW,
                review_status=ReviewStatus.PENDING,
                reviewer_id=None,
                reviewer_name=None,
                review_time=None,
                review_remarks=None,
                updated_by=unapproved_by,
            )
            await self._log_state_transition(
                tenant_id, sales_order_id,
                order.status, DemandStatus.PENDING_REVIEW,
                unapproved_by, unapprover_name, "反审核",
            )
        return await self.get_sales_order_by_id(tenant_id, sales_order_id)

    async def push_sales_order_to_computation(
        self,
        tenant_id: int,
        sales_order_id: int,
        created_by: int,
    ) -> Dict[str, Any]:
        """
        下推销售订单到需求计算。

        由 SalesOrder 生成 Demand（source_type=sales_order, source_id=订单ID），
        然后下推该 Demand 到需求计算。
        """
        order = await SalesOrder.get_or_none(
            tenant_id=tenant_id, id=sales_order_id, deleted_at__isnull=True
        )
        if not order:
            raise NotFoundError(f"销售订单不存在: {sales_order_id}")
        if not self._is_audited(order.status):
            raise ValidationError(f"只能下推已审核的销售订单，当前状态: {order.status}")
        self._assert_order_executable(order)

        demand = await self._get_linked_demand(tenant_id, sales_order_id)
        if not demand:
            demand = await self._create_demand_from_sales_order(
                tenant_id, sales_order_id, created_by
            )
        from apps.kuaizhizao.services.demand_service import DemandService
        return await DemandService().push_to_computation(
            tenant_id=tenant_id,
            demand_id=demand.id,
            created_by=created_by,
        )

    async def _try_auto_push_order_to_computation(
        self,
        tenant_id: int,
        sales_order_id: int,
        operator_id: int,
    ) -> Optional[Dict[str, Any]]:
        """按组织配置在审核通过后自动下推销售订单到需求计算。"""
        from infra.services.business_config_service import BusinessConfigService

        enabled = await BusinessConfigService().auto_push_sales_to_computation_on_approve(tenant_id)
        if not enabled:
            return None
        try:
            return await self.push_sales_order_to_computation(
                tenant_id=tenant_id,
                sales_order_id=sales_order_id,
                created_by=operator_id,
            )
        except Exception as exc:
            logger.warning("销售订单自动下推需求计算失败，order_id=%s: %s", sales_order_id, exc)
            return {"success": False, "message": str(exc)}

    async def preview_push_sales_order_to_computation(
        self, tenant_id: int, sales_order_id: int
    ) -> Dict[str, Any]:
        """下推需求计算预览：返回将参与计算的订单明细，不实际创建"""
        order = await SalesOrder.get_or_none(
            tenant_id=tenant_id, id=sales_order_id, deleted_at__isnull=True
        )
        if not order:
            raise NotFoundError(f"销售订单不存在: {sales_order_id}")
        if not self._is_audited(order.status):
            raise ValidationError(f"只能下推已审核的销售订单，当前状态: {order.status}")
        self._assert_order_executable(order)

        items = await SalesOrderItem.filter(
            tenant_id=tenant_id, sales_order_id=sales_order_id
        ).order_by("id")
        if not items:
            raise BusinessLogicError("销售订单无明细，无法下推需求计算")

        demand = await self._get_linked_demand(tenant_id, sales_order_id)
        demand_exists = demand is not None

        preview_items = []
        for it in items:
            qty = float(it.order_quantity or 0)
            if qty <= 0:
                continue
            preview_items.append({
                "material_code": it.material_code,
                "material_name": it.material_name,
                "quantity": float(qty),
                "delivery_date": str(it.delivery_date) if it.delivery_date else None,
            })

        return {
            "target_type": "demand_computation",
            "summary": "将创建需求计算任务（LRP），基于BOM展开进行物料需求运算",
            "demand_exists": demand_exists,
            "items": preview_items,
            "tip": "计算完成后可下推生产计划或工单",
        }

    async def _create_demand_from_sales_order(
        self, tenant_id: int, sales_order_id: int, created_by: int
    ) -> Demand:
        """从 SalesOrder 生成 Demand（source_type=sales_order, source_id=订单ID）"""
        order = await SalesOrder.get(id=sales_order_id)
        items = await SalesOrderItem.filter(
            tenant_id=tenant_id, sales_order_id=sales_order_id
        ).order_by("id")
        if not items:
            raise BusinessLogicError("销售订单无明细，无法下推需求计算")

        total_qty = Decimal("0")
        total_amt = Decimal("0")
        demand_items = []
        for it in items:
            total_qty += it.order_quantity
            total_amt += it.total_amount
            demand_items.append({
                "material_id": it.material_id,
                "material_code": it.material_code,
                "material_name": it.material_name,
                "material_spec": it.material_spec,
                "material_unit": it.material_unit,
                "required_quantity": it.order_quantity,
                "delivery_date": it.delivery_date,
                "unit_price": it.unit_price,
                "item_amount": it.total_amount,
                "remaining_quantity": it.order_quantity,
                "delivery_status": it.delivery_status or "待交货",
                "variant_attributes": getattr(it, "variant_attributes", None),
                "configurable_selections": getattr(it, "configurable_selections", None),
            })

        demand = await Demand.create(
            tenant_id=tenant_id,
            demand_code=order.order_code,
            demand_type="sales_order",
            business_mode="MTO",
            priority=5,
            demand_name=order.order_code,
            start_date=order.order_date,
            end_date=order.delivery_date,
            order_date=order.order_date,
            delivery_date=order.delivery_date,
            customer_id=order.customer_id,
            customer_name=order.customer_name,
            customer_contact=order.customer_contact,
            customer_phone=order.customer_phone,
            total_quantity=total_qty,
            total_amount=total_amt,
            status=DemandStatus.AUDITED,
            review_status=ReviewStatus.APPROVED,
            reviewer_id=order.reviewer_id,
            reviewer_name=order.reviewer_name,
            review_time=order.review_time,
            salesman_id=order.salesman_id,
            salesman_name=order.salesman_name,
            shipping_address=order.shipping_address,
            shipping_method=order.shipping_method,
            payment_terms=order.payment_terms,
            notes=order.notes,
            source_type="sales_order",
            source_id=sales_order_id,
            source_code=order.order_code,
            created_by=created_by,
            updated_by=created_by,
        )
        for d in demand_items:
            await DemandItem.create(
                tenant_id=tenant_id,
                demand_id=demand.id,
                **d,
            )
        logger.info("从销售订单 %s 生成需求 %s", order.order_code, demand.demand_code)

        # 不再写入 DocumentRelation(sales_order→demand)：全链路追溯以订单→需求计算为主，
        # Demand 仍存表供计算与明细；关联路径见推导逻辑 _get_sales_order_downstream。

        return demand

    async def push_sales_order_to_production_plan(
        self,
        tenant_id: int,
        sales_order_id: int,
        created_by: int,
    ) -> Dict[str, Any]:
        """
        直推销售订单到生产计划（跳过需求计算）。
        订单明细直接转为生产计划明细，不要求BOM，原材料由用户自行计算采购。
        """
        order = await SalesOrder.get_or_none(
            tenant_id=tenant_id, id=sales_order_id, deleted_at__isnull=True
        )
        if not order:
            raise NotFoundError(f"销售订单不存在: {sales_order_id}")
        if not self._is_audited(order.status):
            raise ValidationError(f"只能下推已审核的销售订单，当前状态: {order.status}")
        self._assert_order_executable(order)

        items = await SalesOrderItem.filter(
            tenant_id=tenant_id, sales_order_id=sales_order_id
        ).order_by("id")
        if not items:
            raise BusinessLogicError("销售订单无明细，无法直推生产计划")

        from datetime import date, datetime
        from apps.kuaizhizao.models.production_plan import ProductionPlan
        from apps.kuaizhizao.models.production_plan_item import ProductionPlanItem
        from core.services.business.code_generation_service import CodeGenerationService
        from apps.kuaizhizao.services.document_relation_new_service import DocumentRelationNewService
        from apps.kuaizhizao.schemas.document_relation import DocumentRelationCreate

        dates = [it.delivery_date for it in items if it.delivery_date]
        plan_start = min(dates) if dates else date.today()
        plan_end = max(dates) if dates else date.today()

        try:
            plan_code = await CodeGenerationService.generate_code(
                tenant_id=tenant_id,
                rule_code="PRODUCTION_PLAN_CODE",
                context={"prefix": "MRP-"},
            )
        except Exception:
            plan_code = f"MRP-{datetime.now().strftime('%Y%m%d%H%M%S')}"

        plan = await ProductionPlan.create(
            tenant_id=tenant_id,
            plan_code=plan_code,
            plan_name=f"生产计划-{order.order_code}（直推）",
            plan_type="MRP",
            source_type="SalesOrder",
            source_id=sales_order_id,
            source_code=order.order_code,
            plan_start_date=plan_start,
            plan_end_date=plan_end,
            status="草稿",
            execution_status="未执行",
            created_by=created_by,
            updated_by=created_by,
        )

        for it in items:
            qty = float(it.order_quantity or 0)
            if qty <= 0:
                continue
            await ProductionPlanItem.create(
                tenant_id=tenant_id,
                plan_id=plan.id,
                material_id=it.material_id,
                material_code=it.material_code,
                material_name=it.material_name,
                source_type="Make",
                planned_quantity=Decimal(str(qty)),
                planned_date=it.delivery_date or plan_start,
                available_inventory=Decimal(0),
                safety_stock=Decimal(0),
                gross_requirement=Decimal(str(qty)),
                net_requirement=Decimal(str(qty)),
                suggested_action="生产",
                work_order_quantity=Decimal(str(qty)),
                purchase_order_quantity=Decimal(0),
                lead_time=0,
            )

        relation_service = DocumentRelationNewService()
        relation_data = DocumentRelationCreate(
            source_type="sales_order",
            source_id=sales_order_id,
            source_code=order.order_code,
            source_name=order.order_code,
            target_type="production_plan",
            target_id=plan.id,
            target_code=plan.plan_code,
            target_name=plan.plan_name,
            relation_type="source",
            relation_mode="push",
            relation_desc="销售订单直推生产计划（跳过需求计算，原材料自行采购）",
            business_mode="MTO",
            demand_id=None,
        )
        await relation_service.create_relation(
            tenant_id=tenant_id,
            relation_data=relation_data,
            created_by=created_by,
        )

        return {
            "success": True,
            "message": "直推成功，已生成生产计划（原材料由用户自行计算采购）",
            "target_document": {"type": "production_plan", "id": plan.id, "code": plan.plan_code},
        }

    async def preview_push_sales_order_to_production_plan(
        self, tenant_id: int, sales_order_id: int
    ) -> Dict[str, Any]:
        """下推生产计划预览：返回将生成的生产计划明细，不实际创建"""
        order = await SalesOrder.get_or_none(
            tenant_id=tenant_id, id=sales_order_id, deleted_at__isnull=True
        )
        if not order:
            raise NotFoundError(f"销售订单不存在: {sales_order_id}")
        if not self._is_audited(order.status):
            raise ValidationError(f"只能下推已审核的销售订单，当前状态: {order.status}")
        self._assert_order_executable(order)

        items = await SalesOrderItem.filter(
            tenant_id=tenant_id, sales_order_id=sales_order_id
        ).order_by("id")
        if not items:
            raise BusinessLogicError("销售订单无明细，无法直推生产计划")

        plan_items = []
        for it in items:
            qty = float(it.order_quantity or 0)
            if qty <= 0:
                continue
            plan_items.append({
                "material_code": it.material_code,
                "material_name": it.material_name,
                "quantity": float(qty),
                "delivery_date": str(it.delivery_date) if it.delivery_date else None,
                "suggested_action": "生产",
            })

        return {
            "target_type": "production_plan",
            "summary": f"将生成 1 个生产计划，包含 {len(plan_items)} 条明细",
            "plan_name_preview": f"生产计划-{order.order_code}（直推）",
            "items": plan_items,
            "tip": "原材料由您自行计算采购",
        }

    async def push_sales_order_to_work_order(
        self,
        tenant_id: int,
        sales_order_id: int,
        created_by: int,
        selected_item_ids: Optional[List[int]] = None,
        push_mode: Optional[str] = None,
    ) -> Dict[str, Any]:
        """
        直推销售订单到工单（跳过需求计算）。
        - 若产品无BOM：订单明细直接转为工单，原材料由用户自行计算采购。
        - 若产品有BOM：展开BOM，成品+半成品（Make/Outsource/Configure）一键生成工单，采购件由用户自行采购。
        """
        order = await SalesOrder.get_or_none(
            tenant_id=tenant_id, id=sales_order_id, deleted_at__isnull=True
        )
        if not order:
            raise NotFoundError(f"销售订单不存在: {sales_order_id}")
        if not self._is_audited(order.status):
            raise ValidationError(f"只能下推已审核的销售订单，当前状态: {order.status}")
        self._assert_order_executable(order)

        items = await SalesOrderItem.filter(
            tenant_id=tenant_id, sales_order_id=sales_order_id
        ).order_by("id")
        if not items:
            raise BusinessLogicError("销售订单无明细，无法直推工单")
        if selected_item_ids is not None:
            selected = {int(v) for v in selected_item_ids if v is not None}
            items = [it for it in items if int(getattr(it, "id", 0)) in selected]
            if not items:
                raise BusinessLogicError("所选明细为空，无法直推工单")

        raw_push_mode = (push_mode or "").strip().lower()
        if raw_push_mode not in ("draft", "confirm"):
            raw_push_mode = await self.business_config_service.get_push_default_mode(tenant_id)
        push_as_confirm = raw_push_mode == "confirm"

        from datetime import datetime
        from apps.kuaizhizao.services.work_order_service import WorkOrderService
        from apps.kuaizhizao.schemas.work_order import WorkOrderCreate
        from apps.kuaizhizao.services.document_relation_new_service import DocumentRelationNewService
        from apps.kuaizhizao.schemas.document_relation import DocumentRelationCreate
        from apps.kuaizhizao.utils.bom_helper import get_bom_by_material_id
        from apps.kuaizhizao.utils.material_source_helper import (
            expand_bom_with_source_control,
            SOURCE_TYPE_MAKE,
            SOURCE_TYPE_OUTSOURCE,
            SOURCE_TYPE_CONFIGURE,
        )

        # 汇总待生成工单的物料：material_id -> {qty, material_code, material_name, delivery_date}
        wo_pool: Dict[int, Dict[str, Any]] = {}

        def _add_to_pool(material_id: int, material_code: str, material_name: str, qty: float, delivery_date):
            if qty <= 0:
                return
            if material_id not in wo_pool:
                wo_pool[material_id] = {
                    "material_id": material_id,
                    "material_code": material_code,
                    "material_name": material_name,
                    "quantity": Decimal("0"),
                    "earliest_delivery": delivery_date,
                }
            wo_pool[material_id]["quantity"] += Decimal(str(qty))
            if delivery_date and (
                wo_pool[material_id]["earliest_delivery"] is None
                or delivery_date < wo_pool[material_id]["earliest_delivery"]
            ):
                wo_pool[material_id]["earliest_delivery"] = delivery_date

        work_order_service = WorkOrderService()
        relation_service = DocumentRelationNewService()

        for it in items:
            qty = float(it.order_quantity or 0)
            if qty <= 0:
                continue
            delivery_date = it.delivery_date

            bom = await get_bom_by_material_id(
                tenant_id=tenant_id,
                material_id=it.material_id,
                only_approved=True,
                use_default=True,
            )
            if bom and bom.bom_code:
                # 有BOM：展开，成品+半成品（Make/Outsource/Configure）生成工单
                _add_to_pool(it.material_id, it.material_code, it.material_name, qty, delivery_date)
                variant_attrs = getattr(it, "variant_attributes", None)
                cfg_selections = getattr(it, "configurable_selections", None)
                if cfg_selections and isinstance(cfg_selections, dict):
                    cfg_selections = {k: int(v) if v is not None else v for k, v in cfg_selections.items()}
                requirements = await expand_bom_with_source_control(
                    tenant_id=tenant_id,
                    material_id=it.material_id,
                    required_quantity=qty,
                    only_approved=True,
                    use_default_bom=True,
                    variant_attributes=variant_attrs,
                    configurable_selections=cfg_selections,
                    flatten_intermediate_subassemblies=True,
                )
                for req in requirements:
                    st = req.get("source_type")
                    if st in (SOURCE_TYPE_MAKE, SOURCE_TYPE_OUTSOURCE, SOURCE_TYPE_CONFIGURE):
                        _add_to_pool(
                            req["material_id"],
                            req["material_code"],
                            req["material_name"],
                            float(req["required_quantity"]),
                            delivery_date,
                        )
            else:
                # 无BOM：仅成品工单
                _add_to_pool(it.material_id, it.material_code, it.material_name, qty, delivery_date)

        work_orders = []
        for info in wo_pool.values():
            qty = float(info["quantity"])
            if qty <= 0:
                continue
            wo_data = WorkOrderCreate(
                code_rule="WORK_ORDER_CODE",
                product_id=info["material_id"],
                product_code=info["material_code"],
                product_name=info["material_name"],
                quantity=Decimal(str(qty)),
                production_mode="MTO",
                planned_start_date=(
                    datetime.combine(info["earliest_delivery"], datetime.min.time())
                    if info.get("earliest_delivery") else None
                ),
                planned_end_date=(
                    datetime.combine(info["earliest_delivery"], datetime.min.time())
                    if info.get("earliest_delivery") else None
                ),
                remarks=f"由销售订单 {order.order_code} 直推（含半成品）",
            )
            wo = await work_order_service.create_work_order(
                tenant_id=tenant_id,
                work_order_data=wo_data,
                created_by=created_by,
            )
            if push_as_confirm:
                wo = await work_order_service.release_work_order(
                    tenant_id=tenant_id,
                    work_order_id=wo.id,
                    released_by=created_by,
                    check_shortage=False,
                )
            wo_id = wo.id if hasattr(wo, "id") else wo.get("id")
            wo_code = wo.code if hasattr(wo, "code") else wo.get("code")
            wo_name = wo.name if hasattr(wo, "name") else wo.get("name")

            relation_data = DocumentRelationCreate(
                source_type="sales_order",
                source_id=sales_order_id,
                source_code=order.order_code,
                source_name=order.order_code,
                target_type="work_order",
                target_id=wo_id,
                target_code=wo_code,
                target_name=wo_name,
                relation_type="source",
                relation_mode="push",
                relation_desc="销售订单直推工单（含半成品，采购件自行采购）",
                business_mode="MTO",
                demand_id=None,
            )
            await relation_service.create_relation(
                tenant_id=tenant_id,
                relation_data=relation_data,
                created_by=created_by,
            )
            work_orders.append(wo)

        if not work_orders:
            raise BusinessLogicError("销售订单无有效明细数量，无法生成工单")

        return {
            "success": True,
            "message": f"直推成功，共生成 {len(work_orders)} 个工单（含半成品，采购件自行采购）",
            "push_mode": raw_push_mode,
            "target_documents": [
                {"type": "work_order", "id": w.id if hasattr(w, "id") else w.get("id"), "code": w.code if hasattr(w, "code") else w.get("code")}
                for w in work_orders
            ],
        }

    async def preview_push_sales_order_to_work_order(
        self, tenant_id: int, sales_order_id: int
    ) -> Dict[str, Any]:
        """下推工单预览：返回将生成的工单列表，不实际创建"""
        order = await SalesOrder.get_or_none(
            tenant_id=tenant_id, id=sales_order_id, deleted_at__isnull=True
        )
        if not order:
            raise NotFoundError(f"销售订单不存在: {sales_order_id}")
        if not self._is_audited(order.status):
            raise ValidationError(f"只能下推已审核的销售订单，当前状态: {order.status}")
        self._assert_order_executable(order)

        items = await SalesOrderItem.filter(
            tenant_id=tenant_id, sales_order_id=sales_order_id
        ).order_by("id")
        if not items:
            raise BusinessLogicError("销售订单无明细，无法直推工单")

        from apps.kuaizhizao.utils.bom_helper import get_bom_by_material_id
        from apps.kuaizhizao.utils.material_source_helper import (
            expand_bom_with_source_control,
            SOURCE_TYPE_MAKE,
            SOURCE_TYPE_OUTSOURCE,
            SOURCE_TYPE_CONFIGURE,
        )

        wo_pool: Dict[int, Dict[str, Any]] = {}

        def _add_to_pool(material_id: int, material_code: str, material_name: str, qty: float, delivery_date):
            if qty <= 0:
                return
            if material_id not in wo_pool:
                wo_pool[material_id] = {
                    "material_id": material_id,
                    "material_code": material_code,
                    "material_name": material_name,
                    "quantity": Decimal("0"),
                    "earliest_delivery": delivery_date,
                }
            wo_pool[material_id]["quantity"] += Decimal(str(qty))
            if delivery_date and (
                wo_pool[material_id]["earliest_delivery"] is None
                or delivery_date < wo_pool[material_id]["earliest_delivery"]
            ):
                wo_pool[material_id]["earliest_delivery"] = delivery_date

        for it in items:
            qty = float(it.order_quantity or 0)
            if qty <= 0:
                continue
            delivery_date = it.delivery_date

            bom = await get_bom_by_material_id(
                tenant_id=tenant_id,
                material_id=it.material_id,
                only_approved=True,
                use_default=True,
            )
            if bom and bom.bom_code:
                _add_to_pool(it.material_id, it.material_code, it.material_name, qty, delivery_date)
                variant_attrs = getattr(it, "variant_attributes", None)
                cfg_selections = getattr(it, "configurable_selections", None)
                if cfg_selections and isinstance(cfg_selections, dict):
                    cfg_selections = {k: int(v) if v is not None else v for k, v in cfg_selections.items()}
                requirements = await expand_bom_with_source_control(
                    tenant_id=tenant_id,
                    material_id=it.material_id,
                    required_quantity=qty,
                    only_approved=True,
                    use_default_bom=True,
                    variant_attributes=variant_attrs,
                    configurable_selections=cfg_selections,
                    flatten_intermediate_subassemblies=True,
                )
                for req in requirements:
                    st = req.get("source_type")
                    if st in (SOURCE_TYPE_MAKE, SOURCE_TYPE_OUTSOURCE, SOURCE_TYPE_CONFIGURE):
                        _add_to_pool(
                            req["material_id"],
                            req["material_code"],
                            req["material_name"],
                            float(req["required_quantity"]),
                            delivery_date,
                        )
            else:
                _add_to_pool(it.material_id, it.material_code, it.material_name, qty, delivery_date)

        wo_items = []
        for info in wo_pool.values():
            qty = float(info["quantity"])
            if qty <= 0:
                continue
            wo_items.append({
                "material_code": info["material_code"],
                "material_name": info["material_name"],
                "quantity": float(qty),
                "delivery_date": str(info["earliest_delivery"]) if info.get("earliest_delivery") else None,
            })

        return {
            "target_type": "work_order",
            "summary": f"将生成 {len(wo_items)} 个工单",
            "items": wo_items,
            "tip": "含半成品，采购件由您自行采购",
        }

    async def create_sales_order_reminder(
        self,
        tenant_id: int,
        sales_order_id: int,
        recipient_user_uuid: str,
        action_type: str,
        remarks: Optional[str],
        created_by: int,
    ) -> Dict[str, Any]:
        """
        创建销售订单提醒，发送站内信给指定用户。
        """
        order = await SalesOrder.get_or_none(
            tenant_id=tenant_id, id=sales_order_id, deleted_at__isnull=True
        )
        if not order:
            raise NotFoundError(f"销售订单不存在: {sales_order_id}")

        from infra.models.user import User
        from core.services.messaging.message_service import MessageService
        from core.schemas.message_template import SendMessageRequest

        user = await User.get_or_none(tenant_id=tenant_id, uuid=recipient_user_uuid)
        if not user:
            raise NotFoundError(f"提醒对象不存在: {recipient_user_uuid}")

        action_labels = {
            "review": "审核",
            "delivery": "安排发货",
            "invoice": "开票",
            "follow_up": "跟进",
            "other": "其他",
        }
        action_label = action_labels.get(action_type, action_type)

        subject = f"销售订单提醒：{order.order_code}"
        content_parts = [
            f"您有一条销售订单提醒：{order.order_code}",
            f"提醒操作：{action_label}",
        ]
        if remarks:
            content_parts.append(f"备注：{remarks}")
        content = "\n".join(content_parts)

        await MessageService.send_message(
            tenant_id=tenant_id,
            request=SendMessageRequest(
                type="internal",
                recipient=str(user.id),
                subject=subject,
                content=content,
            ),
        )

        return {
            "success": True,
            "message": "提醒已发送",
        }

    async def withdraw_sales_order_from_computation(
        self,
        tenant_id: int,
        sales_order_id: int,
    ) -> SalesOrderResponse:
        """撤回销售订单的需求计算"""
        demand = await self._get_linked_demand(tenant_id, sales_order_id)
        if not demand:
            return await self.get_sales_order_by_id(tenant_id, sales_order_id)
        from apps.kuaizhizao.services.demand_service import DemandService
        await DemandService().withdraw_from_computation(
            tenant_id=tenant_id,
            demand_id=demand.id,
        )
        return await self.get_sales_order_by_id(tenant_id, sales_order_id)

    async def withdraw_sales_order(
        self,
        tenant_id: int,
        sales_order_id: int,
        withdrawn_by: int,
    ) -> SalesOrderResponse:
        """撤回已提交的销售订单（待审核/已生效 → 草稿）"""
        order = await SalesOrder.get_or_none(
            tenant_id=tenant_id, id=sales_order_id, deleted_at__isnull=True
        )
        if not order:
            raise NotFoundError(f"销售订单不存在: {sales_order_id}")
        if not self._can_withdraw_submitted_order(order):
            raise BusinessLogicError(
                f"只能撤回已提交且未审核的订单（待审核或已生效），当前: {order.status}"
            )
        self._assert_order_executable(order)
        if await self._is_order_pushed_to_computation(tenant_id, order):
            raise BusinessLogicError("订单已下推需求计算，请先在「下推」菜单中撤回计算后再撤回提交")

        prev_status = order.status
        async with in_transaction():
            await SalesOrder.filter(tenant_id=tenant_id, id=sales_order_id).update(
                status=DemandStatus.DRAFT,
                review_status=ReviewStatus.PENDING,
                reviewer_id=None,
                reviewer_name=None,
                review_time=None,
                review_remarks=None,
                updated_by=withdrawn_by,
            )
            from apps.common.base_service import AppBaseService
            withdrawer_name = await AppBaseService().get_user_name(withdrawn_by)
            await self._log_state_transition(
                tenant_id,
                sales_order_id,
                prev_status,
                DemandStatus.DRAFT,
                withdrawn_by,
                withdrawer_name,
                "撤回提交",
            )
        await self._sync_demand_if_exists(tenant_id, sales_order_id, withdrawn_by)
        return await self.get_sales_order_by_id(tenant_id, sales_order_id)

    async def delete_sales_order(
        self,
        tenant_id: int,
        sales_order_id: int,
    ) -> None:
        """删除销售订单"""
        order = await SalesOrder.get_or_none(
            tenant_id=tenant_id, id=sales_order_id, deleted_at__isnull=True
        )
        if not order:
            raise NotFoundError(f"销售订单不存在: {sales_order_id}")
        deletable = (
            self._is_draft(order.status)
            or self._is_pending_review_status(order.status)
            or str(order.status or "").strip() == "已提交"
        )
        if not deletable:
            raise BusinessLogicError(f"只能删除草稿或待审核状态的订单，当前: {order.status}")

        async with in_transaction():
            demand = await self._get_linked_demand(tenant_id, sales_order_id)
            if demand:
                from apps.kuaizhizao.services.demand_service import DemandService
                await DemandService().delete_demand(tenant_id, demand.id)
            await SalesOrderItem.filter(
                tenant_id=tenant_id, sales_order_id=sales_order_id
            ).delete()
            await SalesOrder.filter(tenant_id=tenant_id, id=sales_order_id).update(
                deleted_at=datetime.now()
            )

    async def _bulk_operation_wrapper(
        self,
        tenant_id: int,
        sales_order_ids: List[int],
        operator_id: int,
        operation_func,
        **kwargs,
    ) -> Dict[str, Any]:
        """通用批量操作包装器"""
        success_count = 0
        failed_count = 0
        failed_items = []

        for oid in sales_order_ids:
            try:
                await operation_func(tenant_id, oid, operator_id, **kwargs)
                success_count += 1
            except Exception as e:
                failed_count += 1
                failed_items.append({"id": oid, "reason": str(e)})

        return {
            "success_count": success_count,
            "failed_count": failed_count,
            "failed_items": failed_items,
            "total": len(sales_order_ids),
            "success": True,
        }

    async def bulk_submit_sales_orders(
        self,
        tenant_id: int,
        sales_order_ids: List[int],
        submitted_by: int,
    ) -> Dict[str, Any]:
        """批量提交销售订单"""
        return await self._bulk_operation_wrapper(
            tenant_id, sales_order_ids, submitted_by, self.submit_sales_order
        )

    async def bulk_approve_sales_orders(
        self,
        tenant_id: int,
        sales_order_ids: List[int],
        approved_by: int,
    ) -> Dict[str, Any]:
        """批量审核通过销售订单"""
        return await self._bulk_operation_wrapper(
            tenant_id, sales_order_ids, approved_by, self.approve_sales_order
        )

    async def bulk_withdraw_sales_orders(
        self,
        tenant_id: int,
        sales_order_ids: List[int],
        withdrawn_by: int,
    ) -> Dict[str, Any]:
        """批量撤回销售订单"""
        return await self._bulk_operation_wrapper(
            tenant_id, sales_order_ids, withdrawn_by, self.withdraw_sales_order
        )

    async def bulk_unapprove_sales_orders(
        self,
        tenant_id: int,
        sales_order_ids: List[int],
        unapproved_by: int,
    ) -> Dict[str, Any]:
        """批量反审核销售订单"""
        return await self._bulk_operation_wrapper(
            tenant_id, sales_order_ids, unapproved_by, self.unapprove_sales_order
        )

    async def close_sales_order(
        self,
        tenant_id: int,
        sales_order_id: int,
        closed_by: int,
        reason: Optional[str] = None,
    ) -> SalesOrderResponse:
        """关闭销售订单：终止剩余未执行部分，已交货/已开票数据保留。"""
        order = await SalesOrder.get_or_none(
            tenant_id=tenant_id, id=sales_order_id, deleted_at__isnull=True
        )
        if not order:
            raise NotFoundError(f"销售订单不存在: {sales_order_id}")
        self._validate_can_close_sales_order(order)

        from apps.common.base_service import AppBaseService
        closer_name = await AppBaseService().get_user_name(closed_by)
        old_status = order.status
        close_reason = reason or "手动关闭订单，剩余数量不再执行"

        async with in_transaction():
            await SalesOrder.filter(tenant_id=tenant_id, id=sales_order_id).update(
                status=DocumentStatus.CLOSED.value,
                updated_by=closed_by,
            )
            await self._log_state_transition(
                tenant_id,
                sales_order_id,
                old_status,
                DocumentStatus.CLOSED.value,
                closed_by,
                closer_name,
                close_reason,
            )

        return await self.get_sales_order_by_id(tenant_id, sales_order_id)

    async def bulk_close_sales_orders(
        self,
        tenant_id: int,
        sales_order_ids: List[int],
        closed_by: int,
    ) -> Dict[str, Any]:
        """批量关闭销售订单"""
        return await self._bulk_operation_wrapper(
            tenant_id, sales_order_ids, closed_by, self.close_sales_order
        )

    async def bulk_delete_sales_orders(
        self,
        tenant_id: int,
        sales_order_ids: List[int],
    ) -> Dict[str, Any]:
        """批量删除销售订单"""
        deleted = 0
        for oid in sales_order_ids:
            try:
                await self.delete_sales_order(tenant_id, oid)
                deleted += 1
            except (NotFoundError, BusinessLogicError):
                pass
        return {"deleted_count": deleted, "total": len(sales_order_ids), "success": True}

    async def confirm_sales_order(
        self,
        tenant_id: int,
        sales_order_id: int,
        confirmed_by: int,
    ) -> SalesOrderResponse:
        """确认销售订单"""
        order = await SalesOrder.get_or_none(
            tenant_id=tenant_id, id=sales_order_id, deleted_at__isnull=True
        )
        if not order:
            raise NotFoundError(f"销售订单不存在: {sales_order_id}")
        if not self._is_audited(order.status):
            raise BusinessLogicError("只有已审核状态的销售订单才能确认")
        self._assert_order_executable(order)

        async with in_transaction():
            await SalesOrder.filter(tenant_id=tenant_id, id=sales_order_id).update(
                status=DemandStatus.CONFIRMED,
                updated_by=confirmed_by,
            )
        return await self.get_sales_order_by_id(tenant_id, sales_order_id)

    async def pull_sales_order_from_quotation(
        self,
        tenant_id: int,
        quotation_id: int,
        created_by: int,
    ) -> Dict[str, Any]:
        """
        销售订单域上拉建单：从报价单创建销售订单（单一直接上游）。
        """
        if quotation_id <= 0:
            raise ValidationError("报价单ID无效")

        from apps.kuaizhizao.services.quotation_service import QuotationService

        sales_order, quotation = await QuotationService().convert_to_sales_order(
            tenant_id=tenant_id,
            quotation_id=quotation_id,
            created_by=created_by,
            selected_item_ids=None,
        )
        return {
            "success": True,
            "message": "已从报价单创建销售订单",
            "source_type": "quotation",
            "source_id": quotation_id,
            "sales_order": sales_order.model_dump() if hasattr(sales_order, "model_dump") else sales_order,
            "quotation": quotation.model_dump() if hasattr(quotation, "model_dump") else quotation,
        }

    async def push_sales_order_to_delivery(
        self,
        tenant_id: int,
        sales_order_id: int,
        created_by: int,
        delivery_quantities: Optional[Dict[int, float]] = None,
        warehouse_id: Optional[int] = None,
        warehouse_name: Optional[str] = None,
    ) -> Dict[str, Any]:
        """下推销售订单到销售出库"""
        from apps.kuaizhizao.services.warehouse_service import SalesDeliveryService
        from apps.master_data.models.warehouse import Warehouse

        if not warehouse_id:
            default_wh = await Warehouse.filter(
                tenant_id=tenant_id, is_active=True
            ).first()
            if not default_wh:
                raise ValidationError("未配置仓库，无法生成销售出库单，请先维护仓库主数据")
            warehouse_id = default_wh.id
            warehouse_name = warehouse_name or default_wh.name

        delivery = await SalesDeliveryService().pull_from_sales_order(
            tenant_id=tenant_id,
            sales_order_id=sales_order_id,
            created_by=created_by,
            delivery_quantities=delivery_quantities,
            warehouse_id=warehouse_id,
            warehouse_name=warehouse_name,
        )
        return {
            "success": True,
            "message": "已生成销售出库单",
            "delivery_id": delivery.id,
            "delivery_code": delivery.delivery_code,
        }

    async def push_sales_order_to_shipment_notice(
        self,
        tenant_id: int,
        sales_order_id: int,
        created_by: int,
        selected_item_ids: Optional[List[int]] = None,
    ) -> Dict[str, Any]:
        """下推销售订单到发货通知单"""
        order = await SalesOrder.get_or_none(
            tenant_id=tenant_id, id=sales_order_id, deleted_at__isnull=True
        )
        if not order:
            raise NotFoundError(f"销售订单不存在: {sales_order_id}")
        if not self._is_audited(order.status):
            raise ValidationError(f"只能下推已审核的销售订单，当前状态: {order.status}")
        self._assert_order_executable(order)

        items = await SalesOrderItem.filter(
            tenant_id=tenant_id, sales_order_id=sales_order_id
        ).order_by("id")
        if not items:
            raise BusinessLogicError("销售订单无明细，无法下推发货通知单")
        if selected_item_ids is not None:
            selected = {int(v) for v in selected_item_ids if v is not None}
            items = [it for it in items if int(getattr(it, "id", 0)) in selected]
            if not items:
                raise BusinessLogicError("所选明细为空，无法下推发货通知单")

        from apps.kuaizhizao.services.shipment_notice_service import ShipmentNoticeService
        today = datetime.now().strftime("%Y%m%d")
        code = await ShipmentNoticeService().generate_code(
            tenant_id, "SHIPMENT_NOTICE_CODE", prefix=f"SN{today}"
        )

        async with in_transaction():
            notice = await ShipmentNotice.create(
                tenant_id=tenant_id,
                notice_code=code,
                sales_order_id=order.id,
                sales_order_code=order.order_code or "",
                customer_id=order.customer_id,
                customer_name=order.customer_name or "",
                customer_contact=order.customer_contact,
                customer_phone=order.customer_phone,
                shipping_address=order.shipping_address,
                planned_ship_date=order.delivery_date,
                status="待发货",
                notes=order.notes,
                created_by=created_by,
                updated_by=created_by,
            )
            total_qty = Decimal("0")
            total_amt = Decimal("0")
            for it in items:
                # P1-S-009: 发货通知下推应取欠发量，避免把总量重复通知给仓库
                qty = (it.remaining_quantity if it.remaining_quantity is not None else ((it.order_quantity or Decimal("0")) - (it.delivered_quantity or Decimal("0"))))
                qty = max(Decimal("0"), Decimal(str(qty)))
                if qty <= Decimal("0"):
                    continue
                amt = it.total_amount or (qty * (it.unit_price or Decimal("0")))
                await ShipmentNoticeItem.create(
                    tenant_id=tenant_id,
                    notice_id=notice.id,
                    material_id=it.material_id,
                    material_code=it.material_code or "",
                    material_name=it.material_name or "",
                    material_spec=it.material_spec,
                    material_unit=it.material_unit or "",
                    notice_quantity=qty,
                    unit_price=it.unit_price or Decimal("0"),
                    total_amount=amt,
                    sales_order_item_id=it.id,
                )
                total_qty += qty
                total_amt += amt
            if total_qty <= Decimal("0"):
                raise BusinessLogicError("销售订单无欠发明细，无法下推发货通知单")
            await ShipmentNotice.filter(tenant_id=tenant_id, id=notice.id).update(
                total_quantity=total_qty,
                total_amount=total_amt,
            )

        notice_id = notice.id
        notice_service = ShipmentNoticeService()
        try:
            notified = await notice_service.notify_warehouse(
                tenant_id=tenant_id,
                notice_id=notice_id,
                notified_by=created_by,
            )
        except Exception as e:
            logger.error("发货通知单 %s 自动通知仓库失败: %s", code, e)
            raise BusinessLogicError(
                f"已生成发货通知单 {code}，但自动通知仓库失败：{e}"
            ) from e

        logger.info("从销售订单 %s 生成发货通知单 %s 并已通知仓库", order.order_code, code)
        return {
            "success": True,
            "message": "已生成发货通知单并已通知仓库",
            "notice_id": notice_id,
            "notice_code": code,
            "status": notified.status,
            "sales_delivery_id": getattr(notified, "sales_delivery_id", None),
            "sales_delivery_code": getattr(notified, "sales_delivery_code", None),
        }

    async def push_sales_order_to_invoice(
        self,
        tenant_id: int,
        sales_order_id: int,
        created_by: int,
    ) -> Dict[str, Any]:
        """下推销售订单到销售发票（销项发票）"""
        order = await SalesOrder.get_or_none(
            tenant_id=tenant_id, id=sales_order_id, deleted_at__isnull=True
        )
        if not order:
            raise NotFoundError(f"销售订单不存在: {sales_order_id}")
        if not self._is_audited(order.status):
            raise ValidationError(f"只能下推已审核的销售订单，当前状态: {order.status}")
        self._assert_order_executable(order)

        items = await SalesOrderItem.filter(
            tenant_id=tenant_id, sales_order_id=sales_order_id
        ).order_by("id")
        if not items:
            raise BusinessLogicError("销售订单无明细，无法下推销售发票")

        from apps.kuaicaiwu.services.invoice_service import InvoiceService
        from apps.kuaicaiwu.schemas.invoice import InvoiceCreate, InvoiceItemCreate

        money_q = Decimal("0.01")

        def _q_money(v: Decimal) -> Decimal:
            return v.quantize(money_q, rounding=ROUND_HALF_UP)

        total_excl = Decimal("0")
        total_tax = Decimal("0")
        total_incl = Decimal("0")
        invoice_items = []
        for it in items:
            qty = it.order_quantity or Decimal("0")
            price = it.unit_price or Decimal("0")
            traw = it.tax_rate or Decimal("0")
            # 订单明细税率为「百分比」数值（如 13）；兼容异常录入为小数形式（≤1 视为已为小数税率）
            rate = traw / Decimal("100") if traw > Decimal("1") else traw
            excl = _q_money(qty * price)
            tax = _q_money(excl * rate)
            incl = _q_money(excl + tax)
            total_excl += excl
            total_tax += tax
            total_incl += incl
            spec = (it.material_spec or "") if it.material_spec else None
            if spec and len(spec) > 100:
                spec = spec[:100]
            invoice_items.append(
                InvoiceItemCreate(
                    item_name=(it.material_name or f"物料{it.material_id}")[:200],
                    spec_model=spec,
                    unit=(it.material_unit or "")[:20] if it.material_unit else None,
                    quantity=qty,
                    unit_price=price,
                    amount=excl,
                    tax_rate=rate,
                    tax_amount=tax,
                )
            )

        total_excl = _q_money(total_excl)
        total_tax = _q_money(total_tax)
        total_incl = _q_money(total_incl)
        tax_rate_avg = (
            _q_money(total_tax / total_excl)
            if total_excl and total_excl != Decimal("0")
            else Decimal("0.1300")
        )
        # 发票号码（税务票面号）由用户在发票单据中手工填写；下推仅生成草稿，不预填号码
        invoice_data = InvoiceCreate(
            category="OUT",
            invoice_type="VAT_SPECIAL",
            partner_id=order.customer_id,
            partner_name=order.customer_name or "",
            partner_tax_no=None,
            partner_bank_info=None,
            partner_address_phone=None,
            amount_excluding_tax=total_excl,
            tax_amount=total_tax,
            total_amount=total_incl,
            tax_rate=tax_rate_avg,
            invoice_date=date.today(),
            invoice_number="",
            status="DRAFT",
            source_document_code=order.order_code,
            description=f"由销售订单 {order.order_code} 下推",
            items=invoice_items,
        )
        invoice = await InvoiceService().create_invoice(tenant_id, invoice_data, created_by)
        logger.info("从销售订单 %s 生成销售发票 %s", order.order_code, invoice.invoice_code)
        try:
            from apps.kuaizhizao.services.document_relation_new_service import DocumentRelationNewService
            from apps.kuaizhizao.schemas.document_relation import DocumentRelationCreate

            rel_svc = DocumentRelationNewService()
            await rel_svc.create_relation(
                tenant_id=tenant_id,
                relation_data=DocumentRelationCreate(
                    source_type="sales_order",
                    source_id=sales_order_id,
                    source_code=order.order_code,
                    source_name=getattr(order, "order_name", None),
                    target_type="sales_invoice",
                    target_id=invoice.id,
                    target_code=invoice.invoice_code,
                    target_name=None,
                    relation_type="source",
                    relation_mode="push",
                    relation_desc="销售订单下推生成销项发票",
                ),
                created_by=created_by,
            )
        except Exception as rel_e:
            logger.warning("销售订单→销售发票 单据关联失败: %s", rel_e)

        return {
            "success": True,
            "message": "已生成销售发票",
            "invoice_id": invoice.id,
            "invoice_code": invoice.invoice_code,
        }

    async def get_sales_order_tracking(
        self, tenant_id: int, sales_order_id: int
    ):
        """获取销售订单全息追踪视图"""
        from apps.kuaizhizao.schemas.sales_order import (
            SalesOrderTrackingResponse, TrackingWorkOrderInfo, TrackingDeliveryInfo, TrackingMaterialShortageInfo
        )
        from apps.kuaizhizao.models.work_order import WorkOrder
        from apps.kuaizhizao.models.sales_delivery import SalesDelivery
        from apps.kuaizhizao.models.demand_computation_item import DemandComputationItem
        
        order = await SalesOrder.get_or_none(tenant_id=tenant_id, id=sales_order_id, deleted_at__isnull=True)
        if not order:
            raise NotFoundError(f"销售订单不存在: {sales_order_id}")
            
        items = await SalesOrderItem.filter(tenant_id=tenant_id, sales_order_id=sales_order_id).all()
        
        # 1. 备料进度 (Material Prep)
        material_shortages = []
        material_prep_progress = 0.0
        demand = await self._get_linked_demand(tenant_id, sales_order_id)
        if demand and demand.computation_id:
            comp_items = await DemandComputationItem.filter(
                tenant_id=tenant_id, 
                computation_id=demand.computation_id,
            ).exclude(material_source_type="Make").all()
            
            total_req = Decimal("0")
            total_short = Decimal("0")
            for ci in comp_items:
                req = ci.required_quantity or Decimal("0")
                short = ci.net_requirement or Decimal("0")
                if req > 0:
                    total_req += req
                    if short > 0:
                        total_short += short
                        material_shortages.append(TrackingMaterialShortageInfo(
                            material_code=ci.material_code,
                            material_name=ci.material_name,
                            required_quantity=req,
                            shortage_quantity=short
                        ))
            if total_req > 0:
                prep = float((total_req - total_short) / total_req * 100)
                material_prep_progress = max(0.0, min(100.0, prep))
            else:
                material_prep_progress = 100.0
        elif demand and not demand.computation_id:
            material_prep_progress = 0.0
        else:
            material_prep_progress = 100.0
            
        # 2. 生产进度 (Production)
        work_orders = await WorkOrder.filter(
            tenant_id=tenant_id, 
            sales_order_id=sales_order_id, 
            deleted_at__isnull=True
        ).all()
        wo_list = []
        total_wo_plan = Decimal("0")
        total_wo_completed = Decimal("0")
        for wo in work_orders:
            w_plan = wo.quantity or Decimal("0")
            w_comp = wo.completed_quantity or Decimal("0")
            total_wo_plan += w_plan
            total_wo_completed += w_comp
            wo_list.append(TrackingWorkOrderInfo(
                work_order_id=wo.id,
                work_order_code=wo.code,
                product_name=wo.product_name,
                quantity=w_plan,
                completed_quantity=w_comp,
                status=wo.status
            ))
        production_progress = 0.0
        if total_wo_plan > 0:
            production_progress = float(min(100.0, (total_wo_completed / total_wo_plan) * 100))
        elif work_orders: 
            production_progress = 0.0
        else:
            production_progress = 0.0
            if order.status in ("COMPLETED", "FINISHED"): 
                production_progress = 100.0
                
        # 3. 发货进度 (Delivery)
        deliveries = await SalesDelivery.filter(
            tenant_id=tenant_id, 
            sales_order_id=sales_order_id, 
            deleted_at__isnull=True
        ).all()
        del_list = []
        for de in deliveries:
            del_list.append(TrackingDeliveryInfo(
                delivery_id=de.id,
                delivery_code=de.delivery_code,
                delivery_date=de.delivery_date,
                status=de.status
            ))
            
        shipped_by = await self._shipped_qty_by_sales_order(tenant_id, [sales_order_id])
        delivery_progress = self._merged_delivery_progress(
            order, items, shipped_by.get(sales_order_id, Decimal("0"))
        )

        return SalesOrderTrackingResponse(
            sales_order_id=order.id,
            sales_order_code=order.order_code,
            material_prep_progress=round(material_prep_progress, 1),
            production_progress=round(production_progress, 1),
            delivery_progress=round(delivery_progress, 1),
            work_orders=wo_list,
            deliveries=del_list,
            material_shortages=material_shortages
        )

    async def get_quote_breakdown(
        self, tenant_id: int, material_id: int
    ) -> QuoteBreakdownResponse:
        """
        获取产品核价明细 (Agile Quoting Tool)
        
        逻辑：
        1. 获取 Material
        2. 获取默认 BOM (is_default=True)
        3. 遍历 BOM 子件，获取单价（标准成本或参考采购价）
        4. 获取关联的 ProcessRoute，提取工序并预估人工/制费
        """
        material = await Material.filter(tenant_id=tenant_id, id=material_id, deleted_at__isnull=True).first()
        if not material:
            raise NotFoundError(f"未找到物料 ID: {material_id}")

        material_costs = []
        manufacturing_costs = []
        
        # 1. 直接材料预估
        # 优先查找 is_default=True 的 BOM 编码对应的项
        default_bom = await BOM.filter(
            tenant_id=tenant_id, 
            material_id=material_id, 
            is_default=True,
            is_active=True,
            deleted_at__isnull=True
        ).first()
        
        bom_filter = {"tenant_id": tenant_id, "material_id": material_id, "is_active": True, "deleted_at__isnull": True}
        if default_bom and default_bom.bom_code:
            bom_filter["bom_code"] = default_bom.bom_code
            
        bom_items = await BOM.filter(**bom_filter).prefetch_related("component").all()
        
        total_material_cost = Decimal("0")
        for bom in bom_items:
            comp = bom.component
            unit_cost = Decimal("0")
            remark = "成本参考值缺失"
            
            # 从 defaults 获取标准成本/参考成本
            if comp.defaults and isinstance(comp.defaults, dict):
                # 尝试多个可能的成本字段
                cost_val = comp.defaults.get("standard_cost") or comp.defaults.get("purchase_price") or comp.defaults.get("moving_average_cost") or 0
                unit_cost = Decimal(str(cost_val))
                if comp.defaults.get("standard_cost"):
                    remark = "读取自标准成本"
                elif comp.defaults.get("purchase_price"):
                    remark = "读取自最近采购价"
                elif comp.defaults.get("moving_average_cost"):
                    remark = "读取自移动平均成本"
            
            qty = bom.quantity or Decimal("0")
            waste_rate = bom.waste_rate or Decimal("0")
            actual_qty = qty * (1 + waste_rate / 100)
            item_total = actual_qty * unit_cost
            total_material_cost += item_total
            
            material_costs.append(QuoteItemResponse(
                item_type="material",
                name=comp.name,
                code=comp.main_code,
                quantity=float(actual_qty),
                unit=comp.base_unit,
                unit_cost=float(unit_cost),
                total_cost=float(item_total),
                remark=remark
            ))

        # 2. 制造费用预估
        # 获取物料级绑定的工艺路线
        route = None
        if material.process_route_id:
            route = await ProcessRoute.filter(tenant_id=tenant_id, id=material.process_route_id).first()
        
        total_manufacturing_cost = Decimal("0")
        if route and route.operation_sequence:
            # 假设 operation_sequence: [{"name": "...", "std_time": 0.5, "labor_rate": 50}, ...]
            ops = route.operation_sequence
            if isinstance(ops, list):
                for op_data in ops:
                    op_name = op_data.get("name") or op_data.get("operation_name") or "未知工序"
                    # 尝试从 op_data 获取标准工时
                    std_time = Decimal(str(op_data.get("std_time") or op_data.get("standard_time") or 0))
                    # 获取费率，优先取工序级，否则取默认值
                    labor_rate = Decimal(str(op_data.get("labor_rate") or op_data.get("cost_rate") or 60)) 
                    
                    item_total = std_time * labor_rate
                    total_manufacturing_cost += item_total
                    
                    manufacturing_costs.append(QuoteItemResponse(
                        item_type="labor",
                        name=op_name,
                        code=op_data.get("code") or op_data.get("operation_code"),
                        quantity=float(std_time),
                        unit="小时",
                        unit_cost=float(labor_rate),
                        total_cost=float(item_total),
                        remark="基于工艺路线工时预估"
                    ))

        total_estimated_cost = total_material_cost + total_manufacturing_cost
        # 默认建议报价加价比例 (如 20%)
        suggested_price = total_estimated_cost * Decimal("1.2")

        return QuoteBreakdownResponse(
            material_id=material.id,
            material_code=material.main_code,
            material_name=material.name,
            material_spec=material.specification,
            material_costs=material_costs,
            manufacturing_costs=manufacturing_costs,
            total_material_cost=float(total_material_cost),
            total_manufacturing_cost=float(total_manufacturing_cost),
            total_estimated_cost=float(total_estimated_cost),
            suggested_price=float(suggested_price)
        )
