"""
质量改进 API

包含：8D、不合格品台账、OQC、SPC。
"""

from typing import List, Optional

from fastapi import APIRouter, Body, Depends, Path, Query

from apps.kuaizhizao.schemas.defect_record import DefectRecordListResponse, DefectRecordResponse
from apps.kuaizhizao.schemas.quality_improvement import (
    NonconformingDispositionUpdate,
    OQCInspectionConduct,
    OQCInspectionCreate,
    OQCInspectionResponse,
    Quality8DCreate,
    Quality8DResponse,
    Quality8DTransition,
    Quality8DUpdate,
    SPCChartResponse,
    SPCSampleCreate,
    SPCSampleResponse,
)
from apps.kuaizhizao.services.defect_record_service import DefectRecordService
from apps.kuaizhizao.services.quality_improvement_service import OQCInspectionService, Quality8DService, SPCService
from core.api.deps.access import require_access
from core.api.deps import get_current_tenant, get_current_user
from infra.models.user import User

router = APIRouter(tags=["App · Kuaige Zhizao · Quality Improvement"])

quality_8d_service = Quality8DService()
defect_record_service = DefectRecordService()
oqc_service = OQCInspectionService()
spc_service = SPCService()

_8D_READ = Depends(
    require_access(
        "kuaizhizao.quality-management-eight-d-reports",
        "read",
        required_permissions=["kuaizhizao:quality-management-eight-d-reports:read"],
    )
)
_8D_CREATE = Depends(
    require_access(
        "kuaizhizao.quality-management-eight-d-reports",
        "create",
        required_permissions=["kuaizhizao:quality-management-eight-d-reports:create"],
    )
)
_8D_UPDATE_OR_CLOSE = Depends(
    require_access(
        "kuaizhizao.quality-management-eight-d-reports",
        "update",
        required_permissions=[
            "kuaizhizao:quality-management-eight-d-reports:update",
            "kuaizhizao:quality-management-eight-d-reports:close",
        ],
    )
)
_NC_READ = Depends(
    require_access(
        "kuaizhizao.quality-management-nonconforming-ledger",
        "read",
        required_permissions=["kuaizhizao:quality-management-nonconforming-ledger:read"],
    )
)
_NC_UPDATE = Depends(
    require_access(
        "kuaizhizao.quality-management-nonconforming-ledger",
        "update",
        required_permissions=["kuaizhizao:quality-management-nonconforming-ledger:update"],
    )
)
_OQC_READ = Depends(
    require_access(
        "kuaizhizao.quality-management-oqc-inspection",
        "read",
        required_permissions=["kuaizhizao:quality-management-oqc-inspection:read"],
    )
)
_OQC_CREATE = Depends(
    require_access(
        "kuaizhizao.quality-management-oqc-inspection",
        "create",
        required_permissions=["kuaizhizao:quality-management-oqc-inspection:create"],
    )
)
_OQC_UPDATE = Depends(
    require_access(
        "kuaizhizao.quality-management-oqc-inspection",
        "update",
        required_permissions=["kuaizhizao:quality-management-oqc-inspection:update"],
    )
)
_OQC_APPROVE = Depends(
    require_access(
        "kuaizhizao.quality-management-oqc-inspection",
        "approve",
        required_permissions=["kuaizhizao:quality-management-oqc-inspection:approve"],
    )
)
_SPC_READ = Depends(
    require_access(
        "kuaizhizao.quality-management-spc-monitor",
        "read",
        required_permissions=["kuaizhizao:quality-management-spc-monitor:read"],
    )
)
_SPC_CREATE = Depends(
    require_access(
        "kuaizhizao.quality-management-spc-monitor",
        "create",
        required_permissions=["kuaizhizao:quality-management-spc-monitor:create"],
    )
)


@router.get("/quality-8d-reports", response_model=List[Quality8DResponse], summary="List 8D reports")
async def list_quality_8d_reports(
    skip: int = Query(0, ge=0),
    limit: int = Query(100, ge=1, le=1000),
    status: Optional[str] = Query(None),
    owner_id: Optional[int] = Query(None),
    overdue_only: bool = Query(False),
    _auth= _8D_READ,
    current_user: User = Depends(get_current_user),
    tenant_id: int = Depends(get_current_tenant),
) -> List[Quality8DResponse]:
    return await quality_8d_service.list_reports(
        tenant_id=tenant_id,
        skip=skip,
        limit=limit,
        status=status,
        owner_id=owner_id,
        overdue_only=overdue_only,
    )


