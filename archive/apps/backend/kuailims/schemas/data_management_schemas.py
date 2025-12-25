"""
数据管理 Schema 模块

定义数据管理相关的 Pydantic Schema，用于数据验证和序列化。
"""

from pydantic import BaseModel, Field
from typing import Optional, Any
from datetime import datetime


class DataManagementBase(BaseModel):
    """数据管理基础 Schema"""
    
    data_no: str = Field(..., max_length=100, description="数据编号")
    data_name: str = Field(..., max_length=200, description="数据名称")
    experiment_id: Optional[int] = Field(None, description="实验ID")
    experiment_uuid: Optional[str] = Field(None, max_length=36, description="实验UUID")
    experiment_no: Optional[str] = Field(None, max_length=100, description="实验编号")
    data_type: str = Field(..., max_length=50, description="数据类型")
    data_content: Optional[Any] = Field(None, description="数据内容")
    entry_person_id: Optional[int] = Field(None, description="录入人ID")
    entry_person_name: Optional[str] = Field(None, max_length=100, description="录入人姓名")
    entry_date: Optional[datetime] = Field(None, description="录入日期")
    validation_status: str = Field("待校验", max_length=50, description="校验状态")
    validation_result: Optional[str] = Field(None, description="校验结果")
    audit_status: str = Field("待审核", max_length=50, description="审核状态")
    audit_person_id: Optional[int] = Field(None, description="审核人ID")
    audit_person_name: Optional[str] = Field(None, max_length=100, description="审核人姓名")
    audit_date: Optional[datetime] = Field(None, description="审核日期")
    audit_records: Optional[Any] = Field(None, description="审核记录")
    archive_status: str = Field("未归档", max_length=50, description="归档状态")
    archive_date: Optional[datetime] = Field(None, description="归档日期")
    status: str = Field("草稿", max_length=50, description="状态")
    remark: Optional[str] = Field(None, description="备注")


class DataManagementCreate(DataManagementBase):
    """创建数据管理 Schema"""
    pass


class DataManagementUpdate(BaseModel):
    """更新数据管理 Schema"""
    
    data_name: Optional[str] = Field(None, max_length=200, description="数据名称")
    experiment_id: Optional[int] = Field(None, description="实验ID")
    experiment_uuid: Optional[str] = Field(None, max_length=36, description="实验UUID")
    experiment_no: Optional[str] = Field(None, max_length=100, description="实验编号")
    data_type: Optional[str] = Field(None, max_length=50, description="数据类型")
    data_content: Optional[Any] = Field(None, description="数据内容")
    entry_person_id: Optional[int] = Field(None, description="录入人ID")
    entry_person_name: Optional[str] = Field(None, max_length=100, description="录入人姓名")
    entry_date: Optional[datetime] = Field(None, description="录入日期")
    validation_status: Optional[str] = Field(None, max_length=50, description="校验状态")
    validation_result: Optional[str] = Field(None, description="校验结果")
    audit_status: Optional[str] = Field(None, max_length=50, description="审核状态")
    audit_person_id: Optional[int] = Field(None, description="审核人ID")
    audit_person_name: Optional[str] = Field(None, max_length=100, description="审核人姓名")
    audit_date: Optional[datetime] = Field(None, description="审核日期")
    audit_records: Optional[Any] = Field(None, description="审核记录")
    archive_status: Optional[str] = Field(None, max_length=50, description="归档状态")
    archive_date: Optional[datetime] = Field(None, description="归档日期")
    status: Optional[str] = Field(None, max_length=50, description="状态")
    remark: Optional[str] = Field(None, description="备注")


class DataManagementResponse(DataManagementBase):
    """数据管理响应 Schema"""
    
    id: int
    uuid: str
    tenant_id: Optional[int]
    created_at: str
    updated_at: str
    
    class Config:
        from_attributes = True

