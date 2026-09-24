"""实验委托 API（R-02 / kuaiplm）。"""

from __future__ import annotations

from typing import Optional

from fastapi import APIRouter, Depends, HTTPException, Query, status

from apps.kuaiplm.schemas.lab_request import (
    LabRequestCompleteRequest,
    LabRequestCreate,
    LabRequestFillOutsourcePriceRequest,
    LabRequestLinkExceptionRequest,
    LabRequestListResponse,
    LabRequestMeasureOverrideRequest,
    LabRequestMeasurePlanReplaceRequest,
    LabRequestMeasuresSaveRequest,
    LabRequestRejectRequest,
    LabRequestReportRejectRequest,
    LabRequestReportSaveRequest,
    LabRequestResponse,
    LabRequestRevokeRequest,
    LabRequestUpdate,
)
from apps.kuaiplm.services.lab_request_service import LabRequestService
from core.api.deps.access import require_access
from core.api.deps.deps import get_current_tenant
from infra.api.deps.deps import get_current_user
from infra.exceptions.exceptions import BusinessLogicError, NotFoundError, ValidationError
from infra.models.user import User

router = APIRouter(prefix="/lab-requests", tags=["App - Kuaiplm - Lab Request"])
service = LabRequestService()


def _http(exc: Exception) -> HTTPException:
    if isinstance(exc, NotFoundError):
        return HTTPException(status_code=status.HTTP_404_NOT_FOUND, detail=str(exc))
    if isinstance(exc, (ValidationError, BusinessLogicError)):
        return HTTPException(status_code=status.HTTP_422_UNPROCESSABLE_ENTITY, detail=str(exc))
    return HTTPException(status_code=status.HTTP_500_INTERNAL_SERVER_ERROR, detail=str(exc))


@router.get("", response_model=LabRequestListResponse)
async def list_lab_requests(
    skip: int = Query(0, ge=0),
    limit: int = Query(20, ge=1, le=200),
    keyword: Optional[str] = None,
    status_filter: Optional[str] = Query(None, alias="status"),
    business_type: Optional[str] = None,
    priority: Optional[str] = None,
    board: bool = Query(False, description="待检看板：仅 pending/in_lab"),
    mine: bool = Query(False, description="我的实验委托：仅当前用户创建"),
    order_by: str = Query("-created_at"),
    current_user: User = Depends(get_current_user),
    _auth=Depends(
        require_access(
            "kuaiplm.lab-request",
            "read",
            required_permissions=["kuaiplm:lab-request:read"],
        )
    ),
    tenant_id: int = Depends(get_current_tenant),
):
    try:
        return await service.list(
            tenant_id,
            skip=skip,
            limit=limit,
            keyword=keyword,
            status=status_filter,
            business_type=business_type,
            priority=priority,
            board=board,
            mine=mine,
            current_user=current_user,
            order_by=order_by,
        )
    except Exception as e:
        raise _http(e) from e


@router.post("", response_model=LabRequestResponse, status_code=status.HTTP_201_CREATED)
async def create_lab_request(
    data: LabRequestCreate,
    current_user: User = Depends(get_current_user),
    _auth=Depends(
        require_access(
            "kuaiplm.lab-request",
            "create",
            required_permissions=["kuaiplm:lab-request:create"],
        )
    ),
    tenant_id: int = Depends(get_current_tenant),
):
    try:
        return await service.create(tenant_id, data, current_user)
    except Exception as e:
        raise _http(e) from e


@router.get("/{request_id}", response_model=LabRequestResponse)
async def get_lab_request(
    request_id: int,
    _auth=Depends(
        require_access(
            "kuaiplm.lab-request",
            "read",
            required_permissions=["kuaiplm:lab-request:read"],
        )
    ),
    tenant_id: int = Depends(get_current_tenant),
):
    try:
        return await service.get(tenant_id, request_id)
    except Exception as e:
        raise _http(e) from e


@router.put("/{request_id}", response_model=LabRequestResponse)
async def update_lab_request(
    request_id: int,
    data: LabRequestUpdate,
    current_user: User = Depends(get_current_user),
    _auth=Depends(
        require_access(
            "kuaiplm.lab-request",
            "update",
            required_permissions=["kuaiplm:lab-request:update"],
        )
    ),
    tenant_id: int = Depends(get_current_tenant),
):
    try:
        return await service.update(tenant_id, request_id, data, current_user)
    except Exception as e:
        raise _http(e) from e


