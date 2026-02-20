"""
仓库执行 API 路由模块

提供生产领料、成品入库、装箱绑定、库存预警、客户来料登记、
销售出库/退货、采购入库/退货、补货建议等API接口。
"""

from datetime import datetime
from typing import List, Optional, Dict, Any
from fastapi import APIRouter, Depends, Query, status as http_status, Path, HTTPException, Body
from fastapi.responses import JSONResponse, FileResponse, HTMLResponse
from loguru import logger

from core.api.deps import get_current_user, get_current_tenant
from infra.models.user import User
from infra.exceptions.exceptions import ValidationError, BusinessLogicError, NotFoundError

from apps.kuaizhizao.services.warehouse_service import (
    ProductionPickingService,
    ProductionReturnService,
    FinishedGoodsReceiptService,
    SalesDeliveryService,
    SalesReturnService,
    PurchaseReceiptService,
    PurchaseReturnService,
    OtherInboundService,
    OtherOutboundService,
    MaterialBorrowService,
    MaterialReturnService,
)
from apps.kuaizhizao.services.inventory_analysis_service import InventoryAnalysisService
from apps.kuaizhizao.services.inventory_alert_service import InventoryAlertRuleService, InventoryAlertService
from apps.kuaizhizao.services.packing_binding_service import PackingBindingService
from apps.kuaizhizao.services.customer_material_registration_service import (
    BarcodeMappingRuleService,
    CustomerMaterialRegistrationService,
)
from apps.kuaizhizao.services.replenishment_suggestion_service import ReplenishmentSuggestionService

# 初始化服务实例
packing_binding_service = PackingBindingService()
inventory_alert_rule_service = InventoryAlertRuleService()
inventory_alert_service = InventoryAlertService()
inventory_analysis_service = InventoryAnalysisService()
barcode_mapping_rule_service = BarcodeMappingRuleService()
customer_material_registration_service = CustomerMaterialRegistrationService()

from apps.kuaizhizao.schemas.warehouse import (
    ProductionPickingCreate,
    ProductionPickingResponse,
    ProductionPickingListResponse,
    ProductionReturnCreate,
    ProductionReturnUpdate,
    ProductionReturnResponse,
    ProductionReturnListResponse,
    ProductionReturnWithItemsResponse,
    ProductionReturnItemCreate,
    ProductionReturnItemUpdate,
    FinishedGoodsReceiptCreate,
    FinishedGoodsReceiptResponse,
    SalesDeliveryCreate,
    SalesDeliveryResponse,
    SalesReturnCreate,
    SalesReturnResponse,
    PurchaseReceiptCreate,
    PurchaseReceiptResponse,
    PurchaseReturnCreate,
    PurchaseReturnResponse,
    OtherInboundCreate,
    OtherInboundUpdate,
    OtherInboundResponse,
    OtherInboundListResponse,
    OtherInboundWithItemsResponse,
    OtherOutboundCreate,
    OtherOutboundUpdate,
    OtherOutboundResponse,
    OtherOutboundListResponse,
    OtherOutboundWithItemsResponse,
    MaterialBorrowCreate,
    MaterialBorrowUpdate,
    MaterialBorrowResponse,
    MaterialBorrowListResponse,
    MaterialBorrowWithItemsResponse,
    MaterialReturnCreate,
    MaterialReturnUpdate,
    MaterialReturnResponse,
    MaterialReturnListResponse,
    MaterialReturnWithItemsResponse,
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
    InventoryAlertHandleRequest,
)
from apps.kuaizhizao.schemas.packing_binding import (
    PackingBindingCreateFromReceipt,
    PackingBindingUpdate,
    PackingBindingResponse,
    PackingBindingListResponse,
)
from apps.kuaizhizao.schemas.customer_material_registration import (
    BarcodeMappingRuleCreate,
    BarcodeMappingRuleResponse,
    BarcodeMappingRuleListResponse,
    CustomerMaterialRegistrationCreate,
    CustomerMaterialRegistrationResponse,
    CustomerMaterialRegistrationListResponse,
    ParseBarcodeRequest,
    ParseBarcodeResponse,
)

router = APIRouter(tags=["Kuaige Zhizao - Warehouse Execution"])


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


# ============ 生产退料管理 API ============

