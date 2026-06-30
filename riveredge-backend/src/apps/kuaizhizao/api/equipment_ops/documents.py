"""
设备运营单据 API：点检单、巡检单、报废申请。
"""

from typing import Optional

from fastapi import APIRouter, Depends, HTTPException, Query, status

from core.api.deps.access import require_permission_codes
from core.api.deps.deps import get_current_tenant
from infra.api.deps.deps import get_current_user as soil_get_current_user
from infra.exceptions.exceptions import NotFoundError, ValidationError
from infra.models.user import User

from apps.kuaizhizao.schemas.equipment_ops import (
    SpotCheckCreate,
    SpotCheckUpdate,
    SpotCheckResponse,
    SpotCheckListResponse,
    SpotCheckLineResponse,
    SpotCheckPreviewResponse,
    RoutePatrolCreate,
    RoutePatrolUpdate,
    RoutePatrolResponse,
    RoutePatrolListResponse,
    RoutePatrolLineResponse,
    RoutePatrolPreviewResponse,
    ScrapApplicationCreate,
    ScrapApplicationUpdate,
    ScrapApplicationResponse,
    ScrapApplicationListResponse,
    ScrapApplicationReject,
    TransferApplicationCreate,
    TransferApplicationUpdate,
    TransferApplicationResponse,
    TransferApplicationListResponse,
    TransferApplicationReject,
)
from apps.kuaizhizao.services.equipment_ops_service import EquipmentOpsService

router = APIRouter()
svc = EquipmentOpsService()


def _spot_check_response(header, lines=None) -> SpotCheckResponse:
    resp = SpotCheckResponse.model_validate(header)
    if lines is not None:
        resp.lines = [SpotCheckLineResponse.model_validate(l) for l in lines]
    return resp


def _route_patrol_response(header, lines=None) -> RoutePatrolResponse:
    resp = RoutePatrolResponse.model_validate(header)
    if lines is not None:
        resp.lines = [RoutePatrolLineResponse.model_validate(l) for l in lines]
    return resp


# ---------- 点检单 ----------

@router.get("/equipment-spot-checks/preview-lines", response_model=SpotCheckPreviewResponse)
async def preview_spot_check_lines(
    equipment_id: int = Query(..., ge=1),
    scheme_id: Optional[int] = Query(None, ge=1),
    tenant_id: int = Depends(get_current_tenant),
):
    try:
        return await svc.spot_check_service.preview_lines(tenant_id, equipment_id, scheme_id)
    except (ValidationError, NotFoundError) as e:
        code = status.HTTP_404_NOT_FOUND if isinstance(e, NotFoundError) else status.HTTP_422_UNPROCESSABLE_ENTITY
        raise HTTPException(status_code=code, detail=str(e))


@router.post(
    "/equipment-spot-checks",
    response_model=SpotCheckResponse,
    status_code=status.HTTP_201_CREATED,
    dependencies=[Depends(require_permission_codes("kuaizhizao:equipment-spot-check:create"))],
)
async def create_spot_check(
    data: SpotCheckCreate,
    current_user: User = Depends(soil_get_current_user),
    tenant_id: int = Depends(get_current_tenant),
):
    try:
        header = await svc.spot_check_service.create(
            tenant_id,
            data,
            operator_id=current_user.id,
            operator_name=current_user.nickname or current_user.username,
        )
        lines = await svc.spot_check_service._load_lines(tenant_id, header.id)
        return _spot_check_response(header, lines)
    except (ValidationError, NotFoundError) as e:
        code = status.HTTP_404_NOT_FOUND if isinstance(e, NotFoundError) else status.HTTP_422_UNPROCESSABLE_ENTITY
        raise HTTPException(status_code=code, detail=str(e))


@router.get("/equipment-spot-checks", response_model=SpotCheckListResponse)
async def list_spot_checks(
    skip: int = Query(0, ge=0),
    limit: int = Query(100, ge=1, le=1000),
    equipment_id: Optional[int] = Query(None, ge=1),
    status_filter: Optional[str] = Query(None, alias="status"),
    tenant_id: int = Depends(get_current_tenant),
):
    rows, total = await svc.spot_check_service.list(tenant_id, skip, limit, equipment_id, status_filter)
    return SpotCheckListResponse(
        items=[SpotCheckResponse.model_validate(r) for r in rows],
        total=total,
        skip=skip,
        limit=limit,
    )


