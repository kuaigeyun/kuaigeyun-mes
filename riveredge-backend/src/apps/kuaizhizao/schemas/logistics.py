"""快制造物流管理 Schema"""

from datetime import date, datetime
from decimal import Decimal
from typing import List, Optional

from pydantic import BaseModel, Field


class LogisticsCarrierBase(BaseModel):
    code: Optional[str] = None
    name: str
    carrier_type: str = "express"
    contact_name: Optional[str] = None
    contact_phone: Optional[str] = None
    service_hotline: Optional[str] = None
    settlement_method: Optional[str] = None
    supplier_id: Optional[int] = None
    remark: Optional[str] = None
    is_enabled: bool = True


class LogisticsCarrierCreate(LogisticsCarrierBase):
    pass


class LogisticsCarrierUpdate(BaseModel):
    name: Optional[str] = None
    carrier_type: Optional[str] = None
    contact_name: Optional[str] = None
    contact_phone: Optional[str] = None
    service_hotline: Optional[str] = None
    settlement_method: Optional[str] = None
    supplier_id: Optional[int] = None
    remark: Optional[str] = None
    is_enabled: Optional[bool] = None


class LogisticsCarrierResponse(LogisticsCarrierBase):
    id: int
    uuid: str
    tenant_id: int
    created_at: datetime
    updated_at: datetime

    class Config:
        from_attributes = True


class VehicleBase(BaseModel):
    plate_number: str
    vehicle_type: Optional[str] = None
    load_capacity: Optional[Decimal] = None
    volume_capacity: Optional[Decimal] = None
    ownership: str = "internal"
    carrier_id: Optional[int] = None
    status: str = "idle"
    remark: Optional[str] = None
    is_enabled: bool = True


class VehicleCreate(VehicleBase):
    pass


class VehicleUpdate(BaseModel):
    plate_number: Optional[str] = None
    vehicle_type: Optional[str] = None
    load_capacity: Optional[Decimal] = None
    volume_capacity: Optional[Decimal] = None
    ownership: Optional[str] = None
    carrier_id: Optional[int] = None
    status: Optional[str] = None
    remark: Optional[str] = None
    is_enabled: Optional[bool] = None


class VehicleResponse(VehicleBase):
    id: int
    uuid: str
    tenant_id: int
    created_at: datetime
    updated_at: datetime

    class Config:
        from_attributes = True


class DriverBase(BaseModel):
    code: Optional[str] = None
    name: str
    phone: Optional[str] = None
    license_number: Optional[str] = None
    ownership: str = "internal"
    carrier_id: Optional[int] = None
    user_id: Optional[int] = None
    default_vehicle_id: Optional[int] = None
    remark: Optional[str] = None
    is_enabled: bool = True


class DriverCreate(DriverBase):
    pass


class DriverUpdate(BaseModel):
    name: Optional[str] = None
    phone: Optional[str] = None
    license_number: Optional[str] = None
    ownership: Optional[str] = None
    carrier_id: Optional[int] = None
    user_id: Optional[int] = None
    default_vehicle_id: Optional[int] = None
    remark: Optional[str] = None
    is_enabled: Optional[bool] = None


class DriverResponse(DriverBase):
    id: int
    uuid: str
    tenant_id: int
    created_at: datetime
    updated_at: datetime

    class Config:
        from_attributes = True


class FreightOrderSourceInput(BaseModel):
    source_type: str
    source_id: int
    source_code: str
    partner_name: Optional[str] = None


class FreightOrderSourceResponse(FreightOrderSourceInput):
    id: int

    class Config:
        from_attributes = True


class FreightOrderCreate(BaseModel):
    business_direction: str
    transport_mode: str = "external_carrier"
    carrier_id: Optional[int] = None
    vehicle_id: Optional[int] = None
    driver_id: Optional[int] = None
    tracking_number: Optional[str] = None
    sender_phone: Optional[str] = None
    recipient_phone: Optional[str] = None
    origin_address: Optional[str] = None
    destination_address: Optional[str] = None
    planned_depart_at: Optional[datetime] = None
    planned_arrive_at: Optional[datetime] = None
    remark: Optional[str] = None
    sources: List[FreightOrderSourceInput] = Field(default_factory=list)


class FreightOrderUpdate(BaseModel):
    transport_mode: Optional[str] = None
    carrier_id: Optional[int] = None
    vehicle_id: Optional[int] = None
    driver_id: Optional[int] = None
    tracking_number: Optional[str] = None
    sender_phone: Optional[str] = None
    recipient_phone: Optional[str] = None
    origin_address: Optional[str] = None
    destination_address: Optional[str] = None
    planned_depart_at: Optional[datetime] = None
    planned_arrive_at: Optional[datetime] = None
    remark: Optional[str] = None


class FreightTrackingEventCreate(BaseModel):
    event_type: str
    event_time: Optional[datetime] = None
    location: Optional[str] = None
    remark: Optional[str] = None


