"""通用单据推送编排：任意 source_type + target_profile，不绑定具体业务页。

任意页面：
1. 业务适配组装 Model（DocumentPushPrepared）
2. 调用 DocumentPushPipeline.push
即可落到外部系统。关联回写由调用方注入（避免 core→apps 依赖）。

P2：按 prepared.connector_type 解析 Adapter（金蝶 / Webhook·OA/CRM）。
"""

from __future__ import annotations

from dataclasses import dataclass, field
from typing import Any, Awaitable, Callable, Dict, Optional

from loguru import logger

from core.models.integration_config import IntegrationConfig
from core.services.integration.document_push_adapter import (
    DocumentPushAdapter,
    ensure_default_adapters_registered,
    get_push_adapter,
)
from infra.exceptions.exceptions import BusinessLogicError, ValidationError

PersistRelationFn = Callable[[Dict[str, Any]], Awaitable[None]]


@dataclass
class DocumentPushRequest:
    """通用推送请求（页面入口只传身份 + 可选连接覆盖）。"""

    source_type: str
    source_id: int
    target_profile: str
    source_code: Optional[str] = None
    source_name: Optional[str] = None
    connection_code: Optional[str] = None
    save_api_uuid: Optional[str] = None
    dry_run: bool = False


@dataclass
class DocumentPushPrepared:
    """业务适配层输出：已映射好的目标报文 + 元数据。"""

    form_id: str
    model: Dict[str, Any]
    target_type: str
    target_name: str = ""
    relation_desc: str = ""
    connector_type: str = "kingdee_galaxy"
    config: Dict[str, Any] = field(default_factory=dict)


