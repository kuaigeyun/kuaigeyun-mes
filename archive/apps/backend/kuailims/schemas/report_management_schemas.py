"""
报告管理 Schema 模块

定义报告管理相关的 Pydantic Schema，用于数据验证和序列化。
"""

from pydantic import BaseModel, Field
from typing import Optional, Any
from datetime import datetime


class ReportManagementBase(BaseModel):
    """报告管理基础 Schema"""
    
    report_no: str = Field(..., max_length=100, description="报告编号")
    report_name: str = Field(..., max_length=200, description="报告名称")
    experiment_id: Optional[int] = Field(None, description="实验ID")
    experiment_uuid: Optional[str] = Field(None, max_length=36, description="实验UUID")
    experiment_no: Optional[str] = Field(None, max_length=100, description="实验编号")
    report_template: Optional[str] = Field(None, max_length=200, description="报告模板")
    report_content: Optional[str] = Field(None, description="报告内容")
    generation_method: str = Field("自动生成", max_length=50, description="生成方式")
    generation_date: Optional[datetime] = Field(None, description="生成日期")
    audit_status: str = Field("待审核", max_length=50, description="审核状态")
    audit_person_id: Optional[int] = Field(None, description="审核人ID")
    audit_person_name: Optional[str] = Field(None, max_length=100, description="审核人姓名")
    audit_date: Optional[datetime] = Field(None, description="审核日期")
    audit_records: Optional[Any] = Field(None, description="审核记录")
    publish_status: str = Field("未发布", max_length=50, description="发布状态")
    publish_date: Optional[datetime] = Field(None, description="发布日期")
    publish_records: Optional[Any] = Field(None, description="发布记录")
    status: str = Field("草稿", max_length=50, description="状态")
    remark: Optional[str] = Field(None, description="备注")


class ReportManagementCreate(ReportManagementBase):
    """创建报告管理 Schema"""
    pass


class ReportManagementUpdate(BaseModel):
    """更新报告管理 Schema"""
    
    report_name: Optional[str] = Field(None, max_length=200, description="报告名称")
    experiment_id: Optional[int] = Field(None, description="实验ID")
    experiment_uuid: Optional[str] = Field(None, max_length=36, description="实验UUID")
    experiment_no: Optional[str] = Field(None, max_length=100, description="实验编号")
    report_template: Optional[str] = Field(None, max_length=200, description="报告模板")
    report_content: Optional[str] = Field(None, description="报告内容")
    generation_method: Optional[str] = Field(None, max_length=50, description="生成方式")
    generation_date: Optional[datetime] = Field(None, description="生成日期")
    audit_status: Optional[str] = Field(None, max_length=50, description="审核状态")
    audit_person_id: Optional[int] = Field(None, description="审核人ID")
    audit_person_name: Optional[str] = Field(None, max_length=100, description="审核人姓名")
    audit_date: Optional[datetime] = Field(None, description="审核日期")
    audit_records: Optional[Any] = Field(None, description="审核记录")
    publish_status: Optional[str] = Field(None, max_length=50, description="发布状态")
    publish_date: Optional[datetime] = Field(None, description="发布日期")
    publish_records: Optional[Any] = Field(None, description="发布记录")
    status: Optional[str] = Field(None, max_length=50, description="状态")
    remark: Optional[str] = Field(None, description="备注")


class ReportManagementResponse(ReportManagementBase):
    """报告管理响应 Schema"""
    
    id: int
    uuid: str
    tenant_id: Optional[int]
    created_at: str
    updated_at: str
    
    class Config:
        from_attributes = True

