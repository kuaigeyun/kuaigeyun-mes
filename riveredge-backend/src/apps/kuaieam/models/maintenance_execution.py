"""
维护执行记录模型模块

定义维护执行记录数据模型，支持多组织隔离。
"""

from tortoise import fields
from core.models.base import BaseModel


class MaintenanceExecution(BaseModel):
    """
    维护执行记录模型
    
    用于管理设备维护执行记录，支持多组织隔离。
    
    Attributes:
        id: 主键ID（自增ID，内部使用）
        uuid: 业务ID（UUID，对外暴露，安全且唯一，继承自BaseModel）
        tenant_id: 组织ID（用于多组织数据隔离，继承自BaseModel）
        execution_no: 执行记录编号（组织内唯一）
        workorder_id: 维护工单ID（关联维护工单）
        workorder_uuid: 维护工单UUID
        equipment_id: 设备ID（关联master-data）
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
        table = "seed_kuaieam_maintenance_executions"
        indexes = [
            ("tenant_id",),
            ("execution_no",),
            ("workorder_id",),
            ("equipment_id",),
            ("execution_date",),
            ("status",),
        ]
        unique_together = [("tenant_id", "execution_no")]
    
    execution_no = fields.CharField(max_length=100, description="执行记录编号")
    workorder_id = fields.IntField(null=True, description="维护工单ID")
    workorder_uuid = fields.CharField(max_length=36, null=True, description="维护工单UUID")
    equipment_id = fields.IntField(description="设备ID")
    equipment_name = fields.CharField(max_length=200, description="设备名称")
    execution_date = fields.DatetimeField(description="执行日期")
    executor_id = fields.IntField(null=True, description="执行人员ID")
    executor_name = fields.CharField(max_length=100, null=True, description="执行人员姓名")
    execution_content = fields.TextField(null=True, description="执行内容")
    execution_result = fields.CharField(max_length=50, null=True, description="执行结果（正常、异常、待处理）")
    maintenance_cost = fields.DecimalField(max_digits=10, decimal_places=2, null=True, description="维护成本")
    spare_parts_used = fields.JSONField(null=True, description="使用备件（JSON格式）")
    status = fields.CharField(max_length=50, default="草稿", description="记录状态")
    acceptance_person_id = fields.IntField(null=True, description="验收人员ID")
    acceptance_person_name = fields.CharField(max_length=100, null=True, description="验收人员姓名")
    acceptance_date = fields.DatetimeField(null=True, description="验收日期")
    acceptance_result = fields.CharField(max_length=50, null=True, description="验收结果（合格、不合格）")
    remark = fields.TextField(null=True, description="备注")
