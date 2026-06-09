"""客户供应商价格本 API"""

import json
import uuid
from datetime import date
from typing import Annotated, Any, Dict, Optional

from fastapi import APIRouter, Depends, Query, status
from loguru import logger

from apps.master_data.schemas.partner_price_book_schemas import (
    PartnerPriceBookCreate,
    PartnerPriceBookListResponse,
    PartnerPriceBookResponse,
    PartnerPriceBookUpdate,
    PartnerPriceResolveBatchRequest,
    PartnerPriceResolveBatchResponse,
    PartnerPriceResolveRequest,
    PartnerPriceResolveResponse,
)
from apps.master_data.services.partner_price_book_service import PartnerPriceBookService
from apps.master_data.api._master_data_route_access import require_master_data_module_access
from core.api.deps.deps import get_current_tenant, get_current_user
from infra.exceptions.exceptions import NotFoundError, ValidationError
from infra.models.user import User

router = APIRouter(prefix="/supply-chain", tags=["App · Master Data · Supply Chain"])


def _http_exception(status_code: int, message: str, route: str = "/supply-chain"):
    from fastapi import HTTPException

    trace_id = uuid.uuid4().hex
    logger.warning(
        "partner_price_book_api_error trace_id={} route={} status_code={} message={}",
        trace_id,
        route,
        status_code,
        message,
    )
    return HTTPException(status_code=status_code, detail={"message": message, "trace_id": trace_id})


