"""
客户池服务。
"""

from __future__ import annotations

from datetime import timedelta
from typing import Optional

from tortoise import timezone
from tortoise.expressions import Q

from apps.kuaizhizao.models.customer_pool_log import CustomerPoolLog
from apps.kuaizhizao.models.customer_pool_rule import CustomerPoolRule
from apps.kuaizhizao.schemas.customer_pool import (
    CustomerPoolActionBody,
    CustomerPoolAssignBody,
    CustomerPoolItem,
    CustomerPoolListEnvelope,
    CustomerPoolRuleResponse,
    CustomerPoolRuleUpdateBody,
)
from apps.master_data.models.customer import Customer
from core.services.authorization.data_scope_service import DataScopeService
from infra.exceptions.exceptions import NotFoundError, ValidationError
from infra.models.user import User


class CustomerPoolService:
    @staticmethod
    async def _get_rule(tenant_id: int) -> CustomerPoolRule:
        rule = await CustomerPoolRule.filter(
            tenant_id=tenant_id,
            deleted_at__isnull=True,
        ).first()
        if rule:
            return rule
        return await CustomerPoolRule.create(tenant_id=tenant_id)

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
        customer.recycle_at = await cls._calc_recycle_at(
            tenant_id,
            assigned_at=now,
            last_follow_up_at=customer.last_follow_up_at,
        )
        await customer.save()

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
        await customer.save()

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
        await customer.save()

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
    ) -> CustomerPoolListEnvelope:
        query = Customer.filter(tenant_id=tenant_id, deleted_at__isnull=True)

        normalized_scope = (scope or "pool").strip().lower()
        if normalized_scope == "mine":
            # 私有客户：仅当前用户持有的客户（owned + salesman_id=me）
            query = query.filter(pool_status="owned", salesman_id=current_user.id)
        elif normalized_scope == "all":
            if current_user.is_regular_user():
                # 全部客户：公共池 + 本人持有
                query = query.filter(
                    Q(pool_status="pool")
                    | Q(pool_status="owned", salesman_id=current_user.id)
                )
        else:
            # 公共客户：公海待领取
            query = query.filter(pool_status="pool")

        kw = (keyword or "").strip()
        if kw:
            query = query.filter(
                Q(code__icontains=kw)
                | Q(name__icontains=kw)
                | Q(short_name__icontains=kw)
                | Q(contact_person__icontains=kw)
                | Q(phone__icontains=kw)
            )

        total = await query.count()
        rows = await query.order_by("-updated_at", "-id").offset(skip).limit(limit)
        items = [CustomerPoolItem.model_validate(r) for r in rows]
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
        return CustomerPoolItem.model_validate(customer)

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
        return CustomerPoolItem.model_validate(customer)

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
        return CustomerPoolItem.model_validate(customer)

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
        return CustomerPoolItem.model_validate(customer)

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
            "timestamp": now.isoformat(),
        }
