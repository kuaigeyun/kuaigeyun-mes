"""
委外单业务服务模块

提供委外单相关的业务逻辑处理，包括CRUD操作、状态流转、委外入库关联等。

Author: Luigi Lu
Date: 2025-01-04
"""

import uuid
from datetime import date, datetime, time
from typing import Any, Dict, List, Optional
from decimal import Decimal
from collections import defaultdict

from tortoise.queryset import Q
from tortoise.transactions import in_transaction

from infra.exceptions.exceptions import NotFoundError, ValidationError, BusinessLogicError

from apps.common.base_service import AppBaseService
from apps.kuaizhizao.models.outsource_order import OutsourceOrder
from apps.kuaizhizao.models.work_order import WorkOrder
from apps.kuaizhizao.models.work_order_operation import WorkOrderOperation
from apps.kuaizhizao.models.purchase_receipt import PurchaseReceipt
from apps.kuaizhizao.schemas.outsource_order import (
    OutsourceOrderCreate,
    OutsourceOrderUpdate,
    OutsourceOrderResponse,
    OutsourceOrderListResponse,
    OutsourceOptionResponse,
)
from apps.master_data.models.supplier import Supplier
from apps.kuaizhizao.services.over_report_rules import (
    max_completed_quantity_for_plan,
    tuple_from_model,
)
from loguru import logger
from core.utils.timezone_utils import resolve_business_datetime, today_site_str

OUTSOURCE_ORDER_SORTABLE_FIELDS = frozenset({
    "code",
    "work_order_code",
    "operation_name",
    "supplier_name",
    "outsource_quantity",
    "received_quantity",
    "qualified_quantity",
    "unit_price",
    "total_amount",
    "status",
    "planned_start_date",
    "planned_end_date",
    "created_at",
    "updated_at",
})


