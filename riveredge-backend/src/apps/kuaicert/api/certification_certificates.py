"""
认证证书 API 模块

提供认证证书的 RESTful API 接口，支持多组织隔离。
"""

from fastapi import APIRouter, Depends, HTTPException, Query, status
from typing import List, Optional, Annotated

from core.api.deps.deps import get_current_user, get_current_tenant
from infra.models.user import User
from apps.kuaicert.services.certification_certificate_service import CertificationCertificateService
from apps.kuaicert.schemas.certification_certificate_schemas import (
    CertificationCertificateCreate, CertificationCertificateUpdate, CertificationCertificateResponse
)
from infra.exceptions.exceptions import NotFoundError, ValidationError

router = APIRouter(prefix="/certification-certificate", tags=["认证证书"])


@router.post("", response_model=CertificationCertificateResponse, summary="创建认证证书")
async def create_certificationcertificate(
    data: CertificationCertificateCreate,
    current_user: Annotated[User, Depends(get_current_user)],
    tenant_id: Annotated[int, Depends(get_current_tenant)]
):
    """创建认证证书"""
    try:
        return await CertificationCertificateService.create_certificationcertificate(tenant_id, data)
    except ValidationError as e:
        raise HTTPException(status_code=status.HTTP_400_BAD_REQUEST, detail=str(e))


@router.get("", response_model=List[CertificationCertificateResponse], summary="获取认证证书列表")
async def list_certificationcertificates(
    current_user: Annotated[User, Depends(get_current_user)],
    tenant_id: Annotated[int, Depends(get_current_tenant)],
    skip: int = Query(0, ge=0),
    limit: int = Query(100, ge=1, le=1000),
    status: Optional[str] = Query(None)
):
    """获取认证证书列表"""
    return await CertificationCertificateService.list_certificationcertificates(tenant_id, skip, limit, status)


@router.get("/{obj_uuid}", response_model=CertificationCertificateResponse, summary="获取认证证书详情")
async def get_certificationcertificate(
    obj_uuid: str,
    current_user: Annotated[User, Depends(get_current_user)],
    tenant_id: Annotated[int, Depends(get_current_tenant)]
):
    """获取认证证书详情"""
    try:
        return await CertificationCertificateService.get_certificationcertificate_by_uuid(tenant_id, obj_uuid)
    except NotFoundError as e:
        raise HTTPException(status_code=status.HTTP_404_NOT_FOUND, detail=str(e))


@router.put("/{obj_uuid}", response_model=CertificationCertificateResponse, summary="更新认证证书")
async def update_certificationcertificate(
    obj_uuid: str,
    data: CertificationCertificateUpdate,
    current_user: Annotated[User, Depends(get_current_user)],
    tenant_id: Annotated[int, Depends(get_current_tenant)]
):
    """更新认证证书"""
    try:
        return await CertificationCertificateService.update_certificationcertificate(tenant_id, obj_uuid, data)
    except NotFoundError as e:
        raise HTTPException(status_code=status.HTTP_404_NOT_FOUND, detail=str(e))
    except ValidationError as e:
        raise HTTPException(status_code=status.HTTP_400_BAD_REQUEST, detail=str(e))


@router.delete("/{obj_uuid}", status_code=status.HTTP_204_NO_CONTENT, summary="删除认证证书")
async def delete_certificationcertificate(
    obj_uuid: str,
    current_user: Annotated[User, Depends(get_current_user)],
    tenant_id: Annotated[int, Depends(get_current_tenant)]
):
    """删除认证证书（软删除）"""
    try:
        await CertificationCertificateService.delete_certificationcertificate(tenant_id, obj_uuid)
    except NotFoundError as e:
        raise HTTPException(status_code=status.HTTP_404_NOT_FOUND, detail=str(e))
