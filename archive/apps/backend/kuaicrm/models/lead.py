"""
线索模型模块

定义线索数据模型，支持多组织隔离。
"""

from tortoise import fields
from core.models.base import BaseModel


class Lead(BaseModel):
    """
    线索模型
    
    用于管理销售线索，支持多组织隔离。
    
    Attributes:
        id: 主键ID（自增ID，内部使用）
        uuid: 业务ID（UUID，对外暴露，安全且唯一，继承自BaseModel）
        tenant_id: 组织ID（用于多组织数据隔离，继承自BaseModel）
        lead_no: 线索编号（组织内唯一）
        lead_source: 线索来源（展会、网站、转介绍、电话营销等）
        status: 线索状态（新线索、跟进中、已转化、已关闭）
        customer_name: 客户名称（可能还未在master-data中）
        contact_name: 联系人
        contact_phone: 联系电话
        contact_email: 联系邮箱
        score: 线索评分
        assigned_to: 分配给（用户ID）
        convert_status: 转化状态（未转化、已转化为商机、已转化为客户）
        convert_time: 转化时间
        created_at: 创建时间（继承自BaseModel）
        updated_at: 更新时间（继承自BaseModel）
        deleted_at: 删除时间（软删除）
    """
    
    class Meta:
        """
        模型元数据
        """
        table = "apps_kuaicrm_leads"
        indexes = [
            ("tenant_id",),
            ("lead_no",),
            ("uuid",),
            ("status",),
            ("assigned_to",),
            ("lead_source",),
        ]
        unique_together = [("tenant_id", "lead_no")]
    
    # 主键
    id = fields.IntField(pk=True, description="主键ID")
    
    # 基本信息
    lead_no = fields.CharField(max_length=50, description="线索编号（组织内唯一）")
    lead_source = fields.CharField(max_length=50, description="线索来源（展会、网站、转介绍、电话营销等）")
    status = fields.CharField(max_length=20, default="新线索", description="线索状态（新线索、跟进中、已转化、已关闭）")
    
    # 客户信息（可能还未在master-data中）
    customer_name = fields.CharField(max_length=200, description="客户名称")
    contact_name = fields.CharField(max_length=100, null=True, description="联系人")
    contact_phone = fields.CharField(max_length=20, null=True, description="联系电话")
    contact_email = fields.CharField(max_length=100, null=True, description="联系邮箱")
    address = fields.TextField(null=True, description="地址")
    
    # 线索评分
    score = fields.IntField(default=0, description="线索评分")
    
    # 分配信息
    assigned_to = fields.IntField(null=True, description="分配给（用户ID）")
    
    # 转化信息
    convert_status = fields.CharField(max_length=20, null=True, description="转化状态（未转化、已转化为商机、已转化为客户）")
    convert_time = fields.DatetimeField(null=True, description="转化时间")
    convert_reason = fields.TextField(null=True, description="转化原因")
    
    # 软删除字段
    deleted_at = fields.DatetimeField(null=True, description="删除时间（软删除）")
    
    def __str__(self):
        """字符串表示"""
        return f"{self.lead_no} - {self.customer_name}"
