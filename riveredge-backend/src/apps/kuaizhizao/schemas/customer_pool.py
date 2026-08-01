"""
客户池 API Schema。
"""

from __future__ import annotations

from datetime import datetime
from typing import List, Optional

from pydantic import BaseModel, ConfigDict, Field


class CustomerPoolCollaboratorItem(BaseModel):
    user_id: int
    user_name: str

    model_config = ConfigDict(from_attributes=True)


class CustomerPoolItem(BaseModel):
    id: int
    uuid: str
    code: str
    name: str
    short_name: Optional[str] = None
    contact_person: Optional[str] = None
    phone: Optional[str] = None
    salesman_id: Optional[int] = None
    salesman_name: Optional[str] = None
    pool_status: str
    assigned_at: Optional[datetime] = None
    last_follow_up_at: Optional[datetime] = None
    recycle_at: Optional[datetime] = None
    created_by_name: Optional[str] = None
    updated_by_name: Optional[str] = None
    created_at: datetime
    updated_at: datetime
    collaborators: List[CustomerPoolCollaboratorItem] = Field(default_factory=list)

    model_config = ConfigDict(from_attributes=True)


class CustomerPoolListEnvelope(BaseModel):
    items: List[CustomerPoolItem]
    total: int


class CustomerPoolAssignBody(BaseModel):
    salesman_id: int = Field(..., ge=1, description="目标业务员ID")
    reason: Optional[str] = Field(None, max_length=200)


class CustomerPoolActionBody(BaseModel):
    reason: Optional[str] = Field(None, max_length=200)


class CustomerPoolRuleResponse(BaseModel):
    recycle_enabled: bool = True
    recycle_after_days: int = 15
    max_owned_customers: int = 0
    allow_claim_others: bool = False
    updated_at: Optional[datetime] = None
    updated_by: Optional[int] = None

    model_config = ConfigDict(from_attributes=True)


class CustomerPoolRuleUpdateBody(BaseModel):
    recycle_enabled: Optional[bool] = None
    recycle_after_days: Optional[int] = Field(None, ge=1, le=365)
    max_owned_customers: Optional[int] = Field(None, ge=0, le=100000)
    allow_claim_others: Optional[bool] = None


class CustomerPoolCollaboratorsUpdateBody(BaseModel):
    user_ids: List[int] = Field(default_factory=list, description="协作人用户ID列表")


class CustomerPoolLogItem(BaseModel):
    action: str
    from_salesman_id: Optional[int] = None
    from_salesman_name: Optional[str] = None
    to_salesman_id: Optional[int] = None
    to_salesman_name: Optional[str] = None
    operator_user_id: int
    operator_name: Optional[str] = None
    reason: Optional[str] = None
    created_at: datetime

    model_config = ConfigDict(from_attributes=True)


class CustomerPoolLogListEnvelope(BaseModel):
    items: List[CustomerPoolLogItem]
    total: int

