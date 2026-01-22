"""
客户模型模块

定义客户数据模型，支持多组织隔离。
"""

from tortoise import fields
from core.models.base import BaseModel


class Customer(BaseModel):
    """
    客户模型
    
    用于管理客户基础数据，支持多组织隔离。
    
    Attributes:
        id: 主键ID（自增ID，内部使用）
        uuid: 业务ID（UUID，对外暴露，安全且唯一，继承自BaseModel）
        tenant_id: 组织ID（用于多组织数据隔离，继承自BaseModel）
        code: 客户编码（组织内唯一）
        name: 客户名称
        short_name: 简称
        contact_person: 联系人
        phone: 电话
        email: 邮箱
        address: 地址
        category: 客户分类
        is_active: 是否启用
        created_at: 创建时间（继承自BaseModel）
        updated_at: 更新时间（继承自BaseModel）
        deleted_at: 删除时间（软删除）
    """
    
    class Meta:
        """
        模型元数据
        """
        table = "apps_master_data_customers"
        indexes = [
            ("tenant_id",),
            ("code",),
            ("uuid",),
            ("category",),
        ]
        # 注意：唯一约束已通过数据库部分唯一索引实现（WHERE deleted_at IS NULL）
        # 支持软删除后重用编码，详见迁移文件：63_20260122182517_add_partial_unique_indexes_for_soft_delete.py
        # unique_together = [("tenant_id", "code")]
    
    # 主键（BaseModel 不包含 id 字段，需要自己定义）
    id = fields.IntField(pk=True, description="主键ID")
    
    # 基本信息
    code = fields.CharField(max_length=50, description="客户编码（组织内唯一）")
    name = fields.CharField(max_length=200, description="客户名称")
    short_name = fields.CharField(max_length=100, null=True, description="简称")
    
    # 联系信息
    contact_person = fields.CharField(max_length=100, null=True, description="联系人")
    phone = fields.CharField(max_length=20, null=True, description="电话")
    email = fields.CharField(max_length=100, null=True, description="邮箱")
    address = fields.TextField(null=True, description="地址")
    
    # 分类信息
    category = fields.CharField(max_length=50, null=True, description="客户分类")
    
    # 状态信息
    is_active = fields.BooleanField(default=True, description="是否启用")
    
    # 软删除字段
    deleted_at = fields.DatetimeField(null=True, description="删除时间（软删除）")
    
    def __str__(self):
        """字符串表示"""
        return f"{self.code} - {self.name}"

