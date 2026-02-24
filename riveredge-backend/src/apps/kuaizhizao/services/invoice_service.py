"""
发票服务模块

提供发票（进项、销项）的业务逻辑处理。

Author: Antigravity
Date: 2026-02-02
"""

from typing import List, Optional
from tortoise.transactions import in_transaction

from apps.kuaizhizao.models.invoice import Invoice, InvoiceItem
from apps.kuaizhizao.schemas.invoice import (
    InvoiceCreate, InvoiceUpdate, InvoiceResponse, InvoiceListResponse
)
from apps.base_service import AppBaseService
from infra.exceptions.exceptions import NotFoundError, ValidationError, BusinessLogicError
from infra.services.business_config_service import BusinessConfigService


class InvoiceService(AppBaseService[Invoice]):
    """
    发票服务
    """
    def __init__(self):
        super().__init__(Invoice)
        self.business_config_service = BusinessConfigService()

    async def create_invoice(self, tenant_id: int, data: InvoiceCreate, created_by: int) -> Invoice:
        """
        创建发票
        """
        is_enabled = await self.business_config_service.check_node_enabled(tenant_id, "invoice")
        if not is_enabled:
            raise BusinessLogicError("发票节点未启用，无法创建发票")
        async with in_transaction():
            # 生成系统编号
            prefix = "INV-IN-" if data.category == "IN" else "INV-OUT-"
            code = await self.generate_code(tenant_id, "INVOICE_CODE", prefix=prefix)
            
            # 创建主表
            invoice_data = data.model_dump(exclude={'items'})
            invoice = await Invoice.create(
                tenant_id=tenant_id,
                invoice_code=code,
                created_by=created_by,
                **invoice_data
            )
            
            # 创建明细
            for item_data in data.items:
                await InvoiceItem.create(
                    tenant_id=tenant_id,
                    invoice=invoice,
                    **item_data.model_dump()
                )
            
            return await self.get_invoice_by_uuid(tenant_id, code)

    async def get_invoice_by_uuid(self, tenant_id: int, code: str) -> Invoice:
        """
        根据编号获取发票详情（包含明细）
        """
        invoice = await Invoice.get_or_none(tenant_id=tenant_id, invoice_code=code).prefetch_related('items')
        if not invoice:
            # 尝试兼容旧API习惯，虽然这里是用code查
             raise NotFoundError(f"发票不存在: {code}")
        return invoice
        
    async def get_invoice_by_id(self, tenant_id: int, invoice_id: int) -> Invoice:
        """
        根据ID获取发票详情
        """
        invoice = await Invoice.get_or_none(tenant_id=tenant_id, id=invoice_id).prefetch_related('items')
        if not invoice:
             raise NotFoundError(f"发票不存在: {invoice_id}")
        return invoice

    async def list_invoices(
        self, 
        tenant_id: int, 
        skip: int = 0, 
        limit: int = 20, 
        category: Optional[str] = None,
        status: Optional[str] = None,
        search: Optional[str] = None
    ) -> tuple[List[Invoice], int]:
        """
        获取发票列表
        """
        query = Invoice.filter(tenant_id=tenant_id)
        
        if category:
            query = query.filter(category=category)
        if status:
            query = query.filter(status=status)
        if search:
            query = query.filter(invoice_number__icontains=search)
            
        total = await query.count()
        items = await query.offset(skip).limit(limit).order_by('-created_at').prefetch_related('items')
        
        return items, total

    async def update_invoice(self, tenant_id: int, code: str, data: InvoiceUpdate) -> Invoice:
        """
        更新发票信息
        """
        invoice = await Invoice.get_or_none(tenant_id=tenant_id, invoice_code=code)
        if not invoice:
            raise NotFoundError(f"发票不存在: {code}")
            
        update_data = data.model_dump(exclude_unset=True)
        if update_data:
            await invoice.update_from_dict(update_data)
            await invoice.save()
            
        return await self.get_invoice_by_uuid(tenant_id, code)

    async def delete_invoice(self, tenant_id: int, code: str):
        """
        删除发票
        """
        invoice = await Invoice.get_or_none(tenant_id=tenant_id, invoice_code=code)
        if not invoice:
            raise NotFoundError(f"发票不存在: {code}")
            
        await invoice.delete()
