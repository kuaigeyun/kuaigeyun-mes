"""
销售合同服务
"""

from __future__ import annotations

from datetime import date, datetime, timedelta
from decimal import Decimal, ROUND_HALF_UP
from typing import List, Optional, Dict, Any

from tortoise.expressions import Q
from tortoise.transactions import in_transaction
from tortoise.exceptions import IntegrityError

from apps.common.base_service import AppBaseService
from apps.kuaizhizao.constants import LEGACY_PENDING_VALUES, DemandStatus, ReviewStatus
from apps.kuaizhizao.models.quotation import Quotation
from apps.kuaizhizao.models.quotation_item import QuotationItem
from apps.kuaizhizao.models.sales_contract import SalesContract
from apps.kuaizhizao.models.sales_contract_change import SalesContractChange
from apps.kuaizhizao.models.sales_contract_item import SalesContractItem
from apps.kuaizhizao.models.sales_contract_milestone import SalesContractMilestone
from apps.kuaizhizao.models.sales_contract_term_group import SalesContractTermGroup
from apps.kuaizhizao.models.sales_order import SalesOrder
from apps.kuaizhizao.schemas.sales_contract import (
    SalesContractAlertItem,
    SalesContractChangeCreate,
    SalesContractChangeResponse,
    SalesContractCreate,
    SalesContractExecutionSummary,
    SalesContractItemCreate,
    SalesContractItemResponse,
    SalesContractListResponse,
    SalesContractMilestoneCreate,
    SalesContractMilestoneResponse,
    SalesContractReleaseLine,
    SalesContractResponse,
    SalesContractUpdate,
)
from apps.kuaizhizao.schemas.sales_order import SalesOrderCreate, SalesOrderItemCreate
from apps.kuaizhizao.services.document_lifecycle_service import _is_approved, get_sales_contract_lifecycle
from apps.kuaizhizao.services.document_action_policy.enricher import (
    enrich_sales_contract_capabilities_on_response,
)
from apps.kuaizhizao.services.document_action_policy.sales_contract import (
    assert_sales_contract_capability,
)
from apps.kuaizhizao.services.sales_contract_term_service import SalesContractTermService
from infra.exceptions.exceptions import BusinessLogicError, NotFoundError, ValidationError
from infra.services.business_config_service import BusinessConfigService


