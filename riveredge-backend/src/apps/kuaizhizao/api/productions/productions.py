"""
生产执行 API 路由模块

提供工单管理和报工管理的API接口。
"""

from datetime import date, datetime
from typing import List, Optional, Dict, Any
from decimal import Decimal
from fastapi import APIRouter, Depends, Query, status as http_status, Path, HTTPException, Body
from fastapi.responses import JSONResponse, FileResponse
from loguru import logger

from core.api.deps import get_current_user, get_current_tenant
from infra.models.user import User
from infra.exceptions.exceptions import ValidationError, BusinessLogicError

from apps.kuaizhizao.services.work_order_service import WorkOrderService
from apps.kuaizhizao.services.rework_order_service import ReworkOrderService
from apps.kuaizhizao.services.demand_source_chain_service import DemandSourceChainService
from apps.kuaizhizao.services.outsource_service import OutsourceService
from apps.kuaizhizao.services.outsource_work_order_service import OutsourceWorkOrderService
from apps.kuaizhizao.services.outsource_material_issue_service import OutsourceMaterialIssueService
from apps.kuaizhizao.services.outsource_material_receipt_service import OutsourceMaterialReceiptService
from apps.kuaizhizao.services.outsource_collaboration_service import OutsourceCollaborationService
from apps.kuaizhizao.services.outsource_settlement_service import OutsourceSettlementService
from apps.kuaizhizao.services.supplier_collaboration_service import SupplierCollaborationService
from apps.kuaizhizao.services.customer_collaboration_service import CustomerCollaborationService
from apps.kuaizhizao.services.stocktaking_service import StocktakingService
from apps.kuaizhizao.services.inventory_transfer_service import InventoryTransferService
from apps.kuaizhizao.services.assembly_order_service import AssemblyOrderService
from apps.kuaizhizao.services.disassembly_order_service import DisassemblyOrderService
from apps.kuaizhizao.services.exception_service import ExceptionService
from apps.kuaizhizao.services.exception_process_service import ExceptionProcessService
from apps.kuaizhizao.services.report_service import ReportService
from apps.kuaizhizao.services.defect_record_service import DefectRecordService

# 初始化服务实例
work_order_service = WorkOrderService()
outsource_work_order_service = OutsourceWorkOrderService()
outsource_material_issue_service = OutsourceMaterialIssueService()
outsource_material_receipt_service = OutsourceMaterialReceiptService()
defect_record_service = DefectRecordService()
stocktaking_service = StocktakingService()
inventory_transfer_service = InventoryTransferService()
assembly_order_service = AssemblyOrderService()
disassembly_order_service = DisassemblyOrderService()
exception_service = ExceptionService()
exception_process_service = ExceptionProcessService()
report_service = ReportService()
from apps.kuaizhizao.services.defect_record_service import DefectRecordService
from apps.kuaizhizao.services.quality_service import (
    IncomingInspectionService,
    ProcessInspectionService,
    FinishedGoodsInspectionService,
)
from apps.kuaizhizao.services.quality_standard_service import QualityStandardService
from apps.kuaizhizao.services.inspection_plan_service import InspectionPlanService
from apps.kuaizhizao.services.finance_service import (
    PayableService,
    PurchaseInvoiceService,
    ReceivableService,
)
from apps.kuaizhizao.services.sales_service import (
    SalesForecastService,
)
# BOM管理已移至master_data APP，不再需要BOMService
from apps.kuaizhizao.services.planning_service import ProductionPlanningService
from apps.kuaizhizao.services.advanced_scheduling_service import AdvancedSchedulingService
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
    OutsourceMaterialReceiptCreate,
    OutsourceMaterialReceiptUpdate,
    OutsourceMaterialReceiptResponse,
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
)
from apps.kuaizhizao.schemas.inventory_transfer import (
    InventoryTransferCreate,
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
)
from apps.kuaizhizao.schemas.finance import (
    # 应付单
    PayableCreate,
    PayableUpdate,
    PayableResponse,
    PayableListResponse,
    # 采购发票
    PurchaseInvoiceCreate,
    PurchaseInvoiceUpdate,
    PurchaseInvoiceResponse,
    PurchaseInvoiceListResponse,
    # 应收单
    ReceivableCreate,
    ReceivableUpdate,
    ReceivableResponse,
    ReceivableListResponse,
    # 付款记录
    PaymentRecordCreate,
    PaymentRecordResponse,
    # 收款记录
    ReceiptRecordCreate,
    ReceiptRecordResponse,
)
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
from apps.kuaizhizao.schemas.planning import (
    # 生产计划
    ProductionPlanResponse,
    ProductionPlanListResponse,
    ProductionPlanCreate,
    ProductionPlanUpdate,
    ProductionPlanItemResponse,
    # 高级排产
    IntelligentSchedulingRequest,
    IntelligentSchedulingResponse,
    OptimizeScheduleRequest,
    OptimizeScheduleResponse,
)

from .work_orders import router as work_orders_router
from .reporting import router as reporting_router
from .warehouse_execution import router as warehouse_execution_router
from .quality_execution import router as quality_execution_router
from .document_relations_legacy import router as document_relations_legacy_router

# 创建路由
# 注意：路由前缀为空，因为应用路由注册时会自动添加 /apps/kuaizhizao 前缀
router = APIRouter(tags=["Kuaige Zhizao - Production Execution"])
router.include_router(work_orders_router)
router.include_router(reporting_router)
router.include_router(warehouse_execution_router)
router.include_router(quality_execution_router)
router.include_router(document_relations_legacy_router)


# ============ 质量异常与质检标准 API ============
# 注：来料检验、过程检验、成品检验 API 已迁移至 quality_execution.py

@router.get("/quality/anomalies", summary="查询质量异常记录")
async def get_quality_anomalies(
    inspection_type: Optional[str] = Query(None, description="检验类型（incoming/process/finished）"),
    start_date: Optional[datetime] = Query(None, description="开始日期"),
    end_date: Optional[datetime] = Query(None, description="结束日期"),
    material_id: Optional[int] = Query(None, description="物料ID"),
    supplier_id: Optional[int] = Query(None, description="供应商ID（仅用于来料检验）"),
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
        supplier_id=supplier_id
    )
    return JSONResponse(
        content={
            "total": len(anomalies),
            "anomalies": anomalies
        },
        status_code=http_status.HTTP_200_OK
    )


# ============ 质检标准管理 API ============

@router.post("/quality-standards", response_model=QualityStandardResponse, summary="创建质检标准")
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
        raise HTTPException(status_code=400, detail=str(e))
    except NotFoundError as e:
        raise HTTPException(status_code=404, detail=str(e))


@router.get("/quality-standards", response_model=List[QualityStandardListResponse], summary="获取质检标准列表")
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
        raise HTTPException(status_code=500, detail=f"获取列表失败: {str(e)}")


@router.get("/quality-standards/{standard_id}", response_model=QualityStandardResponse, summary="获取质检标准详情")
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
        raise HTTPException(status_code=404, detail=str(e))


@router.put("/quality-standards/{standard_id}", response_model=QualityStandardResponse, summary="更新质检标准")
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
        raise HTTPException(status_code=404, detail=str(e))


@router.delete("/quality-standards/{standard_id}", summary="删除质检标准")
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
        raise HTTPException(status_code=404, detail=str(e))


@router.get("/quality-standards/by-material/{material_id}", response_model=List[QualityStandardListResponse], summary="根据物料ID获取质检标准")
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
        raise HTTPException(status_code=500, detail=f"获取标准失败: {str(e)}")


# ============ 质检方案管理 API ============

@router.post("/inspection-plans", response_model=InspectionPlanResponse, summary="创建质检方案")
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
        raise HTTPException(status_code=400, detail=str(e))
    except NotFoundError as e:
        raise HTTPException(status_code=404, detail=str(e))


@router.get("/inspection-plans", response_model=List[InspectionPlanListResponse], summary="获取质检方案列表")
async def list_inspection_plans(
    skip: int = Query(0, ge=0, description="跳过数量"),
    limit: int = Query(100, ge=1, le=1000, description="限制数量"),
    plan_type: Optional[str] = Query(None, description="方案类型（incoming/process/finished）"),
    material_id: Optional[int] = Query(None, description="物料ID"),
    is_active: Optional[bool] = Query(None, description="是否启用"),
    plan_code: Optional[str] = Query(None, description="方案编码（模糊搜索）"),
    plan_name: Optional[str] = Query(None, description="方案名称（模糊搜索）"),
    include_steps: bool = Query(False, description="是否包含检验步骤"),
    current_user: User = Depends(get_current_user),
    tenant_id: int = Depends(get_current_tenant),
) -> List[InspectionPlanListResponse]:
    """获取质检方案列表"""
    try:
        return await InspectionPlanService().list_inspection_plans(
            tenant_id=tenant_id,
            skip=skip,
            limit=limit,
            plan_type=plan_type,
            material_id=material_id,
            is_active=is_active,
            plan_code=plan_code,
            plan_name=plan_name,
            include_steps=include_steps,
        )
    except Exception as e:
        logger.error(f"获取质检方案列表失败: {str(e)}")
        raise HTTPException(status_code=500, detail=f"获取列表失败: {str(e)}")


