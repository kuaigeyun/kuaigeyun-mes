"""FAI 图纸气泡 OCR 结构化结果。"""

from __future__ import annotations

from typing import List, Optional

from pydantic import Field

from core.schemas.base import BaseSchema


class FaiBalloonCandidate(BaseSchema):
    id: Optional[str] = None
    balloon_no: Optional[str] = None
    characteristic_name: Optional[str] = None
    nominal_value: Optional[float] = None
    upper_tolerance: Optional[float] = None
    lower_tolerance: Optional[float] = None
    unit: Optional[str] = None
    remarks: Optional[str] = None
    # 相对图纸宽高 0~1（左上为原点）
    x: Optional[float] = Field(None, ge=0, le=1)
    y: Optional[float] = Field(None, ge=0, le=1)
    anchor_x: Optional[float] = Field(None, ge=0, le=1)
    anchor_y: Optional[float] = Field(None, ge=0, le=1)
    source: Optional[str] = None


class FaiBalloonOcrResult(BaseSchema):
    candidates: List[FaiBalloonCandidate] = Field(default_factory=list)
    confidence_notes: Optional[str] = None
