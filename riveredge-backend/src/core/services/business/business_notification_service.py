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


async def _scope_creator(tenant_id: int, context: Dict[str, Any]) -> List[int]:
    del tenant_id
    return _normalize_context_user_ids(context.get("creator_user_id"))


async def _scope_salesman(tenant_id: int, context: Dict[str, Any]) -> List[int]:
    del tenant_id
    return _normalize_context_user_ids(context.get("salesman_user_id"))


async def _scope_follower(tenant_id: int, context: Dict[str, Any]) -> List[int]:
    del tenant_id
    return _normalize_context_user_ids(context.get("follower_user_id"))


async def _scope_next_operation_assignees(tenant_id: int, context: Dict[str, Any]) -> List[int]:
    """下一工序指派人（由派发方写入 next_operation_assignee_user_ids）。"""
    del tenant_id
    return _normalize_context_user_ids(context.get("next_operation_assignee_user_ids"))


async def _scope_operation_assignees(tenant_id: int, context: Dict[str, Any]) -> List[int]:
    """工序派工被指派人（由派发方写入 operation_assignee_user_ids）。"""
    del tenant_id
    return _normalize_context_user_ids(context.get("operation_assignee_user_ids"))


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
    register_notification_scope_resolver("creator", _scope_creator)
    register_notification_scope_resolver("salesman", _scope_salesman)
    register_notification_scope_resolver("follower", _scope_follower)
    register_notification_scope_resolver(
        "next_operation_assignees", _scope_next_operation_assignees
    )
    register_notification_scope_resolver("operation_assignees", _scope_operation_assignees)


ensure_core_notification_scope_resolvers()


def _normalize_rules(raw: Any) -> List[dict]:
    if isinstance(raw, dict) and isinstance(raw.get("rules"), list):
        return [r for r in raw["rules"] if isinstance(r, dict)]
    if isinstance(raw, dict) and raw.get("trigger_document"):
        return [raw]
    return []