@router.delete("/{request_id}")
async def delete_lab_request(
    request_id: int,
    current_user: User = Depends(get_current_user),
    _auth=Depends(
        require_access(
            "kuaiplm.lab-request",
            "delete",
            required_permissions=["kuaiplm:lab-request:delete"],
        )
    ),
    tenant_id: int = Depends(get_current_tenant),
):
    try:
        await service.delete(tenant_id, request_id, current_user)
        return {"success": True}
    except Exception as e:
        raise _http(e) from e


@router.post("/{request_id}/submit", response_model=LabRequestResponse)
async def submit_lab_request(
    request_id: int,
    current_user: User = Depends(get_current_user),
    _auth=Depends(
        require_access(
            "kuaiplm.lab-request",
            "submit",
            required_permissions=["kuaiplm:lab-request:submit"],
        )
    ),
    tenant_id: int = Depends(get_current_tenant),
):
    try:
        return await service.submit(tenant_id, request_id, current_user)
    except Exception as e:
        raise _http(e) from e


@router.post("/{request_id}/approve", response_model=LabRequestResponse)
async def approve_lab_request(
    request_id: int,
    current_user: User = Depends(get_current_user),
    _auth=Depends(
        require_access(
            "kuaiplm.lab-request",
            "approve",
            required_permissions=["kuaiplm:lab-request:approve"],
        )
    ),
    tenant_id: int = Depends(get_current_tenant),
):
    """研发经理审核通过，进入实验室待受理。"""
    try:
        return await service.approve(tenant_id, request_id, current_user)
    except Exception as e:
        raise _http(e) from e


@router.post("/{request_id}/fill-outsource-price", response_model=LabRequestResponse)
async def fill_lab_request_outsource_price(
    request_id: int,
    data: LabRequestFillOutsourcePriceRequest,
    current_user: User = Depends(get_current_user),
    _auth=Depends(
        require_access(
            "kuaiplm.lab-request",
            "update",
            required_permissions=["kuaiplm:lab-request:update"],
        )
    ),
    tenant_id: int = Depends(get_current_tenant),
):
    try:
        return await service.fill_outsource_price(tenant_id, request_id, data, current_user)
    except Exception as e:
        raise _http(e) from e


@router.post("/{request_id}/accept", response_model=LabRequestResponse)
async def accept_lab_request(
    request_id: int,
    current_user: User = Depends(get_current_user),
    _auth=Depends(
        require_access(
            "kuaiplm.lab-request",
            "execute",
            required_permissions=["kuaiplm:lab-request:execute"],
        )
    ),
    tenant_id: int = Depends(get_current_tenant),
):
    try:
        return await service.accept(tenant_id, request_id, current_user)
    except Exception as e:
        raise _http(e) from e


@router.post("/{request_id}/complete", response_model=LabRequestResponse)
async def complete_lab_request(
    request_id: int,
    data: LabRequestCompleteRequest,
    current_user: User = Depends(get_current_user),
    _auth=Depends(
        require_access(
            "kuaiplm.lab-request",
            "complete",
            required_permissions=["kuaiplm:lab-request:complete"],
        )
    ),
    tenant_id: int = Depends(get_current_tenant),
):
    try:
        return await service.complete(tenant_id, request_id, data, current_user)
    except Exception as e:
        raise _http(e) from e


@router.post("/{request_id}/reject", response_model=LabRequestResponse)
async def reject_lab_request(
    request_id: int,
    data: LabRequestRejectRequest,
    current_user: User = Depends(get_current_user),
    _auth=Depends(
        require_access(
            "kuaiplm.lab-request",
            "reject",
            required_permissions=["kuaiplm:lab-request:reject"],
        )
    ),
    tenant_id: int = Depends(get_current_tenant),
):
    try:
        return await service.reject(tenant_id, request_id, data, current_user)
    except Exception as e:
        raise _http(e) from e


@router.post("/{request_id}/revoke", response_model=LabRequestResponse)
async def revoke_lab_request(
    request_id: int,
    data: LabRequestRevokeRequest,
    current_user: User = Depends(get_current_user),
    _auth=Depends(
        require_access(
            "kuaiplm.lab-request",
            "revoke",
            required_permissions=["kuaiplm:lab-request:revoke"],
        )
    ),
    tenant_id: int = Depends(get_current_tenant),
):
    try:
        return await service.revoke(tenant_id, request_id, data, current_user)
    except Exception as e:
        raise _http(e) from e


