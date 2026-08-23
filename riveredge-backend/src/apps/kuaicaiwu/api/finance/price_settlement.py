"""
月结定价 API
"""

from __future__ import annotations

import uuid
from typing import List, Optional

from fastapi import APIRouter, Depends, HTTPException, Query, status
from loguru import logger

from apps.kuaicaiwu.schemas.price_settlement_schemas import (
    PriceSettlementApplyResultResponse,
    PriceSettlementBatchCreate,
    PriceSettlementBatchResponse,
    PriceSettlementCandidateResponse,
    ProvisionalSummaryResponse,
)
from apps.kuaicaiwu.services.price_settlement_service import PriceSettlementService
from core.api.deps.access import require_permission_codes
from core.api.deps.deps import get_current_tenant
from infra.api.deps.deps import get_current_user
from infra.exceptions.exceptions import BusinessLogicError, NotFoundError, ValidationError
from infra.models.user import User

router = APIRouter(prefix="/price-settlement", tags=["App - Kuaicaiwu - Price Settlement"])
service = PriceSettlementService()


def _http_exception_with_trace(
    status_code: int,
    message: str,
    route: str,
    tenant_id: Optional[int] = None,
) -> HTTPException:
    trace_id = uuid.uuid4().hex
    logger.warning(
        "kuaicaiwu_price_settlement_api_error trace_id={} tenant_id={} route={} status_code={} message={}",
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


@router.get("/candidates", response_model=List[PriceSettlementCandidateResponse])
async def list_price_settlement_candidates(
    period: str = Query(..., pattern=r"^\d{4}-\d{2}$"),
    side: str = Query(..., pattern=r"^(sales|purchase)$"),
    partner_id: int = Query(...),
    price_source: str = Query(default="partner_book"),
    _auth: object = Depends(require_permission_codes("kuaicaiwu:price-settlement:read")),
    tenant_id: int = Depends(get_current_tenant),
):
    try:
        return await service.list_candidates(
            tenant_id,
            period=period,
            side=side,
            partner_id=partner_id,
            price_source=price_source,
        )
    except NotFoundError as exc:
        raise _http_exception_with_trace(status.HTTP_404_NOT_FOUND, str(exc), "candidates", tenant_id) from exc
    except ValidationError as exc:
        raise _http_exception_with_trace(status.HTTP_400_BAD_REQUEST, str(exc), "candidates", tenant_id) from exc
    except Exception as exc:
        logger.exception("list_price_settlement_candidates failed")
        raise _http_exception_with_trace(
            status.HTTP_500_INTERNAL_SERVER_ERROR,
            "获取待定价行失败",
            "candidates",
            tenant_id,
        ) from exc


@router.get("/provisional-summary", response_model=ProvisionalSummaryResponse)
async def get_provisional_summary(
    period: str = Query(..., pattern=r"^\d{4}-\d{2}$"),
    side: str = Query(..., pattern=r"^(sales|purchase)$"),
    partner_id: int = Query(...),
    _auth: object = Depends(require_permission_codes("kuaicaiwu:price-settlement:read")),
    tenant_id: int = Depends(get_current_tenant),
):
    try:
        return await service.provisional_summary(
            tenant_id,
            period=period,
            side=side,
            partner_id=partner_id,
        )
    except NotFoundError as exc:
        raise _http_exception_with_trace(status.HTTP_404_NOT_FOUND, str(exc), "provisional-summary", tenant_id) from exc
    except ValidationError as exc:
        raise _http_exception_with_trace(status.HTTP_400_BAD_REQUEST, str(exc), "provisional-summary", tenant_id) from exc
    except Exception as exc:
        logger.exception("get_provisional_summary failed")
        raise _http_exception_with_trace(
            status.HTTP_500_INTERNAL_SERVER_ERROR,
            "获取待定价汇总失败",
            "provisional-summary",
            tenant_id,
        ) from exc


@router.post("/batches", response_model=PriceSettlementBatchResponse, status_code=status.HTTP_201_CREATED)
async def create_price_settlement_batch(
    payload: PriceSettlementBatchCreate,
    _auth: object = Depends(require_permission_codes("kuaicaiwu:price-settlement:create")),
    tenant_id: int = Depends(get_current_tenant),
    current_user: User = Depends(get_current_user),
):
    try:
        return await service.create_batch(tenant_id, payload, int(current_user.id))
    except (ValidationError, BusinessLogicError) as exc:
        raise _http_exception_with_trace(status.HTTP_400_BAD_REQUEST, str(exc), "create-batch", tenant_id) from exc
    except NotFoundError as exc:
        raise _http_exception_with_trace(status.HTTP_404_NOT_FOUND, str(exc), "create-batch", tenant_id) from exc
    except Exception as exc:
        logger.exception("create_price_settlement_batch failed")
        raise _http_exception_with_trace(
            status.HTTP_500_INTERNAL_SERVER_ERROR,
            "创建定价单失败",
            "create-batch",
            tenant_id,
        ) from exc


@router.get("/batches/{batch_id}", response_model=PriceSettlementBatchResponse)
async def get_price_settlement_batch(
    batch_id: int,
    _auth: object = Depends(require_permission_codes("kuaicaiwu:price-settlement:read")),
    tenant_id: int = Depends(get_current_tenant),
):
    try:
        return await service.get_batch(tenant_id, batch_id)
    except NotFoundError as exc:
        raise _http_exception_with_trace(status.HTTP_404_NOT_FOUND, str(exc), "get-batch", tenant_id) from exc
    except Exception as exc:
        logger.exception("get_price_settlement_batch failed")
        raise _http_exception_with_trace(
            status.HTTP_500_INTERNAL_SERVER_ERROR,
            "获取定价单失败",
            "get-batch",
            tenant_id,
        ) from exc


@router.post("/batches/{batch_id}/apply", response_model=PriceSettlementApplyResultResponse)
async def apply_price_settlement_batch(
    batch_id: int,
    _auth: object = Depends(require_permission_codes("kuaicaiwu:price-settlement:execute")),
    tenant_id: int = Depends(get_current_tenant),
    current_user: User = Depends(get_current_user),
):
    try:
        return await service.apply_batch(tenant_id, batch_id, int(current_user.id))
    except (ValidationError, BusinessLogicError) as exc:
        raise _http_exception_with_trace(status.HTTP_400_BAD_REQUEST, str(exc), "apply-batch", tenant_id) from exc
    except NotFoundError as exc:
        raise _http_exception_with_trace(status.HTTP_404_NOT_FOUND, str(exc), "apply-batch", tenant_id) from exc
    except Exception as exc:
        logger.exception("apply_price_settlement_batch failed")
        raise _http_exception_with_trace(
            status.HTTP_500_INTERNAL_SERVER_ERROR,
            "定价生效失败",
            "apply-batch",
            tenant_id,
        ) from exc
