"""
仓储管理服务模块

提供仓储管理相关的业务逻辑处理。

Author: Luigi Lu
Date: 2025-12-30
"""

from typing import List, Optional, Dict, Any
from datetime import datetime
from tortoise.transactions import in_transaction
from tortoise.expressions import Q
from loguru import logger

from apps.kuaizhizao.models.production_picking import ProductionPicking
from apps.kuaizhizao.models.production_picking_item import ProductionPickingItem
from apps.kuaizhizao.models.finished_goods_receipt import FinishedGoodsReceipt
from apps.kuaizhizao.models.finished_goods_receipt_item import FinishedGoodsReceiptItem
from apps.kuaizhizao.models.sales_delivery import SalesDelivery
from apps.kuaizhizao.models.sales_delivery_item import SalesDeliveryItem
from apps.kuaizhizao.models.purchase_receipt import PurchaseReceipt
from apps.kuaizhizao.models.purchase_receipt_item import PurchaseReceiptItem

from apps.kuaizhizao.schemas.warehouse import (
    # 生产领料单
    ProductionPickingCreate, ProductionPickingUpdate, ProductionPickingResponse, ProductionPickingListResponse,
    ProductionPickingItemCreate, ProductionPickingItemUpdate, ProductionPickingItemResponse,
    # 成品入库单
    FinishedGoodsReceiptCreate, FinishedGoodsReceiptUpdate, FinishedGoodsReceiptResponse,
    FinishedGoodsReceiptItemCreate, FinishedGoodsReceiptItemUpdate, FinishedGoodsReceiptItemResponse,
    # 销售出库单
    SalesDeliveryCreate, SalesDeliveryUpdate, SalesDeliveryResponse,
    SalesDeliveryItemCreate, SalesDeliveryItemUpdate, SalesDeliveryItemResponse,
    # 采购入库单
    PurchaseReceiptCreate, PurchaseReceiptUpdate, PurchaseReceiptResponse,
    PurchaseReceiptItemCreate, PurchaseReceiptItemUpdate, PurchaseReceiptItemResponse,
)

from core.services.base import BaseService
from infra.exceptions.exceptions import NotFoundError, ValidationError, BusinessLogicError
from infra.services.user_service import UserService


