"""采购到货延期填报服务"""

from __future__ import annotations

from datetime import date
from decimal import Decimal
from typing import List, Optional

from tortoise.transactions import in_transaction

from apps.common.base_service import AppBaseService
from apps.kuaizhizao.constants import DocumentStatus, ReviewStatus
from apps.kuaizhizao.constants.order_change import OrderChangeApplyStatus, OrderChangeCategory, OrderChangeLineType
from apps.kuaizhizao.models.purchase_arrival_delay_report import PurchaseArrivalDelayReport
from apps.kuaizhizao.models.purchase_order import PurchaseOrder, PurchaseOrderItem
from apps.kuaizhizao.models.purchase_order_change_order import PurchaseOrderChangeOrder, PurchaseOrderChangeItem
from apps.kuaizhizao.schemas.purchase_arrival import (
    ApproveDelayReportRequest,
    PurchaseArrivalDelayReportCreate,
    PurchaseArrivalDelayReportResponse,
    PurchaseArrivalDelayReportUpdate,
)
from apps.kuaizhizao.services.order_change.helpers import infer_change_category, line_amount
from apps.kuaizhizao.services.purchase_po_line_impact_service import PurchasePoLineImpactService
from apps.kuaizhizao.services.purchase_order_change_service import PurchaseOrderChangeService
from core.utils.timezone_utils import resolve_business_datetime
from infra.exceptions.exceptions import BusinessLogicError, NotFoundError, ValidationError
from infra.services.business_config_service import BusinessConfigService


