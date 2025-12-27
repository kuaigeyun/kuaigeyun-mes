"""
供应链风险 Schema 模块

定义供应链风险相关的 Pydantic Schema，用于数据验证和序列化。
"""

from pydantic import BaseModel, Field
from typing import Optional, Any
from decimal import Decimal


class SupplyChainRiskBase(BaseModel):
    """供应链风险基础 Schema"""
    
    risk_no: str = Field(..., max_length=100, description="风险编号")
    risk_name: str = Field(..., max_length=200, description="风险名称")
    risk_type: str = Field(..., max_length=50, description="风险类型")
    risk_category: Optional[str] = Field(None, max_length=50, description="风险分类")
    supplier_id: Optional[int] = Field(None, description="供应商ID")
    supplier_name: Optional[str] = Field(None, max_length=200, description="供应商名称")
    risk_level: str = Field("中", max_length=20, description="风险等级")
    risk_probability: Optional[Decimal] = Field(None, description="风险概率")
    risk_impact: Optional[str] = Field(None, max_length=20, description="风险影响")
    risk_description: Optional[str] = Field(None, description="风险描述")
    warning_status: str = Field("未预警", max_length=50, description="预警状态")
    contingency_plan: Optional[Any] = Field(None, description="应急预案")
    status: str = Field("待评估", max_length=50, description="状态")
    remark: Optional[str] = Field(None, description="备注")


class SupplyChainRiskCreate(SupplyChainRiskBase):
    """创建供应链风险 Schema"""
    pass


class SupplyChainRiskUpdate(BaseModel):
    """更新供应链风险 Schema"""
    
    risk_name: Optional[str] = Field(None, max_length=200, description="风险名称")
    risk_type: Optional[str] = Field(None, max_length=50, description="风险类型")
    risk_category: Optional[str] = Field(None, max_length=50, description="风险分类")
    supplier_id: Optional[int] = Field(None, description="供应商ID")
    supplier_name: Optional[str] = Field(None, max_length=200, description="供应商名称")
    risk_level: Optional[str] = Field(None, max_length=20, description="风险等级")
    risk_probability: Optional[Decimal] = Field(None, description="风险概率")
    risk_impact: Optional[str] = Field(None, max_length=20, description="风险影响")
    risk_description: Optional[str] = Field(None, description="风险描述")
    warning_status: Optional[str] = Field(None, max_length=50, description="预警状态")
    contingency_plan: Optional[Any] = Field(None, description="应急预案")
    status: Optional[str] = Field(None, max_length=50, description="状态")
    remark: Optional[str] = Field(None, description="备注")


class SupplyChainRiskResponse(SupplyChainRiskBase):
    """供应链风险响应 Schema"""
    
    id: int
    uuid: str
    tenant_id: Optional[int]
    created_at: str
    updated_at: str
    
    class Config:
        from_attributes = True

