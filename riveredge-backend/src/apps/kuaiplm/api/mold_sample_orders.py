"""开模合同 / 打样订单 API（R-15 #71）"""

from __future__ import annotations

from typing import Optional

from fastapi import APIRouter, Depends, HTTPException, Query, status

from apps.kuaiplm.schemas.mold_sample_order import (
    MoldSampleOrderCreate,
    MoldSampleOrderListResponse,
    MoldSampleOrderResponse,
    MoldSampleOrderUpdate,
)
from apps.kuaiplm.services.mold_sample_order_service import MoldSampleOrderService
from core.api.deps.access import require_permission_codes
from core.api.deps.deps import get_current_tenant
from infra.api.deps.deps import get_current_user
from infra.exceptions.exceptions import BusinessLogicError, NotFoundError, ValidationError
from infra.models.user import User

router = APIRouter(prefix="/mold-sample-orders", tags=["App - Kuaiplm - Mold Sample Order"])
service = MoldSampleOrderService()


def _http(exc: Exception) -> HTTPException:
    if isinstance(exc, NotFoundError):
        return HTTPException(status_code=status.HTTP_404_NOT_FOUND, detail=str(exc))
    if isinstance(exc, (ValidationError, BusinessLogicError)):
        return HTTPException(status_code=status.HTTP_422_UNPROCESSABLE_ENTITY, detail=str(exc))
    return HTTPException(status_code=status.HTTP_500_INTERNAL_SERVER_ERROR, detail=str(exc))


@router.get("", response_model=MoldSampleOrderListResponse, summary="List mold/sample orders")
async def list_mold_sample_orders(
    skip: int = Query(0, ge=0),
    limit: int = Query(20, ge=1, le=100),
    keyword: Optional[str] = Query(None),
    status_filter: Optional[str] = Query(None, alias="status"),
    doc_kind: Optional[str] = Query(None),
    project_id: Optional[int] = Query(None),
    _auth=Depends(require_permission_codes("kuaiplm:mold-sample:read")),
    tenant_id: int = Depends(get_current_tenant),
):
    try:
        return await service.list(
            tenant_id,
            keyword=keyword,
            status=status_filter,
            doc_kind=doc_kind,
            project_id=project_id,
            skip=skip,
            limit=limit,
        )
    except Exception as e:
        raise _http(e)


@router.post(
    "",
    response_model=MoldSampleOrderResponse,
    status_code=status.HTTP_201_CREATED,
    summary="Create mold/sample order",
)
async def create_mold_sample_order(
    data: MoldSampleOrderCreate,
    current_user: User = Depends(get_current_user),
    _auth=Depends(require_permission_codes("kuaiplm:mold-sample:create")),
    tenant_id: int = Depends(get_current_tenant),
):
    try:
        return await service.create(tenant_id, data, current_user)
    except Exception as e:
        raise _http(e)


@router.get("/{order_id}", response_model=MoldSampleOrderResponse, summary="Get one")
async def get_mold_sample_order(
    order_id: int,
    _auth=Depends(require_permission_codes("kuaiplm:mold-sample:read")),
    tenant_id: int = Depends(get_current_tenant),
):
    try:
        return await service.get(tenant_id, order_id)
    except Exception as e:
        raise _http(e)


@router.put("/{order_id}", response_model=MoldSampleOrderResponse, summary="Update")
async def update_mold_sample_order(
    order_id: int,
    data: MoldSampleOrderUpdate,
    current_user: User = Depends(get_current_user),
    _auth=Depends(require_permission_codes("kuaiplm:mold-sample:update")),
    tenant_id: int = Depends(get_current_tenant),
):
    try:
        return await service.update(tenant_id, order_id, data, current_user)
    except Exception as e:
        raise _http(e)


@router.post("/{order_id}/submit", response_model=MoldSampleOrderResponse, summary="Submit")
async def submit_mold_sample_order(
    order_id: int,
    current_user: User = Depends(get_current_user),
    _auth=Depends(require_permission_codes("kuaiplm:mold-sample:submit")),
    tenant_id: int = Depends(get_current_tenant),
):
    try:
        return await service.submit(tenant_id, order_id, current_user)
    except Exception as e:
        raise _http(e)


@router.post("/{order_id}/approve", response_model=MoldSampleOrderResponse, summary="Approve")
async def approve_mold_sample_order(
    order_id: int,
    current_user: User = Depends(get_current_user),
    _auth=Depends(require_permission_codes("kuaiplm:mold-sample:approve")),
    tenant_id: int = Depends(get_current_tenant),
):
    try:
        return await service.approve(tenant_id, order_id, current_user)
    except Exception as e:
        raise _http(e)


@router.post("/{order_id}/reject", response_model=MoldSampleOrderResponse, summary="Reject")
async def reject_mold_sample_order(
    order_id: int,
    current_user: User = Depends(get_current_user),
    _auth=Depends(require_permission_codes("kuaiplm:mold-sample:reject")),
    tenant_id: int = Depends(get_current_tenant),
):
    try:
        return await service.reject(tenant_id, order_id, current_user)
    except Exception as e:
        raise _http(e)


@router.post("/{order_id}/seal", response_model=MoldSampleOrderResponse, summary="Seal/print")
async def seal_mold_sample_order(
    order_id: int,
    current_user: User = Depends(get_current_user),
    _auth=Depends(require_permission_codes("kuaiplm:mold-sample:execute")),
    tenant_id: int = Depends(get_current_tenant),
):
    try:
        return await service.seal(tenant_id, order_id, current_user)
    except Exception as e:
        raise _http(e)


@router.post("/{order_id}/archive", response_model=MoldSampleOrderResponse, summary="Archive")
async def archive_mold_sample_order(
    order_id: int,
    current_user: User = Depends(get_current_user),
    _auth=Depends(require_permission_codes("kuaiplm:mold-sample:complete")),
    tenant_id: int = Depends(get_current_tenant),
):
    try:
        return await service.archive(tenant_id, order_id, current_user)
    except Exception as e:
        raise _http(e)


@router.delete(
    "/{order_id}",
    status_code=status.HTTP_204_NO_CONTENT,
    summary="Delete draft",
)
async def delete_mold_sample_order(
    order_id: int,
    current_user: User = Depends(get_current_user),
    _auth=Depends(require_permission_codes("kuaiplm:mold-sample:delete")),
    tenant_id: int = Depends(get_current_tenant),
):
    try:
        await service.delete(tenant_id, order_id, current_user)
    except Exception as e:
        raise _http(e)
