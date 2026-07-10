"""
生产执行 API 路由模块

提供工单管理和报工管理的API接口。
"""

from datetime import date, datetime
from typing import List, Optional, Dict, Any
from decimal import Decimal
import uuid
from fastapi import APIRouter, Depends, Query, status as http_status, Path, HTTPException, Body
from fastapi.responses import JSONResponse, FileResponse, HTMLResponse
from loguru import logger

from core.api.deps import get_current_user, get_current_tenant
from apps.kuaizhizao.api._kuaizhizao_route_access import require_kuaizhizao_module_access
from core.api.deps.access import require_permission_codes
from infra.models.user import User
from infra.exceptions.exceptions import ValidationError, BusinessLogicError, NotFoundError

from apps.kuaizhizao.services.work_order_service import WorkOrderService
from apps.kuaizhizao.services.rework_order_service import ReworkOrderService
from apps.kuaizhizao.services.demand_source_chain_service import DemandSourceChainService
from apps.kuaizhizao.services.outsource_service import OutsourceService
from apps.kuaizhizao.services.outsource_work_order_service import OutsourceWorkOrderService, OUTSOURCE_WORK_ORDER_SORTABLE_FIELDS
from apps.kuaizhizao.services.outsource_material_issue_service import OutsourceMaterialIssueService
from apps.kuaizhizao.services.outsource_material_return_service import OutsourceMaterialReturnService
from apps.kuaizhizao.services.outsource_product_return_service import OutsourceProductReturnService
from apps.kuaizhizao.services.outsource_collaboration_service import OutsourceCollaborationService
from apps.kuaizhizao.services.outsource_settlement_service import OutsourceSettlementService
from apps.kuaizhizao.services.supplier_collaboration_service import SupplierCollaborationService
from apps.kuaizhizao.services.customer_collaboration_service import CustomerCollaborationService
from apps.kuaizhizao.services.stocktaking_service import StocktakingService
from apps.kuaizhizao.services.inventory_transfer_service import InventoryTransferService
from apps.kuaizhizao.services.assembly_order_service import AssemblyOrderService
from apps.kuaizhizao.services.assembly_template_service import AssemblyTemplateService
from apps.kuaizhizao.services.disassembly_order_service import DisassemblyOrderService
from apps.kuaizhizao.services.exception_service import ExceptionService
from apps.kuaizhizao.services.exception_process_service import ExceptionProcessService
from apps.kuaizhizao.services.report_service import ReportService
from apps.kuaizhizao.services.defect_record_service import DefectRecordService

# 初始化服务实例
work_order_service = WorkOrderService()
outsource_work_order_service = OutsourceWorkOrderService()
outsource_material_issue_service = OutsourceMaterialIssueService()
outsource_material_return_service = OutsourceMaterialReturnService()
outsource_product_return_service = OutsourceProductReturnService()
defect_record_service = DefectRecordService()
stocktaking_service = StocktakingService()
inventory_transfer_service = InventoryTransferService()
assembly_order_service = AssemblyOrderService()
assembly_template_service = AssemblyTemplateService()
disassembly_order_service = DisassemblyOrderService()
exception_service = ExceptionService()
exception_process_service = ExceptionProcessService()
report_service = ReportService()
from apps.kuaizhizao.services.quality_service import (
    IncomingInspectionService,
    ProcessInspectionService,
    FinishedGoodsInspectionService,
)
from apps.kuaizhizao.services.quality_standard_service import QualityStandardService
from apps.kuaizhizao.services.inspection_plan_service import InspectionPlanService
# 财务服务已迁移至 kuaicaiwu，productions 中的财务端点已移除
from apps.kuaizhizao.services.sales_service import (
    SalesForecastService,
)
# BOM管理已移至master_data APP，不再需要BOMService
from apps.kuaizhizao.schemas.work_order import (
    WorkOrderCreate,
    WorkOrderUpdate,
    WorkOrderBatchUpdateDatesRequest,
    WorkOrderResponse,
    WorkOrderListResponse,
    MaterialShortageResponse,
    WorkOrderFreezeRequest,
    WorkOrderUnfreezeRequest,
    WorkOrderPriorityRequest,
    WorkOrderBatchPriorityRequest,
    WorkOrderMergeRequest,
    WorkOrderMergeResponse,
    WorkOrderSplitRequest,
    WorkOrderSplitResponse,
    WorkOrderOperationResponse,
    WorkOrderOperationsUpdateRequest,
    WorkOrderOperationDispatch,
)
from apps.kuaizhizao.schemas.rework_order import (
    ReworkOrderCreate,
    ReworkOrderUpdate,
    ReworkOrderResponse,
    ReworkOrderListResponse,
    ReworkOrderFromWorkOrderRequest,
)
from apps.kuaizhizao.schemas.outsource_work_order import (
    OutsourceWorkOrderCreate,
    OutsourceWorkOrderUpdate,
    OutsourceWorkOrderResponse,
    OutsourceWorkOrderListResponse,
    OutsourceMaterialIssueCreate,
    OutsourceMaterialIssueUpdate,
    OutsourceMaterialIssueResponse,
    OutsourceMaterialIssuePreviewResponse,
    OutsourceMaterialIssueBatchCreate,
    OutsourceMaterialIssueBatchResponse,
    OutsourceMaterialReturnCreate,
    OutsourceMaterialReturnResponse,
    OutsourceMaterialReturnPreviewResponse,
    OutsourceProductReturnCreate,
    OutsourceProductReturnResponse,
    OutsourceProductReturnPreviewResponse,
    # 委外协同
    OutsourceProgressUpdateRequest,
    OutsourceCompletionRequest,
    # 委外结算
    OutsourceCostCalculationResponse,
    CreateSettlementStatementRequest,
    SettlementStatementResponse,
    ReconciliationRequest,
    ReconciliationResponse,
)
from apps.kuaizhizao.schemas.collaboration import (
    PurchaseOrderProgressUpdateRequest,
    DeliveryNoticeRequest,
    SalesOrderProductionProgressResponse,
    CustomerOrderSummaryResponse,
)
from apps.kuaizhizao.schemas.outsource_order import (
    OutsourceOrderCreate,
    OutsourceOrderCreateFromWorkOrder,
    OutsourceOrderUpdate,
    OutsourceOrderResponse,
    OutsourceOrderListResponse
)
from apps.kuaizhizao.schemas.defect_record import (
    DefectRecordCreateFromInspection,
    DefectRecordResponse,
    DefectRecordListResponse
)
from apps.kuaizhizao.schemas.stocktaking import (
    StocktakingCreate,
    StocktakingUpdate,
    StocktakingResponse,
    StocktakingListResponse,
    StocktakingWithItemsResponse,
    StocktakingItemCreate,
    StocktakingItemUpdate,
    StocktakingItemResponse,
    StartStocktakingRequest,
    StocktakingItemBulkCreate,
)
from apps.kuaizhizao.schemas.inventory_transfer import (
    InventoryTransferCreate,
    InventoryTransferCreateWithItems,
    InventoryTransferUpdate,
    InventoryTransferResponse,
    InventoryTransferListResponse,
    InventoryTransferWithItemsResponse,
    InventoryTransferItemCreate,
    InventoryTransferItemUpdate,
    InventoryTransferItemResponse,
)
from apps.kuaizhizao.schemas.assembly_order import (
    AssemblyOrderCreate,
    AssemblyOrderUpdate,
    AssemblyOrderResponse,
    AssemblyOrderListResponse,
    AssemblyOrderWithItemsResponse,
    AssemblyOrderItemCreateInput,
    AssemblyOrderItemUpdate,
    AssemblyOrderItemResponse,
)
from apps.kuaizhizao.schemas.assembly_material_binding import ExecuteAssemblyOrderRequest
from apps.kuaizhizao.schemas.assembly_template import (
    AssemblyTemplateCreate,
    AssemblyTemplateUpdate,
    AssemblyTemplateResponse,
    AssemblyTemplateListResponse,
    AssemblyTemplateItemCreateInput,
    AssemblyTemplateItemUpdate,
    AssemblyTemplateItemResponse,
    AssemblyTemplateBomPreviewResponse,
    ApplyAssemblyTemplateRequest,
)
from apps.kuaizhizao.schemas.disassembly_order import (
    DisassemblyOrderCreate,
    DisassemblyOrderUpdate,
    DisassemblyOrderResponse,
    DisassemblyOrderListResponse,
    DisassemblyOrderWithItemsResponse,
    DisassemblyOrderItemCreateInput,
    DisassemblyOrderItemUpdate,
    DisassemblyOrderItemResponse,
)
# 仓库相关 schema 已迁移至 warehouse_execution.py
from apps.kuaizhizao.schemas.document_node_timing import (
    DocumentNodeTimingResponse,
)
from apps.kuaizhizao.schemas.material_shortage_exception import (
    MaterialShortageExceptionResponse,
    MaterialShortageExceptionListResponse,
    MaterialShortageExceptionUpdate,
)
from apps.kuaizhizao.schemas.delivery_delay_exception import (
    DeliveryDelayExceptionResponse,
    DeliveryDelayExceptionListResponse,
)
from apps.kuaizhizao.schemas.quality_exception import (
    QualityExceptionResponse,
    QualityExceptionListResponse,
)
from apps.kuaizhizao.schemas.exception_process_record import (
    ExceptionProcessRecordCreate,
    ExceptionProcessRecordUpdate,
    ExceptionProcessRecordResponse,
    ExceptionProcessRecordListResponse,
    ExceptionProcessRecordDetailResponse,
    ExceptionProcessStepTransitionRequest,
    ExceptionProcessAssignRequest,
    ExceptionProcessResolveRequest,
)
from apps.kuaizhizao.schemas.quality import (
    # 来料/过程/成品检验 schema 已迁移至 quality_execution.py
    # 质检标准
    QualityStandardCreate,
    QualityStandardUpdate,
    QualityStandardResponse,
    QualityStandardListResponse,
)
from apps.kuaizhizao.schemas.inspection_plan import (
    InspectionPlanCreate,
    InspectionPlanUpdate,
    InspectionPlanResponse,
    InspectionPlanListResponse,
    InspectionPlanListEnvelope,
)
from apps.kuaizhizao.services.inspection_plan_list_core import INSPECTION_PLAN_SORTABLE_FIELDS
# 财务 schema 已迁移至 kuaicaiwu，财务 API 由 /apps/kuaicaiwu 提供
from apps.kuaizhizao.schemas.sales import (
    # 销售预测
    SalesForecastCreate,
    SalesForecastUpdate,
    SalesForecastResponse,
    SalesForecastListResponse,
    SalesForecastListResult,
    SalesForecastItemCreate,
    SalesForecastItemUpdate,
    SalesForecastItemResponse,
    # 销售订单
    SalesOrderCreate,
    SalesOrderUpdate,
    SalesOrderResponse,
    SalesOrderListResponse,
    SalesOrderItemCreate,
    SalesOrderItemUpdate,
    SalesOrderItemResponse,
)
# BOM管理相关schema已移至master_data APP
# 只保留MaterialRequirement和MRPRequirement用于MRP计算
from apps.kuaizhizao.schemas.bom import (
    MaterialRequirement,
    MRPRequirement,
)
from .work_orders import router as work_orders_router
from .work_order_groups import router as work_order_groups_router
from .reporting import router as reporting_router
from .warehouse_execution import router as warehouse_execution_router
from .quality_execution import router as quality_execution_router
from .quality_improvement import router as quality_improvement_router
from ..station.station import router as station_router

def _scheduling_deep_link(work_order_id: int) -> str:
    return f"/apps/kuaizhizao/plan-management/scheduling?work_order_ids={work_order_id}"


def _attach_visual_scheduling_guidance(handled: Any, *, action: str, plan_adjust_actions: set):
    """计划类异常处理后引导至可视排产页手工调整，不再自动重排。"""
    work_order_id = handled.get("work_order_id") if isinstance(handled, dict) else getattr(handled, "work_order_id", None)
    if action not in plan_adjust_actions or not work_order_id:
        return handled
    link = _scheduling_deep_link(int(work_order_id))
    notice = "请在可视排产中手工调整计划日期"
    if isinstance(handled, dict):
        handled["scheduling_deep_link"] = link
        handled["scheduling_notice"] = notice
        return handled
    if hasattr(handled, "model_copy"):
        return handled.model_copy(update={"scheduling_deep_link": link, "scheduling_notice": notice})
    return handled


# 创建路由
# 注意：路由前缀为空，因为应用路由注册时会自动添加 /apps/kuaizhizao 前缀
router = APIRouter(
    tags=["App · Kuaige Zhizao · Production Execution"],
    dependencies=[Depends(require_kuaizhizao_module_access("production-execution-reporting", resolve_print=False))],
)
router.include_router(work_orders_router)
router.include_router(work_order_groups_router)
router.include_router(reporting_router)
router.include_router(warehouse_execution_router)
router.include_router(quality_execution_router)
router.include_router(quality_improvement_router)
router.include_router(station_router)


def _http_exception_with_trace(
    status_code: int,
    message: str,
    route: str,
    tenant_id: Optional[int] = None,
) -> HTTPException:
    trace_id = uuid.uuid4().hex
    logger.warning(
        "productions_api_error trace_id={} tenant_id={} route={} status_code={} message={}",
        trace_id,
        tenant_id,
        route,
        status_code,
        message,
    )
    return HTTPException(
        status_code=status_code,
        detail={"message": message, "trace_id": trace_id},
    )


# ============ 质量异常与质检标准 API ============
# 注：来料检验、过程检验、成品检验 API 已迁移至 quality_execution.py

@router.get("/quality/inspection-center-summary", summary="QC center dashboard summary")
async def get_inspection_center_summary(
    current_user: User = Depends(get_current_user),
    tenant_id: int = Depends(get_current_tenant),
) -> JSONResponse:
    data = await FinishedGoodsInspectionService().get_inspection_center_summary(tenant_id=tenant_id)
    return JSONResponse(content=data, status_code=http_status.HTTP_200_OK)


@router.get("/quality/anomalies", summary="List quality anomaly records")
async def get_quality_anomalies(
    inspection_type: Optional[str] = Query(None, description="检验类型（incoming/process/finished）"),
    start_date: Optional[datetime] = Query(None, description="开始日期"),
    end_date: Optional[datetime] = Query(None, description="结束日期"),
    material_id: Optional[int] = Query(None, description="物料ID"),
    supplier_id: Optional[int] = Query(None, description="供应商ID（仅用于来料检验）"),
    limit: int = Query(100, ge=1, le=500, description="返回条数上限"),
    current_user: User = Depends(get_current_user),
    tenant_id: int = Depends(get_current_tenant),
) -> JSONResponse:
    """
    查询质量异常记录（不合格的检验单）

    - **inspection_type**: 检验类型（可选：incoming/process/finished）
    - **start_date**: 开始日期（可选）
    - **end_date**: 结束日期（可选）
    - **material_id**: 物料ID（可选）
    - **supplier_id**: 供应商ID（可选，仅用于来料检验）
    """
    anomalies = await FinishedGoodsInspectionService().get_quality_anomalies(
        tenant_id=tenant_id,
        inspection_type=inspection_type,
        start_date=start_date,
        end_date=end_date,
        material_id=material_id,
        supplier_id=supplier_id,
        limit=limit,
    )
    return JSONResponse(
        content={
            "total": len(anomalies),
            "anomalies": anomalies
        },
        status_code=http_status.HTTP_200_OK
    )


# ============ 质检标准管理 API ============

@router.post("/quality-standards", response_model=QualityStandardResponse, summary="Create quality standard")
async def create_quality_standard(
    standard: QualityStandardCreate,
    current_user: User = Depends(get_current_user),
    tenant_id: int = Depends(get_current_tenant),
) -> QualityStandardResponse:
    """
    创建质检标准

    - **standard**: 质检标准创建数据
    - **current_user**: 当前用户
    - **tenant_id**: 当前组织ID

    返回创建的质检标准信息。
    """
    try:
        return await QualityStandardService().create_quality_standard(
            tenant_id=tenant_id,
            standard_data=standard,
            created_by=current_user.id
        )
    except ValidationError as e:
        raise _http_exception_with_trace(400, str(e), "/quality-standards", tenant_id)
    except NotFoundError as e:
        raise _http_exception_with_trace(404, str(e), "/quality-standards", tenant_id)


@router.get("/quality-standards", response_model=List[QualityStandardListResponse], summary="List quality standards")
async def list_quality_standards(
    skip: int = Query(0, ge=0, description="跳过数量"),
    limit: int = Query(100, ge=1, le=1000, description="限制数量"),
    standard_type: Optional[str] = Query(None, description="标准类型（incoming/process/finished）"),
    material_id: Optional[int] = Query(None, description="物料ID"),
    is_active: Optional[bool] = Query(None, description="是否启用"),
    standard_code: Optional[str] = Query(None, description="标准编码（模糊搜索）"),
    standard_name: Optional[str] = Query(None, description="标准名称（模糊搜索）"),
    current_user: User = Depends(get_current_user),
    tenant_id: int = Depends(get_current_tenant),
) -> List[QualityStandardListResponse]:
    """
    获取质检标准列表

    支持多种筛选条件的高级搜索。
    """
    try:
        return await QualityStandardService().list_quality_standards(
            tenant_id=tenant_id,
            skip=skip,
            limit=limit,
            standard_type=standard_type,
            material_id=material_id,
            is_active=is_active,
            standard_code=standard_code,
            standard_name=standard_name,
        )
    except Exception as e:
        logger.error(f"获取质检标准列表失败: {str(e)}")
        raise _http_exception_with_trace(500, f"获取列表失败: {str(e)}", "/quality-standards", tenant_id)


