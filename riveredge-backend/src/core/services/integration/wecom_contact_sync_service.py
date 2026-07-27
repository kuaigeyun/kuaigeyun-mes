"""企业微信通讯录同步（部门树 + 成员 → 本系统组织架构 / 用户）。"""

from __future__ import annotations

import re
import secrets
from datetime import datetime, timezone
from typing import Any, Optional

from loguru import logger
from tortoise.transactions import in_transaction

from core.models.department import Department
from core.models.integration_config import IntegrationConfig
from core.services.authorization.permission_version_service import PermissionVersionService
from core.services.integration.wecom_integration import (
    fetch_wecom_access_token_for_tenant,
    get_active_wecom_integration,
    list_wecom_departments,
    list_wecom_users,
)
from core.services.integration.wecom_oauth_service import (
    _extract_wecom_user_id,
    _normalize_email,
    _normalize_phone,
)
from infra.exceptions.exceptions import NotFoundError, ValidationError
from infra.models.user import User
from infra.services.tenant_service import TenantService
from core.utils.timezone_utils import now_utc

WECOM_SOURCE = "wecom"
_CN_MOBILE_RE = re.compile(r"^1[3-9]\d{9}$")


def _as_int(value: Any) -> Optional[int]:
    if value is None:
        return None
    try:
        return int(value)
    except (TypeError, ValueError):
        return None


def _safe_phone(raw: Any) -> Optional[str]:
    phone = _normalize_phone(raw if isinstance(raw, str) else None)
    if not phone or not _CN_MOBILE_RE.match(phone):
        return None
    return phone


def _safe_email(raw: Any) -> Optional[str]:
    if isinstance(raw, str):
        return _normalize_email(raw)
    return None


