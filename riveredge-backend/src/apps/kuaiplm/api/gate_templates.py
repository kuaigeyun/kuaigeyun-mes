"""
阶段门模板 API

Author: RiverEdge Team
Date: 2026-07-07
"""

import uuid
from typing import Optional

from fastapi import APIRouter, Depends, HTTPException, Path, Query, status
from loguru import logger

from apps.kuaiplm.schemas.gate_template import (
    GateTemplateCreate,
    GateTemplateDetailResponse,
    GateTemplateStagesSave,
    GateTemplateSummaryResponse,
    GateTemplateUpdate,
)
from apps.kuaiplm.services.gate_template_service import RdGateTemplateService
from core.api.deps.access import require_access
from core.api.deps.deps import get_current_tenant
from infra.api.deps.deps import get_current_user
from infra.exceptions.exceptions import BusinessLogicError, NotFoundError
from infra.models.user import User

router = APIRouter(prefix="/gate-templates", tags=["App · Kuaiplm · Gate Templates"])
service = RdGateTemplateService()


def _err(status_code: int, message: str, route: str, tenant_id: Optional[int] = None) -> HTTPException:
    trace_id = uuid.uuid4().hex
    logger.warning(
        "kuaiplm_gate_templates_api_error trace_id={} route={} tenant_id={} message={}",
        trace_id,
        route,
        tenant_id,
        message,
    )
    return HTTPException(status_code=status_code, detail={"message": message, "trace_id": trace_id})


@router.get("", summary="List gate templates")
async def list_gate_templates(
    project_type: Optional[str] = Query(None, description="RD | DELIVERY"),
    is_active: Optional[bool] = Query(None),
    _auth=Depends(require_access("kuaiplm.gate-template", "read", required_permissions=["kuaiplm:gate-template:read"])),
    tenant_id: int = Depends(get_current_tenant),
):
    rows = await service.list_templates(tenant_id, project_type=project_type, is_active=is_active)
    return {"data": rows, "total": len(rows), "success": True}


@router.get("/{template_id}", response_model=GateTemplateDetailResponse, summary="Get gate template")
async def get_gate_template(
    template_id: int = Path(..., ge=1),
    _auth=Depends(require_access("kuaiplm.gate-template", "read", required_permissions=["kuaiplm:gate-template:read"])),
    tenant_id: int = Depends(get_current_tenant),
):
    try:
        return await service.get_template(tenant_id, template_id)
    except NotFoundError as e:
        raise _err(status.HTTP_404_NOT_FOUND, str(e), "get_gate_template", tenant_id)


@router.post("", response_model=GateTemplateDetailResponse, status_code=status.HTTP_201_CREATED, summary="Create gate template")
async def create_gate_template(
    data: GateTemplateCreate,
    current_user: User = Depends(get_current_user),
    _auth=Depends(require_access("kuaiplm.gate-template", "create", required_permissions=["kuaiplm:gate-template:create"])),
    tenant_id: int = Depends(get_current_tenant),
):
    try:
        return await service.create_template(tenant_id, data, current_user.id)
    except BusinessLogicError as e:
        raise HTTPException(status_code=status.HTTP_409_CONFLICT, detail={"message": str(e)})


@router.put("/{template_id}", response_model=GateTemplateDetailResponse, summary="Update gate template header")
async def update_gate_template(
    data: GateTemplateUpdate,
    template_id: int = Path(..., ge=1),
    current_user: User = Depends(get_current_user),
    _auth=Depends(require_access("kuaiplm.gate-template", "update", required_permissions=["kuaiplm:gate-template:update"])),
    tenant_id: int = Depends(get_current_tenant),
):
    try:
        return await service.update_template(tenant_id, template_id, data, current_user.id)
    except NotFoundError as e:
        raise _err(status.HTTP_404_NOT_FOUND, str(e), "update_gate_template", tenant_id)
    except BusinessLogicError as e:
        raise HTTPException(status_code=status.HTTP_409_CONFLICT, detail={"message": str(e)})


@router.put("/{template_id}/stages", response_model=GateTemplateDetailResponse, summary="Save template stages")
async def save_gate_template_stages(
    data: GateTemplateStagesSave,
    template_id: int = Path(..., ge=1),
    current_user: User = Depends(get_current_user),
    _auth=Depends(require_access("kuaiplm.gate-template", "update", required_permissions=["kuaiplm:gate-template:update"])),
    tenant_id: int = Depends(get_current_tenant),
):
    try:
        return await service.save_stages(tenant_id, template_id, data, current_user.id)
    except NotFoundError as e:
        raise _err(status.HTTP_404_NOT_FOUND, str(e), "save_gate_template_stages", tenant_id)
    except BusinessLogicError as e:
        raise HTTPException(status_code=status.HTTP_409_CONFLICT, detail={"message": str(e)})


@router.post("/{template_id}/set-default", response_model=GateTemplateDetailResponse, summary="Set default template")
async def set_default_gate_template(
    template_id: int = Path(..., ge=1),
    current_user: User = Depends(get_current_user),
    _auth=Depends(require_access("kuaiplm.gate-template", "update", required_permissions=["kuaiplm:gate-template:update"])),
    tenant_id: int = Depends(get_current_tenant),
):
    try:
        return await service.set_default(tenant_id, template_id, current_user.id)
    except NotFoundError as e:
        raise _err(status.HTTP_404_NOT_FOUND, str(e), "set_default_gate_template", tenant_id)
    except BusinessLogicError as e:
        raise HTTPException(status_code=status.HTTP_409_CONFLICT, detail={"message": str(e)})


@router.delete("/{template_id}", status_code=status.HTTP_204_NO_CONTENT, summary="Delete gate template")
async def delete_gate_template(
    template_id: int = Path(..., ge=1),
    current_user: User = Depends(get_current_user),
    _auth=Depends(require_access("kuaiplm.gate-template", "delete", required_permissions=["kuaiplm:gate-template:delete"])),
    tenant_id: int = Depends(get_current_tenant),
):
    try:
        await service.delete_template(tenant_id, template_id, current_user.id)
    except NotFoundError as e:
        raise _err(status.HTTP_404_NOT_FOUND, str(e), "delete_gate_template", tenant_id)
    except BusinessLogicError as e:
        raise HTTPException(status_code=status.HTTP_409_CONFLICT, detail={"message": str(e)})
