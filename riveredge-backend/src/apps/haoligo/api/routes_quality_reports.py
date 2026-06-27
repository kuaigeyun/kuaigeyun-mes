"""好力 GO — 品质管理统计报表。"""

from __future__ import annotations

from typing import List, Optional

from fastapi import APIRouter, Depends, HTTPException, Request, status
from pydantic import BaseModel, Field
from tortoise import Tortoise

from apps.haoligo.api._quality_report_access import ensure_quality_report_read
from core.api.deps.access import AuthContext, get_auth_context
from core.api.deps.deps import get_current_tenant, get_current_user
from infra.models.user import User

router = APIRouter(prefix="/quality/reports", tags=["App · HaoliGO · 品质报表"])

_STATUS_LABELS = {
    "registered": "已登记",
    "assigned": "待处理",
    "processing": "处理中",
    "completed": "已完成",
}

_STOP_KIND_LABELS = {
    "equipment": "设备异常停线",
    "quality": "品质异常停线",
}


class ChartPoint(BaseModel):
    label: str
    value: float


class QualityReportRow(BaseModel):
    sheet_no: str
    status: str
    status_label: str
    summary: str
    dimension: Optional[str] = None
    reported_at: Optional[str] = None
    due_at: Optional[str] = None
    is_overdue: bool = False


class QualityReportPayload(BaseModel):
    report_key: str
    points: List[ChartPoint] = Field(default_factory=list)
    status_distribution: List[ChartPoint] = Field(default_factory=list)
    monthly_trend: List[ChartPoint] = Field(default_factory=list)
    dimension_ranking: List[ChartPoint] = Field(default_factory=list)
    items: List[QualityReportRow] = Field(default_factory=list)


async def _conn():
    return Tortoise.get_connection("default")


def _status_label(status: Optional[str]) -> str:
    key = (status or "").strip().lower()
    return _STATUS_LABELS.get(key, status or "未知")


async def _status_distribution(tenant_id: int, table: str) -> List[ChartPoint]:
    conn = await _conn()
    sql = f"""
        SELECT status AS raw_status, COUNT(*)::float AS value
        FROM {table}
        WHERE tenant_id = $1 AND deleted_at IS NULL
        GROUP BY status
        ORDER BY value DESC
    """
    rows = await conn.execute_query_dict(sql, [tenant_id])
    return [
        ChartPoint(label=_status_label(str(r.get("raw_status") or "")), value=float(r.get("value") or 0))
        for r in rows
    ]


async def _monthly_trend(tenant_id: int, table: str, *, months: int = 6) -> List[ChartPoint]:
    conn = await _conn()
    sql = f"""
        SELECT TO_CHAR(DATE_TRUNC('month', reported_at), 'YYYY-MM') AS label,
               COUNT(*)::float AS value
        FROM {table}
        WHERE tenant_id = $1
          AND deleted_at IS NULL
          AND reported_at IS NOT NULL
          AND reported_at >= DATE_TRUNC('month', CURRENT_TIMESTAMP) - (($2::int - 1) * INTERVAL '1 month')
        GROUP BY 1
        ORDER BY 1
    """
    rows = await conn.execute_query_dict(sql, [tenant_id, months])
    return [ChartPoint(label=str(r["label"]), value=float(r.get("value") or 0)) for r in rows]


async def _workshop_ranking(tenant_id: int, table: str) -> List[ChartPoint]:
    conn = await _conn()
    sql = f"""
        SELECT COALESCE(NULLIF(TRIM(w.name), ''), '未指定车间') AS label,
               COUNT(*)::float AS value
        FROM {table} t
        LEFT JOIN haoligo_workshop w
          ON w.id = t.workshop_id AND w.tenant_id = t.tenant_id AND w.deleted_at IS NULL
        WHERE t.tenant_id = $1 AND t.deleted_at IS NULL
        GROUP BY 1
        ORDER BY value DESC, label
        LIMIT 10
    """
    rows = await conn.execute_query_dict(sql, [tenant_id])
    return [ChartPoint(label=str(r["label"]), value=float(r.get("value") or 0)) for r in rows]


async def _complaint_customer_ranking(tenant_id: int) -> List[ChartPoint]:
    conn = await _conn()
    sql = """
        SELECT COALESCE(NULLIF(TRIM(customer_name), ''), '未填写客户') AS label,
               COUNT(*)::float AS value
        FROM haoligo_customer_complaint
        WHERE tenant_id = $1 AND deleted_at IS NULL
        GROUP BY 1
        ORDER BY value DESC, label
        LIMIT 10
    """
    rows = await conn.execute_query_dict(sql, [tenant_id])
    return [ChartPoint(label=str(r["label"]), value=float(r.get("value") or 0)) for r in rows]


async def _line_stop_kind_ranking(tenant_id: int) -> List[ChartPoint]:
    conn = await _conn()
    sql = """
        SELECT stop_kind AS raw_kind, COUNT(*)::float AS value
        FROM haoligo_line_stop_feedback
        WHERE tenant_id = $1 AND deleted_at IS NULL
        GROUP BY stop_kind
        ORDER BY value DESC
    """
    rows = await conn.execute_query_dict(sql, [tenant_id])
    out: List[ChartPoint] = []
    for r in rows:
        kind = str(r.get("raw_kind") or "").strip().lower()
        label = _STOP_KIND_LABELS.get(kind, kind or "未分类")
        out.append(ChartPoint(label=label, value=float(r.get("value") or 0)))
    return out