@router.post("/production-returns", response_model=ProductionReturnResponse, summary="创建生产退料单")
async def create_production_return(
    return_data: ProductionReturnCreate,
    current_user: User = Depends(get_current_user),
    tenant_id: int = Depends(get_current_tenant),
) -> ProductionReturnResponse:
    """创建生产退料单"""
    return await ProductionReturnService().create_production_return(
        tenant_id=tenant_id,
        return_data=return_data,
        created_by=current_user.id
    )


@router.get("/production-returns", response_model=List[ProductionReturnListResponse], summary="获取生产退料单列表")
async def list_production_returns(
    skip: int = Query(0, ge=0),
    limit: int = Query(20, ge=1, le=100),
    status: Optional[str] = Query(None, description="状态筛选"),
    work_order_id: Optional[int] = Query(None, description="工单ID"),
    picking_id: Optional[int] = Query(None, description="领料单ID"),
    current_user: User = Depends(get_current_user),
    tenant_id: int = Depends(get_current_tenant),
) -> List[ProductionReturnListResponse]:
    """获取生产退料单列表"""
    return await ProductionReturnService().list_production_returns(
        tenant_id=tenant_id,
        skip=skip,
        limit=limit,
        status=status,
        work_order_id=work_order_id,
        picking_id=picking_id
    )


@router.get("/production-returns/{return_id}", response_model=ProductionReturnWithItemsResponse, summary="获取生产退料单详情")
async def get_production_return(
    return_id: int,
    current_user: User = Depends(get_current_user),
    tenant_id: int = Depends(get_current_tenant),
) -> ProductionReturnWithItemsResponse:
    """获取生产退料单详情（含明细）"""
    return await ProductionReturnService().get_production_return_by_id(
        tenant_id=tenant_id,
        return_id=return_id
    )


@router.put("/production-returns/{return_id}", response_model=ProductionReturnResponse, summary="更新生产退料单")
async def update_production_return(
    return_id: int,
    return_data: ProductionReturnUpdate,
    current_user: User = Depends(get_current_user),
    tenant_id: int = Depends(get_current_tenant),
) -> ProductionReturnResponse:
    """更新生产退料单"""
    return await ProductionReturnService().update_production_return(
        tenant_id=tenant_id,
        return_id=return_id,
        return_data=return_data,
        updated_by=current_user.id
    )


@router.delete("/production-returns/{return_id}", summary="删除生产退料单")
async def delete_production_return(
    return_id: int,
    current_user: User = Depends(get_current_user),
    tenant_id: int = Depends(get_current_tenant),
):
    """删除生产退料单"""
    await ProductionReturnService().delete_production_return(
        tenant_id=tenant_id,
        return_id=return_id
    )
    return {"success": True}


@router.post("/production-returns/{return_id}/confirm", response_model=ProductionReturnResponse, summary="确认退料")
async def confirm_production_return(
    return_id: int,
    current_user: User = Depends(get_current_user),
    tenant_id: int = Depends(get_current_tenant),
) -> ProductionReturnResponse:
    """确认生产退料"""
    return await ProductionReturnService().confirm_return(
        tenant_id=tenant_id,
        return_id=return_id,
        confirmed_by=current_user.id
    )


@router.get("/production-returns/{return_id}/print", summary="打印生产退料单")
async def print_production_return(
    return_id: int,
    template_code: Optional[str] = Query(None, description="打印模板代码"),
    template_uuid: Optional[str] = Query(None, description="打印模板UUID"),
    output_format: str = Query("html", description="输出格式"),
    response_format: str = Query("json", description="响应格式"),
    current_user: User = Depends(get_current_user),
    tenant_id: int = Depends(get_current_tenant),
):
    """打印生产退料单"""
    from apps.kuaizhizao.services.print_service import DocumentPrintService
    result = await DocumentPrintService().print_document(
        tenant_id=tenant_id,
        document_type="production_return",
        document_id=return_id,
        template_code=template_code,
        template_uuid=template_uuid,
        output_format=output_format
    )
    if response_format == "html":
        return HTMLResponse(content=result.get("content", ""), status_code=200)
    return JSONResponse(content=result, status_code=200)


# ============ 其他入库单 API ============

@router.post("/other-inbounds", response_model=OtherInboundResponse, summary="创建其他入库单")
async def create_other_inbound(
    inbound_data: OtherInboundCreate,
    current_user: User = Depends(get_current_user),
    tenant_id: int = Depends(get_current_tenant),
):
    """创建其他入库单"""
    return await OtherInboundService().create_other_inbound(
        tenant_id=tenant_id,
        inbound_data=inbound_data,
        created_by=current_user.id
    )


