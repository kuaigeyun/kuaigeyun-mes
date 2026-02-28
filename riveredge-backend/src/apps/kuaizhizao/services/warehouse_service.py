"""
仓储管理服务模块

提供仓储管理相关的业务逻辑处理。

Author: Luigi Lu
Date: 2025-12-30
"""

from typing import List, Optional, Dict, Any
from datetime import datetime, timedelta
from decimal import Decimal
import uuid
from tortoise.transactions import in_transaction
from tortoise.expressions import Q
from loguru import logger

from apps.kuaizhizao.models.production_picking import ProductionPicking
from apps.kuaizhizao.models.production_picking_item import ProductionPickingItem
from apps.kuaizhizao.models.production_return import ProductionReturn
from apps.kuaizhizao.models.production_return_item import ProductionReturnItem
from apps.kuaizhizao.models.finished_goods_receipt import FinishedGoodsReceipt
from apps.kuaizhizao.models.finished_goods_receipt_item import FinishedGoodsReceiptItem
from apps.kuaizhizao.models.sales_delivery import SalesDelivery
from apps.kuaizhizao.models.sales_delivery_item import SalesDeliveryItem
from apps.kuaizhizao.models.sales_return import SalesReturn
from apps.kuaizhizao.models.sales_return_item import SalesReturnItem
from apps.kuaizhizao.models.purchase_return import PurchaseReturn
from apps.kuaizhizao.models.purchase_return_item import PurchaseReturnItem
from apps.kuaizhizao.models.purchase_receipt import PurchaseReceipt
from apps.kuaizhizao.models.purchase_receipt_item import PurchaseReceiptItem
from apps.kuaizhizao.models.other_inbound import OtherInbound
from apps.kuaizhizao.models.other_inbound_item import OtherInboundItem
from apps.kuaizhizao.models.other_outbound import OtherOutbound
from apps.kuaizhizao.models.other_outbound_item import OtherOutboundItem
from apps.kuaizhizao.models.material_borrow import MaterialBorrow
from apps.kuaizhizao.models.material_borrow_item import MaterialBorrowItem
from apps.kuaizhizao.models.material_return import MaterialReturn
from apps.kuaizhizao.models.material_return_item import MaterialReturnItem

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
    # 销售退货单
    SalesReturnCreate, SalesReturnUpdate, SalesReturnResponse,
    SalesReturnItemCreate, SalesReturnItemUpdate, SalesReturnItemResponse,
    # 采购退货单
    PurchaseReturnCreate, PurchaseReturnUpdate, PurchaseReturnResponse,
    PurchaseReturnItemCreate, PurchaseReturnItemUpdate, PurchaseReturnItemResponse,
    # 采购入库单
    PurchaseReceiptCreate, PurchaseReceiptUpdate, PurchaseReceiptResponse,
    PurchaseReceiptItemCreate, PurchaseReceiptItemUpdate, PurchaseReceiptItemResponse,
    # 生产退料单
    ProductionReturnCreate, ProductionReturnUpdate, ProductionReturnResponse,
    ProductionReturnListResponse, ProductionReturnWithItemsResponse,
    ProductionReturnItemCreate, ProductionReturnItemUpdate, ProductionReturnItemResponse,
    # 其他入库/出库单
    OtherInboundCreate, OtherInboundUpdate, OtherInboundResponse, OtherInboundListResponse,
    OtherInboundWithItemsResponse, OtherInboundItemCreate, OtherInboundItemUpdate,
    OtherInboundItemResponse,
    OtherOutboundCreate, OtherOutboundUpdate, OtherOutboundResponse, OtherOutboundListResponse,
    OtherOutboundWithItemsResponse, OtherOutboundItemCreate, OtherOutboundItemUpdate,
    OtherOutboundItemResponse,
    MaterialBorrowCreate, MaterialBorrowUpdate, MaterialBorrowResponse, MaterialBorrowListResponse,
    MaterialBorrowWithItemsResponse, MaterialBorrowItemCreate, MaterialBorrowItemUpdate,
    MaterialBorrowItemResponse,
    MaterialReturnCreate, MaterialReturnUpdate, MaterialReturnResponse, MaterialReturnListResponse,
    MaterialReturnWithItemsResponse, MaterialReturnItemCreate, MaterialReturnItemUpdate,
    MaterialReturnItemResponse,
)

from apps.base_service import AppBaseService
from infra.exceptions.exceptions import NotFoundError, ValidationError, BusinessLogicError
from infra.services.business_config_service import BusinessConfigService

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


class ProductionReturnService(AppBaseService[ProductionReturn]):
    """生产退料单服务"""

    def __init__(self):
        super().__init__(ProductionReturn)

    async def create_production_return(
        self,
        tenant_id: int,
        return_data: ProductionReturnCreate,
        created_by: int
    ) -> ProductionReturnResponse:
        """创建生产退料单"""
        async with in_transaction():
            user_info = await self.get_user_info(created_by)
            today = datetime.now().strftime("%Y%m%d")
            code = await self.generate_code(tenant_id, "PRODUCTION_RETURN_CODE", prefix=f"PR{today}")

            dump = return_data.model_dump(exclude_unset=True, exclude={"created_by", "items", "return_code"})
            if return_data.return_code:
                code = return_data.return_code

            ret = await ProductionReturn.create(
                tenant_id=tenant_id,
                return_code=code,
                created_by=created_by,
                **dump
            )

            items = getattr(return_data, "items", None) or []
            for item_data in items:
                await ProductionReturnItem.create(
                    tenant_id=tenant_id,
                    return_id=ret.id,
                    **item_data.model_dump(exclude_unset=True)
                )

            return ProductionReturnResponse.model_validate(ret)

    async def get_production_return_by_id(
        self,
        tenant_id: int,
        return_id: int
    ) -> ProductionReturnWithItemsResponse:
        """根据ID获取生产退料单（含明细）"""
        ret = await ProductionReturn.get_or_none(tenant_id=tenant_id, id=return_id)
        if not ret:
            raise NotFoundError(f"生产退料单不存在: {return_id}")

        items = await ProductionReturnItem.filter(tenant_id=tenant_id, return_id=return_id).all()
        response = ProductionReturnWithItemsResponse.model_validate(ret)
        response.items = [ProductionReturnItemResponse.model_validate(i) for i in items]
        return response

    async def list_production_returns(
        self,
        tenant_id: int,
        skip: int = 0,
        limit: int = 20,
        **filters
    ) -> List[ProductionReturnListResponse]:
        """获取生产退料单列表"""
        query = ProductionReturn.filter(tenant_id=tenant_id)
        if filters.get("status"):
            query = query.filter(status=filters["status"])
        if filters.get("work_order_id"):
            query = query.filter(work_order_id=filters["work_order_id"])
        if filters.get("picking_id"):
            query = query.filter(picking_id=filters["picking_id"])

        rets = await query.offset(skip).limit(limit).order_by("-created_at")
        return [ProductionReturnListResponse.model_validate(r) for r in rets]

    async def update_production_return(
        self,
        tenant_id: int,
        return_id: int,
        return_data: ProductionReturnUpdate,
        updated_by: int
    ) -> ProductionReturnResponse:
        """更新生产退料单"""
        async with in_transaction():
            await self.get_production_return_by_id(tenant_id, return_id)
            dump = return_data.model_dump(exclude_unset=True, exclude={"return_code"})
            dump["updated_by"] = updated_by
            await ProductionReturn.filter(tenant_id=tenant_id, id=return_id).update(**dump)
            return ProductionReturnResponse.model_validate(
                await ProductionReturn.get(tenant_id=tenant_id, id=return_id)
            )

    async def delete_production_return(self, tenant_id: int, return_id: int) -> bool:
        """删除生产退料单"""
        ret = await ProductionReturn.get_or_none(tenant_id=tenant_id, id=return_id)
        if not ret:
            raise NotFoundError(f"生产退料单不存在: {return_id}")
        if ret.status not in ("待退料", "已取消"):
            raise BusinessLogicError("只能删除待退料或已取消状态的生产退料单")

        await ProductionReturn.filter(tenant_id=tenant_id, id=return_id).update(
            is_active=False,
            deleted_at=datetime.now()
        )
        return True

    async def confirm_return(
        self,
        tenant_id: int,
        return_id: int,
        confirmed_by: int
    ) -> ProductionReturnResponse:
        """确认退料"""
        async with in_transaction():
            ret = await self.get_production_return_by_id(tenant_id, return_id)
            if ret.status != "待退料":
                raise BusinessLogicError("只有待退料状态的生产退料单才能确认退料")

            returner_name = await self.get_user_name(confirmed_by)
            await ProductionReturn.filter(tenant_id=tenant_id, id=return_id).update(
                status="已退料",
                returner_id=confirmed_by,
                returner_name=returner_name,
                return_time=datetime.now(),
                updated_by=confirmed_by
            )
            for item in ret.items:
                await ProductionReturnItem.filter(
                    tenant_id=tenant_id,
                    id=item.id
                ).update(status="已退料", return_time=datetime.now())

            # TODO: 更新库存（增加仓库库存）
            return ProductionReturnResponse.model_validate(
                await ProductionReturn.get(tenant_id=tenant_id, id=return_id)
            )


