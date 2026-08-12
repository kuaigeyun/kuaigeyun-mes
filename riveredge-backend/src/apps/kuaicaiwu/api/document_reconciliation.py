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
    tags=["App - Kuaicaiwu - Document Reconciliation"],
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
    keyword: Optional[str] = Query(None),
    doc_type: Optional[str] = Query(None),
    doc_code: Optional[str] = Query(None),
    sort_field: Optional[str] = Query(None),
    sort_order: Optional[str] = Query(None),
    skip: int = Query(0, ge=0),
    limit: int = Query(20, ge=1, le=200),
    current_user: Any = Depends(get_current_user),
):
    return await service.list_open_finance_gaps(
        current_user.tenant_id,
        partner_type=partner_type,
        partner_id=partner_id,
        start_date=start_date,
        end_date=end_date,
        only_gaps=only_gaps,
        keyword=keyword,
        doc_type=doc_type,
        doc_code=doc_code,
        sort_field=sort_field,
        sort_order=sort_order,
        skip=skip,
        limit=limit,
    )


@router.get("/pipeline-summary", summary="Tenant finance pipeline summary (read-only)")
async def get_pipeline_summary(current_user: Any = Depends(get_current_user)):
    return await service.get_pipeline_summary(current_user.tenant_id)


@router.get("/chain-candidates", summary="Search chain start documents by code")
async def list_chain_candidates(
    document_type: str = Query(..., description="起始单据类型"),
    keyword: Optional[str] = Query(None, description="单据编号或往来单位名称"),
    limit: int = Query(20, ge=1, le=50),
    current_user: Any = Depends(get_current_user),
):
    from infra.exceptions.exceptions import ValidationError

    try:
        return await service.list_chain_document_candidates(
            current_user.tenant_id,
            document_type=document_type,
            keyword=keyword,
            limit=limit,
        )
    except ValidationError as exc:
        raise HTTPException(status_code=400, detail=str(exc)) from exc


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
async def get_prepayment_balances(
    partner_type: Optional[str] = Query(None, description="customer 或 supplier；传入时分页返回 items"),
    keyword: Optional[str] = Query(None),
    partner_name: Optional[str] = Query(None),
    skip: int = Query(0, ge=0),
    limit: int = Query(20, ge=1, le=200),
    sort_field: Optional[str] = Query(None),
    sort_order: Optional[str] = Query(None),
    current_user: Any = Depends(get_current_user),
):
    return await service.get_prepayment_balances(
        current_user.tenant_id,
        partner_type=partner_type,
        keyword=keyword,
        partner_name=partner_name,
        skip=skip,
        limit=limit,
        sort_field=sort_field,
        sort_order=sort_order,
        operator_id=getattr(current_user, "id", None),
    )


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
