"""
样品试用单模型

客户申请样品试用，可转正式销售订单，样品出库可通过其他出库（原因：样品）。

Author: RiverEdge Team
Date: 2026-02-19
"""

from tortoise import fields
from core.models.base import BaseModel


class SampleTrial(BaseModel):
    """
    样品试用单

    用于记录客户样品试用申请，可转正式销售订单
    """
    tenant_id = fields.IntField(description="租户ID")
    trial_code = fields.CharField(max_length=50, unique=True, description="试用单编码")

    # 客户信息
    customer_id = fields.IntField(description="客户ID")
    customer_name = fields.CharField(max_length=200, description="客户名称")
    customer_contact = fields.CharField(max_length=100, null=True, description="客户联系人")
    customer_phone = fields.CharField(max_length=50, null=True, description="客户电话")

    # 试用信息
    trial_purpose = fields.CharField(max_length=200, null=True, description="试用目的")
    trial_period_start = fields.DateField(null=True, description="试用开始日期")
    trial_period_end = fields.DateField(null=True, description="试用结束日期")

    # 转订单后关联
    sales_order_id = fields.IntField(null=True, description="关联销售订单ID（转订单后）")
    sales_order_code = fields.CharField(max_length=50, null=True, description="关联销售订单编码")

    # 样品出库关联
    other_outbound_id = fields.IntField(null=True, description="关联其他出库单ID（样品出库）")
    other_outbound_code = fields.CharField(max_length=50, null=True, description="关联其他出库单编码")

    # 状态：草稿/已审批/试用中/已归还/已转订单/已关闭
    status = fields.CharField(max_length=20, default="草稿", description="试用状态")

    total_quantity = fields.DecimalField(max_digits=10, decimal_places=2, default=0, description="总数量")
    total_amount = fields.DecimalField(max_digits=12, decimal_places=2, default=0, description="总金额")

    notes = fields.TextField(null=True, description="备注")
    is_active = fields.BooleanField(default=True, description="是否有效")
    created_by = fields.IntField(null=True, description="创建人ID")
    updated_by = fields.IntField(null=True, description="更新人ID")
    deleted_at = fields.DatetimeField(null=True, description="删除时间")

    class Meta:
        table = "apps_kuaizhizao_sample_trials"
        table_description = "快格轻制造 - 样品试用单"
        indexes = [
            ("tenant_id",),
            ("trial_code",),
            ("customer_id",),
            ("status",),
            ("sales_order_id",),
        ]

    class PydanticMeta:
        exclude = ["deleted_at"]
