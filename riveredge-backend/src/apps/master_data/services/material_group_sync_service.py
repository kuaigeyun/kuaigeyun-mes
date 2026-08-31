"""物料分组从数据接口/数据集独立同步。"""

from __future__ import annotations

from typing import Any, Dict, List, Optional

from infra.exceptions.exceptions import ValidationError
from infra.models.user import User

from apps.common.audit_actor import apply_create_audit, apply_update_audit
from apps.master_data.models.material import MaterialGroup
from apps.master_data.models.master_data_sync_binding import MaterialGroupSyncBinding
from apps.master_data.schemas.master_data_sync import (
    MasterDataSyncBindingOut,
    MasterDataSyncBindingUpsert,
    MasterDataSyncFromSourceOut,
    MasterDataSyncFromSourceRequest,
)
from apps.master_data.services.master_data_sync_common import (
    apply_sync_extras_after_write,
    attach_sync_fetch_meta,
    cell_str,
    fetch_sync_rows,
    load_custom_fields_by_code,
    map_sync_rows,
    mark_binding_failure,
    mark_binding_success,
    normalize_schedule_interval,
    normalize_sync_mode,
    resolve_incremental_since,
    resolve_sync_config,
    serialize_binding_row,
    upsert_sync_binding,
)

MATERIAL_GROUP_CUSTOM_FIELD_TABLE = "master_data_material_groups"
MATERIAL_GROUP_SYNC_STRING_FIELDS = frozenset({"alias", "description"})
MATERIAL_GROUP_SYNC_BOOL_FIELDS = frozenset({"is_active"})


