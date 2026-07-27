"""
委外工单业务服务模块

提供委外工单相关的业务逻辑处理，包括CRUD操作、状态流转等。

根据功能点2.1.10：委外工单管理（核心功能，新增）

Author: Auto (AI Assistant)
Date: 2026-01-16
"""

import uuid
from datetime import date, datetime, time
from typing import Any, Dict, List, Optional
from decimal import Decimal

from loguru import logger
from tortoise.queryset import Q
from tortoise.transactions import in_transaction

from infra.exceptions.exceptions import NotFoundError, ValidationError, BusinessLogicError
from infra.services.business_config_service import BusinessConfigService

from apps.common.base_service import AppBaseService
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
from apps.master_data.models.supplier import Supplier
from apps.kuaizhizao.utils.material_source_helper import (
    get_material_source_type,
    validate_material_source_config,
    get_material_source_config,
    SOURCE_TYPE_OUTSOURCE,
)
from apps.kuaizhizao.utils.outsource_operation_helper import (
    build_outsource_operation_label_map,
    display_outsource_operation,
    normalize_outsource_operation_value,
)
from core.utils.timezone_utils import resolve_business_datetime, today_site_str
from apps.kuaizhizao.utils.outsource_work_order_state import (
    apply_outsource_work_order_execution_start,
    apply_outsource_work_order_receipt_completion,
    outsource_work_order_has_execution_activity,
    outsource_work_order_is_fully_received,
)

OUTSOURCE_WORK_ORDER_SORTABLE_FIELDS = frozenset({
    "code",
    "name",
    "product_code",
    "product_name",
    "quantity",
    "supplier_name",
    "outsource_operation",
    "unit_price",
    "total_amount",
    "priority",
    "status",
    "planned_start_date",
    "planned_end_date",
    "issued_quantity",
    "received_quantity",
    "qualified_quantity",
    "created_at",
    "updated_at",
})


