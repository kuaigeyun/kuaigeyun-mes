"""
认证类型 API 模块

提供认证类型的 RESTful API 接口，支持多组织隔离。
"""

from fastapi import APIRouter, Depends, HTTPException, Query, status
from typing import List, Optional, Annotated

from core.api.deps.deps import get_current_user, get_current_tenant
from infra.models.user import User
from apps.kuaicert.services.certification_type_service import CertificationTypeService
from apps.kuaicert.schemas.certification_type_schemas import (
    CertificationTypeCreate, CertificationTypeUpdate, CertificationTypeResponse
)
from infra.exceptions.exceptions import NotFoundError, ValidationError

router = APIRouter(prefix="/certification-type", tags=["Certification Types"])


@router.post("", response_model=CertificationTypeResponse, summary="创建认证类型")
async def create_certificationtype(
    data: CertificationTypeCreate,
    current_user: Annotated[User, Depends(get_current_user)],
    tenant_id: Annotated[int, Depends(get_current_tenant)]
):
    """创建认证类型"""
    try:
        return await CertificationTypeService.create_certificationtype(tenant_id, data)
    except ValidationError as e:
        raise HTTPException(status_code=status.HTTP_400_BAD_REQUEST, detail=str(e))


@router.get("", response_model=List[CertificationTypeResponse], summary="获取认证类型列表")
async def list_certificationtypes(
    current_user: Annotated[User, Depends(get_current_user)],
    tenant_id: Annotated[int, Depends(get_current_tenant)],
    skip: int = Query(0, ge=0),
    limit: int = Query(100, ge=1, le=1000),
    status: Optional[str] = Query(None)
):
    """获取认证类型列表"""
    return await CertificationTypeService.list_certificationtypes(tenant_id, skip, limit, status)


@router.get("/{obj_uuid}", response_model=CertificationTypeResponse, summary="获取认证类型详情")
async def get_certificationtype(
    obj_uuid: str,
    current_user: Annotated[User, Depends(get_current_user)],
    tenant_id: Annotated[int, Depends(get_current_tenant)]
):
    """获取认证类型详情"""
    try:
        return await CertificationTypeService.get_certificationtype_by_uuid(tenant_id, obj_uuid)
    except NotFoundError as e:
        raise HTTPException(status_code=status.HTTP_404_NOT_FOUND, detail=str(e))


@router.put("/{obj_uuid}", response_model=CertificationTypeResponse, summary="更新认证类型")
async def update_certificationtype(
    obj_uuid: str,
    data: CertificationTypeUpdate,
    current_user: Annotated[User, Depends(get_current_user)],
    tenant_id: Annotated[int, Depends(get_current_tenant)]
):
    """更新认证类型"""
    try:
        return await CertificationTypeService.update_certificationtype(tenant_id, obj_uuid, data)
    except NotFoundError as e:
        raise HTTPException(status_code=status.HTTP_404_NOT_FOUND, detail=str(e))
    except ValidationError as e:
        raise HTTPException(status_code=status.HTTP_400_BAD_REQUEST, detail=str(e))


@router.delete("/{obj_uuid}", status_code=status.HTTP_204_NO_CONTENT, summary="删除认证类型")
async def delete_certificationtype(
    obj_uuid: str,
    current_user: Annotated[User, Depends(get_current_user)],
    tenant_id: Annotated[int, Depends(get_current_tenant)]
):
    """删除认证类型（软删除）"""
    try:
        await CertificationTypeService.delete_certificationtype(tenant_id, obj_uuid)
    except NotFoundError as e:
        raise HTTPException(status_code=status.HTTP_404_NOT_FOUND, detail=str(e))
