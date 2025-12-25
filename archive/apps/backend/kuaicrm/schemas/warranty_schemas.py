"""
保修 Schema 模块

定义保修数据的 Pydantic Schema，用于数据验证和序列化。
"""

from pydantic import BaseModel, Field, validator
from typing import Optional
from datetime import datetime


class WarrantyBase(BaseModel):
    """保修基础 Schema"""
    
    warranty_no: str = Field(..., max_length=50, description="保修编号")
    customer_id: int = Field(..., description="客户ID（关联master-data）")
    product_info: str = Field(..., description="产品信息")
    warranty_type: str = Field(..., max_length=50, description="保修类型")
    warranty_period: int = Field(..., ge=1, description="保修期限（月）")
    warranty_start_date: Optional[datetime] = Field(None, description="保修开始日期")
    warranty_end_date: Optional[datetime] = Field(None, description="保修结束日期")
    warranty_status: str = Field("有效", max_length=20, description="保修状态")
    
    @validator("warranty_no")
    def validate_warranty_no(cls, v):
        """验证保修编号格式"""
        if not v or not v.strip():
            raise ValueError("保修编号不能为空")
        return v.strip().upper()


class WarrantyCreate(WarrantyBase):
    """创建保修 Schema"""
    pass


class WarrantyUpdate(BaseModel):
    """更新保修 Schema"""
    
    product_info: Optional[str] = Field(None, description="产品信息")
    warranty_type: Optional[str] = Field(None, max_length=50, description="保修类型")
    warranty_period: Optional[int] = Field(None, ge=1, description="保修期限（月）")
    warranty_start_date: Optional[datetime] = Field(None, description="保修开始日期")
    warranty_end_date: Optional[datetime] = Field(None, description="保修结束日期")
    warranty_status: Optional[str] = Field(None, max_length=20, description="保修状态")


class WarrantyResponse(WarrantyBase):
    """保修响应 Schema"""
    
    id: int
    uuid: str
    tenant_id: Optional[int]
    created_at: datetime
    updated_at: datetime
    
    class Config:
        from_attributes = True
