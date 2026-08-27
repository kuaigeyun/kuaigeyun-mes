"""采购变更单 API"""

from datetime import date
from typing import List, Optional

from fastapi import APIRouter, Depends, Path, Query, status as http_status

from core.api.deps import get_current_tenant, get_current_user
from apps.kuaizhizao.api._kuaizhizao_route_access import require_kuaizhizao_module_access
from infra.exceptions.exceptions import BusinessLogicError
from infra.models.user import User
from apps.kuaizhizao.schemas.order_change import (
    ApproveChangeRequest,
    ChangeImpactPreviewResponse,
    PurchaseOrderChangeCreate,
    PurchaseOrderChangeListResponse,
    PurchaseOrderChangePagedListResponse,
    PurchaseOrderChangeUpdate,
    PurchaseOrderChangeWithItemsResponse,
)
from apps.kuaizhizao.services.purchase_order_change_service import (
    PurchaseOrderChangeService,
    PURCHASE_ORDER_CHANGE_SORTABLE_FIELDS,
)

router = APIRouter(prefix="/purchase-order-change-orders", tags=["App - Kuaige Zhizao - Purchase Order Change"])
service = PurchaseOrderChangeService()


@router.get("/from-order/{order_id}/preview")
async def preview_from_order(
    order_id: int = Path(...),
    tenant_id: int = Depends(get_current_tenant),
    _: None = Depends(require_kuaizhizao_module_access("purchase-order-change")),
):
    return await service.preview_from_order(tenant_id, order_id)


@router.post("/from-order/{order_id}", response_model=PurchaseOrderChangeWithItemsResponse)
async def create_from_order(
    order_id: int = Path(...),
    change_reason: str = Query("订单变更"),
    current_user: User = Depends(get_current_user),
    tenant_id: int = Depends(get_current_tenant),
    _: None = Depends(require_kuaizhizao_module_access("purchase-order-change")),
):
    return await service.create_from_order(tenant_id, order_id, current_user.id, change_reason)


@router.post("", response_model=PurchaseOrderChangeWithItemsResponse)
async def create_change_order(
    data: PurchaseOrderChangeCreate,
    current_user: User = Depends(get_current_user),
    tenant_id: int = Depends(get_current_tenant),
    _: None = Depends(require_kuaizhizao_module_access("purchase-order-change")),
):
    return await service.create_change_order(tenant_id, data, current_user.id)


@router.get("", response_model=PurchaseOrderChangePagedListResponse)
async def list_change_orders(
    skip: int = Query(0, ge=0),
    limit: int = Query(20, ge=1, le=1000),
    source_order_id: Optional[int] = Query(None),
    status: Optional[str] = Query(None),
    lifecycle_stage: Optional[str] = Query(None, description="生命周期阶段：draft/applied/rejected"),
    supplier_id: Optional[int] = Query(None, description="供应商 ID"),
    change_category: Optional[str] = Query(None, description="变更类别"),
    keyword: Optional[str] = Query(None, description="关键词（变更单号、供应商、源订单、变更原因）"),
    change_code: Optional[str] = Query(None, description="变更单号（模糊）"),
    source_order_code: Optional[str] = Query(None, description="源采购订单号（模糊）"),
    start_date: Optional[date] = Query(None, description="创建日期起"),
    end_date: Optional[date] = Query(None, description="创建日期止"),
    order_by: Optional[str] = Query(None, description="排序字段，如 created_at、-applied_at"),
    include_items: bool = Query(False, description="是否附带明细预览（列表物料名）"),
    tenant_id: int = Depends(get_current_tenant),
    _: None = Depends(require_kuaizhizao_module_access("purchase-order-change")),
):
    safe_order_by = None
    if order_by:
        field = order_by.lstrip("-")
        if field in PURCHASE_ORDER_CHANGE_SORTABLE_FIELDS:
            safe_order_by = order_by
    items, total = await service.list_change_orders(
        tenant_id,
        skip=skip,
        limit=limit,
        source_order_id=source_order_id,
        status=status,
        lifecycle_stage=lifecycle_stage,
        supplier_id=supplier_id,
        change_category=change_category,
        keyword=keyword,
        change_code=change_code,
        source_order_code=source_order_code,
        start_date=start_date,
        end_date=end_date,
        order_by=safe_order_by,
        include_items=include_items,
    )
    return PurchaseOrderChangePagedListResponse(items=items, total=total)


