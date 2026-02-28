"""
工装管理 API 路由

提供工装、领用记录、维保记录及校验记录的 API 端点。

Author: Antigravity
Date: 2026-02-02
"""

from typing import Optional, List
from fastapi import APIRouter, Depends, HTTPException, status, Query

from apps.kuaizhizao.models.tool import Tool
from apps.kuaizhizao.schemas.tool import (
    ToolCreate, ToolUpdate, ToolResponse, ToolListResponse,
    ToolUsageCreate, ToolUsageResponse, ToolUsageListResponse,
    ToolMaintenanceCreate, ToolMaintenanceResponse, ToolMaintenanceListResponse,
    ToolCalibrationCreate, ToolCalibrationResponse, ToolCalibrationListResponse,
    ToolMaintenanceReminderResponse, ToolMaintenanceReminderListResponse,
)
from apps.kuaizhizao.services.tool_service import ToolService, ToolUsageService, ToolMaintenanceService, ToolMaintenanceReminderService
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


@router.get("/usages", response_model=ToolUsageListResponse)
async def list_all_tool_usages(
    skip: int = Query(0, ge=0),
    limit: int = Query(100, ge=1, le=1000),
    tool_uuid: Optional[str] = Query(None, description="工装UUID（可选）"),
    status: Optional[str] = Query(None, description="状态（使用中/已归还）"),
    tenant_id: int = Depends(get_current_tenant)
):
    items, total = await ToolUsageService.list_all_usages(tenant_id, tool_uuid, status, skip, limit)
    tools = {t.id: t for t in await Tool.filter(id__in={u.tool_id for u in items})}
    resp_items = []
    for u in items:
        t = tools.get(u.tool_id)
        r = ToolUsageResponse.model_validate(u)
        r = r.model_copy(update={"tool_code": t.code if t else None, "tool_name": t.name if t else None})
        resp_items.append(r)
    return ToolUsageListResponse(items=resp_items, total=total, skip=skip, limit=limit)


@router.get("/maintenances", response_model=ToolMaintenanceListResponse)
async def list_all_tool_maintenances(
    skip: int = Query(0, ge=0),
    limit: int = Query(100, ge=1, le=1000),
    tool_uuid: Optional[str] = Query(None, description="工装UUID（可选）"),
    tenant_id: int = Depends(get_current_tenant)
):
    items, total = await ToolMaintenanceService.list_all_maintenances(tenant_id, tool_uuid, skip, limit)
    tools = {t.id: t for t in await Tool.filter(id__in={m.tool_id for m in items})}
    resp_items = []
    for m in items:
        t = tools.get(m.tool_id)
        r = ToolMaintenanceResponse.model_validate(m)
        r = r.model_copy(update={"tool_code": t.code if t else None, "tool_name": t.name if t else None})
        resp_items.append(r)
    return ToolMaintenanceListResponse(items=resp_items, total=total, skip=skip, limit=limit)


@router.get("/calibrations", response_model=ToolCalibrationListResponse)
async def list_all_tool_calibrations(
    skip: int = Query(0, ge=0),
    limit: int = Query(100, ge=1, le=1000),
    tool_uuid: Optional[str] = Query(None, description="工装UUID（可选）"),
    tenant_id: int = Depends(get_current_tenant)
):
    items, total = await ToolMaintenanceService.list_all_calibrations(tenant_id, tool_uuid, skip, limit)
    tools = {t.id: t for t in await Tool.filter(id__in={c.tool_id for c in items})}
    resp_items = []
    for c in items:
        t = tools.get(c.tool_id)
        r = ToolCalibrationResponse.model_validate(c)
        r = r.model_copy(update={"tool_code": t.code if t else None, "tool_name": t.name if t else None})
        resp_items.append(r)
    return ToolCalibrationListResponse(items=resp_items, total=total, skip=skip, limit=limit)


@router.get("/maintenance-reminders", response_model=ToolMaintenanceReminderListResponse)
async def list_tool_maintenance_reminders(
    skip: int = Query(0, ge=0),
    limit: int = Query(100, ge=1, le=1000),
    due_type: Optional[str] = Query(None, description="due_soon/overdue"),
    tenant_id: int = Depends(get_current_tenant)
):
    items, total = await ToolMaintenanceReminderService.list_reminders(tenant_id, skip, limit, due_type)
    return ToolMaintenanceReminderListResponse(
        items=[ToolMaintenanceReminderResponse.model_validate(i) for i in items],
        total=total,
        skip=skip,
        limit=limit,
    )


@router.get("/{uuid}/usages", response_model=ToolUsageListResponse)
async def list_tool_usages(
    uuid: str,
    skip: int = Query(0, ge=0),
    limit: int = Query(100, ge=1, le=1000),
    tenant_id: int = Depends(get_current_tenant)
):
    try:
        items, total = await ToolUsageService.list_usages(tenant_id, uuid, skip, limit)
        return ToolUsageListResponse(
            items=[ToolUsageResponse.model_validate(i) for i in items],
            total=total,
            skip=skip,
            limit=limit
        )
    except NotFoundError as e:
        raise HTTPException(status_code=404, detail=str(e))


@router.get("/{uuid}/maintenances", response_model=ToolMaintenanceListResponse)
async def list_tool_maintenances(
    uuid: str,
    skip: int = Query(0, ge=0),
    limit: int = Query(100, ge=1, le=1000),
    tenant_id: int = Depends(get_current_tenant)
):
    try:
        items, total = await ToolMaintenanceService.list_maintenances(tenant_id, uuid, skip, limit)
        return ToolMaintenanceListResponse(
            items=[ToolMaintenanceResponse.model_validate(i) for i in items],
            total=total,
            skip=skip,
            limit=limit
        )
    except NotFoundError as e:
        raise HTTPException(status_code=404, detail=str(e))


@router.get("/{uuid}/calibrations", response_model=ToolCalibrationListResponse)
async def list_tool_calibrations(
    uuid: str,
    skip: int = Query(0, ge=0),
    limit: int = Query(100, ge=1, le=1000),
    tenant_id: int = Depends(get_current_tenant)
):
    try:
        items, total = await ToolMaintenanceService.list_calibrations(tenant_id, uuid, skip, limit)
        return ToolCalibrationListResponse(
            items=[ToolCalibrationResponse.model_validate(i) for i in items],
            total=total,
            skip=skip,
            limit=limit
        )
    except NotFoundError as e:
        raise HTTPException(status_code=404, detail=str(e))


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


@router.delete("/{uuid}", status_code=status.HTTP_204_NO_CONTENT)
async def delete_tool(
    uuid: str,
    tenant_id: int = Depends(get_current_tenant)
):
    try:
        await ToolService.delete_tool(tenant_id, uuid)
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
