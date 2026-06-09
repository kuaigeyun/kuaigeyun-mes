"""
客户跟进记录服务
"""

from __future__ import annotations

from datetime import datetime, timedelta
from typing import List, Optional, Tuple

from tortoise.models import Q
from tortoise.transactions import in_transaction

from apps.kuaizhizao.models.customer_follow_up import CustomerFollowUp
from apps.kuaizhizao.models.customer_pool_rule import CustomerPoolRule
from apps.kuaizhizao.models.quotation import Quotation
from apps.kuaizhizao.models.sales_order import SalesOrder
from apps.kuaizhizao.schemas.customer_follow_up import (
    CustomerFollowUpCreate,
    CustomerFollowUpUpdate,
    CustomerFollowUpResponse,
    CustomerFollowUpListResponse,
    CustomerFollowUpListEnvelope,
)
from apps.kuaizhizao.schemas.sales_opportunity import SalesOpportunityEnsure
from apps.kuaizhizao.services.sales_opportunity_service import SalesOpportunityService
from apps.master_data.models.customer import Customer
from core.services.authorization.data_scope_service import DataScopeService
from infra.exceptions.exceptions import NotFoundError, ValidationError
from infra.models.user import User

RESOURCE_CUSTOMER_FOLLOW_UP = "kuaizhizao:customer-follow-up"
RESOURCE_CUSTOMER_FOLLOW_UP_CUSTOMER = "kuaizhizao:customer-follow-up-customer"