@router.get("/equipment-spot-checks/{row_id}", response_model=SpotCheckResponse)
async def get_spot_check(row_id: int, tenant_id: int = Depends(get_current_tenant)):
    try:
        header = await svc.spot_check_service.get(tenant_id, row_id)
        lines = await svc.spot_check_service._load_lines(tenant_id, header.id)
        return _spot_check_response(header, lines)
    except NotFoundError as e:
        raise HTTPException(status_code=status.HTTP_404_NOT_FOUND, detail=str(e))


@router.put(
    "/equipment-spot-checks/{row_id}",
    response_model=SpotCheckResponse,
    dependencies=[Depends(require_permission_codes("kuaizhizao:equipment-spot-check:update"))],
)
async def update_spot_check(
    row_id: int,
    data: SpotCheckUpdate,
    tenant_id: int = Depends(get_current_tenant),
):
    try:
        header = await svc.spot_check_service.update(tenant_id, row_id, data)
        lines = await svc.spot_check_service._load_lines(tenant_id, header.id)
        return _spot_check_response(header, lines)
    except (ValidationError, NotFoundError) as e:
        code = status.HTTP_404_NOT_FOUND if isinstance(e, NotFoundError) else status.HTTP_422_UNPROCESSABLE_ENTITY
        raise HTTPException(status_code=code, detail=str(e))


@router.delete(
    "/equipment-spot-checks/{row_id}",
    status_code=status.HTTP_204_NO_CONTENT,
    dependencies=[Depends(require_permission_codes("kuaizhizao:equipment-spot-check:delete"))],
)
async def delete_spot_check(row_id: int, tenant_id: int = Depends(get_current_tenant)):
    try:
        await svc.spot_check_service.delete(tenant_id, row_id)
    except NotFoundError as e:
        raise HTTPException(status_code=status.HTTP_404_NOT_FOUND, detail=str(e))


# ---------- 巡检单 ----------

@router.get("/equipment-route-patrols/preview-lines", response_model=RoutePatrolPreviewResponse)
async def preview_route_patrol_lines(
    route_id: int = Query(..., ge=1),
    tenant_id: int = Depends(get_current_tenant),
):
    try:
        return await svc.route_patrol_service.preview_lines(tenant_id, route_id)
    except (ValidationError, NotFoundError) as e:
        code = status.HTTP_404_NOT_FOUND if isinstance(e, NotFoundError) else status.HTTP_422_UNPROCESSABLE_ENTITY
        raise HTTPException(status_code=code, detail=str(e))


@router.post(
    "/equipment-route-patrols",
    response_model=RoutePatrolResponse,
    status_code=status.HTTP_201_CREATED,
    dependencies=[Depends(require_permission_codes("kuaizhizao:equipment-route-patrol:create"))],
)
async def create_route_patrol(
    data: RoutePatrolCreate,
    current_user: User = Depends(soil_get_current_user),
    tenant_id: int = Depends(get_current_tenant),
):
    try:
        header = await svc.route_patrol_service.create(
            tenant_id,
            data,
            operator_id=current_user.id,
            operator_name=current_user.nickname or current_user.username,
        )
        lines = await svc.route_patrol_service._load_lines(tenant_id, header.id)
        return _route_patrol_response(header, lines)
    except (ValidationError, NotFoundError) as e:
        code = status.HTTP_404_NOT_FOUND if isinstance(e, NotFoundError) else status.HTTP_422_UNPROCESSABLE_ENTITY
        raise HTTPException(status_code=code, detail=str(e))


@router.get("/equipment-route-patrols", response_model=RoutePatrolListResponse)
async def list_route_patrols(
    skip: int = Query(0, ge=0),
    limit: int = Query(100, ge=1, le=1000),
    route_id: Optional[int] = Query(None, ge=1),
    status_filter: Optional[str] = Query(None, alias="status"),
    tenant_id: int = Depends(get_current_tenant),
):
    rows, total = await svc.route_patrol_service.list(tenant_id, skip, limit, route_id, status_filter)
    return RoutePatrolListResponse(
        items=[RoutePatrolResponse.model_validate(r) for r in rows],
        total=total,
        skip=skip,
        limit=limit,
    )


@router.get("/equipment-route-patrols/{row_id}", response_model=RoutePatrolResponse)
async def get_route_patrol(row_id: int, tenant_id: int = Depends(get_current_tenant)):
    try:
        header = await svc.route_patrol_service.get(tenant_id, row_id)
        lines = await svc.route_patrol_service._load_lines(tenant_id, header.id)
        return _route_patrol_response(header, lines)
    except NotFoundError as e:
        raise HTTPException(status_code=status.HTTP_404_NOT_FOUND, detail=str(e))


