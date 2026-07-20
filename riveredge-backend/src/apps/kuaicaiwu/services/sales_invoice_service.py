"""
销售发票上拉门控：候选列表、预览、已开票金额汇总。
"""

from __future__ import annotations

from decimal import Decimal
from typing import Any, Dict, List, Optional

from tortoise.queryset import Q

from apps.common.base_service import AppBaseService
from apps.kuaicaiwu.models.invoice import Invoice
from apps.kuaizhizao.models.document_relation import DocumentRelation
from infra.exceptions.exceptions import BusinessLogicError, NotFoundError


class SalesInvoiceService(AppBaseService[Invoice]):
    """销售发票（销项）上拉门控服务"""

    _EXCLUDED_INVOICE_STATUSES = frozenset({"已作废", "已红冲"})

    _SO_ELIGIBLE_STATUSES = frozenset(
        {
            "AUDITED",
            "CONFIRMED",
            "IN_PROGRESS",
            "COMPLETED",
            "已审核",
            "已确认",
            "进行中",
            "已完成",
            "部分出库",
            "已出库",
        }
    )

    _SD_ELIGIBLE_STATUSES = frozenset({"已出库", "已完成", "部分出库", "SHIPPED", "COMPLETED"})

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
            target_type="sales_invoice",
        ).all()
        relation_by_invoice: Dict[int, int] = {
            int(r.target_id): int(r.source_id) for r in relations if r.target_id and r.source_id
        }
        invoice_ids = list(relation_by_invoice.keys())

        if invoice_ids:
            invoices = await Invoice.filter(
                tenant_id=tenant_id,
                id__in=invoice_ids,
                category="OUT",
                deleted_at__isnull=True,
            ).exclude(status__in=list(self._EXCLUDED_INVOICE_STATUSES))
            for inv in invoices:
                sid = relation_by_invoice.get(int(inv.id))
                if sid is not None:
                    result[sid] = result.get(sid, Decimal("0")) + Decimal(str(inv.total_amount or 0))

        codes = [c for c in code_by_id.values() if c]
        if codes:
            code_to_id = {str(v).strip(): k for k, v in code_by_id.items() if v}
            orphan_rows = await Invoice.filter(
                tenant_id=tenant_id,
                category="OUT",
                source_document_code__in=codes,
                deleted_at__isnull=True,
            ).exclude(status__in=list(self._EXCLUDED_INVOICE_STATUSES))
            for inv in orphan_rows:
                if int(inv.id) in relation_by_invoice:
                    continue
                sid = code_to_id.get(str(inv.source_document_code or "").strip())
                if sid is not None:
                    result[sid] = result.get(sid, Decimal("0")) + Decimal(str(inv.total_amount or 0))
        return result

    def _build_preview_item(
        self,
        *,
        source_id: int,
        source_code: str,
        customer_name: str,
        quantity: Decimal,
        pushed: Decimal,
    ) -> Dict[str, Any]:
        qty = float(quantity)
        pushed_f = float(pushed)
        max_push = float(max(Decimal("0"), quantity - pushed))
        return {
            "item_id": int(source_id),
            "source_code": source_code,
            "customer_name": customer_name,
            "quantity": qty,
            "pushed_quantity": pushed_f,
            "max_push_quantity": max_push,
        }

    async def _build_preview_items_for_sales_order(
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
                tenant_id, "sales_order", [oid], {oid: code}
            )
            pushed = pushed_map.get(oid, Decimal("0"))
        return [
            self._build_preview_item(
                source_id=oid,
                source_code=code,
                customer_name=str(getattr(order, "customer_name", "") or ""),
                quantity=total,
                pushed=pushed,
            )
        ]

    async def _build_preview_items_for_sales_delivery(
        self,
        tenant_id: int,
        delivery: Any,
        *,
        pushed: Optional[Decimal] = None,
    ) -> List[Dict[str, Any]]:
        did = int(delivery.id)
        code = str(delivery.delivery_code or did)
        total = Decimal(str(delivery.total_amount or 0))
        if total <= 0:
            return []
        if pushed is None:
            pushed_map = await self._sum_pushed_totals_by_source(
                tenant_id, "sales_delivery", [did], {did: code}
            )
            pushed = pushed_map.get(did, Decimal("0"))
        return [
            self._build_preview_item(
                source_id=did,
                source_code=code,
                customer_name=str(getattr(delivery, "customer_name", "") or ""),
                quantity=total,
                pushed=pushed,
            )
        ]

    async def preview_pull_from_sales_order(
        self,
        tenant_id: int,
        order_id: int,
    ) -> Dict[str, Any]:
        from apps.kuaizhizao.models.sales_order import SalesOrder

        order = await SalesOrder.get_or_none(
            tenant_id=tenant_id, id=order_id, deleted_at__isnull=True
        )
        if not order:
            raise NotFoundError(f"销售订单不存在: {order_id}")

        status = str(getattr(order, "status", "") or "").strip()
        source_allowed = status in self._SO_ELIGIBLE_STATUSES and Decimal(str(order.total_amount or 0)) > 0
        preview_items = await self._build_preview_items_for_sales_order(tenant_id, order)
        allowed, reason = self._derive_pull_capability(
            source_allowed=source_allowed,
            preview_items=preview_items,
            not_allowed_reason="sales_invoice.pull_from_sales_order.not_allowed",
            no_lines_reason="sales_invoice.pull_from_sales_order.no_lines",
            already_pulled_reason="sales_invoice.pull_from_sales_order.already_pulled",
        )
        code = str(order.order_code or order_id)
        pushable = float(preview_items[0]["max_push_quantity"]) if preview_items else 0.0
        return {
            "target_type": "sales_invoice",
            "source_type": "sales_order",
            "source_id": order_id,
            "source_code": code,
            "summary": (
                f"将从销售订单 {code} 创建销项发票（可开票 ¥{pushable:,.2f}）"
                if preview_items and allowed
                else f"销售订单 {code} 当前不可上拉销项发票"
            ),
            "items": preview_items,
            "has_blocking_issues": not allowed,
            "blocking_reason": reason,
            "tip": "价税合计不可超过可开票金额；删除未审核销项发票后，可开票金额自动回退。",
            "customer_id": order.customer_id,
            "customer_name": order.customer_name,
            "sales_order_id": order.id,
            "sales_order_code": code,
        }

    async def preview_pull_from_sales_delivery(
        self,
        tenant_id: int,
        delivery_id: int,
    ) -> Dict[str, Any]:
        from apps.kuaizhizao.models.sales_delivery import SalesDelivery

        delivery = await SalesDelivery.get_or_none(
            tenant_id=tenant_id, id=delivery_id, deleted_at__isnull=True
        )
        if not delivery:
            raise NotFoundError(f"销售出库单不存在: {delivery_id}")

        status = str(getattr(delivery, "status", "") or "").strip()
        source_allowed = status in self._SD_ELIGIBLE_STATUSES and Decimal(
            str(delivery.total_amount or 0)
        ) > 0
        preview_items = await self._build_preview_items_for_sales_delivery(tenant_id, delivery)
        allowed, reason = self._derive_pull_capability(
            source_allowed=source_allowed,
            preview_items=preview_items,
            not_allowed_reason="sales_invoice.pull_from_sales_delivery.not_allowed",
            no_lines_reason="sales_invoice.pull_from_sales_delivery.no_lines",
            already_pulled_reason="sales_invoice.pull_from_sales_delivery.already_pulled",
        )
        code = str(delivery.delivery_code or delivery_id)
        pushable = float(preview_items[0]["max_push_quantity"]) if preview_items else 0.0
        return {
            "target_type": "sales_invoice",
            "source_type": "sales_delivery",
            "source_id": delivery_id,
            "source_code": code,
            "summary": (
                f"将从销售出库单 {code} 创建销项发票（可开票 ¥{pushable:,.2f}）"
                if preview_items and allowed
                else f"销售出库单 {code} 当前不可上拉销项发票"
            ),
            "items": preview_items,
            "has_blocking_issues": not allowed,
            "blocking_reason": reason,
            "tip": "价税合计不可超过可开票金额；删除未审核销项发票后，可开票金额自动回退。",
            "customer_id": delivery.customer_id,
            "customer_name": delivery.customer_name,
            "sales_order_id": getattr(delivery, "sales_order_id", None),
            "sales_order_code": getattr(delivery, "sales_order_code", None),
        }

    async def list_sales_order_pull_candidates(
        self,
        tenant_id: int,
        skip: int = 0,
        limit: int = 20,
        keyword: Optional[str] = None,
    ) -> Dict[str, Any]:
        from apps.kuaizhizao.models.sales_order import SalesOrder

        query = SalesOrder.filter(
            tenant_id=tenant_id,
            status__in=list(self._SO_ELIGIBLE_STATUSES),
            deleted_at__isnull=True,
        )
        kw = str(keyword or "").strip()
        if kw:
            query = query.filter(Q(order_code__icontains=kw) | Q(customer_name__icontains=kw))
        total = await query.count()
        orders = await query.offset(skip).limit(limit).order_by("-created_at")
        order_ids = [int(o.id) for o in orders]
        if not order_ids:
            return {"data": [], "total": total, "success": True}

        code_by_id = {int(o.id): str(o.order_code or o.id) for o in orders}
        pushed_map = await self._sum_pushed_totals_by_source(
            tenant_id, "sales_order", order_ids, code_by_id
        )

        rows: List[Dict[str, Any]] = []
        for order in orders:
            oid = int(order.id)
            preview_items = await self._build_preview_items_for_sales_order(
                tenant_id,
                order,
                pushed=pushed_map.get(oid, Decimal("0")),
            )
            allowed, reason = self._derive_pull_capability(
                source_allowed=Decimal(str(order.total_amount or 0)) > 0,
                preview_items=preview_items,
                not_allowed_reason="sales_invoice.pull_from_sales_order.not_allowed",
                no_lines_reason="sales_invoice.pull_from_sales_order.no_lines",
                already_pulled_reason="sales_invoice.pull_from_sales_order.already_pulled",
            )
            code = str(order.order_code or oid)
            name = str(getattr(order, "customer_name", "") or "").strip()
            label = f"{code} - {name}" if name else code
            rows.append(
                {
                    "id": oid,
                    "code": label,
                    "order_code": code,
                    "customer_name": order.customer_name,
                    "source_status": order.status,
                    "source_date": str(getattr(order, "order_date", "") or ""),
                    "amount": float(order.total_amount or 0),
                    "capabilities": {
                        "pull_sales_invoice": {
                            "allowed": allowed,
                            "reason": reason,
                        }
                    },
                }
            )
        return {"data": rows, "total": total, "success": True}

    async def list_sales_delivery_pull_candidates(
        self,
        tenant_id: int,
        skip: int = 0,
        limit: int = 20,
        keyword: Optional[str] = None,
    ) -> Dict[str, Any]:
        from apps.kuaizhizao.models.sales_delivery import SalesDelivery

        query = SalesDelivery.filter(
            tenant_id=tenant_id,
            status__in=list(self._SD_ELIGIBLE_STATUSES),
            deleted_at__isnull=True,
        )
        kw = str(keyword or "").strip()
        if kw:
            query = query.filter(
                Q(delivery_code__icontains=kw) | Q(customer_name__icontains=kw)
            )
        total = await query.count()
        deliveries = await query.offset(skip).limit(limit).order_by("-created_at")
        delivery_ids = [int(d.id) for d in deliveries]
        if not delivery_ids:
            return {"data": [], "total": total, "success": True}

        code_by_id = {int(d.id): str(d.delivery_code or d.id) for d in deliveries}
        pushed_map = await self._sum_pushed_totals_by_source(
            tenant_id, "sales_delivery", delivery_ids, code_by_id
        )

        rows: List[Dict[str, Any]] = []
        for delivery in deliveries:
            did = int(delivery.id)
            preview_items = await self._build_preview_items_for_sales_delivery(
                tenant_id,
                delivery,
                pushed=pushed_map.get(did, Decimal("0")),
            )
            allowed, reason = self._derive_pull_capability(
                source_allowed=Decimal(str(delivery.total_amount or 0)) > 0,
                preview_items=preview_items,
                not_allowed_reason="sales_invoice.pull_from_sales_delivery.not_allowed",
                no_lines_reason="sales_invoice.pull_from_sales_delivery.no_lines",
                already_pulled_reason="sales_invoice.pull_from_sales_delivery.already_pulled",
            )
            code = str(delivery.delivery_code or did)
            name = str(getattr(delivery, "customer_name", "") or "").strip()
            label = f"{code} - {name}" if name else code
            rows.append(
                {
                    "id": did,
                    "code": label,
                    "delivery_code": code,
                    "customer_name": delivery.customer_name,
                    "source_status": delivery.status,
                    "source_date": str(
                        getattr(delivery, "delivery_time", "") or getattr(delivery, "created_at", "") or ""
                    ),
                    "amount": float(delivery.total_amount or 0),
                    "capabilities": {
                        "pull_sales_invoice": {
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
        if source_type == "sales_order":
            preview = await self.preview_pull_from_sales_order(tenant_id, source_id)
        elif source_type == "sales_delivery":
            preview = await self.preview_pull_from_sales_delivery(tenant_id, source_id)
        else:
            raise BusinessLogicError(f"不支持的上拉源单类型: {source_type}")
        if preview.get("has_blocking_issues"):
            reason = preview.get("blocking_reason") or "当前不可上拉销项发票"
            raise BusinessLogicError(reason)
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
                target_type="sales_invoice",
                target_id=invoice_id,
                target_code=invoice_code,
                target_name=None,
                relation_type="source",
                relation_mode="pull",
                relation_desc="上拉创建销项发票",
            ),
            created_by=created_by,
        )
