"""
装配物料绑定数据模型模块

定义组装单执行时的父件-子件-批次追溯关系。
用于质量追溯：记录每个产出成品（或批次）消耗了哪些子件（含批次）。

Author: Luigi Lu
Date: 2026-02-28
"""

from tortoise import fields
from core.models.base import BaseModel


class AssemblyMaterialBinding(BaseModel):
    """
    装配物料绑定模型

    组装单执行时记录父件-子件-批次追溯关系。

    Attributes:
        assembly_order_id: 组装单ID
        assembly_order_item_id: 组装单明细ID（可选）
        parent_material_id: 父件（成品）物料ID
        parent_material_code: 父件物料编码
        parent_material_name: 父件物料名称
        parent_batch_no: 父件批次号（可选）
        child_material_id: 子件物料ID
        child_material_code: 子件物料编码
        child_material_name: 子件物料名称
        child_batch_no: 子件批次号
        quantity: 消耗数量
        executed_by: 执行人ID
        executed_by_name: 执行人姓名
        executed_at: 执行时间
    """

    class Meta:
        table = "apps_kuaizhizao_assembly_material_bindings"
        table_description = "快格轻制造 - 装配物料绑定"
        indexes = [
            ("tenant_id",),
            ("assembly_order_id",),
            ("assembly_order_item_id",),
            ("parent_material_id",),
            ("child_material_id",),
            ("executed_at",),
        ]

    id = fields.IntField(pk=True, description="主键ID")
    assembly_order_id = fields.IntField(description="组装单ID")
    assembly_order_item_id = fields.IntField(null=True, description="组装单明细ID（可选）")

    parent_material_id = fields.IntField(description="父件（成品）物料ID")
    parent_material_code = fields.CharField(max_length=50, description="父件物料编码")
    parent_material_name = fields.CharField(max_length=200, description="父件物料名称")
    parent_batch_no = fields.CharField(max_length=100, null=True, description="父件批次号（可选）")

    child_material_id = fields.IntField(description="子件物料ID")
    child_material_code = fields.CharField(max_length=50, description="子件物料编码")
    child_material_name = fields.CharField(max_length=200, description="子件物料名称")
    child_batch_no = fields.CharField(max_length=100, description="子件批次号")
    quantity = fields.DecimalField(max_digits=12, decimal_places=2, description="消耗数量")

    executed_by = fields.IntField(description="执行人ID")
    executed_by_name = fields.CharField(max_length=100, description="执行人姓名")
    executed_at = fields.DatetimeField(description="执行时间")

    remarks = fields.TextField(null=True, description="备注")
    deleted_at = fields.DatetimeField(null=True, description="删除时间（软删除）")

    def __str__(self):
        return f"{self.parent_material_code} <- {self.child_material_code}({self.child_batch_no}) x{self.quantity}"