class FreightTrackingEventResponse(FreightTrackingEventCreate):
    id: int
    freight_order_id: int
    lng: Optional[float] = None
    lat: Optional[float] = None
    operator_id: Optional[int] = None
    operator_name: Optional[str] = None

    class Config:
        from_attributes = True


class FreightOrderReceiptCreate(BaseModel):
    signed_by: str
    signed_at: Optional[datetime] = None
    receipt_result: str = "full"
    remark: Optional[str] = None
    attachments: Optional[list] = None


class FreightOrderReceiptResponse(FreightOrderReceiptCreate):
    id: int
    freight_order_id: int

    class Config:
        from_attributes = True


class FreightOrderResponse(BaseModel):
    id: int
    uuid: str
    tenant_id: int
    order_code: str
    business_direction: str
    transport_mode: str
    carrier_id: Optional[int] = None
    carrier_name: Optional[str] = None
    vehicle_id: Optional[int] = None
    vehicle_plate: Optional[str] = None
    driver_id: Optional[int] = None
    driver_name: Optional[str] = None
    driver_phone: Optional[str] = None
    tracking_number: Optional[str] = None
    sender_phone: Optional[str] = None
    recipient_phone: Optional[str] = None
    query_phone: Optional[str] = None
    origin_address: Optional[str] = None
    destination_address: Optional[str] = None
    origin_lng: Optional[float] = None
    origin_lat: Optional[float] = None
    destination_lng: Optional[float] = None
    destination_lat: Optional[float] = None
    planned_depart_at: Optional[datetime] = None
    planned_arrive_at: Optional[datetime] = None
    actual_depart_at: Optional[datetime] = None
    actual_arrive_at: Optional[datetime] = None
    status: str
    remark: Optional[str] = None
    created_at: datetime
    updated_at: datetime
    sources: List[FreightOrderSourceResponse] = Field(default_factory=list)
    tracking_events: List[FreightTrackingEventResponse] = Field(default_factory=list)
    receipt: Optional[FreightOrderReceiptResponse] = None

    class Config:
        from_attributes = True


class FreightOrderListResponse(BaseModel):
    items: List[FreightOrderResponse]
    total: int


class FreightPullCandidate(BaseModel):
    source_type: str
    source_id: int
    source_code: str
    partner_name: str
    business_direction: str
    address: Optional[str] = None
    tracking_number: Optional[str] = None
    sender_phone: Optional[str] = None
    recipient_phone: Optional[str] = None
    pullable: bool = True
    blocked_reason: Optional[str] = None


class FreightPullCandidateListResponse(BaseModel):
    items: List[FreightPullCandidate]
    total: int


class FreightBillItemInput(BaseModel):
    freight_order_id: int
    fee_type: str = "base"
    amount: Decimal
    remark: Optional[str] = None


class FreightBillCreate(BaseModel):
    carrier_id: int
    period_start: Optional[date] = None
    period_end: Optional[date] = None
    remark: Optional[str] = None
    items: List[FreightBillItemInput] = Field(default_factory=list)


class FreightBillUpdate(BaseModel):
    carrier_id: Optional[int] = None
    period_start: Optional[date] = None
    period_end: Optional[date] = None
    remark: Optional[str] = None
    items: Optional[List[FreightBillItemInput]] = None


class FreightBillReject(BaseModel):
    rejection_reason: Optional[str] = None


class FreightBillItemResponse(FreightBillItemInput):
    id: int
    freight_order_code: str
    tracking_number: Optional[str] = None

    class Config:
        from_attributes = True


class FreightBillResponse(BaseModel):
    id: int
    uuid: str
    tenant_id: int
    bill_code: str
    carrier_id: int
    carrier_name: str
    period_start: Optional[date] = None
    period_end: Optional[date] = None
    total_amount: Decimal
    status: str
    review_status: str
    reviewer_id: Optional[int] = None
    reviewer_name: Optional[str] = None
    reviewed_at: Optional[datetime] = None
    payable_id: Optional[int] = None
    payable_code: Optional[str] = None
    remark: Optional[str] = None
    created_at: datetime
    updated_at: datetime
    items: List[FreightBillItemResponse] = Field(default_factory=list)

    class Config:
        from_attributes = True


class FreightBillListResponse(BaseModel):
    items: List[FreightBillResponse]
    total: int


class PaginatedCarrierList(BaseModel):
    items: List[LogisticsCarrierResponse]
    total: int


class CarrierPresetItem(BaseModel):
    code: str
    name: str
    carrier_type: str
    service_hotline: Optional[str] = None
    exists: bool = False


class LoadCarrierPresetRequest(BaseModel):
    codes: Optional[List[str]] = Field(None, description="要加载的预设承运商编码，不传则加载全部")


class LoadCarrierPresetResponse(BaseModel):
    created: int
    skipped: int
    updated: int = 0
    message: str


class PaginatedVehicleList(BaseModel):
    items: List[VehicleResponse]
    total: int


class PaginatedDriverList(BaseModel):
    items: List[DriverResponse]
    total: int
