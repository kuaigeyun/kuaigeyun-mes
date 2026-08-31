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
from apps.master_data.models.factory import WorkCenter
from apps.master_data.models.customer import Customer
from apps.master_data.models.process import ProcessRoute
from apps.kuaizhizao.schemas.quote import QuoteBreakdownResponse, QuoteItemResponse
from apps.kuaizhizao.models.sales_order_item import SalesOrderItem
from apps.kuaizhizao.models.work_order import WorkOrder
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
from apps.kuaizhizao.services.document_action_policy.enricher import (
    enrich_sales_order_capabilities_on_response,
)
from apps.kuaizhizao.utils.gift_line_helper import validate_gift_line_rules
from apps.kuaizhizao.services.document_action_policy.sales_order import (
    assert_sales_order_capability,
)
from apps.kuaizhizao.constants import (
    DemandStatus,
    ReviewStatus,
    DocumentStatus,
    LEGACY_AUDITED_VALUES,
    REVIEW_STATUS_ALIASES,
    normalize_status,
)
from apps.kuaizhizao.constants.price_type import DEFAULT_SALES_PRICE_TYPE
from core.services.authorization.data_scope_service import DataScopeService
from core.utils.timezone_utils import resolve_business_datetime, to_api_isoformat, today_site_str
from infra.exceptions.exceptions import NotFoundError, ValidationError, BusinessLogicError
from infra.services.business_config_service import BusinessConfigService


