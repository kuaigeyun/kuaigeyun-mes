"""
收款单上拉门控：应收单候选列表、预览、已收款/待占用金额汇总。
"""

from __future__ import annotations

from decimal import Decimal
from typing import Any, Dict, List, Optional

from tortoise.queryset import Q

from apps.common.base_service import AppBaseService
from apps.kuaicaiwu.models.receipt import Receipt
from apps.kuaicaiwu.models.receivable import Receivable
from apps.kuaizhizao.models.document_relation import DocumentRelation
from infra.exceptions.exceptions import BusinessLogicError, NotFoundError


class ReceiptPullService(AppBaseService[Receipt]):
    """收款单上拉门控服务"""

    _EXCLUDED_RECEIPT_STATUSES = frozenset({"Cancelled"})

    _RECEIVABLE_ELIGIBLE_REVIEW = frozenset({"已审核"})

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

    async def _sum_reserved_unsettled_by_receivable(
        self,
        tenant_id: int,
        receivable_ids: List[int],
        code_by_id: Dict[int, str],
    ) -> Dict[int, Decimal]:
        result: Dict[int, Decimal] = {rid: Decimal("0") for rid in receivable_ids}
        if not receivable_ids:
            return result

        relations = await DocumentRelation.filter(
            tenant_id=tenant_id,
            source_type="receivable",
            source_id__in=receivable_ids,
            target_type="receipt",
        ).all()
        receipt_by_receivable: Dict[int, List[int]] = {}
        for rel in relations:
            if rel.source_id and rel.target_id:
                receipt_by_receivable.setdefault(int(rel.source_id), []).append(int(rel.target_id))

        all_receipt_ids = {rid for ids in receipt_by_receivable.values() for rid in ids}
        receipt_map: Dict[int, Receipt] = {}
        if all_receipt_ids:
            rows = await Receipt.filter(
                tenant_id=tenant_id,
                id__in=list(all_receipt_ids),
                deleted_at__isnull=True,
            ).exclude(status__in=list(self._EXCLUDED_RECEIPT_STATUSES))
            receipt_map = {int(r.id): r for r in rows}

        for receivable_id, receipt_ids in receipt_by_receivable.items():
            reserved = Decimal("0")
            for receipt_id in receipt_ids:
                receipt = receipt_map.get(receipt_id)
                if receipt:
                    reserved += Decimal(str(receipt.unsettled_amount or 0))
            result[receivable_id] = reserved

        codes = [c for c in code_by_id.values() if c]
        if codes:
            code_to_id = {str(v).strip(): k for k, v in code_by_id.items() if v}
            orphan_receipts = await Receipt.filter(
                tenant_id=tenant_id,
                deleted_at__isnull=True,
            ).exclude(status__in=list(self._EXCLUDED_RECEIPT_STATUSES))
            linked_ids = set(receipt_map.keys())
            for receipt in orphan_receipts:
                if int(receipt.id) in linked_ids:
                    continue
                note = str(receipt.notes or "")
                for code, rid in code_to_id.items():
                    if code and code in note:
                        result[rid] = result.get(rid, Decimal("0")) + Decimal(
                            str(receipt.unsettled_amount or 0)
                        )
                        break
        return result

    def _build_preview_item(
        self,
        *,
        receivable: Any,
        reserved_unsettled: Decimal,
    ) -> Dict[str, Any]:
        rid = int(receivable.id)
        code = str(receivable.receivable_code or rid)
        total = Decimal(str(receivable.total_amount or 0))
        received = Decimal(str(receivable.received_amount or 0))
        remaining = Decimal(str(receivable.remaining_amount or 0))
        max_push = max(Decimal("0"), remaining - reserved_unsettled)
        return {
            "item_id": rid,
            "source_code": code,
            "customer_name": str(getattr(receivable, "customer_name", "") or ""),
            "quantity": float(total),
            "pushed_quantity": float(received),
            "max_push_quantity": float(max_push),
        }

    async def _build_preview_items_for_receivable(
        self,
        tenant_id: int,
        receivable: Any,
        *,
        reserved_unsettled: Optional[Decimal] = None,
    ) -> List[Dict[str, Any]]:
        total = Decimal(str(receivable.total_amount or 0))
        if total <= 0:
            return []
        rid = int(receivable.id)
        if reserved_unsettled is None:
            code = str(receivable.receivable_code or rid)
            reserved_map = await self._sum_reserved_unsettled_by_receivable(
                tenant_id, [rid], {rid: code}
            )
            reserved_unsettled = reserved_map.get(rid, Decimal("0"))
        return [
            self._build_preview_item(
                receivable=receivable,
                reserved_unsettled=reserved_unsettled,
            )
        ]

    def _receivable_source_allowed(self, receivable: Any) -> bool:
        status = str(getattr(receivable, "status", "") or "").strip()
        review = str(getattr(receivable, "review_status", "") or "").strip()
        remaining = Decimal(str(receivable.remaining_amount or 0))
        total = Decimal(str(receivable.total_amount or 0))
        if status == "已结清" or remaining <= 0 or total <= 0:
            return False
        return review in self._RECEIVABLE_ELIGIBLE_REVIEW

    async def preview_pull_from_receivable(
        self,
        tenant_id: int,
        receivable_id: int,
    ) -> Dict[str, Any]:
        receivable = await Receivable.get_or_none(
            tenant_id=tenant_id, id=receivable_id, deleted_at__isnull=True
        )
        if not receivable:
            raise NotFoundError(f"应收单不存在: {receivable_id}")

        source_allowed = self._receivable_source_allowed(receivable)
        preview_items = await self._build_preview_items_for_receivable(tenant_id, receivable)
        allowed, reason = self._derive_pull_capability(
            source_allowed=source_allowed,
            preview_items=preview_items,
            not_allowed_reason="receipt.pull_from_receivable.not_allowed",
            no_lines_reason="receipt.pull_from_receivable.no_lines",
            already_pulled_reason="receipt.pull_from_receivable.already_pulled",
        )
        code = str(receivable.receivable_code or receivable_id)
        pushable = float(preview_items[0]["max_push_quantity"]) if preview_items else 0.0
        return {
            "target_type": "receipt",
            "source_type": "receivable",
            "source_id": receivable_id,
            "source_code": code,
            "summary": (
                f"将从应收单 {code} 创建收款单（可收款 ¥{pushable:,.2f}）"
                if preview_items and allowed
                else f"应收单 {code} 当前不可上拉收款单"
            ),
            "items": preview_items,
            "has_blocking_issues": not allowed,
            "blocking_reason": reason,
            "tip": "收款金额不可超过可收款金额；作废未核销收款单后，可收款金额自动回退。",
            "customer_id": receivable.customer_id,
            "customer_name": receivable.customer_name,
            "receivable_id": receivable.id,
            "receivable_code": code,
        }

    async def list_receivable_pull_candidates(
        self,
        tenant_id: int,
        skip: int = 0,
        limit: int = 20,
        keyword: Optional[str] = None,
    ) -> Dict[str, Any]:
        query = Receivable.filter(
            tenant_id=tenant_id,
            deleted_at__isnull=True,
            remaining_amount__gt=0,
        ).exclude(status="已结清")
        kw = str(keyword or "").strip()
        if kw:
            query = query.filter(
                Q(receivable_code__icontains=kw) | Q(customer_name__icontains=kw)
            )
        total = await query.count()
        receivables = await query.offset(skip).limit(limit).order_by("-created_at")
        receivable_ids = [int(r.id) for r in receivables]
        if not receivable_ids:
            return {"data": [], "total": total, "success": True}

        code_by_id = {int(r.id): str(r.receivable_code or r.id) for r in receivables}
        reserved_map = await self._sum_reserved_unsettled_by_receivable(
            tenant_id, receivable_ids, code_by_id
        )

        rows: List[Dict[str, Any]] = []
        for receivable in receivables:
            rid = int(receivable.id)
            preview_items = await self._build_preview_items_for_receivable(
                tenant_id,
                receivable,
                reserved_unsettled=reserved_map.get(rid, Decimal("0")),
            )
            allowed, reason = self._derive_pull_capability(
                source_allowed=self._receivable_source_allowed(receivable),
                preview_items=preview_items,
                not_allowed_reason="receipt.pull_from_receivable.not_allowed",
                no_lines_reason="receipt.pull_from_receivable.no_lines",
                already_pulled_reason="receipt.pull_from_receivable.already_pulled",
            )
            code = str(receivable.receivable_code or rid)
            name = str(getattr(receivable, "customer_name", "") or "").strip()
            label = f"{code} - {name}" if name else code
            rows.append(
                {
                    "id": rid,
                    "code": label,
                    "receivable_code": code,
                    "customer_name": receivable.customer_name,
                    "source_status": receivable.status,
                    "review_status": receivable.review_status,
                    "source_date": str(getattr(receivable, "due_date", "") or ""),
                    "amount": float(receivable.total_amount or 0),
                    "remaining_amount": float(receivable.remaining_amount or 0),
                    "capabilities": {
                        "pull_receipt": {
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
        if source_type != "receivable":
            raise BusinessLogicError(f"不支持的上拉源单类型: {source_type}")
        preview = await self.preview_pull_from_receivable(tenant_id, source_id)
        if preview.get("has_blocking_issues"):
            reason = preview.get("blocking_reason") or "当前不可上拉收款单"
            raise BusinessLogicError(reason)
        items = preview.get("items") or []
        if not items:
            raise BusinessLogicError("无可收款金额")
        max_push = Decimal(str(items[0].get("max_push_quantity") or 0))
        if total_amount > max_push:
            raise BusinessLogicError(f"收款金额 {total_amount} 超过可收款金额 {max_push}")
        return preview

    async def create_pull_relation(
        self,
        tenant_id: int,
        *,
        source_type: str,
        source_id: int,
        source_code: str,
        receipt_id: int,
        receipt_code: str,
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
                target_type="receipt",
                target_id=receipt_id,
                target_code=receipt_code,
                target_name=None,
                relation_type="source",
                relation_mode="pull",
                relation_desc="上拉创建收款单",
            ),
            created_by=created_by,
        )
