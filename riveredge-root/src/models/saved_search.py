"""
保存搜索条件模型模块

定义保存搜索条件的数据模型，支持个人和共享搜索条件
"""

from typing import Optional
from datetime import datetime

from tortoise import fields

from models.base import BaseModel


class SavedSearch(BaseModel):
    """
    保存搜索条件模型
    
    用于保存用户的搜索条件，支持个人和共享两种类型。
    个人搜索条件仅供创建者使用，共享搜索条件租户内所有用户可见。
    
    Attributes:
        id: 搜索条件 ID（主键）
        tenant_id: 组织 ID（外键，关联到 tree_tenants 表）
        user_id: 创建者用户 ID（外键，关联到 root_users 表）
        page_path: 页面路径（用于区分不同页面的搜索条件）
        name: 搜索条件名称
        is_shared: 是否共享（True：共享，False：个人）
        search_params: 搜索参数（JSON 格式）
        created_at: 创建时间
        updated_at: 更新时间
    """

    id = fields.IntField(pk=True, description="搜索条件 ID（主键）")
    tenant_id = fields.IntField(null=True, description="组织 ID（外键，关联到 tree_tenants 表）")
    user_id = fields.IntField(description="创建者用户 ID（外键，关联到 root_users 表）")
    page_path = fields.CharField(max_length=255, description="页面路径（用于区分不同页面的搜索条件）")
    name = fields.CharField(max_length=100, description="搜索条件名称")
    is_shared = fields.BooleanField(default=False, description="是否共享（True：共享，False：个人）")
    is_pinned = fields.BooleanField(default=False, description="是否钉住（True：钉住，显示在高级搜索按钮后面）")
    search_params = fields.JSONField(description="搜索参数（JSON 格式）")
    
    class Meta:
        """
        模型元数据
        """
        table = "root_saved_searches"
        table_description = "保存搜索条件表"
        
        # 索引
        indexes = [
            ("tenant_id", "user_id", "page_path"),  # 复合索引：组织 + 用户 + 页面路径
            ("tenant_id", "page_path", "is_shared"),  # 复合索引：组织 + 页面路径 + 共享状态
        ]
        
        # 唯一约束：同一用户在同一页面不能有重名的搜索条件
        unique_together = [("user_id", "page_path", "name")]

