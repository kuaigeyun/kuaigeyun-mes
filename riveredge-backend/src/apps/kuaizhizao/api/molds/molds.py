"""
模具管理 API 路由

提供模具和模具使用记录的 CRUD 操作。

Author: Luigi Lu
Date: 2026-01-05
"""

from typing import Optional
from fastapi import APIRouter, Depends, HTTPException, status, Query

from apps.kuaizhizao.models.mold import Mold, MoldUsage
from apps.kuaizhizao.schemas.mold import (
    MoldCreate,
    MoldUpdate,
    MoldResponse,
    MoldListResponse,
    MoldUsageCreate,
    MoldUsageUpdate,
    MoldUsageResponse,
    MoldUsageListResponse,
    MoldCalibrationCreate,
    MoldCalibrationResponse,
    MoldCalibrationListResponse,
    MoldMaintenanceReminderResponse,
    MoldMaintenanceReminderListResponse,
)
from apps.kuaizhizao.services.mold_service import MoldService, MoldUsageService, MoldCalibrationService, MoldMaintenanceReminderService
from core.api.deps.deps import get_current_tenant
from infra.api.deps.deps import get_current_user as soil_get_current_user
from infra.models.user import User
from infra.exceptions.exceptions import NotFoundError, ValidationError

router = APIRouter(prefix="/molds", tags=["Kuaige Zhizao Molds"])


# ========== 模具相关端点 ==========

@router.post("", response_model=MoldResponse, status_code=status.HTTP_201_CREATED)
async def create_mold(
    data: MoldCreate,
    current_user: User = Depends(soil_get_current_user),
    tenant_id: int = Depends(get_current_tenant),
):
    """
    创建模具
    
    创建新模具并保存到数据库。
    """
    try:
        mold = await MoldService.create_mold(
            tenant_id=tenant_id,
            data=data,
            created_by=current_user.id
        )
        return MoldResponse.model_validate(mold)
    except ValidationError as e:
        raise HTTPException(
            status_code=status.HTTP_422_UNPROCESSABLE_ENTITY,
            detail=str(e)
        )


@router.get("", response_model=MoldListResponse)
async def list_molds(
    skip: int = Query(0, ge=0, description="跳过数量"),
    limit: int = Query(100, ge=1, le=1000, description="限制数量"),
    type: Optional[str] = Query(None, description="模具类型（可选）"),
    status: Optional[str] = Query(None, description="模具状态（可选）"),
    is_active: Optional[bool] = Query(None, description="是否启用（可选）"),
    search: Optional[str] = Query(None, description="搜索关键词（可选）"),
    current_user: User = Depends(soil_get_current_user),
    tenant_id: int = Depends(get_current_tenant),
):
    """
    获取模具列表
    
    获取当前组织的模具列表，支持筛选和搜索。
    """
    molds, total = await MoldService.list_molds(
        tenant_id=tenant_id,
        skip=skip,
        limit=limit,
        type=type,
        status=status,
        is_active=is_active,
        search=search
    )
    
    items = [MoldResponse.model_validate(mold) for mold in molds]
    
    return MoldListResponse(
        items=items,
        total=total,
        skip=skip,
        limit=limit
    )


# ========== 模具校验记录相关端点 ==========


@router.get("/calibrations", response_model=MoldCalibrationListResponse)
async def list_mold_calibrations(
    mold_uuid: Optional[str] = Query(None, description="模具UUID（可选，不传则返回全量）"),
    skip: int = Query(0, ge=0, description="跳过数量"),
    limit: int = Query(100, ge=1, le=1000, description="限制数量"),
    current_user: User = Depends(soil_get_current_user),
    tenant_id: int = Depends(get_current_tenant),
):
    """
    获取模具校验记录列表（支持按模具筛选或全量）
    """
    if mold_uuid:
        try:
            items, total = await MoldCalibrationService.list_calibrations(
                tenant_id=tenant_id,
                mold_uuid=mold_uuid,
                skip=skip,
                limit=limit,
            )
        except NotFoundError as e:
            raise HTTPException(status_code=status.HTTP_404_NOT_FOUND, detail=str(e))
    else:
        items, total = await MoldCalibrationService.list_all_calibrations(
            tenant_id=tenant_id,
            mold_uuid=None,
            skip=skip,
            limit=limit,
        )
    mold_ids = {c.mold_id for c in items}
    molds = {m.id: m for m in await Mold.filter(id__in=mold_ids)}
    resp_items = []
    for c in items:
        m = molds.get(c.mold_id)
        d = MoldCalibrationResponse(
            uuid=c.uuid,
            id=c.id,
            mold_uuid=c.mold_uuid,
            mold_code=m.code if m else None,
            mold_name=m.name if m else None,
            calibration_date=c.calibration_date,
            result=c.result,
            certificate_no=c.certificate_no,
            expiry_date=c.expiry_date,
            remark=c.remark,
            created_at=c.created_at,
        )
        resp_items.append(d)
    return MoldCalibrationListResponse(
        items=resp_items,
        total=total,
        skip=skip,
        limit=limit,
    )


