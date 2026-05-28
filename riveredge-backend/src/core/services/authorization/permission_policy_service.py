"""数据权限与字段权限策略服务。"""

from __future__ import annotations

import re
from typing import Any, Iterable

from core.models.data_permission_policy import DataPermissionPolicy, DataScopeType
from core.models.field_name_alias import FieldNameAlias
from core.models.field_permission_policy import FieldMaskLevel, FieldPermissionPolicy
from core.models.user_role import UserRole
from core.services.authorization.permission_registry_service import PermissionRegistryService
from core.schemas.permission_policy import (
    DataPermissionPolicyResponse,
    DataPermissionPolicyUpsert,
    FieldPermissionPolicyResponse,
    FieldPermissionPolicyUpsert,
)
from core.timezone_utils import now_utc
from infra.infrastructure.database.database import get_db_connection
from infra.exceptions.exceptions import ValidationError
from tortoise.transactions import in_transaction


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
    FIELD_CANONICAL_ALIAS_MAP = {
        "amountwithtax": "amount_with_tax",
        "amount_with_tax": "amount_with_tax",
        "amountwithouttax": "amount_without_tax",
        "amount_without_tax": "amount_without_tax",
        "untaxedamount": "amount_without_tax",
        "untaxed_amount": "amount_without_tax",
        "totalamount": "total_amount",
        "total_amount": "total_amount",
        "taxamount": "tax_amount",
        "tax_amount": "tax_amount",
        "unitprice": "unit_price",
        "unit_price": "unit_price",
        "customername": "customer_name",
        "customer_name": "customer_name",
        "clientname": "customer_name",
        "client_name": "customer_name",
    }
    BUILTIN_MASKED_FIELD_NAMES = {
        # 金额类（canonical）
        "amount",
        "total_amount",
        "tax_amount",
        "unit_price",
        "price",
        "amount_with_tax",
        "amount_without_tax",
        # 客户名称类（canonical）
        "customer_name",
    }
    FIELD_LABEL_MAP = {
        "amount": "金额",
        "total_amount": "总金额",
        "tax_amount": "税额",
        "untaxed_amount": "未税金额",
        "amount_with_tax": "含税金额",
        "amount_without_tax": "未税金额",
        "unit_price": "单价",
        "price": "价格",
        "customer_name": "客户名称",
    }

    @staticmethod
    def _normalize_resource(raw: str) -> str:
        return (raw or "").strip().lower()

    @classmethod
    def canonicalize_field_name(cls, raw: str) -> str:
        name = (raw or "").strip()
        if not name:
            return ""
        snake = re.sub(r"([a-z0-9])([A-Z])", r"\1_\2", name).replace("-", "_").replace(" ", "_").lower()
        snake = re.sub(r"_+", "_", snake).strip("_")
        compact = snake.replace("_", "")
        return cls.FIELD_CANONICAL_ALIAS_MAP.get(snake) or cls.FIELD_CANONICAL_ALIAS_MAP.get(compact) or snake

    @classmethod
    async def _load_tenant_field_alias_map(cls, tenant_id: int) -> dict[str, str]:
        rows = await FieldNameAlias.filter(
            tenant_id=tenant_id,
            is_active=True,
            deleted_at__isnull=True,
        ).all()
        mapping: dict[str, str] = {}
        for row in rows:
            src = cls.canonicalize_field_name(row.source_name)
            target = cls.canonicalize_field_name(row.canonical_name)
            if src and target:
                mapping[src] = target
                mapping[src.replace("_", "")] = target
        return mapping

    @classmethod
    def _canonicalize_field_name_with_aliases(cls, raw: str, alias_map: dict[str, str]) -> str:
        canonical = cls.canonicalize_field_name(raw)
        if not canonical:
            return ""
        compact = canonical.replace("_", "")
        return alias_map.get(canonical) or alias_map.get(compact) or canonical

    @classmethod
    def field_name_display_label(cls, field_name: str) -> str:
        canonical = cls.canonicalize_field_name(field_name)
        return cls.FIELD_LABEL_MAP.get(canonical, canonical)

    @classmethod
    async def _collect_allowed_function_resources(cls, tenant_id: int) -> set[str]:
        defs = await PermissionRegistryService.collect_definitions(tenant_id=tenant_id)
        out: set[str] = set()
        for code in defs.keys():
            parts = [x for x in code.split(":") if x]
            if len(parts) < 3:
                continue
            app = parts[0]
            resource = ":".join(parts[1:-1])
            if not app or not resource:
                continue
            out.add(f"{app}:{resource}")
        return out

    @classmethod
    async def list_data_policies(cls, tenant_id: int, role_uuid: str) -> list[DataPermissionPolicyResponse]:
        rows = await DataPermissionPolicy.filter(
            tenant_id=tenant_id,
            role_uuid=role_uuid,
            deleted_at__isnull=True,
        ).order_by("resource")
        allowed = await cls._collect_allowed_function_resources(tenant_id=tenant_id)
        return [
            DataPermissionPolicyResponse.model_validate(r)
            for r in rows
            if cls._normalize_resource(r.resource) in allowed
        ]

    @classmethod
    async def save_data_policies(
        cls,
        tenant_id: int,
        role_uuid: str,
        items: Iterable[DataPermissionPolicyUpsert],
    ) -> list[DataPermissionPolicyResponse]:
        allowed = await cls._collect_allowed_function_resources(tenant_id=tenant_id)
        now = now_utc()
        desired: dict[str, DataPermissionPolicyUpsert] = {}
        for item in items:
            scope = item.scope_type.strip().lower()
            if scope not in cls.DATA_SCOPE_TYPES:
                raise ValidationError(f"无效数据范围类型: {item.scope_type}")
            resource = cls._normalize_resource(item.resource)
            if resource not in allowed:
                raise ValidationError(f"无效数据权限资源（非真源资源）: {item.resource}")
            payload = item.scope_payload if scope == DataScopeType.CUSTOM else None
            if scope == DataScopeType.CUSTOM:
                resolver = ""
                if isinstance(payload, dict):
                    resolver = str(payload.get("resolver") or "").strip()
                if not resolver:
                    raise ValidationError(
                        'scope_custom 须在 scope_payload 中指定 resolver，'
                        '例如 {"resolver": "outsourced_unit"} 或 {"resolver": "partner", "dimension": "supplier"}'
                    )
            desired[resource] = DataPermissionPolicyUpsert(
                resource=resource,
                scope_type=scope,
                scope_payload=payload,
            )

        async with in_transaction():
            existing = await DataPermissionPolicy.filter(
                tenant_id=tenant_id,
                role_uuid=role_uuid,
            ).order_by("-updated_at", "-id")
            existing_by_key: dict[str, DataPermissionPolicy] = {}
            for row in existing:
                key = cls._normalize_resource(row.resource)
                if not key:
                    continue
                prev = existing_by_key.get(key)
                if prev is None:
                    existing_by_key[key] = row
                else:
                    prev_active = prev.deleted_at is None
                    row_active = row.deleted_at is None
                    if row_active and not prev_active:
                        existing_by_key[key] = row
                    elif row_active == prev_active and (row.updated_at, row.id) > (
                        prev.updated_at,
                        prev.id,
                    ):
                        existing_by_key[key] = row

            for key, item in desired.items():
                row = existing_by_key.get(key)
                if row:
                    row.resource = key
                    row.scope_type = item.scope_type
                    row.scope_payload = item.scope_payload
                    row.deleted_at = None
                    await row.save(
                        update_fields=["resource", "scope_type", "scope_payload", "deleted_at", "updated_at"]
                    )
                    existing_by_key[key] = row
                    continue
                try:
                    created = await DataPermissionPolicy.create(
                        tenant_id=tenant_id,
                        role_uuid=role_uuid,
                        resource=key,
                        scope_type=item.scope_type,
                        scope_payload=item.scope_payload,
                    )
                    existing_by_key[key] = created
                except IntegrityError:
                    conflict = await DataPermissionPolicy.filter(
                        tenant_id=tenant_id,
                        role_uuid=role_uuid,
                        resource=key,
                    ).order_by("-updated_at", "-id").first()
                    if not conflict:
                        raise
                    conflict.resource = key
                    conflict.scope_type = item.scope_type
                    conflict.scope_payload = item.scope_payload
                    conflict.deleted_at = None
                    await conflict.save(
                        update_fields=[
                            "resource",
                            "scope_type",
                            "scope_payload",
                            "deleted_at",
                            "updated_at",
                        ]
                    )
                    existing_by_key[key] = conflict

            active_rows = await DataPermissionPolicy.filter(
                tenant_id=tenant_id,
                role_uuid=role_uuid,
                deleted_at__isnull=True,
            )
            seen_desired: set[str] = set()
            for row in active_rows:
                key = cls._normalize_resource(row.resource)
                if key not in desired:
                    row.deleted_at = now
                    await row.save(update_fields=["deleted_at", "updated_at"])
                    continue
                if key in seen_desired:
                    row.deleted_at = now
                    await row.save(update_fields=["deleted_at", "updated_at"])
                    continue
                seen_desired.add(key)

        return await cls.list_data_policies(tenant_id=tenant_id, role_uuid=role_uuid)

    @classmethod
    async def list_field_policies(cls, tenant_id: int, role_uuid: str) -> list[FieldPermissionPolicyResponse]:
        alias_map = await cls._load_tenant_field_alias_map(tenant_id=tenant_id)
        rows = await FieldPermissionPolicy.filter(
            tenant_id=tenant_id,
            role_uuid=role_uuid,
            deleted_at__isnull=True,
        ).order_by("resource", "field_name")
        allowed = await cls._collect_allowed_function_resources(tenant_id=tenant_id)
        visible_rows = [r for r in rows if cls._normalize_resource(r.resource) in allowed]
        dedup: dict[tuple[str, str], FieldPermissionPolicy] = {}
        for r in visible_rows:
            resource = cls._normalize_resource(r.resource)
            field_name = cls._canonicalize_field_name_with_aliases(r.field_name, alias_map)
            if not field_name:
                continue
            key = (resource, field_name)
            prev = dedup.get(key)
            if prev is None or (r.updated_at, r.id) > (prev.updated_at, prev.id):
                dedup[key] = r
        visible_rows = list(dedup.values())
        existing_keys = {
            (cls._normalize_resource(r.resource), cls._canonicalize_field_name_with_aliases(r.field_name, alias_map))
            for r in visible_rows
        }

        data_resources = await DataPermissionPolicy.filter(
            tenant_id=tenant_id,
            role_uuid=role_uuid,
            deleted_at__isnull=True,
        ).values_list("resource", flat=True)
        normalized_resources = sorted(
            {cls._normalize_resource(r) for r in data_resources if cls._normalize_resource(r) in allowed}
        )

        synthetic: list[FieldPermissionPolicyResponse] = []
        now = now_utc()
        synthetic_keys: set[tuple[str, str]] = set()
        for resource in normalized_resources:
            for field_name in sorted(cls.BUILTIN_MASKED_FIELD_NAMES):
                canonical_field = cls._canonicalize_field_name_with_aliases(field_name, alias_map)
                key = (resource, canonical_field)
                if key in existing_keys or key in synthetic_keys:
                    continue
                synthetic_keys.add(key)
                synthetic.append(
                    FieldPermissionPolicyResponse(
                        uuid=f"builtin:{role_uuid}:{resource}:{canonical_field}",
                        role_uuid=role_uuid,
                        resource=resource,
                        field_name=canonical_field,
                        field_label=cls.field_name_display_label(field_name),
                        mask_level=FieldMaskLevel.MASKED,
                        created_at=now,
                        updated_at=now,
                    )
                )
        normalized_existing: list[FieldPermissionPolicyResponse] = []
        for r in visible_rows:
            normalized_existing.append(
                FieldPermissionPolicyResponse(
                    uuid=r.uuid,
                    role_uuid=r.role_uuid,
                    resource=cls._normalize_resource(r.resource),
                    field_name=cls._canonicalize_field_name_with_aliases(r.field_name, alias_map),
                    field_label=cls.field_name_display_label(r.field_name),
                    mask_level=r.mask_level,
                    created_at=r.created_at,
                    updated_at=r.updated_at,
                )
            )
        return normalized_existing + synthetic

    @classmethod
    def _field_policy_key(
        cls,
        resource: str,
        field_name: str,
        alias_map: dict[str, str],
    ) -> tuple[str, str] | None:
        normalized_resource = cls._normalize_resource(resource)
        canonical_field = cls._canonicalize_field_name_with_aliases(field_name, alias_map)
        if not canonical_field:
            return None
        return normalized_resource, canonical_field

    @classmethod
    def _pick_preferred_field_policy_row(
        cls,
        prev: FieldPermissionPolicy,
        row: FieldPermissionPolicy,
    ) -> FieldPermissionPolicy:
        prev_active = prev.deleted_at is None
        row_active = row.deleted_at is None
        if row_active and not prev_active:
            return row
        if prev_active and not row_active:
            return prev
        if (row.updated_at, row.id) > (prev.updated_at, prev.id):
            return row
        return prev

    @classmethod
    async def _upsert_field_policy_row(
        cls,
        *,
        tenant_id: int,
        role_uuid: str,
        item: FieldPermissionPolicyUpsert,
        existing_by_key: dict[tuple[str, str], FieldPermissionPolicy],
        key: tuple[str, str],
    ) -> None:
        row = existing_by_key.get(key)
        if row:
            row.resource = item.resource
            row.field_name = item.field_name
            row.mask_level = item.mask_level
            row.deleted_at = None
            await row.save(
                update_fields=["resource", "field_name", "mask_level", "deleted_at", "updated_at"]
            )
            existing_by_key[key] = row
            return

        try:
            created = await FieldPermissionPolicy.create(
                tenant_id=tenant_id,
                role_uuid=role_uuid,
                resource=item.resource,
                field_name=item.field_name,
                mask_level=item.mask_level,
            )
            existing_by_key[key] = created
            return
        except IntegrityError:
            # 唯一约束含已软删行：禁止 INSERT，须复用同键行
            conflict = await FieldPermissionPolicy.filter(
                tenant_id=tenant_id,
                role_uuid=role_uuid,
                resource=item.resource,
                field_name=item.field_name,
            ).order_by("-updated_at", "-id").first()
            if not conflict:
                raise
            conflict.resource = item.resource
            conflict.field_name = item.field_name
            conflict.mask_level = item.mask_level
            conflict.deleted_at = None
            await conflict.save(
                update_fields=["resource", "field_name", "mask_level", "deleted_at", "updated_at"]
            )
            existing_by_key[key] = conflict

    @classmethod
    async def save_field_policies(
        cls,
        tenant_id: int,
        role_uuid: str,
        items: Iterable[FieldPermissionPolicyUpsert],
    ) -> list[FieldPermissionPolicyResponse]:
        allowed = await cls._collect_allowed_function_resources(tenant_id=tenant_id)
        alias_map = await cls._load_tenant_field_alias_map(tenant_id=tenant_id)
        now = now_utc()
        explicit: dict[tuple[str, str], FieldPermissionPolicyUpsert] = {}
        for item in items:
            level = item.mask_level.strip().lower()
            if level not in cls.FIELD_MASK_LEVELS:
                raise ValidationError(f"无效字段权限级别: {item.mask_level}")
            resource = cls._normalize_resource(item.resource)
            if resource not in allowed:
                raise ValidationError(f"无效字段权限资源（非真源资源）: {item.resource}")
            key = cls._field_policy_key(item.resource, item.field_name, alias_map)
            if not key:
                raise ValidationError("字段名不能为空")
            explicit[key] = FieldPermissionPolicyUpsert(
                resource=key[0],
                field_name=key[1],
                mask_level=level,
            )

        # 内置默认：对当前角色已配置的数据权限资源，自动补齐“金额/客户名”字段脱敏策略。
        data_resources = await DataPermissionPolicy.filter(
            tenant_id=tenant_id,
            role_uuid=role_uuid,
            deleted_at__isnull=True,
        ).values_list("resource", flat=True)
        normalized_resources = sorted(
            {cls._normalize_resource(r) for r in data_resources if cls._normalize_resource(r) in allowed}
        )
        for resource in normalized_resources:
            for field_name in sorted(cls.BUILTIN_MASKED_FIELD_NAMES):
                key = cls._field_policy_key(resource, field_name, alias_map)
                if not key or key in explicit:
                    continue
                explicit[key] = FieldPermissionPolicyUpsert(
                    resource=key[0],
                    field_name=key[1],
                    mask_level=FieldMaskLevel.MASKED,
                )

        desired_keys = set(explicit.keys())

        async with in_transaction():
            existing = await FieldPermissionPolicy.filter(
                tenant_id=tenant_id,
                role_uuid=role_uuid,
            ).order_by("-updated_at", "-id")
            existing_by_key: dict[tuple[str, str], FieldPermissionPolicy] = {}
            for row in existing:
                key = cls._field_policy_key(row.resource, row.field_name, alias_map)
                if not key:
                    continue
                prev = existing_by_key.get(key)
                if prev is None:
                    existing_by_key[key] = row
                else:
                    existing_by_key[key] = cls._pick_preferred_field_policy_row(prev, row)

            for key, item in explicit.items():
                await cls._upsert_field_policy_row(
                    tenant_id=tenant_id,
                    role_uuid=role_uuid,
                    item=item,
                    existing_by_key=existing_by_key,
                    key=key,
                )

            active_rows = await FieldPermissionPolicy.filter(
                tenant_id=tenant_id,
                role_uuid=role_uuid,
                deleted_at__isnull=True,
            )
            seen_desired: set[tuple[str, str]] = set()
            for row in active_rows:
                key = cls._field_policy_key(row.resource, row.field_name, alias_map)
                if not key:
                    continue
                if key not in desired_keys:
                    row.deleted_at = now
                    await row.save(update_fields=["deleted_at", "updated_at"])
                    continue
                if key in seen_desired:
                    row.deleted_at = now
                    await row.save(update_fields=["deleted_at", "updated_at"])
                    continue
                seen_desired.add(key)

        return await cls.list_field_policies(tenant_id=tenant_id, role_uuid=role_uuid)

    @classmethod
    async def canonicalize_field_policies(
        cls,
        tenant_id: int,
        role_uuid: str | None = None,
    ) -> dict[str, int]:
        alias_map = await cls._load_tenant_field_alias_map(tenant_id=tenant_id)
        query = FieldPermissionPolicy.filter(tenant_id=tenant_id, deleted_at__isnull=True)
        if role_uuid:
            query = query.filter(role_uuid=role_uuid)
        rows = await query.order_by("role_uuid", "resource", "updated_at", "id").all()
        if not rows:
            return {"scanned": 0, "updated": 0, "merged_deleted": 0}

        grouped: dict[tuple[str, str, str], list[FieldPermissionPolicy]] = {}
        for row in rows:
            resource = cls._normalize_resource(row.resource)
            field_name = cls._canonicalize_field_name_with_aliases(row.field_name, alias_map)
            if not field_name:
                continue
            key = (row.role_uuid, resource, field_name)
            grouped.setdefault(key, []).append(row)

        updated = 0
        merged_deleted = 0
        now = now_utc()
        for (_role_uuid, resource, field_name), items in grouped.items():
            keeper = max(items, key=lambda x: (x.updated_at, x.id))
            for row in items:
                if row.id == keeper.id:
                    continue
                row.deleted_at = now
                await row.save(update_fields=["deleted_at", "updated_at"])
                merged_deleted += 1
            if keeper.resource != resource or keeper.field_name != field_name:
                keeper.resource = resource
                keeper.field_name = field_name
                await keeper.save(update_fields=["resource", "field_name", "updated_at"])
                updated += 1

        return {"scanned": len(rows), "updated": updated, "merged_deleted": merged_deleted}

    @classmethod
    async def canonicalize_field_policies_all_tenants(cls) -> dict[str, Any]:
        conn = await get_db_connection()
        try:
            tenant_rows = await conn.fetch(
                """
                SELECT id
                FROM infra_tenants
                WHERE status = 'active'
                ORDER BY id ASC
                """
            )
        finally:
            await conn.close()
        summary = {"tenant_count": len(tenant_rows), "scanned": 0, "updated": 0, "merged_deleted": 0, "failed": 0}
        details: list[dict[str, Any]] = []
        for row in tenant_rows:
            tenant_id = int(row["id"])
            try:
                result = await cls.canonicalize_field_policies(tenant_id=tenant_id, role_uuid=None)
                summary["scanned"] += int(result.get("scanned", 0))
                summary["updated"] += int(result.get("updated", 0))
                summary["merged_deleted"] += int(result.get("merged_deleted", 0))
                details.append({"tenant_id": tenant_id, "ok": True, "result": result})
            except Exception as exc:
                summary["failed"] += 1
                details.append({"tenant_id": tenant_id, "ok": False, "error": str(exc)})
        return {"summary": summary, "tenants": details}

    @classmethod
    async def _collect_user_role_uuids(cls, tenant_id: int, user_id: int) -> list[str]:
        rows = await UserRole.filter(user_id=user_id).prefetch_related("role")
        out: list[str] = []
        for row in rows:
            role = getattr(row, "role", None)
            if role and role.tenant_id == tenant_id and role.deleted_at is None:
                out.append(str(role.uuid))
        return sorted(set(out))

    @classmethod
    def _apply_single_mask(cls, value: object, level: str) -> object:
        if level == FieldMaskLevel.HIDDEN:
            return None
        if level != FieldMaskLevel.MASKED:
            return value
        if value is None:
            return None
        if isinstance(value, (int, float)):
            return 0
        raw = str(value)
        if len(raw) <= 2:
            return "*" * len(raw)
        return f"{raw[0]}{'*' * (len(raw) - 2)}{raw[-1]}"

    @classmethod
    async def apply_field_masks_to_dict(
        cls,
        tenant_id: int,
        user_id: int,
        resource: str,
        payload: dict[str, Any],
    ) -> dict[str, Any]:
        role_uuids = await cls._collect_user_role_uuids(tenant_id=tenant_id, user_id=user_id)
        if not role_uuids:
            return payload
        alias_map = await cls._load_tenant_field_alias_map(tenant_id=tenant_id)
        policies = await FieldPermissionPolicy.filter(
            tenant_id=tenant_id,
            role_uuid__in=role_uuids,
            resource=cls._normalize_resource(resource),
            deleted_at__isnull=True,
        ).all()
        if not policies:
            return payload
        priority = {FieldMaskLevel.FULL: 0, FieldMaskLevel.MASKED: 1, FieldMaskLevel.HIDDEN: 2}
        effective: dict[str, str] = {}
        for row in policies:
            field = cls._canonicalize_field_name_with_aliases(row.field_name, alias_map)
            if not field:
                continue
            prev = effective.get(field)
            if prev is None or priority.get(row.mask_level, 0) > priority.get(prev, 0):
                effective[field] = row.mask_level
        if not effective:
            return payload
        out = dict(payload)
        for k, v in payload.items():
            canonical = cls._canonicalize_field_name_with_aliases(k, alias_map)
            level = effective.get(canonical)
            if not level:
                continue
            out[k] = cls._apply_single_mask(v, level)
        return out
