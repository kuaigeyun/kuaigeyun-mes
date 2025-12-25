"""
安全检查 API 模块

提供安全检查的 RESTful API 接口，支持多组织隔离。
"""

from fastapi import APIRouter, Depends, HTTPException, Query, status
from typing import List, Optional, Annotated

from core.api.deps.deps import get_current_user, get_current_tenant
from infra.models.user import User
from apps.kuaiehs.services.safety_inspection_service import SafetyInspectionService
from apps.kuaiehs.schemas.safety_inspection_schemas import (
    SafetyInspectionCreate, SafetyInspectionUpdate, SafetyInspectionResponse
)
from infra.exceptions.exceptions import NotFoundError, ValidationError

router = APIRouter(prefix="/safety-inspection", tags=["Safety Inspections"])


@router.post("", response_model=SafetyInspectionResponse, summary="创建安全检查")
async def create_safetyinspection(
    data: SafetyInspectionCreate,
    current_user: Annotated[User, Depends(get_current_user)],
    tenant_id: Annotated[int, Depends(get_current_tenant)]
):
    """创建安全检查"""
    try:
        return await SafetyInspectionService.create_safetyinspection(tenant_id, data)
    except ValidationError as e:
        raise HTTPException(status_code=status.HTTP_400_BAD_REQUEST, detail=str(e))


@router.get("", response_model=List[SafetyInspectionResponse], summary="获取安全检查列表")
async def list_safetyinspections(
    current_user: Annotated[User, Depends(get_current_user)],
    tenant_id: Annotated[int, Depends(get_current_tenant)],
    skip: int = Query(0, ge=0),
    limit: int = Query(100, ge=1, le=1000),
    status: Optional[str] = Query(None)
):
    """获取安全检查列表"""
    return await SafetyInspectionService.list_safetyinspections(tenant_id, skip, limit, status)


@router.get("/{obj_uuid}", response_model=SafetyInspectionResponse, summary="获取安全检查详情")
async def get_safetyinspection(
    obj_uuid: str,
    current_user: Annotated[User, Depends(get_current_user)],
    tenant_id: Annotated[int, Depends(get_current_tenant)]
):
    """获取安全检查详情"""
    try:
        return await SafetyInspectionService.get_safetyinspection_by_uuid(tenant_id, obj_uuid)
    except NotFoundError as e:
        raise HTTPException(status_code=status.HTTP_404_NOT_FOUND, detail=str(e))


@router.put("/{obj_uuid}", response_model=SafetyInspectionResponse, summary="更新安全检查")
async def update_safetyinspection(
    obj_uuid: str,
    data: SafetyInspectionUpdate,
    current_user: Annotated[User, Depends(get_current_user)],
    tenant_id: Annotated[int, Depends(get_current_tenant)]
):
    """更新安全检查"""
    try:
        return await SafetyInspectionService.update_safetyinspection(tenant_id, obj_uuid, data)
    except NotFoundError as e:
        raise HTTPException(status_code=status.HTTP_404_NOT_FOUND, detail=str(e))
    except ValidationError as e:
        raise HTTPException(status_code=status.HTTP_400_BAD_REQUEST, detail=str(e))


@router.delete("/{obj_uuid}", status_code=status.HTTP_204_NO_CONTENT, summary="删除安全检查")
async def delete_safetyinspection(
    obj_uuid: str,
    current_user: Annotated[User, Depends(get_current_user)],
    tenant_id: Annotated[int, Depends(get_current_tenant)]
):
    """删除安全检查（软删除）"""
    try:
        await SafetyInspectionService.delete_safetyinspection(tenant_id, obj_uuid)
    except NotFoundError as e:
        raise HTTPException(status_code=status.HTTP_404_NOT_FOUND, detail=str(e))
