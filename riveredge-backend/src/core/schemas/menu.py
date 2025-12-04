"""
菜单 Schema 模块

定义菜单相关的 Pydantic Schema，用于数据验证和序列化。
"""

from pydantic import BaseModel, Field, ConfigDict
from typing import Optional, List, Dict, Any
from datetime import datetime
from uuid import UUID


class MenuBase(BaseModel):
    """菜单基础 Schema"""
    name: str = Field(..., description="菜单名称")
    path: Optional[str] = Field(None, description="菜单路径（路由路径）")
    icon: Optional[str] = Field(None, description="菜单图标（Ant Design 图标名称或 URL）")
    component: Optional[str] = Field(None, description="前端组件路径（可选）")
    permission_code: Optional[str] = Field(None, description="权限代码（关联权限，可选）")
    application_uuid: Optional[str] = Field(None, description="关联应用UUID（关联应用中心，可选）")
    parent_uuid: Optional[str] = Field(None, description="父菜单UUID（用于树形结构）")
    sort_order: int = Field(0, description="排序顺序（同级菜单排序）")
    is_active: bool = Field(True, description="是否启用")
    is_external: bool = Field(False, description="是否外部链接")
    external_url: Optional[str] = Field(None, description="外部链接URL（如果 is_external 为 true）")
    meta: Optional[Dict[str, Any]] = Field(None, description="菜单元数据（JSON格式）")


class MenuCreate(MenuBase):
    """创建菜单 Schema"""
    pass


class MenuUpdate(BaseModel):
    """更新菜单 Schema"""
    name: Optional[str] = Field(None, description="菜单名称")
    path: Optional[str] = Field(None, description="菜单路径（路由路径）")
    icon: Optional[str] = Field(None, description="菜单图标")
    component: Optional[str] = Field(None, description="前端组件路径")
    permission_code: Optional[str] = Field(None, description="权限代码")
    application_uuid: Optional[str] = Field(None, description="关联应用UUID")
    parent_uuid: Optional[str] = Field(None, description="父菜单UUID")
    sort_order: Optional[int] = Field(None, description="排序顺序")
    is_active: Optional[bool] = Field(None, description="是否启用")
    is_external: Optional[bool] = Field(None, description="是否外部链接")
    external_url: Optional[str] = Field(None, description="外部链接URL")
    meta: Optional[Dict[str, Any]] = Field(None, description="菜单元数据")


class MenuResponse(MenuBase):
    """菜单响应 Schema"""
    uuid: UUID = Field(..., description="菜单UUID")
    tenant_id: int = Field(..., description="组织ID")
    parent_uuid: Optional[UUID] = Field(None, description="父菜单UUID")
    created_at: datetime = Field(..., description="创建时间")
    updated_at: datetime = Field(..., description="更新时间")
    
    model_config = ConfigDict(from_attributes=True)


class MenuTreeResponse(MenuResponse):
    """菜单树响应 Schema（包含子菜单）"""
    children: List['MenuTreeResponse'] = Field(default_factory=list, description="子菜单列表")
    
    model_config = ConfigDict(from_attributes=True)


class MenuListResponse(BaseModel):
    """菜单列表响应 Schema"""
    items: List[MenuResponse] = Field(..., description="菜单列表")
    total: int = Field(..., description="总数量")
    page: int = Field(..., description="当前页码")
    page_size: int = Field(..., description="每页数量")


# 更新前向引用
MenuTreeResponse.model_rebuild()

