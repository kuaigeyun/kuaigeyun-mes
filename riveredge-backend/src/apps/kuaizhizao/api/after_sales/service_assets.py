"""装机档案 API"""

from typing import Any, Optional
import uuid

from fastapi import APIRouter, Depends, HTTPException as FastAPIHTTPException, Path, Query, status
from loguru import logger

from apps.kuaizhizao.api._kuaizhizao_route_access import require_kuaizhizao_module_access
from apps.kuaizhizao.schemas.after_sales_service import (
    ServiceAssetCreate,
    ServiceAssetListEnvelope,
    ServiceAssetResponse,
    ServiceAssetUpdate,
)
from apps.kuaizhizao.services.service_asset_service import ServiceAssetService
from core.api.deps import get_current_tenant, get_current_user
from infra.exceptions.exceptions import NotFoundError, ValidationError
from infra.models.user import User

router = APIRouter(
    prefix="/after-sales/service-assets",
    tags=["App - Kuaige Zhizao - Service Asset"],
    dependencies=[Depends(require_kuaizhizao_module_access("service-asset"))],
)
_service = ServiceAssetService()


def _http_exception(status_code: int, message: str) -> FastAPIHTTPException:
    trace_id = uuid.uuid4().hex
    logger.warning("kuaizhizao_service_assets_api_error trace_id={} message={}", trace_id, message)
    return FastAPIHTTPException(status_code=status_code, detail={"message": message, "trace_id": trace_id})


def HTTPException(*, status_code: int, detail: Any, **kwargs) -> FastAPIHTTPException:
    message = detail.get("message") if isinstance(detail, dict) else str(detail)
    return _http_exception(status_code, message)


@router.post("", response_model=ServiceAssetResponse, summary="Create service asset")
async def create_asset(
    body: ServiceAssetCreate,
    current_user: User = Depends(get_current_user),
    tenant_id: int = Depends(get_current_tenant),
):
    try:
        return await _service.create(tenant_id, body, current_user)
    except ValidationError as e:
        raise HTTPException(status_code=status.HTTP_400_BAD_REQUEST, detail=str(e))
    except NotFoundError as e:
        raise HTTPException(status_code=status.HTTP_404_NOT_FOUND, detail=str(e))


@router.get("", response_model=ServiceAssetListEnvelope, summary="List service assets")
async def list_assets(
    skip: int = Query(0, ge=0),
    limit: int = Query(50, ge=1, le=200),
    customer_id: Optional[int] = Query(None),
    status_filter: Optional[str] = Query(None, alias="status"),
    keyword: Optional[str] = Query(None),
    tenant_id: int = Depends(get_current_tenant),
):
    return await _service.list_assets(
        tenant_id,
        skip=skip,
        limit=limit,
        customer_id=customer_id,
        status=status_filter,
        keyword=keyword,
    )


@router.get("/{asset_id}", response_model=ServiceAssetResponse, summary="Get service asset")
async def get_asset(
    asset_id: int = Path(..., description="装机档案ID"),
    tenant_id: int = Depends(get_current_tenant),
):
    try:
        return await _service.get(tenant_id, asset_id)
    except NotFoundError as e:
        raise HTTPException(status_code=status.HTTP_404_NOT_FOUND, detail=str(e))


@router.put("/{asset_id}", response_model=ServiceAssetResponse, summary="Update service asset")
async def update_asset(
    body: ServiceAssetUpdate,
    asset_id: int = Path(..., description="装机档案ID"),
    current_user: User = Depends(get_current_user),
    tenant_id: int = Depends(get_current_tenant),
):
    try:
        return await _service.update(tenant_id, asset_id, body, current_user)
    except NotFoundError as e:
        raise HTTPException(status_code=status.HTTP_404_NOT_FOUND, detail=str(e))
    except ValidationError as e:
        raise HTTPException(status_code=status.HTTP_400_BAD_REQUEST, detail=str(e))


@router.delete("/{asset_id}", summary="Delete service asset")
async def delete_asset(
    asset_id: int = Path(..., description="装机档案ID"),
    current_user: User = Depends(get_current_user),
    tenant_id: int = Depends(get_current_tenant),
):
    try:
        await _service.delete(tenant_id, asset_id, current_user)
        return {"ok": True}
    except NotFoundError as e:
        raise HTTPException(status_code=status.HTTP_404_NOT_FOUND, detail=str(e))
