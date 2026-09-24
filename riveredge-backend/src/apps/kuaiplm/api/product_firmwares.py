"""产品固件 API（R-15 #28）"""

from __future__ import annotations

from typing import Optional

from fastapi import APIRouter, Depends, HTTPException, Query, status

from apps.kuaiplm.schemas.product_firmware import (
    ProductFirmwareCreate,
    ProductFirmwareDownloadResponse,
    ProductFirmwareListResponse,
    ProductFirmwareResponse,
    ProductFirmwareReviseRequest,
    ProductFirmwareUpdate,
)
from apps.kuaiplm.services.product_firmware_service import ProductFirmwareService
from core.api.deps.access import require_access
from core.api.deps.deps import get_current_tenant
from core.services.authorization.user_permission_service import UserPermissionService
from infra.api.deps.deps import get_current_user
from infra.exceptions.exceptions import BusinessLogicError, NotFoundError, ValidationError
from infra.models.user import User

router = APIRouter(prefix="/product-firmwares", tags=["App - Kuaiplm - Product Firmware"])
service = ProductFirmwareService()


def _http(exc: Exception) -> HTTPException:
    if isinstance(exc, NotFoundError):
        return HTTPException(status_code=status.HTTP_404_NOT_FOUND, detail=str(exc))
    if isinstance(exc, (ValidationError, BusinessLogicError)):
        return HTTPException(status_code=status.HTTP_422_UNPROCESSABLE_ENTITY, detail=str(exc))
    return HTTPException(status_code=status.HTTP_500_INTERNAL_SERVER_ERROR, detail=str(exc))


async def _permission_codes(user: User, tenant_id: int) -> list[str]:
    return sorted(
        await UserPermissionService.get_user_permissions(
            user_id=user.id,
            tenant_id=tenant_id,
        )
    )


@router.get("", response_model=ProductFirmwareListResponse, summary="List product firmwares")
async def list_product_firmwares(
    skip: int = Query(0, ge=0),
    limit: int = Query(20, ge=1, le=100),
    keyword: Optional[str] = Query(None),
    status_filter: Optional[str] = Query(None, alias="status"),
    project_id: Optional[int] = Query(None),
    production_download_only: bool = Query(
        False, description="生产下载：仅已发布版本（INF-05 PRODUCTION）"
    ),
    current_user: User = Depends(get_current_user),
    _auth=Depends(
        require_access(
            "kuaiplm.product-firmware",
            "read",
            required_permissions=["kuaiplm:product-firmware:read"],
        )
    ),
    tenant_id: int = Depends(get_current_tenant),
):
    try:
        codes = await _permission_codes(current_user, tenant_id)
        return await service.list(
            tenant_id,
            keyword=keyword,
            status=status_filter,
            project_id=project_id,
            skip=skip,
            limit=limit,
            production_download_only=production_download_only,
            current_user_id=current_user.id,
            permission_codes=codes,
        )
    except Exception as e:
        raise _http(e)


@router.post(
    "",
    response_model=ProductFirmwareResponse,
    status_code=status.HTTP_201_CREATED,
    summary="Create product firmware",
)
async def create_product_firmware(
    data: ProductFirmwareCreate,
    current_user: User = Depends(get_current_user),
    _auth=Depends(
        require_access(
            "kuaiplm.product-firmware",
            "create",
            required_permissions=["kuaiplm:product-firmware:create"],
        )
    ),
    tenant_id: int = Depends(get_current_tenant),
):
    try:
        return await service.create(tenant_id, data, current_user)
    except Exception as e:
        raise _http(e)


@router.get("/{firmware_id}", response_model=ProductFirmwareResponse, summary="Get product firmware")
async def get_product_firmware(
    firmware_id: int,
    production_view: bool = Query(False, description="生产上下文可见性"),
    current_user: User = Depends(get_current_user),
    _auth=Depends(
        require_access(
            "kuaiplm.product-firmware",
            "read",
            required_permissions=["kuaiplm:product-firmware:read"],
        )
    ),
    tenant_id: int = Depends(get_current_tenant),
):
    try:
        codes = await _permission_codes(current_user, tenant_id)
        return await service.get(
            tenant_id,
            firmware_id,
            current_user_id=current_user.id,
            permission_codes=codes,
            production_view=production_view,
        )
    except Exception as e:
        raise _http(e)


@router.put("/{firmware_id}", response_model=ProductFirmwareResponse, summary="Update product firmware")
async def update_product_firmware(
    firmware_id: int,
    data: ProductFirmwareUpdate,
    current_user: User = Depends(get_current_user),
    _auth=Depends(
        require_access(
            "kuaiplm.product-firmware",
            "update",
            required_permissions=["kuaiplm:product-firmware:update"],
        )
    ),
    tenant_id: int = Depends(get_current_tenant),
):
    try:
        return await service.update(tenant_id, firmware_id, data, current_user)
    except Exception as e:
        raise _http(e)


