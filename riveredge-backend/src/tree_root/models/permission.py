"""
权限模型模块

定义权限数据模型，用于角色权限管理系统。
"""

from tortoise import fields
from .base import BaseModel


class PermissionType:
    """权限类型常量"""
    FUNCTION = "function"  # 功能权限
    DATA = "data"         # 数据权限
    FIELD = "field"       # 字段权限


class Permission(BaseModel):
    """
    权限模型
    
    用于定义系统中的权限，每个权限代表一个具体的操作。
    权限代码格式：资源:操作（如 user:create、role:read）
    
    注意：继承自 BaseModel，自动包含 uuid、tenant_id、created_at、updated_at 字段。
    
    Attributes:
        id: 权限ID（主键，自增ID，内部使用）
        uuid: 业务ID（UUID，对外暴露，安全且唯一）
        tenant_id: 组织ID（用于多组织数据隔离）
        name: 权限名称
        code: 权限代码（唯一，格式：资源:操作）
        resource: 资源（模块，如 user、role）
        action: 操作（如 create、read、update、delete）
        description: 权限描述
        permission_type: 权限类型（function、data、field）
        created_at: 创建时间
        updated_at: 更新时间
    """
    
    id = fields.IntField(pk=True, description="权限ID（主键，自增ID，内部使用）")
    # uuid 字段由 BaseModel 提供，无需重复定义
    # tenant_id 字段由 BaseModel 提供，无需重复定义
    
    name = fields.CharField(max_length=100, description="权限名称")
    code = fields.CharField(max_length=100, description="权限代码（唯一，格式：资源:操作）")
    resource = fields.CharField(max_length=50, description="资源（模块，如 user、role）")
    action = fields.CharField(max_length=50, description="操作（如 create、read、update、delete）")
    description = fields.TextField(null=True, description="权限描述")
    permission_type = fields.CharField(
        max_length=20,
        default=PermissionType.FUNCTION,
        description="权限类型：function（功能权限）、data（数据权限）、field（字段权限）"
    )

    # 软删除字段
    deleted_at = fields.DatetimeField(null=True, description="删除时间（软删除）")
    
    class Meta:
        """
        模型元数据
        """
        table = "sys_permissions"
        unique_together = [("tenant_id", "code")]
        indexes = [
            ("tenant_id",),
            ("code",),
            ("resource",),
            ("permission_type",),
        ]
    
    def __str__(self):
        """字符串表示"""
        return f"{self.name} ({self.code})"