@router.post("/quality-8d-reports", response_model=Quality8DResponse, summary="Create 8D report")
async def create_quality_8d_report(
    payload: Quality8DCreate,
    _auth= _8D_CREATE,
    current_user: User = Depends(get_current_user),
    tenant_id: int = Depends(get_current_tenant),
) -> Quality8DResponse:
    return await quality_8d_service.create_report(tenant_id=tenant_id, user_id=current_user.id, payload=payload)


@router.get("/quality-8d-reports/{report_id}", response_model=Quality8DResponse, summary="Get 8D report")
async def get_quality_8d_report(
    report_id: int = Path(...),
    _auth= _8D_READ,
    current_user: User = Depends(get_current_user),
    tenant_id: int = Depends(get_current_tenant),
) -> Quality8DResponse:
    return await quality_8d_service.get_report(tenant_id=tenant_id, report_id=report_id)


@router.put("/quality-8d-reports/{report_id}", response_model=Quality8DResponse, summary="Update 8D report")
async def update_quality_8d_report(
    payload: Quality8DUpdate,
    report_id: int = Path(...),
    _auth= _8D_UPDATE_OR_CLOSE,
    current_user: User = Depends(get_current_user),
    tenant_id: int = Depends(get_current_tenant),
) -> Quality8DResponse:
    return await quality_8d_service.update_report(
        tenant_id=tenant_id,
        report_id=report_id,
        user_id=current_user.id,
        payload=payload,
    )


@router.post("/quality-8d-reports/{report_id}/transition", response_model=Quality8DResponse, summary="Transition 8D stage")
async def transition_quality_8d_report(
    payload: Quality8DTransition,
    report_id: int = Path(...),
    _auth= _8D_UPDATE_OR_CLOSE,
    current_user: User = Depends(get_current_user),
    tenant_id: int = Depends(get_current_tenant),
) -> Quality8DResponse:
    return await quality_8d_service.transition(
        tenant_id=tenant_id,
        report_id=report_id,
        user_id=current_user.id,
        payload=payload,
    )


@router.post("/exceptions/quality/{exception_id}/start-8d", response_model=Quality8DResponse, summary="Start 8D from quality exception")
async def start_8d_from_exception(
    exception_id: int = Path(..., description="质量异常ID"),
    title: str = Body(..., embed=True, description="8D 标题"),
    _auth= _8D_CREATE,
    current_user: User = Depends(get_current_user),
    tenant_id: int = Depends(get_current_tenant),
) -> Quality8DResponse:
    return await quality_8d_service.create_report(
        tenant_id=tenant_id,
        user_id=current_user.id,
        payload=Quality8DCreate(quality_exception_id=exception_id, title=title),
    )


@router.get("/nonconforming-ledger", response_model=List[DefectRecordListResponse], summary="List nonconforming ledger")
async def list_nonconforming_ledger(
    skip: int = Query(0, ge=0),
    limit: int = Query(100, ge=1, le=1000),
    status: Optional[str] = Query(None),
    defect_type: Optional[str] = Query(None),
    disposition: Optional[str] = Query(None),
    incoming_inspection_id: Optional[int] = Query(None),
    process_inspection_id: Optional[int] = Query(None),
    finished_goods_inspection_id: Optional[int] = Query(None),
    _auth= _NC_READ,
    current_user: User = Depends(get_current_user),
    tenant_id: int = Depends(get_current_tenant),
) -> List[DefectRecordListResponse]:
    return await defect_record_service.list_defect_records(
        tenant_id=tenant_id,
        skip=skip,
        limit=limit,
        status=status,
        defect_type=defect_type,
        disposition=disposition,
        incoming_inspection_id=incoming_inspection_id,
        process_inspection_id=process_inspection_id,
        finished_goods_inspection_id=finished_goods_inspection_id,
    )


