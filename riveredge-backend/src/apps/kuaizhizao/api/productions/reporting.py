"""
报工管理 API 路由模块

提供报工记录、物料绑定、报废、不良品管理的API接口。
"""

from datetime import datetime, time
from typing import List, Optional
from decimal import Decimal
import uuid
from fastapi import APIRouter, Depends, Query, status as http_status, Path, HTTPException, Body, Request

from infra.infrastructure.http import get_http_client
from fastapi.responses import JSONResponse
from loguru import logger

from core.api.deps import get_current_user, get_current_tenant
from core.api.deps.access import AuthContext, ensure_permission_codes, get_auth_context
from core.utils.timezone_utils import to_api_isoformat
from infra.models.user import User
from infra.exceptions.exceptions import ValidationError, BusinessLogicError, NotFoundError
from infra.services.business_config_service import BusinessConfigService

from apps.kuaizhizao.services.reporting_service import ReportingService
from apps.kuaizhizao.services.scrap_record_service import ScrapRecordService
from apps.kuaizhizao.services.defect_record_service import DefectRecordService
from apps.kuaizhizao.services.material_binding_service import MaterialBindingService

from apps.kuaizhizao.schemas.reporting_record import (
    ReportingRecordCreate,
    ReportingRecordUpdate,
    ReportingRecordResponse,
    ReportingRecordListResponse,
    ReportingOverviewStatisticsResponse,
    ReportingDetailedStatisticsResponse,
)
from apps.kuaizhizao.schemas.scrap_record import (
    ScrapRecordCreateFromReporting,
    ScrapRecordResponse,
    ScrapRecordListResponse,
)
from apps.kuaizhizao.schemas.defect_record import (
    DefectRecordCreateFromReporting,
    DefectRecordResponse,
    DefectRecordListResponse,
)
from apps.kuaizhizao.schemas.material_binding import (
    MaterialBindingCreateFromReporting,
    MaterialBindingResponse,
    MaterialBindingListResponse,
)

# 初始化服务实例
reporting_service = ReportingService()
scrap_record_service = ScrapRecordService()
defect_record_service = DefectRecordService()
material_binding_service = MaterialBindingService()

router = APIRouter(tags=["App · Kuaige Zhizao · Production Execution"])


def _parse_iso_datetime_or_400(value: Optional[str], field_name: str) -> Optional[datetime]:
    """统一日期入参解析，非法格式直接返回 400。"""
    if value is None:
        return None
    if not isinstance(value, str):
        value = getattr(value, "default", None)
        if value is None:
            return None
        value = str(value)
    if not value:
        return None
    try:
        return datetime.fromisoformat(value.replace("Z", "+00:00"))
    except ValueError:
        raise _http_exception_with_trace(
            status_code=400,
            message=f"{field_name} 格式无效，应为 ISO 时间格式",
            route="query_datetime_parser",
        )


