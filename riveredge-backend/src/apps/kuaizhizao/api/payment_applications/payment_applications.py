"""
付款申请单 API
"""

import uuid
from typing import Optional

from fastapi import APIRouter, Depends, HTTPException, Path, Query, status
from loguru import logger

from core.api.deps.access import require_permission_codes
from core.api.deps.deps import get_current_tenant, get_current_user
from apps.kuaizhizao.api._kuaizhizao_route_access import require_kuaizhizao_module_access
from infra.models.user import User
from infra.exceptions.exceptions import NotFoundError, BusinessLogicError, ValidationError

from apps.kuaizhizao.schemas.payment_application import (
    PaymentApplicationCreate,
    PaymentApplicationUpdate,
    PaymentApplicationResponse,
    PaymentApplicationListResponse,
    ApprovePaymentApplicationRequest,
    PushPaymentApplicationToPaymentRequest,
    PullPaymentApplicationFromPurchaseOrderRequest,
    PullPaymentApplicationFromPurchaseReceiptRequest,
    PullPaymentApplicationFromReconciliationRequest,
)
from apps.kuaizhizao.services.payment_application_service import PaymentApplicationService
from apps.kuaizhizao.services.payment_application_pull_service import PaymentApplicationPullService
from apps.kuaizhizao.services.payment_application_push_service import PaymentApplicationPushService

router = APIRouter(
    tags=["App - Kuaige Zhizao - Payment Application"],
    dependencies=[Depends(require_kuaizhizao_module_access("payment-application"))],
)

_svc = PaymentApplicationService()
_pull = PaymentApplicationPullService()
_push = PaymentApplicationPushService()


def _http(status_code: int, message: str, route: str, tenant_id: Optional[int] = None):
    trace_id = uuid.uuid4().hex
    logger.warning(
        "payment_application_api trace_id={} route={} status={} msg={}",
        trace_id,
        route,
        status_code,
        message,
    )
    return HTTPException(status_code=status_code, detail={"message": message, "trace_id": trace_id})


@router.post("/payment-applications", response_model=PaymentApplicationResponse)
async def create_payment_application(
    data: PaymentApplicationCreate,
    current_user: User = Depends(get_current_user),
    tenant_id: int = Depends(get_current_tenant),
    _auth: object = Depends(require_permission_codes("kuaizhizao:payment-application:create")),
):
    try:
        return await _svc.create_application(tenant_id, data, current_user.id)
    except (ValidationError, BusinessLogicError) as e:
        raise _http(400, str(e), "/payment-applications", tenant_id) from e


@router.get("/payment-applications", response_model=PaymentApplicationListResponse)
async def list_payment_applications(
    skip: int = Query(0, ge=0),
    limit: int = Query(20, ge=1, le=200),
    status: Optional[str] = None,
    supplier_id: Optional[int] = None,
    keyword: Optional[str] = None,
    sort_field: Optional[str] = None,
    sort_order: Optional[str] = None,
    approved_only: bool = Query(False),
    with_remaining: bool = Query(False),
    tenant_id: int = Depends(get_current_tenant),
    current_user: User = Depends(get_current_user),
    _auth: object = Depends(require_permission_codes("kuaizhizao:payment-application:read")),
):
    return await _svc.list_applications(
        tenant_id,
        skip=skip,
        limit=limit,
        status=status,
        supplier_id=supplier_id,
        keyword=keyword,
        sort_field=sort_field,
        sort_order=sort_order,
        approved_only=approved_only,
        with_remaining=with_remaining,
        viewer_id=current_user.id,
    )


@router.get("/payment-applications/pull/payables")
async def list_payables_for_application(
    supplier_id: int = Query(...),
    skip: int = Query(0, ge=0),
    limit: int = Query(20, ge=1, le=200),
    keyword: Optional[str] = None,
    tenant_id: int = Depends(get_current_tenant),
    _auth: object = Depends(require_permission_codes("kuaizhizao:payment-application:read")),
):
    return await _pull.list_payable_pull_lines(
        tenant_id, supplier_id, skip=skip, limit=limit, keyword=keyword
    )


