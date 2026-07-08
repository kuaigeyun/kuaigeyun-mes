"""
质量检验执行 API 路由模块

提供来料检验、过程检验、成品检验的API接口。
"""

import os
import uuid
from typing import List, Optional, Dict, Any
from fastapi import APIRouter, Depends, Query, status as http_status, Path, HTTPException as FastAPIHTTPException, Body, Request
from fastapi.responses import JSONResponse, FileResponse, HTMLResponse
from loguru import logger

from core.api.deps import get_current_user, get_current_tenant
from core.api.deps.access import require_permission_codes
from core.services.authorization.data_scope_service import DataScopeService
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
    EnsureIqcForPurchaseReceiptResponse,
    EnsureIqcForCustomerMaterialRegistrationResponse,
    EnsureFqcForFinishedGoodsReceiptResponse,
    ProcessInspectionCreate,
    ProcessInspectionResponse,
    ProcessInspectionListResponse,
    FinishedGoodsInspectionCreate,
    FinishedGoodsInspectionResponse,
    FinishedGoodsInspectionListResponse,
)
from apps.kuaizhizao.schemas.inspection_policy import (
    QualityEffectiveConfigResponse,
    QualityInspectionStageTogglesResponse,
    QualityInspectionStageTogglesUpdate,
)
from apps.kuaizhizao.services.inspection_policy_service import (
    get_quality_effective_config,
    get_quality_inspection_stage_toggles,
    set_quality_inspection_stage_toggles,
)

defect_record_service = DefectRecordService()

router = APIRouter(tags=["App · Kuaige Zhizao · Quality Execution"])


def _http_exception_with_trace(
    status_code: int,
    message: str,
    route: str = "/quality-execution",
    tenant_id: Optional[int] = None,
) -> FastAPIHTTPException:
    trace_id = uuid.uuid4().hex
    logger.warning(
        "kuaizhizao_quality_execution_api_error trace_id={} tenant_id={} route={} status_code={} message={}",
        trace_id,
        tenant_id,
        route,
        status_code,
        message,
    )
    return FastAPIHTTPException(
        status_code=status_code,
        detail={"message": message, "trace_id": trace_id},
    )


def HTTPException(*, status_code: int, detail: Any, **kwargs) -> FastAPIHTTPException:
    message = detail.get("message") if isinstance(detail, dict) else str(detail)
    return _http_exception_with_trace(status_code, message)


async def _scoped_work_order_ids(*, tenant_id: int, current_user: User) -> List[int]:
    from apps.kuaizhizao.models.work_order import WorkOrder

    scoped_query = await DataScopeService.apply(
        WorkOrder.filter(tenant_id=tenant_id, deleted_at__isnull=True),
        tenant_id=tenant_id,
        user=current_user,
        resource="kuaizhizao:work-order",
    )
    ids = await scoped_query.values_list("id", flat=True)
    return [int(x) for x in ids]


async def _scoped_purchase_receipt_ids(*, tenant_id: int, current_user: User) -> List[int]:
    from apps.kuaizhizao.models.purchase_receipt import PurchaseReceipt

    scoped_receipt_query = await DataScopeService.apply(
        PurchaseReceipt.filter(tenant_id=tenant_id, deleted_at__isnull=True),
        tenant_id=tenant_id,
        user=current_user,
        resource="kuaizhizao:purchase-receipt",
    )
    receipt_ids = await scoped_receipt_query.values_list("id", flat=True)
    return [int(x) for x in receipt_ids]


async def _assert_work_order_visible_by_id(
    *,
    tenant_id: int,
    current_user: User,
    work_order_id: Optional[int],
) -> None:
    from apps.kuaizhizao.models.work_order import WorkOrder

    if not work_order_id:
        return
    work_order = await WorkOrder.get_or_none(
        tenant_id=tenant_id,
        id=work_order_id,
        deleted_at__isnull=True,
    )
    if not work_order:
        return
    await DataScopeService.assert_row_visible(
        work_order,
        tenant_id=tenant_id,
        user=current_user,
        resource="kuaizhizao:work-order",
    )


async def _assert_purchase_receipt_visible_by_id(
    *,
    tenant_id: int,
    current_user: User,
    purchase_receipt_id: Optional[int],
) -> None:
    from apps.kuaizhizao.models.purchase_receipt import PurchaseReceipt

    if not purchase_receipt_id:
        return
    receipt = await PurchaseReceipt.get_or_none(
        tenant_id=tenant_id,
        id=purchase_receipt_id,
        deleted_at__isnull=True,
    )
    if not receipt:
        return
    # 引用单据（采购订单）仅用于追溯，不应阻塞采购入库单本身的查看/确认。
    await DataScopeService.assert_row_visible(
        receipt,
        tenant_id=tenant_id,
        user=current_user,
        resource="kuaizhizao:purchase-receipt",
    )


async def _assert_finished_goods_receipt_visible_by_id(
    *,
    tenant_id: int,
    current_user: User,
    finished_goods_receipt_id: Optional[int],
) -> None:
    from apps.kuaizhizao.models.finished_goods_receipt import FinishedGoodsReceipt

    if not finished_goods_receipt_id:
        return
    receipt = await FinishedGoodsReceipt.get_or_none(
        tenant_id=tenant_id,
        id=finished_goods_receipt_id,
        deleted_at__isnull=True,
    )
    if not receipt:
        return
    await DataScopeService.assert_row_visible(
        receipt,
        tenant_id=tenant_id,
        user=current_user,
        resource="kuaizhizao:inbound",
    )


async def _assert_semi_finished_goods_receipt_visible_by_id(
    *,
    tenant_id: int,
    current_user: User,
    semi_finished_goods_receipt_id: Optional[int],
) -> None:
    from apps.kuaizhizao.models.semi_finished_goods_receipt import SemiFinishedGoodsReceipt

    if not semi_finished_goods_receipt_id:
        return
    receipt = await SemiFinishedGoodsReceipt.get_or_none(
        tenant_id=tenant_id,
        id=semi_finished_goods_receipt_id,
        deleted_at__isnull=True,
    )
    if not receipt:
        return
    await DataScopeService.assert_row_visible(
        receipt,
        tenant_id=tenant_id,
        user=current_user,
        resource="kuaizhizao:inbound",
    )


