"""开放 API 换票（类金蝶 LoginByAppSecret）。"""

from __future__ import annotations

from typing import Optional

from fastapi import APIRouter, Request
from pydantic import BaseModel, Field

from core.services.open_api.open_api_auth_service import OpenApiAuthService
from infra.utils.client_ip import get_client_ip

router = APIRouter(prefix="/open/auth", tags=["Open API - Auth"])


class OpenApiTokenRequest(BaseModel):
    acct_id: str = Field(..., description="账套 ID")
    app_id: str = Field(..., description="应用 ID")
    app_secret: str = Field(..., description="应用秘钥")


class OpenApiTokenResponse(BaseModel):
    access_token: str
    token_type: str = "bearer"
    expires_in: int
    acct_id: str
    app_id: str
    tenant_id: Optional[int] = None
    grants: list[str] = Field(default_factory=list)
    modules: list[str] = Field(default_factory=list)


@router.post("/token", response_model=OpenApiTokenResponse)
async def issue_open_api_token(body: OpenApiTokenRequest, request: Request):
    result = await OpenApiAuthService.issue_token(
        acct_id=body.acct_id,
        app_id=body.app_id,
        app_secret=body.app_secret,
        client_ip=get_client_ip(request),
    )
    return OpenApiTokenResponse(**result)
