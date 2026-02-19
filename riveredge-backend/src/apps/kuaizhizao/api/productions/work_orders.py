"""
工单、返工单、工序委外 API 路由模块

提供工单、返工单、工序委外管理的API接口。
"""

from typing import List, Optional
from fastapi import APIRouter, Depends, Query, status as http_status, HTTPException
from fastapi.responses import JSONResponse
from loguru import logger

from core.api.deps import get_current_user, get_current_tenant
from infra.models.user import User
from infra.exceptions.exceptions import NotFoundError

from apps.kuaizhizao.services.work_order_service import WorkOrderService
from apps.kuaizhizao.services.rework_order_service import ReworkOrderService
from apps.kuaizhizao.services.demand_source_chain_service import DemandSourceChainService
from apps.kuaizhizao.services.outsource_service import OutsourceService
from apps.kuaizhizao.schemas.work_order import (
    WorkOrderCreate,
    WorkOrderUpdate,
    WorkOrderBatchUpdateDatesRequest,
    WorkOrderResponse,
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
from apps.kuaizhizao.schemas.outsource_order import (
    OutsourceOrderCreate,
    OutsourceOrderCreateFromWorkOrder,
    OutsourceOrderUpdate,
    OutsourceOrderResponse,
    OutsourceOrderListResponse,
)

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
    assigned_worker_id: Optional[int] = Query(None, description="分配员工ID（只看当前用户时传入）"),
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
            assigned_worker_id=assigned_worker_id,
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
            assigned_worker_id=assigned_worker_id,
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


@router.get("/work-orders/{work_order_id}/demand-source-chain", summary="获取工单需求来源链路")
async def get_work_order_demand_chain(
    work_order_id: int,
    current_user: User = Depends(get_current_user),
    tenant_id: int = Depends(get_current_tenant),
):
    """
    获取工单的需求来源追溯链路

    追溯路径：WorkOrder → DemandComputation → Demand → SalesOrder/SalesForecast
    """
    try:
        service = DemandSourceChainService()
        return await service.get_work_order_demand_chain(tenant_id, work_order_id)
    except Exception as e:
        if isinstance(e, NotFoundError):
            raise HTTPException(status_code=http_status.HTTP_404_NOT_FOUND, detail=str(e))
        logger.exception("获取工单需求来源链路失败")
        raise HTTPException(
            status_code=http_status.HTTP_500_INTERNAL_SERVER_ERROR,
            detail=f"获取需求来源链路失败: {str(e)}",
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


@router.post("/work-orders/{work_order_id}/operations/{operation_id}/dispatch", response_model=WorkOrderOperationResponse, summary="派工工单工序")
async def dispatch_work_order_operation(
    work_order_id: int,
    operation_id: int,
    dispatch_data: WorkOrderOperationDispatch,
    current_user: User = Depends(get_current_user),
    tenant_id: int = Depends(get_current_tenant),
) -> WorkOrderOperationResponse:
    """
    派工工单工序

    分配工序给具体的人员或设备。

    - **work_order_id**: 工单ID
    - **operation_id**: 工序ID
    - **dispatch_data**: 派工数据（worker_id, equipment_id等）
    """
    return await WorkOrderService().dispatch_work_order_operation(
        tenant_id=tenant_id,
        work_order_id=work_order_id,
        operation_id=operation_id,
        dispatch_data=dispatch_data,
        dispatched_by=current_user.id
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


@router.put("/work-orders/batch-update-dates", summary="批量更新工单计划日期")
async def batch_update_work_order_dates(
    request: WorkOrderBatchUpdateDatesRequest,
    current_user: User = Depends(get_current_user),
    tenant_id: int = Depends(get_current_tenant),
):
    """
    批量更新工单计划日期（甘特图拖拽后持久化）

    - **updates**: 更新项列表，每项包含 work_order_id、planned_start_date、planned_end_date
    """
    await WorkOrderService().batch_update_dates(
        tenant_id=tenant_id,
        updates=request.updates,
        updated_by=current_user.id,
    )
    return {"success": True, "message": "更新成功"}


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
        status_code=http_status.HTTP_200_OK
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
        status_code=http_status.HTTP_200_OK
    )


@router.post("/work-orders/{work_order_id}/outsource", response_model=OutsourceOrderResponse, summary="从工单创建工序委外")
async def create_outsource_order_from_work_order(
    work_order_id: int,
    outsource_data: OutsourceOrderCreateFromWorkOrder,
    current_user: User = Depends(get_current_user),
    tenant_id: int = Depends(get_current_tenant),
) -> OutsourceOrderResponse:
    """
    从工单工序创建工序委外

    根据工单工序信息创建工序委外单，自动关联工单和工序。

    - **work_order_id**: 工单ID
    - **outsource_data**: 工序委外单创建数据（工单工序ID、供应商ID、委外数量等）
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


# ============ 工序委外管理 API ============

@router.post("/outsource-orders", response_model=OutsourceOrderResponse, summary="创建工序委外")
async def create_outsource_order(
    outsource_order: OutsourceOrderCreate,
    current_user: User = Depends(get_current_user),
    tenant_id: int = Depends(get_current_tenant),
) -> OutsourceOrderResponse:
    """
    创建工序委外

    - **outsource_order**: 工序委外单创建数据
    """
    return await OutsourceService().create_outsource_order(
        tenant_id=tenant_id,
        outsource_order_data=outsource_order,
        created_by=current_user.id
    )


@router.get("/outsource-orders", response_model=List[OutsourceOrderListResponse], summary="获取工序委外列表")
async def list_outsource_orders(
    skip: int = Query(0, ge=0, description="跳过数量"),
    limit: int = Query(100, ge=1, le=1000, description="限制数量"),
    work_order_id: Optional[int] = Query(None, description="工单ID"),
    supplier_id: Optional[int] = Query(None, description="供应商ID"),
    status: Optional[str] = Query(None, description="工序委外状态"),
    code: Optional[str] = Query(None, description="工序委外单编码（模糊搜索）"),
    current_user: User = Depends(get_current_user),
    tenant_id: int = Depends(get_current_tenant),
) -> List[OutsourceOrderListResponse]:
    """
    获取工序委外列表

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


@router.get("/outsource-orders/{outsource_order_id}", response_model=OutsourceOrderResponse, summary="获取工序委外详情")
async def get_outsource_order(
    outsource_order_id: int,
    current_user: User = Depends(get_current_user),
    tenant_id: int = Depends(get_current_tenant),
) -> OutsourceOrderResponse:
    """
    根据ID获取工序委外详情

    - **outsource_order_id**: 工序委外单ID
    """
    return await OutsourceService().get_outsource_order_by_id(
        tenant_id=tenant_id,
        outsource_order_id=outsource_order_id
    )


@router.put("/outsource-orders/{outsource_order_id}", response_model=OutsourceOrderResponse, summary="更新工序委外")
async def update_outsource_order(
    outsource_order_id: int,
    outsource_order: OutsourceOrderUpdate,
    current_user: User = Depends(get_current_user),
    tenant_id: int = Depends(get_current_tenant),
) -> OutsourceOrderResponse:
    """
    更新工序委外信息

    - **outsource_order_id**: 工序委外单ID
    - **outsource_order**: 工序委外单更新数据
    """
    return await OutsourceService().update_outsource_order(
        tenant_id=tenant_id,
        outsource_order_id=outsource_order_id,
        outsource_order_data=outsource_order,
        updated_by=current_user.id
    )


@router.delete("/outsource-orders/{outsource_order_id}", summary="删除工序委外")
async def delete_outsource_order(
    outsource_order_id: int,
    current_user: User = Depends(get_current_user),
    tenant_id: int = Depends(get_current_tenant),
) -> JSONResponse:
    """
    删除工序委外（软删除）

    - **outsource_order_id**: 工序委外单ID
    """
    await OutsourceService().delete_outsource_order(
        tenant_id=tenant_id,
        outsource_order_id=outsource_order_id,
        deleted_by=current_user.id
    )

    return JSONResponse(
        content={"message": "工序委外删除成功"},
        status_code=http_status.HTTP_200_OK
    )


@router.post("/outsource-orders/{outsource_order_id}/link-purchase-receipt", response_model=OutsourceOrderResponse, summary="关联采购入库单")
async def link_purchase_receipt_to_outsource_order(
    outsource_order_id: int,
    purchase_receipt_id: int = Query(..., description="采购入库单ID"),
    current_user: User = Depends(get_current_user),
    tenant_id: int = Depends(get_current_tenant),
) -> OutsourceOrderResponse:
    """
    关联采购入库单（工序委外入库）

    - **outsource_order_id**: 工序委外单ID
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
    current_user: User = Depends(get_current_user),
    tenant_id: int = Depends(get_current_tenant),
) -> WorkOrderResponse:
    """
    下达工单

    将工单状态从"草稿"更新为"已下达"。
    是否检查缺料由业务配置「允许不带料生产」决定：开启时只管制造过程，不检查缺料。

    - **work_order_id**: 工单ID
    """
    from infra.services.business_config_service import BusinessConfigService
    allow_without_material = await BusinessConfigService().allow_production_without_material(tenant_id)
    check_shortage = not allow_without_material
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
        status_code=http_status.HTTP_200_OK
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
        status_code=http_status.HTTP_200_OK
    )
