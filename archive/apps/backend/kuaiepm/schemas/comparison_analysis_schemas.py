"""
对比分析 Schema 模块

定义对比分析数据的 Pydantic Schema，用于数据验证和序列化。
"""

from pydantic import BaseModel, Field, validator
from typing import Optional
from datetime import datetime
from decimal import Decimal


class ComparisonAnalysisBase(BaseModel):
    """对比分析基础 Schema"""
    
    analysis_no: str = Field(..., max_length=50, description="分析编号（组织内唯一）")
    status: str = Field("待处理", max_length=50, description="状态")
    
    @validator("analysis_no")
    def validate_analysis_no(cls, v):
        """验证分析编号格式"""
        if not v or not v.strip():
            raise ValueError("分析编号不能为空")
        return v.strip()


class ComparisonAnalysisCreate(ComparisonAnalysisBase):
    """创建对比分析 Schema"""
    pass


class ComparisonAnalysisUpdate(BaseModel):
    """更新对比分析 Schema"""
    
    status: Optional[str] = Field(None, max_length=50, description="状态")


class ComparisonAnalysisResponse(ComparisonAnalysisBase):
    """对比分析响应 Schema"""
    
    id: int
    uuid: str
    tenant_id: Optional[int]
    created_at: datetime
    updated_at: datetime
    
    class Config:
        from_attributes = True
