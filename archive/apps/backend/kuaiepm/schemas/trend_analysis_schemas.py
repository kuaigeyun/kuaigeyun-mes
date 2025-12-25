"""
趋势分析 Schema 模块

定义趋势分析数据的 Pydantic Schema，用于数据验证和序列化。
"""

from pydantic import BaseModel, Field, validator
from typing import Optional
from datetime import datetime
from decimal import Decimal


class TrendAnalysisBase(BaseModel):
    """趋势分析基础 Schema"""
    
    analysis_no: str = Field(..., max_length=50, description="分析编号（组织内唯一）")
    status: str = Field("待处理", max_length=50, description="状态")
    
    @validator("analysis_no")
    def validate_analysis_no(cls, v):
        """验证分析编号格式"""
        if not v or not v.strip():
            raise ValueError("分析编号不能为空")
        return v.strip()


class TrendAnalysisCreate(TrendAnalysisBase):
    """创建趋势分析 Schema"""
    pass


class TrendAnalysisUpdate(BaseModel):
    """更新趋势分析 Schema"""
    
    status: Optional[str] = Field(None, max_length=50, description="状态")


class TrendAnalysisResponse(TrendAnalysisBase):
    """趋势分析响应 Schema"""
    
    id: int
    uuid: str
    tenant_id: Optional[int]
    created_at: datetime
    updated_at: datetime
    
    class Config:
        from_attributes = True
