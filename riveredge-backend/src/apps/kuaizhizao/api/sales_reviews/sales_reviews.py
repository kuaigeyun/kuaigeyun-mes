"""订单评审 API"""

from __future__ import annotations

import uuid
from typing import Any, Optional

from fastapi import APIRouter, Body, Depends, HTTPException as FastAPIHTTPException, Path, Query, status
from loguru import logger

from apps.kuaizhizao.api._kuaizhizao_route_access import require_kuaizhizao_module_access
from apps.kuaizhizao.schemas.sales_review import (
    SalesReviewCreate,
    SalesReviewDeptOpinionSubmit,
    SalesReviewListEnvelope,
    SalesReviewPushPreview,
    SalesReviewPushResult,
    SalesReviewRejectRequest,
    SalesReviewResponse,
    SalesReviewUpdate,
)
from apps.kuaizhizao.services.sales_review_service import (
    SALES_REVIEW_SORTABLE_FIELDS,
    SalesReviewService,
)
from core.api.deps import get_current_tenant, get_current_user
from infra.exceptions.exceptions import BusinessLogicError, NotFoundError, ValidationError
from infra.models.user import User

router = APIRouter(
    prefix="/sales-reviews",
    tags=["App - Kuaige Zhizao - Sales Review"],
    dependencies=[Depends(require_kuaizhizao_module_access("sales-review"))],
)

_service = SalesReviewService()


def _http_exception_with_trace(
    status_code: int,
    message: str,
    route: str = "/sales-reviews",
    tenant_id: Optional[int] = None,
) -> FastAPIHTTPException:
    trace_id = uuid.uuid4().hex
    logger.warning(
        "kuaizhizao_sales_reviews_api_error trace_id={} tenant_id={} route={} status_code={} message={}",
        trace_id,
        tenant_id,
        route,
        status_code,
        message,
    )
    return FastAPIHTTPException(
        status_code=status_code,
        detail={"message": message, "trace_id": trace_id},
    )


def HTTPException(*, status_code: int, detail: Any, **kwargs) -> FastAPIHTTPException:
    message = detail.get("message") if isinstance(detail, dict) else str(detail)
    return _http_exception_with_trace(status_code, message)


@router.post("", response_model=SalesReviewResponse, summary="Create sales review")
async def create_sales_review(
    body: SalesReviewCreate,
    current_user: User = Depends(get_current_user),
    tenant_id: int = Depends(get_current_tenant),
):
    try:
        return await _service.create(tenant_id, body, current_user)
    except (ValidationError, BusinessLogicError) as e:
        raise HTTPException(status_code=status.HTTP_400_BAD_REQUEST, detail=str(e))


@router.post("/pull-from-quotation", summary="Build sales review from quotation")
async def pull_sales_review_from_quotation(
    quotation_id: int = Body(..., embed=True, description="报价单ID"),
    current_user: User = Depends(get_current_user),
    tenant_id: int = Depends(get_current_tenant),
):
    try:
        return await _service.pull_from_quotation(tenant_id, quotation_id, current_user)
    except NotFoundError as e:
        raise HTTPException(status_code=status.HTTP_404_NOT_FOUND, detail=str(e))
    except (ValidationError, BusinessLogicError) as e:
        raise HTTPException(status_code=status.HTTP_400_BAD_REQUEST, detail=str(e))


@router.get("", response_model=SalesReviewListEnvelope, summary="List sales reviews")
async def list_sales_reviews(
    skip: int = Query(0, ge=0),
    limit: int = Query(50, ge=1, le=200),
    status_filter: Optional[str] = Query(None, alias="status"),
    customer_id: Optional[int] = Query(None),
    keyword: Optional[str] = Query(None),
    order_by: Optional[str] = Query(None),
    pullable_only: Optional[bool] = Query(
        None, description="仅可下推销售订单：评审已通过且未关联销售订单"
    ),
    current_user: User = Depends(get_current_user),
    tenant_id: int = Depends(get_current_tenant),
):
    safe_order_by = None
    if order_by:
        field = order_by.lstrip("-")
        if field in SALES_REVIEW_SORTABLE_FIELDS:
            safe_order_by = order_by
    return await _service.list_reviews(
        tenant_id,
        skip=skip,
        limit=limit,
        status=status_filter,
        customer_id=customer_id,
        keyword=keyword,
        order_by=safe_order_by,
        pullable_only=pullable_only,
        current_user=current_user,
    )


