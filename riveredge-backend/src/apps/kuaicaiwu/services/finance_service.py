"""
财务协同服务模块

提供财务协同相关的业务逻辑处理。

Author: Luigi Lu
Date: 2025-12-30
"""

from typing import List, Optional
from datetime import datetime
from tortoise.transactions import in_transaction

from apps.kuaicaiwu.models.payable import Payable
from apps.kuaicaiwu.models.purchase_invoice import PurchaseInvoice
from apps.kuaicaiwu.models.receivable import Receivable

from apps.kuaicaiwu.schemas.finance import (
    PayableCreate, PayableUpdate, PayableResponse, PayableListResponse,
    PurchaseInvoiceCreate, PurchaseInvoiceUpdate, PurchaseInvoiceResponse, PurchaseInvoiceListResponse,
    ReceivableCreate, ReceivableUpdate, ReceivableResponse, ReceivableListResponse,
    PaymentRecordCreate, ReceiptRecordCreate,
)

from apps.base_service import AppBaseService
from infra.exceptions.exceptions import NotFoundError, ValidationError, BusinessLogicError
from infra.services.business_config_service import BusinessConfigService


class PayableService(AppBaseService[Payable]):
    """应付单服务"""

    def __init__(self):
        super().__init__(Payable)
        self.business_config_service = BusinessConfigService()

    async def create_payable(self, tenant_id: int, payable_data: PayableCreate, created_by: int) -> PayableResponse:
        """创建应付单"""
        is_enabled = await self.business_config_service.check_node_enabled(tenant_id, "payable")
        if not is_enabled:
            raise BusinessLogicError("应付账款节点未启用，无法创建应付单")
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
            return PayableResponse.model_validate(payable)

    async def get_payable_by_id(self, tenant_id: int, payable_id: int) -> PayableResponse:
        """根据ID获取应付单"""
        payable = await Payable.get_or_none(tenant_id=tenant_id, id=payable_id)
        if not payable:
            raise NotFoundError(f"应付单不存在: {payable_id}")
        return PayableResponse.model_validate(payable)

    async def list_payables(self, tenant_id: int, skip: int = 0, limit: int = 20, **filters) -> List[PayableResponse]:
        """获取应付单列表"""
        query = Payable.filter(tenant_id=tenant_id)
        if filters.get('status'):
            query = query.filter(status=filters['status'])
        if filters.get('supplier_id'):
            query = query.filter(supplier_id=filters['supplier_id'])
        if filters.get('due_date_start'):
            query = query.filter(due_date__gte=filters['due_date_start'])
        if filters.get('due_date_end'):
            query = query.filter(due_date__lte=filters['due_date_end'])

        payables = await query.offset(skip).limit(limit).order_by('-created_at')
        return [PayableResponse.model_validate(payable) for payable in payables]

    async def update_payable(self, tenant_id: int, payable_id: int, payable_data: PayableUpdate, updated_by: int) -> PayableResponse:
        """更新应付单"""
        async with in_transaction():
            await self.get_payable_by_id(tenant_id, payable_id)
            update_data = payable_data.model_dump(exclude_unset=True, exclude={'updated_by'})
            update_data['updated_by'] = updated_by
            await Payable.filter(tenant_id=tenant_id, id=payable_id).update(**update_data)
            return await self.get_payable_by_id(tenant_id, payable_id)

    async def record_payment(self, tenant_id: int, payable_id: int, payment_data: PaymentRecordCreate, recorded_by: int) -> PayableResponse:
        """记录付款"""
        async with in_transaction():
            payable = await self.get_payable_by_id(tenant_id, payable_id)
            if payable.status == '已结清':
                raise BusinessLogicError("应付单已结清，无法继续付款")
            payment_amount = payment_data.payment_amount
            if payment_amount > payable.remaining_amount:
                raise ValidationError("付款金额不能超过剩余金额")

            new_paid_amount = payable.paid_amount + payment_amount
            new_remaining_amount = payable.total_amount - new_paid_amount
            new_status = "已结清" if new_remaining_amount <= 0 else "部分付款"

            await Payable.filter(tenant_id=tenant_id, id=payable_id).update(
                paid_amount=new_paid_amount,
                remaining_amount=new_remaining_amount,
                status=new_status,
                updated_by=recorded_by
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

    async def create_purchase_invoice(self, tenant_id: int, invoice_data: PurchaseInvoiceCreate, created_by: int) -> PurchaseInvoiceResponse:
        """创建采购发票"""
        async with in_transaction():
            user_info = await self.get_user_info(created_by)
            today = datetime.now().strftime("%Y%m%d")
            code = await self.generate_code(tenant_id, "PURCHASE_INVOICE_CODE", prefix=f"PI{today}")

            invoice = await PurchaseInvoice.create(
                tenant_id=tenant_id,
                invoice_code=code,
                created_by=created_by,
                **invoice_data.model_dump(exclude_unset=True, exclude={'created_by'})
            )
            return PurchaseInvoiceResponse.model_validate(invoice)

    async def get_purchase_invoice_by_id(self, tenant_id: int, invoice_id: int) -> PurchaseInvoiceResponse:
        """根据ID获取采购发票"""
        invoice = await PurchaseInvoice.get_or_none(tenant_id=tenant_id, id=invoice_id)
        if not invoice:
            raise NotFoundError(f"采购发票不存在: {invoice_id}")
        return PurchaseInvoiceResponse.model_validate(invoice)

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
        return [PurchaseInvoiceResponse.model_validate(invoice) for invoice in invoices]

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

    async def create_receivable(self, tenant_id: int, receivable_data: ReceivableCreate, created_by: int) -> ReceivableResponse:
        """创建应收单"""
        is_enabled = await self.business_config_service.check_node_enabled(tenant_id, "receivable")
        if not is_enabled:
            raise BusinessLogicError("应收账款节点未启用，无法创建应收单")
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
            return ReceivableResponse.model_validate(receivable)

    async def get_receivable_by_id(self, tenant_id: int, receivable_id: int) -> ReceivableResponse:
        """根据ID获取应收单"""
        receivable = await Receivable.get_or_none(tenant_id=tenant_id, id=receivable_id)
        if not receivable:
            raise NotFoundError(f"应收单不存在: {receivable_id}")
        return ReceivableResponse.model_validate(receivable)

    async def list_receivables(self, tenant_id: int, skip: int = 0, limit: int = 20, **filters) -> List[ReceivableResponse]:
        """获取应收单列表"""
        query = Receivable.filter(tenant_id=tenant_id)
        if filters.get('status'):
            query = query.filter(status=filters['status'])
        if filters.get('customer_id'):
            query = query.filter(customer_id=filters['customer_id'])
        if filters.get('due_date_start'):
            query = query.filter(due_date__gte=filters['due_date_start'])
        if filters.get('due_date_end'):
            query = query.filter(due_date__lte=filters['due_date_end'])

        receivables = await query.offset(skip).limit(limit).order_by('-created_at')
        return [ReceivableResponse.model_validate(receivable) for receivable in receivables]

    async def record_receipt(self, tenant_id: int, receivable_id: int, receipt_data: ReceiptRecordCreate, recorded_by: int) -> ReceivableResponse:
        """记录收款"""
        async with in_transaction():
            receivable = await self.get_receivable_by_id(tenant_id, receivable_id)
            if receivable.status == '已结清':
                raise BusinessLogicError("应收单已结清，无法继续收款")
            receipt_amount = receipt_data.receipt_amount
            if receipt_amount > receivable.remaining_amount:
                raise ValidationError("收款金额不能超过剩余金额")

            new_received_amount = receivable.received_amount + receipt_amount
            new_remaining_amount = receivable.total_amount - new_received_amount
            new_status = "已结清" if new_remaining_amount <= 0 else "部分收款"

            await Receivable.filter(tenant_id=tenant_id, id=receivable_id).update(
                received_amount=new_received_amount,
                remaining_amount=new_remaining_amount,
                status=new_status,
                updated_by=recorded_by
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

    async def delete_receivable(self, tenant_id: int, receivable_id: int) -> None:
        """删除应收单"""
        receivable = await self.get_receivable_by_id(tenant_id, receivable_id)
        if str(receivable.review_status or '') in ('已审核', '通过'):
            raise BusinessLogicError("已审核的应收单不能删除")
        if receivable.received_amount > 0:
            raise BusinessLogicError("已有收款记录的应收单不能删除")
        await Receivable.filter(tenant_id=tenant_id, id=receivable_id).delete()
