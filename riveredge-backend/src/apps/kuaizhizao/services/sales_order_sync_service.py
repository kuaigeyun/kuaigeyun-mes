"""销售订单从数据接口/数据集同步服务。"""

from __future__ import annotations

from datetime import date, datetime
from decimal import Decimal, InvalidOperation
from typing import Any, Dict, List, Optional, Tuple

from infra.exceptions.exceptions import BusinessLogicError, ValidationError
from tortoise.expressions import Q
from tortoise.transactions import in_transaction

from apps.kuaizhizao.constants import DemandStatus
from apps.kuaizhizao.models.sales_order import SalesOrder
from apps.kuaizhizao.models.sales_order_item import SalesOrderItem
from apps.kuaizhizao.models.sales_order_sync_binding import SalesOrderSyncBinding
from apps.kuaizhizao.schemas.sales_order import SalesOrderCreate, SalesOrderItemCreate, SalesOrderUpdate
from apps.kuaizhizao.schemas.sales_order_sync import (
    SalesOrderSyncBindingOut,
    SalesOrderSyncBindingUpsert,
    SalesOrderSyncFromSourceOut,
    SalesOrderSyncFromSourceRequest,
)
from apps.kuaizhizao.services.sales_order_service import (
    SalesOrderService,
    _SALES_ORDER_PERSIST_EXCLUDE,
)
from apps.master_data.models.customer import Customer
from apps.master_data.models.material import Material
from apps.master_data.services.master_data_sync_common import (
    apply_mapped_custom_field_values,
    attach_sync_fetch_meta,
    load_custom_fields_by_code,
    mark_binding_failure,
    mark_binding_success,
    normalize_schedule_interval,
    normalize_sync_mode,
    resolve_incremental_since,
)
from apps.master_data.services.sync_association_service import (
    run_sales_order_prerequisite_syncs,
)
from core.services.data.sync_from_source_fetch import (
    fetch_rows_from_api,
    fetch_rows_from_dataset,
)
from core.services.data.sync_progress import emit_sync_progress
from core.utils.timezone_utils import resolve_business_datetime

SALES_ORDER_CUSTOM_FIELD_TABLE = "apps_kuaizhizao_sales_orders"

_SYNC_WRITE_PROGRESS_EVERY = 25
_LOOKUP_IN_CHUNK = 800