class OutsourceService(AppBaseService[OutsourceOrder]):
    """
    委外单服务类

    处理委外单相关的所有业务逻辑。
    """

    def __init__(self):
        super().__init__(OutsourceOrder)

    def _compute_outsourceable_breakdown(
        self,
        work_order: WorkOrder,
        work_order_operation: WorkOrderOperation,
        already_outsourced: Decimal,
    ) -> Dict[str, Decimal]:
        plan_qty = work_order.quantity or Decimal("0")
        om, ov = tuple_from_model(work_order_operation)
        max_quantity = max_completed_quantity_for_plan(plan_qty, om, ov)
        completed_quantity = work_order_operation.completed_quantity or Decimal("0")
        outsourceable_quantity = max_quantity - completed_quantity - already_outsourced
        if outsourceable_quantity < 0:
            outsourceable_quantity = Decimal("0")
        return {
            "max_quantity": max_quantity,
            "completed_quantity": completed_quantity,
            "already_outsourced_quantity": already_outsourced,
            "outsourceable_quantity": outsourceable_quantity,
        }

    async def list_outsource_options(
        self,
        tenant_id: int,
        work_order_id: int,
    ) -> List[OutsourceOptionResponse]:
        work_order = await WorkOrder.filter(
            tenant_id=tenant_id,
            id=work_order_id,
            deleted_at__isnull=True,
        ).first()
        if not work_order:
            raise NotFoundError(f"工单不存在: {work_order_id}")

        operations = await WorkOrderOperation.filter(
            tenant_id=tenant_id,
            work_order_id=work_order_id,
            deleted_at__isnull=True,
        ).order_by("sequence").all()

        existing_outsource_rows = await OutsourceOrder.filter(
            tenant_id=tenant_id,
            work_order_id=work_order_id,
            deleted_at__isnull=True,
        ).exclude(status="cancelled").values_list("work_order_operation_id", "outsource_quantity")

        outsourced_by_op: Dict[int, Decimal] = defaultdict(lambda: Decimal("0"))
        for op_id, qty in existing_outsource_rows:
            outsourced_by_op[int(op_id)] += Decimal(str(qty or 0))

        options: List[OutsourceOptionResponse] = []
        for operation in operations:
            breakdown = self._compute_outsourceable_breakdown(
                work_order,
                operation,
                outsourced_by_op.get(operation.id, Decimal("0")),
            )
            options.append(
                OutsourceOptionResponse(
                    work_order_operation_id=operation.id,
                    operation_id=operation.operation_id,
                    operation_code=operation.operation_code,
                    operation_name=operation.operation_name,
                    sequence=operation.sequence,
                    **breakdown,
                )
            )
        return options

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

            if outsource_order_data.outsource_quantity <= 0:
                raise ValidationError("委外数量必须大于 0")

            existing_outsource_rows = await OutsourceOrder.filter(
                tenant_id=tenant_id,
                work_order_operation_id=outsource_order_data.work_order_operation_id,
                deleted_at__isnull=True,
            ).exclude(status="cancelled").values_list("outsource_quantity", flat=True)
            already_outsourced = sum(
                (Decimal(str(q)) for q in existing_outsource_rows),
                Decimal("0"),
            )
            breakdown = self._compute_outsourceable_breakdown(
                work_order,
                work_order_operation,
                already_outsourced,
            )
            outsourceable_quantity = breakdown["outsourceable_quantity"]

            if outsource_order_data.outsource_quantity > outsourceable_quantity:
                raise ValidationError(
                    f"委外数量({outsource_order_data.outsource_quantity})不能超过可委外数量({outsourceable_quantity})"
                )

            # 生成委外单编码（如果未提供）
            if not outsource_order_data.code:
                today = today_site_str()
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

            await self._apply_outsource_to_work_order_operation(
                work_order_operation,
                outsource_order=outsource_order,
                remarks=outsource_order_data.remarks,
            )

            logger.info(f"创建委外单成功: {code}, 工单: {work_order.code}, 工序: {outsource_order_data.operation_name}")
            return OutsourceOrderResponse.model_validate(outsource_order)

    async def _apply_outsource_to_work_order_operation(
        self,
        work_order_operation: WorkOrderOperation,
        *,
        outsource_order: OutsourceOrder,
        remarks: Optional[str] = None,
    ) -> None:
        """创建委外单后：落章委外类型、清空本厂派工、同步计划窗。"""
        from apps.kuaizhizao.utils.outsource_operation import (
            OUTSOURCE_KIND_AD_HOC,
            OUTSOURCE_KIND_NONE,
            OUTSOURCE_KIND_PLANNED,
            normalize_outsource_kind,
        )

        kind = normalize_outsource_kind(getattr(work_order_operation, "outsource_kind", None))
        # 下达自动创建的计划委外保持 planned；其余视为临时委外
        auto_planned = bool(remarks and "计划工序委外" in str(remarks))
        if kind == OUTSOURCE_KIND_NONE and not auto_planned:
            work_order_operation.outsource_kind = OUTSOURCE_KIND_AD_HOC
        elif kind == OUTSOURCE_KIND_NONE and auto_planned:
            work_order_operation.outsource_kind = OUTSOURCE_KIND_PLANNED

        work_order_operation.assigned_station_id = None
        work_order_operation.assigned_station_name = None
        work_order_operation.assigned_worker_id = None
        work_order_operation.assigned_worker_name = None
        work_order_operation.assigned_team_id = None
        work_order_operation.assigned_team_name = None
        work_order_operation.assigned_equipment_id = None
        work_order_operation.assigned_equipment_name = None
        work_order_operation.assigned_mold_id = None
        work_order_operation.assigned_mold_name = None
        work_order_operation.assigned_tool_id = None
        work_order_operation.assigned_tool_name = None

        if outsource_order.planned_start_date:
            work_order_operation.planned_start_date = outsource_order.planned_start_date
        if outsource_order.planned_end_date:
            work_order_operation.planned_end_date = outsource_order.planned_end_date
        if not work_order_operation.default_outsource_supplier_id and outsource_order.supplier_id:
            work_order_operation.default_outsource_supplier_id = outsource_order.supplier_id
            work_order_operation.default_outsource_supplier_name = outsource_order.supplier_name

        await work_order_operation.save()

    async def _restore_work_order_operation_after_outsource_cancel(
        self,
        tenant_id: int,
        work_order_operation_id: int,
    ) -> None:
        """取消委外单后：若无其它有效委外单则恢复工序委外状态。"""
        from apps.kuaizhizao.utils.outsource_operation import (
            OUTSOURCE_KIND_AD_HOC,
            OUTSOURCE_KIND_NONE,
            OUTSOURCE_KIND_PLANNED,
            normalize_outsource_kind,
        )

        op = await WorkOrderOperation.filter(
            tenant_id=tenant_id,
            id=work_order_operation_id,
            deleted_at__isnull=True,
        ).first()
        if not op:
            return
        still_active = await OutsourceOrder.filter(
            tenant_id=tenant_id,
            work_order_operation_id=work_order_operation_id,
            deleted_at__isnull=True,
        ).exclude(status="cancelled").exists()
        if still_active:
            return
        kind = normalize_outsource_kind(getattr(op, "outsource_kind", None))
        if kind == OUTSOURCE_KIND_AD_HOC:
            # 临时委外取消：若仍有提前期+默认供应商（曾是计划）则恢复 planned
            if op.outsource_lead_time_days is not None and op.default_outsource_supplier_id:
                op.outsource_kind = OUTSOURCE_KIND_PLANNED
            else:
                op.outsource_kind = OUTSOURCE_KIND_NONE
            await op.save(update_fields=["outsource_kind", "updated_at"])
        elif kind == OUTSOURCE_KIND_PLANNED:
            # 计划委外单取消后仍保持 planned（可再次下达补建草稿）
            pass

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
        code: Optional[str] = None,
        work_order_code: Optional[str] = None,
        operation_name: Optional[str] = None,
        supplier_name: Optional[str] = None,
        keyword: Optional[str] = None,
        planned_start_from: Optional[date] = None,
        planned_start_to: Optional[date] = None,
        created_start_date: Optional[date] = None,
        created_end_date: Optional[date] = None,
        order_by: Optional[str] = None,
    ) -> Dict[str, Any]:
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
        c = (code or "").strip()
        if c:
            query = query.filter(code__icontains=c)
        kw = (keyword or "").strip()
        if kw:
            query = query.filter(
                Q(code__icontains=kw)
                | Q(work_order_code__icontains=kw)
                | Q(operation_name__icontains=kw)
                | Q(supplier_name__icontains=kw)
            )
        woc = (work_order_code or "").strip()
        if woc:
            query = query.filter(work_order_code__icontains=woc)
        on = (operation_name or "").strip()
        if on:
            query = query.filter(operation_name__icontains=on)
        sn = (supplier_name or "").strip()
        if sn:
            query = query.filter(supplier_name__icontains=sn)
        if planned_start_from is not None:
            query = query.filter(planned_start_date__gte=planned_start_from)
        if planned_start_to is not None:
            query = query.filter(planned_start_date__lte=planned_start_to)
        if created_start_date is not None:
            query = query.filter(created_at__gte=datetime.combine(created_start_date, time.min))
        if created_end_date is not None:
            query = query.filter(created_at__lte=datetime.combine(created_end_date, time.max))

        total = await query.count()
        order_clause = order_by if order_by else "-created_at"
        outsource_orders = await query.offset(skip).limit(limit).order_by(order_clause).all()

        return {
            "data": [OutsourceOrderListResponse.model_validate(os).model_dump() for os in outsource_orders],
            "total": total,
            "success": True,
        }

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

            prev_status = outsource_order.status
            # 更新字段
            for key, value in update_dict.items():
                setattr(outsource_order, key, value)

            outsource_order.updated_by = updated_by
            outsource_order.updated_by_name = user_info["name"]
            await outsource_order.save()

            if (
                update_dict.get("status") == "cancelled"
                and prev_status != "cancelled"
                and outsource_order.work_order_operation_id
            ):
                await self._restore_work_order_operation_after_outsource_cancel(
                    tenant_id,
                    int(outsource_order.work_order_operation_id),
                )

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
            outsource_order.deleted_at = resolve_business_datetime()
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

