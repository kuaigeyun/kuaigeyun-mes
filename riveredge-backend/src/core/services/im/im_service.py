"""IM 会话与消息（PostgreSQL 真源）：私聊、群聊、公共群、模块同步、@KU-AI。"""

from __future__ import annotations

import asyncio
import re
from typing import Any, Optional

from loguru import logger
from tortoise import timezone

from core.models.im_conversation import (
    ImConversation,
    ImConversationMember,
    ImConversationModule,
)
from core.models.im_message import ImMessage
from core.schemas.im import (
    ImConversationListResponse,
    ImConversationResponse,
    ImCreateGroupConversationRequest,
    ImMemberListResponse,
    ImMemberResponse,
    ImMessageListResponse,
    ImMessageResponse,
    ImSendMessageRequest,
    ImUpdateGroupConversationRequest,
)
from core.services.realtime.dispatch import schedule_user_realtime_event
from core.services.realtime.events import IM_MESSAGE
from core.utils.timezone_utils import resolve_business_datetime
from infra.exceptions.exceptions import NotFoundError, ValidationError
from infra.models.user import User

IM_RECALL_WINDOW_SECONDS = 120
# sender_id=0：系统推送 / KU-AI（用 kind 区分 system | ai_ref）
IM_BOT_SENDER_ID = 0
PUBLIC_GROUP_TITLE = "公共群聊"
KNOWN_MODULE_CODES = (
    "kuaizhizao",
    "kuaiplm",
    "kuaicaiwu",
    "kuaioa",
    "master-data",
    "kuaiai",
    "kuaiiot",
    "system",
)
KU_AI_MENTION_RE = re.compile(r"@(?:KU-AI|KUAI|快AI|库AI)\b", re.IGNORECASE)