class SalesOrderSyncService:
    ITEM_PREFIX = "item."

    def serialize_binding(self, row: Optional[SalesOrderSyncBinding]) -> SalesOrderSyncBindingOut:
        if not row:
            return SalesOrderSyncBindingOut()
        mapping = row.field_mapping if isinstance(row.field_mapping, dict) else {}
        return SalesOrderSyncBindingOut(
            source_type=row.source_type,
            api_uuid=row.api_uuid,
            dataset_uuid=row.dataset_uuid,
            field_mapping={str(k): str(v) for k, v in mapping.items()},
            match_key_field=row.match_key_field or "order_code",
            sync_mode=row.sync_mode or "manual_full",
            schedule_interval_minutes=int(row.schedule_interval_minutes or 15),
            last_success_at=row.last_success_at,
            last_attempt_at=row.last_attempt_at,
            last_error=row.last_error,
        )

    async def upsert_binding(
        self,
        tenant_id: int,
        body: SalesOrderSyncBindingUpsert,
    ) -> SalesOrderSyncBindingOut:
        source_type = (body.source_type or "").strip()
        api_uuid = (body.api_uuid or "").strip() or None
        dataset_uuid = (body.dataset_uuid or "").strip() or None

        if not source_type and not api_uuid and not dataset_uuid:
            await SalesOrderSyncBinding.filter(tenant_id=tenant_id).delete()
            return SalesOrderSyncBindingOut()

        if source_type not in ("api", "dataset"):
            raise ValidationError("来源类型须为 api 或 dataset")
        if source_type == "api" and not api_uuid:
            raise ValidationError("已选择数据接口时须指定接口")
        if source_type == "dataset" and not dataset_uuid:
            raise ValidationError("已选择数据集时须指定数据集")

        field_mapping = body.field_mapping if isinstance(body.field_mapping, dict) else {}
        if not field_mapping:
            raise ValidationError("请配置字段映射")

        match_key = (body.match_key_field or "order_code").strip() or "order_code"
        if match_key not in field_mapping.values():
            raise ValidationError(f"字段映射须包含匹配键 {match_key}")

        sync_mode = normalize_sync_mode(body.sync_mode)
        interval = normalize_schedule_interval(body.schedule_interval_minutes)

        existing = await SalesOrderSyncBinding.filter(tenant_id=tenant_id).first()
        preserve = {
            "last_success_at": existing.last_success_at if existing else None,
            "last_attempt_at": existing.last_attempt_at if existing else None,
            "last_error": existing.last_error if existing else None,
        }
        await SalesOrderSyncBinding.filter(tenant_id=tenant_id).delete()
        row = await SalesOrderSyncBinding.create(
            tenant_id=tenant_id,
            source_type=source_type,
            api_uuid=api_uuid if source_type == "api" else None,
            dataset_uuid=dataset_uuid if source_type == "dataset" else None,
            field_mapping=field_mapping,
            match_key_field=match_key,
            sync_mode=sync_mode,
            schedule_interval_minutes=interval,
            **preserve,
        )
        return self.serialize_binding(row)

    async def get_binding(self, tenant_id: int) -> SalesOrderSyncBindingOut:
        row = await SalesOrderSyncBinding.filter(tenant_id=tenant_id).first()
        return self.serialize_binding(row)

    async def sync_from_source(
        self,
        tenant_id: int,
        user_id: int,
        request: Optional[SalesOrderSyncFromSourceRequest] = None,
    ) -> SalesOrderSyncFromSourceOut:
        req = request or SalesOrderSyncFromSourceRequest()
        binding = await SalesOrderSyncBinding.filter(tenant_id=tenant_id).first()

        source_type = (req.source_type or (binding.source_type if binding else "") or "").strip()
        api_uuid = (req.api_uuid or (binding.api_uuid if binding else "") or "").strip() or None
        dataset_uuid = (
            (req.dataset_uuid or (binding.dataset_uuid if binding else "") or "").strip() or None
        )
        field_mapping = req.field_mapping if isinstance(req.field_mapping, dict) else None
        if not field_mapping and binding and isinstance(binding.field_mapping, dict):
            field_mapping = binding.field_mapping
        match_key = (
            (binding.match_key_field if binding else None) or "order_code"
        ).strip() or "order_code"

        if not source_type:
            raise ValidationError("请配置同步来源（数据接口或数据集）")
        if not field_mapping:
            raise ValidationError("请配置字段映射")
        if match_key not in field_mapping.values():
            raise ValidationError(f"字段映射须包含匹配键 {match_key}")

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
                SalesOrderSyncBindingUpsert(
                    source_type=source_type,
                    api_uuid=api_uuid,
                    dataset_uuid=dataset_uuid,
                    field_mapping=field_mapping,
                    match_key_field=match_key,
                    sync_mode=sync_mode,
                    schedule_interval_minutes=interval,
                ),
            )
            binding = await SalesOrderSyncBinding.filter(tenant_id=tenant_id).first()

        since = resolve_incremental_since(
            binding,
            sync_mode=sync_mode,
            request_incremental=req.incremental,
        )

        try:
            await emit_sync_progress("开始同步销售订单…")
            if source_type == "api":
                if not api_uuid:
                    raise ValidationError("数据接口同步须指定接口")
                raw_rows = await fetch_rows_from_api(tenant_id, api_uuid, since=since, active_only=req.active_only)
            elif source_type == "dataset":
                if not dataset_uuid:
                    raise ValidationError("数据集同步须指定数据集")
                raw_rows = await fetch_rows_from_dataset(tenant_id, dataset_uuid, since=since)
            else:
                raise ValidationError("来源类型须为 api 或 dataset")

            await emit_sync_progress(f"源端拉取完成 {len(raw_rows)} 行，正在组装订单…")
            orders = self._build_orders_from_rows(raw_rows, field_mapping, match_key)
            await emit_sync_progress(f"已组装 {len(orders)} 张销售订单，开始写入…")

            from infra.models.user import User

            current_user = await User.get_or_none(id=user_id)
            if not current_user:
                raise ValidationError("同步用户不存在")
            prerequisite_errors: List[str] = []
            if not req.skip_prerequisite_syncs:
                prerequisite_errors = await run_sales_order_prerequisite_syncs(
                    tenant_id, current_user
                )
            result = await self._upsert_orders(tenant_id, user_id, orders, match_key, current_user)
            attach_sync_fetch_meta(result, fetched=len(raw_rows), since=since)
            if prerequisite_errors:
                result.errors = (prerequisite_errors + list(result.errors))[:20]
            if binding:
                if result.failed and not (result.created or result.updated):
                    await mark_binding_failure(
                        binding, "; ".join(result.errors) or "销售订单同步失败"
                    )
                else:
                    await mark_binding_success(binding)
            return result
        except Exception as exc:
            if binding:
                await mark_binding_failure(binding, str(exc))
            raise

    async def _fetch_rows_from_api(self, tenant_id: int, api_uuid: str) -> List[Dict[str, Any]]:
        return await fetch_rows_from_api(tenant_id, api_uuid)

    async def _fetch_rows_from_dataset(self, tenant_id: int, dataset_uuid: str) -> List[Dict[str, Any]]:
        return await fetch_rows_from_dataset(tenant_id, dataset_uuid)

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
        current_user: Any,
    ) -> SalesOrderSyncFromSourceOut:
        from apps.common.base_service import AppBaseService
        from infra.models.user import User

        if current_user is None:
            current_user = await User.get_or_none(id=user_id)
        if not current_user:
            raise ValidationError("同步用户不存在")

        sales_order_service = SalesOrderService()
        is_enabled = await sales_order_service.business_config_service.check_node_enabled(
            tenant_id, "sales_order"
        )
        if not is_enabled:
            raise BusinessLogicError("销售管理模块未启用，无法同步销售订单")

        operator_name = await AppBaseService().get_user_name(user_id)
        caches = await self._prefetch_sync_caches(tenant_id, orders, match_key)
        custom_fields_by_code = await load_custom_fields_by_code(
            tenant_id, SALES_ORDER_CUSTOM_FIELD_TABLE
        )

        created = 0
        updated = 0
        skipped = 0
        failed = 0
        errors: List[str] = []
        total = len(orders)
        sync_at = resolve_business_datetime()

        for index, header in enumerate(orders, start=1):
            order_key = self._stringify(header.get(match_key))
            if not order_key:
                skipped += 1
                errors.append("存在缺少订单号的行，已跳过")
                continue
            if (
                index == 1
                or index == total
                or index % _SYNC_WRITE_PROGRESS_EVERY == 0
            ):
                await emit_sync_progress(f"正在写入销售订单 {index}/{total}：{order_key}")
            try:
                payload = self._build_sales_order_payload_cached(header, caches)
                existing = caches["orders_by_code"].get(order_key)
                if existing:
                    if existing.status not in (
                        DemandStatus.DRAFT.value,
                        DemandStatus.REJECTED.value,
                    ):
                        skipped += 1
                        errors.append(f"订单 {order_key} 已审核或非草稿，已跳过")
                        continue
                    await self._sync_update_order(
                        tenant_id=tenant_id,
                        existing=existing,
                        payload=payload,
                        user_id=user_id,
                        operator_name=operator_name,
                        material_by_id=caches["material_by_id"],
                        customer_by_id=caches["customer_by_id"],
                        sync_at=sync_at,
                        sales_order_service=sales_order_service,
                    )
                    if custom_fields_by_code:
                        await apply_mapped_custom_field_values(
                            tenant_id=tenant_id,
                            record_table=SALES_ORDER_CUSTOM_FIELD_TABLE,
                            record_id=int(existing.id),
                            mapped_row=header,
                            fields_by_code=custom_fields_by_code,
                        )
                    updated += 1
                else:
                    order = await self._sync_create_order(
                        tenant_id=tenant_id,
                        payload=payload,
                        user_id=user_id,
                        operator_name=operator_name,
                        material_by_id=caches["material_by_id"],
                        customer_by_id=caches["customer_by_id"],
                        sync_at=sync_at,
                        sales_order_service=sales_order_service,
                    )
                    caches["orders_by_code"][order_key] = order
                    if custom_fields_by_code:
                        await apply_mapped_custom_field_values(
                            tenant_id=tenant_id,
                            record_table=SALES_ORDER_CUSTOM_FIELD_TABLE,
                            record_id=int(order.id),
                            mapped_row=header,
                            fields_by_code=custom_fields_by_code,
                        )
                    created += 1
            except Exception as exc:
                failed += 1
                errors.append(f"订单 {order_key or '-'}：{exc}")

        return SalesOrderSyncFromSourceOut(
            created=created,
            updated=updated,
            skipped=skipped,
            failed=failed,
            errors=errors[:20],
        )

    async def _prefetch_sync_caches(
        self,
        tenant_id: int,
        orders: List[Dict[str, Any]],
        match_key: str,
    ) -> Dict[str, Any]:
        await emit_sync_progress("预加载客户、物料与已有订单…")
        customer_codes: set[str] = set()
        customer_names: set[str] = set()
        customer_ids: set[int] = set()
        material_codes: set[str] = set()
        order_codes: List[str] = []

        for header in orders:
            order_key = self._stringify(header.get(match_key))
            if order_key:
                order_codes.append(order_key)
            cid = header.get("customer_id")
            if cid is not None and str(cid).strip() != "":
                try:
                    customer_ids.add(int(cid))
                except (TypeError, ValueError):
                    pass
            code = self._stringify(header.get("customer_code"))
            if code:
                customer_codes.add(code)
                customer_codes.add(code.upper())
            name = self._stringify(header.get("customer_name"))
            if name:
                customer_names.add(name)
            for raw_item in header.get("items") or []:
                if not isinstance(raw_item, dict):
                    continue
                mcode = self._stringify(raw_item.get("material_code"))
                if mcode:
                    material_codes.add(mcode)

        customer_by_code: Dict[str, Customer] = {}
        customer_by_name: Dict[str, Customer] = {}
        customer_by_id: Dict[int, Customer] = {}

        for chunk in self._chunked(sorted(customer_codes), _LOOKUP_IN_CHUNK):
            rows = await Customer.filter(
                tenant_id=tenant_id,
                code__in=chunk,
                deleted_at__isnull=True,
            ).all()
            for row in rows:
                customer_by_code[row.code] = row
                customer_by_code[row.code.upper()] = row
                customer_by_id[int(row.id)] = row

        for chunk in self._chunked(sorted(customer_names), _LOOKUP_IN_CHUNK):
            rows = await Customer.filter(
                tenant_id=tenant_id,
                name__in=chunk,
                deleted_at__isnull=True,
            ).all()
            for row in rows:
                customer_by_name[row.name] = row
                customer_by_id[int(row.id)] = row

        for chunk in self._chunked(sorted(customer_ids), _LOOKUP_IN_CHUNK):
            rows = await Customer.filter(
                tenant_id=tenant_id,
                id__in=chunk,
                deleted_at__isnull=True,
            ).all()
            for row in rows:
                customer_by_id[int(row.id)] = row
                customer_by_code[row.code] = row
                customer_by_code[row.code.upper()] = row

        material_by_code: Dict[str, Material] = {}
        material_by_id: Dict[int, Material] = {}
        for chunk in self._chunked(sorted(material_codes), _LOOKUP_IN_CHUNK):
            rows = await Material.filter(
                tenant_id=tenant_id,
                deleted_at__isnull=True,
            ).filter(Q(main_code__in=chunk) | Q(code__in=chunk)).all()
            for row in rows:
                material_by_id[int(row.id)] = row
                if row.main_code:
                    material_by_code[row.main_code] = row
                if row.code:
                    material_by_code[row.code] = row

        orders_by_code: Dict[str, SalesOrder] = {}
        for chunk in self._chunked(sorted(set(order_codes)), _LOOKUP_IN_CHUNK):
            rows = await SalesOrder.filter(
                tenant_id=tenant_id,
                order_code__in=chunk,
                deleted_at__isnull=True,
            ).all()
            for row in rows:
                orders_by_code[row.order_code] = row

        await emit_sync_progress(
            f"预加载完成：客户 {len(customer_by_id)}，物料 {len(material_by_id)}，"
            f"已有订单 {len(orders_by_code)}"
        )
        return {
            "customer_by_code": customer_by_code,
            "customer_by_name": customer_by_name,
            "customer_by_id": customer_by_id,
            "material_by_code": material_by_code,
            "material_by_id": material_by_id,
            "orders_by_code": orders_by_code,
        }

    @staticmethod
    def _chunked(values: List[Any], size: int) -> List[List[Any]]:
        if not values:
            return []
        return [values[i : i + size] for i in range(0, len(values), size)]

    def _build_sales_order_payload_cached(
        self,
        header: Dict[str, Any],
        caches: Dict[str, Any],
    ) -> Dict[str, Any]:
        customer_id, customer_name = self._resolve_customer_cached(header, caches)
        order_date = self._parse_date(header.get("order_date"), "order_date")
        delivery_date = self._parse_date(
            header.get("delivery_date") or order_date,
            "delivery_date",
        )
        raw_items = header.get("items") or []
        if not raw_items:
            raise ValidationError("订单须至少包含一条明细")

        item_payloads: List[SalesOrderItemCreate] = []
        for raw_item in raw_items:
            if not isinstance(raw_item, dict):
                continue
            item_payloads.append(
                self._build_item_payload_cached(raw_item, delivery_date, caches)
            )
        if not item_payloads:
            raise ValidationError("订单须至少包含一条有效明细")

        header_total_qty = self._optional_decimal(header.get("total_quantity"))
        if header_total_qty is None:
            header_total_qty = sum(
                (item.required_quantity for item in item_payloads),
                Decimal("0"),
            )
        header_total_amount = self._optional_decimal(header.get("total_amount"))

        header_data = {
            "order_code": self._stringify(header.get("order_code")) or None,
            "order_date": order_date,
            "delivery_date": delivery_date,
            "customer_id": customer_id,
            "customer_name": customer_name,
            "customer_contact": self._optional_str(header.get("customer_contact")),
            "customer_phone": self._optional_str(header.get("customer_phone")),
            "total_amount": header_total_amount,
            "total_quantity": header_total_qty,
            "salesman_name": self._optional_str(header.get("salesman_name")),
            "notes": self._optional_str(header.get("notes")),
            "shipping_address": self._optional_str(header.get("shipping_address")),
            "payment_terms": self._optional_str(header.get("payment_terms")),
            "status": DemandStatus.DRAFT,
        }
        create_payload = {**header_data, "items": item_payloads}
        update_payload = {
            key: value
            for key, value in header_data.items()
            if key not in ("order_code", "status")
        }
        update_payload["items"] = item_payloads
        return {"create": create_payload, "update": update_payload}

    def _build_item_payload_cached(
        self,
        raw_item: Dict[str, Any],
        default_delivery_date: date,
        caches: Dict[str, Any],
    ) -> SalesOrderItemCreate:
        material_code = self._stringify(raw_item.get("material_code"))
        if not material_code:
            raise ValidationError("明细缺少 material_code")
        material_name = self._stringify(raw_item.get("material_name"))
        material_id = raw_item.get("material_id")
        material_spec = self._optional_str(raw_item.get("material_spec"))
        material_unit = self._optional_str(raw_item.get("material_unit"))

        if not material_name or material_id is None:
            material = caches["material_by_code"].get(material_code)
            if not material:
                raise ValidationError(
                    f"物料编码 {material_code} 不存在，请先在物料管理配置并完成物料同步"
                )
            material_id = material.id
            material_name = material.name
            material_spec = material_spec or material.specification
            material_unit = material_unit or material.base_unit
            caches["material_by_id"][int(material.id)] = material

        qty = self._optional_decimal(raw_item.get("required_quantity"))
        if qty is None or qty <= 0:
            raise ValidationError(f"明细 {material_code} 数量无效")
        item_delivery = self._parse_date(
            raw_item.get("delivery_date") or default_delivery_date,
            "delivery_date",
        )
        return SalesOrderItemCreate(
            material_id=int(material_id) if material_id is not None else None,
            material_code=material_code,
            material_name=material_name or material_code,
            material_spec=material_spec,
            material_unit=material_unit,
            required_quantity=qty,
            delivery_date=item_delivery,
            unit_price=self._optional_decimal(raw_item.get("unit_price")),
            tax_rate=self._optional_decimal(raw_item.get("tax_rate")),
            notes=self._optional_str(raw_item.get("notes")),
        )

    def _resolve_customer_cached(
        self,
        header: Dict[str, Any],
        caches: Dict[str, Any],
    ) -> Tuple[int, str]:
        customer_id = header.get("customer_id")
        if customer_id is not None and str(customer_id).strip() != "":
            try:
                customer_id_int = int(customer_id)
            except (TypeError, ValueError) as exc:
                raise ValidationError("customer_id 无效") from exc
            customer = caches["customer_by_id"].get(customer_id_int)
            if not customer:
                raise ValidationError(f"客户 ID {customer_id_int} 不存在")
            return customer.id, customer.name

        code = self._stringify(header.get("customer_code"))
        name = self._stringify(header.get("customer_name"))
        if code:
            customer = caches["customer_by_code"].get(code) or caches["customer_by_code"].get(
                code.upper()
            )
            if not customer:
                raise ValidationError(
                    f"客户编码 {code} 不存在，请先在客户管理配置并完成客户同步"
                )
            return customer.id, customer.name

        if name:
            customer = caches["customer_by_name"].get(name)
            if not customer:
                raise ValidationError(
                    f"客户名称 {name} 不存在，请先在客户管理配置并完成客户同步"
                )
            return customer.id, customer.name

        raise ValidationError("须映射 customer_id、customer_code 或 customer_name 之一")

    async def _sync_create_order(
        self,
        *,
        tenant_id: int,
        payload: Dict[str, Any],
        user_id: int,
        operator_name: str,
        material_by_id: Dict[int, Material],
        customer_by_id: Dict[int, Customer],
        sync_at: datetime,
        sales_order_service: SalesOrderService,
    ) -> SalesOrder:
        create_data = SalesOrderCreate(**payload["create"])
        if not create_data.order_code:
            raise ValidationError("同步创建须带订单号")
        sales_order_service._validate_sales_order_non_negative(
            discount_amount=getattr(create_data, "discount_amount", Decimal("0"))
            or Decimal("0"),
            total_quantity=getattr(create_data, "total_quantity", None),
            total_amount=getattr(create_data, "total_amount", None),
            total_fee_amount=getattr(create_data, "total_fee_amount", None),
        )
        order_dict = create_data.model_dump(exclude=_SALES_ORDER_PERSIST_EXCLUDE)
        order_dict["term_group_id"] = None
        order_dict["term_group_name"] = None
        order_dict["contract_terms"] = None
        order_dict["status"] = create_data.status
        order_dict["review_status"] = create_data.review_status
        order_dict["created_by"] = user_id
        order_dict["created_by_name"] = operator_name
        order_dict["updated_by"] = user_id
        order_dict["updated_by_name"] = operator_name
        order_dict["external_sync_at"] = sync_at
        if order_dict.get("total_amount") is None:
            order_dict["total_amount"] = Decimal("0")
        if order_dict.get("total_quantity") is None:
            order_dict["total_quantity"] = Decimal("0")

        partner_settlement_method = None
        customer = customer_by_id.get(int(order_dict["customer_id"]))
        if customer:
            partner_settlement_method = customer.settlement_method_code
            if not order_dict.get("salesman_id") and customer.salesman_id:
                order_dict["salesman_id"] = customer.salesman_id
                order_dict["salesman_name"] = customer.salesman_name

        item_rows, total_qty, total_amt = self._build_priced_item_rows(
            create_data.items,
            material_by_id=material_by_id,
            partner_settlement_method=partner_settlement_method,
            sales_order_service=sales_order_service,
            provided_total=create_data.total_amount
            if "total_amount" in create_data.model_fields_set
            else None,
            discount_amount=Decimal(str(getattr(create_data, "discount_amount", None) or 0)),
            price_type=order_dict.get("price_type"),
        )
        order_dict["total_quantity"] = total_qty
        order_dict["total_amount"] = total_amt

        async with in_transaction():
            order = await SalesOrder.create(tenant_id=tenant_id, **order_dict)
            await SalesOrderItem.bulk_create(
                [
                    SalesOrderItem(
                        tenant_id=tenant_id,
                        sales_order_id=order.id,
                        material_id=row["material_id"],
                        material_code=row["material_code"],
                        material_name=row["material_name"],
                        material_spec=row["material_spec"],
                        material_unit=row["material_unit"],
                        order_quantity=row["order_quantity"],
                        delivered_quantity=row["delivered_quantity"],
                        remaining_quantity=row["remaining_quantity"],
                        unit_price=row["unit_price"],
                        tax_rate=row["tax_rate"],
                        total_amount=row["total_amount"],
                        delivery_date=row["delivery_date"],
                        delivery_status=row["delivery_status"],
                        variant_attributes=row["variant_attributes"],
                        configurable_selections=row["configurable_selections"],
                        notes=row["notes"],
                        is_gift=row["is_gift"],
                        gift_ref_unit_price=row["gift_ref_unit_price"],
                        price_settlement_status=row["price_settlement_status"],
                        provisional_unit_price=row["provisional_unit_price"],
                    )
                    for row in item_rows
                ]
            )
        return order

    async def _sync_update_order(
        self,
        *,
        tenant_id: int,
        existing: SalesOrder,
        payload: Dict[str, Any],
        user_id: int,
        operator_name: str,
        material_by_id: Dict[int, Material],
        customer_by_id: Dict[int, Customer],
        sync_at: datetime,
        sales_order_service: SalesOrderService,
    ) -> None:
        update_data = SalesOrderUpdate(**payload["update"])
        sales_order_service._validate_sales_order_non_negative(
            discount_amount=getattr(update_data, "discount_amount", Decimal("0"))
            or Decimal("0"),
            total_quantity=getattr(update_data, "total_quantity", None),
            total_amount=getattr(update_data, "total_amount", None),
            total_fee_amount=getattr(update_data, "total_fee_amount", None),
        )
        upd = update_data.model_dump(
            exclude_unset=True, exclude=_SALES_ORDER_PERSIST_EXCLUDE
        )
        upd.pop("status", None)
        upd.pop("review_status", None)
        upd["updated_by"] = user_id
        upd["updated_by_name"] = operator_name
        upd["external_sync_at"] = sync_at

        items = update_data.items or []
        if not items:
            raise ValidationError("订单须至少包含一条明细")

        customer_id = upd.get("customer_id", existing.customer_id)
        partner_settlement_method = None
        customer = customer_by_id.get(int(customer_id)) if customer_id else None
        if customer:
            partner_settlement_method = customer.settlement_method_code
            if not upd.get("salesman_id") and not existing.salesman_id and customer.salesman_id:
                upd["salesman_id"] = customer.salesman_id
                upd["salesman_name"] = customer.salesman_name

        item_rows, total_qty, total_amt = self._build_priced_item_rows(
            items,
            material_by_id=material_by_id,
            partner_settlement_method=partner_settlement_method,
            sales_order_service=sales_order_service,
            provided_total=update_data.total_amount
            if "total_amount" in update_data.model_fields_set
            else None,
            discount_amount=Decimal(
                str(
                    upd.get("discount_amount")
                    if "discount_amount" in upd
                    else getattr(existing, "discount_amount", 0)
                    or 0
                )
            ),
            price_type=upd.get("price_type") or getattr(existing, "price_type", None),
        )
        upd["total_quantity"] = total_qty
        upd["total_amount"] = total_amt

        async with in_transaction():
            if upd:
                await SalesOrder.filter(id=existing.id).update(**upd)
            await SalesOrderItem.filter(
                tenant_id=tenant_id, sales_order_id=existing.id
            ).delete()
            await SalesOrderItem.bulk_create(
                [
                    SalesOrderItem(
                        tenant_id=tenant_id,
                        sales_order_id=existing.id,
                        material_id=row["material_id"],
                        material_code=row["material_code"],
                        material_name=row["material_name"],
                        material_spec=row["material_spec"],
                        material_unit=row["material_unit"],
                        order_quantity=row["order_quantity"],
                        delivered_quantity=row["delivered_quantity"],
                        remaining_quantity=row["remaining_quantity"],
                        unit_price=row["unit_price"],
                        tax_rate=row["tax_rate"],
                        total_amount=row["total_amount"],
                        delivery_date=row["delivery_date"],
                        delivery_status=row["delivery_status"],
                        variant_attributes=row["variant_attributes"],
                        configurable_selections=row["configurable_selections"],
                        notes=row["notes"],
                        is_gift=row["is_gift"],
                        gift_ref_unit_price=row["gift_ref_unit_price"],
                        price_settlement_status=row["price_settlement_status"],
                        provisional_unit_price=row["provisional_unit_price"],
                    )
                    for row in item_rows
                ]
            )

    def _build_priced_item_rows(
        self,
        items: List[SalesOrderItemCreate],
        *,
        material_by_id: Dict[int, Material],
        partner_settlement_method: Optional[str],
        sales_order_service: SalesOrderService,
        provided_total: Optional[Decimal],
        discount_amount: Decimal,
        price_type: Optional[str] = None,
    ) -> Tuple[List[Dict[str, Any]], Decimal, Decimal]:
        material_map = {
            int(item.material_id): material_by_id[int(item.material_id)]
            for item in items
            if item.material_id and int(item.material_id) in material_by_id
        }
        item_rows: List[Dict[str, Any]] = []
        total_qty = Decimal("0")
        subtotal = Decimal("0")
        for item_data in items:
            row = SalesOrderService._process_sales_order_item_pricing(
                item_data,
                material_map,
                money_fn=sales_order_service._money,
                partner_settlement_method=partner_settlement_method,
                price_type=price_type,
            )
            total_qty += row["order_quantity"]
            subtotal += row["_item_amount"]
            item_rows.append(row)
        target_total = (
            Decimal(str(provided_total))
            if provided_total is not None
            else max(Decimal("0"), subtotal - discount_amount)
        )
        target_total = sales_order_service._money(target_total)
        allocated = sales_order_service._allocate_total_amount_with_proration(
            source_amounts=[row["_item_amount"] for row in item_rows],
            target_total=target_total,
        )
        for idx, row in enumerate(item_rows):
            row["total_amount"] = allocated[idx]
        total_amt = sum(allocated, Decimal("0"))
        return item_rows, total_qty, total_amt

    @staticmethod
    def _stringify(value: Any) -> str:
        if value is None:
            return ""
        return str(value).strip()

    @staticmethod
    def _optional_str(value: Any) -> Optional[str]:
        text = SalesOrderSyncService._stringify(value)
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
        text = SalesOrderSyncService._stringify(value)
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