@router.get("/other-inbounds", response_model=List[OtherInboundListResponse], summary="获取其他入库单列表")
async def list_other_inbounds(
    skip: int = Query(0, ge=0),
    limit: int = Query(20, ge=1, le=100),
    status: Optional[str] = Query(None, description="状态筛选"),
    reason_type: Optional[str] = Query(None, description="原因类型筛选"),
    warehouse_id: Optional[int] = Query(None, description="仓库ID筛选"),
    current_user: User = Depends(get_current_user),
    tenant_id: int = Depends(get_current_tenant),
):
    """获取其他入库单列表"""
    return await OtherInboundService().list_other_inbounds(
        tenant_id=tenant_id,
        skip=skip,
        limit=limit,
        status=status,
        reason_type=reason_type,
        warehouse_id=warehouse_id,
    )


@router.get("/other-inbounds/{inbound_id}", response_model=OtherInboundWithItemsResponse, summary="获取其他入库单详情")
async def get_other_inbound(
    inbound_id: int,
    current_user: User = Depends(get_current_user),
    tenant_id: int = Depends(get_current_tenant),
):
    """获取其他入库单详情（含明细）"""
    return await OtherInboundService().get_other_inbound_by_id(
        tenant_id=tenant_id,
        inbound_id=inbound_id
    )


@router.put("/other-inbounds/{inbound_id}", response_model=OtherInboundResponse, summary="更新其他入库单")
async def update_other_inbound(
    inbound_id: int,
    inbound_data: OtherInboundUpdate,
    current_user: User = Depends(get_current_user),
    tenant_id: int = Depends(get_current_tenant),
):
    """更新其他入库单"""
    return await OtherInboundService().update_other_inbound(
        tenant_id=tenant_id,
        inbound_id=inbound_id,
        inbound_data=inbound_data,
        updated_by=current_user.id
    )


@router.delete("/other-inbounds/{inbound_id}", summary="删除其他入库单")
async def delete_other_inbound(
    inbound_id: int,
    current_user: User = Depends(get_current_user),
    tenant_id: int = Depends(get_current_tenant),
):
    """删除其他入库单"""
    await OtherInboundService().delete_other_inbound(
        tenant_id=tenant_id,
        inbound_id=inbound_id
    )


@router.post("/other-inbounds/{inbound_id}/confirm", response_model=OtherInboundResponse, summary="确认入库")
async def confirm_other_inbound(
    inbound_id: int,
    current_user: User = Depends(get_current_user),
    tenant_id: int = Depends(get_current_tenant),
):
    """确认其他入库"""
    return await OtherInboundService().confirm_inbound(
        tenant_id=tenant_id,
        inbound_id=inbound_id,
        confirmed_by=current_user.id
    )


@router.get("/other-inbounds/{inbound_id}/print", summary="打印其他入库单")
async def print_other_inbound(
    inbound_id: int,
    template_code: Optional[str] = Query(None, description="打印模板代码"),
    template_uuid: Optional[str] = Query(None, description="打印模板UUID"),
    output_format: str = Query("html", description="输出格式"),
    response_format: str = Query("json", description="响应格式"),
    current_user: User = Depends(get_current_user),
    tenant_id: int = Depends(get_current_tenant),
):
    """打印其他入库单"""
    from apps.kuaizhizao.services.print_service import DocumentPrintService
    result = await DocumentPrintService().print_document(
        tenant_id=tenant_id,
        document_type="other_inbound",
        document_id=inbound_id,
        template_code=template_code,
        template_uuid=template_uuid,
        output_format=output_format
    )
    if response_format == "html":
        return HTMLResponse(content=result.get("content", ""), status_code=200)
    return JSONResponse(content=result, status_code=200)


# ============ 其他出库单 API ============

@router.post("/other-outbounds", response_model=OtherOutboundResponse, summary="创建其他出库单")
async def create_other_outbound(
    outbound_data: OtherOutboundCreate,
    current_user: User = Depends(get_current_user),
    tenant_id: int = Depends(get_current_tenant),
):
    """创建其他出库单"""
    return await OtherOutboundService().create_other_outbound(
        tenant_id=tenant_id,
        outbound_data=outbound_data,
        created_by=current_user.id
    )


