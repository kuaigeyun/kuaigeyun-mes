"""
维护保养计划管理 API 路由

提供维护保养计划的 CRUD 操作。

Author: Luigi Lu
Date: 2026-01-05
"""

from typing import Optional
from fastapi import APIRouter, Depends, HTTPException, status, Query

from apps.kuaizhizao.models.maintenance_plan import MaintenancePlan, MaintenanceExecution
from apps.kuaizhizao.schemas.maintenance_plan import (
    MaintenancePlanCreate,
    MaintenancePlanUpdate,
    MaintenancePlanResponse,
    MaintenancePlanListResponse,
    MaintenanceExecutionCreate,
    MaintenanceExecutionUpdate,
    MaintenanceExecutionResponse,
    MaintenanceExecutionListResponse,
)
from apps.kuaizhizao.services.maintenance_plan_service import MaintenancePlanService, MaintenanceExecutionService
from core.api.deps.deps import get_current_tenant
from infra.api.deps.deps import get_current_user as soil_get_current_user
from infra.models.user import User
from infra.exceptions.exceptions import NotFoundError, ValidationError

router = APIRouter(prefix="/maintenance-plans", tags=["App - Kuaige Zhizao - Maintenance Plans"])


# ========== 维护计划相关端点 ==========

@router.post("", response_model=MaintenancePlanResponse, status_code=status.HTTP_201_CREATED)
async def create_maintenance_plan(
    data: MaintenancePlanCreate,
    current_user: User = Depends(soil_get_current_user),
    tenant_id: int = Depends(get_current_tenant),
):
    """
    创建维护计划
    
    创建新维护计划并保存到数据库。
    """
    try:
        plan = await MaintenancePlanService.create_maintenance_plan(
            tenant_id=tenant_id,
            data=data,
            created_by=current_user.id
        )
        return MaintenancePlanResponse.model_validate(plan)
    except ValidationError as e:
        raise HTTPException(
            status_code=status.HTTP_422_UNPROCESSABLE_ENTITY,
            detail=str(e)
        )


@router.get("", response_model=MaintenancePlanListResponse)
async def list_maintenance_plans(
    skip: int = Query(0, ge=0, description="跳过数量"),
    limit: int = Query(100, ge=1, le=1000, description="限制数量"),
    equipment_uuid: Optional[str] = Query(None, description="设备UUID（可选）"),
    status: Optional[str] = Query(None, description="计划状态（可选）"),
    plan_type: Optional[str] = Query(None, description="计划类型（可选）"),
    maintenance_type: Optional[str] = Query(None, description="维护类型（可选）"),
    search: Optional[str] = Query(None, description="搜索关键词（可选）"),
    keyword: Optional[str] = Query(None, description="模糊搜索（与 search 等价）"),
    order_by: Optional[str] = Query(None, description="排序字段"),
    planned_start_date: Optional[str] = Query(None, description="计划开始日期起"),
    planned_end_date: Optional[str] = Query(None, description="计划开始日期止"),
    created_start_date: Optional[str] = Query(None, description="创建日期起"),
    created_end_date: Optional[str] = Query(None, description="创建日期止"),
    updated_start_date: Optional[str] = Query(None, description="更新日期起"),
    updated_end_date: Optional[str] = Query(None, description="更新日期止"),
    current_user: User = Depends(soil_get_current_user),
    tenant_id: int = Depends(get_current_tenant),
):
    """
    获取维护计划列表
    
    获取当前组织的维护计划列表，支持筛选和搜索。
    """
    plans, total = await MaintenancePlanService.list_maintenance_plans(
        tenant_id=tenant_id,
        skip=skip,
        limit=limit,
        equipment_uuid=equipment_uuid,
        status=status,
        plan_type=plan_type,
        maintenance_type=maintenance_type,
        search=search,
        keyword=keyword,
        order_by=order_by,
        planned_start_date=planned_start_date,
        planned_end_date=planned_end_date,
        created_start_date=created_start_date,
        created_end_date=created_end_date,
        updated_start_date=updated_start_date,
        updated_end_date=updated_end_date,
    )
    
    items = [MaintenancePlanService.serialize_plan_response(plan) for plan in plans]
    
    return MaintenancePlanListResponse(
        items=items,
        total=total,
        skip=skip,
        limit=limit
    )


