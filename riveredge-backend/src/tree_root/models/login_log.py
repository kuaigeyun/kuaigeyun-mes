"""
登录日志模型模块

定义登录日志数据模型，用于记录系统登录日志。
"""

from tortoise import fields
from typing import Optional
from .base import BaseModel


class LoginLog(BaseModel):
    """
    登录日志模型
    
    用于记录系统中的所有登录尝试，包括成功和失败。
    支持多组织隔离，每个组织的登录日志相互独立。
    
    注意：继承自 BaseModel，自动包含 uuid、tenant_id、created_at 字段。
    此模型不需要 updated_at 和 deleted_at 字段，因为日志一旦创建就不应修改或删除。
    """
    id = fields.IntField(pk=True, description="登录日志ID（主键，自增ID，内部使用）")
    # uuid 字段由 BaseModel 提供
    # tenant_id 字段由 BaseModel 提供（可为空，登录失败时可能无法确定组织）
    
    user_id = fields.IntField(null=True, description="登录用户ID（登录失败时可能为空）")
    
    # 登录基本信息
    username = fields.CharField(max_length=100, null=True, description="登录账号（冗余字段，用于查询）")
    login_ip = fields.CharField(max_length=50, description="登录IP地址")
    login_location = fields.CharField(max_length=200, null=True, description="登录地点（根据IP解析，可选）")
    login_device = fields.CharField(max_length=50, null=True, description="登录设备（PC、Mobile等，可选）")
    login_browser = fields.CharField(max_length=200, null=True, description="登录浏览器（可选）")
    
    # 登录状态
    login_status = fields.CharField(max_length=20, description="登录状态（success、failed）")
    failure_reason = fields.TextField(null=True, description="失败原因（登录失败时记录）")
    
    # created_at 字段由 BaseModel 提供
    
    class Meta:
        """
        模型元数据
        """
        table = "root_login_logs"
        indexes = [
            ("tenant_id",),
            ("user_id",),
            ("uuid",),
            ("username",),
            ("login_ip",),
            ("login_status",),
            ("created_at",),
            # 复合索引：优化常用组合查询
            ("tenant_id", "user_id"),  # 按组织+用户查询
            ("tenant_id", "login_status"),  # 按组织+登录状态查询
            ("tenant_id", "created_at"),  # 按组织+创建时间查询（时间范围查询）
            ("tenant_id", "user_id", "created_at"),  # 按组织+用户+时间查询
        ]
    
    def __str__(self):
        """字符串表示"""
        return f"LoginLog(uuid={self.uuid}, username='{self.username}', status='{self.login_status}')"

