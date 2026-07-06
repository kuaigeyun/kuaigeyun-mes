"""
采购询价单 API

Author: RiverEdge Team
Date: 2026-05-28
"""

import uuid
from typing import List, Optional

from fastapi import APIRouter, Depends, Query, Path, HTTPException as FastAPIHTTPException, status
from loguru import logger

from core.api.deps import get_current_user, get_current_tenant
from apps.kuaizhizao.api._kuaizhizao_route_access import require_kuaizhizao_module_access
from infra.models.user import User
from infra.exceptions.exceptions import NotFoundError, BusinessLogicError

from apps.kuaizhizao.schemas.purchase_inquiry import (
    ApproveInquiryRequest,
    AwardQuotesRequest,
    ComparisonMatrixResponse,
    ConvertInquiryToPORequest,
    CreateFromRequisitionRequest,
    PurchaseInquiryCreate,
    PurchaseInquiryResponse,
    PurchaseInquiryUpdate,
    PurchaseSupplierQuoteResponse,
    UpsertSupplierQuoteRequest,
)
from apps.kuaizhizao.services.purchase_inquiry_service import PurchaseInquiryService

router = APIRouter(tags=["App · Kuaige Zhizao · Purchase Inquiry"])


def _http_exception(status_code: int, message: str, route: str = "/purchase-inquiries") -> FastAPIHTTPException:
    trace_id = uuid.uuid4().hex
    logger.warning("purchase_inquiries_api_error trace_id={} route={} message={}", trace_id, route, message)
    return FastAPIHTTPException(status_code=status_code, detail={"message": message, "trace_id": trace_id})


@router.post(
    "/purchase-inquiries",
    response_model=PurchaseInquiryResponse,
    summary="Create purchase inquiry",
    dependencies=[Depends(require_kuaizhizao_module_access("purchase-inquiry"))],
)
async def create_inquiry(
    data: PurchaseInquiryCreate,
    current_user: User = Depends(get_current_user),
    tenant_id: int = Depends(get_current_tenant),
):
    return await PurchaseInquiryService().create_inquiry(tenant_id, data, current_user.id)


@router.get(
    "/purchase-inquiries",
    summary="List purchase inquiries",
    dependencies=[Depends(require_kuaizhizao_module_access("purchase-inquiry"))],
)
async def list_inquiries(
    skip: int = Query(0, ge=0),
    limit: int = Query(20, ge=1, le=100),
    lifecycle_stage: Optional[str] = Query(None),
    keyword: Optional[str] = Query(None),
    source_id: Optional[int] = Query(None),
    tenant_id: int = Depends(get_current_tenant),
):
    rows = await PurchaseInquiryService().list_inquiries(
        tenant_id, skip=skip, limit=limit, lifecycle_stage=lifecycle_stage, keyword=keyword, source_id=source_id
    )
    return {"data": rows, "total": len(rows), "success": True}


@router.get(
    "/purchase-inquiries/{inquiry_id}",
    response_model=PurchaseInquiryResponse,
    summary="Get purchase inquiry",
    dependencies=[Depends(require_kuaizhizao_module_access("purchase-inquiry"))],
)
async def get_inquiry(
    inquiry_id: int = Path(...),
    tenant_id: int = Depends(get_current_tenant),
):
    return await PurchaseInquiryService().get_inquiry_by_id(tenant_id, inquiry_id)


@router.put(
    "/purchase-inquiries/{inquiry_id}",
    response_model=PurchaseInquiryResponse,
    summary="Update purchase inquiry",
    dependencies=[Depends(require_kuaizhizao_module_access("purchase-inquiry"))],
)
async def update_inquiry(
    data: PurchaseInquiryUpdate,
    inquiry_id: int = Path(...),
    current_user: User = Depends(get_current_user),
    tenant_id: int = Depends(get_current_tenant),
):
    return await PurchaseInquiryService().update_inquiry(tenant_id, inquiry_id, data, current_user.id)


@router.delete(
    "/purchase-inquiries/{inquiry_id}",
    summary="Delete purchase inquiry",
    dependencies=[Depends(require_kuaizhizao_module_access("purchase-inquiry"))],
)
async def delete_inquiry(
    inquiry_id: int = Path(...),
    current_user: User = Depends(get_current_user),
    tenant_id: int = Depends(get_current_tenant),
):
    await PurchaseInquiryService().delete_inquiry(tenant_id, inquiry_id, current_user.id)
    return {"success": True}


@router.post(
    "/purchase-inquiries/from-requisition/{requisition_id}",
    response_model=PurchaseInquiryResponse,
    summary="Create inquiry from purchase requisition",
    dependencies=[Depends(require_kuaizhizao_module_access("purchase-inquiry"))],
)
async def create_from_requisition(
    data: CreateFromRequisitionRequest,
    requisition_id: int = Path(...),
    current_user: User = Depends(get_current_user),
    tenant_id: int = Depends(get_current_tenant),
):
    return await PurchaseInquiryService().create_from_requisition(
        tenant_id, requisition_id, data, current_user.id
    )