class FinishedGoodsReceiptService(AppBaseService[FinishedGoodsReceipt]):
    """成品入库单服务"""

    def __init__(self):
        super().__init__(FinishedGoodsReceipt)

    async def create_finished_goods_receipt(self, tenant_id: int, receipt_data: FinishedGoodsReceiptCreate, created_by: int, items: Optional[List[FinishedGoodsReceiptItemCreate]] = None) -> FinishedGoodsReceiptResponse:
        """创建成品入库单"""
        async with in_transaction():
            user_info = await self.get_user_info(created_by)
            # 如果未提供receipt_code，则自动生成
            if receipt_data.receipt_code:
                code = receipt_data.receipt_code
            else:
                today = datetime.now().strftime("%Y%m%d")
                code = await self.generate_code(tenant_id, "FINISHED_GOODS_RECEIPT_CODE", prefix=f"FGR{today}")
            
            # 从参数或receipt_data中提取items（如果存在）
            if items is None:
                items = getattr(receipt_data, 'items', None) or []
            
            # 计算总数量
            total_quantity = sum(item.receipt_quantity for item in items) if items else 0
            
            # 创建入库单
            receipt = await FinishedGoodsReceipt.create(
                tenant_id=tenant_id,
                uuid=str(uuid.uuid4()),
                receipt_code=code,
                work_order_id=receipt_data.work_order_id,
                work_order_code=receipt_data.work_order_code,
                sales_order_id=receipt_data.sales_order_id,
                sales_order_code=receipt_data.sales_order_code,
                warehouse_id=receipt_data.warehouse_id,
                warehouse_name=receipt_data.warehouse_name,
                receipt_time=receipt_data.receipt_time,
                receiver_id=receipt_data.receiver_id,
                receiver_name=receipt_data.receiver_name,
                reviewer_id=receipt_data.reviewer_id,
                reviewer_name=receipt_data.reviewer_name,
                review_time=receipt_data.review_time,
                review_status=receipt_data.review_status,
                review_remarks=receipt_data.review_remarks,
                status=receipt_data.status,
                total_quantity=total_quantity,
                notes=receipt_data.notes,
                created_by=user_info.get("id"),
                created_by_name=user_info.get("name", ""),
            )
            
            # 创建入库单明细
            if items:
                from apps.kuaizhizao.models.finished_goods_receipt_item import FinishedGoodsReceiptItem
                from apps.master_data.models.material import Material
                
                for item_data in items:
                    # 验证批号管理
                    material = await Material.get_or_none(
                        tenant_id=tenant_id,
                        id=item_data.material_id
                    )
                    if material and material.batch_managed:
                        batch_number = getattr(item_data, 'batch_number', None)
                        if not batch_number:
                            raise ValidationError(
                                f"物料 {material.name}（{material.main_code}）启用了批号管理，必须提供批号"
                            )
                    
                    await FinishedGoodsReceiptItem.create(
                        tenant_id=tenant_id,
                        receipt_id=receipt.id,
                        material_id=item_data.material_id,
                        material_code=item_data.material_code,
                        material_name=item_data.material_name,
                        material_spec=getattr(item_data, 'material_spec', None),
                        material_unit=item_data.material_unit,
                        receipt_quantity=item_data.receipt_quantity,
                        qualified_quantity=item_data.qualified_quantity,
                        unqualified_quantity=item_data.unqualified_quantity,
                        location_id=getattr(item_data, 'location_id', None),
                        location_code=getattr(item_data, 'location_code', None),
                        batch_number=getattr(item_data, 'batch_number', None),
                        expiry_date=getattr(item_data, 'expiry_date', None),
                        quality_status=getattr(item_data, 'quality_status', '合格'),
                        quality_inspection_id=getattr(item_data, 'quality_inspection_id', None),
                        status=getattr(item_data, 'status', '待入库'),
                        receipt_time=getattr(item_data, 'receipt_time', None),
                        notes=getattr(item_data, 'notes', None),
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
        self.business_config_service = BusinessConfigService()

    async def create_sales_delivery(self, tenant_id: int, delivery_data: SalesDeliveryCreate, created_by: int) -> SalesDeliveryResponse:
        """创建销售出库单"""
        # 1. 检查模块是否启用
        is_enabled = await self.business_config_service.check_node_enabled(tenant_id, "sales_delivery")
        if not is_enabled:
            raise BusinessLogicError("销售发货模块未启用，无法创建出库单")

        async with in_transaction():
            user_info = await self.get_user_info(created_by)
            
            # 2. 检查是否需要审核
            audit_required = await self.business_config_service.check_audit_required(tenant_id, "sales_delivery")
            
            # 确定初始状态
            initial_status = delivery_data.status
            initial_review_status = delivery_data.review_status
            
            if not audit_required and initial_status in [None, "待审核", "草稿"]:
                # 如果不需要审核，且未指定状态或指定为草稿/待审核，则直接设为待出库（即已通过审核，等待执行）
                initial_status = "待出库"
                initial_review_status = "已通过"
            
            # 如果未提供delivery_code，则自动生成
            if delivery_data.delivery_code:
                code = delivery_data.delivery_code
            else:
                today = datetime.now().strftime("%Y%m%d")
                code = await self.generate_code(tenant_id, "SALES_DELIVERY_CODE", prefix=f"SD{today}")

            # 从delivery_data中提取items（如果存在）
            items = getattr(delivery_data, 'items', None) or []
            
            # 计算总数量和总金额
            total_quantity = sum(item.delivery_quantity for item in items) if items else 0
            total_amount = sum(item.total_amount for item in items) if items else 0

            # MTS模式下，sales_order_id可以为None（销售出库与需求关联功能增强）
            sales_order_id = delivery_data.sales_order_id if delivery_data.sales_order_id and delivery_data.sales_order_id > 0 else None
            sales_order_code = delivery_data.sales_order_code if sales_order_id else None
            
            # 销售预测信息（MTS模式）（销售出库与需求关联功能增强）
            sales_forecast_id = getattr(delivery_data, 'sales_forecast_id', None)
            sales_forecast_code = getattr(delivery_data, 'sales_forecast_code', None)
            
            # 统一需求关联（销售出库与需求关联功能增强）
            demand_id = getattr(delivery_data, 'demand_id', None)
            demand_code = getattr(delivery_data, 'demand_code', None)
            demand_type = getattr(delivery_data, 'demand_type', None)
            
            # 如果提供了demand_id但没有demand_type，根据sales_order_id或sales_forecast_id判断
            if demand_id and not demand_type:
                if sales_order_id:
                    demand_type = "sales_order"
                elif sales_forecast_id:
                    demand_type = "sales_forecast"
            
            delivery = await SalesDelivery.create(
                tenant_id=tenant_id,
                uuid=str(uuid.uuid4()),
                delivery_code=code,
                sales_order_id=sales_order_id,
                sales_order_code=sales_order_code or "",
                sales_forecast_id=sales_forecast_id,
                sales_forecast_code=sales_forecast_code or "",
                demand_id=demand_id,
                demand_code=demand_code or "",
                demand_type=demand_type,
                customer_id=delivery_data.customer_id,
                customer_name=delivery_data.customer_name,
                warehouse_id=delivery_data.warehouse_id,
                warehouse_name=delivery_data.warehouse_name,
                delivery_time=delivery_data.delivery_time,
                deliverer_id=delivery_data.deliverer_id,
                deliverer_name=delivery_data.deliverer_name,
                reviewer_id=delivery_data.reviewer_id,
                reviewer_name=delivery_data.reviewer_name,
                review_time=delivery_data.review_time,
                review_status=initial_review_status,
                review_remarks=delivery_data.review_remarks,
                status=initial_status,
                total_quantity=total_quantity,
                total_amount=total_amount,
                shipping_method=delivery_data.shipping_method,
                tracking_number=delivery_data.tracking_number,
                shipping_address=getattr(delivery_data, 'shipping_address', None),
                notes=delivery_data.notes,
                created_by=user_info.get("id"),
                created_by_name=user_info.get("name", ""),
            )
            
            # 创建出库单明细
            if items:
                from apps.master_data.models.material import Material
                
                for item_data in items:
                    # 验证批号和序列号管理
                    material = await Material.get_or_none(
                        tenant_id=tenant_id,
                        id=item_data.material_id
                    )
                    
                    # 验证批号
                    batch_number = getattr(item_data, 'batch_number', None)
                    if material and material.batch_managed and not batch_number:
                        raise ValidationError(
                            f"物料 {material.name}（{material.main_code}）启用了批号管理，必须提供批号"
                        )
                    
                    # 序列号信息（批号和序列号选择功能增强）
                    serial_numbers = getattr(item_data, 'serial_numbers', None)
                    # 如果serial_numbers是列表，转换为JSON格式存储
                    if serial_numbers and isinstance(serial_numbers, list):
                        import json
                        serial_numbers_json = json.dumps(serial_numbers)
                    elif serial_numbers:
                        # 如果已经是字符串格式的JSON，直接使用
                        serial_numbers_json = serial_numbers if isinstance(serial_numbers, str) else None
                    else:
                        serial_numbers_json = None
                    
                    # 需求关联（销售出库与需求关联功能增强）
                    item_demand_id = getattr(item_data, 'demand_id', None) or demand_id
                    demand_item_id = getattr(item_data, 'demand_item_id', None)
                    
                    await SalesDeliveryItem.create(
                        tenant_id=tenant_id,
                        delivery_id=delivery.id,
                        material_id=item_data.material_id,
                        material_code=item_data.material_code,
                        material_name=item_data.material_name,
                        material_spec=getattr(item_data, 'material_spec', None),
                        material_unit=item_data.material_unit,
                        delivery_quantity=item_data.delivery_quantity,
                        unit_price=item_data.unit_price,
                        total_amount=item_data.total_amount,
                        location_id=getattr(item_data, 'location_id', None),
                        location_code=getattr(item_data, 'location_code', None),
                        batch_number=getattr(item_data, 'batch_number', None),
                        expiry_date=getattr(item_data, 'expiry_date', None),
                        serial_numbers=serial_numbers_json,  # 批号和序列号选择功能增强
                        demand_id=item_demand_id,  # 销售出库与需求关联功能增强
                        demand_item_id=demand_item_id,  # 销售出库与需求关联功能增强
                        status=getattr(item_data, 'status', '待出库'),
                        delivery_time=getattr(item_data, 'delivery_time', None),
                        notes=getattr(item_data, 'notes', None),
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
            
            # 自动生成应收单
            try:
                from apps.kuaizhizao.services.finance_service import ReceivableService
                from apps.kuaizhizao.schemas.finance import ReceivableCreate
                
                receivable_service = ReceivableService()
                
                # 获取出库单信息
                delivery = await SalesDelivery.get(tenant_id=tenant_id, id=delivery_id)
                
                # 创建应收单
                total_amount = Decimal(str(delivery.total_amount))
                receivable_data = ReceivableCreate(
                    source_type="销售出库",
                    source_id=delivery_id,
                    source_code=delivery.delivery_code,
                    customer_id=delivery.customer_id,
                    customer_name=delivery.customer_name,
                    total_amount=float(total_amount),
                    received_amount=0.0,
                    remaining_amount=float(total_amount),
                    due_date=(datetime.now() + timedelta(days=30)).date(),  # 默认30天账期
                    business_date=datetime.now().date(),
                    status="未收款",
                    notes=f"由销售出库单 {delivery.delivery_code} 自动生成"
                )
                
                await receivable_service.create_receivable(
                    tenant_id=tenant_id,
                    receivable_data=receivable_data,
                    created_by=confirmed_by
                )
            except Exception as e:
                logger.error(f"自动生成应收单失败: {str(e)}")
                # 不抛出异常，避免影响出库确认

            updated_delivery = await self.get_sales_delivery_by_id(tenant_id, delivery_id)
            return updated_delivery

    async def import_from_data(
        self,
        tenant_id: int,
        data: List[List[Any]],
        created_by: int
    ) -> Dict[str, Any]:
        """
        从二维数组数据批量导入销售出库单
        
        接收前端 uni_import 组件传递的二维数组数据，批量创建销售出库单。
        数据格式：第一行为表头，第二行为示例数据（跳过），从第三行开始为实际数据。
        
        Args:
            tenant_id: 租户ID
            data: 二维数组数据（从 uni_import 组件传递）
            created_by: 创建人ID
            
        Returns:
            Dict: 导入结果（成功数、失败数、错误列表）
        """
        if not data or len(data) < 2:
            raise ValidationError("导入数据格式错误：至少需要表头和示例数据行")
        
        # 解析表头（第一行，索引0）
        headers = [str(cell).strip() if cell is not None else '' for cell in data[0]]
        
        # 表头字段映射（支持中英文）
        header_map = {
            '销售订单编号': 'sales_order_code',
            '*销售订单编号': 'sales_order_code',
            'sales_order_code': 'sales_order_code',
            '*sales_order_code': 'sales_order_code',
            '客户名称': 'customer_name',
            'customer_name': 'customer_name',
            '仓库名称': 'warehouse_name',
            'warehouse_name': 'warehouse_name',
            '出库时间': 'delivery_time',
            'delivery_time': 'delivery_time',
            '发货方式': 'shipping_method',
            'shipping_method': 'shipping_method',
            '物流单号': 'tracking_number',
            'tracking_number': 'tracking_number',
            '收货地址': 'shipping_address',
            'shipping_address': 'shipping_address',
            '备注': 'notes',
            'notes': 'notes',
        }
        
        # 找到表头索引
        header_index_map = {}
        for idx, header in enumerate(headers):
            if header and header in header_map:
                header_index_map[header_map[header]] = idx
        
        # 验证必填字段
        required_fields = ['sales_order_code']
        missing_fields = [f for f in required_fields if f not in header_index_map]
        if missing_fields:
            raise ValidationError(f"缺少必填字段：{', '.join(missing_fields)}")
        
        # 解析数据行（从第三行开始，索引2，跳过表头和示例数据行）
        rows = data[2:] if len(data) > 2 else []
        
        # 过滤空行
        non_empty_rows = [
            (row, idx + 3) for idx, row in enumerate(rows)
            if any(cell is not None and str(cell).strip() for cell in row)
        ]
        
        if not non_empty_rows:
            raise ValidationError("没有可导入的数据行（所有行都为空）")
        
        success_count = 0
        failure_count = 0
        errors = []
        
        # 获取销售订单信息（用于填充客户信息）
        from apps.kuaizhizao.models.sales_order import SalesOrder
        
        for row, row_idx in non_empty_rows:
            try:
                # 解析行数据
                delivery_data = {}
                for field, col_idx in header_index_map.items():
                    if col_idx < len(row):
                        value = row[col_idx]
                        if value is not None:
                            value_str = str(value).strip()
                            if value_str:
                                # 日期字段需要转换
                                if field == 'delivery_time':
                                    try:
                                        from datetime import datetime as dt
                                        # 尝试多种日期格式
                                        for fmt in ['%Y-%m-%d %H:%M:%S', '%Y-%m-%d', '%Y/%m/%d', '%Y.%m.%d']:
                                            try:
                                                delivery_data[field] = dt.strptime(value_str, fmt)
                                                break
                                            except ValueError:
                                                continue
                                        else:
                                            raise ValueError(f"日期格式错误：{value_str}")
                                    except Exception as e:
                                        errors.append({
                                            "row": row_idx,
                                            "error": f"日期格式错误：{value_str}，错误：{str(e)}"
                                        })
                                        failure_count += 1
                                        break
                                else:
                                    delivery_data[field] = value_str
                
                # 验证必填字段
                if not delivery_data.get('sales_order_code'):
                    errors.append({
                        "row": row_idx,
                        "error": "销售订单编号为空"
                    })
                    failure_count += 1
                    continue
                
                # 查找销售订单
                sales_order = await SalesOrder.get_or_none(
                    tenant_id=tenant_id,
                    order_code=delivery_data['sales_order_code']
                )
                if not sales_order:
                    errors.append({
                        "row": row_idx,
                        "error": f"销售订单不存在：{delivery_data['sales_order_code']}"
                    })
                    failure_count += 1
                    continue
                
                # 构建创建数据
                from apps.kuaizhizao.schemas.warehouse import SalesDeliveryCreate, SalesDeliveryItemCreate
                
                # 获取订单明细（用于创建出库单明细）
                from apps.kuaizhizao.models.sales_order_item import SalesOrderItem
                order_items = await SalesOrderItem.filter(
                    tenant_id=tenant_id,
                    sales_order_id=sales_order.id
                ).all()
                
                if not order_items:
                    errors.append({
                        "row": row_idx,
                        "error": f"销售订单没有明细：{delivery_data['sales_order_code']}"
                    })
                    failure_count += 1
                    continue
                
                # 构建出库单明细
                delivery_items = []
                for item in order_items:
                    if item.remaining_quantity > 0:
                        delivery_items.append(SalesDeliveryItemCreate(
                            material_id=item.material_id,
                            material_code=item.material_code,
                            material_name=item.material_name,
                            material_unit=item.material_unit,
                            delivery_quantity=item.remaining_quantity,
                            unit_price=item.unit_price,
                            total_amount=item.remaining_quantity * item.unit_price
                        ))
                
                if not delivery_items:
                    errors.append({
                        "row": row_idx,
                        "error": f"销售订单没有可出库的明细：{delivery_data['sales_order_code']}"
                    })
                    failure_count += 1
                    continue
                
                # 创建出库单
                delivery_create_data = SalesDeliveryCreate(
                    sales_order_id=sales_order.id,
                    sales_order_code=sales_order.order_code,
                    customer_id=sales_order.customer_id,
                    customer_name=sales_order.customer_name,
                    warehouse_id=1,  # TODO: 从仓库名称查找仓库ID
                    warehouse_name=delivery_data.get('warehouse_name', '默认仓库'),
                    delivery_time=delivery_data.get('delivery_time') or datetime.now(),
                    items=delivery_items,
                    shipping_method=delivery_data.get('shipping_method'),
                    tracking_number=delivery_data.get('tracking_number'),
                    shipping_address=delivery_data.get('shipping_address'),
                    notes=delivery_data.get('notes')
                )
                
                await self.create_sales_delivery(
                    tenant_id=tenant_id,
                    delivery_data=delivery_create_data,
                    created_by=created_by
                )
                
                success_count += 1
                
            except Exception as e:
                errors.append({
                    "row": row_idx,
                    "error": f"导入失败：{str(e)}"
                })
                failure_count += 1
                logger.error(f"导入销售出库单失败（第{row_idx}行）：{str(e)}")
        
        return {
            "success": True,
            "message": f"导入完成：成功 {success_count} 条，失败 {failure_count} 条",
            "data": {
                "success_count": success_count,
                "failure_count": failure_count,
                "errors": errors
            }
        }

    async def export_to_excel(
        self,
        tenant_id: int,
        **filters
    ) -> str:
        """
        导出销售出库单到Excel文件
        
        Args:
            tenant_id: 租户ID
            **filters: 过滤条件
            
        Returns:
            str: Excel文件路径
        """
        import csv
        import os
        import tempfile
        from datetime import datetime
        
        # 查询所有符合条件的销售出库单（不分页）
        deliveries = await self.list_sales_deliveries(tenant_id, skip=0, limit=10000, **filters)
        
        # 创建导出目录
        export_dir = os.path.join(tempfile.gettempdir(), 'riveredge_exports')
        os.makedirs(export_dir, exist_ok=True)
        
        # 生成文件名
        timestamp = datetime.now().strftime('%Y%m%d_%H%M%S')
        filename = f"sales_deliveries_{timestamp}.csv"
        file_path = os.path.join(export_dir, filename)
        
        # 写入CSV文件
        with open(file_path, 'w', newline='', encoding='utf-8-sig') as f:
            writer = csv.writer(f)
            
            # 写入表头
            writer.writerow([
                '出库单编号', '销售订单编号', '客户名称', '仓库名称',
                '出库时间', '状态', '总数量', '总金额',
                '发货方式', '物流单号', '收货地址', '备注', '创建时间'
            ])
            
            # 写入数据
            for delivery in deliveries:
                writer.writerow([
                    delivery.delivery_code,
                    delivery.sales_order_code or '',
                    delivery.customer_name or '',
                    delivery.warehouse_name or '',
                    delivery.delivery_time.strftime('%Y-%m-%d %H:%M:%S') if delivery.delivery_time else '',
                    delivery.status,
                    str(delivery.total_quantity) if delivery.total_quantity else '0',
                    str(delivery.total_amount) if delivery.total_amount else '0',
                    delivery.shipping_method or '',
                    delivery.tracking_number or '',
                    delivery.shipping_address or '',
                    delivery.notes or '',
                    delivery.created_at.strftime('%Y-%m-%d %H:%M:%S') if delivery.created_at else '',
                ])
        
        return file_path


class PurchaseReceiptService(AppBaseService[PurchaseReceipt]):
    """采购入库单服务"""

    def __init__(self):
        super().__init__(PurchaseReceipt)
        self.business_config_service = BusinessConfigService()

    async def create_purchase_receipt(self, tenant_id: int, receipt_data: PurchaseReceiptCreate, created_by: int) -> PurchaseReceiptResponse:
        """创建采购入库单"""
        async with in_transaction():
            user_info = await self.get_user_info(created_by)
            today = datetime.now().strftime("%Y%m%d")
            code = await self.generate_code(tenant_id, "PURCHASE_RECEIPT_CODE", prefix=f"PR{today}")

            # 创建入库单头
            receipt_dict = receipt_data.model_dump(exclude_unset=True, exclude={'items', 'created_by', 'receipt_code'})
            receipt_dict.update({
                'tenant_id': tenant_id,
                'receipt_code': code,  # 使用生成的编码
                'created_by': created_by,
                'created_by_name': user_info.get("name", ""),
            })
            
            receipt = await PurchaseReceipt.create(**receipt_dict)
            
            # 创建入库单明细
            total_quantity = Decimal(0)
            total_amount = Decimal(0)
            
            for item_data in receipt_data.items or []:
                item_dict = item_data.model_dump(exclude_unset=True)
                # 确保数量字段是Decimal类型
                receipt_quantity = Decimal(str(item_data.receipt_quantity))
                unit_price = Decimal(str(item_data.unit_price))
                
                item_dict.update({
                    'tenant_id': tenant_id,
                    'receipt_id': receipt.id,
                    'receipt_quantity': receipt_quantity,
                    'unit_price': unit_price,
                    'total_amount': receipt_quantity * unit_price,
                    'qualified_quantity': Decimal(str(item_data.qualified_quantity)) if hasattr(item_data, 'qualified_quantity') and item_data.qualified_quantity is not None else receipt_quantity,
                    'unqualified_quantity': Decimal(str(item_data.unqualified_quantity)) if hasattr(item_data, 'unqualified_quantity') and item_data.unqualified_quantity is not None else Decimal(0),
                })
                
                await PurchaseReceiptItem.create(**item_dict)
                
                total_quantity += receipt_quantity
                total_amount += item_dict['total_amount']
            
            # 更新入库单总数量和总金额
            await PurchaseReceipt.filter(id=receipt.id).update(
                total_quantity=total_quantity,
                total_amount=total_amount
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

            # 质检合格才入库：若配置了 require_incoming_inspection_for_receipt，需先完成来料检验且合格
            config = await self.business_config_service.get_business_config(tenant_id)
            params = config.get("parameters", {})
            quality_params = params.get("quality", {})
            if quality_params.get("require_incoming_inspection_for_receipt"):
                from apps.kuaizhizao.models.incoming_inspection import IncomingInspection

                inspections = await IncomingInspection.filter(
                    tenant_id=tenant_id,
                    purchase_receipt_id=receipt_id,
                    deleted_at__isnull=True,
                ).all()
                if not inspections:
                    raise BusinessLogicError(
                        "已启用「质检合格才入库」，请先创建并完成来料检验，检验合格后再确认入库"
                    )
                passed = any(
                    (i.quality_status == "合格" and i.review_status in ("已审核", "通过", "APPROVED"))
                    for i in inspections
                )
                if not passed:
                    raise BusinessLogicError(
                        "已启用「质检合格才入库」，来料检验须审核通过且质量状态为合格后才能确认入库"
                    )

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
            
            # 自动生成应付单
            try:
                from apps.kuaizhizao.services.finance_service import PayableService
                from apps.kuaizhizao.schemas.finance import PayableCreate
                
                payable_service = PayableService()
                
                # 获取入库单信息
                receipt = await PurchaseReceipt.get(tenant_id=tenant_id, id=receipt_id)
                
                # 创建应付单
                total_amount = Decimal(str(receipt.total_amount))
                payable_data = PayableCreate(
                    source_type="采购入库",
                    source_id=receipt_id,
                    source_code=receipt.receipt_code,
                    supplier_id=receipt.supplier_id,
                    supplier_name=receipt.supplier_name,
                    total_amount=float(total_amount),
                    paid_amount=0.0,
                    remaining_amount=float(total_amount),
                    due_date=(datetime.now() + timedelta(days=30)).date(),  # 默认30天账期
                    business_date=datetime.now().date(),
                    status="未付款",
                    notes=f"由采购入库单 {receipt.receipt_code} 自动生成"
                )
                
                await payable_service.create_payable(
                    tenant_id=tenant_id,
                    payable_data=payable_data,
                    created_by=confirmed_by
                )
            except Exception as e:
                logger.error(f"自动生成应付单失败: {str(e)}")
                # 不抛出异常，避免影响入库确认

            updated_receipt = await self.get_purchase_receipt_by_id(tenant_id, receipt_id)
            return updated_receipt

    async def import_from_data(
        self,
        tenant_id: int,
        data: List[List[Any]],
        created_by: int
    ) -> Dict[str, Any]:
        """
        从二维数组数据批量导入采购入库单
        
        接收前端 uni_import 组件传递的二维数组数据，批量创建采购入库单。
        数据格式：第一行为表头，第二行为示例数据（跳过），从第三行开始为实际数据。
        
        Args:
            tenant_id: 租户ID
            data: 二维数组数据（从 uni_import 组件传递）
            created_by: 创建人ID
            
        Returns:
            Dict: 导入结果（成功数、失败数、错误列表）
        """
        if not data or len(data) < 2:
            raise ValidationError("导入数据格式错误：至少需要表头和示例数据行")
        
        # 解析表头（第一行，索引0）
        headers = [str(cell).strip() if cell is not None else '' for cell in data[0]]
        
        # 表头字段映射（支持中英文）
        header_map = {
            '采购订单编号': 'purchase_order_code',
            '*采购订单编号': 'purchase_order_code',
            'purchase_order_code': 'purchase_order_code',
            '*purchase_order_code': 'purchase_order_code',
            '供应商名称': 'supplier_name',
            'supplier_name': 'supplier_name',
            '仓库名称': 'warehouse_name',
            'warehouse_name': 'warehouse_name',
            '入库时间': 'receipt_time',
            'receipt_time': 'receipt_time',
            '备注': 'notes',
            'notes': 'notes',
        }
        
        # 找到表头索引
        header_index_map = {}
        for idx, header in enumerate(headers):
            if header and header in header_map:
                header_index_map[header_map[header]] = idx
        
        # 验证必填字段
        required_fields = ['purchase_order_code']
        missing_fields = [f for f in required_fields if f not in header_index_map]
        if missing_fields:
            raise ValidationError(f"缺少必填字段：{', '.join(missing_fields)}")
        
        # 解析数据行（从第三行开始，索引2，跳过表头和示例数据行）
        rows = data[2:] if len(data) > 2 else []
        
        # 过滤空行
        non_empty_rows = [
            (row, idx + 3) for idx, row in enumerate(rows)
            if any(cell is not None and str(cell).strip() for cell in row)
        ]
        
        if not non_empty_rows:
            raise ValidationError("没有可导入的数据行（所有行都为空）")
        
        success_count = 0
        failure_count = 0
        errors = []
        
        # 获取采购订单信息（用于填充供应商信息）
        from apps.kuaizhizao.models.purchase_order import PurchaseOrder
        
        for row, row_idx in non_empty_rows:
            try:
                # 解析行数据
                receipt_data = {}
                for field, col_idx in header_index_map.items():
                    if col_idx < len(row):
                        value = row[col_idx]
                        if value is not None:
                            value_str = str(value).strip()
                            if value_str:
                                # 日期字段需要转换
                                if field == 'receipt_time':
                                    try:
                                        from datetime import datetime as dt
                                        # 尝试多种日期格式
                                        for fmt in ['%Y-%m-%d %H:%M:%S', '%Y-%m-%d', '%Y/%m/%d', '%Y.%m.%d']:
                                            try:
                                                receipt_data[field] = dt.strptime(value_str, fmt)
                                                break
                                            except ValueError:
                                                continue
                                        else:
                                            raise ValueError(f"日期格式错误：{value_str}")
                                    except Exception as e:
                                        errors.append({
                                            "row": row_idx,
                                            "error": f"日期格式错误：{value_str}，错误：{str(e)}"
                                        })
                                        failure_count += 1
                                        break
                                else:
                                    receipt_data[field] = value_str
                
                # 验证必填字段
                if not receipt_data.get('purchase_order_code'):
                    errors.append({
                        "row": row_idx,
                        "error": "采购订单编号为空"
                    })
                    failure_count += 1
                    continue
                
                # 查找采购订单
                purchase_order = await PurchaseOrder.get_or_none(
                    tenant_id=tenant_id,
                    order_code=receipt_data['purchase_order_code']
                )
                if not purchase_order:
                    errors.append({
                        "row": row_idx,
                        "error": f"采购订单不存在：{receipt_data['purchase_order_code']}"
                    })
                    failure_count += 1
                    continue
                
                # 构建创建数据
                from apps.kuaizhizao.schemas.warehouse import PurchaseReceiptCreate, PurchaseReceiptItemCreate
                
                # 获取订单明细（用于创建入库单明细）
                from apps.kuaizhizao.models.purchase_order_item import PurchaseOrderItem
                order_items = await PurchaseOrderItem.filter(
                    tenant_id=tenant_id,
                    order_id=purchase_order.id
                ).all()
                
                if not order_items:
                    errors.append({
                        "row": row_idx,
                        "error": f"采购订单没有明细：{receipt_data['purchase_order_code']}"
                    })
                    failure_count += 1
                    continue
                
                # 构建入库单明细
                receipt_items = []
                for item in order_items:
                    if item.outstanding_quantity > 0:
                        receipt_items.append(PurchaseReceiptItemCreate(
                            purchase_order_item_id=item.id,
                            material_id=item.material_id,
                            material_code=item.material_code,
                            material_name=item.material_name,
                            material_unit=item.unit,
                            receipt_quantity=item.outstanding_quantity,
                            unit_price=item.unit_price,
                            total_amount=item.outstanding_quantity * item.unit_price
                        ))
                
                if not receipt_items:
                    errors.append({
                        "row": row_idx,
                        "error": f"采购订单没有可入库的明细：{receipt_data['purchase_order_code']}"
                    })
                    failure_count += 1
                    continue
                
                # 创建入库单
                receipt_create_data = PurchaseReceiptCreate(
                    purchase_order_id=purchase_order.id,
                    purchase_order_code=purchase_order.order_code,
                    supplier_id=purchase_order.supplier_id,
                    supplier_name=purchase_order.supplier_name,
                    warehouse_id=1,  # TODO: 从仓库名称查找仓库ID
                    warehouse_name=receipt_data.get('warehouse_name', '默认仓库'),
                    receipt_time=receipt_data.get('receipt_time') or datetime.now(),
                    items=receipt_items,
                    notes=receipt_data.get('notes')
                )
                
                await self.create_purchase_receipt(
                    tenant_id=tenant_id,
                    receipt_data=receipt_create_data,
                    created_by=created_by
                )
                
                success_count += 1
                
            except Exception as e:
                errors.append({
                    "row": row_idx,
                    "error": f"导入失败：{str(e)}"
                })
                failure_count += 1
                logger.error(f"导入采购入库单失败（第{row_idx}行）：{str(e)}")
        
        return {
            "success": True,
            "message": f"导入完成：成功 {success_count} 条，失败 {failure_count} 条",
            "data": {
                "success_count": success_count,
                "failure_count": failure_count,
                "errors": errors
            }
        }

    async def export_to_excel(
        self,
        tenant_id: int,
        **filters
    ) -> str:
        """
        导出采购入库单到Excel文件
        
        Args:
            tenant_id: 租户ID
            **filters: 过滤条件
            
        Returns:
            str: Excel文件路径
        """
        import csv
        import os
        import tempfile
        from datetime import datetime
        
        # 查询所有符合条件的采购入库单（不分页）
        receipts = await self.list_purchase_receipts(tenant_id, skip=0, limit=10000, **filters)
        
        # 创建导出目录
        export_dir = os.path.join(tempfile.gettempdir(), 'riveredge_exports')
        os.makedirs(export_dir, exist_ok=True)
        
        # 生成文件名
        timestamp = datetime.now().strftime('%Y%m%d_%H%M%S')
        filename = f"purchase_receipts_{timestamp}.csv"
        file_path = os.path.join(export_dir, filename)
        
        # 写入CSV文件
        with open(file_path, 'w', newline='', encoding='utf-8-sig') as f:
            writer = csv.writer(f)
            
            # 写入表头
            writer.writerow([
                '入库单编号', '采购订单编号', '供应商名称', '仓库名称',
                '入库时间', '状态', '总数量', '总金额',
                '备注', '创建时间'
            ])
            
            # 写入数据
            for receipt in receipts:
                writer.writerow([
                    receipt.receipt_code,
                    receipt.purchase_order_code or '',
                    receipt.supplier_name or '',
                    receipt.warehouse_name or '',
                    receipt.receipt_time.strftime('%Y-%m-%d %H:%M:%S') if receipt.receipt_time else '',
                    receipt.status,
                    str(receipt.total_quantity) if receipt.total_quantity else '0',
                    str(receipt.total_amount) if receipt.total_amount else '0',
                    receipt.notes or '',
                    receipt.created_at.strftime('%Y-%m-%d %H:%M:%S') if receipt.created_at else '',
                ])
        
        return file_path

    async def pull_from_sales_order(
        self,
        tenant_id: int,
        sales_order_id: int,
        created_by: int,
        delivery_quantities: Optional[Dict[int, float]] = None,
        warehouse_id: Optional[int] = None,
        warehouse_name: Optional[str] = None
    ) -> SalesDeliveryResponse:
        """
        从销售订单上拉生成销售出库单（销售出库单上拉功能）
        
        从销售订单上拉，自动生成销售出库单
        
        Args:
            tenant_id: 租户ID
            sales_order_id: 销售订单ID
            created_by: 创建人ID
            delivery_quantities: 出库数量字典 {item_id: quantity}，如果不提供则使用订单剩余数量
            warehouse_id: 出库仓库ID（可选）
            warehouse_name: 出库仓库名称（可选）
            
        Returns:
            SalesDeliveryResponse: 创建的销售出库单信息
            
        Raises:
            NotFoundError: 销售订单不存在
            BusinessLogicError: 销售订单未审核或已全部出库
        """
        from apps.kuaizhizao.models.sales_order import SalesOrder
        from apps.kuaizhizao.models.sales_order_item import SalesOrderItem
        from apps.kuaizhizao.schemas.warehouse import SalesDeliveryItemCreate
        from decimal import Decimal
        
        # 获取销售订单
        sales_order = await SalesOrder.get_or_none(tenant_id=tenant_id, id=sales_order_id)
        if not sales_order:
            raise NotFoundError(f"销售订单不存在: {sales_order_id}")
        
        # 检查订单状态（只有已审核或已确认的订单才能上拉生成出库单，兼容中英文状态）
        audited_ok = ("已审核", "已确认", "AUDITED", "CONFIRMED")
        if sales_order.status not in audited_ok:
            raise BusinessLogicError("只有已审核或已确认的销售订单才能上拉生成销售出库单")
        
        # 获取订单明细
        order_items = await SalesOrderItem.filter(
            tenant_id=tenant_id,
            sales_order_id=sales_order_id
        ).all()
        
        if not order_items:
            raise BusinessLogicError("销售订单没有明细，无法生成销售出库单")
        
        # 如果没有指定仓库，需要从订单或其他地方获取默认仓库
        if not warehouse_id:
            # TODO: 从配置或其他地方获取默认仓库
            raise ValidationError("必须指定出库仓库")
        
        # 如果没有指定仓库名称，尝试从仓库服务获取
        if not warehouse_name:
            # TODO: 从仓库服务获取仓库名称
            warehouse_name = f"仓库{warehouse_id}"
        
        # 准备出库单明细
        delivery_items = []
        total_quantity = Decimal("0")
        total_amount = Decimal("0")
        
        for item in order_items:
            # 计算出库数量
            if delivery_quantities and item.id in delivery_quantities:
                delivery_qty = Decimal(str(delivery_quantities[item.id]))
            else:
                # 使用剩余数量
                delivery_qty = item.remaining_quantity or item.order_quantity
            
            if delivery_qty <= 0:
                continue  # 跳过数量为0或负数的情况
            
            # 检查是否超出剩余数量
            if delivery_qty > (item.remaining_quantity or item.order_quantity):
                raise BusinessLogicError(f"物料 {item.material_code} 的出库数量 {delivery_qty} 超过剩余数量 {item.remaining_quantity}")
            
            # 计算金额
            item_total_amount = delivery_qty * item.unit_price
            
            delivery_items.append(
                SalesDeliveryItemCreate(
                    material_id=item.material_id,
                    material_code=item.material_code,
                    material_name=item.material_name,
                    material_spec=item.material_spec,
                    material_unit=item.material_unit,
                    delivery_quantity=float(delivery_qty),
                    unit_price=float(item.unit_price),
                    total_amount=float(item_total_amount),
                    demand_id=None,  # 可以后续关联到统一需求表
                    demand_item_id=None,  # 可以后续关联到需求明细
                )
            )
            
            total_quantity += delivery_qty
            total_amount += item_total_amount
        
        if not delivery_items:
            raise BusinessLogicError("没有可出库的物料")
        
        # 创建销售出库单
        delivery_data = SalesDeliveryCreate(
            sales_order_id=sales_order_id,
            sales_order_code=sales_order.order_code,
            demand_type="sales_order",  # 销售出库与需求关联功能增强
            customer_id=sales_order.customer_id,
            customer_name=sales_order.customer_name,
            warehouse_id=warehouse_id,
            warehouse_name=warehouse_name,
            status="待出库",
            total_quantity=float(total_quantity),
            total_amount=float(total_amount),
            shipping_address=sales_order.shipping_address,
            shipping_method=sales_order.shipping_method,
            notes=f"从销售订单 {sales_order.order_code} 上拉生成",
            items=delivery_items
        )
        
        # 创建出库单
        delivery = await self.create_sales_delivery(
            tenant_id=tenant_id,
            delivery_data=delivery_data,
            created_by=created_by
        )
        
        # TODO: 更新销售订单明细的已交货数量和剩余数量
        # 注意：这里暂时不更新，等确认出库后再更新
        
        return delivery

    async def pull_from_sales_forecast(
        self,
        tenant_id: int,
        sales_forecast_id: int,
        created_by: int,
        delivery_quantities: Optional[Dict[int, float]] = None,
        warehouse_id: Optional[int] = None,
        warehouse_name: Optional[str] = None
    ) -> SalesDeliveryResponse:
        """
        从销售预测上拉生成销售出库单（销售出库单上拉功能）
        
        从销售预测上拉，自动生成销售出库单（MTS模式）
        
        Args:
            tenant_id: 租户ID
            sales_forecast_id: 销售预测ID
            created_by: 创建人ID
            delivery_quantities: 出库数量字典 {item_id: quantity}，如果不提供则使用预测数量
            warehouse_id: 出库仓库ID（可选）
            warehouse_name: 出库仓库名称（可选）
            
        Returns:
            SalesDeliveryResponse: 创建的销售出库单信息
            
        Raises:
            NotFoundError: 销售预测不存在
            BusinessLogicError: 销售预测未审核
        """
        from apps.kuaizhizao.models.sales_forecast import SalesForecast
        from apps.kuaizhizao.models.sales_forecast_item import SalesForecastItem
        from apps.kuaizhizao.schemas.warehouse import SalesDeliveryItemCreate
        from decimal import Decimal
        
        # 获取销售预测
        sales_forecast = await SalesForecast.get_or_none(tenant_id=tenant_id, id=sales_forecast_id)
        if not sales_forecast:
            raise NotFoundError(f"销售预测不存在: {sales_forecast_id}")
        
        # 检查预测状态（只有已审核的预测才能上拉生成出库单）
        if sales_forecast.status != "已审核":
            raise BusinessLogicError("只有已审核的销售预测才能上拉生成销售出库单")
        
        # 获取预测明细
        forecast_items = await SalesForecastItem.filter(
            tenant_id=tenant_id,
            forecast_id=sales_forecast_id
        ).all()
        
        if not forecast_items:
            raise BusinessLogicError("销售预测没有明细，无法生成销售出库单")
        
        # 如果没有指定仓库，需要从配置或其他地方获取默认仓库
        if not warehouse_id:
            # TODO: 从配置或其他地方获取默认仓库
            raise ValidationError("必须指定出库仓库")
        
        # 如果没有指定仓库名称，尝试从仓库服务获取
        if not warehouse_name:
            # TODO: 从仓库服务获取仓库名称
            warehouse_name = f"仓库{warehouse_id}"
        
        # 准备出库单明细
        delivery_items = []
        total_quantity = Decimal("0")
        total_amount = Decimal("0")
        
        # MTS模式下，没有客户信息，需要从其他配置获取默认客户或设置为空
        # 这里暂时使用一个默认客户ID（实际应该从配置获取）
        default_customer_id = None  # TODO: 从配置获取默认客户
        default_customer_name = "MTS默认客户"  # TODO: 从配置获取默认客户名称
        
        for item in forecast_items:
            # 计算出库数量
            if delivery_quantities and item.id in delivery_quantities:
                delivery_qty = Decimal(str(delivery_quantities[item.id]))
            else:
                # 使用预测数量
                delivery_qty = item.forecast_quantity
            
            if delivery_qty <= 0:
                continue  # 跳过数量为0或负数的情况
            
            # MTS模式下，没有单价，需要从物料默认价格获取
            # TODO: 从物料默认价格获取单价
            unit_price = Decimal("0")  # 默认价格为0
            
            # 计算金额
            item_total_amount = delivery_qty * unit_price
            
            delivery_items.append(
                SalesDeliveryItemCreate(
                    material_id=item.material_id,
                    material_code=item.material_code,
                    material_name=item.material_name,
                    material_spec=item.material_spec,
                    material_unit=item.material_unit,
                    delivery_quantity=float(delivery_qty),
                    unit_price=float(unit_price),
                    total_amount=float(item_total_amount),
                    demand_id=None,  # 可以后续关联到统一需求表
                    demand_item_id=None,  # 可以后续关联到需求明细
                )
            )
            
            total_quantity += delivery_qty
            total_amount += item_total_amount
        
        if not delivery_items:
            raise BusinessLogicError("没有可出库的物料")
        
        # 创建销售出库单
        delivery_data = SalesDeliveryCreate(
            sales_forecast_id=sales_forecast_id,
            sales_forecast_code=sales_forecast.forecast_code,
            demand_type="sales_forecast",  # 销售出库与需求关联功能增强
            customer_id=default_customer_id or 0,
            customer_name=default_customer_name,
            warehouse_id=warehouse_id,
            warehouse_name=warehouse_name,
            status="待出库",
            total_quantity=float(total_quantity),
            total_amount=float(total_amount),
            notes=f"从销售预测 {sales_forecast.forecast_code} 上拉生成",
            items=delivery_items
        )
        
        # 创建出库单
        delivery = await self.create_sales_delivery(
            tenant_id=tenant_id,
            delivery_data=delivery_data,
            created_by=created_by
        )
        
        return delivery


class SalesReturnService(AppBaseService[SalesReturn]):
    """销售退货单服务"""

    def __init__(self):
        super().__init__(SalesReturn)

    async def create_sales_return(self, tenant_id: int, return_data: SalesReturnCreate, created_by: int) -> SalesReturnResponse:
        """创建销售退货单"""
        async with in_transaction():
            user_info = await self.get_user_info(created_by)
            # 如果未提供return_code，则自动生成
            if return_data.return_code:
                code = return_data.return_code
            else:
                today = datetime.now().strftime("%Y%m%d")
                code = await self.generate_code(tenant_id, "SALES_RETURN_CODE", prefix=f"SR{today}")

            # 从return_data中提取items（如果存在）
            items = getattr(return_data, 'items', None) or []
            
            # 计算总数量和总金额
            total_quantity = sum(item.return_quantity for item in items) if items else 0
            total_amount = sum(item.total_amount for item in items) if items else 0

            # 如果关联了销售出库单，获取相关信息
            sales_delivery_id = return_data.sales_delivery_id
            sales_delivery_code = return_data.sales_delivery_code
            sales_order_id = return_data.sales_order_id
            sales_order_code = return_data.sales_order_code
            
            # 如果提供了sales_delivery_id但没有sales_delivery_code，尝试获取
            if sales_delivery_id and not sales_delivery_code:
                delivery = await SalesDelivery.get_or_none(tenant_id=tenant_id, id=sales_delivery_id)
                if delivery:
                    sales_delivery_code = delivery.delivery_code
                    if not sales_order_id:
                        sales_order_id = delivery.sales_order_id
                        sales_order_code = delivery.sales_order_code
            
            return_obj = await SalesReturn.create(
                tenant_id=tenant_id,
                uuid=str(uuid.uuid4()),
                return_code=code,
                sales_delivery_id=sales_delivery_id,
                sales_delivery_code=sales_delivery_code or "",
                sales_order_id=sales_order_id,
                sales_order_code=sales_order_code or "",
                customer_id=return_data.customer_id,
                customer_name=return_data.customer_name,
                warehouse_id=return_data.warehouse_id,
                warehouse_name=return_data.warehouse_name,
                return_time=return_data.return_time,
                returner_id=return_data.returner_id,
                returner_name=return_data.returner_name,
                reviewer_id=return_data.reviewer_id,
                reviewer_name=return_data.reviewer_name,
                review_time=return_data.review_time,
                review_status=return_data.review_status,
                review_remarks=return_data.review_remarks,
                return_reason=return_data.return_reason,
                return_type=return_data.return_type,
                status=return_data.status,
                total_quantity=total_quantity,
                total_amount=total_amount,
                shipping_method=return_data.shipping_method,
                tracking_number=return_data.tracking_number,
                shipping_address=getattr(return_data, 'shipping_address', None),
                notes=return_data.notes,
                created_by=user_info.get("id"),
            )
            
            # 创建退货单明细
            if items:
                for item_data in items:
                    # 序列号信息（批号和序列号选择功能增强）
                    serial_numbers = getattr(item_data, 'serial_numbers', None)
                    # 如果serial_numbers是列表，转换为JSON格式存储
                    if serial_numbers and isinstance(serial_numbers, list):
                        import json
                        serial_numbers_json = json.dumps(serial_numbers)
                    elif serial_numbers:
                        # 如果已经是字符串格式的JSON，直接使用
                        serial_numbers_json = serial_numbers if isinstance(serial_numbers, str) else None
                    else:
                        serial_numbers_json = None
                    
                    await SalesReturnItem.create(
                        tenant_id=tenant_id,
                        return_id=return_obj.id,
                        sales_delivery_item_id=getattr(item_data, 'sales_delivery_item_id', None),
                        material_id=item_data.material_id,
                        material_code=item_data.material_code,
                        material_name=item_data.material_name,
                        material_spec=getattr(item_data, 'material_spec', None),
                        material_unit=item_data.material_unit,
                        return_quantity=item_data.return_quantity,
                        unit_price=item_data.unit_price,
                        total_amount=item_data.total_amount,
                        location_id=getattr(item_data, 'location_id', None),
                        location_code=getattr(item_data, 'location_code', None),
                        batch_number=getattr(item_data, 'batch_number', None),
                        expiry_date=getattr(item_data, 'expiry_date', None),
                        serial_numbers=serial_numbers_json,  # 批号和序列号选择功能增强
                        status=getattr(item_data, 'status', '待退货'),
                        return_time=getattr(item_data, 'return_time', None),
                        notes=getattr(item_data, 'notes', None),
                    )
            
            return SalesReturnResponse.model_validate(return_obj)

    async def get_sales_return_by_id(self, tenant_id: int, return_id: int) -> SalesReturnResponse:
        """根据ID获取销售退货单"""
        return_obj = await SalesReturn.get_or_none(tenant_id=tenant_id, id=return_id)
        if not return_obj:
            raise NotFoundError(f"销售退货单不存在: {return_id}")
        return SalesReturnResponse.model_validate(return_obj)

    async def list_sales_returns(self, tenant_id: int, skip: int = 0, limit: int = 20, **filters) -> List[SalesReturnResponse]:
        """获取销售退货单列表"""
        query = SalesReturn.filter(tenant_id=tenant_id, deleted_at__isnull=True)

        # 应用过滤条件
        if filters.get('status'):
            query = query.filter(status=filters['status'])
        if filters.get('sales_delivery_id'):
            query = query.filter(sales_delivery_id=filters['sales_delivery_id'])
        if filters.get('customer_id'):
            query = query.filter(customer_id=filters['customer_id'])

        returns = await query.offset(skip).limit(limit).order_by('-created_at')
        return [SalesReturnResponse.model_validate(return_obj) for return_obj in returns]

    async def confirm_return(self, tenant_id: int, return_id: int, confirmed_by: int) -> SalesReturnResponse:
        """确认退货"""
        async with in_transaction():
            return_obj = await self.get_sales_return_by_id(tenant_id, return_id)

            if return_obj.status != '待退货':
                raise BusinessLogicError("只有待退货状态的销售退货单才能确认退货")

            returner_name = await self.get_user_name(confirmed_by)

            await SalesReturn.filter(tenant_id=tenant_id, id=return_id).update(
                status='已退货',
                returner_id=confirmed_by,
                returner_name=returner_name,
                return_time=datetime.now(),
                updated_by=confirmed_by
            )

            # TODO: 更新库存（增加库存）
            # TODO: 更新销售出库单状态
            
            # TODO: 如果关联了应收单，需要处理应收单调整（减少应收账款或创建红字应收单）

            updated_return = await self.get_sales_return_by_id(tenant_id, return_id)
            return updated_return

    async def delete_sales_return(self, tenant_id: int, return_id: int) -> bool:
        """删除销售退货单（软删除，仅待退货状态可删）"""
        return_obj = await SalesReturn.get_or_none(tenant_id=tenant_id, id=return_id, deleted_at__isnull=True)
        if not return_obj:
            raise NotFoundError(f"销售退货单不存在: {return_id}")
        if return_obj.status != "待退货":
            raise BusinessLogicError("只有待退货状态的销售退货单才能删除")
        await SalesReturn.filter(tenant_id=tenant_id, id=return_id).update(
            deleted_at=datetime.now()
        )
        return True


class PurchaseReturnService(AppBaseService[PurchaseReturn]):
    """采购退货单服务"""

    def __init__(self):
        super().__init__(PurchaseReturn)

    async def create_purchase_return(self, tenant_id: int, return_data: PurchaseReturnCreate, created_by: int) -> PurchaseReturnResponse:
        """创建采购退货单"""
        async with in_transaction():
            user_info = await self.get_user_info(created_by)
            # 如果未提供return_code，则自动生成
            if return_data.return_code:
                code = return_data.return_code
            else:
                today = datetime.now().strftime("%Y%m%d")
                code = await self.generate_code(tenant_id, "PURCHASE_RETURN_CODE", prefix=f"PRT{today}")

            # 从return_data中提取items（如果存在）
            items = getattr(return_data, 'items', None) or []
            
            # 计算总数量和总金额
            total_quantity = sum(item.return_quantity for item in items) if items else 0
            total_amount = sum(item.total_amount for item in items) if items else 0

            # 如果关联了采购入库单，获取相关信息
            purchase_receipt_id = return_data.purchase_receipt_id
            purchase_receipt_code = return_data.purchase_receipt_code
            purchase_order_id = return_data.purchase_order_id
            purchase_order_code = return_data.purchase_order_code
            
            # 如果提供了purchase_receipt_id但没有purchase_receipt_code，尝试获取
            if purchase_receipt_id and not purchase_receipt_code:
                receipt = await PurchaseReceipt.get_or_none(tenant_id=tenant_id, id=purchase_receipt_id)
                if receipt:
                    purchase_receipt_code = receipt.receipt_code
                    if not purchase_order_id:
                        purchase_order_id = receipt.purchase_order_id
                        purchase_order_code = receipt.purchase_order_code
            
            return_obj = await PurchaseReturn.create(
                tenant_id=tenant_id,
                uuid=str(uuid.uuid4()),
                return_code=code,
                purchase_receipt_id=purchase_receipt_id,
                purchase_receipt_code=purchase_receipt_code or "",
                purchase_order_id=purchase_order_id,
                purchase_order_code=purchase_order_code or "",
                supplier_id=return_data.supplier_id,
                supplier_name=return_data.supplier_name,
                warehouse_id=return_data.warehouse_id,
                warehouse_name=return_data.warehouse_name,
                return_time=return_data.return_time,
                returner_id=return_data.returner_id,
                returner_name=return_data.returner_name,
                reviewer_id=return_data.reviewer_id,
                reviewer_name=return_data.reviewer_name,
                review_time=return_data.review_time,
                review_status=return_data.review_status,
                review_remarks=return_data.review_remarks,
                return_reason=return_data.return_reason,
                return_type=return_data.return_type,
                status=return_data.status,
                total_quantity=total_quantity,
                total_amount=total_amount,
                shipping_method=return_data.shipping_method,
                tracking_number=return_data.tracking_number,
                shipping_address=getattr(return_data, 'shipping_address', None),
                notes=return_data.notes,
                created_by=user_info.get("id"),
            )
            
            # 创建退货单明细
            if items:
                for item_data in items:
                    # 序列号信息（批号和序列号选择功能增强）
                    serial_numbers = getattr(item_data, 'serial_numbers', None)
                    # 如果serial_numbers是列表，转换为JSON格式存储
                    if serial_numbers and isinstance(serial_numbers, list):
                        import json
                        serial_numbers_json = json.dumps(serial_numbers)
                    elif serial_numbers:
                        # 如果已经是字符串格式的JSON，直接使用
                        serial_numbers_json = serial_numbers if isinstance(serial_numbers, str) else None
                    else:
                        serial_numbers_json = None
                    
                    await PurchaseReturnItem.create(
                        tenant_id=tenant_id,
                        return_id=return_obj.id,
                        purchase_receipt_item_id=getattr(item_data, 'purchase_receipt_item_id', None),
                        material_id=item_data.material_id,
                        material_code=item_data.material_code,
                        material_name=item_data.material_name,
                        material_spec=getattr(item_data, 'material_spec', None),
                        material_unit=item_data.material_unit,
                        return_quantity=item_data.return_quantity,
                        unit_price=item_data.unit_price,
                        total_amount=item_data.total_amount,
                        location_id=getattr(item_data, 'location_id', None),
                        location_code=getattr(item_data, 'location_code', None),
                        batch_number=getattr(item_data, 'batch_number', None),
                        expiry_date=getattr(item_data, 'expiry_date', None),
                        serial_numbers=serial_numbers_json,  # 批号和序列号选择功能增强
                        status=getattr(item_data, 'status', '待退货'),
                        return_time=getattr(item_data, 'return_time', None),
                        notes=getattr(item_data, 'notes', None),
                    )
            
            return PurchaseReturnResponse.model_validate(return_obj)

    async def get_purchase_return_by_id(self, tenant_id: int, return_id: int) -> PurchaseReturnResponse:
        """根据ID获取采购退货单"""
        return_obj = await PurchaseReturn.get_or_none(tenant_id=tenant_id, id=return_id)
        if not return_obj:
            raise NotFoundError(f"采购退货单不存在: {return_id}")
        return PurchaseReturnResponse.model_validate(return_obj)

    async def list_purchase_returns(self, tenant_id: int, skip: int = 0, limit: int = 20, **filters) -> List[PurchaseReturnResponse]:
        """获取采购退货单列表"""
        query = PurchaseReturn.filter(tenant_id=tenant_id, deleted_at__isnull=True)

        # 应用过滤条件
        if filters.get('status'):
            query = query.filter(status=filters['status'])
        if filters.get('purchase_receipt_id'):
            query = query.filter(purchase_receipt_id=filters['purchase_receipt_id'])
        if filters.get('supplier_id'):
            query = query.filter(supplier_id=filters['supplier_id'])

        returns = await query.offset(skip).limit(limit).order_by('-created_at')
        return [PurchaseReturnResponse.model_validate(return_obj) for return_obj in returns]

    async def confirm_return(self, tenant_id: int, return_id: int, confirmed_by: int) -> PurchaseReturnResponse:
        """确认退货"""
        async with in_transaction():
            return_obj = await self.get_purchase_return_by_id(tenant_id, return_id)

            if return_obj.status != '待退货':
                raise BusinessLogicError("只有待退货状态的采购退货单才能确认退货")

            returner_name = await self.get_user_name(confirmed_by)

            await PurchaseReturn.filter(tenant_id=tenant_id, id=return_id).update(
                status='已退货',
                returner_id=confirmed_by,
                returner_name=returner_name,
                return_time=datetime.now(),
                updated_by=confirmed_by
            )

            # TODO: 更新库存（扣减库存）
            # TODO: 更新采购入库单状态
            
            # TODO: 如果关联了应付单，需要处理应付单调整（减少应付账款或创建红字应付单）

            updated_return = await self.get_purchase_return_by_id(tenant_id, return_id)
            return updated_return

    async def delete_purchase_return(self, tenant_id: int, return_id: int) -> bool:
        """删除采购退货单（软删除，仅待退货状态可删）"""
        return_obj = await PurchaseReturn.get_or_none(tenant_id=tenant_id, id=return_id, deleted_at__isnull=True)
        if not return_obj:
            raise NotFoundError(f"采购退货单不存在: {return_id}")
        if return_obj.status != "待退货":
            raise BusinessLogicError("只有待退货状态的采购退货单才能删除")
        await PurchaseReturn.filter(tenant_id=tenant_id, id=return_id).update(
            deleted_at=datetime.now()
        )
        return True


class OtherInboundService(AppBaseService[OtherInbound]):
    """其他入库单服务"""

    def __init__(self):
        super().__init__(OtherInbound)
        self.business_config_service = BusinessConfigService()

    async def create_other_inbound(
        self,
        tenant_id: int,
        inbound_data: OtherInboundCreate,
        created_by: int
    ) -> OtherInboundResponse:
        """创建其他入库单"""
        is_enabled = await self.business_config_service.check_node_enabled(tenant_id, "inbound")
        if not is_enabled:
            raise BusinessLogicError("入库管理节点未启用，无法创建其他入库单")
        async with in_transaction():
            user_info = await self.get_user_info(created_by)
            today = datetime.now().strftime("%Y%m%d")
            code = await self.generate_code(tenant_id, "OTHER_INBOUND_CODE", prefix=f"OI{today}")

            dump = inbound_data.model_dump(exclude_unset=True, exclude={"created_by", "items", "inbound_code"})
            if inbound_data.inbound_code:
                code = inbound_data.inbound_code

            inbound = await OtherInbound.create(
                tenant_id=tenant_id,
                inbound_code=code,
                created_by=created_by,
                **dump
            )

            items = getattr(inbound_data, "items", None) or []
            total_quantity = Decimal(0)
            total_amount = Decimal(0)
            for item_data in items:
                qty = Decimal(str(item_data.inbound_quantity))
                price = Decimal(str(item_data.unit_price))
                amt = qty * price
                await OtherInboundItem.create(
                    tenant_id=tenant_id,
                    inbound_id=inbound.id,
                    inbound_quantity=qty,
                    unit_price=price,
                    total_amount=amt,
                    **item_data.model_dump(exclude_unset=True, exclude={"inbound_quantity", "unit_price", "total_amount"})
                )
                total_quantity += qty
                total_amount += amt

            await OtherInbound.filter(tenant_id=tenant_id, id=inbound.id).update(
                total_quantity=total_quantity,
                total_amount=total_amount
            )
            inbound = await OtherInbound.get(tenant_id=tenant_id, id=inbound.id)
            return OtherInboundResponse.model_validate(inbound)

    async def get_other_inbound_by_id(
        self,
        tenant_id: int,
        inbound_id: int
    ) -> OtherInboundWithItemsResponse:
        """根据ID获取其他入库单（含明细）"""
        inbound = await OtherInbound.get_or_none(tenant_id=tenant_id, id=inbound_id)
        if not inbound:
            raise NotFoundError(f"其他入库单不存在: {inbound_id}")

        items = await OtherInboundItem.filter(tenant_id=tenant_id, inbound_id=inbound_id).all()
        response = OtherInboundWithItemsResponse.model_validate(inbound)
        response.items = [OtherInboundItemResponse.model_validate(i) for i in items]
        return response

    async def list_other_inbounds(
        self,
        tenant_id: int,
        skip: int = 0,
        limit: int = 20,
        **filters
    ) -> List[OtherInboundListResponse]:
        """获取其他入库单列表"""
        query = OtherInbound.filter(tenant_id=tenant_id)
        if filters.get("status"):
            query = query.filter(status=filters["status"])
        if filters.get("reason_type"):
            query = query.filter(reason_type=filters["reason_type"])
        if filters.get("warehouse_id"):
            query = query.filter(warehouse_id=filters["warehouse_id"])

        inbounds = await query.offset(skip).limit(limit).order_by("-created_at")
        return [OtherInboundListResponse.model_validate(r) for r in inbounds]

    async def update_other_inbound(
        self,
        tenant_id: int,
        inbound_id: int,
        inbound_data: OtherInboundUpdate,
        updated_by: int
    ) -> OtherInboundResponse:
        """更新其他入库单"""
        async with in_transaction():
            await self.get_other_inbound_by_id(tenant_id, inbound_id)
            dump = inbound_data.model_dump(exclude_unset=True, exclude={"inbound_code"})
            dump["updated_by"] = updated_by
            await OtherInbound.filter(tenant_id=tenant_id, id=inbound_id).update(**dump)
            return OtherInboundResponse.model_validate(
                await OtherInbound.get(tenant_id=tenant_id, id=inbound_id)
            )

    async def delete_other_inbound(self, tenant_id: int, inbound_id: int) -> bool:
        """删除其他入库单"""
        inbound = await OtherInbound.get_or_none(tenant_id=tenant_id, id=inbound_id)
        if not inbound:
            raise NotFoundError(f"其他入库单不存在: {inbound_id}")
        if inbound.status not in ("待入库", "已取消"):
            raise BusinessLogicError("只能删除待入库或已取消状态的其他入库单")

        await OtherInbound.filter(tenant_id=tenant_id, id=inbound_id).update(
            is_active=False,
            deleted_at=datetime.now()
        )
        return True

    async def confirm_inbound(
        self,
        tenant_id: int,
        inbound_id: int,
        confirmed_by: int
    ) -> OtherInboundResponse:
        """确认入库"""
        async with in_transaction():
            inbound = await self.get_other_inbound_by_id(tenant_id, inbound_id)
            if inbound.status != "待入库":
                raise BusinessLogicError("只有待入库状态的其他入库单才能确认入库")

            receiver_name = await self.get_user_name(confirmed_by)
            await OtherInbound.filter(tenant_id=tenant_id, id=inbound_id).update(
                status="已入库",
                receiver_id=confirmed_by,
                receiver_name=receiver_name,
                receipt_time=datetime.now(),
                updated_by=confirmed_by
            )
            for item in inbound.items:
                await OtherInboundItem.filter(
                    tenant_id=tenant_id,
                    id=item.id
                ).update(status="已入库", receipt_time=datetime.now())

            # TODO: 更新库存（增加仓库库存）
            return OtherInboundResponse.model_validate(
                await OtherInbound.get(tenant_id=tenant_id, id=inbound_id)
            )


class OtherOutboundService(AppBaseService[OtherOutbound]):
    """其他出库单服务"""

    def __init__(self):
        super().__init__(OtherOutbound)
        self.business_config_service = BusinessConfigService()

    async def create_other_outbound(
        self,
        tenant_id: int,
        outbound_data: OtherOutboundCreate,
        created_by: int
    ) -> OtherOutboundResponse:
        """创建其他出库单"""
        is_enabled = await self.business_config_service.check_node_enabled(tenant_id, "outbound")
        if not is_enabled:
            raise BusinessLogicError("出库管理节点未启用，无法创建其他出库单")
        async with in_transaction():
            user_info = await self.get_user_info(created_by)
            today = datetime.now().strftime("%Y%m%d")
            code = await self.generate_code(tenant_id, "OTHER_OUTBOUND_CODE", prefix=f"OO{today}")

            dump = outbound_data.model_dump(exclude_unset=True, exclude={"created_by", "items", "outbound_code"})
            if outbound_data.outbound_code:
                code = outbound_data.outbound_code

            outbound = await OtherOutbound.create(
                tenant_id=tenant_id,
                outbound_code=code,
                created_by=created_by,
                **dump
            )

            items = getattr(outbound_data, "items", None) or []
            total_quantity = Decimal(0)
            total_amount = Decimal(0)
            for item_data in items:
                qty = Decimal(str(item_data.outbound_quantity))
                price = Decimal(str(item_data.unit_price))
                amt = qty * price
                await OtherOutboundItem.create(
                    tenant_id=tenant_id,
                    outbound_id=outbound.id,
                    outbound_quantity=qty,
                    unit_price=price,
                    total_amount=amt,
                    **item_data.model_dump(exclude_unset=True, exclude={"outbound_quantity", "unit_price", "total_amount"})
                )
                total_quantity += qty
                total_amount += amt

            await OtherOutbound.filter(tenant_id=tenant_id, id=outbound.id).update(
                total_quantity=total_quantity,
                total_amount=total_amount
            )
            outbound = await OtherOutbound.get(tenant_id=tenant_id, id=outbound.id)
            return OtherOutboundResponse.model_validate(outbound)

    async def get_other_outbound_by_id(
        self,
        tenant_id: int,
        outbound_id: int
    ) -> OtherOutboundWithItemsResponse:
        """根据ID获取其他出库单（含明细）"""
        outbound = await OtherOutbound.get_or_none(tenant_id=tenant_id, id=outbound_id)
        if not outbound:
            raise NotFoundError(f"其他出库单不存在: {outbound_id}")

        items = await OtherOutboundItem.filter(tenant_id=tenant_id, outbound_id=outbound_id).all()
        response = OtherOutboundWithItemsResponse.model_validate(outbound)
        response.items = [OtherOutboundItemResponse.model_validate(i) for i in items]
        return response

    async def list_other_outbounds(
        self,
        tenant_id: int,
        skip: int = 0,
        limit: int = 20,
        **filters
    ) -> List[OtherOutboundListResponse]:
        """获取其他出库单列表"""
        query = OtherOutbound.filter(tenant_id=tenant_id)
        if filters.get("status"):
            query = query.filter(status=filters["status"])
        if filters.get("reason_type"):
            query = query.filter(reason_type=filters["reason_type"])
        if filters.get("warehouse_id"):
            query = query.filter(warehouse_id=filters["warehouse_id"])

        outbounds = await query.offset(skip).limit(limit).order_by("-created_at")
        return [OtherOutboundListResponse.model_validate(r) for r in outbounds]

    async def update_other_outbound(
        self,
        tenant_id: int,
        outbound_id: int,
        outbound_data: OtherOutboundUpdate,
        updated_by: int
    ) -> OtherOutboundResponse:
        """更新其他出库单"""
        async with in_transaction():
            await self.get_other_outbound_by_id(tenant_id, outbound_id)
            dump = outbound_data.model_dump(exclude_unset=True, exclude={"outbound_code"})
            dump["updated_by"] = updated_by
            await OtherOutbound.filter(tenant_id=tenant_id, id=outbound_id).update(**dump)
            return OtherOutboundResponse.model_validate(
                await OtherOutbound.get(tenant_id=tenant_id, id=outbound_id)
            )

    async def delete_other_outbound(self, tenant_id: int, outbound_id: int) -> bool:
        """删除其他出库单"""
        outbound = await OtherOutbound.get_or_none(tenant_id=tenant_id, id=outbound_id)
        if not outbound:
            raise NotFoundError(f"其他出库单不存在: {outbound_id}")
        if outbound.status not in ("待出库", "已取消"):
            raise BusinessLogicError("只能删除待出库或已取消状态的其他出库单")

        await OtherOutbound.filter(tenant_id=tenant_id, id=outbound_id).update(
            is_active=False,
            deleted_at=datetime.now()
        )
        return True

    async def confirm_outbound(
        self,
        tenant_id: int,
        outbound_id: int,
        confirmed_by: int
    ) -> OtherOutboundResponse:
        """确认出库"""
        async with in_transaction():
            outbound = await self.get_other_outbound_by_id(tenant_id, outbound_id)
            if outbound.status != "待出库":
                raise BusinessLogicError("只有待出库状态的其他出库单才能确认出库")

            deliverer_name = await self.get_user_name(confirmed_by)
            await OtherOutbound.filter(tenant_id=tenant_id, id=outbound_id).update(
                status="已出库",
                deliverer_id=confirmed_by,
                deliverer_name=deliverer_name,
                delivery_time=datetime.now(),
                updated_by=confirmed_by
            )
            for item in outbound.items:
                await OtherOutboundItem.filter(
                    tenant_id=tenant_id,
                    id=item.id
                ).update(status="已出库", delivery_time=datetime.now())

            # TODO: 更新库存（扣减库存）
            return OtherOutboundResponse.model_validate(
                await OtherOutbound.get(tenant_id=tenant_id, id=outbound_id)
            )


class MaterialBorrowService(AppBaseService[MaterialBorrow]):
    """借料单服务"""

    def __init__(self):
        super().__init__(MaterialBorrow)

    async def create_material_borrow(
        self,
        tenant_id: int,
        borrow_data: MaterialBorrowCreate,
        created_by: int
    ) -> MaterialBorrowResponse:
        """创建借料单"""
        async with in_transaction():
            today = datetime.now().strftime("%Y%m%d")
            code = await self.generate_code(tenant_id, "MATERIAL_BORROW_CODE", prefix=f"MB{today}")

            dump = borrow_data.model_dump(exclude_unset=True, exclude={"items", "borrow_code"})
            if borrow_data.borrow_code:
                code = borrow_data.borrow_code

            borrow = await MaterialBorrow.create(
                tenant_id=tenant_id,
                borrow_code=code,
                created_by=created_by,
                **dump
            )

            items = getattr(borrow_data, "items", None) or []
            total_quantity = Decimal(0)
            for item_data in items:
                qty = Decimal(str(item_data.borrow_quantity))
                await MaterialBorrowItem.create(
                    tenant_id=tenant_id,
                    borrow_id=borrow.id,
                    borrow_quantity=qty,
                    returned_quantity=Decimal(0),
                    **item_data.model_dump(exclude_unset=True, exclude={"borrow_quantity", "returned_quantity"})
                )
                total_quantity += qty

            await MaterialBorrow.filter(tenant_id=tenant_id, id=borrow.id).update(total_quantity=total_quantity)
            borrow = await MaterialBorrow.get(tenant_id=tenant_id, id=borrow.id)
            return MaterialBorrowResponse.model_validate(borrow)

    async def get_material_borrow_by_id(
        self,
        tenant_id: int,
        borrow_id: int
    ) -> MaterialBorrowWithItemsResponse:
        """根据ID获取借料单（含明细）"""
        borrow = await MaterialBorrow.get_or_none(tenant_id=tenant_id, id=borrow_id, deleted_at__isnull=True)
        if not borrow:
            raise NotFoundError(f"借料单不存在: {borrow_id}")

        items = await MaterialBorrowItem.filter(tenant_id=tenant_id, borrow_id=borrow_id).all()
        response = MaterialBorrowWithItemsResponse.model_validate(borrow)
        response.items = [MaterialBorrowItemResponse.model_validate(i) for i in items]
        return response

    async def list_material_borrows(
        self,
        tenant_id: int,
        skip: int = 0,
        limit: int = 20,
        **filters
    ) -> List[MaterialBorrowListResponse]:
        """获取借料单列表"""
        query = MaterialBorrow.filter(tenant_id=tenant_id, deleted_at__isnull=True)
        if filters.get("status"):
            query = query.filter(status=filters["status"])
        if filters.get("warehouse_id"):
            query = query.filter(warehouse_id=filters["warehouse_id"])

        borrows = await query.offset(skip).limit(limit).order_by("-created_at")
        return [MaterialBorrowListResponse.model_validate(r) for r in borrows]

    async def update_material_borrow(
        self,
        tenant_id: int,
        borrow_id: int,
        borrow_data: MaterialBorrowUpdate,
        updated_by: int
    ) -> MaterialBorrowResponse:
        """更新借料单"""
        borrow = await self.get_material_borrow_by_id(tenant_id, borrow_id)
        if borrow.status != "待借出":
            raise BusinessLogicError("只能更新待借出状态的借料单")

        async with in_transaction():
            dump = borrow_data.model_dump(exclude_unset=True, exclude={"borrow_code"})
            dump["updated_by"] = updated_by
            await MaterialBorrow.filter(tenant_id=tenant_id, id=borrow_id).update(**dump)
            return MaterialBorrowResponse.model_validate(
                await MaterialBorrow.get(tenant_id=tenant_id, id=borrow_id)
            )

    async def delete_material_borrow(self, tenant_id: int, borrow_id: int) -> bool:
        """删除借料单"""
        borrow = await MaterialBorrow.get_or_none(tenant_id=tenant_id, id=borrow_id, deleted_at__isnull=True)
        if not borrow:
            raise NotFoundError(f"借料单不存在: {borrow_id}")
        if borrow.status != "待借出":
            raise BusinessLogicError("只能删除待借出状态的借料单")

        await MaterialBorrow.filter(tenant_id=tenant_id, id=borrow_id).update(
            deleted_at=datetime.now()
        )
        return True

    async def confirm_borrow(
        self,
        tenant_id: int,
        borrow_id: int,
        confirmed_by: int
    ) -> MaterialBorrowResponse:
        """确认借出"""
        async with in_transaction():
            borrow = await self.get_material_borrow_by_id(tenant_id, borrow_id)
            if borrow.status != "待借出":
                raise BusinessLogicError("只有待借出状态的借料单才能确认借出")

            borrower_name = await self.get_user_name(confirmed_by)
            await MaterialBorrow.filter(tenant_id=tenant_id, id=borrow_id).update(
                status="已借出",
                borrower_id=confirmed_by,
                borrower_name=borrower_name,
                borrow_time=datetime.now(),
                updated_by=confirmed_by
            )
            for item in borrow.items:
                await MaterialBorrowItem.filter(
                    tenant_id=tenant_id,
                    id=item.id
                ).update(status="已借出", borrow_time=datetime.now())

            # TODO: 更新库存（扣减仓库库存）
            return MaterialBorrowResponse.model_validate(
                await MaterialBorrow.get(tenant_id=tenant_id, id=borrow_id)
            )


class MaterialReturnService(AppBaseService[MaterialReturn]):
    """还料单服务"""

    def __init__(self):
        super().__init__(MaterialReturn)

    async def create_material_return(
        self,
        tenant_id: int,
        return_data: MaterialReturnCreate,
        created_by: int
    ) -> MaterialReturnResponse:
        """创建还料单"""
        async with in_transaction():
            borrow = await MaterialBorrow.get_or_none(tenant_id=tenant_id, id=return_data.borrow_id, deleted_at__isnull=True)
            if not borrow:
                raise NotFoundError(f"借料单不存在: {return_data.borrow_id}")

            today = datetime.now().strftime("%Y%m%d")
            code = await self.generate_code(tenant_id, "MATERIAL_RETURN_CODE", prefix=f"MR{today}")

            dump = return_data.model_dump(exclude_unset=True, exclude={"items", "return_code", "borrow_code"})
            if return_data.return_code:
                code = return_data.return_code

            return_obj = await MaterialReturn.create(
                tenant_id=tenant_id,
                return_code=code,
                borrow_id=borrow.id,
                borrow_code=borrow.borrow_code,
                created_by=created_by,
                **dump
            )

            items = getattr(return_data, "items", None) or []
            total_quantity = Decimal(0)
            for item_data in items:
                qty = Decimal(str(item_data.return_quantity))
                await MaterialReturnItem.create(
                    tenant_id=tenant_id,
                    return_id=return_obj.id,
                    return_quantity=qty,
                    **item_data.model_dump(exclude_unset=True, exclude={"return_quantity"})
                )
                total_quantity += qty

            await MaterialReturn.filter(tenant_id=tenant_id, id=return_obj.id).update(total_quantity=total_quantity)
            return_obj = await MaterialReturn.get(tenant_id=tenant_id, id=return_obj.id)
            return MaterialReturnResponse.model_validate(return_obj)

    async def get_material_return_by_id(
        self,
        tenant_id: int,
        return_id: int
    ) -> MaterialReturnWithItemsResponse:
        """根据ID获取还料单（含明细）"""
        return_obj = await MaterialReturn.get_or_none(tenant_id=tenant_id, id=return_id, deleted_at__isnull=True)
        if not return_obj:
            raise NotFoundError(f"还料单不存在: {return_id}")

        items = await MaterialReturnItem.filter(tenant_id=tenant_id, return_id=return_id).all()
        response = MaterialReturnWithItemsResponse.model_validate(return_obj)
        response.items = [MaterialReturnItemResponse.model_validate(i) for i in items]
        return response

    async def list_material_returns(
        self,
        tenant_id: int,
        skip: int = 0,
        limit: int = 20,
        **filters
    ) -> List[MaterialReturnListResponse]:
        """获取还料单列表"""
        query = MaterialReturn.filter(tenant_id=tenant_id, deleted_at__isnull=True)
        if filters.get("status"):
            query = query.filter(status=filters["status"])
        if filters.get("borrow_id"):
            query = query.filter(borrow_id=filters["borrow_id"])
        if filters.get("warehouse_id"):
            query = query.filter(warehouse_id=filters["warehouse_id"])

        returns = await query.offset(skip).limit(limit).order_by("-created_at")
        return [MaterialReturnListResponse.model_validate(r) for r in returns]

    async def update_material_return(
        self,
        tenant_id: int,
        return_id: int,
        return_data: MaterialReturnUpdate,
        updated_by: int
    ) -> MaterialReturnResponse:
        """更新还料单"""
        return_obj = await self.get_material_return_by_id(tenant_id, return_id)
        if return_obj.status != "待归还":
            raise BusinessLogicError("只能更新待归还状态的还料单")

        async with in_transaction():
            dump = return_data.model_dump(exclude_unset=True, exclude={"return_code"})
            dump["updated_by"] = updated_by
            await MaterialReturn.filter(tenant_id=tenant_id, id=return_id).update(**dump)
            return MaterialReturnResponse.model_validate(
                await MaterialReturn.get(tenant_id=tenant_id, id=return_id)
            )

    async def delete_material_return(self, tenant_id: int, return_id: int) -> bool:
        """删除还料单"""
        return_obj = await MaterialReturn.get_or_none(tenant_id=tenant_id, id=return_id, deleted_at__isnull=True)
        if not return_obj:
            raise NotFoundError(f"还料单不存在: {return_id}")
        if return_obj.status != "待归还":
            raise BusinessLogicError("只能删除待归还状态的还料单")

        await MaterialReturn.filter(tenant_id=tenant_id, id=return_id).update(
            deleted_at=datetime.now()
        )
        return True

    async def confirm_return(
        self,
        tenant_id: int,
        return_id: int,
        confirmed_by: int
    ) -> MaterialReturnResponse:
        """确认归还"""
        async with in_transaction():
            return_obj = await self.get_material_return_by_id(tenant_id, return_id)
            if return_obj.status != "待归还":
                raise BusinessLogicError("只有待归还状态的还料单才能确认归还")

            returner_name = await self.get_user_name(confirmed_by)
            await MaterialReturn.filter(tenant_id=tenant_id, id=return_id).update(
                status="已归还",
                returner_id=confirmed_by,
                returner_name=returner_name,
                return_time=datetime.now(),
                updated_by=confirmed_by
            )
            for item in return_obj.items:
                await MaterialReturnItem.filter(
                    tenant_id=tenant_id,
                    id=item.id
                ).update(status="已归还", return_time=datetime.now())

            # 更新借料单明细的已归还数量
            for item in return_obj.items:
                borrow_item = await MaterialBorrowItem.get_or_none(
                    tenant_id=tenant_id,
                    borrow_id=return_obj.borrow_id,
                    material_id=item.material_id
                )
                if borrow_item:
                    new_returned = (borrow_item.returned_quantity or Decimal(0)) + Decimal(str(item.return_quantity))
                    await MaterialBorrowItem.filter(tenant_id=tenant_id, id=borrow_item.id).update(
                        returned_quantity=new_returned
                    )

            # TODO: 更新库存（增加仓库库存）
            return MaterialReturnResponse.model_validate(
                await MaterialReturn.get(tenant_id=tenant_id, id=return_id)
            )

