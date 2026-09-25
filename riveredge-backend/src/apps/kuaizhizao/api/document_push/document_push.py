"""通用外推 API（任意页面：source_type + source_id + target_profile[s]）。

注意：与 /document-push-pull（系统内下推）不同。
P2：支持 target_profiles 多目标 fan-out；target_profile=* 读业务配置。
"""

from __future__ import annotations

from typing import Any, Dict, List, Optional

from fastapi import APIRouter, Depends
from pydantic import BaseModel, Field

from apps.kuaizhizao.services.document_push_service import DocumentPushService
from core.api.deps import get_current_tenant, get_current_user
from infra.exceptions.exceptions import BusinessLogicError, ValidationError
from infra.models.user import User

router = APIRouter(
    prefix="/document-push",
    tags=["App - Kuaige Zhizao - Document Push (External)"],
)


class DocumentPushTargetBody(BaseModel):
    connection_code: Optional[str] = None
    save_api_uuid: Optional[str] = None
    target_profile: str


class DocumentPushBody(BaseModel):
    source_type: str = Field(..., description="源单据类型，如 work_order / reporting_record")
    source_id: int = Field(..., description="源单据 ID")
    targets: Optional[List[DocumentPushTargetBody]] = Field(
        None,
        description="多连接器目标（每条独立 connection + Save 接口 + profile）",
    )
    target_profile: Optional[str] = Field(
        None,
        description="单一目标，如 kingdee_prd_mo / oa_http_webhook；传 * 则按业务配置多目标",
    )
    target_profiles: Optional[List[str]] = Field(
        None,
        description="多目标列表（优先于 target_profile）；一单可同时推金蝶+OA",
    )
    connection_code: Optional[str] = Field(None, description="覆盖应用连接器 code")
    save_api_uuid: Optional[str] = Field(None, description="覆盖接口管理 Save UUID")
    dry_run: bool = Field(False, description="只组装报文不落库不调用")


class DocumentPushProfileOut(BaseModel):
    source_type: str
    target_profile: str


@router.get("/slo", summary="Document push SLO by category×connector×profile")
async def get_document_push_slo(
    current_user: User = Depends(get_current_user),
    tenant_id: int = Depends(get_current_tenant),
) -> Dict[str, Any]:
    """进程内 SLO 快照（category × connector_type × target_profile）。"""
    _ = current_user, tenant_id
    from core.services.integration.document_push_slo import document_push_slo

    return {"dimensions": ["category", "connector_type", "target_profile"], "rows": document_push_slo.snapshot()}


@router.get("/profiles", summary="List supported external push profiles")
async def list_document_push_profiles(
    current_user: User = Depends(get_current_user),
    tenant_id: int = Depends(get_current_tenant),
) -> List[DocumentPushProfileOut]:
    _ = current_user, tenant_id
    return [DocumentPushProfileOut(**item) for item in DocumentPushService().list_profiles()]


@router.post("", summary="Push document to external system")
async def push_document_external(
    body: DocumentPushBody,
    current_user: User = Depends(get_current_user),
    tenant_id: int = Depends(get_current_tenant),
) -> Dict[str, Any]:
    try:
        targets_payload = None
        if body.targets:
            targets_payload = [t.model_dump() for t in body.targets]
        return await DocumentPushService().push(
            tenant_id=tenant_id,
            acting_user_id=int(getattr(current_user, "id", 0) or 0),
            source_type=body.source_type,
            source_id=body.source_id,
            targets=targets_payload,
            target_profile=body.target_profile,
            target_profiles=body.target_profiles,
            connection_code=body.connection_code,
            save_api_uuid=body.save_api_uuid,
            dry_run=bool(body.dry_run),
        )
    except ValidationError as exc:
        raise BusinessLogicError(str(exc)) from exc
