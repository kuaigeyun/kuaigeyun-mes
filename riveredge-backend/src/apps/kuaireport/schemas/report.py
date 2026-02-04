from __future__ import annotations
from typing import Optional, Any, Dict
from datetime import datetime
from pydantic import Field
from core.schemas.base import BaseSchema
from apps.kuaireport.constants import ReportStatus

class ReportBase(BaseSchema):
    code: str = Field(..., max_length=50, description="报表编码")
    name: str = Field(..., max_length=100, description="报表名称")
    report_type: str = Field("univer", description="报表引擎类型")
    content: Optional[Any] = Field(None, description="报表内容(Univer Snapshot)")
    template_config: Optional[Any] = Field(None, description="积木报表模板配置")
    status: ReportStatus = Field(ReportStatus.DRAFT, description="状态")
    description: Optional[str] = Field(None, description="描述")

class ReportCreate(ReportBase):
    pass

class ReportUpdate(BaseSchema):
    name: Optional[str] = Field(None, max_length=100)
    report_type: Optional[str] = None
    content: Optional[Any] = None
    template_config: Optional[Any] = None
    status: Optional[ReportStatus] = None
    description: Optional[str] = None

class ReportResponse(ReportBase):
    id: int
    uuid: str
    tenant_id: int
    created_by: Optional[int] = None
    updated_by: Optional[int] = None
    created_at: datetime
    updated_at: datetime

    class Config:
        from_attributes = True

class ReportListResponse(BaseSchema):
    data: list[ReportResponse]
    total: int
    success: bool = True

class ReportPreviewRequest(BaseSchema):
    datasource: Dict[str, Any] = Field(..., description="数据源配置")
    filters: Optional[Dict[str, Any]] = Field(default_factory=dict, description="过滤条件")

