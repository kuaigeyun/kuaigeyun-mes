"""制造协同 API。"""

from typing import Optional

from fastapi import APIRouter, Depends, HTTPException, Path, Query, status

from apps.kuaioa.schemas.collaboration import (
    ConcessionRequestCreate,
    ConcessionRequestUpdate,
    ProcessDeviationCreate,
    ProcessDeviationUpdate,
    SpecialPriceRequestCreate,
    SpecialPriceRequestUpdate,
)
from apps.kuaioa.services.collaboration_service import (
    ConcessionRequestService,
    ProcessDeviationService,
    SpecialPriceRequestService,
)
from core.api.deps.access import require_access
from core.api.deps.deps import get_current_tenant
from infra.api.deps.deps import get_current_user
from infra.exceptions.exceptions import BusinessLogicError, NotFoundError
from infra.models.user import User

router = APIRouter(prefix="/collaboration", tags=["App - Kuaioa - Collaboration"])

special_price_service = SpecialPriceRequestService()
concession_service = ConcessionRequestService()
process_deviation_service = ProcessDeviationService()


def _http_error(e: Exception) -> HTTPException:
    code = status.HTTP_404_NOT_FOUND if isinstance(e, NotFoundError) else status.HTTP_409_CONFLICT
    return HTTPException(status_code=code, detail={"message": str(e)})


# --- 特价申请 ---


@router.get("/special-price", summary="List special price requests")
async def list_special_price(
    keyword: Optional[str] = Query(None),
    status_filter: Optional[str] = Query(None, alias="status"),
    _auth=Depends(require_access("kuaioa.special-price", "read", required_permissions=["kuaioa:special-price:read"])),
    tenant_id: int = Depends(get_current_tenant),
):
    rows = await special_price_service.list_requests(tenant_id, keyword=keyword, status=status_filter)
    return {"data": rows, "total": len(rows), "success": True}


@router.get("/special-price/{request_id}", summary="Get special price request")
async def get_special_price(
    request_id: int = Path(..., ge=1),
    _auth=Depends(require_access("kuaioa.special-price", "read", required_permissions=["kuaioa:special-price:read"])),
    tenant_id: int = Depends(get_current_tenant),
):
    try:
        return {"data": await special_price_service.get_request(tenant_id, request_id), "success": True}
    except NotFoundError as e:
        raise HTTPException(status_code=status.HTTP_404_NOT_FOUND, detail={"message": str(e)})


@router.post("/special-price", status_code=status.HTTP_201_CREATED, summary="Create special price request")
async def create_special_price(
    data: SpecialPriceRequestCreate,
    current_user: User = Depends(get_current_user),
    _auth=Depends(require_access("kuaioa.special-price", "create", required_permissions=["kuaioa:special-price:create"])),
    tenant_id: int = Depends(get_current_tenant),
):
    row = await special_price_service.create_request(tenant_id, data, current_user)
    return {"data": row, "success": True}


@router.put("/special-price/{request_id}", summary="Update special price request")
async def update_special_price(
    data: SpecialPriceRequestUpdate,
    request_id: int = Path(..., ge=1),
    current_user: User = Depends(get_current_user),
    _auth=Depends(require_access("kuaioa.special-price", "update", required_permissions=["kuaioa:special-price:update"])),
    tenant_id: int = Depends(get_current_tenant),
):
    try:
        return {"data": await special_price_service.update_request(tenant_id, request_id, data, current_user), "success": True}
    except (NotFoundError, BusinessLogicError) as e:
        raise _http_error(e)


@router.delete("/special-price/{request_id}", summary="Delete special price request")
async def delete_special_price(
    request_id: int = Path(..., ge=1),
    current_user: User = Depends(get_current_user),
    _auth=Depends(require_access("kuaioa.special-price", "delete", required_permissions=["kuaioa:special-price:delete"])),
    tenant_id: int = Depends(get_current_tenant),
):
    try:
        await special_price_service.delete_request(tenant_id, request_id, current_user)
        return {"success": True}
    except (NotFoundError, BusinessLogicError) as e:
        raise _http_error(e)


@router.post("/special-price/{request_id}/submit", summary="Submit special price request")
async def submit_special_price(
    request_id: int = Path(..., ge=1),
    current_user: User = Depends(get_current_user),
    _auth=Depends(require_access("kuaioa.special-price", "submit", required_permissions=["kuaioa:special-price:submit"])),
    tenant_id: int = Depends(get_current_tenant),
):
    try:
        return {"data": await special_price_service.submit_request(tenant_id, request_id, current_user.id), "success": True}
    except (NotFoundError, BusinessLogicError) as e:
        raise _http_error(e)


