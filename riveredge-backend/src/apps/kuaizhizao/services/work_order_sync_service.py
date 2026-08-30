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

    WorkOrderSyncBindingOut,

    WorkOrderSyncBindingUpsert,

    WorkOrderSyncFromSourceOut,

    WorkOrderSyncFromSourceRequest,

)

from apps.kuaizhizao.services.work_order_service import WorkOrderService

from apps.master_data.services.master_data_sync_common import (

    map_sync_rows,

    mark_binding_failure,

    mark_binding_success,

    mark_external_sync_record,

    normalize_schedule_interval,

    normalize_sync_mode,

    resolve_incremental_since,

)

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





class WorkOrderSyncService:

    def serialize_binding(self, row: Optional[WorkOrderSyncBinding]) -> WorkOrderSyncBindingOut:

        if not row:

            return WorkOrderSyncBindingOut()

        mapping = row.field_mapping if isinstance(row.field_mapping, dict) else {}

        return WorkOrderSyncBindingOut(

            source_type=row.source_type,

            api_uuid=row.api_uuid,

            dataset_uuid=row.dataset_uuid,

            field_mapping={str(k): str(v) for k, v in mapping.items()},

            match_key_field=row.match_key_field or "code",

            sync_mode=row.sync_mode or "manual_full",

            schedule_interval_minutes=int(row.schedule_interval_minutes or 15),

            last_success_at=row.last_success_at,

            last_attempt_at=row.last_attempt_at,

            last_error=row.last_error,

        )



    async def upsert_binding(

        self,

        tenant_id: int,

        body: WorkOrderSyncBindingUpsert,

    ) -> WorkOrderSyncBindingOut:

        source_type = (body.source_type or "").strip()

        api_uuid = (body.api_uuid or "").strip() or None

        dataset_uuid = (body.dataset_uuid or "").strip() or None



        if not source_type and not api_uuid and not dataset_uuid:

            await WorkOrderSyncBinding.filter(tenant_id=tenant_id).delete()

            return WorkOrderSyncBindingOut()



        if source_type not in ("api", "dataset"):

            raise ValidationError("来源类型须为 api 或 dataset")

        if source_type == "api" and not api_uuid:

            raise ValidationError("已选择数据接口时须指定接口")

        if source_type == "dataset" and not dataset_uuid:

            raise ValidationError("已选择数据集时须指定数据集")



        field_mapping = body.field_mapping if isinstance(body.field_mapping, dict) else {}

        if not field_mapping:

            raise ValidationError("请配置字段映射")



        match_key = (body.match_key_field or "code").strip() or "code"

        if match_key not in field_mapping.values():

            raise ValidationError(f"字段映射须包含匹配键 {match_key}")



        sync_mode = normalize_sync_mode(body.sync_mode)

        interval = normalize_schedule_interval(body.schedule_interval_minutes)



        existing = await WorkOrderSyncBinding.filter(tenant_id=tenant_id).first()

        preserve = {

            "last_success_at": existing.last_success_at if existing else None,

            "last_attempt_at": existing.last_attempt_at if existing else None,

            "last_error": existing.last_error if existing else None,

        }

        await WorkOrderSyncBinding.filter(tenant_id=tenant_id).delete()

        row = await WorkOrderSyncBinding.create(

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



    async def get_binding(self, tenant_id: int) -> WorkOrderSyncBindingOut:

        row = await WorkOrderSyncBinding.filter(tenant_id=tenant_id).first()

        return self.serialize_binding(row)



    async def sync_from_source(

        self,

        tenant_id: int,

        user_id: int,

        request: Optional[WorkOrderSyncFromSourceRequest] = None,

    ) -> WorkOrderSyncFromSourceOut:

        req = request or WorkOrderSyncFromSourceRequest()

        binding = await WorkOrderSyncBinding.filter(tenant_id=tenant_id).first()



        source_type = (req.source_type or (binding.source_type if binding else "") or "").strip()

        api_uuid = (req.api_uuid or (binding.api_uuid if binding else "") or "").strip() or None

        dataset_uuid = (

            (req.dataset_uuid or (binding.dataset_uuid if binding else "") or "").strip() or None

        )

        field_mapping = req.field_mapping if isinstance(req.field_mapping, dict) else None

        if not field_mapping and binding and isinstance(binding.field_mapping, dict):

            field_mapping = binding.field_mapping

        match_key = (

            (binding.match_key_field if binding else None) or "code"

        ).strip() or "code"



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

                WorkOrderSyncBindingUpsert(

                    source_type=source_type,

                    api_uuid=api_uuid,

                    dataset_uuid=dataset_uuid,

                    field_mapping=field_mapping,

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



            rows = map_sync_rows(raw_rows, field_mapping)



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

            if prerequisite_errors:

                result.errors = (prerequisite_errors + list(result.errors))[:20]

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


