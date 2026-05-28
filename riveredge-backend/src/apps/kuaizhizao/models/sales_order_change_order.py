"""销售变更单模型"""

from tortoise import fields
from core.models.base import BaseModel
from apps.kuaizhizao.constants import DocumentStatus, ReviewStatus


class SalesOrderChangeOrder(BaseModel):
    tenant_id = fields.IntField(description="租户ID")
    change_code = fields.CharField(max_length=50, unique=True, description="变更单编码")

    source_order_id = fields.IntField(description="原销售订单ID")
    source_order_code = fields.CharField(max_length=50, description="原销售订单编码")
    change_version = fields.IntField(default=1, description="同原单第N次变更")

    customer_id = fields.IntField(description="客户ID")
    customer_name = fields.CharField(max_length=200, description="客户名称")

    change_reason = fields.TextField(description="变更原因")
    change_category = fields.CharField(max_length=30, default="MIXED", description="变更类别")
    effective_date = fields.DateField(null=True, description="计划生效日期")

    status = fields.CharField(max_length=20, default=DocumentStatus.DRAFT.value, description="状态")
    review_status = fields.CharField(max_length=20, default=ReviewStatus.PENDING.value, description="审核状态")
    reviewer_id = fields.IntField(null=True, description="审核人ID")
    reviewer_name = fields.CharField(max_length=100, null=True, description="审核人姓名")
    review_time = fields.DatetimeField(null=True, description="审核时间")
    review_remarks = fields.TextField(null=True, description="审核备注")

    before_total_quantity = fields.DecimalField(max_digits=12, decimal_places=2, default=0)
    after_total_quantity = fields.DecimalField(max_digits=12, decimal_places=2, default=0)
    before_total_amount = fields.DecimalField(max_digits=14, decimal_places=2, default=0)
    after_total_amount = fields.DecimalField(max_digits=14, decimal_places=2, default=0)
    delta_amount = fields.DecimalField(max_digits=14, decimal_places=2, default=0)

    applied_at = fields.DatetimeField(null=True, description="生效时间")
    applied_by = fields.IntField(null=True, description="生效操作人")
    header_changes = fields.JSONField(null=True, description="表头变更 JSON patch")

    attachments = fields.JSONField(null=True, description="附件")
    notes = fields.TextField(null=True, description="备注")
    is_active = fields.BooleanField(default=True)
    created_by = fields.IntField(null=True)
    updated_by = fields.IntField(null=True)
    deleted_at = fields.DatetimeField(null=True)

    items: fields.ReverseRelation["SalesOrderChangeItem"]

    class Meta:
        table = "apps_kuaizhizao_sales_order_change_orders"
        indexes = [
            ("tenant_id",),
            ("change_code",),
            ("source_order_id",),
            ("status",),
        ]


class SalesOrderChangeItem(BaseModel):
    tenant_id = fields.IntField(description="租户ID")
    change_order: fields.ForeignKeyRelation[SalesOrderChangeOrder] = fields.ForeignKeyField(
        "models.SalesOrderChangeOrder", related_name="items", description="变更单"
    )
    line_no = fields.IntField(default=1, description="行号")
    source_item_id = fields.IntField(null=True, description="原订单行ID")

    change_type = fields.CharField(max_length=30, description="变更类型")
    material_id = fields.IntField(null=True)
    material_code = fields.CharField(max_length=50, null=True)
    material_name = fields.CharField(max_length=200, null=True)
    material_spec = fields.CharField(max_length=200, null=True)
    material_unit = fields.CharField(max_length=20, null=True)

    before_quantity = fields.DecimalField(max_digits=12, decimal_places=2, null=True)
    after_quantity = fields.DecimalField(max_digits=12, decimal_places=2, null=True)
    before_unit_price = fields.DecimalField(max_digits=12, decimal_places=4, null=True)
    after_unit_price = fields.DecimalField(max_digits=12, decimal_places=4, null=True)
    before_delivery_date = fields.DateField(null=True)
    after_delivery_date = fields.DateField(null=True)
    before_amount = fields.DecimalField(max_digits=14, decimal_places=2, null=True)
    after_amount = fields.DecimalField(max_digits=14, decimal_places=2, null=True)
    delta_amount = fields.DecimalField(max_digits=14, decimal_places=2, default=0)

    notes = fields.TextField(null=True)

    class Meta:
        table = "apps_kuaizhizao_sales_order_change_items"
        indexes = [("tenant_id",), ("change_order_id",), ("source_item_id",)]
