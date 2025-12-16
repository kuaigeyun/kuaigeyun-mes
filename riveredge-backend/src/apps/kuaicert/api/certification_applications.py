"""
认证申请 API 模块

提供认证申请的 RESTful API 接口，支持多组织隔离。
"""

from fastapi import APIRouter, Depends, HTTPException, Query, status
from typing import List, Optional, Annotated

from core.api.deps.deps import get_current_user, get_current_tenant
from infra.models.user import User
from apps.kuaicert.services.certification_application_service import CertificationApplicationService
from apps.kuaicert.schemas.certification_application_schemas import (
    CertificationApplicationCreate, CertificationApplicationUpdate, CertificationApplicationResponse
)
from infra.exceptions.exceptions import NotFoundError, ValidationError

router = APIRouter(prefix="/certification-application", tags=["认证申请"])


@router.post("", response_model=CertificationApplicationResponse, summary="创建认证申请")
async def create_certificationapplication(
    data: CertificationApplicationCreate,
    current_user: Annotated[User, Depends(get_current_user)],
    tenant_id: Annotated[int, Depends(get_current_tenant)]
):
    """创建认证申请"""
    try:
        return await CertificationApplicationService.create_certificationapplication(tenant_id, data)
    except ValidationError as e:
        raise HTTPException(status_code=status.HTTP_400_BAD_REQUEST, detail=str(e))


@router.get("", response_model=List[CertificationApplicationResponse], summary="获取认证申请列表")
async def list_certificationapplications(
    current_user: Annotated[User, Depends(get_current_user)],
    tenant_id: Annotated[int, Depends(get_current_tenant)],
    skip: int = Query(0, ge=0),
    limit: int = Query(100, ge=1, le=1000),
    status: Optional[str] = Query(None)
):
    """获取认证申请列表"""
    return await CertificationApplicationService.list_certificationapplications(tenant_id, skip, limit, status)


@router.get("/{obj_uuid}", response_model=CertificationApplicationResponse, summary="获取认证申请详情")
async def get_certificationapplication(
    obj_uuid: str,
    current_user: Annotated[User, Depends(get_current_user)],
    tenant_id: Annotated[int, Depends(get_current_tenant)]
):
    """获取认证申请详情"""
    try:
        return await CertificationApplicationService.get_certificationapplication_by_uuid(tenant_id, obj_uuid)
    except NotFoundError as e:
        raise HTTPException(status_code=status.HTTP_404_NOT_FOUND, detail=str(e))


@router.put("/{obj_uuid}", response_model=CertificationApplicationResponse, summary="更新认证申请")
async def update_certificationapplication(
    obj_uuid: str,
    data: CertificationApplicationUpdate,
    current_user: Annotated[User, Depends(get_current_user)],
    tenant_id: Annotated[int, Depends(get_current_tenant)]
):
    """更新认证申请"""
    try:
        return await CertificationApplicationService.update_certificationapplication(tenant_id, obj_uuid, data)
    except NotFoundError as e:
        raise HTTPException(status_code=status.HTTP_404_NOT_FOUND, detail=str(e))
    except ValidationError as e:
        raise HTTPException(status_code=status.HTTP_400_BAD_REQUEST, detail=str(e))


@router.delete("/{obj_uuid}", status_code=status.HTTP_204_NO_CONTENT, summary="删除认证申请")
async def delete_certificationapplication(
    obj_uuid: str,
    current_user: Annotated[User, Depends(get_current_user)],
    tenant_id: Annotated[int, Depends(get_current_tenant)]
):
    """删除认证申请（软删除）"""
    try:
        await CertificationApplicationService.delete_certificationapplication(tenant_id, obj_uuid)
    except NotFoundError as e:
        raise HTTPException(status_code=status.HTTP_404_NOT_FOUND, detail=str(e))