async def _assert_customer_material_registration_visible_by_id(
    *,
    tenant_id: int,
    current_user: User,
    registration_id: Optional[int],
) -> None:
    from apps.kuaizhizao.models.customer_material_registration import CustomerMaterialRegistration

    if not registration_id:
        return
    registration = await CustomerMaterialRegistration.get_or_none(
        tenant_id=tenant_id,
        id=registration_id,
        deleted_at__isnull=True,
    )
    if not registration:
        return
    await DataScopeService.assert_row_visible(
        registration,
        tenant_id=tenant_id,
        user=current_user,
        resource="kuaizhizao:inbound",
    )


async def _assert_incoming_inspection_visible(
    *,
    tenant_id: int,
    current_user: User,
    inspection_id: int,
) -> None:
    from apps.kuaizhizao.models.incoming_inspection import IncomingInspection

    inspection = await IncomingInspection.get_or_none(
        tenant_id=tenant_id,
        id=inspection_id,
        deleted_at__isnull=True,
    )
    if not inspection:
        return
    await _assert_purchase_receipt_visible_by_id(
        tenant_id=tenant_id,
        current_user=current_user,
        purchase_receipt_id=getattr(inspection, "purchase_receipt_id", None),
    )


async def _assert_process_inspection_visible(
    *,
    tenant_id: int,
    current_user: User,
    inspection_id: int,
) -> None:
    from apps.kuaizhizao.models.process_inspection import ProcessInspection

    inspection = await ProcessInspection.get_or_none(
        tenant_id=tenant_id,
        id=inspection_id,
        deleted_at__isnull=True,
    )
    if not inspection:
        return
    await _assert_work_order_visible_by_id(
        tenant_id=tenant_id,
        current_user=current_user,
        work_order_id=getattr(inspection, "work_order_id", None),
    )


async def _assert_finished_goods_inspection_visible(
    *,
    tenant_id: int,
    current_user: User,
    inspection_id: int,
) -> None:
    from apps.kuaizhizao.models.finished_goods_inspection import FinishedGoodsInspection

    inspection = await FinishedGoodsInspection.get_or_none(
        tenant_id=tenant_id,
        id=inspection_id,
        deleted_at__isnull=True,
    )
    if not inspection:
        return
    await _assert_work_order_visible_by_id(
        tenant_id=tenant_id,
        current_user=current_user,
        work_order_id=getattr(inspection, "work_order_id", None),
    )


# ============ 来料检验管理 API ============

@router.post("/incoming-inspections", response_model=IncomingInspectionResponse, summary="Create incoming inspection")
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


@router.get("/incoming-inspections/statistics", summary="Incoming inspection statistics (KPI cards)")
async def get_incoming_inspection_statistics(
    current_user: User = Depends(get_current_user),
    tenant_id: int = Depends(get_current_tenant),
) -> Dict[str, Any]:
    """返回来料检验各维度数量，用于列表页指标卡片。"""
    from apps.kuaizhizao.models.incoming_inspection import IncomingInspection

    base = IncomingInspection.filter(tenant_id=tenant_id)
    try:
        pending_count = await base.filter(status__in=["待检验", "pending"]).count()
    except Exception as e:
        logger.warning(f"incoming-inspection-statistics pending_count: {e}")
        pending_count = 0
    try:
        qualified_count = await base.filter(
            status__in=["已检验", "待审核", "已审核", "inspected", "pending_review", "audited"],
            quality_status__in=["合格", "qualified"]
        ).count()
    except Exception as e:
        logger.warning(f"incoming-inspection-statistics qualified_count: {e}")
        qualified_count = 0
    try:
        unqualified_count = await base.filter(
            status__in=["已检验", "待审核", "已审核", "inspected", "pending_review", "audited"],
            quality_status__in=["不合格", "unqualified"]
        ).count()
    except Exception as e:
        logger.warning(f"incoming-inspection-statistics unqualified_count: {e}")
        unqualified_count = 0
    try:
        total_count = await base.count()
    except Exception as e:
        logger.warning(f"incoming-inspection-statistics total_count: {e}")
        total_count = 0

    return {
        "pending_count": pending_count,
        "qualified_count": qualified_count,
        "unqualified_count": unqualified_count,
        "total_count": total_count,
    }


@router.get("/incoming-inspections", summary="List incoming inspections")
async def list_incoming_inspections(
    skip: int = Query(0, ge=0, description="跳过数量"),
    limit: int = Query(100, ge=1, le=1000, description="限制数量"),
    status: Optional[str] = Query(None, description="检验状态"),
    quality_status: Optional[str] = Query(None, description="质量状态"),
    supplier_id: Optional[int] = Query(None, description="供应商ID"),
    material_id: Optional[int] = Query(None, description="物料ID"),
    purchase_receipt_id: Optional[int] = Query(None, description="采购入库单ID"),
    customer_material_registration_id: Optional[int] = Query(None, description="代工来料单ID"),
    keyword: Optional[str] = Query(None, description="模糊搜索"),
    order_by: Optional[str] = Query(None, description="排序字段（前缀-表示降序）"),
    inspection_start_date: Optional[str] = Query(None, description="检验开始日期 YYYY-MM-DD"),
    inspection_end_date: Optional[str] = Query(None, description="检验结束日期 YYYY-MM-DD"),
    created_start_date: Optional[str] = Query(None, description="创建开始日期 YYYY-MM-DD"),
    created_end_date: Optional[str] = Query(None, description="创建结束日期 YYYY-MM-DD"),
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
        purchase_receipt_id=purchase_receipt_id,
        customer_material_registration_id=customer_material_registration_id,
        keyword=keyword,
        order_by=order_by,
        inspection_start_date=inspection_start_date,
        inspection_end_date=inspection_end_date,
        created_start_date=created_start_date,
        created_end_date=created_end_date,
    )


