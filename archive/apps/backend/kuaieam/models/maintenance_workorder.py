"""
维护工单模型模块

定义维护工单数据模型，支持多组织隔离。
"""

from tortoise import fields
from core.models.base import BaseModel


class MaintenanceWorkOrder(BaseModel):
    """
    维护工单模型
    
    用于管理设备维护工单，支持多组织隔离。
    
    Attributes:
        id: 主键ID（自增ID，内部使用）
        uuid: 业务ID（UUID，对外暴露，安全且唯一，继承自BaseModel）
        tenant_id: 组织ID（用于多组织数据隔离，继承自BaseModel）
        workorder_no: 工单编号（组织内唯一）
        plan_id: 维护计划ID（可选，关联维护计划）
        plan_uuid: 维护计划UUID
        equipment_id: 设备ID（关联master-data）
        equipment_name: 设备名称
        workorder_type: 工单类型（计划维护、故障维修、临时维护）
        maintenance_type: 维护类型（日常保养、小修、中修、大修）
        priority: 优先级（高、中、低）
        planned_start_date: 计划开始时间
        planned_end_date: 计划结束时间
        actual_start_date: 实际开始时间
        actual_end_date: 实际结束时间
        assigned_person_id: 分配人员ID（用户ID）
        assigned_person_name: 分配人员姓名
        executor_id: 执行人员ID（用户ID）
        executor_name: 执行人员姓名
        status: 工单状态（待分配、已分配、执行中、已完成、已关闭、已取消）
        remark: 备注
        created_at: 创建时间（继承自BaseModel）
        updated_at: 更新时间（继承自BaseModel）
        deleted_at: 删除时间（软删除）
    """
    
    class Meta:
        """
        模型元数据
        """
        table = "apps_kuaieam_maintenance_workorders"
        indexes = [
            ("tenant_id",),
            ("workorder_no",),
            ("plan_id",),
            ("equipment_id",),
            ("status",),
            ("planned_start_date",),
        ]
        unique_together = [("tenant_id", "workorder_no")]
    
    workorder_no = fields.CharField(max_length=100, description="工单编号")
    plan_id = fields.IntField(null=True, description="维护计划ID")
    plan_uuid = fields.CharField(max_length=36, null=True, description="维护计划UUID")
    equipment_id = fields.IntField(description="设备ID")
    equipment_name = fields.CharField(max_length=200, description="设备名称")
    workorder_type = fields.CharField(max_length=50, description="工单类型（计划维护、故障维修、临时维护）")
    maintenance_type = fields.CharField(max_length=50, description="维护类型（日常保养、小修、中修、大修）")
    priority = fields.CharField(max_length=20, default="中", description="优先级（高、中、低）")
    planned_start_date = fields.DatetimeField(null=True, description="计划开始时间")
    planned_end_date = fields.DatetimeField(null=True, description="计划结束时间")
    actual_start_date = fields.DatetimeField(null=True, description="实际开始时间")
    actual_end_date = fields.DatetimeField(null=True, description="实际结束时间")
    assigned_person_id = fields.IntField(null=True, description="分配人员ID")
    assigned_person_name = fields.CharField(max_length=100, null=True, description="分配人员姓名")
    executor_id = fields.IntField(null=True, description="执行人员ID")
    executor_name = fields.CharField(max_length=100, null=True, description="执行人员姓名")
    status = fields.CharField(max_length=50, default="待分配", description="工单状态")
    remark = fields.TextField(null=True, description="备注")
