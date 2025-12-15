"""
社保个税 API 模块

提供社保个税的 RESTful API 接口，支持多组织隔离。
"""

from fastapi import APIRouter, Depends, HTTPException, Query, status
from typing import List, Optional, Annotated

from core.api.deps.deps import get_current_user, get_current_tenant
from infra.models.user import User
from apps.kuaihrm.services.social_security_tax_service import SocialSecurityTaxService
from apps.kuaihrm.schemas.social_security_tax_schemas import (
    SocialSecurityTaxCreate, SocialSecurityTaxUpdate, SocialSecurityTaxResponse
)
from infra.exceptions.exceptions import NotFoundError, ValidationError

router = APIRouter(prefix="/social-security-taxes", tags=["社保个税"])


@router.post("", response_model=SocialSecurityTaxResponse, summary="创建社保个税")
async def create_social_security_tax(
    data: SocialSecurityTaxCreate,
    current_user: Annotated[User, Depends(get_current_user)],
    tenant_id: Annotated[int, Depends(get_current_tenant)]
):
    """创建社保个税"""
    try:
        return await SocialSecurityTaxService.create_social_security_tax(tenant_id, data)
    except ValidationError as e:
        raise HTTPException(status_code=status.HTTP_400_BAD_REQUEST, detail=str(e))


@router.get("", response_model=List[SocialSecurityTaxResponse], summary="获取社保个税列表")
async def list_social_security_taxes(
    current_user: Annotated[User, Depends(get_current_user)],
    tenant_id: Annotated[int, Depends(get_current_tenant)],
    skip: int = Query(0, ge=0),
    limit: int = Query(100, ge=1, le=1000),
    employee_id: Optional[int] = Query(None),
    status: Optional[str] = Query(None)
):
    """获取社保个税列表"""
    return await SocialSecurityTaxService.list_social_security_taxes(
        tenant_id, skip, limit, employee_id, status
    )


@router.get("/{tax_uuid}", response_model=SocialSecurityTaxResponse, summary="获取社保个税详情")
async def get_social_security_tax(
    tax_uuid: str,
    current_user: Annotated[User, Depends(get_current_user)],
    tenant_id: Annotated[int, Depends(get_current_tenant)]
):
    """获取社保个税详情"""
    try:
        return await SocialSecurityTaxService.get_social_security_tax_by_uuid(tenant_id, tax_uuid)
    except NotFoundError as e:
        raise HTTPException(status_code=status.HTTP_404_NOT_FOUND, detail=str(e))


@router.put("/{tax_uuid}", response_model=SocialSecurityTaxResponse, summary="更新社保个税")
async def update_social_security_tax(
    tax_uuid: str,
    data: SocialSecurityTaxUpdate,
    current_user: Annotated[User, Depends(get_current_user)],
    tenant_id: Annotated[int, Depends(get_current_tenant)]
):
    """更新社保个税"""
    try:
        return await SocialSecurityTaxService.update_social_security_tax(tenant_id, tax_uuid, data)
    except NotFoundError as e:
        raise HTTPException(status_code=status.HTTP_404_NOT_FOUND, detail=str(e))
    except ValidationError as e:
        raise HTTPException(status_code=status.HTTP_400_BAD_REQUEST, detail=str(e))


@router.delete("/{tax_uuid}", status_code=status.HTTP_204_NO_CONTENT, summary="删除社保个税")
async def delete_social_security_tax(
    tax_uuid: str,
    current_user: Annotated[User, Depends(get_current_user)],
    tenant_id: Annotated[int, Depends(get_current_tenant)]
):
    """删除社保个税（软删除）"""
    try:
        await SocialSecurityTaxService.delete_social_security_tax(tenant_id, tax_uuid)
    except NotFoundError as e:
        raise HTTPException(status_code=status.HTTP_404_NOT_FOUND, detail=str(e))
    except ValidationError as e:
        raise HTTPException(status_code=status.HTTP_400_BAD_REQUEST, detail=str(e))

