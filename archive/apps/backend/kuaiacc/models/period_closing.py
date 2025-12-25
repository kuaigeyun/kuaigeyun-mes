"""
期末结账模型模块

定义期末结账数据模型，支持多组织隔离。
按照中国财务规范：月结、年结流程。
"""

from tortoise import fields
from core.models.base import BaseModel


class PeriodClosing(BaseModel):
    """
    期末结账模型
    
    用于管理期末结账，支持多组织隔离。
    按照中国财务规范：月结、年结流程。
    
    Attributes:
        id: 主键ID（自增ID，内部使用）
        uuid: 业务ID（UUID，对外暴露，安全且唯一，继承自BaseModel）
        tenant_id: 组织ID（用于多组织数据隔离，继承自BaseModel）
        closing_no: 结账编号（组织内唯一）
        closing_type: 结账类型（月结、年结）
        closing_period: 结账期间（格式：2024-01、2024）
        closing_date: 结账日期
        status: 状态（待结账、结账中、已结账、已反结账）
        check_items: 检查项（凭证是否全部过账、是否借贷平衡等）
        check_result: 检查结果
        closed_by: 结账人ID
        closed_at: 结账时间
        created_at: 创建时间（继承自BaseModel）
        updated_at: 更新时间（继承自BaseModel）
        deleted_at: 删除时间（软删除）
    """
    
    class Meta:
        """
        模型元数据
        """
        table = "apps_kuaiacc_period_closings"
        indexes = [
            ("tenant_id",),
            ("closing_no",),
            ("uuid",),
            ("closing_period",),
            ("closing_type",),
            ("status",),
        ]
        unique_together = [("tenant_id", "closing_period", "closing_type")]
    
    # 主键
    id = fields.IntField(pk=True, description="主键ID")
    
    # 基本信息
    closing_no = fields.CharField(max_length=50, description="结账编号（组织内唯一）")
    closing_type = fields.CharField(max_length=20, description="结账类型（月结、年结）")
    closing_period = fields.CharField(max_length=20, description="结账期间（格式：2024-01、2024）")
    closing_date = fields.DatetimeField(description="结账日期")
    
    # 状态和检查
    status = fields.CharField(max_length=20, default="待结账", description="状态（待结账、结账中、已结账、已反结账）")
    check_items = fields.JSONField(null=True, description="检查项（凭证是否全部过账、是否借贷平衡、是否有未审核凭证等）")
    check_result = fields.JSONField(null=True, description="检查结果")
    
    # 结账信息
    closed_by = fields.IntField(null=True, description="结账人ID")
    closed_at = fields.DatetimeField(null=True, description="结账时间")
    
    # 软删除字段
    deleted_at = fields.DatetimeField(null=True, description="删除时间（软删除）")
    
    def __str__(self):
        """字符串表示"""
        return f"{self.closing_period} - {self.closing_type}"

