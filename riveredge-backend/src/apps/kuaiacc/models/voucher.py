"""
凭证模型模块

定义凭证数据模型，支持多组织隔离。
"""

from tortoise import fields
from decimal import Decimal
from core.models.base import BaseModel


class Voucher(BaseModel):
    """
    凭证模型
    
    用于管理会计凭证，支持多组织隔离。
    
    Attributes:
        id: 主键ID（自增ID，内部使用）
        uuid: 业务ID（UUID，对外暴露，安全且唯一，继承自BaseModel）
        tenant_id: 组织ID（用于多组织数据隔离，继承自BaseModel）
        voucher_no: 凭证编号（组织内唯一）
        voucher_date: 凭证日期
        voucher_type: 凭证类型（记账凭证、收款凭证、付款凭证、转账凭证）
        summary: 摘要
        total_debit: 借方合计
        total_credit: 贷方合计
        status: 状态（草稿、已审核、已过账、已作废）
        created_by: 制单人ID
        reviewed_by: 审核人ID
        reviewed_at: 审核时间
        posted_by: 过账人ID
        posted_at: 过账时间
        created_at: 创建时间（继承自BaseModel）
        updated_at: 更新时间（继承自BaseModel）
        deleted_at: 删除时间（软删除）
    """
    
    class Meta:
        """
        模型元数据
        """
        table = "apps_kuaiacc_vouchers"
        indexes = [
            ("tenant_id",),
            ("voucher_no",),
            ("uuid",),
            ("voucher_date",),
            ("voucher_type",),
            ("status",),
            ("created_by",),
        ]
        unique_together = [("tenant_id", "voucher_no")]
    
    # 主键
    id = fields.IntField(pk=True, description="主键ID")
    
    # 基本信息
    voucher_no = fields.CharField(max_length=50, description="凭证编号（组织内唯一，格式：记-001、收-001、付-001、转-001）")
    voucher_date = fields.DatetimeField(description="凭证日期")
    voucher_type = fields.CharField(max_length=50, description="凭证类型（记账凭证、收款凭证、付款凭证、转账凭证）")
    attachment_count = fields.IntField(default=0, description="附件数量（中国财务凭证通常需要附件）")
    summary = fields.TextField(null=True, description="摘要")
    
    # 金额信息
    total_debit = fields.DecimalField(max_digits=18, decimal_places=2, default=Decimal("0.00"), description="借方合计")
    total_credit = fields.DecimalField(max_digits=18, decimal_places=2, default=Decimal("0.00"), description="贷方合计")
    
    # 状态和审批（中国财务流程：制单->审核->过账）
    status = fields.CharField(max_length=20, default="草稿", description="状态（草稿、已审核、已过账、已作废）")
    created_by = fields.IntField(description="制单人ID")
    reviewed_by = fields.IntField(null=True, description="审核人ID")
    reviewed_at = fields.DatetimeField(null=True, description="审核时间")
    posted_by = fields.IntField(null=True, description="过账人ID")
    posted_at = fields.DatetimeField(null=True, description="过账时间")
    # 中国财务要求：凭证必须借贷平衡才能过账
    is_balanced = fields.BooleanField(default=False, description="是否借贷平衡（必须平衡才能过账）")
    
    # 软删除字段
    deleted_at = fields.DatetimeField(null=True, description="删除时间（软删除）")
    
    def __str__(self):
        """字符串表示"""
        return f"{self.voucher_no} - {self.voucher_date}"


class VoucherEntry(BaseModel):
    """
    凭证分录模型
    
    用于管理凭证分录，支持多组织隔离。
    
    Attributes:
        id: 主键ID（自增ID，内部使用）
        uuid: 业务ID（UUID，对外暴露，安全且唯一，继承自BaseModel）
        tenant_id: 组织ID（用于多组织数据隔离，继承自BaseModel）
        voucher_id: 凭证ID（关联Voucher）
        entry_no: 分录序号
        subject_id: 科目ID（关联AccountSubject）
        subject_code: 科目编码
        subject_name: 科目名称
        debit_amount: 借方金额
        credit_amount: 贷方金额
        summary: 摘要
        created_at: 创建时间（继承自BaseModel）
        updated_at: 更新时间（继承自BaseModel）
        deleted_at: 删除时间（软删除）
    """
    
    class Meta:
        """
        模型元数据
        """
        table = "apps_kuaiacc_voucher_entries"
        indexes = [
            ("tenant_id",),
            ("voucher_id",),
            ("uuid",),
            ("subject_id",),
            ("entry_no",),
        ]
    
    # 主键
    id = fields.IntField(pk=True, description="主键ID")
    
    # 关联信息
    voucher_id = fields.IntField(description="凭证ID（关联Voucher）")
    entry_no = fields.IntField(description="分录序号")
    
    # 科目信息
    subject_id = fields.IntField(description="科目ID（关联AccountSubject）")
    subject_code = fields.CharField(max_length=50, description="科目编码")
    subject_name = fields.CharField(max_length=200, description="科目名称")
    
    # 金额信息（中国财务：借贷记账法）
    debit_amount = fields.DecimalField(max_digits=18, decimal_places=2, default=Decimal("0.00"), description="借方金额")
    credit_amount = fields.DecimalField(max_digits=18, decimal_places=2, default=Decimal("0.00"), description="贷方金额")
    
    # 辅助核算信息（中国财务常用）
    customer_id = fields.IntField(null=True, description="客户ID（辅助核算：客户）")
    supplier_id = fields.IntField(null=True, description="供应商ID（辅助核算：供应商）")
    department_id = fields.IntField(null=True, description="部门ID（辅助核算：部门）")
    project_id = fields.IntField(null=True, description="项目ID（辅助核算：项目）")
    employee_id = fields.IntField(null=True, description="员工ID（辅助核算：员工）")
    
    # 数量金额式（中国财务常用）
    quantity = fields.DecimalField(max_digits=18, decimal_places=4, null=True, description="数量（用于数量金额式账页）")
    unit_price = fields.DecimalField(max_digits=18, decimal_places=4, null=True, description="单价（用于数量金额式账页）")
    
    # 其他信息
    summary = fields.TextField(null=True, description="摘要")
    
    # 软删除字段
    deleted_at = fields.DatetimeField(null=True, description="删除时间（软删除）")
    
    def __str__(self):
        """字符串表示"""
        return f"{self.voucher_id}-{self.entry_no} - {self.subject_code}"

