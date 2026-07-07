"""
单据对账服务：基于 document_relation_service 聚合业财单据链路。
"""

from __future__ import annotations

from datetime import date
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

    async def get_prepayment_balances(self, tenant_id: int) -> Dict[str, Any]:
        """预收/预付余额汇总（未核销余额 > 0 且 settlement_type=prepayment）。"""
        from apps.kuaicaiwu.models.receipt import Receipt
        from apps.kuaicaiwu.models.payment import Payment

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
        return {
            "customer_balances": _serialize(customer_map),
            "supplier_balances": _serialize(supplier_map),
            "total_customer_prepayment": float(total_customer.quantize(Decimal("0.01"))),
            "total_supplier_prepayment": float(total_supplier.quantize(Decimal("0.01"))),
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

        open_balance = sum(Decimal(str(i.get("max_push_quantity") or 0)) for i in items)
        return {
            "partner_type": partner_type,
            "partner_id": partner_id,
            "period": {"start": to_api_isoformat(start_date), "end": to_api_isoformat(end_date)},
            "items": items,
            "gap_count": len(items),
            "open_balance_total": float(open_balance),
        }

    async def get_pipeline_summary(self, tenant_id: int) -> Dict[str, Any]:
        return await self._aggregation.get_pipeline_summary(tenant_id)
