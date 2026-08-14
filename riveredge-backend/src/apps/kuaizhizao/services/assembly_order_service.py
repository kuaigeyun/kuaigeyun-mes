"""
组装单业务服务模块

提供组装单相关的业务逻辑处理，包括组装单创建、添加明细、执行组装等。
组装：消耗组件库存，增加成品库存。

Author: Luigi Lu
Date: 2026-02-26
"""

import uuid
from datetime import datetime
from typing import List, Optional
from decimal import Decimal

from tortoise.transactions import in_transaction

from apps.kuaizhizao.models.assembly_order import AssemblyOrder, AssemblyOrderItem
from apps.kuaizhizao.models.assembly_material_binding import AssemblyMaterialBinding
from apps.kuaizhizao.schemas.assembly_order import (
    AssemblyOrderCreate,
    AssemblyOrderUpdate,
    AssemblyOrderResponse,
    AssemblyOrderListResponse,
    AssemblyOrderItemCreate,
    AssemblyOrderItemCreateInput,
    AssemblyOrderItemUpdate,
    AssemblyOrderItemResponse,
    AssemblyOrderWithItemsResponse,
)
from apps.kuaizhizao.schemas.assembly_material_binding import (
    AssemblyMaterialBindingCreate,
    ExecuteAssemblyOrderRequest,
)
from apps.kuaizhizao.models.assembly_template import AssemblyTemplate, AssemblyTemplateItem
from apps.kuaizhizao.schemas.assembly_template import ApplyAssemblyTemplateRequest

from apps.common.base_service import AppBaseService
from infra.exceptions.exceptions import NotFoundError, ValidationError, BusinessLogicError, ConflictError
from infra.services.business_config_service import BusinessConfigService
from core.utils.timezone_utils import resolve_business_datetime, today_site_str


