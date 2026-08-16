"""固定资产 API。"""

from typing import Optional

from fastapi import APIRouter, Depends, HTTPException, Path, Query, status
from pydantic import BaseModel, Field

from apps.kuaioa.schemas.asset import AssetCreate, AssetPurchaseCreate, AssetPurchaseUpdate, AssetUpdate
from apps.kuaioa.services.asset_service import AssetPurchaseService, AssetRegistryService
from core.api.deps.access import require_access
from core.api.deps.deps import get_current_tenant
from infra.api.deps.deps import get_current_user
from infra.exceptions.exceptions import BusinessLogicError, NotFoundError
from infra.models.user import User

router = APIRouter(prefix="/assets", tags=["App - Kuaioa - Assets"])
purchase_service = AssetPurchaseService()
asset_service = AssetRegistryService()


class AssetAssignRequest(BaseModel):
    custodian_id: int
    custodian_name: str = Field(..., max_length=100)


@router.get("/purchases", summary="List asset purchases")
async def list_asset_purchases(
    keyword: Optional[str] = Query(None),
    status_filter: Optional[str] = Query(None, alias="status"),
    _auth=Depends(require_access("kuaioa.asset-purchase", "read", required_permissions=["kuaioa:asset-purchase:read"])),
    tenant_id: int = Depends(get_current_tenant),
):
    rows = await purchase_service.list_purchases(tenant_id, keyword=keyword, status=status_filter)
    return {"data": rows, "total": len(rows), "success": True}


@router.post("/purchases", status_code=status.HTTP_201_CREATED, summary="Create asset purchase")
async def create_asset_purchase(
    data: AssetPurchaseCreate,
    current_user: User = Depends(get_current_user),
    _auth=Depends(require_access("kuaioa.asset-purchase", "create", required_permissions=["kuaioa:asset-purchase:create"])),
    tenant_id: int = Depends(get_current_tenant),
):
    row = await purchase_service.create_purchase(tenant_id, data, current_user)
    return {"data": row, "success": True}


@router.get("/purchases/{purchase_id}", summary="Get asset purchase")
async def get_asset_purchase(
    purchase_id: int = Path(..., ge=1),
    _auth=Depends(require_access("kuaioa.asset-purchase", "read", required_permissions=["kuaioa:asset-purchase:read"])),
    tenant_id: int = Depends(get_current_tenant),
):
    try:
        row = await purchase_service.get_purchase(tenant_id, purchase_id)
        return {"data": row, "success": True}
    except NotFoundError as e:
        raise HTTPException(status_code=status.HTTP_404_NOT_FOUND, detail={"message": str(e)})


@router.put("/purchases/{purchase_id}", summary="Update asset purchase")
async def update_asset_purchase(
    data: AssetPurchaseUpdate,
    purchase_id: int = Path(..., ge=1),
    current_user: User = Depends(get_current_user),
    _auth=Depends(require_access("kuaioa.asset-purchase", "update", required_permissions=["kuaioa:asset-purchase:update"])),
    tenant_id: int = Depends(get_current_tenant),
):
    try:
        row = await purchase_service.update_purchase(tenant_id, purchase_id, data, current_user.id)
        return {"data": row, "success": True}
    except (NotFoundError, BusinessLogicError) as e:
        code = status.HTTP_404_NOT_FOUND if isinstance(e, NotFoundError) else status.HTTP_409_CONFLICT
        raise HTTPException(status_code=code, detail={"message": str(e)})


@router.delete("/purchases/{purchase_id}", summary="Delete asset purchase")
async def delete_asset_purchase(
    purchase_id: int = Path(..., ge=1),
    current_user: User = Depends(get_current_user),
    _auth=Depends(require_access("kuaioa.asset-purchase", "delete", required_permissions=["kuaioa:asset-purchase:delete"])),
    tenant_id: int = Depends(get_current_tenant),
):
    try:
        await purchase_service.delete_purchase(tenant_id, purchase_id, current_user.id)
        return {"success": True}
    except (NotFoundError, BusinessLogicError) as e:
        code = status.HTTP_404_NOT_FOUND if isinstance(e, NotFoundError) else status.HTTP_409_CONFLICT
        raise HTTPException(status_code=code, detail={"message": str(e)})


@router.post("/purchases/{purchase_id}/submit", summary="Submit asset purchase")
async def submit_asset_purchase(
    purchase_id: int = Path(..., ge=1),
    current_user: User = Depends(get_current_user),
    _auth=Depends(require_access("kuaioa.asset-purchase", "submit", required_permissions=["kuaioa:asset-purchase:submit"])),
    tenant_id: int = Depends(get_current_tenant),
):
    try:
        row = await purchase_service.submit_purchase(tenant_id, purchase_id, current_user.id)
        return {"data": row, "success": True}
    except (NotFoundError, BusinessLogicError) as e:
        code = status.HTTP_404_NOT_FOUND if isinstance(e, NotFoundError) else status.HTTP_409_CONFLICT
        raise HTTPException(status_code=code, detail={"message": str(e)})


@router.post("/purchases/{purchase_id}/revoke", summary="Revoke asset purchase")
async def revoke_asset_purchase(
    purchase_id: int = Path(..., ge=1),
    current_user: User = Depends(get_current_user),
    _auth=Depends(require_access("kuaioa.asset-purchase", "revoke", required_permissions=["kuaioa:asset-purchase:revoke"])),
    tenant_id: int = Depends(get_current_tenant),
):
    try:
        row = await purchase_service.revoke_purchase(tenant_id, purchase_id, current_user.id)
        return {"data": row, "success": True}
    except (NotFoundError, BusinessLogicError) as e:
        code = status.HTTP_404_NOT_FOUND if isinstance(e, NotFoundError) else status.HTTP_409_CONFLICT
        raise HTTPException(status_code=code, detail={"message": str(e)})


