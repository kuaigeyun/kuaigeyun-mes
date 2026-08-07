"""安装执行单 API"""

from typing import Any, Optional
import uuid

from fastapi import APIRouter, Depends, HTTPException as FastAPIHTTPException, Path, Query, status
from loguru import logger

from apps.kuaizhizao.api._kuaizhizao_route_access import require_kuaizhizao_module_access
from apps.kuaizhizao.schemas.install_execution import (
    InstallExecutionAdvanceStage,
    InstallExecutionClose,
    InstallExecutionCostCreate,
    InstallExecutionCreate,
    InstallExecutionListEnvelope,
    InstallExecutionPullFromSalesDeliveryRequest,
    InstallExecutionPullFromSalesOrderRequest,
    InstallExecutionResponse,
    InstallExecutionTaskCreate,
    InstallExecutionUpdate,
)
from apps.kuaizhizao.services.install_execution_service import (
    INSTALL_EXECUTION_SORTABLE_FIELDS,
    InstallExecutionService,
)
from core.api.deps import get_current_tenant, get_current_user
from infra.exceptions.exceptions import BusinessLogicError, NotFoundError, ValidationError
from infra.models.user import User

router = APIRouter(
    prefix="/install-executions",
    tags=["App - Kuaige Zhizao - Install Execution"],
    dependencies=[Depends(require_kuaizhizao_module_access("after-sales-install"))],
)

_service = InstallExecutionService()


def _http_exception_with_trace(
    status_code: int,
    message: str,
    route: str = "/install-executions",
    tenant_id: Optional[int] = None,
) -> FastAPIHTTPException:
    trace_id = uuid.uuid4().hex
    logger.warning(
        "kuaizhizao_install_executions_api_error trace_id={} tenant_id={} route={} status_code={} message={}",
        trace_id,
        tenant_id,
        route,
        status_code,
        message,
    )
    return FastAPIHTTPException(
        status_code=status_code,
        detail={"message": message, "trace_id": trace_id},
    )


def HTTPException(*, status_code: int, detail: Any, **kwargs) -> FastAPIHTTPException:
    message = detail.get("message") if isinstance(detail, dict) else str(detail)
    return _http_exception_with_trace(status_code, message)


@router.post("", response_model=InstallExecutionResponse, summary="Create install execution job")
async def create_job(
    body: InstallExecutionCreate,
    current_user: User = Depends(get_current_user),
    tenant_id: int = Depends(get_current_tenant),
):
    try:
        return await _service.create(tenant_id, body, current_user)
    except ValidationError as e:
        raise HTTPException(status_code=status.HTTP_400_BAD_REQUEST, detail=str(e))
    except NotFoundError as e:
        raise HTTPException(status_code=status.HTTP_404_NOT_FOUND, detail=str(e))


@router.get("", response_model=InstallExecutionListEnvelope, summary="List install execution jobs")
async def list_jobs(
    skip: int = Query(0, ge=0),
    limit: int = Query(50, ge=1, le=200),
    customer_id: Optional[int] = Query(None),
    status_filter: Optional[str] = Query(None, alias="status"),
    keyword: Optional[str] = Query(None),
    sales_order_code: Optional[str] = Query(None),
    order_by: Optional[str] = Query(None),
    current_user: User = Depends(get_current_user),
    tenant_id: int = Depends(get_current_tenant),
):
    safe_order_by = None
    if order_by:
        field = order_by.lstrip("-")
        if field in INSTALL_EXECUTION_SORTABLE_FIELDS:
            safe_order_by = order_by
    return await _service.list_jobs(
        tenant_id=tenant_id,
        skip=skip,
        limit=limit,
        customer_id=customer_id,
        status=status_filter,
        keyword=keyword,
        sales_order_code=sales_order_code,
        order_by=safe_order_by,
        current_user=current_user,
    )


@router.get("/{job_id}", response_model=InstallExecutionResponse, summary="Get install execution job")
async def get_job(
    job_id: int = Path(..., description="安装执行单ID"),
    current_user: User = Depends(get_current_user),
    tenant_id: int = Depends(get_current_tenant),
):
    try:
        return await _service.get_by_id(tenant_id, job_id, current_user)
    except NotFoundError as e:
        raise HTTPException(status_code=status.HTTP_404_NOT_FOUND, detail=str(e))


@router.put("/{job_id}", response_model=InstallExecutionResponse, summary="Update install execution job")
async def update_job(
    body: InstallExecutionUpdate,
    job_id: int = Path(..., description="安装执行单ID"),
    current_user: User = Depends(get_current_user),
    tenant_id: int = Depends(get_current_tenant),
):
    try:
        return await _service.update(tenant_id, job_id, body, current_user)
    except NotFoundError as e:
        raise HTTPException(status_code=status.HTTP_404_NOT_FOUND, detail=str(e))
    except (ValidationError, BusinessLogicError) as e:
        raise HTTPException(status_code=status.HTTP_400_BAD_REQUEST, detail=str(e))


