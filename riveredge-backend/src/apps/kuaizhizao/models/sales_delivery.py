"""
销售出库单模型

提供销售出库单数据模型定义。

Author: Luigi Lu
Date: 2025-12-30
"""

from tortoise import fields
from core.models.base import BaseModel


class SalesDelivery(BaseModel):
    """
    销售出库单

    用于记录销售出库的详细信息
    """
    tenant_id = fields.IntField(description="租户ID")
    delivery_code = fields.CharField(max_length=50, unique=True, description="出库单编码")

    # 销售订单信息（MTO模式，MTS模式可为空）
    sales_order_id = fields.IntField(null=True, description="销售订单ID（MTO模式）")
    sales_order_code = fields.CharField(max_length=50, null=True, description="销售订单编码（MTO模式）")
    
    # 销售预测信息（MTS模式，MTO模式可为空）
    sales_forecast_id = fields.IntField(null=True, description="销售预测ID（MTS模式）")
    sales_forecast_code = fields.CharField(max_length=50, null=True, description="销售预测编码（MTS模式）")
    
    # 统一需求关联（销售出库与需求关联功能增强）
    demand_id = fields.IntField(null=True, description="需求ID（关联统一需求表，MTS关联销售预测，MTO关联销售订单）")
    demand_code = fields.CharField(max_length=50, null=True, description="需求编码")
    demand_type = fields.CharField(max_length=20, null=True, description="需求类型（sales_forecast/sales_order）")
    
    customer_id = fields.IntField(description="客户ID")
    customer_name = fields.CharField(max_length=200, description="客户名称")

    # 出库信息
    warehouse_id = fields.IntField(description="出库仓库ID")
    warehouse_name = fields.CharField(max_length=100, description="出库仓库名称")
    delivery_time = fields.DatetimeField(null=True, description="实际出库时间")

    # 出库人信息
    deliverer_id = fields.IntField(null=True, description="出库人ID")
    deliverer_name = fields.CharField(max_length=100, null=True, description="出库人姓名")

    # 审核信息
    reviewer_id = fields.IntField(null=True, description="审核人ID")
    reviewer_name = fields.CharField(max_length=100, null=True, description="审核人姓名")
    review_time = fields.DatetimeField(null=True, description="审核时间")
    review_status = fields.CharField(max_length=20, default="待审核", description="审核状态")
    review_remarks = fields.TextField(null=True, description="审核备注")

    status = fields.CharField(max_length=20, default="待出库", description="出库状态")
    total_quantity = fields.DecimalField(max_digits=10, decimal_places=2, default=0, description="总出库数量")
    total_amount = fields.DecimalField(max_digits=12, decimal_places=2, default=0, description="总金额")

    # 物流信息
    shipping_method = fields.CharField(max_length=50, null=True, description="发货方式")
    tracking_number = fields.CharField(max_length=100, null=True, description="物流单号")
    shipping_address = fields.TextField(null=True, description="收货地址")

    notes = fields.TextField(null=True, description="备注")
    is_active = fields.BooleanField(default=True, description="是否有效")
    created_by = fields.IntField(null=True, description="创建人ID")
    updated_by = fields.IntField(null=True, description="更新人ID")
    deleted_at = fields.DatetimeField(null=True, description="删除时间")

    class Meta:
        table = "apps_kuaizhizao_sales_deliveries"
        table_description = "快格轻制造 - 销售出库单"
        indexes = [
            ("tenant_id",),
            ("delivery_code",),
            ("sales_order_id",),
            ("sales_forecast_id",),
            ("demand_id",),  # 需求关联索引（销售出库与需求关联功能增强）
            ("customer_id",),
            ("warehouse_id",),
            ("status",),
        ]

    class PydanticMeta:
        exclude = ["deleted_at"]
