"""
安装记录 Schema 模块

定义安装记录数据的 Pydantic Schema，用于数据验证和序列化。
"""

from pydantic import BaseModel, Field, validator
from typing import Optional
from datetime import datetime


class InstallationBase(BaseModel):
    """安装记录基础 Schema"""
    
    installation_no: str = Field(..., max_length=50, description="安装编号")
    customer_id: int = Field(..., description="客户ID（关联master-data）")
    installation_date: datetime = Field(..., description="安装日期")
    installation_address: str = Field(..., description="安装地址")
    installation_status: str = Field("待安装", max_length=20, description="安装状态")
    
    @validator("installation_no")
    def validate_installation_no(cls, v):
        """验证安装编号格式"""
        if not v or not v.strip():
            raise ValueError("安装编号不能为空")
        return v.strip().upper()
    
    @validator("installation_address")
    def validate_installation_address(cls, v):
        """验证安装地址格式"""
        if not v or not v.strip():
            raise ValueError("安装地址不能为空")
        return v.strip()


class InstallationCreate(InstallationBase):
    """创建安装记录 Schema"""
    pass


class InstallationUpdate(BaseModel):
    """更新安装记录 Schema"""
    
    installation_date: Optional[datetime] = Field(None, description="安装日期")
    installation_address: Optional[str] = Field(None, description="安装地址")
    installation_status: Optional[str] = Field(None, max_length=20, description="安装状态")
    installation_result: Optional[str] = Field(None, description="安装结果")


class InstallationResponse(InstallationBase):
    """安装记录响应 Schema"""
    
    id: int
    uuid: str
    tenant_id: Optional[int]
    installation_result: Optional[str] = None
    created_at: datetime
    updated_at: datetime
    
    class Config:
        from_attributes = True
