"""
采购申请API接口

Author: RiverEdge Team
Date: 2025-02-01
"""

from typing import List, Optional

from fastapi import APIRouter, Depends, Query, Path, HTTPException, status

from core.api.deps import get_current_user, get_current_tenant
from infra.models.user import User
from infra.exceptions.exceptions import NotFoundError, BusinessLogicError

from apps.kuaizhizao.schemas.purchase_requisition import (
    PurchaseRequisitionCreate, PurchaseRequisitionUpdate, PurchaseRequisitionResponse,
    PurchaseRequisitionListResponse, ConvertToPurchaseOrderRequest, UrgentPurchaseRequest,
    ApproveRequisitionRequest,
)
from apps.kuaizhizao.services.purchase_requisition_service import PurchaseRequisitionService

router = APIRouter(tags=["采购申请管理"])


@router.post("/purchase-requisitions", response_model=PurchaseRequisitionResponse, summary="创建采购申请")
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


@router.get("/purchase-requisitions", summary="获取采购申请列表")
async def list_requisitions(
    skip: int = Query(0, ge=0),
    limit: int = Query(20, ge=1, le=100),
    status: Optional[str] = Query(None),
    source_type: Optional[str] = Query(None),
    tenant_id: int = Depends(get_current_tenant),
):
    """获取采购申请列表"""
    return await PurchaseRequisitionService().list_requisitions(
        tenant_id=tenant_id,
        skip=skip,
        limit=limit,
        status=status,
        source_type=source_type,
    )


@router.get("/purchase-requisitions/{requisition_id}", response_model=PurchaseRequisitionResponse, summary="获取采购申请详情")
async def get_requisition(
    requisition_id: int = Path(...),
    tenant_id: int = Depends(get_current_tenant),
):
    """获取采购申请详情"""
    return await PurchaseRequisitionService().get_requisition_by_id(
        tenant_id=tenant_id,
        requisition_id=requisition_id,
    )


@router.get("/purchase-requisitions/{requisition_id}/demand-source-chain", summary="获取采购申请需求来源链路")
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


@router.put("/purchase-requisitions/{requisition_id}", response_model=PurchaseRequisitionResponse, summary="更新采购申请")
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


@router.post("/purchase-requisitions/{requisition_id}/approve", response_model=PurchaseRequisitionResponse, summary="审核采购申请")
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


@router.post("/purchase-requisitions/{requisition_id}/submit", response_model=PurchaseRequisitionResponse, summary="提交采购申请")
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


@router.post("/purchase-requisitions/{requisition_id}/convert-to-purchase-order", summary="转采购单")
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


@router.delete("/purchase-requisitions/{requisition_id}", status_code=status.HTTP_204_NO_CONTENT, summary="删除采购申请")
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


@router.post("/purchase-requisitions/{requisition_id}/urgent-purchase", summary="紧急采购")
async def urgent_purchase(
    data: UrgentPurchaseRequest,
    requisition_id: int = Path(...),
    current_user: User = Depends(get_current_user),
    tenant_id: int = Depends(get_current_tenant),
):
    """紧急采购：跳过审批直接生成采购单"""
    try:
        return await PurchaseRequisitionService().urgent_purchase(
            tenant_id=tenant_id,
            requisition_id=requisition_id,
            data=data,
            operator_id=current_user.id,
        )
    except NotFoundError as e:
        raise HTTPException(status_code=404, detail=str(e))
    except BusinessLogicError as e:
        raise HTTPException(status_code=400, detail=str(e))
