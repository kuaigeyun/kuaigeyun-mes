"""货运单 API"""

from typing import Optional

from fastapi import APIRouter, Depends, HTTPException, Path, Query, status

from apps.kuaizhizao.api._kuaizhizao_route_access import require_kuaizhizao_module_access
from apps.kuaizhizao.schemas.logistics import (
    FreightOrderCreate,
    FreightOrderListResponse,
    FreightOrderReceiptCreate,
    FreightOrderUpdate,
    FreightPullCandidateListResponse,
    FreightTrackingEventCreate,
)
from apps.kuaizhizao.services.freight_order_service import FreightOrderService
from core.api.deps import get_current_tenant, get_current_user
from infra.exceptions.exceptions import BusinessLogicError, NotFoundError
from infra.models.user import User

service = FreightOrderService()
router = APIRouter(
    prefix="/logistics/freight-orders",
    tags=["App - Kuaige Zhizao - Freight Order"],
    dependencies=[Depends(require_kuaizhizao_module_access("freight-order"))],
)


@router.get("/pull-candidates", response_model=FreightPullCandidateListResponse)
async def list_pull_candidates(
    business_direction: Optional[str] = Query(None),
    keyword: Optional[str] = Query(None),
    skip: int = Query(0, ge=0),
    limit: int = Query(50, ge=1, le=200),
    tenant_id: int = Depends(get_current_tenant),
):
    return await service.list_pull_candidates(
        tenant_id,
        business_direction=business_direction,
        keyword=keyword,
        skip=skip,
        limit=limit,
    )


@router.get("")
async def list_freight_orders(
    skip: int = Query(0, ge=0),
    limit: int = Query(20, ge=1, le=200),
    keyword: Optional[str] = Query(None),
    status: Optional[str] = Query(None),
    status_in: Optional[str] = Query(None, description="逗号分隔多状态"),
    business_direction: Optional[str] = Query(None),
    uuid: Optional[str] = Query(None),
    tenant_id: int = Depends(get_current_tenant),
):
    return await service.list_orders(
        tenant_id,
        skip=skip,
        limit=limit,
        keyword=keyword,
        status=status,
        status_in=status_in,
        business_direction=business_direction,
        uuid=uuid,
    )


@router.get("/lookup-by-source")
async def lookup_freight_order_by_source(
    source_type: str = Query(...),
    source_id: int = Query(...),
    tenant_id: int = Depends(get_current_tenant),
):
    row = await service.find_order_by_source(
        tenant_id,
        source_type=source_type,
        source_id=source_id,
    )
    if not row:
        raise HTTPException(status_code=status.HTTP_404_NOT_FOUND, detail="未找到关联货运单")
    return row


@router.get("/{order_id}")
async def get_freight_order(order_id: int = Path(...), tenant_id: int = Depends(get_current_tenant)):
    try:
        return await service.get_order(tenant_id, order_id)
    except NotFoundError as e:
        raise HTTPException(status_code=status.HTTP_404_NOT_FOUND, detail=str(e))


@router.post("")
async def create_freight_order(
    data: FreightOrderCreate,
    current_user: User = Depends(get_current_user),
    tenant_id: int = Depends(get_current_tenant),
):
    try:
        return await service.create_order(tenant_id, data, created_by=current_user.id)
    except (BusinessLogicError, NotFoundError) as e:
        code = status.HTTP_404_NOT_FOUND if isinstance(e, NotFoundError) else status.HTTP_400_BAD_REQUEST
        raise HTTPException(status_code=code, detail=str(e))


@router.put("/{order_id}")
async def update_freight_order(
    data: FreightOrderUpdate,
    order_id: int = Path(...),
    current_user: User = Depends(get_current_user),
    tenant_id: int = Depends(get_current_tenant),
):
    try:
        return await service.update_order(tenant_id, order_id, data, updated_by=current_user.id)
    except (BusinessLogicError, NotFoundError) as e:
        code = status.HTTP_404_NOT_FOUND if isinstance(e, NotFoundError) else status.HTTP_400_BAD_REQUEST
        raise HTTPException(status_code=code, detail=str(e))


@router.delete("/{order_id}")
async def delete_freight_order(order_id: int = Path(...), tenant_id: int = Depends(get_current_tenant)):
    try:
        await service.delete_order(tenant_id, order_id)
        return {"success": True}
    except (BusinessLogicError, NotFoundError) as e:
        code = status.HTTP_404_NOT_FOUND if isinstance(e, NotFoundError) else status.HTTP_400_BAD_REQUEST
        raise HTTPException(status_code=code, detail=str(e))


