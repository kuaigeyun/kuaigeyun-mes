"""
权限模型模块

定义权限数据模型，用于基于角色的访问控制（RBAC）
"""

from typing import Optional

from tortoise import fields

from models.base import BaseModel


class Permission(BaseModel):
    """
    权限模型
    
    用于管理 SaaS 多租户系统中的权限信息。
    所有权限必须属于某个租户（tenant_id），实现多租户数据隔离。
    同一租户内权限代码必须唯一。
    
    Attributes:
        id: 权限 ID（主键）
        tenant_id: 租户 ID（外键，关联到 core_tenants 表）
        name: 权限名称（租户内唯一）
        code: 权限代码（租户内唯一，用于程序识别，格式：resource:action）
        description: 权限描述（可选）
        resource: 资源名称（如：user, role, tenant）
        action: 操作类型（如：create, read, update, delete）
        is_system: 是否为系统权限（系统权限不可删除）
        created_at: 创建时间
        updated_at: 更新时间
    """

    id = fields.IntField(primary_key=True, description="权限 ID（主键）")
    tenant_id = fields.IntField(description="租户 ID（外键，关联到 core_tenants 表）")
    name = fields.CharField(max_length=50, description="权限名称（租户内唯一）")
    code = fields.CharField(max_length=100, description="权限代码（租户内唯一，格式：resource:action）")
    description = fields.TextField(null=True, description="权限描述（可选）")
    resource = fields.CharField(max_length=50, description="资源名称（如：user, role, tenant）")
    action = fields.CharField(max_length=50, description="操作类型（如：create, read, update, delete）")
    is_system = fields.BooleanField(default=False, description="是否为系统权限（系统权限不可删除）")
    
    class Meta:
        """
        模型元数据
        """
        table = "core_permissions"  # 表名必须包含模块前缀（core_）
        indexes = [
            ("tenant_id",),           # 租户 ID 索引
            ("name",),                # 权限名称索引
            ("code",),                # 权限代码索引
            ("resource",),            # 资源名称索引
            ("action",),              # 操作类型索引
            ("tenant_id", "code"),     # 租户 ID + 权限代码联合索引（租户内权限代码唯一）
        ]
        unique_together = [("tenant_id", "code")]  # 同一租户下权限代码唯一
    
    def __str__(self) -> str:
        """
        返回权限的字符串表示
        
        Returns:
            str: 权限字符串表示
        """
        return f"<Permission(id={self.id}, code={self.code}, tenant_id={self.tenant_id})>"

