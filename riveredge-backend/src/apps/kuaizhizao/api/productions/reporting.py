"""
报工管理 API 路由模块

提供报工记录、物料绑定、报废、不良品管理的API接口。
"""

from datetime import datetime
from typing import List, Optional
from fastapi import APIRouter, Depends, Query, status as http_status, Path, HTTPException
from fastapi.responses import JSONResponse

from core.api.deps import get_current_user, get_current_tenant
from infra.models.user import User
from infra.exceptions.exceptions import ValidationError, BusinessLogicError

from apps.kuaizhizao.services.reporting_service import ReportingService
from apps.kuaizhizao.services.scrap_record_service import ScrapRecordService
from apps.kuaizhizao.services.defect_record_service import DefectRecordService
from apps.kuaizhizao.services.material_binding_service import MaterialBindingService

from apps.kuaizhizao.schemas.reporting_record import (
    ReportingRecordCreate,
    ReportingRecordUpdate,
    ReportingRecordResponse,
    ReportingRecordListResponse,
)
from apps.kuaizhizao.schemas.scrap_record import (
    ScrapRecordCreateFromReporting,
    ScrapRecordResponse,
    ScrapRecordListResponse,
)
from apps.kuaizhizao.schemas.defect_record import (
    DefectRecordCreateFromReporting,
    DefectRecordResponse,
    DefectRecordListResponse,
)
from apps.kuaizhizao.schemas.material_binding import (
    MaterialBindingCreateFromReporting,
    MaterialBindingResponse,
    MaterialBindingListResponse,
)

# 初始化服务实例
reporting_service = ReportingService()
scrap_record_service = ScrapRecordService()
defect_record_service = DefectRecordService()
material_binding_service = MaterialBindingService()

router = APIRouter(tags=["Kuaige Zhizao - Production Execution"])


# ============ 报工管理 API ============

@router.post("/reporting", response_model=ReportingRecordResponse, summary="创建报工记录")
async def create_reporting_record(
    reporting: ReportingRecordCreate,
    current_user: User = Depends(get_current_user),
    tenant_id: int = Depends(get_current_tenant),
) -> ReportingRecordResponse:
    """
    创建报工记录

    - **reporting**: 报工数据
    """
    return await reporting_service.create_reporting_record(
        tenant_id=tenant_id,
        reporting_data=reporting,
        reported_by=current_user.id
    )


@router.get("/reporting", response_model=List[ReportingRecordListResponse], summary="获取报工记录列表")
async def list_reporting_records(
    skip: int = Query(0, ge=0, description="跳过数量"),
    limit: int = Query(100, ge=1, le=1000, description="限制数量"),
    work_order_code: Optional[str] = Query(None, description="工单编码（模糊搜索）"),
    work_order_name: Optional[str] = Query(None, description="工单名称（模糊搜索）"),
    operation_name: Optional[str] = Query(None, description="工序名称（模糊搜索）"),
    worker_name: Optional[str] = Query(None, description="操作工姓名（模糊搜索）"),
    status: Optional[str] = Query(None, description="审核状态"),
    reported_at_start: Optional[str] = Query(None, description="报工开始时间（ISO格式）"),
    reported_at_end: Optional[str] = Query(None, description="报工结束时间（ISO格式）"),
    current_user: User = Depends(get_current_user),
    tenant_id: int = Depends(get_current_tenant),
) -> List[ReportingRecordListResponse]:
    """
    获取报工记录列表

    支持多种筛选条件的高级搜索。
    """
    reported_at_start_dt = None
    reported_at_end_dt = None

    if reported_at_start:
        try:
            reported_at_start_dt = datetime.fromisoformat(reported_at_start.replace('Z', '+00:00'))
        except ValueError:
            pass

    if reported_at_end:
        try:
            reported_at_end_dt = datetime.fromisoformat(reported_at_end.replace('Z', '+00:00'))
        except ValueError:
            pass

    return await reporting_service.list_reporting_records(
        tenant_id=tenant_id,
        skip=skip,
        limit=limit,
        work_order_code=work_order_code,
        work_order_name=work_order_name,
        operation_name=operation_name,
        worker_name=worker_name,
        status=status,
        reported_at_start=reported_at_start_dt,
        reported_at_end=reported_at_end_dt,
    )


