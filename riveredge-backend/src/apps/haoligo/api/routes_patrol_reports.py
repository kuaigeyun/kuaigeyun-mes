"""好力 GO — 现场巡查统计报表（数据口径：隐患单 haoligo_hazard_report）。"""

from __future__ import annotations

import re
from collections import Counter
from typing import Dict, List, Optional

from fastapi import APIRouter, Depends, HTTPException, Query, status
from pydantic import BaseModel, Field
from tortoise import Tortoise

from apps.haoligo.api._qs import tenant_alive
from apps.haoligo.models.patrol import HaoligoHazardReport
from core.api.deps.deps import get_current_tenant, get_current_user
from infra.models.user import User

router = APIRouter(prefix="/patrol/reports", tags=["App · HaoliGO · 巡查报表"])

REPORT_KEYS = frozenset(
    {
        "issue-type-share",
        "monthly-volume",
        "keyword-cloud",
        "node-completion-trend",
        "status-distribution",
        "area-volume-trend",
        "overdue-ranking",
        "monthly-overdue-rate",
        "dept-headcount-trend",
        "monthly-completion-rate",
    }
)

_OVERDUE_STATUSES = ("已登记",)
_NODE_LABELS = ("已登记", "已治理")


class ChartPoint(BaseModel):
    label: str
    value: float


class TrendSeries(BaseModel):
    name: str
    data: List[ChartPoint]


class PatrolReportPayload(BaseModel):
    report_key: str
    points: List[ChartPoint] = Field(default_factory=list)
    series: List[TrendSeries] = Field(default_factory=list)


class PatrolKpiSummary(BaseModel):
    """与移动端看板顶部 KPI 对齐的台账汇总（隐患单）。"""

    total_tasks: int = Field(description="隐患单总数")
    open_tasks: int = Field(description="已登记（待治理）")
    completed_tasks: int = Field(description="已治理")
    contributor_count: int = Field(description="有登记记录的去重人数（用户或姓名）")


async def _kpi_summary(tenant_id: int) -> PatrolKpiSummary:
    qs = tenant_alive(HaoligoHazardReport, tenant_id)
    total = await qs.count()
    completed = await qs.filter(status="已治理").count()
    open_tasks = await qs.filter(status__in=_OVERDUE_STATUSES).count()
    uid_rows = await qs.filter(registrant_user_id__isnull=False).values_list("registrant_user_id", flat=True)
    contributors = len(set(uid_rows)) if uid_rows else 0
    if contributors == 0:
        name_rows = await qs.filter(registrant_name__isnull=False).values_list("registrant_name", flat=True)
        contributors = len({(n or "").strip() for n in name_rows if (n or "").strip()})
    return PatrolKpiSummary(
        total_tasks=total,
        open_tasks=open_tasks,
        completed_tasks=completed,
        contributor_count=contributors,
    )


async def _conn():
    return Tortoise.get_connection("default")


async def _group_count(
    tenant_id: int,
    column: str,
    *,
    months: int = 12,
    month_column: str = "reported_at",
) -> List[ChartPoint]:
    conn = await _conn()
    sql = f"""
        SELECT COALESCE(NULLIF(TRIM({column}::text), ''), '未分类') AS label,
               COUNT(*)::float AS value
        FROM haoligo_hazard_report
        WHERE tenant_id = $1 AND deleted_at IS NULL
        GROUP BY 1
        ORDER BY value DESC, label
        LIMIT 50
    """
    rows = await conn.execute_query_dict(sql, [tenant_id])
    return [ChartPoint(label=str(r["label"]), value=float(r["value"])) for r in rows]


async def _issue_type_share(tenant_id: int) -> List[ChartPoint]:
    """按问题类型编码统计（支持 issue_type_codes 多选展开）。"""
    conn = await _conn()
    sql = """
        SELECT COALESCE(NULLIF(TRIM(elem), ''), '未分类') AS label,
               COUNT(*)::float AS value
        FROM haoligo_hazard_report h,
             LATERAL (
                 SELECT jsonb_array_elements_text(
                     CASE
                         WHEN h.issue_type_codes IS NOT NULL
                              AND jsonb_array_length(h.issue_type_codes) > 0
                         THEN h.issue_type_codes
                         WHEN h.issue_type_code IS NOT NULL AND TRIM(h.issue_type_code) <> ''
                         THEN jsonb_build_array(h.issue_type_code)
                         ELSE '[]'::jsonb
                     END
                 ) AS elem
             ) expanded
        WHERE h.tenant_id = $1 AND h.deleted_at IS NULL
        GROUP BY 1
        ORDER BY value DESC, label
        LIMIT 50
    """
    rows = await conn.execute_query_dict(sql, [tenant_id])
    if rows:
        return [ChartPoint(label=str(r["label"]), value=float(r["value"])) for r in rows]
    return await _group_count(tenant_id, "issue_type_code")


