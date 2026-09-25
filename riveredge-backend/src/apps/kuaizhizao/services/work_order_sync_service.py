"""生产工单从数据接口/数据集同步服务（表头行，无明细分组）。"""
from __future__ import annotations
from datetime import date, datetime, time
from decimal import Decimal, InvalidOperation
from typing import Any, Dict, List, Optional
from infra.exceptions.exceptions import ValidationError
from apps.kuaizhizao.models.work_order import WorkOrder
from apps.kuaizhizao.models.work_order_sync_binding import WorkOrderSyncBinding
from apps.kuaizhizao.schemas.work_order import WorkOrderCreate, WorkOrderUpdate
from apps.kuaizhizao.schemas.work_order_sync import (
    WorkOrderPushBindingOut,
    WorkOrderPushBindingUpsert,
    WorkOrderPushCandidateListOut,
    WorkOrderPushCandidateOut,
    WorkOrderSyncBindingOut,
    WorkOrderSyncBindingUpsert,
    WorkOrderSyncFromSourceOut,
    WorkOrderSyncFromSourceRequest,
)
from apps.kuaizhizao.services.kingdee_production_order_push_service import (
    TARGET_TYPE as KINGDEE_MO_TARGET_TYPE,
    WORK_ORDER_PUSH_STATUSES,
)
from apps.kuaizhizao.services.work_order_service import WorkOrderService
from apps.kuaizhizao.models.document_relation import DocumentRelation
from apps.master_data.services.master_data_sync_common import (
    fetch_sync_rows,
    map_sync_rows,
    mark_binding_failure,
    mark_binding_success,
    mark_external_sync_record,
    normalize_schedule_interval,
    normalize_sync_direction,
    normalize_sync_mode,
    record_sync_run_log,
    resolve_incremental_since,
    resolve_sync_sources,
    serialize_binding_row,
    sources_from_upsert_body,
    upsert_sync_binding,
    apply_mapped_custom_field_values,
    load_custom_fields_by_code,
)
from core.services.data.sync_binding_sources import fetch_mapped_rows_from_sources
WORK_ORDER_CUSTOM_FIELD_TABLE = "apps_kuaizhizao_work_orders"
from apps.master_data.services.sync_association_service import (
    find_material_by_code,
    map_kingdee_mo_status,
    resolve_sales_order_by_code,
    run_work_order_prerequisite_syncs,
)
from core.services.data.sync_from_source_fetch import (
    fetch_rows_from_api,
    fetch_rows_from_dataset,
)
from core.utils.timezone_utils import resolve_business_datetime


def normalize_work_order_push_sync_mode(value: Optional[str]) -> str:
    mode = str(value or "manual_full").strip() or "manual_full"
    if mode not in ("manual_full", "scheduled_full"):
        return "manual_full"
    return mode


def normalize_work_order_binding_sync_direction(value: Optional[str]) -> str:
    """工单 binding 仅保留拉取方向；外推走 DocumentPush。"""
    normalize_sync_direction(value)
    return "pull"


