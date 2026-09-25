"""即时库存从数据接口/数据集同步服务。"""
from __future__ import annotations

from typing import Any, Dict, List, Optional

from infra.exceptions.exceptions import ValidationError
from infra.models.user import User

from apps.kuaizhizao.models.inventory_sync_binding import InventorySyncBinding
from apps.kuaizhizao.schemas.inventory_sync import (
    InventorySyncBindingOut,
    InventorySyncBindingUpsert,
    InventorySyncFromSourceOut,
    InventorySyncFromSourceRequest,
)
from apps.master_data.models.material import Material
from apps.master_data.models.material_batch import MaterialBatch
from apps.master_data.models.warehouse import Warehouse
from apps.master_data.services.master_data_sync_common import (
    attach_sync_fetch_meta,
    cell_optional_decimal,
    cell_str,
    fetch_sync_rows,
    map_sync_rows,
    mark_binding_failure,
    mark_binding_partial_success,
    mark_binding_success,
    normalize_schedule_interval,
    normalize_sync_direction,
    normalize_sync_mode,
    record_sync_run_log,
    resolve_business_datetime,
    resolve_incremental_since,
    resolve_sync_sources,
    sources_from_upsert_body,
    upsert_sync_binding,
)
from core.services.data.sync_binding_sources import fetch_mapped_rows_from_sources

from core.services.data.sync_progress import emit_sync_progress
from tortoise.expressions import Q