@router.get("/by-order/{order_id}", response_model=List[PurchaseOrderChangeListResponse])
async def list_by_order(
    order_id: int = Path(...),
    tenant_id: int = Depends(get_current_tenant),
    _: None = Depends(require_kuaizhizao_module_access("purchase-order-change")),
):
    return await service.list_by_order(tenant_id, order_id)


@router.get("/{change_id}", response_model=PurchaseOrderChangeWithItemsResponse)
async def get_change_order(
    change_id: int = Path(...),
    tenant_id: int = Depends(get_current_tenant),
    _: None = Depends(require_kuaizhizao_module_access("purchase-order-change")),
):
    return await service.get_by_id(tenant_id, change_id)


@router.put("/{change_id}", response_model=PurchaseOrderChangeWithItemsResponse)
async def update_change_order(
    change_id: int,
    data: PurchaseOrderChangeUpdate,
    current_user: User = Depends(get_current_user),
    tenant_id: int = Depends(get_current_tenant),
    _: None = Depends(require_kuaizhizao_module_access("purchase-order-change")),
):
    return await service.update_change_order(tenant_id, change_id, data, current_user.id)


@router.delete("/{change_id}", status_code=http_status.HTTP_204_NO_CONTENT)
async def delete_change_order(
    change_id: int,
    tenant_id: int = Depends(get_current_tenant),
    _: None = Depends(require_kuaizhizao_module_access("purchase-order-change")),
):
    await service.delete_change_order(tenant_id, change_id)


@router.post("/{change_id}/submit", response_model=PurchaseOrderChangeWithItemsResponse)
async def submit_change_order(
    change_id: int,
    current_user: User = Depends(get_current_user),
    tenant_id: int = Depends(get_current_tenant),
    _: None = Depends(require_kuaizhizao_module_access("purchase-order-change")),
):
    return await service.submit(tenant_id, change_id, current_user.id)


@router.post("/{change_id}/approve", response_model=PurchaseOrderChangeWithItemsResponse)
async def approve_change_order(
    change_id: int,
    body: ApproveChangeRequest,
    current_user: User = Depends(get_current_user),
    tenant_id: int = Depends(get_current_tenant),
    _: None = Depends(require_kuaizhizao_module_access("purchase-order-change")),
):
    return await service.approve(tenant_id, change_id, body, current_user.id)


@router.post("/{change_id}/withdraw", response_model=PurchaseOrderChangeWithItemsResponse)
async def withdraw_change_order(
    change_id: int,
    current_user: User = Depends(get_current_user),
    tenant_id: int = Depends(get_current_tenant),
    _: None = Depends(require_kuaizhizao_module_access("purchase-order-change")),
):
    return await service.withdraw(tenant_id, change_id, current_user.id)


@router.post("/{change_id}/apply", response_model=PurchaseOrderChangeWithItemsResponse)
async def apply_change_order(
    change_id: int,
    current_user: User = Depends(get_current_user),
    tenant_id: int = Depends(get_current_tenant),
    _: None = Depends(require_kuaizhizao_module_access("purchase-order-change")),
):
    return await service.apply(tenant_id, change_id, current_user.id)


@router.post("/{change_id}/preview-impact", response_model=ChangeImpactPreviewResponse)
async def preview_impact(
    change_id: int,
    tenant_id: int = Depends(get_current_tenant),
    _: None = Depends(require_kuaizhizao_module_access("purchase-order-change")),
):
    return await service.preview_impact(tenant_id, change_id)
