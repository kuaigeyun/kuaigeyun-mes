"""员工档案服务。"""

from __future__ import annotations

import calendar
from datetime import date
from typing import Any, Optional

from apps.kuaioa.models.employee import KuaioaEmployeeProfile
from apps.kuaioa.schemas.employee import EmployeeProfileCreate, EmployeeProfileUpdate
from apps.kuaioa.services.kuaioa_list_core import (
    apply_create_audit_by_user_id,
    build_keyword_q,
    generate_daily_code,
    model_to_dict,
    parse_optional_date,
    touch_updated,
)
from core.utils.timezone_utils import resolve_business_datetime
from infra.exceptions.exceptions import BusinessLogicError, NotFoundError

_ALLOWED_EMPLOYMENT = frozenset({"formal", "temp"})
_ALLOWED_PAY = frozenset({"piece", "time", "line"})
_ALLOWED_STATUS = frozenset({"active", "left"})


def _resolve_status(*, leave_date, status: Optional[str]) -> str:
    if leave_date is not None:
        return "left"
    if status in _ALLOWED_STATUS:
        return status
    return "active"


class EmployeeProfileService:
    async def list_profiles(
        self,
        tenant_id: int,
        *,
        keyword: Optional[str] = None,
        status: Optional[str] = None,
        employment_type: Optional[str] = None,
        workshop_name: Optional[str] = None,
    ) -> list[dict[str, Any]]:
        q = KuaioaEmployeeProfile.filter(tenant_id=tenant_id, deleted_at__isnull=True)
        if status:
            q = q.filter(status=status)
        if employment_type:
            q = q.filter(employment_type=employment_type)
        if workshop_name:
            q = q.filter(workshop_name=workshop_name)
        if keyword:
            q = q.filter(
                build_keyword_q(
                    keyword,
                    "employee_code",
                    "full_name",
                    "phone",
                    "workshop_name",
                    "bank_account",
                )
            )
        rows = await q.order_by("-updated_at")
        return [model_to_dict(row) for row in rows]

    async def get_profile(self, tenant_id: int, profile_id: int) -> dict[str, Any]:
        row = await KuaioaEmployeeProfile.get_or_none(
            id=profile_id, tenant_id=tenant_id, deleted_at__isnull=True
        )
        if not row:
            raise NotFoundError("员工档案不存在")
        return model_to_dict(row)

    async def create_profile(
        self, tenant_id: int, data: EmployeeProfileCreate, user_id: int
    ) -> dict[str, Any]:
        full_name = (data.full_name or "").strip()
        if not full_name:
            raise BusinessLogicError("姓名不能为空")
        employment_type = (data.employment_type or "formal").strip()
        if employment_type not in _ALLOWED_EMPLOYMENT:
            raise BusinessLogicError("用工类型无效")
        pay_method = (data.pay_method or "time").strip()
        if pay_method not in _ALLOWED_PAY:
            raise BusinessLogicError("计薪方式无效")

        hire_date = parse_optional_date(data.hire_date)
        leave_date = parse_optional_date(data.leave_date)
        status = _resolve_status(leave_date=leave_date, status=data.status)

        employee_code = await generate_daily_code(
            KuaioaEmployeeProfile, tenant_id, "EMP", code_field="employee_code"
        )
        create_payload: dict[str, Any] = {
            "tenant_id": tenant_id,
            "employee_code": employee_code,
            "full_name": full_name,
            "phone": (data.phone or "").strip() or None,
            "workshop_name": (data.workshop_name or "").strip() or None,
            "production_line_name": (data.production_line_name or "").strip() or None,
            "employment_type": employment_type,
            "pay_method": pay_method,
            "hourly_rate": data.hourly_rate,
            "hire_date": hire_date,
            "leave_date": leave_date,
            "bank_account": (data.bank_account or "").strip() or None,
            "bank_name": (data.bank_name or "").strip() or None,
            "bank_branch": (data.bank_branch or "").strip() or None,
            "living_allowance": data.living_allowance,
            "post_wage": data.post_wage,
            "social_insurance": data.social_insurance,
            "housing_fund": data.housing_fund,
            "rent_utility": data.rent_utility,
            "welfare_dragon_boat": data.welfare_dragon_boat,
            "welfare_mid_autumn": data.welfare_mid_autumn,
            "welfare_spring_festival": data.welfare_spring_festival,
            "user_id": data.user_id,
            "department_name": (data.department_name or "").strip() or None,
            "status": status,
            "notes": data.notes,
        }
        await apply_create_audit_by_user_id(create_payload, user_id)
        row = await KuaioaEmployeeProfile.create(**create_payload)
        return model_to_dict(row)

    async def update_profile(
        self, tenant_id: int, profile_id: int, data: EmployeeProfileUpdate, user_id: int
    ) -> dict[str, Any]:
        row = await KuaioaEmployeeProfile.get_or_none(
            id=profile_id, tenant_id=tenant_id, deleted_at__isnull=True
        )
        if not row:
            raise NotFoundError("员工档案不存在")
        payload = data.model_dump(exclude_unset=True)
        if "full_name" in payload:
            name = (payload["full_name"] or "").strip()
            if not name:
                raise BusinessLogicError("姓名不能为空")
            payload["full_name"] = name
        if "employment_type" in payload and payload["employment_type"] is not None:
            et = str(payload["employment_type"]).strip()
            if et not in _ALLOWED_EMPLOYMENT:
                raise BusinessLogicError("用工类型无效")
            payload["employment_type"] = et
        if "pay_method" in payload and payload["pay_method"] is not None:
            pm = str(payload["pay_method"]).strip()
            if pm not in _ALLOWED_PAY:
                raise BusinessLogicError("计薪方式无效")
            payload["pay_method"] = pm
        for key in ("hire_date", "leave_date"):
            if key in payload:
                payload[key] = parse_optional_date(payload[key])
        for key in (
            "phone",
            "workshop_name",
            "production_line_name",
            "bank_account",
            "bank_name",
            "bank_branch",
            "department_name",
        ):
            if key in payload and isinstance(payload[key], str):
                payload[key] = payload[key].strip() or None

        leave_date = payload["leave_date"] if "leave_date" in payload else row.leave_date
        status_in = payload.get("status") if "status" in payload else row.status
        payload["status"] = _resolve_status(leave_date=leave_date, status=status_in)

        for key, value in payload.items():
            setattr(row, key, value)
        await touch_updated(row, user_id)
        await row.save()
        return model_to_dict(row)

    async def list_movements(
        self,
        tenant_id: int,
        year_month: str,
        *,
        workshop_name: Optional[str] = None,
        movement_type: Optional[str] = None,
    ) -> list[dict[str, Any]]:
        text = (year_month or "").strip()
        if len(text) != 7 or text[4] != "-":
            raise BusinessLogicError("年月格式须为 YYYY-MM")
        year = int(text[:4])
        month = int(text[5:7])
        if month < 1 or month > 12:
            raise BusinessLogicError("月份无效")
        last_day = calendar.monthrange(year, month)[1]
        start = date(year, month, 1)
        end = date(year, month, last_day)

        q = KuaioaEmployeeProfile.filter(tenant_id=tenant_id, deleted_at__isnull=True)
        if workshop_name:
            q = q.filter(workshop_name=workshop_name.strip())
        employees = await q.order_by("full_name", "id")

        rows: list[dict[str, Any]] = []
        for emp in employees:
            if movement_type in (None, "hire") and emp.hire_date and start <= emp.hire_date <= end:
                rows.append(
                    {
                        "movement_type": "hire",
                        "employee_id": emp.id,
                        "employee_code": emp.employee_code,
                        "employee_name": emp.full_name,
                        "workshop_name": emp.workshop_name,
                        "movement_date": emp.hire_date.isoformat(),
                        "employment_type": emp.employment_type,
                        "year_month": text,
                    }
                )
            if movement_type in (None, "leave") and emp.leave_date and start <= emp.leave_date <= end:
                rows.append(
                    {
                        "movement_type": "leave",
                        "employee_id": emp.id,
                        "employee_code": emp.employee_code,
                        "employee_name": emp.full_name,
                        "workshop_name": emp.workshop_name,
                        "movement_date": emp.leave_date.isoformat(),
                        "employment_type": emp.employment_type,
                        "year_month": text,
                    }
                )
        rows.sort(key=lambda r: (r.get("movement_date") or "", r.get("employee_name") or ""))
        return rows

    async def delete_profile(self, tenant_id: int, profile_id: int, user_id: int) -> None:
        row = await KuaioaEmployeeProfile.get_or_none(
            id=profile_id, tenant_id=tenant_id, deleted_at__isnull=True
        )
        if not row:
            raise NotFoundError("员工档案不存在")
        row.deleted_at = resolve_business_datetime()
        await touch_updated(row, user_id)
        await row.save()
