"""
生产计划明细模型

提供生产计划明细数据模型定义。

Author: Luigi Lu
Date: 2025-12-30
"""

from tortoise import fields
from core.models.base import BaseModel


class ProductionPlanItem(BaseModel):
    """
    生产计划明细

    存储每个物料的生产计划明细
    """
    tenant_id = fields.IntField(description="租户ID")
    plan_id = fields.IntField(description="生产计划ID")

    # 物料信息
    material_id = fields.IntField(description="物料ID")
    material_code = fields.CharField(max_length=50, description="物料编码")
    material_name = fields.CharField(max_length=200, description="物料名称")
    material_type = fields.CharField(max_length=20, description="物料类型")

    # 计划信息
    planned_quantity = fields.DecimalField(max_digits=10, decimal_places=2, description="计划数量")
    planned_date = fields.DateField(description="计划日期")

    # 库存信息
    available_inventory = fields.DecimalField(max_digits=10, decimal_places=2, default=0, description="可用库存")
    safety_stock = fields.DecimalField(max_digits=10, decimal_places=2, default=0, description="安全库存")

    # 需求信息
    gross_requirement = fields.DecimalField(max_digits=10, decimal_places=2, description="毛需求")
    net_requirement = fields.DecimalField(max_digits=10, decimal_places=2, description="净需求")

    # 建议行动
    suggested_action = fields.CharField(max_length=20, description="建议行动")
    work_order_quantity = fields.DecimalField(max_digits=10, decimal_places=2, default=0, description="建议工单数量")
    purchase_order_quantity = fields.DecimalField(max_digits=10, decimal_places=2, default=0, description="建议采购数量")

    # 执行状态
    execution_status = fields.CharField(max_length=20, default="未执行", description="执行状态")
    work_order_id = fields.IntField(null=True, description="生成的工单ID")
    purchase_order_id = fields.IntField(null=True, description="生成的采购订单ID")

    # 时间参数
    lead_time = fields.IntField(default=0, description="前置时间（天）")

    notes = fields.TextField(null=True, description="备注")

    class Meta:
        table = "apps_kuaizhizao_production_plan_items"
        table_description = "快格轻制造 - 生产计划明细"
        indexes = [
            ("tenant_id", "plan_id"),
            ("material_id",),
            ("planned_date",),
            ("suggested_action",),
            ("execution_status",),
        ]