# 写入 ORM 时排除：明细单独处理；order_name/audit 为响应层虚拟字段（BaseSchema）
_SALES_ORDER_PERSIST_EXCLUDE = frozenset({"items", "order_name", "audit", "payment_milestones"})


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
    async def _apply_sales_order_list_scope(
        query,
        tenant_id: int,
        current_user: Optional["User"],
        list_scope: Optional[str] = None,
    ):
        """统一按角色数据策略过滤销售订单列表。"""
        if not current_user:
            return query
        return await DataScopeService.apply(
            query,
            tenant_id=tenant_id,
            user=current_user,
            resource="kuaizhizao:sales-order",
        )

    @staticmethod
    def _process_sales_order_item_pricing(
        item_data: SalesOrderItemCreate,
        material_map: Dict[int, Material],
        *,
        money_fn,
        partner_settlement_method: Optional[str] = None,
    ) -> Dict[str, Any]:
        from apps.kuaicaiwu.utils.price_settlement_helpers import (
            derive_price_settlement_status,
            derive_provisional_unit_price,
        )

        req_qty = item_data.required_quantity
        tax_r = item_data.tax_rate or Decimal("0")
        is_gift = bool(getattr(item_data, "is_gift", False))
        unit_pr = item_data.unit_price or Decimal("0")
        settlement_status = derive_price_settlement_status(
            unit_price=unit_pr,
            is_gift=is_gift,
            partner_settlement_method=partner_settlement_method,
            explicit_status=getattr(item_data, "price_settlement_status", None),
        )
        provisional_price = derive_provisional_unit_price(
            unit_price=unit_pr,
            reference_price=getattr(item_data, "provisional_unit_price", None),
            settlement_status=settlement_status,
        )
        mat_code, mat_name, mat_spec, mat_unit = SalesOrderService._material_fields_from_master_or_payload(
            item_data, material_map
        )
        unit_pr, item_amt, gift_ref = validate_gift_line_rules(
            is_gift=is_gift,
            unit_price=unit_pr,
            material_id=item_data.material_id or 0,
            material_map=material_map,
            material_code=mat_code,
            material_name=mat_name,
            gift_ref_unit_price=getattr(item_data, "gift_ref_unit_price", None),
            line_amount=item_data.item_amount,
        )
        if not is_gift:
            excl_amt = req_qty * unit_pr
            item_amt = (
                item_data.item_amount
                if item_data.item_amount is not None
                else (excl_amt * (Decimal("1") + tax_r / Decimal("100")))
            )
            item_amt = money_fn(item_amt)
        SalesOrderService._validate_sales_item_non_negative(
            required_quantity=req_qty,
            unit_price=unit_pr,
            tax_rate=tax_r,
            item_amount=item_amt,
        )
        return {
            "material_id": item_data.material_id or 0,
            "material_code": mat_code,
            "material_name": mat_name,
            "material_spec": mat_spec,
            "material_unit": mat_unit,
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
            "is_gift": is_gift,
            "gift_ref_unit_price": gift_ref,
            "price_settlement_status": settlement_status,
            "provisional_unit_price": provisional_price,
            "_item_amount": item_amt,
        }

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

        from tortoise.functions import Sum

        item_rows = await SalesDeliveryItem.filter(
            tenant_id=tenant_id,
            delivery_id__in=ship_ids,
        ).group_by("delivery_id").annotate(qty=Sum("delivery_quantity")).values("delivery_id", "qty")
        qty_by_did: Dict[int, Decimal] = {
            int(row["delivery_id"]): Decimal(str(row.get("qty") or 0))
            for row in item_rows
        }

        out: Dict[int, Decimal] = {}
        for oid, dids in order_for.items():
            out[oid] = sum((qty_by_did.get(d, Decimal("0")) for d in dids), start=Decimal("0"))
        return out

    async def _pushed_work_order_qty_by_material(
        self,
        tenant_id: int,
        sales_order_id: int,
        material_ids: List[int],
    ) -> Dict[int, Decimal]:
        """按产品物料统计销售订单已下推工单数量（排除已取消工单）。"""
        mids = [int(m) for m in material_ids if m is not None]
        if not mids:
            return {}
        rows = await WorkOrder.filter(
            tenant_id=tenant_id,
            sales_order_id=sales_order_id,
            product_id__in=mids,
            deleted_at__isnull=True,
        ).exclude(
            status__in=["cancelled", "CANCELLED", "已取消"]
        ).values_list("product_id", "quantity")
        pushed: Dict[int, Decimal] = {}
        for product_id, qty in rows:
            mid = int(product_id)
            pushed[mid] = pushed.get(mid, Decimal("0")) + Decimal(str(qty or 0))
        return pushed

    async def _pushed_work_order_qty_by_sales_order(
        self,
        tenant_id: int,
        sales_order_ids: List[int],
    ) -> Dict[int, Decimal]:
        """按销售订单统计已下推工单数量（排除已取消工单）。"""
        summary = await self._pushed_work_orders_by_sales_order(tenant_id, sales_order_ids)
        return {oid: data["qty"] for oid, data in summary.items()}

    async def _pushed_work_orders_by_sales_order(
        self,
        tenant_id: int,
        sales_order_ids: List[int],
    ) -> Dict[int, Dict[str, Any]]:
        """按销售订单汇总已下推工单数量与编码（排除已取消工单）。"""
        ids = [int(v) for v in sales_order_ids if v is not None]
        if not ids:
            return {}
        rows = await WorkOrder.filter(
            tenant_id=tenant_id,
            sales_order_id__in=ids,
            deleted_at__isnull=True,
        ).exclude(
            status__in=["cancelled", "CANCELLED", "已取消"]
        ).values_list("sales_order_id", "quantity", "code")
        pushed: Dict[int, Dict[str, Any]] = {}
        for so_id, qty, code in rows:
            oid = int(so_id)
            bucket = pushed.setdefault(oid, {"qty": Decimal("0"), "codes": []})
            bucket["qty"] = bucket["qty"] + Decimal(str(qty or 0))
            code_str = str(code or "").strip()
            if code_str and code_str not in bucket["codes"]:
                bucket["codes"].append(code_str)
        return pushed

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

        notice_items = await ShipmentNoticeItem.filter(
            tenant_id=tenant_id,
            material_id__in=list(material_ids),
        ).values("notice_id", "sales_order_item_id", "material_id", "notice_quantity")

        reserved_by_so_item: Dict[int, Decimal] = defaultdict(lambda: Decimal("0"))
        reserved_by_material: Dict[int, Decimal] = defaultdict(lambda: Decimal("0"))
        if notice_items:
            notice_ids = list({int(ni["notice_id"]) for ni in notice_items if ni.get("notice_id")})
            active_notice_ids: set[int] = set()
            if notice_ids:
                active_notice_ids = set(
                    await ShipmentNotice.filter(
                        tenant_id=tenant_id,
                        id__in=notice_ids,
                        status="已通知",
                        deleted_at__isnull=True,
                    ).values_list("id", flat=True)
                )
            for ni in notice_items:
                if int(ni.get("notice_id") or 0) not in active_notice_ids:
                    continue
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
                inv_row = inventory_map.get(mid) or {}
                avail = (
                    Decimal(str(inv_row.get("available_quantity") or 0))
                    - reserved_by_material.get(mid, Decimal("0"))
                )
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
                transition_time=resolve_business_datetime(),
            )
        except Exception as e:
            logger.warning("写入状态流转日志失败（表可能未创建），跳过: %s", e)

    @staticmethod
    def _item_to_options_response(it: SalesOrderItem) -> SalesOrderItemResponse:
        """选单/关联明细轻量行：仅物料与数量字段，不做库存/账款计算。"""
        order_qty = (
            it.order_quantity
            if getattr(it, "order_quantity", None) is not None
            else Decimal("0")
        )
        return SalesOrderItemResponse.model_validate(
            {
                "id": it.id,
                "uuid": str(it.uuid),
                "tenant_id": it.tenant_id,
                "sales_order_id": it.sales_order_id,
                "material_id": it.material_id,
                "material_code": (it.material_code or "")[:100],
                "material_name": (it.material_name or "")[:200],
                "material_spec": (getattr(it, "material_spec", None) or None),
                "material_unit": (getattr(it, "material_unit", None) or None),
                "required_quantity": order_qty,
                "delivery_date": getattr(it, "delivery_date", None) or date.today(),
                "unit_price": getattr(it, "unit_price", None) or Decimal("0"),
                "tax_rate": getattr(it, "tax_rate", None) or Decimal("0"),
                "item_amount": getattr(it, "total_amount", None) or Decimal("0"),
                "is_gift": bool(getattr(it, "is_gift", False)),
                "price_settlement_status": getattr(it, "price_settlement_status", None),
                "provisional_unit_price": getattr(it, "provisional_unit_price", None),
                "delivered_quantity": (
                    it.delivered_quantity
                    if getattr(it, "delivered_quantity", None) is not None
                    else Decimal("0")
                ),
                "remaining_quantity": (
                    it.remaining_quantity
                    if getattr(it, "remaining_quantity", None) is not None
                    else Decimal("0")
                ),
                "delivery_status": getattr(it, "delivery_status", None),
                "created_at": it.created_at,
                "updated_at": it.updated_at,
            }
        )

    @classmethod
    def _order_to_options_response(
        cls,
        order: SalesOrder,
        items: Optional[List[SalesOrderItem]] = None,
    ) -> SalesOrderResponse:
        """选单/关联轻量响应：表头必要字段（可选明细），跳过进度/capabilities/里程碑。"""
        raw_review_status = getattr(order, "review_status", None)
        normalized_review_status = (
            raw_review_status
            if str(raw_review_status or "").strip()
            else ReviewStatus.PENDING
        )
        payload: Dict[str, Any] = {
            "id": order.id,
            "uuid": str(order.uuid),
            "tenant_id": order.tenant_id,
            "order_code": order.order_code,
            "order_name": getattr(order, "order_name", None) or order.order_code,
            "order_date": order.order_date,
            "delivery_date": order.delivery_date,
            "customer_id": order.customer_id,
            "customer_name": order.customer_name,
            "customer_contact": getattr(order, "customer_contact", None),
            "customer_phone": getattr(order, "customer_phone", None),
            "total_quantity": order.total_quantity if order.total_quantity is not None else Decimal("0"),
            "total_amount": order.total_amount if order.total_amount is not None else Decimal("0"),
            "status": order.status,
            "review_status": normalized_review_status,
            "salesman_id": getattr(order, "salesman_id", None),
            "salesman_name": getattr(order, "salesman_name", None),
            "shipping_address": getattr(order, "shipping_address", None),
            "is_active": order.is_active,
            "created_at": order.created_at,
            "updated_at": order.updated_at,
        }
        if items is not None:
            payload["items"] = [cls._item_to_options_response(it) for it in items]
        return SalesOrderResponse.model_validate(payload)

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
        payment_milestones: Optional[List[Any]] = None,
        shippable_hint: Optional[Dict[str, Any]] = None,
        pushed_work_order_quantity: Optional[Decimal] = None,
        remaining_push_quantity: Optional[Decimal] = None,
        work_order_push_progress: Optional[float] = None,
        pushed_work_order_codes: Optional[List[str]] = None,
        audit_enabled: bool = False,
    ) -> SalesOrderResponse:
        """将 SalesOrder 转为 SalesOrderResponse"""
        from apps.kuaizhizao.services.document_lifecycle_service import get_sales_order_lifecycle
        from core.services.approval.audit_phase import derive_audit_phase

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
        raw_review_status = getattr(order, "review_status", None)
        normalized_review_status = (
            raw_review_status
            if str(raw_review_status or "").strip()
            else ReviewStatus.PENDING
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
            "price_type": getattr(order, "price_type", None) or DEFAULT_SALES_PRICE_TYPE,
            "discount_amount": getattr(order, "discount_amount", None) or Decimal("0"),
            "status": order.status,
            "submit_time": getattr(order, "submit_time", None),
            "reviewer_id": getattr(order, "reviewer_id", None),
            "reviewer_name": getattr(order, "reviewer_name", None),
            "review_time": getattr(order, "review_time", None),
            "review_status": normalized_review_status,
            "review_remarks": getattr(order, "review_remarks", None),
            "salesman_id": getattr(order, "salesman_id", None),
            "salesman_name": getattr(order, "salesman_name", None),
            "shipping_address": order.shipping_address,
            "shipping_method": order.shipping_method,
            "payment_terms": order.payment_terms,
            "contract_id": getattr(order, "contract_id", None),
            "contract_code": getattr(order, "contract_code", None),
            "is_release_order": bool(getattr(order, "is_release_order", False)),
            "term_group_id": getattr(order, "term_group_id", None),
            "term_group_name": getattr(order, "term_group_name", None),
            "contract_terms": getattr(order, "contract_terms", None),
            "currency_code": getattr(order, "currency_code", None) or "CNY",
            "notes": order.notes,
            "attachments": getattr(order, "attachments", None),
            "fee_details": getattr(order, "fee_details", None),
            "total_fee_amount": getattr(order, "total_fee_amount", None) or Decimal("0"),
            "is_active": order.is_active,
            "created_by": order.created_by,
            "created_by_name": getattr(order, "created_by_name", None),
            "updated_by": getattr(order, "updated_by", None),
            "updated_by_name": getattr(order, "updated_by_name", None),
            "external_sync_at": getattr(order, "external_sync_at", None),
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
        if pushed_work_order_quantity is not None:
            base["pushed_work_order_quantity"] = pushed_work_order_quantity
        if remaining_push_quantity is not None:
            base["remaining_push_quantity"] = remaining_push_quantity
        if work_order_push_progress is not None:
            base["work_order_push_progress"] = round(float(work_order_push_progress), 1)
        base["pushed_work_order_codes"] = list(pushed_work_order_codes or [])
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
        base["audit"] = derive_audit_phase(
            "sales_order",
            order.status,
            getattr(order, "review_status", None),
            enabled=audit_enabled,
        )
        fallback = material_code_fallback or {}
        mat_fallback = material_fallback or {}

        def _material_val(it: SalesOrderItem, attr: str, mat_key: str, max_len: int = 50) -> str:
            """明细有 material_id 时优先物料主数据，否则用明细快照。"""
            mf = mat_fallback.get(it.material_id) if it.material_id else None
            if mf and mat_key in mf and mf[mat_key]:
                return str(mf[mat_key])[:max_len]
            val = getattr(it, attr, None)
            if val is not None and str(val).strip():
                return str(val)[:max_len]
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
                    is_gift=bool(getattr(it, "is_gift", False)),
                    gift_ref_unit_price=getattr(it, "gift_ref_unit_price", None),
                    price_settlement_status=getattr(it, "price_settlement_status", None),
                    provisional_unit_price=getattr(it, "provisional_unit_price", None),
                    price_settled_at=getattr(it, "price_settled_at", None),
                    price_settled_by=getattr(it, "price_settled_by", None),
                    notes=it.notes,
                    variant_attributes=getattr(it, "variant_attributes", None),
                    configurable_selections=getattr(it, "configurable_selections", None),
                    delivered_quantity=it.delivered_quantity if getattr(it, "delivered_quantity", None) is not None else Decimal("0"),
                    remaining_quantity=it.remaining_quantity if getattr(it, "remaining_quantity", None) is not None else Decimal("0"),
                    delivery_status=it.delivery_status,
                    work_order_id=getattr(it, "work_order_id", None),
                    work_order_code=getattr(it, "work_order_code", None),
                    created_at=it.created_at if getattr(it, "created_at", None) else resolve_business_datetime(),
                    updated_at=it.updated_at if getattr(it, "updated_at", None) else resolve_business_datetime(),
                )
                for it in items
            ]
        if payment_milestones is not None:
            base["payment_milestones"] = payment_milestones
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

    async def _batch_has_delivery_project_by_order(
        self, tenant_id: int, order_ids: List[int]
    ) -> Dict[int, bool]:
        if not order_ids:
            return {}
        from apps.kuaizhizao.constants.delivery_project import DeliveryProjectStatus
        from apps.kuaizhizao.models.delivery_project import DeliveryProject

        rows = await DeliveryProject.filter(
            tenant_id=tenant_id,
            sales_order_id__in=order_ids,
            deleted_at__isnull=True,
        ).exclude(status=DeliveryProjectStatus.CANCELLED.value).values_list(
            "sales_order_id", flat=True
        )
        linked = {int(sales_order_id) for sales_order_id in rows if sales_order_id}
        return {order_id: order_id in linked for order_id in order_ids}

    async def _order_has_delivery_project(self, tenant_id: int, order_id: int) -> bool:
        mapping = await self._batch_has_delivery_project_by_order(tenant_id, [order_id])
        return mapping.get(order_id, False)

    def _sales_order_capability_context(
        self,
        order: SalesOrder,
        items: Optional[List[SalesOrderItem]],
        demand: Optional[Demand],
        *,
        pushable_by_item: Optional[Dict[int, Decimal]] = None,
        has_existing_delivery_project: bool = False,
    ) -> dict[str, bool]:
        item_list = items or []
        has_items = len(item_list) > 0
        has_line_work_orders = any(
            int(getattr(it, "work_order_id", 0) or 0) > 0 for it in item_list
        )
        has_returnable_qty = any(
            Decimal(str(getattr(it, "delivered_quantity", 0) or 0)) > 0 for it in item_list
        )
        if pushable_by_item is not None:
            has_pushable_qty = any(q > Decimal("0") for q in pushable_by_item.values())
        elif item_list:
            from apps.kuaizhizao.utils.sales_order_push_qty import compute_backorder_qty

            has_pushable_qty = any(compute_backorder_qty(it) > Decimal("0") for it in item_list)
        else:
            has_pushable_qty = False
        pushed = bool(demand and getattr(demand, "pushed_to_computation", False))
        if getattr(order, "planning_pushed_to_computation", False):
            pushed = True
        return {
            "pushed_to_computation": pushed,
            "has_items": has_items,
            "has_line_work_orders": has_line_work_orders,
            "computation_pushed_blocks_withdraw": pushed,
            "has_returnable_qty": has_returnable_qty,
            "has_pushable_qty": has_pushable_qty,
            "has_existing_delivery_project": has_existing_delivery_project,
        }

    async def _assert_sales_order_capability_for_order(
        self,
        tenant_id: int,
        order: SalesOrder,
        action: str,
        items: Optional[List[SalesOrderItem]] = None,
    ) -> None:
        demand = await self._get_linked_demand(tenant_id, order.id)
        if items is None:
            items = await SalesOrderItem.filter(
                tenant_id=tenant_id, sales_order_id=order.id
            ).all()
        from apps.kuaizhizao.utils.sales_order_push_qty import get_pushable_qty_for_order_items

        pushable_by_item = await get_pushable_qty_for_order_items(
            tenant_id, order.id, items
        )
        has_existing_delivery_project = await self._order_has_delivery_project(
            tenant_id, order.id
        )
        ctx = self._sales_order_capability_context(
            order, items, demand, pushable_by_item=pushable_by_item,
            has_existing_delivery_project=has_existing_delivery_project,
        )
        assert_sales_order_capability(order, action, **ctx)

    async def _sync_demand_if_exists(self, tenant_id: int, order_id: int, operator_id: int) -> bool:
        """销售订单保存后，将关联 Demand/DemandItem 与订单明细对齐（策略 A）。"""
        demand = await Demand.get_or_none(
            tenant_id=tenant_id,
            source_type="sales_order",
            source_id=order_id,
            deleted_at__isnull=True,
        )
        if not demand:
            return False
        try:
            from apps.kuaizhizao.services.demand_service import DemandService

            result = await DemandService().sync_from_upstream(
                tenant_id=tenant_id,
                source_type="sales_order",
                source_id=order_id,
                operator_id=operator_id,
            )
            return bool(result.get("synced"))
        except Exception as e:
            logger.warning("销售订单关联需求同步失败 order_id={}: {}", order_id, e)
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

    def _is_terminal_business_status(self, status: Optional[str]) -> bool:
        """已关闭/已完成/已取消：禁止被「审核状态自动修复」回写成 AUDITED。"""
        return (
            self._is_closed(status)
            or self._is_completed_status(status)
            or self._is_cancelled_status(status)
            or self._is_rejected_status(status)
        )

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
        from apps.kuaicaiwu.services.credit_limit_service import CreditLimitService

        await CreditLimitService().validate_customer_exposure(
            tenant_id=tenant_id,
            customer_id=customer_id,
            customer_name=customer_name,
            additional_amount=order_total_amount,
            scene="销售订单审核",
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
                to_api_isoformat(order_date)
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
        today = today_site_str()
        import uuid
        return f"SO-{today}-{uuid.uuid4().hex[:6].upper()}"

    async def _validate_sales_order_contract(
        self,
        tenant_id: int,
        sales_order_data: SalesOrderCreate,
    ) -> None:
        """校验销售订单与合同的关联要求及合同有效性。"""
        from apps.kuaizhizao.models.sales_contract import SalesContract
        from apps.kuaizhizao.services.document_lifecycle_service import _is_approved

        cfg = await self.business_config_service.get_business_config(tenant_id)
        require_contract = bool(
            cfg.get("parameters", {}).get("sales", {}).get("require_contract_before_order", False)
        )
        if require_contract:
            raise BusinessLogicError(
                "配置项「须先建销售合同再下推订单」已废弃，请在业务配置中关闭 require_contract_before_order"
            )
        contract_id = getattr(sales_order_data, "contract_id", None)
        if not contract_id:
            return
        contract = await SalesContract.get_or_none(
            tenant_id=tenant_id, id=contract_id, deleted_at__isnull=True
        )
        if not contract:
            raise NotFoundError(f"销售合同不存在: {contract_id}")
        ctype = (contract.contract_type or "single").strip()
        if ctype != "framework":
            # 存量单次合同在迁移打标前仍允许释放；新建仅框架
            if ctype != "single" or getattr(contract, "migrated_to_order_at", None):
                raise BusinessLogicError("仅框架合同可关联释放销售订单")
        st = (contract.status or "").strip()
        if st not in ("已生效", "执行中"):
            raise BusinessLogicError("关联的销售合同须已生效")
        if not _is_approved(contract.review_status):
            raise BusinessLogicError("关联的销售合同未审核通过")
        # 金额总框：仅引用关联，不走明细释放
        if getattr(contract, "enter_line_items", True) is False:
            if not sales_order_data.contract_code:
                sales_order_data.contract_code = contract.contract_code
            return
        if not sales_order_data.contract_code:
            sales_order_data.contract_code = contract.contract_code

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

        await self._validate_sales_order_contract(tenant_id, sales_order_data)

        # 自动占号场景：即使前端已带 order_code，冲突时仍在服务端重占号重试
        last_error: Exception | None = None
        for attempt in range(5):
            if not sales_order_data.order_code or attempt > 0:
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
                last_error = e
                logger.warning(
                    "销售订单编码冲突，重试占号 attempt={} code={} err={}",
                    attempt + 1,
                    sales_order_data.order_code,
                    e,
                )
                sales_order_data.order_code = None
        raise ValidationError("销售订单编码已存在，请关闭弹窗后重新新建") from last_error

    async def _create_sales_order_in_tx(
        self,
        tenant_id: int,
        sales_order_data: SalesOrderCreate,
        created_by: int,
    ) -> SalesOrderResponse:
        """创建销售订单（事务内）。"""
        async with in_transaction():
            from apps.common.base_service import AppBaseService
            operator_name = await AppBaseService().get_user_name(created_by)
            self._validate_sales_order_non_negative(
                discount_amount=getattr(sales_order_data, "discount_amount", Decimal("0")) or Decimal("0"),
                total_quantity=getattr(sales_order_data, "total_quantity", None),
                total_amount=getattr(sales_order_data, "total_amount", None),
                total_fee_amount=getattr(sales_order_data, "total_fee_amount", None),
            )
            order_dict = sales_order_data.model_dump(exclude=_SALES_ORDER_PERSIST_EXCLUDE)
            from apps.kuaizhizao.services.sales_order_terms_service import SalesOrderTermsService

            terms_svc = SalesOrderTermsService()
            term_group_id, term_group_name, contract_terms = await terms_svc.resolve_order_terms(
                tenant_id,
                sales_order_data.term_group_id,
                sales_order_data.contract_terms,
            )
            order_dict["term_group_id"] = term_group_id
            order_dict["term_group_name"] = term_group_name
            order_dict["contract_terms"] = contract_terms
            order_dict["status"] = sales_order_data.status
            order_dict["review_status"] = sales_order_data.review_status
            order_dict["created_by"] = created_by
            order_dict["created_by_name"] = operator_name
            order_dict["updated_by"] = created_by
            order_dict["updated_by_name"] = operator_name
            # 表字段非空；总额/总数量在明细处理后回写，此处占位
            if order_dict.get("total_amount") is None:
                order_dict["total_amount"] = Decimal("0")
            if order_dict.get("total_quantity") is None:
                order_dict["total_quantity"] = Decimal("0")

            # 自动带出归属业务员与月结方式
            partner_settlement_method = None
            if order_dict.get("customer_id"):
                from apps.master_data.models.customer import Customer
                customer = await Customer.get_or_none(id=order_dict["customer_id"], deleted_at__isnull=True)
                if customer:
                    partner_settlement_method = customer.settlement_method_code
                    if not order_dict.get("salesman_id") and customer.salesman_id:
                        order_dict["salesman_id"] = customer.salesman_id
                        order_dict["salesman_name"] = customer.salesman_name

            order = await SalesOrder.create(tenant_id=tenant_id, **order_dict)

            total_qty = Decimal("0")
            subtotal = Decimal("0")
            item_rows: List[Dict[str, Any]] = []
            material_map = await self._load_material_master_map(
                tenant_id,
                [item_data.material_id for item_data in sales_order_data.items],
            )
            for item_data in sales_order_data.items:
                row = self._process_sales_order_item_pricing(
                    item_data,
                    material_map,
                    money_fn=self._money,
                    partner_settlement_method=partner_settlement_method,
                )
                total_qty += row["order_quantity"]
                subtotal += row["_item_amount"]
                item_rows.append(row)

            discount = Decimal(str(getattr(sales_order_data, "discount_amount", None) or 0))
            # 仅调用方显式传入 total_amount 时才整单覆盖；省略（含旧默认 0）按明细汇总
            provided_total = (
                sales_order_data.total_amount
                if "total_amount" in sales_order_data.model_fields_set
                else None
            )
            target_total = (
                Decimal(str(provided_total))
                if provided_total is not None
                else max(Decimal("0"), subtotal - discount)
            )
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
                    is_gift=row["is_gift"],
                    gift_ref_unit_price=row["gift_ref_unit_price"],
                    price_settlement_status=row["price_settlement_status"],
                    provisional_unit_price=row["provisional_unit_price"],
                )
            total_amt = sum(allocated_amounts, Decimal("0"))
            await SalesOrder.filter(id=order.id).update(
                total_quantity=total_qty,
                total_amount=total_amt,
            )
            order = await SalesOrder.get(id=order.id)
            await terms_svc.replace_order_milestones(
                tenant_id, int(order.id), sales_order_data.payment_milestones
            )
            items = await SalesOrderItem.filter(
                tenant_id=tenant_id, sales_order_id=order.id
            ).order_by("id")
            demand = await self._get_linked_demand(tenant_id, order.id)
            shipped_by = await self._shipped_qty_by_sales_order(tenant_id, [order.id])
            dp = self._merged_delivery_progress(order, list(items), shipped_by.get(order.id, Decimal("0")))
            audit_enabled = await self.business_config_service.check_audit_required(tenant_id, "sales_order")
            payment_milestones = await terms_svc.load_payment_milestones(tenant_id, int(order.id))
            return self._order_to_response(
                order,
                items=items,
                demand=demand,
                delivery_progress=dp,
                audit_enabled=audit_enabled,
                payment_milestones=payment_milestones,
            )

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
        view: Optional[str] = None,
        current_user: Optional["User"] = None,
    ) -> SalesOrderResponse:
        """获取销售订单详情。

        view=options：选单/关联轻量详情，跳过里程碑/账款/可发货/capabilities。
        """
        order = await SalesOrder.get_or_none(
            tenant_id=tenant_id, id=sales_order_id, deleted_at__isnull=True
        )
        if not order:
            raise NotFoundError(f"销售订单不存在: {sales_order_id}")
        if current_user:
            from apps.kuaizhizao.services.kuaizhizao_data_scope import (
                assert_sales_order_row_visible_or_quality_linked,
            )

            await assert_sales_order_row_visible_or_quality_linked(
                order,
                tenant_id=tenant_id,
                user=current_user,
            )

        if (view or "").strip().lower() == "options":
            option_items: Optional[List[SalesOrderItem]] = None
            if include_items:
                option_items = await SalesOrderItem.filter(
                    tenant_id=tenant_id, sales_order_id=sales_order_id
                ).order_by("id").all()
            return self._order_to_options_response(order, items=option_items)

        # 不同步时自动修复（终态 CLOSED/COMPLETED/CANCELLED 不得回写成 AUDITED）
        if self._is_terminal_business_status(order.status):
            pass
        elif self._is_review_approved(order.review_status) and not self._is_audited(order.status):
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
            # 有 material_id 时从物料主数据补全展示字段（明细快照与主数据不一致时以主数据为准）
            if items:
                from apps.master_data.models.material import Material
                material_ids = list({int(it.material_id) for it in items if it.material_id})
                if material_ids:
                    materials = await Material.filter(
                        id__in=material_ids, deleted_at__isnull=True
                    ).all()
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

        audit_enabled = await self.business_config_service.check_audit_required(tenant_id, "sales_order")
        from apps.kuaizhizao.utils.sales_order_push_qty import get_pushable_qty_for_order_items

        pushable_by_item = await get_pushable_qty_for_order_items(
            tenant_id, sales_order_id, items
        )
        has_existing_delivery_project = await self._order_has_delivery_project(
            tenant_id, sales_order_id
        )
        from apps.kuaizhizao.services.sales_order_terms_service import SalesOrderTermsService

        payment_milestones = await SalesOrderTermsService.load_payment_milestones(
            tenant_id, sales_order_id
        )
        resp = enrich_sales_order_capabilities_on_response(
            order,
            self._order_to_response(
                order,
                items=items,
                demand=demand,
                duration_info=duration_info,
                material_code_fallback=material_code_fallback,
                material_fallback=material_fallback,
                milestones=milestones,
                payment_milestones=payment_milestones,
                delivery_progress=delivery_progress,
                invoice_progress=finance.get("invoice_progress", 0.0),
                invoice_amount_progress=finance.get("invoice_amount_progress", 0.0),
                collection_progress=finance.get("collection_progress", 0.0),
                shippable_hint=shippable_map.get(sales_order_id),
                audit_enabled=audit_enabled,
            ),
            **self._sales_order_capability_context(
                order, items, demand, pushable_by_item=pushable_by_item,
                has_existing_delivery_project=has_existing_delivery_project,
            ),
        )
        return resp

    async def _sales_order_ids_matching_lifecycle(
        self,
        tenant_id: int,
        query,
        lifecycle_stage: str,
        order_clause: str,
    ) -> List[int]:
        """按 get_sales_order_lifecycle 同一套谓词筛 id：表头 values + 明细/出库/账款 GROUP BY，不物化全部明细行。"""
        from types import SimpleNamespace
        from tortoise.functions import Sum
        from apps.kuaizhizao.services.document_lifecycle_service import (
            get_sales_order_lifecycle,
            normalize_sales_order_lifecycle_filter,
        )

        target = normalize_sales_order_lifecycle_filter(lifecycle_stage)
        headers = await query.order_by(order_clause).values(
            "id",
            "status",
            "review_status",
            "total_quantity",
            "total_amount",
            "order_code",
            "planning_pushed_to_computation",
        )
        if not headers:
            return []

        order_ids = [int(h["id"]) for h in headers]
        item_rows = await SalesOrderItem.filter(
            tenant_id=tenant_id,
            sales_order_id__in=order_ids,
        ).group_by("sales_order_id").annotate(
            order_qty=Sum("order_quantity"),
            delivered_qty=Sum("delivered_quantity"),
        ).values("sales_order_id", "order_qty", "delivered_qty")
        qty_by_order = {
            int(row["sales_order_id"]): (
                Decimal(str(row.get("order_qty") or 0)),
                Decimal(str(row.get("delivered_qty") or 0)),
            )
            for row in item_rows
        }
        wo_order_ids = set(
            int(oid)
            for oid in await SalesOrderItem.filter(
                tenant_id=tenant_id,
                sales_order_id__in=order_ids,
                work_order_id__isnull=False,
            ).distinct().values_list("sales_order_id", flat=True)
            if oid
        )
        demand_rows = await Demand.filter(
            tenant_id=tenant_id,
            source_type="sales_order",
            source_id__in=order_ids,
            deleted_at__isnull=True,
        ).values("source_id", "pushed_to_computation")
        pushed_by_order = {
            int(row["source_id"]): bool(row.get("pushed_to_computation"))
            for row in demand_rows
        }
        deliveries = await SalesDelivery.filter(
            tenant_id=tenant_id,
            sales_order_id__in=order_ids,
            deleted_at__isnull=True,
        ).values_list("id", "sales_order_id")
        order_to_deliveries: Dict[int, List[int]] = {}
        for did, oid in deliveries:
            order_to_deliveries.setdefault(int(oid), []).append(int(did))

        lite_orders = [SimpleNamespace(**h) for h in headers]
        finance_progress_by_order = await self._batch_finance_progress_by_order(
            tenant_id, lite_orders, order_to_deliveries
        )
        shipped_by_order = await self._shipped_qty_by_sales_order(tenant_id, order_ids)

        matched_ids: List[int] = []
        for header in lite_orders:
            oid = int(header.id)
            order_qty, delivered_qty = qty_by_order.get(oid, (Decimal("0"), Decimal("0")))
            has_wo = oid in wo_order_ids
            items = [
                SimpleNamespace(
                    order_quantity=order_qty,
                    delivered_quantity=delivered_qty,
                    work_order_id=1 if has_wo else None,
                )
            ]
            ship_q = shipped_by_order.get(oid, Decimal("0"))
            dp = self._merged_delivery_progress(header, items, ship_q)
            finance = finance_progress_by_order.get(oid, {})
            pushed = pushed_by_order.get(oid, False) or bool(
                getattr(header, "planning_pushed_to_computation", False)
            )
            lifecycle = get_sales_order_lifecycle(
                header,
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
                matched_ids.append(oid)
        return matched_ids

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
        customer_id: Optional[int] = None,
        customer_name: Optional[str] = None,
        order_code: Optional[str] = None,
        contract_code: Optional[str] = None,
        salesman_id: Optional[int] = None,
        keyword: Optional[str] = None,
        order_by: Optional[str] = None,
        include_items: bool = False,
        list_scope: Optional[str] = None,
        pullable_only: Optional[bool] = None,
        pull_target: Optional[str] = None,
        view: Optional[str] = None,
        column_filters: Optional[str] = None,
        current_user: Optional["User"] = None,
    ) -> SalesOrderListResponse:
        """获取销售订单列表。order_by 如 order_code、-created_at（前缀-表示降序）

        view=options：仅返回下拉关联所需轻量字段，跳过账款/进度/capabilities 等重计算。
        """
        from tortoise.expressions import Q

        query = SalesOrder.filter(tenant_id=tenant_id, deleted_at__isnull=True)
        query = await self._apply_sales_order_list_scope(
            query,
            tenant_id=tenant_id,
            current_user=current_user,
            list_scope=list_scope,
        )
        lifecycle_filter = (lifecycle_stage or "").strip()
        if status and not lifecycle_filter:
            query = query.filter(status=status)
        if review_status and not lifecycle_filter:
            query = query.filter(review_status=review_status)
        if start_date:
            query = query.filter(order_date__gte=start_date)
        if end_date:
            query = query.filter(order_date__lte=end_date)
        if customer_id is not None and int(customer_id) > 0:
            query = query.filter(customer_id=int(customer_id))
        if customer_name and str(customer_name).strip():
            query = query.filter(customer_name__icontains=customer_name.strip())
        if order_code and str(order_code).strip():
            query = query.filter(order_code__icontains=order_code.strip())
        if contract_code and str(contract_code).strip():
            query = query.filter(contract_code__icontains=contract_code.strip())
        if salesman_id is not None and int(salesman_id) > 0:
            query = query.filter(salesman_id=int(salesman_id))
        if keyword and str(keyword).strip():
            kw = keyword.strip()
            query = query.filter(
                Q(order_code__icontains=kw)
                | Q(customer_name__icontains=kw)
                | Q(salesman_name__icontains=kw)
                | Q(contract_code__icontains=kw)
            )
        if column_filters:
            from apps.kuaizhizao.utils.column_filters import (
                apply_column_filters_to_queryset,
                parse_column_filters_param,
            )

            query = apply_column_filters_to_queryset(
                query,
                parse_column_filters_param(column_filters),
                allowed_fields={
                    "status",
                    "review_status",
                    "order_code",
                    "customer_name",
                    "salesman_name",
                    "contract_code",
                    "order_date",
                    "delivery_date",
                    "total_amount",
                },
            )
        # 加载建销售变更：与 is_source_order_locked_for_direct_edit / 前端 isSourceOrderEligibleForChange 对齐
        pull_target_norm = (pull_target or "").strip().lower()
        if pullable_only and pull_target_norm == "sales_order_change":
            change_eligible_statuses = (
                "AUDITED",
                "CONFIRMED",
                "IN_PROGRESS",
                "COMPLETED",
                "CLOSED",
                "RELEASED",
                "已审核",
                "审核通过",
                "已确认",
                "执行中",
                "进行中",
                "已完成",
                "已关闭",
                "已下达",
            )
            approved_review = ("APPROVED", "已通过", "审核通过", "通过", "已审核")
            excluded_for_review_gate = (
                "DRAFT",
                "PENDING_REVIEW",
                "REJECTED",
                "草稿",
                "待审核",
                "已驳回",
            )
            query = query.filter(
                Q(status__in=change_eligible_statuses)
                | (
                    Q(review_status__in=approved_review)
                    & ~Q(status__in=excluded_for_review_gate)
                )
            )
        # 加载建售后服务：仅已出库（已发货）的销售订单
        if pullable_only and pull_target_norm in ("after_sales_ticket", "install_execution"):
            shipped_order_ids = await SalesDelivery.filter(
                tenant_id=tenant_id,
                deleted_at__isnull=True,
                status="已出库",
                sales_order_id__isnull=False,
            ).distinct().values_list("sales_order_id", flat=True)
            query = query.filter(id__in=list({int(oid) for oid in shipped_order_ids if oid}))

        # 加载建销售退货：已审核且存在已交货数量（与 push_sales_return 门禁一致）
        if pullable_only and pull_target_norm == "sales_return":
            returnable_order_ids = await SalesOrderItem.filter(
                tenant_id=tenant_id,
                delivered_quantity__gt=0,
            ).distinct().values_list("sales_order_id", flat=True)
            approved_review = ("APPROVED", "已通过", "审核通过", "通过", "已审核")
            audited_statuses = (
                "AUDITED",
                "CONFIRMED",
                "IN_PROGRESS",
                "COMPLETED",
                "CLOSED",
                "RELEASED",
                "已审核",
                "审核通过",
                "已确认",
                "执行中",
                "进行中",
                "已完成",
                "已关闭",
                "已下达",
            )
            query = query.filter(
                id__in=list({int(oid) for oid in returnable_order_ids if oid}),
            ).filter(
                Q(status__in=audited_statuses)
                | Q(review_status__in=approved_review)
            )

        if pullable_only and pull_target_norm in ("shipment_notice", "sales_delivery"):
            pull_audited_statuses = (
                "AUDITED",
                "CONFIRMED",
                "IN_PROGRESS",
                "已审核",
                "审核通过",
                "已确认",
                "执行中",
                "进行中",
            )
            approved_review = ("APPROVED", "已通过", "审核通过", "通过", "已审核")
            query = query.filter(
                Q(status__in=pull_audited_statuses)
                | Q(review_status__in=approved_review)
            )
            pre_ids = await query.values_list("id", flat=True)
            if pre_ids:
                from apps.kuaizhizao.utils.sales_order_push_qty import batch_orders_with_pushable_qty

                pre_items = await SalesOrderItem.filter(
                    tenant_id=tenant_id,
                    sales_order_id__in=list(pre_ids),
                ).all()
                pushable_ids = await batch_orders_with_pushable_qty(tenant_id, pre_items)
                query = query.filter(
                    id__in=list(pushable_ids) if pushable_ids else [-1]
                )
            else:
                query = query.filter(id=-1)

        if pullable_only and pull_target_norm == "demand_computation":
            pull_audited_statuses = (
                "AUDITED",
                "CONFIRMED",
                "IN_PROGRESS",
                "已审核",
                "审核通过",
                "已确认",
                "执行中",
                "进行中",
            )
            approved_review = ("APPROVED", "已通过", "审核通过", "通过", "已审核")
            query = query.filter(
                Q(status__in=pull_audited_statuses)
                | Q(review_status__in=approved_review)
            ).filter(planning_pushed_to_computation=False)
            line_wo_order_ids = await SalesOrderItem.filter(
                tenant_id=tenant_id,
                work_order_id__isnull=False,
            ).exclude(work_order_id=0).distinct().values_list("sales_order_id", flat=True)
            wo_ids = {int(oid) for oid in line_wo_order_ids if oid}
            if wo_ids:
                query = query.exclude(id__in=list(wo_ids))

        order_clause = order_by if order_by else "-created_at"

        if lifecycle_filter:
            from apps.kuaizhizao.services.document_lifecycle_service import (
                normalize_sales_order_lifecycle_filter,
            )

            target = normalize_sales_order_lifecycle_filter(lifecycle_filter)
            if target == "已取消":
                query = query.filter(status__in=["CANCELLED", "已取消"])
                total = await query.count()
                orders = await query.offset(skip).limit(limit).order_by(order_clause)
            elif target == "已关闭":
                query = query.filter(status__in=["CLOSED", "已关闭", "closed"])
                total = await query.count()
                orders = await query.offset(skip).limit(limit).order_by(order_clause)
            else:
                matched_ids = await self._sales_order_ids_matching_lifecycle(
                    tenant_id, query, lifecycle_filter, order_clause
                )
                total = len(matched_ids)
                page_ids = matched_ids[skip : skip + limit]
                if page_ids:
                    fetched = await SalesOrder.filter(
                        tenant_id=tenant_id, id__in=page_ids
                    ).order_by(order_clause)
                    by_id = {int(o.id): o for o in fetched}
                    orders = [by_id[oid] for oid in page_ids if oid in by_id]
                else:
                    orders = []
        else:
            total = await query.count()
            orders = await query.offset(skip).limit(limit).order_by(order_clause)

        if not orders:
            return SalesOrderListResponse(data=[], total=total, success=True)

        # 选单/关联：轻量表头（可选明细），跳过账款/进度/capabilities
        if (view or "").strip().lower() == "options":
            option_items_by_order: Dict[int, List[SalesOrderItem]] = {}
            if include_items:
                option_order_ids = [o.id for o in orders]
                if option_order_ids:
                    option_all_items = await SalesOrderItem.filter(
                        tenant_id=tenant_id,
                        sales_order_id__in=option_order_ids,
                    ).order_by("sales_order_id", "id").all()
                    for it in option_all_items:
                        option_items_by_order.setdefault(it.sales_order_id, []).append(it)
            return SalesOrderListResponse(
                data=[
                    self._order_to_options_response(
                        o,
                        items=option_items_by_order.get(o.id, []) if include_items else None,
                    )
                    for o in orders
                ],
                total=total,
                success=True,
            )

        order_ids = [o.id for o in orders]

        # 1. 批量状态同步（不同步时自动修复；终态不回写 AUDITED）
        need_audit_sync = []
        need_review_sync = []
        for order in orders:
            if self._is_terminal_business_status(order.status):
                continue
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
            # 列表头 + capabilities 所需最小明细字段（不拉完整 items）
            items_agg_rows = await SalesOrderItem.filter(
                tenant_id=tenant_id,
                sales_order_id__in=order_ids,
            ).values_list(
                "id",
                "sales_order_id",
                "order_quantity",
                "delivered_quantity",
                "remaining_quantity",
                "material_id",
                "work_order_id",
            )
            for iid, oid, qty, delivered, remaining, material_id, work_order_id in items_agg_rows:
                items_by_order.setdefault(oid, []).append(
                    type(
                        "_AggItem",
                        (),
                        {
                            "id": iid,
                            "sales_order_id": oid,
                            "order_quantity": qty,
                            "delivered_quantity": delivered,
                            "remaining_quantity": remaining,
                            "material_id": material_id,
                            "work_order_id": work_order_id,
                        },
                    )()
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
        pushed_work_orders_by_order = await self._pushed_work_orders_by_sales_order(
            tenant_id=tenant_id,
            sales_order_ids=order_ids,
        )
        audit_enabled = await self.business_config_service.check_audit_required(tenant_id, "sales_order")

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

        from apps.kuaizhizao.utils.sales_order_push_qty import batch_pushable_qty_by_order_item

        all_list_items = [it for items in items_by_order.values() for it in items]
        pushable_by_order = await batch_pushable_qty_by_order_item(tenant_id, all_list_items)
        delivery_project_by_order = await self._batch_has_delivery_project_by_order(
            tenant_id, order_ids
        )

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
            total_qty = Decimal(str(order.total_quantity or 0))
            pushed_bucket = pushed_work_orders_by_order.get(order.id) or {
                "qty": Decimal("0"),
                "codes": [],
            }
            pushed_qty = Decimal(str(pushed_bucket.get("qty") or 0))
            pushed_codes = list(pushed_bucket.get("codes") or [])
            remaining_qty = total_qty - pushed_qty
            if remaining_qty < 0:
                remaining_qty = Decimal("0")
            if total_qty > 0:
                push_ratio = float((pushed_qty / total_qty) * Decimal("100"))
                push_ratio = max(0.0, min(100.0, push_ratio))
            else:
                push_ratio = 0.0

            sales_orders.append(
                enrich_sales_order_capabilities_on_response(
                    order,
                    self._order_to_response(
                        order,
                        items=items_for_response,
                        demand=demand_by_order.get(order.id),
                        delivery_progress=delivery_progress,
                        invoice_progress=invoice_progress_val,
                        invoice_amount_progress=invoice_amount_progress_val,
                        collection_progress=collection_progress_val,
                        pushed_work_order_quantity=pushed_qty,
                        remaining_push_quantity=remaining_qty,
                        work_order_push_progress=push_ratio,
                        pushed_work_order_codes=pushed_codes,
                        material_code_fallback=material_code_fallback_all.get(order.id) if include_items else None,
                        material_fallback=material_fallback_all.get(order.id) if include_items else None,
                        shippable_hint=shippable_map.get(order.id),
                        audit_enabled=audit_enabled,
                    ),
                    **self._sales_order_capability_context(
                        order,
                        items,
                        demand_by_order.get(order.id),
                        pushable_by_item=pushable_by_order.get(order.id),
                        has_existing_delivery_project=delivery_project_by_order.get(
                            order.id, False
                        ),
                    ),
                )
            )
        return SalesOrderListResponse(data=sales_orders, total=total, success=True)

    async def update_sales_order(
        self,
        tenant_id: int,
        sales_order_id: int,
        sales_order_data: SalesOrderUpdate,
        updated_by: int,
        current_user: Optional["User"] = None,
        approval_edit_context: Optional[Dict[str, Any]] = None,
        approval_edit_comment: Optional[str] = None,
    ) -> SalesOrderResponse:
        """更新销售订单。支持草稿与已审核订单（含反审核后编辑）；已审核订单保存后同步关联需求。"""
        order = await SalesOrder.get_or_none(
            tenant_id=tenant_id, id=sales_order_id, deleted_at__isnull=True
        )
        if not order:
            raise NotFoundError(f"销售订单不存在: {sales_order_id}")
        if current_user:
            await DataScopeService.assert_row_visible(
                order,
                tenant_id=tenant_id,
                user=current_user,
                resource="kuaizhizao:sales-order",
            )
        await self._assert_sales_order_capability_for_order(tenant_id, order, "update")

        if self._is_pending_review_status(order.status) and not approval_edit_context:
            submitter_id = getattr(order, "created_by", None) or getattr(order, "submitted_by", None)
            if submitter_id and int(updated_by) != int(submitter_id):
                from core.services.approval.approval_edit_guard import ApprovalEditGuard

                edit_ctx = await ApprovalEditGuard.get_pending_edit_context(
                    tenant_id, "sales_order", sales_order_id, updated_by
                )
                if not edit_ctx:
                    raise BusinessLogicError("单据审核中，仅发起人或已开启改单权限的当前审批人可修改")

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

        if approval_edit_context:
            from core.config.audit_editable_fields import is_field_editable
            node_editable = approval_edit_context.get("editable_fields")
            upd_preview = sales_order_data.model_dump(
                exclude_unset=True, exclude=_SALES_ORDER_PERSIST_EXCLUDE
            )
            for k in upd_preview:
                if k in ("updated_by",):
                    continue
                if not is_field_editable("sales_order", k, node_editable):
                    raise ValidationError(f"字段「{k}」不允许在审核中修改")
            if items_changed and not is_field_editable("sales_order", "items", node_editable):
                raise ValidationError("字段「订单明细」不允许在审核中修改")

        async with in_transaction():
            from apps.common.base_service import AppBaseService
            from apps.kuaizhizao.services.sales_order_terms_service import SalesOrderTermsService

            terms_svc = SalesOrderTermsService()
            updater_name = await AppBaseService().get_user_name(updated_by)
            self._validate_sales_order_non_negative(
                discount_amount=getattr(sales_order_data, "discount_amount", Decimal("0")) or Decimal("0"),
                total_quantity=getattr(sales_order_data, "total_quantity", None),
                total_amount=getattr(sales_order_data, "total_amount", None),
                total_fee_amount=getattr(sales_order_data, "total_fee_amount", None),
            )
            upd = sales_order_data.model_dump(
                exclude_unset=True, exclude=_SALES_ORDER_PERSIST_EXCLUDE
            )
            if "term_group_id" in sales_order_data.model_fields_set or sales_order_data.contract_terms is not None:
                term_group_id, term_group_name, contract_terms = await terms_svc.resolve_order_terms(
                    tenant_id,
                    sales_order_data.term_group_id if "term_group_id" in sales_order_data.model_fields_set else order.term_group_id,
                    sales_order_data.contract_terms if sales_order_data.contract_terms is not None else None,
                )
                upd["term_group_id"] = term_group_id
                upd["term_group_name"] = term_group_name
                upd["contract_terms"] = contract_terms
            upd["updated_by"] = updated_by
            upd["updated_by_name"] = updater_name
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
                material_map = await self._load_material_master_map(
                    tenant_id,
                    [item_data.material_id for item_data in sales_order_data.items],
                )
                for item_data in sales_order_data.items:
                    row = self._process_sales_order_item_pricing(
                        item_data,
                        material_map,
                        money_fn=self._money,
                    )
                    total_qty += row["order_quantity"]
                    subtotal += row["_item_amount"]
                    item_rows.append(row)
                discount = Decimal(str(getattr(sales_order_data, "discount_amount", None) or 0))
                provided_total = (
                    sales_order_data.total_amount
                    if "total_amount" in sales_order_data.model_fields_set
                    else None
                )
                target_total = (
                    Decimal(str(provided_total))
                    if provided_total is not None
                    else max(Decimal("0"), subtotal - discount)
                )
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
                        is_gift=row["is_gift"],
                        gift_ref_unit_price=row["gift_ref_unit_price"],
                    )
                total_amt = sum(allocated_amounts, Decimal("0"))
                await SalesOrder.filter(id=sales_order_id).update(
                    total_quantity=total_qty,
                    total_amount=total_amt,
                )

            if sales_order_data.payment_milestones is not None:
                await terms_svc.replace_order_milestones(
                    tenant_id, sales_order_id, sales_order_data.payment_milestones
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
                {
                    "changed_fields": changed_fields,
                    "field_changes": field_changes,
                    "approval_edit": bool(approval_edit_context),
                    "approval_instance_id": (
                        approval_edit_context.get("approval_instance_id") if approval_edit_context else None
                    ),
                },
                ensure_ascii=False,
            )
            await self._log_state_transition(
                tenant_id, sales_order_id,
                order.status or "DRAFT", order.status or "DRAFT",
                updated_by, operator_name,
                reason="编辑",
                reason_extra=reason_extra,
            )
            if approval_edit_context and field_changes:
                from core.services.approval.approval_edit_guard import ApprovalEditGuard

                await ApprovalEditGuard.record_document_edit(
                    tenant_id,
                    approval_edit_context,
                    updated_by,
                    field_changes,
                    comment=approval_edit_comment,
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
        # 订单变更事件：统一进入需求重算编排链路
        try:
            from apps.kuaizhizao.services.demand_change_event_service import DemandChangeEventService
            await DemandChangeEventService().create_event(
                tenant_id=tenant_id,
                event_type="order",
                source_type="sales_order",
                source_id=sales_order_id,
                source_code=order.order_code,
                source_name=order.order_code,
                changed_fields=[str(x) for x in changed_fields] if changed_fields else [],
                payload={"field_changes": field_changes or []},
                effective_at=resolve_business_datetime(),
                trigger_reason="sales_order_updated",
                requested_by=updated_by,
                correlation_id=f"sales_order:{sales_order_id}:{int(resolve_business_datetime().timestamp())}",
                auto_create_task=True,
            )
        except Exception as e:
            logger.warning("create demand change event failed: %s", e)
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
                    review_time=resolve_business_datetime(),
                    updated_by=submitted_by,
                )
                await self._log_state_transition(
                    tenant_id, sales_order_id,
                    DemandStatus.DRAFT, DemandStatus.CONFIRMED,
                    submitted_by, submitter_name, "提交并自动确认",
                )
                # 不再在提交时自动创建/同步 Demand，避免形成「订单→需求计划」隐式链路。
            order_row = await SalesOrder.get(tenant_id=tenant_id, id=sales_order_id)
            from apps.kuaicaiwu.services.finance_integration_hooks import (
                ensure_prepayment_receipt_for_sales_order,
            )

            await ensure_prepayment_receipt_for_sales_order(
                tenant_id=tenant_id,
                order_id=sales_order_id,
                order_code=order_row.order_code,
                customer_id=order_row.customer_id,
                customer_name=order_row.customer_name,
                prepayment_amount=order_row.prepayment_amount,
                prepayment_bank_account_id=order_row.prepayment_bank_account_id,
                operator_id=submitted_by,
            )
            return await self.get_sales_order_by_id(tenant_id, sales_order_id)

        from core.services.approval.approval_instance_service import ApprovalInstanceService
        instance = await ApprovalInstanceService.start_approval_for_node(
            tenant_id=tenant_id,
            user_id=submitted_by,
            node_key="sales_order",
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

        # 审核已开启却未建实例 = 配置错误（缺审批流程/未激活），显式报错，不做兜底待审核。
        raise BusinessLogicError(
            "销售订单审核已开启但未找到可用的审批流程，请在配置中心检查 sales_order 审批流程是否已激活"
        )

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

        from core.services.approval.uni_audit_service import UniAuditService

        async def _do_approve() -> SalesOrderResponse:
            from apps.common.base_service import AppBaseService
            approver_name = await AppBaseService().get_user_name(approved_by)

            async with in_transaction():
                await SalesOrder.filter(tenant_id=tenant_id, id=sales_order_id).update(
                    reviewer_id=approved_by,
                    reviewer_name=approver_name,
                    review_time=resolve_business_datetime(),
                    review_status=ReviewStatus.APPROVED,
                    status=DemandStatus.AUDITED,
                    updated_by=approved_by,
                )
                await self._log_state_transition(
                    tenant_id, sales_order_id,
                    DemandStatus.PENDING_REVIEW, DemandStatus.AUDITED,
                    approved_by, approver_name, "自动审核" if is_auto_approve else "审核通过",
                )
                demand_synced = False
            result = await self.get_sales_order_by_id(tenant_id, sales_order_id)
            order_row = await SalesOrder.get(tenant_id=tenant_id, id=sales_order_id)
            from apps.kuaicaiwu.services.finance_integration_hooks import (
                ensure_prepayment_receipt_for_sales_order,
            )

            await ensure_prepayment_receipt_for_sales_order(
                tenant_id=tenant_id,
                order_id=sales_order_id,
                order_code=order_row.order_code,
                customer_id=order_row.customer_id,
                customer_name=order_row.customer_name,
                prepayment_amount=order_row.prepayment_amount,
                prepayment_bank_account_id=order_row.prepayment_bank_account_id,
                operator_id=approved_by,
            )
            auto_push_result = await self._try_auto_push_order_to_computation(
                tenant_id=tenant_id,
                sales_order_id=sales_order_id,
                operator_id=approved_by,
            )
            out = result.model_dump()
            out["demand_synced"] = demand_synced
            if auto_push_result:
                out["auto_computation"] = auto_push_result
            from apps.kuaizhizao.services.kuaizhizao_business_notification import (
                notify_sales_order_approved,
            )

            try:
                await notify_sales_order_approved(
                    tenant_id,
                    order_code=order_row.order_code or str(sales_order_id),
                    customer_name=order_row.customer_name or "—",
                    delivery_date=str(order_row.delivery_date or ""),
                    sales_order_id=sales_order_id,
                    creator_user_id=order_row.created_by,
                    salesman_user_id=order_row.salesman_id,
                )
            except Exception as exc:
                logger.warning("销售订单审核消息提醒失败 tenant={} order={}: {}", tenant_id, sales_order_id, exc)
            return SalesOrderResponse(**out)

        result = await UniAuditService.approve_with_flow_fallback(
            tenant_id=tenant_id,
            entity_type="sales_order",
            entity_id=sales_order_id,
            approver_id=approved_by,
            flow_approve=_do_approve,
        )
        # 走流程时由完成回调写回，facade 返回 None，此处取最新单据返回。
        return result if result is not None else await self.get_sales_order_by_id(tenant_id, sales_order_id)

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

        from core.services.approval.uni_audit_service import UniAuditService

        async def _do_reject(reason: Optional[str]) -> SalesOrderResponse:
            from apps.common.base_service import AppBaseService
            approver_name = await AppBaseService().get_user_name(approved_by)

            reject_reason = reason or rejection_reason
            async with in_transaction():
                await SalesOrder.filter(tenant_id=tenant_id, id=sales_order_id).update(
                    reviewer_id=approved_by,
                    reviewer_name=approver_name,
                    review_time=resolve_business_datetime(),
                    review_status=ReviewStatus.REJECTED,
                    review_remarks=reject_reason,
                    status=DemandStatus.REJECTED,
                    updated_by=approved_by,
                )
                await self._log_state_transition(
                    tenant_id, sales_order_id,
                    DemandStatus.PENDING_REVIEW, DemandStatus.REJECTED,
                    approved_by, approver_name, f"驳回: {reject_reason}",
                )
            return await self.get_sales_order_by_id(tenant_id, sales_order_id)

        result = await UniAuditService.reject_with_flow_fallback(
            tenant_id=tenant_id,
            entity_type="sales_order",
            entity_id=sales_order_id,
            approver_id=approved_by,
            reason=rejection_reason,
            flow_reject=_do_reject,
        )
        return result if result is not None else await self.get_sales_order_by_id(tenant_id, sales_order_id)

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
        await self._assert_sales_order_capability_for_order(tenant_id, order, "revoke_approval")

        if self._is_strictly_audited_status(order.status) and not self._is_review_approved(order.review_status):
            await SalesOrder.filter(tenant_id=tenant_id, id=sales_order_id).update(
                review_status=ReviewStatus.APPROVED
            )
            order = await SalesOrder.get(tenant_id=tenant_id, id=sales_order_id)

        from core.services.approval.uni_audit_service import UniAuditService

        from core.services.approval.audit_transition import (
            resolve_revoke_landing_phase,
            resolve_sales_order_revoke_state,
        )

        audit_required = await self.business_config_service.check_audit_required(
            tenant_id, "sales_order"
        )
        landing = resolve_revoke_landing_phase(manual_audit_enabled=audit_required)
        revoke_state = resolve_sales_order_revoke_state(landing=landing)

        async def _do_revoke() -> SalesOrderResponse:
            # 历史兼容：若历史订单曾产生 Demand 且已下推需求计算，则先执行撤回下推。
            demand = await self._get_linked_demand(tenant_id, sales_order_id)
            if demand and demand.pushed_to_computation:
                await self.withdraw_sales_order_from_computation(tenant_id, sales_order_id)

            from apps.common.base_service import AppBaseService
            unapprover_name = await AppBaseService().get_user_name(unapproved_by)
            async with in_transaction():
                await SalesOrder.filter(tenant_id=tenant_id, id=sales_order_id).update(
                    status=revoke_state["status"],
                    review_status=revoke_state["review_status"],
                    reviewer_id=None,
                    reviewer_name=None,
                    review_time=None,
                    review_remarks=None,
                    updated_by=unapproved_by,
                )
                await self._log_state_transition(
                    tenant_id, sales_order_id,
                    order.status, revoke_state["status"],
                    unapproved_by, unapprover_name, "反审核",
                )
            return await self.get_sales_order_by_id(tenant_id, sales_order_id)

        return await UniAuditService.revoke_with_flow_fallback(
            tenant_id=tenant_id,
            entity_type="sales_order",
            entity_id=sales_order_id,
            operator_id=unapproved_by,
            flow_revoke=_do_revoke,
        )

    async def push_sales_order_to_computation(
        self,
        tenant_id: int,
        sales_order_id: int,
        created_by: int,
        selected_item_ids: Optional[List[int]] = None,
        selected_quantities: Optional[Dict[int, float]] = None,
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
        await self._assert_sales_order_capability_for_order(tenant_id, order, "push_computation")

        demand = await self._get_linked_demand(tenant_id, sales_order_id)
        if not demand:
            demand = await self._create_demand_from_sales_order(
                tenant_id,
                sales_order_id,
                created_by,
                selected_item_ids=selected_item_ids,
                selected_quantities=selected_quantities,
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

    @staticmethod
    async def _load_material_master_map(
        tenant_id: int,
        material_ids: List[int],
    ) -> Dict[int, Material]:
        ids = sorted({int(i) for i in material_ids if i and int(i) > 0})
        if not ids:
            return {}
        materials = await Material.filter(
            tenant_id=tenant_id,
            id__in=ids,
            deleted_at__isnull=True,
        ).all()
        return {m.id: m for m in materials}

    @staticmethod
    def _material_fields_from_master_or_payload(
        item_data: Any,
        material_map: Dict[int, Material],
    ) -> tuple[str, str, Optional[str], str]:
        mid = int(getattr(item_data, "material_id", None) or 0)
        if mid > 0 and mid in material_map:
            m = material_map[mid]
            return (
                (m.main_code or getattr(m, "code", None) or "")[:50],
                (m.name or "")[:200],
                (getattr(m, "specification", None) or "")[:200] or None,
                (m.base_unit or "")[:20],
            )
        return (
            (getattr(item_data, "material_code", None) or "")[:50],
            (getattr(item_data, "material_name", None) or "")[:200],
            (getattr(item_data, "material_spec", None) or "")[:200] or None,
            (getattr(item_data, "material_unit", None) or "")[:20],
        )

    @staticmethod
    async def _load_material_fallback_for_items(
        tenant_id: int,
        items: List[SalesOrderItem],
    ) -> Dict[int, Dict[str, str]]:
        """从物料主数据加载编码/名称（下推预览等展示以主数据为准）。"""
        need_ids = {
            int(it.material_id)
            for it in items
            if getattr(it, "material_id", None) and int(it.material_id) > 0
        }
        if not need_ids:
            return {}
        materials = await Material.filter(
            tenant_id=tenant_id,
            id__in=list(need_ids),
            deleted_at__isnull=True,
        ).all()
        fallback: Dict[int, Dict[str, str]] = {}
        for m in materials:
            fallback[m.id] = {
                "code": (m.main_code or getattr(m, "code", None) or "")[:50],
                "name": (m.name or "")[:200],
            }
        return fallback

    @staticmethod
    def _resolve_item_material_display(
        item: SalesOrderItem,
        material_fallback: Dict[int, Dict[str, str]],
    ) -> tuple[str, str]:
        mid = int(item.material_id) if getattr(item, "material_id", None) else 0
        mf = material_fallback.get(mid) if mid > 0 else None
        if mf:
            code = (mf.get("code") or "").strip()[:50]
            name = (mf.get("name") or "").strip()[:200]
            if code or name:
                return code, name
        code = getattr(item, "material_code", None)
        name = getattr(item, "material_name", None)
        material_code = str(code).strip()[:50] if code and str(code).strip() else ""
        material_name = str(name).strip()[:200] if name and str(name).strip() else ""
        return material_code, material_name

    async def preview_push_sales_order_to_computation(
        self, tenant_id: int, sales_order_id: int
    ) -> Dict[str, Any]:
        """下推需求计算预览：返回将参与计算的订单明细，不实际创建"""
        order = await SalesOrder.get_or_none(
            tenant_id=tenant_id, id=sales_order_id, deleted_at__isnull=True
        )
        if not order:
            raise NotFoundError(f"销售订单不存在: {sales_order_id}")
        await self._assert_sales_order_capability_for_order(tenant_id, order, "push_computation")

        items = await SalesOrderItem.filter(
            tenant_id=tenant_id, sales_order_id=sales_order_id
        ).order_by("id")
        if not items:
            raise BusinessLogicError("销售订单无明细，无法下推需求计算")

        demand = await self._get_linked_demand(tenant_id, sales_order_id)
        demand_exists = demand is not None
        material_fallback = await self._load_material_fallback_for_items(tenant_id, items)

        pushed_to_computation = await self._is_order_pushed_to_computation(tenant_id, order)

        material_ids = [
            int(it.material_id)
            for it in items
            if getattr(it, "material_id", None) and int(it.material_id) > 0
        ]
        from apps.master_data.services.material_service import MaterialService

        bom_map = await MaterialService.batch_check_has_bom(
            tenant_id=tenant_id,
            material_ids=material_ids,
            only_active=True,
        )

        preview_items = []
        for it in items:
            qty = float(it.order_quantity or 0)
            if qty <= 0:
                continue
            material_code, material_name = self._resolve_item_material_display(it, material_fallback)
            material_id = int(it.material_id) if getattr(it, "material_id", None) else None
            preview_items.append({
                "item_id": int(it.id),
                "material_id": material_id,
                "material_code": material_code,
                "material_name": material_name,
                "quantity": float(qty),
                "pushed_quantity": float(qty) if pushed_to_computation else 0.0,
                "max_push_quantity": 0.0 if pushed_to_computation else float(qty),
                "delivery_date": str(it.delivery_date) if it.delivery_date else None,
                "has_bom": bom_map.get(material_id, False) if material_id else False,
            })

        pushable_count = sum(
            1 for row in preview_items if float(row.get("max_push_quantity") or 0) > 0
        )
        return {
            "target_type": "demand_computation",
            "summary": (
                f"请选择本次要下推的订单明细（{pushable_count}/{len(preview_items)} 行可下推）"
                if not pushed_to_computation
                else "当前销售订单不可下推需求计算"
            ),
            "demand_exists": demand_exists,
            "items": preview_items,
            "has_blocking_issues": pushed_to_computation,
            "blocking_reason": (
                "sales_order.push_computation.already_pushed"
                if pushed_to_computation
                else None
            ),
            "tip": "计算完成后可下推生产计划或工单",
        }

    async def _create_demand_from_sales_order(
        self,
        tenant_id: int,
        sales_order_id: int,
        created_by: int,
        selected_item_ids: Optional[List[int]] = None,
        selected_quantities: Optional[Dict[int, float]] = None,
    ) -> Demand:
        """从 SalesOrder 生成 Demand（source_type=sales_order, source_id=订单ID）"""
        order = await SalesOrder.get(id=sales_order_id)
        items = await SalesOrderItem.filter(
            tenant_id=tenant_id, sales_order_id=sales_order_id
        ).order_by("id")
        if not items:
            raise BusinessLogicError("销售订单无明细，无法下推需求计算")

        if selected_item_ids is not None:
            selected = {int(v) for v in selected_item_ids if v is not None}
            items = [it for it in items if int(getattr(it, "id", 0)) in selected]
            if not items:
                raise BusinessLogicError("所选明细为空，无法下推需求计算")

        qty_override: Dict[int, Decimal] = {}
        if selected_quantities:
            for k, v in selected_quantities.items():
                try:
                    qty_override[int(k)] = Decimal(str(v or 0))
                except Exception:
                    continue

        total_qty = Decimal("0")
        total_amt = Decimal("0")
        demand_items = []
        material_fallback = await self._load_material_fallback_for_items(tenant_id, items)
        for it in items:
            item_id = int(getattr(it, "id", 0) or 0)
            order_qty = Decimal(str(it.order_quantity or 0))
            qty = qty_override.get(item_id, order_qty)
            qty = max(Decimal("0"), Decimal(str(qty)))
            if qty <= 0:
                continue
            if qty > order_qty:
                raise BusinessLogicError(
                    f"物料 {it.material_code or it.material_name or item_id} 下推数量 {qty} "
                    f"不能超过订单数量 {order_qty}"
                )
            unit_price = Decimal(str(it.unit_price or 0))
            item_amount = (qty * unit_price).quantize(Decimal("0.01"), rounding=ROUND_HALF_UP)
            total_qty += qty
            total_amt += item_amount
            material_code, material_name = self._resolve_item_material_display(it, material_fallback)
            demand_items.append({
                "material_id": it.material_id,
                "material_code": material_code,
                "material_name": material_name,
                "material_spec": it.material_spec,
                "material_unit": it.material_unit,
                "required_quantity": qty,
                "delivery_date": it.delivery_date,
                "unit_price": it.unit_price,
                "item_amount": item_amount,
                "remaining_quantity": qty,
                "delivery_status": it.delivery_status or "待交货",
                "variant_attributes": getattr(it, "variant_attributes", None),
                "configurable_selections": getattr(it, "configurable_selections", None),
            })

        if not demand_items:
            raise BusinessLogicError("所选明细有效数量为空，无法下推需求计算")

        demand_code = str(order.order_code or "").strip()
        if not demand_code:
            raise BusinessLogicError("销售订单编号为空，无法下推需求计算")
        if not order.order_date:
            raise BusinessLogicError("销售订单日期为空，无法下推需求计算")

        # 同单软删需求：复活并重建明细（_get_linked_demand 只查未删，会漏掉）
        soft_same_source = await Demand.filter(
            tenant_id=tenant_id,
            source_type="sales_order",
            source_id=sales_order_id,
            deleted_at__isnull=False,
        ).order_by("-id").first()
        if soft_same_source:
            demand = await self._revive_demand_from_sales_order(
                soft_same_source,
                order=order,
                sales_order_id=sales_order_id,
                created_by=created_by,
                demand_items=demand_items,
                total_qty=total_qty,
                total_amt=total_amt,
            )
            await self._apply_forecast_consumption_after_demand_create(
                tenant_id, sales_order_id, order.order_code, items
            )
            return demand

        # 其它软删行占用同一 demand_code：改码腾位（全局 unique 含软删时必须）
        soft_occupiers = await Demand.filter(
            tenant_id=tenant_id,
            demand_code=demand_code,
            deleted_at__isnull=False,
        ).all()
        for occ in soft_occupiers:
            occ.demand_code = f"{demand_code}#DEL{occ.id}"[:50]
            await occ.save(update_fields=["demand_code", "updated_at"])

        active_same_code = await Demand.get_or_none(
            tenant_id=tenant_id,
            demand_code=demand_code,
            deleted_at__isnull=True,
        )
        if active_same_code:
            if (
                str(getattr(active_same_code, "source_type", "") or "") == "sales_order"
                and int(getattr(active_same_code, "source_id", 0) or 0) == int(sales_order_id)
            ):
                return active_same_code
            raise BusinessLogicError(
                f"需求编码 {demand_code} 已被其他需求占用，无法从本销售订单下推需求计算"
            )

        try:
            demand = await Demand.create(
                tenant_id=tenant_id,
                demand_code=demand_code,
                demand_type="sales_order",
                business_mode="MTO",
                priority=5,
                demand_name=demand_code,
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
                source_code=demand_code,
                created_by=created_by,
                updated_by=created_by,
            )
        except IntegrityError as e:
            raise BusinessLogicError(
                f"需求编码 {demand_code} 已存在，无法从销售订单下推需求计算"
            ) from e
        for d in demand_items:
            await DemandItem.create(
                tenant_id=tenant_id,
                demand_id=demand.id,
                material_unit=str(d.get("material_unit") or "")[:20],
                material_code=str(d.get("material_code") or "")[:50],
                material_name=str(d.get("material_name") or "")[:200],
                **{k: v for k, v in d.items() if k not in ("material_unit", "material_code", "material_name")},
            )
        logger.info("从销售订单 %s 生成需求 %s", order.order_code, demand.demand_code)

        await self._apply_forecast_consumption_after_demand_create(
            tenant_id, sales_order_id, order.order_code, items
        )

        # 不再写入 DocumentRelation(sales_order→demand)：全链路追溯以订单→需求计算为主，
        # Demand 仍存表供计算与明细；关联路径见推导逻辑 _get_sales_order_downstream。

        return demand

    async def _revive_demand_from_sales_order(
        self,
        demand: Demand,
        *,
        order: SalesOrder,
        sales_order_id: int,
        created_by: int,
        demand_items: List[Dict[str, Any]],
        total_qty: Decimal,
        total_amt: Decimal,
    ) -> Demand:
        """复活本销售订单下已软删的 Demand，并按本次下推明细重建行。"""
        demand_code = str(order.order_code or "").strip()
        demand.deleted_at = None
        demand.demand_code = demand_code
        demand.demand_type = "sales_order"
        demand.business_mode = "MTO"
        demand.demand_name = demand_code
        demand.start_date = order.order_date
        demand.end_date = order.delivery_date
        demand.order_date = order.order_date
        demand.delivery_date = order.delivery_date
        demand.customer_id = order.customer_id
        demand.customer_name = order.customer_name
        demand.customer_contact = order.customer_contact
        demand.customer_phone = order.customer_phone
        demand.total_quantity = total_qty
        demand.total_amount = total_amt
        demand.status = DemandStatus.AUDITED
        demand.review_status = ReviewStatus.APPROVED
        demand.reviewer_id = order.reviewer_id
        demand.reviewer_name = order.reviewer_name
        demand.review_time = order.review_time
        demand.salesman_id = order.salesman_id
        demand.salesman_name = order.salesman_name
        demand.shipping_address = order.shipping_address
        demand.shipping_method = order.shipping_method
        demand.payment_terms = order.payment_terms
        demand.notes = order.notes
        demand.source_type = "sales_order"
        demand.source_id = sales_order_id
        demand.source_code = demand_code
        demand.pushed_to_computation = False
        demand.computation_id = None
        demand.computation_code = None
        demand.updated_by = created_by
        await demand.save()
        await DemandItem.filter(tenant_id=demand.tenant_id, demand_id=demand.id).delete()
        for d in demand_items:
            await DemandItem.create(
                tenant_id=demand.tenant_id,
                demand_id=demand.id,
                material_unit=str(d.get("material_unit") or "")[:20],
                material_code=str(d.get("material_code") or "")[:50],
                material_name=str(d.get("material_name") or "")[:200],
                **{k: v for k, v in d.items() if k not in ("material_unit", "material_code", "material_name")},
            )
        logger.info("复活销售订单 %s 关联需求 %s", order.order_code, demand.demand_code)
        return demand

    async def _apply_forecast_consumption_after_demand_create(
        self,
        tenant_id: int,
        sales_order_id: int,
        order_code: str,
        items: List[SalesOrderItem],
    ) -> None:
        from apps.kuaizhizao.utils.forecast_consumption import (
            apply_forecast_consumption_for_sales_order,
        )

        consume_result = await apply_forecast_consumption_for_sales_order(
            tenant_id,
            sales_order_id,
            only_item_ids=[int(it.id) for it in items],
        )
        if consume_result.get("consumed_total"):
            logger.info(
                "销售订单 %s 预测冲销合计 %s",
                order_code,
                consume_result.get("consumed_total"),
            )

    async def push_sales_order_to_work_order(
        self,
        tenant_id: int,
        sales_order_id: int,
        created_by: int,
        selected_item_ids: Optional[List[int]] = None,
        selected_quantities: Optional[Dict[int, float]] = None,
        selected_work_centers: Optional[Dict[int, int]] = None,
        work_order_granularity: Optional[str] = None,
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
        await self._assert_sales_order_capability_for_order(tenant_id, order, "push_work_order")

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
        material_ids = [int(getattr(it, "material_id", 0) or 0) for it in items]
        pushed_by_material = await self._pushed_work_order_qty_by_material(
            tenant_id=tenant_id,
            sales_order_id=sales_order_id,
            material_ids=material_ids,
        )
        order_total_by_material: Dict[int, Decimal] = {}
        for it in items:
            mid = int(getattr(it, "material_id", 0) or 0)
            if mid <= 0:
                continue
            order_total_by_material[mid] = order_total_by_material.get(mid, Decimal("0")) + Decimal(
                str(it.order_quantity or 0)
            )
        remaining_by_material: Dict[int, Decimal] = {}
        for mid, total_qty in order_total_by_material.items():
            remaining = total_qty - pushed_by_material.get(mid, Decimal("0"))
            remaining_by_material[mid] = remaining if remaining > 0 else Decimal("0")
        remaining_cursor = dict(remaining_by_material)
        max_by_item: Dict[int, Decimal] = {}
        for it in items:
            item_id = int(getattr(it, "id", 0) or 0)
            mid = int(getattr(it, "material_id", 0) or 0)
            order_qty = Decimal(str(it.order_quantity or 0))
            remain = remaining_cursor.get(mid, Decimal("0"))
            allowed = min(order_qty, remain) if remain > 0 else Decimal("0")
            max_by_item[item_id] = allowed if allowed > 0 else Decimal("0")
            if mid > 0 and allowed > 0:
                remaining_cursor[mid] = remain - allowed
        qty_override: Dict[int, Decimal] = {}
        if selected_quantities:
            for k, v in selected_quantities.items():
                try:
                    item_id = int(k)
                    qty_override[item_id] = Decimal(str(v or 0))
                except Exception:
                    continue
        work_center_by_item: Dict[int, int] = {}
        if selected_work_centers:
            for k, v in selected_work_centers.items():
                try:
                    item_id = int(k)
                    center_id = int(v or 0)
                    if center_id > 0:
                        work_center_by_item[item_id] = center_id
                except Exception:
                    continue
        work_center_name_by_id: Dict[int, str] = {}
        if work_center_by_item:
            center_ids = sorted(set(work_center_by_item.values()))
            centers = await WorkCenter.filter(
                tenant_id=tenant_id,
                id__in=center_ids,
                deleted_at__isnull=True,
                is_active=True,
            ).all()
            work_center_name_by_id = {int(c.id): str(c.name or "") for c in centers}
            missing = [cid for cid in center_ids if cid not in work_center_name_by_id]
            if missing:
                raise BusinessLogicError(f"所选产线不存在或未启用: {missing[0]}")

        raw_push_mode = (push_mode or "").strip().lower()
        if raw_push_mode not in ("draft", "confirm"):
            raw_push_mode = await self.business_config_service.get_push_default_mode(tenant_id)
        push_as_confirm = raw_push_mode == "confirm"
        raw_granularity = (work_order_granularity or "").strip().lower()
        if raw_granularity not in ("grouped", "peer_group"):
            raw_granularity = "grouped"

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
            resolve_mrp_supply_source_type,
        )
        from apps.kuaizhizao.utils.inventory_helper import get_material_inventory_info
        from apps.master_data.models.material import Material

        # 汇总待生成工单的物料：material_id -> {qty, material_code, material_name, delivery_date}
        wo_pool: Dict[tuple[int, Optional[int]], Dict[str, Any]] = {}

        def _add_to_pool(
            material_id: int,
            material_code: str,
            material_name: str,
            qty: float,
            delivery_date,
            work_center_id: Optional[int] = None,
            work_center_name: Optional[str] = None,
        ):
            if qty <= 0:
                return
            key = (int(material_id), int(work_center_id) if work_center_id else None)
            if key not in wo_pool:
                wo_pool[key] = {
                    "material_id": material_id,
                    "material_code": material_code,
                    "material_name": material_name,
                    "quantity": Decimal("0"),
                    "earliest_delivery": delivery_date,
                    "work_center_id": int(work_center_id) if work_center_id else None,
                    "work_center_name": work_center_name or None,
                }
            wo_pool[key]["quantity"] += Decimal(str(qty))
            if delivery_date and (
                wo_pool[key]["earliest_delivery"] is None
                or delivery_date < wo_pool[key]["earliest_delivery"]
            ):
                wo_pool[key]["earliest_delivery"] = delivery_date

        work_order_service = WorkOrderService()
        relation_service = DocumentRelationNewService()
        selected_by_material: Dict[int, Decimal] = {}

        for it in items:
            item_id = int(getattr(it, "id", 0) or 0)
            material_id = int(getattr(it, "material_id", 0) or 0)
            selected_work_center_id = work_center_by_item.get(item_id)
            selected_work_center_name = (
                work_center_name_by_id.get(selected_work_center_id)
                if selected_work_center_id
                else None
            )
            order_qty = Decimal(str(it.order_quantity or 0))
            max_qty = max_by_item.get(item_id, Decimal("0"))
            use_qty = qty_override.get(item_id, max_qty)
            if use_qty <= 0:
                continue
            if use_qty > order_qty:
                raise BusinessLogicError(
                    f"物料 {it.material_code or it.material_name or item_id} 本次下推数量 {use_qty} "
                    f"不能超过订单数量 {order_qty}"
                )
            if use_qty > max_qty:
                raise BusinessLogicError(
                    f"物料 {it.material_code or it.material_name or item_id} 本次下推数量 {use_qty} "
                    f"超过可下推剩余数量 {max_qty}（已下推 {pushed_by_material.get(material_id, Decimal('0'))}）"
                )
            if material_id > 0:
                selected_by_material[material_id] = selected_by_material.get(material_id, Decimal("0")) + use_qty
            qty = float(use_qty)
            delivery_date = it.delivery_date

            bom = await get_bom_by_material_id(
                tenant_id=tenant_id,
                material_id=it.material_id,
                only_approved=True,
                use_default=True,
            )
            material_row = await Material.get_or_none(
                tenant_id=tenant_id, id=material_id, deleted_at__isnull=True
            )
            skip_root_wo = False
            if material_row:
                if resolve_mrp_supply_source_type(material_row) != SOURCE_TYPE_MAKE:
                    skip_root_wo = True
                else:
                    inv = await get_material_inventory_info(tenant_id, material_id)
                    avail = float(inv.get("available_quantity") or 0)
                    if avail >= qty:
                        skip_root_wo = True
            if bom and bom.bom_code:
                # 有BOM：展开，成品+半成品（Make/Outsource/Configure）生成工单
                if not skip_root_wo:
                    _add_to_pool(
                        it.material_id,
                        it.material_code,
                        it.material_name,
                        qty,
                        delivery_date,
                        selected_work_center_id,
                        selected_work_center_name,
                    )
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
                                selected_work_center_id,
                                selected_work_center_name,
                            )
            else:
                # 无BOM：仅成品工单
                if not skip_root_wo:
                    _add_to_pool(
                        it.material_id,
                        it.material_code,
                        it.material_name,
                        qty,
                        delivery_date,
                        selected_work_center_id,
                        selected_work_center_name,
                    )

        for mid, sel_qty in selected_by_material.items():
            remain = remaining_by_material.get(mid, Decimal("0"))
            if sel_qty > remain:
                raise BusinessLogicError(
                    f"产品ID {mid} 本次合计下推数量 {sel_qty} 超过可下推剩余数量 {remain}"
                )

        work_orders = []

        async def _create_one_work_order(info: Dict[str, Any], qty_dec: Decimal):
            wo_data = WorkOrderCreate(
                code_rule="WORK_ORDER_CODE",
                product_id=info["material_id"],
                product_code=info["material_code"],
                product_name=info["material_name"],
                quantity=qty_dec,
                production_mode="MTO",
                sales_order_id=order.id,
                sales_order_code=order.order_code,
                sales_order_name=order.order_code,
                work_center_id=info.get("work_center_id"),
                work_center_name=info.get("work_center_name"),
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
                allow_draft=not push_as_confirm,
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

        for info in wo_pool.values():
            total_qty_dec = Decimal(str(info["quantity"] or 0))
            if total_qty_dec <= 0:
                continue
            await _create_one_work_order(info, total_qty_dec)

        if not work_orders:
            raise BusinessLogicError("所选明细的本次下推数量均为 0，无法生成工单")

        work_order_group: Optional[Dict[str, Any]] = None
        if raw_granularity == "peer_group":
            if len(work_orders) < 2:
                raise BusinessLogicError(
                    "平级组工单至少需要生成 2 张工单，请多选订单明细或改选普通工单"
                )
            from apps.kuaizhizao.services.work_order_group_service import WorkOrderGroupService

            wo_ids = [
                int(w.id if hasattr(w, "id") else w.get("id"))
                for w in work_orders
            ]
            work_order_group = await WorkOrderGroupService().merge_work_orders_into_group(
                tenant_id=tenant_id,
                work_order_ids=wo_ids,
                root_work_order_id=None,
                created_by=created_by,
                remarks=f"由销售订单 {order.order_code} 直推平级组",
            )

        wo_codes = ", ".join(
            str(w.code if hasattr(w, "code") else w.get("code") or "")
            for w in work_orders
            if (w.code if hasattr(w, "code") else w.get("code"))
        )
        from apps.kuaizhizao.services.kuaizhizao_business_notification import (
            ACTION_PUSHED_TO_WORK_ORDER,
            DOC_SALES_ORDER,
            dispatch_kuaizhizao_notification,
        )

        try:
            await dispatch_kuaizhizao_notification(
                tenant_id,
                trigger_document=DOC_SALES_ORDER,
                trigger_action=ACTION_PUSHED_TO_WORK_ORDER,
                variables={
                    "order_code": order.order_code or str(sales_order_id),
                    "work_order_codes": wo_codes or "—",
                    "customer_name": order.customer_name or "—",
                    "detail_path": f"/apps/kuaizhizao/sales-management/sales-orders?highlight={sales_order_id}",
                    "sales_order_id": str(sales_order_id),
                },
                context={"creator_user_id": order.created_by or created_by},
            )
        except Exception as exc:
            logger.warning(
                "销售订单下推工单消息提醒失败 tenant={} order={}: {}",
                tenant_id,
                sales_order_id,
                exc,
            )

        return {
            "success": True,
            "message": (
                f"直推成功，共生成 {len(work_orders)} 个工单并编入平级组"
                if work_order_group
                else f"直推成功，共生成 {len(work_orders)} 个工单（含半成品，采购件自行采购）"
            ),
            "push_mode": raw_push_mode,
            "work_order_granularity": raw_granularity,
            "work_order_group": work_order_group,
            "target_documents": [
                {"type": "work_order", "id": w.id if hasattr(w, "id") else w.get("id"), "code": w.code if hasattr(w, "code") else w.get("code")}
                for w in work_orders
            ],
        }

    async def preview_push_sales_order_to_work_order(
        self, tenant_id: int, sales_order_id: int
    ) -> Dict[str, Any]:
        """下推工单预览：返回可选择的销售订单明细，不实际创建。"""
        order = await SalesOrder.get_or_none(
            tenant_id=tenant_id, id=sales_order_id, deleted_at__isnull=True
        )
        if not order:
            raise NotFoundError(f"销售订单不存在: {sales_order_id}")
        await self._assert_sales_order_capability_for_order(tenant_id, order, "push_work_order")

        items = await SalesOrderItem.filter(
            tenant_id=tenant_id, sales_order_id=sales_order_id
        ).order_by("id")
        if not items:
            raise BusinessLogicError("销售订单无明细，无法直推工单")

        from apps.kuaizhizao.utils.material_source_helper import (
            get_material_source_type,
            validate_material_source_config,
        )

        material_fallback = await self._load_material_fallback_for_items(tenant_id, items)
        preview_items: List[Dict[str, Any]] = []
        has_blocking_issues = False
        material_ids = [int(getattr(it, "material_id", 0) or 0) for it in items]
        pushed_by_material = await self._pushed_work_order_qty_by_material(
            tenant_id=tenant_id,
            sales_order_id=sales_order_id,
            material_ids=material_ids,
        )
        order_total_by_material: Dict[int, Decimal] = {}
        for it in items:
            mid = int(getattr(it, "material_id", 0) or 0)
            if mid <= 0:
                continue
            order_total_by_material[mid] = order_total_by_material.get(mid, Decimal("0")) + Decimal(
                str(it.order_quantity or 0)
            )
        remaining_cursor: Dict[int, Decimal] = {}
        for mid, total_qty in order_total_by_material.items():
            remaining = total_qty - pushed_by_material.get(mid, Decimal("0"))
            remaining_cursor[mid] = remaining if remaining > 0 else Decimal("0")
        for it in items:
            qty = Decimal(str(it.order_quantity or 0))
            if qty <= 0:
                continue
            item_id = int(getattr(it, "id", 0) or 0)
            mid = int(getattr(it, "material_id", 0) or 0)
            remain = remaining_cursor.get(mid, Decimal("0"))
            max_qty = min(qty, remain) if remain > 0 else Decimal("0")
            if mid > 0 and max_qty > 0:
                remaining_cursor[mid] = remain - max_qty
            source_type = await get_material_source_type(tenant_id, it.material_id)
            _, source_errors = await validate_material_source_config(
                tenant_id=tenant_id,
                material_id=it.material_id,
                source_type=source_type or "Make",
            )
            errors = [str(e) for e in (source_errors or []) if str(e).strip()]
            if errors:
                has_blocking_issues = True
            material_code, material_name = self._resolve_item_material_display(it, material_fallback)
            preview_items.append(
                {
                    "item_id": item_id,
                    "material_code": material_code,
                    "material_name": material_name,
                    "quantity": float(qty),
                    "pushed_quantity": float(pushed_by_material.get(mid, Decimal("0"))),
                    "max_push_quantity": float(max_qty),
                    "delivery_date": str(it.delivery_date) if it.delivery_date else None,
                    "suggested_action": "生产",
                    "source_type": source_type or "Make",
                    "blocking_issues": errors,
                }
            )

        if not preview_items:
            raise BusinessLogicError("销售订单无有效明细数量，无法下推工单")

        return {
            "target_type": "work_order",
            "summary": f"请选择本次要下推的产品与数量（共 {len(preview_items)} 条可选明细）",
            "items": preview_items,
            "has_blocking_issues": has_blocking_issues,
            "push_mode_default": await self.business_config_service.get_push_default_mode(tenant_id),
            "tip": "确认后将按所选数量下推工单；系统会按 BOM 展开成品/半成品工单。若缺少主数据可先草稿下推，后续补齐再下达。",
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
                variables={
                    "message_category": "process",
                    "trigger_document": "sales_order",
                    "trigger_action": "manual_remind",
                    "detail_path": f"/apps/kuaizhizao/sales-management/sales-orders?highlight={order.id}",
                    "sales_order_id": str(order.id),
                },
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
        order = await SalesOrder.get_or_none(
            tenant_id=tenant_id, id=sales_order_id, deleted_at__isnull=True
        )
        if not order:
            raise NotFoundError(f"销售订单不存在: {sales_order_id}")
        await self._assert_sales_order_capability_for_order(tenant_id, order, "withdraw_computation")
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
        await self._assert_sales_order_capability_for_order(tenant_id, order, "withdraw_submit")

        prev_status = order.status
        from core.services.approval.audit_transition import resolve_sales_order_revoke_state

        draft_state = resolve_sales_order_revoke_state(landing="draft")
        async with in_transaction():
            from core.services.approval.approval_instance_service import ApprovalInstanceService
            await ApprovalInstanceService.cancel_approval(
                tenant_id=tenant_id,
                entity_type="sales_order",
                entity_id=sales_order_id,
                operator_id=withdrawn_by,
            )
            await SalesOrder.filter(tenant_id=tenant_id, id=sales_order_id).update(
                status=draft_state["status"],
                review_status=draft_state["review_status"],
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
                draft_state["status"],
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
        current_user: Optional["User"] = None,
    ) -> None:
        """删除销售订单"""
        order = await SalesOrder.get_or_none(
            tenant_id=tenant_id, id=sales_order_id, deleted_at__isnull=True
        )
        if not order:
            raise NotFoundError(f"销售订单不存在: {sales_order_id}")
        if current_user:
            await DataScopeService.assert_row_visible(
                order,
                tenant_id=tenant_id,
                user=current_user,
                resource="kuaizhizao:sales-order",
            )
        await self._assert_sales_order_capability_for_order(tenant_id, order, "delete")

        demand = await self._get_linked_demand(tenant_id, sales_order_id)
        if demand:
            from apps.kuaizhizao.services.demand_service import DemandService

            await DemandService().delete_demand_cascade_from_upstream(tenant_id, demand.id)

        async with in_transaction():
            from apps.kuaizhizao.services.sales_contract_service import SalesContractService

            await SalesContractService().rollback_release_for_sales_order(
                tenant_id, sales_order_id, operator_id=None
            )
            await SalesOrderItem.filter(
                tenant_id=tenant_id, sales_order_id=sales_order_id
            ).delete()
            await SalesOrder.filter(tenant_id=tenant_id, id=sales_order_id).update(
                deleted_at=resolve_business_datetime()
            )
            from apps.kuaizhizao.models.quotation import Quotation
            from apps.kuaizhizao.services.quotation_service import QuotationService

            operator_id = int(current_user.id) if current_user else 0
            linked_quotation_ids = await Quotation.filter(
                tenant_id=tenant_id,
                sales_order_id=sales_order_id,
                deleted_at__isnull=True,
            ).values_list("id", flat=True)
            quotation_svc = QuotationService()
            for quotation_id in linked_quotation_ids:
                await quotation_svc._detach_quotation_if_downstream_sales_order_deleted(
                    tenant_id,
                    int(quotation_id),
                    operator_id,
                    transition_reason="下游销售订单已删除，自动撤回下推",
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
        await self._assert_sales_order_capability_for_order(tenant_id, order, "close")

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

        # 关闭已落库；详情组装失败不得回滚业务结果（历史曾因枚举缺 CLOSED / 自动修复误伤）
        try:
            return await self.get_sales_order_by_id(tenant_id, sales_order_id)
        except Exception as e:
            logger.warning("close_sales_order 后详情组装失败，返回轻量结果: {}", e)
            return await self.get_sales_order_by_id(
                tenant_id, sales_order_id, view="options"
            )

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

    async def _resolve_status_before_close(
        self,
        tenant_id: int,
        sales_order_id: int,
    ) -> str:
        """从关闭流转日志恢复关闭前状态；无日志时回落到已审核。"""
        closed_states = (
            DocumentStatus.CLOSED.value,
            "CLOSED",
            "closed",
            "已关闭",
        )
        log = (
            await StateTransitionLog.filter(
                tenant_id=tenant_id,
                entity_type="sales_order",
                entity_id=sales_order_id,
                to_state__in=list(closed_states),
            )
            .order_by("-transition_time", "-id")
            .first()
        )
        from_state = str(getattr(log, "from_state", "") or "").strip() if log else ""
        if from_state and not self._is_closed(from_state):
            return from_state
        return DocumentStatus.AUDITED.value

    async def reopen_sales_order(
        self,
        tenant_id: int,
        sales_order_id: int,
        reopened_by: int,
        reason: Optional[str] = None,
    ) -> SalesOrderResponse:
        """撤回关闭：将已关闭订单恢复为关闭前状态，继续履约。"""
        order = await SalesOrder.get_or_none(
            tenant_id=tenant_id, id=sales_order_id, deleted_at__isnull=True
        )
        if not order:
            raise NotFoundError(f"销售订单不存在: {sales_order_id}")
        await self._assert_sales_order_capability_for_order(tenant_id, order, "reopen")

        from apps.common.base_service import AppBaseService

        operator_name = await AppBaseService().get_user_name(reopened_by)
        old_status = order.status
        restore_status = await self._resolve_status_before_close(tenant_id, sales_order_id)
        reopen_reason = reason or "撤回关闭，恢复订单继续履约"

        async with in_transaction():
            await SalesOrder.filter(tenant_id=tenant_id, id=sales_order_id).update(
                status=restore_status,
                updated_by=reopened_by,
            )
            await self._log_state_transition(
                tenant_id,
                sales_order_id,
                old_status,
                restore_status,
                reopened_by,
                operator_name,
                reopen_reason,
            )

        try:
            return await self.get_sales_order_by_id(tenant_id, sales_order_id)
        except Exception as e:
            logger.warning("reopen_sales_order 后详情组装失败，返回轻量结果: {}", e)
            return await self.get_sales_order_by_id(
                tenant_id, sales_order_id, view="options"
            )

    async def bulk_reopen_sales_orders(
        self,
        tenant_id: int,
        sales_order_ids: List[int],
        reopened_by: int,
    ) -> Dict[str, Any]:
        """批量撤回关闭销售订单"""
        return await self._bulk_operation_wrapper(
            tenant_id, sales_order_ids, reopened_by, self.reopen_sales_order
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
        销售订单域加载建单：从报价单创建销售订单（单一直接上游）。
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

    async def pull_sales_order_from_sales_review(
        self,
        tenant_id: int,
        sales_review_id: int,
        created_by: int,
    ) -> Dict[str, Any]:
        """销售订单域加载建单：从订单评审创建销售订单。"""
        if sales_review_id <= 0:
            raise ValidationError("订单评审ID无效")

        from apps.kuaizhizao.services.sales_review_service import SalesReviewService
        from infra.models.user import User

        user = await User.get_or_none(id=created_by)
        if not user:
            raise NotFoundError(f"用户不存在: {created_by}")
        result = await SalesReviewService().push_to_sales_order(
            tenant_id, sales_review_id, user
        )
        return {
            "success": True,
            "message": result.message or "已从订单评审创建销售订单",
            "source_type": "sales_review",
            "source_id": sales_review_id,
            "sales_order_id": result.sales_order_id,
            "sales_order_code": result.sales_order_code,
            "sales_order": {
                "id": result.sales_order_id,
                "order_code": result.sales_order_code,
            },
        }

    async def pull_sales_order_from_sales_contract(
        self,
        tenant_id: int,
        contract_id: int,
        created_by: int,
        selected_item_ids: Optional[List[int]] = None,
        release_lines: Optional[List[Dict[str, Any]]] = None,
    ) -> Dict[str, Any]:
        """
        销售订单域加载建单：从销售合同创建销售订单。
        """
        if contract_id <= 0:
            raise ValidationError("销售合同ID无效")

        from apps.kuaizhizao.services.sales_contract_service import SalesContractService

        sales_order, contract = await SalesContractService().convert_to_sales_order(
            tenant_id=tenant_id,
            contract_id=contract_id,
            created_by=created_by,
            selected_item_ids=selected_item_ids,
            release_lines=release_lines,
        )
        return {
            "success": True,
            "message": "已从销售合同创建销售订单",
            "source_type": "sales_contract",
            "source_id": contract_id,
            "sales_order": sales_order.model_dump() if hasattr(sales_order, "model_dump") else sales_order,
            "sales_contract": contract.model_dump() if hasattr(contract, "model_dump") else contract,
        }

    async def push_sales_order_to_delivery(
        self,
        tenant_id: int,
        sales_order_id: int,
        created_by: int,
        delivery_quantities: Optional[Dict[int, float]] = None,
        warehouse_id: Optional[int] = None,
        warehouse_name: Optional[str] = None,
        line_warehouses: Optional[Dict[int, int]] = None,
        notes: Optional[str] = None,
    ) -> Dict[str, Any]:
        """下推销售订单到销售出库"""
        order = await SalesOrder.get_or_none(
            tenant_id=tenant_id, id=sales_order_id, deleted_at__isnull=True
        )
        if not order:
            raise NotFoundError(f"销售订单不存在: {sales_order_id}")
        await self._assert_sales_order_capability_for_order(tenant_id, order, "push_sales_delivery")

        from apps.kuaizhizao.services.warehouse_service import SalesDeliveryService
        from apps.kuaizhizao.services.shipment_notice_service import _resolve_warehouse_name_by_id

        delivery_service = SalesDeliveryService()
        qty_map: Dict[int, float] = {}
        if delivery_quantities:
            for k, v in delivery_quantities.items():
                try:
                    qty = float(v or 0)
                except (TypeError, ValueError):
                    continue
                if qty > 0:
                    qty_map[int(k)] = qty
        if not qty_map:
            raise ValidationError("请选择至少一条出库明细并填写数量")

        created_deliveries = []
        if line_warehouses:
            groups: Dict[int, Dict[int, float]] = {}
            for item_id, qty in qty_map.items():
                wh_id = line_warehouses.get(int(item_id))
                if wh_id is None or int(wh_id) <= 0:
                    raise ValidationError(f"请为销售订单明细 {item_id} 指定出库仓库")
                groups.setdefault(int(wh_id), {})[int(item_id)] = qty
            for wh_id, group_qty in groups.items():
                wh_name = await _resolve_warehouse_name_by_id(
                    tenant_id=tenant_id,
                    warehouse_id=int(wh_id),
                    preferred_name=warehouse_name if warehouse_id == wh_id else None,
                )
                delivery = await delivery_service.pull_from_sales_order(
                    tenant_id=tenant_id,
                    sales_order_id=sales_order_id,
                    created_by=created_by,
                    delivery_quantities=group_qty,
                    warehouse_id=int(wh_id),
                    warehouse_name=wh_name,
                    notes=notes,
                )
                created_deliveries.append(delivery)
        else:
            if warehouse_id is None or int(warehouse_id) <= 0:
                raise ValidationError("请指定出库仓库")
            wh_name = warehouse_name
            if not wh_name:
                wh_name = await _resolve_warehouse_name_by_id(
                    tenant_id=tenant_id,
                    warehouse_id=int(warehouse_id),
                    preferred_name=None,
                )
            delivery = await delivery_service.pull_from_sales_order(
                tenant_id=tenant_id,
                sales_order_id=sales_order_id,
                created_by=created_by,
                delivery_quantities=qty_map,
                warehouse_id=int(warehouse_id),
                warehouse_name=wh_name,
                notes=notes,
            )
            created_deliveries.append(delivery)

        primary = created_deliveries[0]
        delivery_codes = [str(d.delivery_code) for d in created_deliveries if getattr(d, "delivery_code", None)]
        message = "已生成销售出库单"
        if len(created_deliveries) > 1:
            message = f"已生成 {len(created_deliveries)} 张销售出库单"
        return {
            "success": True,
            "message": message,
            "delivery_id": primary.id,
            "delivery_code": primary.delivery_code,
            "delivery_codes": delivery_codes,
            "related_deliveries": [
                {"id": int(d.id), "code": str(d.delivery_code)}
                for d in created_deliveries
                if getattr(d, "id", None) is not None
            ],
        }

    async def push_sales_order_to_sales_return(
        self,
        tenant_id: int,
        sales_order_id: int,
        created_by: int,
        warehouse_id: int,
        warehouse_name: Optional[str] = None,
        return_quantities: Optional[Dict[int, float]] = None,
        batch_numbers: Optional[Dict[int, str]] = None,
        return_code: Optional[str] = None,
    ) -> Dict[str, Any]:
        """下推销售订单到销售退货单。"""
        order = await SalesOrder.get_or_none(
            tenant_id=tenant_id, id=sales_order_id, deleted_at__isnull=True
        )
        if not order:
            raise NotFoundError(f"销售订单不存在: {sales_order_id}")
        await self._assert_sales_order_capability_for_order(tenant_id, order, "push_sales_return")

        if warehouse_id <= 0:
            raise ValidationError("必须提供有效的退货仓库ID")

        from apps.kuaizhizao.services.warehouse_service import SalesReturnService

        sales_return = await SalesReturnService().pull_from_sales_order(
            tenant_id=tenant_id,
            sales_order_id=sales_order_id,
            created_by=created_by,
            warehouse_id=warehouse_id,
            warehouse_name=warehouse_name,
            return_quantities=return_quantities if isinstance(return_quantities, dict) else None,
            batch_numbers=batch_numbers if isinstance(batch_numbers, dict) else None,
            return_code=return_code if return_code else None,
        )
        return {
            "success": True,
            "message": "已生成销售退货单",
            "return_id": sales_return.id,
            "return_code": sales_return.return_code,
        }

    async def push_sales_order_to_shipment_notice(
        self,
        tenant_id: int,
        sales_order_id: int,
        created_by: int,
        selected_item_ids: Optional[List[int]] = None,
        selected_quantities: Optional[Dict[int, float]] = None,
        warehouse_id: Optional[int] = None,
        warehouse_name: Optional[str] = None,
        line_warehouses: Optional[Dict[int, int]] = None,
    ) -> Dict[str, Any]:
        """下推销售订单到发货通知单"""
        order = await SalesOrder.get_or_none(
            tenant_id=tenant_id, id=sales_order_id, deleted_at__isnull=True
        )
        if not order:
            raise NotFoundError(f"销售订单不存在: {sales_order_id}")
        await self._assert_sales_order_capability_for_order(tenant_id, order, "push_shipment_notice")

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
        qty_override: Dict[int, Decimal] = {}
        if selected_quantities:
            for k, v in selected_quantities.items():
                try:
                    qty_override[int(k)] = Decimal(str(v or 0))
                except Exception:
                    continue

        from apps.kuaizhizao.utils.sales_order_push_qty import get_pushable_qty_for_order_items

        pushable_by_item = await get_pushable_qty_for_order_items(
            tenant_id, sales_order_id, items
        )

        from apps.kuaizhizao.services.shipment_notice_service import (
            ShipmentNoticeService,
            _resolve_warehouse_name_by_id,
        )
        today = today_site_str()
        code = await ShipmentNoticeService().generate_code(
            tenant_id, "SHIPMENT_NOTICE_CODE", prefix=f"SN{today}"
        )

        header_wh_id: Optional[int] = None
        header_wh_name: Optional[str] = None

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
                item_id = int(getattr(it, "id", 0) or 0)
                remaining_qty = pushable_by_item.get(item_id, Decimal("0"))
                qty = qty_override.get(item_id, remaining_qty)
                qty = max(Decimal("0"), Decimal(str(qty)))
                if qty <= Decimal("0"):
                    continue
                if qty > remaining_qty:
                    raise BusinessLogicError(
                        f"物料 {it.material_code or it.material_name or item_id} 下推数量 {qty} "
                        f"不能超过可通知数量 {remaining_qty}"
                    )

                line_wh_id: Optional[int] = None
                if line_warehouses and item_id in line_warehouses:
                    line_wh_id = int(line_warehouses[item_id])
                elif warehouse_id is not None:
                    line_wh_id = int(warehouse_id)
                if line_wh_id is None or line_wh_id <= 0:
                    raise ValidationError(
                        f"请为物料 {it.material_code or it.material_name or item_id} 指定出库仓库"
                    )
                line_wh_name = await _resolve_warehouse_name_by_id(
                    tenant_id=tenant_id,
                    warehouse_id=line_wh_id,
                    preferred_name=warehouse_name if warehouse_id == line_wh_id else None,
                )
                if header_wh_id is None:
                    header_wh_id = line_wh_id
                    header_wh_name = line_wh_name

                amt = qty * (it.unit_price or Decimal("0"))
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
                    is_gift=bool(getattr(it, "is_gift", False)),
                    gift_ref_unit_price=getattr(it, "gift_ref_unit_price", None),
                    sales_order_item_id=it.id,
                    warehouse_id=line_wh_id,
                    warehouse_name=line_wh_name,
                )
                total_qty += qty
                total_amt += amt
            if total_qty <= Decimal("0"):
                raise BusinessLogicError("销售订单无欠发明细，无法下推发货通知单")
            await ShipmentNotice.filter(tenant_id=tenant_id, id=notice.id).update(
                total_quantity=total_qty,
                total_amount=total_amt,
                warehouse_id=header_wh_id,
                warehouse_name=header_wh_name,
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
        related_deliveries = getattr(notified, "related_sales_delivery_ids", None) or []
        delivery_codes = [
            str(entry.get("code"))
            for entry in related_deliveries
            if isinstance(entry, dict) and entry.get("code")
        ]
        if not delivery_codes and getattr(notified, "sales_delivery_code", None):
            delivery_codes = [str(notified.sales_delivery_code)]
        message = "已生成发货通知单并已通知仓库"
        if len(delivery_codes) > 1:
            message = f"已生成发货通知单并已通知仓库（生成 {len(delivery_codes)} 张销售出库单）"
        return {
            "success": True,
            "message": message,
            "notice_id": notice_id,
            "notice_code": code,
            "status": notified.status,
            "sales_delivery_id": getattr(notified, "sales_delivery_id", None),
            "sales_delivery_code": getattr(notified, "sales_delivery_code", None),
            "sales_delivery_codes": delivery_codes,
            "related_sales_delivery_ids": related_deliveries,
        }

    async def list_shipment_notice_pull_lines(
        self,
        tenant_id: int,
        *,
        skip: int = 0,
        limit: int = 20,
        keyword: Optional[str] = None,
        sales_order_id: Optional[int] = None,
        pullable_only: bool = True,
    ) -> Dict[str, Any]:
        """开口销售订单行：可转发货通知的剩余明细。"""
        from apps.kuaizhizao.utils.sales_order_push_qty import batch_pushable_qty_by_order_item

        so_query = SalesOrder.filter(tenant_id=tenant_id, deleted_at__isnull=True)
        if sales_order_id is not None:
            so_query = so_query.filter(id=int(sales_order_id))
        orders = await so_query.only(
            "id", "order_code", "status", "customer_id", "customer_name"
        )
        order_by_id = {int(o.id): o for o in orders}
        if not order_by_id:
            return {"data": [], "total": 0}
        items = await SalesOrderItem.filter(
            tenant_id=tenant_id, sales_order_id__in=list(order_by_id.keys())
        ).all()
        pushable = await batch_pushable_qty_by_order_item(tenant_id, items)
        kw = (keyword or "").strip().lower()
        lines: List[Dict[str, Any]] = []
        for item in items:
            order = order_by_id.get(int(item.sales_order_id))
            if not order:
                continue
            qty = float(item.order_quantity or 0)
            if qty <= 0:
                continue
            remaining = float(pushable.get(int(order.id), {}).get(int(item.id), Decimal("0")))
            pushed = max(0.0, qty - remaining)
            can_push = self._is_audited(order.status) and remaining > 0
            if pullable_only and not (can_push and remaining > 0):
                continue
            material_code = str(item.material_code or "").strip()
            material_name = str(item.material_name or "").strip()
            material_spec = str(item.material_spec or "").strip()
            if kw:
                haystack = " ".join([material_code, material_name, material_spec]).lower()
                if kw not in haystack:
                    continue
            lines.append(
                {
                    "id": int(item.id),
                    "sales_order_id": int(item.sales_order_id),
                    "order_code": order.order_code,
                    "customer_id": order.customer_id,
                    "customer_name": order.customer_name,
                    "material_id": item.material_id,
                    "material_code": material_code,
                    "material_name": material_name,
                    "material_spec": material_spec or None,
                    "unit": item.material_unit or "件",
                    "suggested_quantity": qty,
                    "pushed_quantity": pushed,
                    "remaining_quantity": remaining,
                    "required_date": str(item.required_date) if getattr(item, "required_date", None) else None,
                }
            )
        lines.sort(
            key=lambda r: (
                str(r.get("order_code") or ""),
                str(r.get("material_code") or ""),
                int(r.get("id") or 0),
            )
        )
        return {"data": lines[skip : skip + limit], "total": len(lines)}

    async def create_shipment_notices_from_sales_order_items(
        self,
        tenant_id: int,
        item_ids: List[int],
        created_by: int,
    ) -> Dict[str, Any]:
        """按销售订单行 id 建发货通知，可跨多张订单；同客户合并一张。"""
        from apps.kuaizhizao.utils.sales_order_push_qty import batch_pushable_qty_by_order_item
        from apps.kuaizhizao.services.shipment_notice_service import (
            ShipmentNoticeService,
            _resolve_warehouse_name_by_id,
        )
        from apps.master_data.services.material_service import (
            resolve_primary_default_warehouse_from_material,
        )

        selected_ids = [int(v) for v in item_ids if v is not None]
        if not selected_ids:
            raise BusinessLogicError("请至少选择一条可通知销售订单明细")
        items = await SalesOrderItem.filter(tenant_id=tenant_id, id__in=selected_ids).all()
        if not items:
            raise BusinessLogicError("没有可通知的销售订单行")
        order_ids = sorted({int(i.sales_order_id) for i in items})
        orders = await SalesOrder.filter(
            tenant_id=tenant_id, id__in=order_ids, deleted_at__isnull=True
        ).all()
        order_by_id = {int(o.id): o for o in orders}
        if len(order_by_id) != len(order_ids):
            raise NotFoundError("销售订单不存在")
        for order in orders:
            order_items = [i for i in items if int(i.sales_order_id) == int(order.id)]
            await self._assert_sales_order_capability_for_order(
                tenant_id, order, "push_shipment_notice", items=order_items
            )
        pushable = await batch_pushable_qty_by_order_item(tenant_id, items)
        groups: Dict[int, List[SalesOrderItem]] = {}
        for item in items:
            groups.setdefault(int(order_by_id[int(item.sales_order_id)].customer_id or 0), []).append(item)

        notice_service = ShipmentNoticeService()
        today = today_site_str()
        notices_out: List[Dict[str, Any]] = []
        for _cid, group_items in groups.items():
            source_order_ids = sorted({int(i.sales_order_id) for i in group_items})
            primary = order_by_id[source_order_ids[0]]
            code = await notice_service.generate_code(
                tenant_id, "SHIPMENT_NOTICE_CODE", prefix=f"SN{today}"
            )
            header_wh_id: Optional[int] = None
            header_wh_name: Optional[str] = None
            created_lines = 0
            async with in_transaction():
                notice = await ShipmentNotice.create(
                    tenant_id=tenant_id,
                    notice_code=code,
                    sales_order_id=primary.id,
                    sales_order_code=primary.order_code or "",
                    customer_id=primary.customer_id,
                    customer_name=primary.customer_name or "",
                    customer_contact=primary.customer_contact,
                    customer_phone=primary.customer_phone,
                    shipping_address=primary.shipping_address,
                    planned_ship_date=primary.delivery_date,
                    status="待发货",
                    notes=primary.notes,
                    created_by=created_by,
                    updated_by=created_by,
                )
                total_qty = Decimal("0")
                total_amt = Decimal("0")
                for it in group_items:
                    item_id = int(it.id)
                    remaining_qty = pushable.get(int(it.sales_order_id), {}).get(item_id, Decimal("0"))
                    qty = max(Decimal("0"), Decimal(str(remaining_qty)))
                    if qty <= Decimal("0"):
                        continue
                    material_wh = await resolve_primary_default_warehouse_from_material(
                        tenant_id, material_id=int(it.material_id)
                    ) if it.material_id else None
                    if not material_wh or not material_wh[0]:
                        raise ValidationError(
                            f"请为物料 {it.material_code or it.material_name or item_id} 指定出库仓库"
                        )
                    line_wh_id = int(material_wh[0])
                    line_wh_name = material_wh[1] or await _resolve_warehouse_name_by_id(
                        tenant_id=tenant_id, warehouse_id=line_wh_id
                    )
                    if header_wh_id is None:
                        header_wh_id = line_wh_id
                        header_wh_name = line_wh_name
                    amt = qty * (it.unit_price or Decimal("0"))
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
                        is_gift=bool(getattr(it, "is_gift", False)),
                        gift_ref_unit_price=getattr(it, "gift_ref_unit_price", None),
                        sales_order_item_id=it.id,
                        warehouse_id=line_wh_id,
                        warehouse_name=line_wh_name,
                    )
                    total_qty += qty
                    total_amt += amt
                    created_lines += 1
                if total_qty <= Decimal("0"):
                    raise BusinessLogicError("销售订单无欠发明细，无法下推发货通知单")
                await ShipmentNotice.filter(tenant_id=tenant_id, id=notice.id).update(
                    total_quantity=total_qty,
                    total_amount=total_amt,
                    warehouse_id=header_wh_id,
                    warehouse_name=header_wh_name,
                )
            notified = await notice_service.notify_warehouse(
                tenant_id=tenant_id,
                notice_id=notice.id,
                notified_by=created_by,
            )
            notices_out.append({
                "notice_id": notice.id,
                "notice_code": code,
                "status": notified.status,
            })
        first = notices_out[0]
        msg = (
            f"转单成功，共生成 {len(notices_out)} 张发货通知单"
            if len(notices_out) > 1
            else "已生成发货通知单并已通知仓库"
        )
        return {
            "success": True,
            "message": msg,
            "notice_id": first["notice_id"],
            "notice_code": first["notice_code"],
            "notices": notices_out,
        }

    async def preview_push_sales_order_to_shipment_notice(
        self, tenant_id: int, sales_order_id: int
    ) -> Dict[str, Any]:
        """下推发货通知单预览：返回可选择的订单明细及可下推数量。"""
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

        from apps.kuaizhizao.utils.sales_order_push_qty import get_pushable_qty_for_order_items

        pushable_by_item = await get_pushable_qty_for_order_items(
            tenant_id, sales_order_id, items
        )
        material_fallback = await self._load_material_fallback_for_items(tenant_id, items)
        from apps.master_data.services.material_service import (
            resolve_primary_default_warehouse_from_material,
        )

        preview_items: List[Dict[str, Any]] = []
        for it in items:
            order_qty = Decimal(str(it.order_quantity or 0))
            delivered_qty = Decimal(str(it.delivered_quantity or 0))
            item_id = int(it.id)
            max_push_qty = pushable_by_item.get(item_id, Decimal("0"))
            material_code, material_name = self._resolve_item_material_display(it, material_fallback)
            line_wh_id: Optional[int] = None
            line_wh_name: Optional[str] = None
            material_id = getattr(it, "material_id", None)
            if material_id:
                material_wh = await resolve_primary_default_warehouse_from_material(
                    tenant_id,
                    material_id=int(material_id),
                )
                if material_wh:
                    line_wh_id, line_wh_name = material_wh
            preview_items.append(
                {
                    "item_id": int(it.id),
                    "material_code": material_code,
                    "material_name": material_name,
                    "quantity": float(order_qty),
                    "pushed_quantity": float(delivered_qty),
                    "max_push_quantity": float(max_push_qty),
                    "delivery_date": str(it.delivery_date) if it.delivery_date else None,
                    "suggested_action": "发货",
                    "warehouse_id": line_wh_id,
                    "warehouse_name": line_wh_name,
                }
            )

        if not preview_items:
            raise BusinessLogicError("销售订单无有效明细，无法下推发货通知单")

        pushable_count = sum(
            1 for row in preview_items if Decimal(str(row.get("max_push_quantity", 0))) > 0
        )

        return {
            "target_type": "shipment_notice",
            "summary": f"请选择本次要通知发货的产品与数量（共 {pushable_count} 条可发货明细）",
            "items": preview_items,
            "tip": "请为每行选择出库仓库；系统将按所选数量生成发货通知单，并自动通知仓库生成销售出库。",
            "line_warehouse_required": True,
        }

    async def preview_push_sales_order_to_delivery(
        self, tenant_id: int, sales_order_id: int
    ) -> Dict[str, Any]:
        """下推销售出库预览：返回订单明细数量、已下推、可下推。"""
        order = await SalesOrder.get_or_none(
            tenant_id=tenant_id, id=sales_order_id, deleted_at__isnull=True
        )
        if not order:
            raise NotFoundError(f"销售订单不存在: {sales_order_id}")
        await self._assert_sales_order_capability_for_order(
            tenant_id, order, "push_sales_delivery"
        )

        items = await SalesOrderItem.filter(
            tenant_id=tenant_id, sales_order_id=sales_order_id
        ).order_by("id")
        if not items:
            raise BusinessLogicError("销售订单无明细，无法下推销售出库")

        from apps.kuaizhizao.utils.sales_order_push_qty import get_pushable_qty_for_order_items

        pushable_by_item = await get_pushable_qty_for_order_items(
            tenant_id, sales_order_id, items
        )
        material_fallback = await self._load_material_fallback_for_items(tenant_id, items)
        from apps.master_data.services.material_service import (
            resolve_primary_default_warehouse_from_material,
        )
        preview_items: List[Dict[str, Any]] = []
        for it in items:
            order_qty = Decimal(str(it.order_quantity or 0))
            if order_qty <= 0:
                continue
            delivered_qty = Decimal(str(it.delivered_quantity or 0))
            item_id = int(it.id)
            max_push_qty = pushable_by_item.get(item_id, Decimal("0"))
            material_code, material_name = self._resolve_item_material_display(it, material_fallback)
            line_wh_id: Optional[int] = None
            line_wh_name: Optional[str] = None
            material_id = getattr(it, "material_id", None)
            if material_id:
                material_wh = await resolve_primary_default_warehouse_from_material(
                    tenant_id,
                    material_id=int(material_id),
                )
                if material_wh:
                    line_wh_id, line_wh_name = material_wh
            preview_items.append(
                {
                    "item_id": int(it.id),
                    "material_code": material_code,
                    "material_name": material_name,
                    "quantity": float(order_qty),
                    "pushed_quantity": float(delivered_qty),
                    "max_push_quantity": float(max_push_qty),
                    "delivery_date": str(it.delivery_date) if it.delivery_date else None,
                    "warehouse_id": line_wh_id,
                    "warehouse_name": line_wh_name,
                }
            )

        if not preview_items:
            raise BusinessLogicError("销售订单无有效明细，无法下推销售出库")

        pushable_count = sum(
            1 for row in preview_items if float(row.get("max_push_quantity") or 0) > 0
        )
        return {
            "target_type": "sales_delivery",
            "summary": f"请选择本次要下推的出库明细（{pushable_count}/{len(preview_items)} 行可下推）",
            "items": preview_items,
            "tip": "请为每行选择出库仓库；确认后将按所选明细与数量生成销售出库单。",
            "line_warehouse_required": True,
        }

    async def preview_push_sales_order_to_invoice(
        self, tenant_id: int, sales_order_id: int
    ) -> Dict[str, Any]:
        """下推销售发票预览：返回订单明细数量、已下推、可下推。"""
        order = await SalesOrder.get_or_none(
            tenant_id=tenant_id, id=sales_order_id, deleted_at__isnull=True
        )
        if not order:
            raise NotFoundError(f"销售订单不存在: {sales_order_id}")
        await self._assert_sales_order_capability_for_order(tenant_id, order, "push_invoice")

        items = await SalesOrderItem.filter(
            tenant_id=tenant_id, sales_order_id=sales_order_id
        ).order_by("id")
        if not items:
            raise BusinessLogicError("销售订单无明细，无法下推销售发票")
        order_total = Decimal(str(order.total_amount or 0))
        if order_total <= Decimal("0"):
            raise BusinessLogicError("订单无计费金额，无法下推销售发票")

        material_fallback = await self._load_material_fallback_for_items(tenant_id, items)
        preview_items: List[Dict[str, Any]] = []
        for it in items:
            qty = Decimal(str(it.order_quantity or 0))
            if qty <= 0:
                continue
            material_code, material_name = self._resolve_item_material_display(it, material_fallback)
            preview_items.append(
                {
                    "item_id": int(it.id),
                    "material_code": material_code,
                    "material_name": material_name,
                    "quantity": float(qty),
                    "pushed_quantity": 0.0,
                    "max_push_quantity": float(qty),
                }
            )

        if not preview_items:
            raise BusinessLogicError("销售订单无有效明细，无法下推销售发票")

        return {
            "target_type": "sales_invoice",
            "summary": f"请确认将下推的订单明细（{len(preview_items)} 行）",
            "items": preview_items,
            "tip": "确认后将按全部订单明细生成销售发票草稿。",
        }

    async def preview_push_sales_order_to_sales_return(
        self, tenant_id: int, sales_order_id: int
    ) -> Dict[str, Any]:
        """下推销售退货预览：返回可退明细及数量三门。"""
        order = await SalesOrder.get_or_none(
            tenant_id=tenant_id, id=sales_order_id, deleted_at__isnull=True
        )
        if not order:
            raise NotFoundError(f"销售订单不存在: {sales_order_id}")
        await self._assert_sales_order_capability_for_order(
            tenant_id, order, "push_sales_return"
        )

        from apps.kuaizhizao.services.warehouse_service import SalesReturnService

        raw = await SalesReturnService().get_sales_order_return_preview(
            tenant_id=tenant_id,
            sales_order_id=sales_order_id,
        )
        from apps.master_data.services.material_service import (
            resolve_primary_default_warehouse_from_material,
        )
        from apps.kuaizhizao.services.warehouse_service import (
            _list_sales_order_material_outbound_batches,
        )

        cfg = await self.business_config_service.get_business_config(tenant_id)
        batch_mgmt_enabled = bool(
            cfg.get("parameters", {}).get("warehouse", {}).get("batch_management", False)
        )
        material_ids = [
            int(line.material_id)
            for line in raw.lines
            if getattr(line, "material_id", None) is not None
        ]
        materials = (
            await Material.filter(tenant_id=tenant_id, id__in=material_ids).all()
            if material_ids
            else []
        )
        material_by_id = {int(m.id): m for m in materials}

        preview_items: List[Dict[str, Any]] = []
        for line in raw.lines:
            line_wh_id: Optional[int] = None
            line_wh_name: Optional[str] = None
            material_id = getattr(line, "material_id", None)
            if material_id:
                material_wh = await resolve_primary_default_warehouse_from_material(
                    tenant_id,
                    material_id=int(material_id),
                )
                if material_wh:
                    line_wh_id, line_wh_name = material_wh
            material = material_by_id.get(int(material_id)) if material_id else None
            requires_batch_number = bool(
                batch_mgmt_enabled
                and material
                and getattr(material, "batch_managed", False)
            )
            outbound_batches: List[Dict[str, Any]] = []
            suggested_batch: Optional[str] = None
            outbound_batch_options: List[str] = []
            sales_delivery_item_id: Optional[int] = None
            sales_delivery_id: Optional[int] = None
            if material_id:
                outbound_batches = await _list_sales_order_material_outbound_batches(
                    tenant_id=tenant_id,
                    sales_order_id=sales_order_id,
                    material_id=int(material_id),
                )
                for row in outbound_batches:
                    batch = str(row.get("batch_number") or "").strip()
                    if batch and batch not in outbound_batch_options:
                        outbound_batch_options.append(batch)
                if outbound_batches:
                    for row in outbound_batches:
                        batch = str(row.get("batch_number") or "").strip()
                        if batch:
                            suggested_batch = batch
                            sales_delivery_item_id = row.get("sales_delivery_item_id")
                            sales_delivery_id = row.get("sales_delivery_id")
                            break
            preview_items.append(
                {
                    "item_id": int(line.sales_order_item_id),
                    "material_id": int(line.material_id),
                    "material_code": line.material_code,
                    "material_name": line.material_name,
                    "quantity": float(line.source_doc_quantity),
                    "pushed_quantity": float(line.source_received_quantity),
                    "max_push_quantity": float(line.source_pending_quantity),
                    "warehouse_id": line_wh_id,
                    "warehouse_name": line_wh_name,
                    "requires_batch_number": requires_batch_number,
                    "batch_number": suggested_batch,
                    "outbound_batch_options": outbound_batch_options,
                    "sales_delivery_id": sales_delivery_id,
                    "sales_delivery_item_id": sales_delivery_item_id,
                }
            )

        pushable_count = sum(
            1 for row in preview_items if float(row.get("max_push_quantity") or 0) > 0
        )
        batch_required = any(row.get("requires_batch_number") for row in preview_items)
        return {
            "target_type": "sales_return",
            "summary": (
                f"请选择本次要退货的明细（{pushable_count}/{len(preview_items)} 行可退）"
                if preview_items
                else "当前销售订单无可退货明细"
            ),
            "items": preview_items,
            "has_blocking_issues": not preview_items,
            "blocking_reason": (
                "sales_order.push_return.no_delivered" if not preview_items else None
            ),
            "tip": (
                "请为每行选择退入仓库并填写批号（批号管理物料必填）；退货数量不能超过可退数量。"
                if batch_required
                else "请为每行选择退入仓库；退货数量不能超过可退数量。"
            ),
            "line_warehouse_required": True,
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
        await self._assert_sales_order_capability_for_order(tenant_id, order, "push_invoice")

        items = await SalesOrderItem.filter(
            tenant_id=tenant_id, sales_order_id=sales_order_id
        ).order_by("id")
        if not items:
            raise BusinessLogicError("销售订单无明细，无法下推销售发票")
        order_total = Decimal(str(order.total_amount or 0))
        if order_total <= Decimal("0"):
            raise BusinessLogicError("订单无计费金额，无法下推销售发票")

        from apps.kuaicaiwu.services.invoice_service import InvoiceService
        from apps.kuaicaiwu.schemas.invoice import InvoiceCreate, InvoiceItemCreate

        money_q = Decimal("0.01")

        def _q_money(v: Decimal) -> Decimal:
            return v.quantize(money_q, rounding=ROUND_HALF_UP)

        from apps.kuaizhizao.utils.sales_price_amount import calc_sales_line_amounts

        price_type = getattr(order, "price_type", None) or DEFAULT_SALES_PRICE_TYPE
        total_excl = Decimal("0")
        total_tax = Decimal("0")
        total_incl = Decimal("0")
        invoice_items = []
        for it in items:
            qty = it.order_quantity or Decimal("0")
            price = it.unit_price or Decimal("0")
            traw = it.tax_rate or Decimal("0")
            excl, tax, incl = calc_sales_line_amounts(qty, price, traw, price_type)
            # 发票明细 tax_rate 落库为小数（0.13）
            rate = traw / Decimal("100") if traw > Decimal("1") else traw
            line_unit_excl = _q_money(excl / qty) if qty > Decimal("0") else Decimal("0")
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
                    unit_price=line_unit_excl,
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
            
            from apps.kuaizhizao.utils.bom_helper import bom_line_unit_quantity, bom_item_base_quantity

            qty = bom.quantity or Decimal("0")
            waste_rate = bom.waste_rate or Decimal("0")
            unit_qty = bom_line_unit_quantity(qty, bom_item_base_quantity(bom))
            actual_qty = unit_qty * (Decimal("1") + waste_rate / Decimal("100"))
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