class CustomerFollowUpService:
    """客户跟进业务逻辑"""

    _opportunity_service = SalesOpportunityService()

    @classmethod
    async def _resolve_opportunity_id(
        cls,
        tenant_id: int,
        customer_id: int,
        current_user: User,
        *,
        opportunity_id: Optional[int],
        quotation_id: Optional[int],
        sales_order_id: Optional[int],
    ) -> Optional[int]:
        if opportunity_id is not None:
            await cls._opportunity_service.load_for_customer(
                tenant_id, opportunity_id, customer_id, current_user
            )
            return opportunity_id

        if quotation_id is None and sales_order_id is None:
            return None

        ensured = await cls._opportunity_service.ensure(
            tenant_id,
            SalesOpportunityEnsure(
                customer_id=customer_id,
                quotation_id=quotation_id,
                sales_order_id=sales_order_id,
            ),
            current_user,
        )
        return ensured.id

    @classmethod
    async def _apply_opportunity_stage(
        cls,
        tenant_id: int,
        customer_id: int,
        opportunity_id: int,
        current_user: User,
        *,
        stage_code_after: Optional[str],
        occurred_at: datetime,
        next_follow_up_at: Optional[datetime],
    ) -> tuple[Optional[str], Optional[str]]:
        opp = await cls._opportunity_service.load_for_customer(
            tenant_id, opportunity_id, customer_id, current_user
        )
        if stage_code_after:
            return await cls._opportunity_service.apply_stage_change(
                opp,
                stage_code_after,
                occurred_at=occurred_at,
                next_follow_up_at=next_follow_up_at,
                updated_by=current_user.id,
            )
        await cls._opportunity_service.touch_follow_up_times(
            opp,
            occurred_at=occurred_at,
            next_follow_up_at=next_follow_up_at,
            updated_by=current_user.id,
        )
        return None, None

    @staticmethod
    async def _load_customer(
        tenant_id: int,
        customer_id: int,
        current_user: Optional[User],
    ) -> Customer:
        customer = await Customer.filter(
            id=customer_id,
            tenant_id=tenant_id,
            deleted_at__isnull=True,
        ).first()
        if not customer:
            raise NotFoundError(f"客户不存在: {customer_id}")
        if current_user:
            await DataScopeService.assert_row_visible(
                customer,
                tenant_id=tenant_id,
                user=current_user,
                resource=RESOURCE_CUSTOMER_FOLLOW_UP_CUSTOMER,
            )
        return customer

    @staticmethod
    async def _apply_list_scope(query, tenant_id: int, current_user: Optional[User]):
        if not current_user:
            return query
        return await DataScopeService.apply(
            query,
            tenant_id=tenant_id,
            user=current_user,
            resource=RESOURCE_CUSTOMER_FOLLOW_UP,
        )

    @staticmethod
    async def _resolve_quotation(
        tenant_id: int,
        customer_id: int,
        quotation_id: Optional[int],
    ) -> Tuple[Optional[int], Optional[str]]:
        if quotation_id is None:
            return None, None
        q = await Quotation.filter(
            id=quotation_id,
            tenant_id=tenant_id,
        ).first()
        if not q:
            raise ValidationError(f"报价单不存在: {quotation_id}")
        if q.customer_id != customer_id:
            raise ValidationError("报价单不属于所选客户")
        return q.id, q.quotation_code

    @staticmethod
    async def _resolve_sales_order(
        tenant_id: int,
        customer_id: int,
        sales_order_id: Optional[int],
    ) -> Tuple[Optional[int], Optional[str]]:
        if sales_order_id is None:
            return None, None
        so = await SalesOrder.filter(
            id=sales_order_id,
            tenant_id=tenant_id,
        ).first()
        if not so:
            raise ValidationError(f"销售订单不存在: {sales_order_id}")
        if so.customer_id != customer_id:
            raise ValidationError("销售订单不属于所选客户")
        return so.id, so.order_code

    @staticmethod
    async def _attach_creator_names(items: List[CustomerFollowUp]) -> None:
        """为响应填充 created_by_name（批量查用户）"""
        user_ids = {i.created_by for i in items if i.created_by}
        if not user_ids:
            return
        from infra.models.user import User as UserModel

        users = await UserModel.filter(id__in=list(user_ids))
        id_to_name = {u.id: (u.full_name or u.username) for u in users}
        for i in items:
            if i.created_by:
                setattr(i, "_creator_name", id_to_name.get(i.created_by))

    @staticmethod
    async def _touch_customer_follow_up_time(tenant_id: int, customer: Customer, occurred_at: datetime) -> None:
        customer.last_follow_up_at = occurred_at
        rule = await CustomerPoolRule.filter(
            tenant_id=tenant_id,
            deleted_at__isnull=True,
            recycle_enabled=True,
        ).first()
        if rule and customer.pool_status == "owned":
            customer.recycle_at = occurred_at + timedelta(days=rule.recycle_after_days)
        await customer.save(update_fields=["last_follow_up_at", "recycle_at", "updated_at"])

    @classmethod
    async def create(
        cls,
        tenant_id: int,
        data: CustomerFollowUpCreate,
        current_user: User,
    ) -> CustomerFollowUpResponse:
        customer = await cls._load_customer(tenant_id, data.customer_id, current_user)
        qid, qcode = await cls._resolve_quotation(tenant_id, customer.id, data.quotation_id)
        sid, scode = await cls._resolve_sales_order(tenant_id, customer.id, data.sales_order_id)

        async with in_transaction():
            opportunity_id = await cls._resolve_opportunity_id(
                tenant_id,
                customer.id,
                current_user,
                opportunity_id=data.opportunity_id,
                quotation_id=qid,
                sales_order_id=sid,
            )
            stage_before, stage_after = (None, None)
            if opportunity_id is not None:
                stage_before, stage_after = await cls._apply_opportunity_stage(
                    tenant_id,
                    customer.id,
                    opportunity_id,
                    current_user,
                    stage_code_after=data.stage_code_after,
                    occurred_at=data.occurred_at,
                    next_follow_up_at=data.next_follow_up_at,
                )

            row = await CustomerFollowUp.create(
                tenant_id=tenant_id,
                customer_id=customer.id,
                customer_name=customer.name,
                activity_type_code=data.activity_type_code,
                content=data.content,
                occurred_at=data.occurred_at,
                next_follow_up_at=data.next_follow_up_at,
                quotation_id=qid,
                quotation_code=qcode,
                sales_order_id=sid,
                sales_order_code=scode,
                opportunity_id=opportunity_id,
                stage_code_before=stage_before,
                stage_code_after=stage_after,
                created_by=current_user.id,
                updated_by=current_user.id,
            )
            await cls._touch_customer_follow_up_time(tenant_id, customer, data.occurred_at)

        await cls._attach_creator_names([row])
        resp = CustomerFollowUpResponse.model_validate(row)
        resp.created_by_name = getattr(row, "_creator_name", None)
        return resp

    @classmethod
    async def update(
        cls,
        tenant_id: int,
        follow_id: int,
        data: CustomerFollowUpUpdate,
        current_user: User,
    ) -> CustomerFollowUpResponse:
        row = await CustomerFollowUp.filter(
            id=follow_id,
            tenant_id=tenant_id,
            deleted_at__isnull=True,
        ).first()
        if not row:
            raise NotFoundError(f"跟进记录不存在: {follow_id}")

        customer = await cls._load_customer(tenant_id, row.customer_id, current_user)

        dump = data.model_dump(exclude_unset=True)
        stage_code_after = dump.pop("stage_code_after", None)
        opportunity_id_in = dump.pop("opportunity_id", None)

        if "quotation_id" in dump:
            qid = dump["quotation_id"]
            if qid is None:
                dump["quotation_code"] = None
            else:
                rqid, rqcode = await cls._resolve_quotation(tenant_id, customer.id, qid)
                dump["quotation_id"] = rqid
                dump["quotation_code"] = rqcode
        if "sales_order_id" in dump:
            sid = dump["sales_order_id"]
            if sid is None:
                dump["sales_order_code"] = None
            else:
                rsid, rscode = await cls._resolve_sales_order(tenant_id, customer.id, sid)
                dump["sales_order_id"] = rsid
                dump["sales_order_code"] = rscode

        dump["updated_by"] = current_user.id

        occurred_at = dump.get("occurred_at", row.occurred_at)
        next_follow_up_at = dump.get("next_follow_up_at", row.next_follow_up_at) if "next_follow_up_at" in dump else row.next_follow_up_at
        opportunity_id = opportunity_id_in if opportunity_id_in is not None else row.opportunity_id

        async with in_transaction():
            final_quotation_id = dump.get("quotation_id", row.quotation_id)
            final_sales_order_id = dump.get("sales_order_id", row.sales_order_id)

            if opportunity_id_in is not None:
                opportunity_id = await cls._resolve_opportunity_id(
                    tenant_id,
                    customer.id,
                    current_user,
                    opportunity_id=opportunity_id_in,
                    quotation_id=final_quotation_id,
                    sales_order_id=final_sales_order_id,
                )
                dump["opportunity_id"] = opportunity_id
            elif final_quotation_id is not None or final_sales_order_id is not None:
                opportunity_id = await cls._resolve_opportunity_id(
                    tenant_id,
                    customer.id,
                    current_user,
                    opportunity_id=opportunity_id,
                    quotation_id=final_quotation_id,
                    sales_order_id=final_sales_order_id,
                )
                dump["opportunity_id"] = opportunity_id
            else:
                opportunity_id = None
                dump["opportunity_id"] = None
                dump["stage_code_before"] = None
                dump["stage_code_after"] = None

            if opportunity_id is not None:
                stage_before, stage_after = await cls._apply_opportunity_stage(
                    tenant_id,
                    customer.id,
                    opportunity_id,
                    current_user,
                    stage_code_after=stage_code_after,
                    occurred_at=occurred_at,
                    next_follow_up_at=next_follow_up_at,
                )
                if stage_before is not None or stage_after is not None:
                    dump["stage_code_before"] = stage_before
                    dump["stage_code_after"] = stage_after

            await CustomerFollowUp.filter(id=follow_id, tenant_id=tenant_id).update(**dump)
            await cls._touch_customer_follow_up_time(tenant_id, customer, occurred_at)

        row = await CustomerFollowUp.get(id=follow_id, tenant_id=tenant_id)
        await cls._attach_creator_names([row])
        resp = CustomerFollowUpResponse.model_validate(row)
        resp.created_by_name = getattr(row, "_creator_name", None)
        return resp

    @classmethod
    async def delete(cls, tenant_id: int, follow_id: int, current_user: User) -> bool:
        row = await CustomerFollowUp.filter(
            id=follow_id,
            tenant_id=tenant_id,
            deleted_at__isnull=True,
        ).first()
        if not row:
            raise NotFoundError(f"跟进记录不存在: {follow_id}")
        await cls._load_customer(tenant_id, row.customer_id, current_user)
        await CustomerFollowUp.filter(id=follow_id, tenant_id=tenant_id).update(
            deleted_at=datetime.now(),
            updated_by=current_user.id,
        )
        return True

    @classmethod
    async def get(
        cls,
        tenant_id: int,
        follow_id: int,
        current_user: Optional[User],
    ) -> CustomerFollowUpResponse:
        row = await CustomerFollowUp.filter(
            id=follow_id,
            tenant_id=tenant_id,
            deleted_at__isnull=True,
        ).first()
        if not row:
            raise NotFoundError(f"跟进记录不存在: {follow_id}")
        if current_user and not await DataScopeService.row_visible(
            row,
            tenant_id=tenant_id,
            user=current_user,
            resource=RESOURCE_CUSTOMER_FOLLOW_UP,
        ):
            raise NotFoundError(f"跟进记录不存在: {follow_id}")
        await cls._load_customer(tenant_id, row.customer_id, current_user)
        await cls._attach_creator_names([row])
        resp = CustomerFollowUpResponse.model_validate(row)
        resp.created_by_name = getattr(row, "_creator_name", None)
        return resp

    @classmethod
    def _filter_query(
        cls,
        tenant_id: int,
        customer_id: Optional[int],
        keyword: Optional[str],
        occurred_from: Optional[datetime],
        occurred_to: Optional[datetime],
        pending_only: bool,
    ):
        query = CustomerFollowUp.filter(tenant_id=tenant_id, deleted_at__isnull=True)
        if customer_id is not None:
            query = query.filter(customer_id=customer_id)
        if occurred_from is not None:
            query = query.filter(occurred_at__gte=occurred_from)
        if occurred_to is not None:
            query = query.filter(occurred_at__lte=occurred_to)
        if pending_only:
            now = datetime.now()
            query = query.filter(next_follow_up_at__isnull=False).filter(next_follow_up_at__lte=now)
        if keyword:
            kw = keyword.strip()
            if kw:
                query = query.filter(
                    Q(customer_name__icontains=kw)
                    | Q(content__icontains=kw)
                    | Q(quotation_code__icontains=kw)
                    | Q(sales_order_code__icontains=kw)
                )
        return query

    @classmethod
    async def list_follow_ups(
        cls,
        tenant_id: int,
        skip: int = 0,
        limit: int = 50,
        customer_id: Optional[int] = None,
        keyword: Optional[str] = None,
        occurred_from: Optional[datetime] = None,
        occurred_to: Optional[datetime] = None,
        pending_only: bool = False,
        current_user: Optional[User] = None,
    ) -> CustomerFollowUpListEnvelope:
        query = cls._filter_query(
            tenant_id,
            customer_id,
            keyword,
            occurred_from,
            occurred_to,
            pending_only,
        )
        query = await cls._apply_list_scope(query, tenant_id, current_user)
        total = await query.count()
        if pending_only:
            # 已到期的回访队列：按计划时间升序，最早到期优先
            rows = await query.offset(skip).limit(limit).order_by("next_follow_up_at", "id")
        else:
            rows = await query.offset(skip).limit(limit).order_by("-occurred_at", "-id")
        await cls._attach_creator_names(rows)
        out: List[CustomerFollowUpListResponse] = []
        for row in rows:
            resp = CustomerFollowUpListResponse.model_validate(row)
            resp.created_by_name = getattr(row, "_creator_name", None)
            out.append(resp)
        return CustomerFollowUpListEnvelope(items=out, total=total)