@router.put("/{request_id}/measure-plan", response_model=LabRequestResponse)
async def replace_lab_request_measure_plan(
    request_id: int,
    data: LabRequestMeasurePlanReplaceRequest,
    current_user: User = Depends(get_current_user),
    _auth=Depends(
        require_access(
            "kuaiplm.lab-request",
            "update",
            required_permissions=["kuaiplm:lab-request:update"],
        )
    ),
    tenant_id: int = Depends(get_current_tenant),
):
    try:
        return await service.replace_measure_plan(tenant_id, request_id, data, current_user)
    except Exception as e:
        raise _http(e) from e


@router.put("/{request_id}/measures", response_model=LabRequestResponse)
async def save_lab_request_measures(
    request_id: int,
    data: LabRequestMeasuresSaveRequest,
    current_user: User = Depends(get_current_user),
    _auth=Depends(
        require_access(
            "kuaiplm.lab-request",
            "execute",
            required_permissions=["kuaiplm:lab-request:execute"],
        )
    ),
    tenant_id: int = Depends(get_current_tenant),
):
    try:
        return await service.save_measures(tenant_id, request_id, data, current_user)
    except Exception as e:
        raise _http(e) from e


@router.post(
    "/{request_id}/measure-items/{item_id}/override",
    response_model=LabRequestResponse,
)
async def override_lab_request_measure_judgment(
    request_id: int,
    item_id: int,
    data: LabRequestMeasureOverrideRequest,
    current_user: User = Depends(get_current_user),
    _auth=Depends(
        require_access(
            "kuaiplm.lab-request",
            "execute",
            required_permissions=["kuaiplm:lab-request:execute"],
        )
    ),
    tenant_id: int = Depends(get_current_tenant),
):
    try:
        return await service.override_measure_judgment(
            tenant_id, request_id, item_id, data, current_user
        )
    except Exception as e:
        raise _http(e) from e


@router.put("/{request_id}/report", response_model=LabRequestResponse)
async def save_lab_request_report(
    request_id: int,
    data: LabRequestReportSaveRequest,
    current_user: User = Depends(get_current_user),
    _auth=Depends(
        require_access(
            "kuaiplm.lab-request",
            "execute",
            required_permissions=["kuaiplm:lab-request:execute"],
        )
    ),
    tenant_id: int = Depends(get_current_tenant),
):
    try:
        return await service.save_report(tenant_id, request_id, data, current_user)
    except Exception as e:
        raise _http(e) from e


@router.post("/{request_id}/report/submit", response_model=LabRequestResponse)
async def submit_lab_request_report(
    request_id: int,
    data: LabRequestReportSaveRequest,
    current_user: User = Depends(get_current_user),
    _auth=Depends(
        require_access(
            "kuaiplm.lab-request",
            "submit",
            required_permissions=["kuaiplm:lab-request:submit"],
        )
    ),
    tenant_id: int = Depends(get_current_tenant),
):
    try:
        return await service.submit_report(tenant_id, request_id, data, current_user)
    except Exception as e:
        raise _http(e) from e


@router.post("/{request_id}/report/approve", response_model=LabRequestResponse)
async def approve_lab_request_report(
    request_id: int,
    current_user: User = Depends(get_current_user),
    _auth=Depends(
        require_access(
            "kuaiplm.lab-request",
            "approve",
            required_permissions=["kuaiplm:lab-request:approve"],
        )
    ),
    tenant_id: int = Depends(get_current_tenant),
):
    try:
        return await service.approve_report(tenant_id, request_id, current_user)
    except Exception as e:
        raise _http(e) from e


@router.post("/{request_id}/report/reject", response_model=LabRequestResponse)
async def reject_lab_request_report(
    request_id: int,
    data: LabRequestReportRejectRequest,
    current_user: User = Depends(get_current_user),
    _auth=Depends(
        require_access(
            "kuaiplm.lab-request",
            "reject",
            required_permissions=["kuaiplm:lab-request:reject"],
        )
    ),
    tenant_id: int = Depends(get_current_tenant),
):
    try:
        return await service.reject_report(tenant_id, request_id, data, current_user)
    except Exception as e:
        raise _http(e) from e


@router.post(
    "/{request_id}/measure-items/{item_id}/link-exception",
    response_model=LabRequestResponse,
)
async def link_lab_request_ng_exception(
    request_id: int,
    item_id: int,
    data: LabRequestLinkExceptionRequest,
    current_user: User = Depends(get_current_user),
    _auth=Depends(
        require_access(
            "kuaiplm.lab-request",
            "execute",
            required_permissions=["kuaiplm:lab-request:execute"],
        )
    ),
    tenant_id: int = Depends(get_current_tenant),
):
    try:
        return await service.link_ng_exception(
            tenant_id, request_id, item_id, data, current_user
        )
    except Exception as e:
        raise _http(e) from e
