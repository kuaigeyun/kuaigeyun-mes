"""
菜单模型模块

定义菜单数据模型，支持树形结构（自关联）。
"""

from tortoise import fields
from typing import Optional, Dict, Any
from .base import BaseModel


class Menu(BaseModel):
    """
    菜单模型
    
    用于定义系统中的菜单项，支持树形结构（父子菜单关系）。
    每个菜单可以有一个父菜单，形成树形结构。
    菜单可以关联应用、权限等。
    
    注意：继承自 BaseModel，自动包含 uuid、tenant_id、created_at、updated_at 字段。
    
    Attributes:
        id: 菜单ID（主键，自增ID，内部使用）
        uuid: 业务ID（UUID，对外暴露，安全且唯一）
        tenant_id: 组织ID（用于多组织数据隔离）
        name: 菜单名称
        path: 菜单路径（路由路径）
        icon: 菜单图标（Ant Design 图标名称或 URL）
        component: 前端组件路径（可选）
        permission_code: 权限代码（关联权限，可选）
        application_uuid: 关联应用UUID（关联应用中心，可选）
        parent_id: 父菜单ID（自关联，NULL 表示根菜单）
        sort_order: 排序顺序（同级菜单排序）
        is_active: 是否启用
        is_external: 是否外部链接
        external_url: 外部链接URL（如果 is_external 为 true）
        meta: 菜单元数据（JSON格式，存储额外配置）
        created_at: 创建时间
        updated_at: 更新时间
    """
    
    id = fields.IntField(pk=True, description="菜单ID（主键，自增ID，内部使用）")
    # uuid 字段由 BaseModel 提供
    # tenant_id 字段由 BaseModel 提供
    
    name = fields.CharField(max_length=100, description="菜单名称")
    path = fields.CharField(max_length=200, null=True, description="菜单路径（路由路径）")
    icon = fields.CharField(max_length=100, null=True, description="菜单图标（Ant Design 图标名称或 URL）")
    component = fields.CharField(max_length=500, null=True, description="前端组件路径（可选）")
    
    permission_code = fields.CharField(max_length=100, null=True, description="权限代码（关联权限，可选）")
    application_uuid = fields.CharField(max_length=36, null=True, description="关联应用UUID（关联应用中心，可选）")
    
    # 树形结构：自关联外键
    parent = fields.ForeignKeyField(
        "models.Menu",
        related_name="children",
        null=True,
        description="父菜单（外键关系，用于树形结构）"
    )
    
    # 排序和状态
    sort_order = fields.IntField(default=0, description="排序顺序（同级菜单排序）")
    is_active = fields.BooleanField(default=True, description="是否启用")
    is_external = fields.BooleanField(default=False, description="是否外部链接")
    external_url = fields.CharField(max_length=500, null=True, description="外部链接URL（如果 is_external 为 true）")
    
    # 菜单元数据（JSON格式，存储额外配置）
    meta = fields.JSONField(null=True, description="菜单元数据（JSON格式）")
    
    # 软删除字段
    deleted_at = fields.DatetimeField(null=True, description="删除时间（软删除）")
    
    class Meta:
        """
        模型元数据
        """
        table = "core_menus"
        indexes = [
            ("tenant_id",),
            ("parent_id",),
            ("application_uuid",),
            ("permission_code",),
            ("sort_order",),
            ("is_active",),
            ("created_at",),
            # 复合索引：优化常用组合查询
            ("tenant_id", "is_active"),  # 按组织+启用状态查询
            ("tenant_id", "application_uuid", "is_active"),  # 按组织+应用+启用状态查询
            ("tenant_id", "parent_id", "is_active"),  # 按组织+父菜单+启用状态查询（树形结构查询）
        ]
    
    def get_meta(self) -> Dict[str, Any]:
        """
        获取菜单元数据
        
        Returns:
            Dict[str, Any]: 菜单元数据字典
        """
        return self.meta or {}
    
    def set_meta(self, meta: Dict[str, Any]) -> None:
        """
        设置菜单元数据
        
        Args:
            meta: 菜单元数据字典
        """
        self.meta = meta
    
    def __str__(self):
        """字符串表示"""
        return f"{self.name} ({self.path or 'N/A'})"