@router.get("/quality-standards/{standard_id}", response_model=QualityStandardResponse, summary="Get quality standard")
async def get_quality_standard(
    standard_id: int = Path(..., description="质检标准ID"),
    current_user: User = Depends(get_current_user),
    tenant_id: int = Depends(get_current_tenant),
) -> QualityStandardResponse:
    """
    根据ID获取质检标准详情

    - **standard_id**: 质检标准ID
    """
    try:
        return await QualityStandardService().get_quality_standard_by_id(
            tenant_id=tenant_id,
            standard_id=standard_id
        )
    except NotFoundError as e:
        raise _http_exception_with_trace(404, str(e), "/quality-standards/{standard_id}", tenant_id)


@router.put("/quality-standards/{standard_id}", response_model=QualityStandardResponse, summary="Update quality standard")
async def update_quality_standard(
    standard_id: int = Path(..., description="质检标准ID"),
    standard: QualityStandardUpdate = Body(..., description="质检标准更新数据"),
    current_user: User = Depends(get_current_user),
    tenant_id: int = Depends(get_current_tenant),
) -> QualityStandardResponse:
    """
    更新质检标准

    - **standard_id**: 质检标准ID
    - **standard**: 质检标准更新数据
    """
    try:
        return await QualityStandardService().update_quality_standard(
            tenant_id=tenant_id,
            standard_id=standard_id,
            standard_data=standard,
            updated_by=current_user.id
        )
    except NotFoundError as e:
        raise _http_exception_with_trace(404, str(e), "/quality-standards/{standard_id}", tenant_id)


@router.delete("/quality-standards/{standard_id}", summary="Delete quality standard")
async def delete_quality_standard(
    standard_id: int = Path(..., description="质检标准ID"),
    current_user: User = Depends(get_current_user),
    tenant_id: int = Depends(get_current_tenant),
) -> JSONResponse:
    """
    删除质检标准（软删除）

    - **standard_id**: 质检标准ID
    """
    try:
        await QualityStandardService().delete_quality_standard(
            tenant_id=tenant_id,
            standard_id=standard_id
        )
        return JSONResponse(
            content={"message": "质检标准删除成功"},
            status_code=http_status.HTTP_200_OK
        )
    except NotFoundError as e:
        raise _http_exception_with_trace(404, str(e), "/quality-standards/{standard_id}", tenant_id)


@router.get("/quality-standards/by-material/{material_id}", response_model=List[QualityStandardListResponse], summary="List quality standards by material")
async def get_standards_by_material(
    material_id: int = Path(..., description="物料ID"),
    standard_type: Optional[str] = Query(None, description="标准类型（incoming/process/finished）"),
    current_user: User = Depends(get_current_user),
    tenant_id: int = Depends(get_current_tenant),
) -> List[QualityStandardListResponse]:
    """
    根据物料ID获取适用的质检标准

    - **material_id**: 物料ID
    - **standard_type**: 标准类型（可选，用于过滤）

    返回适用于该物料的质检标准列表（包括物料特定的标准和通用标准）。
    """
    try:
        return await QualityStandardService().get_standards_by_material(
            tenant_id=tenant_id,
            material_id=material_id,
            standard_type=standard_type
        )
    except Exception as e:
        logger.error(f"根据物料ID获取质检标准失败: {str(e)}")
        raise _http_exception_with_trace(500, f"获取标准失败: {str(e)}", "/quality-standards/by-material/{material_id}", tenant_id)


# ============ 质检方案管理 API ============

@router.post("/inspection-plans", response_model=InspectionPlanResponse, summary="Create inspection plan")
async def create_inspection_plan(
    plan: InspectionPlanCreate,
    current_user: User = Depends(get_current_user),
    tenant_id: int = Depends(get_current_tenant),
) -> InspectionPlanResponse:
    """创建质检方案（含检验步骤）"""
    try:
        return await InspectionPlanService().create_inspection_plan(
            tenant_id=tenant_id,
            plan_data=plan,
            created_by=current_user.id,
        )
    except ValidationError as e:
        raise _http_exception_with_trace(400, str(e), "/inspection-plans", tenant_id)
    except NotFoundError as e:
        raise _http_exception_with_trace(404, str(e), "/inspection-plans", tenant_id)


@router.get("/inspection-plans", response_model=InspectionPlanListEnvelope, summary="List inspection plans")
async def list_inspection_plans(
    skip: int = Query(0, ge=0, description="跳过数量"),
    limit: int = Query(100, ge=1, le=1000, description="限制数量"),
    plan_type: Optional[str] = Query(None, description="方案类型（incoming/process/finished）"),
    material_id: Optional[int] = Query(None, description="物料ID"),
    operation_id: Optional[int] = Query(None, description="工序ID（过程检验时筛选）"),
    is_active: Optional[bool] = Query(None, description="是否启用"),
    plan_code: Optional[str] = Query(None, description="方案编码（模糊搜索）"),
    plan_name: Optional[str] = Query(None, description="方案名称（模糊搜索）"),
    keyword: Optional[str] = Query(None, description="模糊搜索（编码、名称）"),
    created_start_date: Optional[str] = Query(None, description="创建开始日期 YYYY-MM-DD"),
    created_end_date: Optional[str] = Query(None, description="创建结束日期 YYYY-MM-DD"),
    updated_start_date: Optional[str] = Query(None, description="更新开始日期 YYYY-MM-DD"),
    updated_end_date: Optional[str] = Query(None, description="更新结束日期 YYYY-MM-DD"),
    order_by: Optional[str] = Query(None, description="排序字段（前缀-表示降序）"),
    include_steps: bool = Query(False, description="是否包含检验步骤"),
    current_user: User = Depends(get_current_user),
    tenant_id: int = Depends(get_current_tenant),
) -> InspectionPlanListEnvelope:
    """获取质检方案列表"""
    safe_order_by = None
    if order_by:
        field = order_by.lstrip("-")
        if field in INSPECTION_PLAN_SORTABLE_FIELDS:
            safe_order_by = order_by
    try:
        return await InspectionPlanService().list_inspection_plans(
            tenant_id=tenant_id,
            skip=skip,
            limit=limit,
            plan_type=plan_type,
            material_id=material_id,
            operation_id=operation_id,
            is_active=is_active,
            plan_code=plan_code,
            plan_name=plan_name,
            keyword=keyword,
            created_start_date=created_start_date,
            created_end_date=created_end_date,
            updated_start_date=updated_start_date,
            updated_end_date=updated_end_date,
            order_by=safe_order_by,
            include_steps=include_steps,
        )
    except Exception as e:
        logger.error(f"获取质检方案列表失败: {str(e)}")
        raise _http_exception_with_trace(500, f"获取列表失败: {str(e)}", "/inspection-plans", tenant_id)


@router.get("/inspection-plans/{plan_id}", response_model=InspectionPlanResponse, summary="Get inspection plan")
async def get_inspection_plan(
    plan_id: int = Path(..., description="质检方案ID"),
    current_user: User = Depends(get_current_user),
    tenant_id: int = Depends(get_current_tenant),
) -> InspectionPlanResponse:
    """根据ID获取质检方案详情（含检验步骤）"""
    try:
        return await InspectionPlanService().get_inspection_plan_by_id(
            tenant_id=tenant_id,
            plan_id=plan_id,
        )
    except NotFoundError as e:
        raise _http_exception_with_trace(404, str(e), "/inspection-plans/{plan_id}", tenant_id)


@router.put("/inspection-plans/{plan_id}", response_model=InspectionPlanResponse, summary="Update inspection plan")
async def update_inspection_plan(
    plan_id: int = Path(..., description="质检方案ID"),
    plan: InspectionPlanUpdate = Body(..., description="质检方案更新数据"),
    current_user: User = Depends(get_current_user),
    tenant_id: int = Depends(get_current_tenant),
) -> InspectionPlanResponse:
    """更新质检方案（含步骤替换）"""
    try:
        return await InspectionPlanService().update_inspection_plan(
            tenant_id=tenant_id,
            plan_id=plan_id,
            plan_data=plan,
            updated_by=current_user.id,
        )
    except NotFoundError as e:
        raise _http_exception_with_trace(404, str(e), "/inspection-plans/{plan_id}", tenant_id)
    except ValidationError as e:
        raise _http_exception_with_trace(400, str(e), "/inspection-plans/{plan_id}", tenant_id)


@router.delete("/inspection-plans/{plan_id}", summary="Delete inspection plan")
async def delete_inspection_plan(
    plan_id: int = Path(..., description="质检方案ID"),
    current_user: User = Depends(get_current_user),
    tenant_id: int = Depends(get_current_tenant),
) -> JSONResponse:
    """删除质检方案（软删除）"""
    try:
        await InspectionPlanService().delete_inspection_plan(
            tenant_id=tenant_id,
            plan_id=plan_id,
        )
        return JSONResponse(
            content={"message": "质检方案删除成功"},
            status_code=http_status.HTTP_200_OK,
        )
    except NotFoundError as e:
        raise _http_exception_with_trace(404, str(e), "/inspection-plans/{plan_id}", tenant_id)


@router.get("/inspection-plans/by-material/{material_id}", response_model=List[InspectionPlanListResponse], summary="List inspection plans by material")
async def get_inspection_plans_by_material(
    material_id: int = Path(..., description="物料ID"),
    plan_type: Optional[str] = Query(None, description="方案类型（incoming/process/finished）"),
    current_user: User = Depends(get_current_user),
    tenant_id: int = Depends(get_current_tenant),
) -> List[InspectionPlanListResponse]:
    """根据物料ID获取适用的质检方案"""
    try:
        return await InspectionPlanService().get_plans_by_material(
            tenant_id=tenant_id,
            material_id=material_id,
            plan_type=plan_type,
        )
    except Exception as e:
        logger.error(f"根据物料ID获取质检方案失败: {str(e)}")
        raise _http_exception_with_trace(500, f"获取方案失败: {str(e)}", "/inspection-plans/by-material/{material_id}", tenant_id)


@router.get("/quality/statistics", summary="Quality analytics")
async def get_quality_statistics(
    inspection_type: Optional[str] = Query(None, description="检验类型（incoming/process/finished）"),
    start_date: Optional[datetime] = Query(None, description="开始日期"),
    end_date: Optional[datetime] = Query(None, description="结束日期"),
    material_id: Optional[int] = Query(None, description="物料ID"),
    supplier_id: Optional[int] = Query(None, description="供应商ID（仅用于来料检验）"),
    current_user: User = Depends(get_current_user),
    tenant_id: int = Depends(get_current_tenant),
) -> JSONResponse:
    """
    获取质量统计分析

    统计检验数量、合格率、不合格率等质量指标。

    - **inspection_type**: 检验类型（可选：incoming/process/finished）
    - **start_date**: 开始日期（可选）
    - **end_date**: 结束日期（可选）
    - **material_id**: 物料ID（可选）
    - **supplier_id**: 供应商ID（可选，仅用于来料检验）
    """
    stats = await FinishedGoodsInspectionService().get_quality_statistics(
        tenant_id=tenant_id,
        inspection_type=inspection_type,
        start_date=start_date,
        end_date=end_date,
        material_id=material_id,
        supplier_id=supplier_id
    )
    return JSONResponse(
        content=stats,
        status_code=http_status.HTTP_200_OK
    )


# ============ BOM物料清单管理 API ============
# 注意：BOM管理已移至master_data APP
# 如需管理BOM，请使用master_data APP的API：/api/apps/master-data/materials/bom
# 本APP只提供基于BOM的业务功能（如物料需求计算）


# ============ 单据打印 API（工单快捷打印等） ============

from apps.kuaizhizao.services.print_service import DocumentPrintService
from fastapi.responses import HTMLResponse

@router.get(
    "/work-orders/{id}/print",
    summary="Print work order",
    dependencies=[Depends(require_permission_codes("kuaizhizao:work-order:print"))],
)
async def print_work_order(
    id: int = Path(..., description="工单ID"),
    template_code: Optional[str] = Query(None, description="打印模板代码"),
    template_uuid: Optional[str] = Query(None, description="打印模板UUID（可选，优先于 template_code）"),
    output_format: str = Query("html", description="输出格式"),
    response_format: str = Query("json", description="响应格式：json 或 html"),
    current_user: User = Depends(get_current_user),
    tenant_id: int = Depends(get_current_tenant),
):
    """打印工单"""
    result = await DocumentPrintService().print_document(
        tenant_id=tenant_id,
        document_type="work_order",
        document_id=id,
        template_code=template_code,
        template_uuid=template_uuid,
        output_format=output_format
    )
    if response_format == "html":
        return HTMLResponse(content=result.get("content", ""), status_code=200)
    from fastapi.responses import JSONResponse
    return JSONResponse(content=result, status_code=200)


@router.get(
    "/work-orders/{id}/print-variables",
    summary="Work order print variables",
    dependencies=[Depends(require_permission_codes("kuaizhizao:work-order:print"))],
)
async def get_work_order_print_variables(
    id: int = Path(..., description="工单ID"),
    current_user: User = Depends(get_current_user),
    tenant_id: int = Depends(get_current_tenant),
):
    """与 `_format_work_order_data` 一致。"""
    try:
        variables = await DocumentPrintService().get_document_variables_for_print(
            tenant_id, "work_order", id
        )
        return {"success": True, "variables": variables}
    except NotFoundError as e:
        raise HTTPException(status_code=http_status.HTTP_404_NOT_FOUND, detail=str(e))


# ============ 批量操作 API ============
# (批量操作路由在文件后续部分定义)


# ============ 销售预测管理 API ============

@router.post("/sales-forecasts", response_model=SalesForecastResponse, summary="Create sales forecast")
async def create_sales_forecast(
    forecast: SalesForecastCreate,
    current_user: User = Depends(get_current_user),
    tenant_id: int = Depends(get_current_tenant),
) -> SalesForecastResponse:
    """
    创建销售预测

    - **forecast**: 销售预测创建数据
    - **current_user**: 当前用户
    - **tenant_id**: 当前组织ID

    返回创建的销售预测信息。
    """
    service = SalesForecastService()
    return await service.create_sales_forecast(
        tenant_id=tenant_id,
        forecast_data=forecast,
        created_by=current_user.id
    )


@router.get("/sales-forecasts", response_model=SalesForecastListResult, summary="List sales forecasts")
async def list_sales_forecasts(
    skip: int = Query(0, ge=0, description="跳过数量"),
    limit: int = Query(100, ge=1, le=1000, description="限制数量"),
    status: Optional[str] = Query(None, description="预测状态"),
    forecast_period: Optional[str] = Query(None, description="预测周期"),
    start_date: Optional[date] = Query(None, description="开始日期"),
    end_date: Optional[date] = Query(None, description="结束日期"),
    keyword: Optional[str] = Query(None, description="关键词（编号、名称）"),
    forecast_code: Optional[str] = Query(None, description="预测编号（模糊）"),
    forecast_name: Optional[str] = Query(None, description="预测名称（模糊）"),
    order_by: Optional[str] = Query(None, description="排序字段，如 start_date、-updated_at（前缀-表示降序）"),
    include_items: bool = Query(False, description="是否包含明细"),
    current_user: User = Depends(get_current_user),
    tenant_id: int = Depends(get_current_tenant),
) -> SalesForecastListResult:
    """
    获取销售预测列表

    支持多种筛选条件的高级搜索。
    返回格式：{ data: [...], total: number, success: true }
    """
    from apps.kuaizhizao.services.sales_service import SalesForecastService, SALES_FORECAST_SORTABLE_FIELDS

    safe_order_by = None
    if order_by:
        field = order_by.lstrip("-")
        if field in SALES_FORECAST_SORTABLE_FIELDS:
            safe_order_by = order_by
    service = SalesForecastService()
    result = await service.list_sales_forecasts(
        tenant_id=tenant_id,
        skip=skip,
        limit=limit,
        status=status,
        forecast_period=forecast_period,
        start_date=start_date,
        end_date=end_date,
        keyword=keyword,
        forecast_code=forecast_code,
        forecast_name=forecast_name,
        order_by=safe_order_by,
        include_items=include_items,
    )
    return SalesForecastListResult(**result)
    

@router.get("/sales-forecasts/statistics", summary="Sales forecast analytics")
async def get_sales_forecast_statistics(
    current_user: User = Depends(get_current_user),
    tenant_id: int = Depends(get_current_tenant),
) -> JSONResponse:
    """获取销售预测统计分析"""
    from apps.kuaizhizao.services.sales_service import SalesForecastService
    stats = await SalesForecastService().get_forecast_statistics(tenant_id)
    return JSONResponse(
        content=stats,
        status_code=http_status.HTTP_200_OK
    )
    

@router.get("/sales-forecasts/{forecast_id}", response_model=SalesForecastResponse, summary="Get sales forecast")
async def get_sales_forecast(
    forecast_id: int,
    current_user: User = Depends(get_current_user),
    tenant_id: int = Depends(get_current_tenant),
) -> SalesForecastResponse:
    """
    根据ID获取销售预测详情

    - **forecast_id**: 销售预测ID
    """
    service = SalesForecastService()
    return await service.get_sales_forecast_by_id(
        tenant_id=tenant_id,
        forecast_id=forecast_id
    )


@router.get(
    "/sales-forecasts/{forecast_id}/print",
    summary="Print sales forecast",
    dependencies=[Depends(require_permission_codes("kuaizhizao:sales-forecast:print"))],
)
async def print_sales_forecast(
    forecast_id: int = Path(..., description="销售预测ID"),
    template_code: Optional[str] = Query(None),
    template_uuid: Optional[str] = Query(None),
    output_format: str = Query("html"),
    response_format: str = Query("json"),
    current_user: User = Depends(get_current_user),
    tenant_id: int = Depends(get_current_tenant),
):
    from apps.kuaizhizao.services.print_service import DocumentPrintService
    from infra.exceptions.exceptions import NotFoundError, ValidationError

    try:
        result = await DocumentPrintService().print_document(
            tenant_id=tenant_id,
            document_type="sales_forecast",
            document_id=forecast_id,
            template_code=template_code,
            template_uuid=template_uuid,
            output_format=output_format,
        )
    except NotFoundError as e:
        raise HTTPException(status_code=http_status.HTTP_404_NOT_FOUND, detail=str(e)) from e
    except ValidationError as e:
        raise HTTPException(status_code=http_status.HTTP_400_BAD_REQUEST, detail=str(e)) from e
    if response_format == "html":
        return HTMLResponse(content=result.get("content", ""), status_code=200)
    return JSONResponse(content=result, status_code=200)


