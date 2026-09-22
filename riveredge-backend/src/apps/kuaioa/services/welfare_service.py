"""节日福利发放与年度工资统计。"""

from __future__ import annotations

from decimal import Decimal
from typing import Any, Optional

from apps.kuaioa.models.employee import KuaioaEmployeeProfile
from apps.kuaioa.models.payroll import KuaioaPayrollSettlement, KuaioaPayrollSettlementLine
from apps.kuaioa.models.welfare import KuaioaWelfareBatch, KuaioaWelfareBatchLine
from apps.kuaioa.schemas.welfare import (
    WelfareBatchCreate,
    WelfareBatchLineUpdate,
    WelfareBatchUpdate,
)
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

FESTIVAL_TYPES = ("dragon_boat", "mid_autumn", "spring_festival")

FESTIVAL_FIELD_MAP = {
    "dragon_boat": "welfare_dragon_boat",
    "mid_autumn": "welfare_mid_autumn",
    "spring_festival": "welfare_spring_festival",
}


def _d(value: Any) -> Decimal:
    if value is None:
        return ZERO
    return Decimal(str(value))


def _parse_year(year: int) -> int:
    if year < 2000 or year > 2100:
        raise BusinessLogicError("年份无效")
    return year


def _normalize_festival(festival_type: str) -> str:
    key = (festival_type or "").strip()
    if key not in FESTIVAL_TYPES:
        raise BusinessLogicError("节日类型无效")
    return key


