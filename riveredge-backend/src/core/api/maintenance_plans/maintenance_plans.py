"""
维护保养计划管理 API 路由

提供维护保养计划的 CRUD 操作。

Author: Luigi Lu
Date: 2025-01-15
"""

from typing import Optional
from fastapi import APIRouter, Depends, HTTPException, status, Query

from core.models.maintenance_plan import MaintenancePlan, MaintenanceExecution
from core.schemas.maintenance_plan import (
    MaintenancePlanCreate,
    MaintenancePlanUpdate,
    MaintenancePlanResponse,
    MaintenancePlanListResponse,
    MaintenanceExecutionCreate,
    MaintenanceExecutionUpdate,
    MaintenanceExecutionResponse,
    MaintenanceExecutionListResponse,
)
from core.services.maintenance_plan_service import MaintenancePlanService, MaintenanceExecutionService
from core.api.deps.deps import get_current_tenant
from infra.api.deps.deps import get_current_user as soil_get_current_user
from infra.models.user import User
from infra.exceptions.exceptions import NotFoundError, ValidationError

router = APIRouter(prefix="/maintenance-plans", tags=["Core Maintenance Plans"])


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
    search: Optional[str] = Query(None, description="搜索关键词（可选）"),
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
        search=search
    )
    
    items = [MaintenancePlanResponse.model_validate(plan) for plan in plans]
    
    return MaintenancePlanListResponse(
        items=items,
        total=total,
        skip=skip,
        limit=limit
    )


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
        return MaintenancePlanResponse.model_validate(plan)
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
        return MaintenancePlanResponse.model_validate(plan)
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


# ========== 维护执行记录相关端点 ==========

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
    search: Optional[str] = Query(None, description="搜索关键词（可选）"),
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
        search=search
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

