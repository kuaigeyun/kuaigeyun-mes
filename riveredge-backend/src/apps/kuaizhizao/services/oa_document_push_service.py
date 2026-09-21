"""业务适配：生产工单 → OA/CRM HTTP Webhook（P2 首个非金蝶样板）。

profile: oa_http_webhook
连接器：Webhook（或 weaver/seeyon 等，config 含 url）
映射：代码内 DEFAULT_FIELD_MAP（不再从业务配置读 field_map；编码转换在接口管理）。
"""

from __future__ import annotations

from typing import Any, Dict, Optional

from loguru import logger

from apps.kuaizhizao.models.document_relation import DocumentRelation
from apps.kuaizhizao.models.work_order import WorkOrder
from core.services.integration.document_push_mapping import apply_field_map, set_path
from core.services.integration.document_push_pipeline import (
    DocumentPushPipeline,
    DocumentPushPrepared,
    DocumentPushRequest,
)
from infra.exceptions.exceptions import BusinessLogicError
from infra.services.business_config_service import BusinessConfigService

SOURCE_TYPE = "work_order"
TARGET_PROFILE = "oa_http_webhook"
TARGET_TYPE = "oa_document"
DEFAULT_FORM_ID = "work_order"
DEFAULT_CONNECTOR_TYPE = "Webhook"

DEFAULT_FIELD_MAP = {
    "code": "code",
    "name": "name",
    "product_code": "product_code",
    "product_name": "product_name",
    "quantity": "quantity",
    "status": "status",
    "planned_start_date": "planned_start_date",
    "planned_end_date": "planned_end_date",
    "workshop_name": "workshop_name",
}


def _resolve_local_value(key: str, *, work_order: WorkOrder, cfg: Dict[str, Any]) -> Any:
    if key in cfg and cfg.get(key) not in (None, ""):
        return cfg.get(key)
    if key == "source_system":
        return cfg.get("source_system") or "kuaigeyun"
    if key == "source_type":
        return SOURCE_TYPE
    if key == "source_id":
        return int(work_order.id)
    return getattr(work_order, key, None)


def build_oa_document_model(
    *,
    work_order: WorkOrder,
    cfg: Optional[Dict[str, Any]] = None,
) -> Dict[str, Any]:
    """按 field_map 组装 OA Webhook JSON（轻量 MappingProfile）。"""
    config = cfg or {}
    template = config.get("model_template")
    if isinstance(template, dict) and template:
        model: Dict[str, Any] = dict(template)
    else:
        model = {
            "source_system": config.get("source_system") or "kuaigeyun",
            "source_type": SOURCE_TYPE,
            "source_id": int(work_order.id),
        }

    field_map = dict(DEFAULT_FIELD_MAP)

    apply_field_map(
        model,
        field_map,
        lambda local_key: _resolve_local_value(local_key, work_order=work_order, cfg=config),
    )

    fixed_values = config.get("fixed_values")
    if isinstance(fixed_values, dict):
        for target_path, value in fixed_values.items():
            set_path(model, str(target_path), value)

    return model


