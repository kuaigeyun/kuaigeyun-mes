"""
报表Schema定义模块

定义报表配置的JSON Schema结构，包括报表组件类型、数据源配置等。

Author: Luigi Lu
Date: 2025-01-15
"""

from datetime import datetime
from typing import Optional, Dict, Any, List
from pydantic import BaseModel, Field, ConfigDict


# ============ 报表组件类型定义 ============

class ReportComponentBase(BaseModel):
    """
    报表组件基础Schema

    所有报表组件的基类。
    """
    model_config = ConfigDict(from_attributes=True)

    id: str = Field(..., description="组件ID")
    type: str = Field(..., description="组件类型")
    x: int = Field(0, description="X坐标")
    y: int = Field(0, description="Y坐标")
    width: int = Field(100, description="宽度")
    height: int = Field(100, description="高度")
    style: Optional[Dict[str, Any]] = Field(None, description="样式配置")


class TableComponent(ReportComponentBase):
    """
    表格组件Schema
    """
    type: str = Field("table", description="组件类型")
    data_source: Optional[str] = Field(None, description="数据源配置")
    columns: Optional[List[Dict[str, Any]]] = Field(None, description="列配置")
    pagination: Optional[Dict[str, Any]] = Field(None, description="分页配置")


class ChartComponent(ReportComponentBase):
    """
    图表组件Schema
    """
    type: str = Field(..., description="图表类型（bar/line/pie/scatter等）")
    data_source: Optional[str] = Field(None, description="数据源配置")
    chart_config: Optional[Dict[str, Any]] = Field(None, description="图表配置")


class TextComponent(ReportComponentBase):
    """
    文本组件Schema
    """
    type: str = Field("text", description="组件类型")
    content: str = Field(..., description="文本内容")
    text_type: str = Field("paragraph", description="文本类型（title/paragraph/label）")


class ImageComponent(ReportComponentBase):
    """
    图片组件Schema
    """
    type: str = Field("image", description="组件类型")
    src: str = Field(..., description="图片URL")
    alt: Optional[str] = Field(None, description="图片描述")


class GroupComponent(ReportComponentBase):
    """
    分组组件Schema
    """
    type: str = Field("group", description="组件类型")
    children: List[ReportComponentBase] = Field(default_factory=list, description="子组件列表")


# ============ 报表配置Schema ============

class ReportConfig(BaseModel):
    """
    报表配置Schema

    定义报表的整体配置结构。
    """
    model_config = ConfigDict(from_attributes=True)

    version: str = Field("1.0", description="配置版本")
    layout: Dict[str, Any] = Field(default_factory=dict, description="布局配置")
    components: List[ReportComponentBase] = Field(default_factory=list, description="组件列表")
    data_sources: Optional[List[Dict[str, Any]]] = Field(None, description="数据源配置列表")
    styles: Optional[Dict[str, Any]] = Field(None, description="全局样式配置")


# ============ 报表模板Schema ============

class ReportTemplateBase(BaseModel):
    """
    报表模板基础Schema
    """
    model_config = ConfigDict(from_attributes=True)

    name: str = Field(..., description="模板名称")
    code: str = Field(..., description="模板编码")
    type: str = Field(..., description="报表类型")
    category: str = Field("personal", description="分类")
    config: Dict[str, Any] = Field(..., description="报表配置（JSON格式）")
    status: str = Field("draft", description="状态")
    is_default: bool = Field(False, description="是否默认模板")
    description: Optional[str] = Field(None, description="描述")


class ReportTemplateCreate(ReportTemplateBase):
    """
    报表模板创建Schema
    """
    pass


class ReportTemplateUpdate(BaseModel):
    """
    报表模板更新Schema
    """
    model_config = ConfigDict(from_attributes=True)

    name: Optional[str] = Field(None, description="模板名称")
    code: Optional[str] = Field(None, description="模板编码")
    type: Optional[str] = Field(None, description="报表类型")
    category: Optional[str] = Field(None, description="分类")
    config: Optional[Dict[str, Any]] = Field(None, description="报表配置")
    status: Optional[str] = Field(None, description="状态")
    is_default: Optional[bool] = Field(None, description="是否默认模板")
    description: Optional[str] = Field(None, description="描述")


class ReportTemplateResponse(ReportTemplateBase):
    """
    报表模板响应Schema
    """
    id: int = Field(..., description="模板ID")
    uuid: str = Field(..., description="业务ID")
    created_by: Optional[int] = Field(None, description="创建人ID")
    created_by_name: Optional[str] = Field(None, description="创建人姓名")
    updated_by: Optional[int] = Field(None, description="更新人ID")
    updated_by_name: Optional[str] = Field(None, description="更新人姓名")
    created_at: datetime = Field(..., description="创建时间")
    updated_at: datetime = Field(..., description="更新时间")


class ReportTemplateListResponse(ReportTemplateResponse):
    """
    报表模板列表响应Schema
    """
    pass

