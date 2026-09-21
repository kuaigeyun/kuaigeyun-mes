"""供应商评价计划与周期汇总（R-03 补齐）。

计划覆盖主数据供应商清单，按周期生成评价草稿；
同供应商+同周期若已有未删除评价则跳过，禁止重复开单。
汇总只读评价单真源，不读主数据运营评级。
"""

from __future__ import annotations

from decimal import Decimal
from typing import Dict, List, Optional, Sequence

from tortoise.expressions import Q

from apps.common.audit_actor import apply_create_audit, apply_update_audit
from apps.common.base_service import AppBaseService
from apps.kuaizhizao.constants.supplier_eval import (
    PERIOD_QUARTERLY,
    PLAN_STATUS_CLOSED,
    PLAN_STATUS_DRAFT,
    PLAN_STATUS_RELEASED,
    RECT_OPEN,
    STATUS_APPROVED,
    STATUS_REVOKED,
    SUPPLIER_EVAL_AUDIT_DEFAULT,
    SUPPLIER_EVAL_AUDIT_MODES,
    SUPPLIER_EVAL_PERIOD_DEFAULT,
    SUPPLIER_EVAL_PERIOD_TYPES,
)
from apps.kuaizhizao.models.supplier_evaluation import (
    SupplierEvalPlan,
    SupplierEvalPlanLine,
    SupplierEvalTemplate,
    SupplierEvaluation,
)
from apps.kuaizhizao.schemas.supplier_evaluation import (
    SupplierEvalPlanCreate,
    SupplierEvalPlanGenerateResult,
    SupplierEvalPlanLineInput,
    SupplierEvalPlanLineResponse,
    SupplierEvalPlanListItem,
    SupplierEvalPlanListResponse,
    SupplierEvalPlanResponse,
    SupplierEvalPlanUpdate,
    SupplierEvalSummaryResponse,
    SupplierEvaluationCreate,
)
from apps.kuaizhizao.services.supplier_evaluation_service import SupplierEvaluationService
from apps.master_data.models.supplier import Supplier
from core.utils.timezone_utils import resolve_business_datetime
from infra.exceptions.exceptions import BusinessLogicError, NotFoundError, ValidationError
from infra.models.user import User


