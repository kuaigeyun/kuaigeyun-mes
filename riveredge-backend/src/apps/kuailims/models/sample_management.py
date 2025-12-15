"""
样品管理模型模块

定义样品管理数据模型，支持多组织隔离。
"""

from tortoise import fields
from core.models.base import BaseModel
from datetime import datetime


class SampleManagement(BaseModel):
    """
    样品管理模型
    
    用于管理样品，支持多组织隔离。
    
    Attributes:
        id: 主键ID（自增ID，内部使用）
        uuid: 业务ID（UUID，对外暴露，安全且唯一，继承自BaseModel）
        tenant_id: 组织ID（用于多组织数据隔离，继承自BaseModel）
        sample_no: 样品编号（组织内唯一）
        sample_name: 样品名称
        sample_type: 样品类型
        sample_category: 样品分类
        sample_source: 样品来源
        registration_date: 登记日期
        registration_person_id: 登记人ID
        registration_person_name: 登记人姓名
        sample_status: 样品状态（已登记、流转中、已存储、已归档）
        storage_location: 存储位置
        storage_condition: 存储条件（JSON格式）
        current_location: 当前位置
        transfer_records: 流转记录（JSON格式）
        expiry_date: 有效期
        status: 状态（正常、已过期、已销毁）
        remark: 备注
        created_at: 创建时间（继承自BaseModel）
        updated_at: 更新时间（继承自BaseModel）
        deleted_at: 删除时间（软删除）
    """
    
    class Meta:
        """
        模型元数据
        """
        table = "seed_kuailims_sample_managements"
        indexes = [
            ("tenant_id",),
            ("sample_no",),
            ("sample_type",),
            ("sample_category",),
            ("sample_status",),
            ("status",),
        ]
        unique_together = [("tenant_id", "sample_no")]
    
    sample_no = fields.CharField(max_length=100, description="样品编号")
    sample_name = fields.CharField(max_length=200, description="样品名称")
    sample_type = fields.CharField(max_length=50, description="样品类型")
    sample_category = fields.CharField(max_length=50, null=True, description="样品分类")
    sample_source = fields.CharField(max_length=200, null=True, description="样品来源")
    registration_date = fields.DatetimeField(null=True, description="登记日期")
    registration_person_id = fields.IntField(null=True, description="登记人ID")
    registration_person_name = fields.CharField(max_length=100, null=True, description="登记人姓名")
    sample_status = fields.CharField(max_length=50, default="已登记", description="样品状态")
    storage_location = fields.CharField(max_length=200, null=True, description="存储位置")
    storage_condition = fields.JSONField(null=True, description="存储条件")
    current_location = fields.CharField(max_length=200, null=True, description="当前位置")
    transfer_records = fields.JSONField(null=True, description="流转记录")
    expiry_date = fields.DatetimeField(null=True, description="有效期")
    status = fields.CharField(max_length=50, default="正常", description="状态")
    remark = fields.TextField(null=True, description="备注")