@router.get("/other-outbounds", response_model=List[OtherOutboundListResponse], summary="获取其他出库单列表")
async def list_other_outbounds(
    skip: int = Query(0, ge=0),
    limit: int = Query(20, ge=1, le=100),
    status: Optional[str] = Query(None, description="状态筛选"),
    reason_type: Optional[str] = Query(None, description="原因类型筛选"),
    warehouse_id: Optional[int] = Query(None, description="仓库ID筛选"),
    current_user: User = Depends(get_current_user),
    tenant_id: int = Depends(get_current_tenant),
):
    """获取其他出库单列表"""
    return await OtherOutboundService().list_other_outbounds(
        tenant_id=tenant_id,
        skip=skip,
        limit=limit,
        status=status,
        reason_type=reason_type,
        warehouse_id=warehouse_id,
    )


@router.get("/other-outbounds/{outbound_id}", response_model=OtherOutboundWithItemsResponse, summary="获取其他出库单详情")
async def get_other_outbound(
    outbound_id: int,
    current_user: User = Depends(get_current_user),
    tenant_id: int = Depends(get_current_tenant),
):
    """获取其他出库单详情（含明细）"""
    return await OtherOutboundService().get_other_outbound_by_id(
        tenant_id=tenant_id,
        outbound_id=outbound_id
    )


@router.put("/other-outbounds/{outbound_id}", response_model=OtherOutboundResponse, summary="更新其他出库单")
async def update_other_outbound(
    outbound_id: int,
    outbound_data: OtherOutboundUpdate,
    current_user: User = Depends(get_current_user),
    tenant_id: int = Depends(get_current_tenant),
):
    """更新其他出库单"""
    return await OtherOutboundService().update_other_outbound(
        tenant_id=tenant_id,
        outbound_id=outbound_id,
        outbound_data=outbound_data,
        updated_by=current_user.id
    )


@router.delete("/other-outbounds/{outbound_id}", summary="删除其他出库单")
async def delete_other_outbound(
    outbound_id: int,
    current_user: User = Depends(get_current_user),
    tenant_id: int = Depends(get_current_tenant),
):
    """删除其他出库单"""
    await OtherOutboundService().delete_other_outbound(
        tenant_id=tenant_id,
        outbound_id=outbound_id
    )


@router.post("/other-outbounds/{outbound_id}/confirm", response_model=OtherOutboundResponse, summary="确认出库")
async def confirm_other_outbound(
    outbound_id: int,
    current_user: User = Depends(get_current_user),
    tenant_id: int = Depends(get_current_tenant),
):
    """确认其他出库"""
    return await OtherOutboundService().confirm_outbound(
        tenant_id=tenant_id,
        outbound_id=outbound_id,
        confirmed_by=current_user.id
    )


@router.get("/other-outbounds/{outbound_id}/print", summary="打印其他出库单")
async def print_other_outbound(
    outbound_id: int,
    template_code: Optional[str] = Query(None, description="打印模板代码"),
    template_uuid: Optional[str] = Query(None, description="打印模板UUID"),
    output_format: str = Query("html", description="输出格式"),
    response_format: str = Query("json", description="响应格式"),
    current_user: User = Depends(get_current_user),
    tenant_id: int = Depends(get_current_tenant),
):
    """打印其他出库单"""
    from apps.kuaizhizao.services.print_service import DocumentPrintService
    result = await DocumentPrintService().print_document(
        tenant_id=tenant_id,
        document_type="other_outbound",
        document_id=outbound_id,
        template_code=template_code,
        template_uuid=template_uuid,
        output_format=output_format
    )
    if response_format == "html":
        return HTMLResponse(content=result.get("content", ""), status_code=200)
    return JSONResponse(content=result, status_code=200)


# ============ 借料单 API ============

@router.post("/material-borrows", response_model=MaterialBorrowResponse, summary="创建借料单")
async def create_material_borrow(
    borrow_data: MaterialBorrowCreate,
    current_user: User = Depends(get_current_user),
    tenant_id: int = Depends(get_current_tenant),
):
    """创建借料单"""
    return await MaterialBorrowService().create_material_borrow(
        tenant_id=tenant_id,
        borrow_data=borrow_data,
        created_by=current_user.id
    )


