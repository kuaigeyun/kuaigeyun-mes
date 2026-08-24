"""
合并开票源单分摊修复：补齐 DocumentRelation.allocated_amount，并清除多头挂接。

历史合并开票可能仅把整票记在第一张应收/应付上；列表已开票金额按关联分摊汇总。
本模块按源单金额比例回填分摊，并确保多源发票不再保留 receivable_id / payable_id。
"""

from __future__ import annotations

from dataclasses import dataclass, field
from decimal import Decimal
from typing import Dict, Iterable, List, Optional, Sequence, Set, Tuple

from apps.kuaicaiwu.models.invoice import Invoice
from apps.kuaicaiwu.models.payable import Payable
from apps.kuaicaiwu.models.purchase_invoice import PurchaseInvoice
from apps.kuaicaiwu.models.receivable import Receivable
from apps.kuaicaiwu.services.invoice_source_allocation import (
    attribute_invoice_total_to_sources,
    encode_relation_allocated_amount,
    parse_relation_allocated_amount,
)
from apps.kuaizhizao.models.document_relation import DocumentRelation

_TWOPLACES = Decimal("0.01")
_EXCLUDED_INVOICE_STATUSES = ("已作废", "已红冲")


@dataclass
class MergeInvoiceRepairStats:
    scanned: int = 0
    repaired: int = 0
    relations_created: int = 0
    relations_updated: int = 0
    invoices_cleared_header_link: int = 0
    details: List[str] = field(default_factory=list)


def _q(value: Decimal | str | int | float | None) -> Decimal:
    return Decimal(str(value or 0)).quantize(_TWOPLACES)


def _parse_source_codes(raw: Optional[str]) -> List[str]:
    if not raw:
        return []
    parts: List[str] = []
    for chunk in str(raw).replace("，", ",").split(","):
        code = chunk.strip()
        if code:
            parts.append(code)
    return parts


def _resolve_allocations(
    invoice_total: Decimal,
    source_ids: Sequence[int],
    doc_totals: Dict[int, Decimal],
    explicit_by_source: Dict[int, Optional[Decimal]],
) -> Dict[int, Decimal]:
    if not source_ids:
        return {}
    total = _q(invoice_total)
    entries = [(int(sid), explicit_by_source.get(int(sid))) for sid in source_ids]
    if all(explicit_by_source.get(int(sid)) is not None for sid in source_ids):
        out = {int(sid): _q(explicit_by_source[int(sid)]) for sid in source_ids}
        drift = total - sum(out.values(), Decimal("0"))
        if drift != 0 and source_ids:
            last = int(source_ids[-1])
            out[last] = _q(out[last] + drift)
        return out
    return attribute_invoice_total_to_sources(total, entries, doc_totals)


