"""
成品入库单模型

提供成品入库单数据模型定义。

Author: Luigi Lu
Date: 2025-12-30
"""

from tortoise import fields
from core.models.base import BaseModel


class FinishedGoodsReceipt(BaseModel):
    """
    成品入库单

    用于记录生产完工后的成品入库信息
    """
    tenant_id = fields.IntField(description="租户ID")
    receipt_code = fields.CharField(max_length=50, unique=True, description="入库单编码")
    work_order_id = fields.IntField(description="工单ID")
    work_order_code = fields.CharField(max_length=50, description="工单编码")

    # 销售订单信息（MTO模式）
    sales_order_id = fields.IntField(null=True, description="销售订单ID")
    sales_order_code = fields.CharField(max_length=50, null=True, description="销售订单编码")

    # 入库信息
    warehouse_id = fields.IntField(description="入库仓库ID")
    warehouse_name = fields.CharField(max_length=100, description="入库仓库名称")
    receipt_time = fields.DatetimeField(null=True, description="实际入库时间")

    # 入库人信息
    receiver_id = fields.IntField(null=True, description="入库人ID")
    receiver_name = fields.CharField(max_length=100, null=True, description="入库人姓名")

    # 审核信息
    reviewer_id = fields.IntField(null=True, description="审核人ID")
    reviewer_name = fields.CharField(max_length=100, null=True, description="审核人姓名")
    review_time = fields.DatetimeField(null=True, description="审核时间")
    review_status = fields.CharField(max_length=20, default="待审核", description="审核状态")
    review_remarks = fields.TextField(null=True, description="审核备注")

    status = fields.CharField(max_length=20, default="待入库", description="入库状态")
    total_quantity = fields.DecimalField(max_digits=10, decimal_places=2, default=0, description="总入库数量")

    notes = fields.TextField(null=True, description="备注")
    is_active = fields.BooleanField(default=True, description="是否有效")
    created_by = fields.IntField(null=True, description="创建人ID")
    updated_by = fields.IntField(null=True, description="更新人ID")
    deleted_at = fields.DatetimeField(null=True, description="删除时间")

    class Meta:
        table = "apps_kuaizhizao_finished_goods_receipts"
        table_description = "快格轻制造 - 成品入库单"

    class PydanticMeta:
        exclude = ["deleted_at"]
