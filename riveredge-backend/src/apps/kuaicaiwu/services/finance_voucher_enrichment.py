"""
收/付款凭证详情 enrichment：源单、下游退款、往来对账关联。
"""

from __future__ import annotations

from decimal import Decimal
from typing import Any, Dict, List, Literal, Optional

from apps.kuaicaiwu.models.partner_statement import PartnerStatement
from apps.kuaicaiwu.models.payment import Payment
from apps.kuaicaiwu.models.receipt import Receipt
from apps.kuaicaiwu.services.finance_refund_utils import compute_refundable_balance, quantize_money
from apps.kuaizhizao.models.document_relation import DocumentRelation

VoucherKind = Literal["receipt", "payment"]

_DOC_TYPE_FAMILY: Dict[str, str] = {
    "应收单": "receivable",
    "销售退货": "receivable",
    "收款单": "receipt",
    "收款退款": "receipt",
    "应付单": "payable",
    "采购退货": "payable",
    "付款单": "payment",
    "付款退款": "payment",
}


def _line_doc_key(doc_type: Any, doc_id: Any) -> Optional[tuple[str, int]]:
    if doc_id is None:
        return None
    family = _DOC_TYPE_FAMILY.get(str(doc_type or "").strip())
    if not family:
        return None
    try:
        return family, int(doc_id)
    except (TypeError, ValueError):
        return None


async def _get_source_voucher_ref(
    tenant_id: int,
    refund_id: int,
    kind: VoucherKind,
) -> Optional[Dict[str, Any]]:
    rel = await DocumentRelation.filter(
        tenant_id=tenant_id,
        source_type=kind,
        target_type=kind,
        target_id=refund_id,
        relation_mode="pull",
    ).first()
    if not rel or not rel.source_id:
        return None
    source_id = int(rel.source_id)
    if kind == "receipt":
        source = await Receipt.get_or_none(
            tenant_id=tenant_id, id=source_id, deleted_at__isnull=True
        )
        code = str(source.receipt_code or source_id) if source else str(rel.source_code or source_id)
    else:
        source = await Payment.get_or_none(
            tenant_id=tenant_id, id=source_id, deleted_at__isnull=True
        )
        code = str(source.payment_code or source_id) if source else str(rel.source_code or source_id)
    return {"id": source_id, "code": code}


async def _list_refund_voucher_refs(
    tenant_id: int,
    source_id: int,
    kind: VoucherKind,
) -> List[Dict[str, Any]]:
    relations = await DocumentRelation.filter(
        tenant_id=tenant_id,
        source_type=kind,
        source_id=source_id,
        target_type=kind,
        relation_mode="pull",
    ).all()
    refund_ids = [int(rel.target_id) for rel in relations if rel.target_id]
    if not refund_ids:
        return []

    if kind == "receipt":
        rows = await Receipt.filter(
            tenant_id=tenant_id,
            id__in=refund_ids,
            settlement_type="refund",
            deleted_at__isnull=True,
        ).exclude(status="Cancelled")
        return [{"id": int(r.id), "code": str(r.receipt_code or r.id)} for r in rows]

    rows = await Payment.filter(
        tenant_id=tenant_id,
        id__in=refund_ids,
        settlement_type="refund",
        deleted_at__isnull=True,
    ).exclude(status="Cancelled")
    return [{"id": int(p.id), "code": str(p.payment_code or p.id)} for p in rows]


async def _build_refund_pull_capability(
    tenant_id: int,
    source: Receipt | Payment,
    kind: VoucherKind,
) -> Optional[Dict[str, Any]]:
    if str(source.settlement_type or "normal") == "refund":
        return None
    if str(source.status or "") != "Confirmed":
        cap_key = "pull_receipt_refund" if kind == "receipt" else "pull_payment_refund"
        reason = (
            "receipt_refund.pull_from_receipt.not_allowed"
            if kind == "receipt"
            else "payment_refund.pull_from_payment.not_allowed"
        )
        return {cap_key: {"allowed": False, "reason": reason}}

    from apps.kuaicaiwu.services.receipt_refund_service import ReceiptRefundService
    from apps.kuaicaiwu.services.payment_refund_service import PaymentRefundService

    source_id = int(source.id)
    if kind == "receipt":
        svc = ReceiptRefundService()
        reserved_map = await svc._sum_reserved_refund_by_source(tenant_id, [source_id])
        reserved = reserved_map.get(source_id, Decimal("0"))
        max_push = compute_refundable_balance(
            source.total_amount, source.refunded_amount, reserved
        )
        cap_key = "pull_receipt_refund"
        action_key = "receipt_refund.pull_from_receipt"
    else:
        svc = PaymentRefundService()
        reserved_map = await svc._sum_reserved_refund_by_source(tenant_id, [source_id])
        reserved = reserved_map.get(source_id, Decimal("0"))
        max_push = compute_refundable_balance(
            source.total_amount, source.refunded_amount, reserved
        )
        cap_key = "pull_payment_refund"
        action_key = "payment_refund.pull_from_payment"

    allowed = quantize_money(max_push) > 0
    reason = None if allowed else f"{action_key}.already_refunded"
    return {cap_key: {"allowed": allowed, "reason": reason}}


async def list_partner_statements_for_document(
    tenant_id: int,
    doc_family: str,
    doc_id: int,
    *,
    limit: int = 20,
) -> List[Dict[str, Any]]:
    target_key = (doc_family, int(doc_id))
    rows = (
        await PartnerStatement.filter(tenant_id=tenant_id, deleted_at__isnull=True)
        .order_by("-statement_period", "-id")
        .limit(500)
        .all()
    )
    result: List[Dict[str, Any]] = []
    for stmt in rows:
        details = stmt.transaction_details
        if not isinstance(details, dict):
            continue
        lines = details.get("lines") or []
        if not isinstance(lines, list):
            continue
        matched = False
        for ln in lines:
            if not isinstance(ln, dict):
                continue
            key = _line_doc_key(ln.get("doc_type"), ln.get("doc_id"))
            if key == target_key:
                matched = True
                break
        if matched:
            result.append(
                {
                    "id": int(stmt.id),
                    "statement_code": str(stmt.statement_code or stmt.id),
                    "statement_period": str(stmt.statement_period or ""),
                    "status": str(stmt.status or ""),
                }
            )
        if len(result) >= limit:
            break
    return result


async def enrich_voucher_detail(
    tenant_id: int,
    payload: Dict[str, Any],
    *,
    kind: VoucherKind,
) -> Dict[str, Any]:
    settlement_type = str(payload.get("settlement_type") or "normal")
    voucher_id = int(payload["id"])
    enriched = dict(payload)

    if settlement_type == "refund":
        source = await _get_source_voucher_ref(tenant_id, voucher_id, kind)
        if source:
            enriched["source_voucher_id"] = source["id"]
            enriched["source_voucher_code"] = source["code"]
    else:
        enriched["linked_refund_vouchers"] = await _list_refund_voucher_refs(
            tenant_id, voucher_id, kind
        )
        model = await (
            Receipt.get_or_none(tenant_id=tenant_id, id=voucher_id, deleted_at__isnull=True)
            if kind == "receipt"
            else Payment.get_or_none(tenant_id=tenant_id, id=voucher_id, deleted_at__isnull=True)
        )
        if model:
            cap = await _build_refund_pull_capability(tenant_id, model, kind)
            if cap:
                enriched["capabilities"] = cap

    enriched["linked_partner_statements"] = await list_partner_statements_for_document(
        tenant_id, kind, voucher_id
    )
    return enriched