@router.get("/inspection-plans/{plan_id}", response_model=InspectionPlanResponse, summary="获取质检方案详情")
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
        raise HTTPException(status_code=404, detail=str(e))


@router.put("/inspection-plans/{plan_id}", response_model=InspectionPlanResponse, summary="更新质检方案")
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
        raise HTTPException(status_code=404, detail=str(e))
    except ValidationError as e:
        raise HTTPException(status_code=400, detail=str(e))


@router.delete("/inspection-plans/{plan_id}", summary="删除质检方案")
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
        raise HTTPException(status_code=404, detail=str(e))


@router.get("/inspection-plans/by-material/{material_id}", response_model=List[InspectionPlanListResponse], summary="根据物料ID获取质检方案")
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
        raise HTTPException(status_code=500, detail=f"获取方案失败: {str(e)}")


@router.get("/quality/statistics", summary="质量统计分析")
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


# ============ 应付管理 API ============

@router.post("/payables", response_model=PayableResponse, summary="创建应付单")
async def create_payable(
    payable: PayableCreate,
    current_user: User = Depends(get_current_user),
    tenant_id: int = Depends(get_current_tenant),
) -> PayableResponse:
    """
    创建应付单

    - **payable**: 应付单创建数据
    - **current_user**: 当前用户
    - **tenant_id**: 当前组织ID

    返回创建的应付单信息。
    """
    return await PayableService().create_payable(
        tenant_id=tenant_id,
        payable_data=payable,
        created_by=current_user.id
    )


@router.get("/payables", response_model=List[PayableListResponse], summary="获取应付单列表")
async def list_payables(
    skip: int = Query(0, ge=0, description="跳过数量"),
    limit: int = Query(100, ge=1, le=1000, description="限制数量"),
    status: Optional[str] = Query(None, description="付款状态"),
    supplier_id: Optional[int] = Query(None, description="供应商ID"),
    due_date_start: Optional[str] = Query(None, description="到期日期开始（ISO格式）"),
    due_date_end: Optional[str] = Query(None, description="到期日期结束（ISO格式）"),
    current_user: User = Depends(get_current_user),
    tenant_id: int = Depends(get_current_tenant),
) -> List[PayableListResponse]:
    """
    获取应付单列表

    支持多种筛选条件的高级搜索。
    """
    from datetime import date

    # 转换日期参数
    due_date_start_dt = None
    due_date_end_dt = None

    if due_date_start:
        try:
            due_date_start_dt = date.fromisoformat(due_date_start)
        except ValueError:
            pass

    if due_date_end:
        try:
            due_date_end_dt = date.fromisoformat(due_date_end)
        except ValueError:
            pass

    return await PayableService().list_payables(
        tenant_id=tenant_id,
        skip=skip,
        limit=limit,
        status=status,
        supplier_id=supplier_id,
        due_date_start=due_date_start_dt,
        due_date_end=due_date_end_dt,
    )


@router.get("/payables/{payable_id}", response_model=PayableResponse, summary="获取应付单详情")
async def get_payable(
    payable_id: int,
    current_user: User = Depends(get_current_user),
    tenant_id: int = Depends(get_current_tenant),
) -> PayableResponse:
    """
    根据ID获取应付单详情

    - **payable_id**: 应付单ID
    """
    return await PayableService().get_payable_by_id(
        tenant_id=tenant_id,
        payable_id=payable_id
    )


@router.post("/payables/{payable_id}/payment", response_model=PayableResponse, summary="记录付款")
async def record_payment(
    payable_id: int,
    payment: PaymentRecordCreate,
    current_user: User = Depends(get_current_user),
    tenant_id: int = Depends(get_current_tenant),
) -> PayableResponse:
    """
    记录应付单付款

    - **payable_id**: 应付单ID
    - **payment**: 付款记录数据
    """
    return await PayableService().record_payment(
        tenant_id=tenant_id,
        payable_id=payable_id,
        payment_data=payment,
        recorded_by=current_user.id
    )


@router.post("/payables/{payable_id}/approve", response_model=PayableResponse, summary="审核应付单")
async def approve_payable(
    payable_id: int,
    rejection_reason: Optional[str] = Query(None, description="驳回原因"),
    current_user: User = Depends(get_current_user),
    tenant_id: int = Depends(get_current_tenant),
) -> PayableResponse:
    """
    审核应付单

    - **payable_id**: 应付单ID
    - **rejection_reason**: 驳回原因（可选，不填则通过）
    """
    return await PayableService().approve_payable(
        tenant_id=tenant_id,
        payable_id=payable_id,
        approved_by=current_user.id,
        rejection_reason=rejection_reason
    )


# ============ 采购发票管理 API ============

@router.post("/purchase-invoices", response_model=PurchaseInvoiceResponse, summary="创建采购发票")
async def create_purchase_invoice(
    invoice: PurchaseInvoiceCreate,
    current_user: User = Depends(get_current_user),
    tenant_id: int = Depends(get_current_tenant),
) -> PurchaseInvoiceResponse:
    """
    创建采购发票

    - **invoice**: 发票创建数据
    - **current_user**: 当前用户
    - **tenant_id**: 当前组织ID

    返回创建的采购发票信息。
    """
    return await PurchaseInvoiceService().create_purchase_invoice(
        tenant_id=tenant_id,
        invoice_data=invoice,
        created_by=current_user.id
    )


@router.get("/purchase-invoices", response_model=List[PurchaseInvoiceListResponse], summary="获取采购发票列表")
async def list_purchase_invoices(
    skip: int = Query(0, ge=0, description="跳过数量"),
    limit: int = Query(100, ge=1, le=1000, description="限制数量"),
    status: Optional[str] = Query(None, description="发票状态"),
    supplier_id: Optional[int] = Query(None, description="供应商ID"),
    purchase_order_id: Optional[int] = Query(None, description="采购订单ID"),
    current_user: User = Depends(get_current_user),
    tenant_id: int = Depends(get_current_tenant),
) -> List[PurchaseInvoiceListResponse]:
    """
    获取采购发票列表

    支持多种筛选条件的高级搜索。
    """
    return await PurchaseInvoiceService().list_purchase_invoices(
        tenant_id=tenant_id,
        skip=skip,
        limit=limit,
        status=status,
        supplier_id=supplier_id,
        purchase_order_id=purchase_order_id,
    )


@router.get("/purchase-invoices/{invoice_id}", response_model=PurchaseInvoiceResponse, summary="获取采购发票详情")
async def get_purchase_invoice(
    invoice_id: int,
    current_user: User = Depends(get_current_user),
    tenant_id: int = Depends(get_current_tenant),
) -> PurchaseInvoiceResponse:
    """
    根据ID获取采购发票详情

    - **invoice_id**: 发票ID
    """
    return await PurchaseInvoiceService().get_purchase_invoice_by_id(
        tenant_id=tenant_id,
        invoice_id=invoice_id
    )


@router.post("/purchase-invoices/{invoice_id}/approve", response_model=PurchaseInvoiceResponse, summary="审核采购发票")
async def approve_purchase_invoice(
    invoice_id: int,
    rejection_reason: Optional[str] = Query(None, description="驳回原因"),
    current_user: User = Depends(get_current_user),
    tenant_id: int = Depends(get_current_tenant),
) -> PurchaseInvoiceResponse:
    """
    审核采购发票

    - **invoice_id**: 发票ID
    - **rejection_reason**: 驳回原因（可选，不填则通过）
    """
    return await PurchaseInvoiceService().approve_purchase_invoice(
        tenant_id=tenant_id,
        invoice_id=invoice_id,
        approved_by=current_user.id,
        rejection_reason=rejection_reason
    )


# ============ 应收管理 API ============

@router.post("/receivables", response_model=ReceivableResponse, summary="创建应收单")
async def create_receivable(
    receivable: ReceivableCreate,
    current_user: User = Depends(get_current_user),
    tenant_id: int = Depends(get_current_tenant),
) -> ReceivableResponse:
    """
    创建应收单

    - **receivable**: 应收单创建数据
    - **current_user**: 当前用户
    - **tenant_id**: 当前组织ID

    返回创建的应收单信息。
    """
    return await ReceivableService().create_receivable(
        tenant_id=tenant_id,
        receivable_data=receivable,
        created_by=current_user.id
    )


@router.get("/receivables", response_model=List[ReceivableListResponse], summary="获取应收单列表")
async def list_receivables(
    skip: int = Query(0, ge=0, description="跳过数量"),
    limit: int = Query(100, ge=1, le=1000, description="限制数量"),
    status: Optional[str] = Query(None, description="收款状态"),
    customer_id: Optional[int] = Query(None, description="客户ID"),
    due_date_start: Optional[str] = Query(None, description="到期日期开始（ISO格式）"),
    due_date_end: Optional[str] = Query(None, description="到期日期结束（ISO格式）"),
    current_user: User = Depends(get_current_user),
    tenant_id: int = Depends(get_current_tenant),
) -> List[ReceivableListResponse]:
    """
    获取应收单列表

    支持多种筛选条件的高级搜索。
    """
    from datetime import date

    # 转换日期参数
    due_date_start_dt = None
    due_date_end_dt = None

    if due_date_start:
        try:
            due_date_start_dt = date.fromisoformat(due_date_start)
        except ValueError:
            pass

    if due_date_end:
        try:
            due_date_end_dt = date.fromisoformat(due_date_end)
        except ValueError:
            pass

    return await ReceivableService().list_receivables(
        tenant_id=tenant_id,
        skip=skip,
        limit=limit,
        status=status,
        customer_id=customer_id,
        due_date_start=due_date_start_dt,
        due_date_end=due_date_end_dt,
    )


