"""
生产协调看板 API
"""

from typing import Optional

from fastapi import APIRouter, Depends, Query

from apps.kuaizhizao.schemas.coordination_board import (
    ActiveComputationsResponse,
    ActiveOrdersResponse,
    CoordinationPipeline,
)
from apps.kuaizhizao.services.coordination_board_service import CoordinationBoardService
from core.api.deps import get_current_user

router = APIRouter(prefix="/coordination-board", tags=["App · Kuaige Zhizao · Coordination Board"])
service = CoordinationBoardService()


@router.get("/active-orders", response_model=ActiveOrdersResponse)
async def list_active_orders(
    limit: int = Query(20, ge=1, le=100),
    current_user=Depends(get_current_user),
):
    """以销售订单为起点，获取协调进行中的订单列表。"""
    return await service.list_active_orders(current_user.tenant_id, limit=limit)


@router.get("/active-computations", response_model=ActiveComputationsResponse)
async def list_active_computations(
    limit: int = Query(20, ge=1, le=100),
    current_user=Depends(get_current_user),
):
    """获取进行中的需求计算列表（供 MRP 选择器）。"""
    return await service.list_active_computations(current_user.tenant_id, limit=limit)


@router.get("/pipeline", response_model=CoordinationPipeline)
async def get_coordination_pipeline(
    computation_id: Optional[int] = Query(None, description="需求计算 ID"),
    sales_order_id: Optional[int] = Query(None, description="销售订单 ID"),
    current_user=Depends(get_current_user),
):
    """获取以 MRP 为锚点的端到端协调管道。"""
    return await service.get_pipeline(
        tenant_id=current_user.tenant_id,
        computation_id=computation_id,
        sales_order_id=sales_order_id,
    )
