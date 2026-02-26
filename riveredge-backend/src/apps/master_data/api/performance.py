"""
绩效数据 API 模块

提供绩效数据的 RESTful API 接口（假期、技能、员工绩效），支持多组织隔离。
"""

from fastapi import APIRouter, Depends, HTTPException, Query, Path, status
from typing import List, Optional
from datetime import date

from core.api.deps.deps import get_current_user, get_current_tenant
from infra.models.user import User
from apps.master_data.services.performance_service import PerformanceService
from apps.master_data.schemas.performance_schemas import (
    HolidayCreate, HolidayUpdate, HolidayResponse,
    SkillCreate, SkillUpdate, SkillResponse
)
from apps.master_data.services.employee_performance_service import (
    EmployeePerformanceConfigService,
    PieceRateService,
    HourlyRateService,
    KPIDefinitionService,
)
from apps.master_data.services.performance_calc_service import PerformanceCalcService
from apps.master_data.schemas.employee_performance_schemas import (
    EmployeePerformanceConfigCreate,
    EmployeePerformanceConfigUpdate,
    EmployeePerformanceConfigResponse,
    PieceRateCreate,
    PieceRateUpdate,
    PieceRateResponse,
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

router = APIRouter(prefix="/performance", tags=["Performance"])


# ==================== 假期相关接口 ====================

@router.post("/holidays", response_model=HolidayResponse, summary="创建假期")
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
        return await PerformanceService.create_holiday(tenant_id, data)
    except ValidationError as e:
        raise HTTPException(status_code=status.HTTP_400_BAD_REQUEST, detail=str(e))


@router.get("/holidays", response_model=List[HolidayResponse], summary="获取假期列表")
async def list_holidays(
    current_user: User = Depends(get_current_user),
    tenant_id: int = Depends(get_current_tenant),
    skip: int = Query(0, ge=0, description="跳过数量"),
    limit: int = Query(100, ge=1, le=1000, description="限制数量"),
    holiday_type: Optional[str] = Query(None, description="假期类型（过滤）"),
    start_date: Optional[date] = Query(None, description="开始日期（过滤）"),
    end_date: Optional[date] = Query(None, description="结束日期（过滤）"),
    is_active: Optional[bool] = Query(None, description="是否启用")
):
    """
    获取假期列表
    
    - **skip**: 跳过数量（默认：0）
    - **limit**: 限制数量（默认：100，最大：1000）
    - **holiday_type**: 假期类型（可选，用于过滤）
    - **start_date**: 开始日期（可选，用于过滤）
    - **end_date**: 结束日期（可选，用于过滤）
    - **is_active**: 是否启用（可选）
    """
    return await PerformanceService.list_holidays(tenant_id, skip, limit, holiday_type, start_date, end_date, is_active)


@router.get("/holidays/{holiday_uuid}", response_model=HolidayResponse, summary="获取假期详情")
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


@router.put("/holidays/{holiday_uuid}", response_model=HolidayResponse, summary="更新假期")
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
        return await PerformanceService.update_holiday(tenant_id, holiday_uuid, data)
    except NotFoundError as e:
        raise HTTPException(status_code=status.HTTP_404_NOT_FOUND, detail=str(e))
    except ValidationError as e:
        raise HTTPException(status_code=status.HTTP_400_BAD_REQUEST, detail=str(e))


@router.delete("/holidays/{holiday_uuid}", summary="删除假期")
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

@router.post("/skills", response_model=SkillResponse, summary="创建技能")
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
        return await PerformanceService.create_skill(tenant_id, data)
    except ValidationError as e:
        raise HTTPException(status_code=status.HTTP_400_BAD_REQUEST, detail=str(e))


@router.get("/skills", response_model=List[SkillResponse], summary="获取技能列表")
async def list_skills(
    current_user: User = Depends(get_current_user),
    tenant_id: int = Depends(get_current_tenant),
    skip: int = Query(0, ge=0, description="跳过数量"),
    limit: int = Query(100, ge=1, le=1000, description="限制数量"),
    category: Optional[str] = Query(None, description="技能分类（过滤）"),
    is_active: Optional[bool] = Query(None, description="是否启用")
):
    """
    获取技能列表
    
    - **skip**: 跳过数量（默认：0）
    - **limit**: 限制数量（默认：100，最大：1000）
    - **category**: 技能分类（可选，用于过滤）
    - **is_active**: 是否启用（可选）
    """
    return await PerformanceService.list_skills(tenant_id, skip, limit, category, is_active)


@router.get("/skills/{skill_uuid}", response_model=SkillResponse, summary="获取技能详情")
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


@router.put("/skills/{skill_uuid}", response_model=SkillResponse, summary="更新技能")
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
        return await PerformanceService.update_skill(tenant_id, skill_uuid, data)
    except NotFoundError as e:
        raise HTTPException(status_code=status.HTTP_404_NOT_FOUND, detail=str(e))
    except ValidationError as e:
        raise HTTPException(status_code=status.HTTP_400_BAD_REQUEST, detail=str(e))


@router.delete("/skills/{skill_uuid}", summary="删除技能")
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

@router.get("/employees", summary="获取员工列表（用于绩效配置选择）")
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


@router.get("/departments", summary="获取部门列表（用于工时单价选择）")
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


@router.get("/positions", summary="获取职位列表（用于工时单价选择）")
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

@router.post("/employee-configs", response_model=EmployeePerformanceConfigResponse, summary="创建员工绩效配置")
async def create_employee_config(
    data: EmployeePerformanceConfigCreate,
    current_user: User = Depends(get_current_user),
    tenant_id: int = Depends(get_current_tenant)
):
    """创建员工绩效配置（计算模式、工时/计件单价、月保障工资）"""
    try:
        return await EmployeePerformanceConfigService.create(tenant_id, data)
    except ValidationError as e:
        raise HTTPException(status_code=status.HTTP_400_BAD_REQUEST, detail=str(e))


@router.get("/employee-configs", response_model=List[EmployeePerformanceConfigResponse], summary="获取员工绩效配置列表")
async def list_employee_configs(
    current_user: User = Depends(get_current_user),
    tenant_id: int = Depends(get_current_tenant),
    skip: int = Query(0, ge=0),
    limit: int = Query(100, ge=1, le=1000),
    employee_id: Optional[int] = Query(None),
):
    """获取员工绩效配置列表"""
    return await EmployeePerformanceConfigService.list_configs(tenant_id, skip, limit, employee_id)


@router.get("/employee-configs/{config_id}", response_model=EmployeePerformanceConfigResponse, summary="获取员工绩效配置详情")
async def get_employee_config(
    config_id: int = Path(..., description="配置ID"),
    current_user: User = Depends(get_current_user),
    tenant_id: int = Depends(get_current_tenant)
):
    try:
        return await EmployeePerformanceConfigService.get_by_id(tenant_id, config_id)
    except NotFoundError as e:
        raise HTTPException(status_code=status.HTTP_404_NOT_FOUND, detail=str(e))


@router.put("/employee-configs/{config_id}", response_model=EmployeePerformanceConfigResponse, summary="更新员工绩效配置")
async def update_employee_config(
    config_id: int = Path(..., description="配置ID"),
    data: EmployeePerformanceConfigUpdate = ...,
    current_user: User = Depends(get_current_user),
    tenant_id: int = Depends(get_current_tenant),
):
    try:
        return await EmployeePerformanceConfigService.update(tenant_id, config_id, data)
    except NotFoundError as e:
        raise HTTPException(status_code=status.HTTP_404_NOT_FOUND, detail=str(e))
    except ValidationError as e:
        raise HTTPException(status_code=status.HTTP_400_BAD_REQUEST, detail=str(e))


@router.delete("/employee-configs/{config_id}", summary="删除员工绩效配置")
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


# ==================== 计件单价 ====================

@router.post("/piece-rates", response_model=PieceRateResponse, summary="创建计件单价")
async def create_piece_rate(
    data: PieceRateCreate,
    current_user: User = Depends(get_current_user),
    tenant_id: int = Depends(get_current_tenant)
):
    try:
        return await PieceRateService.create(tenant_id, data)
    except ValidationError as e:
        raise HTTPException(status_code=status.HTTP_400_BAD_REQUEST, detail=str(e))


@router.get("/piece-rates", response_model=List[PieceRateResponse], summary="获取计件单价列表")
async def list_piece_rates(
    current_user: User = Depends(get_current_user),
    tenant_id: int = Depends(get_current_tenant),
    skip: int = Query(0, ge=0),
    limit: int = Query(100, ge=1, le=1000),
    operation_id: Optional[int] = Query(None),
):
    return await PieceRateService.list_rates(tenant_id, skip, limit, operation_id)


@router.get("/piece-rates/{rate_id}", response_model=PieceRateResponse, summary="获取计件单价详情")
async def get_piece_rate(
    rate_id: int = Path(..., description="计件单价ID"),
    current_user: User = Depends(get_current_user),
    tenant_id: int = Depends(get_current_tenant)
):
    try:
        return await PieceRateService.get_by_id(tenant_id, rate_id)
    except NotFoundError as e:
        raise HTTPException(status_code=status.HTTP_404_NOT_FOUND, detail=str(e))


@router.put("/piece-rates/{rate_id}", response_model=PieceRateResponse, summary="更新计件单价")
async def update_piece_rate(
    rate_id: int = Path(..., description="计件单价ID"),
    data: PieceRateUpdate = ...,
    current_user: User = Depends(get_current_user),
    tenant_id: int = Depends(get_current_tenant),
):
    try:
        return await PieceRateService.update(tenant_id, rate_id, data)
    except NotFoundError as e:
        raise HTTPException(status_code=status.HTTP_404_NOT_FOUND, detail=str(e))


@router.delete("/piece-rates/{rate_id}", summary="删除计件单价")
async def delete_piece_rate(
    rate_id: int = Path(..., description="计件单价ID"),
    current_user: User = Depends(get_current_user),
    tenant_id: int = Depends(get_current_tenant)
):
    try:
        await PieceRateService.delete(tenant_id, rate_id)
        return {"message": "计件单价删除成功"}
    except NotFoundError as e:
        raise HTTPException(status_code=status.HTTP_404_NOT_FOUND, detail=str(e))


# ==================== 工时单价 ====================

@router.post("/hourly-rates", response_model=HourlyRateResponse, summary="创建工时单价")
async def create_hourly_rate(
    data: HourlyRateCreate,
    current_user: User = Depends(get_current_user),
    tenant_id: int = Depends(get_current_tenant)
):
    try:
        return await HourlyRateService.create(tenant_id, data)
    except ValidationError as e:
        raise HTTPException(status_code=status.HTTP_400_BAD_REQUEST, detail=str(e))


@router.get("/hourly-rates", response_model=List[HourlyRateResponse], summary="获取工时单价列表")
async def list_hourly_rates(
    current_user: User = Depends(get_current_user),
    tenant_id: int = Depends(get_current_tenant),
    skip: int = Query(0, ge=0),
    limit: int = Query(100, ge=1, le=1000),
):
    return await HourlyRateService.list_rates(tenant_id, skip, limit)


@router.get("/hourly-rates/{rate_id}", response_model=HourlyRateResponse, summary="获取工时单价详情")
async def get_hourly_rate(
    rate_id: int = Path(..., description="工时单价ID"),
    current_user: User = Depends(get_current_user),
    tenant_id: int = Depends(get_current_tenant)
):
    try:
        return await HourlyRateService.get_by_id(tenant_id, rate_id)
    except NotFoundError as e:
        raise HTTPException(status_code=status.HTTP_404_NOT_FOUND, detail=str(e))


@router.put("/hourly-rates/{rate_id}", response_model=HourlyRateResponse, summary="更新工时单价")
async def update_hourly_rate(
    rate_id: int = Path(..., description="工时单价ID"),
    data: HourlyRateUpdate = ...,
    current_user: User = Depends(get_current_user),
    tenant_id: int = Depends(get_current_tenant),
):
    try:
        return await HourlyRateService.update(tenant_id, rate_id, data)
    except NotFoundError as e:
        raise HTTPException(status_code=status.HTTP_404_NOT_FOUND, detail=str(e))


@router.delete("/hourly-rates/{rate_id}", summary="删除工时单价")
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

@router.post("/kpi-definitions", response_model=KPIDefinitionResponse, summary="创建KPI指标定义")
async def create_kpi_definition(
    data: KPIDefinitionCreate,
    current_user: User = Depends(get_current_user),
    tenant_id: int = Depends(get_current_tenant)
):
    try:
        return await KPIDefinitionService.create(tenant_id, data)
    except ValidationError as e:
        raise HTTPException(status_code=status.HTTP_400_BAD_REQUEST, detail=str(e))


@router.get("/kpi-definitions", response_model=List[KPIDefinitionResponse], summary="获取KPI指标定义列表")
async def list_kpi_definitions(
    current_user: User = Depends(get_current_user),
    tenant_id: int = Depends(get_current_tenant),
    skip: int = Query(0, ge=0),
    limit: int = Query(100, ge=1, le=1000),
):
    return await KPIDefinitionService.list(tenant_id, skip, limit)


@router.get("/kpi-definitions/{kpi_id}", response_model=KPIDefinitionResponse, summary="获取KPI指标定义详情")
async def get_kpi_definition(
    kpi_id: int = Path(..., description="KPI指标ID"),
    current_user: User = Depends(get_current_user),
    tenant_id: int = Depends(get_current_tenant)
):
    try:
        return await KPIDefinitionService.get_by_id(tenant_id, kpi_id)
    except NotFoundError as e:
        raise HTTPException(status_code=status.HTTP_404_NOT_FOUND, detail=str(e))


@router.put("/kpi-definitions/{kpi_id}", response_model=KPIDefinitionResponse, summary="更新KPI指标定义")
async def update_kpi_definition(
    kpi_id: int = Path(..., description="KPI指标ID"),
    data: KPIDefinitionUpdate = ...,
    current_user: User = Depends(get_current_user),
    tenant_id: int = Depends(get_current_tenant),
):
    try:
        return await KPIDefinitionService.update(tenant_id, kpi_id, data)
    except NotFoundError as e:
        raise HTTPException(status_code=status.HTTP_404_NOT_FOUND, detail=str(e))


@router.delete("/kpi-definitions/{kpi_id}", summary="删除KPI指标定义")
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

@router.get("/summaries", response_model=List[PerformanceSummaryResponse], summary="获取绩效汇总列表")
async def get_performance_summaries(
    current_user: User = Depends(get_current_user),
    tenant_id: int = Depends(get_current_tenant),
    period: Optional[str] = Query(None, description="周期（YYYY-MM）"),
    employee_id: Optional[int] = Query(None, description="员工ID"),
    skip: int = Query(0, ge=0),
    limit: int = Query(100, ge=1, le=1000),
):
    """获取绩效汇总列表，支持按周期、员工筛选"""
    return await PerformanceCalcService.get_summaries(tenant_id, period, employee_id, skip, limit)


@router.get("/details", response_model=PerformanceDetailResponse, summary="获取绩效明细")
async def get_performance_details(
    current_user: User = Depends(get_current_user),
    tenant_id: int = Depends(get_current_tenant),
    period: str = Query(..., description="周期（YYYY-MM）"),
    employee_id: int = Query(..., description="员工ID"),
):
    """获取绩效明细（含报工记录列表）"""
    return await PerformanceCalcService.get_detail(tenant_id, employee_id, period)


@router.post("/calculate", response_model=List[PerformanceSummaryResponse], summary="触发绩效计算")
async def calculate_performance(
    current_user: User = Depends(get_current_user),
    tenant_id: int = Depends(get_current_tenant),
    period: str = Query(..., description="周期（YYYY-MM）"),
):
    """触发指定周期的绩效计算，汇总报工并计算应发金额"""
    return await PerformanceCalcService.calculate_period(tenant_id, period)