@router.get("/receivables/{receivable_id}", response_model=ReceivableResponse, summary="获取应收单详情")
async def get_receivable(
    receivable_id: int,
    current_user: User = Depends(get_current_user),
    tenant_id: int = Depends(get_current_tenant),
) -> ReceivableResponse:
    """
    根据ID获取应收单详情

    - **receivable_id**: 应收单ID
    """
    return await ReceivableService().get_receivable_by_id(
        tenant_id=tenant_id,
        receivable_id=receivable_id
    )


@router.post("/receivables/{receivable_id}/receipt", response_model=ReceivableResponse, summary="记录收款")
async def record_receipt(
    receivable_id: int,
    receipt: ReceiptRecordCreate,
    current_user: User = Depends(get_current_user),
    tenant_id: int = Depends(get_current_tenant),
) -> ReceivableResponse:
    """
    记录应收单收款

    - **receivable_id**: 应收单ID
    - **receipt**: 收款记录数据
    """
    return await ReceivableService().record_receipt(
        tenant_id=tenant_id,
        receivable_id=receivable_id,
        receipt_data=receipt,
        recorded_by=current_user.id
    )


@router.post("/receivables/{receivable_id}/approve", response_model=ReceivableResponse, summary="审核应收单")
async def approve_receivable(
    receivable_id: int,
    rejection_reason: Optional[str] = Query(None, description="驳回原因"),
    current_user: User = Depends(get_current_user),
    tenant_id: int = Depends(get_current_tenant),
) -> ReceivableResponse:
    """
    审核应收单

    - **receivable_id**: 应收单ID
    - **rejection_reason**: 驳回原因（可选，不填则通过）
    """
    return await ReceivableService().approve_receivable(
        tenant_id=tenant_id,
        receivable_id=receivable_id,
        approved_by=current_user.id,
        rejection_reason=rejection_reason
    )


# ============ BOM物料清单管理 API ============
# 注意：BOM管理已移至master_data APP
# 如需管理BOM，请使用master_data APP的API：/api/apps/master-data/materials/bom
# 本APP只提供基于BOM的业务功能（如物料需求计算）


# ============ 单据打印 API（工单快捷打印等） ============

from apps.kuaizhizao.services.print_service import DocumentPrintService
from fastapi.responses import HTMLResponse

@router.get("/work-orders/{id}/print", summary="打印工单")
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


# ============ 批量操作 API ============
# (批量操作路由在文件后续部分定义)


# ============ 销售预测管理 API ============

@router.post("/sales-forecasts", response_model=SalesForecastResponse, summary="创建销售预测")
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


@router.get("/sales-forecasts", response_model=SalesForecastListResult, summary="获取销售预测列表")
async def list_sales_forecasts(
    skip: int = Query(0, ge=0, description="跳过数量"),
    limit: int = Query(100, ge=1, le=1000, description="限制数量"),
    status: Optional[str] = Query(None, description="预测状态"),
    forecast_period: Optional[str] = Query(None, description="预测周期"),
    current_user: User = Depends(get_current_user),
    tenant_id: int = Depends(get_current_tenant),
) -> SalesForecastListResult:
    """
    获取销售预测列表

    支持多种筛选条件的高级搜索。
    返回格式：{ data: [...], total: number, success: true }
    """
    service = SalesForecastService()
    result = await service.list_sales_forecasts(
        tenant_id=tenant_id,
        skip=skip,
        limit=limit,
        status=status,
        forecast_period=forecast_period,
    )
    return SalesForecastListResult(**result)


@router.get("/sales-forecasts/{forecast_id}", response_model=SalesForecastResponse, summary="获取销售预测详情")
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


@router.post("/sales-forecasts/{forecast_id}/push-to-mrp", summary="下推到MRP运算")
async def push_sales_forecast_to_mrp(
    forecast_id: int = Path(..., description="销售预测ID"),
    planning_horizon: int = Query(12, ge=1, le=24, description="计划周期（月数）"),
    time_bucket: str = Query("week", description="时间粒度（week/month）"),
    current_user: User = Depends(get_current_user),
    tenant_id: int = Depends(get_current_tenant),
):
    """
    从销售预测下推到MRP运算
    
    自动执行MRP计算，生成物料需求计划
    
    - **forecast_id**: 销售预测ID
    - **planning_horizon**: 计划周期（月数，默认12个月）
    - **time_bucket**: 时间粒度（week/month，默认week）
    """
    from apps.kuaizhizao.services.sales_service import SalesForecastService
    
    service = SalesForecastService()
    result = await service.push_to_mrp(
        tenant_id=tenant_id,
        forecast_id=forecast_id,
        planning_horizon=planning_horizon,
        time_bucket=time_bucket,
        user_id=current_user.id
    )
    return JSONResponse(content=result, status_code=http_status.HTTP_200_OK)


@router.put("/sales-forecasts/{forecast_id}", response_model=SalesForecastResponse, summary="更新销售预测")
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


@router.delete("/sales-forecasts/{forecast_id}", summary="删除销售预测")
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
    # 验证预测存在
    await service.get_sales_forecast_by_id(tenant_id, forecast_id)
    # 删除预测（硬删除）
    from apps.kuaizhizao.models.sales_forecast import SalesForecast
    deleted = await SalesForecast.filter(tenant_id=tenant_id, id=forecast_id).delete()
    if deleted:
        return JSONResponse(content={"message": "销售预测删除成功"}, status_code=http_status.HTTP_200_OK)
    else:
        return JSONResponse(content={"message": "销售预测删除失败"}, status_code=http_status.HTTP_400_BAD_REQUEST)


@router.post("/sales-forecasts/{forecast_id}/submit", response_model=SalesForecastResponse, summary="提交销售预测")
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


@router.post("/sales-forecasts/{forecast_id}/approve", response_model=SalesForecastResponse, summary="审核销售预测")
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


@router.post("/sales-forecasts/{forecast_id}/items", response_model=SalesForecastItemResponse, summary="添加销售预测明细")
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


@router.get("/sales-forecasts/{forecast_id}/items", response_model=List[SalesForecastItemResponse], summary="获取销售预测明细")
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

@router.get("/production-pickings/{id}/print", summary="打印生产领料单")
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


@router.get("/finished-goods-receipts/{id}/print", summary="打印成品入库单")
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

@router.post("/work-orders/batch-create", response_model=BatchResponse, summary="批量创建工单")
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


@router.put("/work-orders/batch-update", response_model=BatchResponse, summary="批量更新工单")
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


@router.delete("/work-orders/batch-delete", response_model=BatchResponse, summary="批量删除工单")
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


@router.post("/sales-forecasts/batch-create", response_model=BatchResponse, summary="批量创建销售预测")
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


@router.delete("/sales-forecasts/batch-delete", response_model=BatchResponse, summary="批量删除销售预测")
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
        if forecast.status != "草稿":
            raise BusinessLogicError(f"销售预测 {forecast.id} 状态为 {forecast.status}，无法删除。只有草稿状态的销售预测才能删除。")
    
    result = await BatchOperationService().batch_delete(
        tenant_id=tenant_id,
        model_class=SalesForecast,
        record_ids=request.ids,
        validate_func=validate_sales_forecast
    )
    
    return BatchResponse(
        success=result["failed_count"] == 0,
        message=f"成功删除 {result['success_count']} 个销售预测，失败 {result['failure_count']} 个",
        data=result
    )


@router.post("/sales-forecasts/import", summary="批量导入销售预测")
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
        raise HTTPException(
            status_code=http_status.HTTP_422_UNPROCESSABLE_ENTITY,
            detail=str(e)
        )
    except Exception as e:
        logger.error(f"导入销售预测失败: {str(e)}")
        raise HTTPException(
            status_code=http_status.HTTP_500_INTERNAL_SERVER_ERROR,
            detail=f"导入失败: {str(e)}"
        )


@router.get("/sales-forecasts/export", response_class=FileResponse, summary="批量导出销售预测")
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
            raise HTTPException(
                status_code=http_status.HTTP_500_INTERNAL_SERVER_ERROR,
                detail="导出文件生成失败"
            )
        
        return FileResponse(
            path=file_path,
            filename=os.path.basename(file_path),
            media_type='application/vnd.ms-excel'
        )
                
    except Exception as e:
        logger.error(f"导出销售预测失败: {str(e)}")
        raise HTTPException(
            status_code=http_status.HTTP_500_INTERNAL_SERVER_ERROR,
            detail=f"导出失败: {str(e)}"
        )








# ============ 生产计划管理 API ============

# 此处原为废弃的MRP/LRP运算及结果查询接口，已移除。
# 统一使用 DemandComputationService 进行需求计算。


