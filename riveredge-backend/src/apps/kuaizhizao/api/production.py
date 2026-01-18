"""
生产执行 API 路由模块

提供工单管理和报工管理的API接口。
"""

from datetime import date, datetime
from typing import List, Optional, Dict, Any
from decimal import Decimal
from fastapi import APIRouter, Depends, Query, status, Path, HTTPException, Body
from fastapi.responses import JSONResponse, FileResponse
from loguru import logger

from core.api.deps import get_current_user, get_current_tenant
from infra.models.user import User
from infra.exceptions.exceptions import ValidationError, BusinessLogicError

from apps.kuaizhizao.services.work_order_service import WorkOrderService
from apps.kuaizhizao.services.reporting_service import ReportingService
from apps.kuaizhizao.services.rework_order_service import ReworkOrderService
from apps.kuaizhizao.services.outsource_service import OutsourceService
from apps.kuaizhizao.services.outsource_work_order_service import OutsourceWorkOrderService
from apps.kuaizhizao.services.outsource_material_issue_service import OutsourceMaterialIssueService
from apps.kuaizhizao.services.outsource_material_receipt_service import OutsourceMaterialReceiptService
from apps.kuaizhizao.services.outsource_collaboration_service import OutsourceCollaborationService
from apps.kuaizhizao.services.outsource_settlement_service import OutsourceSettlementService
from apps.kuaizhizao.services.supplier_collaboration_service import SupplierCollaborationService
from apps.kuaizhizao.services.customer_collaboration_service import CustomerCollaborationService
from apps.kuaizhizao.services.material_binding_service import MaterialBindingService
from apps.kuaizhizao.services.stocktaking_service import StocktakingService
from apps.kuaizhizao.services.inventory_transfer_service import InventoryTransferService
from apps.kuaizhizao.services.inventory_analysis_service import InventoryAnalysisService
from apps.kuaizhizao.services.inventory_alert_service import InventoryAlertRuleService, InventoryAlertService
from apps.kuaizhizao.services.packing_binding_service import PackingBindingService
from apps.kuaizhizao.services.customer_material_registration_service import (
    BarcodeMappingRuleService,
    CustomerMaterialRegistrationService,
)
from apps.kuaizhizao.services.document_timing_service import DocumentTimingService
from apps.kuaizhizao.services.exception_service import ExceptionService
from apps.kuaizhizao.services.exception_process_service import ExceptionProcessService
from apps.kuaizhizao.services.report_service import ReportService

