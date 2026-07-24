"""
工位终端 API
"""

from datetime import datetime
from typing import List, Optional

from fastapi import APIRouter, Depends, Query, HTTPException

from core.api.deps import get_current_user, get_current_tenant
from apps.kuaizhizao.api._kuaizhizao_route_access import require_kuaizhizao_module_access
from infra.models.user import User
from infra.exceptions.exceptions import BusinessLogicError, NotFoundError
from infra.services.face_template_service import FaceTemplateService

from apps.kuaizhizao.services.station_service import StationService
from apps.kuaizhizao.schemas.station import (
    StationAndonCreate,
    StationAndonResponse,
    StationSopAckCreate,
    StationSopAckCheckResponse,
    StationOperationDocumentsResponse,
    StationWorkOrderDocumentFlagsResponse,
    FaceEnrollRequest,
    FaceIdentifyRequest,
    FaceIdentifyResponse,
    FaceTemplateResponse,
    SkillCheckRequest,
    SkillCheckResponse,
    OperatorSkillCreate,
    OperatorSkillResponse,
    ShiftSummaryResponse,
    ShiftHandoverCreate,
    ShiftHandoverResponse,
)

router = APIRouter(
    prefix="/station",
    tags=["App - Kuaige Zhizao - Station Terminal"],
    dependencies=[Depends(require_kuaizhizao_module_access("production-execution-terminal"))],
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
            caller=current_user,
        )
        return StationAndonResponse.model_validate(record)
    except (BusinessLogicError, NotFoundError) as e:
        raise HTTPException(status_code=400, detail=str(e)) from e


@router.get("/andon", response_model=List[StationAndonResponse], summary="List andon calls")
async def list_andon(
    workstation_id: Optional[int] = Query(None),
    status: Optional[str] = Query(None, description="open/acknowledged/closed"),
    current_user: User = Depends(get_current_user),
    tenant_id: int = Depends(get_current_tenant),
) -> List[StationAndonResponse]:
    records = await station_service.list_andon_calls(
        tenant_id=tenant_id,
        workstation_id=workstation_id,
        status=status,
    )
    return [StationAndonResponse.model_validate(r) for r in records]


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


@router.post("/andon/{andon_id}/acknowledge", response_model=StationAndonResponse)
async def acknowledge_andon(
    andon_id: int,
    current_user: User = Depends(get_current_user),
    tenant_id: int = Depends(get_current_tenant),
) -> StationAndonResponse:
    try:
        record = await station_service.acknowledge_andon(
            tenant_id=tenant_id,
            andon_id=andon_id,
            user_id=current_user.id,
            user_name=current_user.full_name or current_user.username,
        )
        return StationAndonResponse.model_validate(record)
    except (BusinessLogicError, NotFoundError) as e:
        raise HTTPException(status_code=400, detail=str(e)) from e


@router.post("/andon/{andon_id}/close", response_model=StationAndonResponse)
async def close_andon(
    andon_id: int,
    current_user: User = Depends(get_current_user),
    tenant_id: int = Depends(get_current_tenant),
) -> StationAndonResponse:
    try:
        record = await station_service.close_andon(
            tenant_id=tenant_id,
            andon_id=andon_id,
            user_id=current_user.id,
            user_name=current_user.full_name or current_user.username,
        )
        return StationAndonResponse.model_validate(record)
    except (BusinessLogicError, NotFoundError) as e:
        raise HTTPException(status_code=400, detail=str(e)) from e


@router.post("/andon/{andon_id}/cancel", response_model=StationAndonResponse)
async def cancel_andon(
    andon_id: int,
    current_user: User = Depends(get_current_user),
    tenant_id: int = Depends(get_current_tenant),
) -> StationAndonResponse:
    try:
        record = await station_service.cancel_andon(
            tenant_id=tenant_id,
            andon_id=andon_id,
            caller_id=current_user.id,
        )
        return StationAndonResponse.model_validate(record)
    except (BusinessLogicError, NotFoundError) as e:
        raise HTTPException(status_code=400, detail=str(e)) from e


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


@router.get(
    "/work-orders/document-flags",
    response_model=StationWorkOrderDocumentFlagsResponse,
    summary="Batch document presence flags for work order list",
)
async def get_station_work_order_document_flags(
    ids: str = Query(..., description="工单 ID，逗号分隔"),
    current_user: User = Depends(get_current_user),
    tenant_id: int = Depends(get_current_tenant),
) -> StationWorkOrderDocumentFlagsResponse:
    """工单列表附件角标：是否存在 ESOP / 图纸（含工程图纸与物料附件）。"""
    id_list: List[int] = []
    for part in (ids or "").split(","):
        part = part.strip()
        if not part:
            continue
        try:
            id_list.append(int(part))
        except ValueError:
            continue
    items = await station_service.get_work_orders_document_flags(
        tenant_id=tenant_id,
        work_order_ids=id_list,
    )
    return StationWorkOrderDocumentFlagsResponse(items=items)


