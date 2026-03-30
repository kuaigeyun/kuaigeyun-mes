"""
往来核销与对账 API 控制器
"""

import uuid
from fastapi import APIRouter, Depends, Query, HTTPException, status
from typing import Any, Optional
from datetime import date
from decimal import Decimal
from loguru import logger
from core.api.deps.access import require_access
from core.api.deps.deps import get_current_user
from apps.kuaicaiwu.services.finance_service import AccountSettlementService

router = APIRouter(prefix="/settlement", tags=["往来核销与对账"])
service = AccountSettlementService()


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


@router.get("/suggestions/receivable", summary="应收核销建议列表")
async def get_receivable_suggestions(
    customer_id: int | None = Query(None, description="客户ID（可选，不传则返回全部客户建议）"),
    limit: int = Query(50, ge=1, le=200, description="返回建议数量上限"),
    _auth: object = Depends(
        require_access(
            "finance.settlement",
            "read",
            required_permissions=["kuaicaiwu:receivable:view"],
        )
    ),
    current_user: Any = Depends(get_current_user),
):
    items = await service.suggest_receivable_matches(
        tenant_id=current_user.tenant_id,
        customer_id=customer_id,
        limit=limit,
    )
    return {"items": items, "total": len(items)}


@router.get("/suggestions/payable", summary="应付核销建议列表")
async def get_payable_suggestions(
    supplier_id: int | None = Query(None, description="供应商ID（可选，不传则返回全部供应商建议）"),
    limit: int = Query(50, ge=1, le=200, description="返回建议数量上限"),
    _auth: object = Depends(
        require_access(
            "finance.settlement",
            "read",
            required_permissions=["kuaicaiwu:payable:view"],
        )
    ),
    current_user: Any = Depends(get_current_user),
):
    items = await service.suggest_payable_matches(
        tenant_id=current_user.tenant_id,
        supplier_id=supplier_id,
        limit=limit,
    )
    return {"items": items, "total": len(items)}

@router.post("/receivable", summary="执行应收核销")
async def settle_receivable(
    receivable_id: int,
    receipt_id: int,
    amount: Decimal,
    currency: str = Query("CNY", description="币种"),
    invoice_exchange_rate: Decimal | None = Query(None, description="发票日汇率"),
    payment_exchange_rate: Decimal | None = Query(None, description="付款/收款日汇率"),
    _auth: object = Depends(
        require_access(
            "finance.settlement",
            "update",
            required_permissions=["kuaicaiwu:receivable:update"],
        )
    ),
    current_user: Any = Depends(get_current_user)
):
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

@router.post("/payable", summary="执行应付核销")
async def settle_payable(
    payable_id: int,
    payment_id: int,
    amount: Decimal,
    currency: str = Query("CNY", description="币种"),
    invoice_exchange_rate: Decimal | None = Query(None, description="发票日汇率"),
    payment_exchange_rate: Decimal | None = Query(None, description="付款/收款日汇率"),
    _auth: object = Depends(
        require_access(
            "finance.settlement",
            "update",
            required_permissions=["kuaicaiwu:payable:update"],
        )
    ),
    current_user: Any = Depends(get_current_user)
):
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

@router.post("/auto-settle/receivables", summary="自动核销客户所有应收 (FIFO)")
async def auto_settle_receivables(
    customer_id: int,
    _auth: object = Depends(
        require_access(
            "finance.settlement",
            "update",
            required_permissions=["kuaicaiwu:receivable:update"],
        )
    ),
    current_user: Any = Depends(get_current_user)
):
    count = await service.fifo_auto_settle_receivables(
        current_user.tenant_id, customer_id, current_user.id
    )
    return {"message": f"Successfully settled {count} transactions."}


@router.post("/fx-revaluation/period-end", summary="期末调汇并生成汇兑凭证候选")
async def revaluate_period_end(
    period: str = Query(..., description="期间，格式 YYYY-MM"),
    currency: str = Query("USD", description="外币币种"),
    book_rate: Decimal = Query(..., description="账面汇率"),
    period_end_rate: Decimal = Query(..., description="期末汇率"),
    doc_type: str = Query("all", description="all/receivable/payable"),
    _auth: object = Depends(
        require_access(
            "finance.settlement",
            "update",
            required_permissions=["kuaicaiwu:receivable:update", "kuaicaiwu:payable:update"],
        )
    ),
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

@router.get("/partner-statement", summary="生成往来对账单预览")
async def get_statement(
    partner_id: int,
    partner_type: str = Query(..., description="Customer/Supplier"),
    start_date: date = Query(...),
    end_date: date = Query(...),
    _auth: object = Depends(
        require_access(
            "finance.settlement",
            "read",
            required_permissions=["kuaicaiwu:receivable:view", "kuaicaiwu:payable:view"],
        )
    ),
    current_user: Any = Depends(get_current_user)
):
    return await service.generate_partner_statement(
        current_user.tenant_id, partner_id, partner_type, start_date, end_date
    )

@router.post("/archive-statement", summary="存档正式往来对账单")
async def archive_statement(
    partner_id: int,
    partner_type: str,
    period: str = Query(..., description="YYYY-MM"),
    _auth: object = Depends(
        require_access(
            "finance.settlement",
            "create",
            required_permissions=["kuaicaiwu:receivable:update", "kuaicaiwu:payable:update"],
        )
    ),
    current_user: Any = Depends(get_current_user)
):
    return await service.generate_formal_statement(
        current_user.tenant_id, partner_id, partner_type, period
    )