# 初始化服务实例
work_order_service = WorkOrderService()
reporting_service = ReportingService()
outsource_work_order_service = OutsourceWorkOrderService()
outsource_material_issue_service = OutsourceMaterialIssueService()
outsource_material_receipt_service = OutsourceMaterialReceiptService()
scrap_record_service = ScrapRecordService()
defect_record_service = DefectRecordService()
material_binding_service = MaterialBindingService()
stocktaking_service = StocktakingService()
inventory_transfer_service = InventoryTransferService()
inventory_analysis_service = InventoryAnalysisService()
inventory_alert_rule_service = InventoryAlertRuleService()
inventory_alert_service = InventoryAlertService()
packing_binding_service = PackingBindingService()
barcode_mapping_rule_service = BarcodeMappingRuleService()
customer_material_registration_service = CustomerMaterialRegistrationService()
document_timing_service = DocumentTimingService()
exception_service = ExceptionService()
exception_process_service = ExceptionProcessService()
report_service = ReportService()
from apps.kuaizhizao.services.defect_record_service import DefectRecordService
from apps.kuaizhizao.services.warehouse_service import (
    ProductionPickingService,
    FinishedGoodsReceiptService,
    SalesDeliveryService,
    SalesReturnService,
    PurchaseReceiptService,
    PurchaseReturnService,
)
from apps.kuaizhizao.services.replenishment_suggestion_service import ReplenishmentSuggestionService
from apps.kuaizhizao.services.quality_service import (
    IncomingInspectionService,
    ProcessInspectionService,
    FinishedGoodsInspectionService,
)
from apps.kuaizhizao.services.quality_standard_service import QualityStandardService
from apps.kuaizhizao.services.finance_service import (
    PayableService,
    PurchaseInvoiceService,
    ReceivableService,
)
from apps.kuaizhizao.services.sales_service import (
    SalesForecastService,
    SalesOrderService,
)
# BOM管理已移至master_data APP，不再需要BOMService
from apps.kuaizhizao.services.planning_service import ProductionPlanningService
from apps.kuaizhizao.services.advanced_scheduling_service import AdvancedSchedulingService
from apps.kuaizhizao.schemas.work_order import (
    WorkOrderCreate,
    WorkOrderUpdate,
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
from apps.kuaizhizao.schemas.reporting_record import (
    ReportingRecordCreate,
    ReportingRecordUpdate,
    ReportingRecordResponse,
    ReportingRecordListResponse
)
from apps.kuaizhizao.schemas.scrap_record import (
    ScrapRecordCreateFromReporting,
    ScrapRecordResponse,
    ScrapRecordListResponse
)
from apps.kuaizhizao.schemas.defect_record import (
    DefectRecordCreateFromReporting,
    DefectRecordCreateFromInspection,
    DefectRecordResponse,
    DefectRecordListResponse
)
from apps.kuaizhizao.schemas.material_binding import (
    MaterialBindingCreateFromReporting,
    MaterialBindingResponse,
    MaterialBindingListResponse,
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
from apps.kuaizhizao.schemas.warehouse import (
    # 生产领料单
    ProductionPickingCreate,
    ProductionPickingUpdate,
    ProductionPickingResponse,
    ProductionPickingListResponse,
    # 成品入库单
    FinishedGoodsReceiptCreate,
    FinishedGoodsReceiptUpdate,
    FinishedGoodsReceiptResponse,
    # 销售出库单
    SalesDeliveryCreate,
    SalesDeliveryUpdate,
    SalesDeliveryResponse,
    # 销售退货单
    SalesReturnCreate,
    SalesReturnUpdate,
    SalesReturnResponse,
    # 采购入库单
    PurchaseReceiptCreate,
    PurchaseReceiptUpdate,
    PurchaseReceiptResponse,
    # 采购退货单
    PurchaseReturnCreate,
    PurchaseReturnUpdate,
    PurchaseReturnResponse,
)
from apps.kuaizhizao.schemas.replenishment_suggestion import (
    ReplenishmentSuggestionResponse,
    ReplenishmentSuggestionListResponse,
    ReplenishmentSuggestionProcessRequest,
)
from apps.kuaizhizao.schemas.inventory_alert import (
    InventoryAlertRuleCreate,
    InventoryAlertRuleUpdate,
    InventoryAlertRuleResponse,
    InventoryAlertRuleListResponse,
    InventoryAlertResponse,
    InventoryAlertListResponse,
)
from apps.kuaizhizao.schemas.packing_binding import (
    PackingBindingCreate,
    PackingBindingCreateFromReceipt,
    PackingBindingUpdate,
    PackingBindingResponse,
    PackingBindingListResponse,
)
from apps.kuaizhizao.schemas.customer_material_registration import (
    BarcodeMappingRuleCreate,
    BarcodeMappingRuleUpdate,
    BarcodeMappingRuleResponse,
    BarcodeMappingRuleListResponse,
    CustomerMaterialRegistrationCreate,
    CustomerMaterialRegistrationResponse,
    CustomerMaterialRegistrationListResponse,
    ParseBarcodeRequest,
    ParseBarcodeResponse,
)
from apps.kuaizhizao.schemas.document_node_timing import (
    DocumentNodeTimingResponse,
    DocumentTimingSummaryResponse,
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
    # 来料检验单
    IncomingInspectionCreate,
    IncomingInspectionUpdate,
    IncomingInspectionResponse,
    IncomingInspectionListResponse,
    # 过程检验单
    ProcessInspectionCreate,
    ProcessInspectionUpdate,
    ProcessInspectionResponse,
    ProcessInspectionListResponse,
    # 成品检验单
    FinishedGoodsInspectionCreate,
    FinishedGoodsInspectionUpdate,
    FinishedGoodsInspectionResponse,
    FinishedGoodsInspectionListResponse,
    # 质检标准
    QualityStandardCreate,
    QualityStandardUpdate,
    QualityStandardResponse,
    QualityStandardListResponse,
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
    ProductionPlanItemResponse,
    # MRP运算
    MRPComputationRequest,
    MRPComputationResult,
    MRPResultResponse,
    MRPResultListResponse,
    # LRP运算
    LRPComputationRequest,
    LRPComputationResult,
    LRPResultResponse,
    LRPResultListResponse,
    # 高级排产
    IntelligentSchedulingRequest,
    IntelligentSchedulingResponse,
    OptimizeScheduleRequest,
    OptimizeScheduleResponse,
)

# 创建路由
# 注意：路由前缀为空，因为应用路由注册时会自动添加 /apps/kuaizhizao 前缀
router = APIRouter(tags=["Kuaige Zhizao - Production Execution"])


# ============ 工单管理 API ============

@router.post("/work-orders", response_model=WorkOrderResponse, summary="创建工单")
async def create_work_order(
    work_order: WorkOrderCreate,
    current_user: User = Depends(get_current_user),
    tenant_id: int = Depends(get_current_tenant),
) -> WorkOrderResponse:
    """
    创建工单

    - **work_order**: 工单创建数据
    - **current_user**: 当前用户
    - **tenant_id**: 当前组织ID

    返回创建的工单信息。
    """
    return await WorkOrderService().create_work_order(
        tenant_id=tenant_id,
        work_order_data=work_order,
        created_by=current_user.id
    )


@router.get("/work-orders", summary="获取工单列表")
async def list_work_orders(
    skip: int = Query(0, ge=0, description="跳过数量"),
    limit: int = Query(100, ge=1, le=1000, description="限制数量"),
    code: Optional[str] = Query(None, description="工单编码（模糊搜索）"),
    name: Optional[str] = Query(None, description="工单名称（模糊搜索）"),
    product_name: Optional[str] = Query(None, description="产品名称（模糊搜索）"),
    production_mode: Optional[str] = Query(None, description="生产模式（MTS/MTO）"),
    status: Optional[str] = Query(None, description="工单状态"),
    workshop_id: Optional[int] = Query(None, description="车间ID"),
    work_center_id: Optional[int] = Query(None, description="工作中心ID"),
    current_user: User = Depends(get_current_user),
    tenant_id: int = Depends(get_current_tenant),
):
    """
    获取工单列表

    支持多种筛选条件的高级搜索。
    返回格式：{ "data": [], "total": 0, "success": true }
    """
    try:
        service = WorkOrderService()
        result = await service.list_work_orders(
            tenant_id=tenant_id,
            skip=skip,
            limit=limit,
            code=code,
            name=name,
            product_name=product_name,
            production_mode=production_mode,
            status=status,
            workshop_id=workshop_id,
            work_center_id=work_center_id,
        )
        # 返回分页格式，包含总数
        total = await service.get_work_order_count(
            tenant_id=tenant_id,
            code=code,
            name=name,
            product_name=product_name,
            production_mode=production_mode,
            status=status,
            workshop_id=workshop_id,
            work_center_id=work_center_id,
        )
        return {
            "data": result,
            "total": total,
            "success": True
        }
    except Exception as e:
        from loguru import logger
        logger.error(f"获取工单列表失败: {str(e)}")
        logger.exception(e)
        raise


@router.get("/work-orders/{work_order_id}", response_model=WorkOrderResponse, summary="获取工单详情")
async def get_work_order(
    work_order_id: int,
    current_user: User = Depends(get_current_user),
    tenant_id: int = Depends(get_current_tenant),
) -> WorkOrderResponse:
    """
    根据ID获取工单详情

    - **work_order_id**: 工单ID
    """
    return await WorkOrderService().get_work_order_by_id(
        tenant_id=tenant_id,
        work_order_id=work_order_id
    )


@router.get("/work-orders/{work_order_id}/operations", response_model=List[WorkOrderOperationResponse], summary="获取工单工序列表")
async def get_work_order_operations(
    work_order_id: int,
    current_user: User = Depends(get_current_user),
    tenant_id: int = Depends(get_current_tenant),
) -> List[WorkOrderOperationResponse]:
    """
    获取工单工序列表

    - **work_order_id**: 工单ID
    """
    return await WorkOrderService().get_work_order_operations(
        tenant_id=tenant_id,
        work_order_id=work_order_id
    )


@router.put("/work-orders/{work_order_id}/operations", response_model=List[WorkOrderOperationResponse], summary="更新工单工序")
async def update_work_order_operations(
    work_order_id: int,
    operations_data: WorkOrderOperationsUpdateRequest,
    current_user: User = Depends(get_current_user),
    tenant_id: int = Depends(get_current_tenant),
) -> List[WorkOrderOperationResponse]:
    """
    更新工单工序

    支持工序的增删改和顺序调整。已报工的工序不允许修改。

    - **work_order_id**: 工单ID
    - **operations_data**: 工序数据（operations: 工序列表）
    """
    return await WorkOrderService().update_work_order_operations(
        tenant_id=tenant_id,
        work_order_id=work_order_id,
        operations_data=operations_data,
        updated_by=current_user.id
    )


@router.post("/work-orders/{work_order_id}/operations/{operation_id}/start", response_model=WorkOrderOperationResponse, summary="开始工单工序")
async def start_work_order_operation(
    work_order_id: int,
    operation_id: int,
    current_user: User = Depends(get_current_user),
    tenant_id: int = Depends(get_current_tenant),
) -> WorkOrderOperationResponse:
    """
    开始工单工序

    将工序状态从 pending 更新为 in_progress，并记录实际开始时间。

    - **work_order_id**: 工单ID
    - **operation_id**: 工序ID（工单工序的ID，不是工序模板的ID）
    """
    return await WorkOrderService().start_work_order_operation(
        tenant_id=tenant_id,
        work_order_id=work_order_id,
        operation_id=operation_id,
        started_by=current_user.id
    )


@router.put("/work-orders/{work_order_id}", response_model=WorkOrderResponse, summary="更新工单")
async def update_work_order(
    work_order_id: int,
    work_order: WorkOrderUpdate,
    current_user: User = Depends(get_current_user),
    tenant_id: int = Depends(get_current_tenant),
) -> WorkOrderResponse:
    """
    更新工单信息

    - **work_order_id**: 工单ID
    - **work_order**: 工单更新数据
    """
    return await WorkOrderService().update_work_order(
        tenant_id=tenant_id,
        work_order_id=work_order_id,
        work_order_data=work_order,
        updated_by=current_user.id
    )


@router.delete("/work-orders/{work_order_id}", summary="删除工单")
async def delete_work_order(
    work_order_id: int,
    current_user: User = Depends(get_current_user),
    tenant_id: int = Depends(get_current_tenant),
) -> JSONResponse:
    """
    删除工单（软删除）

    - **work_order_id**: 工单ID
    """
    await WorkOrderService().delete_work_order(
        tenant_id=tenant_id,
        work_order_id=work_order_id
    )

    return JSONResponse(
        content={"message": "工单删除成功"},
        status_code=status.HTTP_200_OK
    )


@router.post("/work-orders/{work_order_id}/split", response_model=WorkOrderSplitResponse, summary="拆分工单")
async def split_work_order(
    work_order_id: int,
    split_data: WorkOrderSplitRequest,
    current_user: User = Depends(get_current_user),
    tenant_id: int = Depends(get_current_tenant),
) -> WorkOrderSplitResponse:
    """
    拆分工单

    支持按数量拆分（将大工单拆分成多个小工单）。
    按工序拆分功能暂未实现。

    - **work_order_id**: 原工单ID
    - **split_data**: 拆分数据（split_type、split_quantities或split_count）
    """
    return await WorkOrderService().split_work_order(
        tenant_id=tenant_id,
        work_order_id=work_order_id,
        split_data=split_data,
        created_by=current_user.id
    )


@router.post("/work-orders/{work_order_id}/freeze", response_model=WorkOrderResponse, summary="冻结工单")
async def freeze_work_order(
    work_order_id: int,
    freeze_data: WorkOrderFreezeRequest,
    current_user: User = Depends(get_current_user),
    tenant_id: int = Depends(get_current_tenant),
) -> WorkOrderResponse:
    """
    冻结工单

    - **work_order_id**: 工单ID
    - **freeze_data**: 冻结数据（包含冻结原因）
    """
    return await WorkOrderService().freeze_work_order(
        tenant_id=tenant_id,
        work_order_id=work_order_id,
        freeze_data=freeze_data,
        frozen_by=current_user.id
    )


@router.post("/work-orders/{work_order_id}/unfreeze", response_model=WorkOrderResponse, summary="解冻工单")
async def unfreeze_work_order(
    work_order_id: int,
    unfreeze_data: WorkOrderUnfreezeRequest,
    current_user: User = Depends(get_current_user),
    tenant_id: int = Depends(get_current_tenant),
) -> WorkOrderResponse:
    """
    解冻工单

    - **work_order_id**: 工单ID
    - **unfreeze_data**: 解冻数据（可选解冻原因）
    """
    return await WorkOrderService().unfreeze_work_order(
        tenant_id=tenant_id,
        work_order_id=work_order_id,
        unfreeze_data=unfreeze_data,
        unfrozen_by=current_user.id
    )


@router.put("/work-orders/{work_order_id}/priority", response_model=WorkOrderResponse, summary="设置工单优先级")
async def set_work_order_priority(
    work_order_id: int,
    priority_data: WorkOrderPriorityRequest,
    current_user: User = Depends(get_current_user),
    tenant_id: int = Depends(get_current_tenant),
) -> WorkOrderResponse:
    """
    设置工单优先级

    - **work_order_id**: 工单ID
    - **priority_data**: 优先级数据（priority: low/normal/high/urgent）
    """
    return await WorkOrderService().set_work_order_priority(
        tenant_id=tenant_id,
        work_order_id=work_order_id,
        priority_data=priority_data,
        updated_by=current_user.id
    )


@router.put("/work-orders/batch-priority", response_model=List[WorkOrderResponse], summary="批量设置工单优先级")
async def batch_set_work_order_priority(
    batch_data: WorkOrderBatchPriorityRequest,
    current_user: User = Depends(get_current_user),
    tenant_id: int = Depends(get_current_tenant),
) -> List[WorkOrderResponse]:
    """
    批量设置工单优先级

    - **batch_data**: 批量优先级数据（work_order_ids: 工单ID列表, priority: low/normal/high/urgent）
    """
    return await WorkOrderService().batch_set_work_order_priority(
        tenant_id=tenant_id,
        batch_data=batch_data,
        updated_by=current_user.id
    )


@router.post("/work-orders/merge", response_model=WorkOrderMergeResponse, summary="合并工单")
async def merge_work_orders(
    merge_data: WorkOrderMergeRequest,
    current_user: User = Depends(get_current_user),
    tenant_id: int = Depends(get_current_tenant),
) -> WorkOrderMergeResponse:
    """
    合并工单

    - **merge_data**: 合并数据（work_order_ids: 要合并的工单ID列表（至少2个）, remarks: 合并备注（可选））
    """
    return await WorkOrderService().merge_work_orders(
        tenant_id=tenant_id,
        merge_data=merge_data,
        created_by=current_user.id
    )


@router.post("/work-orders/{work_order_id}/rework", response_model=ReworkOrderResponse, summary="从工单创建返工单")
async def create_rework_order_from_work_order(
    work_order_id: int,
    request_data: ReworkOrderFromWorkOrderRequest,
    current_user: User = Depends(get_current_user),
    tenant_id: int = Depends(get_current_tenant),
) -> ReworkOrderResponse:
    """
    从工单创建返工单

    根据原工单信息创建返工单，自动关联原工单。返工单编码自动生成：返工-{原工单号}-{序号}

    - **work_order_id**: 原工单ID
    - **request_data**: 返工单创建请求数据（返工原因、返工类型等，部分字段可从原工单继承）
    """
    return await ReworkOrderService().create_rework_order_from_work_order(
        tenant_id=tenant_id,
        work_order_id=work_order_id,
        request_data=request_data,
        created_by=current_user.id
    )


# ============ 返工单管理 API ============

@router.post("/rework-orders", response_model=ReworkOrderResponse, summary="创建返工单")
async def create_rework_order(
    rework_order: ReworkOrderCreate,
    current_user: User = Depends(get_current_user),
    tenant_id: int = Depends(get_current_tenant),
) -> ReworkOrderResponse:
    """
    创建返工单

    - **rework_order**: 返工单创建数据
    """
    return await ReworkOrderService().create_rework_order(
        tenant_id=tenant_id,
        rework_order_data=rework_order,
        created_by=current_user.id
    )


@router.get("/rework-orders", response_model=List[ReworkOrderListResponse], summary="获取返工单列表")
async def list_rework_orders(
    skip: int = Query(0, ge=0, description="跳过数量"),
    limit: int = Query(100, ge=1, le=1000, description="限制数量"),
    code: Optional[str] = Query(None, description="返工单编码（模糊搜索）"),
    status: Optional[str] = Query(None, description="返工单状态"),
    original_work_order_id: Optional[int] = Query(None, description="原工单ID"),
    product_name: Optional[str] = Query(None, description="产品名称（模糊搜索）"),
    rework_type: Optional[str] = Query(None, description="返工类型"),
    current_user: User = Depends(get_current_user),
    tenant_id: int = Depends(get_current_tenant),
) -> List[ReworkOrderListResponse]:
    """
    获取返工单列表

    支持多种筛选条件的高级搜索。
    """
    return await ReworkOrderService().list_rework_orders(
        tenant_id=tenant_id,
        skip=skip,
        limit=limit,
        code=code,
        status=status,
        original_work_order_id=original_work_order_id,
        product_name=product_name,
        rework_type=rework_type,
    )


@router.get("/rework-orders/{rework_order_id}", response_model=ReworkOrderResponse, summary="获取返工单详情")
async def get_rework_order(
    rework_order_id: int,
    current_user: User = Depends(get_current_user),
    tenant_id: int = Depends(get_current_tenant),
) -> ReworkOrderResponse:
    """
    根据ID获取返工单详情

    - **rework_order_id**: 返工单ID
    """
    return await ReworkOrderService().get_rework_order_by_id(
        tenant_id=tenant_id,
        rework_order_id=rework_order_id
    )


@router.put("/rework-orders/{rework_order_id}", response_model=ReworkOrderResponse, summary="更新返工单")
async def update_rework_order(
    rework_order_id: int,
    rework_order: ReworkOrderUpdate,
    current_user: User = Depends(get_current_user),
    tenant_id: int = Depends(get_current_tenant),
) -> ReworkOrderResponse:
    """
    更新返工单信息

    - **rework_order_id**: 返工单ID
    - **rework_order**: 返工单更新数据
    """
    return await ReworkOrderService().update_rework_order(
        tenant_id=tenant_id,
        rework_order_id=rework_order_id,
        rework_order_data=rework_order,
        updated_by=current_user.id
    )


@router.delete("/rework-orders/{rework_order_id}", summary="删除返工单")
async def delete_rework_order(
    rework_order_id: int,
    current_user: User = Depends(get_current_user),
    tenant_id: int = Depends(get_current_tenant),
) -> JSONResponse:
    """
    删除返工单（软删除）

    - **rework_order_id**: 返工单ID
    """
    await ReworkOrderService().delete_rework_order(
        tenant_id=tenant_id,
        rework_order_id=rework_order_id
    )

    return JSONResponse(
        content={"message": "返工单删除成功"},
        status_code=status.HTTP_200_OK
    )


@router.post("/work-orders/{work_order_id}/outsource", response_model=OutsourceOrderResponse, summary="从工单创建委外单")
async def create_outsource_order_from_work_order(
    work_order_id: int,
    outsource_data: OutsourceOrderCreateFromWorkOrder,
    current_user: User = Depends(get_current_user),
    tenant_id: int = Depends(get_current_tenant),
) -> OutsourceOrderResponse:
    """
    从工单工序创建委外单

    根据工单工序信息创建委外单，自动关联工单和工序。

    - **work_order_id**: 工单ID
    - **outsource_data**: 委外单创建数据（工单工序ID、供应商ID、委外数量等）
    """
    return await OutsourceService().create_outsource_order_from_work_order(
        tenant_id=tenant_id,
        work_order_id=work_order_id,
        work_order_operation_id=outsource_data.work_order_operation_id,
        supplier_id=outsource_data.supplier_id,
        outsource_quantity=outsource_data.outsource_quantity,
        unit_price=outsource_data.unit_price,
        planned_start_date=outsource_data.planned_start_date,
        planned_end_date=outsource_data.planned_end_date,
        remarks=outsource_data.remarks,
        created_by=current_user.id
    )


# ============ 委外单管理 API ============

@router.post("/outsource-orders", response_model=OutsourceOrderResponse, summary="创建委外单")
async def create_outsource_order(
    outsource_order: OutsourceOrderCreate,
    current_user: User = Depends(get_current_user),
    tenant_id: int = Depends(get_current_tenant),
) -> OutsourceOrderResponse:
    """
    创建委外单

    - **outsource_order**: 委外单创建数据
    """
    return await OutsourceService().create_outsource_order(
        tenant_id=tenant_id,
        outsource_order_data=outsource_order,
        created_by=current_user.id
    )


@router.get("/outsource-orders", response_model=List[OutsourceOrderListResponse], summary="获取委外单列表")
async def list_outsource_orders(
    skip: int = Query(0, ge=0, description="跳过数量"),
    limit: int = Query(100, ge=1, le=1000, description="限制数量"),
    work_order_id: Optional[int] = Query(None, description="工单ID"),
    supplier_id: Optional[int] = Query(None, description="供应商ID"),
    status: Optional[str] = Query(None, description="委外单状态"),
    code: Optional[str] = Query(None, description="委外单编码（模糊搜索）"),
    current_user: User = Depends(get_current_user),
    tenant_id: int = Depends(get_current_tenant),
) -> List[OutsourceOrderListResponse]:
    """
    获取委外单列表

    支持多种筛选条件的高级搜索。
    """
    return await OutsourceService().list_outsource_orders(
        tenant_id=tenant_id,
        skip=skip,
        limit=limit,
        work_order_id=work_order_id,
        supplier_id=supplier_id,
        status=status,
        code=code,
    )


@router.get("/outsource-orders/{outsource_order_id}", response_model=OutsourceOrderResponse, summary="获取委外单详情")
async def get_outsource_order(
    outsource_order_id: int,
    current_user: User = Depends(get_current_user),
    tenant_id: int = Depends(get_current_tenant),
) -> OutsourceOrderResponse:
    """
    根据ID获取委外单详情

    - **outsource_order_id**: 委外单ID
    """
    return await OutsourceService().get_outsource_order_by_id(
        tenant_id=tenant_id,
        outsource_order_id=outsource_order_id
    )


@router.put("/outsource-orders/{outsource_order_id}", response_model=OutsourceOrderResponse, summary="更新委外单")
async def update_outsource_order(
    outsource_order_id: int,
    outsource_order: OutsourceOrderUpdate,
    current_user: User = Depends(get_current_user),
    tenant_id: int = Depends(get_current_tenant),
) -> OutsourceOrderResponse:
    """
    更新委外单信息

    - **outsource_order_id**: 委外单ID
    - **outsource_order**: 委外单更新数据
    """
    return await OutsourceService().update_outsource_order(
        tenant_id=tenant_id,
        outsource_order_id=outsource_order_id,
        outsource_order_data=outsource_order,
        updated_by=current_user.id
    )


@router.delete("/outsource-orders/{outsource_order_id}", summary="删除委外单")
async def delete_outsource_order(
    outsource_order_id: int,
    current_user: User = Depends(get_current_user),
    tenant_id: int = Depends(get_current_tenant),
) -> JSONResponse:
    """
    删除委外单（软删除）

    - **outsource_order_id**: 委外单ID
    """
    await OutsourceService().delete_outsource_order(
        tenant_id=tenant_id,
        outsource_order_id=outsource_order_id,
        deleted_by=current_user.id
    )

    return JSONResponse(
        content={"message": "委外单删除成功"},
        status_code=status.HTTP_200_OK
    )


@router.post("/outsource-orders/{outsource_order_id}/link-purchase-receipt", response_model=OutsourceOrderResponse, summary="关联采购入库单")
async def link_purchase_receipt_to_outsource_order(
    outsource_order_id: int,
    purchase_receipt_id: int = Query(..., description="采购入库单ID"),
    current_user: User = Depends(get_current_user),
    tenant_id: int = Depends(get_current_tenant),
) -> OutsourceOrderResponse:
    """
    关联采购入库单（委外入库）

    - **outsource_order_id**: 委外单ID
    - **purchase_receipt_id**: 采购入库单ID
    """
    return await OutsourceService().link_purchase_receipt(
        tenant_id=tenant_id,
        outsource_order_id=outsource_order_id,
        purchase_receipt_id=purchase_receipt_id,
        updated_by=current_user.id
    )


@router.get("/work-orders/{work_order_id}/check-shortage", response_model=MaterialShortageResponse, summary="检查工单缺料")
async def check_work_order_shortage(
    work_order_id: int,
    warehouse_id: Optional[int] = Query(None, description="仓库ID（可选）"),
    current_user: User = Depends(get_current_user),
    tenant_id: int = Depends(get_current_tenant),
) -> MaterialShortageResponse:
    """
    检查工单缺料情况

    根据工单的BOM和当前库存，检查是否存在缺料。

    - **work_order_id**: 工单ID
    - **warehouse_id**: 仓库ID（可选，如果为None则查询所有仓库）
    """
    result = await WorkOrderService().check_material_shortage(
        tenant_id=tenant_id,
        work_order_id=work_order_id,
        warehouse_id=warehouse_id
    )
    return MaterialShortageResponse(**result)


@router.post("/work-orders/{work_order_id}/release", response_model=WorkOrderResponse, summary="下达工单")
async def release_work_order(
    work_order_id: int,
    check_shortage: bool = Query(True, description="是否在下达前检查缺料（默认：True）"),
    current_user: User = Depends(get_current_user),
    tenant_id: int = Depends(get_current_tenant),
) -> WorkOrderResponse:
    """
    下达工单

    将工单状态从"草稿"更新为"已下达"。

    - **work_order_id**: 工单ID
    - **check_shortage**: 是否在下达前检查缺料（默认：True）。如果为True且存在缺料，将阻止下达并返回错误。
    """
    return await WorkOrderService().release_work_order(
        tenant_id=tenant_id,
        work_order_id=work_order_id,
        released_by=current_user.id,
        check_shortage=check_shortage
    )


@router.post("/work-orders/{work_order_id}/revoke", response_model=WorkOrderResponse, summary="撤回工单")
async def revoke_work_order(
    work_order_id: int,
    current_user: User = Depends(get_current_user),
    tenant_id: int = Depends(get_current_tenant),
) -> WorkOrderResponse:
    """
    撤回工单

    将已下达或指定结束的工单撤回为草稿状态。
    撤回条件：
    - 工单状态为 'released'（已下达）或 'completed'（已完成且为指定结束）
    - 工单没有产生过报工记录

    - **work_order_id**: 工单ID
    """
    return await WorkOrderService().revoke_work_order(
        tenant_id=tenant_id,
        work_order_id=work_order_id,
        revoked_by=current_user.id
    )


@router.post("/work-orders/{work_order_id}/complete", response_model=WorkOrderResponse, summary="指定结束工单")
async def manually_complete_work_order(
    work_order_id: int,
    current_user: User = Depends(get_current_user),
    tenant_id: int = Depends(get_current_tenant),
) -> WorkOrderResponse:
    """
    指定结束工单

    将工单状态改为已完成，并标记为指定结束。
    指定结束的工单也允许撤回（如果工单没有产生过报工记录）。

    - **work_order_id**: 工单ID
    """
    return await WorkOrderService().manually_complete_work_order(
        tenant_id=tenant_id,
        work_order_id=work_order_id,
        completed_by=current_user.id
    )


@router.get("/work-orders/delayed", summary="查询延期工单")
async def get_delayed_work_orders(
    days_threshold: int = Query(0, ge=0, description="延期天数阈值（默认0，即只要超过计划结束日期就算延期）"),
    status: Optional[str] = Query(None, description="工单状态过滤（可选）"),
    current_user: User = Depends(get_current_user),
    tenant_id: int = Depends(get_current_tenant),
) -> JSONResponse:
    """
    查询延期工单

    根据计划结束日期和当前日期，查询所有延期的工单。

    - **days_threshold**: 延期天数阈值（默认0）
    - **status**: 工单状态过滤（可选）
    """
    delayed_orders = await WorkOrderService().check_delayed_work_orders(
        tenant_id=tenant_id,
        days_threshold=days_threshold,
        status=status
    )
    return JSONResponse(
        content={
            "total": len(delayed_orders),
            "delayed_orders": delayed_orders
        },
        status_code=status.HTTP_200_OK
    )


@router.get("/work-orders/delay-analysis", summary="延期原因分析")
async def analyze_delay_reasons(
    work_order_id: Optional[int] = Query(None, description="工单ID（可选，如果为None则分析所有延期工单）"),
    current_user: User = Depends(get_current_user),
    tenant_id: int = Depends(get_current_tenant),
) -> JSONResponse:
    """
    分析延期原因

    分析工单延期的原因，包括缺料、产能不足、质量问题等。

    - **work_order_id**: 工单ID（可选，如果为None则分析所有延期工单）
    """
    result = await WorkOrderService().analyze_delay_reasons(
        tenant_id=tenant_id,
        work_order_id=work_order_id
    )
    return JSONResponse(
        content=result,
        status_code=status.HTTP_200_OK
    )


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
    from datetime import datetime

    # 转换时间参数
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
        status_code=status.HTTP_200_OK
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
    from datetime import datetime

    # 转换时间参数
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
        status_code=status.HTTP_200_OK
    )


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
    # 确保绑定类型为上料
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
    # 确保绑定类型为下料
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
        status_code=status.HTTP_200_OK
    )


# ============ 生产领料管理 API ============

