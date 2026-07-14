"""
二期 Schema：需求 / 设计评审 / FMEA

Author: RiverEdge Team
Date: 2026-05-28
"""

from datetime import date, datetime
from typing import Any, List, Optional

from pydantic import BaseModel, ConfigDict, Field


class RdRequirementCreate(BaseModel):
    project_id: Optional[int] = None
    requirement_code: Optional[str] = None
    title: str
    description: Optional[str] = None
    priority: str = "normal"
    status: str = "DRAFT"
    source_type: Optional[str] = None
    source_id: Optional[int] = None


class RdRequirementUpdate(BaseModel):
    project_id: Optional[int] = None
    title: Optional[str] = None
    description: Optional[str] = None
    priority: Optional[str] = None
    status: Optional[str] = None
    source_type: Optional[str] = None
    source_id: Optional[int] = None


class RdRequirementResponse(BaseModel):
    model_config = ConfigDict(from_attributes=True)

    id: int
    uuid: str
    tenant_id: int
    project_id: Optional[int] = None
    requirement_code: Optional[str] = None
    title: str
    description: Optional[str] = None
    priority: str
    status: str
    source_type: Optional[str] = None
    source_id: Optional[int] = None
    created_at: datetime
    updated_at: datetime
    created_by_name: Optional[str] = None
    updated_by_name: Optional[str] = None


class RdDesignReviewCreate(BaseModel):
    project_id: Optional[int] = None
    review_code: Optional[str] = None
    title: str
    review_type: Optional[str] = None
    status: str = "PLANNED"
    material_id: Optional[int] = None
    material_code: Optional[str] = None
    material_name: Optional[str] = None
    reviewer_id: Optional[int] = None
    reviewer_name: Optional[str] = None
    review_date: Optional[date] = None
    review_notes: Optional[str] = None


class RdDesignReviewUpdate(BaseModel):
    project_id: Optional[int] = None
    title: Optional[str] = None
    review_type: Optional[str] = None
    status: Optional[str] = None
    material_id: Optional[int] = None
    material_code: Optional[str] = None
    material_name: Optional[str] = None
    reviewer_id: Optional[int] = None
    reviewer_name: Optional[str] = None
    review_date: Optional[date] = None
    review_notes: Optional[str] = None


class RdDesignReviewResponse(BaseModel):
    model_config = ConfigDict(from_attributes=True)

    id: int
    uuid: str
    tenant_id: int
    project_id: Optional[int] = None
    review_code: Optional[str] = None
    title: str
    review_type: Optional[str] = None
    status: str
    material_id: Optional[int] = None
    material_code: Optional[str] = None
    material_name: Optional[str] = None
    reviewer_id: Optional[int] = None
    reviewer_name: Optional[str] = None
    review_date: Optional[date] = None
    review_notes: Optional[str] = None
    created_at: datetime
    updated_at: datetime
    created_by_name: Optional[str] = None
    updated_by_name: Optional[str] = None


class RdFmeaRecordCreate(BaseModel):
    project_id: Optional[int] = None
    fmea_code: Optional[str] = None
    title: str
    fmea_type: str = "DFMEA"
    status: str = "DRAFT"
    material_id: Optional[int] = None
    material_code: Optional[str] = None
    material_name: Optional[str] = None
    risk_items: Optional[List[Any]] = None


class RdFmeaRecordUpdate(BaseModel):
    project_id: Optional[int] = None
    title: Optional[str] = None
    fmea_type: Optional[str] = None
    status: Optional[str] = None
    material_id: Optional[int] = None
    material_code: Optional[str] = None
    material_name: Optional[str] = None
    risk_items: Optional[List[Any]] = None


class RdFmeaRecordResponse(BaseModel):
    model_config = ConfigDict(from_attributes=True)

    id: int
    uuid: str
    tenant_id: int
    project_id: Optional[int] = None
    fmea_code: Optional[str] = None
    title: str
    fmea_type: str
    status: str
    material_id: Optional[int] = None
    material_code: Optional[str] = None
    material_name: Optional[str] = None
    risk_items: Optional[Any] = None
    created_at: datetime
    updated_at: datetime
    created_by_name: Optional[str] = None
    updated_by_name: Optional[str] = None
