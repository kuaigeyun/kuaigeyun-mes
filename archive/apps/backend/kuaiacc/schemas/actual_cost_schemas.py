"""
实际成本 Schema 模块

定义实际成本数据的 Pydantic Schema，用于数据验证和序列化。
按照中国财务规范：实际成本法。
"""

from pydantic import BaseModel, Field, validator
from typing import Optional
from datetime import datetime
from decimal import Decimal


class ActualCostBase(BaseModel):
    """实际成本基础 Schema"""
    
    cost_no: str = Field(..., max_length=50, description="成本编号（组织内唯一）")
    material_id: int = Field(..., description="物料ID（关联master-data）")
    material_code: str = Field(..., max_length=50, description="物料编码")
    material_name: str = Field(..., max_length=200, description="物料名称")
    work_order_id: Optional[int] = Field(None, description="工单ID（关联MES）")
    cost_period: str = Field(..., max_length=20, description="成本期间（格式：2024-01）")
    material_cost: Decimal = Field(Decimal("0.00"), ge=Decimal("0"), description="材料成本")
    labor_cost: Decimal = Field(Decimal("0.00"), ge=Decimal("0"), description="人工成本")
    manufacturing_cost: Decimal = Field(Decimal("0.00"), ge=Decimal("0"), description="制造费用")
    rework_cost: Decimal = Field(Decimal("0.00"), ge=Decimal("0"), description="返修成本")
    tooling_cost: Decimal = Field(Decimal("0.00"), ge=Decimal("0"), description="工装模具成本")
    total_cost: Decimal = Field(..., ge=Decimal("0"), description="总成本")
    unit: str = Field(..., max_length=20, description="单位")
    quantity: Decimal = Field(Decimal("1.0000"), gt=Decimal("0"), description="数量")
    unit_cost: Decimal = Field(..., ge=Decimal("0"), description="单位成本")
    status: str = Field("待核算", max_length=20, description="状态（待核算、已核算、已确认）")
    
    @validator("cost_no")
    def validate_cost_no(cls, v):
        """验证成本编号格式"""
        if not v or not v.strip():
            raise ValueError("成本编号不能为空")
        return v.strip()
    
    @validator("total_cost")
    def validate_total_cost(cls, v, values):
        """验证总成本（应该等于各项成本之和）"""
        if all(key in values for key in ["material_cost", "labor_cost", "manufacturing_cost", "rework_cost", "tooling_cost"]):
            expected = (
                values["material_cost"] + 
                values["labor_cost"] + 
                values["manufacturing_cost"] + 
                values["rework_cost"] + 
                values["tooling_cost"]
            )
            if abs(v - expected) > Decimal("0.01"):  # 允许0.01的误差
                raise ValueError(f"总成本应该等于各项成本之和：{expected}，实际：{v}")
        return v
    
    @validator("unit_cost")
    def validate_unit_cost(cls, v, values):
        """验证单位成本（应该等于总成本/数量）"""
        if "total_cost" in values and "quantity" in values:
            if values["quantity"] > 0:
                expected = values["total_cost"] / values["quantity"]
                if abs(v - expected) > Decimal("0.01"):  # 允许0.01的误差
                    raise ValueError(f"单位成本应该等于总成本/数量：{expected}，实际：{v}")
        return v


class ActualCostCreate(ActualCostBase):
    """创建实际成本 Schema"""
    pass


class ActualCostUpdate(BaseModel):
    """更新实际成本 Schema"""
    
    material_id: Optional[int] = Field(None, description="物料ID")
    material_code: Optional[str] = Field(None, max_length=50, description="物料编码")
    material_name: Optional[str] = Field(None, max_length=200, description="物料名称")
    work_order_id: Optional[int] = Field(None, description="工单ID")
    cost_period: Optional[str] = Field(None, max_length=20, description="成本期间")
    material_cost: Optional[Decimal] = Field(None, ge=Decimal("0"), description="材料成本")
    labor_cost: Optional[Decimal] = Field(None, ge=Decimal("0"), description="人工成本")
    manufacturing_cost: Optional[Decimal] = Field(None, ge=Decimal("0"), description="制造费用")
    rework_cost: Optional[Decimal] = Field(None, ge=Decimal("0"), description="返修成本")
    tooling_cost: Optional[Decimal] = Field(None, ge=Decimal("0"), description="工装模具成本")
    total_cost: Optional[Decimal] = Field(None, ge=Decimal("0"), description="总成本")
    unit: Optional[str] = Field(None, max_length=20, description="单位")
    quantity: Optional[Decimal] = Field(None, gt=Decimal("0"), description="数量")
    unit_cost: Optional[Decimal] = Field(None, ge=Decimal("0"), description="单位成本")
    status: Optional[str] = Field(None, max_length=20, description="状态")


class ActualCostResponse(ActualCostBase):
    """实际成本响应 Schema"""
    
    id: int
    uuid: str
    tenant_id: Optional[int]
    created_at: datetime
    updated_at: datetime
    
    class Config:
        from_attributes = True