@router.post("/production-pickings/quick-pick", response_model=ProductionPickingResponse, summary="一键领料（从工单下推）")
async def quick_pick_from_work_order(
    work_order_id: int = Query(..., description="工单ID"),
    warehouse_id: Optional[int] = Query(None, description="仓库ID（可选，如果不提供则使用物料默认仓库）"),
    warehouse_name: Optional[str] = Query(None, description="仓库名称（可选）"),
    current_user: User = Depends(get_current_user),
    tenant_id: int = Depends(get_current_tenant),
) -> ProductionPickingResponse:
    """
    一键领料：从工单下推，根据BOM自动生成领料需求

    - **work_order_id**: 工单ID
    - **warehouse_id**: 仓库ID（可选）
    - **warehouse_name**: 仓库名称（可选）
    - **current_user**: 当前用户
    - **tenant_id**: 当前组织ID

    系统会自动：
    1. 获取工单信息
    2. 根据工单产品获取BOM
    3. 根据BOM和工单数量计算物料需求
    4. 创建生产领料单和明细

    返回创建的生产领料单信息。
    """
    return await ProductionPickingService().quick_pick_from_work_order(
        tenant_id=tenant_id,
        work_order_id=work_order_id,
        created_by=current_user.id,
        warehouse_id=warehouse_id,
        warehouse_name=warehouse_name
    )


@router.post("/production-pickings/batch-pick", response_model=List[ProductionPickingResponse], summary="批量领料（多工单）")
async def batch_pick_from_work_orders(
    work_order_ids: List[int] = Query(..., description="工单ID列表"),
    warehouse_id: Optional[int] = Query(None, description="仓库ID（可选）"),
    warehouse_name: Optional[str] = Query(None, description="仓库名称（可选）"),
    current_user: User = Depends(get_current_user),
    tenant_id: int = Depends(get_current_tenant),
) -> List[ProductionPickingResponse]:
    """
    批量领料：从多个工单下推，批量创建领料单

    - **work_order_ids**: 工单ID列表
    - **warehouse_id**: 仓库ID（可选）
    - **warehouse_name**: 仓库名称（可选）
    - **current_user**: 当前用户
    - **tenant_id**: 当前组织ID

    返回创建的生产领料单列表。
    """
    return await ProductionPickingService().batch_pick_from_work_orders(
        tenant_id=tenant_id,
        work_order_ids=work_order_ids,
        created_by=current_user.id,
        warehouse_id=warehouse_id,
        warehouse_name=warehouse_name
    )


@router.post("/production-pickings", response_model=ProductionPickingResponse, summary="创建生产领料单")
async def create_production_picking(
    picking: ProductionPickingCreate,
    current_user: User = Depends(get_current_user),
    tenant_id: int = Depends(get_current_tenant),
) -> ProductionPickingResponse:
    """
    创建生产领料单

    - **picking**: 领料单创建数据
    - **current_user**: 当前用户
    - **tenant_id**: 当前组织ID

    返回创建的生产领料单信息。
    """
    return await ProductionPickingService().create_production_picking(
        tenant_id=tenant_id,
        picking_data=picking,
        created_by=current_user.id
    )


@router.get("/production-pickings", response_model=List[ProductionPickingListResponse], summary="获取生产领料单列表")
async def list_production_pickings(
    skip: int = Query(0, ge=0, description="跳过数量"),
    limit: int = Query(100, ge=1, le=1000, description="限制数量"),
    status: Optional[str] = Query(None, description="领料状态"),
    work_order_id: Optional[int] = Query(None, description="工单ID"),
    current_user: User = Depends(get_current_user),
    tenant_id: int = Depends(get_current_tenant),
) -> List[ProductionPickingListResponse]:
    """
    获取生产领料单列表

    支持状态和工单筛选。
    """
    return await ProductionPickingService().list_production_pickings(
        tenant_id=tenant_id,
        skip=skip,
        limit=limit,
        status=status,
        work_order_id=work_order_id,
    )


@router.get("/production-pickings/{picking_id}", response_model=ProductionPickingResponse, summary="获取生产领料单详情")
async def get_production_picking(
    picking_id: int,
    current_user: User = Depends(get_current_user),
    tenant_id: int = Depends(get_current_tenant),
) -> ProductionPickingResponse:
    """
    根据ID获取生产领料单详情

    - **picking_id**: 领料单ID
    """
    return await ProductionPickingService().get_production_picking_by_id(
        tenant_id=tenant_id,
        picking_id=picking_id
    )


@router.post("/production-pickings/{picking_id}/confirm", response_model=ProductionPickingResponse, summary="确认领料")
async def confirm_production_picking(
    picking_id: int,
    current_user: User = Depends(get_current_user),
    tenant_id: int = Depends(get_current_tenant),
) -> ProductionPickingResponse:
    """
    确认生产领料

    - **picking_id**: 领料单ID
    """
    return await ProductionPickingService().confirm_picking(
        tenant_id=tenant_id,
        picking_id=picking_id,
        confirmed_by=current_user.id
    )


# ============ 成品入库管理 API ============

@router.post("/finished-goods-receipts/quick-receipt", response_model=FinishedGoodsReceiptResponse, summary="一键入库（从工单下推）")
async def quick_receipt_from_work_order(
    work_order_id: int = Query(..., description="工单ID"),
    warehouse_id: Optional[int] = Query(None, description="仓库ID（必填）"),
    warehouse_name: Optional[str] = Query(None, description="仓库名称（可选）"),
    receipt_quantity: Optional[float] = Query(None, description="入库数量（可选，如果不提供则使用报工合格数量）"),
    current_user: User = Depends(get_current_user),
    tenant_id: int = Depends(get_current_tenant),
) -> FinishedGoodsReceiptResponse:
    """
    一键入库：从工单下推，根据报工记录自动生成入库单

    - **work_order_id**: 工单ID
    - **warehouse_id**: 仓库ID（必填）
    - **warehouse_name**: 仓库名称（可选）
    - **receipt_quantity**: 入库数量（可选，如果不提供则使用报工合格数量）
    - **current_user**: 当前用户
    - **tenant_id**: 当前组织ID

    系统会自动：
    1. 获取工单信息
    2. 从报工记录获取合格数量（如果未指定入库数量）
    3. 创建成品入库单和明细

    返回创建的成品入库单信息。
    """
    return await FinishedGoodsReceiptService().quick_receipt_from_work_order(
        tenant_id=tenant_id,
        work_order_id=work_order_id,
        created_by=current_user.id,
        warehouse_id=warehouse_id,
        warehouse_name=warehouse_name,
        receipt_quantity=receipt_quantity
    )


@router.post("/finished-goods-receipts/batch-receipt", response_model=List[FinishedGoodsReceiptResponse], summary="批量入库（多工单）")
async def batch_receipt_from_work_orders(
    work_order_ids: List[int] = Query(..., description="工单ID列表"),
    warehouse_id: Optional[int] = Query(None, description="仓库ID（可选）"),
    warehouse_name: Optional[str] = Query(None, description="仓库名称（可选）"),
    current_user: User = Depends(get_current_user),
    tenant_id: int = Depends(get_current_tenant),
) -> List[FinishedGoodsReceiptResponse]:
    """
    批量入库：从多个工单下推，批量创建入库单

    - **work_order_ids**: 工单ID列表
    - **warehouse_id**: 仓库ID（可选）
    - **warehouse_name**: 仓库名称（可选）
    - **current_user**: 当前用户
    - **tenant_id**: 当前组织ID

    返回创建的成品入库单列表。
    """
    return await FinishedGoodsReceiptService().batch_receipt_from_work_orders(
        tenant_id=tenant_id,
        work_order_ids=work_order_ids,
        created_by=current_user.id,
        warehouse_id=warehouse_id,
        warehouse_name=warehouse_name
    )


@router.post("/finished-goods-receipts", response_model=FinishedGoodsReceiptResponse, summary="创建成品入库单")
async def create_finished_goods_receipt(
    receipt: FinishedGoodsReceiptCreate,
    current_user: User = Depends(get_current_user),
    tenant_id: int = Depends(get_current_tenant),
) -> FinishedGoodsReceiptResponse:
    """
    创建成品入库单

    - **receipt**: 入库单创建数据
    - **current_user**: 当前用户
    - **tenant_id**: 当前组织ID

    返回创建的成品入库单信息。
    """
    # 从receipt中提取items（如果存在）
    items = getattr(receipt, 'items', None)
    return await FinishedGoodsReceiptService().create_finished_goods_receipt(
        tenant_id=tenant_id,
        receipt_data=receipt,
        created_by=current_user.id,
        items=items
    )


@router.get("/finished-goods-receipts", response_model=List[FinishedGoodsReceiptResponse], summary="获取成品入库单列表")
async def list_finished_goods_receipts(
    skip: int = Query(0, ge=0, description="跳过数量"),
    limit: int = Query(100, ge=1, le=1000, description="限制数量"),
    status: Optional[str] = Query(None, description="入库状态"),
    work_order_id: Optional[int] = Query(None, description="工单ID"),
    current_user: User = Depends(get_current_user),
    tenant_id: int = Depends(get_current_tenant),
) -> List[FinishedGoodsReceiptResponse]:
    """
    获取成品入库单列表

    支持状态和工单筛选。
    """
    return await FinishedGoodsReceiptService().list_finished_goods_receipts(
        tenant_id=tenant_id,
        skip=skip,
        limit=limit,
        status=status,
        work_order_id=work_order_id,
    )


@router.get("/finished-goods-receipts/{receipt_id}", response_model=FinishedGoodsReceiptResponse, summary="获取成品入库单详情")
async def get_finished_goods_receipt(
    receipt_id: int,
    current_user: User = Depends(get_current_user),
    tenant_id: int = Depends(get_current_tenant),
) -> FinishedGoodsReceiptResponse:
    """
    根据ID获取成品入库单详情

    - **receipt_id**: 入库单ID
    """
    return await FinishedGoodsReceiptService().get_finished_goods_receipt_by_id(
        tenant_id=tenant_id,
        receipt_id=receipt_id
    )


@router.post("/finished-goods-receipts/{receipt_id}/confirm", response_model=FinishedGoodsReceiptResponse, summary="确认成品入库")
async def confirm_finished_goods_receipt(
    receipt_id: int,
    current_user: User = Depends(get_current_user),
    tenant_id: int = Depends(get_current_tenant),
) -> FinishedGoodsReceiptResponse:
    """
    确认成品入库

    - **receipt_id**: 入库单ID
    """
    return await FinishedGoodsReceiptService().confirm_receipt(
        tenant_id=tenant_id,
        receipt_id=receipt_id,
        confirmed_by=current_user.id
    )


@router.post("/finished-goods-receipts/{receipt_id}/packing-binding", response_model=PackingBindingResponse, summary="从成品入库单创建装箱绑定")
async def create_packing_binding_from_receipt(
    receipt_id: int,
    binding_data: PackingBindingCreateFromReceipt,
    current_user: User = Depends(get_current_user),
    tenant_id: int = Depends(get_current_tenant),
) -> PackingBindingResponse:
    """
    从成品入库单创建装箱绑定

    在成品入库单中绑定装箱信息，包括产品序列号、包装物料等。

    - **receipt_id**: 成品入库单ID
    - **binding_data**: 装箱绑定创建数据（产品ID、装箱数量、包装物料、序列号等）
    """
    return await packing_binding_service.create_packing_binding_from_receipt(
        tenant_id=tenant_id,
        receipt_id=receipt_id,
        binding_data=binding_data,
        bound_by=current_user.id
    )


@router.get("/finished-goods-receipts/{receipt_id}/packing-binding", response_model=List[PackingBindingListResponse], summary="获取成品入库单的装箱绑定记录")
async def get_packing_bindings_by_receipt(
    receipt_id: int,
    current_user: User = Depends(get_current_user),
    tenant_id: int = Depends(get_current_tenant),
) -> List[PackingBindingListResponse]:
    """
    获取成品入库单的装箱绑定记录列表

    - **receipt_id**: 成品入库单ID
    """
    return await packing_binding_service.get_packing_bindings_by_receipt(
        tenant_id=tenant_id,
        receipt_id=receipt_id
    )


@router.get("/packing-bindings", response_model=List[PackingBindingListResponse], summary="获取装箱绑定记录列表")
async def list_packing_bindings(
    skip: int = Query(0, ge=0, description="跳过数量"),
    limit: int = Query(100, ge=1, le=1000, description="限制数量"),
    receipt_id: Optional[int] = Query(None, description="成品入库单ID"),
    product_id: Optional[int] = Query(None, description="产品ID"),
    box_no: Optional[str] = Query(None, description="箱号（模糊搜索）"),
    current_user: User = Depends(get_current_user),
    tenant_id: int = Depends(get_current_tenant),
) -> List[PackingBindingListResponse]:
    """
    获取装箱绑定记录列表

    - **skip**: 跳过数量
    - **limit**: 限制数量
    - **receipt_id**: 成品入库单ID（可选）
    - **product_id**: 产品ID（可选）
    - **box_no**: 箱号（可选，模糊搜索）
    - **current_user**: 当前用户
    - **tenant_id**: 当前组织ID

    返回装箱绑定记录列表。
    """
    return await packing_binding_service.list_packing_bindings(
        tenant_id=tenant_id,
        skip=skip,
        limit=limit,
        receipt_id=receipt_id,
        product_id=product_id,
        box_no=box_no,
    )


@router.get("/packing-bindings/{binding_id}", response_model=PackingBindingResponse, summary="获取装箱绑定记录详情")
async def get_packing_binding(
    binding_id: int,
    current_user: User = Depends(get_current_user),
    tenant_id: int = Depends(get_current_tenant),
) -> PackingBindingResponse:
    """
    获取装箱绑定记录详情

    - **binding_id**: 装箱绑定记录ID
    - **current_user**: 当前用户
    - **tenant_id**: 当前组织ID

    返回装箱绑定记录详情。
    """
    try:
        return await packing_binding_service.get_packing_binding_by_id(
            tenant_id=tenant_id,
            binding_id=binding_id
        )
    except NotFoundError as e:
        raise HTTPException(status_code=404, detail=str(e))


@router.put("/packing-bindings/{binding_id}", response_model=PackingBindingResponse, summary="更新装箱绑定记录")
async def update_packing_binding(
    binding_id: int,
    binding: PackingBindingUpdate,
    current_user: User = Depends(get_current_user),
    tenant_id: int = Depends(get_current_tenant),
) -> PackingBindingResponse:
    """
    更新装箱绑定记录

    - **binding_id**: 装箱绑定记录ID
    - **binding**: 装箱绑定更新数据
    - **current_user**: 当前用户
    - **tenant_id**: 当前组织ID

    返回更新后的装箱绑定记录信息。
    """
    try:
        return await packing_binding_service.update_packing_binding(
            tenant_id=tenant_id,
            binding_id=binding_id,
            binding_data=binding,
            updated_by=current_user.id
        )
    except NotFoundError as e:
        raise HTTPException(status_code=404, detail=str(e))
    except ValidationError as e:
        raise HTTPException(status_code=400, detail=str(e))


@router.delete("/packing-bindings/{binding_id}", summary="删除装箱绑定记录")
async def delete_packing_binding(
    binding_id: int,
    current_user: User = Depends(get_current_user),
    tenant_id: int = Depends(get_current_tenant),
) -> JSONResponse:
    """
    删除装箱绑定记录（软删除）

    - **binding_id**: 装箱绑定记录ID
    - **current_user**: 当前用户
    - **tenant_id**: 当前组织ID
    """
    try:
        await packing_binding_service.delete_packing_binding(
            tenant_id=tenant_id,
            binding_id=binding_id
        )
        return JSONResponse(content={"message": "删除成功"})
    except NotFoundError as e:
        raise HTTPException(status_code=404, detail=str(e))


# ============ 库存预警管理 API ============

@router.post("/inventory-alert-rules", response_model=InventoryAlertRuleResponse, summary="创建库存预警规则")
async def create_inventory_alert_rule(
    rule_data: InventoryAlertRuleCreate,
    current_user: User = Depends(get_current_user),
    tenant_id: int = Depends(get_current_tenant),
) -> InventoryAlertRuleResponse:
    """
    创建库存预警规则

    - **rule_data**: 预警规则创建数据
    - **current_user**: 当前用户
    - **tenant_id**: 当前组织ID

    返回创建的预警规则信息。
    """
    try:
        return await inventory_alert_rule_service.create_alert_rule(
            tenant_id=tenant_id,
            rule_data=rule_data,
            created_by=current_user.id
        )
    except ValidationError as e:
        raise HTTPException(status_code=400, detail=str(e))


@router.get("/inventory-alert-rules", response_model=List[InventoryAlertRuleListResponse], summary="获取库存预警规则列表")
async def list_inventory_alert_rules(
    skip: int = Query(0, ge=0, description="跳过数量"),
    limit: int = Query(100, ge=1, le=1000, description="限制数量"),
    alert_type: Optional[str] = Query(None, description="预警类型"),
    is_enabled: Optional[bool] = Query(None, description="是否启用"),
    current_user: User = Depends(get_current_user),
    tenant_id: int = Depends(get_current_tenant),
) -> List[InventoryAlertRuleListResponse]:
    """
    获取库存预警规则列表

    - **skip**: 跳过数量
    - **limit**: 限制数量
    - **alert_type**: 预警类型（可选）
    - **is_enabled**: 是否启用（可选）
    - **current_user**: 当前用户
    - **tenant_id**: 当前组织ID

    返回库存预警规则列表。
    """
    return await inventory_alert_rule_service.list_alert_rules(
        tenant_id=tenant_id,
        skip=skip,
        limit=limit,
        alert_type=alert_type,
        is_enabled=is_enabled,
    )