@router.get("/incoming-inspections/{inspection_id}", response_model=IncomingInspectionResponse, summary="Get incoming inspection")
async def get_incoming_inspection(
    inspection_id: int,
    current_user: User = Depends(get_current_user),
    tenant_id: int = Depends(get_current_tenant),
) -> IncomingInspectionResponse:
    """
    根据ID获取来料检验单详情

    - **inspection_id**: 检验单ID
    """
    await _assert_incoming_inspection_visible(
        tenant_id=tenant_id,
        current_user=current_user,
        inspection_id=inspection_id,
    )
    service = IncomingInspectionService()
    return await service.get_incoming_inspection_by_id(
        tenant_id=tenant_id,
        inspection_id=inspection_id
    )


@router.post("/incoming-inspections/{inspection_id}/conduct", response_model=IncomingInspectionResponse, summary="Run incoming inspection")
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
    await _assert_incoming_inspection_visible(
        tenant_id=tenant_id,
        current_user=current_user,
        inspection_id=inspection_id,
    )
    service = IncomingInspectionService()
    return await service.conduct_inspection(
        tenant_id=tenant_id,
        inspection_id=inspection_id,
        inspection_data=inspection_data,
        inspected_by=current_user.id
    )


@router.post("/incoming-inspections/{inspection_id}/approve", response_model=IncomingInspectionResponse, summary="Approve incoming inspection")
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
    await _assert_incoming_inspection_visible(
        tenant_id=tenant_id,
        current_user=current_user,
        inspection_id=inspection_id,
    )
    service = IncomingInspectionService()
    return await service.approve_inspection(
        tenant_id=tenant_id,
        inspection_id=inspection_id,
        approved_by=current_user.id,
        rejection_reason=rejection_reason
    )


@router.get(
    "/incoming-inspections/{inspection_id}/push-to-purchase-return/preview",
    summary="Preview push incoming inspection to purchase return",
)
async def preview_push_incoming_inspection_to_purchase_return(
    inspection_id: int = Path(..., description="来料检验单ID"),
    tenant_id: int = Depends(get_current_tenant),
    current_user: User = Depends(get_current_user),
) -> Dict[str, Any]:
    """来料检验不合格下推采购退货单预览。"""
    await _assert_incoming_inspection_visible(
        tenant_id=tenant_id,
        current_user=current_user,
        inspection_id=inspection_id,
    )
    return await IncomingInspectionService().preview_push_to_purchase_return(
        tenant_id=tenant_id,
        inspection_id=inspection_id,
    )


@router.post(
    "/incoming-inspections/{inspection_id}/push-to-purchase-return",
    response_model=Dict[str, Any],
    summary="Push incoming inspection to purchase return",
)
async def push_incoming_inspection_to_purchase_return(
    inspection_id: int = Path(..., description="来料检验单ID"),
    current_user: User = Depends(get_current_user),
    tenant_id: int = Depends(get_current_tenant),
) -> Dict[str, Any]:
    """来料检验不合格下推采购退货单。"""
    await _assert_incoming_inspection_visible(
        tenant_id=tenant_id,
        current_user=current_user,
        inspection_id=inspection_id,
    )
    return await IncomingInspectionService().push_to_purchase_return(
        tenant_id=tenant_id,
        inspection_id=inspection_id,
        created_by=current_user.id,
    )


@router.get(
    "/incoming-inspections/pull-candidates/purchase-receipts",
    summary="List purchase receipt pull candidates for incoming inspection",
)
async def list_incoming_inspection_purchase_receipt_pull_candidates(
    skip: int = Query(0, ge=0),
    limit: int = Query(20, ge=1, le=100),
    keyword: Optional[str] = Query(None),
    current_user: User = Depends(get_current_user),
    tenant_id: int = Depends(get_current_tenant),
) -> Dict[str, Any]:
    return await IncomingInspectionService().list_purchase_receipt_pull_candidates(
        tenant_id=tenant_id,
        skip=skip,
        limit=limit,
        keyword=keyword,
    )


@router.get(
    "/incoming-inspections/pull-candidates/customer-material-registrations",
    summary="List customer material pull candidates for incoming inspection",
)
async def list_incoming_inspection_customer_material_pull_candidates(
    skip: int = Query(0, ge=0),
    limit: int = Query(20, ge=1, le=100),
    keyword: Optional[str] = Query(None),
    current_user: User = Depends(get_current_user),
    tenant_id: int = Depends(get_current_tenant),
) -> Dict[str, Any]:
    return await IncomingInspectionService().list_customer_material_pull_candidates(
        tenant_id=tenant_id,
        skip=skip,
        limit=limit,
        keyword=keyword,
    )


@router.get(
    "/incoming-inspections/from-purchase-receipt/{purchase_receipt_id}/pull-preview",
    summary="Preview pull incoming inspection from purchase receipt",
)
async def preview_pull_incoming_inspection_from_purchase_receipt(
    purchase_receipt_id: int = Path(..., description="采购入库单ID"),
    current_user: User = Depends(get_current_user),
    tenant_id: int = Depends(get_current_tenant),
) -> Dict[str, Any]:
    await _assert_purchase_receipt_visible_by_id(
        tenant_id=tenant_id,
        current_user=current_user,
        purchase_receipt_id=purchase_receipt_id,
    )
    return await IncomingInspectionService().preview_pull_from_purchase_receipt(
        tenant_id=tenant_id,
        purchase_receipt_id=purchase_receipt_id,
    )


@router.get(
    "/incoming-inspections/from-customer-material/{registration_id}/pull-preview",
    summary="Preview pull incoming inspection from customer material registration",
)
async def preview_pull_incoming_inspection_from_customer_material(
    registration_id: int = Path(..., description="代工来料单ID"),
    current_user: User = Depends(get_current_user),
    tenant_id: int = Depends(get_current_tenant),
) -> Dict[str, Any]:
    await _assert_customer_material_registration_visible_by_id(
        tenant_id=tenant_id,
        current_user=current_user,
        registration_id=registration_id,
    )
    return await IncomingInspectionService().preview_pull_from_customer_material_registration(
        tenant_id=tenant_id,
        registration_id=registration_id,
    )


