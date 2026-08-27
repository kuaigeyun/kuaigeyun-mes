"""
半成品入库单服务（与成品入库单流程一致，库存来源类型与单据追溯类型独立）。
"""

from __future__ import annotations

import json
import uuid
from datetime import datetime
from decimal import Decimal
from typing import List, Optional, Tuple

from loguru import logger
from tortoise.transactions import in_transaction

from core.utils.timezone_utils import resolve_business_datetime, to_site_date, today_site_str

from apps.common.base_service import AppBaseService
from apps.kuaizhizao.models.semi_finished_goods_receipt import SemiFinishedGoodsReceipt
from apps.kuaizhizao.models.semi_finished_goods_receipt_item import SemiFinishedGoodsReceiptItem
from apps.kuaizhizao.models.work_order import WorkOrder
from apps.kuaizhizao.utils.material_unit_utils import convert_to_base_quantity
from apps.kuaizhizao.schemas.warehouse import (
    SemiFinishedGoodsReceiptCreate,
    SemiFinishedGoodsReceiptItemCreate,
    SemiFinishedGoodsReceiptResponse,
    SemiFinishedGoodsReceiptWithItemsResponse,
    SemiFinishedGoodsReceiptItemResponse,
    InboundConfirmationRequest,
)
from apps.kuaizhizao.services.warehouse_service import (
    _get_warehouse_policy_flags,
    _resolve_warehouse_name_by_id,
    _validate_location_if_required,
)
from infra.exceptions.exceptions import NotFoundError, ValidationError, BusinessLogicError