@router.get("/material-borrows", response_model=List[MaterialBorrowListResponse], summary="获取借料单列表")
async def list_material_borrows(
    skip: int = Query(0, ge=0),
    limit: int = Query(20, ge=1, le=100),
    status: Optional[str] = Query(None),
    warehouse_id: Optional[int] = Query(None),
    current_user: User = Depends(get_current_user),
    tenant_id: int = Depends(get_current_tenant),
):
    """获取借料单列表"""
    return await MaterialBorrowService().list_material_borrows(
        tenant_id=tenant_id,
        skip=skip,
        limit=limit,
        status=status,
        warehouse_id=warehouse_id,
    )


@router.get("/material-borrows/{borrow_id}", response_model=MaterialBorrowWithItemsResponse, summary="获取借料单详情")
async def get_material_borrow(
    borrow_id: int,
    current_user: User = Depends(get_current_user),
    tenant_id: int = Depends(get_current_tenant),
):
    """获取借料单详情（含明细）"""
    return await MaterialBorrowService().get_material_borrow_by_id(
        tenant_id=tenant_id,
        borrow_id=borrow_id
    )


@router.put("/material-borrows/{borrow_id}", response_model=MaterialBorrowResponse, summary="更新借料单")
async def update_material_borrow(
    borrow_id: int,
    borrow_data: MaterialBorrowUpdate,
    current_user: User = Depends(get_current_user),
    tenant_id: int = Depends(get_current_tenant),
):
    """更新借料单"""
    return await MaterialBorrowService().update_material_borrow(
        tenant_id=tenant_id,
        borrow_id=borrow_id,
        borrow_data=borrow_data,
        updated_by=current_user.id
    )


@router.delete("/material-borrows/{borrow_id}", summary="删除借料单")
async def delete_material_borrow(
    borrow_id: int,
    current_user: User = Depends(get_current_user),
    tenant_id: int = Depends(get_current_tenant),
):
    """删除借料单"""
    await MaterialBorrowService().delete_material_borrow(
        tenant_id=tenant_id,
        borrow_id=borrow_id
    )


@router.post("/material-borrows/{borrow_id}/confirm", response_model=MaterialBorrowResponse, summary="确认借出")
async def confirm_material_borrow(
    borrow_id: int,
    current_user: User = Depends(get_current_user),
    tenant_id: int = Depends(get_current_tenant),
):
    """确认借出"""
    return await MaterialBorrowService().confirm_borrow(
        tenant_id=tenant_id,
        borrow_id=borrow_id,
        confirmed_by=current_user.id
    )


@router.get("/material-borrows/{borrow_id}/print", summary="打印借料单")
async def print_material_borrow(
    borrow_id: int,
    template_code: Optional[str] = Query(None),
    template_uuid: Optional[str] = Query(None),
    output_format: str = Query("html"),
    response_format: str = Query("json"),
    current_user: User = Depends(get_current_user),
    tenant_id: int = Depends(get_current_tenant),
):
    """打印借料单"""
    from apps.kuaizhizao.services.print_service import DocumentPrintService
    result = await DocumentPrintService().print_document(
        tenant_id=tenant_id,
        document_type="material_borrow",
        document_id=borrow_id,
        template_code=template_code,
        template_uuid=template_uuid,
        output_format=output_format
    )
    if response_format == "html":
        return HTMLResponse(content=result.get("content", ""), status_code=200)
    return JSONResponse(content=result, status_code=200)


# ============ 还料单 API ============

@router.post("/material-returns", response_model=MaterialReturnResponse, summary="创建还料单")
async def create_material_return(
    return_data: MaterialReturnCreate,
    current_user: User = Depends(get_current_user),
    tenant_id: int = Depends(get_current_tenant),
):
    """创建还料单"""
    return await MaterialReturnService().create_material_return(
        tenant_id=tenant_id,
        return_data=return_data,
        created_by=current_user.id
    )


@router.get("/material-returns", response_model=List[MaterialReturnListResponse], summary="获取还料单列表")
async def list_material_returns(
    skip: int = Query(0, ge=0),
    limit: int = Query(20, ge=1, le=100),
    status: Optional[str] = Query(None),
    borrow_id: Optional[int] = Query(None),
    warehouse_id: Optional[int] = Query(None),
    current_user: User = Depends(get_current_user),
    tenant_id: int = Depends(get_current_tenant),
):
    """获取还料单列表"""
    return await MaterialReturnService().list_material_returns(
        tenant_id=tenant_id,
        skip=skip,
        limit=limit,
        status=status,
        borrow_id=borrow_id,
        warehouse_id=warehouse_id,
    )


