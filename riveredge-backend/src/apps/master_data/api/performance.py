"""
绩效数据 API 模块

提供绩效数据的 RESTful API 接口（假期、技能、员工绩效），支持多组织隔离。
"""

import uuid
from fastapi import APIRouter, Depends, HTTPException as FastAPIHTTPException, Query, Path, Body, status
from typing import Any, List, Optional, Dict
from decimal import Decimal
from datetime import date
from loguru import logger

from core.api.deps.deps import get_current_user, get_current_tenant
from apps.master_data.api._performance_route_access import require_performance_module_access
from infra.models.user import User
from apps.master_data.services.performance_service import PerformanceService
from apps.master_data.schemas.performance_schemas import (
    HolidayCreate, HolidayUpdate, HolidayResponse,
    HolidayCnImportRequest, HolidayCnImportResult,
    SkillCreate, SkillUpdate, SkillResponse
)
from apps.master_data.services.employee_performance_service import (
    EmployeePerformanceConfigService,
    HourlyRateService,
    KPIDefinitionService,
)
from apps.master_data.services.performance_calc_service import PerformanceCalcService
from apps.master_data.services.kpi_evaluator_service import KPIEvaluatorService
from apps.master_data.services.shift_scheduling_service import ShiftSchedulingService
from apps.master_data.schemas.shift_scheduling_schemas import (
    ShiftCreate,
    ShiftUpdate,
    ShiftResponse,
    ShiftRosterCreate,
    ShiftRosterResponse,
    ShiftAssignmentsBulkUpdate,
)
from apps.master_data.services.work_calendar_service import WorkCalendarService
from apps.master_data.schemas.work_calendar_schemas import (
    WorkCalendarConfigUpdate,
    WorkCalendarConfigResponse,
    OvertimePlanCreate,
    OvertimePlanUpdate,
    OvertimePlanResponse,
    EffectiveCalendarResponse,
    StationUnavailableWindowCreate,
    StationUnavailableWindowUpdate,
    StationUnavailableWindowResponse,
)
from apps.master_data.schemas.employee_performance_schemas import (
    EmployeePerformanceConfigCreate,
    EmployeePerformanceConfigUpdate,
    EmployeePerformanceConfigResponse,
    HourlyRateCreate,
    HourlyRateUpdate,
    HourlyRateResponse,
    KPIDefinitionCreate,
    KPIDefinitionUpdate,
    KPIDefinitionResponse,
    PerformanceSummaryResponse,
    PerformanceDetailResponse,
)
from infra.exceptions.exceptions import NotFoundError, ValidationError

router = APIRouter(
    prefix="/performance",
    tags=["App - Master Data - Performance"],
    dependencies=[Depends(require_performance_module_access())],
)


