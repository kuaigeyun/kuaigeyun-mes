"""
LRP运算结果模型

提供LRP运算结果数据模型定义。

Author: Luigi Lu
Date: 2025-12-30
"""

from tortoise import fields
from core.models.base import BaseModel


class LRPResult(BaseModel):
    """
    LRP运算结果

    存储LRP（物流需求计划）运算的详细结果
    """
    tenant_id = fields.IntField(description="租户ID")
    sales_order_id = fields.IntField(description="销售订单ID")
    material_id = fields.IntField(description="物料ID")

    # 运算参数
    delivery_date = fields.DateField(description="交货日期")
    planning_horizon = fields.IntField(description="计划时域（天）")

    # 需求信息
    required_quantity = fields.DecimalField(max_digits=10, decimal_places=2, description="需求数量")
    available_inventory = fields.DecimalField(max_digits=10, decimal_places=2, description="可用库存")

    # 运算结果
    net_requirement = fields.DecimalField(max_digits=10, decimal_places=2, description="净需求")
    planned_production = fields.DecimalField(max_digits=10, decimal_places=2, description="计划生产")
    planned_procurement = fields.DecimalField(max_digits=10, decimal_places=2, description="计划采购")

    # 时间安排
    production_start_date = fields.DateField(null=True, description="生产开始日期")
    production_completion_date = fields.DateField(null=True, description="生产完成日期")
    procurement_start_date = fields.DateField(null=True, description="采购开始日期")
    procurement_completion_date = fields.DateField(null=True, description="采购完成日期")

    # BOM信息
    bom_id = fields.IntField(null=True, description="使用的BOM ID")
    bom_version = fields.CharField(max_length=20, null=True, description="BOM版本")

    # 运算状态
    computation_status = fields.CharField(max_length=20, default="完成", description="运算状态")
    computation_time = fields.DatetimeField(description="运算时间")

    # 详细结果（JSON格式存储）
    material_breakdown = fields.JSONField(description="物料分解")
    capacity_requirements = fields.JSONField(description="产能需求")
    procurement_schedule = fields.JSONField(description="采购时间表")

    notes = fields.TextField(null=True, description="备注")

    class Meta:
        table = "apps_kuaizhizao_lrp_results"
        table_description = "快格轻制造 - LRP运算结果"
        indexes = [
            ("tenant_id", "sales_order_id"),
            ("tenant_id", "material_id"),
            ("computation_status",),
            ("computation_time",),
            ("delivery_date",),
        ]
