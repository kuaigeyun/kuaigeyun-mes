"""好力 GO — 模具统计报表 API。"""

from __future__ import annotations

from datetime import datetime
from typing import Annotated

from fastapi import APIRouter, Depends
from pydantic import BaseModel, Field
from tortoise import connections

from core.api.deps.access import require_module_access
from core.api.deps.deps import get_current_tenant, get_current_user
from infra.models.user import User

router = APIRouter(
    prefix="/molds/reports",
    tags=["App · HaoliGO · 模具报表"],
    dependencies=[Depends(require_module_access("haoligo", "molds-reports-maintenance-alert"))],
)


class MaintenanceUpkeepLastByMoldOut(BaseModel):
    items: dict[str, datetime] = Field(
        default_factory=dict,
        description="模具代号 → 最近一次保养完修时间（厂内 + 外协已通过，ISO 8601）",
    )


@router.get(
    "/maintenance-upkeep-last-by-mold",
    response_model=MaintenanceUpkeepLastByMoldOut,
    summary="各模具最近保养完修时间（保养预警表聚合）",
)
async def get_maintenance_upkeep_last_by_mold(
    tenant_id: Annotated[int, Depends(get_current_tenant)],
    _: Annotated[User, Depends(get_current_user)],
) -> MaintenanceUpkeepLastByMoldOut:
    conn = connections.get("default")
    rows = await conn.execute_query_dict(
        """
        WITH hits AS (
          SELECT trim(coalesce(elem->>'mold_code', '')) AS mold_code,
                 c.created_at AS upkeep_at
          FROM haoligo_mold_maintenance_complete_sheet c
          CROSS JOIN LATERAL jsonb_array_elements(COALESCE(c.line_items, '[]'::jsonb)) AS elem
          WHERE c.tenant_id = $1
            AND c.deleted_at IS NULL
            AND trim(coalesce(c.service_type, '')) = '保养'
          UNION ALL
          SELECT trim(coalesce(elem->>'mold_code', '')) AS mold_code,
                 oc.created_at AS upkeep_at
          FROM haoligo_mold_outsource_maintenance_complete_sheet oc
          CROSS JOIN LATERAL jsonb_array_elements(COALESCE(oc.line_items, '[]'::jsonb)) AS elem
          WHERE oc.tenant_id = $1
            AND oc.deleted_at IS NULL
            AND COALESCE(NULLIF(trim(oc.sheet_status), ''), '已通过') = '已通过'
            AND trim(coalesce(oc.service_type, '')) = '保养'
        )
        SELECT mold_code, max(upkeep_at) AS last_upkeep_at
        FROM hits
        WHERE mold_code <> ''
        GROUP BY mold_code
        """,
        [tenant_id],
    )
    out: dict[str, datetime] = {}
    for r in rows:
        code = str(r.get("mold_code") or "").strip()
        at = r.get("last_upkeep_at")
        if code and at is not None:
            out[code] = at
    return MaintenanceUpkeepLastByMoldOut(items=out)
