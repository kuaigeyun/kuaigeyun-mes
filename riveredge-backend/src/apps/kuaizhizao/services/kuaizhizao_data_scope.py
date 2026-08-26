"""快制造列表数据权限（唯一路径：DataScopeService + manifest data_scope_key）。"""

from __future__ import annotations

from typing import TYPE_CHECKING, Any, Optional

from tortoise.expressions import Q

from core.services.authorization.data_scope_service import DataScopeService

if TYPE_CHECKING:
    from infra.models.user import User

SALES_ORDER_SCOPE_RESOURCE = "kuaizhizao:sales-order"
SALES_REVIEW_SCOPE_RESOURCE = "kuaizhizao:sales-review"
SALES_OUTBOUND_SCOPE_RESOURCE = "kuaizhizao:outbound"
SALES_RETURN_SCOPE_RESOURCE = "kuaizhizao:sales-return"
SALES_ORDER_CHANGE_SCOPE_RESOURCE = "kuaizhizao:sales-order-change"
SHIPMENT_NOTICE_SCOPE_RESOURCE = "kuaizhizao:shipment-notice"


async def apply_kuaizhizao_list_scope(
    query: Any,
    *,
    tenant_id: int,
    current_user: User | None,
    resource: str,
) -> Any:
    if current_user is None:
        return query
    return await DataScopeService.apply(
        query,
        tenant_id=tenant_id,
        user=current_user,
        resource=resource,
    )


async def assert_kuaizhizao_row_visible(
    row: Any,
    *,
    tenant_id: int,
    user: User,
    resource: str,
) -> None:
    await DataScopeService.assert_row_visible(
        row,
        tenant_id=tenant_id,
        user=user,
        resource=resource,
    )


async def apply_sales_order_child_list_scope(
    query: Any,
    *,
    tenant_id: int,
    current_user: User | None,
    order_id_field: str,
    orphan_resource: Optional[str] = None,
) -> Any:
    """
    销售子单列表：按源销售订单数据权限过滤。

    无源单号时（如 MTS 出库）可传 orphan_resource，按该资源 created_by 等字段收敛。
    """
    if current_user is None:
        return query
    from apps.kuaizhizao.models.sales_order import SalesOrder

    scoped_orders = await DataScopeService.apply(
        SalesOrder.filter(tenant_id=tenant_id, deleted_at__isnull=True),
        tenant_id=tenant_id,
        user=current_user,
        resource=SALES_ORDER_SCOPE_RESOURCE,
    )
    order_ids = [int(x) for x in await scoped_orders.values_list("id", flat=True)]
    linked: Q | None = None
    if order_ids:
        linked = Q(**{f"{order_id_field}__in": order_ids})
    if not orphan_resource:
        if linked is None:
            return query.filter(id=-1)
        return query.filter(linked)

    orphan_qs = query.filter(**{f"{order_id_field}__isnull": True})
    orphan_scoped = await DataScopeService.apply(
        orphan_qs,
        tenant_id=tenant_id,
        user=current_user,
        resource=orphan_resource,
    )
    orphan_ids = [int(x) for x in await orphan_scoped.values_list("id", flat=True)]
    clauses: list[Q] = []
    if linked is not None:
        clauses.append(linked)
    if orphan_ids:
        clauses.append(Q(id__in=orphan_ids))
    if not clauses:
        return query.filter(id=-1)
    combined = clauses[0]
    for part in clauses[1:]:
        combined |= part
    return query.filter(combined)


async def assert_sales_order_child_row_visible(
    row: Any,
    *,
    tenant_id: int,
    user: User,
    order_id_field: str,
    orphan_resource: Optional[str] = None,
) -> None:
    """销售子单详情：源销售订单可见，或无源单时按 orphan_resource 校验。"""
    order_id = getattr(row, order_id_field, None)
    if order_id:
        from apps.kuaizhizao.models.sales_order import SalesOrder

        order = await SalesOrder.get_or_none(
            tenant_id=tenant_id,
            id=int(order_id),
            deleted_at__isnull=True,
        )
        if not order:
            from fastapi import HTTPException, status

            raise HTTPException(
                status_code=status.HTTP_403_FORBIDDEN,
                detail={
                    "code": "ACCESS_DENIED",
                    "message": "权限不足",
                    "details": {
                        "reason": "data_scope_denied",
                        "resource": SALES_ORDER_SCOPE_RESOURCE,
                    },
                },
            )
        await DataScopeService.assert_row_visible(
            order,
            tenant_id=tenant_id,
            user=user,
            resource=SALES_ORDER_SCOPE_RESOURCE,
        )
        return
    if orphan_resource:
        await DataScopeService.assert_row_visible(
            row,
            tenant_id=tenant_id,
            user=user,
            resource=orphan_resource,
        )