@router.get("/reporting/statistics", summary="获取报工统计信息")
async def get_reporting_statistics(
    date_start: Optional[str] = Query(None, description="开始日期（ISO格式）"),
    date_end: Optional[str] = Query(None, description="结束日期（ISO格式）"),
    current_user: User = Depends(get_current_user),
    tenant_id: int = Depends(get_current_tenant),
) -> JSONResponse:
    """
    获取报工统计信息

    返回报工数量、合格率等统计数据。
    """
    date_start_dt = None
    date_end_dt = None

    if date_start:
        try:
            date_start_dt = datetime.fromisoformat(date_start.replace('Z', '+00:00'))
        except ValueError:
            pass

    if date_end:
        try:
            date_end_dt = datetime.fromisoformat(date_end.replace('Z', '+00:00'))
        except ValueError:
            pass

    statistics = await reporting_service.get_reporting_statistics(
        tenant_id=tenant_id,
        date_start=date_start_dt,
        date_end=date_end_dt,
    )

    return JSONResponse(
        content=statistics,
        status_code=http_status.HTTP_200_OK
    )


@router.get("/reporting/{record_id}", response_model=ReportingRecordResponse, summary="获取报工记录详情")
async def get_reporting_record(
    record_id: int,
    current_user: User = Depends(get_current_user),
    tenant_id: int = Depends(get_current_tenant),
) -> ReportingRecordResponse:
    """
    根据ID获取报工记录详情

    - **record_id**: 报工记录ID
    """
    return await reporting_service.get_reporting_record_by_id(
        tenant_id=tenant_id,
        record_id=record_id
    )


@router.post("/reporting/{record_id}/approve", response_model=ReportingRecordResponse, summary="审核报工记录")
async def approve_reporting_record(
    record_id: int,
    rejection_reason: Optional[str] = Query(None, description="驳回原因"),
    current_user: User = Depends(get_current_user),
    tenant_id: int = Depends(get_current_tenant),
) -> ReportingRecordResponse:
    """
    审核报工记录

    - **record_id**: 报工记录ID
    - **rejection_reason**: 驳回原因（可选，不填则通过）
    """
    return await reporting_service.approve_reporting_record(
        tenant_id=tenant_id,
        record_id=record_id,
        approved_by=current_user.id,
        rejection_reason=rejection_reason
    )


@router.put("/reporting/{record_id}/correct", response_model=ReportingRecordResponse, summary="修正报工数据")
async def correct_reporting_data(
    record_id: int,
    correct_data: ReportingRecordUpdate,
    correction_reason: str = Query(..., description="修正原因（必填）"),
    current_user: User = Depends(get_current_user),
    tenant_id: int = Depends(get_current_tenant),
) -> ReportingRecordResponse:
    """
    修正报工数据

    用于修正已提交的报工记录数据，需要记录修正原因和修正历史。

    - **record_id**: 报工记录ID
    - **correct_data**: 修正数据
    - **correction_reason**: 修正原因（必填）
    """
    return await reporting_service.correct_reporting_data(
        tenant_id=tenant_id,
        record_id=record_id,
        correct_data=correct_data,
        corrected_by=current_user.id,
        correction_reason=correction_reason
    )


@router.delete("/reporting/{record_id}", summary="删除报工记录")
async def delete_reporting_record(
    record_id: int,
    current_user: User = Depends(get_current_user),
    tenant_id: int = Depends(get_current_tenant),
) -> JSONResponse:
    """
    删除报工记录（软删除）

    - **record_id**: 报工记录ID
    """
    await reporting_service.delete_reporting_record(
        tenant_id=tenant_id,
        record_id=record_id
    )

    return JSONResponse(
        content={"message": "报工记录删除成功"},
        status_code=http_status.HTTP_200_OK
    )


@router.post("/reporting/{record_id}/scrap", response_model=ScrapRecordResponse, summary="从报工记录创建报废记录")
async def create_scrap_record_from_reporting(
    record_id: int,
    scrap_data: ScrapRecordCreateFromReporting,
    current_user: User = Depends(get_current_user),
    tenant_id: int = Depends(get_current_tenant),
) -> ScrapRecordResponse:
    """
    从报工记录创建报废记录

    根据报工记录信息创建报废记录，自动关联报工记录、工单和产品信息。

    - **record_id**: 报工记录ID
    - **scrap_data**: 报废记录创建数据（报废数量、报废原因、报废类型、单位成本等）
    """
    return await reporting_service.record_scrap(
        tenant_id=tenant_id,
        reporting_record_id=record_id,
        scrap_data=scrap_data,
        created_by=current_user.id
    )


# ============ 物料绑定 API ============

