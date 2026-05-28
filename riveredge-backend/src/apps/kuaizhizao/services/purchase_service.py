"""
采购订单服务

提供采购订单相关的业务逻辑处理。

Author: Luigi Lu
Date: 2025-12-30
"""

import json
from datetime import datetime
from typing import List, Optional, Dict, Any
from decimal import Decimal

from tortoise.transactions import in_transaction
from tortoise.expressions import Q

from apps.common.base_service import AppBaseService
from infra.exceptions.exceptions import NotFoundError, ValidationError, BusinessLogicError
from infra.models.user import User as CurrentUser
from loguru import logger

from apps.kuaizhizao.models.purchase_order import PurchaseOrder, PurchaseOrderItem, PurchaseOrderChange
from apps.master_data.models.supplier import Supplier
from apps.master_data.models.material import Material
from apps.kuaizhizao.schemas.purchase import (
    PurchaseOrderCreate, PurchaseOrderUpdate, PurchaseOrderResponse,
    PurchaseOrderListResponse, PurchaseOrderItemResponse,
    PurchaseOrderApprove, PurchaseOrderConfirm, PurchaseOrderListParams,
    MaterialPriceHistoryResponse, MaterialPriceHistoryItem,
    PurchaseTrackingResponse, PurchaseTrackingNode,
    ExpediteResponse,
    PriceComparisonResponse, MaterialPriceComparison, PriceComparisonItem
)
from apps.kuaizhizao.constants import DocumentStatus, ReviewStatus, LEGACY_AUDITED_VALUES, is_draft_status
from infra.services.business_config_service import BusinessConfigService


