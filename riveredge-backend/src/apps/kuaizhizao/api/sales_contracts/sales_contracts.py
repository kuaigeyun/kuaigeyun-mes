"""
销售合同 API
"""

from typing import List, Optional

from fastapi import APIRouter, Body, Depends, HTTPException, Path, Query, status as http_status
from loguru import logger

from core.api.deps import get_current_tenant, get_current_user
from apps.kuaizhizao.api._kuaizhizao_route_access import require_kuaizhizao_module_access
from infra.exceptions.exceptions import BusinessLogicError, NotFoundError, ValidationError
from infra.models.user import User

from apps.kuaizhizao.schemas.sales_contract import (
    SalesContractChangeCreate,
    SalesContractChangeResponse,
    SalesContractConvertToOrderRequest,
    SalesContractPushToWorkOrderRequest,
    SalesContractCreate,
    SalesContractListResponse,
    SalesContractResponse,
    SalesContractReviewAction,
    SalesContractUpdate,
    SalesContractAlertItem,
    SalesContractExecutionSummary,
)
from apps.kuaizhizao.services.sales_contract_service import SalesContractService
from apps.kuaizhizao.services.contract_milestone_billing_service import ContractMilestoneBillingService

service = SalesContractService()
billing_service = ContractMilestoneBillingService()
router = APIRouter(
    prefix="/sales-contracts",
    tags=["App · Kuaige Zhizao · Sales Contracts"],
    dependencies=[Depends(require_kuaizhizao_module_access("sales-contract"))],
)


@router.post("", response_model=SalesContractResponse, summary="Create sales contract")
async def create_contract(
    data: SalesContractCreate,
    auto_submit: bool = Query(False),
    current_user: User = Depends(get_current_user),
    tenant_id: int = Depends(get_current_tenant),
):
    try:
        return await service.create_contract(tenant_id, data, current_user.id, auto_submit=auto_submit)
    except ValidationError as e:
        raise HTTPException(status_code=http_status.HTTP_400_BAD_REQUEST, detail=str(e))
    except Exception as e:
        logger.error("创建销售合同失败: %s", e)
        raise HTTPException(status_code=500, detail="创建销售合同失败")


@router.get("", response_model=SalesContractListResponse, summary="List sales contracts")
async def list_contracts(
    skip: int = Query(0, ge=0),
    limit: int = Query(100, ge=1, le=1000),
    status: Optional[str] = Query(None),
    contract_type: Optional[str] = Query(None),
    keyword: Optional[str] = Query(None),
    customer_id: Optional[int] = Query(None),
    tenant_id: int = Depends(get_current_tenant),
):
    return await service.list_contracts(
        tenant_id, skip=skip, limit=limit, status=status,
        contract_type=contract_type, keyword=keyword, customer_id=customer_id,
    )


@router.get("/alerts", response_model=List[SalesContractAlertItem], summary="Contract alerts")
async def list_alerts(tenant_id: int = Depends(get_current_tenant)):
    return await service.list_alerts(tenant_id)


@router.get("/execution-summary", response_model=List[SalesContractExecutionSummary], summary="Framework execution summary")
async def execution_summary(tenant_id: int = Depends(get_current_tenant)):
    return await service.get_execution_summaries(tenant_id)


@router.get("/{contract_id}", response_model=SalesContractResponse, summary="Get sales contract")
async def get_contract(
    contract_id: int = Path(...),
    include_items: bool = Query(True),
    tenant_id: int = Depends(get_current_tenant),
):
    try:
        return await service.get_contract_by_id(tenant_id, contract_id, include_items=include_items)
    except NotFoundError as e:
        raise HTTPException(status_code=404, detail=str(e))


@router.put("/{contract_id}", response_model=SalesContractResponse, summary="Update sales contract")
async def update_contract(
    contract_id: int,
    data: SalesContractUpdate,
    current_user: User = Depends(get_current_user),
    tenant_id: int = Depends(get_current_tenant),
):
    try:
        return await service.update_contract(tenant_id, contract_id, data, current_user.id)
    except NotFoundError as e:
        raise HTTPException(status_code=404, detail=str(e))
    except (BusinessLogicError, ValidationError) as e:
        raise HTTPException(status_code=400, detail=str(e))


@router.delete("/{contract_id}", summary="Delete sales contract")
async def delete_contract(
    contract_id: int,
    current_user: User = Depends(get_current_user),
    tenant_id: int = Depends(get_current_tenant),
):
    try:
        await service.delete_contract(tenant_id, contract_id, current_user.id)
        return {"success": True}
    except NotFoundError as e:
        raise HTTPException(status_code=404, detail=str(e))
    except BusinessLogicError as e:
        raise HTTPException(status_code=400, detail=str(e))


