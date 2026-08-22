"""平台敏感词黑名单管理 API。"""

from typing import Optional

from fastapi import APIRouter, Depends, HTTPException, Query, status

from infra.api.deps.deps import get_current_infra_superadmin
from infra.models.infra_superadmin import InfraSuperAdmin
from infra.schemas.sensitive_word_blacklist import (
    SensitiveWordBanListResponse,
    SensitiveWordBlacklistMetaResponse,
    TenantSensitiveWordAllowlistCreate,
    TenantSensitiveWordAllowlistItem,
    TenantSensitiveWordAllowlistListResponse,
)
from infra.services.sensitive_word_blacklist_service import SensitiveWordBlacklistService

router = APIRouter(prefix="/sensitive-word-blacklist", tags=["Platform - Sensitive Word Blacklist"])


@router.get("/meta", response_model=SensitiveWordBlacklistMetaResponse)
async def get_sensitive_word_blacklist_meta(
    _admin: InfraSuperAdmin = Depends(get_current_infra_superadmin),
):
    service = SensitiveWordBlacklistService()
    meta = await service.get_meta()
    return SensitiveWordBlacklistMetaResponse(**meta)


@router.get("/bans", response_model=SensitiveWordBanListResponse)
async def list_sensitive_word_bans(
    page: int = Query(1, ge=1),
    page_size: int = Query(20, ge=1, le=200),
    tenant_id: Optional[int] = Query(None),
    active_only: bool = Query(True),
    _admin: InfraSuperAdmin = Depends(get_current_infra_superadmin),
):
    service = SensitiveWordBlacklistService()
    result = await service.list_bans(
        page=page,
        page_size=page_size,
        tenant_id=tenant_id,
        active_only=active_only,
    )
    return SensitiveWordBanListResponse(**result)


@router.post("/bans/{ban_id}/unban", status_code=status.HTTP_204_NO_CONTENT)
async def unban_sensitive_word_subject(
    ban_id: int,
    _admin: InfraSuperAdmin = Depends(get_current_infra_superadmin),
):
    service = SensitiveWordBlacklistService()
    try:
        await service.unban(ban_id)
    except ValueError as exc:
        raise HTTPException(status_code=status.HTTP_404_NOT_FOUND, detail=str(exc))


@router.get("/allowlist", response_model=TenantSensitiveWordAllowlistListResponse)
async def list_tenant_sensitive_word_allowlist(
    tenant_id: int = Query(..., ge=1),
    page: int = Query(1, ge=1),
    page_size: int = Query(50, ge=1, le=200),
    _admin: InfraSuperAdmin = Depends(get_current_infra_superadmin),
):
    service = SensitiveWordBlacklistService()
    result = await service.list_allowlist(tenant_id=tenant_id, page=page, page_size=page_size)
    return TenantSensitiveWordAllowlistListResponse(**result)


@router.post("/allowlist", response_model=TenantSensitiveWordAllowlistItem)
async def add_tenant_sensitive_word_allowlist(
    payload: TenantSensitiveWordAllowlistCreate,
    _admin: InfraSuperAdmin = Depends(get_current_infra_superadmin),
):
    service = SensitiveWordBlacklistService()
    try:
        row = await service.add_allowlist_word(
            tenant_id=payload.tenant_id,
            word=payload.word,
            note=payload.note,
        )
    except ValueError as exc:
        raise HTTPException(status_code=status.HTTP_400_BAD_REQUEST, detail=str(exc))
    return TenantSensitiveWordAllowlistItem(
        id=row.id,
        tenant_id=row.tenant_id,
        word=row.word,
        note=row.note,
        created_at=row.created_at,
    )


@router.delete("/allowlist/{allowlist_id}", status_code=status.HTTP_204_NO_CONTENT)
async def remove_tenant_sensitive_word_allowlist(
    allowlist_id: int,
    _admin: InfraSuperAdmin = Depends(get_current_infra_superadmin),
):
    service = SensitiveWordBlacklistService()
    try:
        await service.remove_allowlist_word(allowlist_id)
    except ValueError as exc:
        raise HTTPException(status_code=status.HTTP_404_NOT_FOUND, detail=str(exc))
