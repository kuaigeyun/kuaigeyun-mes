"""
销售预测明细模型

提供销售预测明细数据模型定义。

Author: Luigi Lu
Date: 2025-12-30
"""

from tortoise import fields
from core.models.base import BaseModel


class SalesForecastItem(BaseModel):
    """
    销售预测明细

    用于记录销售预测中每个产品/物料的详细预测数据
    """
    tenant_id = fields.IntField(description="租户ID")
    forecast_id = fields.IntField(description="销售预测ID")

    # 物料信息
    material_id = fields.IntField(description="物料ID")
    material_code = fields.CharField(max_length=50, description="物料编码")
    material_name = fields.CharField(max_length=200, description="物料名称")
    material_spec = fields.CharField(max_length=200, null=True, description="物料规格")
    material_unit = fields.CharField(max_length=20, description="物料单位")

    # 预测数据
    forecast_quantity = fields.DecimalField(max_digits=10, decimal_places=2, description="预测数量")
    forecast_date = fields.DateField(description="预测日期")

    # 历史数据（可选，用于预测参考）
    historical_sales = fields.DecimalField(max_digits=10, decimal_places=2, null=True, description="历史销量")
    historical_period = fields.CharField(max_length=20, null=True, description="历史周期")

    # 预测参数
    confidence_level = fields.DecimalField(max_digits=5, decimal_places=2, null=True, description="置信度")
    forecast_method = fields.CharField(max_length=50, null=True, description="预测方法")

    notes = fields.TextField(null=True, description="备注")

    class Meta:
        table = "apps_kuaizhizao_sales_forecast_items"
        table_description = "快格轻制造 - 销售预测明细"
        indexes = [
            ("tenant_id", "forecast_id"),
            ("material_id",),
            ("forecast_date",),
        ]
