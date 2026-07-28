"""
采购订单模型

提供采购订单数据模型定义，包括订单头和订单行信息。

Author: Luigi Lu
Date: 2025-12-30
"""

from tortoise import fields
from core.models.base import BaseModel
from apps.kuaizhizao.constants import DocumentStatus, ReviewStatus
from decimal import Decimal


def effective_po_item_outstanding(item: "PurchaseOrderItem") -> Decimal:
    """未到货数量：ordered - received 为真源；stored 仅作上限，避免与 received 不一致时重复下推。"""
    ordered = Decimal(str(item.ordered_quantity or 0))
    received = Decimal(str(item.received_quantity or 0))
    stored = Decimal(str(item.outstanding_quantity or 0))
    computed = max(Decimal("0"), ordered - received)
    if stored <= 0:
        return computed
    return min(stored, computed)


class PurchaseOrder(BaseModel):
    """
    采购订单头

    记录采购订单的基本信息和状态
    """
    tenant_id = fields.IntField(description="租户ID")
    order_code = fields.CharField(max_length=50, db_index=True, description="订单编码")  # 租户内未删除唯一，见迁移 462

    # 供应商信息
    supplier_id = fields.IntField(description="供应商ID")
    supplier_name = fields.CharField(max_length=200, description="供应商名称")
    supplier_contact = fields.CharField(max_length=100, null=True, description="供应商联系人")
    supplier_phone = fields.CharField(max_length=20, null=True, description="供应商电话")

    # 归属采购员
    buyer_id = fields.IntField(null=True, description="归属采购员ID（关联 User.id）")
    buyer_name = fields.CharField(max_length=100, null=True, description="归属采购员姓名")

    # 订单基本信息
    order_date = fields.DateField(description="订单日期")
    delivery_date = fields.DateField(description="要求到货日期")
    order_type = fields.CharField(max_length=20, default="标准采购", description="订单类型")

    # 金额信息
    total_quantity = fields.DecimalField(max_digits=10, decimal_places=2, default=0, description="总数量")
    total_amount = fields.DecimalField(max_digits=12, decimal_places=2, default=0, description="订单总金额")
    tax_rate = fields.DecimalField(max_digits=5, decimal_places=2, default=0, description="税率")
    tax_amount = fields.DecimalField(max_digits=12, decimal_places=2, default=0, description="税额")
    net_amount = fields.DecimalField(max_digits=12, decimal_places=2, default=0, description="净金额")

    # 费用信息
    fee_details = fields.JSONField(null=True, description="费用明细 (JSON)")
    total_fee_amount = fields.DecimalField(max_digits=12, decimal_places=2, default=0, description="总费用金额")

    # 币种和汇率
    currency = fields.CharField(max_length=10, default="CNY", description="币种")
    exchange_rate = fields.DecimalField(max_digits=8, decimal_places=4, default=1, description="汇率")

    # 订单状态
    status = fields.CharField(max_length=20, default=DocumentStatus.DRAFT.value, description="订单状态")

    # 审核信息
    reviewer_id = fields.IntField(null=True, description="审核人ID")
    reviewer_name = fields.CharField(max_length=100, null=True, description="审核人姓名")
    review_time = fields.DatetimeField(null=True, description="审核时间")
    review_status = fields.CharField(max_length=20, default=ReviewStatus.PENDING.value, description="审核状态")
    review_remarks = fields.TextField(null=True, description="审核备注")

    # 来源信息（用于关联MRP/LRP运算结果）
    source_type = fields.CharField(max_length=50, null=True, description="来源类型 (MRP/LRP)")
    source_id = fields.IntField(null=True, description="来源ID")

    # 备注
    notes = fields.TextField(null=True, description="备注")

    # 附件
    attachments = fields.JSONField(null=True, description="附件列表")

    deleted_at = fields.DatetimeField(null=True, description="删除时间")

    # 关联订单行
    items: fields.ReverseRelation["PurchaseOrderItem"]

    class Meta:
        table = "apps_kuaizhizao_purchase_orders"
        table_description = "快格轻制造 - 采购订单"

    class PydanticMeta:
        exclude = ["deleted_at"]


class PurchaseOrderItem(BaseModel):
    """
    采购订单行

    记录采购订单中每个物料的详细信息
    """
    tenant_id = fields.IntField(description="租户ID")

    # 关联订单（ForeignKeyField 会自动创建 order_id 字段）
    order: fields.ForeignKeyRelation[PurchaseOrder] = fields.ForeignKeyField(
        "models.PurchaseOrder", related_name="items", description="关联订单"
    )

    # 物料信息
    material_id = fields.IntField(description="物料ID")
    material_code = fields.CharField(max_length=50, description="物料编码")
    material_name = fields.CharField(max_length=200, description="物料名称")
    material_spec = fields.CharField(max_length=200, null=True, description="物料规格")

    # 采购信息
    ordered_quantity = fields.DecimalField(max_digits=10, decimal_places=2, description="采购数量")
    unit = fields.CharField(max_length=20, description="单位")
    unit_price = fields.DecimalField(max_digits=10, decimal_places=4, description="单价")
    total_price = fields.DecimalField(max_digits=12, decimal_places=2, description="总价")

    # 到货信息
    received_quantity = fields.DecimalField(max_digits=10, decimal_places=2, default=0, description="已到货数量")
    outstanding_quantity = fields.DecimalField(max_digits=10, decimal_places=2, default=0, description="未到货数量")

    # 要求到货日期
    required_date = fields.DateField(description="要求到货日期")
    actual_delivery_date = fields.DateField(null=True, description="实际到货日期")

    # 质量要求
    quality_requirements = fields.TextField(null=True, description="质量要求")
    inspection_required = fields.BooleanField(default=True, description="是否需要检验")

    # 来源信息（用于关联MRP/LRP运算结果）
    source_type = fields.CharField(max_length=50, null=True, description="来源类型")
    source_id = fields.IntField(null=True, description="来源ID")

    # 备注
    notes = fields.TextField(null=True, description="备注")

    # 费用分摊 (V2 增强)
    landing_cost = fields.DecimalField(max_digits=12, decimal_places=2, default=0, description="分摊杂费/落地成本")
    additional_fees_details = fields.JSONField(null=True, description="杂费分摊明细 (JSON)")

    deleted_at = fields.DatetimeField(null=True, description="删除时间")

    class Meta:
        table = "apps_kuaizhizao_purchase_order_items"
        table_description = "快格轻制造 - 采购订单明细"

    class PydanticMeta:
        exclude = ["deleted_at"]


class PurchaseOrderChange(BaseModel):
    """
    采购订单变更记录 (Audit Ready)
    """
    tenant_id = fields.IntField(description="租户ID")
    order = fields.ForeignKeyField("models.PurchaseOrder", related_name="changes", description="关联订单")
    
    change_type = fields.CharField(max_length=50, description="变更类型 (Modify/Cancel/Price/Quantity)")
    field_name = fields.CharField(max_length=100, null=True, description="变更字段")
    old_value = fields.TextField(null=True, description="旧值")
    new_value = fields.TextField(null=True, description="新值")
    
    reason = fields.TextField(null=True, description="变更原因")
    operator_id = fields.IntField(description="操作人ID")
    operator_name = fields.CharField(max_length=100, description="操作人姓名")

    class Meta:
        table = "apps_kuaizhizao_purchase_order_changes"
        table_description = "快格轻制造 - 采购订单变更日志"
