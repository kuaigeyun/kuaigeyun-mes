"""
二期 API：需求 / 设计评审 / FMEA

Author: RiverEdge Team
Date: 2026-05-28
"""

import uuid
from typing import Optional

from fastapi import APIRouter, Depends, HTTPException, Path, Query, status
from loguru import logger

from apps.kuaiplm.schemas.phase2 import (
    RdDesignReviewCreate,
    RdDesignReviewResponse,
    RdDesignReviewUpdate,
    RdFmeaRecordCreate,
    RdFmeaRecordResponse,
    RdFmeaRecordUpdate,
    RdRequirementCreate,
    RdRequirementResponse,
    RdRequirementUpdate,
)
from apps.kuaiplm.services.phase2_service import Phase2Service
from core.api.deps.access import require_access
from core.api.deps.deps import get_current_tenant
from infra.api.deps.deps import get_current_user
from infra.exceptions.exceptions import NotFoundError
from infra.models.user import User

router = APIRouter(prefix="/phase2", tags=["App · Kuaiplm · Phase2"])
service = Phase2Service()


def _err(status_code: int, message: str, route: str) -> HTTPException:
    trace_id = uuid.uuid4().hex
    logger.warning("kuaiplm_phase2_api_error trace_id={} route={} message={}", trace_id, route, message)
    return HTTPException(status_code=status_code, detail={"message": message, "trace_id": trace_id})


# ---------- Requirements ----------

@router.get("/requirements", summary="List requirements")
async def list_requirements(
    project_id: Optional[int] = Query(None),
    status: Optional[str] = Query(None),
    keyword: Optional[str] = Query(None),
    requirement_code: Optional[str] = Query(None),
    title: Optional[str] = Query(None),
    skip: int = Query(0, ge=0),
    limit: int = Query(20, ge=1, le=100),
    sort_field: Optional[str] = Query(None),
    sort_order: Optional[str] = Query(None, description="asc | desc"),
    created_start_date: Optional[str] = Query(None),
    created_end_date: Optional[str] = Query(None),
    updated_start_date: Optional[str] = Query(None),
    updated_end_date: Optional[str] = Query(None),
    _auth=Depends(require_access("kuaiplm.requirement", "read", required_permissions=["kuaiplm:requirement:read"])),
    tenant_id: int = Depends(get_current_tenant),
):
    rows, total = await service.list_requirements(
        tenant_id,
        project_id=project_id,
        status=status,
        keyword=keyword,
        requirement_code=requirement_code,
        title=title,
        skip=skip,
        limit=limit,
        sort_field=sort_field,
        sort_order=sort_order,
        created_start_date=created_start_date,
        created_end_date=created_end_date,
        updated_start_date=updated_start_date,
        updated_end_date=updated_end_date,
    )
    return {"data": rows, "total": total, "success": True}


@router.post("/requirements", response_model=RdRequirementResponse, status_code=status.HTTP_201_CREATED)
async def create_requirement(
    data: RdRequirementCreate,
    current_user: User = Depends(get_current_user),
    _auth=Depends(require_access("kuaiplm.requirement", "create", required_permissions=["kuaiplm:requirement:create"])),
    tenant_id: int = Depends(get_current_tenant),
):
    return await service.create_requirement(tenant_id, data, current_user.id)


@router.put("/requirements/{requirement_id}", response_model=RdRequirementResponse)
async def update_requirement(
    data: RdRequirementUpdate,
    requirement_id: int = Path(...),
    current_user: User = Depends(get_current_user),
    _auth=Depends(require_access("kuaiplm.requirement", "update", required_permissions=["kuaiplm:requirement:update"])),
    tenant_id: int = Depends(get_current_tenant),
):
    try:
        return await service.update_requirement(tenant_id, requirement_id, data, current_user.id)
    except NotFoundError as e:
        raise _err(404, str(e), f"/phase2/requirements/{requirement_id}")


@router.delete("/requirements/{requirement_id}", status_code=status.HTTP_204_NO_CONTENT)
async def delete_requirement(
    requirement_id: int = Path(...),
    current_user: User = Depends(get_current_user),
    _auth=Depends(require_access("kuaiplm.requirement", "delete", required_permissions=["kuaiplm:requirement:delete"])),
    tenant_id: int = Depends(get_current_tenant),
):
    try:
        await service.delete_requirement(tenant_id, requirement_id, current_user.id)
    except NotFoundError as e:
        raise _err(404, str(e), f"/phase2/requirements/{requirement_id}")


# ---------- Design Reviews ----------

@router.get("/design-reviews", summary="List design reviews")
async def list_design_reviews(
    project_id: Optional[int] = Query(None),
    status: Optional[str] = Query(None),
    keyword: Optional[str] = Query(None),
    review_code: Optional[str] = Query(None),
    title: Optional[str] = Query(None),
    skip: int = Query(0, ge=0),
    limit: int = Query(20, ge=1, le=100),
    sort_field: Optional[str] = Query(None),
    sort_order: Optional[str] = Query(None, description="asc | desc"),
    created_start_date: Optional[str] = Query(None),
    created_end_date: Optional[str] = Query(None),
    updated_start_date: Optional[str] = Query(None),
    updated_end_date: Optional[str] = Query(None),
    _auth=Depends(require_access("kuaiplm.design-review", "read", required_permissions=["kuaiplm:design-review:read"])),
    tenant_id: int = Depends(get_current_tenant),
):
    rows, total = await service.list_design_reviews(
        tenant_id,
        project_id=project_id,
        status=status,
        keyword=keyword,
        review_code=review_code,
        title=title,
        skip=skip,
        limit=limit,
        sort_field=sort_field,
        sort_order=sort_order,
        created_start_date=created_start_date,
        created_end_date=created_end_date,
        updated_start_date=updated_start_date,
        updated_end_date=updated_end_date,
    )
    return {"data": rows, "total": total, "success": True}


