"""金蝶云星空推送适配器：协议/会话/结果解析，不感知业务单据类型。"""

from __future__ import annotations

from typing import Any, Dict, Optional, Tuple

from core.models.integration_config import IntegrationConfig
from core.services.integration.connector_request import resolve_connector_request
from core.services.integration.kingdee_galaxy_api_presets import (
    AUDIT_PATH,
    SAVE_PATH,
    SUBMIT_PATH,
    build_operate_body,
    build_save_body,
)
from core.services.integration.kingdee_galaxy_service import (
    apply_kingdee_galaxy_session_headers,
    login_kingdee_galaxy_session,
)
from infra.exceptions.exceptions import BusinessLogicError
from infra.infrastructure.http import get_http_client

__all__ = [
    "SAVE_PATH",
    "SUBMIT_PATH",
    "AUDIT_PATH",
    "KingdeeGalaxyPushAdapter",
    "extract_response_status",
    "extract_saved_bill_ref",
]


def extract_response_status(payload: Any) -> Tuple[bool, str]:
    if not isinstance(payload, dict):
        return False, "金蝶返回非 JSON 对象"
    result = payload.get("Result") if isinstance(payload.get("Result"), dict) else payload
    status = result.get("ResponseStatus") if isinstance(result, dict) else None
    if not isinstance(status, dict):
        return False, str(payload.get("Message") or "金蝶返回缺少 ResponseStatus")[:500]
    if status.get("IsSuccess") is True:
        return True, str(result.get("Message") or payload.get("Message") or "成功")[:500]
    errors = status.get("Errors") or []
    if isinstance(errors, list) and errors:
        first = errors[0]
        if isinstance(first, dict):
            msg = str(first.get("Message") or first.get("FieldName") or "金蝶接口调用失败")
            return False, msg[:500]
    return False, str(result.get("Message") or payload.get("Message") or "金蝶接口调用失败")[:500]


def extract_saved_bill_ref(payload: Any, fallback: str = "") -> Tuple[int, str]:
    result = (
        payload.get("Result")
        if isinstance(payload, dict) and isinstance(payload.get("Result"), dict)
        else {}
    )
    status = (
        result.get("ResponseStatus")
        if isinstance(result, dict) and isinstance(result.get("ResponseStatus"), dict)
        else {}
    )
    success_entities = status.get("SuccessEntitys") or status.get("SuccessEntities") or []
    if isinstance(success_entities, list) and success_entities:
        entity = success_entities[0]
        if isinstance(entity, dict):
            raw_id = entity.get("Id") or entity.get("ID") or 0
            try:
                target_id = int(raw_id)
            except (TypeError, ValueError):
                target_id = 0
            number = str(entity.get("Number") or entity.get("BillNo") or fallback or "").strip()
            return target_id, number
    return 0, str(fallback or "")


class KingdeeGalaxyPushAdapter:
    """按 IntegrationConfig.type=kingdee_galaxy 调用 Save/Submit/Audit。"""

    connector_type = "kingdee_galaxy"
    save_path = SAVE_PATH
    submit_path = SUBMIT_PATH
    audit_path = AUDIT_PATH

    def supports_submit_audit(self) -> bool:
        return True

    def wrap_save(self, *, form_id: str, model: Dict[str, Any], cfg: Optional[Dict[str, Any]] = None) -> Dict[str, Any]:
        config = cfg or {}
        return build_save_body(
            form_id=form_id,
            model=model,
            need_update_fields=config.get("need_update_fields") or [],
            need_return_fields=config.get("need_return_fields") or ["FID", "FBillNo"],
            is_delete_entry=bool(config.get("is_delete_entry", True)),
            sub_system_id=str(config.get("sub_system_id") or ""),
            is_verify_base_data_field=bool(config.get("is_verify_base_data_field", False)),
            is_entry_batch_fill=bool(config.get("is_entry_batch_fill", True)),
            validate_flag=bool(config.get("validate_flag", True)),
            number_search=bool(config.get("number_search", True)),
            is_auto_adjust_field=bool(config.get("is_auto_adjust_field", False)),
            interation_flags=str(config.get("interation_flags") or ""),
            ignore_interation_flag=bool(config.get("ignore_interation_flag", True)),
            is_control_precision=bool(config.get("is_control_precision", False)),
            validate_repeat_json=bool(config.get("validate_repeat_json", False)),
        )

    def wrap_operate(
        self,
        *,
        form_id: str,
        bill_id: int = 0,
        bill_no: str = "",
    ) -> Dict[str, Any]:
        return build_operate_body(
            form_id=form_id,
            bill_id=str(bill_id) if int(bill_id or 0) > 0 else "",
            bill_no=str(bill_no or ""),
        )

    async def call_direct(
        self,
        connection: IntegrationConfig,
        path: str,
        body: Dict[str, Any],
        *,
        timeout: float = 30.0,
    ) -> Dict[str, Any]:
        url, headers = resolve_connector_request(
            connection, endpoint=path, headers={"Content-Type": "application/json"}
        )
        session = await login_kingdee_galaxy_session(connection.get_config())
        headers = apply_kingdee_galaxy_session_headers(
            headers, session_id=str(session["session_id"])
        )
        resp = await get_http_client().post(url, json=body, headers=headers, timeout=timeout)
        if resp.status_code >= 400:
            raise BusinessLogicError(f"金蝶接口返回 HTTP {resp.status_code}")
        try:
            payload = resp.json()
        except Exception:
            raise BusinessLogicError(f"金蝶接口返回非 JSON：{(resp.text or '')[:200]}")
        if not isinstance(payload, dict):
            raise BusinessLogicError("金蝶接口返回非 JSON 对象")
        return payload

    async def call_via_api_library(
        self,
        *,
        tenant_id: int,
        api_uuid: str,
        body: Dict[str, Any],
        timeout: float = 30.0,
    ) -> Dict[str, Any]:
        """经接口管理调用；body 含 parameters 时由 APIService 整包替换模板。"""
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
            raise BusinessLogicError(f"金蝶接口返回 HTTP {status_code}")
        if status_code == 0 and isinstance(payload, dict) and payload.get("error"):
            raise BusinessLogicError(str(payload.get("error"))[:500])
        if not isinstance(payload, dict):
            raise BusinessLogicError("金蝶接口返回非 JSON 对象")
        return payload

    def parse_status(self, payload: Any) -> Tuple[bool, str]:
        return extract_response_status(payload)

    def parse_bill_ref(self, payload: Any, fallback: str = "") -> Tuple[int, str]:
        return extract_saved_bill_ref(payload, fallback=fallback)
