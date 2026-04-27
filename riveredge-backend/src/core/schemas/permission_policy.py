"""权限策略（数据/字段）Schema。"""

from __future__ import annotations

from datetime import datetime
from typing import Any, Optional

from pydantic import BaseModel, ConfigDict, Field


class DataPermissionPolicyUpsert(BaseModel):
    resource: str = Field(..., description="资源编码（app:resource）")
    scope_type: str = Field(..., description="scope_all/scope_department/scope_self/scope_custom")
    scope_payload: Optional[dict[str, Any]] = Field(None, description="scope_custom 附加数据")


class DataPermissionPolicyResponse(DataPermissionPolicyUpsert):
    uuid: str = Field(..., description="策略UUID")
    role_uuid: str = Field(..., description="角色UUID")
    created_at: datetime = Field(..., description="创建时间")
    updated_at: datetime = Field(..., description="更新时间")

    model_config = ConfigDict(from_attributes=True)


class FieldPermissionPolicyUpsert(BaseModel):
    resource: str = Field(..., description="资源编码（app:resource）")
    field_name: str = Field(..., description="字段名")
    mask_level: str = Field(..., description="full/masked/hidden")


class FieldPermissionPolicyResponse(FieldPermissionPolicyUpsert):
    uuid: str = Field(..., description="策略UUID")
    role_uuid: str = Field(..., description="角色UUID")
    created_at: datetime = Field(..., description="创建时间")
    updated_at: datetime = Field(..., description="更新时间")

    model_config = ConfigDict(from_attributes=True)