class ImService:
    @staticmethod
    def _preview(body: str) -> str:
        text = (body or "").strip()
        return text if len(text) <= 200 else f"{text[:200]}…"

    @staticmethod
    async def _module_codes_for_conversation(
        *,
        tenant_id: int,
        conversation_id: int,
    ) -> list[str]:
        rows = await ImConversationModule.filter(
            tenant_id=tenant_id,
            conversation_id=conversation_id,
            deleted_at__isnull=True,
        ).all()
        return sorted({str(r.module_code).strip() for r in rows if str(r.module_code).strip()})

    @staticmethod
    async def _member_count(*, tenant_id: int, conversation_id: int) -> int:
        return await ImConversationMember.filter(
            tenant_id=tenant_id,
            conversation_id=conversation_id,
            deleted_at__isnull=True,
        ).count()

    @staticmethod
    async def _resolve_direct_peer(
        *,
        tenant_id: int,
        viewer_user_id: int,
        conversation_id: int,
    ) -> tuple[Optional[int], Optional[str]]:
        """私聊：相对当前用户解析对方 id 与展示名。"""
        members = await ImConversationMember.filter(
            tenant_id=tenant_id,
            conversation_id=conversation_id,
            deleted_at__isnull=True,
        ).all()
        peer_id = next((m.user_id for m in members if m.user_id != viewer_user_id), None)
        if peer_id is None:
            return None, None
        peer = await User.filter(
            id=peer_id,
            tenant_id=tenant_id,
            deleted_at__isnull=True,
        ).first()
        if not peer:
            return peer_id, None
        name = (peer.full_name or peer.username or "").strip()
        return peer_id, name or None

    @staticmethod
    async def to_conversation_response(
        *,
        tenant_id: int,
        user_id: int,
        conv: ImConversation,
    ) -> ImConversationResponse:
        member = await ImConversationMember.filter(
            tenant_id=tenant_id,
            conversation_id=conv.id,
            user_id=user_id,
            deleted_at__isnull=True,
        ).first()
        unread = 0
        if member:
            unread = await ImService.conversation_unread_count(
                tenant_id=tenant_id,
                user_id=user_id,
                conversation_id=conv.id,
                last_read_at=member.last_read_at,
            )
        title = conv.title
        peer_user_id: Optional[int] = None
        if conv.kind == "direct":
            peer_user_id, peer_title = await ImService._resolve_direct_peer(
                tenant_id=tenant_id,
                viewer_user_id=user_id,
                conversation_id=conv.id,
            )
            if peer_title:
                title = peer_title
        return ImConversationResponse(
            uuid=conv.uuid,
            kind=conv.kind,
            title=title,
            is_public=bool(conv.is_public),
            is_pinned=bool(member.is_pinned) if member else False,
            peer_user_id=peer_user_id,
            module_codes=await ImService._module_codes_for_conversation(
                tenant_id=tenant_id,
                conversation_id=conv.id,
            ),
            member_count=await ImService._member_count(
                tenant_id=tenant_id,
                conversation_id=conv.id,
            ),
            last_message_at=conv.last_message_at,
            last_message_preview=conv.last_message_preview,
            unread_count=unread,
        )

    @staticmethod
    async def conversation_unread_count(
        *,
        tenant_id: int,
        user_id: int,
        conversation_id: int,
        last_read_at,
    ) -> int:
        unread_q = ImMessage.filter(
            tenant_id=tenant_id,
            conversation_id=conversation_id,
            deleted_at__isnull=True,
        )
        if last_read_at:
            unread_q = unread_q.filter(created_at__gt=last_read_at)
        return await unread_q.exclude(sender_id=user_id).count()

    @staticmethod
    async def ensure_public_group(*, tenant_id: int, user_id: int) -> ImConversation:
        """
        确保租户有默认公共群，并把「属于该组织」的当前用户加入成员。

        平台超管软切换组织时 JWT/头里的 tenant_id 会变、user_id 仍是主组织账号：
        禁止把外组织 user_id 写入本组织成员表，否则产生跨组织会话残留。
        """
        conv = await ImConversation.filter(
            tenant_id=tenant_id,
            kind="group",
            is_public=True,
            deleted_at__isnull=True,
        ).first()
        if not conv:
            conv = await ImConversation.create(
                tenant_id=tenant_id,
                kind="group",
                title=PUBLIC_GROUP_TITLE,
                is_public=True,
                created_by_id=user_id,
            )
            active_users = await User.filter(
                tenant_id=tenant_id,
                deleted_at__isnull=True,
                is_active=True,
            ).values_list("id", flat=True)
            members = [
                ImConversationMember(
                    tenant_id=tenant_id,
                    conversation_id=conv.id,
                    user_id=uid,
                    role="owner" if uid == user_id else "member",
                    is_pinned=True,
                )
                for uid in active_users
            ]
            if members:
                await ImConversationMember.bulk_create(members)
            return conv

        member_user = await User.filter(
            id=user_id,
            tenant_id=tenant_id,
            deleted_at__isnull=True,
            is_active=True,
        ).first()
        if not member_user:
            # 当前账号不属于本组织：只保证群存在，不写入成员（避免跨组织残留）
            return conv

        existing = await ImConversationMember.filter(
            tenant_id=tenant_id,
            conversation_id=conv.id,
            user_id=user_id,
            deleted_at__isnull=True,
        ).first()
        if not existing:
            await ImConversationMember.create(
                tenant_id=tenant_id,
                conversation_id=conv.id,
                user_id=user_id,
                role="member",
                is_pinned=True,
            )
        return conv

    @staticmethod
    async def purge_cross_tenant_memberships(*, tenant_id: int | None = None) -> int:
        """
        清理成员表中「成员用户所属组织 ≠ 会话组织」的脏行（软删）。
        tenant_id 为空则全库扫描；返回处理条数。
        """
        now = resolve_business_datetime()
        member_q = ImConversationMember.filter(deleted_at__isnull=True)
        if tenant_id is not None:
            member_q = member_q.filter(tenant_id=tenant_id)
        rows = await member_q.all()
        if not rows:
            return 0
        user_ids = sorted({int(m.user_id) for m in rows if m.user_id})
        users = await User.filter(id__in=user_ids).only("id", "tenant_id")
        home_by_id = {int(u.id): int(u.tenant_id) for u in users}
        purged = 0
        for row in rows:
            home = home_by_id.get(int(row.user_id))
            if home is None or home == int(row.tenant_id):
                continue
            row.deleted_at = now
            await row.save(update_fields=["deleted_at", "updated_at"])
            purged += 1
        if purged:
            logger.info(
                "im_purged_cross_tenant_memberships count={} tenant_id={}",
                purged,
                tenant_id,
            )
        return purged

    @staticmethod
    async def list_conversations(
        *,
        tenant_id: int,
        user_id: int,
        skip: int = 0,
        limit: int = 50,
    ) -> ImConversationListResponse:
        await ImService.ensure_public_group(tenant_id=tenant_id, user_id=user_id)

        member_rows = await ImConversationMember.filter(
            tenant_id=tenant_id,
            user_id=user_id,
            deleted_at__isnull=True,
        ).all()
        conv_ids = [m.conversation_id for m in member_rows]
        if not conv_ids:
            return ImConversationListResponse(items=[], total=0)

        pinned_by_conv = {m.conversation_id: bool(m.is_pinned) for m in member_rows}
        conversations = await ImConversation.filter(
            tenant_id=tenant_id,
            id__in=conv_ids,
            deleted_at__isnull=True,
        ).all()

        def _sort_key(conv: ImConversation):
            pinned = 0 if pinned_by_conv.get(conv.id) else 1
            ts = conv.last_message_at.timestamp() if conv.last_message_at else 0.0
            updated = conv.updated_at.timestamp() if conv.updated_at else 0.0
            return (pinned, -ts, -updated)

        conversations.sort(key=_sort_key)
        total = len(conversations)
        page_rows = conversations[skip : skip + limit]

        items: list[ImConversationResponse] = []
        for conv in page_rows:
            items.append(
                await ImService.to_conversation_response(
                    tenant_id=tenant_id,
                    user_id=user_id,
                    conv=conv,
                )
            )
        return ImConversationListResponse(items=items, total=total)

    @staticmethod
    async def get_or_create_direct_conversation(
        *,
        tenant_id: int,
        user_id: int,
        peer_user_id: int,
    ) -> ImConversation:
        if peer_user_id == user_id:
            raise ValidationError("不能与自己发起会话")
        peer = await User.filter(
            id=peer_user_id,
            tenant_id=tenant_id,
            deleted_at__isnull=True,
        ).first()
        if not peer:
            raise NotFoundError("对方用户不存在")

        my_memberships = await ImConversationMember.filter(
            tenant_id=tenant_id,
            user_id=user_id,
            deleted_at__isnull=True,
        ).values_list("conversation_id", flat=True)
        if my_memberships:
            peer_memberships = await ImConversationMember.filter(
                tenant_id=tenant_id,
                user_id=peer_user_id,
                conversation_id__in=list(my_memberships),
                deleted_at__isnull=True,
            ).all()
            for pm in peer_memberships:
                conv = await ImConversation.filter(
                    tenant_id=tenant_id,
                    id=pm.conversation_id,
                    kind="direct",
                    deleted_at__isnull=True,
                ).first()
                if conv:
                    return conv

        peer_name = peer.full_name or peer.username
        conv = await ImConversation.create(
            tenant_id=tenant_id,
            kind="direct",
            title=peer_name,
            created_by_id=user_id,
        )
        await ImConversationMember.bulk_create(
            [
                ImConversationMember(
                    tenant_id=tenant_id,
                    conversation_id=conv.id,
                    user_id=user_id,
                    role="owner",
                ),
                ImConversationMember(
                    tenant_id=tenant_id,
                    conversation_id=conv.id,
                    user_id=peer_user_id,
                    role="member",
                ),
            ]
        )
        return conv

    @staticmethod
    def _normalize_module_codes(raw: list[str] | None) -> list[str]:
        codes: list[str] = []
        seen: set[str] = set()
        for item in raw or []:
            code = str(item or "").strip()
            if not code or code in seen:
                continue
            seen.add(code)
            codes.append(code)
        return codes

    @staticmethod
    async def _replace_modules(
        *,
        tenant_id: int,
        conversation_id: int,
        module_codes: list[str],
    ) -> None:
        existing = await ImConversationModule.filter(
            tenant_id=tenant_id,
            conversation_id=conversation_id,
            deleted_at__isnull=True,
        ).all()
        wanted = set(module_codes)
        for row in existing:
            if row.module_code not in wanted:
                row.deleted_at = resolve_business_datetime()
                await row.save()
        have = {row.module_code for row in existing if row.module_code in wanted}
        for code in module_codes:
            if code not in have:
                await ImConversationModule.create(
                    tenant_id=tenant_id,
                    conversation_id=conversation_id,
                    module_code=code,
                )

    @staticmethod
    async def create_group_conversation(
        *,
        tenant_id: int,
        user_id: int,
        request: ImCreateGroupConversationRequest,
    ) -> ImConversation:
        title = (request.title or "").strip()
        if not title:
            raise ValidationError("群聊名称不能为空")

        member_ids = []
        seen = {user_id}
        for uid in request.member_user_ids or []:
            if not isinstance(uid, int) or uid <= 0 or uid in seen:
                continue
            seen.add(uid)
            member_ids.append(uid)

        # 创建者 + 至少 1 人 → 共 ≥2 人
        if len(member_ids) < 1:
            raise ValidationError("创建群聊至少需要再选择 1 名成员（共 2 人）")

        users = await User.filter(
            tenant_id=tenant_id,
            id__in=member_ids,
            deleted_at__isnull=True,
            is_active=True,
        ).all()
        if len(users) != len(member_ids):
            raise ValidationError("部分成员不存在或已停用")

        module_codes = ImService._normalize_module_codes(request.module_codes)
        conv = await ImConversation.create(
            tenant_id=tenant_id,
            kind="group",
            title=title,
            is_public=False,
            created_by_id=user_id,
        )
        rows = [
            ImConversationMember(
                tenant_id=tenant_id,
                conversation_id=conv.id,
                user_id=user_id,
                role="owner",
            )
        ]
        rows.extend(
            ImConversationMember(
                tenant_id=tenant_id,
                conversation_id=conv.id,
                user_id=uid,
                role="member",
            )
            for uid in member_ids
        )
        await ImConversationMember.bulk_create(rows)
        if module_codes:
            await ImService._replace_modules(
                tenant_id=tenant_id,
                conversation_id=conv.id,
                module_codes=module_codes,
            )
        return conv

    @staticmethod
    async def update_group_conversation(
        *,
        tenant_id: int,
        user_id: int,
        conversation_uuid: str,
        request: ImUpdateGroupConversationRequest,
    ) -> ImConversation:
        conv = await ImConversation.filter(
            tenant_id=tenant_id,
            uuid=conversation_uuid,
            kind="group",
            deleted_at__isnull=True,
        ).first()
        if not conv:
            raise NotFoundError("群聊不存在")
        await ImService._require_member(tenant_id=tenant_id, user_id=user_id, conversation=conv)

        if conv.is_public and request.member_user_ids is not None:
            raise ValidationError("公共群聊成员由系统维护，不可手动改成员")

        if request.title is not None:
            title = request.title.strip()
            if not title:
                raise ValidationError("群聊名称不能为空")
            conv.title = title
            await conv.save()

        if request.module_codes is not None:
            await ImService._replace_modules(
                tenant_id=tenant_id,
                conversation_id=conv.id,
                module_codes=ImService._normalize_module_codes(request.module_codes),
            )

        if request.member_user_ids is not None and not conv.is_public:
            wanted = {user_id}
            for uid in request.member_user_ids:
                if isinstance(uid, int) and uid > 0:
                    wanted.add(uid)
            if len(wanted) < 2:
                raise ValidationError("群聊至少保留 2 名成员")
            users = await User.filter(
                tenant_id=tenant_id,
                id__in=list(wanted - {user_id}),
                deleted_at__isnull=True,
                is_active=True,
            ).count()
            if users != len(wanted) - 1:
                raise ValidationError("部分成员不存在或已停用")

            existing = await ImConversationMember.filter(
                tenant_id=tenant_id,
                conversation_id=conv.id,
                deleted_at__isnull=True,
            ).all()
            existing_map = {m.user_id: m for m in existing}
            for uid, row in existing_map.items():
                if uid not in wanted:
                    row.deleted_at = resolve_business_datetime()
                    await row.save()
            for uid in wanted:
                if uid not in existing_map:
                    await ImConversationMember.create(
                        tenant_id=tenant_id,
                        conversation_id=conv.id,
                        user_id=uid,
                        role="owner" if uid == user_id else "member",
                    )
        return conv

    @staticmethod
    async def list_members(
        *,
        tenant_id: int,
        user_id: int,
        conversation_uuid: str,
    ) -> ImMemberListResponse:
        conv = await ImConversation.filter(
            tenant_id=tenant_id,
            uuid=conversation_uuid,
            deleted_at__isnull=True,
        ).first()
        if not conv:
            raise NotFoundError("会话不存在")
        await ImService._require_member(tenant_id=tenant_id, user_id=user_id, conversation=conv)

        members = await ImConversationMember.filter(
            tenant_id=tenant_id,
            conversation_id=conv.id,
            deleted_at__isnull=True,
        ).all()
        user_ids = [m.user_id for m in members]
        users = await User.filter(id__in=user_ids, tenant_id=tenant_id).all()
        user_map = {u.id: u for u in users}
        items: list[ImMemberResponse] = []
        for m in members:
            u = user_map.get(m.user_id)
            full_name = (u.full_name if u else None) or None
            username = (u.username if u else "") or ""
            label = full_name or username or str(m.user_id)
            items.append(
                ImMemberResponse(
                    user_id=m.user_id,
                    username=username,
                    full_name=full_name,
                    label=label,
                    role=m.role or "member",
                )
            )
        items.sort(key=lambda x: x.label)
        return ImMemberListResponse(items=items, total=len(items))

    @staticmethod
    async def _require_member(
        *,
        tenant_id: int,
        user_id: int,
        conversation: ImConversation,
    ) -> ImConversationMember:
        member = await ImConversationMember.filter(
            tenant_id=tenant_id,
            conversation_id=conversation.id,
            user_id=user_id,
            deleted_at__isnull=True,
        ).first()
        if not member:
            raise NotFoundError("会话不存在或无权访问")
        return member

    @staticmethod
    def _to_message_response(conv: ImConversation, row: ImMessage) -> ImMessageResponse:
        mention_ku_ai = bool(KU_AI_MENTION_RE.search(row.body or ""))
        return ImMessageResponse(
            uuid=row.uuid,
            conversation_uuid=conv.uuid,
            sender_id=row.sender_id,
            body=row.body,
            kind=row.kind,
            ref_type=row.ref_type,
            ref_id=row.ref_id,
            mention_user_ids=[],
            mention_ku_ai=mention_ku_ai,
            created_at=row.created_at,
        )

    @staticmethod
    async def list_messages(
        *,
        tenant_id: int,
        user_id: int,
        conversation_uuid: str,
        skip: int = 0,
        limit: int = 50,
    ) -> ImMessageListResponse:
        conv = await ImConversation.filter(
            tenant_id=tenant_id,
            uuid=conversation_uuid,
            deleted_at__isnull=True,
        ).first()
        if not conv:
            raise NotFoundError("会话不存在")
        await ImService._require_member(tenant_id=tenant_id, user_id=user_id, conversation=conv)

        rows = (
            await ImMessage.filter(
                tenant_id=tenant_id,
                conversation_id=conv.id,
                deleted_at__isnull=True,
            )
            .order_by("-created_at")
            .offset(skip)
            .limit(limit)
        )
        total = await ImMessage.filter(
            tenant_id=tenant_id,
            conversation_id=conv.id,
            deleted_at__isnull=True,
        ).count()
        items = [ImService._to_message_response(conv, row) for row in reversed(rows)]
        return ImMessageListResponse(items=items, total=total)

    @staticmethod
    async def _fanout_im_message(
        *,
        tenant_id: int,
        conv: ImConversation,
        msg: ImMessage,
        preview: str,
        recalled: bool = False,
    ) -> None:
        members = await ImConversationMember.filter(
            tenant_id=tenant_id,
            conversation_id=conv.id,
            deleted_at__isnull=True,
        ).all()
        payload: dict[str, Any] = {
            "conversation_uuid": conv.uuid,
            "message_uuid": msg.uuid,
            "sender_id": msg.sender_id,
        }
        if recalled:
            payload["recalled"] = True
        else:
            payload["body_preview"] = preview
        for member in members:
            schedule_user_realtime_event(
                tenant_id=tenant_id,
                user_id=member.user_id,
                event=IM_MESSAGE,
                payload=payload,
            )

    @staticmethod
    async def _post_bot_message(
        *,
        tenant_id: int,
        conv: ImConversation,
        body: str,
        kind: str,
        ref_type: Optional[str] = None,
        ref_id: Optional[str] = None,
    ) -> ImMessage:
        now = timezone.now()
        msg = await ImMessage.create(
            tenant_id=tenant_id,
            conversation_id=conv.id,
            sender_id=IM_BOT_SENDER_ID,
            body=body,
            kind=kind,
            ref_type=ref_type,
            ref_id=ref_id,
        )
        preview = ImService._preview(body)
        conv.last_message_at = now
        conv.last_message_preview = preview
        await conv.save()
        await ImService._fanout_im_message(
            tenant_id=tenant_id,
            conv=conv,
            msg=msg,
            preview=preview,
        )
        return msg

    @staticmethod
    async def send_message(
        *,
        tenant_id: int,
        user_id: int,
        conversation_uuid: str,
        request: ImSendMessageRequest,
    ) -> ImMessageResponse:
        conv = await ImConversation.filter(
            tenant_id=tenant_id,
            uuid=conversation_uuid,
            deleted_at__isnull=True,
        ).first()
        if not conv:
            raise NotFoundError("会话不存在")
        await ImService._require_member(tenant_id=tenant_id, user_id=user_id, conversation=conv)

        body = request.body.strip()
        if not body:
            raise ValidationError("消息内容不能为空")

        mention_ku_ai = bool(request.mention_ku_ai) or bool(KU_AI_MENTION_RE.search(body))

        now = timezone.now()
        msg = await ImMessage.create(
            tenant_id=tenant_id,
            conversation_id=conv.id,
            sender_id=user_id,
            body=body,
            kind="text",
        )
        preview = ImService._preview(body)
        conv.last_message_at = now
        conv.last_message_preview = preview
        await conv.save()

        await ImService._fanout_im_message(
            tenant_id=tenant_id,
            conv=conv,
            msg=msg,
            preview=preview,
        )

        if mention_ku_ai and conv.kind == "group":
            asyncio.create_task(
                ImService._ku_ai_reply_safe(
                    tenant_id=tenant_id,
                    conversation_id=conv.id,
                    trigger_user_id=user_id,
                    prompt=body,
                )
            )

        resp = ImService._to_message_response(conv, msg)
        resp.mention_user_ids = list(request.mention_user_ids or [])
        resp.mention_ku_ai = mention_ku_ai
        return resp

    @staticmethod
    async def _ku_ai_reply_safe(
        *,
        tenant_id: int,
        conversation_id: int,
        trigger_user_id: int,
        prompt: str,
    ) -> None:
        try:
            await ImService._ku_ai_reply(
                tenant_id=tenant_id,
                conversation_id=conversation_id,
                trigger_user_id=trigger_user_id,
                prompt=prompt,
            )
        except Exception:
            logger.exception(
                "IM KU-AI 群聊回复失败 tenant={} conv={} user={}",
                tenant_id,
                conversation_id,
                trigger_user_id,
            )
            try:
                conv = await ImConversation.filter(
                    tenant_id=tenant_id,
                    id=conversation_id,
                    deleted_at__isnull=True,
                ).first()
                if conv:
                    await ImService._post_bot_message(
                        tenant_id=tenant_id,
                        conv=conv,
                        body="KU-AI 暂时无法回复，请稍后重试。",
                        kind="ai_ref",
                        ref_type="ku_ai_error",
                    )
            except Exception:
                logger.exception("IM KU-AI 错误提示写入失败")

    @staticmethod
    async def _ku_ai_reply(
        *,
        tenant_id: int,
        conversation_id: int,
        trigger_user_id: int,
        prompt: str,
    ) -> None:
        conv = await ImConversation.filter(
            tenant_id=tenant_id,
            id=conversation_id,
            deleted_at__isnull=True,
        ).first()
        if not conv:
            return

        cleaned = KU_AI_MENTION_RE.sub("", prompt).strip() or prompt
        system_prompt = (
            "你是企业协同助手 KU-AI。你正在群聊中被 @ 提及，请用简洁中文直接回答，"
            "不要输出思考过程标签。"
        )
        messages = [
            {"role": "system", "content": system_prompt},
            {"role": "user", "content": cleaned},
        ]

        reply_text = ""
        try:
            import importlib.util

            if importlib.util.find_spec("apps.kuaiai.services.deepseek_service") is not None:
                from apps.kuaiai.services.deepseek_service import DeepSeekService

                user = await User.filter(id=trigger_user_id, tenant_id=tenant_id).first()
                result = await DeepSeekService.create_chat_completion(
                    tenant_id,
                    messages,
                    stream=False,
                    user=user,
                    is_infra_admin=False,
                    is_tenant_admin=False,
                    context={"source": "im_group"},
                )
                if isinstance(result, dict):
                    choices = result.get("choices") or []
                    if choices:
                        reply_text = str(
                            (choices[0].get("message") or {}).get("content") or ""
                        ).strip()
            else:
                from core.ai.completion_service import CompletionService
                from core.ai.runtime_config import AiRuntimeConfig

                config = await AiRuntimeConfig.load(tenant_id)
                result = await CompletionService.complete(
                    config,
                    {
                        "model": config.chat_model,
                        "messages": messages,
                        "temperature": 0.7,
                    },
                )
                choices = result.get("choices") or []
                if choices:
                    reply_text = str(
                        (choices[0].get("message") or {}).get("content") or ""
                    ).strip()
        except Exception as exc:
            logger.warning("IM KU-AI 调用失败: {}", exc)
            reply_text = ""

        if not reply_text:
            reply_text = "KU-AI 暂时无法回复，请检查 AI 连接器配置或稍后重试。"

        await ImService._post_bot_message(
            tenant_id=tenant_id,
            conv=conv,
            body=reply_text,
            kind="ai_ref",
            ref_type="ku_ai",
            ref_id=str(trigger_user_id),
        )

    @staticmethod
    def resolve_module_codes_from_notification(
        *,
        template_code: Optional[str],
        variables: Optional[dict],
        business_document: Optional[str],
    ) -> list[str]:
        codes: set[str] = set()
        vars_dict = variables if isinstance(variables, dict) else {}
        for key in ("app_code", "module_code", "application_code"):
            raw = vars_dict.get(key)
            if raw:
                codes.add(str(raw).strip())
        tc = str(template_code or "").strip()
        if tc:
            head = tc.split(".", 1)[0].strip()
            if head:
                codes.add(head)
            for app in KNOWN_MODULE_CODES:
                if tc.startswith(app):
                    codes.add(app)
        doc = str(business_document or "").strip().lower()
        if doc:
            # 粗映射：单据名含采购/销售等仍归快制造等；优先已有 app_code
            if any(x in doc for x in ("sales", "purchase", "warehouse", "work_order", "quality")):
                codes.add("kuaizhizao")
            if "plm" in doc or "ecn" in doc or "bom" in doc:
                codes.add("kuaiplm")
            if any(x in doc for x in ("invoice", "receipt", "payment", "finance", "asset")):
                codes.add("kuaicaiwu")
            if any(x in doc for x in ("leave", "oa", "announcement", "seal")):
                codes.add("kuaioa")
        return sorted(c for c in codes if c)

    @staticmethod
    async def mirror_module_notification(
        *,
        tenant_id: int,
        subject: Optional[str],
        content: Optional[str],
        message_log_uuid: str,
        template_code: Optional[str] = None,
        variables: Optional[dict] = None,
        business_document: Optional[str] = None,
        entity_uuid: Optional[str] = None,
        business_action: Optional[str] = None,
    ) -> None:
        """站内信成功后，同步到绑定了对应模块的群聊（按业务实体/动作去重）。"""
        if not message_log_uuid:
            return
        # 同一业务通知会按收件人多次调用 MessageService，需按实体去重
        dedupe_id = str(entity_uuid or "").strip() or str(message_log_uuid)
        action = str(business_action or "").strip()
        ref_id = f"{dedupe_id}:{action}" if action else dedupe_id
        exists = await ImMessage.filter(
            tenant_id=tenant_id,
            kind="system",
            ref_type="module_notify",
            ref_id=ref_id,
            deleted_at__isnull=True,
        ).exists()
        if exists:
            return

        module_codes = ImService.resolve_module_codes_from_notification(
            template_code=template_code,
            variables=variables,
            business_document=business_document,
        )
        if not module_codes:
            return

        binds = await ImConversationModule.filter(
            tenant_id=tenant_id,
            module_code__in=module_codes,
            deleted_at__isnull=True,
        ).all()
        conv_ids = list({b.conversation_id for b in binds})
        if not conv_ids:
            return

        conversations = await ImConversation.filter(
            tenant_id=tenant_id,
            id__in=conv_ids,
            kind="group",
            deleted_at__isnull=True,
        ).all()
        title = (subject or "").strip() or "模块通知"
        body_core = (content or "").strip()
        body = f"【{title}】\n{body_core}" if body_core else f"【{title}】"
        for conv in conversations:
            await ImService._post_bot_message(
                tenant_id=tenant_id,
                conv=conv,
                body=body,
                kind="system",
                ref_type="module_notify",
                ref_id=ref_id,
            )

    @staticmethod
    async def recall_message(
        *,
        tenant_id: int,
        user_id: int,
        conversation_uuid: str,
        message_uuid: str,
    ) -> None:
        conv = await ImConversation.filter(
            tenant_id=tenant_id,
            uuid=conversation_uuid,
            deleted_at__isnull=True,
        ).first()
        if not conv:
            raise NotFoundError("会话不存在")
        await ImService._require_member(tenant_id=tenant_id, user_id=user_id, conversation=conv)

        msg = await ImMessage.filter(
            tenant_id=tenant_id,
            conversation_id=conv.id,
            uuid=message_uuid,
            deleted_at__isnull=True,
        ).first()
        if not msg:
            raise NotFoundError("消息不存在")
        if msg.sender_id != user_id:
            raise ValidationError("只能撤回自己发送的消息")

        now = resolve_business_datetime()
        created = msg.created_at
        if created is None:
            raise ValidationError("消息时间无效，无法撤回")
        if created.tzinfo is None and now.tzinfo is not None:
            created = created.replace(tzinfo=now.tzinfo)
        age_seconds = (now - created).total_seconds()
        if age_seconds > IM_RECALL_WINDOW_SECONDS:
            raise ValidationError("超过2分钟无法撤回")

        msg.deleted_at = resolve_business_datetime()
        await msg.save()

        latest = (
            await ImMessage.filter(
                tenant_id=tenant_id,
                conversation_id=conv.id,
                deleted_at__isnull=True,
            )
            .order_by("-created_at")
            .first()
        )
        if latest:
            conv.last_message_at = latest.created_at
            conv.last_message_preview = ImService._preview(latest.body)
        else:
            conv.last_message_at = None
            conv.last_message_preview = None
        await conv.save()

        await ImService._fanout_im_message(
            tenant_id=tenant_id,
            conv=conv,
            msg=msg,
            preview="",
            recalled=True,
        )

    @staticmethod
    async def mark_conversation_read(
        *,
        tenant_id: int,
        user_id: int,
        conversation_uuid: str,
    ) -> None:
        conv = await ImConversation.filter(
            tenant_id=tenant_id,
            uuid=conversation_uuid,
            deleted_at__isnull=True,
        ).first()
        if not conv:
            raise NotFoundError("会话不存在")
        member = await ImService._require_member(
            tenant_id=tenant_id,
            user_id=user_id,
            conversation=conv,
        )
        member.last_read_at = timezone.now()
        await member.save()

    @staticmethod
    async def set_conversation_pinned(
        *,
        tenant_id: int,
        user_id: int,
        conversation_uuid: str,
        is_pinned: bool,
    ) -> ImConversation:
        conv = await ImConversation.filter(
            tenant_id=tenant_id,
            uuid=conversation_uuid,
            deleted_at__isnull=True,
        ).first()
        if not conv:
            raise NotFoundError("会话不存在")
        if conv.kind not in ("direct", "group"):
            raise ValidationError("仅个人与群聊会话可置顶")
        member = await ImService._require_member(
            tenant_id=tenant_id,
            user_id=user_id,
            conversation=conv,
        )
        member.is_pinned = bool(is_pinned)
        await member.save()
        return conv
