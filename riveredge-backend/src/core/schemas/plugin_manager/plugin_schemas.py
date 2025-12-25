"""
插件管理器数据模型

定义插件相关的 Pydantic 数据验证模型。
"""

from typing import Dict, List, Any, Optional
from pydantic import BaseModel, Field


class PluginManifest(BaseModel):
    """插件清单"""
    name: str = Field(..., description="插件名称")
    code: str = Field(..., description="插件代码")
    version: str = Field(default="1.0.0", description="插件版本")
    description: str = Field(default="", description="插件描述")
    icon: str = Field(default="appstore", description="插件图标")
    author: str = Field(default="", description="插件作者")
    entry_point: str = Field(default="", description="前端入口点")
    route_path: str = Field(default="", description="路由路径")
    sort_order: int = Field(default=0, description="排序顺序")
    menu_config: Dict[str, Any] = Field(default_factory=dict, description="菜单配置")
    permissions: List[str] = Field(default_factory=list, description="权限列表")
    dependencies: Dict[str, str] = Field(default_factory=dict, description="依赖关系")


class PluginInfo(BaseModel):
    """插件信息"""
    code: str = Field(..., description="插件代码")
    name: str = Field(..., description="插件名称")
    version: str = Field(default="1.0.0", description="插件版本")
    description: str = Field(default="", description="插件描述")
    icon: str = Field(default="appstore", description="插件图标")
    author: str = Field(default="", description="插件作者")
    is_valid: bool = Field(default=True, description="是否有效")
    error_message: Optional[str] = Field(default=None, description="错误信息")
    is_registered: bool = Field(default=False, description="是否已注册")
    is_active: bool = Field(default=False, description="是否启用")
    is_installed: bool = Field(default=False, description="是否已安装")
    sort_order: int = Field(default=0, description="排序顺序")


class PluginDiscoveryResult(BaseModel):
    """插件发现结果"""
    success: bool = Field(..., description="是否成功")
    registered: int = Field(default=0, description="新注册的插件数量")
    updated: int = Field(default=0, description="更新的插件数量")
    total_discovered: int = Field(default=0, description="发现的插件总数")
    errors: List[str] = Field(default_factory=list, description="错误信息列表")


class PluginOperationResult(BaseModel):
    """插件操作结果"""
    success: bool = Field(..., description="是否成功")
    message: str = Field(..., description="操作结果消息")