@router.get("/production-plans/planning-config", summary="获取计划管理配置")
async def get_planning_config(
    current_user: User = Depends(get_current_user),
    tenant_id: int = Depends(get_current_tenant),
):
    """
    获取计划管理相关配置，供前端展示当前模式。
    用于需求计算页展示「直连工单」或「经生产计划」的路径说明。
    """
    from infra.services.business_config_service import BusinessConfigService
    return await BusinessConfigService().get_planning_config(tenant_id)


@router.post("/production-plans", response_model=ProductionPlanResponse, summary="手动创建生产计划")
async def create_production_plan(
    plan_data: ProductionPlanCreate,
    current_user: User = Depends(get_current_user),
    tenant_id: int = Depends(get_current_tenant),
) -> ProductionPlanResponse:
    """
    手动创建生产计划
    
    允许用户手动录入计划基本信息和明细项。
    """
    return await ProductionPlanningService().create_production_plan(
        tenant_id=tenant_id,
        plan_data=plan_data,
        created_by=current_user.id
    )



@router.get("/production-plans", response_model=List[ProductionPlanListResponse], summary="获取生产计划列表")
async def list_production_plans(
    skip: int = Query(0, ge=0, description="跳过数量"),
    limit: int = Query(100, ge=1, le=1000, description="限制数量"),
    plan_type: Optional[str] = Query(None, description="计划类型（MRP/LRP）"),
    status: Optional[str] = Query(None, description="计划状态"),
    plan_code: Optional[str] = Query(None, description="计划编码"),
    current_user: User = Depends(get_current_user),
    tenant_id: int = Depends(get_current_tenant),
) -> List[ProductionPlanListResponse]:
    """
    获取生产计划列表

    支持多种筛选条件的高级搜索。
    """
    service = ProductionPlanningService()
    return await service.list_production_plans(
        tenant_id=tenant_id,
        skip=skip,
        limit=limit,
        plan_type=plan_type,
        status=status,
        plan_code=plan_code,
    )


@router.get("/production-plans/statistics", summary="获取生产计划统计信息")
async def get_production_plan_statistics(
    current_user: User = Depends(get_current_user),
    tenant_id: int = Depends(get_current_tenant),
):
    """获取生产计划统计信息"""
    return await ProductionPlanningService().get_production_plan_statistics(tenant_id)


@router.get("/production-plans/{plan_id}", response_model=ProductionPlanResponse, summary="获取生产计划详情")
async def get_production_plan(
    plan_id: int,
    current_user: User = Depends(get_current_user),
    tenant_id: int = Depends(get_current_tenant),
) -> ProductionPlanResponse:
    """
    根据ID获取生产计划详情

    - **plan_id**: 生产计划ID
    """
    return await ProductionPlanningService().get_production_plan_by_id(
        tenant_id=tenant_id,
        plan_id=plan_id
    )


@router.get("/production-plans/{plan_id}/items", response_model=List[ProductionPlanItemResponse], summary="获取生产计划明细")
async def get_production_plan_items(
    plan_id: int,
    current_user: User = Depends(get_current_user),
    tenant_id: int = Depends(get_current_tenant),
) -> List[ProductionPlanItemResponse]:
    """
    获取生产计划明细列表

    - **plan_id**: 生产计划ID
    """
    return await ProductionPlanningService().get_plan_items(
        tenant_id=tenant_id,
        plan_id=plan_id
    )


@router.post("/production-plans/{plan_id}/execute", response_model=ProductionPlanResponse, summary="执行生产计划")
async def execute_production_plan(
    plan_id: int,
    current_user: User = Depends(get_current_user),
    tenant_id: int = Depends(get_current_tenant),
) -> ProductionPlanResponse:
    """
    执行生产计划

    根据计划明细生成工单和采购订单

    - **plan_id**: 生产计划ID
    """
    return await ProductionPlanningService().execute_plan(
        tenant_id=tenant_id,
        plan_id=plan_id,
        executed_by=current_user.id
    )


@router.put("/production-plans/{plan_id}", response_model=ProductionPlanResponse, summary="更新生产计划")
async def update_production_plan(
    plan_id: int,
    plan_data: ProductionPlanUpdate,
    current_user: User = Depends(get_current_user),
    tenant_id: int = Depends(get_current_tenant),
) -> ProductionPlanResponse:
    """更新生产计划"""
    return await ProductionPlanningService().update_production_plan(
        tenant_id=tenant_id,
        plan_id=plan_id,
        plan_data=plan_data,
        updated_by=current_user.id
    )


@router.delete("/production-plans/{plan_id}", summary="删除生产计划")
async def delete_production_plan(
    plan_id: int,
    current_user: User = Depends(get_current_user),
    tenant_id: int = Depends(get_current_tenant),
):
    """删除生产计划"""
    await ProductionPlanningService().delete_production_plan(
        tenant_id=tenant_id,
        plan_id=plan_id,
        updated_by=current_user.id
    )
    return {"success": True, "message": "删除成功"}


@router.post("/production-plans/{plan_id}/push-to-work-orders", summary="生产计划转工单")
async def push_production_plan_to_work_orders(
    plan_id: int,
    current_user: User = Depends(get_current_user),
    tenant_id: int = Depends(get_current_tenant),
):
    """
    从生产计划下推到工单

    将生产计划中「建议行动=生产」的明细转为工单。
    设计文档约定：POST /apps/kuaizhizao/production-plans/{id}/push-to-work-orders
    """
    try:
        from apps.kuaizhizao.services.document_push_pull_service import DocumentPushPullService
        service = DocumentPushPullService()
        result = await service.push_document(
            tenant_id=tenant_id,
            source_type="production_plan",
            source_id=plan_id,
            target_type="work_order",
            push_params=None,
            created_by=current_user.id,
        )
        return result
    except Exception as e:
        from infra.exceptions.exceptions import NotFoundError, BusinessLogicError
        if isinstance(e, NotFoundError):
            raise HTTPException(status_code=http_status.HTTP_404_NOT_FOUND, detail=str(e))
        if isinstance(e, BusinessLogicError):
            raise HTTPException(status_code=http_status.HTTP_400_BAD_REQUEST, detail=str(e))
        logger.exception("生产计划转工单失败")
        raise HTTPException(
            status_code=http_status.HTTP_500_INTERNAL_SERVER_ERROR,
            detail=f"生产计划转工单失败: {str(e)}",
        )


# ============ 高级排产 API ============

@router.post("/scheduling/intelligent", response_model=IntelligentSchedulingResponse, summary="智能排产")
async def intelligent_scheduling(
    request: IntelligentSchedulingRequest,
    current_user: User = Depends(get_current_user),
    tenant_id: int = Depends(get_current_tenant),
) -> IntelligentSchedulingResponse:
    """
    智能排产
    
    根据多个约束条件（优先级、交期、工作中心能力、设备可用性等）进行智能排产。
    
    - **work_order_ids**: 工单ID列表（可选，如果不提供则对所有待排产工单进行排产）
    - **constraints**: 约束条件
        - priority_weight: 优先级权重（0-1）
        - due_date_weight: 交期权重（0-1）
        - capacity_weight: 产能权重（0-1）
        - setup_time_weight: 换线时间权重（0-1）
        - optimize_objective: 优化目标（min_makespan/min_total_time/min_setup_time）
    """
    service = AdvancedSchedulingService()
    result = await service.intelligent_scheduling(
        tenant_id=tenant_id,
        work_order_ids=request.work_order_ids,
        constraints=request.constraints.model_dump() if request.constraints else None,
        apply_results=request.apply_results,
        updated_by=current_user.id,
    )
    return IntelligentSchedulingResponse(**result)


@router.post("/scheduling/optimize", response_model=OptimizeScheduleResponse, summary="优化排产计划")
async def optimize_schedule(
    request: OptimizeScheduleRequest,
    current_user: User = Depends(get_current_user),
    tenant_id: int = Depends(get_current_tenant),
) -> OptimizeScheduleResponse:
    """
    优化排产计划
    
    对已有的排产计划进行优化，调整工单排产时间以优化目标函数。
    
    - **schedule_id**: 排产计划ID（可选）
    - **optimization_params**: 优化参数
        - max_iterations: 最大迭代次数
        - convergence_threshold: 收敛阈值
        - optimization_objective: 优化目标
    """
    service = AdvancedSchedulingService()
    result = await service.optimize_schedule(
        tenant_id=tenant_id,
        schedule_id=request.schedule_id,
        optimization_params=request.optimization_params.model_dump() if request.optimization_params else None
    )
    return OptimizeScheduleResponse(**result)


# ============ 采购订单管理 API ============
# 注意：采购订单API已移至 purchase.py，此处不再重复实现
# 请使用 /purchase-orders 路径访问采购订单API


# ============ 单据节点耗时统计 API ============
# 已迁移至 document_relations_legacy.py


# ============ 异常处理 API ============

@router.get("/exceptions/material-shortage", response_model=List[MaterialShortageExceptionListResponse], summary="获取缺料异常列表")
async def list_material_shortage_exceptions(
    work_order_id: Optional[int] = Query(None, description="工单ID"),
    status: Optional[str] = Query(None, description="状态"),
    alert_level: Optional[str] = Query(None, description="预警级别"),
    skip: int = Query(0, ge=0, description="跳过数量"),
    limit: int = Query(100, ge=1, le=1000, description="限制数量"),
    current_user: User = Depends(get_current_user),
    tenant_id: int = Depends(get_current_tenant),
) -> List[MaterialShortageExceptionListResponse]:
    """
    获取缺料异常列表

    支持按工单ID、状态、预警级别筛选。
    """
    return await exception_service.list_material_shortage_exceptions(
        tenant_id=tenant_id,
        work_order_id=work_order_id,
        status=status,
        alert_level=alert_level,
        skip=skip,
        limit=limit,
    )