@router.get("/material-returns/{return_id}", response_model=MaterialReturnWithItemsResponse, summary="获取还料单详情")
async def get_material_return(
    return_id: int,
    current_user: User = Depends(get_current_user),
    tenant_id: int = Depends(get_current_tenant),
):
    """获取还料单详情（含明细）"""
    return await MaterialReturnService().get_material_return_by_id(
        tenant_id=tenant_id,
        return_id=return_id
    )


@router.put("/material-returns/{return_id}", response_model=MaterialReturnResponse, summary="更新还料单")
async def update_material_return(
    return_id: int,
    return_data: MaterialReturnUpdate,
    current_user: User = Depends(get_current_user),
    tenant_id: int = Depends(get_current_tenant),
):
    """更新还料单"""
    return await MaterialReturnService().update_material_return(
        tenant_id=tenant_id,
        return_id=return_id,
        return_data=return_data,
        updated_by=current_user.id
    )


@router.delete("/material-returns/{return_id}", summary="删除还料单")
async def delete_material_return(
    return_id: int,
    current_user: User = Depends(get_current_user),
    tenant_id: int = Depends(get_current_tenant),
):
    """删除还料单"""
    await MaterialReturnService().delete_material_return(
        tenant_id=tenant_id,
        return_id=return_id
    )


@router.post("/material-returns/{return_id}/confirm", response_model=MaterialReturnResponse, summary="确认归还")
async def confirm_material_return(
    return_id: int,
    current_user: User = Depends(get_current_user),
    tenant_id: int = Depends(get_current_tenant),
):
    """确认归还"""
    return await MaterialReturnService().confirm_return(
        tenant_id=tenant_id,
        return_id=return_id,
        confirmed_by=current_user.id
    )


@router.get("/material-returns/{return_id}/print", summary="打印还料单")
async def print_material_return(
    return_id: int,
    template_code: Optional[str] = Query(None),
    template_uuid: Optional[str] = Query(None),
    output_format: str = Query("html"),
    response_format: str = Query("json"),
    current_user: User = Depends(get_current_user),
    tenant_id: int = Depends(get_current_tenant),
):
    """打印还料单"""
    from apps.kuaizhizao.services.print_service import DocumentPrintService
    result = await DocumentPrintService().print_document(
        tenant_id=tenant_id,
        document_type="material_return",
        document_id=return_id,
        template_code=template_code,
        template_uuid=template_uuid,
        output_format=output_format
    )
    if response_format == "html":
        return HTMLResponse(content=result.get("content", ""), status_code=200)
    return JSONResponse(content=result, status_code=200)


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


# ============ 装箱绑定管理 API ============

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
        status_code=http_status.HTTP_200_OK
    )


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


# ============ 库存预警记录 API ============
# 注意：/statistics 必须在 /{alert_id} 之前定义，避免路径冲突

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


# ============ 条码映射规则管理 API ============
# 注意：这些路由必须在 /{registration_id} 路由之前，避免路由冲突

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
            status_code=http_status.HTTP_422_UNPROCESSABLE_ENTITY,
            detail=str(e)
        )
    except Exception as e:
        logger.error(f"导入销售出库单失败: {str(e)}")
        raise HTTPException(
            status_code=http_status.HTTP_500_INTERNAL_SERVER_ERROR,
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
            status_code=http_status.HTTP_500_INTERNAL_SERVER_ERROR,
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
            status_code=http_status.HTTP_500_INTERNAL_SERVER_ERROR,
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
    return await PurchaseReceiptService().create_purchase_receipt(
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
    return await PurchaseReceiptService().list_purchase_receipts(
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
    return await PurchaseReceiptService().get_purchase_receipt_by_id(
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
            status_code=http_status.HTTP_422_UNPROCESSABLE_ENTITY,
            detail=str(e)
        )
    except Exception as e:
        logger.error(f"导入采购入库单失败: {str(e)}")
        raise HTTPException(
            status_code=http_status.HTTP_500_INTERNAL_SERVER_ERROR,
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
            status_code=http_status.HTTP_500_INTERNAL_SERVER_ERROR,
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
# 注意：/statistics 必须在 /{suggestion_id} 之前定义，避免路径冲突

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
