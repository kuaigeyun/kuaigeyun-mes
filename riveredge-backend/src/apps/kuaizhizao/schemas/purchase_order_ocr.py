"""采购订单 OCR 智能录单 Schema"""

from typing import List, Optional

from pydantic import BaseModel, ConfigDict, Field


class PurchaseOrderOcrItem(BaseModel):
    model_config = ConfigDict(populate_by_name=True)

    material_code: Optional[str] = Field(None, alias="materialCode")
    material_name: Optional[str] = Field(None, alias="materialName")
    material_spec: Optional[str] = Field(None, alias="materialSpec")
    material_unit: Optional[str] = Field(None, alias="materialUnit")
    quantity: Optional[float] = None
    unit_price: Optional[float] = Field(None, alias="unitPrice")
    tax_rate: Optional[float] = Field(None, alias="taxRate")
    delivery_date: Optional[str] = Field(None, alias="deliveryDate")
    notes: Optional[str] = None


class PurchaseOrderOcrParseTextRequest(BaseModel):
    model_config = ConfigDict(populate_by_name=True)

    text: str = Field(..., min_length=1)
    context: Optional["PurchaseOrderOcrResult"] = None


class PurchaseOrderOcrResult(BaseModel):
    model_config = ConfigDict(populate_by_name=True)

    supplier_name: Optional[str] = Field(None, alias="supplierName")
    supplier_contact: Optional[str] = Field(None, alias="supplierContact")
    supplier_phone: Optional[str] = Field(None, alias="supplierPhone")
    order_date: Optional[str] = Field(None, alias="orderDate")
    delivery_date: Optional[str] = Field(None, alias="deliveryDate")
    payment_terms: Optional[str] = Field(None, alias="paymentTerms")
    currency_code: Optional[str] = Field(None, alias="currencyCode")
    notes: Optional[str] = None
    items: List[PurchaseOrderOcrItem] = Field(default_factory=list)
    confidence_notes: Optional[str] = Field(None, alias="confidenceNotes")
