"""
销售合同 Pydantic Schemas
"""

from datetime import date, datetime
from decimal import Decimal
from typing import List, Optional
from pydantic import BaseModel, Field

from apps.kuaizhizao.schemas.sales_contract_term import SalesContractTermSnapshot


class SalesContractItemCreate(BaseModel):
    material_id: int
    material_code: str
    material_name: str
    material_spec: Optional[str] = None
    material_unit: str
    contract_quantity: Decimal
    unit_price: Decimal
    tax_rate: Optional[Decimal] = Decimal("0")
    total_amount: Decimal
    variant_attributes: Optional[dict] = None
    delivery_date: Optional[date] = None
    notes: Optional[str] = None


class SalesContractItemResponse(SalesContractItemCreate):
    id: int
    uuid: str
    tenant_id: int
    contract_id: int
    released_quantity: Decimal = Decimal("0")
    created_at: datetime
    updated_at: datetime

    class Config:
        from_attributes = True


class SalesContractMilestoneCreate(BaseModel):
    milestone_name: str = Field(..., max_length=200)
    planned_date: date
    planned_amount: Decimal = Decimal("0")
    planned_ratio: Optional[Decimal] = None
    billing_trigger: str = "milestone"
    notes: Optional[str] = None


class SalesContractMilestoneResponse(SalesContractMilestoneCreate):
    id: int
    uuid: str
    tenant_id: int
    contract_id: int
    status: str
    receivable_id: Optional[int] = None
    receivable_code: Optional[str] = None
    created_at: datetime
    updated_at: datetime

    class Config:
        from_attributes = True


class SalesContractCreate(BaseModel):
    contract_type: str = Field(default="single", description="single / framework")
    customer_id: int
    customer_name: str
    customer_contact: Optional[str] = None
    customer_phone: Optional[str] = None
    contract_date: date
    valid_from: Optional[date] = None
    valid_to: Optional[date] = None
    price_type: str = "tax_exclusive"
    currency_code: Optional[str] = "CNY"
    salesman_id: Optional[int] = None
    salesman_name: Optional[str] = None
    shipping_address: Optional[str] = None
    shipping_method: Optional[str] = None
    payment_terms: Optional[str] = None
    term_group_id: Optional[int] = None
    contract_terms: Optional[List[SalesContractTermSnapshot]] = None
    quotation_id: Optional[int] = None
    notes: Optional[str] = None
    attachments: Optional[list] = None
    items: List[SalesContractItemCreate] = Field(default_factory=list)
    milestones: List[SalesContractMilestoneCreate] = Field(default_factory=list)


class SalesContractUpdate(BaseModel):
    contract_type: Optional[str] = None
    customer_id: Optional[int] = None
    customer_name: Optional[str] = None
    customer_contact: Optional[str] = None
    customer_phone: Optional[str] = None
    contract_date: Optional[date] = None
    valid_from: Optional[date] = None
    valid_to: Optional[date] = None
    price_type: Optional[str] = None
    currency_code: Optional[str] = None
    salesman_id: Optional[int] = None
    salesman_name: Optional[str] = None
    shipping_address: Optional[str] = None
    shipping_method: Optional[str] = None
    payment_terms: Optional[str] = None
    term_group_id: Optional[int] = None
    contract_terms: Optional[List[SalesContractTermSnapshot]] = None
    notes: Optional[str] = None
    attachments: Optional[list] = None
    items: Optional[List[SalesContractItemCreate]] = None
    milestones: Optional[List[SalesContractMilestoneCreate]] = None


class SalesContractResponse(BaseModel):
    id: int
    uuid: str
    tenant_id: int
    contract_code: str
    contract_type: str
    party_type: str
    customer_id: int
    customer_name: str
    customer_contact: Optional[str] = None
    customer_phone: Optional[str] = None
    contract_date: date
    valid_from: Optional[date] = None
    valid_to: Optional[date] = None
    total_quantity: Decimal
    total_amount: Decimal
    released_quantity: Decimal
    released_amount: Decimal
    remaining_quantity: Optional[Decimal] = None
    remaining_amount: Optional[Decimal] = None
    price_type: str
    currency_code: Optional[str] = None
    status: str
    review_status: str
    reviewer_id: Optional[int] = None
    reviewer_name: Optional[str] = None
    review_time: Optional[datetime] = None
    review_remarks: Optional[str] = None
    salesman_id: Optional[int] = None
    salesman_name: Optional[str] = None
    shipping_address: Optional[str] = None
    shipping_method: Optional[str] = None
    payment_terms: Optional[str] = None
    term_group_id: Optional[int] = None
    term_group_name: Optional[str] = None
    contract_terms: Optional[List[SalesContractTermSnapshot]] = None
    quotation_id: Optional[int] = None
    quotation_code: Optional[str] = None
    root_contract_id: Optional[int] = None
    version_no: int = 1
    previous_contract_id: Optional[int] = None
    notes: Optional[str] = None
    attachments: Optional[list] = None
    is_active: bool = True
    created_by: Optional[int] = None
    updated_by: Optional[int] = None
    created_at: datetime
    updated_at: datetime
    items: Optional[List[SalesContractItemResponse]] = None
    milestones: Optional[List[SalesContractMilestoneResponse]] = None
    lifecycle: Optional[dict] = None

    class Config:
        from_attributes = True


class SalesContractListResponse(BaseModel):
    items: List[SalesContractResponse]
    total: int


class SalesContractReviewAction(BaseModel):
    review_remarks: Optional[str] = None


class SalesContractReleaseLine(BaseModel):
    item_id: int = Field(..., description="合同明细ID")
    release_quantity: Decimal = Field(..., gt=0, description="本次释放数量")


class SalesContractConvertToOrderRequest(BaseModel):
    selected_item_ids: Optional[List[int]] = Field(None, description="兼容：选中明细全量释放剩余")
    release_lines: Optional[List[SalesContractReleaseLine]] = Field(
        None, description="按行指定释放数量"
    )


class SalesContractChangeCreate(BaseModel):
    change_type: str = "amendment"
    delta_amount: Decimal = Decimal("0")
    new_valid_to: Optional[date] = None
    new_total_amount: Optional[Decimal] = None
    reason: Optional[str] = None


class SalesContractChangeResponse(BaseModel):
    id: int
    uuid: str
    tenant_id: int
    change_code: str
    contract_id: int
    contract_code: str
    change_type: str
    status: str
    review_status: str
    delta_amount: Decimal
    new_valid_to: Optional[date] = None
    new_total_amount: Optional[Decimal] = None
    reason: Optional[str] = None
    new_contract_id: Optional[int] = None
    created_at: datetime
    updated_at: datetime

    class Config:
        from_attributes = True


class SalesContractAlertItem(BaseModel):
    alert_type: str
    contract_id: int
    contract_code: str
    customer_name: str
    message: str
    severity: str = "medium"
    due_date: Optional[date] = None


class SalesContractExecutionSummary(BaseModel):
    contract_id: int
    contract_code: str
    contract_type: str
    customer_name: str
    total_amount: Decimal
    released_amount: Decimal
    remaining_amount: Decimal
    valid_to: Optional[date] = None
    status: str
