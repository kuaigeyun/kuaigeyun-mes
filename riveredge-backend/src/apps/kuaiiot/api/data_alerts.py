"""
数据预警 API 模块

提供数据预警的 RESTful API 接口，支持多组织隔离。
"""

from fastapi import APIRouter, Depends, HTTPException, Query, status
from typing import List, Optional, Annotated

from core.api.deps.deps import get_current_user, get_current_tenant
from infra.models.user import User
from apps.kuaiiot.services.data_alert_service import DataAlertService
from apps.kuaiiot.schemas.data_alert_schemas import (
    DataAlertCreate, DataAlertUpdate, DataAlertResponse
)
from infra.exceptions.exceptions import NotFoundError, ValidationError

router = APIRouter(prefix="/data-alerts", tags=["数据预警"])


@router.post("", response_model=DataAlertResponse, summary="创建数据预警")
async def create_data_alert(
    data: DataAlertCreate,
    current_user: Annotated[User, Depends(get_current_user)],
    tenant_id: Annotated[int, Depends(get_current_tenant)]
):
    """创建数据预警"""
    try:
        return await DataAlertService.create_data_alert(tenant_id, data)
    except ValidationError as e:
        raise HTTPException(status_code=status.HTTP_400_BAD_REQUEST, detail=str(e))


@router.get("", response_model=List[DataAlertResponse], summary="获取数据预警列表")
async def list_data_alerts(
    current_user: Annotated[User, Depends(get_current_user)],
    tenant_id: Annotated[int, Depends(get_current_tenant)],
    skip: int = Query(0, ge=0),
    limit: int = Query(100, ge=1, le=1000),
    status: Optional[str] = Query(None)
):
    """获取数据预警列表"""
    return await DataAlertService.list_data_alerts(tenant_id, skip, limit, status)


@router.get("/{{obj_uuid}}", response_model=DataAlertResponse, summary="获取数据预警详情")
async def get_data_alert(
    obj_uuid: str,
    current_user: Annotated[User, Depends(get_current_user)],
    tenant_id: Annotated[int, Depends(get_current_tenant)]
):
    """获取数据预警详情"""
    try:
        return await DataAlertService.get_data_alert_by_uuid(tenant_id, obj_uuid)
    except NotFoundError as e:
        raise HTTPException(status_code=status.HTTP_404_NOT_FOUND, detail=str(e))


@router.put("/{{obj_uuid}}", response_model=DataAlertResponse, summary="更新数据预警")
async def update_data_alert(
    obj_uuid: str,
    data: DataAlertUpdate,
    current_user: Annotated[User, Depends(get_current_user)],
    tenant_id: Annotated[int, Depends(get_current_tenant)]
):
    """更新数据预警"""
    try:
        return await DataAlertService.update_data_alert(tenant_id, obj_uuid, data)
    except NotFoundError as e:
        raise HTTPException(status_code=status.HTTP_404_NOT_FOUND, detail=str(e))
    except ValidationError as e:
        raise HTTPException(status_code=status.HTTP_400_BAD_REQUEST, detail=str(e))


@router.delete("/{{obj_uuid}}", status_code=status.HTTP_204_NO_CONTENT, summary="删除数据预警")
async def delete_data_alert(
    obj_uuid: str,
    current_user: Annotated[User, Depends(get_current_user)],
    tenant_id: Annotated[int, Depends(get_current_tenant)]
):
    """删除数据预警"""
    try:
        await DataAlertService.delete_data_alert(tenant_id, obj_uuid)
    except NotFoundError as e:
        raise HTTPException(status_code=status.HTTP_404_NOT_FOUND, detail=str(e))
