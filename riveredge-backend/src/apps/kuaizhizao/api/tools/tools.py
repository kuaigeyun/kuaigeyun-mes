"""
工装管理 API 路由

提供工装、领用记录、维保记录及校验记录的 API 端点。

Author: Antigravity
Date: 2026-02-02
"""

from typing import Optional, List
from fastapi import APIRouter, Depends, HTTPException, status, Query

from apps.kuaizhizao.schemas.tool import (
    ToolCreate, ToolUpdate, ToolResponse, ToolListResponse,
    ToolUsageCreate, ToolUsageResponse,
    ToolMaintenanceCreate, ToolMaintenanceResponse,
    ToolCalibrationCreate, ToolCalibrationResponse
)
from apps.kuaizhizao.services.tool_service import ToolService, ToolUsageService, ToolMaintenanceService
from core.api.deps.deps import get_current_tenant
from infra.api.deps.deps import get_current_user
from infra.models.user import User
from infra.exceptions.exceptions import NotFoundError, ValidationError

router = APIRouter(prefix="/tools", tags=["Kuaige Zhizao Tools"])


# --- 工装基础信息 ---

@router.post("", response_model=ToolResponse, status_code=status.HTTP_201_CREATED)
async def create_tool(
    data: ToolCreate,
    current_user: User = Depends(get_current_user),
    tenant_id: int = Depends(get_current_tenant)
):
    try:
        tool = await ToolService.create_tool(tenant_id, data)
        return ToolResponse.model_validate(tool)
    except ValidationError as e:
        raise HTTPException(status_code=422, detail=str(e))


@router.get("", response_model=ToolListResponse)
async def list_tools(
    skip: int = Query(0, ge=0),
    limit: int = Query(100, ge=1, le=1000),
    type: Optional[str] = None,
    status: Optional[str] = None,
    search: Optional[str] = None,
    tenant_id: int = Depends(get_current_tenant)
):
    items, total = await ToolService.list_tools(tenant_id, skip, limit, type, status, search)
    return ToolListResponse(items=[ToolResponse.model_validate(i) for i in items], total=total)


@router.get("/{uuid}", response_model=ToolResponse)
async def get_tool(uuid: str, tenant_id: int = Depends(get_current_tenant)):
    try:
        tool = await ToolService.get_tool_by_uuid(tenant_id, uuid)
        return ToolResponse.model_validate(tool)
    except NotFoundError as e:
        raise HTTPException(status_code=404, detail=str(e))


@router.put("/{uuid}", response_model=ToolResponse)
async def update_tool(
    uuid: str,
    data: ToolUpdate,
    tenant_id: int = Depends(get_current_tenant)
):
    try:
        tool = await ToolService.update_tool(tenant_id, uuid, data)
        return ToolResponse.model_validate(tool)
    except NotFoundError as e:
        raise HTTPException(status_code=404, detail=str(e))


# --- 领用归还 ---

@router.post("/checkout", response_model=ToolUsageResponse)
async def checkout_tool(
    data: ToolUsageCreate,
    tenant_id: int = Depends(get_current_tenant)
):
    try:
        usage = await ToolUsageService.checkout_tool(tenant_id, data)
        return ToolUsageResponse.model_validate(usage)
    except ValidationError as e:
        raise HTTPException(status_code=400, detail=str(e))


@router.post("/checkin/{uuid}", response_model=ToolUsageResponse)
async def checkin_tool(
    uuid: str,
    remark: Optional[str] = None,
    tenant_id: int = Depends(get_current_tenant)
):
    try:
        usage = await ToolUsageService.checkin_tool(tenant_id, uuid, remark)
        return ToolUsageResponse.model_validate(usage)
    except ValidationError as e:
        raise HTTPException(status_code=400, detail=str(e))


# --- 维保与校验 ---

@router.post("/maintenances", response_model=ToolMaintenanceResponse)
async def record_maintenance(
    data: ToolMaintenanceCreate,
    tenant_id: int = Depends(get_current_tenant)
):
    try:
        maint = await ToolMaintenanceService.record_maintenance(tenant_id, data)
        return ToolMaintenanceResponse.model_validate(maint)
    except Exception as e:
        raise HTTPException(status_code=400, detail=str(e))


@router.post("/calibrations", response_model=ToolCalibrationResponse)
async def record_calibration(
    data: ToolCalibrationCreate,
    tenant_id: int = Depends(get_current_tenant)
):
    try:
        calib = await ToolMaintenanceService.record_calibration(tenant_id, data)
        return ToolCalibrationResponse.model_validate(calib)
    except Exception as e:
        raise HTTPException(status_code=400, detail=str(e))
