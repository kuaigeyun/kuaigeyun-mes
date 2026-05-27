"""好力 GO 外协单据数据范围常量与便捷方法。"""

from __future__ import annotations

from core.services.authorization.data_scope_constants import DIMENSION_SUPPLIER
from core.services.authorization.data_scope_service import DataScopeService
from infra.models.user import User

RESOURCE_OUTSOURCE_MAINTENANCE = "haoligo:molds-documents-outsource-maintenance"
RESOURCE_OUTSOURCE_COMPLETE = "haoligo:molds-documents-outsource-complete"
RESOURCE_OUTSOURCE_MAINTENANCE_LOG = "haoligo:molds-reports-outsource-maintenance-log"
RESOURCE_TRIAL_SHEET = "haoligo:molds-documents-trial"
RESOURCE_TRIAL_RECORD = "haoligo:molds-reports-trial-record"


async def apply_outsource_sheet_scope(qs, *, tenant_id: int, user: User, resource: str):
    return await DataScopeService.apply(qs, tenant_id=tenant_id, user=user, resource=resource)


async def assert_outsource_row_visible(row, *, tenant_id: int, user: User, resource: str) -> None:
    await DataScopeService.assert_row_visible(row, tenant_id=tenant_id, user=user, resource=resource)


async def apply_trial_sheet_scope(qs, *, tenant_id: int, user: User, resource: str = RESOURCE_TRIAL_SHEET):
    return await DataScopeService.apply(qs, tenant_id=tenant_id, user=user, resource=resource)


async def assert_trial_row_visible(row, *, tenant_id: int, user: User, resource: str = RESOURCE_TRIAL_SHEET) -> None:
    await DataScopeService.assert_row_visible(row, tenant_id=tenant_id, user=user, resource=resource)


async def assert_trial_supplier_code_writable(
    *,
    tenant_id: int,
    user: User,
    resource: str,
    supplier_code: str | None,
) -> None:
    await DataScopeService.assert_partner_code_writable(
        tenant_id=tenant_id,
        user=user,
        resource=resource,
        partner_code=supplier_code,
        dimension=DIMENSION_SUPPLIER,
    )


async def assert_outsource_partner_code_writable(
    *,
    tenant_id: int,
    user: User,
    resource: str,
    partner_code: str | None,
) -> None:
    await DataScopeService.assert_partner_code_writable(
        tenant_id=tenant_id,
        user=user,
        resource=resource,
        partner_code=partner_code,
        dimension=DIMENSION_SUPPLIER,
    )