@router.get("/inventory-alert-rules/{rule_id}", response_model=InventoryAlertRuleResponse, summary="获取库存预警规则详情")
async def get_inventory_alert_rule(
    rule_id: int,
    current_user: User = Depends(get_current_user),
    tenant_id: int = Depends(get_current_tenant),
) -> InventoryAlertRuleResponse:
    """
    获取库存预警规则详情

    - **rule_id**: 预警规则ID
    - **current_user**: 当前用户
    - **tenant_id**: 当前组织ID

    返回库存预警规则详情。
    """
    try:
        return await inventory_alert_rule_service.get_alert_rule_by_id(
            tenant_id=tenant_id,
            rule_id=rule_id
        )
    except NotFoundError as e:
        raise HTTPException(status_code=404, detail=str(e))


@router.put("/inventory-alert-rules/{rule_id}", response_model=InventoryAlertRuleResponse, summary="更新库存预警规则")
async def update_inventory_alert_rule(
    rule_id: int,
    rule_data: InventoryAlertRuleUpdate,
    current_user: User = Depends(get_current_user),
    tenant_id: int = Depends(get_current_tenant),
) -> InventoryAlertRuleResponse:
    """
    更新库存预警规则

    - **rule_id**: 预警规则ID
    - **rule_data**: 预警规则更新数据
    - **current_user**: 当前用户
    - **tenant_id**: 当前组织ID

    返回更新后的预警规则信息。
    """
    try:
        return await inventory_alert_rule_service.update_alert_rule(
            tenant_id=tenant_id,
            rule_id=rule_id,
            rule_data=rule_data,
            updated_by=current_user.id
        )
    except NotFoundError as e:
        raise HTTPException(status_code=404, detail=str(e))
    except ValidationError as e:
        raise HTTPException(status_code=400, detail=str(e))


@router.delete("/inventory-alert-rules/{rule_id}", summary="删除库存预警规则")
async def delete_inventory_alert_rule(
    rule_id: int,
    current_user: User = Depends(get_current_user),
    tenant_id: int = Depends(get_current_tenant),
) -> JSONResponse:
    """
    删除库存预警规则（软删除）

    - **rule_id**: 预警规则ID
    - **current_user**: 当前用户
    - **tenant_id**: 当前组织ID
    """
    try:
        await inventory_alert_rule_service.delete_alert_rule(
            tenant_id=tenant_id,
            rule_id=rule_id
        )
        return JSONResponse(content={"message": "删除成功"})
    except NotFoundError as e:
        raise HTTPException(status_code=404, detail=str(e))


@router.get("/inventory-alerts", response_model=List[InventoryAlertListResponse], summary="获取库存预警记录列表")
async def list_inventory_alerts(
    skip: int = Query(0, ge=0, description="跳过数量"),
    limit: int = Query(100, ge=1, le=1000, description="限制数量"),
    alert_type: Optional[str] = Query(None, description="预警类型"),
    status: Optional[str] = Query(None, description="状态"),
    alert_level: Optional[str] = Query(None, description="预警级别"),
    material_id: Optional[int] = Query(None, description="物料ID"),
    warehouse_id: Optional[int] = Query(None, description="仓库ID"),
    current_user: User = Depends(get_current_user),
    tenant_id: int = Depends(get_current_tenant),
) -> List[InventoryAlertListResponse]:
    """
    获取库存预警记录列表

    - **skip**: 跳过数量
    - **limit**: 限制数量
    - **alert_type**: 预警类型（可选）
    - **status**: 状态（可选）
    - **alert_level**: 预警级别（可选）
    - **material_id**: 物料ID（可选）
    - **warehouse_id**: 仓库ID（可选）
    - **current_user**: 当前用户
    - **tenant_id**: 当前组织ID

    返回库存预警记录列表。
    """
    return await inventory_alert_service.get_alerts(
        tenant_id=tenant_id,
        skip=skip,
        limit=limit,
        alert_type=alert_type,
        status=status,
        alert_level=alert_level,
        material_id=material_id,
        warehouse_id=warehouse_id,
    )


@router.get("/inventory-alerts/{alert_id}", response_model=InventoryAlertResponse, summary="获取库存预警记录详情")
async def get_inventory_alert(
    alert_id: int,
    current_user: User = Depends(get_current_user),
    tenant_id: int = Depends(get_current_tenant),
) -> InventoryAlertResponse:
    """
    获取库存预警记录详情

    - **alert_id**: 预警记录ID
    - **current_user**: 当前用户
    - **tenant_id**: 当前组织ID

    返回库存预警记录详情。
    """
    try:
        return await inventory_alert_service.get_alert_by_id(
            tenant_id=tenant_id,
            alert_id=alert_id
        )
    except NotFoundError as e:
        raise HTTPException(status_code=404, detail=str(e))


@router.post("/inventory-alerts/{alert_id}/handle", response_model=InventoryAlertResponse, summary="处理库存预警")
async def handle_inventory_alert(
    alert_id: int,
    handle_data: InventoryAlertHandleRequest,
    current_user: User = Depends(get_current_user),
    tenant_id: int = Depends(get_current_tenant),
) -> InventoryAlertResponse:
    """
    处理库存预警

    - **alert_id**: 预警记录ID
    - **handle_data**: 处理数据（状态、处理备注）
    - **current_user**: 当前用户
    - **tenant_id**: 当前组织ID

    返回更新后的预警记录信息。
    """
    try:
        return await inventory_alert_service.handle_alert(
            tenant_id=tenant_id,
            alert_id=alert_id,
            handle_data=handle_data,
            handled_by=current_user.id
        )
    except NotFoundError as e:
        raise HTTPException(status_code=404, detail=str(e))
    except ValidationError as e:
        raise HTTPException(status_code=400, detail=str(e))


@router.get("/inventory-alerts/statistics", summary="获取库存预警统计信息")
async def get_inventory_alert_statistics(
    current_user: User = Depends(get_current_user),
    tenant_id: int = Depends(get_current_tenant),
) -> JSONResponse:
    """
    获取库存预警统计信息

    - **current_user**: 当前用户
    - **tenant_id**: 当前组织ID

    返回库存预警统计信息（按类型、级别、状态统计）。
    """
    statistics = await inventory_alert_service.get_alert_statistics(tenant_id=tenant_id)
    return JSONResponse(content=statistics)


# ============ 库存报表分析 API ============

@router.get("/inventory-analysis", summary="获取库存分析数据")
async def get_inventory_analysis(
    date_start: Optional[str] = Query(None, description="开始日期（YYYY-MM-DD）"),
    date_end: Optional[str] = Query(None, description="结束日期（YYYY-MM-DD）"),
    warehouse_id: Optional[int] = Query(None, description="仓库ID"),
    current_user: User = Depends(get_current_user),
    tenant_id: int = Depends(get_current_tenant),
) -> JSONResponse:
    """
    获取库存分析数据

    - **date_start**: 开始日期（可选）
    - **date_end**: 结束日期（可选）
    - **warehouse_id**: 仓库ID（可选）
    - **current_user**: 当前用户
    - **tenant_id**: 当前组织ID

    返回库存分析数据（周转率、ABC分析、呆滞料分析）。
    """
    from datetime import datetime

    date_start_dt = None
    date_end_dt = None

    if date_start:
        try:
            date_start_dt = datetime.strptime(date_start, "%Y-%m-%d")
        except ValueError:
            raise HTTPException(status_code=400, detail="开始日期格式错误，应为YYYY-MM-DD")

    if date_end:
        try:
            date_end_dt = datetime.strptime(date_end, "%Y-%m-%d")
        except ValueError:
            raise HTTPException(status_code=400, detail="结束日期格式错误，应为YYYY-MM-DD")

    analysis_data = await inventory_analysis_service.get_inventory_analysis(
        tenant_id=tenant_id,
        date_start=date_start_dt,
        date_end=date_end_dt,
        warehouse_id=warehouse_id,
    )

    return JSONResponse(content=analysis_data)


@router.get("/inventory-analysis/cost", summary="获取库存成本分析")
async def get_inventory_cost_analysis(
    date_start: Optional[str] = Query(None, description="开始日期（YYYY-MM-DD）"),
    date_end: Optional[str] = Query(None, description="结束日期（YYYY-MM-DD）"),
    warehouse_id: Optional[int] = Query(None, description="仓库ID"),
    current_user: User = Depends(get_current_user),
    tenant_id: int = Depends(get_current_tenant),
) -> JSONResponse:
    """
    获取库存成本分析

    - **date_start**: 开始日期（可选）
    - **date_end**: 结束日期（可选）
    - **warehouse_id**: 仓库ID（可选）
    - **current_user**: 当前用户
    - **tenant_id**: 当前组织ID

    返回库存成本分析数据（总成本、平均成本、成本趋势、按类别/仓库分组）。
    """
    from datetime import datetime

    date_start_dt = None
    date_end_dt = None

    if date_start:
        try:
            date_start_dt = datetime.strptime(date_start, "%Y-%m-%d")
        except ValueError:
            raise HTTPException(status_code=400, detail="开始日期格式错误，应为YYYY-MM-DD")

    if date_end:
        try:
            date_end_dt = datetime.strptime(date_end, "%Y-%m-%d")
        except ValueError:
            raise HTTPException(status_code=400, detail="结束日期格式错误，应为YYYY-MM-DD")

    cost_analysis = await inventory_analysis_service.get_inventory_cost_analysis(
        tenant_id=tenant_id,
        date_start=date_start_dt,
        date_end=date_end_dt,
        warehouse_id=warehouse_id,
    )

    return JSONResponse(content=cost_analysis)


@router.delete("/packing-binding/{binding_id}", summary="删除装箱绑定记录（旧接口，保留兼容）")
async def delete_packing_binding_old(
    binding_id: int,
    current_user: User = Depends(get_current_user),
    tenant_id: int = Depends(get_current_tenant),
) -> JSONResponse:
    """
    删除装箱绑定记录（软删除）

    - **binding_id**: 装箱绑定记录ID
    """
    await packing_binding_service.delete_packing_binding(
        tenant_id=tenant_id,
        binding_id=binding_id
    )

    return JSONResponse(
        content={"message": "装箱绑定记录删除成功"},
        status_code=status.HTTP_200_OK
    )


# ============ 客户来料登记 API ============

@router.post("/inventory/customer-material-registration/parse-barcode", response_model=ParseBarcodeResponse, summary="解析客户来料条码")
async def parse_customer_material_barcode(
    parse_request: ParseBarcodeRequest,
    current_user: User = Depends(get_current_user),
    tenant_id: int = Depends(get_current_tenant),
) -> ParseBarcodeResponse:
    """
    解析客户来料条码

    解析客户来料的一维码或二维码，并尝试映射到内部物料。

    - **parse_request**: 解析条码请求（条码、条码类型、客户ID等）
    """
    return await customer_material_registration_service.parse_barcode(
        tenant_id=tenant_id,
        parse_request=parse_request
    )


@router.post("/inventory/customer-material-registration", response_model=CustomerMaterialRegistrationResponse, summary="客户来料登记")
async def create_customer_material_registration(
    registration_data: CustomerMaterialRegistrationCreate,
    current_user: User = Depends(get_current_user),
    tenant_id: int = Depends(get_current_tenant),
) -> CustomerMaterialRegistrationResponse:
    """
    客户来料登记

    登记客户来料信息，支持扫码识别和条码映射。

    - **registration_data**: 登记创建数据（客户、条码、数量等）
    """
    return await customer_material_registration_service.create_registration(
        tenant_id=tenant_id,
        registration_data=registration_data,
        registered_by=current_user.id
    )


@router.get("/inventory/customer-material-registration", response_model=List[CustomerMaterialRegistrationListResponse], summary="获取客户来料登记列表")
async def list_customer_material_registrations(
    skip: int = Query(0, description="跳过数量"),
    limit: int = Query(100, description="限制数量"),
    customer_id: Optional[int] = Query(None, description="客户ID"),
    status: Optional[str] = Query(None, description="状态"),
    registration_date_start: Optional[str] = Query(None, description="登记开始日期（ISO格式）"),
    registration_date_end: Optional[str] = Query(None, description="登记结束日期（ISO格式）"),
    current_user: User = Depends(get_current_user),
    tenant_id: int = Depends(get_current_tenant),
) -> List[CustomerMaterialRegistrationListResponse]:
    """
    获取客户来料登记列表

    支持多种筛选条件的高级搜索。
    """
    from datetime import datetime

    # 转换时间参数
    date_start_dt = None
    date_end_dt = None

    if registration_date_start:
        try:
            date_start_dt = datetime.fromisoformat(registration_date_start.replace('Z', '+00:00'))
        except ValueError:
            pass

    if registration_date_end:
        try:
            date_end_dt = datetime.fromisoformat(registration_date_end.replace('Z', '+00:00'))
        except ValueError:
            pass

    return await customer_material_registration_service.list_registrations(
        tenant_id=tenant_id,
        skip=skip,
        limit=limit,
        customer_id=customer_id,
        status=status,
        registration_date_start=date_start_dt,
        registration_date_end=date_end_dt,
    )


@router.get("/inventory/customer-material-registration/{registration_id}", response_model=CustomerMaterialRegistrationResponse, summary="获取客户来料登记详情")
async def get_customer_material_registration(
    registration_id: int,
    current_user: User = Depends(get_current_user),
    tenant_id: int = Depends(get_current_tenant),
) -> CustomerMaterialRegistrationResponse:
    """
    获取客户来料登记详情

    - **registration_id**: 登记记录ID
    - **current_user**: 当前用户
    - **tenant_id**: 当前组织ID

    返回客户来料登记详情。
    """
    try:
        return await customer_material_registration_service.get_registration_by_id(
            tenant_id=tenant_id,
            registration_id=registration_id
        )
    except NotFoundError as e:
        raise HTTPException(status_code=404, detail=str(e))


@router.post("/inventory/customer-material-registration/{registration_id}/process", response_model=CustomerMaterialRegistrationResponse, summary="处理客户来料登记（入库）")
async def process_customer_material_registration(
    registration_id: int,
    current_user: User = Depends(get_current_user),
    tenant_id: int = Depends(get_current_tenant),
) -> CustomerMaterialRegistrationResponse:
    """
    处理客户来料登记（入库）

    - **registration_id**: 登记记录ID
    - **current_user**: 当前用户
    - **tenant_id**: 当前组织ID

    将客户来料登记状态更新为已处理，并执行入库操作。
    """
    try:
        return await customer_material_registration_service.process_registration(
            tenant_id=tenant_id,
            registration_id=registration_id,
            processed_by=current_user.id
        )
    except NotFoundError as e:
        raise HTTPException(status_code=404, detail=str(e))
    except BusinessLogicError as e:
        raise HTTPException(status_code=400, detail=str(e))


@router.post("/inventory/customer-material-registration/{registration_id}/cancel", response_model=CustomerMaterialRegistrationResponse, summary="取消客户来料登记")
async def cancel_customer_material_registration(
    registration_id: int,
    current_user: User = Depends(get_current_user),
    tenant_id: int = Depends(get_current_tenant),
) -> CustomerMaterialRegistrationResponse:
    """
    取消客户来料登记

    - **registration_id**: 登记记录ID
    - **current_user**: 当前用户
    - **tenant_id**: 当前组织ID

    将客户来料登记状态更新为已取消。
    """
    try:
        return await customer_material_registration_service.cancel_registration(
            tenant_id=tenant_id,
            registration_id=registration_id,
            cancelled_by=current_user.id
        )
    except NotFoundError as e:
        raise HTTPException(status_code=404, detail=str(e))
    except BusinessLogicError as e:
        raise HTTPException(status_code=400, detail=str(e))


@router.post("/inventory/customer-material-registration/mapping-rules", response_model=BarcodeMappingRuleResponse, summary="创建条码映射规则")
async def create_barcode_mapping_rule(
    rule_data: BarcodeMappingRuleCreate,
    current_user: User = Depends(get_current_user),
    tenant_id: int = Depends(get_current_tenant),
) -> BarcodeMappingRuleResponse:
    """
    创建条码映射规则

    - **rule_data**: 映射规则创建数据（条码模式、映射物料、解析规则等）
    """
    return await barcode_mapping_rule_service.create_mapping_rule(
        tenant_id=tenant_id,
        rule_data=rule_data,
        created_by=current_user.id
    )


@router.get("/inventory/customer-material-registration/mapping-rules", response_model=List[BarcodeMappingRuleListResponse], summary="获取条码映射规则列表")
async def list_barcode_mapping_rules(
    skip: int = Query(0, description="跳过数量"),
    limit: int = Query(100, description="限制数量"),
    customer_id: Optional[int] = Query(None, description="客户ID"),
    is_enabled: Optional[bool] = Query(None, description="是否启用"),
    current_user: User = Depends(get_current_user),
    tenant_id: int = Depends(get_current_tenant),
) -> List[BarcodeMappingRuleListResponse]:
    """
    获取条码映射规则列表

    支持多种筛选条件的高级搜索。
    """
    return await barcode_mapping_rule_service.list_mapping_rules(
        tenant_id=tenant_id,
        skip=skip,
        limit=limit,
        customer_id=customer_id,
        is_enabled=is_enabled,
    )


# ============ 销售出库管理 API ============

@router.post("/sales-deliveries", response_model=SalesDeliveryResponse, summary="创建销售出库单")
async def create_sales_delivery(
    delivery: SalesDeliveryCreate,
    current_user: User = Depends(get_current_user),
    tenant_id: int = Depends(get_current_tenant),
) -> SalesDeliveryResponse:
    """
    创建销售出库单

    - **delivery**: 出库单创建数据
    - **current_user**: 当前用户
    - **tenant_id**: 当前组织ID

    返回创建的销售出库单信息。
    """
    return await SalesDeliveryService().create_sales_delivery(
        tenant_id=tenant_id,
        delivery_data=delivery,
        created_by=current_user.id
    )


