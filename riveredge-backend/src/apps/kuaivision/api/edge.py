"""边缘运行时 API（device_token，无需用户登录）。"""

from fastapi import APIRouter

from apps.kuaivision.schemas.vision import (
    EdgeAgentConfigResponse,
    EdgeHeartbeatPayload,
    EdgeHeartbeatResponse,
)
from apps.kuaivision.services.edge_runtime_service import EdgeRuntimeService

router = APIRouter(prefix="/edge", tags=["App - KuaiVision - Edge"])


@router.get("/{device_token}/config", response_model=EdgeAgentConfigResponse)
async def pull_config(device_token: str):
    return await EdgeRuntimeService.pull_config(device_token)


@router.post("/{device_token}/heartbeat", response_model=EdgeHeartbeatResponse)
async def heartbeat(device_token: str, payload: EdgeHeartbeatPayload):
    return await EdgeRuntimeService.heartbeat(device_token, payload)
