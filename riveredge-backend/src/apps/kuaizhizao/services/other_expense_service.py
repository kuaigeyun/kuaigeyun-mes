"""其他费用支出服务"""

from __future__ import annotations

from decimal import Decimal
from typing import Any, Dict, List, Optional

from tortoise.expressions import Q
from tortoise.transactions import in_transaction

from apps.common.base_service import AppBaseService
from apps.kuaizhizao.models.other_voucher import OtherExpense, OtherExpenseLine
from apps.kuaizhizao.schemas.other_voucher import (
    OtherExpenseCreate,
    OtherExpenseResponse,
    OtherExpenseUpdate,
    OtherVoucherLineInput,
    OtherVoucherLineResponse,
)
from apps.kuaizhizao.services.document_action_policy.other_expense import (
    assert_other_expense_capability,
    derive_other_expense_capabilities,
)
from apps.kuaizhizao.services.finance_misc_category_service import FinanceMiscCategoryService
from apps.kuaizhizao.services.other_voucher_codes import allocate_other_expense_code
from core.utils.timezone_utils import resolve_business_datetime
from infra.exceptions.exceptions import NotFoundError, ValidationError, BusinessLogicError
from infra.services.business_config_service import BusinessConfigService


class OtherExpenseService(AppBaseService[OtherExpense]):
    def __init__(self) -> None:
        super().__init__(OtherExpense)
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
            cat = await self._categories.get_active_by_code(tenant_id, "expense", code)
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

    async def _to_response(self, head: OtherExpense) -> OtherExpenseResponse:
        lines = await OtherExpenseLine.filter(
            tenant_id=head.tenant_id, other_expense_id=head.id
        ).order_by("line_no")
        from apps.kuaizhizao.services.misc_voucher_finance_bridge import MiscVoucherFinanceBridge

        finance_links = await MiscVoucherFinanceBridge().finance_links_for_expense(
            head.tenant_id, int(head.id)
        )
        caps = derive_other_expense_capabilities(
            head,
            has_payable=bool(finance_links.get("payable_id")),
            has_payment=bool(finance_links.get("payment_id")),
        )
        base = OtherExpenseResponse.model_validate(head, from_attributes=True)
        return base.model_copy(
            update={
                "lines": [OtherVoucherLineResponse.model_validate(r) for r in lines],
                "capabilities": {k: v.model_dump() for k, v in caps.items()},
                **finance_links,
            }
        )

    async def create_expense(
        self, tenant_id: int, data: OtherExpenseCreate, created_by: int
    ) -> OtherExpenseResponse:
        total, line_rows = await self._sum_and_validate_lines(tenant_id, data.lines)
        user = await self.get_user_info(created_by)
        code = (data.expense_code or await allocate_other_expense_code(tenant_id)).strip().upper()
        async with in_transaction():
            head = await OtherExpense.create(
                tenant_id=tenant_id,
                expense_code=code,
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
                await OtherExpenseLine.create(
                    tenant_id=tenant_id, other_expense_id=head.id, **row
                )
            head_id = head.id
        return await self.get_by_id(tenant_id, head_id)

    async def get_by_id(self, tenant_id: int, expense_id: int) -> OtherExpenseResponse:
        head = await OtherExpense.get_or_none(
            tenant_id=tenant_id, id=expense_id, deleted_at__isnull=True
        )
        if not head:
            raise NotFoundError(f"其他费用支出单不存在: {expense_id}")
        return await self._to_response(head)

    async def list_expenses(
        self,
        tenant_id: int,
        *,
        skip: int = 0,
        limit: int = 20,
        status: Optional[str] = None,
        keyword: Optional[str] = None,
    ) -> Dict[str, Any]:
        q = OtherExpense.filter(tenant_id=tenant_id, deleted_at__isnull=True)
        if status:
            q = q.filter(status=status)
        kw = (keyword or "").strip()
        if kw:
            q = q.filter(
                Q(expense_code__icontains=kw)
                | Q(counterparty_name__icontains=kw)
                | Q(notes__icontains=kw)
            )
        total = await q.count()
        rows = await q.offset(skip).limit(limit).order_by("-created_at")
        items = [await self._to_response(r) for r in rows]
        return {"items": items, "total": total}

    async def update_expense(
        self,
        tenant_id: int,
        expense_id: int,
        data: OtherExpenseUpdate,
        updated_by: int,
    ) -> OtherExpenseResponse:
        head = await OtherExpense.get_or_none(
            tenant_id=tenant_id, id=expense_id, deleted_at__isnull=True
        )
        if not head:
            raise NotFoundError(f"其他费用支出单不存在: {expense_id}")
        assert_other_expense_capability(head, "update")
        dump = data.model_dump(exclude_unset=True)
        lines = dump.pop("lines", None)
        user = await self.get_user_info(updated_by)
        async with in_transaction():
            if lines is not None:
                total, line_rows = await self._sum_and_validate_lines(tenant_id, lines)
                await OtherExpenseLine.filter(
                    tenant_id=tenant_id, other_expense_id=expense_id
                ).delete()
                for row in line_rows:
                    await OtherExpenseLine.create(
                        tenant_id=tenant_id, other_expense_id=expense_id, **row
                    )
                dump["total_amount"] = total
            dump["updated_by"] = updated_by
            dump["updated_by_name"] = user["name"]
            await head.update_from_dict(dump).save()
        return await self.get_by_id(tenant_id, expense_id)

    async def delete_expense(self, tenant_id: int, expense_id: int) -> None:
        head = await OtherExpense.get_or_none(
            tenant_id=tenant_id, id=expense_id, deleted_at__isnull=True
        )
        if not head:
            raise NotFoundError(f"其他费用支出单不存在: {expense_id}")
        assert_other_expense_capability(head, "delete")
        head.deleted_at = resolve_business_datetime()
        await head.save()

    async def submit_expense(
        self, tenant_id: int, expense_id: int, user_id: int
    ) -> OtherExpenseResponse:
        head = await OtherExpense.get_or_none(
            tenant_id=tenant_id, id=expense_id, deleted_at__isnull=True
        )
        if not head:
            raise NotFoundError(f"其他费用支出单不存在: {expense_id}")
        assert_other_expense_capability(head, "submit")
        audit_required = await self._config.check_audit_required(tenant_id, "other_expense")
        user = await self.get_user_info(user_id)
        if audit_required:
            from core.services.approval.approval_instance_service import ApprovalInstanceService

            inst = await ApprovalInstanceService.start_approval_for_node(
                tenant_id=tenant_id,
                user_id=user_id,
                node_key="other_expense",
                entity_type="other_expense",
                entity_id=head.id,
                entity_uuid=str(head.uuid),
                title=f"其他费用支出审批: {head.expense_code}",
                content=f"金额: {head.total_amount}",
            )
            if not inst:
                raise BusinessLogicError("审核已开启但未找到可用审批流程")
            head.status = "PendingReview"
        else:
            head.status = "Approved"
        head.updated_by = user_id
        head.updated_by_name = user["name"]
        await head.save()
        if head.status == "Approved":
            await self._on_expense_approved(tenant_id, head, user_id)
        return await self.get_by_id(tenant_id, expense_id)

    async def _on_expense_approved(
        self, tenant_id: int, head: OtherExpense, operator_id: int
    ) -> None:
        from apps.kuaizhizao.services.misc_voucher_finance_bridge import MiscVoucherFinanceBridge

        await MiscVoucherFinanceBridge().ensure_payable_on_expense_approved(
            tenant_id, head, operator_id
        )

    async def approve_expense(
        self,
        tenant_id: int,
        expense_id: int,
        *,
        approved: bool,
        operator_id: int,
        review_remarks: Optional[str] = None,
    ) -> OtherExpenseResponse:
        head = await OtherExpense.get_or_none(
            tenant_id=tenant_id, id=expense_id, deleted_at__isnull=True
        )
        if not head:
            raise NotFoundError(f"其他费用支出单不存在: {expense_id}")
        if approved:
            assert_other_expense_capability(head, "approve")
        else:
            assert_other_expense_capability(head, "reject")
        audit_required = await self._config.check_audit_required(tenant_id, "other_expense")
        if audit_required and approved:
            from core.services.approval.audit_flow_guard import (
                assert_manual_approval_action_allowed,
                get_approval_gate_status,
            )

            gate = await get_approval_gate_status(
                tenant_id=tenant_id, entity_type="other_expense", entity_id=expense_id
            )
            assert_manual_approval_action_allowed(gate, doc_label="其他费用支出", verb="审核")
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
            await self._on_expense_approved(tenant_id, head, operator_id)
        return await self.get_by_id(tenant_id, expense_id)

    async def withdraw_expense_submit(
        self, tenant_id: int, expense_id: int, user_id: int
    ) -> OtherExpenseResponse:
        head = await OtherExpense.get_or_none(
            tenant_id=tenant_id, id=expense_id, deleted_at__isnull=True
        )
        if not head:
            raise NotFoundError(f"其他费用支出单不存在: {expense_id}")
        if head.status != "PendingReview":
            raise BusinessLogicError("仅待审核的其他费用支出单可撤回")
        user = await self.get_user_info(user_id)
        head.status = "Draft"
        head.updated_by = user_id
        head.updated_by_name = user["name"]
        await head.save()
        return await self.get_by_id(tenant_id, expense_id)

    async def revoke_expense_approval(
        self, tenant_id: int, expense_id: int, user_id: int
    ) -> OtherExpenseResponse:
        head = await OtherExpense.get_or_none(
            tenant_id=tenant_id, id=expense_id, deleted_at__isnull=True
        )
        if not head:
            raise NotFoundError(f"其他费用支出单不存在: {expense_id}")
        if head.status != "Approved":
            raise BusinessLogicError("仅已审核的其他费用支出单可反审")
        from apps.kuaizhizao.services.misc_voucher_finance_bridge import MiscVoucherFinanceBridge

        bridge = MiscVoucherFinanceBridge()
        await bridge.assert_expense_payable_revokable(tenant_id, expense_id)
        await bridge.void_payable_for_expense_revoke(tenant_id, expense_id, user_id)
        user = await self.get_user_info(user_id)
        head.status = "Draft"
        head.reviewer_id = None
        head.reviewer_name = None
        head.review_time = None
        head.review_remarks = None
        head.updated_by = user_id
        head.updated_by_name = user["name"]
        await head.save()
        return await self.get_by_id(tenant_id, expense_id)

    async def cancel_expense(
        self, tenant_id: int, expense_id: int, operator_id: int
    ) -> OtherExpenseResponse:
        head = await OtherExpense.get_or_none(
            tenant_id=tenant_id, id=expense_id, deleted_at__isnull=True
        )
        if not head:
            raise NotFoundError(f"其他费用支出单不存在: {expense_id}")
        assert_other_expense_capability(head, "cancel")
        if head.status == "Confirmed":
            from apps.kuaizhizao.services.misc_voucher_posting_service import (
                MiscVoucherPostingService,
            )

            await MiscVoucherPostingService().unpost_other_expense(
                tenant_id, expense_id, operator_id=operator_id
            )
        user = await self.get_user_info(operator_id)
        head.status = "Cancelled"
        head.updated_by = operator_id
        head.updated_by_name = user["name"]
        await head.save()
        return await self.get_by_id(tenant_id, expense_id)
