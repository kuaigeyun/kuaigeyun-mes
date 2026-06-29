"""销售订单 OCR 智能录单 Schema"""

from typing import List, Optional

from pydantic import BaseModel, ConfigDict, Field


class SalesOrderOcrItem(BaseModel):
    model_config = ConfigDict(populate_by_name=True)

    material_code: Optional[str] = Field(None, alias="materialCode")
    material_name: Optional[str] = Field(None, alias="materialName")
    material_spec: Optional[str] = Field(None, alias="materialSpec")
    material_unit: Optional[str] = Field(None, alias="materialUnit")
    required_quantity: Optional[float] = Field(None, alias="requiredQuantity")
    unit_price: Optional[float] = Field(None, alias="unitPrice")
    tax_rate: Optional[float] = Field(None, alias="taxRate")
    delivery_date: Optional[str] = Field(None, alias="deliveryDate", description="YYYY-MM-DD")
    notes: Optional[str] = None


class SalesOrderOcrParseTextRequest(BaseModel):
    model_config = ConfigDict(populate_by_name=True)

    text: str = Field(..., min_length=1, description="自然语言订单描述或补充说明")
    context: Optional["SalesOrderOcrResult"] = Field(
        None,
        description="上一轮解析草稿，用于对话式补充与修改",
    )


class SalesOrderOcrResult(BaseModel):
    model_config = ConfigDict(populate_by_name=True)

    customer_name: Optional[str] = Field(None, alias="customerName")
    customer_contact: Optional[str] = Field(None, alias="customerContact")
    customer_phone: Optional[str] = Field(None, alias="customerPhone")
    shipping_address: Optional[str] = Field(None, alias="shippingAddress")
    order_date: Optional[str] = Field(None, alias="orderDate", description="YYYY-MM-DD")
    delivery_date: Optional[str] = Field(None, alias="deliveryDate", description="YYYY-MM-DD")
    shipping_method: Optional[str] = Field(None, alias="shippingMethod")
    payment_terms: Optional[str] = Field(None, alias="paymentTerms")
    currency_code: Optional[str] = Field(None, alias="currencyCode")
    notes: Optional[str] = None
    items: List[SalesOrderOcrItem] = Field(default_factory=list)
    confidence_notes: Optional[str] = Field(None, alias="confidenceNotes")
