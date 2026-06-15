"""
财务协同服务模块

提供财务协同相关的业务逻辑处理。

Author: Luigi Lu
Date: 2025-12-30
"""

import json
import re
from typing import List, Optional, Dict, Any
from datetime import datetime, date
from decimal import Decimal
from tortoise.transactions import in_transaction
from tortoise.functions import Sum
from loguru import logger

from apps.kuaicaiwu.models.payable import Payable
from apps.kuaicaiwu.models.purchase_invoice import PurchaseInvoice
from apps.kuaicaiwu.models.receivable import Receivable
from apps.kuaicaiwu.models.receipt import Receipt
from apps.kuaicaiwu.models.payment import Payment
from apps.kuaicaiwu.models.settlement import SettlementRecord
from apps.kuaicaiwu.models.partner_statement import PartnerStatement
from apps.kuaizhizao.models.purchase_receipt import PurchaseReceipt
from apps.kuaicaiwu.services.accounting_event_service import AccountingEventService

from apps.kuaicaiwu.schemas.finance import (
    PayableCreate, PayableUpdate, PayableResponse, PayableListResponse,
    PurchaseInvoiceCreate, PurchaseInvoiceUpdate, PurchaseInvoiceResponse, PurchaseInvoiceListResponse,
    ReceivableCreate, ReceivableUpdate, ReceivableResponse, ReceivableListResponse,
    PaymentRecordCreate, ReceiptRecordCreate,
)

from apps.common.base_service import AppBaseService
from core.services.logging.operation_log_service import OperationLogService
from infra.exceptions.exceptions import NotFoundError, ValidationError, BusinessLogicError
from infra.services.business_config_service import BusinessConfigService


def _serialize_aging_analysis(analysis: Dict[str, Any]) -> Dict[str, Any]:
    return {
        bucket: {
            "count": data["count"],
            "amount": float(data["amount"]),
        }
        for bucket, data in analysis.items()
    }


class PayableService(AppBaseService[Payable]):
    """应付单服务"""

    def __init__(self):
        super().__init__(Payable)
        self.business_config_service = BusinessConfigService()
        self.accounting_event_service = AccountingEventService()
        self._money_scale = Decimal("0.01")

    def _money(self, value: Decimal) -> Decimal:
        return Decimal(value).quantize(self._money_scale)

    async def _log_payable_amount_audit(
        self,
        *,
        tenant_id: int,
        payable_id: int,
        operator_id: int,
        before_paid: Decimal,
        before_remaining: Decimal,
        after_paid: Decimal,
        after_remaining: Decimal,
        scene: str,
    ) -> None:
        content = json.dumps(
            {
                "scene": scene,
                "before": {
                    "paid_amount": str(before_paid),
                    "remaining_amount": str(before_remaining),
                },
                "after": {
                    "paid_amount": str(after_paid),
                    "remaining_amount": str(after_remaining),
                },
            },
            ensure_ascii=False,
        )
        await OperationLogService.create_operation_log(
            tenant_id=tenant_id,
            user_id=operator_id,
            operation_type="update",
            operation_module="kuaicaiwu/finance/payable",
            operation_object_type="PayableAmountAudit",
            operation_object_id=payable_id,
            operation_content=content,
        )

    async def create_payable(self, tenant_id: int, payable_data: PayableCreate, created_by: int) -> PayableResponse:
        """创建应付单"""
        is_enabled = await self.business_config_service.check_node_enabled(tenant_id, "payable")
        if not is_enabled:
            raise BusinessLogicError("应付账款节点未启用，无法创建应付单")
        existing = await Payable.get_or_none(
            tenant_id=tenant_id,
            source_type=payable_data.source_type,
            source_id=payable_data.source_id,
        )
        if existing:
            return PayableResponse.model_validate(existing)
        async with in_transaction():
            user_info = await self.get_user_info(created_by)
            today = datetime.now().strftime("%Y%m%d")
            code = await self.generate_code(tenant_id, "PAYABLE_CODE", prefix=f"PY{today}")

            payable = await Payable.create(
                tenant_id=tenant_id,
                payable_code=code,
                created_by=created_by,
                **payable_data.model_dump(exclude_unset=True, exclude={'created_by'})
            )
            await self.accounting_event_service.record_event(
                tenant_id=tenant_id,
                event_type="PAYABLE_CREATED",
                business_type="payable",
                target_doc_type="Payable",
                target_doc_id=payable.id,
                target_doc_code=payable.payable_code,
                amount=payable.total_amount,
                currency="CNY",
                operator_id=created_by,
                operator_name=(user_info or {}).get("name"),
                payload={"status": payable.status},
            )
            return PayableResponse.model_validate(payable)

    async def get_payable_by_id(self, tenant_id: int, payable_id: int) -> PayableResponse:
        """根据ID获取应付单"""
        payable = await Payable.get_or_none(tenant_id=tenant_id, id=payable_id)
        if not payable:
            raise NotFoundError(f"应付单不存在: {payable_id}")
        resp = PayableResponse.model_validate(payable)
        from core.services.approval.audit_record_enricher import enrich_record

        return await enrich_record(tenant_id, "payable", resp)

    async def list_payables(self, tenant_id: int, skip: int = 0, limit: int = 20, **filters) -> tuple[List[PayableResponse], int]:
        """获取应付单列表"""
        query = Payable.filter(tenant_id=tenant_id, deleted_at__isnull=True)
        if filters.get('status'):
            query = query.filter(status=filters['status'])
        if filters.get('supplier_id'):
            query = query.filter(supplier_id=filters['supplier_id'])
        if filters.get('due_date_start'):
            query = query.filter(due_date__gte=filters['due_date_start'])
        if filters.get('due_date_end'):
            query = query.filter(due_date__lte=filters['due_date_end'])
        if filters.get('pending_settlement'):
            query = query.filter(remaining_amount__gt=0)

        total = await query.count()
        payables = await query.offset(skip).limit(limit).order_by('-created_at')
        from core.services.approval.audit_record_enricher import enrich_items

        rows = [PayableResponse.model_validate(payable) for payable in payables]
        return await enrich_items(tenant_id, "payable", rows), total

    async def update_payable(self, tenant_id: int, payable_id: int, payable_data: PayableUpdate, updated_by: int) -> PayableResponse:
        """更新应付单"""
        async with in_transaction():
            await self.get_payable_by_id(tenant_id, payable_id)
            update_data = payable_data.model_dump(exclude_unset=True, exclude={'updated_by'})
            update_data['updated_by'] = updated_by
            await Payable.filter(tenant_id=tenant_id, id=payable_id).update(**update_data)
            return await self.get_payable_by_id(tenant_id, payable_id)

    async def record_payment(self, tenant_id: int, payable_id: int, payment_data: PaymentRecordCreate, recorded_by: int) -> PayableResponse:
        """登记付款：创建付款单并核销至当前应付单"""
        async with in_transaction():
            payable = await self.get_payable_by_id(tenant_id, payable_id)
            if payable.status == '已结清':
                raise BusinessLogicError("应付单已结清，无法继续付款")
            payment_amount = self._money(payment_data.payment_amount)
            if payment_amount > payable.remaining_amount:
                raise ValidationError("付款金额不能超过剩余金额")

            today = datetime.now().strftime("%Y%m%d")
            count = await Payment.filter(tenant_id=tenant_id).count()
            code = f"PK{today}{count + 1:04d}"

            note_parts: list[str] = []
            if payment_data.notes:
                note_parts.append(payment_data.notes.strip())
            note_parts.append(f"应付单 {payable.payable_code}")
            notes = " · ".join(note_parts)

            payment = await Payment.create(
                tenant_id=tenant_id,
                payment_code=code,
                supplier_id=payable.supplier_id,
                supplier_name=payable.supplier_name,
                total_amount=payment_amount,
                settled_amount=Decimal("0.00"),
                unsettled_amount=payment_amount,
                payment_date=payment_data.payment_date,
                payment_method=payment_data.payment_method,
                bank_account=payment_data.reference_number,
                status="Draft",
                notes=notes,
                created_by=recorded_by,
            )

            settlement_service = AccountSettlementService()
            await settlement_service.settle_payable(
                tenant_id,
                payable_id,
                payment.id,
                payment_amount,
                recorded_by,
            )

            return await self.get_payable_by_id(tenant_id, payable_id)

    async def approve_payable(self, tenant_id: int, payable_id: int, approved_by: int, rejection_reason: Optional[str] = None) -> PayableResponse:
        """审核应付单"""
        async with in_transaction():
            payable = await self.get_payable_by_id(tenant_id, payable_id)
            if payable.review_status != '待审核':
                raise BusinessLogicError("应付单审核状态不是待审核")
            approver_name = await self.get_user_name(approved_by)
            review_status = "驳回" if rejection_reason else "通过"
            await Payable.filter(tenant_id=tenant_id, id=payable_id).update(
                reviewer_id=approved_by,
                reviewer_name=approver_name,
                review_time=datetime.now(),
                review_status=review_status,
                review_remarks=rejection_reason,
                updated_by=approved_by
            )
            return await self.get_payable_by_id(tenant_id, payable_id)

    async def get_payable_aging_analysis(self, tenant_id: int) -> Dict[str, Any]:
        """获取应付账龄分析"""
        payables = await Payable.filter(tenant_id=tenant_id, remaining_amount__gt=0, deleted_at__isnull=True).all()
        now = datetime.now().date()
        
        analysis = {
            "within_30": {"count": 0, "amount": Decimal("0.00")},
            "31_60": {"count": 0, "amount": Decimal("0.00")},
            "61_90": {"count": 0, "amount": Decimal("0.00")},
            "over_90": {"count": 0, "amount": Decimal("0.00")},
            "total": {"count": 0, "amount": Decimal("0.00")}
        }
        
        for p in payables:
            days = (now - p.due_date).days if p.due_date else 0
            analysis["total"]["count"] += 1
            analysis["total"]["amount"] = self._money(analysis["total"]["amount"] + p.remaining_amount)
            
            if days <= 30:
                key = "within_30"
            elif days <= 60:
                key = "31_60"
            elif days <= 90:
                key = "61_90"
            else:
                key = "over_90"
                
            analysis[key]["count"] += 1
            analysis[key]["amount"] = self._money(analysis[key]["amount"] + p.remaining_amount)
            
        return _serialize_aging_analysis(analysis)

    async def get_payable_statistics(self, tenant_id: int) -> Dict[str, Any]:
        """应付单列表页指标"""
        today = date.today()
        base = Payable.filter(tenant_id=tenant_id, deleted_at__isnull=True)
        totals = await base.aggregate(
            total_amount_sum=Sum("total_amount"),
            paid_amount_sum=Sum("paid_amount"),
            remaining_amount_sum=Sum("remaining_amount"),
        )
        return {
            "total_count": await base.count(),
            "unsettled_count": await base.filter(remaining_amount__gt=0).count(),
            "settled_count": await base.filter(status="已结清").count(),
            "overdue_count": await base.filter(
                remaining_amount__gt=0, due_date__lt=today
            ).count(),
            "total_amount": float(totals.get("total_amount_sum") or 0),
            "paid_amount": float(totals.get("paid_amount_sum") or 0),
            "remaining_amount": float(totals.get("remaining_amount_sum") or 0),
        }

    async def delete_payable(self, tenant_id: int, payable_id: int) -> None:
        """删除应付单"""
        payable = await self.get_payable_by_id(tenant_id, payable_id)
        if str(payable.review_status or '') in ('已审核', '通过'):
            raise BusinessLogicError("已审核的应付单不能删除")
        if payable.paid_amount > 0:
            raise BusinessLogicError("已有付款记录的应付单不能删除")
        await Payable.filter(tenant_id=tenant_id, id=payable_id).delete()