class WeComContactSyncService:
    """从企业微信通讯录同步部门与成员。"""

    @staticmethod
    async def sync_contacts(*, tenant_id: int, integration_uuid: str) -> dict[str, Any]:
        integration = await IntegrationConfig.filter(
            tenant_id=tenant_id,
            uuid=str(integration_uuid),
            deleted_at__isnull=True,
        ).first()
        if not integration or integration.type != "wecom":
            raise NotFoundError("企业微信应用连接不存在")
        if not integration.is_active:
            raise ValidationError("请先启用该企业微信连接器后再同步通讯录")

        active = await get_active_wecom_integration(tenant_id)
        if not active or str(active.uuid) != str(integration.uuid):
            raise ValidationError("当前连接器不是本组织启用的企业微信连接，请确认 is_active 配置")

        token = await fetch_wecom_access_token_for_tenant(tenant_id)
        departments = await list_wecom_departments(token)
        if not departments:
            raise ValidationError("企业微信未返回任何部门，请确认应用已开通通讯录只读权限")

        dept_stats = await WeComContactSyncService._sync_departments(
            tenant_id=tenant_id,
            departments=departments,
        )
        wecom_dept_to_local = await WeComContactSyncService._load_wecom_dept_map(tenant_id)

        root_id = WeComContactSyncService._resolve_root_department_id(departments)
        members = await list_wecom_users(token, department_id=root_id, fetch_child=True)
        user_stats = await WeComContactSyncService._sync_users(
            tenant_id=tenant_id,
            members=members,
            wecom_dept_to_local=wecom_dept_to_local,
        )

        result = {
            "departments": dept_stats,
            "users": user_stats,
            "synced_at": now_utc().isoformat(),
        }
        await WeComContactSyncService._persist_sync_meta(integration, result)
        logger.info(
            "企微通讯录同步完成 tenant={} integration={} dept={} user={}",
            tenant_id,
            integration.uuid,
            dept_stats,
            user_stats,
        )
        return result

    @staticmethod
    def _resolve_root_department_id(departments: list[dict[str, Any]]) -> int:
        for dept in departments:
            parent_id = _as_int(dept.get("parentid"))
            dept_id = _as_int(dept.get("id"))
            if parent_id == 0 and dept_id is not None:
                return dept_id
        first_id = _as_int(departments[0].get("id"))
        if first_id is None:
            raise ValidationError("企业微信部门数据缺少有效 id")
        return first_id

    @staticmethod
    async def _load_wecom_dept_map(tenant_id: int) -> dict[str, int]:
        rows = await Department.filter(
            tenant_id=tenant_id,
            deleted_at__isnull=True,
            external_source=WECOM_SOURCE,
            external_id__isnull=False,
        ).all()
        return {str(d.external_id): d.id for d in rows if d.external_id}

    @staticmethod
    async def _sync_departments(
        *,
        tenant_id: int,
        departments: list[dict[str, Any]],
    ) -> dict[str, int]:
        created = 0
        updated = 0
        skipped = 0

        normalized: list[dict[str, Any]] = []
        for raw in departments:
            wecom_id = _as_int(raw.get("id"))
            name = str(raw.get("name") or "").strip()
            if wecom_id is None or not name:
                skipped += 1
                continue
            parent_wecom_id = _as_int(raw.get("parentid"))
            order = _as_int(raw.get("order")) or 0
            normalized.append(
                {
                    "wecom_id": str(wecom_id),
                    "name": name[:100],
                    "parent_wecom_id": str(parent_wecom_id) if parent_wecom_id and parent_wecom_id != 0 else None,
                    "sort_order": order,
                }
            )

        for item in normalized:
            dept = await Department.filter(
                tenant_id=tenant_id,
                deleted_at__isnull=True,
                external_source=WECOM_SOURCE,
                external_id=item["wecom_id"],
            ).first()
            if dept:
                dept.name = item["name"]
                dept.sort_order = item["sort_order"]
                dept.is_active = True
                await dept.save()
                updated += 1
            else:
                await Department.create(
                    tenant_id=tenant_id,
                    name=item["name"],
                    code=f"wecom_{item['wecom_id']}"[:50],
                    external_source=WECOM_SOURCE,
                    external_id=item["wecom_id"],
                    parent_id=None,
                    manager_id=None,
                    sort_order=item["sort_order"],
                    is_active=True,
                )
                created += 1

        wecom_map = await WeComContactSyncService._load_wecom_dept_map(tenant_id)
        for item in normalized:
            local_id = wecom_map.get(item["wecom_id"])
            if local_id is None:
                continue
            parent_wecom = item["parent_wecom_id"]
            parent_local_id = wecom_map.get(parent_wecom) if parent_wecom else None
            dept = await Department.filter(id=local_id, tenant_id=tenant_id).first()
            if not dept:
                continue
            if dept.parent_id != parent_local_id:
                dept.parent_id = parent_local_id
                await dept.save()

        return {"created": created, "updated": updated, "skipped": skipped}

    @staticmethod
    async def _list_tenant_users(tenant_id: int) -> list[User]:
        return await User.filter(
            tenant_id=tenant_id,
            deleted_at__isnull=True,
        )

    @staticmethod
    def _resolve_existing_user(
        *,
        wecom_userid: str,
        mobile: Optional[str],
        email: Optional[str],
        users: list[User],
    ) -> Optional[User]:
        target = wecom_userid.strip().lower()
        for user in users:
            bound = _extract_wecom_user_id(user)
            if bound and bound.lower() == target:
                return user

        phone_matches: list[User] = []
        email_matches: list[User] = []
        username_matches: list[User] = []
        for user in users:
            bound = _extract_wecom_user_id(user)
            if bound and bound.lower() != target:
                continue
            if mobile and _normalize_phone(user.phone) == mobile:
                phone_matches.append(user)
            if email and _normalize_email(user.email) == email:
                email_matches.append(user)
            if user.username and user.username.strip().lower() == target:
                username_matches.append(user)

        for group in (phone_matches, email_matches, username_matches):
            if len(group) == 1:
                return group[0]
        return None

    @staticmethod
    async def _sync_users(
        *,
        tenant_id: int,
        members: list[dict[str, Any]],
        wecom_dept_to_local: dict[str, int],
    ) -> dict[str, int]:
        created = 0
        updated = 0
        skipped = 0
        bound = 0
        users = await WeComContactSyncService._list_tenant_users(tenant_id)

        for raw in members:
            wecom_userid = str(raw.get("userid") or "").strip()
            name = str(raw.get("name") or "").strip()
            if not wecom_userid or len(wecom_userid) < 2 or len(wecom_userid) > 50:
                skipped += 1
                continue

            mobile = _safe_phone(raw.get("mobile"))
            email = _safe_email(raw.get("email")) or _safe_email(raw.get("biz_mail"))
            status = _as_int(raw.get("status"))
            is_active = status == 1 if status is not None else True

            main_dept = _as_int(raw.get("main_department"))
            if main_dept is None:
                depts = raw.get("department")
                if isinstance(depts, list) and depts:
                    main_dept = _as_int(depts[0])
            department_id = (
                wecom_dept_to_local.get(str(main_dept)) if main_dept is not None else None
            )

            user = WeComContactSyncService._resolve_existing_user(
                wecom_userid=wecom_userid,
                mobile=mobile,
                email=email,
                users=users,
            )

            if user:
                if name and user.full_name != name[:100]:
                    user.full_name = name[:100]
                if mobile and user.phone != mobile:
                    user.phone = mobile
                if email and user.email != email:
                    user.email = email
                if department_id is not None and user.department_id != department_id:
                    user.department_id = department_id
                user.is_active = is_active
                await user.save()
                updated += 1

                existing_bind = _extract_wecom_user_id(user)
                if not existing_bind:
                    contact = user.contact_info if isinstance(user.contact_info, dict) else {}
                    user.contact_info = {**contact, "wecom_userid": wecom_userid}
                    await user.save()
                    bound += 1
                continue

            try:
                async with in_transaction() as conn:
                    await TenantService().assert_shared_user_quota_capacity(
                        tenant_id=tenant_id,
                        increment=1,
                        using_db=conn,
                    )
                    password_hash = User.hash_password(secrets.token_urlsafe(24))
                    user = await User.create(
                        tenant_id=tenant_id,
                        username=wecom_userid,
                        email=email,
                        password_hash=password_hash,
                        full_name=name[:100] if name else None,
                        phone=mobile,
                        department_id=department_id,
                        is_active=is_active,
                        is_tenant_admin=False,
                        source=WECOM_SOURCE,
                        contact_info={"wecom_userid": wecom_userid},
                        using_db=conn,
                    )
                await PermissionVersionService.bump(tenant_id=tenant_id, user_id=user.id)
                users.append(user)
                created += 1
            except Exception as exc:
                logger.warning(
                    "企微成员同步创建失败 tenant={} userid={}: {}",
                    tenant_id,
                    wecom_userid,
                    exc,
                )
                skipped += 1

        return {
            "created": created,
            "updated": updated,
            "skipped": skipped,
            "bound": bound,
        }

    @staticmethod
    async def _persist_sync_meta(integration: IntegrationConfig, result: dict[str, Any]) -> None:
        config = dict(integration.get_config() or {})
        config["last_contact_sync_at"] = result.get("synced_at")
        config["last_contact_sync_result"] = {
            "departments": result.get("departments"),
            "users": result.get("users"),
        }
        integration.config = config
        integration.is_connected = True
        integration.last_connected_at = now_utc()
        integration.last_error = None
        await integration.save()