@router.post("/exceptions/material-shortage/{exception_id}/handle", response_model=MaterialShortageExceptionResponse, summary="处理缺料异常")
async def handle_material_shortage_exception(
    exception_id: int = Path(..., description="异常记录ID"),
    action: str = Query(..., description="处理操作（purchase/substitute/resolve/cancel）"),
    alternative_material_id: Optional[int] = Query(None, description="替代物料ID"),
    remarks: Optional[str] = Query(None, description="备注"),
    current_user: User = Depends(get_current_user),
    tenant_id: int = Depends(get_current_tenant),
) -> MaterialShortageExceptionResponse:
    """
    处理缺料异常
    """
    return await exception_service.handle_material_shortage_exception(
        tenant_id=tenant_id,
        exception_id=exception_id,
        handled_by=current_user.id,
        action=action,
        alternative_material_id=alternative_material_id,
        remarks=remarks,
    )


@router.post("/work-orders/{work_order_id}/detect-shortage", response_model=List[MaterialShortageExceptionResponse], summary="检测工单缺料")
async def detect_work_order_shortage(
    work_order_id: int = Path(..., description="工单ID"),
    current_user: User = Depends(get_current_user),
    tenant_id: int = Depends(get_current_tenant),
) -> List[MaterialShortageExceptionResponse]:
    """
    检测工单缺料并创建缺料异常记录
    """
    return await exception_service.detect_material_shortage(
        tenant_id=tenant_id,
        work_order_id=work_order_id,
    )


@router.get("/exceptions/delivery-delay", response_model=List[DeliveryDelayExceptionListResponse], summary="获取延期异常列表")
async def list_delivery_delay_exceptions(
    work_order_id: Optional[int] = Query(None, description="工单ID"),
    status: Optional[str] = Query(None, description="状态"),
    alert_level: Optional[str] = Query(None, description="预警级别"),
    skip: int = Query(0, ge=0, description="跳过数量"),
    limit: int = Query(100, ge=1, le=1000, description="限制数量"),
    current_user: User = Depends(get_current_user),
    tenant_id: int = Depends(get_current_tenant),
) -> List[DeliveryDelayExceptionListResponse]:
    """
    获取延期异常列表

    支持按工单ID、状态、预警级别筛选。
    """
    return await exception_service.list_delivery_delay_exceptions(
        tenant_id=tenant_id,
        work_order_id=work_order_id,
        status=status,
        alert_level=alert_level,
        skip=skip,
        limit=limit,
    )


@router.post("/exceptions/delivery-delay/{exception_id}/handle", response_model=DeliveryDelayExceptionResponse, summary="处理延期异常")
async def handle_delivery_delay_exception(
    exception_id: int = Path(..., description="异常记录ID"),
    action: str = Query(..., description="处理操作（adjust_plan/increase_resources/expedite/resolve/cancel）"),
    remarks: Optional[str] = Query(None, description="备注"),
    current_user: User = Depends(get_current_user),
    tenant_id: int = Depends(get_current_tenant),
) -> DeliveryDelayExceptionResponse:
    """
    处理延期异常
    """
    return await exception_service.handle_delivery_delay_exception(
        tenant_id=tenant_id,
        exception_id=exception_id,
        handled_by=current_user.id,
        action=action,
        remarks=remarks,
    )


@router.post("/work-orders/{work_order_id}/detect-delay", response_model=List[DeliveryDelayExceptionResponse], summary="检测工单延期")
async def detect_work_order_delay(
    work_order_id: int = Path(..., description="工单ID"),
    days_threshold: int = Query(0, description="延期天数阈值"),
    current_user: User = Depends(get_current_user),
    tenant_id: int = Depends(get_current_tenant),
) -> List[DeliveryDelayExceptionResponse]:
    """
    检测工单延期并创建延期异常记录

    - **work_order_id**: 工单ID
    - **days_threshold**: 延期天数阈值
    """
    return await exception_service.detect_delivery_delay(
        tenant_id=tenant_id,
        work_order_id=work_order_id,
        days_threshold=days_threshold,
    )


@router.get("/exceptions/quality", response_model=List[QualityExceptionListResponse], summary="获取质量异常列表")
async def list_quality_exceptions(
    exception_type: Optional[str] = Query(None, description="异常类型"),
    work_order_id: Optional[int] = Query(None, description="工单ID"),
    status: Optional[str] = Query(None, description="状态"),
    severity: Optional[str] = Query(None, description="严重程度"),
    skip: int = Query(0, ge=0, description="跳过数量"),
    limit: int = Query(100, ge=1, le=1000, description="限制数量"),
    current_user: User = Depends(get_current_user),
    tenant_id: int = Depends(get_current_tenant),
) -> List[QualityExceptionListResponse]:
    """
    获取质量异常列表

    支持按异常类型、工单ID、状态、严重程度筛选。
    """
    return await exception_service.list_quality_exceptions(
        tenant_id=tenant_id,
        exception_type=exception_type,
        work_order_id=work_order_id,
        status=status,
        severity=severity,
        skip=skip,
        limit=limit,
    )


@router.post("/exceptions/quality/{exception_id}/handle", response_model=QualityExceptionResponse, summary="处理质量异常")
async def handle_quality_exception(
    exception_id: int = Path(..., description="异常记录ID"),
    action: str = Query(..., description="处理操作（investigate/correct/close/cancel）"),
    root_cause: Optional[str] = Query(None, description="根本原因"),
    corrective_action: Optional[str] = Query(None, description="纠正措施"),
    preventive_action: Optional[str] = Query(None, description="预防措施"),
    responsible_person_id: Optional[int] = Query(None, description="责任人ID"),
    responsible_person_name: Optional[str] = Query(None, description="责任人姓名"),
    verification_result: Optional[str] = Query(None, description="验证结果"),
    remarks: Optional[str] = Query(None, description="备注"),
    current_user: User = Depends(get_current_user),
    tenant_id: int = Depends(get_current_tenant),
) -> QualityExceptionResponse:
    """
    处理质量异常
    """
    return await exception_service.handle_quality_exception(
        tenant_id=tenant_id,
        exception_id=exception_id,
        handled_by=current_user.id,
        action=action,
        root_cause=root_cause,
        corrective_action=corrective_action,
        preventive_action=preventive_action,
        responsible_person_id=responsible_person_id,
        responsible_person_name=responsible_person_name,
        verification_result=verification_result,
        remarks=remarks,
    )