class SalesContractService(AppBaseService[SalesContract]):
    CONTRACT_TYPE_SINGLE = "single"
    CONTRACT_TYPE_FRAMEWORK = "framework"

    def __init__(self) -> None:
        super().__init__(SalesContract)
        self.business_config_service = BusinessConfigService()
        self.term_service = SalesContractTermService()

    async def _resolve_contract_terms(
        self,
        tenant_id: int,
        term_group_id: Optional[int],
        contract_terms=None,
    ) -> tuple[Optional[int], Optional[str], Optional[list]]:
        if contract_terms is not None:
            group_name = None
            if term_group_id:
                group = await SalesContractTermGroup.get_or_none(
                    tenant_id=tenant_id, id=term_group_id, deleted_at__isnull=True
                )
                group_name = group.group_name if group else None
            snapshot = [
                t.model_dump() if hasattr(t, "model_dump") else dict(t)
                for t in contract_terms
            ]
            return term_group_id, group_name, snapshot
        if term_group_id:
            return await self.term_service.build_terms_snapshot(tenant_id, term_group_id)
        return None, None, None

    @staticmethod
    def _remaining(contract: SalesContract) -> tuple[Decimal, Decimal]:
        total_qty = Decimal(str(contract.total_quantity or 0))
        total_amt = Decimal(str(contract.total_amount or 0))
        rel_qty = Decimal(str(contract.released_quantity or 0))
        rel_amt = Decimal(str(contract.released_amount or 0))
        return max(Decimal("0"), total_qty - rel_qty), max(Decimal("0"), total_amt - rel_amt)

    @staticmethod
    def _line_remaining_qty(item: SalesContractItem) -> Decimal:
        return max(
            Decimal("0"),
            Decimal(str(item.contract_quantity or 0)) - Decimal(str(item.released_quantity or 0)),
        )

    @staticmethod
    def _line_release_amount(item: SalesContractItem, release_qty: Decimal) -> Decimal:
        contract_qty = Decimal(str(item.contract_quantity or 0))
        if contract_qty <= 0 or release_qty <= 0:
            return Decimal("0")
        total_amt = Decimal(str(item.total_amount or 0))
        return (total_amt * release_qty / contract_qty).quantize(Decimal("0.01"))

    @staticmethod
    def _contract_capability_context(
        contract: SalesContract,
        items: Optional[List[SalesContractItem]] = None,
    ) -> dict[str, Any]:
        has_items = bool(items) if items is not None else True
        has_releasable = False
        if items:
            for it in items:
                if SalesContractService._line_remaining_qty(it) > Decimal("0"):
                    has_releasable = True
                    break
        rem_qty, rem_amt = SalesContractService._remaining(contract)
        return {
            "has_items": has_items,
            "has_releasable_items": has_releasable,
            "remaining_amount": rem_amt,
            "remaining_quantity": rem_qty,
        }

    def _contract_to_response(
        self,
        contract: SalesContract,
        items: Optional[List[SalesContractItem]] = None,
        milestones: Optional[List[SalesContractMilestone]] = None,
    ) -> SalesContractResponse:
        rem_qty, rem_amt = self._remaining(contract)
        payload = {
            "id": contract.id,
            "uuid": str(contract.uuid),
            "tenant_id": contract.tenant_id,
            "contract_code": contract.contract_code,
            "contract_type": contract.contract_type,
            "party_type": contract.party_type,
            "customer_id": contract.customer_id,
            "customer_name": contract.customer_name,
            "customer_contact": contract.customer_contact,
            "customer_phone": contract.customer_phone,
            "contract_date": contract.contract_date,
            "valid_from": contract.valid_from,
            "valid_to": contract.valid_to,
            "total_quantity": contract.total_quantity,
            "total_amount": contract.total_amount,
            "discount_amount": getattr(contract, "discount_amount", None) or Decimal("0"),
            "released_quantity": contract.released_quantity,
            "released_amount": contract.released_amount,
            "remaining_quantity": rem_qty,
            "remaining_amount": rem_amt,
            "price_type": contract.price_type,
            "currency_code": contract.currency_code,
            "status": contract.status,
            "review_status": contract.review_status,
            "reviewer_id": contract.reviewer_id,
            "reviewer_name": contract.reviewer_name,
            "review_time": contract.review_time,
            "review_remarks": contract.review_remarks,
            "salesman_id": contract.salesman_id,
            "salesman_name": contract.salesman_name,
            "shipping_address": contract.shipping_address,
            "shipping_method": contract.shipping_method,
            "payment_terms": contract.payment_terms,
            "term_group_id": contract.term_group_id,
            "term_group_name": contract.term_group_name,
            "contract_terms": contract.contract_terms,
            "quotation_id": contract.quotation_id,
            "quotation_code": contract.quotation_code,
            "root_contract_id": contract.root_contract_id,
            "version_no": contract.version_no,
            "previous_contract_id": contract.previous_contract_id,
            "notes": contract.notes,
            "attachments": contract.attachments,
            "is_active": contract.is_active,
            "created_by": contract.created_by,
            "updated_by": contract.updated_by,
            "created_at": contract.created_at,
            "updated_at": contract.updated_at,
        }
        if items is not None:
            payload["items"] = [
                SalesContractItemResponse(
                    id=it.id,
                    uuid=str(it.uuid),
                    tenant_id=it.tenant_id,
                    contract_id=it.contract_id,
                    material_id=it.material_id,
                    material_code=it.material_code,
                    material_name=it.material_name,
                    material_spec=it.material_spec,
                    material_unit=it.material_unit,
                    contract_quantity=it.contract_quantity,
                    released_quantity=it.released_quantity,
                    unit_price=it.unit_price,
                    tax_rate=it.tax_rate,
                    total_amount=it.total_amount,
                    variant_attributes=it.variant_attributes,
                    delivery_date=it.delivery_date,
                    notes=it.notes,
                    created_at=it.created_at,
                    updated_at=it.updated_at,
                )
                for it in items
            ]
        if milestones is not None:
            payload["milestones"] = [
                SalesContractMilestoneResponse(
                    id=m.id,
                    uuid=str(m.uuid),
                    tenant_id=m.tenant_id,
                    contract_id=m.contract_id,
                    milestone_name=m.milestone_name,
                    planned_date=m.planned_date,
                    planned_amount=m.planned_amount,
                    planned_ratio=m.planned_ratio,
                    billing_trigger=m.billing_trigger,
                    status=m.status,
                    receivable_id=m.receivable_id,
                    receivable_code=m.receivable_code,
                    notes=m.notes,
                    created_at=m.created_at,
                    updated_at=m.updated_at,
                )
                for m in milestones
            ]
        payload["lifecycle"] = get_sales_contract_lifecycle(contract)
        ctx = self._contract_capability_context(contract, items)
        return enrich_sales_contract_capabilities_on_response(
            contract,
            SalesContractResponse(**payload),
            has_items=ctx["has_items"],
            has_releasable_items=ctx["has_releasable_items"],
            remaining_amount=ctx["remaining_amount"],
        )

    async def _generate_contract_code(self, tenant_id: int, contract_date: date) -> str:
        from core.config.code_rule_pages import CODE_RULE_PAGES
        from core.services.business.code_generation_service import CodeGenerationService

        rule_code = next(
            (p.get("rule_code") for p in CODE_RULE_PAGES if p.get("page_code") == "kuaizhizao-sales-contract"),
            "KUAIZHIZAO_SALES_CONTRACT",
        )
        return await CodeGenerationService().generate_code(
            tenant_id=tenant_id,
            rule_code=rule_code,
            context={"date": contract_date.isoformat()},
        )

    async def _generate_change_code(self, tenant_id: int) -> str:
        from core.services.business.code_generation_service import CodeGenerationService

        rule_code = next(
            (p.get("rule_code") for p in CODE_RULE_PAGES if p.get("page_code") == "kuaizhizao-sales-contract-change"),
            "KUAIZHIZAO_SALES_CONTRACT_CHANGE",
        )
        return await CodeGenerationService().generate_code(
            tenant_id=tenant_id,
            rule_code=rule_code,
            context={"date": date.today().isoformat()},
        )

    @staticmethod
    def _sum_items(items: List[SalesContractItemCreate]) -> tuple[Decimal, Decimal]:
        total_qty = Decimal("0")
        total_amt = Decimal("0")
        for it in items:
            total_qty += Decimal(str(it.contract_quantity or 0))
            total_amt += Decimal(str(it.total_amount or 0))
        return total_qty, total_amt

    @staticmethod
    def _apply_header_discount(
        goods_incl: Decimal,
        discount_amount: Optional[Decimal],
    ) -> tuple[Decimal, Decimal]:
        discount = Decimal(str(discount_amount or 0))
        if discount < Decimal("0"):
            raise ValidationError("整单优惠不能为负数")
        if discount > goods_incl:
            raise ValidationError("整单优惠不能大于价税合计")
        net = (goods_incl - discount).quantize(Decimal("0.01"), rounding=ROUND_HALF_UP)
        return discount, net

    async def _refresh_contract_totals(
        self,
        tenant_id: int,
        contract_id: int,
        discount_amount: Optional[Decimal] = None,
    ) -> None:
        contract = await SalesContract.get(id=contract_id)
        items = await SalesContractItem.filter(tenant_id=tenant_id, contract_id=contract_id).order_by("id")
        total_qty = sum((it.contract_quantity or Decimal("0")) for it in items)
        goods_incl = sum((it.total_amount or Decimal("0")) for it in items)
        discount_val = (
            discount_amount
            if discount_amount is not None
            else getattr(contract, "discount_amount", None) or Decimal("0")
        )
        discount, net_amt = self._apply_header_discount(goods_incl, discount_val)
        await SalesContract.filter(id=contract_id).update(
            total_quantity=total_qty,
            total_amount=net_amt,
            discount_amount=discount,
        )

    async def create_contract(
        self,
        tenant_id: int,
        data: SalesContractCreate,
        created_by: int,
        auto_submit: bool = False,
    ) -> SalesContractResponse:
        is_enabled = await self.business_config_service.check_node_enabled(tenant_id, "sales_contract")
        if not is_enabled:
            raise BusinessLogicError("销售合同模块未启用，无法创建销售合同")
        if not data.items:
            raise ValidationError("合同明细不能为空")
        cfg = await self.business_config_service.get_business_config(tenant_id)
        if (data.contract_type or self.CONTRACT_TYPE_SINGLE) == self.CONTRACT_TYPE_FRAMEWORK:
            if cfg.get("parameters", {}).get("sales", {}).get("contract_milestone_required") and not data.milestones:
                raise ValidationError("框架合同须维护至少一条收款里程碑")
        total_qty, total_amt = self._sum_items(data.items)
        discount, net_amt = self._apply_header_discount(
            total_amt, getattr(data, "discount_amount", None)
        )
        term_group_id, term_group_name, contract_terms = await self._resolve_contract_terms(
            tenant_id, data.term_group_id, data.contract_terms
        )
        contract_code = (data.contract_code or "").strip() if data.contract_code else ""
        if not contract_code:
            contract_code = await self._generate_contract_code(tenant_id, data.contract_date)

        try:
            return await self._create_contract_in_tx(
                tenant_id=tenant_id,
                data=data,
                contract_code=contract_code,
                total_qty=total_qty,
                net_amt=net_amt,
                discount=discount,
                term_group_id=term_group_id,
                term_group_name=term_group_name,
                contract_terms=contract_terms,
                created_by=created_by,
                auto_submit=auto_submit,
            )
        except IntegrityError:
            contract_code = await self._generate_contract_code(tenant_id, data.contract_date)
            try:
                return await self._create_contract_in_tx(
                    tenant_id=tenant_id,
                    data=data,
                    contract_code=contract_code,
                    total_qty=total_qty,
                    net_amt=net_amt,
                    discount=discount,
                    term_group_id=term_group_id,
                    term_group_name=term_group_name,
                    contract_terms=contract_terms,
                    created_by=created_by,
                    auto_submit=auto_submit,
                )
            except IntegrityError as e:
                raise ValidationError("销售合同编码已存在，请关闭页面后重新新建") from e

    async def _create_contract_in_tx(
        self,
        tenant_id: int,
        data: SalesContractCreate,
        contract_code: str,
        total_qty: Decimal,
        net_amt: Decimal,
        discount: Decimal,
        term_group_id: Optional[int],
        term_group_name: Optional[str],
        contract_terms: Optional[list],
        created_by: int,
        auto_submit: bool,
    ) -> SalesContractResponse:
        async with in_transaction():
            contract = await SalesContract.create(
                tenant_id=tenant_id,
                contract_code=contract_code,
                contract_type=data.contract_type or self.CONTRACT_TYPE_SINGLE,
                customer_id=data.customer_id,
                customer_name=data.customer_name,
                customer_contact=data.customer_contact,
                customer_phone=data.customer_phone,
                contract_date=data.contract_date,
                valid_from=data.valid_from or data.contract_date,
                valid_to=data.valid_to,
                total_quantity=total_qty,
                total_amount=net_amt,
                discount_amount=discount,
                price_type=data.price_type or "tax_exclusive",
                currency_code=data.currency_code or "CNY",
                status="草稿",
                review_status=ReviewStatus.PENDING,
                salesman_id=data.salesman_id,
                salesman_name=data.salesman_name,
                shipping_address=data.shipping_address,
                shipping_method=data.shipping_method,
                payment_terms=data.payment_terms,
                term_group_id=term_group_id,
                term_group_name=term_group_name,
                contract_terms=contract_terms,
                quotation_id=data.quotation_id,
                notes=data.notes,
                attachments=data.attachments,
                root_contract_id=None,
                version_no=1,
                created_by=created_by,
                updated_by=created_by,
            )
            if data.quotation_id:
                q = await Quotation.get_or_none(tenant_id=tenant_id, id=data.quotation_id, deleted_at__isnull=True)
                if q:
                    contract.quotation_code = q.quotation_code
                    await contract.save(update_fields=["quotation_code"])
            item_rows = []
            for it in data.items:
                item_rows.append(
                    await SalesContractItem.create(
                        tenant_id=tenant_id,
                        contract_id=contract.id,
                        material_id=it.material_id,
                        material_code=it.material_code,
                        material_name=it.material_name,
                        material_spec=it.material_spec,
                        material_unit=it.material_unit,
                        contract_quantity=it.contract_quantity,
                        unit_price=it.unit_price,
                        tax_rate=it.tax_rate or Decimal("0"),
                        total_amount=it.total_amount,
                        variant_attributes=it.variant_attributes,
                        delivery_date=it.delivery_date,
                        notes=it.notes,
                    )
                )
            milestone_rows = []
            for ms in data.milestones or []:
                milestone_rows.append(
                    await SalesContractMilestone.create(
                        tenant_id=tenant_id,
                        contract_id=contract.id,
                        milestone_name=ms.milestone_name,
                        planned_date=ms.planned_date,
                        planned_amount=ms.planned_amount,
                        planned_ratio=ms.planned_ratio,
                        billing_trigger=ms.billing_trigger or "milestone",
                        notes=ms.notes,
                    )
                )
            contract.root_contract_id = contract.id
            await contract.save(update_fields=["root_contract_id"])
        if auto_submit:
            return await self.submit_contract(tenant_id, contract.id, created_by)
        items = await SalesContractItem.filter(tenant_id=tenant_id, contract_id=contract.id).order_by("id")
        milestones = await SalesContractMilestone.filter(tenant_id=tenant_id, contract_id=contract.id).order_by("id")
        return self._contract_to_response(contract, items, milestones)

    async def list_contracts(
        self,
        tenant_id: int,
        skip: int = 0,
        limit: int = 100,
        status: Optional[str] = None,
        contract_type: Optional[str] = None,
        keyword: Optional[str] = None,
        customer_id: Optional[int] = None,
    ) -> SalesContractListResponse:
        qs = SalesContract.filter(tenant_id=tenant_id, deleted_at__isnull=True)
        if status:
            qs = qs.filter(status=status)
        if contract_type:
            qs = qs.filter(contract_type=contract_type)
        if customer_id:
            qs = qs.filter(customer_id=customer_id)
        if keyword:
            qs = qs.filter(Q(contract_code__icontains=keyword) | Q(customer_name__icontains=keyword))
        total = await qs.count()
        rows = await qs.order_by("-contract_date", "-id").offset(skip).limit(limit)
        from core.services.approval.audit_record_enricher import enrich_items

        items = await enrich_items(
            tenant_id,
            "sales_contract",
            [self._contract_to_response(r) for r in rows],
        )
        return SalesContractListResponse(
            items=items,
            total=total,
        )

    async def get_contract_by_id(
        self,
        tenant_id: int,
        contract_id: int,
        include_items: bool = True,
    ) -> SalesContractResponse:
        contract = await SalesContract.get_or_none(tenant_id=tenant_id, id=contract_id, deleted_at__isnull=True)
        if not contract:
            raise NotFoundError("销售合同不存在")
        items = None
        milestones = None
        if include_items:
            items = await SalesContractItem.filter(tenant_id=tenant_id, contract_id=contract_id).order_by("id")
            milestones = await SalesContractMilestone.filter(tenant_id=tenant_id, contract_id=contract_id).order_by("id")
        resp = self._contract_to_response(contract, items, milestones)
        from core.services.approval.audit_record_enricher import enrich_record

        return await enrich_record(tenant_id, "sales_contract", resp)

    async def update_contract(
        self,
        tenant_id: int,
        contract_id: int,
        data: SalesContractUpdate,
        updated_by: int,
        approval_edit_context: Optional[Dict[str, Any]] = None,
        approval_edit_comment: Optional[str] = None,
    ) -> SalesContractResponse:
        contract = await SalesContract.get_or_none(tenant_id=tenant_id, id=contract_id, deleted_at__isnull=True)
        if not contract:
            raise NotFoundError("销售合同不存在")
        assert_sales_contract_capability(contract, "update")
        is_draft = (contract.status or "") in ("草稿",)
        is_pending = (contract.status or "") in ("待审核",)
        if not is_draft:
            if not (is_pending and approval_edit_context):
                if is_pending and not approval_edit_context:
                    from core.services.approval.approval_edit_guard import ApprovalEditGuard

                    edit_ctx = await ApprovalEditGuard.get_pending_edit_context(
                        tenant_id, "sales_contract", contract_id, updated_by
                    )
                    if not edit_ctx:
                        raise BusinessLogicError("单据审核中，仅已开启改单权限的当前审批人可修改")
                    approval_edit_context = edit_ctx
                else:
                    raise BusinessLogicError("仅草稿状态合同可编辑")

        if approval_edit_context:
            from core.config.audit_editable_fields import is_field_editable

            node_editable = approval_edit_context.get("editable_fields")
            preview = data.model_dump(exclude_unset=True, exclude={"items", "milestones", "contract_terms"})
            for field in preview:
                if field in ("updated_by",):
                    continue
                if not is_field_editable("sales_contract", field, node_editable):
                    raise ValidationError(f"字段「{field}」不允许在审核中修改")
            if data.items is not None and not is_field_editable("sales_contract", "items", node_editable):
                raise ValidationError("字段「合同明细」不允许在审核中修改")
            if data.milestones is not None and not is_field_editable("sales_contract", "milestones", node_editable):
                raise ValidationError("字段「合同里程碑」不允许在审核中修改")
            if data.contract_terms is not None and not is_field_editable(
                "sales_contract", "contract_terms", node_editable
            ):
                raise ValidationError("字段「合同条款」不允许在审核中修改")

        async with in_transaction():
            update_fields = data.model_dump(exclude_unset=True, exclude={"items", "milestones", "contract_terms"})
            if "term_group_id" in data.model_fields_set or data.contract_terms is not None:
                term_group_id, term_group_name, contract_terms = await self._resolve_contract_terms(
                    tenant_id,
                    data.term_group_id if "term_group_id" in data.model_fields_set else contract.term_group_id,
                    data.contract_terms,
                )
                contract.term_group_id = term_group_id
                contract.term_group_name = term_group_name
                contract.contract_terms = contract_terms
            elif "term_group_id" in update_fields and data.term_group_id is None:
                contract.term_group_id = None
                contract.term_group_name = None
                contract.contract_terms = None
            for k, v in update_fields.items():
                setattr(contract, k, v)
            contract.updated_by = updated_by
            if data.items is not None:
                if not data.items:
                    raise ValidationError("合同明细不能为空")
                await SalesContractItem.filter(tenant_id=tenant_id, contract_id=contract_id).delete()
                for it in data.items:
                    await SalesContractItem.create(
                        tenant_id=tenant_id,
                        contract_id=contract_id,
                        material_id=it.material_id,
                        material_code=it.material_code,
                        material_name=it.material_name,
                        material_spec=it.material_spec,
                        material_unit=it.material_unit,
                        contract_quantity=it.contract_quantity,
                        unit_price=it.unit_price,
                        tax_rate=it.tax_rate or Decimal("0"),
                        total_amount=it.total_amount,
                        variant_attributes=it.variant_attributes,
                        delivery_date=it.delivery_date,
                        notes=it.notes,
                    )
                await self._refresh_contract_totals(
                    tenant_id,
                    contract_id,
                    getattr(data, "discount_amount", None),
                )
            elif data.discount_amount is not None:
                await self._refresh_contract_totals(
                    tenant_id,
                    contract_id,
                    data.discount_amount,
                )
            if data.items is not None or data.discount_amount is not None:
                refreshed = await SalesContract.get(id=contract_id)
                contract.total_quantity = refreshed.total_quantity
                contract.total_amount = refreshed.total_amount
                contract.discount_amount = refreshed.discount_amount
            if data.milestones is not None:
                await SalesContractMilestone.filter(tenant_id=tenant_id, contract_id=contract_id).delete()
                for ms in data.milestones:
                    await SalesContractMilestone.create(
                        tenant_id=tenant_id,
                        contract_id=contract_id,
                        milestone_name=ms.milestone_name,
                        planned_date=ms.planned_date,
                        planned_amount=ms.planned_amount,
                        planned_ratio=ms.planned_ratio,
                        billing_trigger=ms.billing_trigger or "milestone",
                        notes=ms.notes,
                    )
            await contract.save()
        return await self.get_contract_by_id(tenant_id, contract_id)

    async def delete_contract(self, tenant_id: int, contract_id: int, deleted_by: int) -> None:
        contract = await SalesContract.get_or_none(tenant_id=tenant_id, id=contract_id, deleted_at__isnull=True)
        if not contract:
            raise NotFoundError("销售合同不存在")
        assert_sales_contract_capability(contract, "delete")
        from apps.kuaizhizao.models.sales_opportunity import SalesOpportunity
        from apps.kuaizhizao.models.document_relation import DocumentRelation

        async with in_transaction():
            contract.deleted_at = datetime.now()
            contract.updated_by = deleted_by
            await contract.save(update_fields=["deleted_at", "updated_by"])
            await Quotation.filter(tenant_id=tenant_id, contract_id=contract_id).update(
                contract_id=None,
                contract_code=None,
                updated_by=deleted_by,
            )
            await SalesOpportunity.filter(tenant_id=tenant_id, contract_id=contract_id).update(
                contract_id=None,
                contract_code=None,
            )
            await DocumentRelation.filter(
                tenant_id=tenant_id,
                target_type="sales_contract",
                target_id=contract_id,
            ).delete()
            await DocumentRelation.filter(
                tenant_id=tenant_id,
                source_type="sales_contract",
                source_id=contract_id,
            ).delete()

    async def submit_contract(self, tenant_id: int, contract_id: int, submitted_by: int) -> SalesContractResponse:
        contract = await SalesContract.get_or_none(tenant_id=tenant_id, id=contract_id, deleted_at__isnull=True)
        if not contract:
            raise NotFoundError("销售合同不存在")
        assert_sales_contract_capability(contract, "submit")
        contract.status = "待审核"
        contract.review_status = ReviewStatus.PENDING
        contract.updated_by = submitted_by
        await contract.save()
        return await self.get_contract_by_id(tenant_id, contract_id)

    async def approve_contract(
        self,
        tenant_id: int,
        contract_id: int,
        reviewer_id: int,
        reviewer_name: str,
        review_remarks: Optional[str] = None,
    ) -> SalesContractResponse:
        contract = await SalesContract.get_or_none(tenant_id=tenant_id, id=contract_id, deleted_at__isnull=True)
        if not contract:
            raise NotFoundError("销售合同不存在")
        assert_sales_contract_capability(contract, "approve")
        contract.status = "已生效"
        contract.review_status = ReviewStatus.APPROVED
        contract.reviewer_id = reviewer_id
        contract.reviewer_name = reviewer_name
        contract.review_time = datetime.now()
        contract.review_remarks = review_remarks
        contract.updated_by = reviewer_id
        await contract.save()
        return await self.get_contract_by_id(tenant_id, contract_id)

    async def reject_contract(
        self,
        tenant_id: int,
        contract_id: int,
        reviewer_id: int,
        reviewer_name: str,
        review_remarks: Optional[str] = None,
    ) -> SalesContractResponse:
        contract = await SalesContract.get_or_none(tenant_id=tenant_id, id=contract_id, deleted_at__isnull=True)
        if not contract:
            raise NotFoundError("销售合同不存在")
        assert_sales_contract_capability(contract, "reject")
        contract.status = "草稿"
        contract.review_status = ReviewStatus.REJECTED
        contract.reviewer_id = reviewer_id
        contract.reviewer_name = reviewer_name
        contract.review_time = datetime.now()
        contract.review_remarks = review_remarks
        contract.updated_by = reviewer_id
        await contract.save()
        return await self.get_contract_by_id(tenant_id, contract_id)

    async def withdraw_contract(
        self,
        tenant_id: int,
        contract_id: int,
        operator_id: int,
    ) -> SalesContractResponse:
        """撤回提交：待审核 → 草稿。"""
        contract = await SalesContract.get_or_none(
            tenant_id=tenant_id, id=contract_id, deleted_at__isnull=True
        )
        if not contract:
            raise NotFoundError("销售合同不存在")
        assert_sales_contract_capability(contract, "withdraw_submit")
        contract.status = "草稿"
        contract.review_status = ReviewStatus.PENDING.value
        contract.reviewer_id = None
        contract.reviewer_name = None
        contract.review_time = None
        contract.review_remarks = None
        contract.updated_by = operator_id
        await contract.save()
        return await self.get_contract_by_id(tenant_id, contract_id)

    async def revoke_contract_approval(
        self,
        tenant_id: int,
        contract_id: int,
        operator_id: int,
    ) -> SalesContractResponse:
        """撤回审核：已生效且未释放 → 待审核。"""
        contract = await SalesContract.get_or_none(
            tenant_id=tenant_id, id=contract_id, deleted_at__isnull=True
        )
        if not contract:
            raise NotFoundError("销售合同不存在")
        assert_sales_contract_capability(contract, "revoke_approval")
        contract.status = "待审核"
        contract.review_status = ReviewStatus.PENDING.value
        contract.reviewer_id = None
        contract.reviewer_name = None
        contract.review_time = None
        contract.review_remarks = None
        contract.updated_by = operator_id
        await contract.save()
        return await self.get_contract_by_id(tenant_id, contract_id)

    async def _ensure_contract_effective(self, contract: SalesContract) -> None:
        st = (contract.status or "").strip()
        if st not in ("已生效", "执行中"):
            raise BusinessLogicError("合同须已生效后方可下推销售订单")
        if not _is_approved(contract.review_status):
            raise BusinessLogicError("合同未审核通过")
        today = date.today()
        if contract.valid_to and contract.valid_to < today:
            raise BusinessLogicError("合同已过期，无法下推订单")
        if contract.valid_from and contract.valid_from > today:
            raise BusinessLogicError("合同尚未到生效日期")

    async def _validate_release_capacity(
        self,
        contract: SalesContract,
        order_qty: Decimal,
        order_amt: Decimal,
        item_quantities: Optional[dict[int, Decimal]] = None,
    ) -> None:
        rem_qty, rem_amt = self._remaining(contract)
        if order_amt > rem_amt:
            raise BusinessLogicError(f"订单金额 {order_amt} 超过合同剩余额度 {rem_amt}")
        if contract.contract_type == self.CONTRACT_TYPE_SINGLE and rem_amt <= Decimal("0"):
            raise BusinessLogicError("单次合同已释放完毕")
        if contract.contract_type == self.CONTRACT_TYPE_FRAMEWORK:
            if order_qty > rem_qty:
                raise BusinessLogicError(f"订单数量 {order_qty} 超过合同剩余数量 {rem_qty}")
            if item_quantities:
                contract_items = await SalesContractItem.filter(
                    tenant_id=contract.tenant_id, contract_id=contract.id
                )
                by_id = {int(it.id): it for it in contract_items}
                for item_id, qty in item_quantities.items():
                    row = by_id.get(item_id)
                    if not row:
                        raise BusinessLogicError(f"合同明细 {item_id} 不存在")
                    line_rem = self._line_remaining_qty(row)
                    if qty > line_rem:
                        raise BusinessLogicError(
                            f"物料 {row.material_code} 释放数量 {qty} 超过行剩余 {line_rem}"
                        )

    async def _maybe_auto_close_contract(self, tenant_id: int, contract: SalesContract) -> None:
        cfg = await self.business_config_service.get_business_config(tenant_id)
        if not cfg.get("parameters", {}).get("sales", {}).get("contract_auto_close_on_full_release", True):
            return
        rem_qty, rem_amt = self._remaining(contract)
        if rem_amt <= Decimal("0") and (contract.status or "") in ("已生效", "执行中"):
            contract.status = "已关闭"
            await contract.save(update_fields=["status", "updated_at"])

    async def _apply_release_to_contract(
        self,
        contract: SalesContract,
        order_qty: Decimal,
        order_amt: Decimal,
        item_quantities: Optional[dict[int, Decimal]] = None,
    ) -> None:
        contract.released_quantity = Decimal(str(contract.released_quantity or 0)) + order_qty
        contract.released_amount = Decimal(str(contract.released_amount or 0)) + order_amt
        if contract.status == "已生效":
            contract.status = "执行中"
        await contract.save(update_fields=["released_quantity", "released_amount", "status", "updated_at"])
        if item_quantities:
            contract_items = await SalesContractItem.filter(
                tenant_id=contract.tenant_id, contract_id=contract.id
            )
            by_id = {int(it.id): it for it in contract_items}
            for item_id, qty in item_quantities.items():
                row = by_id.get(item_id)
                if row:
                    row.released_quantity = Decimal(str(row.released_quantity or 0)) + qty
                    await row.save(update_fields=["released_quantity", "updated_at"])
        await self._maybe_auto_close_contract(contract.tenant_id, contract)

    async def rollback_release_for_sales_order(
        self,
        tenant_id: int,
        sales_order_id: int,
        operator_id: Optional[int] = None,
    ) -> None:
        from apps.kuaizhizao.models.sales_order import SalesOrder
        from apps.kuaizhizao.models.sales_order_item import SalesOrderItem

        order = await SalesOrder.get_or_none(tenant_id=tenant_id, id=sales_order_id, deleted_at__isnull=True)
        if not order or not getattr(order, "contract_id", None):
            return
        contract = await SalesContract.get_or_none(
            tenant_id=tenant_id, id=int(order.contract_id), deleted_at__isnull=True
        )
        if not contract:
            return
        order_items = await SalesOrderItem.filter(tenant_id=tenant_id, sales_order_id=sales_order_id)
        contract_items = await SalesContractItem.filter(tenant_id=tenant_id, contract_id=contract.id)
        by_material = {int(it.material_id): it for it in contract_items}
        item_qty_map: dict[int, Decimal] = {}
        order_qty = Decimal("0")
        order_amt = Decimal(str(order.total_amount or 0))
        for oi in order_items:
            qty = Decimal(str(getattr(oi, "order_quantity", None) or 0))
            order_qty += qty
            ci = by_material.get(int(oi.material_id)) if oi.material_id else None
            if ci:
                item_qty_map[int(ci.id)] = item_qty_map.get(int(ci.id), Decimal("0")) + qty
        contract.released_quantity = max(
            Decimal("0"), Decimal(str(contract.released_quantity or 0)) - order_qty
        )
        contract.released_amount = max(
            Decimal("0"), Decimal(str(contract.released_amount or 0)) - order_amt
        )
        if (contract.status or "") == "已关闭":
            contract.status = "执行中"
        if operator_id:
            contract.updated_by = operator_id
        await contract.save(
            update_fields=["released_quantity", "released_amount", "status", "updated_by", "updated_at"]
        )
        for item_id, qty in item_qty_map.items():
            for ci in contract_items:
                if int(ci.id) == item_id:
                    ci.released_quantity = max(
                        Decimal("0"), Decimal(str(ci.released_quantity or 0)) - qty
                    )
                    await ci.save(update_fields=["released_quantity", "updated_at"])
                    break

    async def close_contract(
        self, tenant_id: int, contract_id: int, operator_id: int, reason: Optional[str] = None
    ) -> SalesContractResponse:
        contract = await SalesContract.get_or_none(tenant_id=tenant_id, id=contract_id, deleted_at__isnull=True)
        if not contract:
            raise NotFoundError("销售合同不存在")
        assert_sales_contract_capability(contract, "close")
        contract.status = "已关闭"
        contract.updated_by = operator_id
        if reason:
            contract.notes = ((contract.notes or "") + f"\n关闭原因: {reason}").strip()
        await contract.save(update_fields=["status", "notes", "updated_by", "updated_at"])
        return await self.get_contract_by_id(tenant_id, contract_id)

    async def expire_contract(self, tenant_id: int, contract_id: int, operator_id: int) -> SalesContractResponse:
        contract = await SalesContract.get_or_none(tenant_id=tenant_id, id=contract_id, deleted_at__isnull=True)
        if not contract:
            raise NotFoundError("销售合同不存在")
        contract.status = "已到期"
        contract.updated_by = operator_id
        await contract.save(update_fields=["status", "updated_by", "updated_at"])
        return await self.get_contract_by_id(tenant_id, contract_id)

    async def expire_due_contracts(self, tenant_id: int) -> int:
        today = date.today()
        rows = await SalesContract.filter(
            tenant_id=tenant_id,
            deleted_at__isnull=True,
            valid_to__lt=today,
            status__in=["已生效", "执行中"],
        )
        count = 0
        for c in rows:
            c.status = "已到期"
            await c.save(update_fields=["status", "updated_at"])
            count += 1
        return count

    def _resolve_release_plan(
        self,
        items: List[SalesContractItem],
        selected_item_ids: Optional[List[int]] = None,
        release_lines: Optional[List[SalesContractReleaseLine]] = None,
    ) -> tuple[List[tuple[SalesContractItem, Decimal]], dict[int, Decimal], Decimal, Decimal]:
        by_id = {int(it.id): it for it in items}
        plan: List[tuple[SalesContractItem, Decimal]] = []
        if release_lines:
            for line in release_lines:
                row = by_id.get(int(line.item_id))
                if not row:
                    raise BusinessLogicError(f"合同明细 {line.item_id} 不存在")
                qty = Decimal(str(line.release_quantity))
                if qty <= 0:
                    raise BusinessLogicError(f"释放数量须大于 0: {line.item_id}")
                rem = self._line_remaining_qty(row)
                if qty > rem:
                    raise BusinessLogicError(f"物料 {row.material_code} 释放数量 {qty} 超过剩余 {rem}")
                plan.append((row, qty))
        elif selected_item_ids:
            selected = {int(x) for x in selected_item_ids}
            for it in items:
                if int(it.id) in selected:
                    rem = self._line_remaining_qty(it)
                    if rem > 0:
                        plan.append((it, rem))
        else:
            for it in items:
                rem = self._line_remaining_qty(it)
                if rem > 0:
                    plan.append((it, rem))
        if not plan:
            raise BusinessLogicError("无可释放的合同明细")
        item_qty_map = {int(it.id): qty for it, qty in plan}
        order_qty = sum(qty for _, qty in plan)
        order_amt = sum(self._line_release_amount(it, qty) for it, qty in plan)
        return plan, item_qty_map, order_qty, order_amt

    async def convert_from_quotation(
        self,
        tenant_id: int,
        quotation_id: int,
        created_by: int,
        contract_type: str = "single",
    ) -> SalesContractResponse:
        from apps.kuaizhizao.services.quotation_service import QuotationService

        quotation_svc = QuotationService()
        await quotation_svc._detach_quotation_if_contract_deleted(
            tenant_id, quotation_id, created_by
        )
        quotation = await Quotation.get_or_none(tenant_id=tenant_id, id=quotation_id, deleted_at__isnull=True)
        if not quotation:
            raise NotFoundError("报价单不存在")
        from infra.services.business_config_service import BusinessConfigService
        from apps.kuaizhizao.services.document_action_policy import assert_quotation_capability

        audit_required = await BusinessConfigService().check_audit_required(
            tenant_id, "quotation"
        )
        contract_missing = await QuotationService._quotation_contract_downstream_missing(
            tenant_id, quotation
        )
        assert_quotation_capability(
            quotation,
            "convert_to_contract",
            audit_required=audit_required,
            contract_downstream_missing=contract_missing,
        )
        items = await QuotationItem.filter(tenant_id=tenant_id, quotation_id=quotation_id).order_by("id")
        if not items:
            raise BusinessLogicError("报价单无明细")
        create_data = SalesContractCreate(
            contract_type=contract_type,
            customer_id=quotation.customer_id,
            customer_name=quotation.customer_name,
            customer_contact=quotation.customer_contact,
            customer_phone=quotation.customer_phone,
            contract_date=quotation.quotation_date,
            valid_from=quotation.quotation_date,
            valid_to=quotation.valid_until,
            price_type=getattr(quotation, "price_type", None) or "tax_exclusive",
            currency_code=quotation.currency_code or "CNY",
            salesman_id=quotation.salesman_id,
            salesman_name=quotation.salesman_name,
            shipping_address=quotation.shipping_address,
            shipping_method=quotation.shipping_method,
            payment_terms=quotation.payment_terms,
            quotation_id=quotation_id,
            discount_amount=getattr(quotation, "discount_amount", None) or Decimal("0"),
            notes=quotation.notes,
            items=[
                SalesContractItemCreate(
                    material_id=it.material_id,
                    material_code=it.material_code,
                    material_name=it.material_name,
                    material_spec=it.material_spec,
                    material_unit=it.material_unit,
                    contract_quantity=it.quote_quantity,
                    unit_price=it.unit_price,
                    tax_rate=getattr(it, "tax_rate", None) or Decimal("0"),
                    total_amount=it.total_amount,
                    variant_attributes=getattr(it, "variant_attributes", None),
                    delivery_date=it.delivery_date,
                    notes=it.notes,
                )
                for it in items
            ],
        )
        from apps.kuaizhizao.models.sales_opportunity import SalesOpportunity
        from apps.kuaizhizao.services.document_relation_new_service import DocumentRelationNewService
        from apps.kuaizhizao.schemas.document_relation import DocumentRelationCreate

        raw_push_mode = await self.business_config_service.get_push_default_mode(tenant_id)
        push_as_confirm = str(raw_push_mode or "").strip().lower() == "confirm"

        async with in_transaction():
            contract_resp = await self.create_contract(
                tenant_id, create_data, created_by, auto_submit=push_as_confirm
            )
            await Quotation.filter(id=quotation_id).update(
                contract_id=contract_resp.id,
                contract_code=contract_resp.contract_code,
                updated_by=created_by,
            )
            await SalesOpportunity.filter(tenant_id=tenant_id, quotation_id=quotation_id).update(
                contract_id=contract_resp.id,
                contract_code=contract_resp.contract_code,
            )
            await DocumentRelationNewService().create_relation(
                tenant_id=tenant_id,
                relation_data=DocumentRelationCreate(
                    source_type="quotation",
                    source_id=quotation_id,
                    source_code=quotation.quotation_code,
                    source_name=quotation.quotation_code,
                    target_type="sales_contract",
                    target_id=contract_resp.id,
                    target_code=contract_resp.contract_code,
                    target_name=contract_resp.contract_code,
                    relation_type="source",
                    relation_mode="push",
                    relation_desc="报价单转销售合同",
                ),
                created_by=created_by,
            )
        return contract_resp

    async def convert_to_sales_order(
        self,
        tenant_id: int,
        contract_id: int,
        created_by: int,
        selected_item_ids: Optional[List[int]] = None,
        release_lines: Optional[List[SalesContractReleaseLine]] = None,
    ):
        contract = await SalesContract.get_or_none(tenant_id=tenant_id, id=contract_id, deleted_at__isnull=True)
        if not contract:
            raise NotFoundError("销售合同不存在")
        all_items = await SalesContractItem.filter(tenant_id=tenant_id, contract_id=contract_id).order_by("id")
        ctx = self._contract_capability_context(contract, all_items)
        assert_sales_contract_capability(
            contract,
            "push_to_sales_order",
            has_items=ctx["has_items"],
            has_releasable_items=ctx["has_releasable_items"],
            remaining_amount=ctx["remaining_amount"],
        )
        if not all_items:
            raise BusinessLogicError("合同无明细")
        plan, item_qty_map, order_qty, order_amt = self._resolve_release_plan(
            all_items, selected_item_ids=selected_item_ids, release_lines=release_lines
        )
        await self._validate_release_capacity(contract, order_qty, order_amt, item_qty_map)

        valid_dates = [it.delivery_date for it, _ in plan if it.delivery_date]
        delivery_date = min(valid_dates) if valid_dates else contract.contract_date
        so_items = [
            SalesOrderItemCreate(
                material_id=it.material_id,
                material_code=it.material_code,
                material_name=it.material_name,
                material_spec=it.material_spec,
                material_unit=it.material_unit,
                required_quantity=qty,
                delivery_date=it.delivery_date or delivery_date,
                unit_price=it.unit_price,
                tax_rate=it.tax_rate or Decimal("0"),
                variant_attributes=it.variant_attributes,
                item_amount=self._line_release_amount(it, qty),
                notes=it.notes,
            )
            for it, qty in plan
        ]
        full_goods = sum((it.total_amount or Decimal("0")) for it in all_items)
        contract_discount = Decimal(str(getattr(contract, "discount_amount", None) or 0))
        if full_goods > 0 and order_amt < full_goods - Decimal("0.005"):
            discount = (contract_discount * order_amt / full_goods).quantize(
                Decimal("0.01"), rounding=ROUND_HALF_UP
            )
        else:
            discount = contract_discount
        so_create = SalesOrderCreate(
            order_date=date.today(),
            delivery_date=delivery_date,
            customer_id=contract.customer_id,
            customer_name=contract.customer_name,
            customer_contact=contract.customer_contact,
            customer_phone=contract.customer_phone,
            total_quantity=order_qty,
            discount_amount=discount,
            price_type=contract.price_type,
            status=DemandStatus.DRAFT,
            review_status=ReviewStatus.PENDING,
            salesman_id=contract.salesman_id,
            salesman_name=contract.salesman_name,
            shipping_address=contract.shipping_address,
            shipping_method=contract.shipping_method,
            payment_terms=contract.payment_terms,
            contract_id=contract.id,
            contract_code=contract.contract_code,
            is_release_order=contract.contract_type == self.CONTRACT_TYPE_FRAMEWORK,
            currency_code=contract.currency_code or "CNY",
            notes=contract.notes or f"由销售合同 {contract.contract_code} 释放",
            items=so_items,
        )
        from apps.kuaizhizao.services.sales_order_service import SalesOrderService

        sales_order_service = SalesOrderService()
        sales_order = await sales_order_service.create_sales_order(
            tenant_id=tenant_id,
            sales_order_data=so_create,
            created_by=created_by,
        )
        await self._apply_release_to_contract(contract, order_qty, order_amt, item_qty_map)
        sales_order = await sales_order_service.apply_push_default_mode_after_create(
            tenant_id=tenant_id,
            sales_order_id=int(sales_order.id),
            created_by=created_by,
        )
        from apps.kuaizhizao.services.document_relation_new_service import DocumentRelationNewService
        from apps.kuaizhizao.schemas.document_relation import DocumentRelationCreate

        await DocumentRelationNewService().create_relation(
            tenant_id=tenant_id,
            relation_data=DocumentRelationCreate(
                source_type="sales_contract",
                source_id=contract_id,
                source_code=contract.contract_code,
                source_name=contract.contract_code,
                target_type="sales_order",
                target_id=sales_order.id,
                target_code=sales_order.order_code,
                target_name=sales_order.order_code,
                relation_type="source",
                relation_mode="push",
                relation_desc="销售合同下推销售订单",
            ),
            created_by=created_by,
        )
        return sales_order, await self.get_contract_by_id(tenant_id, contract_id)

    async def get_execution_summaries(self, tenant_id: int) -> List[SalesContractExecutionSummary]:
        rows = await SalesContract.filter(
            tenant_id=tenant_id,
            deleted_at__isnull=True,
            contract_type=self.CONTRACT_TYPE_FRAMEWORK,
            status__in=["已生效", "执行中"],
        ).order_by("-contract_date")
        result = []
        for c in rows:
            _, rem_amt = self._remaining(c)
            result.append(
                SalesContractExecutionSummary(
                    contract_id=c.id,
                    contract_code=c.contract_code,
                    contract_type=c.contract_type,
                    customer_name=c.customer_name,
                    total_amount=c.total_amount,
                    released_amount=c.released_amount,
                    remaining_amount=rem_amt,
                    valid_to=c.valid_to,
                    status=c.status,
                )
            )
        return result

    async def list_alerts(self, tenant_id: int) -> List[SalesContractAlertItem]:
        alert_days_raw = (await self.business_config_service.get_business_config(tenant_id))[
            "parameters"
        ].get("sales", {}).get("contract_expiry_alert_days", 30)
        try:
            alert_days = int(alert_days_raw)
        except (TypeError, ValueError):
            alert_days = 30
        today = date.today()
        threshold = today + timedelta(days=alert_days)
        alerts: List[SalesContractAlertItem] = []
        contracts = await SalesContract.filter(
            tenant_id=tenant_id,
            deleted_at__isnull=True,
            status__in=["已生效", "执行中"],
        )
        for c in contracts:
            if c.valid_to and c.valid_to <= threshold:
                alerts.append(
                    SalesContractAlertItem(
                        alert_type="expiry",
                        contract_id=c.id,
                        contract_code=c.contract_code,
                        customer_name=c.customer_name,
                        message=f"合同将于 {c.valid_to} 到期",
                        severity="high" if c.valid_to <= today else "medium",
                        due_date=c.valid_to,
                    )
                )
            _, rem_amt = self._remaining(c)
            total_amt = Decimal(str(c.total_amount or 0))
            if total_amt > 0 and rem_amt / total_amt < Decimal("0.1"):
                alerts.append(
                    SalesContractAlertItem(
                        alert_type="low_balance",
                        contract_id=c.id,
                        contract_code=c.contract_code,
                        customer_name=c.customer_name,
                        message=f"合同剩余额度 {rem_amt}，不足 10%",
                        severity="medium",
                    )
                )
        milestones = await SalesContractMilestone.filter(
            tenant_id=tenant_id,
            status="pending",
            planned_date__lt=today,
        )
        contract_map = {c.id: c for c in contracts}
        for m in milestones:
            c = contract_map.get(m.contract_id) or await SalesContract.get_or_none(id=m.contract_id)
            if not c:
                continue
            alerts.append(
                SalesContractAlertItem(
                    alert_type="milestone_overdue",
                    contract_id=c.id,
                    contract_code=c.contract_code,
                    customer_name=c.customer_name,
                    message=f"里程碑「{m.milestone_name}」已逾期",
                    severity="high",
                    due_date=m.planned_date,
                )
            )
        return alerts

    async def create_contract_change(
        self,
        tenant_id: int,
        contract_id: int,
        data: SalesContractChangeCreate,
        created_by: int,
    ) -> SalesContractChangeResponse:
        contract = await SalesContract.get_or_none(tenant_id=tenant_id, id=contract_id, deleted_at__isnull=True)
        if not contract:
            raise NotFoundError("销售合同不存在")
        assert_sales_contract_capability(contract, "create_change")
        change_code = await self._generate_change_code(tenant_id)
        row = await SalesContractChange.create(
            tenant_id=tenant_id,
            change_code=change_code,
            contract_id=contract.id,
            contract_code=contract.contract_code,
            change_type=data.change_type,
            status="草稿",
            review_status=ReviewStatus.PENDING,
            delta_amount=data.delta_amount,
            new_valid_to=data.new_valid_to,
            new_total_amount=data.new_total_amount,
            reason=data.reason,
            created_by=created_by,
            updated_by=created_by,
        )
        return SalesContractChangeResponse(
            id=row.id,
            uuid=str(row.uuid),
            tenant_id=row.tenant_id,
            change_code=row.change_code,
            contract_id=row.contract_id,
            contract_code=row.contract_code,
            change_type=row.change_type,
            status=row.status,
            review_status=row.review_status,
            delta_amount=row.delta_amount,
            new_valid_to=row.new_valid_to,
            new_total_amount=row.new_total_amount,
            reason=row.reason,
            new_contract_id=row.new_contract_id,
            created_at=row.created_at,
            updated_at=row.updated_at,
        )

    async def approve_contract_change(
        self,
        tenant_id: int,
        change_id: int,
        reviewer_id: int,
    ) -> SalesContractChangeResponse:
        change = await SalesContractChange.get_or_none(
            tenant_id=tenant_id, id=change_id, deleted_at__isnull=True
        )
        if not change:
            raise NotFoundError("合同变更单不存在")
        if (change.status or "") != "待审核":
            raise BusinessLogicError("仅待审核变更单可审批")
        contract = await SalesContract.get(id=change.contract_id)
        new_total = contract.total_amount
        if change.new_total_amount is not None:
            new_total = change.new_total_amount
        elif change.delta_amount:
            new_total = Decimal(str(contract.total_amount or 0)) + Decimal(str(change.delta_amount))
        if Decimal(str(new_total or 0)) < Decimal(str(contract.released_amount or 0)):
            raise BusinessLogicError("变更后合同总额不能小于已释放金额")
        if change.new_valid_to:
            contract.valid_to = change.new_valid_to
        if change.new_total_amount is not None:
            contract.total_amount = change.new_total_amount
        elif change.delta_amount:
            contract.total_amount = new_total
        contract.version_no = int(contract.version_no or 1) + 1
        contract.updated_by = reviewer_id
        await contract.save()
        change.status = "已生效"
        change.review_status = ReviewStatus.APPROVED
        change.updated_by = reviewer_id
        await change.save()
        return await self._change_to_response(change)

    async def list_contract_changes(
        self, tenant_id: int, contract_id: Optional[int] = None, skip: int = 0, limit: int = 100
    ) -> List[SalesContractChangeResponse]:
        q = SalesContractChange.filter(tenant_id=tenant_id, deleted_at__isnull=True)
        if contract_id:
            q = q.filter(contract_id=contract_id)
        rows = await q.order_by("-created_at").offset(skip).limit(limit)
        return [await self._change_to_response(r) for r in rows]

    async def submit_contract_change(
        self, tenant_id: int, change_id: int, operator_id: int
    ) -> SalesContractChangeResponse:
        change = await SalesContractChange.get_or_none(
            tenant_id=tenant_id, id=change_id, deleted_at__isnull=True
        )
        if not change:
            raise NotFoundError("合同变更单不存在")
        if (change.status or "") != "草稿":
            raise BusinessLogicError("仅草稿变更单可提交")
        change.status = "待审核"
        change.updated_by = operator_id
        await change.save(update_fields=["status", "updated_by", "updated_at"])
        return await self._change_to_response(change)

    async def reject_contract_change(
        self, tenant_id: int, change_id: int, reviewer_id: int, review_remarks: Optional[str] = None
    ) -> SalesContractChangeResponse:
        change = await SalesContractChange.get_or_none(
            tenant_id=tenant_id, id=change_id, deleted_at__isnull=True
        )
        if not change:
            raise NotFoundError("合同变更单不存在")
        if (change.status or "") != "待审核":
            raise BusinessLogicError("仅待审核变更单可驳回")
        change.status = "草稿"
        change.review_status = ReviewStatus.REJECTED
        change.updated_by = reviewer_id
        await change.save(update_fields=["status", "review_status", "updated_by", "updated_at"])
        return await self._change_to_response(change)

    async def _change_to_response(self, row: SalesContractChange) -> SalesContractChangeResponse:
        return SalesContractChangeResponse(
            id=row.id,
            uuid=str(row.uuid),
            tenant_id=row.tenant_id,
            change_code=row.change_code,
            contract_id=row.contract_id,
            contract_code=row.contract_code,
            change_type=row.change_type,
            status=row.status,
            review_status=row.review_status,
            delta_amount=row.delta_amount,
            new_valid_to=row.new_valid_to,
            new_total_amount=row.new_total_amount,
            reason=row.reason,
            new_contract_id=row.new_contract_id,
            created_at=row.created_at,
            updated_at=row.updated_at,
        )

    async def get_payment_summary(self, tenant_id: int, contract_id: int) -> dict:
        contract = await SalesContract.get_or_none(tenant_id=tenant_id, id=contract_id, deleted_at__isnull=True)
        if not contract:
            raise NotFoundError("销售合同不存在")
        milestones = await SalesContractMilestone.filter(tenant_id=tenant_id, contract_id=contract_id).order_by("id")
        planned = sum(Decimal(str(m.planned_amount or 0)) for m in milestones)
        collected = sum(
            Decimal(str(m.planned_amount or 0)) for m in milestones if (m.status or "") == "collected"
        )
        invoiced = sum(
            Decimal(str(m.planned_amount or 0)) for m in milestones if (m.status or "") in ("invoiced", "collected")
        )
        return {
            "contract_id": contract_id,
            "contract_code": contract.contract_code,
            "total_amount": contract.total_amount,
            "planned_milestone_amount": planned,
            "invoiced_amount": invoiced,
            "collected_amount": collected,
            "pending_amount": max(Decimal("0"), planned - invoiced),
            "milestones": [
                {
                    "id": m.id,
                    "milestone_name": m.milestone_name,
                    "planned_date": m.planned_date,
                    "planned_amount": m.planned_amount,
                    "status": m.status,
                    "receivable_id": m.receivable_id,
                    "receivable_code": m.receivable_code,
                }
                for m in milestones
            ],
        }
