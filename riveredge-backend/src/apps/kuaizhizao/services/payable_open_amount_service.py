"""
应付可请款/open 额度：扣除已确认付款占用与已批准付款申请占用。
"""

from __future__ import annotations

from decimal import Decimal
from typing import Dict, List, Optional

from apps.kuaicaiwu.models.payment import Payment
from apps.kuaicaiwu.models.payable import Payable
from apps.kuaizhizao.models.document_relation import DocumentRelation
from apps.kuaizhizao.models.payment_application import PaymentApplication, PaymentApplicationLine


class PayableOpenAmountService:
    _RESERVED_PAYMENT_STATUSES = frozenset({"Confirmed"})
    _APPROVED_APP_STATUSES = frozenset({"已批准", "部分付款", "APPROVED", "AUDITED", "已通过"})

    async def sum_reserved_unsettled_by_payable(
        self,
        tenant_id: int,
        payable_ids: List[int],
    ) -> Dict[int, Decimal]:
        result: Dict[int, Decimal] = {pid: Decimal("0") for pid in payable_ids}
        if not payable_ids:
            return result

        relations = await DocumentRelation.filter(
            tenant_id=tenant_id,
            source_type="payable",
            source_id__in=payable_ids,
            target_type="payment",
        ).all()
        payment_by_payable: Dict[int, List[int]] = {}
        for rel in relations:
            if rel.source_id and rel.target_id:
                payment_by_payable.setdefault(int(rel.source_id), []).append(int(rel.target_id))

        all_payment_ids = {pid for ids in payment_by_payable.values() for pid in ids}
        payment_map: Dict[int, Payment] = {}
        if all_payment_ids:
            rows = await Payment.filter(
                tenant_id=tenant_id,
                id__in=list(all_payment_ids),
                deleted_at__isnull=True,
                status__in=list(self._RESERVED_PAYMENT_STATUSES),
            ).all()
            payment_map = {int(p.id): p for p in rows}

        for payable_id, payment_ids in payment_by_payable.items():
            reserved = Decimal("0")
            for payment_id in payment_ids:
                payment = payment_map.get(payment_id)
                if payment:
                    reserved += Decimal(str(payment.unsettled_amount or 0))
            result[payable_id] = reserved
        return result

    async def sum_reserved_by_approved_applications(
        self,
        tenant_id: int,
        payable_ids: List[int],
        *,
        exclude_application_id: Optional[int] = None,
    ) -> Dict[int, Decimal]:
        result: Dict[int, Decimal] = {pid: Decimal("0") for pid in payable_ids}
        if not payable_ids:
            return result

        app_query = PaymentApplication.filter(
            tenant_id=tenant_id,
            deleted_at__isnull=True,
            status__in=list(self._APPROVED_APP_STATUSES),
        )
        if exclude_application_id:
            app_query = app_query.exclude(id=exclude_application_id)
        apps = await app_query.all()
        if not apps:
            return result
        app_ids = [int(a.id) for a in apps]

        lines = await PaymentApplicationLine.filter(
            tenant_id=tenant_id,
            application_id__in=app_ids,
            payable_id__in=payable_ids,
        ).all()
        for line in lines:
            pid = int(line.payable_id or 0)
            if pid not in result:
                continue
            req = Decimal(str(line.request_amount or 0))
            paid = Decimal(str(line.paid_amount or 0))
            open_req = max(Decimal("0"), req - paid)
            result[pid] += open_req
        return result

    async def max_request_for_payable(
        self,
        tenant_id: int,
        payable: Payable,
        *,
        exclude_application_id: Optional[int] = None,
    ) -> Decimal:
        pid = int(payable.id)
        remaining = Decimal(str(payable.remaining_amount or 0))
        if remaining <= 0:
            return Decimal("0")
        pay_reserved = (
            await self.sum_reserved_unsettled_by_payable(tenant_id, [pid])
        ).get(pid, Decimal("0"))
        app_reserved = (
            await self.sum_reserved_by_approved_applications(
                tenant_id, [pid], exclude_application_id=exclude_application_id
            )
        ).get(pid, Decimal("0"))
        return max(Decimal("0"), remaining - pay_reserved - app_reserved)
