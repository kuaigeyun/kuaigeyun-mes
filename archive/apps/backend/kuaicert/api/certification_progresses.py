"""
认证进度 API 模块

提供认证进度的 RESTful API 接口，支持多组织隔离。
"""

from fastapi import APIRouter, Depends, HTTPException, Query, status
from typing import List, Optional, Annotated

from core.api.deps.deps import get_current_user, get_current_tenant
from infra.models.user import User
from apps.kuaicert.services.certification_progress_service import CertificationProgressService
from apps.kuaicert.schemas.certification_progress_schemas import (
    CertificationProgressCreate, CertificationProgressUpdate, CertificationProgressResponse
)
from infra.exceptions.exceptions import NotFoundError, ValidationError

router = APIRouter(prefix="/certification-progress", tags=["Certification Progress"])


@router.post("", response_model=CertificationProgressResponse, summary="创建认证进度")
async def create_certificationprogress(
    data: CertificationProgressCreate,
    current_user: Annotated[User, Depends(get_current_user)],
    tenant_id: Annotated[int, Depends(get_current_tenant)]
):
    """创建认证进度"""
    try:
        return await CertificationProgressService.create_certificationprogress(tenant_id, data)
    except ValidationError as e:
        raise HTTPException(status_code=status.HTTP_400_BAD_REQUEST, detail=str(e))


@router.get("", response_model=List[CertificationProgressResponse], summary="获取认证进度列表")
async def list_certificationprogresss(
    current_user: Annotated[User, Depends(get_current_user)],
    tenant_id: Annotated[int, Depends(get_current_tenant)],
    skip: int = Query(0, ge=0),
    limit: int = Query(100, ge=1, le=1000),
    status: Optional[str] = Query(None)
):
    """获取认证进度列表"""
    return await CertificationProgressService.list_certificationprogresss(tenant_id, skip, limit, status)


@router.get("/{obj_uuid}", response_model=CertificationProgressResponse, summary="获取认证进度详情")
async def get_certificationprogress(
    obj_uuid: str,
    current_user: Annotated[User, Depends(get_current_user)],
    tenant_id: Annotated[int, Depends(get_current_tenant)]
):
    """获取认证进度详情"""
    try:
        return await CertificationProgressService.get_certificationprogress_by_uuid(tenant_id, obj_uuid)
    except NotFoundError as e:
        raise HTTPException(status_code=status.HTTP_404_NOT_FOUND, detail=str(e))


@router.put("/{obj_uuid}", response_model=CertificationProgressResponse, summary="更新认证进度")
async def update_certificationprogress(
    obj_uuid: str,
    data: CertificationProgressUpdate,
    current_user: Annotated[User, Depends(get_current_user)],
    tenant_id: Annotated[int, Depends(get_current_tenant)]
):
    """更新认证进度"""
    try:
        return await CertificationProgressService.update_certificationprogress(tenant_id, obj_uuid, data)
    except NotFoundError as e:
        raise HTTPException(status_code=status.HTTP_404_NOT_FOUND, detail=str(e))
    except ValidationError as e:
        raise HTTPException(status_code=status.HTTP_400_BAD_REQUEST, detail=str(e))


@router.delete("/{obj_uuid}", status_code=status.HTTP_204_NO_CONTENT, summary="删除认证进度")
async def delete_certificationprogress(
    obj_uuid: str,
    current_user: Annotated[User, Depends(get_current_user)],
    tenant_id: Annotated[int, Depends(get_current_tenant)]
):
    """删除认证进度（软删除）"""
    try:
        await CertificationProgressService.delete_certificationprogress(tenant_id, obj_uuid)
    except NotFoundError as e:
        raise HTTPException(status_code=status.HTTP_404_NOT_FOUND, detail=str(e))