class PurchaseArrivalDelayService(AppBaseService[PurchaseArrivalDelayReport]):
    DELAY_REASON_LABELS = {
        "supplier_capacity": "供应商产能",
        "logistics": "物流运输",
        "quality_rework": "质量返工",
        "drawing_change": "图纸变更",
        "payment_delay": "付款延误",
        "other": "其他",
    }

    def __init__(self):
        super().__init__(PurchaseArrivalDelayReport)
        self.business_config_service = BusinessConfigService()
        self.change_service = PurchaseOrderChangeService()

    async def _generate_report_code(self, tenant_id: int) -> str:
        return await self.generate_code(tenant_id, "PURCHASE_ARRIVAL_DELAY_CODE", prefix="PAD")

    async def _require_change_confirm(self, tenant_id: int) -> bool:
        cfg = await self.business_config_service.get_business_config(tenant_id)
        return bool(
            cfg.get("parameters", {})
            .get("procurement", {})
            .get("require_purchase_order_change_confirm", False)
        )

    async def _load_po_line(self, tenant_id: int, item_id: int) -> tuple[PurchaseOrder, PurchaseOrderItem]:
        item = await PurchaseOrderItem.get_or_none(
            tenant_id=tenant_id, id=item_id, deleted_at__isnull=True
        )
        if not item:
            raise NotFoundError(f"采购订单明细不存在: {item_id}")
        order = await PurchaseOrder.get_or_none(
            tenant_id=tenant_id, id=item.order_id, deleted_at__isnull=True
        )
        if not order:
            raise NotFoundError("采购订单不存在")
        return order, item

    async def _active_delay_for_item(
        self, tenant_id: int, item_id: int
    ) -> Optional[PurchaseArrivalDelayReport]:
        return await PurchaseArrivalDelayReport.filter(
            tenant_id=tenant_id,
            purchase_order_item_id=item_id,
            deleted_at__isnull=True,
            status__in=[
                DocumentStatus.DRAFT.value,
                DocumentStatus.PENDING_REVIEW.value,
                DocumentStatus.AUDITED.value,
                "change_generated",
                OrderChangeApplyStatus.APPLIED.value,
            ],
        ).order_by("-id").first()

    async def create_report(
        self,
        tenant_id: int,
        data: PurchaseArrivalDelayReportCreate,
        operator_id: int,
    ) -> PurchaseArrivalDelayReportResponse:
        order, item = await self._load_po_line(tenant_id, data.purchase_order_item_id)
        if data.estimated_arrival_date <= item.required_date:
            raise ValidationError("预计新到货日须晚于原计划到货日")

        existing = await self._active_delay_for_item(tenant_id, int(item.id))
        if existing and existing.status in (
            DocumentStatus.DRAFT.value,
            DocumentStatus.PENDING_REVIEW.value,
            DocumentStatus.AUDITED.value,
        ):
            raise BusinessLogicError("该采购行已有进行中的延期填报单")

        impact_svc = PurchasePoLineImpactService()
        auto_impact = await impact_svc.resolve_impact_summary(tenant_id, item)
        if not auto_impact and not str(data.impact_description or "").strip():
            raise ValidationError("无法自动解析影响总成时，须填写影响说明")

        user_info = await self.get_user_info(operator_id)
        async with in_transaction():
            doc = await PurchaseArrivalDelayReport.create(
                tenant_id=tenant_id,
                report_code=await self._generate_report_code(tenant_id),
                purchase_order_id=order.id,
                purchase_order_item_id=item.id,
                order_code=order.order_code,
                material_id=item.material_id,
                material_code=item.material_code,
                material_name=item.material_name,
                supplier_id=order.supplier_id,
                supplier_name=order.supplier_name,
                planned_arrival_date=item.required_date,
                delay_reason=data.delay_reason,
                estimated_arrival_date=data.estimated_arrival_date,
                impact_description=data.impact_description,
                impacted_assembly_summary=auto_impact or None,
                status=DocumentStatus.DRAFT.value,
                review_status=ReviewStatus.PENDING.value,
                attachments=data.attachments,
                notes=data.notes,
                created_by=operator_id,
                created_by_name=user_info["name"],
                updated_by=operator_id,
                updated_by_name=user_info["name"],
            )
        return PurchaseArrivalDelayReportResponse.model_validate(doc)

    async def update_report(
        self,
        tenant_id: int,
        report_id: int,
        data: PurchaseArrivalDelayReportUpdate,
        operator_id: int,
    ) -> PurchaseArrivalDelayReportResponse:
        doc = await PurchaseArrivalDelayReport.get_or_none(
            tenant_id=tenant_id, id=report_id, deleted_at__isnull=True
        )
        if not doc:
            raise NotFoundError("延期填报单不存在")
        if doc.status != DocumentStatus.DRAFT.value:
            raise BusinessLogicError("仅草稿可编辑")

        upd = data.model_dump(exclude_unset=True)
        if "estimated_arrival_date" in upd and upd["estimated_arrival_date"] <= doc.planned_arrival_date:
            raise ValidationError("预计新到货日须晚于原计划到货日")

        user_info = await self.get_user_info(operator_id)
        for k, v in upd.items():
            setattr(doc, k, v)
        doc.updated_by = operator_id
        doc.updated_by_name = user_info["name"]
        await doc.save()
        return PurchaseArrivalDelayReportResponse.model_validate(doc)

    async def submit(self, tenant_id: int, report_id: int, operator_id: int) -> PurchaseArrivalDelayReportResponse:
        doc = await self._get_or_raise(tenant_id, report_id)
        if doc.status != DocumentStatus.DRAFT.value:
            raise BusinessLogicError("仅草稿可提交")

        audit_required = await self.business_config_service.check_audit_required(
            tenant_id, "purchase_arrival_delay"
        )
        user_info = await self.get_user_info(operator_id)
        async with in_transaction():
            if audit_required:
                doc.status = DocumentStatus.PENDING_REVIEW.value
                doc.review_status = ReviewStatus.PENDING.value
            else:
                doc.status = DocumentStatus.AUDITED.value
                doc.review_status = ReviewStatus.APPROVED.value
            doc.updated_by = operator_id
            doc.updated_by_name = user_info["name"]
            await doc.save()

            if not audit_required:
                await self._on_approved(tenant_id, doc, operator_id)
        return PurchaseArrivalDelayReportResponse.model_validate(await self._get_or_raise(tenant_id, report_id))

    async def approve(
        self,
        tenant_id: int,
        report_id: int,
        body: ApproveDelayReportRequest,
        operator_id: int,
    ) -> PurchaseArrivalDelayReportResponse:
        doc = await self._get_or_raise(tenant_id, report_id)
        if doc.status != DocumentStatus.PENDING_REVIEW.value:
            raise BusinessLogicError("仅待审核可审批")

        user_info = await self.get_user_info(operator_id)
        async with in_transaction():
            doc.reviewer_id = operator_id
            doc.reviewer_name = user_info["name"]
            doc.review_time = resolve_business_datetime()
            doc.review_remarks = body.review_remarks
            if body.approved:
                doc.status = DocumentStatus.AUDITED.value
                doc.review_status = ReviewStatus.APPROVED.value
            else:
                doc.status = DocumentStatus.REJECTED.value
                doc.review_status = ReviewStatus.REJECTED.value
            doc.updated_by = operator_id
            doc.updated_by_name = user_info["name"]
            await doc.save()

            if body.approved:
                await self._on_approved(tenant_id, doc, operator_id)
        return PurchaseArrivalDelayReportResponse.model_validate(await self._get_or_raise(tenant_id, report_id))

    async def _on_approved(
        self, tenant_id: int, doc: PurchaseArrivalDelayReport, operator_id: int
    ) -> None:
        reason_label = self.DELAY_REASON_LABELS.get(doc.delay_reason, doc.delay_reason)
        change_reason = f"到货延期：{reason_label}，新交期 {doc.estimated_arrival_date}"

        poc = await self.change_service.create_from_order(
            tenant_id, doc.purchase_order_id, operator_id, change_reason=change_reason
        )

        ch_item = await PurchaseOrderChangeItem.get_or_none(
            tenant_id=tenant_id,
            change_order_id=poc.id,
            source_item_id=doc.purchase_order_item_id,
        )
        if not ch_item:
            raise BusinessLogicError("生成采购变更单失败：未找到对应明细行")

        ch_item.change_type = OrderChangeLineType.DELIVERY_DATE.value
        ch_item.after_delivery_date = doc.estimated_arrival_date
        ch_item.delta_amount = Decimal("0")
        await ch_item.save()

        poc_doc = await PurchaseOrderChangeOrder.get_or_none(tenant_id=tenant_id, id=poc.id)
        if poc_doc:
            poc_doc.change_category = OrderChangeCategory.DELIVERY.value
            poc_doc.change_reason = change_reason
            await poc_doc.save()

        doc.purchase_order_change_id = poc.id
        doc.purchase_order_change_code = poc.change_code
        doc.status = "change_generated"
        await doc.save()

        if not await self._require_change_confirm(tenant_id):
            await self.change_service.submit(tenant_id, poc.id, operator_id)
            doc.status = OrderChangeApplyStatus.APPLIED.value
            await doc.save()

    async def get_by_id(self, tenant_id: int, report_id: int) -> PurchaseArrivalDelayReportResponse:
        doc = await self._get_or_raise(tenant_id, report_id)
        return PurchaseArrivalDelayReportResponse.model_validate(doc)

    async def list_reports(
        self,
        tenant_id: int,
        *,
        skip: int = 0,
        limit: int = 20,
        purchase_order_id: Optional[int] = None,
        status: Optional[str] = None,
    ) -> dict:
        q = PurchaseArrivalDelayReport.filter(tenant_id=tenant_id, deleted_at__isnull=True)
        if purchase_order_id:
            q = q.filter(purchase_order_id=purchase_order_id)
        if status:
            q = q.filter(status=status)
        total = await q.count()
        rows = await q.order_by("-created_at", "-id").offset(skip).limit(limit).all()
        return {
            "items": [PurchaseArrivalDelayReportResponse.model_validate(r) for r in rows],
            "total": total,
            "skip": skip,
            "limit": limit,
        }

    async def _get_or_raise(self, tenant_id: int, report_id: int) -> PurchaseArrivalDelayReport:
        doc = await PurchaseArrivalDelayReport.get_or_none(
            tenant_id=tenant_id, id=report_id, deleted_at__isnull=True
        )
        if not doc:
            raise NotFoundError("延期填报单不存在")
        return doc

    async def mark_applied_for_change(self, tenant_id: int, change_id: int) -> None:
        doc = await PurchaseArrivalDelayReport.get_or_none(
            tenant_id=tenant_id,
            purchase_order_change_id=change_id,
            deleted_at__isnull=True,
        )
        if doc:
            doc.status = OrderChangeApplyStatus.APPLIED.value
            await doc.save()