@router.post("/design-reviews", response_model=RdDesignReviewResponse, status_code=status.HTTP_201_CREATED)
async def create_design_review(
    data: RdDesignReviewCreate,
    current_user: User = Depends(get_current_user),
    _auth=Depends(require_access("kuaiplm.design-review", "create", required_permissions=["kuaiplm:design-review:create"])),
    tenant_id: int = Depends(get_current_tenant),
):
    return await service.create_design_review(tenant_id, data, current_user.id)


@router.put("/design-reviews/{review_id}", response_model=RdDesignReviewResponse)
async def update_design_review(
    data: RdDesignReviewUpdate,
    review_id: int = Path(...),
    current_user: User = Depends(get_current_user),
    _auth=Depends(require_access("kuaiplm.design-review", "update", required_permissions=["kuaiplm:design-review:update"])),
    tenant_id: int = Depends(get_current_tenant),
):
    try:
        return await service.update_design_review(tenant_id, review_id, data, current_user.id)
    except NotFoundError as e:
        raise _err(404, str(e), f"/phase2/design-reviews/{review_id}")


@router.delete("/design-reviews/{review_id}", status_code=status.HTTP_204_NO_CONTENT)
async def delete_design_review(
    review_id: int = Path(...),
    current_user: User = Depends(get_current_user),
    _auth=Depends(require_access("kuaiplm.design-review", "delete", required_permissions=["kuaiplm:design-review:delete"])),
    tenant_id: int = Depends(get_current_tenant),
):
    try:
        await service.delete_design_review(tenant_id, review_id, current_user.id)
    except NotFoundError as e:
        raise _err(404, str(e), f"/phase2/design-reviews/{review_id}")


# ---------- FMEA ----------

@router.get("/fmea", summary="List FMEA records")
async def list_fmea_records(
    project_id: Optional[int] = Query(None),
    fmea_type: Optional[str] = Query(None),
    status: Optional[str] = Query(None),
    keyword: Optional[str] = Query(None),
    fmea_code: Optional[str] = Query(None),
    title: Optional[str] = Query(None),
    skip: int = Query(0, ge=0),
    limit: int = Query(20, ge=1, le=100),
    sort_field: Optional[str] = Query(None),
    sort_order: Optional[str] = Query(None, description="asc | desc"),
    created_start_date: Optional[str] = Query(None),
    created_end_date: Optional[str] = Query(None),
    updated_start_date: Optional[str] = Query(None),
    updated_end_date: Optional[str] = Query(None),
    _auth=Depends(require_access("kuaiplm.fmea", "read", required_permissions=["kuaiplm:fmea:read"])),
    tenant_id: int = Depends(get_current_tenant),
):
    rows, total = await service.list_fmea_records(
        tenant_id,
        project_id=project_id,
        fmea_type=fmea_type,
        status=status,
        keyword=keyword,
        fmea_code=fmea_code,
        title=title,
        skip=skip,
        limit=limit,
        sort_field=sort_field,
        sort_order=sort_order,
        created_start_date=created_start_date,
        created_end_date=created_end_date,
        updated_start_date=updated_start_date,
        updated_end_date=updated_end_date,
    )
    return {"data": rows, "total": total, "success": True}


@router.post("/fmea", response_model=RdFmeaRecordResponse, status_code=status.HTTP_201_CREATED)
async def create_fmea_record(
    data: RdFmeaRecordCreate,
    current_user: User = Depends(get_current_user),
    _auth=Depends(require_access("kuaiplm.fmea", "create", required_permissions=["kuaiplm:fmea:create"])),
    tenant_id: int = Depends(get_current_tenant),
):
    return await service.create_fmea_record(tenant_id, data, current_user.id)


@router.put("/fmea/{fmea_id}", response_model=RdFmeaRecordResponse)
async def update_fmea_record(
    data: RdFmeaRecordUpdate,
    fmea_id: int = Path(...),
    current_user: User = Depends(get_current_user),
    _auth=Depends(require_access("kuaiplm.fmea", "update", required_permissions=["kuaiplm:fmea:update"])),
    tenant_id: int = Depends(get_current_tenant),
):
    try:
        return await service.update_fmea_record(tenant_id, fmea_id, data, current_user.id)
    except NotFoundError as e:
        raise _err(404, str(e), f"/phase2/fmea/{fmea_id}")


@router.delete("/fmea/{fmea_id}", status_code=status.HTTP_204_NO_CONTENT)
async def delete_fmea_record(
    fmea_id: int = Path(...),
    current_user: User = Depends(get_current_user),
    _auth=Depends(require_access("kuaiplm.fmea", "delete", required_permissions=["kuaiplm:fmea:delete"])),
    tenant_id: int = Depends(get_current_tenant),
):
    try:
        await service.delete_fmea_record(tenant_id, fmea_id, current_user.id)
    except NotFoundError as e:
        raise _err(404, str(e), f"/phase2/fmea/{fmea_id}")
