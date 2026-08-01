"""内置与通用 scope_custom 解析器实现。"""

from __future__ import annotations

from tortoise.expressions import Q

from core.models.data_permission_policy import DataScopeType
from core.services.authorization.data_scope_constants import (
    DIMENSION_OUTSOURCED_UNIT,
    RESOLVER_CUSTOMER_OWNED_ONLY,
    RESOLVER_CUSTOMER_OWNED_VIA_CUSTOMER_ID,
    RESOLVER_CUSTOMER_SALESMAN_POOL,
    RESOLVER_OUTSOURCED_UNIT,
    RESOLVER_PARTNER,
)
from core.services.authorization.data_scope_resolver_registry import (
    ScopeResolveContext,
    register_scope_resolver,
)
from core.services.authorization.user_data_scope_binding_service import UserDataScopeBindingService


def _deny_all_q() -> Q:
    return Q(id=-1)


async def resolve_scope_all(_ctx: ScopeResolveContext) -> None:
    """返回 None 表示不追加过滤（全部数据）。"""
    return None


async def resolve_scope_self(ctx: ScopeResolveContext) -> Q:
    field = ctx.profile.applicant_user_id_field
    if ctx.profile.created_by_user_id_field:
        created_field = ctx.profile.created_by_user_id_field
        return Q(**{field: ctx.user_id}) | Q(**{created_field: ctx.user_id})
    return Q(**{field: ctx.user_id})


async def resolve_scope_department(ctx: ScopeResolveContext) -> Q:
    dept_field = ctx.profile.department_uuid_field
    applicant_field = ctx.profile.applicant_user_id_field
    clauses: list[Q] = []
    if dept_field and ctx.department_uuid:
        clauses.append(Q(**{dept_field: ctx.department_uuid}))
    if ctx.department_user_ids:
        clauses.append(Q(**{f"{applicant_field}__in": ctx.department_user_ids}))
    if not clauses:
        return await resolve_scope_self(ctx)
    combined = clauses[0]
    for part in clauses[1:]:
        combined |= part
    return combined


async def resolve_partner_scope(ctx: ScopeResolveContext) -> Q:
    payload = ctx.scope_payload or {}
    dimension = (
        (payload.get("dimension") or "").strip()
        or (ctx.profile.partner_dimension or "").strip()
        or DIMENSION_OUTSOURCED_UNIT
    )
    code_field = (
        (payload.get("code_field") or "").strip()
        or (ctx.profile.partner_code_field or "").strip()
    )
    if not code_field:
        return _deny_all_q()

    codes = await UserDataScopeBindingService.list_scope_codes(
        tenant_id=ctx.tenant_id,
        user_id=ctx.user_id,
        dimension=dimension,
    )
    if not codes:
        return _deny_all_q()
    return Q(**{f"{code_field}__in": codes})


async def _resolve_outsourced_unit(ctx: ScopeResolveContext) -> Q:
    target_dimension = (
        (ctx.profile.partner_dimension or "").strip()
        or DIMENSION_OUTSOURCED_UNIT
    )
    merged_payload = {
        **(ctx.scope_payload or {}),
        "dimension": target_dimension,
    }
    if not merged_payload.get("code_field") and ctx.profile.partner_code_field:
        merged_payload["code_field"] = ctx.profile.partner_code_field
    child = ScopeResolveContext(
        tenant_id=ctx.tenant_id,
        user_id=ctx.user_id,
        resource=ctx.resource,
        profile=ctx.profile,
        scope_payload=merged_payload,
        department_uuid=ctx.department_uuid,
        department_user_ids=ctx.department_user_ids,
    )
    return await resolve_partner_scope(child)


async def resolve_customer_salesman_pool(ctx: ScopeResolveContext) -> Q:
    """客户默认可见性：归属业务员 + 公海 + 协作客户。"""
    from apps.kuaizhizao.services.customer_pool_service import list_collaborator_customer_ids

    field = ctx.profile.applicant_user_id_field or "salesman_id"
    clause = Q(**{field: ctx.user_id}) | Q(pool_status="pool")
    collab_ids = await list_collaborator_customer_ids(ctx.tenant_id, ctx.user_id)
    if collab_ids:
        clause |= Q(id__in=collab_ids)
    return clause


async def resolve_customer_owned_only(ctx: ScopeResolveContext) -> Q:
    """客户归属业务员或协作人（非公海），用于跟进/商机父客户校验。"""
    from apps.kuaizhizao.services.customer_pool_list_core import customer_pool_effective_owned_q
    from apps.kuaizhizao.services.customer_pool_service import list_collaborator_customer_ids

    field = ctx.profile.applicant_user_id_field or "salesman_id"
    collab_ids = await list_collaborator_customer_ids(ctx.tenant_id, ctx.user_id)
    owned_clause = Q(**{field: ctx.user_id})
    if collab_ids:
        owned_clause |= Q(id__in=collab_ids)
    return owned_clause & customer_pool_effective_owned_q()


async def resolve_customer_owned_via_customer_id(ctx: ScopeResolveContext) -> Q:
    """子表通过 customer_id 关联 owned 客户（负责人或协作人）。"""
    from apps.kuaizhizao.services.customer_pool_list_core import customer_pool_effective_owned_q
    from apps.master_data.models.customer import Customer
    from apps.kuaizhizao.services.customer_pool_service import list_collaborator_customer_ids

    collab_ids = await list_collaborator_customer_ids(ctx.tenant_id, ctx.user_id)
    customer_query = Customer.filter(
        tenant_id=ctx.tenant_id,
        deleted_at__isnull=True,
    ).filter(customer_pool_effective_owned_q()).filter(
        Q(salesman_id=ctx.user_id) | Q(id__in=collab_ids) if collab_ids else Q(salesman_id=ctx.user_id)
    )
    ids = await customer_query.values_list("id", flat=True)
    if not ids:
        return Q(id=-1)
    return Q(customer_id__in=list(ids))


def register_builtin_scope_resolvers() -> None:
    register_scope_resolver(RESOLVER_PARTNER, resolve_partner_scope)
    register_scope_resolver(RESOLVER_OUTSOURCED_UNIT, _resolve_outsourced_unit)
    register_scope_resolver(RESOLVER_CUSTOMER_SALESMAN_POOL, resolve_customer_salesman_pool)
    register_scope_resolver(RESOLVER_CUSTOMER_OWNED_ONLY, resolve_customer_owned_only)
    register_scope_resolver(RESOLVER_CUSTOMER_OWNED_VIA_CUSTOMER_ID, resolve_customer_owned_via_customer_id)


BUILTIN_SCOPE_RESOLVERS = {
    DataScopeType.ALL: resolve_scope_all,
    DataScopeType.SELF: resolve_scope_self,
    DataScopeType.DEPARTMENT: resolve_scope_department,
}
