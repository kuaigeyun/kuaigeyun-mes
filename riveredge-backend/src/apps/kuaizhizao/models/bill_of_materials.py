"""
BOM物料清单模型

提供BOM物料清单数据模型定义。

Author: Luigi Lu
Date: 2025-12-30
"""

from tortoise import fields
from core.models.base import BaseModel


class BillOfMaterials(BaseModel):
    """
    物料清单（BOM）

    定义产品或半成品的组成结构和物料需求
    """
    tenant_id = fields.IntField(description="租户ID")
    bom_code = fields.CharField(max_length=50, unique=True, description="BOM编码")

    # 成品信息
    finished_product_id = fields.IntField(description="成品物料ID")
    finished_product_code = fields.CharField(max_length=50, description="成品物料编码")
    finished_product_name = fields.CharField(max_length=200, description="成品物料名称")
    finished_product_spec = fields.CharField(max_length=200, null=True, description="成品规格")

    # BOM基本信息
    bom_name = fields.CharField(max_length=200, description="BOM名称")
    version = fields.CharField(max_length=20, default="1.0", description="BOM版本")
    bom_type = fields.CharField(max_length=20, default="生产BOM", description="BOM类型")

    # 数量信息
    base_quantity = fields.DecimalField(max_digits=10, decimal_places=2, default=1, description="基准数量")
    base_unit = fields.CharField(max_length=20, description="基准单位")

    # 状态和有效期
    status = fields.CharField(max_length=20, default="草稿", description="BOM状态")
    effective_date = fields.DateField(description="生效日期")
    expiry_date = fields.DateField(null=True, description="失效日期")

    # 工艺信息
    routing_id = fields.IntField(null=True, description="工艺路线ID")
    routing_code = fields.CharField(max_length=50, null=True, description="工艺路线编码")

    # 成本信息
    total_cost = fields.DecimalField(max_digits=12, decimal_places=2, default=0, description="总成本")
    material_cost = fields.DecimalField(max_digits=12, decimal_places=2, default=0, description="材料成本")
    labor_cost = fields.DecimalField(max_digits=12, decimal_places=2, default=0, description="人工成本")
    overhead_cost = fields.DecimalField(max_digits=12, decimal_places=2, default=0, description="制造费用")

    # 审核信息
    reviewer_id = fields.IntField(null=True, description="审核人ID")
    reviewer_name = fields.CharField(max_length=100, null=True, description="审核人姓名")
    review_time = fields.DatetimeField(null=True, description="审核时间")
    review_status = fields.CharField(max_length=20, default="待审核", description="审核状态")
    review_remarks = fields.TextField(null=True, description="审核备注")

    notes = fields.TextField(null=True, description="备注")
    is_active = fields.BooleanField(default=True, description="是否有效")
    created_by = fields.IntField(null=True, description="创建人ID")
    updated_by = fields.IntField(null=True, description="更新人ID")
    deleted_at = fields.DatetimeField(null=True, description="删除时间")

    class Meta:
        table = "apps_kuaizhizao_bill_of_materials"
        table_description = "快格轻制造 - 物料清单（BOM）"
        indexes = [
            ("tenant_id", "finished_product_id"),
            ("tenant_id", "bom_code"),
            ("status",),
            ("effective_date", "expiry_date"),
        ]

    class PydanticMeta:
        exclude = ["deleted_at"]
