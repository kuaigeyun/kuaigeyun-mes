"""生活费预支、奖励与工资结算服务。"""

from __future__ import annotations

from decimal import Decimal
from typing import Any, Optional

from apps.kuaioa.models.attendance import KuaioaAttendanceDay, KuaioaAttendanceSheet
from apps.kuaioa.models.employee import KuaioaEmployeeProfile
from apps.kuaioa.models.minimum_wage import KuaioaMinimumWageConfig
from apps.kuaioa.models.payroll import (
    KuaioaLivingAdvance,
    KuaioaPayrollSettlement,
    KuaioaPayrollSettlementLine,
    KuaioaRewardRecord,
)
from apps.kuaioa.models.post_subsidy import KuaioaPostSubsidy
from apps.kuaioa.schemas.payroll import (
    LivingAdvanceCreate,
    LivingAdvanceUpdate,
    PayrollSettlementCreate,
    PayrollSettlementLineUpdate,
    PayrollSettlementUpdate,
    RewardRecordCreate,
    RewardRecordUpdate,
)
from apps.kuaioa.schemas.payroll_import import PayrollLineImportRequest
from apps.kuaioa.services.kuaioa_list_core import (
    apply_create_audit_by_user_id,
    build_keyword_q,
    generate_daily_code,
    model_to_dict,
    touch_updated,
)
from core.utils.timezone_utils import resolve_business_datetime
from infra.exceptions.exceptions import BusinessLogicError, NotFoundError
from infra.models.user import User

ZERO = Decimal("0")


def _d(value: Any) -> Decimal:
    if value is None:
        return ZERO
    return Decimal(str(value))


def _parse_ym(value: str) -> str:
    text = (value or "").strip()
    if len(text) != 7 or text[4] != "-":
        raise BusinessLogicError("年月格式须为 YYYY-MM")
    month = int(text[5:7])
    if month < 1 or month > 12:
        raise BusinessLogicError("月份无效")
    return text


def _recalc_line(line: KuaioaPayrollSettlementLine) -> None:
    earning = (
        _d(line.basic_wage)
        + _d(line.post_wage)
        + _d(line.time_wage)
        + _d(line.piece_wage)
        + _d(line.night_subsidy)
        + _d(line.heat_subsidy)
        + _d(line.post_allowance)
        + _d(line.allowance)
    )
    deduct = (
        _d(line.living_deduct)
        + _d(getattr(line, "rent_utility_deduct", None))
        + _d(line.insurance_deduct)
        + _d(line.leave_deduct)
        + _d(line.compensation)
        + _d(line.tax_deduct)
    )
    line.earning_subtotal = earning
    line.deduct_subtotal = deduct
    line.balance = earning - deduct - _d(line.card_pay)


async def _apply_living_advance_profile_overrides(
    emp: KuaioaEmployeeProfile,
    *,
    workshop_name: Optional[str] = None,
    base_living: Optional[Decimal] = None,
    bank_name: Optional[str] = None,
    bank_account: Optional[str] = None,
) -> tuple[Optional[str], Optional[Decimal]]:
    """档案字段可被本单覆盖；银行/卡号/车间/固定生活费回写员工档案真源。"""
    dirty = False
    if workshop_name is not None:
        ws = workshop_name.strip() or None
        if ws != emp.workshop_name:
            emp.workshop_name = ws
            dirty = True
    if base_living is not None:
        if _d(base_living) != _d(emp.living_allowance):
            emp.living_allowance = base_living
            dirty = True
    if bank_name is not None:
        bn = bank_name.strip() or None
        if bn != emp.bank_name:
            emp.bank_name = bn
            dirty = True
    if bank_account is not None:
        ba = bank_account.strip() or None
        if ba != emp.bank_account:
            emp.bank_account = ba
            dirty = True
    if dirty:
        await emp.save()
    workshop = emp.workshop_name
    if workshop_name is not None:
        workshop = workshop_name.strip() or None
    base = emp.living_allowance if base_living is None else base_living
    return workshop, base


