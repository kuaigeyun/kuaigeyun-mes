"""
操作日志模型模块

定义操作日志数据模型，用于操作日志管理。
"""

from tortoise import fields
from typing import Optional
from .base import BaseModel


class OperationLog(BaseModel):
    """
    操作日志模型
    
    用于记录系统操作日志，支持自动记录和手动记录。
    支持多组织隔离，每个组织的操作日志相互独立。
    
    注意：继承自 BaseModel，自动包含 uuid、tenant_id、created_at、updated_at 字段。
    注意：操作日志不可修改和删除，因此不需要 updated_at 和 deleted_at 字段。
    """
    id = fields.IntField(pk=True, description="操作日志ID（主键，自增ID，内部使用）")
    # uuid 字段由 BaseModel 提供
    # tenant_id 字段由 BaseModel 提供
    
    # 操作用户
    user_id = fields.IntField(description="操作用户ID（外键）")
    
    # 操作基本信息
    operation_type = fields.CharField(max_length=50, description="操作类型（create、update、delete、view等）")
    operation_module = fields.CharField(max_length=100, null=True, description="操作模块（用户管理、角色管理等）")
    operation_object_type = fields.CharField(max_length=100, null=True, description="操作对象类型（User、Role等）")
    operation_object_id = fields.IntField(null=True, description="操作对象ID")
    operation_object_uuid = fields.CharField(max_length=36, null=True, description="操作对象UUID")
    operation_content = fields.TextField(null=True, description="操作内容（操作描述）")
    
    # 操作环境信息
    ip_address = fields.CharField(max_length=50, null=True, description="操作IP")
    user_agent = fields.TextField(null=True, description="用户代理（浏览器信息）")
    
    # 请求信息（可选）
    request_method = fields.CharField(max_length=10, null=True, description="请求方法（GET、POST等）")
    request_path = fields.CharField(max_length=500, null=True, description="请求路径")
    
    class Meta:
        """
        模型元数据
        """
        table = "root_operation_logs"
        indexes = [
            ("tenant_id",),
            ("uuid",),
            ("user_id",),
            ("operation_type",),
            ("operation_module",),
            ("operation_object_type",),
            ("created_at",),
        ]
    
    def __str__(self):
        """字符串表示"""
        return f"{self.operation_type} - {self.operation_module} ({self.created_at})"

