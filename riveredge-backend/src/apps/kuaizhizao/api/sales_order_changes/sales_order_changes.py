"""销售变更单 API"""

from datetime import date
from typing import List, Optional

from fastapi import APIRouter, Depends, Path, Query, status as http_status, HTTPException
from fastapi.responses import HTMLResponse, JSONResponse

from core.api.deps import get_current_tenant, get_current_user
from core.api.deps.access import require_permission_codes
from apps.kuaizhizao.api._kuaizhizao_route_access import require_kuaizhizao_module_access
from infra.exceptions.exceptions import BusinessLogicError, NotFoundError, ValidationError
from infra.models.user import User
from apps.kuaizhizao.schemas.order_change import (
    ApproveChangeRequest,
    ChangeImpactPreviewResponse,
    SalesOrderChangeCreate,
    SalesOrderChangeListResponse,
    SalesOrderChangePagedListResponse,
    SalesOrderChangeUpdate,
    SalesOrderChangeWithItemsResponse,
)
from apps.kuaizhizao.services.sales_order_change_service import (
    SalesOrderChangeService,
    SALES_ORDER_CHANGE_SORTABLE_FIELDS,
)

router = APIRouter(prefix="/sales-order-change-orders", tags=["App · Kuaige Zhizao · Sales Order Change"])
service = SalesOrderChangeService()


@router.post("/from-order/{order_id}", response_model=SalesOrderChangeWithItemsResponse)
async def create_from_order(
    order_id: int = Path(...),
    change_reason: str = Query("订单变更"),
    current_user: User = Depends(get_current_user),
    tenant_id: int = Depends(get_current_tenant),
    _: None = Depends(require_kuaizhizao_module_access("sales-order-change")),
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
    _: None = Depends(require_kuaizhizao_module_access("sales-order-change")),
):
    return await service.create_change_order(tenant_id, data, current_user.id)


@router.get("", response_model=SalesOrderChangePagedListResponse)
async def list_change_orders(
    skip: int = Query(0, ge=0),
    limit: int = Query(20, ge=1, le=1000),
    source_order_id: Optional[int] = Query(None),
    status: Optional[str] = Query(None),
    lifecycle_stage: Optional[str] = Query(None, description="生命周期阶段：draft/applied/rejected"),
    customer_id: Optional[int] = Query(None, description="客户 ID"),
    change_category: Optional[str] = Query(None, description="变更类别"),
    keyword: Optional[str] = Query(None, description="关键词（变更单号、客户、源订单、变更原因）"),
    change_code: Optional[str] = Query(None, description="变更单号（模糊）"),
    source_order_code: Optional[str] = Query(None, description="源销售订单号（模糊）"),
    start_date: Optional[date] = Query(None, description="创建日期起"),
    end_date: Optional[date] = Query(None, description="创建日期止"),
    order_by: Optional[str] = Query(None, description="排序字段，如 created_at、-applied_at（前缀-表示降序）"),
    tenant_id: int = Depends(get_current_tenant),
    _: None = Depends(require_kuaizhizao_module_access("sales-order-change")),
):
    safe_order_by = None
    if order_by:
        field = order_by.lstrip("-")
        if field in SALES_ORDER_CHANGE_SORTABLE_FIELDS:
            safe_order_by = order_by
    items, total = await service.list_change_orders(
        tenant_id,
        skip=skip,
        limit=limit,
        source_order_id=source_order_id,
        status=status,
        lifecycle_stage=lifecycle_stage,
        customer_id=customer_id,
        change_category=change_category,
        keyword=keyword,
        change_code=change_code,
        source_order_code=source_order_code,
        start_date=start_date,
        end_date=end_date,
        order_by=safe_order_by,
    )
    return SalesOrderChangePagedListResponse(items=items, total=total)


@router.get("/by-order/{order_id}", response_model=List[SalesOrderChangeListResponse])
async def list_by_order(
    order_id: int = Path(...),
    tenant_id: int = Depends(get_current_tenant),
    _: None = Depends(require_kuaizhizao_module_access("sales-order-change")),
):
    return await service.list_by_order(tenant_id, order_id)


@router.get("/{change_id}", response_model=SalesOrderChangeWithItemsResponse)
async def get_change_order(
    change_id: int = Path(...),
    tenant_id: int = Depends(get_current_tenant),
    _: None = Depends(require_kuaizhizao_module_access("sales-order-change")),
):
    return await service.get_by_id(tenant_id, change_id)


