"""
MRP运算结果模型

⚠️ 此模型已废弃，不再推荐使用。
根据《☆ 用户使用全场景推演.md》的设计理念，MRP和LRP已合并为统一的需求计算模型。
请使用统一的需求计算模型替代此模型。

为了保持向后兼容性，暂时保留此模型定义。

Author: Luigi Lu
Date: 2025-12-30
废弃日期: 2025-01-27
"""

from tortoise import fields
from core.models.base import BaseModel


class MRPResult(BaseModel):
    """
    MRP运算结果

    存储MRP（物料需求计划）运算的详细结果
    
    ⚠️ 已废弃：请使用统一的需求计算模型
    """
    tenant_id = fields.IntField(description="租户ID")
    forecast_id = fields.IntField(description="销售预测ID")
    material_id = fields.IntField(description="物料ID")

    # 运算参数
    planning_horizon = fields.IntField(description="计划时域（天）")
    time_bucket = fields.CharField(max_length=20, default="日", description="时间段")

    # 库存参数
    current_inventory = fields.DecimalField(max_digits=10, decimal_places=2, description="当前库存")
    safety_stock = fields.DecimalField(max_digits=10, decimal_places=2, description="安全库存")
    reorder_point = fields.DecimalField(max_digits=10, decimal_places=2, description="再订货点")

    # 运算结果
    total_gross_requirement = fields.DecimalField(max_digits=10, decimal_places=2, description="总毛需求")
    total_net_requirement = fields.DecimalField(max_digits=10, decimal_places=2, description="总净需求")
    total_planned_receipt = fields.DecimalField(max_digits=10, decimal_places=2, description="总计划入库")
    total_planned_release = fields.DecimalField(max_digits=10, decimal_places=2, description="总计划发放")

    # 建议行动
    suggested_work_orders = fields.IntField(default=0, description="建议工单数")
    suggested_purchase_orders = fields.IntField(default=0, description="建议采购订单数")

    # 运算状态
    computation_status = fields.CharField(max_length=20, default="完成", description="运算状态")
    computation_time = fields.DatetimeField(description="运算时间")

    # 详细结果（JSON格式存储）
    demand_schedule = fields.JSONField(description="需求时间表")
    inventory_schedule = fields.JSONField(description="库存时间表")
    planned_order_schedule = fields.JSONField(description="计划订单时间表")

    notes = fields.TextField(null=True, description="备注")

    class Meta:
        table = "apps_kuaizhizao_mrp_results"
        table_description = "快格轻制造 - MRP运算结果（已废弃）"
        indexes = [
            ("tenant_id", "forecast_id"),
            ("tenant_id", "material_id"),
            ("computation_status",),
            ("computation_time",),
        ]
