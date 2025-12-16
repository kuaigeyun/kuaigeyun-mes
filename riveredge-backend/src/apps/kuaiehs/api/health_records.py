"""
健康档案 API 模块

提供健康档案的 RESTful API 接口，支持多组织隔离。
"""

from fastapi import APIRouter, Depends, HTTPException, Query, status
from typing import List, Optional, Annotated

from core.api.deps.deps import get_current_user, get_current_tenant
from infra.models.user import User
from apps.kuaiehs.services.health_record_service import HealthRecordService
from apps.kuaiehs.schemas.health_record_schemas import (
    HealthRecordCreate, HealthRecordUpdate, HealthRecordResponse
)
from infra.exceptions.exceptions import NotFoundError, ValidationError

router = APIRouter(prefix="/health-record", tags=["健康档案"])


@router.post("", response_model=HealthRecordResponse, summary="创建健康档案")
async def create_healthrecord(
    data: HealthRecordCreate,
    current_user: Annotated[User, Depends(get_current_user)],
    tenant_id: Annotated[int, Depends(get_current_tenant)]
):
    """创建健康档案"""
    try:
        return await HealthRecordService.create_healthrecord(tenant_id, data)
    except ValidationError as e:
        raise HTTPException(status_code=status.HTTP_400_BAD_REQUEST, detail=str(e))


@router.get("", response_model=List[HealthRecordResponse], summary="获取健康档案列表")
async def list_healthrecords(
    current_user: Annotated[User, Depends(get_current_user)],
    tenant_id: Annotated[int, Depends(get_current_tenant)],
    skip: int = Query(0, ge=0),
    limit: int = Query(100, ge=1, le=1000),
    status: Optional[str] = Query(None)
):
    """获取健康档案列表"""
    return await HealthRecordService.list_healthrecords(tenant_id, skip, limit, status)


@router.get("/{obj_uuid}", response_model=HealthRecordResponse, summary="获取健康档案详情")
async def get_healthrecord(
    obj_uuid: str,
    current_user: Annotated[User, Depends(get_current_user)],
    tenant_id: Annotated[int, Depends(get_current_tenant)]
):
    """获取健康档案详情"""
    try:
        return await HealthRecordService.get_healthrecord_by_uuid(tenant_id, obj_uuid)
    except NotFoundError as e:
        raise HTTPException(status_code=status.HTTP_404_NOT_FOUND, detail=str(e))


@router.put("/{obj_uuid}", response_model=HealthRecordResponse, summary="更新健康档案")
async def update_healthrecord(
    obj_uuid: str,
    data: HealthRecordUpdate,
    current_user: Annotated[User, Depends(get_current_user)],
    tenant_id: Annotated[int, Depends(get_current_tenant)]
):
    """更新健康档案"""
    try:
        return await HealthRecordService.update_healthrecord(tenant_id, obj_uuid, data)
    except NotFoundError as e:
        raise HTTPException(status_code=status.HTTP_404_NOT_FOUND, detail=str(e))
    except ValidationError as e:
        raise HTTPException(status_code=status.HTTP_400_BAD_REQUEST, detail=str(e))


@router.delete("/{obj_uuid}", status_code=status.HTTP_204_NO_CONTENT, summary="删除健康档案")
async def delete_healthrecord(
    obj_uuid: str,
    current_user: Annotated[User, Depends(get_current_user)],
    tenant_id: Annotated[int, Depends(get_current_tenant)]
):
    """删除健康档案（软删除）"""
    try:
        await HealthRecordService.delete_healthrecord(tenant_id, obj_uuid)
    except NotFoundError as e:
        raise HTTPException(status_code=status.HTTP_404_NOT_FOUND, detail=str(e))