@router.post(
    "/purchase-inquiries/{inquiry_id}/publish",
    response_model=PurchaseInquiryResponse,
    dependencies=[Depends(require_kuaizhizao_module_access("purchase-inquiry"))],
)
async def publish_inquiry(
    inquiry_id: int = Path(...),
    current_user: User = Depends(get_current_user),
    tenant_id: int = Depends(get_current_tenant),
):
    return await PurchaseInquiryService().publish_inquiry(tenant_id, inquiry_id, current_user.id)


@router.post(
    "/purchase-inquiries/{inquiry_id}/close-quoting",
    response_model=PurchaseInquiryResponse,
    dependencies=[Depends(require_kuaizhizao_module_access("purchase-inquiry"))],
)
async def close_quoting(
    inquiry_id: int = Path(...),
    current_user: User = Depends(get_current_user),
    tenant_id: int = Depends(get_current_tenant),
):
    return await PurchaseInquiryService().close_quoting(tenant_id, inquiry_id, current_user.id)


@router.get(
    "/purchase-inquiries/{inquiry_id}/comparison",
    response_model=ComparisonMatrixResponse,
    dependencies=[Depends(require_kuaizhizao_module_access("purchase-inquiry"))],
)
async def get_comparison(
    inquiry_id: int = Path(...),
    tenant_id: int = Depends(get_current_tenant),
):
    return await PurchaseInquiryService().get_comparison_matrix(tenant_id, inquiry_id)


@router.post(
    "/purchase-inquiries/{inquiry_id}/supplier-quotes",
    response_model=PurchaseSupplierQuoteResponse,
    dependencies=[Depends(require_kuaizhizao_module_access("purchase-inquiry"))],
)
async def upsert_supplier_quote(
    data: UpsertSupplierQuoteRequest,
    inquiry_id: int = Path(...),
    current_user: User = Depends(get_current_user),
    tenant_id: int = Depends(get_current_tenant),
):
    return await PurchaseInquiryService().upsert_supplier_quote(
        tenant_id, inquiry_id, data, current_user.id
    )


@router.post(
    "/purchase-inquiries/{inquiry_id}/award",
    response_model=PurchaseInquiryResponse,
    dependencies=[Depends(require_kuaizhizao_module_access("purchase-inquiry"))],
)
async def award_quotes(
    data: AwardQuotesRequest,
    inquiry_id: int = Path(...),
    current_user: User = Depends(get_current_user),
    tenant_id: int = Depends(get_current_tenant),
):
    return await PurchaseInquiryService().award_quotes(tenant_id, inquiry_id, data, current_user.id)


@router.get(
    "/purchase-inquiries/{inquiry_id}/push-to-purchase-order/preview",
    summary="Preview push to purchase order",
    dependencies=[Depends(require_kuaizhizao_module_access("purchase-inquiry"))],
)
async def preview_push_to_purchase_order(
    inquiry_id: int = Path(...),
    tenant_id: int = Depends(get_current_tenant),
):
    """下推采购订单预览"""
    try:
        return await PurchaseInquiryService().preview_push_to_purchase_order(
            tenant_id=tenant_id,
            inquiry_id=inquiry_id,
        )
    except NotFoundError as e:
        raise _http_exception(404, str(e))
    except BusinessLogicError as e:
        raise _http_exception(400, str(e))


@router.post(
    "/purchase-inquiries/{inquiry_id}/convert-to-purchase-order",
    dependencies=[Depends(require_kuaizhizao_module_access("purchase-inquiry"))],
)
async def convert_to_po(
    data: ConvertInquiryToPORequest,
    inquiry_id: int = Path(...),
    current_user: User = Depends(get_current_user),
    tenant_id: int = Depends(get_current_tenant),
):
    return await PurchaseInquiryService().convert_to_purchase_order(
        tenant_id, inquiry_id, data, current_user.id
    )


@router.post(
    "/purchase-inquiries/{inquiry_id}/submit",
    response_model=PurchaseInquiryResponse,
    dependencies=[Depends(require_kuaizhizao_module_access("purchase-inquiry"))],
)
async def submit_inquiry(
    inquiry_id: int = Path(...),
    current_user: User = Depends(get_current_user),
    tenant_id: int = Depends(get_current_tenant),
):
    return await PurchaseInquiryService().submit_inquiry(tenant_id, inquiry_id, current_user.id)


@router.post(
    "/purchase-inquiries/{inquiry_id}/approve",
    response_model=PurchaseInquiryResponse,
    dependencies=[Depends(require_kuaizhizao_module_access("purchase-inquiry"))],
)
async def approve_inquiry(
    data: ApproveInquiryRequest,
    inquiry_id: int = Path(...),
    current_user: User = Depends(get_current_user),
    tenant_id: int = Depends(get_current_tenant),
):
    return await PurchaseInquiryService().approve_inquiry(
        tenant_id, inquiry_id, data.approved, current_user.id, data.review_remarks
    )


@router.post(
    "/purchase-inquiries/{inquiry_id}/withdraw-approval",
    response_model=PurchaseInquiryResponse,
    dependencies=[Depends(require_kuaizhizao_module_access("purchase-inquiry"))],
)
async def withdraw_approval(
    inquiry_id: int = Path(...),
    current_user: User = Depends(get_current_user),
    tenant_id: int = Depends(get_current_tenant),
):
    return await PurchaseInquiryService().withdraw_approval(tenant_id, inquiry_id, current_user.id)