class DocumentPushPipeline:
    """单据无关编排：选连接 → 调适配器 → 解析 →（可选）关联回写。"""

    def __init__(self) -> None:
        ensure_default_adapters_registered()

    async def push(
        self,
        *,
        tenant_id: int,
        acting_user_id: int,
        request: DocumentPushRequest,
        prepared: DocumentPushPrepared,
        persist_relation: Optional[PersistRelationFn] = None,
    ) -> Dict[str, Any]:
        source_type = str(request.source_type or "").strip()
        target_profile = str(request.target_profile or "").strip()
        if not source_type or int(request.source_id or 0) <= 0:
            raise ValidationError("推送缺少 source_type / source_id")
        if not target_profile:
            raise ValidationError("推送缺少 target_profile")

        config = dict(prepared.config or {})
        if request.connection_code:
            config["connection_code"] = str(request.connection_code).strip()
        if request.save_api_uuid:
            config["save_api_uuid"] = str(request.save_api_uuid).strip()

        form_id = str(prepared.form_id or "").strip()
        if not form_id:
            raise ValidationError("推送缺少 form_id")
        model = prepared.model
        if not isinstance(model, dict) or not model:
            raise ValidationError("推送 Model 为空")

        adapter = self._resolve_adapter(prepared.connector_type)
        body = adapter.wrap_save(form_id=form_id, model=model, cfg=config)

        logger.info(
            "document_push prepare tenant_id={} source={}/{} profile={} connector={} dry_run={} form_id={}",
            tenant_id,
            source_type,
            request.source_id,
            target_profile,
            prepared.connector_type,
            bool(request.dry_run),
            form_id,
        )

        if request.dry_run:
            return {
                "success": True,
                "dry_run": True,
                "source_type": source_type,
                "source_id": int(request.source_id),
                "target_profile": target_profile,
                "target_type": prepared.target_type,
                "connector_type": prepared.connector_type,
                "form_id": form_id,
                "model": model,
                "body": body,
                "message": "dry_run",
            }

        from core.utils.timezone_utils import resolve_business_datetime

        started_at = resolve_business_datetime()
        try:
            result = await self._execute_push(
                tenant_id=tenant_id,
                acting_user_id=acting_user_id,
                request=request,
                prepared=prepared,
                adapter=adapter,
                config=config,
                form_id=form_id,
                body=body,
                source_type=source_type,
                target_profile=target_profile,
                persist_relation=persist_relation,
            )
        except Exception as exc:
            await self._record_push_run_log(
                tenant_id=tenant_id,
                source_type=source_type,
                source_id=int(request.source_id),
                target_profile=target_profile,
                connector_type=prepared.connector_type,
                started_at=started_at,
                success=False,
                error=str(exc),
            )
            raise

        await self._record_push_run_log(
            tenant_id=tenant_id,
            source_type=source_type,
            source_id=int(request.source_id),
            target_profile=target_profile,
            connector_type=prepared.connector_type,
            started_at=started_at,
            success=True,
            bill_no=str(result.get("bill_no") or ""),
        )
        return result

    async def _execute_push(
        self,
        *,
        tenant_id: int,
        acting_user_id: int,
        request: DocumentPushRequest,
        prepared: DocumentPushPrepared,
        adapter: DocumentPushAdapter,
        config: Dict[str, Any],
        form_id: str,
        body: Dict[str, Any],
        source_type: str,
        target_profile: str,
        persist_relation: Optional[PersistRelationFn],
    ) -> Dict[str, Any]:
        timeout = float(config.get("timeout") or 30.0)
        # 硬上限：防止配置误写导致外部调用挂死拖垮 worker
        timeout = max(1.0, min(timeout, 120.0))
        save_api_uuid = str(config.get("save_api_uuid") or "").strip()
        connection = await self._resolve_connection(
            tenant_id,
            connector_type=prepared.connector_type,
            config=config,
        )

        if save_api_uuid:
            response = await adapter.call_via_api_library(
                tenant_id=tenant_id,
                api_uuid=save_api_uuid,
                body=body,
                timeout=timeout,
            )
        else:
            save_path = ""
            if str(getattr(adapter, "connector_type", "") or "") == "kingdee_galaxy":
                from core.services.integration.kingdee_galaxy_push_adapter import SAVE_PATH

                save_path = SAVE_PATH
            response = await adapter.call_direct(
                connection,
                save_path,
                body,
                timeout=timeout,
            )

        ok, message = adapter.parse_status(response)
        if not ok:
            raise BusinessLogicError(message)

        fallback = str(request.source_code or request.source_id or "")
        target_id, bill_no = adapter.parse_bill_ref(response, fallback=fallback)

        if adapter.supports_submit_audit():
            # 金蝶 Save 路径常量仅 Galaxy 使用
            from core.services.integration.kingdee_galaxy_push_adapter import (
                AUDIT_PATH,
                SUBMIT_PATH,
            )

            if bool(config.get("submit_after_save", False)):
                await self._submit_or_audit(
                    adapter,
                    connection,
                    SUBMIT_PATH,
                    form_id,
                    bill_id=target_id,
                    bill_no=bill_no,
                    timeout=timeout,
                )
            if bool(config.get("audit_after_save", False)):
                await self._submit_or_audit(
                    adapter,
                    connection,
                    AUDIT_PATH,
                    form_id,
                    bill_id=target_id,
                    bill_no=bill_no,
                    timeout=timeout,
                )

        result = {
            "success": True,
            "source_type": source_type,
            "source_id": int(request.source_id),
            "source_code": request.source_code,
            "source_name": request.source_name,
            "target_profile": target_profile,
            "target_type": prepared.target_type,
            "target_name": prepared.target_name or prepared.target_type,
            "connector_type": prepared.connector_type,
            "relation_desc": prepared.relation_desc
            or f"{source_type} → {target_profile}",
            "bill_id": target_id,
            "bill_no": bill_no,
            "message": message,
            "acting_user_id": acting_user_id,
        }
        if persist_relation is not None:
            await persist_relation(result)

        logger.info(
            "document_push ok tenant_id={} source={}/{} profile={} bill_no={}",
            tenant_id,
            source_type,
            request.source_id,
            target_profile,
            bill_no,
        )
        return result

    async def _record_push_run_log(
        self,
        *,
        tenant_id: int,
        source_type: str,
        source_id: int,
        target_profile: str,
        connector_type: str,
        started_at: Any,
        success: bool,
        error: Optional[str] = None,
        bill_no: str = "",
    ) -> None:
        """正式推送写 core_sync_run_logs（entity_type=document_push）；失败不影响主流程。"""
        from core.models.sync_run_log import SyncRunLog
        from core.utils.timezone_utils import resolve_business_datetime

        now = resolve_business_datetime()
        duration_ms = 0
        if started_at is not None:
            try:
                duration_ms = int((now - started_at).total_seconds() * 1000)
            except Exception:
                duration_ms = 0
        summary = (
            f"{source_type}/{source_id} → {target_profile} ({connector_type})"
            + (f" bill_no={bill_no}" if bill_no else "")
        )
        if error:
            summary = f"{summary}; {error}"[:2000]
        try:
            await SyncRunLog.create(
                tenant_id=tenant_id,
                binding_id=None,
                entity_type="document_push",
                mode="push",
                status="success" if success else "failed",
                created=1 if success else 0,
                updated=0,
                skipped=0,
                failed=0 if success else 1,
                fetched=0,
                truncated=False,
                duration_ms=duration_ms,
                error_summary=summary if (error or bill_no) else summary,
                started_at=started_at,
                finished_at=now,
            )
        except Exception:
            logger.warning(
                "document_push sync_run_log failed tenant_id={} source={}/{} profile={}",
                tenant_id,
                source_type,
                source_id,
                target_profile,
                exc_info=True,
            )

    def _resolve_adapter(self, connector_type: str) -> DocumentPushAdapter:
        ensure_default_adapters_registered()
        return get_push_adapter(connector_type)

    async def _resolve_connection(
        self,
        tenant_id: int,
        *,
        connector_type: str,
        config: Dict[str, Any],
    ) -> IntegrationConfig:
        code = str(config.get("connection_code") or config.get("integration_code") or "").strip()
        kind = str(connector_type or "kingdee_galaxy").strip() or "kingdee_galaxy"
        query = IntegrationConfig.filter(
            tenant_id=tenant_id,
            type=kind,
            is_active=True,
            deleted_at__isnull=True,
        )
        connection = await query.filter(code=code).first() if code else await query.first()
        if not connection:
            raise ValidationError(f"未找到已启用的应用连接器（type={kind}）")
        return connection

    async def _submit_or_audit(
        self,
        adapter: DocumentPushAdapter,
        connection: IntegrationConfig,
        path: str,
        form_id: str,
        *,
        bill_id: int,
        bill_no: str,
        timeout: float,
    ) -> None:
        body = adapter.wrap_operate(form_id=form_id, bill_id=bill_id, bill_no=bill_no)
        response = await adapter.call_direct(connection, path, body, timeout=timeout)
        ok, message = adapter.parse_status(response)
        if not ok:
            raise BusinessLogicError(message)
