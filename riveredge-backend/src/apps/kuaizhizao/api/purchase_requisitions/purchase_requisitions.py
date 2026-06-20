"""
采购申请API接口

Author: RiverEdge Team
Date: 2025-02-01
"""

import uuid
from datetime import date
from typing import List, Optional

from fastapi import APIRouter, Depends, Query, Path, HTTPException as FastAPIHTTPException, status
from loguru import logger

from core.api.deps import get_current_user, get_current_tenant
from apps.kuaizhizao.api._kuaizhizao_route_access import require_kuaizhizao_module_access
from infra.models.user import User
from infra.exceptions.exceptions import NotFoundError, BusinessLogicError

from apps.kuaizhizao.schemas.purchase_requisition import (
    PurchaseRequisitionCreate, PurchaseRequisitionUpdate, PurchaseRequisitionResponse,
    PurchaseRequisitionListResponse, ConvertToPurchaseOrderRequest,
    ApproveRequisitionRequest,
)
from apps.kuaizhizao.schemas.purchase_inquiry import (
    CreateFromRequisitionRequest,
    PurchaseInquiryResponse,
)
from apps.kuaizhizao.services.purchase_requisition_service import PurchaseRequisitionService
from apps.kuaizhizao.services.purchase_inquiry_service import PurchaseInquiryService

router = APIRouter(
    tags=["App · Kuaige Zhizao · Purchase Requisition Management"],
    dependencies=[Depends(require_kuaizhizao_module_access("purchase-requisition"))],
)


