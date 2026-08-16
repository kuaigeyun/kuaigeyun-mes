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
    ChangeCreateRequest,
    ChangeDeskItem,
    ChangeDeskListResponse,
    ChangeExecuteRequest,
    ChangeSubmitRequest,
)
from apps.master_data.schemas.drawing_change_schemas import DrawingChangeCreate
from apps.master_data.services.bom_change_service import BOMChangeService
from apps.master_data.services.drawing_change_service import DrawingChangeService
from apps.master_data.services.process_route_change_service import ProcessRouteChangeService
from core.services.approval.audit_record_enricher import enrich_items
from infra.exceptions.exceptions import ValidationError, NotFoundError
from infra.services.user_service import UserService


class ChangeDeskService:
    async def _enrich_desk_items(self, tenant_id: int, items: list[ChangeDeskItem]) -> list[ChangeDeskItem]:
        if not items:
            return items
        bom_rows = [item for item in items if item.category == "bom"]
        route_rows = [item for item in items if item.category == "process_route"]
        drawing_rows = [item for item in items if item.category == "drawing"]
        bom_by_uuid: dict[str, ChangeDeskItem] = {}
        route_by_uuid: dict[str, ChangeDeskItem] = {}
        drawing_by_uuid: dict[str, ChangeDeskItem] = {}
        if bom_rows:
            enriched_bom = await enrich_items(tenant_id, "bom_change", bom_rows)
            bom_by_uuid = {item.uuid: item for item in enriched_bom}
        if route_rows:
            enriched_route = await enrich_items(tenant_id, "process_route_change", route_rows)
            route_by_uuid = {item.uuid: item for item in enriched_route}
        if drawing_rows:
            enriched_drawing = await enrich_items(tenant_id, "drawing_change", drawing_rows)
            drawing_by_uuid = {item.uuid: item for item in enriched_drawing}
        return [
            bom_by_uuid.get(item.uuid, item)
            if item.category == "bom"
            else route_by_uuid.get(item.uuid, item)
            if item.category == "process_route"
            else drawing_by_uuid.get(item.uuid, item)
            if item.category == "drawing"
            else item
            for item in items
        ]

    async def list_changes(
        self,
        tenant_id: int,
        status: Optional[str] = None,
        change_type: Optional[str] = None,
        keyword: Optional[str] = None,
        change_code: Optional[str] = None,
        target_name: Optional[str] = None,
        created_start_date: Optional[str] = None,
        created_end_date: Optional[str] = None,
        updated_start_date: Optional[str] = None,
        updated_end_date: Optional[str] = None,
        page: int = 1,
        page_size: int = 20,
    ) -> ChangeDeskListResponse:
        items: list[ChangeDeskItem] = []
        bom_total = 0
        route_total = 0
        drawing_total = 0
        search_kwargs = {
            "keyword": keyword,
            "change_code": change_code,
            "target_name": target_name,
            "created_start_date": created_start_date,
            "created_end_date": created_end_date,
            "updated_start_date": updated_start_date,
            "updated_end_date": updated_end_date,
        }

        def append_bom_row(row) -> None:
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
                updated_at=row.updated_at,
                created_by_name=getattr(row, "created_by_name", None),
                updated_by_name=getattr(row, "updated_by_name", None),
                entity_code=getattr(row, "material_code", None),
                entity_name=getattr(row, "material_name", None),
                extra={
                    "bom_code": row.bom_code,
                    "from_version": row.from_version,
                    "to_version": row.to_version,
                },
            ))

        def append_route_row(row) -> None:
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
                updated_at=row.updated_at,
                created_by_name=getattr(row, "created_by_name", None) or getattr(row, "applicant_name", None),
                updated_by_name=getattr(row, "updated_by_name", None),
                entity_code=getattr(row, "process_route_code", None),
                entity_name=getattr(row, "process_route_name", None),
            ))

        def append_drawing_row(row) -> None:
            items.append(ChangeDeskItem(
                id=row.id,
                category="drawing",
                change_type=row.change_type,
                uuid=row.uuid,
                status=row.status,
                change_content=row.change_content,
                change_reason=row.change_reason,
                applicant_id=row.applicant_id,
                created_at=row.created_at,
                updated_at=row.updated_at,
                created_by_name=getattr(row, "created_by_name", None),
                updated_by_name=getattr(row, "updated_by_name", None),
                entity_code=getattr(row, "drawing_code", None),
                entity_name=getattr(row, "drawing_name", None),
                extra={
                    "drawing_revision": getattr(row, "drawing_revision", None),
                    "result_drawing_uuid": getattr(row, "result_drawing_uuid", None),
                },
            ))

        if change_type is None:
            fetch_limit = page * page_size
            bom_resp = await BOMChangeService.list_changes(
                tenant_id=tenant_id,
                status=status,
                page=1,
                page_size=fetch_limit,
                **search_kwargs,
            )
            bom_total = bom_resp.total
            for row in bom_resp.items:
                append_bom_row(row)

            route_resp = await ProcessRouteChangeService.list_changes(
                tenant_id=tenant_id,
                status=status,
                page=1,
                page_size=fetch_limit,
                **search_kwargs,
            )
            route_total = route_resp.total
            for row in route_resp.items:
                append_route_row(row)

            drawing_resp = await DrawingChangeService.list_changes(
                tenant_id=tenant_id,
                status=status,
                page=1,
                page_size=fetch_limit,
                **search_kwargs,
            )
            drawing_total = drawing_resp.total
            for row in drawing_resp.items:
                append_drawing_row(row)

            items.sort(key=lambda x: x.created_at, reverse=True)
            offset = (page - 1) * page_size
            items = items[offset : offset + page_size]
            total = bom_total + route_total + drawing_total
        elif change_type == "bom":
            bom_resp = await BOMChangeService.list_changes(
                tenant_id=tenant_id,
                status=status,
                page=page,
                page_size=page_size,
                **search_kwargs,
            )
            bom_total = bom_resp.total
            for row in bom_resp.items:
                append_bom_row(row)
            total = bom_total
        elif change_type == "drawing":
            drawing_resp = await DrawingChangeService.list_changes(
                tenant_id=tenant_id,
                status=status,
                page=page,
                page_size=page_size,
                **search_kwargs,
            )
            drawing_total = drawing_resp.total
            for row in drawing_resp.items:
                append_drawing_row(row)
            total = drawing_total
        elif change_type == "process_route":
            route_resp = await ProcessRouteChangeService.list_changes(
                tenant_id=tenant_id,
                status=status,
                page=page,
                page_size=page_size,
                **search_kwargs,
            )
            route_total = route_resp.total
            for row in route_resp.items:
                append_route_row(row)
            total = route_total
        else:
            raise ValidationError(f"未知变更类型: {change_type}")

        items = await self._enrich_desk_items(tenant_id, items)
        return ChangeDeskListResponse(items=items, total=total)

    async def create_change(self, tenant_id: int, data: ChangeCreateRequest, user_id: int):
        if data.change_type != "drawing":
            raise ValidationError("变更台仅支持在本页创建图纸变更；BOM/工艺请到主数据维护页")
        return await DrawingChangeService.create_change(
            tenant_id,
            DrawingChangeCreate.model_validate({
                "drawingUuid": data.drawing_uuid,
                "changeType": data.drawing_change_type,
                "changeReason": data.change_reason,
                "changeContent": data.change_content,
            }),
            user_id,
        )

    async def get_change(self, tenant_id: int, change_uuid: str, change_type: str):
        if change_type == "drawing":
            return await DrawingChangeService.get_change_by_uuid(tenant_id, change_uuid)
        if change_type == "bom":
            return await BOMChangeService.get_change_by_uuid(tenant_id, change_uuid)
        if change_type == "process_route":
            return await ProcessRouteChangeService.get_change_by_uuid(tenant_id, change_uuid)
        raise ValidationError(f"未知变更类型: {change_type}")

    async def submit_change(
        self, tenant_id: int, change_uuid: str, data: ChangeSubmitRequest, user_id: int
    ):
        if data.change_type == "bom":
            change = await BOMChangeService.get_change_by_uuid(tenant_id, change_uuid)
            return await BOMChangeService.submit_change(tenant_id, change.id, user_id)
        if data.change_type == "process_route":
            change = await ProcessRouteChangeService.get_change_by_uuid(tenant_id, change_uuid)
            return await ProcessRouteChangeService.submit_change(tenant_id, change.id, user_id)
        if data.change_type == "drawing":
            return await DrawingChangeService.submit_change(tenant_id, change_uuid, user_id)
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
        if data.change_type == "drawing":
            return await DrawingChangeService.approve_change(
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
        if data.change_type == "drawing":
            executor = await UserService().get_user_by_id(user_id)
            if not executor:
                raise ValidationError("执行人不存在")
            return await DrawingChangeService.execute_change(tenant_id, change_uuid, executor)
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
        if change_type == "drawing":
            await DrawingChangeService.delete_change(tenant_id, change_uuid)
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
        seen: set[tuple[str, str]] = set()
        for item in items:
            dedupe_key = (item.change_uuid, item.change_type)
            if dedupe_key in seen:
                continue
            seen.add(dedupe_key)
            try:
                await self.delete_change(
                    tenant_id=tenant_id,
                    change_uuid=item.change_uuid,
                    change_type=item.change_type,
                )
                success_count += 1
            except NotFoundError:
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
