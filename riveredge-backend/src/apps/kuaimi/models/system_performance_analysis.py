"""
系统应用绩效分析模型模块

定义系统应用绩效分析数据模型，支持多组织隔离。
"""

from tortoise import fields
from core.models.base import BaseModel
from decimal import Decimal
from datetime import datetime


class SystemPerformanceAnalysis(BaseModel):
    """
    系统应用绩效分析模型
    
    用于管理系统应用绩效分析，支持多组织隔离。
    
    Attributes:
        id: 主键ID（自增ID，内部使用）
        uuid: 业务ID（UUID，对外暴露，安全且唯一，继承自BaseModel）
        tenant_id: 组织ID（用于多组织数据隔离，继承自BaseModel）
        analysis_no: 分析编号（组织内唯一）
        analysis_name: 分析名称
        analysis_type: 分析类型（使用效果统计、流程改善分析、系统ROI分析、应用价值评估、系统优化建议）
        analysis_period: 分析周期（日、周、月、年）
        analysis_start_date: 分析开始日期
        analysis_end_date: 分析结束日期
        module_usage_rate: 模块使用率（JSON格式）
        function_usage_frequency: 功能使用频率（JSON格式）
        user_activity: 用户活跃度（JSON格式）
        efficiency_improvement: 效率提升（百分比）
        time_reduction: 时间缩短（百分比）
        cost_reduction: 成本降低（百分比）
        roi_value: ROI值（百分比）
        cost_saving: 成本节约
        before_after_comparison: 前后对比（JSON格式）
        improvement_quantification: 改善量化（JSON格式）
        value_contribution: 价值贡献（JSON格式）
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
        table = "seed_kuaimi_system_performance_analyses"
        indexes = [
            ("tenant_id",),
            ("analysis_no",),
            ("analysis_type",),
            ("analysis_period",),
            ("status",),
        ]
        unique_together = [("tenant_id", "analysis_no")]
    
    analysis_no = fields.CharField(max_length=100, description="分析编号")
    analysis_name = fields.CharField(max_length=200, description="分析名称")
    analysis_type = fields.CharField(max_length=50, description="分析类型")
    analysis_period = fields.CharField(max_length=50, null=True, description="分析周期")
    analysis_start_date = fields.DatetimeField(null=True, description="分析开始日期")
    analysis_end_date = fields.DatetimeField(null=True, description="分析结束日期")
    module_usage_rate = fields.JSONField(null=True, description="模块使用率")
    function_usage_frequency = fields.JSONField(null=True, description="功能使用频率")
    user_activity = fields.JSONField(null=True, description="用户活跃度")
    efficiency_improvement = fields.DecimalField(max_digits=5, decimal_places=2, null=True, description="效率提升")
    time_reduction = fields.DecimalField(max_digits=5, decimal_places=2, null=True, description="时间缩短")
    cost_reduction = fields.DecimalField(max_digits=5, decimal_places=2, null=True, description="成本降低")
    roi_value = fields.DecimalField(max_digits=10, decimal_places=2, null=True, description="ROI值")
    cost_saving = fields.DecimalField(max_digits=18, decimal_places=2, null=True, description="成本节约")
    before_after_comparison = fields.JSONField(null=True, description="前后对比")
    improvement_quantification = fields.JSONField(null=True, description="改善量化")
    value_contribution = fields.JSONField(null=True, description="价值贡献")
    optimization_suggestions = fields.JSONField(null=True, description="优化建议")
    status = fields.CharField(max_length=50, default="草稿", description="状态")
    remark = fields.TextField(null=True, description="备注")