def _http_exception_with_trace(
    status_code: int,
    message: str,
    route: str,
    tenant_id: Optional[int] = None,
) -> HTTPException:
    """统一错误响应：透出 trace_id 并打结构化日志。"""
    trace_id = uuid.uuid4().hex
    logger.warning(
        "reporting_api_error trace_id={} tenant_id={} route={} status_code={} message={}",
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


async def _get_reporting_estimated_wage_rate(tenant_id: int) -> Decimal:
    """读取报工统计预估工资基数，未配置时回退到 30。"""
    default_rate = Decimal("30")
    try:
        biz_config = await BusinessConfigService().get_business_config(tenant_id)
        reporting_cfg = (biz_config or {}).get("parameters", {}).get("reporting", {})
        configured_rate = reporting_cfg.get("estimated_wage_rate")
        if configured_rate is None:
            return default_rate
        rate = Decimal(str(configured_rate))
        return rate if rate > 0 else default_rate
    except Exception:
        return default_rate


async def _emit_overview_statistics_alert(tenant_id: int, trace_id: str, error_message: str) -> None:
    """overview 统计异常告警钩子（可配置启用）。"""
    try:
        biz_config = await BusinessConfigService().get_business_config(tenant_id)
        reporting_cfg = (biz_config or {}).get("parameters", {}).get("reporting", {})
        alert_enabled = bool(reporting_cfg.get("overview_alert_enabled", False))
        webhook_url = reporting_cfg.get("overview_alert_webhook_url")
        if not alert_enabled or not webhook_url:
            return

        payload = {
            "event": "reporting_overview_statistics_failed",
            "tenant_id": tenant_id,
            "trace_id": trace_id,
            "route": "/reporting/overview-statistics",
            "error": error_message,
            "occurred_at": to_api_isoformat(datetime.now()),
        }
        await get_http_client().post(str(webhook_url), json=payload, timeout=3.0)
    except Exception as notify_err:
        logger.warning(
            "reporting_overview_statistics_alert_failed trace_id={} tenant_id={} error={}",
            trace_id,
            tenant_id,
            str(notify_err),
        )


# ============ 报工管理 API ============

@router.get(
    "/reporting/overview-statistics",
    response_model=ReportingOverviewStatisticsResponse,
    summary="Reporting statistics (KPI cards)",
)
async def get_reporting_overview_statistics(
    current_user: User = Depends(get_current_user),
    tenant_id: int = Depends(get_current_tenant),
) -> ReportingOverviewStatisticsResponse:
    from datetime import date, timedelta
    from apps.kuaizhizao.models.reporting_record import ReportingRecord

    today = date.today()
    base = ReportingRecord.filter(tenant_id=tenant_id, deleted_at__isnull=True)
    wage_rate = await _get_reporting_estimated_wage_rate(tenant_id)

    try:
        # 当月累计工时
        month_start = date(today.year, today.month, 1)
        month_start_dt = datetime.combine(month_start, time.min)
        hours_vals = await base.filter(reported_at__gte=month_start_dt).values_list("work_hours", flat=True)
        cumulative_hours = round(float(sum(v or 0 for v in hours_vals)), 1)

        # 估算工资（工时 × 统一配置基数）
        estimated_wages = round(cumulative_hours * float(wage_rate), 2)

        # 停机记录数（当月）
        try:
            downtime_records = await base.filter(reported_at__gte=month_start_dt, downtime_minutes__gt=0).count()
        except Exception:
            downtime_records = 0

        # 异常报工数（当月 status=exception 或 is_exception=True）
        try:
            exception_reports = await base.filter(reported_at__gte=month_start_dt, status="exception").count()
        except Exception:
            exception_reports = 0

        # 效率：合格量 / 计划量，取当月
        try:
            qualified_vals = await base.filter(reported_at__gte=month_start_dt).values_list("qualified_quantity", flat=True)
            planned_vals = await base.filter(reported_at__gte=month_start_dt).values_list("reported_quantity", flat=True)
            total_q = sum(v or 0 for v in qualified_vals)
            total_p = sum(v or 0 for v in planned_vals) or 1
            efficiency = round(total_q / total_p * 100, 1)
        except Exception:
            efficiency = 0

        # 近7天趋势（每天工时）
        trend_hours = []
        for i in range(6, -1, -1):
            d = today - timedelta(days=i)
            day_start = datetime.combine(d, time.min)
            day_end = datetime.combine(d, time.max)
            vals = await base.filter(reported_at__gte=day_start, reported_at__lte=day_end).values_list("work_hours", flat=True)
            trend_hours.append(round(float(sum(v or 0 for v in vals)), 1))

    except Exception as e:
        trace_id = uuid.uuid4().hex
        logger.error(
            "reporting_overview_statistics_failed trace_id={} tenant_id={} route=/reporting/overview-statistics error={}",
            trace_id,
            tenant_id,
            str(e),
        )
        await _emit_overview_statistics_alert(
            tenant_id=tenant_id,
            trace_id=trace_id,
            error_message=str(e),
        )
        cumulative_hours = 0; estimated_wages = 0; downtime_records = 0
        exception_reports = 0; efficiency = 0; trend_hours = [0] * 7

    return ReportingOverviewStatisticsResponse.model_validate({
        "cumulative_hours": cumulative_hours,
        "estimated_wages": estimated_wages,
        "downtime_records": downtime_records,
        "exception_reports": exception_reports,
        "efficiency": efficiency,
        "trends": {
            "hours": trend_hours,
            "wages": [round(h * float(wage_rate), 2) for h in trend_hours],
            "efficiency": [efficiency] * 7,
        },
    })


@router.post("/reporting", response_model=ReportingRecordResponse, summary="Create reporting record")
async def create_reporting_record(
    reporting: ReportingRecordCreate,
    request: Request,
    auth: AuthContext = Depends(get_auth_context),
    current_user: User = Depends(get_current_user),
    tenant_id: int = Depends(get_current_tenant),
) -> ReportingRecordResponse:
    """
    创建报工记录

    - **reporting**: 报工数据
    """
    try:
        if int(reporting.worker_id) != int(current_user.id):
            await ensure_permission_codes(
                auth,
                tenant_id,
                request,
                ["kuaizhizao:production-execution-reporting:assign"],
            )
        return await reporting_service.create_reporting_record(
            tenant_id=tenant_id,
            reporting_data=reporting,
            reported_by=current_user.id,
            entry_mode="manual",
        )
    except NotFoundError as e:
        raise _http_exception_with_trace(404, str(e), "/reporting", tenant_id)
    except ValidationError as e:
        raise _http_exception_with_trace(400, str(e), "/reporting", tenant_id)
    except BusinessLogicError as e:
        raise _http_exception_with_trace(400, str(e), "/reporting", tenant_id)


@router.post("/reporting/quick", response_model=ReportingRecordResponse, summary="Quick reporting (scan / terminal)")
async def create_quick_reporting_record(
    reporting: ReportingRecordCreate,
    request: Request,
    auth: AuthContext = Depends(get_auth_context),
    current_user: User = Depends(get_current_user),
    tenant_id: int = Depends(get_current_tenant),
) -> ReportingRecordResponse:
    """
    快捷报工入口（用于扫码报工、工位机报工）
    """
    try:
        if int(reporting.worker_id) != int(current_user.id):
            await ensure_permission_codes(
                auth,
                tenant_id,
                request,
                ["kuaizhizao:production-execution-reporting:assign"],
            )
        return await reporting_service.create_reporting_record(
            tenant_id=tenant_id,
            reporting_data=reporting,
            reported_by=current_user.id,
            entry_mode="quick",
        )
    except NotFoundError as e:
        raise _http_exception_with_trace(404, str(e), "/reporting/quick", tenant_id)
    except ValidationError as e:
        raise _http_exception_with_trace(400, str(e), "/reporting/quick", tenant_id)
    except BusinessLogicError as e:
        raise _http_exception_with_trace(400, str(e), "/reporting/quick", tenant_id)


@router.get("/reporting", response_model=List[ReportingRecordListResponse], summary="List reporting records")
async def list_reporting_records(
    skip: int = Query(0, ge=0, description="跳过数量"),
    limit: int = Query(100, ge=1, le=1000, description="限制数量"),
    work_order_code: Optional[str] = Query(None, description="工单编码（模糊搜索）"),
    work_order_name: Optional[str] = Query(None, description="工单名称（模糊搜索）"),
    operation_name: Optional[str] = Query(None, description="工序名称（模糊搜索）"),
    worker_name: Optional[str] = Query(None, description="操作工姓名（模糊搜索）"),
    status: Optional[str] = Query(None, description="审核状态"),
    reported_at_start: Optional[str] = Query(None, description="报工开始时间（ISO格式）"),
    reported_at_end: Optional[str] = Query(None, description="报工结束时间（ISO格式）"),
    current_user: User = Depends(get_current_user),
    tenant_id: int = Depends(get_current_tenant),
) -> List[ReportingRecordListResponse]:
    """
    获取报工记录列表

    支持多种筛选条件的高级搜索。
    """
    reported_at_start_dt = _parse_iso_datetime_or_400(reported_at_start, "reported_at_start")
    reported_at_end_dt = _parse_iso_datetime_or_400(reported_at_end, "reported_at_end")

    return await reporting_service.list_reporting_records(
        tenant_id=tenant_id,
        skip=skip,
        limit=limit,
        work_order_code=work_order_code,
        work_order_name=work_order_name,
        operation_name=operation_name,
        worker_name=worker_name,
        status=status,
        reported_at_start=reported_at_start_dt,
        reported_at_end=reported_at_end_dt,
    )


@router.get("/reporting/statistics", response_model=ReportingDetailedStatisticsResponse, summary="Reporting statistics")
async def get_reporting_statistics(
    date_start: Optional[str] = Query(None, description="开始日期（ISO格式）"),
    date_end: Optional[str] = Query(None, description="结束日期（ISO格式）"),
    current_user: User = Depends(get_current_user),
    tenant_id: int = Depends(get_current_tenant),
) -> ReportingDetailedStatisticsResponse:
    """
    获取报工统计信息

    返回报工数量、合格率等统计数据。
    """
    date_start_dt = _parse_iso_datetime_or_400(date_start, "date_start")
    date_end_dt = _parse_iso_datetime_or_400(date_end, "date_end")

    statistics = await reporting_service.get_reporting_statistics(
        tenant_id=tenant_id,
        date_start=date_start_dt,
        date_end=date_end_dt,
    )
    return ReportingDetailedStatisticsResponse.model_validate(statistics)


@router.get("/reporting/{record_id}", response_model=ReportingRecordResponse, summary="Get reporting record")
async def get_reporting_record(
    record_id: int,
    current_user: User = Depends(get_current_user),
    tenant_id: int = Depends(get_current_tenant),
) -> ReportingRecordResponse:
    """
    根据ID获取报工记录详情

    - **record_id**: 报工记录ID
    """
    try:
        return await reporting_service.get_reporting_record_by_id(
            tenant_id=tenant_id,
            record_id=record_id
        )
    except NotFoundError as e:
        raise _http_exception_with_trace(404, str(e), "/reporting/{record_id}", tenant_id)
    except ValidationError as e:
        raise _http_exception_with_trace(400, str(e), "/reporting/{record_id}", tenant_id)
    except BusinessLogicError as e:
        raise _http_exception_with_trace(400, str(e), "/reporting/{record_id}", tenant_id)


@router.post("/reporting/{record_id}/approve", response_model=ReportingRecordResponse, summary="Approve reporting record")
async def approve_reporting_record(
    record_id: int,
    rejection_reason: Optional[str] = Query(None, description="驳回原因"),
    current_user: User = Depends(get_current_user),
    tenant_id: int = Depends(get_current_tenant),
) -> ReportingRecordResponse:
    """
    审核报工记录

    - **record_id**: 报工记录ID
    - **rejection_reason**: 驳回原因（可选，不填则通过）
    """
    try:
        return await reporting_service.approve_reporting_record(
            tenant_id=tenant_id,
            record_id=record_id,
            approved_by=current_user.id,
            rejection_reason=rejection_reason
        )
    except NotFoundError as e:
        raise _http_exception_with_trace(404, str(e), "/reporting/{record_id}/approve", tenant_id)
    except ValidationError as e:
        raise _http_exception_with_trace(400, str(e), "/reporting/{record_id}/approve", tenant_id)
    except BusinessLogicError as e:
        raise _http_exception_with_trace(400, str(e), "/reporting/{record_id}/approve", tenant_id)


@router.post("/reporting/{record_id}/revoke", response_model=ReportingRecordResponse, summary="Revoke reporting approval")
async def revoke_reporting_approval(
    record_id: int,
    current_user: User = Depends(get_current_user),
    tenant_id: int = Depends(get_current_tenant),
) -> ReportingRecordResponse:
    """
    撤销审核报工记录

    - **record_id**: 报工记录ID
    """
    try:
        return await reporting_service.revoke_reporting_approval(
            tenant_id=tenant_id,
            record_id=record_id,
            revoked_by=current_user.id
        )
    except NotFoundError as e:
        raise _http_exception_with_trace(404, str(e), "/reporting/{record_id}/revoke", tenant_id)
    except ValidationError as e:
        raise _http_exception_with_trace(400, str(e), "/reporting/{record_id}/revoke", tenant_id)
    except BusinessLogicError as e:
        raise _http_exception_with_trace(400, str(e), "/reporting/{record_id}/revoke", tenant_id)


@router.post("/reporting/batch-revoke", summary="Batch revoke reporting approvals")
async def batch_revoke_reporting_approval(
    record_ids: list[int] = Body(..., embed=True),
    current_user: User = Depends(get_current_user),
    tenant_id: int = Depends(get_current_tenant),
) -> dict:
    """
    批量撤回报工记录审核

    - **record_ids**: 报工记录ID列表
    """
    try:
        return await reporting_service.batch_revoke_reporting_approval(
            tenant_id=tenant_id,
            record_ids=record_ids,
            revoked_by=current_user.id
        )
    except ValidationError as e:
        raise _http_exception_with_trace(400, str(e), "/reporting/batch-revoke", tenant_id)
    except BusinessLogicError as e:
        raise _http_exception_with_trace(400, str(e), "/reporting/batch-revoke", tenant_id)


@router.put("/reporting/{record_id}/correct", response_model=ReportingRecordResponse, summary="Correct reporting data")
async def correct_reporting_data(
    record_id: int,
    correct_data: ReportingRecordUpdate,
    correction_reason: str = Query(..., description="修正原因（必填）"),
    current_user: User = Depends(get_current_user),
    tenant_id: int = Depends(get_current_tenant),
) -> ReportingRecordResponse:
    """
    修正报工数据

    用于修正已提交的报工记录数据，需要记录修正原因和修正历史。

    - **record_id**: 报工记录ID
    - **correct_data**: 修正数据
    - **correction_reason**: 修正原因（必填）
    """
    try:
        return await reporting_service.correct_reporting_data(
            tenant_id=tenant_id,
            record_id=record_id,
            correct_data=correct_data,
            corrected_by=current_user.id,
            correction_reason=correction_reason
        )
    except NotFoundError as e:
        raise _http_exception_with_trace(404, str(e), "/reporting/{record_id}/correct", tenant_id)
    except ValidationError as e:
        raise _http_exception_with_trace(400, str(e), "/reporting/{record_id}/correct", tenant_id)
    except BusinessLogicError as e:
        raise _http_exception_with_trace(400, str(e), "/reporting/{record_id}/correct", tenant_id)


@router.delete("/reporting/{record_id}", summary="Delete reporting record")
async def delete_reporting_record(
    record_id: int,
    current_user: User = Depends(get_current_user),
    tenant_id: int = Depends(get_current_tenant),
) -> JSONResponse:
    """
    删除报工记录（软删除）

    - **record_id**: 报工记录ID
    """
    try:
        await reporting_service.delete_reporting_record(
            tenant_id=tenant_id,
            record_id=record_id
        )
    except NotFoundError as e:
        raise _http_exception_with_trace(404, str(e), "/reporting/{record_id}", tenant_id)
    except ValidationError as e:
        raise _http_exception_with_trace(400, str(e), "/reporting/{record_id}", tenant_id)
    except BusinessLogicError as e:
        raise _http_exception_with_trace(400, str(e), "/reporting/{record_id}", tenant_id)

    return JSONResponse(
        content={"message": "报工记录删除成功"},
        status_code=http_status.HTTP_200_OK
    )


@router.post("/reporting/{record_id}/scrap", response_model=ScrapRecordResponse, summary="Create scrap record from reporting")
async def create_scrap_record_from_reporting(
    record_id: int,
    scrap_data: ScrapRecordCreateFromReporting,
    current_user: User = Depends(get_current_user),
    tenant_id: int = Depends(get_current_tenant),
) -> ScrapRecordResponse:
    """
    从报工记录创建报废记录

    根据报工记录信息创建报废记录，自动关联报工记录、工单和产品信息。

    - **record_id**: 报工记录ID
    - **scrap_data**: 报废记录创建数据（报废数量、报废原因、报废类型、单位成本等）
    """
    try:
        return await reporting_service.record_scrap(
            tenant_id=tenant_id,
            reporting_record_id=record_id,
            scrap_data=scrap_data,
            created_by=current_user.id
        )
    except NotFoundError as e:
        raise _http_exception_with_trace(404, str(e), "/reporting/{record_id}/scrap", tenant_id)
    except ValidationError as e:
        raise _http_exception_with_trace(400, str(e), "/reporting/{record_id}/scrap", tenant_id)
    except BusinessLogicError as e:
        raise _http_exception_with_trace(400, str(e), "/reporting/{record_id}/scrap", tenant_id)


# ============ 物料绑定 API ============

@router.post("/reporting/{record_id}/material-binding/feeding", response_model=MaterialBindingResponse, summary="Create feeding binding from reporting")
async def create_feeding_binding_from_reporting(
    record_id: int,
    binding_data: MaterialBindingCreateFromReporting,
    current_user: User = Depends(get_current_user),
    tenant_id: int = Depends(get_current_tenant),
) -> MaterialBindingResponse:
    """
    从报工记录创建上料绑定

    在报工记录中绑定上料物料信息。

    - **record_id**: 报工记录ID
    - **binding_data**: 物料绑定创建数据（物料ID、数量、仓库、批次等）
    """
    binding_data.binding_type = "feeding"
    try:
        return await material_binding_service.create_material_binding_from_reporting(
            tenant_id=tenant_id,
            reporting_record_id=record_id,
            binding_data=binding_data,
            bound_by=current_user.id
        )
    except NotFoundError as e:
        raise _http_exception_with_trace(404, str(e), "/reporting/{record_id}/material-binding/feeding", tenant_id)
    except ValidationError as e:
        raise _http_exception_with_trace(400, str(e), "/reporting/{record_id}/material-binding/feeding", tenant_id)
    except BusinessLogicError as e:
        raise _http_exception_with_trace(400, str(e), "/reporting/{record_id}/material-binding/feeding", tenant_id)


@router.post("/reporting/{record_id}/material-binding/discharging", response_model=MaterialBindingResponse, summary="Create discharging binding from reporting")
async def create_discharging_binding_from_reporting(
    record_id: int,
    binding_data: MaterialBindingCreateFromReporting,
    current_user: User = Depends(get_current_user),
    tenant_id: int = Depends(get_current_tenant),
) -> MaterialBindingResponse:
    """
    从报工记录创建下料绑定

    在报工记录中绑定下料物料信息。

    - **record_id**: 报工记录ID
    - **binding_data**: 物料绑定创建数据（物料ID、数量、仓库、批次等）
    """
    binding_data.binding_type = "discharging"
    try:
        return await material_binding_service.create_material_binding_from_reporting(
            tenant_id=tenant_id,
            reporting_record_id=record_id,
            binding_data=binding_data,
            bound_by=current_user.id
        )
    except NotFoundError as e:
        raise _http_exception_with_trace(404, str(e), "/reporting/{record_id}/material-binding/discharging", tenant_id)
    except ValidationError as e:
        raise _http_exception_with_trace(400, str(e), "/reporting/{record_id}/material-binding/discharging", tenant_id)
    except BusinessLogicError as e:
        raise _http_exception_with_trace(400, str(e), "/reporting/{record_id}/material-binding/discharging", tenant_id)


@router.get("/reporting/{record_id}/material-binding", response_model=List[MaterialBindingListResponse], summary="List material bindings for reporting")
async def get_material_bindings_by_reporting_record(
    record_id: int,
    current_user: User = Depends(get_current_user),
    tenant_id: int = Depends(get_current_tenant),
) -> List[MaterialBindingListResponse]:
    """
    获取报工记录的物料绑定记录列表

    - **record_id**: 报工记录ID
    """
    try:
        return await material_binding_service.get_material_bindings_by_reporting_record(
            tenant_id=tenant_id,
            reporting_record_id=record_id
        )
    except NotFoundError as e:
        raise _http_exception_with_trace(404, str(e), "/reporting/{record_id}/material-binding", tenant_id)
    except ValidationError as e:
        raise _http_exception_with_trace(400, str(e), "/reporting/{record_id}/material-binding", tenant_id)
    except BusinessLogicError as e:
        raise _http_exception_with_trace(400, str(e), "/reporting/{record_id}/material-binding", tenant_id)


@router.delete("/material-binding/{binding_id}", summary="Delete material binding")
async def delete_material_binding(
    binding_id: int,
    current_user: User = Depends(get_current_user),
    tenant_id: int = Depends(get_current_tenant),
) -> JSONResponse:
    """
    删除物料绑定记录（软删除）

    - **binding_id**: 物料绑定记录ID
    """
    try:
        await material_binding_service.delete_material_binding(
            tenant_id=tenant_id,
            binding_id=binding_id
        )
    except NotFoundError as e:
        raise _http_exception_with_trace(404, str(e), "/material-binding/{binding_id}", tenant_id)
    except ValidationError as e:
        raise _http_exception_with_trace(400, str(e), "/material-binding/{binding_id}", tenant_id)
    except BusinessLogicError as e:
        raise _http_exception_with_trace(400, str(e), "/material-binding/{binding_id}", tenant_id)

    return JSONResponse(
        content={"message": "物料绑定记录删除成功"},
        status_code=http_status.HTTP_200_OK
    )


# ============ 报废管理 API ============

@router.post("/scrap/{scrap_id}/approve", response_model=ScrapRecordResponse, summary="Approve scrap record")
async def approve_scrap_record(
    scrap_id: int = Path(..., description="报废记录ID"),
    approved: bool = Query(..., description="是否同意（true=同意，false=不同意）"),
    rejection_reason: Optional[str] = Query(None, description="驳回原因（当approved=false时必填）"),
    current_user: User = Depends(get_current_user),
    tenant_id: int = Depends(get_current_tenant),
) -> ScrapRecordResponse:
    """
    审批报废记录

    - **scrap_id**: 报废记录ID
    - **approved**: 是否同意（true=同意，false=不同意）
    - **rejection_reason**: 驳回原因（当approved=false时必填）
    """
    try:
        return await scrap_record_service.approve_scrap_record(
            tenant_id=tenant_id,
            scrap_id=scrap_id,
            approved=approved,
            approved_by=current_user.id,
            rejection_reason=rejection_reason
        )
    except NotFoundError as e:
        raise _http_exception_with_trace(404, str(e), "/scrap/{scrap_id}/approve", tenant_id)
    except ValidationError as e:
        raise _http_exception_with_trace(400, str(e), "/scrap/{scrap_id}/approve", tenant_id)
    except BusinessLogicError as e:
        raise _http_exception_with_trace(400, str(e), "/scrap/{scrap_id}/approve", tenant_id)


@router.get("/scrap", response_model=List[ScrapRecordListResponse], summary="List scrap records")
async def list_scrap_records(
    skip: int = Query(0, ge=0, description="跳过数量"),
    limit: int = Query(100, ge=1, le=1000, description="限制数量"),
    work_order_id: Optional[int] = Query(None, description="工单ID"),
    operation_id: Optional[int] = Query(None, description="工序ID"),
    status: Optional[str] = Query(None, description="状态（draft/confirmed/cancelled）"),
    scrap_type: Optional[str] = Query(None, description="报废类型"),
    date_start: Optional[str] = Query(None, description="开始日期（ISO格式）"),
    date_end: Optional[str] = Query(None, description="结束日期（ISO格式）"),
    current_user: User = Depends(get_current_user),
    tenant_id: int = Depends(get_current_tenant),
) -> List[ScrapRecordListResponse]:
    """
    查询报废记录列表

    - **skip**: 跳过数量
    - **limit**: 限制数量
    - **work_order_id**: 工单ID（可选）
    - **operation_id**: 工序ID（可选）
    - **status**: 状态（可选）
    - **scrap_type**: 报废类型（可选）
    - **date_start**: 开始日期（可选）
    - **date_end**: 结束日期（可选）
    """
    date_start_dt = _parse_iso_datetime_or_400(date_start, "date_start")
    date_end_dt = _parse_iso_datetime_or_400(date_end, "date_end")

    return await scrap_record_service.list_scrap_records(
        tenant_id=tenant_id,
        skip=skip,
        limit=limit,
        work_order_id=work_order_id,
        operation_id=operation_id,
        status=status,
        scrap_type=scrap_type,
        date_start=date_start_dt,
        date_end=date_end_dt
    )


@router.get("/scrap/statistics", summary="Scrap statistics")
async def get_scrap_statistics(
    date_start: Optional[str] = Query(None, description="开始日期（ISO格式）"),
    date_end: Optional[str] = Query(None, description="结束日期（ISO格式）"),
    work_order_id: Optional[int] = Query(None, description="工单ID"),
    operation_id: Optional[int] = Query(None, description="工序ID"),
    product_id: Optional[int] = Query(None, description="产品ID"),
    scrap_type: Optional[str] = Query(None, description="报废类型"),
    current_user: User = Depends(get_current_user),
    tenant_id: int = Depends(get_current_tenant),
) -> JSONResponse:
    """
    获取报废统计分析

    - **date_start**: 开始日期（可选）
    - **date_end**: 结束日期（可选）
    - **work_order_id**: 工单ID（可选）
    - **operation_id**: 工序ID（可选）
    - **product_id**: 产品ID（可选）
    - **scrap_type**: 报废类型（可选）
    """
    date_start_dt = _parse_iso_datetime_or_400(date_start, "date_start")
    date_end_dt = _parse_iso_datetime_or_400(date_end, "date_end")

    statistics = await scrap_record_service.get_scrap_statistics(
        tenant_id=tenant_id,
        date_start=date_start_dt,
        date_end=date_end_dt,
        work_order_id=work_order_id,
        operation_id=operation_id,
        product_id=product_id,
        scrap_type=scrap_type
    )

    return JSONResponse(content=statistics)


# ============ 不良品管理 API ============

@router.post("/reporting/{record_id}/defect", response_model=DefectRecordResponse, summary="Create defect record from reporting")
async def create_defect_record_from_reporting(
    record_id: int,
    defect_data: DefectRecordCreateFromReporting,
    current_user: User = Depends(get_current_user),
    tenant_id: int = Depends(get_current_tenant),
) -> DefectRecordResponse:
    """
    从报工记录创建不良品记录

    根据报工记录信息创建不良品记录，自动关联报工记录、工单和产品信息。
    支持不良品隔离、返工处理、报废处理等处理方式。

    - **record_id**: 报工记录ID
    - **defect_data**: 不良品记录创建数据（不良品数量、不良品类型、不良品原因、处理方式等）
    """
    try:
        return await reporting_service.record_defect(
            tenant_id=tenant_id,
            reporting_record_id=record_id,
            defect_data=defect_data,
            created_by=current_user.id
        )
    except NotFoundError as e:
        raise _http_exception_with_trace(404, str(e), "/reporting/{record_id}/defect", tenant_id)
    except ValidationError as e:
        raise _http_exception_with_trace(400, str(e), "/reporting/{record_id}/defect", tenant_id)
    except BusinessLogicError as e:
        raise _http_exception_with_trace(400, str(e), "/reporting/{record_id}/defect", tenant_id)


@router.post("/defect/{defect_id}/approve-acceptance", response_model=DefectRecordResponse, summary="Approve defect concession")
async def approve_defect_acceptance(
    defect_id: int = Path(..., description="不良品记录ID"),
    approved: bool = Query(..., description="是否同意（true=同意，false=不同意）"),
    rejection_reason: Optional[str] = Query(None, description="驳回原因（当approved=false时必填）"),
    current_user: User = Depends(get_current_user),
    tenant_id: int = Depends(get_current_tenant),
) -> DefectRecordResponse:
    """
    审批不良品让步接收

    - **defect_id**: 不良品记录ID
    - **approved**: 是否同意（true=同意，false=不同意）
    - **rejection_reason**: 驳回原因（当approved=false时必填）
    """
    try:
        return await defect_record_service.approve_defect_acceptance(
            tenant_id=tenant_id,
            defect_id=defect_id,
            approved=approved,
            approved_by=current_user.id,
            rejection_reason=rejection_reason
        )
    except NotFoundError as e:
        raise _http_exception_with_trace(404, str(e), "/defect/{defect_id}/approve-acceptance", tenant_id)
    except ValidationError as e:
        raise _http_exception_with_trace(400, str(e), "/defect/{defect_id}/approve-acceptance", tenant_id)
    except BusinessLogicError as e:
        raise _http_exception_with_trace(400, str(e), "/defect/{defect_id}/approve-acceptance", tenant_id)


@router.get("/defect", response_model=List[DefectRecordListResponse], summary="List defect records")
async def list_defect_records(
    skip: int = Query(0, ge=0, description="跳过数量"),
    limit: int = Query(100, ge=1, le=1000, description="限制数量"),
    work_order_id: Optional[int] = Query(None, description="工单ID"),
    operation_id: Optional[int] = Query(None, description="工序ID"),
    status: Optional[str] = Query(None, description="状态（draft/processed/cancelled）"),
    defect_type: Optional[str] = Query(None, description="不良品类型"),
    disposition: Optional[str] = Query(None, description="处理方式"),
    date_start: Optional[str] = Query(None, description="开始日期（ISO格式）"),
    date_end: Optional[str] = Query(None, description="结束日期（ISO格式）"),
    current_user: User = Depends(get_current_user),
    tenant_id: int = Depends(get_current_tenant),
) -> List[DefectRecordListResponse]:
    """
    查询不良品记录列表

    - **skip**: 跳过数量
    - **limit**: 限制数量
    - **work_order_id**: 工单ID（可选）
    - **operation_id**: 工序ID（可选）
    - **status**: 状态（可选）
    - **defect_type**: 不良品类型（可选）
    - **disposition**: 处理方式（可选）
    - **date_start**: 开始日期（可选）
    - **date_end**: 结束日期（可选）
    """
    date_start_dt = _parse_iso_datetime_or_400(date_start, "date_start")
    date_end_dt = _parse_iso_datetime_or_400(date_end, "date_end")

    return await defect_record_service.list_defect_records(
        tenant_id=tenant_id,
        skip=skip,
        limit=limit,
        work_order_id=work_order_id,
        operation_id=operation_id,
        status=status,
        defect_type=defect_type,
        disposition=disposition,
        date_start=date_start_dt,
        date_end=date_end_dt
    )


@router.get("/defect/statistics", summary="Defect statistics")
async def get_defect_statistics(
    date_start: Optional[str] = Query(None, description="开始日期（ISO格式）"),
    date_end: Optional[str] = Query(None, description="结束日期（ISO格式）"),
    work_order_id: Optional[int] = Query(None, description="工单ID"),
    operation_id: Optional[int] = Query(None, description="工序ID"),
    product_id: Optional[int] = Query(None, description="产品ID"),
    defect_type: Optional[str] = Query(None, description="不良品类型"),
    disposition: Optional[str] = Query(None, description="处理方式"),
    current_user: User = Depends(get_current_user),
    tenant_id: int = Depends(get_current_tenant),
) -> JSONResponse:
    """
    获取不良品统计分析

    - **date_start**: 开始日期（可选）
    - **date_end**: 结束日期（可选）
    - **work_order_id**: 工单ID（可选）
    - **operation_id**: 工序ID（可选）
    - **product_id**: 产品ID（可选）
    - **defect_type**: 不良品类型（可选）
    - **disposition**: 处理方式（可选）
    """
    date_start_dt = _parse_iso_datetime_or_400(date_start, "date_start")
    date_end_dt = _parse_iso_datetime_or_400(date_end, "date_end")

    statistics = await defect_record_service.get_defect_statistics(
        tenant_id=tenant_id,
        date_start=date_start_dt,
        date_end=date_end_dt,
        work_order_id=work_order_id,
        operation_id=operation_id,
        product_id=product_id,
        defect_type=defect_type,
        disposition=disposition
    )

    return JSONResponse(content=statistics)