@router.get("/sales-deliveries", response_model=List[SalesDeliveryResponse], summary="获取销售出库单列表")
async def list_sales_deliveries(
    skip: int = Query(0, ge=0, description="跳过数量"),
    limit: int = Query(100, ge=1, le=1000, description="限制数量"),
    status: Optional[str] = Query(None, description="出库状态"),
    sales_order_id: Optional[int] = Query(None, description="销售订单ID"),
    current_user: User = Depends(get_current_user),
    tenant_id: int = Depends(get_current_tenant),
) -> List[SalesDeliveryResponse]:
    """
    获取销售出库单列表

    支持状态和销售订单筛选。
    """
    return await SalesDeliveryService().list_sales_deliveries(
        tenant_id=tenant_id,
        skip=skip,
        limit=limit,
        status=status,
        sales_order_id=sales_order_id,
    )


@router.get("/sales-deliveries/{delivery_id}", response_model=SalesDeliveryResponse, summary="获取销售出库单详情")
async def get_sales_delivery(
    delivery_id: int,
    current_user: User = Depends(get_current_user),
    tenant_id: int = Depends(get_current_tenant),
) -> SalesDeliveryResponse:
    """
    根据ID获取销售出库单详情

    - **delivery_id**: 出库单ID
    """
    return await SalesDeliveryService().get_sales_delivery_by_id(
        tenant_id=tenant_id,
        delivery_id=delivery_id
    )


@router.post("/sales-deliveries/{delivery_id}/confirm", response_model=SalesDeliveryResponse, summary="确认销售出库")
async def confirm_sales_delivery(
    delivery_id: int,
    current_user: User = Depends(get_current_user),
    tenant_id: int = Depends(get_current_tenant),
) -> SalesDeliveryResponse:
    """
    确认销售出库

    - **delivery_id**: 出库单ID
    """
    return await SalesDeliveryService().confirm_delivery(
        tenant_id=tenant_id,
        delivery_id=delivery_id,
        confirmed_by=current_user.id
    )


@router.post("/sales-deliveries/pull-from-sales-order", response_model=SalesDeliveryResponse, summary="从销售订单上拉生成销售出库单")
async def pull_sales_delivery_from_order(
    request: Dict[str, Any],
    current_user: User = Depends(get_current_user),
    tenant_id: int = Depends(get_current_tenant),
) -> SalesDeliveryResponse:
    """
    从销售订单上拉生成销售出库单
    
    - **sales_order_id**: 销售订单ID（必填）
    - **delivery_quantities**: 出库数量字典 {item_id: quantity}（可选）
    - **warehouse_id**: 出库仓库ID（必填）
    - **warehouse_name**: 出库仓库名称（可选）
    """
    sales_order_id = request.get('sales_order_id')
    if not sales_order_id:
        raise ValidationError("必须提供销售订单ID")
    
    delivery_quantities = request.get('delivery_quantities')
    warehouse_id = request.get('warehouse_id')
    warehouse_name = request.get('warehouse_name')
    
    if not warehouse_id:
        raise ValidationError("必须提供出库仓库ID")
    
    return await SalesDeliveryService().pull_from_sales_order(
        tenant_id=tenant_id,
        sales_order_id=sales_order_id,
        created_by=current_user.id,
        delivery_quantities=delivery_quantities,
        warehouse_id=warehouse_id,
        warehouse_name=warehouse_name
    )


@router.post("/sales-deliveries/pull-from-sales-forecast", response_model=SalesDeliveryResponse, summary="从销售预测上拉生成销售出库单")
async def pull_sales_delivery_from_forecast(
    request: Dict[str, Any],
    current_user: User = Depends(get_current_user),
    tenant_id: int = Depends(get_current_tenant),
) -> SalesDeliveryResponse:
    """
    从销售预测上拉生成销售出库单（MTS模式）
    
    - **sales_forecast_id**: 销售预测ID（必填）
    - **delivery_quantities**: 出库数量字典 {item_id: quantity}（可选）
    - **warehouse_id**: 出库仓库ID（必填）
    - **warehouse_name**: 出库仓库名称（可选）
    """
    sales_forecast_id = request.get('sales_forecast_id')
    if not sales_forecast_id:
        raise ValidationError("必须提供销售预测ID")
    
    delivery_quantities = request.get('delivery_quantities')
    warehouse_id = request.get('warehouse_id')
    warehouse_name = request.get('warehouse_name')
    
    if not warehouse_id:
        raise ValidationError("必须提供出库仓库ID")
    
    return await SalesDeliveryService().pull_from_sales_forecast(
        tenant_id=tenant_id,
        sales_forecast_id=sales_forecast_id,
        created_by=current_user.id,
        delivery_quantities=delivery_quantities,
        warehouse_id=warehouse_id,
        warehouse_name=warehouse_name
    )


@router.post("/sales-deliveries/import", summary="批量导入销售出库单")
async def import_sales_deliveries(
    request: Dict[str, Any],
    current_user: User = Depends(get_current_user),
    tenant_id: int = Depends(get_current_tenant),
):
    """
    批量导入销售出库单
    
    接收前端 uni_import 组件传递的二维数组数据，批量创建销售出库单。
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
        
        service = SalesDeliveryService()
        result = await service.import_from_data(
            tenant_id=tenant_id,
            data=data,
            created_by=current_user.id
        )
        
        return result
                
    except ValidationError as e:
        raise HTTPException(
            status_code=status.HTTP_422_UNPROCESSABLE_ENTITY,
            detail=str(e)
        )
    except Exception as e:
        logger.error(f"导入销售出库单失败: {str(e)}")
        raise HTTPException(
            status_code=status.HTTP_500_INTERNAL_SERVER_ERROR,
            detail=f"导入失败: {str(e)}"
        )


@router.get("/sales-deliveries/export", response_class=FileResponse, summary="批量导出销售出库单")
async def export_sales_deliveries(
    status: Optional[str] = Query(None, description="出库状态筛选"),
    sales_order_id: Optional[int] = Query(None, description="销售订单ID筛选"),
    current_user: User = Depends(get_current_user),
    tenant_id: int = Depends(get_current_tenant),
):
    """
    批量导出销售出库单到Excel文件
    
    Args:
        status: 出库状态筛选
        sales_order_id: 销售订单ID筛选
        current_user: 当前用户（依赖注入）
        tenant_id: 当前组织ID（依赖注入）
        
    Returns:
        FileResponse: Excel文件
    """
    from fastapi import HTTPException
    from fastapi.responses import FileResponse
    import os
    
    try:
        service = SalesDeliveryService()
        file_path = await service.export_to_excel(
            tenant_id=tenant_id,
            status=status,
            sales_order_id=sales_order_id,
        )
        return FileResponse(
            path=file_path,
            filename=os.path.basename(file_path),
            media_type="application/vnd.openxmlformats-officedocument.spreadsheetml.sheet"
        )
    except Exception as e:
        logger.error(f"导出销售出库单失败: {str(e)}")
        raise HTTPException(
            status_code=status.HTTP_500_INTERNAL_SERVER_ERROR,
            detail=f"导出失败: {str(e)}"
        )


@router.get("/sales-deliveries/{delivery_id}/print", summary="打印销售出库单")
async def print_sales_delivery(
    delivery_id: int,
    template_uuid: Optional[str] = Query(None, description="打印模板UUID（可选，如果不提供则使用默认模板）"),
    current_user: User = Depends(get_current_user),
    tenant_id: int = Depends(get_current_tenant),
):
    """
    打印销售出库单
    
    使用打印模板服务渲染销售出库单，支持自定义模板。
    如果不提供模板UUID，将使用默认的销售出库单打印模板。
    
    Args:
        delivery_id: 销售出库单ID
        template_uuid: 打印模板UUID（可选）
        current_user: 当前用户（依赖注入）
        tenant_id: 当前组织ID（依赖注入）
        
    Returns:
        dict: 打印结果（包含渲染后的内容）
    """
    from fastapi import HTTPException
    from core.services.print.print_template_service import PrintTemplateService
    from core.schemas.print_template import PrintTemplateRenderRequest
    from apps.kuaizhizao.models.sales_delivery_item import SalesDeliveryItem
    
    try:
        # 获取销售出库单详情
        service = SalesDeliveryService()
        delivery = await service.get_sales_delivery_by_id(tenant_id, delivery_id)
        
        # 获取出库单明细
        items = await SalesDeliveryItem.filter(
            tenant_id=tenant_id,
            delivery_id=delivery_id
        ).all()
        
        # 构建打印数据
        print_data = {
            "delivery_code": delivery.delivery_code,
            "sales_order_code": delivery.sales_order_code or "",
            "customer_name": delivery.customer_name or "",
            "warehouse_name": delivery.warehouse_name or "",
            "delivery_time": delivery.delivery_time.strftime("%Y-%m-%d %H:%M:%S") if delivery.delivery_time else "",
            "status": delivery.status,
            "total_quantity": str(delivery.total_quantity) if delivery.total_quantity else "0",
            "total_amount": str(delivery.total_amount) if delivery.total_amount else "0",
            "shipping_method": delivery.shipping_method or "",
            "tracking_number": delivery.tracking_number or "",
            "shipping_address": delivery.shipping_address or "",
            "notes": delivery.notes or "",
            "items": [
                {
                    "material_code": item.material_code,
                    "material_name": item.material_name,
                    "delivery_quantity": str(item.delivery_quantity),
                    "material_unit": item.material_unit,
                    "unit_price": str(item.unit_price),
                    "total_amount": str(item.total_amount),
                    "batch_number": item.batch_number or "",
                    "location_code": item.location_code or "",
                }
                for item in items
            ],
            "created_at": delivery.created_at.strftime("%Y-%m-%d %H:%M:%S") if delivery.created_at else "",
        }
        
        # 如果没有提供模板UUID，尝试查找默认模板
        if not template_uuid:
            # TODO: 从配置或数据库查找默认的销售出库单打印模板
            # 这里暂时返回打印数据，前端可以自行处理
            return {
                "success": True,
                "data": print_data,
                "message": "打印数据已准备，请在前端使用打印模板渲染"
            }
        
        # 使用指定的模板渲染
        render_request = PrintTemplateRenderRequest(
            data=print_data,
            output_format="html",  # 默认HTML格式，前端可以转换为PDF
            async_execution=False
        )
        
        result = await PrintTemplateService.render_print_template(
            tenant_id=tenant_id,
            uuid=template_uuid,
            data=render_request
        )
        
        return {
            "success": True,
            "content": result.get("rendered_content", ""),
            "data": print_data
        }
        
    except Exception as e:
        logger.error(f"打印销售出库单失败: {str(e)}")
        raise HTTPException(
            status_code=status.HTTP_500_INTERNAL_SERVER_ERROR,
            detail=f"打印失败: {str(e)}"
        )


# ==================== 销售退货API ====================

@router.post("/sales-returns", response_model=SalesReturnResponse, summary="创建销售退货单")
async def create_sales_return(
    return_data: SalesReturnCreate,
    current_user: User = Depends(get_current_user),
    tenant_id: int = Depends(get_current_tenant),
) -> SalesReturnResponse:
    """
    创建销售退货单

    - **return_data**: 销售退货单数据
    """
    return await SalesReturnService().create_sales_return(
        tenant_id=tenant_id,
        return_data=return_data,
        created_by=current_user.id
    )


@router.get("/sales-returns", response_model=List[SalesReturnResponse], summary="获取销售退货单列表")
async def list_sales_returns(
    skip: int = Query(0, ge=0, description="跳过数量"),
    limit: int = Query(20, ge=1, le=100, description="限制数量"),
    status: Optional[str] = Query(None, description="退货状态筛选"),
    sales_delivery_id: Optional[int] = Query(None, description="销售出库单ID筛选"),
    customer_id: Optional[int] = Query(None, description="客户ID筛选"),
    current_user: User = Depends(get_current_user),
    tenant_id: int = Depends(get_current_tenant),
) -> List[SalesReturnResponse]:
    """
    获取销售退货单列表

    - **skip**: 跳过数量
    - **limit**: 限制数量
    - **status**: 退货状态筛选
    - **sales_delivery_id**: 销售出库单ID筛选
    - **customer_id**: 客户ID筛选
    """
    filters = {}
    if status:
        filters['status'] = status
    if sales_delivery_id:
        filters['sales_delivery_id'] = sales_delivery_id
    if customer_id:
        filters['customer_id'] = customer_id
    
    return await SalesReturnService().list_sales_returns(
        tenant_id=tenant_id,
        skip=skip,
        limit=limit,
        **filters
    )


@router.get("/sales-returns/{return_id}", response_model=SalesReturnResponse, summary="获取销售退货单详情")
async def get_sales_return(
    return_id: int = Path(..., description="退货单ID"),
    current_user: User = Depends(get_current_user),
    tenant_id: int = Depends(get_current_tenant),
) -> SalesReturnResponse:
    """
    获取销售退货单详情

    - **return_id**: 退货单ID
    """
    return await SalesReturnService().get_sales_return_by_id(
        tenant_id=tenant_id,
        return_id=return_id
    )


@router.post("/sales-returns/{return_id}/confirm", response_model=SalesReturnResponse, summary="确认销售退货")
async def confirm_sales_return(
    return_id: int,
    current_user: User = Depends(get_current_user),
    tenant_id: int = Depends(get_current_tenant),
) -> SalesReturnResponse:
    """
    确认销售退货

    - **return_id**: 退货单ID
    """
    return await SalesReturnService().confirm_return(
        tenant_id=tenant_id,
        return_id=return_id,
        confirmed_by=current_user.id
    )


# ============ 采购入库管理 API ============

@router.post("/purchase-receipts", response_model=PurchaseReceiptResponse, summary="创建采购入库单")
async def create_purchase_receipt(
    receipt: PurchaseReceiptCreate,
    current_user: User = Depends(get_current_user),
    tenant_id: int = Depends(get_current_tenant),
) -> PurchaseReceiptResponse:
    """
    创建采购入库单

    - **receipt**: 入库单创建数据
    - **current_user**: 当前用户
    - **tenant_id**: 当前组织ID

    返回创建的采购入库单信息。
    """
    return await PurchaseReceiptService.create_purchase_receipt(
        tenant_id=tenant_id,
        receipt_data=receipt,
        created_by=current_user.id
    )


@router.get("/purchase-receipts", response_model=List[PurchaseReceiptResponse], summary="获取采购入库单列表")
async def list_purchase_receipts(
    skip: int = Query(0, ge=0, description="跳过数量"),
    limit: int = Query(100, ge=1, le=1000, description="限制数量"),
    status: Optional[str] = Query(None, description="入库状态"),
    purchase_order_id: Optional[int] = Query(None, description="采购订单ID"),
    current_user: User = Depends(get_current_user),
    tenant_id: int = Depends(get_current_tenant),
) -> List[PurchaseReceiptResponse]:
    """
    获取采购入库单列表

    支持状态和采购订单筛选。
    """
    return await PurchaseReceiptService.list_purchase_receipts(
        tenant_id=tenant_id,
        skip=skip,
        limit=limit,
        status=status,
        purchase_order_id=purchase_order_id,
    )


@router.get("/purchase-receipts/{receipt_id}", response_model=PurchaseReceiptResponse, summary="获取采购入库单详情")
async def get_purchase_receipt(
    receipt_id: int,
    current_user: User = Depends(get_current_user),
    tenant_id: int = Depends(get_current_tenant),
) -> PurchaseReceiptResponse:
    """
    根据ID获取采购入库单详情

    - **receipt_id**: 入库单ID
    """
    return await PurchaseReceiptService.get_purchase_receipt_by_id(
        tenant_id=tenant_id,
        receipt_id=receipt_id
    )


@router.post("/purchase-receipts/{receipt_id}/confirm", response_model=PurchaseReceiptResponse, summary="确认采购入库")
async def confirm_purchase_receipt(
    receipt_id: int,
    current_user: User = Depends(get_current_user),
    tenant_id: int = Depends(get_current_tenant),
) -> PurchaseReceiptResponse:
    """
    确认采购入库

    - **receipt_id**: 入库单ID
    """
    return await PurchaseReceiptService().confirm_receipt(
        tenant_id=tenant_id,
        receipt_id=receipt_id,
        confirmed_by=current_user.id
    )


@router.post("/purchase-receipts/import", summary="批量导入采购入库单")
async def import_purchase_receipts(
    request: Dict[str, Any],
    current_user: User = Depends(get_current_user),
    tenant_id: int = Depends(get_current_tenant),
):
    """
    批量导入采购入库单
    
    接收前端 uni_import 组件传递的二维数组数据，批量创建采购入库单。
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
        
        service = PurchaseReceiptService()
        result = await service.import_from_data(
            tenant_id=tenant_id,
            data=data,
            created_by=current_user.id
        )
        
        return result
                
    except ValidationError as e:
        raise HTTPException(
            status_code=status.HTTP_422_UNPROCESSABLE_ENTITY,
            detail=str(e)
        )
    except Exception as e:
        logger.error(f"导入采购入库单失败: {str(e)}")
        raise HTTPException(
            status_code=status.HTTP_500_INTERNAL_SERVER_ERROR,
            detail=f"导入失败: {str(e)}"
        )