@router.post("/{contract_id}/submit", response_model=SalesContractResponse, summary="Submit contract")
async def submit_contract(
    contract_id: int,
    current_user: User = Depends(get_current_user),
    tenant_id: int = Depends(get_current_tenant),
):
    try:
        return await service.submit_contract(tenant_id, contract_id, current_user.id)
    except NotFoundError as e:
        raise HTTPException(status_code=404, detail=str(e))
    except BusinessLogicError as e:
        raise HTTPException(status_code=400, detail=str(e))


@router.post("/{contract_id}/approve", response_model=SalesContractResponse, summary="Approve contract")
async def approve_contract(
    contract_id: int,
    body: SalesContractReviewAction = Body(default_factory=SalesContractReviewAction),
    current_user: User = Depends(get_current_user),
    tenant_id: int = Depends(get_current_tenant),
):
    try:
        name = getattr(current_user, "full_name", None) or getattr(current_user, "username", str(current_user.id))
        return await service.approve_contract(
            tenant_id, contract_id, current_user.id, name, body.review_remarks
        )
    except NotFoundError as e:
        raise HTTPException(status_code=404, detail=str(e))
    except BusinessLogicError as e:
        raise HTTPException(status_code=400, detail=str(e))


@router.post("/{contract_id}/reject", response_model=SalesContractResponse, summary="Reject contract")
async def reject_contract(
    contract_id: int,
    body: SalesContractReviewAction = Body(default_factory=SalesContractReviewAction),
    current_user: User = Depends(get_current_user),
    tenant_id: int = Depends(get_current_tenant),
):
    try:
        name = getattr(current_user, "full_name", None) or getattr(current_user, "username", str(current_user.id))
        return await service.reject_contract(
            tenant_id, contract_id, current_user.id, name, body.review_remarks
        )
    except NotFoundError as e:
        raise HTTPException(status_code=404, detail=str(e))
    except BusinessLogicError as e:
        raise HTTPException(status_code=400, detail=str(e))


@router.post("/{contract_id}/withdraw", response_model=SalesContractResponse, summary="Withdraw submitted contract")
async def withdraw_contract(
    contract_id: int,
    current_user: User = Depends(get_current_user),
    tenant_id: int = Depends(get_current_tenant),
):
    """待审核合同撤回到草稿。"""
    try:
        return await service.withdraw_contract(tenant_id, contract_id, current_user.id)
    except NotFoundError as e:
        raise HTTPException(status_code=404, detail=str(e))
    except BusinessLogicError as e:
        raise HTTPException(status_code=400, detail=str(e))


@router.post("/{contract_id}/revoke-review", response_model=SalesContractResponse, summary="Revoke contract approval")
async def revoke_contract_review(
    contract_id: int,
    current_user: User = Depends(get_current_user),
    tenant_id: int = Depends(get_current_tenant),
):
    """已生效且未释放的合同撤回审核，回到待审核。"""
    try:
        return await service.revoke_contract_approval(tenant_id, contract_id, current_user.id)
    except NotFoundError as e:
        raise HTTPException(status_code=404, detail=str(e))
    except BusinessLogicError as e:
        raise HTTPException(status_code=400, detail=str(e))


@router.get("/{contract_id}/print", summary="Print sales contract")
async def print_contract(
    contract_id: int = Path(...),
    template_code: Optional[str] = Query(None, description="打印模板代码"),
    template_uuid: Optional[str] = Query(None, description="打印模板UUID"),
    output_format: str = Query("html", description="输出格式"),
    response_format: str = Query("json", description="响应格式"),
    current_user: User = Depends(get_current_user),
    tenant_id: int = Depends(get_current_tenant),
):
    import base64
    from apps.kuaizhizao.services.print_service import DocumentPrintService
    from fastapi.responses import HTMLResponse, JSONResponse, Response

    try:
        result = await DocumentPrintService().print_document(
            tenant_id=tenant_id,
            document_type="sales_contract",
            document_id=contract_id,
            template_code=template_code,
            template_uuid=template_uuid,
            output_format=output_format,
        )
    except NotFoundError as e:
        raise HTTPException(status_code=http_status.HTTP_404_NOT_FOUND, detail=str(e))
    except BusinessLogicError as e:
        raise HTTPException(status_code=http_status.HTTP_400_BAD_REQUEST, detail=str(e))

    if (
        (output_format or "html").lower() == "pdf"
        and (response_format or "json").lower() in {"pdf", "binary", "raw"}
        and result.get("mime_type") == "application/pdf"
    ):
        raw = base64.b64decode(result.get("content") or "")
        return Response(
            content=raw,
            media_type="application/pdf",
            headers={"Content-Disposition": f'inline; filename="sales-contract-{contract_id}.pdf"'},
        )
    if response_format == "html":
        return HTMLResponse(content=result.get("content", ""), status_code=200)
    return JSONResponse(content=result, status_code=200)