async def _report_items(
    tenant_id: int,
    *,
    table: str,
    summary_column: str,
    dimension_sql: str,
    join_sql: str = "",
) -> List[QualityReportRow]:
    conn = await _conn()
    sql = f"""
        SELECT
            COALESCE(t.sheet_no, '') AS sheet_no,
            COALESCE(t.status, '') AS status,
            COALESCE(NULLIF(TRIM(t.{summary_column}), ''), '—') AS summary,
            {dimension_sql} AS dimension,
            t.reported_at,
            t.due_at,
            CASE
                WHEN COALESCE(t.status, '') <> 'completed'
                     AND t.due_at IS NOT NULL
                     AND t.due_at + INTERVAL '1 day' < CURRENT_TIMESTAMP
                THEN TRUE
                ELSE FALSE
            END AS is_overdue
        FROM {table} t
        {join_sql}
        WHERE t.tenant_id = $1 AND t.deleted_at IS NULL
        ORDER BY t.reported_at DESC NULLS LAST, t.id DESC
        LIMIT 50
    """
    rows = await conn.execute_query_dict(sql, [tenant_id])
    items: List[QualityReportRow] = []
    for r in rows:
        reported_at = r.get("reported_at")
        due_at = r.get("due_at")
        status = str(r.get("status") or "")
        items.append(
            QualityReportRow(
                sheet_no=str(r.get("sheet_no") or ""),
                status=status,
                status_label=_status_label(status),
                summary=str(r.get("summary") or "—"),
                dimension=(str(r.get("dimension")).strip() if r.get("dimension") else None) or None,
                reported_at=reported_at.isoformat() if reported_at else None,
                due_at=due_at.isoformat() if due_at else None,
                is_overdue=bool(r.get("is_overdue")),
            )
        )
    return items


async def _issue_report_points(tenant_id: int) -> List[ChartPoint]:
    conn = await _conn()
    sql = """
        WITH base AS (
            SELECT
                COUNT(*)::float AS total_count,
                SUM(CASE WHEN status = 'completed' THEN 1 ELSE 0 END)::float AS completed_count,
                SUM(
                    CASE
                        WHEN status <> 'completed'
                             AND due_at IS NOT NULL
                             AND due_at + INTERVAL '1 day' < CURRENT_TIMESTAMP
                        THEN 1 ELSE 0
                    END
                )::float AS overdue_count,
                AVG(
                    CASE
                        WHEN completed_at IS NOT NULL AND reported_at IS NOT NULL
                        THEN EXTRACT(EPOCH FROM (completed_at - reported_at)) / 3600.0
                        ELSE NULL
                    END
                )::float AS avg_close_hours
            FROM haoligo_quality_issue_tracking
            WHERE tenant_id = $1 AND deleted_at IS NULL
        )
        SELECT * FROM base
    """
    rows = await conn.execute_query_dict(sql, [tenant_id])
    if not rows:
        return []
    row = rows[0]
    total = float(row.get("total_count") or 0)
    completed = float(row.get("completed_count") or 0)
    overdue = float(row.get("overdue_count") or 0)
    avg_close = float(row.get("avg_close_hours") or 0)
    close_rate = round((completed / total * 100.0), 1) if total > 0 else 0.0
    overdue_rate = round((overdue / total * 100.0), 1) if total > 0 else 0.0
    return [
        ChartPoint(label="问题数量", value=total),
        ChartPoint(label="闭环率(%)", value=close_rate),
        ChartPoint(label="超期率(%)", value=overdue_rate),
        ChartPoint(label="平均闭环时长(小时)", value=round(avg_close, 1)),
    ]


async def _complaint_report_points(tenant_id: int) -> List[ChartPoint]:
    conn = await _conn()
    sql = """
        WITH base AS (
            SELECT
                COUNT(*)::float AS total_count,
                SUM(CASE WHEN status = 'completed' THEN 1 ELSE 0 END)::float AS completed_count,
                AVG(COALESCE(claim_amount, 0))::float AS avg_claim_amount,
                AVG(
                    CASE
                        WHEN completed_at IS NOT NULL AND reported_at IS NOT NULL
                        THEN EXTRACT(EPOCH FROM (completed_at - reported_at)) / 3600.0
                        ELSE NULL
                    END
                )::float AS avg_close_hours
            FROM haoligo_customer_complaint
            WHERE tenant_id = $1 AND deleted_at IS NULL
        )
        SELECT * FROM base
    """
    rows = await conn.execute_query_dict(sql, [tenant_id])
    if not rows:
        return []
    row = rows[0]
    total = float(row.get("total_count") or 0)
    completed = float(row.get("completed_count") or 0)
    close_rate = round((completed / total * 100.0), 1) if total > 0 else 0.0
    return [
        ChartPoint(label="投诉数量", value=total),
        ChartPoint(label="闭环率(%)", value=close_rate),
        ChartPoint(label="平均赔偿金额", value=round(float(row.get("avg_claim_amount") or 0), 2)),
        ChartPoint(label="平均闭环时长(小时)", value=round(float(row.get("avg_close_hours") or 0), 1)),
    ]