class MaterialGroupSyncService:
    MATCH_KEY = "code"

    def serialize_binding(self, row: Optional[MaterialGroupSyncBinding]) -> MasterDataSyncBindingOut:
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
            await MaterialGroupSyncBinding.filter(tenant_id=tenant_id).delete()
            return MasterDataSyncBindingOut(match_key_field=self.MATCH_KEY)

        field_mapping = body.field_mapping if isinstance(body.field_mapping, dict) else {}
        match_key = (body.match_key_field or self.MATCH_KEY).strip() or self.MATCH_KEY
        sync_mode = normalize_sync_mode(body.sync_mode)
        interval = normalize_schedule_interval(body.schedule_interval_minutes)
        row = await upsert_sync_binding(
            MaterialGroupSyncBinding,
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
        row = await MaterialGroupSyncBinding.filter(tenant_id=tenant_id).first()
        return self.serialize_binding(row)

    async def has_binding(self, tenant_id: int) -> bool:
        row = await MaterialGroupSyncBinding.filter(tenant_id=tenant_id).first()
        return bool(row and (row.source_type or "").strip())

    async def sync_from_source(
        self,
        tenant_id: int,
        current_user: Optional[User],
        request: Optional[MasterDataSyncFromSourceRequest] = None,
    ) -> MasterDataSyncFromSourceOut:
        req = request or MasterDataSyncFromSourceRequest()
        source_type, api_uuid, dataset_uuid, field_mapping, match_key = await resolve_sync_config(
            MaterialGroupSyncBinding,
            tenant_id,
            req,
            default_match_key=self.MATCH_KEY,
        )
        if not source_type:
            raise ValidationError("请配置物料分组同步来源（数据接口或数据集）")
        if not field_mapping:
            raise ValidationError("请配置物料分组同步字段映射")
        if match_key not in field_mapping.values():
            raise ValidationError(f"字段映射须包含匹配键 {match_key}")

        binding = await MaterialGroupSyncBinding.filter(tenant_id=tenant_id).first()
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
            binding = await MaterialGroupSyncBinding.filter(tenant_id=tenant_id).first()

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
            result = await self._upsert_groups(tenant_id, current_user, rows, match_key)
            attach_sync_fetch_meta(result, fetched=len(raw_rows), since=since)
            if not raw_rows:
                raise ValidationError(
                    "物料分组源端未返回任何行。请检查绑定的金蝶接口 FormId 是否为 BD_MATERIALGROUP，"
                    "以及 FilterString/FieldKeys；可在连接器中重新「加载常用接口」升级物料分组预置后重试"
                )
            if result.created == 0 and result.updated == 0 and (result.skipped or result.failed):
                raise ValidationError(
                    "物料分组拉取后未能写入任何有效分组："
                    + ("；".join(result.errors) or "请检查字段映射是否包含编码与名称")
                )
            if binding:
                if result.failed and not (result.created or result.updated):
                    await mark_binding_failure(binding, "; ".join(result.errors) or "物料分组同步失败")
                else:
                    await mark_binding_success(binding)
            return result
        except Exception as exc:
            if binding:
                await mark_binding_failure(binding, str(exc))
            raise

    async def _upsert_groups(
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

        pending: List[tuple[str, str, Optional[str], Dict[str, Any]]] = []
        for row in rows:
            code = cell_str(row.get(match_key) or row.get("code"))
            name = cell_str(row.get("name"))
            parent_code = cell_str(row.get("parent_code")) or None
            if not code:
                skipped += 1
                errors.append("存在缺少分组编码的行，已跳过")
                continue
            if not name:
                skipped += 1
                errors.append(f"物料分组 {code} 缺少名称，已跳过")
                continue
            pending.append((code, name, parent_code, row))

        if not pending:
            return MasterDataSyncFromSourceOut(
                created=created,
                updated=updated,
                skipped=skipped,
                failed=failed,
                errors=errors[:20],
            )

        codes = [item[0] for item in pending]
        existing_rows = await MaterialGroup.filter(
            tenant_id=tenant_id,
            code__in=codes,
            deleted_at__isnull=True,
        ).all()
        existing_by_code = {item.code: item for item in existing_rows}

        parent_id_by_code: Dict[str, int] = {
            item.code: item.id for item in existing_by_code.values()
        }
        all_groups = await MaterialGroup.filter(
            tenant_id=tenant_id,
            deleted_at__isnull=True,
        ).all()
        for group in all_groups:
            parent_id_by_code[group.code] = group.id

        custom_fields_by_code = await load_custom_fields_by_code(
            tenant_id, MATERIAL_GROUP_CUSTOM_FIELD_TABLE
        )

        for code, name, parent_code, mapped_row in pending:
            try:
                parent_id = parent_id_by_code.get(parent_code) if parent_code else None
                if parent_code and parent_id is None:
                    raise ValidationError(f"父分组编码 {parent_code} 不存在，请先同步父分组")

                existing = existing_by_code.get(code)
                if existing:
                    existing.name = name
                    if parent_code is not None:
                        existing.parent_id = parent_id
                    apply_update_audit(existing, current_user)
                    update_fields = [
                        "name",
                        "updated_at",
                        "updated_by",
                        "updated_by_name",
                    ]
                    if parent_code is not None:
                        update_fields.append("parent_id")
                    await existing.save(update_fields=update_fields)
                    await apply_sync_extras_after_write(
                        tenant_id=tenant_id,
                        record=existing,
                        mapped_row=mapped_row,
                        record_table=MATERIAL_GROUP_CUSTOM_FIELD_TABLE,
                        fields_by_code=custom_fields_by_code,
                        string_fields=MATERIAL_GROUP_SYNC_STRING_FIELDS,
                        bool_fields=MATERIAL_GROUP_SYNC_BOOL_FIELDS,
                    )
                    updated += 1
                else:
                    payload: Dict[str, Any] = {
                        "code": code,
                        "name": name,
                        "is_active": True,
                    }
                    if parent_id is not None:
                        payload["parent_id"] = parent_id
                    apply_create_audit(payload, current_user)
                    group = await MaterialGroup.create(tenant_id=tenant_id, **payload)
                    await apply_sync_extras_after_write(
                        tenant_id=tenant_id,
                        record=group,
                        mapped_row=mapped_row,
                        record_table=MATERIAL_GROUP_CUSTOM_FIELD_TABLE,
                        fields_by_code=custom_fields_by_code,
                        string_fields=MATERIAL_GROUP_SYNC_STRING_FIELDS,
                        bool_fields=MATERIAL_GROUP_SYNC_BOOL_FIELDS,
                    )
                    existing_by_code[code] = group
                    parent_id_by_code[code] = group.id
                    created += 1
            except Exception as exc:
                failed += 1
                errors.append(f"物料分组 {code}：{exc}")

        return MasterDataSyncFromSourceOut(
            created=created,
            updated=updated,
            skipped=skipped,
            failed=failed,
            errors=errors[:20],
        )
