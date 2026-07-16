"""委外收货 API（入库 Hub 权限：kuaizhizao:inbound，与仓库入库菜单一致）。"""

from __future__ import annotations

import uuid
from typing import List, Optional

from fastapi import APIRouter, Depends, HTTPException, Path, Query
from loguru import logger

from apps.kuaizhizao.api._kuaizhizao_route_access import require_kuaizhizao_module_access
from core.api.deps import get_current_tenant
from infra.api.deps.deps import get_current_user
from infra.exceptions.exceptions import BusinessLogicError, NotFoundError, ValidationError
from infra.models.user import User

from apps.kuaizhizao.schemas.outsource_work_order import (
    OutsourceMaterialReceiptCreate,
    OutsourceMaterialReceiptPreviewResponse,
    OutsourceMaterialReceiptResponse,
)
from apps.kuaizhizao.services.outsource_material_receipt_service import OutsourceMaterialReceiptService

outsource_material_receipt_service = OutsourceMaterialReceiptService()

router = APIRouter(
    tags=["App - Kuaige Zhizao - Warehouse Inbound - Outsource Receipt"],
    dependencies=[Depends(require_kuaizhizao_module_access("inbound", resolve_print=False))],
)


def _http_exception_with_trace(
    status_code: int,
    message: str,
    route: str,
    tenant_id: Optional[int] = None,
) -> HTTPException:
    trace_id = uuid.uuid4().hex
    logger.warning(
        "outsource_receipt_api_error trace_id={} tenant_id={} route={} status_code={} message={}",
        trace_id,
        tenant_id,
        route,
        status_code,
        message,
    )
    return HTTPException(
        status_code=status_code,
        detail={"message": message, "trace_id": trace_id},
    )


@router.post("/outsource-material-receipts", response_model=OutsourceMaterialReceiptResponse, summary="Create subcontract receipt")
async def create_outsource_material_receipt(
    data: OutsourceMaterialReceiptCreate,
    current_user: User = Depends(get_current_user),
    tenant_id: int = Depends(get_current_tenant),
) -> OutsourceMaterialReceiptResponse:
    try:
        creator_name = (
            getattr(current_user, "full_name", None)
            or getattr(current_user, "username", None)
            or "未知用户"
        )
        return await outsource_material_receipt_service.create_material_receipt(
            tenant_id=tenant_id,
            receipt_data=data,
            created_by=current_user.id,
            created_by_name=str(creator_name),
        )
    except ValidationError as e:
        raise _http_exception_with_trace(400, str(e), "/outsource-material-receipts", tenant_id)
    except NotFoundError as e:
        raise _http_exception_with_trace(404, str(e), "/outsource-material-receipts", tenant_id)
    except BusinessLogicError as e:
        raise _http_exception_with_trace(400, str(e), "/outsource-material-receipts", tenant_id)
    except Exception as e:
        raise _http_exception_with_trace(500, str(e), "/outsource-material-receipts", tenant_id)


@router.get("/outsource-material-receipts", response_model=List[OutsourceMaterialReceiptResponse], summary="List subcontract receipts")
async def list_outsource_material_receipts(
    skip: int = Query(0, ge=0, description="跳过数量"),
    limit: int = Query(100, ge=1, le=1000, description="限制数量"),
    outsource_work_order_id: Optional[int] = Query(None, description="工单委外ID筛选"),
    status: Optional[str] = Query(None, description="状态筛选"),
    keyword: Optional[str] = Query(None, description="关键词搜索"),
    current_user: User = Depends(get_current_user),
    tenant_id: int = Depends(get_current_tenant),
) -> List[OutsourceMaterialReceiptResponse]:
    try:
        return await outsource_material_receipt_service.list_material_receipts(
            tenant_id=tenant_id,
            skip=skip,
            limit=limit,
            outsource_work_order_id=outsource_work_order_id,
            status=status,
            keyword=keyword,
        )
    except Exception as e:
        logger.error(f"获取委外收货单列表失败: {e}")
        raise _http_exception_with_trace(500, str(e), "/outsource-material-receipts", tenant_id)


@router.get("/outsource-material-receipts/{receipt_id}", response_model=OutsourceMaterialReceiptResponse, summary="Get subcontract receipt")
async def get_outsource_material_receipt(
    receipt_id: int = Path(..., description="委外收货单ID"),
    current_user: User = Depends(get_current_user),
    tenant_id: int = Depends(get_current_tenant),
) -> OutsourceMaterialReceiptResponse:
    try:
        return await outsource_material_receipt_service.get_material_receipt(
            tenant_id=tenant_id,
            receipt_id=receipt_id,
        )
    except NotFoundError as e:
        raise _http_exception_with_trace(404, str(e), "/outsource-material-receipts/{receipt_id}", tenant_id)


@router.post("/outsource-material-receipts/{receipt_id}/complete", response_model=OutsourceMaterialReceiptResponse, summary="Complete subcontract receipt")
async def complete_outsource_material_receipt(
    receipt_id: int = Path(..., description="委外收货单ID"),
    current_user: User = Depends(get_current_user),
    tenant_id: int = Depends(get_current_tenant),
) -> OutsourceMaterialReceiptResponse:
    try:
        return await outsource_material_receipt_service.complete_material_receipt(
            tenant_id=tenant_id,
            receipt_id=receipt_id,
            completed_by=current_user.id,
        )
    except NotFoundError as e:
        raise _http_exception_with_trace(404, str(e), "/outsource-material-receipts/{receipt_id}/complete", tenant_id)
    except BusinessLogicError as e:
        raise _http_exception_with_trace(400, str(e), "/outsource-material-receipts/{receipt_id}/complete", tenant_id)


@router.get(
    "/outsource-work-orders/{work_order_id}/receipt-preview",
    response_model=OutsourceMaterialReceiptPreviewResponse,
    summary="Preview subcontract material receipt lines",
)
async def get_outsource_material_receipt_preview(
    work_order_id: int = Path(..., description="委外工单ID"),
    current_user: User = Depends(get_current_user),
    tenant_id: int = Depends(get_current_tenant),
) -> OutsourceMaterialReceiptPreviewResponse:
    try:
        return await outsource_material_receipt_service.get_receipt_preview(
            tenant_id=tenant_id,
            outsource_work_order_id=work_order_id,
        )
    except NotFoundError as e:
        raise _http_exception_with_trace(
            404, str(e), "/outsource-work-orders/{work_order_id}/receipt-preview", tenant_id
        )
    except BusinessLogicError as e:
        raise _http_exception_with_trace(
            400, str(e), "/outsource-work-orders/{work_order_id}/receipt-preview", tenant_id
        )
