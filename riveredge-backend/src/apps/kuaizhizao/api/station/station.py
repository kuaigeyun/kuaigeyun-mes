"""
工位终端 API
"""

from typing import List, Optional

from fastapi import APIRouter, Depends, Query, HTTPException

from core.api.deps import get_current_user, get_current_tenant
from core.api.deps.access import require_module_access
from infra.models.user import User
from infra.exceptions.exceptions import BusinessLogicError

from apps.kuaizhizao.services.station_service import StationService
from apps.kuaizhizao.schemas.station import (
    StationAndonCreate,
    StationAndonResponse,
    StationSopAckCreate,
    StationSopAckCheckResponse,
)

router = APIRouter(
    prefix="/station",
    tags=["App · Kuaige Zhizao · Station Terminal"],
    dependencies=[Depends(require_module_access("kuaizhizao", "production-execution-terminal"))],
)

station_service = StationService()


@router.post("/andon", response_model=StationAndonResponse, summary="Create station andon call")
async def create_station_andon(
    data: StationAndonCreate,
    current_user: User = Depends(get_current_user),
    tenant_id: int = Depends(get_current_tenant),
) -> StationAndonResponse:
    try:
        record = await station_service.create_andon_call(
            tenant_id=tenant_id,
            data=data,
            caller_id=current_user.id,
            caller_name=current_user.full_name or current_user.username,
        )
        return StationAndonResponse.model_validate(record)
    except BusinessLogicError as e:
        raise HTTPException(status_code=400, detail=str(e)) from e


@router.get("/andon/open", response_model=List[StationAndonResponse], summary="List open andon calls")
async def list_open_andon(
    workstation_id: Optional[int] = Query(None),
    current_user: User = Depends(get_current_user),
    tenant_id: int = Depends(get_current_tenant),
) -> List[StationAndonResponse]:
    records = await station_service.list_open_andon_calls(
        tenant_id=tenant_id,
        workstation_id=workstation_id,
    )
    return [StationAndonResponse.model_validate(r) for r in records]


@router.post("/sop-acknowledgments", summary="Acknowledge SOP before operation start")
async def acknowledge_sop(
    data: StationSopAckCreate,
    current_user: User = Depends(get_current_user),
    tenant_id: int = Depends(get_current_tenant),
):
    try:
        record = await station_service.acknowledge_sop(
            tenant_id=tenant_id,
            data=data,
            user_id=current_user.id,
            user_name=current_user.full_name or current_user.username,
        )
        return {"acknowledged": True, "acknowledged_at": record.acknowledged_at}
    except BusinessLogicError as e:
        raise HTTPException(status_code=400, detail=str(e)) from e


@router.get("/sop-acknowledgments/check", response_model=StationSopAckCheckResponse)
async def check_sop_acknowledgment(
    work_order_id: int = Query(...),
    operation_id: int = Query(...),
    sop_uuid: str = Query(...),
    worker_id: Optional[int] = Query(None),
    current_user: User = Depends(get_current_user),
    tenant_id: int = Depends(get_current_tenant),
) -> StationSopAckCheckResponse:
    result = await station_service.check_sop_acknowledged(
        tenant_id=tenant_id,
        work_order_id=work_order_id,
        operation_id=operation_id,
        sop_uuid=sop_uuid,
        worker_id=worker_id,
    )
    return StationSopAckCheckResponse.model_validate(result)
