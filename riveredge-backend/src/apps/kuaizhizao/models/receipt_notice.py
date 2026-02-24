"""
收货通知单模型

采购通知仓库收货，不直接动库存。来源为采购订单。

Author: RiverEdge Team
Date: 2026-02-22
"""

from tortoise import fields
from core.models.base import BaseModel


class ReceiptNotice(BaseModel):
    """
    收货通知单

    采购创建，通知仓库收货；不直接动库存。
    """
    tenant_id = fields.IntField(description="租户ID")
    notice_code = fields.CharField(max_length=50, unique=True, description="通知单编码")

    # 关联单据
    purchase_order_id = fields.IntField(description="采购订单ID")
    purchase_order_code = fields.CharField(max_length=50, description="采购订单编码")

    # 供应商信息
    supplier_id = fields.IntField(description="供应商ID")
    supplier_name = fields.CharField(max_length=200, description="供应商名称")
    supplier_contact = fields.CharField(max_length=100, null=True, description="供应商联系人")
    supplier_phone = fields.CharField(max_length=50, null=True, description="供应商电话")

    # 入库仓库
    warehouse_id = fields.IntField(null=True, description="入库仓库ID")
    warehouse_name = fields.CharField(max_length=100, null=True, description="入库仓库名称")

    # 计划收货日期
    planned_receipt_date = fields.DateField(null=True, description="计划收货日期")

    # 状态：待收货/已通知/已入库
    status = fields.CharField(max_length=20, default="待收货", description="通知状态")
    notified_at = fields.DatetimeField(null=True, description="通知仓库时间")
    purchase_receipt_id = fields.IntField(null=True, description="采购入库单ID（已入库时关联）")
    purchase_receipt_code = fields.CharField(max_length=50, null=True, description="采购入库单编码")

    total_quantity = fields.DecimalField(max_digits=10, decimal_places=2, default=0, description="总数量")
    total_amount = fields.DecimalField(max_digits=12, decimal_places=2, default=0, description="总金额")

    notes = fields.TextField(null=True, description="备注")
    is_active = fields.BooleanField(default=True, description="是否有效")
    created_by = fields.IntField(null=True, description="创建人ID")
    updated_by = fields.IntField(null=True, description="更新人ID")
    deleted_at = fields.DatetimeField(null=True, description="删除时间")

    class Meta:
        table = "apps_kuaizhizao_receipt_notices"
        table_description = "快格轻制造 - 收货通知单"
        indexes = [
            ("tenant_id",),
            ("notice_code",),
            ("purchase_order_id",),
            ("supplier_id",),
            ("status",),
        ]

    class PydanticMeta:
        exclude = ["deleted_at"]
