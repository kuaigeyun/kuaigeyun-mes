"""
客户跟进记录 API
"""

from datetime import datetime
from typing import Optional

from fastapi import APIRouter, Depends, HTTPException, Path, Query, status

from apps.kuaizhizao.schemas.customer_follow_up import (
    CustomerFollowUpCreate,
    CustomerFollowUpUpdate,
    CustomerFollowUpResponse,
    CustomerFollowUpListEnvelope,
)
from apps.kuaizhizao.services.customer_follow_up_service import CustomerFollowUpService
from core.api.deps import get_current_user, get_current_tenant
from infra.exceptions.exceptions import NotFoundError, ValidationError
from infra.models.user import User

router = APIRouter(prefix="/customer-follow-ups", tags=["Kuaige Zhizao - Customer Follow-up"])

_service = CustomerFollowUpService()


@router.post("", response_model=CustomerFollowUpResponse, summary="创建客户跟进")
async def create_follow_up(
    body: CustomerFollowUpCreate,
    current_user: User = Depends(get_current_user),
    tenant_id: int = Depends(get_current_tenant),
):
    try:
        return await _service.create(tenant_id, body, current_user)
    except ValidationError as e:
        raise HTTPException(status_code=status.HTTP_400_BAD_REQUEST, detail=str(e))


@router.get("", response_model=CustomerFollowUpListEnvelope, summary="客户跟进列表")
async def list_follow_ups(
    skip: int = Query(0, ge=0),
    limit: int = Query(50, ge=1, le=200),
    customer_id: Optional[int] = Query(None),
    keyword: Optional[str] = Query(None),
    occurred_from: Optional[datetime] = Query(None),
    occurred_to: Optional[datetime] = Query(None),
    pending_only: bool = Query(False, description="仅显示已到期待跟进（下次跟进时间已至）"),
    current_user: User = Depends(get_current_user),
    tenant_id: int = Depends(get_current_tenant),
):
    return await _service.list_follow_ups(
        tenant_id=tenant_id,
        skip=skip,
        limit=limit,
        customer_id=customer_id,
        keyword=keyword,
        occurred_from=occurred_from,
        occurred_to=occurred_to,
        pending_only=pending_only,
        current_user=current_user,
    )


@router.get("/{follow_id}", response_model=CustomerFollowUpResponse, summary="客户跟进详情")
async def get_follow_up(
    follow_id: int = Path(..., description="跟进记录ID"),
    current_user: User = Depends(get_current_user),
    tenant_id: int = Depends(get_current_tenant),
):
    try:
        return await _service.get(tenant_id, follow_id, current_user)
    except NotFoundError as e:
        raise HTTPException(status_code=status.HTTP_404_NOT_FOUND, detail=str(e))


@router.put("/{follow_id}", response_model=CustomerFollowUpResponse, summary="更新客户跟进")
async def update_follow_up(
    body: CustomerFollowUpUpdate,
    follow_id: int = Path(..., description="跟进记录ID"),
    current_user: User = Depends(get_current_user),
    tenant_id: int = Depends(get_current_tenant),
):
    try:
        return await _service.update(tenant_id, follow_id, body, current_user)
    except NotFoundError as e:
        raise HTTPException(status_code=status.HTTP_404_NOT_FOUND, detail=str(e))
    except ValidationError as e:
        raise HTTPException(status_code=status.HTTP_400_BAD_REQUEST, detail=str(e))


@router.delete("/{follow_id}", summary="删除客户跟进")
async def delete_follow_up(
    follow_id: int = Path(..., description="跟进记录ID"),
    current_user: User = Depends(get_current_user),
    tenant_id: int = Depends(get_current_tenant),
):
    try:
        await _service.delete(tenant_id, follow_id, current_user)
        return {"ok": True}
    except NotFoundError as e:
        raise HTTPException(status_code=status.HTTP_404_NOT_FOUND, detail=str(e))
    except ValidationError as e:
        raise HTTPException(status_code=status.HTTP_400_BAD_REQUEST, detail=str(e))
