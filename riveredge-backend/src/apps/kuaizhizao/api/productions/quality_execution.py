"""
质量检验执行 API 路由模块

提供来料检验、过程检验、成品检验的API接口。
"""

import os
from typing import List, Optional, Dict, Any
from fastapi import APIRouter, Depends, Query, status as http_status, Path, HTTPException, Body
from fastapi.responses import JSONResponse, FileResponse
from loguru import logger

from core.api.deps import get_current_user, get_current_tenant
from infra.models.user import User
from infra.exceptions.exceptions import ValidationError, BusinessLogicError, NotFoundError

from apps.kuaizhizao.services.defect_record_service import DefectRecordService
from apps.kuaizhizao.services.quality_service import (
    IncomingInspectionService,
    ProcessInspectionService,
    FinishedGoodsInspectionService,
)
from apps.kuaizhizao.schemas.defect_record import (
    DefectRecordCreateFromInspection,
    DefectRecordResponse,
)
from apps.kuaizhizao.schemas.quality import (
    IncomingInspectionCreate,
    IncomingInspectionResponse,
    ProcessInspectionCreate,
    ProcessInspectionResponse,
    ProcessInspectionListResponse,
    FinishedGoodsInspectionCreate,
    FinishedGoodsInspectionResponse,
    FinishedGoodsInspectionListResponse,
)

defect_record_service = DefectRecordService()

router = APIRouter(tags=["Kuaige Zhizao - Quality Execution"])


# ============ 来料检验管理 API ============

@router.post("/incoming-inspections", response_model=IncomingInspectionResponse, summary="创建来料检验单")
async def create_incoming_inspection(
    inspection: IncomingInspectionCreate,
    current_user: User = Depends(get_current_user),
    tenant_id: int = Depends(get_current_tenant),
) -> IncomingInspectionResponse:
    """
    创建来料检验单

    - **inspection**: 检验单创建数据
    - **current_user**: 当前用户
    - **tenant_id**: 当前组织ID

    返回创建的来料检验单信息。
    """
    service = IncomingInspectionService()
    return await service.create_incoming_inspection(
        tenant_id=tenant_id,
        inspection_data=inspection,
        created_by=current_user.id
    )


@router.get("/incoming-inspections", summary="获取来料检验单列表")
async def list_incoming_inspections(
    skip: int = Query(0, ge=0, description="跳过数量"),
    limit: int = Query(100, ge=1, le=1000, description="限制数量"),
    status: Optional[str] = Query(None, description="检验状态"),
    quality_status: Optional[str] = Query(None, description="质量状态"),
    supplier_id: Optional[int] = Query(None, description="供应商ID"),
    material_id: Optional[int] = Query(None, description="物料ID"),
    current_user: User = Depends(get_current_user),
    tenant_id: int = Depends(get_current_tenant),
) -> Dict[str, Any]:
    """
    获取来料检验单列表

    支持多种筛选条件的高级搜索。
    """
    service = IncomingInspectionService()
    return await service.list_incoming_inspections(
        tenant_id=tenant_id,
        skip=skip,
        limit=limit,
        status=status,
        quality_status=quality_status,
        supplier_id=supplier_id,
        material_id=material_id,
    )


@router.get("/incoming-inspections/{inspection_id}", response_model=IncomingInspectionResponse, summary="获取来料检验单详情")
async def get_incoming_inspection(
    inspection_id: int,
    current_user: User = Depends(get_current_user),
    tenant_id: int = Depends(get_current_tenant),
) -> IncomingInspectionResponse:
    """
    根据ID获取来料检验单详情

    - **inspection_id**: 检验单ID
    """
    service = IncomingInspectionService()
    return await service.get_incoming_inspection_by_id(
        tenant_id=tenant_id,
        inspection_id=inspection_id
    )


@router.post("/incoming-inspections/{inspection_id}/conduct", response_model=IncomingInspectionResponse, summary="执行来料检验")
async def conduct_incoming_inspection(
    inspection_id: int,
    inspection_data: Dict[str, Any],
    current_user: User = Depends(get_current_user),
    tenant_id: int = Depends(get_current_tenant),
) -> IncomingInspectionResponse:
    """
    执行来料检验

    - **inspection_id**: 检验单ID
    - **inspection_data**: 检验数据
    """
    service = IncomingInspectionService()
    return await service.conduct_inspection(
        tenant_id=tenant_id,
        inspection_id=inspection_id,
        inspection_data=inspection_data,
        inspected_by=current_user.id
    )


