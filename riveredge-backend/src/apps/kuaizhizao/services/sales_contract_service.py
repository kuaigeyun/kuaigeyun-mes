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
from apps.kuaizhizao.constants.price_type import DEFAULT_SALES_PRICE_TYPE
from apps.kuaizhizao.models.quotation import Quotation
from apps.kuaizhizao.models.quotation_item import QuotationItem
from apps.kuaizhizao.models.sales_contract import SalesContract
from apps.kuaizhizao.models.sales_contract_change import SalesContractChange
from apps.kuaizhizao.models.sales_contract_item import SalesContractItem
from apps.kuaizhizao.models.sales_contract_milestone import SalesContractMilestone
from apps.kuaizhizao.models.sales_contract_term_group import SalesContractTermGroup
from apps.kuaizhizao.models.sales_order import SalesOrder
from apps.kuaizhizao.models.sales_order_item import SalesOrderItem
from apps.kuaizhizao.models.document_relation import DocumentRelation
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
from core.utils.timezone_utils import resolve_business_datetime, to_api_isoformat

SALES_CONTRACT_SORTABLE_FIELDS = frozenset({
    "contract_code",
    "contract_type",
    "customer_name",
    "contract_date",
    "valid_to",
    "total_quantity",
    "total_amount",
    "released_amount",
    "status",
    "review_status",
    "salesman_name",
    "quotation_code",
    "created_at",
    "updated_at",
})
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
    def _contract_goods_total(items: List[SalesContractItem]) -> Decimal:
        return sum((Decimal(str(it.total_amount or 0)) for it in items), Decimal("0"))

    @staticmethod
    def _allocate_release_discount(
        contract: SalesContract,
        all_items: List[SalesContractItem],
        gross_release_amt: Decimal,
    ) -> Decimal:
        """按合同整单优惠比例分摊本次释放优惠（与下推销售订单一致）。"""
        full_goods = SalesContractService._contract_goods_total(all_items)
        contract_discount = Decimal(str(getattr(contract, "discount_amount", None) or 0))
        if contract_discount <= 0 or full_goods <= 0:
            return Decimal("0")
        if gross_release_amt >= full_goods - Decimal("0.005"):
            return contract_discount
        return (contract_discount * gross_release_amt / full_goods).quantize(
            Decimal("0.01"), rounding=ROUND_HALF_UP
        )

    @staticmethod
    def _release_net_amount(
        contract: SalesContract,
        all_items: List[SalesContractItem],
        gross_release_amt: Decimal,
    ) -> Decimal:
        discount = SalesContractService._allocate_release_discount(
            contract, all_items, gross_release_amt
        )
        return (gross_release_amt - discount).quantize(Decimal("0.01"), rounding=ROUND_HALF_UP)

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
        capability_ctx: Optional[dict[str, Any]] = None,
        released_sales_order_codes: Optional[List[str]] = None,
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
            "released_sales_order_codes": list(released_sales_order_codes or []),
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
            "created_by_name": getattr(contract, "created_by_name", None),
            "updated_by": contract.updated_by,
            "updated_by_name": getattr(contract, "updated_by_name", None),
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
        ctx = capability_ctx or self._contract_capability_context(contract, items)
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
            context={"date": to_api_isoformat(contract_date)},
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
            context={"date": to_api_isoformat(date.today())},
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
        last_error: Optional[Exception] = None
        for attempt in range(5):
            if not contract_code or attempt > 0:
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
                last_error = e
                logger.warning(
                    "销售合同编码冲突，重试占号 attempt={} code={} err={}",
                    attempt + 1,
                    contract_code,
                    e,
                )
                contract_code = ""
        raise ValidationError("销售合同编码已存在，请关闭页面后重新新建") from last_error

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
            operator_name = await self.get_user_name(created_by)
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
                price_type=data.price_type or DEFAULT_SALES_PRICE_TYPE,
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
                created_by_name=operator_name,
                updated_by=created_by,
                updated_by_name=operator_name,
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
        contract_code: Optional[str] = None,
        start_date: Optional[date] = None,
        end_date: Optional[date] = None,
        order_by: Optional[str] = None,
        pullable_only: Optional[bool] = None,
        include_items: bool = False,
    ) -> SalesContractListResponse:
        qs = SalesContract.filter(tenant_id=tenant_id, deleted_at__isnull=True)
        if status:
            qs = qs.filter(status=status)
        if contract_type:
            qs = qs.filter(contract_type=contract_type)
        if customer_id is not None and int(customer_id) > 0:
            qs = qs.filter(customer_id=int(customer_id))
        if start_date:
            qs = qs.filter(contract_date__gte=start_date)
        if end_date:
            qs = qs.filter(contract_date__lte=end_date)
        if keyword and str(keyword).strip():
            kw = str(keyword).strip()
            from apps.kuaizhizao.utils.list_item_material_keyword import (
                header_ids_matching_item_material,
            )

            material_contract_ids = await header_ids_matching_item_material(
                tenant_id,
                SalesContractItem,
                "contract_id",
                kw,
            )
            qs = qs.filter(
                Q(contract_code__icontains=kw)
                | Q(customer_name__icontains=kw)
                | Q(quotation_code__icontains=kw)
                | Q(salesman_name__icontains=kw)
                | Q(id__in=material_contract_ids)
            )
        if contract_code and contract_code.strip():
            qs = qs.filter(contract_code__icontains=contract_code.strip())
        # 加载建销售订单：生效中 + 已审核 + 已到生效日（终止日期不阻断；行级可释放量仍由 capabilities 判定）
        if pullable_only:
            today = date.today()
            approved_review = ("APPROVED", "已通过", "审核通过", "通过", "已审核")
            qs = qs.filter(status__in=("已生效", "执行中"))
            qs = qs.filter(review_status__in=approved_review)
            qs = qs.filter(Q(valid_from__isnull=True) | Q(valid_from__lte=today))
        total = await qs.count()
        order_clause = order_by if order_by else "-contract_date"
        rows = await qs.order_by(order_clause, "-id").offset(skip).limit(limit)
        row_list = list(rows)
        contract_line_items_by_id: dict[int, list] = {}
        if include_items and row_list:
            contract_ids = [int(r.id) for r in row_list if r.id is not None]
            if contract_ids:
                line_rows = (
                    await SalesContractItem.filter(
                        tenant_id=tenant_id,
                        contract_id__in=contract_ids,
                    )
                    .order_by("contract_id", "id")
                    .all()
                )
                for it in line_rows:
                    cid = int(it.contract_id)
                    contract_line_items_by_id.setdefault(cid, []).append(it)
        await self._reconcile_stale_contract_releases(tenant_id, row_list)
        released_codes_by_contract: dict[int, list[str]] = {}
        list_contract_ids = [int(r.id) for r in row_list if r.id is not None]
        if list_contract_ids:
            so_rows = await SalesOrder.filter(
                tenant_id=tenant_id,
                contract_id__in=list_contract_ids,
                deleted_at__isnull=True,
            ).exclude(
                status__in=["已取消", "CANCELLED", "cancelled"]
            ).values_list("contract_id", "order_code")
            for cid, order_code in so_rows:
                contract_id = int(cid or 0)
                code = str(order_code or "").strip()
                if contract_id <= 0 or not code:
                    continue
                bucket = released_codes_by_contract.setdefault(contract_id, [])
                if code not in bucket:
                    bucket.append(code)
        capability_ctx_by_contract_id: dict[int, dict[str, Any]] = {}
        if rows:
            contract_ids = [int(r.id) for r in row_list if r.id is not None]
            item_rows = await SalesContractItem.filter(
                tenant_id=tenant_id,
                contract_id__in=contract_ids,
            ).values("contract_id", "contract_quantity", "released_quantity")
            has_items_map: dict[int, bool] = {cid: False for cid in contract_ids}
            has_releasable_map: dict[int, bool] = {cid: False for cid in contract_ids}
            for it in item_rows:
                contract_id = int(it.get("contract_id") or 0)
                if contract_id <= 0:
                    continue
                has_items_map[contract_id] = True
                contract_qty = Decimal(str(it.get("contract_quantity") or 0))
                released_qty = Decimal(str(it.get("released_quantity") or 0))
                if contract_qty - released_qty > Decimal("0"):
                    has_releasable_map[contract_id] = True
            for r in row_list:
                if r.id is None:
                    continue
                rem_qty, rem_amt = self._remaining(r)
                contract_id = int(r.id)
                capability_ctx_by_contract_id[contract_id] = {
                    "has_items": has_items_map.get(contract_id, False),
                    "has_releasable_items": has_releasable_map.get(contract_id, False),
                    "remaining_amount": rem_amt,
                    "remaining_quantity": rem_qty,
                }
        from core.services.approval.audit_record_enricher import enrich_items

        items = await enrich_items(
            tenant_id,
            "sales_contract",
            [
                self._contract_to_response(
                    r,
                    items=contract_line_items_by_id.get(int(r.id or 0))
                    if include_items
                    else None,
                    capability_ctx=capability_ctx_by_contract_id.get(int(r.id or 0)),
                    released_sales_order_codes=released_codes_by_contract.get(int(r.id or 0)),
                )
                for r in row_list
            ],
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
        await self._normalize_contract_release_after_downstream_removed(contract)
        contract = await SalesContract.get(tenant_id=tenant_id, id=contract_id)
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
            contract.deleted_at = resolve_business_datetime()
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

        audit_required = await self.business_config_service.check_audit_required(
            tenant_id, "sales_contract"
        )
        submitter_name = await self.get_user_name(submitted_by) or str(submitted_by)

        if not audit_required:
            contract.status = "已生效"
            contract.review_status = ReviewStatus.APPROVED
            contract.reviewer_id = submitted_by
            contract.reviewer_name = submitter_name
            contract.review_time = resolve_business_datetime()
            contract.updated_by = submitted_by
            await contract.save()
            return await self.get_contract_by_id(tenant_id, contract_id)

        from core.services.approval.approval_instance_service import ApprovalInstanceService

        # 重新提交前清理历史残留 pending 实例，确保按当前最新流程重新派发审批人。
        await ApprovalInstanceService.cancel_approval(
            tenant_id=tenant_id,
            entity_type="sales_contract",
            entity_id=contract.id,
            operator_id=submitted_by,
        )

        instance = await ApprovalInstanceService.start_approval_for_node(
            tenant_id=tenant_id,
            user_id=submitted_by,
            node_key="sales_contract",
            entity_type="sales_contract",
            entity_id=contract.id,
            entity_uuid=str(contract.uuid),
            title=f"销售合同审核: {contract.contract_code}",
            content=f"客户: {contract.customer_name}, 金额: {contract.total_amount}",
        )
        if not instance:
            raise BusinessLogicError(
                "销售合同审核已开启但未找到可用的审批流程，请在配置中心检查 sales_contract 审批流程是否已激活"
            )

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
        contract.review_time = resolve_business_datetime()
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
        contract.review_time = resolve_business_datetime()
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
        from core.services.approval.approval_instance_service import ApprovalInstanceService

        await ApprovalInstanceService.cancel_approval(
            tenant_id=tenant_id,
            entity_type="sales_contract",
            entity_id=contract_id,
            operator_id=operator_id,
        )
        return await self.get_contract_by_id(tenant_id, contract_id)

    async def revoke_contract_approval(
        self,
        tenant_id: int,
        contract_id: int,
        operator_id: int,
    ) -> SalesContractResponse:
        """撤销审核：人工审→待审核，自动审→草稿。"""
        from core.services.approval.audit_transition import resolve_revoke_landing_phase

        contract = await SalesContract.get_or_none(
            tenant_id=tenant_id, id=contract_id, deleted_at__isnull=True
        )
        if not contract:
            raise NotFoundError("销售合同不存在")
        await self._normalize_contract_release_after_downstream_removed(
            contract, operator_id=operator_id
        )
        contract = await SalesContract.get(tenant_id=tenant_id, id=contract_id)
        assert_sales_contract_capability(contract, "revoke_approval")
        audit_required = await self.business_config_service.check_audit_required(
            tenant_id, "sales_contract"
        )
        landing = resolve_revoke_landing_phase(manual_audit_enabled=audit_required)
        contract.status = "待审核" if landing == "pending" else "草稿"
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
        if contract.valid_from and contract.valid_from > today:
            raise BusinessLogicError("合同尚未到生效日期")

    async def _validate_release_capacity(
        self,
        contract: SalesContract,
        order_qty: Decimal,
        order_amt: Decimal,
        item_quantities: Optional[dict[int, Decimal]] = None,
        all_items: Optional[List[SalesContractItem]] = None,
    ) -> None:
        rem_qty, rem_amt = self._remaining(contract)
        net_order_amt = (
            self._release_net_amount(contract, all_items, order_amt)
            if all_items is not None
            else order_amt
        )
        if net_order_amt > rem_amt:
            raise BusinessLogicError(
                f"订单金额 {net_order_amt} 超过合同剩余额度 {rem_amt}"
            )
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
            contract.status = "已完成"
            await contract.save(update_fields=["status", "updated_at"])

    @staticmethod
    async def _is_downstream_target_active(
        tenant_id: int, target_type: str, target_id: int
    ) -> bool:
        tid = int(target_id)
        if tid <= 0:
            return False
        tt = str(target_type or "").strip().lower()
        if tt == "sales_order":
            from apps.kuaizhizao.models.sales_order import SalesOrder

            return await SalesOrder.filter(
                tenant_id=tenant_id, id=tid, deleted_at__isnull=True
            ).exists()
        if tt == "work_order":
            from apps.kuaizhizao.models.work_order import WorkOrder

            return await WorkOrder.filter(
                tenant_id=tenant_id, id=tid, deleted_at__isnull=True
            ).exists()
        return True

    async def _contract_has_active_downstream(
        self, tenant_id: int, contract_id: int
    ) -> bool:
        from apps.kuaizhizao.models.document_relation import DocumentRelation
        from apps.kuaizhizao.models.sales_order import SalesOrder

        if await SalesOrder.filter(
            tenant_id=tenant_id,
            contract_id=contract_id,
            deleted_at__isnull=True,
        ).exists():
            return True
        relations = await DocumentRelation.filter(
            tenant_id=tenant_id,
            source_type="sales_contract",
            source_id=contract_id,
            relation_mode="push",
        ).values_list("target_type", "target_id")
        for target_type, target_id in relations:
            if await self._is_downstream_target_active(tenant_id, target_type, target_id):
                return True
        return False

    async def _reset_contract_release_state(
        self,
        contract: SalesContract,
        *,
        operator_id: Optional[int] = None,
    ) -> None:
        contract.released_quantity = Decimal("0")
        contract.released_amount = Decimal("0")
        if (contract.status or "") == "执行中":
            contract.status = "已生效"
        if operator_id:
            contract.updated_by = operator_id
        await contract.save(
            update_fields=[
                "released_quantity",
                "released_amount",
                "status",
                "updated_by",
                "updated_at",
            ]
        )
        await SalesContractItem.filter(
            tenant_id=contract.tenant_id, contract_id=contract.id
        ).update(released_quantity=Decimal("0"))

    async def _normalize_contract_release_after_downstream_removed(
        self,
        contract: SalesContract,
        *,
        operator_id: Optional[int] = None,
    ) -> None:
        rel_qty = Decimal(str(contract.released_quantity or 0))
        rel_amt = Decimal(str(contract.released_amount or 0))
        if rel_qty <= 0 and rel_amt <= 0:
            if (contract.status or "") == "执行中":
                contract.status = "已生效"
                if operator_id:
                    contract.updated_by = operator_id
                await contract.save(
                    update_fields=["status", "updated_by", "updated_at"]
                )
            return
        if await self._contract_has_active_downstream(contract.tenant_id, int(contract.id)):
            return
        await self._reset_contract_release_state(contract, operator_id=operator_id)

    async def _reconcile_stale_contract_releases(
        self, tenant_id: int, contracts: List[SalesContract]
    ) -> None:
        for contract in contracts:
            if contract.id is None:
                continue
            await self._normalize_contract_release_after_downstream_removed(contract)

    async def _apply_release_to_contract(
        self,
        contract: SalesContract,
        order_qty: Decimal,
        order_amt: Decimal,
        item_quantities: Optional[dict[int, Decimal]] = None,
        all_items: Optional[List[SalesContractItem]] = None,
    ) -> None:
        net_order_amt = (
            self._release_net_amount(contract, all_items, order_amt)
            if all_items is not None
            else order_amt
        )
        contract.released_quantity = Decimal(str(contract.released_quantity or 0)) + order_qty
        contract.released_amount = Decimal(str(contract.released_amount or 0)) + net_order_amt
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
        if (contract.status or "") in ("已关闭", "已完成"):
            contract.status = "执行中"
        elif (
            Decimal(str(contract.released_quantity or 0)) <= 0
            and Decimal(str(contract.released_amount or 0)) <= 0
        ):
            contract.released_quantity = Decimal("0")
            contract.released_amount = Decimal("0")
            if (contract.status or "") == "执行中":
                contract.status = "已生效"
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
        await self._normalize_contract_release_after_downstream_removed(
            contract, operator_id=operator_id
        )

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

    async def _sales_order_backfill_relation_exists(
        self, tenant_id: int, sales_order_id: int
    ) -> bool:
        from apps.kuaizhizao.services.document_relation_new_service import (
            DocumentRelationNewService,
        )

        return await DocumentRelationNewService().relation_exists(
            tenant_id,
            source_type="sales_order",
            source_id=sales_order_id,
            target_type="sales_contract",
        )

    async def _load_sales_order_backfill_context(
        self, tenant_id: int, sales_order_id: int
    ) -> tuple[SalesOrder, List[SalesOrderItem], Any]:
        from apps.kuaizhizao.services.document_action_policy import (
            derive_sales_order_capabilities,
        )
        from apps.kuaizhizao.services.document_action_policy.types import ActionCapability

        order = await SalesOrder.get_or_none(
            tenant_id=tenant_id, id=sales_order_id, deleted_at__isnull=True
        )
        if not order:
            raise NotFoundError("销售订单不存在")
        items = await SalesOrderItem.filter(
            tenant_id=tenant_id, sales_order_id=sales_order_id
        ).order_by("id")
        caps = derive_sales_order_capabilities(order, has_items=bool(items))
        if caps.backfill_sales_contract.allowed and await self._sales_order_backfill_relation_exists(
            tenant_id, sales_order_id
        ):
            caps = caps.model_copy(
                update={
                    "backfill_sales_contract": ActionCapability(
                        allowed=False,
                        reason="sales_order.backfill_contract.already_backfilled",
                    )
                }
            )
        return order, items, caps

    async def preview_backfill_contract_from_sales_order(
        self,
        tenant_id: int,
        sales_order_id: int,
    ) -> Dict[str, Any]:
        order, items, caps = await self._load_sales_order_backfill_context(
            tenant_id, sales_order_id
        )
        if not items:
            raise BusinessLogicError("销售订单无明细，无法补签销售合同")

        push_allowed = caps.backfill_sales_contract.allowed
        preview_items: List[Dict[str, Any]] = []
        for it in items:
            qty = Decimal(str(getattr(it, "order_quantity", None) or 0))
            if qty <= 0:
                continue
            preview_items.append(
                {
                    "item_id": int(it.id),
                    "material_id": it.material_id,
                    "material_code": it.material_code,
                    "material_name": it.material_name,
                    "material_unit": it.material_unit,
                    "quantity": float(qty),
                    "pushed_quantity": 0.0,
                    "max_push_quantity": float(qty) if push_allowed else 0.0,
                    "delivery_date": (
                        it.delivery_date.isoformat() if it.delivery_date else None
                    ),
                }
            )
        if not preview_items:
            raise BusinessLogicError("销售订单无有效明细数量，无法补签销售合同")

        return {
            "target_type": "sales_contract",
            "summary": (
                f"将为销售订单 {order.order_code} 补签单次销售合同（{len(preview_items)} 行）"
                if push_allowed
                else "当前销售订单不可补签销售合同"
            ),
            "items": preview_items,
            "has_blocking_issues": not push_allowed,
            "blocking_reason": (
                caps.backfill_sales_contract.reason if not push_allowed else None
            ),
            "tip": "确认后将按订单明细创建单次销售合同，并回写订单关联；合同释放量将补录为订单已占用数量。",
        }

    async def convert_from_sales_order(
        self,
        tenant_id: int,
        sales_order_id: int,
        created_by: int,
    ) -> SalesContractResponse:
        from apps.kuaizhizao.services.document_action_policy import (
            assert_sales_order_capability,
        )
        from apps.kuaizhizao.services.document_relation_new_service import (
            DocumentRelationNewService,
        )
        from apps.kuaizhizao.schemas.document_relation import DocumentRelationCreate

        order, items, caps = await self._load_sales_order_backfill_context(
            tenant_id, sales_order_id
        )
        if await self._sales_order_backfill_relation_exists(tenant_id, sales_order_id):
            raise BusinessLogicError("该销售订单已补签销售合同")
        assert_sales_order_capability(order, "backfill_sales_contract", has_items=bool(items))
        if not items:
            raise BusinessLogicError("销售订单无明细，无法补签销售合同")

        contract_items: List[SalesContractItemCreate] = []
        order_qty = Decimal("0")
        for it in items:
            qty = Decimal(str(getattr(it, "order_quantity", None) or 0))
            if qty <= 0:
                continue
            order_qty += qty
            contract_items.append(
                SalesContractItemCreate(
                    material_id=it.material_id,
                    material_code=it.material_code,
                    material_name=it.material_name,
                    material_spec=it.material_spec,
                    material_unit=it.material_unit,
                    contract_quantity=qty,
                    unit_price=it.unit_price,
                    tax_rate=getattr(it, "tax_rate", None) or Decimal("0"),
                    total_amount=it.total_amount,
                    variant_attributes=getattr(it, "variant_attributes", None),
                    delivery_date=it.delivery_date,
                    notes=getattr(it, "notes", None),
                )
            )
        if not contract_items:
            raise BusinessLogicError("销售订单无有效明细数量，无法补签销售合同")

        create_data = SalesContractCreate(
            contract_type=self.CONTRACT_TYPE_SINGLE,
            customer_id=order.customer_id,
            customer_name=order.customer_name,
            customer_contact=order.customer_contact,
            customer_phone=order.customer_phone,
            contract_date=order.order_date,
            valid_from=order.order_date,
            valid_to=order.delivery_date,
            price_type=getattr(order, "price_type", None) or DEFAULT_SALES_PRICE_TYPE,
            currency_code=getattr(order, "currency_code", None) or "CNY",
            salesman_id=order.salesman_id,
            salesman_name=order.salesman_name,
            shipping_address=order.shipping_address,
            shipping_method=order.shipping_method,
            payment_terms=order.payment_terms,
            discount_amount=getattr(order, "discount_amount", None) or Decimal("0"),
            notes=order.notes or f"由销售订单 {order.order_code} 补签",
            items=contract_items,
        )

        raw_push_mode = await self.business_config_service.get_push_default_mode(tenant_id)
        push_as_confirm = str(raw_push_mode or "").strip().lower() == "confirm"

        async with in_transaction():
            contract_resp = await self.create_contract(
                tenant_id, create_data, created_by, auto_submit=push_as_confirm
            )
            contract = await SalesContract.get(id=contract_resp.id)
            contract_items_db = await SalesContractItem.filter(
                tenant_id=tenant_id, contract_id=contract.id
            ).order_by("id")
            by_material: dict[int, SalesContractItem] = {}
            for row in contract_items_db:
                mid = int(getattr(row, "material_id", 0) or 0)
                if mid > 0:
                    by_material[mid] = row

            item_qty_map: dict[int, Decimal] = {}
            order_amt = Decimal(str(order.total_amount or 0))
            for oi in items:
                qty = Decimal(str(getattr(oi, "order_quantity", None) or 0))
                if qty <= 0:
                    continue
                ci = by_material.get(int(oi.material_id)) if oi.material_id else None
                if ci and ci.id is not None:
                    item_qty_map[int(ci.id)] = item_qty_map.get(int(ci.id), Decimal("0")) + qty

            await self._apply_release_to_contract(
                contract, order_qty, order_amt, item_qty_map
            )
            await SalesOrder.filter(tenant_id=tenant_id, id=sales_order_id).update(
                contract_id=contract.id,
                contract_code=contract.contract_code,
                updated_by=created_by,
            )
            await DocumentRelationNewService().create_relation(
                tenant_id=tenant_id,
                relation_data=DocumentRelationCreate(
                    source_type="sales_order",
                    source_id=sales_order_id,
                    source_code=order.order_code,
                    source_name=order.order_code,
                    target_type="sales_contract",
                    target_id=contract.id,
                    target_code=contract.contract_code,
                    target_name=contract.contract_code,
                    relation_type="source",
                    relation_mode="pull",
                    relation_desc="订单补签销售合同",
                ),
                created_by=created_by,
            )

        return await self.get_contract_by_id(tenant_id, int(contract_resp.id))

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
            price_type=getattr(quotation, "price_type", None) or DEFAULT_SALES_PRICE_TYPE,
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
        prev_status = (quotation.status or "").strip() or "已发送"
        from apps.common.base_service import AppBaseService

        op_name = await AppBaseService().get_user_name(created_by)

        async with in_transaction():
            contract_resp = await self.create_contract(
                tenant_id, create_data, created_by, auto_submit=push_as_confirm
            )
            await Quotation.filter(id=quotation_id).update(
                status="已转订单",
                contract_id=contract_resp.id,
                contract_code=contract_resp.contract_code,
                updated_by=created_by,
            )
            await quotation_svc._log_quotation_state_transition(
                tenant_id,
                quotation_id,
                prev_status,
                "已转订单",
                created_by,
                op_name,
                "转销售合同",
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
        await self._validate_release_capacity(
            contract, order_qty, order_amt, item_qty_map, all_items=all_items
        )

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
        discount = self._allocate_release_discount(contract, all_items, order_amt)
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
        await self._apply_release_to_contract(
            contract, order_qty, order_amt, item_qty_map, all_items=all_items
        )
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

    async def _load_contract_push_preview_context(
        self, tenant_id: int, contract_id: int
    ) -> tuple[SalesContract, List[SalesContractItem], dict[str, Any], Any]:
        contract = await SalesContract.get_or_none(
            tenant_id=tenant_id, id=contract_id, deleted_at__isnull=True
        )
        if not contract:
            raise NotFoundError("销售合同不存在")
        items = await SalesContractItem.filter(
            tenant_id=tenant_id, contract_id=contract_id
        ).order_by("id")
        ctx = self._contract_capability_context(contract, items)
        from apps.kuaizhizao.services.document_action_policy.sales_contract import (
            derive_sales_contract_capabilities,
        )

        caps = derive_sales_contract_capabilities(
            contract,
            has_items=ctx["has_items"],
            has_releasable_items=ctx["has_releasable_items"],
            remaining_amount=ctx["remaining_amount"],
            remaining_quantity=ctx["remaining_quantity"],
        )
        return contract, items, ctx, caps

    @staticmethod
    def _build_contract_push_preview_items(
        items: List[SalesContractItem],
        *,
        push_allowed: bool,
    ) -> List[Dict[str, Any]]:
        preview_items: List[Dict[str, Any]] = []
        for it in items:
            contract_qty = Decimal(str(it.contract_quantity or 0))
            if contract_qty <= 0:
                continue
            released_qty = Decimal(str(it.released_quantity or 0))
            remain_qty = SalesContractService._line_remaining_qty(it)
            max_push_qty = remain_qty if push_allowed else Decimal("0")
            preview_items.append(
                {
                    "item_id": int(it.id),
                    "material_id": it.material_id,
                    "material_code": it.material_code,
                    "material_name": it.material_name,
                    "material_unit": it.material_unit,
                    "quantity": float(contract_qty),
                    "pushed_quantity": float(released_qty),
                    "max_push_quantity": float(max_push_qty),
                    "delivery_date": (
                        it.delivery_date.isoformat() if it.delivery_date else None
                    ),
                }
            )
        return preview_items

    async def preview_push_sales_contract_to_sales_order(
        self, tenant_id: int, contract_id: int
    ) -> Dict[str, Any]:
        """下推销售订单预览：返回合同明细数量、已释放、可释放。"""
        contract, items, _ctx, caps = await self._load_contract_push_preview_context(
            tenant_id, contract_id
        )
        if not items:
            raise BusinessLogicError("合同无明细，无法下推销售订单")

        push_allowed = caps.push_to_sales_order.allowed
        preview_items = self._build_contract_push_preview_items(
            items, push_allowed=push_allowed
        )
        if not preview_items:
            raise BusinessLogicError("合同无有效明细数量，无法下推销售订单")

        pushable_count = sum(
            1 for row in preview_items if float(row.get("max_push_quantity") or 0) > 0
        )
        return {
            "target_type": "sales_order",
            "summary": (
                f"请选择本次要下推的合同明细（{pushable_count}/{len(preview_items)} 行可下推）"
                if push_allowed
                else "当前销售合同不可下推销售订单"
            ),
            "items": preview_items,
            "has_blocking_issues": not push_allowed,
            "blocking_reason": (
                caps.push_to_sales_order.reason if not push_allowed else None
            ),
            "tip": "确认后将按所选明细与数量创建销售订单，并更新合同已释放数量。",
        }

    async def preview_push_sales_contract_to_work_order(
        self, tenant_id: int, contract_id: int
    ) -> Dict[str, Any]:
        """销售合同直推工单预览：返回可选择的合同明细，不实际创建。"""
        contract, all_items, _ctx, caps = await self._load_contract_push_preview_context(
            tenant_id, contract_id
        )
        if not all_items:
            raise BusinessLogicError("合同无明细，无法直推工单")

        push_allowed = caps.push_to_work_order.allowed
        from apps.kuaizhizao.utils.material_source_helper import (
            get_material_source_type,
            validate_material_source_config,
        )

        preview_items: List[Dict[str, Any]] = []
        has_material_blocking = False
        for it in all_items:
            contract_qty = Decimal(str(it.contract_quantity or 0))
            if contract_qty <= 0:
                continue
            remain_qty = self._line_remaining_qty(it)
            max_push_qty = remain_qty if push_allowed else Decimal("0")
            source_type = await get_material_source_type(tenant_id, it.material_id)
            _, source_errors = await validate_material_source_config(
                tenant_id=tenant_id,
                material_id=it.material_id,
                source_type=source_type or "Make",
            )
            errors = [str(e) for e in (source_errors or []) if str(e).strip()]
            if errors:
                has_material_blocking = True
            preview_items.append(
                {
                    "item_id": int(it.id),
                    "material_id": it.material_id,
                    "material_code": it.material_code,
                    "material_name": it.material_name,
                    "material_unit": it.material_unit,
                    "quantity": float(contract_qty),
                    "pushed_quantity": float(Decimal(str(it.released_quantity or 0))),
                    "max_push_quantity": float(max_push_qty),
                    "delivery_date": (
                        it.delivery_date.isoformat() if it.delivery_date else None
                    ),
                    "suggested_action": "生产",
                    "source_type": source_type or "Make",
                    "blocking_issues": errors,
                }
            )

        if not preview_items:
            raise BusinessLogicError("合同无可释放明细，无法直推工单")

        push_mode_default = await self.business_config_service.get_push_default_mode(tenant_id)
        pushable_count = sum(
            1 for row in preview_items if float(row.get("max_push_quantity") or 0) > 0
        )

        return {
            "target_type": "work_order",
            "summary": (
                f"请选择本次要下推的合同明细（{pushable_count}/{len(preview_items)} 行可下推）"
                if push_allowed
                else "当前销售合同不可直推工单"
            ),
            "push_mode_default": (push_mode_default or "draft"),
            "items": preview_items,
            "has_blocking_issues": (not push_allowed) or has_material_blocking,
            "blocking_reason": (
                caps.push_to_work_order.reason if not push_allowed else None
            ),
            "tip": "原材料由您自行计算采购；确认后将按所选明细与数量创建工单并更新合同已释放数量。",
        }

    async def push_sales_contract_to_work_order(
        self,
        tenant_id: int,
        contract_id: int,
        created_by: int,
        selected_item_ids: Optional[List[int]] = None,
        release_lines: Optional[List[SalesContractReleaseLine]] = None,
        work_order_granularity: Optional[str] = None,
        push_mode: Optional[str] = None,
    ) -> Dict[str, Any]:
        """销售合同直推工单（跳过先转销售订单）。"""
        contract = await SalesContract.get_or_none(
            tenant_id=tenant_id, id=contract_id, deleted_at__isnull=True
        )
        if not contract:
            raise NotFoundError("销售合同不存在")
        all_items = await SalesContractItem.filter(
            tenant_id=tenant_id, contract_id=contract_id
        ).order_by("id")
        ctx = self._contract_capability_context(contract, all_items)
        assert_sales_contract_capability(
            contract,
            "push_to_work_order",
            has_items=ctx["has_items"],
            has_releasable_items=ctx["has_releasable_items"],
            remaining_amount=ctx["remaining_amount"],
        )
        if not all_items:
            raise BusinessLogicError("合同无明细，无法直推工单")

        plan, item_qty_map, order_qty, order_amt = self._resolve_release_plan(
            all_items,
            selected_item_ids=selected_item_ids,
            release_lines=release_lines,
        )
        await self._validate_release_capacity(
            contract, order_qty, order_amt, item_qty_map, all_items=all_items
        )

        raw_push_mode = (push_mode or "").strip().lower()
        if raw_push_mode not in ("draft", "confirm"):
            raw_push_mode = await self.business_config_service.get_push_default_mode(tenant_id)
        push_as_confirm = raw_push_mode == "confirm"
        raw_granularity = (work_order_granularity or "").strip().lower()
        if raw_granularity not in ("grouped", "per_unit"):
            raw_granularity = "grouped"

        from datetime import datetime
        from apps.kuaizhizao.services.work_order_service import WorkOrderService
        from apps.kuaizhizao.schemas.work_order import WorkOrderCreate
        from apps.kuaizhizao.services.document_relation_new_service import DocumentRelationNewService
        from apps.kuaizhizao.schemas.document_relation import DocumentRelationCreate
        from apps.kuaizhizao.utils.bom_helper import get_bom_by_material_id
        from apps.kuaizhizao.utils.material_source_helper import (
            expand_bom_with_source_control,
            SOURCE_TYPE_MAKE,
            SOURCE_TYPE_OUTSOURCE,
            SOURCE_TYPE_CONFIGURE,
        )

        wo_pool: Dict[int, Dict[str, Any]] = {}

        def _add_to_pool(
            material_id: int,
            material_code: str,
            material_name: str,
            qty: float,
            delivery_date,
        ) -> None:
            if qty <= 0:
                return
            key = int(material_id)
            if key not in wo_pool:
                wo_pool[key] = {
                    "material_id": material_id,
                    "material_code": material_code,
                    "material_name": material_name,
                    "quantity": Decimal("0"),
                    "earliest_delivery": delivery_date,
                }
            wo_pool[key]["quantity"] += Decimal(str(qty))
            if delivery_date and (
                wo_pool[key]["earliest_delivery"] is None
                or delivery_date < wo_pool[key]["earliest_delivery"]
            ):
                wo_pool[key]["earliest_delivery"] = delivery_date

        for it, qty_dec in plan:
            qty = float(qty_dec)
            delivery_date = it.delivery_date or contract.contract_date
            bom = await get_bom_by_material_id(
                tenant_id=tenant_id,
                material_id=it.material_id,
                only_approved=True,
                use_default=True,
            )
            if bom and bom.bom_code:
                _add_to_pool(
                    it.material_id,
                    it.material_code,
                    it.material_name,
                    qty,
                    delivery_date,
                )
                variant_attrs = getattr(it, "variant_attributes", None)
                requirements = await expand_bom_with_source_control(
                    tenant_id=tenant_id,
                    material_id=it.material_id,
                    required_quantity=qty,
                    only_approved=True,
                    use_default_bom=True,
                    variant_attributes=variant_attrs,
                    configurable_selections=None,
                    flatten_intermediate_subassemblies=True,
                )
                for req in requirements:
                    st = req.get("source_type")
                    if st in (SOURCE_TYPE_MAKE, SOURCE_TYPE_OUTSOURCE, SOURCE_TYPE_CONFIGURE):
                        _add_to_pool(
                            req["material_id"],
                            req["material_code"],
                            req["material_name"],
                            float(req["required_quantity"]),
                            delivery_date,
                        )
            else:
                _add_to_pool(
                    it.material_id,
                    it.material_code,
                    it.material_name,
                    qty,
                    delivery_date,
                )

        work_order_service = WorkOrderService()
        relation_service = DocumentRelationNewService()
        work_orders: List[Any] = []

        async def _create_one_work_order(info: Dict[str, Any], qty_dec: Decimal):
            wo_data = WorkOrderCreate(
                code_rule="WORK_ORDER_CODE",
                product_id=info["material_id"],
                product_code=info["material_code"],
                product_name=info["material_name"],
                quantity=qty_dec,
                production_mode="MTO",
                planned_start_date=(
                    datetime.combine(info["earliest_delivery"], datetime.min.time())
                    if info.get("earliest_delivery")
                    else None
                ),
                planned_end_date=(
                    datetime.combine(info["earliest_delivery"], datetime.min.time())
                    if info.get("earliest_delivery")
                    else None
                ),
                remarks=f"由销售合同 {contract.contract_code} 直推（含半成品）",
            )
            wo = await work_order_service.create_work_order(
                tenant_id=tenant_id,
                work_order_data=wo_data,
                created_by=created_by,
                allow_draft=not push_as_confirm,
            )
            if push_as_confirm:
                wo = await work_order_service.release_work_order(
                    tenant_id=tenant_id,
                    work_order_id=wo.id,
                    released_by=created_by,
                    check_shortage=False,
                )
            wo_id = wo.id if hasattr(wo, "id") else wo.get("id")
            wo_code = wo.code if hasattr(wo, "code") else wo.get("code")
            wo_name = wo.name if hasattr(wo, "name") else wo.get("name")
            relation_data = DocumentRelationCreate(
                source_type="sales_contract",
                source_id=contract_id,
                source_code=contract.contract_code,
                source_name=contract.contract_code,
                target_type="work_order",
                target_id=wo_id,
                target_code=wo_code,
                target_name=wo_name,
                relation_type="source",
                relation_mode="push",
                relation_desc="销售合同直推工单（含半成品，采购件自行采购）",
                business_mode="MTO",
                demand_id=None,
            )
            await relation_service.create_relation(
                tenant_id=tenant_id,
                relation_data=relation_data,
                created_by=created_by,
            )
            work_orders.append(wo)

        for info in wo_pool.values():
            total_qty_dec = Decimal(str(info["quantity"] or 0))
            if total_qty_dec <= 0:
                continue
            if raw_granularity == "per_unit":
                if total_qty_dec != total_qty_dec.to_integral_value():
                    raise BusinessLogicError(
                        f"物料 {info['material_code'] or info['material_name']} 下推数量为 {total_qty_dec}，"
                        "“单台一个工单”仅支持整数数量"
                    )
                unit_count = int(total_qty_dec)
                for _ in range(unit_count):
                    await _create_one_work_order(info, Decimal("1"))
            else:
                await _create_one_work_order(info, total_qty_dec)

        if not work_orders:
            raise BusinessLogicError("所选明细的本次下推数量均为 0，无法生成工单")

        await self._apply_release_to_contract(
            contract, order_qty, order_amt, item_qty_map, all_items=all_items
        )

        return {
            "success": True,
            "message": f"直推成功，共生成 {len(work_orders)} 个工单（含半成品，采购件自行采购）",
            "push_mode": raw_push_mode,
            "work_order_granularity": raw_granularity,
            "target_documents": [
                {
                    "type": "work_order",
                    "id": w.id if hasattr(w, "id") else w.get("id"),
                    "code": w.code if hasattr(w, "code") else w.get("code"),
                }
                for w in work_orders
            ],
        }

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
                        message=f"合同终止日为 {c.valid_to}",
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
