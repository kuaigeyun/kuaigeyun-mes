"""Push approved reporting records to Kingdee Galaxy production report bills."""

from __future__ import annotations

import copy
from datetime import date, datetime, timedelta
from decimal import Decimal
from typing import Any, Dict, Optional

from loguru import logger

from apps.kuaizhizao.models.document_relation import DocumentRelation
from apps.kuaizhizao.models.reporting_record import ReportingRecord
from apps.kuaizhizao.models.work_order import WorkOrder
from apps.kuaizhizao.models.work_order_operation import WorkOrderOperation
from core.services.integration.document_push_codes import (
    DEFAULT_UNIT_NUMBER,
    load_save_api_unit_code_map,
    resolve_unit_for_push,
)
from core.services.integration.document_push_mapping import apply_field_map, set_path
from core.services.integration.document_push_pipeline import (
    DocumentPushPipeline,
    DocumentPushPrepared,
    DocumentPushRequest,
)
from core.services.integration.kingdee_galaxy_api_presets import (
    PRD_MORPT_FORM_ID,
)
from core.utils.timezone_utils import resolve_business_datetime, to_api_isoformat
from infra.exceptions.exceptions import BusinessLogicError
from infra.services.business_config_service import BusinessConfigService


DEFAULT_FORM_ID = PRD_MORPT_FORM_ID
TARGET_TYPE = "kingdee_production_report"
TARGET_PROFILE = "kingdee_prd_morpt"
SOURCE_TYPE = "reporting_record"

# 推送重试策略（P0-3，PM 仲裁）：重试上限 5 次 / 退避 1m·5m·30m·2h·8h / 超限 dead + 站内告警
PUSH_MAX_ATTEMPTS = 5
PUSH_RETRY_BACKOFF_MINUTES: tuple[int, ...] = (1, 5, 30, 120, 480)


def _to_float(value: Any) -> float:
    if value is None:
        return 0.0
    if isinstance(value, Decimal):
        return float(value)
    try:
        return float(value)
    except (TypeError, ValueError):
        return 0.0


def _date_string(value: Any) -> str:
    if isinstance(value, datetime):
        return value.date().isoformat()
    if isinstance(value, date):
        return value.isoformat()
    return date.today().isoformat()


def _compact_text(*parts: Any) -> str:
    return " ".join(str(part).strip() for part in parts if str(part or "").strip())


