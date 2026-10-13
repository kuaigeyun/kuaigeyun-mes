"""设备点检计划 API"""

from typing import Optional

from fastapi import APIRouter, Depends, HTTPException, Query, status

from apps.kuaizhizao.schemas.equipment_spot_check_plan import (
    EquipmentSpotCheckPlanCreate,
    EquipmentSpotCheckPlanListResponse,
    EquipmentSpotCheckPlanResponse,
    EquipmentSpotCheckPlanUpdate,
    GenerateSpotChecksRequest,
    GenerateSpotChecksResponse,
)
from apps.kuaizhizao.services.equipment_spot_check_plan_service import EquipmentSpotCheckPlanService
from core.api.deps.access import require_permission_codes
from core.api.deps.deps import get_current_tenant
from infra.api.deps.deps import get_current_user as soil_get_current_user
from infra.exceptions.exceptions import NotFoundError, ValidationError
from infra.models.user import User

router = APIRouter(
    prefix="/equipment-spot-check-plans",
    tags=["App - Kuaige Zhizao - Equipment Spot Check Plans"],
)

_READ = Depends(require_permission_codes("kuaizhizao:equipment-spot-check-plan:read"))
_CREATE = Depends(require_permission_codes("kuaizhizao:equipment-spot-check-plan:create"))
_UPDATE = Depends(require_permission_codes("kuaizhizao:equipment-spot-check-plan:update"))
_DELETE = Depends(require_permission_codes("kuaizhizao:equipment-spot-check-plan:delete"))
_GENERATE = Depends(
    require_permission_codes(
        "kuaizhizao:equipment-spot-check-plan:update",
        "kuaizhizao:equipment-spot-check:create",
        require_all=True,
    )
)


@router.post(
    "",
    response_model=EquipmentSpotCheckPlanResponse,
    status_code=status.HTTP_201_CREATED,
    dependencies=[_CREATE],
)
async def create_spot_check_plan(
    data: EquipmentSpotCheckPlanCreate,
    current_user: User = Depends(soil_get_current_user),
    tenant_id: int = Depends(get_current_tenant),
):
    try:
        plan = await EquipmentSpotCheckPlanService.create_plan(
            tenant_id=tenant_id,
            data=data,
            created_by=current_user.id,
        )
        return await EquipmentSpotCheckPlanService.serialize_plan_response(plan)
    except ValidationError as e:
        raise HTTPException(status_code=status.HTTP_422_UNPROCESSABLE_ENTITY, detail=str(e))


@router.get("", response_model=EquipmentSpotCheckPlanListResponse, dependencies=[_READ])
async def list_spot_check_plans(
    skip: int = Query(0, ge=0),
    limit: int = Query(100, ge=1, le=1000),
    equipment_uuid: Optional[str] = Query(None),
    status: Optional[str] = Query(None),
    scheme_id: Optional[int] = Query(None),
    search: Optional[str] = Query(None),
    keyword: Optional[str] = Query(None),
    order_by: Optional[str] = Query(None),
    planned_start_date: Optional[str] = Query(None),
    planned_end_date: Optional[str] = Query(None),
    created_start_date: Optional[str] = Query(None),
    created_end_date: Optional[str] = Query(None),
    updated_start_date: Optional[str] = Query(None),
    updated_end_date: Optional[str] = Query(None),
    uuid: Optional[str] = Query(None),
    current_user: User = Depends(soil_get_current_user),
    tenant_id: int = Depends(get_current_tenant),
):
    plans, total = await EquipmentSpotCheckPlanService.list_plans(
        tenant_id=tenant_id,
        skip=skip,
        limit=limit,
        equipment_uuid=equipment_uuid,
        status=status,
        scheme_id=scheme_id,
        search=search,
        keyword=keyword,
        order_by=order_by,
        planned_start_date=planned_start_date,
        planned_end_date=planned_end_date,
        created_start_date=created_start_date,
        created_end_date=created_end_date,
        updated_start_date=updated_start_date,
        updated_end_date=updated_end_date,
        uuid=uuid,
    )
    items = [
        await EquipmentSpotCheckPlanService.serialize_plan_response(p) for p in plans
    ]
    return EquipmentSpotCheckPlanListResponse(items=items, total=total, skip=skip, limit=limit)


@router.post(
    "/{uuid}/generate-spot-checks",
    response_model=GenerateSpotChecksResponse,
    dependencies=[_GENERATE],
)
async def generate_spot_checks(
    uuid: str,
    data: Optional[GenerateSpotChecksRequest] = None,
    current_user: User = Depends(soil_get_current_user),
    tenant_id: int = Depends(get_current_tenant),
):
    try:
        created = await EquipmentSpotCheckPlanService.generate_spot_checks(
            tenant_id=tenant_id,
            uuid=uuid,
            data=data,
            current_user=current_user,
        )
        return GenerateSpotChecksResponse(
            created=[
                {
                    "id": h.id,
                    "uuid": h.uuid,
                    "document_no": h.document_no,
                    "equipment_id": h.equipment_id,
                    "equipment_uuid": h.equipment_uuid,
                    "equipment_name": h.equipment_name,
                }
                for h in created
            ],
            total=len(created),
        )
    except NotFoundError as e:
        raise HTTPException(status_code=status.HTTP_404_NOT_FOUND, detail=str(e))
    except ValidationError as e:
        raise HTTPException(status_code=status.HTTP_422_UNPROCESSABLE_ENTITY, detail=str(e))


@router.get("/{uuid}", response_model=EquipmentSpotCheckPlanResponse, dependencies=[_READ])
async def get_spot_check_plan(
    uuid: str,
    current_user: User = Depends(soil_get_current_user),
    tenant_id: int = Depends(get_current_tenant),
):
    try:
        plan = await EquipmentSpotCheckPlanService.get_plan_by_uuid(tenant_id, uuid)
        return await EquipmentSpotCheckPlanService.serialize_plan_response(plan)
    except NotFoundError as e:
        raise HTTPException(status_code=status.HTTP_404_NOT_FOUND, detail=str(e))


@router.put("/{uuid}", response_model=EquipmentSpotCheckPlanResponse, dependencies=[_UPDATE])
async def update_spot_check_plan(
    uuid: str,
    data: EquipmentSpotCheckPlanUpdate,
    current_user: User = Depends(soil_get_current_user),
    tenant_id: int = Depends(get_current_tenant),
):
    try:
        plan = await EquipmentSpotCheckPlanService.update_plan(
            tenant_id=tenant_id, uuid=uuid, data=data
        )
        return await EquipmentSpotCheckPlanService.serialize_plan_response(plan)
    except NotFoundError as e:
        raise HTTPException(status_code=status.HTTP_404_NOT_FOUND, detail=str(e))
    except ValidationError as e:
        raise HTTPException(status_code=status.HTTP_422_UNPROCESSABLE_ENTITY, detail=str(e))


@router.delete("/{uuid}", status_code=status.HTTP_204_NO_CONTENT, dependencies=[_DELETE])
async def delete_spot_check_plan(
    uuid: str,
    current_user: User = Depends(soil_get_current_user),
    tenant_id: int = Depends(get_current_tenant),
):
    try:
        await EquipmentSpotCheckPlanService.delete_plan(tenant_id, uuid)
    except NotFoundError as e:
        raise HTTPException(status_code=status.HTTP_404_NOT_FOUND, detail=str(e))
