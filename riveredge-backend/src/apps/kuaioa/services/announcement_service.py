"""公告通知服务。"""



from __future__ import annotations



from typing import Any, Optional



from apps.common.audit_actor import apply_create_audit

from apps.kuaioa.models.announcement import KuaioaAnnouncement

from apps.kuaioa.schemas.announcement import AnnouncementCreate, AnnouncementUpdate

from apps.kuaioa.services.kuaioa_list_core import (

    build_keyword_q,

    generate_daily_code,

    model_to_dict,

    touch_updated,

)

from core.schemas.message_template import SendMessageRequest

from core.services.messaging.message_service import MessageService

from core.utils.timezone_utils import resolve_business_datetime

from infra.exceptions.exceptions import BusinessLogicError, NotFoundError

from infra.models.user import User





class AnnouncementService:

    @staticmethod

    def _is_active_published(row: dict[str, Any], *, now: Any) -> bool:

        if row.get("status") != "published":

            return True

        effective_at = row.get("effective_at")

        expires_at = row.get("expires_at")

        if effective_at and effective_at > now:

            return False

        if expires_at and expires_at <= now:

            return False

        return True



    async def list_announcements(

        self,

        tenant_id: int,

        *,

        keyword: Optional[str] = None,

        status: Optional[str] = None,

        published_only: bool = False,

        active_only: bool = False,

    ) -> list[dict[str, Any]]:

        q = KuaioaAnnouncement.filter(tenant_id=tenant_id, deleted_at__isnull=True)

        if status:

            q = q.filter(status=status)

        elif published_only:

            q = q.filter(status="published")

        if keyword:

            q = q.filter(build_keyword_q(keyword, "announcement_code", "title", "publisher_name"))

        rows = await q.order_by("-is_pinned", "-published_at", "-created_at")

        now = resolve_business_datetime()

        result: list[dict[str, Any]] = []

        for row in rows:

            item = model_to_dict(row)

            if active_only or published_only or status == "published":

                if not self._is_active_published(item, now=now):

                    continue

            result.append(item)

        return result



    async def get_announcement(self, tenant_id: int, announcement_id: int) -> dict[str, Any]:

        row = await KuaioaAnnouncement.get_or_none(

            id=announcement_id, tenant_id=tenant_id, deleted_at__isnull=True

        )

        if not row:

            raise NotFoundError("公告不存在")

        return model_to_dict(row)



    async def create_announcement(

        self, tenant_id: int, data: AnnouncementCreate, user: User

    ) -> dict[str, Any]:

        code = await generate_daily_code(

            KuaioaAnnouncement, tenant_id, "AN", code_field="announcement_code"

        )

        payload: dict[str, Any] = {

            "tenant_id": tenant_id,

            "announcement_code": code,

            "title": data.title.strip(),

            "content": data.content,

            "scope_type": data.scope_type,

            "scope_department": data.scope_department,

            "is_pinned": data.is_pinned,

            "effective_at": self._parse_dt(data.effective_at),

            "expires_at": self._parse_dt(data.expires_at),

            "status": "draft",

        }

        apply_create_audit(payload, user)

        row = await KuaioaAnnouncement.create(**payload)

        return model_to_dict(row)



    async def update_announcement(

        self, tenant_id: int, announcement_id: int, data: AnnouncementUpdate, user: User

    ) -> dict[str, Any]:

        row = await KuaioaAnnouncement.get_or_none(

            id=announcement_id, tenant_id=tenant_id, deleted_at__isnull=True

        )

        if not row:

            raise NotFoundError("公告不存在")

        if row.status == "published":

            raise BusinessLogicError("已发布公告不可编辑")

        payload = data.model_dump(exclude_unset=True)

        for key in ("effective_at", "expires_at"):

            if key in payload:

                payload[key] = self._parse_dt(payload[key])

        for key, value in payload.items():

            setattr(row, key, value)

        await touch_updated(row, user)

        await row.save()

        return model_to_dict(row)



    async def delete_announcement(

        self, tenant_id: int, announcement_id: int, user: User

    ) -> None:

        row = await KuaioaAnnouncement.get_or_none(

            id=announcement_id, tenant_id=tenant_id, deleted_at__isnull=True

        )

        if not row:

            raise NotFoundError("公告不存在")

        if row.status == "published":

            raise BusinessLogicError("已发布公告不可删除")

        row.deleted_at = resolve_business_datetime()

        await touch_updated(row, user)

        await row.save()



    async def publish_announcement(

        self, tenant_id: int, announcement_id: int, user: User

    ) -> dict[str, Any]:

        row = await KuaioaAnnouncement.get_or_none(

            id=announcement_id, tenant_id=tenant_id, deleted_at__isnull=True

        )

        if not row:

            raise NotFoundError("公告不存在")

        if row.status == "published":

            raise BusinessLogicError("公告已发布")

        targets = await self._resolve_publish_targets(tenant_id, row)

        row.status = "published"

        row.publisher_id = user.id

        row.publisher_name = getattr(user, "name", None) or getattr(user, "username", None)

        row.published_at = resolve_business_datetime()

        await touch_updated(row, user)

        await row.save()

        await self._notify_users(tenant_id, targets, row.title, row.content or "")

        return model_to_dict(row)



    @staticmethod

    def _parse_dt(value: Optional[str]) -> Any:

        if value is None or not str(value).strip():

            return None

        from apps.kuaioa.services.kuaioa_approval_doc_service import parse_business_datetime



        return parse_business_datetime(value)



    @staticmethod

    async def _resolve_publish_targets(tenant_id: int, row: KuaioaAnnouncement) -> list[User]:

        users = await User.filter(tenant_id=tenant_id, is_active=True).prefetch_related("department").all()

        if row.scope_type == "department":

            dept_name = (row.scope_department or "").strip()

            if not dept_name:

                raise BusinessLogicError("指定部门发布时，部门范围不能为空")

            matched: list[User] = []

            for user in users:

                department = getattr(user, "department", None)

                user_dept = getattr(department, "name", None) if department else None

                if user_dept and str(user_dept).strip() == dept_name:

                    matched.append(user)

            if not matched:

                raise BusinessLogicError(f"未找到部门「{dept_name}」下的用户，无法按部门发布")

            return matched

        return list(users)



    @staticmethod

    async def _notify_users(

        tenant_id: int, users: list[User], title: str, content: str

    ) -> None:

        subject = f"公告通知 {title}"

        for user in users:

            await MessageService.send_message(

                tenant_id=tenant_id,

                request=SendMessageRequest(

                    type="internal",

                    recipient=str(user.id),

                    subject=subject,

                    content=content,

                ),

            )

