from __future__ import annotations
from typing import Optional, Any
from datetime import datetime
from pydantic import Field
from core.schemas.base import BaseSchema
from apps.kuaireport.constants import ReportStatus

class DashboardBase(BaseSchema):
    code: str = Field(..., max_length=50, description="看板编码")
    name: str = Field(..., max_length=100, description="看板名称")
    
    layout_config: Optional[Any] = Field(None, description="布局配置")
    widgets_config: Optional[Any] = Field(None, description="组件配置")
    theme_config: Optional[Any] = Field(None, description="主题配置")
    
    status: ReportStatus = Field(ReportStatus.DRAFT, description="状态")
    description: Optional[str] = Field(None, description="描述")
    thumbnail: Optional[str] = Field(None, max_length=500, description="缩略图URL")

class DashboardCreate(DashboardBase):
    pass

class DashboardUpdate(BaseSchema):
    name: Optional[str] = Field(None, max_length=100)
    layout_config: Optional[Any] = None
    widgets_config: Optional[Any] = None
    theme_config: Optional[Any] = None
    status: Optional[ReportStatus] = None
    description: Optional[str] = None
    thumbnail: Optional[str] = None

class DashboardResponse(DashboardBase):
    id: int
    uuid: str
    tenant_id: int
    created_by: Optional[int] = None
    updated_by: Optional[int] = None
    created_at: datetime
    updated_at: datetime

    class Config:
        from_attributes = True

class DashboardListResponse(BaseSchema):
    data: list[DashboardResponse]
    total: int
    success: bool = True
