"""KU-AI 业务单据查询 API。"""

from __future__ import annotations

from typing import Any, Optional

from fastapi import APIRouter, Depends, Query, status

from apps.kuaiai.services.business_document_service import BusinessDocumentService
from core.api.deps.access import AuthContext, get_auth_context, require_permission_codes
from core.api.deps.deps import get_current_tenant
from infra.api.deps.deps import get_current_user
from infra.exceptions.exceptions import AuthorizationError, NotFoundError, ValidationError
from infra.models.user import User

router = APIRouter(prefix="/documents", tags=["App · KU-AI · Documents"])


def _http_error(exc: Exception):
    from fastapi import HTTPException

    if isinstance(exc, AuthorizationError):
        return HTTPException(status_code=status.HTTP_403_FORBIDDEN, detail=str(exc))
    if isinstance(exc, NotFoundError):
        return HTTPException(status_code=status.HTTP_404_NOT_FOUND, detail=str(exc))
    if isinstance(exc, ValidationError):
        return HTTPException(status_code=status.HTTP_400_BAD_REQUEST, detail=str(exc))
    return HTTPException(status_code=status.HTTP_500_INTERNAL_SERVER_ERROR, detail=str(exc))


@router.get(
    "/catalog",
    dependencies=[Depends(require_permission_codes("kuaiai:entry:read"))],
)
async def list_document_catalog(
    app: Optional[str] = Query(None, description="按应用筛选，如 kuaizhizao"),
    auth: AuthContext = Depends(get_auth_context),
    tenant_id: int = Depends(get_current_tenant),
    current_user: User = Depends(get_current_user),
) -> dict[str, Any]:
    """列出当前用户可查询的业务单据类型。"""
    items = await BusinessDocumentService.list_catalog(
        tenant_id=tenant_id,
        user=current_user,
        app_filter=app,
        is_infra_admin=auth.is_infra_admin,
        is_tenant_admin=auth.is_tenant_admin,
    )
    return {"items": items, "total": len(items)}


@router.get(
    "/search",
    dependencies=[Depends(require_permission_codes("kuaiai:entry:read"))],
)
async def search_documents(
    resource_key: str = Query(..., description="单据类型 resource_key"),
    keyword: Optional[str] = Query(None),
    page: int = Query(1, ge=1),
    page_size: int = Query(20, ge=1, le=50),
    auth: AuthContext = Depends(get_auth_context),
    tenant_id: int = Depends(get_current_tenant),
    current_user: User = Depends(get_current_user),
) -> dict[str, Any]:
    try:
        return await BusinessDocumentService.search(
            tenant_id=tenant_id,
            user=current_user,
            resource_key=resource_key,
            keyword=keyword,
            page=page,
            page_size=page_size,
            is_infra_admin=auth.is_infra_admin,
            is_tenant_admin=auth.is_tenant_admin,
        )
    except (AuthorizationError, NotFoundError, ValidationError) as exc:
        raise _http_error(exc) from exc


@router.get(
    "/search-multi",
    dependencies=[Depends(require_permission_codes("kuaiai:entry:read"))],
)
async def search_documents_multi(
    keyword: str = Query(..., min_length=1),
    resource_keys: Optional[str] = Query(None, description="逗号分隔的 resource_key 列表"),
    limit_per_type: int = Query(5, ge=1, le=10),
    auth: AuthContext = Depends(get_auth_context),
    tenant_id: int = Depends(get_current_tenant),
    current_user: User = Depends(get_current_user),
) -> dict[str, Any]:
    keys = [k.strip() for k in (resource_keys or "").split(",") if k.strip()] or None
    try:
        return await BusinessDocumentService.search_multi(
            tenant_id=tenant_id,
            user=current_user,
            keyword=keyword,
            resource_keys=keys,
            limit_per_type=limit_per_type,
            is_infra_admin=auth.is_infra_admin,
            is_tenant_admin=auth.is_tenant_admin,
        )
    except (AuthorizationError, NotFoundError, ValidationError) as exc:
        raise _http_error(exc) from exc


@router.get(
    "/{resource_key}/{record_id}",
    dependencies=[Depends(require_permission_codes("kuaiai:entry:read"))],
)
async def get_document(
    resource_key: str,
    record_id: int,
    auth: AuthContext = Depends(get_auth_context),
    tenant_id: int = Depends(get_current_tenant),
    current_user: User = Depends(get_current_user),
) -> dict[str, Any]:
    try:
        return await BusinessDocumentService.get(
            tenant_id=tenant_id,
            user=current_user,
            resource_key=resource_key,
            record_id=record_id,
            is_infra_admin=auth.is_infra_admin,
            is_tenant_admin=auth.is_tenant_admin,
        )
    except (AuthorizationError, NotFoundError, ValidationError) as exc:
        raise _http_error(exc) from exc
