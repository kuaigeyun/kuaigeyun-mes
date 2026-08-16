"""
往来核销 API 控制器
"""

import uuid
from fastapi import APIRouter, Depends, Query, HTTPException, status
from typing import Any, Optional
from decimal import Decimal
from loguru import logger
from core.api.deps.access import require_permission_codes
from core.api.deps.deps import get_current_user
from apps.kuaicaiwu.services.finance_service import AccountSettlementService
from apps.kuaicaiwu.services.settlement_gate_service import SettlementGateService
from apps.kuaicaiwu.schemas.finance import SettlementRecordListResponse, SettlementRecordResponse
from apps.kuaicaiwu.utils.settlement_db_guard import (
    SETTLEMENTS_TABLE_MISSING_HINT,
    is_settlements_table_missing,
)
from infra.exceptions.exceptions import BusinessLogicError, NotFoundError, ValidationError

router = APIRouter(prefix="/settlement", tags=["App - Kuaicaiwu - Settlement & Reconciliation"])
service = AccountSettlementService()
settlement_gate_service = SettlementGateService()


def _http_exception_with_trace(
    status_code: int,
    message: str,
    route: str,
    tenant_id: Optional[int] = None,
) -> HTTPException:
    trace_id = uuid.uuid4().hex
    logger.warning(
        "kuaicaiwu_finance_settlement_api_error trace_id={} tenant_id={} route={} status_code={} message={}",
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


@router.get("/records", response_model=SettlementRecordListResponse, summary="List settlement records")
async def list_settlement_records(
    skip: int = Query(0, ge=0),
    limit: int = Query(20, ge=1, le=100),
    business_type: Optional[str] = Query(
        None,
        description="业务方向 receivable|payable",
    ),
    partner_id: Optional[int] = Query(None),
    keyword: Optional[str] = Query(None),
    settlement_date_start: Optional[str] = Query(None),
    settlement_date_end: Optional[str] = Query(None),
    sort_field: Optional[str] = Query(None),
    sort_order: Optional[str] = Query(None),
    _auth: object = Depends(require_permission_codes("kuaicaiwu:settlement:read")),
    current_user: Any = Depends(get_current_user),
):
    if business_type and business_type not in {"receivable", "payable"}:
        raise _http_exception_with_trace(
            status.HTTP_422_UNPROCESSABLE_ENTITY,
            "business_type 必须为 receivable 或 payable",
            "/settlement/records",
            current_user.tenant_id,
        )
    try:
        rows, total = await service.list_settlement_records(
            current_user.tenant_id,
            skip,
            limit,
            business_type=business_type,
            partner_id=partner_id,
            keyword=keyword,
            settlement_date_start=settlement_date_start,
            settlement_date_end=settlement_date_end,
            sort_field=sort_field,
            sort_order=sort_order,
        )
        items = [SettlementRecordResponse.model_validate(row) for row in rows]
        return SettlementRecordListResponse(
            items=items,
            total=total,
            skip=skip,
            limit=limit,
        )
    except Exception as e:
        if is_settlements_table_missing(e):
            logger.exception(
                "list_settlement_records missing settlements table tenant_id={}",
                current_user.tenant_id,
            )
            raise _http_exception_with_trace(
                status.HTTP_503_SERVICE_UNAVAILABLE,
                SETTLEMENTS_TABLE_MISSING_HINT,
                "/settlement/records",
                current_user.tenant_id,
            ) from e
        raise


@router.get("/receivable/preview", summary="Preview receivable settlement")
async def preview_settle_receivable(
    receivable_id: int = Query(..., description="应收单ID"),
    receipt_id: int = Query(..., description="收款单ID"),
    _auth: object = Depends(require_permission_codes("kuaicaiwu:settlement:read")),
    current_user: Any = Depends(get_current_user),
):
    try:
        return await settlement_gate_service.preview_settle_receivable(
            tenant_id=current_user.tenant_id,
            receivable_id=receivable_id,
            receipt_id=receipt_id,
        )
    except NotFoundError as e:
        raise _http_exception_with_trace(404, str(e), "/settlement/receivable/preview", current_user.tenant_id) from e


@router.get("/payable/preview", summary="Preview payable settlement")
async def preview_settle_payable(
    payable_id: int = Query(..., description="应付单ID"),
    payment_id: int = Query(..., description="付款单ID"),
    _auth: object = Depends(require_permission_codes("kuaicaiwu:settlement:read")),
    current_user: Any = Depends(get_current_user),
):
    try:
        return await settlement_gate_service.preview_settle_payable(
            tenant_id=current_user.tenant_id,
            payable_id=payable_id,
            payment_id=payment_id,
        )
    except NotFoundError as e:
        raise _http_exception_with_trace(404, str(e), "/settlement/payable/preview", current_user.tenant_id) from e


@router.post("/receivable", summary="Settle receivable")
async def settle_receivable(
    receivable_id: int,
    receipt_id: int,
    amount: Decimal,
    currency: str = Query("CNY", description="币种"),
    invoice_exchange_rate: Decimal | None = Query(None, description="发票日汇率"),
    payment_exchange_rate: Decimal | None = Query(None, description="付款/收款日汇率"),
    _auth: object = Depends(require_permission_codes("kuaicaiwu:settlement:update")),
    current_user: Any = Depends(get_current_user)
):
    try:
        await settlement_gate_service.assert_settle_receivable_allowed(
            tenant_id=current_user.tenant_id,
            receivable_id=receivable_id,
            receipt_id=receipt_id,
            amount=amount,
        )
        return await service.settle_receivable(
            current_user.tenant_id,
            receivable_id,
            receipt_id,
            amount,
            current_user.id,
            currency=currency,
            invoice_exchange_rate=invoice_exchange_rate,
            payment_exchange_rate=payment_exchange_rate,
        )
    except (BusinessLogicError, ValidationError, NotFoundError) as e:
        code = 404 if isinstance(e, NotFoundError) else 422
        raise _http_exception_with_trace(code, str(e), "/settlement/receivable", current_user.tenant_id) from e
    except Exception as e:
        if is_settlements_table_missing(e):
            logger.exception(
                "settle_receivable missing settlements table tenant_id={}",
                current_user.tenant_id,
            )
            raise _http_exception_with_trace(
                status.HTTP_503_SERVICE_UNAVAILABLE,
                SETTLEMENTS_TABLE_MISSING_HINT,
                "/settlement/receivable",
                current_user.tenant_id,
            ) from e
        raise


@router.post("/payable", summary="Settle payable")
async def settle_payable(
    payable_id: int,
    payment_id: int,
    amount: Decimal,
    currency: str = Query("CNY", description="币种"),
    invoice_exchange_rate: Decimal | None = Query(None, description="发票日汇率"),
    payment_exchange_rate: Decimal | None = Query(None, description="付款/收款日汇率"),
    _auth: object = Depends(require_permission_codes("kuaicaiwu:settlement:update")),
    current_user: Any = Depends(get_current_user)
):
    try:
        await settlement_gate_service.assert_settle_payable_allowed(
            tenant_id=current_user.tenant_id,
            payable_id=payable_id,
            payment_id=payment_id,
            amount=amount,
        )
        return await service.settle_payable(
            current_user.tenant_id,
            payable_id,
            payment_id,
            amount,
            current_user.id,
            currency=currency,
            invoice_exchange_rate=invoice_exchange_rate,
            payment_exchange_rate=payment_exchange_rate,
        )
    except (BusinessLogicError, ValidationError, NotFoundError) as e:
        code = 404 if isinstance(e, NotFoundError) else 422
        raise _http_exception_with_trace(code, str(e), "/settlement/payable", current_user.tenant_id) from e
    except Exception as e:
        if is_settlements_table_missing(e):
            logger.exception(
                "settle_payable missing settlements table tenant_id={}",
                current_user.tenant_id,
            )
            raise _http_exception_with_trace(
                status.HTTP_503_SERVICE_UNAVAILABLE,
                SETTLEMENTS_TABLE_MISSING_HINT,
                "/settlement/payable",
                current_user.tenant_id,
            ) from e
        raise


@router.post("/fx-revaluation/period-end", summary="Period-end FX revaluation (draft exchange entries)")
async def revaluate_period_end(
    period: str = Query(..., description="期间，格式 YYYY-MM"),
    currency: str = Query("USD", description="外币币种"),
    book_rate: Decimal = Query(..., description="账面汇率"),
    period_end_rate: Decimal = Query(..., description="期末汇率"),
    doc_type: str = Query("all", description="all/receivable/payable"),
    _auth: object = Depends(require_permission_codes("kuaicaiwu:settlement:update")),
    current_user: Any = Depends(get_current_user),
):
    if doc_type not in {"all", "receivable", "payable"}:
        raise _http_exception_with_trace(
            status.HTTP_422_UNPROCESSABLE_ENTITY,
            "doc_type 必须为 all/receivable/payable",
            "/settlement/fx-revaluation/period-end",
            current_user.tenant_id,
        )
    return await service.revaluate_period_end(
        tenant_id=current_user.tenant_id,
        operator_id=current_user.id,
        period=period,
        currency=currency,
        book_rate=book_rate,
        period_end_rate=period_end_rate,
        doc_type=doc_type,
    )
