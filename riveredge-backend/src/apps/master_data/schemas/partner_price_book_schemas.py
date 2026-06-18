"""客户供应商价格本 Schema"""

import json
from datetime import date, datetime
from decimal import Decimal
from typing import Any, Dict, List, Optional

from pydantic import BaseModel, ConfigDict, Field, model_validator


class PartnerPriceVariantLine(BaseModel):
    """属性组合 SKU 单价"""

    variant_attributes: Dict[str, Any] = Field(..., alias="variantAttributes", description="属性组合")
    unit_price: Decimal = Field(..., alias="unitPrice", gt=0, description="该 SKU 单价")

    model_config = ConfigDict(populate_by_name=True)


class PartnerPriceBookBase(BaseModel):
    partner_id: int = Field(..., alias="partnerId", description="客户或供应商 ID")
    material_id: int = Field(..., alias="materialId", description="内部物料 ID")
    unit_price: Optional[Decimal] = Field(None, alias="unitPrice", gt=0, description="标准价（统一价）")
    price_type: Optional[str] = Field(
        "tax_inclusive",
        alias="priceType",
        description="价类：tax_inclusive 含税 / tax_exclusive 不含税",
    )
    variant_prices: Optional[List[PartnerPriceVariantLine]] = Field(
        None,
        alias="variantPrices",
        description="按属性组合的 SKU 单价",
    )
    currency_code: Optional[str] = Field(None, alias="currencyCode", description="币种")
    tax_rate: Optional[Decimal] = Field(None, alias="taxRate", description="税率（百分比）")
    unit: Optional[str] = Field(None, description="计价单位")
    effective_from: Optional[date] = Field(None, alias="effectiveFrom", description="生效起始日")
    effective_to: Optional[date] = Field(None, alias="effectiveTo", description="生效截止日")
    remark: Optional[str] = Field(None, description="备注")
    is_active: Optional[bool] = Field(True, alias="isActive", description="是否启用")
    partner_material_code: Optional[str] = Field(
        None, alias="partnerMaterialCode", description="伙伴料号（无映射时可写入物料编号映射）"
    )
    partner_material_name: Optional[str] = Field(
        None, alias="partnerMaterialName", description="伙伴品名（无映射时可写入物料编号映射）"
    )
    sync_partner_alias: bool = Field(
        True, alias="syncPartnerAlias", description="保存时是否回写物料编号映射（仅无现有映射时生效）"
    )

    model_config = ConfigDict(populate_by_name=True)

    @model_validator(mode="after")
    def validate_effective_range(self):
        if self.effective_from and self.effective_to and self.effective_from > self.effective_to:
            raise ValueError("生效起始日不能晚于截止日")
        return self

    @model_validator(mode="after")
    def validate_prices(self):
        has_standard = self.unit_price is not None and self.unit_price > 0
        has_variant = bool(self.variant_prices)
        if not has_standard and not has_variant:
            raise ValueError("标准价与属性 SKU 单价至少填写一项")
        if self.variant_prices:
            seen: set[str] = set()
            for line in self.variant_prices:
                norm = json.dumps(line.variant_attributes or {}, sort_keys=True, ensure_ascii=False)
                if norm in seen:
                    raise ValueError("属性 SKU 单价存在重复的属性组合")
                seen.add(norm)
                if not line.variant_attributes:
                    raise ValueError("属性 SKU 单价须填写至少一项属性")
        return self


class PartnerPriceBookCreate(PartnerPriceBookBase):
    pass


class PartnerPriceBookUpdate(BaseModel):
    partner_id: Optional[int] = Field(None, alias="partnerId")
    material_id: Optional[int] = Field(None, alias="materialId")
    unit_price: Optional[Decimal] = Field(None, alias="unitPrice", gt=0)
    price_type: Optional[str] = Field(None, alias="priceType")
    variant_prices: Optional[List[PartnerPriceVariantLine]] = Field(None, alias="variantPrices")
    currency_code: Optional[str] = Field(None, alias="currencyCode")
    tax_rate: Optional[Decimal] = Field(None, alias="taxRate")
    unit: Optional[str] = Field(None)
    effective_from: Optional[date] = Field(None, alias="effectiveFrom")
    effective_to: Optional[date] = Field(None, alias="effectiveTo")
    remark: Optional[str] = Field(None)
    is_active: Optional[bool] = Field(None, alias="isActive")
    partner_material_code: Optional[str] = Field(None, alias="partnerMaterialCode")
    partner_material_name: Optional[str] = Field(None, alias="partnerMaterialName")
    sync_partner_alias: Optional[bool] = Field(None, alias="syncPartnerAlias")

    model_config = ConfigDict(populate_by_name=True)

    @model_validator(mode="after")
    def validate_update_prices(self):
        if self.unit_price is None and self.variant_prices is None:
            return self
        has_standard = self.unit_price is not None and self.unit_price > 0
        has_variant = bool(self.variant_prices)
        if self.unit_price is not None or self.variant_prices is not None:
            if not has_standard and not has_variant:
                raise ValueError("标准价与属性 SKU 单价至少填写一项")
        if self.variant_prices:
            seen: set[str] = set()
            for line in self.variant_prices:
                norm = json.dumps(line.variant_attributes or {}, sort_keys=True, ensure_ascii=False)
                if norm in seen:
                    raise ValueError("属性 SKU 单价存在重复的属性组合")
                seen.add(norm)
        return self


