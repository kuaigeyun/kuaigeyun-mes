"""
工位 LOGO 授权 KEY 公开激活接口（只记账）。

POST /api/v1/infra/station-logo-license/activate

不接收明文 KEY、不持有签发密钥；由闭源客户端本地验 KEY 后上报摘要。
"""

from __future__ import annotations

from typing import Optional

from fastapi import APIRouter
from pydantic import BaseModel, Field

from infra.services.station_logo_license_service import StationLogoLicenseService

router = APIRouter(prefix="/station-logo-license", tags=["Platform - Station Logo License (Public)"])


class ActivateRequest(BaseModel):
    key_digest: str = Field(description="KEY 账本摘要（sha256 hex，由闭源端计算）", min_length=64, max_length=64)
    device_id: str = Field(description="设备指纹（稳定、非空、≤64）", min_length=8, max_length=64)
    max_activations: int = Field(description="可用台数（仅首次入库生效）", ge=1, le=255)
    key_last4: Optional[str] = Field(default=None, description="KEY 末 4 位（可选，便于运维辨认）")


class ActivateResponse(BaseModel):
    ok: bool
    reason: Optional[str] = None
    message: Optional[str] = None
    max_activations: Optional[int] = None
    current_activations: Optional[int] = None


@router.post("/activate", response_model=ActivateResponse, summary="记账激活 LOGO 授权（按设备计数）")
async def activate_station_logo_license(body: ActivateRequest) -> ActivateResponse:
    result = await StationLogoLicenseService.activate(
        key_digest=body.key_digest,
        device_id=body.device_id,
        max_activations=body.max_activations,
        key_last4=body.key_last4 or "",
    )
    return ActivateResponse(**result)
