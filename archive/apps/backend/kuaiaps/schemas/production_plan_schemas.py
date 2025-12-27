"""
生产计划 Schema 模块

定义生产计划相关的 Pydantic Schema，用于数据验证和序列化。
"""

from pydantic import BaseModel, Field
from typing import Optional
from datetime import datetime
from decimal import Decimal


class ProductionPlanBase(BaseModel):
    """生产计划基础 Schema"""
    
    plan_no: str = Field(..., max_length=100, description="计划编号")
    plan_name: str = Field(..., max_length=200, description="计划名称")
    plan_type: str = Field(..., max_length=50, description="计划类型")
    source_type: Optional[str] = Field(None, max_length=50, description="来源类型")
    source_id: Optional[int] = Field(None, description="来源ID")
    source_no: Optional[str] = Field(None, max_length=100, description="来源编号")
    product_id: Optional[int] = Field(None, description="产品ID")
    product_name: Optional[str] = Field(None, max_length=200, description="产品名称")
    product_code: Optional[str] = Field(None, max_length=100, description="产品编码")
    planned_quantity: Optional[Decimal] = Field(None, description="计划数量")
    planned_start_date: Optional[datetime] = Field(None, description="计划开始日期")
    planned_end_date: Optional[datetime] = Field(None, description="计划结束日期")
    actual_start_date: Optional[datetime] = Field(None, description="实际开始日期")
    actual_end_date: Optional[datetime] = Field(None, description="实际结束日期")
    priority: str = Field("中", max_length=20, description="优先级")
    optimization_target: Optional[str] = Field(None, max_length=50, description="优化目标")
    status: str = Field("草稿", max_length=50, description="状态")
    remark: Optional[str] = Field(None, description="备注")


class ProductionPlanCreate(ProductionPlanBase):
    """创建生产计划 Schema"""
    pass


class ProductionPlanUpdate(BaseModel):
    """更新生产计划 Schema"""
    
    plan_name: Optional[str] = Field(None, max_length=200, description="计划名称")
    plan_type: Optional[str] = Field(None, max_length=50, description="计划类型")
    source_type: Optional[str] = Field(None, max_length=50, description="来源类型")
    source_id: Optional[int] = Field(None, description="来源ID")
    source_no: Optional[str] = Field(None, max_length=100, description="来源编号")
    product_id: Optional[int] = Field(None, description="产品ID")
    product_name: Optional[str] = Field(None, max_length=200, description="产品名称")
    product_code: Optional[str] = Field(None, max_length=100, description="产品编码")
    planned_quantity: Optional[Decimal] = Field(None, description="计划数量")
    planned_start_date: Optional[datetime] = Field(None, description="计划开始日期")
    planned_end_date: Optional[datetime] = Field(None, description="计划结束日期")
    actual_start_date: Optional[datetime] = Field(None, description="实际开始日期")
    actual_end_date: Optional[datetime] = Field(None, description="实际结束日期")
    priority: Optional[str] = Field(None, max_length=20, description="优先级")
    optimization_target: Optional[str] = Field(None, max_length=50, description="优化目标")
    status: Optional[str] = Field(None, max_length=50, description="状态")
    remark: Optional[str] = Field(None, description="备注")


class ProductionPlanResponse(ProductionPlanBase):
    """生产计划响应 Schema"""
    
    id: int
    uuid: str
    tenant_id: Optional[int]
    created_at: str
    updated_at: str
    
    class Config:
        from_attributes = True