class WelfareBatchService:
    async def list_batches(
        self,
        tenant_id: int,
        *,
        keyword: Optional[str] = None,
        year: Optional[int] = None,
        festival_type: Optional[str] = None,
        workshop_name: Optional[str] = None,
        status: Optional[str] = None,
    ) -> list[dict[str, Any]]:
        q = KuaioaWelfareBatch.filter(tenant_id=tenant_id, deleted_at__isnull=True)
        if year is not None:
            q = q.filter(year=int(year))
        if festival_type:
            q = q.filter(festival_type=_normalize_festival(festival_type))
        if workshop_name:
            q = q.filter(workshop_name=workshop_name.strip())
        if status:
            q = q.filter(status=status)
        if keyword:
            q = q.filter(build_keyword_q(keyword, "batch_code", "workshop_name"))
        rows = await q.order_by("-year", "-id")
        return [model_to_dict(r) for r in rows]

    async def get_batch(self, tenant_id: int, batch_id: int) -> dict[str, Any]:
        batch = await self._get_header(tenant_id, batch_id)
        item = model_to_dict(batch)
        lines = await KuaioaWelfareBatchLine.filter(
            tenant_id=tenant_id, batch_id=batch_id, deleted_at__isnull=True
        ).order_by("employee_name", "id")
        item["lines"] = [model_to_dict(l) for l in lines]
        item["amount_total"] = sum((_d(l.amount) for l in lines), ZERO)
        item["line_count"] = len(lines)
        return item

    async def create_batch(
        self, tenant_id: int, data: WelfareBatchCreate, user_id: int
    ) -> dict[str, Any]:
        year = _parse_year(int(data.year))
        festival = _normalize_festival(data.festival_type)
        workshop = (data.workshop_name or "").strip()
        if not workshop:
            raise BusinessLogicError("车间不能为空")

        exists = await KuaioaWelfareBatch.filter(
            tenant_id=tenant_id,
            deleted_at__isnull=True,
            year=year,
            festival_type=festival,
            workshop_name=workshop,
        ).exists()
        if exists:
            raise BusinessLogicError("该车间本节日福利发放单已存在")

        code = await generate_daily_code(
            KuaioaWelfareBatch, tenant_id, "WLF", code_field="batch_code"
        )
        payload: dict[str, Any] = {
            "tenant_id": tenant_id,
            "batch_code": code,
            "year": year,
            "festival_type": festival,
            "workshop_name": workshop,
            "status": "draft",
            "notes": data.notes,
        }
        await apply_create_audit_by_user_id(payload, user_id)
        batch = await KuaioaWelfareBatch.create(**payload)
        await self._build_lines(batch)
        return await self.get_batch(tenant_id, int(batch.id))

    async def rebuild_lines(
        self, tenant_id: int, batch_id: int, user_id: int
    ) -> dict[str, Any]:
        batch = await self._get_header(tenant_id, batch_id)
        if batch.status == "confirmed":
            raise BusinessLogicError("已确认发放单不可重建明细")
        await KuaioaWelfareBatchLine.filter(
            tenant_id=tenant_id, batch_id=batch_id, deleted_at__isnull=True
        ).update(deleted_at=resolve_business_datetime())
        await self._build_lines(batch)
        await touch_updated(batch, user_id)
        await batch.save()
        return await self.get_batch(tenant_id, batch_id)

    async def update_batch(
        self, tenant_id: int, batch_id: int, data: WelfareBatchUpdate, user_id: int
    ) -> dict[str, Any]:
        batch = await self._get_header(tenant_id, batch_id)
        if batch.status == "confirmed":
            raise BusinessLogicError("已确认发放单不可修改")
        payload = data.model_dump(exclude_unset=True)
        for k, v in payload.items():
            setattr(batch, k, v)
        await touch_updated(batch, user_id)
        await batch.save()
        return await self.get_batch(tenant_id, batch_id)

    async def update_line(
        self,
        tenant_id: int,
        batch_id: int,
        line_id: int,
        data: WelfareBatchLineUpdate,
        user_id: int,
    ) -> dict[str, Any]:
        batch = await self._get_header(tenant_id, batch_id)
        line = await KuaioaWelfareBatchLine.get_or_none(
            id=line_id,
            tenant_id=tenant_id,
            batch_id=batch_id,
            deleted_at__isnull=True,
        )
        if not line:
            raise NotFoundError("福利发放行不存在")
        payload = data.model_dump(exclude_unset=True)
        if batch.status == "confirmed":
            # 确认后仅允许勾选领取；金额不可再改
            allowed = {k: v for k, v in payload.items() if k in ("received", "notes")}
            if set(payload.keys()) - set(allowed.keys()):
                raise BusinessLogicError("已确认发放单不可改金额")
            payload = allowed
        if "amount" in payload and _d(payload["amount"]) < 0:
            raise BusinessLogicError("金额不能为负")
        for k, v in payload.items():
            setattr(line, k, v)
        await touch_updated(line, user_id)
        await line.save()
        await touch_updated(batch, user_id)
        await batch.save()
        return model_to_dict(line)

    async def confirm(self, tenant_id: int, batch_id: int, user: User) -> dict[str, Any]:
        batch = await self._get_header(tenant_id, batch_id)
        if batch.status == "confirmed":
            raise BusinessLogicError("发放单已确认")
        batch.status = "confirmed"
        batch.confirmed_at = resolve_business_datetime()
        batch.confirmed_by = user.id
        batch.confirmed_by_name = user.full_name or user.username
        await touch_updated(batch, user.id)
        await batch.save()
        return await self.get_batch(tenant_id, batch_id)

    async def reopen(self, tenant_id: int, batch_id: int, user_id: int) -> dict[str, Any]:
        batch = await self._get_header(tenant_id, batch_id)
        if batch.status != "confirmed":
            raise BusinessLogicError("仅已确认发放单可重新打开")
        batch.status = "draft"
        batch.confirmed_at = None
        batch.confirmed_by = None
        batch.confirmed_by_name = None
        await touch_updated(batch, user_id)
        await batch.save()
        return await self.get_batch(tenant_id, batch_id)

    async def delete_batch(self, tenant_id: int, batch_id: int, user_id: int) -> None:
        batch = await self._get_header(tenant_id, batch_id)
        if batch.status == "confirmed":
            raise BusinessLogicError("已确认发放单不可删除")
        batch.deleted_at = resolve_business_datetime()
        await touch_updated(batch, user_id)
        await batch.save()
        await KuaioaWelfareBatchLine.filter(
            tenant_id=tenant_id, batch_id=batch_id, deleted_at__isnull=True
        ).update(deleted_at=resolve_business_datetime())

    async def _build_lines(self, batch: KuaioaWelfareBatch) -> None:
        tenant_id = int(batch.tenant_id)
        field = FESTIVAL_FIELD_MAP[str(batch.festival_type)]
        employees = await KuaioaEmployeeProfile.filter(
            tenant_id=tenant_id,
            deleted_at__isnull=True,
            status="active",
            workshop_name=batch.workshop_name,
        ).order_by("full_name", "id")
        for emp in employees:
            standard = _d(getattr(emp, field, None))
            line = KuaioaWelfareBatchLine(
                tenant_id=tenant_id,
                batch_id=int(batch.id),
                employee_id=int(emp.id),
                employee_code=emp.employee_code,
                employee_name=emp.full_name,
                workshop_name=emp.workshop_name,
                standard_amount=standard if standard > 0 else None,
                amount=standard,
                received=False,
            )
            await line.save()

    async def _get_header(self, tenant_id: int, batch_id: int) -> KuaioaWelfareBatch:
        row = await KuaioaWelfareBatch.get_or_none(
            id=batch_id, tenant_id=tenant_id, deleted_at__isnull=True
        )
        if not row:
            raise NotFoundError("福利发放单不存在")
        return row


