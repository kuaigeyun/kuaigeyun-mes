"""图档反查：物料/工艺/工序/工单 ↔ 图纸。"""

from __future__ import annotations

from typing import List, Optional

from tortoise.expressions import Q

from apps.master_data.models.drawing import EngineeringDrawing
from apps.master_data.models.material import Material
from apps.master_data.models.process import Operation, ProcessRoute
from apps.master_data.schemas.drawing_where_used_schemas import (
    DrawingWhereUsedResponse,
    DrawingWhereUsedUsage,
)
from apps.master_data.services.drawing_security import DrawingSecurityService
from apps.master_data.services.drawing_service import DrawingService, _to_responses
from infra.exceptions.exceptions import NotFoundError, ValidationError
from infra.models.user import User


class DrawingWhereUsedService:
    @staticmethod
    async def query(
        tenant_id: int,
        *,
        material_uuid: Optional[str] = None,
        process_route_uuid: Optional[str] = None,
        operation_uuid: Optional[str] = None,
        work_order_uuid: Optional[str] = None,
        drawing_uuid: Optional[str] = None,
        current_user: Optional[User] = None,
    ) -> DrawingWhereUsedResponse:
        if drawing_uuid:
            return await DrawingWhereUsedService._reverse(
                tenant_id, drawing_uuid, current_user=current_user
            )
        if not any((material_uuid, process_route_uuid, operation_uuid, work_order_uuid)):
            raise ValidationError("请选择物料、工艺路线、工序、工单或图纸")
        return await DrawingWhereUsedService._forward(
            tenant_id,
            material_uuid=material_uuid,
            process_route_uuid=process_route_uuid,
            operation_uuid=operation_uuid,
            work_order_uuid=work_order_uuid,
            current_user=current_user,
        )

    @staticmethod
    async def _forward(
        tenant_id: int,
        *,
        material_uuid: Optional[str],
        process_route_uuid: Optional[str],
        operation_uuid: Optional[str],
        work_order_uuid: Optional[str],
        current_user: Optional[User] = None,
    ) -> DrawingWhereUsedResponse:
        query = EngineeringDrawing.filter(tenant_id=tenant_id, deleted_at__isnull=True)
        filters = Q()
        has_filter = False

        if material_uuid:
            material = await Material.get_or_none(
                tenant_id=tenant_id, uuid=material_uuid, deleted_at__isnull=True
            )
            if not material:
                raise NotFoundError("物料不存在")
            filters |= Q(material_uuids__contains=[material_uuid]) | Q(
                linked_bom_material_id=material.id
            )
            has_filter = True

        if process_route_uuid:
            route = await ProcessRoute.get_or_none(
                tenant_id=tenant_id, uuid=process_route_uuid, deleted_at__isnull=True
            )
            if not route:
                raise NotFoundError("工艺路线不存在")
            filters |= Q(process_route_uuids__contains=[process_route_uuid])
            has_filter = True

        if operation_uuid:
            operation = await Operation.get_or_none(
                tenant_id=tenant_id, uuid=operation_uuid, deleted_at__isnull=True
            )
            if not operation:
                raise NotFoundError("工序不存在")
            filters |= Q(operation_uuids__contains=[operation_uuid])
            has_filter = True

        if work_order_uuid:
            from apps.kuaizhizao.models.work_order import WorkOrder

            work_order = await WorkOrder.get_or_none(
                tenant_id=tenant_id, uuid=work_order_uuid, deleted_at__isnull=True
            )
            if not work_order:
                raise NotFoundError("工单不存在")
            product = await Material.get_or_none(
                tenant_id=tenant_id, id=work_order.product_id, deleted_at__isnull=True
            )
            wo_filter = Q()
            if product:
                wo_filter |= Q(material_uuids__contains=[product.uuid]) | Q(
                    linked_bom_material_id=product.id
                )
            route_id = getattr(work_order, "process_route_id", None)
            if route_id:
                route = await ProcessRoute.get_or_none(
                    id=route_id, tenant_id=tenant_id, deleted_at__isnull=True
                )
                if route:
                    wo_filter |= Q(process_route_uuids__contains=[route.uuid])
            if not wo_filter:
                return DrawingWhereUsedResponse(direction="forward", drawings=[], usages=[])
            filters |= wo_filter
            has_filter = True

        if not has_filter:
            return DrawingWhereUsedResponse(direction="forward", drawings=[], usages=[])

        rows = await query.filter(filters).order_by("-updated_at", "-id")
        allowed_levels = await DrawingSecurityService.allowed_security_levels(
            tenant_id, current_user
        )
        if allowed_levels is not None:
            rows = [row for row in rows if row.security_level in allowed_levels]
        drawings = await _to_responses(tenant_id, rows)
        return DrawingWhereUsedResponse(direction="forward", drawings=drawings, usages=[])

    @staticmethod
    async def _reverse(
        tenant_id: int, drawing_uuid: str, current_user: Optional[User] = None
    ) -> DrawingWhereUsedResponse:
        drawing = await DrawingService.get_drawing(
            tenant_id, drawing_uuid, current_user=current_user
        )
        usages: List[DrawingWhereUsedUsage] = []

        for mat in drawing.materials or []:
            usages.append(
                DrawingWhereUsedUsage(
                    kind="material",
                    uuid=mat.uuid,
                    code=mat.main_code,
                    name=mat.name,
                )
            )
        if drawing.linked_bom:
            usages.append(
                DrawingWhereUsedUsage(
                    kind="bom",
                    uuid=str(drawing.linked_bom.material_id),
                    code=drawing.linked_bom.material_code,
                    name=drawing.linked_bom.material_name,
                    extra=drawing.linked_bom.version,
                )
            )
        for route in drawing.process_routes or []:
            usages.append(
                DrawingWhereUsedUsage(
                    kind="process_route",
                    uuid=route.uuid,
                    code=route.code,
                    name=route.name,
                )
            )
        for op in drawing.operations or []:
            usages.append(
                DrawingWhereUsedUsage(
                    kind="operation",
                    uuid=op.uuid,
                    code=op.code,
                    name=op.name,
                )
            )

        material_ids: List[int] = []
        if drawing.linked_bom:
            material_ids.append(drawing.linked_bom.material_id)
        if drawing.material_uuids:
            mats = await Material.filter(
                tenant_id=tenant_id,
                uuid__in=drawing.material_uuids,
                deleted_at__isnull=True,
            ).all()
            material_ids.extend(m.id for m in mats)

        route_ids: List[int] = []
        if drawing.process_route_uuids:
            routes = await ProcessRoute.filter(
                tenant_id=tenant_id,
                uuid__in=drawing.process_route_uuids,
                deleted_at__isnull=True,
            ).all()
            route_ids.extend(r.id for r in routes)

        wo_filter = Q()
        if material_ids:
            wo_filter |= Q(product_id__in=list(set(material_ids)))
        if route_ids:
            wo_filter |= Q(process_route_id__in=list(set(route_ids)))
        if wo_filter:
            from apps.kuaizhizao.models.work_order import WorkOrder

            work_orders = await WorkOrder.filter(
                tenant_id=tenant_id, deleted_at__isnull=True
            ).filter(wo_filter).order_by("-updated_at", "-id").limit(200)
            for wo in work_orders:
                usages.append(
                    DrawingWhereUsedUsage(
                        kind="work_order",
                        uuid=wo.uuid,
                        code=wo.code,
                        name=wo.name or wo.product_name or wo.code,
                        extra=wo.status,
                    )
                )

        return DrawingWhereUsedResponse(direction="reverse", drawings=[drawing], usages=usages)
