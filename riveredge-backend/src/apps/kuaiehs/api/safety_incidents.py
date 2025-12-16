"""
安全事故 API 模块

提供安全事故的 RESTful API 接口，支持多组织隔离。
"""

from fastapi import APIRouter, Depends, HTTPException, Query, status
from typing import List, Optional, Annotated

from core.api.deps.deps import get_current_user, get_current_tenant
from infra.models.user import User
from apps.kuaiehs.services.safety_incident_service import SafetyIncidentService
from apps.kuaiehs.schemas.safety_incident_schemas import (
    SafetyIncidentCreate, SafetyIncidentUpdate, SafetyIncidentResponse
)
from infra.exceptions.exceptions import NotFoundError, ValidationError

router = APIRouter(prefix="/safety-incident", tags=["安全事故"])


@router.post("", response_model=SafetyIncidentResponse, summary="创建安全事故")
async def create_safetyincident(
    data: SafetyIncidentCreate,
    current_user: Annotated[User, Depends(get_current_user)],
    tenant_id: Annotated[int, Depends(get_current_tenant)]
):
    """创建安全事故"""
    try:
        return await SafetyIncidentService.create_safetyincident(tenant_id, data)
    except ValidationError as e:
        raise HTTPException(status_code=status.HTTP_400_BAD_REQUEST, detail=str(e))


@router.get("", response_model=List[SafetyIncidentResponse], summary="获取安全事故列表")
async def list_safetyincidents(
    current_user: Annotated[User, Depends(get_current_user)],
    tenant_id: Annotated[int, Depends(get_current_tenant)],
    skip: int = Query(0, ge=0),
    limit: int = Query(100, ge=1, le=1000),
    status: Optional[str] = Query(None)
):
    """获取安全事故列表"""
    return await SafetyIncidentService.list_safetyincidents(tenant_id, skip, limit, status)


@router.get("/{obj_uuid}", response_model=SafetyIncidentResponse, summary="获取安全事故详情")
async def get_safetyincident(
    obj_uuid: str,
    current_user: Annotated[User, Depends(get_current_user)],
    tenant_id: Annotated[int, Depends(get_current_tenant)]
):
    """获取安全事故详情"""
    try:
        return await SafetyIncidentService.get_safetyincident_by_uuid(tenant_id, obj_uuid)
    except NotFoundError as e:
        raise HTTPException(status_code=status.HTTP_404_NOT_FOUND, detail=str(e))


@router.put("/{obj_uuid}", response_model=SafetyIncidentResponse, summary="更新安全事故")
async def update_safetyincident(
    obj_uuid: str,
    data: SafetyIncidentUpdate,
    current_user: Annotated[User, Depends(get_current_user)],
    tenant_id: Annotated[int, Depends(get_current_tenant)]
):
    """更新安全事故"""
    try:
        return await SafetyIncidentService.update_safetyincident(tenant_id, obj_uuid, data)
    except NotFoundError as e:
        raise HTTPException(status_code=status.HTTP_404_NOT_FOUND, detail=str(e))
    except ValidationError as e:
        raise HTTPException(status_code=status.HTTP_400_BAD_REQUEST, detail=str(e))


@router.delete("/{obj_uuid}", status_code=status.HTTP_204_NO_CONTENT, summary="删除安全事故")
async def delete_safetyincident(
    obj_uuid: str,
    current_user: Annotated[User, Depends(get_current_user)],
    tenant_id: Annotated[int, Depends(get_current_tenant)]
):
    """删除安全事故（软删除）"""
    try:
        await SafetyIncidentService.delete_safetyincident(tenant_id, obj_uuid)
    except NotFoundError as e:
        raise HTTPException(status_code=status.HTTP_404_NOT_FOUND, detail=str(e))
