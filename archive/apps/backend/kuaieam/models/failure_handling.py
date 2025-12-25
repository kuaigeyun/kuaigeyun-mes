"""
故障处理模型模块

定义故障处理数据模型，支持多组织隔离。
"""

from tortoise import fields
from core.models.base import BaseModel


class FailureHandling(BaseModel):
    """
    故障处理模型
    
    用于管理设备故障处理，支持多组织隔离。
    
    Attributes:
        id: 主键ID（自增ID，内部使用）
        uuid: 业务ID（UUID，对外暴露，安全且唯一，继承自BaseModel）
        tenant_id: 组织ID（用于多组织数据隔离，继承自BaseModel）
        handling_no: 处理单编号（组织内唯一）
        report_id: 故障报修ID（关联故障报修）
        report_uuid: 故障报修UUID
        equipment_id: 设备ID（关联master-data）
        equipment_name: 设备名称
        handling_start_date: 处理开始时间
        handling_end_date: 处理结束时间
        handler_id: 处理人员ID（用户ID）
        handler_name: 处理人员姓名
        handling_method: 处理方法
        handling_result: 处理结果（已修复、部分修复、无法修复、待确认）
        root_cause: 根本原因
        handling_cost: 处理成本
        spare_parts_used: 使用备件（JSON格式）
        status: 处理状态（处理中、已完成、已关闭）
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
        table = "apps_kuaieam_failure_handlings"
        indexes = [
            ("tenant_id",),
            ("handling_no",),
            ("report_id",),
            ("equipment_id",),
            ("status",),
            ("handling_start_date",),
        ]
        unique_together = [("tenant_id", "handling_no")]
    
    handling_no = fields.CharField(max_length=100, description="处理单编号")
    report_id = fields.IntField(null=True, description="故障报修ID")
    report_uuid = fields.CharField(max_length=36, null=True, description="故障报修UUID")
    equipment_id = fields.IntField(description="设备ID")
    equipment_name = fields.CharField(max_length=200, description="设备名称")
    handling_start_date = fields.DatetimeField(null=True, description="处理开始时间")
    handling_end_date = fields.DatetimeField(null=True, description="处理结束时间")
    handler_id = fields.IntField(null=True, description="处理人员ID")
    handler_name = fields.CharField(max_length=100, null=True, description="处理人员姓名")
    handling_method = fields.TextField(null=True, description="处理方法")
    handling_result = fields.CharField(max_length=50, null=True, description="处理结果（已修复、部分修复、无法修复、待确认）")
    root_cause = fields.TextField(null=True, description="根本原因")
    handling_cost = fields.DecimalField(max_digits=10, decimal_places=2, null=True, description="处理成本")
    spare_parts_used = fields.JSONField(null=True, description="使用备件（JSON格式）")
    status = fields.CharField(max_length=50, default="处理中", description="处理状态")
    acceptance_person_id = fields.IntField(null=True, description="验收人员ID")
    acceptance_person_name = fields.CharField(max_length=100, null=True, description="验收人员姓名")
    acceptance_date = fields.DatetimeField(null=True, description="验收日期")
    acceptance_result = fields.CharField(max_length=50, null=True, description="验收结果（合格、不合格）")
    remark = fields.TextField(null=True, description="备注")
