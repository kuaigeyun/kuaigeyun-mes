"""供应商从数据接口/数据集同步。"""
from __future__ import annotations
from typing import Any, Dict, List, Optional
from infra.exceptions.exceptions import ValidationError
from infra.models.user import User
from apps.master_data.models.master_data_sync_binding import SupplierSyncBinding
from apps.master_data.models.supplier import Supplier
from apps.master_data.schemas.master_data_sync import (
    MasterDataSyncBindingOut,
    MasterDataSyncBindingUpsert,
    MasterDataSyncFromSourceOut,
    MasterDataSyncFromSourceRequest,
)
from apps.master_data.schemas.supply_chain_schemas import SupplierCreate, SupplierUpdate
from apps.master_data.services.master_data_sync_common import (
    apply_sync_extras_after_write,
    cell_str,
    fetch_sync_rows,
    filter_kingdee_approved_active_master_rows,
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

SUPPLIER_CUSTOM_FIELD_TABLE = "master_data_suppliers"
SUPPLIER_SYNC_STRING_FIELDS = frozenset({
    "contact_person", "phone", "email", "address", "category", "contact_title",
    "industry_code", "source_channel_code", "tax_registration_no", "invoice_title",
    "invoice_address", "invoice_phone", "invoice_bank_name", "invoice_bank_account",
    "invoice_type_code", "taxpayer_type_code", "legal_representative",
    "enterprise_type_code", "settlement_method_code", "buyer_name",
})
SUPPLIER_SYNC_BOOL_FIELDS = frozenset({"is_active"})
SUPPLIER_SYNC_DECIMAL_FIELDS = frozenset({"estimated_annual_purchase", "credit_limit"})
SUPPLIER_SYNC_INT_FIELDS = frozenset({"payment_terms_days"})
from apps.master_data.services.supply_chain_service import SupplyChainService
class SupplierSyncService:
    MATCH_KEY = "code"
    def serialize_binding(self, row: Optional[SupplierSyncBinding]) -> MasterDataSyncBindingOut:
        data = serialize_binding_row(row, default_match_key=self.MATCH_KEY)
        return MasterDataSyncBindingOut(**data)
    async def upsert_binding(
        self,
        tenant_id: int,
        body: MasterDataSyncBindingUpsert,
    ) -> MasterDataSyncBindingOut:
        if body.sources is not None and len(body.sources) == 0:
            await SupplierSyncBinding.filter(tenant_id=tenant_id).delete()
            return MasterDataSyncBindingOut()
        sources = sources_from_upsert_body(body)
        match_key = (body.match_key_field or self.MATCH_KEY).strip() or self.MATCH_KEY
        sync_mode = normalize_sync_mode(body.sync_mode)
        interval = normalize_schedule_interval(body.schedule_interval_minutes)
        row = await upsert_sync_binding(
            SupplierSyncBinding,
            tenant_id,
            sources=sources,
            match_key_field=match_key,
            sync_mode=sync_mode,
            schedule_interval_minutes=interval,
        )
        return self.serialize_binding(row)
    async def get_binding(self, tenant_id: int) -> MasterDataSyncBindingOut:
        row = await SupplierSyncBinding.filter(tenant_id=tenant_id).first()
        return self.serialize_binding(row)
    async def sync_from_source(
        self,
        tenant_id: int,
        current_user: User,
        request: Optional[MasterDataSyncFromSourceRequest] = None,
    ) -> MasterDataSyncFromSourceOut:
        req = request or MasterDataSyncFromSourceRequest()
        sources, match_key, binding = await resolve_sync_sources(
            SupplierSyncBinding,
            tenant_id,
            req,
            default_match_key=self.MATCH_KEY,
        )
        binding = binding or await SupplierSyncBinding.filter(tenant_id=tenant_id).first()
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
            binding = await SupplierSyncBinding.filter(tenant_id=tenant_id).first()
        since = resolve_incremental_since(
            binding,
            sync_mode=sync_mode,
            request_incremental=req.incremental,
        )
        try:
            invalid_skipped_holder = {"n": 0}

            def _filter_raw(raw_rows: List[Dict[str, Any]]) -> List[Dict[str, Any]]:
                if not req.active_only:
                    return raw_rows
                kept, skipped = filter_kingdee_approved_active_master_rows(raw_rows)
                invalid_skipped_holder["n"] += skipped
                return kept

            rows, source_errors, _fetched = await fetch_mapped_rows_from_sources(
                tenant_id,
                sources,
                since=since,
                active_only=req.active_only,
                transform_raw_rows=_filter_raw,
            )
            invalid_skipped = invalid_skipped_holder["n"]
            result = await self._upsert_suppliers(tenant_id, current_user, rows, match_key)
            if source_errors:
                result.errors = (source_errors + list(result.errors))[:20]
            if invalid_skipped:
                result.skipped = int(getattr(result, "skipped", 0) or 0) + invalid_skipped
            if binding:
                if result.failed and not (result.created or result.updated):
                    await mark_binding_failure(binding, "; ".join(result.errors) or "供应商同步失败")
                else:
                    await mark_binding_success(binding)
            return result
        except Exception as exc:
            if binding:
                await mark_binding_failure(binding, str(exc))
            raise
    async def _upsert_suppliers(
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
            tenant_id, SUPPLIER_CUSTOM_FIELD_TABLE
        )
        for row in rows:
            code = cell_str(row.get(match_key if match_key == "code" else "code") or row.get(match_key))
            name = cell_str(row.get("name"))
            if not code:
                skipped += 1
                errors.append("存在缺少供应商编码的行，已跳过")
                continue
            if not name:
                skipped += 1
                errors.append(f"供应商 {code} 缺少名称，已跳过")
                continue
            try:
                existing = await Supplier.filter(
                    tenant_id=tenant_id,
                    code=code.upper(),
                    deleted_at__isnull=True,
                ).first()
                if existing:
                    update_data = SupplierUpdate(
                        name=name,
                        short_name=cell_str(row.get("short_name")) or None,
                    )
                    await SupplyChainService.update_supplier(
                        tenant_id,
                        existing.uuid,
                        update_data,
                        current_user,
                    )
                    await existing.refresh_from_db()
                    await apply_sync_extras_after_write(
                        tenant_id=tenant_id,
                        record=existing,
                        mapped_row=row,
                        record_table=SUPPLIER_CUSTOM_FIELD_TABLE,
                        fields_by_code=custom_fields_by_code,
                        string_fields=SUPPLIER_SYNC_STRING_FIELDS,
                        bool_fields=SUPPLIER_SYNC_BOOL_FIELDS,
                        decimal_fields=SUPPLIER_SYNC_DECIMAL_FIELDS,
                        int_fields=SUPPLIER_SYNC_INT_FIELDS,
                    )
                    await mark_external_sync_record(existing)
                    updated += 1
                else:
                    create_data = SupplierCreate(
                        code=code,
                        name=name,
                        short_name=cell_str(row.get("short_name")) or None,
                    )
                    created_supplier = await SupplyChainService.create_supplier(
                        tenant_id, create_data, current_user
                    )
                    supplier_row = await Supplier.filter(
                        tenant_id=tenant_id,
                        uuid=created_supplier.uuid,
                        deleted_at__isnull=True,
                    ).first()
                    if supplier_row:
                        await apply_sync_extras_after_write(
                            tenant_id=tenant_id,
                            record=supplier_row,
                            mapped_row=row,
                            record_table=SUPPLIER_CUSTOM_FIELD_TABLE,
                            fields_by_code=custom_fields_by_code,
                            string_fields=SUPPLIER_SYNC_STRING_FIELDS,
                            bool_fields=SUPPLIER_SYNC_BOOL_FIELDS,
                            decimal_fields=SUPPLIER_SYNC_DECIMAL_FIELDS,
                            int_fields=SUPPLIER_SYNC_INT_FIELDS,
                        )
                        await mark_external_sync_record(supplier_row)
                    created += 1
            except Exception as exc:
                failed += 1
                errors.append(f"供应商 {code}：{exc}")
        return MasterDataSyncFromSourceOut(
            created=created,
            updated=updated,
            skipped=skipped,
            failed=failed,
            errors=errors[:20],
        )
