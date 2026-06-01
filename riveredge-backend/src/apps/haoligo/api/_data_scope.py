"""好力 GO 外协单据数据范围常量与便捷方法。"""

from __future__ import annotations

from fastapi import HTTPException, status
from tortoise.expressions import Q

from apps.haoligo.constants.mold_sheet_audit import SHEET_STATUS_APPROVED
from apps.haoligo.constants.mold_trial_failure_handling import (
    TRIAL_FAILURE_HANDLING_ADJUSTMENT_DONE,
    TRIAL_FAILURE_HANDLING_DISPATCHED,
    TRIAL_FAILURE_HANDLING_REPAIR,
)
from core.services.authorization.data_scope_constants import DIMENSION_SUPPLIER
from core.services.authorization.data_scope_service import DataScopeService
from infra.models.user import User

RESOURCE_OUTSOURCE_MAINTENANCE = "haoligo:molds-documents-outsource-maintenance"
RESOURCE_OUTSOURCE_COMPLETE = "haoligo:molds-documents-outsource-complete"
RESOURCE_OUTSOURCE_MAINTENANCE_LOG = "haoligo:molds-reports-outsource-maintenance-log"
RESOURCE_TRIAL_SHEET = "haoligo:molds-documents-trial"
RESOURCE_TRIAL_RECORD = "haoligo:molds-reports-trial-record"


async def user_is_external_partner(tenant_id: int, user: User) -> bool:
    if DataScopeService._admin_bypass(user):
        return False
    roles = await DataScopeService._load_active_roles(user.id, tenant_id)
    return any(
        (getattr(role, "role_type", "") or "").strip().lower() == "external"
        and (getattr(role, "external_partner_type", "") or "").strip()
        for role in roles
    )


def trial_external_partner_business_q() -> Q:
    """外协角色：不合格试模单须主管审核通过且模具已转外部仓（立即送修/已发出）后才可见。"""
    vendor_visible_unqualified = Q(
        sheet_status=SHEET_STATUS_APPROVED,
        failure_handling__in=(
            TRIAL_FAILURE_HANDLING_REPAIR,
            TRIAL_FAILURE_HANDLING_DISPATCHED,
            TRIAL_FAILURE_HANDLING_ADJUSTMENT_DONE,
        ),
    )
    is_unqualified = Q(trial_result="不合格") | Q(production_trial_result="不合格")
    return (~is_unqualified) | vendor_visible_unqualified


def trial_row_visible_to_external_partner(row) -> bool:
    if row is None:
        return False
    trial_result = (getattr(row, "trial_result", None) or "").strip()
    production_result = (getattr(row, "production_trial_result", None) or "").strip()
    if trial_result != "不合格" and production_result != "不合格":
        return True
    if (getattr(row, "sheet_status", None) or "").strip() != SHEET_STATUS_APPROVED:
        return False
    handling = (getattr(row, "failure_handling", None) or "").strip()
    return handling in (
        TRIAL_FAILURE_HANDLING_REPAIR,
        TRIAL_FAILURE_HANDLING_DISPATCHED,
        TRIAL_FAILURE_HANDLING_ADJUSTMENT_DONE,
    )


async def apply_outsource_sheet_scope(qs, *, tenant_id: int, user: User, resource: str):
    return await DataScopeService.apply(qs, tenant_id=tenant_id, user=user, resource=resource)


async def assert_outsource_row_visible(row, *, tenant_id: int, user: User, resource: str) -> None:
    await DataScopeService.assert_row_visible(row, tenant_id=tenant_id, user=user, resource=resource)


async def apply_trial_sheet_scope(qs, *, tenant_id: int, user: User, resource: str = RESOURCE_TRIAL_SHEET):
    scoped = await DataScopeService.apply(qs, tenant_id=tenant_id, user=user, resource=resource)
    if await user_is_external_partner(tenant_id, user):
        scoped = scoped.filter(trial_external_partner_business_q())
    return scoped


async def assert_trial_row_visible(row, *, tenant_id: int, user: User, resource: str = RESOURCE_TRIAL_SHEET) -> None:
    await DataScopeService.assert_row_visible(row, tenant_id=tenant_id, user=user, resource=resource)
    if await user_is_external_partner(tenant_id, user) and not trial_row_visible_to_external_partner(row):
        raise HTTPException(
            status_code=status.HTTP_403_FORBIDDEN,
            detail={
                "code": "ACCESS_DENIED",
                "message": "权限不足",
                "details": {
                    "reason": "trial_vendor_visibility_denied",
                    "resource": resource,
                },
            },
        )


async def assert_trial_internal_operator(tenant_id: int, user: User) -> None:
    if await user_is_external_partner(tenant_id, user):
        raise HTTPException(
            status_code=status.HTTP_403_FORBIDDEN,
            detail="该操作仅限本公司人员",
        )


async def assert_trial_external_operator(tenant_id: int, user: User) -> None:
    if not await user_is_external_partner(tenant_id, user):
        raise HTTPException(
            status_code=status.HTTP_403_FORBIDDEN,
            detail="该操作仅限外协厂商账号",
        )


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
