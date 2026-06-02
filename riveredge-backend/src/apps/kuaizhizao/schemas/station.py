"""工位终端 API Schema"""

from datetime import datetime
from typing import Optional
from pydantic import BaseModel, Field, ConfigDict


class StationAndonCreate(BaseModel):
    call_type: str = Field(..., description="quality/material/equipment/supervisor")
    work_order_id: Optional[int] = None
    work_order_code: Optional[str] = None
    operation_id: Optional[int] = None
    workstation_id: Optional[int] = None
    workstation_name: Optional[str] = None
    remarks: Optional[str] = None


class StationAndonResponse(BaseModel):
    model_config = ConfigDict(from_attributes=True)

    id: int
    call_type: str
    status: str
    work_order_id: Optional[int] = None
    work_order_code: Optional[str] = None
    operation_id: Optional[int] = None
    workstation_id: Optional[int] = None
    workstation_name: Optional[str] = None
    caller_id: int
    caller_name: str
    remarks: Optional[str] = None
    created_at: datetime
    acknowledged_at: Optional[datetime] = None


class StationSopAckCreate(BaseModel):
    sop_uuid: str
    work_order_id: int
    operation_id: int
    worker_id: Optional[int] = None
    worker_name: Optional[str] = None


class StationSopAckCheckResponse(BaseModel):
    acknowledged: bool
    acknowledged_at: Optional[datetime] = None


class OperationPauseRequest(BaseModel):
    reason_code: str = Field(..., description="停机原因码")
    remarks: Optional[str] = None


class OperationCompleteRequest(BaseModel):
    remarks: Optional[str] = None
