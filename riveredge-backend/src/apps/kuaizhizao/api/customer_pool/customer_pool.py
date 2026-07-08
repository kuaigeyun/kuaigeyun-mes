"""
客户池 API。
"""

from __future__ import annotations

from datetime import datetime
from typing import Optional

from fastapi import APIRouter, Depends, Path, Query, status as http_status
from fastapi import HTTPException

from apps.kuaizhizao.schemas.customer_pool import (
    CustomerPoolActionBody,
    CustomerPoolAssignBody,
    CustomerPoolListEnvelope,
    CustomerPoolItem,
    CustomerPoolRuleResponse,
    CustomerPoolRuleUpdateBody,
)
from apps.kuaizhizao.services.customer_pool_list_core import CUSTOMER_POOL_SORTABLE_FIELDS
from apps.kuaizhizao.services.customer_pool_service import CustomerPoolService
from core.api.deps import get_current_tenant, get_current_user
from core.api.deps.access import require_access
from apps.kuaizhizao.api._kuaizhizao_route_access import require_kuaizhizao_module_access
from infra.exceptions.exceptions import NotFoundError, ValidationError
from infra.models.user import User

router = APIRouter(
    prefix="/customer-pool",
    tags=["App · Kuaige Zhizao · Customer Pool"],
)


@router.get("", response_model=CustomerPoolListEnvelope, summary="List customer pool")
async def list_customer_pool(
    scope: str = Query("pool", description="pool/mine/all"),
    skip: int = Query(0, ge=0),
    limit: int = Query(20, ge=1, le=200),
    keyword: Optional[str] = Query(None),
    code: Optional[str] = Query(None, description="客户编码（模糊）"),
    name: Optional[str] = Query(None, description="客户名称（模糊）"),
    contact_person: Optional[str] = Query(None, description="联系人（模糊）"),
    phone: Optional[str] = Query(None, description="电话（模糊）"),
    salesman_id: Optional[int] = Query(None, alias="salesmanId", ge=1, description="归属业务员"),
    pool_status: Optional[str] = Query(None, alias="poolStatus", description="pool/owned"),
    last_follow_up_from: Optional[datetime] = Query(None),
    last_follow_up_to: Optional[datetime] = Query(None),
    recycle_from: Optional[datetime] = Query(None),
    recycle_to: Optional[datetime] = Query(None),
    assigned_from: Optional[datetime] = Query(None),
    assigned_to: Optional[datetime] = Query(None),
    created_start_date: Optional[str] = Query(None),
    created_end_date: Optional[str] = Query(None),
    updated_start_date: Optional[str] = Query(None),
    updated_end_date: Optional[str] = Query(None),
    order_by: Optional[str] = Query(None, description="排序字段，如 code、-last_follow_up_at"),
    current_user: User = Depends(get_current_user),
    tenant_id: int = Depends(get_current_tenant),
    _auth: object = Depends(require_kuaizhizao_module_access("customer-pool")),
):
    safe_order_by = None
    if order_by:
        field = order_by.lstrip("-")
        if field in CUSTOMER_POOL_SORTABLE_FIELDS:
            safe_order_by = order_by

    return await CustomerPoolService.list_customers(
        tenant_id=tenant_id,
        current_user=current_user,
        scope=scope,
        skip=skip,
        limit=limit,
        keyword=keyword,
        code=code,
        name=name,
        contact_person=contact_person,
        phone=phone,
        salesman_id=salesman_id,
        pool_status=pool_status,
        last_follow_up_from=last_follow_up_from,
        last_follow_up_to=last_follow_up_to,
        recycle_from=recycle_from,
        recycle_to=recycle_to,
        assigned_from=assigned_from,
        assigned_to=assigned_to,
        created_start_date=created_start_date,
        created_end_date=created_end_date,
        updated_start_date=updated_start_date,
        updated_end_date=updated_end_date,
        order_by=safe_order_by,
    )


@router.post(
    "/{customer_id}/claim",
    response_model=CustomerPoolItem,
    summary="Claim customer from pool",
    dependencies=[
        Depends(
            require_access(
                "kuaizhizao:customer-pool",
                "update",
                required_permissions=["kuaizhizao:customer-pool:claim"],
            )
        )
    ],
)
async def claim_customer(
    body: CustomerPoolActionBody,
    customer_id: int = Path(..., ge=1),
    current_user: User = Depends(get_current_user),
    tenant_id: int = Depends(get_current_tenant),
):
    try:
        return await CustomerPoolService.claim_customer(
            tenant_id=tenant_id,
            customer_id=customer_id,
            current_user=current_user,
            body=body,
        )
    except NotFoundError as e:
        raise HTTPException(status_code=http_status.HTTP_404_NOT_FOUND, detail=str(e))
    except ValidationError as e:
        raise HTTPException(status_code=http_status.HTTP_400_BAD_REQUEST, detail=str(e))