@router.post("/reporting/{record_id}/material-binding/feeding", response_model=MaterialBindingResponse, summary="从报工记录创建上料绑定")
async def create_feeding_binding_from_reporting(
    record_id: int,
    binding_data: MaterialBindingCreateFromReporting,
    current_user: User = Depends(get_current_user),
    tenant_id: int = Depends(get_current_tenant),
) -> MaterialBindingResponse:
    """
    从报工记录创建上料绑定

    在报工记录中绑定上料物料信息。

    - **record_id**: 报工记录ID
    - **binding_data**: 物料绑定创建数据（物料ID、数量、仓库、批次等）
    """
    binding_data.binding_type = "feeding"
    return await material_binding_service.create_material_binding_from_reporting(
        tenant_id=tenant_id,
        reporting_record_id=record_id,
        binding_data=binding_data,
        bound_by=current_user.id
    )


@router.post("/reporting/{record_id}/material-binding/discharging", response_model=MaterialBindingResponse, summary="从报工记录创建下料绑定")
async def create_discharging_binding_from_reporting(
    record_id: int,
    binding_data: MaterialBindingCreateFromReporting,
    current_user: User = Depends(get_current_user),
    tenant_id: int = Depends(get_current_tenant),
) -> MaterialBindingResponse:
    """
    从报工记录创建下料绑定

    在报工记录中绑定下料物料信息。

    - **record_id**: 报工记录ID
    - **binding_data**: 物料绑定创建数据（物料ID、数量、仓库、批次等）
    """
    binding_data.binding_type = "discharging"
    return await material_binding_service.create_material_binding_from_reporting(
        tenant_id=tenant_id,
        reporting_record_id=record_id,
        binding_data=binding_data,
        bound_by=current_user.id
    )


@router.get("/reporting/{record_id}/material-binding", response_model=List[MaterialBindingListResponse], summary="获取报工记录的物料绑定记录")
async def get_material_bindings_by_reporting_record(
    record_id: int,
    current_user: User = Depends(get_current_user),
    tenant_id: int = Depends(get_current_tenant),
) -> List[MaterialBindingListResponse]:
    """
    获取报工记录的物料绑定记录列表

    - **record_id**: 报工记录ID
    """
    return await material_binding_service.get_material_bindings_by_reporting_record(
        tenant_id=tenant_id,
        reporting_record_id=record_id
    )


@router.delete("/material-binding/{binding_id}", summary="删除物料绑定记录")
async def delete_material_binding(
    binding_id: int,
    current_user: User = Depends(get_current_user),
    tenant_id: int = Depends(get_current_tenant),
) -> JSONResponse:
    """
    删除物料绑定记录（软删除）

    - **binding_id**: 物料绑定记录ID
    """
    await material_binding_service.delete_material_binding(
        tenant_id=tenant_id,
        binding_id=binding_id
    )

    return JSONResponse(
        content={"message": "物料绑定记录删除成功"},
        status_code=http_status.HTTP_200_OK
    )


# ============ 报废管理 API ============

@router.post("/scrap/{scrap_id}/approve", response_model=ScrapRecordResponse, summary="审批报废记录")
async def approve_scrap_record(
    scrap_id: int = Path(..., description="报废记录ID"),
    approved: bool = Query(..., description="是否同意（true=同意，false=不同意）"),
    rejection_reason: Optional[str] = Query(None, description="驳回原因（当approved=false时必填）"),
    current_user: User = Depends(get_current_user),
    tenant_id: int = Depends(get_current_tenant),
) -> ScrapRecordResponse:
    """
    审批报废记录

    - **scrap_id**: 报废记录ID
    - **approved**: 是否同意（true=同意，false=不同意）
    - **rejection_reason**: 驳回原因（当approved=false时必填）
    """
    try:
        return await scrap_record_service.approve_scrap_record(
            tenant_id=tenant_id,
            scrap_id=scrap_id,
            approved=approved,
            approved_by=current_user.id,
            rejection_reason=rejection_reason
        )
    except ValidationError as e:
        raise HTTPException(status_code=400, detail=str(e))
    except BusinessLogicError as e:
        raise HTTPException(status_code=400, detail=str(e))


