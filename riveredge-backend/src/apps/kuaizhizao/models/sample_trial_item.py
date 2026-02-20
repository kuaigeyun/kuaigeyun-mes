"""
样品试用单明细模型

记录样品试用单中每个物料的详细信息。

Author: RiverEdge Team
Date: 2026-02-19
"""

from tortoise import fields
from core.models.base import BaseModel


class SampleTrialItem(BaseModel):
    """
    样品试用单明细

    用于记录样品试用单中每个物料的详细信息
    """
    tenant_id = fields.IntField(description="租户ID")
    trial_id = fields.IntField(description="试用单ID")

    material_id = fields.IntField(description="物料ID")
    material_code = fields.CharField(max_length=50, description="物料编码")
    material_name = fields.CharField(max_length=200, description="物料名称")
    material_spec = fields.CharField(max_length=200, null=True, description="物料规格")
    material_unit = fields.CharField(max_length=20, description="物料单位")

    trial_quantity = fields.DecimalField(max_digits=10, decimal_places=2, description="试用数量")
    unit_price = fields.DecimalField(max_digits=10, decimal_places=2, default=0, description="单价")
    total_amount = fields.DecimalField(max_digits=12, decimal_places=2, default=0, description="金额")

    notes = fields.TextField(null=True, description="备注")

    class Meta:
        table = "apps_kuaizhizao_sample_trial_items"
        table_description = "快格轻制造 - 样品试用单明细"
        indexes = [
            ("tenant_id", "trial_id"),
            ("material_id",),
        ]
