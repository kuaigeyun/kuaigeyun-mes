"""
客户跟进记录服务
"""

from __future__ import annotations

from collections import Counter
from datetime import datetime, timedelta
from typing import Dict, List, Optional, Tuple

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
    CustomerFollowUpDashboardSnapshot,
    SalesTeamMemberStat,
    SalesTeamSnapshot,
)
from apps.kuaizhizao.services.customer_pool_list_core import (
    customer_pool_effective_public_q,
    customer_pool_mine_scope_q,
)
from apps.kuaizhizao.services.customer_pool_service import list_collaborator_customer_ids
from apps.kuaizhizao.schemas.sales_opportunity import SalesOpportunityEnsure
from apps.kuaizhizao.services.sales_opportunity_service import SalesOpportunityService
from apps.common.audit_actor import apply_create_audit, apply_update_audit
from apps.master_data.models.customer import Customer
from core.services.authorization.data_scope_service import DataScopeService
from core.services.user.user_display_service import UserDisplayService
from infra.exceptions.exceptions import NotFoundError, ValidationError
from infra.models.user import User
from apps.kuaizhizao.utils.customer_follow_up_plan import follow_up_plan_flags
from core.utils.timezone_utils import resolve_business_datetime, to_site_date

CUSTOMER_FOLLOW_UP_SORTABLE_FIELDS = frozenset({
    "customer_name",
    "activity_type_code",
    "content",
    "occurred_at",
    "next_follow_up_at",
    "quotation_code",
    "sales_order_code",
    "created_at",
    "updated_at",
})

