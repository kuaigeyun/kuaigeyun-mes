"""业务配置「消息提醒」规则派发（parameters.notifications.rules）。"""

from __future__ import annotations

from typing import Any, Awaitable, Callable, Dict, List, Optional, Set

from loguru import logger
from uuid import UUID

from core.schemas.message_template import SendMessageRequest
from core.services.messaging.message_service import MessageService
from infra.services.business_config_service import BusinessConfigService

ScopeResolver = Callable[[int, Dict[str, Any]], Awaitable[List[int]]]

_SCOPE_RESOLVERS: Dict[str, ScopeResolver] = {}


def _normalize_context_user_ids(raw: Any) -> List[int]:
    if raw is None:
        return []
    if isinstance(raw, (int, str)):
        raw = [raw]
    if not isinstance(raw, list):
        return []
    out: List[int] = []
    seen: Set[int] = set()
    for item in raw:
        try:
            uid = int(item)
        except (TypeError, ValueError):
            continue
        if uid < 1 or uid in seen:
            continue
        seen.add(uid)
        out.append(uid)
    return out


async def _scope_user_specified(tenant_id: int, context: Dict[str, Any]) -> List[int]:
    """开单用户在单据上选择的通知接收人（与规则中勾选「开单用户指定」配合）。"""
    del tenant_id
    merged: List[int] = []
    seen: Set[int] = set()
    for key in (
        "form_notify_user_ids",
        "report_notify_user_ids",
        "pending_notify_user_ids",
        "submitted_notify_user_ids",
    ):
        for uid in _normalize_context_user_ids(context.get(key)):
            if uid not in seen:
                seen.add(uid)
                merged.append(uid)
    return merged


def _rule_has_user_specified(rule: dict) -> bool:
    scopes = rule.get("recipient_scopes") or []
    if isinstance(scopes, str):
        scopes = [scopes]
    return "user_specified" in [str(s or "").strip() for s in scopes]


def _rule_fixed_recipient_user_ids(rule: dict) -> List[int]:
    """固定人员：每次派发均通知，与开单表单无关。"""
    fixed = _normalize_context_user_ids(rule.get("recipient_user_ids"))
    if not _rule_has_user_specified(rule):
        return fixed
    dedicated = _normalize_context_user_ids(rule.get("form_notify_default_user_ids"))
    if dedicated:
        return fixed
    if rule.get("form_notify_default_user_ids") is not None:
        return fixed
    return []


def _rule_form_notify_default_user_ids(rule: dict) -> List[int]:
    """开单用户指定 - 默认人员（仅当表单未选人时使用）。"""
    dedicated = _normalize_context_user_ids(rule.get("form_notify_default_user_ids"))
    if dedicated:
        return dedicated
    if _rule_has_user_specified(rule):
        return _normalize_context_user_ids(rule.get("recipient_user_ids"))
    return []


def register_notification_scope_resolver(scope: str, resolver: ScopeResolver) -> None:
    key = (scope or "").strip()
    if not key:
        raise ValueError("scope 不能为空")
    _SCOPE_RESOLVERS[key] = resolver


def ensure_core_notification_scope_resolvers() -> None:
    register_notification_scope_resolver("user_specified", _scope_user_specified)


ensure_core_notification_scope_resolvers()


def _normalize_rules(raw: Any) -> List[dict]:
    if isinstance(raw, dict) and isinstance(raw.get("rules"), list):
        return [r for r in raw["rules"] if isinstance(r, dict)]
    if isinstance(raw, dict) and raw.get("trigger_document"):
        return [raw]
    return []


class BusinessNotificationService:
    @staticmethod
    async def dispatch(
        tenant_id: int,
        *,
        trigger_document: str,
        trigger_action: str,
        variables: Optional[Dict[str, Any]] = None,
        context: Optional[Dict[str, Any]] = None,
    ) -> int:
        """
        按业务配置规则发送站内信。返回成功发送条数（按接收人×规则计）。
        无匹配规则或未配置接收人时返回 0，不抛错。
        """
        doc = (trigger_document or "").strip()
        action = (trigger_action or "").strip()
        if not doc or not action:
            return 0

        cfg = await BusinessConfigService().get_business_config(tenant_id)
        rules = _normalize_rules((cfg.get("parameters") or {}).get("notifications"))
        ctx = dict(context or {})
        vars_payload = {k: str(v) for k, v in (variables or {}).items()}
        vars_payload["trigger_document"] = doc
        vars_payload["trigger_action"] = action

        sent = 0
        for rule in rules:
            if rule.get("enabled") is False:
                continue
            if str(rule.get("trigger_document") or "").strip() != doc:
                continue
            if str(rule.get("trigger_action") or "").strip() != action:
                continue

            template_ref = str(rule.get("template_uuid") or rule.get("template") or "").strip()
            if not template_ref:
                logger.warning(
                    "业务消息提醒规则缺少模板 tenant={} doc={} action={} rule_id={}",
                    tenant_id,
                    doc,
                    action,
                    rule.get("id"),
                )
                continue

            recipient_ids = await BusinessNotificationService._resolve_recipient_ids(
                tenant_id, rule, ctx
            )
            if not recipient_ids:
                continue

            for uid in recipient_ids:
                try:
                    req = SendMessageRequest(
                        type="internal",
                        recipient=str(uid),
                        template_uuid=UUID(template_ref),
                        variables=vars_payload,
                        content="",
                    )
                    result = await MessageService.send_message(tenant_id, req)
                    if result.success:
                        sent += 1
                    else:
                        logger.error(
                            "业务消息提醒发送失败 tenant={} doc={} action={} user={} err={}",
                            tenant_id,
                            doc,
                            action,
                            uid,
                            result.error,
                        )
                except Exception as e:
                    logger.error(
                        "业务消息提醒发送异常 tenant={} doc={} action={} user={}: {}",
                        tenant_id,
                        doc,
                        action,
                        uid,
                        e,
                    )
        return sent

    @staticmethod
    async def _resolve_recipient_ids(
        tenant_id: int, rule: dict, context: Dict[str, Any]
    ) -> List[int]:
        seen: Set[int] = set()
        out: List[int] = []

        def add(uid: Any) -> None:
            try:
                i = int(uid)
            except (TypeError, ValueError):
                return
            if i < 1 or i in seen:
                return
            seen.add(i)
            out.append(i)

        scopes = rule.get("recipient_scopes") or []
        if isinstance(scopes, str):
            scopes = [scopes]
        scope_keys = [str(s or "").strip() for s in scopes if str(s or "").strip()]
        has_user_specified = "user_specified" in scope_keys

        for scope in scope_keys:
            if scope == "user_specified":
                continue
            if scope == "creator":
                add(context.get("creator_user_id"))
                continue
            resolver = _SCOPE_RESOLVERS.get(scope)
            if resolver:
                for uid in await resolver(tenant_id, context):
                    add(uid)
            else:
                logger.debug("未知消息收件范围 scope={}，已跳过", scope)

        for uid in _rule_fixed_recipient_user_ids(rule):
            add(uid)

        if has_user_specified:
            form_ids = await _scope_user_specified(tenant_id, context)
            effective = form_ids if form_ids else _rule_form_notify_default_user_ids(rule)
            for uid in effective:
                add(uid)

        return out