class ProductionPickingService(BaseService):
    """生产领料单服务"""

    def __init__(self):
        super().__init__(ProductionPicking)

    async def create_production_picking(self, tenant_id: int, picking_data: ProductionPickingCreate, created_by: int) -> ProductionPickingResponse:
        """创建生产领料单"""
        async with in_transaction():
            creator = await UserService.get_user_by_id(created_by)
            created_by_name = f"{creator.first_name or ''} {creator.last_name or ''}".strip() or creator.username
            code = await self._generate_picking_code(tenant_id)

            picking = await ProductionPicking.create(
                tenant_id=tenant_id,
                picking_code=code,
                created_by=created_by,
                created_by_name=created_by_name,
                **picking_data.model_dump(exclude_unset=True, exclude={'created_by'})
            )
            return ProductionPickingResponse.model_validate(picking)

    async def get_production_picking_by_id(self, tenant_id: int, picking_id: int) -> ProductionPickingResponse:
        """根据ID获取生产领料单"""
        picking = await ProductionPicking.get_or_none(tenant_id=tenant_id, id=picking_id)
        if not picking:
            raise NotFoundError(f"生产领料单不存在: {picking_id}")
        return ProductionPickingResponse.model_validate(picking)

    async def list_production_pickings(self, tenant_id: int, skip: int = 0, limit: int = 20, **filters) -> List[ProductionPickingListResponse]:
        """获取生产领料单列表"""
        query = ProductionPicking.filter(tenant_id=tenant_id)

        # 应用过滤条件
        if filters.get('status'):
            query = query.filter(status=filters['status'])
        if filters.get('work_order_id'):
            query = query.filter(work_order_id=filters['work_order_id'])

        pickings = await query.offset(skip).limit(limit).order_by('-created_at')
        return [ProductionPickingListResponse.model_validate(picking) for picking in pickings]

    async def update_production_picking(self, tenant_id: int, picking_id: int, picking_data: ProductionPickingUpdate, updated_by: int) -> ProductionPickingResponse:
        """更新生产领料单"""
        async with in_transaction():
            picking = await self.get_production_picking_by_id(tenant_id, picking_id)
            update_data = picking_data.model_dump(exclude_unset=True, exclude={'updated_by'})
            update_data['updated_by'] = updated_by

            await ProductionPicking.filter(tenant_id=tenant_id, id=picking_id).update(**update_data)
            updated_picking = await self.get_production_picking_by_id(tenant_id, picking_id)
            return updated_picking

    async def delete_production_picking(self, tenant_id: int, picking_id: int) -> bool:
        """删除生产领料单"""
        picking = await ProductionPicking.get_or_none(tenant_id=tenant_id, id=picking_id)
        if not picking:
            raise NotFoundError(f"生产领料单不存在: {picking_id}")

        if picking.status not in ['待领料', '已取消']:
            raise BusinessLogicError("只能删除待领料或已取消状态的生产领料单")

        await ProductionPicking.filter(tenant_id=tenant_id, id=picking_id).update(
            is_active=False,
            deleted_at=datetime.now()
        )
        return True

    async def confirm_picking(self, tenant_id: int, picking_id: int, confirmed_by: int) -> ProductionPickingResponse:
        """确认领料"""
        async with in_transaction():
            picking = await self.get_production_picking_by_id(tenant_id, picking_id)

            if picking.status != '待领料':
                raise BusinessLogicError("只有待领料状态的生产领料单才能确认领料")

            confirmer = await UserService.get_user_by_id(confirmed_by)
            confirmer_name = f"{confirmer.first_name or ''} {confirmer.last_name or ''}".strip() or confirmer.username

            await ProductionPicking.filter(tenant_id=tenant_id, id=picking_id).update(
                status='已领料',
                picker_id=confirmed_by,
                picker_name=confirmer_name,
                picking_time=datetime.now(),
                updated_by=confirmed_by
            )

            # TODO: 更新库存
            # TODO: 更新工单状态

            updated_picking = await self.get_production_picking_by_id(tenant_id, picking_id)
            return updated_picking

    @staticmethod
    async def _generate_picking_code(tenant_id: int) -> str:
        """生成生产领料单编码"""
        today = datetime.now().strftime("%Y%m%d")
        prefix = f"PP{today}"
        from core.services.business.code_generation_service import CodeGenerationService
        return await CodeGenerationService.generate_code(tenant_id, "PRODUCTION_PICKING_CODE", {"prefix": prefix})


class FinishedGoodsReceiptService(BaseService):
    """成品入库单服务"""

    def __init__(self):
        super().__init__(FinishedGoodsReceipt)

    async def create_finished_goods_receipt(self, tenant_id: int, receipt_data: FinishedGoodsReceiptCreate, created_by: int) -> FinishedGoodsReceiptResponse:
        """创建成品入库单"""
        async with in_transaction():
            creator = await UserService.get_user_by_id(created_by)
            created_by_name = f"{creator.first_name or ''} {creator.last_name or ''}".strip() or creator.username
            code = await self._generate_receipt_code(tenant_id)

            receipt = await FinishedGoodsReceipt.create(
                tenant_id=tenant_id,
                receipt_code=code,
                created_by=created_by,
                created_by_name=created_by_name,
                **receipt_data.model_dump(exclude_unset=True, exclude={'created_by'})
            )
            return FinishedGoodsReceiptResponse.model_validate(receipt)

    async def get_finished_goods_receipt_by_id(self, tenant_id: int, receipt_id: int) -> FinishedGoodsReceiptResponse:
        """根据ID获取成品入库单"""
        receipt = await FinishedGoodsReceipt.get_or_none(tenant_id=tenant_id, id=receipt_id)
        if not receipt:
            raise NotFoundError(f"成品入库单不存在: {receipt_id}")
        return FinishedGoodsReceiptResponse.model_validate(receipt)

    async def list_finished_goods_receipts(self, tenant_id: int, skip: int = 0, limit: int = 20, **filters) -> List[FinishedGoodsReceiptResponse]:
        """获取成品入库单列表"""
        query = FinishedGoodsReceipt.filter(tenant_id=tenant_id)

        # 应用过滤条件
        if filters.get('status'):
            query = query.filter(status=filters['status'])
        if filters.get('work_order_id'):
            query = query.filter(work_order_id=filters['work_order_id'])

        receipts = await query.offset(skip).limit(limit).order_by('-created_at')
        return [FinishedGoodsReceiptResponse.model_validate(receipt) for receipt in receipts]

    async def confirm_receipt(self, tenant_id: int, receipt_id: int, confirmed_by: int) -> FinishedGoodsReceiptResponse:
        """确认入库"""
        async with in_transaction():
            receipt = await self.get_finished_goods_receipt_by_id(tenant_id, receipt_id)

            if receipt.status != '待入库':
                raise BusinessLogicError("只有待入库状态的成品入库单才能确认入库")

            confirmer = await UserService.get_user_by_id(confirmed_by)
            confirmer_name = f"{confirmer.first_name or ''} {confirmer.last_name or ''}".strip() or confirmer.username

            await FinishedGoodsReceipt.filter(tenant_id=tenant_id, id=receipt_id).update(
                status='已入库',
                receiver_id=confirmed_by,
                receiver_name=confirmer_name,
                receipt_time=datetime.now(),
                updated_by=confirmed_by
            )

            # TODO: 更新库存
            # TODO: 更新工单状态为已完工

            updated_receipt = await self.get_finished_goods_receipt_by_id(tenant_id, receipt_id)
            return updated_receipt

    @staticmethod
    async def _generate_receipt_code(tenant_id: int) -> str:
        """生成成品入库单编码"""
        today = datetime.now().strftime("%Y%m%d")
        prefix = f"FG{today}"
        from core.services.business.code_generation_service import CodeGenerationService
        return await CodeGenerationService.generate_code(tenant_id, "FINISHED_GOODS_RECEIPT_CODE", {"prefix": prefix})


