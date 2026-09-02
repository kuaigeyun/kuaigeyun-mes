"""
委外收货业务服务模块

提供委外收货相关的业务逻辑处理。

根据功能点2.1.10：委外工单管理（核心功能，新增）

Author: Auto (AI Assistant)
Date: 2026-01-16
"""

import asyncio
import uuid
from datetime import datetime, timedelta
from decimal import Decimal
from typing import Any, Dict, List, Optional

from apps.kuaizhizao.schemas.warehouse import InboundConfirmationRequest

from tortoise.queryset import Q
from tortoise.transactions import in_transaction
from tortoise import Tortoise

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

from core.utils.timezone_utils import resolve_business_datetime, to_site_date, today_site_str

from apps.kuaizhizao.utils.outsource_work_order_state import (
    apply_outsource_work_order_execution_start,
    apply_outsource_work_order_receipt_completion,
    resolve_outsource_work_order_product_unit,
    resolve_outsource_work_order_received_delta,
)


def resolve_outsource_material_receipt_amount(
    *,
    unit_price: Optional[Decimal],
    qualified_quantity: Decimal,
    quantity: Decimal,
) -> tuple[Decimal, Decimal]:
    """委外收货金额真源：合格数量优先，否则收货数量 × 委外工单单价。"""
    unit_price_dec = Decimal(str(unit_price or 0))
    receipt_qty = qualified_quantity if qualified_quantity > 0 else quantity
    total_amount = (receipt_qty * unit_price_dec).quantize(Decimal("0.01"))
    return unit_price_dec, total_amount


