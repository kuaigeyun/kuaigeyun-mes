"""引用资源展示 API（下拉搜索 / 回显）。"""

from __future__ import annotations

from typing import Any, Optional

from pydantic import BaseModel, Field


class ReferenceDisplayItem(BaseModel):
    id: int | None = None
    uuid: str | None = None
    code: str | None = None
    name: str | None = None
    label: str = Field(..., description="下拉与只读展示用文案")
    extra: dict[str, Any] = Field(default_factory=dict)


class ReferenceDisplayListResponse(BaseModel):
    items: list[ReferenceDisplayItem]
    total: int
    page: int
    page_size: int


class ReferenceDisplayResolveRequest(BaseModel):
    resource: str = Field(..., description="全局 resource_key，如 master-data:supply-chain:customer")
    record_ids: list[int] = Field(default_factory=list, max_length=200)
    record_uuids: list[str] = Field(default_factory=list, max_length=200)
    host_resource: Optional[str] = Field(None, description="宿主 {app}:{module}，供隐式鉴权")


class ReferenceDisplayResolveResponse(BaseModel):
    items: list[ReferenceDisplayItem]
