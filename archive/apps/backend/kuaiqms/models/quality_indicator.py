"""
质量指标模型模块

定义质量指标数据模型，支持多组织隔离。
"""

from tortoise import fields
from core.models.base import BaseModel


class QualityIndicator(BaseModel):
    """
    质量指标模型
    
    用于管理质量指标，支持多组织隔离。
    
    Attributes:
        id: 主键ID（自增ID，内部使用）
        uuid: 业务ID（UUID，对外暴露，安全且唯一，继承自BaseModel）
        tenant_id: 组织ID（用于多组织数据隔离，继承自BaseModel）
        indicator_no: 指标编号（组织内唯一）
        indicator_name: 指标名称
        indicator_description: 指标描述
        indicator_type: 指标类型（来料合格率、过程合格率、成品合格率等）
        target_value: 目标值
        current_value: 当前值
        unit: 单位
        calculation_method: 计算方法
        data_source: 数据来源
        monitoring_frequency: 监控频率（每日、每周、每月）
        alert_threshold: 预警阈值
        status: 指标状态（启用、停用）
        remark: 备注
        created_at: 创建时间（继承自BaseModel）
        updated_at: 更新时间（继承自BaseModel）
        deleted_at: 删除时间（软删除）
    """
    
    class Meta:
        """
        模型元数据
        """
        table = "apps_kuaiqms_quality_indicators"
        indexes = [
            ("tenant_id",),
            ("indicator_no",),
            ("uuid",),
            ("indicator_type",),
            ("status",),
            ("created_at",),
        ]
        unique_together = [("tenant_id", "indicator_no")]
    
    # 主键
    id = fields.IntField(pk=True, description="主键ID")
    
    # 基本信息
    indicator_no = fields.CharField(max_length=50, description="指标编号（组织内唯一）")
    indicator_name = fields.CharField(max_length=200, description="指标名称")
    indicator_description = fields.TextField(null=True, description="指标描述")
    indicator_type = fields.CharField(max_length=100, description="指标类型（来料合格率、过程合格率、成品合格率等）")
    
    # 指标值
    target_value = fields.DecimalField(max_digits=18, decimal_places=4, null=True, description="目标值")
    current_value = fields.DecimalField(max_digits=18, decimal_places=4, default=0, description="当前值")
    unit = fields.CharField(max_length=50, null=True, description="单位")
    
    # 计算方法
    calculation_method = fields.TextField(null=True, description="计算方法")
    data_source = fields.CharField(max_length=200, null=True, description="数据来源")
    
    # 监控频率
    monitoring_frequency = fields.CharField(max_length=50, null=True, description="监控频率（每日、每周、每月）")
    alert_threshold = fields.DecimalField(max_digits=18, decimal_places=4, null=True, description="预警阈值")
    
    # 指标状态
    status = fields.CharField(max_length=50, default="启用", description="指标状态（启用、停用）")
    
    # 备注
    remark = fields.TextField(null=True, description="备注")
    
    # 软删除字段
    deleted_at = fields.DatetimeField(null=True, description="删除时间（软删除）")
    
    def __str__(self):
        """字符串表示"""
        return f"{self.indicator_no} - {self.indicator_name}"