async def _monthly_count(tenant_id: int, *, months: int = 12) -> List[ChartPoint]:
    conn = await _conn()
    sql = """
        SELECT to_char(date_trunc('month', reported_at), 'YYYY-MM') AS label,
               COUNT(*)::float AS value
        FROM haoligo_hazard_report
        WHERE tenant_id = $1 AND deleted_at IS NULL AND reported_at IS NOT NULL
          AND reported_at >= (date_trunc('month', CURRENT_TIMESTAMP) - ($2::int - 1) * INTERVAL '1 month')
        GROUP BY 1
        ORDER BY 1
    """
    rows = await conn.execute_query_dict(sql, [tenant_id, months])
    return [ChartPoint(label=str(r["label"]), value=float(r["value"])) for r in rows]


async def _monthly_rate(
    tenant_id: int,
    *,
    months: int = 12,
    numerator_status: Optional[str] = None,
    numerator_overdue: bool = False,
) -> List[ChartPoint]:
    conn = await _conn()
    if numerator_overdue:
        num_expr = "SUM(CASE WHEN status = '已登记' THEN 1 ELSE 0 END)"
    elif numerator_status:
        num_expr = f"SUM(CASE WHEN status = '{numerator_status}' THEN 1 ELSE 0 END)"
    else:
        num_expr = "COUNT(*)"
    sql = f"""
        SELECT to_char(date_trunc('month', reported_at), 'YYYY-MM') AS label,
               CASE WHEN COUNT(*) = 0 THEN 0
                    ELSE ROUND(({num_expr})::numeric / COUNT(*)::numeric * 100, 1)
               END::float AS value
        FROM haoligo_hazard_report
        WHERE tenant_id = $1 AND deleted_at IS NULL AND reported_at IS NOT NULL
          AND reported_at >= (date_trunc('month', CURRENT_TIMESTAMP) - ($2::int - 1) * INTERVAL '1 month')
        GROUP BY 1
        ORDER BY 1
    """
    rows = await conn.execute_query_dict(sql, [tenant_id, months])
    return [ChartPoint(label=str(r["label"]), value=float(r["value"])) for r in rows]


async def _node_completion(tenant_id: int) -> List[ChartPoint]:
    qs = tenant_alive(HaoligoHazardReport, tenant_id)
    total = await qs.count() or 1
    points: List[ChartPoint] = []
    for label in _NODE_LABELS:
        cnt = await qs.filter(status=label).count()
        points.append(ChartPoint(label=label, value=round(cnt / total * 100, 1)))
    return points


async def _overdue_ranking(tenant_id: int, *, limit: int = 20) -> List[ChartPoint]:
    conn = await _conn()
    sql = """
        SELECT COALESCE(NULLIF(TRIM(responsible_name), ''), NULLIF(TRIM(registrant_name), ''), '未指定') AS label,
               COUNT(*)::float AS value
        FROM haoligo_hazard_report
        WHERE tenant_id = $1 AND deleted_at IS NULL AND status = '已登记'
        GROUP BY 1
        ORDER BY value DESC, label
        LIMIT $2
    """
    rows = await conn.execute_query_dict(sql, [tenant_id, limit])
    return [ChartPoint(label=str(r["label"]), value=float(r["value"])) for r in rows]


async def _area_volume_trend(tenant_id: int, *, months: int = 6) -> List[TrendSeries]:
    conn = await _conn()
    sql = """
        SELECT COALESCE(NULLIF(TRIM(workshop_area), ''), '未填区域') AS area,
               to_char(date_trunc('month', reported_at), 'YYYY-MM') AS month,
               COUNT(*)::float AS cnt
        FROM haoligo_hazard_report
        WHERE tenant_id = $1 AND deleted_at IS NULL AND reported_at IS NOT NULL
          AND reported_at >= (date_trunc('month', CURRENT_TIMESTAMP) - ($2::int - 1) * INTERVAL '1 month')
        GROUP BY 1, 2
        ORDER BY 2, 1
    """
    rows = await conn.execute_query_dict(sql, [tenant_id, months])
    by_area: Dict[str, List[ChartPoint]] = {}
    for r in rows:
        area = str(r["area"])
        by_area.setdefault(area, []).append(
            ChartPoint(label=str(r["month"]), value=float(r["cnt"]))
        )
    top_areas = sorted(by_area.keys(), key=lambda a: sum(p.value for p in by_area[a]), reverse=True)[:8]
    return [TrendSeries(name=a, data=by_area[a]) for a in top_areas]


