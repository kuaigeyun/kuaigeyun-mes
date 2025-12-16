"""
传感器配置 API 模块

提供传感器配置的 RESTful API 接口，支持多组织隔离。
"""

from fastapi import APIRouter, Depends, HTTPException, Query, status
from typing import List, Optional, Annotated

from core.api.deps.deps import get_current_user, get_current_tenant
from infra.models.user import User
from apps.kuaiiot.services.sensor_configuration_service import SensorConfigurationService
from apps.kuaiiot.schemas.sensor_configuration_schemas import (
    SensorConfigurationCreate, SensorConfigurationUpdate, SensorConfigurationResponse
)
from infra.exceptions.exceptions import NotFoundError, ValidationError

router = APIRouter(prefix="/sensor-configurations", tags=["Sensor Configurations"])


@router.post("", response_model=SensorConfigurationResponse, summary="创建传感器配置")
async def create_sensor_configuration(
    data: SensorConfigurationCreate,
    current_user: Annotated[User, Depends(get_current_user)],
    tenant_id: Annotated[int, Depends(get_current_tenant)]
):
    """创建传感器配置"""
    try:
        return await SensorConfigurationService.create_sensor_configuration(tenant_id, data)
    except ValidationError as e:
        raise HTTPException(status_code=status.HTTP_400_BAD_REQUEST, detail=str(e))


@router.get("", response_model=List[SensorConfigurationResponse], summary="获取传感器配置列表")
async def list_sensor_configurations(
    current_user: Annotated[User, Depends(get_current_user)],
    tenant_id: Annotated[int, Depends(get_current_tenant)],
    skip: int = Query(0, ge=0),
    limit: int = Query(100, ge=1, le=1000),
    status: Optional[str] = Query(None)
):
    """获取传感器配置列表"""
    return await SensorConfigurationService.list_sensor_configurations(tenant_id, skip, limit, status)


@router.get("/{{obj_uuid}}", response_model=SensorConfigurationResponse, summary="获取传感器配置详情")
async def get_sensor_configuration(
    obj_uuid: str,
    current_user: Annotated[User, Depends(get_current_user)],
    tenant_id: Annotated[int, Depends(get_current_tenant)]
):
    """获取传感器配置详情"""
    try:
        return await SensorConfigurationService.get_sensor_configuration_by_uuid(tenant_id, obj_uuid)
    except NotFoundError as e:
        raise HTTPException(status_code=status.HTTP_404_NOT_FOUND, detail=str(e))


@router.put("/{{obj_uuid}}", response_model=SensorConfigurationResponse, summary="更新传感器配置")
async def update_sensor_configuration(
    obj_uuid: str,
    data: SensorConfigurationUpdate,
    current_user: Annotated[User, Depends(get_current_user)],
    tenant_id: Annotated[int, Depends(get_current_tenant)]
):
    """更新传感器配置"""
    try:
        return await SensorConfigurationService.update_sensor_configuration(tenant_id, obj_uuid, data)
    except NotFoundError as e:
        raise HTTPException(status_code=status.HTTP_404_NOT_FOUND, detail=str(e))
    except ValidationError as e:
        raise HTTPException(status_code=status.HTTP_400_BAD_REQUEST, detail=str(e))


@router.delete("/{{obj_uuid}}", status_code=status.HTTP_204_NO_CONTENT, summary="删除传感器配置")
async def delete_sensor_configuration(
    obj_uuid: str,
    current_user: Annotated[User, Depends(get_current_user)],
    tenant_id: Annotated[int, Depends(get_current_tenant)]
):
    """删除传感器配置"""
    try:
        await SensorConfigurationService.delete_sensor_configuration(tenant_id, obj_uuid)
    except NotFoundError as e:
        raise HTTPException(status_code=status.HTTP_404_NOT_FOUND, detail=str(e))
