"""数据权限与字段权限策略服务。"""

from __future__ import annotations

from typing import Iterable

from core.models.data_permission_policy import DataPermissionPolicy, DataScopeType
from core.models.field_permission_policy import FieldMaskLevel, FieldPermissionPolicy
from core.schemas.permission_policy import (
    DataPermissionPolicyResponse,
    DataPermissionPolicyUpsert,
    FieldPermissionPolicyResponse,
    FieldPermissionPolicyUpsert,
)
from core.timezone_utils import now_utc
from infra.exceptions.exceptions import ValidationError


class PermissionPolicyService:
    DATA_SCOPE_TYPES = {
        DataScopeType.ALL,
        DataScopeType.DEPARTMENT,
        DataScopeType.SELF,
        DataScopeType.CUSTOM,
    }
    FIELD_MASK_LEVELS = {
        FieldMaskLevel.FULL,
        FieldMaskLevel.MASKED,
        FieldMaskLevel.HIDDEN,
    }

    @classmethod
    async def list_data_policies(cls, tenant_id: int, role_uuid: str) -> list[DataPermissionPolicyResponse]:
        rows = await DataPermissionPolicy.filter(
            tenant_id=tenant_id,
            role_uuid=role_uuid,
            deleted_at__isnull=True,
        ).order_by("resource")
        return [DataPermissionPolicyResponse.model_validate(r) for r in rows]

    @classmethod
    async def save_data_policies(
        cls,
        tenant_id: int,
        role_uuid: str,
        items: Iterable[DataPermissionPolicyUpsert],
    ) -> list[DataPermissionPolicyResponse]:
        await DataPermissionPolicy.filter(
            tenant_id=tenant_id,
            role_uuid=role_uuid,
            deleted_at__isnull=True,
        ).update(deleted_at=now_utc())
        created = []
        for item in items:
            scope = item.scope_type.strip().lower()
            if scope not in cls.DATA_SCOPE_TYPES:
                raise ValidationError(f"无效数据范围类型: {item.scope_type}")
            row = await DataPermissionPolicy.create(
                tenant_id=tenant_id,
                role_uuid=role_uuid,
                resource=item.resource.strip().lower(),
                scope_type=scope,
                scope_payload=item.scope_payload if scope == DataScopeType.CUSTOM else None,
            )
            created.append(DataPermissionPolicyResponse.model_validate(row))
        return created

    @classmethod
    async def list_field_policies(cls, tenant_id: int, role_uuid: str) -> list[FieldPermissionPolicyResponse]:
        rows = await FieldPermissionPolicy.filter(
            tenant_id=tenant_id,
            role_uuid=role_uuid,
            deleted_at__isnull=True,
        ).order_by("resource", "field_name")
        return [FieldPermissionPolicyResponse.model_validate(r) for r in rows]

    @classmethod
    async def save_field_policies(
        cls,
        tenant_id: int,
        role_uuid: str,
        items: Iterable[FieldPermissionPolicyUpsert],
    ) -> list[FieldPermissionPolicyResponse]:
        await FieldPermissionPolicy.filter(
            tenant_id=tenant_id,
            role_uuid=role_uuid,
            deleted_at__isnull=True,
        ).update(deleted_at=now_utc())
        created = []
        for item in items:
            level = item.mask_level.strip().lower()
            if level not in cls.FIELD_MASK_LEVELS:
                raise ValidationError(f"无效字段权限级别: {item.mask_level}")
            row = await FieldPermissionPolicy.create(
                tenant_id=tenant_id,
                role_uuid=role_uuid,
                resource=item.resource.strip().lower(),
                field_name=item.field_name.strip(),
                mask_level=level,
            )
            created.append(FieldPermissionPolicyResponse.model_validate(row))
        return created
