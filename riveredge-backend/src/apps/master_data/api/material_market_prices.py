"""原料行情 API。"""

from __future__ import annotations

import uuid
from datetime import date
from typing import Annotated, Optional

from fastapi import APIRouter, Body, Depends, HTTPException as FastAPIHTTPException, Query, status
from loguru import logger

from apps.master_data.schemas.material_market_price_schemas import (
    LoadMarketPricePresetRequest,
    LoadMarketPricePresetResponse,
    MaterialMarketInstrumentListResponse,
    MaterialMarketPriceCreate,
    MaterialMarketPriceListResponse,
    MaterialMarketPricePresetItem,
    MaterialMarketPriceResponse,
    MaterialMarketPriceUpdate,
    MaterialMarketSaleResolveResponse,
)
from apps.master_data.services.material_market_price_service import MaterialMarketPriceService
from core.api.deps.access import require_permission_codes
from core.api.deps.deps import get_current_tenant, get_current_user
from infra.exceptions.exceptions import NotFoundError, ValidationError
from infra.models.user import User

_READ = Depends(require_permission_codes("master-data:material:read"))
_WRITE = Depends(require_permission_codes("master-data:material:update"))

router = APIRouter(
    prefix="/materials",
    tags=["App - Master Data - Material Market Prices"],
)


def _http(status_code: int, message: str) -> FastAPIHTTPException:
    trace_id = uuid.uuid4().hex
    logger.warning(
        "master_data_market_prices_api_error trace_id={} status_code={} message={}",
        trace_id,
        status_code,
        message,
    )
    return FastAPIHTTPException(
        status_code=status_code,
        detail={"message": message, "trace_id": trace_id},
    )


@router.get(
    "/market-prices/resolve-sale",
    response_model=MaterialMarketSaleResolveResponse,
    summary="Resolve material sale price by market formula",
    dependencies=[_READ],
)
async def resolve_sale_price(
    tenant_id: Annotated[int, Depends(get_current_tenant)],
    material_uuid: str = Query(..., alias="materialUuid"),
    price_date: date = Query(..., alias="priceDate"),
):
    try:
        payload = await MaterialMarketPriceService.resolve_sale_price(
            tenant_id, material_uuid, price_date
        )
        return MaterialMarketSaleResolveResponse.model_validate(payload)
    except NotFoundError as e:
        raise _http(status.HTTP_404_NOT_FOUND, getattr(e, "message", None) or str(e))
    except ValidationError as e:
        raise _http(status.HTTP_400_BAD_REQUEST, getattr(e, "message", None) or str(e))


@router.get(
    "/market-prices/instruments",
    response_model=MaterialMarketInstrumentListResponse,
    summary="List hand-entered market quote instruments",
    dependencies=[_READ],
)
async def list_market_instruments(
    tenant_id: Annotated[int, Depends(get_current_tenant)],
):
    items = await MaterialMarketPriceService.list_instruments(tenant_id)
    return MaterialMarketInstrumentListResponse(items=items)


@router.get(
    "/market-prices/preset-preview",
    response_model=list[MaterialMarketPricePresetItem],
    summary="Preview common metal market-price instruments",
    dependencies=[_READ],
)
async def preview_market_price_presets(
    tenant_id: Annotated[int, Depends(get_current_tenant)],
):
    items = await MaterialMarketPriceService.list_preset_preview(tenant_id)
    return [MaterialMarketPricePresetItem.model_validate(i) for i in items]


@router.post(
    "/market-prices/load-preset",
    response_model=LoadMarketPricePresetResponse,
    summary="Load common metal market-price instruments for today",
    dependencies=[_WRITE],
)
async def load_market_price_presets(
    current_user: Annotated[User, Depends(get_current_user)],
    tenant_id: Annotated[int, Depends(get_current_tenant)],
    body: Optional[LoadMarketPricePresetRequest] = Body(None),
):
    codes = body.codes if body else None
    result = await MaterialMarketPriceService.load_presets(
        tenant_id, codes=codes, user=current_user
    )
    return LoadMarketPricePresetResponse.model_validate(result)


