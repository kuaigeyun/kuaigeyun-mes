"""
销售合同条款 Pydantic Schemas
"""

from datetime import datetime
from typing import List, Optional
from pydantic import BaseModel, Field


class SalesContractTermItemCreate(BaseModel):
    term_code: Optional[str] = Field(None, max_length=50)
    term_name: str = Field(..., max_length=200)
    content: str
    sort_order: int = 0
    is_active: bool = True


class SalesContractTermItemUpdate(BaseModel):
    term_code: Optional[str] = Field(None, max_length=50)
    term_name: Optional[str] = Field(None, max_length=200)
    content: Optional[str] = None
    sort_order: Optional[int] = None
    is_active: Optional[bool] = None


class SalesContractTermItemResponse(BaseModel):
    id: int
    uuid: str
    tenant_id: int
    term_code: Optional[str] = None
    term_name: str
    content: str
    sort_order: int
    is_active: bool
    created_at: datetime
    updated_at: datetime

    class Config:
        from_attributes = True


class SalesContractTermItemListResponse(BaseModel):
    items: List[SalesContractTermItemResponse]
    total: int


class SalesContractTermGroupItemRef(BaseModel):
    term_item_id: int
    sort_order: int = 0


class SalesContractTermGroupItemDetail(BaseModel):
    term_item_id: int
    term_code: Optional[str] = None
    term_name: str
    content: str
    sort_order: int


class SalesContractTermGroupCreate(BaseModel):
    group_code: Optional[str] = Field(None, max_length=50)
    group_name: str = Field(..., max_length=200)
    description: Optional[str] = None
    is_active: bool = True
    items: List[SalesContractTermGroupItemRef] = Field(default_factory=list)


class SalesContractTermGroupUpdate(BaseModel):
    group_code: Optional[str] = Field(None, max_length=50)
    group_name: Optional[str] = Field(None, max_length=200)
    description: Optional[str] = None
    is_active: Optional[bool] = None
    items: Optional[List[SalesContractTermGroupItemRef]] = None


class SalesContractTermGroupResponse(BaseModel):
    id: int
    uuid: str
    tenant_id: int
    group_code: Optional[str] = None
    group_name: str
    description: Optional[str] = None
    is_active: bool
    created_at: datetime
    updated_at: datetime
    items: Optional[List[SalesContractTermGroupItemDetail]] = None

    class Config:
        from_attributes = True


class SalesContractTermGroupListResponse(BaseModel):
    items: List[SalesContractTermGroupResponse]
    total: int


class SalesContractTermSnapshot(BaseModel):
    term_item_id: Optional[int] = None
    term_name: str
    content: str
    template_content: Optional[str] = None
    placeholder_values: Optional[dict] = None
    sort_order: int = 0