@router.post("/{job_id}/close", response_model=InstallExecutionResponse, summary="Close install execution job")
async def close_job(
    body: InstallExecutionClose,
    job_id: int = Path(..., description="安装执行单ID"),
    current_user: User = Depends(get_current_user),
    tenant_id: int = Depends(get_current_tenant),
):
    try:
        return await _service.close(tenant_id, job_id, body, current_user)
    except NotFoundError as e:
        raise HTTPException(status_code=status.HTTP_404_NOT_FOUND, detail=str(e))
    except BusinessLogicError as e:
        raise HTTPException(status_code=status.HTTP_400_BAD_REQUEST, detail=str(e))


@router.post("/{job_id}/tasks", response_model=InstallExecutionResponse, summary="Register install execution task")
async def register_task(
    body: InstallExecutionTaskCreate,
    job_id: int = Path(..., description="安装执行单ID"),
    current_user: User = Depends(get_current_user),
    tenant_id: int = Depends(get_current_tenant),
):
    try:
        return await _service.register_task(tenant_id, job_id, body, current_user)
    except NotFoundError as e:
        raise HTTPException(status_code=status.HTTP_404_NOT_FOUND, detail=str(e))
    except (ValidationError, BusinessLogicError) as e:
        raise HTTPException(status_code=status.HTTP_400_BAD_REQUEST, detail=str(e))


@router.post(
    "/{job_id}/advance-stage",
    response_model=InstallExecutionResponse,
    summary="Advance install execution stage",
)
async def advance_stage(
    body: InstallExecutionAdvanceStage,
    job_id: int = Path(..., description="安装执行单ID"),
    current_user: User = Depends(get_current_user),
    tenant_id: int = Depends(get_current_tenant),
):
    try:
        return await _service.advance_stage(tenant_id, job_id, body, current_user)
    except NotFoundError as e:
        raise HTTPException(status_code=status.HTTP_404_NOT_FOUND, detail=str(e))
    except (ValidationError, BusinessLogicError) as e:
        raise HTTPException(status_code=status.HTTP_400_BAD_REQUEST, detail=str(e))


@router.post("/{job_id}/costs", response_model=InstallExecutionResponse, summary="Append install execution cost")
async def append_cost(
    body: InstallExecutionCostCreate,
    job_id: int = Path(..., description="安装执行单ID"),
    current_user: User = Depends(get_current_user),
    tenant_id: int = Depends(get_current_tenant),
):
    try:
        return await _service.append_cost(tenant_id, job_id, body, current_user)
    except NotFoundError as e:
        raise HTTPException(status_code=status.HTTP_404_NOT_FOUND, detail=str(e))
    except (ValidationError, BusinessLogicError) as e:
        raise HTTPException(status_code=status.HTTP_400_BAD_REQUEST, detail=str(e))


@router.delete("/{job_id}", summary="Delete install execution job")
async def delete_job(
    job_id: int = Path(..., description="安装执行单ID"),
    current_user: User = Depends(get_current_user),
    tenant_id: int = Depends(get_current_tenant),
):
    try:
        await _service.delete(tenant_id, job_id, current_user)
        return {"success": True}
    except NotFoundError as e:
        raise HTTPException(status_code=status.HTTP_404_NOT_FOUND, detail=str(e))
    except BusinessLogicError as e:
        raise HTTPException(status_code=status.HTTP_400_BAD_REQUEST, detail=str(e))


@router.post(
    "/pull-from-sales-order",
    response_model=InstallExecutionResponse,
    summary="Pull create from sales order",
)
async def pull_from_sales_order(
    body: InstallExecutionPullFromSalesOrderRequest,
    current_user: User = Depends(get_current_user),
    tenant_id: int = Depends(get_current_tenant),
):
    try:
        return await _service.pull_from_sales_order(tenant_id, body, current_user)
    except NotFoundError as e:
        raise HTTPException(status_code=status.HTTP_404_NOT_FOUND, detail=str(e))
    except ValidationError as e:
        raise HTTPException(status_code=status.HTTP_400_BAD_REQUEST, detail=str(e))


@router.post(
    "/pull-from-sales-delivery",
    response_model=InstallExecutionResponse,
    summary="Pull create from sales delivery",
)
async def pull_from_sales_delivery(
    body: InstallExecutionPullFromSalesDeliveryRequest,
    current_user: User = Depends(get_current_user),
    tenant_id: int = Depends(get_current_tenant),
):
    try:
        return await _service.pull_from_sales_delivery(tenant_id, body, current_user)
    except NotFoundError as e:
        raise HTTPException(status_code=status.HTTP_404_NOT_FOUND, detail=str(e))
    except ValidationError as e:
        raise HTTPException(status_code=status.HTTP_400_BAD_REQUEST, detail=str(e))
