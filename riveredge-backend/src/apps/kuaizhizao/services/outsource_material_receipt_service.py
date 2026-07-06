"""
委外收货业务服务模块

提供委外收货相关的业务逻辑处理。

根据功能点2.1.10：委外工单管理（核心功能，新增）

Author: Auto (AI Assistant)
Date: 2026-01-16
"""

import uuid
from datetime import datetime, timedelta
from typing import List, Optional
from decimal import Decimal

from tortoise.queryset import Q
from tortoise.transactions import in_transaction

from infra.exceptions.exceptions import NotFoundError, ValidationError, BusinessLogicError

from apps.common.base_service import AppBaseService
from apps.kuaizhizao.models.outsource_work_order import OutsourceMaterialReceipt, OutsourceWorkOrder
from apps.kuaizhizao.schemas.outsource_work_order import (
    OutsourceMaterialReceiptCreate,
    OutsourceMaterialReceiptPreviewLine,
    OutsourceMaterialReceiptPreviewResponse,
    OutsourceMaterialReceiptUpdate,
    OutsourceMaterialReceiptResponse,
)
from loguru import logger


class OutsourceMaterialReceiptService(AppBaseService[OutsourceMaterialReceipt]):
    """
    委外收货服务类

    处理委外收货相关的所有业务逻辑。
    """

    def __init__(self):
        super().__init__(OutsourceMaterialReceipt)
        from infra.services.business_config_service import BusinessConfigService

        self.business_config_service = BusinessConfigService()

    async def get_receipt_preview(
        self,
        tenant_id: int,
        outsource_work_order_id: int,
    ) -> OutsourceMaterialReceiptPreviewResponse:
        """委外收货预览：委外数量 / 已收 / 待收。"""
        owo = await OutsourceWorkOrder.filter(
            tenant_id=tenant_id,
            id=outsource_work_order_id,
            deleted_at__isnull=True,
        ).first()
        if not owo:
            raise NotFoundError(f"委外工单ID {outsource_work_order_id} 不存在")

        from apps.kuaizhizao.services.document_action_policy.outsource_work_order import (
            assert_outsource_work_order_capability,
        )

        assert_outsource_work_order_capability(owo, "push_outsource_receipt")

        ordered = Decimal(str(owo.quantity or 0))
        received = Decimal(str(owo.received_quantity or 0))
        pending = max(Decimal("0"), ordered - received)
        message = None
        lines: List[OutsourceMaterialReceiptPreviewLine] = []
        if pending > 0:
            lines.append(
                OutsourceMaterialReceiptPreviewLine(
                    product_id=int(owo.product_id or 0),
                    product_code=str(owo.product_code or ""),
                    product_name=str(owo.product_name or ""),
                    unit=str(owo.unit or "件"),
                    ordered_quantity=ordered,
                    received_quantity=received,
                    pending_quantity=pending,
                )
            )
        else:
            message = "委外数量已全部收货，无可入库明细"

        return OutsourceMaterialReceiptPreviewResponse(
            outsource_work_order_id=int(owo.id),
            outsource_work_order_code=str(owo.code or ""),
            lines=lines,
            message=message,
        )

    async def create_material_receipt(
        self,
        tenant_id: int,
        receipt_data: OutsourceMaterialReceiptCreate,
        created_by: int
    ) -> OutsourceMaterialReceiptResponse:
        """
        创建委外收货单

        Args:
            tenant_id: 组织ID
            receipt_data: 委外收货创建数据
            created_by: 创建人ID

        Returns:
            OutsourceMaterialReceiptResponse: 创建的委外收货单信息

        Raises:
            ValidationError: 数据验证失败
        """
        async with in_transaction():
            # 验证委外工单是否存在
            outsource_work_order = await OutsourceWorkOrder.filter(
                tenant_id=tenant_id,
                id=receipt_data.outsource_work_order_id,
                deleted_at__isnull=True
            ).first()

            if not outsource_work_order:
                raise NotFoundError(f"委外工单ID {receipt_data.outsource_work_order_id} 不存在")

            from apps.kuaizhizao.services.document_action_policy.outsource_work_order import (
                assert_outsource_work_order_capability,
            )

            assert_outsource_work_order_capability(outsource_work_order, "push_outsource_receipt")

            # 验证收货数量不能超过委外数量
            if receipt_data.quantity > outsource_work_order.quantity:
                raise ValidationError(
                    f"收货数量 {receipt_data.quantity} 不能超过委外数量 {outsource_work_order.quantity}"
                )

            # 处理编码
            code = receipt_data.code
            if not code:
                # 自动生成编码（格式：OWR-日期-序号）
                today = datetime.now().strftime("%Y%m%d")
                existing_codes = await OutsourceMaterialReceipt.filter(
                    tenant_id=tenant_id,
                    code__startswith=f"OWR-{today}",
                    deleted_at__isnull=True
                ).order_by("-code").limit(1).values_list("code", flat=True)
                
                if existing_codes:
                    last_code = existing_codes[0]
                    last_seq = int(last_code.split("-")[-1]) if last_code.split("-")[-1].isdigit() else 0
                    seq = last_seq + 1
                else:
                    seq = 1
                
                code = f"OWR-{today}-{seq:04d}"
            else:
                # 验证编码唯一性
                existing = await OutsourceMaterialReceipt.filter(
                    tenant_id=tenant_id,
                    code=code,
                    deleted_at__isnull=True
                ).first()
                
                if existing:
                    raise ValidationError(f"委外收货单编码 {code} 已存在")

            # 获取创建人信息
            user_info = await self.get_user_info(created_by)

            # 创建委外收货单（创建即入库，标记为已完成）
            now = datetime.now()
            material_receipt = await OutsourceMaterialReceipt.create(
                tenant_id=tenant_id,
                uuid=str(uuid.uuid4()),
                code=code,
                outsource_work_order_id=receipt_data.outsource_work_order_id,
                outsource_work_order_code=receipt_data.outsource_work_order_code,
                quantity=receipt_data.quantity,
                qualified_quantity=receipt_data.qualified_quantity,
                unqualified_quantity=receipt_data.unqualified_quantity,
                unit=receipt_data.unit,
                warehouse_id=receipt_data.warehouse_id,
                warehouse_name=receipt_data.warehouse_name,
                location_id=receipt_data.location_id,
                location_name=receipt_data.location_name,
                batch_number=receipt_data.batch_number,
                status="completed",
                received_at=now,
                received_by=created_by,
                received_by_name=user_info["name"],
                remarks=receipt_data.remarks,
                created_by=created_by,
                created_by_name=user_info["name"],
            )

            # 更新委外工单的已收货数量、合格数量、不合格数量
            outsource_work_order.received_quantity = (
                (outsource_work_order.received_quantity or Decimal("0")) + receipt_data.quantity
            )
            outsource_work_order.qualified_quantity = (
                (outsource_work_order.qualified_quantity or Decimal("0")) + receipt_data.qualified_quantity
            )
            outsource_work_order.unqualified_quantity = (
                (outsource_work_order.unqualified_quantity or Decimal("0")) + receipt_data.unqualified_quantity
            )

            # 如果已收货数量达到委外数量，自动更新状态为completed
            if outsource_work_order.received_quantity >= outsource_work_order.quantity:
                outsource_work_order.status = "completed"
                outsource_work_order.actual_end_date = datetime.now()

            await outsource_work_order.save()

            # 调用统一库存服务增加库存（委外收货为成品入库）
            from apps.kuaizhizao.services.inventory_service import InventoryService

            product_id = outsource_work_order.product_id
            if product_id:
                await InventoryService.increase_stock(
                    tenant_id=tenant_id,
                    material_id=product_id,
                    quantity=receipt_data.qualified_quantity or receipt_data.quantity,
                    warehouse_id=receipt_data.warehouse_id,
                    batch_no=getattr(receipt_data, "batch_number", None),
                    source_type="outsource_material_receipt",
                    source_doc_id=material_receipt.id,
                    source_doc_code=code,
                )

            logger.info(f"创建委外收货单成功: {code}")

            await material_receipt.refresh_from_db()
            response = OutsourceMaterialReceiptResponse.model_validate(material_receipt)

        await self._maybe_auto_create_payable_for_outsource_receipt(
            tenant_id=tenant_id,
            material_receipt=material_receipt,
            outsource_work_order=outsource_work_order,
            receipt_data=receipt_data,
            created_by=created_by,
        )
        return response

    async def _maybe_auto_create_payable_for_outsource_receipt(
        self,
        *,
        tenant_id: int,
        material_receipt: OutsourceMaterialReceipt,
        outsource_work_order: OutsourceWorkOrder,
        receipt_data: OutsourceMaterialReceiptCreate,
        created_by: int,
    ) -> None:
        """委外收货确认后自动生成应付单（策略与采购入库一致：按入库/收货确认）。"""
        from apps.kuaicaiwu.constants.finance_source_types import PAYABLE_SOURCE_OUTSOURCE_RECEIPT
        from apps.kuaicaiwu.services.finance_service import PayableService
        from apps.kuaicaiwu.schemas.finance import PayableCreate
        from apps.kuaicaiwu.services.finance_integration_hooks import (
            link_finance_document_relation,
            record_finance_accounting_event,
        )

        _sup_id = getattr(outsource_work_order, "supplier_id", None)
        if not await self.business_config_service.should_auto_generate_payable_on_purchase_receipt(
            tenant_id, int(_sup_id) if _sup_id is not None else None
        ):
            return

        receipt_qty = Decimal(str(receipt_data.qualified_quantity or receipt_data.quantity or 0))
        unit_price = Decimal(str(outsource_work_order.unit_price or 0))
        total_amount = (receipt_qty * unit_price).quantize(Decimal("0.01"))
        if total_amount <= 0:
            return

        try:
            payable_service = PayableService()
            payable_data = PayableCreate(
                source_type=PAYABLE_SOURCE_OUTSOURCE_RECEIPT,
                source_id=material_receipt.id,
                source_code=material_receipt.code,
                supplier_id=outsource_work_order.supplier_id,
                supplier_name=outsource_work_order.supplier_name,
                total_amount=float(total_amount),
                paid_amount=0.0,
                remaining_amount=float(total_amount),
                due_date=(datetime.now() + timedelta(days=30)).date(),
                business_date=datetime.now().date(),
                status="未付款",
                notes=f"由委外收货单 {material_receipt.code} 自动生成",
            )
            payable = await payable_service.create_payable(
                tenant_id=tenant_id,
                payable_data=payable_data,
                created_by=created_by,
            )
            await link_finance_document_relation(
                tenant_id=tenant_id,
                source_type="outsource_material_receipt",
                source_id=material_receipt.id,
                source_code=material_receipt.code,
                target_type="payable",
                target_id=payable.id,
                target_code=getattr(payable, "payable_code", None),
                relation_desc="委外收货自动生成应付单",
                created_by=created_by,
            )
            await record_finance_accounting_event(
                tenant_id=tenant_id,
                event_type="OUTSOURCE_RECEIPT_TO_PAYABLE",
                business_type="payable",
                source_doc_type="outsource_material_receipt",
                source_doc_id=material_receipt.id,
                source_doc_code=material_receipt.code,
                target_doc_type="Payable",
                target_doc_id=payable.id,
                target_doc_code=payable.payable_code,
                amount=total_amount,
                operator_id=created_by,
                notes=f"委外收货单 {material_receipt.code} 自动生成应付单",
            )
        except Exception as e:
            logger.warning("委外收货自动生成应付单失败（不影响收货结果）: %s", e)

    async def _normalize_legacy_draft_receipts(
        self, receipts: List[OutsourceMaterialReceipt]
    ) -> None:
        """历史数据：创建时已入库但状态仍为 draft，补写为 completed。"""
        for receipt in receipts:
            if receipt.status != "draft":
                continue
            receipt.status = "completed"
            if not receipt.received_at:
                receipt.received_at = receipt.created_at or datetime.now()
            if not receipt.received_by:
                receipt.received_by = receipt.created_by
            if not receipt.received_by_name:
                receipt.received_by_name = receipt.created_by_name
            await receipt.save()
            logger.info(f"补写委外收货单状态 draft->completed: {receipt.code}")

    async def list_material_receipts(
        self,
        tenant_id: int,
        skip: int = 0,
        limit: int = 100,
        outsource_work_order_id: Optional[int] = None,
        status: Optional[str] = None,
        keyword: Optional[str] = None,
    ) -> List[OutsourceMaterialReceiptResponse]:
        """
        获取委外收货单列表

        Args:
            tenant_id: 组织ID
            skip: 跳过数量
            limit: 限制数量
            outsource_work_order_id: 委外工单ID筛选
            status: 状态筛选
            keyword: 关键词搜索

        Returns:
            List[OutsourceMaterialReceiptResponse]: 委外收货单列表
        """
        query = Q(tenant_id=tenant_id, deleted_at__isnull=True)

        if outsource_work_order_id:
            query &= Q(outsource_work_order_id=outsource_work_order_id)
        if status:
            query &= Q(status=status)
        if keyword:
            query &= Q(code__icontains=keyword)

        receipts = await OutsourceMaterialReceipt.filter(query).order_by("-created_at").offset(skip).limit(limit).all()

        await self._normalize_legacy_draft_receipts(receipts)

        from apps.kuaizhizao.services.document_action_policy.enricher import enrich_inbound_hub_list_capabilities
        responses = [OutsourceMaterialReceiptResponse.model_validate(receipt) for receipt in receipts]
        item_counts = {int(r.id): 1 for r in receipts}
        return enrich_inbound_hub_list_capabilities(
            receipts, responses, "outsource_receipt", item_counts=item_counts
        )

    async def get_material_receipt(
        self,
        tenant_id: int,
        receipt_id: int
    ) -> OutsourceMaterialReceiptResponse:
        """
        获取委外收货单详情

        Args:
            tenant_id: 组织ID
            receipt_id: 委外收货单ID

        Returns:
            OutsourceMaterialReceiptResponse: 委外收货单信息

        Raises:
            NotFoundError: 委外收货单不存在
        """
        receipt = await OutsourceMaterialReceipt.filter(
            tenant_id=tenant_id,
            id=receipt_id,
            deleted_at__isnull=True
        ).first()

        if not receipt:
            raise NotFoundError(f"委外收货单ID {receipt_id} 不存在")

        await self._normalize_legacy_draft_receipts([receipt])

        return OutsourceMaterialReceiptResponse.model_validate(receipt)

    async def complete_material_receipt(
        self,
        tenant_id: int,
        receipt_id: int,
        completed_by: int
    ) -> OutsourceMaterialReceiptResponse:
        """
        完成委外收货（更新状态为completed，记录收货时间和收货人）

        Args:
            tenant_id: 组织ID
            receipt_id: 委外收货单ID
            completed_by: 完成人ID

        Returns:
            OutsourceMaterialReceiptResponse: 更新后的委外收货单信息

        Raises:
            NotFoundError: 委外收货单不存在
        """
        receipt = await OutsourceMaterialReceipt.filter(
            tenant_id=tenant_id,
            id=receipt_id,
            deleted_at__isnull=True
        ).first()

        if not receipt:
            raise NotFoundError(f"委外收货单ID {receipt_id} 不存在")

        from apps.kuaizhizao.services.document_action_policy.warehouse_inbound_hub import (
            assert_inbound_hub_capability,
        )

        assert_inbound_hub_capability(receipt, "confirm", receipt_type="outsource_receipt")

        if receipt.status == "completed":
            raise BusinessLogicError("委外收货单已完成，不能重复完成")

        # 获取完成人信息
        user_info = await self.get_user_info(completed_by)

        # 更新状态
        receipt.status = "completed"
        receipt.received_at = datetime.now()
        receipt.received_by = completed_by
        receipt.received_by_name = user_info["name"]
        receipt.updated_by = completed_by
        receipt.updated_by_name = user_info["name"]
        await receipt.save()

        logger.info(f"完成委外收货单: {receipt.code}")

        await receipt.refresh_from_db()
        return OutsourceMaterialReceiptResponse.model_validate(receipt)
