"""
销售商机服务
"""

from __future__ import annotations

from datetime import datetime
from typing import List, Optional, Tuple

from tortoise.transactions import in_transaction

from apps.kuaizhizao.models.quotation import Quotation
from apps.kuaizhizao.models.sales_opportunity import SalesOpportunity
from apps.kuaizhizao.models.sales_order import SalesOrder
from apps.kuaizhizao.schemas.sales_opportunity import (
    TERMINAL_STAGE_CODES,
    SalesOpportunityCreate,
    SalesOpportunityEnsure,
    SalesOpportunityListEnvelope,
    SalesOpportunityResponse,
    SalesOpportunityUpdate,
)
from apps.master_data.models.customer import Customer
from core.services.authorization.data_scope_service import DataScopeService
from infra.exceptions.exceptions import NotFoundError, ValidationError
from infra.models.user import User

RESOURCE_SALES_OPPORTUNITY = "kuaizhizao:sales-opportunity"
RESOURCE_SALES_OPPORTUNITY_CUSTOMER = "kuaizhizao:customer-follow-up-customer"


def _status_for_stage(stage_code: str) -> str:
    if stage_code == "WON":
        return "won"
    if stage_code == "LOST":
        return "lost"
    return "open"


class SalesOpportunityService:
    """销售商机业务逻辑"""

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
                resource=RESOURCE_SALES_OPPORTUNITY_CUSTOMER,
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
            resource=RESOURCE_SALES_OPPORTUNITY,
        )

    @staticmethod
    async def _resolve_quotation(
        tenant_id: int,
        customer_id: int,
        quotation_id: Optional[int],
    ) -> Tuple[Optional[int], Optional[str]]:
        if quotation_id is None:
            return None, None
        q = await Quotation.filter(id=quotation_id, tenant_id=tenant_id).first()
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
        so = await SalesOrder.filter(id=sales_order_id, tenant_id=tenant_id).first()
        if not so:
            raise ValidationError(f"销售订单不存在: {sales_order_id}")
        if so.customer_id != customer_id:
            raise ValidationError("销售订单不属于所选客户")
        return so.id, so.order_code

    @classmethod
    async def _get_open_opportunity(
        cls,
        tenant_id: int,
        customer_id: int,
        *,
        quotation_id: Optional[int] = None,
        sales_order_id: Optional[int] = None,
    ) -> Optional[SalesOpportunity]:
        query = SalesOpportunity.filter(
            tenant_id=tenant_id,
            customer_id=customer_id,
            status="open",
            deleted_at__isnull=True,
        )
        if quotation_id is not None:
            query = query.filter(quotation_id=quotation_id)
        elif sales_order_id is not None:
            query = query.filter(sales_order_id=sales_order_id)
        else:
            return None
        return await query.order_by("-id").first()

    @classmethod
    async def load_for_customer(
        cls,
        tenant_id: int,
        opportunity_id: int,
        customer_id: int,
        current_user: Optional[User],
    ) -> SalesOpportunity:
        await cls._load_customer(tenant_id, customer_id, current_user)
        opp = await SalesOpportunity.filter(
            id=opportunity_id,
            tenant_id=tenant_id,
            customer_id=customer_id,
            deleted_at__isnull=True,
        ).first()
        if not opp:
            raise ValidationError(f"商机不存在或不属于该客户: {opportunity_id}")
        return opp

    @classmethod
    async def apply_stage_change(
        cls,
        opp: SalesOpportunity,
        stage_code_after: str,
        *,
        occurred_at: datetime,
        next_follow_up_at: Optional[datetime],
        updated_by: int,
    ) -> Tuple[Optional[str], Optional[str]]:
        """更新商机阶段并回写跟进时间。返回 (stage_before, stage_after)。"""
        stage_before = opp.stage_code
        if stage_code_after == stage_before:
            opp.last_follow_up_at = occurred_at
            if next_follow_up_at is not None:
                opp.next_follow_up_at = next_follow_up_at
            opp.updated_by = updated_by
            await opp.save()
            return None, None

        if opp.status != "open":
            raise ValidationError("已关闭的商机不能变更阶段")

        opp.stage_code = stage_code_after
        opp.status = _status_for_stage(stage_code_after)
        opp.last_follow_up_at = occurred_at
        if next_follow_up_at is not None:
            opp.next_follow_up_at = next_follow_up_at
        opp.updated_by = updated_by
        await opp.save()
        return stage_before, stage_code_after

    @classmethod
    async def touch_follow_up_times(
        cls,
        opp: SalesOpportunity,
        *,
        occurred_at: datetime,
        next_follow_up_at: Optional[datetime],
        updated_by: int,
    ) -> None:
        opp.last_follow_up_at = occurred_at
        if next_follow_up_at is not None:
            opp.next_follow_up_at = next_follow_up_at
        opp.updated_by = updated_by
        await opp.save()

    @classmethod
    async def create(
        cls,
        tenant_id: int,
        data: SalesOpportunityCreate,
        current_user: User,
    ) -> SalesOpportunityResponse:
        customer = await cls._load_customer(tenant_id, data.customer_id, current_user)
        qid, qcode = await cls._resolve_quotation(tenant_id, customer.id, data.quotation_id)
        sid, scode = await cls._resolve_sales_order(tenant_id, customer.id, data.sales_order_id)

        if data.stage_code in TERMINAL_STAGE_CODES:
            raise ValidationError("新建商机不能使用终态阶段")

        row = await SalesOpportunity.create(
            tenant_id=tenant_id,
            customer_id=customer.id,
            customer_name=customer.name,
            title=data.title.strip(),
            stage_code=data.stage_code,
            status=_status_for_stage(data.stage_code),
            expected_amount=data.expected_amount,
            expected_close_date=data.expected_close_date,
            owner_id=customer.salesman_id,
            quotation_id=qid,
            quotation_code=qcode,
            sales_order_id=sid,
            sales_order_code=scode,
            created_by=current_user.id,
            updated_by=current_user.id,
        )
        return SalesOpportunityResponse.model_validate(row)

    @classmethod
    async def _get_default_customer_opportunity(
        cls,
        tenant_id: int,
        customer_id: int,
    ) -> Optional[SalesOpportunity]:
        """客户级默认 open 商机（无单据关联），用于阶段标记。"""
        return await SalesOpportunity.filter(
            tenant_id=tenant_id,
            customer_id=customer_id,
            status="open",
            deleted_at__isnull=True,
            quotation_id__isnull=True,
            sales_order_id__isnull=True,
        ).order_by("-updated_at", "-id").first()

    @classmethod
    async def ensure(
        cls,
        tenant_id: int,
        data: SalesOpportunityEnsure,
        current_user: User,
    ) -> SalesOpportunityResponse:
        if data.quotation_id is not None or data.sales_order_id is not None:
            return await cls.ensure_for_document(tenant_id, data, current_user)
        return await cls.ensure_default_for_customer(tenant_id, data, current_user)

    @classmethod
    async def ensure_default_for_customer(
        cls,
        tenant_id: int,
        data: SalesOpportunityEnsure,
        current_user: User,
    ) -> SalesOpportunityResponse:
        customer = await cls._load_customer(tenant_id, data.customer_id, current_user)
        existing = await cls._get_default_customer_opportunity(tenant_id, customer.id)
        if existing:
            return SalesOpportunityResponse.model_validate(existing)

        title = (data.title or "").strip() or customer.name
        row = await SalesOpportunity.create(
            tenant_id=tenant_id,
            customer_id=customer.id,
            customer_name=customer.name,
            title=title,
            stage_code="INITIAL",
            status="open",
            owner_id=customer.salesman_id,
            created_by=current_user.id,
            updated_by=current_user.id,
        )
        return SalesOpportunityResponse.model_validate(row)

    @classmethod
    async def ensure_for_document(
        cls,
        tenant_id: int,
        data: SalesOpportunityEnsure,
        current_user: User,
    ) -> SalesOpportunityResponse:
        if data.quotation_id is None and data.sales_order_id is None:
            raise ValidationError("请指定 quotation_id 或 sales_order_id")

        customer = await cls._load_customer(tenant_id, data.customer_id, current_user)
        qid, qcode = await cls._resolve_quotation(tenant_id, customer.id, data.quotation_id)
        sid, scode = await cls._resolve_sales_order(tenant_id, customer.id, data.sales_order_id)

        existing = await cls._get_open_opportunity(
            tenant_id,
            customer.id,
            quotation_id=qid,
            sales_order_id=sid,
        )
        if existing:
            return SalesOpportunityResponse.model_validate(existing)

        title = (data.title or "").strip()
        if not title:
            if qcode:
                title = f"报价 {qcode}"
            elif scode:
                title = f"订单 {scode}"
            else:
                title = customer.name

        row = await SalesOpportunity.create(
            tenant_id=tenant_id,
            customer_id=customer.id,
            customer_name=customer.name,
            title=title,
            stage_code="INITIAL",
            status="open",
            owner_id=customer.salesman_id,
            quotation_id=qid,
            quotation_code=qcode,
            sales_order_id=sid,
            sales_order_code=scode,
            created_by=current_user.id,
            updated_by=current_user.id,
        )
        return SalesOpportunityResponse.model_validate(row)

    @classmethod
    async def update(
        cls,
        tenant_id: int,
        opportunity_id: int,
        data: SalesOpportunityUpdate,
        current_user: User,
    ) -> SalesOpportunityResponse:
        row = await SalesOpportunity.filter(
            id=opportunity_id,
            tenant_id=tenant_id,
            deleted_at__isnull=True,
        ).first()
        if not row:
            raise NotFoundError(f"商机不存在: {opportunity_id}")

        await cls._load_customer(tenant_id, row.customer_id, current_user)

        dump = data.model_dump(exclude_unset=True)
        if "stage_code" in dump and dump["stage_code"] is not None:
            new_stage = dump["stage_code"]
            if row.status != "open" and new_stage != row.stage_code:
                raise ValidationError("已关闭的商机不能变更阶段")
            dump["status"] = _status_for_stage(new_stage)

        if "quotation_id" in dump:
            qid = dump["quotation_id"]
            if qid is None:
                dump["quotation_code"] = None
            else:
                rqid, rqcode = await cls._resolve_quotation(tenant_id, row.customer_id, qid)
                dump["quotation_id"] = rqid
                dump["quotation_code"] = rqcode

        if "sales_order_id" in dump:
            sid = dump["sales_order_id"]
            if sid is None:
                dump["sales_order_code"] = None
            else:
                rsid, rscode = await cls._resolve_sales_order(tenant_id, row.customer_id, sid)
                dump["sales_order_id"] = rsid
                dump["sales_order_code"] = rscode

        if "title" in dump and dump["title"] is not None:
            dump["title"] = dump["title"].strip()

        dump["updated_by"] = current_user.id
        await SalesOpportunity.filter(id=opportunity_id, tenant_id=tenant_id).update(**dump)
        row = await SalesOpportunity.get(id=opportunity_id, tenant_id=tenant_id)
        return SalesOpportunityResponse.model_validate(row)

    @classmethod
    async def get(
        cls,
        tenant_id: int,
        opportunity_id: int,
        current_user: Optional[User],
    ) -> SalesOpportunityResponse:
        row = await SalesOpportunity.filter(
            id=opportunity_id,
            tenant_id=tenant_id,
            deleted_at__isnull=True,
        ).first()
        if not row:
            raise NotFoundError(f"商机不存在: {opportunity_id}")
        if current_user and not await DataScopeService.row_visible(
            row,
            tenant_id=tenant_id,
            user=current_user,
            resource=RESOURCE_SALES_OPPORTUNITY,
        ):
            raise NotFoundError(f"商机不存在: {opportunity_id}")
        await cls._load_customer(tenant_id, row.customer_id, current_user)
        return SalesOpportunityResponse.model_validate(row)

    @classmethod
    async def list_opportunities(
        cls,
        tenant_id: int,
        *,
        skip: int = 0,
        limit: int = 50,
        customer_id: Optional[int] = None,
        status: Optional[str] = None,
        current_user: Optional[User] = None,
    ) -> SalesOpportunityListEnvelope:
        query = SalesOpportunity.filter(tenant_id=tenant_id, deleted_at__isnull=True)
        query = await cls._apply_list_scope(query, tenant_id, current_user)
        if customer_id is not None:
            query = query.filter(customer_id=customer_id)
        if status is not None:
            query = query.filter(status=status)

        total = await query.count()
        rows = await query.offset(skip).limit(limit).order_by("-updated_at", "-id")
        items = [SalesOpportunityResponse.model_validate(r) for r in rows]
        return SalesOpportunityListEnvelope(items=items, total=total)