# ========== 维护执行记录相关端点 ==========
# 必须注册在 /{uuid} 之前，否则 GET /executions 会被当成 uuid="executions" 的计划详情

@router.post("/executions", response_model=MaintenanceExecutionResponse, status_code=status.HTTP_201_CREATED)
async def create_maintenance_execution(
    data: MaintenanceExecutionCreate,
    current_user: User = Depends(soil_get_current_user),
    tenant_id: int = Depends(get_current_tenant),
):
    """
    创建维护执行记录
    
    创建新维护执行记录并保存到数据库。
    """
    try:
        execution = await MaintenanceExecutionService.create_maintenance_execution(
            tenant_id=tenant_id,
            data=data,
            created_by=current_user.id
        )
        return MaintenanceExecutionResponse.model_validate(execution)
    except ValidationError as e:
        raise HTTPException(
            status_code=status.HTTP_422_UNPROCESSABLE_ENTITY,
            detail=str(e)
        )


@router.get("/executions", response_model=MaintenanceExecutionListResponse)
async def list_maintenance_executions(
    skip: int = Query(0, ge=0, description="跳过数量"),
    limit: int = Query(100, ge=1, le=1000, description="限制数量"),
    equipment_uuid: Optional[str] = Query(None, description="设备UUID（可选）"),
    maintenance_plan_uuid: Optional[str] = Query(None, description="维护计划UUID（可选）"),
    status: Optional[str] = Query(None, description="记录状态（可选）"),
    execution_result: Optional[str] = Query(None, description="执行结果（可选）"),
    search: Optional[str] = Query(None, description="搜索关键词（可选）"),
    keyword: Optional[str] = Query(None, description="模糊搜索（与 search 等价）"),
    order_by: Optional[str] = Query(None, description="排序字段"),
    execution_start_date: Optional[str] = Query(None, description="执行日期起"),
    execution_end_date: Optional[str] = Query(None, description="执行日期止"),
    created_start_date: Optional[str] = Query(None, description="创建日期起"),
    created_end_date: Optional[str] = Query(None, description="创建日期止"),
    updated_start_date: Optional[str] = Query(None, description="更新日期起"),
    updated_end_date: Optional[str] = Query(None, description="更新日期止"),
    current_user: User = Depends(soil_get_current_user),
    tenant_id: int = Depends(get_current_tenant),
):
    """
    获取维护执行记录列表
    
    获取当前组织的维护执行记录列表，支持筛选和搜索。
    """
    executions, total = await MaintenanceExecutionService.list_maintenance_executions(
        tenant_id=tenant_id,
        skip=skip,
        limit=limit,
        equipment_uuid=equipment_uuid,
        maintenance_plan_uuid=maintenance_plan_uuid,
        status=status,
        execution_result=execution_result,
        search=search,
        keyword=keyword,
        order_by=order_by,
        execution_start_date=execution_start_date,
        execution_end_date=execution_end_date,
        created_start_date=created_start_date,
        created_end_date=created_end_date,
        updated_start_date=updated_start_date,
        updated_end_date=updated_end_date,
    )
    
    items = [MaintenanceExecutionResponse.model_validate(exec) for exec in executions]
    
    return MaintenanceExecutionListResponse(
        items=items,
        total=total,
        skip=skip,
        limit=limit
    )


