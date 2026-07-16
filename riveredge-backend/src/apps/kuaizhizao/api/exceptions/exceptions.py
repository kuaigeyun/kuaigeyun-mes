"""
生产异常管理 API

与 manifest 异常管理菜单权限对齐，不依赖 production-execution-reporting 路由级鉴权。
"""

from __future__ import annotations

import uuid
from datetime import datetime, date, time
from typing import Any, List, Optional

from fastapi import APIRouter, Body, Depends, HTTPException, Path, Query, status as http_status
from loguru import logger

from core.api.deps import get_current_tenant, get_current_user
from core.api.deps.access import require_permission_codes
from infra.exceptions.exceptions import NotFoundError, ValidationError
from infra.models.user import User

from apps.kuaizhizao.schemas.delivery_delay_exception import (
    DeliveryDelayExceptionListResponse,
    DeliveryDelayExceptionResponse,
)
from apps.kuaizhizao.schemas.exception_page import ExceptionListPageResponse
from apps.kuaizhizao.schemas.exception_process_record import (
    ExceptionProcessAssignRequest,
    ExceptionProcessRecordCreate,
    ExceptionProcessRecordDetailResponse,
    ExceptionProcessRecordListResponse,
    ExceptionProcessRecordResponse,
    ExceptionProcessResolveRequest,
    ExceptionProcessStepTransitionRequest,
)
from apps.kuaizhizao.schemas.material_shortage_exception import (
    MaterialShortageExceptionListResponse,
    MaterialShortageExceptionResponse,
)
from apps.kuaizhizao.schemas.quality_exception import (
    QualityExceptionListResponse,
    QualityExceptionResponse,
)
from apps.kuaizhizao.services.exception_process_service import (
    ExceptionProcessService,
    EXCEPTION_PROCESS_SORTABLE_FIELDS,
)
from apps.kuaizhizao.services.exception_service import (
    ExceptionService,
    MATERIAL_SHORTAGE_SORTABLE_FIELDS,
    DELIVERY_DELAY_SORTABLE_FIELDS,
    QUALITY_EXCEPTION_SORTABLE_FIELDS,
)

router = APIRouter(tags=["App - Kuaige Zhizao - Production Exceptions"])

exception_service = ExceptionService()
exception_process_service = ExceptionProcessService()


