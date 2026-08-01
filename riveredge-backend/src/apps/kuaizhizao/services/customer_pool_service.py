"""
客户池服务。
"""

from __future__ import annotations

from datetime import datetime, timedelta
from typing import Dict, List, Optional, Sequence

from tortoise import timezone
from tortoise.exceptions import IntegrityError
from tortoise.expressions import Q

from apps.kuaizhizao.services.customer_pool_list_core import apply_customer_pool_list_filters

from apps.kuaizhizao.models.customer_collaborator import CustomerCollaborator
from apps.kuaizhizao.models.customer_pool_log import CustomerPoolLog
from apps.kuaizhizao.models.customer_pool_rule import CustomerPoolRule
from apps.kuaizhizao.schemas.customer_pool import (
    CustomerPoolActionBody,
    CustomerPoolAssignBody,
    CustomerPoolCollaboratorItem,
    CustomerPoolCollaboratorsUpdateBody,
    CustomerPoolItem,
    CustomerPoolListEnvelope,
    CustomerPoolLogItem,
    CustomerPoolLogListEnvelope,
    CustomerPoolRuleResponse,
    CustomerPoolRuleUpdateBody,
)
from apps.master_data.models.customer import Customer
from core.services.authorization.data_scope_service import DataScopeService
from core.services.authorization.user_permission_service import UserPermissionService
from core.utils.timezone_utils import to_api_isoformat
from infra.exceptions.exceptions import NotFoundError, ValidationError
from infra.models.user import User

RESOURCE_CUSTOMER_POOL = "kuaizhizao:customer-pool"
MAX_CUSTOMER_COLLABORATORS = 10
PERM_CUSTOMER_POOL_ASSIGN = "kuaizhizao:customer-pool:assign"


async def list_collaborator_customer_ids(tenant_id: int, user_id: int) -> List[int]:
    rows = await CustomerCollaborator.filter(
        tenant_id=tenant_id,
        user_id=user_id,
        deleted_at__isnull=True,
    ).values_list("customer_id", flat=True)
    return list(rows)


def _to_customer_pool_item(
    row: Customer,
    collaborators: Optional[Sequence[CustomerPoolCollaboratorItem]] = None,
) -> CustomerPoolItem:
    """列表响应：显式映射字段，兼容 pool_status 历史脏数据。"""
    raw_pool_status = str(getattr(row, "pool_status", None) or "").strip().lower()
    if raw_pool_status in ("pool", "owned"):
        pool_status = raw_pool_status
    elif getattr(row, "salesman_id", None):
        pool_status = "owned"
    else:
        pool_status = "pool"
    return CustomerPoolItem(
        id=int(row.id),
        uuid=str(row.uuid),
        code=str(row.code),
        name=str(row.name),
        short_name=getattr(row, "short_name", None),
        contact_person=getattr(row, "contact_person", None),
        phone=getattr(row, "phone", None),
        salesman_id=getattr(row, "salesman_id", None),
        salesman_name=getattr(row, "salesman_name", None),
        pool_status=pool_status,
        assigned_at=getattr(row, "assigned_at", None),
        last_follow_up_at=getattr(row, "last_follow_up_at", None),
        recycle_at=getattr(row, "recycle_at", None),
        created_by_name=getattr(row, "created_by_name", None),
        updated_by_name=getattr(row, "updated_by_name", None),
        created_at=row.created_at,
        updated_at=row.updated_at,
        collaborators=list(collaborators or []),
    )