@router.get("/maintenance-reminders", response_model=MoldMaintenanceReminderListResponse)
async def list_mold_maintenance_reminders(
    skip: int = Query(0, ge=0, description="跳过数量"),
    limit: int = Query(100, ge=1, le=1000, description="限制数量"),
    reminder_type: Optional[str] = Query(None, description="提醒类型（due_soon/overdue）"),
    current_user: User = Depends(soil_get_current_user),
    tenant_id: int = Depends(get_current_tenant),
):
    """
    获取模具保养提醒列表（基于使用次数）
    """
    items, total = await MoldMaintenanceReminderService.list_reminders(
        tenant_id=tenant_id,
        skip=skip,
        limit=limit,
        reminder_type=reminder_type,
    )
    return MoldMaintenanceReminderListResponse(
        items=[MoldMaintenanceReminderResponse.model_validate(i) for i in items],
        total=total,
        skip=skip,
        limit=limit,
    )


@router.post("/calibrations", response_model=MoldCalibrationResponse, status_code=status.HTTP_201_CREATED)
async def create_mold_calibration(
    data: MoldCalibrationCreate,
    current_user: User = Depends(soil_get_current_user),
    tenant_id: int = Depends(get_current_tenant),
):
    """
    创建模具校验记录
    """
    try:
        calib = await MoldCalibrationService.create_calibration(
            tenant_id=tenant_id,
            data=data,
        )
        return MoldCalibrationResponse.model_validate(calib)
    except NotFoundError as e:
        raise HTTPException(
            status_code=status.HTTP_404_NOT_FOUND,
            detail=str(e),
        )
    except ValidationError as e:
        raise HTTPException(
            status_code=status.HTTP_422_UNPROCESSABLE_ENTITY,
            detail=str(e),
        )


@router.get("/{uuid}", response_model=MoldResponse)
async def get_mold(
    uuid: str,
    current_user: User = Depends(soil_get_current_user),
    tenant_id: int = Depends(get_current_tenant),
):
    """
    获取模具详情
    
    根据UUID获取模具详情。
    """
    try:
        mold = await MoldService.get_mold_by_uuid(tenant_id, uuid)
        return MoldResponse.model_validate(mold)
    except NotFoundError as e:
        raise HTTPException(
            status_code=status.HTTP_404_NOT_FOUND,
            detail=str(e)
        )


@router.put("/{uuid}", response_model=MoldResponse)
async def update_mold(
    uuid: str,
    data: MoldUpdate,
    current_user: User = Depends(soil_get_current_user),
    tenant_id: int = Depends(get_current_tenant),
):
    """
    更新模具
    
    更新模具信息。
    """
    try:
        mold = await MoldService.update_mold(
            tenant_id=tenant_id,
            uuid=uuid,
            data=data
        )
        return MoldResponse.model_validate(mold)
    except NotFoundError as e:
        raise HTTPException(
            status_code=status.HTTP_404_NOT_FOUND,
            detail=str(e)
        )
    except ValidationError as e:
        raise HTTPException(
            status_code=status.HTTP_422_UNPROCESSABLE_ENTITY,
            detail=str(e)
        )


