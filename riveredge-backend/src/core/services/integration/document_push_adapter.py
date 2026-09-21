"""单据外推 Adapter 协议与注册表（与具体 ERP/OA 产品解耦）。"""

from __future__ import annotations

from typing import Any, Dict, Optional, Protocol, Tuple, runtime_checkable

from core.models.integration_config import IntegrationConfig
from infra.exceptions.exceptions import ValidationError


@runtime_checkable
class DocumentPushAdapter(Protocol):
    """连接器协议适配：组信封、调用、解析结果；不感知业务单据。"""

    connector_type: str
    # 直连 API 路径；无 Submit/Audit 的 Adapter 可留空字符串
    save_path: str
    submit_path: str
    audit_path: str

    def wrap_save(
        self, *, form_id: str, model: Dict[str, Any], cfg: Optional[Dict[str, Any]] = None
    ) -> Dict[str, Any]:
        ...

    def wrap_operate(
        self,
        *,
        form_id: str,
        bill_id: int = 0,
        bill_no: str = "",
    ) -> Dict[str, Any]:
        ...

    async def call_direct(
        self,
        connection: IntegrationConfig,
        path: str,
        body: Dict[str, Any],
        *,
        timeout: float = 30.0,
    ) -> Dict[str, Any]:
        ...

    async def call_via_api_library(
        self,
        *,
        tenant_id: int,
        api_uuid: str,
        body: Dict[str, Any],
        timeout: float = 30.0,
    ) -> Dict[str, Any]:
        ...

    def parse_status(self, payload: Any) -> Tuple[bool, str]:
        ...

    def parse_bill_ref(self, payload: Any, fallback: str = "") -> Tuple[int, str]:
        ...

    def supports_submit_audit(self) -> bool:
        """是否支持 Save 后 Submit/Audit 生命周期（金蝶有，Webhook/飞书无）。"""
        ...


_ADAPTERS: Dict[str, DocumentPushAdapter] = {}


def register_push_adapter(adapter: DocumentPushAdapter, *aliases: str) -> None:
    kinds = [str(adapter.connector_type or "").strip()] + [str(a).strip() for a in aliases]
    for kind in kinds:
        if kind:
            _ADAPTERS[kind] = adapter


def get_push_adapter(connector_type: str) -> DocumentPushAdapter:
    kind = str(connector_type or "").strip() or "kingdee_galaxy"
    adapter = _ADAPTERS.get(kind)
    if adapter is None:
        raise ValidationError(f"暂不支持的连接器类型: {kind}")
    return adapter


def list_registered_adapter_types() -> list[str]:
    return sorted(_ADAPTERS.keys())


def ensure_default_adapters_registered() -> None:
    """惰性注册内置 Adapter，避免循环 import。"""
    if _ADAPTERS:
        return
    from core.services.integration.feishu_im_push_adapter import FeishuImPushAdapter
    from core.services.integration.http_webhook_push_adapter import HttpWebhookPushAdapter
    from core.services.integration.kingdee_galaxy_push_adapter import KingdeeGalaxyPushAdapter

    galaxy = KingdeeGalaxyPushAdapter()
    register_push_adapter(galaxy, "kingdee_galaxy")

    webhook = HttpWebhookPushAdapter()
    # Webhook 为 OA/CRM 通用 HTTP 通道；飞书走专用 Adapter，不在此注册
    register_push_adapter(
        webhook,
        "Webhook",
        "webhook",
        "weaver",
        "seeyon",
        "landray",
        "cloudhub",
        "tongda_oa",
        "salesforce",
        "xiaoshouyi",
        "fenxiang",
        "qidian",
        "supra_crm",
    )

    register_push_adapter(FeishuImPushAdapter(), "feishu")
