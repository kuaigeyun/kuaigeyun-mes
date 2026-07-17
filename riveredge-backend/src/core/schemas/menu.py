"""
菜单 Schema 模块

定义菜单相关的 Pydantic Schema，用于数据验证和序列化。
"""

from pydantic import BaseModel, Field, ConfigDict, field_validator, model_validator
from typing import Optional, List, Dict, Any, Literal
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

    @field_validator("meta", mode="before")
    @classmethod
    def normalize_meta_create(cls, v: Any) -> Any:
        if v is None or v == "":
            return None
        return v

    @field_validator("sort_order", mode="before")
    @classmethod
    def normalize_sort_order_create(cls, v: Any) -> Any:
        if v is None or v == "":
            return 0
        if isinstance(v, str):
            s = v.strip()
            if s == "":
                return 0
            try:
                return int(s)
            except ValueError:
                return 0
        if isinstance(v, float) and v.is_integer():
            return int(v)
        return v


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

    model_config = ConfigDict(extra="ignore")

    @field_validator("meta", mode="before")
    @classmethod
    def normalize_meta(cls, v: Any) -> Any:
        # 前端表单项清空时常见为 ""，直接当未传处理，避免 422（meta 须为 object 或 null）
        if v is None or v == "":
            return None
        return v

    @field_validator("sort_order", mode="before")
    @classmethod
    def normalize_sort_order(cls, v: Any) -> Any:
        if v is None or v == "":
            return None
        if isinstance(v, str):
            s = v.strip()
            if s == "":
                return None
            try:
                return int(s)
            except ValueError:
                return None
        if isinstance(v, float) and v.is_integer():
            return int(v)
        return v

    @field_validator("is_active", "is_external", mode="before")
    @classmethod
    def normalize_bool_fields(cls, v: Any) -> Any:
        if v is None or v == "":
            return None
        if isinstance(v, str):
            low = v.strip().lower()
            if low in ("true", "1", "yes", "on"):
                return True
            if low in ("false", "0", "no", "off"):
                return False
        return v


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


class TenantBackendHomeResponse(BaseModel):
    """当前租户配置的后台首页（未配置时各字段为 null，前端使用系统默认工作台）"""

    menu_uuid: Optional[str] = Field(None, description="菜单 UUID")
    path: Optional[str] = Field(None, description="菜单路由 path")
    name: Optional[str] = Field(None, description="菜单名称")


class EffectiveHomeResponse(BaseModel):
    """当前登录用户的 UniTabs 有效首页（按角色 > 菜单主页 > 工作台 > 兜底页解析）"""

    path: str = Field(..., description="有效首页路由")
    source: str = Field(
        ...,
        description="来源：role | menu | workplace | fallback",
    )
    role_uuid: Optional[str] = Field(None, description="命中角色首页时的角色 UUID")
    menu_uuid: Optional[str] = Field(None, description="命中菜单主页时的菜单 UUID")


class CustomMenuLayoutNode(BaseModel):
    """租户级自组菜单节点（展示映射层，不改 manifest / core_menus 真源）。"""

    id: str = Field(..., description="节点唯一 ID（布局内唯一）")
    type: Literal["app_group", "custom_group", "menu_ref"] = Field(..., description="节点类型")
    title: Optional[str] = Field(None, description="展示标题（分组必填，menu_ref 可覆盖原菜单标题）")
    icon: Optional[str] = Field(None, description="图标键（可覆盖）")
    menu_uuid: Optional[str] = Field(None, description="menu_ref 引用的菜单 UUID")
    menu_path: Optional[str] = Field(None, description="menu_ref 引用的菜单路径（冗余校验）")
    children: List["CustomMenuLayoutNode"] = Field(default_factory=list, description="子节点")

    @model_validator(mode="after")
    def validate_by_type(self) -> "CustomMenuLayoutNode":
        if self.type in ("app_group", "custom_group"):
            if not (self.title or "").strip():
                raise ValueError("分组节点 title 不能为空")
        if self.type == "menu_ref":
            if not (self.menu_uuid or "").strip():
                raise ValueError("menu_ref 节点必须提供 menu_uuid")
            if self.children:
                raise ValueError("menu_ref 节点不允许 children")
        return self


class CustomMenuLayoutUpdate(BaseModel):
    """更新租户级自组菜单布局。"""

    enabled: bool = Field(False, description="是否启用自组菜单")
    show_app_names: bool = Field(
        True,
        description="侧栏是否显示 APP 名称分组标题（默认菜单与自组菜单均生效）",
    )
    nodes: List[CustomMenuLayoutNode] = Field(default_factory=list, description="根节点列表")


class CustomMenuLayoutResponse(CustomMenuLayoutUpdate):
    """租户级自组菜单布局响应。"""

    version: int = Field(0, description="布局版本（每次保存递增）")


# 更新前向引用
MenuTreeResponse.model_rebuild()
CustomMenuLayoutNode.model_rebuild()

