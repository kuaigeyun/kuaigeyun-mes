"""
认证标准 API 模块

提供认证标准的 RESTful API 接口，支持多组织隔离。
"""

from fastapi import APIRouter, Depends, HTTPException, Query, status
from typing import List, Optional, Annotated

from core.api.deps.deps import get_current_user, get_current_tenant
from infra.models.user import User
from apps.kuaicert.services.certification_standard_service import CertificationStandardService
from apps.kuaicert.schemas.certification_standard_schemas import (
    CertificationStandardCreate, CertificationStandardUpdate, CertificationStandardResponse
)
from infra.exceptions.exceptions import NotFoundError, ValidationError

router = APIRouter(prefix="/certification-standard", tags=["认证标准"])


@router.post("", response_model=CertificationStandardResponse, summary="创建认证标准")
async def create_certificationstandard(
    data: CertificationStandardCreate,
    current_user: Annotated[User, Depends(get_current_user)],
    tenant_id: Annotated[int, Depends(get_current_tenant)]
):
    """创建认证标准"""
    try:
        return await CertificationStandardService.create_certificationstandard(tenant_id, data)
    except ValidationError as e:
        raise HTTPException(status_code=status.HTTP_400_BAD_REQUEST, detail=str(e))


@router.get("", response_model=List[CertificationStandardResponse], summary="获取认证标准列表")
async def list_certificationstandards(
    current_user: Annotated[User, Depends(get_current_user)],
    tenant_id: Annotated[int, Depends(get_current_tenant)],
    skip: int = Query(0, ge=0),
    limit: int = Query(100, ge=1, le=1000),
    status: Optional[str] = Query(None)
):
    """获取认证标准列表"""
    return await CertificationStandardService.list_certificationstandards(tenant_id, skip, limit, status)


@router.get("/{obj_uuid}", response_model=CertificationStandardResponse, summary="获取认证标准详情")
async def get_certificationstandard(
    obj_uuid: str,
    current_user: Annotated[User, Depends(get_current_user)],
    tenant_id: Annotated[int, Depends(get_current_tenant)]
):
    """获取认证标准详情"""
    try:
        return await CertificationStandardService.get_certificationstandard_by_uuid(tenant_id, obj_uuid)
    except NotFoundError as e:
        raise HTTPException(status_code=status.HTTP_404_NOT_FOUND, detail=str(e))


@router.put("/{obj_uuid}", response_model=CertificationStandardResponse, summary="更新认证标准")
async def update_certificationstandard(
    obj_uuid: str,
    data: CertificationStandardUpdate,
    current_user: Annotated[User, Depends(get_current_user)],
    tenant_id: Annotated[int, Depends(get_current_tenant)]
):
    """更新认证标准"""
    try:
        return await CertificationStandardService.update_certificationstandard(tenant_id, obj_uuid, data)
    except NotFoundError as e:
        raise HTTPException(status_code=status.HTTP_404_NOT_FOUND, detail=str(e))
    except ValidationError as e:
        raise HTTPException(status_code=status.HTTP_400_BAD_REQUEST, detail=str(e))


@router.delete("/{obj_uuid}", status_code=status.HTTP_204_NO_CONTENT, summary="删除认证标准")
async def delete_certificationstandard(
    obj_uuid: str,
    current_user: Annotated[User, Depends(get_current_user)],
    tenant_id: Annotated[int, Depends(get_current_tenant)]
):
    """删除认证标准（软删除）"""
    try:
        await CertificationStandardService.delete_certificationstandard(tenant_id, obj_uuid)
    except NotFoundError as e:
        raise HTTPException(status_code=status.HTTP_404_NOT_FOUND, detail=str(e))
