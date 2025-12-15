"""
工艺参数优化模型模块

定义工艺参数优化数据模型，支持多组织隔离。
"""

from tortoise import fields
from core.models.base import BaseModel
from datetime import datetime


class ProcessParameterOptimization(BaseModel):
    """
    工艺参数优化模型
    
    用于管理工艺参数优化，支持多组织隔离。
    
    Attributes:
        id: 主键ID（自增ID，内部使用）
        uuid: 业务ID（UUID，对外暴露，安全且唯一，继承自BaseModel）
        tenant_id: 组织ID（用于多组织数据隔离，继承自BaseModel）
        optimization_no: 优化编号（组织内唯一）
        optimization_name: 优化名称
        process_id: 工艺ID
        process_name: 工艺名称
        parameter_analysis: 参数分析（JSON格式）
        parameter_statistics: 参数统计（JSON格式）
        parameter_correlation: 参数关联（JSON格式）
        optimization_suggestions: 优化建议（JSON格式）
        optimization_plan: 优化方案（JSON格式）
        optimization_effect: 优化效果（JSON格式）
        improvement_plan: 改进方案（JSON格式）
        improvement_status: 改进状态（待执行、执行中、已完成）
        improvement_effect: 改进效果（JSON格式）
        status: 状态（草稿、执行中、已完成）
        remark: 备注
        created_at: 创建时间（继承自BaseModel）
        updated_at: 更新时间（继承自BaseModel）
        deleted_at: 删除时间（软删除）
    """
    
    class Meta:
        """
        模型元数据
        """
        table = "seed_kuaimi_process_parameter_optimizations"
        indexes = [
            ("tenant_id",),
            ("optimization_no",),
            ("process_id",),
            ("improvement_status",),
            ("status",),
        ]
        unique_together = [("tenant_id", "optimization_no")]
    
    optimization_no = fields.CharField(max_length=100, description="优化编号")
    optimization_name = fields.CharField(max_length=200, description="优化名称")
    process_id = fields.IntField(null=True, description="工艺ID")
    process_name = fields.CharField(max_length=200, null=True, description="工艺名称")
    parameter_analysis = fields.JSONField(null=True, description="参数分析")
    parameter_statistics = fields.JSONField(null=True, description="参数统计")
    parameter_correlation = fields.JSONField(null=True, description="参数关联")
    optimization_suggestions = fields.JSONField(null=True, description="优化建议")
    optimization_plan = fields.JSONField(null=True, description="优化方案")
    optimization_effect = fields.JSONField(null=True, description="优化效果")
    improvement_plan = fields.JSONField(null=True, description="改进方案")
    improvement_status = fields.CharField(max_length=50, default="待执行", description="改进状态")
    improvement_effect = fields.JSONField(null=True, description="改进效果")
    status = fields.CharField(max_length=50, default="草稿", description="状态")
    remark = fields.TextField(null=True, description="备注")

