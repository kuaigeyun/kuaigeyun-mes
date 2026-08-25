"""
收款退款：从已确认收款单加载、确认冲回核销。
"""

from __future__ import annotations

from decimal import Decimal
from typing import Any, Dict, List, Optional

from tortoise.expressions import Q
from tortoise.transactions import in_transaction

from apps.common.audit_actor import apply_update_audit
from apps.common.base_service import AppBaseService
from apps.kuaicaiwu.models.receipt import Receipt
from apps.kuaicaiwu.services.finance_refund_utils import (
    compute_refund_execution_status,
    compute_refundable_balance,
    quantize_money,
)
from apps.kuaizhizao.models.document_relation import DocumentRelation
from infra.exceptions.exceptions import BusinessLogicError, NotFoundError, ValidationError


class ReceiptRefundService(AppBaseService[Receipt]):
    _SOURCE_ELIGIBLE_STATUSES = frozenset({"Confirmed"})

    async def _sum_reserved_refund_by_source(
        self,
        tenant_id: int,
        source_receipt_ids: List[int],
    ) -> Dict[int, Decimal]:
        result: Dict[int, Decimal] = {rid: Decimal("0") for rid in source_receipt_ids}
        if not source_receipt_ids:
            return result

        relations = await DocumentRelation.filter(
            tenant_id=tenant_id,
            source_type="receipt",
            source_id__in=source_receipt_ids,
            target_type="receipt",
            relation_mode="pull",
        ).all()
        refund_by_source: Dict[int, List[int]] = {}
        for rel in relations:
            if rel.source_id and rel.target_id:
                refund_by_source.setdefault(int(rel.source_id), []).append(int(rel.target_id))

        all_refund_ids = {rid for ids in refund_by_source.values() for rid in ids}
        refund_map: Dict[int, Receipt] = {}
        if all_refund_ids:
            rows = await Receipt.filter(
                tenant_id=tenant_id,
                id__in=list(all_refund_ids),
                settlement_type="refund",
                deleted_at__isnull=True,
            ).exclude(status="Cancelled")
            refund_map = {int(r.id): r for r in rows}

        for source_id, refund_ids in refund_by_source.items():
            reserved = Decimal("0")
            for refund_id in refund_ids:
                refund = refund_map.get(refund_id)
                if refund and refund.status == "Draft":
                    reserved += quantize_money(refund.total_amount)
            result[source_id] = reserved
        return result

    def _source_allowed(self, receipt: Receipt) -> bool:
        if str(receipt.settlement_type or "normal") == "refund":
            return False
        if str(receipt.status or "") not in self._SOURCE_ELIGIBLE_STATUSES:
            return False
        return quantize_money(receipt.total_amount) > 0

    async def _build_preview_item(
        self,
        tenant_id: int,
        receipt: Receipt,
        *,
        reserved_refund: Optional[Decimal] = None,
    ) -> Dict[str, Any]:
        rid = int(receipt.id)
        code = str(receipt.receipt_code or rid)
        total = quantize_money(receipt.total_amount)
        refunded = quantize_money(receipt.refunded_amount)
        if reserved_refund is None:
            reserved_map = await self._sum_reserved_refund_by_source(tenant_id, [rid])
            reserved_refund = reserved_map.get(rid, Decimal("0"))
        max_push = compute_refundable_balance(total, refunded, reserved_refund)
        return {
            "item_id": rid,
            "source_code": code,
            "customer_name": str(receipt.customer_name or ""),
            "quantity": float(total),
            "pushed_quantity": float(refunded),
            "max_push_quantity": float(max_push),
        }

    async def preview_pull_from_receipt(
        self,
        tenant_id: int,
        source_receipt_id: int,
    ) -> Dict[str, Any]:
        receipt = await Receipt.get_or_none(
            tenant_id=tenant_id, id=source_receipt_id, deleted_at__isnull=True
        )
        if not receipt:
            raise NotFoundError(f"收款单不存在: {source_receipt_id}")

        source_allowed = self._source_allowed(receipt)
        preview_items = [await self._build_preview_item(tenant_id, receipt)]
        max_push = float(preview_items[0]["max_push_quantity"])
        allowed = source_allowed and max_push > 0
        reason = None
        if not source_allowed:
            reason = "receipt_refund.pull_from_receipt.not_allowed"
        elif max_push <= 0:
            reason = "receipt_refund.pull_from_receipt.already_refunded"

        code = str(receipt.receipt_code or source_receipt_id)
        return {
            "target_type": "receipt",
            "source_type": "receipt",
            "source_id": source_receipt_id,
            "source_code": code,
            "summary": (
                f"将从收款单 {code} 创建收款退款（可退 ¥{max_push:,.2f}）"
                if allowed
                else f"收款单 {code} 当前不可退款"
            ),
            "items": preview_items,
            "has_blocking_issues": not allowed,
            "blocking_reason": reason,
            "tip": "退款金额不可超过可退余额；确认后将冲回应收核销并记银行流出。",
            "customer_id": receipt.customer_id,
            "customer_name": receipt.customer_name,
        }

    async def list_receipt_pull_candidates(
        self,
        tenant_id: int,
        skip: int = 0,
        limit: int = 20,
        keyword: Optional[str] = None,
    ) -> Dict[str, Any]:
        query = Receipt.filter(
            tenant_id=tenant_id,
            deleted_at__isnull=True,
            status="Confirmed",
        ).exclude(settlement_type="refund")
        kw = str(keyword or "").strip()
        if kw:
            query = query.filter(
                Q(receipt_code__icontains=kw) | Q(customer_name__icontains=kw)
            )
        candidates = await query.offset(0).limit(500).order_by("-receipt_date", "-id")
        source_ids = [int(r.id) for r in candidates]
        reserved_map = await self._sum_reserved_refund_by_source(tenant_id, source_ids)

        rows: List[Dict[str, Any]] = []
        for receipt in candidates:
            rid = int(receipt.id)
            preview = await self._build_preview_item(
                tenant_id, receipt, reserved_refund=reserved_map.get(rid, Decimal("0"))
            )
            max_push = float(preview["max_push_quantity"])
            allowed = self._source_allowed(receipt) and max_push > 0
            reason = None
            if not self._source_allowed(receipt):
                reason = "receipt_refund.pull_from_receipt.not_allowed"
            elif max_push <= 0:
                reason = "receipt_refund.pull_from_receipt.already_refunded"
            code = str(receipt.receipt_code or rid)
            name = str(receipt.customer_name or "").strip()
            label = f"{code} - {name}" if name else code
            rows.append(
                {
                    "id": rid,
                    "code": label,
                    "receipt_code": code,
                    "customer_name": receipt.customer_name,
                    "source_status": receipt.status,
                    "source_date": str(receipt.receipt_date or ""),
                    "amount": float(receipt.total_amount or 0),
                    "refunded_amount": float(receipt.refunded_amount or 0),
                    "remaining_amount": max_push,
                    "capabilities": {
                        "pull_receipt_refund": {
                            "allowed": allowed,
                            "reason": reason,
                        }
                    },
                }
            )

        pullable = [r for r in rows if r["capabilities"]["pull_receipt_refund"]["allowed"]]
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
        if source_type != "receipt":
            raise BusinessLogicError(f"不支持的加载源单类型: {source_type}")
        preview = await self.preview_pull_from_receipt(tenant_id, source_id)
        if preview.get("has_blocking_issues"):
            reason = preview.get("blocking_reason") or "当前不可创建收款退款"
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
        source_receipt_id: int,
        source_code: str,
        refund_receipt_id: int,
        refund_receipt_code: str,
        created_by: int,
    ) -> None:
        from apps.kuaizhizao.services.document_relation_new_service import DocumentRelationNewService
        from apps.kuaizhizao.schemas.document_relation import DocumentRelationCreate

        rel_svc = DocumentRelationNewService()
        await rel_svc.create_relation(
            tenant_id=tenant_id,
            relation_data=DocumentRelationCreate(
                source_type="receipt",
                source_id=source_receipt_id,
                source_code=source_code,
                source_name=None,
                target_type="receipt",
                target_id=refund_receipt_id,
                target_code=refund_receipt_code,
                target_name=None,
                relation_type="source",
                relation_mode="pull",
                relation_desc="加载创建收款退款",
            ),
            created_by=created_by,
        )

    async def get_source_receipt_id(
        self,
        tenant_id: int,
        refund_receipt_id: int,
    ) -> Optional[int]:
        rel = await DocumentRelation.filter(
            tenant_id=tenant_id,
            source_type="receipt",
            target_type="receipt",
            target_id=refund_receipt_id,
            relation_mode="pull",
        ).first()
        return int(rel.source_id) if rel and rel.source_id else None

    async def confirm_refund(
        self,
        tenant_id: int,
        refund_receipt_id: int,
        operator_id: int,
        *,
        current_user: Any,
    ) -> Receipt:
        from apps.kuaicaiwu.services.finance_service import AccountSettlementService

        refund = await Receipt.get_or_none(
            tenant_id=tenant_id, id=refund_receipt_id, deleted_at__isnull=True
        )
        if not refund:
            raise NotFoundError("收款退款单不存在")
        if str(refund.settlement_type or "") != "refund":
            raise ValidationError("非退款类型收款单")
        if refund.status != "Draft":
            raise ValidationError("只有草稿状态的收款退款可以确认")

        source_id = await self.get_source_receipt_id(tenant_id, refund_receipt_id)
        if not source_id:
            raise ValidationError("未关联源收款单，无法确认退款")

        source = await Receipt.get_or_none(tenant_id=tenant_id, id=source_id, deleted_at__isnull=True)
        if not source:
            raise NotFoundError("源收款单不存在")

        refund_amount = quantize_money(refund.total_amount)
        max_refundable = compute_refundable_balance(
            source.total_amount,
            source.refunded_amount,
            Decimal("0"),
        )
        if refund_amount > max_refundable:
            raise ValidationError("退款金额超过源收款单可退余额")

        settlement_service = AccountSettlementService()
        async with in_transaction():
            await settlement_service.reverse_receivable_settlements_for_refund(
                tenant_id,
                source_receipt_id=source_id,
                refund_receipt_id=refund_receipt_id,
                refund_amount=refund_amount,
                operator_id=operator_id,
            )

            new_refunded = quantize_money(source.refunded_amount) + refund_amount
            new_status = compute_refund_execution_status(source.total_amount, new_refunded)
            await Receipt.filter(tenant_id=tenant_id, id=source_id).update(
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
            await Receipt.filter(tenant_id=tenant_id, id=refund_receipt_id).update(**confirm_payload)

        return await Receipt.get_or_none(tenant_id=tenant_id, id=refund_receipt_id)
