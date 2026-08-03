"""RiverEdge AI FastAPI 依赖链。"""

from __future__ import annotations

from dataclasses import dataclass
from typing import Callable

from fastapi import Depends, HTTPException, status

from core.ai.runtime_config import AiRuntimeConfig
from core.api.deps.access import AuthContext, get_auth_context, require_permission_codes
from core.api.deps.deps import get_current_tenant
from infra.api.deps.deps import get_current_user as soil_get_current_user
from infra.models.user import User

AI_CAPABILITY_PERMISSIONS: dict[str, str] = {
    "entry": "kuaiai:entry:read",
    "chat": "kuaiai:entry:read",
    "draft": "kuaiai:entry:read",
    "act": "kuaiai:act:execute",
    "agent": "kuaiai:entry:read",
    "jobs": "kuaiai:entry:read",
}


@dataclass(frozen=True)
class AiAuth:
    tenant_id: int
    user: User
    auth: AuthContext


async def get_ai_runtime(tenant_id: int = Depends(get_current_tenant)) -> AiRuntimeConfig:
    return await AiRuntimeConfig.load(tenant_id)


async def get_ai_auth(
    auth: AuthContext = Depends(get_auth_context),
    user: User = Depends(soil_get_current_user),
    tenant_id: int = Depends(get_current_tenant),
) -> AiAuth:
    return AiAuth(tenant_id=tenant_id, user=user, auth=auth)


def require_ai_capability(capability: str) -> Callable:
    permission = AI_CAPABILITY_PERMISSIONS.get(capability)
    if not permission:
        raise ValueError(f"未知 AI capability: {capability}")

    async def _guard(
        _: AiAuth = Depends(get_ai_auth),
        __=Depends(require_permission_codes(permission)),
    ) -> None:
        return None

    return _guard
