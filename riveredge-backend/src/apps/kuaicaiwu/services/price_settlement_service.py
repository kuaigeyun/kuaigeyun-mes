"""月结定价业务服务"""

from __future__ import annotations

from calendar import monthrange
from datetime import date
from decimal import Decimal
from typing import Dict, List, Optional, Tuple

from tortoise.expressions import Q
from tortoise.transactions import in_transaction

from apps.common.audit_actor import apply_create_audit, apply_update_audit
from apps.common.base_service import AppBaseService
from apps.kuaicaiwu.constants.price_settlement import (
    PriceSettlementBatchStatus,
    PriceSettlementSide,
    PriceSettlementStatus,
)
from apps.kuaicaiwu.models.price_settlement_batch import PriceSettlementBatch
from apps.kuaicaiwu.models.price_settlement_line import PriceSettlementLine
from apps.kuaicaiwu.schemas.price_settlement_schemas import (
    PriceSettlementApplyResultResponse,
    PriceSettlementBatchCreate,
    PriceSettlementBatchResponse,
    PriceSettlementCandidateResponse,
    PriceSettlementLineResponse,
    ProvisionalSummaryResponse,
)
from apps.kuaicaiwu.services.partner_statement_service import period_to_date_range
from apps.kuaicaiwu.services.price_settlement_finance_service import PriceSettlementFinanceService
from apps.kuaizhizao.models.purchase_order import PurchaseOrder, PurchaseOrderItem
from apps.kuaizhizao.models.sales_order import SalesOrder
from apps.kuaizhizao.models.sales_order_item import SalesOrderItem
from apps.master_data.models.customer import Customer
from apps.master_data.models.material import Material
from apps.master_data.models.supplier import Supplier
from apps.master_data.schemas.partner_price_book_schemas import PartnerPriceResolveRequest
from apps.master_data.services.partner_price_book_service import PartnerPriceBookService
from core.utils.timezone_utils import resolve_business_datetime, today_site_str
from infra.exceptions.exceptions import BusinessLogicError, NotFoundError, ValidationError

_MONEY = Decimal("0.01")


