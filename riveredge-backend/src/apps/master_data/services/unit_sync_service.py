"""物料单位从数据接口/数据集独立同步。"""

from __future__ import annotations

from typing import Any, Dict, List, Optional

from tortoise.expressions import Q

from infra.exceptions.exceptions import ValidationError
from infra.models.user import User

from apps.common.audit_actor import apply_create_audit, apply_update_audit
from apps.master_data.models.master_data_sync_binding import MaterialUnitSyncBinding
from apps.master_data.models.unit import MaterialUnit
from apps.master_data.schemas.master_data_sync import (
    MasterDataSyncBindingOut,
    MasterDataSyncBindingUpsert,
    MasterDataSyncFromSourceOut,
    MasterDataSyncFromSourceRequest,
)
from apps.master_data.services.master_data_sync_common import (
    cell_str,
    fetch_sync_rows,
    map_sync_rows,
    mark_binding_failure,
    mark_binding_success,
    mark_external_sync_record,
    normalize_schedule_interval,
    normalize_sync_mode,
    resolve_incremental_since,
    resolve_sync_config,
    serialize_binding_row,
    upsert_sync_binding,
)
from core.utils.timezone_utils import resolve_business_datetime


class MaterialUnitSyncService:
    MATCH_KEY = "code"

    def serialize_binding(self, row: Optional[MaterialUnitSyncBinding]) -> MasterDataSyncBindingOut:
        data = serialize_binding_row(row, default_match_key=self.MATCH_KEY)
        return MasterDataSyncBindingOut(**data)

    async def upsert_binding(
        self,
        tenant_id: int,
        body: MasterDataSyncBindingUpsert,
    ) -> MasterDataSyncBindingOut:
        source_type = (body.source_type or "").strip()
        api_uuid = (body.api_uuid or "").strip() or None
        dataset_uuid = (body.dataset_uuid or "").strip() or None
        if not source_type and not api_uuid and not dataset_uuid:
            await MaterialUnitSyncBinding.filter(tenant_id=tenant_id).delete()
            return MasterDataSyncBindingOut(match_key_field=self.MATCH_KEY)

        field_mapping = body.field_mapping if isinstance(body.field_mapping, dict) else {}
        match_key = (body.match_key_field or self.MATCH_KEY).strip() or self.MATCH_KEY
        sync_mode = normalize_sync_mode(body.sync_mode)
        interval = normalize_schedule_interval(body.schedule_interval_minutes)
        row = await upsert_sync_binding(
            MaterialUnitSyncBinding,
            tenant_id,
            source_type=source_type,
            api_uuid=api_uuid,
            dataset_uuid=dataset_uuid,
            field_mapping=field_mapping,
            match_key_field=match_key,
            sync_mode=sync_mode,
            schedule_interval_minutes=interval,
        )
        return self.serialize_binding(row)

    async def get_binding(self, tenant_id: int) -> MasterDataSyncBindingOut:
        row = await MaterialUnitSyncBinding.filter(tenant_id=tenant_id).first()
        return self.serialize_binding(row)

    async def has_binding(self, tenant_id: int) -> bool:
        row = await MaterialUnitSyncBinding.filter(tenant_id=tenant_id).first()
        return bool(row and (row.source_type or "").strip())

    async def sync_from_source(
        self,
        tenant_id: int,
        current_user: Optional[User],
        request: Optional[MasterDataSyncFromSourceRequest] = None,
    ) -> MasterDataSyncFromSourceOut:
        req = request or MasterDataSyncFromSourceRequest()
        source_type, api_uuid, dataset_uuid, field_mapping, match_key = await resolve_sync_config(
            MaterialUnitSyncBinding,
            tenant_id,
            req,
            default_match_key=self.MATCH_KEY,
        )
        if not source_type:
            raise ValidationError("请配置单位同步来源（数据接口或数据集）")
        if not field_mapping:
            raise ValidationError("请配置单位同步字段映射")
        if match_key not in field_mapping.values():
            raise ValidationError(f"字段映射须包含匹配键 {match_key}")

        binding = await MaterialUnitSyncBinding.filter(tenant_id=tenant_id).first()
        sync_mode = normalize_sync_mode(
            req.sync_mode or (binding.sync_mode if binding else None)
        )
        interval = normalize_schedule_interval(
            req.schedule_interval_minutes
            if req.schedule_interval_minutes is not None
            else (binding.schedule_interval_minutes if binding else None)
        )

        if req.save_binding:
            await self.upsert_binding(
                tenant_id,
                MasterDataSyncBindingUpsert(
                    source_type=source_type,
                    api_uuid=api_uuid,
                    dataset_uuid=dataset_uuid,
                    field_mapping=field_mapping,
                    match_key_field=match_key,
                    sync_mode=sync_mode,
                    schedule_interval_minutes=interval,
                ),
            )
            binding = await MaterialUnitSyncBinding.filter(tenant_id=tenant_id).first()

        since = resolve_incremental_since(
            binding,
            sync_mode=sync_mode,
            request_incremental=req.incremental,
        )
        try:
            raw_rows = await fetch_sync_rows(
                tenant_id,
                source_type=source_type,
                api_uuid=api_uuid,
                dataset_uuid=dataset_uuid,
                since=since,
                active_only=req.active_only,
            )
            rows = map_sync_rows(raw_rows, field_mapping)
            result = await self._upsert_units(tenant_id, current_user, rows, match_key)
            if binding:
                if result.failed and not (result.created or result.updated):
                    await mark_binding_failure(binding, "; ".join(result.errors) or "单位同步失败")
                else:
                    await mark_binding_success(binding)
            return result
        except Exception as exc:
            if binding:
                await mark_binding_failure(binding, str(exc))
            raise

    async def _upsert_units(
        self,
        tenant_id: int,
        current_user: Optional[User],
        rows: List[Dict[str, Any]],
        match_key: str,
    ) -> MasterDataSyncFromSourceOut:
        created = 0
        updated = 0
        skipped = 0
        failed = 0
        errors: List[str] = []
        sync_at = resolve_business_datetime()

        pending: List[tuple[str, str, bool]] = []
        for row in rows:
            code = cell_str(row.get(match_key) or row.get("code"))
            name = cell_str(row.get("name"))
            if not code:
                skipped += 1
                errors.append("存在缺少单位编码的行，已跳过")
                continue
            if not name:
                skipped += 1
                errors.append(f"单位 {code} 缺少名称，已跳过")
                continue
            is_active_raw = row.get("is_active")
            is_active = True
            if is_active_raw is not None and str(is_active_raw).strip():
                is_active = str(is_active_raw).strip().lower() not in (
                    "0",
                    "false",
                    "no",
                    "n",
                    "否",
                    "停用",
                    "inactive",
                    "disabled",
                )
            pending.append((code, name, is_active))

        if not pending:
            return MasterDataSyncFromSourceOut(
                created=created,
                updated=updated,
                skipped=skipped,
                failed=failed,
                errors=errors[:20],
            )

        codes = [item[0] for item in pending]
        names = [item[1] for item in pending]
        existing_rows = await MaterialUnit.filter(
            tenant_id=tenant_id,
            deleted_at__isnull=True,
        ).filter(Q(code__in=codes) | Q(name__in=names)).all()
        existing_by_code = {item.code: item for item in existing_rows}
        existing_by_name = {item.name: item for item in existing_rows}

        for code, name, is_active in pending:
            try:
                # 同名优先复用本地单位（如预设「吨」），避免金蝶 FNumber=001 另插一条
                existing = existing_by_code.get(code) or existing_by_name.get(name)
                if existing:
                    existing.name = name
                    existing.is_active = is_active
                    apply_update_audit(existing, current_user)
                    await existing.save(
                        update_fields=[
                            "name",
                            "is_active",
                            "updated_at",
                            "updated_by",
                            "updated_by_name",
                        ],
                    )
                    await mark_external_sync_record(existing)
                    existing_by_code[existing.code] = existing
                    existing_by_name[existing.name] = existing
                    updated += 1
                else:
                    payload: Dict[str, Any] = {
                        "code": code,
                        "name": name,
                        "is_active": is_active,
                        "is_system": False,
                        "sort_order": 0,
                        "external_sync_at": sync_at,
                    }
                    apply_create_audit(payload, current_user)
                    unit = await MaterialUnit.create(tenant_id=tenant_id, **payload)
                    existing_by_code[unit.code] = unit
                    existing_by_name[unit.name] = unit
                    created += 1
            except Exception as exc:
                failed += 1
                errors.append(f"单位 {code}：{exc}")

        return MasterDataSyncFromSourceOut(
            created=created,
            updated=updated,
            skipped=skipped,
            failed=failed,
            errors=errors[:20],
        )
