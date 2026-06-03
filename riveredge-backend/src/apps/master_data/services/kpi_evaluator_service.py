"""
KPI 评估服务：内置指标 + formula_json 安全表达式。
"""

from __future__ import annotations

import ast
import calendar
import operator
from dataclasses import dataclass
from datetime import date, datetime
from decimal import Decimal
from typing import Any, Dict, List, Optional, Tuple

from apps.kuaizhizao.models.reporting_record import ReportingRecord
from apps.master_data.models.employee_performance import EmployeeKPIScore, KPIDefinition
from apps.master_data.models.performance import Holiday


@dataclass
class KPIContext:
    total_hours: Decimal
    total_pieces: Decimal
    total_unqualified: Decimal
    quality_rate: Decimal
    efficiency: Decimal
    output: Decimal
    reported_days: int
    workdays: int
    holidays: int
    attendance_rate: Decimal

    def as_dict(self) -> Dict[str, float]:
        return {
            "total_hours": float(self.total_hours),
            "total_pieces": float(self.total_pieces),
            "total_unqualified": float(self.total_unqualified),
            "quality_rate": float(self.quality_rate),
            "efficiency": float(self.efficiency),
            "output": float(self.output),
            "reported_days": float(self.reported_days),
            "workdays": float(self.workdays),
            "holidays": float(self.holidays),
            "attendance_rate": float(self.attendance_rate),
        }


class _SafeFormulaEvaluator(ast.NodeVisitor):
    _OPS = {
        ast.Add: operator.add,
        ast.Sub: operator.sub,
        ast.Mult: operator.mul,
        ast.Div: operator.truediv,
        ast.USub: operator.neg,
    }
    _FUNCS = {"min": min, "max": max, "clamp": lambda v, lo, hi: max(lo, min(hi, v))}

    def __init__(self, variables: Dict[str, float]):
        self.variables = variables

    def visit(self, node):  # type: ignore[override]
        if isinstance(node, ast.Expression):
            return self.visit(node.body)
        if isinstance(node, ast.Constant):
            return float(node.value)
        if isinstance(node, ast.Num):  # py<3.8 compat
            return float(node.n)
        if isinstance(node, ast.Name):
            if node.id not in self.variables:
                raise ValueError(f"未知变量: {node.id}")
            return self.variables[node.id]
        if isinstance(node, ast.BinOp):
            op = self._OPS.get(type(node.op))
            if not op:
                raise ValueError("不支持的运算符")
            left = self.visit(node.left)
            right = self.visit(node.right)
            return float(op(left, right))
        if isinstance(node, ast.UnaryOp):
            op = self._OPS.get(type(node.op))
            if not op:
                raise ValueError("不支持的一元运算")
            return float(op(self.visit(node.operand)))
        if isinstance(node, ast.Call):
            if not isinstance(node.func, ast.Name):
                raise ValueError("不支持的函数调用")
            fn = self._FUNCS.get(node.func.id)
            if not fn:
                raise ValueError(f"未知函数: {node.func.id}")
            args = [self.visit(a) for a in node.args]
            return float(fn(*args))
        raise ValueError("不支持的表达式")