RESOURCE_CUSTOMER_FOLLOW_UP = "kuaizhizao:customer-follow-up"
RESOURCE_CUSTOMER_FOLLOW_UP_CUSTOMER = "kuaizhizao:customer-follow-up-customer"
CUSTOMER_PROFILE_FIELDS = (
    "country_code",
    "region_text",
    "project_description",
    "intent_material_name",
)
_CUSTOMER_PROFILE_LIMITS = {
    "country_code": (50, "国家"),
    "region_text": (100, "地区"),
    "intent_material_name": (200, "包装材料名称"),
}


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
            visible = await DataScopeService.row_visible(
                customer,
                tenant_id=tenant_id,
                user=current_user,
                resource=RESOURCE_CUSTOMER_FOLLOW_UP_CUSTOMER,
            )
            if not visible:
                # 与跟进表单客户下拉同一 scope；勿用笼统「权限不足」误导为功能码缺失
                raise ValidationError(
                    "仅可对本人负责、协作或未归属（公海）的客户添加跟进；他人已归属客户不可跟进"
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
    async def _touch_customer_follow_up_time(
        tenant_id: int,
        customer: Customer,
        occurred_at: datetime,
        extra_fields: Optional[List[str]] = None,
    ) -> None:
        customer.last_follow_up_at = occurred_at
        if getattr(customer, "follow_status", None) != "followed":
            customer.follow_status = "followed"
        rule = await CustomerPoolRule.filter(
            tenant_id=tenant_id,
            deleted_at__isnull=True,
            recycle_enabled=True,
        ).first()
        if rule and customer.pool_status == "owned":
            customer.recycle_at = occurred_at + timedelta(days=rule.recycle_after_days)
        update_fields = ["last_follow_up_at", "recycle_at", "follow_status", "updated_at"]
        for name in extra_fields or []:
            if name not in update_fields:
                update_fields.append(name)
        await customer.save(update_fields=update_fields)

    @staticmethod
    def _apply_customer_profile(customer: Customer, data: CustomerFollowUpCreate | CustomerFollowUpUpdate) -> List[str]:
        """跟进提交里带上的国家、地区、项目说明、包装材料写回客户。未提交的字段不动。"""
        sent = data.model_dump(exclude_unset=True)
        changed: List[str] = []
        for name in CUSTOMER_PROFILE_FIELDS:
            if name not in sent:
                continue
            raw = sent[name]
            text = str(raw).strip() if raw is not None else ""
            limit = _CUSTOMER_PROFILE_LIMITS.get(name)
            if limit is not None and len(text) > limit[0]:
                raise ValidationError(f"{limit[1]}不能超过 {limit[0]} 个字")
            setattr(customer, name, text or None)
            changed.append(name)
        return changed

    @staticmethod
    async def _owner_customer_ids(
        tenant_id: int,
        user_id: int,
        market_scope: Optional[str] = None,
    ) -> List[int]:
        """可跟进客户：本人负责、协作、无明确归属（公海）。"""
        collab_ids = await list_collaborator_customer_ids(tenant_id, user_id)
        query = Customer.filter(tenant_id=tenant_id, deleted_at__isnull=True).filter(
            customer_pool_mine_scope_q(
                current_user_id=user_id,
                collaborator_customer_ids=collab_ids,
            )
            | customer_pool_effective_public_q()
        )
        scope = str(market_scope or "").strip().lower()
        if scope:
            query = query.filter(market_scope=scope)
        ids = await query.values_list("id", flat=True)
        return [int(cid) for cid in ids]

    @staticmethod
    def _normalize_attachment_uuids(raw: Optional[list]) -> list:
        if not raw:
            return []
        out: list = []
        for item in raw:
            uid = str(item or "").strip()
            if uid and uid not in out:
                out.append(uid)
        return out

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

            row_data = {
                "tenant_id": tenant_id,
                "customer_id": customer.id,
                "customer_name": customer.name,
                "activity_type_code": data.activity_type_code,
                "content": data.content,
                "occurred_at": data.occurred_at,
                "next_follow_up_at": data.next_follow_up_at,
                "quotation_id": qid,
                "quotation_code": qcode,
                "sales_order_id": sid,
                "sales_order_code": scode,
                "opportunity_id": opportunity_id,
                "stage_code_before": stage_before,
                "stage_code_after": stage_after,
                "attachment_uuids": cls._normalize_attachment_uuids(data.attachment_uuids),
            }
            apply_create_audit(row_data, current_user)
            row = await CustomerFollowUp.create(**row_data)
            profile_fields = cls._apply_customer_profile(customer, data)
            await cls._touch_customer_follow_up_time(
                tenant_id,
                customer,
                data.occurred_at,
                extra_fields=profile_fields,
            )

        count_map = await cls._customer_follow_up_counts(tenant_id, [customer.id])
        return await cls._to_list_item(
            row,
            follow_up_count=count_map.get(int(customer.id), 0),
        )

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
        profile_fields = cls._apply_customer_profile(customer, data)
        for name in CUSTOMER_PROFILE_FIELDS:
            dump.pop(name, None)
        stage_code_after = dump.pop("stage_code_after", None)
        opportunity_id_in = dump.pop("opportunity_id", None)
        if "attachment_uuids" in dump:
            dump["attachment_uuids"] = cls._normalize_attachment_uuids(dump.get("attachment_uuids"))

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

        apply_update_audit(dump, current_user)

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
            await cls._touch_customer_follow_up_time(
                tenant_id,
                customer,
                occurred_at,
                extra_fields=profile_fields,
            )

        row = await CustomerFollowUp.get(id=follow_id, tenant_id=tenant_id)
        count_map = await cls._customer_follow_up_counts(tenant_id, [row.customer_id])
        return await cls._to_list_item(
            row,
            follow_up_count=count_map.get(int(row.customer_id), 0),
        )

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
        delete_audit: dict = {}
        apply_update_audit(delete_audit, current_user)
        await CustomerFollowUp.filter(id=follow_id, tenant_id=tenant_id).update(
            deleted_at=resolve_business_datetime(),
            **delete_audit,
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
        count_map = await cls._customer_follow_up_counts(tenant_id, [row.customer_id])
        return await cls._to_list_item(
            row,
            follow_up_count=count_map.get(int(row.customer_id), 0),
        )

    @classmethod
    def _filter_query(
        cls,
        tenant_id: int,
        customer_id: Optional[int],
        activity_type_code: Optional[str],
        keyword: Optional[str],
        quotation_code: Optional[str],
        sales_order_code: Optional[str],
        occurred_from: Optional[datetime],
        occurred_to: Optional[datetime],
        pending_only: bool,
    ):
        query = CustomerFollowUp.filter(tenant_id=tenant_id, deleted_at__isnull=True)
        if customer_id is not None:
            query = query.filter(customer_id=customer_id)
        if activity_type_code and str(activity_type_code).strip():
            query = query.filter(activity_type_code=str(activity_type_code).strip())
        if quotation_code and str(quotation_code).strip():
            query = query.filter(quotation_code__icontains=str(quotation_code).strip())
        if sales_order_code and str(sales_order_code).strip():
            query = query.filter(sales_order_code__icontains=str(sales_order_code).strip())
        if occurred_from is not None:
            query = query.filter(occurred_at__gte=occurred_from)
        if occurred_to is not None:
            query = query.filter(occurred_at__lte=occurred_to)
        if pending_only:
            now = resolve_business_datetime()
            query = query.filter(next_follow_up_at__isnull=False).filter(next_follow_up_at__lte=now)
        if keyword:
            kw = keyword.strip()
            if kw:
                query = query.filter(
                    Q(customer_name__icontains=kw)
                    | Q(content__icontains=kw)
                    | Q(quotation_code__icontains=kw)
                    | Q(sales_order_code__icontains=kw)
                    | Q(activity_type_code__icontains=kw)
                )
        return query

    @staticmethod
    async def _restrict_market_scope(query, tenant_id: int, market_scope: Optional[str]):
        """按客户市场范围收窄跟进；无匹配客户时返回 None（调用方出空结果）。"""
        scope = str(market_scope or "").strip().lower()
        if not scope:
            return query
        customer_filter = Customer.filter(tenant_id=tenant_id, deleted_at__isnull=True)
        if scope == "crm":
            customer_filter = customer_filter.filter(market_scope__in=["export", "domestic"])
        else:
            customer_filter = customer_filter.filter(market_scope=scope)
        ids = await customer_filter.values_list("id", flat=True)
        id_list = list(ids)
        if not id_list:
            return None
        return query.filter(customer_id__in=id_list)

    @classmethod
    async def _restrict_customer_ids(
        cls,
        query,
        tenant_id: int,
        *,
        market_scope: Optional[str] = None,
        salesman_id: Optional[int] = None,
        owned_by_user_id: Optional[int] = None,
    ):
        """按业务员或「仅本人名下」收窄跟进。无匹配客户时返回 None。"""
        if salesman_id is None and owned_by_user_id is None:
            return query
        allowed: Optional[set[int]] = None
        if owned_by_user_id is not None:
            allowed = set(await cls._owner_customer_ids(tenant_id, owned_by_user_id, market_scope))
        if salesman_id is not None:
            sales_query = Customer.filter(
                tenant_id=tenant_id,
                deleted_at__isnull=True,
                salesman_id=salesman_id,
            )
            scope = str(market_scope or "").strip().lower()
            if scope:
                sales_query = sales_query.filter(market_scope=scope)
            sales_ids = {int(cid) for cid in await sales_query.values_list("id", flat=True)}
            allowed = sales_ids if allowed is None else allowed & sales_ids
        if not allowed:
            return None
        return query.filter(customer_id__in=list(allowed))

    @classmethod
    async def sales_team_snapshot(
        cls,
        tenant_id: int,
        current_user: User,
        *,
        market_scope: str = "export",
    ) -> SalesTeamSnapshot:
        """按归属业务员汇总客户数、跟进条数、未跟进和未联系。"""
        scope = str(market_scope or "").strip().lower()
        customer_query = Customer.filter(
            tenant_id=tenant_id,
            deleted_at__isnull=True,
            salesman_id__isnull=False,
        )
        if scope == "crm":
            customer_query = customer_query.filter(market_scope__in=["export", "domestic"])
        elif scope:
            customer_query = customer_query.filter(market_scope=scope)
        customer_query = await DataScopeService.apply(
            customer_query,
            tenant_id=tenant_id,
            user=current_user,
            resource="kuaizhizao:customer-pool",
        )
        customers = await customer_query.all()
        rule = await CustomerPoolRule.filter(
            tenant_id=tenant_id,
            deleted_at__isnull=True,
        ).first()
        inactive_alert_days = 7 if rule is None else max(1, min(int(rule.inactive_alert_days), 365))
        now_date = to_site_date(resolve_business_datetime())
        count_map = await cls._customer_follow_up_counts(tenant_id, [int(row.id) for row in customers])
        labels = await UserDisplayService.build_label_map(
            tenant_id=tenant_id,
            user_ids={int(row.salesman_id) for row in customers if row.salesman_id},
        )
        grouped: Dict[int, List[Customer]] = {}
        for row in customers:
            sid = int(row.salesman_id)
            grouped.setdefault(sid, []).append(row)
        members: List[SalesTeamMemberStat] = []
        for sid, rows in grouped.items():
            level_counter: Counter = Counter()
            pending = 0
            inactive = 0
            follow_total = 0
            for cust in rows:
                follow_total += int(count_map.get(int(cust.id), 0))
                status = str(getattr(cust, "follow_status", None) or "pending").strip().lower()
                if status != "followed":
                    pending += 1
                last_fu = getattr(cust, "last_follow_up_at", None)
                last_day = to_site_date(last_fu) if last_fu is not None else None
                if last_day is None or (
                    now_date is not None and (now_date - last_day).days >= inactive_alert_days
                ):
                    inactive += 1
                level = str(getattr(cust, "customer_level_code", None) or "").strip() or "_unset"
                level_counter[level] += 1
            name = labels.get(sid) or str(sid)
            members.append(
                SalesTeamMemberStat(
                    salesman_id=sid,
                    salesman_name=name,
                    customer_count=len(rows),
                    follow_up_count=follow_total,
                    pending_count=pending,
                    inactive_count=inactive,
                    level_counts=dict(level_counter),
                )
            )
        members.sort(key=lambda item: (-item.follow_up_count, item.salesman_name, item.salesman_id))
        return SalesTeamSnapshot(inactive_alert_days=inactive_alert_days, members=members)

    @classmethod
    def _resolve_list_order_by(
        cls,
        order_by: Optional[str],
        pending_only: bool,
    ) -> tuple[str, str]:
        if order_by:
            field = order_by.lstrip("-")
            if field in CUSTOMER_FOLLOW_UP_SORTABLE_FIELDS:
                descending = order_by.startswith("-")
                primary = f"-{field}" if descending else field
                secondary = "-id" if descending else "id"
                return primary, secondary
        if pending_only:
            return "next_follow_up_at", "id"
        return "-occurred_at", "-id"

    @staticmethod
    async def _customer_follow_up_counts(
        tenant_id: int,
        customer_ids: List[int],
    ) -> Dict[int, int]:
        """按客户汇总未删除跟进次数（列表展示用，禁止读侧再 join 用户表）。"""
        unique_ids = sorted({int(cid) for cid in customer_ids if cid is not None})
        if not unique_ids:
            return {}
        id_rows = await CustomerFollowUp.filter(
            tenant_id=tenant_id,
            deleted_at__isnull=True,
            customer_id__in=unique_ids,
        ).values_list("customer_id", flat=True)
        return {int(cid): int(cnt) for cid, cnt in Counter(id_rows).items()}

    @classmethod
    async def _to_list_item(
        cls,
        row: CustomerFollowUp,
        *,
        follow_up_count: int,
    ) -> CustomerFollowUpListResponse:
        item = CustomerFollowUpListResponse.model_validate(row)
        item.follow_up_count = int(follow_up_count)
        return item

    @classmethod
    async def list_follow_ups(
        cls,
        tenant_id: int,
        skip: int = 0,
        limit: int = 50,
        customer_id: Optional[int] = None,
        activity_type_code: Optional[str] = None,
        keyword: Optional[str] = None,
        quotation_code: Optional[str] = None,
        sales_order_code: Optional[str] = None,
        occurred_from: Optional[datetime] = None,
        occurred_to: Optional[datetime] = None,
        pending_only: bool = False,
        order_by: Optional[str] = None,
        current_user: Optional[User] = None,
        market_scope: Optional[str] = None,
        salesman_id: Optional[int] = None,
        owned_by_user_id: Optional[int] = None,
    ) -> CustomerFollowUpListEnvelope:
        query = cls._filter_query(
            tenant_id,
            customer_id,
            activity_type_code,
            keyword,
            quotation_code,
            sales_order_code,
            occurred_from,
            occurred_to,
            pending_only,
        )
        query = await cls._restrict_market_scope(query, tenant_id, market_scope)
        if query is None:
            return CustomerFollowUpListEnvelope(items=[], total=0)
        query = await cls._restrict_customer_ids(
            query,
            tenant_id,
            market_scope=market_scope,
            salesman_id=salesman_id,
            owned_by_user_id=owned_by_user_id,
        )
        if query is None:
            return CustomerFollowUpListEnvelope(items=[], total=0)
        query = await cls._apply_list_scope(query, tenant_id, current_user)
        total = await query.count()
        primary_order, secondary_order = cls._resolve_list_order_by(order_by, pending_only)
        rows = await query.offset(skip).limit(limit).order_by(primary_order, secondary_order)
        count_map = await cls._customer_follow_up_counts(
            tenant_id,
            [row.customer_id for row in rows],
        )
        out: List[CustomerFollowUpListResponse] = [
            await cls._to_list_item(
                row,
                follow_up_count=count_map.get(int(row.customer_id), 0),
            )
            for row in rows
        ]
        return CustomerFollowUpListEnvelope(items=out, total=total)

    @classmethod
    async def dashboard_follow_up_snapshot(
        cls,
        tenant_id: int,
        current_user: Optional[User],
        *,
        limit: int = 5,
        market_scope: Optional[str] = None,
        owned_by_user_id: Optional[int] = None,
    ) -> CustomerFollowUpDashboardSnapshot:
        """
        销售中心待跟进 KPI：按客户「最新一条跟进」的计划下次跟进时间统计。

        - 待跟进：计划跟进站点日历日 <= 今日
        - 已逾期：计划跟进时刻 <= 当前业务时刻（与列表「逾期」徽章一致）
        """
        now = resolve_business_datetime()
        now_date = to_site_date(now)

        query = CustomerFollowUp.filter(tenant_id=tenant_id, deleted_at__isnull=True)
        query = await cls._restrict_market_scope(query, tenant_id, market_scope)
        if query is None:
            return CustomerFollowUpDashboardSnapshot()
        query = await cls._restrict_customer_ids(
            query,
            tenant_id,
            market_scope=market_scope,
            owned_by_user_id=owned_by_user_id,
        )
        if query is None:
            return CustomerFollowUpDashboardSnapshot()
        query = await cls._apply_list_scope(query, tenant_id, current_user)
        rows = await query.order_by("customer_id", "-occurred_at", "-id")

        latest_by_customer: Dict[int, CustomerFollowUp] = {}
        for row in rows:
            customer_id = int(row.customer_id)
            if customer_id not in latest_by_customer:
                latest_by_customer[customer_id] = row

        pending_rows: List[CustomerFollowUp] = []
        pending_customers = 0
        overdue_customers = 0
        for row in latest_by_customer.values():
            next_at = row.next_follow_up_at
            is_pending, is_overdue = follow_up_plan_flags(
                next_at,
                now=now,
                now_date=now_date,
            )
            if is_pending:
                pending_customers += 1
                pending_rows.append(row)
            if is_overdue:
                overdue_customers += 1

        pending_rows.sort(
            key=lambda row: (
                row.next_follow_up_at or now,
                int(row.id),
            ),
        )
        preview_rows = pending_rows[: max(int(limit), 0)]
        count_map = await cls._customer_follow_up_counts(
            tenant_id,
            [row.customer_id for row in preview_rows],
        )
        items = [
            await cls._to_list_item(
                row,
                follow_up_count=count_map.get(int(row.customer_id), 0),
            )
            for row in preview_rows
        ]
        follow_up_records_total = len(rows)

        customer_query = Customer.filter(tenant_id=tenant_id, deleted_at__isnull=True)
        scope_token = str(market_scope or "").strip().lower()
        if scope_token == "crm":
            customer_query = customer_query.filter(market_scope__in=["export", "domestic"])
        elif scope_token:
            customer_query = customer_query.filter(market_scope=scope_token)
        if owned_by_user_id is not None:
            owner_ids = await cls._owner_customer_ids(tenant_id, owned_by_user_id, market_scope)
            if not owner_ids:
                customers = []
            else:
                customer_query = customer_query.filter(id__in=owner_ids)
                if current_user:
                    customer_query = await DataScopeService.apply(
                        customer_query,
                        tenant_id=tenant_id,
                        user=current_user,
                        resource="kuaizhizao:customer-pool",
                    )
                customers = await customer_query.all()
        else:
            if current_user:
                customer_query = await DataScopeService.apply(
                    customer_query,
                    tenant_id=tenant_id,
                    user=current_user,
                    resource="kuaizhizao:customer-pool",
                )
            customers = await customer_query.all()
        rule = await CustomerPoolRule.filter(
            tenant_id=tenant_id,
            deleted_at__isnull=True,
        ).first()
        inactive_alert_days = 7 if rule is None else max(1, min(int(rule.inactive_alert_days), 365))
        inactive_customers = 0
        follow_status_pending = 0
        follow_status_followed = 0
        level_counter: Counter = Counter()
        for cust in customers:
            last_fu = getattr(cust, "last_follow_up_at", None)
            last_day = to_site_date(last_fu) if last_fu is not None else None
            if last_day is None or (
                now_date is not None and (now_date - last_day).days >= inactive_alert_days
            ):
                inactive_customers += 1
            status = str(getattr(cust, "follow_status", None) or "pending").strip().lower()
            if status == "followed":
                follow_status_followed += 1
            else:
                follow_status_pending += 1
            level = str(getattr(cust, "customer_level_code", None) or "").strip() or "_unset"
            level_counter[level] += 1

        return CustomerFollowUpDashboardSnapshot(
            pending_customers=pending_customers,
            overdue_customers=overdue_customers,
            items=items,
            inactive_customers=inactive_customers,
            inactive_alert_days=inactive_alert_days,
            follow_status_pending=follow_status_pending,
            follow_status_followed=follow_status_followed,
            follow_up_records_total=follow_up_records_total,
            level_counts=dict(level_counter),
        )
