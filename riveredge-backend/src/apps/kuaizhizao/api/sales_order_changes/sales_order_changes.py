"""销售变更单 API"""

from typing import List, Optional

from fastapi import APIRouter, Depends, Path, Query, status as http_status

from core.api.deps import get_current_tenant, get_current_user
from core.api.deps.access import require_module_access
from infra.exceptions.exceptions import BusinessLogicError, NotFoundError
from infra.models.user import User
from apps.kuaizhizao.schemas.order_change import (
    ApproveChangeRequest,
    ChangeImpactPreviewResponse,
    SalesOrderChangeCreate,
    SalesOrderChangeListResponse,
    SalesOrderChangeUpdate,
    SalesOrderChangeWithItemsResponse,
)
from apps.kuaizhizao.services.sales_order_change_service import SalesOrderChangeService

router = APIRouter(prefix="/sales-order-change-orders", tags=["App · Kuaige Zhizao · Sales Order Change"])
service = SalesOrderChangeService()


@router.post("/from-order/{order_id}", response_model=SalesOrderChangeWithItemsResponse)
async def create_from_order(
    order_id: int = Path(...),
    change_reason: str = Query("订单变更"),
    current_user: User = Depends(get_current_user),
    tenant_id: int = Depends(get_current_tenant),
    _: None = Depends(require_module_access("kuaizhizao", "sales-order-change")),
):
    try:
        return await service.create_from_order(tenant_id, order_id, current_user.id, change_reason)
    except (BusinessLogicError, NotFoundError) as e:
        raise BusinessLogicError(str(e)) from e


@router.post("", response_model=SalesOrderChangeWithItemsResponse)
async def create_change_order(
    data: SalesOrderChangeCreate,
    current_user: User = Depends(get_current_user),
    tenant_id: int = Depends(get_current_tenant),
    _: None = Depends(require_module_access("kuaizhizao", "sales-order-change")),
):
    return await service.create_change_order(tenant_id, data, current_user.id)


@router.get("", response_model=List[SalesOrderChangeListResponse])
async def list_change_orders(
    skip: int = Query(0, ge=0),
    limit: int = Query(20, ge=1, le=100),
    source_order_id: Optional[int] = Query(None),
    status: Optional[str] = Query(None),
    lifecycle_stage: Optional[str] = Query(None),
    tenant_id: int = Depends(get_current_tenant),
    _: None = Depends(require_module_access("kuaizhizao", "sales-order-change")),
):
    return await service.list_change_orders(
        tenant_id, skip=skip, limit=limit, source_order_id=source_order_id,
        status=status, lifecycle_stage=lifecycle_stage,
    )


@router.get("/by-order/{order_id}", response_model=List[SalesOrderChangeListResponse])
async def list_by_order(
    order_id: int = Path(...),
    tenant_id: int = Depends(get_current_tenant),
    _: None = Depends(require_module_access("kuaizhizao", "sales-order-change")),
):
    return await service.list_by_order(tenant_id, order_id)


@router.get("/{change_id}", response_model=SalesOrderChangeWithItemsResponse)
async def get_change_order(
    change_id: int = Path(...),
    tenant_id: int = Depends(get_current_tenant),
    _: None = Depends(require_module_access("kuaizhizao", "sales-order-change")),
):
    return await service.get_by_id(tenant_id, change_id)


@router.put("/{change_id}", response_model=SalesOrderChangeWithItemsResponse)
async def update_change_order(
    change_id: int,
    data: SalesOrderChangeUpdate,
    current_user: User = Depends(get_current_user),
    tenant_id: int = Depends(get_current_tenant),
    _: None = Depends(require_module_access("kuaizhizao", "sales-order-change")),
):
    return await service.update_change_order(tenant_id, change_id, data, current_user.id)


@router.delete("/{change_id}", status_code=http_status.HTTP_204_NO_CONTENT)
async def delete_change_order(
    change_id: int,
    tenant_id: int = Depends(get_current_tenant),
    _: None = Depends(require_module_access("kuaizhizao", "sales-order-change")),
):
    await service.delete_change_order(tenant_id, change_id)


@router.post("/{change_id}/submit", response_model=SalesOrderChangeWithItemsResponse)
async def submit_change_order(
    change_id: int,
    current_user: User = Depends(get_current_user),
    tenant_id: int = Depends(get_current_tenant),
    _: None = Depends(require_module_access("kuaizhizao", "sales-order-change")),
):
    return await service.submit(tenant_id, change_id, current_user.id)


@router.post("/{change_id}/approve", response_model=SalesOrderChangeWithItemsResponse)
async def approve_change_order(
    change_id: int,
    body: ApproveChangeRequest,
    current_user: User = Depends(get_current_user),
    tenant_id: int = Depends(get_current_tenant),
    _: None = Depends(require_module_access("kuaizhizao", "sales-order-change")),
):
    return await service.approve(tenant_id, change_id, body, current_user.id)


@router.post("/{change_id}/withdraw", response_model=SalesOrderChangeWithItemsResponse)
async def withdraw_change_order(
    change_id: int,
    current_user: User = Depends(get_current_user),
    tenant_id: int = Depends(get_current_tenant),
    _: None = Depends(require_module_access("kuaizhizao", "sales-order-change")),
):
    return await service.withdraw(tenant_id, change_id, current_user.id)


@router.post("/{change_id}/apply", response_model=SalesOrderChangeWithItemsResponse)
async def apply_change_order(
    change_id: int,
    current_user: User = Depends(get_current_user),
    tenant_id: int = Depends(get_current_tenant),
    _: None = Depends(require_module_access("kuaizhizao", "sales-order-change")),
):
    return await service.apply(tenant_id, change_id, current_user.id)


@router.post("/{change_id}/preview-impact", response_model=ChangeImpactPreviewResponse)
async def preview_impact(
    change_id: int,
    tenant_id: int = Depends(get_current_tenant),
    _: None = Depends(require_module_access("kuaizhizao", "sales-order-change")),
):
    return await service.preview_impact(tenant_id, change_id)
