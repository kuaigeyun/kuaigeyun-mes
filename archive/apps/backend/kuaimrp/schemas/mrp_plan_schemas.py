"""
MRP计划 Schema 模块

定义MRP计划相关的 Pydantic Schema，用于数据验证和序列化。
"""

from pydantic import BaseModel, Field
from typing import Optional, Dict, Any
from datetime import datetime


class MRPPlanBase(BaseModel):
    """MRP计划基础 Schema"""
    
    plan_no: str = Field(..., max_length=50, description="计划编号")
    plan_name: str = Field(..., max_length=200, description="计划名称")
    plan_type: str = Field("MRP", max_length=20, description="计划类型（MRP、LRP）")
    plan_date: datetime = Field(..., description="计划日期")
    start_date: Optional[datetime] = Field(None, description="计划开始日期")
    end_date: Optional[datetime] = Field(None, description="计划结束日期")
    calculation_params: Optional[Dict[str, Any]] = Field(None, description="计算参数")
    owner_id: Optional[int] = Field(None, description="负责人ID")


class MRPPlanCreate(MRPPlanBase):
    """创建MRP计划 Schema"""
    pass


class MRPPlanUpdate(BaseModel):
    """更新MRP计划 Schema"""
    
    plan_name: Optional[str] = Field(None, max_length=200, description="计划名称")
    plan_type: Optional[str] = Field(None, max_length=20, description="计划类型")
    plan_date: Optional[datetime] = Field(None, description="计划日期")
    status: Optional[str] = Field(None, max_length=50, description="计划状态")
    start_date: Optional[datetime] = Field(None, description="计划开始日期")
    end_date: Optional[datetime] = Field(None, description="计划结束日期")
    calculation_params: Optional[Dict[str, Any]] = Field(None, description="计算参数")
    calculation_result: Optional[Dict[str, Any]] = Field(None, description="计算结果统计")
    owner_id: Optional[int] = Field(None, description="负责人ID")


class MRPPlanResponse(MRPPlanBase):
    """MRP计划响应 Schema"""
    
    id: int
    uuid: str
    tenant_id: Optional[int]
    status: str
    calculation_result: Optional[Dict[str, Any]] = None
    created_at: datetime
    updated_at: datetime
    
    class Config:
        from_attributes = True
