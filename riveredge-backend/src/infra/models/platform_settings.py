"""
平台设置模型模块

定义平台设置数据模型，用于存储平台级配置信息。

Author: Auto (AI Assistant)
Date: 2026-01-06
"""

from datetime import datetime
from tortoise import fields
from tortoise.models import Model


class PlatformSettings(Model):
    """
    平台设置模型
    
    存储平台级配置信息，如平台名称、Logo等。
    平台设置是全局唯一的，整个系统只有一条记录。
    
    Attributes:
        id: 主键ID
        platform_name: 平台名称
        platform_logo: 平台Logo URL（可选）
        platform_description: 平台描述（可选）
        platform_contact_email: 平台联系邮箱（可选）
        platform_contact_phone: 平台联系电话（可选）
        platform_website: 平台网站（可选）
        created_at: 创建时间
        updated_at: 更新时间
    """
    
    class Meta:
        """
        模型元数据
        """
        table = "infra_platform_settings"
        indexes = [
            ("platform_name",),
        ]
    
    # 主键
    id = fields.IntField(pk=True, description="主键ID")
    
    # 平台基本信息
    platform_name = fields.CharField(
        max_length=200,
        default="RiverEdge SaaS Framework",
        description="平台名称"
    )
    platform_logo = fields.CharField(
        max_length=500,
        null=True,
        description="平台Logo URL"
    )
    platform_description = fields.TextField(
        null=True,
        description="平台描述"
    )
    
    # 平台联系信息
    platform_contact_email = fields.CharField(
        max_length=255,
        null=True,
        description="平台联系邮箱"
    )
    platform_contact_phone = fields.CharField(
        max_length=50,
        null=True,
        description="平台联系电话"
    )
    platform_website = fields.CharField(
        max_length=500,
        null=True,
        description="平台网站"
    )
    
    # 登录页配置
    login_title = fields.CharField(
        max_length=200,
        null=True,
        description="登录页标题"
    )
    login_content = fields.TextField(
        null=True,
        description="登录页内容描述"
    )
    icp_license = fields.CharField(
        max_length=100,
        null=True,
        description="ICP备案信息"
    )
    
    # 时间字段
    created_at = fields.DatetimeField(
        default=datetime.utcnow,
        description="创建时间"
    )
    updated_at = fields.DatetimeField(
        default=datetime.utcnow,
        description="更新时间"
    )
    
    def __str__(self):
        """字符串表示"""
        return f"PlatformSettings: {self.platform_name}"

