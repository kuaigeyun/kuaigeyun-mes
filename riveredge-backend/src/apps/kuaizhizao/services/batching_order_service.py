"""
配料单业务服务模块

提供配料单相关的业务逻辑处理，包括从工单生成配料单、确认配料等。
配料：按工单或计划，从主仓/线边仓拣选物料并按 BOM 配好，供产线使用。

Author: Luigi Lu
Date: 2026-02-28
"""

import uuid
from datetime import datetime
from typing import List, Optional
from decimal import Decimal

from tortoise.transactions import in_transaction

from apps.kuaizhizao.models.batching_order import BatchingOrder, BatchingOrderItem
from apps.kuaizhizao.models.work_order import WorkOrder
from apps.kuaizhizao.schemas.batching_order import (
    BatchingOrderCreate,
    BatchingOrderUpdate,
    BatchingOrderResponse,
    BatchingOrderListResponse,
    BatchingOrderItemCreate,
    BatchingOrderItemResponse,
    BatchingOrderWithItemsResponse,
    PullFromWorkOrderRequest,
)
from apps.kuaizhizao.utils.bom_helper import calculate_material_requirements_from_bom

from apps.base_service import AppBaseService
from infra.exceptions.exceptions import NotFoundError, ValidationError, BusinessLogicError
from infra.services.business_config_service import BusinessConfigService


