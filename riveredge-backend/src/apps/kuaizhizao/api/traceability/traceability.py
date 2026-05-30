from typing import Dict, Literal, List
from fastapi import APIRouter, Query, Depends
from pydantic import BaseModel
from apps.kuaizhizao.services.traceability import TraceabilityService
from core.api.deps import get_current_tenant

router = APIRouter(tags=["App · Kuaige Zhizao · Traceability"])
service = TraceabilityService()

class TraceGraphResponse(BaseModel):
    nodes: List[Dict]
    edges: List[Dict]

@router.get("/graph", response_model=TraceGraphResponse, summary="Get traceability graph")
async def get_trace_graph(
    batch_no: str = Query(..., description="批次号/条码"), 
    direction: Literal["forward", "backward", "both"] = Query("both", description="追溯方向 (forward: 原料->成品, backward: 成品->原料, both: 双向)")
):
    """
    获取指定批次号的正向或反向追溯图谱。
    
    - **batch_no**: 批次号/条码
    - **direction**: 追溯方向 (forward: 原料->成品, backward: 成品->原料, both: 双向)
    """
    return await service.get_trace_graph(batch_no, direction)


@router.get("/graph/by-work-order/{work_order_id}", response_model=TraceGraphResponse, summary="Get traceability graph by work order")
async def get_trace_graph_by_work_order(
    work_order_id: int,
    tenant_id: int = Depends(get_current_tenant),
):
    """按工单获取追溯图谱（含检验/不合格节点）。"""
    return await service.get_trace_graph_by_work_order(tenant_id=tenant_id, work_order_id=work_order_id)