@router.get("/{contract_id}/print-variables", summary="Sales contract print variables")
async def get_contract_print_variables(
    contract_id: int = Path(...),
    current_user: User = Depends(get_current_user),
    tenant_id: int = Depends(get_current_tenant),
):
    from apps.kuaizhizao.services.print_service import DocumentPrintService

    try:
        variables = await DocumentPrintService().get_document_variables_for_print(
            tenant_id, "sales_contract", contract_id
        )
        return {"success": True, "variables": variables}
    except NotFoundError as e:
        raise HTTPException(status_code=http_status.HTTP_404_NOT_FOUND, detail=str(e))


@router.post("/from-quotation/{quotation_id}", response_model=SalesContractResponse, summary="Convert quotation to contract")
async def convert_from_quotation(
    quotation_id: int,
    contract_type: str = Query("single"),
    current_user: User = Depends(get_current_user),
    tenant_id: int = Depends(get_current_tenant),
):
    try:
        return await service.convert_from_quotation(
            tenant_id, quotation_id, current_user.id, contract_type=contract_type
        )
    except NotFoundError as e:
        raise HTTPException(status_code=404, detail=str(e))
    except BusinessLogicError as e:
        raise HTTPException(status_code=400, detail=str(e))


@router.post("/{contract_id}/convert-to-order", summary="Release sales order from contract")
async def convert_to_order(
    contract_id: int,
    body: SalesContractConvertToOrderRequest = Body(default_factory=SalesContractConvertToOrderRequest),
    current_user: User = Depends(get_current_user),
    tenant_id: int = Depends(get_current_tenant),
):
    try:
        sales_order, contract = await service.convert_to_sales_order(
            tenant_id,
            contract_id,
            current_user.id,
            selected_item_ids=body.selected_item_ids,
            release_lines=body.release_lines,
        )
        from apps.kuaizhizao.services.sales_order_service import SalesOrderService

        so_resp = await SalesOrderService().get_sales_order_by_id(
            tenant_id=tenant_id, sales_order_id=int(sales_order.id), include_items=False
        )
        return {"sales_order": so_resp, "contract": contract}
    except NotFoundError as e:
        raise HTTPException(status_code=404, detail=str(e))
    except BusinessLogicError as e:
        raise HTTPException(status_code=409, detail=str(e))


@router.get(
    "/{contract_id}/push-to-sales-order/preview",
    summary="Push sales contract to sales order preview",
)
async def preview_push_to_sales_order(
    contract_id: int,
    tenant_id: int = Depends(get_current_tenant),
):
    try:
        return await service.preview_push_sales_contract_to_sales_order(
            tenant_id, contract_id
        )
    except NotFoundError as e:
        raise HTTPException(status_code=404, detail=str(e))
    except BusinessLogicError as e:
        raise HTTPException(status_code=400, detail=str(e))


@router.get(
    "/{contract_id}/push-to-work-order/preview",
    summary="Direct push sales contract to work order preview",
)
async def preview_push_to_work_order(
    contract_id: int,
    tenant_id: int = Depends(get_current_tenant),
):
    try:
        return await service.preview_push_sales_contract_to_work_order(tenant_id, contract_id)
    except NotFoundError as e:
        raise HTTPException(status_code=404, detail=str(e))
    except BusinessLogicError as e:
        raise HTTPException(status_code=400, detail=str(e))


@router.post(
    "/{contract_id}/push-to-work-order",
    summary="Direct push sales contract to work order",
)
async def push_to_work_order(
    contract_id: int,
    body: SalesContractPushToWorkOrderRequest = Body(
        default_factory=SalesContractPushToWorkOrderRequest
    ),
    current_user: User = Depends(get_current_user),
    tenant_id: int = Depends(get_current_tenant),
):
    try:
        return await service.push_sales_contract_to_work_order(
            tenant_id=tenant_id,
            contract_id=contract_id,
            created_by=current_user.id,
            selected_item_ids=body.selected_item_ids,
            release_lines=body.release_lines,
            work_order_granularity=body.work_order_granularity,
            push_mode=body.push_mode,
        )
    except NotFoundError as e:
        raise HTTPException(status_code=404, detail=str(e))
    except BusinessLogicError as e:
        raise HTTPException(status_code=409, detail=str(e))


