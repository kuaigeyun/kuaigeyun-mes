"""
能耗分析模型模块

定义能耗分析数据模型，支持多组织隔离。
"""

from tortoise import fields
from core.models.base import BaseModel
from decimal import Decimal
from datetime import datetime


class EnergyConsumptionAnalysis(BaseModel):
    """
    能耗分析模型
    
    用于管理能耗分析，支持多组织隔离。
    
    Attributes:
        id: 主键ID（自增ID，内部使用）
        uuid: 业务ID（UUID，对外暴露，安全且唯一，继承自BaseModel）
        tenant_id: 组织ID（用于多组织数据隔离，继承自BaseModel）
        analysis_no: 分析编号（组织内唯一）
        analysis_name: 分析名称
        analysis_type: 分析类型（统计、对比、趋势）
        energy_type: 能源类型（电、水、气、蒸汽等）
        analysis_period: 分析周期（日、周、月、年）
        analysis_start_date: 分析开始日期
        analysis_end_date: 分析结束日期
        total_consumption: 总能耗
        average_consumption: 平均能耗
        peak_consumption: 峰值能耗
        consumption_trend: 能耗趋势（上升、下降、平稳）
        comparison_result: 对比结果（同比、环比、目标对比）
        analysis_result: 分析结果（JSON格式）
        status: 状态（草稿、已完成）
        remark: 备注
        created_at: 创建时间（继承自BaseModel）
        updated_at: 更新时间（继承自BaseModel）
        deleted_at: 删除时间（软删除）
    """
    
    class Meta:
        """
        模型元数据
        """
        table = "apps_kuaiems_energy_consumption_analyses"
        indexes = [
            ("tenant_id",),
            ("analysis_no",),
            ("analysis_type",),
            ("energy_type",),
            ("analysis_period",),
            ("status",),
        ]
        unique_together = [("tenant_id", "analysis_no")]
    
    analysis_no = fields.CharField(max_length=100, description="分析编号")
    analysis_name = fields.CharField(max_length=200, description="分析名称")
    analysis_type = fields.CharField(max_length=50, description="分析类型")
    energy_type = fields.CharField(max_length=50, null=True, description="能源类型")
    analysis_period = fields.CharField(max_length=50, null=True, description="分析周期")
    analysis_start_date = fields.DatetimeField(null=True, description="分析开始日期")
    analysis_end_date = fields.DatetimeField(null=True, description="分析结束日期")
    total_consumption = fields.DecimalField(max_digits=18, decimal_places=4, null=True, description="总能耗")
    average_consumption = fields.DecimalField(max_digits=18, decimal_places=4, null=True, description="平均能耗")
    peak_consumption = fields.DecimalField(max_digits=18, decimal_places=4, null=True, description="峰值能耗")
    consumption_trend = fields.CharField(max_length=50, null=True, description="能耗趋势")
    comparison_result = fields.TextField(null=True, description="对比结果")
    analysis_result = fields.JSONField(null=True, description="分析结果")
    status = fields.CharField(max_length=50, default="草稿", description="状态")
    remark = fields.TextField(null=True, description="备注")

