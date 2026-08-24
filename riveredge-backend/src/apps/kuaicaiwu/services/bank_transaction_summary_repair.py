"""
合并收/付款银行流水摘要修复：回填空摘要流水及空备注收/付款单。

历史合并收/付款可能未写入 notes，同步银行流水时 summary 为空。
本模块批量解析 DocumentRelation 关联应收/应付单号并写入摘要，无需打开银行流水页。
"""

from __future__ import annotations

from dataclasses import dataclass, field
from typing import Any, List, Optional

from apps.kuaicaiwu.models.bank_transaction import BankTransaction
from apps.kuaicaiwu.models.payment import Payment
from apps.kuaicaiwu.models.receipt import Receipt
from apps.kuaicaiwu.services.bank_account_service import BankAccountService


@dataclass
class BankSummaryRepairStats:
    transactions_scanned: int = 0
    transactions_repaired: int = 0
    voucher_notes_scanned: int = 0
    voucher_notes_repaired: int = 0
    details: List[str] = field(default_factory=list)


def _is_blank(text: Optional[str]) -> bool:
    return not (text or "").strip()


class BankTransactionSummaryRepairService:
    def __init__(self) -> None:
        self._bank = BankAccountService()

    async def repair(self, tenant_id: int, *, dry_run: bool = False) -> BankSummaryRepairStats:
        stats = BankSummaryRepairStats()
        rows = await BankTransaction.filter(
            tenant_id=tenant_id,
            deleted_at__isnull=True,
            source_doc_type__in=["receipt", "payment"],
        ).order_by("id")
        for tx in rows:
            if not _is_blank(getattr(tx, "summary", None)):
                continue
            stats.transactions_scanned += 1
            repaired = await self._repair_transaction(tenant_id, tx, dry_run=dry_run, stats=stats)
            if repaired:
                stats.transactions_repaired += 1
        return stats

    async def _repair_transaction(
        self,
        tenant_id: int,
        tx: BankTransaction,
        *,
        dry_run: bool,
        stats: BankSummaryRepairStats,
    ) -> bool:
        source_type = str(getattr(tx, "source_doc_type", None) or "").strip()
        source_id = getattr(tx, "source_doc_id", None)
        if source_id is None:
            return False

        if source_type == "receipt":
            voucher = await Receipt.get_or_none(
                tenant_id=tenant_id, id=int(source_id), deleted_at__isnull=True
            )
            if not voucher:
                return False
            summary = await self._bank._resolve_voucher_bank_summary(tenant_id, "receipt", voucher)
            await self._maybe_backfill_voucher_notes(
                tenant_id,
                voucher_kind="receipt",
                voucher=voucher,
                summary=summary,
                dry_run=dry_run,
                stats=stats,
            )
        elif source_type == "payment":
            voucher = await Payment.get_or_none(
                tenant_id=tenant_id, id=int(source_id), deleted_at__isnull=True
            )
            if not voucher:
                return False
            summary = await self._bank._resolve_voucher_bank_summary(tenant_id, "payment", voucher)
            await self._maybe_backfill_voucher_notes(
                tenant_id,
                voucher_kind="payment",
                voucher=voucher,
                summary=summary,
                dry_run=dry_run,
                stats=stats,
            )
        else:
            return False

        if _is_blank(summary):
            return False

        code = str(getattr(tx, "source_doc_code", None) or getattr(voucher, "receipt_code", None) or getattr(voucher, "payment_code", None) or "")
        stats.details.append(f"tx#{tx.id} {code}: {summary}")
        if dry_run:
            return True

        tx.summary = summary
        await tx.save(update_fields=["summary", "updated_at"])
        return True

    async def _maybe_backfill_voucher_notes(
        self,
        tenant_id: int,
        *,
        voucher_kind: str,
        voucher: Any,
        summary: Optional[str],
        dry_run: bool,
        stats: BankSummaryRepairStats,
    ) -> None:
        del tenant_id, voucher_kind
        if not _is_blank(getattr(voucher, "notes", None)):
            return
        if _is_blank(summary):
            return
        stats.voucher_notes_scanned += 1
        stats.voucher_notes_repaired += 1
        if dry_run:
            return
        voucher.notes = summary
        await voucher.save(update_fields=["notes", "updated_at"])
