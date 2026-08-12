"""
单据对账服务：基于 document_relation_service 聚合业财单据链路。
"""

from __future__ import annotations

from datetime import date, datetime, time
from decimal import Decimal
from typing import Any, Dict, List, Optional

from apps.kuaizhizao.services.document_relation_service import DocumentRelationService
from apps.kuaicaiwu.services.finance_aggregation_service import FinanceAggregationService
from core.utils.timezone_utils import to_api_isoformat


class DocumentReconciliationService:
    """业财单据对账与链路核对。"""

    def __init__(self) -> None:
        self._aggregation = FinanceAggregationService()

    FINANCE_DOC_TYPES = {
        "receivable",
        "payable",
        "receipt",
        "payment",
        "sales_invoice",
        "purchase_invoice",
        "settlement",
    }

    SALES_CHAIN_STEPS = [
        ("sales_order", "销售订单"),
        ("sales_delivery", "销售出库"),
        ("receivable", "应收单"),
        ("sales_invoice", "销项发票"),
        ("receipt", "收款单"),
    ]

    PURCHASE_CHAIN_STEPS = [
        ("purchase_order", "采购订单"),
        ("purchase_receipt", "采购入库"),
        ("payable", "应付单"),
        ("purchase_invoice", "进项发票"),
        ("payment", "付款单"),
    ]

    def _normalize_doc_type(self, doc_type: str) -> str:
        return str(doc_type or "").strip().lower().replace("-", "_")

    @staticmethod
    def _is_finance_gap(item: Dict[str, Any]) -> bool:
        unsettled = Decimal(str(item.get("remaining_amount") or item.get("unsettled_amount") or 0))
        related = int(item.get("finance_related_count") or 0)
        return related <= 0 or unsettled > 0

    async def _append_source_doc_finance_gaps(
        self,
        tenant_id: int,
        *,
        partner_type: str,
        partner_id: int,
        start_date: date,
        end_date: date,
        items: List[Dict[str, Any]],
    ) -> None:
        """扫描已确认出入库但尚未生成应收/应付的源业务单据缺口。"""
        from apps.kuaicaiwu.models.receivable import Receivable
        from apps.kuaicaiwu.models.payable import Payable

        start_dt = datetime.combine(start_date, time.min)
        end_dt = datetime.combine(end_date, time.max)
        pt = partner_type.lower()

        if pt in ("customer", "客户"):
            from apps.kuaizhizao.models.sales_delivery import SalesDelivery

            deliveries = await SalesDelivery.filter(
                tenant_id=tenant_id,
                customer_id=partner_id,
                status="已出库",
                delivery_time__gte=start_dt,
                delivery_time__lte=end_dt,
                deleted_at__isnull=True,
                total_amount__gt=0,
            ).all()
            if not deliveries:
                return
            delivery_ids = [int(d.id) for d in deliveries]
            linked_ids = set(
                await Receivable.filter(
                    tenant_id=tenant_id,
                    source_type="销售出库",
                    source_id__in=delivery_ids,
                    deleted_at__isnull=True,
                ).values_list("source_id", flat=True)
            )
            for row in deliveries:
                if int(row.id) in linked_ids:
                    continue
                amount = Decimal(str(row.total_amount or 0))
                items.append(
                    self._aggregation.enrich_gap_item(
                        doc_type="sales_delivery",
                        total_amount=amount,
                        settled_amount=Decimal("0"),
                        remaining_amount=amount,
                        finance_related_count=0,
                        base={
                            "doc_type": "sales_delivery",
                            "doc_id": row.id,
                            "doc_code": row.delivery_code,
                            "amount": float(amount),
                            "remaining_amount": float(amount),
                            "finance_related_count": 0,
                            "gap_reason": "confirmed_delivery_without_receivable",
                        },
                    )
                )
            return

        from apps.kuaizhizao.models.purchase_receipt import PurchaseReceipt

        receipts = await PurchaseReceipt.filter(
            tenant_id=tenant_id,
            supplier_id=partner_id,
            status__in=["已入库", "已完成"],
            receipt_time__gte=start_dt,
            receipt_time__lte=end_dt,
            deleted_at__isnull=True,
            total_amount__gt=0,
        ).all()
        if not receipts:
            return
        receipt_ids = [int(r.id) for r in receipts]
        linked_ids = set(
            await Payable.filter(
                tenant_id=tenant_id,
                source_type="采购入库",
                source_id__in=receipt_ids,
                deleted_at__isnull=True,
            ).values_list("source_id", flat=True)
        )
        for row in receipts:
            if int(row.id) in linked_ids:
                continue
            amount = Decimal(str(row.total_amount or 0))
            items.append(
                self._aggregation.enrich_gap_item(
                    doc_type="purchase_receipt",
                    total_amount=amount,
                    settled_amount=Decimal("0"),
                    remaining_amount=amount,
                    finance_related_count=0,
                    base={
                        "doc_type": "purchase_receipt",
                        "doc_id": row.id,
                        "doc_code": row.receipt_code,
                        "amount": float(amount),
                        "remaining_amount": float(amount),
                        "finance_related_count": 0,
                        "gap_reason": "confirmed_receipt_without_payable",
                    },
                )
            )

    def _index_chain_nodes(self, trace: Dict[str, Any]) -> Dict[str, List[Dict[str, Any]]]:
        buckets: Dict[str, List[Dict[str, Any]]] = {}
        for key in ("upstream_chain", "downstream_chain"):
            raw = trace.get(key)
            if not isinstance(raw, list):
                continue
            for node in raw:
                if not isinstance(node, dict):
                    continue
                dtype = self._normalize_doc_type(node.get("document_type") or node.get("type") or "")
                if not dtype:
                    continue
                buckets.setdefault(dtype, []).append(node)
        return buckets

    async def build_standard_chain(
        self,
        tenant_id: int,
        *,
        flow_type: str,
        document_type: str,
        document_id: int,
    ) -> Dict[str, Any]:
        """构建销售/采购业财标准链路（订单→出入库→应收应付→发票→收付款）。"""
        flow = flow_type.strip().lower()
        steps_def = self.SALES_CHAIN_STEPS if flow == "sales" else self.PURCHASE_CHAIN_STEPS
        trace = await DocumentRelationService().trace_document_chain(
            tenant_id=tenant_id,
            document_type=document_type,
            document_id=document_id,
            direction="both",
        )
        indexed = self._index_chain_nodes(trace)

        anchor_type = self._normalize_doc_type(document_type)
        steps: List[Dict[str, Any]] = []
        for step_type, step_label in steps_def:
            norm = self._normalize_doc_type(step_type)
            matched = indexed.get(norm, [])
            if norm == anchor_type and not matched:
                matched = [{
                    "document_type": document_type,
                    "document_id": document_id,
                    "document_code": trace.get("document_code"),
                    "is_anchor": True,
                }]
            if matched:
                for node in matched:
                    steps.append({
                        "step_type": step_type,
                        "step_label": step_label,
                        "status": "linked",
                        "document_type": node.get("document_type") or step_type,
                        "document_id": node.get("document_id") or node.get("id"),
                        "document_code": node.get("document_code") or node.get("code"),
                        "amount": node.get("amount") or node.get("total_amount"),
                    })
            else:
                steps.append({
                    "step_type": step_type,
                    "step_label": step_label,
                    "status": "missing",
                    "document_type": step_type,
                    "document_id": None,
                    "document_code": None,
                    "amount": None,
                })

        linked_count = sum(1 for s in steps if s["status"] == "linked")
        steps = await self._aggregation.enrich_chain_steps(tenant_id, steps)
        return {
            "flow_type": flow,
            "anchor": {"document_type": document_type, "document_id": document_id},
            "steps": steps,
            "linked_count": linked_count,
            "total_steps": len(steps_def),
            "completion_rate": round(linked_count / len(steps_def), 4) if steps_def else 0,
            "trace": trace,
        }

    async def get_prepayment_balances(
        self,
        tenant_id: int,
        *,
        partner_type: Optional[str] = None,
        keyword: Optional[str] = None,
        partner_name: Optional[str] = None,
        skip: int = 0,
        limit: int = 20,
        sort_field: Optional[str] = None,
        sort_order: Optional[str] = None,
        operator_id: Optional[int] = None,
    ) -> Dict[str, Any]:
        """预收/预付余额汇总（未核销余额 > 0 且 settlement_type=prepayment）。"""
        from apps.kuaicaiwu.models.receipt import Receipt
        from apps.kuaicaiwu.models.payment import Payment

        # 打开余额页时补齐：已确认采购订单有预付金额但未生成预付付款单的历史缺口
        pt = (partner_type or "").strip().lower()
        if operator_id and pt in ("", "supplier"):
            from apps.kuaicaiwu.services.finance_integration_hooks import (
                backfill_missing_purchase_order_prepayments,
            )

            await backfill_missing_purchase_order_prepayments(
                tenant_id, operator_id=int(operator_id)
            )

        receipt_rows = await Receipt.filter(
            tenant_id=tenant_id,
            settlement_type="prepayment",
            unsettled_amount__gt=0,
            deleted_at__isnull=True,
        ).all()
        payment_rows = await Payment.filter(
            tenant_id=tenant_id,
            settlement_type="prepayment",
            unsettled_amount__gt=0,
            deleted_at__isnull=True,
        ).all()

        customer_map: Dict[int, Dict[str, Any]] = {}
        for row in receipt_rows:
            bucket = customer_map.setdefault(
                int(row.customer_id),
                {
                    "partner_type": "customer",
                    "partner_id": row.customer_id,
                    "partner_name": row.customer_name,
                    "prepayment_balance": Decimal("0"),
                    "receipt_count": 0,
                },
            )
            bucket["prepayment_balance"] += Decimal(str(row.unsettled_amount or 0))
            bucket["receipt_count"] += 1

        supplier_map: Dict[int, Dict[str, Any]] = {}
        for row in payment_rows:
            bucket = supplier_map.setdefault(
                int(row.supplier_id),
                {
                    "partner_type": "supplier",
                    "partner_id": row.supplier_id,
                    "partner_name": row.supplier_name,
                    "prepayment_balance": Decimal("0"),
                    "payment_count": 0,
                },
            )
            bucket["prepayment_balance"] += Decimal(str(row.unsettled_amount or 0))
            bucket["payment_count"] += 1

        def _serialize(m: Dict[int, Dict[str, Any]]) -> List[Dict[str, Any]]:
            rows = []
            for item in m.values():
                rows.append({
                    **item,
                    "prepayment_balance": float(
                        Decimal(str(item["prepayment_balance"])).quantize(Decimal("0.01"))
                    ),
                })
            rows.sort(key=lambda x: x["prepayment_balance"], reverse=True)
            return rows

        total_customer = sum((Decimal(str(r.unsettled_amount or 0)) for r in receipt_rows), Decimal("0"))
        total_supplier = sum((Decimal(str(p.unsettled_amount or 0)) for p in payment_rows), Decimal("0"))
        customer_balances = _serialize(customer_map)
        supplier_balances = _serialize(supplier_map)
        totals = {
            "total_customer_prepayment": float(total_customer.quantize(Decimal("0.01"))),
            "total_supplier_prepayment": float(total_supplier.quantize(Decimal("0.01"))),
        }

        from apps.kuaicaiwu.services.finance_list_core import filter_sort_paginate_prepayment_balance_items

        pt = (partner_type or "").strip().lower()
        if pt in ("customer", "supplier"):
            source = customer_balances if pt == "customer" else supplier_balances
            items, total = filter_sort_paginate_prepayment_balance_items(
                source,
                keyword=keyword,
                partner_name=partner_name,
                sort_field=sort_field,
                sort_order=sort_order,
                skip=skip,
                limit=limit,
            )
            return {
                **totals,
                "partner_type": pt,
                "items": items,
                "total": total,
            }

        return {
            "customer_balances": customer_balances,
            "supplier_balances": supplier_balances,
            **totals,
        }

    async def reconcile_document(
        self,
        tenant_id: int,
        document_type: str,
        document_id: int,
    ) -> Dict[str, Any]:
        """获取单据关联树并标注业财节点与金额缺口。"""
        svc = DocumentRelationService()
        trace = await svc.trace_document_chain(
            tenant_id=tenant_id,
            document_type=document_type,
            document_id=document_id,
            direction="both",
        )

        nodes: List[Dict[str, Any]] = []
        for key in ("upstream_chain", "downstream_chain"):
            raw = trace.get(key)
            if isinstance(raw, list):
                nodes.extend(raw)

        finance_nodes = [
            n for n in nodes
            if str(n.get("document_type") or "").lower() in self.FINANCE_DOC_TYPES
        ]

        return {
            "document_type": document_type,
            "document_id": document_id,
            "trace": trace,
            "finance_related_count": len(finance_nodes),
            "finance_nodes": finance_nodes,
            "is_balanced_hint": len(finance_nodes) > 0,
        }

    async def list_open_finance_gaps(
        self,
        tenant_id: int,
        *,
        partner_type: str,
        partner_id: int,
        start_date: date,
        end_date: date,
        only_gaps: bool = True,
        keyword: Optional[str] = None,
        doc_type: Optional[str] = None,
        doc_code: Optional[str] = None,
        sort_field: Optional[str] = None,
        sort_order: Optional[str] = None,
        skip: int = 0,
        limit: int = 20,
    ) -> Dict[str, Any]:
        """
        按往来单位列出期间内源业务单据与财务单据关联摘要。
        用于对账工作台快速定位未关联/未核销节点。
        """
        from apps.kuaicaiwu.models.receivable import Receivable
        from apps.kuaicaiwu.models.payable import Payable
        from apps.kuaicaiwu.models.receipt import Receipt
        from apps.kuaicaiwu.models.payment import Payment

        items: List[Dict[str, Any]] = []
        if partner_type.lower() in ("customer", "客户"):
            await self._append_source_doc_finance_gaps(
                tenant_id,
                partner_type=partner_type,
                partner_id=partner_id,
                start_date=start_date,
                end_date=end_date,
                items=items,
            )
            receivables = await Receivable.filter(
                tenant_id=tenant_id,
                customer_id=partner_id,
                business_date__gte=start_date,
                business_date__lte=end_date,
                deleted_at__isnull=True,
            ).all()
            for row in receivables:
                rel = await self.reconcile_document(tenant_id, "receivable", row.id)
                items.append(
                    self._aggregation.enrich_gap_item(
                        doc_type="receivable",
                        total_amount=Decimal(str(row.total_amount or 0)),
                        settled_amount=Decimal(str(row.received_amount or 0)),
                        remaining_amount=Decimal(str(row.remaining_amount or 0)),
                        finance_related_count=int(rel["finance_related_count"]),
                        base={
                            "doc_type": "receivable",
                            "doc_id": row.id,
                            "doc_code": row.receivable_code,
                            "amount": float(row.total_amount or 0),
                            "remaining_amount": float(row.remaining_amount or 0),
                            "finance_related_count": rel["finance_related_count"],
                        },
                    )
                )
            receipts = await Receipt.filter(
                tenant_id=tenant_id,
                customer_id=partner_id,
                receipt_date__gte=start_date,
                receipt_date__lte=end_date,
                deleted_at__isnull=True,
            ).all()
            for row in receipts:
                rel = await self.reconcile_document(tenant_id, "receipt", row.id)
                unsettled = Decimal(str(row.unsettled_amount or 0))
                items.append(
                    self._aggregation.enrich_gap_item(
                        doc_type="receipt",
                        total_amount=Decimal(str(row.total_amount or 0)),
                        settled_amount=Decimal(str(row.settled_amount or 0)),
                        remaining_amount=unsettled,
                        finance_related_count=int(rel["finance_related_count"]),
                        base={
                            "doc_type": "receipt",
                            "doc_id": row.id,
                            "doc_code": row.receipt_code,
                            "amount": float(row.total_amount or 0),
                            "unsettled_amount": float(unsettled),
                            "settlement_type": getattr(row, "settlement_type", "normal"),
                            "finance_related_count": rel["finance_related_count"],
                        },
                    )
                )
        else:
            await self._append_source_doc_finance_gaps(
                tenant_id,
                partner_type=partner_type,
                partner_id=partner_id,
                start_date=start_date,
                end_date=end_date,
                items=items,
            )
            payables = await Payable.filter(
                tenant_id=tenant_id,
                supplier_id=partner_id,
                business_date__gte=start_date,
                business_date__lte=end_date,
                deleted_at__isnull=True,
            ).all()
            for row in payables:
                rel = await self.reconcile_document(tenant_id, "payable", row.id)
                items.append(
                    self._aggregation.enrich_gap_item(
                        doc_type="payable",
                        total_amount=Decimal(str(row.total_amount or 0)),
                        settled_amount=Decimal(str(row.paid_amount or 0)),
                        remaining_amount=Decimal(str(row.remaining_amount or 0)),
                        finance_related_count=int(rel["finance_related_count"]),
                        base={
                            "doc_type": "payable",
                            "doc_id": row.id,
                            "doc_code": row.payable_code,
                            "amount": float(row.total_amount or 0),
                            "remaining_amount": float(row.remaining_amount or 0),
                            "finance_related_count": rel["finance_related_count"],
                        },
                    )
                )
            payments = await Payment.filter(
                tenant_id=tenant_id,
                supplier_id=partner_id,
                payment_date__gte=start_date,
                payment_date__lte=end_date,
                deleted_at__isnull=True,
            ).all()
            for row in payments:
                rel = await self.reconcile_document(tenant_id, "payment", row.id)
                unsettled = Decimal(str(row.unsettled_amount or 0))
                items.append(
                    self._aggregation.enrich_gap_item(
                        doc_type="payment",
                        total_amount=Decimal(str(row.total_amount or 0)),
                        settled_amount=Decimal(str(row.settled_amount or 0)),
                        remaining_amount=unsettled,
                        finance_related_count=int(rel["finance_related_count"]),
                        base={
                            "doc_type": "payment",
                            "doc_id": row.id,
                            "doc_code": row.payment_code,
                            "amount": float(row.total_amount or 0),
                            "unsettled_amount": float(unsettled),
                            "settlement_type": getattr(row, "settlement_type", "normal"),
                            "finance_related_count": rel["finance_related_count"],
                        },
                    )
                )

        if only_gaps:
            items = [i for i in items if self._is_finance_gap(i)]

        from apps.kuaicaiwu.services.finance_list_core import filter_sort_paginate_finance_gap_items

        open_balance = sum(Decimal(str(i.get("max_push_quantity") or 0)) for i in items)
        gap_count = len(items)
        page_items, total = filter_sort_paginate_finance_gap_items(
            items,
            keyword=keyword,
            doc_type=doc_type,
            doc_code=doc_code,
            sort_field=sort_field,
            sort_order=sort_order,
            skip=skip,
            limit=limit,
        )
        return {
            "partner_type": partner_type,
            "partner_id": partner_id,
            "period": {"start": to_api_isoformat(start_date), "end": to_api_isoformat(end_date)},
            "items": page_items,
            "total": total,
            "gap_count": gap_count,
            "open_balance_total": float(open_balance),
        }

    async def list_chain_document_candidates(
        self,
        tenant_id: int,
        *,
        document_type: str,
        keyword: Optional[str] = None,
        limit: int = 20,
    ) -> Dict[str, Any]:
        """按单据编号模糊搜索链条起始单据，供前端选择（避免手输内码）。"""
        from tortoise.queryset import Q

        dtype = self._normalize_doc_type(document_type)
        kw = str(keyword or "").strip()
        limit = max(1, min(int(limit or 20), 50))

        # document_type -> (model import path attrs handled inline)
        if dtype == "sales_order":
            from apps.kuaizhizao.models.sales_order import SalesOrder

            query = SalesOrder.filter(tenant_id=tenant_id, deleted_at__isnull=True)
            if kw:
                query = query.filter(
                    Q(order_code__icontains=kw) | Q(customer_name__icontains=kw)
                )
            rows = await query.order_by("-id").limit(limit)
            items = [
                {
                    "id": int(r.id),
                    "code": r.order_code,
                    "partner_name": r.customer_name,
                    "label": f"{r.order_code} {r.customer_name}".strip(),
                }
                for r in rows
            ]
        elif dtype == "sales_delivery":
            from apps.kuaizhizao.models.sales_delivery import SalesDelivery

            query = SalesDelivery.filter(tenant_id=tenant_id, deleted_at__isnull=True)
            if kw:
                query = query.filter(
                    Q(delivery_code__icontains=kw) | Q(customer_name__icontains=kw)
                )
            rows = await query.order_by("-id").limit(limit)
            items = [
                {
                    "id": int(r.id),
                    "code": r.delivery_code,
                    "partner_name": r.customer_name,
                    "label": f"{r.delivery_code} {r.customer_name}".strip(),
                }
                for r in rows
            ]
        elif dtype == "receivable":
            from apps.kuaicaiwu.models.receivable import Receivable

            query = Receivable.filter(tenant_id=tenant_id, deleted_at__isnull=True)
            if kw:
                query = query.filter(
                    Q(receivable_code__icontains=kw) | Q(customer_name__icontains=kw)
                )
            rows = await query.order_by("-id").limit(limit)
            items = [
                {
                    "id": int(r.id),
                    "code": r.receivable_code,
                    "partner_name": r.customer_name,
                    "label": f"{r.receivable_code} {r.customer_name}".strip(),
                }
                for r in rows
            ]
        elif dtype == "receipt":
            from apps.kuaicaiwu.models.receipt import Receipt

            query = Receipt.filter(tenant_id=tenant_id, deleted_at__isnull=True)
            if kw:
                query = query.filter(
                    Q(receipt_code__icontains=kw) | Q(customer_name__icontains=kw)
                )
            rows = await query.order_by("-id").limit(limit)
            items = [
                {
                    "id": int(r.id),
                    "code": r.receipt_code,
                    "partner_name": r.customer_name,
                    "label": f"{r.receipt_code} {r.customer_name}".strip(),
                }
                for r in rows
            ]
        elif dtype == "purchase_order":
            from apps.kuaizhizao.models.purchase_order import PurchaseOrder

            query = PurchaseOrder.filter(tenant_id=tenant_id, deleted_at__isnull=True)
            if kw:
                query = query.filter(
                    Q(order_code__icontains=kw) | Q(supplier_name__icontains=kw)
                )
            rows = await query.order_by("-id").limit(limit)
            items = [
                {
                    "id": int(r.id),
                    "code": r.order_code,
                    "partner_name": r.supplier_name,
                    "label": f"{r.order_code} {r.supplier_name}".strip(),
                }
                for r in rows
            ]
        elif dtype == "purchase_receipt":
            from apps.kuaizhizao.models.purchase_receipt import PurchaseReceipt

            query = PurchaseReceipt.filter(tenant_id=tenant_id, deleted_at__isnull=True)
            if kw:
                query = query.filter(
                    Q(receipt_code__icontains=kw) | Q(supplier_name__icontains=kw)
                )
            rows = await query.order_by("-id").limit(limit)
            items = [
                {
                    "id": int(r.id),
                    "code": r.receipt_code,
                    "partner_name": r.supplier_name,
                    "label": f"{r.receipt_code} {r.supplier_name}".strip(),
                }
                for r in rows
            ]
        elif dtype == "payable":
            from apps.kuaicaiwu.models.payable import Payable

            query = Payable.filter(tenant_id=tenant_id, deleted_at__isnull=True)
            if kw:
                query = query.filter(
                    Q(payable_code__icontains=kw) | Q(supplier_name__icontains=kw)
                )
            rows = await query.order_by("-id").limit(limit)
            items = [
                {
                    "id": int(r.id),
                    "code": r.payable_code,
                    "partner_name": r.supplier_name,
                    "label": f"{r.payable_code} {r.supplier_name}".strip(),
                }
                for r in rows
            ]
        elif dtype == "payment":
            from apps.kuaicaiwu.models.payment import Payment

            query = Payment.filter(tenant_id=tenant_id, deleted_at__isnull=True)
            if kw:
                query = query.filter(
                    Q(payment_code__icontains=kw) | Q(supplier_name__icontains=kw)
                )
            rows = await query.order_by("-id").limit(limit)
            items = [
                {
                    "id": int(r.id),
                    "code": r.payment_code,
                    "partner_name": r.supplier_name,
                    "label": f"{r.payment_code} {r.supplier_name}".strip(),
                }
                for r in rows
            ]
        else:
            from infra.exceptions.exceptions import ValidationError

            raise ValidationError(
                "document_type 仅支持 sales_order/sales_delivery/receivable/receipt/"
                "purchase_order/purchase_receipt/payable/payment"
            )

        return {"items": items, "total": len(items), "document_type": dtype}

    async def get_pipeline_summary(self, tenant_id: int) -> Dict[str, Any]:
        return await self._aggregation.get_pipeline_summary(tenant_id)
