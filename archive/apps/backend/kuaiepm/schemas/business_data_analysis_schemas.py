"""
经营数据分析 Schema 模块

定义经营数据分析数据的 Pydantic Schema，用于数据验证和序列化。
"""

from pydantic import BaseModel, Field, validator
from typing import Optional
from datetime import datetime
from decimal import Decimal


class BusinessDataAnalysisBase(BaseModel):
    """经营数据分析基础 Schema"""
    
    analysis_no: str = Field(..., max_length=50, description="分析编号（组织内唯一）")
    status: str = Field("待处理", max_length=50, description="状态")
    
    @validator("analysis_no")
    def validate_analysis_no(cls, v):
        """验证分析编号格式"""
        if not v or not v.strip():
            raise ValueError("分析编号不能为空")
        return v.strip()


class BusinessDataAnalysisCreate(BusinessDataAnalysisBase):
    """创建经营数据分析 Schema"""
    pass


class BusinessDataAnalysisUpdate(BaseModel):
    """更新经营数据分析 Schema"""
    
    status: Optional[str] = Field(None, max_length=50, description="状态")


class BusinessDataAnalysisResponse(BusinessDataAnalysisBase):
    """经营数据分析响应 Schema"""
    
    id: int
    uuid: str
    tenant_id: Optional[int]
    created_at: datetime
    updated_at: datetime
    
    class Config:
        from_attributes = True