class CustomerPoolService:
    @staticmethod
    async def _get_rule(tenant_id: int) -> CustomerPoolRule:
        rule = await CustomerPoolRule.filter(
            tenant_id=tenant_id,
            deleted_at__isnull=True,
        ).first()
        if rule:
            return rule
        try:
            return await CustomerPoolRule.create(tenant_id=tenant_id)
        except IntegrityError:
            rule = await CustomerPoolRule.filter(
                tenant_id=tenant_id,
                deleted_at__isnull=True,
            ).first()
            if rule:
                return rule
            raise

    @staticmethod
    async def _load_customer(tenant_id: int, customer_id: int) -> Customer:
        row = await Customer.filter(
            id=customer_id,
            tenant_id=tenant_id,
            deleted_at__isnull=True,
        ).first()
        if not row:
            raise NotFoundError(f"客户不存在: {customer_id}")
        return row

    @classmethod
    async def _calc_recycle_at(
        cls,
        tenant_id: int,
        *,
        assigned_at,
        last_follow_up_at,
    ):
        rule = await cls._get_rule(tenant_id)
        if not rule.recycle_enabled:
            return None
        anchor = last_follow_up_at or assigned_at
        if anchor is None:
            return None
        return anchor + timedelta(days=rule.recycle_after_days)

    @staticmethod
    async def _write_log(
        *,
        tenant_id: int,
        customer: Customer,
        action: str,
        operator_user_id: int,
        from_salesman_id: Optional[int],
        to_salesman_id: Optional[int],
        reason: Optional[str],
    ) -> None:
        await CustomerPoolLog.create(
            tenant_id=tenant_id,
            customer_id=customer.id,
            customer_uuid=str(customer.uuid) if getattr(customer, "uuid", None) else None,
            action=action,
            from_salesman_id=from_salesman_id,
            to_salesman_id=to_salesman_id,
            operator_user_id=operator_user_id,
            reason=(reason or "").strip() or None,
        )

    @classmethod
    async def _assert_owned_capacity(
        cls,
        tenant_id: int,
        target_user_id: int,
        *,
        exclude_customer_id: Optional[int] = None,
    ) -> None:
        rule = await cls._get_rule(tenant_id)
        if rule.max_owned_customers <= 0:
            return
        query = Customer.filter(
            tenant_id=tenant_id,
            deleted_at__isnull=True,
            salesman_id=target_user_id,
            pool_status="owned",
        )
        if exclude_customer_id is not None:
            query = query.exclude(id=exclude_customer_id)
        owned_count = await query.count()
        if owned_count >= rule.max_owned_customers:
            raise ValidationError("目标业务员已达到客户持有上限")

    @classmethod
    async def apply_assign(
        cls,
        *,
        tenant_id: int,
        customer: Customer,
        target_user: User,
        operator: User,
        reason: Optional[str] = None,
        action: str = "assign",
    ) -> Customer:
        """分配/改派归属（主数据与池 API 共用）。"""
        if customer.salesman_id == target_user.id and customer.pool_status == "owned":
            return customer

        await cls._assert_owned_capacity(
            tenant_id,
            target_user.id,
            exclude_customer_id=customer.id,
        )

        now = timezone.now()
        from_salesman = customer.salesman_id
        customer.salesman_id = target_user.id
        customer.salesman_name = target_user.full_name or target_user.username
        customer.pool_status = "owned"
        customer.assigned_at = now
        customer.updated_by = operator.id
        customer.updated_by_name = operator.full_name or operator.username
        customer.recycle_at = await cls._calc_recycle_at(
            tenant_id,
            assigned_at=now,
            last_follow_up_at=customer.last_follow_up_at,
        )
        await customer.save()

        await cls._remove_collaborator_user(
            tenant_id=tenant_id,
            customer=customer,
            user_id=target_user.id,
            operator_user_id=operator.id,
            reason="负责人改派后自动移除协作人",
            write_log=True,
        )

        await cls._write_log(
            tenant_id=tenant_id,
            customer=customer,
            action=action,
            operator_user_id=operator.id,
            from_salesman_id=from_salesman,
            to_salesman_id=target_user.id,
            reason=reason,
        )
        return customer

    @classmethod
    async def apply_release(
        cls,
        *,
        tenant_id: int,
        customer: Customer,
        operator: User,
        reason: Optional[str] = None,
        action: str = "release",
        skip_own_check: bool = False,
    ) -> Customer:
        """释放到公海（主数据与池 API 共用）。"""
        if customer.pool_status == "pool" and not customer.salesman_id:
            return customer

        if not skip_own_check and operator.is_regular_user() and customer.salesman_id != operator.id:
            raise ValidationError("只能释放自己持有的客户")

        from_salesman = customer.salesman_id
        customer.salesman_id = None
        customer.salesman_name = None
        customer.pool_status = "pool"
        customer.assigned_at = None
        customer.recycle_at = None
        customer.updated_by = operator.id
        customer.updated_by_name = operator.full_name or operator.username
        await customer.save()

        await cls._clear_collaborators(
            tenant_id=tenant_id,
            customer=customer,
            operator_user_id=operator.id,
            reason=reason or action,
        )

        await cls._write_log(
            tenant_id=tenant_id,
            customer=customer,
            action=action,
            operator_user_id=operator.id,
            from_salesman_id=from_salesman,
            to_salesman_id=None,
            reason=reason,
        )
        return customer

    @classmethod
    async def apply_recycle(
        cls,
        *,
        tenant_id: int,
        customer: Customer,
        operator: User,
        reason: Optional[str] = None,
    ) -> Customer:
        """强制回收到公海。"""
        if customer.pool_status == "pool" and not customer.salesman_id:
            return customer

        from_salesman = customer.salesman_id
        customer.salesman_id = None
        customer.salesman_name = None
        customer.pool_status = "pool"
        customer.assigned_at = None
        customer.recycle_at = None
        customer.updated_by = operator.id
        customer.updated_by_name = operator.full_name or operator.username
        await customer.save()

        await cls._clear_collaborators(
            tenant_id=tenant_id,
            customer=customer,
            operator_user_id=operator.id,
            reason=reason or "recycle",
        )

        await cls._write_log(
            tenant_id=tenant_id,
            customer=customer,
            action="recycle",
            operator_user_id=operator.id,
            from_salesman_id=from_salesman,
            to_salesman_id=None,
            reason=reason,
        )
        return customer

    @staticmethod
    async def _user_is_external_partner(tenant_id: int, user: User) -> bool:
        if await UserPermissionService.is_admin_bypass(user, tenant_id):
            return False
        roles = await DataScopeService._load_active_roles(user.id, tenant_id)
        return any(
            (getattr(role, "role_type", "") or "").strip().lower() == "external"
            and (getattr(role, "external_partner_type", "") or "").strip()
            for role in roles
        )

    @classmethod
    async def _assert_can_manage_collaborators(
        cls,
        *,
        tenant_id: int,
        customer: Customer,
        operator: User,
    ) -> None:
        if customer.salesman_id == operator.id:
            return
        if await UserPermissionService.has_permission(
            operator.id,
            tenant_id,
            PERM_CUSTOMER_POOL_ASSIGN,
        ):
            return
        raise ValidationError("无权管理协作人")

    @classmethod
    async def _load_collaborators_map(
        cls,
        tenant_id: int,
        customer_ids: Sequence[int],
    ) -> Dict[int, List[CustomerPoolCollaboratorItem]]:
        if not customer_ids:
            return {}
        rows = await CustomerCollaborator.filter(
            tenant_id=tenant_id,
            customer_id__in=list(customer_ids),
            deleted_at__isnull=True,
        ).order_by("id")
        mapping: Dict[int, List[CustomerPoolCollaboratorItem]] = {}
        for row in await rows:
            mapping.setdefault(row.customer_id, []).append(
                CustomerPoolCollaboratorItem(user_id=row.user_id, user_name=row.user_name)
            )
        return mapping

    @classmethod
    async def _remove_collaborator_user(
        cls,
        *,
        tenant_id: int,
        customer: Customer,
        user_id: int,
        operator_user_id: int,
        reason: Optional[str],
        write_log: bool,
    ) -> None:
        row = await CustomerCollaborator.filter(
            tenant_id=tenant_id,
            customer_id=customer.id,
            user_id=user_id,
            deleted_at__isnull=True,
        ).first()
        if not row:
            return
        row.deleted_at = timezone.now()
        await row.save()
        if write_log:
            await cls._write_log(
                tenant_id=tenant_id,
                customer=customer,
                action="collaborator_remove",
                operator_user_id=operator_user_id,
                from_salesman_id=None,
                to_salesman_id=user_id,
                reason=reason,
            )

    @classmethod
    async def _clear_collaborators(
        cls,
        *,
        tenant_id: int,
        customer: Customer,
        operator_user_id: int,
        reason: Optional[str],
    ) -> None:
        rows = await CustomerCollaborator.filter(
            tenant_id=tenant_id,
            customer_id=customer.id,
            deleted_at__isnull=True,
        ).all()
        if not rows:
            return
        now = timezone.now()
        for row in rows:
            row.deleted_at = now
            await row.save()
            await cls._write_log(
                tenant_id=tenant_id,
                customer=customer,
                action="collaborator_remove",
                operator_user_id=operator_user_id,
                from_salesman_id=None,
                to_salesman_id=row.user_id,
                reason=reason,
            )

    @classmethod
    async def list_collaborators(
        cls,
        *,
        tenant_id: int,
        customer_id: int,
        current_user: User,
    ) -> List[CustomerPoolCollaboratorItem]:
        customer = await cls._load_customer(tenant_id, customer_id)
        await DataScopeService.assert_row_visible(
            customer,
            tenant_id=tenant_id,
            user=current_user,
            resource=RESOURCE_CUSTOMER_POOL,
        )
        return (await cls._load_collaborators_map(tenant_id, [customer.id])).get(customer.id, [])

    @classmethod
    async def set_collaborators(
        cls,
        *,
        tenant_id: int,
        customer_id: int,
        current_user: User,
        body: CustomerPoolCollaboratorsUpdateBody,
    ) -> List[CustomerPoolCollaboratorItem]:
        customer = await cls._load_customer(tenant_id, customer_id)
        await DataScopeService.assert_row_visible(
            customer,
            tenant_id=tenant_id,
            user=current_user,
            resource=RESOURCE_CUSTOMER_POOL,
        )
        if customer.pool_status != "owned":
            raise ValidationError("仅已领取客户可设置协作人")

        await cls._assert_can_manage_collaborators(
            tenant_id=tenant_id,
            customer=customer,
            operator=current_user,
        )

        requested_ids: List[int] = []
        seen: set[int] = set()
        for raw in body.user_ids or []:
            uid = int(raw)
            if uid <= 0 or uid in seen:
                continue
            if customer.salesman_id and uid == customer.salesman_id:
                raise ValidationError("负责人不能同时作为协作人")
            seen.add(uid)
            requested_ids.append(uid)
        if len(requested_ids) > MAX_CUSTOMER_COLLABORATORS:
            raise ValidationError(f"协作人数量不能超过 {MAX_CUSTOMER_COLLABORATORS} 人")

        users = await User.filter(id__in=requested_ids, tenant_id=tenant_id, is_active=True).all()
        user_map = {user.id: user for user in users}
        missing = [uid for uid in requested_ids if uid not in user_map]
        if missing:
            raise ValidationError(f"协作人不存在或已停用: {missing[0]}")

        for uid in requested_ids:
            if await cls._user_is_external_partner(tenant_id, user_map[uid]):
                raise ValidationError("外协用户不能作为协作人")

        active_rows = await CustomerCollaborator.filter(
            tenant_id=tenant_id,
            customer_id=customer.id,
            deleted_at__isnull=True,
        ).all()
        current_ids = {row.user_id for row in active_rows}
        target_ids = set(requested_ids)
        to_remove = current_ids - target_ids
        to_add = [uid for uid in requested_ids if uid not in current_ids]

        for uid in to_remove:
            await cls._remove_collaborator_user(
                tenant_id=tenant_id,
                customer=customer,
                user_id=uid,
                operator_user_id=current_user.id,
                reason="更新协作人",
                write_log=True,
            )

        for uid in to_add:
            user = user_map[uid]
            existing = await CustomerCollaborator.filter(
                tenant_id=tenant_id,
                customer_id=customer.id,
                user_id=uid,
            ).first()
            if existing:
                existing.deleted_at = None
                existing.user_name = user.full_name or user.username
                existing.added_by = current_user.id
                existing.added_by_name = current_user.full_name or current_user.username
                await existing.save()
            else:
                await CustomerCollaborator.create(
                    tenant_id=tenant_id,
                    customer_id=customer.id,
                    user_id=uid,
                    user_name=user.full_name or user.username,
                    added_by=current_user.id,
                    added_by_name=current_user.full_name or current_user.username,
                )
            await cls._write_log(
                tenant_id=tenant_id,
                customer=customer,
                action="collaborator_add",
                operator_user_id=current_user.id,
                from_salesman_id=None,
                to_salesman_id=uid,
                reason="更新协作人",
            )

        return await cls.list_collaborators(
            tenant_id=tenant_id,
            customer_id=customer_id,
            current_user=current_user,
        )

    @classmethod
    async def list_pool_logs(
        cls,
        *,
        tenant_id: int,
        customer_id: int,
        current_user: User,
    ) -> CustomerPoolLogListEnvelope:
        customer = await cls._load_customer(tenant_id, customer_id)
        await DataScopeService.assert_row_visible(
            customer,
            tenant_id=tenant_id,
            user=current_user,
            resource=RESOURCE_CUSTOMER_POOL,
        )
        log_rows = await CustomerPoolLog.filter(
            tenant_id=tenant_id,
            customer_id=customer.id,
            deleted_at__isnull=True,
        ).order_by("-created_at", "-id").all()

        user_ids: set[int] = set()
        for log in log_rows:
            if log.from_salesman_id:
                user_ids.add(log.from_salesman_id)
            if log.to_salesman_id:
                user_ids.add(log.to_salesman_id)
            if log.operator_user_id:
                user_ids.add(log.operator_user_id)

        name_map: Dict[int, str] = {}
        if user_ids:
            for user in await User.filter(id__in=list(user_ids), tenant_id=tenant_id).all():
                name_map[user.id] = user.full_name or user.username

        items: List[CustomerPoolLogItem] = []
        for log in log_rows:
            items.append(
                CustomerPoolLogItem(
                    action=log.action,
                    from_salesman_id=log.from_salesman_id,
                    from_salesman_name=name_map.get(log.from_salesman_id) if log.from_salesman_id else None,
                    to_salesman_id=log.to_salesman_id,
                    to_salesman_name=name_map.get(log.to_salesman_id) if log.to_salesman_id else None,
                    operator_user_id=log.operator_user_id,
                    operator_name=name_map.get(log.operator_user_id),
                    reason=log.reason,
                    created_at=log.created_at,
                )
            )
        return CustomerPoolLogListEnvelope(items=items, total=len(items))

    @classmethod
    async def list_customers(
        cls,
        *,
        tenant_id: int,
        current_user: User,
        scope: str = "pool",
        skip: int = 0,
        limit: int = 20,
        keyword: Optional[str] = None,
        code: Optional[str] = None,
        name: Optional[str] = None,
        contact_person: Optional[str] = None,
        phone: Optional[str] = None,
        salesman_id: Optional[int] = None,
        pool_status: Optional[str] = None,
        last_follow_up_from: Optional[datetime] = None,
        last_follow_up_to: Optional[datetime] = None,
        recycle_from: Optional[datetime] = None,
        recycle_to: Optional[datetime] = None,
        assigned_from: Optional[datetime] = None,
        assigned_to: Optional[datetime] = None,
        created_start_date: Optional[str] = None,
        created_end_date: Optional[str] = None,
        updated_start_date: Optional[str] = None,
        updated_end_date: Optional[str] = None,
        order_by: Optional[str] = None,
    ) -> CustomerPoolListEnvelope:
        query = Customer.filter(tenant_id=tenant_id, deleted_at__isnull=True)

        normalized_scope = (scope or "pool").strip().lower()
        if normalized_scope == "mine":
            collab_ids = await list_collaborator_customer_ids(tenant_id, current_user.id)
            owned_clause = Q(salesman_id=current_user.id)
            if collab_ids:
                owned_clause |= Q(id__in=collab_ids)
            query = query.filter(pool_status="owned").filter(owned_clause)
        elif normalized_scope == "pool":
            query = query.filter(pool_status="pool")

        normalized_pool_status = (pool_status or "").strip().lower()
        if normalized_pool_status in ("pool", "owned"):
            query = query.filter(pool_status=normalized_pool_status)

        if salesman_id is not None:
            query = query.filter(salesman_id=salesman_id)

        query, primary_order, secondary_order = apply_customer_pool_list_filters(
            query,
            keyword=keyword,
            code=code,
            name=name,
            contact_person=contact_person,
            phone=phone,
            last_follow_up_from=last_follow_up_from,
            last_follow_up_to=last_follow_up_to,
            recycle_from=recycle_from,
            recycle_to=recycle_to,
            assigned_from=assigned_from,
            assigned_to=assigned_to,
            created_start_date=created_start_date,
            created_end_date=created_end_date,
            updated_start_date=updated_start_date,
            updated_end_date=updated_end_date,
            order_by=order_by,
        )

        query = await DataScopeService.apply(
            query,
            tenant_id=tenant_id,
            user=current_user,
            resource=RESOURCE_CUSTOMER_POOL,
        )

        total = await query.count()
        rows = await query.order_by(primary_order, secondary_order).offset(skip).limit(limit)
        collab_map = await cls._load_collaborators_map(tenant_id, [row.id for row in rows])
        items = [
            _to_customer_pool_item(r, collab_map.get(r.id, []))
            for r in rows
        ]
        return CustomerPoolListEnvelope(items=items, total=total)

    @classmethod
    async def claim_customer(
        cls,
        *,
        tenant_id: int,
        customer_id: int,
        current_user: User,
        body: Optional[CustomerPoolActionBody] = None,
    ) -> CustomerPoolItem:
        customer = await cls._load_customer(tenant_id, customer_id)
        if customer.pool_status == "owned":
            await DataScopeService.assert_row_visible(
                customer,
                tenant_id=tenant_id,
                user=current_user,
                resource="kuaizhizao:customer-pool",
            )
        rule = await cls._get_rule(tenant_id)

        await cls._assert_owned_capacity(tenant_id, current_user.id)

        if customer.salesman_id and customer.salesman_id != current_user.id and not rule.allow_claim_others:
            raise ValidationError("该客户已被他人持有，当前规则不允许领取")

        customer = await cls.apply_assign(
            tenant_id=tenant_id,
            customer=customer,
            target_user=current_user,
            operator=current_user,
            reason=body.reason if body else None,
            action="claim",
        )
        return _to_customer_pool_item(customer)

    @classmethod
    async def assign_customer(
        cls,
        *,
        tenant_id: int,
        customer_id: int,
        current_user: User,
        body: CustomerPoolAssignBody,
    ) -> CustomerPoolItem:
        customer = await cls._load_customer(tenant_id, customer_id)
        await DataScopeService.assert_row_visible(
            customer,
            tenant_id=tenant_id,
            user=current_user,
            resource="kuaizhizao:customer-pool",
        )
        target_user = await User.filter(id=body.salesman_id, tenant_id=tenant_id).first()
        if not target_user:
            raise ValidationError(f"目标业务员不存在: {body.salesman_id}")

        customer = await cls.apply_assign(
            tenant_id=tenant_id,
            customer=customer,
            target_user=target_user,
            operator=current_user,
            reason=body.reason,
            action="assign",
        )
        return _to_customer_pool_item(customer)

    @classmethod
    async def release_customer(
        cls,
        *,
        tenant_id: int,
        customer_id: int,
        current_user: User,
        body: Optional[CustomerPoolActionBody] = None,
    ) -> CustomerPoolItem:
        customer = await cls._load_customer(tenant_id, customer_id)
        await DataScopeService.assert_row_visible(
            customer,
            tenant_id=tenant_id,
            user=current_user,
            resource="kuaizhizao:customer-pool",
        )
        customer = await cls.apply_release(
            tenant_id=tenant_id,
            customer=customer,
            operator=current_user,
            reason=body.reason if body else None,
            action="release",
        )
        return _to_customer_pool_item(customer)

    @classmethod
    async def recycle_customer(
        cls,
        *,
        tenant_id: int,
        customer_id: int,
        current_user: User,
        body: Optional[CustomerPoolActionBody] = None,
    ) -> CustomerPoolItem:
        customer = await cls._load_customer(tenant_id, customer_id)
        await DataScopeService.assert_row_visible(
            customer,
            tenant_id=tenant_id,
            user=current_user,
            resource="kuaizhizao:customer-pool",
        )
        customer = await cls.apply_recycle(
            tenant_id=tenant_id,
            customer=customer,
            operator=current_user,
            reason=body.reason if body else None,
        )
        return _to_customer_pool_item(customer)

    @classmethod
    async def get_rule(
        cls,
        *,
        tenant_id: int,
    ) -> CustomerPoolRuleResponse:
        return CustomerPoolRuleResponse.model_validate(await cls._get_rule(tenant_id))

    @classmethod
    async def update_rule(
        cls,
        *,
        tenant_id: int,
        current_user: User,
        body: CustomerPoolRuleUpdateBody,
    ) -> CustomerPoolRuleResponse:
        rule = await cls._get_rule(tenant_id)
        dump = body.model_dump(exclude_unset=True)
        for key, value in dump.items():
            setattr(rule, key, value)
        rule.updated_by = current_user.id
        await rule.save()
        return CustomerPoolRuleResponse.model_validate(rule)

    @classmethod
    async def execute_recycle_job(cls) -> dict:
        now = timezone.now()
        scanned = 0
        recycled = 0

        rules = await CustomerPoolRule.filter(
            deleted_at__isnull=True,
            recycle_enabled=True,
        ).all()

        for rule in rules:
            rows = await Customer.filter(
                tenant_id=rule.tenant_id,
                deleted_at__isnull=True,
                pool_status="owned",
                recycle_at__isnull=False,
                recycle_at__lte=now,
            ).all()
            scanned += len(rows)
            for customer in rows:
                from_salesman = customer.salesman_id
                customer.salesman_id = None
                customer.salesman_name = None
                customer.pool_status = "pool"
                customer.assigned_at = None
                customer.recycle_at = None
                await customer.save()
                await cls._clear_collaborators(
                    tenant_id=rule.tenant_id,
                    customer=customer,
                    operator_user_id=0,
                    reason="auto recycle job",
                )
                await cls._write_log(
                    tenant_id=rule.tenant_id,
                    customer=customer,
                    action="recycle",
                    operator_user_id=0,
                    from_salesman_id=from_salesman,
                    to_salesman_id=None,
                    reason="auto recycle job",
                )
                recycled += 1

        return {
            "success": True,
            "scanned": scanned,
            "recycled": recycled,
            "timestamp": to_api_isoformat(now),
        }
