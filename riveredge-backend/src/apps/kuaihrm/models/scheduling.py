"""
排班管理模型模块

定义排班数据模型，支持多组织隔离。
"""

from tortoise import fields
from core.models.base import BaseModel


class SchedulingPlan(BaseModel):
    """
    排班计划模型
    
    用于管理排班计划，支持多组织隔离。
    
    Attributes:
        id: 主键ID（自增ID，内部使用）
        uuid: 业务ID（UUID，对外暴露，安全且唯一，继承自BaseModel）
        tenant_id: 组织ID（用于多组织数据隔离，继承自BaseModel）
        plan_no: 计划编号（组织内唯一）
        plan_name: 计划名称
        plan_period: 计划期间（格式：2024-01）
        start_date: 开始日期
        end_date: 结束日期
        department_id: 部门ID（关联master-data）
        status: 状态（草稿、已发布、已执行、已取消）
        created_at: 创建时间（继承自BaseModel）
        updated_at: 更新时间（继承自BaseModel）
        deleted_at: 删除时间（软删除）
    """
    
    class Meta:
        """
        模型元数据
        """
        table = "seed_kuaihrm_scheduling_plans"
        indexes = [
            ("tenant_id",),
            ("plan_no",),
            ("uuid",),
            ("plan_period",),
            ("department_id",),
            ("status",),
        ]
        unique_together = [("tenant_id", "plan_no")]
    
    # 主键
    id = fields.IntField(pk=True, description="主键ID")
    
    # 基本信息
    plan_no = fields.CharField(max_length=50, description="计划编号（组织内唯一）")
    plan_name = fields.CharField(max_length=200, description="计划名称")
    plan_period = fields.CharField(max_length=20, description="计划期间（格式：2024-01）")
    start_date = fields.DatetimeField(description="开始日期")
    end_date = fields.DatetimeField(description="结束日期")
    department_id = fields.IntField(null=True, description="部门ID（关联master-data）")
    
    # 状态
    status = fields.CharField(max_length=20, default="草稿", description="状态（草稿、已发布、已执行、已取消）")
    
    # 软删除字段
    deleted_at = fields.DatetimeField(null=True, description="删除时间（软删除）")
    
    def __str__(self):
        """字符串表示"""
        return f"{self.plan_no} - {self.plan_name}"


class SchedulingExecution(BaseModel):
    """
    排班执行模型
    
    用于管理排班执行，支持多组织隔离。
    
    Attributes:
        id: 主键ID（自增ID，内部使用）
        uuid: 业务ID（UUID，对外暴露，安全且唯一，继承自BaseModel）
        tenant_id: 组织ID（用于多组织数据隔离，继承自BaseModel）
        plan_id: 排班计划ID（关联SchedulingPlan）
        plan_no: 计划编号
        execution_date: 执行日期
        employee_id: 员工ID（关联master-data）
        employee_name: 员工姓名
        shift_type: 班次类型（早班、中班、晚班、其他）
        start_time: 开始时间
        end_time: 结束时间
        work_hours: 工作时长（小时）
        status: 状态（已排班、已执行、已取消）
        created_at: 创建时间（继承自BaseModel）
        updated_at: 更新时间（继承自BaseModel）
        deleted_at: 删除时间（软删除）
    """
    
    class Meta:
        """
        模型元数据
        """
        table = "seed_kuaihrm_scheduling_executions"
        indexes = [
            ("tenant_id",),
            ("uuid",),
            ("plan_id",),
            ("execution_date",),
            ("employee_id",),
            ("status",),
        ]
    
    # 主键
    id = fields.IntField(pk=True, description="主键ID")
    
    # 关联信息
    plan_id = fields.IntField(description="排班计划ID（关联SchedulingPlan）")
    plan_no = fields.CharField(max_length=50, description="计划编号")
    
    # 执行信息
    execution_date = fields.DatetimeField(description="执行日期")
    employee_id = fields.IntField(description="员工ID（关联master-data）")
    employee_name = fields.CharField(max_length=100, description="员工姓名")
    shift_type = fields.CharField(max_length=50, description="班次类型（早班、中班、晚班、其他）")
    start_time = fields.DatetimeField(description="开始时间")
    end_time = fields.DatetimeField(description="结束时间")
    work_hours = fields.DecimalField(max_digits=5, decimal_places=2, null=True, description="工作时长（小时）")
    
    # 状态
    status = fields.CharField(max_length=20, default="已排班", description="状态（已排班、已执行、已取消）")
    
    # 软删除字段
    deleted_at = fields.DatetimeField(null=True, description="删除时间（软删除）")
    
    def __str__(self):
        """字符串表示"""
        return f"{self.execution_date} - {self.employee_name} - {self.shift_type}"

