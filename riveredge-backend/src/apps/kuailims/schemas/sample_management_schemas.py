"""
样品管理 Schema 模块

定义样品管理相关的 Pydantic Schema，用于数据验证和序列化。
"""

from pydantic import BaseModel, Field
from typing import Optional, Any
from datetime import datetime


class SampleManagementBase(BaseModel):
    """样品管理基础 Schema"""
    
    sample_no: str = Field(..., max_length=100, description="样品编号")
    sample_name: str = Field(..., max_length=200, description="样品名称")
    sample_type: str = Field(..., max_length=50, description="样品类型")
    sample_category: Optional[str] = Field(None, max_length=50, description="样品分类")
    sample_source: Optional[str] = Field(None, max_length=200, description="样品来源")
    registration_date: Optional[datetime] = Field(None, description="登记日期")
    registration_person_id: Optional[int] = Field(None, description="登记人ID")
    registration_person_name: Optional[str] = Field(None, max_length=100, description="登记人姓名")
    sample_status: str = Field("已登记", max_length=50, description="样品状态")
    storage_location: Optional[str] = Field(None, max_length=200, description="存储位置")
    storage_condition: Optional[Any] = Field(None, description="存储条件")
    current_location: Optional[str] = Field(None, max_length=200, description="当前位置")
    transfer_records: Optional[Any] = Field(None, description="流转记录")
    expiry_date: Optional[datetime] = Field(None, description="有效期")
    status: str = Field("正常", max_length=50, description="状态")
    remark: Optional[str] = Field(None, description="备注")


class SampleManagementCreate(SampleManagementBase):
    """创建样品管理 Schema"""
    pass


class SampleManagementUpdate(BaseModel):
    """更新样品管理 Schema"""
    
    sample_name: Optional[str] = Field(None, max_length=200, description="样品名称")
    sample_type: Optional[str] = Field(None, max_length=50, description="样品类型")
    sample_category: Optional[str] = Field(None, max_length=50, description="样品分类")
    sample_source: Optional[str] = Field(None, max_length=200, description="样品来源")
    registration_date: Optional[datetime] = Field(None, description="登记日期")
    registration_person_id: Optional[int] = Field(None, description="登记人ID")
    registration_person_name: Optional[str] = Field(None, max_length=100, description="登记人姓名")
    sample_status: Optional[str] = Field(None, max_length=50, description="样品状态")
    storage_location: Optional[str] = Field(None, max_length=200, description="存储位置")
    storage_condition: Optional[Any] = Field(None, description="存储条件")
    current_location: Optional[str] = Field(None, max_length=200, description="当前位置")
    transfer_records: Optional[Any] = Field(None, description="流转记录")
    expiry_date: Optional[datetime] = Field(None, description="有效期")
    status: Optional[str] = Field(None, max_length=50, description="状态")
    remark: Optional[str] = Field(None, description="备注")


class SampleManagementResponse(SampleManagementBase):
    """样品管理响应 Schema"""
    
    id: int
    uuid: str
    tenant_id: Optional[int]
    created_at: str
    updated_at: str
    
    class Config:
        from_attributes = True

