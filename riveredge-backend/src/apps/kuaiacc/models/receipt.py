"""
收款管理模型模块

定义收款数据模型，支持多组织隔离。
按照中国财务规范：收款核销管理。
"""

from tortoise import fields
from decimal import Decimal
from core.models.base import BaseModel


class Receipt(BaseModel):
    """
    收款模型
    
    用于管理收款，支持多组织隔离。
    按照中国财务规范：收款核销管理。
    
    Attributes:
        id: 主键ID（自增ID，内部使用）
        uuid: 业务ID（UUID，对外暴露，安全且唯一，继承自BaseModel）
        tenant_id: 组织ID（用于多组织数据隔离，继承自BaseModel）
        receipt_no: 收款单编号（组织内唯一）
        receipt_date: 收款日期
        customer_id: 客户ID（关联master-data）
        receipt_type: 收款类型（预收款、应收款、其他）
        payment_method: 收款方式（现金、银行转账、支票、汇票等）
        amount: 收款金额
        currency: 币种（人民币、美元等，默认人民币）
        exchange_rate: 汇率（外币收款时使用）
        status: 状态（待核销、部分核销、已核销）
        voucher_id: 凭证ID（关联Voucher，自动生成凭证）
        created_at: 创建时间（继承自BaseModel）
        updated_at: 更新时间（继承自BaseModel）
        deleted_at: 删除时间（软删除）
    """
    
    class Meta:
        """
        模型元数据
        """
        table = "seed_kuaiacc_receipts"
        indexes = [
            ("tenant_id",),
            ("receipt_no",),
            ("uuid",),
            ("receipt_date",),
            ("customer_id",),
            ("receipt_type",),
            ("status",),
        ]
        unique_together = [("tenant_id", "receipt_no")]
    
    # 主键
    id = fields.IntField(pk=True, description="主键ID")
    
    # 基本信息
    receipt_no = fields.CharField(max_length=50, description="收款单编号（组织内唯一）")
    receipt_date = fields.DatetimeField(description="收款日期")
    customer_id = fields.IntField(description="客户ID（关联master-data）")
    
    # 收款信息
    receipt_type = fields.CharField(max_length=50, description="收款类型（预收款、应收款、其他）")
    payment_method = fields.CharField(max_length=50, description="收款方式（现金、银行转账、支票、汇票等）")
    amount = fields.DecimalField(max_digits=18, decimal_places=2, description="收款金额")
    
    # 币种和汇率（中国财务：支持外币）
    currency = fields.CharField(max_length=10, default="CNY", description="币种（人民币、美元等，默认人民币）")
    exchange_rate = fields.DecimalField(max_digits=10, decimal_places=6, default=Decimal("1.000000"), description="汇率（外币收款时使用）")
    
    # 状态和凭证
    status = fields.CharField(max_length=20, default="待核销", description="状态（待核销、部分核销、已核销）")
    voucher_id = fields.IntField(null=True, description="凭证ID（关联Voucher，自动生成凭证）")
    
    # 软删除字段
    deleted_at = fields.DatetimeField(null=True, description="删除时间（软删除）")
    
    def __str__(self):
        """字符串表示"""
        return f"{self.receipt_no} - {self.amount}"


class ReceiptSettlement(BaseModel):
    """
    收款核销模型
    
    用于管理收款核销，支持多组织隔离。
    按照中国财务规范：收款与应收款核销。
    
    Attributes:
        id: 主键ID（自增ID，内部使用）
        uuid: 业务ID（UUID，对外暴露，安全且唯一，继承自BaseModel）
        tenant_id: 组织ID（用于多组织数据隔离，继承自BaseModel）
        receipt_id: 收款单ID（关联Receipt）
        invoice_id: 发票ID（关联CustomerInvoice）
        settlement_amount: 核销金额
        settlement_date: 核销日期
        created_at: 创建时间（继承自BaseModel）
        updated_at: 更新时间（继承自BaseModel）
        deleted_at: 删除时间（软删除）
    """
    
    class Meta:
        """
        模型元数据
        """
        table = "seed_kuaiacc_receipt_settlements"
        indexes = [
            ("tenant_id",),
            ("receipt_id",),
            ("invoice_id",),
            ("uuid",),
        ]
    
    # 主键
    id = fields.IntField(pk=True, description="主键ID")
    
    # 关联信息
    receipt_id = fields.IntField(description="收款单ID（关联Receipt）")
    invoice_id = fields.IntField(description="发票ID（关联CustomerInvoice）")
    
    # 核销信息
    settlement_amount = fields.DecimalField(max_digits=18, decimal_places=2, description="核销金额")
    settlement_date = fields.DatetimeField(description="核销日期")
    
    # 软删除字段
    deleted_at = fields.DatetimeField(null=True, description="删除时间（软删除）")
    
    def __str__(self):
        """字符串表示"""
        return f"{self.receipt_id} - {self.invoice_id} - {self.settlement_amount}"