async def _get_employee(tenant_id: int, employee_id: int) -> KuaioaEmployeeProfile:
    emp = await KuaioaEmployeeProfile.get_or_none(
        id=employee_id, tenant_id=tenant_id, deleted_at__isnull=True
    )
    if not emp:
        raise NotFoundError("员工档案不存在")
    return emp


async def _employee_remaining_wage(tenant_id: int, employee_id: int) -> Optional[Decimal]:
    """已确认结算行结余合计；无结算记录时返回 None（不拦预支）。"""
    settlements = await KuaioaPayrollSettlement.filter(
        tenant_id=tenant_id, status="confirmed", deleted_at__isnull=True
    ).only("id")
    if not settlements:
        return None
    sids = [int(s.id) for s in settlements]
    lines = await KuaioaPayrollSettlementLine.filter(
        tenant_id=tenant_id,
        settlement_id__in=sids,
        employee_id=employee_id,
        deleted_at__isnull=True,
    ).only("balance")
    if not lines:
        return None
    return sum((_d(l.balance) for l in lines), ZERO)


def _assert_advance_within_remaining(amount: Decimal, remaining: Optional[Decimal]) -> None:
    if remaining is None:
        return
    if amount > remaining:
        raise BusinessLogicError(f"预支金额超过剩余工资（剩余 {remaining}）")


class LivingAdvanceService:
    async def list_rows(
        self,
        tenant_id: int,
        *,
        keyword: Optional[str] = None,
        year_month: Optional[str] = None,
        status: Optional[str] = None,
    ) -> list[dict[str, Any]]:
        q = KuaioaLivingAdvance.filter(tenant_id=tenant_id, deleted_at__isnull=True)
        if year_month:
            q = q.filter(year_month=year_month.strip())
        if status:
            q = q.filter(status=status)
        if keyword:
            q = q.filter(build_keyword_q(keyword, "advance_code", "employee_name", "workshop_name"))
        rows = await q.order_by("-year_month", "-id")
        return [model_to_dict(r) for r in rows]

    async def get_row(self, tenant_id: int, row_id: int) -> dict[str, Any]:
        row = await KuaioaLivingAdvance.get_or_none(
            id=row_id, tenant_id=tenant_id, deleted_at__isnull=True
        )
        if not row:
            raise NotFoundError("生活费预支不存在")
        return model_to_dict(row)

    async def create_row(
        self, tenant_id: int, data: LivingAdvanceCreate, user_id: int
    ) -> dict[str, Any]:
        ym = _parse_ym(data.year_month)
        if _d(data.amount) <= 0:
            raise BusinessLogicError("预支金额须大于 0")
        emp = await _get_employee(tenant_id, data.employee_id)
        remaining = await _employee_remaining_wage(tenant_id, int(emp.id))
        _assert_advance_within_remaining(_d(data.amount), remaining)
        workshop, base_living = await _apply_living_advance_profile_overrides(
            emp,
            workshop_name=data.workshop_name,
            base_living=data.base_living,
            bank_name=data.bank_name,
            bank_account=data.bank_account,
        )
        code = await generate_daily_code(
            KuaioaLivingAdvance, tenant_id, "LVA", code_field="advance_code"
        )
        payload: dict[str, Any] = {
            "tenant_id": tenant_id,
            "advance_code": code,
            "year_month": ym,
            "employee_id": int(emp.id),
            "employee_code": emp.employee_code,
            "employee_name": emp.full_name,
            "workshop_name": workshop,
            "base_living": base_living,
            "amount": data.amount,
            "reason": data.reason,
            "status": "confirmed",
            "notes": data.notes,
        }
        await apply_create_audit_by_user_id(payload, user_id)
        row = await KuaioaLivingAdvance.create(**payload)
        return model_to_dict(row)

    async def update_row(
        self, tenant_id: int, row_id: int, data: LivingAdvanceUpdate, user_id: int
    ) -> dict[str, Any]:
        row = await KuaioaLivingAdvance.get_or_none(
            id=row_id, tenant_id=tenant_id, deleted_at__isnull=True
        )
        if not row:
            raise NotFoundError("生活费预支不存在")
        payload = data.model_dump(exclude_unset=True)
        if "amount" in payload and _d(payload["amount"]) <= 0:
            raise BusinessLogicError("预支金额须大于 0")
        if "amount" in payload:
            remaining = await _employee_remaining_wage(tenant_id, int(row.employee_id))
            _assert_advance_within_remaining(_d(payload["amount"]), remaining)
        if "status" in payload and payload["status"] not in ("confirmed", "void"):
            raise BusinessLogicError("状态无效")
        fields_set = data.model_fields_set
        payload.pop("bank_name", None)
        payload.pop("bank_account", None)
        if fields_set & {"workshop_name", "base_living", "bank_name", "bank_account"}:
            emp = await _get_employee(tenant_id, int(row.employee_id))
            workshop, base_living = await _apply_living_advance_profile_overrides(
                emp,
                workshop_name=data.workshop_name if "workshop_name" in fields_set else None,
                base_living=data.base_living if "base_living" in fields_set else None,
                bank_name=data.bank_name if "bank_name" in fields_set else None,
                bank_account=data.bank_account if "bank_account" in fields_set else None,
            )
            if "workshop_name" in fields_set:
                payload["workshop_name"] = workshop
            if "base_living" in fields_set:
                payload["base_living"] = base_living
        for k, v in payload.items():
            setattr(row, k, v)
        await touch_updated(row, user_id)
        await row.save()
        return model_to_dict(row)

    async def delete_row(self, tenant_id: int, row_id: int, user_id: int) -> None:
        row = await KuaioaLivingAdvance.get_or_none(
            id=row_id, tenant_id=tenant_id, deleted_at__isnull=True
        )
        if not row:
            raise NotFoundError("生活费预支不存在")
        row.deleted_at = resolve_business_datetime()
        await touch_updated(row, user_id)
        await row.save()


