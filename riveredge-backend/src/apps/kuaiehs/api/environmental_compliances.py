"""
环保合规 API 模块

提供环保合规的 RESTful API 接口，支持多组织隔离。
"""

from fastapi import APIRouter, Depends, HTTPException, Query, status
from typing import List, Optional, Annotated

from core.api.deps.deps import get_current_user, get_current_tenant
from infra.models.user import User
from apps.kuaiehs.services.environmental_compliance_service import EnvironmentalComplianceService
from apps.kuaiehs.schemas.environmental_compliance_schemas import (
    EnvironmentalComplianceCreate, EnvironmentalComplianceUpdate, EnvironmentalComplianceResponse
)
from infra.exceptions.exceptions import NotFoundError, ValidationError

router = APIRouter(prefix="/environmental-compliance", tags=["Environmental Compliance"])


@router.post("", response_model=EnvironmentalComplianceResponse, summary="创建环保合规")
async def create_environmentalcompliance(
    data: EnvironmentalComplianceCreate,
    current_user: Annotated[User, Depends(get_current_user)],
    tenant_id: Annotated[int, Depends(get_current_tenant)]
):
    """创建环保合规"""
    try:
        return await EnvironmentalComplianceService.create_environmentalcompliance(tenant_id, data)
    except ValidationError as e:
        raise HTTPException(status_code=status.HTTP_400_BAD_REQUEST, detail=str(e))


@router.get("", response_model=List[EnvironmentalComplianceResponse], summary="获取环保合规列表")
async def list_environmentalcompliances(
    current_user: Annotated[User, Depends(get_current_user)],
    tenant_id: Annotated[int, Depends(get_current_tenant)],
    skip: int = Query(0, ge=0),
    limit: int = Query(100, ge=1, le=1000),
    status: Optional[str] = Query(None)
):
    """获取环保合规列表"""
    return await EnvironmentalComplianceService.list_environmentalcompliances(tenant_id, skip, limit, status)


@router.get("/{obj_uuid}", response_model=EnvironmentalComplianceResponse, summary="获取环保合规详情")
async def get_environmentalcompliance(
    obj_uuid: str,
    current_user: Annotated[User, Depends(get_current_user)],
    tenant_id: Annotated[int, Depends(get_current_tenant)]
):
    """获取环保合规详情"""
    try:
        return await EnvironmentalComplianceService.get_environmentalcompliance_by_uuid(tenant_id, obj_uuid)
    except NotFoundError as e:
        raise HTTPException(status_code=status.HTTP_404_NOT_FOUND, detail=str(e))


@router.put("/{obj_uuid}", response_model=EnvironmentalComplianceResponse, summary="更新环保合规")
async def update_environmentalcompliance(
    obj_uuid: str,
    data: EnvironmentalComplianceUpdate,
    current_user: Annotated[User, Depends(get_current_user)],
    tenant_id: Annotated[int, Depends(get_current_tenant)]
):
    """更新环保合规"""
    try:
        return await EnvironmentalComplianceService.update_environmentalcompliance(tenant_id, obj_uuid, data)
    except NotFoundError as e:
        raise HTTPException(status_code=status.HTTP_404_NOT_FOUND, detail=str(e))
    except ValidationError as e:
        raise HTTPException(status_code=status.HTTP_400_BAD_REQUEST, detail=str(e))


@router.delete("/{obj_uuid}", status_code=status.HTTP_204_NO_CONTENT, summary="删除环保合规")
async def delete_environmentalcompliance(
    obj_uuid: str,
    current_user: Annotated[User, Depends(get_current_user)],
    tenant_id: Annotated[int, Depends(get_current_tenant)]
):
    """删除环保合规（软删除）"""
    try:
        await EnvironmentalComplianceService.delete_environmentalcompliance(tenant_id, obj_uuid)
    except NotFoundError as e:
        raise HTTPException(status_code=status.HTTP_404_NOT_FOUND, detail=str(e))
