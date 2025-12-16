"""
职业病 API 模块

提供职业病的 RESTful API 接口，支持多组织隔离。
"""

from fastapi import APIRouter, Depends, HTTPException, Query, status
from typing import List, Optional, Annotated

from core.api.deps.deps import get_current_user, get_current_tenant
from infra.models.user import User
from apps.kuaiehs.services.occupational_disease_service import OccupationalDiseaseService
from apps.kuaiehs.schemas.occupational_disease_schemas import (
    OccupationalDiseaseCreate, OccupationalDiseaseUpdate, OccupationalDiseaseResponse
)
from infra.exceptions.exceptions import NotFoundError, ValidationError

router = APIRouter(prefix="/occupational-disease", tags=["职业病"])


@router.post("", response_model=OccupationalDiseaseResponse, summary="创建职业病")
async def create_occupationaldisease(
    data: OccupationalDiseaseCreate,
    current_user: Annotated[User, Depends(get_current_user)],
    tenant_id: Annotated[int, Depends(get_current_tenant)]
):
    """创建职业病"""
    try:
        return await OccupationalDiseaseService.create_occupationaldisease(tenant_id, data)
    except ValidationError as e:
        raise HTTPException(status_code=status.HTTP_400_BAD_REQUEST, detail=str(e))


@router.get("", response_model=List[OccupationalDiseaseResponse], summary="获取职业病列表")
async def list_occupationaldiseases(
    current_user: Annotated[User, Depends(get_current_user)],
    tenant_id: Annotated[int, Depends(get_current_tenant)],
    skip: int = Query(0, ge=0),
    limit: int = Query(100, ge=1, le=1000),
    status: Optional[str] = Query(None)
):
    """获取职业病列表"""
    return await OccupationalDiseaseService.list_occupationaldiseases(tenant_id, skip, limit, status)


@router.get("/{obj_uuid}", response_model=OccupationalDiseaseResponse, summary="获取职业病详情")
async def get_occupationaldisease(
    obj_uuid: str,
    current_user: Annotated[User, Depends(get_current_user)],
    tenant_id: Annotated[int, Depends(get_current_tenant)]
):
    """获取职业病详情"""
    try:
        return await OccupationalDiseaseService.get_occupationaldisease_by_uuid(tenant_id, obj_uuid)
    except NotFoundError as e:
        raise HTTPException(status_code=status.HTTP_404_NOT_FOUND, detail=str(e))


@router.put("/{obj_uuid}", response_model=OccupationalDiseaseResponse, summary="更新职业病")
async def update_occupationaldisease(
    obj_uuid: str,
    data: OccupationalDiseaseUpdate,
    current_user: Annotated[User, Depends(get_current_user)],
    tenant_id: Annotated[int, Depends(get_current_tenant)]
):
    """更新职业病"""
    try:
        return await OccupationalDiseaseService.update_occupationaldisease(tenant_id, obj_uuid, data)
    except NotFoundError as e:
        raise HTTPException(status_code=status.HTTP_404_NOT_FOUND, detail=str(e))
    except ValidationError as e:
        raise HTTPException(status_code=status.HTTP_400_BAD_REQUEST, detail=str(e))


@router.delete("/{obj_uuid}", status_code=status.HTTP_204_NO_CONTENT, summary="删除职业病")
async def delete_occupationaldisease(
    obj_uuid: str,
    current_user: Annotated[User, Depends(get_current_user)],
    tenant_id: Annotated[int, Depends(get_current_tenant)]
):
    """删除职业病（软删除）"""
    try:
        await OccupationalDiseaseService.delete_occupationaldisease(tenant_id, obj_uuid)
    except NotFoundError as e:
        raise HTTPException(status_code=status.HTTP_404_NOT_FOUND, detail=str(e))
