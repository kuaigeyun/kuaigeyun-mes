"""报工同步服务。"""

from __future__ import annotations

from typing import Optional

from apps.kuaizhizao.models.reporting_record import ReportingRecord
from apps.kuaizhizao.models.reporting_sync_binding import ReportingSyncBinding
from apps.kuaizhizao.models.work_order import WorkOrder
from apps.kuaizhizao.models.work_order_operation import WorkOrderOperation
from apps.kuaizhizao.schemas.reporting_record import ReportingRecordCreate
from apps.kuaizhizao.schemas.reporting_sync import (
    ReportingSyncBindingOut,
    ReportingSyncBindingUpsert,
    ReportingSyncFromSourceOut,
    ReportingSyncFromSourceRequest,
    ReportingSyncHistoryItem,
    ReportingSyncHistoryListResponse,
)
from apps.kuaizhizao.services.reporting_service import ReportingService
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
    resolve_incremental_since,
    resolve_sync_sources,
    sources_from_upsert_body,
    upsert_sync_binding,
)
from core.services.data.sync_binding_sources import fetch_mapped_rows_from_sources
from core.utils.timezone_utils import resolve_business_datetime
from infra.exceptions.exceptions import ValidationError


def normalize_reporting_binding_sync_direction(value: Optional[str]) -> str:
    """报工 binding 仅保留拉取方向；bidirectional/push 归一为 pull（外推走 DocumentPush）。"""
    direction = normalize_sync_direction(value)
    if direction in ("bidirectional", "push"):
        return "pull"
    return direction


