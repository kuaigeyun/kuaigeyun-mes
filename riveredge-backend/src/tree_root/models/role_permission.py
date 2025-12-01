"""
角色-权限关联模型模块

定义角色和权限的多对多关联关系。
"""

from tortoise import fields
from tortoise.models import Model


class RolePermission(Model):
    """
    角色-权限关联模型
    
    用于关联角色和权限，实现多对多关系。
    一个角色可以关联多个权限，一个权限可以关联多个角色。
    
    Attributes:
        id: 关联ID（主键）
        role_id: 角色ID（外键，关联 sys_roles）
        permission_id: 权限ID（外键，关联 sys_permissions）
        created_at: 创建时间
    """
    
    id = fields.IntField(pk=True, description="关联ID（主键）")
    role_id = fields.IntField(description="角色ID（外键，关联 sys_roles）")
    permission_id = fields.IntField(description="权限ID（外键，关联 sys_permissions）")
    created_at = fields.DatetimeField(auto_now_add=True, description="创建时间")
    
    class Meta:
        """
        模型元数据
        """
        table = "sys_role_permissions"
        unique_together = [("role_id", "permission_id")]
        indexes = [
            ("role_id",),
            ("permission_id",),
        ]
    
    def __str__(self):
        """字符串表示"""
        return f"RolePermission(role_id={self.role_id}, permission_id={self.permission_id})"

