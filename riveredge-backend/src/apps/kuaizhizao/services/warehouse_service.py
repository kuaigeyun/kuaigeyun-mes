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

from apps.base_service import AppBaseService
from infra.exceptions.exceptions import NotFoundError, ValidationError, BusinessLogicError

class ProductionPickingService(AppBaseService[ProductionPicking]):
    """生产领料单服务"""

    def __init__(self):
        super().__init__(ProductionPicking)

    async def create_production_picking(self, tenant_id: int, picking_data: ProductionPickingCreate, created_by: int) -> ProductionPickingResponse:
        """创建生产领料单"""
        async with in_transaction():
            user_info = await self.get_user_info(created_by)
            today = datetime.now().strftime("%Y%m%d")
            code = await self.generate_code(tenant_id, "PRODUCTION_PICKING_CODE", prefix=f"PP{today}")

            picking = await ProductionPicking.create(
                tenant_id=tenant_id,
                picking_code=code,
                created_by=created_by,
                created_by_name=user_info["name"],
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

            confirmer_name = await self.get_user_name(confirmed_by)

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

    async def quick_pick_from_work_order(
        self,
        tenant_id: int,
        work_order_id: int,
        created_by: int,
        warehouse_id: Optional[int] = None,
        warehouse_name: Optional[str] = None
    ) -> ProductionPickingResponse:
        """
        一键领料：从工单下推，根据BOM自动生成领料需求
        
        Args:
            tenant_id: 租户ID
            work_order_id: 工单ID
            created_by: 创建人ID
            warehouse_id: 仓库ID（可选，如果不提供则使用物料默认仓库）
            warehouse_name: 仓库名称（可选）
            
        Returns:
            ProductionPickingResponse: 创建的生产领料单
            
        Raises:
            NotFoundError: 工单不存在或BOM不存在
            ValidationError: 数据验证失败
        """
        from apps.kuaizhizao.models.work_order import WorkOrder
        from apps.kuaizhizao.utils.bom_helper import calculate_material_requirements_from_bom
        from apps.kuaizhizao.services.work_order_service import WorkOrderService
        from decimal import Decimal
        
        async with in_transaction():
            # 1. 获取工单信息
            work_order = await WorkOrder.get_or_none(tenant_id=tenant_id, id=work_order_id)
            if not work_order:
                raise NotFoundError(f"工单不存在: {work_order_id}")
            
            # 检查工单状态
            if work_order.status not in ['已下达', '进行中']:
                raise BusinessLogicError(f"工单状态为 {work_order.status}，无法创建领料单")
            
            # 2. 从master_data获取产品的BOM并计算物料需求
            try:
                material_requirements = await calculate_material_requirements_from_bom(
                    tenant_id=tenant_id,
                    material_id=work_order.product_id,
                    required_quantity=float(work_order.quantity),
                    only_approved=True
                )
            except NotFoundError as e:
                raise NotFoundError(f"产品 {work_order.product_code} 的BOM不存在或未审核: {e}")
            
            if not material_requirements:
                raise ValidationError("BOM中没有物料明细，无法生成领料单")
            
            # 4. 生成领料单编码
            today = datetime.now().strftime("%Y%m%d")
            picking_code = await self.generate_code(tenant_id, "PRODUCTION_PICKING_CODE", prefix=f"PP{today}")
            
            # 5. 创建生产领料单
            picking = await ProductionPicking.create(
                tenant_id=tenant_id,
                picking_code=picking_code,
                work_order_id=work_order_id,
                work_order_code=work_order.code,
                workshop_id=work_order.workshop_id,
                workshop_name=work_order.workshop_name,
                status='待领料',
                created_by=created_by,
                updated_by=created_by
            )
            
            # 6. 创建领料单明细
            for req in material_requirements:
                # 获取物料默认仓库（如果未指定仓库）
                final_warehouse_id = warehouse_id
                final_warehouse_name = warehouse_name
                
                # TODO: 从物料主数据获取默认仓库
                # 暂时使用传入的仓库或使用第一个仓库
                if not final_warehouse_id:
                    # 这里应该从物料主数据获取默认仓库
                    # 暂时跳过，后续完善
                    logger.warning(f"物料 {req.component_code} 未指定仓库，跳过")
                    continue
                
                await ProductionPickingItem.create(
                    tenant_id=tenant_id,
                    picking_id=picking.id,
                    material_id=req.component_id,
                    material_code=req.component_code,
                    material_name=req.component_name,
                    material_unit=req.unit,
                    required_quantity=Decimal(str(req.gross_requirement)),
                    picked_quantity=Decimal('0'),
                    remaining_quantity=Decimal(str(req.gross_requirement)),
                    warehouse_id=final_warehouse_id,
                    warehouse_name=final_warehouse_name or '',
                    status='待领料'
                )
            
            return ProductionPickingResponse.model_validate(picking)
    
    async def batch_pick_from_work_orders(
        self,
        tenant_id: int,
        work_order_ids: List[int],
        created_by: int,
        warehouse_id: Optional[int] = None,
        warehouse_name: Optional[str] = None
    ) -> List[ProductionPickingResponse]:
        """
        批量领料：从多个工单下推，批量创建领料单
        
        Args:
            tenant_id: 租户ID
            work_order_ids: 工单ID列表
            created_by: 创建人ID
            warehouse_id: 仓库ID（可选）
            warehouse_name: 仓库名称（可选）
            
        Returns:
            List[ProductionPickingResponse]: 创建的生产领料单列表
        """
        results = []
        for work_order_id in work_order_ids:
            try:
                picking = await self.quick_pick_from_work_order(
                    tenant_id=tenant_id,
                    work_order_id=work_order_id,
                    created_by=created_by,
                    warehouse_id=warehouse_id,
                    warehouse_name=warehouse_name
                )
                results.append(picking)
            except Exception as e:
                logger.error(f"批量领料失败，工单ID: {work_order_id}, 错误: {str(e)}")
                # 继续处理其他工单，不中断整个流程
                continue
        
        return results



class FinishedGoodsReceiptService(AppBaseService[FinishedGoodsReceipt]):
    """成品入库单服务"""

    def __init__(self):
        super().__init__(FinishedGoodsReceipt)

    async def create_finished_goods_receipt(self, tenant_id: int, receipt_data: FinishedGoodsReceiptCreate, created_by: int) -> FinishedGoodsReceiptResponse:
        """创建成品入库单"""
        return await self.create_record(
            tenant_id=tenant_id,
            create_data=receipt_data,
            created_by=created_by,
            code_rule_name="FINISHED_GOODS_RECEIPT_CODE",
            response_schema=FinishedGoodsReceiptResponse
        )

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

            confirmer_name = await self.get_user_name(confirmed_by)

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

    async def quick_receipt_from_work_order(
        self,
        tenant_id: int,
        work_order_id: int,
        created_by: int,
        warehouse_id: Optional[int] = None,
        warehouse_name: Optional[str] = None,
        receipt_quantity: Optional[float] = None
    ) -> FinishedGoodsReceiptResponse:
        """
        一键入库：从工单下推，根据报工记录自动生成入库单
        
        Args:
            tenant_id: 租户ID
            work_order_id: 工单ID
            created_by: 创建人ID
            warehouse_id: 仓库ID（可选，如果不提供则使用物料默认仓库）
            warehouse_name: 仓库名称（可选）
            receipt_quantity: 入库数量（可选，如果不提供则使用报工合格数量）
            
        Returns:
            FinishedGoodsReceiptResponse: 创建的成品入库单
            
        Raises:
            NotFoundError: 工单不存在
            ValidationError: 数据验证失败
        """
        from apps.kuaizhizao.models.work_order import WorkOrder
        from apps.kuaizhizao.models.reporting_record import ReportingRecord
        from apps.kuaizhizao.models.finished_goods_receipt_item import FinishedGoodsReceiptItem
        from decimal import Decimal
        
        async with in_transaction():
            # 1. 获取工单信息
            work_order = await WorkOrder.get_or_none(tenant_id=tenant_id, id=work_order_id)
            if not work_order:
                raise NotFoundError(f"工单不存在: {work_order_id}")
            
            # 检查工单状态
            if work_order.status not in ['进行中', '已完成']:
                raise BusinessLogicError(f"工单状态为 {work_order.status}，无法创建入库单")
            
            # 2. 获取入库数量
            if receipt_quantity is None:
                # 从报工记录获取合格数量
                reporting_records = await ReportingRecord.filter(
                    tenant_id=tenant_id,
                    work_order_id=work_order_id
                ).all()
                
                if not reporting_records:
                    raise ValidationError("工单没有报工记录，无法自动获取入库数量")
                
                # 汇总所有报工记录的合格数量
                total_qualified = sum(
                    float(record.qualified_quantity or 0) 
                    for record in reporting_records
                )
                
                if total_qualified <= 0:
                    raise ValidationError("报工合格数量为0，无法创建入库单")
                
                receipt_quantity = total_qualified
            else:
                receipt_quantity = float(receipt_quantity)
            
            # 3. 获取仓库信息（如果未指定）
            if not warehouse_id:
                # TODO: 从物料主数据获取默认仓库
                # 暂时需要用户指定仓库
                raise ValidationError("请指定入库仓库")
            
            # 4. 生成入库单编码
            today = datetime.now().strftime("%Y%m%d")
            receipt_code = await self.generate_code(tenant_id, "FINISHED_GOODS_RECEIPT_CODE", prefix=f"FG{today}")
            
            # 5. 创建成品入库单
            receipt = await FinishedGoodsReceipt.create(
                tenant_id=tenant_id,
                receipt_code=receipt_code,
                work_order_id=work_order_id,
                work_order_code=work_order.code,
                sales_order_id=work_order.sales_order_id,
                sales_order_code=work_order.sales_order_code,
                warehouse_id=warehouse_id,
                warehouse_name=warehouse_name or '',
                status='待入库',
                total_quantity=Decimal(str(receipt_quantity)),
                created_by=created_by,
                updated_by=created_by
            )
            
            # 6. 创建入库单明细
            await FinishedGoodsReceiptItem.create(
                tenant_id=tenant_id,
                receipt_id=receipt.id,
                material_id=work_order.product_id,
                material_code=work_order.product_code,
                material_name=work_order.product_name,
                material_unit='个',  # TODO: 从物料主数据获取单位
                receipt_quantity=Decimal(str(receipt_quantity)),
                qualified_quantity=Decimal(str(receipt_quantity)),
                unqualified_quantity=Decimal('0'),
                warehouse_id=warehouse_id,
                warehouse_name=warehouse_name or '',
                status='待入库'
            )
            
            return FinishedGoodsReceiptResponse.model_validate(receipt)
    
    async def batch_receipt_from_work_orders(
        self,
        tenant_id: int,
        work_order_ids: List[int],
        created_by: int,
        warehouse_id: Optional[int] = None,
        warehouse_name: Optional[str] = None
    ) -> List[FinishedGoodsReceiptResponse]:
        """
        批量入库：从多个工单下推，批量创建入库单
        
        Args:
            tenant_id: 租户ID
            work_order_ids: 工单ID列表
            created_by: 创建人ID
            warehouse_id: 仓库ID（可选）
            warehouse_name: 仓库名称（可选）
            
        Returns:
            List[FinishedGoodsReceiptResponse]: 创建的成品入库单列表
        """
        results = []
        for work_order_id in work_order_ids:
            try:
                receipt = await self.quick_receipt_from_work_order(
                    tenant_id=tenant_id,
                    work_order_id=work_order_id,
                    created_by=created_by,
                    warehouse_id=warehouse_id,
                    warehouse_name=warehouse_name
                )
                results.append(receipt)
            except Exception as e:
                logger.error(f"批量入库失败，工单ID: {work_order_id}, 错误: {str(e)}")
                # 继续处理其他工单，不中断整个流程
                continue
        
        return results



class SalesDeliveryService(AppBaseService[SalesDelivery]):
    """销售出库单服务"""

    def __init__(self):
        super().__init__(SalesDelivery)

    async def create_sales_delivery(self, tenant_id: int, delivery_data: SalesDeliveryCreate, created_by: int) -> SalesDeliveryResponse:
        """创建销售出库单"""
        async with in_transaction():
            user_info = await self.get_user_info(created_by)
            today = datetime.now().strftime("%Y%m%d")
            code = await self.generate_code(tenant_id, "SALES_DELIVERY_CODE", prefix=f"SD{today}")

            delivery = await SalesDelivery.create(
                tenant_id=tenant_id,
                delivery_code=code,
                created_by=created_by,
                created_by_name=user_info["name"],
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

            confirmer_name = await self.get_user_name(confirmed_by)

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


class PurchaseReceiptService(AppBaseService[PurchaseReceipt]):
    """采购入库单服务"""

    def __init__(self):
        super().__init__(PurchaseReceipt)

    async def create_purchase_receipt(self, tenant_id: int, receipt_data: PurchaseReceiptCreate, created_by: int) -> PurchaseReceiptResponse:
        """创建采购入库单"""
        async with in_transaction():
            user_info = await self.get_user_info(created_by)
            today = datetime.now().strftime("%Y%m%d")
            code = await self.generate_code(tenant_id, "FINISHED_GOODS_RECEIPT_CODE", prefix=f"FG{today}")

            receipt = await PurchaseReceipt.create(
                tenant_id=tenant_id,
                receipt_code=code,
                created_by=created_by,
                created_by_name=user_info["name"],
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

            confirmer_name = await self.get_user_name(confirmed_by)

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