async def _dept_headcount_trend(tenant_id: int, *, months: int = 12) -> List[TrendSeries]:
    conn = await _conn()
    sql = """
        SELECT COALESCE(w.name, '未关联车间') AS dept,
               to_char(date_trunc('month', h.reported_at), 'YYYY-MM') AS month,
               COUNT(DISTINCT COALESCE(h.registrant_user_id::text, h.registrant_name, 'unknown'))::float AS cnt
        FROM haoligo_hazard_report h
        LEFT JOIN haoligo_workshop w ON w.id = h.workshop_id AND w.deleted_at IS NULL
        WHERE h.tenant_id = $1 AND h.deleted_at IS NULL AND h.reported_at IS NOT NULL
          AND h.reported_at >= (date_trunc('month', CURRENT_TIMESTAMP) - ($2::int - 1) * INTERVAL '1 month')
        GROUP BY 1, 2
        ORDER BY 2, 1
    """
    rows = await conn.execute_query_dict(sql, [tenant_id, months])
    by_dept: Dict[str, List[ChartPoint]] = {}
    for r in rows:
        dept = str(r["dept"])
        by_dept.setdefault(dept, []).append(
            ChartPoint(label=str(r["month"]), value=float(r["cnt"]))
        )
    top = sorted(by_dept.keys(), key=lambda d: sum(p.value for p in by_dept[d]), reverse=True)[:6]
    return [TrendSeries(name=d, data=by_dept[d]) for d in top]


async def _keyword_cloud(tenant_id: int, *, limit: int = 40) -> List[ChartPoint]:
    qs = tenant_alive(HaoligoHazardReport, tenant_id)
    texts = await qs.filter(problem_summary__isnull=False).values_list("problem_summary", flat=True)
    counter: Counter[str] = Counter()
    for text in texts:
        if not text:
            continue
        for token in re.findall(r"[\u4e00-\u9fff]{2,}|[A-Za-z]{3,}", str(text)):
            if token in ("问题", "描述", "其他", "区域"):
                continue
            counter[token] += 1
    return [
        ChartPoint(label=word, value=float(cnt))
        for word, cnt in counter.most_common(limit)
    ]


@router.get("/kpi-summary", response_model=PatrolKpiSummary, summary="巡查台账 KPI 汇总")
async def get_patrol_kpi_summary(
    tenant_id: int = Depends(get_current_tenant),
    _: User = Depends(get_current_user),
):
    return await _kpi_summary(tenant_id)


@router.get("/{report_key}", response_model=PatrolReportPayload, summary="巡查统计报表")
async def get_patrol_report(
    report_key: str,
    tenant_id: int = Depends(get_current_tenant),
    _: User = Depends(get_current_user),
    months: int = Query(12, ge=3, le=36),
):
    key = report_key.strip().lower()
    if key not in REPORT_KEYS:
        raise HTTPException(status_code=status.HTTP_404_NOT_FOUND, detail="未知报表")

    if key == "issue-type-share":
        return PatrolReportPayload(
            report_key=key, points=await _issue_type_share(tenant_id)
        )
    if key == "monthly-volume":
        return PatrolReportPayload(report_key=key, points=await _monthly_count(tenant_id, months=months))
    if key == "status-distribution":
        return PatrolReportPayload(report_key=key, points=await _group_count(tenant_id, "status"))
    if key == "node-completion-trend":
        return PatrolReportPayload(report_key=key, points=await _node_completion(tenant_id))
    if key == "monthly-completion-rate":
        return PatrolReportPayload(
            report_key=key,
            points=await _monthly_rate(tenant_id, months=months, numerator_status="已治理"),
        )
    if key == "monthly-overdue-rate":
        return PatrolReportPayload(
            report_key=key,
            points=await _monthly_rate(tenant_id, months=months, numerator_overdue=True),
        )
    if key == "overdue-ranking":
        return PatrolReportPayload(report_key=key, points=await _overdue_ranking(tenant_id))
    if key == "area-volume-trend":
        return PatrolReportPayload(
            report_key=key, series=await _area_volume_trend(tenant_id, months=min(months, 12))
        )
    if key == "dept-headcount-trend":
        return PatrolReportPayload(
            report_key=key, series=await _dept_headcount_trend(tenant_id, months=months)
        )
    if key == "keyword-cloud":
        return PatrolReportPayload(report_key=key, points=await _keyword_cloud(tenant_id))

    return PatrolReportPayload(report_key=key, points=[])
