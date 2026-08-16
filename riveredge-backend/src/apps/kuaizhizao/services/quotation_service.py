"""
报价单管理服务模块

提供报价单相关的业务逻辑处理。
报价单可转销售订单，建立 quotation -> sales_order 关联。

Author: RiverEdge Team
Date: 2026-02-19
"""

from typing import List, Optional, Set, Dict, Any
from datetime import datetime, date
from decimal import Decimal, ROUND_HALF_UP
from tortoise.transactions import in_transaction
from loguru import logger

from apps.kuaizhizao.models.quotation import Quotation
from apps.kuaizhizao.constants.price_type import DEFAULT_SALES_PRICE_TYPE, normalize_price_type
from apps.kuaizhizao.models.quotation_item import QuotationItem
from apps.master_data.models.customer import Customer
from apps.master_data.models.material import Material
from apps.kuaizhizao.models.sales_order import SalesOrder
from apps.kuaizhizao.models.sales_order_item import SalesOrderItem
from apps.kuaizhizao.models.sales_contract import SalesContract
from apps.kuaizhizao.schemas.quotation import (
    QuotationCreate,
    QuotationUpdate,
    QuotationResponse,
    QuotationListResponse,
    QuotationItemCreate,
    QuotationItemResponse,
    QuotationRevisionBody,
)
from apps.kuaizhizao.schemas.sales_order import SalesOrderCreate, SalesOrderItemCreate
from apps.kuaizhizao.utils.gift_line_helper import validate_gift_line_rules
from apps.kuaizhizao.constants import DemandStatus, ReviewStatus, LEGACY_PENDING_VALUES
from apps.kuaizhizao.services.document_lifecycle_service import _is_approved
from apps.kuaizhizao.services.document_action_policy import (
    assert_quotation_capability,
    enrich_quotation_capabilities_on_model,
    enrich_quotation_list_capabilities,
)
from core.services.authorization.data_scope_service import DataScopeService
from core.utils.timezone_utils import resolve_business_datetime, to_api_isoformat, today_site_str, to_site_date
from infra.exceptions.exceptions import NotFoundError, BusinessLogicError, ValidationError
from infra.models.user import User
from infra.services.business_config_service import BusinessConfigService


