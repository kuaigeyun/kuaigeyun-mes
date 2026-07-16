"""
模具管理 API 路由

提供模具 CRUD 与校验/保养提醒等操作；领用/归还见 mold_ops API。

Author: Luigi Lu
Date: 2026-01-05
"""

import uuid
from typing import Any, Optional
from fastapi import APIRouter, Depends, HTTPException as FastAPIHTTPException, status, Query
from loguru import logger

from apps.kuaizhizao.models.mold import Mold
from apps.kuaizhizao.schemas.mold import (
    MoldCreate,
    MoldUpdate,
    MoldResponse,
    MoldListResponse,
    MoldCalibrationCreate,
    MoldCalibrationResponse,
    MoldCalibrationListResponse,
    MoldMaintenanceReminderResponse,
    MoldMaintenanceReminderListResponse,
)
from apps.kuaizhizao.services.mold_service import MoldService, MoldCalibrationService, MoldMaintenanceReminderService
from core.api.deps.access import require_permission_codes
from core.api.deps.deps import get_current_tenant
from infra.api.deps.deps import get_current_user as soil_get_current_user
from infra.models.user import User
from infra.exceptions.exceptions import NotFoundError, ValidationError

router = APIRouter(prefix="/molds", tags=["App - Kuaige Zhizao - Molds"])


def _http_exception_with_trace(
    status_code: int,
    message: str,
    route: str = "/molds",
    tenant_id: Optional[int] = None,
) -> FastAPIHTTPException:
    trace_id = uuid.uuid4().hex
    logger.warning(
        "kuaizhizao_molds_api_error trace_id={} tenant_id={} route={} status_code={} message={}",
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


# ========== 模具相关端点 ==========

@router.post(
    "",
    response_model=MoldResponse,
    status_code=status.HTTP_201_CREATED,
    dependencies=[Depends(require_permission_codes("kuaizhizao:equipment-management-molds:create"))],
)
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


@router.get(
    "",
    response_model=MoldListResponse,
    dependencies=[Depends(require_permission_codes("kuaizhizao:equipment-management-molds:read"))],
)
async def list_molds(
    skip: int = Query(0, ge=0, description="跳过数量"),
    limit: int = Query(100, ge=1, le=1000, description="限制数量"),
    type: Optional[str] = Query(None, description="模具类型（可选）"),
    status: Optional[str] = Query(None, description="模具状态（可选）"),
    is_active: Optional[bool] = Query(None, description="是否启用（可选）"),
    search: Optional[str] = Query(None, description="搜索关键词（可选）"),
    keyword: Optional[str] = Query(None, description="模糊搜索"),
    order_by: Optional[str] = Query(None, description="排序字段"),
    created_start_date: Optional[str] = Query(None, description="创建日期起"),
    created_end_date: Optional[str] = Query(None, description="创建日期止"),
    updated_start_date: Optional[str] = Query(None, description="更新日期起"),
    updated_end_date: Optional[str] = Query(None, description="更新日期止"),
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
    ,
        keyword=keyword,
        order_by=order_by,
        created_start_date=created_start_date,
        created_end_date=created_end_date,
        updated_start_date=updated_start_date,
        updated_end_date=updated_end_date,
    )
    
    items = [MoldResponse.model_validate(mold) for mold in molds]
    
    return MoldListResponse(
        items=items,
        total=total,
        skip=skip,
        limit=limit
    )


# ========== 模具校验记录相关端点 ==========


@router.get(
    "/calibrations",
    response_model=MoldCalibrationListResponse,
    dependencies=[Depends(require_permission_codes("kuaizhizao:mold-calibration:read"))],
)
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


@router.get(
    "/maintenance-reminders",
    response_model=MoldMaintenanceReminderListResponse,
    dependencies=[Depends(require_permission_codes("kuaizhizao:mold-maintenance-reminder:read"))],
)
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


@router.post(
    "/calibrations",
    response_model=MoldCalibrationResponse,
    status_code=status.HTTP_201_CREATED,
    dependencies=[Depends(require_permission_codes("kuaizhizao:mold-calibration:create"))],
)
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
            current_user=current_user,
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


@router.get(
    "/{uuid}",
    response_model=MoldResponse,
    dependencies=[Depends(require_permission_codes("kuaizhizao:equipment-management-molds:read"))],
)
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


@router.put(
    "/{uuid}",
    response_model=MoldResponse,
    dependencies=[Depends(require_permission_codes("kuaizhizao:equipment-management-molds:update"))],
)
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


@router.delete(
    "/{uuid}",
    status_code=status.HTTP_204_NO_CONTENT,
    dependencies=[Depends(require_permission_codes("kuaizhizao:equipment-management-molds:delete"))],
)
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