@router.get("/exceptions/statistics", summary="获取异常统计分析")
async def get_exception_statistics(
    date_start: Optional[str] = Query(None, description="开始日期（YYYY-MM-DD）"),
    date_end: Optional[str] = Query(None, description="结束日期（YYYY-MM-DD）"),
    current_user: User = Depends(get_current_user),
    tenant_id: int = Depends(get_current_tenant),
) -> dict:
    """
    获取异常统计分析

    包括缺料异常、延期异常、质量异常的统计信息。
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
    
    return await exception_service.get_exception_statistics(
        tenant_id=tenant_id,
        date_start=date_start_dt,
        date_end=date_end_dt,
    )


@router.post("/exceptions/detect", summary="手动触发异常检测")
async def trigger_exception_detection(
    work_order_id: Optional[int] = Query(None, description="工单ID（可选，如果指定则只检测该工单）"),
    current_user: User = Depends(get_current_user),
    tenant_id: int = Depends(get_current_tenant),
) -> dict:
    """
    手动触发异常检测

    检测缺料异常和延期异常，并创建异常记录。
    支持检测指定工单或所有工单。
    
    - **work_order_id**: 工单ID（可选，如果指定则只检测该工单）
    """
    try:
        from core.inngest.client import inngest_client
        from inngest import Event
        
        # 发送异常检测事件
        await inngest_client.send(
            Event(
                name="exception/detect",
                data={
                    "tenant_id": tenant_id,
                    "work_order_id": work_order_id,
                }
            )
        )
        
        return {
            "success": True,
            "message": "异常检测已触发",
            "work_order_id": work_order_id,
        }
    except Exception as e:
        logger.error(f"触发异常检测失败: {e}")
        raise HTTPException(
            status_code=http_status.HTTP_500_INTERNAL_SERVER_ERROR,
            detail=f"触发异常检测失败: {str(e)}"
        )


# ============ 异常处理流程 API ============

@router.post("/exceptions/process/start", response_model=ExceptionProcessRecordResponse, summary="启动异常处理流程")
async def start_exception_process(
    data: ExceptionProcessRecordCreate,
    current_user: User = Depends(get_current_user),
    tenant_id: int = Depends(get_current_tenant),
) -> ExceptionProcessRecordResponse:
    """
    启动异常处理流程

    - **exception_type**: 异常类型（material_shortage/delivery_delay/quality）
    - **exception_id**: 异常记录ID
    - **assigned_to**: 分配给（用户ID，可选）
    - **process_config**: 流程配置（JSON格式，可选）
    - **remarks**: 备注（可选）
    """
    try:
        return await exception_process_service.start_process(
            tenant_id=tenant_id,
            data=data,
            current_user_id=current_user.id,
        )
    except ValidationError as e:
        raise HTTPException(status_code=400, detail=str(e))
    except NotFoundError as e:
        raise HTTPException(status_code=404, detail=str(e))


@router.get("/exceptions/process", response_model=List[ExceptionProcessRecordListResponse], summary="获取异常处理流程列表")
async def list_exception_processes(
    skip: int = Query(0, ge=0, description="跳过数量"),
    limit: int = Query(100, ge=1, le=1000, description="限制数量"),
    exception_type: Optional[str] = Query(None, description="异常类型筛选"),
    exception_id: Optional[int] = Query(None, description="异常记录ID筛选"),
    process_status: Optional[str] = Query(None, description="处理状态筛选"),
    assigned_to: Optional[int] = Query(None, description="分配给筛选"),
    current_user: User = Depends(get_current_user),
    tenant_id: int = Depends(get_current_tenant),
) -> List[ExceptionProcessRecordListResponse]:
    """
    获取异常处理流程列表

    - **skip**: 跳过数量
    - **limit**: 限制数量
    - **exception_type**: 异常类型筛选
    - **exception_id**: 异常记录ID筛选
    - **process_status**: 处理状态筛选
    - **assigned_to**: 分配给筛选
    """
    try:
        return await exception_process_service.list_process_records(
            tenant_id=tenant_id,
            exception_type=exception_type,
            exception_id=exception_id,
            process_status=process_status,
            assigned_to=assigned_to,
            skip=skip,
            limit=limit,
        )
    except Exception as e:
        logger.error(f"获取异常处理流程列表失败: {e}")
        raise HTTPException(status_code=500, detail=str(e))


@router.get("/exceptions/process/{process_record_id}", response_model=ExceptionProcessRecordDetailResponse, summary="获取异常处理流程详情")
async def get_exception_process(
    process_record_id: int = Path(..., description="处理记录ID"),
    current_user: User = Depends(get_current_user),
    tenant_id: int = Depends(get_current_tenant),
) -> ExceptionProcessRecordDetailResponse:
    """
    获取异常处理流程详情

    - **process_record_id**: 处理记录ID

    返回异常处理流程详情，包含处理历史记录。
    """
    try:
        return await exception_process_service.get_process_record(
            tenant_id=tenant_id,
            process_record_id=process_record_id,
        )
    except NotFoundError as e:
        raise HTTPException(status_code=404, detail=str(e))


@router.post("/exceptions/process/{process_record_id}/assign", response_model=ExceptionProcessRecordResponse, summary="分配异常处理流程")
async def assign_exception_process(
    process_record_id: int = Path(..., description="处理记录ID"),
    data: ExceptionProcessAssignRequest = Body(...),
    current_user: User = Depends(get_current_user),
    tenant_id: int = Depends(get_current_tenant),
) -> ExceptionProcessRecordResponse:
    """
    分配异常处理流程

    - **process_record_id**: 处理记录ID
    - **assigned_to**: 分配给（用户ID）
    - **comment**: 操作说明（可选）
    """
    try:
        return await exception_process_service.assign_process(
            tenant_id=tenant_id,
            process_record_id=process_record_id,
            data=data,
            current_user_id=current_user.id,
        )
    except ValidationError as e:
        raise HTTPException(status_code=400, detail=str(e))
    except NotFoundError as e:
        raise HTTPException(status_code=404, detail=str(e))


@router.post("/exceptions/process/{process_record_id}/step-transition", response_model=ExceptionProcessRecordResponse, summary="异常处理步骤流转")
async def transition_exception_process_step(
    process_record_id: int = Path(..., description="处理记录ID"),
    data: ExceptionProcessStepTransitionRequest = Body(...),
    current_user: User = Depends(get_current_user),
    tenant_id: int = Depends(get_current_tenant),
) -> ExceptionProcessRecordResponse:
    """
    异常处理步骤流转

    - **process_record_id**: 处理记录ID
    - **to_step**: 目标步骤
    - **comment**: 操作说明（可选）
    """
    try:
        return await exception_process_service.transition_step(
            tenant_id=tenant_id,
            process_record_id=process_record_id,
            data=data,
            current_user_id=current_user.id,
        )
    except ValidationError as e:
        raise HTTPException(status_code=400, detail=str(e))
    except NotFoundError as e:
        raise HTTPException(status_code=404, detail=str(e))


@router.post("/exceptions/process/{process_record_id}/resolve", response_model=ExceptionProcessRecordResponse, summary="解决异常处理流程")
async def resolve_exception_process(
    process_record_id: int = Path(..., description="处理记录ID"),
    data: ExceptionProcessResolveRequest = Body(...),
    current_user: User = Depends(get_current_user),
    tenant_id: int = Depends(get_current_tenant),
) -> ExceptionProcessRecordResponse:
    """
    解决异常处理流程

    - **process_record_id**: 处理记录ID
    - **comment**: 操作说明（可选）
    - **verification_result**: 验证结果（可选）
    """
    try:
        return await exception_process_service.resolve_process(
            tenant_id=tenant_id,
            process_record_id=process_record_id,
            data=data,
            current_user_id=current_user.id,
        )
    except ValidationError as e:
        raise HTTPException(status_code=400, detail=str(e))
    except NotFoundError as e:
        raise HTTPException(status_code=404, detail=str(e))


@router.post("/exceptions/process/{process_record_id}/cancel", response_model=ExceptionProcessRecordResponse, summary="取消异常处理流程")
async def cancel_exception_process(
    process_record_id: int = Path(..., description="处理记录ID"),
    comment: Optional[str] = Body(None, description="取消说明"),
    current_user: User = Depends(get_current_user),
    tenant_id: int = Depends(get_current_tenant),
) -> ExceptionProcessRecordResponse:
    """
    取消异常处理流程

    - **process_record_id**: 处理记录ID
    - **comment**: 取消说明（可选）
    """
    try:
        return await exception_process_service.cancel_process(
            tenant_id=tenant_id,
            process_record_id=process_record_id,
            current_user_id=current_user.id,
            comment=comment,
        )
    except ValidationError as e:
        raise HTTPException(status_code=400, detail=str(e))
    except NotFoundError as e:
        raise HTTPException(status_code=404, detail=str(e))


# ============ 报表 API ============

@router.get("/reports/inventory", summary="获取库存报表")
async def get_inventory_report(
    report_type: str = Query("summary", description="报表类型（summary/turnover/abc/slow_moving）"),
    date_start: Optional[str] = Query(None, description="开始日期（YYYY-MM-DD）"),
    date_end: Optional[str] = Query(None, description="结束日期（YYYY-MM-DD）"),
    warehouse_id: Optional[int] = Query(None, description="仓库ID"),
    current_user: User = Depends(get_current_user),
    tenant_id: int = Depends(get_current_tenant),
) -> dict:
    """
    获取库存报表数据

    支持多种报表类型：
    - summary: 库存状况分析
    - turnover: 库存周转率报表
    - abc: ABC分析报表
    - slow_moving: 呆滞料分析报表
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

    return await report_service.get_inventory_report(
        tenant_id=tenant_id,
        report_type=report_type,
        date_start=date_start_dt,
        date_end=date_end_dt,
        warehouse_id=warehouse_id,
    )


@router.get("/reports/production", summary="获取生产报表")
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


