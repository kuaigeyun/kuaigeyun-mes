"""仓库从数据接口/数据集同步。"""
from __future__ import annotations
from typing import Any, Dict, List, Optional
from infra.exceptions.exceptions import ValidationError
from infra.models.user import User
from apps.master_data.models.master_data_sync_binding import WarehouseSyncBinding
from apps.master_data.models.warehouse import Warehouse
from apps.master_data.schemas.master_data_sync import (
    MasterDataSyncBindingOut,
    MasterDataSyncBindingUpsert,
    MasterDataSyncFromSourceOut,
    MasterDataSyncFromSourceRequest,
)
from apps.master_data.schemas.warehouse_schemas import WarehouseCreate, WarehouseUpdate
from apps.master_data.services.master_data_sync_common import (
    apply_sync_extras_after_write,
    cell_str,
    fetch_sync_rows,
    load_custom_fields_by_code,
    map_sync_rows,
    mark_binding_failure,
    mark_binding_success,
    mark_external_sync_record,
    normalize_schedule_interval,
    normalize_sync_mode,
    resolve_incremental_since,
    resolve_sync_sources,
    serialize_binding_row,
    sources_from_upsert_body,
    upsert_sync_binding,
)
from core.services.data.sync_binding_sources import fetch_mapped_rows_from_sources

WAREHOUSE_CUSTOM_FIELD_TABLE = "master_data_warehouse_warehouses"
WAREHOUSE_SYNC_STRING_FIELDS = frozenset({"description", "warehouse_type"})
WAREHOUSE_SYNC_BOOL_FIELDS = frozenset({"is_active"})
from apps.master_data.services.warehouse_service import WarehouseService
def _map_kingdee_forbid_to_is_active(forbid_status: object) -> bool:
    """金蝶 FForbidStatus：A=未禁用，B=已禁用。"""
    val = cell_str(forbid_status).upper()
    if not val:
        raise ValidationError("FForbidStatus 不能为空")
    if val == "A":
        return True
    if val == "B":
        return False
    raise ValidationError(f"未知禁用状态 FForbidStatus={forbid_status}")