@router.get("/purchase-receipts/export", response_class=FileResponse, summary="批量导出采购入库单")
async def export_purchase_receipts(
    status: Optional[str] = Query(None, description="入库状态筛选"),
    purchase_order_id: Optional[int] = Query(None, description="采购订单ID筛选"),
    current_user: User = Depends(get_current_user),
    tenant_id: int = Depends(get_current_tenant),
):
    """
    批量导出采购入库单到Excel文件
    
    Args:
        status: 入库状态筛选
        purchase_order_id: 采购订单ID筛选
        current_user: 当前用户（依赖注入）
        tenant_id: 当前组织ID（依赖注入）
        
    Returns:
        FileResponse: Excel文件
    """
    from fastapi import HTTPException
    from fastapi.responses import FileResponse
    import os
    
    try:
        service = PurchaseReceiptService()
        file_path = await service.export_to_excel(
            tenant_id=tenant_id,
            status=status,
            purchase_order_id=purchase_order_id,
        )
        return FileResponse(
            path=file_path,
            filename=os.path.basename(file_path),
            media_type="application/vnd.openxmlformats-officedocument.spreadsheetml.sheet"
        )
    except Exception as e:
        logger.error(f"导出采购入库单失败: {str(e)}")
        raise HTTPException(
            status_code=status.HTTP_500_INTERNAL_SERVER_ERROR,
            detail=f"导出失败: {str(e)}"
        )


# ==================== 采购退货API ====================

@router.post("/purchase-returns", response_model=PurchaseReturnResponse, summary="创建采购退货单")
async def create_purchase_return(
    return_data: PurchaseReturnCreate,
    current_user: User = Depends(get_current_user),
    tenant_id: int = Depends(get_current_tenant),
) -> PurchaseReturnResponse:
    """
    创建采购退货单

    - **return_data**: 采购退货单数据
    """
    return await PurchaseReturnService().create_purchase_return(
        tenant_id=tenant_id,
        return_data=return_data,
        created_by=current_user.id
    )


@router.get("/purchase-returns", response_model=List[PurchaseReturnResponse], summary="获取采购退货单列表")
async def list_purchase_returns(
    skip: int = Query(0, ge=0, description="跳过数量"),
    limit: int = Query(20, ge=1, le=100, description="限制数量"),
    status: Optional[str] = Query(None, description="退货状态筛选"),
    purchase_receipt_id: Optional[int] = Query(None, description="采购入库单ID筛选"),
    supplier_id: Optional[int] = Query(None, description="供应商ID筛选"),
    current_user: User = Depends(get_current_user),
    tenant_id: int = Depends(get_current_tenant),
) -> List[PurchaseReturnResponse]:
    """
    获取采购退货单列表

    - **skip**: 跳过数量
    - **limit**: 限制数量
    - **status**: 退货状态筛选
    - **purchase_receipt_id**: 采购入库单ID筛选
    - **supplier_id**: 供应商ID筛选
    """
    filters = {}
    if status:
        filters['status'] = status
    if purchase_receipt_id:
        filters['purchase_receipt_id'] = purchase_receipt_id
    if supplier_id:
        filters['supplier_id'] = supplier_id
    
    return await PurchaseReturnService().list_purchase_returns(
        tenant_id=tenant_id,
        skip=skip,
        limit=limit,
        **filters
    )


@router.get("/purchase-returns/{return_id}", response_model=PurchaseReturnResponse, summary="获取采购退货单详情")
async def get_purchase_return(
    return_id: int = Path(..., description="退货单ID"),
    current_user: User = Depends(get_current_user),
    tenant_id: int = Depends(get_current_tenant),
) -> PurchaseReturnResponse:
    """
    获取采购退货单详情

    - **return_id**: 退货单ID
    """
    return await PurchaseReturnService().get_purchase_return_by_id(
        tenant_id=tenant_id,
        return_id=return_id
    )


@router.post("/purchase-returns/{return_id}/confirm", response_model=PurchaseReturnResponse, summary="确认采购退货")
async def confirm_purchase_return(
    return_id: int,
    current_user: User = Depends(get_current_user),
    tenant_id: int = Depends(get_current_tenant),
) -> PurchaseReturnResponse:
    """
    确认采购退货

    - **return_id**: 退货单ID
    """
    return await PurchaseReturnService().confirm_return(
        tenant_id=tenant_id,
        return_id=return_id,
        confirmed_by=current_user.id
    )


# ==================== 补货建议API ====================

@router.post("/replenishment-suggestions/generate-from-alerts", response_model=List[ReplenishmentSuggestionResponse], summary="基于库存预警生成补货建议")
async def generate_replenishment_suggestions_from_alerts(
    request: Dict[str, Any] = Body(default={}),
    current_user: User = Depends(get_current_user),
    tenant_id: int = Depends(get_current_tenant),
) -> List[ReplenishmentSuggestionResponse]:
    """
    基于库存预警生成补货建议

    - **alert_ids**: 预警ID列表（可选，如果不提供则处理所有待处理的低库存预警）
    """
    alert_ids = request.get('alert_ids')
    return await ReplenishmentSuggestionService().generate_suggestions_from_alerts(
        tenant_id=tenant_id,
        alert_ids=alert_ids
    )


@router.get("/replenishment-suggestions", response_model=List[ReplenishmentSuggestionListResponse], summary="获取补货建议列表")
async def list_replenishment_suggestions(
    skip: int = Query(0, ge=0, description="跳过数量"),
    limit: int = Query(100, ge=1, le=200, description="限制数量"),
    status: Optional[str] = Query(None, description="状态筛选"),
    priority: Optional[str] = Query(None, description="优先级筛选"),
    suggestion_type: Optional[str] = Query(None, description="建议类型筛选"),
    material_id: Optional[int] = Query(None, description="物料ID筛选"),
    warehouse_id: Optional[int] = Query(None, description="仓库ID筛选"),
    current_user: User = Depends(get_current_user),
    tenant_id: int = Depends(get_current_tenant),
) -> List[ReplenishmentSuggestionListResponse]:
    """
    获取补货建议列表

    - **skip**: 跳过数量
    - **limit**: 限制数量
    - **status**: 状态筛选
    - **priority**: 优先级筛选
    - **suggestion_type**: 建议类型筛选
    - **material_id**: 物料ID筛选
    - **warehouse_id**: 仓库ID筛选
    """
    return await ReplenishmentSuggestionService().get_suggestions(
        tenant_id=tenant_id,
        skip=skip,
        limit=limit,
        status=status,
        priority=priority,
        suggestion_type=suggestion_type,
        material_id=material_id,
        warehouse_id=warehouse_id,
    )


@router.get("/replenishment-suggestions/{suggestion_id}", response_model=ReplenishmentSuggestionResponse, summary="获取补货建议详情")
async def get_replenishment_suggestion(
    suggestion_id: int = Path(..., description="补货建议ID"),
    current_user: User = Depends(get_current_user),
    tenant_id: int = Depends(get_current_tenant),
) -> ReplenishmentSuggestionResponse:
    """
    获取补货建议详情

    - **suggestion_id**: 补货建议ID
    """
    return await ReplenishmentSuggestionService().get_suggestion_by_id(
        tenant_id=tenant_id,
        suggestion_id=suggestion_id
    )


@router.post("/replenishment-suggestions/{suggestion_id}/process", response_model=ReplenishmentSuggestionResponse, summary="处理补货建议")
async def process_replenishment_suggestion(
    suggestion_id: int,
    process_data: ReplenishmentSuggestionProcessRequest,
    current_user: User = Depends(get_current_user),
    tenant_id: int = Depends(get_current_tenant),
) -> ReplenishmentSuggestionResponse:
    """
    处理补货建议

    - **suggestion_id**: 补货建议ID
    - **process_data**: 处理数据（状态、处理备注）
    """
    return await ReplenishmentSuggestionService().process_suggestion(
        tenant_id=tenant_id,
        suggestion_id=suggestion_id,
        process_data=process_data,
        processed_by=current_user.id
    )


@router.get("/replenishment-suggestions/statistics", summary="获取补货建议统计信息")
async def get_replenishment_suggestion_statistics(
    current_user: User = Depends(get_current_user),
    tenant_id: int = Depends(get_current_tenant),
) -> Dict[str, Any]:
    """
    获取补货建议统计信息

    返回按状态、优先级统计的补货建议数量
    """
    return await ReplenishmentSuggestionService().get_suggestion_statistics(
        tenant_id=tenant_id
    )


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
    return await IncomingInspectionService.create_incoming_inspection(
        tenant_id=tenant_id,
        inspection_data=inspection,
        created_by=current_user.id
    )


