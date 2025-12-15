"""
财务报表模型模块

定义财务报表数据模型，支持多组织隔离。
按照中国企业会计准则：资产负债表、利润表、现金流量表。
"""

from tortoise import fields
from decimal import Decimal
from core.models.base import BaseModel


class FinancialReport(BaseModel):
    """
    财务报表模型
    
    用于管理财务报表，支持多组织隔离。
    按照中国企业会计准则：资产负债表、利润表、现金流量表。
    
    Attributes:
        id: 主键ID（自增ID，内部使用）
        uuid: 业务ID（UUID，对外暴露，安全且唯一，继承自BaseModel）
        tenant_id: 组织ID（用于多组织数据隔离，继承自BaseModel）
        report_no: 报表编号（组织内唯一）
        report_type: 报表类型（资产负债表、利润表、现金流量表、成本报表）
        report_period: 报表期间（格式：2024-01、2024）
        report_date: 报表日期
        year: 年度
        month: 月份（月报时使用，年报为null）
        report_data: 报表数据（JSON格式，存储报表各项数据）
        status: 状态（草稿、已生成、已审核、已发布）
        reviewed_by: 审核人ID
        reviewed_at: 审核时间
        created_at: 创建时间（继承自BaseModel）
        updated_at: 更新时间（继承自BaseModel）
        deleted_at: 删除时间（软删除）
    """
    
    class Meta:
        """
        模型元数据
        """
        table = "seed_kuaiacc_financial_reports"
        indexes = [
            ("tenant_id",),
            ("report_no",),
            ("uuid",),
            ("report_type",),
            ("report_period",),
            ("year",),
            ("month",),
            ("status",),
        ]
        unique_together = [("tenant_id", "report_type", "report_period")]
    
    # 主键
    id = fields.IntField(pk=True, description="主键ID")
    
    # 基本信息
    report_no = fields.CharField(max_length=50, description="报表编号（组织内唯一）")
    report_type = fields.CharField(max_length=50, description="报表类型（资产负债表、利润表、现金流量表、成本报表）")
    report_period = fields.CharField(max_length=20, description="报表期间（格式：2024-01、2024）")
    report_date = fields.DatetimeField(description="报表日期")
    
    # 期间信息
    year = fields.IntField(description="年度")
    month = fields.IntField(null=True, description="月份（月报时使用，年报为null）")
    
    # 报表数据（按照中国企业会计准则格式）
    report_data = fields.JSONField(null=True, description="报表数据（JSON格式，存储报表各项数据）")
    
    # 状态和审核
    status = fields.CharField(max_length=20, default="草稿", description="状态（草稿、已生成、已审核、已发布）")
    reviewed_by = fields.IntField(null=True, description="审核人ID")
    reviewed_at = fields.DatetimeField(null=True, description="审核时间")
    
    # 软删除字段
    deleted_at = fields.DatetimeField(null=True, description="删除时间（软删除）")
    
    def __str__(self):
        """字符串表示"""
        return f"{self.report_type} - {self.report_period}"

