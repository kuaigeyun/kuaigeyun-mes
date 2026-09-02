"""菜单徽章 COUNT 与列表数据权限对齐（DataScopeService + manifest data_scope_key）。"""

from __future__ import annotations

from dataclasses import dataclass
from typing import Any, Optional

from core.services.authorization.data_scope_service import DataScopeService
from infra.models.user import User

# 与 manifest data_scope_key / data_scope_setup 注册一致；None 表示列表无范围收敛，徽章计全租户。
RES_WORK_ORDER = "kuaizhizao:work-order"
RES_REWORK_ORDER = "kuaizhizao:rework-order"
RES_SALES_ORDER = "kuaizhizao:sales-order"
RES_SALES_CONTRACT = "kuaizhizao:sales-contract"
RES_QUOTATION = "kuaizhizao:quotation"
RES_SALES_ORDER_CHANGE = "kuaizhizao:sales-order-change"
RES_SHIPMENT_NOTICE = "kuaizhizao:shipment-notice"
RES_PURCHASE_ORDER = "kuaizhizao:purchase-order"
RES_INBOUND = "kuaizhizao:inbound"
RES_OTHER_INBOUND = "kuaizhizao:other-inbound"
RES_OTHER_OUTBOUND = "kuaizhizao:other-outbound"
RES_MATERIAL_BORROW = "kuaizhizao:material-borrow"
RES_MATERIAL_RETURN = "kuaizhizao:material-return"
RES_OUTBOUND = "kuaizhizao:outbound"
RES_SALES_RETURN = "kuaizhizao:sales-return"
RES_PURCHASE_RETURN = "kuaizhizao:purchase-return"
RES_OUTSOURCE_ORDER = "kuaizhizao:outsource-order"
RES_CUSTOMER_FOLLOW_UP = "kuaizhizao:customer-follow-up"
RES_AFTER_SALES_TICKET = "kuaizhizao:after-sales-ticket"
RES_AFTER_SALES_INSTALL = "kuaizhizao:after-sales-install"
RES_REPAIR_ORDER = "kuaizhizao:repair-order"
RES_SERVICE_DISPATCH = "kuaizhizao:service-dispatch"
RES_AFTER_SALES_SPARE = "kuaizhizao:after-sales-spare-part-requisition"
RES_SERVICE_SETTLEMENT = "kuaizhizao:service-settlement"


@dataclass(frozen=True)
class BadgeScopeCtx:
    tenant_id: int
    user: User


async def badge_count(
    queryset: Any,
    ctx: BadgeScopeCtx,
    resource: Optional[str] = None,
) -> int:
    """对 QuerySet 施加与列表相同的数据范围后再 COUNT。"""
    qs = queryset
    if resource:
        qs = await DataScopeService.apply(
            qs,
            tenant_id=ctx.tenant_id,
            user=ctx.user,
            resource=resource,
        )
    return int(await qs.count())