@router.get("/sales-forecasts/{forecast_id}/push-to-computation/preview", summary="Preview push to demand computation")
async def preview_push_sales_forecast_to_computation(
    forecast_id: int = Path(..., description="销售预测ID"),
    current_user: User = Depends(get_current_user),
    tenant_id: int = Depends(get_current_tenant),
):
    """下推需求计算预览：返回预测明细数量、已下推、可下推，不实际创建。"""
    from apps.kuaizhizao.services.sales_service import SalesForecastService
    from infra.exceptions.exceptions import NotFoundError, BusinessLogicError

    try:
        return await SalesForecastService().preview_push_to_computation(
            tenant_id=tenant_id,
            forecast_id=forecast_id,
        )
    except NotFoundError as e:
        raise HTTPException(status_code=http_status.HTTP_404_NOT_FOUND, detail=str(e)) from e
    except BusinessLogicError as e:
        raise HTTPException(status_code=http_status.HTTP_400_BAD_REQUEST, detail=str(e)) from e


@router.post("/sales-forecasts/{forecast_id}/push-to-computation", summary="Push to demand computation")
async def push_sales_forecast_to_computation(
    forecast_id: int = Path(..., description="销售预测ID"),
    planning_horizon: int = Query(12, ge=1, le=24, description="计划周期（月数）"),
    time_bucket: str = Query("week", description="时间粒度（week/month）"),
    current_user: User = Depends(get_current_user),
    tenant_id: int = Depends(get_current_tenant),
):
    """
    从销售预测下推到需求计算
    
    - **forecast_id**: 销售预测ID
    - **planning_horizon**: 计划周期（月数，默认12个月）
    - **time_bucket**: 时间粒度（week/month，默认week）
    """
    from apps.kuaizhizao.services.sales_service import SalesForecastService
    
    service = SalesForecastService()
    result = await service.push_to_computation(
        tenant_id=tenant_id,
        forecast_id=forecast_id,
        planning_horizon=planning_horizon,
        time_bucket=time_bucket,
        user_id=current_user.id
    )
    return JSONResponse(content=result, status_code=http_status.HTTP_200_OK)


@router.post("/sales-forecasts/{forecast_id}/push-to-mrp", summary="Push to MRP run (legacy)")
async def push_sales_forecast_to_mrp_legacy(
    forecast_id: int = Path(..., description="销售预测ID"),
    planning_horizon: int = Query(12, ge=1, le=24, description="计划周期（月数）"),
    time_bucket: str = Query("week", description="时间粒度（week/month）"),
    current_user: User = Depends(get_current_user),
    tenant_id: int = Depends(get_current_tenant),
):
    from loguru import logger as _logger
    _logger.warning("Deprecated API called: /sales-forecasts/%s/push-to-mrp", forecast_id)
    return await push_sales_forecast_to_computation(
        forecast_id=forecast_id,
        planning_horizon=planning_horizon,
        time_bucket=time_bucket,
        current_user=current_user,
        tenant_id=tenant_id,
    )


@router.put("/sales-forecasts/{forecast_id}", response_model=SalesForecastResponse, summary="Update sales forecast")
async def update_sales_forecast(
    forecast_id: int,
    forecast: SalesForecastUpdate,
    current_user: User = Depends(get_current_user),
    tenant_id: int = Depends(get_current_tenant),
) -> SalesForecastResponse:
    """
    更新销售预测

    - **forecast_id**: 销售预测ID
    - **forecast**: 销售预测更新数据
    - **current_user**: 当前用户
    - **tenant_id**: 当前组织ID

    返回更新后的销售预测信息。
    """
    service = SalesForecastService()
    return await service.update_sales_forecast(
        tenant_id=tenant_id,
        forecast_id=forecast_id,
        forecast_data=forecast,
        updated_by=current_user.id
    )


@router.delete("/sales-forecasts/{forecast_id}", summary="Delete sales forecast")
async def delete_sales_forecast(
    forecast_id: int,
    current_user: User = Depends(get_current_user),
    tenant_id: int = Depends(get_current_tenant),
) -> JSONResponse:
    """
    删除销售预测

    - **forecast_id**: 销售预测ID
    - **current_user**: 当前用户
    - **tenant_id**: 当前组织ID

    返回删除结果。
    """
    service = SalesForecastService()
    await service.delete_sales_forecast(tenant_id, forecast_id)
    return JSONResponse(content={"message": "销售预测删除成功"}, status_code=http_status.HTTP_200_OK)


@router.post("/sales-forecasts/{forecast_id}/submit", response_model=SalesForecastResponse, summary="Submit sales forecast")
async def submit_sales_forecast(
    forecast_id: int,
    current_user: User = Depends(get_current_user),
    tenant_id: int = Depends(get_current_tenant),
) -> SalesForecastResponse:
    """
    提交销售预测

    将草稿状态的销售预测提交为待审核状态

    - **forecast_id**: 销售预测ID
    """
    service = SalesForecastService()
    return await service.submit_forecast(
        tenant_id=tenant_id,
        forecast_id=forecast_id,
        submitted_by=current_user.id
    )


@router.post("/sales-forecasts/{forecast_id}/approve", response_model=SalesForecastResponse, summary="Approve sales forecast")
async def approve_sales_forecast(
    forecast_id: int,
    rejection_reason: Optional[str] = Query(None, description="驳回原因"),
    current_user: User = Depends(get_current_user),
    tenant_id: int = Depends(get_current_tenant),
) -> SalesForecastResponse:
    """
    审核销售预测

    - **forecast_id**: 销售预测ID
    - **rejection_reason**: 驳回原因（可选，不填则通过）
    """
    service = SalesForecastService()
    return await service.approve_forecast(
        tenant_id=tenant_id,
        forecast_id=forecast_id,
        approved_by=current_user.id,
        rejection_reason=rejection_reason
    )


@router.post("/sales-forecasts/{forecast_id}/withdraw-approval", response_model=SalesForecastResponse, summary="Withdraw sales forecast approval")
async def withdraw_sales_forecast_approval(
    forecast_id: int,
    current_user: User = Depends(get_current_user),
    tenant_id: int = Depends(get_current_tenant),
) -> SalesForecastResponse:
    """
    撤回销售预测审核（已审核 -> 待审核）。

    - **forecast_id**: 销售预测ID
    """
    service = SalesForecastService()
    return await service.withdraw_forecast_approval(
        tenant_id=tenant_id,
        forecast_id=forecast_id,
        withdrawn_by=current_user.id,
    )


@router.post("/sales-forecasts/{forecast_id}/items", response_model=SalesForecastItemResponse, summary="Add forecast line")
async def add_sales_forecast_item(
    forecast_id: int,
    item: SalesForecastItemCreate,
    current_user: User = Depends(get_current_user),
    tenant_id: int = Depends(get_current_tenant),
) -> SalesForecastItemResponse:
    """
    添加销售预测明细

    - **forecast_id**: 销售预测ID
    - **item**: 预测明细数据
    """
    service = SalesForecastService()
    return await service.add_forecast_item(
        tenant_id=tenant_id,
        forecast_id=forecast_id,
        item_data=item
    )


@router.get("/sales-forecasts/{forecast_id}/items", response_model=List[SalesForecastItemResponse], summary="List sales forecast lines")
async def get_sales_forecast_items(
    forecast_id: int,
    current_user: User = Depends(get_current_user),
    tenant_id: int = Depends(get_current_tenant),
) -> List[SalesForecastItemResponse]:
    """
    获取销售预测明细列表

    - **forecast_id**: 销售预测ID
    """
    service = SalesForecastService()
    return await service.get_forecast_items(
        tenant_id=tenant_id,
        forecast_id=forecast_id
    )





# ============ BOM物料清单管理 API ============
# 注意：BOM管理已移至master_data APP
# 如需管理BOM，请使用master_data APP的API：/api/apps/master-data/materials/bom
# 本APP只提供基于BOM的业务功能（如物料需求计算）
# 单据关联、打印、耗时 API 已迁移至 document_relations_legacy.py


from apps.kuaizhizao.services.print_service import DocumentPrintService
from fastapi.responses import HTMLResponse

@router.get(
    "/production-pickings/{id}/print",
    summary="Print production picking",
    dependencies=[Depends(require_permission_codes("kuaizhizao:inbound:print"))],
)
async def print_production_picking(
    id: int = Path(..., description="生产领料单ID"),
    template_code: Optional[str] = Query(None, description="打印模板代码"),
    template_uuid: Optional[str] = Query(None, description="打印模板UUID"),
    output_format: str = Query("html", description="输出格式"),
    response_format: str = Query("json", description="响应格式"),
    current_user: User = Depends(get_current_user),
    tenant_id: int = Depends(get_current_tenant),
):
    """打印生产领料单"""
    result = await DocumentPrintService().print_document(
        tenant_id=tenant_id,
        document_type="production_picking",
        document_id=id,
        template_code=template_code,
        template_uuid=template_uuid,
        output_format=output_format
    )
    if response_format == "html":
        return HTMLResponse(content=result.get("content", ""), status_code=200)
    from fastapi.responses import JSONResponse
    return JSONResponse(content=result, status_code=200)


@router.get(
    "/semi-finished-goods-receipts/{id}/print",
    summary="Print semi-finished receipt",
    dependencies=[Depends(require_permission_codes("kuaizhizao:inbound:print"))],
)
async def print_semi_finished_goods_receipt(
    id: int = Path(..., description="半成品入库单ID"),
    template_code: Optional[str] = Query(None, description="打印模板代码"),
    template_uuid: Optional[str] = Query(None, description="打印模板UUID"),
    output_format: str = Query("html", description="输出格式"),
    response_format: str = Query("json", description="响应格式"),
    current_user: User = Depends(get_current_user),
    tenant_id: int = Depends(get_current_tenant),
):
    """打印半成品入库单（默认可共用成品入库打印模板）"""
    result = await DocumentPrintService().print_document(
        tenant_id=tenant_id,
        document_type="semi_finished_goods_receipt",
        document_id=id,
        template_code=template_code,
        template_uuid=template_uuid,
        output_format=output_format
    )
    if response_format == "html":
        return HTMLResponse(content=result.get("content", ""), status_code=200)
    from fastapi.responses import JSONResponse
    return JSONResponse(content=result, status_code=200)


@router.get(
    "/finished-goods-receipts/{id}/print",
    summary="Print finished goods receipt",
    dependencies=[Depends(require_permission_codes("kuaizhizao:inbound:print"))],
)
async def print_finished_goods_receipt(
    id: int = Path(..., description="成品入库单ID"),
    template_code: Optional[str] = Query(None, description="打印模板代码"),
    template_uuid: Optional[str] = Query(None, description="打印模板UUID"),
    output_format: str = Query("html", description="输出格式"),
    response_format: str = Query("json", description="响应格式"),
    current_user: User = Depends(get_current_user),
    tenant_id: int = Depends(get_current_tenant),
):
    """打印成品入库单"""
    result = await DocumentPrintService().print_document(
        tenant_id=tenant_id,
        document_type="finished_goods_receipt",
        document_id=id,
        template_code=template_code,
        template_uuid=template_uuid,
        output_format=output_format
    )
    if response_format == "html":
        return HTMLResponse(content=result.get("content", ""), status_code=200)
    from fastapi.responses import JSONResponse
    return JSONResponse(content=result, status_code=200)


# ============ 批量操作 API ============

from apps.kuaizhizao.services.batch_service import BatchOperationService
from apps.kuaizhizao.schemas.batch import (
    BatchCreateRequest,
    BatchUpdateRequest,
    BatchDeleteRequest,
    BatchResponse,
)
from apps.kuaizhizao.models.work_order import WorkOrder
from apps.kuaizhizao.models.sales_forecast import SalesForecast
from apps.kuaizhizao.models.sales_order import SalesOrder
# 批量操作相关的schema导入在函数内部进行，避免循环导入

@router.post("/work-orders/batch-create", response_model=BatchResponse, summary="Batch create work orders")
async def batch_create_work_orders(
    request: BatchCreateRequest,
    current_user: User = Depends(get_current_user),
    tenant_id: int = Depends(get_current_tenant),
) -> BatchResponse:
    """
    批量创建工单

    - **items**: 工单创建数据列表（最多100条）
    """
    from apps.kuaizhizao.services.work_order_service import WorkOrderService
    
    # 验证数据格式
    validated_items = []
    for item in request.items:
        try:
            validated_item = WorkOrderCreate(**item).model_dump()
            validated_items.append(validated_item)
        except Exception as e:
            logger.error(f"工单数据验证失败: {e}")
            # 跳过无效数据，会在批量操作结果中标记为失败
    
    result = await BatchOperationService().batch_create(
        tenant_id=tenant_id,
        model_class=WorkOrder,
        create_data_list=validated_items,
        created_by=current_user.id
    )
    
    return BatchResponse(
        success=result["failed_count"] == 0,
        message=f"成功创建 {result['success_count']} 个工单，失败 {result['failed_count']} 个",
        data=result
    )


@router.put("/work-orders/batch-update", response_model=BatchResponse, summary="Batch update work orders")
async def batch_update_work_orders(
    request: BatchUpdateRequest,
    current_user: User = Depends(get_current_user),
    tenant_id: int = Depends(get_current_tenant),
) -> BatchResponse:
    """
    批量更新工单

    - **items**: 工单更新数据列表（必须包含id字段，最多100条）
    """
    from apps.kuaizhizao.schemas.work_order import WorkOrderUpdate
    
    # 验证数据格式
    validated_items = []
    for item in request.items:
        try:
            # 提取ID
            item_id = item.get("id")
            if not item_id:
                continue
            
            # 验证更新数据
            validated_item = WorkOrderUpdate(**{k: v for k, v in item.items() if k != "id"}).model_dump(exclude_unset=True)
            validated_item["id"] = item_id
            validated_items.append(validated_item)
        except Exception as e:
            logger.error(f"工单更新数据验证失败: {e}")
    
    result = await BatchOperationService().batch_update(
        tenant_id=tenant_id,
        model_class=WorkOrder,
        update_data_list=validated_items,
        updated_by=current_user.id
    )
    
    return BatchResponse(
        success=result["failed_count"] == 0,
        message=f"成功更新 {result['success_count']} 个工单，失败 {result['failed_count']} 个",
        data=result
    )


@router.delete("/work-orders/batch-delete", response_model=BatchResponse, summary="Batch delete work orders")
async def batch_delete_work_orders(
    request: BatchDeleteRequest,
    current_user: User = Depends(get_current_user),
    tenant_id: int = Depends(get_current_tenant),
) -> BatchResponse:
    """
    批量删除工单

    - **ids**: 要删除的工单ID列表（最多100条）
    
    注意：只能删除草稿状态的工单
    """
    def validate_work_order(work_order):
        """验证工单是否可以删除"""
        if work_order.status != "草稿":
            raise BusinessLogicError(f"工单 {work_order.id} 状态为 {work_order.status}，无法删除。只有草稿状态的工单才能删除。")
    
    result = await BatchOperationService().batch_delete(
        tenant_id=tenant_id,
        model_class=WorkOrder,
        record_ids=request.ids,
        validate_func=validate_work_order
    )
    
    return BatchResponse(
        success=result["failed_count"] == 0,
        message=f"成功删除 {result['success_count']} 个工单，失败 {result['failed_count']} 个",
        data=result
    )


@router.post("/sales-forecasts/batch-create", response_model=BatchResponse, summary="Batch create sales forecasts")
async def batch_create_sales_forecasts(
    request: BatchCreateRequest,
    current_user: User = Depends(get_current_user),
    tenant_id: int = Depends(get_current_tenant),
) -> BatchResponse:
    """
    批量创建销售预测

    - **items**: 销售预测创建数据列表（最多100条）
    """
    from apps.kuaizhizao.schemas.sales import SalesForecastCreate
    
    # 验证数据格式
    validated_items = []
    for item in request.items:
        try:
            validated_item = SalesForecastCreate(**item).model_dump()
            validated_items.append(validated_item)
        except Exception as e:
            logger.error(f"销售预测数据验证失败: {e}")
    
    result = await BatchOperationService().batch_create(
        tenant_id=tenant_id,
        model_class=SalesForecast,
        create_data_list=validated_items,
        created_by=current_user.id
    )
    
    return BatchResponse(
        success=result["failed_count"] == 0,
        message=f"成功创建 {result['success_count']} 个销售预测，失败 {result['failed_count']} 个",
        data=result
    )


@router.delete("/sales-forecasts/batch-delete", response_model=BatchResponse, summary="Batch delete sales forecasts")
async def batch_delete_sales_forecasts(
    request: BatchDeleteRequest,
    current_user: User = Depends(get_current_user),
    tenant_id: int = Depends(get_current_tenant),
) -> BatchResponse:
    """
    批量删除销售预测

    - **ids**: 要删除的销售预测ID列表（最多100条）
    
    注意：只能删除草稿状态的销售预测
    """
    def validate_sales_forecast(forecast):
        """验证销售预测是否可以删除"""
        from apps.kuaizhizao.services.document_action_policy.sales_forecast import assert_sales_forecast_capability

        assert_sales_forecast_capability(forecast, "delete")
    
    result = await BatchOperationService().batch_delete(
        tenant_id=tenant_id,
        model_class=SalesForecast,
        record_ids=request.ids,
        validate_func=validate_sales_forecast
    )
    
    return BatchResponse(
        success=result["failed_count"] == 0,
        message=f"成功删除 {result['success_count']} 个销售预测，失败 {result['failed_count']} 个",
        data=result
    )


