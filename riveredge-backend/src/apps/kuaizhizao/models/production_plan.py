"""
生产计划模型

提供生产计划数据模型定义。

Author: Luigi Lu
Date: 2025-12-30
"""

from tortoise import fields
from core.models.base import BaseModel


class ProductionPlan(BaseModel):
    """
    生产计划

    存储MRP/LRP运算结果的生产计划
    """
    tenant_id = fields.IntField(description="租户ID")
    plan_code = fields.CharField(max_length=50, unique=True, description="计划编码")

    # 计划基本信息
    plan_name = fields.CharField(max_length=200, description="计划名称")
    plan_type = fields.CharField(max_length=20, description="计划类型（MRP/LRP）")

    # 来源单据
    source_type = fields.CharField(max_length=20, description="来源类型")
    source_id = fields.IntField(description="来源ID")
    source_code = fields.CharField(max_length=50, description="来源编码")

    # 时间范围
    plan_start_date = fields.DateField(description="计划开始日期")
    plan_end_date = fields.DateField(description="计划结束日期")

    # 状态
    status = fields.CharField(max_length=20, default="草稿", description="计划状态")
    execution_status = fields.CharField(max_length=20, default="未执行", description="执行状态")

    # 统计信息
    total_work_orders = fields.IntField(default=0, description="总工单数")
    total_purchase_orders = fields.IntField(default=0, description="总采购订单数")
    total_cost = fields.DecimalField(max_digits=12, decimal_places=2, default=0, description="总成本")

    # 审核信息
    reviewer_id = fields.IntField(null=True, description="审核人ID")
    reviewer_name = fields.CharField(max_length=100, null=True, description="审核人姓名")
    review_time = fields.DatetimeField(null=True, description="审核时间")
    review_status = fields.CharField(max_length=20, default="待审核", description="审核状态")
    review_remarks = fields.TextField(null=True, description="审核备注")

    notes = fields.TextField(null=True, description="备注")
    is_active = fields.BooleanField(default=True, description="是否有效")
    created_by = fields.IntField(null=True, description="创建人ID")
    updated_by = fields.IntField(null=True, description="更新人ID")
    deleted_at = fields.DatetimeField(null=True, description="删除时间")

    class Meta:
        table = "apps_kuaizhizao_production_plans"
        table_description = "快格轻制造 - 生产计划"
        indexes = [
            ("tenant_id", "plan_type"),
            ("tenant_id", "source_id"),
            ("status",),
            ("plan_start_date", "plan_end_date"),
        ]

    class PydanticMeta:
        exclude = ["deleted_at"]