@router.put(
    "/equipment-route-patrols/{row_id}",
    response_model=RoutePatrolResponse,
    dependencies=[Depends(require_permission_codes("kuaizhizao:equipment-route-patrol:update"))],
)
async def update_route_patrol(
    row_id: int,
    data: RoutePatrolUpdate,
    tenant_id: int = Depends(get_current_tenant),
):
    try:
        header = await svc.route_patrol_service.update(tenant_id, row_id, data)
        lines = await svc.route_patrol_service._load_lines(tenant_id, header.id)
        return _route_patrol_response(header, lines)
    except (ValidationError, NotFoundError) as e:
        code = status.HTTP_404_NOT_FOUND if isinstance(e, NotFoundError) else status.HTTP_422_UNPROCESSABLE_ENTITY
        raise HTTPException(status_code=code, detail=str(e))


@router.delete(
    "/equipment-route-patrols/{row_id}",
    status_code=status.HTTP_204_NO_CONTENT,
    dependencies=[Depends(require_permission_codes("kuaizhizao:equipment-route-patrol:delete"))],
)
async def delete_route_patrol(row_id: int, tenant_id: int = Depends(get_current_tenant)):
    try:
        await svc.route_patrol_service.delete(tenant_id, row_id)
    except NotFoundError as e:
        raise HTTPException(status_code=status.HTTP_404_NOT_FOUND, detail=str(e))


# ---------- 报废申请 ----------

@router.post(
    "/equipment-scrap-applications",
    response_model=ScrapApplicationResponse,
    status_code=status.HTTP_201_CREATED,
    dependencies=[Depends(require_permission_codes("kuaizhizao:equipment-scrap:create"))],
)
async def create_scrap_application(
    data: ScrapApplicationCreate,
    current_user: User = Depends(soil_get_current_user),
    tenant_id: int = Depends(get_current_tenant),
):
    try:
        row = await svc.scrap_application_service.create(
            tenant_id,
            data,
            operator_id=current_user.id,
            operator_name=current_user.nickname or current_user.username,
        )
        return ScrapApplicationResponse.model_validate(row)
    except (ValidationError, NotFoundError) as e:
        code = status.HTTP_404_NOT_FOUND if isinstance(e, NotFoundError) else status.HTTP_422_UNPROCESSABLE_ENTITY
        raise HTTPException(status_code=code, detail=str(e))


@router.get("/equipment-scrap-applications", response_model=ScrapApplicationListResponse)
async def list_scrap_applications(
    skip: int = Query(0, ge=0),
    limit: int = Query(100, ge=1, le=1000),
    equipment_id: Optional[int] = Query(None, ge=1),
    status_filter: Optional[str] = Query(None, alias="status"),
    tenant_id: int = Depends(get_current_tenant),
):
    rows, total = await svc.scrap_application_service.list(
        tenant_id, skip, limit, equipment_id, status_filter
    )
    return ScrapApplicationListResponse(
        items=[ScrapApplicationResponse.model_validate(r) for r in rows],
        total=total,
        skip=skip,
        limit=limit,
    )


@router.get("/equipment-scrap-applications/{row_id}", response_model=ScrapApplicationResponse)
async def get_scrap_application(row_id: int, tenant_id: int = Depends(get_current_tenant)):
    try:
        row = await svc.scrap_application_service.get(tenant_id, row_id)
        return ScrapApplicationResponse.model_validate(row)
    except NotFoundError as e:
        raise HTTPException(status_code=status.HTTP_404_NOT_FOUND, detail=str(e))


@router.put(
    "/equipment-scrap-applications/{row_id}",
    response_model=ScrapApplicationResponse,
    dependencies=[Depends(require_permission_codes("kuaizhizao:equipment-scrap:update"))],
)
async def update_scrap_application(
    row_id: int,
    data: ScrapApplicationUpdate,
    tenant_id: int = Depends(get_current_tenant),
):
    try:
        row = await svc.scrap_application_service.update(tenant_id, row_id, data)
        return ScrapApplicationResponse.model_validate(row)
    except (ValidationError, NotFoundError) as e:
        code = status.HTTP_404_NOT_FOUND if isinstance(e, NotFoundError) else status.HTTP_422_UNPROCESSABLE_ENTITY
        raise HTTPException(status_code=code, detail=str(e))