def _resolve_local_value(
    key: str,
    *,
    record: ReportingRecord,
    work_order: Optional[WorkOrder],
    operation: Optional[WorkOrderOperation],
    cfg: Dict[str, Any],
) -> Any:
    if key == "bill_date":
        return _date_string(record.reported_at or record.approved_at or record.created_at)
    if key == "work_order_code":
        # 优先使用工单推送金蝶后的生产订单号（DocumentRelation.target_code）
        return cfg.get("mo_bill_no") or record.work_order_code
    if key == "operation_code":
        return record.operation_code
    if key == "operation_name":
        return record.operation_name
    if key == "product_code":
        return getattr(work_order, "product_code", None) or record.work_order_code
    if key == "product_name":
        return getattr(work_order, "product_name", None)
    if key == "reported_quantity":
        # 金蝶「完成数量」FFinishQty：优先报工数量，否则合格+不合格
        reported = _to_float(record.reported_quantity)
        if reported > 0:
            return reported
        return _to_float(record.qualified_quantity) + _to_float(record.unqualified_quantity)
    if key == "qualified_quantity":
        return _to_float(record.qualified_quantity)
    if key == "unqualified_quantity":
        return _to_float(record.unqualified_quantity)
    if key == "work_hours":
        return _to_float(record.work_hours)
    if key == "worker_name":
        return record.worker_name
    if key == "team_name":
        return record.team_name
    if key == "workshop_name":
        return getattr(operation, "workshop_name", None) or getattr(work_order, "workshop_name", None)
    if key == "workshop_number":
        return (
            cfg.get("workshop_number")
            or cfg.get("workship_number")
            or cfg.get("work_center_code")
        )
    if key == "work_center_name":
        return getattr(operation, "work_center_name", None) or getattr(work_order, "work_center_name", None)
    if key == "work_center_code":
        return cfg.get("work_center_code") or getattr(operation, "work_center_id", None)
    if key == "org_number":
        return cfg.get("org_number") or cfg.get("prd_org_number") or cfg.get("stock_org_number")
    if key == "prd_org_number":
        return cfg.get("prd_org_number") or cfg.get("org_number")
    if key == "stock_org_number":
        return cfg.get("stock_org_number") or cfg.get("org_number")
    if key == "unit_number":
        # 调用方应先经 resolve_unit_for_push 写入；此处仅透传已解析编码
        raw = cfg.get("unit_number") or cfg.get("base_unit_number")
        return str(raw or DEFAULT_UNIT_NUMBER).strip() or DEFAULT_UNIT_NUMBER
    if key == "bill_type_number":
        # 单据类型（BOS_BillType / PRD_MORPT）：SCHBD01_SYS=入库汇报，SCHBD02_SYS=生产汇报
        return cfg.get("bill_type_number") or "SCHBD02_SYS"
    if key == "report_type_number":
        # 生产汇报类型（PRD_REPORTTYPE），与单据类型不是同一套编码！
        # 本账套常见：HBLX01_SYS=正常生产，HBLX02_SYS=欠料停线，HBLX03_SYS=设备故障，HBLX04_SYS=支援其它车间
        return cfg.get("report_type_number") or "HBLX01_SYS"
    if key == "time_unit_id":
        # 金蝶时间单位多为枚举（如 1=小时）；勿臆造 HOUR，未配置则不传
        return cfg.get("time_unit_id") or cfg.get("stand_hour_unit_id")
    if key == "stand_hour_unit_id":
        return cfg.get("stand_hour_unit_id") or cfg.get("time_unit_id")
    if key == "source_record_id":
        return int(record.id)
    if key == "remarks":
        return _compact_text("快格云报工", record.id, record.operation_name, record.worker_name, record.remarks)
    return getattr(record, key, None)


def build_kingdee_production_report_model(
    *,
    record: ReportingRecord,
    work_order: Optional[WorkOrder],
    operation: Optional[WorkOrderOperation],
    cfg: Optional[Dict[str, Any]] = None,
) -> Dict[str, Any]:
    """Build the Kingdee Save/Draft Model per PRD_MORPT WebAPI metadata.

    字段以金蝶「WebAPI 控制台 → 生产汇报单」说明为准：
    - 必填：FBillType / FPrdOrgId / FDate / FReportType / FTimeUnitId / FWorkshipId / FStandHourUnitId
    - 数量：FFinishQty（完成）/ FQuaQty（合格）/ FFailQty（不合格）；无 FRealQty、FStockOrgId、FProcessId
    """
    config = cfg or {}
    template = config.get("model_template")
    if isinstance(template, dict) and template:
        model = copy.deepcopy(template)
    else:
        model = {
            "FID": 0,
            "FDate": _date_string(record.reported_at or record.approved_at or record.created_at),
            "FEntity": [{"FEntryID": 0, "FIsNew": "true"}],
        }

    # 对齐金蝶官方示例 Model（大小写与路径保持一致）
    default_field_map = {
        "bill_date": "FDate",
        "bill_type_number": "FBillType.FNUMBER",
        "prd_org_number": "FPrdOrgId.FNumber",
        "workshop_number": "FWorkshipIdH.FNumber",
        "work_order_code": "FEntity.0.FMoBillNo",
        "product_code": "FEntity.0.FMaterialId.FNumber",
        "report_type_number": "FEntity.0.FReportType.FNumber",
        "reported_quantity": "FEntity.0.FFinishQty",
        "qualified_quantity": "FEntity.0.FQuaQty",
        "unqualified_quantity": "FEntity.0.FFailQty",
        "work_hours": "FEntity.0.FHrWorkTime",
        "unit_number": "FEntity.0.FUnitID.FNumber",
        "workshop_number_entity": "FEntity.0.FWorkshipId.FNumber",
        "time_unit_id": "FEntity.0.FTimeUnitId",
        "stand_hour_unit_id": "FEntity.0.FStandHourUnitId",
        "stock_org_number": "FEntity.0.FStockInOrgId.FNumber",
        "remarks": "FEntity.0.FDescriptionE",
    }
    field_map = dict(default_field_map)

    def _resolve(local_key: str) -> Any:
        resolve_key = "workshop_number" if str(local_key) == "workshop_number_entity" else str(local_key)
        return _resolve_local_value(
            resolve_key,
            record=record,
            work_order=work_order,
            operation=operation,
            cfg=config,
        )

    apply_field_map(model, field_map, _resolve)

    # 产品类型默认主产品；新分录标记（可被 fixed_values 覆盖）
    entity0 = model.get("FEntity")
    if isinstance(entity0, list) and entity0 and isinstance(entity0[0], dict):
        entity0[0].setdefault("FProductType", "1")
        entity0[0].setdefault("FIsNew", "true")

    fixed_values = config.get("fixed_values")
    if isinstance(fixed_values, dict):
        for target_path, value in fixed_values.items():
            set_path(model, str(target_path), value)

    return model