def _http_exception_with_trace(
    status_code: int,
    message: str,
    route: str = "/performance",
    tenant_id: Optional[int] = None,
) -> FastAPIHTTPException:
    trace_id = uuid.uuid4().hex
    logger.warning(
        "master_data_performance_api_error trace_id={} tenant_id={} route={} status_code={} message={}",
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


# ==================== 假期相关接口 ====================

@router.post("/holidays", response_model=HolidayResponse, summary="Create holiday")
async def create_holiday(
    data: HolidayCreate,
    current_user: User = Depends(get_current_user),
    tenant_id: int = Depends(get_current_tenant)
):
    """
    创建假期
    
    - **name**: 假期名称（必填）
    - **holiday_date**: 假期日期（必填，DATE类型）
    - **holiday_type**: 假期类型（可选，如：法定节假日、公司假期等）
    - **description**: 描述（可选）
    - **is_active**: 是否启用（默认：true）
    """
    try:
        return await PerformanceService.create_holiday(tenant_id, data, operator=current_user)
    except ValidationError as e:
        raise HTTPException(status_code=status.HTTP_400_BAD_REQUEST, detail=str(e))


@router.post(
    "/holidays/import-cn",
    response_model=HolidayCnImportResult,
    response_model_by_alias=True,
    summary="Import CN legal holidays and weekly rest days",
)
async def import_cn_holidays(
    data: HolidayCnImportRequest,
    current_user: User = Depends(get_current_user),
    tenant_id: int = Depends(get_current_tenant),
):
    """
    从 holiday-cn 导入指定公历年的中国法定休息日，并按单休/双休/自定义周休生成休息日。
    调休上班日不写入；同日已有假期则跳过。
    """
    try:
        return await PerformanceService.import_cn_holidays(
            tenant_id, data, operator=current_user
        )
    except ValidationError as e:
        raise HTTPException(status_code=status.HTTP_400_BAD_REQUEST, detail=str(e))


@router.get("/holidays", summary="List holidays")
async def list_holidays(
    current_user: User = Depends(get_current_user),
    tenant_id: int = Depends(get_current_tenant),
    skip: int = Query(0, ge=0, description="跳过数量"),
    limit: int = Query(100, ge=1, le=1000, description="限制数量"),
    holiday_type: Optional[str] = Query(None, description="假期类型（过滤）"),
    start_date: Optional[date] = Query(None, description="开始日期（过滤）"),
    end_date: Optional[date] = Query(None, description="结束日期（过滤）"),
    is_active: Optional[bool] = Query(None, description="是否启用"),
    keyword: Optional[str] = Query(None, description="模糊搜索"),
    order_by: Optional[str] = Query(None, description="排序字段"),
    created_start_date: Optional[str] = Query(None, description="创建开始日期"),
    created_end_date: Optional[str] = Query(None, description="创建结束日期"),
    updated_start_date: Optional[str] = Query(None, description="更新开始日期"),
    updated_end_date: Optional[str] = Query(None, description="更新结束日期"),
):
    return await PerformanceService.list_holidays(
        tenant_id,
        skip,
        limit,
        holiday_type,
        start_date,
        end_date,
        is_active,
        keyword=keyword,
        order_by=order_by,
        created_start_date=created_start_date,
        created_end_date=created_end_date,
        updated_start_date=updated_start_date,
        updated_end_date=updated_end_date,
    )


@router.get("/holidays/{holiday_uuid}", response_model=HolidayResponse, summary="Get holiday")
async def get_holiday(
    holiday_uuid: str,
    current_user: User = Depends(get_current_user),
    tenant_id: int = Depends(get_current_tenant)
):
    """
    根据UUID获取假期详情
    
    - **holiday_uuid**: 假期UUID
    """
    try:
        return await PerformanceService.get_holiday_by_uuid(tenant_id, holiday_uuid)
    except NotFoundError as e:
        raise HTTPException(status_code=status.HTTP_404_NOT_FOUND, detail=str(e))


@router.put("/holidays/{holiday_uuid}", response_model=HolidayResponse, summary="Update holiday")
async def update_holiday(
    holiday_uuid: str,
    data: HolidayUpdate,
    current_user: User = Depends(get_current_user),
    tenant_id: int = Depends(get_current_tenant)
):
    """
    更新假期
    
    - **holiday_uuid**: 假期UUID
    - **name**: 假期名称（可选）
    - **holiday_date**: 假期日期（可选，DATE类型）
    - **holiday_type**: 假期类型（可选）
    - **description**: 描述（可选）
    - **is_active**: 是否启用（可选）
    """
    try:
        return await PerformanceService.update_holiday(tenant_id, holiday_uuid, data, operator=current_user)
    except NotFoundError as e:
        raise HTTPException(status_code=status.HTTP_404_NOT_FOUND, detail=str(e))
    except ValidationError as e:
        raise HTTPException(status_code=status.HTTP_400_BAD_REQUEST, detail=str(e))


@router.delete("/holidays/{holiday_uuid}", summary="Delete holiday")
async def delete_holiday(
    holiday_uuid: str,
    current_user: User = Depends(get_current_user),
    tenant_id: int = Depends(get_current_tenant)
):
    """
    删除假期（软删除）
    
    - **holiday_uuid**: 假期UUID
    """
    try:
        await PerformanceService.delete_holiday(tenant_id, holiday_uuid)
        return {"message": "假期删除成功"}
    except NotFoundError as e:
        raise HTTPException(status_code=status.HTTP_404_NOT_FOUND, detail=str(e))


# ==================== 技能相关接口 ====================

@router.post("/skills", response_model=SkillResponse, summary="Create skill")
async def create_skill(
    data: SkillCreate,
    current_user: User = Depends(get_current_user),
    tenant_id: int = Depends(get_current_tenant)
):
    """
    创建技能
    
    - **code**: 技能编码（必填，组织内唯一）
    - **name**: 技能名称（必填）
    - **category**: 技能分类（可选）
    - **description**: 描述（可选）
    - **is_active**: 是否启用（默认：true）
    """
    try:
        return await PerformanceService.create_skill(tenant_id, data, operator=current_user)
    except ValidationError as e:
        raise HTTPException(status_code=status.HTTP_400_BAD_REQUEST, detail=str(e))


@router.get("/skills", summary="List skills")
async def list_skills(
    current_user: User = Depends(get_current_user),
    tenant_id: int = Depends(get_current_tenant),
    skip: int = Query(0, ge=0, description="跳过数量"),
    limit: int = Query(100, ge=1, le=1000, description="限制数量"),
    category: Optional[str] = Query(None, description="技能分类（过滤）"),
    is_active: Optional[bool] = Query(None, description="是否启用"),
    keyword: Optional[str] = Query(None, description="模糊搜索"),
    order_by: Optional[str] = Query(None, description="排序字段"),
    created_start_date: Optional[str] = Query(None, description="创建开始日期"),
    created_end_date: Optional[str] = Query(None, description="创建结束日期"),
    updated_start_date: Optional[str] = Query(None, description="更新开始日期"),
    updated_end_date: Optional[str] = Query(None, description="更新结束日期"),
):
    return await PerformanceService.list_skills(
        tenant_id,
        skip,
        limit,
        category,
        is_active,
        keyword=keyword,
        order_by=order_by,
        created_start_date=created_start_date,
        created_end_date=created_end_date,
        updated_start_date=updated_start_date,
        updated_end_date=updated_end_date,
    )


@router.get("/skills/{skill_uuid}", response_model=SkillResponse, summary="Get skill")
async def get_skill(
    skill_uuid: str,
    current_user: User = Depends(get_current_user),
    tenant_id: int = Depends(get_current_tenant)
):
    """
    根据UUID获取技能详情
    
    - **skill_uuid**: 技能UUID
    """
    try:
        return await PerformanceService.get_skill_by_uuid(tenant_id, skill_uuid)
    except NotFoundError as e:
        raise HTTPException(status_code=status.HTTP_404_NOT_FOUND, detail=str(e))


@router.put("/skills/{skill_uuid}", response_model=SkillResponse, summary="Update skill")
async def update_skill(
    skill_uuid: str,
    data: SkillUpdate,
    current_user: User = Depends(get_current_user),
    tenant_id: int = Depends(get_current_tenant)
):
    """
    更新技能
    
    - **skill_uuid**: 技能UUID
    - **code**: 技能编码（可选）
    - **name**: 技能名称（可选）
    - **category**: 技能分类（可选）
    - **description**: 描述（可选）
    - **is_active**: 是否启用（可选）
    """
    try:
        return await PerformanceService.update_skill(tenant_id, skill_uuid, data, operator=current_user)
    except NotFoundError as e:
        raise HTTPException(status_code=status.HTTP_404_NOT_FOUND, detail=str(e))
    except ValidationError as e:
        raise HTTPException(status_code=status.HTTP_400_BAD_REQUEST, detail=str(e))


@router.delete("/skills/{skill_uuid}", summary="Delete skill")
async def delete_skill(
    skill_uuid: str,
    current_user: User = Depends(get_current_user),
    tenant_id: int = Depends(get_current_tenant)
):
    """
    删除技能（软删除）
    
    - **skill_uuid**: 技能UUID
    """
    try:
        await PerformanceService.delete_skill(tenant_id, skill_uuid)
        return {"message": "技能删除成功"}
    except NotFoundError as e:
        raise HTTPException(status_code=status.HTTP_404_NOT_FOUND, detail=str(e))


# ==================== 员工选择（用于绩效配置） ====================

@router.get("/employees", summary="List employees for performance config")
async def list_employees_for_performance(
    current_user: User = Depends(get_current_user),
    tenant_id: int = Depends(get_current_tenant),
    skip: int = Query(0, ge=0),
    limit: int = Query(200, ge=1, le=500),
):
    """返回当前组织的用户列表，包含 id、full_name、username，用于绩效配置中的员工选择"""
    from infra.models.user import User as UserModel
    users = await UserModel.filter(
        tenant_id=tenant_id,
        is_active=True,
        deleted_at__isnull=True,
    ).offset(skip).limit(limit).values_list("id", "full_name", "username")
    items = [
        {"id": u[0], "full_name": (u[1] or u[2]) or str(u[0]), "username": u[2]}
        for u in users
    ]
    total = await UserModel.filter(
        tenant_id=tenant_id,
        is_active=True,
        deleted_at__isnull=True,
    ).count()
    return {"items": items, "total": total}


@router.get("/departments", summary="List departments for hourly rates")
async def list_departments_for_performance(
    current_user: User = Depends(get_current_user),
    tenant_id: int = Depends(get_current_tenant),
):
    """返回当前组织的部门列表，包含 id、name，用于工时单价配置"""
    from core.models.department import Department
    depts = await Department.filter(
        tenant_id=tenant_id,
        deleted_at__isnull=True,
    ).values_list("id", "name")
    return {"items": [{"id": d[0], "name": d[1] or ""} for d in depts]}


@router.get("/positions", summary="List positions for hourly rates")
async def list_positions_for_performance(
    current_user: User = Depends(get_current_user),
    tenant_id: int = Depends(get_current_tenant),
):
    """返回当前组织的职位列表，包含 id、name，用于工时单价配置"""
    from core.models.position import Position
    positions = await Position.filter(
        tenant_id=tenant_id,
        deleted_at__isnull=True,
    ).values_list("id", "name")
    return {"items": [{"id": p[0], "name": p[1] or ""} for p in positions]}


# ==================== 员工绩效配置 ====================

@router.post("/employee-configs", response_model=EmployeePerformanceConfigResponse, summary="Create employee performance config")
async def create_employee_config(
    data: EmployeePerformanceConfigCreate,
    current_user: User = Depends(get_current_user),
    tenant_id: int = Depends(get_current_tenant)
):
    """创建员工绩效配置（计算模式、工时/计件单价、月保障工资）"""
    try:
        return await EmployeePerformanceConfigService.create(tenant_id, data, operator=current_user)
    except ValidationError as e:
        raise HTTPException(status_code=status.HTTP_400_BAD_REQUEST, detail=str(e))


@router.get("/employee-configs", summary="List employee performance configs")
async def list_employee_configs(
    current_user: User = Depends(get_current_user),
    tenant_id: int = Depends(get_current_tenant),
    skip: int = Query(0, ge=0),
    limit: int = Query(100, ge=1, le=1000),
    employee_id: Optional[int] = Query(None),
    keyword: Optional[str] = Query(None),
    order_by: Optional[str] = Query(None),
    calc_mode: Optional[str] = Query(None),
    is_active: Optional[bool] = Query(None),
    created_start_date: Optional[str] = Query(None),
    created_end_date: Optional[str] = Query(None),
    updated_start_date: Optional[str] = Query(None),
    updated_end_date: Optional[str] = Query(None),
):
    return await EmployeePerformanceConfigService.list_configs(
        tenant_id,
        skip,
        limit,
        employee_id,
        keyword=keyword,
        order_by=order_by,
        calc_mode=calc_mode,
        is_active=is_active,
        created_start_date=created_start_date,
        created_end_date=created_end_date,
        updated_start_date=updated_start_date,
        updated_end_date=updated_end_date,
    )


@router.get("/employee-configs/{config_id}", response_model=EmployeePerformanceConfigResponse, summary="Get employee performance config")
async def get_employee_config(
    config_id: int = Path(..., description="配置ID"),
    current_user: User = Depends(get_current_user),
    tenant_id: int = Depends(get_current_tenant)
):
    try:
        return await EmployeePerformanceConfigService.get_by_id(tenant_id, config_id)
    except NotFoundError as e:
        raise HTTPException(status_code=status.HTTP_404_NOT_FOUND, detail=str(e))


@router.put("/employee-configs/{config_id}", response_model=EmployeePerformanceConfigResponse, summary="Update employee performance config")
async def update_employee_config(
    config_id: int = Path(..., description="配置ID"),
    data: EmployeePerformanceConfigUpdate = ...,
    current_user: User = Depends(get_current_user),
    tenant_id: int = Depends(get_current_tenant),
):
    try:
        return await EmployeePerformanceConfigService.update(tenant_id, config_id, data, operator=current_user)
    except NotFoundError as e:
        raise HTTPException(status_code=status.HTTP_404_NOT_FOUND, detail=str(e))
    except ValidationError as e:
        raise HTTPException(status_code=status.HTTP_400_BAD_REQUEST, detail=str(e))


@router.delete("/employee-configs/{config_id}", summary="Delete employee performance config")
async def delete_employee_config(
    config_id: int = Path(..., description="配置ID"),
    current_user: User = Depends(get_current_user),
    tenant_id: int = Depends(get_current_tenant)
):
    try:
        await EmployeePerformanceConfigService.delete(tenant_id, config_id)
        return {"message": "员工绩效配置删除成功"}
    except NotFoundError as e:
        raise HTTPException(status_code=status.HTTP_404_NOT_FOUND, detail=str(e))


# ==================== 工时单价 ====================

@router.post("/hourly-rates", response_model=HourlyRateResponse, summary="Create hourly rate")
async def create_hourly_rate(
    data: HourlyRateCreate,
    current_user: User = Depends(get_current_user),
    tenant_id: int = Depends(get_current_tenant)
):
    try:
        return await HourlyRateService.create(tenant_id, data, operator=current_user)
    except ValidationError as e:
        raise HTTPException(status_code=status.HTTP_400_BAD_REQUEST, detail=str(e))


@router.get("/hourly-rates", summary="List hourly rates")
async def list_hourly_rates(
    current_user: User = Depends(get_current_user),
    tenant_id: int = Depends(get_current_tenant),
    skip: int = Query(0, ge=0),
    limit: int = Query(100, ge=1, le=1000),
    keyword: Optional[str] = Query(None),
    order_by: Optional[str] = Query(None),
    is_active: Optional[bool] = Query(None),
    created_start_date: Optional[str] = Query(None),
    created_end_date: Optional[str] = Query(None),
    updated_start_date: Optional[str] = Query(None),
    updated_end_date: Optional[str] = Query(None),
):
    return await HourlyRateService.list_rates(
        tenant_id,
        skip,
        limit,
        keyword=keyword,
        order_by=order_by,
        is_active=is_active,
        created_start_date=created_start_date,
        created_end_date=created_end_date,
        updated_start_date=updated_start_date,
        updated_end_date=updated_end_date,
    )


@router.get("/hourly-rates/{rate_id}", response_model=HourlyRateResponse, summary="Get hourly rate")
async def get_hourly_rate(
    rate_id: int = Path(..., description="工时单价ID"),
    current_user: User = Depends(get_current_user),
    tenant_id: int = Depends(get_current_tenant)
):
    try:
        return await HourlyRateService.get_by_id(tenant_id, rate_id)
    except NotFoundError as e:
        raise HTTPException(status_code=status.HTTP_404_NOT_FOUND, detail=str(e))


@router.put("/hourly-rates/{rate_id}", response_model=HourlyRateResponse, summary="Update hourly rate")
async def update_hourly_rate(
    rate_id: int = Path(..., description="工时单价ID"),
    data: HourlyRateUpdate = ...,
    current_user: User = Depends(get_current_user),
    tenant_id: int = Depends(get_current_tenant),
):
    try:
        return await HourlyRateService.update(tenant_id, rate_id, data, operator=current_user)
    except NotFoundError as e:
        raise HTTPException(status_code=status.HTTP_404_NOT_FOUND, detail=str(e))


@router.delete("/hourly-rates/{rate_id}", summary="Delete hourly rate")
async def delete_hourly_rate(
    rate_id: int = Path(..., description="工时单价ID"),
    current_user: User = Depends(get_current_user),
    tenant_id: int = Depends(get_current_tenant)
):
    try:
        await HourlyRateService.delete(tenant_id, rate_id)
        return {"message": "工时单价删除成功"}
    except NotFoundError as e:
        raise HTTPException(status_code=status.HTTP_404_NOT_FOUND, detail=str(e))


# ==================== KPI 指标定义 ====================

@router.post("/kpi-definitions", response_model=KPIDefinitionResponse, summary="Create KPI definition")
async def create_kpi_definition(
    data: KPIDefinitionCreate,
    current_user: User = Depends(get_current_user),
    tenant_id: int = Depends(get_current_tenant)
):
    try:
        return await KPIDefinitionService.create(tenant_id, data, operator=current_user)
    except ValidationError as e:
        raise HTTPException(status_code=status.HTTP_400_BAD_REQUEST, detail=str(e))


@router.get("/kpi-definitions", summary="List KPI definitions")
async def list_kpi_definitions(
    current_user: User = Depends(get_current_user),
    tenant_id: int = Depends(get_current_tenant),
    skip: int = Query(0, ge=0),
    limit: int = Query(100, ge=1, le=1000),
    keyword: Optional[str] = Query(None),
    order_by: Optional[str] = Query(None),
    calc_type: Optional[str] = Query(None),
    is_active: Optional[bool] = Query(None),
    created_start_date: Optional[str] = Query(None),
    created_end_date: Optional[str] = Query(None),
    updated_start_date: Optional[str] = Query(None),
    updated_end_date: Optional[str] = Query(None),
):
    return await KPIDefinitionService.list(
        tenant_id,
        skip,
        limit,
        keyword=keyword,
        order_by=order_by,
        calc_type=calc_type,
        is_active=is_active,
        created_start_date=created_start_date,
        created_end_date=created_end_date,
        updated_start_date=updated_start_date,
        updated_end_date=updated_end_date,
    )


@router.get("/kpi-definitions/{kpi_id}", response_model=KPIDefinitionResponse, summary="Get KPI definition")
async def get_kpi_definition(
    kpi_id: int = Path(..., description="KPI指标ID"),
    current_user: User = Depends(get_current_user),
    tenant_id: int = Depends(get_current_tenant)
):
    try:
        return await KPIDefinitionService.get_by_id(tenant_id, kpi_id)
    except NotFoundError as e:
        raise HTTPException(status_code=status.HTTP_404_NOT_FOUND, detail=str(e))


@router.put("/kpi-definitions/{kpi_id}", response_model=KPIDefinitionResponse, summary="Update KPI definition")
async def update_kpi_definition(
    kpi_id: int = Path(..., description="KPI指标ID"),
    data: KPIDefinitionUpdate = ...,
    current_user: User = Depends(get_current_user),
    tenant_id: int = Depends(get_current_tenant),
):
    try:
        return await KPIDefinitionService.update(tenant_id, kpi_id, data, operator=current_user)
    except NotFoundError as e:
        raise HTTPException(status_code=status.HTTP_404_NOT_FOUND, detail=str(e))


@router.delete("/kpi-definitions/{kpi_id}", summary="Delete KPI definition")
async def delete_kpi_definition(
    kpi_id: int = Path(..., description="KPI指标ID"),
    current_user: User = Depends(get_current_user),
    tenant_id: int = Depends(get_current_tenant)
):
    try:
        await KPIDefinitionService.delete(tenant_id, kpi_id)
        return {"message": "KPI指标定义删除成功"}
    except NotFoundError as e:
        raise HTTPException(status_code=status.HTTP_404_NOT_FOUND, detail=str(e))


# ==================== 绩效统计与计算 ====================

@router.get("/summaries", summary="List performance summaries")
async def get_performance_summaries(
    current_user: User = Depends(get_current_user),
    tenant_id: int = Depends(get_current_tenant),
    period: Optional[str] = Query(None, description="周期（YYYY-MM）"),
    employee_id: Optional[int] = Query(None, description="员工ID"),
    skip: int = Query(0, ge=0),
    limit: int = Query(100, ge=1, le=1000),
    keyword: Optional[str] = Query(None),
    order_by: Optional[str] = Query(None),
    status: Optional[str] = Query(None),
    created_start_date: Optional[str] = Query(None),
    created_end_date: Optional[str] = Query(None),
    updated_start_date: Optional[str] = Query(None),
    updated_end_date: Optional[str] = Query(None),
):
    return await PerformanceCalcService.get_summaries(
        tenant_id,
        period,
        employee_id,
        skip,
        limit,
        keyword=keyword,
        order_by=order_by,
        status=status,
        created_start_date=created_start_date,
        created_end_date=created_end_date,
        updated_start_date=updated_start_date,
        updated_end_date=updated_end_date,
    )


@router.get("/details", response_model=PerformanceDetailResponse, summary="Get performance detail")
async def get_performance_details(
    current_user: User = Depends(get_current_user),
    tenant_id: int = Depends(get_current_tenant),
    period: str = Query(..., description="周期（YYYY-MM）"),
    employee_id: int = Query(..., description="员工ID"),
):
    """获取绩效明细（含报工记录列表）"""
    return await PerformanceCalcService.get_detail(tenant_id, employee_id, period)


@router.post("/calculate", response_model=List[PerformanceSummaryResponse], summary="Trigger performance calculation")
async def calculate_performance(
    current_user: User = Depends(get_current_user),
    tenant_id: int = Depends(get_current_tenant),
    period: str = Query(..., description="周期（YYYY-MM）"),
):
    """触发指定周期的绩效计算，汇总报工并计算应发金额"""
    try:
        return await PerformanceCalcService.calculate_period(tenant_id, period, operator=current_user)
    except ValidationError as e:
        raise HTTPException(status_code=status.HTTP_400_BAD_REQUEST, detail=str(e))


@router.post(
    "/work-groups/{work_group_uuid}/distribute",
    response_model=List[PerformanceSummaryResponse],
    summary="Distribute performance by work group",
)
async def distribute_by_work_group(
    work_group_uuid: str,
    current_user: User = Depends(get_current_user),
    tenant_id: int = Depends(get_current_tenant),
    period: str = Query(..., description="周期（YYYY-MM）"),
    total_amount: float = Query(..., description="待分配总金额（元）"),
    custom_distribution: Optional[Dict[str, float]] = Body(
        None,
        description="自定义分配（employee_id -> amount），不传则按成员权重比例分配",
    ),
):
    """
    按工作小组分配绩效（混合模式）

    - 若提供 custom_distribution，则按自定义金额分配
    - 否则按成员 performance_weight 比例分配
    """
    try:
        amount_decimal = Decimal(str(total_amount))
        custom_map = None
        if custom_distribution:
            custom_map = {int(k): Decimal(str(v)) for k, v in custom_distribution.items()}
        return await PerformanceCalcService.distribute_by_work_group(
            tenant_id=tenant_id,
            work_group_uuid=work_group_uuid,
            period=period,
            total_amount=amount_decimal,
            custom_distribution=custom_map,
        )
    except NotFoundError as e:
        raise HTTPException(status_code=status.HTTP_404_NOT_FOUND, detail=str(e))
    except ValidationError as e:
        raise HTTPException(status_code=status.HTTP_400_BAD_REQUEST, detail=str(e))


@router.post("/summaries/{summary_id}/confirm", response_model=PerformanceSummaryResponse, summary="Confirm performance summary")
async def confirm_performance_summary(
    summary_id: int = Path(..., description="汇总ID"),
    current_user: User = Depends(get_current_user),
    tenant_id: int = Depends(get_current_tenant),
):
    try:
        return await PerformanceCalcService.confirm_summary(tenant_id, summary_id, operator=current_user)
    except NotFoundError as e:
        raise HTTPException(status_code=status.HTTP_404_NOT_FOUND, detail=str(e))
    except ValidationError as e:
        raise HTTPException(status_code=status.HTTP_400_BAD_REQUEST, detail=str(e))


@router.post("/summaries/{summary_id}/reopen", response_model=PerformanceSummaryResponse, summary="Reopen confirmed summary")
async def reopen_performance_summary(
    summary_id: int = Path(..., description="汇总ID"),
    current_user: User = Depends(get_current_user),
    tenant_id: int = Depends(get_current_tenant),
):
    try:
        return await PerformanceCalcService.reopen_summary(tenant_id, summary_id, operator=current_user)
    except NotFoundError as e:
        raise HTTPException(status_code=status.HTTP_404_NOT_FOUND, detail=str(e))
    except ValidationError as e:
        raise HTTPException(status_code=status.HTTP_400_BAD_REQUEST, detail=str(e))


@router.post("/summaries/batch-confirm", summary="Batch confirm summaries by period")
async def batch_confirm_summaries(
    period: str = Query(..., description="周期（YYYY-MM）"),
    current_user: User = Depends(get_current_user),
    tenant_id: int = Depends(get_current_tenant),
):
    return await PerformanceCalcService.batch_confirm_period(tenant_id, period, operator=current_user)


@router.get("/summaries/payroll-total", summary="Confirmed payroll total for finance import")
async def get_payroll_total(
    period: str = Query(..., description="周期（YYYY-MM）"),
    current_user: User = Depends(get_current_user),
    tenant_id: int = Depends(get_current_tenant),
):
    _, total = await PerformanceCalcService.export_summaries_csv(
        tenant_id, period=period, status="confirmed",
    )
    from apps.master_data.models.employee_performance import PerformanceSummary

    count = await PerformanceSummary.filter(
        tenant_id=tenant_id,
        period=period,
        status="confirmed",
        deleted_at__isnull=True,
    ).count()
    return {"period": period, "total_amount": float(total), "employee_count": count}


@router.get("/summaries/export", summary="Export confirmed summaries as CSV")
async def export_performance_summaries(
    period: str = Query(..., description="周期（YYYY-MM）"),
    status_filter: str = Query("confirmed", alias="status", description="汇总状态"),
    current_user: User = Depends(get_current_user),
    tenant_id: int = Depends(get_current_tenant),
):
    from fastapi.responses import PlainTextResponse

    csv_text, total = await PerformanceCalcService.export_summaries_csv(
        tenant_id, period=period, status=status_filter,
    )
    return PlainTextResponse(
        content=csv_text,
        media_type="text/csv; charset=utf-8",
        headers={
            "Content-Disposition": f'attachment; filename="performance-{period}.csv"',
            "X-Total-Amount": str(total),
        },
    )


@router.get("/kpi-scores", summary="List employee KPI scores")
async def list_kpi_scores(
    period: Optional[str] = Query(None, description="周期（YYYY-MM）"),
    employee_id: Optional[int] = Query(None, description="员工ID"),
    current_user: User = Depends(get_current_user),
    tenant_id: int = Depends(get_current_tenant),
):
    rows = await KPIEvaluatorService.list_scores(tenant_id, employee_id=employee_id, period=period)
    return [
        {
            "employee_id": r.employee_id,
            "employee_name": r.employee_name,
            "period": r.period,
            "kpi_code": r.kpi_code,
            "score": float(r.score or 0),
            "source_data_json": r.source_data_json,
        }
        for r in rows
    ]


# ==================== 班次定义 ====================


@router.post("/shifts", response_model=ShiftResponse, summary="Create shift")
async def create_shift(
    data: ShiftCreate,
    current_user: User = Depends(get_current_user),
    tenant_id: int = Depends(get_current_tenant),
):
    try:
        return await ShiftSchedulingService.create_shift(tenant_id, data, operator=current_user)
    except ValidationError as e:
        raise HTTPException(status_code=status.HTTP_400_BAD_REQUEST, detail=str(e))


@router.get("/shifts", summary="List shifts")
async def list_shifts(
    current_user: User = Depends(get_current_user),
    tenant_id: int = Depends(get_current_tenant),
    skip: int = Query(0, ge=0),
    limit: int = Query(200, ge=1, le=1000),
    is_active: Optional[bool] = Query(None),
    keyword: Optional[str] = Query(None),
    order_by: Optional[str] = Query(None),
    created_start_date: Optional[str] = Query(None),
    created_end_date: Optional[str] = Query(None),
    updated_start_date: Optional[str] = Query(None),
    updated_end_date: Optional[str] = Query(None),
):
    return await ShiftSchedulingService.list_shifts(
        tenant_id,
        skip,
        limit,
        is_active,
        keyword=keyword,
        order_by=order_by,
        created_start_date=created_start_date,
        created_end_date=created_end_date,
        updated_start_date=updated_start_date,
        updated_end_date=updated_end_date,
    )


@router.get("/shifts/{shift_uuid}", response_model=ShiftResponse, summary="Get shift")
async def get_shift(
    shift_uuid: str,
    current_user: User = Depends(get_current_user),
    tenant_id: int = Depends(get_current_tenant),
):
    try:
        return await ShiftSchedulingService.get_shift_by_uuid(tenant_id, shift_uuid)
    except NotFoundError as e:
        raise HTTPException(status_code=status.HTTP_404_NOT_FOUND, detail=str(e))


@router.put("/shifts/{shift_uuid}", response_model=ShiftResponse, summary="Update shift")
async def update_shift(
    shift_uuid: str,
    data: ShiftUpdate,
    current_user: User = Depends(get_current_user),
    tenant_id: int = Depends(get_current_tenant),
):
    try:
        return await ShiftSchedulingService.update_shift(tenant_id, shift_uuid, data, operator=current_user)
    except NotFoundError as e:
        raise HTTPException(status_code=status.HTTP_404_NOT_FOUND, detail=str(e))
    except ValidationError as e:
        raise HTTPException(status_code=status.HTTP_400_BAD_REQUEST, detail=str(e))


@router.delete("/shifts/{shift_uuid}", summary="Delete shift")
async def delete_shift(
    shift_uuid: str,
    current_user: User = Depends(get_current_user),
    tenant_id: int = Depends(get_current_tenant),
):
    try:
        await ShiftSchedulingService.delete_shift(tenant_id, shift_uuid)
        return {"message": "班次删除成功"}
    except NotFoundError as e:
        raise HTTPException(status_code=status.HTTP_404_NOT_FOUND, detail=str(e))


# ==================== 排班表 ====================


@router.post("/shift-rosters", response_model=ShiftRosterResponse, summary="Create shift roster")
async def create_shift_roster(
    data: ShiftRosterCreate,
    current_user: User = Depends(get_current_user),
    tenant_id: int = Depends(get_current_tenant),
):
    try:
        return await ShiftSchedulingService.create_roster(tenant_id, data, operator=current_user)
    except (NotFoundError, ValidationError) as e:
        code = status.HTTP_404_NOT_FOUND if isinstance(e, NotFoundError) else status.HTTP_400_BAD_REQUEST
        raise HTTPException(status_code=code, detail=str(e))


@router.get("/shift-rosters", response_model=List[ShiftRosterResponse], summary="List shift rosters")
async def list_shift_rosters(
    current_user: User = Depends(get_current_user),
    tenant_id: int = Depends(get_current_tenant),
    work_group_id: Optional[int] = Query(None, alias="workGroupId"),
    employee_id: Optional[int] = Query(None, alias="employeeId"),
    period_start: Optional[date] = Query(None, alias="periodStart"),
    status: Optional[str] = Query(None),
    skip: int = Query(0, ge=0),
    limit: int = Query(50, ge=1, le=200),
):
    return await ShiftSchedulingService.list_rosters(
        tenant_id, work_group_id, employee_id, period_start, status, skip, limit
    )


@router.get(
    "/shift-rosters/by-week",
    response_model=ShiftRosterResponse,
    summary="Get or create shift roster for work group or employee week",
)
async def get_or_create_shift_roster_week(
    period_start: date = Query(..., alias="periodStart"),
    work_group_id: Optional[int] = Query(None, alias="workGroupId"),
    employee_id: Optional[int] = Query(None, alias="employeeId"),
    current_user: User = Depends(get_current_user),
    tenant_id: int = Depends(get_current_tenant),
):
    try:
        return await ShiftSchedulingService.get_or_create_roster_for_week(
            tenant_id,
            period_start,
            work_group_id=work_group_id,
            employee_id=employee_id,
        )
    except (NotFoundError, ValidationError) as e:
        code = status.HTTP_404_NOT_FOUND if isinstance(e, NotFoundError) else status.HTTP_400_BAD_REQUEST
        raise HTTPException(status_code=code, detail=str(e))


@router.get(
    "/shift-rosters/{roster_uuid}",
    response_model=ShiftRosterResponse,
    summary="Get shift roster",
)
async def get_shift_roster(
    roster_uuid: str,
    current_user: User = Depends(get_current_user),
    tenant_id: int = Depends(get_current_tenant),
):
    try:
        return await ShiftSchedulingService.get_roster_by_uuid(tenant_id, roster_uuid)
    except NotFoundError as e:
        raise HTTPException(status_code=status.HTTP_404_NOT_FOUND, detail=str(e))


@router.put(
    "/shift-rosters/{roster_uuid}/assignments",
    response_model=ShiftRosterResponse,
    summary="Save shift roster assignments",
)
async def save_shift_roster_assignments(
    roster_uuid: str,
    data: ShiftAssignmentsBulkUpdate,
    current_user: User = Depends(get_current_user),
    tenant_id: int = Depends(get_current_tenant),
):
    try:
        return await ShiftSchedulingService.save_assignments(
            tenant_id, roster_uuid, data, operator=current_user
        )
    except NotFoundError as e:
        raise HTTPException(status_code=status.HTTP_404_NOT_FOUND, detail=str(e))
    except ValidationError as e:
        raise HTTPException(status_code=status.HTTP_400_BAD_REQUEST, detail=str(e))


@router.post(
    "/shift-rosters/{roster_uuid}/publish",
    response_model=ShiftRosterResponse,
    summary="Publish shift roster",
)
async def publish_shift_roster(
    roster_uuid: str,
    current_user: User = Depends(get_current_user),
    tenant_id: int = Depends(get_current_tenant),
):
    try:
        return await ShiftSchedulingService.publish_roster(tenant_id, roster_uuid, operator=current_user)
    except NotFoundError as e:
        raise HTTPException(status_code=status.HTTP_404_NOT_FOUND, detail=str(e))
    except ValidationError as e:
        raise HTTPException(status_code=status.HTTP_400_BAD_REQUEST, detail=str(e))


@router.post(
    "/shift-rosters/{roster_uuid}/copy-from-previous-week",
    response_model=ShiftRosterResponse,
    summary="Copy assignments from previous week",
)
async def copy_shift_roster_from_previous_week(
    roster_uuid: str,
    current_user: User = Depends(get_current_user),
    tenant_id: int = Depends(get_current_tenant),
):
    try:
        return await ShiftSchedulingService.copy_from_previous_week(tenant_id, roster_uuid)
    except NotFoundError as e:
        raise HTTPException(status_code=status.HTTP_404_NOT_FOUND, detail=str(e))
    except ValidationError as e:
        raise HTTPException(status_code=status.HTTP_400_BAD_REQUEST, detail=str(e))


# ==================== 工作日历（工作时段 + 加班） ====================


@router.get(
    "/work-calendar",
    response_model=WorkCalendarConfigResponse,
    summary="Get plant work calendar config",
)
async def get_work_calendar(
    current_user: User = Depends(get_current_user),
    tenant_id: int = Depends(get_current_tenant),
):
    return await WorkCalendarService.get_or_create_config(tenant_id, operator=current_user)


@router.put(
    "/work-calendar",
    response_model=WorkCalendarConfigResponse,
    summary="Update plant work calendar config",
)
async def update_work_calendar(
    data: WorkCalendarConfigUpdate,
    current_user: User = Depends(get_current_user),
    tenant_id: int = Depends(get_current_tenant),
):
    try:
        return await WorkCalendarService.update_config(tenant_id, data, operator=current_user)
    except ValidationError as e:
        raise FastAPIHTTPException(status_code=status.HTTP_400_BAD_REQUEST, detail=str(e))


@router.get(
    "/work-calendar/effective",
    response_model=EffectiveCalendarResponse,
    summary="Get effective calendar for APS",
)
async def get_effective_work_calendar(
    date_from: date = Query(..., alias="dateFrom"),
    date_to: date = Query(..., alias="dateTo"),
    current_user: User = Depends(get_current_user),
    tenant_id: int = Depends(get_current_tenant),
):
    return await WorkCalendarService.get_effective_calendar_response(
        tenant_id, date_from, date_to
    )


@router.get("/overtimes", summary="List overtime plans")
async def list_overtimes(
    date_from: Optional[date] = Query(None, alias="dateFrom"),
    date_to: Optional[date] = Query(None, alias="dateTo"),
    is_active: Optional[bool] = Query(None, alias="isActive"),
    skip: int = Query(0, ge=0),
    limit: int = Query(100, ge=1, le=500),
    current_user: User = Depends(get_current_user),
    tenant_id: int = Depends(get_current_tenant),
):
    return await WorkCalendarService.list_overtimes(
        tenant_id,
        date_from=date_from,
        date_to=date_to,
        is_active=is_active,
        skip=skip,
        limit=limit,
    )


@router.post(
    "/overtimes",
    response_model=OvertimePlanResponse,
    summary="Create overtime plan",
)
async def create_overtime(
    data: OvertimePlanCreate,
    current_user: User = Depends(get_current_user),
    tenant_id: int = Depends(get_current_tenant),
):
    try:
        return await WorkCalendarService.create_overtime(tenant_id, data, operator=current_user)
    except ValidationError as e:
        raise FastAPIHTTPException(status_code=status.HTTP_400_BAD_REQUEST, detail=str(e))


@router.get(
    "/overtimes/{overtime_uuid}",
    response_model=OvertimePlanResponse,
    summary="Get overtime plan",
)
async def get_overtime(
    overtime_uuid: str,
    current_user: User = Depends(get_current_user),
    tenant_id: int = Depends(get_current_tenant),
):
    try:
        return await WorkCalendarService.get_overtime(tenant_id, overtime_uuid)
    except NotFoundError as e:
        raise FastAPIHTTPException(status_code=status.HTTP_404_NOT_FOUND, detail=str(e))


@router.put(
    "/overtimes/{overtime_uuid}",
    response_model=OvertimePlanResponse,
    summary="Update overtime plan",
)
async def update_overtime(
    overtime_uuid: str,
    data: OvertimePlanUpdate,
    current_user: User = Depends(get_current_user),
    tenant_id: int = Depends(get_current_tenant),
):
    try:
        return await WorkCalendarService.update_overtime(
            tenant_id, overtime_uuid, data, operator=current_user
        )
    except NotFoundError as e:
        raise FastAPIHTTPException(status_code=status.HTTP_404_NOT_FOUND, detail=str(e))
    except ValidationError as e:
        raise FastAPIHTTPException(status_code=status.HTTP_400_BAD_REQUEST, detail=str(e))


@router.delete("/overtimes/{overtime_uuid}", summary="Delete overtime plan")
async def delete_overtime(
    overtime_uuid: str,
    current_user: User = Depends(get_current_user),
    tenant_id: int = Depends(get_current_tenant),
):
    try:
        await WorkCalendarService.delete_overtime(tenant_id, overtime_uuid)
        return {"success": True}
    except NotFoundError as e:
        raise FastAPIHTTPException(status_code=status.HTTP_404_NOT_FOUND, detail=str(e))


@router.get("/work-calendar/station-unavailable", summary="List station unavailable windows")
async def list_station_unavailable(
    station_id: Optional[int] = Query(None, alias="stationId"),
    date_from: Optional[date] = Query(None, alias="dateFrom"),
    date_to: Optional[date] = Query(None, alias="dateTo"),
    skip: int = Query(0, ge=0),
    limit: int = Query(100, ge=1, le=500),
    current_user: User = Depends(get_current_user),
    tenant_id: int = Depends(get_current_tenant),
):
    return await WorkCalendarService.list_station_unavailable(
        tenant_id,
        station_id=station_id,
        date_from=date_from,
        date_to=date_to,
        skip=skip,
        limit=limit,
    )


@router.post(
    "/work-calendar/station-unavailable",
    response_model=StationUnavailableWindowResponse,
    summary="Create station unavailable window",
)
async def create_station_unavailable(
    data: StationUnavailableWindowCreate,
    current_user: User = Depends(get_current_user),
    tenant_id: int = Depends(get_current_tenant),
):
    try:
        return await WorkCalendarService.create_station_unavailable(
            tenant_id, data, operator=current_user
        )
    except ValidationError as e:
        raise FastAPIHTTPException(status_code=status.HTTP_400_BAD_REQUEST, detail=str(e))


@router.put(
    "/work-calendar/station-unavailable/{window_uuid}",
    response_model=StationUnavailableWindowResponse,
    summary="Update station unavailable window",
)
async def update_station_unavailable(
    window_uuid: str,
    data: StationUnavailableWindowUpdate,
    current_user: User = Depends(get_current_user),
    tenant_id: int = Depends(get_current_tenant),
):
    try:
        return await WorkCalendarService.update_station_unavailable(
            tenant_id, window_uuid, data, operator=current_user
        )
    except NotFoundError as e:
        raise FastAPIHTTPException(status_code=status.HTTP_404_NOT_FOUND, detail=str(e))
    except ValidationError as e:
        raise FastAPIHTTPException(status_code=status.HTTP_400_BAD_REQUEST, detail=str(e))


@router.delete(
    "/work-calendar/station-unavailable/{window_uuid}",
    summary="Delete station unavailable window",
)
async def delete_station_unavailable(
    window_uuid: str,
    current_user: User = Depends(get_current_user),
    tenant_id: int = Depends(get_current_tenant),
):
    try:
        await WorkCalendarService.delete_station_unavailable(tenant_id, window_uuid)
        return {"success": True}
    except NotFoundError as e:
        raise FastAPIHTTPException(status_code=status.HTTP_404_NOT_FOUND, detail=str(e))