class AssemblyOrderService(AppBaseService[AssemblyOrder]):
    def __init__(self):
        super().__init__(AssemblyOrder)
        self.business_config_service = BusinessConfigService()

    async def create_assembly_order(
        self,
        tenant_id: int,
        order_data: AssemblyOrderCreate,
        created_by: int
    ) -> AssemblyOrderResponse:
        is_enabled = await self.business_config_service.check_node_enabled(tenant_id, "assembly_order")
        if not is_enabled:
            raise BusinessLogicError("组装单节点未启用，无法创建组装单")
        async with in_transaction():
            today = today_site_str()
            code = await self.generate_code(
                tenant_id=tenant_id,
                code_type="ASSEMBLY_ORDER_CODE",
                prefix=f"ZZD{today}"
            )
            user_info = await self.get_user_info(created_by)

            template_id = order_data.assembly_template_id
            template_code = order_data.assembly_template_code
            if template_id and not template_code:
                template = await AssemblyTemplate.get_or_none(
                    id=template_id,
                    tenant_id=tenant_id,
                    deleted_at__isnull=True,
                    is_active=True,
                )
                if template:
                    template_code = template.template_code

            order = await AssemblyOrder.create(
                tenant_id=tenant_id,
                uuid=str(uuid.uuid4()),
                code=code,
                warehouse_id=order_data.warehouse_id,
                warehouse_name=order_data.warehouse_name,
                assembly_date=order_data.assembly_date,
                status="draft",
                product_material_id=order_data.product_material_id,
                product_material_code=order_data.product_material_code,
                product_material_name=order_data.product_material_name,
                total_quantity=order_data.total_quantity or Decimal("0"),
                assembly_template_id=template_id,
                assembly_template_code=template_code,
                total_items=0,
                remarks=order_data.remarks,
                created_by=created_by,
                created_by_name=user_info["name"],
                updated_by=created_by,
                updated_by_name=user_info["name"],
            )
            return AssemblyOrderResponse.model_validate(order)

    async def get_assembly_order_by_id(
        self,
        tenant_id: int,
        order_id: int
    ) -> AssemblyOrderWithItemsResponse:
        order = await AssemblyOrder.get_or_none(
            id=order_id,
            tenant_id=tenant_id,
            deleted_at__isnull=True
        )
        if not order:
            raise NotFoundError(f"组装单不存在: {order_id}")

        items = await AssemblyOrderItem.filter(
            assembly_order_id=order_id,
            tenant_id=tenant_id,
            deleted_at__isnull=True
        ).order_by('id')

        from apps.kuaizhizao.services.document_lifecycle_service import get_assembly_order_lifecycle, get_document_milestones
        milestones = await get_document_milestones(order.tenant_id, "assembly_order", order.id)
        
        response = AssemblyOrderWithItemsResponse.model_validate(order)
        response.items = [AssemblyOrderItemResponse.model_validate(item) for item in items]
        response.lifecycle = get_assembly_order_lifecycle(order, milestones=milestones)
        return response

    async def update_assembly_order(
        self,
        tenant_id: int,
        order_id: int,
        order_data: AssemblyOrderUpdate,
        updated_by: int
    ) -> AssemblyOrderResponse:
        async with in_transaction():
            order = await AssemblyOrder.get_or_none(
                id=order_id,
                tenant_id=tenant_id,
                deleted_at__isnull=True
            )
            if not order:
                raise NotFoundError(f"组装单不存在: {order_id}")
            if order.status not in ['draft']:
                raise ValidationError(f"组装单状态为{order.status}，不能修改")

            user_info = await self.get_user_info(updated_by)

            for field, value in order_data.model_dump(exclude_unset=True).items():
                setattr(order, field, value)

            order.updated_by = updated_by
            order.updated_by_name = user_info["name"]
            await order.save()
            return AssemblyOrderResponse.model_validate(order)

    async def list_assembly_orders(
        self,
        tenant_id: int,
        skip: int = 0,
        limit: int = 100,
        code: Optional[str] = None,
        warehouse_id: Optional[int] = None,
        status: Optional[str] = None,
        keyword: Optional[str] = None,
        search: Optional[str] = None,
        order_by: Optional[str] = None,
        assembly_date_start: Optional[str] = None,
        assembly_date_end: Optional[str] = None,
        created_start_date: Optional[str] = None,
        created_end_date: Optional[str] = None,
        updated_start_date: Optional[str] = None,
        updated_end_date: Optional[str] = None,
    ) -> AssemblyOrderListResponse:
        from apps.kuaizhizao.services.equipment_list_core import pick_search_keyword
        from apps.kuaizhizao.services.warehouse_list_core import (
            ASSEMBLY_ORDER_KEYWORD_FIELDS,
            ASSEMBLY_ORDER_SORTABLE_FIELDS,
            apply_warehouse_doc_list_filters,
        )

        query = AssemblyOrder.filter(
            tenant_id=tenant_id,
            deleted_at__isnull=True
        )
        if warehouse_id:
            query = query.filter(warehouse_id=warehouse_id)
        if status:
            query = query.filter(status=status)

        merged_keyword = pick_search_keyword(keyword, search) or (code.strip() if code and code.strip() else None)
        query, order_clause = apply_warehouse_doc_list_filters(
            query,
            keyword=merged_keyword,
            order_by=order_by,
            allowed_fields=ASSEMBLY_ORDER_SORTABLE_FIELDS,
            default_order="-created_at",
            keyword_fields=ASSEMBLY_ORDER_KEYWORD_FIELDS,
            doc_date_field="assembly_date",
            doc_start_date=assembly_date_start,
            doc_end_date=assembly_date_end,
            created_start_date=created_start_date,
            created_end_date=created_end_date,
            updated_start_date=updated_start_date,
            updated_end_date=updated_end_date,
        )

        total = await query.count()
        orders = await query.order_by(order_clause).offset(skip).limit(limit)
        from apps.kuaizhizao.services.document_lifecycle_service import get_assembly_order_lifecycle

        items: list[AssemblyOrderResponse] = []
        for order in orders:
            resp = AssemblyOrderResponse.model_validate(order)
            resp.lifecycle = get_assembly_order_lifecycle(order, milestones=[])
            items.append(resp)
        return AssemblyOrderListResponse(items=items, total=total)

    async def create_assembly_order_item(
        self,
        tenant_id: int,
        order_id: int,
        item_data: AssemblyOrderItemCreateInput,
        created_by: int
    ) -> AssemblyOrderItemResponse:
        async with in_transaction():
            order = await AssemblyOrder.get_or_none(
                id=order_id,
                tenant_id=tenant_id,
                deleted_at__isnull=True
            )
            if not order:
                raise NotFoundError(f"组装单不存在: {order_id}")
            if order.status not in ['draft']:
                raise ValidationError(f"组装单状态为{order.status}，不能添加明细")

            amount = item_data.quantity * item_data.unit_price

            item = await AssemblyOrderItem.create(
                tenant_id=tenant_id,
                uuid=str(uuid.uuid4()),
                assembly_order_id=order_id,
                material_id=item_data.material_id,
                material_code=item_data.material_code,
                material_name=item_data.material_name,
                quantity=item_data.quantity,
                unit_price=item_data.unit_price,
                amount=amount,
                status="pending",
                remarks=item_data.remarks,
            )

            await self._update_order_statistics(tenant_id, order_id)
            return AssemblyOrderItemResponse.model_validate(item)

    async def update_assembly_order_item(
        self,
        tenant_id: int,
        item_id: int,
        item_data: AssemblyOrderItemUpdate,
        updated_by: int
    ) -> AssemblyOrderItemResponse:
        async with in_transaction():
            item = await AssemblyOrderItem.get_or_none(
                id=item_id,
                tenant_id=tenant_id,
                deleted_at__isnull=True
            )
            if not item:
                raise NotFoundError(f"组装明细不存在: {item_id}")
            if item.status != 'pending':
                raise ValidationError(f"组装明细状态为{item.status}，不能修改")

            if item_data.quantity is not None:
                item.quantity = item_data.quantity
            if item_data.unit_price is not None:
                item.unit_price = item_data.unit_price
            if item_data.remarks is not None:
                item.remarks = item_data.remarks

            item.amount = item.quantity * item.unit_price
            await item.save()

            await self._update_order_statistics(tenant_id, item.assembly_order_id)
            return AssemblyOrderItemResponse.model_validate(item)

    async def delete_assembly_order_item(
        self,
        tenant_id: int,
        order_id: int,
        item_id: int,
        deleted_by: int,
    ) -> bool:
        """删除组装明细（软删除，仅草稿单且待处理明细可删）"""
        _ = deleted_by
        async with in_transaction():
            item = await AssemblyOrderItem.get_or_none(
                id=item_id,
                tenant_id=tenant_id,
                deleted_at__isnull=True,
            )
            if not item or int(item.assembly_order_id) != int(order_id):
                raise NotFoundError(f"组装明细不存在: {item_id}")

            order = await AssemblyOrder.get_or_none(
                id=order_id,
                tenant_id=tenant_id,
                deleted_at__isnull=True,
            )
            if not order:
                raise NotFoundError(f"组装单不存在: {order_id}")
            if order.status != "draft":
                raise ValidationError(f"组装单状态为{order.status}，不能删除明细")
            if item.status != "pending":
                raise ValidationError(f"组装明细状态为{item.status}，不能删除")

            item.deleted_at = resolve_business_datetime()
            await item.save(update_fields=["deleted_at"])
            await self._update_order_statistics(tenant_id, order_id)
            return True

    async def execute_assembly_order(
        self,
        tenant_id: int,
        order_id: int,
        executed_by: int,
        request_data: Optional[ExecuteAssemblyOrderRequest] = None
    ) -> AssemblyOrderResponse:
        async with in_transaction():
            order = await AssemblyOrder.get_or_none(
                id=order_id,
                tenant_id=tenant_id,
                deleted_at__isnull=True
            )
            if not order:
                raise NotFoundError(f"组装单不存在: {order_id}")
            if order.status != 'draft':
                raise ValidationError(f"组装单状态为{order.status}，不能执行")

            items = await AssemblyOrderItem.filter(
                assembly_order_id=order_id,
                tenant_id=tenant_id,
                deleted_at__isnull=True,
                status='pending'
            )
            if not items:
                raise ValidationError("组装单没有待消耗的明细")

            # 调用统一库存服务：消耗组件、增加成品
            from apps.kuaizhizao.services.inventory_service import InventoryService

            for item in items:
                await InventoryService.decrease_stock(
                    tenant_id=tenant_id,
                    material_id=item.material_id,
                    quantity=item.quantity,
                    warehouse_id=order.warehouse_id,
                    source_type="assembly_order",
                    source_doc_id=order_id,
                    source_doc_code=order.code,
                )
                item.status = "consumed"
                await item.save()

            await InventoryService.increase_stock(
                tenant_id=tenant_id,
                material_id=order.product_material_id,
                quantity=order.total_quantity,
                warehouse_id=order.warehouse_id,
                source_type="assembly_order",
                source_doc_id=order_id,
                source_doc_code=order.code,
            )

            user_info = await self.get_user_info(executed_by)
            executed_at = resolve_business_datetime()
            order.status = "completed"
            order.executed_by = executed_by
            order.executed_by_name = user_info["name"]
            order.executed_at = executed_at
            order.updated_by = executed_by
            order.updated_by_name = user_info["name"]
            await order.save()

            # 创建装配物料绑定记录（可选，用于追溯）
            if request_data and request_data.material_bindings:
                for binding in request_data.material_bindings:
                    await AssemblyMaterialBinding.create(
                        tenant_id=tenant_id,
                        uuid=str(uuid.uuid4()),
                        assembly_order_id=order_id,
                        assembly_order_item_id=binding.assembly_order_item_id,
                        parent_material_id=binding.parent_material_id,
                        parent_material_code=binding.parent_material_code,
                        parent_material_name=binding.parent_material_name,
                        parent_batch_no=binding.parent_batch_no,
                        child_material_id=binding.child_material_id,
                        child_material_code=binding.child_material_code,
                        child_material_name=binding.child_material_name,
                        child_batch_no=binding.child_batch_no,
                        quantity=binding.quantity,
                        executed_by=executed_by,
                        executed_by_name=user_info["name"],
                        executed_at=executed_at,
                        remarks=binding.remarks,
                    )

            return AssemblyOrderResponse.model_validate(order)

    async def apply_template_to_order(
        self,
        tenant_id: int,
        order_id: int,
        request: ApplyAssemblyTemplateRequest,
        updated_by: int,
    ) -> AssemblyOrderWithItemsResponse:
        async with in_transaction():
            order = await AssemblyOrder.get_or_none(
                id=order_id, tenant_id=tenant_id, deleted_at__isnull=True
            )
            if not order:
                raise NotFoundError(f"组装单不存在: {order_id}")
            if order.status != "draft":
                raise ValidationError(f"组装单状态为{order.status}，不能套用模板")

            template = await AssemblyTemplate.get_or_none(
                id=request.template_id,
                tenant_id=tenant_id,
                deleted_at__isnull=True,
                is_active=True,
            )
            if not template:
                raise NotFoundError(f"组装模板不存在或未启用: {request.template_id}")

            template_items = await AssemblyTemplateItem.filter(
                tenant_id=tenant_id,
                template_id=template.id,
                deleted_at__isnull=True,
            ).order_by("sequence", "id")
            if not template_items:
                raise ValidationError("组装模板无明细，无法套用")

            pending_items = await AssemblyOrderItem.filter(
                tenant_id=tenant_id,
                assembly_order_id=order_id,
                deleted_at__isnull=True,
                status="pending",
            )
            if pending_items and not request.replace_existing:
                raise ConflictError(
                    "组装单已有明细，请确认覆盖后再套用模板",
                    {"pending_count": len(pending_items)},
                )

            now = resolve_business_datetime()
            if pending_items:
                await AssemblyOrderItem.filter(
                    tenant_id=tenant_id,
                    assembly_order_id=order_id,
                    deleted_at__isnull=True,
                    status="pending",
                ).update(deleted_at=now)

            total_qty = Decimal(str(order.total_quantity or 0))
            if total_qty <= 0:
                raise ValidationError("请先填写组装数量后再套用模板")

            for tpl_item in template_items:
                qty = Decimal(str(tpl_item.quantity_per_base)) * total_qty
                unit_price = tpl_item.unit_price or Decimal("0")
                await AssemblyOrderItem.create(
                    tenant_id=tenant_id,
                    uuid=str(uuid.uuid4()),
                    assembly_order_id=order_id,
                    material_id=tpl_item.material_id,
                    material_code=tpl_item.material_code,
                    material_name=tpl_item.material_name,
                    quantity=qty,
                    unit_price=unit_price,
                    amount=qty * unit_price,
                    status="pending",
                    remarks=tpl_item.remarks,
                )

            user_info = await self.get_user_info(updated_by)
            order.assembly_template_id = template.id
            order.assembly_template_code = template.template_code
            order.updated_by = updated_by
            order.updated_by_name = user_info["name"]
            await order.save()
            await self._update_order_statistics(tenant_id, order_id)

            return await self.get_assembly_order_by_id(tenant_id, order_id)

    async def delete_assembly_order(self, tenant_id: int, order_id: int) -> bool:
        """删除组装单（软删除，仅草稿可删）"""
        order = await AssemblyOrder.get_or_none(
            id=order_id,
            tenant_id=tenant_id,
            deleted_at__isnull=True
        )
        if not order:
            raise NotFoundError(f"组装单不存在: {order_id}")
        if order.status not in ['draft']:
            raise ValidationError(f"组装单状态为{order.status}，不能删除")
        await AssemblyOrder.filter(id=order_id, tenant_id=tenant_id).update(
            deleted_at=resolve_business_datetime()
        )
        return True

    async def _update_order_statistics(self, tenant_id: int, order_id: int) -> None:
        items = await AssemblyOrderItem.filter(
            assembly_order_id=order_id,
            tenant_id=tenant_id,
            deleted_at__isnull=True
        )
        order = await AssemblyOrder.get(id=order_id)
        order.total_items = len(items)
        await order.save()
