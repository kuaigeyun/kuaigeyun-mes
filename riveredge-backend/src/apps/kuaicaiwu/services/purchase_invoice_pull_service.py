"""
采购发票加载门控：候选列表、预览、已开票金额汇总。
"""

from __future__ import annotations

from decimal import Decimal
from typing import Any, Dict, List, Optional

from tortoise.queryset import Q

from apps.common.base_service import AppBaseService
from apps.kuaicaiwu.models.payable import Payable
from apps.kuaicaiwu.models.purchase_invoice import PurchaseInvoice
from apps.kuaizhizao.models.document_relation import DocumentRelation
from infra.exceptions.exceptions import BusinessLogicError, NotFoundError


class PurchaseInvoicePullService(AppBaseService[PurchaseInvoice]):
    """采购发票（进项）加载门控服务"""

    _EXCLUDED_INVOICE_STATUSES = frozenset({"已作废", "已红冲"})

    _PO_ELIGIBLE_STATUSES = frozenset(
        {
            "AUDITED",
            "CONFIRMED",
            "IN_PROGRESS",
            "COMPLETED",
            "已审核",
            "已确认",
            "进行中",
            "已完成",
            "部分入库",
            "已入库",
            "已通过",
        }
    )

    _PR_ELIGIBLE_STATUSES = frozenset(
        {"已入库", "已完成", "部分入库", "COMPLETED", "completed"}
    )

    _PAYABLE_ELIGIBLE_REVIEW = frozenset({"已审核"})

    _PO_LEGACY_SOURCE_TYPES = frozenset({"purchase_order", "采购订单", "PurchaseOrder"})
    _PR_LEGACY_SOURCE_TYPES = frozenset({"purchase_receipt", "采购入库", "PurchaseReceipt"})

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

    async def _sum_pushed_totals_by_source(
        self,
        tenant_id: int,
        source_type: str,
        source_ids: List[int],
        code_by_id: Dict[int, str],
    ) -> Dict[int, Decimal]:
        result: Dict[int, Decimal] = {sid: Decimal("0") for sid in source_ids}
        if not source_ids:
            return result

        relations = await DocumentRelation.filter(
            tenant_id=tenant_id,
            source_type=source_type,
            source_id__in=source_ids,
            target_type="purchase_invoice",
        ).all()
        relation_by_invoice: Dict[int, int] = {
            int(r.target_id): int(r.source_id) for r in relations if r.target_id and r.source_id
        }
        invoice_ids = list(relation_by_invoice.keys())

        if invoice_ids:
            invoices = await PurchaseInvoice.filter(
                tenant_id=tenant_id,
                id__in=invoice_ids,
                deleted_at__isnull=True,
            ).exclude(status__in=list(self._EXCLUDED_INVOICE_STATUSES))
            for inv in invoices:
                sid = relation_by_invoice.get(int(inv.id))
                if sid is not None:
                    result[sid] = result.get(sid, Decimal("0")) + Decimal(str(inv.total_amount or 0))

        if source_type == "purchase_order":
            orphans = await PurchaseInvoice.filter(
                tenant_id=tenant_id,
                purchase_order_id__in=source_ids,
                deleted_at__isnull=True,
            ).exclude(status__in=list(self._EXCLUDED_INVOICE_STATUSES))
            orphan_ids = [int(o.id) for o in orphans if int(o.id) not in relation_by_invoice]
            related_target_ids: set[int] = set()
            if orphan_ids:
                rel_rows = await DocumentRelation.filter(
                    tenant_id=tenant_id,
                    target_type="purchase_invoice",
                    target_id__in=orphan_ids,
                ).all()
                related_target_ids = {int(r.target_id) for r in rel_rows if r.target_id}
            for inv in orphans:
                if int(inv.id) in relation_by_invoice:
                    continue
                if int(inv.id) in related_target_ids:
                    continue
                sid = int(inv.purchase_order_id)
                if sid in result:
                    result[sid] = result.get(sid, Decimal("0")) + Decimal(str(inv.total_amount or 0))
        elif source_type == "purchase_receipt":
            # 入库来源已开票金额仅认 DocumentRelation；不再全表扫 notes。
            _ = code_by_id
        return result

    async def _sum_pushed_totals_by_payable(
        self,
        tenant_id: int,
        payable_ids: List[int],
        code_by_id: Dict[int, str],
    ) -> Dict[int, Decimal]:
        result: Dict[int, Decimal] = {pid: Decimal("0") for pid in payable_ids}
        if not payable_ids:
            return result

        counted_invoice_ids: set[int] = set()

        direct_rows = await PurchaseInvoice.filter(
            tenant_id=tenant_id,
            payable_id__in=payable_ids,
            deleted_at__isnull=True,
        ).exclude(status__in=list(self._EXCLUDED_INVOICE_STATUSES))
        for inv in direct_rows:
            pid = int(inv.payable_id)
            if pid in result:
                result[pid] = result.get(pid, Decimal("0")) + Decimal(str(inv.total_amount or 0))
                counted_invoice_ids.add(int(inv.id))

        relations = await DocumentRelation.filter(
            tenant_id=tenant_id,
            source_type="payable",
            source_id__in=payable_ids,
            target_type="purchase_invoice",
        ).all()
        relation_by_invoice: Dict[int, int] = {
            int(r.target_id): int(r.source_id) for r in relations if r.target_id and r.source_id
        }
        orphan_invoice_ids = [
            iid for iid in relation_by_invoice if iid not in counted_invoice_ids
        ]
        if orphan_invoice_ids:
            linked = await PurchaseInvoice.filter(
                tenant_id=tenant_id,
                id__in=orphan_invoice_ids,
                deleted_at__isnull=True,
            ).exclude(status__in=list(self._EXCLUDED_INVOICE_STATUSES))
            for inv in linked:
                sid = relation_by_invoice.get(int(inv.id))
                if sid is not None:
                    result[sid] = result.get(sid, Decimal("0")) + Decimal(str(inv.total_amount or 0))
                    counted_invoice_ids.add(int(inv.id))

        # 应付已开票金额仅认 payable_id + DocumentRelation；不再全表扫 notes。
        _ = code_by_id
        return result

    def _payable_source_allowed(self, payable: Any) -> bool:
        review = str(getattr(payable, "review_status", "") or "").strip()
        total = Decimal(str(payable.total_amount or 0))
        return review in self._PAYABLE_ELIGIBLE_REVIEW and total > 0

    async def _resolve_purchase_orders_from_payables(
        self,
        tenant_id: int,
        payables: List[Any],
    ) -> Dict[int, tuple[Optional[int], Optional[str]]]:
        """批量解析应付单关联采购订单，避免列表路径逐行查入库单。"""
        from apps.kuaizhizao.models.purchase_receipt import PurchaseReceipt

        result: Dict[int, tuple[Optional[int], Optional[str]]] = {}
        receipt_to_payable_ids: Dict[int, List[int]] = {}

        for payable in payables:
            pid = int(payable.id)
            source_type = str(getattr(payable, "source_type", "") or "").strip()
            source_id = getattr(payable, "source_id", None)
            source_code = str(getattr(payable, "source_code", "") or "").strip() or None
            if source_type in self._PO_LEGACY_SOURCE_TYPES and source_id:
                result[pid] = (int(source_id), source_code)
                continue
            if source_type in self._PR_LEGACY_SOURCE_TYPES and source_id:
                receipt_to_payable_ids.setdefault(int(source_id), []).append(pid)
                result[pid] = (None, None)
                continue
            result[pid] = (None, None)

        receipt_ids = list(receipt_to_payable_ids.keys())
        if receipt_ids:
            receipts = await PurchaseReceipt.filter(
                tenant_id=tenant_id,
                id__in=receipt_ids,
                deleted_at__isnull=True,
            ).values("id", "purchase_order_id", "purchase_order_code")
            for row in receipts:
                rid = int(row["id"])
                po_id = row.get("purchase_order_id")
                if not po_id:
                    continue
                resolved = (int(po_id), row.get("purchase_order_code"))
                for pid in receipt_to_payable_ids.get(rid, []):
                    result[pid] = resolved
        return result

    async def _resolve_purchase_order_from_payable(
        self,
        tenant_id: int,
        payable: Any,
    ) -> tuple[Optional[int], Optional[str]]:
        mapped = await self._resolve_purchase_orders_from_payables(tenant_id, [payable])
        return mapped.get(int(payable.id), (None, None))

    def _build_preview_item(
        self,
        *,
        source_id: int,
        source_code: str,
        supplier_name: str,
        quantity: Decimal,
        pushed: Decimal,
    ) -> Dict[str, Any]:
        qty = float(quantity)
        pushed_f = float(pushed)
        max_push = float(max(Decimal("0"), quantity - pushed))
        return {
            "item_id": int(source_id),
            "source_code": source_code,
            "supplier_name": supplier_name,
            "quantity": qty,
            "pushed_quantity": pushed_f,
            "max_push_quantity": max_push,
        }

    async def _build_preview_items_for_purchase_order(
        self,
        tenant_id: int,
        order: Any,
        *,
        pushed: Optional[Decimal] = None,
    ) -> List[Dict[str, Any]]:
        oid = int(order.id)
        code = str(order.order_code or oid)
        total = Decimal(str(order.total_amount or 0))
        if total <= 0:
            return []
        if pushed is None:
            pushed_map = await self._sum_pushed_totals_by_source(
                tenant_id, "purchase_order", [oid], {oid: code}
            )
            pushed = pushed_map.get(oid, Decimal("0"))
        return [
            self._build_preview_item(
                source_id=oid,
                source_code=code,
                supplier_name=str(getattr(order, "supplier_name", "") or ""),
                quantity=total,
                pushed=pushed,
            )
        ]

    async def _build_preview_items_for_purchase_receipt(
        self,
        tenant_id: int,
        receipt: Any,
        *,
        pushed: Optional[Decimal] = None,
    ) -> List[Dict[str, Any]]:
        rid = int(receipt.id)
        code = str(receipt.receipt_code or rid)
        total = Decimal(str(receipt.total_amount or 0))
        if total <= 0:
            return []
        if pushed is None:
            pushed_map = await self._sum_pushed_totals_by_source(
                tenant_id, "purchase_receipt", [rid], {rid: code}
            )
            pushed = pushed_map.get(rid, Decimal("0"))
        return [
            self._build_preview_item(
                source_id=rid,
                source_code=code,
                supplier_name=str(getattr(receipt, "supplier_name", "") or ""),
                quantity=total,
                pushed=pushed,
            )
        ]

    async def _build_preview_items_for_payable(
        self,
        tenant_id: int,
        payable: Any,
        *,
        pushed: Optional[Decimal] = None,
    ) -> List[Dict[str, Any]]:
        pid = int(payable.id)
        code = str(payable.payable_code or pid)
        total = Decimal(str(payable.total_amount or 0))
        if total <= 0:
            return []
        if pushed is None:
            pushed_map = await self._sum_pushed_totals_by_payable(
                tenant_id, [pid], {pid: code}
            )
            pushed = pushed_map.get(pid, Decimal("0"))
        return [
            self._build_preview_item(
                source_id=pid,
                source_code=code,
                supplier_name=str(getattr(payable, "supplier_name", "") or ""),
                quantity=total,
                pushed=pushed,
            )
        ]

    async def preview_pull_from_purchase_order(
        self,
        tenant_id: int,
        order_id: int,
    ) -> Dict[str, Any]:
        from apps.kuaizhizao.models.purchase_order import PurchaseOrder

        order = await PurchaseOrder.get_or_none(
            tenant_id=tenant_id, id=order_id, deleted_at__isnull=True
        )
        if not order:
            raise NotFoundError(f"采购订单不存在: {order_id}")

        status = str(getattr(order, "status", "") or "").strip()
        source_allowed = status in self._PO_ELIGIBLE_STATUSES and Decimal(
            str(order.total_amount or 0)
        ) > 0
        preview_items = await self._build_preview_items_for_purchase_order(tenant_id, order)
        allowed, reason = self._derive_pull_capability(
            source_allowed=source_allowed,
            preview_items=preview_items,
            not_allowed_reason="purchase_invoice.pull_from_purchase_order.not_allowed",
            no_lines_reason="purchase_invoice.pull_from_purchase_order.no_lines",
            already_pulled_reason="purchase_invoice.pull_from_purchase_order.already_pulled",
        )
        code = str(order.order_code or order_id)
        pushable = float(preview_items[0]["max_push_quantity"]) if preview_items else 0.0
        return {
            "target_type": "purchase_invoice",
            "source_type": "purchase_order",
            "source_id": order_id,
            "source_code": code,
            "summary": (
                f"将从采购订单 {code} 创建进项发票（可开票 ¥{pushable:,.2f}）"
                if preview_items and allowed
                else f"采购订单 {code} 当前不可加载进项发票"
            ),
            "items": preview_items,
            "has_blocking_issues": not allowed,
            "blocking_reason": reason,
            "tip": "价税合计不可超过可开票金额；删除未审核进项发票后，可开票金额自动回退。",
            "supplier_id": order.supplier_id,
            "supplier_name": order.supplier_name,
            "purchase_order_id": order.id,
            "purchase_order_code": code,
        }

    async def preview_pull_from_purchase_receipt(
        self,
        tenant_id: int,
        receipt_id: int,
    ) -> Dict[str, Any]:
        from apps.kuaizhizao.models.purchase_receipt import PurchaseReceipt

        receipt = await PurchaseReceipt.get_or_none(
            tenant_id=tenant_id, id=receipt_id, deleted_at__isnull=True
        )
        if not receipt:
            raise NotFoundError(f"采购入库单不存在: {receipt_id}")

        status = str(getattr(receipt, "status", "") or "").strip()
        source_allowed = status in self._PR_ELIGIBLE_STATUSES and Decimal(
            str(receipt.total_amount or 0)
        ) > 0
        preview_items = await self._build_preview_items_for_purchase_receipt(tenant_id, receipt)
        allowed, reason = self._derive_pull_capability(
            source_allowed=source_allowed,
            preview_items=preview_items,
            not_allowed_reason="purchase_invoice.pull_from_purchase_receipt.not_allowed",
            no_lines_reason="purchase_invoice.pull_from_purchase_receipt.no_lines",
            already_pulled_reason="purchase_invoice.pull_from_purchase_receipt.already_pulled",
        )
        code = str(receipt.receipt_code or receipt_id)
        pushable = float(preview_items[0]["max_push_quantity"]) if preview_items else 0.0
        return {
            "target_type": "purchase_invoice",
            "source_type": "purchase_receipt",
            "source_id": receipt_id,
            "source_code": code,
            "summary": (
                f"将从采购入库单 {code} 创建进项发票（可开票 ¥{pushable:,.2f}）"
                if preview_items and allowed
                else f"采购入库单 {code} 当前不可加载进项发票"
            ),
            "items": preview_items,
            "has_blocking_issues": not allowed,
            "blocking_reason": reason,
            "tip": "价税合计不可超过可开票金额；删除未审核进项发票后，可开票金额自动回退。",
            "supplier_id": receipt.supplier_id,
            "supplier_name": receipt.supplier_name,
            "purchase_order_id": receipt.purchase_order_id,
            "purchase_order_code": receipt.purchase_order_code,
        }

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
        po_id, po_code = await self._resolve_purchase_order_from_payable(tenant_id, payable)
        if source_allowed and po_id is None:
            source_allowed = False
        allowed, reason = self._derive_pull_capability(
            source_allowed=source_allowed,
            preview_items=preview_items,
            not_allowed_reason="purchase_invoice.pull_from_payable.not_allowed",
            no_lines_reason="purchase_invoice.pull_from_payable.no_lines",
            already_pulled_reason="purchase_invoice.pull_from_payable.already_pulled",
        )
        if not po_id and preview_items:
            allowed = False
            reason = reason or "purchase_invoice.pull_from_payable.no_purchase_order"
        code = str(payable.payable_code or payable_id)
        pushable = float(preview_items[0]["max_push_quantity"]) if preview_items else 0.0
        return {
            "target_type": "purchase_invoice",
            "source_type": "payable",
            "source_id": payable_id,
            "source_code": code,
            "summary": (
                f"将从应付单 {code} 创建进项发票（可开票 ¥{pushable:,.2f}）"
                if preview_items and allowed
                else f"应付单 {code} 当前不可加载进项发票"
            ),
            "items": preview_items,
            "has_blocking_issues": not allowed,
            "blocking_reason": reason,
            "tip": "价税合计不可超过可开票金额；删除未审核进项发票后，可开票金额自动回退。",
            "supplier_id": payable.supplier_id,
            "supplier_name": payable.supplier_name,
            "payable_id": payable.id,
            "payable_code": code,
            "purchase_order_id": po_id,
            "purchase_order_code": po_code,
        }

    async def list_purchase_order_pull_candidates(
        self,
        tenant_id: int,
        skip: int = 0,
        limit: int = 20,
        keyword: Optional[str] = None,
    ) -> Dict[str, Any]:
        from apps.kuaizhizao.models.purchase_order import PurchaseOrder

        query = PurchaseOrder.filter(
            tenant_id=tenant_id,
            status__in=list(self._PO_ELIGIBLE_STATUSES),
            deleted_at__isnull=True,
        )
        kw = str(keyword or "").strip()
        if kw:
            query = query.filter(Q(order_code__icontains=kw) | Q(supplier_name__icontains=kw))
        total = await query.count()
        orders = await query.offset(skip).limit(limit).order_by("-created_at")
        order_ids = [int(o.id) for o in orders]
        if not order_ids:
            return {"data": [], "total": total, "success": True}

        code_by_id = {int(o.id): str(o.order_code or o.id) for o in orders}
        pushed_map = await self._sum_pushed_totals_by_source(
            tenant_id, "purchase_order", order_ids, code_by_id
        )

        rows: List[Dict[str, Any]] = []
        for order in orders:
            oid = int(order.id)
            preview_items = await self._build_preview_items_for_purchase_order(
                tenant_id,
                order,
                pushed=pushed_map.get(oid, Decimal("0")),
            )
            allowed, reason = self._derive_pull_capability(
                source_allowed=Decimal(str(order.total_amount or 0)) > 0,
                preview_items=preview_items,
                not_allowed_reason="purchase_invoice.pull_from_purchase_order.not_allowed",
                no_lines_reason="purchase_invoice.pull_from_purchase_order.no_lines",
                already_pulled_reason="purchase_invoice.pull_from_purchase_order.already_pulled",
            )
            code = str(order.order_code or oid)
            name = str(getattr(order, "supplier_name", "") or "").strip()
            label = f"{code} - {name}" if name else code
            rows.append(
                {
                    "id": oid,
                    "code": label,
                    "order_code": code,
                    "supplier_name": order.supplier_name,
                    "source_status": order.status,
                    "source_date": str(getattr(order, "order_date", "") or ""),
                    "amount": float(order.total_amount or 0),
                    "capabilities": {
                        "pull_purchase_invoice": {
                            "allowed": allowed,
                            "reason": reason,
                        }
                    },
                }
            )
        return {"data": rows, "total": total, "success": True}

    async def list_purchase_receipt_pull_candidates(
        self,
        tenant_id: int,
        skip: int = 0,
        limit: int = 20,
        keyword: Optional[str] = None,
    ) -> Dict[str, Any]:
        from apps.kuaizhizao.models.purchase_receipt import PurchaseReceipt

        query = PurchaseReceipt.filter(
            tenant_id=tenant_id,
            status__in=list(self._PR_ELIGIBLE_STATUSES),
            deleted_at__isnull=True,
        )
        kw = str(keyword or "").strip()
        if kw:
            query = query.filter(
                Q(receipt_code__icontains=kw) | Q(supplier_name__icontains=kw)
            )
        total = await query.count()
        receipts = await query.offset(skip).limit(limit).order_by("-created_at")
        receipt_ids = [int(r.id) for r in receipts]
        if not receipt_ids:
            return {"data": [], "total": total, "success": True}

        code_by_id = {int(r.id): str(r.receipt_code or r.id) for r in receipts}
        pushed_map = await self._sum_pushed_totals_by_source(
            tenant_id, "purchase_receipt", receipt_ids, code_by_id
        )

        rows: List[Dict[str, Any]] = []
        for receipt in receipts:
            rid = int(receipt.id)
            preview_items = await self._build_preview_items_for_purchase_receipt(
                tenant_id,
                receipt,
                pushed=pushed_map.get(rid, Decimal("0")),
            )
            allowed, reason = self._derive_pull_capability(
                source_allowed=Decimal(str(receipt.total_amount or 0)) > 0,
                preview_items=preview_items,
                not_allowed_reason="purchase_invoice.pull_from_purchase_receipt.not_allowed",
                no_lines_reason="purchase_invoice.pull_from_purchase_receipt.no_lines",
                already_pulled_reason="purchase_invoice.pull_from_purchase_receipt.already_pulled",
            )
            code = str(receipt.receipt_code or rid)
            name = str(getattr(receipt, "supplier_name", "") or "").strip()
            label = f"{code} - {name}" if name else code
            rows.append(
                {
                    "id": rid,
                    "code": label,
                    "receipt_code": code,
                    "supplier_name": receipt.supplier_name,
                    "source_status": receipt.status,
                    "source_date": str(
                        getattr(receipt, "receipt_time", "") or getattr(receipt, "created_at", "") or ""
                    ),
                    "amount": float(receipt.total_amount or 0),
                    "capabilities": {
                        "pull_purchase_invoice": {
                            "allowed": allowed,
                            "reason": reason,
                        }
                    },
                }
            )
        return {"data": rows, "total": total, "success": True}

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
            total_amount__gt=0,
        )
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
        pushed_map = await self._sum_pushed_totals_by_payable(
            tenant_id, payable_ids, code_by_id
        )

        rows: List[Dict[str, Any]] = []
        for payable in payables:
            pid = int(payable.id)
            preview_items = await self._build_preview_items_for_payable(
                tenant_id,
                payable,
                pushed=pushed_map.get(pid, Decimal("0")),
            )
            allowed, reason = self._derive_pull_capability(
                source_allowed=self._payable_source_allowed(payable),
                preview_items=preview_items,
                not_allowed_reason="purchase_invoice.pull_from_payable.not_allowed",
                no_lines_reason="purchase_invoice.pull_from_payable.no_lines",
                already_pulled_reason="purchase_invoice.pull_from_payable.already_pulled",
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
                    "source_date": str(getattr(payable, "business_date", "") or ""),
                    "amount": float(payable.total_amount or 0),
                    "capabilities": {
                        "pull_purchase_invoice": {
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
        if source_type == "purchase_order":
            preview = await self.preview_pull_from_purchase_order(tenant_id, source_id)
        elif source_type == "purchase_receipt":
            preview = await self.preview_pull_from_purchase_receipt(tenant_id, source_id)
        elif source_type == "payable":
            preview = await self.preview_pull_from_payable(tenant_id, source_id)
        else:
            raise BusinessLogicError(f"不支持的加载源单类型: {source_type}")
        if preview.get("has_blocking_issues"):
            reason = preview.get("blocking_reason") or "当前不可加载进项发票"
            raise BusinessLogicError(reason)
        if source_type == "payable" and not preview.get("purchase_order_id"):
            raise BusinessLogicError("应付单未关联采购订单，无法加载进项发票")
        items = preview.get("items") or []
        if not items:
            raise BusinessLogicError("无可开票金额")
        max_push = Decimal(str(items[0].get("max_push_quantity") or 0))
        if total_amount > max_push:
            raise BusinessLogicError(f"价税合计 {total_amount} 超过可开票金额 {max_push}")
        return preview

    async def create_pull_relation(
        self,
        tenant_id: int,
        *,
        source_type: str,
        source_id: int,
        source_code: str,
        invoice_id: int,
        invoice_code: str,
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
                target_type="purchase_invoice",
                target_id=invoice_id,
                target_code=invoice_code,
                target_name=None,
                relation_type="source",
                relation_mode="pull",
                relation_desc="加载创建进项发票",
            ),
            created_by=created_by,
        )
