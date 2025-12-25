"""
报价单模型模块

定义报价单数据模型，支持多组织隔离。
"""

from tortoise import fields
from decimal import Decimal
from core.models.base import BaseModel


class Quotation(BaseModel):
    """
    报价单模型
    
    用于管理报价单，支持多组织隔离。
    
    Attributes:
        id: 主键ID（自增ID，内部使用）
        uuid: 业务ID（UUID，对外暴露，安全且唯一，继承自BaseModel）
        tenant_id: 组织ID（用于多组织数据隔离，继承自BaseModel）
        quotation_no: 报价单编号（组织内唯一）
        quotation_date: 报价日期
        customer_id: 客户ID（关联master-data）
        opportunity_id: 关联商机ID（可选，从商机转化）
        lead_id: 关联线索ID（可选，从线索转化）
        status: 报价单状态（草稿、已发送、已接受、已拒绝、已过期）
        total_amount: 报价金额
        valid_until: 有效期至
        description: 描述
        terms: 条款说明
        created_at: 创建时间（继承自BaseModel）
        updated_at: 更新时间（继承自BaseModel）
        deleted_at: 删除时间（软删除）
    """
    
    class Meta:
        """
        模型元数据
        """
        table = "apps_kuaicrm_quotations"
        indexes = [
            ("tenant_id",),
            ("quotation_no",),
            ("uuid",),
            ("status",),
            ("customer_id",),
            ("opportunity_id",),
            ("lead_id",),
            ("quotation_date",),
        ]
        unique_together = [("tenant_id", "quotation_no")]
    
    # 主键
    id = fields.IntField(pk=True, description="主键ID")
    
    # 基本信息
    quotation_no = fields.CharField(max_length=50, description="报价单编号（组织内唯一）")
    quotation_date = fields.DatetimeField(description="报价日期")
    customer_id = fields.IntField(description="客户ID（关联master-data）")
    opportunity_id = fields.IntField(null=True, description="关联商机ID（可选，从商机转化）")
    lead_id = fields.IntField(null=True, description="关联线索ID（可选，从线索转化）")
    
    # 报价状态和金额
    status = fields.CharField(max_length=50, default="草稿", description="报价单状态（草稿、已发送、已接受、已拒绝、已过期）")
    total_amount = fields.DecimalField(max_digits=18, decimal_places=2, description="报价金额")
    valid_until = fields.DatetimeField(null=True, description="有效期至")
    
    # 描述和条款
    description = fields.TextField(null=True, description="描述")
    terms = fields.TextField(null=True, description="条款说明")
    
    # 软删除字段
    deleted_at = fields.DatetimeField(null=True, description="删除时间（软删除）")
    
    def __str__(self):
        """字符串表示"""
        return f"{self.quotation_no} - {self.total_amount}"