@router.get("/executions/{uuid}", response_model=MaintenanceExecutionResponse)
async def get_maintenance_execution(
    uuid: str,
    current_user: User = Depends(soil_get_current_user),
    tenant_id: int = Depends(get_current_tenant),
):
    """
    获取维护执行记录详情
    
    根据UUID获取维护执行记录详情。
    """
    try:
        execution = await MaintenanceExecutionService.get_maintenance_execution_by_uuid(tenant_id, uuid)
        return MaintenanceExecutionResponse.model_validate(execution)
    except NotFoundError as e:
        raise HTTPException(
            status_code=status.HTTP_404_NOT_FOUND,
            detail=str(e)
        )


@router.put("/executions/{uuid}", response_model=MaintenanceExecutionResponse)
async def update_maintenance_execution(
    uuid: str,
    data: MaintenanceExecutionUpdate,
    current_user: User = Depends(soil_get_current_user),
    tenant_id: int = Depends(get_current_tenant),
):
    """
    更新维护执行记录
    
    更新维护执行记录信息。
    """
    try:
        execution = await MaintenanceExecutionService.update_maintenance_execution(
            tenant_id=tenant_id,
            uuid=uuid,
            data=data
        )
        return MaintenanceExecutionResponse.model_validate(execution)
    except NotFoundError as e:
        raise HTTPException(
            status_code=status.HTTP_404_NOT_FOUND,
            detail=str(e)
        )


@router.delete("/executions/{uuid}", status_code=status.HTTP_204_NO_CONTENT)
async def delete_maintenance_execution(
    uuid: str,
    current_user: User = Depends(soil_get_current_user),
    tenant_id: int = Depends(get_current_tenant),
):
    """
    删除维护执行记录
    
    软删除维护执行记录（标记为已删除，不实际删除数据）。
    """
    try:
        await MaintenanceExecutionService.delete_maintenance_execution(tenant_id, uuid)
    except NotFoundError as e:
        raise HTTPException(
            status_code=status.HTTP_404_NOT_FOUND,
            detail=str(e)
        )


# ========== 维护计划详情 / 更新 / 删除（/{uuid} 须在静态路径之后） ==========

@router.get("/{uuid}", response_model=MaintenancePlanResponse)
async def get_maintenance_plan(
    uuid: str,
    current_user: User = Depends(soil_get_current_user),
    tenant_id: int = Depends(get_current_tenant),
):
    """
    获取维护计划详情
    
    根据UUID获取维护计划详情。
    """
    try:
        plan = await MaintenancePlanService.get_maintenance_plan_by_uuid(tenant_id, uuid)
        return await MaintenancePlanService.build_maintenance_plan_response(plan)
    except NotFoundError as e:
        raise HTTPException(
            status_code=status.HTTP_404_NOT_FOUND,
            detail=str(e)
        )


@router.put("/{uuid}", response_model=MaintenancePlanResponse)
async def update_maintenance_plan(
    uuid: str,
    data: MaintenancePlanUpdate,
    current_user: User = Depends(soil_get_current_user),
    tenant_id: int = Depends(get_current_tenant),
):
    """
    更新维护计划
    
    更新维护计划信息。
    """
    try:
        plan = await MaintenancePlanService.update_maintenance_plan(
            tenant_id=tenant_id,
            uuid=uuid,
            data=data
        )
        return await MaintenancePlanService.build_maintenance_plan_response(plan)
    except NotFoundError as e:
        raise HTTPException(
            status_code=status.HTTP_404_NOT_FOUND,
            detail=str(e)
        )


@router.delete("/{uuid}", status_code=status.HTTP_204_NO_CONTENT)
async def delete_maintenance_plan(
    uuid: str,
    current_user: User = Depends(soil_get_current_user),
    tenant_id: int = Depends(get_current_tenant),
):
    """
    删除维护计划
    
    软删除维护计划（标记为已删除，不实际删除数据）。
    """
    try:
        await MaintenancePlanService.delete_maintenance_plan(tenant_id, uuid)
    except NotFoundError as e:
        raise HTTPException(
            status_code=status.HTTP_404_NOT_FOUND,
            detail=str(e)
        )