def _http_exception_with_trace(
    status_code: int,
    message: str,
    route: str,
    tenant_id: Optional[int] = None,
) -> HTTPException:
    trace_id = uuid.uuid4().hex
    logger.warning(
        "exceptions_api_error trace_id={} tenant_id={} route={} status_code={} message={}",
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


def _scheduling_deep_link(work_order_id: int) -> str:
    return f"/apps/kuaizhizao/plan-management/scheduling?work_order_ids={work_order_id}"


def _attach_visual_scheduling_guidance(handled: Any, *, action: str, plan_adjust_actions: set):
    work_order_id = handled.get("work_order_id") if isinstance(handled, dict) else getattr(handled, "work_order_id", None)
    if action not in plan_adjust_actions or not work_order_id:
        return handled
    link = _scheduling_deep_link(int(work_order_id))
    notice = "请在可视排产中手工调整计划日期"
    if isinstance(handled, dict):
        handled["scheduling_deep_link"] = link
        handled["scheduling_notice"] = notice
        return handled
    if hasattr(handled, "model_copy"):
        return handled.model_copy(update={"scheduling_deep_link": link, "scheduling_notice": notice})
    return handled


def _require_read(permission_code: str):
    return Depends(require_permission_codes(permission_code, check_abac=False))


_MATERIAL_SHORTAGE_READ = _require_read(
    "kuaizhizao:production-execution-material-shortage-exceptions:read",
)
_DELIVERY_DELAY_READ = _require_read(
    "kuaizhizao:production-execution-delivery-delay-exceptions:read",
)
_QUALITY_READ = _require_read(
    "kuaizhizao:production-execution-quality-exceptions:read",
)
_STATISTICS_READ = _require_read(
    "kuaizhizao:production-execution-exception-statistics:read",
)
_PROCESS_READ = _require_read(
    "kuaizhizao:production-execution-exception-process:read",
)
_PROCESS_WRITE = _require_read(
    "kuaizhizao:production-execution-exception-process:read",
)


@router.get(
    "/exceptions/material-shortage",
    response_model=ExceptionListPageResponse[MaterialShortageExceptionListResponse],
    summary="List material shortage exceptions",
    dependencies=[_MATERIAL_SHORTAGE_READ],
)
async def list_material_shortage_exceptions(
    work_order_id: Optional[int] = Query(None, description="工单ID"),
    status: Optional[str] = Query(None, description="状态"),
    statuses: Optional[str] = Query(None, description="状态列表，逗号分隔"),
    alert_level: Optional[str] = Query(None, description="预警级别"),
    keyword: Optional[str] = Query(None, description="关键词（工单、物料等）"),
    work_order_code: Optional[str] = Query(None, description="工单编码（模糊搜索）"),
    material_code: Optional[str] = Query(None, description="物料编码（模糊搜索）"),
    material_name: Optional[str] = Query(None, description="物料名称（模糊搜索）"),
    created_start_date: Optional[date] = Query(None, description="创建日期起"),
    created_end_date: Optional[date] = Query(None, description="创建日期止"),
    order_by: Optional[str] = Query(None, description="排序字段"),
    skip: int = Query(0, ge=0, description="跳过数量"),
    limit: int = Query(100, ge=1, le=1000, description="限制数量"),
    tenant_id: int = Depends(get_current_tenant),
) -> ExceptionListPageResponse[MaterialShortageExceptionListResponse]:
    safe_order_by = None
    if order_by:
        field = order_by.lstrip("-")
        if field in MATERIAL_SHORTAGE_SORTABLE_FIELDS:
            safe_order_by = order_by
    items, total = await exception_service.list_material_shortage_exceptions(
        tenant_id=tenant_id,
        work_order_id=work_order_id,
        status=status,
        statuses=statuses,
        alert_level=alert_level,
        keyword=keyword,
        work_order_code=work_order_code,
        material_code=material_code,
        material_name=material_name,
        created_start_date=created_start_date,
        created_end_date=created_end_date,
        order_by=safe_order_by,
        skip=skip,
        limit=limit,
    )
    return ExceptionListPageResponse(items=items, total=total)


@router.post(
    "/exceptions/material-shortage/{exception_id}/handle",
    response_model=MaterialShortageExceptionResponse,
    summary="Handle material shortage exception",
    dependencies=[_MATERIAL_SHORTAGE_READ],
)
async def handle_material_shortage_exception(
    exception_id: int = Path(..., description="异常记录ID"),
    action: str = Query(..., description="处理操作（purchase/substitute/resolve/cancel）"),
    alternative_material_id: Optional[int] = Query(None, description="替代物料ID"),
    remarks: Optional[str] = Query(None, description="备注"),
    current_user: User = Depends(get_current_user),
    tenant_id: int = Depends(get_current_tenant),
) -> MaterialShortageExceptionResponse:
    handled = await exception_service.handle_material_shortage_exception(
        tenant_id=tenant_id,
        exception_id=exception_id,
        handled_by=current_user.id,
        action=action,
        alternative_material_id=alternative_material_id,
        remarks=remarks,
    )
    return _attach_visual_scheduling_guidance(
        handled,
        action=action,
        plan_adjust_actions={"purchase", "substitute", "adjust_plan", "expedite", "increase_resources"},
    )


@router.post(
    "/work-orders/{work_order_id}/detect-shortage",
    response_model=List[MaterialShortageExceptionResponse],
    summary="Detect work order shortage",
    dependencies=[_MATERIAL_SHORTAGE_READ],
)
async def detect_work_order_shortage(
    work_order_id: int = Path(..., description="工单ID"),
    tenant_id: int = Depends(get_current_tenant),
) -> List[MaterialShortageExceptionResponse]:
    return await exception_service.detect_material_shortage(
        tenant_id=tenant_id,
        work_order_id=work_order_id,
    )


@router.get(
    "/exceptions/delivery-delay",
    response_model=ExceptionListPageResponse[DeliveryDelayExceptionListResponse],
    summary="List delivery delay exceptions",
    dependencies=[_DELIVERY_DELAY_READ],
)
async def list_delivery_delay_exceptions(
    work_order_id: Optional[int] = Query(None, description="工单ID"),
    status: Optional[str] = Query(None, description="状态"),
    statuses: Optional[str] = Query(None, description="状态列表，逗号分隔"),
    alert_level: Optional[str] = Query(None, description="预警级别"),
    keyword: Optional[str] = Query(None, description="关键词（工单、延期原因等）"),
    work_order_code: Optional[str] = Query(None, description="工单编码（模糊搜索）"),
    delay_reason: Optional[str] = Query(None, description="延期原因（模糊搜索）"),
    created_start_date: Optional[date] = Query(None, description="创建日期起"),
    created_end_date: Optional[date] = Query(None, description="创建日期止"),
    order_by: Optional[str] = Query(None, description="排序字段"),
    skip: int = Query(0, ge=0, description="跳过数量"),
    limit: int = Query(100, ge=1, le=1000, description="限制数量"),
    tenant_id: int = Depends(get_current_tenant),
) -> ExceptionListPageResponse[DeliveryDelayExceptionListResponse]:
    safe_order_by = None
    if order_by:
        field = order_by.lstrip("-")
        if field in DELIVERY_DELAY_SORTABLE_FIELDS:
            safe_order_by = order_by
    items, total = await exception_service.list_delivery_delay_exceptions(
        tenant_id=tenant_id,
        work_order_id=work_order_id,
        status=status,
        statuses=statuses,
        alert_level=alert_level,
        keyword=keyword,
        work_order_code=work_order_code,
        delay_reason=delay_reason,
        created_start_date=created_start_date,
        created_end_date=created_end_date,
        order_by=safe_order_by,
        skip=skip,
        limit=limit,
    )
    return ExceptionListPageResponse(items=items, total=total)


@router.post(
    "/exceptions/delivery-delay/{exception_id}/handle",
    response_model=DeliveryDelayExceptionResponse,
    summary="Handle delivery delay exception",
    dependencies=[_DELIVERY_DELAY_READ],
)
async def handle_delivery_delay_exception(
    exception_id: int = Path(..., description="异常记录ID"),
    action: str = Query(..., description="处理操作（adjust_plan/increase_resources/expedite/resolve/cancel）"),
    remarks: Optional[str] = Query(None, description="备注"),
    current_user: User = Depends(get_current_user),
    tenant_id: int = Depends(get_current_tenant),
) -> DeliveryDelayExceptionResponse:
    handled = await exception_service.handle_delivery_delay_exception(
        tenant_id=tenant_id,
        exception_id=exception_id,
        handled_by=current_user.id,
        action=action,
        remarks=remarks,
    )
    return _attach_visual_scheduling_guidance(
        handled,
        action=action,
        plan_adjust_actions={"adjust_plan", "increase_resources", "expedite"},
    )


@router.post(
    "/work-orders/{work_order_id}/detect-delay",
    response_model=List[DeliveryDelayExceptionResponse],
    summary="Detect work order delay",
    dependencies=[_DELIVERY_DELAY_READ],
)
async def detect_work_order_delay(
    work_order_id: int = Path(..., description="工单ID"),
    days_threshold: int = Query(0, description="延期天数阈值"),
    tenant_id: int = Depends(get_current_tenant),
) -> List[DeliveryDelayExceptionResponse]:
    return await exception_service.detect_delivery_delay(
        tenant_id=tenant_id,
        work_order_id=work_order_id,
        days_threshold=days_threshold,
    )


@router.get(
    "/exceptions/quality",
    response_model=ExceptionListPageResponse[QualityExceptionListResponse],
    summary="List quality exceptions",
    dependencies=[_QUALITY_READ],
)
async def list_quality_exceptions(
    exception_type: Optional[str] = Query(None, description="异常类型"),
    work_order_id: Optional[int] = Query(None, description="工单ID"),
    status: Optional[str] = Query(None, description="状态"),
    statuses: Optional[str] = Query(None, description="状态列表，逗号分隔"),
    severity: Optional[str] = Query(None, description="严重程度"),
    inspection_record_id: Optional[int] = Query(None, description="关联检验记录ID"),
    inspection_source_type: Optional[str] = Query(None, description="关联检验类型"),
    keyword: Optional[str] = Query(None, description="关键词（工单、物料、批次、问题描述等）"),
    work_order_code: Optional[str] = Query(None, description="工单编码（模糊搜索）"),
    material_code: Optional[str] = Query(None, description="物料编码（模糊搜索）"),
    material_name: Optional[str] = Query(None, description="物料名称（模糊搜索）"),
    batch_no: Optional[str] = Query(None, description="批次号（模糊搜索）"),
    created_start_date: Optional[date] = Query(None, description="创建日期起"),
    created_end_date: Optional[date] = Query(None, description="创建日期止"),
    order_by: Optional[str] = Query(None, description="排序字段"),
    skip: int = Query(0, ge=0, description="跳过数量"),
    limit: int = Query(100, ge=1, le=1000, description="限制数量"),
    tenant_id: int = Depends(get_current_tenant),
) -> ExceptionListPageResponse[QualityExceptionListResponse]:
    safe_order_by = None
    if order_by:
        field = order_by.lstrip("-")
        if field in QUALITY_EXCEPTION_SORTABLE_FIELDS:
            safe_order_by = order_by
    items, total = await exception_service.list_quality_exceptions(
        tenant_id=tenant_id,
        exception_type=exception_type,
        work_order_id=work_order_id,
        status=status,
        statuses=statuses,
        severity=severity,
        inspection_record_id=inspection_record_id,
        inspection_source_type=inspection_source_type,
        keyword=keyword,
        work_order_code=work_order_code,
        material_code=material_code,
        material_name=material_name,
        batch_no=batch_no,
        created_start_date=created_start_date,
        created_end_date=created_end_date,
        order_by=safe_order_by,
        skip=skip,
        limit=limit,
    )
    return ExceptionListPageResponse(items=items, total=total)


@router.post(
    "/exceptions/quality/{exception_id}/handle",
    response_model=QualityExceptionResponse,
    summary="Handle quality exception",
    dependencies=[_QUALITY_READ],
)
async def handle_quality_exception(
    exception_id: int = Path(..., description="异常记录ID"),
    action: str = Query(..., description="处理操作（investigate/correct/close/cancel）"),
    root_cause: Optional[str] = Query(None, description="根本原因"),
    corrective_action: Optional[str] = Query(None, description="纠正措施"),
    preventive_action: Optional[str] = Query(None, description="预防措施"),
    responsible_person_id: Optional[int] = Query(None, description="责任人ID"),
    responsible_person_name: Optional[str] = Query(None, description="责任人姓名"),
    verification_result: Optional[str] = Query(None, description="验证结果"),
    remarks: Optional[str] = Query(None, description="备注"),
    current_user: User = Depends(get_current_user),
    tenant_id: int = Depends(get_current_tenant),
) -> QualityExceptionResponse:
    return await exception_service.handle_quality_exception(
        tenant_id=tenant_id,
        exception_id=exception_id,
        handled_by=current_user.id,
        action=action,
        root_cause=root_cause,
        corrective_action=corrective_action,
        preventive_action=preventive_action,
        responsible_person_id=responsible_person_id,
        responsible_person_name=responsible_person_name,
        verification_result=verification_result,
        remarks=remarks,
    )


@router.get(
    "/exceptions/statistics",
    summary="Exception statistics",
    dependencies=[_STATISTICS_READ],
)
async def get_exception_statistics(
    date_start: Optional[str] = Query(None, description="开始日期（YYYY-MM-DD）"),
    date_end: Optional[str] = Query(None, description="结束日期（YYYY-MM-DD）"),
    tenant_id: int = Depends(get_current_tenant),
) -> dict:
    date_start_dt = None
    date_end_dt = None
    if date_start:
        try:
            date_start_dt = datetime.strptime(date_start, "%Y-%m-%d")
        except ValueError:
            raise ValidationError("开始日期格式错误，应为YYYY-MM-DD")
    if date_end:
        try:
            date_end_dt = datetime.strptime(date_end, "%Y-%m-%d")
        except ValueError:
            raise ValidationError("结束日期格式错误，应为YYYY-MM-DD")
    return await exception_service.get_exception_statistics(
        tenant_id=tenant_id,
        date_start=date_start_dt,
        date_end=date_end_dt,
    )


@router.post(
    "/exceptions/detect",
    summary="Run exception detection manually",
    dependencies=[_STATISTICS_READ],
)
async def trigger_exception_detection(
    work_order_id: Optional[int] = Query(None, description="工单ID（可选）"),
    tenant_id: int = Depends(get_current_tenant),
) -> dict:
    try:
        from apps.kuaizhizao.workflows.functions.exception_detection_workflow import (
            run_exception_detection_for_tenant,
        )

        result = await run_exception_detection_for_tenant(tenant_id, work_order_id)
        if not result.get("success"):
            raise _http_exception_with_trace(
                http_status.HTTP_500_INTERNAL_SERVER_ERROR,
                result.get("error") or "异常检测失败",
                "/exceptions/detect",
                tenant_id,
            )
        return {
            "success": True,
            "message": "异常检测已完成",
            "work_order_id": work_order_id,
            "detection": result,
        }
    except HTTPException:
        raise
    except Exception as e:
        logger.error(f"触发异常检测失败: {e}")
        raise _http_exception_with_trace(
            http_status.HTTP_500_INTERNAL_SERVER_ERROR,
            f"触发异常检测失败: {str(e)}",
            "/exceptions/detect",
            tenant_id,
        )


@router.post(
    "/exceptions/process/start",
    response_model=ExceptionProcessRecordResponse,
    summary="Start exception process",
    dependencies=[_PROCESS_WRITE],
)
async def start_exception_process(
    data: ExceptionProcessRecordCreate,
    current_user: User = Depends(get_current_user),
    tenant_id: int = Depends(get_current_tenant),
) -> ExceptionProcessRecordResponse:
    try:
        return await exception_process_service.start_process(
            tenant_id=tenant_id,
            data=data,
            current_user_id=current_user.id,
        )
    except ValidationError as e:
        raise _http_exception_with_trace(400, str(e), "/exceptions/process/start", tenant_id)
    except NotFoundError as e:
        raise _http_exception_with_trace(404, str(e), "/exceptions/process/start", tenant_id)


@router.get(
    "/exceptions/process",
    response_model=ExceptionListPageResponse[ExceptionProcessRecordListResponse],
    summary="List exception processes",
    dependencies=[_PROCESS_READ],
)
async def list_exception_processes(
    skip: int = Query(0, ge=0, description="跳过数量"),
    limit: int = Query(100, ge=1, le=1000, description="限制数量"),
    exception_type: Optional[str] = Query(None, description="异常类型筛选"),
    exception_id: Optional[int] = Query(None, description="异常记录ID筛选"),
    process_status: Optional[str] = Query(None, description="处理状态筛选"),
    assigned_to: Optional[int] = Query(None, description="分配给筛选"),
    keyword: Optional[str] = Query(None, description="关键词（处理人、步骤等）"),
    assigned_to_name: Optional[str] = Query(None, description="处理人姓名（模糊搜索）"),
    created_start_date: Optional[date] = Query(None, description="创建日期起"),
    created_end_date: Optional[date] = Query(None, description="创建日期止"),
    order_by: Optional[str] = Query(None, description="排序字段"),
    tenant_id: int = Depends(get_current_tenant),
) -> ExceptionListPageResponse[ExceptionProcessRecordListResponse]:
    try:
        safe_order_by = None
        if order_by:
            field = order_by.lstrip("-")
            if field in EXCEPTION_PROCESS_SORTABLE_FIELDS:
                safe_order_by = order_by
        items, total = await exception_process_service.list_process_records(
            tenant_id=tenant_id,
            exception_type=exception_type,
            exception_id=exception_id,
            process_status=process_status,
            assigned_to=assigned_to,
            keyword=keyword,
            assigned_to_name=assigned_to_name,
            created_start_date=created_start_date,
            created_end_date=created_end_date,
            order_by=safe_order_by,
            skip=skip,
            limit=limit,
        )
        return ExceptionListPageResponse(items=items, total=total)
    except Exception as e:
        logger.error(f"获取异常处理流程列表失败: {e}")
        raise _http_exception_with_trace(500, str(e), "/exceptions/process", tenant_id)


@router.get(
    "/exceptions/process/{process_record_id}",
    response_model=ExceptionProcessRecordDetailResponse,
    summary="Get exception process",
    dependencies=[_PROCESS_READ],
)
async def get_exception_process(
    process_record_id: int = Path(..., description="处理记录ID"),
    tenant_id: int = Depends(get_current_tenant),
) -> ExceptionProcessRecordDetailResponse:
    try:
        return await exception_process_service.get_process_record(
            tenant_id=tenant_id,
            process_record_id=process_record_id,
        )
    except NotFoundError as e:
        raise _http_exception_with_trace(404, str(e), "/exceptions/process/{process_record_id}", tenant_id)


@router.post(
    "/exceptions/process/{process_record_id}/assign",
    response_model=ExceptionProcessRecordResponse,
    summary="Assign exception process",
    dependencies=[_PROCESS_WRITE],
)
async def assign_exception_process(
    process_record_id: int = Path(..., description="处理记录ID"),
    data: ExceptionProcessAssignRequest = Body(...),
    current_user: User = Depends(get_current_user),
    tenant_id: int = Depends(get_current_tenant),
) -> ExceptionProcessRecordResponse:
    try:
        return await exception_process_service.assign_process(
            tenant_id=tenant_id,
            process_record_id=process_record_id,
            data=data,
            current_user_id=current_user.id,
        )
    except ValidationError as e:
        raise _http_exception_with_trace(400, str(e), "/exceptions/process/{process_record_id}/assign", tenant_id)
    except NotFoundError as e:
        raise _http_exception_with_trace(404, str(e), "/exceptions/process/{process_record_id}/assign", tenant_id)


@router.post(
    "/exceptions/process/{process_record_id}/step-transition",
    response_model=ExceptionProcessRecordResponse,
    summary="Exception process step transition",
    dependencies=[_PROCESS_WRITE],
)
async def transition_exception_process_step(
    process_record_id: int = Path(..., description="处理记录ID"),
    data: ExceptionProcessStepTransitionRequest = Body(...),
    current_user: User = Depends(get_current_user),
    tenant_id: int = Depends(get_current_tenant),
) -> ExceptionProcessRecordResponse:
    try:
        return await exception_process_service.transition_step(
            tenant_id=tenant_id,
            process_record_id=process_record_id,
            data=data,
            current_user_id=current_user.id,
        )
    except ValidationError as e:
        raise _http_exception_with_trace(400, str(e), "/exceptions/process/{process_record_id}/step-transition", tenant_id)
    except NotFoundError as e:
        raise _http_exception_with_trace(404, str(e), "/exceptions/process/{process_record_id}/step-transition", tenant_id)


@router.post(
    "/exceptions/process/{process_record_id}/resolve",
    response_model=ExceptionProcessRecordResponse,
    summary="Resolve exception process",
    dependencies=[_PROCESS_WRITE],
)
async def resolve_exception_process(
    process_record_id: int = Path(..., description="处理记录ID"),
    data: ExceptionProcessResolveRequest = Body(...),
    current_user: User = Depends(get_current_user),
    tenant_id: int = Depends(get_current_tenant),
) -> ExceptionProcessRecordResponse:
    try:
        return await exception_process_service.resolve_process(
            tenant_id=tenant_id,
            process_record_id=process_record_id,
            data=data,
            current_user_id=current_user.id,
        )
    except ValidationError as e:
        raise _http_exception_with_trace(400, str(e), "/exceptions/process/{process_record_id}/resolve", tenant_id)
    except NotFoundError as e:
        raise _http_exception_with_trace(404, str(e), "/exceptions/process/{process_record_id}/resolve", tenant_id)


@router.post(
    "/exceptions/process/{process_record_id}/cancel",
    response_model=ExceptionProcessRecordResponse,
    summary="Cancel exception process",
    dependencies=[_PROCESS_WRITE],
)
async def cancel_exception_process(
    process_record_id: int = Path(..., description="处理记录ID"),
    comment: Optional[str] = Body(None, description="取消说明"),
    current_user: User = Depends(get_current_user),
    tenant_id: int = Depends(get_current_tenant),
) -> ExceptionProcessRecordResponse:
    try:
        return await exception_process_service.cancel_process(
            tenant_id=tenant_id,
            process_record_id=process_record_id,
            current_user_id=current_user.id,
            comment=comment,
        )
    except ValidationError as e:
        raise _http_exception_with_trace(400, str(e), "/exceptions/process/{process_record_id}/cancel", tenant_id)
    except NotFoundError as e:
        raise _http_exception_with_trace(404, str(e), "/exceptions/process/{process_record_id}/cancel", tenant_id)