@router.post(
    "/{customer_id}/assign",
    response_model=CustomerPoolItem,
    summary="Assign customer owner",
    dependencies=[
        Depends(
            require_access(
                "kuaizhizao:customer-pool",
                "update",
                required_permissions=["kuaizhizao:customer-pool:assign"],
            )
        )
    ],
)
async def assign_customer(
    body: CustomerPoolAssignBody,
    customer_id: int = Path(..., ge=1),
    current_user: User = Depends(get_current_user),
    tenant_id: int = Depends(get_current_tenant),
):
    try:
        return await CustomerPoolService.assign_customer(
            tenant_id=tenant_id,
            customer_id=customer_id,
            current_user=current_user,
            body=body,
        )
    except NotFoundError as e:
        raise HTTPException(status_code=http_status.HTTP_404_NOT_FOUND, detail=str(e))
    except ValidationError as e:
        raise HTTPException(status_code=http_status.HTTP_400_BAD_REQUEST, detail=str(e))


@router.post(
    "/{customer_id}/release",
    response_model=CustomerPoolItem,
    summary="Release customer to pool",
    dependencies=[
        Depends(
            require_access(
                "kuaizhizao:customer-pool",
                "update",
                required_permissions=["kuaizhizao:customer-pool:release"],
            )
        )
    ],
)
async def release_customer(
    body: CustomerPoolActionBody,
    customer_id: int = Path(..., ge=1),
    current_user: User = Depends(get_current_user),
    tenant_id: int = Depends(get_current_tenant),
):
    try:
        return await CustomerPoolService.release_customer(
            tenant_id=tenant_id,
            customer_id=customer_id,
            current_user=current_user,
            body=body,
        )
    except NotFoundError as e:
        raise HTTPException(status_code=http_status.HTTP_404_NOT_FOUND, detail=str(e))
    except ValidationError as e:
        raise HTTPException(status_code=http_status.HTTP_400_BAD_REQUEST, detail=str(e))


@router.post(
    "/{customer_id}/recycle",
    response_model=CustomerPoolItem,
    summary="Recycle customer to pool",
    dependencies=[
        Depends(
            require_access(
                "kuaizhizao:customer-pool",
                "update",
                required_permissions=["kuaizhizao:customer-pool:recycle"],
            )
        )
    ],
)
async def recycle_customer(
    body: CustomerPoolActionBody,
    customer_id: int = Path(..., ge=1),
    current_user: User = Depends(get_current_user),
    tenant_id: int = Depends(get_current_tenant),
):
    try:
        return await CustomerPoolService.recycle_customer(
            tenant_id=tenant_id,
            customer_id=customer_id,
            current_user=current_user,
            body=body,
        )
    except NotFoundError as e:
        raise HTTPException(status_code=http_status.HTTP_404_NOT_FOUND, detail=str(e))
    except ValidationError as e:
        raise HTTPException(status_code=http_status.HTTP_400_BAD_REQUEST, detail=str(e))


@router.get(
    "/rules",
    response_model=CustomerPoolRuleResponse,
    summary="Get customer pool rule",
)
async def get_pool_rules(
    current_user: User = Depends(get_current_user),
    tenant_id: int = Depends(get_current_tenant),
    _auth: object = Depends(require_kuaizhizao_module_access("customer-pool")),
):
    return await CustomerPoolService.get_rule(tenant_id=tenant_id)


@router.put(
    "/rules",
    response_model=CustomerPoolRuleResponse,
    summary="Update customer pool rule",
    dependencies=[
        Depends(
            require_access(
                "kuaizhizao:customer-pool",
                "update",
                required_permissions=["kuaizhizao:customer-pool:update"],
            )
        )
    ],
)
async def update_pool_rules(
    body: CustomerPoolRuleUpdateBody,
    current_user: User = Depends(get_current_user),
    tenant_id: int = Depends(get_current_tenant),
):
    return await CustomerPoolService.update_rule(
        tenant_id=tenant_id,
        current_user=current_user,
        body=body,
    )

