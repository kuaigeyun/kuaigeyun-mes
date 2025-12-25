"""
总账模型模块

定义总账数据模型，支持多组织隔离。
按照中国财务规范：总账、明细账、科目余额表。
"""

from tortoise import fields
from decimal import Decimal
from core.models.base import BaseModel


class Ledger(BaseModel):
    """
    总账模型
    
    用于管理总账，支持多组织隔离。
    按照中国财务规范：总账、明细账、科目余额表。
    
    Attributes:
        id: 主键ID（自增ID，内部使用）
        uuid: 业务ID（UUID，对外暴露，安全且唯一，继承自BaseModel）
        tenant_id: 组织ID（用于多组织数据隔离，继承自BaseModel）
        subject_id: 科目ID（关联AccountSubject）
        subject_code: 科目编码
        subject_name: 科目名称
        period: 期间（格式：2024-01）
        year: 年度
        month: 月份
        opening_balance: 期初余额
        opening_direction: 期初余额方向（借方、贷方）
        debit_total: 借方合计
        credit_total: 贷方合计
        closing_balance: 期末余额
        closing_direction: 期末余额方向（借方、贷方）
        created_at: 创建时间（继承自BaseModel）
        updated_at: 更新时间（继承自BaseModel）
        deleted_at: 删除时间（软删除）
    """
    
    class Meta:
        """
        模型元数据
        """
        table = "apps_kuaiacc_ledgers"
        indexes = [
            ("tenant_id",),
            ("subject_id",),
            ("uuid",),
            ("period",),
            ("year",),
            ("month",),
        ]
        unique_together = [("tenant_id", "subject_id", "period")]
    
    # 主键
    id = fields.IntField(pk=True, description="主键ID")
    
    # 科目信息
    subject_id = fields.IntField(description="科目ID（关联AccountSubject）")
    subject_code = fields.CharField(max_length=50, description="科目编码")
    subject_name = fields.CharField(max_length=200, description="科目名称")
    
    # 期间信息
    period = fields.CharField(max_length=20, description="期间（格式：2024-01）")
    year = fields.IntField(description="年度")
    month = fields.IntField(description="月份")
    
    # 期初余额
    opening_balance = fields.DecimalField(max_digits=18, decimal_places=2, default=Decimal("0.00"), description="期初余额")
    opening_direction = fields.CharField(max_length=20, default="借方", description="期初余额方向（借方、贷方）")
    
    # 本期发生额
    debit_total = fields.DecimalField(max_digits=18, decimal_places=2, default=Decimal("0.00"), description="借方合计")
    credit_total = fields.DecimalField(max_digits=18, decimal_places=2, default=Decimal("0.00"), description="贷方合计")
    
    # 期末余额
    closing_balance = fields.DecimalField(max_digits=18, decimal_places=2, default=Decimal("0.00"), description="期末余额")
    closing_direction = fields.CharField(max_length=20, default="借方", description="期末余额方向（借方、贷方）")
    
    # 软删除字段
    deleted_at = fields.DatetimeField(null=True, description="删除时间（软删除）")
    
    def __str__(self):
        """字符串表示"""
        return f"{self.subject_code} - {self.period}"


class LedgerDetail(BaseModel):
    """
    明细账模型
    
    用于管理明细账，支持多组织隔离。
    按照中国财务规范：明细账记录每笔业务。
    
    Attributes:
        id: 主键ID（自增ID，内部使用）
        uuid: 业务ID（UUID，对外暴露，安全且唯一，继承自BaseModel）
        tenant_id: 组织ID（用于多组织数据隔离，继承自BaseModel）
        subject_id: 科目ID（关联AccountSubject）
        subject_code: 科目编码
        voucher_id: 凭证ID（关联Voucher）
        voucher_no: 凭证编号
        voucher_date: 凭证日期
        entry_no: 分录序号
        summary: 摘要
        debit_amount: 借方金额
        credit_amount: 贷方金额
        balance: 余额
        balance_direction: 余额方向（借方、贷方）
        created_at: 创建时间（继承自BaseModel）
        updated_at: 更新时间（继承自BaseModel）
        deleted_at: 删除时间（软删除）
    """
    
    class Meta:
        """
        模型元数据
        """
        table = "apps_kuaiacc_ledger_details"
        indexes = [
            ("tenant_id",),
            ("subject_id",),
            ("uuid",),
            ("voucher_id",),
            ("voucher_date",),
        ]
    
    # 主键
    id = fields.IntField(pk=True, description="主键ID")
    
    # 科目信息
    subject_id = fields.IntField(description="科目ID（关联AccountSubject）")
    subject_code = fields.CharField(max_length=50, description="科目编码")
    
    # 凭证信息
    voucher_id = fields.IntField(description="凭证ID（关联Voucher）")
    voucher_no = fields.CharField(max_length=50, description="凭证编号")
    voucher_date = fields.DatetimeField(description="凭证日期")
    entry_no = fields.IntField(description="分录序号")
    
    # 金额信息
    summary = fields.TextField(null=True, description="摘要")
    debit_amount = fields.DecimalField(max_digits=18, decimal_places=2, default=Decimal("0.00"), description="借方金额")
    credit_amount = fields.DecimalField(max_digits=18, decimal_places=2, default=Decimal("0.00"), description="贷方金额")
    balance = fields.DecimalField(max_digits=18, decimal_places=2, default=Decimal("0.00"), description="余额")
    balance_direction = fields.CharField(max_length=20, default="借方", description="余额方向（借方、贷方）")
    
    # 软删除字段
    deleted_at = fields.DatetimeField(null=True, description="删除时间（软删除）")
    
    def __str__(self):
        """字符串表示"""
        return f"{self.subject_code} - {self.voucher_no}"

