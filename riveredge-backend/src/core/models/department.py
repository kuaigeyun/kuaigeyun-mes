"""
部门模型模块

定义部门数据模型，支持树形结构（自关联）。
"""

from tortoise import fields
from .base import BaseModel


class Department(BaseModel):
    """
    部门模型
    
    用于定义组织中的部门，支持树形结构（父子部门关系）。
    每个部门可以有一个父部门，形成树形结构。
    
    注意：继承自 BaseModel，自动包含 uuid、tenant_id、created_at、updated_at 字段。
    
    Attributes:
        id: 部门ID（主键，自增ID，内部使用）
        uuid: 业务ID（UUID，对外暴露，安全且唯一）
        tenant_id: 组织ID（用于多组织数据隔离）
        name: 部门名称
        code: 部门代码（可选，用于程序识别）
        description: 部门描述
        manager_id: 部门负责人ID（外键，关联 core_users，可选）
        parent_id: 父部门ID（自关联，NULL 表示根部门）
        sort_order: 排序顺序（同级部门排序）
        is_active: 是否启用
        created_at: 创建时间
        updated_at: 更新时间
    """
    
    id = fields.IntField(pk=True, description="部门ID（主键，自增ID，内部使用）")
    # uuid 字段由 BaseModel 提供，无需重复定义
    # tenant_id 字段由 BaseModel 提供，无需重复定义
    
    name = fields.CharField(max_length=100, description="部门名称")
    code = fields.CharField(max_length=50, null=True, description="部门代码（可选，用于程序识别）")
    description = fields.TextField(null=True, description="部门描述")
    manager_id = fields.IntField(null=True, description="部门负责人ID（外键，关联 core_users，内部使用自增ID）")

    # 树形结构：自关联外键
    parent = fields.ForeignKeyField(
        "models.Department",
        related_name="children",
        null=True,
        description="父部门（外键关系，用于树形结构）"
    )
    
    # 排序和状态
    sort_order = fields.IntField(default=0, description="排序顺序（同级部门排序）")
    is_active = fields.BooleanField(default=True, description="是否启用")

    # 软删除字段
    deleted_at = fields.DatetimeField(null=True, description="删除时间（软删除）")
    
    class Meta:
        """
        模型元数据
        """
        table = "core_departments"
        indexes = [
            ("tenant_id",),
            ("parent_id",),
            ("manager_id",),
            ("sort_order",),
            ("created_at",),
        ]
    
    def __str__(self):
        """字符串表示"""
        return f"{self.name} ({self.code or 'N/A'})"