def _register_price_book_routes(partner_type: str, resource: str) -> None:
    base = f"/{resource}"
    module_name = f"supply-chain:{'customer-price-book' if partner_type == 'customer' else 'supplier-price-book'}"
    module_dep = Depends(require_master_data_module_access(module_name))

    @router.post(base, response_model=PartnerPriceBookResponse, dependencies=[module_dep])
    async def create_price_book(
        data: PartnerPriceBookCreate,
        current_user: Annotated[User, Depends(get_current_user)],
        tenant_id: Annotated[int, Depends(get_current_tenant)],
        _partner_type: str = partner_type,
    ):
        try:
            return await PartnerPriceBookService.create(tenant_id, _partner_type, data)
        except ValidationError as e:
            raise _http_exception(status.HTTP_400_BAD_REQUEST, str(e))

    @router.get(base, response_model=PartnerPriceBookListResponse, dependencies=[module_dep])
    async def list_price_books(
        current_user: Annotated[User, Depends(get_current_user)],
        tenant_id: Annotated[int, Depends(get_current_tenant)],
        skip: int = Query(0, ge=0),
        limit: int = Query(100, ge=1, le=1000),
        partner_id: Optional[int] = Query(None, alias="partnerId"),
        material_id: Optional[int] = Query(None, alias="materialId"),
        keyword: Optional[str] = Query(None),
        active_only: Optional[bool] = Query(None, alias="activeOnly"),
        effective_on: Optional[date] = Query(None, alias="effectiveOn"),
        _partner_type: str = partner_type,
    ):
        items, total = await PartnerPriceBookService.list_rows(
            tenant_id,
            _partner_type,
            skip,
            limit,
            partner_id,
            material_id,
            keyword,
            active_only,
            effective_on,
        )
        return PartnerPriceBookListResponse(data=items, total=total)

    def _parse_variant_attributes_query(raw: Optional[str]) -> Optional[Dict[str, Any]]:
        if not raw or not str(raw).strip():
            return None
        try:
            parsed = json.loads(raw)
            return parsed if isinstance(parsed, dict) else None
        except json.JSONDecodeError:
            return None

    @router.get(f"{base}/resolve", response_model=PartnerPriceResolveResponse, dependencies=[module_dep])
    async def resolve_price(
        current_user: Annotated[User, Depends(get_current_user)],
        tenant_id: Annotated[int, Depends(get_current_tenant)],
        partner_id: int = Query(..., alias="partnerId"),
        material_id: Optional[int] = Query(None, alias="materialId"),
        partner_material_code: Optional[str] = Query(None, alias="partnerMaterialCode"),
        variant_attributes: Optional[str] = Query(None, alias="variantAttributes"),
        as_of: Optional[date] = Query(None, alias="asOf"),
        _partner_type: str = partner_type,
    ):
        try:
            return await PartnerPriceBookService.resolve(
                tenant_id,
                _partner_type,
                PartnerPriceResolveRequest(
                    partner_id=partner_id,
                    material_id=material_id,
                    partner_material_code=partner_material_code,
                    variant_attributes=_parse_variant_attributes_query(variant_attributes),
                    as_of=as_of,
                ),
            )
        except ValidationError as e:
            raise _http_exception(status.HTTP_400_BAD_REQUEST, str(e))

    @router.post(f"{base}/resolve", response_model=PartnerPriceResolveResponse, dependencies=[module_dep])
    async def resolve_price_post(
        data: PartnerPriceResolveRequest,
        current_user: Annotated[User, Depends(get_current_user)],
        tenant_id: Annotated[int, Depends(get_current_tenant)],
        _partner_type: str = partner_type,
    ):
        try:
            return await PartnerPriceBookService.resolve(tenant_id, _partner_type, data)
        except ValidationError as e:
            raise _http_exception(status.HTTP_400_BAD_REQUEST, str(e))

    @router.post(
        f"{base}/resolve-batch",
        response_model=PartnerPriceResolveBatchResponse,
        dependencies=[module_dep],
    )
    async def resolve_prices_batch(
        data: PartnerPriceResolveBatchRequest,
        current_user: Annotated[User, Depends(get_current_user)],
        tenant_id: Annotated[int, Depends(get_current_tenant)],
        _partner_type: str = partner_type,
    ):
        items = await PartnerPriceBookService.resolve_batch(tenant_id, _partner_type, data)
        return PartnerPriceResolveBatchResponse(items=items)

    @router.get(f"{base}/{{book_uuid}}", response_model=PartnerPriceBookResponse, dependencies=[module_dep])
    async def get_price_book(
        book_uuid: str,
        current_user: Annotated[User, Depends(get_current_user)],
        tenant_id: Annotated[int, Depends(get_current_tenant)],
        _partner_type: str = partner_type,
    ):
        try:
            return await PartnerPriceBookService.get_by_uuid(tenant_id, _partner_type, book_uuid)
        except NotFoundError as e:
            raise _http_exception(status.HTTP_404_NOT_FOUND, str(e))

    @router.put(f"{base}/{{book_uuid}}", response_model=PartnerPriceBookResponse, dependencies=[module_dep])
    async def update_price_book(
        book_uuid: str,
        data: PartnerPriceBookUpdate,
        current_user: Annotated[User, Depends(get_current_user)],
        tenant_id: Annotated[int, Depends(get_current_tenant)],
        _partner_type: str = partner_type,
    ):
        try:
            return await PartnerPriceBookService.update(tenant_id, _partner_type, book_uuid, data)
        except NotFoundError as e:
            raise _http_exception(status.HTTP_404_NOT_FOUND, str(e))
        except ValidationError as e:
            raise _http_exception(status.HTTP_400_BAD_REQUEST, str(e))

    @router.delete(f"{base}/{{book_uuid}}", dependencies=[module_dep])
    async def delete_price_book(
        book_uuid: str,
        current_user: Annotated[User, Depends(get_current_user)],
        tenant_id: Annotated[int, Depends(get_current_tenant)],
        _partner_type: str = partner_type,
    ):
        try:
            await PartnerPriceBookService.delete(tenant_id, _partner_type, book_uuid)
        except NotFoundError as e:
            raise _http_exception(status.HTTP_404_NOT_FOUND, str(e))


_register_price_book_routes("customer", "customer-price-books")
_register_price_book_routes("supplier", "supplier-price-books")