class PriceSettlementService(AppBaseService):
    def __init__(self) -> None:
        super().__init__()
        self.finance_service = PriceSettlementFinanceService()

    async def _load_material_model_map(
        self,
        tenant_id: int,
        material_ids: List[int],
    ) -> Dict[int, Optional[str]]:
        ids = sorted({int(i) for i in material_ids if i})
        if not ids:
            return {}
        rows = await Material.filter(
            tenant_id=tenant_id,
            id__in=ids,
            deleted_at__isnull=True,
        ).only("id", "model")
        return {row.id: row.model for row in rows}

    def _q(self, value: Decimal | float | int | str) -> Decimal:
        return Decimal(str(value or 0)).quantize(_MONEY)

    async def list_candidates(
        self,
        tenant_id: int,
        *,
        period: str,
        side: str,
        partner_id: int,
        price_source: str = "partner_book",
    ) -> List[PriceSettlementCandidateResponse]:
        start_date, end_date = period_to_date_range(period)
        if side == PriceSettlementSide.SALES.value:
            return await self._list_sales_candidates(
                tenant_id, partner_id, start_date, end_date, price_source
            )
        if side == PriceSettlementSide.PURCHASE.value:
            return await self._list_purchase_candidates(
                tenant_id, partner_id, start_date, end_date, price_source
            )
        raise ValidationError("side 须为 sales 或 purchase")

    async def _resolve_suggested_price(
        self,
        tenant_id: int,
        *,
        side: str,
        partner_id: int,
        material_id: int,
        price_source: str,
        as_of: date,
    ) -> Optional[Decimal]:
        if price_source == "manual":
            return None
        partner_type = "customer" if side == "sales" else "supplier"
        try:
            if price_source == "partner_book":
                resolved = await PartnerPriceBookService.resolve(
                    tenant_id,
                    partner_type,
                    PartnerPriceResolveRequest(
                        partner_id=partner_id,
                        material_id=material_id,
                        as_of=as_of,
                    ),
                )
                if resolved.found and resolved.unit_price is not None:
                    return self._q(resolved.unit_price)
        except Exception:
            return None
        return None

    async def _list_sales_candidates(
        self,
        tenant_id: int,
        partner_id: int,
        start_date: date,
        end_date: date,
        price_source: str,
    ) -> List[PriceSettlementCandidateResponse]:
        customer = await Customer.get_or_none(tenant_id=tenant_id, id=partner_id, deleted_at__isnull=True)
        if not customer:
            raise NotFoundError(f"客户不存在: {partner_id}")

        orders = await SalesOrder.filter(
            tenant_id=tenant_id,
            customer_id=partner_id,
            deleted_at__isnull=True,
            order_date__gte=start_date,
            order_date__lte=end_date,
        ).all()
        if not orders:
            return []

        order_ids = [o.id for o in orders]
        order_map = {o.id: o for o in orders}
        items = await SalesOrderItem.filter(
            tenant_id=tenant_id,
            sales_order_id__in=order_ids,
            price_settlement_status=PriceSettlementStatus.PROVISIONAL.value,
            deleted_at__isnull=True,
        ).order_by("sales_order_id", "id")

        material_model_map = await self._load_material_model_map(
            tenant_id,
            [item.material_id for item in items],
        )

        results: List[PriceSettlementCandidateResponse] = []
        for item in items:
            order = order_map.get(item.sales_order_id)
            if not order:
                continue
            settled_qty = self._q(getattr(item, "delivered_quantity", 0) or 0)
            before_price = self._q(item.unit_price or 0)
            suggested = await self._resolve_suggested_price(
                tenant_id,
                side="sales",
                partner_id=partner_id,
                material_id=item.material_id,
                price_source=price_source,
                as_of=end_date,
            )
            if suggested is None and item.provisional_unit_price:
                suggested = self._q(item.provisional_unit_price)
            results.append(
                PriceSettlementCandidateResponse(
                    side="sales",
                    source_order_id=order.id,
                    source_order_code=order.order_code,
                    source_line_id=item.id,
                    partner_id=partner_id,
                    partner_name=customer.name,
                    material_id=item.material_id,
                    material_code=item.material_code,
                    material_name=item.material_name,
                    material_spec=item.material_spec,
                    material_model=material_model_map.get(item.material_id),
                    material_unit=item.material_unit,
                    order_quantity=self._q(item.order_quantity or 0),
                    settled_quantity=settled_qty,
                    before_unit_price=before_price,
                    provisional_unit_price=(
                        self._q(item.provisional_unit_price)
                        if item.provisional_unit_price is not None
                        else None
                    ),
                    suggested_unit_price=suggested,
                    after_unit_price=suggested,
                    order_date=order.order_date,
                )
            )
        return results

    async def _list_purchase_candidates(
        self,
        tenant_id: int,
        partner_id: int,
        start_date: date,
        end_date: date,
        price_source: str,
    ) -> List[PriceSettlementCandidateResponse]:
        supplier = await Supplier.get_or_none(tenant_id=tenant_id, id=partner_id, deleted_at__isnull=True)
        if not supplier:
            raise NotFoundError(f"供应商不存在: {partner_id}")

        orders = await PurchaseOrder.filter(
            tenant_id=tenant_id,
            supplier_id=partner_id,
            deleted_at__isnull=True,
            order_date__gte=start_date,
            order_date__lte=end_date,
        ).all()
        if not orders:
            return []

        order_ids = [o.id for o in orders]
        order_map = {o.id: o for o in orders}
        items = await PurchaseOrderItem.filter(
            tenant_id=tenant_id,
            order_id__in=order_ids,
            price_settlement_status=PriceSettlementStatus.PROVISIONAL.value,
            deleted_at__isnull=True,
        ).order_by("order_id", "id")

        material_model_map = await self._load_material_model_map(
            tenant_id,
            [item.material_id for item in items],
        )

        results: List[PriceSettlementCandidateResponse] = []
        for item in items:
            order = order_map.get(item.order_id)
            if not order:
                continue
            settled_qty = self._q(getattr(item, "received_quantity", 0) or 0)
            before_price = self._q(item.unit_price or 0)
            suggested = await self._resolve_suggested_price(
                tenant_id,
                side="purchase",
                partner_id=partner_id,
                material_id=item.material_id,
                price_source=price_source,
                as_of=end_date,
            )
            if suggested is None and item.provisional_unit_price:
                suggested = self._q(item.provisional_unit_price)
            results.append(
                PriceSettlementCandidateResponse(
                    side="purchase",
                    source_order_id=order.id,
                    source_order_code=order.order_code,
                    source_line_id=item.id,
                    partner_id=partner_id,
                    partner_name=supplier.name,
                    material_id=item.material_id,
                    material_code=item.material_code,
                    material_name=item.material_name,
                    material_spec=item.material_spec,
                    material_model=material_model_map.get(item.material_id),
                    material_unit=item.unit,
                    order_quantity=self._q(item.ordered_quantity or 0),
                    settled_quantity=settled_qty,
                    before_unit_price=before_price,
                    provisional_unit_price=(
                        self._q(item.provisional_unit_price)
                        if item.provisional_unit_price is not None
                        else None
                    ),
                    suggested_unit_price=suggested,
                    after_unit_price=suggested,
                    order_date=order.order_date,
                )
            )
        return results

    async def create_batch(
        self,
        tenant_id: int,
        payload: PriceSettlementBatchCreate,
        operator_id: int,
    ) -> PriceSettlementBatchResponse:
        candidates = await self.list_candidates(
            tenant_id,
            period=payload.period,
            side=payload.side,
            partner_id=payload.partner_id,
            price_source=payload.price_source,
        )
        candidate_map = {c.source_line_id: c for c in candidates}
        if not candidate_map:
            raise BusinessLogicError("当前筛选条件下没有待定价行")

        line_inputs = {line.source_line_id: line.after_unit_price for line in payload.lines}
        partner_name = next(iter(candidates)).partner_name

        async with in_transaction():
            import uuid

            code = f"PS{today_site_str()}{uuid.uuid4().hex[:6].upper()}"
            batch = await PriceSettlementBatch.create(
                tenant_id=tenant_id,
                batch_code=code,
                period=payload.period,
                side=payload.side,
                partner_id=payload.partner_id,
                partner_name=partner_name,
                status=PriceSettlementBatchStatus.DRAFT.value,
                price_source=payload.price_source,
                notes=payload.notes,
                created_by=operator_id,
                updated_by=operator_id,
            )
            total_delta = Decimal("0")
            for candidate in candidates:
                after_input = line_inputs.get(candidate.source_line_id)
                after_price = self._q(after_input if after_input is not None else candidate.after_unit_price or 0)
                if after_price <= 0:
                    raise ValidationError(
                        f"订单行 {candidate.source_line_id} 定价须大于 0"
                    )
                await self._ensure_line_not_applied(
                    tenant_id, payload.period, candidate.source_line_id
                )
                delta = self._q(
                    (after_price - candidate.before_unit_price) * candidate.settled_quantity
                )
                total_delta += delta
                await PriceSettlementLine.create(
                    tenant_id=tenant_id,
                    batch_id=batch.id,
                    source_order_id=candidate.source_order_id,
                    source_order_code=candidate.source_order_code,
                    source_line_id=candidate.source_line_id,
                    material_id=candidate.material_id,
                    material_code=candidate.material_code,
                    material_name=candidate.material_name,
                    settled_quantity=candidate.settled_quantity,
                    before_unit_price=candidate.before_unit_price,
                    after_unit_price=after_price,
                    delta_amount=delta,
                )
            batch.total_delta_amount = total_delta
            await batch.save(update_fields=["total_delta_amount", "updated_at"])

        return await self.get_batch(tenant_id, batch.id)

    async def _ensure_line_not_applied(
        self, tenant_id: int, period: str, source_line_id: int
    ) -> None:
        existing_batches = await PriceSettlementBatch.filter(
            tenant_id=tenant_id,
            period=period,
            status=PriceSettlementBatchStatus.APPLIED.value,
            deleted_at__isnull=True,
        ).values_list("id", flat=True)
        if not existing_batches:
            return
        existing = await PriceSettlementLine.filter(
            tenant_id=tenant_id,
            source_line_id=source_line_id,
            batch_id__in=list(existing_batches),
        ).first()
        if existing:
            raise BusinessLogicError(f"订单行 {source_line_id} 在 {period} 已定价生效")

    async def get_batch(self, tenant_id: int, batch_id: int) -> PriceSettlementBatchResponse:
        batch = await PriceSettlementBatch.get_or_none(
            tenant_id=tenant_id, id=batch_id, deleted_at__isnull=True
        )
        if not batch:
            raise NotFoundError(f"定价单不存在: {batch_id}")
        lines = await PriceSettlementLine.filter(tenant_id=tenant_id, batch_id=batch.id).order_by("id")
        return self._batch_to_response(batch, lines)

    def _batch_to_response(
        self, batch: PriceSettlementBatch, lines: List[PriceSettlementLine]
    ) -> PriceSettlementBatchResponse:
        return PriceSettlementBatchResponse(
            id=batch.id,
            batch_code=batch.batch_code,
            period=batch.period,
            side=batch.side,
            partner_id=batch.partner_id,
            partner_name=batch.partner_name,
            status=batch.status,
            price_source=batch.price_source,
            total_delta_amount=self._q(batch.total_delta_amount or 0),
            notes=batch.notes,
            applied_at=batch.applied_at,
            applied_by_name=batch.applied_by_name,
            created_at=batch.created_at,
            updated_at=batch.updated_at,
            lines=[
                PriceSettlementLineResponse(
                    id=line.id,
                    source_order_id=line.source_order_id,
                    source_order_code=line.source_order_code,
                    source_line_id=line.source_line_id,
                    material_id=line.material_id,
                    material_code=line.material_code,
                    material_name=line.material_name,
                    settled_quantity=self._q(line.settled_quantity or 0),
                    before_unit_price=self._q(line.before_unit_price or 0),
                    after_unit_price=self._q(line.after_unit_price or 0),
                    delta_amount=self._q(line.delta_amount or 0),
                    finance_adjustment_id=line.finance_adjustment_id,
                    finance_adjustment_type=line.finance_adjustment_type,
                )
                for line in lines
            ],
        )

    async def apply_batch(
        self,
        tenant_id: int,
        batch_id: int,
        operator_id: int,
    ) -> PriceSettlementApplyResultResponse:
        batch = await PriceSettlementBatch.get_or_none(
            tenant_id=tenant_id, id=batch_id, deleted_at__isnull=True
        )
        if not batch:
            raise NotFoundError(f"定价单不存在: {batch_id}")
        if batch.status == PriceSettlementBatchStatus.APPLIED.value:
            raise BusinessLogicError("定价单已生效")
        if batch.status == PriceSettlementBatchStatus.CANCELLED.value:
            raise BusinessLogicError("定价单已作废")

        lines = await PriceSettlementLine.filter(tenant_id=tenant_id, batch_id=batch.id).order_by("id")
        if not lines:
            raise BusinessLogicError("定价单无明细")

        operator_name = await self.get_user_name(operator_id)
        receivable_ids: List[int] = []
        payable_ids: List[int] = []
        _, end_date = period_to_date_range(batch.period)
        now = resolve_business_datetime()

        async with in_transaction():
            for line in lines:
                await self._apply_order_line(
                    tenant_id,
                    batch.side,
                    line,
                    operator_id=operator_id,
                    settled_at=now,
                )
                if line.delta_amount and line.settled_quantity and line.settled_quantity > 0:
                    fin_id, fin_type = await self.finance_service.create_adjustment_for_line(
                        tenant_id,
                        side=batch.side,
                        partner_id=batch.partner_id,
                        partner_name=batch.partner_name,
                        source_order_id=line.source_order_id,
                        source_order_code=line.source_order_code,
                        settlement_line_id=line.id,
                        delta_amount=self._q(line.delta_amount),
                        business_date=end_date,
                        operator_id=operator_id,
                        notes=f"月结定价单 {batch.batch_code} 行 {line.source_line_id}",
                    )
                    if fin_id and fin_type == "receivable":
                        receivable_ids.append(fin_id)
                        line.finance_adjustment_id = fin_id
                        line.finance_adjustment_type = fin_type
                    elif fin_id and fin_type == "payable":
                        payable_ids.append(fin_id)
                        line.finance_adjustment_id = fin_id
                        line.finance_adjustment_type = fin_type
                    await line.save(
                        update_fields=[
                            "finance_adjustment_id",
                            "finance_adjustment_type",
                            "updated_at",
                        ]
                    )

            batch.status = PriceSettlementBatchStatus.APPLIED.value
            batch.applied_at = now
            batch.applied_by = operator_id
            batch.applied_by_name = operator_name
            batch.updated_by = operator_id
            await batch.save(
                update_fields=[
                    "status",
                    "applied_at",
                    "applied_by",
                    "applied_by_name",
                    "updated_by",
                    "updated_at",
                ]
            )

        refreshed = await self.get_batch(tenant_id, batch_id)
        return PriceSettlementApplyResultResponse(
            batch=refreshed,
            receivable_ids=receivable_ids,
            payable_ids=payable_ids,
        )

    async def _apply_order_line(
        self,
        tenant_id: int,
        side: str,
        line: PriceSettlementLine,
        *,
        operator_id: int,
        settled_at,
    ) -> None:
        after_price = self._q(line.after_unit_price or 0)
        if side == "sales":
            item = await SalesOrderItem.get_or_none(
                tenant_id=tenant_id, id=line.source_line_id, deleted_at__isnull=True
            )
            if not item:
                raise NotFoundError(f"销售订单行不存在: {line.source_line_id}")
            tax_rate = Decimal(str(item.tax_rate or 0))
            qty = Decimal(str(item.order_quantity or 0))
            excl = qty * after_price
            total_amount = self._q(excl * (Decimal("1") + tax_rate / Decimal("100")))
            item.unit_price = after_price
            item.total_amount = total_amount
            item.price_settlement_status = PriceSettlementStatus.SETTLED.value
            item.price_settled_at = settled_at
            item.price_settled_by = operator_id
            await item.save(
                update_fields=[
                    "unit_price",
                    "total_amount",
                    "price_settlement_status",
                    "price_settled_at",
                    "price_settled_by",
                    "updated_at",
                ]
            )
            await self._recalc_sales_order_total(tenant_id, item.sales_order_id)
            return

        item = await PurchaseOrderItem.get_or_none(
            tenant_id=tenant_id, id=line.source_line_id, deleted_at__isnull=True
        )
        if not item:
            raise NotFoundError(f"采购订单行不存在: {line.source_line_id}")
        qty = Decimal(str(item.ordered_quantity or 0))
        total_price = self._q(qty * after_price)
        item.unit_price = after_price
        item.total_price = total_price
        item.price_settlement_status = PriceSettlementStatus.SETTLED.value
        item.price_settled_at = settled_at
        item.price_settled_by = operator_id
        await item.save(
            update_fields=[
                "unit_price",
                "total_price",
                "price_settlement_status",
                "price_settled_at",
                "price_settled_by",
                "updated_at",
            ]
        )
        await self._recalc_purchase_order_total(tenant_id, item.order_id)

    async def _recalc_sales_order_total(self, tenant_id: int, order_id: int) -> None:
        items = await SalesOrderItem.filter(
            tenant_id=tenant_id, sales_order_id=order_id, deleted_at__isnull=True
        )
        total_qty = sum(Decimal(str(i.order_quantity or 0)) for i in items)
        total_amt = sum(Decimal(str(i.total_amount or 0)) for i in items)
        await SalesOrder.filter(id=order_id, tenant_id=tenant_id).update(
            total_quantity=total_qty,
            total_amount=total_amt,
        )

    async def _recalc_purchase_order_total(self, tenant_id: int, order_id: int) -> None:
        order = await PurchaseOrder.get_or_none(tenant_id=tenant_id, id=order_id)
        if not order:
            return
        items = await PurchaseOrderItem.filter(
            tenant_id=tenant_id, order_id=order_id, deleted_at__isnull=True
        )
        total_qty = sum(Decimal(str(i.ordered_quantity or 0)) for i in items)
        total_amt = sum(Decimal(str(i.total_price or 0)) for i in items)
        tax_amount = total_amt * Decimal(str(order.tax_rate or 0))
        net_amount = total_amt + tax_amount
        await PurchaseOrder.filter(id=order_id, tenant_id=tenant_id).update(
            total_quantity=total_qty,
            total_amount=total_amt,
            tax_amount=tax_amount,
            net_amount=net_amount,
        )

    async def provisional_summary(
        self,
        tenant_id: int,
        *,
        period: str,
        side: str,
        partner_id: int,
    ) -> ProvisionalSummaryResponse:
        candidates = await self.list_candidates(
            tenant_id,
            period=period,
            side=side,
            partner_id=partner_id,
            price_source="manual",
        )
        partner_name = ""
        if side == "sales":
            customer = await Customer.get_or_none(id=partner_id, tenant_id=tenant_id)
            partner_name = customer.name if customer else ""
        else:
            supplier = await Supplier.get_or_none(id=partner_id, tenant_id=tenant_id)
            partner_name = supplier.name if supplier else ""
        return ProvisionalSummaryResponse(
            side=side,
            partner_id=partner_id,
            partner_name=partner_name,
            provisional_line_count=len(candidates),
            period=period,
        )
