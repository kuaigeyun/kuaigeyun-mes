from __future__ import annotations

import hashlib
import hmac
import time
from typing import Optional

from fastapi import APIRouter, Depends, HTTPException, status
from loguru import logger
from pydantic import BaseModel, Field

from core.api.deps.access import AuthContext, get_auth_context, require_permission_codes
from core.api.deps.deps import get_current_tenant
from core.services.logging.operation_log_service import OperationLogService
from infra.models.user import User
from infra.api.deps.deps import get_current_user
from apps.kuaizhizao.services.reset_data_service import ResetDataService

router = APIRouter(prefix="/management", tags=["App - Kuaige Zhizao - App Management"])

RESET_PERMISSION = "kuaizhizao:app-management:reset-data"
_TOKEN_TTL_SECONDS = 300


class ResetDataRequest(BaseModel):
    confirmation_token: str = Field(..., min_length=16, description="二次确认 token（先调用 prepare）")


class ResetDataPrepareResponse(BaseModel):
    confirmation_token: str
    expires_in: int = _TOKEN_TTL_SECONDS
    message: str = "请在有效期内携带 confirmation_token 再次确认重置"


def _assert_reset_gate(auth: AuthContext) -> None:
    """租户管理员或平台管理员方可执行破坏性重置（与权限码叠加）。"""
    if auth.is_tenant_admin or auth.is_infra_admin:
        return
    raise HTTPException(
        status_code=status.HTTP_403_FORBIDDEN,
        detail={
            "code": "FORBIDDEN",
            "message": "仅组织管理员或平台管理员可重置快制造业务数据",
            "details": {"reason": "require_tenant_admin"},
        },
    )


@router.post(
    "/reset-data/prepare",
    response_model=ResetDataPrepareResponse,
    summary="Prepare reset-data confirmation token",
    dependencies=[Depends(require_permission_codes(RESET_PERMISSION))],
)
async def prepare_reset_app_data(
    current_user: User = Depends(get_current_user),
    tenant_id: int = Depends(get_current_tenant),
    auth: AuthContext = Depends(get_auth_context),
):
    """签发短时二次确认 token；真正删除须再调 /reset-data。"""
    _assert_reset_gate(auth)
    token = ResetDataService.issue_confirmation_token(
        tenant_id=tenant_id,
        operator_id=current_user.id,
        ttl_seconds=_TOKEN_TTL_SECONDS,
    )
    return ResetDataPrepareResponse(confirmation_token=token, expires_in=_TOKEN_TTL_SECONDS)


@router.post(
    "/reset-data",
    summary="Reset app data (Kuaige Zhizao)",
    dependencies=[Depends(require_permission_codes(RESET_PERMISSION))],
)
async def reset_app_data(
    body: ResetDataRequest,
    current_user: User = Depends(get_current_user),
    tenant_id: int = Depends(get_current_tenant),
    auth: AuthContext = Depends(get_auth_context),
):
    """
    重置快制造模块的所有业务数据。

    安全机制：
    1. 必须登录且属于对应租户。
    2. 权限码 kuaizhizao:app-management:reset-data + 组织/平台管理员门禁。
    3. 二次确认 token（先调 /reset-data/prepare）。
    4. 自动触发一重全量备份。
    5. 物理删除所有业务表，并写入操作日志。
    """
    _assert_reset_gate(auth)
    try:
        ResetDataService.verify_confirmation_token(
            tenant_id=tenant_id,
            operator_id=current_user.id,
            token=body.confirmation_token,
            ttl_seconds=_TOKEN_TTL_SECONDS,
        )
        result = await ResetDataService.reset_kuaizhizao_data(tenant_id, current_user.id)
        try:
            await OperationLogService.create_operation_log(
                tenant_id=tenant_id,
                user_id=current_user.id,
                operation_type="reset_data",
                operation_module="kuaizhizao.app-management",
                operation_object_type="tenant_business_data",
                operation_object_id=tenant_id,
                operation_content=(
                    f"物理删除快制造业务数据: success={result.get('success')} "
                    f"message={result.get('message')}"
                ),
                request_method="POST",
                request_path="/management/reset-data",
            )
        except Exception as log_exc:
            logger.error(f"重置数据操作日志写入失败（删除已执行）: {log_exc}")
        return result
    except ValueError as e:
        raise HTTPException(status_code=status.HTTP_400_BAD_REQUEST, detail=str(e))
    except Exception as e:
        logger.exception(f"重置快制造数据失败: {e}")
        return {"success": False, "message": str(e)}
