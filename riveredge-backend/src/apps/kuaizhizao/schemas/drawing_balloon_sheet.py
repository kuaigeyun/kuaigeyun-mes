"""图纸气泡标注 schemas"""

from __future__ import annotations

from datetime import datetime
from typing import Any, List, Optional

from pydantic import Field

from core.schemas.base import BaseSchema


class DrawingBalloonSheetLineBase(BaseSchema):
    sequence: int = 1
    balloon_no: Optional[str] = None
    characteristic_name: str
    nominal_value: Optional[float] = None
    upper_tolerance: Optional[float] = None
    lower_tolerance: Optional[float] = None
    unit: Optional[str] = None
    remarks: Optional[str] = None


class DrawingBalloonSheetLineCreate(DrawingBalloonSheetLineBase):
    pass


class DrawingBalloonSheetLineResponse(DrawingBalloonSheetLineBase):
    id: int
    sheet_id: int
    uuid: str
    tenant_id: int

    class Config:
        from_attributes = True


class DrawingBalloonSheetBase(BaseSchema):
    sheet_code: Optional[str] = None
    title: str
    status: str = "draft"
    material_id: Optional[int] = None
    material_code: Optional[str] = None
    material_name: Optional[str] = None
    drawing_no: Optional[str] = None
    drawing_revision: Optional[str] = None
    work_order_id: Optional[int] = None
    work_order_code: Optional[str] = None
    drawing_file_url: Optional[str] = None
    balloon_candidates: Optional[List[Any]] = None
    linked_fai_order_id: Optional[int] = None
    remarks: Optional[str] = None


class DrawingBalloonSheetCreate(DrawingBalloonSheetBase):
    pass


class DrawingBalloonSheetUpdate(BaseSchema):
    title: Optional[str] = None
    status: Optional[str] = None
    material_id: Optional[int] = None
    material_code: Optional[str] = None
    material_name: Optional[str] = None
    drawing_no: Optional[str] = None
    drawing_revision: Optional[str] = None
    work_order_id: Optional[int] = None
    work_order_code: Optional[str] = None
    drawing_file_url: Optional[str] = None
    balloon_candidates: Optional[List[Any]] = None
    linked_fai_order_id: Optional[int] = None
    remarks: Optional[str] = None
    sheet_code: Optional[str] = None


class DrawingBalloonSheetResponse(DrawingBalloonSheetBase):
    id: int
    uuid: str
    tenant_id: int
    created_by: Optional[int] = None
    created_by_name: Optional[str] = None
    updated_by: Optional[int] = None
    updated_by_name: Optional[str] = None
    created_at: datetime
    updated_at: datetime
    lines: Optional[List[DrawingBalloonSheetLineResponse]] = None

    class Config:
        from_attributes = True


class DrawingBalloonSheetListResponse(BaseSchema):
    items: List[DrawingBalloonSheetResponse]
    total: int


class DrawingBalloonConfirmLinesRequest(BaseSchema):
    candidates: List[Any] = Field(default_factory=list)
    replace_existing: bool = True


class FaiImportFromBalloonSheetRequest(BaseSchema):
    sheet_id: int
    replace_existing: bool = True
