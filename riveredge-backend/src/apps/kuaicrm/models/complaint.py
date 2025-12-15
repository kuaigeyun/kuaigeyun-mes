"""
投诉处理模型模块

定义投诉数据模型，支持多组织隔离。
"""

from tortoise import fields
from core.models.base import BaseModel


class Complaint(BaseModel):
    """
    投诉模型
    
    用于管理客户投诉，支持多组织隔离。
    
    Attributes:
        id: 主键ID（自增ID，内部使用）
        uuid: 业务ID（UUID，对外暴露，安全且唯一，继承自BaseModel）
        tenant_id: 组织ID（用于多组织数据隔离，继承自BaseModel）
        complaint_no: 投诉编号（组织内唯一）
        customer_id: 客户ID（关联master-data）
        complaint_type: 投诉类型
        complaint_content: 投诉内容
        handle_status: 处理状态
        created_at: 创建时间（继承自BaseModel）
        updated_at: 更新时间（继承自BaseModel）
        deleted_at: 删除时间（软删除）
    """
    
    class Meta:
        """
        模型元数据
        """
        table = "seed_kuaicrm_complaints"
        indexes = [
            ("tenant_id",),
            ("complaint_no",),
            ("uuid",),
            ("handle_status",),
            ("customer_id",),
            ("complaint_type",),
        ]
        unique_together = [("tenant_id", "complaint_no")]
    
    # 主键
    id = fields.IntField(pk=True, description="主键ID")
    
    # 基本信息
    complaint_no = fields.CharField(max_length=50, description="投诉编号（组织内唯一）")
    customer_id = fields.IntField(description="客户ID（关联master-data）")
    complaint_type = fields.CharField(max_length=50, description="投诉类型")
    complaint_content = fields.TextField(description="投诉内容")
    
    # 处理信息
    handle_status = fields.CharField(max_length=20, default="待处理", description="处理状态（待处理、处理中、已处理、已关闭）")
    handle_result = fields.TextField(null=True, description="处理结果")
    handle_time = fields.DatetimeField(null=True, description="处理时间")
    
    # 软删除字段
    deleted_at = fields.DatetimeField(null=True, description="删除时间（软删除）")
    
    def __str__(self):
        """字符串表示"""
        return f"{self.complaint_no} - {self.complaint_type}"
