"""
客户跟进记录服务
"""

from __future__ import annotations

from datetime import datetime
from typing import List, Optional, Set, Tuple

from tortoise.models import Q

from apps.kuaizhizao.models.customer_follow_up import CustomerFollowUp
from apps.kuaizhizao.models.quotation import Quotation
from apps.kuaizhizao.models.sales_order import SalesOrder
from apps.kuaizhizao.schemas.customer_follow_up import (
    CustomerFollowUpCreate,
    CustomerFollowUpUpdate,
    CustomerFollowUpResponse,
    CustomerFollowUpListResponse,
    CustomerFollowUpListEnvelope,
)
from apps.master_data.models.customer import Customer
from infra.exceptions.exceptions import NotFoundError, ValidationError
from infra.models.user import User


class CustomerFollowUpService:
    """客户跟进业务逻辑"""

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
        if current_user and current_user.is_regular_user():
            if customer.salesman_id != current_user.id:
                raise ValidationError("无权操作该客户")
        return customer

    @staticmethod
    async def _allowed_customer_ids(tenant_id: int, current_user: Optional[User]) -> Optional[Set[int]]:
        """普通业务员返回其负责客户 ID 集合；管理员等返回 None 表示不限制。"""
        if not current_user or not current_user.is_regular_user():
            return None
        rows = await Customer.filter(
            tenant_id=tenant_id,
            deleted_at__isnull=True,
            salesman_id=current_user.id,
        ).values_list("id", flat=True)
        return set(rows)

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
            created_by=current_user.id,
            updated_by=current_user.id,
        )
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

        await CustomerFollowUp.filter(id=follow_id, tenant_id=tenant_id).update(**dump)
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
        allowed = await cls._allowed_customer_ids(tenant_id, current_user)
        if allowed is not None and row.customer_id not in allowed:
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
        allowed: Optional[Set[int]],
        customer_id: Optional[int],
        keyword: Optional[str],
        occurred_from: Optional[datetime],
        occurred_to: Optional[datetime],
        pending_only: bool,
    ):
        query = CustomerFollowUp.filter(tenant_id=tenant_id, deleted_at__isnull=True)
        if allowed is not None:
            query = query.filter(customer_id__in=list(allowed))
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
        allowed = await cls._allowed_customer_ids(tenant_id, current_user)
        if allowed is not None and len(allowed) == 0:
            return CustomerFollowUpListEnvelope(items=[], total=0)

        query = cls._filter_query(
            tenant_id,
            allowed,
            customer_id,
            keyword,
            occurred_from,
            occurred_to,
            pending_only,
        )
        total = await query.count()
        rows = await query.offset(skip).limit(limit).order_by("-occurred_at", "-id")
        await cls._attach_creator_names(rows)
        out: List[CustomerFollowUpListResponse] = []
        for row in rows:
            resp = CustomerFollowUpListResponse.model_validate(row)
            resp.created_by_name = getattr(row, "_creator_name", None)
            out.append(resp)
        return CustomerFollowUpListEnvelope(items=out, total=total)