@router.get("/scrap", response_model=List[ScrapRecordListResponse], summary="查询报废记录列表")
async def list_scrap_records(
    skip: int = Query(0, ge=0, description="跳过数量"),
    limit: int = Query(100, ge=1, le=1000, description="限制数量"),
    work_order_id: Optional[int] = Query(None, description="工单ID"),
    operation_id: Optional[int] = Query(None, description="工序ID"),
    status: Optional[str] = Query(None, description="状态（draft/confirmed/cancelled）"),
    scrap_type: Optional[str] = Query(None, description="报废类型"),
    date_start: Optional[str] = Query(None, description="开始日期（ISO格式）"),
    date_end: Optional[str] = Query(None, description="结束日期（ISO格式）"),
    current_user: User = Depends(get_current_user),
    tenant_id: int = Depends(get_current_tenant),
) -> List[ScrapRecordListResponse]:
    """
    查询报废记录列表

    - **skip**: 跳过数量
    - **limit**: 限制数量
    - **work_order_id**: 工单ID（可选）
    - **operation_id**: 工序ID（可选）
    - **status**: 状态（可选）
    - **scrap_type**: 报废类型（可选）
    - **date_start**: 开始日期（可选）
    - **date_end**: 结束日期（可选）
    """
    date_start_dt = None
    date_end_dt = None
    if date_start:
        date_start_dt = datetime.fromisoformat(date_start.replace('Z', '+00:00'))
    if date_end:
        date_end_dt = datetime.fromisoformat(date_end.replace('Z', '+00:00'))

    return await scrap_record_service.list_scrap_records(
        tenant_id=tenant_id,
        skip=skip,
        limit=limit,
        work_order_id=work_order_id,
        operation_id=operation_id,
        status=status,
        scrap_type=scrap_type,
        date_start=date_start_dt,
        date_end=date_end_dt
    )


@router.get("/scrap/statistics", summary="获取报废统计分析")
async def get_scrap_statistics(
    date_start: Optional[str] = Query(None, description="开始日期（ISO格式）"),
    date_end: Optional[str] = Query(None, description="结束日期（ISO格式）"),
    work_order_id: Optional[int] = Query(None, description="工单ID"),
    operation_id: Optional[int] = Query(None, description="工序ID"),
    product_id: Optional[int] = Query(None, description="产品ID"),
    scrap_type: Optional[str] = Query(None, description="报废类型"),
    current_user: User = Depends(get_current_user),
    tenant_id: int = Depends(get_current_tenant),
) -> JSONResponse:
    """
    获取报废统计分析

    - **date_start**: 开始日期（可选）
    - **date_end**: 结束日期（可选）
    - **work_order_id**: 工单ID（可选）
    - **operation_id**: 工序ID（可选）
    - **product_id**: 产品ID（可选）
    - **scrap_type**: 报废类型（可选）
    """
    date_start_dt = None
    date_end_dt = None
    if date_start:
        date_start_dt = datetime.fromisoformat(date_start.replace('Z', '+00:00'))
    if date_end:
        date_end_dt = datetime.fromisoformat(date_end.replace('Z', '+00:00'))

    statistics = await scrap_record_service.get_scrap_statistics(
        tenant_id=tenant_id,
        date_start=date_start_dt,
        date_end=date_end_dt,
        work_order_id=work_order_id,
        operation_id=operation_id,
        product_id=product_id,
        scrap_type=scrap_type
    )

    return JSONResponse(content=statistics)


# ============ 不良品管理 API ============

@router.post("/reporting/{record_id}/defect", response_model=DefectRecordResponse, summary="从报工记录创建不良品记录")
async def create_defect_record_from_reporting(
    record_id: int,
    defect_data: DefectRecordCreateFromReporting,
    current_user: User = Depends(get_current_user),
    tenant_id: int = Depends(get_current_tenant),
) -> DefectRecordResponse:
    """
    从报工记录创建不良品记录

    根据报工记录信息创建不良品记录，自动关联报工记录、工单和产品信息。
    支持不良品隔离、返工处理、报废处理等处理方式。

    - **record_id**: 报工记录ID
    - **defect_data**: 不良品记录创建数据（不良品数量、不良品类型、不良品原因、处理方式等）
    """
    return await reporting_service.record_defect(
        tenant_id=tenant_id,
        reporting_record_id=record_id,
        defect_data=defect_data,
        created_by=current_user.id
    )


