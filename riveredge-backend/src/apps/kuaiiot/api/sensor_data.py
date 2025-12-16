"""
传感器数据 API 模块

提供传感器数据的 RESTful API 接口，支持多组织隔离。
"""

from fastapi import APIRouter, Depends, HTTPException, Query, status
from typing import List, Optional, Annotated

from core.api.deps.deps import get_current_user, get_current_tenant
from infra.models.user import User
from apps.kuaiiot.services.sensor_data_service import SensorDataService
from apps.kuaiiot.schemas.sensor_data_schemas import (
    SensorDataCreate, SensorDataUpdate, SensorDataResponse
)
from infra.exceptions.exceptions import NotFoundError, ValidationError

router = APIRouter(prefix="/sensor-data", tags=["传感器数据"])


@router.post("", response_model=SensorDataResponse, summary="创建传感器数据")
async def create_sensor_data(
    data: SensorDataCreate,
    current_user: Annotated[User, Depends(get_current_user)],
    tenant_id: Annotated[int, Depends(get_current_tenant)]
):
    """创建传感器数据"""
    try:
        return await SensorDataService.create_sensor_data(tenant_id, data)
    except ValidationError as e:
        raise HTTPException(status_code=status.HTTP_400_BAD_REQUEST, detail=str(e))


@router.get("", response_model=List[SensorDataResponse], summary="获取传感器数据列表")
async def list_sensor_datas(
    current_user: Annotated[User, Depends(get_current_user)],
    tenant_id: Annotated[int, Depends(get_current_tenant)],
    skip: int = Query(0, ge=0),
    limit: int = Query(100, ge=1, le=1000),
    status: Optional[str] = Query(None)
):
    """获取传感器数据列表"""
    return await SensorDataService.list_sensor_datas(tenant_id, skip, limit, status)


@router.get("/{{obj_uuid}}", response_model=SensorDataResponse, summary="获取传感器数据详情")
async def get_sensor_data(
    obj_uuid: str,
    current_user: Annotated[User, Depends(get_current_user)],
    tenant_id: Annotated[int, Depends(get_current_tenant)]
):
    """获取传感器数据详情"""
    try:
        return await SensorDataService.get_sensor_data_by_uuid(tenant_id, obj_uuid)
    except NotFoundError as e:
        raise HTTPException(status_code=status.HTTP_404_NOT_FOUND, detail=str(e))


@router.put("/{{obj_uuid}}", response_model=SensorDataResponse, summary="更新传感器数据")
async def update_sensor_data(
    obj_uuid: str,
    data: SensorDataUpdate,
    current_user: Annotated[User, Depends(get_current_user)],
    tenant_id: Annotated[int, Depends(get_current_tenant)]
):
    """更新传感器数据"""
    try:
        return await SensorDataService.update_sensor_data(tenant_id, obj_uuid, data)
    except NotFoundError as e:
        raise HTTPException(status_code=status.HTTP_404_NOT_FOUND, detail=str(e))
    except ValidationError as e:
        raise HTTPException(status_code=status.HTTP_400_BAD_REQUEST, detail=str(e))


@router.delete("/{{obj_uuid}}", status_code=status.HTTP_204_NO_CONTENT, summary="删除传感器数据")
async def delete_sensor_data(
    obj_uuid: str,
    current_user: Annotated[User, Depends(get_current_user)],
    tenant_id: Annotated[int, Depends(get_current_tenant)]
):
    """删除传感器数据"""
    try:
        await SensorDataService.delete_sensor_data(tenant_id, obj_uuid)
    except NotFoundError as e:
        raise HTTPException(status_code=status.HTTP_404_NOT_FOUND, detail=str(e))
