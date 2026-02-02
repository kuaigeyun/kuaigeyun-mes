from typing import Optional, List
from datetime import date, datetime
from decimal import Decimal
from pydantic import BaseModel, Field, ConfigDict

# --- InvoiceItem Schemas ---

class InvoiceItemBase(BaseModel):
    item_name: str = Field(..., description="货物或应税劳务名称")
    spec_model: Optional[str] = Field(None, description="规格型号")
    unit: Optional[str] = Field(None, description="单位")
    quantity: Optional[Decimal] = Field(None, description="数量")
    unit_price: Optional[Decimal] = Field(None, description="单价(不含税)")
    amount: Decimal = Field(..., description="金额(不含税)")
    tax_rate: Decimal = Field(..., description="税率")
    tax_amount: Decimal = Field(..., description="税额")

class InvoiceItemCreate(InvoiceItemBase):
    pass

class InvoiceItemUpdate(BaseModel):
    item_name: Optional[str] = None
    spec_model: Optional[str] = None
    unit: Optional[str] = None
    quantity: Optional[Decimal] = None
    unit_price: Optional[Decimal] = None
    amount: Optional[Decimal] = None
    tax_rate: Optional[Decimal] = None
    tax_amount: Optional[Decimal] = None

class InvoiceItemResponse(InvoiceItemBase):
    id: int
    invoice_id: int

    model_config = ConfigDict(from_attributes=True)


# --- Invoice Schemas ---

class InvoiceBase(BaseModel):
    invoice_number: str = Field(..., description="发票号码")
    invoice_details_code: Optional[str] = Field(None, description="发票代码")
    category: str = Field(default="IN", description="IN=进项(采购), OUT=销项(销售)")
    invoice_type: str = Field(default="VAT_SPECIAL", description="发票类型")
    
    partner_id: int = Field(..., description="往来单位ID")
    partner_name: str = Field(..., description="往来单位名称")
    partner_tax_no: Optional[str] = Field(None, description="往来单位税号")
    partner_bank_info: Optional[str] = Field(None, description="往来单位开户行及账号")
    partner_address_phone: Optional[str] = Field(None, description="往来单位地址及电话")

    amount_excluding_tax: Decimal = Field(..., description="不含税金额")
    tax_amount: Decimal = Field(..., description="税额")
    total_amount: Decimal = Field(..., description="价税合计")
    tax_rate: Decimal = Field(default=0.13, description="税率")
    
    invoice_date: date = Field(..., description="开票日期")
    received_date: Optional[date] = Field(None, description="收票/开具日期")
    
    status: str = Field(default="DRAFT", description="状态")
    verification_date: Optional[date] = Field(None, description="认证日期")
    source_document_code: Optional[str] = Field(None, description="来源单据号")
    attachment_uuid: Optional[str] = Field(None, description="附件ID")
    description: Optional[str] = Field(None, description="备注")

class InvoiceCreate(InvoiceBase):
    items: List[InvoiceItemCreate] = []

class InvoiceUpdate(BaseModel):
    invoice_number: Optional[str] = None
    invoice_details_code: Optional[str] = None
    category: Optional[str] = None
    invoice_type: Optional[str] = None
    partner_id: Optional[int] = None
    partner_name: Optional[str] = None
    partner_tax_no: Optional[str] = None
    partner_bank_info: Optional[str] = None
    partner_address_phone: Optional[str] = None
    amount_excluding_tax: Optional[Decimal] = None
    tax_amount: Optional[Decimal] = None
    total_amount: Optional[Decimal] = None
    tax_rate: Optional[Decimal] = None
    invoice_date: Optional[date] = None
    received_date: Optional[date] = None
    status: Optional[str] = None
    verification_date: Optional[date] = None
    source_document_code: Optional[str] = None
    attachment_uuid: Optional[str] = None
    description: Optional[str] = None

class InvoiceResponse(InvoiceBase):
    id: int
    tenant_id: int
    invoice_code: str
    items: List[InvoiceItemResponse] = []
    created_at: datetime
    updated_at: datetime
    created_by: Optional[int]
    updated_by: Optional[int]

    model_config = ConfigDict(from_attributes=True)

class InvoiceListResponse(BaseModel):
    items: List[InvoiceResponse]
    total: int
    skip: int
    limit: int