@router.post("/sales-forecasts/import", summary="Batch import sales forecasts")
async def import_sales_forecasts(
    request: Dict[str, Any],
    current_user: User = Depends(get_current_user),
    tenant_id: int = Depends(get_current_tenant),
):
    """
    批量导入销售预测
    
    接收前端 uni_import 组件传递的二维数组数据，批量创建销售预测。
    数据格式：第一行为表头，第二行为示例数据（跳过），从第三行开始为实际数据。
    
    **前端实现**：使用 `uni_import` 组件（基于 Univer Sheet）进行数据编辑，确认后通过 `onConfirm` 回调传递二维数组数据。
    
    Args:
        request: 导入请求数据（包含二维数组，格式：{"data": [[...], [...], ...]}）
        current_user: 当前用户（依赖注入）
        tenant_id: 当前组织ID（依赖注入）
        
    Returns:
        dict: 导入结果（成功数、失败数、错误列表）
    """
    from fastapi import HTTPException
    
    try:
        # 获取二维数组数据
        data = request.get("data", [])
        if not data:
            raise ValidationError("导入数据为空")
        
        service = SalesForecastService()
        result = await service.import_from_data(
            tenant_id=tenant_id,
            data=data,
            created_by=current_user.id
        )
        
        return result
                
    except ValidationError as e:
        raise _http_exception_with_trace(
            http_status.HTTP_422_UNPROCESSABLE_ENTITY,
            str(e),
            "/sales-forecasts/import",
            tenant_id,
        )
    except Exception as e:
        logger.error(f"导入销售预测失败: {str(e)}")
        raise _http_exception_with_trace(
            http_status.HTTP_500_INTERNAL_SERVER_ERROR,
            f"导入失败: {str(e)}",
            "/sales-forecasts/import",
            tenant_id,
        )


@router.get("/sales-forecasts/export", response_class=FileResponse, summary="Batch export sales forecasts")
async def export_sales_forecasts(
    status: Optional[str] = Query(None, description="预测状态筛选"),
    forecast_period: Optional[str] = Query(None, description="预测周期筛选"),
    current_user: User = Depends(get_current_user),
    tenant_id: int = Depends(get_current_tenant),
):
    """
    批量导出销售预测到Excel文件
    
    Args:
        status: 预测状态筛选
        forecast_period: 预测周期筛选
        current_user: 当前用户（依赖注入）
        tenant_id: 当前组织ID（依赖注入）
        
    Returns:
        FileResponse: Excel文件
    """
    from fastapi import HTTPException
    from fastapi.responses import FileResponse
    import os
    
    try:
        service = SalesForecastService()
        file_path = await service.export_to_excel(
            tenant_id=tenant_id,
            status=status,
            forecast_period=forecast_period
        )
        
        if not os.path.exists(file_path):
            raise _http_exception_with_trace(
                http_status.HTTP_500_INTERNAL_SERVER_ERROR,
                "导出文件生成失败",
                "/sales-forecasts/export",
                tenant_id,
            )
        
        return FileResponse(
            path=file_path,
            filename=os.path.basename(file_path),
            media_type='application/vnd.ms-excel'
        )
                
    except Exception as e:
        logger.error(f"导出销售预测失败: {str(e)}")
        raise _http_exception_with_trace(
            http_status.HTTP_500_INTERNAL_SERVER_ERROR,
            f"导出失败: {str(e)}",
            "/sales-forecasts/export",
            tenant_id,
        )









# ============ 采购订单管理 API ============
# 注意：采购订单API已移至 purchase.py，此处不再重复实现
# 请使用 /purchase-orders 路径访问采购订单API


# ============ 单据节点耗时统计 API ============
# 已迁移至 document_relations_legacy.py


# ============ 报表 API（库存/质量报表见 reports/reports.py，避免重复注册） ============

@router.get("/reports/production", summary="Production report")
async def get_production_report(
    report_type: str = Query("efficiency", description="报表类型（efficiency/completion/reporting/equipment）"),
    date_start: Optional[str] = Query(None, description="开始日期（YYYY-MM-DD）"),
    date_end: Optional[str] = Query(None, description="结束日期（YYYY-MM-DD）"),
    work_center_id: Optional[int] = Query(None, description="工作中心ID"),
    current_user: User = Depends(get_current_user),
    tenant_id: int = Depends(get_current_tenant),
) -> dict:
    """
    获取生产报表数据

    支持多种报表类型：
    - efficiency: 生产效率分析
    - completion: 工单完成情况报表
    - reporting: 报工统计分析报表
    - equipment: 设备利用率报表

    - **report_type**: 报表类型
    - **date_start**: 开始日期（可选）
    - **date_end**: 结束日期（可选）
    - **work_center_id**: 工作中心ID（可选）
    """
    from datetime import datetime
    
    date_start_dt = None
    date_end_dt = None

    if date_start:
        try:
            date_start_dt = datetime.strptime(date_start, "%Y-%m-%d")
        except ValueError:
            raise ValidationError("开始日期格式错误，应为YYYY-MM-DD")

    if date_end:
        try:
            date_end_dt = datetime.strptime(date_end, "%Y-%m-%d")
        except ValueError:
            raise ValidationError("结束日期格式错误，应为YYYY-MM-DD")

    return await report_service.get_production_report(
        tenant_id=tenant_id,
        report_type=report_type,
        date_start=date_start_dt,
        date_end=date_end_dt,
        work_center_id=work_center_id,
    )


# ============ 库存盘点 API ============

@router.post(
    "/stocktakings",
    response_model=StocktakingResponse,
    summary="Create stocktaking",
    dependencies=[Depends(require_permission_codes("kuaizhizao:warehouse-management-stocktaking:create"))],
)
async def create_stocktaking(
    stocktaking: StocktakingCreate,
    current_user: User = Depends(get_current_user),
    tenant_id: int = Depends(get_current_tenant),
) -> StocktakingResponse:
    """
    创建库存盘点单

    - **stocktaking**: 盘点单创建数据
    - **current_user**: 当前用户
    - **tenant_id**: 当前组织ID

    返回创建的盘点单信息。
    """
    try:
        return await stocktaking_service.create_stocktaking(
            tenant_id=tenant_id,
            stocktaking_data=stocktaking,
            created_by=current_user.id
        )
    except ValidationError as e:
        raise _http_exception_with_trace(400, str(e), "/stocktakings", tenant_id)
    except Exception as e:
        raise _http_exception_with_trace(500, f"创建盘点单失败: {str(e)}", "/stocktakings", tenant_id)


@router.get("/stocktakings", response_model=StocktakingListResponse, summary="List stocktakings")
async def list_stocktakings(
    skip: int = Query(0, ge=0, description="跳过数量"),
    limit: int = Query(100, ge=1, le=1000, description="限制数量"),
    code: Optional[str] = Query(None, description="盘点单号（模糊搜索）"),
    warehouse_id: Optional[int] = Query(None, description="仓库ID"),
    status: Optional[str] = Query(None, description="状态"),
    stocktaking_type: Optional[str] = Query(None, description="盘点类型"),
    keyword: Optional[str] = Query(None, description="模糊搜索"),
    search: Optional[str] = Query(None, description="搜索关键词（与 keyword 等价）"),
    order_by: Optional[str] = Query(None, description="排序字段"),
    stocktaking_date_start: Optional[str] = Query(None, description="盘点日期起"),
    stocktaking_date_end: Optional[str] = Query(None, description="盘点日期止"),
    created_start_date: Optional[str] = Query(None, description="创建日期起"),
    created_end_date: Optional[str] = Query(None, description="创建日期止"),
    updated_start_date: Optional[str] = Query(None, description="更新日期起"),
    updated_end_date: Optional[str] = Query(None, description="更新日期止"),
    current_user: User = Depends(get_current_user),
    tenant_id: int = Depends(get_current_tenant),
) -> StocktakingListResponse:
    """
    获取库存盘点单列表

    - **skip**: 跳过数量
    - **limit**: 限制数量
    - **code**: 盘点单号（模糊搜索）
    - **warehouse_id**: 仓库ID
    - **status**: 状态
    - **stocktaking_type**: 盘点类型
    - **current_user**: 当前用户
    - **tenant_id**: 当前组织ID

    返回盘点单列表。
    """
    return await stocktaking_service.list_stocktakings(
        tenant_id=tenant_id,
        skip=skip,
        limit=limit,
        code=code,
        warehouse_id=warehouse_id,
        status=status,
        stocktaking_type=stocktaking_type,
        keyword=keyword,
        search=search,
        order_by=order_by,
        stocktaking_date_start=stocktaking_date_start,
        stocktaking_date_end=stocktaking_date_end,
        created_start_date=created_start_date,
        created_end_date=created_end_date,
        updated_start_date=updated_start_date,
        updated_end_date=updated_end_date,
    )


@router.get("/stocktakings/{stocktaking_id}", response_model=StocktakingWithItemsResponse, summary="Get stocktaking")
async def get_stocktaking(
    stocktaking_id: int,
    current_user: User = Depends(get_current_user),
    tenant_id: int = Depends(get_current_tenant),
) -> StocktakingWithItemsResponse:
    """
    获取库存盘点单详情（包含明细）

    - **stocktaking_id**: 盘点单ID
    - **current_user**: 当前用户
    - **tenant_id**: 当前组织ID

    返回盘点单详情（包含明细）。
    """
    try:
        return await stocktaking_service.get_stocktaking_by_id(
            tenant_id=tenant_id,
            stocktaking_id=stocktaking_id
        )
    except NotFoundError as e:
        raise _http_exception_with_trace(404, str(e), "/stocktakings/{stocktaking_id}", tenant_id)


@router.put(
    "/stocktakings/{stocktaking_id}",
    response_model=StocktakingResponse,
    summary="Update stocktaking",
    dependencies=[Depends(require_permission_codes("kuaizhizao:warehouse-management-stocktaking:update"))],
)
async def update_stocktaking(
    stocktaking_id: int,
    stocktaking: StocktakingUpdate,
    current_user: User = Depends(get_current_user),
    tenant_id: int = Depends(get_current_tenant),
) -> StocktakingResponse:
    """
    更新库存盘点单

    - **stocktaking_id**: 盘点单ID
    - **stocktaking**: 盘点单更新数据
    - **current_user**: 当前用户
    - **tenant_id**: 当前组织ID

    返回更新后的盘点单信息。
    """
    try:
        return await stocktaking_service.update_stocktaking(
            tenant_id=tenant_id,
            stocktaking_id=stocktaking_id,
            stocktaking_data=stocktaking,
            updated_by=current_user.id
        )
    except NotFoundError as e:
        raise _http_exception_with_trace(404, str(e), "/stocktakings/{stocktaking_id}", tenant_id)
    except ValidationError as e:
        raise _http_exception_with_trace(400, str(e), "/stocktakings/{stocktaking_id}", tenant_id)


@router.post(
    "/stocktakings/{stocktaking_id}/start",
    response_model=StocktakingResponse,
    summary="Start stocktaking",
    dependencies=[Depends(require_permission_codes("kuaizhizao:warehouse-management-stocktaking:update"))],
)
async def start_stocktaking(
    stocktaking_id: int,
    start_request: Optional[StartStocktakingRequest] = Body(None),
    current_user: User = Depends(get_current_user),
    tenant_id: int = Depends(get_current_tenant),
) -> StocktakingResponse:
    """
    开始盘点（将状态从draft改为in_progress）

    - **stocktaking_id**: 盘点单ID
    - **current_user**: 当前用户
    - **tenant_id**: 当前组织ID

    返回更新后的盘点单信息。
    """
    try:
        return await stocktaking_service.start_stocktaking(
            tenant_id=tenant_id,
            stocktaking_id=stocktaking_id,
            started_by=current_user.id,
            start_request=start_request,
        )
    except NotFoundError as e:
        raise _http_exception_with_trace(404, str(e), "/stocktakings/{stocktaking_id}/start", tenant_id)
    except ValidationError as e:
        raise _http_exception_with_trace(400, str(e), "/stocktakings/{stocktaking_id}/start", tenant_id)


@router.post(
    "/stocktakings/{stocktaking_id}/items",
    response_model=StocktakingItemResponse,
    summary="Add stocktaking line",
    dependencies=[Depends(require_permission_codes("kuaizhizao:warehouse-management-stocktaking:create"))],
)
async def create_stocktaking_item(
    stocktaking_id: int,
    item: StocktakingItemCreate,
    current_user: User = Depends(get_current_user),
    tenant_id: int = Depends(get_current_tenant),
) -> StocktakingItemResponse:
    """
    添加盘点明细

    - **stocktaking_id**: 盘点单ID
    - **item**: 盘点明细创建数据
    - **current_user**: 当前用户
    - **tenant_id**: 当前组织ID

    返回创建的盘点明细信息。
    """
    try:
        return await stocktaking_service.create_stocktaking_item(
            tenant_id=tenant_id,
            stocktaking_id=stocktaking_id,
            item_data=item,
            created_by=current_user.id
        )
    except NotFoundError as e:
        raise _http_exception_with_trace(404, str(e), "/stocktakings/{stocktaking_id}/items", tenant_id)
    except ValidationError as e:
        raise _http_exception_with_trace(400, str(e), "/stocktakings/{stocktaking_id}/items", tenant_id)


@router.post(
    "/stocktakings/{stocktaking_id}/items/bulk",
    response_model=List[StocktakingItemResponse],
    summary="Bulk add stocktaking lines",
    dependencies=[Depends(require_permission_codes("kuaizhizao:warehouse-management-stocktaking:create"))],
)
async def bulk_create_stocktaking_items(
    stocktaking_id: int,
    payload: StocktakingItemBulkCreate,
    current_user: User = Depends(get_current_user),
    tenant_id: int = Depends(get_current_tenant),
) -> List[StocktakingItemResponse]:
    """批量添加盘点明细（抽盘从仓库库存勾选）"""
    try:
        return await stocktaking_service.add_stocktaking_items(
            tenant_id=tenant_id,
            stocktaking_id=stocktaking_id,
            items=payload.items,
            created_by=current_user.id,
        )
    except NotFoundError as e:
        raise _http_exception_with_trace(404, str(e), "/stocktakings/{stocktaking_id}/items/bulk", tenant_id)
    except ValidationError as e:
        raise _http_exception_with_trace(400, str(e), "/stocktakings/{stocktaking_id}/items/bulk", tenant_id)


@router.put(
    "/stocktakings/{stocktaking_id}/items/{item_id}",
    response_model=StocktakingItemResponse,
    summary="Update stocktaking line",
    dependencies=[Depends(require_permission_codes("kuaizhizao:warehouse-management-stocktaking:update"))],
)
async def update_stocktaking_item(
    stocktaking_id: int,
    item_id: int,
    item: StocktakingItemUpdate,
    current_user: User = Depends(get_current_user),
    tenant_id: int = Depends(get_current_tenant),
) -> StocktakingItemResponse:
    """
    更新盘点明细（主要用于更新实际数量）

    - **stocktaking_id**: 盘点单ID
    - **item_id**: 盘点明细ID
    - **item**: 盘点明细更新数据
    - **current_user**: 当前用户
    - **tenant_id**: 当前组织ID

    返回更新后的盘点明细信息。
    """
    try:
        return await stocktaking_service.update_stocktaking_item(
            tenant_id=tenant_id,
            item_id=item_id,
            item_data=item,
            updated_by=current_user.id
        )
    except NotFoundError as e:
        raise _http_exception_with_trace(404, str(e), "/stocktakings/{stocktaking_id}/items/{item_id}", tenant_id)
    except ValidationError as e:
        raise _http_exception_with_trace(400, str(e), "/stocktakings/{stocktaking_id}/items/{item_id}", tenant_id)


@router.post(
    "/stocktakings/{stocktaking_id}/items/{item_id}/execute",
    response_model=StocktakingItemResponse,
    summary="Execute stocktaking line",
    dependencies=[Depends(require_permission_codes("kuaizhizao:warehouse-management-stocktaking:update"))],
)
async def execute_stocktaking_item(
    stocktaking_id: int,
    item_id: int,
    actual_quantity: Decimal = Body(..., description="实际数量"),
    remarks: Optional[str] = Body(None, description="备注"),
    current_user: User = Depends(get_current_user),
    tenant_id: int = Depends(get_current_tenant),
) -> StocktakingItemResponse:
    """
    执行盘点明细（记录实际数量）

    - **stocktaking_id**: 盘点单ID
    - **item_id**: 盘点明细ID
    - **actual_quantity**: 实际数量
    - **remarks**: 备注
    - **current_user**: 当前用户
    - **tenant_id**: 当前组织ID

    返回更新后的盘点明细信息。
    """
    try:
        return await stocktaking_service.execute_stocktaking_item(
            tenant_id=tenant_id,
            item_id=item_id,
            actual_quantity=actual_quantity,
            counted_by=current_user.id,
            remarks=remarks
        )
    except NotFoundError as e:
        raise _http_exception_with_trace(404, str(e), "/stocktakings/{stocktaking_id}/items/{item_id}/execute", tenant_id)
    except ValidationError as e:
        raise _http_exception_with_trace(400, str(e), "/stocktakings/{stocktaking_id}/items/{item_id}/execute", tenant_id)


@router.post(
    "/stocktakings/{stocktaking_id}/complete",
    response_model=StocktakingResponse,
    summary="Complete stocktaking",
    dependencies=[Depends(require_permission_codes("kuaizhizao:warehouse-management-stocktaking:update"))],
)
async def complete_stocktaking(
    stocktaking_id: int,
    current_user: User = Depends(get_current_user),
    tenant_id: int = Depends(get_current_tenant),
) -> StocktakingResponse:
    """完成盘点（账实相符或有差异均可结案）"""
    try:
        return await stocktaking_service.complete_stocktaking(
            tenant_id=tenant_id,
            stocktaking_id=stocktaking_id,
            completed_by=current_user.id,
        )
    except NotFoundError as e:
        raise _http_exception_with_trace(404, str(e), "/stocktakings/{stocktaking_id}/complete", tenant_id)
    except ValidationError as e:
        raise _http_exception_with_trace(400, str(e), "/stocktakings/{stocktaking_id}/complete", tenant_id)


