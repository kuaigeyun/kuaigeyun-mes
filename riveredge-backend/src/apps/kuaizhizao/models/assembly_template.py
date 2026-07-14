"""
组装模板数据模型模块

定义可复用的组装组件清单模板，支持从 BOM 导入或手工维护。

Author: RiverEdge Team
Date: 2026-06-15
"""

from tortoise import fields
from core.models.base import BaseModel


class AssemblyTemplate(BaseModel):
    """组装模板：按单位成品用量定义组件清单。"""

    class Meta:
        table = "apps_kuaizhizao_assembly_templates"
        table_description = "快格轻制造 - 组装模板"
        indexes = [
            ("tenant_id",),
            ("template_code",),
            ("product_material_id",),
            ("is_active",),
            ("created_at",),
        ]
        unique_together = [("tenant_id", "template_code")]

    id = fields.IntField(pk=True, description="主键ID")
    template_code = fields.CharField(max_length=50, description="模板编码")
    template_name = fields.CharField(max_length=200, description="模板名称")

    product_material_id = fields.IntField(description="成品/半成品物料ID")
    product_material_code = fields.CharField(max_length=50, description="成品物料编码")
    product_material_name = fields.CharField(max_length=200, description="成品物料名称")

    base_quantity = fields.DecimalField(
        max_digits=12, decimal_places=2, default=1, description="基准数量（BOM 展开基数）"
    )
    source_type = fields.CharField(
        max_length=20, default="manual", description="来源类型（manual/bom）"
    )
    is_active = fields.BooleanField(default=True, description="是否启用")
    total_items = fields.IntField(default=0, description="组件行数")
    remarks = fields.TextField(null=True, description="备注")

    deleted_at = fields.DatetimeField(null=True, description="删除时间（软删除）")

    def __str__(self):
        return f"{self.template_code} - {self.template_name}"


class AssemblyTemplateItem(BaseModel):
    """组装模板明细：单位成品对应的组件用量。"""

    class Meta:
        table = "apps_kuaizhizao_assembly_template_items"
        table_description = "快格轻制造 - 组装模板明细"
        indexes = [
            ("tenant_id",),
            ("template_id",),
            ("material_id",),
        ]

    id = fields.IntField(pk=True, description="主键ID")
    template = fields.ForeignKeyField(
        "models.AssemblyTemplate",
        related_name="items",
        on_delete=fields.CASCADE,
        description="关联组装模板",
    )
    sequence = fields.IntField(default=0, description="行序号")
    material_id = fields.IntField(description="组件物料ID")
    material_code = fields.CharField(max_length=50, description="组件物料编码")
    material_name = fields.CharField(max_length=200, description="组件物料名称")
    quantity_per_base = fields.DecimalField(
        max_digits=12, decimal_places=4, description="单位成品用量"
    )
    unit_price = fields.DecimalField(max_digits=12, decimal_places=2, default=0, description="默认单价")
    remarks = fields.TextField(null=True, description="备注")
    deleted_at = fields.DatetimeField(null=True, description="删除时间（软删除）")

    def __str__(self):
        return f"{self.material_code} x {self.quantity_per_base}"
