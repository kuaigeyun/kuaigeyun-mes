"""
职业健康检查 API 模块

提供职业健康检查的 RESTful API 接口，支持多组织隔离。
"""

from fastapi import APIRouter, Depends, HTTPException, Query, status
from typing import List, Optional, Annotated

from core.api.deps.deps import get_current_user, get_current_tenant
from infra.models.user import User
from apps.kuaiehs.services.occupational_health_check_service import OccupationalHealthCheckService
from apps.kuaiehs.schemas.occupational_health_check_schemas import (
    OccupationalHealthCheckCreate, OccupationalHealthCheckUpdate, OccupationalHealthCheckResponse
)
from infra.exceptions.exceptions import NotFoundError, ValidationError

router = APIRouter(prefix="/occupational-health-check", tags=["职业健康检查"])


@router.post("", response_model=OccupationalHealthCheckResponse, summary="创建职业健康检查")
async def create_occupationalhealthcheck(
    data: OccupationalHealthCheckCreate,
    current_user: Annotated[User, Depends(get_current_user)],
    tenant_id: Annotated[int, Depends(get_current_tenant)]
):
    """创建职业健康检查"""
    try:
        return await OccupationalHealthCheckService.create_occupationalhealthcheck(tenant_id, data)
    except ValidationError as e:
        raise HTTPException(status_code=status.HTTP_400_BAD_REQUEST, detail=str(e))


@router.get("", response_model=List[OccupationalHealthCheckResponse], summary="获取职业健康检查列表")
async def list_occupationalhealthchecks(
    current_user: Annotated[User, Depends(get_current_user)],
    tenant_id: Annotated[int, Depends(get_current_tenant)],
    skip: int = Query(0, ge=0),
    limit: int = Query(100, ge=1, le=1000),
    status: Optional[str] = Query(None)
):
    """获取职业健康检查列表"""
    return await OccupationalHealthCheckService.list_occupationalhealthchecks(tenant_id, skip, limit, status)


@router.get("/{obj_uuid}", response_model=OccupationalHealthCheckResponse, summary="获取职业健康检查详情")
async def get_occupationalhealthcheck(
    obj_uuid: str,
    current_user: Annotated[User, Depends(get_current_user)],
    tenant_id: Annotated[int, Depends(get_current_tenant)]
):
    """获取职业健康检查详情"""
    try:
        return await OccupationalHealthCheckService.get_occupationalhealthcheck_by_uuid(tenant_id, obj_uuid)
    except NotFoundError as e:
        raise HTTPException(status_code=status.HTTP_404_NOT_FOUND, detail=str(e))


@router.put("/{obj_uuid}", response_model=OccupationalHealthCheckResponse, summary="更新职业健康检查")
async def update_occupationalhealthcheck(
    obj_uuid: str,
    data: OccupationalHealthCheckUpdate,
    current_user: Annotated[User, Depends(get_current_user)],
    tenant_id: Annotated[int, Depends(get_current_tenant)]
):
    """更新职业健康检查"""
    try:
        return await OccupationalHealthCheckService.update_occupationalhealthcheck(tenant_id, obj_uuid, data)
    except NotFoundError as e:
        raise HTTPException(status_code=status.HTTP_404_NOT_FOUND, detail=str(e))
    except ValidationError as e:
        raise HTTPException(status_code=status.HTTP_400_BAD_REQUEST, detail=str(e))


@router.delete("/{obj_uuid}", status_code=status.HTTP_204_NO_CONTENT, summary="删除职业健康检查")
async def delete_occupationalhealthcheck(
    obj_uuid: str,
    current_user: Annotated[User, Depends(get_current_user)],
    tenant_id: Annotated[int, Depends(get_current_tenant)]
):
    """删除职业健康检查（软删除）"""
    try:
        await OccupationalHealthCheckService.delete_occupationalhealthcheck(tenant_id, obj_uuid)
    except NotFoundError as e:
        raise HTTPException(status_code=status.HTTP_404_NOT_FOUND, detail=str(e))
