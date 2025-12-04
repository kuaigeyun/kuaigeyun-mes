"""
应用模型模块

定义应用数据模型，用于应用中心管理。
"""

from tortoise import fields
from typing import Dict, Any
from .base import BaseModel


class Application(BaseModel):
    """
    应用模型
    
    用于管理插件式应用，支持动态加载和卸载。
    支持多组织隔离，每个组织可以安装自己的应用。
    
    注意：继承自 BaseModel，自动包含 uuid、tenant_id、created_at、updated_at 字段。
    
    Attributes:
        id: 应用ID（主键，自增ID，内部使用）
        uuid: 业务ID（UUID，对外暴露，安全且唯一）
        tenant_id: 组织ID（用于多组织数据隔离）
        name: 应用名称
        code: 应用代码（唯一，用于程序识别）
        description: 应用描述
        icon: 应用图标（URL 或路径）
        version: 应用版本
        route_path: 应用路由路径
        entry_point: 应用入口点（前端组件路径或 URL）
        menu_config: 菜单配置（JSON）
        permission_code: 权限代码（关联权限）
        is_system: 是否系统应用
        is_active: 是否启用
        is_installed: 是否已安装
        sort_order: 排序顺序
        created_at: 创建时间
        updated_at: 更新时间
    """
    
    id = fields.IntField(pk=True, description="应用ID（主键，自增ID，内部使用）")
    # uuid 字段由 BaseModel 提供，无需重复定义
    # tenant_id 字段由 BaseModel 提供，无需重复定义
    
    name = fields.CharField(max_length=100, description="应用名称")
    code = fields.CharField(max_length=50, description="应用代码（唯一，用于程序识别）")
    description = fields.TextField(null=True, description="应用描述")
    icon = fields.CharField(max_length=200, null=True, description="应用图标")
    version = fields.CharField(max_length=20, null=True, description="应用版本")
    
    route_path = fields.CharField(max_length=200, null=True, description="应用路由路径")
    entry_point = fields.CharField(max_length=500, null=True, description="应用入口点")
    menu_config = fields.JSONField(null=True, description="菜单配置（JSON）")
    
    permission_code = fields.CharField(max_length=100, null=True, description="权限代码")
    
    is_system = fields.BooleanField(default=False, description="是否系统应用")
    is_active = fields.BooleanField(default=True, description="是否启用")
    is_installed = fields.BooleanField(default=False, description="是否已安装")
    
    sort_order = fields.IntField(default=0, description="排序顺序")
    
    # 软删除字段
    deleted_at = fields.DatetimeField(null=True, description="删除时间（软删除）")
    
    class Meta:
        """
        模型元数据
        """
        table = "core_applications"
        unique_together = [("tenant_id", "code")]
        indexes = [
            ("tenant_id",),
            ("code",),
            ("uuid",),
            ("created_at",),
        ]
    
    def get_menu_config(self) -> Dict[str, Any]:
        """
        获取菜单配置
        
        Returns:
            Dict[str, Any]: 菜单配置字典
        """
        return self.menu_config or {}
    
    def set_menu_config(self, config: Dict[str, Any]) -> None:
        """
        设置菜单配置
        
        Args:
            config: 菜单配置字典
        """
        self.menu_config = config
    
    def __str__(self):
        """字符串表示"""
        return f"{self.name} ({self.code})"