class InventorySyncService:
    MATCH_KEY = "material_code"

    def serialize_binding(self, row: Optional[InventorySyncBinding]) -> InventorySyncBindingOut:
        if not row:
            return InventorySyncBindingOut(match_key_field=self.MATCH_KEY)
        mapping = row.field_mapping if isinstance(row.field_mapping, dict) else {}
        return InventorySyncBindingOut(
            source_type=row.source_type,
            api_uuid=row.api_uuid,
            dataset_uuid=row.dataset_uuid,
            field_mapping={str(k): str(v) for k, v in mapping.items()},
            match_key_field=row.match_key_field or self.MATCH_KEY,
            sync_mode=row.sync_mode or "manual_full",
            sync_direction=getattr(row, "sync_direction", None) or "pull",
            schedule_interval_minutes=int(getattr(row, "schedule_interval_minutes", None) or 15),
            last_success_at=row.last_success_at,
            last_attempt_at=row.last_attempt_at,
            last_error=row.last_error,
        )

    async def upsert_binding(
        self,
        tenant_id: int,
        body: InventorySyncBindingUpsert,
    ) -> InventorySyncBindingOut:
        if body.sources is not None and len(body.sources) == 0:
            await InventorySyncBinding.filter(tenant_id=tenant_id).delete()
            return InventorySyncBindingOut(match_key_field=self.MATCH_KEY)

        sources = sources_from_upsert_body(body)
        match_key = (body.match_key_field or self.MATCH_KEY).strip() or self.MATCH_KEY
        sync_mode = normalize_sync_mode(body.sync_mode)
        sync_direction = normalize_sync_direction(body.sync_direction)
        interval = normalize_schedule_interval(body.schedule_interval_minutes)
        row = await upsert_sync_binding(
            InventorySyncBinding,
            tenant_id,
            sources=sources,
            match_key_field=match_key,
            sync_mode=sync_mode,
            sync_direction=sync_direction,
            schedule_interval_minutes=interval,
        )
        return self.serialize_binding(row)

    async def get_binding(self, tenant_id: int) -> InventorySyncBindingOut:
        row = await InventorySyncBinding.filter(tenant_id=tenant_id).first()
        return self.serialize_binding(row)

    async def sync_from_source(
        self,
        tenant_id: int,
        current_user: Optional[User],
        request: Optional[InventorySyncFromSourceRequest] = None,
        *,
        skip_prerequisite_syncs: bool = False,
    ) -> InventorySyncFromSourceOut:
        req = request or InventorySyncFromSourceRequest()
        sources, match_key, binding = await resolve_sync_sources(
            InventorySyncBinding,
            tenant_id,
            req,
            default_match_key=self.MATCH_KEY,
        )

        binding = binding or await InventorySyncBinding.filter(tenant_id=tenant_id).first()
        sync_mode = normalize_sync_mode(
            req.sync_mode or (binding.sync_mode if binding else None)
        )
        sync_direction = normalize_sync_direction(
            req.sync_direction or (binding.sync_direction if binding else None)
        )
        interval = normalize_schedule_interval(
            req.schedule_interval_minutes
            if req.schedule_interval_minutes is not None
            else (binding.schedule_interval_minutes if binding else None)
        )

        if req.save_binding:
            await self.upsert_binding(
                tenant_id,
                InventorySyncBindingUpsert(
                    sources=req.sources,
                    match_key_field=match_key,
                    sync_mode=sync_mode,
                    sync_direction=sync_direction,
                    schedule_interval_minutes=interval,
                ),
            )
            binding = await InventorySyncBinding.filter(tenant_id=tenant_id).first()

        since = resolve_incremental_since(
            binding,
            sync_mode=sync_mode,
            request_incremental=req.incremental,
        )

        started_at = resolve_business_datetime()
        try:
            await emit_sync_progress("开始同步即时库存…")
            rows, source_errors, fetched = await fetch_mapped_rows_from_sources(
                tenant_id,
                sources,
                since=since,
                active_only=req.active_only,
            )
            await emit_sync_progress(f"字段映射完成，准备写入 {len(rows)} 条库存记录…")
            result = await self._upsert_batches(tenant_id, current_user, rows, match_key)
            if source_errors:
                result.errors = (source_errors + list(result.errors))[:20]
            attach_sync_fetch_meta(result, fetched=fetched, since=since, truncated=False)
            if binding:
                if result.failed and not (result.created or result.updated):
                    await mark_binding_failure(
                        binding,
                        "; ".join(result.errors) or "即时库存同步失败",
                    )
                elif result.failed and (result.created or result.updated):
                    await mark_binding_partial_success(
                        binding,
                        "; ".join(result.errors) or "即时库存部分行同步失败",
                    )
                else:
                    await mark_binding_success(binding)
            await record_sync_run_log(
                tenant_id=tenant_id,
                binding=binding,
                entity_type="inventory",
                result=result,
                started_at=started_at,
                truncated=False,
            )
            return result
        except Exception as exc:
            if binding:
                await mark_binding_failure(binding, str(exc))
            await record_sync_run_log(
                tenant_id=tenant_id,
                binding=binding,
                entity_type="inventory",
                result=None,
                started_at=started_at,
                error=str(exc),
            )
            raise

    async def _upsert_batches(
        self,
        tenant_id: int,
        current_user: Optional[User],
        rows: List[Dict[str, Any]],
        match_key: str,
    ) -> InventorySyncFromSourceOut:
        from datetime import date

        created = 0
        updated = 0
        skipped = 0
        failed = 0
        errors: List[str] = []
        sync_at = resolve_business_datetime()

        to_update: List[MaterialBatch] = []
        to_create: List[MaterialBatch] = []
        existing_by_key: Dict[str, MaterialBatch] = {}

        for row in rows:
            material_code = cell_str(row.get(match_key) or row.get("material_code") or row.get("code"))
            if not material_code:
                skipped += 1
                errors.append("存在缺少物料编码的行，已跳过")
                continue

            material = await Material.filter(
                tenant_id=tenant_id,
                deleted_at__isnull=True,
            ).filter(Q(main_code=material_code) | Q(code=material_code)).first()
            if not material:
                failed += 1
                errors.append(f"物料 {material_code} 不存在，请先同步物料主数据")
                continue

            batch_no = cell_str(
                row.get("batch_no")
                or row.get("batch_number")
                or row.get("batchNo")
            ) or None
            quantity_raw = row.get("quantity")
            quantity = cell_optional_decimal(quantity_raw)
            if quantity is None:
                quantity = 0.0

            warehouse_value = (
                row.get("warehouse_id")
                or row.get("warehouseId")
                or row.get("warehouse_code")
                or row.get("warehouseCode")
            )
            warehouse_name = cell_str(row.get("warehouse_name") or row.get("warehouseName")) or None
            warehouse_id, warehouse_name = await self._resolve_warehouse(
                tenant_id,
                warehouse_value,
                warehouse_name,
            )

            expiry_date = row.get("expiry_date") or row.get("expiryDate")
            production_date = row.get("production_date") or row.get("productionDate")
            if expiry_date:
                try:
                    from datetime import datetime as dt
                    expiry_date = dt.strptime(str(expiry_date)[:10], "%Y-%m-%d").date()
                except (ValueError, TypeError):
                    expiry_date = None
            if production_date:
                try:
                    from datetime import datetime as dt
                    production_date = dt.strptime(str(production_date)[:10], "%Y-%m-%d").date()
                except (ValueError, TypeError):
                    production_date = None

            key = f"{material_code}||{batch_no or ''}||{warehouse_id or 0}"
            if key in existing_by_key:
                batch = existing_by_key[key]
                batch.quantity = (batch.quantity or 0).__class__(quantity or 0)
                if warehouse_id:
                    batch.warehouse_id = warehouse_id
                if warehouse_name:
                    batch.warehouse_name = warehouse_name
                if expiry_date:
                    batch.expiry_date = expiry_date
                if production_date:
                    batch.production_date = production_date
                batch.status = "in_stock"
                batch.updated_at = sync_at
                to_update.append(batch)
            else:
                batch = MaterialBatch(
                    tenant_id=tenant_id,
                    material_id=material.id,
                    batch_no=batch_no,
                    warehouse_id=warehouse_id or 0,
                    warehouse_name=warehouse_name,
                    production_date=production_date,
                    expiry_date=expiry_date,
                    quantity=quantity or 0,
                    status="in_stock" if (quantity or 0) > 0 else "in_stock",
                    created_at=sync_at,
                    updated_at=sync_at,
                )
                if current_user:
                    from apps.common.audit_actor import apply_create_audit
                    apply_create_audit(batch, current_user)
                to_create.append(batch)
                existing_by_key[key] = batch

        write_batch = 500
        for offset in range(0, len(to_update), write_batch):
            batch_list = to_update[offset:offset + write_batch]
            start = offset + 1
            end = offset + len(batch_list)
            await emit_sync_progress(f"正在批量更新库存批次 {start}-{end}/{len(to_update)}…")
            try:
                for b in batch_list:
                    await b.save(update_fields=["quantity", "warehouse_id", "warehouse_name",
                                               "expiry_date", "production_date", "status",
                                               "updated_at", "updated_by", "updated_by_name"])
                updated += len(batch_list)
            except Exception as e:
                failed += len(batch_list)
                errors.append(f"批量更新失败：{e}")

        for offset in range(0, len(to_create), write_batch):
            batch_list = to_create[offset:offset + write_batch]
            start = offset + 1
            end = offset + len(batch_list)
            await emit_sync_progress(f"正在批量新建库存批次 {start}-{end}/{len(to_create)}…")
            try:
                await MaterialBatch.bulk_create(batch_list, batch_size=write_batch)
                created += len(batch_list)
            except Exception as e:
                failed += len(batch_list)
                errors.append(f"批量新建失败：{e}")

        await emit_sync_progress(
            f"库存写入完成：新建 {created}，更新 {updated}，跳过 {skipped}，失败 {failed}"
        )
        return InventorySyncFromSourceOut(
            created=created,
            updated=updated,
            skipped=skipped,
            failed=failed,
            errors=errors[:20],
        )

    async def _resolve_warehouse(
        self,
        tenant_id: int,
        value: Any,
        warehouse_name: Optional[str],
    ) -> tuple[int, Optional[str]]:
        """将外部仓库编码、名称或数字 ID 解析为本地仓库 ID。"""
        raw = cell_str(value)
        if not raw:
            return 0, warehouse_name

        warehouse = await Warehouse.filter(
            tenant_id=tenant_id,
            deleted_at__isnull=True,
        ).filter(Q(code=raw) | Q(name=raw)).first()
        if warehouse:
            return warehouse.id, warehouse_name or warehouse.name

        if raw.isdigit():
            warehouse = await Warehouse.filter(
                tenant_id=tenant_id,
                id=int(raw),
                deleted_at__isnull=True,
            ).first()
            if warehouse:
                return warehouse.id, warehouse_name or warehouse.name

        return 0, warehouse_name or raw

    async def _upsert_sync_binding(
        self,
        tenant_id: int,
        *,
        source_type: str,
        api_uuid: Optional[str],
        dataset_uuid: Optional[str],
        field_mapping: Dict[str, str],
        match_key_field: str,
        sync_mode: str,
        sync_direction: str,
        schedule_interval_minutes: Optional[int],
    ) -> InventorySyncBinding:
        if source_type not in ("api", "dataset"):
            raise ValidationError("来源类型须为 api 或 dataset")
        if source_type == "api" and not api_uuid:
            raise ValidationError("已选择数据接口时须指定接口")
        if source_type == "dataset" and not dataset_uuid:
            raise ValidationError("已选择数据集时须指定数据集")
        if not field_mapping:
            raise ValidationError("请配置字段映射")
        if match_key_field not in field_mapping.values():
            raise ValidationError(f"字段映射须包含匹配键 {match_key_field}")

        mode = normalize_sync_mode(sync_mode)
        direction = normalize_sync_direction(sync_direction)
        interval = normalize_schedule_interval(schedule_interval_minutes)
        existing = await InventorySyncBinding.filter(tenant_id=tenant_id).first()
        preserve = {
            "last_success_at": existing.last_success_at if existing else None,
            "last_attempt_at": existing.last_attempt_at if existing else None,
            "last_error": existing.last_error if existing else None,
        }
        await InventorySyncBinding.filter(tenant_id=tenant_id).delete()
        return await InventorySyncBinding.create(
            tenant_id=tenant_id,
            source_type=source_type,
            api_uuid=api_uuid if source_type == "api" else None,
            dataset_uuid=dataset_uuid if source_type == "dataset" else None,
            field_mapping=field_mapping,
            match_key_field=match_key_field,
            sync_mode=mode,
            sync_direction=direction,
            schedule_interval_minutes=interval,
            **preserve,
        )
