"""
客户发票服务模块

提供客户发票的业务逻辑处理，支持多组织隔离。
按照中国财务规范：增值税发票管理。
"""

from typing import List, Optional
from datetime import datetime
from decimal import Decimal
from apps.kuaiacc.models.customer_invoice import CustomerInvoice
from apps.kuaiacc.schemas.customer_invoice_schemas import (
    CustomerInvoiceCreate, CustomerInvoiceUpdate, CustomerInvoiceResponse
)
from infra.exceptions.exceptions import NotFoundError, ValidationError


class CustomerInvoiceService:
    """客户发票服务"""
    
    @staticmethod
    async def create_customer_invoice(
        tenant_id: int,
        data: CustomerInvoiceCreate
    ) -> CustomerInvoiceResponse:
        """
        创建客户发票
        
        Args:
            tenant_id: 租户ID
            data: 发票创建数据
            
        Returns:
            CustomerInvoiceResponse: 创建的发票对象
            
        Raises:
            ValidationError: 当编号已存在时抛出
        """
        # 检查编号是否已存在
        existing = await CustomerInvoice.filter(
            tenant_id=tenant_id,
            invoice_no=data.invoice_no,
            deleted_at__isnull=True
        ).first()
        
        if existing:
            raise ValidationError(f"发票编号 {data.invoice_no} 已存在")
        
        # 验证含税金额计算
        expected_including = data.amount_excluding_tax + data.tax_amount
        if abs(data.amount_including_tax - expected_including) > Decimal("0.01"):
            raise ValidationError(
                f"含税金额计算错误：不含税金额={data.amount_excluding_tax}，"
                f"税额={data.tax_amount}，含税金额应为={expected_including}，实际={data.amount_including_tax}"
            )
        
        # 创建发票
        invoice = await CustomerInvoice.create(
            tenant_id=tenant_id,
            **data.dict()
        )
        
        return CustomerInvoiceResponse.model_validate(invoice)
    
    @staticmethod
    async def get_customer_invoice_by_uuid(
        tenant_id: int,
        invoice_uuid: str
    ) -> CustomerInvoiceResponse:
        """
        根据UUID获取客户发票
        
        Args:
            tenant_id: 租户ID
            invoice_uuid: 发票UUID
            
        Returns:
            CustomerInvoiceResponse: 发票对象
            
        Raises:
            NotFoundError: 当发票不存在时抛出
        """
        invoice = await CustomerInvoice.filter(
            tenant_id=tenant_id,
            uuid=invoice_uuid,
            deleted_at__isnull=True
        ).first()
        
        if not invoice:
            raise NotFoundError(f"客户发票 {invoice_uuid} 不存在")
        
        return CustomerInvoiceResponse.model_validate(invoice)
    
    @staticmethod
    async def list_customer_invoices(
        tenant_id: int,
        skip: int = 0,
        limit: int = 100,
        customer_id: Optional[int] = None,
        status: Optional[str] = None,
        start_date: Optional[datetime] = None,
        end_date: Optional[datetime] = None
    ) -> List[CustomerInvoiceResponse]:
        """
        获取客户发票列表
        
        Args:
            tenant_id: 租户ID
            skip: 跳过数量
            limit: 限制数量
            customer_id: 客户ID（过滤）
            status: 状态（过滤）
            start_date: 开始日期（过滤）
            end_date: 结束日期（过滤）
            
        Returns:
            List[CustomerInvoiceResponse]: 发票列表
        """
        query = CustomerInvoice.filter(
            tenant_id=tenant_id,
            deleted_at__isnull=True
        )
        
        if customer_id:
            query = query.filter(customer_id=customer_id)
        if status:
            query = query.filter(status=status)
        if start_date:
            query = query.filter(invoice_date__gte=start_date)
        if end_date:
            query = query.filter(invoice_date__lte=end_date)
        
        invoices = await query.offset(skip).limit(limit).order_by("-invoice_date", "-id").all()
        
        return [CustomerInvoiceResponse.model_validate(invoice) for invoice in invoices]
    
    @staticmethod
    async def update_customer_invoice(
        tenant_id: int,
        invoice_uuid: str,
        data: CustomerInvoiceUpdate
    ) -> CustomerInvoiceResponse:
        """
        更新客户发票
        
        Args:
            tenant_id: 租户ID
            invoice_uuid: 发票UUID
            data: 发票更新数据
            
        Returns:
            CustomerInvoiceResponse: 更新后的发票对象
            
        Raises:
            NotFoundError: 当发票不存在时抛出
        """
        invoice = await CustomerInvoice.filter(
            tenant_id=tenant_id,
            uuid=invoice_uuid,
            deleted_at__isnull=True
        ).first()
        
        if not invoice:
            raise NotFoundError(f"客户发票 {invoice_uuid} 不存在")
        
        # 更新字段
        update_data = data.dict(exclude_unset=True)
        
        # 如果更新了金额，需要重新计算含税金额
        if "amount_excluding_tax" in update_data or "tax_amount" in update_data:
            new_excluding = update_data.get("amount_excluding_tax", invoice.amount_excluding_tax)
            new_tax = update_data.get("tax_amount", invoice.tax_amount)
            update_data["amount_including_tax"] = new_excluding + new_tax
        
        for key, value in update_data.items():
            setattr(invoice, key, value)
        
        await invoice.save()
        
        return CustomerInvoiceResponse.model_validate(invoice)
    
    @staticmethod
    async def delete_customer_invoice(
        tenant_id: int,
        invoice_uuid: str
    ) -> None:
        """
        删除客户发票（软删除）
        
        Args:
            tenant_id: 租户ID
            invoice_uuid: 发票UUID
            
        Raises:
            NotFoundError: 当发票不存在时抛出
        """
        invoice = await CustomerInvoice.filter(
            tenant_id=tenant_id,
            uuid=invoice_uuid,
            deleted_at__isnull=True
        ).first()
        
        if not invoice:
            raise NotFoundError(f"客户发票 {invoice_uuid} 不存在")
        
        # 软删除
        invoice.deleted_at = datetime.now()
        await invoice.save()

