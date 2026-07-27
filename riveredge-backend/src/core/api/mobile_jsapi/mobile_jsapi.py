"""移动端 H5 JSAPI 签名 API。"""

from __future__ import annotations

from typing import Annotated, Literal, Optional

from fastapi import APIRouter, Depends, HTTPException, Query, status
from pydantic import BaseModel, Field

from core.api.deps.deps import get_current_tenant
from core.services.integration.mobile_jsapi_service import build_mobile_jsapi_signature
from infra.api.deps.deps import get_current_user
from infra.models.user import User

router = APIRouter(prefix="/mobile-jsapi", tags=["Core - Mobile JSAPI"])

JsapiProvider = Literal["wecom", "dingtalk", "feishu"]


class MobileJsapiSignatureOut(BaseModel):
    provider: JsapiProvider
    corp_id: Optional[str] = None
    agent_id: Optional[int] = None
    app_id: Optional[str] = None
    timestamp: int
    nonce_str: str
    signature: str
    agent_signature: Optional[str] = Field(
        None, description="企微 agentConfig 签名（可选）"
    )


@router.get(
    "/signature",
    response_model=MobileJsapiSignatureOut,
    summary="移动端 H5 容器 JSAPI 签名（扫码等）",
)
async def get_mobile_jsapi_signature(
    provider: Annotated[JsapiProvider, Query(description="wecom / dingtalk / feishu")],
    url: Annotated[str, Query(description="当前页面完整 url，不含 #")],
    tenant_id: Annotated[int, Depends(get_current_tenant)],
    _user: Annotated[User, Depends(get_current_user)],
) -> MobileJsapiSignatureOut:
    try:
        signed = await build_mobile_jsapi_signature(tenant_id, provider, url)
    except ValueError as e:
        raise HTTPException(
            status_code=status.HTTP_422_UNPROCESSABLE_ENTITY,
            detail=str(e),
        ) from e
    except Exception as e:
        raise HTTPException(
            status_code=status.HTTP_502_BAD_GATEWAY,
            detail=f"获取 JSAPI 签名失败: {e}",
        ) from e
    return MobileJsapiSignatureOut(
        provider=signed.provider,
        corp_id=signed.corp_id,
        agent_id=signed.agent_id,
        app_id=signed.app_id,
        timestamp=signed.timestamp,
        nonce_str=signed.nonce_str,
        signature=signed.signature,
        agent_signature=signed.agent_signature,
    )
