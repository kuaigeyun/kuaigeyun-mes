from datetime import datetime
from typing import Any, Optional

from pydantic import BaseModel, Field


class AccessPolicyBase(BaseModel):
    name: str = Field(..., max_length=120)
    effect: str = Field(default="allow")
    priority: int = Field(default=100)
    target_resource: str
    target_action: str
    condition_expr: Optional[dict[str, Any]] = None
    enabled: bool = True
    bindings: list[dict[str, Any]] = Field(default_factory=list, description="绑定主体，格式: {subject_type, subject_id}")


class AccessPolicyCreate(AccessPolicyBase):
    pass


class AccessPolicyUpdate(BaseModel):
    name: Optional[str] = None
    effect: Optional[str] = None
    priority: Optional[int] = None
    target_resource: Optional[str] = None
    target_action: Optional[str] = None
    condition_expr: Optional[dict[str, Any]] = None
    enabled: Optional[bool] = None
    bindings: Optional[list[dict[str, Any]]] = None


class AccessPolicyResponse(AccessPolicyBase):
    uuid: str
    tenant_id: int
    created_at: datetime
    updated_at: datetime