@router.get(
    "/market-prices",
    response_model=MaterialMarketPriceListResponse,
    summary="List material market prices",
    dependencies=[_READ],
)
async def list_market_prices(
    tenant_id: Annotated[int, Depends(get_current_tenant)],
    skip: int = Query(0, ge=0),
    limit: int = Query(50, ge=1, le=500),
    keyword: Optional[str] = Query(None),
    quote_code: Optional[str] = Query(None, alias="quoteCode"),
    price_date: Optional[date] = Query(None, alias="priceDate"),
    sort_by: Optional[str] = Query(None, alias="sortBy"),
    sort_order: Optional[str] = Query(None, alias="sortOrder"),
):
    items, total = await MaterialMarketPriceService.list_prices(
        tenant_id,
        skip=skip,
        limit=limit,
        keyword=keyword,
        quote_code=quote_code,
        price_date=price_date,
        sort_by=sort_by,
        sort_order=sort_order,
    )
    return MaterialMarketPriceListResponse(
        items=[MaterialMarketPriceResponse.model_validate(i) for i in items],
        total=total,
    )


@router.post(
    "/market-prices",
    response_model=MaterialMarketPriceResponse,
    summary="Create or overwrite material market price for a date",
    dependencies=[_WRITE],
)
async def upsert_market_price(
    data: MaterialMarketPriceCreate,
    current_user: Annotated[User, Depends(get_current_user)],
    tenant_id: Annotated[int, Depends(get_current_tenant)],
):
    try:
        payload = await MaterialMarketPriceService.upsert(
            tenant_id, data.model_dump(by_alias=False), user=current_user
        )
        return MaterialMarketPriceResponse.model_validate(payload)
    except NotFoundError as e:
        raise _http(status.HTTP_404_NOT_FOUND, getattr(e, "message", None) or str(e))
    except ValidationError as e:
        raise _http(status.HTTP_400_BAD_REQUEST, getattr(e, "message", None) or str(e))


@router.get(
    "/market-prices/{row_uuid}",
    response_model=MaterialMarketPriceResponse,
    summary="Get material market price",
    dependencies=[_READ],
)
async def get_market_price(
    row_uuid: str,
    tenant_id: Annotated[int, Depends(get_current_tenant)],
):
    try:
        payload = await MaterialMarketPriceService.get_by_uuid(tenant_id, row_uuid)
        return MaterialMarketPriceResponse.model_validate(payload)
    except NotFoundError as e:
        raise _http(status.HTTP_404_NOT_FOUND, getattr(e, "message", None) or str(e))


@router.put(
    "/market-prices/{row_uuid}",
    response_model=MaterialMarketPriceResponse,
    summary="Update material market price",
    dependencies=[_WRITE],
)
async def update_market_price(
    row_uuid: str,
    data: MaterialMarketPriceUpdate,
    current_user: Annotated[User, Depends(get_current_user)],
    tenant_id: Annotated[int, Depends(get_current_tenant)],
):
    try:
        payload = await MaterialMarketPriceService.update_price(
            tenant_id, row_uuid, data.model_dump(exclude_unset=True, by_alias=False), user=current_user
        )
        return MaterialMarketPriceResponse.model_validate(payload)
    except NotFoundError as e:
        raise _http(status.HTTP_404_NOT_FOUND, getattr(e, "message", None) or str(e))
    except ValidationError as e:
        raise _http(status.HTTP_400_BAD_REQUEST, getattr(e, "message", None) or str(e))


@router.delete(
    "/market-prices/{row_uuid}",
    summary="Delete material market price",
    dependencies=[_WRITE],
)
async def delete_market_price(
    row_uuid: str,
    current_user: Annotated[User, Depends(get_current_user)],
    tenant_id: Annotated[int, Depends(get_current_tenant)],
):
    try:
        await MaterialMarketPriceService.delete_price(tenant_id, row_uuid, user=current_user)
        return {"success": True}
    except NotFoundError as e:
        raise _http(status.HTTP_404_NOT_FOUND, getattr(e, "message", None) or str(e))