@router.delete("/{uuid}", status_code=status.HTTP_204_NO_CONTENT)
async def delete_mold(
    uuid: str,
    current_user: User = Depends(soil_get_current_user),
    tenant_id: int = Depends(get_current_tenant),
):
    """
    删除模具
    
    软删除模具（标记为已删除，不实际删除数据）。
    """
    try:
        await MoldService.delete_mold(tenant_id, uuid)
    except NotFoundError as e:
        raise HTTPException(
            status_code=status.HTTP_404_NOT_FOUND,
            detail=str(e)
        )


# ========== 模具使用记录相关端点 ==========

@router.post("/usages", response_model=MoldUsageResponse, status_code=status.HTTP_201_CREATED)
async def create_mold_usage(
    data: MoldUsageCreate,
    current_user: User = Depends(soil_get_current_user),
    tenant_id: int = Depends(get_current_tenant),
):
    """
    创建模具使用记录
    
    创建新模具使用记录并保存到数据库。
    """
    try:
        usage = await MoldUsageService.create_mold_usage(
            tenant_id=tenant_id,
            data=data,
            created_by=current_user.id
        )
        return MoldUsageResponse.model_validate(usage)
    except ValidationError as e:
        raise HTTPException(
            status_code=status.HTTP_422_UNPROCESSABLE_ENTITY,
            detail=str(e)
        )


@router.get("/usages", response_model=MoldUsageListResponse)
async def list_mold_usages(
    skip: int = Query(0, ge=0, description="跳过数量"),
    limit: int = Query(100, ge=1, le=1000, description="限制数量"),
    mold_uuid: Optional[str] = Query(None, description="模具UUID（可选）"),
    source_type: Optional[str] = Query(None, description="来源类型（可选）"),
    status: Optional[str] = Query(None, description="使用状态（可选）"),
    search: Optional[str] = Query(None, description="搜索关键词（可选）"),
    current_user: User = Depends(soil_get_current_user),
    tenant_id: int = Depends(get_current_tenant),
):
    """
    获取模具使用记录列表
    
    获取当前组织的模具使用记录列表，支持筛选和搜索。
    """
    usages, total = await MoldUsageService.list_mold_usages(
        tenant_id=tenant_id,
        skip=skip,
        limit=limit,
        mold_uuid=mold_uuid,
        source_type=source_type,
        status=status,
        search=search
    )
    
    items = [MoldUsageResponse.model_validate(usage) for usage in usages]
    
    return MoldUsageListResponse(
        items=items,
        total=total,
        skip=skip,
        limit=limit
    )


@router.get("/usages/{uuid}", response_model=MoldUsageResponse)
async def get_mold_usage(
    uuid: str,
    current_user: User = Depends(soil_get_current_user),
    tenant_id: int = Depends(get_current_tenant),
):
    """
    获取模具使用记录详情
    
    根据UUID获取模具使用记录详情。
    """
    try:
        usage = await MoldUsageService.get_mold_usage_by_uuid(tenant_id, uuid)
        return MoldUsageResponse.model_validate(usage)
    except NotFoundError as e:
        raise HTTPException(
            status_code=status.HTTP_404_NOT_FOUND,
            detail=str(e)
        )


@router.put("/usages/{uuid}", response_model=MoldUsageResponse)
async def update_mold_usage(
    uuid: str,
    data: MoldUsageUpdate,
    current_user: User = Depends(soil_get_current_user),
    tenant_id: int = Depends(get_current_tenant),
):
    """
    更新模具使用记录
    
    更新模具使用记录信息。
    """
    try:
        usage = await MoldUsageService.update_mold_usage(
            tenant_id=tenant_id,
            uuid=uuid,
            data=data
        )
        return MoldUsageResponse.model_validate(usage)
    except NotFoundError as e:
        raise HTTPException(
            status_code=status.HTTP_404_NOT_FOUND,
            detail=str(e)
        )


@router.delete("/usages/{uuid}", status_code=status.HTTP_204_NO_CONTENT)
async def delete_mold_usage(
    uuid: str,
    current_user: User = Depends(soil_get_current_user),
    tenant_id: int = Depends(get_current_tenant),
):
    """
    删除模具使用记录
    
    软删除模具使用记录（标记为已删除，不实际删除数据）。
    """
    try:
        await MoldUsageService.delete_mold_usage(tenant_id, uuid)
    except NotFoundError as e:
        raise HTTPException(
            status_code=status.HTTP_404_NOT_FOUND,
            detail=str(e)
        )

