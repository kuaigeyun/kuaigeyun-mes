"""
销售预测模型

提供销售预测数据模型定义。

Author: Luigi Lu
Date: 2025-12-30
"""

from tortoise import fields
from core.models.base import BaseModel


class SalesForecast(BaseModel):
    """
    销售预测

    用于记录产品销售预测数据，支持MTS（Make-To-Stock）模式的需求计划
    """
    tenant_id = fields.IntField(description="租户ID")
    forecast_code = fields.CharField(max_length=50, unique=True, description="预测编码")

    # 预测基本信息
    forecast_name = fields.CharField(max_length=200, description="预测名称")
    forecast_type = fields.CharField(max_length=20, default="MTS", description="预测类型")
    forecast_period = fields.CharField(max_length=20, description="预测周期")

    # 时间范围
    start_date = fields.DateField(description="预测开始日期")
    end_date = fields.DateField(description="预测结束日期")

    # 状态
    status = fields.CharField(max_length=20, default="草稿", description="预测状态")

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
        table = "apps_kuaizhizao_sales_forecasts"
        table_description = "快格轻制造 - 销售预测"
        indexes = [
            ("tenant_id", "status"),
            ("tenant_id", "forecast_period"),
            ("start_date", "end_date"),
        ]

    class PydanticMeta:
        exclude = ["deleted_at"]