class PurchaseInvoiceService(AppBaseService[PurchaseInvoice]):
    """采购发票服务"""

    def __init__(self):
        super().__init__(PurchaseInvoice)
        self.accounting_event_service = AccountingEventService()
        self.business_config_service = BusinessConfigService()
        self._money_scale = Decimal("0.01")

    def _money(self, value: Decimal) -> Decimal:
        return Decimal(value).quantize(self._money_scale)

    async def _validate_purchase_invoice_amount_gate(
        self,
        tenant_id: int,
        invoice_data: PurchaseInvoiceCreate,
    ) -> None:
        """
        三单匹配硬门禁（金额口径最小实现）：
        新增发票总额不得超过“累计入库金额 - 已开票金额”。
        """
        if not invoice_data.purchase_order_id:
            return

        receipts = await PurchaseReceipt.filter(
            tenant_id=tenant_id,
            purchase_order_id=invoice_data.purchase_order_id,
            deleted_at__isnull=True,
        ).all()
        received_total = sum((self._money(r.total_amount or Decimal("0.00")) for r in receipts), Decimal("0.00"))

        invoices = await PurchaseInvoice.filter(
            tenant_id=tenant_id,
            purchase_order_id=invoice_data.purchase_order_id,
            deleted_at__isnull=True,
        ).all()
        invoiced_total = sum((self._money(i.total_amount or Decimal("0.00")) for i in invoices), Decimal("0.00"))

        requested_total = self._money(invoice_data.total_amount)
        available_total = self._money(received_total - invoiced_total)

        if requested_total > available_total:
            raise ValidationError(
                f"发票价税合计 {requested_total} 超过可开票金额 {available_total}（按入库累计金额硬门禁）"
            )

    async def create_purchase_invoice(self, tenant_id: int, invoice_data: PurchaseInvoiceCreate, created_by: int) -> PurchaseInvoiceResponse:
        """创建采购发票"""
        async with in_transaction():
            await self._validate_purchase_invoice_amount_gate(tenant_id=tenant_id, invoice_data=invoice_data)
            user_info = await self.get_user_info(created_by)
            today = datetime.now().strftime("%Y%m%d")
            code = await self.generate_code(tenant_id, "PURCHASE_INVOICE_CODE", prefix=f"PI{today}")

            invoice = await PurchaseInvoice.create(
                tenant_id=tenant_id,
                invoice_code=code,
                created_by=created_by,
                **invoice_data.model_dump(exclude_unset=True, exclude={'created_by'})
            )
            await self.accounting_event_service.record_event(
                tenant_id=tenant_id,
                event_type="PURCHASE_INVOICE_CREATED",
                business_type="purchase_invoice",
                target_doc_type="PurchaseInvoice",
                target_doc_id=invoice.id,
                target_doc_code=invoice.invoice_code,
                amount=invoice.total_amount,
                currency="CNY",
                operator_id=created_by,
                source_doc_type="PurchaseOrder" if invoice_data.purchase_order_id else None,
                source_doc_id=invoice_data.purchase_order_id,
                payload={"status": invoice.status},
            )
            await self._maybe_auto_generate_payable_for_purchase_invoice(
                tenant_id=tenant_id,
                invoice=invoice,
                created_by=created_by,
            )
            return PurchaseInvoiceResponse.model_validate(invoice)

    async def _maybe_auto_generate_payable_for_purchase_invoice(
        self,
        *,
        tenant_id: int,
        invoice: PurchaseInvoice,
        created_by: int,
    ) -> None:
        if invoice.payable_id:
            return
        _sup_id = getattr(invoice, "supplier_id", None)
        if not await self.business_config_service.should_auto_generate_payable_from_purchase_invoice_effective(
            tenant_id, int(_sup_id) if _sup_id is not None else None
        ):
            return
        if not await self.business_config_service.check_node_enabled(tenant_id, "payable"):
            return

        payable_service = PayableService()
        payable = await payable_service.create_payable(
            tenant_id=tenant_id,
            payable_data=PayableCreate(
                source_type="PurchaseInvoice",
                source_id=invoice.id,
                source_code=invoice.invoice_code,
                supplier_id=invoice.supplier_id,
                supplier_name=invoice.supplier_name,
                total_amount=self._money(invoice.total_amount or Decimal("0.00")),
                paid_amount=Decimal("0.00"),
                remaining_amount=self._money(invoice.total_amount or Decimal("0.00")),
                due_date=invoice.invoice_date,
                business_date=invoice.invoice_date,
                status="未付款",
                invoice_received=True,
                invoice_number=invoice.invoice_number,
            ),
            created_by=created_by,
        )
        await PurchaseInvoice.filter(tenant_id=tenant_id, id=invoice.id).update(
            payable_id=payable.id,
            payable_code=payable.payable_code,
        )
        invoice.payable_id = payable.id
        invoice.payable_code = payable.payable_code
        try:
            from apps.kuaizhizao.services.document_relation_new_service import DocumentRelationNewService
            from apps.kuaizhizao.schemas.document_relation import DocumentRelationCreate

            rel_svc = DocumentRelationNewService()
            await rel_svc.create_relation(
                tenant_id=tenant_id,
                relation_data=DocumentRelationCreate(
                    source_type="purchase_invoice",
                    source_id=invoice.id,
                    source_code=invoice.invoice_code,
                    source_name=None,
                    target_type="payable",
                    target_id=payable.id,
                    target_code=payable.payable_code,
                    target_name=None,
                    relation_type="source",
                    relation_mode="push",
                    relation_desc="采购发票自动生成应付单",
                ),
                created_by=created_by,
            )
        except Exception as rel_e:
            logger.warning("创建采购发票→应付单 单据关联失败: {}", rel_e)

    async def get_purchase_invoice_by_id(self, tenant_id: int, invoice_id: int) -> PurchaseInvoiceResponse:
        """根据ID获取采购发票"""
        invoice = await PurchaseInvoice.get_or_none(tenant_id=tenant_id, id=invoice_id)
        if not invoice:
            raise NotFoundError(f"采购发票不存在: {invoice_id}")
        resp = PurchaseInvoiceResponse.model_validate(invoice)
        from core.services.approval.audit_record_enricher import enrich_record

        return await enrich_record(tenant_id, "purchase_invoice", resp)

    async def list_purchase_invoices(self, tenant_id: int, skip: int = 0, limit: int = 20, **filters) -> List[PurchaseInvoiceResponse]:
        """获取采购发票列表"""
        query = PurchaseInvoice.filter(tenant_id=tenant_id)
        if filters.get('status'):
            query = query.filter(status=filters['status'])
        if filters.get('supplier_id'):
            query = query.filter(supplier_id=filters['supplier_id'])
        if filters.get('purchase_order_id'):
            query = query.filter(purchase_order_id=filters['purchase_order_id'])

        invoices = await query.offset(skip).limit(limit).order_by('-created_at')
        from core.services.approval.audit_record_enricher import enrich_items

        rows = [PurchaseInvoiceResponse.model_validate(invoice) for invoice in invoices]
        return await enrich_items(tenant_id, "purchase_invoice", rows)

    async def approve_invoice(self, tenant_id: int, invoice_id: int, approved_by: int, rejection_reason: Optional[str] = None) -> PurchaseInvoiceResponse:
        """审核采购发票"""
        async with in_transaction():
            invoice = await self.get_purchase_invoice_by_id(tenant_id, invoice_id)
            if invoice.review_status != '待审核':
                raise BusinessLogicError("发票审核状态不是待审核")
            approver_name = await self.get_user_name(approved_by)
            review_status = "驳回" if rejection_reason else "通过"
            status = "已驳回" if rejection_reason else "已审核"

            await PurchaseInvoice.filter(tenant_id=tenant_id, id=invoice_id).update(
                reviewer_id=approved_by,
                reviewer_name=approver_name,
                review_time=datetime.now(),
                review_status=review_status,
                review_remarks=rejection_reason,
                status=status,
                updated_by=approved_by
            )

            if not rejection_reason and invoice.payable_id:
                await Payable.filter(tenant_id=tenant_id, id=invoice.payable_id).update(
                    invoice_received=True,
                    invoice_number=invoice.invoice_number,
                    updated_by=approved_by
                )

            return await self.get_purchase_invoice_by_id(tenant_id, invoice_id)


