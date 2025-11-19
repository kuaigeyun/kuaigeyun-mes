"""
角色模型模块

定义角色数据模型，用于基于角色的访问控制（RBAC）
"""

from typing import Optional

from tortoise import fields

from models.base import BaseModel


class Role(BaseModel):
    """
    角色模型
    
    用于管理 SaaS 多租户系统中的角色信息。
    所有角色必须属于某个租户（tenant_id），实现多租户数据隔离。
    同一租户内角色名称必须唯一。
    
    Attributes:
        id: 角色 ID（主键）
        tenant_id: 租户 ID（外键，关联到 core_tenants 表）
        name: 角色名称（租户内唯一）
        code: 角色代码（租户内唯一，用于程序识别）
        description: 角色描述（可选）
        is_system: 是否为系统角色（系统角色不可删除）
        created_at: 创建时间
        updated_at: 更新时间
    """

    id = fields.IntField(primary_key=True, description="角色 ID（主键）")
    tenant_id = fields.IntField(description="租户 ID（外键，关联到 core_tenants 表）")
    name = fields.CharField(max_length=50, description="角色名称（租户内唯一）")
    code = fields.CharField(max_length=50, description="角色代码（租户内唯一，用于程序识别）")
    description = fields.TextField(null=True, description="角色描述（可选）")
    is_system = fields.BooleanField(default=False, description="是否为系统角色（系统角色不可删除）")
    
    # 多对多关系：角色-权限
    permissions = fields.ManyToManyField(
        "models.Permission",
        related_name="roles",
        description="角色权限（多对多关系）"
    )
    
    class Meta:
        """
        模型元数据
        """
        table = "core_roles"  # 表名必须包含模块前缀（core_）
        indexes = [
            ("tenant_id",),           # 租户 ID 索引
            ("name",),                # 角色名称索引
            ("code",),                # 角色代码索引
            ("tenant_id", "name"),     # 租户 ID + 角色名称联合索引（租户内角色名称唯一）
            ("tenant_id", "code"),     # 租户 ID + 角色代码联合索引（租户内角色代码唯一）
        ]
        unique_together = [
            ("tenant_id", "name"),  # 同一租户下角色名称唯一
            ("tenant_id", "code"),  # 同一租户下角色代码唯一
        ]
    
    def __str__(self) -> str:
        """
        返回角色的字符串表示
        
        Returns:
            str: 角色字符串表示
        """
        return f"<Role(id={self.id}, name={self.name}, tenant_id={self.tenant_id})>"

