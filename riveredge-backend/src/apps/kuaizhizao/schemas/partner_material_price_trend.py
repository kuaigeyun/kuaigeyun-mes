"""客商物料价格趋势 Schema。"""

from __future__ import annotations

from datetime import date
from decimal import Decimal
from typing import List, Literal, Optional

from pydantic import Field

from core.schemas.base import BaseSchema


class PartnerMaterialPriceTrendItem(BaseSchema):
    """单笔历史成交价明细。"""

    order_id: int
    order_code: str
    order_date: date
    partner_id: int
    partner_name: str
    unit_price: Decimal
    quantity: Optional[Decimal] = None


class PartnerMaterialPriceTrendPoint(BaseSchema):
    """折线图数据点。"""

    date: date
    price: Decimal
    order_code: str


class PartnerMaterialPriceTrendResponse(BaseSchema):
    """客商物料价格趋势响应。"""

    side: Literal["sales", "purchase"]
    material_id: int
    partner_id: int
    partner_name: Optional[str] = None
    history_items: List[PartnerMaterialPriceTrendItem] = Field(default_factory=list)
    trend_points: List[PartnerMaterialPriceTrendPoint] = Field(default_factory=list)
    average_price: Decimal = Field(default=Decimal(0))
    min_price: Decimal = Field(default=Decimal(0))
    max_price: Decimal = Field(default=Decimal(0))
