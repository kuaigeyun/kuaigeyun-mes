"""最低工资 API。"""

from fastapi import APIRouter, Depends, HTTPException, Path, status

from apps.kuaioa.schemas.minimum_wage import MinimumWageCreate, MinimumWageUpdate
from apps.kuaioa.services.minimum_wage_service import MinimumWageService
from core.api.deps.access import require_permission_codes
from core.api.deps.deps import get_current_tenant
from infra.api.deps.deps import get_current_user
from infra.exceptions.exceptions import BusinessLogicError, NotFoundError
from infra.models.user import User

router = APIRouter(prefix="/minimum-wage", tags=["App - Kuaioa - Minimum Wage"])
svc = MinimumWageService()


@router.get("")
async def list_minimum_wage(
    _auth=Depends(require_permission_codes("kuaioa:minimum-wage:read")),
    tenant_id: int = Depends(get_current_tenant),
):
    rows = await svc.list_configs(tenant_id)
    return {"data": rows, "total": len(rows), "success": True}


@router.get("/{config_id}")
async def get_minimum_wage(
    config_id: int = Path(..., ge=1),
    _auth=Depends(require_permission_codes("kuaioa:minimum-wage:read")),
    tenant_id: int = Depends(get_current_tenant),
):
    try:
        return {"data": await svc.get_config(tenant_id, config_id), "success": True}
    except NotFoundError as e:
        raise HTTPException(status_code=status.HTTP_404_NOT_FOUND, detail={"message": str(e)})


@router.post("", status_code=status.HTTP_201_CREATED)
async def create_minimum_wage(
    data: MinimumWageCreate,
    current_user: User = Depends(get_current_user),
    _auth=Depends(require_permission_codes("kuaioa:minimum-wage:create")),
    tenant_id: int = Depends(get_current_tenant),
):
    try:
        return {
            "data": await svc.create_config(tenant_id, data, current_user.id),
            "success": True,
        }
    except BusinessLogicError as e:
        raise HTTPException(status_code=status.HTTP_400_BAD_REQUEST, detail={"message": str(e)})


@router.put("/{config_id}")
async def update_minimum_wage(
    data: MinimumWageUpdate,
    config_id: int = Path(..., ge=1),
    current_user: User = Depends(get_current_user),
    _auth=Depends(require_permission_codes("kuaioa:minimum-wage:update")),
    tenant_id: int = Depends(get_current_tenant),
):
    try:
        return {
            "data": await svc.update_config(tenant_id, config_id, data, current_user.id),
            "success": True,
        }
    except NotFoundError as e:
        raise HTTPException(status_code=status.HTTP_404_NOT_FOUND, detail={"message": str(e)})
    except BusinessLogicError as e:
        raise HTTPException(status_code=status.HTTP_400_BAD_REQUEST, detail={"message": str(e)})


@router.delete("/{config_id}")
async def delete_minimum_wage(
    config_id: int = Path(..., ge=1),
    current_user: User = Depends(get_current_user),
    _auth=Depends(require_permission_codes("kuaioa:minimum-wage:delete")),
    tenant_id: int = Depends(get_current_tenant),
):
    try:
        await svc.delete_config(tenant_id, config_id, current_user.id)
        return {"success": True}
    except NotFoundError as e:
        raise HTTPException(status_code=status.HTTP_404_NOT_FOUND, detail={"message": str(e)})
