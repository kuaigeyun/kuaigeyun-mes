"""培训与上岗证服务。"""

from __future__ import annotations

from typing import Any, Optional

from apps.kuaioa.models.training import KuaioaTrainingPlan, KuaioaTrainingRecord, KuaioaWorkLicense
from apps.kuaioa.schemas.training import (
    TrainingPlanCreate,
    TrainingPlanUpdate,
    TrainingRecordCreate,
    TrainingRecordUpdate,
    WorkLicenseCreate,
    WorkLicenseUpdate,
)
from apps.kuaioa.services.kuaioa_list_core import (
    build_keyword_q,
    generate_daily_code,
    model_to_dict,
    parse_optional_date,
    touch_updated,
)
from core.utils.timezone_utils import resolve_business_datetime, today_site_str, to_site_date
from infra.exceptions.exceptions import BusinessLogicError, NotFoundError


class TrainingPlanService:
    async def list_plans(
        self, tenant_id: int, *, keyword: Optional[str] = None, status: Optional[str] = None
    ) -> list[dict[str, Any]]:
        q = KuaioaTrainingPlan.filter(tenant_id=tenant_id, deleted_at__isnull=True)
        if status:
            q = q.filter(status=status)
        if keyword:
            q = q.filter(build_keyword_q(keyword, "plan_code", "plan_name", "department_name"))
        rows = await q.order_by("-created_at", "-id")
        return [model_to_dict(row) for row in rows]

    async def get_plan(self, tenant_id: int, plan_id: int) -> dict[str, Any]:
        row = await KuaioaTrainingPlan.get_or_none(
            id=plan_id, tenant_id=tenant_id, deleted_at__isnull=True
        )
        if not row:
            raise NotFoundError("培训计划不存在")
        return model_to_dict(row)

    async def create_plan(
        self, tenant_id: int, data: TrainingPlanCreate, user_id: int
    ) -> dict[str, Any]:
        plan_code = await generate_daily_code(
            KuaioaTrainingPlan, tenant_id, "TP", code_field="plan_code"
        )
        row = await KuaioaTrainingPlan.create(
            tenant_id=tenant_id,
            plan_code=plan_code,
            plan_name=data.plan_name.strip(),
            plan_type=data.plan_type,
            department_name=data.department_name,
            planned_start_date=parse_optional_date(data.planned_start_date),
            planned_end_date=parse_optional_date(data.planned_end_date),
            description=data.description,
            reminder_days=data.reminder_days,
            status="draft",
            created_by=user_id,
            updated_by=user_id,
        )
        return model_to_dict(row)

    async def update_plan(
        self, tenant_id: int, plan_id: int, data: TrainingPlanUpdate, user_id: int
    ) -> dict[str, Any]:
        row = await KuaioaTrainingPlan.get_or_none(
            id=plan_id, tenant_id=tenant_id, deleted_at__isnull=True
        )
        if not row:
            raise NotFoundError("培训计划不存在")
        payload = data.model_dump(exclude_unset=True)
        for key in ("planned_start_date", "planned_end_date"):
            if key in payload:
                payload[key] = parse_optional_date(payload[key])
        for key, value in payload.items():
            setattr(row, key, value)
        touch_updated(row, user_id)
        await row.save()
        return model_to_dict(row)

    async def delete_plan(self, tenant_id: int, plan_id: int, user_id: int) -> None:
        row = await KuaioaTrainingPlan.get_or_none(
            id=plan_id, tenant_id=tenant_id, deleted_at__isnull=True
        )
        if not row:
            raise NotFoundError("培训计划不存在")
        row.deleted_at = resolve_business_datetime()
        touch_updated(row, user_id)
        await row.save()


