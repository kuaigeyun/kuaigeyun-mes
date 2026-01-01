"""
生产执行 API 路由模块

提供工单管理和报工管理的API接口。
"""

from datetime import date
from typing import List, Optional, Dict, Any
from fastapi import APIRouter, Depends, Query, status, Path, HTTPException
from fastapi.responses import JSONResponse, FileResponse
from loguru import logger

from core.api.deps import get_current_user, get_current_tenant
from infra.models.user import User
from infra.exceptions.exceptions import ValidationError, BusinessLogicError

from apps.kuaizhizao.services.work_order_service import WorkOrderService
from apps.kuaizhizao.services.reporting_service import ReportingService

# 初始化服务实例
reporting_service = ReportingService()
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
# BOM管理已移至master_data APP，不再需要BOMService
from apps.kuaizhizao.services.planning_service import ProductionPlanningService
from apps.kuaizhizao.schemas.work_order import (
    WorkOrderCreate,
    WorkOrderUpdate,
    WorkOrderResponse,
    WorkOrderListResponse,
    MaterialShortageResponse
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
    return await WorkOrderService().list_work_orders(
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
    return await WorkOrderService().get_work_order_by_id(
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
    return await FinishedGoodsReceiptService().create_finished_goods_receipt(
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
    return await FinishedGoodsInspectionService().issue_certificate(
        tenant_id=tenant_id,
        inspection_id=inspection_id,
        certificate_number=certificate_number,
        issued_by=current_user.id
    )


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
    return await ProductionPlanningService().run_mrp_computation(
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


# ============ 采购订单管理 API ============
# 注意：采购订单API已移至 purchase.py，此处不再重复实现
# 请使用 /purchase-orders 路径访问采购订单API