@router.post("/incoming-inspections/from-purchase-receipt/{purchase_receipt_id}", response_model=List[IncomingInspectionResponse], summary="Create incoming inspection from purchase receipt")
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
    await _assert_purchase_receipt_visible_by_id(
        tenant_id=tenant_id,
        current_user=current_user,
        purchase_receipt_id=purchase_receipt_id,
    )
    return await IncomingInspectionService().create_inspection_from_purchase_receipt(
        tenant_id=tenant_id,
        purchase_receipt_id=purchase_receipt_id,
        created_by=current_user.id
    )


@router.post(
    "/incoming-inspections/ensure-for-purchase-receipt/{purchase_receipt_id}",
    response_model=EnsureIqcForPurchaseReceiptResponse,
    summary="Ensure IQC before purchase receipt confirm",
)
async def ensure_iqc_for_purchase_receipt(
    purchase_receipt_id: int = Path(..., description="采购入库单ID"),
    current_user: User = Depends(get_current_user),
    tenant_id: int = Depends(get_current_tenant),
) -> EnsureIqcForPurchaseReceiptResponse:
    """
    确认入库前：按物料 IQC 策略自动补齐缺失来料检验单，并返回是否允许进入确认预览。
    """
    await _assert_purchase_receipt_visible_by_id(
        tenant_id=tenant_id,
        current_user=current_user,
        purchase_receipt_id=purchase_receipt_id,
    )
    return await IncomingInspectionService().ensure_iqc_for_purchase_receipt(
        tenant_id=tenant_id,
        purchase_receipt_id=purchase_receipt_id,
        created_by=current_user.id,
    )


@router.post(
    "/finished-goods-inspections/ensure-for-finished-goods-receipt/{finished_goods_receipt_id}",
    response_model=EnsureFqcForFinishedGoodsReceiptResponse,
    summary="Ensure FQC before finished goods receipt confirm",
)
async def ensure_fqc_for_finished_goods_receipt(
    finished_goods_receipt_id: int = Path(..., description="成品入库单ID"),
    current_user: User = Depends(get_current_user),
    tenant_id: int = Depends(get_current_tenant),
) -> EnsureFqcForFinishedGoodsReceiptResponse:
    """
    确认入库前：按物料 FQC 策略自动补齐缺失成品检验单，并返回是否允许进入确认预览。
    """
    await _assert_finished_goods_receipt_visible_by_id(
        tenant_id=tenant_id,
        current_user=current_user,
        finished_goods_receipt_id=finished_goods_receipt_id,
    )
    return await FinishedGoodsInspectionService().ensure_fqc_for_finished_goods_receipt(
        tenant_id=tenant_id,
        finished_goods_receipt_id=finished_goods_receipt_id,
        created_by=current_user.id,
    )


@router.post(
    "/finished-goods-inspections/ensure-for-semi-finished-goods-receipt/{semi_finished_goods_receipt_id}",
    response_model=EnsureFqcForFinishedGoodsReceiptResponse,
    summary="Ensure FQC before semi-finished goods receipt confirm",
)
async def ensure_fqc_for_semi_finished_goods_receipt(
    semi_finished_goods_receipt_id: int = Path(..., description="半成品入库单ID"),
    current_user: User = Depends(get_current_user),
    tenant_id: int = Depends(get_current_tenant),
) -> EnsureFqcForFinishedGoodsReceiptResponse:
    """确认半成品入库前：按物料 FQC 策略自动补齐缺失成品检验单，并返回是否允许进入确认预览。"""
    await _assert_semi_finished_goods_receipt_visible_by_id(
        tenant_id=tenant_id,
        current_user=current_user,
        semi_finished_goods_receipt_id=semi_finished_goods_receipt_id,
    )
    return await FinishedGoodsInspectionService().ensure_fqc_for_semi_finished_goods_receipt(
        tenant_id=tenant_id,
        semi_finished_goods_receipt_id=semi_finished_goods_receipt_id,
        created_by=current_user.id,
    )


@router.post(
    "/incoming-inspections/ensure-for-customer-material-registration/{registration_id}",
    response_model=EnsureIqcForCustomerMaterialRegistrationResponse,
    summary="Ensure IQC before customer material inbound confirm",
)
async def ensure_iqc_for_customer_material_registration(
    registration_id: int = Path(..., description="代工来料单ID"),
    current_user: User = Depends(get_current_user),
    tenant_id: int = Depends(get_current_tenant),
) -> EnsureIqcForCustomerMaterialRegistrationResponse:
    """确认代工来料入库前：按物料 IQC 策略自动补齐缺失来料检验单，并返回是否允许确认入库。"""
    await _assert_customer_material_registration_visible_by_id(
        tenant_id=tenant_id,
        current_user=current_user,
        registration_id=registration_id,
    )
    return await IncomingInspectionService().ensure_iqc_for_customer_material_registration(
        tenant_id=tenant_id,
        registration_id=registration_id,
        created_by=current_user.id,
    )


@router.post(
    "/incoming-inspections/from-customer-material/{registration_id}",
    response_model=List[IncomingInspectionResponse],
    summary="Create incoming inspection from customer material inbound",
)
async def create_inspection_from_customer_material(
    registration_id: int = Path(..., description="代工来料单ID"),
    current_user: User = Depends(get_current_user),
    tenant_id: int = Depends(get_current_tenant),
) -> List[IncomingInspectionResponse]:
    """从代工来料单创建来料检验单"""
    return await IncomingInspectionService().create_inspection_from_customer_material_registration(
        tenant_id=tenant_id,
        registration_id=registration_id,
        created_by=current_user.id,
    )


@router.post("/incoming-inspections/import", summary="Batch import incoming inspections")
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


