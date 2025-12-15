"""
付款管理模型模块

定义付款数据模型，支持多组织隔离。
按照中国财务规范：付款核销管理。
"""

from tortoise import fields
from decimal import Decimal
from core.models.base import BaseModel


class Payment(BaseModel):
    """
    付款模型
    
    用于管理付款，支持多组织隔离。
    按照中国财务规范：付款核销管理。
    
    Attributes:
        id: 主键ID（自增ID，内部使用）
        uuid: 业务ID（UUID，对外暴露，安全且唯一，继承自BaseModel）
        tenant_id: 组织ID（用于多组织数据隔离，继承自BaseModel）
        payment_no: 付款单编号（组织内唯一）
        payment_date: 付款日期
        supplier_id: 供应商ID（关联master-data）
        payment_type: 付款类型（预付款、应付款、其他）
        payment_method: 付款方式（现金、银行转账、支票、汇票等）
        amount: 付款金额
        currency: 币种（人民币、美元等，默认人民币）
        exchange_rate: 汇率（外币付款时使用）
        status: 状态（待审批、已审批、待核销、部分核销、已核销）
        approval_instance_id: 审批实例ID（关联ApprovalInstance）
        approval_status: 审批状态
        voucher_id: 凭证ID（关联Voucher，自动生成凭证）
        created_at: 创建时间（继承自BaseModel）
        updated_at: 更新时间（继承自BaseModel）
        deleted_at: 删除时间（软删除）
    """
    
    class Meta:
        """
        模型元数据
        """
        table = "seed_kuaiacc_payments"
        indexes = [
            ("tenant_id",),
            ("payment_no",),
            ("uuid",),
            ("payment_date",),
            ("supplier_id",),
            ("payment_type",),
            ("status",),
            ("approval_instance_id",),
            ("approval_status",),
        ]
        unique_together = [("tenant_id", "payment_no")]
    
    # 主键
    id = fields.IntField(pk=True, description="主键ID")
    
    # 基本信息
    payment_no = fields.CharField(max_length=50, description="付款单编号（组织内唯一）")
    payment_date = fields.DatetimeField(description="付款日期")
    supplier_id = fields.IntField(description="供应商ID（关联master-data）")
    
    # 付款信息
    payment_type = fields.CharField(max_length=50, description="付款类型（预付款、应付款、其他）")
    payment_method = fields.CharField(max_length=50, description="付款方式（现金、银行转账、支票、汇票等）")
    amount = fields.DecimalField(max_digits=18, decimal_places=2, description="付款金额")
    
    # 币种和汇率（中国财务：支持外币）
    currency = fields.CharField(max_length=10, default="CNY", description="币种（人民币、美元等，默认人民币）")
    exchange_rate = fields.DecimalField(max_digits=10, decimal_places=6, default=Decimal("1.000000"), description="汇率（外币付款时使用）")
    
    # 状态和审批
    status = fields.CharField(max_length=20, default="待审批", description="状态（待审批、已审批、待核销、部分核销、已核销）")
    approval_instance_id = fields.IntField(null=True, description="审批实例ID（关联ApprovalInstance）")
    approval_status = fields.CharField(max_length=20, null=True, description="审批状态（pending、approved、rejected、cancelled）")
    
    # 凭证
    voucher_id = fields.IntField(null=True, description="凭证ID（关联Voucher，自动生成凭证）")
    
    # 软删除字段
    deleted_at = fields.DatetimeField(null=True, description="删除时间（软删除）")
    
    def __str__(self):
        """字符串表示"""
        return f"{self.payment_no} - {self.amount}"


class PaymentSettlement(BaseModel):
    """
    付款核销模型
    
    用于管理付款核销，支持多组织隔离。
    按照中国财务规范：付款与应付款核销。
    
    Attributes:
        id: 主键ID（自增ID，内部使用）
        uuid: 业务ID（UUID，对外暴露，安全且唯一，继承自BaseModel）
        tenant_id: 组织ID（用于多组织数据隔离，继承自BaseModel）
        payment_id: 付款单ID（关联Payment）
        invoice_id: 发票ID（关联SupplierInvoice）
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
        table = "seed_kuaiacc_payment_settlements"
        indexes = [
            ("tenant_id",),
            ("payment_id",),
            ("invoice_id",),
            ("uuid",),
        ]
    
    # 主键
    id = fields.IntField(pk=True, description="主键ID")
    
    # 关联信息
    payment_id = fields.IntField(description="付款单ID（关联Payment）")
    invoice_id = fields.IntField(description="发票ID（关联SupplierInvoice）")
    
    # 核销信息
    settlement_amount = fields.DecimalField(max_digits=18, decimal_places=2, description="核销金额")
    settlement_date = fields.DatetimeField(description="核销日期")
    
    # 软删除字段
    deleted_at = fields.DatetimeField(null=True, description="删除时间（软删除）")
    
    def __str__(self):
        """字符串表示"""
        return f"{self.payment_id} - {self.invoice_id} - {self.settlement_amount}"

