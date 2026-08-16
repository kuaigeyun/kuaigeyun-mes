"""快制造运费单服务"""

from decimal import Decimal
from typing import Any, Dict, List, Optional

from tortoise.expressions import Q
from tortoise.transactions import in_transaction

from apps.common.base_service import AppBaseService
from apps.kuaizhizao.models.logistics import FreightBill, FreightBillItem, FreightOrder, LogisticsCarrier
from apps.kuaizhizao.schemas.logistics import FreightBillCreate
from core.utils.timezone_utils import resolve_business_datetime, today_site_str, to_site_date
from infra.exceptions.exceptions import BusinessLogicError, NotFoundError
from infra.services.business_config_service import BusinessConfigService


class FreightBillService(AppBaseService):
    def __init__(self):
        super().__init__(FreightBill)
        self.business_config_service = BusinessConfigService()

    async def _get_bill(self, tenant_id: int, bill_id: int) -> FreightBill:
        bill = await FreightBill.get_or_none(id=bill_id, tenant_id=tenant_id, deleted_at__isnull=True)
        if not bill:
            raise NotFoundError("运费单不存在")
        return bill

    async def _build_response(self, bill: FreightBill) -> Dict[str, Any]:
        items = await FreightBillItem.filter(tenant_id=bill.tenant_id, freight_bill_id=bill.id)
        data = {field: getattr(bill, field) for field in bill._meta.fields_map.keys()}
        data["items"] = items
        return data

    async def list_bills(
        self,
        tenant_id: int,
        *,
        skip: int = 0,
        limit: int = 20,
        keyword: Optional[str] = None,
        review_status: Optional[str] = None,
    ) -> Dict[str, Any]:
        query = FreightBill.filter(tenant_id=tenant_id, deleted_at__isnull=True)
        if review_status:
            query = query.filter(review_status=review_status)
        if keyword:
            kw = keyword.strip()
            if kw:
                query = query.filter(
                    Q(bill_code__icontains=kw)
                    | Q(carrier_name__icontains=kw)
                    | Q(payable_code__icontains=kw)
                )
        total = await query.count()
        rows = await query.offset(skip).limit(limit).order_by("-created_at")
        items = [await self._build_response(row) for row in rows]
        return {"items": items, "total": total}

    async def get_bill(self, tenant_id: int, bill_id: int) -> Dict[str, Any]:
        bill = await self._get_bill(tenant_id, bill_id)
        return await self._build_response(bill)

    async def create_bill(
        self,
        tenant_id: int,
        data: FreightBillCreate,
        *,
        created_by: Optional[int] = None,
    ) -> Dict[str, Any]:
        if not data.items:
            raise BusinessLogicError("请至少添加一条运费明细")
        carrier = await LogisticsCarrier.get_or_none(id=data.carrier_id, tenant_id=tenant_id, deleted_at__isnull=True)
        if not carrier:
            raise NotFoundError("承运商不存在")
        total = sum((item.amount for item in data.items), Decimal("0"))
        if total <= 0:
            raise BusinessLogicError("运费总额必须大于 0")
        bill_code = await self.generate_code(tenant_id, "FREIGHT_BILL_CODE", prefix=f"FB{today_site_str()}")
        async with in_transaction():
            bill = await FreightBill.create(
                tenant_id=tenant_id,
                bill_code=bill_code,
                carrier_id=carrier.id,
                carrier_name=carrier.name,
                period_start=data.period_start,
                period_end=data.period_end,
                total_amount=total,
                status="draft",
                review_status="draft",
                remark=data.remark,
                created_by=created_by,
            )
            for item in data.items:
                order = await FreightOrder.get_or_none(
                    id=item.freight_order_id,
                    tenant_id=tenant_id,
                    deleted_at__isnull=True,
                )
                if not order:
                    raise NotFoundError(f"货运单不存在: {item.freight_order_id}")
                await FreightBillItem.create(
                    tenant_id=tenant_id,
                    freight_bill_id=bill.id,
                    freight_order_id=order.id,
                    freight_order_code=order.order_code,
                    fee_type=item.fee_type,
                    amount=item.amount,
                    remark=item.remark,
                )
        return await self.get_bill(tenant_id, int(bill.id))

    async def delete_bill(self, tenant_id: int, bill_id: int) -> None:
        bill = await self._get_bill(tenant_id, bill_id)
        if bill.review_status not in {"draft", "rejected"}:
            raise BusinessLogicError("仅草稿或已驳回运费单可删除")
        bill.deleted_at = resolve_business_datetime()
        await bill.save()

    async def submit_freight_bill(self, tenant_id: int, bill_id: int, submitted_by: int) -> Dict[str, Any]:
        bill = await self._get_bill(tenant_id, bill_id)
        if bill.review_status not in {"draft", "rejected"}:
            raise BusinessLogicError("当前状态不可提交审核")
        audit_required = await self.business_config_service.check_audit_required(tenant_id, "freight_bill")
        if audit_required:
            from core.services.approval.approval_instance_service import ApprovalInstanceService

            instance = await ApprovalInstanceService.start_approval_for_node(
                tenant_id=tenant_id,
                user_id=submitted_by,
                node_key="freight_bill",
                entity_type="freight_bill",
                entity_id=bill.id,
                entity_uuid=str(bill.uuid),
                title=f"运费单审批: {bill.bill_code}",
                content=f"承运商: {bill.carrier_name}, 金额: {bill.total_amount}",
            )
            if not instance:
                raise BusinessLogicError("运费单审核已开启但未找到可用审批流程")
        bill.review_status = "pending"
        bill.status = "pending"
        bill.updated_by = submitted_by
        await bill.save()
        return await self.get_bill(tenant_id, bill_id)

    async def _push_payable(self, tenant_id: int, bill: FreightBill, operator_id: int) -> None:
        if bill.payable_id:
            return
        carrier = await LogisticsCarrier.get_or_none(id=bill.carrier_id, tenant_id=tenant_id, deleted_at__isnull=True)
        if not carrier or not carrier.supplier_id:
            raise BusinessLogicError("承运商未关联轻财务供应商，无法推送应付单")
        from apps.kuaicaiwu.schemas.finance import PayableCreate
        from apps.kuaicaiwu.services.finance_due_date import resolve_partner_due_date
        from apps.kuaicaiwu.services.finance_service import PayableService
        from apps.kuaicaiwu.services.finance_integration_hooks import (
            link_finance_document_relation,
            record_finance_accounting_event,
        )

        biz_date = to_site_date(resolve_business_datetime())
        due_date = await resolve_partner_due_date(tenant_id, "supplier", int(carrier.supplier_id), biz_date)
        total_amount = Decimal(str(bill.total_amount or 0))
        payable_data = PayableCreate(
            source_type="运费单",
            source_id=int(bill.id),
            source_code=bill.bill_code,
            supplier_id=int(carrier.supplier_id),
            supplier_name=carrier.name,
            total_amount=total_amount,
            paid_amount=Decimal("0"),
            remaining_amount=total_amount,
            due_date=due_date,
            business_date=biz_date,
            status="未付款",
            notes=f"由运费单 {bill.bill_code} 审核通过自动生成",
        )
        payable_service = PayableService()
        payable = await payable_service.create_payable(
            tenant_id=tenant_id,
            payable_data=payable_data,
            created_by=operator_id,
        )
        await link_finance_document_relation(
            tenant_id=tenant_id,
            source_type="freight_bill",
            source_id=int(bill.id),
            source_code=bill.bill_code,
            target_type="payable",
            target_id=payable.id,
            target_code=getattr(payable, "payable_code", None),
            relation_desc="运费单审核通过自动生成应付单",
            created_by=operator_id,
        )
        await record_finance_accounting_event(
            tenant_id=tenant_id,
            event_type="FREIGHT_BILL_TO_PAYABLE",
            business_type="payable",
            source_doc_type="freight_bill",
            source_doc_id=int(bill.id),
            source_doc_code=bill.bill_code,
            target_doc_type="Payable",
            target_doc_id=payable.id,
            target_doc_code=payable.payable_code,
            amount=total_amount,
            operator_id=operator_id,
        )
        bill.payable_id = payable.id
        bill.payable_code = payable.payable_code
        await bill.save()

    async def approve_freight_bill(self, tenant_id: int, bill_id: int, approver_id: int) -> Dict[str, Any]:
        bill = await self._get_bill(tenant_id, bill_id)
        if bill.review_status not in {"pending"}:
            raise BusinessLogicError("当前状态不可审核通过")
        now = resolve_business_datetime()
        user = await self.get_user_info(approver_id)
        bill.review_status = "approved"
        bill.status = "approved"
        bill.reviewer_id = approver_id
        bill.reviewer_name = user["name"]
        bill.reviewed_at = now
        bill.updated_by = approver_id
        await bill.save()
        await self._push_payable(tenant_id, bill, approver_id)
        return await self.get_bill(tenant_id, bill_id)

    async def reject_freight_bill(
        self,
        tenant_id: int,
        bill_id: int,
        approver_id: int,
        *,
        rejection_reason: Optional[str] = None,
    ) -> Dict[str, Any]:
        bill = await self._get_bill(tenant_id, bill_id)
        if bill.review_status not in {"pending"}:
            raise BusinessLogicError("当前状态不可驳回")
        user = await self.get_user_info(approver_id)
        bill.review_status = "rejected"
        bill.status = "rejected"
        bill.reviewer_id = approver_id
        bill.reviewer_name = user["name"]
        bill.reviewed_at = resolve_business_datetime()
        bill.remark = rejection_reason or bill.remark
        bill.updated_by = approver_id
        await bill.save()
        return await self.get_bill(tenant_id, bill_id)

    async def withdraw_freight_bill_submit(self, tenant_id: int, bill_id: int, user_id: int) -> Dict[str, Any]:
        bill = await self._get_bill(tenant_id, bill_id)
        if bill.review_status != "pending":
            raise BusinessLogicError("仅待审核运费单可撤回")
        bill.review_status = "draft"
        bill.status = "draft"
        bill.updated_by = user_id
        await bill.save()
        return await self.get_bill(tenant_id, bill_id)

    async def revoke_freight_bill_approval(self, tenant_id: int, bill_id: int, user_id: int) -> Dict[str, Any]:
        bill = await self._get_bill(tenant_id, bill_id)
        if bill.review_status != "approved":
            raise BusinessLogicError("仅已审核运费单可反审")
        if bill.payable_id:
            raise BusinessLogicError("已推送应付单，请先处理应付单后再反审")
        bill.review_status = "draft"
        bill.status = "draft"
        bill.reviewer_id = None
        bill.reviewer_name = None
        bill.reviewed_at = None
        bill.updated_by = user_id
        await bill.save()
        return await self.get_bill(tenant_id, bill_id)

    async def list_pending_freight_orders(
        self,
        tenant_id: int,
        *,
        carrier_id: Optional[int] = None,
        keyword: Optional[str] = None,
        skip: int = 0,
        limit: int = 50,
    ) -> Dict[str, Any]:
        query = FreightOrder.filter(
            tenant_id=tenant_id,
            deleted_at__isnull=True,
            status__in=["shipped", "in_transit", "arrived", "signed"],
        )
        if carrier_id:
            query = query.filter(carrier_id=carrier_id)
        text = (keyword or "").strip()
        if text:
            query = query.filter(Q(order_code__icontains=text) | Q(tracking_number__icontains=text))
        total = await query.count()
        rows = await query.offset(skip).limit(limit).order_by("-created_at")
        return {"items": rows, "total": total}