@router.put("/{change_id}", response_model=SalesOrderChangeWithItemsResponse)
async def update_change_order(
    change_id: int,
    data: SalesOrderChangeUpdate,
    current_user: User = Depends(get_current_user),
    tenant_id: int = Depends(get_current_tenant),
    _: None = Depends(require_kuaizhizao_module_access("sales-order-change")),
):
    return await service.update_change_order(tenant_id, change_id, data, current_user.id)


@router.delete("/{change_id}", status_code=http_status.HTTP_204_NO_CONTENT)
async def delete_change_order(
    change_id: int,
    tenant_id: int = Depends(get_current_tenant),
    _: None = Depends(require_kuaizhizao_module_access("sales-order-change")),
):
    await service.delete_change_order(tenant_id, change_id)


@router.post("/{change_id}/submit", response_model=SalesOrderChangeWithItemsResponse)
async def submit_change_order(
    change_id: int,
    current_user: User = Depends(get_current_user),
    tenant_id: int = Depends(get_current_tenant),
    _: None = Depends(require_kuaizhizao_module_access("sales-order-change")),
):
    return await service.submit(tenant_id, change_id, current_user.id)


@router.post("/{change_id}/approve", response_model=SalesOrderChangeWithItemsResponse)
async def approve_change_order(
    change_id: int,
    body: ApproveChangeRequest,
    current_user: User = Depends(get_current_user),
    tenant_id: int = Depends(get_current_tenant),
    _: None = Depends(require_kuaizhizao_module_access("sales-order-change")),
):
    return await service.approve(tenant_id, change_id, body, current_user.id)


@router.post("/{change_id}/withdraw", response_model=SalesOrderChangeWithItemsResponse)
async def withdraw_change_order(
    change_id: int,
    current_user: User = Depends(get_current_user),
    tenant_id: int = Depends(get_current_tenant),
    _: None = Depends(require_kuaizhizao_module_access("sales-order-change")),
):
    return await service.withdraw(tenant_id, change_id, current_user.id)


@router.post("/{change_id}/apply", response_model=SalesOrderChangeWithItemsResponse)
async def apply_change_order(
    change_id: int,
    current_user: User = Depends(get_current_user),
    tenant_id: int = Depends(get_current_tenant),
    _: None = Depends(require_kuaizhizao_module_access("sales-order-change")),
):
    return await service.apply(tenant_id, change_id, current_user.id)


@router.post("/{change_id}/preview-impact", response_model=ChangeImpactPreviewResponse)
async def preview_impact(
    change_id: int,
    tenant_id: int = Depends(get_current_tenant),
    _: None = Depends(require_kuaizhizao_module_access("sales-order-change")),
):
    return await service.preview_impact(tenant_id, change_id)


@router.get(
    "/{change_id}/print",
    summary="Print sales order change",
    dependencies=[Depends(require_permission_codes("kuaizhizao:sales-order-change:print"))],
)
async def print_sales_order_change(
    change_id: int = Path(..., description="销售变更单ID"),
    template_code: Optional[str] = Query(None, description="打印模板代码"),
    template_uuid: Optional[str] = Query(None, description="打印模板UUID"),
    output_format: str = Query("html", description="输出格式"),
    response_format: str = Query("json", description="响应格式"),
    current_user: User = Depends(get_current_user),
    tenant_id: int = Depends(get_current_tenant),
    _: None = Depends(require_kuaizhizao_module_access("sales-order-change")),
):
    from apps.kuaizhizao.services.print_service import DocumentPrintService

    try:
        result = await DocumentPrintService().print_document(
            tenant_id=tenant_id,
            document_type="sales_order_change",
            document_id=change_id,
            template_code=template_code,
            template_uuid=template_uuid,
            output_format=output_format,
        )
    except NotFoundError as e:
        raise HTTPException(status_code=http_status.HTTP_404_NOT_FOUND, detail=str(e))
    except ValidationError as e:
        raise HTTPException(status_code=http_status.HTTP_400_BAD_REQUEST, detail=str(e))

    if response_format == "html":
        return HTMLResponse(content=result.get("content", ""), status_code=200)
    return JSONResponse(content=result, status_code=200)
