"""
实时生产看板 Schema 模块

定义实时生产看板相关的 Pydantic Schema，用于数据验证和序列化。
"""

from pydantic import BaseModel, Field
from typing import Optional, Any
from datetime import datetime


class ProductionDashboardBase(BaseModel):
    """实时生产看板基础 Schema"""
    
    dashboard_no: str = Field(..., max_length=100, description="看板编号")
    dashboard_name: str = Field(..., max_length=200, description="看板名称")
    dashboard_type: str = Field(..., max_length=50, description="看板类型")
    production_line_id: Optional[int] = Field(None, description="产线ID")
    production_line_name: Optional[str] = Field(None, max_length=200, description="产线名称")
    alert_level: str = Field("正常", max_length=50, description="报警等级")
    alert_category: Optional[str] = Field(None, max_length=100, description="报警分类")
    alert_status: str = Field("待处理", max_length=50, description="报警状态")
    alert_time: Optional[datetime] = Field(None, description="报警时间")
    alert_description: Optional[str] = Field(None, description="报警描述")
    handler_id: Optional[int] = Field(None, description="处理人ID")
    handler_name: Optional[str] = Field(None, max_length=100, description="处理人姓名")
    handle_time: Optional[datetime] = Field(None, description="处理时间")
    handle_result: Optional[str] = Field(None, description="处理结果")
    production_status: str = Field("运行中", max_length=50, description="生产状态")
    status_data: Optional[Any] = Field(None, description="状态数据")
    status_trend: Optional[Any] = Field(None, description="状态趋势")
    status: str = Field("启用", max_length=50, description="状态")
    remark: Optional[str] = Field(None, description="备注")


class ProductionDashboardCreate(ProductionDashboardBase):
    """创建实时生产看板 Schema"""
    pass


class ProductionDashboardUpdate(BaseModel):
    """更新实时生产看板 Schema"""
    
    dashboard_name: Optional[str] = Field(None, max_length=200, description="看板名称")
    dashboard_type: Optional[str] = Field(None, max_length=50, description="看板类型")
    production_line_id: Optional[int] = Field(None, description="产线ID")
    production_line_name: Optional[str] = Field(None, max_length=200, description="产线名称")
    alert_level: Optional[str] = Field(None, max_length=50, description="报警等级")
    alert_category: Optional[str] = Field(None, max_length=100, description="报警分类")
    alert_status: Optional[str] = Field(None, max_length=50, description="报警状态")
    alert_time: Optional[datetime] = Field(None, description="报警时间")
    alert_description: Optional[str] = Field(None, description="报警描述")
    handler_id: Optional[int] = Field(None, description="处理人ID")
    handler_name: Optional[str] = Field(None, max_length=100, description="处理人姓名")
    handle_time: Optional[datetime] = Field(None, description="处理时间")
    handle_result: Optional[str] = Field(None, description="处理结果")
    production_status: Optional[str] = Field(None, max_length=50, description="生产状态")
    status_data: Optional[Any] = Field(None, description="状态数据")
    status_trend: Optional[Any] = Field(None, description="状态趋势")
    status: Optional[str] = Field(None, max_length=50, description="状态")
    remark: Optional[str] = Field(None, description="备注")


class ProductionDashboardResponse(ProductionDashboardBase):
    """实时生产看板响应 Schema"""
    
    id: int
    uuid: str
    tenant_id: Optional[int]
    created_at: str
    updated_at: str
    
    class Config:
        from_attributes = True

