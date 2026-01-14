"""
统一需求明细模型

提供统一的需求明细数据模型定义，支持销售预测明细和销售订单明细两种类型。

Author: Luigi Lu
Date: 2025-01-14
"""

from tortoise import fields
from core.models.base import BaseModel


class DemandItem(BaseModel):
    """
    统一需求明细模型

    用于统一管理销售预测明细和销售订单明细。
    支持销售预测的按月预测和销售订单的按订单明细两种模式。
    
    注意：继承自BaseModel，自动获得id、uuid、tenant_id、created_at、updated_at字段
    """
    demand_id = fields.IntField(description="需求ID")
    
    # 物料信息（通用）
    material_id = fields.IntField(description="物料ID")
    material_code = fields.CharField(max_length=50, description="物料编码")
    material_name = fields.CharField(max_length=200, description="物料名称")
    material_spec = fields.CharField(max_length=200, null=True, description="物料规格")
    material_unit = fields.CharField(max_length=20, description="物料单位")
    
    # 需求数量（通用）
    required_quantity = fields.DecimalField(max_digits=10, decimal_places=2, description="需求数量")
    
    # 销售预测专用字段
    forecast_date = fields.DateField(null=True, description="预测日期（销售预测专用）")
    forecast_month = fields.CharField(max_length=7, null=True, description="预测月份（YYYY-MM，销售预测专用）")
    historical_sales = fields.DecimalField(max_digits=10, decimal_places=2, null=True, description="历史销量")
    historical_period = fields.CharField(max_length=20, null=True, description="历史周期")
    confidence_level = fields.DecimalField(max_digits=5, decimal_places=2, null=True, description="置信度")
    forecast_method = fields.CharField(max_length=50, null=True, description="预测方法")
    
    # 销售订单专用字段
    delivery_date = fields.DateField(null=True, description="交货日期（销售订单专用）")
    delivered_quantity = fields.DecimalField(max_digits=10, decimal_places=2, default=0, description="已交货数量")
    remaining_quantity = fields.DecimalField(max_digits=10, decimal_places=2, description="剩余数量")
    unit_price = fields.DecimalField(max_digits=10, decimal_places=2, null=True, description="单价")
    item_amount = fields.DecimalField(max_digits=12, decimal_places=2, null=True, description="金额")
    delivery_status = fields.CharField(max_length=20, null=True, description="交货状态")
    
    # 关联工单（MTO模式）
    work_order_id = fields.IntField(null=True, description="工单ID")
    work_order_code = fields.CharField(max_length=50, null=True, description="工单编码")
    
    notes = fields.TextField(null=True, description="备注")
    
    class Meta:
        table = "apps_kuaizhizao_demand_items"
        table_description = "快格轻制造 - 统一需求明细"
        indexes = [
            ("tenant_id", "demand_id"),
            ("material_id",),
            ("forecast_date",),
            ("forecast_month",),
            ("delivery_date",),
            ("work_order_id",),
        ]
