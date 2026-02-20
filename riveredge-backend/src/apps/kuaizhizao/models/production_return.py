"""
生产退料单模型

提供生产退料单数据模型定义，用于记录领料后退回仓库的物料。

Author: RiverEdge Team
Date: 2026-02-19
"""

from tortoise import fields
from core.models.base import BaseModel


class ProductionReturn(BaseModel):
    """
    生产退料单

    用于记录生产工单领料后退回仓库的详细信息
    """
    tenant_id = fields.IntField(description="租户ID")
    return_code = fields.CharField(max_length=50, unique=True, description="退料单编码")
    work_order_id = fields.IntField(description="工单ID")
    work_order_code = fields.CharField(max_length=50, description="工单编码")
    picking_id = fields.IntField(null=True, description="领料单ID")
    picking_code = fields.CharField(max_length=50, null=True, description="领料单编码")
    workshop_id = fields.IntField(null=True, description="车间ID")
    workshop_name = fields.CharField(max_length=100, null=True, description="车间名称")
    warehouse_id = fields.IntField(description="退料目标仓库ID")
    warehouse_name = fields.CharField(max_length=100, description="退料目标仓库名称")
    status = fields.CharField(max_length=20, default="待退料", description="退料状态")

    # 退料人信息
    returner_id = fields.IntField(null=True, description="退料人ID")
    returner_name = fields.CharField(max_length=100, null=True, description="退料人姓名")
    return_time = fields.DatetimeField(null=True, description="退料时间")

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
        table = "apps_kuaizhizao_production_returns"
        table_description = "快格轻制造 - 生产退料单"
        indexes = [
            ("tenant_id",),
            ("work_order_id",),
            ("picking_id",),
            ("status",),
        ]

    class PydanticMeta:
        exclude = ["deleted_at"]