class SupplierEvalPlanService(AppBaseService[SupplierEvalPlan]):
    code_field = "code"
    rule_code = "SUPPLIER_EVAL_PLAN_CODE"
    code_prefix = "SEP"

    def __init__(self) -> None:
        super().__init__(SupplierEvalPlan)
        self.model = SupplierEvalPlan
        self.eval_service = SupplierEvaluationService()

    async def _ensure_code(self, tenant_id: int, code: Optional[str]) -> str:
        raw = (code or "").strip()
        if raw:
            return raw
        return await self.generate_code(tenant_id, self.rule_code, prefix=self.code_prefix)

    def _validate_period(
        self, period_type: str, period_year: int, period_quarter: Optional[int]
    ) -> tuple[str, int, Optional[int]]:
        pt = (period_type or SUPPLIER_EVAL_PERIOD_DEFAULT).strip().lower()
        if pt not in SUPPLIER_EVAL_PERIOD_TYPES:
            raise ValidationError(f"非法评价周期类型: {period_type}")
        year = int(period_year)
        if year < 2000 or year > 2100:
            raise ValidationError(f"非法评价年度: {period_year}")
        if pt == PERIOD_QUARTERLY:
            if period_quarter is None:
                raise ValidationError("季评计划须填写季度")
            q = int(period_quarter)
            if q not in (1, 2, 3, 4):
                raise ValidationError(f"非法季度: {period_quarter}")
            return pt, year, q
        return pt, year, None

    def _validate_audit_mode(self, audit_mode: str) -> str:
        mode = (audit_mode or SUPPLIER_EVAL_AUDIT_DEFAULT).strip().lower()
        if mode not in SUPPLIER_EVAL_AUDIT_MODES:
            raise ValidationError(f"非法审核方式: {audit_mode}")
        return mode

    async def _get_row(self, tenant_id: int, plan_id: int) -> SupplierEvalPlan:
        row = await SupplierEvalPlan.filter(
            tenant_id=tenant_id, id=plan_id, deleted_at__isnull=True
        ).first()
        if not row:
            raise NotFoundError("评价计划不存在")
        return row

    async def _resolve_template(
        self, tenant_id: int, template_id: int
    ) -> SupplierEvalTemplate:
        tpl = await SupplierEvalTemplate.filter(
            tenant_id=tenant_id, id=template_id, deleted_at__isnull=True
        ).first()
        if not tpl:
            raise NotFoundError("评价模板不存在")
        if not tpl.is_active:
            raise ValidationError("评价模板未启用")
        return tpl

    async def _resolve_supplier(
        self, tenant_id: int, supplier_id: int
    ) -> tuple[int, Optional[str], Optional[str]]:
        row = await Supplier.filter(
            tenant_id=tenant_id, id=supplier_id, deleted_at__isnull=True
        ).first()
        if not row:
            raise NotFoundError(f"供应商不存在: {supplier_id}")
        return row.id, row.code, row.name

    async def _list_lines(
        self, tenant_id: int, plan_id: int
    ) -> List[SupplierEvalPlanLine]:
        return (
            await SupplierEvalPlanLine.filter(
                tenant_id=tenant_id, plan_id=plan_id, deleted_at__isnull=True
            )
            .order_by("line_no", "id")
            .all()
        )

    async def _replace_lines(
        self,
        tenant_id: int,
        plan_id: int,
        lines: Sequence[SupplierEvalPlanLineInput],
        user: User,
    ) -> None:
        if not lines:
            raise ValidationError("评价计划至少需要一个供应商")
        seen = set()
        normalized: List[tuple[int, int, Optional[str], Optional[str], Optional[str]]] = []
        for idx, raw in enumerate(lines, start=1):
            sid = int(raw.supplier_id)
            if sid in seen:
                raise ValidationError(f"计划供应商重复: {sid}")
            seen.add(sid)
            sid, scode, sname = await self._resolve_supplier(tenant_id, sid)
            normalized.append(
                (raw.line_no or idx, sid, scode, sname, raw.remarks)
            )
        now = resolve_business_datetime()
        existing = await SupplierEvalPlanLine.filter(
            tenant_id=tenant_id, plan_id=plan_id, deleted_at__isnull=True
        ).all()
        for row in existing:
            row.deleted_at = now
            apply_update_audit(row, user)
            await row.save()
        for line_no, sid, scode, sname, remarks in normalized:
            row = SupplierEvalPlanLine(
                tenant_id=tenant_id,
                plan_id=plan_id,
                line_no=line_no,
                supplier_id=sid,
                supplier_code=scode,
                supplier_name=sname,
                remarks=remarks,
            )
            apply_create_audit(row, user)
            await row.save()

    async def _match_evaluation(
        self,
        tenant_id: int,
        *,
        supplier_id: int,
        period_type: str,
        period_year: int,
        period_quarter: Optional[int],
    ) -> Optional[SupplierEvaluation]:
        query = SupplierEvaluation.filter(
            tenant_id=tenant_id,
            supplier_id=supplier_id,
            period_type=period_type,
            period_year=period_year,
            deleted_at__isnull=True,
        ).exclude(status=STATUS_REVOKED)
        if period_quarter is None:
            query = query.filter(period_quarter__isnull=True)
        else:
            query = query.filter(period_quarter=period_quarter)
        return await query.order_by("-id").first()

    async def _counts(
        self, tenant_id: int, plan: SupplierEvalPlan, lines: Sequence[SupplierEvalPlanLine]
    ) -> tuple[int, int]:
        generated = 0
        for line in lines:
            matched = await self._match_evaluation(
                tenant_id,
                supplier_id=line.supplier_id,
                period_type=plan.period_type,
                period_year=plan.period_year,
                period_quarter=plan.period_quarter,
            )
            if matched:
                generated += 1
        return len(lines), generated

    async def _to_response(
        self, tenant_id: int, plan: SupplierEvalPlan
    ) -> SupplierEvalPlanResponse:
        lines = await self._list_lines(tenant_id, plan.id)
        line_count, generated = await self._counts(tenant_id, plan, lines)
        data = SupplierEvalPlanResponse.model_validate(plan)
        data.line_count = line_count
        data.generated_count = generated
        out_lines: List[SupplierEvalPlanLineResponse] = []
        for line in lines:
            item = SupplierEvalPlanLineResponse.model_validate(line)
            matched = await self._match_evaluation(
                tenant_id,
                supplier_id=line.supplier_id,
                period_type=plan.period_type,
                period_year=plan.period_year,
                period_quarter=plan.period_quarter,
            )
            if matched:
                item.evaluation_id = matched.id
                item.evaluation_code = matched.code
                item.evaluation_status = matched.status
            out_lines.append(item)
        data.lines = out_lines
        return data

    async def create(
        self, tenant_id: int, data: SupplierEvalPlanCreate, user: User
    ) -> SupplierEvalPlanResponse:
        name = (data.name or "").strip()
        if not name:
            raise ValidationError("计划名称不能为空")
        pt, year, quarter = self._validate_period(
            data.period_type, data.period_year, data.period_quarter
        )
        tpl = await self._resolve_template(tenant_id, data.template_id)
        code = await self._ensure_code(tenant_id, data.code)
        if await SupplierEvalPlan.filter(
            tenant_id=tenant_id, code=code, deleted_at__isnull=True
        ).exists():
            raise ValidationError(f"计划编码已存在: {code}")
        row = SupplierEvalPlan(
            tenant_id=tenant_id,
            code=code,
            name=name,
            period_type=pt,
            period_year=year,
            period_quarter=quarter,
            template_id=tpl.id,
            template_code=tpl.code,
            template_name=tpl.name,
            audit_mode=self._validate_audit_mode(data.audit_mode),
            reminder_lead_days=max(1, int(getattr(data, "reminder_lead_days", None) or 7)),
            status=PLAN_STATUS_DRAFT,
            remarks=data.remarks,
        )
        apply_create_audit(row, user)
        await row.save()
        await self._replace_lines(tenant_id, row.id, data.lines or [], user)
        return await self._to_response(tenant_id, row)

    async def update(
        self,
        tenant_id: int,
        plan_id: int,
        data: SupplierEvalPlanUpdate,
        user: User,
    ) -> SupplierEvalPlanResponse:
        row = await self._get_row(tenant_id, plan_id)
        if row.status == PLAN_STATUS_CLOSED:
            raise BusinessLogicError("已关闭计划不可修改")
        raw = data.model_dump(exclude_unset=True)
        has_lines = "lines" in raw
        lines_payload = raw.pop("lines", None) if has_lines else None
        if "name" in raw and raw["name"] is not None:
            name = str(raw["name"]).strip()
            if not name:
                raise ValidationError("计划名称不能为空")
            raw["name"] = name
        if any(k in raw for k in ("period_type", "period_year", "period_quarter")):
            pt, year, quarter = self._validate_period(
                str(raw.get("period_type", row.period_type)),
                int(raw.get("period_year", row.period_year)),
                raw.get("period_quarter", row.period_quarter)
                if "period_quarter" in raw
                else row.period_quarter,
            )
            raw["period_type"] = pt
            raw["period_year"] = year
            raw["period_quarter"] = quarter
        if "template_id" in raw and raw["template_id"] is not None:
            tpl = await self._resolve_template(tenant_id, int(raw["template_id"]))
            raw["template_id"] = tpl.id
            raw["template_code"] = tpl.code
            raw["template_name"] = tpl.name
        if "audit_mode" in raw and raw["audit_mode"] is not None:
            raw["audit_mode"] = self._validate_audit_mode(str(raw["audit_mode"]))
        for key, value in raw.items():
            setattr(row, key, value)
        apply_update_audit(row, user)
        await row.save()
        if has_lines:
            if row.status == PLAN_STATUS_RELEASED:
                raise BusinessLogicError("已下达计划不可改供应商清单，请先撤回为草稿或关闭后新开")
            await self._replace_lines(tenant_id, row.id, lines_payload or [], user)
        return await self._to_response(tenant_id, row)

    async def get(self, tenant_id: int, plan_id: int) -> SupplierEvalPlanResponse:
        return await self._to_response(tenant_id, await self._get_row(tenant_id, plan_id))

    async def list(
        self,
        tenant_id: int,
        *,
        skip: int = 0,
        limit: int = 20,
        keyword: Optional[str] = None,
        status: Optional[str] = None,
        period_type: Optional[str] = None,
        period_year: Optional[int] = None,
        order_by: str = "-created_at",
    ) -> SupplierEvalPlanListResponse:
        query = SupplierEvalPlan.filter(tenant_id=tenant_id, deleted_at__isnull=True)
        if status:
            query = query.filter(status=status.strip().lower())
        if period_type:
            query = query.filter(period_type=period_type.strip().lower())
        if period_year is not None:
            query = query.filter(period_year=int(period_year))
        if keyword:
            kw = keyword.strip()
            if kw:
                query = query.filter(Q(code__icontains=kw) | Q(name__icontains=kw))
        total = await query.count()
        allowed = {
            "created_at",
            "-created_at",
            "updated_at",
            "-updated_at",
            "code",
            "-code",
            "period_year",
            "-period_year",
        }
        order = order_by if order_by in allowed else "-created_at"
        rows = await query.order_by(order).offset(skip).limit(limit)
        items: List[SupplierEvalPlanListItem] = []
        for row in rows:
            lines = await self._list_lines(tenant_id, row.id)
            line_count, generated = await self._counts(tenant_id, row, lines)
            item = SupplierEvalPlanListItem.model_validate(row)
            item.line_count = line_count
            item.generated_count = generated
            items.append(item)
        return SupplierEvalPlanListResponse(data=items, total=total, success=True)

    async def delete(self, tenant_id: int, plan_id: int, user: User) -> bool:
        row = await self._get_row(tenant_id, plan_id)
        if row.status == PLAN_STATUS_RELEASED:
            raise BusinessLogicError("已下达计划不可删除，请先关闭")
        now = resolve_business_datetime()
        row.deleted_at = now
        apply_update_audit(row, user)
        await row.save()
        for line in await self._list_lines(tenant_id, plan_id):
            line.deleted_at = now
            apply_update_audit(line, user)
            await line.save()
        return True

    async def release(
        self, tenant_id: int, plan_id: int, user: User
    ) -> SupplierEvalPlanResponse:
        row = await self._get_row(tenant_id, plan_id)
        if row.status != PLAN_STATUS_DRAFT:
            raise BusinessLogicError("仅草稿计划可下达")
        lines = await self._list_lines(tenant_id, plan_id)
        if not lines:
            raise ValidationError("计划无供应商，无法下达")
        await self._resolve_template(tenant_id, row.template_id)
        row.status = PLAN_STATUS_RELEASED
        apply_update_audit(row, user)
        await row.save()
        return await self._to_response(tenant_id, row)

    async def close(
        self, tenant_id: int, plan_id: int, user: User
    ) -> SupplierEvalPlanResponse:
        row = await self._get_row(tenant_id, plan_id)
        if row.status == PLAN_STATUS_CLOSED:
            raise BusinessLogicError("计划已关闭")
        row.status = PLAN_STATUS_CLOSED
        apply_update_audit(row, user)
        await row.save()
        return await self._to_response(tenant_id, row)

    async def reopen_draft(
        self, tenant_id: int, plan_id: int, user: User
    ) -> SupplierEvalPlanResponse:
        row = await self._get_row(tenant_id, plan_id)
        if row.status != PLAN_STATUS_RELEASED:
            raise BusinessLogicError("仅已下达计划可撤回为草稿")
        row.status = PLAN_STATUS_DRAFT
        apply_update_audit(row, user)
        await row.save()
        return await self._to_response(tenant_id, row)

    async def generate_evaluations(
        self, tenant_id: int, plan_id: int, user: User
    ) -> SupplierEvalPlanGenerateResult:
        row = await self._get_row(tenant_id, plan_id)
        if row.status not in (PLAN_STATUS_DRAFT, PLAN_STATUS_RELEASED):
            raise BusinessLogicError("已关闭计划不可生成评价单")
        lines = await self._list_lines(tenant_id, plan_id)
        if not lines:
            raise ValidationError("计划无供应商")
        await self._resolve_template(tenant_id, row.template_id)

        created_ids: List[int] = []
        skipped_ids: List[int] = []
        for line in lines:
            existing = await self._match_evaluation(
                tenant_id,
                supplier_id=line.supplier_id,
                period_type=row.period_type,
                period_year=row.period_year,
                period_quarter=row.period_quarter,
            )
            if existing:
                skipped_ids.append(line.supplier_id)
                if not existing.plan_id:
                    existing.plan_id = row.id
                    existing.plan_code = row.code
                    apply_update_audit(existing, user)
                    await existing.save()
                continue
            created = await self.eval_service.create(
                tenant_id,
                SupplierEvaluationCreate(
                    period_type=row.period_type,
                    period_year=row.period_year,
                    period_quarter=row.period_quarter,
                    supplier_id=line.supplier_id,
                    template_id=row.template_id,
                    audit_mode=row.audit_mode,
                    remarks=f"来自评价计划 {row.code}",
                ),
                user,
            )
            eval_row = await SupplierEvaluation.filter(
                tenant_id=tenant_id, id=created.id, deleted_at__isnull=True
            ).first()
            if eval_row:
                eval_row.plan_id = row.id
                eval_row.plan_code = row.code
                apply_update_audit(eval_row, user)
                await eval_row.save()
                created_ids.append(eval_row.id)

        if row.status == PLAN_STATUS_DRAFT and created_ids:
            row.status = PLAN_STATUS_RELEASED
            apply_update_audit(row, user)
            await row.save()

        return SupplierEvalPlanGenerateResult(
            created=len(created_ids),
            skipped=len(skipped_ids),
            evaluation_ids=created_ids,
            skipped_supplier_ids=skipped_ids,
        )


