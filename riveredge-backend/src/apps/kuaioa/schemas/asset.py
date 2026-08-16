"""固定资产 schemas。"""

from decimal import Decimal
from typing import Optional

from pydantic import BaseModel, Field


class AssetPurchaseCreate(BaseModel):
    title: str = Field(..., max_length=200)
    asset_category: Optional[str] = None
    quantity: int = 1
    estimated_amount: Optional[Decimal] = None
    currency: str = "CNY"
    department_name: Optional[str] = None
    purpose: Optional[str] = None
    applicant_id: Optional[int] = None
    applicant_name: Optional[str] = None


class AssetPurchaseUpdate(BaseModel):
    title: Optional[str] = Field(None, max_length=200)
    asset_category: Optional[str] = None
    quantity: Optional[int] = None
    estimated_amount: Optional[Decimal] = None
    currency: Optional[str] = None
    department_name: Optional[str] = None
    purpose: Optional[str] = None


class AssetCreate(BaseModel):
    asset_name: str = Field(..., max_length=200)
    asset_category: Optional[str] = None
    purchase_id: Optional[int] = None
    purchase_amount: Optional[Decimal] = None
    purchase_date: Optional[str] = None
    custodian_id: Optional[int] = None
    custodian_name: Optional[str] = None
    department_name: Optional[str] = None
    location: Optional[str] = None
    notes: Optional[str] = None


class AssetUpdate(BaseModel):
    asset_name: Optional[str] = Field(None, max_length=200)
    asset_category: Optional[str] = None
    purchase_amount: Optional[Decimal] = None
    purchase_date: Optional[str] = None
    custodian_id: Optional[int] = None
    custodian_name: Optional[str] = None
    department_name: Optional[str] = None
    location: Optional[str] = None
    status: Optional[str] = None
    notes: Optional[str] = None