@router.post(
    "/stocktakings/{stocktaking_id}/withdraw",
    response_model=StocktakingResponse,
    summary="Withdraw stocktaking to draft",
    dependencies=[Depends(require_permission_codes("kuaizhizao:warehouse-management-stocktaking:revoke"))],
)
async def withdraw_stocktaking(
    stocktaking_id: int,
    current_user: User = Depends(get_current_user),
    tenant_id: int = Depends(get_current_tenant),
) -> StocktakingResponse:
    """撤回盘点（盘点中 -> 草稿），便于删除误开始的盘点单。"""
    try:
        return await stocktaking_service.withdraw_stocktaking(
            tenant_id=tenant_id,
            stocktaking_id=stocktaking_id,
            withdrawn_by=current_user.id,
        )
    except NotFoundError as e:
        raise _http_exception_with_trace(404, str(e), "/stocktakings/{stocktaking_id}/withdraw", tenant_id)
    except (ValidationError, BusinessLogicError) as e:
        raise _http_exception_with_trace(400, str(e), "/stocktakings/{stocktaking_id}/withdraw", tenant_id)


@router.post(
    "/stocktakings/{stocktaking_id}/adjust",
    response_model=StocktakingResponse,
    summary="Post stocktaking variance",
    dependencies=[Depends(require_permission_codes("kuaizhizao:warehouse-management-stocktaking:update"))],
)
async def adjust_stocktaking_differences(
    stocktaking_id: int,
    current_user: User = Depends(get_current_user),
    tenant_id: int = Depends(get_current_tenant),
) -> StocktakingResponse:
    """
    处理盘点差异（调整库存）

    - **stocktaking_id**: 盘点单ID
    - **current_user**: 当前用户
    - **tenant_id**: 当前组织ID

    返回更新后的盘点单信息。
    """
    try:
        return await stocktaking_service.adjust_stocktaking_differences(
            tenant_id=tenant_id,
            stocktaking_id=stocktaking_id,
            adjusted_by=current_user.id
        )
    except NotFoundError as e:
        raise _http_exception_with_trace(404, str(e), "/stocktakings/{stocktaking_id}/adjust", tenant_id)
    except ValidationError as e:
        raise _http_exception_with_trace(400, str(e), "/stocktakings/{stocktaking_id}/adjust", tenant_id)


@router.delete(
    "/stocktakings/{stocktaking_id}",
    status_code=http_status.HTTP_204_NO_CONTENT,
    summary="Delete stocktaking",
    dependencies=[Depends(require_permission_codes("kuaizhizao:warehouse-management-stocktaking:delete"))],
)
async def delete_stocktaking(
    stocktaking_id: int,
    current_user: User = Depends(get_current_user),
    tenant_id: int = Depends(get_current_tenant),
):
    """删除盘点单（软删除，仅草稿可删）"""
    await stocktaking_service.delete_stocktaking(
        tenant_id=tenant_id,
        stocktaking_id=stocktaking_id
    )


# ============ 库存调拨 API ============

@router.post("/inventory-transfers", response_model=InventoryTransferResponse, summary="Create inventory transfer")
async def create_inventory_transfer(
    transfer: InventoryTransferCreateWithItems,
    current_user: User = Depends(get_current_user),
    tenant_id: int = Depends(get_current_tenant),
) -> InventoryTransferResponse:
    """
    创建库存调拨单

    - **transfer**: 调拨单创建数据
    - **current_user**: 当前用户
    - **tenant_id**: 当前组织ID

    返回创建的调拨单信息。
    """
    try:
        return await inventory_transfer_service.create_inventory_transfer(
            tenant_id=tenant_id,
            transfer_data=transfer,
            created_by=current_user.id
        )
    except ValidationError as e:
        raise _http_exception_with_trace(400, str(e), "/inventory-transfers", tenant_id)
    except Exception as e:
        raise _http_exception_with_trace(500, f"创建调拨单失败: {str(e)}", "/inventory-transfers", tenant_id)


@router.post("/bin-transfers", response_model=InventoryTransferResponse, summary="Create bin relocation")
async def create_bin_transfer(
    transfer: InventoryTransferCreateWithItems,
    current_user: User = Depends(get_current_user),
    tenant_id: int = Depends(get_current_tenant),
) -> InventoryTransferResponse:
    """创建库内移位单（允许同仓调拨，建议配套库位填写）。"""
    try:
        transfer.allow_same_warehouse = True
        return await inventory_transfer_service.create_inventory_transfer(
            tenant_id=tenant_id,
            transfer_data=transfer,
            created_by=current_user.id,
        )
    except ValidationError as e:
        raise _http_exception_with_trace(400, str(e), "/bin-transfers", tenant_id)
    except Exception as e:
        raise _http_exception_with_trace(500, f"创建库内移位单失败: {str(e)}", "/bin-transfers", tenant_id)


@router.get("/inventory-transfers", response_model=InventoryTransferListResponse, summary="List inventory transfers")
async def list_inventory_transfers(
    skip: int = Query(0, ge=0, description="跳过数量"),
    limit: int = Query(100, ge=1, le=1000, description="限制数量"),
    code: Optional[str] = Query(None, description="调拨单号（模糊搜索）"),
    from_warehouse_id: Optional[int] = Query(None, description="调出仓库ID"),
    to_warehouse_id: Optional[int] = Query(None, description="调入仓库ID"),
    status: Optional[str] = Query(None, description="状态"),
    transfer_mode: Optional[str] = Query(None, description="单据模式：transfer|bin_relocation"),
    keyword: Optional[str] = Query(None, description="模糊搜索"),
    search: Optional[str] = Query(None, description="搜索关键词（与 keyword 等价）"),
    order_by: Optional[str] = Query(None, description="排序字段"),
    transfer_date_start: Optional[str] = Query(None, description="调拨日期起"),
    transfer_date_end: Optional[str] = Query(None, description="调拨日期止"),
    created_start_date: Optional[str] = Query(None, description="创建日期起"),
    created_end_date: Optional[str] = Query(None, description="创建日期止"),
    updated_start_date: Optional[str] = Query(None, description="更新日期起"),
    updated_end_date: Optional[str] = Query(None, description="更新日期止"),
    current_user: User = Depends(get_current_user),
    tenant_id: int = Depends(get_current_tenant),
) -> InventoryTransferListResponse:
    """
    获取库存调拨单列表

    - **skip**: 跳过数量
    - **limit**: 限制数量
    - **code**: 调拨单号（模糊搜索）
    - **from_warehouse_id**: 调出仓库ID
    - **to_warehouse_id**: 调入仓库ID
    - **status**: 状态
    - **current_user**: 当前用户
    - **tenant_id**: 当前组织ID

    返回调拨单列表。
    """
    return await inventory_transfer_service.list_inventory_transfers(
        tenant_id=tenant_id,
        skip=skip,
        limit=limit,
        code=code,
        from_warehouse_id=from_warehouse_id,
        to_warehouse_id=to_warehouse_id,
        status=status,
        transfer_mode=transfer_mode,
        keyword=keyword,
        search=search,
        order_by=order_by,
        transfer_date_start=transfer_date_start,
        transfer_date_end=transfer_date_end,
        created_start_date=created_start_date,
        created_end_date=created_end_date,
        updated_start_date=updated_start_date,
        updated_end_date=updated_end_date,
    )


@router.get("/bin-transfers", response_model=InventoryTransferListResponse, summary="List bin relocations")
async def list_bin_transfers(
    skip: int = Query(0, ge=0, description="跳过数量"),
    limit: int = Query(100, ge=1, le=1000, description="限制数量"),
    code: Optional[str] = Query(None, description="移位单号（模糊搜索）"),
    warehouse_id: Optional[int] = Query(None, description="仓库ID"),
    status: Optional[str] = Query(None, description="状态"),
    keyword: Optional[str] = Query(None, description="模糊搜索"),
    search: Optional[str] = Query(None, description="搜索关键词（与 keyword 等价）"),
    order_by: Optional[str] = Query(None, description="排序字段"),
    transfer_date_start: Optional[str] = Query(None, description="移位日期起"),
    transfer_date_end: Optional[str] = Query(None, description="移位日期止"),
    created_start_date: Optional[str] = Query(None, description="创建日期起"),
    created_end_date: Optional[str] = Query(None, description="创建日期止"),
    updated_start_date: Optional[str] = Query(None, description="更新日期起"),
    updated_end_date: Optional[str] = Query(None, description="更新日期止"),
    current_user: User = Depends(get_current_user),
    tenant_id: int = Depends(get_current_tenant),
) -> InventoryTransferListResponse:
    return await inventory_transfer_service.list_inventory_transfers(
        tenant_id=tenant_id,
        skip=skip,
        limit=limit,
        code=code,
        from_warehouse_id=warehouse_id,
        to_warehouse_id=warehouse_id,
        status=status,
        transfer_mode="bin_relocation",
        keyword=keyword,
        search=search,
        order_by=order_by,
        transfer_date_start=transfer_date_start,
        transfer_date_end=transfer_date_end,
        created_start_date=created_start_date,
        created_end_date=created_end_date,
        updated_start_date=updated_start_date,
        updated_end_date=updated_end_date,
    )


@router.get("/inventory-transfers/{transfer_id}", response_model=InventoryTransferWithItemsResponse, summary="Get inventory transfer")
async def get_inventory_transfer(
    transfer_id: int,
    current_user: User = Depends(get_current_user),
    tenant_id: int = Depends(get_current_tenant),
) -> InventoryTransferWithItemsResponse:
    """
    获取库存调拨单详情（包含明细）

    - **transfer_id**: 调拨单ID
    - **current_user**: 当前用户
    - **tenant_id**: 当前组织ID

    返回调拨单详情（包含明细）。
    """
    try:
        return await inventory_transfer_service.get_inventory_transfer_by_id(
            tenant_id=tenant_id,
            transfer_id=transfer_id
        )
    except NotFoundError as e:
        raise _http_exception_with_trace(404, str(e), "/inventory-transfers/{transfer_id}", tenant_id)


@router.put("/inventory-transfers/{transfer_id}", response_model=InventoryTransferResponse, summary="Update inventory transfer")
async def update_inventory_transfer(
    transfer_id: int,
    transfer: InventoryTransferUpdate,
    current_user: User = Depends(get_current_user),
    tenant_id: int = Depends(get_current_tenant),
) -> InventoryTransferResponse:
    """
    更新库存调拨单

    - **transfer_id**: 调拨单ID
    - **transfer**: 调拨单更新数据
    - **current_user**: 当前用户
    - **tenant_id**: 当前组织ID

    返回更新后的调拨单信息。
    """
    try:
        return await inventory_transfer_service.update_inventory_transfer(
            tenant_id=tenant_id,
            transfer_id=transfer_id,
            transfer_data=transfer,
            updated_by=current_user.id
        )
    except NotFoundError as e:
        raise _http_exception_with_trace(404, str(e), "/inventory-transfers/{transfer_id}", tenant_id)
    except ValidationError as e:
        raise _http_exception_with_trace(400, str(e), "/inventory-transfers/{transfer_id}", tenant_id)


@router.post("/inventory-transfers/{transfer_id}/items", response_model=InventoryTransferItemResponse, summary="Add transfer line")
async def create_inventory_transfer_item(
    transfer_id: int,
    item: InventoryTransferItemCreate,
    current_user: User = Depends(get_current_user),
    tenant_id: int = Depends(get_current_tenant),
) -> InventoryTransferItemResponse:
    """
    添加调拨明细

    - **transfer_id**: 调拨单ID
    - **item**: 调拨明细创建数据
    - **current_user**: 当前用户
    - **tenant_id**: 当前组织ID

    返回创建的调拨明细信息。
    """
    try:
        return await inventory_transfer_service.create_inventory_transfer_item(
            tenant_id=tenant_id,
            transfer_id=transfer_id,
            item_data=item,
            created_by=current_user.id
        )
    except NotFoundError as e:
        raise _http_exception_with_trace(404, str(e), "/inventory-transfers/{transfer_id}/items", tenant_id)
    except ValidationError as e:
        raise _http_exception_with_trace(400, str(e), "/inventory-transfers/{transfer_id}/items", tenant_id)


@router.put("/inventory-transfers/{transfer_id}/items/{item_id}", response_model=InventoryTransferItemResponse, summary="Update transfer line")
async def update_inventory_transfer_item(
    transfer_id: int,
    item_id: int,
    item: InventoryTransferItemUpdate,
    current_user: User = Depends(get_current_user),
    tenant_id: int = Depends(get_current_tenant),
) -> InventoryTransferItemResponse:
    """
    更新调拨明细

    - **transfer_id**: 调拨单ID
    - **item_id**: 调拨明细ID
    - **item**: 调拨明细更新数据
    - **current_user**: 当前用户
    - **tenant_id**: 当前组织ID

    返回更新后的调拨明细信息。
    """
    try:
        return await inventory_transfer_service.update_inventory_transfer_item(
            tenant_id=tenant_id,
            item_id=item_id,
            item_data=item,
            updated_by=current_user.id
        )
    except NotFoundError as e:
        raise _http_exception_with_trace(404, str(e), "/inventory-transfers/{transfer_id}/items/{item_id}", tenant_id)
    except ValidationError as e:
        raise _http_exception_with_trace(400, str(e), "/inventory-transfers/{transfer_id}/items/{item_id}", tenant_id)


@router.post("/inventory-transfers/{transfer_id}/execute", response_model=InventoryTransferResponse, summary="Execute transfer")
async def execute_inventory_transfer(
    transfer_id: int,
    current_user: User = Depends(get_current_user),
    tenant_id: int = Depends(get_current_tenant),
) -> InventoryTransferResponse:
    """
    执行调拨（更新库存）

    - **transfer_id**: 调拨单ID
    - **current_user**: 当前用户
    - **tenant_id**: 当前组织ID

    返回更新后的调拨单信息。
    """
    try:
        return await inventory_transfer_service.execute_inventory_transfer(
            tenant_id=tenant_id,
            transfer_id=transfer_id,
            executed_by=current_user.id
        )
    except NotFoundError as e:
        raise _http_exception_with_trace(404, str(e), "/inventory-transfers/{transfer_id}/execute", tenant_id)
    except ValidationError as e:
        raise _http_exception_with_trace(400, str(e), "/inventory-transfers/{transfer_id}/execute", tenant_id)


@router.delete("/inventory-transfers/{transfer_id}", status_code=http_status.HTTP_204_NO_CONTENT, summary="Delete inventory transfer")
async def delete_inventory_transfer(
    transfer_id: int,
    current_user: User = Depends(get_current_user),
    tenant_id: int = Depends(get_current_tenant),
):
    """删除调拨单（软删除，仅草稿可删）"""
    await inventory_transfer_service.delete_inventory_transfer(
        tenant_id=tenant_id,
        transfer_id=transfer_id
    )


# ============ 组装模板 API ============

_ASSEMBLY_ORDERS_READ = "kuaizhizao:warehouse-management-assembly-orders:read"
_ASSEMBLY_ORDERS_CREATE = "kuaizhizao:warehouse-management-assembly-orders:create"
_ASSEMBLY_ORDERS_UPDATE = "kuaizhizao:warehouse-management-assembly-orders:update"
_ASSEMBLY_ORDERS_DELETE = "kuaizhizao:warehouse-management-assembly-orders:delete"


@router.post(
    "/assembly-templates",
    response_model=AssemblyTemplateResponse,
    summary="Create assembly template",
    dependencies=[Depends(require_permission_codes(_ASSEMBLY_ORDERS_CREATE))],
)
async def create_assembly_template(
    data: AssemblyTemplateCreate,
    current_user: User = Depends(get_current_user),
    tenant_id: int = Depends(get_current_tenant),
) -> AssemblyTemplateResponse:
    try:
        return await assembly_template_service.create_template(
            tenant_id=tenant_id,
            data=data,
            created_by=current_user.id,
        )
    except ValidationError as e:
        raise _http_exception_with_trace(400, str(e), "/assembly-templates", tenant_id)


@router.get(
    "/assembly-templates",
    response_model=AssemblyTemplateListResponse,
    summary="List assembly templates",
    dependencies=[Depends(require_permission_codes(_ASSEMBLY_ORDERS_READ))],
)
async def list_assembly_templates(
    skip: int = Query(0, ge=0, description="跳过数量"),
    limit: int = Query(100, ge=1, le=1000, description="限制数量"),
    keyword: Optional[str] = Query(None, description="关键字"),
    product_material_id: Optional[int] = Query(None, description="成品物料ID"),
    is_active: Optional[bool] = Query(None, description="是否启用"),
    current_user: User = Depends(get_current_user),
    tenant_id: int = Depends(get_current_tenant),
) -> AssemblyTemplateListResponse:
    return await assembly_template_service.list_templates(
        tenant_id=tenant_id,
        skip=skip,
        limit=limit,
        keyword=keyword,
        product_material_id=product_material_id,
        is_active=is_active,
    )


