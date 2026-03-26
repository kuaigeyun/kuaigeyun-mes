"""
往来核销与对账 API 控制器
"""

from fastapi import APIRouter, Depends, Query, HTTPException, status
from typing import List, Dict, Any
from datetime import date
from decimal import Decimal
from core.api.deps.deps import get_current_user
from apps.kuaicaiwu.services.finance_service import AccountSettlementService

router = APIRouter(prefix="/settlement", tags=["往来核销与对账"])
service = AccountSettlementService()

@router.post("/receivable", summary="执行应收核销")
async def settle_receivable(
    receivable_id: int,
    receipt_id: int,
    amount: Decimal,
    current_user: Any = Depends(get_current_user)
):
    return await service.settle_receivable(
        current_user.tenant_id, receivable_id, receipt_id, amount, current_user.id
    )

@router.post("/payable", summary="执行应付核销")
async def settle_payable(
    payable_id: int,
    payment_id: int,
    amount: Decimal,
    current_user: Any = Depends(get_current_user)
):
    return await service.settle_payable(
        current_user.tenant_id, payable_id, payment_id, amount, current_user.id
    )

@router.post("/auto-settle/receivables", summary="自动核销客户所有应收 (FIFO)")
async def auto_settle_receivables(
    customer_id: int,
    current_user: Any = Depends(get_current_user)
):
    count = await service.fifo_auto_settle_receivables(
        current_user.tenant_id, customer_id, current_user.id
    )
    return {"message": f"Successfully settled {count} transactions."}

@router.get("/partner-statement", summary="生成往来对账单预览")
async def get_statement(
    partner_id: int,
    partner_type: str = Query(..., description="Customer/Supplier"),
    start_date: date = Query(...),
    end_date: date = Query(...),
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
    current_user: Any = Depends(get_current_user)
):
    return await service.generate_formal_statement(
        current_user.tenant_id, partner_id, partner_type, period
    )