@router.get("/reports/quality", summary="获取质量报表")
async def get_quality_report(
    report_type: str = Query("analysis", description="报表类型（analysis/defect/pass_rate/trend）"),
    date_start: Optional[str] = Query(None, description="开始日期（YYYY-MM-DD）"),
    date_end: Optional[str] = Query(None, description="结束日期（YYYY-MM-DD）"),
    material_id: Optional[int] = Query(None, description="物料ID"),
    current_user: User = Depends(get_current_user),
    tenant_id: int = Depends(get_current_tenant),
) -> dict:
    """
    获取质量报表数据

    支持多种报表类型：
    - analysis: 质量分析报告
    - defect: 不良品统计报表
    - pass_rate: 检验合格率报表
    - trend: 质量趋势分析报表

    - **report_type**: 报表类型
    - **date_start**: 开始日期（可选）
    - **date_end**: 结束日期（可选）
    - **material_id**: 物料ID（可选）
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

    return await report_service.get_quality_report(
        tenant_id=tenant_id,
        report_type=report_type,
        date_start=date_start_dt,
        date_end=date_end_dt,
        material_id=material_id,
    )


# ============ 库存盘点 API ============

@router.post("/stocktakings", response_model=StocktakingResponse, summary="创建库存盘点单")
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
        raise HTTPException(status_code=400, detail=str(e))
    except Exception as e:
        raise HTTPException(status_code=500, detail=f"创建盘点单失败: {str(e)}")


@router.get("/stocktakings", response_model=StocktakingListResponse, summary="获取库存盘点单列表")
async def list_stocktakings(
    skip: int = Query(0, ge=0, description="跳过数量"),
    limit: int = Query(100, ge=1, le=1000, description="限制数量"),
    code: Optional[str] = Query(None, description="盘点单号（模糊搜索）"),
    warehouse_id: Optional[int] = Query(None, description="仓库ID"),
    status: Optional[str] = Query(None, description="状态"),
    stocktaking_type: Optional[str] = Query(None, description="盘点类型"),
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
    )


@router.get("/stocktakings/{stocktaking_id}", response_model=StocktakingWithItemsResponse, summary="获取库存盘点单详情")
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
        raise HTTPException(status_code=404, detail=str(e))


@router.put("/stocktakings/{stocktaking_id}", response_model=StocktakingResponse, summary="更新库存盘点单")
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
        raise HTTPException(status_code=404, detail=str(e))
    except ValidationError as e:
        raise HTTPException(status_code=400, detail=str(e))


@router.post("/stocktakings/{stocktaking_id}/start", response_model=StocktakingResponse, summary="开始盘点")
async def start_stocktaking(
    stocktaking_id: int,
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
            started_by=current_user.id
        )
    except NotFoundError as e:
        raise HTTPException(status_code=404, detail=str(e))
    except ValidationError as e:
        raise HTTPException(status_code=400, detail=str(e))


@router.post("/stocktakings/{stocktaking_id}/items", response_model=StocktakingItemResponse, summary="添加盘点明细")
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
        raise HTTPException(status_code=404, detail=str(e))
    except ValidationError as e:
        raise HTTPException(status_code=400, detail=str(e))


@router.put("/stocktakings/{stocktaking_id}/items/{item_id}", response_model=StocktakingItemResponse, summary="更新盘点明细")
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
        raise HTTPException(status_code=404, detail=str(e))
    except ValidationError as e:
        raise HTTPException(status_code=400, detail=str(e))


@router.post("/stocktakings/{stocktaking_id}/items/{item_id}/execute", response_model=StocktakingItemResponse, summary="执行盘点明细")
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
        raise HTTPException(status_code=404, detail=str(e))
    except ValidationError as e:
        raise HTTPException(status_code=400, detail=str(e))


@router.post("/stocktakings/{stocktaking_id}/adjust", response_model=StocktakingResponse, summary="处理盘点差异")
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
        raise HTTPException(status_code=404, detail=str(e))
    except ValidationError as e:
        raise HTTPException(status_code=400, detail=str(e))


@router.delete("/stocktakings/{stocktaking_id}", status_code=http_status.HTTP_204_NO_CONTENT, summary="删除盘点单")
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

@router.post("/inventory-transfers", response_model=InventoryTransferResponse, summary="创建库存调拨单")
async def create_inventory_transfer(
    transfer: InventoryTransferCreate,
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
        raise HTTPException(status_code=400, detail=str(e))
    except Exception as e:
        raise HTTPException(status_code=500, detail=f"创建调拨单失败: {str(e)}")


@router.get("/inventory-transfers", response_model=InventoryTransferListResponse, summary="获取库存调拨单列表")
async def list_inventory_transfers(
    skip: int = Query(0, ge=0, description="跳过数量"),
    limit: int = Query(100, ge=1, le=1000, description="限制数量"),
    code: Optional[str] = Query(None, description="调拨单号（模糊搜索）"),
    from_warehouse_id: Optional[int] = Query(None, description="调出仓库ID"),
    to_warehouse_id: Optional[int] = Query(None, description="调入仓库ID"),
    status: Optional[str] = Query(None, description="状态"),
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
    )


@router.get("/inventory-transfers/{transfer_id}", response_model=InventoryTransferWithItemsResponse, summary="获取库存调拨单详情")
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
        raise HTTPException(status_code=404, detail=str(e))


@router.put("/inventory-transfers/{transfer_id}", response_model=InventoryTransferResponse, summary="更新库存调拨单")
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
        raise HTTPException(status_code=404, detail=str(e))
    except ValidationError as e:
        raise HTTPException(status_code=400, detail=str(e))


@router.post("/inventory-transfers/{transfer_id}/items", response_model=InventoryTransferItemResponse, summary="添加调拨明细")
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
        raise HTTPException(status_code=404, detail=str(e))
    except ValidationError as e:
        raise HTTPException(status_code=400, detail=str(e))


@router.put("/inventory-transfers/{transfer_id}/items/{item_id}", response_model=InventoryTransferItemResponse, summary="更新调拨明细")
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
        raise HTTPException(status_code=404, detail=str(e))
    except ValidationError as e:
        raise HTTPException(status_code=400, detail=str(e))


@router.post("/inventory-transfers/{transfer_id}/execute", response_model=InventoryTransferResponse, summary="执行调拨")
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
        raise HTTPException(status_code=404, detail=str(e))
    except ValidationError as e:
        raise HTTPException(status_code=400, detail=str(e))


@router.delete("/inventory-transfers/{transfer_id}", status_code=http_status.HTTP_204_NO_CONTENT, summary="删除调拨单")
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


# ============ 组装单 API ============

@router.post("/assembly-orders", response_model=AssemblyOrderResponse, summary="创建组装单")
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
        raise HTTPException(status_code=400, detail=str(e))
    except BusinessLogicError as e:
        raise HTTPException(status_code=400, detail=str(e))


@router.get("/assembly-orders", response_model=AssemblyOrderListResponse, summary="获取组装单列表")
async def list_assembly_orders(
    skip: int = Query(0, ge=0, description="跳过数量"),
    limit: int = Query(100, ge=1, le=1000, description="限制数量"),
    code: Optional[str] = Query(None, description="组装单号（模糊搜索）"),
    warehouse_id: Optional[int] = Query(None, description="仓库ID"),
    status: Optional[str] = Query(None, description="状态"),
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
    )


@router.get("/assembly-orders/{order_id}", response_model=AssemblyOrderWithItemsResponse, summary="获取组装单详情")
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
        raise HTTPException(status_code=404, detail=str(e))


@router.put("/assembly-orders/{order_id}", response_model=AssemblyOrderResponse, summary="更新组装单")
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
        raise HTTPException(status_code=404, detail=str(e))
    except ValidationError as e:
        raise HTTPException(status_code=400, detail=str(e))


@router.post("/assembly-orders/{order_id}/items", response_model=AssemblyOrderItemResponse, summary="添加组装明细")
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
        raise HTTPException(status_code=404, detail=str(e))
    except ValidationError as e:
        raise HTTPException(status_code=400, detail=str(e))


@router.put("/assembly-orders/{order_id}/items/{item_id}", response_model=AssemblyOrderItemResponse, summary="更新组装明细")
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
        raise HTTPException(status_code=404, detail=str(e))
    except ValidationError as e:
        raise HTTPException(status_code=400, detail=str(e))


@router.delete("/assembly-orders/{order_id}", status_code=http_status.HTTP_204_NO_CONTENT, summary="删除组装单")
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


@router.post("/assembly-orders/{order_id}/execute", response_model=AssemblyOrderResponse, summary="执行组装")
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
        raise HTTPException(status_code=404, detail=str(e))
    except ValidationError as e:
        raise HTTPException(status_code=400, detail=str(e))


# ============ 拆卸单 API ============

@router.post("/disassembly-orders", response_model=DisassemblyOrderResponse, summary="创建拆卸单")
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
        raise HTTPException(status_code=400, detail=str(e))
    except BusinessLogicError as e:
        raise HTTPException(status_code=400, detail=str(e))


@router.get("/disassembly-orders", response_model=DisassemblyOrderListResponse, summary="获取拆卸单列表")
async def list_disassembly_orders(
    skip: int = Query(0, ge=0, description="跳过数量"),
    limit: int = Query(100, ge=1, le=1000, description="限制数量"),
    code: Optional[str] = Query(None, description="拆卸单号（模糊搜索）"),
    warehouse_id: Optional[int] = Query(None, description="仓库ID"),
    status: Optional[str] = Query(None, description="状态"),
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
    )


@router.get("/disassembly-orders/{order_id}", response_model=DisassemblyOrderWithItemsResponse, summary="获取拆卸单详情")
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
        raise HTTPException(status_code=404, detail=str(e))


@router.put("/disassembly-orders/{order_id}", response_model=DisassemblyOrderResponse, summary="更新拆卸单")
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
        raise HTTPException(status_code=404, detail=str(e))
    except ValidationError as e:
        raise HTTPException(status_code=400, detail=str(e))


@router.post("/disassembly-orders/{order_id}/items", response_model=DisassemblyOrderItemResponse, summary="添加拆卸明细")
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
        raise HTTPException(status_code=404, detail=str(e))
    except ValidationError as e:
        raise HTTPException(status_code=400, detail=str(e))


@router.put("/disassembly-orders/{order_id}/items/{item_id}", response_model=DisassemblyOrderItemResponse, summary="更新拆卸明细")
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
        raise HTTPException(status_code=404, detail=str(e))
    except ValidationError as e:
        raise HTTPException(status_code=400, detail=str(e))


@router.delete("/disassembly-orders/{order_id}", status_code=http_status.HTTP_204_NO_CONTENT, summary="删除拆卸单")
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


@router.post("/disassembly-orders/{order_id}/execute", response_model=DisassemblyOrderResponse, summary="执行拆卸")
async def execute_disassembly_order(
    order_id: int,
    current_user: User = Depends(get_current_user),
    tenant_id: int = Depends(get_current_tenant),
) -> DisassemblyOrderResponse:
    """执行拆卸（更新明细状态，TODO: 调用库存服务）"""
    try:
        return await disassembly_order_service.execute_disassembly_order(
            tenant_id=tenant_id,
            order_id=order_id,
            executed_by=current_user.id
        )
    except NotFoundError as e:
        raise HTTPException(status_code=404, detail=str(e))
    except ValidationError as e:
        raise HTTPException(status_code=400, detail=str(e))


# ==================== 工单委外管理 API ====================

@router.post("/outsource-work-orders", response_model=OutsourceWorkOrderResponse, summary="创建工单委外")
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
        raise HTTPException(status_code=400, detail=str(e))
    except NotFoundError as e:
        raise HTTPException(status_code=404, detail=str(e))


@router.get("/outsource-work-orders", response_model=OutsourceWorkOrderListResponse, summary="获取工单委外列表")
async def list_outsource_work_orders(
    skip: int = Query(0, ge=0, description="跳过数量"),
    limit: int = Query(100, ge=1, le=1000, description="限制数量"),
    status: Optional[str] = Query(None, description="状态筛选"),
    supplier_id: Optional[int] = Query(None, description="供应商ID筛选"),
    product_id: Optional[int] = Query(None, description="产品ID筛选"),
    keyword: Optional[str] = Query(None, description="关键词搜索"),
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
        return await outsource_work_order_service.list_outsource_work_orders(
            tenant_id=tenant_id,
            skip=skip,
            limit=limit,
            status=status,
            supplier_id=supplier_id,
            product_id=product_id,
            keyword=keyword,
        )
    except Exception as e:
        logger.error(f"获取工单委外列表失败: {e}")
        raise HTTPException(status_code=500, detail=str(e))


@router.get("/outsource-work-orders/{work_order_id}", response_model=OutsourceWorkOrderResponse, summary="获取工单委外详情")
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
        raise HTTPException(status_code=404, detail=str(e))


@router.put("/outsource-work-orders/{work_order_id}", response_model=OutsourceWorkOrderResponse, summary="更新工单委外")
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
        raise HTTPException(status_code=404, detail=str(e))
    except ValidationError as e:
        raise HTTPException(status_code=400, detail=str(e))


@router.delete("/outsource-work-orders/{work_order_id}", summary="删除工单委外")
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
        raise HTTPException(status_code=404, detail=str(e))
    except BusinessLogicError as e:
        raise HTTPException(status_code=400, detail=str(e))


# ==================== 委外发料 API ====================

@router.post("/outsource-material-issues", response_model=OutsourceMaterialIssueResponse, summary="创建委外发料单")
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
        raise HTTPException(status_code=400, detail=str(e))
    except NotFoundError as e:
        raise HTTPException(status_code=404, detail=str(e))


@router.get("/outsource-material-issues", response_model=List[OutsourceMaterialIssueResponse], summary="获取委外发料单列表")
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
        raise HTTPException(status_code=500, detail=str(e))


@router.get("/outsource-material-issues/{issue_id}", response_model=OutsourceMaterialIssueResponse, summary="获取委外发料单详情")
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
        raise HTTPException(status_code=404, detail=str(e))


@router.post("/outsource-material-issues/{issue_id}/complete", response_model=OutsourceMaterialIssueResponse, summary="完成委外发料")
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
        raise HTTPException(status_code=404, detail=str(e))
    except BusinessLogicError as e:
        raise HTTPException(status_code=400, detail=str(e))


# ==================== 委外收货 API ====================

@router.post("/outsource-material-receipts", response_model=OutsourceMaterialReceiptResponse, summary="创建委外收货单")
async def create_outsource_material_receipt(
    data: OutsourceMaterialReceiptCreate,
    current_user: User = Depends(get_current_user),
    tenant_id: int = Depends(get_current_tenant),
) -> OutsourceMaterialReceiptResponse:
    """
    创建委外收货单

    - **data**: 委外收货创建数据
    - **current_user**: 当前用户
    - **tenant_id**: 当前组织ID

    返回创建的委外收货单信息。
    """
    try:
        return await outsource_material_receipt_service.create_material_receipt(
            tenant_id=tenant_id,
            receipt_data=data,
            created_by=current_user.id
        )
    except ValidationError as e:
        raise HTTPException(status_code=400, detail=str(e))
    except NotFoundError as e:
        raise HTTPException(status_code=404, detail=str(e))


@router.get("/outsource-material-receipts", response_model=List[OutsourceMaterialReceiptResponse], summary="获取委外收货单列表")
async def list_outsource_material_receipts(
    skip: int = Query(0, ge=0, description="跳过数量"),
    limit: int = Query(100, ge=1, le=1000, description="限制数量"),
    outsource_work_order_id: Optional[int] = Query(None, description="工单委外ID筛选"),
    status: Optional[str] = Query(None, description="状态筛选"),
    keyword: Optional[str] = Query(None, description="关键词搜索"),
    current_user: User = Depends(get_current_user),
    tenant_id: int = Depends(get_current_tenant),
) -> List[OutsourceMaterialReceiptResponse]:
    """
    获取委外收货单列表

    - **skip**: 跳过数量
    - **limit**: 限制数量
    - **outsource_work_order_id**: 工单委外ID筛选
    - **status**: 状态筛选
    - **keyword**: 关键词搜索
    - **current_user**: 当前用户
    - **tenant_id**: 当前组织ID

    返回委外收货单列表。
    """
    try:
        return await outsource_material_receipt_service.list_material_receipts(
            tenant_id=tenant_id,
            skip=skip,
            limit=limit,
            outsource_work_order_id=outsource_work_order_id,
            status=status,
            keyword=keyword,
        )
    except Exception as e:
        logger.error(f"获取委外收货单列表失败: {e}")
        raise HTTPException(status_code=500, detail=str(e))


@router.get("/outsource-material-receipts/{receipt_id}", response_model=OutsourceMaterialReceiptResponse, summary="获取委外收货单详情")
async def get_outsource_material_receipt(
    receipt_id: int = Path(..., description="委外收货单ID"),
    current_user: User = Depends(get_current_user),
    tenant_id: int = Depends(get_current_tenant),
) -> OutsourceMaterialReceiptResponse:
    """
    获取委外收货单详情

    - **receipt_id**: 委外收货单ID
    - **current_user**: 当前用户
    - **tenant_id**: 当前组织ID

    返回委外收货单详情。
    """
    try:
        return await outsource_material_receipt_service.get_material_receipt(
            tenant_id=tenant_id,
            receipt_id=receipt_id
        )
    except NotFoundError as e:
        raise HTTPException(status_code=404, detail=str(e))


@router.post("/outsource-material-receipts/{receipt_id}/complete", response_model=OutsourceMaterialReceiptResponse, summary="完成委外收货")
async def complete_outsource_material_receipt(
    receipt_id: int = Path(..., description="委外收货单ID"),
    current_user: User = Depends(get_current_user),
    tenant_id: int = Depends(get_current_tenant),
) -> OutsourceMaterialReceiptResponse:
    """
    完成委外收货（更新状态为completed，记录收货时间和收货人）

    - **receipt_id**: 委外收货单ID
    - **current_user**: 当前用户
    - **tenant_id**: 当前组织ID

    返回更新后的委外收货单信息。
    """
    try:
        return await outsource_material_receipt_service.complete_material_receipt(
            tenant_id=tenant_id,
            receipt_id=receipt_id,
            completed_by=current_user.id
        )
    except NotFoundError as e:
        raise HTTPException(status_code=404, detail=str(e))
    except BusinessLogicError as e:
        raise HTTPException(status_code=400, detail=str(e))


# ==================== 供应商协同 API ====================

@router.post("/purchase-orders/{purchase_order_id}/send-to-supplier", summary="下发采购订单到供应商协同平台")
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
        raise HTTPException(status_code=404, detail=str(e))
    except BusinessLogicError as e:
        raise HTTPException(status_code=400, detail=str(e))


@router.post("/purchase-orders/{purchase_order_id}/update-progress", summary="更新采购订单进度")
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
        raise HTTPException(status_code=404, detail=str(e))
    except BusinessLogicError as e:
        raise HTTPException(status_code=400, detail=str(e))


@router.post("/purchase-orders/{purchase_order_id}/submit-delivery-notice", summary="提交发货通知")
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
        raise HTTPException(status_code=404, detail=str(e))
    except BusinessLogicError as e:
        raise HTTPException(status_code=400, detail=str(e))


@router.get("/suppliers/{supplier_id}/purchase-orders", summary="获取供应商的采购订单列表")
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
        raise HTTPException(status_code=404, detail=str(e))


# ==================== 客户协同 API ====================

@router.get("/customers/{customer_id}/sales-orders", summary="获取客户的销售订单列表")
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
        raise HTTPException(status_code=404, detail=str(e))


@router.get("/sales-orders/{sales_order_id}/production-progress", response_model=SalesOrderProductionProgressResponse, summary="获取销售订单生产进度")
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
        raise HTTPException(status_code=404, detail=str(e))


@router.get("/customers/{customer_id}/order-summary", response_model=CustomerOrderSummaryResponse, summary="获取客户订单汇总")
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
        raise HTTPException(status_code=404, detail=str(e))
