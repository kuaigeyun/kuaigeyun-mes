"""
应用管理 Schema 模块

定义应用管理相关的 Pydantic Schema，用于 API 请求和响应验证。
"""

from datetime import datetime
from typing import Dict, Any, Optional
from pydantic import BaseModel, Field, ConfigDict


class ApplicationBase(BaseModel):
    """
    应用基础 Schema
    
    包含应用的基本字段，用于创建和更新操作。
    """
    name: str = Field(..., min_length=1, max_length=100, description="应用名称")
    code: str = Field(..., min_length=1, max_length=50, description="应用代码（唯一，用于程序识别）")
    description: Optional[str] = Field(None, description="应用描述")
    icon: Optional[str] = Field(None, max_length=200, description="应用图标")
    version: Optional[str] = Field(None, max_length=20, description="应用版本")
    route_path: Optional[str] = Field(None, max_length=200, description="应用路由路径")
    entry_point: Optional[str] = Field(None, max_length=500, description="应用入口点")
    menu_config: Optional[Dict[str, Any]] = Field(None, description="菜单配置（JSON）")
    permission_code: Optional[str] = Field(None, max_length=100, description="权限代码")
    is_system: bool = Field(default=False, description="是否系统应用")
    is_active: bool = Field(default=True, description="是否启用")
    is_custom_name: bool = Field(default=False, description="是否自定义名称")
    is_custom_sort: bool = Field(default=False, description="是否自定义排序")
    sort_order: int = Field(default=0, description="排序顺序")


class ApplicationCreate(ApplicationBase):
    """
    应用创建 Schema
    
    用于创建新应用的请求数据。
    """
    pass


class ApplicationUpdate(BaseModel):
    """
    应用更新 Schema
    
    用于更新应用的请求数据，所有字段可选。
    """
    name: Optional[str] = Field(None, min_length=1, max_length=100, description="应用名称")
    description: Optional[str] = Field(None, description="应用描述")
    icon: Optional[str] = Field(None, max_length=200, description="应用图标")
    version: Optional[str] = Field(None, max_length=20, description="应用版本")
    route_path: Optional[str] = Field(None, max_length=200, description="应用路由路径")
    entry_point: Optional[str] = Field(None, max_length=500, description="应用入口点")
    menu_config: Optional[Dict[str, Any]] = Field(None, description="菜单配置（JSON）")
    permission_code: Optional[str] = Field(None, max_length=100, description="权限代码")
    is_active: Optional[bool] = Field(None, description="是否启用")
    is_custom_name: Optional[bool] = Field(None, description="是否自定义名称")
    is_custom_sort: Optional[bool] = Field(None, description="是否自定义排序")
    sort_order: Optional[int] = Field(None, description="排序顺序")


class ApplicationResponse(ApplicationBase):
    """
    应用响应 Schema
    
    用于返回应用信息。
    """
    uuid: str = Field(..., description="应用UUID（对外暴露，业务标识）")
    tenant_id: int = Field(..., description="组织ID")
    is_installed: bool = Field(..., description="是否已安装")
    created_at: datetime = Field(..., description="创建时间")
    updated_at: datetime = Field(..., description="更新时间")
    
    model_config = ConfigDict(from_attributes=True)

