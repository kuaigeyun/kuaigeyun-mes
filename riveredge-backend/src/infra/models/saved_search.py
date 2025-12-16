"""
保存搜索条件模型模块

定义保存搜索条件数据模型，用于存储用户保存的搜索条件
"""

from tortoise import fields

from infra.models.base import BaseModel


class SavedSearch(BaseModel):
    """
    保存搜索条件模型

    用于存储用户保存的搜索条件，支持个人和共享搜索条件。

    Attributes:
        id: 搜索条件 ID（主键）
        tenant_id: 组织 ID（可选，用于多组织数据隔离）
        user_id: 用户 ID（必填，搜索条件的创建者）
        page_path: 页面路径（用于区分不同页面的搜索条件）
        name: 搜索条件名称
        is_shared: 是否共享（共享给其他用户）
        is_pinned: 是否置顶
        search_params: 搜索参数（JSON 存储）
        created_at: 创建时间
        updated_at: 更新时间
    """

    id = fields.IntField(pk=True, description="搜索条件 ID（主键）")
    tenant_id = fields.IntField(null=True, db_index=True, description="组织 ID（用于多组织数据隔离）")
    user_id = fields.IntField(description="用户 ID（搜索条件的创建者）")
    page_path = fields.CharField(max_length=255, description="页面路径")
    name = fields.CharField(max_length=100, description="搜索条件名称")
    is_shared = fields.BooleanField(default=False, description="是否共享给其他用户")
    is_pinned = fields.BooleanField(default=False, description="是否置顶")
    search_params = fields.JSONField(default=dict, description="搜索参数（JSON 存储）")

    class Meta:
        """
        模型元数据
        """
        table = "core_saved_searches"  # 表名必须包含模块前缀（core_ - 系统级后端，兼容历史数据）
        indexes = [
            ("user_id",),           # 用户 ID 索引
            ("page_path",),         # 页面路径索引
            ("tenant_id", "user_id", "page_path"),  # 组织 ID + 用户 ID + 页面路径联合索引
            ("is_pinned",),         # 置顶索引
            ("is_shared",),         # 共享索引
        ]

    def __str__(self) -> str:
        """
        返回搜索条件的字符串表示

        Returns:
            str: 搜索条件字符串表示
        """
        return f"<SavedSearch(id={self.id}, user_id={self.user_id}, name={self.name}, page_path={self.page_path})>"