class BusinessNotificationService:
    BUILTIN_INTERNAL_CHANNEL = "__builtin_internal_channel__"
    IN_APP_CHANNEL_CODE = "internal"

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
        按业务配置规则多渠道派发（站内信/邮件/短信/推送）。
        返回成功发送条数（按 接收人×渠道×规则 计）。
        无匹配规则或未配置接收人时返回 0；渠道失败记日志，不吞成成功。
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

        entity_type = ctx.get("entity_type")
        entity_id = ctx.get("entity_id")
        entity_uuid = ctx.get("entity_uuid")
        try:
            entity_id_int = int(entity_id) if entity_id is not None else None
        except (TypeError, ValueError):
            entity_id_int = None

        # IDEM：同一实体同一触发动作已成功发送则跳过。
        # P2-20：可重复动作（质检失败/异常/驳回/触发类）不加永久去重，避免合法二次提醒被吞。
        _REPEATABLE_ACTIONS = frozenset({
            "abnormal_detected",
            "rejected",
            "triggered",
            "failed",
            "quality_failed",
            "inspection_failed",
            "alert",
            "reminder",
        })
        if entity_id_int and entity_id_int > 0 and action not in _REPEATABLE_ACTIONS:
            from core.models.message_log import MessageLog
            from datetime import timedelta
            from core.utils.timezone_utils import resolve_business_datetime

            # created/approved 等：24h 窗口内成功记录去重
            since = resolve_business_datetime() - timedelta(hours=24)
            already = await MessageLog.filter(
                tenant_id=tenant_id,
                business_document=doc,
                business_action=action,
                entity_id=entity_id_int,
                status="success",
                deleted_at__isnull=True,
                created_at__gte=since,
            ).exists()
            if already:
                logger.info(
                    "业务消息提醒幂等跳过 tenant={} doc={} action={} entity_id={}",
                    tenant_id,
                    doc,
                    action,
                    entity_id_int,
                )
                return 0

        sent = 0
        dispatch_errors: list[str] = []
        for rule in rules:
            if rule.get("enabled") is False:
                continue
            if str(rule.get("trigger_document") or "").strip() != doc:
                continue
            if str(rule.get("trigger_action") or "").strip() != action:
                continue

            template_ref = str(rule.get("template_uuid") or rule.get("template") or "").strip()
            template_code = str(rule.get("template_code") or "").strip()
            if not template_ref and not template_code:
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

            if "message_category" not in vars_payload:
                vars_payload["message_category"] = "process"

            channels = await BusinessNotificationService._resolve_channels(tenant_id, rule)
            if not channels:
                channels = [{"type": "internal", "config_uuid": None}]
            preferred = ctx.get("preferred_channels")
            if isinstance(preferred, list) and preferred:
                preferred_set = {
                    str(c).strip().lower() for c in preferred if str(c).strip()
                }
                filtered = [c for c in channels if c.get("type") in preferred_set]
                if filtered:
                    channels = filtered

            contact_map = await BusinessNotificationService._load_user_contacts(
                tenant_id, recipient_ids
            )

            for uid in recipient_ids:
                for channel in channels:
                    channel_type = channel["type"]
                    try:
                        recipient = BusinessNotificationService._recipient_for_channel(
                            channel_type, uid, contact_map
                        )
                        if not recipient:
                            logger.error(
                                "业务消息提醒缺少收件地址 tenant={} doc={} action={} user={} channel={}",
                                tenant_id,
                                doc,
                                action,
                                uid,
                                channel_type,
                            )
                            continue

                        req_kwargs: Dict[str, Any] = dict(
                            type=channel_type,
                            recipient=recipient,
                            variables=vars_payload,
                            content="",
                            business_document=doc,
                            business_action=action,
                            entity_type=str(entity_type) if entity_type else None,
                            entity_id=entity_id_int,
                            entity_uuid=str(entity_uuid) if entity_uuid else None,
                        )
                        if channel.get("config_uuid"):
                            req_kwargs["config_uuid"] = UUID(str(channel["config_uuid"]))
                        if template_ref:
                            try:
                                req_kwargs["template_uuid"] = UUID(template_ref)
                            except (TypeError, ValueError):
                                if template_code:
                                    req_kwargs["template_code"] = template_code
                                else:
                                    req_kwargs["template_code"] = template_ref
                        elif template_code:
                            req_kwargs["template_code"] = template_code
                        req = SendMessageRequest(**req_kwargs)
                        result = await MessageService.send_message(tenant_id, req)
                        if result.success:
                            sent += 1
                        else:
                            err = str(result.error or "send_failed")
                            dispatch_errors.append(err)
                            logger.error(
                                "业务消息提醒发送失败 tenant={} doc={} action={} user={} channel={} err={}",
                                tenant_id,
                                doc,
                                action,
                                uid,
                                channel_type,
                                result.error,
                            )
                    except Exception as e:
                        dispatch_errors.append(str(e))
                        logger.error(
                            "业务消息提醒发送异常 tenant={} doc={} action={} user={} channel={}: {}",
                            tenant_id,
                            doc,
                            action,
                            uid,
                            channel_type,
                            e,
                        )
        if sent == 0 and dispatch_errors:
            raise RuntimeError(
                f"业务消息提醒全部发送失败 doc={doc} action={action}: {dispatch_errors[0]}"
            )
        return sent

    @staticmethod
    async def _resolve_channels(tenant_id: int, rule: dict) -> List[Dict[str, Any]]:
        from core.models.message_config import MessageConfig

        refs = rule.get("channel_uuids")
        if not isinstance(refs, list):
            refs = rule.get("channels")
        if not isinstance(refs, list) or not refs:
            return [{"type": "internal", "config_uuid": None}]

        out: List[Dict[str, Any]] = []
        seen: Set[str] = set()
        uuid_refs: List[str] = []
        for raw in refs:
            key = str(raw or "").strip()
            if not key or key in seen:
                continue
            seen.add(key)
            if key in {
                BusinessNotificationService.BUILTIN_INTERNAL_CHANNEL,
                BusinessNotificationService.IN_APP_CHANNEL_CODE,
            }:
                out.append({"type": "internal", "config_uuid": None})
                continue
            uuid_refs.append(key)

        if uuid_refs:
            rows = await MessageConfig.filter(
                tenant_id=tenant_id,
                uuid__in=uuid_refs,
                is_active=True,
                deleted_at__isnull=True,
            ).all()
            by_uuid = {str(r.uuid): r for r in rows}
            for key in uuid_refs:
                cfg = by_uuid.get(key)
                if not cfg:
                    logger.error(
                        "业务消息提醒渠道配置不存在或已停用 tenant={} config_uuid={}",
                        tenant_id,
                        key,
                    )
                    continue
                channel_type = str(cfg.type or "").strip().lower()
                if channel_type not in {"internal", "email", "sms", "push"}:
                    logger.error(
                        "业务消息提醒不支持的渠道类型 tenant={} config_uuid={} type={}",
                        tenant_id,
                        key,
                        channel_type,
                    )
                    continue
                out.append({"type": channel_type, "config_uuid": str(cfg.uuid)})
        return out

    @staticmethod
    async def _load_user_contacts(
        tenant_id: int, user_ids: List[int]
    ) -> Dict[int, Dict[str, Optional[str]]]:
        from infra.models.user import User

        if not user_ids:
            return {}
        rows = await User.filter(
            tenant_id=tenant_id,
            id__in=user_ids,
            deleted_at__isnull=True,
        ).values("id", "email", "phone")
        out: Dict[int, Dict[str, Optional[str]]] = {}
        for row in rows:
            out[int(row["id"])] = {
                "email": (row.get("email") or "").strip() or None,
                "phone": (row.get("phone") or "").strip() or None,
            }
        return out

    @staticmethod
    def _recipient_for_channel(
        channel_type: str,
        user_id: int,
        contact_map: Dict[int, Dict[str, Optional[str]]],
    ) -> Optional[str]:
        if channel_type in {"internal", "push"}:
            return str(user_id)
        contacts = contact_map.get(user_id) or {}
        if channel_type == "email":
            return contacts.get("email")
        if channel_type == "sms":
            return contacts.get("phone")
        return None

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
