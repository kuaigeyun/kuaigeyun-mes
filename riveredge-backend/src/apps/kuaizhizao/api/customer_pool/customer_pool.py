"""
客户池 API。
"""

from __future__ import annotations

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
from apps.kuaizhizao.services.customer_pool_service import CustomerPoolService
from core.api.deps import get_current_tenant, get_current_user
from core.api.deps.access import require_access, require_module_access
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
    salesman_id: Optional[int] = Query(None, alias="salesmanId", ge=1, description="归属业务员"),
    pool_status: Optional[str] = Query(None, alias="poolStatus", description="pool/owned"),
    current_user: User = Depends(get_current_user),
    tenant_id: int = Depends(get_current_tenant),
    _auth: object = Depends(require_module_access("kuaizhizao", "customer-pool")),
):
    return await CustomerPoolService.list_customers(
        tenant_id=tenant_id,
        current_user=current_user,
        scope=scope,
        skip=skip,
        limit=limit,
        keyword=keyword,
        salesman_id=salesman_id,
        pool_status=pool_status,
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
    _auth: object = Depends(require_module_access("kuaizhizao", "customer-pool")),
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