@router.post("/{firmware_id}/submit", response_model=ProductFirmwareResponse, summary="Submit")
async def submit_product_firmware(
    firmware_id: int,
    current_user: User = Depends(get_current_user),
    _auth=Depends(
        require_access(
            "kuaiplm.product-firmware",
            "submit",
            required_permissions=["kuaiplm:product-firmware:submit"],
        )
    ),
    tenant_id: int = Depends(get_current_tenant),
):
    try:
        return await service.submit(tenant_id, firmware_id, current_user)
    except Exception as e:
        raise _http(e)


@router.post("/{firmware_id}/approve", response_model=ProductFirmwareResponse, summary="Approve")
async def approve_product_firmware(
    firmware_id: int,
    current_user: User = Depends(get_current_user),
    _auth=Depends(
        require_access(
            "kuaiplm.product-firmware",
            "approve",
            required_permissions=["kuaiplm:product-firmware:approve"],
        )
    ),
    tenant_id: int = Depends(get_current_tenant),
):
    try:
        return await service.approve(tenant_id, firmware_id, current_user)
    except Exception as e:
        raise _http(e)


@router.post("/{firmware_id}/reject", response_model=ProductFirmwareResponse, summary="Reject")
async def reject_product_firmware(
    firmware_id: int,
    current_user: User = Depends(get_current_user),
    _auth=Depends(
        require_access(
            "kuaiplm.product-firmware",
            "reject",
            required_permissions=["kuaiplm:product-firmware:reject"],
        )
    ),
    tenant_id: int = Depends(get_current_tenant),
):
    try:
        return await service.reject(tenant_id, firmware_id, current_user)
    except Exception as e:
        raise _http(e)


@router.get(
    "/{firmware_id}/download",
    response_model=ProductFirmwareDownloadResponse,
    summary="Download firmware file",
)
async def download_product_firmware(
    firmware_id: int,
    production_view: bool = Query(False, description="生产上下文可见性"),
    current_user: User = Depends(get_current_user),
    _auth=Depends(
        require_access(
            "kuaiplm.product-firmware",
            "read",
            required_permissions=["kuaiplm:product-firmware:read"],
        )
    ),
    tenant_id: int = Depends(get_current_tenant),
):
    try:
        codes = await _permission_codes(current_user, tenant_id)
        return await service.resolve_download(
            tenant_id,
            firmware_id,
            current_user_id=current_user.id,
            permission_codes=codes,
            production_view=production_view,
        )
    except Exception as e:
        raise _http(e)


@router.post("/{firmware_id}/revise", response_model=ProductFirmwareResponse, summary="Revise")
async def revise_product_firmware(
    firmware_id: int,
    data: ProductFirmwareReviseRequest,
    current_user: User = Depends(get_current_user),
    _auth=Depends(
        require_access(
            "kuaiplm.product-firmware",
            "update",
            required_permissions=["kuaiplm:product-firmware:update"],
        )
    ),
    tenant_id: int = Depends(get_current_tenant),
):
    try:
        return await service.revise(tenant_id, firmware_id, data, current_user)
    except Exception as e:
        raise _http(e)


@router.post("/{firmware_id}/release", response_model=ProductFirmwareResponse, summary="Release for production")
async def release_product_firmware(
    firmware_id: int,
    current_user: User = Depends(get_current_user),
    _auth=Depends(
        require_access(
            "kuaiplm.product-firmware",
            "execute",
            required_permissions=["kuaiplm:product-firmware:execute"],
        )
    ),
    tenant_id: int = Depends(get_current_tenant),
):
    try:
        return await service.release(tenant_id, firmware_id, current_user)
    except Exception as e:
        raise _http(e)


@router.post("/{firmware_id}/obsolete", response_model=ProductFirmwareResponse, summary="Obsolete")
async def obsolete_product_firmware(
    firmware_id: int,
    current_user: User = Depends(get_current_user),
    _auth=Depends(
        require_access(
            "kuaiplm.product-firmware",
            "update",
            required_permissions=["kuaiplm:product-firmware:update"],
        )
    ),
    tenant_id: int = Depends(get_current_tenant),
):
    try:
        return await service.obsolete(tenant_id, firmware_id, current_user)
    except Exception as e:
        raise _http(e)


@router.delete("/{firmware_id}", status_code=status.HTTP_204_NO_CONTENT, summary="Delete draft")
async def delete_product_firmware(
    firmware_id: int,
    current_user: User = Depends(get_current_user),
    _auth=Depends(
        require_access(
            "kuaiplm.product-firmware",
            "delete",
            required_permissions=["kuaiplm:product-firmware:delete"],
        )
    ),
    tenant_id: int = Depends(get_current_tenant),
):
    try:
        await service.delete(tenant_id, firmware_id, current_user)
    except Exception as e:
        raise _http(e)
