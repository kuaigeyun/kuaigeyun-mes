"""采购订单从数据接口/数据集同步服务。"""
from __future__ import annotations
from datetime import date, datetime
from decimal import Decimal, InvalidOperation
from typing import Any, Dict, List, Optional
from infra.exceptions.exceptions import ValidationError
from apps.kuaizhizao.constants import DocumentStatus
from apps.kuaizhizao.models.purchase_order import PurchaseOrder
from apps.kuaizhizao.models.purchase_order_sync_binding import PurchaseOrderSyncBinding
from apps.kuaizhizao.schemas.purchase import (
    PurchaseOrderCreate,
    PurchaseOrderItemCreate,
    PurchaseOrderUpdate,
)
from apps.kuaizhizao.schemas.purchase_order_sync import (
    PurchaseOrderPushBindingOut,
    PurchaseOrderPushBindingUpsert,
    PurchaseOrderSyncBindingOut,
    PurchaseOrderSyncBindingUpsert,
    PurchaseOrderSyncFromSourceOut,
    PurchaseOrderSyncFromSourceRequest,
)
from apps.kuaizhizao.services.purchase_service import PurchaseService
from apps.master_data.services.master_data_sync_common import (
    apply_mapped_custom_field_values,
    fetch_sync_rows,
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
PURCHASE_ORDER_CUSTOM_FIELD_TABLE = "apps_kuaizhizao_purchase_orders"
from apps.master_data.services.sync_association_service import (
    find_material_by_code,
    resolve_supplier_by_header,
    run_purchase_order_prerequisite_syncs,
)
from core.services.data.sync_from_source_fetch import (
    fetch_rows_from_api,
    fetch_rows_from_dataset,
)
class PurchaseOrderSyncService:
    ITEM_PREFIX = "item."
    def serialize_binding(self, row: Optional[PurchaseOrderSyncBinding]) -> PurchaseOrderSyncBindingOut:
        if not row:
            return PurchaseOrderSyncBindingOut()
        data = serialize_binding_row(row, default_match_key="order_code")
        return PurchaseOrderSyncBindingOut(**data)
    async def upsert_binding(
        self,
        tenant_id: int,
        body: PurchaseOrderSyncBindingUpsert,
    ) -> PurchaseOrderSyncBindingOut:
        if body.sources is not None and len(body.sources) == 0:
            await PurchaseOrderSyncBinding.filter(tenant_id=tenant_id).delete()
            return PurchaseOrderSyncBindingOut()
        sources = sources_from_upsert_body(body)
        match_key = (body.match_key_field or "order_code").strip() or "order_code"
        sync_mode = normalize_sync_mode(body.sync_mode)
        interval = normalize_schedule_interval(body.schedule_interval_minutes)
        row = await upsert_sync_binding(
            PurchaseOrderSyncBinding,
            tenant_id,
            sources=sources,
            match_key_field=match_key,
            sync_mode=sync_mode,
            schedule_interval_minutes=interval,
        )
        return self.serialize_binding(row)
    async def get_binding(self, tenant_id: int) -> PurchaseOrderSyncBindingOut:
        row = await PurchaseOrderSyncBinding.filter(tenant_id=tenant_id).first()
        return self.serialize_binding(row)

    def serialize_push_binding(self, row: Optional[PurchaseOrderSyncBinding]) -> PurchaseOrderPushBindingOut:
        from core.schemas.sync_binding_contract import DocumentPushTargetItem
        from core.services.data.sync_binding_sources import (
            push_targets_from_row,
            trigger_actions_from_row,
        )

        if not row or not isinstance(getattr(row, "push_targets", None), list):
            return PurchaseOrderPushBindingOut()
        stored = [DocumentPushTargetItem.model_validate(item) for item in push_targets_from_row(row)]
        targets = [item for item in stored if item.user_saved]
        first = targets[0] if targets else None
        return PurchaseOrderPushBindingOut(
            targets=targets,
            trigger_actions=trigger_actions_from_row(row) if targets else [],
            connection_code=first.connection_code if first else None,
            save_api_uuid=first.save_api_uuid if first else None,
            sync_mode=str(getattr(row, "sync_mode", None) or "manual_full"),
            schedule_interval_minutes=int(getattr(row, "schedule_interval_minutes", None) or 15),
            targets_configured=True,
        )

    async def get_push_binding(self, tenant_id: int) -> PurchaseOrderPushBindingOut:
        row = await PurchaseOrderSyncBinding.filter(tenant_id=tenant_id).first()
        out = self.serialize_push_binding(row)
        if (
            row
            and isinstance(getattr(row, "push_targets", None), list)
            and out.targets_configured
            and not out.targets
            and getattr(row, "push_targets", None)
        ):
            await PurchaseOrderSyncBinding.filter(id=row.id).update(push_targets=[], trigger_actions=[])
        return out

    async def upsert_push_binding(
        self,
        tenant_id: int,
        body: PurchaseOrderPushBindingUpsert,
    ) -> PurchaseOrderPushBindingOut:
        from core.services.data.sync_binding_sources import normalize_push_targets_json

        row = await PurchaseOrderSyncBinding.filter(tenant_id=tenant_id).first()
        if not row:
            row = await PurchaseOrderSyncBinding.create(tenant_id=tenant_id)
        targets = normalize_push_targets_json([item.model_dump(mode="json") for item in body.targets])
        triggers = [str(action).strip().lower() for action in body.trigger_actions if str(action).strip()]
        await PurchaseOrderSyncBinding.filter(id=row.id).update(
            push_targets=targets,
            trigger_actions=triggers,
        )
        fresh = await PurchaseOrderSyncBinding.get(id=row.id)
        return self.serialize_push_binding(fresh)

    async def sync_from_source(
        self,
        tenant_id: int,
        user_id: int,
        request: Optional[PurchaseOrderSyncFromSourceRequest] = None,
    ) -> PurchaseOrderSyncFromSourceOut:
        req = request or PurchaseOrderSyncFromSourceRequest()
        sources, match_key, binding = await resolve_sync_sources(
            PurchaseOrderSyncBinding,
            tenant_id,
            req,
            default_match_key="order_code",
        )
        binding = binding or await PurchaseOrderSyncBinding.filter(tenant_id=tenant_id).first()
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
                PurchaseOrderSyncBindingUpsert(
                    sources=req.sources,
                    match_key_field=match_key,
                    sync_mode=sync_mode,
                    schedule_interval_minutes=interval,
                ),
            )
            binding = await PurchaseOrderSyncBinding.filter(tenant_id=tenant_id).first()
        since = resolve_incremental_since(
            binding,
            sync_mode=sync_mode,
            request_incremental=req.incremental,
        )
        try:
            order_map: Dict[str, Dict[str, Any]] = {}
            source_errors: List[str] = []
            for src in sources:
                kind = str(src.get("kind") or "").strip()
                field_mapping = src.get("field_mapping") or {}
                try:
                    raw_rows = await fetch_sync_rows(
                        tenant_id,
                        source_type=kind,
                        api_uuid=str(src.get("api_uuid") or "").strip() or None,
                        dataset_uuid=str(src.get("dataset_uuid") or "").strip() or None,
                        since=since,
                        active_only=req.active_only,
                    )
                    for order in self._build_orders_from_rows(raw_rows, field_mapping, match_key):
                        key_val = self._stringify(order.get(match_key))
                        if key_val:
                            order_map[key_val] = order
                except Exception as exc:
                    source_errors.append(str(exc))
            orders = list(order_map.values())
            from infra.models.user import User
            current_user = await User.get_or_none(id=user_id)
            if not current_user:
                raise ValidationError("同步用户不存在")
            prerequisite_errors: List[str] = []
            if not req.skip_prerequisite_syncs:
                prerequisite_errors = await run_purchase_order_prerequisite_syncs(
                    tenant_id, current_user
                )
            result = await self._upsert_orders(tenant_id, user_id, orders, match_key)
            if prerequisite_errors or source_errors:
                result.errors = (prerequisite_errors + source_errors + list(result.errors))[:20]
            if binding:
                if result.failed and not (result.created or result.updated):
                    await mark_binding_failure(
                        binding, "; ".join(result.errors) or "采购订单同步失败"
                    )
                else:
                    await mark_binding_success(binding)
            return result
        except Exception as exc:
            if binding:
                await mark_binding_failure(binding, str(exc))
            raise
    def _build_orders_from_rows(
        self,
        raw_rows: List[Dict[str, Any]],
        field_mapping: Dict[str, str],
        match_key: str,
    ) -> List[Dict[str, Any]]:
        grouped: Dict[str, Dict[str, Any]] = {}
        order_list: List[Dict[str, Any]] = []
        for raw in raw_rows:
            if not isinstance(raw, dict):
                continue
            mapped = self._map_row(raw, field_mapping)
            nested_items = mapped.pop("items", None)
            if isinstance(nested_items, list) and nested_items:
                key_val = self._stringify(mapped.get(match_key))
                if not key_val:
                    continue
                bucket = grouped.setdefault(
                    key_val,
                    {**{k: v for k, v in mapped.items() if not str(k).startswith(self.ITEM_PREFIX)}, "items": []},
                )
                for nested in nested_items:
                    if isinstance(nested, dict):
                        bucket["items"].append(nested)
                for field, value in mapped.items():
                    if str(field).startswith(self.ITEM_PREFIX):
                        continue
                    if bucket.get(field) in (None, "") and value not in (None, ""):
                        bucket[field] = value
                continue
            item_fields = {
                field[len(self.ITEM_PREFIX) :]: value
                for field, value in mapped.items()
                if str(field).startswith(self.ITEM_PREFIX)
            }
            header = {
                field: value
                for field, value in mapped.items()
                if not str(field).startswith(self.ITEM_PREFIX)
            }
            key_val = self._stringify(header.get(match_key))
            if not key_val:
                continue
            if item_fields:
                bucket = grouped.setdefault(key_val, {**header, "items": []})
                for field, value in header.items():
                    if bucket.get(field) in (None, "") and value not in (None, ""):
                        bucket[field] = value
                bucket["items"].append(item_fields)
            else:
                order_list.append({**header, "items": header.get("items") or []})
                grouped[key_val] = order_list[-1]
        for key_val, bucket in grouped.items():
            if key_val not in {self._stringify(o.get(match_key)) for o in order_list}:
                order_list.append(bucket)
        return order_list
    def _map_row(self, raw: Dict[str, Any], field_mapping: Dict[str, str]) -> Dict[str, Any]:
        mapped: Dict[str, Any] = {}
        for src_key, target_key in field_mapping.items():
            if not str(src_key).strip() or not str(target_key).strip():
                continue
            if src_key not in raw:
                continue
            value = raw[src_key]
            target = str(target_key).strip()
            if target == "items" and isinstance(value, list):
                mapped["items"] = value
            else:
                mapped[target] = value
        return mapped
    async def _upsert_orders(
        self,
        tenant_id: int,
        user_id: int,
        orders: List[Dict[str, Any]],
        match_key: str,
    ) -> PurchaseOrderSyncFromSourceOut:
        purchase_service = PurchaseService()
        created = 0
        updated = 0
        skipped = 0
        failed = 0
        errors: List[str] = []
        custom_fields_by_code = await load_custom_fields_by_code(
            tenant_id, PURCHASE_ORDER_CUSTOM_FIELD_TABLE
        )
        for header in orders:
            order_key = self._stringify(header.get(match_key))
            if not order_key:
                skipped += 1
                errors.append("存在缺少订单号的行，已跳过")
                continue
            try:
                payload = await self._build_purchase_order_payload(tenant_id, header)
                existing = await PurchaseOrder.filter(
                    tenant_id=tenant_id,
                    order_code=order_key,
                    deleted_at__isnull=True,
                ).first()
                if existing:
                    if existing.status not in (
                        DocumentStatus.DRAFT.value,
                        DocumentStatus.REJECTED.value,
                    ):
                        skipped += 1
                        errors.append(f"订单 {order_key} 已审核或非草稿，已跳过")
                        continue
                    update_data = PurchaseOrderUpdate(**payload["update"])
                    await purchase_service.update_purchase_order(
                        tenant_id=tenant_id,
                        order_id=existing.id,
                        order_data=update_data,
                        updated_by=user_id,
                    )
                    await mark_external_sync_record(existing)
                    if custom_fields_by_code:
                        await apply_mapped_custom_field_values(
                            tenant_id=tenant_id,
                            record_table=PURCHASE_ORDER_CUSTOM_FIELD_TABLE,
                            record_id=int(existing.id),
                            mapped_row=header,
                            fields_by_code=custom_fields_by_code,
                        )
                    updated += 1
                else:
                    create_data = PurchaseOrderCreate(**payload["create"])
                    await purchase_service.create_purchase_order(
                        tenant_id=tenant_id,
                        order_data=create_data,
                        created_by=user_id,
                    )
                    created_order = await PurchaseOrder.filter(
                        tenant_id=tenant_id,
                        order_code=order_key,
                        deleted_at__isnull=True,
                    ).first()
                    if created_order:
                        if custom_fields_by_code:
                            await apply_mapped_custom_field_values(
                                tenant_id=tenant_id,
                                record_table=PURCHASE_ORDER_CUSTOM_FIELD_TABLE,
                                record_id=int(created_order.id),
                                mapped_row=header,
                                fields_by_code=custom_fields_by_code,
                            )
                        await mark_external_sync_record(created_order)
                    created += 1
            except Exception as exc:
                failed += 1
                errors.append(f"订单 {order_key or '-'}：{exc}")
        return PurchaseOrderSyncFromSourceOut(
            created=created,
            updated=updated,
            skipped=skipped,
            failed=failed,
            errors=errors[:20],
        )
    async def _build_purchase_order_payload(
        self,
        tenant_id: int,
        header: Dict[str, Any],
    ) -> Dict[str, Any]:
        supplier_id, supplier_name = await resolve_supplier_by_header(
            tenant_id,
            supplier_id=header.get("supplier_id"),
            supplier_code=self._stringify(header.get("supplier_code")),
            supplier_name=self._stringify(header.get("supplier_name")),
        )
        order_date = self._parse_date(header.get("order_date"), "order_date")
        delivery_date = self._parse_date(
            header.get("delivery_date") or order_date,
            "delivery_date",
        )
        raw_items = header.get("items") or []
        if not raw_items:
            raise ValidationError("订单须至少包含一条明细")
        item_payloads: List[PurchaseOrderItemCreate] = []
        for raw_item in raw_items:
            if not isinstance(raw_item, dict):
                continue
            item_payloads.append(
                await self._build_item_payload(tenant_id, raw_item, delivery_date)
            )
        if not item_payloads:
            raise ValidationError("订单须至少包含一条有效明细")
        header_total_qty = self._optional_decimal(header.get("total_quantity"))
        if header_total_qty is None:
            header_total_qty = sum(
                (item.ordered_quantity for item in item_payloads),
                Decimal("0"),
            )
        header_total_amount = self._optional_decimal(header.get("total_amount"))
        header_data = {
            "order_code": self._stringify(header.get("order_code")) or None,
            "order_date": order_date,
            "delivery_date": delivery_date,
            "supplier_id": supplier_id,
            "supplier_name": supplier_name,
            "supplier_contact": self._optional_str(header.get("supplier_contact")),
            "supplier_phone": self._optional_str(header.get("supplier_phone")),
            "total_amount": header_total_amount,
            "total_quantity": header_total_qty,
            "buyer_name": self._optional_str(header.get("buyer_name")),
            "notes": self._optional_str(header.get("notes")),
            "status": DocumentStatus.DRAFT.value,
        }
        create_payload = {**header_data, "items": item_payloads}
        update_payload = {
            key: value
            for key, value in header_data.items()
            if key not in ("order_code", "status")
        }
        update_payload["items"] = item_payloads
        return {"create": create_payload, "update": update_payload}
    async def _build_item_payload(
        self,
        tenant_id: int,
        raw_item: Dict[str, Any],
        default_delivery_date: date,
    ) -> PurchaseOrderItemCreate:
        material_code = self._stringify(raw_item.get("material_code"))
        if not material_code:
            raise ValidationError("明细缺少 material_code")
        material_name = self._stringify(raw_item.get("material_name"))
        material_id = raw_item.get("material_id")
        material_spec = self._optional_str(raw_item.get("material_spec"))
        material_unit = self._optional_str(raw_item.get("material_unit"))
        if not material_name or material_id is None:
            material = await find_material_by_code(tenant_id, material_code)
            if not material:
                raise ValidationError(
                    f"物料编码 {material_code} 不存在，请先在物料管理配置并完成物料同步"
                )
            material_id = material.id
            material_name = material.name
            material_spec = material_spec or material.specification
            material_unit = material_unit or material.base_unit
        qty = self._optional_decimal(raw_item.get("ordered_quantity"))
        if qty is None or qty <= 0:
            raise ValidationError(f"明细 {material_code} 数量无效")
        unit_price = self._optional_decimal(raw_item.get("unit_price"))
        if unit_price is None:
            unit_price = Decimal("0")
        item_delivery = self._parse_date(
            raw_item.get("required_date") or raw_item.get("delivery_date") or default_delivery_date,
            "delivery_date",
        )
        total_price = qty * unit_price
        return PurchaseOrderItemCreate(
            material_id=int(material_id) if material_id is not None else None,
            material_code=material_code,
            material_name=material_name or material_code,
            material_spec=material_spec,
            ordered_quantity=qty,
            unit=material_unit or "",
            unit_price=unit_price,
            total_price=total_price,
            required_date=item_delivery,
            notes=self._optional_str(raw_item.get("notes")),
        )
    @staticmethod
    def _stringify(value: Any) -> str:
        if value is None:
            return ""
        return str(value).strip()
    @staticmethod
    def _optional_str(value: Any) -> Optional[str]:
        text = PurchaseOrderSyncService._stringify(value)
        return text or None
    @staticmethod
    def _optional_decimal(value: Any) -> Optional[Decimal]:
        if value is None or value == "":
            return None
        try:
            return Decimal(str(value))
        except (InvalidOperation, ValueError):
            return None
    @staticmethod
    def _parse_date(value: Any, field_name: str) -> date:
        if isinstance(value, date) and not isinstance(value, datetime):
            return value
        if isinstance(value, datetime):
            return value.date()
        text = PurchaseOrderSyncService._stringify(value)
        if not text:
            raise ValidationError(f"{field_name} 不能为空")
        for fmt in ("%Y-%m-%d", "%Y/%m/%d", "%Y%m%d"):
            try:
                return datetime.strptime(text[:10], fmt).date()
            except ValueError:
                continue
        if "T" in text:
            try:
                return datetime.fromisoformat(text.replace("Z", "+00:00")).date()
            except ValueError:
                pass
        raise ValidationError(f"{field_name} 格式无效：{text}")
