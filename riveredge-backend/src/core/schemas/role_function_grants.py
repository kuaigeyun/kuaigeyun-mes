"""角色功能权限矩阵（配置页专用）。"""

from __future__ import annotations

from typing import List, Optional

from pydantic import BaseModel, Field


class FunctionGrantActionSchema(BaseModel):
    action: str = Field(..., description="标准动作")
    code: str = Field(..., description="权限 code（规范化，主项）")
    label: str = Field(..., description="展示名")
    uuid: str = Field(..., description="当前权限池 UUID")
    granted: bool = Field(..., description="角色是否已授权")
    merged_codes: Optional[List[str]] = Field(
        None, description="合并审核等多 code 操作；勾选/取消时一并处理"
    )
    is_baseline: bool = Field(
        False,
        description="基线权限：默认授予且矩阵不可取消（如个人中心）",
    )


class FunctionGrantMenuNodeSchema(BaseModel):
    menu_uuid: str
    title: str
    path: Optional[str] = None
    resource: Optional[str] = None
    actions: List[FunctionGrantActionSchema] = Field(default_factory=list)
    children: List["FunctionGrantMenuNodeSchema"] = Field(default_factory=list)


class FunctionGrantStatsSchema(BaseModel):
    total_function_codes: int = Field(..., description="权限池功能权限总数")
    granted_function_codes: int = Field(..., description="角色已授权功能 code 数")
    granted_visible_on_tree: int = Field(..., description="在菜单树上可见且已授权数")
    granted_not_on_tree: int = Field(..., description="已授权但未挂在菜单树上")


class RoleFunctionGrantsResponse(BaseModel):
    role_uuid: str
    granted_codes: List[str] = Field(default_factory=list)
    tree: List[FunctionGrantMenuNodeSchema] = Field(default_factory=list)
    stats: FunctionGrantStatsSchema


class RoleFunctionGrantsReplace(BaseModel):
    codes: List[str] = Field(default_factory=list, description="功能权限 code 全量列表")


FunctionGrantMenuNodeSchema.model_rebuild()
