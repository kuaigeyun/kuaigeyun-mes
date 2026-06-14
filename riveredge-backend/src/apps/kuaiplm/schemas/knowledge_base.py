"""
知识库 Schema

Author: RiverEdge Team
Date: 2026-05-28
"""

from datetime import datetime
from typing import List, Optional

from pydantic import BaseModel, ConfigDict, Field


class KbSpaceCreate(BaseModel):
    space_code: str
    space_name: str
    description: Optional[str] = None
    parent_space_id: Optional[int] = None
    sort_order: int = 0
    is_active: bool = True


class KbSpaceUpdate(BaseModel):
    space_name: Optional[str] = None
    description: Optional[str] = None
    parent_space_id: Optional[int] = None
    sort_order: Optional[int] = None
    is_active: Optional[bool] = None


class KbSpaceResponse(BaseModel):
    model_config = ConfigDict(from_attributes=True)

    id: int
    uuid: str
    tenant_id: int
    space_code: str
    space_name: str
    description: Optional[str] = None
    parent_space_id: Optional[int] = None
    sort_order: int
    is_active: bool
    created_at: datetime
    updated_at: datetime


class KbArticleLinkBase(BaseModel):
    link_type: str
    target_type: str
    target_id: Optional[int] = None
    target_uuid: Optional[str] = None
    target_code: Optional[str] = None
    target_name: Optional[str] = None


class KbArticleLinkCreate(KbArticleLinkBase):
    pass


class KbArticleLinkResponse(KbArticleLinkBase):
    model_config = ConfigDict(from_attributes=True)

    id: int
    uuid: str
    tenant_id: int
    article_id: int
    created_at: datetime
    updated_at: datetime


class KbArticleCreate(BaseModel):
    space_id: int
    article_code: Optional[str] = None
    title: str
    content: Optional[str] = None
    status: str = "DRAFT"
    tags: Optional[List[str]] = None
    links: List[KbArticleLinkCreate] = Field(default_factory=list)


class KbArticleUpdate(BaseModel):
    title: Optional[str] = None
    content: Optional[str] = None
    status: Optional[str] = None
    tags: Optional[List[str]] = None
    space_id: Optional[int] = None


class KbArticleResponse(BaseModel):
    model_config = ConfigDict(from_attributes=True)

    id: int
    uuid: str
    tenant_id: int
    space_id: int
    space_name: Optional[str] = None
    article_code: Optional[str] = None
    title: str
    content: Optional[str] = None
    status: str
    tags: Optional[List[str]] = None
    author_id: Optional[int] = None
    author_name: Optional[str] = None
    links: List[KbArticleLinkResponse] = Field(default_factory=list)
    created_at: datetime
    updated_at: datetime


class KbSearchResponse(BaseModel):
    articles: List[KbArticleResponse] = Field(default_factory=list)
    total: int = 0