class SemiFinishedGoodsReceiptService(AppBaseService[SemiFinishedGoodsReceipt]):
    """半成品入库单服务"""

    def __init__(self):
        super().__init__(SemiFinishedGoodsReceipt)

    async def resolve_default_inbound_warehouse_for_work_order(
        self,
        tenant_id: int,
        work_order: WorkOrder,
    ) -> Optional[Tuple[int, str]]:
        from apps.kuaizhizao.services.warehouse_service import FinishedGoodsReceiptService

        return await FinishedGoodsReceiptService().resolve_default_inbound_warehouse_for_work_order(
            tenant_id,
            work_order,
        )

    async def create_semi_finished_goods_receipt(
        self,
        tenant_id: int,
        receipt_data: SemiFinishedGoodsReceiptCreate,
        created_by: int,
        items: Optional[List[SemiFinishedGoodsReceiptItemCreate]] = None,
    ) -> SemiFinishedGoodsReceiptResponse:
        async with in_transaction():
            user_info = await self.get_user_info(created_by)
            if receipt_data.receipt_code:
                code = receipt_data.receipt_code
            else:
                today = today_site_str()
                code = await self.generate_code(
                    tenant_id, "SEMI_FINISHED_GOODS_RECEIPT_CODE", prefix=f"SFR{today}"
                )
            if items is None:
                items = getattr(receipt_data, "items", None) or []
            total_quantity = sum(item.receipt_quantity for item in items) if items else 0

            if receipt_data.work_order_id:
                from apps.kuaizhizao.services.warehouse_service import FinishedGoodsReceiptService

                await FinishedGoodsReceiptService()._assert_work_order_inbound_quantity(
                    tenant_id,
                    int(receipt_data.work_order_id),
                    float(total_quantity or 0),
                )

            receipt = await SemiFinishedGoodsReceipt.create(
                tenant_id=tenant_id,
                uuid=str(uuid.uuid4()),
                receipt_code=code,
                work_order_id=receipt_data.work_order_id,
                work_order_code=receipt_data.work_order_code,
                sales_order_id=receipt_data.sales_order_id,
                sales_order_code=receipt_data.sales_order_code,
                warehouse_id=receipt_data.warehouse_id,
                warehouse_name=receipt_data.warehouse_name,
                receipt_time=(
                    resolve_business_datetime(receipt_data.receipt_time)
                    if receipt_data.receipt_time
                    else None
                ),
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
            )

            if items:
                from apps.master_data.models.material import Material
                from apps.kuaizhizao.services.batch_serial_helper import ensure_batch_no_for_item

                location_required, _ = await _get_warehouse_policy_flags(tenant_id)
                for item_data in items:
                    material = await Material.get_or_none(
                        tenant_id=tenant_id,
                        id=item_data.material_id,
                        deleted_at__isnull=True,
                    )
                    batch_number = getattr(item_data, "batch_number", None)
                    if material:
                        batch_number = await ensure_batch_no_for_item(
                            tenant_id=tenant_id,
                            material=material,
                            item_data=item_data,
                            supplier_code=None,
                        ) or batch_number
                    _validate_location_if_required(
                        location_required=location_required,
                        location_id=getattr(item_data, "location_id", None),
                        location_code=getattr(item_data, "location_code", None),
                        scene="半成品入库",
                        material_label=getattr(item_data, "material_name", None)
                        or getattr(item_data, "material_code", "未知物料"),
                    )
                    await SemiFinishedGoodsReceiptItem.create(
                        tenant_id=tenant_id,
                        receipt_id=receipt.id,
                        material_id=item_data.material_id,
                        material_code=item_data.material_code,
                        material_name=item_data.material_name,
                        material_spec=getattr(item_data, "material_spec", None),
                        material_unit=item_data.material_unit,
                        receipt_quantity=item_data.receipt_quantity,
                        qualified_quantity=item_data.qualified_quantity,
                        unqualified_quantity=item_data.unqualified_quantity,
                        location_id=getattr(item_data, "location_id", None),
                        location_code=getattr(item_data, "location_code", None),
                        batch_number=batch_number,
                        expiry_date=getattr(item_data, "expiry_date", None),
                        quality_status=getattr(item_data, "quality_status", "合格"),
                        quality_inspection_id=getattr(item_data, "quality_inspection_id", None),
                        status=getattr(item_data, "status", "待入库"),
                        receipt_time=getattr(item_data, "receipt_time", None),
                        notes=getattr(item_data, "notes", None),
                    )

            work_order_id = getattr(receipt, "work_order_id", None) or getattr(
                receipt_data, "work_order_id", None
            )
            if work_order_id:
                try:
                    from apps.kuaizhizao.services.document_relation_new_service import (
                        DocumentRelationNewService,
                    )
                    from apps.kuaizhizao.schemas.document_relation import DocumentRelationCreate

                    wo = await WorkOrder.get_or_none(
                        tenant_id=tenant_id, id=work_order_id, deleted_at__isnull=True
                    )
                    if wo:
                        rel_svc = DocumentRelationNewService()
                        await rel_svc.create_relation(
                            tenant_id=tenant_id,
                            relation_data=DocumentRelationCreate(
                                source_type="work_order",
                                source_id=work_order_id,
                                source_code=wo.code,
                                source_name=wo.name,
                                target_type="semi_finished_goods_receipt",
                                target_id=receipt.id,
                                target_code=receipt.receipt_code,
                                target_name=None,
                                relation_type="source",
                                relation_mode="push",
                                relation_desc="工单创建半成品入库单",
                            ),
                            created_by=created_by,
                        )
                except Exception as e:
                    logger.warning("建立工单→半成品入库 单据关联失败: %s", e)

            return SemiFinishedGoodsReceiptResponse.model_validate(receipt)

    async def get_semi_finished_goods_receipt_by_id(
        self, tenant_id: int, receipt_id: int
    ) -> SemiFinishedGoodsReceiptWithItemsResponse:
        receipt = await SemiFinishedGoodsReceipt.get_or_none(tenant_id=tenant_id, id=receipt_id)
        if not receipt:
            raise NotFoundError(f"半成品入库单不存在: {receipt_id}")
        items = await SemiFinishedGoodsReceiptItem.filter(
            tenant_id=tenant_id, receipt_id=receipt_id
        ).all()
        resp = SemiFinishedGoodsReceiptWithItemsResponse.model_validate(receipt)
        resp.items = [SemiFinishedGoodsReceiptItemResponse.model_validate(i) for i in items]
        return resp

    async def list_semi_finished_goods_receipts(
        self, tenant_id: int, skip: int = 0, limit: int = 20, **filters
    ) -> List[SemiFinishedGoodsReceiptResponse]:
        query = SemiFinishedGoodsReceipt.filter(tenant_id=tenant_id, deleted_at__isnull=True)
        if filters.get("status"):
            query = query.filter(status=filters["status"])
        if filters.get("work_order_id"):
            query = query.filter(work_order_id=filters["work_order_id"])
        receipts = await query.offset(skip).limit(limit).order_by("-created_at")
        from apps.kuaizhizao.services.document_action_policy.enricher import (
            batch_document_item_counts,
            batch_document_item_material_previews,
            enrich_inbound_hub_list_capabilities,
        )
        from apps.kuaizhizao.models.semi_finished_goods_receipt_item import SemiFinishedGoodsReceiptItem

        responses = [SemiFinishedGoodsReceiptResponse.model_validate(r) for r in receipts]
        receipt_ids = [r.id for r in receipts]
        item_counts = await batch_document_item_counts(
            tenant_id, SemiFinishedGoodsReceiptItem, "receipt_id", receipt_ids
        )
        item_previews = await batch_document_item_material_previews(
            tenant_id, SemiFinishedGoodsReceiptItem, "receipt_id", receipt_ids
        )
        responses = enrich_inbound_hub_list_capabilities(
            receipts,
            responses,
            "semi_finished_goods",
            item_counts=item_counts,
            item_previews=item_previews,
        )
        from apps.kuaizhizao.services.warehouse_service import enrich_production_receipts_with_customer

        return await enrich_production_receipts_with_customer(tenant_id, receipts, responses)

    async def confirm_receipt(
        self,
        tenant_id: int,
        receipt_id: int,
        confirmed_by: int,
        confirmation_data: Optional[InboundConfirmationRequest] = None,
    ) -> SemiFinishedGoodsReceiptWithItemsResponse:
        async with in_transaction():
            receipt = await SemiFinishedGoodsReceipt.get_or_none(tenant_id=tenant_id, id=receipt_id)
            if not receipt:
                raise NotFoundError(f"半成品入库单不存在: {receipt_id}")

            from apps.kuaizhizao.services.document_action_policy.warehouse_inbound_hub import (
                assert_inbound_hub_capability,
            )

            assert_inbound_hub_capability(receipt, "confirm", receipt_type="semi_finished_goods")

            if confirmation_data:
                update_dict = {}
                if confirmation_data.warehouse_id:
                    update_dict["warehouse_id"] = confirmation_data.warehouse_id
                    update_dict["warehouse_name"] = await _resolve_warehouse_name_by_id(
                        tenant_id,
                        confirmation_data.warehouse_id,
                        confirmation_data.warehouse_name,
                    )
                if confirmation_data.notes:
                    update_dict["notes"] = confirmation_data.notes
                if update_dict:
                    await SemiFinishedGoodsReceipt.filter(tenant_id=tenant_id, id=receipt_id).update(
                        **update_dict
                    )
                    receipt = await SemiFinishedGoodsReceipt.get(tenant_id=tenant_id, id=receipt_id)
                if confirmation_data.items:
                    for item_data in confirmation_data.items:
                        item_update = {}
                        if item_data.location_id:
                            item_update["location_id"] = item_data.location_id
                            item_update["location_code"] = item_data.location_code or f"库位{item_data.location_id}"
                        if item_data.batch_number:
                            item_update["batch_number"] = item_data.batch_number
                        if item_data.expiry_date:
                            item_update["expiry_date"] = item_data.expiry_date
                        if item_update:
                            await SemiFinishedGoodsReceiptItem.filter(
                                tenant_id=tenant_id, receipt_id=receipt_id, id=item_data.item_id
                            ).update(**item_update)

            from apps.master_data.models.material import Material
            from apps.kuaizhizao.services.batch_serial_helper import (
                ensure_batch_no_for_item,
                ensure_serial_nos_for_item,
            )

            items = await SemiFinishedGoodsReceiptItem.filter(
                tenant_id=tenant_id, receipt_id=receipt_id
            ).all()
            for item in items:
                material = await Material.get_or_none(tenant_id=tenant_id, id=item.material_id)
                if not material:
                    continue
                if material.batch_managed and not item.batch_number:
                    batch_no = await ensure_batch_no_for_item(tenant_id, material, item)
                    if batch_no:
                        item.batch_number = batch_no
                        await item.save()
                if material.serial_managed:
                    count = int(item.receipt_quantity or item.qualified_quantity or 0)
                    existing_serials = []
                    item_serials = getattr(item, "serial_numbers", None)
                    if item_serials:
                        try:
                            existing_serials = json.loads(item_serials)
                        except Exception:
                            pass
                    if len(existing_serials) < count:
                        serial_nos = await ensure_serial_nos_for_item(tenant_id, material, item, count)
                        if serial_nos and hasattr(item, "serial_numbers"):
                            setattr(item, "serial_numbers", json.dumps(serial_nos))
                            await item.save()

            from apps.kuaizhizao.services.inspection_policy_service import assert_fqc_for_finished_goods_receipt

            await assert_fqc_for_finished_goods_receipt(
                tenant_id,
                receipt_id,
                receipt.work_order_id,
                items,
            )

            # 确认未传入库时间时保留建单所选业务时刻，禁止一律写成「此刻」
            confirmer_name = await self.get_user_name(confirmed_by)
            confirm_receipt_time = (
                confirmation_data.receipt_time
                if confirmation_data and confirmation_data.receipt_time
                else None
            )
            receipt_time = resolve_business_datetime(
                confirm_receipt_time or getattr(receipt, "receipt_time", None)
            )
            await SemiFinishedGoodsReceipt.filter(tenant_id=tenant_id, id=receipt_id).update(
                status="已入库",
                receiver_id=confirmed_by,
                receiver_name=confirmer_name,
                receipt_time=receipt_time,
                updated_by=confirmed_by,
            )
            await SemiFinishedGoodsReceiptItem.filter(
                tenant_id=tenant_id, receipt_id=receipt_id
            ).update(status="已入库", receipt_time=receipt_time)

            try:
                from apps.kuaizhizao.services.inventory_service import InventoryService

                items = await SemiFinishedGoodsReceiptItem.filter(
                    tenant_id=tenant_id, receipt_id=receipt_id
                ).all()
                from apps.master_data.models.material import Material

                material_ids = list({int(it.material_id) for it in items if getattr(it, "material_id", None)})
                materials = await Material.filter(
                    tenant_id=tenant_id,
                    id__in=material_ids,
                    deleted_at__isnull=True,
                ).all() if material_ids else []
                material_by_id = {int(m.id): m for m in materials}
                for item in items:
                    qty = item.receipt_quantity or item.qualified_quantity or Decimal(0)
                    if qty <= 0:
                        continue
                    base_qty = convert_to_base_quantity(
                        material_by_id.get(item.material_id),
                        qty,
                        from_unit=getattr(item, "material_unit", None),
                    )
                    wh_id = item.warehouse_id if getattr(item, "warehouse_id", None) else receipt.warehouse_id
                    await InventoryService._increase_stock_no_atomic(
                        tenant_id=tenant_id,
                        material_id=item.material_id,
                        quantity=base_qty,
                        warehouse_id=wh_id,
                        batch_no=item.batch_number or None,
                        source_type="semi_finished_goods_receipt",
                        source_doc_id=receipt_id,
                        source_doc_code=receipt.receipt_code,
                        work_order_id=receipt.work_order_id,
                        work_order_code=receipt.work_order_code,
                        ledger_production_date=to_site_date(receipt_time),
                        ledger_expiry_date=getattr(item, "expiry_date", None),
                        movement_type="semi_fg_receipt",
                        to_warehouse_id=wh_id,
                        idempotency_key=f"semi_finished_goods_receipt:{receipt_id}:inc:{item.id}",
                        quality_status="qualified",
                    operator_id=confirmed_by,
                    operator_name=confirmer_name,
                )
            except Exception as inv_e:
                logger.error("半成品入库确认-更新库存失败: %s", inv_e)
                raise

            return await self.get_semi_finished_goods_receipt_by_id(tenant_id, receipt_id)

    async def withdraw_receipt_confirmation(
        self,
        tenant_id: int,
        receipt_id: int,
        updated_by: int,
    ) -> SemiFinishedGoodsReceiptWithItemsResponse:
        async with in_transaction():
            receipt = await SemiFinishedGoodsReceipt.get_or_none(
                tenant_id=tenant_id, id=receipt_id, deleted_at__isnull=True
            )
            if not receipt:
                raise NotFoundError(f"半成品入库单不存在: {receipt_id}")
            if receipt.status != "已入库":
                raise BusinessLogicError("只有已入库状态的半成品入库单才能撤回入库")
            try:
                from apps.kuaizhizao.services.inventory_service import InventoryService

                items = await SemiFinishedGoodsReceiptItem.filter(
                    tenant_id=tenant_id, receipt_id=receipt_id
                ).all()
                wh_id = receipt.warehouse_id if receipt.warehouse_id else None
                from apps.master_data.models.material import Material

                material_ids = list({int(it.material_id) for it in items if getattr(it, "material_id", None)})
                materials = await Material.filter(
                    tenant_id=tenant_id,
                    id__in=material_ids,
                    deleted_at__isnull=True,
                ).all() if material_ids else []
                material_by_id = {int(m.id): m for m in materials}
                for item in items:
                    qty = item.receipt_quantity or item.qualified_quantity or Decimal(0)
                    if qty <= 0:
                        continue
                    base_qty = convert_to_base_quantity(
                        material_by_id.get(item.material_id),
                        qty,
                        from_unit=getattr(item, "material_unit", None),
                    )
                    await InventoryService._decrease_stock_no_atomic(
                        tenant_id=tenant_id,
                        material_id=item.material_id,
                        quantity=base_qty,
                        warehouse_id=wh_id,
                        batch_no=item.batch_number or None,
                        source_type="semi_finished_goods_receipt_revoke",
                        source_doc_id=receipt_id,
                        source_doc_code=receipt.receipt_code,
                        movement_type="semi_fg_receipt",
                        from_warehouse_id=wh_id,
                        operator_id=updated_by,
                    )
                await SemiFinishedGoodsReceipt.filter(tenant_id=tenant_id, id=receipt_id).update(
                    status="待入库",
                    receiver_id=None,
                    receiver_name=None,
                    receipt_time=None,
                    updated_by=updated_by,
                )
                await SemiFinishedGoodsReceiptItem.filter(
                    tenant_id=tenant_id, receipt_id=receipt_id
                ).update(status="待入库", receipt_time=None)
            except BusinessLogicError:
                raise
            except Exception as e:
                logger.error("撤回半成品入库-库存冲减失败: %s", e)
                raise BusinessLogicError(f"撤回失败: {str(e)}")

            return await self.get_semi_finished_goods_receipt_by_id(tenant_id, receipt_id)

    async def delete_semi_finished_goods_receipt(self, tenant_id: int, receipt_id: int) -> bool:
        deletable_statuses = ("草稿", "draft", "DRAFT", "待入库")
        async with in_transaction():
            receipt = await SemiFinishedGoodsReceipt.get_or_none(
                tenant_id=tenant_id, id=receipt_id, deleted_at__isnull=True
            )
            if not receipt:
                raise NotFoundError(f"半成品入库单不存在: {receipt_id}")
            if receipt.status not in deletable_statuses:
                raise BusinessLogicError(
                    f"仅草稿或待入库状态的半成品入库单可删除，当前状态：{receipt.status}"
                )
            from apps.kuaizhizao.models.document_relation import DocumentRelation

            await DocumentRelation.filter(
                tenant_id=tenant_id,
                target_type="semi_finished_goods_receipt",
                target_id=receipt_id,
            ).delete()
            await DocumentRelation.filter(
                tenant_id=tenant_id,
                source_type="semi_finished_goods_receipt",
                source_id=receipt_id,
            ).delete()
            await SemiFinishedGoodsReceiptItem.filter(tenant_id=tenant_id, receipt_id=receipt_id).delete()
            now = resolve_business_datetime()
            await SemiFinishedGoodsReceipt.filter(tenant_id=tenant_id, id=receipt_id).update(
                deleted_at=now,
                is_active=False,
            )
        return True

    _PENDING_STATUSES = ("待入库", "草稿", "draft", "DRAFT")

    async def sync_pending_semi_finished_goods_receipts_for_work_order(
        self,
        tenant_id: int,
        work_order_id: int,
    ) -> None:
        from apps.kuaizhizao.models.work_order_operation import WorkOrderOperation
        from apps.kuaizhizao.models.reporting_record import ReportingRecord

        work_order = await WorkOrder.get_or_none(
            id=work_order_id, tenant_id=tenant_id, deleted_at__isnull=True
        )
        if not work_order:
            return
        operations = await WorkOrderOperation.filter(
            tenant_id=tenant_id,
            work_order_id=work_order_id,
            deleted_at__isnull=True,
        ).all()
        if not operations:
            return
        last_op = max(operations, key=lambda op: (op.sequence or 0, op.id or 0))
        approved_last = await ReportingRecord.filter(
            tenant_id=tenant_id,
            work_order_id=work_order_id,
            operation_id=last_op.operation_id,
            status="approved",
            deleted_at__isnull=True,
        ).all()
        target_qty = sum(
            (Decimal(str(r.qualified_quantity or 0)) for r in approved_last),
            start=Decimal("0"),
        )
        receipts = await SemiFinishedGoodsReceipt.filter(
            tenant_id=tenant_id,
            work_order_id=work_order_id,
            deleted_at__isnull=True,
            status__in=self._PENDING_STATUSES,
        ).all()
        if not receipts:
            return
        product_id = work_order.product_id
        for receipt in receipts:
            if receipt.status not in self._PENDING_STATUSES:
                continue
            if target_qty <= 0:
                try:
                    await self.delete_semi_finished_goods_receipt(tenant_id, receipt.id)
                    logger.info(
                        "末道报工合格数为 0，已删除待入库半成品入库单 receipt_id=%s work_order_id=%s",
                        receipt.id,
                        work_order_id,
                    )
                except BusinessLogicError as e:
                    logger.warning(
                        "末道报工合格数为 0，但无法删除半成品入库单 receipt_id=%s：%s",
                        receipt.id,
                        e,
                    )
                continue
            items = await SemiFinishedGoodsReceiptItem.filter(
                tenant_id=tenant_id,
                receipt_id=receipt.id,
            ).all()
            if not items:
                continue
            product_lines = [it for it in items if int(it.material_id) == int(product_id)]
            if len(product_lines) == 1:
                primary = product_lines[0]
            elif len(items) == 1:
                primary = items[0]
            else:
                logger.warning(
                    "半成品入库单 receipt_id=%s 明细行数=%s 且无法唯一匹配工单成品，跳过报工联动同步",
                    receipt.id,
                    len(items),
                )
                continue
            others_sum = sum(
                (Decimal(str(it.receipt_quantity or 0)) for it in items if it.id != primary.id),
                start=Decimal("0"),
            )
            new_total = target_qty + others_sum
            await SemiFinishedGoodsReceiptItem.filter(tenant_id=tenant_id, id=primary.id).update(
                receipt_quantity=target_qty,
                qualified_quantity=target_qty,
            )
            await SemiFinishedGoodsReceipt.filter(tenant_id=tenant_id, id=receipt.id).update(
                total_quantity=new_total
            )
            logger.info(
                "已同步待入库半成品入库单 receipt_id=%s work_order_id=%s total=%s 主行合格=%s",
                receipt.id,
                work_order_id,
                new_total,
                target_qty,
            )

    async def get_work_order_inbound_preview(
        self,
        tenant_id: int,
        work_order_id: int,
    ):
        from apps.kuaizhizao.models.work_order import WorkOrder
        from apps.kuaizhizao.schemas.warehouse import InboundCreatePreviewLine, WorkOrderInboundPreviewResponse
        from apps.kuaizhizao.services.warehouse_service import FinishedGoodsReceiptService
        from apps.master_data.models.material import Material

        work_order = await WorkOrder.get_or_none(tenant_id=tenant_id, id=work_order_id)
        if not work_order:
            raise NotFoundError(f"工单不存在: {work_order_id}")
        if work_order.status not in ("in_progress", "completed", "进行中", "已完成"):
            raise BusinessLogicError(f"工单状态为 {work_order.status}，无法预览入库明细")

        fg_svc = FinishedGoodsReceiptService()
        planned = float(work_order.quantity or 0)
        quota = await fg_svc._get_work_order_inbound_quota(tenant_id, work_order_id)
        received = quota["received"]
        pending = quota["pending"]
        suggested = await fg_svc._resolve_work_order_suggested_receipt_quantity(
            tenant_id, work_order_id, strict=False
        )
        receipt_qty = min(suggested, pending) if pending > 0 else 0.0
        hint = None
        if pending <= 0:
            hint = "工单可入库数量已用尽，无法再取单入库"
        elif suggested <= 0:
            hint = "暂无质检合格或末道已审报工数量，请手工填写入库数量"

        material = await Material.get_or_none(
            tenant_id=tenant_id,
            id=work_order.product_id,
            deleted_at__isnull=True,
        )
        material_unit = (getattr(material, "base_unit", None) or "个") if material else "个"
        line = InboundCreatePreviewLine(
            material_id=int(work_order.product_id),
            material_code=(getattr(material, "main_code", None) or getattr(material, "code", None) or work_order.product_code or ""),
            material_name=(getattr(material, "name", None) or work_order.product_name or ""),
            material_spec=getattr(material, "specification", None) or getattr(work_order, "product_spec", None),
            material_unit=material_unit,
            source_doc_quantity=planned,
            source_received_quantity=received,
            source_pending_quantity=pending,
            receipt_quantity=receipt_qty,
        )
        return WorkOrderInboundPreviewResponse(
            work_order_id=work_order_id,
            work_order_code=work_order.code or str(work_order_id),
            inbound_doc_kind="semi_finished_goods",
            lines=[line],
            message=hint,
        )

    async def quick_receipt_from_work_order(
        self,
        tenant_id: int,
        work_order_id: int,
        created_by: int,
        warehouse_id: Optional[int] = None,
        warehouse_name: Optional[str] = None,
        receipt_quantity: Optional[float] = None,
        receipt_code: Optional[str] = None,
    ) -> SemiFinishedGoodsReceiptResponse:
        from apps.kuaizhizao.models.reporting_record import ReportingRecord
        from apps.kuaizhizao.models.finished_goods_inspection import FinishedGoodsInspection
        from apps.kuaizhizao.models.work_order_operation import WorkOrderOperation

        async with in_transaction():
            work_order = await WorkOrder.get_or_none(tenant_id=tenant_id, id=work_order_id)
            if not work_order:
                raise NotFoundError(f"工单不存在: {work_order_id}")
            if work_order.status not in ("in_progress", "completed", "进行中", "已完成"):
                raise BusinessLogicError(f"工单状态为 {work_order.status}，无法创建入库单")

            if receipt_quantity is None:
                qc_records = await FinishedGoodsInspection.filter(
                    tenant_id=tenant_id,
                    work_order_id=work_order_id,
                    quality_status="合格",
                ).all()
                if qc_records:
                    total_qc_qualified = sum(float(qc.qualified_quantity or 0) for qc in qc_records)
                    if total_qc_qualified > 0:
                        receipt_quantity = total_qc_qualified
                        logger.info(f"工单一键半成品入库：自动从成品检验单获取合格数量 {receipt_quantity}")
                if receipt_quantity is None:
                    operations = await WorkOrderOperation.filter(
                        tenant_id=tenant_id,
                        work_order_id=work_order_id,
                        deleted_at__isnull=True,
                    ).all()
                    if not operations:
                        raise ValidationError("工单无工序记录，无法自动获取入库数量")
                    last_op = max(operations, key=lambda op: (op.sequence or 0, op.id or 0))
                    lo_q = float(last_op.qualified_quantity or 0)
                    if lo_q > 0:
                        receipt_quantity = lo_q
                    else:
                        reporting_records = await ReportingRecord.filter(
                            tenant_id=tenant_id,
                            work_order_id=work_order_id,
                            operation_id=last_op.operation_id,
                            status="approved",
                            deleted_at__isnull=True,
                        ).all()
                        if not reporting_records:
                            raise ValidationError(
                                "工单没有质检合格记录，且末道工序无已审核报工记录，无法自动获取入库数量"
                            )
                        total_qualified = sum(
                            float(record.qualified_quantity or 0) for record in reporting_records
                        )
                        if total_qualified <= 0:
                            raise ValidationError("末道工序报工合格数量为0，无法创建入库单")
                        receipt_quantity = total_qualified
            else:
                receipt_quantity = float(receipt_quantity)

            from apps.kuaizhizao.services.warehouse_service import FinishedGoodsReceiptService

            await FinishedGoodsReceiptService()._assert_work_order_inbound_quantity(
                tenant_id,
                work_order_id,
                receipt_quantity,
            )

            if not warehouse_id:
                resolved = await self.resolve_default_inbound_warehouse_for_work_order(
                    tenant_id=tenant_id,
                    work_order=work_order,
                )
                if not resolved:
                    raise ValidationError(
                        "请指定入库仓库，或在主数据中维护与工单工作中心/车间关联的启用仓库"
                    )
                warehouse_id, warehouse_name = resolved[0], resolved[1]

            if receipt_code:
                code = receipt_code
            else:
                today = today_site_str()
                code = await self.generate_code(
                    tenant_id, "SEMI_FINISHED_GOODS_RECEIPT_CODE", prefix=f"SF{today}"
                )
            receipt = await SemiFinishedGoodsReceipt.create(
                tenant_id=tenant_id,
                receipt_code=code,
                work_order_id=work_order_id,
                work_order_code=work_order.code,
                sales_order_id=work_order.sales_order_id,
                sales_order_code=work_order.sales_order_code,
                warehouse_id=warehouse_id,
                warehouse_name=warehouse_name or "",
                status="待入库",
                total_quantity=Decimal(str(receipt_quantity)),
                created_by=created_by,
                updated_by=created_by,
            )
            from apps.master_data.models.material import Material
            from apps.kuaizhizao.services.batch_serial_helper import ensure_batch_no_for_item

            batch_number = None
            material = await Material.get_or_none(
                tenant_id=tenant_id,
                id=work_order.product_id,
                deleted_at__isnull=True,
            )
            if material:

                class _ItemData:
                    batch_number = None

                batch_number = await ensure_batch_no_for_item(
                    tenant_id=tenant_id,
                    material=material,
                    item_data=_ItemData(),
                    supplier_code=None,
                )
            material_unit = (getattr(material, "base_unit", None) or "个") if material else "个"
            await SemiFinishedGoodsReceiptItem.create(
                tenant_id=tenant_id,
                receipt_id=receipt.id,
                material_id=work_order.product_id,
                material_code=work_order.product_code,
                material_name=work_order.product_name,
                material_unit=material_unit,
                receipt_quantity=Decimal(str(receipt_quantity)),
                qualified_quantity=Decimal(str(receipt_quantity)),
                unqualified_quantity=Decimal("0"),
                batch_number=batch_number,
                status="待入库",
            )
            try:
                from apps.kuaizhizao.services.document_relation_new_service import (
                    DocumentRelationNewService,
                )
                from apps.kuaizhizao.schemas.document_relation import DocumentRelationCreate

                rel_svc = DocumentRelationNewService()
                await rel_svc.create_relation(
                    tenant_id=tenant_id,
                    relation_data=DocumentRelationCreate(
                        source_type="work_order",
                        source_id=work_order_id,
                        source_code=work_order.code,
                        source_name=work_order.name,
                        target_type="semi_finished_goods_receipt",
                        target_id=receipt.id,
                        target_code=receipt.receipt_code,
                        target_name=None,
                        relation_type="source",
                        relation_mode="push",
                        relation_desc="工单一键入库创建半成品入库单",
                    ),
                    created_by=created_by,
                )
            except Exception as e:
                logger.warning("建立工单→半成品入库 单据关联失败: %s", e)

            return SemiFinishedGoodsReceiptResponse.model_validate(receipt)