@router.put("/nonconforming-ledger/{defect_id}/disposition", response_model=DefectRecordResponse, summary="Update NC disposition")
async def update_nonconforming_disposition(
    payload: NonconformingDispositionUpdate,
    defect_id: int = Path(...),
    _auth= _NC_UPDATE,
    current_user: User = Depends(get_current_user),
    tenant_id: int = Depends(get_current_tenant),
) -> DefectRecordResponse:
    return await defect_record_service.update_disposition(
        tenant_id=tenant_id,
        defect_id=defect_id,
        updated_by=current_user.id,
        disposition=payload.disposition,
        status=payload.status,
        quarantine_location=payload.quarantine_location,
        remarks=payload.remarks,
    )


@router.get("/oqc-inspections", summary="List OQC inspections")
async def list_oqc_inspections(
    skip: int = Query(0, ge=0),
    limit: int = Query(100, ge=1, le=1000),
    status: Optional[str] = Query(None),
    _auth= _OQC_READ,
    current_user: User = Depends(get_current_user),
    tenant_id: int = Depends(get_current_tenant),
):
    return await oqc_service.list(tenant_id=tenant_id, skip=skip, limit=limit, status=status)


@router.post("/oqc-inspections", response_model=OQCInspectionResponse, summary="Create OQC inspection")
async def create_oqc_inspection(
    payload: OQCInspectionCreate,
    _auth= _OQC_CREATE,
    current_user: User = Depends(get_current_user),
    tenant_id: int = Depends(get_current_tenant),
) -> OQCInspectionResponse:
    return await oqc_service.create(tenant_id=tenant_id, user_id=current_user.id, payload=payload)


@router.post("/oqc-inspections/{inspection_id}/conduct", response_model=OQCInspectionResponse, summary="Conduct OQC inspection")
async def conduct_oqc_inspection(
    payload: OQCInspectionConduct,
    inspection_id: int = Path(...),
    _auth= _OQC_UPDATE,
    current_user: User = Depends(get_current_user),
    tenant_id: int = Depends(get_current_tenant),
) -> OQCInspectionResponse:
    return await oqc_service.conduct(tenant_id=tenant_id, inspection_id=inspection_id, user_id=current_user.id, payload=payload)


@router.post("/oqc-inspections/{inspection_id}/approve", response_model=OQCInspectionResponse, summary="Approve OQC inspection")
async def approve_oqc_inspection(
    inspection_id: int = Path(...),
    approve: bool = Query(True, description="true=通过 false=驳回"),
    _auth= _OQC_APPROVE,
    current_user: User = Depends(get_current_user),
    tenant_id: int = Depends(get_current_tenant),
) -> OQCInspectionResponse:
    return await oqc_service.approve(tenant_id=tenant_id, inspection_id=inspection_id, user_id=current_user.id, approve=approve)


@router.post("/spc/samples", response_model=SPCSampleResponse, summary="Create SPC sample")
async def create_spc_sample(
    payload: SPCSampleCreate,
    _auth= _SPC_CREATE,
    current_user: User = Depends(get_current_user),
    tenant_id: int = Depends(get_current_tenant),
) -> SPCSampleResponse:
    return await spc_service.create_sample(tenant_id=tenant_id, user_id=current_user.id, payload=payload)


@router.get("/spc/samples", response_model=List[SPCSampleResponse], summary="List SPC samples")
async def list_spc_samples(
    characteristic_name: Optional[str] = Query(None),
    skip: int = Query(0, ge=0),
    limit: int = Query(100, ge=1, le=1000),
    _auth= _SPC_READ,
    current_user: User = Depends(get_current_user),
    tenant_id: int = Depends(get_current_tenant),
) -> List[SPCSampleResponse]:
    return await spc_service.list_samples(
        tenant_id=tenant_id,
        characteristic_name=characteristic_name,
        skip=skip,
        limit=limit,
    )


@router.get("/spc/charts/imr", response_model=SPCChartResponse, summary="Build I-MR chart")
async def get_imr_chart(
    characteristic_name: str = Query(...),
    limit: int = Query(50, ge=10, le=500),
    _auth= _SPC_READ,
    current_user: User = Depends(get_current_user),
    tenant_id: int = Depends(get_current_tenant),
) -> SPCChartResponse:
    return await spc_service.build_imr_chart(
        tenant_id=tenant_id,
        characteristic_name=characteristic_name,
        limit=limit,
    )
