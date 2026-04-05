"""
发票服务模块（销项/进项统一，从快制造迁移）

提供发票的业务逻辑处理。
"""

from typing import List, Optional, Dict, Any
from tortoise.transactions import in_transaction
from tortoise.functions import Sum

from apps.kuaicaiwu.models.invoice import Invoice, InvoiceItem
from apps.kuaicaiwu.services.accounting_event_service import AccountingEventService
from apps.kuaicaiwu.schemas.invoice import InvoiceCreate, InvoiceUpdate
from apps.base_service import AppBaseService
from infra.exceptions.exceptions import NotFoundError, BusinessLogicError
from infra.services.business_config_service import BusinessConfigService


class InvoiceService(AppBaseService[Invoice]):
    """发票服务"""

    def __init__(self):
        super().__init__(Invoice)
        self.business_config_service = BusinessConfigService()
        self.accounting_event_service = AccountingEventService()

    async def create_invoice(self, tenant_id: int, data: InvoiceCreate, created_by: int) -> Invoice:
        """创建发票"""
        is_enabled = await self.business_config_service.check_node_enabled(tenant_id, "invoice")
        if not is_enabled:
            raise BusinessLogicError("发票节点未启用，无法创建发票")
        async with in_transaction():
            prefix = "INV-IN-" if data.category == "IN" else "INV-OUT-"
            code = await self.generate_code(tenant_id, "INVOICE_CODE", prefix=prefix)
            invoice_data = data.model_dump(exclude={'items'})
            invoice = await Invoice.create(
                tenant_id=tenant_id,
                invoice_code=code,
                created_by=created_by,
                **invoice_data
            )
            for item_data in data.items:
                await InvoiceItem.create(
                    tenant_id=tenant_id,
                    invoice=invoice,
                    **item_data.model_dump()
                )
            await self.accounting_event_service.record_event(
                tenant_id=tenant_id,
                event_type="INVOICE_CREATED",
                business_type="invoice",
                target_doc_type="Invoice",
                target_doc_id=invoice.id,
                target_doc_code=invoice.invoice_code,
                amount=invoice.total_amount,
                currency="CNY",
                operator_id=created_by,
                payload={
                    "category": invoice.category,
                    "status": invoice.status,
                    "item_count": len(data.items),
                },
            )
            return await self.get_invoice_by_uuid(tenant_id, code)

    async def get_invoice_by_uuid(self, tenant_id: int, code: str) -> Invoice:
        """根据编号获取发票详情（包含明细）"""
        invoice = await Invoice.get_or_none(tenant_id=tenant_id, invoice_code=code).prefetch_related('items')
        if not invoice:
            raise NotFoundError(f"发票不存在: {code}")
        return invoice

    async def get_invoice_by_id(self, tenant_id: int, invoice_id: int) -> Invoice:
        """根据ID获取发票详情"""
        invoice = await Invoice.get_or_none(tenant_id=tenant_id, id=invoice_id).prefetch_related('items')
        if not invoice:
            raise NotFoundError(f"发票不存在: {invoice_id}")
        return invoice

    async def get_invoice_statistics(self, tenant_id: int) -> Dict[str, Any]:
        """发票列表页指标：总张数、进/销项价税合计合计、待认证进项张数"""
        total_count = await Invoice.filter(tenant_id=tenant_id).count()
        agg_in = await Invoice.filter(tenant_id=tenant_id, category="IN").aggregate(in_total=Sum("total_amount"))
        agg_out = await Invoice.filter(tenant_id=tenant_id, category="OUT").aggregate(out_total=Sum("total_amount"))
        in_total = float(agg_in.get("in_total") or 0)
        out_total = float(agg_out.get("out_total") or 0)
        # 进项已确认、尚未税务认证
        pending_verification_count = await Invoice.filter(
            tenant_id=tenant_id,
            category="IN",
            status="CONFIRMED",
            verification_date__isnull=True,
        ).count()
        return {
            "total_count": total_count,
            "in_total_amount": round(in_total, 2),
            "out_total_amount": round(out_total, 2),
            "pending_verification_count": pending_verification_count,
        }

    async def list_invoices(
        self,
        tenant_id: int,
        skip: int = 0,
        limit: int = 20,
        category: Optional[str] = None,
        status: Optional[str] = None,
        search: Optional[str] = None
    ) -> tuple[List[Invoice], int]:
        """获取发票列表"""
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
        """更新发票信息"""
        invoice = await Invoice.get_or_none(tenant_id=tenant_id, invoice_code=code)
        if not invoice:
            raise NotFoundError(f"发票不存在: {code}")
        update_data = data.model_dump(exclude_unset=True)
        if update_data:
            await invoice.update_from_dict(update_data)
            await invoice.save()
        return await self.get_invoice_by_uuid(tenant_id, code)

    async def delete_invoice(self, tenant_id: int, code: str):
        """删除发票"""
        invoice = await Invoice.get_or_none(tenant_id=tenant_id, invoice_code=code)
        if not invoice:
            raise NotFoundError(f"发票不存在: {code}")
        await invoice.delete()