@router.post("/incoming-inspections/{inspection_id}/approve", response_model=IncomingInspectionResponse, summary="审核来料检验单")
async def approve_incoming_inspection(
    inspection_id: int,
    rejection_reason: Optional[str] = Query(None, description="驳回原因"),
    current_user: User = Depends(get_current_user),
    tenant_id: int = Depends(get_current_tenant),
) -> IncomingInspectionResponse:
    """
    审核来料检验单

    - **inspection_id**: 检验单ID
    - **rejection_reason**: 驳回原因（可选，不填则通过）
    """
    service = IncomingInspectionService()
    return await service.approve_inspection(
        tenant_id=tenant_id,
        inspection_id=inspection_id,
        approved_by=current_user.id,
        rejection_reason=rejection_reason
    )


@router.post("/incoming-inspections/from-purchase-receipt/{purchase_receipt_id}", response_model=List[IncomingInspectionResponse], summary="从采购入库单创建来料检验单")
async def create_inspection_from_purchase_receipt(
    purchase_receipt_id: int = Path(..., description="采购入库单ID"),
    current_user: User = Depends(get_current_user),
    tenant_id: int = Depends(get_current_tenant),
) -> List[IncomingInspectionResponse]:
    """
    从采购入库单创建来料检验单

    为采购入库单的每个明细项创建一个来料检验单

    - **purchase_receipt_id**: 采购入库单ID
    """
    return await IncomingInspectionService().create_inspection_from_purchase_receipt(
        tenant_id=tenant_id,
        purchase_receipt_id=purchase_receipt_id,
        created_by=current_user.id
    )


@router.post("/incoming-inspections/import", summary="批量导入来料检验单")
async def import_incoming_inspections(
    request: Dict[str, Any],
    current_user: User = Depends(get_current_user),
    tenant_id: int = Depends(get_current_tenant),
):
    """
    批量导入来料检验单

    - **data**: 二维数组数据（从uni_import组件传递）
    """
    data = request.get("data", [])
    result = await IncomingInspectionService().import_from_data(
        tenant_id=tenant_id,
        data=data,
        created_by=current_user.id
    )
    return JSONResponse(content=result)


@router.get("/incoming-inspections/export", response_class=FileResponse, summary="导出来料检验单")
async def export_incoming_inspections(
    status: Optional[str] = Query(None, description="检验状态"),
    quality_status: Optional[str] = Query(None, description="质量状态"),
    supplier_id: Optional[int] = Query(None, description="供应商ID"),
    material_id: Optional[int] = Query(None, description="物料ID"),
    current_user: User = Depends(get_current_user),
    tenant_id: int = Depends(get_current_tenant),
):
    """
    导出来料检验单到Excel文件

    支持多种筛选条件。
    """
    try:
        file_path = await IncomingInspectionService().export_to_excel(
            tenant_id=tenant_id,
            status=status,
            quality_status=quality_status,
            supplier_id=supplier_id,
            material_id=material_id,
        )
        return FileResponse(
            path=file_path,
            filename=os.path.basename(file_path),
            media_type="application/vnd.openxmlformats-officedocument.spreadsheetml.sheet"
        )
    except Exception as e:
        logger.error(f"导出来料检验单失败: {str(e)}")
        raise HTTPException(
            status_code=http_status.HTTP_500_INTERNAL_SERVER_ERROR,
            detail=f"导出失败: {str(e)}"
        )


