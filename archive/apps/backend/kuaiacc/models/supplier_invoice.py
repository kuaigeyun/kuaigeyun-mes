"""
供应商发票模型模块

定义供应商发票数据模型，支持多组织隔离。
按照中国财务规范：增值税发票管理。
"""

from tortoise import fields
from decimal import Decimal
from core.models.base import BaseModel


class SupplierInvoice(BaseModel):
    """
    供应商发票模型
    
    用于管理供应商发票，支持多组织隔离。
    按照中国财务规范：增值税发票管理。
    
    Attributes:
        id: 主键ID（自增ID，内部使用）
        uuid: 业务ID（UUID，对外暴露，安全且唯一，继承自BaseModel）
        tenant_id: 组织ID（用于多组织数据隔离，继承自BaseModel）
        invoice_no: 发票编号（组织内唯一）
        invoice_code: 发票代码（增值税发票代码）
        invoice_number: 发票号码（增值税发票号码）
        invoice_type: 发票类型（增值税专用发票、增值税普通发票、普通发票）
        invoice_date: 发票日期
        supplier_id: 供应商ID（关联master-data）
        purchase_order_id: 采购订单ID（关联SRM）
        tax_rate: 税率（增值税税率，如0.13表示13%）
        amount_excluding_tax: 不含税金额
        tax_amount: 税额
        amount_including_tax: 含税金额
        status: 状态（待校验、已校验、已作废、已红冲）
        voucher_id: 凭证ID（关联Voucher，自动生成凭证）
        created_at: 创建时间（继承自BaseModel）
        updated_at: 更新时间（继承自BaseModel）
        deleted_at: 删除时间（软删除）
    """
    
    class Meta:
        """
        模型元数据
        """
        table = "apps_kuaiacc_supplier_invoices"
        indexes = [
            ("tenant_id",),
            ("invoice_no",),
            ("uuid",),
            ("invoice_code",),
            ("invoice_number",),
            ("invoice_date",),
            ("supplier_id",),
            ("purchase_order_id",),
            ("status",),
        ]
        unique_together = [("tenant_id", "invoice_no")]
    
    # 主键
    id = fields.IntField(pk=True, description="主键ID")
    
    # 基本信息
    invoice_no = fields.CharField(max_length=50, description="发票编号（组织内唯一）")
    invoice_code = fields.CharField(max_length=50, null=True, description="发票代码（增值税发票代码）")
    invoice_number = fields.CharField(max_length=50, null=True, description="发票号码（增值税发票号码）")
    invoice_type = fields.CharField(max_length=50, description="发票类型（增值税专用发票、增值税普通发票、普通发票）")
    invoice_date = fields.DatetimeField(description="发票日期")
    
    # 关联信息
    supplier_id = fields.IntField(description="供应商ID（关联master-data）")
    purchase_order_id = fields.IntField(null=True, description="采购订单ID（关联SRM）")
    
    # 金额信息（中国财务：增值税发票）
    tax_rate = fields.DecimalField(max_digits=5, decimal_places=4, default=Decimal("0.13"), description="税率（增值税税率，如0.13表示13%）")
    amount_excluding_tax = fields.DecimalField(max_digits=18, decimal_places=2, description="不含税金额")
    tax_amount = fields.DecimalField(max_digits=18, decimal_places=2, description="税额")
    amount_including_tax = fields.DecimalField(max_digits=18, decimal_places=2, description="含税金额")
    
    # 状态和凭证
    status = fields.CharField(max_length=20, default="待校验", description="状态（待校验、已校验、已作废、已红冲）")
    voucher_id = fields.IntField(null=True, description="凭证ID（关联Voucher，自动生成凭证）")
    
    # 软删除字段
    deleted_at = fields.DatetimeField(null=True, description="删除时间（软删除）")
    
    def __str__(self):
        """字符串表示"""
        return f"{self.invoice_no} - {self.amount_including_tax}"

