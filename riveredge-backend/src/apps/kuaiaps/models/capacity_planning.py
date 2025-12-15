"""
产能规划模型模块

定义产能规划数据模型，支持多组织隔离。
"""

from tortoise import fields
from core.models.base import BaseModel
from decimal import Decimal


class CapacityPlanning(BaseModel):
    """
    产能规划模型
    
    用于管理产能规划，支持多组织隔离。
    
    Attributes:
        id: 主键ID（自增ID，内部使用）
        uuid: 业务ID（UUID，对外暴露，安全且唯一，继承自BaseModel）
        tenant_id: 组织ID（用于多组织数据隔离，继承自BaseModel）
        planning_no: 规划编号（组织内唯一）
        planning_name: 规划名称
        resource_type: 资源类型（设备、人员、工艺等）
        resource_id: 资源ID（关联master-data或其他模块）
        resource_name: 资源名称
        planning_period: 规划周期（月度、季度、年度）
        planning_start_date: 规划开始日期
        planning_end_date: 规划结束日期
        planned_capacity: 计划产能
        actual_capacity: 实际产能
        utilization_rate: 利用率（百分比）
        bottleneck_status: 瓶颈状态（是、否）
        optimization_suggestion: 优化建议
        status: 状态（草稿、已确认、已执行）
        remark: 备注
        created_at: 创建时间（继承自BaseModel）
        updated_at: 更新时间（继承自BaseModel）
        deleted_at: 删除时间（软删除）
    """
    
    class Meta:
        """
        模型元数据
        """
        table = "seed_kuaiaps_capacity_plannings"
        indexes = [
            ("tenant_id",),
            ("planning_no",),
            ("resource_type",),
            ("resource_id",),
            ("planning_period",),
            ("bottleneck_status",),
            ("status",),
        ]
        unique_together = [("tenant_id", "planning_no")]
    
    planning_no = fields.CharField(max_length=100, description="规划编号")
    planning_name = fields.CharField(max_length=200, description="规划名称")
    resource_type = fields.CharField(max_length=50, description="资源类型")
    resource_id = fields.IntField(null=True, description="资源ID")
    resource_name = fields.CharField(max_length=200, null=True, description="资源名称")
    planning_period = fields.CharField(max_length=50, null=True, description="规划周期")
    planning_start_date = fields.DatetimeField(null=True, description="规划开始日期")
    planning_end_date = fields.DatetimeField(null=True, description="规划结束日期")
    planned_capacity = fields.DecimalField(max_digits=18, decimal_places=4, null=True, description="计划产能")
    actual_capacity = fields.DecimalField(max_digits=18, decimal_places=4, null=True, description="实际产能")
    utilization_rate = fields.DecimalField(max_digits=5, decimal_places=2, null=True, description="利用率")
    bottleneck_status = fields.CharField(max_length=20, default="否", description="瓶颈状态")
    optimization_suggestion = fields.TextField(null=True, description="优化建议")
    status = fields.CharField(max_length=50, default="草稿", description="状态")
    remark = fields.TextField(null=True, description="备注")

