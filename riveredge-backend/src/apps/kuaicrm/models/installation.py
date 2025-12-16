"""
安装记录模型模块

定义安装记录数据模型，支持多组织隔离。
"""

from tortoise import fields
from core.models.base import BaseModel


class Installation(BaseModel):
    """
    安装记录模型
    
    用于管理产品安装记录，支持多组织隔离。
    
    Attributes:
        id: 主键ID（自增ID，内部使用）
        uuid: 业务ID（UUID，对外暴露，安全且唯一，继承自BaseModel）
        tenant_id: 组织ID（用于多组织数据隔离，继承自BaseModel）
        installation_no: 安装编号（组织内唯一）
        customer_id: 客户ID（关联master-data）
        installation_date: 安装日期
        installation_address: 安装地址
        installation_status: 安装状态
        created_at: 创建时间（继承自BaseModel）
        updated_at: 更新时间（继承自BaseModel）
        deleted_at: 删除时间（软删除）
    """
    
    class Meta:
        """
        模型元数据
        """
        table = "apps_kuaicrm_installations"
        indexes = [
            ("tenant_id",),
            ("installation_no",),
            ("uuid",),
            ("installation_status",),
            ("customer_id",),
            ("installation_date",),
        ]
        unique_together = [("tenant_id", "installation_no")]
    
    # 主键
    id = fields.IntField(pk=True, description="主键ID")
    
    # 基本信息
    installation_no = fields.CharField(max_length=50, description="安装编号（组织内唯一）")
    customer_id = fields.IntField(description="客户ID（关联master-data）")
    installation_date = fields.DatetimeField(description="安装日期")
    installation_address = fields.TextField(description="安装地址")
    
    # 安装状态
    installation_status = fields.CharField(max_length=20, default="待安装", description="安装状态（待安装、安装中、已完成、已取消）")
    installation_result = fields.TextField(null=True, description="安装结果")
    
    # 软删除字段
    deleted_at = fields.DatetimeField(null=True, description="删除时间（软删除）")
    
    def __str__(self):
        """字符串表示"""
        return f"{self.installation_no} - {self.installation_date}"