@router.get("/incoming-inspections/export", response_class=FileResponse, summary="Export incoming inspections")
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
        scoped_purchase_receipt_ids = await _scoped_purchase_receipt_ids(
            tenant_id=tenant_id,
            current_user=current_user,
        )
        file_path = await IncomingInspectionService().export_to_excel(
            tenant_id=tenant_id,
            status=status,
            quality_status=quality_status,
            supplier_id=supplier_id,
            material_id=material_id,
            scoped_purchase_receipt_ids=scoped_purchase_receipt_ids,
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


@router.post("/incoming-inspections/{inspection_id}/create-defect", response_model=DefectRecordResponse, summary="Create defect from incoming inspection")
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
        await _assert_incoming_inspection_visible(
            tenant_id=tenant_id,
            current_user=current_user,
            inspection_id=inspection_id,
        )
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

@router.post("/process-inspections", response_model=ProcessInspectionResponse, summary="Create in-process inspection")
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


@router.get("/process-inspections/statistics", summary="In-process inspection statistics (KPI cards)")
async def get_process_inspection_statistics(
    current_user: User = Depends(get_current_user),
    tenant_id: int = Depends(get_current_tenant),
) -> Dict[str, Any]:
    """返回过程检验各维度数量，用于列表页指标卡片。"""
    from apps.kuaizhizao.models.process_inspection import ProcessInspection

    base = ProcessInspection.filter(tenant_id=tenant_id)
    try:
        pending_count = await base.filter(status__in=["待检验", "pending"]).count()
    except Exception as e:
        logger.warning(f"process-inspection-statistics pending_count: {e}")
        pending_count = 0
    try:
        qualified_count = await base.filter(
            status__in=["已检验", "待审核", "已审核", "inspected", "pending_review", "audited"],
            quality_status__in=["合格", "qualified"]
        ).count()
    except Exception as e:
        logger.warning(f"process-inspection-statistics qualified_count: {e}")
        qualified_count = 0
    try:
        unqualified_count = await base.filter(
            status__in=["已检验", "待审核", "已审核", "inspected", "pending_review", "audited"],
            quality_status__in=["不合格", "unqualified"]
        ).count()
    except Exception as e:
        logger.warning(f"process-inspection-statistics unqualified_count: {e}")
        unqualified_count = 0
    try:
        total_count = await base.count()
    except Exception as e:
        logger.warning(f"process-inspection-statistics total_count: {e}")
        total_count = 0

    return {
        "pending_count": pending_count,
        "qualified_count": qualified_count,
        "unqualified_count": unqualified_count,
        "total_count": total_count,
    }


@router.get("/process-inspections", summary="List in-process inspections")
async def list_process_inspections(
    skip: int = Query(0, ge=0, description="跳过数量"),
    limit: int = Query(100, ge=1, le=1000, description="限制数量"),
    status: Optional[str] = Query(None, description="检验状态"),
    quality_status: Optional[str] = Query(None, description="质量状态"),
    work_order_id: Optional[int] = Query(None, description="工单ID"),
    operation_id: Optional[int] = Query(None, description="工序ID"),
    keyword: Optional[str] = Query(None, description="模糊搜索"),
    order_by: Optional[str] = Query(None, description="排序字段（前缀-表示降序）"),
    inspection_start_date: Optional[str] = Query(None, description="检验开始日期 YYYY-MM-DD"),
    inspection_end_date: Optional[str] = Query(None, description="检验结束日期 YYYY-MM-DD"),
    created_start_date: Optional[str] = Query(None, description="创建开始日期 YYYY-MM-DD"),
    created_end_date: Optional[str] = Query(None, description="创建结束日期 YYYY-MM-DD"),
    current_user: User = Depends(get_current_user),
    tenant_id: int = Depends(get_current_tenant),
) -> Dict[str, Any]:
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
        keyword=keyword,
        order_by=order_by,
        inspection_start_date=inspection_start_date,
        inspection_end_date=inspection_end_date,
        created_start_date=created_start_date,
        created_end_date=created_end_date,
    )


@router.get("/process-inspections/{inspection_id}", response_model=ProcessInspectionResponse, summary="Get in-process inspection")
async def get_process_inspection(
    inspection_id: int,
    current_user: User = Depends(get_current_user),
    tenant_id: int = Depends(get_current_tenant),
) -> ProcessInspectionResponse:
    """
    根据ID获取过程检验单详情

    - **inspection_id**: 检验单ID
    """
    await _assert_process_inspection_visible(
        tenant_id=tenant_id,
        current_user=current_user,
        inspection_id=inspection_id,
    )
    return await ProcessInspectionService().get_process_inspection_by_id(
        tenant_id=tenant_id,
        inspection_id=inspection_id
    )


@router.post("/process-inspections/{inspection_id}/approve", response_model=ProcessInspectionResponse, summary="Approve in-process inspection")
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
    await _assert_process_inspection_visible(
        tenant_id=tenant_id,
        current_user=current_user,
        inspection_id=inspection_id,
    )
    return await ProcessInspectionService().approve_inspection(
        tenant_id=tenant_id,
        inspection_id=inspection_id,
        approved_by=current_user.id,
        rejection_reason=rejection_reason
    )


@router.post("/process-inspections/{inspection_id}/conduct", response_model=ProcessInspectionResponse, summary="Run in-process inspection")
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
    await _assert_process_inspection_visible(
        tenant_id=tenant_id,
        current_user=current_user,
        inspection_id=inspection_id,
    )
    return await ProcessInspectionService().conduct_inspection(
        tenant_id=tenant_id,
        inspection_id=inspection_id,
        inspection_data=inspection_data,
        inspected_by=current_user.id
    )


@router.post("/process-inspections/from-work-order", response_model=ProcessInspectionResponse, summary="Create in-process inspection from work order")
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
    await _assert_work_order_visible_by_id(
        tenant_id=tenant_id,
        current_user=current_user,
        work_order_id=work_order_id,
    )
    return await ProcessInspectionService().create_inspection_from_work_order(
        tenant_id=tenant_id,
        work_order_id=work_order_id,
        operation_id=operation_id,
        created_by=current_user.id
    )


