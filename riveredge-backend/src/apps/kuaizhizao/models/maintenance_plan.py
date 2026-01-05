"""
维护保养计划模型模块

定义维护保养计划数据模型，支持多组织隔离。

Author: Luigi Lu
Date: 2025-01-15
"""

from tortoise import fields
from core.models.base import BaseModel


class MaintenancePlan(BaseModel):
    """
    维护保养计划模型
    
    用于管理设备维护保养计划，支持多组织隔离。
    
    注意：继承自 BaseModel，自动包含 uuid、tenant_id、created_at、updated_at 字段。
    
    Attributes:
        id: 主键ID（自增ID，内部使用）
        uuid: 业务ID（UUID，对外暴露，安全且唯一，继承自BaseModel）
        tenant_id: 组织ID（用于多组织数据隔离，继承自BaseModel）
        plan_no: 维护计划编号（组织内唯一）
        plan_name: 计划名称
        equipment_id: 设备ID（关联设备）
        equipment_uuid: 设备UUID
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
        table = "core_maintenance_plans"
        indexes = [
            ("tenant_id",),
            ("plan_no",),
            ("equipment_id",),
            ("equipment_uuid",),
            ("status",),
            ("planned_start_date",),
        ]
        unique_together = [("tenant_id", "plan_no")]
    
    # 主键（BaseModel 不包含 id 字段，需要自己定义）
    id = fields.IntField(pk=True, description="主键ID")
    
    # 基本信息
    plan_no = fields.CharField(max_length=100, description="维护计划编号（组织内唯一）")
    plan_name = fields.CharField(max_length=200, description="计划名称")
    
    # 关联设备
    equipment_id = fields.IntField(description="设备ID（关联设备）")
    equipment_uuid = fields.CharField(max_length=36, description="设备UUID")
    equipment_name = fields.CharField(max_length=200, description="设备名称")
    
    # 计划类型
    plan_type = fields.CharField(max_length=50, description="计划类型（预防性维护、定期维护、临时维护）")
    maintenance_type = fields.CharField(max_length=50, description="维护类型（日常保养、小修、中修、大修）")
    
    # 周期设置
    cycle_type = fields.CharField(max_length=50, description="周期类型（按时间、按运行时长、按使用次数）")
    cycle_value = fields.IntField(null=True, description="周期值")
    cycle_unit = fields.CharField(max_length=20, null=True, description="周期单位（天、小时、次）")
    
    # 计划时间
    planned_start_date = fields.DatetimeField(null=True, description="计划开始日期")
    planned_end_date = fields.DatetimeField(null=True, description="计划结束日期")
    
    # 负责人
    responsible_person_id = fields.IntField(null=True, description="负责人ID（用户ID）")
    responsible_person_name = fields.CharField(max_length=100, null=True, description="负责人姓名")
    
    # 状态
    status = fields.CharField(max_length=50, default="草稿", description="计划状态（草稿、已发布、执行中、已完成、已取消）")
    remark = fields.TextField(null=True, description="备注")
    
    # 软删除字段
    deleted_at = fields.DatetimeField(null=True, description="删除时间（软删除）")
    
    def __str__(self):
        """字符串表示"""
        return f"{self.plan_no} - {self.plan_name}"


class MaintenanceExecution(BaseModel):
    """
    维护执行记录模型
    
    用于管理设备维护执行记录，支持多组织隔离。
    
    注意：继承自 BaseModel，自动包含 uuid、tenant_id、created_at、updated_at 字段。
    
    Attributes:
        id: 主键ID（自增ID，内部使用）
        uuid: 业务ID（UUID，对外暴露，安全且唯一，继承自BaseModel）
        tenant_id: 组织ID（用于多组织数据隔离，继承自BaseModel）
        execution_no: 执行记录编号（组织内唯一）
        maintenance_plan_id: 维护计划ID（关联维护计划）
        maintenance_plan_uuid: 维护计划UUID
        equipment_id: 设备ID（关联设备）
        equipment_uuid: 设备UUID
        equipment_name: 设备名称
        execution_date: 执行日期
        executor_id: 执行人员ID（用户ID）
        executor_name: 执行人员姓名
        execution_content: 执行内容
        execution_result: 执行结果（正常、异常、待处理）
        maintenance_cost: 维护成本
        spare_parts_used: 使用备件（JSON格式）
        status: 记录状态（草稿、已确认、已验收）
        acceptance_person_id: 验收人员ID（用户ID）
        acceptance_person_name: 验收人员姓名
        acceptance_date: 验收日期
        acceptance_result: 验收结果（合格、不合格）
        remark: 备注
        created_at: 创建时间（继承自BaseModel）
        updated_at: 更新时间（继承自BaseModel）
        deleted_at: 删除时间（软删除）
    """
    
    class Meta:
        """
        模型元数据
        """
        table = "core_maintenance_executions"
        indexes = [
            ("tenant_id",),
            ("execution_no",),
            ("maintenance_plan_id",),
            ("equipment_id",),
            ("execution_date",),
            ("status",),
        ]
        unique_together = [("tenant_id", "execution_no")]
    
    # 主键（BaseModel 不包含 id 字段，需要自己定义）
    id = fields.IntField(pk=True, description="主键ID")
    
    # 基本信息
    execution_no = fields.CharField(max_length=100, description="执行记录编号（组织内唯一）")
    
    # 关联维护计划
    maintenance_plan_id = fields.IntField(null=True, description="维护计划ID（关联维护计划）")
    maintenance_plan_uuid = fields.CharField(max_length=36, null=True, description="维护计划UUID")
    
    # 关联设备
    equipment_id = fields.IntField(description="设备ID（关联设备）")
    equipment_uuid = fields.CharField(max_length=36, description="设备UUID")
    equipment_name = fields.CharField(max_length=200, description="设备名称")
    
    # 执行信息
    execution_date = fields.DatetimeField(description="执行日期")
    executor_id = fields.IntField(null=True, description="执行人员ID（用户ID）")
    executor_name = fields.CharField(max_length=100, null=True, description="执行人员姓名")
    execution_content = fields.TextField(null=True, description="执行内容")
    execution_result = fields.CharField(max_length=50, null=True, description="执行结果（正常、异常、待处理）")
    maintenance_cost = fields.DecimalField(max_digits=10, decimal_places=2, null=True, description="维护成本")
    spare_parts_used = fields.JSONField(null=True, description="使用备件（JSON格式）")
    
    # 验收信息
    status = fields.CharField(max_length=50, default="草稿", description="记录状态（草稿、已确认、已验收）")
    acceptance_person_id = fields.IntField(null=True, description="验收人员ID（用户ID）")
    acceptance_person_name = fields.CharField(max_length=100, null=True, description="验收人员姓名")
    acceptance_date = fields.DatetimeField(null=True, description="验收日期")
    acceptance_result = fields.CharField(max_length=50, null=True, description="验收结果（合格、不合格）")
    remark = fields.TextField(null=True, description="备注")
    
    # 软删除字段
    deleted_at = fields.DatetimeField(null=True, description="删除时间（软删除）")
    
    def __str__(self):
        """字符串表示"""
        return f"{self.execution_no} - {self.equipment_name}"