@router.post("/defect/{defect_id}/approve-acceptance", response_model=DefectRecordResponse, summary="审批不良品让步接收")
async def approve_defect_acceptance(
    defect_id: int = Path(..., description="不良品记录ID"),
    approved: bool = Query(..., description="是否同意（true=同意，false=不同意）"),
    rejection_reason: Optional[str] = Query(None, description="驳回原因（当approved=false时必填）"),
    current_user: User = Depends(get_current_user),
    tenant_id: int = Depends(get_current_tenant),
) -> DefectRecordResponse:
    """
    审批不良品让步接收

    - **defect_id**: 不良品记录ID
    - **approved**: 是否同意（true=同意，false=不同意）
    - **rejection_reason**: 驳回原因（当approved=false时必填）
    """
    try:
        return await defect_record_service.approve_defect_acceptance(
            tenant_id=tenant_id,
            defect_id=defect_id,
            approved=approved,
            approved_by=current_user.id,
            rejection_reason=rejection_reason
        )
    except ValidationError as e:
        raise HTTPException(status_code=400, detail=str(e))
    except BusinessLogicError as e:
        raise HTTPException(status_code=400, detail=str(e))


@router.get("/defect", response_model=List[DefectRecordListResponse], summary="查询不良品记录列表")
async def list_defect_records(
    skip: int = Query(0, ge=0, description="跳过数量"),
    limit: int = Query(100, ge=1, le=1000, description="限制数量"),
    work_order_id: Optional[int] = Query(None, description="工单ID"),
    operation_id: Optional[int] = Query(None, description="工序ID"),
    status: Optional[str] = Query(None, description="状态（draft/processed/cancelled）"),
    defect_type: Optional[str] = Query(None, description="不良品类型"),
    disposition: Optional[str] = Query(None, description="处理方式"),
    date_start: Optional[str] = Query(None, description="开始日期（ISO格式）"),
    date_end: Optional[str] = Query(None, description="结束日期（ISO格式）"),
    current_user: User = Depends(get_current_user),
    tenant_id: int = Depends(get_current_tenant),
) -> List[DefectRecordListResponse]:
    """
    查询不良品记录列表

    - **skip**: 跳过数量
    - **limit**: 限制数量
    - **work_order_id**: 工单ID（可选）
    - **operation_id**: 工序ID（可选）
    - **status**: 状态（可选）
    - **defect_type**: 不良品类型（可选）
    - **disposition**: 处理方式（可选）
    - **date_start**: 开始日期（可选）
    - **date_end**: 结束日期（可选）
    """
    date_start_dt = None
    date_end_dt = None
    if date_start:
        date_start_dt = datetime.fromisoformat(date_start.replace('Z', '+00:00'))
    if date_end:
        date_end_dt = datetime.fromisoformat(date_end.replace('Z', '+00:00'))

    return await defect_record_service.list_defect_records(
        tenant_id=tenant_id,
        skip=skip,
        limit=limit,
        work_order_id=work_order_id,
        operation_id=operation_id,
        status=status,
        defect_type=defect_type,
        disposition=disposition,
        date_start=date_start_dt,
        date_end=date_end_dt
    )


@router.get("/defect/statistics", summary="获取不良品统计分析")
async def get_defect_statistics(
    date_start: Optional[str] = Query(None, description="开始日期（ISO格式）"),
    date_end: Optional[str] = Query(None, description="结束日期（ISO格式）"),
    work_order_id: Optional[int] = Query(None, description="工单ID"),
    operation_id: Optional[int] = Query(None, description="工序ID"),
    product_id: Optional[int] = Query(None, description="产品ID"),
    defect_type: Optional[str] = Query(None, description="不良品类型"),
    disposition: Optional[str] = Query(None, description="处理方式"),
    current_user: User = Depends(get_current_user),
    tenant_id: int = Depends(get_current_tenant),
) -> JSONResponse:
    """
    获取不良品统计分析

    - **date_start**: 开始日期（可选）
    - **date_end**: 结束日期（可选）
    - **work_order_id**: 工单ID（可选）
    - **operation_id**: 工序ID（可选）
    - **product_id**: 产品ID（可选）
    - **defect_type**: 不良品类型（可选）
    - **disposition**: 处理方式（可选）
    """
    date_start_dt = None
    date_end_dt = None
    if date_start:
        date_start_dt = datetime.fromisoformat(date_start.replace('Z', '+00:00'))
    if date_end:
        date_end_dt = datetime.fromisoformat(date_end.replace('Z', '+00:00'))

    statistics = await defect_record_service.get_defect_statistics(
        tenant_id=tenant_id,
        date_start=date_start_dt,
        date_end=date_end_dt,
        work_order_id=work_order_id,
        operation_id=operation_id,
        product_id=product_id,
        defect_type=defect_type,
        disposition=disposition
    )

    return JSONResponse(content=statistics)