@router.post("/special-price/{request_id}/revoke", summary="Revoke special price request")
async def revoke_special_price(
    request_id: int = Path(..., ge=1),
    current_user: User = Depends(get_current_user),
    _auth=Depends(require_access("kuaioa.special-price", "revoke", required_permissions=["kuaioa:special-price:revoke"])),
    tenant_id: int = Depends(get_current_tenant),
):
    try:
        return {"data": await special_price_service.revoke_request(tenant_id, request_id, current_user.id), "success": True}
    except (NotFoundError, BusinessLogicError) as e:
        raise _http_error(e)


# --- 让步接收 ---


@router.get("/concession", summary="List concession requests")
async def list_concession(
    keyword: Optional[str] = Query(None),
    status_filter: Optional[str] = Query(None, alias="status"),
    _auth=Depends(require_access("kuaioa.concession", "read", required_permissions=["kuaioa:concession:read"])),
    tenant_id: int = Depends(get_current_tenant),
):
    rows = await concession_service.list_requests(tenant_id, keyword=keyword, status=status_filter)
    return {"data": rows, "total": len(rows), "success": True}


@router.get("/concession/{request_id}", summary="Get concession request")
async def get_concession(
    request_id: int = Path(..., ge=1),
    _auth=Depends(require_access("kuaioa.concession", "read", required_permissions=["kuaioa:concession:read"])),
    tenant_id: int = Depends(get_current_tenant),
):
    try:
        return {"data": await concession_service.get_request(tenant_id, request_id), "success": True}
    except NotFoundError as e:
        raise HTTPException(status_code=status.HTTP_404_NOT_FOUND, detail={"message": str(e)})


@router.post("/concession", status_code=status.HTTP_201_CREATED, summary="Create concession request")
async def create_concession(
    data: ConcessionRequestCreate,
    current_user: User = Depends(get_current_user),
    _auth=Depends(require_access("kuaioa.concession", "create", required_permissions=["kuaioa:concession:create"])),
    tenant_id: int = Depends(get_current_tenant),
):
    row = await concession_service.create_request(tenant_id, data, current_user)
    return {"data": row, "success": True}


@router.put("/concession/{request_id}", summary="Update concession request")
async def update_concession(
    data: ConcessionRequestUpdate,
    request_id: int = Path(..., ge=1),
    current_user: User = Depends(get_current_user),
    _auth=Depends(require_access("kuaioa.concession", "update", required_permissions=["kuaioa:concession:update"])),
    tenant_id: int = Depends(get_current_tenant),
):
    try:
        return {"data": await concession_service.update_request(tenant_id, request_id, data, current_user), "success": True}
    except (NotFoundError, BusinessLogicError) as e:
        raise _http_error(e)


@router.delete("/concession/{request_id}", summary="Delete concession request")
async def delete_concession(
    request_id: int = Path(..., ge=1),
    current_user: User = Depends(get_current_user),
    _auth=Depends(require_access("kuaioa.concession", "delete", required_permissions=["kuaioa:concession:delete"])),
    tenant_id: int = Depends(get_current_tenant),
):
    try:
        await concession_service.delete_request(tenant_id, request_id, current_user)
        return {"success": True}
    except (NotFoundError, BusinessLogicError) as e:
        raise _http_error(e)


@router.post("/concession/{request_id}/submit", summary="Submit concession request")
async def submit_concession(
    request_id: int = Path(..., ge=1),
    current_user: User = Depends(get_current_user),
    _auth=Depends(require_access("kuaioa.concession", "submit", required_permissions=["kuaioa:concession:submit"])),
    tenant_id: int = Depends(get_current_tenant),
):
    try:
        return {"data": await concession_service.submit_request(tenant_id, request_id, current_user.id), "success": True}
    except (NotFoundError, BusinessLogicError) as e:
        raise _http_error(e)


@router.post("/concession/{request_id}/revoke", summary="Revoke concession request")
async def revoke_concession(
    request_id: int = Path(..., ge=1),
    current_user: User = Depends(get_current_user),
    _auth=Depends(require_access("kuaioa.concession", "revoke", required_permissions=["kuaioa:concession:revoke"])),
    tenant_id: int = Depends(get_current_tenant),
):
    try:
        return {"data": await concession_service.revoke_request(tenant_id, request_id, current_user.id), "success": True}
    except (NotFoundError, BusinessLogicError) as e:
        raise _http_error(e)


