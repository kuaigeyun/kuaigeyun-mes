"""物料单位与换算 API schema。"""

from __future__ import annotations

from datetime import datetime
from typing import List, Optional

from pydantic import BaseModel, ConfigDict, Field


class MaterialUnitBase(BaseModel):
    code: str = Field(..., min_length=1, max_length=50, description="单位编码")
    name: str = Field(..., min_length=1, max_length=100, description="单位名称")
    is_active: bool = Field(True, description="是否启用")
    sort_order: int = Field(0, description="排序")
    description: Optional[str] = Field(None, max_length=500)


class MaterialUnitCreate(MaterialUnitBase):
    pass


class MaterialUnitUpdate(BaseModel):
    name: Optional[str] = Field(None, min_length=1, max_length=100)
    is_active: Optional[bool] = None
    sort_order: Optional[int] = None
    description: Optional[str] = Field(None, max_length=500)


class MaterialUnitResponse(MaterialUnitBase):
    model_config = ConfigDict(from_attributes=True)

    id: int
    uuid: str
    is_system: bool = False
    created_by: Optional[int] = None
    created_by_name: Optional[str] = None
    updated_by: Optional[int] = None
    updated_by_name: Optional[str] = None
    created_at: Optional[datetime] = None
    updated_at: Optional[datetime] = None


class MaterialUnitListResponse(BaseModel):
    items: List[MaterialUnitResponse]
    total: int


class MaterialUnitConversionBase(BaseModel):
    from_unit_code: str = Field(..., min_length=1, max_length=50)
    to_unit_code: str = Field(..., min_length=1, max_length=50)
    numerator: int = Field(..., gt=0, description="分子")
    denominator: int = Field(..., gt=0, description="分母")
    is_active: bool = True
    description: Optional[str] = Field(None, max_length=500)


class MaterialUnitConversionCreate(MaterialUnitConversionBase):
    pass


class MaterialUnitConversionUpdate(BaseModel):
    numerator: Optional[int] = Field(None, gt=0)
    denominator: Optional[int] = Field(None, gt=0)
    is_active: Optional[bool] = None
    description: Optional[str] = Field(None, max_length=500)


class MaterialUnitConversionResponse(MaterialUnitConversionBase):
    model_config = ConfigDict(from_attributes=True)

    id: int
    uuid: str
    is_system: bool = False
    created_by: Optional[int] = None
    created_by_name: Optional[str] = None
    updated_by: Optional[int] = None
    updated_by_name: Optional[str] = None
    created_at: Optional[datetime] = None
    updated_at: Optional[datetime] = None


class MaterialUnitConversionListResponse(BaseModel):
    items: List[MaterialUnitConversionResponse]
    total: int


class MaterialUnitConversionResolveResponse(BaseModel):
    """相对物料基本单位：1 aux = (numerator/denominator) × base。"""

    found: bool
    from_unit_code: str
    to_unit_code: str
    numerator: Optional[int] = None
    denominator: Optional[int] = None
    # 料级公式方向：aux=from 时填入物料 units 行的分子分母
    material_numerator: Optional[int] = None
    material_denominator: Optional[int] = None


class MaterialUnitEnsurePresetsResponse(BaseModel):
    units_created: int = 0
    conversions_created: int = 0
    units_backfilled: int = 0
