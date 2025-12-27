"""
供应商发票服务模块

提供供应商发票的业务逻辑处理，支持多组织隔离。
按照中国财务规范：增值税发票管理。
"""

from typing import List, Optional
from datetime import datetime
from apps.kuaiacc.models.supplier_invoice import SupplierInvoice
from apps.kuaiacc.schemas.supplier_invoice_schemas import (
    SupplierInvoiceCreate, SupplierInvoiceUpdate, SupplierInvoiceResponse
)
from infra.exceptions.exceptions import NotFoundError, ValidationError


class SupplierInvoiceService:
    """供应商发票服务"""
    
    @staticmethod
    async def create_supplier_invoice(
        tenant_id: int,
        data: SupplierInvoiceCreate
    ) -> SupplierInvoiceResponse:
        """
        创建供应商发票
        
        Args:
            tenant_id: 租户ID
            data: 发票创建数据
            
        Returns:
            SupplierInvoiceResponse: 创建的发票对象
            
        Raises:
            ValidationError: 当编号已存在时抛出
        """
        # 检查编号是否已存在
        existing = await SupplierInvoice.filter(
            tenant_id=tenant_id,
            invoice_no=data.invoice_no,
            deleted_at__isnull=True
        ).first()
        
        if existing:
            raise ValidationError(f"发票编号 {data.invoice_no} 已存在")
        
        # 创建发票
        invoice = await SupplierInvoice.create(
            tenant_id=tenant_id,
            **data.dict()
        )
        
        return SupplierInvoiceResponse.model_validate(invoice)
    
    @staticmethod
    async def get_supplier_invoice_by_uuid(
        tenant_id: int,
        invoice_uuid: str
    ) -> SupplierInvoiceResponse:
        """
        根据UUID获取供应商发票
        
        Args:
            tenant_id: 租户ID
            invoice_uuid: 发票UUID
            
        Returns:
            SupplierInvoiceResponse: 发票对象
            
        Raises:
            NotFoundError: 当发票不存在时抛出
        """
        invoice = await SupplierInvoice.filter(
            tenant_id=tenant_id,
            uuid=invoice_uuid,
            deleted_at__isnull=True
        ).first()
        
        if not invoice:
            raise NotFoundError(f"供应商发票 {invoice_uuid} 不存在")
        
        return SupplierInvoiceResponse.model_validate(invoice)
    
    @staticmethod
    async def list_supplier_invoices(
        tenant_id: int,
        skip: int = 0,
        limit: int = 100,
        supplier_id: Optional[int] = None,
        status: Optional[str] = None,
        start_date: Optional[datetime] = None,
        end_date: Optional[datetime] = None
    ) -> List[SupplierInvoiceResponse]:
        """
        获取供应商发票列表
        
        Args:
            tenant_id: 租户ID
            skip: 跳过数量
            limit: 限制数量
            supplier_id: 供应商ID（过滤）
            status: 状态（过滤）
            start_date: 开始日期（过滤）
            end_date: 结束日期（过滤）
            
        Returns:
            List[SupplierInvoiceResponse]: 发票列表
        """
        query = SupplierInvoice.filter(
            tenant_id=tenant_id,
            deleted_at__isnull=True
        )
        
        if supplier_id:
            query = query.filter(supplier_id=supplier_id)
        if status:
            query = query.filter(status=status)
        if start_date:
            query = query.filter(invoice_date__gte=start_date)
        if end_date:
            query = query.filter(invoice_date__lte=end_date)
        
        invoices = await query.offset(skip).limit(limit).order_by("-invoice_date", "-id").all()
        
        return [SupplierInvoiceResponse.model_validate(invoice) for invoice in invoices]
    
    @staticmethod
    async def update_supplier_invoice(
        tenant_id: int,
        invoice_uuid: str,
        data: SupplierInvoiceUpdate
    ) -> SupplierInvoiceResponse:
        """
        更新供应商发票
        
        Args:
            tenant_id: 租户ID
            invoice_uuid: 发票UUID
            data: 发票更新数据
            
        Returns:
            SupplierInvoiceResponse: 更新后的发票对象
            
        Raises:
            NotFoundError: 当发票不存在时抛出
        """
        invoice = await SupplierInvoice.filter(
            tenant_id=tenant_id,
            uuid=invoice_uuid,
            deleted_at__isnull=True
        ).first()
        
        if not invoice:
            raise NotFoundError(f"供应商发票 {invoice_uuid} 不存在")
        
        # 更新字段
        update_data = data.dict(exclude_unset=True)
        for key, value in update_data.items():
            setattr(invoice, key, value)
        
        await invoice.save()
        
        return SupplierInvoiceResponse.model_validate(invoice)
    
    @staticmethod
    async def delete_supplier_invoice(
        tenant_id: int,
        invoice_uuid: str
    ) -> None:
        """
        删除供应商发票（软删除）
        
        Args:
            tenant_id: 租户ID
            invoice_uuid: 发票UUID
            
        Raises:
            NotFoundError: 当发票不存在时抛出
        """
        invoice = await SupplierInvoice.filter(
            tenant_id=tenant_id,
            uuid=invoice_uuid,
            deleted_at__isnull=True
        ).first()
        
        if not invoice:
            raise NotFoundError(f"供应商发票 {invoice_uuid} 不存在")
        
        # 软删除
        invoice.deleted_at = datetime.now()
        await invoice.save()

