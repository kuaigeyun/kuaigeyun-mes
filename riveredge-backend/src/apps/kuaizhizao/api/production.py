"""
生产执行 API 路由模块

提供工单管理和报工管理的API接口。
"""

from datetime import date
from typing import List, Optional
from fastapi import APIRouter, Depends, Query, status, Path
from fastapi.responses import JSONResponse

from core.api.deps import get_current_user, get_current_tenant
from infra.models.user import User

from apps.kuaizhizao.services.work_order_service import WorkOrderService
from apps.kuaizhizao.services.reporting_service import ReportingService
from apps.kuaizhizao.services.warehouse_service import (
    ProductionPickingService,
    FinishedGoodsReceiptService,
    SalesDeliveryService,
    PurchaseReceiptService,
)
from apps.kuaizhizao.services.quality_service import (
    IncomingInspectionService,
    ProcessInspectionService,
    FinishedGoodsInspectionService,
)
from apps.kuaizhizao.services.finance_service import (
    PayableService,
    PurchaseInvoiceService,
    ReceivableService,
)
from apps.kuaizhizao.services.sales_service import (
    SalesForecastService,
    SalesOrderService,
)
from apps.kuaizhizao.services.bom_service import BOMService
from apps.kuaizhizao.services.planning_service import ProductionPlanningService
from apps.kuaizhizao.services.purchase_service import PurchaseService
from apps.kuaizhizao.schemas.work_order import (
    WorkOrderCreate,
    WorkOrderUpdate,
    WorkOrderResponse,
    WorkOrderListResponse
)
from apps.kuaizhizao.schemas.reporting_record import (
    ReportingRecordCreate,
    ReportingRecordUpdate,
    ReportingRecordResponse,
    ReportingRecordListResponse
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
    # 采购入库单
    PurchaseReceiptCreate,
    PurchaseReceiptUpdate,
    PurchaseReceiptResponse,
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
from apps.kuaizhizao.schemas.bom import (
    # BOM物料清单
    BillOfMaterialsCreate,
    BillOfMaterialsUpdate,
    BillOfMaterialsResponse,
    BillOfMaterialsListResponse,
    BillOfMaterialsItemCreate,
    BillOfMaterialsItemUpdate,
    BillOfMaterialsItemResponse,
    # BOM展开和计算
    BOMExpansionResult,
    MaterialRequirement,
)
from apps.kuaizhizao.schemas.planning import (
    # 生产计划
    ProductionPlanResponse,
    ProductionPlanListResponse,
    ProductionPlanItemResponse,
    # MRP运算
    MRPComputationRequest,
    MRPComputationResult,
    # LRP运算
    LRPComputationRequest,
    LRPComputationResult,
)
from apps.kuaizhizao.schemas.purchase import (
    PurchaseOrderCreate,
    PurchaseOrderUpdate,
    PurchaseOrderResponse,
    PurchaseOrderListResponse,
    PurchaseOrderApprove,
    PurchaseOrderConfirm,
    PurchaseOrderListParams,
)

# 创建路由
router = APIRouter(prefix="/production-execution", tags=["Kuaige Zhizao - Production Execution"])


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
    return await WorkOrderService.create_work_order(
        tenant_id=tenant_id,
        work_order_data=work_order,
        created_by=current_user.id
    )


@router.get("/work-orders", response_model=List[WorkOrderListResponse], summary="获取工单列表")
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
) -> List[WorkOrderListResponse]:
    """
    获取工单列表

    支持多种筛选条件的高级搜索。
    """
    return await WorkOrderService.list_work_orders(
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
    return await WorkOrderService.get_work_order_by_id(
        tenant_id=tenant_id,
        work_order_id=work_order_id
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
    return await WorkOrderService.update_work_order(
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
    await WorkOrderService.delete_work_order(
        tenant_id=tenant_id,
        work_order_id=work_order_id
    )

    return JSONResponse(
        content={"message": "工单删除成功"},
        status_code=status.HTTP_200_OK
    )


@router.post("/work-orders/{work_order_id}/release", response_model=WorkOrderResponse, summary="下达工单")
async def release_work_order(
    work_order_id: int,
    current_user: User = Depends(get_current_user),
    tenant_id: int = Depends(get_current_tenant),
) -> WorkOrderResponse:
    """
    下达工单

    - **work_order_id**: 工单ID
    """
    return await WorkOrderService.release_work_order(
        tenant_id=tenant_id,
        work_order_id=work_order_id,
        released_by=current_user.id
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
    return await ReportingService.create_reporting_record(
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

    return await ReportingService.list_reporting_records(
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
    return await ReportingService.get_reporting_record_by_id(
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
    return await ReportingService.approve_reporting_record(
        tenant_id=tenant_id,
        record_id=record_id,
        approved_by=current_user.id,
        rejection_reason=rejection_reason
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
    await ReportingService.delete_reporting_record(
        tenant_id=tenant_id,
        record_id=record_id
    )

    return JSONResponse(
        content={"message": "报工记录删除成功"},
        status_code=status.HTTP_200_OK
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

    statistics = await ReportingService.get_reporting_statistics(
        tenant_id=tenant_id,
        date_start=date_start_dt,
        date_end=date_end_dt,
    )

    return JSONResponse(
        content=statistics,
        status_code=status.HTTP_200_OK
    )


# ============ 生产领料管理 API ============

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
    return await ProductionPickingService.create_production_picking(
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
    return await ProductionPickingService.list_production_pickings(
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
    return await ProductionPickingService.get_production_picking_by_id(
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
    return await ProductionPickingService.confirm_picking(
        tenant_id=tenant_id,
        picking_id=picking_id,
        confirmed_by=current_user.id
    )


# ============ 成品入库管理 API ============

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
    return await FinishedGoodsReceiptService.create_finished_goods_receipt(
        tenant_id=tenant_id,
        receipt_data=receipt,
        created_by=current_user.id
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
    return await FinishedGoodsReceiptService.list_finished_goods_receipts(
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
    return await FinishedGoodsReceiptService.get_finished_goods_receipt_by_id(
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
    return await FinishedGoodsReceiptService.confirm_receipt(
        tenant_id=tenant_id,
        receipt_id=receipt_id,
        confirmed_by=current_user.id
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
    return await SalesDeliveryService.create_sales_delivery(
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
    return await SalesDeliveryService.list_sales_deliveries(
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
    return await SalesDeliveryService.get_sales_delivery_by_id(
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
    return await SalesDeliveryService.confirm_delivery(
        tenant_id=tenant_id,
        delivery_id=delivery_id,
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
    return await PurchaseReceiptService.confirm_receipt(
        tenant_id=tenant_id,
        receipt_id=receipt_id,
        confirmed_by=current_user.id
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
    return await ProcessInspectionService.create_process_inspection(
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
    return await ProcessInspectionService.list_process_inspections(
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
    return await ProcessInspectionService.get_process_inspection_by_id(
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
    return await ProcessInspectionService.conduct_inspection(
        tenant_id=tenant_id,
        inspection_id=inspection_id,
        inspection_data=inspection_data,
        inspected_by=current_user.id
    )


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
    return await FinishedGoodsInspectionService.issue_certificate(
        tenant_id=tenant_id,
        inspection_id=inspection_id,
        certificate_number=certificate_number,
        issued_by=current_user.id
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
    return await PayableService.create_payable(
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

    return await PayableService.list_payables(
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
    return await PayableService.get_payable_by_id(
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
    return await PayableService.record_payment(
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
    return await PayableService.approve_payable(
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
    return await PurchaseInvoiceService.create_purchase_invoice(
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
    return await PurchaseInvoiceService.list_purchase_invoices(
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
    return await PurchaseInvoiceService.get_purchase_invoice_by_id(
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
    return await PurchaseInvoiceService.approve_invoice(
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
    return await ReceivableService.create_receivable(
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

    return await ReceivableService.list_receivables(
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
    return await ReceivableService.get_receivable_by_id(
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
    return await ReceivableService.record_receipt(
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
    return await ReceivableService.approve_receivable(
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
    return await SalesForecastService.create_sales_forecast(
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
    return await SalesForecastService.list_sales_forecasts(
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
    return await SalesForecastService.get_sales_forecast_by_id(
        tenant_id=tenant_id,
        forecast_id=forecast_id
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
    return await SalesForecastService.approve_forecast(
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
    return await SalesForecastService.add_forecast_item(
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
    return await SalesForecastService.get_forecast_items(
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
    return await SalesOrderService.create_sales_order(
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

    return await SalesOrderService.list_sales_orders(
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
    return await SalesOrderService.get_sales_order_by_id(
        tenant_id=tenant_id,
        order_id=order_id
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
    return await SalesOrderService.approve_order(
        tenant_id=tenant_id,
        order_id=order_id,
        approved_by=current_user.id,
        rejection_reason=rejection_reason
    )


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
    return await SalesOrderService.confirm_order(
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
    return await SalesOrderService.add_order_item(
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
    return await SalesOrderService.get_order_items(
        tenant_id=tenant_id,
        order_id=order_id
    )


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
    return await SalesOrderService.update_delivery_status(
        tenant_id=tenant_id,
        order_id=order_id,
        item_id=item_id,
        delivered_quantity=delivered_quantity,
        updated_by=current_user.id
    )


# ============ BOM物料清单管理 API ============

@router.post("/boms", response_model=BillOfMaterialsResponse, summary="创建BOM物料清单")
async def create_bom(
    bom: BillOfMaterialsCreate,
    current_user: User = Depends(get_current_user),
    tenant_id: int = Depends(get_current_tenant),
) -> BillOfMaterialsResponse:
    """
    创建BOM物料清单

    - **bom**: BOM创建数据
    - **current_user**: 当前用户
    - **tenant_id**: 当前组织ID

    返回创建的BOM信息。
    """
    return await BOMService.create_bom(
        tenant_id=tenant_id,
        bom_data=bom,
        created_by=current_user.id
    )


@router.get("/boms", response_model=List[BillOfMaterialsListResponse], summary="获取BOM列表")
async def list_boms(
    skip: int = Query(0, ge=0, description="跳过数量"),
    limit: int = Query(100, ge=1, le=1000, description="限制数量"),
    status: Optional[str] = Query(None, description="BOM状态"),
    finished_product_id: Optional[int] = Query(None, description="成品物料ID"),
    bom_type: Optional[str] = Query(None, description="BOM类型"),
    current_user: User = Depends(get_current_user),
    tenant_id: int = Depends(get_current_tenant),
) -> List[BillOfMaterialsListResponse]:
    """
    获取BOM列表

    支持多种筛选条件的高级搜索。
    """
    return await BOMService.list_boms(
        tenant_id=tenant_id,
        skip=skip,
        limit=limit,
        status=status,
        finished_product_id=finished_product_id,
        bom_type=bom_type,
    )


@router.get("/boms/{bom_id}", response_model=BillOfMaterialsResponse, summary="获取BOM详情")
async def get_bom(
    bom_id: int,
    current_user: User = Depends(get_current_user),
    tenant_id: int = Depends(get_current_tenant),
) -> BillOfMaterialsResponse:
    """
    根据ID获取BOM详情

    - **bom_id**: BOM ID
    """
    return await BOMService.get_bom_by_id(
        tenant_id=tenant_id,
        bom_id=bom_id
    )


@router.post("/boms/{bom_id}/approve", response_model=BillOfMaterialsResponse, summary="审核BOM")
async def approve_bom(
    bom_id: int,
    rejection_reason: Optional[str] = Query(None, description="驳回原因"),
    current_user: User = Depends(get_current_user),
    tenant_id: int = Depends(get_current_tenant),
) -> BillOfMaterialsResponse:
    """
    审核BOM

    - **bom_id**: BOM ID
    - **rejection_reason**: 驳回原因（可选，不填则通过）
    """
    return await BOMService.approve_bom(
        tenant_id=tenant_id,
        bom_id=bom_id,
        approved_by=current_user.id,
        rejection_reason=rejection_reason
    )


@router.post("/boms/{bom_id}/items", response_model=BillOfMaterialsItemResponse, summary="添加BOM明细")
async def add_bom_item(
    bom_id: int,
    item: BillOfMaterialsItemCreate,
    current_user: User = Depends(get_current_user),
    tenant_id: int = Depends(get_current_tenant),
) -> BillOfMaterialsItemResponse:
    """
    添加BOM明细

    - **bom_id**: BOM ID
    - **item**: BOM明细数据
    """
    return await BOMService.add_bom_item(
        tenant_id=tenant_id,
        bom_id=bom_id,
        item_data=item
    )


@router.get("/boms/{bom_id}/items", response_model=List[BillOfMaterialsItemResponse], summary="获取BOM明细")
async def get_bom_items(
    bom_id: int,
    current_user: User = Depends(get_current_user),
    tenant_id: int = Depends(get_current_tenant),
) -> List[BillOfMaterialsItemResponse]:
    """
    获取BOM明细列表

    - **bom_id**: BOM ID
    """
    return await BOMService.get_bom_items(
        tenant_id=tenant_id,
        bom_id=bom_id
    )


@router.get("/boms/{bom_id}/expand", response_model=BOMExpansionResult, summary="展开BOM")
async def expand_bom(
    bom_id: int,
    quantity: float = Query(1.0, gt=0, description="展开数量"),
    current_user: User = Depends(get_current_user),
    tenant_id: int = Depends(get_current_tenant),
) -> BOMExpansionResult:
    """
    展开BOM，计算所有层级的物料需求

    - **bom_id**: BOM ID
    - **quantity**: 展开数量（默认为1.0）
    """
    return await BOMService.expand_bom(
        tenant_id=tenant_id,
        bom_id=bom_id,
        quantity=quantity
    )


@router.get("/boms/{bom_id}/material-requirements", response_model=List[MaterialRequirement], summary="计算物料需求")
async def calculate_material_requirements(
    bom_id: int,
    required_quantity: float = Query(1.0, gt=0, description="需求数量"),
    current_user: User = Depends(get_current_user),
    tenant_id: int = Depends(get_current_tenant),
) -> List[MaterialRequirement]:
    """
    计算BOM的物料需求

    - **bom_id**: BOM ID
    - **required_quantity**: 需求数量
    """
    return await BOMService.calculate_material_requirements(
        tenant_id=tenant_id,
        bom_id=bom_id,
        required_quantity=required_quantity
    )


# ============ 生产计划管理 API ============

@router.post("/mrp-computation", response_model=MRPComputationResult, summary="执行MRP运算")
async def run_mrp_computation(
    mrp_request: MRPComputationRequest,
    current_user: User = Depends(get_current_user),
    tenant_id: int = Depends(get_current_tenant),
) -> MRPComputationResult:
    """
    执行物料需求计划（MRP）运算

    基于销售预测计算物料需求和生产计划

    - **mrp_request**: MRP运算请求参数
    """
    return await ProductionPlanningService.run_mrp_computation(
        tenant_id=tenant_id,
        request=mrp_request,
        user_id=current_user.id
    )


@router.post("/lrp-computation", response_model=LRPComputationResult, summary="执行LRP运算")
async def run_lrp_computation(
    lrp_request: LRPComputationRequest,
    current_user: User = Depends(get_current_user),
    tenant_id: int = Depends(get_current_tenant),
) -> LRPComputationResult:
    """
    执行物流需求计划（LRP）运算

    基于销售订单计算详细的生产和采购计划

    - **lrp_request**: LRP运算请求参数
    """
    return await ProductionPlanningService.run_lrp_computation(
        tenant_id=tenant_id,
        request=lrp_request,
        user_id=current_user.id
    )


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
    return await ProductionPlanningService.list_production_plans(
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
    return await ProductionPlanningService.get_production_plan_by_id(
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
    return await ProductionPlanningService.get_plan_items(
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
    return await ProductionPlanningService.execute_plan(
        tenant_id=tenant_id,
        plan_id=plan_id,
        executed_by=current_user.id
    )


# ============ 采购订单管理 API ============

@router.post("/purchase-orders", response_model=PurchaseOrderResponse, summary="创建采购订单")
async def create_purchase_order(
    order: PurchaseOrderCreate,
    current_user: User = Depends(get_current_user),
    tenant_id: int = Depends(get_current_tenant),
) -> PurchaseOrderResponse:
    """
    创建采购订单

    - **order**: 采购订单创建数据
    - **current_user**: 当前登录用户
    - **tenant_id**: 当前租户ID

    返回创建的采购订单信息
    """
    return await PurchaseService().create_purchase_order(
        tenant_id=tenant_id,
        order_data=order,
        created_by=current_user.id
    )


@router.get("/purchase-orders", response_model=List[PurchaseOrderListResponse], summary="获取采购订单列表")
async def list_purchase_orders(
    skip: int = Query(0, ge=0, description="跳过数量"),
    limit: int = Query(20, ge=1, le=100, description="返回数量"),
    supplier_id: Optional[int] = Query(None, description="供应商ID"),
    status: Optional[str] = Query(None, description="订单状态"),
    review_status: Optional[str] = Query(None, description="审核状态"),
    order_date_from: Optional[date] = Query(None, description="订单日期从"),
    order_date_to: Optional[date] = Query(None, description="订单日期到"),
    delivery_date_from: Optional[date] = Query(None, description="到货日期从"),
    delivery_date_to: Optional[date] = Query(None, description="到货日期到"),
    keyword: Optional[str] = Query(None, description="关键词搜索"),
    tenant_id: int = Depends(get_current_tenant)
) -> List[PurchaseOrderListResponse]:
    """
    获取采购订单列表

    支持多种筛选条件和分页查询
    """
    params = PurchaseOrderListParams(
        skip=skip,
        limit=limit,
        supplier_id=supplier_id,
        status=status,
        review_status=review_status,
        order_date_from=order_date_from,
        order_date_to=order_date_to,
        delivery_date_from=delivery_date_from,
        delivery_date_to=delivery_date_to,
        keyword=keyword
    )

    return await PurchaseService().list_purchase_orders(tenant_id, params)


@router.get("/purchase-orders/{order_id}", response_model=PurchaseOrderResponse, summary="获取采购订单详情")
async def get_purchase_order(
    tenant_id: int = Depends(get_current_tenant),
    order_id: int = Path(..., description="采购订单ID")
) -> PurchaseOrderResponse:
    """
    根据ID获取采购订单详情

    - **order_id**: 采购订单ID
    """
    return await PurchaseService().get_purchase_order_by_id(tenant_id, order_id)


@router.put("/purchase-orders/{order_id}", response_model=PurchaseOrderResponse, summary="更新采购订单")
async def update_purchase_order(
    order: PurchaseOrderUpdate,
    order_id: int = Path(..., description="采购订单ID"),
    current_user: User = Depends(get_current_user),
    tenant_id: int = Depends(get_current_tenant)
) -> PurchaseOrderResponse:
    """
    更新采购订单信息

    只能更新草稿状态的订单

    - **order_id**: 采购订单ID
    - **order**: 采购订单更新数据
    """
    return await PurchaseService().update_purchase_order(
        tenant_id=tenant_id,
        order_id=order_id,
        order_data=order,
        updated_by=current_user.id
    )


@router.delete("/purchase-orders/{order_id}", summary="删除采购订单")
async def delete_purchase_order(
    tenant_id: int = Depends(get_current_tenant),
    order_id: int = Path(..., description="采购订单ID")
):
    """
    删除采购订单

    只能删除草稿状态的订单

    - **order_id**: 采购订单ID
    """
    result = await PurchaseService().delete_purchase_order(tenant_id, order_id)
    return JSONResponse(content={"success": result, "message": "删除成功"})


@router.post("/purchase-orders/{order_id}/approve", response_model=PurchaseOrderResponse, summary="审核采购订单")
async def approve_purchase_order(
    approve_data: PurchaseOrderApprove,
    order_id: int = Path(..., description="采购订单ID"),
    current_user: User = Depends(get_current_user),
    tenant_id: int = Depends(get_current_tenant)
) -> PurchaseOrderResponse:
    """
    审核采购订单

    - **order_id**: 采购订单ID
    - **approve_data**: 审核数据
    """
    return await PurchaseService().approve_purchase_order(
        tenant_id=tenant_id,
        order_id=order_id,
        approve_data=approve_data,
        approved_by=current_user.id
    )


@router.post("/purchase-orders/{order_id}/confirm", response_model=PurchaseOrderResponse, summary="确认采购订单")
async def confirm_purchase_order(
    confirm_data: PurchaseOrderConfirm,
    order_id: int = Path(..., description="采购订单ID"),
    current_user: User = Depends(get_current_user),
    tenant_id: int = Depends(get_current_tenant)
) -> PurchaseOrderResponse:
    """
    确认采购订单（供应商确认）

    - **order_id**: 采购订单ID
    - **confirm_data**: 确认数据
    """
    return await PurchaseService().confirm_purchase_order(
        tenant_id=tenant_id,
        order_id=order_id,
        confirm_data=confirm_data,
        confirmed_by=current_user.id
    )
