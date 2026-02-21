"""
用户-角色关联模型模块

定义用户和角色的多对多关联关系。
"""

from tortoise import fields
from tortoise.models import Model


class UserRole(Model):
    """
    用户-角色关联模型
    
    用于关联用户和角色，实现多对多关系。
    一个用户可以关联多个角色，一个角色可以关联多个用户。
    
    Attributes:
        id: 关联ID（主键）
        user_id: 用户ID（外键，关联 core_users）
        role_id: 角色ID（外键，关联 core_roles）
        created_at: 创建时间
    """
    
    id = fields.IntField(pk=True, description="关联ID（主键）")
    user = fields.ForeignKeyField(
        "models.User",
        related_name="user_roles",
        on_delete=fields.CASCADE,
        description="用户（外键，关联 core_users）",
    )
    role = fields.ForeignKeyField(
        "models.Role",
        related_name="user_roles",
        on_delete=fields.CASCADE,
        description="角色（外键，关联 core_roles）",
    )
    created_at = fields.DatetimeField(auto_now_add=True, description="创建时间")
    
    class Meta:
        """
        模型元数据
        """
        table = "core_user_roles"
        app = "models"
        default_connection = "default"
        unique_together = [("user_id", "role_id")]
        indexes = [
            ("user_id",),
            ("role_id",),
        ]
    
    def __str__(self):
        """字符串表示"""
        return f"UserRole(user_id={self.user_id}, role_id={self.role_id})"