def _http_exception_with_trace(
    status_code: int,
    message: str,
    route: str = "/purchase-requisitions",
    tenant_id: Optional[int] = None,
) -> FastAPIHTTPException:
    trace_id = uuid.uuid4().hex
    logger.warning(
        "kuaizhizao_purchase_requisitions_api_error trace_id={} tenant_id={} route={} status_code={} message={}",
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


def HTTPException(*, status_code: int, detail: str, **kwargs) -> FastAPIHTTPException:
    return _http_exception_with_trace(status_code, str(detail))


@router.post("/purchase-requisitions", response_model=PurchaseRequisitionResponse, summary="Create purchase requisition")
async def create_requisition(
    data: PurchaseRequisitionCreate,
    current_user: User = Depends(get_current_user),
    tenant_id: int = Depends(get_current_tenant),
):
    """创建采购申请"""
    return await PurchaseRequisitionService().create_requisition(
        tenant_id=tenant_id,
        data=data,
        created_by=current_user.id,
    )


@router.get("/purchase-requisitions", summary="List purchase requisitions")
async def list_requisitions(
    skip: int = Query(0, ge=0),
    limit: int = Query(20, ge=1, le=100),
    status: Optional[str] = Query(
        None,
        description="已废弃：列表请用 lifecycle_stage。status 为库表字段，勿与生命周期钉住 Tab 混用。",
    ),
    lifecycle_stage: Optional[str] = Query(
        None, description="生命周期阶段（与列表展示一致，如 草稿、已通过）"
    ),
    source_type: Optional[str] = Query(None),
    keyword: Optional[str] = Query(None, description="模糊：编号/名称/来源编码"),
    requisition_code: Optional[str] = Query(None),
    requisition_name: Optional[str] = Query(None),
    required_date_from: Optional[date] = Query(None),
    required_date_to: Optional[date] = Query(None),
    tenant_id: int = Depends(get_current_tenant),
):
    """获取采购申请列表"""
    return await PurchaseRequisitionService().list_requisitions(
        tenant_id=tenant_id,
        skip=skip,
        limit=limit,
        status=status,
        lifecycle_stage=lifecycle_stage,
        source_type=source_type,
        keyword=keyword,
        requisition_code=requisition_code,
        requisition_name=requisition_name,
        required_date_from=required_date_from,
        required_date_to=required_date_to,
    )


@router.get("/purchase-requisitions/{requisition_id}", response_model=PurchaseRequisitionResponse, summary="Get purchase requisition")
async def get_requisition(
    requisition_id: int = Path(...),
    tenant_id: int = Depends(get_current_tenant),
):
    """获取采购申请详情"""
    return await PurchaseRequisitionService().get_requisition_by_id(
        tenant_id=tenant_id,
        requisition_id=requisition_id,
    )


@router.get("/purchase-requisitions/{requisition_id}/demand-source-chain", summary="Purchase requisition demand source chain")
async def get_requisition_demand_chain(
    requisition_id: int = Path(...),
    current_user: User = Depends(get_current_user),
    tenant_id: int = Depends(get_current_tenant),
):
    """
    获取采购申请的需求来源追溯链路
    
    追溯路径：PurchaseRequisition → DemandComputation → Demand → SalesOrder/SalesForecast
    """
    try:
        from apps.kuaizhizao.services.demand_source_chain_service import DemandSourceChainService
        from loguru import logger
        service = DemandSourceChainService()
        return await service.get_purchase_requisition_demand_chain(tenant_id, requisition_id)
    except NotFoundError as e:
        raise HTTPException(status_code=status.HTTP_404_NOT_FOUND, detail=str(e))
    except Exception as e:
        logger.exception("获取采购申请需求来源链路失败")
        raise HTTPException(
            status_code=status.HTTP_500_INTERNAL_SERVER_ERROR,
            detail=f"获取需求来源链路失败: {str(e)}",
        )


@router.put("/purchase-requisitions/{requisition_id}", response_model=PurchaseRequisitionResponse, summary="Update purchase requisition")
async def update_requisition(
    data: PurchaseRequisitionUpdate,
    requisition_id: int = Path(...),
    current_user: User = Depends(get_current_user),
    tenant_id: int = Depends(get_current_tenant),
):
    """更新采购申请（仅草稿）"""
    return await PurchaseRequisitionService().update_requisition(
        tenant_id=tenant_id,
        requisition_id=requisition_id,
        data=data,
        updated_by=current_user.id,
    )


@router.post("/purchase-requisitions/{requisition_id}/approve", response_model=PurchaseRequisitionResponse, summary="Approve purchase requisition")
async def approve_requisition(
    data: ApproveRequisitionRequest,
    requisition_id: int = Path(...),
    current_user: User = Depends(get_current_user),
    tenant_id: int = Depends(get_current_tenant),
):
    """审核采购申请（通过或驳回）"""
    return await PurchaseRequisitionService().approve_requisition(
        tenant_id=tenant_id,
        requisition_id=requisition_id,
        approved=data.approved,
        review_remarks=data.review_remarks,
        approved_by=current_user.id,
    )


@router.post("/purchase-requisitions/{requisition_id}/withdraw-approval", response_model=PurchaseRequisitionResponse, summary="Withdraw approval")
async def withdraw_approval(
    requisition_id: int = Path(...),
    current_user: User = Depends(get_current_user),
    tenant_id: int = Depends(get_current_tenant),
):
    """撤回审核：将已通过的采购申请撤回为待审核，可重新审核"""
    return await PurchaseRequisitionService().withdraw_approval(
        tenant_id=tenant_id,
        requisition_id=requisition_id,
        operator_id=current_user.id,
    )


@router.post("/purchase-requisitions/{requisition_id}/submit", response_model=PurchaseRequisitionResponse, summary="Submit purchase requisition")
async def submit_requisition(
    requisition_id: int = Path(...),
    current_user: User = Depends(get_current_user),
    tenant_id: int = Depends(get_current_tenant),
):
    """提交采购申请"""
    return await PurchaseRequisitionService().submit_requisition(
        tenant_id=tenant_id,
        requisition_id=requisition_id,
        submitted_by=current_user.id,
    )


@router.post("/purchase-requisitions/{requisition_id}/convert-to-purchase-order", summary="Push to purchase order")
async def convert_to_purchase_order(
    data: ConvertToPurchaseOrderRequest,
    requisition_id: int = Path(...),
    current_user: User = Depends(get_current_user),
    tenant_id: int = Depends(get_current_tenant),
):
    """将采购申请行转为采购订单"""
    try:
        return await PurchaseRequisitionService().convert_to_purchase_order(
            tenant_id=tenant_id,
            requisition_id=requisition_id,
            data=data,
            created_by=current_user.id,
        )
    except NotFoundError as e:
        raise HTTPException(status_code=404, detail=str(e))
    except BusinessLogicError as e:
        raise HTTPException(status_code=400, detail=str(e))


@router.post(
    "/purchase-requisitions/{requisition_id}/push-to-purchase-inquiry",
    response_model=PurchaseInquiryResponse,
    summary="Push to purchase inquiry",
)
async def push_to_purchase_inquiry(
    data: CreateFromRequisitionRequest,
    requisition_id: int = Path(...),
    current_user: User = Depends(get_current_user),
    tenant_id: int = Depends(get_current_tenant),
):
    """将采购申请下推为采购询价单（统一 push-to 语义入口）。"""
    return await PurchaseInquiryService().create_from_requisition(
        tenant_id=tenant_id,
        requisition_id=requisition_id,
        data=data,
        created_by=current_user.id,
    )


@router.post("/purchase-requisitions/{requisition_id}/fix-status", response_model=PurchaseRequisitionResponse, summary="Fix purchase requisition status")
async def fix_requisition_status(
    requisition_id: int = Path(...),
    current_user: User = Depends(get_current_user),
    tenant_id: int = Depends(get_current_tenant),
):
    """
    修正采购申请状态：若状态为「全部转单」但存在未转单明细，则改为「部分转单」
    用于修复因历史 bug 导致的错误状态
    """
    return await PurchaseRequisitionService().fix_requisition_status(
        tenant_id=tenant_id,
        requisition_id=requisition_id,
    )


@router.delete("/purchase-requisitions/{requisition_id}", status_code=status.HTTP_204_NO_CONTENT, summary="Delete purchase requisition")
async def delete_requisition(
    requisition_id: int = Path(...),
    current_user: User = Depends(get_current_user),
    tenant_id: int = Depends(get_current_tenant),
):
    """删除采购申请（软删除，仅草稿可删）"""
    await PurchaseRequisitionService().delete_requisition(
        tenant_id=tenant_id,
        requisition_id=requisition_id,
    )