@router.get(
    "/assembly-templates/bom-preview",
    response_model=AssemblyTemplateBomPreviewResponse,
    summary="Preview BOM for assembly template",
    dependencies=[Depends(require_permission_codes(_ASSEMBLY_ORDERS_READ))],
)
async def preview_assembly_template_bom(
    product_material_id: int = Query(..., description="成品/半成品物料ID"),
    base_quantity: Decimal = Query(Decimal("1"), gt=0, description="基准数量"),
    product_material_code: Optional[str] = Query(None, description="成品物料编码"),
    product_material_name: Optional[str] = Query(None, description="成品物料名称"),
    current_user: User = Depends(get_current_user),
    tenant_id: int = Depends(get_current_tenant),
) -> AssemblyTemplateBomPreviewResponse:
    try:
        return await assembly_template_service.preview_bom(
            tenant_id=tenant_id,
            product_material_id=product_material_id,
            base_quantity=base_quantity,
            product_material_code=product_material_code,
            product_material_name=product_material_name,
        )
    except ValidationError as e:
        raise _http_exception_with_trace(400, str(e), "/assembly-templates/bom-preview", tenant_id)


@router.get(
    "/assembly-templates/{template_id}",
    response_model=AssemblyTemplateResponse,
    summary="Get assembly template",
    dependencies=[Depends(require_permission_codes(_ASSEMBLY_ORDERS_READ))],
)
async def get_assembly_template(
    template_id: int,
    current_user: User = Depends(get_current_user),
    tenant_id: int = Depends(get_current_tenant),
) -> AssemblyTemplateResponse:
    try:
        return await assembly_template_service.get_template_by_id(
            tenant_id=tenant_id,
            template_id=template_id,
        )
    except NotFoundError as e:
        raise _http_exception_with_trace(404, str(e), "/assembly-templates/{template_id}", tenant_id)


@router.put(
    "/assembly-templates/{template_id}",
    response_model=AssemblyTemplateResponse,
    summary="Update assembly template",
    dependencies=[Depends(require_permission_codes(_ASSEMBLY_ORDERS_UPDATE))],
)
async def update_assembly_template(
    template_id: int,
    data: AssemblyTemplateUpdate,
    current_user: User = Depends(get_current_user),
    tenant_id: int = Depends(get_current_tenant),
) -> AssemblyTemplateResponse:
    try:
        return await assembly_template_service.update_template(
            tenant_id=tenant_id,
            template_id=template_id,
            data=data,
            updated_by=current_user.id,
        )
    except NotFoundError as e:
        raise _http_exception_with_trace(404, str(e), "/assembly-templates/{template_id}", tenant_id)
    except ValidationError as e:
        raise _http_exception_with_trace(400, str(e), "/assembly-templates/{template_id}", tenant_id)


@router.delete(
    "/assembly-templates/{template_id}",
    status_code=http_status.HTTP_204_NO_CONTENT,
    summary="Delete assembly template",
    dependencies=[Depends(require_permission_codes(_ASSEMBLY_ORDERS_DELETE))],
)
async def delete_assembly_template(
    template_id: int,
    current_user: User = Depends(get_current_user),
    tenant_id: int = Depends(get_current_tenant),
):
    try:
        await assembly_template_service.delete_template(
            tenant_id=tenant_id,
            template_id=template_id,
        )
    except NotFoundError as e:
        raise _http_exception_with_trace(404, str(e), "/assembly-templates/{template_id}", tenant_id)


@router.post(
    "/assembly-templates/{template_id}/items",
    response_model=AssemblyTemplateItemResponse,
    summary="Add assembly template line",
    dependencies=[Depends(require_permission_codes(_ASSEMBLY_ORDERS_CREATE))],
)
async def create_assembly_template_item(
    template_id: int,
    item: AssemblyTemplateItemCreateInput,
    current_user: User = Depends(get_current_user),
    tenant_id: int = Depends(get_current_tenant),
) -> AssemblyTemplateItemResponse:
    try:
        return await assembly_template_service.create_template_item(
            tenant_id=tenant_id,
            template_id=template_id,
            item_data=item,
            created_by=current_user.id,
        )
    except NotFoundError as e:
        raise _http_exception_with_trace(404, str(e), "/assembly-templates/{template_id}/items", tenant_id)
    except ValidationError as e:
        raise _http_exception_with_trace(400, str(e), "/assembly-templates/{template_id}/items", tenant_id)


@router.put(
    "/assembly-templates/{template_id}/items/{item_id}",
    response_model=AssemblyTemplateItemResponse,
    summary="Update assembly template line",
    dependencies=[Depends(require_permission_codes(_ASSEMBLY_ORDERS_UPDATE))],
)
async def update_assembly_template_item(
    template_id: int,
    item_id: int,
    item: AssemblyTemplateItemUpdate,
    current_user: User = Depends(get_current_user),
    tenant_id: int = Depends(get_current_tenant),
) -> AssemblyTemplateItemResponse:
    try:
        return await assembly_template_service.update_template_item(
            tenant_id=tenant_id,
            template_id=template_id,
            item_id=item_id,
            item_data=item,
            updated_by=current_user.id,
        )
    except NotFoundError as e:
        raise _http_exception_with_trace(
            404, str(e), "/assembly-templates/{template_id}/items/{item_id}", tenant_id
        )
    except ValidationError as e:
        raise _http_exception_with_trace(
            400, str(e), "/assembly-templates/{template_id}/items/{item_id}", tenant_id
        )


@router.delete(
    "/assembly-templates/{template_id}/items/{item_id}",
    status_code=http_status.HTTP_204_NO_CONTENT,
    summary="Delete assembly template line",
    dependencies=[Depends(require_permission_codes(_ASSEMBLY_ORDERS_DELETE))],
)
async def delete_assembly_template_item(
    template_id: int,
    item_id: int,
    current_user: User = Depends(get_current_user),
    tenant_id: int = Depends(get_current_tenant),
):
    try:
        await assembly_template_service.delete_template_item(
            tenant_id=tenant_id,
            template_id=template_id,
            item_id=item_id,
            updated_by=current_user.id,
        )
    except NotFoundError as e:
        raise _http_exception_with_trace(
            404, str(e), "/assembly-templates/{template_id}/items/{item_id}", tenant_id
        )


@router.post(
    "/assembly-templates/{template_id}/import-from-bom",
    response_model=AssemblyTemplateResponse,
    summary="Import assembly template lines from BOM",
    dependencies=[Depends(require_permission_codes(_ASSEMBLY_ORDERS_UPDATE))],
)
async def import_assembly_template_from_bom(
    template_id: int,
    current_user: User = Depends(get_current_user),
    tenant_id: int = Depends(get_current_tenant),
) -> AssemblyTemplateResponse:
    try:
        return await assembly_template_service.import_from_bom(
            tenant_id=tenant_id,
            template_id=template_id,
            updated_by=current_user.id,
        )
    except NotFoundError as e:
        raise _http_exception_with_trace(
            404, str(e), "/assembly-templates/{template_id}/import-from-bom", tenant_id
        )
    except ValidationError as e:
        raise _http_exception_with_trace(
            400, str(e), "/assembly-templates/{template_id}/import-from-bom", tenant_id
        )


# ============ 组装单 API ============

@router.post("/assembly-orders", response_model=AssemblyOrderResponse, summary="Create assembly order")
async def create_assembly_order(
    data: AssemblyOrderCreate,
    current_user: User = Depends(get_current_user),
    tenant_id: int = Depends(get_current_tenant),
) -> AssemblyOrderResponse:
    """创建组装单"""
    try:
        return await assembly_order_service.create_assembly_order(
            tenant_id=tenant_id,
            order_data=data,
            created_by=current_user.id
        )
    except ValidationError as e:
        raise _http_exception_with_trace(400, str(e), "/assembly-orders", tenant_id)
    except BusinessLogicError as e:
        raise _http_exception_with_trace(400, str(e), "/assembly-orders", tenant_id)


@router.get("/assembly-orders", response_model=AssemblyOrderListResponse, summary="List assembly orders")
async def list_assembly_orders(
    skip: int = Query(0, ge=0, description="跳过数量"),
    limit: int = Query(100, ge=1, le=1000, description="限制数量"),
    code: Optional[str] = Query(None, description="组装单号（模糊搜索）"),
    warehouse_id: Optional[int] = Query(None, description="仓库ID"),
    status: Optional[str] = Query(None, description="状态"),
    keyword: Optional[str] = Query(None, description="模糊搜索"),
    search: Optional[str] = Query(None, description="搜索关键词（与 keyword 等价）"),
    order_by: Optional[str] = Query(None, description="排序字段"),
    assembly_date_start: Optional[str] = Query(None, description="组装日期起"),
    assembly_date_end: Optional[str] = Query(None, description="组装日期止"),
    created_start_date: Optional[str] = Query(None, description="创建日期起"),
    created_end_date: Optional[str] = Query(None, description="创建日期止"),
    updated_start_date: Optional[str] = Query(None, description="更新日期起"),
    updated_end_date: Optional[str] = Query(None, description="更新日期止"),
    current_user: User = Depends(get_current_user),
    tenant_id: int = Depends(get_current_tenant),
) -> AssemblyOrderListResponse:
    """获取组装单列表"""
    return await assembly_order_service.list_assembly_orders(
        tenant_id=tenant_id,
        skip=skip,
        limit=limit,
        code=code,
        warehouse_id=warehouse_id,
        status=status,
        keyword=keyword,
        search=search,
        order_by=order_by,
        assembly_date_start=assembly_date_start,
        assembly_date_end=assembly_date_end,
        created_start_date=created_start_date,
        created_end_date=created_end_date,
        updated_start_date=updated_start_date,
        updated_end_date=updated_end_date,
    )


@router.get("/assembly-orders/{order_id}", response_model=AssemblyOrderWithItemsResponse, summary="Get assembly order")
async def get_assembly_order(
    order_id: int,
    current_user: User = Depends(get_current_user),
    tenant_id: int = Depends(get_current_tenant),
) -> AssemblyOrderWithItemsResponse:
    """获取组装单详情（含明细）"""
    try:
        return await assembly_order_service.get_assembly_order_by_id(
            tenant_id=tenant_id,
            order_id=order_id
        )
    except NotFoundError as e:
        raise _http_exception_with_trace(404, str(e), "/assembly-orders/{order_id}", tenant_id)


@router.put("/assembly-orders/{order_id}", response_model=AssemblyOrderResponse, summary="Update assembly order")
async def update_assembly_order(
    order_id: int,
    data: AssemblyOrderUpdate,
    current_user: User = Depends(get_current_user),
    tenant_id: int = Depends(get_current_tenant),
) -> AssemblyOrderResponse:
    """更新组装单"""
    try:
        return await assembly_order_service.update_assembly_order(
            tenant_id=tenant_id,
            order_id=order_id,
            order_data=data,
            updated_by=current_user.id
        )
    except NotFoundError as e:
        raise _http_exception_with_trace(404, str(e), "/assembly-orders/{order_id}", tenant_id)
    except ValidationError as e:
        raise _http_exception_with_trace(400, str(e), "/assembly-orders/{order_id}", tenant_id)


@router.post("/assembly-orders/{order_id}/items", response_model=AssemblyOrderItemResponse, summary="Add assembly line")
async def create_assembly_order_item(
    order_id: int,
    item: AssemblyOrderItemCreateInput,
    current_user: User = Depends(get_current_user),
    tenant_id: int = Depends(get_current_tenant),
) -> AssemblyOrderItemResponse:
    """添加组装明细"""
    try:
        return await assembly_order_service.create_assembly_order_item(
            tenant_id=tenant_id,
            order_id=order_id,
            item_data=item,
            created_by=current_user.id
        )
    except NotFoundError as e:
        raise _http_exception_with_trace(404, str(e), "/assembly-orders/{order_id}/items", tenant_id)
    except ValidationError as e:
        raise _http_exception_with_trace(400, str(e), "/assembly-orders/{order_id}/items", tenant_id)


@router.put("/assembly-orders/{order_id}/items/{item_id}", response_model=AssemblyOrderItemResponse, summary="Update assembly line")
async def update_assembly_order_item(
    order_id: int,
    item_id: int,
    item: AssemblyOrderItemUpdate,
    current_user: User = Depends(get_current_user),
    tenant_id: int = Depends(get_current_tenant),
) -> AssemblyOrderItemResponse:
    """更新组装明细"""
    try:
        return await assembly_order_service.update_assembly_order_item(
            tenant_id=tenant_id,
            item_id=item_id,
            item_data=item,
            updated_by=current_user.id
        )
    except NotFoundError as e:
        raise _http_exception_with_trace(404, str(e), "/assembly-orders/{order_id}/items/{item_id}", tenant_id)
    except ValidationError as e:
        raise _http_exception_with_trace(400, str(e), "/assembly-orders/{order_id}/items/{item_id}", tenant_id)


@router.delete("/assembly-orders/{order_id}/items/{item_id}", status_code=http_status.HTTP_204_NO_CONTENT, summary="Delete assembly line")
async def delete_assembly_order_item(
    order_id: int,
    item_id: int,
    current_user: User = Depends(get_current_user),
    tenant_id: int = Depends(get_current_tenant),
):
    """删除组装明细（软删除，仅草稿单且待处理明细可删）"""
    try:
        await assembly_order_service.delete_assembly_order_item(
            tenant_id=tenant_id,
            order_id=order_id,
            item_id=item_id,
            deleted_by=current_user.id,
        )
    except NotFoundError as e:
        raise _http_exception_with_trace(404, str(e), "/assembly-orders/{order_id}/items/{item_id}", tenant_id)
    except ValidationError as e:
        raise _http_exception_with_trace(400, str(e), "/assembly-orders/{order_id}/items/{item_id}", tenant_id)


@router.delete("/assembly-orders/{order_id}", status_code=http_status.HTTP_204_NO_CONTENT, summary="Delete assembly order")
async def delete_assembly_order(
    order_id: int,
    current_user: User = Depends(get_current_user),
    tenant_id: int = Depends(get_current_tenant),
):
    """删除组装单（软删除，仅草稿可删）"""
    await assembly_order_service.delete_assembly_order(
        tenant_id=tenant_id,
        order_id=order_id
    )


@router.post(
    "/assembly-orders/{order_id}/apply-template",
    response_model=AssemblyOrderWithItemsResponse,
    summary="Apply assembly template to draft order",
    dependencies=[Depends(require_permission_codes(_ASSEMBLY_ORDERS_UPDATE))],
)
async def apply_assembly_template_to_order(
    order_id: int,
    request_data: ApplyAssemblyTemplateRequest,
    current_user: User = Depends(get_current_user),
    tenant_id: int = Depends(get_current_tenant),
) -> AssemblyOrderWithItemsResponse:
    try:
        return await assembly_order_service.apply_template_to_order(
            tenant_id=tenant_id,
            order_id=order_id,
            request=request_data,
            updated_by=current_user.id,
        )
    except NotFoundError as e:
        raise _http_exception_with_trace(
            404, str(e), "/assembly-orders/{order_id}/apply-template", tenant_id
        )
    except ValidationError as e:
        raise _http_exception_with_trace(
            400, str(e), "/assembly-orders/{order_id}/apply-template", tenant_id
        )


@router.post("/assembly-orders/{order_id}/execute", response_model=AssemblyOrderResponse, summary="Execute assembly")
async def execute_assembly_order(
    order_id: int,
    request_data: Optional[ExecuteAssemblyOrderRequest] = None,
    current_user: User = Depends(get_current_user),
    tenant_id: int = Depends(get_current_tenant),
) -> AssemblyOrderResponse:
    """执行组装（更新明细状态，支持可选物料绑定追溯）"""
    try:
        return await assembly_order_service.execute_assembly_order(
            tenant_id=tenant_id,
            order_id=order_id,
            executed_by=current_user.id,
            request_data=request_data
        )
    except NotFoundError as e:
        raise _http_exception_with_trace(404, str(e), "/assembly-orders/{order_id}/execute", tenant_id)
    except ValidationError as e:
        raise _http_exception_with_trace(400, str(e), "/assembly-orders/{order_id}/execute", tenant_id)


# ============ 拆卸单 API ============

@router.post("/disassembly-orders", response_model=DisassemblyOrderResponse, summary="Create disassembly order")
async def create_disassembly_order(
    data: DisassemblyOrderCreate,
    current_user: User = Depends(get_current_user),
    tenant_id: int = Depends(get_current_tenant),
) -> DisassemblyOrderResponse:
    """创建拆卸单"""
    try:
        return await disassembly_order_service.create_disassembly_order(
            tenant_id=tenant_id,
            order_data=data,
            created_by=current_user.id
        )
    except ValidationError as e:
        raise _http_exception_with_trace(400, str(e), "/disassembly-orders", tenant_id)
    except BusinessLogicError as e:
        raise _http_exception_with_trace(400, str(e), "/disassembly-orders", tenant_id)


@router.get("/disassembly-orders", response_model=DisassemblyOrderListResponse, summary="List disassembly orders")
async def list_disassembly_orders(
    skip: int = Query(0, ge=0, description="跳过数量"),
    limit: int = Query(100, ge=1, le=1000, description="限制数量"),
    code: Optional[str] = Query(None, description="拆卸单号（模糊搜索）"),
    warehouse_id: Optional[int] = Query(None, description="仓库ID"),
    status: Optional[str] = Query(None, description="状态"),
    keyword: Optional[str] = Query(None, description="模糊搜索"),
    search: Optional[str] = Query(None, description="搜索关键词（与 keyword 等价）"),
    order_by: Optional[str] = Query(None, description="排序字段"),
    disassembly_date_start: Optional[str] = Query(None, description="拆卸日期起"),
    disassembly_date_end: Optional[str] = Query(None, description="拆卸日期止"),
    created_start_date: Optional[str] = Query(None, description="创建日期起"),
    created_end_date: Optional[str] = Query(None, description="创建日期止"),
    updated_start_date: Optional[str] = Query(None, description="更新日期起"),
    updated_end_date: Optional[str] = Query(None, description="更新日期止"),
    current_user: User = Depends(get_current_user),
    tenant_id: int = Depends(get_current_tenant),
) -> DisassemblyOrderListResponse:
    """获取拆卸单列表"""
    return await disassembly_order_service.list_disassembly_orders(
        tenant_id=tenant_id,
        skip=skip,
        limit=limit,
        code=code,
        warehouse_id=warehouse_id,
        status=status,
        keyword=keyword,
        search=search,
        order_by=order_by,
        disassembly_date_start=disassembly_date_start,
        disassembly_date_end=disassembly_date_end,
        created_start_date=created_start_date,
        created_end_date=created_end_date,
        updated_start_date=updated_start_date,
        updated_end_date=updated_end_date,
    )


