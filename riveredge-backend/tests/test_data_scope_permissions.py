from types import SimpleNamespace

import pytest
from fastapi import HTTPException

from apps.kuaizhizao.services.quotation_service import QuotationService
from apps.kuaizhizao.services.sales_order_service import SalesOrderService
from core.services.authorization.data_scope_resolver_registry import ScopeResolveContext
from core.services.authorization.data_scope_resolvers import (
    resolve_scope_department,
    resolve_scope_self,
)
from core.services.authorization.data_scope_resource_registry import DataScopeResourceProfile
from core.services.authorization.data_scope_resource_registry import get_resource_profile
from core.services.authorization.data_scope_service import DataScopeService
from apps.kuaizhizao.authorization.data_scope_setup import register_kuaizhizao_data_scope_profiles


@pytest.mark.asyncio
async def test_resolve_scope_self_uses_applicant_and_created_by_fields() -> None:
    ctx = ScopeResolveContext(
        tenant_id=1,
        user_id=42,
        resource="kuaizhizao:sales-order",
        profile=DataScopeResourceProfile(
            applicant_user_id_field="salesman_id",
            created_by_user_id_field="created_by",
            department_uuid_field=None,
        ),
        scope_payload=None,
        department_uuid=None,
        department_user_ids=[],
    )
    q = await resolve_scope_self(ctx)
    assert q.join_type == "OR"
    child_filters = [child.filters for child in q.children]
    assert {"salesman_id": 42} in child_filters
    assert {"created_by": 42} in child_filters


@pytest.mark.asyncio
async def test_resolve_scope_department_without_department_field_uses_user_ids_only() -> None:
    ctx = ScopeResolveContext(
        tenant_id=1,
        user_id=42,
        resource="kuaizhizao:quotation",
        profile=DataScopeResourceProfile(
            applicant_user_id_field="salesman_id",
            created_by_user_id_field="created_by",
            department_uuid_field=None,
        ),
        scope_payload=None,
        department_uuid="d-uuid",
        department_user_ids=[42, 43],
    )
    q = await resolve_scope_department(ctx)
    assert q.join_type == "AND"
    assert q.filters == {"salesman_id__in": [42, 43]}


@pytest.mark.asyncio
async def test_assert_row_visible_returns_403_when_row_denied(monkeypatch) -> None:
    async def _always_denied(cls, row, *, tenant_id, user, resource):  # noqa: ARG001
        return False

    monkeypatch.setattr(DataScopeService, "row_visible", classmethod(_always_denied))
    with pytest.raises(HTTPException) as exc:
        await DataScopeService.assert_row_visible(
            row=SimpleNamespace(id=1),
            tenant_id=1,
            user=SimpleNamespace(id=1),
            resource="kuaizhizao:sales-order",
        )
    assert exc.value.status_code == 403
    assert exc.value.detail["details"]["reason"] == "data_scope_denied"


@pytest.mark.asyncio
async def test_sales_order_list_scope_delegates_to_data_scope_service(monkeypatch) -> None:
    captured = {}

    async def _fake_apply(cls, queryset, *, tenant_id, user, resource):  # noqa: ARG001
        captured["queryset"] = queryset
        captured["tenant_id"] = tenant_id
        captured["user"] = user
        captured["resource"] = resource
        return "scoped-query"

    monkeypatch.setattr(DataScopeService, "apply", classmethod(_fake_apply))
    service = SalesOrderService()
    query = object()
    user = SimpleNamespace(id=1)
    result = await service._apply_sales_order_list_scope(query, 100, user, "mine")
    assert result == "scoped-query"
    assert captured["resource"] == "kuaizhizao:sales-order"
    assert captured["tenant_id"] == 100


@pytest.mark.asyncio
async def test_quotation_list_scope_delegates_to_data_scope_service(monkeypatch) -> None:
    captured = {}

    async def _fake_apply(cls, queryset, *, tenant_id, user, resource):  # noqa: ARG001
        captured["tenant_id"] = tenant_id
        captured["user"] = user
        captured["resource"] = resource
        return "scoped-query"

    monkeypatch.setattr(DataScopeService, "apply", classmethod(_fake_apply))
    query = object()
    user = SimpleNamespace(id=2)
    result = await QuotationService._apply_quotation_list_scope(query, 200, user, "department")
    assert result == "scoped-query"
    assert captured["resource"] == "kuaizhizao:quotation"
    assert captured["tenant_id"] == 200


def test_customer_pool_resource_profile_registered() -> None:
    register_kuaizhizao_data_scope_profiles()
    profile = get_resource_profile("kuaizhizao:customer-pool")
    assert profile is not None
    assert profile.applicant_user_id_field == "salesman_id"