class RewardRecordService:
    async def list_rows(
        self,
        tenant_id: int,
        *,
        keyword: Optional[str] = None,
        year_month: Optional[str] = None,
        status: Optional[str] = None,
    ) -> list[dict[str, Any]]:
        q = KuaioaRewardRecord.filter(tenant_id=tenant_id, deleted_at__isnull=True)
        if year_month:
            q = q.filter(year_month=year_month.strip())
        if status:
            q = q.filter(status=status)
        if keyword:
            q = q.filter(build_keyword_q(keyword, "reward_code", "employee_name", "reason"))
        rows = await q.order_by("-year_month", "-id")
        return [model_to_dict(r) for r in rows]

    async def get_row(self, tenant_id: int, row_id: int) -> dict[str, Any]:
        row = await KuaioaRewardRecord.get_or_none(
            id=row_id, tenant_id=tenant_id, deleted_at__isnull=True
        )
        if not row:
            raise NotFoundError("奖励登记不存在")
        return model_to_dict(row)

    async def create_row(
        self, tenant_id: int, data: RewardRecordCreate, user_id: int
    ) -> dict[str, Any]:
        ym = _parse_ym(data.year_month)
        if _d(data.amount) <= 0:
            raise BusinessLogicError("奖励金额须大于 0")
        emp = await _get_employee(tenant_id, data.employee_id)
        code = await generate_daily_code(
            KuaioaRewardRecord, tenant_id, "RWD", code_field="reward_code"
        )
        payload: dict[str, Any] = {
            "tenant_id": tenant_id,
            "reward_code": code,
            "year_month": ym,
            "employee_id": int(emp.id),
            "employee_code": emp.employee_code,
            "employee_name": emp.full_name,
            "workshop_name": emp.workshop_name,
            "amount": data.amount,
            "reason": data.reason,
            "status": "confirmed",
            "notes": data.notes,
        }
        await apply_create_audit_by_user_id(payload, user_id)
        row = await KuaioaRewardRecord.create(**payload)
        return model_to_dict(row)

    async def update_row(
        self, tenant_id: int, row_id: int, data: RewardRecordUpdate, user_id: int
    ) -> dict[str, Any]:
        row = await KuaioaRewardRecord.get_or_none(
            id=row_id, tenant_id=tenant_id, deleted_at__isnull=True
        )
        if not row:
            raise NotFoundError("奖励登记不存在")
        payload = data.model_dump(exclude_unset=True)
        if "amount" in payload and _d(payload["amount"]) <= 0:
            raise BusinessLogicError("奖励金额须大于 0")
        if "status" in payload and payload["status"] not in ("confirmed", "void"):
            raise BusinessLogicError("状态无效")
        for k, v in payload.items():
            setattr(row, k, v)
        await touch_updated(row, user_id)
        await row.save()
        return model_to_dict(row)

    async def delete_row(self, tenant_id: int, row_id: int, user_id: int) -> None:
        row = await KuaioaRewardRecord.get_or_none(
            id=row_id, tenant_id=tenant_id, deleted_at__isnull=True
        )
        if not row:
            raise NotFoundError("奖励登记不存在")
        row.deleted_at = resolve_business_datetime()
        await touch_updated(row, user_id)
        await row.save()