class OaDocumentPushService:
    """工单 → OA/CRM Webhook 业务适配。"""

    TARGET_PROFILE = TARGET_PROFILE

    async def get_push_config(self, tenant_id: int) -> Dict[str, Any]:
        biz_config = await BusinessConfigService().get_business_config(tenant_id)
        work_order = (biz_config.get("parameters", {}) or {}).get("work_order", {}) or {}
        raw = work_order.get("oa_document_push") or {}
        return dict(raw) if isinstance(raw, dict) else {}

    async def push_work_order(
        self,
        *,
        tenant_id: int,
        work_order_id: int,
        acting_user_id: int,
        connection_code: Optional[str] = None,
        save_api_uuid: Optional[str] = None,
        dry_run: bool = False,
    ) -> Optional[Dict[str, Any]]:
        config = await self.get_push_config(tenant_id)
        code = str(connection_code or "").strip()
        api_uuid = str(save_api_uuid or "").strip()
        if code or api_uuid:
            config = {
                **config,
                **({"connection_code": code} if code else {}),
                **({"save_api_uuid": api_uuid} if api_uuid else {}),
                "enabled": True,
            }
        if not bool(config.get("enabled", False)):
            return None

        work_order = await WorkOrder.get_or_none(
            tenant_id=tenant_id,
            id=work_order_id,
            deleted_at__isnull=True,
        )
        if not work_order:
            return None

        if not dry_run and await DocumentRelation.filter(
            tenant_id=tenant_id,
            source_type=SOURCE_TYPE,
            source_id=work_order_id,
            target_type=TARGET_TYPE,
        ).exists():
            return {
                "success": True,
                "skipped": True,
                "message": "已推送过 OA 单据",
                "source_type": SOURCE_TYPE,
                "source_id": work_order_id,
                "target_profile": TARGET_PROFILE,
            }

        try:
            return await self._push_now(
                tenant_id=tenant_id,
                work_order=work_order,
                acting_user_id=acting_user_id,
                config=config,
                dry_run=dry_run,
            )
        except Exception as exc:
            logger.warning(
                "工单推送 OA 失败 tenant_id={} work_order_id={} err={}",
                tenant_id,
                work_order_id,
                exc,
            )
            if bool(config.get("fail_on_error", False)):
                raise BusinessLogicError(f"推送 OA 失败：{exc}") from exc
            return {"success": False, "message": str(exc)}

    async def _push_now(
        self,
        *,
        tenant_id: int,
        work_order: WorkOrder,
        acting_user_id: int,
        config: Dict[str, Any],
        dry_run: bool = False,
    ) -> Dict[str, Any]:
        form_id = str(config.get("form_id") or DEFAULT_FORM_ID).strip() or DEFAULT_FORM_ID
        connector_type = (
            str(config.get("connector_type") or DEFAULT_CONNECTOR_TYPE).strip()
            or DEFAULT_CONNECTOR_TYPE
        )
        model = build_oa_document_model(work_order=work_order, cfg=config)

        request = DocumentPushRequest(
            source_type=SOURCE_TYPE,
            source_id=int(work_order.id),
            target_profile=TARGET_PROFILE,
            source_code=work_order.code,
            source_name=work_order.name or work_order.code,
            connection_code=str(config.get("connection_code") or "").strip() or None,
            save_api_uuid=str(config.get("save_api_uuid") or "").strip() or None,
            dry_run=dry_run,
        )
        prepared = DocumentPushPrepared(
            form_id=form_id,
            model=model,
            target_type=TARGET_TYPE,
            target_name=str(config.get("target_name") or "OA单据"),
            relation_desc="生产工单推送 OA/CRM Webhook",
            connector_type=connector_type,
            config=config,
        )

        async def _persist(result: Dict[str, Any]) -> None:
            await DocumentRelation.create(
                tenant_id=tenant_id,
                source_type=str(result.get("source_type") or SOURCE_TYPE),
                source_id=int(result.get("source_id") or work_order.id),
                source_code=result.get("source_code") or work_order.code,
                source_name=result.get("source_name") or work_order.name or work_order.code,
                target_type=str(result.get("target_type") or TARGET_TYPE),
                target_id=int(result.get("bill_id") or 0),
                target_code=(result.get("bill_no") or None),
                target_name=str(result.get("target_name") or "OA单据"),
                relation_type="source",
                relation_mode="push",
                relation_desc=str(result.get("relation_desc") or ""),
                notes=f"profile={TARGET_PROFILE}",
                created_by=acting_user_id,
            )

        return await DocumentPushPipeline().push(
            tenant_id=tenant_id,
            acting_user_id=acting_user_id,
            request=request,
            prepared=prepared,
            persist_relation=None if dry_run else _persist,
        )
