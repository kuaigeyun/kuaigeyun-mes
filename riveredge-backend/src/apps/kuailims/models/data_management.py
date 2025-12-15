"""
数据管理模型模块

定义数据管理数据模型，支持多组织隔离。
"""

from tortoise import fields
from core.models.base import BaseModel
from datetime import datetime


class DataManagement(BaseModel):
    """
    数据管理模型
    
    用于管理实验数据，支持多组织隔离。
    
    Attributes:
        id: 主键ID（自增ID，内部使用）
        uuid: 业务ID（UUID，对外暴露，安全且唯一，继承自BaseModel）
        tenant_id: 组织ID（用于多组织数据隔离，继承自BaseModel）
        data_no: 数据编号（组织内唯一）
        data_name: 数据名称
        experiment_id: 实验ID（关联experiment_management）
        experiment_uuid: 实验UUID
        experiment_no: 实验编号
        data_type: 数据类型（手动录入、自动采集）
        data_content: 数据内容（JSON格式）
        entry_person_id: 录入人ID
        entry_person_name: 录入人姓名
        entry_date: 录入日期
        validation_status: 校验状态（待校验、已校验、校验失败）
        validation_result: 校验结果
        audit_status: 审核状态（待审核、审核中、已审核、已拒绝）
        audit_person_id: 审核人ID
        audit_person_name: 审核人姓名
        audit_date: 审核日期
        audit_records: 审核记录（JSON格式）
        archive_status: 归档状态（未归档、已归档）
        archive_date: 归档日期
        status: 状态（草稿、已录入、已审核、已归档）
        remark: 备注
        created_at: 创建时间（继承自BaseModel）
        updated_at: 更新时间（继承自BaseModel）
        deleted_at: 删除时间（软删除）
    """
    
    class Meta:
        """
        模型元数据
        """
        table = "seed_kuailims_data_managements"
        indexes = [
            ("tenant_id",),
            ("data_no",),
            ("experiment_id",),
            ("data_type",),
            ("validation_status",),
            ("audit_status",),
            ("archive_status",),
            ("status",),
        ]
        unique_together = [("tenant_id", "data_no")]
    
    data_no = fields.CharField(max_length=100, description="数据编号")
    data_name = fields.CharField(max_length=200, description="数据名称")
    experiment_id = fields.IntField(null=True, description="实验ID")
    experiment_uuid = fields.CharField(max_length=36, null=True, description="实验UUID")
    experiment_no = fields.CharField(max_length=100, null=True, description="实验编号")
    data_type = fields.CharField(max_length=50, description="数据类型")
    data_content = fields.JSONField(null=True, description="数据内容")
    entry_person_id = fields.IntField(null=True, description="录入人ID")
    entry_person_name = fields.CharField(max_length=100, null=True, description="录入人姓名")
    entry_date = fields.DatetimeField(null=True, description="录入日期")
    validation_status = fields.CharField(max_length=50, default="待校验", description="校验状态")
    validation_result = fields.TextField(null=True, description="校验结果")
    audit_status = fields.CharField(max_length=50, default="待审核", description="审核状态")
    audit_person_id = fields.IntField(null=True, description="审核人ID")
    audit_person_name = fields.CharField(max_length=100, null=True, description="审核人姓名")
    audit_date = fields.DatetimeField(null=True, description="审核日期")
    audit_records = fields.JSONField(null=True, description="审核记录")
    archive_status = fields.CharField(max_length=50, default="未归档", description="归档状态")
    archive_date = fields.DatetimeField(null=True, description="归档日期")
    status = fields.CharField(max_length=50, default="草稿", description="状态")
    remark = fields.TextField(null=True, description="备注")