@router.get("/disassembly-orders/{order_id}", response_model=DisassemblyOrderWithItemsResponse, summary="Get disassembly order")
async def get_disassembly_order(
    order_id: int,
    current_user: User = Depends(get_current_user),
    tenant_id: int = Depends(get_current_tenant),
) -> DisassemblyOrderWithItemsResponse:
    """获取拆卸单详情（含明细）"""
    try:
        return await disassembly_order_service.get_disassembly_order_by_id(
            tenant_id=tenant_id,
            order_id=order_id
        )
    except NotFoundError as e:
        raise _http_exception_with_trace(404, str(e), "/disassembly-orders/{order_id}", tenant_id)


@router.put("/disassembly-orders/{order_id}", response_model=DisassemblyOrderResponse, summary="Update disassembly order")
async def update_disassembly_order(
    order_id: int,
    data: DisassemblyOrderUpdate,
    current_user: User = Depends(get_current_user),
    tenant_id: int = Depends(get_current_tenant),
) -> DisassemblyOrderResponse:
    """更新拆卸单"""
    try:
        return await disassembly_order_service.update_disassembly_order(
            tenant_id=tenant_id,
            order_id=order_id,
            order_data=data,
            updated_by=current_user.id
        )
    except NotFoundError as e:
        raise _http_exception_with_trace(404, str(e), "/disassembly-orders/{order_id}", tenant_id)
    except ValidationError as e:
        raise _http_exception_with_trace(400, str(e), "/disassembly-orders/{order_id}", tenant_id)


@router.post("/disassembly-orders/{order_id}/items", response_model=DisassemblyOrderItemResponse, summary="Add disassembly line")
async def create_disassembly_order_item(
    order_id: int,
    item: DisassemblyOrderItemCreateInput,
    current_user: User = Depends(get_current_user),
    tenant_id: int = Depends(get_current_tenant),
) -> DisassemblyOrderItemResponse:
    """添加拆卸明细"""
    try:
        return await disassembly_order_service.create_disassembly_order_item(
            tenant_id=tenant_id,
            order_id=order_id,
            item_data=item,
            created_by=current_user.id
        )
    except NotFoundError as e:
        raise _http_exception_with_trace(404, str(e), "/disassembly-orders/{order_id}/items", tenant_id)
    except ValidationError as e:
        raise _http_exception_with_trace(400, str(e), "/disassembly-orders/{order_id}/items", tenant_id)


@router.put("/disassembly-orders/{order_id}/items/{item_id}", response_model=DisassemblyOrderItemResponse, summary="Update disassembly line")
async def update_disassembly_order_item(
    order_id: int,
    item_id: int,
    item: DisassemblyOrderItemUpdate,
    current_user: User = Depends(get_current_user),
    tenant_id: int = Depends(get_current_tenant),
) -> DisassemblyOrderItemResponse:
    """更新拆卸明细"""
    try:
        return await disassembly_order_service.update_disassembly_order_item(
            tenant_id=tenant_id,
            item_id=item_id,
            item_data=item,
            updated_by=current_user.id
        )
    except NotFoundError as e:
        raise _http_exception_with_trace(404, str(e), "/disassembly-orders/{order_id}/items/{item_id}", tenant_id)
    except ValidationError as e:
        raise _http_exception_with_trace(400, str(e), "/disassembly-orders/{order_id}/items/{item_id}", tenant_id)


@router.delete("/disassembly-orders/{order_id}/items/{item_id}", status_code=http_status.HTTP_204_NO_CONTENT, summary="Delete disassembly line")
async def delete_disassembly_order_item(
    order_id: int,
    item_id: int,
    current_user: User = Depends(get_current_user),
    tenant_id: int = Depends(get_current_tenant),
):
    """删除拆卸明细（软删除，仅草稿单且待处理明细可删）"""
    try:
        await disassembly_order_service.delete_disassembly_order_item(
            tenant_id=tenant_id,
            order_id=order_id,
            item_id=item_id,
            deleted_by=current_user.id,
        )
    except NotFoundError as e:
        raise _http_exception_with_trace(404, str(e), "/disassembly-orders/{order_id}/items/{item_id}", tenant_id)
    except ValidationError as e:
        raise _http_exception_with_trace(400, str(e), "/disassembly-orders/{order_id}/items/{item_id}", tenant_id)


@router.delete("/disassembly-orders/{order_id}", status_code=http_status.HTTP_204_NO_CONTENT, summary="Delete disassembly order")
async def delete_disassembly_order(
    order_id: int,
    current_user: User = Depends(get_current_user),
    tenant_id: int = Depends(get_current_tenant),
):
    """删除拆卸单（软删除，仅草稿可删）"""
    await disassembly_order_service.delete_disassembly_order(
        tenant_id=tenant_id,
        order_id=order_id
    )


@router.post("/disassembly-orders/{order_id}/execute", response_model=DisassemblyOrderResponse, summary="Execute disassembly")
async def execute_disassembly_order(
    order_id: int,
    current_user: User = Depends(get_current_user),
    tenant_id: int = Depends(get_current_tenant),
) -> DisassemblyOrderResponse:
    """执行拆卸（更新明细状态；已同步扣减子件库存、增加母件库存）"""
    try:
        return await disassembly_order_service.execute_disassembly_order(
            tenant_id=tenant_id,
            order_id=order_id,
            executed_by=current_user.id
        )
    except NotFoundError as e:
        raise _http_exception_with_trace(404, str(e), "/disassembly-orders/{order_id}/execute", tenant_id)
    except ValidationError as e:
        raise _http_exception_with_trace(400, str(e), "/disassembly-orders/{order_id}/execute", tenant_id)


# ==================== 工单委外管理 API ====================

@router.post("/outsource-work-orders", response_model=OutsourceWorkOrderResponse, summary="Create outsourced work order")
async def create_outsource_work_order(
    data: OutsourceWorkOrderCreate,
    current_user: User = Depends(get_current_user),
    tenant_id: int = Depends(get_current_tenant),
) -> OutsourceWorkOrderResponse:
    """
    创建工单委外

    - **data**: 工单委外创建数据
    - **current_user**: 当前用户
    - **tenant_id**: 当前组织ID

    返回创建的工单委外信息。
    """
    try:
        return await outsource_work_order_service.create_outsource_work_order(
            tenant_id=tenant_id,
            work_order_data=data,
            created_by=current_user.id
        )
    except ValidationError as e:
        raise _http_exception_with_trace(400, str(e), "/outsource-work-orders", tenant_id)
    except NotFoundError as e:
        raise _http_exception_with_trace(404, str(e), "/outsource-work-orders", tenant_id)


@router.get("/outsource-work-orders", response_model=OutsourceWorkOrderListResponse, summary="List outsourced work orders")
async def list_outsource_work_orders(
    skip: int = Query(0, ge=0, description="跳过数量"),
    limit: int = Query(100, ge=1, le=1000, description="限制数量"),
    status: Optional[str] = Query(None, description="状态筛选"),
    supplier_id: Optional[int] = Query(None, description="供应商ID筛选"),
    product_id: Optional[int] = Query(None, description="产品ID筛选"),
    keyword: Optional[str] = Query(None, description="关键词搜索"),
    code: Optional[str] = Query(None, description="委外工单编码（模糊搜索）"),
    name: Optional[str] = Query(None, description="委外工单名称（模糊搜索）"),
    product_name: Optional[str] = Query(None, description="产品名称（模糊搜索）"),
    supplier_name: Optional[str] = Query(None, description="供应商名称（模糊搜索）"),
    priority: Optional[str] = Query(None, description="优先级"),
    planned_start_from: Optional[date] = Query(None, description="计划开始日期起"),
    planned_start_to: Optional[date] = Query(None, description="计划开始日期止"),
    created_start_date: Optional[date] = Query(None, description="创建日期起"),
    created_end_date: Optional[date] = Query(None, description="创建日期止"),
    order_by: Optional[str] = Query(None, description="排序字段，如 code、-created_at"),
    current_user: User = Depends(get_current_user),
    tenant_id: int = Depends(get_current_tenant),
) -> OutsourceWorkOrderListResponse:
    """
    获取工单委外列表

    - **skip**: 跳过数量
    - **limit**: 限制数量
    - **status**: 状态筛选
    - **supplier_id**: 供应商ID筛选
    - **product_id**: 产品ID筛选
    - **keyword**: 关键词搜索（编码、名称）
    - **current_user**: 当前用户
    - **tenant_id**: 当前组织ID

    返回工单委外列表。
    """
    try:
        safe_order_by = None
        if order_by:
            field = order_by.lstrip("-")
            if field in OUTSOURCE_WORK_ORDER_SORTABLE_FIELDS:
                safe_order_by = order_by
        return await outsource_work_order_service.list_outsource_work_orders(
            tenant_id=tenant_id,
            skip=skip,
            limit=limit,
            status=status,
            supplier_id=supplier_id,
            product_id=product_id,
            keyword=keyword,
            code=code,
            name=name,
            product_name=product_name,
            supplier_name=supplier_name,
            priority=priority,
            planned_start_from=planned_start_from,
            planned_start_to=planned_start_to,
            created_start_date=created_start_date,
            created_end_date=created_end_date,
            order_by=safe_order_by,
        )
    except Exception as e:
        logger.error(f"获取工单委外列表失败: {e}")
        raise _http_exception_with_trace(500, str(e), "/outsource-work-orders", tenant_id)


@router.get("/outsource-work-orders/{work_order_id}", response_model=OutsourceWorkOrderResponse, summary="Get outsourced work order")
async def get_outsource_work_order(
    work_order_id: int = Path(..., description="工单委外ID"),
    current_user: User = Depends(get_current_user),
    tenant_id: int = Depends(get_current_tenant),
) -> OutsourceWorkOrderResponse:
    """
    获取工单委外详情

    - **work_order_id**: 工单委外ID
    - **current_user**: 当前用户
    - **tenant_id**: 当前组织ID

    返回工单委外详情。
    """
    try:
        return await outsource_work_order_service.get_outsource_work_order(
            tenant_id=tenant_id,
            work_order_id=work_order_id
        )
    except NotFoundError as e:
        raise _http_exception_with_trace(404, str(e), "/outsource-work-orders/{work_order_id}", tenant_id)


@router.put("/outsource-work-orders/{work_order_id}", response_model=OutsourceWorkOrderResponse, summary="Update outsourced work order")
async def update_outsource_work_order(
    work_order_id: int = Path(..., description="工单委外ID"),
    data: OutsourceWorkOrderUpdate = Body(...),
    current_user: User = Depends(get_current_user),
    tenant_id: int = Depends(get_current_tenant),
) -> OutsourceWorkOrderResponse:
    """
    更新工单委外

    - **work_order_id**: 工单委外ID
    - **data**: 工单委外更新数据
    - **current_user**: 当前用户
    - **tenant_id**: 当前组织ID

    返回更新后的工单委外信息。
    """
    try:
        return await outsource_work_order_service.update_outsource_work_order(
            tenant_id=tenant_id,
            work_order_id=work_order_id,
            work_order_data=data,
            updated_by=current_user.id
        )
    except NotFoundError as e:
        raise _http_exception_with_trace(404, str(e), "/outsource-work-orders/{work_order_id}", tenant_id)
    except ValidationError as e:
        raise _http_exception_with_trace(400, str(e), "/outsource-work-orders/{work_order_id}", tenant_id)


@router.delete("/outsource-work-orders/{work_order_id}", summary="Delete outsourced work order")
async def delete_outsource_work_order(
    work_order_id: int = Path(..., description="工单委外ID"),
    current_user: User = Depends(get_current_user),
    tenant_id: int = Depends(get_current_tenant),
) -> JSONResponse:
    """
    删除工单委外（软删除）

    - **work_order_id**: 工单委外ID
    - **current_user**: 当前用户
    - **tenant_id**: 当前组织ID

    返回删除结果。
    """
    try:
        await outsource_work_order_service.delete_outsource_work_order(
            tenant_id=tenant_id,
            work_order_id=work_order_id,
            deleted_by=current_user.id
        )
        return JSONResponse(content={"success": True, "message": "工单委外删除成功"})
    except NotFoundError as e:
        raise _http_exception_with_trace(404, str(e), "/outsource-work-orders/{work_order_id}", tenant_id)
    except BusinessLogicError as e:
        raise _http_exception_with_trace(400, str(e), "/outsource-work-orders/{work_order_id}", tenant_id)


@router.post(
    "/outsource-work-orders/{work_order_id}/release",
    response_model=OutsourceWorkOrderResponse,
    summary="Release outsourced work order",
)
async def release_outsource_work_order(
    work_order_id: int = Path(..., description="工单委外ID"),
    current_user: User = Depends(get_current_user),
    tenant_id: int = Depends(get_current_tenant),
) -> OutsourceWorkOrderResponse:
    """下达委外工单（draft → released）。"""
    try:
        return await outsource_work_order_service.release_outsource_work_order(
            tenant_id=tenant_id,
            work_order_id=work_order_id,
            released_by=current_user.id,
        )
    except NotFoundError as e:
        raise _http_exception_with_trace(
            404, str(e), "/outsource-work-orders/{work_order_id}/release", tenant_id
        )
    except ValidationError as e:
        raise _http_exception_with_trace(
            400, str(e), "/outsource-work-orders/{work_order_id}/release", tenant_id
        )


@router.post(
    "/outsource-work-orders/{work_order_id}/cancel",
    response_model=OutsourceWorkOrderResponse,
    summary="Cancel outsourced work order",
    dependencies=[Depends(require_permission_codes("kuaizhizao:outsource-order:revoke"))],
)
async def cancel_outsource_work_order(
    work_order_id: int = Path(..., description="工单委外ID"),
    reason: Optional[str] = Body(None, embed=True),
    current_user: User = Depends(get_current_user),
    tenant_id: int = Depends(get_current_tenant),
) -> OutsourceWorkOrderResponse:
    """取消委外工单（草稿或未发料/收货的已下达）。"""
    try:
        return await outsource_work_order_service.cancel_outsource_work_order(
            tenant_id=tenant_id,
            work_order_id=work_order_id,
            cancelled_by=current_user.id,
            reason=reason,
        )
    except NotFoundError as e:
        raise _http_exception_with_trace(
            404, str(e), "/outsource-work-orders/{work_order_id}/cancel", tenant_id
        )
    except (ValidationError, BusinessLogicError) as e:
        raise _http_exception_with_trace(
            400, str(e), "/outsource-work-orders/{work_order_id}/cancel", tenant_id
        )


@router.post(
    "/outsource-work-orders/{work_order_id}/close",
    response_model=OutsourceWorkOrderResponse,
    summary="Force close outsourced work order",
    dependencies=[Depends(require_permission_codes("kuaizhizao:outsource-order:approve"))],
)
async def close_outsource_work_order(
    work_order_id: int = Path(..., description="工单委外ID"),
    reason: str = Body(..., embed=True, min_length=1),
    current_user: User = Depends(get_current_user),
    tenant_id: int = Depends(get_current_tenant),
) -> OutsourceWorkOrderResponse:
    """强制结案（短收/终止，不再继续收货）。"""
    try:
        return await outsource_work_order_service.close_outsource_work_order(
            tenant_id=tenant_id,
            work_order_id=work_order_id,
            closed_by=current_user.id,
            reason=reason,
        )
    except NotFoundError as e:
        raise _http_exception_with_trace(
            404, str(e), "/outsource-work-orders/{work_order_id}/close", tenant_id
        )
    except (ValidationError, BusinessLogicError) as e:
        raise _http_exception_with_trace(
            400, str(e), "/outsource-work-orders/{work_order_id}/close", tenant_id
        )


# ==================== 委外发料 API ====================

@router.get(
    "/outsource-work-orders/{work_order_id}/issue-preview",
    response_model=OutsourceMaterialIssuePreviewResponse,
    summary="Preview subcontract issue lines from BOM",
)
async def get_outsource_issue_preview(
    work_order_id: int = Path(..., description="委外工单ID"),
    current_user: User = Depends(get_current_user),
    tenant_id: int = Depends(get_current_tenant),
) -> OutsourceMaterialIssuePreviewResponse:
    """根据委外工单产品 BOM 返回待发料明细预览。"""
    try:
        return await outsource_material_issue_service.get_issue_preview(
            tenant_id=tenant_id,
            outsource_work_order_id=work_order_id,
        )
    except NotFoundError as e:
        raise _http_exception_with_trace(404, str(e), "/outsource-work-orders/{work_order_id}/issue-preview", tenant_id)


@router.post(
    "/outsource-material-issues/batch",
    response_model=OutsourceMaterialIssueBatchResponse,
    summary="Batch create subcontract issues",
)
async def create_outsource_material_issues_batch(
    data: OutsourceMaterialIssueBatchCreate,
    current_user: User = Depends(get_current_user),
    tenant_id: int = Depends(get_current_tenant),
) -> OutsourceMaterialIssueBatchResponse:
    """批量创建委外发料单（按 BOM 明细行）。"""
    try:
        return await outsource_material_issue_service.create_material_issues_batch(
            tenant_id=tenant_id,
            batch_data=data,
            created_by=current_user.id,
        )
    except ValidationError as e:
        raise _http_exception_with_trace(400, str(e), "/outsource-material-issues/batch", tenant_id)
    except NotFoundError as e:
        raise _http_exception_with_trace(404, str(e), "/outsource-material-issues/batch", tenant_id)