class WarehouseSyncService:
    MATCH_KEY = "code"
    def serialize_binding(self, row: Optional[WarehouseSyncBinding]) -> MasterDataSyncBindingOut:
        data = serialize_binding_row(row, default_match_key=self.MATCH_KEY)
        return MasterDataSyncBindingOut(**data)
    async def upsert_binding(
        self,
        tenant_id: int,
        body: MasterDataSyncBindingUpsert,
    ) -> MasterDataSyncBindingOut:
        if body.sources is not None and len(body.sources) == 0:
            await WarehouseSyncBinding.filter(tenant_id=tenant_id).delete()
            return MasterDataSyncBindingOut()
        sources = sources_from_upsert_body(body)
        match_key = (body.match_key_field or self.MATCH_KEY).strip() or self.MATCH_KEY
        sync_mode = normalize_sync_mode(body.sync_mode)
        interval = normalize_schedule_interval(body.schedule_interval_minutes)
        row = await upsert_sync_binding(
            WarehouseSyncBinding,
            tenant_id,
            sources=sources,
            match_key_field=match_key,
            sync_mode=sync_mode,
            schedule_interval_minutes=interval,
        )
        return self.serialize_binding(row)
    async def get_binding(self, tenant_id: int) -> MasterDataSyncBindingOut:
        row = await WarehouseSyncBinding.filter(tenant_id=tenant_id).first()
        return self.serialize_binding(row)
    async def sync_from_source(
        self,
        tenant_id: int,
        current_user: User,
        request: Optional[MasterDataSyncFromSourceRequest] = None,
    ) -> MasterDataSyncFromSourceOut:
        req = request or MasterDataSyncFromSourceRequest()
        sources, match_key, binding = await resolve_sync_sources(
            WarehouseSyncBinding,
            tenant_id,
            req,
            default_match_key=self.MATCH_KEY,
        )
        binding = binding or await WarehouseSyncBinding.filter(tenant_id=tenant_id).first()
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
                    sources=req.sources,
                    match_key_field=match_key,
                    sync_mode=sync_mode,
                    schedule_interval_minutes=interval,
                ),
            )
            binding = await WarehouseSyncBinding.filter(tenant_id=tenant_id).first()
        since = resolve_incremental_since(
            binding,
            sync_mode=sync_mode,
            request_incremental=req.incremental,
        )
        try:
            rows, source_errors, _fetched = await fetch_mapped_rows_from_sources(
                tenant_id,
                sources,
                since=since,
                active_only=req.active_only,
            )
            result = await self._upsert_warehouses(tenant_id, current_user, rows, match_key)
            if source_errors:
                result.errors = (source_errors + list(result.errors))[:20]
            if binding:
                if result.failed and not (result.created or result.updated):
                    await mark_binding_failure(binding, "; ".join(result.errors) or "仓库同步失败")
                else:
                    await mark_binding_success(binding)
            return result
        except Exception as exc:
            if binding:
                await mark_binding_failure(binding, str(exc))
            raise
    async def _upsert_warehouses(
        self,
        tenant_id: int,
        current_user: User,
        rows: List[Dict[str, Any]],
        match_key: str,
    ) -> MasterDataSyncFromSourceOut:
        created = 0
        updated = 0
        skipped = 0
        failed = 0
        errors: List[str] = []
        custom_fields_by_code = await load_custom_fields_by_code(
            tenant_id, WAREHOUSE_CUSTOM_FIELD_TABLE
        )
        for row in rows:
            code = cell_str(row.get(match_key if match_key == "code" else "code") or row.get(match_key))
            name = cell_str(row.get("name"))
            if not code:
                skipped += 1
                errors.append("存在缺少仓库编码的行，已跳过")
                continue
            if not name:
                skipped += 1
                errors.append(f"仓库 {code} 缺少名称，已跳过")
                continue
            forbid_raw = row.get("forbid_status")
            if forbid_raw is not None and cell_str(forbid_raw):
                is_active = _map_kingdee_forbid_to_is_active(forbid_raw)
            else:
                is_active = True
            try:
                existing = await Warehouse.filter(
                    tenant_id=tenant_id,
                    code=code.upper(),
                    deleted_at__isnull=True,
                ).first()
                if existing:
                    update_data = WarehouseUpdate(name=name, is_active=is_active)
                    await WarehouseService.update_warehouse(
                        tenant_id,
                        existing.uuid,
                        update_data,
                        current_user=current_user,
                    )
                    await existing.refresh_from_db()
                    await apply_sync_extras_after_write(
                        tenant_id=tenant_id,
                        record=existing,
                        mapped_row=row,
                        record_table=WAREHOUSE_CUSTOM_FIELD_TABLE,
                        fields_by_code=custom_fields_by_code,
                        string_fields=WAREHOUSE_SYNC_STRING_FIELDS,
                        bool_fields=WAREHOUSE_SYNC_BOOL_FIELDS,
                    )
                    await mark_external_sync_record(existing)
                    updated += 1
                else:
                    create_data = WarehouseCreate(code=code, name=name, is_active=is_active)
                    created_warehouse = await WarehouseService.create_warehouse(
                        tenant_id, create_data, current_user=current_user
                    )
                    warehouse_row = await Warehouse.filter(
                        tenant_id=tenant_id,
                        uuid=created_warehouse.uuid,
                        deleted_at__isnull=True,
                    ).first()
                    if warehouse_row:
                        await apply_sync_extras_after_write(
                            tenant_id=tenant_id,
                            record=warehouse_row,
                            mapped_row=row,
                            record_table=WAREHOUSE_CUSTOM_FIELD_TABLE,
                            fields_by_code=custom_fields_by_code,
                            string_fields=WAREHOUSE_SYNC_STRING_FIELDS,
                            bool_fields=WAREHOUSE_SYNC_BOOL_FIELDS,
                        )
                        await mark_external_sync_record(warehouse_row)
                    created += 1
            except Exception as exc:
                failed += 1
                errors.append(f"仓库 {code}：{exc}")
        return MasterDataSyncFromSourceOut(
            created=created,
            updated=updated,
            skipped=skipped,
            failed=failed,
            errors=errors[:20],
        )
