"""
报价单管理服务模块

提供报价单相关的业务逻辑处理。
报价单可转销售订单，建立 quotation -> sales_order 关联。

Author: RiverEdge Team
Date: 2026-02-19
"""

from typing import List, Optional, Set
from datetime import datetime, date
from decimal import Decimal, ROUND_HALF_UP
from tortoise.transactions import in_transaction
from loguru import logger

from apps.kuaizhizao.models.quotation import Quotation
from apps.kuaizhizao.models.quotation_item import QuotationItem
from apps.master_data.models.customer import Customer
from apps.kuaizhizao.models.sales_order import SalesOrder
from apps.kuaizhizao.models.sales_order_item import SalesOrderItem
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
from apps.kuaizhizao.constants import DemandStatus, ReviewStatus, LEGACY_PENDING_VALUES
from apps.kuaizhizao.services.document_lifecycle_service import _is_approved
from infra.exceptions.exceptions import NotFoundError, BusinessLogicError, ValidationError
from infra.models.user import User
from infra.services.business_config_service import BusinessConfigService


class QuotationService:
    """报价单管理服务"""

    def __init__(self):
        self.business_config_service = BusinessConfigService()

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

    async def _detach_quotation_if_downstream_sales_order_deleted(
        self,
        tenant_id: int,
        quotation_id: int,
        operator_id: int,
    ) -> None:
        """若下游销售订单已删除，解除报价单上的转单标记，回到可再次下推的状态（已接受）。"""
        q = await Quotation.get_or_none(
            tenant_id=tenant_id, id=quotation_id, deleted_at__isnull=True
        )
        if not q:
            return
        missing = await QuotationService._quotation_conversion_downstream_missing(
            tenant_id, q
        )
        if not missing:
            return
        await Quotation.filter(tenant_id=tenant_id, id=quotation_id).update(
            status="已接受",
            sales_order_id=None,
            sales_order_code=None,
            updated_by=operator_id,
        )

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
                transition_time=datetime.now(),
            )
        except Exception as e:
            logger.warning("报价单状态流转日志写入失败，跳过: %s", e)

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
        pt = (price_type or "tax_exclusive").strip()
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
            "price_type": getattr(quotation, "price_type", None) or "tax_exclusive",
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
            "notes": quotation.notes,
            "is_active": quotation.is_active,
            "created_by": quotation.created_by,
            "updated_by": quotation.updated_by,
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
        from core.config.code_rule_pages import CODE_RULE_PAGES
        from core.services.business.code_generation_service import CodeGenerationService

        rule_code = next(
            (
                p.get("rule_code")
                for p in CODE_RULE_PAGES
                if p.get("page_code") == "kuaizhizao-quotation"
            ),
            None,
        )
        context = {}
        if quotation_date:
            context["quotation_date"] = (
                quotation_date.isoformat()
                if hasattr(quotation_date, "isoformat")
                else str(quotation_date)
            )
        generated = None
        if rule_code:
            try:
                generated = await CodeGenerationService.generate_code(
                    tenant_id=tenant_id,
                    rule_code=rule_code,
                    context=context or None,
                )
            except Exception as e:
                from infra.exceptions.exceptions import ValidationError
                if isinstance(e, ValidationError) and ("不存在" in str(e) or "未启用" in str(e)):
                    from core.services.default.default_values_service import DefaultValuesService
                    created = await DefaultValuesService.ensure_code_rule_for_page(
                        tenant_id, "kuaizhizao-quotation"
                    )
                    if created:
                        try:
                            generated = await CodeGenerationService.generate_code(
                                tenant_id=tenant_id,
                                rule_code=rule_code,
                                context=context or None,
                            )
                        except Exception as e2:
                            logger.warning("报价单编码规则补建后生成仍失败，使用备用格式: %s", e2)
                    else:
                        logger.warning("报价单编码规则生成失败，使用备用格式: %s", e)
                else:
                    logger.warning("报价单编码规则生成失败，使用备用格式: %s", e)
        if generated is None:
            today = datetime.now().strftime("%Y%m%d")
            import uuid
            generated = f"QT-{today}-{uuid.uuid4().hex[:6].upper()}"
        return generated

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

        now = datetime.now()
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
            q_dict["created_by"] = created_by
            q_dict["updated_by"] = created_by
            q_dict["quotation_series_code"] = q_dict.get("quotation_series_code") or q_dict.get(
                "quotation_code"
            )
            q_dict["version_no"] = 1
            q_dict["is_latest_in_series"] = True
            q_dict["previous_quotation_id"] = None
            q_dict["superseded_by_id"] = None
            q_dict["formal_document_generated_at"] = None
            q_dict["root_quotation_id"] = None

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
            pt = str(q_dict.get("price_type") or "tax_exclusive")
            for item_data in quotation_data.items:
                qty = item_data.quote_quantity
                unit_pr = item_data.unit_price or Decimal("0")
                tax_r = (
                    item_data.tax_rate
                    if item_data.tax_rate is not None
                    else Decimal("0")
                )
                self._validate_quotation_item_non_negative(
                    quote_quantity=qty,
                    unit_price=unit_pr,
                    tax_rate=tax_r,
                    total_amount=item_data.total_amount,
                )
                amt = self._quotation_line_inclusive_amount(qty, unit_pr, tax_r, pt)
                total_qty += qty
                total_amt += amt
                await QuotationItem.create(
                    tenant_id=tenant_id,
                    quotation_id=quotation.id,
                    material_id=item_data.material_id,
                    material_code=(item_data.material_code or "")[:50],
                    material_name=(item_data.material_name or "")[:200],
                    material_spec=(item_data.material_spec or "")[:200] or None,
                    material_unit=(item_data.material_unit or "")[:20],
                    quote_quantity=qty,
                    unit_price=unit_pr,
                    tax_rate=tax_r,
                    total_amount=amt,
                    delivery_date=item_data.delivery_date,
                    notes=item_data.notes,
                )

            await Quotation.filter(id=quotation.id).update(
                total_quantity=total_qty,
                total_amount=total_amt,
            )
            quotation = await Quotation.get(id=quotation.id)
            if auto_submit:
                # 创建完成后即提交为「已发送」，生命周期进入「已报价」（审核按蓝图 quotation.auditRequired）
                audit_required = await self.business_config_service.check_audit_required(
                    tenant_id, "quotation"
                )
                await self._release_quotation_from_draft(
                    tenant_id,
                    quotation.id,
                    created_by,
                    auto_approved=not audit_required,
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
        if quotation.status != "草稿":
            raise BusinessLogicError(
                f"仅草稿状态可提交，当前状态: {quotation.status}"
            )
        audit_required = await self.business_config_service.check_audit_required(
            tenant_id, "quotation"
        )
        async with in_transaction():
            await self._release_quotation_from_draft(
                tenant_id,
                quotation_id,
                submitted_by,
                auto_approved=not audit_required,
            )
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
        if quotation.status != "已发送":
            raise BusinessLogicError(
                f"只能撤回「已发送」且待审核的报价单，当前状态: {quotation.status}"
            )
        rs = (quotation.review_status or "").strip()
        if rs not in LEGACY_PENDING_VALUES:
            raise BusinessLogicError(
                f"只能撤回待审核的报价单，当前审核状态: {quotation.review_status}"
            )
        from apps.common.base_service import AppBaseService

        op_name = await AppBaseService().get_user_name(withdrawn_by)
        async with in_transaction():
            await Quotation.filter(tenant_id=tenant_id, id=quotation_id).update(
                status="草稿",
                review_status="待审核",
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
        if quotation.status != "已发送":
            raise BusinessLogicError(f"仅待审核中的报价单可审核通过，当前状态: {quotation.status}")
        rs = (quotation.review_status or "").strip()
        if rs not in LEGACY_PENDING_VALUES and rs != "":
            raise BusinessLogicError(f"仅待审核的报价单可审核通过，当前审核状态: {quotation.review_status}")
        now = datetime.now()
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
        now = datetime.now()
        op_name = await AppBaseService().get_user_name(operator_id)
        async with in_transaction():
            await Quotation.filter(tenant_id=tenant_id, id=quotation_id).update(
                status="已拒绝",
                review_status="审核驳回",
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
                "已拒绝",
                operator_id,
                op_name,
                "审核驳回",
            )
        return await self.get_quotation_by_id(tenant_id, quotation_id, include_items=True)

    async def revoke_review_quotation(
        self,
        tenant_id: int,
        quotation_id: int,
        operator_id: int,
    ) -> QuotationResponse:
        """撤回审核：已发送 + 已通过 → 回到待审核（不回草稿）。"""
        quotation = await Quotation.get_or_none(
            tenant_id=tenant_id, id=quotation_id, deleted_at__isnull=True
        )
        if not quotation:
            raise NotFoundError(f"报价单不存在: {quotation_id}")
        if quotation.status != "已发送":
            raise BusinessLogicError(f"仅已发送且已审核通过的报价单可撤回审核，当前状态: {quotation.status}")
        if not _is_approved(quotation.review_status):
            raise BusinessLogicError(
                f"仅已审核通过的报价单可撤回审核，当前审核状态: {quotation.review_status}"
            )
        from apps.common.base_service import AppBaseService

        op_name = await AppBaseService().get_user_name(operator_id)
        async with in_transaction():
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
                "撤回审核",
            )
        return await self.get_quotation_by_id(tenant_id, quotation_id, include_items=True)

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
        if quotation.status != "已发送":
            raise BusinessLogicError(f"仅已发送且已审核通过的报价单可标记客户确认，当前状态: {quotation.status}")
        if not _is_approved(quotation.review_status):
            raise BusinessLogicError(
                f"请先完成审核通过后再标记客户确认，当前审核状态: {quotation.review_status}"
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
        if quotation.status != "已拒绝":
            raise BusinessLogicError(f"仅已驳回的报价单可重新编辑，当前状态: {quotation.status}")
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
        if quotation.status != "已转订单":
            raise BusinessLogicError(f"仅已转订单状态的报价单可撤回下推，当前状态: {quotation.status}")
        so_id = quotation.sales_order_id
        if so_id is not None:
            so = await SalesOrder.get_or_none(
                tenant_id=tenant_id, id=so_id, deleted_at__isnull=True
            )
            if so is not None:
                raise BusinessLogicError(
                    "下游销售订单仍存在，无法撤回下推；请先作废或删除销售订单"
                )
        from apps.common.base_service import AppBaseService

        op_name = await AppBaseService().get_user_name(operator_id)
        async with in_transaction():
            await Quotation.filter(tenant_id=tenant_id, id=quotation_id).update(
                status="已接受",
                sales_order_id=None,
                sales_order_code=None,
                updated_by=operator_id,
            )
            await self._log_quotation_state_transition(
                tenant_id,
                quotation_id,
                "已转订单",
                "已接受",
                operator_id,
                op_name,
                "撤回下推",
            )
        return await self.get_quotation_by_id(tenant_id, quotation_id, include_items=True)

    async def get_quotation_by_id(
        self,
        tenant_id: int,
        quotation_id: int,
        include_items: bool = True,
    ) -> QuotationResponse:
        """获取报价单详情"""
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
        lifecycle = get_quotation_lifecycle(
            quotation,
            milestones=milestones,
            converted_sales_order_missing=conv_missing,
        )
        return resp.model_copy(
            update={
                "lifecycle": lifecycle,
                "conversion_downstream_missing": conv_missing,
            }
        )

    async def list_quotations(
        self,
        tenant_id: int,
        skip: int = 0,
        limit: int = 100,
        status: Optional[str] = None,
        start_date: Optional[date] = None,
        end_date: Optional[date] = None,
        keyword: Optional[str] = None,
        quotation_code: Optional[str] = None,
        customer_name: Optional[str] = None,
        quotation_series_code: Optional[str] = None,
        current_user: Optional[User] = None,
    ) -> QuotationListResponse:
        """获取报价单列表"""
        from tortoise.expressions import Q

        query = Quotation.filter(tenant_id=tenant_id, deleted_at__isnull=True)
        
        # 业务员数据隔离：普通用户只能看到自己负责的报价单
        if current_user and current_user.is_regular_user():
            query = query.filter(salesman_id=current_user.id)
        if quotation_series_code and str(quotation_series_code).strip():
            query = query.filter(
                quotation_series_code=str(quotation_series_code).strip()
            )
        if status:
            query = query.filter(status=status)
        if start_date:
            query = query.filter(quotation_date__gte=start_date)
        if end_date:
            query = query.filter(quotation_date__lte=end_date)
        if keyword:
            query = query.filter(
                Q(quotation_code__icontains=keyword) | Q(customer_name__icontains=keyword)
            )
        if quotation_code and quotation_code.strip():
            query = query.filter(quotation_code__icontains=quotation_code.strip())
        if customer_name and customer_name.strip():
            query = query.filter(customer_name__icontains=customer_name.strip())
        total = await query.count()
        quotations = await query.offset(skip).limit(limit).order_by("-updated_at")
        from apps.kuaizhizao.services.document_lifecycle_service import get_quotation_lifecycle

        so_ids = list({q.sales_order_id for q in quotations if q.sales_order_id})
        alive_so: Set[int] = set()
        if so_ids:
            alive_rows = await SalesOrder.filter(
                tenant_id=tenant_id, id__in=so_ids, deleted_at__isnull=True
            ).values_list("id", flat=True)
            alive_so = set(alive_rows)

        data = []
        for q in quotations:
            r = self._quotation_to_response(q)
            conv_missing = await self._quotation_conversion_downstream_missing(
                tenant_id, q, alive_sales_order_ids=alive_so
            )
            lifecycle = get_quotation_lifecycle(
                q, converted_sales_order_missing=conv_missing
            )
            data.append(
                r.model_copy(
                    update={
                        "lifecycle": lifecycle,
                        "conversion_downstream_missing": conv_missing,
                    }
                )
            )
        return QuotationListResponse(data=data, total=total, success=True)

    async def update_quotation(
        self,
        tenant_id: int,
        quotation_id: int,
        quotation_data: QuotationUpdate,
        updated_by: int,
    ) -> QuotationResponse:
        """更新报价单"""
        quotation = await Quotation.get_or_none(
            tenant_id=tenant_id, id=quotation_id, deleted_at__isnull=True
        )
        if not quotation:
            raise NotFoundError(f"报价单不存在: {quotation_id}")
        if quotation.status != "草稿":
            raise BusinessLogicError(
                f"只能更新草稿状态的报价单，当前状态: {quotation.status}"
            )

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
                pt = str(getattr(q_row, "price_type", None) or "tax_exclusive")
                for item_data in quotation_data.items:
                    qty = item_data.quote_quantity
                    unit_pr = item_data.unit_price or Decimal("0")
                    tax_r = (
                        item_data.tax_rate
                        if item_data.tax_rate is not None
                        else Decimal("0")
                    )
                    self._validate_quotation_item_non_negative(
                        quote_quantity=qty,
                        unit_price=unit_pr,
                        tax_rate=tax_r,
                        total_amount=item_data.total_amount,
                    )
                    amt = self._quotation_line_inclusive_amount(qty, unit_pr, tax_r, pt)
                    total_qty += qty
                    total_amt += amt
                    await QuotationItem.create(
                        tenant_id=tenant_id,
                        quotation_id=quotation_id,
                        material_id=item_data.material_id,
                        material_code=(item_data.material_code or "")[:50],
                        material_name=(item_data.material_name or "")[:200],
                        material_spec=(item_data.material_spec or "")[:200] or None,
                        material_unit=(item_data.material_unit or "")[:20],
                        quote_quantity=qty,
                        unit_price=unit_pr,
                        tax_rate=tax_r,
                        total_amount=amt,
                        delivery_date=item_data.delivery_date,
                        notes=item_data.notes,
                    )
                await Quotation.filter(id=quotation_id).update(
                    total_quantity=total_qty,
                    total_amount=total_amt,
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

        if (latest.status or "").strip() in ("草稿", "draft"):
            raise BusinessLogicError("当前系列最新单为草稿，请直接编辑该草稿，无需另存新版本")

        new_vn = int(latest.version_no or 1) + 1
        new_code = self._next_revision_quotation_code(series, new_vn)
        root_id = latest.root_quotation_id or latest.id

        overrides = (
            revision_data.model_dump(exclude_unset=True) if revision_data else {}
        )
        item_override = overrides.pop("items", None)

        row_price_type = str(
            overrides.get("price_type", getattr(latest, "price_type", None) or "tax_exclusive")
        )

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
                price_type=row_price_type,
                status="草稿",
                review_status="待审核",
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
                updated_by=created_by,
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
                    delivery_date=ddate,
                    notes=nit,
                )

            await Quotation.filter(id=new_row.id).update(
                total_quantity=total_qty,
                total_amount=total_amt,
            )

        return await self.get_quotation_by_id(tenant_id, new_row.id, include_items=True)

    async def delete_quotation(
        self,
        tenant_id: int,
        quotation_id: int,
    ) -> None:
        """删除报价单（软删除）。存在有效下游销售订单时禁止删除；下游已删则允许删除。"""
        quotation = await Quotation.get_or_none(
            tenant_id=tenant_id, id=quotation_id, deleted_at__isnull=True
        )
        if not quotation:
            raise NotFoundError(f"报价单不存在: {quotation_id}")
        if quotation.sales_order_id is not None:
            so = await SalesOrder.get_or_none(
                tenant_id=tenant_id,
                id=quotation.sales_order_id,
                deleted_at__isnull=True,
            )
            if so is not None:
                raise BusinessLogicError("已关联有效销售订单的报价单不能删除")
        now = datetime.now()
        await Quotation.filter(
            id=quotation_id, tenant_id=tenant_id
        ).update(deleted_at=now)

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
            tenant_id, quotation_id, created_by
        )
        quotation = await Quotation.get_or_none(
            tenant_id=tenant_id, id=quotation_id, deleted_at__isnull=True
        )
        if not quotation:
            raise NotFoundError(f"报价单不存在: {quotation_id}")
        if quotation.status == "已转订单":
            raise BusinessLogicError("该报价单已转为销售订单，无法重复转换")
        if quotation.sales_order_id:
            raise BusinessLogicError("该报价单已关联销售订单，无法重复转换")

        if not getattr(quotation, "is_latest_in_series", True):
            raise BusinessLogicError("仅能对当前系列的最新版本报价单转销售订单")

        st = (quotation.status or "").strip()
        if st == "已发送":
            if not _is_approved(quotation.review_status):
                raise BusinessLogicError("报价单需审核通过后方可转销售订单")
        elif st == "已接受":
            pass
        else:
            raise BusinessLogicError(f"当前状态「{st}」不可转销售订单，请先提交并完成审核或客户确认")

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

        # 构建 SalesOrderCreate
        order_date = quotation.quotation_date
        valid_dates = [it.delivery_date for it in items if it.delivery_date]
        delivery_date = quotation.delivery_date or (
            min(valid_dates) if valid_dates else order_date
        )

        q_price_type = getattr(quotation, "price_type", None) or "tax_exclusive"

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
                item_amount=it.total_amount,
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
            total_quantity=quotation.total_quantity,
            total_amount=quotation.total_amount,
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
