"""
报告管理模型模块

定义报告管理数据模型，支持多组织隔离。
"""

from tortoise import fields
from core.models.base import BaseModel
from datetime import datetime


class ReportManagement(BaseModel):
    """
    报告管理模型
    
    用于管理实验报告，支持多组织隔离。
    
    Attributes:
        id: 主键ID（自增ID，内部使用）
        uuid: 业务ID（UUID，对外暴露，安全且唯一，继承自BaseModel）
        tenant_id: 组织ID（用于多组织数据隔离，继承自BaseModel）
        report_no: 报告编号（组织内唯一）
        report_name: 报告名称
        experiment_id: 实验ID（关联experiment_management）
        experiment_uuid: 实验UUID
        experiment_no: 实验编号
        report_template: 报告模板
        report_content: 报告内容（JSON格式或文本）
        generation_method: 生成方式（自动生成、手动编写）
        generation_date: 生成日期
        audit_status: 审核状态（待审核、审核中、已审核、已拒绝）
        audit_person_id: 审核人ID
        audit_person_name: 审核人姓名
        audit_date: 审核日期
        audit_records: 审核记录（JSON格式）
        publish_status: 发布状态（未发布、已发布）
        publish_date: 发布日期
        publish_records: 发布记录（JSON格式）
        status: 状态（草稿、已生成、已审核、已发布）
        remark: 备注
        created_at: 创建时间（继承自BaseModel）
        updated_at: 更新时间（继承自BaseModel）
        deleted_at: 删除时间（软删除）
    """
    
    class Meta:
        """
        模型元数据
        """
        table = "apps_kuailims_report_managements"
        indexes = [
            ("tenant_id",),
            ("report_no",),
            ("experiment_id",),
            ("audit_status",),
            ("publish_status",),
            ("status",),
        ]
        unique_together = [("tenant_id", "report_no")]
    
    report_no = fields.CharField(max_length=100, description="报告编号")
    report_name = fields.CharField(max_length=200, description="报告名称")
    experiment_id = fields.IntField(null=True, description="实验ID")
    experiment_uuid = fields.CharField(max_length=36, null=True, description="实验UUID")
    experiment_no = fields.CharField(max_length=100, null=True, description="实验编号")
    report_template = fields.CharField(max_length=200, null=True, description="报告模板")
    report_content = fields.TextField(null=True, description="报告内容")
    generation_method = fields.CharField(max_length=50, default="自动生成", description="生成方式")
    generation_date = fields.DatetimeField(null=True, description="生成日期")
    audit_status = fields.CharField(max_length=50, default="待审核", description="审核状态")
    audit_person_id = fields.IntField(null=True, description="审核人ID")
    audit_person_name = fields.CharField(max_length=100, null=True, description="审核人姓名")
    audit_date = fields.DatetimeField(null=True, description="审核日期")
    audit_records = fields.JSONField(null=True, description="审核记录")
    publish_status = fields.CharField(max_length=50, default="未发布", description="发布状态")
    publish_date = fields.DatetimeField(null=True, description="发布日期")
    publish_records = fields.JSONField(null=True, description="发布记录")
    status = fields.CharField(max_length=50, default="草稿", description="状态")
    remark = fields.TextField(null=True, description="备注")

