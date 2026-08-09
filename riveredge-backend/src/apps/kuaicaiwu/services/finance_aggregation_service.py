"""
业财只读聚合：看板 KPI、往来缺口三列语义（quantity / pushed / max）。
"""

from __future__ import annotations

import asyncio
from decimal import Decimal
from typing import Any, Dict, List, Optional

from tortoise.functions import Sum


class FinanceAggregationService:
    """财务看板与对账聚合（只读）。"""

    _MONEY = Decimal("0.01")

    def _q(self, value: Decimal | float | int | str) -> Decimal:
        return Decimal(str(value or 0)).quantize(self._MONEY)

    async def _sum_field(self, queryset, field: str) -> Decimal:
        """Tortoise QuerySet 无 Django 式 aggregate，用 annotate + values 汇总。"""
        rows = await queryset.annotate(total=Sum(field)).values("total")
        if not rows:
            return Decimal("0")
        return self._q(rows[0].get("total") or 0)

    def _build_finance_amount_triplet(
        self,
        *,
        doc_type: str,
        total: Decimal,
        settled: Decimal,
        remaining: Decimal,
    ) -> Dict[str, float]:
        total_q = self._q(total)
        settled_q = self._q(settled)
        remaining_q = self._q(remaining)
        return {
            "quantity": float(total_q),
            "pushed_quantity": float(settled_q),
            "max_push_quantity": float(max(Decimal("0"), remaining_q)),
        }

    def _gap_reason(self, *, finance_related_count: int, remaining: Decimal) -> Optional[str]:
        unlinked = finance_related_count <= 0
        unsettled = remaining > Decimal("0")
        if unlinked and unsettled:
            return "unlinked_and_unsettled"
        if unlinked:
            return "unlinked"
        if unsettled:
            return "unsettled"
        return None

    def enrich_gap_item(
        self,
        *,
        doc_type: str,
        total_amount: Decimal,
        settled_amount: Decimal,
        remaining_amount: Decimal,
        finance_related_count: int,
        base: Dict[str, Any],
    ) -> Dict[str, Any]:
        triplet = self._build_finance_amount_triplet(
            doc_type=doc_type,
            total=total_amount,
            settled=settled_amount,
            remaining=remaining_amount,
        )
        return {
            **base,
            **triplet,
            "gap_reason": self._gap_reason(
                finance_related_count=finance_related_count,
                remaining=remaining_amount,
            ),
        }

    async def get_pipeline_summary(self, tenant_id: int) -> Dict[str, Any]:
        """租户级业财管道摘要（看板只读）。"""
        from apps.kuaicaiwu.models.payable import Payable
        from apps.kuaicaiwu.models.payment import Payment
        from apps.kuaicaiwu.models.receivable import Receivable
        from apps.kuaicaiwu.models.receipt import Receipt

        ar_base = Receivable.filter(
            tenant_id=tenant_id, deleted_at__isnull=True, remaining_amount__gt=0
        )
        ap_base = Payable.filter(
            tenant_id=tenant_id, deleted_at__isnull=True, remaining_amount__gt=0
        )
        rc_base = Receipt.filter(
            tenant_id=tenant_id,
            deleted_at__isnull=True,
            unsettled_amount__gt=0,
        ).exclude(status="Cancelled")
        pm_base = Payment.filter(
            tenant_id=tenant_id,
            deleted_at__isnull=True,
            unsettled_amount__gt=0,
        ).exclude(status="Cancelled")

        (
            open_receivable,
            open_payable,
            unsettled_receipt,
            unsettled_payment,
            ar_count,
            ap_count,
            rc_count,
            pm_count,
        ) = await asyncio.gather(
            self._sum_field(ar_base, "remaining_amount"),
            self._sum_field(ap_base, "remaining_amount"),
            self._sum_field(rc_base, "unsettled_amount"),
            self._sum_field(pm_base, "unsettled_amount"),
            ar_base.count(),
            ap_base.count(),
            rc_base.count(),
            pm_base.count(),
        )

        return {
            "open_receivable_amount": float(open_receivable),
            "open_payable_amount": float(open_payable),
            "unsettled_receipt_amount": float(unsettled_receipt),
            "unsettled_payment_amount": float(unsettled_payment),
            "open_receivable_count": ar_count,
            "open_payable_count": ap_count,
            "unsettled_receipt_count": rc_count,
            "unsettled_payment_count": pm_count,
            "open_finance_document_count": ar_count + ap_count + rc_count + pm_count,
            "tip": "金额来自应收/应付待结与收付款凭证余额；缺口明细请查业财单据对账。",
        }

    async def enrich_chain_steps(self, tenant_id: int, steps: List[Dict[str, Any]]) -> List[Dict[str, Any]]:
        """为业财链路步骤补充三列金额（只读）。"""
        from apps.kuaicaiwu.models.invoice import Invoice
        from apps.kuaicaiwu.models.payable import Payable
        from apps.kuaicaiwu.models.payment import Payment
        from apps.kuaicaiwu.models.purchase_invoice import PurchaseInvoice
        from apps.kuaicaiwu.models.receipt import Receipt
        from apps.kuaicaiwu.models.receivable import Receivable

        ids_by_type: Dict[str, set[int]] = {}
        for step in steps:
            if step.get("status") != "linked" or not step.get("document_id"):
                continue
            step_type = str(step.get("step_type") or step.get("document_type") or "").lower()
            ids_by_type.setdefault(step_type, set()).add(int(step["document_id"]))

        async def _load_map(model, ids: set[int], **extra_filters):
            if not ids:
                return {}
            rows = await model.filter(
                tenant_id=tenant_id,
                id__in=list(ids),
                deleted_at__isnull=True,
                **extra_filters,
            ).all()
            return {int(r.id): r for r in rows}

        (
            receivable_map,
            receipt_map,
            payable_map,
            payment_map,
            sales_invoice_map,
            purchase_invoice_map,
        ) = await asyncio.gather(
            _load_map(Receivable, ids_by_type.get("receivable", set())),
            _load_map(Receipt, ids_by_type.get("receipt", set())),
            _load_map(Payable, ids_by_type.get("payable", set())),
            _load_map(Payment, ids_by_type.get("payment", set())),
            _load_map(Invoice, ids_by_type.get("sales_invoice", set()), category="OUT"),
            _load_map(PurchaseInvoice, ids_by_type.get("purchase_invoice", set())),
        )

        enriched: List[Dict[str, Any]] = []
        for step in steps:
            payload = dict(step)
            if payload.get("status") != "linked" or not payload.get("document_id"):
                enriched.append(payload)
                continue
            doc_id = int(payload["document_id"])
            step_type = str(payload.get("step_type") or payload.get("document_type") or "").lower()
            triplet: Optional[Dict[str, float]] = None
            if step_type == "receivable":
                row = receivable_map.get(doc_id)
                if row:
                    triplet = self._build_finance_amount_triplet(
                        doc_type=step_type,
                        total=Decimal(str(row.total_amount or 0)),
                        settled=Decimal(str(row.received_amount or 0)),
                        remaining=Decimal(str(row.remaining_amount or 0)),
                    )
            elif step_type == "receipt":
                row = receipt_map.get(doc_id)
                if row:
                    triplet = self._build_finance_amount_triplet(
                        doc_type=step_type,
                        total=Decimal(str(row.total_amount or 0)),
                        settled=Decimal(str(row.settled_amount or 0)),
                        remaining=Decimal(str(row.unsettled_amount or 0)),
                    )
            elif step_type == "payable":
                row = payable_map.get(doc_id)
                if row:
                    triplet = self._build_finance_amount_triplet(
                        doc_type=step_type,
                        total=Decimal(str(row.total_amount or 0)),
                        settled=Decimal(str(row.paid_amount or 0)),
                        remaining=Decimal(str(row.remaining_amount or 0)),
                    )
            elif step_type == "payment":
                row = payment_map.get(doc_id)
                if row:
                    triplet = self._build_finance_amount_triplet(
                        doc_type=step_type,
                        total=Decimal(str(row.total_amount or 0)),
                        settled=Decimal(str(row.settled_amount or 0)),
                        remaining=Decimal(str(row.unsettled_amount or 0)),
                    )
            elif step_type == "sales_invoice":
                row = sales_invoice_map.get(doc_id)
                if row:
                    total = Decimal(str(row.total_amount or 0))
                    triplet = self._build_finance_amount_triplet(
                        doc_type=step_type,
                        total=total,
                        settled=Decimal("0"),
                        remaining=total,
                    )
            elif step_type == "purchase_invoice":
                row = purchase_invoice_map.get(doc_id)
                if row:
                    total = Decimal(str(row.total_amount or 0))
                    triplet = self._build_finance_amount_triplet(
                        doc_type=step_type,
                        total=total,
                        settled=Decimal("0"),
                        remaining=total,
                    )
            if triplet:
                payload.update(triplet)
            enriched.append(payload)
        return enriched