class WorkOrderSyncService:
    def serialize_binding(self, row: Optional[WorkOrderSyncBinding]) -> WorkOrderSyncBindingOut:
        if not row:
            return WorkOrderSyncBindingOut()
        data = serialize_binding_row(row, default_match_key="code")
        return WorkOrderSyncBindingOut(**data)
    async def upsert_binding(
        self,
        tenant_id: int,
        body: WorkOrderSyncBindingUpsert,
    ) -> WorkOrderSyncBindingOut:
        if body.sources is not None and len(body.sources) == 0:
            await WorkOrderSyncBinding.filter(tenant_id=tenant_id).delete()
            return WorkOrderSyncBindingOut()
        sources = sources_from_upsert_body(body)
        match_key = (body.match_key_field or "code").strip() or "code"
        sync_mode = normalize_sync_mode(body.sync_mode)
        interval = normalize_schedule_interval(body.schedule_interval_minutes)
        row = await upsert_sync_binding(
            WorkOrderSyncBinding,
            tenant_id,
            sources=sources,
            match_key_field=match_key,
            sync_mode=sync_mode,
            schedule_interval_minutes=interval,
        )
        return self.serialize_binding(row)

    async def get_binding(self, tenant_id: int) -> WorkOrderSyncBindingOut:
        row = await WorkOrderSyncBinding.filter(tenant_id=tenant_id).first()
        return self.serialize_binding(row)

    def serialize_push_binding(self, row: Optional[WorkOrderSyncBinding]) -> "WorkOrderPushBindingOut":
        from apps.kuaizhizao.schemas.work_order_sync import WorkOrderPushBindingOut
        from core.schemas.sync_binding_contract import DocumentPushTargetItem
        from core.services.data.sync_binding_sources import (
            push_targets_from_row,
            trigger_actions_from_row,
        )

        if not row:
            return WorkOrderPushBindingOut()
        targets_raw = push_targets_from_row(row)
        targets = [DocumentPushTargetItem.model_validate(t) for t in targets_raw]
        first = targets[0] if targets else None
        return WorkOrderPushBindingOut(
            targets=targets,
            trigger_actions=trigger_actions_from_row(row),
            connection_code=first.connection_code if first else getattr(row, "push_connection_code", None),
            save_api_uuid=first.save_api_uuid if first else getattr(row, "push_save_api_uuid", None),
            sync_mode=normalize_work_order_push_sync_mode(
                getattr(row, "push_sync_mode", None)
            ),
            schedule_interval_minutes=int(
                getattr(row, "push_schedule_interval_minutes", None) or 15
            ),
            last_success_at=getattr(row, "push_last_success_at", None),
            last_attempt_at=getattr(row, "push_last_attempt_at", None),
            last_error=getattr(row, "push_last_error", None),
        )

    async def get_push_binding(self, tenant_id: int):
        row = await WorkOrderSyncBinding.filter(tenant_id=tenant_id).first()
        return self.serialize_push_binding(row)

    async def upsert_push_binding(self, tenant_id: int, body):
        from apps.kuaizhizao.schemas.work_order_sync import WorkOrderPushBindingUpsert
        from core.services.data.sync_binding_sources import normalize_push_targets_json

        if not isinstance(body, WorkOrderPushBindingUpsert):
            body = WorkOrderPushBindingUpsert.model_validate(body)
        row = await WorkOrderSyncBinding.filter(tenant_id=tenant_id).first()
        if not row:
            row = await WorkOrderSyncBinding.create(tenant_id=tenant_id)
        sync_mode = normalize_work_order_push_sync_mode(body.sync_mode)
        interval = normalize_schedule_interval(body.schedule_interval_minutes)
        if not body.targets:
            raise ValidationError("请配置外推目标")
        targets = normalize_push_targets_json(
            [t.model_dump(mode="json") for t in body.targets],
        )
        triggers = [str(a).strip().lower() for a in (body.trigger_actions or []) if str(a).strip()]
        first = targets[0] if targets else {}
        await WorkOrderSyncBinding.filter(id=row.id).update(
            push_targets=targets or None,
            trigger_actions=triggers or None,
            push_connection_code=str(first.get("connection_code") or "").strip() or None,
            push_save_api_uuid=str(first.get("save_api_uuid") or "").strip() or None,
            push_sync_mode=sync_mode,
            push_schedule_interval_minutes=interval,
        )
        fresh = await WorkOrderSyncBinding.get(id=row.id)
        return self.serialize_push_binding(fresh)

    async def list_push_candidates(
        self,
        tenant_id: int,
        *,
        keyword: Optional[str] = None,
        skip: int = 0,
        limit: int = 20,
        prefer_ids: Optional[List[int]] = None,
    ):
        from apps.kuaizhizao.models.document_relation import DocumentRelation
        from apps.kuaizhizao.schemas.work_order_sync import (
            WorkOrderPushCandidateListOut,
            WorkOrderPushCandidateOut,
        )
        from apps.kuaizhizao.services.kingdee_production_order_push_service import (
            TARGET_TYPE as KINGDEE_MO_TARGET_TYPE,
            WORK_ORDER_PUSH_STATUSES,
        )

        skip = max(0, int(skip or 0))
        limit = max(1, min(int(limit or 20), 200))
        prefer = [int(item) for item in (prefer_ids or []) if item is not None]

        base = WorkOrder.filter(
            tenant_id=tenant_id,
            deleted_at__isnull=True,
            external_sync_at__isnull=True,
            status__in=list(WORK_ORDER_PUSH_STATUSES),
        )
        kw = str(keyword or "").strip()
        if kw:
            base = base.filter(code__icontains=kw)

        all_ids = await base.order_by("id").values_list("id", flat=True)
        pushed_ids = set(
            await DocumentRelation.filter(
                tenant_id=tenant_id,
                source_type="work_order",
                source_id__in=[int(item) for item in all_ids],
                target_type=KINGDEE_MO_TARGET_TYPE,
            ).values_list("source_id", flat=True)
        )
        eligible = [int(item) for item in all_ids if int(item) not in pushed_ids]
        if prefer:
            eligible_set = set(eligible)
            head = [item for item in prefer if item in eligible_set]
            head_set = set(head)
            tail = [item for item in eligible if item not in head_set]
            eligible = head + tail

        total = len(eligible)
        page_ids = eligible[skip : skip + limit]
        if not page_ids:
            return WorkOrderPushCandidateListOut(items=[], total=total)

        rows = await WorkOrder.filter(id__in=page_ids).all()
        by_id = {int(row.id): row for row in rows}
        items: list[WorkOrderPushCandidateOut] = []
        for wid in page_ids:
            row = by_id.get(wid)
            if not row:
                continue
            qty = row.quantity
            items.append(
                WorkOrderPushCandidateOut(
                    id=int(row.id),
                    code=row.code,
                    name=row.name,
                    product_code=row.product_code,
                    product_name=getattr(row, "product_name", None),
                    quantity=float(qty) if qty is not None else None,
                    status=row.status,
                    planned_start_date=row.planned_start_date,
                )
            )
        return WorkOrderPushCandidateListOut(items=items, total=total)

    async def sync_from_source(
        self,
        tenant_id: int,
        user_id: int,
        request: Optional[WorkOrderSyncFromSourceRequest] = None,
    ) -> WorkOrderSyncFromSourceOut:
        req = request or WorkOrderSyncFromSourceRequest()
        sources, match_key, binding = await resolve_sync_sources(
            WorkOrderSyncBinding,
            tenant_id,
            req,
            default_match_key="code",
        )
        binding = binding or await WorkOrderSyncBinding.filter(tenant_id=tenant_id).first()
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
                WorkOrderSyncBindingUpsert(
                    sources=req.sources,
                    match_key_field=match_key,
                    sync_mode=sync_mode,
                    schedule_interval_minutes=interval,
                ),
            )
            binding = await WorkOrderSyncBinding.filter(tenant_id=tenant_id).first()
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
            from infra.models.user import User
            current_user = await User.get_or_none(id=user_id)
            if not current_user:
                raise ValidationError("同步用户不存在")
            prerequisite_errors: List[str] = []
            if not req.skip_prerequisite_syncs:
                prerequisite_errors = await run_work_order_prerequisite_syncs(
                    tenant_id, current_user
                )
            result = await self._upsert_work_orders(tenant_id, user_id, rows, match_key)
            if prerequisite_errors or source_errors:
                result.errors = (prerequisite_errors + source_errors + list(result.errors))[:20]
            if binding:
                if result.failed and not (result.created or result.updated):
                    await mark_binding_failure(
                        binding, "; ".join(result.errors) or "生产工单同步失败"
                    )
                else:
                    await mark_binding_success(binding)
            return result
        except Exception as exc:
            if binding:
                await mark_binding_failure(binding, str(exc))
            raise
    async def _upsert_work_orders(
        self,
        tenant_id: int,
        user_id: int,
        rows: List[Dict[str, Any]],
        match_key: str,
    ) -> WorkOrderSyncFromSourceOut:
        work_order_service = WorkOrderService()
        created = 0
        updated = 0
        skipped = 0
        failed = 0
        errors: List[str] = []
        custom_fields_by_code = await load_custom_fields_by_code(
            tenant_id, WORK_ORDER_CUSTOM_FIELD_TABLE
        )
        for header in rows:
            wo_key = self._stringify(header.get(match_key))
            if not wo_key:
                skipped += 1
                errors.append("存在缺少工单号的行，已跳过")
                continue
            try:
                payload = await self._build_work_order_payload(tenant_id, header)
                existing = await WorkOrder.filter(
                    tenant_id=tenant_id,
                    code=wo_key,
                    deleted_at__isnull=True,
                ).first()
                if existing:
                    if existing.status != "draft":
                        skipped += 1
                        errors.append(f"工单 {wo_key} 非草稿，已跳过")
                        continue
                    update_data = WorkOrderUpdate(**payload["update"])
                    await work_order_service.update_work_order(
                        tenant_id=tenant_id,
                        work_order_id=existing.id,
                        work_order_data=update_data,
                        updated_by=user_id,
                    )
                    await mark_external_sync_record(existing)
                    if custom_fields_by_code:
                        await apply_mapped_custom_field_values(
                            tenant_id=tenant_id,
                            record_table=WORK_ORDER_CUSTOM_FIELD_TABLE,
                            record_id=int(existing.id),
                            mapped_row=header,
                            fields_by_code=custom_fields_by_code,
                        )
                    updated += 1
                else:
                    create_data = WorkOrderCreate(**payload["create"])
                    await work_order_service.create_work_order(
                        tenant_id=tenant_id,
                        work_order_data=create_data,
                        created_by=user_id,
                        allow_draft=True,
                    )
                    created_wo = await WorkOrder.filter(
                        tenant_id=tenant_id,
                        code=wo_key,
                        deleted_at__isnull=True,
                    ).first()
                    if created_wo:
                        if custom_fields_by_code:
                            await apply_mapped_custom_field_values(
                                tenant_id=tenant_id,
                                record_table=WORK_ORDER_CUSTOM_FIELD_TABLE,
                                record_id=int(created_wo.id),
                                mapped_row=header,
                                fields_by_code=custom_fields_by_code,
                            )
                        await mark_external_sync_record(created_wo)
                    created += 1
            except Exception as exc:
                failed += 1
                errors.append(f"工单 {wo_key or '-'}：{exc}")
        return WorkOrderSyncFromSourceOut(
            created=created,
            updated=updated,
            skipped=skipped,
            failed=failed,
            errors=errors[:20],
        )
    async def _build_work_order_payload(
        self,
        tenant_id: int,
        header: Dict[str, Any],
    ) -> Dict[str, Any]:
        product_code = self._stringify(header.get("product_code"))
        if not product_code:
            raise ValidationError("工单须映射 product_code")
        material = await find_material_by_code(tenant_id, product_code)
        if not material:
            raise ValidationError(
                f"物料编码 {product_code} 不存在，请先在物料管理配置并完成物料同步"
            )
        qty = self._optional_decimal(header.get("quantity"))
        if qty is None or qty <= 0:
            raise ValidationError(f"工单 {product_code} 数量无效")
        status = map_kingdee_mo_status(
            header.get("document_status"),
            header.get("status"),
            header.get("close_status"),
        )
        sales_order_id: Optional[int] = None
        sales_order_code: Optional[str] = None
        sales_order_name: Optional[str] = None
        so_code = self._optional_str(header.get("sales_order_code"))
        if so_code:
            sales_order_id, sales_order_code, sales_order_name = await resolve_sales_order_by_code(
                tenant_id, so_code
            )
            production_mode = "MTO"
        else:
            production_mode = "MTS"
        planned_start = self._parse_datetime(
            header.get("planned_start_date"),
            "planned_start_date",
            required=False,
        )
        planned_end = self._parse_datetime(
            header.get("planned_end_date"),
            "planned_end_date",
            required=False,
        )
        header_data = {
            "code": self._stringify(header.get("code")) or None,
            "name": self._optional_str(header.get("name")),
            "product_id": material.id,
            "product_code": material.code,
            "product_name": material.name,
            "quantity": qty,
            "production_mode": production_mode,
            "sales_order_id": sales_order_id,
            "sales_order_code": sales_order_code,
            "sales_order_name": sales_order_name,
            "status": status,
            "planned_start_date": planned_start,
            "planned_end_date": planned_end,
            "remarks": self._optional_str(header.get("remarks")),
        }
        create_payload = dict(header_data)
        update_payload = {
            key: value
            for key, value in header_data.items()
            if key not in ("code",)
        }
        return {"create": create_payload, "update": update_payload}
    @staticmethod
    def _stringify(value: Any) -> str:
        if value is None:
            return ""
        return str(value).strip()
    @staticmethod
    def _optional_str(value: Any) -> Optional[str]:
        text = WorkOrderSyncService._stringify(value)
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
    def _parse_datetime(value: Any, field_name: str, *, required: bool) -> Optional[datetime]:
        if value is None or value == "":
            if required:
                raise ValidationError(f"{field_name} 不能为空")
            return None
        if isinstance(value, datetime):
            return value
        if isinstance(value, date):
            return resolve_business_datetime(datetime.combine(value, time.min))
        text = WorkOrderSyncService._stringify(value)
        for fmt in ("%Y-%m-%d", "%Y/%m/%d", "%Y%m%d"):
            try:
                parsed = datetime.strptime(text[:10], fmt)
                return resolve_business_datetime(parsed)
            except ValueError:
                continue
        if "T" in text:
            try:
                return resolve_business_datetime(
                    datetime.fromisoformat(text.replace("Z", "+00:00"))
                )
            except ValueError:
                pass
        raise ValidationError(f"{field_name} 格式无效：{text}")