@router.post("/payment-applications/pull-from-purchase-order", response_model=PaymentApplicationResponse)
async def pull_from_purchase_order(
    data: PullPaymentApplicationFromPurchaseOrderRequest,
    current_user: User = Depends(get_current_user),
    tenant_id: int = Depends(get_current_tenant),
    _auth: object = Depends(require_permission_codes("kuaizhizao:payment-application:create")),
):
    try:
        return await _pull.create_from_purchase_order(
            tenant_id, data.purchase_order_id, data.amount, current_user.id
        )
    except (NotFoundError, ValidationError, BusinessLogicError) as e:
        raise _http(400, str(e), "/payment-applications/pull-from-purchase-order", tenant_id) from e


@router.post("/payment-applications/pull-from-purchase-receipt", response_model=PaymentApplicationResponse)
async def pull_from_purchase_receipt(
    data: PullPaymentApplicationFromPurchaseReceiptRequest,
    current_user: User = Depends(get_current_user),
    tenant_id: int = Depends(get_current_tenant),
    _auth: object = Depends(require_permission_codes("kuaizhizao:payment-application:create")),
):
    try:
        return await _pull.create_from_purchase_receipt(
            tenant_id, data.purchase_receipt_id, data.amount, current_user.id
        )
    except (NotFoundError, ValidationError, BusinessLogicError) as e:
        raise _http(400, str(e), "/payment-applications/pull-from-purchase-receipt", tenant_id) from e


@router.post("/payment-applications/pull-from-reconciliation", response_model=PaymentApplicationResponse)
async def pull_from_reconciliation(
    data: PullPaymentApplicationFromReconciliationRequest,
    current_user: User = Depends(get_current_user),
    tenant_id: int = Depends(get_current_tenant),
    _auth: object = Depends(require_permission_codes("kuaizhizao:payment-application:create")),
):
    try:
        return await _pull.create_from_reconciliation(
            tenant_id, data.supplier_id, data.items, current_user.id
        )
    except (ValidationError, BusinessLogicError) as e:
        raise _http(400, str(e), "/payment-applications/pull-from-reconciliation", tenant_id) from e


@router.get("/payment-applications/pull-from-purchase-order/preview")
async def preview_pull_from_purchase_order(
    purchase_order_id: int = Query(...),
    tenant_id: int = Depends(get_current_tenant),
    _auth: object = Depends(require_permission_codes("kuaizhizao:payment-application:read")),
):
    return await _pull.preview_from_purchase_order(tenant_id, purchase_order_id)


@router.get("/payment-applications/{application_id}", response_model=PaymentApplicationResponse)
async def get_payment_application(
    application_id: int = Path(..., ge=1),
    tenant_id: int = Depends(get_current_tenant),
    current_user: User = Depends(get_current_user),
    _auth: object = Depends(require_permission_codes("kuaizhizao:payment-application:read")),
):
    try:
        return await _svc.get_by_id(tenant_id, application_id, viewer_id=current_user.id)
    except NotFoundError as e:
        raise _http(404, str(e), f"/payment-applications/{application_id}", tenant_id) from e


@router.put("/payment-applications/{application_id}", response_model=PaymentApplicationResponse)
async def update_payment_application(
    data: PaymentApplicationUpdate,
    application_id: int = Path(..., ge=1),
    current_user: User = Depends(get_current_user),
    tenant_id: int = Depends(get_current_tenant),
    _auth: object = Depends(require_permission_codes("kuaizhizao:payment-application:update")),
):
    try:
        return await _svc.update_application(tenant_id, application_id, data, current_user.id)
    except NotFoundError as e:
        raise _http(404, str(e), f"/payment-applications/{application_id}", tenant_id) from e
    except (ValidationError, BusinessLogicError) as e:
        raise _http(400, str(e), f"/payment-applications/{application_id}", tenant_id) from e


@router.delete("/payment-applications/{application_id}", status_code=status.HTTP_204_NO_CONTENT)
async def delete_payment_application(
    application_id: int = Path(..., ge=1),
    tenant_id: int = Depends(get_current_tenant),
    _auth: object = Depends(require_permission_codes("kuaizhizao:payment-application:delete")),
):
    try:
        await _svc.delete_application(tenant_id, application_id)
    except NotFoundError as e:
        raise _http(404, str(e), f"/payment-applications/{application_id}", tenant_id) from e


