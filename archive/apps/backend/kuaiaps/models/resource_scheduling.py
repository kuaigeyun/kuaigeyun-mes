"""
资源调度模型模块

定义资源调度数据模型，支持多组织隔离。
"""

from tortoise import fields
from core.models.base import BaseModel
from datetime import datetime


class ResourceScheduling(BaseModel):
    """
    资源调度模型
    
    用于管理资源调度，支持多组织隔离。
    
    Attributes:
        id: 主键ID（自增ID，内部使用）
        uuid: 业务ID（UUID，对外暴露，安全且唯一，继承自BaseModel）
        tenant_id: 组织ID（用于多组织数据隔离，继承自BaseModel）
        scheduling_no: 调度编号（组织内唯一）
        scheduling_name: 调度名称
        resource_type: 资源类型（设备、人员、物料、工装模具）
        resource_id: 资源ID（关联master-data或其他模块）
        resource_name: 资源名称
        plan_id: 计划ID（关联production_plan）
        plan_uuid: 计划UUID
        plan_no: 计划编号
        scheduled_start_date: 调度开始日期
        scheduled_end_date: 调度结束日期
        actual_start_date: 实际开始日期
        actual_end_date: 实际结束日期
        availability_status: 可用性状态（可用、不可用、部分可用）
        scheduling_status: 调度状态（待调度、已调度、执行中、已完成）
        optimization_suggestion: 优化建议
        status: 状态（草稿、已确认、执行中、已完成）
        remark: 备注
        created_at: 创建时间（继承自BaseModel）
        updated_at: 更新时间（继承自BaseModel）
        deleted_at: 删除时间（软删除）
    """
    
    class Meta:
        """
        模型元数据
        """
        table = "apps_kuaiaps_resource_schedulings"
        indexes = [
            ("tenant_id",),
            ("scheduling_no",),
            ("resource_type",),
            ("resource_id",),
            ("plan_id",),
            ("availability_status",),
            ("scheduling_status",),
            ("status",),
        ]
        unique_together = [("tenant_id", "scheduling_no")]
    
    scheduling_no = fields.CharField(max_length=100, description="调度编号")
    scheduling_name = fields.CharField(max_length=200, description="调度名称")
    resource_type = fields.CharField(max_length=50, description="资源类型")
    resource_id = fields.IntField(null=True, description="资源ID")
    resource_name = fields.CharField(max_length=200, null=True, description="资源名称")
    plan_id = fields.IntField(null=True, description="计划ID")
    plan_uuid = fields.CharField(max_length=36, null=True, description="计划UUID")
    plan_no = fields.CharField(max_length=100, null=True, description="计划编号")
    scheduled_start_date = fields.DatetimeField(null=True, description="调度开始日期")
    scheduled_end_date = fields.DatetimeField(null=True, description="调度结束日期")
    actual_start_date = fields.DatetimeField(null=True, description="实际开始日期")
    actual_end_date = fields.DatetimeField(null=True, description="实际结束日期")
    availability_status = fields.CharField(max_length=50, default="可用", description="可用性状态")
    scheduling_status = fields.CharField(max_length=50, default="待调度", description="调度状态")
    optimization_suggestion = fields.TextField(null=True, description="优化建议")
    status = fields.CharField(max_length=50, default="草稿", description="状态")
    remark = fields.TextField(null=True, description="备注")

