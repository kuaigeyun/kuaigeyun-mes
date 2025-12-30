"""
生产领料单模型

提供生产领料单数据模型定义。

Author: Luigi Lu
Date: 2025-12-30
"""

from tortoise import fields
from core.models.base import BaseModel


class ProductionPicking(BaseModel):
    """
    生产领料单

    用于记录生产工单领料的详细信息
    """
    tenant_id = fields.IntField(description="租户ID")
    picking_code = fields.CharField(max_length=50, unique=True, description="领料单编码")
    work_order_id = fields.IntField(description="工单ID")
    work_order_code = fields.CharField(max_length=50, description="工单编码")
    workshop_id = fields.IntField(null=True, description="车间ID")
    workshop_name = fields.CharField(max_length=100, null=True, description="车间名称")
    status = fields.CharField(max_length=20, default="待领料", description="领料状态")

    # 领料人信息
    picker_id = fields.IntField(null=True, description="领料人ID")
    picker_name = fields.CharField(max_length=100, null=True, description="领料人姓名")
    picking_time = fields.DatetimeField(null=True, description="领料时间")

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
        table = "apps_kuaizhizao_production_pickings"
        table_description = "快格轻制造 - 生产领料单"

    class PydanticMeta:
        exclude = ["deleted_at"]
