from typing import Dict, Literal
from ninja import Router, Schema
from apps.kuaizhizao.services.traceability import TraceabilityService

router = Router(tags=["Traceability"])
service = TraceabilityService()

class TraceGraphResponse(Schema):
    nodes: list[dict]
    edges: list[dict]

@router.get("/graph", response=TraceGraphResponse, summary="获取追溯图谱")
async def get_trace_graph(
    request, 
    batch_no: str, 
    direction: Literal["forward", "backward", "both"] = "both"
):
    """
    获取指定批次号的正向或反向追溯图谱。
    
    - **batch_no**: 批次号/条码
    - **direction**: 追溯方向 (forward: 原料->成品, backward: 成品->原料, both: 双向)
    """
    return await service.get_trace_graph(batch_no, direction)
