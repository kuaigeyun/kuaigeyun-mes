"""飞书 IM 推送适配器：私有协议首个样板（tenant_access_token + 发消息）。

连接器 type=feishu，config 含 app_id / app_secret；
接收方 receive_id / receive_id_type 可写在连接器或推送业务配置。
"""

from __future__ import annotations

import json
from typing import Any, Dict, Optional, Tuple

from core.models.integration_config import IntegrationConfig
from infra.exceptions.exceptions import BusinessLogicError, ValidationError
from infra.infrastructure.http import get_http_client

__all__ = ["FeishuImPushAdapter"]

FEISHU_TOKEN_URL = "https://open.feishu.cn/open-apis/auth/v3/tenant_access_token/internal"
FEISHU_MESSAGE_URL = "https://open.feishu.cn/open-apis/im/v1/messages"


class FeishuImPushAdapter:
    """飞书开放平台：将单据 Model 推成 IM 文本/卡片消息。"""

    connector_type = "feishu"

    def supports_submit_audit(self) -> bool:
        return False

    def wrap_save(
        self, *, form_id: str, model: Dict[str, Any], cfg: Optional[Dict[str, Any]] = None
    ) -> Dict[str, Any]:
        config = cfg or {}
        msg_type = str(config.get("msg_type") or "text").strip() or "text"

        if msg_type == "interactive":
            elements = [
                {
                    "tag": "div",
                    "text": {
                        "tag": "lark_md",
                        "content": (
                            f"**{form_id}**\n```\n"
                            f"{json.dumps(model, ensure_ascii=False, indent=2)[:3500]}\n```"
                        ),
                    },
                }
            ]
            content: Any = {
                "config": {"wide_screen_mode": True},
                "header": {
                    "title": {
                        "tag": "plain_text",
                        "content": str(config.get("card_title") or form_id),
                    },
                },
                "elements": elements,
            }
            out: Dict[str, Any] = {
                "msg_type": "interactive",
                "content": content,
                "form_id": form_id,
                "model": model,
            }
        else:
            lines = [f"[{form_id}] 单据外推"]
            for key in ("code", "name", "product_code", "product_name", "quantity", "status"):
                if key in model and model.get(key) not in (None, ""):
                    lines.append(f"{key}: {model.get(key)}")
            if len(lines) == 1:
                lines.append(json.dumps(model, ensure_ascii=False)[:2000])
            out = {
                "msg_type": "text",
                "content": {"text": "\n".join(lines)},
                "form_id": form_id,
                "model": model,
            }

        receive_id = str(config.get("receive_id") or config.get("chat_id") or "").strip()
        receive_id_type = str(config.get("receive_id_type") or "chat_id").strip() or "chat_id"
        out["_feishu"] = {
            "receive_id": receive_id,
            "receive_id_type": receive_id_type,
        }
        return out

    def wrap_operate(
        self,
        *,
        form_id: str,
        bill_id: int = 0,
        bill_no: str = "",
    ) -> Dict[str, Any]:
        return {"form_id": form_id, "bill_id": bill_id, "bill_no": bill_no, "action": "operate"}

    async def _get_tenant_token(self, cfg: Dict[str, Any]) -> str:
        app_id = str(cfg.get("app_id") or "").strip()
        app_secret = str(cfg.get("app_secret") or "").strip()
        if not app_id or not app_secret:
            raise ValidationError("飞书连接器缺少 app_id / app_secret")
        resp = await get_http_client().post(
            FEISHU_TOKEN_URL,
            json={"app_id": app_id, "app_secret": app_secret},
            timeout=float(cfg.get("timeout") or 15.0),
        )
        data = resp.json() if hasattr(resp, "json") else {}
        if not isinstance(data, dict) or int(data.get("code") or -1) != 0:
            raise BusinessLogicError(
                str((data or {}).get("msg") or f"飞书取 token 失败 HTTP {getattr(resp, 'status_code', '?')}")
            )[:500]
        token = str(data.get("tenant_access_token") or "").strip()
        if not token:
            raise BusinessLogicError("飞书返回缺少 tenant_access_token")
        return token

    async def call_direct(
        self,
        connection: IntegrationConfig,
        path: str,
        body: Dict[str, Any],
        *,
        timeout: float = 30.0,
    ) -> Dict[str, Any]:
        _ = path
        cfg = connection.get_config() if hasattr(connection, "get_config") else {}
        if not isinstance(cfg, dict):
            cfg = {}
        # 业务配置可覆盖接收方（push config 经 Pipeline 传入 body 旁路：放在 connection 解析后合并）
        # call_direct 只有 connection；receive_id 优先 connection.config，其次 body 内嵌 _push meta
        meta = body.get("_feishu") if isinstance(body.get("_feishu"), dict) else {}
        receive_id = str(
            meta.get("receive_id") or cfg.get("receive_id") or cfg.get("chat_id") or ""
        ).strip()
        receive_id_type = str(
            meta.get("receive_id_type")
            or cfg.get("receive_id_type")
            or "chat_id"
        ).strip() or "chat_id"
        if not receive_id:
            raise ValidationError("飞书推送缺少 receive_id（连接器或业务配置）")

        token = await self._get_tenant_token(cfg)
        msg_type = str(body.get("msg_type") or "text").strip() or "text"
        content = body.get("content")
        if isinstance(content, dict):
            content_str = json.dumps(content, ensure_ascii=False)
        else:
            content_str = str(content or "")

        url = f"{FEISHU_MESSAGE_URL}?receive_id_type={receive_id_type}"
        resp = await get_http_client().post(
            url,
            headers={"Authorization": f"Bearer {token}"},
            json={
                "receive_id": receive_id,
                "msg_type": msg_type,
                "content": content_str,
            },
            timeout=float(cfg.get("timeout") or timeout),
        )
        try:
            payload = resp.json()
        except Exception:
            payload = {"raw": (getattr(resp, "text", None) or "")[:500]}
        if not isinstance(payload, dict):
            payload = {"data": payload}
        payload["_http_status"] = int(getattr(resp, "status_code", 0) or 0)
        return payload

    async def call_via_api_library(
        self,
        *,
        tenant_id: int,
        api_uuid: str,
        body: Dict[str, Any],
        timeout: float = 30.0,
    ) -> Dict[str, Any]:
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
        if not isinstance(payload, dict):
            raise BusinessLogicError("接口库返回非 JSON 对象")
        return payload

    def parse_status(self, payload: Any) -> Tuple[bool, str]:
        if not isinstance(payload, dict):
            return False, "飞书返回非 JSON 对象"
        code = payload.get("code")
        if code is None:
            http_status = payload.get("_http_status")
            if http_status is not None and int(http_status) >= 400:
                return False, f"HTTP {http_status}"
            return True, str(payload.get("msg") or "成功")[:500]
        if int(code) == 0:
            return True, str(payload.get("msg") or "成功")[:500]
        return False, str(payload.get("msg") or f"飞书错误 code={code}")[:500]

    def parse_bill_ref(self, payload: Any, fallback: str = "") -> Tuple[int, str]:
        if not isinstance(payload, dict):
            return 0, str(fallback or "")
        data = payload.get("data") if isinstance(payload.get("data"), dict) else {}
        message_id = str(data.get("message_id") or payload.get("message_id") or "").strip()
        return 0, message_id or str(fallback or "")