class InvoiceMergeAllocationRepairService:
    async def repair_sales_invoices(
        self,
        tenant_id: int,
        *,
        dry_run: bool = False,
    ) -> MergeInvoiceRepairStats:
        stats = MergeInvoiceRepairStats()
        rows = await Invoice.filter(
            tenant_id=tenant_id,
            category="OUT",
            deleted_at__isnull=True,
        ).exclude(status__in=list(_EXCLUDED_INVOICE_STATUSES))
        for inv in rows:
            changed = await self._repair_one_sales_invoice(tenant_id, inv, dry_run=dry_run)
            stats.scanned += 1
            if changed:
                stats.repaired += 1
        return stats

    async def repair_purchase_invoices(
        self,
        tenant_id: int,
        *,
        dry_run: bool = False,
    ) -> MergeInvoiceRepairStats:
        stats = MergeInvoiceRepairStats()
        rows = await PurchaseInvoice.filter(
            tenant_id=tenant_id,
            deleted_at__isnull=True,
        ).exclude(status__in=list(_EXCLUDED_INVOICE_STATUSES))
        for inv in rows:
            changed = await self._repair_one_purchase_invoice(tenant_id, inv, dry_run=dry_run)
            stats.scanned += 1
            if changed:
                stats.repaired += 1
        return stats

    async def _repair_one_sales_invoice(
        self,
        tenant_id: int,
        inv: Invoice,
        *,
        dry_run: bool,
    ) -> bool:
        rels = await DocumentRelation.filter(
            tenant_id=tenant_id,
            source_type="receivable",
            target_type="sales_invoice",
            target_id=int(inv.id),
        ).all()
        source_ids = await self._collect_receivable_source_ids(
            tenant_id, inv, rels, header_id=getattr(inv, "receivable_id", None)
        )
        if len(source_ids) <= 1 and not rels:
            return False
        if len(source_ids) <= 1 and len(rels) == 1:
            rel = rels[0]
            if parse_relation_allocated_amount(getattr(rel, "notes", None)) is not None:
                return False
            source_ids = [int(rel.source_id)]

        doc_totals = await self._receivable_totals(tenant_id, source_ids)
        explicit = {
            int(r.source_id): parse_relation_allocated_amount(getattr(r, "notes", None))
            for r in rels
            if r.source_id is not None
        }
        allocations = _resolve_allocations(
            _q(inv.total_amount),
            sorted(source_ids),
            doc_totals,
            explicit,
        )
        if not allocations:
            return False

        changed = await self._apply_relation_allocations(
            tenant_id=tenant_id,
            rels=rels,
            source_type="receivable",
            target_type="sales_invoice",
            invoice_id=int(inv.id),
            invoice_code=str(inv.invoice_code or inv.id),
            allocations=allocations,
            code_by_id=await self._receivable_codes(tenant_id, source_ids),
            dry_run=dry_run,
        )

        if len(source_ids) > 1 and getattr(inv, "receivable_id", None):
            if not dry_run:
                await Invoice.filter(tenant_id=tenant_id, id=int(inv.id)).update(
                    receivable_id=None,
                    receivable_code=None,
                )
            changed = True
        return changed

    async def _repair_one_purchase_invoice(
        self,
        tenant_id: int,
        inv: PurchaseInvoice,
        *,
        dry_run: bool,
    ) -> bool:
        rels = await DocumentRelation.filter(
            tenant_id=tenant_id,
            source_type="payable",
            target_type="purchase_invoice",
            target_id=int(inv.id),
        ).all()
        source_ids = await self._collect_payable_source_ids(
            tenant_id, inv, rels, header_id=getattr(inv, "payable_id", None)
        )
        if len(source_ids) <= 1 and not rels:
            return False
        if len(source_ids) <= 1 and len(rels) == 1:
            rel = rels[0]
            if parse_relation_allocated_amount(getattr(rel, "notes", None)) is not None:
                return False
            source_ids = [int(rel.source_id)]

        doc_totals = await self._payable_totals(tenant_id, source_ids)
        explicit = {
            int(r.source_id): parse_relation_allocated_amount(getattr(r, "notes", None))
            for r in rels
            if r.source_id is not None
        }
        allocations = _resolve_allocations(
            _q(inv.total_amount),
            sorted(source_ids),
            doc_totals,
            explicit,
        )
        if not allocations:
            return False

        changed = await self._apply_relation_allocations(
            tenant_id=tenant_id,
            rels=rels,
            source_type="payable",
            target_type="purchase_invoice",
            invoice_id=int(inv.id),
            invoice_code=str(inv.invoice_code or inv.id),
            allocations=allocations,
            code_by_id=await self._payable_codes(tenant_id, source_ids),
            dry_run=dry_run,
        )

        if len(source_ids) > 1 and getattr(inv, "payable_id", None):
            if not dry_run:
                await PurchaseInvoice.filter(tenant_id=tenant_id, id=int(inv.id)).update(
                    payable_id=None,
                    payable_code=None,
                )
            changed = True
        return changed

    async def _collect_receivable_source_ids(
        self,
        tenant_id: int,
        inv: Invoice,
        rels: Sequence[DocumentRelation],
        *,
        header_id: Optional[int],
    ) -> Set[int]:
        source_ids: Set[int] = {int(r.source_id) for r in rels if r.source_id is not None}
        if header_id:
            source_ids.add(int(header_id))
        codes = _parse_source_codes(getattr(inv, "source_document_code", None))
        if codes:
            rows = await Receivable.filter(
                tenant_id=tenant_id,
                receivable_code__in=codes,
                deleted_at__isnull=True,
            ).values("id", "receivable_code")
            for row in rows:
                source_ids.add(int(row["id"]))
        return source_ids

    async def _collect_payable_source_ids(
        self,
        tenant_id: int,
        inv: PurchaseInvoice,
        rels: Sequence[DocumentRelation],
        *,
        header_id: Optional[int],
    ) -> Set[int]:
        source_ids: Set[int] = {int(r.source_id) for r in rels if r.source_id is not None}
        if header_id:
            source_ids.add(int(header_id))
        for code in _parse_source_codes(getattr(inv, "payable_code", None)):
            row = await Payable.filter(
                tenant_id=tenant_id,
                payable_code=code,
                deleted_at__isnull=True,
            ).first()
            if row:
                source_ids.add(int(row.id))
        return source_ids

    async def _receivable_totals(self, tenant_id: int, source_ids: Iterable[int]) -> Dict[int, Decimal]:
        ids = sorted({int(x) for x in source_ids})
        if not ids:
            return {}
        return {
            int(row["id"]): _q(row.get("total_amount"))
            for row in await Receivable.filter(tenant_id=tenant_id, id__in=ids).values(
                "id", "total_amount"
            )
        }

    async def _payable_totals(self, tenant_id: int, source_ids: Iterable[int]) -> Dict[int, Decimal]:
        ids = sorted({int(x) for x in source_ids})
        if not ids:
            return {}
        return {
            int(row["id"]): _q(row.get("total_amount"))
            for row in await Payable.filter(tenant_id=tenant_id, id__in=ids).values(
                "id", "total_amount"
            )
        }

    async def _receivable_codes(self, tenant_id: int, source_ids: Iterable[int]) -> Dict[int, str]:
        ids = sorted({int(x) for x in source_ids})
        return {
            int(row["id"]): str(row.get("receivable_code") or row["id"])
            for row in await Receivable.filter(tenant_id=tenant_id, id__in=ids).values(
                "id", "receivable_code"
            )
        }

    async def _payable_codes(self, tenant_id: int, source_ids: Iterable[int]) -> Dict[int, str]:
        ids = sorted({int(x) for x in source_ids})
        return {
            int(row["id"]): str(row.get("payable_code") or row["id"])
            for row in await Payable.filter(tenant_id=tenant_id, id__in=ids).values(
                "id", "payable_code"
            )
        }

    async def _apply_relation_allocations(
        self,
        *,
        tenant_id: int,
        rels: Sequence[DocumentRelation],
        source_type: str,
        target_type: str,
        invoice_id: int,
        invoice_code: str,
        allocations: Dict[int, Decimal],
        code_by_id: Dict[int, str],
        dry_run: bool,
    ) -> bool:
        rel_by_source = {int(r.source_id): r for r in rels if r.source_id is not None}
        changed = False
        for sid, amount in allocations.items():
            notes = encode_relation_allocated_amount(amount)
            rel = rel_by_source.get(int(sid))
            if rel:
                current = parse_relation_allocated_amount(getattr(rel, "notes", None))
                if current == _q(amount):
                    continue
                if not dry_run:
                    rel.notes = notes
                    await rel.save(update_fields=["notes"])
                changed = True
                continue
            if dry_run:
                changed = True
                continue
            await DocumentRelation.create(
                tenant_id=tenant_id,
                source_type=source_type,
                source_id=int(sid),
                source_code=code_by_id.get(int(sid)),
                target_type=target_type,
                target_id=invoice_id,
                target_code=invoice_code,
                relation_type="source",
                relation_mode="pull",
                relation_desc="合并开票分摊修复",
                notes=notes,
            )
            changed = True
        return changed
