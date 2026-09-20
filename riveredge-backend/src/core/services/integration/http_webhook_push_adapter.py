"""通用 HTTP Webhook 推送适配器：OA/CRM 首个通道。

对接方式：应用连接器 type=Webhook（或 weaver/seeyon 等，config 含 url）。
业务适配组装 JSON Model → 本 Adapter POST 到连接器 URL。
不实现各家 OA 私有协议；专用协议可再挂独立 Adapter。
"""

from __future__ import annotations

from typing import Any, Dict, Optional, Tuple

from core.models.integration_config import IntegrationConfig
from infra.exceptions.exceptions import BusinessLogicError, ValidationError
from infra.infrastructure.http import get_http_client

__all__ = ["HttpWebhookPushAdapter"]


class HttpWebhookPushAdapter:
    """IntegrationConfig.url(+headers/method) → HTTP JSON 推送。"""

    connector_type = "Webhook"

    def supports_submit_audit(self) -> bool:
        return False

    def wrap_save(
        self, *, form_id: str, model: Dict[str, Any], cfg: Optional[Dict[str, Any]] = None
    ) -> Dict[str, Any]:
        config = cfg or {}
        envelope = config.get("body_envelope")
        if isinstance(envelope, dict) and envelope:
            # 信封：用 model 替换占位 key，或整体作为 payload 字段
            body = dict(envelope)
            payload_key = str(config.get("payload_key") or "payload").strip() or "payload"
            body[payload_key] = model
            if form_id and "form_id" not in body:
                body["form_id"] = form_id
            return body
        # 默认：Model 即 body；附带 form_id 便于对端路由
        out = dict(model)
        if form_id and "form_id" not in out:
            out = {"form_id": form_id, **out}
        return out

    def wrap_operate(
        self,
        *,
        form_id: str,
        bill_id: int = 0,
        bill_no: str = "",
    ) -> Dict[str, Any]:
        return {
            "form_id": form_id,
            "bill_id": bill_id,
            "bill_no": bill_no,
            "action": "operate",
        }

    async def call_direct(
        self,
        connection: IntegrationConfig,
        path: str,
        body: Dict[str, Any],
        *,
        timeout: float = 30.0,
    ) -> Dict[str, Any]:
        _ = path  # Webhook 以连接器 url 为准；path 预留扩展
        cfg = connection.get_config() if hasattr(connection, "get_config") else {}
        if not isinstance(cfg, dict):
            cfg = {}
        url = str(cfg.get("url") or cfg.get("base_url") or "").strip()
        if not url:
            raise ValidationError("Webhook 连接器未配置 url")
        method = str(cfg.get("method") or "POST").strip().upper() or "POST"
        headers = cfg.get("headers") if isinstance(cfg.get("headers"), dict) else {}
        resp = await get_http_client().request(
            method,
            url,
            headers=headers,
            json=body,
            timeout=float(cfg.get("timeout") or timeout),
        )
        status_code = int(getattr(resp, "status_code", 0) or 0)
        try:
            payload = resp.json()
        except Exception:
            payload = {"raw": (getattr(resp, "text", None) or "")[:500]}
        if not isinstance(payload, dict):
            payload = {"data": payload}
        payload.setdefault("_http_status", status_code)
        if status_code >= 400:
            raise BusinessLogicError(
                f"Webhook 返回 HTTP {status_code}: {str(payload)[:300]}"
            )
        return payload

    async def call_via_api_library(
        self,
        *,
        tenant_id: int,
        api_uuid: str,
        body: Dict[str, Any],
        timeout: float = 30.0,
    ) -> Dict[str, Any]:
        """经接口管理调用（与金蝶相同入口，便于 OA 也挂 Save 接口）。"""
        from uuid import UUID

        from core.schemas.api import APITestRequest
        from core.services.application.api_service import APIService

        result = await APIService().test_api(
            tenant_id,
            UUID(str(api_uuid)),
            APITestRequest(body=body),
            timeout=timeout,
        )
        status_code = int(result.get("status_code") or 0)
        payload = result.get("body")
        if status_code >= 400:
            raise BusinessLogicError(f"接口库调用返回 HTTP {status_code}")
        if status_code == 0 and isinstance(payload, dict) and payload.get("error"):
            raise BusinessLogicError(str(payload.get("error"))[:500])
        if not isinstance(payload, dict):
            raise BusinessLogicError("接口库返回非 JSON 对象")
        return payload

    def parse_status(self, payload: Any) -> Tuple[bool, str]:
        if not isinstance(payload, dict):
            return False, "Webhook 返回非 JSON 对象"
        http_status = payload.get("_http_status")
        if http_status is not None and int(http_status) >= 400:
            return False, f"HTTP {http_status}"
        # 常见对端约定
        if payload.get("success") is False or payload.get("ok") is False:
            return False, str(payload.get("message") or payload.get("error") or "失败")[:500]
        if payload.get("Success") is False:
            return False, str(payload.get("Message") or "失败")[:500]
        return True, str(payload.get("message") or payload.get("Message") or "成功")[:500]

    def parse_bill_ref(self, payload: Any, fallback: str = "") -> Tuple[int, str]:
        if not isinstance(payload, dict):
            return 0, str(fallback or "")
        data = payload.get("data") if isinstance(payload.get("data"), dict) else {}
        raw_id = (
            payload.get("id")
            or payload.get("Id")
            or payload.get("bill_id")
            or data.get("id")
        )
        try:
            target_id = int(raw_id) if raw_id is not None else 0
        except (TypeError, ValueError):
            target_id = 0
        number = str(
            payload.get("code")
            or payload.get("bill_no")
            or payload.get("Number")
            or data.get("code")
            or fallback
            or ""
        ).strip()
        return target_id, number
