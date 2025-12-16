"""
认证要求 API 模块

提供认证要求的 RESTful API 接口，支持多组织隔离。
"""

from fastapi import APIRouter, Depends, HTTPException, Query, status
from typing import List, Optional, Annotated

from core.api.deps.deps import get_current_user, get_current_tenant
from infra.models.user import User
from apps.kuaicert.services.certification_requirement_service import CertificationRequirementService
from apps.kuaicert.schemas.certification_requirement_schemas import (
    CertificationRequirementCreate, CertificationRequirementUpdate, CertificationRequirementResponse
)
from infra.exceptions.exceptions import NotFoundError, ValidationError

router = APIRouter(prefix="/certification-requirement", tags=["认证要求"])


@router.post("", response_model=CertificationRequirementResponse, summary="创建认证要求")
async def create_certificationrequirement(
    data: CertificationRequirementCreate,
    current_user: Annotated[User, Depends(get_current_user)],
    tenant_id: Annotated[int, Depends(get_current_tenant)]
):
    """创建认证要求"""
    try:
        return await CertificationRequirementService.create_certificationrequirement(tenant_id, data)
    except ValidationError as e:
        raise HTTPException(status_code=status.HTTP_400_BAD_REQUEST, detail=str(e))


@router.get("", response_model=List[CertificationRequirementResponse], summary="获取认证要求列表")
async def list_certificationrequirements(
    current_user: Annotated[User, Depends(get_current_user)],
    tenant_id: Annotated[int, Depends(get_current_tenant)],
    skip: int = Query(0, ge=0),
    limit: int = Query(100, ge=1, le=1000),
    status: Optional[str] = Query(None)
):
    """获取认证要求列表"""
    return await CertificationRequirementService.list_certificationrequirements(tenant_id, skip, limit, status)


@router.get("/{obj_uuid}", response_model=CertificationRequirementResponse, summary="获取认证要求详情")
async def get_certificationrequirement(
    obj_uuid: str,
    current_user: Annotated[User, Depends(get_current_user)],
    tenant_id: Annotated[int, Depends(get_current_tenant)]
):
    """获取认证要求详情"""
    try:
        return await CertificationRequirementService.get_certificationrequirement_by_uuid(tenant_id, obj_uuid)
    except NotFoundError as e:
        raise HTTPException(status_code=status.HTTP_404_NOT_FOUND, detail=str(e))


@router.put("/{obj_uuid}", response_model=CertificationRequirementResponse, summary="更新认证要求")
async def update_certificationrequirement(
    obj_uuid: str,
    data: CertificationRequirementUpdate,
    current_user: Annotated[User, Depends(get_current_user)],
    tenant_id: Annotated[int, Depends(get_current_tenant)]
):
    """更新认证要求"""
    try:
        return await CertificationRequirementService.update_certificationrequirement(tenant_id, obj_uuid, data)
    except NotFoundError as e:
        raise HTTPException(status_code=status.HTTP_404_NOT_FOUND, detail=str(e))
    except ValidationError as e:
        raise HTTPException(status_code=status.HTTP_400_BAD_REQUEST, detail=str(e))


@router.delete("/{obj_uuid}", status_code=status.HTTP_204_NO_CONTENT, summary="删除认证要求")
async def delete_certificationrequirement(
    obj_uuid: str,
    current_user: Annotated[User, Depends(get_current_user)],
    tenant_id: Annotated[int, Depends(get_current_tenant)]
):
    """删除认证要求（软删除）"""
    try:
        await CertificationRequirementService.delete_certificationrequirement(tenant_id, obj_uuid)
    except NotFoundError as e:
        raise HTTPException(status_code=status.HTTP_404_NOT_FOUND, detail=str(e))