@router.post("/incoming-inspections/{inspection_id}/create-defect", response_model=DefectRecordResponse, summary="从来料检验单创建不合格品记录")
async def create_defect_from_incoming_inspection(
    inspection_id: int = Path(..., description="来料检验单ID"),
    defect_data: DefectRecordCreateFromInspection = Body(..., description="不合格品记录创建数据"),
    current_user: User = Depends(get_current_user),
    tenant_id: int = Depends(get_current_tenant),
) -> DefectRecordResponse:
    """
    从来料检验单创建不合格品记录

    从不合格的来料检验单创建不合格品记录，支持退货、让步接收等处理方式。

    - **inspection_id**: 来料检验单ID
    - **defect_data**: 不合格品记录创建数据（不合格品数量、类型、原因、处理方式等）
    """
    try:
        return await defect_record_service.create_defect_from_incoming_inspection(
            tenant_id=tenant_id,
            inspection_id=inspection_id,
            defect_data=defect_data,
            created_by=current_user.id
        )
    except NotFoundError as e:
        raise HTTPException(status_code=404, detail=str(e))
    except ValidationError as e:
        raise HTTPException(status_code=400, detail=str(e))
    except BusinessLogicError as e:
        raise HTTPException(status_code=400, detail=str(e))


# ============ 过程检验管理 API ============

@router.post("/process-inspections", response_model=ProcessInspectionResponse, summary="创建过程检验单")
async def create_process_inspection(
    inspection: ProcessInspectionCreate,
    current_user: User = Depends(get_current_user),
    tenant_id: int = Depends(get_current_tenant),
) -> ProcessInspectionResponse:
    """
    创建过程检验单

    - **inspection**: 检验单创建数据
    - **current_user**: 当前用户
    - **tenant_id**: 当前组织ID

    返回创建的过程检验单信息。
    """
    return await ProcessInspectionService().create_process_inspection(
        tenant_id=tenant_id,
        inspection_data=inspection,
        created_by=current_user.id
    )


@router.get("/process-inspections", response_model=List[ProcessInspectionListResponse], summary="获取过程检验单列表")
async def list_process_inspections(
    skip: int = Query(0, ge=0, description="跳过数量"),
    limit: int = Query(100, ge=1, le=1000, description="限制数量"),
    status: Optional[str] = Query(None, description="检验状态"),
    quality_status: Optional[str] = Query(None, description="质量状态"),
    work_order_id: Optional[int] = Query(None, description="工单ID"),
    operation_id: Optional[int] = Query(None, description="工序ID"),
    current_user: User = Depends(get_current_user),
    tenant_id: int = Depends(get_current_tenant),
) -> List[ProcessInspectionListResponse]:
    """
    获取过程检验单列表

    支持多种筛选条件的高级搜索。
    """
    return await ProcessInspectionService().list_process_inspections(
        tenant_id=tenant_id,
        skip=skip,
        limit=limit,
        status=status,
        quality_status=quality_status,
        work_order_id=work_order_id,
        operation_id=operation_id,
    )


@router.get("/process-inspections/{inspection_id}", response_model=ProcessInspectionResponse, summary="获取过程检验单详情")
async def get_process_inspection(
    inspection_id: int,
    current_user: User = Depends(get_current_user),
    tenant_id: int = Depends(get_current_tenant),
) -> ProcessInspectionResponse:
    """
    根据ID获取过程检验单详情

    - **inspection_id**: 检验单ID
    """
    return await ProcessInspectionService().get_process_inspection_by_id(
        tenant_id=tenant_id,
        inspection_id=inspection_id
    )


@router.post("/process-inspections/{inspection_id}/approve", response_model=ProcessInspectionResponse, summary="审核工序检验单")
async def approve_process_inspection(
    inspection_id: int,
    rejection_reason: Optional[str] = Query(None, description="驳回原因"),
    current_user: User = Depends(get_current_user),
    tenant_id: int = Depends(get_current_tenant),
) -> ProcessInspectionResponse:
    """
    审核工序检验单

    - **inspection_id**: 检验单ID
    - **rejection_reason**: 驳回原因（可选，不填则通过）
    """
    return await ProcessInspectionService().approve_inspection(
        tenant_id=tenant_id,
        inspection_id=inspection_id,
        approved_by=current_user.id,
        rejection_reason=rejection_reason
    )


