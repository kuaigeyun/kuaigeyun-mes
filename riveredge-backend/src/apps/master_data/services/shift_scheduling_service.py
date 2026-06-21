"""排班管理服务"""

from __future__ import annotations

from datetime import date, datetime, timedelta
from decimal import Decimal
from typing import Dict, List, Optional, Set, Tuple

from tortoise.transactions import in_transaction

from apps.master_data.models.factory import WorkGroup, WorkGroupMember
from apps.master_data.models.performance import Holiday
from apps.master_data.models.shift_scheduling import Shift, ShiftAssignment, ShiftRoster
from apps.master_data.schemas.shift_scheduling_schemas import (
    ShiftAssignmentResponse,
    ShiftAssignmentsBulkUpdate,
    ShiftCreate,
    ShiftResponse,
    ShiftRosterCreate,
    ShiftRosterResponse,
    ShiftUpdate,
)
from infra.exceptions.exceptions import NotFoundError, ValidationError


def week_bounds(anchor: date) -> Tuple[date, date]:
    """自然周：周一至周日"""
    monday = anchor - timedelta(days=anchor.weekday())
    sunday = monday + timedelta(days=6)
    return monday, sunday


class ShiftSchedulingService:
    # ---------- 班次 ----------

    @staticmethod
    async def create_shift(tenant_id: int, data: ShiftCreate) -> ShiftResponse:
        existing = await Shift.filter(
            tenant_id=tenant_id, code=data.code, deleted_at__isnull=True
        ).first()
        if existing:
            raise ValidationError(f"班次编码 {data.code} 已存在")
        payload = data.model_dump(by_alias=False)
        row = await Shift.create(tenant_id=tenant_id, **payload)
        return ShiftResponse.model_validate(row)

    @staticmethod
    async def list_shifts(
        tenant_id: int,
        skip: int = 0,
        limit: int = 200,
        is_active: Optional[bool] = None,
    ) -> List[ShiftResponse]:
        q = Shift.filter(tenant_id=tenant_id, deleted_at__isnull=True)
        if is_active is not None:
            q = q.filter(is_active=is_active)
        rows = await q.offset(skip).limit(limit).order_by("code")
        return [ShiftResponse.model_validate(r) for r in rows]

    @staticmethod
    async def get_shift_by_uuid(tenant_id: int, shift_uuid: str) -> ShiftResponse:
        row = await Shift.filter(
            tenant_id=tenant_id, uuid=shift_uuid, deleted_at__isnull=True
        ).first()
        if not row:
            raise NotFoundError(f"班次 {shift_uuid} 不存在")
        return ShiftResponse.model_validate(row)

    @staticmethod
    async def update_shift(
        tenant_id: int, shift_uuid: str, data: ShiftUpdate
    ) -> ShiftResponse:
        row = await Shift.filter(
            tenant_id=tenant_id, uuid=shift_uuid, deleted_at__isnull=True
        ).first()
        if not row:
            raise NotFoundError(f"班次 {shift_uuid} 不存在")
        updates = data.model_dump(by_alias=False, exclude_unset=True)
        if "code" in updates and updates["code"] != row.code:
            dup = await Shift.filter(
                tenant_id=tenant_id,
                code=updates["code"],
                deleted_at__isnull=True,
            ).exclude(id=row.id).first()
            if dup:
                raise ValidationError(f"班次编码 {updates['code']} 已存在")
        for k, v in updates.items():
            setattr(row, k, v)
        await row.save()
        return ShiftResponse.model_validate(row)

    @staticmethod
    async def delete_shift(tenant_id: int, shift_uuid: str) -> None:
        row = await Shift.filter(
            tenant_id=tenant_id, uuid=shift_uuid, deleted_at__isnull=True
        ).first()
        if not row:
            raise NotFoundError(f"班次 {shift_uuid} 不存在")
        row.deleted_at = datetime.now()
        await row.save()

    # ---------- 排班周期 ----------

    @staticmethod
    async def _get_work_group(tenant_id: int, work_group_id: int) -> WorkGroup:
        wg = await WorkGroup.filter(
            tenant_id=tenant_id, id=work_group_id, deleted_at__isnull=True
        ).first()
        if not wg:
            raise NotFoundError(f"工作小组 {work_group_id} 不存在")
        return wg

    @staticmethod
    async def _get_employee(tenant_id: int, employee_id: int):
        from infra.models.user import User

        user = await User.filter(id=employee_id, tenant_id=tenant_id, deleted_at__isnull=True).first()
        if not user:
            raise NotFoundError(f"员工 {employee_id} 不存在")
        return user

    @staticmethod
    async def _member_employee_ids(tenant_id: int, work_group_id: int) -> Set[int]:
        rows = await WorkGroupMember.filter(
            tenant_id=tenant_id,
            work_group_id=work_group_id,
            deleted_at__isnull=True,
        ).all()
        return {r.employee_id for r in rows}

    @staticmethod
    async def _allowed_employee_ids(tenant_id: int, roster: ShiftRoster) -> Set[int]:
        if roster.scope_type == "employee":
            if not roster.employee_id:
                raise ValidationError("员工排班表缺少 employee_id")
            return {roster.employee_id}
        if not roster.work_group_id:
            raise ValidationError("工作小组排班表缺少 work_group_id")
        return await ShiftSchedulingService._member_employee_ids(tenant_id, roster.work_group_id)

    @staticmethod
    async def _roster_lookup_filter(
        tenant_id: int,
        *,
        scope_type: str,
        period_start: date,
        work_group_id: Optional[int] = None,
        employee_id: Optional[int] = None,
    ):
        ps, _ = week_bounds(period_start)
        q = ShiftRoster.filter(
            tenant_id=tenant_id,
            scope_type=scope_type,
            period_start=ps,
            deleted_at__isnull=True,
        )
        if scope_type == "work_group":
            return q.filter(work_group_id=work_group_id)
        return q.filter(employee_id=employee_id)

    @staticmethod
    async def _roster_to_response(
        roster: ShiftRoster, include_assignments: bool = False
    ) -> ShiftRosterResponse:
        assignments: List[ShiftAssignmentResponse] = []
        if include_assignments:
            shift_map: Dict[int, Shift] = {}
            rows = await ShiftAssignment.filter(
                roster_id=roster.id, deleted_at__isnull=True
            ).order_by("employee_id", "work_date")
            shift_ids = {r.shift_id for r in rows if r.shift_id}
            if shift_ids:
                shifts = await Shift.filter(id__in=list(shift_ids)).all()
                shift_map = {s.id: s for s in shifts}
            for a in rows:
                sh = shift_map.get(a.shift_id) if a.shift_id else None
                assignments.append(
                    ShiftAssignmentResponse(
                        id=a.id,
                        employee_id=a.employee_id,
                        employee_name=a.employee_name,
                        work_date=a.work_date,
                        shift_id=a.shift_id,
                        shift_code=sh.code if sh else None,
                        shift_name=sh.name if sh else None,
                    )
                )
        return ShiftRosterResponse(
            id=roster.id,
            uuid=roster.uuid,
            tenant_id=roster.tenant_id,
            scope_type=roster.scope_type or "work_group",
            work_group_id=roster.work_group_id,
            work_group_code=roster.work_group_code,
            work_group_name=roster.work_group_name,
            employee_id=roster.employee_id,
            employee_name=roster.employee_name,
            period_start=roster.period_start,
            period_end=roster.period_end,
            status=roster.status,
            published_at=roster.published_at,
            remarks=roster.remarks,
            assignments=assignments,
            created_at=roster.created_at,
            updated_at=roster.updated_at,
        )

    @staticmethod
    async def create_roster(tenant_id: int, data: ShiftRosterCreate) -> ShiftRosterResponse:
        period_start, period_end = week_bounds(data.period_start)
        existing_q = await ShiftSchedulingService._roster_lookup_filter(
            tenant_id,
            scope_type=data.scope_type,
            period_start=period_start,
            work_group_id=data.work_group_id,
            employee_id=data.employee_id,
        )
        existing = await existing_q.first()
        if existing:
            if data.scope_type == "employee":
                raise ValidationError(
                    f"员工 {data.employee_id} 在 {period_start} 周已有排班表，请直接编辑"
                )
            raise ValidationError(
                f"工作小组在 {period_start} 周已有排班表，请直接编辑"
            )

        roster_kwargs = {
            "tenant_id": tenant_id,
            "scope_type": data.scope_type,
            "period_start": period_start,
            "period_end": period_end,
            "status": "draft",
            "remarks": data.remarks,
        }
        if data.scope_type == "work_group":
            wg = await ShiftSchedulingService._get_work_group(tenant_id, data.work_group_id)
            roster_kwargs.update(
                {
                    "work_group_id": wg.id,
                    "work_group_code": wg.code,
                    "work_group_name": wg.name,
                }
            )
        else:
            user = await ShiftSchedulingService._get_employee(tenant_id, data.employee_id)
            roster_kwargs.update(
                {
                    "employee_id": user.id,
                    "employee_name": user.full_name or user.username,
                }
            )
        roster = await ShiftRoster.create(**roster_kwargs)
        return await ShiftSchedulingService._roster_to_response(roster, include_assignments=True)

    @staticmethod
    async def list_rosters(
        tenant_id: int,
        work_group_id: Optional[int] = None,
        employee_id: Optional[int] = None,
        period_start: Optional[date] = None,
        status: Optional[str] = None,
        skip: int = 0,
        limit: int = 50,
    ) -> List[ShiftRosterResponse]:
        q = ShiftRoster.filter(tenant_id=tenant_id, deleted_at__isnull=True)
        if work_group_id is not None:
            q = q.filter(scope_type="work_group", work_group_id=work_group_id)
        if employee_id is not None:
            q = q.filter(scope_type="employee", employee_id=employee_id)
        if period_start is not None:
            ps, _ = week_bounds(period_start)
            q = q.filter(period_start=ps)
        if status:
            q = q.filter(status=status)
        rows = await q.offset(skip).limit(limit).order_by("-period_start")
        return [await ShiftSchedulingService._roster_to_response(r) for r in rows]

    @staticmethod
    async def get_roster_by_uuid(
        tenant_id: int, roster_uuid: str, *, include_assignments: bool = True
    ) -> ShiftRosterResponse:
        roster = await ShiftRoster.filter(
            tenant_id=tenant_id, uuid=roster_uuid, deleted_at__isnull=True
        ).first()
        if not roster:
            raise NotFoundError(f"排班表 {roster_uuid} 不存在")
        return await ShiftSchedulingService._roster_to_response(
            roster, include_assignments=include_assignments
        )

    @staticmethod
    async def get_or_create_roster_for_week(
        tenant_id: int,
        period_start: date,
        *,
        work_group_id: Optional[int] = None,
        employee_id: Optional[int] = None,
    ) -> ShiftRosterResponse:
        if bool(work_group_id) == bool(employee_id):
            raise ValidationError("须且仅能指定 workGroupId 或 employeeId 之一")

        scope_type = "employee" if employee_id else "work_group"
        ps, _ = week_bounds(period_start)
        roster = await ShiftSchedulingService._roster_lookup_filter(
            tenant_id,
            scope_type=scope_type,
            period_start=ps,
            work_group_id=work_group_id,
            employee_id=employee_id,
        ).first()
        if roster:
            return await ShiftSchedulingService._roster_to_response(
                roster, include_assignments=True
            )
        return await ShiftSchedulingService.create_roster(
            tenant_id,
            ShiftRosterCreate(
                scope_type=scope_type,
                work_group_id=work_group_id,
                employee_id=employee_id,
                period_start=ps,
            ),
        )

    @staticmethod
    async def save_assignments(
        tenant_id: int, roster_uuid: str, data: ShiftAssignmentsBulkUpdate
    ) -> ShiftRosterResponse:
        roster = await ShiftRoster.filter(
            tenant_id=tenant_id, uuid=roster_uuid, deleted_at__isnull=True
        ).first()
        if not roster:
            raise NotFoundError(f"排班表 {roster_uuid} 不存在")
        if roster.status != "draft":
            raise ValidationError("仅草稿状态可修改排班明细")

        allowed = await ShiftSchedulingService._allowed_employee_ids(tenant_id, roster)
        shift_ids_valid: Set[int] = set()
        if data.assignments:
            sids = {a.shift_id for a in data.assignments if a.shift_id}
            if sids:
                rows = await Shift.filter(
                    tenant_id=tenant_id, id__in=list(sids), deleted_at__isnull=True
                ).all()
                shift_ids_valid = {r.id for r in rows}
                if shift_ids_valid != sids:
                    raise ValidationError("存在无效班次")

        from infra.models.user import User

        async with in_transaction():
            await ShiftAssignment.filter(roster_id=roster.id).update(deleted_at=datetime.now())
            for item in data.assignments:
                if item.employee_id not in allowed:
                    if roster.scope_type == "employee":
                        raise ValidationError(f"员工 {item.employee_id} 与当前排班表不匹配")
                    raise ValidationError(f"员工 {item.employee_id} 不属于该工作小组")
                if item.work_date < roster.period_start or item.work_date > roster.period_end:
                    raise ValidationError(f"日期 {item.work_date} 不在排班周期内")
                if item.shift_id is not None and item.shift_id not in shift_ids_valid:
                    raise ValidationError(f"班次 {item.shift_id} 无效")
                user = await User.filter(id=item.employee_id, tenant_id=tenant_id).first()
                await ShiftAssignment.create(
                    tenant_id=tenant_id,
                    roster_id=roster.id,
                    employee_id=item.employee_id,
                    employee_name=user.full_name if user and user.full_name else None,
                    work_date=item.work_date,
                    shift_id=item.shift_id,
                )
        return await ShiftSchedulingService.get_roster_by_uuid(tenant_id, roster_uuid)

    @staticmethod
    async def _validate_publish_conflicts(
        tenant_id: int, roster: ShiftRoster
    ) -> None:
        assignments = await ShiftAssignment.filter(
            roster_id=roster.id,
            deleted_at__isnull=True,
            shift_id__isnull=False,
        ).all()
        for a in assignments:
            other_rosters = await ShiftRoster.filter(
                tenant_id=tenant_id,
                status="published",
                deleted_at__isnull=True,
                period_start__lte=a.work_date,
                period_end__gte=a.work_date,
            ).exclude(id=roster.id)
            other_ids = [r.id for r in await other_rosters]
            if not other_ids:
                continue
            conflict = await ShiftAssignment.filter(
                tenant_id=tenant_id,
                roster_id__in=other_ids,
                employee_id=a.employee_id,
                work_date=a.work_date,
                shift_id__isnull=False,
                deleted_at__isnull=True,
            ).first()
            if conflict:
                raise ValidationError(
                    f"员工 {a.employee_name or a.employee_id} 在 {a.work_date} "
                    f"已有其他已发布排班，无法发布"
                )

    @staticmethod
    async def publish_roster(tenant_id: int, roster_uuid: str) -> ShiftRosterResponse:
        roster = await ShiftRoster.filter(
            tenant_id=tenant_id, uuid=roster_uuid, deleted_at__isnull=True
        ).first()
        if not roster:
            raise NotFoundError(f"排班表 {roster_uuid} 不存在")
        if roster.status == "published":
            raise ValidationError("排班表已发布")
        await ShiftSchedulingService._validate_publish_conflicts(tenant_id, roster)
        roster.status = "published"
        roster.published_at = datetime.now()
        await roster.save()
        return await ShiftSchedulingService.get_roster_by_uuid(tenant_id, roster_uuid)

    @staticmethod
    async def copy_from_previous_week(
        tenant_id: int, roster_uuid: str
    ) -> ShiftRosterResponse:
        roster = await ShiftRoster.filter(
            tenant_id=tenant_id, uuid=roster_uuid, deleted_at__isnull=True
        ).first()
        if not roster:
            raise NotFoundError(f"排班表 {roster_uuid} 不存在")
        if roster.status != "draft":
            raise ValidationError("仅草稿状态可复制排班")

        prev_start = roster.period_start - timedelta(days=7)
        prev_q = ShiftRoster.filter(
            tenant_id=tenant_id,
            scope_type=roster.scope_type,
            period_start=prev_start,
            deleted_at__isnull=True,
        )
        if roster.scope_type == "employee":
            prev_q = prev_q.filter(employee_id=roster.employee_id)
        else:
            prev_q = prev_q.filter(work_group_id=roster.work_group_id)
        prev = await prev_q.first()
        if not prev:
            raise NotFoundError("上一周无排班表可复制")

        prev_assignments = await ShiftAssignment.filter(
            roster_id=prev.id, deleted_at__isnull=True
        ).all()
        items = []
        for a in prev_assignments:
            new_date = a.work_date + timedelta(days=7)
            if new_date < roster.period_start or new_date > roster.period_end:
                continue
            items.append(
                {
                    "employee_id": a.employee_id,
                    "work_date": new_date,
                    "shift_id": a.shift_id,
                }
            )
        from apps.master_data.schemas.shift_scheduling_schemas import ShiftAssignmentItem

        bulk = ShiftAssignmentsBulkUpdate(
            assignments=[ShiftAssignmentItem(**i) for i in items]
        )
        return await ShiftSchedulingService.save_assignments(tenant_id, roster_uuid, bulk)

    @staticmethod
    async def count_scheduled_workdays_for_employee(
        tenant_id: int, employee_id: int, start: date, end: date
    ) -> Optional[int]:
        """
        统计周期内应出勤天数（已发布排班且 shift_id 非空）。
        若周期内该员工无任何已发布排班记录，返回 None（沿用原 KPI 逻辑）。
        """
        published_rosters = await ShiftRoster.filter(
            tenant_id=tenant_id,
            status="published",
            deleted_at__isnull=True,
            period_start__lte=end,
            period_end__gte=start,
        ).all()
        if not published_rosters:
            return None
        roster_ids = [r.id for r in published_rosters]
        rows = await ShiftAssignment.filter(
            tenant_id=tenant_id,
            roster_id__in=roster_ids,
            employee_id=employee_id,
            work_date__gte=start,
            work_date__lte=end,
            shift_id__isnull=False,
            deleted_at__isnull=True,
        ).all()
        if not rows:
            has_any = await ShiftAssignment.filter(
                tenant_id=tenant_id,
                roster_id__in=roster_ids,
                employee_id=employee_id,
                work_date__gte=start,
                work_date__lte=end,
                deleted_at__isnull=True,
            ).exists()
            if not has_any:
                return None
        days = {r.work_date for r in rows}
        holiday_rows = await Holiday.filter(
            tenant_id=tenant_id,
            holiday_date__gte=start,
            holiday_date__lte=end,
            is_active=True,
            deleted_at__isnull=True,
        ).all()
        holiday_dates = {
            h.holiday_date for h in holiday_rows if h.holiday_date.weekday() < 5
        }
        return len([d for d in days if d not in holiday_dates])
