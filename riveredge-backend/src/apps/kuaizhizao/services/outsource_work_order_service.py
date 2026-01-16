"""
委外工单业务服务模块

提供委外工单相关的业务逻辑处理，包括CRUD操作、状态流转等。

根据功能点2.1.10：委外工单管理（核心功能，新增）

Author: Auto (AI Assistant)
Date: 2026-01-16
"""

import uuid
from datetime import datetime
from typing import List, Optional
from decimal import Decimal

from tortoise.queryset import Q
from tortoise.transactions import in_transaction

from infra.exceptions.exceptions import NotFoundError, ValidationError, BusinessLogicError

from apps.base_service import AppBaseService
from apps.kuaizhizao.models.outsource_work_order import (
    OutsourceWorkOrder,
    OutsourceMaterialIssue,
    OutsourceMaterialReceipt,
)
from apps.kuaizhizao.schemas.outsource_work_order import (
    OutsourceWorkOrderCreate,
    OutsourceWorkOrderUpdate,
    OutsourceWorkOrderResponse,
    OutsourceWorkOrderListResponse,
    OutsourceMaterialIssueCreate,
    OutsourceMaterialIssueUpdate,
    OutsourceMaterialIssueResponse,
    OutsourceMaterialReceiptCreate,
    OutsourceMaterialReceiptUpdate,
    OutsourceMaterialReceiptResponse,
)
from apps.master_data.models.material import Material
from apps.master_data.models.supply_chain import Supplier
from apps.kuaizhizao.utils.material_source_helper import (
    get_material_source_type,
    validate_material_source_config,
    get_material_source_config,
    SOURCE_TYPE_OUTSOURCE,
)
from core.services.business.code_generation_service import CodeGenerationService
from loguru import logger