class QuotationService:
    """报价单管理服务"""

    def __init__(self):
        self.business_config_service = BusinessConfigService()

    async def _quotation_audit_required(self, tenant_id: int) -> bool:
        return await self.business_config_service.check_audit_required(
            tenant_id, "quotation"
        )

    async def _assert_quotation_capability(
        self,
        tenant_id: int,
        quotation: Quotation,
        action: str,
        *,
        conversion_downstream_missing: bool = False,
        contract_downstream_missing: bool = False,
        sales_review_downstream_missing: bool = False,
    ) -> None:
        audit_required = await self._quotation_audit_required(tenant_id)
        assert_quotation_capability(
            quotation,
            action,
            audit_required=audit_required,
            conversion_downstream_missing=conversion_downstream_missing,
            contract_downstream_missing=contract_downstream_missing,
            sales_review_downstream_missing=sales_review_downstream_missing,
        )

    @staticmethod
    def _next_revision_quotation_code(series_code: str, version_no: int) -> str:
        """系列内新版本对外编码：{series}-V{n}，总长不超过 120。"""
        suffix = f"-V{version_no}"
        max_len = 120
        if len(series_code) + len(suffix) <= max_len:
            return f"{series_code}{suffix}"
        room = max(1, max_len - len(suffix))
        return f"{series_code[:room]}{suffix}"

    @staticmethod
    async def _quotation_conversion_downstream_missing(
        tenant_id: int,
        quotation: Quotation,
        alive_sales_order_ids: Optional[Set[int]] = None,
    ) -> bool:
        """
        报价单仍显示已转单/仍有关联 ID，但下游销售订单已软删或不存在时返回 True。
        """
        st = (quotation.status or "").strip()
        so_id = quotation.sales_order_id
        if st != "已转订单" and not so_id:
            return False
        if so_id is not None:
            if alive_sales_order_ids is not None:
                return so_id not in alive_sales_order_ids
            so = await SalesOrder.get_or_none(
                tenant_id=tenant_id, id=so_id, deleted_at__isnull=True
            )
            return so is None
        return st == "已转订单"

    @staticmethod
    async def _quotation_contract_downstream_missing(
        tenant_id: int,
        quotation: Quotation,
        alive_contract_ids: Optional[Set[int]] = None,
    ) -> bool:
        """报价单仍有关联 contract_id，但下游销售合同已软删或不存在时返回 True。"""
        cid = quotation.contract_id
        if not cid:
            return False
        if alive_contract_ids is not None:
            return int(cid) not in alive_contract_ids
        contract = await SalesContract.get_or_none(
            tenant_id=tenant_id, id=cid, deleted_at__isnull=True
        )
        return contract is None

    @staticmethod
    async def _quotation_sales_review_downstream_missing(
        tenant_id: int,
        quotation: Quotation,
        alive_review_ids: Optional[Set[int]] = None,
    ) -> bool:
        """报价单仍有关联 sales_review_id，但下游订单评审已软删或不存在时返回 True。"""
        rid = getattr(quotation, "sales_review_id", None)
        if not rid:
            return False
        if alive_review_ids is not None:
            return int(rid) not in alive_review_ids
        from apps.kuaizhizao.models.sales_review import SalesReview

        review = await SalesReview.get_or_none(
            tenant_id=tenant_id, id=int(rid), deleted_at__isnull=True
        )
        return review is None

    async def _detach_quotation_if_sales_review_deleted(
        self,
        tenant_id: int,
        quotation_id: int,
        operator_id: int,
    ) -> bool:
        """若下游订单评审已删除，解除报价单上的评审关联。"""
        q = await Quotation.get_or_none(
            tenant_id=tenant_id, id=quotation_id, deleted_at__isnull=True
        )
        if not q:
            return False
        missing = await QuotationService._quotation_sales_review_downstream_missing(
            tenant_id, q
        )
        if not missing:
            return False
        await Quotation.filter(id=quotation_id).update(
            sales_review_id=None,
            sales_review_code=None,
            updated_by=operator_id,
        )
        q.sales_review_id = None
        q.sales_review_code = None
        return True

    async def _detach_quotation_if_contract_deleted(
        self,
        tenant_id: int,
        quotation_id: int,
        operator_id: int,
    ) -> bool:
        """若下游销售合同已删除，解除报价单上的合同关联，恢复可再次下推合同。"""
        q = await Quotation.get_or_none(
            tenant_id=tenant_id, id=quotation_id, deleted_at__isnull=True
        )
        if not q:
            return False
        missing = await QuotationService._quotation_contract_downstream_missing(
            tenant_id, q
        )
        if not missing:
            return False
        so_still_live = not await QuotationService._quotation_conversion_downstream_missing(
            tenant_id, q
        )
        from_state = (q.status or "").strip()
        updates: Dict[str, Any] = {
            "contract_id": None,
            "contract_code": None,
            "updated_by": operator_id,
        }
        if from_state == "已转订单" and not so_still_live:
            updates["status"] = "已接受"
        await Quotation.filter(tenant_id=tenant_id, id=quotation_id).update(**updates)
        if from_state == "已转订单" and not so_still_live:
            from apps.common.base_service import AppBaseService

            op_name = await AppBaseService().get_user_name(operator_id)
            await self._log_quotation_state_transition(
                tenant_id,
                quotation_id,
                "已转订单",
                "已接受",
                operator_id,
                op_name,
                "下游销售合同已删除，自动恢复客户确认",
            )
        return True

    async def _detach_quotation_if_downstream_sales_order_deleted(
        self,
        tenant_id: int,
        quotation_id: int,
        operator_id: int,
        *,
        transition_reason: Optional[str] = "自动撤回下推",
        log_transition: bool = True,
    ) -> bool:
        """若下游销售订单已删除，解除报价单上的转单标记，回到可再次下推的状态（已接受）。"""
        q = await Quotation.get_or_none(
            tenant_id=tenant_id, id=quotation_id, deleted_at__isnull=True
        )
        if not q:
            return False
        missing = await QuotationService._quotation_conversion_downstream_missing(
            tenant_id, q
        )
        if not missing:
            return False
        from_state = (q.status or "").strip()
        await Quotation.filter(tenant_id=tenant_id, id=quotation_id).update(
            status="已接受",
            sales_order_id=None,
            sales_order_code=None,
            updated_by=operator_id,
        )
        if log_transition and from_state == "已转订单" and transition_reason:
            from apps.common.base_service import AppBaseService

            op_name = await AppBaseService().get_user_name(operator_id)
            await self._log_quotation_state_transition(
                tenant_id,
                quotation_id,
                "已转订单",
                "已接受",
                operator_id,
                op_name,
                transition_reason,
            )
        return True

    async def _log_quotation_state_transition(
        self,
        tenant_id: int,
        quotation_id: int,
        from_state: str,
        to_state: str,
        operator_id: int,
        operator_name: str,
        reason: Optional[str] = None,
        comment: Optional[str] = None,
    ) -> None:
        """
        写入状态流转日志，供单据跟踪「操作记录」展示。
        transition_reason 为「自动审核」时，前端显示自动审核标记（与 sales_order 一致）。
        """
        try:
            from apps.kuaizhizao.models.state_transition import StateTransitionLog

            await StateTransitionLog.create(
                tenant_id=tenant_id,
                entity_type="quotation",
                entity_id=quotation_id,
                from_state=(from_state or "")[:50],
                to_state=(to_state or "")[:50],
                transition_reason=(reason[:200] if reason else None),
                transition_comment=comment,
                operator_id=operator_id,
                operator_name=(operator_name or str(operator_id))[:100],
                transition_time=resolve_business_datetime(),
            )
        except Exception as e:
            logger.warning("报价单状态流转日志写入失败，跳过: %s", e)

    @staticmethod
    async def _load_material_master_map(
        tenant_id: int,
        material_ids: List[int],
    ) -> Dict[int, Material]:
        ids = sorted({int(i) for i in material_ids if i and int(i) > 0})
        if not ids:
            return {}
        materials = await Material.filter(
            tenant_id=tenant_id,
            id__in=ids,
            deleted_at__isnull=True,
        ).all()
        return {m.id: m for m in materials}

    @staticmethod
    def _process_quotation_item_pricing(
        item_data: QuotationItemCreate,
        material_map: Dict[int, Material],
        *,
        price_type: str,
        line_inclusive_fn,
    ) -> Dict[str, Any]:
        qty = item_data.quote_quantity
        tax_r = item_data.tax_rate if item_data.tax_rate is not None else Decimal("0")
        is_gift = bool(getattr(item_data, "is_gift", False))
        unit_pr = item_data.unit_price or Decimal("0")
        unit_pr, amt, gift_ref = validate_gift_line_rules(
            is_gift=is_gift,
            unit_price=unit_pr,
            material_id=item_data.material_id,
            material_map=material_map,
            material_code=item_data.material_code or "",
            material_name=item_data.material_name or "",
            gift_ref_unit_price=getattr(item_data, "gift_ref_unit_price", None),
            line_amount=item_data.total_amount,
        )
        if not is_gift:
            if unit_pr <= Decimal("0"):
                raise ValidationError("非赠品明细单价须大于0")
            amt = line_inclusive_fn(qty, unit_pr, tax_r, price_type)
        QuotationService._validate_quotation_item_non_negative(
            quote_quantity=qty,
            unit_price=unit_pr,
            tax_rate=tax_r,
            total_amount=amt,
        )
        return {
            "material_id": item_data.material_id,
            "material_code": (item_data.material_code or "")[:50],
            "material_name": (item_data.material_name or "")[:200],
            "material_spec": (item_data.material_spec or "")[:200] or None,
            "material_unit": (item_data.material_unit or "")[:20],
            "quote_quantity": qty,
            "unit_price": unit_pr,
            "tax_rate": tax_r,
            "total_amount": amt,
            "variant_attributes": getattr(item_data, "variant_attributes", None),
            "pricing_snapshot": getattr(item_data, "pricing_snapshot", None),
            "delivery_date": item_data.delivery_date,
            "notes": item_data.notes,
            "is_gift": is_gift,
            "gift_ref_unit_price": gift_ref,
        }

    @staticmethod
    def _validate_quotation_item_non_negative(
        *,
        quote_quantity: Decimal,
        unit_price: Decimal,
        tax_rate: Optional[Decimal],
        total_amount: Optional[Decimal],
    ) -> None:
        if quote_quantity <= Decimal("0"):
            raise ValidationError("报价单明细数量必须大于0")
        if unit_price < Decimal("0"):
            raise ValidationError("报价单明细单价不能为负数")
        tr = tax_rate if tax_rate is not None else Decimal("0")
        if tr < Decimal("0") or tr > Decimal("100"):
            raise ValidationError("报价单明细税率须在 0～100 之间")
        if total_amount is not None and total_amount < Decimal("0"):
            raise ValidationError("报价单明细金额不能为负数")

    @staticmethod
    def _quotation_line_inclusive_amount(
        qty: Decimal,
        unit_price: Decimal,
        tax_rate: Decimal,
        price_type: str,
    ) -> Decimal:
        """
        价税合计（行金额），与前端销售/报价明细 calcSalesLineAmounts.incl 的分币舍入一致。
        """
        q = qty or Decimal("0")
        up = unit_price or Decimal("0")
        tr = tax_rate if tax_rate is not None else Decimal("0")
        pt = normalize_price_type(price_type)
        unit_cents = int((up * Decimal("100")).to_integral_value(rounding=ROUND_HALF_UP))
        if pt == "tax_inclusive":
            incl_cents = int((q * Decimal(unit_cents)).to_integral_value(rounding=ROUND_HALF_UP))
        else:
            excl_cents = int((q * Decimal(unit_cents)).to_integral_value(rounding=ROUND_HALF_UP))
            tax_cents = int(
                (Decimal(excl_cents) * tr / Decimal("100")).to_integral_value(
                    rounding=ROUND_HALF_UP
                )
            )
            incl_cents = excl_cents + tax_cents
        return (Decimal(incl_cents) / Decimal("100")).quantize(
            Decimal("0.01"), rounding=ROUND_HALF_UP
        )

    @staticmethod
    def _validate_quotation_non_negative(
        *,
        total_quantity: Optional[Decimal],
        total_amount: Optional[Decimal],
    ) -> None:
        if total_quantity is not None and total_quantity < Decimal("0"):
            raise ValidationError("报价单总数量不能为负数")
        if total_amount is not None and total_amount < Decimal("0"):
            raise ValidationError("报价单总金额不能为负数")

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

    async def _refresh_quotation_totals(
        self,
        tenant_id: int,
        quotation_id: int,
        discount_amount: Optional[Decimal] = None,
    ) -> None:
        q = await Quotation.get(id=quotation_id)
        items = await QuotationItem.filter(tenant_id=tenant_id, quotation_id=quotation_id).order_by("id")
        total_qty = sum((it.quote_quantity or Decimal("0")) for it in items)
        goods_incl = sum((it.total_amount or Decimal("0")) for it in items)
        discount_val = (
            discount_amount
            if discount_amount is not None
            else getattr(q, "discount_amount", None) or Decimal("0")
        )
        discount, net_amt = self._apply_header_discount(goods_incl, discount_val)
        await Quotation.filter(id=quotation_id).update(
            total_quantity=total_qty,
            total_amount=net_amt,
            discount_amount=discount,
        )

    def _quotation_to_response(
        self,
        quotation: Quotation,
        items: Optional[List[QuotationItem]] = None,
    ) -> QuotationResponse:
        """将 Quotation 转为 QuotationResponse"""
        base = {
            "id": quotation.id,
            "uuid": str(quotation.uuid),
            "tenant_id": quotation.tenant_id,
            "quotation_code": quotation.quotation_code,
            "quotation_series_code": getattr(quotation, "quotation_series_code", None)
            or quotation.quotation_code,
            "root_quotation_id": getattr(quotation, "root_quotation_id", None),
            "version_no": int(getattr(quotation, "version_no", None) or 1),
            "previous_quotation_id": getattr(quotation, "previous_quotation_id", None),
            "is_latest_in_series": getattr(quotation, "is_latest_in_series", True),
            "superseded_by_id": getattr(quotation, "superseded_by_id", None),
            "formal_document_generated_at": getattr(
                quotation, "formal_document_generated_at", None
            ),
            "quotation_date": quotation.quotation_date,
            "valid_until": quotation.valid_until,
            "delivery_date": quotation.delivery_date,
            "customer_id": quotation.customer_id,
            "customer_name": quotation.customer_name,
            "customer_contact": quotation.customer_contact,
            "customer_phone": quotation.customer_phone,
            "total_quantity": quotation.total_quantity,
            "total_amount": quotation.total_amount,
            "discount_amount": getattr(quotation, "discount_amount", None) or Decimal("0"),
            "price_type": getattr(quotation, "price_type", None) or DEFAULT_SALES_PRICE_TYPE,
            "status": quotation.status,
            "reviewer_id": quotation.reviewer_id,
            "reviewer_name": quotation.reviewer_name,
            "review_time": quotation.review_time,
            "review_status": quotation.review_status,
            "review_remarks": quotation.review_remarks,
            "salesman_id": quotation.salesman_id,
            "salesman_name": quotation.salesman_name,
            "shipping_address": quotation.shipping_address,
            "shipping_method": quotation.shipping_method,
            "payment_terms": quotation.payment_terms,
            "currency_code": quotation.currency_code or "CNY",
            "sales_order_id": quotation.sales_order_id,
            "sales_order_code": quotation.sales_order_code,
            "contract_id": getattr(quotation, "contract_id", None),
            "contract_code": getattr(quotation, "contract_code", None),
            "sales_review_id": getattr(quotation, "sales_review_id", None),
            "sales_review_code": getattr(quotation, "sales_review_code", None),
            "notes": quotation.notes,
            "is_active": quotation.is_active,
            "created_by": quotation.created_by,
            "created_by_name": getattr(quotation, "created_by_name", None),
            "updated_by": quotation.updated_by,
            "updated_by_name": getattr(quotation, "updated_by_name", None),
            "created_at": quotation.created_at,
            "updated_at": quotation.updated_at,
        }
        if items is not None:
            base["items"] = [
                QuotationItemResponse(
                    id=it.id,
                    uuid=str(it.uuid),
                    tenant_id=it.tenant_id,
                    quotation_id=it.quotation_id,
                    material_id=it.material_id,
                    material_code=it.material_code,
                    material_name=it.material_name,
                    material_spec=it.material_spec,
                    material_unit=it.material_unit,
                    quote_quantity=it.quote_quantity,
                    unit_price=it.unit_price,
                    tax_rate=getattr(it, "tax_rate", None) or Decimal("0"),
                    total_amount=it.total_amount,
                    is_gift=bool(getattr(it, "is_gift", False)),
                    gift_ref_unit_price=getattr(it, "gift_ref_unit_price", None),
                    variant_attributes=getattr(it, "variant_attributes", None),
                    pricing_snapshot=getattr(it, "pricing_snapshot", None),
                    delivery_date=it.delivery_date,
                    notes=it.notes,
                    created_at=it.created_at,
                    updated_at=it.updated_at,
                )
                for it in items
            ]
        return QuotationResponse(**base)

    async def _generate_quotation_code(
        self, tenant_id: int, quotation_date: Optional[date]
    ) -> str:
        """生成报价单编码"""
        from core.config.code_rule_pages import get_canonical_rule_code
        from core.services.business.code_generation_service import CodeGenerationService

        rule_code = get_canonical_rule_code("kuaizhizao-quotation")
        if not rule_code:
            raise ValidationError("报价单页面未配置编码规则")
        context = {}
        if quotation_date:
            context["quotation_date"] = (
                to_api_isoformat(quotation_date)
                if hasattr(quotation_date, "isoformat")
                else str(quotation_date)
            )
        return await CodeGenerationService.generate_code(
            tenant_id=tenant_id,
            rule_code=rule_code,
            context=context or None,
        )

    async def _release_quotation_from_draft(
        self,
        tenant_id: int,
        quotation_id: int,
        operator_id: int,
        *,
        auto_approved: bool,
    ) -> None:
        """
        将报价单从草稿提交为「已发送」。
        auto_approved=True：蓝图无需人工审核，同步标记审核通过。
        auto_approved=False：进入待人工审核（review_status=待审核）。
        """
        from apps.common.base_service import AppBaseService

        now = resolve_business_datetime()
        op_name = await AppBaseService().get_user_name(operator_id)
        if auto_approved:
            await Quotation.filter(id=quotation_id, tenant_id=tenant_id).update(
                status="已发送",
                review_status="已通过",
                reviewer_id=operator_id,
                reviewer_name=op_name,
                review_time=now,
                updated_by=operator_id,
            )
            await self._log_quotation_state_transition(
                tenant_id,
                quotation_id,
                "草稿",
                "已发送",
                operator_id,
                op_name,
                "自动审核",
            )
        else:
            await Quotation.filter(id=quotation_id, tenant_id=tenant_id).update(
                status="已发送",
                review_status="待审核",
                reviewer_id=None,
                reviewer_name=None,
                review_time=None,
                review_remarks=None,
                updated_by=operator_id,
            )
            await self._log_quotation_state_transition(
                tenant_id,
                quotation_id,
                "草稿",
                "已发送",
                operator_id,
                op_name,
                "提交",
            )

    async def _submit_quotation_with_audit(
        self,
        tenant_id: int,
        quotation_id: int,
        submitted_by: int,
    ) -> None:
        """草稿提交为已发送；需审核时启动平台审批实例。"""
        quotation = await Quotation.get_or_none(
            tenant_id=tenant_id, id=quotation_id, deleted_at__isnull=True
        )
        if not quotation:
            raise NotFoundError(f"报价单不存在: {quotation_id}")

        audit_required = await self.business_config_service.check_audit_required(
            tenant_id, "quotation"
        )
        if not audit_required:
            async with in_transaction():
                await self._release_quotation_from_draft(
                    tenant_id,
                    quotation_id,
                    submitted_by,
                    auto_approved=True,
                )
            return

        from core.services.approval.approval_instance_service import ApprovalInstanceService

        instance = await ApprovalInstanceService.start_approval_for_node(
            tenant_id=tenant_id,
            user_id=submitted_by,
            node_key="quotation",
            entity_type="quotation",
            entity_id=quotation.id,
            entity_uuid=str(quotation.uuid),
            title=f"报价单审核: {quotation.quotation_code}",
            content=f"客户: {quotation.customer_name}, 金额: {quotation.total_amount}",
        )
        if not instance:
            raise BusinessLogicError(
                "报价单审核已开启但未找到可用的审批流程，请在配置中心检查 quotation 审批流程是否已激活"
            )
        async with in_transaction():
            await self._release_quotation_from_draft(
                tenant_id,
                quotation_id,
                submitted_by,
                auto_approved=False,
            )

    async def create_quotation(
        self,
        tenant_id: int,
        quotation_data: QuotationCreate,
        created_by: int,
        *,
        auto_submit: bool = True,
    ) -> QuotationResponse:
        """创建报价单；auto_submit=False 时保持草稿，不自动提交为已报价。"""
        is_enabled = await self.business_config_service.check_node_enabled(tenant_id, "quotation")
        if not is_enabled:
            raise BusinessLogicError("报价单节点未启用，无法创建报价单")
        if not quotation_data.quotation_code:
            quotation_data.quotation_code = await self._generate_quotation_code(
                tenant_id, quotation_data.quotation_date
            )

        async with in_transaction():
            self._validate_quotation_non_negative(
                total_quantity=getattr(quotation_data, "total_quantity", None),
                total_amount=getattr(quotation_data, "total_amount", None),
            )
            q_dict = quotation_data.model_dump(exclude={"items"})
            from apps.common.base_service import AppBaseService

            operator_name = await AppBaseService().get_user_name(created_by)
            q_dict["created_by"] = created_by
            q_dict["created_by_name"] = operator_name
            q_dict["updated_by"] = created_by
            q_dict["updated_by_name"] = operator_name
            q_dict["quotation_series_code"] = q_dict.get("quotation_series_code") or q_dict.get(
                "quotation_code"
            )
            q_dict["version_no"] = 1
            q_dict["is_latest_in_series"] = True
            q_dict["previous_quotation_id"] = None
            q_dict["superseded_by_id"] = None
            q_dict["formal_document_generated_at"] = None
            q_dict["root_quotation_id"] = None
            q_dict["status"] = "草稿"
            # review_status 列 NOT NULL；草稿尚未进入审核流程时用空串表示「未提交审核」
            q_dict["review_status"] = ""

            # 自动带出归属业务员
            if not q_dict.get("salesman_id") and q_dict.get("customer_id"):
                customer = await Customer.get_or_none(id=q_dict["customer_id"], deleted_at__isnull=True)
                if customer and customer.salesman_id:
                    q_dict["salesman_id"] = customer.salesman_id
                    q_dict["salesman_name"] = customer.salesman_name

            quotation = await Quotation.create(tenant_id=tenant_id, **q_dict)
            await Quotation.filter(id=quotation.id).update(
                root_quotation_id=quotation.id,
                quotation_series_code=q_dict.get("quotation_series_code")
                or quotation.quotation_code,
            )
            quotation = await Quotation.get(id=quotation.id)

            total_qty = Decimal("0")
            total_amt = Decimal("0")
            pt = str(q_dict.get("price_type") or DEFAULT_SALES_PRICE_TYPE)
            material_map = await self._load_material_master_map(
                tenant_id,
                [item_data.material_id for item_data in quotation_data.items],
            )
            for item_data in quotation_data.items:
                row = self._process_quotation_item_pricing(
                    item_data,
                    material_map,
                    price_type=pt,
                    line_inclusive_fn=self._quotation_line_inclusive_amount,
                )
                total_qty += row["quote_quantity"]
                total_amt += row["total_amount"]
                await QuotationItem.create(
                    tenant_id=tenant_id,
                    quotation_id=quotation.id,
                    material_id=row["material_id"],
                    material_code=row["material_code"],
                    material_name=row["material_name"],
                    material_spec=row["material_spec"],
                    material_unit=row["material_unit"],
                    quote_quantity=row["quote_quantity"],
                    unit_price=row["unit_price"],
                    tax_rate=row["tax_rate"],
                    total_amount=row["total_amount"],
                    variant_attributes=row["variant_attributes"],
                    pricing_snapshot=row.get("pricing_snapshot"),
                    delivery_date=row["delivery_date"],
                    notes=row["notes"],
                    is_gift=row["is_gift"],
                    gift_ref_unit_price=row["gift_ref_unit_price"],
                )

            discount = Decimal(str(getattr(quotation_data, "discount_amount", None) or 0))
            discount, net_amt = self._apply_header_discount(total_amt, discount)
            await Quotation.filter(id=quotation.id).update(
                total_quantity=total_qty,
                total_amount=net_amt,
                discount_amount=discount,
            )
            quotation = await Quotation.get(id=quotation.id)
            if auto_submit:
                await self._submit_quotation_with_audit(
                    tenant_id, quotation.id, created_by
                )
                quotation = await Quotation.get(id=quotation.id)
            items = await QuotationItem.filter(
                tenant_id=tenant_id, quotation_id=quotation.id
            ).order_by("id")
            return self._quotation_to_response(quotation, items=items)

    async def submit_quotation(
        self,
        tenant_id: int,
        quotation_id: int,
        submitted_by: int,
    ) -> QuotationResponse:
        """提交报价单（草稿 → 已发送）；是否自动通过审核由业务蓝图 quotation.auditRequired 决定。"""
        quotation = await Quotation.get_or_none(
            tenant_id=tenant_id, id=quotation_id, deleted_at__isnull=True
        )
        if not quotation:
            raise NotFoundError(f"报价单不存在: {quotation_id}")
        await self._assert_quotation_capability(tenant_id, quotation, "submit")
        await self._submit_quotation_with_audit(tenant_id, quotation_id, submitted_by)
        return await self.get_quotation_by_id(
            tenant_id, quotation_id, include_items=True
        )

    async def withdraw_quotation(
        self,
        tenant_id: int,
        quotation_id: int,
        withdrawn_by: int,
    ) -> QuotationResponse:
        """撤回已提交的报价单：已发送 + 待审核 → 草稿（与销售订单撤回语义一致）"""
        quotation = await Quotation.get_or_none(
            tenant_id=tenant_id, id=quotation_id, deleted_at__isnull=True
        )
        if not quotation:
            raise NotFoundError(f"报价单不存在: {quotation_id}")
        await self._assert_quotation_capability(tenant_id, quotation, "withdraw_submit")
        from apps.common.base_service import AppBaseService

        op_name = await AppBaseService().get_user_name(withdrawn_by)
        async with in_transaction():
            from core.services.approval.approval_instance_service import ApprovalInstanceService

            await ApprovalInstanceService.cancel_approval(
                tenant_id=tenant_id,
                entity_type="quotation",
                entity_id=quotation_id,
                operator_id=withdrawn_by,
            )
            await Quotation.filter(tenant_id=tenant_id, id=quotation_id).update(
                status="草稿",
                review_status="",
                reviewer_id=None,
                reviewer_name=None,
                review_time=None,
                review_remarks=None,
                updated_by=withdrawn_by,
            )
            await self._log_quotation_state_transition(
                tenant_id,
                quotation_id,
                "已发送",
                "草稿",
                withdrawn_by,
                op_name,
                "撤回提交",
            )
        return await self.get_quotation_by_id(
            tenant_id, quotation_id, include_items=True
        )

    async def approve_quotation(
        self,
        tenant_id: int,
        quotation_id: int,
        operator_id: int,
        review_remarks: Optional[str] = None,
    ) -> QuotationResponse:
        """审核通过：已发送 + 待审核 → 审核通过（保持已发送）。"""
        from apps.common.base_service import AppBaseService

        quotation = await Quotation.get_or_none(
            tenant_id=tenant_id, id=quotation_id, deleted_at__isnull=True
        )
        if not quotation:
            raise NotFoundError(f"报价单不存在: {quotation_id}")
        await self._assert_quotation_capability(tenant_id, quotation, "approve")

        from core.services.approval.uni_audit_service import UniAuditService

        async def _do_approve() -> QuotationResponse:
            now = resolve_business_datetime()
            op_name = await AppBaseService().get_user_name(operator_id)
            async with in_transaction():
                await Quotation.filter(tenant_id=tenant_id, id=quotation_id).update(
                    review_status="已通过",
                    reviewer_id=operator_id,
                    reviewer_name=op_name,
                    review_time=now,
                    review_remarks=review_remarks,
                    updated_by=operator_id,
                )
                await self._log_quotation_state_transition(
                    tenant_id,
                    quotation_id,
                    "待审核",
                    "已通过",
                    operator_id,
                    op_name,
                    "审核通过",
                )
            return await self.get_quotation_by_id(tenant_id, quotation_id, include_items=True)

        result = await UniAuditService.approve_with_flow_fallback(
            tenant_id=tenant_id,
            entity_type="quotation",
            entity_id=quotation_id,
            approver_id=operator_id,
            flow_approve=_do_approve,
        )
        return (
            result
            if result is not None
            else await self.get_quotation_by_id(tenant_id, quotation_id, include_items=True)
        )

    async def reject_quotation(
        self,
        tenant_id: int,
        quotation_id: int,
        operator_id: int,
        review_remarks: Optional[str] = None,
    ) -> QuotationResponse:
        """审核驳回：已发送 + 待审核 → 已拒绝。"""
        from apps.common.base_service import AppBaseService

        quotation = await Quotation.get_or_none(
            tenant_id=tenant_id, id=quotation_id, deleted_at__isnull=True
        )
        if not quotation:
            raise NotFoundError(f"报价单不存在: {quotation_id}")
        if quotation.status != "已发送":
            raise BusinessLogicError(f"仅待审核中的报价单可驳回，当前状态: {quotation.status}")
        rs = (quotation.review_status or "").strip()
        if rs not in LEGACY_PENDING_VALUES and rs != "":
            raise BusinessLogicError(f"仅待审核的报价单可驳回，当前审核状态: {quotation.review_status}")

        from core.services.approval.uni_audit_service import UniAuditService

        async def _do_reject(reason: Optional[str]) -> QuotationResponse:
            now = resolve_business_datetime()
            op_name = await AppBaseService().get_user_name(operator_id)
            reject_remarks = reason or review_remarks
            async with in_transaction():
                await Quotation.filter(tenant_id=tenant_id, id=quotation_id).update(
                    status="已拒绝",
                    review_status="审核驳回",
                    reviewer_id=operator_id,
                    reviewer_name=op_name,
                    review_time=now,
                    review_remarks=reject_remarks,
                    updated_by=operator_id,
                )
                await self._log_quotation_state_transition(
                    tenant_id,
                    quotation_id,
                    "待审核",
                    "已拒绝",
                    operator_id,
                    op_name,
                    "审核驳回",
                )
            return await self.get_quotation_by_id(tenant_id, quotation_id, include_items=True)

        result = await UniAuditService.reject_with_flow_fallback(
            tenant_id=tenant_id,
            entity_type="quotation",
            entity_id=quotation_id,
            approver_id=operator_id,
            reason=review_remarks,
            flow_reject=_do_reject,
        )
        return (
            result
            if result is not None
            else await self.get_quotation_by_id(tenant_id, quotation_id, include_items=True)
        )

    async def revoke_review_quotation(
        self,
        tenant_id: int,
        quotation_id: int,
        operator_id: int,
    ) -> QuotationResponse:
        """撤销审核：已发送 + 已通过 → 人工审回到待审核，自动审回到草稿。"""
        from core.services.approval.audit_transition import resolve_revoke_landing_phase
        from core.services.approval.uni_audit_service import UniAuditService

        quotation = await Quotation.get_or_none(
            tenant_id=tenant_id, id=quotation_id, deleted_at__isnull=True
        )
        if not quotation:
            raise NotFoundError(f"报价单不存在: {quotation_id}")
        await self._assert_quotation_capability(tenant_id, quotation, "revoke_approval")

        audit_required = await self.business_config_service.check_audit_required(
            tenant_id, "quotation"
        )
        landing = resolve_revoke_landing_phase(manual_audit_enabled=audit_required)

        async def _do_revoke() -> QuotationResponse:
            from apps.common.base_service import AppBaseService

            op_name = await AppBaseService().get_user_name(operator_id)
            async with in_transaction():
                if landing == "draft":
                    await Quotation.filter(tenant_id=tenant_id, id=quotation_id).update(
                        status="草稿",
                        review_status="",
                        reviewer_id=None,
                        reviewer_name=None,
                        review_time=None,
                        review_remarks=None,
                        updated_by=operator_id,
                    )
                    await self._log_quotation_state_transition(
                        tenant_id,
                        quotation_id,
                        "已通过",
                        "草稿",
                        operator_id,
                        op_name,
                        "撤销审核",
                    )
                else:
                    await Quotation.filter(tenant_id=tenant_id, id=quotation_id).update(
                        review_status="待审核",
                        reviewer_id=None,
                        reviewer_name=None,
                        review_time=None,
                        review_remarks=None,
                        updated_by=operator_id,
                    )
                    await self._log_quotation_state_transition(
                        tenant_id,
                        quotation_id,
                        "已通过",
                        "待审核",
                        operator_id,
                        op_name,
                        "撤销审核",
                    )
            return await self.get_quotation_by_id(tenant_id, quotation_id, include_items=True)

        return await UniAuditService.revoke_with_flow_fallback(
            tenant_id=tenant_id,
            entity_type="quotation",
            entity_id=quotation_id,
            operator_id=operator_id,
            flow_revoke=_do_revoke,
        )

    async def confirm_customer_quotation(
        self,
        tenant_id: int,
        quotation_id: int,
        operator_id: int,
    ) -> QuotationResponse:
        """客户确认（标记已接受）：已发送 + 审核通过 → 已接受。"""
        quotation = await Quotation.get_or_none(
            tenant_id=tenant_id, id=quotation_id, deleted_at__isnull=True
        )
        if not quotation:
            raise NotFoundError(f"报价单不存在: {quotation_id}")
        await self._assert_quotation_capability(
            tenant_id, quotation, "confirm_customer"
        )
        from apps.common.base_service import AppBaseService

        op_name = await AppBaseService().get_user_name(operator_id)
        async with in_transaction():
            await Quotation.filter(tenant_id=tenant_id, id=quotation_id).update(
                status="已接受",
                updated_by=operator_id,
            )
            await self._log_quotation_state_transition(
                tenant_id,
                quotation_id,
                "已发送",
                "已接受",
                operator_id,
                op_name,
                "客户确认",
            )
        return await self.get_quotation_by_id(tenant_id, quotation_id, include_items=True)

    async def cancel_customer_confirm_quotation(
        self,
        tenant_id: int,
        quotation_id: int,
        operator_id: int,
    ) -> QuotationResponse:
        """客户取消确认：已接受 → 已发送（保留审核通过，可撤回审核或删除）。"""
        await self._detach_quotation_if_contract_deleted(
            tenant_id, quotation_id, operator_id
        )
        quotation = await Quotation.get_or_none(
            tenant_id=tenant_id, id=quotation_id, deleted_at__isnull=True
        )
        if not quotation:
            raise NotFoundError(f"报价单不存在: {quotation_id}")
        contract_missing = await self._quotation_contract_downstream_missing(
            tenant_id, quotation
        )
        await self._assert_quotation_capability(
            tenant_id,
            quotation,
            "cancel_customer_confirm",
            contract_downstream_missing=contract_missing,
        )
        from apps.common.base_service import AppBaseService

        op_name = await AppBaseService().get_user_name(operator_id)
        async with in_transaction():
            await Quotation.filter(tenant_id=tenant_id, id=quotation_id).update(
                status="已发送",
                updated_by=operator_id,
            )
            await self._log_quotation_state_transition(
                tenant_id,
                quotation_id,
                "已接受",
                "已发送",
                operator_id,
                op_name,
                "客户取消确认",
            )
        return await self.get_quotation_by_id(tenant_id, quotation_id, include_items=True)

    async def reopen_quotation_after_reject(
        self,
        tenant_id: int,
        quotation_id: int,
        operator_id: int,
    ) -> QuotationResponse:
        """驳回后重新编辑：已拒绝 → 草稿。"""
        quotation = await Quotation.get_or_none(
            tenant_id=tenant_id, id=quotation_id, deleted_at__isnull=True
        )
        if not quotation:
            raise NotFoundError(f"报价单不存在: {quotation_id}")
        await self._assert_quotation_capability(tenant_id, quotation, "reopen")
        from apps.common.base_service import AppBaseService

        op_name = await AppBaseService().get_user_name(operator_id)
        async with in_transaction():
            await Quotation.filter(tenant_id=tenant_id, id=quotation_id).update(
                status="草稿",
                review_status="待审核",
                reviewer_id=None,
                reviewer_name=None,
                review_time=None,
                review_remarks=None,
                updated_by=operator_id,
            )
            await self._log_quotation_state_transition(
                tenant_id,
                quotation_id,
                "已拒绝",
                "草稿",
                operator_id,
                op_name,
                "重新编辑",
            )
        return await self.get_quotation_by_id(tenant_id, quotation_id, include_items=True)

    async def revoke_push_quotation(
        self,
        tenant_id: int,
        quotation_id: int,
        operator_id: int,
    ) -> QuotationResponse:
        """撤回下推：已转订单但下游销售订单已不存在时，解除关联回到「已接受」可再次下推。"""
        quotation = await Quotation.get_or_none(
            tenant_id=tenant_id, id=quotation_id, deleted_at__isnull=True
        )
        if not quotation:
            raise NotFoundError(f"报价单不存在: {quotation_id}")
        conv_missing = await self._quotation_conversion_downstream_missing(
            tenant_id, quotation
        )
        await self._assert_quotation_capability(
            tenant_id,
            quotation,
            "revoke_push",
            conversion_downstream_missing=conv_missing,
        )
        so_id = quotation.sales_order_id
        if so_id is not None:
            so = await SalesOrder.get_or_none(
                tenant_id=tenant_id, id=so_id, deleted_at__isnull=True
            )
            if so is not None:
                raise BusinessLogicError(
                    "下游销售订单仍存在，无法撤回下推；请先作废或删除销售订单"
                )
        async with in_transaction():
            detached = await self._detach_quotation_if_downstream_sales_order_deleted(
                tenant_id,
                quotation_id,
                operator_id,
                transition_reason="撤回下推",
            )
            if not detached:
                raise BusinessLogicError("当前状态无法撤回下推")
        return await self.get_quotation_by_id(tenant_id, quotation_id, include_items=True)

    async def get_quotation_by_id(
        self,
        tenant_id: int,
        quotation_id: int,
        include_items: bool = True,
        current_user: Optional[User] = None,
    ) -> QuotationResponse:
        """获取报价单详情"""
        quotation = await Quotation.get_or_none(
            tenant_id=tenant_id, id=quotation_id, deleted_at__isnull=True
        )
        if not quotation:
            raise NotFoundError(f"报价单不存在: {quotation_id}")
        if current_user:
            await DataScopeService.assert_row_visible(
                quotation,
                tenant_id=tenant_id,
                user=current_user,
                resource="kuaizhizao:quotation",
            )
        operator_id = quotation.updated_by or 0
        if await self._detach_quotation_if_contract_deleted(
            tenant_id, quotation_id, operator_id
        ):
            quotation = await Quotation.get_or_none(
                tenant_id=tenant_id, id=quotation_id, deleted_at__isnull=True
            )
            if not quotation:
                raise NotFoundError(f"报价单不存在: {quotation_id}")
        if await self._detach_quotation_if_downstream_sales_order_deleted(
            tenant_id, quotation_id, operator_id
        ):
            quotation = await Quotation.get_or_none(
                tenant_id=tenant_id, id=quotation_id, deleted_at__isnull=True
            )
            if not quotation:
                raise NotFoundError(f"报价单不存在: {quotation_id}")
        if await self._detach_quotation_if_sales_review_deleted(
            tenant_id, quotation_id, operator_id
        ):
            quotation = await Quotation.get_or_none(
                tenant_id=tenant_id, id=quotation_id, deleted_at__isnull=True
            )
            if not quotation:
                raise NotFoundError(f"报价单不存在: {quotation_id}")

        items = None
        if include_items:
            items = await QuotationItem.filter(
                tenant_id=tenant_id, quotation_id=quotation_id
            ).order_by("id")
        resp = self._quotation_to_response(quotation, items=items)
        from apps.kuaizhizao.services.document_lifecycle_service import get_quotation_lifecycle, get_document_milestones
        milestones = await get_document_milestones(quotation.tenant_id, "quotation", quotation.id)
        conv_missing = await self._quotation_conversion_downstream_missing(
            tenant_id, quotation
        )
        contract_missing = await self._quotation_contract_downstream_missing(
            tenant_id, quotation
        )
        review_missing = await self._quotation_sales_review_downstream_missing(
            tenant_id, quotation
        )
        audit_required = await self._quotation_audit_required(tenant_id)
        lifecycle = get_quotation_lifecycle(
            quotation,
            milestones=milestones,
            converted_sales_order_missing=conv_missing,
            contract_downstream_missing=contract_missing,
            audit_required=audit_required,
        )
        result = resp.model_copy(
            update={
                "lifecycle": lifecycle,
                "conversion_downstream_missing": conv_missing,
                "contract_downstream_missing": contract_missing,
            }
        )
        result = await enrich_quotation_capabilities_on_model(
            tenant_id,
            quotation,
            result,
            conversion_downstream_missing=conv_missing,
            contract_downstream_missing=contract_missing,
            sales_review_downstream_missing=review_missing,
        )
        from core.services.approval.audit_record_enricher import enrich_record

        return await enrich_record(tenant_id, "quotation", result)

    @staticmethod
    async def _apply_quotation_list_scope(query, tenant_id: int, current_user: Optional[User], list_scope: Optional[str] = None):
        """统一按角色数据策略过滤报价列表。"""
        if not current_user:
            return query
        return await DataScopeService.apply(
            query,
            tenant_id=tenant_id,
            user=current_user,
            resource="kuaizhizao:quotation",
        )

    async def _batch_quotation_downstream_missing(
        self,
        tenant_id: int,
        quotations: List[Quotation],
    ) -> tuple[dict[int, bool], dict[int, bool]]:
        """批量计算列表行下游缺失标记（与 list_quotations 展示一致）。"""
        missing_by_id: dict[int, bool] = {}
        contract_missing_by_id: dict[int, bool] = {}
        if not quotations:
            return missing_by_id, contract_missing_by_id

        so_ids = list({q.sales_order_id for q in quotations if q.sales_order_id})
        alive_so: Set[int] = set()
        if so_ids:
            alive_rows = await SalesOrder.filter(
                tenant_id=tenant_id, id__in=so_ids, deleted_at__isnull=True
            ).values_list("id", flat=True)
            alive_so = set(alive_rows)

        contract_ids = list({q.contract_id for q in quotations if q.contract_id})
        alive_contract: Set[int] = set()
        if contract_ids:
            alive_contract_rows = await SalesContract.filter(
                tenant_id=tenant_id, id__in=contract_ids, deleted_at__isnull=True
            ).values_list("id", flat=True)
            alive_contract = set(alive_contract_rows)

        for q in quotations:
            qid = int(q.id)
            st = (q.status or "").strip()
            so_id = q.sales_order_id
            if st != "已转订单" and not so_id:
                missing_by_id[qid] = False
            elif so_id is not None:
                missing_by_id[qid] = int(so_id) not in alive_so
            else:
                missing_by_id[qid] = st == "已转订单"
            if q.contract_id:
                contract_missing_by_id[qid] = int(q.contract_id) not in alive_contract
            else:
                contract_missing_by_id[qid] = False
        return missing_by_id, contract_missing_by_id

    async def _apply_quotation_lifecycle_query(
        self,
        tenant_id: int,
        query,
        lifecycle_stage: str,
    ):
        """把 get_quotation_lifecycle 的阶段谓词落到 SQL，禁止全表 .all() 再切片。"""
        from tortoise.expressions import Q
        from apps.kuaizhizao.services.document_lifecycle_service import (
            normalize_quotation_lifecycle_filter,
        )

        target = normalize_quotation_lifecycle_filter(lifecycle_stage)
        rejected_review = ("REJECTED", "已驳回", "审核驳回")
        if target == "草稿":
            return query.filter(status__in=["草稿", "draft"])
        if target == "已报价":
            sent = query.filter(status="已发送").exclude(review_status__in=rejected_review)
            contract_ids = [
                int(cid)
                for cid in await sent.filter(contract_id__isnull=False).values_list(
                    "contract_id", flat=True
                )
                if cid
            ]
            alive_contract = set(
                int(cid)
                for cid in await SalesContract.filter(
                    tenant_id=tenant_id, id__in=contract_ids, deleted_at__isnull=True
                ).values_list("id", flat=True)
            ) if contract_ids else set()
            if alive_contract:
                sent = sent.exclude(contract_id__in=list(alive_contract))
            return sent
        if target == "客户确认":
            accepted = query.filter(status="已接受").exclude(review_status__in=rejected_review)
            contract_ids = [
                int(cid)
                for cid in await accepted.filter(contract_id__isnull=False).values_list(
                    "contract_id", flat=True
                )
                if cid
            ]
            alive_contract = set(
                int(cid)
                for cid in await SalesContract.filter(
                    tenant_id=tenant_id, id__in=contract_ids, deleted_at__isnull=True
                ).values_list("id", flat=True)
            ) if contract_ids else set()
            if alive_contract:
                accepted = accepted.exclude(contract_id__in=list(alive_contract))
            return accepted
        if target == "已驳回":
            return query.filter(
                Q(status__in=["已拒绝", "rejected"]) | Q(review_status__in=rejected_review)
            )
        if target == "已转订单":
            so_ids = [
                int(oid)
                for oid in await query.filter(sales_order_id__isnull=False).values_list(
                    "sales_order_id", flat=True
                )
                if oid
            ]
            alive_so = set(
                int(oid)
                for oid in await SalesOrder.filter(
                    tenant_id=tenant_id, id__in=so_ids, deleted_at__isnull=True
                ).values_list("id", flat=True)
            ) if so_ids else set()
            contract_ids = [
                int(cid)
                for cid in await query.filter(contract_id__isnull=False).values_list(
                    "contract_id", flat=True
                )
                if cid
            ]
            alive_contract = set(
                int(cid)
                for cid in await SalesContract.filter(
                    tenant_id=tenant_id, id__in=contract_ids, deleted_at__isnull=True
                ).values_list("id", flat=True)
            ) if contract_ids else set()
            converted = Q()
            if alive_so:
                converted |= Q(status="已转订单", sales_order_id__in=list(alive_so))
            if alive_contract:
                converted |= Q(contract_id__in=list(alive_contract))
            if not alive_so and not alive_contract:
                return query.filter(id__in=[])
            return query.filter(converted).exclude(review_status__in=rejected_review)
        if target == "下推单据已删除":
            so_ids = [
                int(oid)
                for oid in await query.filter(
                    status="已转订单", sales_order_id__isnull=False
                ).values_list("sales_order_id", flat=True)
                if oid
            ]
            alive_so = set(
                int(oid)
                for oid in await SalesOrder.filter(
                    tenant_id=tenant_id, id__in=so_ids, deleted_at__isnull=True
                ).values_list("id", flat=True)
            ) if so_ids else set()
            missing_so = [oid for oid in so_ids if oid not in alive_so]
            if missing_so:
                return query.filter(status="已转订单").filter(
                    Q(sales_order_id__isnull=True) | Q(sales_order_id__in=missing_so)
                )
            return query.filter(status="已转订单", sales_order_id__isnull=True)
        return query.filter(id__in=[])

    async def list_quotations(
        self,
        tenant_id: int,
        skip: int = 0,
        limit: int = 100,
        status: Optional[str] = None,
        lifecycle_stage: Optional[str] = None,
        salesman_id: Optional[int] = None,
        customer_id: Optional[int] = None,
        start_date: Optional[date] = None,
        end_date: Optional[date] = None,
        keyword: Optional[str] = None,
        quotation_code: Optional[str] = None,
        customer_name: Optional[str] = None,
        quotation_series_code: Optional[str] = None,
        order_by: Optional[str] = None,
        list_scope: Optional[str] = None,
        pullable_only: Optional[bool] = None,
        pull_target: Optional[str] = None,
        current_user: Optional[User] = None,
        include_items: bool = False,
    ) -> QuotationListResponse:
        """获取报价单列表。order_by 如 quotation_date、-updated_at（前缀-表示降序）"""
        from tortoise.expressions import Q

        query = Quotation.filter(tenant_id=tenant_id, deleted_at__isnull=True)

        query = await self._apply_quotation_list_scope(query, tenant_id, current_user, list_scope)
        lifecycle_filter = (lifecycle_stage or "").strip()
        if quotation_series_code and str(quotation_series_code).strip():
            query = query.filter(
                quotation_series_code=str(quotation_series_code).strip()
            )
        if status and not lifecycle_filter:
            query = query.filter(status=status)
        if salesman_id is not None and int(salesman_id) > 0:
            query = query.filter(salesman_id=int(salesman_id))
        if customer_id is not None and int(customer_id) > 0:
            query = query.filter(customer_id=int(customer_id))
        if start_date:
            query = query.filter(quotation_date__gte=start_date)
        if end_date:
            query = query.filter(quotation_date__lte=end_date)
        if keyword and str(keyword).strip():
            kw = str(keyword).strip()
            from apps.kuaizhizao.utils.list_item_material_keyword import (
                header_ids_matching_item_material,
            )

            material_quotation_ids = await header_ids_matching_item_material(
                tenant_id,
                QuotationItem,
                "quotation_id",
                kw,
            )
            query = query.filter(
                Q(quotation_code__icontains=kw)
                | Q(customer_name__icontains=kw)
                | Q(quotation_series_code__icontains=kw)
                | Q(salesman_name__icontains=kw)
                | Q(id__in=material_quotation_ids)
            )
        if quotation_code and quotation_code.strip():
            query = query.filter(quotation_code__icontains=quotation_code.strip())
        if customer_name and customer_name.strip():
            query = query.filter(customer_name__icontains=customer_name.strip())
        audit_required = await self._quotation_audit_required(tenant_id)
        if pullable_only:
            # 与 derive_quotation_capabilities 的 convert_to_* 一致：可加载里不得出现灰行
            normalized_pull_target = (pull_target or "sales_order").strip().lower()
            query = query.filter(is_latest_in_series=True)
            if normalized_pull_target == "sales_contract":
                query = query.filter(
                    contract_id__isnull=True,
                    sales_order_id__isnull=True,
                    sales_review_id__isnull=True,
                )
            elif normalized_pull_target == "sales_review":
                query = query.filter(
                    sales_review_id__isnull=True,
                    sales_order_id__isnull=True,
                    contract_id__isnull=True,
                ).exclude(status="已转订单")
            else:
                query = query.filter(
                    sales_order_id__isnull=True,
                    contract_id__isnull=True,
                    sales_review_id__isnull=True,
                ).exclude(status="已转订单")
            query = query.exclude(status__in=["已拒绝", "草稿", "draft"])
            if audit_required:
                approved_review = ("APPROVED", "已通过", "审核通过", "通过")
                query = query.exclude(
                    Q(status="已发送") & ~Q(review_status__in=approved_review)
                )
        order_clause = order_by if order_by else "-created_at"

        if lifecycle_filter:
            query = await self._apply_quotation_lifecycle_query(
                tenant_id, query, lifecycle_filter
            )
        total = await query.count()
        quotations = await query.offset(skip).limit(limit).order_by(order_clause)
        from apps.kuaizhizao.services.document_lifecycle_service import get_quotation_lifecycle

        missing_by_id, contract_missing_by_id = await self._batch_quotation_downstream_missing(
            tenant_id, quotations
        )
        stale_contract_q_ids = [
            qid for qid, missing in contract_missing_by_id.items() if missing
        ]
        if stale_contract_q_ids:
            await Quotation.filter(
                tenant_id=tenant_id, id__in=stale_contract_q_ids
            ).update(contract_id=None, contract_code=None)
            for q in quotations:
                if int(q.id) in stale_contract_q_ids:
                    q.contract_id = None
                    q.contract_code = None
                    contract_missing_by_id[int(q.id)] = False
        stale_so_q_ids = [qid for qid, missing in missing_by_id.items() if missing]
        if stale_so_q_ids:
            await Quotation.filter(
                tenant_id=tenant_id, id__in=stale_so_q_ids
            ).update(
                status="已接受",
                sales_order_id=None,
                sales_order_code=None,
            )
            for q in quotations:
                if int(q.id) in stale_so_q_ids:
                    q.sales_order_id = None
                    q.sales_order_code = None
                    q.status = "已接受"
                    missing_by_id[int(q.id)] = False
        review_missing_by_id: Dict[int, bool] = {}
        review_ids = [
            int(q.sales_review_id)
            for q in quotations
            if getattr(q, "sales_review_id", None)
        ]
        alive_review_ids: Set[int] = set()
        if review_ids:
            from apps.kuaizhizao.models.sales_review import SalesReview

            alive_review_ids = {
                int(rid)
                for rid in await SalesReview.filter(
                    tenant_id=tenant_id, id__in=review_ids, deleted_at__isnull=True
                ).values_list("id", flat=True)
            }
        stale_review_q_ids: List[int] = []
        for q in quotations:
            qid = int(q.id)
            rid = getattr(q, "sales_review_id", None)
            missing = bool(rid) and int(rid) not in alive_review_ids
            review_missing_by_id[qid] = missing
            if missing:
                stale_review_q_ids.append(qid)
                q.sales_review_id = None
                q.sales_review_code = None
                review_missing_by_id[qid] = False
        if stale_review_q_ids:
            await Quotation.filter(
                tenant_id=tenant_id, id__in=stale_review_q_ids
            ).update(sales_review_id=None, sales_review_code=None)
        data = []
        items_by_quotation: Dict[int, List[QuotationItem]] = {}
        if include_items and quotations:
            q_ids = [int(q.id) for q in quotations if q.id is not None]
            if q_ids:
                all_items = (
                    await QuotationItem.filter(tenant_id=tenant_id, quotation_id__in=q_ids)
                    .order_by("quotation_id", "id")
                    .all()
                )
                for it in all_items:
                    qid = int(it.quotation_id)
                    items_by_quotation.setdefault(qid, []).append(it)
        for q in quotations:
            line_items = items_by_quotation.get(int(q.id)) if include_items else None
            r = self._quotation_to_response(q, items=line_items)
            conv_missing = missing_by_id[int(q.id)]
            contract_missing = contract_missing_by_id[int(q.id)]
            lifecycle = get_quotation_lifecycle(
                q,
                converted_sales_order_missing=conv_missing,
                contract_downstream_missing=contract_missing,
                audit_required=audit_required,
            )
            data.append(
                r.model_copy(
                    update={
                        "lifecycle": lifecycle,
                        "conversion_downstream_missing": conv_missing,
                        "contract_downstream_missing": contract_missing,
                    }
                )
            )
        from core.services.approval.audit_record_enricher import enrich_items

        data = await enrich_items(tenant_id, "quotation", data)
        data = await enrich_quotation_list_capabilities(
            tenant_id,
            list(quotations),
            data,
            conversion_downstream_missing_by_id=missing_by_id,
            contract_downstream_missing_by_id=contract_missing_by_id,
            sales_review_downstream_missing_by_id=review_missing_by_id,
        )
        return QuotationListResponse(data=data, total=total, success=True)

    async def update_quotation(
        self,
        tenant_id: int,
        quotation_id: int,
        quotation_data: QuotationUpdate,
        updated_by: int,
        current_user: Optional[User] = None,
        approval_edit_context: Optional[Dict[str, Any]] = None,
        approval_edit_comment: Optional[str] = None,
    ) -> QuotationResponse:
        """更新报价单"""
        quotation = await Quotation.get_or_none(
            tenant_id=tenant_id, id=quotation_id, deleted_at__isnull=True
        )
        if not quotation:
            raise NotFoundError(f"报价单不存在: {quotation_id}")
        if current_user:
            await DataScopeService.assert_row_visible(
                quotation,
                tenant_id=tenant_id,
                user=current_user,
                resource="kuaizhizao:quotation",
            )
        rs = (quotation.review_status or "").strip()
        is_draft = quotation.status == "草稿"
        is_pending_audit = quotation.status == "已发送" and (
            rs in LEGACY_PENDING_VALUES or rs == ""
        )
        await self._assert_quotation_capability(tenant_id, quotation, "update")
        if not is_draft and not is_pending_audit:
            if approval_edit_context:
                pass
            else:
                from core.services.approval.approval_edit_guard import ApprovalEditGuard

                edit_ctx = await ApprovalEditGuard.get_pending_edit_context(
                    tenant_id, "quotation", quotation_id, updated_by
                )
                if not edit_ctx:
                    raise BusinessLogicError(
                        f"只能更新草稿或待审核中的报价单，当前状态: {quotation.status}"
                    )

        if approval_edit_context:
            from core.config.audit_editable_fields import is_field_editable

            node_editable = approval_edit_context.get("editable_fields")
            preview = quotation_data.model_dump(exclude_unset=True, exclude={"items"})
            for field in preview:
                if field in ("updated_by",):
                    continue
                if not is_field_editable("quotation", field, node_editable):
                    raise ValidationError(f"字段「{field}」不允许在审核中修改")
            if quotation_data.items is not None and not is_field_editable(
                "quotation", "items", node_editable
            ):
                raise ValidationError("字段「报价明细」不允许在审核中修改")

        async with in_transaction():
            self._validate_quotation_non_negative(
                total_quantity=getattr(quotation_data, "total_quantity", None),
                total_amount=getattr(quotation_data, "total_amount", None),
            )
            upd = quotation_data.model_dump(exclude_unset=True, exclude={"items"})
            upd["updated_by"] = updated_by
            if upd:
                await Quotation.filter(id=quotation_id).update(**upd)

            if quotation_data.items is not None:
                await QuotationItem.filter(
                    tenant_id=tenant_id, quotation_id=quotation_id
                ).delete()
                total_qty = Decimal("0")
                total_amt = Decimal("0")
                q_row = await Quotation.get(id=quotation_id)
                pt = str(getattr(q_row, "price_type", None) or DEFAULT_SALES_PRICE_TYPE)
                material_map = await self._load_material_master_map(
                    tenant_id,
                    [item_data.material_id for item_data in quotation_data.items],
                )
                for item_data in quotation_data.items:
                    row = self._process_quotation_item_pricing(
                        item_data,
                        material_map,
                        price_type=pt,
                        line_inclusive_fn=self._quotation_line_inclusive_amount,
                    )
                    total_qty += row["quote_quantity"]
                    total_amt += row["total_amount"]
                    await QuotationItem.create(
                        tenant_id=tenant_id,
                        quotation_id=quotation_id,
                        material_id=row["material_id"],
                        material_code=row["material_code"],
                        material_name=row["material_name"],
                        material_spec=row["material_spec"],
                        material_unit=row["material_unit"],
                        quote_quantity=row["quote_quantity"],
                        unit_price=row["unit_price"],
                        tax_rate=row["tax_rate"],
                        total_amount=row["total_amount"],
                        variant_attributes=row["variant_attributes"],
                        pricing_snapshot=row.get("pricing_snapshot"),
                        delivery_date=row["delivery_date"],
                        notes=row["notes"],
                        is_gift=row["is_gift"],
                        gift_ref_unit_price=row["gift_ref_unit_price"],
                    )
                await self._refresh_quotation_totals(
                    tenant_id,
                    quotation_id,
                    getattr(quotation_data, "discount_amount", None),
                )
            elif quotation_data.discount_amount is not None:
                await self._refresh_quotation_totals(
                    tenant_id,
                    quotation_id,
                    quotation_data.discount_amount,
                )

        return await self.get_quotation_by_id(tenant_id, quotation_id, include_items=True)

    async def create_quotation_revision(
        self,
        tenant_id: int,
        source_quotation_id: int,
        created_by: int,
        revision_data: Optional[QuotationRevisionBody] = None,
    ) -> QuotationResponse:
        """
        新建修订版：复制系列当前最新版为新的草稿修订行，旧版标记为非最新。
        source_quotation_id 可为系列内任一行，系统会解析到 is_latest_in_series 行。
        """
        is_enabled = await self.business_config_service.check_node_enabled(tenant_id, "quotation")
        if not is_enabled:
            raise BusinessLogicError("报价单节点未启用，无法创建修订版")

        src = await Quotation.get_or_none(
            tenant_id=tenant_id, id=source_quotation_id, deleted_at__isnull=True
        )
        if not src:
            raise NotFoundError(f"报价单不存在: {source_quotation_id}")

        series = (src.quotation_series_code or src.quotation_code or "").strip()
        if not series:
            raise BusinessLogicError("报价系列编码缺失，无法修订")

        latest = await Quotation.get_or_none(
            tenant_id=tenant_id,
            quotation_series_code=series,
            is_latest_in_series=True,
            deleted_at__isnull=True,
        )
        if not latest:
            raise BusinessLogicError("未找到该系列的最新版本报价单")
        if latest.id != src.id:
            raise BusinessLogicError(
                f"存在更新版本，请从最新版发起修订：{latest.quotation_code}"
            )

        await self._assert_quotation_capability(tenant_id, latest, "create_revision")

        new_vn = int(latest.version_no or 1) + 1
        new_code = self._next_revision_quotation_code(series, new_vn)
        root_id = latest.root_quotation_id or latest.id

        overrides = (
            revision_data.model_dump(exclude_unset=True) if revision_data else {}
        )
        item_override = overrides.pop("items", None)

        row_price_type = str(
            overrides.get("price_type", getattr(latest, "price_type", None) or DEFAULT_SALES_PRICE_TYPE)
        )
        from apps.common.base_service import AppBaseService

        operator_name = await AppBaseService().get_user_name(created_by)

        async with in_transaction():
            new_row = await Quotation.create(
                tenant_id=tenant_id,
                quotation_code=new_code,
                quotation_series_code=series,
                root_quotation_id=root_id,
                version_no=new_vn,
                previous_quotation_id=latest.id,
                is_latest_in_series=True,
                superseded_by_id=None,
                formal_document_generated_at=None,
                quotation_date=overrides.get("quotation_date", latest.quotation_date),
                valid_until=overrides.get("valid_until", latest.valid_until),
                delivery_date=overrides.get("delivery_date", latest.delivery_date),
                customer_id=overrides.get("customer_id", latest.customer_id),
                customer_name=overrides.get("customer_name", latest.customer_name),
                customer_contact=overrides.get("customer_contact", latest.customer_contact),
                customer_phone=overrides.get("customer_phone", latest.customer_phone),
                total_quantity=overrides.get("total_quantity", latest.total_quantity),
                total_amount=overrides.get("total_amount", latest.total_amount),
                discount_amount=overrides.get(
                    "discount_amount", getattr(latest, "discount_amount", None) or Decimal("0")
                ),
                price_type=row_price_type,
                status="草稿",
                review_status="",
                reviewer_id=None,
                reviewer_name=None,
                review_time=None,
                review_remarks=None,
                salesman_id=overrides.get("salesman_id", latest.salesman_id),
                salesman_name=overrides.get("salesman_name", latest.salesman_name),
                shipping_address=overrides.get("shipping_address", latest.shipping_address),
                shipping_method=overrides.get("shipping_method", latest.shipping_method),
                payment_terms=overrides.get("payment_terms", latest.payment_terms),
                currency_code=overrides.get("currency_code", latest.currency_code or "CNY"),
                sales_order_id=None,
                sales_order_code=None,
                notes=overrides.get("notes", latest.notes),
                is_active=True,
                created_by=created_by,
                created_by_name=operator_name,
                updated_by=created_by,
                updated_by_name=operator_name,
            )

            await Quotation.filter(id=latest.id).update(
                is_latest_in_series=False,
                superseded_by_id=new_row.id,
                updated_by=created_by,
            )

            if item_override is not None:
                if not item_override:
                    raise ValidationError("修订版至少需要一条报价明细")
                item_source = item_override
            else:
                item_source = await QuotationItem.filter(
                    tenant_id=tenant_id, quotation_id=latest.id
                ).order_by("id")
                if not item_source:
                    raise BusinessLogicError("源报价无明细，无法修订")

            total_qty = Decimal("0")
            total_amt = Decimal("0")
            for item_data in item_source:
                if isinstance(item_data, QuotationItem):
                    qty = item_data.quote_quantity
                    unit_pr = item_data.unit_price or Decimal("0")
                    tax_r = getattr(item_data, "tax_rate", None) or Decimal("0")
                    amt = self._quotation_line_inclusive_amount(
                        qty, unit_pr, tax_r, row_price_type
                    )
                    self._validate_quotation_item_non_negative(
                        quote_quantity=qty,
                        unit_price=unit_pr,
                        tax_rate=tax_r,
                        total_amount=item_data.total_amount,
                    )
                    mid = item_data.material_id
                    mcode = item_data.material_code
                    mname = item_data.material_name
                    mspec = item_data.material_spec
                    munit = item_data.material_unit
                    ddate = item_data.delivery_date
                    nit = item_data.notes
                    mvar = getattr(item_data, "variant_attributes", None)
                    is_gift = bool(getattr(item_data, "is_gift", False))
                    gift_ref = getattr(item_data, "gift_ref_unit_price", None)
                else:
                    qty = item_data.quote_quantity
                    unit_pr = item_data.unit_price or Decimal("0")
                    tax_r = (
                        item_data.tax_rate
                        if item_data.tax_rate is not None
                        else Decimal("0")
                    )
                    amt = self._quotation_line_inclusive_amount(
                        qty, unit_pr, tax_r, row_price_type
                    )
                    self._validate_quotation_item_non_negative(
                        quote_quantity=qty,
                        unit_price=unit_pr,
                        tax_rate=tax_r,
                        total_amount=item_data.total_amount,
                    )
                    mid = item_data.material_id
                    mcode = (item_data.material_code or "")[:50]
                    mname = (item_data.material_name or "")[:200]
                    mspec = (item_data.material_spec or "")[:200] or None
                    munit = (item_data.material_unit or "")[:20]
                    ddate = item_data.delivery_date
                    nit = item_data.notes
                    mvar = getattr(item_data, "variant_attributes", None)
                    is_gift = bool(getattr(item_data, "is_gift", False))
                    gift_ref = getattr(item_data, "gift_ref_unit_price", None)

                total_qty += qty
                total_amt += amt
                await QuotationItem.create(
                    tenant_id=tenant_id,
                    quotation_id=new_row.id,
                    material_id=mid,
                    material_code=(mcode or "")[:50],
                    material_name=(mname or "")[:200],
                    material_spec=(mspec or "")[:200] or None,
                    material_unit=(munit or "")[:20],
                    quote_quantity=qty,
                    unit_price=unit_pr,
                    tax_rate=tax_r,
                    total_amount=amt,
                    variant_attributes=mvar,
                    pricing_snapshot=getattr(item_data, "pricing_snapshot", None),
                    delivery_date=ddate,
                    notes=nit,
                    is_gift=is_gift,
                    gift_ref_unit_price=gift_ref,
                )

            disc = overrides.get(
                "discount_amount", getattr(latest, "discount_amount", None) or Decimal("0")
            )
            await self._refresh_quotation_totals(tenant_id, new_row.id, disc)

        return await self.get_quotation_by_id(tenant_id, new_row.id, include_items=True)

    async def delete_quotation(
        self,
        tenant_id: int,
        quotation_id: int,
        current_user: Optional[User] = None,
    ) -> None:
        """删除报价单（软删除）。存在有效下游销售订单时禁止删除；下游已删则允许删除。"""
        quotation = await Quotation.get_or_none(
            tenant_id=tenant_id, id=quotation_id, deleted_at__isnull=True
        )
        if not quotation:
            raise NotFoundError(f"报价单不存在: {quotation_id}")
        if current_user:
            await DataScopeService.assert_row_visible(
                quotation,
                tenant_id=tenant_id,
                user=current_user,
                resource="kuaizhizao:quotation",
            )
        conv_missing = await self._quotation_conversion_downstream_missing(
            tenant_id, quotation
        )
        contract_missing = await self._quotation_contract_downstream_missing(
            tenant_id, quotation
        )
        await self._assert_quotation_capability(
            tenant_id,
            quotation,
            "delete",
            conversion_downstream_missing=conv_missing,
            contract_downstream_missing=contract_missing,
        )
        now = resolve_business_datetime()
        await Quotation.filter(
            id=quotation_id, tenant_id=tenant_id
        ).update(deleted_at=now)

    async def _load_quotation_push_context(
        self,
        tenant_id: int,
        quotation_id: int,
        *,
        operator_id: int = 0,
    ) -> tuple[Any, list[Any], bool, bool, Any]:
        """加载下推预览/转换共用上下文（含下游缺失检测与能力推导）。"""
        await self._detach_quotation_if_downstream_sales_order_deleted(
            tenant_id, quotation_id, operator_id, log_transition=False
        )
        await self._detach_quotation_if_contract_deleted(
            tenant_id, quotation_id, operator_id
        )
        quotation = await Quotation.get_or_none(
            tenant_id=tenant_id, id=quotation_id, deleted_at__isnull=True
        )
        if not quotation:
            raise NotFoundError(f"报价单不存在: {quotation_id}")
        conv_missing = await self._quotation_conversion_downstream_missing(
            tenant_id, quotation
        )
        contract_missing = await self._quotation_contract_downstream_missing(
            tenant_id, quotation
        )
        review_missing = await self._quotation_sales_review_downstream_missing(
            tenant_id, quotation
        )
        items = await QuotationItem.filter(
            tenant_id=tenant_id, quotation_id=quotation_id
        ).order_by("id")
        audit_required = await self.business_config_service.check_audit_required(
            tenant_id, "quotation"
        )
        from apps.kuaizhizao.services.document_action_policy.quotation import (
            derive_quotation_capabilities,
        )

        caps = derive_quotation_capabilities(
            quotation,
            audit_required=audit_required,
            conversion_downstream_missing=conv_missing,
            contract_downstream_missing=contract_missing,
            sales_review_downstream_missing=review_missing,
        )
        return quotation, items, conv_missing, contract_missing, review_missing, caps

    @staticmethod
    def _build_quotation_push_preview_items(
        items: list[Any],
        *,
        push_allowed: bool,
        already_pushed: bool,
    ) -> list[Dict[str, Any]]:
        preview_items: list[Dict[str, Any]] = []
        for it in items:
            qty = float(it.quote_quantity or 0)
            if qty <= 0:
                continue
            if push_allowed:
                pushed_qty = 0.0
                max_push_qty = qty
            elif already_pushed:
                pushed_qty = qty
                max_push_qty = 0.0
            else:
                pushed_qty = 0.0
                max_push_qty = 0.0
            preview_items.append(
                {
                    "item_id": int(it.id),
                    "material_id": it.material_id,
                    "material_code": it.material_code,
                    "material_name": it.material_name,
                    "material_spec": it.material_spec,
                    "material_unit": it.material_unit,
                    "quantity": qty,
                    "pushed_quantity": pushed_qty,
                    "max_push_quantity": max_push_qty,
                    "delivery_date": (
                        it.delivery_date.isoformat() if it.delivery_date else None
                    ),
                    "unit_price": float(it.unit_price or 0),
                    "total_amount": float(it.total_amount or 0),
                }
            )
        return preview_items

    async def preview_push_quotation_to_sales_order(
        self,
        tenant_id: int,
        quotation_id: int,
    ) -> Dict[str, Any]:
        """下推销售订单预览：返回明细数量、已下推、可下推。"""
        quotation, items, conv_missing, _contract_missing, _review_missing, caps = (
            await self._load_quotation_push_context(tenant_id, quotation_id)
        )
        if not items:
            raise BusinessLogicError("报价单无明细，无法下推销售订单")

        push_allowed = caps.convert_to_order.allowed
        already_pushed = bool(quotation.sales_order_id) and not conv_missing
        preview_items = self._build_quotation_push_preview_items(
            items,
            push_allowed=push_allowed,
            already_pushed=already_pushed,
        )
        if not preview_items:
            raise BusinessLogicError("报价单无有效明细数量，无法下推销售订单")

        pushable_count = sum(
            1 for row in preview_items if float(row.get("max_push_quantity") or 0) > 0
        )
        return {
            "target_type": "sales_order",
            "summary": (
                f"请选择本次要下推的报价明细（{pushable_count}/{len(preview_items)} 行可下推）"
                if push_allowed
                else "当前报价单不可下推销售订单"
            ),
            "items": preview_items,
            "has_blocking_issues": not push_allowed,
            "blocking_reason": (
                caps.convert_to_order.reason if not push_allowed else None
            ),
            "tip": "确认后将按全部报价明细创建销售订单；整单转换后报价单状态变为「已转订单」。",
        }

    async def preview_push_quotation_to_sales_contract(
        self,
        tenant_id: int,
        quotation_id: int,
    ) -> Dict[str, Any]:
        """下推销售合同预览：返回明细数量、已下推、可下推。"""
        quotation, items, _conv_missing, contract_missing, _review_missing, caps = (
            await self._load_quotation_push_context(tenant_id, quotation_id)
        )
        if not items:
            raise BusinessLogicError("报价单无明细，无法下推销售合同")

        push_allowed = caps.convert_to_contract.allowed
        already_pushed = bool(quotation.contract_id) and not contract_missing
        preview_items = self._build_quotation_push_preview_items(
            items,
            push_allowed=push_allowed,
            already_pushed=already_pushed,
        )
        if not preview_items:
            raise BusinessLogicError("报价单无有效明细数量，无法下推销售合同")

        pushable_count = sum(
            1 for row in preview_items if float(row.get("max_push_quantity") or 0) > 0
        )
        return {
            "target_type": "sales_contract",
            "summary": (
                f"请确认将下推的报价明细（{pushable_count}/{len(preview_items)} 行可下推）"
                if push_allowed
                else "当前报价单不可下推销售合同"
            ),
            "items": preview_items,
            "has_blocking_issues": not push_allowed,
            "blocking_reason": (
                caps.convert_to_contract.reason if not push_allowed else None
            ),
            "tip": "确认后将按报价明细创建销售合同；转换后报价单状态变为「已转订单」。",
        }

    async def convert_to_sales_order(
        self,
        tenant_id: int,
        quotation_id: int,
        created_by: int,
        selected_item_ids: Optional[List[int]] = None,
    ):
        """
        将报价单转为销售订单

        创建销售订单及明细，更新报价单状态为「已转订单」，建立关联。
        返回 (sales_order_response, quotation_response)
        """
        await self._detach_quotation_if_downstream_sales_order_deleted(
            tenant_id, quotation_id, created_by, log_transition=False
        )
        await self._detach_quotation_if_contract_deleted(
            tenant_id, quotation_id, created_by
        )
        await self._detach_quotation_if_sales_review_deleted(
            tenant_id, quotation_id, created_by
        )
        quotation = await Quotation.get_or_none(
            tenant_id=tenant_id, id=quotation_id, deleted_at__isnull=True
        )
        if not quotation:
            raise NotFoundError(f"报价单不存在: {quotation_id}")
        conv_missing = await self._quotation_conversion_downstream_missing(
            tenant_id, quotation
        )
        contract_missing = await self._quotation_contract_downstream_missing(
            tenant_id, quotation
        )
        review_missing = await self._quotation_sales_review_downstream_missing(
            tenant_id, quotation
        )
        await self._assert_quotation_capability(
            tenant_id,
            quotation,
            "convert_to_order",
            conversion_downstream_missing=conv_missing,
            contract_downstream_missing=contract_missing,
            sales_review_downstream_missing=review_missing,
        )
        if quotation.sales_order_id:
            raise BusinessLogicError("该报价单已关联销售订单，无法重复转换")
        biz = await self.business_config_service.get_business_config(tenant_id)
        if biz.get("parameters", {}).get("sales", {}).get("require_contract_before_order"):
            raise BusinessLogicError("当前配置要求经销售合同转单，请先将报价转为销售合同并从合同下推订单")

        items = await QuotationItem.filter(
            tenant_id=tenant_id, quotation_id=quotation_id
        ).order_by("id")
        if not items:
            raise BusinessLogicError("报价单无明细，无法转为销售订单")

        if selected_item_ids is not None:
            selected_ids = {
                int(v) for v in selected_item_ids if v is not None and str(v).strip()
            }
            if not selected_ids:
                raise BusinessLogicError("未选择可转换的报价明细")
            item_map = {int(it.id): it for it in items}
            missing_ids = sorted([iid for iid in selected_ids if iid not in item_map])
            if missing_ids:
                raise BusinessLogicError(f"存在无效的报价明细ID: {missing_ids}")
            items = [it for it in items if int(it.id) in selected_ids]
            if not items:
                raise BusinessLogicError("所选报价明细为空，无法转为销售订单")
            all_item_ids = {int(it.id) for it in await QuotationItem.filter(
                tenant_id=tenant_id, quotation_id=quotation_id
            )}
            if selected_ids != all_item_ids:
                raise BusinessLogicError("报价单须整单下推销售订单，请在下推预览中确认全部可下推明细")

        # 构建 SalesOrderCreate
        order_date = quotation.quotation_date
        valid_dates = [it.delivery_date for it in items if it.delivery_date]
        delivery_date = quotation.delivery_date or (
            min(valid_dates) if valid_dates else order_date
        )

        q_price_type = getattr(quotation, "price_type", None) or DEFAULT_SALES_PRICE_TYPE

        all_items = await QuotationItem.filter(
            tenant_id=tenant_id, quotation_id=quotation_id
        ).order_by("id")
        full_goods = sum((it.total_amount or Decimal("0")) for it in all_items)
        selected_goods = sum((it.total_amount or Decimal("0")) for it in items)
        q_discount = Decimal(str(getattr(quotation, "discount_amount", None) or 0))
        if full_goods > 0 and len(items) < len(all_items):
            discount = (q_discount * selected_goods / full_goods).quantize(
                Decimal("0.01"), rounding=ROUND_HALF_UP
            )
        else:
            discount = q_discount
        selected_qty = sum((it.quote_quantity or Decimal("0")) for it in items)

        so_items = [
            SalesOrderItemCreate(
                material_id=it.material_id,
                material_code=it.material_code,
                material_name=it.material_name,
                material_spec=it.material_spec,
                material_unit=it.material_unit,
                required_quantity=it.quote_quantity,
                delivery_date=it.delivery_date or delivery_date,
                unit_price=it.unit_price,
                tax_rate=getattr(it, "tax_rate", None) or Decimal("0"),
                variant_attributes=getattr(it, "variant_attributes", None),
                item_amount=it.total_amount,
                is_gift=bool(getattr(it, "is_gift", False)),
                gift_ref_unit_price=getattr(it, "gift_ref_unit_price", None),
                notes=it.notes,
            )
            for it in items
        ]

        so_create = SalesOrderCreate(
            order_date=order_date,
            delivery_date=delivery_date,
            customer_id=quotation.customer_id,
            customer_name=quotation.customer_name,
            customer_contact=quotation.customer_contact,
            customer_phone=quotation.customer_phone,
            total_quantity=selected_qty,
            discount_amount=discount,
            price_type=q_price_type,
            status=DemandStatus.DRAFT,
            review_status=ReviewStatus.PENDING,
            salesman_id=quotation.salesman_id,
            salesman_name=quotation.salesman_name,
            shipping_address=quotation.shipping_address,
            shipping_method=quotation.shipping_method,
            payment_terms=quotation.payment_terms,
            currency_code=quotation.currency_code or "CNY",
            notes=quotation.notes or f"由报价单 {quotation.quotation_code} 转入",
            items=so_items,
        )

        from apps.kuaizhizao.services.sales_order_service import SalesOrderService
        sales_order_service = SalesOrderService()
        sales_order = await sales_order_service.create_sales_order(
            tenant_id=tenant_id,
            sales_order_data=so_create,
            created_by=created_by,
        )
        sales_order = await sales_order_service.apply_push_default_mode_after_create(
            tenant_id=tenant_id,
            sales_order_id=int(sales_order.id),
            created_by=created_by,
        )

        from apps.common.base_service import AppBaseService

        prev_status = (quotation.status or "").strip() or "已发送"
        op_name = await AppBaseService().get_user_name(created_by)
        async with in_transaction():
            await Quotation.filter(id=quotation_id).update(
                status="已转订单",
                sales_order_id=sales_order.id,
                sales_order_code=sales_order.order_code,
                updated_by=created_by,
            )
            await self._log_quotation_state_transition(
                tenant_id,
                quotation_id,
                prev_status,
                "已转订单",
                created_by,
                op_name,
                "转销售订单",
            )

        # 建立单据关联（quotation -> sales_order）
        try:
            from apps.kuaizhizao.services.document_relation_new_service import DocumentRelationNewService
            from apps.kuaizhizao.schemas.document_relation import DocumentRelationCreate
            rel_svc = DocumentRelationNewService()
            await rel_svc.create_relation(
                tenant_id=tenant_id,
                relation_data=DocumentRelationCreate(
                    source_type="quotation",
                    source_id=quotation_id,
                    source_code=quotation.quotation_code,
                    source_name=quotation.quotation_code,
                    target_type="sales_order",
                    target_id=sales_order.id,
                    target_code=sales_order.order_code,
                    target_name=sales_order.order_code,
                    relation_type="source",
                    relation_mode="push",
                    relation_desc="报价单转销售订单",
                ),
                created_by=created_by,
            )
        except BusinessLogicError:
            pass  # 关联已存在，忽略
        except Exception as e:
            logger.warning("建立报价单-销售订单关联失败: %s", e)

        quotation_updated = await self.get_quotation_by_id(
            tenant_id, quotation_id, include_items=True
        )
        return sales_order, quotation_updated

    async def preview_push_quotation_to_sales_review(
        self,
        tenant_id: int,
        quotation_id: int,
    ) -> Dict[str, Any]:
        """下推订单评审预览。"""
        quotation, items, _conv_missing, _contract_missing, review_missing, caps = (
            await self._load_quotation_push_context(tenant_id, quotation_id)
        )
        if not items:
            raise BusinessLogicError("报价单无明细，无法下推订单评审")

        push_allowed = caps.convert_to_sales_review.allowed
        already_pushed = bool(getattr(quotation, "sales_review_id", None)) and not review_missing
        preview_items = self._build_quotation_push_preview_items(
            items,
            push_allowed=push_allowed,
            already_pushed=already_pushed,
        )
        if not preview_items:
            raise BusinessLogicError("报价单无有效明细数量，无法下推订单评审")

        pushable_count = sum(
            1 for row in preview_items if float(row.get("max_push_quantity") or 0) > 0
        )
        return {
            "target_type": "sales_review",
            "summary": (
                f"请确认将下推的报价明细（{pushable_count}/{len(preview_items)} 行可下推）"
                if push_allowed
                else "当前报价单不可下推订单评审"
            ),
            "items": preview_items,
            "has_blocking_issues": not push_allowed,
            "blocking_reason": (
                caps.convert_to_sales_review.reason if not push_allowed else None
            ),
            "tip": "确认后将按报价明细创建订单评审草稿；报价单状态不变，后续由订单评审下推销售订单。",
        }

    async def convert_to_sales_review(
        self,
        tenant_id: int,
        quotation_id: int,
        created_by: int,
        selected_item_ids: Optional[List[int]] = None,
    ):
        """
        将报价单转为订单评审。

        创建订单评审及明细，回写报价单 sales_review_id，建立关联；不改变报价单业务状态。
        返回 (sales_review_response, quotation_response)
        """
        await self._detach_quotation_if_downstream_sales_order_deleted(
            tenant_id, quotation_id, created_by, log_transition=False
        )
        await self._detach_quotation_if_contract_deleted(
            tenant_id, quotation_id, created_by
        )
        await self._detach_quotation_if_sales_review_deleted(
            tenant_id, quotation_id, created_by
        )
        quotation = await Quotation.get_or_none(
            tenant_id=tenant_id, id=quotation_id, deleted_at__isnull=True
        )
        if not quotation:
            raise NotFoundError(f"报价单不存在: {quotation_id}")
        conv_missing = await self._quotation_conversion_downstream_missing(
            tenant_id, quotation
        )
        contract_missing = await self._quotation_contract_downstream_missing(
            tenant_id, quotation
        )
        review_missing = await self._quotation_sales_review_downstream_missing(
            tenant_id, quotation
        )
        await self._assert_quotation_capability(
            tenant_id,
            quotation,
            "convert_to_sales_review",
            conversion_downstream_missing=conv_missing,
            contract_downstream_missing=contract_missing,
            sales_review_downstream_missing=review_missing,
        )
        if quotation.sales_review_id and not review_missing:
            raise BusinessLogicError("该报价单已关联订单评审，无法重复转换")

        items = await QuotationItem.filter(
            tenant_id=tenant_id, quotation_id=quotation_id
        ).order_by("id")
        if not items:
            raise BusinessLogicError("报价单无明细，无法转为订单评审")

        if selected_item_ids is not None:
            selected_ids = {
                int(v) for v in selected_item_ids if v is not None and str(v).strip()
            }
            if not selected_ids:
                raise BusinessLogicError("未选择可转换的报价明细")
            item_map = {int(it.id): it for it in items}
            missing_ids = sorted([iid for iid in selected_ids if iid not in item_map])
            if missing_ids:
                raise BusinessLogicError(f"存在无效的报价明细ID: {missing_ids}")
            items = [it for it in items if int(it.id) in selected_ids]
            all_item_ids = {
                int(it.id)
                for it in await QuotationItem.filter(
                    tenant_id=tenant_id, quotation_id=quotation_id
                )
            }
            if selected_ids != all_item_ids:
                raise BusinessLogicError(
                    "报价单须整单下推订单评审，请在下推预览中确认全部可下推明细"
                )

        from apps.kuaizhizao.schemas.sales_review import (
            SalesReviewCreate,
            SalesReviewItemCreate,
        )
        from apps.kuaizhizao.services.sales_review_service import SalesReviewService

        review_items = [
            SalesReviewItemCreate(
                material_id=it.material_id,
                material_code=it.material_code or "",
                material_name=it.material_name or "",
                material_spec=it.material_spec,
                material_unit=it.material_unit,
                quantity=it.quote_quantity or Decimal("0"),
                unit_price=it.unit_price or Decimal("0"),
                notes=it.notes,
            )
            for it in items
            if (it.quote_quantity or Decimal("0")) > 0
        ]
        if not review_items:
            raise BusinessLogicError("报价单无有效明细数量，无法转为订单评审")

        review_date = to_site_date(resolve_business_datetime())
        project_name = (quotation.notes or "").strip()[:200] or f"报价 {quotation.quotation_code}"
        create_data = SalesReviewCreate(
            customer_id=quotation.customer_id,
            customer_name=quotation.customer_name,
            customer_contact=quotation.customer_contact,
            customer_phone=quotation.customer_phone,
            project_name=project_name,
            review_date=review_date,
            delivery_date=quotation.delivery_date,
            payment_cycle=quotation.payment_terms,
            delivery_location=quotation.shipping_address,
            transport_method=quotation.shipping_method,
            remarks=quotation.notes,
            quotation_id=quotation_id,
            quotation_code=quotation.quotation_code,
            salesman_id=quotation.salesman_id,
            salesman_name=quotation.salesman_name,
            items=review_items,
        )
        user = await User.get_or_none(id=created_by)
        if not user:
            raise NotFoundError(f"用户不存在: {created_by}")
        review = await SalesReviewService().create(tenant_id, create_data, user)

        await Quotation.filter(id=quotation_id).update(
            sales_review_id=review.id,
            sales_review_code=review.review_code,
            updated_by=created_by,
        )

        try:
            from apps.kuaizhizao.services.document_relation_new_service import (
                DocumentRelationNewService,
            )
            from apps.kuaizhizao.schemas.document_relation import DocumentRelationCreate

            await DocumentRelationNewService().create_relation(
                tenant_id=tenant_id,
                relation_data=DocumentRelationCreate(
                    source_type="quotation",
                    source_id=quotation_id,
                    source_code=quotation.quotation_code,
                    source_name=quotation.quotation_code,
                    target_type="sales_review",
                    target_id=review.id,
                    target_code=review.review_code,
                    target_name=review.project_name or review.review_code,
                    relation_type="source",
                    relation_mode="push",
                    relation_desc="报价单下推订单评审",
                ),
                created_by=created_by,
            )
        except BusinessLogicError:
            pass
        except Exception as e:
            logger.warning("建立报价单-订单评审关联失败: %s", e)

        quotation_updated = await self.get_quotation_by_id(
            tenant_id, quotation_id, include_items=True
        )
        return review, quotation_updated