async def enrich_outsource_docs_with_supplier(
    tenant_id: int,
    docs: List[Any],
    responses: List[Any],
) -> List[Any]:
    """
    为委外收货/退料/退货补齐委外工单上下文（供应商、委外产品编码/名称、列表明细预览）。

    列表「明细」真源：
    - 退料：单据自身 material_name（行快照）
    - 收货/退货：无行表，产品名在委外工单 product_name（勿读单据上不存在的 material_name）
    """
    if not docs or not responses:
        return responses

    owo_ids = {
        int(getattr(doc, "outsource_work_order_id", 0) or 0)
        for doc in docs
        if getattr(doc, "outsource_work_order_id", None)
    }
    owo_ids.discard(0)
    if not owo_ids:
        return responses

    work_orders = await OutsourceWorkOrder.filter(
        tenant_id=tenant_id,
        id__in=list(owo_ids),
        deleted_at__isnull=True,
    ).all()
    context_by_owo: Dict[int, Dict[str, Any]] = {}
    for owo in work_orders:
        ctx: Dict[str, Any] = {}
        product_code = str(getattr(owo, "product_code", None) or "").strip()
        product_name = str(getattr(owo, "product_name", None) or "").strip()
        if product_code:
            ctx["product_code"] = product_code
        if product_name:
            ctx["product_name"] = product_name
        supplier_name = str(getattr(owo, "supplier_name", None) or "").strip()
        if supplier_name:
            ctx["supplier_id"] = getattr(owo, "supplier_id", None)
            ctx["supplier_code"] = getattr(owo, "supplier_code", None)
            ctx["supplier_name"] = supplier_name
        if ctx:
            context_by_owo[int(owo.id)] = ctx

    enriched: List[Any] = []
    for doc, resp in zip(docs, responses):
        owo_id = int(getattr(doc, "outsource_work_order_id", 0) or 0)
        update: Dict[str, Any] = dict(context_by_owo.get(owo_id) or {})
        existing_items = getattr(resp, "items", None)
        if not existing_items:
            doc_material_name = str(getattr(doc, "material_name", None) or "").strip()
            wo_product_name = str(update.get("product_name") or "").strip()
            preview_name = doc_material_name or wo_product_name
            if preview_name:
                update["items"] = [{"material_name": preview_name}]
        if not update:
            enriched.append(resp)
            continue
        if hasattr(resp, "model_copy"):
            enriched.append(resp.model_copy(update=update))
        else:
            enriched.append(resp)
    return enriched


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
        """委外收货预览：委外数量 / 已收（合格）/ 待收。"""
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
        product_unit = await resolve_outsource_work_order_product_unit(tenant_id, owo)
        lines: List[OutsourceMaterialReceiptPreviewLine] = []
        if pending > 0:
            lines.append(
                OutsourceMaterialReceiptPreviewLine(
                    product_id=int(owo.product_id or 0),
                    product_code=str(owo.product_code or ""),
                    product_name=str(owo.product_name or ""),
                    unit=product_unit,
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

    async def _generate_outsource_receipt_code(self, tenant_id: int) -> str:
        today = today_site_str()
        existing_codes = await OutsourceMaterialReceipt.filter(
            tenant_id=tenant_id,
            code__startswith=f"OWR-{today}",
            deleted_at__isnull=True,
        ).order_by("-code").limit(1).values_list("code", flat=True)
        if existing_codes:
            last_code = existing_codes[0]
            last_seq = int(last_code.split("-")[-1]) if last_code.split("-")[-1].isdigit() else 0
            seq = last_seq + 1
        else:
            seq = 1
        return f"OWR-{today}-{seq:04d}"

    @staticmethod
    def _collect_exception_text(exc: BaseException) -> str:
        parts: list[str] = []
        seen: set[int] = set()
        current: BaseException | None = exc
        while current is not None and id(current) not in seen:
            seen.add(id(current))
            parts.append(str(current))
            current = current.__cause__ or current.__context__
        return " ".join(parts).lower()

    @classmethod
    def _is_row_lock_unavailable(cls, exc: BaseException) -> bool:
        msg = cls._collect_exception_text(exc)
        return (
            "could not obtain lock" in msg
            or "lock timeout" in msg
            or "55p03" in msg
            or "locknotavailable" in msg
            or "apps_kuaizhizao_outsource_work_orders" in msg
        )

    _OUTSOURCE_WO_LOCK_BUSY_MSG = (
        "委外工单正被其他未提交的数据库事务占用（通常是历史卡住的发料/入库请求）。"
        "请稍后重试；若仍失败，请让管理员在 PostgreSQL 执行："
        "SELECT pg_terminate_backend(pid) FROM pg_stat_activity "
        "WHERE datname = current_database() AND state = 'idle in transaction' AND pid <> pg_backend_pid();"
    )

    async def _acquire_outsource_work_order_row_lock(
        self,
        *,
        tenant_id: int,
        outsource_work_order_id: int,
    ) -> OutsourceWorkOrder:
        conn = Tortoise.get_connection("default")
        await conn.execute_query("SET LOCAL lock_timeout = '8000'")
        locked_work_order = await OutsourceWorkOrder.filter(
            tenant_id=tenant_id,
            id=outsource_work_order_id,
            deleted_at__isnull=True,
        ).select_for_update().first()
        if not locked_work_order:
            raise NotFoundError(f"委外工单ID {outsource_work_order_id} 不存在")
        return locked_work_order

    async def create_material_receipt(
        self,
        tenant_id: int,
        receipt_data: OutsourceMaterialReceiptCreate,
        created_by: int,
        *,
        created_by_name: Optional[str] = None,
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
        outsource_work_order = await OutsourceWorkOrder.filter(
            tenant_id=tenant_id,
            id=receipt_data.outsource_work_order_id,
            deleted_at__isnull=True,
        ).first()
        if not outsource_work_order:
            raise NotFoundError(f"委外工单ID {receipt_data.outsource_work_order_id} 不存在")

        from apps.kuaizhizao.services.document_action_policy.outsource_work_order import (
            assert_outsource_work_order_capability,
        )

        assert_outsource_work_order_capability(outsource_work_order, "push_outsource_receipt")

        if receipt_data.quantity <= 0:
            raise ValidationError("收货数量必须大于 0")

        product_id = outsource_work_order.product_id
        if product_id and not receipt_data.warehouse_id:
            raise ValidationError("请选择入库仓库")

        if receipt_data.code:
            existing = await OutsourceMaterialReceipt.filter(
                tenant_id=tenant_id,
                code=receipt_data.code,
                deleted_at__isnull=True,
            ).first()
            if existing:
                raise ValidationError(f"委外收货单编码 {receipt_data.code} 已存在")

        receiver_name = (created_by_name or "").strip()
        if not receiver_name:
            user_info = await self.get_user_info(created_by)
            receiver_name = user_info["name"]

        stock_payload: Optional[Dict[str, Any]] = None
        payable_payload: Optional[Dict[str, Any]] = None
        response: Optional[OutsourceMaterialReceiptResponse] = None
        try:
            async with in_transaction():
                locked_work_order = await self._acquire_outsource_work_order_row_lock(
                    tenant_id=tenant_id,
                    outsource_work_order_id=receipt_data.outsource_work_order_id,
                )

                ordered_qty = Decimal(str(locked_work_order.quantity or 0))
                received_qty = Decimal(str(locked_work_order.received_quantity or 0))
                pending_qty = max(Decimal("0"), ordered_qty - received_qty)
                qualified_delta = resolve_outsource_work_order_received_delta(
                    receipt_data.qualified_quantity,
                )
                if qualified_delta > pending_qty:
                    raise ValidationError(
                        f"合格数量 {qualified_delta} 不能超过待收数量 {pending_qty}"
                    )

                code = receipt_data.code or await self._generate_outsource_receipt_code(tenant_id)
                now = resolve_business_datetime()
                unit_price, total_amount = resolve_outsource_material_receipt_amount(
                    unit_price=locked_work_order.unit_price,
                    qualified_quantity=receipt_data.qualified_quantity,
                    quantity=receipt_data.quantity,
                )
                material_receipt = await OutsourceMaterialReceipt.create(
                    tenant_id=tenant_id,
                    uuid=str(uuid.uuid4()),
                    code=code,
                    outsource_work_order_id=receipt_data.outsource_work_order_id,
                    outsource_work_order_code=receipt_data.outsource_work_order_code,
                    quantity=receipt_data.quantity,
                    qualified_quantity=receipt_data.qualified_quantity,
                    unqualified_quantity=receipt_data.unqualified_quantity,
                    process_waste_qty=receipt_data.process_waste_qty,
                    material_waste_qty=receipt_data.material_waste_qty,
                    nonconformance_reason=receipt_data.nonconformance_reason,
                    unit=receipt_data.unit,
                    unit_price=unit_price,
                    total_amount=total_amount,
                    warehouse_id=receipt_data.warehouse_id,
                    warehouse_name=receipt_data.warehouse_name,
                    location_id=receipt_data.location_id,
                    location_name=receipt_data.location_name,
                    batch_number=receipt_data.batch_number,
                    status="completed",
                    received_at=now,
                    received_by=created_by,
                    received_by_name=receiver_name,
                    remarks=receipt_data.remarks,
                    created_by=created_by,
                    created_by_name=receiver_name,
                )

                locked_work_order.received_quantity = (
                    (locked_work_order.received_quantity or Decimal("0")) + qualified_delta
                )
                locked_work_order.qualified_quantity = (
                    (locked_work_order.qualified_quantity or Decimal("0")) + receipt_data.qualified_quantity
                )
                locked_work_order.unqualified_quantity = (
                    (locked_work_order.unqualified_quantity or Decimal("0")) + receipt_data.unqualified_quantity
                )

                apply_outsource_work_order_execution_start(locked_work_order, now=now)
                apply_outsource_work_order_receipt_completion(locked_work_order, now=now)

                await locked_work_order.save()

                logger.info(f"创建委外收货单成功: {code}")

                await material_receipt.refresh_from_db()
                response = OutsourceMaterialReceiptResponse.model_validate(material_receipt)
                if product_id:
                    stock_payload = {
                        "tenant_id": tenant_id,
                        "material_id": int(product_id),
                        "quantity": receipt_data.qualified_quantity or receipt_data.quantity,
                        "warehouse_id": receipt_data.warehouse_id,
                        "batch_no": getattr(receipt_data, "batch_number", None),
                        "source_type": "outsource_material_receipt",
                        "source_doc_id": material_receipt.id,
                        "source_doc_code": code,
                        "ledger_production_date": to_site_date(now),
                        "operator_id": created_by,
                        "operator_name": receiver_name,
                    }
                payable_payload = {
                    "tenant_id": tenant_id,
                    "receipt_id": int(material_receipt.id),
                    "outsource_work_order_id": int(locked_work_order.id),
                    "created_by": created_by,
                    "qualified_quantity": receipt_data.qualified_quantity,
                    "quantity": receipt_data.quantity,
                }
        except Exception as exc:
            if self._is_row_lock_unavailable(exc):
                raise BusinessLogicError(self._OUTSOURCE_WO_LOCK_BUSY_MSG) from exc
            raise

        self._schedule_stock_for_outsource_receipt(stock_payload)
        if payable_payload:
            self._schedule_auto_payable_for_outsource_receipt(**payable_payload)
        if response is None:
            raise BusinessLogicError("委外收货创建失败")
        return response

    def _schedule_stock_for_outsource_receipt(self, payload: Optional[Dict[str, Any]]) -> None:
        """库存入库异步执行，避免阻塞 HTTP 响应或占满连接池。"""
        if not payload:
            return

        async def _run() -> None:
            from apps.kuaizhizao.services.inventory_service import InventoryService

            try:
                await InventoryService.increase_stock(
                    tenant_id=int(payload["tenant_id"]),
                    material_id=int(payload["material_id"]),
                    quantity=payload["quantity"],
                    warehouse_id=payload["warehouse_id"],
                    batch_no=payload["batch_no"],
                    source_type=payload["source_type"],
                    source_doc_id=payload["source_doc_id"],
                    source_doc_code=payload["source_doc_code"],
                    ledger_production_date=payload["ledger_production_date"],
                    movement_type="outsource_receipt",
                    to_warehouse_id=payload["warehouse_id"],
                    operator_id=payload.get("operator_id"),
                    operator_name=payload.get("operator_name"),
                    idempotency_key=(
                        f"outsource_material_receipt:{payload['source_doc_id']}:inc"
                    ),
                )
            except Exception as exc:
                logger.error(
                    "委外收货异步入库失败 doc=%s id=%s: %s",
                    payload.get("source_doc_code"),
                    payload.get("source_doc_id"),
                    exc,
                )

        try:
            loop = asyncio.get_running_loop()
        except RuntimeError:
            return
        loop.create_task(
            _run(),
            name=f"outsource-receipt-stock-{payload.get('source_doc_id')}",
        )

    def _schedule_auto_payable_for_outsource_receipt(
        self,
        *,
        tenant_id: int,
        receipt_id: int,
        outsource_work_order_id: int,
        created_by: int,
        qualified_quantity: Decimal,
        quantity: Decimal,
    ) -> None:
        """应付单生成不阻塞收货 API 响应。"""

        async def _run() -> None:
            try:
                material_receipt = await OutsourceMaterialReceipt.filter(
                    tenant_id=tenant_id,
                    id=receipt_id,
                    deleted_at__isnull=True,
                ).first()
                outsource_work_order = await OutsourceWorkOrder.filter(
                    tenant_id=tenant_id,
                    id=outsource_work_order_id,
                    deleted_at__isnull=True,
                ).first()
                if not material_receipt or not outsource_work_order:
                    return
                receipt_data = OutsourceMaterialReceiptCreate(
                    outsource_work_order_id=outsource_work_order_id,
                    outsource_work_order_code=str(outsource_work_order.code or ""),
                    quantity=quantity,
                    qualified_quantity=qualified_quantity,
                    unqualified_quantity=Decimal("0"),
                    unit=str(material_receipt.unit or "件"),
                    warehouse_id=material_receipt.warehouse_id,
                    warehouse_name=material_receipt.warehouse_name,
                )
                await self._maybe_auto_create_payable_for_outsource_receipt(
                    tenant_id=tenant_id,
                    material_receipt=material_receipt,
                    outsource_work_order=outsource_work_order,
                    receipt_data=receipt_data,
                    created_by=created_by,
                )
            except Exception as exc:
                logger.warning("委外收货异步生成应付单失败 receipt_id=%s: %s", receipt_id, exc)

        try:
            loop = asyncio.get_running_loop()
        except RuntimeError:
            return
        loop.create_task(_run(), name=f"outsource-receipt-payable-{receipt_id}")

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

        total_amount = Decimal(str(material_receipt.total_amount or 0))
        if total_amount <= 0:
            return

        try:
            from apps.kuaicaiwu.services.finance_due_date import resolve_partner_due_date

            payable_service = PayableService()
            biz_date = to_site_date(resolve_business_datetime())
            due_date = await resolve_partner_due_date(
                tenant_id, "supplier", int(outsource_work_order.supplier_id), biz_date
            )
            payable_data = PayableCreate(
                source_type=PAYABLE_SOURCE_OUTSOURCE_RECEIPT,
                source_id=material_receipt.id,
                source_code=material_receipt.code,
                supplier_id=outsource_work_order.supplier_id,
                supplier_name=outsource_work_order.supplier_name,
                total_amount=float(total_amount),
                paid_amount=0.0,
                remaining_amount=float(total_amount),
                due_date=due_date,
                business_date=biz_date,
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
                receipt.received_at = receipt.created_at or resolve_business_datetime()
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
        # 收货单无 material_name 字段；明细预览由 enrich_outsource_docs_with_supplier
        # 从委外工单 product_name 写入 items（勿对 ORM 读不存在的字段再塞空列表）。
        responses = enrich_inbound_hub_list_capabilities(
            receipts,
            responses,
            "outsource_receipt",
            item_counts={int(r.id): 1 for r in receipts},
        )
        return await enrich_outsource_docs_with_supplier(tenant_id, receipts, responses)

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

        resp = OutsourceMaterialReceiptResponse.model_validate(receipt)
        enriched = await enrich_outsource_docs_with_supplier(tenant_id, [receipt], [resp])
        return enriched[0]

    async def complete_material_receipt(
        self,
        tenant_id: int,
        receipt_id: int,
        completed_by: int,
        confirmation_data: Optional[InboundConfirmationRequest] = None,
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

        if receipt.status == "completed":
            await receipt.refresh_from_db()
            return OutsourceMaterialReceiptResponse.model_validate(receipt)

        assert_inbound_hub_capability(receipt, "confirm", receipt_type="outsource_receipt")

        from apps.kuaizhizao.utils.inbound_confirm_helper import resolve_inbound_confirm_receiver

        confirmer_name = (await self.get_user_info(completed_by))["name"]
        receiver_id, receiver_name = await resolve_inbound_confirm_receiver(
            confirmed_by=completed_by,
            confirmation_data=confirmation_data,
            get_user_name=self.get_user_name,
        )

        # 更新状态
        receipt.status = "completed"
        receipt.received_at = resolve_business_datetime()
        receipt.received_by = receiver_id
        receipt.received_by_name = receiver_name
        receipt.updated_by = completed_by
        receipt.updated_by_name = confirmer_name
        await receipt.save()

        logger.info(f"完成委外收货单: {receipt.code}")

        await receipt.refresh_from_db()
        return OutsourceMaterialReceiptResponse.model_validate(receipt)