@router.get("/{review_id:int}", response_model=SalesReviewResponse, summary="Get sales review")
async def get_sales_review(
    review_id: int = Path(...),
    current_user: User = Depends(get_current_user),
    tenant_id: int = Depends(get_current_tenant),
):
    try:
        return await _service.get(tenant_id, review_id, current_user=current_user)
    except NotFoundError as e:
        raise HTTPException(status_code=status.HTTP_404_NOT_FOUND, detail=str(e))


@router.put("/{review_id:int}", response_model=SalesReviewResponse, summary="Update sales review")
async def update_sales_review(
    body: SalesReviewUpdate,
    review_id: int = Path(...),
    current_user: User = Depends(get_current_user),
    tenant_id: int = Depends(get_current_tenant),
):
    try:
        return await _service.update(tenant_id, review_id, body, current_user)
    except NotFoundError as e:
        raise HTTPException(status_code=status.HTTP_404_NOT_FOUND, detail=str(e))
    except (ValidationError, BusinessLogicError) as e:
        raise HTTPException(status_code=status.HTTP_400_BAD_REQUEST, detail=str(e))


@router.delete("/{review_id:int}", summary="Delete sales review")
async def delete_sales_review(
    review_id: int = Path(...),
    current_user: User = Depends(get_current_user),
    tenant_id: int = Depends(get_current_tenant),
):
    try:
        await _service.delete(tenant_id, review_id, current_user)
        return {"success": True}
    except NotFoundError as e:
        raise HTTPException(status_code=status.HTTP_404_NOT_FOUND, detail=str(e))
    except BusinessLogicError as e:
        raise HTTPException(status_code=status.HTTP_400_BAD_REQUEST, detail=str(e))


@router.post("/{review_id:int}/issue", response_model=SalesReviewResponse, summary="Issue sales review")
async def issue_sales_review(
    review_id: int = Path(...),
    current_user: User = Depends(get_current_user),
    tenant_id: int = Depends(get_current_tenant),
):
    try:
        return await _service.issue(tenant_id, review_id, current_user)
    except NotFoundError as e:
        raise HTTPException(status_code=status.HTTP_404_NOT_FOUND, detail=str(e))
    except BusinessLogicError as e:
        raise HTTPException(status_code=status.HTTP_400_BAD_REQUEST, detail=str(e))


@router.post(
    "/{review_id:int}/withdraw",
    response_model=SalesReviewResponse,
    summary="Withdraw sales review issue",
)
async def withdraw_sales_review(
    review_id: int = Path(...),
    current_user: User = Depends(get_current_user),
    tenant_id: int = Depends(get_current_tenant),
):
    try:
        return await _service.withdraw(tenant_id, review_id, current_user)
    except NotFoundError as e:
        raise HTTPException(status_code=status.HTTP_404_NOT_FOUND, detail=str(e))
    except BusinessLogicError as e:
        raise HTTPException(status_code=status.HTTP_400_BAD_REQUEST, detail=str(e))


@router.post(
    "/{review_id:int}/dept-opinions/{dept_code}",
    response_model=SalesReviewResponse,
    summary="Submit department opinion",
)
async def submit_dept_opinion(
    body: SalesReviewDeptOpinionSubmit,
    review_id: int = Path(...),
    dept_code: str = Path(...),
    current_user: User = Depends(get_current_user),
    tenant_id: int = Depends(get_current_tenant),
):
    try:
        return await _service.submit_dept_opinion(
            tenant_id, review_id, dept_code, body, current_user
        )
    except NotFoundError as e:
        raise HTTPException(status_code=status.HTTP_404_NOT_FOUND, detail=str(e))
    except (ValidationError, BusinessLogicError) as e:
        raise HTTPException(status_code=status.HTTP_400_BAD_REQUEST, detail=str(e))


