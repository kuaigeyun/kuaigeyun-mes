"""业务适配：生产工单 → 飞书 IM 通知（P3 私有协议样板）。

profile: feishu_im_notify
连接器：feishu（app_id / app_secret；receive_id 可在连接器或本配置）
"""

from __future__ import annotations

from typing import Any, Dict, Optional

from loguru import logger

from apps.kuaizhizao.models.document_relation import DocumentRelation
from apps.kuaizhizao.models.work_order import WorkOrder
from apps.kuaizhizao.services.oa_document_push_service import build_oa_document_model
from core.services.integration.document_push_pipeline import (
    DocumentPushPipeline,
    DocumentPushPrepared,
    DocumentPushRequest,
)
from infra.exceptions.exceptions import BusinessLogicError
from infra.services.business_config_service import BusinessConfigService

SOURCE_TYPE = "work_order"
TARGET_PROFILE = "feishu_im_notify"
TARGET_TYPE = "feishu_im_message"
DEFAULT_FORM_ID = "work_order_notify"
DEFAULT_CONNECTOR_TYPE = "feishu"


class FeishuWorkOrderPushService:
    """工单 → 飞书群/人 IM 通知。"""

    TARGET_PROFILE = TARGET_PROFILE

    async def get_push_config(self, tenant_id: int) -> Dict[str, Any]:
        biz_config = await BusinessConfigService().get_business_config(tenant_id)
        work_order = (biz_config.get("parameters", {}) or {}).get("work_order", {}) or {}
        raw = work_order.get("feishu_document_push") or {}
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
                "message": "已推送过飞书通知",
                "source_type": SOURCE_TYPE,
                "source_id": work_order_id,
                "target_profile": TARGET_PROFILE,
            }

        try:
            form_id = str(config.get("form_id") or DEFAULT_FORM_ID).strip() or DEFAULT_FORM_ID
            connector_type = (
                str(config.get("connector_type") or DEFAULT_CONNECTOR_TYPE).strip()
                or DEFAULT_CONNECTOR_TYPE
            )
            # 复用 OA 的轻量 field_map 组装，飞书 Adapter 再渲染成 IM 文本/卡片
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
                target_name=str(config.get("target_name") or "飞书通知"),
                relation_desc="生产工单推送飞书 IM",
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
                    target_name=str(result.get("target_name") or "飞书通知"),
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
        except Exception as exc:
            logger.warning(
                "工单推送飞书失败 tenant_id={} work_order_id={} err={}",
                tenant_id,
                work_order_id,
                exc,
            )
            if bool(config.get("fail_on_error", False)):
                raise BusinessLogicError(f"推送飞书失败：{exc}") from exc
            return {"success": False, "message": str(exc)}