@router.post("/{contract_id}/changes", response_model=SalesContractChangeResponse, summary="Create contract change")
async def create_change(
    contract_id: int,
    data: SalesContractChangeCreate,
    current_user: User = Depends(get_current_user),
    tenant_id: int = Depends(get_current_tenant),
):
    try:
        return await service.create_contract_change(tenant_id, contract_id, data, current_user.id)
    except NotFoundError as e:
        raise HTTPException(status_code=404, detail=str(e))
    except BusinessLogicError as e:
        raise HTTPException(status_code=400, detail=str(e))


@router.post("/changes/{change_id}/approve", response_model=SalesContractChangeResponse, summary="Approve contract change")
async def approve_change(
    change_id: int,
    current_user: User = Depends(get_current_user),
    tenant_id: int = Depends(get_current_tenant),
):
    try:
        return await service.approve_contract_change(tenant_id, change_id, current_user.id)
    except NotFoundError as e:
        raise HTTPException(status_code=404, detail=str(e))
    except BusinessLogicError as e:
        raise HTTPException(status_code=400, detail=str(e))


@router.post("/{contract_id}/close", response_model=SalesContractResponse, summary="Close contract")
async def close_contract(
    contract_id: int,
    reason: Optional[str] = Body(None, embed=True),
    current_user: User = Depends(get_current_user),
    tenant_id: int = Depends(get_current_tenant),
):
    try:
        return await service.close_contract(tenant_id, contract_id, current_user.id, reason)
    except NotFoundError as e:
        raise HTTPException(status_code=404, detail=str(e))
    except BusinessLogicError as e:
        raise HTTPException(status_code=400, detail=str(e))


@router.get("/{contract_id}/payment-summary", summary="Contract payment summary")
async def payment_summary(contract_id: int, tenant_id: int = Depends(get_current_tenant)):
    try:
        return await service.get_payment_summary(tenant_id, contract_id)
    except NotFoundError as e:
        raise HTTPException(status_code=404, detail=str(e))


@router.get("/{contract_id}/changes", response_model=List[SalesContractChangeResponse], summary="List contract changes")
async def list_changes(
    contract_id: int,
    skip: int = Query(0, ge=0),
    limit: int = Query(100, ge=1, le=500),
    tenant_id: int = Depends(get_current_tenant),
):
    return await service.list_contract_changes(tenant_id, contract_id=contract_id, skip=skip, limit=limit)


@router.post("/{contract_id}/milestones/{milestone_id}/generate-receivable", summary="Generate receivable from milestone")
async def generate_milestone_receivable(
    contract_id: int,
    milestone_id: int,
    current_user: User = Depends(get_current_user),
    tenant_id: int = Depends(get_current_tenant),
):
    try:
        return await billing_service.generate_receivable_for_milestone(
            tenant_id, contract_id, milestone_id, current_user.id
        )
    except NotFoundError as e:
        raise HTTPException(status_code=404, detail=str(e))
    except BusinessLogicError as e:
        raise HTTPException(status_code=409, detail=str(e))


@router.post("/changes/{change_id}/submit", response_model=SalesContractChangeResponse, summary="Submit contract change")
async def submit_change(
    change_id: int,
    current_user: User = Depends(get_current_user),
    tenant_id: int = Depends(get_current_tenant),
):
    try:
        return await service.submit_contract_change(tenant_id, change_id, current_user.id)
    except NotFoundError as e:
        raise HTTPException(status_code=404, detail=str(e))
    except BusinessLogicError as e:
        raise HTTPException(status_code=400, detail=str(e))


@router.post("/changes/{change_id}/reject", response_model=SalesContractChangeResponse, summary="Reject contract change")
async def reject_change(
    change_id: int,
    current_user: User = Depends(get_current_user),
    tenant_id: int = Depends(get_current_tenant),
):
    try:
        return await service.reject_contract_change(tenant_id, change_id, current_user.id)
    except NotFoundError as e:
        raise HTTPException(status_code=404, detail=str(e))
    except BusinessLogicError as e:
        raise HTTPException(status_code=400, detail=str(e))