# --- 工艺偏离 ---


@router.get("/process-deviation", summary="List process deviation requests")
async def list_process_deviation(
    keyword: Optional[str] = Query(None),
    status_filter: Optional[str] = Query(None, alias="status"),
    _auth=Depends(require_access("kuaioa.process-deviation", "read", required_permissions=["kuaioa:process-deviation:read"])),
    tenant_id: int = Depends(get_current_tenant),
):
    rows = await process_deviation_service.list_requests(tenant_id, keyword=keyword, status=status_filter)
    return {"data": rows, "total": len(rows), "success": True}


@router.get("/process-deviation/{request_id}", summary="Get process deviation request")
async def get_process_deviation(
    request_id: int = Path(..., ge=1),
    _auth=Depends(require_access("kuaioa.process-deviation", "read", required_permissions=["kuaioa:process-deviation:read"])),
    tenant_id: int = Depends(get_current_tenant),
):
    try:
        return {"data": await process_deviation_service.get_request(tenant_id, request_id), "success": True}
    except NotFoundError as e:
        raise HTTPException(status_code=status.HTTP_404_NOT_FOUND, detail={"message": str(e)})


@router.post("/process-deviation", status_code=status.HTTP_201_CREATED, summary="Create process deviation request")
async def create_process_deviation(
    data: ProcessDeviationCreate,
    current_user: User = Depends(get_current_user),
    _auth=Depends(require_access("kuaioa.process-deviation", "create", required_permissions=["kuaioa:process-deviation:create"])),
    tenant_id: int = Depends(get_current_tenant),
):
    row = await process_deviation_service.create_request(tenant_id, data, current_user)
    return {"data": row, "success": True}


@router.put("/process-deviation/{request_id}", summary="Update process deviation request")
async def update_process_deviation(
    data: ProcessDeviationUpdate,
    request_id: int = Path(..., ge=1),
    current_user: User = Depends(get_current_user),
    _auth=Depends(require_access("kuaioa.process-deviation", "update", required_permissions=["kuaioa:process-deviation:update"])),
    tenant_id: int = Depends(get_current_tenant),
):
    try:
        return {"data": await process_deviation_service.update_request(tenant_id, request_id, data, current_user), "success": True}
    except (NotFoundError, BusinessLogicError) as e:
        raise _http_error(e)


@router.delete("/process-deviation/{request_id}", summary="Delete process deviation request")
async def delete_process_deviation(
    request_id: int = Path(..., ge=1),
    current_user: User = Depends(get_current_user),
    _auth=Depends(require_access("kuaioa.process-deviation", "delete", required_permissions=["kuaioa:process-deviation:delete"])),
    tenant_id: int = Depends(get_current_tenant),
):
    try:
        await process_deviation_service.delete_request(tenant_id, request_id, current_user)
        return {"success": True}
    except (NotFoundError, BusinessLogicError) as e:
        raise _http_error(e)


@router.post("/process-deviation/{request_id}/submit", summary="Submit process deviation request")
async def submit_process_deviation(
    request_id: int = Path(..., ge=1),
    current_user: User = Depends(get_current_user),
    _auth=Depends(require_access("kuaioa.process-deviation", "submit", required_permissions=["kuaioa:process-deviation:submit"])),
    tenant_id: int = Depends(get_current_tenant),
):
    try:
        return {"data": await process_deviation_service.submit_request(tenant_id, request_id, current_user.id), "success": True}
    except (NotFoundError, BusinessLogicError) as e:
        raise _http_error(e)


@router.post("/process-deviation/{request_id}/revoke", summary="Revoke process deviation request")
async def revoke_process_deviation(
    request_id: int = Path(..., ge=1),
    current_user: User = Depends(get_current_user),
    _auth=Depends(require_access("kuaioa.process-deviation", "revoke", required_permissions=["kuaioa:process-deviation:revoke"])),
    tenant_id: int = Depends(get_current_tenant),
):
    try:
        return {"data": await process_deviation_service.revoke_request(tenant_id, request_id, current_user.id), "success": True}
    except (NotFoundError, BusinessLogicError) as e:
        raise _http_error(e)