@router.get(
    "/process-inspections/pull-candidates/work-orders",
    summary="List work order pull candidates for process inspection",
)
async def list_process_inspection_work_order_pull_candidates(
    skip: int = Query(0, ge=0),
    limit: int = Query(20, ge=1, le=100),
    keyword: Optional[str] = Query(None),
    current_user: User = Depends(get_current_user),
    tenant_id: int = Depends(get_current_tenant),
) -> Dict[str, Any]:
    return await ProcessInspectionService().list_work_order_pull_candidates(
        tenant_id=tenant_id,
        skip=skip,
        limit=limit,
        keyword=keyword,
    )


@router.get(
    "/process-inspections/from-work-order/{work_order_id}/pull-preview",
    summary="Preview pull process inspection from work order",
)
async def preview_pull_process_inspection_from_work_order(
    work_order_id: int = Path(..., description="工单ID"),
    current_user: User = Depends(get_current_user),
    tenant_id: int = Depends(get_current_tenant),
) -> Dict[str, Any]:
    await _assert_work_order_visible_by_id(
        tenant_id=tenant_id,
        current_user=current_user,
        work_order_id=work_order_id,
    )
    return await ProcessInspectionService().preview_pull_from_work_order(
        tenant_id=tenant_id,
        work_order_id=work_order_id,
    )


@router.post("/process-inspections/import", summary="Batch import in-process inspections")
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


@router.get("/process-inspections/export", response_class=FileResponse, summary="Export in-process inspections")
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
        scoped_work_order_ids = await _scoped_work_order_ids(
            tenant_id=tenant_id,
            current_user=current_user,
        )
        file_path = await ProcessInspectionService().export_to_excel(
            tenant_id=tenant_id,
            status=status,
            quality_status=quality_status,
            work_order_id=work_order_id,
            operation_id=operation_id,
            scoped_work_order_ids=scoped_work_order_ids,
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


@router.post("/process-inspections/{inspection_id}/create-defect", response_model=DefectRecordResponse, summary="Create defect from in-process inspection")
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
        await _assert_process_inspection_visible(
            tenant_id=tenant_id,
            current_user=current_user,
            inspection_id=inspection_id,
        )
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

@router.post("/finished-goods-inspections", response_model=FinishedGoodsInspectionResponse, summary="Create finished goods inspection")
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


@router.get("/finished-goods-inspections/statistics", summary="FG inspection statistics (KPI cards)")
async def get_finished_goods_inspection_statistics(
    current_user: User = Depends(get_current_user),
    tenant_id: int = Depends(get_current_tenant),
) -> Dict[str, Any]:
    """返回成品检验各维度数量，用于列表页指标卡片。"""
    from apps.kuaizhizao.models.finished_goods_inspection import FinishedGoodsInspection

    base = FinishedGoodsInspection.filter(tenant_id=tenant_id)
    try:
        pending_count = await base.filter(status__in=["待检验", "pending"]).count()
    except Exception as e:
        logger.warning(f"finished-goods-inspection-statistics pending_count: {e}")
        pending_count = 0
    try:
        qualified_count = await base.filter(
            status__in=["已检验", "待审核", "已审核", "inspected", "pending_review", "audited"],
            quality_status__in=["合格", "qualified"]
        ).count()
    except Exception as e:
        logger.warning(f"finished-goods-inspection-statistics qualified_count: {e}")
        qualified_count = 0
    try:
        unqualified_count = await base.filter(
            status__in=["已检验", "待审核", "已审核", "inspected", "pending_review", "audited"],
            quality_status__in=["不合格", "unqualified"]
        ).count()
    except Exception as e:
        logger.warning(f"finished-goods-inspection-statistics unqualified_count: {e}")
        unqualified_count = 0
    try:
        total_count = await base.count()
    except Exception as e:
        logger.warning(f"finished-goods-inspection-statistics total_count: {e}")
        total_count = 0

    return {
        "pending_count": pending_count,
        "qualified_count": qualified_count,
        "unqualified_count": unqualified_count,
        "total_count": total_count,
    }


@router.get("/finished-goods-inspections", summary="List finished goods inspections")
async def list_finished_goods_inspections(
    skip: int = Query(0, ge=0, description="跳过数量"),
    limit: int = Query(100, ge=1, le=1000, description="限制数量"),
    status: Optional[str] = Query(None, description="检验状态"),
    quality_status: Optional[str] = Query(None, description="质量状态"),
    work_order_id: Optional[int] = Query(None, description="工单ID"),
    source_type: Optional[str] = Query(None, description="来源单据类型"),
    keyword: Optional[str] = Query(None, description="模糊搜索"),
    order_by: Optional[str] = Query(None, description="排序字段（前缀-表示降序）"),
    inspection_start_date: Optional[str] = Query(None, description="检验开始日期 YYYY-MM-DD"),
    inspection_end_date: Optional[str] = Query(None, description="检验结束日期 YYYY-MM-DD"),
    created_start_date: Optional[str] = Query(None, description="创建开始日期 YYYY-MM-DD"),
    created_end_date: Optional[str] = Query(None, description="创建结束日期 YYYY-MM-DD"),
    current_user: User = Depends(get_current_user),
    tenant_id: int = Depends(get_current_tenant),
) -> Dict[str, Any]:
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
        keyword=keyword,
        order_by=order_by,
        inspection_start_date=inspection_start_date,
        inspection_end_date=inspection_end_date,
        created_start_date=created_start_date,
        created_end_date=created_end_date,
    )


@router.get("/finished-goods-inspections/{inspection_id}", response_model=FinishedGoodsInspectionResponse, summary="Get finished goods inspection")
async def get_finished_goods_inspection(
    inspection_id: int,
    current_user: User = Depends(get_current_user),
    tenant_id: int = Depends(get_current_tenant),
) -> FinishedGoodsInspectionResponse:
    """
    根据ID获取成品检验单详情

    - **inspection_id**: 检验单ID
    """
    await _assert_finished_goods_inspection_visible(
        tenant_id=tenant_id,
        current_user=current_user,
        inspection_id=inspection_id,
    )
    service = FinishedGoodsInspectionService()
    return await service.get_finished_goods_inspection_by_id(
        tenant_id=tenant_id,
        inspection_id=inspection_id
    )


