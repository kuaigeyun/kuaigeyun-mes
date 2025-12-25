"""
标准成本 Schema 模块

定义标准成本数据的 Pydantic Schema，用于数据验证和序列化。
按照中国财务规范：标准成本法。
"""

from pydantic import BaseModel, Field, validator
from typing import Optional
from datetime import datetime
from decimal import Decimal


class StandardCostBase(BaseModel):
    """标准成本基础 Schema"""
    
    cost_no: str = Field(..., max_length=50, description="成本编号（组织内唯一）")
    material_id: int = Field(..., description="物料ID（关联master-data）")
    material_code: str = Field(..., max_length=50, description="物料编码")
    material_name: str = Field(..., max_length=200, description="物料名称")
    version: str = Field(..., max_length=20, description="版本号（标准成本版本）")
    effective_date: datetime = Field(..., description="生效日期")
    expiry_date: Optional[datetime] = Field(None, description="失效日期")
    material_cost: Decimal = Field(Decimal("0.00"), ge=Decimal("0"), description="材料成本")
    labor_cost: Decimal = Field(Decimal("0.00"), ge=Decimal("0"), description="人工成本")
    manufacturing_cost: Decimal = Field(Decimal("0.00"), ge=Decimal("0"), description="制造费用")
    total_cost: Decimal = Field(..., ge=Decimal("0"), description="总成本")
    unit: str = Field(..., max_length=20, description="单位")
    status: str = Field("草稿", max_length=20, description="状态（草稿、已生效、已失效）")
    
    @validator("cost_no")
    def validate_cost_no(cls, v):
        """验证成本编号格式"""
        if not v or not v.strip():
            raise ValueError("成本编号不能为空")
        return v.strip()
    
    @validator("total_cost")
    def validate_total_cost(cls, v, values):
        """验证总成本（应该等于材料成本+人工成本+制造费用）"""
        if "material_cost" in values and "labor_cost" in values and "manufacturing_cost" in values:
            expected = values["material_cost"] + values["labor_cost"] + values["manufacturing_cost"]
            if abs(v - expected) > Decimal("0.01"):  # 允许0.01的误差
                raise ValueError(f"总成本应该等于材料成本+人工成本+制造费用：{expected}，实际：{v}")
        return v


class StandardCostCreate(StandardCostBase):
    """创建标准成本 Schema"""
    pass


class StandardCostUpdate(BaseModel):
    """更新标准成本 Schema"""
    
    material_id: Optional[int] = Field(None, description="物料ID")
    material_code: Optional[str] = Field(None, max_length=50, description="物料编码")
    material_name: Optional[str] = Field(None, max_length=200, description="物料名称")
    version: Optional[str] = Field(None, max_length=20, description="版本号")
    effective_date: Optional[datetime] = Field(None, description="生效日期")
    expiry_date: Optional[datetime] = Field(None, description="失效日期")
    material_cost: Optional[Decimal] = Field(None, ge=Decimal("0"), description="材料成本")
    labor_cost: Optional[Decimal] = Field(None, ge=Decimal("0"), description="人工成本")
    manufacturing_cost: Optional[Decimal] = Field(None, ge=Decimal("0"), description="制造费用")
    total_cost: Optional[Decimal] = Field(None, ge=Decimal("0"), description="总成本")
    unit: Optional[str] = Field(None, max_length=20, description="单位")
    status: Optional[str] = Field(None, max_length=20, description="状态")


class StandardCostResponse(StandardCostBase):
    """标准成本响应 Schema"""
    
    id: int
    uuid: str
    tenant_id: Optional[int]
    created_at: datetime
    updated_at: datetime
    
    class Config:
        from_attributes = True

