"""
组装单数据模型模块

定义组装单数据模型，支持多组件按 BOM 组装为成品的库存流程管理。
组装：消耗组件库存，增加成品库存。

Author: Luigi Lu
Date: 2026-02-26
"""

from tortoise import fields
from core.models.base import BaseModel


class AssemblyOrder(BaseModel):
    """
    组装单模型

    用于管理组装流程：多件原材料/半成品按 BOM 组装为成品。

    Attributes:
        id: 主键ID
        uuid: 业务ID
        tenant_id: 组织ID
        code: 组装单号
        warehouse_id: 仓库ID
        warehouse_name: 仓库名称
        assembly_date: 组装日期
        status: 状态（draft/in_progress/completed/cancelled）
        product_material_id: 成品物料ID
        product_material_code: 成品物料编码
        product_material_name: 成品物料名称
        total_quantity: 组装数量（成品数量）
        total_items: 组件明细数
        remarks: 备注
        executed_by/executed_at: 执行信息
    """

    class Meta:
        table = "apps_kuaizhizao_assembly_orders"
        table_description = "快格轻制造 - 组装单"
        indexes = [
            ("tenant_id",),
            ("warehouse_id",),
            ("assembly_date",),
            ("status",),
            ("created_at",),
        ]

    id = fields.IntField(pk=True, description="主键ID")
    code = fields.CharField(max_length=50, unique=True, description="组装单号")

    warehouse_id = fields.IntField(description="仓库ID")
    warehouse_name = fields.CharField(max_length=200, description="仓库名称")

    assembly_date = fields.DatetimeField(description="组装日期")
    status = fields.CharField(max_length=20, default="draft", description="状态（draft/in_progress/completed/cancelled）")

    product_material_id = fields.IntField(description="成品物料ID")
    product_material_code = fields.CharField(max_length=50, description="成品物料编码")
    product_material_name = fields.CharField(max_length=200, description="成品物料名称")

    total_quantity = fields.DecimalField(max_digits=12, decimal_places=2, default=0, description="组装数量（成品数量）")
    total_items = fields.IntField(default=0, description="组件明细数")

    remarks = fields.TextField(null=True, description="备注")

    created_by = fields.IntField(null=True, description="创建人ID")
    created_by_name = fields.CharField(max_length=100, null=True, description="创建人姓名")
    updated_by = fields.IntField(null=True, description="更新人ID")
    updated_by_name = fields.CharField(max_length=100, null=True, description="更新人姓名")
    executed_by = fields.IntField(null=True, description="执行人ID")
    executed_by_name = fields.CharField(max_length=100, null=True, description="执行人姓名")
    executed_at = fields.DatetimeField(null=True, description="执行时间")

    deleted_at = fields.DatetimeField(null=True, description="删除时间（软删除）")

    def __str__(self):
        return f"{self.code} - {self.product_material_name}"


class AssemblyOrderItem(BaseModel):
    """
    组装单明细模型

    记录组装单中每个组件的消耗数量。

    Attributes:
        assembly_order_id: 组装单ID
        material_id: 组件物料ID
        material_code: 组件物料编码
        material_name: 组件物料名称
        quantity: 消耗数量
        unit_price: 单价
        amount: 金额
        status: 状态（pending/consumed）
    """

    class Meta:
        table = "apps_kuaizhizao_assembly_order_items"
        table_description = "快格轻制造 - 组装单明细"
        indexes = [
            ("tenant_id",),
            ("assembly_order_id",),
            ("material_id",),
            ("status",),
        ]

    id = fields.IntField(pk=True, description="主键ID")
    assembly_order_id = fields.IntField(description="组装单ID")

    material_id = fields.IntField(description="组件物料ID")
    material_code = fields.CharField(max_length=50, description="组件物料编码")
    material_name = fields.CharField(max_length=200, description="组件物料名称")

    quantity = fields.DecimalField(max_digits=12, decimal_places=2, description="消耗数量")
    unit_price = fields.DecimalField(max_digits=12, decimal_places=2, default=0, description="单价")
    amount = fields.DecimalField(max_digits=12, decimal_places=2, default=0, description="金额")

    status = fields.CharField(max_length=20, default="pending", description="状态（pending/consumed）")
    remarks = fields.TextField(null=True, description="备注")

    deleted_at = fields.DatetimeField(null=True, description="删除时间（软删除）")

    def __str__(self):
        return f"{self.material_code} - {self.material_name} ({self.quantity})"
