"""即时库存从数据接口/数据集同步服务。"""
from __future__ import annotations

import uuid
from decimal import Decimal
from typing import Any, Dict, Iterable, List, Optional, Sequence, Tuple

from infra.exceptions.exceptions import ValidationError
from infra.models.user import User
from tortoise import connections

from apps.kuaizhizao.models.inventory_sync_binding import InventorySyncBinding
from apps.kuaizhizao.schemas.inventory_sync import (
    InventorySyncBindingOut,
    InventorySyncBindingUpsert,
    InventorySyncFromSourceOut,
    InventorySyncFromSourceRequest,
)
from apps.master_data.constants.batch_quality_status import QUALIFIED
from apps.master_data.models.material import Material
from apps.master_data.models.material_batch import MaterialBatch
from apps.master_data.models.warehouse import Warehouse
from apps.master_data.services.master_data_sync_common import (
    attach_sync_fetch_meta,
    serialize_binding_row,
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


INVENTORY_WRITE_CHUNK = 500
# 金蝶即时库存：数量优先 avbqty，其次 qty；批号 lotnum。映射到空列（如 baseqty）时回退。
INVENTORY_MAP_EMPTY_FALLBACKS = {
    "quantity": ["avbqty", "qty", "baseqty"],
    "batch_no": ["lotnum", "lot_number", "lot.number", "batch_no", "batch_number"],
}


def normalize_inventory_sync_batch_no(row: Dict[str, Any]) -> str:
    """即时库存源常无批号；空值落空串（与库存增减口径一致），并兼容金蝶 lotnum。"""
    return _inventory_cell(
        row,
        "batch_no",
        "batch_number",
        "batchNo",
        "lotnum",
        "lot_number",
        "lot.number",
    )[:100]


def _compact_sync_errors(errors: List[str], *, limit: int = 12) -> List[str]:
    counts: Dict[str, int] = {}
    order: List[str] = []
    for item in errors:
        text = str(item or "").strip()
        if not text:
            continue
        if text not in counts:
            order.append(text)
            counts[text] = 0
        counts[text] += 1
    out: List[str] = []
    for text in order[:limit]:
        n = counts[text]
        out.append(f"{text}（共 {n} 条）" if n > 1 else text)
    return out


def _empty_inventory_write_message(result: Any, fetched: int) -> str:
    skipped = int(getattr(result, "skipped", 0) or 0)
    failed = int(getattr(result, "failed", 0) or 0)
    msg = (
        f"未写入任何库存（拉取 {int(fetched or 0)} 条，"
        f"新建 0，更新 0，跳过 {skipped}，失败 {failed}）"
    )
    details = _compact_sync_errors(list(getattr(result, "errors", None) or []))
    if details:
        msg = f"{msg}。{ '；'.join(details) }"
    elif int(fetched or 0) == 0:
        msg = f"{msg}。请检查接口调用参数、物料编码分批条件是否返回了余额行"
    else:
        msg = f"{msg}。请确认物料主数据已同步，且映射了物料编码、数量、仓库编码或名称"
    return msg[:2000]


def _inventory_cell(row: Dict[str, Any], *keys: str) -> str:
    for key in keys:
        text = cell_str(row.get(key))
        if text:
            return text
    return ""


def _inventory_quantity(row: Dict[str, Any]) -> Optional[float]:
    for key in ("quantity", "avbqty", "qty", "baseqty"):
        raw = row.get(key)
        if raw in (None, ""):
            continue
        text = str(raw).strip()
        if not text or text in {"-", "--"}:
            continue
        qty = cell_optional_decimal(raw)
        if qty is not None:
            return float(qty)
    return None


def _chunks(items: Sequence[Any], size: int) -> Iterable[Sequence[Any]]:
    for index in range(0, len(items), size):
        yield items[index : index + size]


class InventorySyncService:
    MATCH_KEY = "material_code"

    def serialize_binding(self, row: Optional[InventorySyncBinding]) -> InventorySyncBindingOut:
        data = serialize_binding_row(row, default_match_key=self.MATCH_KEY)
        return InventorySyncBindingOut(**data)

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
                empty_fallbacks=INVENTORY_MAP_EMPTY_FALLBACKS,
            )
            await emit_sync_progress(f"字段映射完成，准备写入 {len(rows)} 条库存记录…")
            result = await self._upsert_batches(tenant_id, current_user, rows, match_key)
            if source_errors:
                result.errors = (source_errors + list(result.errors))[:20]
            attach_sync_fetch_meta(result, fetched=fetched, since=since, truncated=False)
            result.errors = _compact_sync_errors(list(result.errors or []))
            wrote = bool(result.created or result.updated)
            if binding:
                if not wrote:
                    incremental_noop = (
                        since is not None
                        and fetched == 0
                        and not result.failed
                        and not result.skipped
                    )
                    if incremental_noop:
                        await mark_binding_success(binding)
                    else:
                        await mark_binding_failure(
                            binding,
                            _empty_inventory_write_message(result, fetched),
                        )
                elif result.failed:
                    await mark_binding_partial_success(
                        binding,
                        "；".join(result.errors) or "即时库存部分行同步失败",
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
        """金蝶仍一次拉全量；本地认仓认料后批量 UPSERT，避免逐行写库拖垮进度流。"""
        created = 0
        updated = 0
        skipped = 0
        failed = 0
        errors: List[str] = []

        await emit_sync_progress("正在预加载本地仓库与物料…")
        warehouses = await Warehouse.filter(
            tenant_id=tenant_id, deleted_at__isnull=True
        ).all()
        warehouse_by_code = {str(w.code).strip(): w for w in warehouses if str(w.code or "").strip()}
        warehouse_by_name = {str(w.name).strip(): w for w in warehouses if str(w.name or "").strip()}

        materials = await Material.filter(
            tenant_id=tenant_id, deleted_at__isnull=True
        ).all()
        material_by_code: Dict[str, Material] = {}
        for material in materials:
            main_code = str(getattr(material, "main_code", None) or "").strip()
            code = str(getattr(material, "code", None) or "").strip()
            if main_code:
                material_by_code[main_code] = material
            if code and code not in material_by_code:
                material_by_code[code] = material

        payloads: Dict[Tuple[int, str, int], Dict[str, Any]] = {}
        await emit_sync_progress(f"正在匹配 {len(rows)} 条来源行…")
        for row in rows:
            warehouse_code = _inventory_cell(
                row, "warehouse_code", "warehouseCode", "warehouse.number"
            )
            warehouse_name = _inventory_cell(
                row, "warehouse_name", "warehouseName", "warehouse.name"
            )
            if not warehouse_code and not warehouse_name:
                failed += 1
                errors.append("存在缺少仓库编码或仓库名称的行")
                continue
            warehouse = warehouse_by_code.get(warehouse_code) if warehouse_code else None
            if warehouse is None and warehouse_name:
                warehouse = warehouse_by_name.get(warehouse_name)
            if warehouse is None:
                failed += 1
                errors.append(f"仓库不存在：{warehouse_code or warehouse_name}")
                continue

            material_code = _inventory_cell(
                row,
                match_key,
                "material_code",
                "material.number",
                "material",
                "number",
                "code",
            )
            if not material_code:
                failed += 1
                errors.append("存在缺少物料编码的行")
                continue
            material = material_by_code.get(material_code)
            if material is None:
                failed += 1
                errors.append(f"物料 {material_code} 不存在，请先同步物料主数据")
                continue

            quantity = _inventory_quantity(row)
            if quantity is None:
                failed += 1
                errors.append(f"物料 {material_code} 缺少库存数量")
                continue

            batch_no = normalize_inventory_sync_batch_no(row)
            key = (int(material.id), batch_no, int(warehouse.id))
            payloads[key] = {
                "material_id": int(material.id),
                "batch_no": batch_no,
                "warehouse_id": int(warehouse.id),
                "warehouse_name": (warehouse.name or warehouse_name or None),
                "quantity": Decimal(str(quantity)),
            }

        if not payloads:
            await emit_sync_progress(
                f"库存写入完成：新建 0，更新 0，跳过 {skipped}，失败 {failed}"
            )
            return InventorySyncFromSourceOut(
                created=0,
                updated=0,
                skipped=skipped,
                failed=failed,
                errors=_compact_sync_errors(errors),
            )

        material_ids = list({item["material_id"] for item in payloads.values()})
        existing_rows = await MaterialBatch.filter(
            tenant_id=tenant_id,
            material_id__in=material_ids,
            ownership_type="company_owned",
            customer_id=0,
            quality_status=QUALIFIED,
            deleted_at__isnull=True,
        ).only("id", "material_id", "batch_no", "warehouse_id")
        existing_keys = {
            (int(row.material_id), str(row.batch_no), int(row.warehouse_id or 0))
            for row in existing_rows
        }

        to_insert: List[Dict[str, Any]] = []
        to_update: List[Dict[str, Any]] = []
        for key, item in payloads.items():
            if key in existing_keys:
                to_update.append(item)
            else:
                to_insert.append(item)

        now = resolve_business_datetime()
        actor_id = None
        actor_name = None
        if current_user is not None:
            from apps.common.audit_actor import operator_name_from_user

            actor_id = int(current_user.id)
            actor_name = operator_name_from_user(current_user)

        await emit_sync_progress(
            f"正在批量写入库存：新建 {len(to_insert)}，更新 {len(to_update)}…"
        )
        if to_update:
            updated += await self._bulk_update_on_hand(
                tenant_id, to_update, now, actor_id, actor_name
            )
        if to_insert:
            created += await self._bulk_insert_on_hand(
                tenant_id, to_insert, now, actor_id, actor_name
            )

        await emit_sync_progress(
            f"库存写入完成：新建 {created}，更新 {updated}，跳过 {skipped}，失败 {failed}"
        )
        return InventorySyncFromSourceOut(
            created=created,
            updated=updated,
            skipped=skipped,
            failed=failed,
            errors=_compact_sync_errors(errors),
        )

    async def _bulk_update_on_hand(
        self,
        tenant_id: int,
        items: List[Dict[str, Any]],
        now: Any,
        actor_id: Optional[int],
        actor_name: Optional[str],
    ) -> int:
        conn = connections.get("default")
        sql = """
            UPDATE apps_master_data_material_batches AS b
            SET quantity = v.quantity,
                status = CASE WHEN v.quantity > 0 THEN 'in_stock' ELSE 'out_stock' END,
                warehouse_name = COALESCE(v.warehouse_name, b.warehouse_name),
                updated_at = $6,
                updated_by = $7,
                updated_by_name = $8
            FROM (
                SELECT *
                FROM unnest($1::int[], $2::varchar[], $3::int[], $4::numeric[], $5::varchar[])
                    AS t(material_id, batch_no, warehouse_id, quantity, warehouse_name)
            ) AS v
            WHERE b.tenant_id = $9
              AND b.material_id = v.material_id
              AND b.batch_no = v.batch_no
              AND b.warehouse_id = v.warehouse_id
              AND b.ownership_type = 'company_owned'
              AND b.customer_id = 0
              AND b.quality_status = $10
              AND b.deleted_at IS NULL
        """
        written = 0
        for chunk in _chunks(items, INVENTORY_WRITE_CHUNK):
            await conn.execute_query(
                sql,
                [
                    [item["material_id"] for item in chunk],
                    [item["batch_no"] for item in chunk],
                    [item["warehouse_id"] for item in chunk],
                    [item["quantity"] for item in chunk],
                    [item["warehouse_name"] for item in chunk],
                    now,
                    actor_id,
                    actor_name,
                    tenant_id,
                    QUALIFIED,
                ],
            )
            written += len(chunk)
        return written

    async def _bulk_insert_on_hand(
        self,
        tenant_id: int,
        items: List[Dict[str, Any]],
        now: Any,
        actor_id: Optional[int],
        actor_name: Optional[str],
    ) -> int:
        conn = connections.get("default")
        sql = """
            INSERT INTO apps_master_data_material_batches (
                uuid, tenant_id, material_id, batch_no, warehouse_id, warehouse_name,
                quantity, status, ownership_type, customer_id, quality_status,
                created_at, updated_at, created_by, created_by_name, updated_by, updated_by_name
            ) VALUES ($1,$2,$3,$4,$5,$6,$7,$8,'company_owned',0,$9,$10,$10,$11,$12,$11,$12)
            ON CONFLICT (tenant_id, material_id, batch_no, ownership_type, customer_id, warehouse_id, quality_status)
            WHERE deleted_at IS NULL
            DO UPDATE SET
                quantity = EXCLUDED.quantity,
                status = EXCLUDED.status,
                warehouse_name = COALESCE(EXCLUDED.warehouse_name, apps_master_data_material_batches.warehouse_name),
                updated_at = EXCLUDED.updated_at,
                updated_by = EXCLUDED.updated_by,
                updated_by_name = EXCLUDED.updated_by_name
        """
        written = 0
        for chunk in _chunks(items, INVENTORY_WRITE_CHUNK):
            values = [
                [
                    str(uuid.uuid4()),
                    tenant_id,
                    item["material_id"],
                    item["batch_no"],
                    item["warehouse_id"],
                    item["warehouse_name"],
                    item["quantity"],
                    "in_stock" if item["quantity"] > 0 else "out_stock",
                    QUALIFIED,
                    now,
                    actor_id,
                    actor_name,
                ]
                for item in chunk
            ]
            await conn.execute_many(sql, values)
            written += len(chunk)
        return written

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
