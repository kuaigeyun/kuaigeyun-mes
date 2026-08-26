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


def _quality_inspection_read_codes_for_sales_order_link() -> list[str]:
    from core.config.permission_contract import build_permission_code

    return [
        build_permission_code("kuaizhizao", "quality-management-finished-goods-inspection", "read"),
        build_permission_code("kuaizhizao", "quality-management-oqc-inspection", "read"),
    ]


def _quality_inspection_read_codes_for_work_order_link() -> list[str]:
    from core.config.permission_contract import build_permission_code

    return [
        build_permission_code("kuaizhizao", "quality-management-finished-goods-inspection", "read"),
        build_permission_code("kuaizhizao", "quality-management-process-inspection", "read"),
        build_permission_code("kuaizhizao", "quality-management-oqc-inspection", "read"),
    ]


async def _sales_order_linked_from_quality_inspection(
    tenant_id: int,
    sales_order_id: int,
) -> bool:
    """是否存在引用该销售订单的质检单（成品 / 出货检验，含经工单间接关联）。"""
    from apps.kuaizhizao.models.finished_goods_inspection import FinishedGoodsInspection
    from apps.kuaizhizao.models.oqc_inspection import OqcInspection
    from apps.kuaizhizao.models.work_order import WorkOrder

    so_id = int(sales_order_id)
    direct_filters = dict(
        tenant_id=tenant_id,
        sales_order_id=so_id,
        deleted_at__isnull=True,
    )
    if await FinishedGoodsInspection.filter(**direct_filters).exists():
        return True
    if await OqcInspection.filter(**direct_filters).exists():
        return True

    work_order_ids = await WorkOrder.filter(
        tenant_id=tenant_id,
        sales_order_id=so_id,
        deleted_at__isnull=True,
    ).values_list("id", flat=True)
    if not work_order_ids:
        return False
    wo_filters = dict(
        tenant_id=tenant_id,
        work_order_id__in=list(work_order_ids),
        deleted_at__isnull=True,
    )
    if await FinishedGoodsInspection.filter(**wo_filters).exists():
        return True
    return await OqcInspection.filter(**wo_filters).exists()


async def _work_order_linked_from_quality_inspection(
    tenant_id: int,
    work_order_id: int,
) -> bool:
    """是否存在引用该工单的质检单（来料 / 过程 / 成品 / 出货检验）。"""
    from apps.kuaizhizao.models.finished_goods_inspection import FinishedGoodsInspection
    from apps.kuaizhizao.models.oqc_inspection import OqcInspection
    from apps.kuaizhizao.models.process_inspection import ProcessInspection

    filters = dict(
        tenant_id=tenant_id,
        work_order_id=int(work_order_id),
        deleted_at__isnull=True,
    )
    if await FinishedGoodsInspection.filter(**filters).exists():
        return True
    if await ProcessInspection.filter(**filters).exists():
        return True
    return await OqcInspection.filter(**filters).exists()


async def allow_sales_order_detail_quality_linked_read(
    tenant_id: int,
    user_id: int,
    sales_order_id: int,
) -> bool:
    """质检关联只读：无销售订单 read 时，仍允许打开被 FQC/OQC 引用的销售订单详情。"""
    if int(sales_order_id) <= 0:
        return False
    if not await _sales_order_linked_from_quality_inspection(tenant_id, sales_order_id):
        return False
    from core.services.authorization.user_permission_service import UserPermissionService

    return await UserPermissionService.has_any_permission(
        user_id,
        tenant_id,
        _quality_inspection_read_codes_for_sales_order_link(),
    )


async def allow_work_order_detail_quality_linked_read(
    tenant_id: int,
    user_id: int,
    work_order_id: int,
) -> bool:
    """质检关联只读：无工单 read 时，仍允许打开被质检单引用的工单详情。"""
    if int(work_order_id) <= 0:
        return False
    if not await _work_order_linked_from_quality_inspection(tenant_id, work_order_id):
        return False
    from core.services.authorization.user_permission_service import UserPermissionService

    return await UserPermissionService.has_any_permission(
        user_id,
        tenant_id,
        _quality_inspection_read_codes_for_work_order_link(),
    )


async def assert_sales_order_row_visible_or_quality_linked(
    order: Any,
    *,
    tenant_id: int,
    user: User,
) -> None:
    """
    销售订单详情可见性：常规数据范围通过，或用户已具备质检读权限且
    存在引用该销售订单的成品/出货检验单（关联抽屉只读场景）。
    """
    if await DataScopeService.row_visible(
        order,
        tenant_id=tenant_id,
        user=user,
        resource=SALES_ORDER_SCOPE_RESOURCE,
    ):
        return

    sales_order_id = int(getattr(order, "id", 0) or 0)
    if sales_order_id <= 0:
        await DataScopeService.assert_row_visible(
            order,
            tenant_id=tenant_id,
            user=user,
            resource=SALES_ORDER_SCOPE_RESOURCE,
        )
        return

    if not await _sales_order_linked_from_quality_inspection(tenant_id, sales_order_id):
        await DataScopeService.assert_row_visible(
            order,
            tenant_id=tenant_id,
            user=user,
            resource=SALES_ORDER_SCOPE_RESOURCE,
        )
        return

    from core.services.authorization.user_permission_service import UserPermissionService

    if await UserPermissionService.has_any_permission(
        user.id,
        tenant_id,
        _quality_inspection_read_codes_for_sales_order_link(),
    ):
        return

    await DataScopeService.assert_row_visible(
        order,
        tenant_id=tenant_id,
        user=user,
        resource=SALES_ORDER_SCOPE_RESOURCE,
    )


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
