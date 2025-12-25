"""
预算预测 Schema 模块

定义预算预测数据的 Pydantic Schema，用于数据验证和序列化。
"""

from pydantic import BaseModel, Field, validator
from typing import Optional
from datetime import datetime
from decimal import Decimal


class BudgetForecastBase(BaseModel):
    """预算预测基础 Schema"""
    
    forecast_no: str = Field(..., max_length=50, description="预测编号（组织内唯一）")
    status: str = Field("待处理", max_length=50, description="状态")
    
    @validator("forecast_no")
    def validate_forecast_no(cls, v):
        """验证预测编号格式"""
        if not v or not v.strip():
            raise ValueError("预测编号不能为空")
        return v.strip()


class BudgetForecastCreate(BudgetForecastBase):
    """创建预算预测 Schema"""
    pass


class BudgetForecastUpdate(BaseModel):
    """更新预算预测 Schema"""
    
    status: Optional[str] = Field(None, max_length=50, description="状态")


class BudgetForecastResponse(BudgetForecastBase):
    """预算预测响应 Schema"""
    
    id: int
    uuid: str
    tenant_id: Optional[int]
    created_at: datetime
    updated_at: datetime
    
    class Config:
        from_attributes = True
