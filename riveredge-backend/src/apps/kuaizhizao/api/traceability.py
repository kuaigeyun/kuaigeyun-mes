from typing import Dict, Literal, List
from fastapi import APIRouter, Query, Request
from pydantic import BaseModel
from apps.kuaizhizao.services.traceability import TraceabilityService

router = APIRouter(tags=["追溯管理"])
service = TraceabilityService()

class TraceGraphResponse(BaseModel):
    nodes: List[Dict]
    edges: List[Dict]

@router.get("/graph", response_model=TraceGraphResponse, summary="获取追溯图谱")
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
