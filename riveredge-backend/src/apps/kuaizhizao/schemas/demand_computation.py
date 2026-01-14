"""
统一需求计算Schema

提供统一需求计算相关的数据验证Schema。

Author: Luigi Lu
Date: 2025-01-14
"""

from typing import List, Optional, Dict, Any
from datetime import datetime, date
from decimal import Decimal
from pydantic import BaseModel, Field, field_validator


class DemandComputationItemBase(BaseModel):
    """需求计算明细基础Schema"""
    material_id: int = Field(..., description="物料ID")
    material_code: str = Field(..., max_length=50, description="物料编码")
    material_name: str = Field(..., max_length=200, description="物料名称")
    material_spec: Optional[str] = Field(None, max_length=200, description="物料规格")
    material_unit: str = Field(..., max_length=20, description="物料单位")
    
    # 需求信息（通用）
    required_quantity: Decimal = Field(..., ge=0, description="需求数量")
    available_inventory: Decimal = Field(0, ge=0, description="可用库存")
    net_requirement: Decimal = Field(..., ge=0, description="净需求")
    
    # MRP专用字段
    gross_requirement: Optional[Decimal] = Field(None, ge=0, description="毛需求（MRP专用）")
    safety_stock: Optional[Decimal] = Field(None, ge=0, description="安全库存（MRP专用）")
    reorder_point: Optional[Decimal] = Field(None, ge=0, description="再订货点（MRP专用）")
    planned_receipt: Optional[Decimal] = Field(None, ge=0, description="计划入库（MRP专用）")
    planned_release: Optional[Decimal] = Field(None, ge=0, description="计划发放（MRP专用）")
    
    # LRP专用字段
    delivery_date: Optional[date] = Field(None, description="交货日期（LRP专用）")
    planned_production: Optional[Decimal] = Field(None, ge=0, description="计划生产（LRP专用）")
    planned_procurement: Optional[Decimal] = Field(None, ge=0, description="计划采购（LRP专用）")
    production_start_date: Optional[date] = Field(None, description="生产开始日期（LRP专用）")
    production_completion_date: Optional[date] = Field(None, description="生产完成日期（LRP专用）")
    procurement_start_date: Optional[date] = Field(None, description="采购开始日期（LRP专用）")
    procurement_completion_date: Optional[date] = Field(None, description="采购完成日期（LRP专用）")
    
    # BOM信息
    bom_id: Optional[int] = Field(None, description="使用的BOM ID")
    bom_version: Optional[str] = Field(None, max_length=20, description="BOM版本")
    
    # 建议行动
    suggested_work_order_quantity: Optional[Decimal] = Field(None, ge=0, description="建议工单数量")
    suggested_purchase_order_quantity: Optional[Decimal] = Field(None, ge=0, description="建议采购订单数量")
    
    # 详细结果
    detail_results: Optional[Dict[str, Any]] = Field(None, description="详细结果（JSON格式）")
    notes: Optional[str] = Field(None, description="备注")


class DemandComputationBase(BaseModel):
    """需求计算基础Schema"""
    demand_id: int = Field(..., description="需求ID")
    computation_type: str = Field(..., max_length=20, description="计算类型（MRP/LRP）")
    computation_params: Dict[str, Any] = Field(..., description="计算参数（JSON格式）")
    notes: Optional[str] = Field(None, description="备注")
    
    @field_validator("computation_type")
    def validate_computation_type(cls, v):
        """验证计算类型"""
        if v not in ["MRP", "LRP"]:
            raise ValueError("计算类型必须是MRP或LRP")
        return v


class DemandComputationCreate(DemandComputationBase):
    """创建需求计算Schema"""
    items: Optional[List[DemandComputationItemBase]] = Field(default_factory=list, description="计算结果明细列表")


class DemandComputationUpdate(BaseModel):
    """更新需求计算Schema"""
    computation_status: Optional[str] = Field(None, max_length=20, description="计算状态")
    computation_summary: Optional[Dict[str, Any]] = Field(None, description="计算结果汇总")
    error_message: Optional[str] = Field(None, description="错误信息")
    notes: Optional[str] = Field(None, description="备注")


class DemandComputationItemResponse(DemandComputationItemBase):
    """需求计算明细响应Schema"""
    id: int
    computation_id: int
    
    class Config:
        from_attributes = True


class DemandComputationResponse(DemandComputationBase):
    """需求计算响应Schema"""
    id: int
    uuid: str
    tenant_id: int
    computation_code: str
    demand_code: str
    demand_type: str
    business_mode: str
    computation_status: str
    computation_start_time: Optional[datetime]
    computation_end_time: Optional[datetime]
    computation_summary: Optional[Dict[str, Any]]
    error_message: Optional[str]
    created_at: datetime
    updated_at: datetime
    created_by: Optional[int]
    updated_by: Optional[int]
    items: Optional[List[DemandComputationItemResponse]] = Field(default_factory=list)
    
    class Config:
        from_attributes = True