class AnnualPayrollStatsService:
    """年度工资统计：仅汇总已确认结算行，禁止读侧补齐。"""

    async def list_annual_stats(
        self,
        tenant_id: int,
        year: int,
        *,
        workshop_name: Optional[str] = None,
        keyword: Optional[str] = None,
    ) -> list[dict[str, Any]]:
        y = _parse_year(int(year))
        prefix = f"{y}-"
        q = KuaioaPayrollSettlement.filter(
            tenant_id=tenant_id,
            deleted_at__isnull=True,
            status="confirmed",
            year_month__startswith=prefix,
        )
        if workshop_name:
            q = q.filter(workshop_name=workshop_name.strip())
        settlements = await q
        if not settlements:
            return []

        settlement_ids = [int(s.id) for s in settlements]
        ym_by_sid = {int(s.id): str(s.year_month) for s in settlements}
        workshop_by_sid = {int(s.id): s.workshop_name for s in settlements}
        lines = await KuaioaPayrollSettlementLine.filter(
            tenant_id=tenant_id,
            settlement_id__in=settlement_ids,
            deleted_at__isnull=True,
        )

        buckets: dict[int, dict[str, Any]] = {}
        for line in lines:
            eid = int(line.employee_id)
            sid = int(line.settlement_id)
            ym = ym_by_sid.get(sid, "")
            if len(ym) != 7:
                continue
            month = int(ym[5:7])
            if month < 1 or month > 12:
                continue
            bucket = buckets.setdefault(
                eid,
                {
                    "employee_id": eid,
                    "employee_code": line.employee_code,
                    "employee_name": line.employee_name,
                    "workshop_name": workshop_by_sid.get(sid),
                    "year": y,
                    "wage_months": [ZERO] * 12,
                    "deduct_months": [ZERO] * 12,
                    "balance_months": [ZERO] * 12,
                    "living_months": [ZERO] * 12,
                    "insurance_months": [ZERO] * 12,
                    "rent_utility_total": ZERO,
                    "tax_total": ZERO,
                },
            )
            if line.employee_name:
                bucket["employee_name"] = line.employee_name
            if line.employee_code:
                bucket["employee_code"] = line.employee_code
            if not bucket.get("workshop_name"):
                bucket["workshop_name"] = workshop_by_sid.get(sid)
            bucket["wage_months"][month - 1] += _d(line.earning_subtotal)
            bucket["deduct_months"][month - 1] += _d(line.deduct_subtotal)
            bucket["balance_months"][month - 1] += _d(line.balance)
            bucket["living_months"][month - 1] += _d(line.living_deduct)
            bucket["insurance_months"][month - 1] += _d(line.insurance_deduct)
            bucket["rent_utility_total"] += _d(getattr(line, "rent_utility_deduct", None))
            bucket["tax_total"] += _d(line.tax_deduct)

        emp_ids = list(buckets.keys())
        if emp_ids:
            profiles = await KuaioaEmployeeProfile.filter(
                tenant_id=tenant_id, id__in=emp_ids, deleted_at__isnull=True
            )
            for emp in profiles:
                b = buckets.get(int(emp.id))
                if not b:
                    continue
                if emp.workshop_name:
                    b["workshop_name"] = emp.workshop_name
                b["employee_name"] = emp.full_name
                b["employee_code"] = emp.employee_code

        rows: list[dict[str, Any]] = []
        kw = (keyword or "").strip().lower()
        for eid, b in buckets.items():
            if kw:
                name = str(b.get("employee_name") or "").lower()
                code = str(b.get("employee_code") or "").lower()
                if kw not in name and kw not in code:
                    continue
            wages = b["wage_months"]
            deducts = b["deduct_months"]
            balances = b["balance_months"]
            livings = b["living_months"]
            insurances = b["insurance_months"]
            annual = sum(wages, ZERO)
            living_total = sum(livings, ZERO)
            insurance_total = sum(insurances, ZERO)
            balance_total = sum(balances, ZERO)
            item: dict[str, Any] = {
                "employee_id": eid,
                "employee_code": b.get("employee_code"),
                "employee_name": b.get("employee_name"),
                "workshop_name": b.get("workshop_name"),
                "year": y,
                "annual_wage": annual,
                "living_total": living_total,
                "balance_total": balance_total,
                "tax_total": b["tax_total"],
                "rent_utility": b["rent_utility_total"],
                "insurance_total": insurance_total,
            }
            for i in range(12):
                m = i + 1
                item[f"wage_m{m:02d}"] = wages[i]
                item[f"deduct_m{m:02d}"] = deducts[i]
                item[f"balance_m{m:02d}"] = balances[i]
                item[f"living_m{m:02d}"] = livings[i]
                item[f"insurance_m{m:02d}"] = insurances[i]
            rows.append(item)

        rows.sort(
            key=lambda r: (str(r.get("workshop_name") or ""), str(r.get("employee_name") or ""))
        )
        return rows
