"""
电子记录 Schema 模块

定义电子记录相关的 Pydantic Schema，用于数据验证和序列化。
"""

from pydantic import BaseModel, Field, ConfigDict, field_validator
from typing import Optional, Dict, Any
from datetime import datetime
from uuid import UUID


class ElectronicRecordBase(BaseModel):
    """电子记录基础 Schema"""
    name: str = Field(..., max_length=200, description="记录名称")
    code: str = Field(..., max_length=50, description="记录代码")
    type: str = Field(..., max_length=50, description="记录类型")
    description: Optional[str] = Field(None, description="记录描述")
    content: Dict[str, Any] = Field(..., description="记录内容")
    file_uuid: Optional[UUID] = Field(None, description="关联文件UUID")


class ElectronicRecordCreate(ElectronicRecordBase):
    """创建电子记录 Schema"""
    pass


class ElectronicRecordUpdate(BaseModel):
    """更新电子记录 Schema"""
    name: Optional[str] = Field(None, max_length=200, description="记录名称")
    description: Optional[str] = Field(None, description="记录描述")
    content: Optional[Dict[str, Any]] = Field(None, description="记录内容")
    file_uuid: Optional[UUID] = Field(None, description="关联文件UUID")


class ElectronicRecordSignRequest(BaseModel):
    """签名电子记录请求 Schema"""
    signer_id: int = Field(..., description="签名人ID")
    signature_data: Optional[str] = Field(None, description="签名数据")


class ElectronicRecordArchiveRequest(BaseModel):
    """归档电子记录请求 Schema"""
    archive_location: Optional[str] = Field(None, max_length=200, description="归档位置")


class ElectronicRecordResponse(ElectronicRecordBase):
    """电子记录响应 Schema"""
    uuid: UUID = Field(..., description="电子记录UUID")
    tenant_id: int = Field(..., description="组织ID")
    status: str = Field(..., description="记录状态")
    lifecycle_stage: Optional[str] = Field(None, description="生命周期阶段")
    inngest_workflow_id: Optional[str] = Field(None, description="Inngest 工作流ID")
    inngest_run_id: Optional[str] = Field(None, description="Inngest 运行ID")
    signer_id: Optional[int] = Field(None, description="签名人ID")
    signed_at: Optional[datetime] = Field(None, description="签名时间")
    signature_data: Optional[str] = Field(None, description="签名数据")
    archived_at: Optional[datetime] = Field(None, description="归档时间")
    archive_location: Optional[str] = Field(None, description="归档位置")
    created_at: datetime = Field(..., description="创建时间")
    updated_at: datetime = Field(..., description="更新时间")
    
    @field_validator('status')
    @classmethod
    def validate_status(cls, v):
        """验证记录状态"""
        if v is None:
            return v
        allowed_statuses = ['draft', 'signed', 'archived', 'destroyed']
        if v not in allowed_statuses:
            raise ValueError(f'记录状态必须是 {allowed_statuses} 之一')
        return v
    
    model_config = ConfigDict(from_attributes=True)

