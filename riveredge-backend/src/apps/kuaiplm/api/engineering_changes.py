"""工程变更 API（R-04 / ECN）"""

from __future__ import annotations

from typing import Optional

from fastapi import APIRouter, Depends, HTTPException, Query, status

from apps.kuaiplm.schemas.engineering_change import (
    EcnFormProfile,
    EngineeringChangeCreate,
    EngineeringChangeErpAudit,
    EngineeringChangeListResponse,
    EngineeringChangeResponse,
    EngineeringChangeUpdate,
)
from apps.kuaiplm.services.engineering_change_service import EngineeringChangeService
from core.api.deps.access import require_access
from core.api.deps.deps import get_current_tenant
from core.services.authorization.user_permission_service import UserPermissionService
from infra.api.deps.deps import get_current_user
from infra.exceptions.exceptions import BusinessLogicError, NotFoundError, ValidationError
from infra.models.user import User

router = APIRouter(prefix="/engineering-changes", tags=["App - Kuaiplm - Engineering Change"])
service = EngineeringChangeService()


def _http(exc: Exception) -> HTTPException:
    if isinstance(exc, NotFoundError):
        return HTTPException(status_code=status.HTTP_404_NOT_FOUND, detail=str(exc))
    if isinstance(exc, (ValidationError, BusinessLogicError)):
        return HTTPException(status_code=status.HTTP_422_UNPROCESSABLE_ENTITY, detail=str(exc))
    return HTTPException(status_code=status.HTTP_500_INTERNAL_SERVER_ERROR, detail=str(exc))


@router.get(
    "/meta/form-profile",
    response_model=EcnFormProfile,
    summary="ECN form profile (generic or industry)",
)
async def get_ecn_form_profile(
    _auth=Depends(
        require_access(
            "kuaiplm.ecn",
            "read",
            required_permissions=["kuaiplm:ecn:read"],
        )
    ),
    tenant_id: int = Depends(get_current_tenant),
):
    try:
        return await service.get_form_profile(tenant_id)
    except Exception as e:
        raise _http(e)


@router.get("", response_model=EngineeringChangeListResponse)
async def list_engineering_changes(
    skip: int = Query(0, ge=0),
    limit: int = Query(20, ge=1, le=100),
    keyword: Optional[str] = Query(None),
    status_filter: Optional[str] = Query(None, alias="status"),
    change_kind: Optional[str] = Query(None),
    project_id: Optional[int] = Query(None),
    _auth=Depends(
        require_access(
            "kuaiplm.ecn",
            "read",
            required_permissions=["kuaiplm:ecn:read"],
        )
    ),
    tenant_id: int = Depends(get_current_tenant),
):
    try:
        return await service.list(
            tenant_id,
            keyword=keyword,
            status=status_filter,
            change_kind=change_kind,
            project_id=project_id,
            skip=skip,
            limit=limit,
        )
    except Exception as e:
        raise _http(e)


@router.post("", response_model=EngineeringChangeResponse, status_code=status.HTTP_201_CREATED)
async def create_engineering_change(
    data: EngineeringChangeCreate,
    current_user: User = Depends(get_current_user),
    _auth=Depends(
        require_access(
            "kuaiplm.ecn",
            "create",
            required_permissions=["kuaiplm:ecn:create"],
        )
    ),
    tenant_id: int = Depends(get_current_tenant),
):
    try:
        codes = sorted(
            await UserPermissionService.get_user_permissions(
                user_id=current_user.id,
                tenant_id=tenant_id,
            )
        )
        return await service.create(tenant_id, data, current_user, permission_codes=codes)
    except Exception as e:
        raise _http(e)


@router.get("/{ecn_id}", response_model=EngineeringChangeResponse)
async def get_engineering_change(
    ecn_id: int,
    _auth=Depends(
        require_access(
            "kuaiplm.ecn",
            "read",
            required_permissions=["kuaiplm:ecn:read"],
        )
    ),
    tenant_id: int = Depends(get_current_tenant),
):
    try:
        return await service.get(tenant_id, ecn_id)
    except Exception as e:
        raise _http(e)


@router.put("/{ecn_id}", response_model=EngineeringChangeResponse)
async def update_engineering_change(
    ecn_id: int,
    data: EngineeringChangeUpdate,
    current_user: User = Depends(get_current_user),
    _auth=Depends(
        require_access(
            "kuaiplm.ecn",
            "update",
            required_permissions=["kuaiplm:ecn:update"],
        )
    ),
    tenant_id: int = Depends(get_current_tenant),
):
    try:
        return await service.update(tenant_id, ecn_id, data, current_user)
    except Exception as e:
        raise _http(e)


@router.post("/{ecn_id}/submit", response_model=EngineeringChangeResponse)
async def submit_engineering_change(
    ecn_id: int,
    current_user: User = Depends(get_current_user),
    _auth=Depends(
        require_access(
            "kuaiplm.ecn",
            "submit",
            required_permissions=["kuaiplm:ecn:submit"],
        )
    ),
    tenant_id: int = Depends(get_current_tenant),
):
    try:
        return await service.submit(tenant_id, ecn_id, current_user)
    except Exception as e:
        raise _http(e)


@router.post("/{ecn_id}/approve", response_model=EngineeringChangeResponse)
async def approve_engineering_change(
    ecn_id: int,
    current_user: User = Depends(get_current_user),
    _auth=Depends(
        require_access(
            "kuaiplm.ecn",
            "approve",
            required_permissions=["kuaiplm:ecn:approve"],
        )
    ),
    tenant_id: int = Depends(get_current_tenant),
):
    try:
        return await service.approve(tenant_id, ecn_id, current_user)
    except Exception as e:
        raise _http(e)


@router.post("/{ecn_id}/reject", response_model=EngineeringChangeResponse)
async def reject_engineering_change(
    ecn_id: int,
    current_user: User = Depends(get_current_user),
    _auth=Depends(
        require_access(
            "kuaiplm.ecn",
            "reject",
            required_permissions=["kuaiplm:ecn:reject"],
        )
    ),
    tenant_id: int = Depends(get_current_tenant),
):
    try:
        return await service.reject(tenant_id, ecn_id, current_user)
    except Exception as e:
        raise _http(e)


@router.post("/{ecn_id}/erp-audit", response_model=EngineeringChangeResponse)
async def erp_audit_engineering_change(
    ecn_id: int,
    data: EngineeringChangeErpAudit,
    current_user: User = Depends(get_current_user),
    _auth=Depends(
        require_access(
            "kuaiplm.ecn",
            "execute",
            required_permissions=["kuaiplm:ecn:execute"],
        )
    ),
    tenant_id: int = Depends(get_current_tenant),
):
    try:
        return await service.erp_audit(tenant_id, ecn_id, data, current_user)
    except Exception as e:
        raise _http(e)


@router.delete("/{ecn_id}", status_code=status.HTTP_204_NO_CONTENT)
async def delete_engineering_change(
    ecn_id: int,
    current_user: User = Depends(get_current_user),
    _auth=Depends(
        require_access(
            "kuaiplm.ecn",
            "delete",
            required_permissions=["kuaiplm:ecn:delete"],
        )
    ),
    tenant_id: int = Depends(get_current_tenant),
):
    try:
        await service.delete(tenant_id, ecn_id, current_user)
    except Exception as e:
        raise _http(e)