@router.post("/purchases/{purchase_id}/register", summary="Register asset from purchase")
async def register_asset_from_purchase(
    purchase_id: int = Path(..., ge=1),
    current_user: User = Depends(get_current_user),
    _auth=Depends(require_access("kuaioa.asset", "create", required_permissions=["kuaioa:asset:create"])),
    tenant_id: int = Depends(get_current_tenant),
):
    try:
        row = await purchase_service.register_asset_from_purchase(tenant_id, purchase_id, current_user.id)
        return {"data": row, "success": True}
    except (NotFoundError, BusinessLogicError) as e:
        code = status.HTTP_404_NOT_FOUND if isinstance(e, NotFoundError) else status.HTTP_409_CONFLICT
        raise HTTPException(status_code=code, detail={"message": str(e)})


@router.get("/registry", summary="List fixed assets")
async def list_assets(
    keyword: Optional[str] = Query(None),
    status_filter: Optional[str] = Query(None, alias="status"),
    _auth=Depends(require_access("kuaioa.asset", "read", required_permissions=["kuaioa:asset:read"])),
    tenant_id: int = Depends(get_current_tenant),
):
    rows = await asset_service.list_assets(tenant_id, keyword=keyword, status=status_filter)
    return {"data": rows, "total": len(rows), "success": True}


@router.post("/registry", status_code=status.HTTP_201_CREATED, summary="Create fixed asset")
async def create_asset(
    data: AssetCreate,
    current_user: User = Depends(get_current_user),
    _auth=Depends(require_access("kuaioa.asset", "create", required_permissions=["kuaioa:asset:create"])),
    tenant_id: int = Depends(get_current_tenant),
):
    row = await asset_service.create_asset(tenant_id, data, current_user.id)
    return {"data": row, "success": True}


@router.get("/registry/{asset_id}", summary="Get fixed asset")
async def get_asset(
    asset_id: int = Path(..., ge=1),
    _auth=Depends(require_access("kuaioa.asset", "read", required_permissions=["kuaioa:asset:read"])),
    tenant_id: int = Depends(get_current_tenant),
):
    try:
        row = await asset_service.get_asset(tenant_id, asset_id)
        return {"data": row, "success": True}
    except NotFoundError as e:
        raise HTTPException(status_code=status.HTTP_404_NOT_FOUND, detail={"message": str(e)})


@router.put("/registry/{asset_id}", summary="Update fixed asset")
async def update_asset(
    data: AssetUpdate,
    asset_id: int = Path(..., ge=1),
    current_user: User = Depends(get_current_user),
    _auth=Depends(require_access("kuaioa.asset", "update", required_permissions=["kuaioa:asset:update"])),
    tenant_id: int = Depends(get_current_tenant),
):
    try:
        row = await asset_service.update_asset(tenant_id, asset_id, data, current_user.id)
        return {"data": row, "success": True}
    except NotFoundError as e:
        raise HTTPException(status_code=status.HTTP_404_NOT_FOUND, detail={"message": str(e)})


@router.delete("/registry/{asset_id}", summary="Delete fixed asset")
async def delete_asset(
    asset_id: int = Path(..., ge=1),
    current_user: User = Depends(get_current_user),
    _auth=Depends(require_access("kuaioa.asset", "delete", required_permissions=["kuaioa:asset:delete"])),
    tenant_id: int = Depends(get_current_tenant),
):
    try:
        await asset_service.delete_asset(tenant_id, asset_id, current_user.id)
        return {"success": True}
    except NotFoundError as e:
        raise HTTPException(status_code=status.HTTP_404_NOT_FOUND, detail={"message": str(e)})


@router.post("/registry/{asset_id}/assign", summary="Assign asset")
async def assign_asset(
    data: AssetAssignRequest,
    asset_id: int = Path(..., ge=1),
    current_user: User = Depends(get_current_user),
    _auth=Depends(require_access("kuaioa.asset", "update", required_permissions=["kuaioa:asset:update"])),
    tenant_id: int = Depends(get_current_tenant),
):
    try:
        row = await asset_service.assign_asset(
            tenant_id,
            asset_id,
            custodian_id=data.custodian_id,
            custodian_name=data.custodian_name,
            user_id=current_user.id,
        )
        return {"data": row, "success": True}
    except NotFoundError as e:
        raise HTTPException(status_code=status.HTTP_404_NOT_FOUND, detail={"message": str(e)})


@router.post("/registry/{asset_id}/return", summary="Return asset")
async def return_asset(
    asset_id: int = Path(..., ge=1),
    current_user: User = Depends(get_current_user),
    _auth=Depends(require_access("kuaioa.asset", "update", required_permissions=["kuaioa:asset:update"])),
    tenant_id: int = Depends(get_current_tenant),
):
    try:
        row = await asset_service.return_asset(tenant_id, asset_id, current_user.id)
        return {"data": row, "success": True}
    except NotFoundError as e:
        raise HTTPException(status_code=status.HTTP_404_NOT_FOUND, detail={"message": str(e)})


@router.post("/registry/{asset_id}/scrap", summary="Scrap asset")
async def scrap_asset(
    asset_id: int = Path(..., ge=1),
    current_user: User = Depends(get_current_user),
    _auth=Depends(require_access("kuaioa.asset", "update", required_permissions=["kuaioa:asset:update"])),
    tenant_id: int = Depends(get_current_tenant),
):
    try:
        row = await asset_service.scrap_asset(tenant_id, asset_id, current_user.id)
        return {"data": row, "success": True}
    except NotFoundError as e:
        raise HTTPException(status_code=status.HTTP_404_NOT_FOUND, detail={"message": str(e)})
