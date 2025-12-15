"""
质量预测分析模型模块

定义质量预测分析数据模型，支持多组织隔离。
"""

from tortoise import fields
from core.models.base import BaseModel
from decimal import Decimal
from datetime import datetime


class QualityPredictionAnalysis(BaseModel):
    """
    质量预测分析模型
    
    用于管理质量预测分析，支持多组织隔离。
    
    Attributes:
        id: 主键ID（自增ID，内部使用）
        uuid: 业务ID（UUID，对外暴露，安全且唯一，继承自BaseModel）
        tenant_id: 组织ID（用于多组织数据隔离，继承自BaseModel）
        analysis_no: 分析编号（组织内唯一）
        analysis_name: 分析名称
        prediction_model: 预测模型
        prediction_period: 预测周期
        prediction_start_date: 预测开始日期
        prediction_end_date: 预测结束日期
        quality_trend: 质量趋势（JSON格式）
        prediction_accuracy: 预测准确性（百分比）
        alert_status: 预警状态（正常、预警、紧急）
        alert_level: 预警等级
        alert_description: 预警描述
        risk_level: 风险等级
        root_cause_analysis: 根因分析（JSON格式）
        root_cause_trace: 根因追溯（JSON格式）
        improvement_plan: 改进方案（JSON格式）
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
        table = "seed_kuaimi_quality_prediction_analyses"
        indexes = [
            ("tenant_id",),
            ("analysis_no",),
            ("prediction_model",),
            ("alert_status",),
            ("risk_level",),
            ("status",),
        ]
        unique_together = [("tenant_id", "analysis_no")]
    
    analysis_no = fields.CharField(max_length=100, description="分析编号")
    analysis_name = fields.CharField(max_length=200, description="分析名称")
    prediction_model = fields.CharField(max_length=200, null=True, description="预测模型")
    prediction_period = fields.CharField(max_length=50, null=True, description="预测周期")
    prediction_start_date = fields.DatetimeField(null=True, description="预测开始日期")
    prediction_end_date = fields.DatetimeField(null=True, description="预测结束日期")
    quality_trend = fields.JSONField(null=True, description="质量趋势")
    prediction_accuracy = fields.DecimalField(max_digits=5, decimal_places=2, null=True, description="预测准确性")
    alert_status = fields.CharField(max_length=50, default="正常", description="预警状态")
    alert_level = fields.CharField(max_length=50, null=True, description="预警等级")
    alert_description = fields.TextField(null=True, description="预警描述")
    risk_level = fields.CharField(max_length=50, null=True, description="风险等级")
    root_cause_analysis = fields.JSONField(null=True, description="根因分析")
    root_cause_trace = fields.JSONField(null=True, description="根因追溯")
    improvement_plan = fields.JSONField(null=True, description="改进方案")
    status = fields.CharField(max_length=50, default="草稿", description="状态")
    remark = fields.TextField(null=True, description="备注")