@router.post("/process-inspections/{inspection_id}/conduct", response_model=ProcessInspectionResponse, summary="执行过程检验")
async def conduct_process_inspection(
    inspection_id: int,
    inspection_data: Dict[str, Any],
    current_user: User = Depends(get_current_user),
    tenant_id: int = Depends(get_current_tenant),
) -> ProcessInspectionResponse:
    """
    执行过程检验

    - **inspection_id**: 检验单ID
    - **inspection_data**: 检验数据
    """
    return await ProcessInspectionService().conduct_inspection(
        tenant_id=tenant_id,
        inspection_id=inspection_id,
        inspection_data=inspection_data,
        inspected_by=current_user.id
    )


@router.post("/process-inspections/from-work-order", response_model=ProcessInspectionResponse, summary="从工单和工序创建过程检验单")
async def create_process_inspection_from_work_order(
    work_order_id: int = Query(..., description="工单ID"),
    operation_id: int = Query(..., description="工序ID"),
    current_user: User = Depends(get_current_user),
    tenant_id: int = Depends(get_current_tenant),
) -> ProcessInspectionResponse:
    """
    从工单和工序创建过程检验单

    - **work_order_id**: 工单ID
    - **operation_id**: 工序ID
    """
    return await ProcessInspectionService().create_inspection_from_work_order(
        tenant_id=tenant_id,
        work_order_id=work_order_id,
        operation_id=operation_id,
        created_by=current_user.id
    )


@router.post("/process-inspections/import", summary="批量导入过程检验单")
async def import_process_inspections(
    request: Dict[str, Any],
    current_user: User = Depends(get_current_user),
    tenant_id: int = Depends(get_current_tenant),
):
    """批量导入过程检验单"""
    data = request.get("data", [])
    result = await ProcessInspectionService().import_from_data(
        tenant_id=tenant_id,
        data=data,
        created_by=current_user.id
    )
    return JSONResponse(content=result)


@router.get("/process-inspections/export", response_class=FileResponse, summary="导出过程检验单")
async def export_process_inspections(
    status: Optional[str] = Query(None, description="检验状态"),
    quality_status: Optional[str] = Query(None, description="质量状态"),
    work_order_id: Optional[int] = Query(None, description="工单ID"),
    operation_id: Optional[int] = Query(None, description="工序ID"),
    current_user: User = Depends(get_current_user),
    tenant_id: int = Depends(get_current_tenant),
):
    """导出过程检验单到Excel文件"""
    try:
        file_path = await ProcessInspectionService().export_to_excel(
            tenant_id=tenant_id,
            status=status,
            quality_status=quality_status,
            work_order_id=work_order_id,
            operation_id=operation_id,
        )
        return FileResponse(
            path=file_path,
            filename=os.path.basename(file_path),
            media_type="application/vnd.openxmlformats-officedocument.spreadsheetml.sheet"
        )
    except Exception as e:
        logger.error(f"导出过程检验单失败: {str(e)}")
        raise HTTPException(
            status_code=http_status.HTTP_500_INTERNAL_SERVER_ERROR,
            detail=f"导出失败: {str(e)}"
        )


@router.post("/process-inspections/{inspection_id}/create-defect", response_model=DefectRecordResponse, summary="从过程检验单创建不合格品记录")
async def create_defect_from_process_inspection(
    inspection_id: int = Path(..., description="过程检验单ID"),
    defect_data: DefectRecordCreateFromInspection = Body(..., description="不合格品记录创建数据"),
    current_user: User = Depends(get_current_user),
    tenant_id: int = Depends(get_current_tenant),
) -> DefectRecordResponse:
    """
    从过程检验单创建不合格品记录

    从不合格的过程检验单创建不合格品记录，支持返工、报废、让步接收等处理方式。

    - **inspection_id**: 过程检验单ID
    - **defect_data**: 不合格品记录创建数据（不合格品数量、类型、原因、处理方式等）
    """
    try:
        return await defect_record_service.create_defect_from_process_inspection(
            tenant_id=tenant_id,
            inspection_id=inspection_id,
            defect_data=defect_data,
            created_by=current_user.id
        )
    except NotFoundError as e:
        raise HTTPException(status_code=404, detail=str(e))
    except ValidationError as e:
        raise HTTPException(status_code=400, detail=str(e))
    except BusinessLogicError as e:
        raise HTTPException(status_code=400, detail=str(e))


# ============ 成品检验管理 API ============

