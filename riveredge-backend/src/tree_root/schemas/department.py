"""
部门 Schema 模块

定义部门相关的 Pydantic Schema，用于 API 请求和响应验证。
"""

from datetime import datetime
from typing import Optional, List

from pydantic import BaseModel, Field, ConfigDict


class DepartmentBase(BaseModel):
    """
    部门基础 Schema
    
    包含部门的基本字段，用于创建和更新操作。
    """
    name: str = Field(..., min_length=1, max_length=100, description="部门名称")
    code: Optional[str] = Field(None, max_length=50, description="部门代码（可选，用于程序识别）")
    description: Optional[str] = Field(None, description="部门描述")
    sort_order: int = Field(default=0, description="排序顺序（同级部门排序）")
    is_active: bool = Field(default=True, description="是否启用")


class DepartmentCreate(DepartmentBase):
    """
    部门创建 Schema
    
    用于创建新部门的请求数据。
    
    Attributes:
        name: 部门名称（必填，1-100 字符）
        code: 部门代码（可选，用于程序识别）
        description: 部门描述（可选）
        parent_uuid: 父部门UUID（可选，NULL 表示根部门）
        manager_uuid: 部门负责人UUID（可选）
        sort_order: 排序顺序（默认 0）
        is_active: 是否启用（默认 True）
    """
    parent_uuid: Optional[str] = Field(None, description="父部门UUID（可选，NULL 表示根部门）")
    manager_uuid: Optional[str] = Field(None, description="部门负责人UUID（可选）")


class DepartmentUpdate(BaseModel):
    """
    部门更新 Schema
    
    用于更新部门的请求数据，所有字段可选。
    
    Attributes:
        name: 部门名称（可选，1-100 字符）
        code: 部门代码（可选）
        description: 部门描述（可选）
        parent_uuid: 父部门UUID（可选，使用UUID而不是ID）
        manager_uuid: 部门负责人UUID（可选）
        sort_order: 排序顺序（可选）
        is_active: 是否启用（可选）
    """
    name: Optional[str] = Field(None, min_length=1, max_length=100, description="部门名称")
    code: Optional[str] = Field(None, max_length=50, description="部门代码（可选，用于程序识别）")
    description: Optional[str] = Field(None, description="部门描述")
    parent_uuid: Optional[str] = Field(None, description="父部门UUID（可选，使用UUID而不是ID）")
    manager_uuid: Optional[str] = Field(None, description="部门负责人UUID（可选）")
    sort_order: Optional[int] = Field(None, description="排序顺序（同级部门排序）")
    is_active: Optional[bool] = Field(None, description="是否启用")


class DepartmentInfo(BaseModel):
    """
    部门信息 Schema

    用于在树形结构中返回部门信息。

    **注意**: 遵循自增ID+UUID混合方案，只对外暴露UUID。
    内部关联字段（parent_id, manager_id）在树形结构中仍保留用于前端处理。
    """
    uuid: str = Field(..., description="部门UUID（对外暴露，业务标识）")
    name: str = Field(..., description="部门名称")
    code: Optional[str] = Field(None, description="部门代码")
    description: Optional[str] = Field(None, description="部门描述")
    parent_uuid: Optional[str] = Field(None, description="父部门UUID（用于树形结构）")
    manager_uuid: Optional[str] = Field(None, description="部门负责人UUID（用于显示）")
    sort_order: int = Field(..., description="排序顺序")
    is_active: bool = Field(..., description="是否启用")
    children_count: int = Field(..., description="子部门数量")
    user_count: int = Field(..., description="用户数量")

    model_config = ConfigDict(from_attributes=True)


class DepartmentResponse(DepartmentInfo):
    """
    部门响应 Schema
    
    用于返回部门详细信息。
    
    Attributes:
        tenant_id: 组织ID
        created_at: 创建时间
        updated_at: 更新时间
    """
    tenant_id: int = Field(..., description="组织ID")
    created_at: datetime = Field(..., description="创建时间")
    updated_at: datetime = Field(..., description="更新时间")
    
    model_config = ConfigDict(from_attributes=True)


class DepartmentTreeItem(DepartmentInfo):
    """
    部门树形项 Schema
    
    用于树形结构响应，包含子部门列表。
    """
    children: List["DepartmentTreeItem"] = Field(default_factory=list, description="子部门列表")


class DepartmentTreeResponse(BaseModel):
    """
    部门树形响应 Schema
    
    用于返回部门树形结构。
    """
    items: List[DepartmentTreeItem] = Field(..., description="部门树形列表")


# 解决前向引用
DepartmentTreeItem.model_rebuild()

