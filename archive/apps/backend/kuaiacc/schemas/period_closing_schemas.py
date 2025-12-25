"""
期末结账 Schema 模块

定义期末结账数据的 Pydantic Schema，用于数据验证和序列化。
按照中国财务规范设计。
"""

from pydantic import BaseModel, Field, validator
from typing import Optional, Dict, Any
from datetime import datetime


class PeriodClosingBase(BaseModel):
    """期末结账基础 Schema"""
    
    closing_no: str = Field(..., max_length=50, description="结账编号（组织内唯一）")
    closing_type: str = Field(..., max_length=20, description="结账类型（月结、年结）")
    closing_period: str = Field(..., max_length=20, description="结账期间（格式：2024-01、2024）")
    closing_date: datetime = Field(..., description="结账日期")
    status: str = Field("待结账", max_length=20, description="状态（待结账、结账中、已结账、已反结账）")
    check_items: Optional[Dict[str, Any]] = Field(None, description="检查项（凭证是否全部过账、是否借贷平衡、是否有未审核凭证等）")
    check_result: Optional[Dict[str, Any]] = Field(None, description="检查结果")
    closed_by: Optional[int] = Field(None, description="结账人ID")
    closed_at: Optional[datetime] = Field(None, description="结账时间")
    
    @validator("closing_no")
    def validate_closing_no(cls, v):
        """验证结账编号格式"""
        if not v or not v.strip():
            raise ValueError("结账编号不能为空")
        return v.strip()
    
    @validator("closing_type")
    def validate_closing_type(cls, v):
        """验证结账类型"""
        if v not in ["月结", "年结"]:
            raise ValueError("结账类型必须是'月结'或'年结'")
        return v


class PeriodClosingCreate(PeriodClosingBase):
    """创建期末结账 Schema"""
    pass


class PeriodClosingUpdate(BaseModel):
    """更新期末结账 Schema"""
    
    closing_date: Optional[datetime] = Field(None, description="结账日期")
    status: Optional[str] = Field(None, max_length=20, description="状态")
    check_items: Optional[Dict[str, Any]] = Field(None, description="检查项")
    check_result: Optional[Dict[str, Any]] = Field(None, description="检查结果")
    closed_by: Optional[int] = Field(None, description="结账人ID")
    closed_at: Optional[datetime] = Field(None, description="结账时间")


class PeriodClosingResponse(PeriodClosingBase):
    """期末结账响应 Schema"""
    
    id: int
    uuid: str
    tenant_id: Optional[int]
    created_at: datetime
    updated_at: datetime
    
    class Config:
        from_attributes = True

