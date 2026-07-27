"""
付款单加载门控：应付单候选列表、预览、已付款/待占用金额汇总。
"""

from __future__ import annotations

from decimal import Decimal
from typing import Any, Dict, List, Optional

from tortoise.queryset import Q

from apps.common.base_service import AppBaseService
from apps.kuaicaiwu.models.payment import Payment
from apps.kuaicaiwu.models.payable import Payable
from apps.kuaizhizao.models.document_relation import DocumentRelation
from infra.exceptions.exceptions import BusinessLogicError, NotFoundError


class PaymentPullService(AppBaseService[Payment]):
    """付款单加载门控服务"""

    _EXCLUDED_PAYMENT_STATUSES = frozenset({"Cancelled"})

    _PAYABLE_ELIGIBLE_REVIEW = frozenset({"已审核"})

    def _derive_pull_capability(
        self,
        *,
        source_allowed: bool,
        preview_items: List[Dict[str, Any]],
        not_allowed_reason: str,
        no_lines_reason: str,
        already_pulled_reason: str,
    ) -> tuple[bool, Optional[str]]:
        if not source_allowed:
            return False, not_allowed_reason
        if not preview_items:
            return False, no_lines_reason
        pushable = any(float(row.get("max_push_quantity") or 0) > 0 for row in preview_items)
        if not pushable:
            return False, already_pulled_reason
        return True, None

    async def _sum_reserved_unsettled_by_payable(
        self,
        tenant_id: int,
        payable_ids: List[int],
        code_by_id: Dict[int, str],
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
            ).exclude(status__in=list(self._EXCLUDED_PAYMENT_STATUSES))
            payment_map = {int(p.id): p for p in rows}

        for payable_id, payment_ids in payment_by_payable.items():
            reserved = Decimal("0")
            for payment_id in payment_ids:
                payment = payment_map.get(payment_id)
                if payment:
                    reserved += Decimal(str(payment.unsettled_amount or 0))
            result[payable_id] = reserved

        codes = [c for c in code_by_id.values() if c]
        if codes:
            code_to_id = {str(v).strip(): k for k, v in code_by_id.items() if v}
            orphan_payments = await Payment.filter(
                tenant_id=tenant_id,
                deleted_at__isnull=True,
            ).exclude(status__in=list(self._EXCLUDED_PAYMENT_STATUSES))
            linked_ids = set(payment_map.keys())
            for payment in orphan_payments:
                if int(payment.id) in linked_ids:
                    continue
                note = str(payment.notes or "")
                for code, pid in code_to_id.items():
                    if code and code in note:
                        result[pid] = result.get(pid, Decimal("0")) + Decimal(
                            str(payment.unsettled_amount or 0)
                        )
                        break
        return result

    def _build_preview_item(
        self,
        *,
        payable: Any,
        reserved_unsettled: Decimal,
    ) -> Dict[str, Any]:
        pid = int(payable.id)
        code = str(payable.payable_code or pid)
        total = Decimal(str(payable.total_amount or 0))
        paid = Decimal(str(payable.paid_amount or 0))
        remaining = Decimal(str(payable.remaining_amount or 0))
        max_push = max(Decimal("0"), remaining - reserved_unsettled)
        return {
            "item_id": pid,
            "source_code": code,
            "supplier_name": str(getattr(payable, "supplier_name", "") or ""),
            "quantity": float(total),
            "pushed_quantity": float(paid),
            "max_push_quantity": float(max_push),
        }

    async def _build_preview_items_for_payable(
        self,
        tenant_id: int,
        payable: Any,
        *,
        reserved_unsettled: Optional[Decimal] = None,
    ) -> List[Dict[str, Any]]:
        total = Decimal(str(payable.total_amount or 0))
        if total <= 0:
            return []
        pid = int(payable.id)
        if reserved_unsettled is None:
            code = str(payable.payable_code or pid)
            reserved_map = await self._sum_reserved_unsettled_by_payable(
                tenant_id, [pid], {pid: code}
            )
            reserved_unsettled = reserved_map.get(pid, Decimal("0"))
        return [
            self._build_preview_item(
                payable=payable,
                reserved_unsettled=reserved_unsettled,
            )
        ]

    def _payable_source_allowed(self, payable: Any) -> bool:
        status = str(getattr(payable, "status", "") or "").strip()
        review = str(getattr(payable, "review_status", "") or "").strip()
        remaining = Decimal(str(payable.remaining_amount or 0))
        total = Decimal(str(payable.total_amount or 0))
        if status == "已结清" or remaining <= 0 or total <= 0:
            return False
        return review in self._PAYABLE_ELIGIBLE_REVIEW

    async def preview_pull_from_payable(
        self,
        tenant_id: int,
        payable_id: int,
    ) -> Dict[str, Any]:
        payable = await Payable.get_or_none(
            tenant_id=tenant_id, id=payable_id, deleted_at__isnull=True
        )
        if not payable:
            raise NotFoundError(f"应付单不存在: {payable_id}")

        source_allowed = self._payable_source_allowed(payable)
        preview_items = await self._build_preview_items_for_payable(tenant_id, payable)
        allowed, reason = self._derive_pull_capability(
            source_allowed=source_allowed,
            preview_items=preview_items,
            not_allowed_reason="payment.pull_from_payable.not_allowed",
            no_lines_reason="payment.pull_from_payable.no_lines",
            already_pulled_reason="payment.pull_from_payable.already_pulled",
        )
        code = str(payable.payable_code or payable_id)
        pushable = float(preview_items[0]["max_push_quantity"]) if preview_items else 0.0
        return {
            "target_type": "payment",
            "source_type": "payable",
            "source_id": payable_id,
            "source_code": code,
            "summary": (
                f"将从应付单 {code} 创建付款单（可付款 ¥{pushable:,.2f}）"
                if preview_items and allowed
                else f"应付单 {code} 当前不可加载付款单"
            ),
            "items": preview_items,
            "has_blocking_issues": not allowed,
            "blocking_reason": reason,
            "tip": "付款金额不可超过可付款金额；作废未核销付款单后，可付款金额自动回退。",
            "supplier_id": payable.supplier_id,
            "supplier_name": payable.supplier_name,
            "payable_id": payable.id,
            "payable_code": code,
        }

    async def list_payable_pull_candidates(
        self,
        tenant_id: int,
        skip: int = 0,
        limit: int = 20,
        keyword: Optional[str] = None,
    ) -> Dict[str, Any]:
        query = Payable.filter(
            tenant_id=tenant_id,
            deleted_at__isnull=True,
            remaining_amount__gt=0,
        ).exclude(status="已结清")
        kw = str(keyword or "").strip()
        if kw:
            query = query.filter(
                Q(payable_code__icontains=kw) | Q(supplier_name__icontains=kw)
            )
        total = await query.count()
        payables = await query.offset(skip).limit(limit).order_by("-created_at")
        payable_ids = [int(p.id) for p in payables]
        if not payable_ids:
            return {"data": [], "total": total, "success": True}

        code_by_id = {int(p.id): str(p.payable_code or p.id) for p in payables}
        reserved_map = await self._sum_reserved_unsettled_by_payable(
            tenant_id, payable_ids, code_by_id
        )

        rows: List[Dict[str, Any]] = []
        for payable in payables:
            pid = int(payable.id)
            preview_items = await self._build_preview_items_for_payable(
                tenant_id,
                payable,
                reserved_unsettled=reserved_map.get(pid, Decimal("0")),
            )
            allowed, reason = self._derive_pull_capability(
                source_allowed=self._payable_source_allowed(payable),
                preview_items=preview_items,
                not_allowed_reason="payment.pull_from_payable.not_allowed",
                no_lines_reason="payment.pull_from_payable.no_lines",
                already_pulled_reason="payment.pull_from_payable.already_pulled",
            )
            code = str(payable.payable_code or pid)
            name = str(getattr(payable, "supplier_name", "") or "").strip()
            label = f"{code} - {name}" if name else code
            rows.append(
                {
                    "id": pid,
                    "code": label,
                    "payable_code": code,
                    "supplier_name": payable.supplier_name,
                    "source_status": payable.status,
                    "review_status": payable.review_status,
                    "source_date": str(getattr(payable, "due_date", "") or ""),
                    "amount": float(payable.total_amount or 0),
                    "remaining_amount": float(payable.remaining_amount or 0),
                    "capabilities": {
                        "pull_payment": {
                            "allowed": allowed,
                            "reason": reason,
                        }
                    },
                }
            )
        return {"data": rows, "total": total, "success": True}

    async def assert_pull_create_allowed(
        self,
        tenant_id: int,
        *,
        source_type: str,
        source_id: int,
        total_amount: Decimal,
    ) -> Dict[str, Any]:
        if source_type != "payable":
            raise BusinessLogicError(f"不支持的加载源单类型: {source_type}")
        preview = await self.preview_pull_from_payable(tenant_id, source_id)
        if preview.get("has_blocking_issues"):
            reason = preview.get("blocking_reason") or "当前不可加载付款单"
            raise BusinessLogicError(reason)
        items = preview.get("items") or []
        if not items:
            raise BusinessLogicError("无可付款金额")
        max_push = Decimal(str(items[0].get("max_push_quantity") or 0))
        if total_amount > max_push:
            raise BusinessLogicError(f"付款金额 {total_amount} 超过可付款金额 {max_push}")
        return preview

    async def create_pull_relation(
        self,
        tenant_id: int,
        *,
        source_type: str,
        source_id: int,
        source_code: str,
        payment_id: int,
        payment_code: str,
        created_by: int,
    ) -> None:
        from apps.kuaizhizao.services.document_relation_new_service import DocumentRelationNewService
        from apps.kuaizhizao.schemas.document_relation import DocumentRelationCreate

        rel_svc = DocumentRelationNewService()
        await rel_svc.create_relation(
            tenant_id=tenant_id,
            relation_data=DocumentRelationCreate(
                source_type=source_type,
                source_id=source_id,
                source_code=source_code,
                source_name=None,
                target_type="payment",
                target_id=payment_id,
                target_code=payment_code,
                target_name=None,
                relation_type="source",
                relation_mode="pull",
                relation_desc="加载创建付款单",
            ),
            created_by=created_by,
        )