class ReceivableService(AppBaseService[Receivable]):
    """应收单服务"""

    def __init__(self):
        super().__init__(Receivable)
        self.business_config_service = BusinessConfigService()
        self.accounting_event_service = AccountingEventService()
        self._money_scale = Decimal("0.01")

    def _money(self, value: Decimal) -> Decimal:
        return Decimal(value).quantize(self._money_scale)

    async def _log_receivable_amount_audit(
        self,
        *,
        tenant_id: int,
        receivable_id: int,
        operator_id: int,
        before_received: Decimal,
        before_remaining: Decimal,
        after_received: Decimal,
        after_remaining: Decimal,
        scene: str,
    ) -> None:
        content = json.dumps(
            {
                "scene": scene,
                "before": {
                    "received_amount": str(before_received),
                    "remaining_amount": str(before_remaining),
                },
                "after": {
                    "received_amount": str(after_received),
                    "remaining_amount": str(after_remaining),
                },
            },
            ensure_ascii=False,
        )
        await OperationLogService.create_operation_log(
            tenant_id=tenant_id,
            user_id=operator_id,
            operation_type="update",
            operation_module="kuaicaiwu/finance/receivable",
            operation_object_type="ReceivableAmountAudit",
            operation_object_id=receivable_id,
            operation_content=content,
        )

    async def create_receivable(self, tenant_id: int, receivable_data: ReceivableCreate, created_by: int) -> ReceivableResponse:
        """创建应收单"""
        is_enabled = await self.business_config_service.check_node_enabled(tenant_id, "receivable")
        if not is_enabled:
            raise BusinessLogicError("应收账款节点未启用，无法创建应收单")
        existing = await Receivable.get_or_none(
            tenant_id=tenant_id,
            source_type=receivable_data.source_type,
            source_id=receivable_data.source_id,
        )
        if existing:
            return ReceivableResponse.model_validate(existing)
        async with in_transaction():
            user_info = await self.get_user_info(created_by)
            today = datetime.now().strftime("%Y%m%d")
            code = await self.generate_code(tenant_id, "RECEIVABLE_CODE", prefix=f"YS{today}")

            receivable = await Receivable.create(
                tenant_id=tenant_id,
                receivable_code=code,
                created_by=created_by,
                **receivable_data.model_dump(exclude_unset=True, exclude={'created_by'})
            )
            await self.accounting_event_service.record_event(
                tenant_id=tenant_id,
                event_type="RECEIVABLE_CREATED",
                business_type="receivable",
                target_doc_type="Receivable",
                target_doc_id=receivable.id,
                target_doc_code=receivable.receivable_code,
                amount=receivable.total_amount,
                currency="CNY",
                operator_id=created_by,
                operator_name=(user_info or {}).get("name"),
                payload={"status": receivable.status},
            )
            return ReceivableResponse.model_validate(receivable)

    async def get_receivable_by_id(self, tenant_id: int, receivable_id: int) -> ReceivableResponse:
        """根据ID获取应收单"""
        receivable = await Receivable.get_or_none(tenant_id=tenant_id, id=receivable_id)
        if not receivable:
            raise NotFoundError(f"应收单不存在: {receivable_id}")
        resp = ReceivableResponse.model_validate(receivable)
        from core.services.approval.audit_record_enricher import enrich_record

        return await enrich_record(tenant_id, "receivable", resp)

    async def list_receivables(self, tenant_id: int, skip: int = 0, limit: int = 20, **filters) -> tuple[List[ReceivableResponse], int]:
        """获取应收单列表"""
        query = Receivable.filter(tenant_id=tenant_id, deleted_at__isnull=True)
        if filters.get('status'):
            query = query.filter(status=filters['status'])
        if filters.get('customer_id'):
            query = query.filter(customer_id=filters['customer_id'])
        if filters.get('due_date_start'):
            query = query.filter(due_date__gte=filters['due_date_start'])
        if filters.get('due_date_end'):
            query = query.filter(due_date__lte=filters['due_date_end'])
        if filters.get('pending_settlement'):
            query = query.filter(remaining_amount__gt=0)

        total = await query.count()
        receivables = await query.offset(skip).limit(limit).order_by('-created_at')
        from core.services.approval.audit_record_enricher import enrich_items

        rows = [ReceivableResponse.model_validate(receivable) for receivable in receivables]
        return await enrich_items(tenant_id, "receivable", rows), total

    async def record_receipt(self, tenant_id: int, receivable_id: int, receipt_data: ReceiptRecordCreate, recorded_by: int) -> ReceivableResponse:
        """登记收款：创建收款单并核销至当前应收单"""
        async with in_transaction():
            receivable = await self.get_receivable_by_id(tenant_id, receivable_id)
            if receivable.status == '已结清':
                raise BusinessLogicError("应收单已结清，无法继续收款")
            receipt_amount = self._money(receipt_data.receipt_amount)
            if receipt_amount > receivable.remaining_amount:
                raise ValidationError("收款金额不能超过剩余金额")

            today = datetime.now().strftime("%Y%m%d")
            count = await Receipt.filter(tenant_id=tenant_id).count()
            code = f"SK{today}{count + 1:04d}"

            note_parts: list[str] = []
            if receipt_data.notes:
                note_parts.append(receipt_data.notes.strip())
            note_parts.append(f"应收单 {receivable.receivable_code}")
            notes = " · ".join(note_parts)

            receipt = await Receipt.create(
                tenant_id=tenant_id,
                receipt_code=code,
                customer_id=receivable.customer_id,
                customer_name=receivable.customer_name,
                total_amount=receipt_amount,
                settled_amount=Decimal("0.00"),
                unsettled_amount=receipt_amount,
                receipt_date=receipt_data.receipt_date,
                payment_method=receipt_data.receipt_method,
                bank_account=receipt_data.reference_number,
                status="Draft",
                notes=notes,
                created_by=recorded_by,
            )

            settlement_service = AccountSettlementService()
            await settlement_service.settle_receivable(
                tenant_id,
                receivable_id,
                receipt.id,
                receipt_amount,
                recorded_by,
            )

            return await self.get_receivable_by_id(tenant_id, receivable_id)

    async def approve_receivable(self, tenant_id: int, receivable_id: int, approved_by: int, rejection_reason: Optional[str] = None) -> ReceivableResponse:
        """审核应收单"""
        async with in_transaction():
            receivable = await self.get_receivable_by_id(tenant_id, receivable_id)
            if receivable.review_status != '待审核':
                raise BusinessLogicError("应收单审核状态不是待审核")
            approver_name = await self.get_user_name(approved_by)
            review_status = "驳回" if rejection_reason else "通过"
            await Receivable.filter(tenant_id=tenant_id, id=receivable_id).update(
                reviewer_id=approved_by,
                reviewer_name=approver_name,
                review_time=datetime.now(),
                review_status=review_status,
                review_remarks=rejection_reason,
                updated_by=approved_by
            )
            return await self.get_receivable_by_id(tenant_id, receivable_id)

    async def get_receivable_aging_analysis(self, tenant_id: int) -> Dict[str, Any]:
        """获取应收账龄分析"""
        receivables = await Receivable.filter(tenant_id=tenant_id, remaining_amount__gt=0, deleted_at__isnull=True).all()
        now = datetime.now().date()
        
        analysis = {
            "within_30": {"count": 0, "amount": Decimal("0.00")},
            "31_60": {"count": 0, "amount": Decimal("0.00")},
            "61_90": {"count": 0, "amount": Decimal("0.00")},
            "over_90": {"count": 0, "amount": Decimal("0.00")},
            "total": {"count": 0, "amount": Decimal("0.00")}
        }
        
        for r in receivables:
            days = (now - r.due_date).days if r.due_date else 0
            analysis["total"]["count"] += 1
            analysis["total"]["amount"] = self._money(analysis["total"]["amount"] + r.remaining_amount)
            
            if days <= 30:
                key = "within_30"
            elif days <= 60:
                key = "31_60"
            elif days <= 90:
                key = "61_90"
            else:
                key = "over_90"
                
            analysis[key]["count"] += 1
            analysis[key]["amount"] = self._money(analysis[key]["amount"] + r.remaining_amount)
            
        return _serialize_aging_analysis(analysis)

    async def get_receivable_statistics(self, tenant_id: int) -> Dict[str, Any]:
        """应收单列表页指标"""
        today = date.today()
        base = Receivable.filter(tenant_id=tenant_id, deleted_at__isnull=True)
        totals = await base.aggregate(
            total_amount_sum=Sum("total_amount"),
            received_amount_sum=Sum("received_amount"),
            remaining_amount_sum=Sum("remaining_amount"),
        )
        return {
            "total_count": await base.count(),
            "unsettled_count": await base.filter(remaining_amount__gt=0).count(),
            "settled_count": await base.filter(status="已结清").count(),
            "overdue_count": await base.filter(
                remaining_amount__gt=0, due_date__lt=today
            ).count(),
            "total_amount": float(totals.get("total_amount_sum") or 0),
            "received_amount": float(totals.get("received_amount_sum") or 0),
            "remaining_amount": float(totals.get("remaining_amount_sum") or 0),
        }

    async def delete_receivable(self, tenant_id: int, receivable_id: int) -> None:
        """删除应收单"""
        receivable = await self.get_receivable_by_id(tenant_id, receivable_id)
        if str(receivable.review_status or '') in ('已审核', '通过'):
            raise BusinessLogicError("已审核的应收单不能删除")
        if receivable.received_amount > 0:
            raise BusinessLogicError("已有收款记录的应收单不能删除")
        await Receivable.filter(tenant_id=tenant_id, id=receivable_id).delete()


