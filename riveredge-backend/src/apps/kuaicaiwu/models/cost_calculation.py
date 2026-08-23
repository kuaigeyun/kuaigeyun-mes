"""
成本核算记录模型模块

定义成本核算记录数据模型，支持多组织隔离。

Author: Luigi Lu
Date: 2026-01-05
"""

from tortoise import fields
from core.models.base import BaseModel


class CostCalculation(BaseModel):
    """成本核算记录模型"""
    """
    成本核算记录模型

    用于记录工单或产品的成本核算结果，包括材料成本、人工成本、制造费用等。
    支持多组织隔离，每个组织的成本核算记录相互独立。
    """

    class Meta:
        table = "apps_kuaicaiwu_cost_calculations"
        table_description = "轻管理会计 - 成本核算"
        indexes = [
            ("tenant_id",),
            ("calculation_no",),
            ("uuid",),
            ("calculation_type",),
            ("work_order_id",),
            ("product_id",),
            ("calculation_date",),
            ("calculation_status",),
        ]
        unique_together = [("tenant_id", "calculation_no")]

    id = fields.IntField(pk=True, description="主键ID")
    calculation_no = fields.CharField(max_length=50, description="核算单号（组织内唯一）")
    calculation_type = fields.CharField(max_length=50, description="核算类型")
    work_order_id = fields.IntField(null=True, description="工单ID")
    work_order_code = fields.CharField(max_length=50, null=True, description="工单编码")
    product_id = fields.IntField(null=True, description="产品ID")
    product_code = fields.CharField(max_length=50, null=True, description="产品编码")
    product_name = fields.CharField(max_length=200, null=True, description="产品名称")
    quantity = fields.DecimalField(max_digits=14, decimal_places=4, description="数量")
    material_cost = fields.DecimalField(max_digits=14, decimal_places=4, default=0, description="材料成本")
    labor_cost = fields.DecimalField(max_digits=14, decimal_places=4, default=0, description="人工成本")
    manufacturing_cost = fields.DecimalField(max_digits=14, decimal_places=4, default=0, description="制造费用")
    total_cost = fields.DecimalField(max_digits=14, decimal_places=4, default=0, description="总成本")
    unit_cost = fields.DecimalField(max_digits=14, decimal_places=4, default=0, description="单位成本")
    cost_details = fields.JSONField(null=True, description="成本明细（JSON格式）")
    calculation_date = fields.DateField(description="核算日期")
    calculation_status = fields.CharField(max_length=50, default="草稿", description="核算状态")
    remark = fields.TextField(null=True, description="备注")
    deleted_at = fields.DatetimeField(null=True, description="删除时间（软删除）")

    def __str__(self):
        return f"{self.calculation_no} - {self.product_name}"