class KPIEvaluatorService:
    @staticmethod
    def _decimal(value: Any) -> Decimal:
        try:
            return Decimal(str(value or 0))
        except Exception:
            return Decimal("0")

    @staticmethod
    def _period_bounds(period: str) -> Tuple[date, date]:
        year, month = map(int, period.split("-"))
        last_day = calendar.monthrange(year, month)[1]
        return date(year, month, 1), date(year, month, last_day)

    @staticmethod
    def _count_workdays(start: date, end: date) -> int:
        count = 0
        cur = start
        while cur <= end:
            if cur.weekday() < 5:
                count += 1
            cur = date.fromordinal(cur.toordinal() + 1)
        return count

    @classmethod
    async def build_context(
        cls,
        tenant_id: int,
        period: str,
        records: List[ReportingRecord],
        total_hours: Decimal,
        total_pieces: Decimal,
        total_unqualified: Decimal,
        employee_id: Optional[int] = None,
    ) -> KPIContext:
        start_d, end_d = cls._period_bounds(period)
        workdays = cls._count_workdays(start_d, end_d)
        holiday_rows = await Holiday.filter(
            tenant_id=tenant_id,
            holiday_date__gte=start_d,
            holiday_date__lte=end_d,
            is_active=True,
            deleted_at__isnull=True,
        ).all()
        holidays = sum(1 for h in holiday_rows if h.holiday_date.weekday() < 5)
        reported_days = len({
            r.reported_at.date() if isinstance(r.reported_at, datetime) else r.reported_at
            for r in records
            if r.reported_at
        })
        qualified = total_pieces
        unqualified = total_unqualified
        denom = qualified + unqualified
        quality_rate = qualified / denom if denom > 0 else Decimal("1")
        efficiency = total_pieces / total_hours if total_hours > 0 else Decimal("0")
        expected_days = max(workdays - holidays, 1)
        if employee_id is not None:
            from apps.master_data.services.shift_scheduling_service import (
                ShiftSchedulingService,
            )

            scheduled_days = await ShiftSchedulingService.count_scheduled_workdays_for_employee(
                tenant_id, employee_id, start_d, end_d
            )
            if scheduled_days is not None:
                expected_days = max(scheduled_days, 1)
        attendance_rate = Decimal(str(reported_days)) / Decimal(str(expected_days))
        if attendance_rate > 1:
            attendance_rate = Decimal("1")
        return KPIContext(
            total_hours=total_hours,
            total_pieces=total_pieces,
            total_unqualified=total_unqualified,
            quality_rate=quality_rate,
            efficiency=efficiency,
            output=total_pieces,
            reported_days=reported_days,
            workdays=workdays,
            holidays=holidays,
            attendance_rate=attendance_rate,
        )

    @classmethod
    def _score_builtin(cls, calc_type: str, ctx: KPIContext, formula_json: Optional[Dict[str, Any]]) -> Decimal:
        targets = (formula_json or {}).get("targets") or {}
        if calc_type == "quality":
            min_rate = cls._decimal(targets.get("min_rate", 0.95))
            if min_rate <= 0:
                min_rate = Decimal("0.95")
            score = min(Decimal("100"), (ctx.quality_rate / min_rate) * Decimal("100"))
            return score.quantize(Decimal("0.01"))
        if calc_type == "efficiency":
            target = cls._decimal(targets.get("pieces_per_hour", 10))
            if target <= 0:
                target = Decimal("10")
            score = min(Decimal("100"), (ctx.efficiency / target) * Decimal("100"))
            return score.quantize(Decimal("0.01"))
        if calc_type == "output":
            target = cls._decimal(targets.get("pieces", 1000))
            if target <= 0:
                target = Decimal("1000")
            score = min(Decimal("100"), (ctx.output / target) * Decimal("100"))
            return score.quantize(Decimal("0.01"))
        if calc_type == "attendance":
            min_rate = cls._decimal(targets.get("min_rate", 0.9))
            if min_rate <= 0:
                min_rate = Decimal("0.9")
            score = min(Decimal("100"), (ctx.attendance_rate / min_rate) * Decimal("100"))
            return score.quantize(Decimal("0.01"))
        return Decimal("100")

    @classmethod
    def _score_formula(cls, formula_json: Optional[Dict[str, Any]], ctx: KPIContext) -> Decimal:
        payload = formula_json or {}
        expr = payload.get("expression") or payload.get("formula")
        if not expr:
            raise ValueError("formula 类型 KPI 缺少 expression")
        evaluator = _SafeFormulaEvaluator(ctx.as_dict())
        raw = evaluator.visit(ast.parse(str(expr), mode="eval"))
        score = Decimal(str(raw))
        if score < 0:
            score = Decimal("0")
        if score > 100:
            score = Decimal("100")
        return score.quantize(Decimal("0.01"))

    @classmethod
    def score_kpi(cls, kpi: KPIDefinition, ctx: KPIContext) -> Decimal:
        calc_type = (kpi.calc_type or "").lower()
        formula_json = kpi.formula_json if isinstance(kpi.formula_json, dict) else None
        if calc_type == "formula":
            return cls._score_formula(formula_json, ctx)
        return cls._score_builtin(calc_type, ctx, formula_json)

    @classmethod
    async def evaluate_and_persist(
        cls,
        tenant_id: int,
        employee_id: int,
        employee_name: str,
        period: str,
        ctx: KPIContext,
    ) -> Tuple[Decimal, Decimal]:
        """计算 KPI 综合分与系数，写入 EmployeeKPIScore。"""
        kpis = await KPIDefinition.filter(
            tenant_id=tenant_id,
            is_active=True,
            deleted_at__isnull=True,
        ).all()
        if not kpis:
            return Decimal("100"), Decimal("1")

        weight_sum = sum(cls._decimal(k.weight) for k in kpis)
        if weight_sum <= 0:
            weight_sum = Decimal(str(len(kpis)))

        weighted_total = Decimal("0")
        for kpi in kpis:
            score = cls.score_kpi(kpi, ctx)
            w = cls._decimal(kpi.weight) / weight_sum
            weighted_total += score * w
            await EmployeeKPIScore.update_or_create(
                tenant_id=tenant_id,
                employee_id=employee_id,
                period=period,
                kpi_code=kpi.code,
                defaults={
                    "employee_name": employee_name,
                    "score": score,
                    "source_data_json": {
                        "calc_type": kpi.calc_type,
                        "context": ctx.as_dict(),
                    },
                },
            )

        kpi_score = weighted_total.quantize(Decimal("0.01"))
        coefficient = (kpi_score / Decimal("100")).quantize(Decimal("0.0001"))
        if coefficient <= 0:
            coefficient = Decimal("0.01")
        return kpi_score, coefficient

    @classmethod
    async def list_scores(
        cls,
        tenant_id: int,
        *,
        employee_id: Optional[int] = None,
        period: Optional[str] = None,
    ) -> List[EmployeeKPIScore]:
        q = EmployeeKPIScore.filter(tenant_id=tenant_id, deleted_at__isnull=True)
        if employee_id is not None:
            q = q.filter(employee_id=employee_id)
        if period:
            q = q.filter(period=period)
        return await q.order_by("employee_id", "kpi_code").all()