class SupplierEvalSummaryService:
    """周期汇总：直读评价单，不碰主数据运营评级。"""

    @staticmethod
    async def summarize(
        tenant_id: int,
        *,
        period_type: Optional[str] = None,
        period_year: Optional[int] = None,
        period_quarter: Optional[int] = None,
    ) -> SupplierEvalSummaryResponse:
        query = SupplierEvaluation.filter(
            tenant_id=tenant_id, deleted_at__isnull=True
        ).exclude(status=STATUS_REVOKED)
        if period_type:
            pt = period_type.strip().lower()
            if pt not in SUPPLIER_EVAL_PERIOD_TYPES:
                raise ValidationError(f"非法评价周期类型: {period_type}")
            query = query.filter(period_type=pt)
        if period_year is not None:
            query = query.filter(period_year=int(period_year))
        if period_quarter is not None:
            query = query.filter(period_quarter=int(period_quarter))

        rows = await query.all()
        by_status: Dict[str, int] = {}
        by_grade: Dict[str, int] = {}
        score_sum = Decimal("0")
        score_n = 0
        approved = 0
        open_rect = 0
        needs_rect = 0
        for row in rows:
            st = (row.status or "").strip().lower() or "draft"
            by_status[st] = by_status.get(st, 0) + 1
            if st == STATUS_APPROVED:
                approved += 1
                if row.score is not None:
                    score_sum += Decimal(str(row.score))
                    score_n += 1
                grade = (row.grade or "").strip().upper() or "—"
                by_grade[grade] = by_grade.get(grade, 0) + 1
            if row.needs_rectification:
                needs_rect += 1
            if row.rectification_status == RECT_OPEN:
                open_rect += 1

        avg = None
        if score_n:
            avg = (score_sum / Decimal(score_n)).quantize(Decimal("0.01"))

        return SupplierEvalSummaryResponse(
            period_type=period_type.strip().lower() if period_type else None,
            period_year=period_year,
            period_quarter=period_quarter,
            total=len(rows),
            by_status=by_status,
            by_grade=by_grade,
            approved_count=approved,
            avg_score=avg,
            open_rectification=open_rect,
            needs_rectification=needs_rect,
        )