class PartnerPriceBookResponse(BaseModel):
    id: int
    uuid: str
    tenant_id: int = Field(..., alias="tenantId")
    partner_type: str = Field(..., alias="partnerType")
    partner_id: int = Field(..., alias="partnerId")
    partner_code: Optional[str] = Field(None, alias="partnerCode")
    partner_name: Optional[str] = Field(None, alias="partnerName")
    material_id: int = Field(..., alias="materialId")
    material_code: Optional[str] = Field(None, alias="materialCode")
    material_name: Optional[str] = Field(None, alias="materialName")
    partner_material_code: Optional[str] = Field(None, alias="partnerMaterialCode")
    partner_material_name: Optional[str] = Field(None, alias="partnerMaterialName")
    unit_price: Optional[Decimal] = Field(None, alias="unitPrice")
    price_type: Optional[str] = Field("tax_inclusive", alias="priceType")
    variant_prices: Optional[List[PartnerPriceVariantLine]] = Field(None, alias="variantPrices")
    currency_code: Optional[str] = Field(None, alias="currencyCode")
    tax_rate: Optional[Decimal] = Field(None, alias="taxRate")
    unit: Optional[str] = None
    effective_from: Optional[date] = Field(None, alias="effectiveFrom")
    effective_to: Optional[date] = Field(None, alias="effectiveTo")
    remark: Optional[str] = None
    is_active: bool = Field(True, alias="isActive")
    created_at: datetime = Field(..., alias="createdAt")
    updated_at: datetime = Field(..., alias="updatedAt")

    model_config = ConfigDict(populate_by_name=True, from_attributes=True)


class PartnerPriceBookListResponse(BaseModel):
    data: List[PartnerPriceBookResponse]
    total: int

    model_config = ConfigDict(populate_by_name=True)


class PartnerPriceResolveRequest(BaseModel):
    partner_id: int = Field(..., alias="partnerId")
    material_id: Optional[int] = Field(None, alias="materialId")
    partner_material_code: Optional[str] = Field(None, alias="partnerMaterialCode")
    variant_attributes: Optional[Dict[str, Any]] = Field(None, alias="variantAttributes")
    as_of: Optional[date] = Field(None, alias="asOf")

    model_config = ConfigDict(populate_by_name=True)

    @model_validator(mode="after")
    def validate_lookup_key(self):
        if not self.material_id and not self.partner_material_code:
            raise ValueError("materialId 与 partnerMaterialCode 至少提供一个")
        return self


class PartnerPriceResolveBatchLineRequest(BaseModel):
    material_id: int = Field(..., alias="materialId")
    variant_attributes: Optional[Dict[str, Any]] = Field(None, alias="variantAttributes")

    model_config = ConfigDict(populate_by_name=True)


class PartnerPriceResolveBatchRequest(BaseModel):
    partner_id: int = Field(..., alias="partnerId")
    material_ids: Optional[List[int]] = Field(None, alias="materialIds")
    items: Optional[List[PartnerPriceResolveBatchLineRequest]] = Field(None, description="带属性组合的批量询价")
    as_of: Optional[date] = Field(None, alias="asOf")

    model_config = ConfigDict(populate_by_name=True)

    @model_validator(mode="after")
    def validate_batch_keys(self):
        if not self.material_ids and not self.items:
            raise ValueError("materialIds 与 items 至少提供一个")
        return self


class PartnerPriceResolveResponse(BaseModel):
    found: bool = False
    unit_price: Optional[Decimal] = Field(None, alias="unitPrice")
    is_variant_price: bool = Field(False, alias="isVariantPrice", description="是否命中属性 SKU 单价")
    currency_code: Optional[str] = Field(None, alias="currencyCode")
    tax_rate: Optional[Decimal] = Field(None, alias="taxRate")
    unit: Optional[str] = None
    material_id: Optional[int] = Field(None, alias="materialId")
    partner_material_code: Optional[str] = Field(None, alias="partnerMaterialCode")
    partner_material_name: Optional[str] = Field(None, alias="partnerMaterialName")
    price_book_uuid: Optional[str] = Field(None, alias="priceBookUuid")

    model_config = ConfigDict(populate_by_name=True)


class PartnerPriceResolveBatchResponse(BaseModel):
    items: List[PartnerPriceResolveResponse]

    model_config = ConfigDict(populate_by_name=True)
