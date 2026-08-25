"""
付款退款：从已确认付款单加载、确认冲回核销。
"""

from __future__ import annotations

from decimal import Decimal
from typing import Any, Dict, List, Optional

from tortoise.expressions import Q
from tortoise.transactions import in_transaction

from apps.common.audit_actor import apply_update_audit
from apps.common.base_service import AppBaseService
from apps.kuaicaiwu.models.payment import Payment
from apps.kuaicaiwu.services.finance_refund_utils import (
    compute_refund_execution_status,
    compute_refundable_balance,
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
        refund_by_source: Dict[int, List[int]] = {}
        for rel in relations:
            if rel.source_id and rel.target_id:
                refund_by_source.setdefault(int(rel.source_id), []).append(int(rel.target_id))

        all_refund_ids = {pid for ids in refund_by_source.values() for pid in ids}
        refund_map: Dict[int, Payment] = {}
        if all_refund_ids:
            rows = await Payment.filter(
                tenant_id=tenant_id,
                id__in=list(all_refund_ids),
                settlement_type="refund",
                deleted_at__isnull=True,
            ).exclude(status="Cancelled")
            refund_map = {int(p.id): p for p in rows}

        for source_id, refund_ids in refund_by_source.items():
            reserved = Decimal("0")
            for refund_id in refund_ids:
                refund = refund_map.get(refund_id)
                if refund and refund.status == "Draft":
                    reserved += quantize_money(refund.total_amount)
            result[source_id] = reserved
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

    async def preview_pull_from_payment(
        self,
        tenant_id: int,
        source_payment_id: int,
    ) -> Dict[str, Any]:
        payment = await Payment.get_or_none(
            tenant_id=tenant_id, id=source_payment_id, deleted_at__isnull=True
        )
        if not payment:
            raise NotFoundError(f"付款单不存在: {source_payment_id}")

        source_allowed = self._source_allowed(payment)
        preview_items = [await self._build_preview_item(tenant_id, payment)]
        max_push = float(preview_items[0]["max_push_quantity"])
        allowed = source_allowed and max_push > 0
        reason = None
        if not source_allowed:
            reason = "payment_refund.pull_from_payment.not_allowed"
        elif max_push <= 0:
            reason = "payment_refund.pull_from_payment.already_refunded"

        code = str(payment.payment_code or source_payment_id)
        return {
            "target_type": "payment",
            "source_type": "payment",
            "source_id": source_payment_id,
            "source_code": code,
            "summary": (
                f"将从付款单 {code} 创建付款退款（可退 ¥{max_push:,.2f}）"
                if allowed
                else f"付款单 {code} 当前不可退款"
            ),
            "items": preview_items,
            "has_blocking_issues": not allowed,
            "blocking_reason": reason,
            "tip": "退款金额不可超过可退余额；确认后将冲回应付核销并记银行流入。",
            "supplier_id": payment.supplier_id,
            "supplier_name": payment.supplier_name,
        }

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
        source_id: int,
        total_amount: Decimal,
    ) -> Dict[str, Any]:
        if source_type != "payment":
            raise BusinessLogicError(f"不支持的加载源单类型: {source_type}")
        preview = await self.preview_pull_from_payment(tenant_id, source_id)
        if preview.get("has_blocking_issues"):
            reason = preview.get("blocking_reason") or "当前不可创建付款退款"
            raise BusinessLogicError(reason)
        items = preview.get("items") or []
        if not items:
            raise BusinessLogicError("无可退金额")
        max_push = Decimal(str(items[0].get("max_push_quantity") or 0))
        if total_amount > max_push:
            raise BusinessLogicError(f"退款金额 {total_amount} 超过可退金额 {max_push}")
        return preview

    async def create_pull_relation(
        self,
        tenant_id: int,
        *,
        source_payment_id: int,
        source_code: str,
        refund_payment_id: int,
        refund_payment_code: str,
        created_by: int,
    ) -> None:
        from apps.kuaizhizao.services.document_relation_new_service import DocumentRelationNewService
        from apps.kuaizhizao.schemas.document_relation import DocumentRelationCreate

        rel_svc = DocumentRelationNewService()
        await rel_svc.create_relation(
            tenant_id=tenant_id,
            relation_data=DocumentRelationCreate(
                source_type="payment",
                source_id=source_payment_id,
                source_code=source_code,
                source_name=None,
                target_type="payment",
                target_id=refund_payment_id,
                target_code=refund_payment_code,
                target_name=None,
                relation_type="source",
                relation_mode="pull",
                relation_desc="加载创建付款退款",
            ),
            created_by=created_by,
        )

    async def get_source_payment_id(
        self,
        tenant_id: int,
        refund_payment_id: int,
    ) -> Optional[int]:
        rel = await DocumentRelation.filter(
            tenant_id=tenant_id,
            source_type="payment",
            target_type="payment",
            target_id=refund_payment_id,
            relation_mode="pull",
        ).first()
        return int(rel.source_id) if rel and rel.source_id else None

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

        source_id = await self.get_source_payment_id(tenant_id, refund_payment_id)
        if not source_id:
            raise ValidationError("未关联源付款单，无法确认退款")

        source = await Payment.get_or_none(tenant_id=tenant_id, id=source_id, deleted_at__isnull=True)
        if not source:
            raise NotFoundError("源付款单不存在")

        refund_amount = quantize_money(refund.total_amount)
        max_refundable = compute_refundable_balance(
            source.total_amount,
            source.refunded_amount,
            Decimal("0"),
        )
        if refund_amount > max_refundable:
            raise ValidationError("退款金额超过源付款单可退余额")

        settlement_service = AccountSettlementService()
        async with in_transaction():
            await settlement_service.reverse_payable_settlements_for_refund(
                tenant_id,
                source_payment_id=source_id,
                refund_payment_id=refund_payment_id,
                refund_amount=refund_amount,
                operator_id=operator_id,
            )

            new_refunded = quantize_money(source.refunded_amount) + refund_amount
            new_status = compute_refund_execution_status(source.total_amount, new_refunded)
            await Payment.filter(tenant_id=tenant_id, id=source_id).update(
                refunded_amount=new_refunded,
                refund_execution_status=new_status,
                updated_by=operator_id,
            )

            confirm_payload: dict = {
                "status": "Confirmed",
                "settled_amount": refund_amount,
                "unsettled_amount": Decimal("0"),
            }
            apply_update_audit(confirm_payload, current_user)
            await Payment.filter(tenant_id=tenant_id, id=refund_payment_id).update(**confirm_payload)

        return await Payment.get_or_none(tenant_id=tenant_id, id=refund_payment_id)
