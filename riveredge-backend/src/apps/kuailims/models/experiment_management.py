"""
实验管理模型模块

定义实验管理数据模型，支持多组织隔离。
"""

from tortoise import fields
from core.models.base import BaseModel
from datetime import datetime


class ExperimentManagement(BaseModel):
    """
    实验管理模型
    
    用于管理实验，支持多组织隔离。
    
    Attributes:
        id: 主键ID（自增ID，内部使用）
        uuid: 业务ID（UUID，对外暴露，安全且唯一，继承自BaseModel）
        tenant_id: 组织ID（用于多组织数据隔离，继承自BaseModel）
        experiment_no: 实验编号（组织内唯一）
        experiment_name: 实验名称
        experiment_type: 实验类型
        sample_id: 样品ID（关联sample_management）
        sample_uuid: 样品UUID
        sample_no: 样品编号
        plan_start_date: 计划开始日期
        plan_end_date: 计划结束日期
        actual_start_date: 实际开始日期
        actual_end_date: 实际结束日期
        experimenter_id: 实验人员ID
        experimenter_name: 实验人员姓名
        experiment_status: 实验状态（计划中、执行中、已完成、已取消）
        execution_records: 执行记录（JSON格式）
        confirmation_status: 确认状态（待确认、已确认）
        confirmation_person_id: 确认人ID
        confirmation_person_name: 确认人姓名
        confirmation_date: 确认日期
        status: 状态（草稿、执行中、已完成、已取消）
        remark: 备注
        created_at: 创建时间（继承自BaseModel）
        updated_at: 更新时间（继承自BaseModel）
        deleted_at: 删除时间（软删除）
    """
    
    class Meta:
        """
        模型元数据
        """
        table = "seed_kuailims_experiment_managements"
        indexes = [
            ("tenant_id",),
            ("experiment_no",),
            ("experiment_type",),
            ("sample_id",),
            ("experiment_status",),
            ("confirmation_status",),
            ("status",),
        ]
        unique_together = [("tenant_id", "experiment_no")]
    
    experiment_no = fields.CharField(max_length=100, description="实验编号")
    experiment_name = fields.CharField(max_length=200, description="实验名称")
    experiment_type = fields.CharField(max_length=50, description="实验类型")
    sample_id = fields.IntField(null=True, description="样品ID")
    sample_uuid = fields.CharField(max_length=36, null=True, description="样品UUID")
    sample_no = fields.CharField(max_length=100, null=True, description="样品编号")
    plan_start_date = fields.DatetimeField(null=True, description="计划开始日期")
    plan_end_date = fields.DatetimeField(null=True, description="计划结束日期")
    actual_start_date = fields.DatetimeField(null=True, description="实际开始日期")
    actual_end_date = fields.DatetimeField(null=True, description="实际结束日期")
    experimenter_id = fields.IntField(null=True, description="实验人员ID")
    experimenter_name = fields.CharField(max_length=100, null=True, description="实验人员姓名")
    experiment_status = fields.CharField(max_length=50, default="计划中", description="实验状态")
    execution_records = fields.JSONField(null=True, description="执行记录")
    confirmation_status = fields.CharField(max_length=50, default="待确认", description="确认状态")
    confirmation_person_id = fields.IntField(null=True, description="确认人ID")
    confirmation_person_name = fields.CharField(max_length=100, null=True, description="确认人姓名")
    confirmation_date = fields.DatetimeField(null=True, description="确认日期")
    status = fields.CharField(max_length=50, default="草稿", description="状态")
    remark = fields.TextField(null=True, description="备注")