@router.post("/finished-goods-inspections", response_model=FinishedGoodsInspectionResponse, summary="创建成品检验单")
async def create_finished_goods_inspection(
    inspection: FinishedGoodsInspectionCreate,
    current_user: User = Depends(get_current_user),
    tenant_id: int = Depends(get_current_tenant),
) -> FinishedGoodsInspectionResponse:
    """
    创建成品检验单

    - **inspection**: 检验单创建数据
    - **current_user**: 当前用户
    - **tenant_id**: 当前组织ID

    返回创建的成品检验单信息。
    """
    service = FinishedGoodsInspectionService()
    return await service.create_finished_goods_inspection(
        tenant_id=tenant_id,
        inspection_data=inspection,
        created_by=current_user.id
    )


@router.get("/finished-goods-inspections", response_model=List[FinishedGoodsInspectionListResponse], summary="获取成品检验单列表")
async def list_finished_goods_inspections(
    skip: int = Query(0, ge=0, description="跳过数量"),
    limit: int = Query(100, ge=1, le=1000, description="限制数量"),
    status: Optional[str] = Query(None, description="检验状态"),
    quality_status: Optional[str] = Query(None, description="质量状态"),
    work_order_id: Optional[int] = Query(None, description="工单ID"),
    source_type: Optional[str] = Query(None, description="来源单据类型"),
    current_user: User = Depends(get_current_user),
    tenant_id: int = Depends(get_current_tenant),
) -> List[FinishedGoodsInspectionListResponse]:
    """
    获取成品检验单列表

    支持多种筛选条件的高级搜索。
    """
    service = FinishedGoodsInspectionService()
    return await service.list_finished_goods_inspections(
        tenant_id=tenant_id,
        skip=skip,
        limit=limit,
        status=status,
        quality_status=quality_status,
        work_order_id=work_order_id,
        source_type=source_type,
    )


@router.get("/finished-goods-inspections/{inspection_id}", response_model=FinishedGoodsInspectionResponse, summary="获取成品检验单详情")
async def get_finished_goods_inspection(
    inspection_id: int,
    current_user: User = Depends(get_current_user),
    tenant_id: int = Depends(get_current_tenant),
) -> FinishedGoodsInspectionResponse:
    """
    根据ID获取成品检验单详情

    - **inspection_id**: 检验单ID
    """
    service = FinishedGoodsInspectionService()
    return await service.get_finished_goods_inspection_by_id(
        tenant_id=tenant_id,
        inspection_id=inspection_id
    )


@router.post("/finished-goods-inspections/{inspection_id}/approve", response_model=FinishedGoodsInspectionResponse, summary="审核成品检验单")
async def approve_finished_goods_inspection(
    inspection_id: int,
    rejection_reason: Optional[str] = Query(None, description="驳回原因"),
    current_user: User = Depends(get_current_user),
    tenant_id: int = Depends(get_current_tenant),
) -> FinishedGoodsInspectionResponse:
    """
    审核成品检验单

    - **inspection_id**: 检验单ID
    - **rejection_reason**: 驳回原因（可选，不填则通过）
    """
    return await FinishedGoodsInspectionService().approve_inspection(
        tenant_id=tenant_id,
        inspection_id=inspection_id,
        approved_by=current_user.id,
        rejection_reason=rejection_reason
    )


@router.post("/finished-goods-inspections/{inspection_id}/conduct", response_model=FinishedGoodsInspectionResponse, summary="执行成品检验")
async def conduct_finished_goods_inspection(
    inspection_id: int,
    inspection_data: Dict[str, Any],
    current_user: User = Depends(get_current_user),
    tenant_id: int = Depends(get_current_tenant),
) -> FinishedGoodsInspectionResponse:
    """
    执行成品检验

    - **inspection_id**: 检验单ID
    - **inspection_data**: 检验数据
    """
    service = FinishedGoodsInspectionService()
    return await service.conduct_inspection(
        tenant_id=tenant_id,
        inspection_id=inspection_id,
        inspection_data=inspection_data,
        inspected_by=current_user.id
    )