class PurchaseService(AppBaseService[PurchaseOrder]):
    """采购订单服务类"""

    def __init__(self):
        super().__init__(PurchaseOrder)

    @staticmethod
    def _extract_material_purchase_benchmark_price(material: Material) -> Optional[Decimal]:
        """
        从物料默认值中提取采购基准价，用于采购价格偏差风控。
        优先级：defaults.purchase.standard_price -> defaults.purchase.purchase_price -> source_config.purchase_price。
        """
        def _to_decimal(v: Any) -> Optional[Decimal]:
            if v is None or v == "":
                return None
            try:
                d = Decimal(str(v))
            except Exception:
                return None
            if d <= 0:
                return None
            return d

        defaults = getattr(material, "defaults", None)
        if isinstance(defaults, dict):
            purchase_defaults = defaults.get("purchase") if isinstance(defaults.get("purchase"), dict) else {}
            for key in ("standard_price", "purchase_price"):
                d = _to_decimal(purchase_defaults.get(key))
                if d is not None:
                    return d

        source_cfg = getattr(material, "source_config", None)
        if isinstance(source_cfg, dict):
            d = _to_decimal(source_cfg.get("purchase_price"))
            if d is not None:
                return d
        return None

    @staticmethod
    def _validate_purchase_price_fluctuation_for_material(
        *,
        material: Material,
        unit_price: Decimal,
        fluctuation_limit_percent: float,
    ) -> None:
        """
        P3-P-004: 采购价格风控（最小闭环）。
        当阈值>0 且物料存在采购基准价时，若偏差超阈值则阻断下单/改单。
        """
        if fluctuation_limit_percent <= 0:
            return

        benchmark_price = PurchaseService._extract_material_purchase_benchmark_price(material)
        if benchmark_price is None or benchmark_price <= 0:
            return

        current_price = Decimal(str(unit_price or 0))
        deviation_pct = (abs(current_price - benchmark_price) / benchmark_price) * Decimal("100")
        if deviation_pct > Decimal(str(fluctuation_limit_percent)):
            material_label = getattr(material, "main_code", None) or getattr(material, "code", None) or str(material.id)
            raise BusinessLogicError(
                f"物料 {material_label} 采购单价偏差 {deviation_pct:.2f}% 超过阈值 "
                f"{Decimal(str(fluctuation_limit_percent)):.2f}%（基准价={benchmark_price}，当前={current_price}）"
            )

    async def create_purchase_order(
        self,
        tenant_id: int,
        order_data: PurchaseOrderCreate,
        created_by: int
    ) -> PurchaseOrderResponse:
        """
        创建采购订单

        Args:
            tenant_id: 租户ID
            order_data: 订单数据
            created_by: 创建人ID

        Returns:
            PurchaseOrderResponse: 创建的订单信息
        """
        async with in_transaction():
            # 生成订单编码
            if not order_data.order_code:
                today = datetime.now().strftime("%Y%m%d")
                order_data.order_code = await self.generate_code(tenant_id, "PURCHASE_ORDER_CODE", prefix=f"PO{today}")

            # 验证供应商（允许草稿订单临时无供应商：supplier_id<=0）
            supplier = None
            if int(order_data.supplier_id or 0) > 0:
                supplier = await Supplier.get_or_none(tenant_id=tenant_id, id=order_data.supplier_id)
                if not supplier:
                    raise NotFoundError(f"供应商不存在: {order_data.supplier_id}")
            else:
                if (order_data.status or DocumentStatus.DRAFT.value) != DocumentStatus.DRAFT.value:
                    raise ValidationError("非草稿订单必须指定有效供应商")
                if not order_data.supplier_name:
                    order_data.supplier_name = "待定供应商"

            # 流程设置强执行：必须先有采购申请才可下采购单
            config_service = BusinessConfigService()
            biz_config = await config_service.get_business_config(tenant_id)
            purchase_price_fluctuation_limit = await config_service.get_purchase_price_fluctuation_limit_percent(tenant_id)
            require_purchase_requisition = (
                biz_config.get("parameters", {})
                .get("procurement", {})
                .get("require_purchase_requisition", False)
            )
            if require_purchase_requisition:
                source_type = (order_data.source_type or "").strip().lower()
                source_id = order_data.source_id
                if source_type in {"purchase_request", "purchase_requisition"} and source_id:
                    pass
                else:
                    # 兼容按明细挂接采购申请的场景
                    all_items_have_source = all(
                        bool(item.source_id) and (item.source_type or "").strip().lower() in {"purchase_request", "purchase_requisition"}
                        for item in order_data.items
                    )
                    if not all_items_have_source:
                        raise BusinessLogicError("当前组织要求先采购申请后下单，请先关联采购申请单")

            # 创建订单头
            order_dict = order_data.model_dump(exclude={'items'})
            order_dict.update({
                'tenant_id': tenant_id,
                'created_by': created_by,
                'updated_by': created_by
            })

            # 自动带出归属采购员
            if not order_dict.get("buyer_id") and order_dict.get("supplier_id"):
                if supplier and supplier.buyer_id:
                    order_dict["buyer_id"] = supplier.buyer_id
                    order_dict["buyer_name"] = supplier.buyer_name

            order = await PurchaseOrder.create(**order_dict)

            # 创建订单明细
            total_quantity = Decimal(0)
            total_amount = Decimal(0)

            for item_data in order_data.items:
                # 验证物料
                material = await Material.get_or_none(tenant_id=tenant_id, id=item_data.material_id)
                if not material:
                    raise NotFoundError(f"物料不存在: {item_data.material_id}")
                self._validate_purchase_price_fluctuation_for_material(
                    material=material,
                    unit_price=item_data.unit_price,
                    fluctuation_limit_percent=purchase_price_fluctuation_limit,
                )

                # 计算总价
                total_price = item_data.ordered_quantity * item_data.unit_price
                outstanding_quantity = item_data.ordered_quantity

                item_dict = item_data.model_dump()
                item_dict.update({
                    'tenant_id': tenant_id,
                    'order_id': order.id,
                    'total_price': total_price,
                    'outstanding_quantity': outstanding_quantity,
                    'created_by': created_by,
                    'updated_by': created_by
                })

                await PurchaseOrderItem.create(**item_dict)

                total_quantity += item_data.ordered_quantity
                total_amount += total_price

            # 更新订单头金额信息
            tax_amount = total_amount * order_data.tax_rate
            net_amount = total_amount + tax_amount

            await order.update_from_dict({
                'total_quantity': total_quantity,
                'total_amount': total_amount,
                'tax_amount': tax_amount,
                'net_amount': net_amount,
                'updated_by': created_by
            }).save()

            return await self.get_purchase_order_by_id(tenant_id, order.id)

    async def get_purchase_order_by_id(self, tenant_id: int, order_id: int) -> PurchaseOrderResponse:
        """
        根据ID获取采购订单详情

        Args:
            tenant_id: 租户ID
            order_id: 订单ID

        Returns:
            PurchaseOrderResponse: 订单详情
        """
        order = await PurchaseOrder.get_or_none(tenant_id=tenant_id, id=order_id)
        if not order:
            raise NotFoundError(f"采购订单不存在: {order_id}")

        # 获取订单明细
        items = await PurchaseOrderItem.filter(tenant_id=tenant_id, order_id=order_id).all()
        
        # 使用model_validate，但需要手动处理items字段（因为order.items是ReverseRelation）
        # 先获取订单的所有字段，排除items
        order_data = order.__dict__.copy()
        # 移除items键（如果存在），因为它是ReverseRelation对象
        order_data.pop('items', None)
        
        # 使用model_construct构建响应对象
        response = PurchaseOrderResponse.model_construct(**order_data)
        # 手动设置items
        response.items = [PurchaseOrderItemResponse.model_validate(item) for item in items]
        # 生命周期
        from apps.kuaizhizao.services.document_lifecycle_service import get_purchase_order_lifecycle, get_document_milestones
        milestones = await get_document_milestones(order.tenant_id, "purchase_order", order.id)
        response.lifecycle = get_purchase_order_lifecycle(order, milestones=milestones)
        return response

    async def list_purchase_orders(
        self,
        tenant_id: int,
        params: PurchaseOrderListParams,
        current_user: Optional[CurrentUser] = None
    ) -> Dict[str, Any]:
        """
        获取采购订单列表

        Args:
            tenant_id: 租户ID
            params: 查询参数

        Returns:
            List[PurchaseOrderListResponse]: 订单列表
        """
        query = PurchaseOrder.filter(tenant_id=tenant_id)

        # 采购员数据隔离：普通用户只能看到自己负责的订单
        if current_user and current_user.is_regular_user():
            query = query.filter(buyer_id=current_user.id)

        # 应用筛选条件
        if params.supplier_id:
            query = query.filter(supplier_id=params.supplier_id)
        if params.status:
            query = query.filter(status=params.status)
        if params.review_status:
            query = query.filter(review_status=params.review_status)
        if params.order_date_from:
            query = query.filter(order_date__gte=params.order_date_from)
        if params.order_date_to:
            query = query.filter(order_date__lte=params.order_date_to)
        if params.delivery_date_from:
            query = query.filter(delivery_date__gte=params.delivery_date_from)
        if params.delivery_date_to:
            query = query.filter(delivery_date__lte=params.delivery_date_to)
        if params.keyword:
            keyword = params.keyword
            # 使用icontains进行模糊搜索，多个条件使用OR逻辑
            from tortoise.expressions import Q
            query = query.filter(
                Q(order_code__icontains=keyword) |
                Q(supplier_name__icontains=keyword) |
                Q(notes__icontains=keyword)
            )

        # 分页
        skip = params.skip or 0
        limit = params.limit or 20

        total = await query.count()
        orders = await query.offset(skip).limit(limit).order_by('-created_at')

        # 为每个订单加载明细（简化版，只返回基本信息）
        # 不能直接 model_validate(order)：order.items 是 ReverseRelation，会导致 Pydantic 校验失败
        result = []
        for order in orders:
            items_count = await PurchaseOrderItem.filter(tenant_id=tenant_id, order_id=order.id).count()
            order_data = order.__dict__.copy()
            order_data.pop('items', None)
            order_data['items_count'] = items_count
            resp = PurchaseOrderListResponse.model_construct(**order_data)
            resp.items = []
            resp.items_count = items_count
            from apps.kuaizhizao.services.document_lifecycle_service import get_purchase_order_lifecycle
            resp.lifecycle = get_purchase_order_lifecycle(order)
            result.append(resp)

        # 返回前端期望的格式 { data, total, success }
        return {
            "data": [item.model_dump() for item in result],
            "total": total,
            "success": True
        }

    async def update_purchase_order(
        self,
        tenant_id: int,
        order_id: int,
        order_data: PurchaseOrderUpdate,
        updated_by: int
    ) -> PurchaseOrderResponse:
        """
        更新采购订单

        Args:
            tenant_id: 租户ID
            order_id: 订单ID
            order_data: 更新数据
            updated_by: 更新人ID

        Returns:
            PurchaseOrderResponse: 更新后的订单信息
        """
        async with in_transaction():
            order = await PurchaseOrder.get_or_none(tenant_id=tenant_id, id=order_id)
            if not order:
                raise NotFoundError(f"采购订单不存在: {order_id}")

            from apps.kuaizhizao.services.order_change.helpers import is_source_order_locked_for_direct_edit
            if is_source_order_locked_for_direct_edit(order.status, order.review_status):
                raise BusinessLogicError(
                    f"采购订单已生效或执行中，禁止直接修改，请通过采购变更单变更。当前状态: {order.status}"
                )

            requires_audit = order.status not in [DocumentStatus.DRAFT.value]
            operator_name = ""
            try:
                from apps.common.base_service import AppBaseService
                operator_name = await AppBaseService().get_user_name(updated_by) or str(updated_by)
            except Exception:
                operator_name = str(updated_by)

            if requires_audit:
                update_items = order_data.model_dump(exclude_unset=True, exclude={'items', 'change_reason'})
                for field, new_val in update_items.items():
                    old_val = getattr(order, field, None)
                    if str(old_val) != str(new_val):
                        await PurchaseOrderChange.create(
                            tenant_id=tenant_id,
                            order_id=order_id,
                            change_type="Modify",
                            field_name=field,
                            old_value=str(old_val),
                            new_value=str(new_val),
                            reason=order_data.change_reason,
                            operator_id=updated_by,
                            operator_name=operator_name
                        )

            # 更新订单头
            update_dict = order_data.model_dump(exclude_unset=True, exclude={'items', 'change_reason'})
            update_dict['updated_by'] = updated_by

            await order.update_from_dict(update_dict).save()

            # 如果有明细更新，重新计算金额
            if order_data.items:
                purchase_price_fluctuation_limit = await BusinessConfigService().get_purchase_price_fluctuation_limit_percent(
                    tenant_id
                )
                # 删除原有明细
                await PurchaseOrderItem.filter(tenant_id=tenant_id, order_id=order_id).delete()

                # 重新创建明细
                total_quantity = Decimal(0)
                total_amount = Decimal(0)

                for item_data in order_data.items:
                    material = await Material.get_or_none(tenant_id=tenant_id, id=item_data.material_id)
                    if not material:
                        raise NotFoundError(f"物料不存在: {item_data.material_id}")
                    self._validate_purchase_price_fluctuation_for_material(
                        material=material,
                        unit_price=item_data.unit_price,
                        fluctuation_limit_percent=purchase_price_fluctuation_limit,
                    )

                    total_price = item_data.ordered_quantity * item_data.unit_price
                    outstanding_quantity = item_data.ordered_quantity

                    item_dict = item_data.model_dump()
                    item_dict.update({
                        'tenant_id': tenant_id,
                        'order_id': order.id,
                        'total_price': total_price,
                        'outstanding_quantity': outstanding_quantity,
                        'updated_by': updated_by
                    })

                    if requires_audit:
                        # 对于明细的变更，目前简化记录为"明细整批更新"，后续可根据需求实现行级更细精度的对比
                        await PurchaseOrderChange.create(
                            tenant_id=tenant_id,
                            order_id=order_id,
                            change_type="Modify",
                            field_name="items",
                            old_value="[Batch Items Update]",
                            new_value=f"Original Material IDs updated by {operator_name}",
                            reason=order_data.change_reason,
                            operator_id=updated_by,
                            operator_name=operator_name
                        )
                    await PurchaseOrderItem.create(**item_dict)

                    total_quantity += item_data.ordered_quantity
                    total_amount += total_price

                # 更新订单头金额
                tax_amount = total_amount * (order_data.tax_rate or order.tax_rate)
                net_amount = total_amount + tax_amount

                await order.update_from_dict({
                    'total_quantity': total_quantity,
                    'total_amount': total_amount,
                    'tax_amount': tax_amount,
                    'net_amount': net_amount,
                    'updated_by': updated_by
                }).save()

            return await self.get_purchase_order_by_id(tenant_id, order_id)

    async def submit_purchase_order(
        self,
        tenant_id: int,
        order_id: int,
        submitted_by: int
    ) -> PurchaseOrderResponse:
        """
        提交采购订单（非审核，仅改变状态为待审核）
        
        如果配置了采购订单审批流程，则自动启动审批流程（采购审批流程增强）。

        Args:
            tenant_id: 租户ID
            order_id: 订单ID
            submitted_by: 提交人ID

        Returns:
            PurchaseOrderResponse: 提交后的订单信息
        """
        order = await PurchaseOrder.get_or_none(tenant_id=tenant_id, id=order_id)
        if not order:
            raise NotFoundError(f"采购订单不存在: {order_id}")

        if not is_draft_status(order.status):
            raise BusinessLogicError("只能提交草稿状态的订单")

        # 检查业务配置：若无需审核，则提交后直接设为已审核（考虑中小企业实情）
        from infra.services.business_config_service import BusinessConfigService
        config_service = BusinessConfigService()
        audit_required = await config_service.check_audit_required(tenant_id, "purchase_order")

        if not audit_required:
            # 无需审核，直接确认
            await order.update_from_dict({
                'status': DocumentStatus.CONFIRMED.value,
                'review_status': ReviewStatus.APPROVED.value,
                'updated_by': submitted_by
            }).save()
            return await self.get_purchase_order_by_id(tenant_id, order_id)

        # 启动审批流程（统一使用 ApprovalInstanceService）
        try:
            from core.services.approval.approval_instance_service import ApprovalInstanceService
            instance = await ApprovalInstanceService.start_approval(
                tenant_id=tenant_id,
                user_id=submitted_by,
                process_code="purchase_order",
                entity_type="purchase_order",
                entity_id=order_id,
                entity_uuid=str(order.uuid),
                title=f"采购订单审批: {order.order_code}",
                content=f"供应商: {order.supplier_name}, 金额: {order.total_amount}",
            )
            status = DocumentStatus.PENDING_REVIEW.value
        except Exception as e:
            logger.warning(f"启动采购订单审批流程失败: {str(e)}，订单ID: {order_id}")
            status = DocumentStatus.PENDING_REVIEW.value

        await order.update_from_dict({
            'status': status,
            'review_status': ReviewStatus.PENDING.value,
            'updated_by': submitted_by
        }).save()

        return await self.get_purchase_order_by_id(tenant_id, order_id)

    async def approve_purchase_order(
        self,
        tenant_id: int,
        order_id: int,
        approve_data: PurchaseOrderApprove,
        approved_by: int
    ) -> PurchaseOrderResponse:
        """
        审核采购订单（采购审批流程增强）
        
        如果启动了审批流程，则通过审批流程系统审核；否则使用原有逻辑。

        Args:
            tenant_id: 租户ID
            order_id: 订单ID
            approve_data: 审核数据
            approved_by: 审核人ID

        Returns:
            PurchaseOrderResponse: 审核后的订单信息
        """
        from core.services.approval.approval_instance_service import ApprovalInstanceService
        from infra.models.user import User

        order = await PurchaseOrder.get_or_none(tenant_id=tenant_id, id=order_id)
        if not order:
            raise NotFoundError(f"采购订单不存在: {order_id}")

        approver = await User.get_or_none(id=approved_by)
        approver_name = approver.name if approver else f"用户{approved_by}"

        approval_status = await ApprovalInstanceService.get_approval_status(
            tenant_id=tenant_id,
            entity_type="purchase_order",
            entity_id=order_id,
        )

        if approval_status.get("has_flow"):
            result = await ApprovalInstanceService.execute_approval(
                tenant_id=tenant_id,
                entity_type="purchase_order",
                entity_id=order_id,
                approver_id=approved_by,
                approved=approve_data.approved,
                comment=approve_data.review_remarks,
            )
            if result.get("flow_rejected"):
                update_dict = {
                    'reviewer_id': approved_by,
                    'review_time': datetime.now(),
                    'review_status': ReviewStatus.REJECTED.value,
                    'review_remarks': approve_data.review_remarks,
                    'status': DocumentStatus.REJECTED.value,
                    'updated_by': approved_by
                }
            elif result.get("flow_completed"):
                update_dict = {
                    'reviewer_id': approved_by,
                    'review_time': datetime.now(),
                    'review_status': ReviewStatus.APPROVED.value,
                    'review_remarks': approve_data.review_remarks,
                    'status': DocumentStatus.CONFIRMED.value,
                    'updated_by': approved_by
                }
            else:
                update_dict = {
                    'reviewer_id': approved_by,
                    'review_time': datetime.now(),
                    'review_status': "审核中" if approve_data.approved else ReviewStatus.REJECTED.value,
                    'review_remarks': approve_data.review_remarks,
                    'updated_by': approved_by
                }
                if not approve_data.approved:
                    update_dict['status'] = DocumentStatus.REJECTED.value
        else:
            # 没有启动审批流程，使用原有逻辑
            from apps.kuaizhizao.constants import REVIEW_STATUS_ALIASES
            current_review = str(order.review_status or "").strip()
            if REVIEW_STATUS_ALIASES.get(current_review, current_review) != ReviewStatus.PENDING.value:
                raise BusinessLogicError("订单已被审核")

            update_dict = {
                'reviewer_id': approved_by,
                'review_time': datetime.now(),
                'review_status': ReviewStatus.APPROVED.value if approve_data.approved else ReviewStatus.REJECTED.value,
                'review_remarks': approve_data.review_remarks,
                'updated_by': approved_by
            }

            if approve_data.approved:
                update_dict['status'] = DocumentStatus.CONFIRMED.value

        await order.update_from_dict(update_dict).save()

        return await self.get_purchase_order_by_id(tenant_id, order_id)

    async def confirm_purchase_order(
        self,
        tenant_id: int,
        order_id: int,
        confirm_data: PurchaseOrderConfirm,
        confirmed_by: int
    ) -> PurchaseOrderResponse:
        """
        确认采购订单（供应商确认）

        Args:
            tenant_id: 租户ID
            order_id: 订单ID
            confirm_data: 确认数据
            confirmed_by: 确认人ID

        Returns:
            PurchaseOrderResponse: 确认后的订单信息
        """
        order = await PurchaseOrder.get_or_none(tenant_id=tenant_id, id=order_id)
        if not order:
            raise NotFoundError(f"采购订单不存在: {order_id}")

        if order.status not in LEGACY_AUDITED_VALUES:
            raise BusinessLogicError("只有已审核的订单才能确认")

        await order.update_from_dict({
            'status': DocumentStatus.CONFIRMED.value,
            'notes': order.notes + f"\n确认备注：{confirm_data.confirm_remarks or ''}",
            'updated_by': confirmed_by
        }).save()

        return await self.get_purchase_order_by_id(tenant_id, order_id)

    async def delete_purchase_order(
        self, tenant_id: int, order_id: int, operator_id: Optional[int] = None
    ) -> bool:
        """
        删除采购订单

        删除前会同步回滚关联的采购申请：清除申请明细的 purchase_order_id，
        并重新计算采购申请状态（全部转单→部分转单→已通过），同时在采购申请上留下操作记录。

        Args:
            tenant_id: 租户ID
            order_id: 订单ID
            operator_id: 操作人ID（用于记录操作历史）

        Returns:
            bool: 是否删除成功
        """
        order = await PurchaseOrder.get_or_none(tenant_id=tenant_id, id=order_id)
        if not order:
            raise NotFoundError(f"采购订单不存在: {order_id}")

        # 只能删除草稿状态的订单
        if not is_draft_status(order.status):
            raise BusinessLogicError("只能删除草稿状态的订单")

        po_code = getattr(order, "order_code", str(order_id))

        # 同步回滚采购申请：清除关联申请明细的转单引用，重算申请状态，并记录操作历史
        await self._sync_requisition_on_po_delete(
            tenant_id=tenant_id, order_id=order_id, po_code=po_code, operator_id=operator_id
        )

        # 删除采购申请→采购订单 的 DocumentRelation（避免操作历史显示已删除的下游）
        from apps.kuaizhizao.models.document_relation import DocumentRelation
        await DocumentRelation.filter(
            tenant_id=tenant_id,
            source_type="purchase_requisition",
            target_type="purchase_order",
            target_id=order_id,
        ).delete()

        # 删除订单明细
        await PurchaseOrderItem.filter(tenant_id=tenant_id, order_id=order_id).delete()

        # 删除订单头
        await order.delete()

        return True

    async def _sync_requisition_on_po_delete(
        self,
        tenant_id: int,
        order_id: int,
        po_code: str = "",
        operator_id: Optional[int] = None,
    ) -> None:
        """采购订单删除时，清除关联采购申请明细的转单引用、重算申请状态，并记录操作历史"""
        from apps.kuaizhizao.models import PurchaseRequisition, PurchaseRequisitionItem
        from apps.kuaizhizao.models.state_transition import StateTransitionLog
        from apps.kuaizhizao.constants import DocumentStatus
        from apps.common.base_service import AppBaseService
        from datetime import datetime

        items = await PurchaseRequisitionItem.filter(
            tenant_id=tenant_id, purchase_order_id=order_id
        ).all()
        if not items:
            return

        operator_name = ""
        if operator_id:
            try:
                operator_name = await AppBaseService().get_user_name(operator_id) or str(operator_id)
            except Exception:
                operator_name = str(operator_id)

        requisition_ids = list({i.requisition_id for i in items})
        for item in items:
            await item.update_from_dict({
                "purchase_order_id": None,
                "purchase_order_item_id": None,
                "supplier_id": None,
            }).save()

        reason = f"下游采购单已删除（{po_code}）" if po_code else "下游采购单已删除"
        comment = json.dumps({"deleted_po_id": order_id, "deleted_po_code": po_code}, ensure_ascii=False)

        for rid in requisition_ids:
            req = await PurchaseRequisition.get_or_none(
                tenant_id=tenant_id, id=rid, deleted_at__isnull=True
            )
            if not req:
                continue

            from apps.kuaizhizao.services.purchase_requisition_service import PurchaseRequisitionService
            await PurchaseRequisitionService().merge_split_requisition_items(tenant_id, rid)

            old_status = req.status
            all_items = await PurchaseRequisitionItem.filter(
                tenant_id=tenant_id, requisition_id=rid
            ).all()
            if not all_items:
                continue
            has_any = any(i.purchase_order_id for i in all_items)
            all_converted = all(i.purchase_order_id for i in all_items)
            if all_converted:
                req.status = DocumentStatus.FULL_CONVERTED.value
            elif has_any:
                req.status = DocumentStatus.PARTIAL_CONVERTED.value
            else:
                req.status = "已通过"
            await req.save()

            if operator_id:
                await StateTransitionLog.create(
                    tenant_id=tenant_id,
                    entity_type="purchase_requisition",
                    entity_id=rid,
                    from_state=old_status,
                    to_state=req.status,
                    transition_reason=reason,
                    transition_comment=comment,
                    operator_id=operator_id,
                    operator_name=operator_name,
                    transition_time=datetime.now(),
                    related_entity_type="purchase_order",
                    related_entity_id=order_id,
                )

    async def push_to_receipt_preview(
        self,
        tenant_id: int,
        order_id: int,
        receipt_quantities: Optional[Dict[int, float]] = None
    ) -> Dict[str, Any]:
        """
        下推采购入库预览：返回将生成的明细及预生成批号（供下推弹窗展示）
        
        Args:
            tenant_id: 租户ID
            order_id: 采购单ID
            receipt_quantities: 入库数量字典 {item_id: quantity}
            
        Returns:
            Dict: items 列表，每项含 item_id, material_code, material_name, receipt_quantity, batch_number
        """
        from apps.master_data.models.material import Material
        from apps.master_data.models.supplier import Supplier
        from apps.kuaizhizao.services.batch_serial_helper import ensure_batch_no_for_item
        from decimal import Decimal

        order = await self.get_purchase_order_by_id(tenant_id, order_id)
        if order.status not in LEGACY_AUDITED_VALUES:
            raise BusinessLogicError("只有已审核或已确认的采购单才能下推到采购入库")

        order_items = await PurchaseOrderItem.filter(
            tenant_id=tenant_id,
            order_id=order_id
        ).all()

        if not order_items:
            raise BusinessLogicError("采购单没有明细，无法生成入库单")

        supplier_code = None
        if order.supplier_id:
            supplier = await Supplier.get_or_none(tenant_id=tenant_id, id=order.supplier_id, deleted_at__isnull=True)
            if supplier:
                supplier_code = supplier.code

        class _ItemData:
            def __init__(self, batch_number=None):
                self.batch_number = batch_number

        items = []
        for item in order_items:
            if receipt_quantities and item.id in receipt_quantities:
                receipt_quantity = Decimal(str(receipt_quantities[item.id]))
            else:
                receipt_quantity = item.outstanding_quantity
            if receipt_quantity <= 0:
                continue
            if receipt_quantity > item.outstanding_quantity:
                continue

            material = await Material.get_or_none(
                tenant_id=tenant_id,
                id=item.material_id,
                deleted_at__isnull=True,
            )
            batch_number = None
            if material:
                batch_number = await ensure_batch_no_for_item(
                    tenant_id=tenant_id,
                    material=material,
                    item_data=_ItemData(),
                    supplier_code=supplier_code,
                )

            items.append({
                "item_id": item.id,
                "material_id": item.material_id,
                "material_code": item.material_code,
                "material_name": item.material_name,
                "receipt_quantity": float(receipt_quantity),
                "batch_number": batch_number,
            })

        return {"items": items}

    async def push_to_receipt(
        self,
        tenant_id: int,
        order_id: int,
        created_by: int,
        receipt_quantities: Optional[Dict[int, float]] = None,
        batch_numbers: Optional[Dict[int, str]] = None
    ) -> Dict[str, Any]:
        """
        下推到采购入库
        
        从采购单下推，自动生成采购入库单
        
        Args:
            tenant_id: 租户ID
            order_id: 采购单ID
            created_by: 创建人ID
            receipt_quantities: 入库数量字典 {item_id: quantity}，如果不提供则使用订单数量
            batch_numbers: 预生成批号字典 {item_id: batch_number}（可选，来自预览时使用以避免重复生成）
            
        Returns:
            Dict: 包含创建的采购入库单信息
            
        Raises:
            NotFoundError: 采购单不存在
            BusinessLogicError: 采购单未审核或已全部入库
        """
        from apps.kuaizhizao.services.warehouse_service import PurchaseReceiptService
        from apps.kuaizhizao.schemas.warehouse import PurchaseReceiptCreate, PurchaseReceiptItemCreate
        from decimal import Decimal
        
        # 验证采购单存在且已审核
        order = await self.get_purchase_order_by_id(tenant_id, order_id)
        if order.status not in LEGACY_AUDITED_VALUES:
            raise BusinessLogicError("只有已审核或已确认的采购单才能下推到采购入库")
        
        # 获取订单明细
        order_items = await PurchaseOrderItem.filter(
            tenant_id=tenant_id,
            order_id=order_id
        ).all()
        
        if not order_items:
            raise BusinessLogicError("采购单没有明细，无法生成入库单")
        
        # 检查是否有未入库的明细
        has_outstanding = any(item.outstanding_quantity > 0 for item in order_items)
        if not has_outstanding:
            raise BusinessLogicError("采购单已全部入库，无法再次生成入库单")
        
        # 创建采购入库单
        receipt_service = PurchaseReceiptService()
        
        # 构建入库单明细
        receipt_items = []
        for item in order_items:
            # 确定入库数量
            if receipt_quantities and item.id in receipt_quantities:
                receipt_quantity = Decimal(str(receipt_quantities[item.id]))
            else:
                receipt_quantity = item.outstanding_quantity
            
            # 跳过数量为0的明细
            if receipt_quantity <= 0:
                continue
            
            # 验证入库数量不超过未入库数量
            if receipt_quantity > item.outstanding_quantity:
                raise ValidationError(f"物料 {item.material_code} 的入库数量 {receipt_quantity} 超过未入库数量 {item.outstanding_quantity}")

            batch_number = batch_numbers.get(item.id) if batch_numbers else None

            receipt_items.append(PurchaseReceiptItemCreate(
                purchase_order_item_id=item.id,
                material_id=item.material_id,
                material_code=item.material_code,
                material_name=item.material_name,
                material_unit=item.unit,
                receipt_quantity=receipt_quantity,
                unit_price=item.unit_price,
                total_amount=receipt_quantity * item.unit_price,
                qualified_quantity=receipt_quantity,  # 默认全部合格，后续可通过检验调整
                unqualified_quantity=Decimal('0'),  # 默认无不合格数量
                batch_number=batch_number,
            ))
        
        if not receipt_items:
            raise BusinessLogicError("没有可入库的明细")

        from apps.master_data.models.warehouse import Warehouse

        wh = await Warehouse.filter(tenant_id=tenant_id, deleted_at__isnull=True, is_active=True).order_by("id").first()
        if not wh:
            raise BusinessLogicError("未配置可用仓库，无法生成采购入库单。请先在主数据维护仓库。")

        receipt_data = PurchaseReceiptCreate(
            purchase_order_id=int(order.id),
            purchase_order_code=str(order.order_code or ""),
            supplier_id=int(order.supplier_id),
            supplier_name=str(order.supplier_name or ""),
            warehouse_id=int(wh.id),
            warehouse_name=str(wh.name or wh.code or f"仓库{wh.id}"),
            status="草稿",
            review_status="待审核",
            notes=f"由采购订单 {order.order_code} 下推生成（草稿）",
            items=receipt_items,
        )

        created = await receipt_service.create_purchase_receipt(
            tenant_id=tenant_id,
            receipt_data=receipt_data,
            created_by=created_by,
        )
        return {"id": created.id, "receipt_code": created.receipt_code}

    # === 采购员赋能增强方法 ===

    async def get_material_price_history(self, tenant_id: int, material_id: int) -> MaterialPriceHistoryResponse:
        """获取物料历史成交价"""
        from apps.kuaizhizao.models.purchase_order import PurchaseOrderItem
        from apps.kuaizhizao.constants import LEGACY_AUDITED_VALUES

        # 获取该物料最近 10 次已审核订单的成交记录
        items = await PurchaseOrderItem.filter(
            tenant_id=tenant_id,
            material_id=material_id,
            order__status__in=LEGACY_AUDITED_VALUES
        ).select_related("order").order_by("-order__order_date").limit(10).all()

        history_items = []
        prices = []
        for item in items:
            history_items.append(MaterialPriceHistoryItem(
                order_id=item.order_id,
                order_code=item.order.order_code,
                order_date=item.order.order_date,
                supplier_id=item.order.supplier_id,
                supplier_name=item.order.supplier_name,
                unit_price=item.unit_price,
                # currency=item.order.currency
            ))
            prices.append(item.unit_price)

        if not prices:
            return MaterialPriceHistoryResponse(
                material_id=material_id,
                history_items=[],
                average_price=0,
                min_price=0,
                max_price=0
            )

        return MaterialPriceHistoryResponse(
            material_id=material_id,
            history_items=history_items,
            average_price=sum(prices) / len(prices),
            min_price=min(prices),
            max_price=max(prices)
        )

    async def get_purchase_order_changes(self, tenant_id: int, order_id: int):
        """获取采购订单的详细变更审计记录"""
        from apps.kuaizhizao.models.purchase_order import PurchaseOrderChange
        return await PurchaseOrderChange.filter(tenant_id=tenant_id, order_id=order_id).order_by("-created_at")

    async def get_purchase_order_tracking(self, tenant_id: int, order_id: int) -> PurchaseTrackingResponse:
        """获取采购订单全链路追踪"""
        from apps.kuaizhizao.models.purchase_receipt import PurchaseReceipt
        from apps.kuaizhizao.models.incoming_inspection import IncomingInspection
        from apps.kuaizhizao.constants import DocumentStatus

        order = await PurchaseOrder.get_or_none(tenant_id=tenant_id, id=order_id)
        if not order:
            raise NotFoundError(f"订单不存在: {order_id}")

        nodes = []
        # 1. 订单下达
        nodes.append(PurchaseTrackingNode(
            node_name="订单下达",
            status="已完成",
            time=order.created_at,
            detail=f"单号: {order.order_code}",
            is_completed=True
        ))

        # 2. 订单审核
        is_audited = order.status in ["AUDITED", "已审核", "CONFIRMED", "已确认", "audited", "已通过"]
        nodes.append(PurchaseTrackingNode(
            node_name="订单审核",
            status=order.review_status or "待审核",
            time=order.review_time,
            operator=order.reviewer_name,
            is_completed=is_audited,
            is_warning=order.review_status == "已驳回"
        ))

        # 3. 供应商确认
        is_confirmed = order.status in ["CONFIRMED", "已确认"]
        nodes.append(PurchaseTrackingNode(
            node_name="供应商确认",
            status="已确认" if is_confirmed else "待确认",
            is_completed=is_confirmed
        ))

        # 4. 质检进度 (查询关联的来料检验单)
        inspections = await IncomingInspection.filter(
            tenant_id=tenant_id,
            purchase_receipt_id__in=await PurchaseReceipt.filter(purchase_order_id=order_id).values_list("id", flat=True)
        ).all()
        
        inspection_status = "待检验"
        inspection_completed = False
        inspection_warning = False
        if inspections:
            inspection_completed = all(i.status == "已完成" for i in inspections)
            any_fail = any(i.quality_status == "不合格" for i in inspections)
            inspection_status = "质检完成" if inspection_completed else "质检中"
            if any_fail:
                inspection_status += " (含有不合格)"
                inspection_warning = True
        
        nodes.append(PurchaseTrackingNode(
            node_name="来料质检",
            status=inspection_status,
            is_completed=inspection_completed,
            is_warning=inspection_warning,
            detail=f"共 {len(inspections)} 笔检单" if inspections else "暂无质检记录"
        ))

        # 5. 入库进度
        receipts = await PurchaseReceipt.filter(tenant_id=tenant_id, purchase_order_id=order_id).all()
        total_received = sum(r.total_quantity for r in receipts)
        is_receipt_completed = total_received >= order.total_quantity and order.total_quantity > 0
        
        nodes.append(PurchaseTrackingNode(
            node_name="仓库入库",
            status=f"已入库 {total_received}/{order.total_quantity}",
            is_completed=is_receipt_completed,
            detail=f"共 {len(receipts)} 笔入库单" if receipts else "待入库"
        ))

        # 计算进度
        completed_count = sum(1 for n in nodes if n.is_completed)
        progress = int((completed_count / len(nodes)) * 100)

        return PurchaseTrackingResponse(
            order_id=order_id,
            order_code=order.order_code,
            overall_progress=progress,
            nodes=nodes
        )

    async def expedite_purchase_order(self, tenant_id: int, order_id: int, remarks: Optional[str] = None) -> ExpediteResponse:
        """一键催单"""
        order = await PurchaseOrder.get_or_none(tenant_id=tenant_id, id=order_id)
        if not order:
            raise NotFoundError(f"订单不存在: {order_id}")
        
        # 记录催单日志 (StateTransitionLog)
        from apps.kuaizhizao.models.state_transition import StateTransitionLog
        await StateTransitionLog.create(
            tenant_id=tenant_id,
            entity_type="purchase_order",
            entity_id=order_id,
            from_state=order.status,
            to_state=order.status,
            transition_reason="采购员手动催单",
            transition_comment=remarks or "请尽快发货",
            transition_time=datetime.now()
        )
        
        return ExpediteResponse(
            success=True,
            message=f"已向供应商 {order.supplier_name} 发出催单提醒",
            expedite_time=datetime.now()
        )

    async def get_price_comparison(self, tenant_id: int, material_ids: List[int]) -> PriceComparisonResponse:
        """
        获取物料的多供应商价格对比（比价助手）

        从历史成交记录中提取不同供应商的最近成交价。
        """
        from apps.kuaizhizao.models.purchase_order import PurchaseOrderItem
        from apps.kuaizhizao.models.purchase_receipt import PurchaseReceipt
        from apps.master_data.models.material import Material
        from apps.kuaizhizao.constants import LEGACY_AUDITED_VALUES
        
        results = []
        for mid in material_ids:
            material = await Material.get_or_none(tenant_id=tenant_id, id=mid)
            if not material:
                continue
            
            # 查询该物料最近的成交记录
            items = await PurchaseOrderItem.filter(
                tenant_id=tenant_id,
                material_id=mid,
                order__status__in=LEGACY_AUDITED_VALUES
            ).select_related("order").order_by("-order__order_date").limit(50).all()
            
            # 按供应商去重，保留各供应商最近的一笔
            supplier_latest = {} # supplier_id -> item
            for item in items:
                sid = item.order.supplier_id
                if sid not in supplier_latest:
                    supplier_latest[sid] = item
                if len(supplier_latest) >= 5: # 最多对比5家
                    break
            
            comparisons = []
            for sid, item in supplier_latest.items():
                delivery_lead_days = 0
                try:
                    rec = (
                        await PurchaseReceipt.filter(
                            tenant_id=tenant_id, purchase_order_id=item.order.id
                        )
                        .order_by("receipt_time")
                        .first()
                    )
                    if rec and rec.receipt_time and item.order.order_date:
                        delivery_lead_days = max(
                            0,
                            (rec.receipt_time.date() - item.order.order_date).days,
                        )
                except Exception:
                    pass

                comparisons.append(
                    PriceComparisonItem(
                        supplier_id=sid,
                        supplier_name=item.order.supplier_name,
                        last_price=item.unit_price,
                        last_order_date=item.order.order_date,
                        delivery_lead_time=max(0, delivery_lead_days),
                    )
                )

            # 按价格升序排列（便宜优先）
            comparisons.sort(key=lambda x: x.last_price)

            results.append(
                MaterialPriceComparison(
                    material_id=mid,
                    material_name=material.name,
                    material_code=material.main_code or material.code or None,
                    comparison=comparisons,
                )
            )

        return PriceComparisonResponse(results=results)

    async def push_to_receipt_notice(
        self,
        tenant_id: int,
        order_id: int,
        created_by: int,
        notice_quantities: Optional[Dict[int, float]] = None
    ) -> Dict[str, Any]:
        """
        下推到收货通知

        从采购单下推，自动生成收货通知单（通知仓库收货，不直接动库存）。

        Args:
            tenant_id: 租户ID
            order_id: 采购单ID
            created_by: 创建人ID
            notice_quantities: 通知数量字典 {item_id: quantity}，不提供则使用订单未入库数量

        Returns:
            Dict: 包含创建的收货通知单信息
        """
        from apps.kuaizhizao.services.receipt_notice_service import ReceiptNoticeService
        from apps.kuaizhizao.schemas.receipt_notice import ReceiptNoticeCreate, ReceiptNoticeItemCreate
        from apps.master_data.models.warehouse import Warehouse
        from decimal import Decimal

        order = await self.get_purchase_order_by_id(tenant_id, order_id)
        if order.status not in LEGACY_AUDITED_VALUES:
            raise BusinessLogicError("只有已审核或已确认的采购单才能下推到收货通知")

        order_items = await PurchaseOrderItem.filter(tenant_id=tenant_id, order_id=order_id).all()
        if not order_items:
            raise BusinessLogicError("采购单没有明细，无法生成收货通知单")

        has_outstanding = any(item.outstanding_quantity > 0 for item in order_items)
        if not has_outstanding:
            raise BusinessLogicError("采购单已全部入库，无法生成收货通知单")

        default_warehouse = await Warehouse.filter(tenant_id=tenant_id, is_active=True).first()
        warehouse_id = default_warehouse.id if default_warehouse else None
        warehouse_name = default_warehouse.name if default_warehouse else None

        def _resolve_notice_qty(po_item: PurchaseOrderItem) -> float:
            base = float(po_item.outstanding_quantity or 0)
            if not notice_quantities or not isinstance(notice_quantities, dict):
                return base
            raw = notice_quantities.get(po_item.id)
            if raw is None:
                raw = notice_quantities.get(str(po_item.id))
            if raw is None:
                return base
            try:
                return float(raw)
            except (TypeError, ValueError):
                return base

        items = []
        for item in order_items:
            qty = _resolve_notice_qty(item)
            if qty <= 0:
                continue
            if qty > float(item.outstanding_quantity):
                raise ValidationError(f"物料 {item.material_code} 的通知数量 {qty} 超过未入库数量 {item.outstanding_quantity}")
            items.append(ReceiptNoticeItemCreate(
                material_id=item.material_id,
                material_code=item.material_code,
                material_name=item.material_name,
                material_spec=item.material_spec or "",
                material_unit=item.unit,
                notice_quantity=qty,
                unit_price=float(item.unit_price),
                total_amount=qty * float(item.unit_price),
                purchase_order_item_id=item.id,
            ))

        if not items:
            raise BusinessLogicError("没有可通知的明细")

        notice_data = ReceiptNoticeCreate(
            purchase_order_id=order_id,
            purchase_order_code=order.order_code,
            supplier_id=order.supplier_id,
            supplier_name=order.supplier_name,
            supplier_contact=order.supplier_contact,
            supplier_phone=order.supplier_phone,
            warehouse_id=warehouse_id,
            warehouse_name=warehouse_name,
            planned_receipt_date=order.delivery_date,
            status="待收货",
            notes=f"从采购订单 {order.order_code} 下推",
            items=items,
        )
        notice_service = ReceiptNoticeService()
        notice = await notice_service.create_receipt_notice(tenant_id=tenant_id, notice_data=notice_data, created_by=created_by)
        return {
            "order_id": order_id,
            "order_code": order.order_code,
            "notice_id": notice.id,
            "notice_code": notice.notice_code,
            "message": "收货通知单创建成功",
        }

    async def push_to_invoice(
        self,
        tenant_id: int,
        order_id: int,
        created_by: int
    ) -> Dict[str, Any]:
        """
        下推到采购发票

        从采购单下推，自动生成采购发票（草稿，待补全发票号码等）。

        Args:
            tenant_id: 租户ID
            order_id: 采购单ID
            created_by: 创建人ID

        Returns:
            Dict: 包含创建的采购发票信息
        """
        from apps.kuaicaiwu.services.finance_service import PurchaseInvoiceService
        from apps.kuaicaiwu.schemas.finance import PurchaseInvoiceCreate

        order = await self.get_purchase_order_by_id(tenant_id, order_id)
        if order.status not in LEGACY_AUDITED_VALUES:
            raise BusinessLogicError("只有已审核或已确认的采购单才能下推到采购发票")

        today = datetime.now().strftime("%Y%m%d")
        invoice_code = await self.generate_code(tenant_id, "PURCHASE_INVOICE_CODE", prefix=f"PI{today}")

        total_amount = float(order.total_amount or 0)
        tax_rate = float(order.tax_rate or 0)
        tax_amount = total_amount * tax_rate if tax_rate else 0
        invoice_amount = total_amount
        total_with_tax = total_amount + tax_amount

        invoice_data = PurchaseInvoiceCreate(
            invoice_code=invoice_code,
            purchase_order_id=order_id,
            purchase_order_code=order.order_code,
            supplier_id=order.supplier_id,
            supplier_name=order.supplier_name,
            invoice_number="待补全",
            invoice_date=datetime.now().date(),
            invoice_type="增值税专用发票",
            tax_rate=tax_rate,
            invoice_amount=invoice_amount,
            tax_amount=tax_amount,
            total_amount=total_with_tax,
            status="未审核",
            review_status="待审核",
            notes=f"从采购订单 {order.order_code} 下推",
        )
        invoice_service = PurchaseInvoiceService()
        invoice = await invoice_service.create_purchase_invoice(tenant_id=tenant_id, invoice_data=invoice_data, created_by=created_by)
        return {
            "order_id": order_id,
            "order_code": order.order_code,
            "invoice_id": invoice.id,
            "invoice_code": invoice.invoice_code,
            "message": "采购发票创建成功",
        }
