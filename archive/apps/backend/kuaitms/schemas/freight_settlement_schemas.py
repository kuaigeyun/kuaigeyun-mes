"""
运费结算 Schema 模块

定义运费结算相关的 Pydantic Schema，用于数据验证和序列化。
"""

from pydantic import BaseModel, Field
from typing import Optional, Any
from datetime import datetime
from decimal import Decimal


class FreightSettlementBase(BaseModel):
    """运费结算基础 Schema"""
    
    settlement_no: str = Field(..., max_length=100, description="结算单编号")
    execution_id: Optional[int] = Field(None, description="运输执行ID")
    execution_uuid: Optional[str] = Field(None, max_length=36, description="运输执行UUID")
    vehicle_id: Optional[int] = Field(None, description="车辆ID")
    vehicle_no: Optional[str] = Field(None, max_length=50, description="车牌号")
    driver_id: Optional[int] = Field(None, description="司机ID")
    driver_name: Optional[str] = Field(None, max_length=100, description="司机姓名")
    distance: Optional[Decimal] = Field(None, description="运输距离")
    freight_amount: Optional[Decimal] = Field(None, description="运费金额")
    calculation_rule: Optional[Any] = Field(None, description="计算规则")
    settlement_date: Optional[datetime] = Field(None, description="结算日期")
    settlement_status: Optional[str] = Field("待结算", max_length=50, description="结算状态")
    remark: Optional[str] = Field(None, description="备注")


class FreightSettlementCreate(FreightSettlementBase):
    """创建运费结算 Schema"""
    pass


class FreightSettlementUpdate(BaseModel):
    """更新运费结算 Schema"""
    
    distance: Optional[Decimal] = Field(None, description="运输距离")
    freight_amount: Optional[Decimal] = Field(None, description="运费金额")
    calculation_rule: Optional[Any] = Field(None, description="计算规则")
    settlement_date: Optional[datetime] = Field(None, description="结算日期")
    settlement_status: Optional[str] = Field(None, max_length=50, description="结算状态")
    status: Optional[str] = Field(None, max_length=50, description="状态")
    remark: Optional[str] = Field(None, description="备注")


class FreightSettlementResponse(FreightSettlementBase):
    """运费结算响应 Schema"""
    
    id: int
    uuid: str
    tenant_id: Optional[int]
    status: str
    created_at: datetime
    updated_at: datetime
    
    class Config:
        from_attributes = True

