"""
业财单据对账 API
"""

from datetime import date
from typing import Any, Optional

from fastapi import APIRouter, Depends, HTTPException, Query

from apps.kuaicaiwu.api._kuaicaiwu_route_access import require_kuaicaiwu_module_access
from apps.kuaicaiwu.services.document_reconciliation_service import DocumentReconciliationService
from core.api.deps.deps import get_current_user

router = APIRouter(
    prefix="/document-reconciliation",
    tags=["App · Kuaicaiwu · Document Reconciliation"],
    dependencies=[Depends(require_kuaicaiwu_module_access("document-reconciliation"))],
)
service = DocumentReconciliationService()


@router.get("/gaps/open", summary="Open finance gaps by partner and period")
async def list_open_gaps(
    partner_type: str = Query(..., description="Customer 或 Supplier"),
    partner_id: int = Query(...),
    start_date: date = Query(...),
    end_date: date = Query(...),
    only_gaps: bool = Query(True, description="仅返回未关联业财链或仍有未结清金额的单据"),
    current_user: Any = Depends(get_current_user),
):
    return await service.list_open_finance_gaps(
        current_user.tenant_id,
        partner_type=partner_type,
        partner_id=partner_id,
        start_date=start_date,
        end_date=end_date,
        only_gaps=only_gaps,
    )


@router.get("/pipeline-summary", summary="Tenant finance pipeline summary (read-only)")
async def get_pipeline_summary(current_user: Any = Depends(get_current_user)):
    return await service.get_pipeline_summary(current_user.tenant_id)


@router.get("/chain/{flow_type}/{document_type}/{document_id}", summary="Standard sales/purchase finance chain")
async def get_standard_chain(
    flow_type: str,
    document_type: str,
    document_id: int,
    current_user: Any = Depends(get_current_user),
):
    if flow_type.lower() not in ("sales", "purchase"):
        raise HTTPException(status_code=400, detail="flow_type 必须为 sales 或 purchase")
    return await service.build_standard_chain(
        current_user.tenant_id,
        flow_type=flow_type,
        document_type=document_type,
        document_id=document_id,
    )


@router.get("/prepayment-balances", summary="Prepayment balance summary")
async def get_prepayment_balances(current_user: Any = Depends(get_current_user)):
    return await service.get_prepayment_balances(current_user.tenant_id)


@router.get("/{document_type}/{document_id}", summary="Reconcile single document chain")
async def reconcile_document(
    document_type: str,
    document_id: int,
    current_user: Any = Depends(get_current_user),
):
    try:
        return await service.reconcile_document(
            current_user.tenant_id, document_type, document_id
        )
    except Exception as exc:
        raise HTTPException(status_code=400, detail=str(exc))
