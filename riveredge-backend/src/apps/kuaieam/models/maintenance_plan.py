"""
维护计划模型模块

定义维护计划数据模型，支持多组织隔离。
"""

from tortoise import fields
from core.models.base import BaseModel


class MaintenancePlan(BaseModel):
    """
    维护计划模型
    
    用于管理设备维护计划，支持多组织隔离。
    
    Attributes:
        id: 主键ID（自增ID，内部使用）
        uuid: 业务ID（UUID，对外暴露，安全且唯一，继承自BaseModel）
        tenant_id: 组织ID（用于多组织数据隔离，继承自BaseModel）
        plan_no: 维护计划编号（组织内唯一）
        plan_name: 计划名称
        equipment_id: 设备ID（关联master-data）
        equipment_name: 设备名称
        plan_type: 计划类型（预防性维护、定期维护、临时维护）
        maintenance_type: 维护类型（日常保养、小修、中修、大修）
        cycle_type: 周期类型（按时间、按运行时长、按使用次数）
        cycle_value: 周期值
        cycle_unit: 周期单位（天、小时、次）
        planned_start_date: 计划开始日期
        planned_end_date: 计划结束日期
        responsible_person_id: 负责人ID（用户ID）
        responsible_person_name: 负责人姓名
        status: 计划状态（草稿、已发布、执行中、已完成、已取消）
        remark: 备注
        created_at: 创建时间（继承自BaseModel）
        updated_at: 更新时间（继承自BaseModel）
        deleted_at: 删除时间（软删除）
    """
    
    class Meta:
        """
        模型元数据
        """
        table = "seed_kuaieam_maintenance_plans"
        indexes = [
            ("tenant_id",),
            ("plan_no",),
            ("equipment_id",),
            ("status",),
            ("planned_start_date",),
        ]
        unique_together = [("tenant_id", "plan_no")]
    
    plan_no = fields.CharField(max_length=100, description="维护计划编号")
    plan_name = fields.CharField(max_length=200, description="计划名称")
    equipment_id = fields.IntField(description="设备ID")
    equipment_name = fields.CharField(max_length=200, description="设备名称")
    plan_type = fields.CharField(max_length=50, description="计划类型（预防性维护、定期维护、临时维护）")
    maintenance_type = fields.CharField(max_length=50, description="维护类型（日常保养、小修、中修、大修）")
    cycle_type = fields.CharField(max_length=50, description="周期类型（按时间、按运行时长、按使用次数）")
    cycle_value = fields.IntField(null=True, description="周期值")
    cycle_unit = fields.CharField(max_length=20, null=True, description="周期单位（天、小时、次）")
    planned_start_date = fields.DatetimeField(null=True, description="计划开始日期")
    planned_end_date = fields.DatetimeField(null=True, description="计划结束日期")
    responsible_person_id = fields.IntField(null=True, description="负责人ID")
    responsible_person_name = fields.CharField(max_length=100, null=True, description="负责人姓名")
    status = fields.CharField(max_length=50, default="草稿", description="计划状态")
    remark = fields.TextField(null=True, description="备注")
