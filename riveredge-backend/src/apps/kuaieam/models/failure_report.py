"""
故障报修模型模块

定义故障报修数据模型，支持多组织隔离。
"""

from tortoise import fields
from core.models.base import BaseModel


class FailureReport(BaseModel):
    """
    故障报修模型
    
    用于管理设备故障报修，支持多组织隔离。
    
    Attributes:
        id: 主键ID（自增ID，内部使用）
        uuid: 业务ID（UUID，对外暴露，安全且唯一，继承自BaseModel）
        tenant_id: 组织ID（用于多组织数据隔离，继承自BaseModel）
        report_no: 报修单编号（组织内唯一）
        equipment_id: 设备ID（关联master-data）
        equipment_name: 设备名称
        failure_type: 故障类型（机械故障、电气故障、软件故障、其他）
        failure_level: 故障等级（一般、严重、紧急）
        failure_description: 故障描述
        reporter_id: 报修人ID（用户ID）
        reporter_name: 报修人姓名
        report_date: 报修日期
        assigned_person_id: 分配人员ID（用户ID）
        assigned_person_name: 分配人员姓名
        assigned_date: 分配日期
        status: 报修状态（待分配、已分配、处理中、已完成、已关闭）
        remark: 备注
        created_at: 创建时间（继承自BaseModel）
        updated_at: 更新时间（继承自BaseModel）
        deleted_at: 删除时间（软删除）
    """
    
    class Meta:
        """
        模型元数据
        """
        table = "seed_kuaieam_failure_reports"
        indexes = [
            ("tenant_id",),
            ("report_no",),
            ("equipment_id",),
            ("failure_type",),
            ("failure_level",),
            ("status",),
            ("report_date",),
        ]
        unique_together = [("tenant_id", "report_no")]
    
    report_no = fields.CharField(max_length=100, description="报修单编号")
    equipment_id = fields.IntField(description="设备ID")
    equipment_name = fields.CharField(max_length=200, description="设备名称")
    failure_type = fields.CharField(max_length=50, description="故障类型（机械故障、电气故障、软件故障、其他）")
    failure_level = fields.CharField(max_length=20, default="一般", description="故障等级（一般、严重、紧急）")
    failure_description = fields.TextField(description="故障描述")
    reporter_id = fields.IntField(null=True, description="报修人ID")
    reporter_name = fields.CharField(max_length=100, null=True, description="报修人姓名")
    report_date = fields.DatetimeField(description="报修日期")
    assigned_person_id = fields.IntField(null=True, description="分配人员ID")
    assigned_person_name = fields.CharField(max_length=100, null=True, description="分配人员姓名")
    assigned_date = fields.DatetimeField(null=True, description="分配日期")
    status = fields.CharField(max_length=50, default="待分配", description="报修状态")
    remark = fields.TextField(null=True, description="备注")