@router.post("/payment-applications/{application_id}/submit", response_model=PaymentApplicationResponse)
async def submit_payment_application(
    application_id: int = Path(..., ge=1),
    current_user: User = Depends(get_current_user),
    tenant_id: int = Depends(get_current_tenant),
    _auth: object = Depends(require_permission_codes("kuaizhizao:payment-application:submit")),
):
    try:
        return await _svc.submit_application(tenant_id, application_id, current_user.id)
    except NotFoundError as e:
        raise _http(404, str(e), f"/payment-applications/{application_id}/submit", tenant_id) from e
    except BusinessLogicError as e:
        raise _http(400, str(e), f"/payment-applications/{application_id}/submit", tenant_id) from e


@router.post("/payment-applications/{application_id}/approve", response_model=PaymentApplicationResponse)
async def approve_payment_application(
    data: ApprovePaymentApplicationRequest,
    application_id: int = Path(..., ge=1),
    current_user: User = Depends(get_current_user),
    tenant_id: int = Depends(get_current_tenant),
    _auth: object = Depends(require_permission_codes("kuaizhizao:payment-application:approve")),
):
    try:
        return await _svc.approve_application(
            tenant_id,
            application_id,
            approved=data.approved,
            approved_by=current_user.id,
            review_remarks=data.review_remarks,
        )
    except NotFoundError as e:
        raise _http(404, str(e), f"/payment-applications/{application_id}/approve", tenant_id) from e
    except BusinessLogicError as e:
        raise _http(400, str(e), f"/payment-applications/{application_id}/approve", tenant_id) from e


@router.post("/payment-applications/{application_id}/push-payment")
async def push_payment_application_to_payment(
    data: PushPaymentApplicationToPaymentRequest,
    application_id: int = Path(..., ge=1),
    current_user: User = Depends(get_current_user),
    tenant_id: int = Depends(get_current_tenant),
    _auth: object = Depends(require_permission_codes("kuaizhizao:payment-application:push")),
):
    try:
        return await _push.push_to_payment(tenant_id, application_id, data, current_user)
    except NotFoundError as e:
        raise _http(404, str(e), f"/payment-applications/{application_id}/push-payment", tenant_id) from e
    except (ValidationError, BusinessLogicError) as e:
        raise _http(400, str(e), f"/payment-applications/{application_id}/push-payment", tenant_id) from e


@router.get("/payment-applications/{application_id}/print", summary="Print payment application")
async def print_payment_application(
    application_id: int = Path(..., ge=1),
    template_code: Optional[str] = Query(None, description="打印模板代码"),
    template_uuid: Optional[str] = Query(None, description="打印模板UUID"),
    output_format: str = Query("html", description="输出格式"),
    response_format: str = Query("json", description="响应格式"),
    current_user: User = Depends(get_current_user),
    tenant_id: int = Depends(get_current_tenant),
    _auth: object = Depends(require_permission_codes("kuaizhizao:payment-application:print")),
):
    """打印付款申请"""
    import base64

    from apps.kuaizhizao.services.print_service import DocumentPrintService
    from fastapi.responses import HTMLResponse, JSONResponse, Response

    try:
        result = await DocumentPrintService().print_document(
            tenant_id=tenant_id,
            document_type="payment_application",
            document_id=application_id,
            template_code=template_code,
            template_uuid=template_uuid,
            output_format=output_format,
        )
    except NotFoundError as e:
        raise _http(404, str(e), f"/payment-applications/{application_id}/print", tenant_id) from e
    except ValidationError as e:
        raise _http(400, str(e), f"/payment-applications/{application_id}/print", tenant_id) from e

    if (
        (output_format or "html").lower() == "pdf"
        and (response_format or "json").lower() in {"pdf", "binary", "raw"}
        and result.get("mime_type") == "application/pdf"
    ):
        raw = base64.b64decode(result.get("content") or "")
        return Response(
            content=raw,
            media_type="application/pdf",
            headers={
                "Content-Disposition": f'inline; filename="payment-application-{application_id}.pdf"'
            },
        )
    if response_format == "html":
        return HTMLResponse(content=result.get("content", ""), status_code=200)
    return JSONResponse(content=result, status_code=200)
