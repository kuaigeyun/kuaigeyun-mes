"""物料从数据接口/数据集同步。"""

from __future__ import annotations

from typing import Any, Dict, List, Optional, Tuple

from infra.exceptions.exceptions import ValidationError
from infra.models.user import User

from apps.common.audit_actor import apply_create_audit, apply_update_audit
from apps.master_data.constants.material_source_type import require_canonical_material_source_type
from apps.master_data.models.material import Material
from apps.master_data.models.master_data_sync_binding import MaterialSyncBinding
from apps.master_data.schemas.master_data_sync import (
    MasterDataSyncBindingOut,
    MasterDataSyncBindingUpsert,
    MasterDataSyncFromSourceOut,
    MasterDataSyncFromSourceRequest,
)
from apps.master_data.services.master_data_sync_common import (
    apply_mapped_custom_field_values,
    attach_sync_fetch_meta,
    cell_optional_bool,
    cell_optional_decimal,
    cell_optional_int,
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
from apps.master_data.services.sync_association_service import (
    ensure_material_groups_from_material_rows,
    load_material_group_id_lookup,
    load_material_unit_lookup,
    resolve_material_base_unit_from_lookup,
    resolve_material_group_id_from_lookup,
    run_material_prerequisite_syncs,
)
from core.services.data.sync_progress import emit_sync_progress
from core.utils.timezone_utils import resolve_business_datetime

MATERIAL_CUSTOM_FIELD_TABLE = "master_data_materials"

# 映射目标中可直接写入 Material 标量列的字段（不含 main_code / name / 解析型辅助字段）
MATERIAL_SYNC_EXTRA_SCALAR_FIELDS = frozenset(
    {
        "description",
        "brand",
        "model",
        "texture",
        "barcode",
        "source_type",
        "is_active",
        "batch_managed",
        "serial_managed",
        "variant_managed",
        "weight",
        "volume",
        "shelf_life_managed",
        "shelf_life_days",
        "is_giftable",
        "reference_cost",
        "country_of_origin",
        "customs_code",
        "over_report_mode",
        "over_report_value",
        "inspection_mode",
    }
)

MATERIAL_SYNC_BOOL_FIELDS = frozenset(
    {
        "is_active",
        "batch_managed",
        "serial_managed",
        "variant_managed",
        "shelf_life_managed",
        "is_giftable",
    }
)

MATERIAL_SYNC_DECIMAL_FIELDS = frozenset({"weight", "volume", "reference_cost", "over_report_value"})
MATERIAL_SYNC_INT_FIELDS = frozenset({"shelf_life_days"})


def _coerce_material_extra_value(field_name: str, raw: Any) -> Any:
    if field_name in MATERIAL_SYNC_BOOL_FIELDS:
        return cell_optional_bool(raw)
    if field_name in MATERIAL_SYNC_DECIMAL_FIELDS:
        return cell_optional_decimal(raw)
    if field_name in MATERIAL_SYNC_INT_FIELDS:
        return cell_optional_int(raw)
    if field_name == "source_type":
        text = cell_str(raw)
        if not text:
            return None
        return require_canonical_material_source_type(text)
    text = cell_str(raw)
    return text or None


def _apply_material_extra_scalars(
    material: Material,
    row: Dict[str, Any],
    update_fields: List[str],
) -> None:
    for field_name in MATERIAL_SYNC_EXTRA_SCALAR_FIELDS:
        if field_name not in row:
            continue
        coerced = _coerce_material_extra_value(field_name, row.get(field_name))
        if coerced is None and field_name in MATERIAL_SYNC_BOOL_FIELDS:
            continue
        if coerced is None and field_name in {"weight", "volume", "over_report_value"}:
            # Decimal 列有 default；空映射跳过，避免清零
            continue
        setattr(material, field_name, coerced)
        if field_name not in update_fields:
            update_fields.append(field_name)


class MaterialSyncService:
    MATCH_KEY = "main_code"

    def serialize_binding(self, row: Optional[MaterialSyncBinding]) -> MasterDataSyncBindingOut:
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
            await MaterialSyncBinding.filter(tenant_id=tenant_id).delete()
            return MasterDataSyncBindingOut(match_key_field=self.MATCH_KEY)

        field_mapping = body.field_mapping if isinstance(body.field_mapping, dict) else {}
        match_key = (body.match_key_field or self.MATCH_KEY).strip() or self.MATCH_KEY
        sync_mode = normalize_sync_mode(body.sync_mode)
        interval = normalize_schedule_interval(body.schedule_interval_minutes)
        row = await upsert_sync_binding(
            MaterialSyncBinding,
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
        row = await MaterialSyncBinding.filter(tenant_id=tenant_id).first()
        return self.serialize_binding(row)

    async def sync_from_source(
        self,
        tenant_id: int,
        current_user: Optional[User],
        request: Optional[MasterDataSyncFromSourceRequest] = None,
        *,
        skip_prerequisite_syncs: bool = False,
    ) -> MasterDataSyncFromSourceOut:
        req = request or MasterDataSyncFromSourceRequest()
        source_type, api_uuid, dataset_uuid, field_mapping, match_key = await resolve_sync_config(
            MaterialSyncBinding,
            tenant_id,
            req,
            default_match_key=self.MATCH_KEY,
        )
        if not source_type:
            raise ValidationError("请配置同步来源（数据接口或数据集）")
        if not field_mapping:
            raise ValidationError("请配置字段映射")
        if match_key not in field_mapping.values():
            raise ValidationError(f"字段映射须包含匹配键 {match_key}")

        binding = await MaterialSyncBinding.filter(tenant_id=tenant_id).first()
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
            binding = await MaterialSyncBinding.filter(tenant_id=tenant_id).first()

        prerequisite_errors: List[str] = []
        if not skip_prerequisite_syncs and not req.skip_prerequisite_syncs:
            if current_user is None:
                raise ValidationError("关联同步须指定操作用户")
            prerequisite_errors = await run_material_prerequisite_syncs(tenant_id, current_user)

        since = resolve_incremental_since(
            binding,
            sync_mode=sync_mode,
            request_incremental=req.incremental,
        )

        try:
            await emit_sync_progress("开始同步物料…")
            raw_rows = await fetch_sync_rows(
                tenant_id,
                source_type=source_type,
                api_uuid=api_uuid,
                dataset_uuid=dataset_uuid,
                since=since,
                active_only=req.active_only,
            )
            rows = map_sync_rows(raw_rows, field_mapping)
            await emit_sync_progress(f"字段映射完成，准备写入 {len(rows)} 条物料…")
            result = await self._upsert_materials(tenant_id, current_user, rows, match_key)
            attach_sync_fetch_meta(result, fetched=len(raw_rows), since=since)
            if prerequisite_errors:
                result.errors = (prerequisite_errors + list(result.errors))[:20]
            if binding:
                if result.failed and not (result.created or result.updated):
                    await mark_binding_failure(
                        binding,
                        "; ".join(result.errors) or "物料同步失败",
                    )
                else:
                    await mark_binding_success(binding)
            return result
        except Exception as exc:
            if binding:
                await mark_binding_failure(binding, str(exc))
            raise

    async def _upsert_materials(
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
        custom_fields_by_code = await load_custom_fields_by_code(
            tenant_id, MATERIAL_CUSTOM_FIELD_TABLE
        )

        PendingRow = Tuple[
            str,
            str,
            Optional[str],
            str,
            Optional[str],
            Optional[str],
            Optional[str],
            Dict[str, Any],
        ]
        pending_rows: List[PendingRow] = []
        for row in rows:
            main_code = cell_str(row.get(match_key) or row.get("main_code") or row.get("code"))
            name = cell_str(row.get("name"))
            base_unit = cell_str(row.get("base_unit"))
            base_unit_name = cell_str(row.get("base_unit_name")) or None
            group_code = cell_str(row.get("group_code")) or None
            group_name = cell_str(row.get("group_name")) or None
            if not main_code:
                skipped += 1
                errors.append("存在缺少物料编码的行，已跳过")
                continue
            if not name:
                skipped += 1
                errors.append(f"物料 {main_code} 缺少名称，已跳过")
                continue
            if not base_unit and not base_unit_name:
                failed += 1
                errors.append(f"物料 {main_code} 缺少基本单位 base_unit / base_unit_name")
                continue
            specification = cell_str(row.get("specification")) or None
            pending_rows.append(
                (
                    main_code,
                    name,
                    specification,
                    base_unit,
                    base_unit_name,
                    group_code,
                    group_name,
                    row,
                )
            )

        if not pending_rows:
            return MasterDataSyncFromSourceOut(
                created=created,
                updated=updated,
                skipped=skipped,
                failed=failed,
                errors=errors[:20],
            )

        total = len(pending_rows)
        await emit_sync_progress(f"正在预加载单位与分组映射，准备写入 {total} 条物料…")
        unit_by_code, unit_by_name = await load_material_unit_lookup(tenant_id)
        group_by_code = await load_material_group_id_lookup(tenant_id)
        group_pairs = [
            (group_code, group_name or "")
            for *_, group_code, group_name, _row in pending_rows
            if group_code
        ]
        if group_pairs:
            await emit_sync_progress("正在根据物料行补齐本地物料分组…")
            group_by_code = await ensure_material_groups_from_material_rows(
                tenant_id,
                current_user,
                group_by_code=group_by_code,
                group_pairs=group_pairs,
            )

        codes = [item[0] for item in pending_rows]
        existing_by_code: Dict[str, Material] = {}
        lookup_chunk = 2000
        for offset in range(0, len(codes), lookup_chunk):
            chunk_codes = codes[offset : offset + lookup_chunk]
            existing_rows = await Material.filter(
                tenant_id=tenant_id,
                main_code__in=chunk_codes,
                deleted_at__isnull=True,
            ).all()
            for item in existing_rows:
                existing_by_code[item.main_code] = item

        to_update: List[Material] = []
        to_create: List[Material] = []
        custom_payload_by_code: Dict[str, Dict[str, Any]] = {}
        update_fields = [
            "name",
            "specification",
            "base_unit",
            "group_id",
            "external_sync_at",
            "updated_at",
            "updated_by",
            "updated_by_name",
        ]

        for index, (
            main_code,
            name,
            specification,
            base_unit,
            base_unit_name,
            group_code,
            group_name,
            mapped_row,
        ) in enumerate(pending_rows, start=1):
            if index == 1 or index == total or index % 500 == 0:
                await emit_sync_progress(f"正在解析物料 {index}/{total}：{main_code}")
            try:
                resolved_unit = resolve_material_base_unit_from_lookup(
                    unit_by_code,
                    unit_by_name,
                    unit_code=base_unit,
                    unit_name=base_unit_name or "",
                )
                group_id = (
                    resolve_material_group_id_from_lookup(group_by_code, group_code)
                    if group_code
                    else None
                )
                custom_payload_by_code[main_code] = mapped_row
                existing = existing_by_code.get(main_code)
                if existing:
                    existing.name = name
                    existing.specification = specification
                    existing.base_unit = resolved_unit
                    if group_id is not None:
                        existing.group_id = group_id
                    _apply_material_extra_scalars(existing, mapped_row, update_fields)
                    existing.external_sync_at = sync_at
                    existing.updated_at = sync_at
                    if current_user is not None:
                        apply_update_audit(existing, current_user)
                    to_update.append(existing)
                else:
                    source_type = (
                        _coerce_material_extra_value("source_type", mapped_row.get("source_type"))
                        if "source_type" in mapped_row
                        else None
                    ) or require_canonical_material_source_type(
                        "Buy",
                        material_code=main_code,
                        material_name=name,
                    )
                    payload: Dict[str, Any] = {
                        "tenant_id": tenant_id,
                        "main_code": main_code,
                        "code": main_code,
                        "name": name,
                        "specification": specification,
                        "base_unit": resolved_unit,
                        "source_type": source_type,
                        "is_active": True,
                        "variant_managed": False,
                        "external_sync_at": sync_at,
                    }
                    if group_id is not None:
                        payload["group_id"] = group_id
                    if current_user is not None:
                        apply_create_audit(payload, current_user)
                    material = Material(**payload)
                    _apply_material_extra_scalars(material, mapped_row, [])
                    to_create.append(material)
            except Exception as exc:
                failed += 1
                errors.append(f"物料 {main_code}：{exc}")

        write_batch = 500

        async def _write_custom_fields_for_materials(materials: List[Material]) -> None:
            if not custom_fields_by_code or not materials:
                return
            for material in materials:
                mapped = custom_payload_by_code.get(material.main_code)
                if not mapped:
                    continue
                try:
                    await apply_mapped_custom_field_values(
                        tenant_id=tenant_id,
                        record_table=MATERIAL_CUSTOM_FIELD_TABLE,
                        record_id=int(material.id),
                        mapped_row=mapped,
                        fields_by_code=custom_fields_by_code,
                    )
                except Exception as cf_exc:
                    errors.append(f"物料 {material.main_code} 自定义字段：{cf_exc}")

        async def _flush_updates(batch: List[Material], start_index: int) -> None:
            nonlocal updated, failed
            if not batch:
                return
            end_index = start_index + len(batch) - 1
            await emit_sync_progress(
                f"正在批量更新物料 {start_index}-{end_index}/{len(to_update)}…"
            )
            try:
                await Material.bulk_update(batch, fields=update_fields, batch_size=write_batch)
                updated += len(batch)
                await _write_custom_fields_for_materials(batch)
            except Exception:
                for material in batch:
                    try:
                        await material.save(update_fields=update_fields)
                        updated += 1
                        await _write_custom_fields_for_materials([material])
                    except Exception as row_exc:
                        failed += 1
                        errors.append(f"物料 {material.main_code}：{row_exc}")

        async def _flush_creates(batch: List[Material], start_index: int) -> None:
            nonlocal created, failed
            if not batch:
                return
            end_index = start_index + len(batch) - 1
            await emit_sync_progress(
                f"正在批量新建物料 {start_index}-{end_index}/{len(to_create)}…"
            )
            try:
                await Material.bulk_create(batch, batch_size=write_batch)
                created += len(batch)
                codes_created = [item.main_code for item in batch]
                persisted = await Material.filter(
                    tenant_id=tenant_id,
                    main_code__in=codes_created,
                    deleted_at__isnull=True,
                ).all()
                await _write_custom_fields_for_materials(persisted)
            except Exception:
                for material in batch:
                    try:
                        await material.save()
                        created += 1
                        await _write_custom_fields_for_materials([material])
                    except Exception as row_exc:
                        failed += 1
                        errors.append(f"物料 {material.main_code}：{row_exc}")

        for offset in range(0, len(to_update), write_batch):
            await _flush_updates(to_update[offset : offset + write_batch], offset + 1)
        for offset in range(0, len(to_create), write_batch):
            await _flush_creates(to_create[offset : offset + write_batch], offset + 1)

        await emit_sync_progress(
            f"物料写入完成：新建 {created}，更新 {updated}，跳过 {skipped}，失败 {failed}"
        )
        return MasterDataSyncFromSourceOut(
            created=created,
            updated=updated,
            skipped=skipped,
            failed=failed,
            errors=errors[:20],
        )