@router.post(
    "/{review_id:int}/reject",
    response_model=SalesReviewResponse,
    summary="Reject sales review to sales",
)
async def reject_sales_review(
    review_id: int = Path(...),
    body: Optional[SalesReviewRejectRequest] = None,
    current_user: User = Depends(get_current_user),
    tenant_id: int = Depends(get_current_tenant),
):
    try:
        return await _service.reject(
            tenant_id,
            review_id,
            current_user,
            reason=(body.reason if body else None),
        )
    except NotFoundError as e:
        raise HTTPException(status_code=status.HTTP_404_NOT_FOUND, detail=str(e))
    except BusinessLogicError as e:
        raise HTTPException(status_code=status.HTTP_400_BAD_REQUEST, detail=str(e))


@router.get(
    "/{review_id:int}/push-to-sales-order/preview",
    response_model=SalesReviewPushPreview,
    summary="Preview push to sales order",
)
async def preview_push_to_sales_order(
    review_id: int = Path(...),
    current_user: User = Depends(get_current_user),
    tenant_id: int = Depends(get_current_tenant),
):
    try:
        return await _service.preview_push_to_sales_order(tenant_id, review_id)
    except NotFoundError as e:
        raise HTTPException(status_code=status.HTTP_404_NOT_FOUND, detail=str(e))


@router.post(
    "/{review_id:int}/push-to-sales-order",
    response_model=SalesReviewPushResult,
    summary="Push sales review to sales order",
)
async def push_to_sales_order(
    review_id: int = Path(...),
    current_user: User = Depends(get_current_user),
    tenant_id: int = Depends(get_current_tenant),
):
    try:
        return await _service.push_to_sales_order(tenant_id, review_id, current_user)
    except NotFoundError as e:
        raise HTTPException(status_code=status.HTTP_404_NOT_FOUND, detail=str(e))
    except BusinessLogicError as e:
        raise HTTPException(status_code=status.HTTP_400_BAD_REQUEST, detail=str(e))

@router.get(
    "/{review_id:int}/print",
    summary="Print sales review",
)
async def print_sales_review(
    review_id: int = Path(...),
    template_code: Optional[str] = Query(None, description="打印模板代码"),
    template_uuid: Optional[str] = Query(None, description="打印模板UUID"),
    output_format: str = Query("html", description="输出格式"),
    response_format: str = Query("json", description="响应格式"),
    current_user: User = Depends(get_current_user),
    tenant_id: int = Depends(get_current_tenant),
):
    """打印订单评审单"""
    import base64
    from apps.kuaizhizao.services.print_service import DocumentPrintService
    from fastapi.responses import HTMLResponse, JSONResponse, Response
    from fastapi import status as http_status

    try:
        result = await DocumentPrintService().print_document(
            tenant_id=tenant_id,
            document_type="sales_review",
            document_id=review_id,
            template_code=template_code,
            template_uuid=template_uuid,
            output_format=output_format,
        )
    except NotFoundError as e:
        raise HTTPException(status_code=http_status.HTTP_404_NOT_FOUND, detail=str(e))
    except (ValidationError, BusinessLogicError) as e:
        raise HTTPException(status_code=http_status.HTTP_400_BAD_REQUEST, detail=str(e))

    if (
        (output_format or "html").lower() == "pdf"
        and (response_format or "json").lower() in {"pdf", "binary", "raw"}
        and result.get("mime_type") == "application/pdf"
    ):
        raw = base64.b64decode(result.get("content") or "")
        return Response(
            content=raw,
            media_type="application/pdf",
            headers={"Content-Disposition": f'inline; filename="sales-review-{review_id}.pdf"'},
        )
    if response_format == "html":
        return HTMLResponse(content=result.get("content", ""), status_code=200)
    return JSONResponse(content=result, status_code=200)


@router.get(
    "/{review_id:int}/print-variables",
    summary="Sales review print variables",
)
async def get_sales_review_print_variables(
    review_id: int = Path(...),
    current_user: User = Depends(get_current_user),
    tenant_id: int = Depends(get_current_tenant),
):
    from apps.kuaizhizao.services.print_service import DocumentPrintService
    from fastapi import status as http_status

    try:
        variables = await DocumentPrintService().get_document_variables_for_print(
            tenant_id, "sales_review", review_id
        )
        return {"success": True, "variables": variables}
    except NotFoundError as e:
        raise HTTPException(status_code=http_status.HTTP_404_NOT_FOUND, detail=str(e))

