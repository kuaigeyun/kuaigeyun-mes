"""
财务协同服务模块

提供财务协同相关的业务逻辑处理。

Author: Luigi Lu
Date: 2025-12-30
"""

from typing import List, Optional, Dict, Any
from datetime import datetime, date
from decimal import Decimal
from tortoise.transactions import in_transaction

from apps.kuaicaiwu.models.payable import Payable
from apps.kuaicaiwu.models.purchase_invoice import PurchaseInvoice
from apps.kuaicaiwu.models.receivable import Receivable
from apps.kuaicaiwu.models.receipt import Receipt
from apps.kuaicaiwu.models.payment import Payment
from apps.kuaicaiwu.models.settlement import SettlementRecord
from apps.kuaicaiwu.models.partner_statement import PartnerStatement

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

    async def get_payable_aging_analysis(self, tenant_id: int) -> Dict[str, Any]:
        """获取应付账龄分析"""
        payables = await Payable.filter(tenant_id=tenant_id, remaining_amount__gt=0, deleted_at__isnull=True).all()
        now = datetime.now().date()
        
        analysis = {
            "within_30": {"count": 0, "amount": 0.0},
            "31_60": {"count": 0, "amount": 0.0},
            "61_90": {"count": 0, "amount": 0.0},
            "over_90": {"count": 0, "amount": 0.0},
            "total": {"count": 0, "amount": 0.0}
        }
        
        for p in payables:
            days = (now - p.due_date).days if p.due_date else 0
            analysis["total"]["count"] += 1
            analysis["total"]["amount"] += float(p.remaining_amount)
            
            if days <= 30:
                key = "within_30"
            elif days <= 60:
                key = "31_60"
            elif days <= 90:
                key = "61_90"
            else:
                key = "over_90"
                
            analysis[key]["count"] += 1
            analysis[key]["amount"] += float(p.remaining_amount)
            
        return analysis

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

    async def get_receivable_aging_analysis(self, tenant_id: int) -> Dict[str, Any]:
        """获取应收账龄分析"""
        receivables = await Receivable.filter(tenant_id=tenant_id, remaining_amount__gt=0, deleted_at__isnull=True).all()
        now = datetime.now().date()
        
        analysis = {
            "within_30": {"count": 0, "amount": 0.0},
            "31_60": {"count": 0, "amount": 0.0},
            "61_90": {"count": 0, "amount": 0.0},
            "over_90": {"count": 0, "amount": 0.0},
            "total": {"count": 0, "amount": 0.0}
        }
        
        for r in receivables:
            days = (now - r.due_date).days if r.due_date else 0
            analysis["total"]["count"] += 1
            analysis["total"]["amount"] += float(r.remaining_amount)
            
            if days <= 30:
                key = "within_30"
            elif days <= 60:
                key = "31_60"
            elif days <= 90:
                key = "61_90"
            else:
                key = "over_90"
                
            analysis[key]["count"] += 1
            analysis[key]["amount"] += float(r.remaining_amount)
            
        return analysis

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

    async def settle_receivable(
        self, 
        tenant_id: int, 
        receivable_id: int, 
        receipt_id: int, 
        amount: Decimal, 
        operator_id: int
    ) -> SettlementRecord:
        """
        执行核销：将收款单金额分配到应收单
        """
        async with in_transaction():
            receivable = await Receivable.get_or_none(tenant_id=tenant_id, id=receivable_id)
            receipt = await Receipt.get_or_none(tenant_id=tenant_id, id=receipt_id)
            
            if not receivable or not receipt:
                raise NotFoundError("应收单或收款单不存在")
            
            if amount > receivable.remaining_amount or amount > receipt.unsettled_amount:
                raise ValidationError("核销金额超过单据剩余金额")

            user_name = await self.get_user_name(operator_id)
            today = datetime.now()
            code = await self.generate_code(tenant_id, "SETTLEMENT_CODE", prefix=f"HX{today.strftime('%Y%m%d')}")

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
                settlement_date=today.date(),
                operator_id=operator_id,
                operator_name=user_name
            )

            # 2. 更新应收单
            new_received = receivable.received_amount + amount
            new_rem_receivable = receivable.total_amount - new_received
            await Receivable.filter(id=receivable_id).update(
                received_amount=new_received,
                remaining_amount=new_rem_receivable,
                status="已结清" if new_rem_receivable <= 0 else "部分收款"
            )

            # 3. 更新收款单
            new_settled = receipt.settled_amount + amount
            new_unsettled = receipt.total_amount - new_settled
            await Receipt.filter(id=receipt_id).update(
                settled_amount=new_settled,
                unsettled_amount=new_unsettled,
                status="Confirmed" # 已核销完也可以保持 Confirmed，或者加个 FullySettled
            )

            return settlement

    async def settle_payable(
        self, 
        tenant_id: int, 
        payable_id: int, 
        payment_id: int, 
        amount: Decimal, 
        operator_id: int
    ) -> SettlementRecord:
        """
        执行核销：将付款单金额分配到应付单
        """
        async with in_transaction():
            payable = await Payable.get_or_none(tenant_id=tenant_id, id=payable_id)
            payment = await Payment.get_or_none(tenant_id=tenant_id, id=payment_id)
            
            if not payable or not payment:
                raise NotFoundError("应付单或付款单不存在")
            
            if amount > payable.remaining_amount or amount > payment.unsettled_amount:
                raise ValidationError("核销金额超过单据剩余金额")

            user_name = await self.get_user_name(operator_id)
            today = datetime.now()
            code = await self.generate_code(tenant_id, "SETTLEMENT_CODE", prefix=f"HX{today.strftime('%Y%m%d')}")

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
                settlement_date=today.date(),
                operator_id=operator_id,
                operator_name=user_name
            )

            # 2. 更新应付单
            new_paid = payable.paid_amount + amount
            new_rem_payable = payable.total_amount - new_paid
            await Payable.filter(id=payable_id).update(
                paid_amount=new_paid,
                remaining_amount=new_rem_payable,
                status="已结清" if new_rem_payable <= 0 else "部分付款"
            )

            # 3. 更新付款单
            new_settled = payment.settled_amount + amount
            new_unsettled = payment.total_amount - new_settled
            await Payment.filter(id=payment_id).update(
                settled_amount=new_settled,
                unsettled_amount=new_unsettled,
                status="Confirmed"
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
                "total_debit": sum(d.total_amount for d in debits),
                "total_credit": sum(c.total_amount for c in credits)
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
