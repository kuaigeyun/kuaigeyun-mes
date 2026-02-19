from __future__ import annotations
from typing import Optional, Any, Dict, List
from datetime import datetime
from pydantic import Field
from core.schemas.base import BaseSchema
from apps.kuaireport.constants import ReportStatus, ReportCategory, ChartType


# ── 报表配置结构体 ──────────────────────────────────────────────

class FilterConfig(BaseSchema):
    """过滤条件配置"""
    field: str = Field(..., description="字段名")
    label: str = Field(..., description="显示标签")
    operator: str = Field("eq", description="操作符: eq/like/gt/lt/between/in")
    default_value: Optional[Any] = Field(None, description="默认值")


class FieldMapping(BaseSchema):
    """字段映射配置"""
    field: str = Field(..., description="数据字段名")
    label: str = Field(..., description="显示标签")
    x_axis: bool = Field(False, description="是否为 X 轴（图表）")
    y_axis: bool = Field(False, description="是否为 Y 轴（图表）")
    visible: bool = Field(True, description="是否显示（表格列）")
    width: Optional[int] = Field(None, description="列宽（表格）")
    format: Optional[str] = Field(None, description="格式化: number/percent/date 等")


class ReportConfigSchema(BaseSchema):
    """自研报表核心配置"""
    chart_type: ChartType = Field(ChartType.TABLE, description="图表类型")
    dataset_uuid: Optional[str] = Field(None, description="数据集 UUID（系统级）")
    dataset_code: Optional[str] = Field(None, description="数据集编码")
    fields: List[FieldMapping] = Field(default_factory=list, description="字段映射列表")
    filters: List[FilterConfig] = Field(default_factory=list, description="过滤条件列表")
    page_size: int = Field(20, description="默认分页大小")
    extra: Optional[Dict[str, Any]] = Field(None, description="扩展配置（图表特有属性）")


# ── 报表 CRUD Schema ────────────────────────────────────────────

class ReportBase(BaseSchema):
    code: str = Field(..., max_length=50, description="报表编码")
    name: str = Field(..., max_length=100, description="报表名称")
    description: Optional[str] = Field(None, description="描述")
    category: ReportCategory = Field(ReportCategory.CUSTOM, description="分类")
    is_system: bool = Field(False, description="是否系统报表")
    report_config: Optional[ReportConfigSchema] = Field(None, description="报表配置")
    status: ReportStatus = Field(ReportStatus.DRAFT, description="状态")


class ReportCreate(ReportBase):
    pass


class ReportUpdate(BaseSchema):
    name: Optional[str] = Field(None, max_length=100)
    description: Optional[str] = None
    category: Optional[ReportCategory] = None
    report_config: Optional[ReportConfigSchema] = None
    status: Optional[ReportStatus] = None


class ReportResponse(ReportBase):
    id: int
    uuid: str
    tenant_id: int
    owner_id: Optional[int] = None
    created_by: Optional[int] = None
    updated_by: Optional[int] = None
    created_at: datetime
    updated_at: datetime

    class Config:
        from_attributes = True


class ReportListResponse(BaseSchema):
    data: List[ReportResponse]
    total: int
    success: bool = True
