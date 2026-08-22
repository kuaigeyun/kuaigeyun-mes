"""敏感词黑名单 API 模型。"""

from datetime import datetime
from typing import List, Optional

from pydantic import BaseModel, Field


class SensitiveWordBlacklistMetaResponse(BaseModel):
    menu_visible: bool
    enabled_tenant_count: int
    enabled_tenants: List[dict] = Field(default_factory=list)


class SensitiveWordBanItem(BaseModel):
    id: int
    tenant_id: int
    tenant_name: Optional[str] = None
    user_id: int
    username: Optional[str] = None
    full_name: Optional[str] = None
    client_ip: str
    banned_at: datetime
    unbanned_at: Optional[datetime] = None
    is_active: bool
    trigger_request_path: Optional[str] = None
    trigger_field_path: Optional[str] = None
    trigger_matched_word: Optional[str] = None
    trigger_content_snippet: Optional[str] = None


class SensitiveWordBanListResponse(BaseModel):
    items: List[SensitiveWordBanItem]
    total: int
    page: int
    page_size: int


class TenantSensitiveWordAllowlistItem(BaseModel):
    id: int
    tenant_id: int
    word: str
    note: Optional[str] = None
    created_at: datetime


class TenantSensitiveWordAllowlistListResponse(BaseModel):
    items: List[TenantSensitiveWordAllowlistItem]
    total: int
    page: int
    page_size: int


class TenantSensitiveWordAllowlistCreate(BaseModel):
    tenant_id: int = Field(..., description="组织 ID")
    word: str = Field(..., min_length=1, max_length=128)
    note: Optional[str] = Field(None, max_length=255)
