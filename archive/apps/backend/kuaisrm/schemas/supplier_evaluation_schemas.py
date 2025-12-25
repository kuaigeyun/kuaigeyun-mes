"""
供应商评估 Schema 模块

定义供应商评估相关的 Pydantic Schema，用于数据验证和序列化。
"""

from pydantic import BaseModel, Field
from typing import Optional, Dict, Any
from datetime import datetime
from decimal import Decimal


class SupplierEvaluationBase(BaseModel):
    """供应商评估基础 Schema"""
    
    evaluation_no: str = Field(..., max_length=50, description="评估编号")
    supplier_id: int = Field(..., description="供应商ID")
    evaluation_period: str = Field(..., max_length=20, description="评估周期")
    evaluation_date: datetime = Field(..., description="评估日期")
    quality_score: Decimal = Field(0, ge=0, le=100, description="质量评分")
    delivery_score: Decimal = Field(0, ge=0, le=100, description="交期评分")
    price_score: Decimal = Field(0, ge=0, le=100, description="价格评分")
    service_score: Decimal = Field(0, ge=0, le=100, description="服务评分")
    total_score: Decimal = Field(0, ge=0, le=100, description="综合评分")
    evaluation_level: Optional[str] = Field(None, max_length=10, description="评估等级")
    evaluation_result: Optional[Dict[str, Any]] = Field(None, description="评估结果")
    evaluator_id: Optional[int] = Field(None, description="评估人ID")


class SupplierEvaluationCreate(SupplierEvaluationBase):
    """创建供应商评估 Schema"""
    pass


class SupplierEvaluationUpdate(BaseModel):
    """更新供应商评估 Schema"""
    
    evaluation_period: Optional[str] = Field(None, max_length=20, description="评估周期")
    evaluation_date: Optional[datetime] = Field(None, description="评估日期")
    quality_score: Optional[Decimal] = Field(None, ge=0, le=100, description="质量评分")
    delivery_score: Optional[Decimal] = Field(None, ge=0, le=100, description="交期评分")
    price_score: Optional[Decimal] = Field(None, ge=0, le=100, description="价格评分")
    service_score: Optional[Decimal] = Field(None, ge=0, le=100, description="服务评分")
    total_score: Optional[Decimal] = Field(None, ge=0, le=100, description="综合评分")
    evaluation_level: Optional[str] = Field(None, max_length=10, description="评估等级")
    evaluation_result: Optional[Dict[str, Any]] = Field(None, description="评估结果")
    evaluator_id: Optional[int] = Field(None, description="评估人ID")


class SupplierEvaluationResponse(SupplierEvaluationBase):
    """供应商评估响应 Schema"""
    
    id: int
    uuid: str
    tenant_id: Optional[int]
    created_at: datetime
    updated_at: datetime
    
    class Config:
        from_attributes = True
