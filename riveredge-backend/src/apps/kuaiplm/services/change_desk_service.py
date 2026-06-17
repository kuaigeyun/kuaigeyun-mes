"""
变更工作台服务 — 聚合 BOM / 工艺路线变更

Author: RiverEdge Team
Date: 2026-05-28
"""

from typing import Optional

from apps.kuaiplm.schemas.change_desk import (
    ChangeApproveRequest,
    ChangeBatchActionResponse,
    ChangeBatchItem,
    ChangeDeskItem,
    ChangeDeskListResponse,
    ChangeExecuteRequest,
    ChangeSubmitRequest,
)
from apps.master_data.services.bom_change_service import BOMChangeService
from apps.master_data.services.process_route_change_service import ProcessRouteChangeService
from core.services.approval.audit_record_enricher import enrich_items
from infra.exceptions.exceptions import ValidationError


class ChangeDeskService:
    async def _enrich_desk_items(self, tenant_id: int, items: list[ChangeDeskItem]) -> list[ChangeDeskItem]:
        if not items:
            return items
        bom_rows = [item for item in items if item.category == "bom"]
        route_rows = [item for item in items if item.category == "process_route"]
        if bom_rows:
            await enrich_items(tenant_id, "bom_change", bom_rows)
        if route_rows:
            await enrich_items(tenant_id, "process_route_change", route_rows)
        return items

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
                    id=row.id,
                    category="bom",
                    change_type=row.change_type,
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
                    id=row.id,
                    category="process_route",
                    change_type=row.change_type,
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
        items = await self._enrich_desk_items(tenant_id, items)
        return ChangeDeskListResponse(items=items, total=total)

    async def submit_change(
        self, tenant_id: int, change_uuid: str, data: ChangeSubmitRequest, user_id: int
    ):
        if data.change_type == "bom":
            change = await BOMChangeService.get_change_by_uuid(tenant_id, change_uuid)
            return await BOMChangeService.submit_change(tenant_id, change.id, user_id)
        if data.change_type == "process_route":
            change = await ProcessRouteChangeService.get_change_by_uuid(tenant_id, change_uuid)
            return await ProcessRouteChangeService.submit_change(tenant_id, change.id, user_id)
        raise ValidationError(f"未知变更类型: {data.change_type}")

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
        raise ValidationError(f"未知变更类型: {data.change_type}")

    async def execute_change(
        self, tenant_id: int, change_uuid: str, data: ChangeExecuteRequest, user_id: int
    ):
        if data.change_type == "bom":
            return await BOMChangeService.execute_change(tenant_id, change_uuid, user_id)
        if data.change_type == "process_route":
            return await ProcessRouteChangeService.execute_change(tenant_id, change_uuid, user_id)
        raise ValidationError(f"未知变更类型: {data.change_type}")

    async def delete_change(
        self, tenant_id: int, change_uuid: str, change_type: str
    ) -> None:
        if change_type == "bom":
            await BOMChangeService.delete_change(tenant_id, change_uuid)
            return
        if change_type == "process_route":
            await ProcessRouteChangeService.delete_change(tenant_id, change_uuid)
            return
        raise ValidationError(f"未知变更类型: {change_type}")

    async def batch_approve_changes(
        self,
        tenant_id: int,
        items: list[ChangeBatchItem],
        approved: bool,
        approval_comment: Optional[str],
        user_id: int,
    ) -> ChangeBatchActionResponse:
        success_count = 0
        failed_items: list[ChangeBatchItem] = []
        errors: list[str] = []
        for item in items:
            try:
                await self.approve_change(
                    tenant_id=tenant_id,
                    change_uuid=item.change_uuid,
                    data=ChangeApproveRequest(
                        change_type=item.change_type,
                        approved=approved,
                        approval_comment=approval_comment,
                    ),
                    user_id=user_id,
                )
                success_count += 1
            except (ValueError, ValidationError) as e:
                failed_items.append(item)
                errors.append(str(e))
        return ChangeBatchActionResponse(
            success_count=success_count,
            failed_count=len(failed_items),
            failed_items=failed_items,
            errors=errors,
        )

    async def batch_execute_changes(
        self,
        tenant_id: int,
        items: list[ChangeBatchItem],
        user_id: int,
    ) -> ChangeBatchActionResponse:
        success_count = 0
        failed_items: list[ChangeBatchItem] = []
        errors: list[str] = []
        for item in items:
            try:
                await self.execute_change(
                    tenant_id=tenant_id,
                    change_uuid=item.change_uuid,
                    data=ChangeExecuteRequest(change_type=item.change_type),
                    user_id=user_id,
                )
                success_count += 1
            except (ValueError, ValidationError) as e:
                failed_items.append(item)
                errors.append(str(e))
        return ChangeBatchActionResponse(
            success_count=success_count,
            failed_count=len(failed_items),
            failed_items=failed_items,
            errors=errors,
        )

    async def batch_delete_changes(
        self,
        tenant_id: int,
        items: list[ChangeBatchItem],
    ) -> ChangeBatchActionResponse:
        success_count = 0
        failed_items: list[ChangeBatchItem] = []
        errors: list[str] = []
        for item in items:
            try:
                await self.delete_change(
                    tenant_id=tenant_id,
                    change_uuid=item.change_uuid,
                    change_type=item.change_type,
                )
                success_count += 1
            except (ValueError, ValidationError) as e:
                failed_items.append(item)
                errors.append(str(e))
        return ChangeBatchActionResponse(
            success_count=success_count,
            failed_count=len(failed_items),
            failed_items=failed_items,
            errors=errors,
        )