class TrainingRecordService:
    async def list_records(
        self, tenant_id: int, *, keyword: Optional[str] = None, plan_id: Optional[int] = None
    ) -> list[dict[str, Any]]:
        q = KuaioaTrainingRecord.filter(tenant_id=tenant_id, deleted_at__isnull=True)
        if plan_id:
            q = q.filter(plan_id=plan_id)
        if keyword:
            q = q.filter(build_keyword_q(keyword, "record_code", "training_name", "trainee_name"))
        rows = await q.order_by("-created_at", "-id")
        return [model_to_dict(row) for row in rows]

    async def get_record(self, tenant_id: int, record_id: int) -> dict[str, Any]:
        row = await KuaioaTrainingRecord.get_or_none(
            id=record_id, tenant_id=tenant_id, deleted_at__isnull=True
        )
        if not row:
            raise NotFoundError("培训记录不存在")
        return model_to_dict(row)

    async def create_record(
        self, tenant_id: int, data: TrainingRecordCreate, user_id: int
    ) -> dict[str, Any]:
        record_code = await generate_daily_code(
            KuaioaTrainingRecord, tenant_id, "TR", code_field="record_code"
        )
        row = await KuaioaTrainingRecord.create(
            tenant_id=tenant_id,
            record_code=record_code,
            plan_id=data.plan_id,
            training_name=data.training_name.strip(),
            trainee_id=data.trainee_id,
            trainee_name=data.trainee_name,
            trainer_name=data.trainer_name,
            training_date=parse_optional_date(data.training_date),
            theory_score=data.theory_score,
            practice_score=data.practice_score,
            is_passed=data.is_passed,
            notes=data.notes,
            status="completed" if data.is_passed else "draft",
            created_by=user_id,
            updated_by=user_id,
        )
        if row.is_passed:
            await self._maybe_create_work_license(tenant_id, row, user_id)
        return model_to_dict(row)

    async def update_record(
        self, tenant_id: int, record_id: int, data: TrainingRecordUpdate, user_id: int
    ) -> dict[str, Any]:
        row = await KuaioaTrainingRecord.get_or_none(
            id=record_id, tenant_id=tenant_id, deleted_at__isnull=True
        )
        if not row:
            raise NotFoundError("培训记录不存在")
        payload = data.model_dump(exclude_unset=True)
        if "training_date" in payload:
            payload["training_date"] = parse_optional_date(payload["training_date"])
        for key, value in payload.items():
            setattr(row, key, value)
        if row.is_passed:
            row.status = "completed"
        touch_updated(row, user_id)
        await row.save()
        if row.is_passed:
            await self._maybe_create_work_license(tenant_id, row, user_id)
        return model_to_dict(row)

    async def delete_record(self, tenant_id: int, record_id: int, user_id: int) -> None:
        row = await KuaioaTrainingRecord.get_or_none(
            id=record_id, tenant_id=tenant_id, deleted_at__isnull=True
        )
        if not row:
            raise NotFoundError("培训记录不存在")
        row.deleted_at = resolve_business_datetime()
        touch_updated(row, user_id)
        await row.save()

    async def _maybe_create_work_license(
        self, tenant_id: int, record: KuaioaTrainingRecord, user_id: int
    ) -> None:
        if not record.trainee_name:
            return
        exists = await KuaioaWorkLicense.filter(
            tenant_id=tenant_id,
            holder_name=record.trainee_name,
            license_name=record.training_name,
            deleted_at__isnull=True,
        ).exists()
        if exists:
            return
        license_code = await generate_daily_code(
            KuaioaWorkLicense, tenant_id, "WL", code_field="license_code"
        )
        await KuaioaWorkLicense.create(
            tenant_id=tenant_id,
            license_code=license_code,
            license_name=record.training_name,
            license_type="work",
            holder_id=record.trainee_id,
            holder_name=record.trainee_name,
            issue_date=record.training_date or to_site_date(resolve_business_datetime()),
            status="active",
            created_by=user_id,
            updated_by=user_id,
        )


class WorkLicenseService:
    async def list_licenses(
        self, tenant_id: int, *, keyword: Optional[str] = None, status: Optional[str] = None
    ) -> list[dict[str, Any]]:
        q = KuaioaWorkLicense.filter(tenant_id=tenant_id, deleted_at__isnull=True)
        if status:
            q = q.filter(status=status)
        if keyword:
            q = q.filter(build_keyword_q(keyword, "license_code", "license_name", "holder_name"))
        rows = await q.order_by("expiry_date", "-updated_at")
        return [model_to_dict(row) for row in rows]

    async def get_license(self, tenant_id: int, license_id: int) -> dict[str, Any]:
        row = await KuaioaWorkLicense.get_or_none(
            id=license_id, tenant_id=tenant_id, deleted_at__isnull=True
        )
        if not row:
            raise NotFoundError("上岗证不存在")
        return model_to_dict(row)

    async def create_license(
        self, tenant_id: int, data: WorkLicenseCreate, user_id: int
    ) -> dict[str, Any]:
        license_code = await generate_daily_code(
            KuaioaWorkLicense, tenant_id, "WL", code_field="license_code"
        )
        row = await KuaioaWorkLicense.create(
            tenant_id=tenant_id,
            license_code=license_code,
            license_name=data.license_name.strip(),
            license_type=data.license_type,
            holder_id=data.holder_id,
            holder_name=data.holder_name,
            department_name=data.department_name,
            issue_date=parse_optional_date(data.issue_date),
            expiry_date=parse_optional_date(data.expiry_date),
            reminder_days=data.reminder_days,
            notes=data.notes,
            status="active",
            created_by=user_id,
            updated_by=user_id,
        )
        return model_to_dict(row)

    async def update_license(
        self, tenant_id: int, license_id: int, data: WorkLicenseUpdate, user_id: int
    ) -> dict[str, Any]:
        row = await KuaioaWorkLicense.get_or_none(
            id=license_id, tenant_id=tenant_id, deleted_at__isnull=True
        )
        if not row:
            raise NotFoundError("上岗证不存在")
        payload = data.model_dump(exclude_unset=True)
        for key in ("issue_date", "expiry_date"):
            if key in payload:
                payload[key] = parse_optional_date(payload[key])
        for key, value in payload.items():
            setattr(row, key, value)
        touch_updated(row, user_id)
        await row.save()
        return model_to_dict(row)

    async def delete_license(self, tenant_id: int, license_id: int, user_id: int) -> None:
        row = await KuaioaWorkLicense.get_or_none(
            id=license_id, tenant_id=tenant_id, deleted_at__isnull=True
        )
        if not row:
            raise NotFoundError("上岗证不存在")
        row.deleted_at = resolve_business_datetime()
        touch_updated(row, user_id)
        await row.save()

    async def list_expiring(self, tenant_id: int, within_days: int = 30) -> list[dict[str, Any]]:
        today = to_site_date(resolve_business_datetime())
        rows = await KuaioaWorkLicense.filter(
            tenant_id=tenant_id,
            deleted_at__isnull=True,
            expiry_date__isnull=False,
            status="active",
        ).order_by("expiry_date")
        result = []
        for row in rows:
            if not row.expiry_date:
                continue
            delta = (row.expiry_date - today).days
            if delta <= within_days:
                item = model_to_dict(row)
                item["days_until_expiry"] = delta
                result.append(item)
        return result