class BatchingOrderService(AppBaseService[BatchingOrder]):
    def __init__(self):
        super().__init__(BatchingOrder)
        self.business_config_service = BusinessConfigService()

    async def create_batching_order(
        self,
        tenant_id: int,
        order_data: BatchingOrderCreate,
        created_by: int,
        items: Optional[List[BatchingOrderItemCreate]] = None,
    ) -> BatchingOrderResponse:
        async with in_transaction():
            today = datetime.now().strftime("%Y%m%d")
            code = await self.generate_code(
                tenant_id=tenant_id,
                code_type="BATCHING_ORDER_CODE",
                prefix=f"PL{today}",
            )
            user_info = await self.get_user_info(created_by)

            order = await BatchingOrder.create(
                tenant_id=tenant_id,
                uuid=str(uuid.uuid4()),
                code=code,
                warehouse_id=order_data.warehouse_id,
                warehouse_name=order_data.warehouse_name,
                work_order_id=order_data.work_order_id,
                work_order_code=order_data.work_order_code,
                production_plan_id=order_data.production_plan_id,
                batching_date=order_data.batching_date,
                status="draft",
                total_items=0,
                target_warehouse_id=order_data.target_warehouse_id,
                target_warehouse_name=order_data.target_warehouse_name,
                remarks=order_data.remarks,
                created_by=created_by,
                created_by_name=user_info["name"],
                updated_by=created_by,
                updated_by_name=user_info["name"],
            )

            if items:
                for item_data in items:
                    await BatchingOrderItem.create(
                        tenant_id=tenant_id,
                        uuid=str(uuid.uuid4()),
                        batching_order_id=order.id,
                        material_id=item_data.material_id,
                        material_code=item_data.material_code,
                        material_name=item_data.material_name,
                        unit=item_data.unit or "",
                        required_quantity=item_data.required_quantity,
                        picked_quantity=Decimal("0"),
                        warehouse_id=item_data.warehouse_id,
                        warehouse_name=item_data.warehouse_name,
                        location_id=item_data.location_id,
                        location_code=item_data.location_code,
                        batch_no=item_data.batch_no,
                        status="pending",
                        remarks=item_data.remarks,
                    )
                order.total_items = len(items)
                await order.save()

            return BatchingOrderResponse.model_validate(order)

    async def pull_from_work_order(
        self,
        tenant_id: int,
        request_data: PullFromWorkOrderRequest,
        created_by: int,
    ) -> BatchingOrderWithItemsResponse:
        work_order = await WorkOrder.get_or_none(
            id=request_data.work_order_id,
            tenant_id=tenant_id,
            deleted_at__isnull=True,
        )
        if not work_order:
            raise NotFoundError(f"工单不存在: {request_data.work_order_id}")

        if not work_order.product_id:
            raise ValidationError("工单未关联产品物料，无法按 BOM 展开配料需求")

        batching_date = request_data.batching_date or datetime.now()
        requirements = await calculate_material_requirements_from_bom(
            tenant_id=tenant_id,
            material_id=work_order.product_id,
            required_quantity=float(work_order.quantity or work_order.completed_quantity or 1),
        )

        if not requirements:
            raise ValidationError("工单产品无 BOM 或 BOM 未审核，无法展开物料需求")

        async with in_transaction():
            today = datetime.now().strftime("%Y%m%d")
            code = await self.generate_code(
                tenant_id=tenant_id,
                code_type="BATCHING_ORDER_CODE",
                prefix=f"PL{today}",
            )
            user_info = await self.get_user_info(created_by)

            order = await BatchingOrder.create(
                tenant_id=tenant_id,
                uuid=str(uuid.uuid4()),
                code=code,
                warehouse_id=request_data.warehouse_id,
                warehouse_name=request_data.warehouse_name,
                work_order_id=work_order.id,
                work_order_code=work_order.code,
                production_plan_id=None,
                batching_date=batching_date,
                status="draft",
                total_items=len(requirements),
                target_warehouse_id=request_data.target_warehouse_id,
                target_warehouse_name=request_data.target_warehouse_name,
                remarks=request_data.remarks,
                created_by=created_by,
                created_by_name=user_info["name"],
                updated_by=created_by,
                updated_by_name=user_info["name"],
            )

            for req in requirements:
                await BatchingOrderItem.create(
                    tenant_id=tenant_id,
                    uuid=str(uuid.uuid4()),
                    batching_order_id=order.id,
                    material_id=req.component_id,
                    material_code=req.component_code,
                    material_name=req.component_name,
                    unit=req.unit or "",
                    required_quantity=Decimal(str(req.net_requirement)),
                    picked_quantity=Decimal("0"),
                    warehouse_id=request_data.warehouse_id,
                    warehouse_name=request_data.warehouse_name,
                    status="pending",
                )

            return await self.get_batching_order_by_id(tenant_id, order.id)

    async def get_batching_order_by_id(
        self,
        tenant_id: int,
        order_id: int,
    ) -> BatchingOrderWithItemsResponse:
        order = await BatchingOrder.get_or_none(
            id=order_id,
            tenant_id=tenant_id,
            deleted_at__isnull=True,
        )
        if not order:
            raise NotFoundError(f"配料单不存在: {order_id}")

        items = await BatchingOrderItem.filter(
            batching_order_id=order_id,
            tenant_id=tenant_id,
            deleted_at__isnull=True,
        ).order_by("id")

        response = BatchingOrderWithItemsResponse.model_validate(order)
        response.items = [BatchingOrderItemResponse.model_validate(item) for item in items]
        return response

    async def update_batching_order(
        self,
        tenant_id: int,
        order_id: int,
        order_data: BatchingOrderUpdate,
        updated_by: int,
    ) -> BatchingOrderResponse:
        order = await BatchingOrder.get_or_none(
            id=order_id,
            tenant_id=tenant_id,
            deleted_at__isnull=True,
        )
        if not order:
            raise NotFoundError(f"配料单不存在: {order_id}")
        if order.status not in ["draft", "picking"]:
            raise ValidationError(f"配料单状态为 {order.status}，不能修改")

        user_info = await self.get_user_info(updated_by)

        for field, value in order_data.model_dump(exclude_unset=True).items():
            setattr(order, field, value)

        order.updated_by = updated_by
        order.updated_by_name = user_info["name"]
        await order.save()
        return BatchingOrderResponse.model_validate(order)

    async def list_batching_orders(
        self,
        tenant_id: int,
        skip: int = 0,
        limit: int = 100,
        code: Optional[str] = None,
        warehouse_id: Optional[int] = None,
        work_order_id: Optional[int] = None,
        status: Optional[str] = None,
    ) -> BatchingOrderListResponse:
        query = BatchingOrder.filter(
            tenant_id=tenant_id,
            deleted_at__isnull=True,
        )
        if code:
            query = query.filter(code__icontains=code)
        if warehouse_id:
            query = query.filter(warehouse_id=warehouse_id)
        if work_order_id:
            query = query.filter(work_order_id=work_order_id)
        if status:
            query = query.filter(status=status)

        total = await query.count()
        orders = await query.order_by("-created_at").offset(skip).limit(limit)
        return BatchingOrderListResponse(
            items=[BatchingOrderResponse.model_validate(o) for o in orders],
            total=total,
        )

    async def confirm_batching_order(
        self,
        tenant_id: int,
        order_id: int,
        executed_by: int,
    ) -> BatchingOrderResponse:
        async with in_transaction():
            order = await BatchingOrder.get_or_none(
                id=order_id,
                tenant_id=tenant_id,
                deleted_at__isnull=True,
            )
            if not order:
                raise NotFoundError(f"配料单不存在: {order_id}")
            if order.status not in ["draft", "picking"]:
                raise ValidationError(f"配料单状态为 {order.status}，不能确认配料")

            items = await BatchingOrderItem.filter(
                batching_order_id=order_id,
                tenant_id=tenant_id,
                deleted_at__isnull=True,
            )
            if not items:
                raise ValidationError("配料单没有明细")

            user_info = await self.get_user_info(executed_by)
            executed_at = datetime.now()

            for item in items:
                item.picked_quantity = item.required_quantity
                item.status = "picked"
                await item.save()

            order.status = "completed"
            order.executed_by = executed_by
            order.executed_by_name = user_info["name"]
            order.executed_at = executed_at
            order.updated_by = executed_by
            order.updated_by_name = user_info["name"]
            await order.save()

            # 调用统一库存服务扣减主仓库存（配料从主仓拣选，warehouse_id=None 表示主仓 MaterialBatch）
            from apps.kuaizhizao.services.inventory_service import InventoryService

            for item in items:
                await InventoryService.decrease_stock(
                    tenant_id=tenant_id,
                    material_id=item.material_id,
                    quantity=item.required_quantity,
                    warehouse_id=None,  # 主仓
                    batch_no=getattr(item, "batch_no", None),
                    source_type="batching_order",
                    source_doc_id=order.id,
                    source_doc_code=order.code,
                )

            return BatchingOrderResponse.model_validate(order)

    async def delete_batching_order(self, tenant_id: int, order_id: int) -> bool:
        order = await BatchingOrder.get_or_none(
            id=order_id,
            tenant_id=tenant_id,
            deleted_at__isnull=True,
        )
        if not order:
            raise NotFoundError(f"配料单不存在: {order_id}")
        if order.status != "draft":
            raise ValidationError(f"配料单状态为 {order.status}，不能删除")

        now = datetime.now()
        await BatchingOrder.filter(id=order_id, tenant_id=tenant_id).update(deleted_at=now)
        await BatchingOrderItem.filter(batching_order_id=order_id, tenant_id=tenant_id).update(deleted_at=now)
        return True
