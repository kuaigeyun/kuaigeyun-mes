"""公告 schemas。"""

from typing import Optional

from pydantic import BaseModel, Field


class AnnouncementCreate(BaseModel):
    title: str = Field(..., max_length=200)
    content: str
    scope_type: str = Field(default="all", max_length=30)
    scope_department: Optional[str] = Field(None, max_length=100)
    is_pinned: bool = False
    effective_at: Optional[str] = None
    expires_at: Optional[str] = None


class AnnouncementUpdate(BaseModel):
    title: Optional[str] = Field(None, max_length=200)
    content: Optional[str] = None
    scope_type: Optional[str] = Field(None, max_length=30)
    scope_department: Optional[str] = Field(None, max_length=100)
    is_pinned: Optional[bool] = None
    effective_at: Optional[str] = None
    expires_at: Optional[str] = None