@router.get(
    "/work-orders/{work_order_id}/operations/{operation_id}/documents",
    response_model=StationOperationDocumentsResponse,
    summary="Aggregate ESOP and drawings for station operation",
)
async def get_station_operation_documents(
    work_order_id: int,
    operation_id: int,
    current_user: User = Depends(get_current_user),
    tenant_id: int = Depends(get_current_tenant),
) -> StationOperationDocumentsResponse:
    """
    工位工序文档唯一入口：物料感知 SOP + 已发布工程图纸 + 物料附件 + 工单/SOP 附件。
    权限走 production-execution-terminal:read，不要求 master-data process 权限。
    """
    try:
        return await station_service.get_operation_documents(
            tenant_id=tenant_id,
            work_order_id=work_order_id,
            operation_id=operation_id,
        )
    except NotFoundError as e:
        raise HTTPException(status_code=404, detail=str(e)) from e


@router.post("/face-templates", response_model=FaceTemplateResponse, summary="Enroll face template")
async def enroll_face_template(
    data: FaceEnrollRequest,
    current_user: User = Depends(get_current_user),
    tenant_id: int = Depends(get_current_tenant),
) -> FaceTemplateResponse:
    try:
        tpl = await FaceTemplateService.enroll(
            tenant_id=tenant_id,
            user_id=data.user_id,
            descriptor=data.descriptor,
            quality=data.quality,
            device_info=data.device_info,
        )
        return FaceTemplateResponse.model_validate(tpl)
    except (BusinessLogicError, NotFoundError) as e:
        raise HTTPException(status_code=400, detail=str(e)) from e


@router.get("/face-templates/me", response_model=List[FaceTemplateResponse])
async def list_my_face_templates(
    current_user: User = Depends(get_current_user),
    tenant_id: int = Depends(get_current_tenant),
) -> List[FaceTemplateResponse]:
    rows = await FaceTemplateService.list_for_user(tenant_id, current_user.id)
    return [FaceTemplateResponse.model_validate(r) for r in rows]


@router.delete("/face-templates/{template_id}", summary="Delete face template")
async def delete_face_template(
    template_id: int,
    current_user: User = Depends(get_current_user),
    tenant_id: int = Depends(get_current_tenant),
):
    try:
        await FaceTemplateService.delete_template(tenant_id, template_id)
        return {"deleted": True}
    except NotFoundError as e:
        raise HTTPException(status_code=404, detail=str(e)) from e


@router.post("/face-identify", response_model=FaceIdentifyResponse, summary="Identify operator by face")
async def identify_face(
    data: FaceIdentifyRequest,
    current_user: User = Depends(get_current_user),
    tenant_id: int = Depends(get_current_tenant),
) -> FaceIdentifyResponse:
    try:
        result = await FaceTemplateService.identify(tenant_id, data.descriptor)
        return FaceIdentifyResponse.model_validate(result)
    except BusinessLogicError as e:
        raise HTTPException(status_code=400, detail=str(e)) from e


@router.post("/skill-check", response_model=SkillCheckResponse)
async def skill_check(
    data: SkillCheckRequest,
    current_user: User = Depends(get_current_user),
    tenant_id: int = Depends(get_current_tenant),
) -> SkillCheckResponse:
    result = await station_service.check_operator_skill(
        tenant_id=tenant_id,
        user_id=data.user_id,
        operation_id=data.operation_id,
        work_order_id=data.work_order_id,
    )
    return SkillCheckResponse.model_validate(result)


@router.post("/operator-skills", response_model=OperatorSkillResponse)
async def create_operator_skill(
    data: OperatorSkillCreate,
    current_user: User = Depends(get_current_user),
    tenant_id: int = Depends(get_current_tenant),
) -> OperatorSkillResponse:
    record = await station_service.create_operator_skill(tenant_id, data)
    return OperatorSkillResponse.model_validate(record)


@router.get("/operator-skills", response_model=List[OperatorSkillResponse])
async def list_operator_skills(
    user_id: Optional[int] = Query(None),
    operation_id: Optional[int] = Query(None),
    current_user: User = Depends(get_current_user),
    tenant_id: int = Depends(get_current_tenant),
) -> List[OperatorSkillResponse]:
    rows = await station_service.list_operator_skills(
        tenant_id=tenant_id, user_id=user_id, operation_id=operation_id
    )
    return [OperatorSkillResponse.model_validate(r) for r in rows]


@router.get("/shift-summary", response_model=ShiftSummaryResponse)
async def shift_summary(
    shift_start: datetime = Query(...),
    shift_end: Optional[datetime] = Query(None),
    workstation_id: Optional[int] = Query(None),
    current_user: User = Depends(get_current_user),
    tenant_id: int = Depends(get_current_tenant),
) -> ShiftSummaryResponse:
    result = await station_service.get_shift_summary(
        tenant_id=tenant_id,
        shift_start=shift_start,
        shift_end=shift_end,
        workstation_id=workstation_id,
    )
    return ShiftSummaryResponse.model_validate(result)


@router.post("/shift-handover", response_model=ShiftHandoverResponse)
async def shift_handover(
    data: ShiftHandoverCreate,
    current_user: User = Depends(get_current_user),
    tenant_id: int = Depends(get_current_tenant),
) -> ShiftHandoverResponse:
    record = await station_service.confirm_shift_handover(
        tenant_id=tenant_id,
        data=data,
        operator_id=current_user.id,
        operator_name=current_user.full_name or current_user.username,
    )
    return ShiftHandoverResponse.model_validate(record)