@router.get("/incoming-inspections", response_model=List[IncomingInspectionListResponse], summary="获取来料检验单列表")
async def list_incoming_inspections(
    skip: int = Query(0, ge=0, description="跳过数量"),
    limit: int = Query(100, ge=1, le=1000, description="限制数量"),
    status: Optional[str] = Query(None, description="检验状态"),
    quality_status: Optional[str] = Query(None, description="质量状态"),
    supplier_id: Optional[int] = Query(None, description="供应商ID"),
    material_id: Optional[int] = Query(None, description="物料ID"),
    current_user: User = Depends(get_current_user),
    tenant_id: int = Depends(get_current_tenant),
) -> List[IncomingInspectionListResponse]:
    """
    获取来料检验单列表

    支持多种筛选条件的高级搜索。
    """
    return await IncomingInspectionService.list_incoming_inspections(
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
    return await IncomingInspectionService.get_incoming_inspection_by_id(
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
    return await IncomingInspectionService.conduct_inspection(
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
    return await IncomingInspectionService.approve_inspection(
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
            status_code=status.HTTP_500_INTERNAL_SERVER_ERROR,
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
            status_code=status.HTTP_500_INTERNAL_SERVER_ERROR,
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
    return await FinishedGoodsInspectionService.create_finished_goods_inspection(
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
    return await FinishedGoodsInspectionService.list_finished_goods_inspections(
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
    return await FinishedGoodsInspectionService.get_finished_goods_inspection_by_id(
        tenant_id=tenant_id,
        inspection_id=inspection_id
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
    return await FinishedGoodsInspectionService.conduct_inspection(
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
            status_code=status.HTTP_500_INTERNAL_SERVER_ERROR,
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
        status_code=status.HTTP_200_OK
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
    except ValidationError as e:
        raise HTTPException(status_code=400, detail=str(e))


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
            status_code=status.HTTP_200_OK
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
        status_code=status.HTTP_200_OK
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
    return await PurchaseInvoiceService().approve_invoice(
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


@router.get("/sales-forecasts", response_model=List[SalesForecastListResponse], summary="获取销售预测列表")
async def list_sales_forecasts(
    skip: int = Query(0, ge=0, description="跳过数量"),
    limit: int = Query(100, ge=1, le=1000, description="限制数量"),
    status: Optional[str] = Query(None, description="预测状态"),
    forecast_period: Optional[str] = Query(None, description="预测周期"),
    current_user: User = Depends(get_current_user),
    tenant_id: int = Depends(get_current_tenant),
) -> List[SalesForecastListResponse]:
    """
    获取销售预测列表

    支持多种筛选条件的高级搜索。
    """
    service = SalesForecastService()
    return await service.list_sales_forecasts(
        tenant_id=tenant_id,
        skip=skip,
        limit=limit,
        status=status,
        forecast_period=forecast_period,
    )


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
    return JSONResponse(content=result, status_code=status.HTTP_200_OK)


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
        return JSONResponse(content={"message": "销售预测删除成功"}, status_code=status.HTTP_200_OK)
    else:
        return JSONResponse(content={"message": "销售预测删除失败"}, status_code=status.HTTP_400_BAD_REQUEST)


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


# ============ 销售订单管理 API ============

@router.post("/sales-orders", response_model=SalesOrderResponse, summary="创建销售订单")
async def create_sales_order(
    order: SalesOrderCreate,
    current_user: User = Depends(get_current_user),
    tenant_id: int = Depends(get_current_tenant),
) -> SalesOrderResponse:
    """
    创建销售订单

    - **order**: 销售订单创建数据
    - **current_user**: 当前用户
    - **tenant_id**: 当前组织ID

    返回创建的销售订单信息。
    """
    service = SalesOrderService()
    return await service.create_sales_order(
        tenant_id=tenant_id,
        order_data=order,
        created_by=current_user.id
    )


@router.get("/sales-orders", response_model=List[SalesOrderListResponse], summary="获取销售订单列表")
async def list_sales_orders(
    skip: int = Query(0, ge=0, description="跳过数量"),
    limit: int = Query(100, ge=1, le=1000, description="限制数量"),
    status: Optional[str] = Query(None, description="订单状态"),
    customer_id: Optional[int] = Query(None, description="客户ID"),
    order_type: Optional[str] = Query(None, description="订单类型"),
    delivery_date_start: Optional[str] = Query(None, description="交货日期开始（ISO格式）"),
    delivery_date_end: Optional[str] = Query(None, description="交货日期结束（ISO格式）"),
    current_user: User = Depends(get_current_user),
    tenant_id: int = Depends(get_current_tenant),
) -> List[SalesOrderListResponse]:
    """
    获取销售订单列表

    支持多种筛选条件的高级搜索。
    
    注意：返回数组格式，与基础数据管理APP保持一致
    前端在 request 函数中手动包装为 { data, total, success } 格式
    """
    from datetime import date

    # 转换日期参数
    delivery_date_start_dt = None
    delivery_date_end_dt = None

    if delivery_date_start:
        try:
            delivery_date_start_dt = date.fromisoformat(delivery_date_start)
        except ValueError:
            pass

    if delivery_date_end:
        try:
            delivery_date_end_dt = date.fromisoformat(delivery_date_end)
        except ValueError:
            pass

    from apps.kuaizhizao.services.sales_service import SalesOrderService
    
    service = SalesOrderService()
    return await service.list_sales_orders(
        tenant_id=tenant_id,
        skip=skip,
        limit=limit,
        status=status,
        customer_id=customer_id,
        order_type=order_type,
        delivery_date_start=delivery_date_start_dt,
        delivery_date_end=delivery_date_end_dt,
    )


@router.get("/sales-orders/{order_id}", response_model=SalesOrderResponse, summary="获取销售订单详情")
async def get_sales_order(
    order_id: int,
    current_user: User = Depends(get_current_user),
    tenant_id: int = Depends(get_current_tenant),
) -> SalesOrderResponse:
    """
    根据ID获取销售订单详情

    - **order_id**: 销售订单ID
    """
    from apps.kuaizhizao.services.sales_service import SalesOrderService
    
    service = SalesOrderService()
    return await service.get_sales_order_by_id(
        tenant_id=tenant_id,
        order_id=order_id
    )


@router.post("/sales-orders/{order_id}/submit", response_model=SalesOrderResponse, summary="提交销售订单")
async def submit_sales_order(
    order_id: int,
    current_user: User = Depends(get_current_user),
    tenant_id: int = Depends(get_current_tenant),
) -> SalesOrderResponse:
    """
    提交销售订单

    将草稿状态的销售订单提交为待审核状态

    - **order_id**: 销售订单ID
    """
    from apps.kuaizhizao.services.sales_service import SalesOrderService
    
    service = SalesOrderService()
    return await service.submit_order(
        tenant_id=tenant_id,
        order_id=order_id,
        submitted_by=current_user.id
    )


@router.post("/sales-orders/{order_id}/approve", response_model=SalesOrderResponse, summary="审核销售订单")
async def approve_sales_order(
    order_id: int,
    rejection_reason: Optional[str] = Query(None, description="驳回原因"),
    current_user: User = Depends(get_current_user),
    tenant_id: int = Depends(get_current_tenant),
) -> SalesOrderResponse:
    """
    审核销售订单

    - **order_id**: 销售订单ID
    - **rejection_reason**: 驳回原因（可选，不填则通过）
    """
    from apps.kuaizhizao.services.sales_service import SalesOrderService
    
    service = SalesOrderService()
    return await service.approve_order(
        tenant_id=tenant_id,
        order_id=order_id,
        approved_by=current_user.id,
        rejection_reason=rejection_reason
    )


@router.post("/sales-orders/{order_id}/push-to-lrp", summary="下推到LRP运算")
async def push_sales_order_to_lrp(
    order_id: int = Path(..., description="销售订单ID"),
    planning_horizon: int = Query(3, ge=1, le=12, description="计划周期（月数）"),
    consider_capacity: bool = Query(False, description="是否考虑产能"),
    current_user: User = Depends(get_current_user),
    tenant_id: int = Depends(get_current_tenant),
):
    """
    从销售订单下推到LRP运算
    
    自动执行LRP计算，生成详细的生产和采购计划
    
    - **order_id**: 销售订单ID
    - **planning_horizon**: 计划周期（月数，默认3个月）
    - **consider_capacity**: 是否考虑产能（默认：False）
    """
    from apps.kuaizhizao.services.sales_service import SalesOrderService
    
    service = SalesOrderService()
    result = await service.push_to_lrp(
        tenant_id=tenant_id,
        order_id=order_id,
        planning_horizon=planning_horizon,
        consider_capacity=consider_capacity,
        user_id=current_user.id
    )
    return JSONResponse(content=result, status_code=status.HTTP_200_OK)


@router.post("/sales-orders/{order_id}/confirm", response_model=SalesOrderResponse, summary="确认销售订单")
async def confirm_sales_order(
    order_id: int,
    current_user: User = Depends(get_current_user),
    tenant_id: int = Depends(get_current_tenant),
) -> SalesOrderResponse:
    """
    确认销售订单（转为MTO模式执行）

    - **order_id**: 销售订单ID
    """
    from apps.kuaizhizao.services.sales_service import SalesOrderService
    
    service = SalesOrderService()
    return await service.confirm_order(
        tenant_id=tenant_id,
        order_id=order_id,
        confirmed_by=current_user.id
    )


@router.post("/sales-orders/{order_id}/items", response_model=SalesOrderItemResponse, summary="添加销售订单明细")
async def add_sales_order_item(
    order_id: int,
    item: SalesOrderItemCreate,
    current_user: User = Depends(get_current_user),
    tenant_id: int = Depends(get_current_tenant),
) -> SalesOrderItemResponse:
    """
    添加销售订单明细

    - **order_id**: 销售订单ID
    - **item**: 订单明细数据
    """
    from apps.kuaizhizao.services.sales_service import SalesOrderService
    
    service = SalesOrderService()
    return await service.add_order_item(
        tenant_id=tenant_id,
        order_id=order_id,
        item_data=item
    )


@router.get("/sales-orders/{order_id}/items", response_model=List[SalesOrderItemResponse], summary="获取销售订单明细")
async def get_sales_order_items(
    order_id: int,
    current_user: User = Depends(get_current_user),
    tenant_id: int = Depends(get_current_tenant),
) -> List[SalesOrderItemResponse]:
    """
    获取销售订单明细列表

    - **order_id**: 销售订单ID
    """
    from apps.kuaizhizao.services.sales_service import SalesOrderService
    
    service = SalesOrderService()
    return await service.get_order_items(
        tenant_id=tenant_id,
        order_id=order_id
    )


@router.post("/sales-orders/{order_id}/push-to-delivery", summary="下推到销售出库")
async def push_sales_order_to_delivery(
    order_id: int = Path(..., description="销售订单ID"),
    delivery_quantities: Optional[dict] = None,
    current_user: User = Depends(get_current_user),
    tenant_id: int = Depends(get_current_tenant),
):
    """
    从销售订单下推到销售出库
    
    自动生成销售出库单，支持指定出库数量
    
    - **order_id**: 销售订单ID
    - **delivery_quantities**: 出库数量字典 {item_id: quantity}（可选，如果不提供则使用订单未出库数量）
    """
    from fastapi import status
    from fastapi.responses import JSONResponse
    from apps.kuaizhizao.services.sales_service import SalesOrderService
    
    service = SalesOrderService()
    result = await service.push_to_delivery(
        tenant_id=tenant_id,
        order_id=order_id,
        created_by=current_user.id,
        delivery_quantities=delivery_quantities
    )
    return JSONResponse(content=result, status_code=status.HTTP_200_OK)


@router.post("/sales-orders/{order_id}/items/{item_id}/delivery", response_model=SalesOrderItemResponse, summary="更新交货状态")
async def update_delivery_status(
    order_id: int,
    item_id: int,
    delivered_quantity: float = Query(..., gt=0, description="交货数量"),
    current_user: User = Depends(get_current_user),
    tenant_id: int = Depends(get_current_tenant),
) -> SalesOrderItemResponse:
    """
    更新销售订单明细的交货状态

    - **order_id**: 销售订单ID
    - **item_id**: 订单明细ID
    - **delivered_quantity**: 本次交货数量
    """
    from apps.kuaizhizao.services.sales_service import SalesOrderService
    
    service = SalesOrderService()
    return await service.update_delivery_status(
        tenant_id=tenant_id,
        order_id=order_id,
        item_id=item_id,
        delivered_quantity=delivered_quantity,
        updated_by=current_user.id
    )


# ============ BOM物料清单管理 API ============
# 注意：BOM管理已移至master_data APP
# 如需管理BOM，请使用master_data APP的API：/api/apps/master-data/materials/bom
# 本APP只提供基于BOM的业务功能（如物料需求计算）


# ============ 单据关联管理 API ============

from apps.kuaizhizao.services.document_relation_service import DocumentRelationService
from apps.kuaizhizao.schemas.document_relation import (
    DocumentRelationResponse,
    DocumentTraceResponse,
)

@router.get("/documents/{document_type}/{document_id}/relations", response_model=DocumentRelationResponse, summary="获取单据关联关系")
async def get_document_relations(
    document_type: str = Path(..., description="单据类型（如：work_order, sales_forecast等）"),
    document_id: int = Path(..., description="单据ID"),
    current_user: User = Depends(get_current_user),
    tenant_id: int = Depends(get_current_tenant),
) -> DocumentRelationResponse:
    """
    获取单据的关联关系（上游和下游单据）

    支持的单据类型：
    - **sales_forecast**: 销售预测
    - **sales_order**: 销售订单
    - **mrp_result**: MRP运算结果
    - **lrp_result**: LRP运算结果
    - **work_order**: 工单
    - **production_picking**: 生产领料单
    - **reporting_record**: 报工记录
    - **finished_goods_receipt**: 成品入库单
    - **sales_delivery**: 销售出库单
    - **purchase_order**: 采购订单
    - **purchase_receipt**: 采购入库单
    - **payable**: 应付单
    - **receivable**: 应收单

    - **document_type**: 单据类型
    - **document_id**: 单据ID

    返回：
    - upstream_documents: 上游单据列表（来源单据）
    - downstream_documents: 下游单据列表（生成单据）
    """
    result = await DocumentRelationService().get_document_relations(
        tenant_id=tenant_id,
        document_type=document_type,
        document_id=document_id
    )
    return DocumentRelationResponse(**result)


@router.get("/documents/{document_type}/{document_id}/trace", response_model=DocumentTraceResponse, summary="追溯单据关联链")
async def trace_document_chain(
    document_type: str = Path(..., description="单据类型"),
    document_id: int = Path(..., description="单据ID"),
    direction: str = Query("both", description="追溯方向（upstream: 向上追溯, downstream: 向下追溯, both: 双向追溯）"),
    current_user: User = Depends(get_current_user),
    tenant_id: int = Depends(get_current_tenant),
) -> DocumentTraceResponse:
    """
    追溯单据关联链（完整追溯）

    支持所有单据类型的完整关联链追溯，包括多层级关联关系。

    - **document_type**: 单据类型（支持所有单据类型，参见关联关系API）
    - **document_id**: 单据ID
    - **direction**: 追溯方向
      - **upstream**: 向上追溯（查找来源单据）
      - **downstream**: 向下追溯（查找生成单据）
      - **both**: 双向追溯（默认）

    返回完整的关联链，支持多层级追溯，自动避免循环引用。
    """
    result = await DocumentRelationService().trace_document_chain(
        tenant_id=tenant_id,
        document_type=document_type,
        document_id=document_id,
        direction=direction
    )
    return DocumentTraceResponse(**result)


# ============ 单据打印 API ============

from apps.kuaizhizao.services.print_service import DocumentPrintService
from fastapi.responses import HTMLResponse, Response

@router.get("/documents/{document_type}/{document_id}/print", summary="打印单据")
async def print_document(
    document_type: str = Path(..., description="单据类型（如：work_order, production_picking等）"),
    document_id: int = Path(..., description="单据ID"),
    template_code: Optional[str] = Query(None, description="打印模板代码（可选，如果不提供则使用默认模板）"),
    output_format: str = Query("html", description="输出格式（html/pdf）"),
    current_user: User = Depends(get_current_user),
    tenant_id: int = Depends(get_current_tenant),
):
    """
    打印单据

    - **document_type**: 单据类型（如：work_order, production_picking, finished_goods_receipt, sales_delivery, purchase_order, purchase_receipt, sales_forecast, sales_order）
    - **document_id**: 单据ID
    - **template_code**: 打印模板代码（可选，如果不提供则使用默认模板）
    - **output_format**: 输出格式（html/pdf，默认：html）

    返回渲染后的打印内容（HTML或PDF）
    """
    result = await DocumentPrintService().print_document(
        tenant_id=tenant_id,
        document_type=document_type,
        document_id=document_id,
        template_code=template_code,
        output_format=output_format
    )
    
    if output_format == "pdf":
        # TODO: 实现PDF生成
        # 目前返回HTML，后续可以集成weasyprint或reportlab生成PDF
        return HTMLResponse(content=result["content"], status_code=200)
    else:
        return HTMLResponse(content=result["content"], status_code=200)


@router.get("/work-orders/{id}/print", summary="打印工单")
async def print_work_order(
    id: int = Path(..., description="工单ID"),
    template_code: Optional[str] = Query(None, description="打印模板代码"),
    output_format: str = Query("html", description="输出格式"),
    current_user: User = Depends(get_current_user),
    tenant_id: int = Depends(get_current_tenant),
):
    """打印工单"""
    return await print_document(
        document_type="work_order",
        document_id=id,
        template_code=template_code,
        output_format=output_format,
        current_user=current_user,
        tenant_id=tenant_id
    )


@router.get("/production-pickings/{id}/print", summary="打印生产领料单")
async def print_production_picking(
    id: int = Path(..., description="生产领料单ID"),
    template_code: Optional[str] = Query(None, description="打印模板代码"),
    output_format: str = Query("html", description="输出格式"),
    current_user: User = Depends(get_current_user),
    tenant_id: int = Depends(get_current_tenant),
):
    """打印生产领料单"""
    return await print_document(
        document_type="production_picking",
        document_id=id,
        template_code=template_code,
        output_format=output_format,
        current_user=current_user,
        tenant_id=tenant_id
    )


@router.get("/finished-goods-receipts/{id}/print", summary="打印成品入库单")
async def print_finished_goods_receipt(
    id: int = Path(..., description="成品入库单ID"),
    template_code: Optional[str] = Query(None, description="打印模板代码"),
    output_format: str = Query("html", description="输出格式"),
    current_user: User = Depends(get_current_user),
    tenant_id: int = Depends(get_current_tenant),
):
    """打印成品入库单"""
    return await print_document(
        document_type="finished_goods_receipt",
        document_id=id,
        template_code=template_code,
        output_format=output_format,
        current_user=current_user,
        tenant_id=tenant_id
    )


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
            status_code=status.HTTP_422_UNPROCESSABLE_ENTITY,
            detail=str(e)
        )
    except Exception as e:
        logger.error(f"导入销售预测失败: {str(e)}")
        raise HTTPException(
            status_code=status.HTTP_500_INTERNAL_SERVER_ERROR,
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
                status_code=status.HTTP_500_INTERNAL_SERVER_ERROR,
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
            status_code=status.HTTP_500_INTERNAL_SERVER_ERROR,
            detail=f"导出失败: {str(e)}"
        )


@router.post("/sales-orders/import", summary="批量导入销售订单")
async def import_sales_orders(
    request: Dict[str, Any],
    current_user: User = Depends(get_current_user),
    tenant_id: int = Depends(get_current_tenant),
):
    """
    批量导入销售订单
    
    接收前端 uni_import 组件传递的二维数组数据，批量创建销售订单。
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
        
        from apps.kuaizhizao.services.sales_service import SalesOrderService
        service = SalesOrderService()
        result = await service.import_from_data(
            tenant_id=tenant_id,
            data=data,
            created_by=current_user.id
        )
        
        return result
                
    except ValidationError as e:
        raise HTTPException(
            status_code=status.HTTP_422_UNPROCESSABLE_ENTITY,
            detail=str(e)
        )
    except Exception as e:
        logger.error(f"导入销售订单失败: {str(e)}")
        raise HTTPException(
            status_code=status.HTTP_500_INTERNAL_SERVER_ERROR,
            detail=f"导入失败: {str(e)}"
        )


@router.get("/sales-orders/export", response_class=FileResponse, summary="批量导出销售订单")
async def export_sales_orders(
    status: Optional[str] = Query(None, description="订单状态筛选"),
    order_type: Optional[str] = Query(None, description="订单类型筛选"),
    customer_id: Optional[int] = Query(None, description="客户ID筛选"),
    current_user: User = Depends(get_current_user),
    tenant_id: int = Depends(get_current_tenant),
):
    """
    批量导出销售订单到Excel文件
    
    Args:
        status: 订单状态筛选
        order_type: 订单类型筛选
        customer_id: 客户ID筛选
        current_user: 当前用户（依赖注入）
        tenant_id: 当前组织ID（依赖注入）
        
    Returns:
        FileResponse: Excel文件
    """
    from fastapi import HTTPException
    from fastapi.responses import FileResponse
    import os
    
    try:
        from apps.kuaizhizao.services.sales_service import SalesOrderService
        service = SalesOrderService()
        file_path = await service.export_to_excel(
            tenant_id=tenant_id,
            status=status,
            order_type=order_type,
            customer_id=customer_id,
        )
        return FileResponse(
            path=file_path,
            filename=os.path.basename(file_path),
            media_type="application/vnd.openxmlformats-officedocument.spreadsheetml.sheet"
        )
    except Exception as e:
        logger.error(f"导出销售订单失败: {str(e)}")
        raise HTTPException(
            status_code=status.HTTP_500_INTERNAL_SERVER_ERROR,
            detail=f"导出失败: {str(e)}"
        )


@router.post("/sales-orders/batch-create", response_model=BatchResponse, summary="批量创建销售订单")
async def batch_create_sales_orders(
    request: BatchCreateRequest,
    current_user: User = Depends(get_current_user),
    tenant_id: int = Depends(get_current_tenant),
) -> BatchResponse:
    """
    批量创建销售订单

    - **items**: 销售订单创建数据列表（最多100条）
    """
    from apps.kuaizhizao.schemas.sales import SalesOrderCreate
    
    # 验证数据格式
    validated_items = []
    for item in request.items:
        try:
            validated_item = SalesOrderCreate(**item).model_dump()
            validated_items.append(validated_item)
        except Exception as e:
            logger.error(f"销售订单数据验证失败: {e}")
    
    result = await BatchOperationService().batch_create(
        tenant_id=tenant_id,
        model_class=SalesOrder,
        create_data_list=validated_items,
        created_by=current_user.id
    )
    
    return BatchResponse(
        success=result["failed_count"] == 0,
        message=f"成功创建 {result['success_count']} 个销售订单，失败 {result['failed_count']} 个",
        data=result
    )


@router.delete("/sales-orders/batch-delete", response_model=BatchResponse, summary="批量删除销售订单")
async def batch_delete_sales_orders(
    request: BatchDeleteRequest,
    current_user: User = Depends(get_current_user),
    tenant_id: int = Depends(get_current_tenant),
) -> BatchResponse:
    """
    批量删除销售订单

    - **ids**: 要删除的销售订单ID列表（最多100条）
    
    注意：只能删除草稿状态的销售订单
    """
    def validate_sales_order(order):
        """验证销售订单是否可以删除"""
        if order.status != "草稿":
            raise BusinessLogicError(f"销售订单 {order.id} 状态为 {order.status}，无法删除。只有草稿状态的销售订单才能删除。")
    
    result = await BatchOperationService().batch_delete(
        tenant_id=tenant_id,
        model_class=SalesOrder,
        record_ids=request.ids,
        validate_func=validate_sales_order
    )
    
    return BatchResponse(
        success=result["failed_count"] == 0,
        message=f"成功删除 {result['success_count']} 个销售订单，失败 {result['failed_count']} 个",
        data=result
    )


# ============ 生产计划管理 API ============

# TODO: MRP运算已合并为统一需求计算，此路由已废弃
# @router.post("/mrp-computation", response_model=MRPComputationResult, summary="执行MRP运算")
async def run_mrp_computation_deprecated(
    mrp_request: MRPComputationRequest,
    current_user: User = Depends(get_current_user),
    tenant_id: int = Depends(get_current_tenant),
) -> MRPComputationResult:
    """
    执行物料需求计划（MRP）运算

    基于销售预测计算物料需求和生产计划

    - **mrp_request**: MRP运算请求参数
    """
    return await ProductionPlanningService().run_mrp_computation(
        tenant_id=tenant_id,
        request=mrp_request,
        user_id=current_user.id
    )


# TODO: LRP运算已合并为统一需求计算，此路由已废弃
# @router.post("/lrp-computation", response_model=LRPComputationResult, summary="执行LRP运算")
async def run_lrp_computation_deprecated(
    lrp_request: LRPComputationRequest,
    current_user: User = Depends(get_current_user),
    tenant_id: int = Depends(get_current_tenant),
) -> LRPComputationResult:
    """
    执行物流需求计划（LRP）运算

    基于销售订单计算详细的生产和采购计划

    - **lrp_request**: LRP运算请求参数
    """
    return await ProductionPlanningService().run_lrp_computation(
        tenant_id=tenant_id,
        request=lrp_request,
        user_id=current_user.id
    )


# ============ MRP/LRP运算结果查看 API ============

@router.get("/mrp/results", summary="获取MRP运算结果列表")
async def list_mrp_results(
    forecast_id: Optional[int] = Query(None, description="销售预测ID"),
    skip: int = Query(0, ge=0, description="跳过数量"),
    limit: int = Query(100, ge=1, le=1000, description="限制数量"),
    current_user: User = Depends(get_current_user),
    tenant_id: int = Depends(get_current_tenant),
):
    """
    获取MRP运算结果列表

    - **forecast_id**: 销售预测ID（可选，用于筛选）
    - **skip**: 跳过数量
    - **limit**: 限制数量
    
    Returns:
        Dict: 包含data（结果列表）和total（总数）的字典
    """
    return await ProductionPlanningService().list_mrp_results(
        tenant_id=tenant_id,
        forecast_id=forecast_id,
        skip=skip,
        limit=limit
    )


@router.get("/mrp/results/{result_id}", summary="获取MRP运算结果详情")
async def get_mrp_result(
    result_id: int = Path(..., description="MRP运算结果ID"),
    current_user: User = Depends(get_current_user),
    tenant_id: int = Depends(get_current_tenant),
):
    """
    根据ID获取MRP运算结果详情

    - **result_id**: MRP运算结果ID
    
    Returns:
        Dict: MRP运算结果（包含物料信息）
    """
    return await ProductionPlanningService().get_mrp_result_by_id(
        tenant_id=tenant_id,
        result_id=result_id
    )


@router.get("/mrp/results/export", response_class=FileResponse, summary="导出MRP运算结果（按预测ID）")
async def export_mrp_results(
    forecast_id: Optional[int] = Query(None, description="销售预测ID筛选"),
    current_user: User = Depends(get_current_user),
    tenant_id: int = Depends(get_current_tenant),
):
    """
    批量导出MRP运算结果到Excel文件
    
    Args:
        forecast_id: 销售预测ID筛选（可选）
        current_user: 当前用户（依赖注入）
        tenant_id: 当前组织ID（依赖注入）
        
    Returns:
        FileResponse: Excel文件
    """
    import os
    
    try:
        service = ProductionPlanningService()
        file_path = await service.export_mrp_results_to_excel(
            tenant_id=tenant_id,
            forecast_id=forecast_id
        )
        
        if not os.path.exists(file_path):
            raise HTTPException(
                status_code=status.HTTP_500_INTERNAL_SERVER_ERROR,
                detail="导出文件生成失败"
            )
        
        return FileResponse(
            path=file_path,
            filename=os.path.basename(file_path),
            media_type='application/vnd.ms-excel'
        )
                
    except Exception as e:
        logger.error(f"导出MRP运算结果失败: {str(e)}")
        raise HTTPException(
            status_code=status.HTTP_500_INTERNAL_SERVER_ERROR,
            detail=f"导出失败: {str(e)}"
        )


@router.get("/mrp/results/{result_id}/export", response_class=FileResponse, summary="导出单个MRP运算结果")
async def export_mrp_result_by_id(
    result_id: int = Path(..., description="MRP运算结果ID"),
    current_user: User = Depends(get_current_user),
    tenant_id: int = Depends(get_current_tenant),
):
    """
    导出单个MRP运算结果到Excel文件
    
    Args:
        result_id: MRP运算结果ID
        current_user: 当前用户（依赖注入）
        tenant_id: 当前组织ID（依赖注入）
        
    Returns:
        FileResponse: Excel文件
    """
    import os
    
    try:
        # 获取MRP结果详情
        service = ProductionPlanningService()
        result = await service.get_mrp_result_by_id(tenant_id, result_id)
        
        # 使用forecast_id导出
        file_path = await service.export_mrp_results_to_excel(
            tenant_id=tenant_id,
            forecast_id=result.forecast_id
        )
        
        if not os.path.exists(file_path):
            raise HTTPException(
                status_code=status.HTTP_500_INTERNAL_SERVER_ERROR,
                detail="导出文件生成失败"
            )
        
        return FileResponse(
            path=file_path,
            filename=os.path.basename(file_path),
            media_type='application/vnd.ms-excel'
        )
                
    except Exception as e:
        logger.error(f"导出MRP运算结果失败: {str(e)}")
        raise HTTPException(
            status_code=status.HTTP_500_INTERNAL_SERVER_ERROR,
            detail=f"导出失败: {str(e)}"
        )


@router.get("/lrp/results", response_model=List[LRPResultListResponse], summary="获取LRP运算结果列表")
async def list_lrp_results(
    sales_order_id: Optional[int] = Query(None, description="销售订单ID"),
    skip: int = Query(0, ge=0, description="跳过数量"),
    limit: int = Query(100, ge=1, le=1000, description="限制数量"),
    current_user: User = Depends(get_current_user),
    tenant_id: int = Depends(get_current_tenant),
) -> List[LRPResultListResponse]:
    """
    获取LRP运算结果列表

    - **sales_order_id**: 销售订单ID（可选，用于筛选）
    - **skip**: 跳过数量
    - **limit**: 限制数量
    """
    return await ProductionPlanningService().list_lrp_results(
        tenant_id=tenant_id,
        sales_order_id=sales_order_id,
        skip=skip,
        limit=limit
    )


@router.get("/lrp/results/{result_id}", response_model=LRPResultResponse, summary="获取LRP运算结果详情")
async def get_lrp_result(
    result_id: int = Path(..., description="LRP运算结果ID"),
    current_user: User = Depends(get_current_user),
    tenant_id: int = Depends(get_current_tenant),
) -> LRPResultResponse:
    """
    根据ID获取LRP运算结果详情

    - **result_id**: LRP运算结果ID
    """
    return await ProductionPlanningService().get_lrp_result_by_id(
        tenant_id=tenant_id,
        result_id=result_id
    )


@router.get("/lrp/results/export", response_class=FileResponse, summary="导出LRP运算结果")
async def export_lrp_results(
    sales_order_id: Optional[int] = Query(None, description="销售订单ID（可选，用于筛选）"),
    current_user: User = Depends(get_current_user),
    tenant_id: int = Depends(get_current_tenant),
):
    """
    导出LRP运算结果到Excel文件

    - **sales_order_id**: 销售订单ID（可选，用于筛选）
    """
    try:
        file_path = await ProductionPlanningService().export_lrp_results_to_excel(
            tenant_id=tenant_id,
            sales_order_id=sales_order_id
        )
        return FileResponse(
            path=file_path,
            filename=os.path.basename(file_path),
            media_type="application/vnd.openxmlformats-officedocument.spreadsheetml.sheet"
        )
    except Exception as e:
        logger.error(f"导出LRP运算结果失败: {str(e)}")
        raise HTTPException(
            status_code=status.HTTP_500_INTERNAL_SERVER_ERROR,
            detail=f"导出失败: {str(e)}"
        )


# ============ 一键生成工单和采购单 API ============

@router.post("/mrp/results/{forecast_id}/generate-orders", summary="从MRP运算结果一键生成工单和采购单")
async def generate_orders_from_mrp(
    forecast_id: int = Path(..., description="销售预测ID"),
    generate_work_orders: bool = Query(True, description="是否生成工单"),
    generate_purchase_orders: bool = Query(True, description="是否生成采购单"),
    selected_material_ids: Optional[List[int]] = Query(None, description="选中的物料ID列表（可选，如果不提供则生成所有）"),
    current_user: User = Depends(get_current_user),
    tenant_id: int = Depends(get_current_tenant),
):
    """
    从MRP运算结果一键生成工单和采购单

    - **forecast_id**: 销售预测ID
    - **generate_work_orders**: 是否生成工单（默认：是）
    - **generate_purchase_orders**: 是否生成采购单（默认：是）
    - **selected_material_ids**: 选中的物料ID列表（可选，如果不提供则生成所有）

    系统会自动：
    1. 获取MRP运算结果
    2. 根据物料类型和运算结果生成工单或采购单
    3. 返回生成的工单和采购单信息
    """
    result = await ProductionPlanningService().generate_orders_from_mrp_result(
        tenant_id=tenant_id,
        forecast_id=forecast_id,
        created_by=current_user.id,
        generate_work_orders=generate_work_orders,
        generate_purchase_orders=generate_purchase_orders,
        selected_material_ids=selected_material_ids
    )
    return JSONResponse(content={
        "success": True,
        "message": f"成功生成 {result['generated_work_orders']} 个工单和 {result['generated_purchase_orders']} 个采购单",
        "data": result
    })


@router.post("/lrp/results/{sales_order_id}/generate-orders", summary="从LRP运算结果一键生成工单和采购单")
async def generate_orders_from_lrp(
    sales_order_id: int = Path(..., description="销售订单ID"),
    generate_work_orders: bool = Query(True, description="是否生成工单"),
    generate_purchase_orders: bool = Query(True, description="是否生成采购单"),
    selected_material_ids: Optional[List[int]] = Query(None, description="选中的物料ID列表（可选，如果不提供则生成所有）"),
    current_user: User = Depends(get_current_user),
    tenant_id: int = Depends(get_current_tenant),
):
    """
    从LRP运算结果一键生成工单和采购单

    - **sales_order_id**: 销售订单ID
    - **generate_work_orders**: 是否生成工单（默认：是）
    - **generate_purchase_orders**: 是否生成采购单（默认：是）
    - **selected_material_ids**: 选中的物料ID列表（可选，如果不提供则生成所有）

    系统会自动：
    1. 获取LRP运算结果
    2. 根据运算结果生成工单或采购单（关联销售订单）
    3. 返回生成的工单和采购单信息
    """
    result = await ProductionPlanningService().generate_orders_from_lrp_result(
        tenant_id=tenant_id,
        sales_order_id=sales_order_id,
        created_by=current_user.id,
        generate_work_orders=generate_work_orders,
        generate_purchase_orders=generate_purchase_orders,
        selected_material_ids=selected_material_ids
    )
    return JSONResponse(content={
        "success": True,
        "message": f"成功生成 {result['generated_work_orders']} 个工单和 {result['generated_purchase_orders']} 个采购单",
        "data": result
    })


@router.get("/production-plans", response_model=List[ProductionPlanListResponse], summary="获取生产计划列表")
async def list_production_plans(
    skip: int = Query(0, ge=0, description="跳过数量"),
    limit: int = Query(100, ge=1, le=1000, description="限制数量"),
    plan_type: Optional[str] = Query(None, description="计划类型（MRP/LRP）"),
    status: Optional[str] = Query(None, description="计划状态"),
    current_user: User = Depends(get_current_user),
    tenant_id: int = Depends(get_current_tenant),
) -> List[ProductionPlanListResponse]:
    """
    获取生产计划列表

    支持多种筛选条件的高级搜索。
    """
    return await ProductionPlanningService().list_production_plans(
        tenant_id=tenant_id,
        skip=skip,
        limit=limit,
        plan_type=plan_type,
        status=status,
    )


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
        constraints=request.constraints.model_dump() if request.constraints else None
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

@router.get("/documents/timing", response_model=List[DocumentTimingSummaryResponse], summary="获取单据耗时统计列表")
async def list_documents_timing(
    document_type: Optional[str] = Query(None, description="单据类型（如：work_order/purchase_order/sales_order）"),
    skip: int = Query(0, ge=0, description="跳过数量"),
    limit: int = Query(100, ge=1, le=1000, description="限制数量"),
    current_user: User = Depends(get_current_user),
    tenant_id: int = Depends(get_current_tenant),
) -> List[DocumentTimingSummaryResponse]:
    """
    获取单据耗时统计列表

    返回有耗时记录的单据列表，支持按单据类型筛选。

    - **document_type**: 单据类型（可选）
    - **skip**: 跳过数量
    - **limit**: 限制数量
    """
    return await document_timing_service.list_documents_with_timing(
        tenant_id=tenant_id,
        document_type=document_type,
        skip=skip,
        limit=limit,
    )


@router.get("/documents/{document_type}/{document_id}/timing", response_model=DocumentTimingSummaryResponse, summary="获取单据耗时统计")
async def get_document_timing(
    document_type: str = Path(..., description="单据类型（如：work_order/purchase_order/sales_order）"),
    document_id: int = Path(..., description="单据ID"),
    current_user: User = Depends(get_current_user),
    tenant_id: int = Depends(get_current_tenant),
) -> DocumentTimingSummaryResponse:
    """
    获取单据的耗时统计

    返回单据在各个节点的耗时信息，包括总耗时和各个节点的详细耗时。

    - **document_type**: 单据类型
    - **document_id**: 单据ID
    """
    return await document_timing_service.get_document_timing(
        tenant_id=tenant_id,
        document_type=document_type,
        document_id=document_id,
    )


@router.get("/documents/efficiency", summary="获取单据执行效率分析")
async def get_document_efficiency(
    document_type: Optional[str] = Query(None, description="单据类型（如：work_order/purchase_order/sales_order）"),
    date_start: Optional[str] = Query(None, description="开始日期（ISO格式）"),
    date_end: Optional[str] = Query(None, description="结束日期（ISO格式）"),
    current_user: User = Depends(get_current_user),
    tenant_id: int = Depends(get_current_tenant),
) -> dict:
    """
    获取单据执行效率分析

    返回单据执行效率分析结果，包括平均耗时、瓶颈节点、优化建议等。

    - **document_type**: 单据类型（可选）
    - **date_start**: 开始日期（可选）
    - **date_end**: 结束日期（可选）
    """
    from datetime import datetime

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

    return await document_timing_service.get_document_efficiency(
        tenant_id=tenant_id,
        document_type=document_type,
        date_start=date_start_dt,
        date_end=date_end_dt,
    )


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
        await inngest_client.send_event(
            event=Event(
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
            status_code=status.HTTP_500_INTERNAL_SERVER_ERROR,
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


# ==================== 委外工单管理 API ====================

@router.post("/outsource-work-orders", response_model=OutsourceWorkOrderResponse, summary="创建委外工单")
async def create_outsource_work_order(
    data: OutsourceWorkOrderCreate,
    current_user: User = Depends(get_current_user),
    tenant_id: int = Depends(get_current_tenant),
) -> OutsourceWorkOrderResponse:
    """
    创建委外工单

    - **data**: 委外工单创建数据
    - **current_user**: 当前用户
    - **tenant_id**: 当前组织ID

    返回创建的委外工单信息。
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


@router.get("/outsource-work-orders", response_model=OutsourceWorkOrderListResponse, summary="获取委外工单列表")
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
    获取委外工单列表

    - **skip**: 跳过数量
    - **limit**: 限制数量
    - **status**: 状态筛选
    - **supplier_id**: 供应商ID筛选
    - **product_id**: 产品ID筛选
    - **keyword**: 关键词搜索（编码、名称）
    - **current_user**: 当前用户
    - **tenant_id**: 当前组织ID

    返回委外工单列表。
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
        logger.error(f"获取委外工单列表失败: {e}")
        raise HTTPException(status_code=500, detail=str(e))


@router.get("/outsource-work-orders/{work_order_id}", response_model=OutsourceWorkOrderResponse, summary="获取委外工单详情")
async def get_outsource_work_order(
    work_order_id: int = Path(..., description="委外工单ID"),
    current_user: User = Depends(get_current_user),
    tenant_id: int = Depends(get_current_tenant),
) -> OutsourceWorkOrderResponse:
    """
    获取委外工单详情

    - **work_order_id**: 委外工单ID
    - **current_user**: 当前用户
    - **tenant_id**: 当前组织ID

    返回委外工单详情。
    """
    try:
        return await outsource_work_order_service.get_outsource_work_order(
            tenant_id=tenant_id,
            work_order_id=work_order_id
        )
    except NotFoundError as e:
        raise HTTPException(status_code=404, detail=str(e))


@router.put("/outsource-work-orders/{work_order_id}", response_model=OutsourceWorkOrderResponse, summary="更新委外工单")
async def update_outsource_work_order(
    work_order_id: int = Path(..., description="委外工单ID"),
    data: OutsourceWorkOrderUpdate = Body(...),
    current_user: User = Depends(get_current_user),
    tenant_id: int = Depends(get_current_tenant),
) -> OutsourceWorkOrderResponse:
    """
    更新委外工单

    - **work_order_id**: 委外工单ID
    - **data**: 委外工单更新数据
    - **current_user**: 当前用户
    - **tenant_id**: 当前组织ID

    返回更新后的委外工单信息。
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


@router.delete("/outsource-work-orders/{work_order_id}", summary="删除委外工单")
async def delete_outsource_work_order(
    work_order_id: int = Path(..., description="委外工单ID"),
    current_user: User = Depends(get_current_user),
    tenant_id: int = Depends(get_current_tenant),
) -> JSONResponse:
    """
    删除委外工单（软删除）

    - **work_order_id**: 委外工单ID
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
        return JSONResponse(content={"success": True, "message": "委外工单删除成功"})
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
    outsource_work_order_id: Optional[int] = Query(None, description="委外工单ID筛选"),
    status: Optional[str] = Query(None, description="状态筛选"),
    keyword: Optional[str] = Query(None, description="关键词搜索"),
    current_user: User = Depends(get_current_user),
    tenant_id: int = Depends(get_current_tenant),
) -> List[OutsourceMaterialIssueResponse]:
    """
    获取委外发料单列表

    - **skip**: 跳过数量
    - **limit**: 限制数量
    - **outsource_work_order_id**: 委外工单ID筛选
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
    outsource_work_order_id: Optional[int] = Query(None, description="委外工单ID筛选"),
    status: Optional[str] = Query(None, description="状态筛选"),
    keyword: Optional[str] = Query(None, description="关键词搜索"),
    current_user: User = Depends(get_current_user),
    tenant_id: int = Depends(get_current_tenant),
) -> List[OutsourceMaterialReceiptResponse]:
    """
    获取委外收货单列表

    - **skip**: 跳过数量
    - **limit**: 限制数量
    - **outsource_work_order_id**: 委外工单ID筛选
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
        return JSONResponse(content=result, status_code=status.HTTP_200_OK)
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
        return JSONResponse(content=result, status_code=status.HTTP_200_OK)
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
        return JSONResponse(content=result, status_code=status.HTTP_200_OK)
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
        return JSONResponse(content=result, status_code=status.HTTP_200_OK)
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
        return JSONResponse(content=result, status_code=status.HTTP_200_OK)
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