class AccountSettlementService(AppBaseService[SettlementRecord]):
    """往来核销与对账服务"""

    def __init__(self):
        super().__init__(SettlementRecord)
        self.accounting_event_service = AccountingEventService()
        self.business_config_service = BusinessConfigService()
        self._money_scale = Decimal("0.01")

    def _money(self, value: Decimal) -> Decimal:
        return Decimal(value).quantize(self._money_scale)

    @staticmethod
    def _extract_ref_tokens(value: Optional[str]) -> set[str]:
        if not value:
            return set()
        return {
            token
            for token in re.split(r"[^A-Za-z0-9]+", value.upper())
            if len(token) >= 4
        }

    def _build_match_score(
        self,
        *,
        debit_amount: Decimal,
        credit_amount: Decimal,
        debit_date: Optional[date],
        credit_date: Optional[date],
        debit_ref: Optional[str],
        credit_ref: Optional[str],
        tolerance: Decimal,
    ) -> Dict[str, Any]:
        amount_gap = self._money(abs(self._money(debit_amount) - self._money(credit_amount)))
        score = 0
        reasons: List[str] = []

        if amount_gap == Decimal("0.00"):
            score += 60
            reasons.append("exact_amount")
        elif amount_gap <= tolerance:
            score += 45
            reasons.append("within_tolerance")
        elif amount_gap <= self._money(tolerance * Decimal("2")):
            score += 25
            reasons.append("near_tolerance")

        ref_overlap = self._extract_ref_tokens(debit_ref) & self._extract_ref_tokens(credit_ref)
        if ref_overlap:
            score += min(25, len(ref_overlap) * 5)
            reasons.append("ref_overlap")

        date_gap_days: Optional[int] = None
        if debit_date and credit_date:
            date_gap_days = abs((debit_date - credit_date).days)
            if date_gap_days <= 3:
                score += 15
                reasons.append("date_close")
            elif date_gap_days <= 15:
                score += 8
                reasons.append("date_near")

        return {
            "score": min(score, 100),
            "amount_gap": amount_gap,
            "ref_overlap_tokens": sorted(list(ref_overlap))[:5],
            "date_gap_days": date_gap_days,
            "reasons": reasons,
        }

    def _apply_rounding_writeoff_value(
        self,
        *,
        value: Decimal,
        limit: Decimal,
    ) -> tuple[Decimal, bool]:
        current = self._money(value)
        max_limit = self._money(limit)
        if max_limit <= Decimal("0.00"):
            return current, False
        if abs(current) <= max_limit:
            return Decimal("0.00"), True
        return current, False

    def _build_fx_snapshot(
        self,
        *,
        amount: Decimal,
        invoice_exchange_rate: Optional[Decimal],
        payment_exchange_rate: Optional[Decimal],
        business_type: str,
        currency: str,
    ) -> Optional[Dict[str, Any]]:
        if invoice_exchange_rate is None or payment_exchange_rate is None:
            return None
        inv_rate = self._money(invoice_exchange_rate)
        pay_rate = self._money(payment_exchange_rate)
        delta = self._money((pay_rate - inv_rate) * amount)

        # 应收：付款日汇率高 -> 汇兑收益；应付相反
        signed_delta = delta if business_type == "receivable" else self._money(-delta)
        fx_gain = signed_delta if signed_delta > Decimal("0.00") else Decimal("0.00")
        fx_loss = self._money(-signed_delta) if signed_delta < Decimal("0.00") else Decimal("0.00")
        result = "gain" if fx_gain > Decimal("0.00") else "loss" if fx_loss > Decimal("0.00") else "none"
        return {
            "currency": currency,
            "invoice_exchange_rate": str(inv_rate),
            "payment_exchange_rate": str(pay_rate),
            "raw_delta_local": str(delta),
            "signed_delta_local": str(signed_delta),
            "fx_gain": str(fx_gain),
            "fx_loss": str(fx_loss),
            "result": result,
        }

    def _build_period_end_fx_delta(
        self,
        *,
        amount: Decimal,
        book_rate: Decimal,
        period_end_rate: Decimal,
        business_type: str,
    ) -> Dict[str, Decimal]:
        base_delta = self._money((self._money(period_end_rate) - self._money(book_rate)) * self._money(amount))
        # 应收：期末汇率上升为收益；应付相反
        signed_delta = base_delta if business_type == "receivable" else self._money(-base_delta)
        fx_gain = signed_delta if signed_delta > Decimal("0.00") else Decimal("0.00")
        fx_loss = self._money(-signed_delta) if signed_delta < Decimal("0.00") else Decimal("0.00")
        return {
            "raw_delta_local": base_delta,
            "signed_delta_local": signed_delta,
            "fx_gain": fx_gain,
            "fx_loss": fx_loss,
        }

    async def revaluate_period_end(
        self,
        tenant_id: int,
        operator_id: int,
        period: str,
        currency: str,
        book_rate: Decimal,
        period_end_rate: Decimal,
        doc_type: str = "all",
    ) -> Dict[str, Any]:
        """期末调汇：对未结清外币余额生成汇兑损益快照与凭证候选明细。"""
        book_rate = self._money(book_rate)
        period_end_rate = self._money(period_end_rate)
        if book_rate <= Decimal("0.00") or period_end_rate <= Decimal("0.00"):
            raise ValidationError("汇率必须大于0")

        include_receivable = doc_type in {"all", "receivable"}
        include_payable = doc_type in {"all", "payable"}

        lines: List[Dict[str, Any]] = []
        voucher_code = f"RV-{period.replace('-', '')}-{currency}"

        if include_receivable:
            receivables = await Receivable.filter(
                tenant_id=tenant_id,
                remaining_amount__gt=0,
                deleted_at__isnull=True,
            ).all()
            for row in receivables:
                amount = self._money(row.remaining_amount or Decimal("0.00"))
                delta = self._build_period_end_fx_delta(
                    amount=amount,
                    book_rate=book_rate,
                    period_end_rate=period_end_rate,
                    business_type="receivable",
                )
                if delta["signed_delta_local"] == Decimal("0.00"):
                    continue
                payload = {
                    "period": period,
                    "currency": currency,
                    "book_rate": str(book_rate),
                    "period_end_rate": str(period_end_rate),
                    "remaining_amount": str(amount),
                    "doc_type": "Receivable",
                    "fx_gain": str(delta["fx_gain"]),
                    "fx_loss": str(delta["fx_loss"]),
                }
                await self.accounting_event_service.record_event(
                    tenant_id=tenant_id,
                    event_type="FX_REVALUATION_PERIOD_END",
                    business_type="fx_revaluation",
                    source_doc_type="Receivable",
                    source_doc_id=row.id,
                    source_doc_code=row.receivable_code,
                    target_doc_type="RevaluationVoucher",
                    target_doc_code=voucher_code,
                    amount=amount,
                    currency=currency,
                    operator_id=operator_id,
                    payload=payload,
                )
                lines.append(
                    {
                        "doc_type": "Receivable",
                        "doc_id": row.id,
                        "doc_code": row.receivable_code,
                        "remaining_amount": str(amount),
                        "fx_gain": str(delta["fx_gain"]),
                        "fx_loss": str(delta["fx_loss"]),
                        "signed_delta_local": str(delta["signed_delta_local"]),
                    }
                )

        if include_payable:
            payables = await Payable.filter(
                tenant_id=tenant_id,
                remaining_amount__gt=0,
                deleted_at__isnull=True,
            ).all()
            for row in payables:
                amount = self._money(row.remaining_amount or Decimal("0.00"))
                delta = self._build_period_end_fx_delta(
                    amount=amount,
                    book_rate=book_rate,
                    period_end_rate=period_end_rate,
                    business_type="payable",
                )
                if delta["signed_delta_local"] == Decimal("0.00"):
                    continue
                payload = {
                    "period": period,
                    "currency": currency,
                    "book_rate": str(book_rate),
                    "period_end_rate": str(period_end_rate),
                    "remaining_amount": str(amount),
                    "doc_type": "Payable",
                    "fx_gain": str(delta["fx_gain"]),
                    "fx_loss": str(delta["fx_loss"]),
                }
                await self.accounting_event_service.record_event(
                    tenant_id=tenant_id,
                    event_type="FX_REVALUATION_PERIOD_END",
                    business_type="fx_revaluation",
                    source_doc_type="Payable",
                    source_doc_id=row.id,
                    source_doc_code=row.payable_code,
                    target_doc_type="RevaluationVoucher",
                    target_doc_code=voucher_code,
                    amount=amount,
                    currency=currency,
                    operator_id=operator_id,
                    payload=payload,
                )
                lines.append(
                    {
                        "doc_type": "Payable",
                        "doc_id": row.id,
                        "doc_code": row.payable_code,
                        "remaining_amount": str(amount),
                        "fx_gain": str(delta["fx_gain"]),
                        "fx_loss": str(delta["fx_loss"]),
                        "signed_delta_local": str(delta["signed_delta_local"]),
                    }
                )

        total_gain = sum((Decimal(line["fx_gain"]) for line in lines), Decimal("0.00"))
        total_loss = sum((Decimal(line["fx_loss"]) for line in lines), Decimal("0.00"))
        return {
            "period": period,
            "currency": currency,
            "book_rate": str(book_rate),
            "period_end_rate": str(period_end_rate),
            "voucher_code": voucher_code,
            "line_count": len(lines),
            "total_fx_gain": str(self._money(total_gain)),
            "total_fx_loss": str(self._money(total_loss)),
            "lines": lines,
        }

    async def _log_settlement_amount_audit(
        self,
        *,
        tenant_id: int,
        operator_id: int,
        object_type: str,
        object_id: int,
        scene: str,
        before: Dict[str, Any],
        after: Dict[str, Any],
    ) -> None:
        content = json.dumps(
            {
                "scene": scene,
                "before": {k: str(v) for k, v in before.items()},
                "after": {k: str(v) for k, v in after.items()},
            },
            ensure_ascii=False,
        )
        await OperationLogService.create_operation_log(
            tenant_id=tenant_id,
            user_id=operator_id,
            operation_type="update",
            operation_module=f"kuaicaiwu/finance/{object_type.lower()}",
            operation_object_type=f"{object_type}AmountAudit",
            operation_object_id=object_id,
            operation_content=content,
        )

    async def suggest_receivable_matches(
        self,
        tenant_id: int,
        customer_id: Optional[int] = None,
        limit: int = 50,
    ) -> List[Dict[str, Any]]:
        write_off_limit = self._money(
            Decimal(
                str(await self.business_config_service.get_finance_auto_write_off_precision_limit(tenant_id))
            )
        )
        query_receivables = Receivable.filter(
            tenant_id=tenant_id,
            remaining_amount__gt=0,
            deleted_at__isnull=True,
        )
        query_receipts = Receipt.filter(
            tenant_id=tenant_id,
            unsettled_amount__gt=0,
            deleted_at__isnull=True,
        )
        if customer_id is not None:
            query_receivables = query_receivables.filter(customer_id=customer_id)
            query_receipts = query_receipts.filter(customer_id=customer_id)

        receivables = await query_receivables.order_by("due_date", "id").all()
        receipts = await query_receipts.order_by("receipt_date", "id").all()

        suggestions: List[Dict[str, Any]] = []
        for receivable in receivables:
            for receipt in receipts:
                if receivable.customer_id != receipt.customer_id:
                    continue
                suggested_amount = self._money(min(receivable.remaining_amount, receipt.unsettled_amount))
                if suggested_amount <= Decimal("0.00"):
                    continue
                score_data = self._build_match_score(
                    debit_amount=receivable.remaining_amount,
                    credit_amount=receipt.unsettled_amount,
                    debit_date=receivable.business_date,
                    credit_date=receipt.receipt_date,
                    debit_ref=f"{receivable.source_code or ''} {receivable.invoice_number or ''}",
                    credit_ref=receipt.notes,
                    tolerance=write_off_limit,
                )
                if score_data["score"] < 50:
                    continue
                suggestions.append(
                    {
                        "business_type": "receivable",
                        "customer_id": receivable.customer_id,
                        "customer_name": receivable.customer_name,
                        "receivable_id": receivable.id,
                        "receivable_code": receivable.receivable_code,
                        "receipt_id": receipt.id,
                        "receipt_code": receipt.receipt_code,
                        "receivable_remaining_amount": str(self._money(receivable.remaining_amount)),
                        "receipt_unsettled_amount": str(self._money(receipt.unsettled_amount)),
                        "suggested_settle_amount": str(suggested_amount),
                        "amount_gap": str(score_data["amount_gap"]),
                        "date_gap_days": score_data["date_gap_days"],
                        "confidence_score": score_data["score"],
                        "reasons": score_data["reasons"],
                        "ref_overlap_tokens": score_data["ref_overlap_tokens"],
                    }
                )

        suggestions.sort(
            key=lambda x: (
                -x["confidence_score"],
                Decimal(x["amount_gap"]),
                x["date_gap_days"] if x["date_gap_days"] is not None else 9999,
            )
        )
        return suggestions[:limit]

    async def suggest_payable_matches(
        self,
        tenant_id: int,
        supplier_id: Optional[int] = None,
        limit: int = 50,
    ) -> List[Dict[str, Any]]:
        write_off_limit = self._money(
            Decimal(
                str(await self.business_config_service.get_finance_auto_write_off_precision_limit(tenant_id))
            )
        )
        query_payables = Payable.filter(
            tenant_id=tenant_id,
            remaining_amount__gt=0,
            deleted_at__isnull=True,
        )
        query_payments = Payment.filter(
            tenant_id=tenant_id,
            unsettled_amount__gt=0,
            deleted_at__isnull=True,
        )
        if supplier_id is not None:
            query_payables = query_payables.filter(supplier_id=supplier_id)
            query_payments = query_payments.filter(supplier_id=supplier_id)

        payables = await query_payables.order_by("due_date", "id").all()
        payments = await query_payments.order_by("payment_date", "id").all()

        suggestions: List[Dict[str, Any]] = []
        for payable in payables:
            for payment in payments:
                if payable.supplier_id != payment.supplier_id:
                    continue
                suggested_amount = self._money(min(payable.remaining_amount, payment.unsettled_amount))
                if suggested_amount <= Decimal("0.00"):
                    continue
                score_data = self._build_match_score(
                    debit_amount=payable.remaining_amount,
                    credit_amount=payment.unsettled_amount,
                    debit_date=payable.business_date,
                    credit_date=payment.payment_date,
                    debit_ref=f"{payable.source_code or ''} {payable.invoice_number or ''}",
                    credit_ref=payment.notes,
                    tolerance=write_off_limit,
                )
                if score_data["score"] < 50:
                    continue
                suggestions.append(
                    {
                        "business_type": "payable",
                        "supplier_id": payable.supplier_id,
                        "supplier_name": payable.supplier_name,
                        "payable_id": payable.id,
                        "payable_code": payable.payable_code,
                        "payment_id": payment.id,
                        "payment_code": payment.payment_code,
                        "payable_remaining_amount": str(self._money(payable.remaining_amount)),
                        "payment_unsettled_amount": str(self._money(payment.unsettled_amount)),
                        "suggested_settle_amount": str(suggested_amount),
                        "amount_gap": str(score_data["amount_gap"]),
                        "date_gap_days": score_data["date_gap_days"],
                        "confidence_score": score_data["score"],
                        "reasons": score_data["reasons"],
                        "ref_overlap_tokens": score_data["ref_overlap_tokens"],
                    }
                )

        suggestions.sort(
            key=lambda x: (
                -x["confidence_score"],
                Decimal(x["amount_gap"]),
                x["date_gap_days"] if x["date_gap_days"] is not None else 9999,
            )
        )
        return suggestions[:limit]

    async def backfill_receipts_from_legacy_receivables(self, tenant_id: int, operator_id: int) -> int:
        """
        为「应收已收款、但无收款单/核销记录」的历史数据补录收款单（幂等）。
        修复旧版 record_receipt 只改应收金额、未创建 Receipt 的问题。
        """
        created = 0
        receivables = await Receivable.filter(
            tenant_id=tenant_id,
            received_amount__gt=0,
            deleted_at__isnull=True,
        ).all()
        for receivable in receivables:
            exists = await SettlementRecord.filter(
                tenant_id=tenant_id,
                debit_doc_type="Receivable",
                debit_doc_id=receivable.id,
                credit_doc_type="Receipt",
            ).exists()
            if exists:
                continue
            await self._create_backfill_receipt_for_receivable(tenant_id, receivable, operator_id)
            created += 1
        return created

    async def _create_backfill_receipt_for_receivable(
        self,
        tenant_id: int,
        receivable: Receivable,
        operator_id: int,
    ) -> Receipt:
        received = self._money(receivable.received_amount or Decimal("0.00"))
        if received <= Decimal("0.00"):
            raise ValidationError("应收已收金额无效，无法补录收款单")

        today = datetime.now()
        day_key = today.strftime("%Y%m%d")
        receipt_count = await Receipt.filter(tenant_id=tenant_id).count()
        receipt_code = f"SK{day_key}{receipt_count + 1:04d}"

        receipt_date = receivable.business_date or today.date()
        if getattr(receivable, "updated_at", None):
            updated = receivable.updated_at
            receipt_date = updated.date() if isinstance(updated, datetime) else updated

        receipt = await Receipt.create(
            tenant_id=tenant_id,
            receipt_code=receipt_code,
            customer_id=receivable.customer_id,
            customer_name=receivable.customer_name,
            total_amount=received,
            settled_amount=received,
            unsettled_amount=Decimal("0.00"),
            receipt_date=receipt_date,
            payment_method="银行转账",
            status="Confirmed",
            notes=f"应收单 {receivable.receivable_code} 历史收款补录",
            created_by=operator_id,
        )

        user_name = await self.get_user_name(operator_id)
        settlement_code = await self.generate_code(
            tenant_id, "SETTLEMENT_CODE", prefix=f"HX{day_key}"
        )
        await SettlementRecord.create(
            tenant_id=tenant_id,
            settlement_code=settlement_code,
            partner_id=receivable.customer_id,
            partner_name=receivable.customer_name,
            debit_doc_type="Receivable",
            debit_doc_id=receivable.id,
            debit_doc_code=receivable.receivable_code,
            credit_doc_type="Receipt",
            credit_doc_id=receipt.id,
            credit_doc_code=receipt.receipt_code,
            amount=received,
            currency="CNY",
            settlement_date=today.date(),
            operator_id=operator_id,
            operator_name=user_name,
            notes=json.dumps({"backfill": True, "scene": "legacy_receivable_receipt"}, ensure_ascii=False),
        )
        return receipt

    async def settle_receivable(
        self, 
        tenant_id: int, 
        receivable_id: int, 
        receipt_id: int, 
        amount: Decimal, 
        operator_id: int,
        currency: str = "CNY",
        invoice_exchange_rate: Optional[Decimal] = None,
        payment_exchange_rate: Optional[Decimal] = None,
    ) -> SettlementRecord:
        """
        执行核销：将收款单金额分配到应收单
        """
        async with in_transaction():
            receivable = await Receivable.get_or_none(tenant_id=tenant_id, id=receivable_id)
            receipt = await Receipt.get_or_none(tenant_id=tenant_id, id=receipt_id)
            
            if not receivable or not receipt:
                raise NotFoundError("应收单或收款单不存在")
            
            amount = Decimal(amount).quantize(Decimal("0.01"))
            if amount > receivable.remaining_amount or amount > receipt.unsettled_amount:
                raise ValidationError("核销金额超过单据剩余金额")

            user_name = await self.get_user_name(operator_id)
            today = datetime.now()
            code = await self.generate_code(tenant_id, "SETTLEMENT_CODE", prefix=f"HX{today.strftime('%Y%m%d')}")
            fx_snapshot = self._build_fx_snapshot(
                amount=amount,
                invoice_exchange_rate=invoice_exchange_rate,
                payment_exchange_rate=payment_exchange_rate,
                business_type="receivable",
                currency=currency,
            )

            # 1. 创建核销记录
            settlement = await SettlementRecord.create(
                tenant_id=tenant_id,
                settlement_code=code,
                partner_id=receivable.customer_id,
                partner_name=receivable.customer_name,
                debit_doc_type="Receivable",
                debit_doc_id=receivable_id,
                debit_doc_code=receivable.receivable_code,
                credit_doc_type="Receipt",
                credit_doc_id=receipt_id,
                credit_doc_code=receipt.receipt_code,
                amount=amount,
                currency=currency,
                settlement_date=today.date(),
                operator_id=operator_id,
                operator_name=user_name,
                notes=json.dumps({"fx": fx_snapshot}, ensure_ascii=False) if fx_snapshot else None,
            )

            write_off_limit = self._money(
                Decimal(
                    str(await self.business_config_service.get_finance_auto_write_off_precision_limit(tenant_id))
                )
            )

            # 2. 更新应收单
            new_received = (receivable.received_amount + amount).quantize(Decimal("0.01"))
            new_rem_receivable = (receivable.total_amount - new_received).quantize(Decimal("0.01"))
            new_rem_receivable, receivable_writeoff_applied = self._apply_rounding_writeoff_value(
                value=new_rem_receivable,
                limit=write_off_limit,
            )
            await Receivable.filter(id=receivable_id).update(
                received_amount=new_received,
                remaining_amount=new_rem_receivable,
                status="已结清" if new_rem_receivable <= Decimal("0.00") else "部分收款"
            )
            if new_rem_receivable <= Decimal("0.00"):
                from apps.kuaizhizao.services.contract_milestone_billing_service import (
                    ContractMilestoneBillingService,
                )

                await ContractMilestoneBillingService().sync_milestone_on_receivable_settled(
                    tenant_id, receivable_id
                )
            await self._log_settlement_amount_audit(
                tenant_id=tenant_id,
                operator_id=operator_id,
                object_type="Receivable",
                object_id=receivable_id,
                scene="settle_receivable",
                before={
                    "received_amount": receivable.received_amount,
                    "remaining_amount": receivable.remaining_amount,
                },
                after={
                    "received_amount": new_received,
                    "remaining_amount": new_rem_receivable,
                    "writeoff_applied": receivable_writeoff_applied,
                },
            )

            # 3. 更新收款单
            new_settled = (receipt.settled_amount + amount).quantize(Decimal("0.01"))
            new_unsettled = (receipt.total_amount - new_settled).quantize(Decimal("0.01"))
            new_unsettled, receipt_writeoff_applied = self._apply_rounding_writeoff_value(
                value=new_unsettled,
                limit=write_off_limit,
            )
            await Receipt.filter(id=receipt_id).update(
                settled_amount=new_settled,
                unsettled_amount=new_unsettled,
                status="Confirmed" # 已核销完也可以保持 Confirmed，或者加个 FullySettled
            )
            await self._log_settlement_amount_audit(
                tenant_id=tenant_id,
                operator_id=operator_id,
                object_type="Receipt",
                object_id=receipt_id,
                scene="settle_receipt_balance",
                before={
                    "settled_amount": receipt.settled_amount,
                    "unsettled_amount": receipt.unsettled_amount,
                },
                after={
                    "settled_amount": new_settled,
                    "unsettled_amount": new_unsettled,
                    "writeoff_applied": receipt_writeoff_applied,
                },
            )
            await self.accounting_event_service.record_event(
                tenant_id=tenant_id,
                event_type="SETTLEMENT_RECEIVABLE_COMPLETED",
                business_type="settlement",
                source_doc_type="Receivable",
                source_doc_id=receivable_id,
                source_doc_code=receivable.receivable_code,
                target_doc_type="Settlement",
                target_doc_id=settlement.id,
                target_doc_code=settlement.settlement_code,
                amount=amount,
                currency=currency,
                operator_id=operator_id,
                operator_name=user_name,
                payload={
                    "receipt_id": receipt_id,
                    "writeoff_applied": receivable_writeoff_applied or receipt_writeoff_applied,
                    "fx": fx_snapshot,
                },
            )

            return settlement

    async def settle_payable(
        self, 
        tenant_id: int, 
        payable_id: int, 
        payment_id: int, 
        amount: Decimal, 
        operator_id: int,
        currency: str = "CNY",
        invoice_exchange_rate: Optional[Decimal] = None,
        payment_exchange_rate: Optional[Decimal] = None,
    ) -> SettlementRecord:
        """
        执行核销：将付款单金额分配到应付单
        """
        async with in_transaction():
            payable = await Payable.get_or_none(tenant_id=tenant_id, id=payable_id)
            payment = await Payment.get_or_none(tenant_id=tenant_id, id=payment_id)
            
            if not payable or not payment:
                raise NotFoundError("应付单或付款单不存在")
            
            amount = Decimal(amount).quantize(Decimal("0.01"))
            if amount > payable.remaining_amount or amount > payment.unsettled_amount:
                raise ValidationError("核销金额超过单据剩余金额")

            user_name = await self.get_user_name(operator_id)
            today = datetime.now()
            code = await self.generate_code(tenant_id, "SETTLEMENT_CODE", prefix=f"HX{today.strftime('%Y%m%d')}")
            fx_snapshot = self._build_fx_snapshot(
                amount=amount,
                invoice_exchange_rate=invoice_exchange_rate,
                payment_exchange_rate=payment_exchange_rate,
                business_type="payable",
                currency=currency,
            )

            # 1. 创建核销记录
            settlement = await SettlementRecord.create(
                tenant_id=tenant_id,
                settlement_code=code,
                partner_id=payable.supplier_id,
                partner_name=payable.supplier_name,
                debit_doc_type="Payable",
                debit_doc_id=payable_id,
                debit_doc_code=payable.payable_code,
                credit_doc_type="Payment",
                credit_doc_id=payment_id,
                credit_doc_code=payment.payment_code,
                amount=amount,
                currency=currency,
                settlement_date=today.date(),
                operator_id=operator_id,
                operator_name=user_name,
                notes=json.dumps({"fx": fx_snapshot}, ensure_ascii=False) if fx_snapshot else None,
            )

            write_off_limit = self._money(
                Decimal(
                    str(await self.business_config_service.get_finance_auto_write_off_precision_limit(tenant_id))
                )
            )

            # 2. 更新应付单
            new_paid = (payable.paid_amount + amount).quantize(Decimal("0.01"))
            new_rem_payable = (payable.total_amount - new_paid).quantize(Decimal("0.01"))
            new_rem_payable, payable_writeoff_applied = self._apply_rounding_writeoff_value(
                value=new_rem_payable,
                limit=write_off_limit,
            )
            await Payable.filter(id=payable_id).update(
                paid_amount=new_paid,
                remaining_amount=new_rem_payable,
                status="已结清" if new_rem_payable <= Decimal("0.00") else "部分付款"
            )
            await self._log_settlement_amount_audit(
                tenant_id=tenant_id,
                operator_id=operator_id,
                object_type="Payable",
                object_id=payable_id,
                scene="settle_payable",
                before={
                    "paid_amount": payable.paid_amount,
                    "remaining_amount": payable.remaining_amount,
                },
                after={
                    "paid_amount": new_paid,
                    "remaining_amount": new_rem_payable,
                    "writeoff_applied": payable_writeoff_applied,
                },
            )

            # 3. 更新付款单
            new_settled = (payment.settled_amount + amount).quantize(Decimal("0.01"))
            new_unsettled = (payment.total_amount - new_settled).quantize(Decimal("0.01"))
            new_unsettled, payment_writeoff_applied = self._apply_rounding_writeoff_value(
                value=new_unsettled,
                limit=write_off_limit,
            )
            await Payment.filter(id=payment_id).update(
                settled_amount=new_settled,
                unsettled_amount=new_unsettled,
                status="Confirmed"
            )
            await self._log_settlement_amount_audit(
                tenant_id=tenant_id,
                operator_id=operator_id,
                object_type="Payment",
                object_id=payment_id,
                scene="settle_payment_balance",
                before={
                    "settled_amount": payment.settled_amount,
                    "unsettled_amount": payment.unsettled_amount,
                },
                after={
                    "settled_amount": new_settled,
                    "unsettled_amount": new_unsettled,
                    "writeoff_applied": payment_writeoff_applied,
                },
            )
            await self.accounting_event_service.record_event(
                tenant_id=tenant_id,
                event_type="SETTLEMENT_PAYABLE_COMPLETED",
                business_type="settlement",
                source_doc_type="Payable",
                source_doc_id=payable_id,
                source_doc_code=payable.payable_code,
                target_doc_type="Settlement",
                target_doc_id=settlement.id,
                target_doc_code=settlement.settlement_code,
                amount=amount,
                currency=currency,
                operator_id=operator_id,
                operator_name=user_name,
                payload={
                    "payment_id": payment_id,
                    "writeoff_applied": payable_writeoff_applied or payment_writeoff_applied,
                    "fx": fx_snapshot,
                },
            )

            return settlement

    async def generate_partner_statement(
        self, 
        tenant_id: int, 
        partner_id: int, 
        partner_type: str, 
        start_date: date, 
        end_date: date
    ) -> Dict[str, Any]:
        """
        生成往来对账单：汇总特定期间内的所有交易
        """
        # 1. 获取期初余额 (逻辑待细化：需要汇总 start_date 之前的所有应收减去已收)
        # 2. 获取本期发生额
        if partner_type == "Customer":
            debits = await Receivable.filter(
                tenant_id=tenant_id, customer_id=partner_id, 
                business_date__gte=start_date, business_date__lte=end_date
            ).all()
            credits = await Receipt.filter(
                tenant_id=tenant_id, customer_id=partner_id, 
                receipt_date__gte=start_date, receipt_date__lte=end_date
            ).all()
        else: # Supplier
            debits = await Payable.filter(
                tenant_id=tenant_id, supplier_id=partner_id, 
                business_date__gte=start_date, business_date__lte=end_date
            ).all()
            credits = await Payment.filter(
                tenant_id=tenant_id, supplier_id=partner_id, 
                payment_date__gte=start_date, payment_date__lte=end_date
            ).all()

        return {
            "partner_id": partner_id,
            "period": f"{start_date} to {end_date}",
            "debit_transactions": debits,
            "credit_transactions": credits,
            "summary": {
                "total_debit": sum((d.total_amount for d in debits), Decimal("0.00")),
                "total_credit": sum((c.total_amount for c in credits), Decimal("0.00"))
            }
        }

    async def fifo_auto_settle_receivables(self, tenant_id: int, customer_id: int, operator_id: int):
        """
        自动核销：按时间顺序将未核销收款匹配到待收账单 (FIFO)
        """
        async with in_transaction():
            # 1. 获取所有待收款项 (按到期日/业务日排序)
            receivables = await Receivable.filter(
                tenant_id=tenant_id, customer_id=customer_id, 
                remaining_amount__gt=0, status__not="已结清"
            ).order_by("due_date", "id").all()

            # 2. 获取所有待核销收款单
            receipts = await Receipt.filter(
                tenant_id=tenant_id, customer_id=customer_id, 
                unsettled_amount__gt=0
            ).order_by("receipt_date", "id").all()

            settled_count = 0
            for receipt in receipts:
                for receivable in receivables:
                    if receipt.unsettled_amount <= 0:
                        break
                    if receivable.remaining_amount <= 0:
                        continue
                    
                    settle_amt = min(receipt.unsettled_amount, receivable.remaining_amount)
                    await self.settle_receivable(tenant_id, receivable.id, receipt.id, settle_amt, operator_id)
                    
                    # 更新内存对象状态以供后续循环判断
                    receipt.unsettled_amount -= settle_amt
                    receivable.remaining_amount -= settle_amt
                    settled_count += 1
            
            return settled_count

    async def generate_formal_statement(
        self, 
        tenant_id: int, 
        partner_id: int, 
        partner_type: str, 
        period: str
    ) -> PartnerStatement:
        """
        生成正式对账单存档
        """
        # 简化版实现：先计算本期发生额
        start_date = date.fromisoformat(f"{period}-01")
        # 简单计算月底
        if start_date.month == 12:
            end_date = date(start_date.year + 1, 1, 1)
        else:
            end_date = date(start_date.year, start_date.month + 1, 1)
            
        data = await self.generate_partner_statement(tenant_id, partner_id, partner_type, start_date, end_date)
        
        # 存档
        statement = await PartnerStatement.create(
            tenant_id=tenant_id,
            statement_code=f"STMT-{partner_id}-{period}",
            partner_id=partner_id,
            partner_name=data["debit_transactions"][0].customer_name if data["debit_transactions"] else "Unknown",
            partner_type=partner_type,
            statement_period=period,
            start_date=start_date,
            end_date=end_date,
            opening_balance=Decimal(0), # 需从上期获取
            debit_total=data["summary"]["total_debit"],
            credit_total=data["summary"]["total_credit"],
            closing_balance=data["summary"]["total_debit"] - data["summary"]["total_credit"],
            status="Draft",
            transaction_details={"msg": "Historical snapshot stored here"}
        )
        return statement
