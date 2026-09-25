"""客户从数据接口/数据集同步。"""

from __future__ import annotations

from typing import Any, Dict, List, Optional

from infra.exceptions.exceptions import ValidationError
from infra.models.user import User

from apps.master_data.models.customer import Customer
from apps.master_data.models.master_data_sync_binding import CustomerSyncBinding
from apps.master_data.schemas.master_data_sync import (
    MasterDataSyncBindingOut,
    MasterDataSyncBindingUpsert,
    MasterDataSyncFromSourceOut,
    MasterDataSyncFromSourceRequest,
)
from apps.master_data.schemas.supply_chain_schemas import CustomerCreate, CustomerUpdate
from apps.master_data.services.master_data_sync_common import (
    apply_sync_extras_after_write,
    attach_sync_fetch_meta,
    cell_str,
    fetch_sync_rows,
    filter_kingdee_approved_active_master_rows,
    load_custom_fields_by_code,
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
from apps.master_data.services.supply_chain_service import SupplyChainService
from core.services.data.sync_progress import emit_sync_progress

CUSTOMER_CUSTOM_FIELD_TABLE = "master_data_customers"
CUSTOMER_SYNC_STRING_FIELDS = frozenset(
    {
        "category",
        "contact_title",
        "industry_code",
        "customer_level_code",
        "lead_source_code",
        "tax_registration_no",
        "invoice_title",
        "invoice_address",
        "invoice_phone",
        "invoice_bank_name",
        "invoice_bank_account",
        "invoice_type_code",
        "taxpayer_type_code",
        "legal_representative",
        "enterprise_type_code",
        "settlement_method_code",
        "finance_contact_name",
        "finance_contact_phone",
        "finance_contact_email",
        "delivery_contact_name",
        "delivery_contact_phone",
        "delivery_address",
        "salesman_name",
    }
)
CUSTOMER_SYNC_BOOL_FIELDS = frozenset({"is_active"})
CUSTOMER_SYNC_DECIMAL_FIELDS = frozenset({"estimated_annual_purchase", "credit_limit"})
CUSTOMER_SYNC_INT_FIELDS = frozenset({"payment_terms_days"})


class CustomerSyncService:
    MATCH_KEY = "code"

    def serialize_binding(self, row: Optional[CustomerSyncBinding]) -> MasterDataSyncBindingOut:
        data = serialize_binding_row(row, default_match_key=self.MATCH_KEY)
        return MasterDataSyncBindingOut(**data)

    async def upsert_binding(
        self,
        tenant_id: int,
        body: MasterDataSyncBindingUpsert,
    ) -> MasterDataSyncBindingOut:
        if body.sources is not None and len(body.sources) == 0:
            await CustomerSyncBinding.filter(tenant_id=tenant_id).delete()
            return MasterDataSyncBindingOut()

        sources = sources_from_upsert_body(body)
        match_key = (body.match_key_field or self.MATCH_KEY).strip() or self.MATCH_KEY
        sync_mode = normalize_sync_mode(body.sync_mode)
        interval = normalize_schedule_interval(body.schedule_interval_minutes)
        row = await upsert_sync_binding(
            CustomerSyncBinding,
            tenant_id,
            sources=sources,
            match_key_field=match_key,
            sync_mode=sync_mode,
            schedule_interval_minutes=interval,
        )
        return self.serialize_binding(row)

    async def get_binding(self, tenant_id: int) -> MasterDataSyncBindingOut:
        row = await CustomerSyncBinding.filter(tenant_id=tenant_id).first()
        return self.serialize_binding(row)

    async def sync_from_source(
        self,
        tenant_id: int,
        current_user: User,
        request: Optional[MasterDataSyncFromSourceRequest] = None,
    ) -> MasterDataSyncFromSourceOut:
        req = request or MasterDataSyncFromSourceRequest()
        sources, match_key, binding = await resolve_sync_sources(
            CustomerSyncBinding,
            tenant_id,
            req,
            default_match_key=self.MATCH_KEY,
        )

        binding = binding or await CustomerSyncBinding.filter(tenant_id=tenant_id).first()
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
            binding = await CustomerSyncBinding.filter(tenant_id=tenant_id).first()

        since = resolve_incremental_since(
            binding,
            sync_mode=sync_mode,
            request_incremental=req.incremental,
        )
        try:
            await emit_sync_progress("开始同步客户…")
            invalid_skipped_holder = {"n": 0}

            def _filter_raw(raw_rows: List[Dict[str, Any]]) -> List[Dict[str, Any]]:
                if not req.active_only:
                    return raw_rows
                kept, skipped = filter_kingdee_approved_active_master_rows(raw_rows)
                invalid_skipped_holder["n"] += skipped
                return kept

            rows, source_errors, fetched = await fetch_mapped_rows_from_sources(
                tenant_id,
                sources,
                since=since,
                active_only=req.active_only,
                transform_raw_rows=_filter_raw,
            )
            invalid_skipped = invalid_skipped_holder["n"]
            if invalid_skipped:
                await emit_sync_progress(
                    f"已排除无效客户 {invalid_skipped} 条（未审核或已禁用），"
                    f"剩余 {len(rows)} 条…"
                )
                fetched += invalid_skipped
            await emit_sync_progress(f"字段映射完成，准备写入 {len(rows)} 条客户…")
            result = await self._upsert_customers(tenant_id, current_user, rows, match_key)
            if source_errors:
                result.errors = (source_errors + list(result.errors))[:20]
            attach_sync_fetch_meta(result, fetched=fetched, since=since)
            if invalid_skipped:
                result.skipped = int(getattr(result, "skipped", 0) or 0) + invalid_skipped
            if binding:
                if result.failed and not (result.created or result.updated):
                    await mark_binding_failure(binding, "; ".join(result.errors) or "客户同步失败")
                else:
                    await mark_binding_success(binding)
            return result
        except Exception as exc:
            if binding:
                await mark_binding_failure(binding, str(exc))
            raise

    async def _upsert_customers(
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
        total = len(rows)
        custom_fields_by_code = await load_custom_fields_by_code(
            tenant_id, CUSTOMER_CUSTOM_FIELD_TABLE
        )

        for index, row in enumerate(rows, start=1):
            code = cell_str(row.get(match_key if match_key == "code" else "code") or row.get(match_key))
            name = cell_str(row.get("name"))
            if not code:
                skipped += 1
                errors.append("存在缺少客户编码的行，已跳过")
                continue
            if not name:
                skipped += 1
                errors.append(f"客户 {code} 缺少名称，已跳过")
                continue
            if index == 1 or index == total or index % 25 == 0:
                await emit_sync_progress(f"正在写入客户 {index}/{total}：{code}")
            try:
                existing = await Customer.filter(
                    tenant_id=tenant_id,
                    code=code.upper(),
                    deleted_at__isnull=True,
                ).first()
                if existing:
                    update_data = CustomerUpdate(
                        name=name,
                        short_name=cell_str(row.get("short_name")) or None,
                        contact_person=cell_str(row.get("contact_person")) or None,
                        phone=cell_str(row.get("phone")) or None,
                        email=cell_str(row.get("email")) or None,
                        address=cell_str(row.get("address")) or None,
                    )
                    await SupplyChainService.update_customer(
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
                        record_table=CUSTOMER_CUSTOM_FIELD_TABLE,
                        fields_by_code=custom_fields_by_code,
                        string_fields=CUSTOMER_SYNC_STRING_FIELDS,
                        bool_fields=CUSTOMER_SYNC_BOOL_FIELDS,
                        decimal_fields=CUSTOMER_SYNC_DECIMAL_FIELDS,
                        int_fields=CUSTOMER_SYNC_INT_FIELDS,
                    )
                    await mark_external_sync_record(existing)
                    updated += 1
                else:
                    create_data = CustomerCreate(
                        code=code,
                        name=name,
                        short_name=cell_str(row.get("short_name")) or None,
                        contact_person=cell_str(row.get("contact_person")) or None,
                        phone=cell_str(row.get("phone")) or None,
                        email=cell_str(row.get("email")) or None,
                        address=cell_str(row.get("address")) or None,
                    )
                    created_customer = await SupplyChainService.create_customer(
                        tenant_id, create_data, current_user
                    )
                    customer_row = await Customer.filter(
                        tenant_id=tenant_id,
                        uuid=created_customer.uuid,
                        deleted_at__isnull=True,
                    ).first()
                    if customer_row:
                        await apply_sync_extras_after_write(
                            tenant_id=tenant_id,
                            record=customer_row,
                            mapped_row=row,
                            record_table=CUSTOMER_CUSTOM_FIELD_TABLE,
                            fields_by_code=custom_fields_by_code,
                            string_fields=CUSTOMER_SYNC_STRING_FIELDS,
                            bool_fields=CUSTOMER_SYNC_BOOL_FIELDS,
                            decimal_fields=CUSTOMER_SYNC_DECIMAL_FIELDS,
                            int_fields=CUSTOMER_SYNC_INT_FIELDS,
                        )
                        await mark_external_sync_record(customer_row)
                    created += 1
            except Exception as exc:
                failed += 1
                errors.append(f"客户 {code}：{exc}")

        return MasterDataSyncFromSourceOut(
            created=created,
            updated=updated,
            skipped=skipped,
            failed=failed,
            errors=errors[:20],
        )
