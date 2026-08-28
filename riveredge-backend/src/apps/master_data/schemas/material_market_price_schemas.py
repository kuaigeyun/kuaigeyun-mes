"""原料行情 API schema。"""

from __future__ import annotations

from datetime import date, datetime
from decimal import Decimal
from typing import Any, Dict, List, Literal, Optional

from pydantic import BaseModel, ConfigDict, Field


PriceType = Literal["tax_inclusive", "tax_exclusive"]


class MaterialMarketPriceBase(BaseModel):
    model_config = ConfigDict(populate_by_name=True)

    code: str = Field(..., min_length=1, max_length=50, description="行情品种编码")
    name: str = Field(..., min_length=1, max_length=100, description="行情品种名称")
    price_date: date = Field(..., alias="priceDate", description="行情日")
    unit_price: Decimal = Field(..., alias="unitPrice", gt=0, description="行情单价")
    price_type: PriceType = Field("tax_inclusive", alias="priceType", description="价类")


class MaterialMarketPriceCreate(MaterialMarketPriceBase):
    pass


class MaterialMarketPriceUpdate(BaseModel):
    model_config = ConfigDict(populate_by_name=True)

    name: Optional[str] = Field(None, min_length=1, max_length=100)
    unit_price: Optional[Decimal] = Field(None, alias="unitPrice", ge=0)
    price_type: Optional[PriceType] = Field(None, alias="priceType")


class MaterialMarketPriceResponse(BaseModel):
    """列表可含当日只读沿用行：未落库时 id/uuid 为空。"""

    model_config = ConfigDict(from_attributes=True, populate_by_name=True)

    id: Optional[int] = None
    uuid: Optional[str] = None
    code: str
    name: str
    price_date: date = Field(..., alias="priceDate")
    unit_price: Decimal = Field(..., alias="unitPrice")
    price_type: PriceType = Field(..., alias="priceType")
    created_by: Optional[int] = Field(None, alias="createdBy")
    created_by_name: Optional[str] = Field(None, alias="createdByName")
    updated_by: Optional[int] = Field(None, alias="updatedBy")
    updated_by_name: Optional[str] = Field(None, alias="updatedByName")
    created_at: Optional[datetime] = Field(None, alias="createdAt")
    updated_at: Optional[datetime] = Field(None, alias="updatedAt")


class MaterialMarketPriceListResponse(BaseModel):
    items: List[MaterialMarketPriceResponse]
    total: int


class MaterialMarketInstrument(BaseModel):
    model_config = ConfigDict(populate_by_name=True)

    code: str
    name: str


class MaterialMarketInstrumentListResponse(BaseModel):
    items: List[MaterialMarketInstrument]


class MaterialMarketPricePresetItem(BaseModel):
    model_config = ConfigDict(populate_by_name=True)

    code: str
    name: str
    exists: bool


class LoadMarketPricePresetRequest(BaseModel):
    codes: Optional[List[str]] = None


class LoadMarketPricePresetResponse(BaseModel):
    model_config = ConfigDict(populate_by_name=True)

    created: int
    skipped: int
    price_date: date = Field(..., alias="priceDate")
    message: str


class MaterialMarketSaleResolveResponse(BaseModel):
    model_config = ConfigDict(populate_by_name=True)

    found: bool
    sale_price_method: str = Field(..., alias="salePriceMethod")
    unit_price: Decimal = Field(..., alias="unitPrice", description="不含税建议售价")
    tax_rate: Decimal = Field(..., alias="taxRate")
    snapshot: Optional[Dict[str, Any]] = None
    message: Optional[str] = None


class MaterialMarketPriceTrendPoint(BaseModel):
    model_config = ConfigDict(populate_by_name=True)

    price_date: date = Field(..., alias="priceDate")
    unit_price: Decimal = Field(..., alias="unitPrice")
    price_type: PriceType = Field(..., alias="priceType")


class MaterialMarketPriceTrendResponse(BaseModel):
    model_config = ConfigDict(populate_by_name=True)

    code: str
    name: str
    start_date: date = Field(..., alias="startDate")
    end_date: date = Field(..., alias="endDate")
    points: List[MaterialMarketPriceTrendPoint]
    average_price: Decimal = Field(..., alias="averagePrice")
    min_price: Decimal = Field(..., alias="minPrice")
    max_price: Decimal = Field(..., alias="maxPrice")
