"""其他费用收入服务"""

from __future__ import annotations

from decimal import Decimal
from typing import Any, Dict, List, Optional

from tortoise.expressions import Q
from tortoise.transactions import in_transaction

from apps.common.base_service import AppBaseService
from apps.kuaizhizao.models.other_voucher import OtherIncome, OtherIncomeLine
from apps.kuaizhizao.schemas.other_voucher import (
    OtherIncomeCreate,
    OtherIncomeResponse,
    OtherIncomeUpdate,
    OtherVoucherLineInput,
    OtherVoucherLineResponse,
)
from apps.kuaizhizao.services.document_action_policy.other_income import (
    assert_other_income_capability,
    derive_other_income_capabilities,
)
from apps.kuaizhizao.services.finance_misc_category_service import FinanceMiscCategoryService
from apps.kuaizhizao.services.other_voucher_codes import allocate_other_income_code
from core.utils.timezone_utils import resolve_business_datetime
from infra.exceptions.exceptions import NotFoundError, ValidationError, BusinessLogicError
from infra.services.business_config_service import BusinessConfigService


class OtherIncomeService(AppBaseService[OtherIncome]):
    def __init__(self) -> None:
        super().__init__(OtherIncome)
        self._categories = FinanceMiscCategoryService()
        self._config = BusinessConfigService()

    async def _sum_and_validate_lines(
        self, tenant_id: int, lines: List[OtherVoucherLineInput]
    ) -> tuple[Decimal, List[dict]]:
        total = Decimal("0")
        normalized: List[dict] = []
        for idx, item in enumerate(lines, start=1):
            amt = Decimal(str(item.amount))
            if amt <= 0:
                raise ValidationError(f"第 {idx} 行金额须大于 0")
            code = str(item.category_code).strip()
            cat = await self._categories.get_active_by_code(tenant_id, "income", code)
            gl = item.gl_account_code
            if not gl and cat.default_gl_account_code:
                gl = cat.default_gl_account_code
            normalized.append(
                {
                    "line_no": idx,
                    "category_code": cat.code,
                    "category_name": cat.name,
                    "amount": amt,
                    "description": item.description,
                    "gl_account_code": gl,
                }
            )
            total += amt
        return total, normalized

    async def _to_response(self, head: OtherIncome) -> OtherIncomeResponse:
        lines = await OtherIncomeLine.filter(
            tenant_id=head.tenant_id, other_income_id=head.id
        ).order_by("line_no")
        from apps.kuaizhizao.services.misc_voucher_finance_bridge import MiscVoucherFinanceBridge

        finance_links = await MiscVoucherFinanceBridge().finance_links_for_income(
            head.tenant_id, int(head.id)
        )
        caps = derive_other_income_capabilities(
            head,
            has_receivable=bool(finance_links.get("receivable_id")),
            has_receipt=bool(finance_links.get("receipt_id")),
        )
        base = OtherIncomeResponse.model_validate(head, from_attributes=True)
        return base.model_copy(
            update={
                "lines": [OtherVoucherLineResponse.model_validate(r) for r in lines],
                "capabilities": {k: v.model_dump() for k, v in caps.items()},
                **finance_links,
            }
        )

    async def create_income(
        self, tenant_id: int, data: OtherIncomeCreate, created_by: int
    ) -> OtherIncomeResponse:
        total, line_rows = await self._sum_and_validate_lines(tenant_id, data.lines)
        user = await self.get_user_info(created_by)
        code = (data.income_code or await allocate_other_income_code(tenant_id)).strip().upper()
        async with in_transaction():
            head = await OtherIncome.create(
                tenant_id=tenant_id,
                income_code=code,
                business_date=data.business_date,
                counterparty_kind=data.counterparty_kind or "none",
                counterparty_id=data.counterparty_id,
                counterparty_name=data.counterparty_name,
                total_amount=total,
                payment_method=data.payment_method,
                bank_account_id=data.bank_account_id,
                bank_account=data.bank_account,
                status="Draft",
                department_id=data.department_id,
                department_name=data.department_name,
                project_id=data.project_id,
                project_name=data.project_name,
                notes=data.notes,
                attachments=data.attachments,
                created_by=created_by,
                created_by_name=user["name"],
                updated_by=created_by,
                updated_by_name=user["name"],
            )
            for row in line_rows:
                await OtherIncomeLine.create(
                    tenant_id=tenant_id, other_income_id=head.id, **row
                )
            head_id = head.id
        return await self.get_by_id(tenant_id, head_id)

    async def get_by_id(self, tenant_id: int, income_id: int) -> OtherIncomeResponse:
        head = await OtherIncome.get_or_none(
            tenant_id=tenant_id, id=income_id, deleted_at__isnull=True
        )
        if not head:
            raise NotFoundError(f"其他费用收入单不存在: {income_id}")
        return await self._to_response(head)

    async def list_incomes(
        self,
        tenant_id: int,
        *,
        skip: int = 0,
        limit: int = 20,
        status: Optional[str] = None,
        keyword: Optional[str] = None,
    ) -> Dict[str, Any]:
        q = OtherIncome.filter(tenant_id=tenant_id, deleted_at__isnull=True)
        if status:
            q = q.filter(status=status)
        kw = (keyword or "").strip()
        if kw:
            q = q.filter(
                Q(income_code__icontains=kw)
                | Q(counterparty_name__icontains=kw)
                | Q(notes__icontains=kw)
            )
        total = await q.count()
        rows = await q.offset(skip).limit(limit).order_by("-created_at")
        items = [await self._to_response(r) for r in rows]
        return {"items": items, "total": total}

    async def update_income(
        self,
        tenant_id: int,
        income_id: int,
        data: OtherIncomeUpdate,
        updated_by: int,
    ) -> OtherIncomeResponse:
        head = await OtherIncome.get_or_none(
            tenant_id=tenant_id, id=income_id, deleted_at__isnull=True
        )
        if not head:
            raise NotFoundError(f"其他费用收入单不存在: {income_id}")
        assert_other_income_capability(head, "update")
        dump = data.model_dump(exclude_unset=True)
        # 明细须用 schema 实例校验；model_dump 后的 dict 无 .amount
        lines_provided = "lines" in dump
        dump.pop("lines", None)
        user = await self.get_user_info(updated_by)
        async with in_transaction():
            if lines_provided:
                if not data.lines:
                    raise ValidationError("至少一行明细")
                total, line_rows = await self._sum_and_validate_lines(tenant_id, data.lines)
                await OtherIncomeLine.filter(
                    tenant_id=tenant_id, other_income_id=income_id
                ).delete()
                for row in line_rows:
                    await OtherIncomeLine.create(
                        tenant_id=tenant_id, other_income_id=income_id, **row
                    )
                dump["total_amount"] = total
            dump["updated_by"] = updated_by
            dump["updated_by_name"] = user["name"]
            await head.update_from_dict(dump).save()
        return await self.get_by_id(tenant_id, income_id)

    async def delete_income(self, tenant_id: int, income_id: int) -> None:
        head = await OtherIncome.get_or_none(
            tenant_id=tenant_id, id=income_id, deleted_at__isnull=True
        )
        if not head:
            raise NotFoundError(f"其他费用收入单不存在: {income_id}")
        assert_other_income_capability(head, "delete")
        head.deleted_at = resolve_business_datetime()
        await head.save()

    async def submit_income(
        self,
        tenant_id: int,
        income_id: int,
        user_id: int,
        *,
        selected_approver_user_ids: Optional[List[int]] = None,
        selected_approver_by_node: Optional[Dict[str, List[int]]] = None,
    ) -> OtherIncomeResponse:
        head = await OtherIncome.get_or_none(
            tenant_id=tenant_id, id=income_id, deleted_at__isnull=True
        )
        if not head:
            raise NotFoundError(f"其他费用收入单不存在: {income_id}")
        assert_other_income_capability(head, "submit")
        audit_required = await self._config.check_audit_required(tenant_id, "other_income")
        user = await self.get_user_info(user_id)
        if audit_required:
            from core.services.approval.audit_flow_guard import (
                approval_instance_finished_on_submit,
                start_document_approval_or_raise,
            )

            instance = await start_document_approval_or_raise(
                tenant_id=tenant_id,
                user_id=user_id,
                node_key="other_income",
                entity_type="other_income",
                entity_id=int(head.id),
                entity_uuid=str(head.uuid),
                title=f"其他费用收入审批: {head.income_code}",
                content=f"金额: {head.total_amount}",
                doc_label="其他费用收入",
                selected_approver_user_ids=selected_approver_user_ids,
                selected_approver_by_node=selected_approver_by_node,
            )
            head.status = "PendingReview"
            head.updated_by = user_id
            head.updated_by_name = user["name"]
            await head.save()
            if approval_instance_finished_on_submit(instance):
                return await self.approve_income(
                    tenant_id,
                    income_id,
                    approved=True,
                    operator_id=user_id,
                )
            return await self.get_by_id(tenant_id, income_id)

        head.status = "Approved"
        head.updated_by = user_id
        head.updated_by_name = user["name"]
        await head.save()
        await self._on_income_approved(tenant_id, head, user_id)
        return await self.get_by_id(tenant_id, income_id)

    async def _on_income_approved(
        self, tenant_id: int, head: OtherIncome, operator_id: int
    ) -> None:
        from apps.kuaizhizao.services.misc_voucher_finance_bridge import MiscVoucherFinanceBridge

        await MiscVoucherFinanceBridge().ensure_receivable_on_income_approved(
            tenant_id, head, operator_id
        )

    async def approve_income(
        self,
        tenant_id: int,
        income_id: int,
        *,
        approved: bool,
        operator_id: int,
        review_remarks: Optional[str] = None,
    ) -> OtherIncomeResponse:
        head = await OtherIncome.get_or_none(
            tenant_id=tenant_id, id=income_id, deleted_at__isnull=True
        )
        if not head:
            raise NotFoundError(f"其他费用收入单不存在: {income_id}")
        if approved:
            assert_other_income_capability(head, "approve")
        else:
            assert_other_income_capability(head, "reject")
        audit_required = await self._config.check_audit_required(tenant_id, "other_income")
        if audit_required and approved:
            from core.services.approval.audit_flow_guard import (
                assert_manual_approval_action_allowed,
                get_approval_gate_status,
            )

            gate = await get_approval_gate_status(
                tenant_id=tenant_id, entity_type="other_income", entity_id=income_id
            )
            assert_manual_approval_action_allowed(gate, doc_label="其他费用收入", verb="审核")
        user = await self.get_user_info(operator_id)
        head.reviewer_id = operator_id
        head.reviewer_name = user["name"]
        head.review_time = resolve_business_datetime()
        head.review_remarks = review_remarks
        head.status = "Approved" if approved else "Rejected"
        head.updated_by = operator_id
        head.updated_by_name = user["name"]
        await head.save()
        if approved:
            await self._on_income_approved(tenant_id, head, operator_id)
        return await self.get_by_id(tenant_id, income_id)

    async def withdraw_income_submit(
        self, tenant_id: int, income_id: int, user_id: int
    ) -> OtherIncomeResponse:
        head = await OtherIncome.get_or_none(
            tenant_id=tenant_id, id=income_id, deleted_at__isnull=True
        )
        if not head:
            raise NotFoundError(f"其他费用收入单不存在: {income_id}")
        if head.status != "PendingReview":
            raise BusinessLogicError("仅待审核的其他费用收入单可撤回")
        user = await self.get_user_info(user_id)
        head.status = "Draft"
        head.updated_by = user_id
        head.updated_by_name = user["name"]
        await head.save()
        return await self.get_by_id(tenant_id, income_id)

    async def revoke_income_approval(
        self, tenant_id: int, income_id: int, user_id: int
    ) -> OtherIncomeResponse:
        head = await OtherIncome.get_or_none(
            tenant_id=tenant_id, id=income_id, deleted_at__isnull=True
        )
        if not head:
            raise NotFoundError(f"其他费用收入单不存在: {income_id}")
        if head.status != "Approved":
            raise BusinessLogicError("仅已审核的其他费用收入单可反审")
        from apps.kuaizhizao.services.misc_voucher_finance_bridge import MiscVoucherFinanceBridge

        bridge = MiscVoucherFinanceBridge()
        await bridge.assert_income_receivable_revokable(tenant_id, income_id)
        await bridge.void_receivable_for_income_revoke(tenant_id, income_id, user_id)
        user = await self.get_user_info(user_id)
        head.status = "Draft"
        head.reviewer_id = None
        head.reviewer_name = None
        head.review_time = None
        head.review_remarks = None
        head.updated_by = user_id
        head.updated_by_name = user["name"]
        await head.save()
        return await self.get_by_id(tenant_id, income_id)

    async def cancel_income(
        self, tenant_id: int, income_id: int, operator_id: int
    ) -> OtherIncomeResponse:
        head = await OtherIncome.get_or_none(
            tenant_id=tenant_id, id=income_id, deleted_at__isnull=True
        )
        if not head:
            raise NotFoundError(f"其他费用收入单不存在: {income_id}")
        assert_other_income_capability(head, "cancel")
        if head.status == "Confirmed":
            from apps.kuaizhizao.services.misc_voucher_posting_service import (
                MiscVoucherPostingService,
            )

            await MiscVoucherPostingService().unpost_other_income(
                tenant_id, income_id, operator_id=operator_id
            )
        user = await self.get_user_info(operator_id)
        head.status = "Cancelled"
        head.updated_by = operator_id
        head.updated_by_name = user["name"]
        await head.save()
        return await self.get_by_id(tenant_id, income_id)