@router.post("/outsource-material-issues", response_model=OutsourceMaterialIssueResponse, summary="Create subcontract issue")
async def create_outsource_material_issue(
    data: OutsourceMaterialIssueCreate,
    current_user: User = Depends(get_current_user),
    tenant_id: int = Depends(get_current_tenant),
) -> OutsourceMaterialIssueResponse:
    """
    创建委外发料单

    - **data**: 委外发料创建数据
    - **current_user**: 当前用户
    - **tenant_id**: 当前组织ID

    返回创建的委外发料单信息。
    """
    try:
        return await outsource_material_issue_service.create_material_issue(
            tenant_id=tenant_id,
            issue_data=data,
            created_by=current_user.id
        )
    except ValidationError as e:
        raise _http_exception_with_trace(400, str(e), "/outsource-material-issues", tenant_id)
    except NotFoundError as e:
        raise _http_exception_with_trace(404, str(e), "/outsource-material-issues", tenant_id)


@router.get("/outsource-material-issues", response_model=List[OutsourceMaterialIssueResponse], summary="List subcontract issues")
async def list_outsource_material_issues(
    skip: int = Query(0, ge=0, description="跳过数量"),
    limit: int = Query(100, ge=1, le=1000, description="限制数量"),
    outsource_work_order_id: Optional[int] = Query(None, description="工单委外ID筛选"),
    status: Optional[str] = Query(None, description="状态筛选"),
    keyword: Optional[str] = Query(None, description="关键词搜索"),
    current_user: User = Depends(get_current_user),
    tenant_id: int = Depends(get_current_tenant),
) -> List[OutsourceMaterialIssueResponse]:
    """
    获取委外发料单列表

    - **skip**: 跳过数量
    - **limit**: 限制数量
    - **outsource_work_order_id**: 工单委外ID筛选
    - **status**: 状态筛选
    - **keyword**: 关键词搜索
    - **current_user**: 当前用户
    - **tenant_id**: 当前组织ID

    返回委外发料单列表。
    """
    try:
        return await outsource_material_issue_service.list_material_issues(
            tenant_id=tenant_id,
            skip=skip,
            limit=limit,
            outsource_work_order_id=outsource_work_order_id,
            status=status,
            keyword=keyword,
        )
    except Exception as e:
        logger.error(f"获取委外发料单列表失败: {e}")
        raise _http_exception_with_trace(500, str(e), "/outsource-material-issues", tenant_id)


@router.get("/outsource-material-issues/{issue_id}", response_model=OutsourceMaterialIssueResponse, summary="Get subcontract issue")
async def get_outsource_material_issue(
    issue_id: int = Path(..., description="委外发料单ID"),
    current_user: User = Depends(get_current_user),
    tenant_id: int = Depends(get_current_tenant),
) -> OutsourceMaterialIssueResponse:
    """
    获取委外发料单详情

    - **issue_id**: 委外发料单ID
    - **current_user**: 当前用户
    - **tenant_id**: 当前组织ID

    返回委外发料单详情。
    """
    try:
        return await outsource_material_issue_service.get_material_issue(
            tenant_id=tenant_id,
            issue_id=issue_id
        )
    except NotFoundError as e:
        raise _http_exception_with_trace(404, str(e), "/outsource-material-issues/{issue_id}", tenant_id)


@router.post("/outsource-material-issues/{issue_id}/complete", response_model=OutsourceMaterialIssueResponse, summary="Complete subcontract issue")
async def complete_outsource_material_issue(
    issue_id: int = Path(..., description="委外发料单ID"),
    current_user: User = Depends(get_current_user),
    tenant_id: int = Depends(get_current_tenant),
) -> OutsourceMaterialIssueResponse:
    """
    完成委外发料（更新状态为completed，记录发料时间和发料人）

    - **issue_id**: 委外发料单ID
    - **current_user**: 当前用户
    - **tenant_id**: 当前组织ID

    返回更新后的委外发料单信息。
    """
    try:
        return await outsource_material_issue_service.complete_material_issue(
            tenant_id=tenant_id,
            issue_id=issue_id,
            completed_by=current_user.id
        )
    except NotFoundError as e:
        raise _http_exception_with_trace(404, str(e), "/outsource-material-issues/{issue_id}/complete", tenant_id)
    except BusinessLogicError as e:
        raise _http_exception_with_trace(400, str(e), "/outsource-material-issues/{issue_id}/complete", tenant_id)


# ==================== 委外退料 / 委外退货 API ====================

@router.get(
    "/outsource-work-orders/{work_order_id}/material-return-preview",
    response_model=OutsourceMaterialReturnPreviewResponse,
    summary="Preview subcontract material return lines",
)
async def get_outsource_material_return_preview(
    work_order_id: int = Path(..., description="委外工单ID"),
    current_user: User = Depends(get_current_user),
    tenant_id: int = Depends(get_current_tenant),
) -> OutsourceMaterialReturnPreviewResponse:
    try:
        return await outsource_material_return_service.get_return_preview(
            tenant_id=tenant_id,
            outsource_work_order_id=work_order_id,
        )
    except NotFoundError as e:
        raise _http_exception_with_trace(
            404, str(e), "/outsource-work-orders/{work_order_id}/material-return-preview", tenant_id
        )


@router.post(
    "/outsource-material-returns",
    response_model=OutsourceMaterialReturnResponse,
    summary="Create subcontract material return",
)
async def create_outsource_material_return(
    data: OutsourceMaterialReturnCreate,
    current_user: User = Depends(get_current_user),
    tenant_id: int = Depends(get_current_tenant),
) -> OutsourceMaterialReturnResponse:
    try:
        return await outsource_material_return_service.create_material_return(
            tenant_id=tenant_id,
            return_data=data,
            created_by=current_user.id,
        )
    except ValidationError as e:
        raise _http_exception_with_trace(400, str(e), "/outsource-material-returns", tenant_id)
    except NotFoundError as e:
        raise _http_exception_with_trace(404, str(e), "/outsource-material-returns", tenant_id)


@router.get(
    "/outsource-material-returns",
    response_model=List[OutsourceMaterialReturnResponse],
    summary="List subcontract material returns",
)
async def list_outsource_material_returns(
    skip: int = Query(0, ge=0, description="跳过数量"),
    limit: int = Query(100, ge=1, le=1000, description="限制数量"),
    outsource_work_order_id: Optional[int] = Query(None, description="委外工单ID筛选"),
    status: Optional[str] = Query(None, description="状态筛选"),
    keyword: Optional[str] = Query(None, description="关键词搜索"),
    current_user: User = Depends(get_current_user),
    tenant_id: int = Depends(get_current_tenant),
) -> List[OutsourceMaterialReturnResponse]:
    try:
        return await outsource_material_return_service.list_material_returns(
            tenant_id=tenant_id,
            skip=skip,
            limit=limit,
            outsource_work_order_id=outsource_work_order_id,
            status=status,
            keyword=keyword,
        )
    except Exception as e:
        raise _http_exception_with_trace(500, str(e), "/outsource-material-returns", tenant_id)


@router.get(
    "/outsource-material-returns/{return_id}",
    response_model=OutsourceMaterialReturnResponse,
    summary="Get subcontract material return",
)
async def get_outsource_material_return(
    return_id: int = Path(..., description="委外退料单ID"),
    current_user: User = Depends(get_current_user),
    tenant_id: int = Depends(get_current_tenant),
) -> OutsourceMaterialReturnResponse:
    try:
        return await outsource_material_return_service.get_material_return(
            tenant_id=tenant_id,
            return_id=return_id,
        )
    except NotFoundError as e:
        raise _http_exception_with_trace(404, str(e), "/outsource-material-returns/{return_id}", tenant_id)


@router.get(
    "/outsource-work-orders/{work_order_id}/product-return-preview",
    response_model=OutsourceProductReturnPreviewResponse,
    summary="Preview subcontract product return lines",
)
async def get_outsource_product_return_preview(
    work_order_id: int = Path(..., description="委外工单ID"),
    current_user: User = Depends(get_current_user),
    tenant_id: int = Depends(get_current_tenant),
) -> OutsourceProductReturnPreviewResponse:
    try:
        return await outsource_product_return_service.get_return_preview(
            tenant_id=tenant_id,
            outsource_work_order_id=work_order_id,
        )
    except NotFoundError as e:
        raise _http_exception_with_trace(
            404, str(e), "/outsource-work-orders/{work_order_id}/product-return-preview", tenant_id
        )


@router.post(
    "/outsource-product-returns",
    response_model=OutsourceProductReturnResponse,
    summary="Create subcontract product return",
)
async def create_outsource_product_return(
    data: OutsourceProductReturnCreate,
    current_user: User = Depends(get_current_user),
    tenant_id: int = Depends(get_current_tenant),
) -> OutsourceProductReturnResponse:
    try:
        return await outsource_product_return_service.create_product_return(
            tenant_id=tenant_id,
            return_data=data,
            created_by=current_user.id,
        )
    except ValidationError as e:
        raise _http_exception_with_trace(400, str(e), "/outsource-product-returns", tenant_id)
    except NotFoundError as e:
        raise _http_exception_with_trace(404, str(e), "/outsource-product-returns", tenant_id)


@router.get(
    "/outsource-product-returns",
    response_model=List[OutsourceProductReturnResponse],
    summary="List subcontract product returns",
)
async def list_outsource_product_returns(
    skip: int = Query(0, ge=0, description="跳过数量"),
    limit: int = Query(100, ge=1, le=1000, description="限制数量"),
    outsource_work_order_id: Optional[int] = Query(None, description="委外工单ID筛选"),
    status: Optional[str] = Query(None, description="状态筛选"),
    keyword: Optional[str] = Query(None, description="关键词搜索"),
    current_user: User = Depends(get_current_user),
    tenant_id: int = Depends(get_current_tenant),
) -> List[OutsourceProductReturnResponse]:
    try:
        return await outsource_product_return_service.list_product_returns(
            tenant_id=tenant_id,
            skip=skip,
            limit=limit,
            outsource_work_order_id=outsource_work_order_id,
            status=status,
            keyword=keyword,
        )
    except Exception as e:
        raise _http_exception_with_trace(500, str(e), "/outsource-product-returns", tenant_id)


@router.get(
    "/outsource-product-returns/{return_id}",
    response_model=OutsourceProductReturnResponse,
    summary="Get subcontract product return",
)
async def get_outsource_product_return(
    return_id: int = Path(..., description="委外退货单ID"),
    current_user: User = Depends(get_current_user),
    tenant_id: int = Depends(get_current_tenant),
) -> OutsourceProductReturnResponse:
    try:
        return await outsource_product_return_service.get_product_return(
            tenant_id=tenant_id,
            return_id=return_id,
        )
    except NotFoundError as e:
        raise _http_exception_with_trace(404, str(e), "/outsource-product-returns/{return_id}", tenant_id)


# ==================== 供应商协同 API ====================

@router.post("/purchase-orders/{purchase_order_id}/send-to-supplier", summary="Send PO to supplier portal")
async def send_purchase_order_to_supplier(
    purchase_order_id: int = Path(..., description="采购订单ID"),
    current_user: User = Depends(get_current_user),
    tenant_id: int = Depends(get_current_tenant),
):
    """
    下发采购订单到供应商协同平台
    
    将采购订单发送给供应商，供应商可以在协同平台查看和操作。
    
    - **purchase_order_id**: 采购订单ID
    """
    try:
        service = SupplierCollaborationService()
        result = await service.send_purchase_order_to_supplier(
            tenant_id=tenant_id,
            purchase_order_id=purchase_order_id,
            send_by=current_user.id
        )
        return JSONResponse(content=result, status_code=http_status.HTTP_200_OK)
    except NotFoundError as e:
        raise _http_exception_with_trace(404, str(e), "/purchase-orders/{purchase_order_id}/send-to-supplier", tenant_id)
    except BusinessLogicError as e:
        raise _http_exception_with_trace(400, str(e), "/purchase-orders/{purchase_order_id}/send-to-supplier", tenant_id)


@router.post("/purchase-orders/{purchase_order_id}/update-progress", summary="Update purchase order progress")
async def update_purchase_order_progress(
    purchase_order_id: int = Path(..., description="采购订单ID"),
    progress_data: PurchaseOrderProgressUpdateRequest = Body(...),
    current_user: User = Depends(get_current_user),
    tenant_id: int = Depends(get_current_tenant),
):
    """
    更新采购订单进度
    
    供应商可以更新采购订单的生产进度。
    
    - **purchase_order_id**: 采购订单ID
    - **progress_data**: 进度数据
    """
    try:
        service = SupplierCollaborationService()
        result = await service.update_purchase_order_progress(
            tenant_id=tenant_id,
            purchase_order_id=purchase_order_id,
            progress_data=progress_data.model_dump(),
            updated_by=current_user.id
        )
        return JSONResponse(content=result, status_code=http_status.HTTP_200_OK)
    except NotFoundError as e:
        raise _http_exception_with_trace(404, str(e), "/purchase-orders/{purchase_order_id}/update-progress", tenant_id)
    except BusinessLogicError as e:
        raise _http_exception_with_trace(400, str(e), "/purchase-orders/{purchase_order_id}/update-progress", tenant_id)


@router.post("/purchase-orders/{purchase_order_id}/submit-delivery-notice", summary="Submit shipping notice")
async def submit_delivery_notice(
    purchase_order_id: int = Path(..., description="采购订单ID"),
    delivery_data: DeliveryNoticeRequest = Body(...),
    current_user: User = Depends(get_current_user),
    tenant_id: int = Depends(get_current_tenant),
):
    """
    提交发货通知
    
    供应商提交发货通知，通知采购方准备收货。
    
    - **purchase_order_id**: 采购订单ID
    - **delivery_data**: 发货数据
    """
    try:
        service = SupplierCollaborationService()
        result = await service.submit_delivery_notice(
            tenant_id=tenant_id,
            purchase_order_id=purchase_order_id,
            delivery_data=delivery_data.model_dump(),
            submitted_by=current_user.id
        )
        return JSONResponse(content=result, status_code=http_status.HTTP_200_OK)
    except NotFoundError as e:
        raise _http_exception_with_trace(404, str(e), "/purchase-orders/{purchase_order_id}/submit-delivery-notice", tenant_id)
    except BusinessLogicError as e:
        raise _http_exception_with_trace(400, str(e), "/purchase-orders/{purchase_order_id}/submit-delivery-notice", tenant_id)


@router.get("/suppliers/{supplier_id}/purchase-orders", summary="List purchase orders for supplier")
async def get_supplier_purchase_orders(
    supplier_id: int = Path(..., description="供应商ID"),
    status: Optional[str] = Query(None, description="订单状态"),
    current_user: User = Depends(get_current_user),
    tenant_id: int = Depends(get_current_tenant),
):
    """
    获取供应商的采购订单列表
    
    供应商可以查看自己的采购订单。
    
    - **supplier_id**: 供应商ID
    - **status**: 订单状态（可选）
    """
    try:
        service = SupplierCollaborationService()
        result = await service.get_supplier_purchase_orders(
            tenant_id=tenant_id,
            supplier_id=supplier_id,
            status=status
        )
        return JSONResponse(content=result, status_code=http_status.HTTP_200_OK)
    except NotFoundError as e:
        raise _http_exception_with_trace(404, str(e), "/suppliers/{supplier_id}/purchase-orders", tenant_id)


# ==================== 客户协同 API ====================

@router.get("/customers/{customer_id}/sales-orders", summary="List sales orders for customer")
async def get_customer_sales_orders(
    customer_id: int = Path(..., description="客户ID"),
    status: Optional[str] = Query(None, description="订单状态"),
    current_user: User = Depends(get_current_user),
    tenant_id: int = Depends(get_current_tenant),
):
    """
    获取客户的销售订单列表
    
    客户可以查看自己的销售订单。
    
    - **customer_id**: 客户ID
    - **status**: 订单状态（可选）
    """
    try:
        service = CustomerCollaborationService()
        result = await service.get_customer_sales_orders(
            tenant_id=tenant_id,
            customer_id=customer_id,
            status=status
        )
        return JSONResponse(content=result, status_code=http_status.HTTP_200_OK)
    except NotFoundError as e:
        raise _http_exception_with_trace(404, str(e), "/customers/{customer_id}/sales-orders", tenant_id)


@router.get("/sales-orders/{sales_order_id}/production-progress", response_model=SalesOrderProductionProgressResponse, summary="Sales order production progress")
async def get_sales_order_production_progress(
    sales_order_id: int = Path(..., description="销售订单ID"),
    current_user: User = Depends(get_current_user),
    tenant_id: int = Depends(get_current_tenant),
) -> SalesOrderProductionProgressResponse:
    """
    获取销售订单的生产进度
    
    客户可以查看订单关联的生产进度。
    
    - **sales_order_id**: 销售订单ID
    """
    try:
        service = CustomerCollaborationService()
        result = await service.get_sales_order_production_progress(
            tenant_id=tenant_id,
            sales_order_id=sales_order_id
        )
        return SalesOrderProductionProgressResponse(**result)
    except NotFoundError as e:
        raise _http_exception_with_trace(404, str(e), "/sales-orders/{sales_order_id}/production-progress", tenant_id)


@router.get("/customers/{customer_id}/order-summary", response_model=CustomerOrderSummaryResponse, summary="Customer order summary")
async def get_customer_order_summary(
    customer_id: int = Path(..., description="客户ID"),
    current_user: User = Depends(get_current_user),
    tenant_id: int = Depends(get_current_tenant),
) -> CustomerOrderSummaryResponse:
    """
    获取客户订单汇总
    
    客户可以查看订单汇总信息。
    
    - **customer_id**: 客户ID
    """
    try:
        service = CustomerCollaborationService()
        result = await service.get_customer_order_summary(
            tenant_id=tenant_id,
            customer_id=customer_id
        )
        return CustomerOrderSummaryResponse(**result)
    except NotFoundError as e:
        raise _http_exception_with_trace(404, str(e), "/customers/{customer_id}/order-summary", tenant_id)