class OutsourceWorkOrderService(AppBaseService[OutsourceWorkOrder]):
    """
    委外工单服务类

    处理委外工单相关的所有业务逻辑。
    """

    async def _attach_outsource_operation_names(
        self,
        tenant_id: int,
        responses: List[OutsourceWorkOrderResponse],
    ) -> List[OutsourceWorkOrderResponse]:
        label_map = await build_outsource_operation_label_map(
            tenant_id,
            [r.outsource_operation for r in responses],
        )
        return [
            r.model_copy(
                update={
                    "outsource_operation_name": display_outsource_operation(
                        r.outsource_operation,
                        label_map,
                    )
                }
            )
            for r in responses
        ]

    async def _to_response(
        self,
        tenant_id: int,
        work_order: OutsourceWorkOrder,
    ) -> OutsourceWorkOrderResponse:
        resp = OutsourceWorkOrderResponse.model_validate(work_order)
        return (await self._attach_outsource_operation_names(tenant_id, [resp]))[0]

    def __init__(self):
        super().__init__(OutsourceWorkOrder)
        self.business_config_service = BusinessConfigService()

    async def create_outsource_work_order(
        self,
        tenant_id: int,
        work_order_data: OutsourceWorkOrderCreate,
        created_by: int,
        allow_draft: bool = False
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
        is_enabled = await self.business_config_service.check_node_enabled(tenant_id, "outsource_order")
        if not is_enabled:
            raise BusinessLogicError("委外工单节点未启用，无法创建委外工单")
        async with in_transaction():
            # 处理委外工单编码
            code = work_order_data.code
            if not code:
                # 自动生成编码（使用简单格式：OWO-日期-序号）
                today = today_site_str()
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

            # 验证物料来源配置完整性（allow_draft 时跳过，生成草稿由下游补全）
            source_config = await get_material_source_config(tenant_id, product_id)
            if not allow_draft:
                validation_passed, validation_errors = await validate_material_source_config(
                    tenant_id=tenant_id,
                    material_id=product_id,
                    source_type=SOURCE_TYPE_OUTSOURCE
                )
                if not validation_passed:
                    error_msg = f"委外件物料来源验证失败，无法创建委外工单：\n" + "\n".join(validation_errors)
                    logger.warning(f"委外工单创建失败 - {error_msg}")
                    raise ValidationError(error_msg)
                if not source_config:
                    raise ValidationError(f"物料 {material.code} 的委外配置不存在")

            # 从配置中获取委外供应商和委外工序（如果创建数据中没有提供）
            supplier_id = work_order_data.supplier_id
            supplier_code = work_order_data.supplier_code
            supplier_name = work_order_data.supplier_name
            outsource_operation = work_order_data.outsource_operation
            unit_price = work_order_data.unit_price

            # 如果创建数据中没有提供供应商信息，从配置中获取（allow_draft 时 source_config 可能为空）
            if not supplier_id and source_config:
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
            if not outsource_operation and source_config:
                outsource_operation = source_config.get("outsource_operation")

            # 如果创建数据中没有提供单价，从配置中获取
            if not unit_price and source_config:
                outsource_price = source_config.get("outsource_price")
                if outsource_price:
                    unit_price = Decimal(str(outsource_price))

            # 验证供应商信息（allow_draft 时由调用方保证已传入占位供应商）
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

            # 验证委外工序（allow_draft 时允许为空，由下游补全）
            if not allow_draft and not outsource_operation:
                raise ValidationError("委外工序不能为空，请在物料配置中设置或创建时提供")

            outsource_operation = await normalize_outsource_operation_value(
                tenant_id,
                outsource_operation,
            )

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
            
            return await self._to_response(tenant_id, outsource_work_order)

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
            if "status" in update_data:
                raise ValidationError("委外工单状态不可直接修改，请使用下达/取消/结案等操作")
            
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
            
            return await self._to_response(tenant_id, outsource_work_order)

    async def release_outsource_work_order(
        self,
        tenant_id: int,
        work_order_id: int,
        released_by: int,
    ) -> OutsourceWorkOrderResponse:
        """下达委外工单（draft → released）"""
        outsource_work_order = await OutsourceWorkOrder.filter(
            tenant_id=tenant_id,
            id=work_order_id,
            deleted_at__isnull=True,
        ).first()
        if not outsource_work_order:
            raise NotFoundError(f"委外工单ID {work_order_id} 不存在")
        if outsource_work_order.status != "draft":
            raise ValidationError("只能下达草稿状态的委外工单")

        user_info = await self.get_user_info(released_by)
        outsource_work_order.status = "released"
        outsource_work_order.updated_by = released_by
        outsource_work_order.updated_by_name = user_info["name"]
        await outsource_work_order.save()

        logger.info(f"下达委外工单成功: {outsource_work_order.code}")
        return await self._to_response(tenant_id, outsource_work_order)

    async def cancel_outsource_work_order(
        self,
        tenant_id: int,
        work_order_id: int,
        cancelled_by: int,
        reason: Optional[str] = None,
    ) -> OutsourceWorkOrderResponse:
        """取消委外工单（草稿或未发生发料/收货的已下达）。"""
        async with in_transaction():
            outsource_work_order = await OutsourceWorkOrder.filter(
                tenant_id=tenant_id,
                id=work_order_id,
                deleted_at__isnull=True,
            ).first()
            if not outsource_work_order:
                raise NotFoundError(f"委外工单ID {work_order_id} 不存在")

            from apps.kuaizhizao.services.document_action_policy.outsource_work_order import (
                assert_outsource_work_order_capability,
            )

            assert_outsource_work_order_capability(outsource_work_order, "cancel")

            status = str(outsource_work_order.status or "").strip()
            if status == "cancelled":
                raise ValidationError("委外工单已取消")
            if status == "completed":
                raise ValidationError("已完成的委外工单不能取消")
            if status == "in_progress":
                raise ValidationError("执行中的委外工单不能取消，请使用强制结案")
            if status == "released" and outsource_work_order_has_execution_activity(outsource_work_order):
                raise ValidationError("已发料或已收货的委外工单不能取消，请使用强制结案")

            user_info = await self.get_user_info(cancelled_by)
            outsource_work_order.status = "cancelled"
            if reason and str(reason).strip():
                prefix = f"[取消] {str(reason).strip()}"
                existing = (outsource_work_order.remarks or "").strip()
                outsource_work_order.remarks = f"{prefix}\n{existing}".strip() if existing else prefix
            outsource_work_order.updated_by = cancelled_by
            outsource_work_order.updated_by_name = user_info["name"]
            await outsource_work_order.save()

            logger.info(f"取消委外工单成功: {outsource_work_order.code}")
            return await self._to_response(tenant_id, outsource_work_order)

    async def close_outsource_work_order(
        self,
        tenant_id: int,
        work_order_id: int,
        closed_by: int,
        reason: str,
    ) -> OutsourceWorkOrderResponse:
        """强制结案（短收/终止执行，不再继续收货）。"""
        reason_text = (reason or "").strip()
        if not reason_text:
            raise ValidationError("强制结案须填写原因")

        async with in_transaction():
            outsource_work_order = await OutsourceWorkOrder.filter(
                tenant_id=tenant_id,
                id=work_order_id,
                deleted_at__isnull=True,
            ).first()
            if not outsource_work_order:
                raise NotFoundError(f"委外工单ID {work_order_id} 不存在")

            from apps.kuaizhizao.services.document_action_policy.outsource_work_order import (
                assert_outsource_work_order_capability,
            )

            assert_outsource_work_order_capability(outsource_work_order, "close")

            status = str(outsource_work_order.status or "").strip()
            if status in ("completed", "cancelled"):
                raise ValidationError("当前状态不可强制结案")
            if outsource_work_order_is_fully_received(outsource_work_order):
                raise ValidationError("委外数量已全部收货，无需强制结案")

            user_info = await self.get_user_info(closed_by)
            now = resolve_business_datetime()
            if status == "released":
                apply_outsource_work_order_execution_start(outsource_work_order, now=now)
            outsource_work_order.status = "completed"
            outsource_work_order.actual_end_date = now
            prefix = f"[强制结案] {reason_text}"
            existing = (outsource_work_order.remarks or "").strip()
            outsource_work_order.remarks = f"{prefix}\n{existing}".strip() if existing else prefix
            outsource_work_order.updated_by = closed_by
            outsource_work_order.updated_by_name = user_info["name"]
            await outsource_work_order.save()

            logger.info(f"强制结案委外工单成功: {outsource_work_order.code}")
            return await self._to_response(tenant_id, outsource_work_order)

    async def list_outsource_work_orders(
        self,
        tenant_id: int,
        skip: int = 0,
        limit: int = 100,
        status: Optional[str] = None,
        supplier_id: Optional[int] = None,
        product_id: Optional[int] = None,
        keyword: Optional[str] = None,
        code: Optional[str] = None,
        name: Optional[str] = None,
        product_name: Optional[str] = None,
        supplier_name: Optional[str] = None,
        priority: Optional[str] = None,
        planned_start_from: Optional[date] = None,
        planned_start_to: Optional[date] = None,
        created_start_date: Optional[date] = None,
        created_end_date: Optional[date] = None,
        order_by: Optional[str] = None,
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
        kw = (keyword or "").strip()
        if kw:
            query &= (
                Q(code__icontains=kw)
                | Q(name__icontains=kw)
                | Q(product_name__icontains=kw)
                | Q(supplier_name__icontains=kw)
            )
        c = (code or "").strip()
        if c:
            query &= Q(code__icontains=c)
        n = (name or "").strip()
        if n:
            query &= Q(name__icontains=n)
        pn = (product_name or "").strip()
        if pn:
            query &= Q(product_name__icontains=pn)
        sn = (supplier_name or "").strip()
        if sn:
            query &= Q(supplier_name__icontains=sn)
        if priority:
            query &= Q(priority=priority)
        if planned_start_from is not None:
            query &= Q(planned_start_date__gte=planned_start_from)
        if planned_start_to is not None:
            query &= Q(planned_start_date__lte=planned_start_to)
        if created_start_date is not None:
            query &= Q(created_at__gte=datetime.combine(created_start_date, time.min))
        if created_end_date is not None:
            query &= Q(created_at__lte=datetime.combine(created_end_date, time.max))

        total = await OutsourceWorkOrder.filter(query).count()
        order_clause = order_by if order_by else "-created_at"
        work_orders = await OutsourceWorkOrder.filter(query).order_by(order_clause).offset(skip).limit(limit).all()

        from apps.kuaizhizao.services.document_action_policy.enricher import (
            enrich_outsource_work_order_list_capabilities,
        )

        responses = [OutsourceWorkOrderResponse.model_validate(wo) for wo in work_orders]
        responses = await self._attach_outsource_operation_names(tenant_id, responses)
        enriched = enrich_outsource_work_order_list_capabilities(work_orders, responses)

        return OutsourceWorkOrderListResponse(
            data=enriched,
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

        resp = await self._to_response(tenant_id, work_order)
        from apps.kuaizhizao.services.document_action_policy.enricher import (
            enrich_outsource_work_order_list_capabilities,
        )

        enriched = enrich_outsource_work_order_list_capabilities([work_order], [resp])
        return enriched[0]

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

        status = str(work_order.status or "").strip()
        if status not in ("draft", "cancelled"):
            raise BusinessLogicError("仅草稿或已取消的委外工单可删除")
        if status == "cancelled" and outsource_work_order_has_execution_activity(work_order):
            raise BusinessLogicError("已发生发料或收货的委外工单不能删除")

        # 软删除
        from datetime import datetime
        work_order.deleted_at = resolve_business_datetime()
        await work_order.save()

        logger.info(f"删除委外工单成功: {work_order.code}")
