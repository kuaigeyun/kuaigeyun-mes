"""返工排位策划模板 Schema。"""

from datetime import datetime
from decimal import Decimal
from typing import List, Optional

from pydantic import BaseModel, ConfigDict, Field

from core.schemas.base import UuidStrCoerceMixin


class ReworkPositionPlanTemplateItemBase(BaseModel):
    model_config = ConfigDict(from_attributes=True)

    line_no: int = 1
    sequence: int = 1
    station_name: str = Field(..., max_length=100)
    section_name: Optional[str] = Field(None, max_length=100)
    station_code: Optional[str] = Field(None, max_length=50)
    planned_headcount: Optional[Decimal] = None
    standard_minutes: Optional[Decimal] = None
    planned_qty: Optional[Decimal] = None
    owner_user_id: Optional[int] = None
    owner_user_name: Optional[str] = Field(None, max_length=100)
    remarks: Optional[str] = Field(None, max_length=500)


class ReworkPositionPlanTemplateItemCreate(ReworkPositionPlanTemplateItemBase):
    pass


class ReworkPositionPlanTemplateItemResponse(ReworkPositionPlanTemplateItemBase, UuidStrCoerceMixin):
    id: int
    template_id: int
    uuid: Optional[str] = None
    created_at: Optional[datetime] = None
    updated_at: Optional[datetime] = None


class ReworkPositionPlanTemplateCreate(BaseModel):
    model_config = ConfigDict(from_attributes=True)

    template_code: Optional[str] = Field(None, max_length=50)
    template_name: str = Field(..., max_length=200)
    product_line_code: Optional[str] = Field(None, max_length=50)
    is_active: bool = True
    remarks: Optional[str] = None
    items: Optional[List[ReworkPositionPlanTemplateItemCreate]] = None


class ReworkPositionPlanTemplateUpdate(BaseModel):
    model_config = ConfigDict(from_attributes=True)

    template_name: Optional[str] = Field(None, max_length=200)
    product_line_code: Optional[str] = Field(None, max_length=50)
    is_active: Optional[bool] = None
    remarks: Optional[str] = None
    items: Optional[List[ReworkPositionPlanTemplateItemCreate]] = Field(
        None, description="明细行（传入则全量替换）"
    )


class ReworkPositionPlanTemplateResponse(UuidStrCoerceMixin):
    model_config = ConfigDict(from_attributes=True)

    id: int
    uuid: Optional[str] = None
    template_code: str
    template_name: str
    product_line_code: Optional[str] = None
    is_active: bool = True
    total_items: int = 0
    remarks: Optional[str] = None
    created_by: Optional[int] = None
    created_by_name: Optional[str] = None
    updated_by: Optional[int] = None
    updated_by_name: Optional[str] = None
    created_at: Optional[datetime] = None
    updated_at: Optional[datetime] = None
    items: Optional[List[ReworkPositionPlanTemplateItemResponse]] = None


class ReworkPositionPlanTemplateListResponse(BaseModel):
    data: List[ReworkPositionPlanTemplateResponse] = Field(default_factory=list)
    total: int = 0
    success: bool = True