@router.post(
    "/equipment-scrap-applications/{row_id}/submit",
    response_model=ScrapApplicationResponse,
    dependencies=[Depends(require_permission_codes("kuaizhizao:equipment-scrap:submit"))],
)
async def submit_scrap_application(row_id: int, tenant_id: int = Depends(get_current_tenant)):
    try:
        row = await svc.scrap_application_service.submit(tenant_id, row_id)
        return ScrapApplicationResponse.model_validate(row)
    except (ValidationError, NotFoundError) as e:
        code = status.HTTP_404_NOT_FOUND if isinstance(e, NotFoundError) else status.HTTP_422_UNPROCESSABLE_ENTITY
        raise HTTPException(status_code=code, detail=str(e))


@router.post(
    "/equipment-scrap-applications/{row_id}/approve",
    response_model=ScrapApplicationResponse,
    dependencies=[Depends(require_permission_codes("kuaizhizao:equipment-scrap:approve"))],
)
async def approve_scrap_application(
    row_id: int,
    current_user: User = Depends(soil_get_current_user),
    tenant_id: int = Depends(get_current_tenant),
):
    try:
        row = await svc.scrap_application_service.approve(
            tenant_id,
            row_id,
            approver_id=current_user.id,
            approver_name=current_user.nickname or current_user.username,
        )
        return ScrapApplicationResponse.model_validate(row)
    except (ValidationError, NotFoundError) as e:
        code = status.HTTP_404_NOT_FOUND if isinstance(e, NotFoundError) else status.HTTP_422_UNPROCESSABLE_ENTITY
        raise HTTPException(status_code=code, detail=str(e))


@router.post(
    "/equipment-scrap-applications/{row_id}/reject",
    response_model=ScrapApplicationResponse,
    dependencies=[Depends(require_permission_codes("kuaizhizao:equipment-scrap:reject"))],
)
async def reject_scrap_application(
    row_id: int,
    body: ScrapApplicationReject,
    current_user: User = Depends(soil_get_current_user),
    tenant_id: int = Depends(get_current_tenant),
):
    try:
        row = await svc.scrap_application_service.reject(
            tenant_id,
            row_id,
            body.reject_reason,
            approver_id=current_user.id,
            approver_name=current_user.nickname or current_user.username,
        )
        return ScrapApplicationResponse.model_validate(row)
    except (ValidationError, NotFoundError) as e:
        code = status.HTTP_404_NOT_FOUND if isinstance(e, NotFoundError) else status.HTTP_422_UNPROCESSABLE_ENTITY
        raise HTTPException(status_code=code, detail=str(e))


@router.delete(
    "/equipment-scrap-applications/{row_id}",
    status_code=status.HTTP_204_NO_CONTENT,
    dependencies=[Depends(require_permission_codes("kuaizhizao:equipment-scrap:delete"))],
)
async def delete_scrap_application(row_id: int, tenant_id: int = Depends(get_current_tenant)):
    try:
        await svc.scrap_application_service.delete(tenant_id, row_id)
    except (ValidationError, NotFoundError) as e:
        code = status.HTTP_404_NOT_FOUND if isinstance(e, NotFoundError) else status.HTTP_422_UNPROCESSABLE_ENTITY
        raise HTTPException(status_code=code, detail=str(e))


# ---------- 设备调拨 ----------

@router.post(
    "/equipment-transfers",
    response_model=TransferApplicationResponse,
    status_code=status.HTTP_201_CREATED,
    dependencies=[Depends(require_permission_codes("kuaizhizao:equipment-transfer:create"))],
)
async def create_transfer_application(
    data: TransferApplicationCreate,
    current_user: User = Depends(soil_get_current_user),
    tenant_id: int = Depends(get_current_tenant),
):
    try:
        row = await svc.transfer_application_service.create(
            tenant_id,
            data,
            operator_id=current_user.id,
            operator_name=current_user.nickname or current_user.username,
        )
        return TransferApplicationResponse.model_validate(row)
    except (ValidationError, NotFoundError) as e:
        code = status.HTTP_404_NOT_FOUND if isinstance(e, NotFoundError) else status.HTTP_422_UNPROCESSABLE_ENTITY
        raise HTTPException(status_code=code, detail=str(e))


@router.get("/equipment-transfers", response_model=TransferApplicationListResponse)
async def list_transfer_applications(
    skip: int = Query(0, ge=0),
    limit: int = Query(100, ge=1, le=1000),
    equipment_id: Optional[int] = Query(None, ge=1),
    status_filter: Optional[str] = Query(None, alias="status"),
    tenant_id: int = Depends(get_current_tenant),
):
    rows, total = await svc.transfer_application_service.list(
        tenant_id, skip, limit, equipment_id, status_filter
    )
    return TransferApplicationListResponse(
        items=[TransferApplicationResponse.model_validate(r) for r in rows],
        total=total,
        skip=skip,
        limit=limit,
    )