class SalesDeliveryService(BaseService):
    """销售出库单服务"""

    def __init__(self):
        super().__init__(SalesDelivery)

    async def create_sales_delivery(self, tenant_id: int, delivery_data: SalesDeliveryCreate, created_by: int) -> SalesDeliveryResponse:
        """创建销售出库单"""
        async with in_transaction():
            creator = await UserService.get_user_by_id(created_by)
            created_by_name = f"{creator.first_name or ''} {creator.last_name or ''}".strip() or creator.username
            code = await self._generate_delivery_code(tenant_id)

            delivery = await SalesDelivery.create(
                tenant_id=tenant_id,
                delivery_code=code,
                created_by=created_by,
                created_by_name=created_by_name,
                **delivery_data.model_dump(exclude_unset=True, exclude={'created_by'})
            )
            return SalesDeliveryResponse.model_validate(delivery)

    async def get_sales_delivery_by_id(self, tenant_id: int, delivery_id: int) -> SalesDeliveryResponse:
        """根据ID获取销售出库单"""
        delivery = await SalesDelivery.get_or_none(tenant_id=tenant_id, id=delivery_id)
        if not delivery:
            raise NotFoundError(f"销售出库单不存在: {delivery_id}")
        return SalesDeliveryResponse.model_validate(delivery)

    async def list_sales_deliveries(self, tenant_id: int, skip: int = 0, limit: int = 20, **filters) -> List[SalesDeliveryResponse]:
        """获取销售出库单列表"""
        query = SalesDelivery.filter(tenant_id=tenant_id)

        # 应用过滤条件
        if filters.get('status'):
            query = query.filter(status=filters['status'])
        if filters.get('sales_order_id'):
            query = query.filter(sales_order_id=filters['sales_order_id'])

        deliveries = await query.offset(skip).limit(limit).order_by('-created_at')
        return [SalesDeliveryResponse.model_validate(delivery) for delivery in deliveries]

    async def confirm_delivery(self, tenant_id: int, delivery_id: int, confirmed_by: int) -> SalesDeliveryResponse:
        """确认出库"""
        async with in_transaction():
            delivery = await self.get_sales_delivery_by_id(tenant_id, delivery_id)

            if delivery.status != '待出库':
                raise BusinessLogicError("只有待出库状态的销售出库单才能确认出库")

            confirmer = await UserService.get_user_by_id(confirmed_by)
            confirmer_name = f"{confirmer.first_name or ''} {confirmer.last_name or ''}".strip() or confirmer.username

            await SalesDelivery.filter(tenant_id=tenant_id, id=delivery_id).update(
                status='已出库',
                deliverer_id=confirmed_by,
                deliverer_name=confirmer_name,
                delivery_time=datetime.now(),
                updated_by=confirmed_by
            )

            # TODO: 更新库存
            # TODO: 更新销售订单状态

            updated_delivery = await self.get_sales_delivery_by_id(tenant_id, delivery_id)
            return updated_delivery

    @staticmethod
    async def _generate_delivery_code(tenant_id: int) -> str:
        """生成销售出库单编码"""
        today = datetime.now().strftime("%Y%m%d")
        prefix = f"SD{today}"
        from core.services.business.code_generation_service import CodeGenerationService
        return await CodeGenerationService.generate_code(tenant_id, "SALES_DELIVERY_CODE", {"prefix": prefix})


