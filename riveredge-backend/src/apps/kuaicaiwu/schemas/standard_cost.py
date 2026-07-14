"""
标准成本库 Schema
"""

from datetime import date, datetime
from decimal import Decimal
from typing import List, Optional

from pydantic import Field

from core.schemas.base import BaseSchema


class StandardCostBase(BaseSchema):
    target_type: str = Field(..., max_length=20, description="目标类型：material/work_center/work_station")
    target_id: int = Field(..., description="目标ID")
    target_code: Optional[str] = Field(None, max_length=50, description="目标编码")
    target_name: Optional[str] = Field(None, max_length=200, description="目标名称")
    cost_item_type: str = Field(..., max_length=20, description="成本项目类型")
    standard_value: Decimal = Field(..., ge=0, description="标准数值")
    currency: str = Field("CNY", max_length=10, description="币种")
    unit: Optional[str] = Field(None, max_length=20, description="单位")
    version: str = Field("1.0", max_length=20, description="版本号")
    effective_date: Optional[date] = Field(None, description="生效日期")
    expiry_date: Optional[date] = Field(None, description="失效日期")
    is_active: bool = Field(True, description="是否启用")
    description: Optional[str] = Field(None, description="描述")


class StandardCostCreate(StandardCostBase):
    pass


class StandardCostUpdate(BaseSchema):
    target_code: Optional[str] = Field(None, max_length=50)
    target_name: Optional[str] = Field(None, max_length=200)
    standard_value: Optional[Decimal] = Field(None, ge=0)
    currency: Optional[str] = Field(None, max_length=10)
    unit: Optional[str] = Field(None, max_length=20)
    version: Optional[str] = Field(None, max_length=20)
    effective_date: Optional[date] = None
    expiry_date: Optional[date] = None
    is_active: Optional[bool] = None
    description: Optional[str] = None


class StandardCostResponse(StandardCostBase):
    id: int = Field(..., description="主键ID")
    tenant_id: int = Field(..., description="租户ID")
    created_at: datetime = Field(..., description="创建时间")
    updated_at: datetime = Field(..., description="更新时间")
    created_by_name: Optional[str] = Field(None, description="创建人姓名")
    updated_by_name: Optional[str] = Field(None, description="更新人姓名")

    class Config:
        from_attributes = True


class StandardCostListResponse(BaseSchema):
    items: List[StandardCostResponse] = Field(..., description="标准成本列表")
    total: int = Field(..., description="总数量")
    skip: int = Field(..., description="跳过数量")
    limit: int = Field(..., description="限制数量")
