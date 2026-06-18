"""用户展示解析（表单选人 / 单据引用，非人员管理全量读）。"""

from __future__ import annotations

from typing import Optional

from pydantic import BaseModel, Field


class UserDisplayRoleItem(BaseModel):
    uuid: str
    name: str
    code: Optional[str] = None


class UserDisplayItem(BaseModel):
    id: int
    uuid: str
    username: str
    full_name: Optional[str] = None
    label: str = Field(..., description="下拉与只读展示用文案")
    department_uuid: Optional[str] = None
    roles: list[UserDisplayRoleItem] = Field(default_factory=list, description="用户角色（展示用）")


class UserDisplayListResponse(BaseModel):
    items: list[UserDisplayItem]
    total: int
    page: int
    page_size: int


class UserDisplayResolveRequest(BaseModel):
    user_ids: list[int] = Field(default_factory=list, max_length=200)
    user_uuids: list[str] = Field(default_factory=list, max_length=200)


class UserDisplayResolveResponse(BaseModel):
    items: list[UserDisplayItem]
