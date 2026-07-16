"""
许可证中心 API。

平台级 License Key 管理接口，仅平台超级管理员可访问。
"""

from typing import List, Optional

from fastapi import APIRouter, Depends, HTTPException, Query, status

from infra.api.deps.deps import get_current_infra_superadmin
from infra.models.infra_superadmin import InfraSuperAdmin
from infra.schemas.license_center import (
    PlatformLicenseCreateRequest,
    PlatformLicenseGenerateResponse,
    PlatformLicenseResponse,
)
from infra.services.license_center_service import LicenseCenterService

router = APIRouter(prefix="/license-center", tags=["Platform - License"])


@router.get("/licenses", response_model=List[PlatformLicenseResponse])
async def list_platform_licenses(
    app_code: Optional[str] = Query(default=None),
    is_active: Optional[bool] = Query(default=None),
    current_admin: InfraSuperAdmin = Depends(get_current_infra_superadmin),
):
    _ = current_admin
    return await LicenseCenterService.list_licenses(app_code=app_code, is_active=is_active)


@router.post("/licenses", response_model=PlatformLicenseResponse, status_code=status.HTTP_201_CREATED)
async def create_platform_license(
    data: PlatformLicenseCreateRequest,
    current_admin: InfraSuperAdmin = Depends(get_current_infra_superadmin),
):
    return await LicenseCenterService.create_license(data=data, created_by=current_admin.id)


@router.get("/licenses/generate", response_model=PlatformLicenseGenerateResponse)
async def generate_platform_license_key(
    app_code: Optional[str] = Query(default=None),
    current_admin: InfraSuperAdmin = Depends(get_current_infra_superadmin),
):
    _ = current_admin
    return PlatformLicenseGenerateResponse(
        license_key=LicenseCenterService.generate_license_key(app_code=app_code)
    )


@router.post("/licenses/{license_uuid}/revoke", response_model=PlatformLicenseResponse)
async def revoke_platform_license(
    license_uuid: str,
    current_admin: InfraSuperAdmin = Depends(get_current_infra_superadmin),
):
    _ = current_admin
    item = await LicenseCenterService.revoke_license(license_uuid)
    if not item:
        raise HTTPException(status_code=status.HTTP_404_NOT_FOUND, detail="许可证不存在")
    return item


@router.get("/licenses/{license_uuid}/plain-key")
async def get_platform_license_plain_key(
    license_uuid: str,
    current_admin: InfraSuperAdmin = Depends(get_current_infra_superadmin),
):
    _ = current_admin
    plain_key = await LicenseCenterService.get_plain_license_key(license_uuid)
    if not plain_key:
        raise HTTPException(status_code=status.HTTP_404_NOT_FOUND, detail="许可证不存在或密钥不可恢复")
    return {"license_key": plain_key}