class ReportingSyncService:
    MATCH_KEY = "id"

    def serialize_binding(self, row: Optional[ReportingSyncBinding]) -> ReportingSyncBindingOut:
        if not row:
            return ReportingSyncBindingOut()
        mapping = row.field_mapping if isinstance(row.field_mapping, dict) else {}
        return ReportingSyncBindingOut(
            source_type=row.source_type,
            api_uuid=row.api_uuid,
            dataset_uuid=row.dataset_uuid,
            field_mapping={str(k): str(v) for k, v in mapping.items()},
            match_key_field=row.match_key_field or self.MATCH_KEY,
            sync_mode=row.sync_mode or "manual_full",
            sync_direction=normalize_reporting_binding_sync_direction(
                getattr(row, "sync_direction", None) or "pull"
            ),
            schedule_interval_minutes=int(row.schedule_interval_minutes or 15),
            last_success_at=row.last_success_at,
            last_attempt_at=row.last_attempt_at,
            last_error=row.last_error,
        )

    async def get_binding(self, tenant_id: int) -> ReportingSyncBindingOut:
        row = await ReportingSyncBinding.filter(tenant_id=tenant_id).first()
        return self.serialize_binding(row)

    async def upsert_binding(
        self,
        tenant_id: int,
        body: ReportingSyncBindingUpsert,
    ) -> ReportingSyncBindingOut:
        sync_direction = normalize_reporting_binding_sync_direction(body.sync_direction or "pull")
        sync_mode = normalize_sync_mode(body.sync_mode)
        interval = normalize_schedule_interval(body.schedule_interval_minutes)
        if body.sources is not None and len(body.sources) == 0:
            await ReportingSyncBinding.filter(tenant_id=tenant_id).delete()
            return ReportingSyncBindingOut()
        sources = sources_from_upsert_body(body)
        match_key = (body.match_key_field or self.MATCH_KEY).strip() or self.MATCH_KEY
        row = await upsert_sync_binding(
            ReportingSyncBinding,
            tenant_id,
            sources=sources,
            match_key_field=match_key,
            sync_mode=sync_mode,
            sync_direction=sync_direction,
            schedule_interval_minutes=interval,
        )
        return self.serialize_binding(row)

    async def list_sync_history(
        self,
        tenant_id: int,
        skip: int = 0,
        limit: int = 100,
    ) -> ReportingSyncHistoryListResponse:
        """只读：按创建时间倒序返回本组织报工同步运行历史。"""
        from tortoise import Tortoise

        # 该表是通用同步日志，只读历史不依赖 ORM 模型注册，避免开发热加载或
        # 增量发布后新模型未绑定连接时把弹窗打成 500。
        conn = Tortoise.get_connection("default")
        total_rows = await conn.execute_query_dict(
            """
            SELECT COUNT(*) AS total
            FROM core_sync_run_logs
            WHERE tenant_id = $1 AND entity_type = $2
            """,
            [tenant_id, "reporting"],
        )
        rows = await conn.execute_query_dict(
            """
            SELECT
                id,
                entity_type,
                mode,
                status,
                created,
                updated,
                skipped,
                failed,
                fetched,
                truncated,
                duration_ms,
                error_summary,
                started_at,
                finished_at,
                created_at
            FROM core_sync_run_logs
            WHERE tenant_id = $1 AND entity_type = $2
            ORDER BY created_at DESC
            OFFSET $3
            LIMIT $4
            """,
            [tenant_id, "reporting", skip, limit],
        )
        total = int(total_rows[0]["total"]) if total_rows else 0
        return ReportingSyncHistoryListResponse(
            data=[
                ReportingSyncHistoryItem(
                    id=row["id"],
                    entity_type=row["entity_type"],
                    mode=row["mode"],
                    status=row["status"],
                    created=row["created"],
                    updated=row["updated"],
                    skipped=row["skipped"],
                    failed=row["failed"],
                    fetched=row["fetched"],
                    truncated=row["truncated"],
                    duration_ms=row["duration_ms"],
                    error_summary=row["error_summary"],
                    started_at=row["started_at"],
                    finished_at=row["finished_at"],
                    created_at=row["created_at"],
                )
                for row in rows
            ],
            total=total,
            success=True,
        )

    async def sync_from_source(
        self,
        tenant_id: int,
        user_id: int,
        request: Optional[ReportingSyncFromSourceRequest] = None,
    ) -> ReportingSyncFromSourceOut:
        req = request or ReportingSyncFromSourceRequest()
        sources, match_key, binding = await resolve_sync_sources(
            ReportingSyncBinding,
            tenant_id,
            req,
            default_match_key=self.MATCH_KEY,
        )

        binding = binding or await ReportingSyncBinding.filter(tenant_id=tenant_id).first()
        sync_mode = normalize_sync_mode(req.sync_mode or (binding.sync_mode if binding else None))
        sync_direction = normalize_reporting_binding_sync_direction(
            req.sync_direction or (binding.sync_direction if binding else None) or "pull"
        )
        interval = normalize_schedule_interval(
            req.schedule_interval_minutes
            if req.schedule_interval_minutes is not None
            else (binding.schedule_interval_minutes if binding else None)
        )

        if req.save_binding:
            await self.upsert_binding(
                tenant_id,
                ReportingSyncBindingUpsert(
                    sources=req.sources,
                    match_key_field=match_key,
                    sync_mode=sync_mode,
                    sync_direction=sync_direction,
                    schedule_interval_minutes=interval,
                ),
            )
            binding = await ReportingSyncBinding.filter(tenant_id=tenant_id).first()

        since = resolve_incremental_since(
            binding,
            sync_mode=sync_mode,
            request_incremental=req.incremental,
        )
        started_at = resolve_business_datetime()
        try:
            rows, source_errors, fetched = await fetch_mapped_rows_from_sources(
                tenant_id,
                sources,
                since=since,
                active_only=req.active_only,
            )
            result = await self._create_reporting_records(tenant_id, user_id, rows)
            if source_errors:
                result.errors = (source_errors + list(result.errors))[:20]
            attach_sync_fetch_meta(result, fetched=fetched, since=since, truncated=False)
            if binding:
                if result.failed and not result.created:
                    await mark_binding_failure(binding, "; ".join(result.errors) or "报工同步失败")
                else:
                    await mark_binding_success(binding)
            await record_sync_run_log(
                tenant_id=tenant_id,
                binding=binding,
                entity_type="reporting",
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
                entity_type="reporting",
                result=None,
                started_at=started_at,
                error=str(exc),
            )
            raise

    async def _create_reporting_records(
        self,
        tenant_id: int,
        user_id: int,
        rows: list[dict],
    ) -> ReportingSyncFromSourceOut:
        created = 0
        skipped = 0
        failed = 0
        errors: list[str] = []
        service = ReportingService()

        for row in rows:
            work_order_code = cell_str(row.get("work_order_code"))
            operation_code = cell_str(row.get("operation_code"))
            operation_name = cell_str(row.get("operation_name"))
            if not work_order_code:
                skipped += 1
                errors.append("存在缺少工单编码的报工行，已跳过")
                continue
            if len(work_order_code) > 50 or work_order_code.startswith("{") or "ResponseStatus" in work_order_code:
                failed += 1
                errors.append(
                    "报工行工单编码无效（疑似源端返回了金蝶错误报文，请检查同步接口 FieldKeys 是否含不存在的字段如 FStockOrgId）"
                )
                continue
            try:
                work_order = await WorkOrder.get_or_none(
                    tenant_id=tenant_id,
                    code=work_order_code,
                    deleted_at__isnull=True,
                )
                if not work_order:
                    raise ValidationError(f"工单 {work_order_code} 不存在")
                op_query = WorkOrderOperation.filter(
                    tenant_id=tenant_id,
                    work_order_id=work_order.id,
                    deleted_at__isnull=True,
                )
                if operation_code:
                    work_order_operation = await op_query.filter(operation_code=operation_code).order_by("-id").first()
                elif operation_name:
                    work_order_operation = await op_query.filter(operation_name=operation_name).order_by("-id").first()
                else:
                    work_order_operation = None
                if not work_order_operation:
                    # 金蝶生产汇报单（PRD_MORPT）常无工序字段：回退到工单末道工序，便于拉取入库
                    work_order_operation = await WorkOrderOperation.filter(
                        tenant_id=tenant_id,
                        work_order_id=work_order.id,
                        deleted_at__isnull=True,
                    ).order_by("-sequence", "-id").first()
                if not work_order_operation:
                    raise ValidationError(f"工单 {work_order_code} 未找到匹配工序")

                qualified = cell_optional_decimal(row.get("qualified_quantity")) or 0
                unqualified = cell_optional_decimal(row.get("unqualified_quantity")) or 0
                reported = cell_optional_decimal(row.get("reported_quantity")) or qualified + unqualified
                reported_at = row.get("reported_at") or resolve_business_datetime()
                payload = ReportingRecordCreate(
                    work_order_id=int(work_order.id),
                    work_order_code=work_order.code or work_order_code,
                    work_order_name=work_order.name or work_order_code,
                    operation_id=int(work_order_operation.operation_id),
                    operation_code=work_order_operation.operation_code or operation_code,
                    operation_name=work_order_operation.operation_name or operation_name,
                    worker_id=user_id,
                    worker_name=cell_str(row.get("worker_name")) or "同步用户",
                    reported_quantity=reported,
                    qualified_quantity=qualified,
                    unqualified_quantity=unqualified,
                    work_hours=cell_optional_decimal(row.get("work_hours")) or 0,
                    work_start_time=row.get("work_start_time") or None,
                    work_end_time=row.get("work_end_time") or None,
                    status=cell_str(row.get("status")) or "pending",
                    reported_at=reported_at,
                    remarks=cell_str(row.get("remarks")) or None,
                )
                await service.create_reporting_record(
                    tenant_id=tenant_id,
                    reporting_data=payload,
                    reported_by=user_id,
                    entry_mode="sync",
                )
                created += 1
            except Exception as exc:
                failed += 1
                errors.append(f"报工 {work_order_code or '-'}：{exc}")

        return ReportingSyncFromSourceOut(
            created=created,
            skipped=skipped,
            failed=failed,
            errors=errors[:20],
        )