@router.post("/{order_id}/dispatch")
async def dispatch_freight_order(
    order_id: int = Path(...),
    current_user: User = Depends(get_current_user),
    tenant_id: int = Depends(get_current_tenant),
):
    try:
        return await service.dispatch_order(tenant_id, order_id, operator_id=current_user.id)
    except (BusinessLogicError, NotFoundError) as e:
        code = status.HTTP_404_NOT_FOUND if isinstance(e, NotFoundError) else status.HTTP_400_BAD_REQUEST
        raise HTTPException(status_code=code, detail=str(e))


@router.post("/{order_id}/ship")
async def ship_freight_order(
    order_id: int = Path(...),
    current_user: User = Depends(get_current_user),
    tenant_id: int = Depends(get_current_tenant),
):
    try:
        user = await service.get_user_info(current_user.id)
        return await service.ship_order(
            tenant_id,
            order_id,
            operator_id=current_user.id,
            operator_name=user["name"],
        )
    except (BusinessLogicError, NotFoundError) as e:
        code = status.HTTP_404_NOT_FOUND if isinstance(e, NotFoundError) else status.HTTP_400_BAD_REQUEST
        raise HTTPException(status_code=code, detail=str(e))


@router.post("/{order_id}/in-transit")
async def mark_in_transit(
    order_id: int = Path(...),
    current_user: User = Depends(get_current_user),
    tenant_id: int = Depends(get_current_tenant),
):
    try:
        user = await service.get_user_info(current_user.id)
        return await service.mark_in_transit(
            tenant_id,
            order_id,
            operator_id=current_user.id,
            operator_name=user["name"],
        )
    except (BusinessLogicError, NotFoundError) as e:
        code = status.HTTP_404_NOT_FOUND if isinstance(e, NotFoundError) else status.HTTP_400_BAD_REQUEST
        raise HTTPException(status_code=code, detail=str(e))


@router.post("/{order_id}/arrive")
async def arrive_freight_order(
    order_id: int = Path(...),
    current_user: User = Depends(get_current_user),
    tenant_id: int = Depends(get_current_tenant),
):
    try:
        user = await service.get_user_info(current_user.id)
        return await service.arrive_order(
            tenant_id,
            order_id,
            operator_id=current_user.id,
            operator_name=user["name"],
        )
    except (BusinessLogicError, NotFoundError) as e:
        code = status.HTTP_404_NOT_FOUND if isinstance(e, NotFoundError) else status.HTTP_400_BAD_REQUEST
        raise HTTPException(status_code=code, detail=str(e))


@router.post("/{order_id}/sign-receipt")
async def sign_freight_receipt(
    data: FreightOrderReceiptCreate,
    order_id: int = Path(...),
    current_user: User = Depends(get_current_user),
    tenant_id: int = Depends(get_current_tenant),
):
    try:
        user = await service.get_user_info(current_user.id)
        return await service.sign_receipt(
            tenant_id,
            order_id,
            data,
            operator_id=current_user.id,
            operator_name=user["name"],
        )
    except (BusinessLogicError, NotFoundError) as e:
        code = status.HTTP_404_NOT_FOUND if isinstance(e, NotFoundError) else status.HTTP_400_BAD_REQUEST
        raise HTTPException(status_code=code, detail=str(e))


@router.post("/{order_id}/tracking-events/{event_id}/remove")
async def delete_tracking_event(
    order_id: int = Path(...),
    event_id: int = Path(...),
    tenant_id: int = Depends(get_current_tenant),
):
    try:
        return await service.delete_tracking_event(tenant_id, order_id, event_id)
    except (BusinessLogicError, NotFoundError) as e:
        code = status.HTTP_404_NOT_FOUND if isinstance(e, NotFoundError) else status.HTTP_400_BAD_REQUEST
        raise HTTPException(status_code=code, detail=str(e))


@router.post("/{order_id}/tracking-events")
async def add_tracking_event(
    data: FreightTrackingEventCreate,
    order_id: int = Path(...),
    current_user: User = Depends(get_current_user),
    tenant_id: int = Depends(get_current_tenant),
):
    try:
        user = await service.get_user_info(current_user.id)
        return await service.add_tracking_event(
            tenant_id,
            order_id,
            data,
            operator_id=current_user.id,
            operator_name=user["name"],
        )
    except (BusinessLogicError, NotFoundError) as e:
        code = status.HTTP_404_NOT_FOUND if isinstance(e, NotFoundError) else status.HTTP_400_BAD_REQUEST
        raise HTTPException(status_code=code, detail=str(e))


@router.post("/{order_id}/cancel")
async def cancel_freight_order(order_id: int = Path(...), tenant_id: int = Depends(get_current_tenant)):
    try:
        return await service.cancel_order(tenant_id, order_id)
    except (BusinessLogicError, NotFoundError) as e:
        code = status.HTTP_404_NOT_FOUND if isinstance(e, NotFoundError) else status.HTTP_400_BAD_REQUEST
        raise HTTPException(status_code=code, detail=str(e))
