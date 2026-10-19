"""收支类别 API"""

from typing import Literal, Optional

from fastapi import APIRouter, Depends, HTTPException, Query, Request, status

from apps.kuaizhizao.schemas.other_voucher import MiscCategoryBody, MiscCategoryUpdateBody
from apps.kuaizhizao.services.finance_misc_category_service import FinanceMiscCategoryService
from core.api.deps.access import AuthContext, ensure_permission_codes, get_auth_context
from core.api.deps.deps import get_current_tenant
from core.config.permission_contract import build_permission_code
from infra.api.deps.deps import get_current_user
from infra.exceptions.exceptions import NotFoundError, ValidationError
from infra.models.user import User

router = APIRouter(prefix="/finance-misc-categories", tags=["App - Kuaizhizao - Misc Categories"])
service = FinanceMiscCategoryService()


def _err(exc: Exception) -> HTTPException:
    if isinstance(exc, NotFoundError):
        return HTTPException(status_code=404, detail=str(exc))
    if isinstance(exc, ValidationError):
        return HTTPException(status_code=400, detail=str(exc))
    return HTTPException(status_code=400, detail=str(exc))


def _host_module_for_kind(kind: Literal["income", "expense"]) -> str:
    return "other-income" if kind == "income" else "other-expense"


async def _require_misc_category_read(
    kind: Literal["income", "expense"],
    request: Request,
    auth: AuthContext = Depends(get_auth_context),
    tenant_id: int = Depends(get_current_tenant),
) -> AuthContext:
    host = _host_module_for_kind(kind)
    await ensure_permission_codes(
        auth,
        tenant_id,
        request,
        [
            build_permission_code("kuaicaiwu", "finance-misc-category", "read"),
            build_permission_code("kuaicaiwu", host, "read"),
        ],
        require_all=False,
        check_abac=False,
    )
    auth.tenant_id = tenant_id
    return auth


async def _require_misc_category_create(
    kind: Literal["income", "expense"],
    request: Request,
    auth: AuthContext = Depends(get_auth_context),
    tenant_id: int = Depends(get_current_tenant),
) -> AuthContext:
    host = _host_module_for_kind(kind)
    await ensure_permission_codes(
        auth,
        tenant_id,
        request,
        [
            build_permission_code("kuaicaiwu", "finance-misc-category", "create"),
            build_permission_code("kuaicaiwu", host, "create"),
        ],
        require_all=False,
        check_abac=False,
    )
    auth.tenant_id = tenant_id
    return auth


@router.get("/{kind}")
async def list_categories(
    kind: Literal["income", "expense"],
    keyword: Optional[str] = None,
    is_active: Optional[bool] = None,
    ensure_defaults: bool = Query(False, description="租户无类别时写入产品预置项"),
    tenant_id: int = Depends(get_current_tenant),
    current_user: User = Depends(get_current_user),
    _auth: AuthContext = Depends(_require_misc_category_read),
):
    return await service.list_categories(
        tenant_id,
        kind,
        keyword=keyword,
        is_active=is_active,
        ensure_defaults=ensure_defaults,
        user=current_user,
    )


@router.post("/{kind}", status_code=status.HTTP_201_CREATED)
async def create_category(
    kind: Literal["income", "expense"],
    body: MiscCategoryBody,
    current_user: User = Depends(get_current_user),
    _auth: AuthContext = Depends(_require_misc_category_create),
):
    try:
        return await service.create_category(
            current_user.tenant_id, kind, body.model_dump(), current_user
        )
    except (NotFoundError, ValidationError) as exc:
        raise _err(exc) from exc


@router.put(
    "/{kind}/{category_id}",
    dependencies=[],
)
async def update_category(
    kind: Literal["income", "expense"],
    category_id: int,
    body: MiscCategoryUpdateBody,
    request: Request,
    auth: AuthContext = Depends(get_auth_context),
    current_user: User = Depends(get_current_user),
):
    await ensure_permission_codes(
        auth,
        current_user.tenant_id,
        request,
        [build_permission_code("kuaicaiwu", "finance-misc-category", "update")],
        require_all=True,
        check_abac=False,
    )
    try:
        return await service.update_category(
            current_user.tenant_id,
            kind,
            category_id,
            body.model_dump(exclude_unset=True),
            current_user,
        )
    except (NotFoundError, ValidationError) as exc:
        raise _err(exc) from exc


@router.delete(
    "/{kind}/{category_id}",
    status_code=status.HTTP_204_NO_CONTENT,
)
async def delete_category(
    kind: Literal["income", "expense"],
    category_id: int,
    request: Request,
    auth: AuthContext = Depends(get_auth_context),
    current_user: User = Depends(get_current_user),
):
    await ensure_permission_codes(
        auth,
        current_user.tenant_id,
        request,
        [build_permission_code("kuaicaiwu", "finance-misc-category", "delete")],
        require_all=True,
        check_abac=False,
    )
    try:
        await service.delete_category(current_user.tenant_id, kind, category_id, current_user)
    except (NotFoundError, ValidationError) as exc:
        raise _err(exc) from exc