@router.post("/finished-goods-inspections/{inspection_id}/certificate", response_model=FinishedGoodsInspectionResponse, summary="出具放行证书")
async def issue_certificate(
    inspection_id: int,
    certificate_number: str = Query(..., description="证书编号"),
    current_user: User = Depends(get_current_user),
    tenant_id: int = Depends(get_current_tenant),
) -> FinishedGoodsInspectionResponse:
    """
    出具放行证书

    - **inspection_id**: 检验单ID
    - **certificate_number**: 证书编号
    """
    return await FinishedGoodsInspectionService().issue_certificate(
        tenant_id=tenant_id,
        inspection_id=inspection_id,
        certificate_number=certificate_number,
        issued_by=current_user.id
    )


@router.post("/finished-goods-inspections/from-work-order", response_model=FinishedGoodsInspectionResponse, summary="从工单创建成品检验单")
async def create_finished_goods_inspection_from_work_order(
    work_order_id: int = Query(..., description="工单ID"),
    current_user: User = Depends(get_current_user),
    tenant_id: int = Depends(get_current_tenant),
) -> FinishedGoodsInspectionResponse:
    """
    从工单创建成品检验单

    - **work_order_id**: 工单ID
    """
    return await FinishedGoodsInspectionService().create_inspection_from_work_order(
        tenant_id=tenant_id,
        work_order_id=work_order_id,
        created_by=current_user.id
    )


@router.post("/finished-goods-inspections/import", summary="批量导入成品检验单")
async def import_finished_goods_inspections(
    request: Dict[str, Any],
    current_user: User = Depends(get_current_user),
    tenant_id: int = Depends(get_current_tenant),
):
    """批量导入成品检验单"""
    data = request.get("data", [])
    result = await FinishedGoodsInspectionService().import_from_data(
        tenant_id=tenant_id,
        data=data,
        created_by=current_user.id
    )
    return JSONResponse(content=result)


@router.get("/finished-goods-inspections/export", response_class=FileResponse, summary="导出成品检验单")
async def export_finished_goods_inspections(
    status: Optional[str] = Query(None, description="检验状态"),
    quality_status: Optional[str] = Query(None, description="质量状态"),
    work_order_id: Optional[int] = Query(None, description="工单ID"),
    current_user: User = Depends(get_current_user),
    tenant_id: int = Depends(get_current_tenant),
):
    """导出成品检验单到Excel文件"""
    try:
        file_path = await FinishedGoodsInspectionService().export_to_excel(
            tenant_id=tenant_id,
            status=status,
            quality_status=quality_status,
            work_order_id=work_order_id,
        )
        return FileResponse(
            path=file_path,
            filename=os.path.basename(file_path),
            media_type="application/vnd.openxmlformats-officedocument.spreadsheetml.sheet"
        )
    except Exception as e:
        logger.error(f"导出成品检验单失败: {str(e)}")
        raise HTTPException(
            status_code=http_status.HTTP_500_INTERNAL_SERVER_ERROR,
            detail=f"导出失败: {str(e)}"
        )


@router.post("/finished-goods-inspections/{inspection_id}/create-defect", response_model=DefectRecordResponse, summary="从成品检验单创建不合格品记录")
async def create_defect_from_finished_goods_inspection(
    inspection_id: int = Path(..., description="成品检验单ID"),
    defect_data: DefectRecordCreateFromInspection = Body(..., description="不合格品记录创建数据"),
    current_user: User = Depends(get_current_user),
    tenant_id: int = Depends(get_current_tenant),
) -> DefectRecordResponse:
    """
    从成品检验单创建不合格品记录

    从不合格的成品检验单创建不合格品记录，支持返工、报废、让步接收等处理方式。

    - **inspection_id**: 成品检验单ID
    - **defect_data**: 不合格品记录创建数据（不合格品数量、类型、原因、处理方式等）
    """
    try:
        return await defect_record_service.create_defect_from_finished_goods_inspection(
            tenant_id=tenant_id,
            inspection_id=inspection_id,
            defect_data=defect_data,
            created_by=current_user.id
        )
    except NotFoundError as e:
        raise HTTPException(status_code=404, detail=str(e))
    except ValidationError as e:
        raise HTTPException(status_code=400, detail=str(e))
    except BusinessLogicError as e:
        raise HTTPException(status_code=400, detail=str(e))