@router.get("/equipment-transfers/{row_id}", response_model=TransferApplicationResponse)
async def get_transfer_application(row_id: int, tenant_id: int = Depends(get_current_tenant)):
    try:
        row = await svc.transfer_application_service.get(tenant_id, row_id)
        return TransferApplicationResponse.model_validate(row)
    except NotFoundError as e:
        raise HTTPException(status_code=status.HTTP_404_NOT_FOUND, detail=str(e))


@router.put(
    "/equipment-transfers/{row_id}",
    response_model=TransferApplicationResponse,
    dependencies=[Depends(require_permission_codes("kuaizhizao:equipment-transfer:update"))],
)
async def update_transfer_application(
    row_id: int,
    data: TransferApplicationUpdate,
    tenant_id: int = Depends(get_current_tenant),
):
    try:
        row = await svc.transfer_application_service.update(tenant_id, row_id, data)
        return TransferApplicationResponse.model_validate(row)
    except (ValidationError, NotFoundError) as e:
        code = status.HTTP_404_NOT_FOUND if isinstance(e, NotFoundError) else status.HTTP_422_UNPROCESSABLE_ENTITY
        raise HTTPException(status_code=code, detail=str(e))


@router.post(
    "/equipment-transfers/{row_id}/submit",
    response_model=TransferApplicationResponse,
    dependencies=[Depends(require_permission_codes("kuaizhizao:equipment-transfer:submit"))],
)
async def submit_transfer_application(row_id: int, tenant_id: int = Depends(get_current_tenant)):
    try:
        row = await svc.transfer_application_service.submit(tenant_id, row_id)
        return TransferApplicationResponse.model_validate(row)
    except (ValidationError, NotFoundError) as e:
        code = status.HTTP_404_NOT_FOUND if isinstance(e, NotFoundError) else status.HTTP_422_UNPROCESSABLE_ENTITY
        raise HTTPException(status_code=code, detail=str(e))


@router.post(
    "/equipment-transfers/{row_id}/approve",
    response_model=TransferApplicationResponse,
    dependencies=[Depends(require_permission_codes("kuaizhizao:equipment-transfer:approve"))],
)
async def approve_transfer_application(
    row_id: int,
    current_user: User = Depends(soil_get_current_user),
    tenant_id: int = Depends(get_current_tenant),
):
    try:
        row = await svc.transfer_application_service.approve(
            tenant_id,
            row_id,
            approver_id=current_user.id,
            approver_name=current_user.nickname or current_user.username,
        )
        return TransferApplicationResponse.model_validate(row)
    except (ValidationError, NotFoundError) as e:
        code = status.HTTP_404_NOT_FOUND if isinstance(e, NotFoundError) else status.HTTP_422_UNPROCESSABLE_ENTITY
        raise HTTPException(status_code=code, detail=str(e))


@router.post(
    "/equipment-transfers/{row_id}/reject",
    response_model=TransferApplicationResponse,
    dependencies=[Depends(require_permission_codes("kuaizhizao:equipment-transfer:reject"))],
)
async def reject_transfer_application(
    row_id: int,
    body: TransferApplicationReject,
    current_user: User = Depends(soil_get_current_user),
    tenant_id: int = Depends(get_current_tenant),
):
    try:
        row = await svc.transfer_application_service.reject(
            tenant_id,
            row_id,
            body.reject_reason,
            approver_id=current_user.id,
            approver_name=current_user.nickname or current_user.username,
        )
        return TransferApplicationResponse.model_validate(row)
    except (ValidationError, NotFoundError) as e:
        code = status.HTTP_404_NOT_FOUND if isinstance(e, NotFoundError) else status.HTTP_422_UNPROCESSABLE_ENTITY
        raise HTTPException(status_code=code, detail=str(e))


@router.delete(
    "/equipment-transfers/{row_id}",
    status_code=status.HTTP_204_NO_CONTENT,
    dependencies=[Depends(require_permission_codes("kuaizhizao:equipment-transfer:delete"))],
)
async def delete_transfer_application(row_id: int, tenant_id: int = Depends(get_current_tenant)):
    try:
        await svc.transfer_application_service.delete(tenant_id, row_id)
    except (ValidationError, NotFoundError) as e:
        code = status.HTTP_404_NOT_FOUND if isinstance(e, NotFoundError) else status.HTTP_422_UNPROCESSABLE_ENTITY
        raise HTTPException(status_code=code, detail=str(e))
