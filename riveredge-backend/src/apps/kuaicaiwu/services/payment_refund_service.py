"""
付款退款：从已确认付款单加载、确认冲回核销（支持多源一张退款单）。
"""

from __future__ import annotations

from decimal import Decimal
from typing import Any, Dict, List, Optional, Sequence

from tortoise.expressions import Q
from tortoise.transactions import in_transaction

from apps.common.audit_actor import apply_update_audit
from apps.common.base_service import AppBaseService
from apps.kuaicaiwu.models.payment import Payment
from apps.kuaicaiwu.services.finance_refund_utils import (
    allocate_refund_across_sources,
    compute_refund_execution_status,
    compute_refundable_balance,
    encode_refund_allocation_notes,
    parse_refund_allocation_notes,
    quantize_money,
)
from apps.kuaizhizao.models.document_relation import DocumentRelation
from infra.exceptions.exceptions import BusinessLogicError, NotFoundError, ValidationError


class PaymentRefundService(AppBaseService[Payment]):
    _SOURCE_ELIGIBLE_STATUSES = frozenset({"Confirmed"})

    async def _sum_reserved_refund_by_source(
        self,
        tenant_id: int,
        source_payment_ids: List[int],
    ) -> Dict[int, Decimal]:
        result: Dict[int, Decimal] = {pid: Decimal("0") for pid in source_payment_ids}
        if not source_payment_ids:
            return result

        relations = await DocumentRelation.filter(
            tenant_id=tenant_id,
            source_type="payment",
            source_id__in=source_payment_ids,
            target_type="payment",
            relation_mode="pull",
        ).all()
        if not relations:
            return result

        all_refund_ids = {int(rel.target_id) for rel in relations if rel.target_id}
        refund_map: Dict[int, Payment] = {}
        if all_refund_ids:
            rows = await Payment.filter(
                tenant_id=tenant_id,
                id__in=list(all_refund_ids),
                settlement_type="refund",
                deleted_at__isnull=True,
            ).exclude(status="Cancelled")
            refund_map = {int(p.id): p for p in rows}

        source_count_by_refund: Dict[int, int] = {}
        for rel in await DocumentRelation.filter(
            tenant_id=tenant_id,
            source_type="payment",
            target_type="payment",
            target_id__in=list(all_refund_ids),
            relation_mode="pull",
        ).all():
            if rel.target_id:
                tid = int(rel.target_id)
                source_count_by_refund[tid] = source_count_by_refund.get(tid, 0) + 1

        for rel in relations:
            if not rel.source_id or not rel.target_id:
                continue
            source_id = int(rel.source_id)
            if source_id not in result:
                continue
            refund = refund_map.get(int(rel.target_id))
            if not refund or refund.status != "Draft":
                continue
            alloc = parse_refund_allocation_notes(rel.notes)
            if alloc is None:
                if source_count_by_refund.get(int(rel.target_id), 0) <= 1:
                    alloc = quantize_money(refund.total_amount)
                else:
                    continue
            result[source_id] = quantize_money(result[source_id] + alloc)
        return result

    def _source_allowed(self, payment: Payment) -> bool:
        if str(payment.settlement_type or "normal") == "refund":
            return False
        if str(payment.status or "") not in self._SOURCE_ELIGIBLE_STATUSES:
            return False
        return quantize_money(payment.total_amount) > 0

    async def _build_preview_item(
        self,
        tenant_id: int,
        payment: Payment,
        *,
        reserved_refund: Optional[Decimal] = None,
    ) -> Dict[str, Any]:
        pid = int(payment.id)
        code = str(payment.payment_code or pid)
        total = quantize_money(payment.total_amount)
        refunded = quantize_money(payment.refunded_amount)
        if reserved_refund is None:
            reserved_map = await self._sum_reserved_refund_by_source(tenant_id, [pid])
            reserved_refund = reserved_map.get(pid, Decimal("0"))
        max_push = compute_refundable_balance(total, refunded, reserved_refund)
        return {
            "item_id": pid,
            "source_code": code,
            "supplier_name": str(payment.supplier_name or ""),
            "quantity": float(total),
            "pushed_quantity": float(refunded),
            "max_push_quantity": float(max_push),
        }

    def _normalize_source_ids(self, source_ids: Sequence[int]) -> List[int]:
        seen: set[int] = set()
        ordered: List[int] = []
        for raw in source_ids:
            sid = int(raw)
            if sid <= 0 or sid in seen:
                continue
            seen.add(sid)
            ordered.append(sid)
        if not ordered:
            raise ValidationError("请至少选择一张源付款单")
        return ordered

    async def preview_pull_from_payments(
        self,
        tenant_id: int,
        source_payment_ids: Sequence[int],
    ) -> Dict[str, Any]:
        source_ids = self._normalize_source_ids(source_payment_ids)
        payments = await Payment.filter(
            tenant_id=tenant_id,
            id__in=source_ids,
            deleted_at__isnull=True,
        ).all()
        payment_map = {int(p.id): p for p in payments}
        missing = [sid for sid in source_ids if sid not in payment_map]
        if missing:
            raise NotFoundError(f"付款单不存在: {missing[0]}")

        reserved_map = await self._sum_reserved_refund_by_source(tenant_id, source_ids)
        preview_items: List[Dict[str, Any]] = []
        blocking_reasons: List[str] = []
        supplier_id: Optional[int] = None
        supplier_name: Optional[str] = None

        for sid in source_ids:
            payment = payment_map[sid]
            if supplier_id is None:
                supplier_id = payment.supplier_id
                supplier_name = payment.supplier_name
            elif int(payment.supplier_id or 0) != int(supplier_id or 0):
                raise BusinessLogicError("多笔一起退款须为同一供应商")

            item = await self._build_preview_item(
                tenant_id,
                payment,
                reserved_refund=reserved_map.get(sid, Decimal("0")),
            )
            preview_items.append(item)
            if not self._source_allowed(payment):
                blocking_reasons.append("payment_refund.pull_from_payment.not_allowed")
            elif float(item["max_push_quantity"]) <= 0:
                blocking_reasons.append("payment_refund.pull_from_payment.already_refunded")

        max_push_total = quantize_money(
            sum((Decimal(str(i["max_push_quantity"])) for i in preview_items), Decimal("0"))
        )
        allowed = not blocking_reasons and max_push_total > 0
        codes = "、".join(str(i["source_code"]) for i in preview_items)
        reason = blocking_reasons[0] if blocking_reasons else (
            None if allowed else "payment_refund.pull_from_payment.already_refunded"
        )
        return {
            "target_type": "payment",
            "source_type": "payment",
            "source_id": source_ids[0],
            "source_ids": source_ids,
            "source_code": codes,
            "summary": (
                f"将从 {len(source_ids)} 张付款单创建付款退款（可退合计 ¥{float(max_push_total):,.2f}）"
                if allowed
                else f"所选付款单当前不可一起退款"
            ),
            "items": preview_items,
            "has_blocking_issues": not allowed,
            "blocking_reason": reason,
            "tip": "退款金额不可超过可退合计；确认后按源单分摊冲回应付核销，并记一笔银行流入。",
            "supplier_id": supplier_id,
            "supplier_name": supplier_name,
            "max_push_total": float(max_push_total),
        }

    async def preview_pull_from_payment(
        self,
        tenant_id: int,
        source_payment_id: int,
    ) -> Dict[str, Any]:
        return await self.preview_pull_from_payments(tenant_id, [source_payment_id])

    async def list_payment_pull_candidates(
        self,
        tenant_id: int,
        skip: int = 0,
        limit: int = 20,
        keyword: Optional[str] = None,
    ) -> Dict[str, Any]:
        query = Payment.filter(
            tenant_id=tenant_id,
            deleted_at__isnull=True,
            status="Confirmed",
        ).exclude(settlement_type="refund")
        kw = str(keyword or "").strip()
        if kw:
            query = query.filter(
                Q(payment_code__icontains=kw) | Q(supplier_name__icontains=kw)
            )
        candidates = await query.offset(0).limit(500).order_by("-payment_date", "-id")
        source_ids = [int(p.id) for p in candidates]
        reserved_map = await self._sum_reserved_refund_by_source(tenant_id, source_ids)

        rows: List[Dict[str, Any]] = []
        for payment in candidates:
            pid = int(payment.id)
            preview = await self._build_preview_item(
                tenant_id, payment, reserved_refund=reserved_map.get(pid, Decimal("0"))
            )
            max_push = float(preview["max_push_quantity"])
            allowed = self._source_allowed(payment) and max_push > 0
            reason = None
            if not self._source_allowed(payment):
                reason = "payment_refund.pull_from_payment.not_allowed"
            elif max_push <= 0:
                reason = "payment_refund.pull_from_payment.already_refunded"
            code = str(payment.payment_code or pid)
            name = str(payment.supplier_name or "").strip()
            label = f"{code} - {name}" if name else code
            rows.append(
                {
                    "id": pid,
                    "code": label,
                    "payment_code": code,
                    "supplier_id": payment.supplier_id,
                    "supplier_name": payment.supplier_name,
                    "source_status": payment.status,
                    "source_date": str(payment.payment_date or ""),
                    "amount": float(payment.total_amount or 0),
                    "refunded_amount": float(payment.refunded_amount or 0),
                    "remaining_amount": max_push,
                    "capabilities": {
                        "pull_payment_refund": {
                            "allowed": allowed,
                            "reason": reason,
                        }
                    },
                }
            )

        pullable = [r for r in rows if r["capabilities"]["pull_payment_refund"]["allowed"]]
        total = len(pullable)
        page = pullable[skip : skip + limit]
        return {"data": page, "total": total, "success": True}

    async def assert_pull_create_allowed(
        self,
        tenant_id: int,
        *,
        source_type: str,
        source_ids: Sequence[int],
        total_amount: Decimal,
    ) -> Dict[str, Any]:
        if source_type != "payment":
            raise BusinessLogicError(f"不支持的加载源单类型: {source_type}")
        preview = await self.preview_pull_from_payments(tenant_id, source_ids)
        if preview.get("has_blocking_issues"):
            reason = preview.get("blocking_reason") or "当前不可创建付款退款"
            raise BusinessLogicError(reason)
        items = preview.get("items") or []
        if not items:
            raise BusinessLogicError("无可退金额")
        max_push_total = Decimal(str(preview.get("max_push_total") or 0))
        amount = quantize_money(total_amount)
        if amount > max_push_total:
            raise BusinessLogicError(f"退款金额 {amount} 超过可退合计 {max_push_total}")

        caps = [
            (int(item["item_id"]), quantize_money(item["max_push_quantity"]))
            for item in items
        ]
        try:
            allocations = allocate_refund_across_sources(caps, amount)
        except ValueError as exc:
            raise BusinessLogicError(str(exc)) from exc

        code_by_id = {int(item["item_id"]): str(item["source_code"]) for item in items}
        preview["allocations"] = [
            {
                "source_id": sid,
                "source_code": code_by_id.get(sid, str(sid)),
                "amount": float(amt),
            }
            for sid, amt in allocations
        ]
        return preview

    async def create_pull_relations(
        self,
        tenant_id: int,
        *,
        allocations: Sequence[Dict[str, Any]],
        refund_payment_id: int,
        refund_payment_code: str,
        created_by: int,
    ) -> None:
        from apps.kuaizhizao.services.document_relation_new_service import DocumentRelationNewService
        from apps.kuaizhizao.schemas.document_relation import DocumentRelationCreate

        rel_svc = DocumentRelationNewService()
        for row in allocations:
            amount = quantize_money(row["amount"])
            await rel_svc.create_relation(
                tenant_id=tenant_id,
                relation_data=DocumentRelationCreate(
                    source_type="payment",
                    source_id=int(row["source_id"]),
                    source_code=str(row.get("source_code") or ""),
                    source_name=None,
                    target_type="payment",
                    target_id=refund_payment_id,
                    target_code=refund_payment_code,
                    target_name=None,
                    relation_type="source",
                    relation_mode="pull",
                    relation_desc="加载创建付款退款",
                    notes=encode_refund_allocation_notes(amount),
                ),
                created_by=created_by,
            )

    async def create_pull_relation(
        self,
        tenant_id: int,
        *,
        source_payment_id: int,
        source_code: str,
        refund_payment_id: int,
        refund_payment_code: str,
        created_by: int,
        allocated_amount: Optional[Decimal] = None,
    ) -> None:
        amount = allocated_amount
        if amount is None:
            refund = await Payment.get_or_none(
                tenant_id=tenant_id, id=refund_payment_id, deleted_at__isnull=True
            )
            amount = quantize_money(refund.total_amount if refund else 0)
        await self.create_pull_relations(
            tenant_id,
            allocations=[
                {
                    "source_id": source_payment_id,
                    "source_code": source_code,
                    "amount": amount,
                }
            ],
            refund_payment_id=refund_payment_id,
            refund_payment_code=refund_payment_code,
            created_by=created_by,
        )

    async def get_source_payment_allocations(
        self,
        tenant_id: int,
        refund_payment_id: int,
    ) -> List[Dict[str, Any]]:
        relations = await DocumentRelation.filter(
            tenant_id=tenant_id,
            source_type="payment",
            target_type="payment",
            target_id=refund_payment_id,
            relation_mode="pull",
        ).all()
        if not relations:
            return []

        refund = await Payment.get_or_none(
            tenant_id=tenant_id, id=refund_payment_id, deleted_at__isnull=True
        )
        refund_total = quantize_money(refund.total_amount if refund else 0)
        rows: List[Dict[str, Any]] = []
        for rel in relations:
            if not rel.source_id:
                continue
            alloc = parse_refund_allocation_notes(rel.notes)
            rows.append(
                {
                    "source_id": int(rel.source_id),
                    "source_code": str(rel.source_code or rel.source_id),
                    "amount": alloc,
                }
            )

        if len(rows) == 1 and rows[0]["amount"] is None:
            rows[0]["amount"] = refund_total
        elif any(r["amount"] is None for r in rows):
            raise ValidationError("多源付款退款缺少分摊金额，无法确认")

        alloc_sum = quantize_money(sum((r["amount"] for r in rows), Decimal("0")))
        if alloc_sum != refund_total:
            raise ValidationError(
                f"源单分摊合计 {alloc_sum} 与退款金额 {refund_total} 不一致"
            )
        return rows

    async def get_source_payment_id(
        self,
        tenant_id: int,
        refund_payment_id: int,
    ) -> Optional[int]:
        rows = await self.get_source_payment_allocations(tenant_id, refund_payment_id)
        return int(rows[0]["source_id"]) if rows else None

    async def confirm_refund(
        self,
        tenant_id: int,
        refund_payment_id: int,
        operator_id: int,
        *,
        current_user: Any,
    ) -> Payment:
        from apps.kuaicaiwu.services.finance_service import AccountSettlementService

        refund = await Payment.get_or_none(
            tenant_id=tenant_id, id=refund_payment_id, deleted_at__isnull=True
        )
        if not refund:
            raise NotFoundError("付款退款单不存在")
        if str(refund.settlement_type or "") != "refund":
            raise ValidationError("非退款类型付款单")
        if refund.status != "Draft":
            raise ValidationError("只有草稿状态的付款退款可以确认")

        allocations = await self.get_source_payment_allocations(tenant_id, refund_payment_id)
        if not allocations:
            raise ValidationError("未关联源付款单，无法确认退款")

        settlement_service = AccountSettlementService()
        async with in_transaction():
            for row in allocations:
                source_id = int(row["source_id"])
                chunk = quantize_money(row["amount"])
                source = await Payment.get_or_none(
                    tenant_id=tenant_id, id=source_id, deleted_at__isnull=True
                )
                if not source:
                    raise NotFoundError(f"源付款单不存在: {source_id}")

                max_refundable = compute_refundable_balance(
                    source.total_amount,
                    source.refunded_amount,
                    Decimal("0"),
                )
                if chunk > max_refundable:
                    raise ValidationError(
                        f"源付款单 {source.payment_code or source_id} 退款金额超过可退余额"
                    )

                await settlement_service.reverse_payable_settlements_for_refund(
                    tenant_id,
                    source_payment_id=source_id,
                    refund_payment_id=refund_payment_id,
                    refund_amount=chunk,
                    operator_id=operator_id,
                )

                new_refunded = quantize_money(source.refunded_amount) + chunk
                new_status = compute_refund_execution_status(source.total_amount, new_refunded)
                await Payment.filter(tenant_id=tenant_id, id=source_id).update(
                    refunded_amount=new_refunded,
                    refund_execution_status=new_status,
                    updated_by=operator_id,
                )

            refund_amount = quantize_money(refund.total_amount)
            confirm_payload: dict = {
                "status": "Confirmed",
                "settled_amount": refund_amount,
                "unsettled_amount": Decimal("0"),
            }
            apply_update_audit(confirm_payload, current_user)
            await Payment.filter(tenant_id=tenant_id, id=refund_payment_id).update(
                **confirm_payload
            )

        return await Payment.get_or_none(tenant_id=tenant_id, id=refund_payment_id)
