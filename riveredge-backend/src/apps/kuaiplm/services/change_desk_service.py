"""
变更工作台服务 — 聚合 BOM / 工艺路线变更

Author: RiverEdge Team
Date: 2026-05-28
"""

from typing import Optional

from apps.kuaiplm.schemas.change_desk import (
    ChangeApproveRequest,
    ChangeDeskItem,
    ChangeDeskListResponse,
    ChangeExecuteRequest,
)
from apps.master_data.services.bom_change_service import BOMChangeService
from apps.master_data.services.process_route_change_service import ProcessRouteChangeService


class ChangeDeskService:
    async def list_changes(
        self,
        tenant_id: int,
        status: Optional[str] = None,
        change_type: Optional[str] = None,
        page: int = 1,
        page_size: int = 20,
    ) -> ChangeDeskListResponse:
        items: list[ChangeDeskItem] = []
        bom_total = 0
        route_total = 0

        if change_type in (None, "bom"):
            bom_resp = await BOMChangeService.list_changes(
                tenant_id=tenant_id, status=status, page=page, page_size=page_size
            )
            bom_total = bom_resp.total
            for row in bom_resp.items:
                items.append(ChangeDeskItem(
                    change_type="bom",
                    uuid=row.uuid,
                    status=row.status,
                    change_content=row.change_content,
                    change_reason=row.change_reason,
                    applicant_id=row.applicant_id,
                    created_at=row.created_at,
                    entity_code=getattr(row, "material_code", None),
                    entity_name=getattr(row, "material_name", None),
                    extra={
                        "bom_code": row.bom_code,
                        "from_version": row.from_version,
                        "to_version": row.to_version,
                    },
                ))

        if change_type in (None, "process_route"):
            route_resp = await ProcessRouteChangeService.list_changes(
                tenant_id=tenant_id, status=status, page=page, page_size=page_size
            )
            route_total = route_resp.total
            for row in route_resp.items:
                items.append(ChangeDeskItem(
                    change_type="process_route",
                    uuid=row.uuid,
                    status=row.status,
                    change_content=row.change_content,
                    change_reason=row.change_reason,
                    applicant_id=row.applicant_id,
                    created_at=row.created_at,
                    entity_code=getattr(row, "process_route_code", None),
                    entity_name=getattr(row, "process_route_name", None),
                ))

        items.sort(key=lambda x: x.created_at, reverse=True)
        total = bom_total if change_type == "bom" else route_total if change_type == "process_route" else bom_total + route_total
        return ChangeDeskListResponse(items=items, total=total)

    async def approve_change(
        self, tenant_id: int, change_uuid: str, data: ChangeApproveRequest, user_id: int
    ):
        if data.change_type == "bom":
            return await BOMChangeService.approve_change(
                tenant_id, change_uuid, user_id, data.approved, data.approval_comment
            )
        if data.change_type == "process_route":
            return await ProcessRouteChangeService.approve_change(
                tenant_id, change_uuid, user_id, data.approved, data.approval_comment
            )
        raise ValueError(f"未知变更类型: {data.change_type}")

    async def execute_change(
        self, tenant_id: int, change_uuid: str, data: ChangeExecuteRequest, user_id: int
    ):
        if data.change_type == "bom":
            return await BOMChangeService.execute_change(tenant_id, change_uuid, user_id)
        if data.change_type == "process_route":
            return await ProcessRouteChangeService.execute_change(tenant_id, change_uuid, user_id)
        raise ValueError(f"未知变更类型: {data.change_type}")
