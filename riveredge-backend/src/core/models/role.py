"""
角色模型模块

定义角色数据模型，用于角色权限管理系统。
"""

from tortoise import fields
from .base import BaseModel


class Role(BaseModel):
    """
    角色模型
    
    用于定义系统中的角色，每个角色可以关联多个权限。
    支持多组织隔离，每个组织可以定义自己的角色。
    
    注意：继承自 BaseModel，自动包含 uuid、tenant_id、created_at、updated_at 字段。
    
    Attributes:
        id: 角色ID（主键，自增ID，内部使用）
        uuid: 业务ID（UUID，对外暴露，安全且唯一）
        tenant_id: 组织ID（用于多组织数据隔离）
        name: 角色名称
        code: 角色代码（唯一，用于程序识别）
        description: 角色描述
        is_system: 是否系统角色（系统角色不可删除）
        is_active: 是否启用
        created_at: 创建时间
        updated_at: 更新时间
    """
    
    id = fields.IntField(pk=True, description="角色ID（主键，自增ID，内部使用）")
    # uuid 字段由 BaseModel 提供，无需重复定义
    # tenant_id 字段由 BaseModel 提供，无需重复定义
    
    name = fields.CharField(max_length=100, description="角色名称")
    code = fields.CharField(max_length=50, description="角色代码（唯一，用于程序识别）")
    description = fields.TextField(null=True, description="角色描述")
    is_system = fields.BooleanField(default=False, description="是否系统角色（系统角色不可删除）")
    is_active = fields.BooleanField(default=True, description="是否启用")

    # 软删除字段
    deleted_at = fields.DatetimeField(null=True, description="删除时间（软删除）")
    
    # 多对多关系：角色-权限关联（通过 core_role_permissions 表）
    # 注意：由于 Tortoise ORM 对 through 关系的支持有限，我们直接使用 RolePermission 模型进行查询
    # 这里暂时注释掉关系定义，避免 Tortoise ORM 解析错误
    # 实际查询时使用 RolePermission 模型直接查询关联表
    # permissions = fields.ManyToManyField(
    #     "models.Permission",
    #     related_name="roles",
    #     through="models.RolePermission",
    #     description="角色关联的权限"
    # )
    
    class Meta:
        """
        模型元数据
        """
        table = "core_roles"
        unique_together = [("tenant_id", "code")]
        indexes = [
            ("tenant_id",),
            ("code",),
            ("created_at",),
        ]
    
    def __str__(self):
        """字符串表示"""
        return f"{self.name} ({self.code})"