class PurchaseReceiptService(BaseService):
    """采购入库单服务"""

    def __init__(self):
        super().__init__(PurchaseReceipt)

    async def create_purchase_receipt(self, tenant_id: int, receipt_data: PurchaseReceiptCreate, created_by: int) -> PurchaseReceiptResponse:
        """创建采购入库单"""
        async with in_transaction():
            creator = await UserService.get_user_by_id(created_by)
            created_by_name = f"{creator.first_name or ''} {creator.last_name or ''}".strip() or creator.username
            code = await self._generate_receipt_code(tenant_id)

            receipt = await PurchaseReceipt.create(
                tenant_id=tenant_id,
                receipt_code=code,
                created_by=created_by,
                created_by_name=created_by_name,
                **receipt_data.model_dump(exclude_unset=True, exclude={'created_by'})
            )
            return PurchaseReceiptResponse.model_validate(receipt)

    async def get_purchase_receipt_by_id(self, tenant_id: int, receipt_id: int) -> PurchaseReceiptResponse:
        """根据ID获取采购入库单"""
        receipt = await PurchaseReceipt.get_or_none(tenant_id=tenant_id, id=receipt_id)
        if not receipt:
            raise NotFoundError(f"采购入库单不存在: {receipt_id}")
        return PurchaseReceiptResponse.model_validate(receipt)

    async def list_purchase_receipts(self, tenant_id: int, skip: int = 0, limit: int = 20, **filters) -> List[PurchaseReceiptResponse]:
        """获取采购入库单列表"""
        query = PurchaseReceipt.filter(tenant_id=tenant_id)

        # 应用过滤条件
        if filters.get('status'):
            query = query.filter(status=filters['status'])
        if filters.get('purchase_order_id'):
            query = query.filter(purchase_order_id=filters['purchase_order_id'])

        receipts = await query.offset(skip).limit(limit).order_by('-created_at')
        return [PurchaseReceiptResponse.model_validate(receipt) for receipt in receipts]

    async def confirm_receipt(self, tenant_id: int, receipt_id: int, confirmed_by: int) -> PurchaseReceiptResponse:
        """确认入库"""
        async with in_transaction():
            receipt = await self.get_purchase_receipt_by_id(tenant_id, receipt_id)

            if receipt.status != '待入库':
                raise BusinessLogicError("只有待入库状态的采购入库单才能确认入库")

            confirmer = await UserService.get_user_by_id(confirmed_by)
            confirmer_name = f"{confirmer.first_name or ''} {confirmer.last_name or ''}".strip() or confirmer.username

            await PurchaseReceipt.filter(tenant_id=tenant_id, id=receipt_id).update(
                status='已入库',
                receiver_id=confirmed_by,
                receiver_name=confirmer_name,
                receipt_time=datetime.now(),
                updated_by=confirmed_by
            )

            # TODO: 更新库存
            # TODO: 更新采购订单状态

            updated_receipt = await self.get_purchase_receipt_by_id(tenant_id, receipt_id)
            return updated_receipt

    @staticmethod
    async def _generate_receipt_code(tenant_id: int) -> str:
        """生成采购入库单编码"""
        today = datetime.now().strftime("%Y%m%d")
        prefix = f"PR{today}"
        from core.services.business.code_generation_service import CodeGenerationService
        return await CodeGenerationService.generate_code(tenant_id, "PURCHASE_RECEIPT_CODE", {"prefix": prefix})
