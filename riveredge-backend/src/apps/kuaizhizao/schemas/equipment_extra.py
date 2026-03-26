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
    specification: Optional[str] = None
    unit: str
    safety_stock: int
    is_active: bool

    model_config = ConfigDict(from_attributes=True)
