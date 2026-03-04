"""
采购物流记录模型

供应商发货后录入运单号，用于在途物流跟踪。独立于收货通知单（已到货后通知仓库）。

Author: RiverEdge Team
Date: 2026-03-04
"""

from tortoise import fields
from core.models.base import BaseModel


class PurchaseLogistics(BaseModel):
    """
    采购物流记录

    供应商发货后录入，跟踪在途状态。到货后可关联收货通知单。
    """
    tenant_id = fields.IntField(description="租户ID")

    # 关联采购订单
    purchase_order_id = fields.IntField(description="采购订单ID")
    purchase_order_code = fields.CharField(max_length=50, description="采购订单编码")

    # 供应商信息
    supplier_id = fields.IntField(description="供应商ID")
    supplier_name = fields.CharField(max_length=200, description="供应商名称")

    # 物流信息
    carrier = fields.CharField(max_length=100, description="承运商/物流公司")
    tracking_number = fields.CharField(max_length=100, description="物流运单号")
    shipped_at = fields.DateField(null=True, description="发货日期")
    expected_arrival = fields.DateField(null=True, description="预计到货日期")

    # 状态：在途/已签收/异常
    status = fields.CharField(max_length=20, default="在途", description="物流状态")

    # 到货后关联
    receipt_notice_id = fields.IntField(null=True, description="关联收货通知单ID")
    receipt_notice_code = fields.CharField(max_length=50, null=True, description="收货通知单编码")

    notes = fields.TextField(null=True, description="备注")
    created_by = fields.IntField(null=True, description="创建人ID")
    updated_by = fields.IntField(null=True, description="更新人ID")

    class Meta:
        table = "apps_kuaizhizao_purchase_logistics"
        table_description = "快格轻制造 - 采购物流记录"
        indexes = [
            ("tenant_id",),
            ("purchase_order_id",),
            ("supplier_id",),
            ("tracking_number",),
            ("status",),
        ]