async def _line_stop_report_points(tenant_id: int) -> List[ChartPoint]:
    conn = await _conn()
    sql = """
        WITH base AS (
            SELECT
                COUNT(*)::float AS total_count,
                SUM(CASE WHEN status = 'completed' THEN 1 ELSE 0 END)::float AS completed_count,
                SUM(
                    CASE
                        WHEN stop_started_at IS NOT NULL AND recovered_at IS NOT NULL
                        THEN EXTRACT(EPOCH FROM (recovered_at - stop_started_at)) / 3600.0
                        ELSE 0
                    END
                )::float AS total_stop_hours,
                AVG(
                    CASE
                        WHEN stop_started_at IS NOT NULL AND recovered_at IS NOT NULL
                        THEN EXTRACT(EPOCH FROM (recovered_at - stop_started_at)) / 3600.0
                        ELSE NULL
                    END
                )::float AS avg_stop_hours
            FROM haoligo_line_stop_feedback
            WHERE tenant_id = $1 AND deleted_at IS NULL
        )
        SELECT * FROM base
    """
    rows = await conn.execute_query_dict(sql, [tenant_id])
    if not rows:
        return []
    row = rows[0]
    total = float(row.get("total_count") or 0)
    completed = float(row.get("completed_count") or 0)
    close_rate = round((completed / total * 100.0), 1) if total > 0 else 0.0
    return [
        ChartPoint(label="停线次数", value=total),
        ChartPoint(label="闭环率(%)", value=close_rate),
        ChartPoint(label="总停线时长(小时)", value=round(float(row.get("total_stop_hours") or 0), 1)),
        ChartPoint(label="平均停线时长(小时)", value=round(float(row.get("avg_stop_hours") or 0), 1)),
    ]


async def _build_issue_report(tenant_id: int) -> QualityReportPayload:
    table = "haoligo_quality_issue_tracking"
    return QualityReportPayload(
        report_key="issue-report",
        points=await _issue_report_points(tenant_id),
        status_distribution=await _status_distribution(tenant_id, table),
        monthly_trend=await _monthly_trend(tenant_id, table),
        dimension_ranking=await _workshop_ranking(tenant_id, table),
        items=await _report_items(
            tenant_id,
            table=table,
            summary_column="problem_description",
            dimension_sql="COALESCE(NULLIF(TRIM(w.name), ''), '未指定车间')",
            join_sql=(
                "LEFT JOIN haoligo_workshop w"
                " ON w.id = t.workshop_id AND w.tenant_id = t.tenant_id AND w.deleted_at IS NULL"
            ),
        ),
    )


async def _build_complaint_report(tenant_id: int) -> QualityReportPayload:
    table = "haoligo_customer_complaint"
    return QualityReportPayload(
        report_key="complaint-report",
        points=await _complaint_report_points(tenant_id),
        status_distribution=await _status_distribution(tenant_id, table),
        monthly_trend=await _monthly_trend(tenant_id, table),
        dimension_ranking=await _complaint_customer_ranking(tenant_id),
        items=await _report_items(
            tenant_id,
            table=table,
            summary_column="problem_description",
            dimension_sql="COALESCE(NULLIF(TRIM(t.customer_name), ''), '未填写客户')",
        ),
    )


async def _build_line_stop_report(tenant_id: int) -> QualityReportPayload:
    table = "haoligo_line_stop_feedback"
    return QualityReportPayload(
        report_key="line-stop-report",
        points=await _line_stop_report_points(tenant_id),
        status_distribution=await _status_distribution(tenant_id, table),
        monthly_trend=await _monthly_trend(tenant_id, table),
        dimension_ranking=await _line_stop_kind_ranking(tenant_id),
        items=await _report_items(
            tenant_id,
            table=table,
            summary_column="stop_reason",
            dimension_sql="""
                CASE
                    WHEN COALESCE(t.stop_kind, '') = 'quality' THEN '品质异常停线'
                    WHEN COALESCE(t.stop_kind, '') = 'equipment' THEN '设备异常停线'
                    ELSE '未分类'
                END
            """,
        ),
    )


@router.get("/{report_key}", response_model=QualityReportPayload, summary="品质统计报表")
async def get_quality_report(
    report_key: str,
    request: Request,
    tenant_id: int = Depends(get_current_tenant),
    auth: AuthContext = Depends(get_auth_context),
    _: User = Depends(get_current_user),
):
    key = report_key.strip().lower()
    await ensure_quality_report_read(key, request=request, auth=auth, tenant_id=tenant_id)

    if key == "issue-report":
        return await _build_issue_report(tenant_id)
    if key == "complaint-report":
        return await _build_complaint_report(tenant_id)
    if key == "line-stop-report":
        return await _build_line_stop_report(tenant_id)
    raise HTTPException(status_code=status.HTTP_404_NOT_FOUND, detail="未知报表")
