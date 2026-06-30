from typing import Optional, List, Dict, Any
from datetime import datetime, date
from pydantic import BaseModel, ConfigDict

class PointInspectionRecordCreate(BaseModel):
    equipment_id: int
    inspection_date: Optional[date] = None
    inspector_id: Optional[int] = None
    inspector_name: Optional[str] = None
    results: Dict[str, Any] = {}
    has_abnormality: bool = False
    abnormality_description: Optional[str] = None
    remark: Optional[str] = None

class PointInspectionRecordResponse(BaseModel):
    id: int
    record_no: str
    equipment_id: int
    equipment_uuid: str
    inspection_date: date
    inspector_name: Optional[str] = None
    has_abnormality: bool
    abnormality_description: Optional[str] = None
    fault_report_uuid: Optional[str] = None
    created_at: datetime

    model_config = ConfigDict(from_attributes=True)

class SparePartResponse(BaseModel):
    id: int
    uuid: str
    part_no: str
    part_name: str
    spec: Optional[str] = None
    category: Optional[str] = None
    unit: str
    brand: Optional[str] = None
    supplier: Optional[str] = None
    safety_stock: int
    price: Optional[float] = None
    is_active: bool

    model_config = ConfigDict(from_attributes=True)


class SparePartCreate(BaseModel):
    part_no: str
    part_name: str
    category: Optional[str] = None
    spec: Optional[str] = None
    unit: str = "个"
    brand: Optional[str] = None
    supplier: Optional[str] = None
    safety_stock: int = 0
    price: Optional[float] = None
    associated_equipment_categories: Optional[dict] = None
    description: Optional[str] = None
    is_active: bool = True


class SparePartUpdate(BaseModel):
    part_no: Optional[str] = None
    part_name: Optional[str] = None
    category: Optional[str] = None
    spec: Optional[str] = None
    unit: Optional[str] = None
    brand: Optional[str] = None
    supplier: Optional[str] = None
    safety_stock: Optional[int] = None
    price: Optional[float] = None
    associated_equipment_categories: Optional[dict] = None
    description: Optional[str] = None
    is_active: Optional[bool] = None


class SparePartListResponse(BaseModel):
    items: List[SparePartResponse]
    total: int
    skip: int
    limit: int


class SparePartStockAdjustRequest(BaseModel):
    spare_part_id: int
    quantity: int
    operation_type: str
    warehouse_location: str
    rel_type: Optional[str] = None
    rel_id: Optional[int] = None
    remark: Optional[str] = None