@router.post("/finished-goods-inspections/{inspection_id}/approve", response_model=FinishedGoodsInspectionResponse, summary="Approve finished goods inspection")
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
    await _assert_finished_goods_inspection_visible(
        tenant_id=tenant_id,
        current_user=current_user,
        inspection_id=inspection_id,
    )
    return await FinishedGoodsInspectionService().approve_inspection(
        tenant_id=tenant_id,
        inspection_id=inspection_id,
        approved_by=current_user.id,
        rejection_reason=rejection_reason
    )


@router.post("/finished-goods-inspections/{inspection_id}/conduct", response_model=FinishedGoodsInspectionResponse, summary="Run finished goods inspection")
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
    await _assert_finished_goods_inspection_visible(
        tenant_id=tenant_id,
        current_user=current_user,
        inspection_id=inspection_id,
    )
    service = FinishedGoodsInspectionService()
    return await service.conduct_inspection(
        tenant_id=tenant_id,
        inspection_id=inspection_id,
        inspection_data=inspection_data,
        inspected_by=current_user.id
    )


@router.post("/finished-goods-inspections/{inspection_id}/certificate", response_model=FinishedGoodsInspectionResponse, summary="Issue release certificate")
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
    await _assert_finished_goods_inspection_visible(
        tenant_id=tenant_id,
        current_user=current_user,
        inspection_id=inspection_id,
    )
    return await FinishedGoodsInspectionService().issue_certificate(
        tenant_id=tenant_id,
        inspection_id=inspection_id,
        certificate_number=certificate_number,
        issued_by=current_user.id
    )


@router.get(
    "/finished-goods-inspections/{inspection_id}/print-certificate",
    summary="Print product quality certificate",
    dependencies=[Depends(require_permission_codes("kuaizhizao:quality-management-finished-goods-inspection:print"))],
)
async def print_product_quality_certificate(
    inspection_id: int = Path(..., description="成品检验单ID"),
    template_code: Optional[str] = Query(None),
    template_uuid: Optional[str] = Query(None),
    output_format: str = Query("html"),
    response_format: str = Query("json"),
    current_user: User = Depends(get_current_user),
    tenant_id: int = Depends(get_current_tenant),
):
    from apps.kuaizhizao.services.print_service import DocumentPrintService
    from infra.exceptions.exceptions import BusinessLogicError

    await _assert_finished_goods_inspection_visible(
        tenant_id=tenant_id,
        current_user=current_user,
        inspection_id=inspection_id,
    )
    try:
        result = await DocumentPrintService().print_document(
            tenant_id=tenant_id,
            document_type="product_quality_certificate",
            document_id=inspection_id,
            template_code=template_code,
            template_uuid=template_uuid,
            output_format=output_format,
        )
    except NotFoundError as e:
        raise FastAPIHTTPException(status_code=http_status.HTTP_404_NOT_FOUND, detail=str(e)) from e
    except BusinessLogicError as e:
        raise FastAPIHTTPException(status_code=http_status.HTTP_422_UNPROCESSABLE_ENTITY, detail=str(e)) from e

    if response_format == "html":
        return HTMLResponse(content=result.get("content", ""), status_code=200)
    return JSONResponse(content=result, status_code=200)


@router.get(
    "/finished-goods-inspections/{inspection_id}/print-certificate-variables",
    summary="Product quality certificate print variables",
    dependencies=[Depends(require_permission_codes("kuaizhizao:quality-management-finished-goods-inspection:print"))],
)
async def get_product_quality_certificate_variables(
    inspection_id: int = Path(..., description="成品检验单ID"),
    current_user: User = Depends(get_current_user),
    tenant_id: int = Depends(get_current_tenant),
):
    from apps.kuaizhizao.services.print_service import DocumentPrintService

    await _assert_finished_goods_inspection_visible(
        tenant_id=tenant_id,
        current_user=current_user,
        inspection_id=inspection_id,
    )
    try:
        variables = await DocumentPrintService().get_document_variables_for_print(
            tenant_id,
            "product_quality_certificate",
            inspection_id,
        )
        return {"success": True, "variables": variables}
    except NotFoundError as e:
        raise FastAPIHTTPException(status_code=http_status.HTTP_404_NOT_FOUND, detail=str(e)) from e
    except BusinessLogicError as e:
        raise FastAPIHTTPException(status_code=http_status.HTTP_422_UNPROCESSABLE_ENTITY, detail=str(e)) from e


@router.get(
    "/finished-goods-inspections/pull-candidates/work-orders",
    summary="List work order pull candidates for finished goods inspection",
)
async def list_finished_goods_inspection_work_order_pull_candidates(
    skip: int = Query(0, ge=0),
    limit: int = Query(20, ge=1, le=100),
    keyword: Optional[str] = Query(None),
    current_user: User = Depends(get_current_user),
    tenant_id: int = Depends(get_current_tenant),
) -> Dict[str, Any]:
    return await FinishedGoodsInspectionService().list_work_order_pull_candidates(
        tenant_id=tenant_id,
        skip=skip,
        limit=limit,
        keyword=keyword,
    )


@router.get(
    "/finished-goods-inspections/from-work-order/{work_order_id}/pull-preview",
    summary="Preview pull finished goods inspection from work order",
)
async def preview_pull_finished_goods_inspection_from_work_order(
    work_order_id: int = Path(..., description="工单ID"),
    current_user: User = Depends(get_current_user),
    tenant_id: int = Depends(get_current_tenant),
) -> Dict[str, Any]:
    await _assert_work_order_visible_by_id(
        tenant_id=tenant_id,
        current_user=current_user,
        work_order_id=work_order_id,
    )
    return await FinishedGoodsInspectionService().preview_pull_from_work_order(
        tenant_id=tenant_id,
        work_order_id=work_order_id,
    )


