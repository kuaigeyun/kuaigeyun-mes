"""
BOM物料清单明细模型

提供BOM物料清单明细数据模型定义。

Author: Luigi Lu
Date: 2025-12-30
"""

from tortoise import fields
from core.models.base import BaseModel


class BillOfMaterialsItem(BaseModel):
    """
    BOM物料清单明细

    定义BOM中每个子项的详细信息
    """
    tenant_id = fields.IntField(description="租户ID")
    bom_id = fields.IntField(description="BOM ID")

    # 层级结构
    parent_item_id = fields.IntField(null=True, description="父项ID")
    level = fields.IntField(default=1, description="层级")
    sequence = fields.IntField(default=1, description="顺序号")

    # 子项物料信息
    component_id = fields.IntField(description="子项物料ID")
    component_code = fields.CharField(max_length=50, description="子项物料编码")
    component_name = fields.CharField(max_length=200, description="子项物料名称")
    component_spec = fields.CharField(max_length=200, null=True, description="子项规格")
    component_type = fields.CharField(max_length=20, description="子项类型")

    # 用量信息
    quantity = fields.DecimalField(max_digits=10, decimal_places=4, description="用量")
    unit = fields.CharField(max_length=20, description="单位")
    scrap_rate = fields.DecimalField(max_digits=5, decimal_places=2, default=0, description="损耗率")

    # 工艺信息
    operation_id = fields.IntField(null=True, description="工序ID")
    operation_code = fields.CharField(max_length=50, null=True, description="工序编码")
    operation_name = fields.CharField(max_length=200, null=True, description="工序名称")

    # 时间信息
    lead_time = fields.IntField(default=0, description="前置时间（天）")
    setup_time = fields.DecimalField(max_digits=8, decimal_places=2, default=0, description="准备时间")

    # 替代信息
    is_alternative = fields.BooleanField(default=False, description="是否为替代料")
    alternative_group = fields.CharField(max_length=50, null=True, description="替代组")
    priority = fields.IntField(default=1, description="优先级")

    # 成本信息
    unit_cost = fields.DecimalField(max_digits=10, decimal_places=4, default=0, description="单价")
    total_cost = fields.DecimalField(max_digits=12, decimal_places=2, default=0, description="总成本")

    # 生效信息
    effective_date = fields.DateField(null=True, description="生效日期")
    expiry_date = fields.DateField(null=True, description="失效日期")

    notes = fields.TextField(null=True, description="备注")

    class Meta:
        table = "apps_kuaizhizao_bill_of_materials_items"
        table_description = "快格轻制造 - BOM物料清单明细"
        indexes = [
            ("tenant_id", "bom_id"),
            ("tenant_id", "component_id"),
            ("parent_item_id",),
            ("level",),
            ("operation_id",),
            ("alternative_group",),
        ]