class PayrollSettlementService:
    async def list_settlements(
        self,
        tenant_id: int,
        *,
        keyword: Optional[str] = None,
        year_month: Optional[str] = None,
        workshop_name: Optional[str] = None,
        status: Optional[str] = None,
    ) -> list[dict[str, Any]]:
        q = KuaioaPayrollSettlement.filter(tenant_id=tenant_id, deleted_at__isnull=True)
        if year_month:
            q = q.filter(year_month=year_month.strip())
        if workshop_name:
            q = q.filter(workshop_name=workshop_name.strip())
        if status:
            q = q.filter(status=status)
        if keyword:
            q = q.filter(
                build_keyword_q(keyword, "settlement_code", "workshop_name")
            )
        rows = await q.order_by("-year_month", "-id")
        return [model_to_dict(r) for r in rows]

    async def get_settlement(self, tenant_id: int, settlement_id: int) -> dict[str, Any]:
        sheet = await self._get_header(tenant_id, settlement_id)
        item = model_to_dict(sheet)
        lines = await KuaioaPayrollSettlementLine.filter(
            tenant_id=tenant_id, settlement_id=settlement_id, deleted_at__isnull=True
        ).order_by("employee_name", "id")
        item["lines"] = [model_to_dict(l) for l in lines]
        item["earning_total"] = sum((_d(l.earning_subtotal) for l in lines), ZERO)
        item["deduct_total"] = sum((_d(l.deduct_subtotal) for l in lines), ZERO)
        item["balance_total"] = sum((_d(l.balance) for l in lines), ZERO)
        min_wage = await self._resolve_minimum_wage(tenant_id, sheet.year_month)
        item["minimum_wage"] = min_wage
        if min_wage is not None:
            item["below_minimum_lines"] = [
                int(l.id)
                for l in lines
                if _d(l.balance) < min_wage
            ]
        else:
            item["below_minimum_lines"] = []
        return item

    async def create_settlement(
        self, tenant_id: int, data: PayrollSettlementCreate, user_id: int
    ) -> dict[str, Any]:
        ym = _parse_ym(data.year_month)
        workshop = (data.workshop_name or "").strip()
        if not workshop:
            raise BusinessLogicError("车间不能为空")
        ot_mult = data.ot_multiplier if data.ot_multiplier is not None else Decimal("3")
        if ot_mult <= 0:
            raise BusinessLogicError("加班倍率须大于 0")

        exists = await KuaioaPayrollSettlement.filter(
            tenant_id=tenant_id,
            deleted_at__isnull=True,
            year_month=ym,
            workshop_name=workshop,
        ).exists()
        if exists:
            raise BusinessLogicError("该车间本月结算单已存在")

        code = await generate_daily_code(
            KuaioaPayrollSettlement, tenant_id, "PAY", code_field="settlement_code"
        )
        payload: dict[str, Any] = {
            "tenant_id": tenant_id,
            "settlement_code": code,
            "year_month": ym,
            "workshop_name": workshop,
            "ot_multiplier": ot_mult,
            "status": "draft",
            "notes": data.notes,
        }
        await apply_create_audit_by_user_id(payload, user_id)
        sheet = await KuaioaPayrollSettlement.create(**payload)
        await self._build_lines(sheet)
        return await self.get_settlement(tenant_id, int(sheet.id))

    async def rebuild_lines(
        self, tenant_id: int, settlement_id: int, user_id: int
    ) -> dict[str, Any]:
        sheet = await self._get_header(tenant_id, settlement_id)
        if sheet.status == "confirmed":
            raise BusinessLogicError("已确认结算单不可重建明细")
        await KuaioaPayrollSettlementLine.filter(
            tenant_id=tenant_id, settlement_id=settlement_id, deleted_at__isnull=True
        ).update(deleted_at=resolve_business_datetime())
        await self._build_lines(sheet)
        await touch_updated(sheet, user_id)
        await sheet.save()
        return await self.get_settlement(tenant_id, settlement_id)

    async def update_settlement(
        self, tenant_id: int, settlement_id: int, data: PayrollSettlementUpdate, user_id: int
    ) -> dict[str, Any]:
        sheet = await self._get_header(tenant_id, settlement_id)
        if sheet.status == "confirmed":
            raise BusinessLogicError("已确认结算单不可修改")
        payload = data.model_dump(exclude_unset=True)
        for k, v in payload.items():
            setattr(sheet, k, v)
        await touch_updated(sheet, user_id)
        await sheet.save()
        return await self.get_settlement(tenant_id, settlement_id)

    async def update_line(
        self,
        tenant_id: int,
        settlement_id: int,
        line_id: int,
        data: PayrollSettlementLineUpdate,
        user_id: int,
    ) -> dict[str, Any]:
        sheet = await self._get_header(tenant_id, settlement_id)
        if sheet.status == "confirmed":
            raise BusinessLogicError("已确认结算单不可改行")
        line = await KuaioaPayrollSettlementLine.get_or_none(
            id=line_id,
            tenant_id=tenant_id,
            settlement_id=settlement_id,
            deleted_at__isnull=True,
        )
        if not line:
            raise NotFoundError("结算行不存在")
        payload = data.model_dump(exclude_unset=True)
        for k, v in payload.items():
            setattr(line, k, v)
        _recalc_line(line)
        await touch_updated(line, user_id)
        await line.save()
        await touch_updated(sheet, user_id)
        await sheet.save()
        return model_to_dict(line)

    async def confirm(
        self, tenant_id: int, settlement_id: int, user: User
    ) -> dict[str, Any]:
        sheet = await self._get_header(tenant_id, settlement_id)
        if sheet.status == "confirmed":
            raise BusinessLogicError("结算单已确认")
        sheet.status = "confirmed"
        sheet.confirmed_at = resolve_business_datetime()
        sheet.confirmed_by = user.id
        sheet.confirmed_by_name = user.full_name or user.username
        await touch_updated(sheet, user.id)
        await sheet.save()
        return await self.get_settlement(tenant_id, settlement_id)

    async def reopen(self, tenant_id: int, settlement_id: int, user_id: int) -> dict[str, Any]:
        sheet = await self._get_header(tenant_id, settlement_id)
        if sheet.status != "confirmed":
            raise BusinessLogicError("仅已确认结算单可重新打开")
        sheet.status = "draft"
        sheet.confirmed_at = None
        sheet.confirmed_by = None
        sheet.confirmed_by_name = None
        await touch_updated(sheet, user_id)
        await sheet.save()
        return await self.get_settlement(tenant_id, settlement_id)

    async def delete_settlement(self, tenant_id: int, settlement_id: int, user_id: int) -> None:
        sheet = await self._get_header(tenant_id, settlement_id)
        if sheet.status == "confirmed":
            raise BusinessLogicError("已确认结算单不可删除")
        sheet.deleted_at = resolve_business_datetime()
        await touch_updated(sheet, user_id)
        await sheet.save()
        await KuaioaPayrollSettlementLine.filter(
            tenant_id=tenant_id, settlement_id=settlement_id, deleted_at__isnull=True
        ).update(deleted_at=resolve_business_datetime())

    async def list_living_payout(
        self, tenant_id: int, year_month: str, workshop_name: Optional[str] = None
    ) -> list[dict[str, Any]]:
        """生活费发放表：档案标准 + 当月预支，按银行再车间排序。"""
        ym = _parse_ym(year_month)
        q = KuaioaEmployeeProfile.filter(
            tenant_id=tenant_id, deleted_at__isnull=True, status="active"
        )
        if workshop_name:
            q = q.filter(workshop_name=workshop_name.strip())
        employees = await q.order_by("bank_name", "workshop_name", "full_name")
        advances = await KuaioaLivingAdvance.filter(
            tenant_id=tenant_id,
            year_month=ym,
            status="confirmed",
            deleted_at__isnull=True,
        )
        adv_map: dict[int, Decimal] = {}
        for a in advances:
            adv_map[int(a.employee_id)] = adv_map.get(int(a.employee_id), ZERO) + _d(a.amount)

        rows: list[dict[str, Any]] = []
        for emp in employees:
            base = _d(emp.living_allowance)
            adv = adv_map.get(int(emp.id), ZERO)
            payout = base + adv
            if payout <= 0 and not emp.living_allowance:
                continue
            rows.append(
                {
                    "employee_id": emp.id,
                    "employee_code": emp.employee_code,
                    "employee_name": emp.full_name,
                    "bank_name": emp.bank_name,
                    "bank_account": emp.bank_account,
                    "workshop_name": emp.workshop_name,
                    "base_living": base,
                    "advance_amount": adv,
                    "payout_amount": payout,
                    "year_month": ym,
                }
            )
        return rows

    async def _build_lines(self, sheet: KuaioaPayrollSettlement) -> None:
        tenant_id = int(sheet.tenant_id)
        ym = sheet.year_month
        workshop = sheet.workshop_name
        ot_mult = _d(sheet.ot_multiplier) or Decimal("3")

        employees = await KuaioaEmployeeProfile.filter(
            tenant_id=tenant_id,
            deleted_at__isnull=True,
            workshop_name=workshop,
        ).order_by("full_name", "id")

        att_sheets = await KuaioaAttendanceSheet.filter(
            tenant_id=tenant_id,
            year_month=ym,
            workshop_name=workshop,
            status="submitted",
            deleted_at__isnull=True,
        )
        att_ids = [int(s.id) for s in att_sheets]
        hours_by_emp: dict[int, dict[str, Any]] = {}
        if att_ids:
            days = await KuaioaAttendanceDay.filter(
                tenant_id=tenant_id,
                sheet_id__in=att_ids,
                deleted_at__isnull=True,
            )
            for d in days:
                eid = int(d.employee_id)
                bucket = hours_by_emp.setdefault(
                    eid,
                    {
                        "regular": ZERO,
                        "ot": ZERO,
                        "night": 0,
                        "leave_deduct": ZERO,
                    },
                )
                mark = str(d.mark or "normal")
                if mark == "normal":
                    bucket["regular"] += _d(d.regular_hours)
                    bucket["ot"] += _d(d.ot_hours)
                if d.is_night:
                    bucket["night"] += 1
                bucket["leave_deduct"] += _d(d.leave_deduct_amount)

        advances = await KuaioaLivingAdvance.filter(
            tenant_id=tenant_id,
            year_month=ym,
            status="confirmed",
            deleted_at__isnull=True,
        )
        adv_map: dict[int, Decimal] = {}
        for a in advances:
            adv_map[int(a.employee_id)] = adv_map.get(int(a.employee_id), ZERO) + _d(a.amount)

        rewards = await KuaioaRewardRecord.filter(
            tenant_id=tenant_id,
            year_month=ym,
            status="confirmed",
            deleted_at__isnull=True,
        )
        reward_map: dict[int, Decimal] = {}
        for r in rewards:
            reward_map[int(r.employee_id)] = reward_map.get(int(r.employee_id), ZERO) + _d(r.amount)

        piece_by_user = await self._load_piece_by_user(tenant_id, ym)

        post_sub_map: dict[int, Decimal] = {}
        post_rows = await KuaioaPostSubsidy.filter(
            tenant_id=tenant_id,
            year_month=ym,
            deleted_at__isnull=True,
        )
        for ps in post_rows:
            eid = int(ps.employee_id)
            post_sub_map[eid] = post_sub_map.get(eid, ZERO) + _d(ps.amount)

        line_hours_total = ZERO
        line_emp_hours: dict[int, Decimal] = {}
        if _d(sheet.line_total_wage) > 0:
            for eid, bucket in hours_by_emp.items():
                reg = _d(bucket.get("regular"))
                ot = _d(bucket.get("ot"))
                h = reg + ot
                if h > 0:
                    line_emp_hours[eid] = h
                    line_hours_total += h

        for emp in employees:
            if emp.status == "left" and emp.leave_date:
                # 当月仍可能需结算，保留在车间名单中
                pass
            eid = int(emp.id)
            hours = hours_by_emp.get(eid, {})
            regular = _d(hours.get("regular"))
            ot = _d(hours.get("ot"))
            rate = _d(emp.hourly_rate)
            time_wage = ZERO
            if rate > 0 and (regular > 0 or ot > 0):
                time_wage = regular * rate + ot * rate * ot_mult

            piece = ZERO
            if emp.user_id and int(emp.user_id) in piece_by_user:
                piece = piece_by_user[int(emp.user_id)]

            living_base = _d(emp.living_allowance)
            living_adv = adv_map.get(eid, ZERO)
            living_deduct = living_base + living_adv
            insurance = _d(emp.social_insurance) + _d(emp.housing_fund)
            rent_utility_deduct = _d(getattr(emp, "rent_utility", None))
            allowance = reward_map.get(eid, ZERO)
            post_allowance = post_sub_map.get(eid, ZERO)
            leave_deduct = _d(hours.get("leave_deduct"))

            line_bonus = ZERO
            line_wage_share = ZERO
            if _d(sheet.line_total_wage) > 0 and line_hours_total > 0:
                emp_hours = line_emp_hours.get(eid, ZERO)
                if emp_hours > 0:
                    share = emp_hours / line_hours_total
                    line_wage_share = _d(sheet.line_total_wage) * share
                    if _d(sheet.line_total_output) > 0 and _d(sheet.line_bonus_rate) > 0:
                        pool = _d(sheet.line_total_output) * _d(sheet.line_bonus_rate)
                        line_bonus = pool * share
            if line_wage_share > 0 and emp.pay_method == "line":
                time_wage = line_wage_share
            allowance = allowance + line_bonus

            line = KuaioaPayrollSettlementLine(
                tenant_id=tenant_id,
                settlement_id=int(sheet.id),
                employee_id=eid,
                employee_code=emp.employee_code,
                employee_name=emp.full_name,
                bank_name=emp.bank_name,
                bank_account=emp.bank_account,
                basic_wage=ZERO,
                post_wage=_d(emp.post_wage),
                time_wage=time_wage,
                piece_wage=piece,
                night_subsidy=ZERO,
                heat_subsidy=ZERO,
                post_allowance=post_allowance,
                allowance=allowance,
                living_deduct=living_deduct,
                rent_utility_deduct=rent_utility_deduct,
                insurance_deduct=insurance,
                leave_deduct=leave_deduct,
                compensation=ZERO,
                tax_deduct=ZERO,
                card_pay=ZERO,
                regular_hours=regular or None,
                ot_hours=ot or None,
                night_count=int(hours.get("night") or 0) or None,
                hourly_rate=rate or None,
            )
            _recalc_line(line)
            await line.save()

    async def _load_piece_by_user(self, tenant_id: int, year_month: str) -> dict[int, Decimal]:
        """已确认绩效汇总按员工用户 ID 取计件金额（可选）。"""
        try:
            from apps.master_data.models.employee_performance import PerformanceSummary
        except ImportError:
            return {}
        rows = await PerformanceSummary.filter(
            tenant_id=tenant_id,
            status="confirmed",
            period=year_month,
            deleted_at__isnull=True,
        )
        result: dict[int, Decimal] = {}
        for row in rows:
            emp_user_id = getattr(row, "employee_id", None)
            if emp_user_id is None:
                continue
            amount = getattr(row, "piece_amount", None)
            if amount is None:
                amount = getattr(row, "total_amount", None)
            result[int(emp_user_id)] = result.get(int(emp_user_id), ZERO) + _d(amount)
        return result

    async def import_lines(
        self,
        tenant_id: int,
        settlement_id: int,
        data: PayrollLineImportRequest,
        user_id: int,
    ) -> dict[str, Any]:
        sheet = await self._get_header(tenant_id, settlement_id)
        if sheet.status == "confirmed":
            raise BusinessLogicError("已确认结算单不可导入")
        lines = await KuaioaPayrollSettlementLine.filter(
            tenant_id=tenant_id,
            settlement_id=settlement_id,
            deleted_at__isnull=True,
        )
        by_name = {str(l.employee_name).strip(): l for l in lines}
        updated = 0
        for row in data.rows:
            name = row.employee_name.strip()
            line = by_name.get(name)
            if not line:
                raise BusinessLogicError(f"结算单中未找到员工：{name}")
            setattr(line, row.target_field, row.amount)
            _recalc_line(line)
            await touch_updated(line, user_id)
            await line.save()
            updated += 1
        await touch_updated(sheet, user_id)
        await sheet.save()
        return await self.get_settlement(tenant_id, settlement_id)

    async def list_personal_stats(
        self, tenant_id: int, employee_id: int, year: int
    ) -> dict[str, Any]:
        from apps.kuaioa.services.welfare_service import AnnualPayrollStatsService

        rows = await AnnualPayrollStatsService().list_annual_stats(
            tenant_id, year, keyword=None
        )
        for row in rows:
            if int(row["employee_id"]) == employee_id:
                return row
        emp = await _get_employee(tenant_id, employee_id)
        empty: dict[str, Any] = {
            "employee_id": employee_id,
            "employee_code": emp.employee_code,
            "employee_name": emp.full_name,
            "workshop_name": emp.workshop_name,
            "year": year,
            "annual_wage": ZERO,
            "living_total": ZERO,
            "balance_total": ZERO,
            "tax_total": ZERO,
        }
        for m in range(1, 13):
            empty[f"wage_m{m:02d}"] = ZERO
            empty[f"deduct_m{m:02d}"] = ZERO
            empty[f"balance_m{m:02d}"] = ZERO
            empty[f"living_m{m:02d}"] = ZERO
        return empty

    async def _resolve_minimum_wage(
        self, tenant_id: int, year_month: str
    ) -> Optional[Decimal]:
        import calendar
        from datetime import date

        ym = _parse_ym(year_month)
        year = int(ym[:4])
        month = int(ym[5:7])
        last_day = calendar.monthrange(year, month)[1]
        ref = date(year, month, last_day)
        row = (
            await KuaioaMinimumWageConfig.filter(
                tenant_id=tenant_id,
                deleted_at__isnull=True,
                effective_date__lte=ref,
            )
            .order_by("-effective_date")
            .first()
        )
        if not row:
            return None
        return _d(row.amount)

    async def _get_header(self, tenant_id: int, settlement_id: int) -> KuaioaPayrollSettlement:
        row = await KuaioaPayrollSettlement.get_or_none(
            id=settlement_id, tenant_id=tenant_id, deleted_at__isnull=True
        )
        if not row:
            raise NotFoundError("结算单不存在")
        return row