@router.post("/finished-goods-inspections/from-work-order", response_model=FinishedGoodsInspectionResponse, summary="Create finished goods inspection from work order")
async def create_finished_goods_inspection_from_work_order(
    work_order_id: int = Query(..., description="工单ID"),
    current_user: User = Depends(get_current_user),
    tenant_id: int = Depends(get_current_tenant),
) -> FinishedGoodsInspectionResponse:
    """
    从工单创建成品检验单

    - **work_order_id**: 工单ID
    """
    await _assert_work_order_visible_by_id(
        tenant_id=tenant_id,
        current_user=current_user,
        work_order_id=work_order_id,
    )
    return await FinishedGoodsInspectionService().create_inspection_from_work_order(
        tenant_id=tenant_id,
        work_order_id=work_order_id,
        created_by=current_user.id
    )


@router.get(
    "/finished-goods-inspections/{inspection_id}/push-to-rework/preview",
    summary="Preview push finished goods inspection to rework order",
)
async def preview_push_finished_goods_inspection_to_rework(
    inspection_id: int = Path(..., description="成品检验单ID"),
    current_user: User = Depends(get_current_user),
    tenant_id: int = Depends(get_current_tenant),
) -> Dict[str, Any]:
    """成品检验不合格下推返工单预览。"""
    await _assert_finished_goods_inspection_visible(
        tenant_id=tenant_id,
        current_user=current_user,
        inspection_id=inspection_id,
    )
    return await FinishedGoodsInspectionService().preview_push_to_rework(
        tenant_id=tenant_id,
        inspection_id=inspection_id,
    )


@router.post(
    "/finished-goods-inspections/{inspection_id}/push-to-rework",
    response_model=Dict[str, Any],
    summary="Push finished goods inspection to rework order",
)
async def push_finished_goods_inspection_to_rework(
    inspection_id: int = Path(..., description="成品检验单ID"),
    quantity: Optional[float] = Body(None, embed=True, description="本次下推返工数量，缺省为可下推全额"),
    current_user: User = Depends(get_current_user),
    tenant_id: int = Depends(get_current_tenant),
) -> Dict[str, Any]:
    """成品检验不合格下推返工单。"""
    await _assert_finished_goods_inspection_visible(
        tenant_id=tenant_id,
        current_user=current_user,
        inspection_id=inspection_id,
    )
    return await FinishedGoodsInspectionService().push_to_rework(
        tenant_id=tenant_id,
        inspection_id=inspection_id,
        created_by=current_user.id,
        quantity=quantity,
    )


@router.post("/finished-goods-inspections/import", summary="Batch import finished goods inspections")
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


@router.get("/finished-goods-inspections/export", response_class=FileResponse, summary="Export finished goods inspections")
async def export_finished_goods_inspections(
    status: Optional[str] = Query(None, description="检验状态"),
    quality_status: Optional[str] = Query(None, description="质量状态"),
    work_order_id: Optional[int] = Query(None, description="工单ID"),
    current_user: User = Depends(get_current_user),
    tenant_id: int = Depends(get_current_tenant),
):
    """导出成品检验单到Excel文件"""
    try:
        scoped_work_order_ids = await _scoped_work_order_ids(
            tenant_id=tenant_id,
            current_user=current_user,
        )
        file_path = await FinishedGoodsInspectionService().export_to_excel(
            tenant_id=tenant_id,
            status=status,
            quality_status=quality_status,
            work_order_id=work_order_id,
            scoped_work_order_ids=scoped_work_order_ids,
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


@router.post("/finished-goods-inspections/{inspection_id}/create-defect", response_model=DefectRecordResponse, summary="Create defect from FG inspection")
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
        await _assert_finished_goods_inspection_visible(
            tenant_id=tenant_id,
            current_user=current_user,
            inspection_id=inspection_id,
        )
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


# ============ 组织级质检环节总开关（IQC / IPQC / FQC / OQC）============


@router.get(
    "/quality-inspection-stage-toggles",
    response_model=QualityInspectionStageTogglesResponse,
    summary="Org QC stage master switch",
)
async def api_get_quality_inspection_stage_toggles(
    current_user: User = Depends(get_current_user),
    tenant_id: int = Depends(get_current_tenant),
) -> QualityInspectionStageTogglesResponse:
    """返回当前租户是否启用各质检环节；未配置时默认全部启用。"""
    data = await get_quality_inspection_stage_toggles(tenant_id)
    return QualityInspectionStageTogglesResponse.model_validate(data)


@router.put(
    "/quality-inspection-stage-toggles",
    response_model=QualityInspectionStageTogglesResponse,
    summary="Update org QC stage master switch",
)
async def api_put_quality_inspection_stage_toggles(
    body: QualityInspectionStageTogglesUpdate,
    current_user: User = Depends(get_current_user),
    tenant_id: int = Depends(get_current_tenant),
) -> QualityInspectionStageTogglesResponse:
    """部分更新：仅对请求体中出现的字段覆盖，其余保持原值。"""
    current = await get_quality_inspection_stage_toggles(tenant_id)
    for key in ("iqc_enabled", "ipqc_enabled", "fqc_enabled", "oqc_enabled"):
        v = getattr(body, key, None)
        if v is not None:
            current[key] = bool(v)
    saved = await set_quality_inspection_stage_toggles(
        tenant_id,
        current,
        description="API 更新质检环节开关",
    )
    return QualityInspectionStageTogglesResponse.model_validate(saved)


@router.get(
    "/quality-effective-config",
    response_model=QualityEffectiveConfigResponse,
    summary="Aggregated quality effective config",
)
async def api_get_quality_effective_config(
    current_user: User = Depends(get_current_user),
    tenant_id: int = Depends(get_current_tenant),
) -> QualityEffectiveConfigResponse:
    """返回环节开关、模块能力、自动建单与门禁的聚合配置。"""
    data = await get_quality_effective_config(tenant_id)
    return QualityEffectiveConfigResponse.model_validate(data)
