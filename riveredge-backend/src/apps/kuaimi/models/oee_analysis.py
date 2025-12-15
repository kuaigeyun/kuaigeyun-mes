"""
设备综合效率分析模型模块

定义设备综合效率分析数据模型，支持多组织隔离。
"""

from tortoise import fields
from core.models.base import BaseModel
from decimal import Decimal
from datetime import datetime


class OEEAnalysis(BaseModel):
    """
    设备综合效率分析模型
    
    用于管理设备综合效率分析，支持多组织隔离。
    
    Attributes:
        id: 主键ID（自增ID，内部使用）
        uuid: 业务ID（UUID，对外暴露，安全且唯一，继承自BaseModel）
        tenant_id: 组织ID（用于多组织数据隔离，继承自BaseModel）
        analysis_no: 分析编号（组织内唯一）
        analysis_name: 分析名称
        device_id: 设备ID
        device_name: 设备名称
        analysis_period: 分析周期（日、周、月、年）
        analysis_start_date: 分析开始日期
        analysis_end_date: 分析结束日期
        availability: 可用率（百分比）
        performance: 性能率（百分比）
        quality: 质量率（百分比）
        oee_value: OEE值（百分比）
        utilization_rate: 设备利用率（百分比）
        performance_indicators: 性能指标（JSON格式）
        optimization_suggestions: 优化建议（JSON格式）
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
        table = "seed_kuaimi_oee_analyses"
        indexes = [
            ("tenant_id",),
            ("analysis_no",),
            ("device_id",),
            ("analysis_period",),
            ("status",),
        ]
        unique_together = [("tenant_id", "analysis_no")]
    
    analysis_no = fields.CharField(max_length=100, description="分析编号")
    analysis_name = fields.CharField(max_length=200, description="分析名称")
    device_id = fields.IntField(null=True, description="设备ID")
    device_name = fields.CharField(max_length=200, null=True, description="设备名称")
    analysis_period = fields.CharField(max_length=50, null=True, description="分析周期")
    analysis_start_date = fields.DatetimeField(null=True, description="分析开始日期")
    analysis_end_date = fields.DatetimeField(null=True, description="分析结束日期")
    availability = fields.DecimalField(max_digits=5, decimal_places=2, null=True, description="可用率")
    performance = fields.DecimalField(max_digits=5, decimal_places=2, null=True, description="性能率")
    quality = fields.DecimalField(max_digits=5, decimal_places=2, null=True, description="质量率")
    oee_value = fields.DecimalField(max_digits=5, decimal_places=2, null=True, description="OEE值")
    utilization_rate = fields.DecimalField(max_digits=5, decimal_places=2, null=True, description="设备利用率")
    performance_indicators = fields.JSONField(null=True, description="性能指标")
    optimization_suggestions = fields.JSONField(null=True, description="优化建议")
    status = fields.CharField(max_length=50, default="草稿", description="状态")
    remark = fields.TextField(null=True, description="备注")

