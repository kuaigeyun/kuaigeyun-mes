"""
委外单业务服务模块

提供委外单相关的业务逻辑处理，包括CRUD操作、状态流转、委外入库关联等。

Author: Luigi Lu
Date: 2025-01-04
"""

import uuid
from datetime import datetime
from typing import List, Optional
from decimal import Decimal

from tortoise.queryset import Q
from tortoise.transactions import in_transaction

from infra.exceptions.exceptions import NotFoundError, ValidationError, BusinessLogicError

from apps.base_service import AppBaseService
from apps.kuaizhizao.models.outsource_order import OutsourceOrder
from apps.kuaizhizao.models.work_order import WorkOrder
from apps.kuaizhizao.models.work_order_operation import WorkOrderOperation
from apps.kuaizhizao.models.purchase_receipt import PurchaseReceipt
from apps.kuaizhizao.schemas.outsource_order import (
    OutsourceOrderCreate,
    OutsourceOrderUpdate,
    OutsourceOrderResponse,
    OutsourceOrderListResponse
)
from apps.master_data.models.supplier import Supplier
from loguru import logger


class OutsourceService(AppBaseService[OutsourceOrder]):
    """
    委外单服务类

    处理委外单相关的所有业务逻辑。
    """

    def __init__(self):
        super().__init__(OutsourceOrder)

    async def create_outsource_order(
        self,
        tenant_id: int,
        outsource_order_data: OutsourceOrderCreate,
        created_by: int
    ) -> OutsourceOrderResponse:
        """
        创建委外单

        Args:
            tenant_id: 组织ID
            outsource_order_data: 委外单创建数据
            created_by: 创建人ID

        Returns:
            OutsourceOrderResponse: 创建的委外单信息

        Raises:
            ValidationError: 数据验证失败
            NotFoundError: 工单或工序不存在
        """
        async with in_transaction():
            # 验证工单是否存在
            work_order = await WorkOrder.filter(
                tenant_id=tenant_id,
                id=outsource_order_data.work_order_id,
                deleted_at__isnull=True
            ).first()
            
            if not work_order:
                raise NotFoundError(f"工单不存在: {outsource_order_data.work_order_id}")

            # 验证工单工序是否存在
            work_order_operation = await WorkOrderOperation.filter(
                tenant_id=tenant_id,
                id=outsource_order_data.work_order_operation_id,
                work_order_id=outsource_order_data.work_order_id,
                deleted_at__isnull=True
            ).first()
            
            if not work_order_operation:
                raise NotFoundError(f"工单工序不存在: {outsource_order_data.work_order_operation_id}")

            # 验证供应商是否存在
            supplier = await Supplier.filter(
                tenant_id=tenant_id,
                id=outsource_order_data.supplier_id,
                deleted_at__isnull=True,
                is_active=True
            ).first()
            
            if not supplier:
                raise NotFoundError(f"供应商不存在或已禁用: {outsource_order_data.supplier_id}")

            # 验证委外数量不能超过工序剩余数量
            completed_quantity = work_order_operation.completed_quantity or Decimal('0')
            operation_quantity = work_order_operation.quantity or Decimal('0')
            remaining_quantity = operation_quantity - completed_quantity
            
            if outsource_order_data.outsource_quantity > remaining_quantity:
                raise ValidationError(f"委外数量({outsource_order_data.outsource_quantity})不能超过工序剩余数量({remaining_quantity})")

            # 生成委外单编码（如果未提供）
            if not outsource_order_data.code:
                today = datetime.now().strftime("%Y%m%d")
                code = await self.generate_code(
                    tenant_id=tenant_id,
                    code_type="OUTSOURCE_ORDER_CODE",
                    prefix=f"OS{today}"
                )
            else:
                code = outsource_order_data.code

            # 获取创建人信息
            user_info = await self.get_user_info(created_by)

            # 计算总金额
            total_amount = outsource_order_data.total_amount
            if outsource_order_data.unit_price and not total_amount:
                total_amount = outsource_order_data.unit_price * outsource_order_data.outsource_quantity

            # 创建委外单
            outsource_order = await OutsourceOrder.create(
                tenant_id=tenant_id,
                uuid=str(uuid.uuid4()),
                code=code,
                work_order_id=outsource_order_data.work_order_id,
                work_order_code=work_order.code,
                work_order_operation_id=outsource_order_data.work_order_operation_id,
                operation_id=outsource_order_data.operation_id,
                operation_code=outsource_order_data.operation_code,
                operation_name=outsource_order_data.operation_name,
                supplier_id=outsource_order_data.supplier_id,
                supplier_code=supplier.code,
                supplier_name=supplier.name,
                outsource_quantity=outsource_order_data.outsource_quantity,
                received_quantity=Decimal('0'),
                qualified_quantity=Decimal('0'),
                unqualified_quantity=Decimal('0'),
                unit_price=outsource_order_data.unit_price,
                total_amount=total_amount,
                planned_start_date=outsource_order_data.planned_start_date,
                planned_end_date=outsource_order_data.planned_end_date,
                status="draft",
                remarks=outsource_order_data.remarks,
                created_by=created_by,
                created_by_name=user_info["name"],
                updated_by=created_by,
                updated_by_name=user_info["name"]
            )

            # 建立工单→工序委外的 DocumentRelation（支持单据追溯）
            try:
                from apps.kuaizhizao.services.document_relation_new_service import DocumentRelationNewService
                from apps.kuaizhizao.schemas.document_relation import DocumentRelationCreate

                rel_svc = DocumentRelationNewService()
                await rel_svc.create_relation(
                    tenant_id=tenant_id,
                    relation_data=DocumentRelationCreate(
                        source_type="work_order",
                        source_id=outsource_order_data.work_order_id,
                        source_code=work_order.code,
                        source_name=work_order.name,
                        target_type="outsource_order",
                        target_id=outsource_order.id,
                        target_code=outsource_order.code,
                        target_name=outsource_order_data.operation_name,
                        relation_type="source",
                        relation_mode="push",
                        relation_desc="工单工序委外",
                    ),
                    created_by=created_by,
                )
            except BusinessLogicError:
                pass  # 关联已存在，忽略
            except Exception as e:
                logger.warning("建立工单→工序委外关联失败: %s", e)

            logger.info(f"创建委外单成功: {code}, 工单: {work_order.code}, 工序: {outsource_order_data.operation_name}")
            return OutsourceOrderResponse.model_validate(outsource_order)

    async def create_outsource_order_from_work_order(
        self,
        tenant_id: int,
        work_order_id: int,
        work_order_operation_id: int,
        supplier_id: int,
        outsource_quantity: Decimal,
        created_by: int,
        unit_price: Optional[Decimal] = None,
        planned_start_date: Optional[datetime] = None,
        planned_end_date: Optional[datetime] = None,
        remarks: Optional[str] = None
    ) -> OutsourceOrderResponse:
        """
        从工单工序创建委外单

        这是从工单详情页创建委外单的便捷方法。

        Args:
            tenant_id: 组织ID
            work_order_id: 工单ID
            work_order_operation_id: 工单工序ID
            supplier_id: 供应商ID
            outsource_quantity: 委外数量
            unit_price: 单价（可选）
            planned_start_date: 计划开始日期（可选）
            planned_end_date: 计划结束日期（可选）
            remarks: 备注（可选）
            created_by: 创建人ID

        Returns:
            OutsourceOrderResponse: 创建的委外单信息
        """
        # 获取工单信息
        work_order = await WorkOrder.filter(
            tenant_id=tenant_id,
            id=work_order_id,
            deleted_at__isnull=True
        ).first()
        
        if not work_order:
            raise NotFoundError(f"工单不存在: {work_order_id}")

        # 获取工单工序信息
        work_order_operation = await WorkOrderOperation.filter(
            tenant_id=tenant_id,
            id=work_order_operation_id,
            work_order_id=work_order_id,
            deleted_at__isnull=True
        ).first()
        
        if not work_order_operation:
            raise NotFoundError(f"工单工序不存在: {work_order_operation_id}")

        # 获取供应商信息
        supplier = await Supplier.filter(
            tenant_id=tenant_id,
            id=supplier_id,
            deleted_at__isnull=True,
            is_active=True
        ).first()
        
        if not supplier:
            raise NotFoundError(f"供应商不存在或已禁用: {supplier_id}")

        # 构建创建数据
        create_data = OutsourceOrderCreate(
            work_order_id=work_order_id,
            work_order_code=work_order.code,
            work_order_operation_id=work_order_operation_id,
            operation_id=work_order_operation.operation_id,
            operation_code=work_order_operation.operation_code,
            operation_name=work_order_operation.operation_name,
            supplier_id=supplier_id,
            supplier_code=supplier.code,
            supplier_name=supplier.name,
            outsource_quantity=outsource_quantity,
            unit_price=unit_price,
            planned_start_date=planned_start_date or work_order_operation.planned_start_date,
            planned_end_date=planned_end_date or work_order_operation.planned_end_date,
            remarks=remarks
        )

        return await self.create_outsource_order(
            tenant_id=tenant_id,
            outsource_order_data=create_data,
            created_by=created_by
        )

    async def get_outsource_order_by_id(
        self,
        tenant_id: int,
        outsource_order_id: int
    ) -> OutsourceOrderResponse:
        """
        根据ID获取委外单

        Args:
            tenant_id: 组织ID
            outsource_order_id: 委外单ID

        Returns:
            OutsourceOrderResponse: 委外单信息

        Raises:
            NotFoundError: 委外单不存在
        """
        outsource_order = await OutsourceOrder.filter(
            tenant_id=tenant_id,
            id=outsource_order_id,
            deleted_at__isnull=True
        ).first()

        if not outsource_order:
            raise NotFoundError(f"委外单不存在: {outsource_order_id}")

        return OutsourceOrderResponse.model_validate(outsource_order)

    async def list_outsource_orders(
        self,
        tenant_id: int,
        skip: int = 0,
        limit: int = 100,
        work_order_id: Optional[int] = None,
        supplier_id: Optional[int] = None,
        status: Optional[str] = None,
        code: Optional[str] = None
    ) -> List[OutsourceOrderListResponse]:
        """
        查询委外单列表

        Args:
            tenant_id: 组织ID
            skip: 跳过数量
            limit: 返回数量
            work_order_id: 工单ID（可选筛选）
            supplier_id: 供应商ID（可选筛选）
            status: 状态（可选筛选）
            code: 委外单编码（可选筛选，模糊匹配）

        Returns:
            List[OutsourceOrderListResponse]: 委外单列表
        """
        query = OutsourceOrder.filter(
            tenant_id=tenant_id,
            deleted_at__isnull=True
        )

        # 添加筛选条件
        if work_order_id:
            query = query.filter(work_order_id=work_order_id)
        if supplier_id:
            query = query.filter(supplier_id=supplier_id)
        if status:
            query = query.filter(status=status)
        if code:
            query = query.filter(code__icontains=code)

        outsource_orders = await query.offset(skip).limit(limit).order_by("-created_at").all()

        return [OutsourceOrderListResponse.model_validate(os) for os in outsource_orders]

    async def update_outsource_order(
        self,
        tenant_id: int,
        outsource_order_id: int,
        outsource_order_data: OutsourceOrderUpdate,
        updated_by: int
    ) -> OutsourceOrderResponse:
        """
        更新委外单

        Args:
            tenant_id: 组织ID
            outsource_order_id: 委外单ID
            outsource_order_data: 委外单更新数据
            updated_by: 更新人ID

        Returns:
            OutsourceOrderResponse: 更新后的委外单信息

        Raises:
            NotFoundError: 委外单不存在
            ValidationError: 数据验证失败
        """
        async with in_transaction():
            outsource_order = await OutsourceOrder.filter(
                tenant_id=tenant_id,
                id=outsource_order_id,
                deleted_at__isnull=True
            ).first()

            if not outsource_order:
                raise NotFoundError(f"委外单不存在: {outsource_order_id}")

            # 如果状态为completed或cancelled，不允许更新
            if outsource_order.status in ['completed', 'cancelled']:
                raise BusinessLogicError(f"委外单状态为 {outsource_order.status}，不允许更新")

            # 获取更新人信息
            user_info = await self.get_user_info(updated_by)

            # 更新字段
            update_dict = outsource_order_data.model_dump(exclude_unset=True, exclude_none=True)

            # 如果更新了单价或数量，重新计算总金额
            if 'unit_price' in update_dict or 'outsource_quantity' in update_dict:
                unit_price = update_dict.get('unit_price', outsource_order.unit_price)
                outsource_quantity = update_dict.get('outsource_quantity', outsource_order.outsource_quantity)
                if unit_price:
                    update_dict['total_amount'] = unit_price * outsource_quantity

            # 如果更新了供应商信息，需要验证供应商是否存在
            if 'supplier_id' in update_dict:
                supplier = await Supplier.filter(
                    tenant_id=tenant_id,
                    id=update_dict['supplier_id'],
                    deleted_at__isnull=True,
                    is_active=True
                ).first()
                
                if not supplier:
                    raise NotFoundError(f"供应商不存在或已禁用: {update_dict['supplier_id']}")
                
                update_dict['supplier_code'] = supplier.code
                update_dict['supplier_name'] = supplier.name

            # 更新字段
            for key, value in update_dict.items():
                setattr(outsource_order, key, value)

            outsource_order.updated_by = updated_by
            outsource_order.updated_by_name = user_info["name"]
            await outsource_order.save()

            logger.info(f"更新委外单成功: {outsource_order.code}")
            return OutsourceOrderResponse.model_validate(outsource_order)

    async def delete_outsource_order(
        self,
        tenant_id: int,
        outsource_order_id: int,
        deleted_by: int
    ) -> None:
        """
        删除委外单（软删除）

        Args:
            tenant_id: 组织ID
            outsource_order_id: 委外单ID
            deleted_by: 删除人ID

        Raises:
            NotFoundError: 委外单不存在
            BusinessLogicError: 委外单状态不允许删除
        """
        async with in_transaction():
            outsource_order = await OutsourceOrder.filter(
                tenant_id=tenant_id,
                id=outsource_order_id,
                deleted_at__isnull=True
            ).first()

            if not outsource_order:
                raise NotFoundError(f"委外单不存在: {outsource_order_id}")

            # 如果状态为completed或in_progress，不允许删除
            if outsource_order.status in ['completed', 'in_progress']:
                raise BusinessLogicError(f"委外单状态为 {outsource_order.status}，不允许删除")

            # 获取删除人信息
            user_info = await self.get_user_info(deleted_by)

            # 软删除
            outsource_order.deleted_at = datetime.now()
            outsource_order.updated_by = deleted_by
            outsource_order.updated_by_name = user_info["name"]
            await outsource_order.save()

            logger.info(f"删除委外单成功: {outsource_order.code}")

    async def link_purchase_receipt(
        self,
        tenant_id: int,
        outsource_order_id: int,
        purchase_receipt_id: int,
        updated_by: int
    ) -> OutsourceOrderResponse:
        """
        关联采购入库单（委外入库）

        Args:
            tenant_id: 组织ID
            outsource_order_id: 委外单ID
            purchase_receipt_id: 采购入库单ID
            updated_by: 更新人ID

        Returns:
            OutsourceOrderResponse: 更新后的委外单信息

        Raises:
            NotFoundError: 委外单或采购入库单不存在
            BusinessLogicError: 业务逻辑错误
        """
        async with in_transaction():
            outsource_order = await OutsourceOrder.filter(
                tenant_id=tenant_id,
                id=outsource_order_id,
                deleted_at__isnull=True
            ).first()

            if not outsource_order:
                raise NotFoundError(f"委外单不存在: {outsource_order_id}")

            purchase_receipt = await PurchaseReceipt.filter(
                tenant_id=tenant_id,
                id=purchase_receipt_id,
                deleted_at__isnull=True
            ).first()

            if not purchase_receipt:
                raise NotFoundError(f"采购入库单不存在: {purchase_receipt_id}")

            # 验证供应商是否匹配
            if purchase_receipt.supplier_id != outsource_order.supplier_id:
                raise BusinessLogicError(f"采购入库单的供应商({purchase_receipt.supplier_name})与委外单的供应商({outsource_order.supplier_name})不匹配")

            # 获取更新人信息
            user_info = await self.get_user_info(updated_by)

            # 关联采购入库单
            outsource_order.purchase_receipt_id = purchase_receipt_id
            outsource_order.purchase_receipt_code = purchase_receipt.receipt_code
            outsource_order.updated_by = updated_by
            outsource_order.updated_by_name = user_info["name"]
            await outsource_order.save()

            logger.info(f"委外单 {outsource_order.code} 关联采购入库单 {purchase_receipt.receipt_code} 成功")
            return OutsourceOrderResponse.model_validate(outsource_order)