class OutsourceWorkOrderService(AppBaseService[OutsourceWorkOrder]):
    """
    委外工单服务类

    处理委外工单相关的所有业务逻辑。
    """

    def __init__(self):
        super().__init__(OutsourceWorkOrder)

    async def create_outsource_work_order(
        self,
        tenant_id: int,
        work_order_data: OutsourceWorkOrderCreate,
        created_by: int
    ) -> OutsourceWorkOrderResponse:
        """
        创建委外工单

        Args:
            tenant_id: 组织ID
            work_order_data: 委外工单创建数据
            created_by: 创建人ID

        Returns:
            OutsourceWorkOrderResponse: 创建的委外工单信息

        Raises:
            ValidationError: 数据验证失败
        """
        async with in_transaction():
            # 处理委外工单编码
            code = work_order_data.code
            if not code:
                # 自动生成编码（使用简单格式：OWO-日期-序号）
                today = datetime.now().strftime("%Y%m%d")
                # 查找当天最大的序号
                existing_codes = await OutsourceWorkOrder.filter(
                    tenant_id=tenant_id,
                    code__startswith=f"OWO-{today}",
                    deleted_at__isnull=True
                ).order_by("-code").limit(1).values_list("code", flat=True)
                
                if existing_codes:
                    last_code = existing_codes[0]
                    last_seq = int(last_code.split("-")[-1]) if last_code.split("-")[-1].isdigit() else 0
                    seq = last_seq + 1
                else:
                    seq = 1
                
                code = f"OWO-{today}-{seq:04d}"
            else:
                # 验证编码唯一性
                existing = await OutsourceWorkOrder.filter(
                    tenant_id=tenant_id,
                    code=code,
                    deleted_at__isnull=True
                ).first()
                
                if existing:
                    raise ValidationError(f"委外工单编码 {code} 已存在")

            # 获取创建人信息
            user_info = await self.get_user_info(created_by)

            # 验证物料信息
            product_id = work_order_data.product_id
            material = await Material.filter(
                tenant_id=tenant_id,
                id=product_id,
                deleted_at__isnull=True
            ).first()
            
            if not material:
                raise ValidationError(f"物料ID {product_id} 不存在")
            
            if not material.is_active:
                raise ValidationError(f"物料ID {product_id} 已停用")

            # 验证物料来源类型必须是Outsource
            source_type = await get_material_source_type(tenant_id, product_id)
            if source_type != SOURCE_TYPE_OUTSOURCE:
                raise ValidationError(
                    f"物料 {material.code} ({material.name}) 的来源类型不是委外件（Outsource），"
                    f"当前类型：{source_type}，无法创建委外工单"
                )

            # 验证物料来源配置完整性
            validation_passed, validation_errors = await validate_material_source_config(
                tenant_id=tenant_id,
                material_id=product_id,
                source_type=SOURCE_TYPE_OUTSOURCE
            )
            
            if not validation_passed:
                error_msg = f"委外件物料来源验证失败，无法创建委外工单：\n" + "\n".join(validation_errors)
                logger.warning(f"委外工单创建失败 - {error_msg}")
                raise ValidationError(error_msg)

            # 获取物料来源配置
            source_config = await get_material_source_config(tenant_id, product_id)
            if not source_config:
                raise ValidationError(f"物料 {material.code} 的委外配置不存在")

            # 从配置中获取委外供应商和委外工序（如果创建数据中没有提供）
            supplier_id = work_order_data.supplier_id
            supplier_code = work_order_data.supplier_code
            supplier_name = work_order_data.supplier_name
            outsource_operation = work_order_data.outsource_operation
            unit_price = work_order_data.unit_price

            # 如果创建数据中没有提供供应商信息，从配置中获取
            if not supplier_id:
                supplier_id = source_config.get("outsource_supplier_id")
                if supplier_id:
                    supplier = await Supplier.filter(
                        tenant_id=tenant_id,
                        id=supplier_id,
                        deleted_at__isnull=True
                    ).first()
                    if supplier:
                        supplier_code = supplier.code
                        supplier_name = supplier.name

            # 如果创建数据中没有提供委外工序，从配置中获取
            if not outsource_operation:
                outsource_operation = source_config.get("outsource_operation")

            # 如果创建数据中没有提供单价，从配置中获取
            if not unit_price:
                outsource_price = source_config.get("outsource_price")
                if outsource_price:
                    unit_price = Decimal(str(outsource_price))

            # 验证供应商信息
            if not supplier_id:
                raise ValidationError("委外供应商ID不能为空，请在物料配置中设置或创建时提供")
            
            supplier = await Supplier.filter(
                tenant_id=tenant_id,
                id=supplier_id,
                deleted_at__isnull=True
            ).first()
            
            if not supplier:
                raise ValidationError(f"委外供应商ID {supplier_id} 不存在")
            
            if not supplier_code:
                supplier_code = supplier.code
            if not supplier_name:
                supplier_name = supplier.name

            # 验证委外工序
            if not outsource_operation:
                raise ValidationError("委外工序不能为空，请在物料配置中设置或创建时提供")

            # 计算总金额
            total_amount = Decimal("0")
            if unit_price:
                total_amount = Decimal(str(work_order_data.quantity)) * Decimal(str(unit_price))

            # 创建委外工单
            outsource_work_order = await OutsourceWorkOrder.create(
                tenant_id=tenant_id,
                uuid=str(uuid.uuid4()),
                code=code,
                name=work_order_data.name,
                product_id=product_id,
                product_code=work_order_data.product_code or material.code,
                product_name=work_order_data.product_name or material.name,
                quantity=work_order_data.quantity,
                supplier_id=supplier_id,
                supplier_code=supplier_code,
                supplier_name=supplier_name,
                outsource_operation=outsource_operation,
                unit_price=unit_price,
                total_amount=total_amount,
                status=work_order_data.status,
                priority=work_order_data.priority,
                planned_start_date=work_order_data.planned_start_date,
                planned_end_date=work_order_data.planned_end_date,
                remarks=work_order_data.remarks,
                created_by=created_by,
                created_by_name=user_info["name"],
            )

            logger.info(f"创建委外工单成功: {code} - {material.name} ({supplier_name})")
            
            return OutsourceWorkOrderResponse.model_validate(outsource_work_order)

    async def update_outsource_work_order(
        self,
        tenant_id: int,
        work_order_id: int,
        work_order_data: OutsourceWorkOrderUpdate,
        updated_by: int
    ) -> OutsourceWorkOrderResponse:
        """
        更新委外工单

        Args:
            tenant_id: 组织ID
            work_order_id: 委外工单ID
            work_order_data: 委外工单更新数据
            updated_by: 更新人ID

        Returns:
            OutsourceWorkOrderResponse: 更新后的委外工单信息

        Raises:
            NotFoundError: 委外工单不存在
            ValidationError: 数据验证失败
        """
        async with in_transaction():
            # 获取委外工单
            outsource_work_order = await OutsourceWorkOrder.filter(
                tenant_id=tenant_id,
                id=work_order_id,
                deleted_at__isnull=True
            ).first()

            if not outsource_work_order:
                raise NotFoundError(f"委外工单ID {work_order_id} 不存在")

            # 获取更新人信息
            user_info = await self.get_user_info(updated_by)

            # 更新字段
            update_data = work_order_data.model_dump(exclude_unset=True)
            
            # 如果更新了数量或单价，重新计算总金额
            if "quantity" in update_data or "unit_price" in update_data:
                quantity = Decimal(str(update_data.get("quantity", outsource_work_order.quantity)))
                unit_price = update_data.get("unit_price", outsource_work_order.unit_price)
                if unit_price:
                    update_data["total_amount"] = quantity * Decimal(str(unit_price))
                else:
                    update_data["total_amount"] = Decimal("0")

            # 更新字段
            for key, value in update_data.items():
                if hasattr(outsource_work_order, key):
                    setattr(outsource_work_order, key, value)

            outsource_work_order.updated_by = updated_by
            outsource_work_order.updated_by_name = user_info["name"]
            await outsource_work_order.save()

            logger.info(f"更新委外工单成功: {outsource_work_order.code}")
            
            return OutsourceWorkOrderResponse.model_validate(outsource_work_order)

    async def list_outsource_work_orders(
        self,
        tenant_id: int,
        skip: int = 0,
        limit: int = 100,
        status: Optional[str] = None,
        supplier_id: Optional[int] = None,
        product_id: Optional[int] = None,
        keyword: Optional[str] = None,
    ) -> OutsourceWorkOrderListResponse:
        """
        获取委外工单列表

        Args:
            tenant_id: 组织ID
            skip: 跳过数量
            limit: 限制数量
            status: 状态筛选
            supplier_id: 供应商ID筛选
            product_id: 产品ID筛选
            keyword: 关键词搜索（编码、名称）

        Returns:
            OutsourceWorkOrderListResponse: 委外工单列表
        """
        query = Q(tenant_id=tenant_id, deleted_at__isnull=True)

        if status:
            query &= Q(status=status)
        if supplier_id:
            query &= Q(supplier_id=supplier_id)
        if product_id:
            query &= Q(product_id=product_id)
        if keyword:
            query &= (Q(code__icontains=keyword) | Q(name__icontains=keyword) | 
                     Q(product_name__icontains=keyword) | Q(supplier_name__icontains=keyword))

        total = await OutsourceWorkOrder.filter(query).count()
        work_orders = await OutsourceWorkOrder.filter(query).order_by("-created_at").offset(skip).limit(limit).all()

        return OutsourceWorkOrderListResponse(
            data=[OutsourceWorkOrderResponse.model_validate(wo) for wo in work_orders],
            total=total,
            success=True
        )

    async def get_outsource_work_order(
        self,
        tenant_id: int,
        work_order_id: int
    ) -> OutsourceWorkOrderResponse:
        """
        获取委外工单详情

        Args:
            tenant_id: 组织ID
            work_order_id: 委外工单ID

        Returns:
            OutsourceWorkOrderResponse: 委外工单信息

        Raises:
            NotFoundError: 委外工单不存在
        """
        work_order = await OutsourceWorkOrder.filter(
            tenant_id=tenant_id,
            id=work_order_id,
            deleted_at__isnull=True
        ).first()

        if not work_order:
            raise NotFoundError(f"委外工单ID {work_order_id} 不存在")

        return OutsourceWorkOrderResponse.model_validate(work_order)

    async def delete_outsource_work_order(
        self,
        tenant_id: int,
        work_order_id: int,
        deleted_by: int
    ) -> None:
        """
        删除委外工单（软删除）

        Args:
            tenant_id: 组织ID
            work_order_id: 委外工单ID
            deleted_by: 删除人ID

        Raises:
            NotFoundError: 委外工单不存在
            BusinessLogicError: 委外工单状态不允许删除
        """
        work_order = await OutsourceWorkOrder.filter(
            tenant_id=tenant_id,
            id=work_order_id,
            deleted_at__isnull=True
        ).first()

        if not work_order:
            raise NotFoundError(f"委外工单ID {work_order_id} 不存在")

        # 检查状态，已完成的委外工单不能删除
        if work_order.status == "completed":
            raise BusinessLogicError("已完成的委外工单不能删除")

        # 软删除
        from datetime import datetime
        work_order.deleted_at = datetime.now()
        await work_order.save()

        logger.info(f"删除委外工单成功: {work_order.code}")