class KingdeeProductionReportPushService:
    """Tenant-configured Kingdee production report push."""

    async def push_after_reporting_approved(
        self,
        *,
        tenant_id: int,
        record_id: int,
        acting_user_id: int,
    ) -> Optional[Dict[str, Any]]:
        config = await self._get_push_config(tenant_id)
        if not bool(config.get("enabled", False)):
            return None

        record = await ReportingRecord.get_or_none(
            tenant_id=tenant_id,
            id=record_id,
            deleted_at__isnull=True,
        )
        if not record or record.status != "approved":
            return None

        if await DocumentRelation.filter(
            tenant_id=tenant_id,
            source_type="reporting_record",
            source_id=record_id,
            target_type=TARGET_TYPE,
        ).exists():
            await self._record_push_success(record=record)
            return {"success": True, "skipped": True, "message": "已推送过金蝶生产汇报单"}

        try:
            result = await self._push_now(
                tenant_id=tenant_id,
                record=record,
                acting_user_id=acting_user_id,
                config=config,
            )
            logger.info(
                "报工审核通过已推送金蝶生产汇报单 tenant_id={} reporting_record_id={} bill_no={}",
                tenant_id,
                record_id,
                result.get("bill_no"),
            )
            await self._record_push_success(record=record)
            return result
        except Exception as exc:
            logger.warning(
                "报工审核通过推送金蝶生产汇报单失败 tenant_id={} reporting_record_id={} err={}",
                tenant_id,
                record_id,
                exc,
            )
            await self._record_push_failure(tenant_id=tenant_id, record=record, error=str(exc))
            if bool(config.get("fail_on_error", False)):
                raise BusinessLogicError(f"推送金蝶生产汇报单失败：{exc}")
            return {"success": False, "message": str(exc)}

    async def _record_push_success(self, *, record: ReportingRecord) -> None:
        now = resolve_business_datetime()
        await ReportingRecord.filter(id=record.id).update(
            kingdee_push_status="success",
            kingdee_push_next_at=None,
            kingdee_push_last_error=None,
            kingdee_push_last_at=now,
        )

    async def _record_push_failure(
        self,
        *,
        tenant_id: int,
        record: ReportingRecord,
        error: str,
    ) -> None:
        """记录失败并调度重试（退避 1m·5m·30m·2h·8h）；超限置 dead + 站内告警。"""
        now = resolve_business_datetime()
        attempts = int(record.kingdee_push_attempts or 0) + 1
        error_snippet = (error or "")[:2000]
        if attempts > PUSH_MAX_ATTEMPTS:
            await ReportingRecord.filter(id=record.id).update(
                kingdee_push_status="dead",
                kingdee_push_attempts=attempts,
                kingdee_push_next_at=None,
                kingdee_push_last_error=error_snippet,
                kingdee_push_last_at=now,
            )
            await self._notify_push_dead(tenant_id=tenant_id, record=record, error=error)
            return
        delay_minutes = PUSH_RETRY_BACKOFF_MINUTES[attempts - 1]
        await ReportingRecord.filter(id=record.id).update(
            kingdee_push_status="failed",
            kingdee_push_attempts=attempts,
            kingdee_push_next_at=now + timedelta(minutes=delay_minutes),
            kingdee_push_last_error=error_snippet,
            kingdee_push_last_at=now,
        )

    async def _notify_push_dead(
        self,
        *,
        tenant_id: int,
        record: ReportingRecord,
        error: str,
    ) -> None:
        """推送超限终止时派发站内告警（触发规则 reporting_record / kingdee_push_dead）。"""
        try:
            from apps.kuaizhizao.services.kuaizhizao_business_notification import (
                ACTION_KINGDEE_PUSH_DEAD,
                DOC_REPORTING_RECORD,
                dispatch_kuaizhizao_notification,
            )

            notify_ids = [
                int(uid)
                for uid in (record.approved_by, record.recorded_by)
                if uid is not None and int(uid) > 0
            ]
            await dispatch_kuaizhizao_notification(
                tenant_id,
                trigger_document=DOC_REPORTING_RECORD,
                trigger_action=ACTION_KINGDEE_PUSH_DEAD,
                variables={
                    "work_order_code": record.work_order_code or str(record.id),
                    "operation_name": record.operation_name or "—",
                    "error": (error or "")[:500],
                    "detail_path": f"/apps/kuaizhizao/production-reporting?highlight={record.id}",
                    "reporting_record_id": str(record.id),
                },
                context={
                    "creator_user_id": record.recorded_by,
                    "form_notify_user_ids": notify_ids,
                    "report_notify_user_ids": notify_ids,
                },
            )
        except Exception as exc:
            logger.warning(
                "金蝶生产汇报单推送 dead 告警派发失败 tenant_id={} record_id={} err={}",
                tenant_id,
                getattr(record, "id", None),
                exc,
            )

    async def retry_due_pushes(self, *, batch_limit: int = 50) -> Dict[str, Any]:
        """扫描到期待重推的失败推送并重推（taskiq 分钟级 tick 调用）。"""
        now = resolve_business_datetime()
        records = await ReportingRecord.filter(
            status="approved",
            kingdee_push_status="failed",
            kingdee_push_next_at__lte=now,
            deleted_at__isnull=True,
        ).order_by("kingdee_push_next_at").limit(batch_limit).all()

        summary = {"scanned": len(records), "succeeded": 0, "failed": 0, "dead": 0, "skipped": 0}
        for record in records:
            try:
                result = await self.push_after_reporting_approved(
                    tenant_id=int(record.tenant_id),
                    record_id=int(record.id),
                    acting_user_id=int(record.approved_by or record.recorded_by or 0),
                )
            except Exception as exc:
                logger.warning(
                    "金蝶生产汇报单定时重推异常 tenant_id={} record_id={} err={}",
                    record.tenant_id,
                    record.id,
                    exc,
                )
                summary["failed"] += 1
                continue
            if result is None:
                # 配置已禁用或记录不再满足推送条件：清除重试状态，避免每分钟空扫
                await ReportingRecord.filter(id=record.id).update(
                    kingdee_push_status=None,
                    kingdee_push_next_at=None,
                )
                summary["skipped"] += 1
                continue
            fresh = await ReportingRecord.get_or_none(
                id=record.id, deleted_at__isnull=True
            )
            status = getattr(fresh, "kingdee_push_status", None)
            if status == "dead":
                summary["dead"] += 1
            elif status == "failed":
                summary["failed"] += 1
            elif status == "success":
                summary["succeeded"] += 1
            else:
                summary["skipped"] += 1
        return summary

    async def retry_push_record(
        self,
        *,
        tenant_id: int,
        record_id: int,
        acting_user_id: int,
    ) -> Optional[Dict[str, Any]]:
        """手动重推：重置重试状态后立即推送一次（获得全新 5 次预算）。"""
        record = await ReportingRecord.get_or_none(
            tenant_id=tenant_id,
            id=record_id,
            deleted_at__isnull=True,
        )
        if not record or record.status != "approved":
            return None
        await ReportingRecord.filter(id=record_id).update(
            kingdee_push_status=None,
            kingdee_push_attempts=0,
            kingdee_push_next_at=None,
            kingdee_push_last_error=None,
        )
        return await self.push_after_reporting_approved(
            tenant_id=tenant_id,
            record_id=record_id,
            acting_user_id=int(acting_user_id),
        )

    async def _get_push_config(self, tenant_id: int) -> Dict[str, Any]:
        biz_config = await BusinessConfigService().get_business_config(tenant_id)
        reporting = (biz_config.get("parameters", {}) or {}).get("reporting", {}) or {}
        raw = reporting.get("kingdee_production_report_push") or {}
        return dict(raw) if isinstance(raw, dict) else {}

    async def _push_now(
        self,
        *,
        tenant_id: int,
        record: ReportingRecord,
        acting_user_id: int,
        config: Dict[str, Any],
        dry_run: bool = False,
    ) -> Dict[str, Any]:
        """组装 PRD_MORPT Model 后走 DocumentPushPipeline。"""
        work_order = await WorkOrder.get_or_none(
            tenant_id=tenant_id,
            id=record.work_order_id,
            deleted_at__isnull=True,
        )
        operation = await WorkOrderOperation.filter(
            tenant_id=tenant_id,
            work_order_id=record.work_order_id,
            operation_id=record.operation_id,
            deleted_at__isnull=True,
        ).order_by("-id").first()

        form_id = str(config.get("form_id") or DEFAULT_FORM_ID).strip() or DEFAULT_FORM_ID
        # 本地 GD* 工单推送金蝶后，汇报明细需挂金蝶生产订单号（FMoBillNo）
        if record.work_order_id:
            mo_rel = await DocumentRelation.filter(
                tenant_id=tenant_id,
                source_type="work_order",
                source_id=int(record.work_order_id),
                target_type="kingdee_production_order",
            ).order_by("-id").first()
            mo_bill_no = str(getattr(mo_rel, "target_code", None) or "").strip()
            if mo_bill_no:
                config = {**config, "mo_bill_no": mo_bill_no}

        product_code = str(getattr(work_order, "product_code", None) or "").strip() or None
        unit_code_map = await load_save_api_unit_code_map(
            tenant_id, str(config.get("save_api_uuid") or "").strip() or None
        )
        units = await resolve_unit_for_push(
            tenant_id,
            product_code=product_code,
            unit_code_map=unit_code_map,
        )
        config = {**config, **units, "api_unit_code_map": unit_code_map}

        model = build_kingdee_production_report_model(
            record=record,
            work_order=work_order,
            operation=operation,
            cfg=config,
        )

        request = DocumentPushRequest(
            source_type=SOURCE_TYPE,
            source_id=int(record.id),
            target_profile=TARGET_PROFILE,
            source_code=record.work_order_code,
            source_name=f"{record.operation_name or ''} 报工".strip(),
            connection_code=str(config.get("connection_code") or "").strip() or None,
            save_api_uuid=str(config.get("save_api_uuid") or "").strip() or None,
            dry_run=dry_run,
        )
        prepared = DocumentPushPrepared(
            form_id=form_id,
            model=model,
            target_type=TARGET_TYPE,
            target_name="金蝶生产汇报单",
            relation_desc="报工审核通过推送金蝶生产汇报单",
            connector_type="kingdee_galaxy",
            config=config,
        )

        async def _persist(result: Dict[str, Any]) -> None:
            await DocumentRelation.create(
                tenant_id=tenant_id,
                source_type=str(result.get("source_type") or SOURCE_TYPE),
                source_id=int(result.get("source_id") or record.id),
                source_code=result.get("source_code") or record.work_order_code,
                source_name=result.get("source_name")
                or f"{record.operation_name or ''} 报工".strip(),
                target_type=str(result.get("target_type") or TARGET_TYPE),
                target_id=int(result.get("bill_id") or 0),
                target_code=(result.get("bill_no") or None),
                target_name=str(result.get("target_name") or "金蝶生产汇报单"),
                relation_type="source",
                relation_mode="push",
                relation_desc=str(
                    result.get("relation_desc") or "报工审核通过推送金蝶生产汇报单"
                ),
                notes=to_api_isoformat(datetime.utcnow()),
                created_by=acting_user_id,
            )

        return await DocumentPushPipeline().push(
            tenant_id=tenant_id,
            acting_user_id=acting_user_id,
            request=request,
            prepared=prepared,
            persist_relation=None if dry_run else _persist,
        )