"""
订单评审服务：CRUD、下达/撤回、部门意见、驳回、下推销售订单。
"""

from __future__ import annotations

from datetime import date
from decimal import Decimal, ROUND_HALF_UP
from typing import Any, Dict, List, Optional

from loguru import logger
from tortoise.expressions import Q
from tortoise.transactions import in_transaction

from apps.common.audit_actor import (
    apply_create_audit,
    apply_update_audit,
    operator_name_from_user,
)
from apps.common.base_service import AppBaseService
from apps.kuaizhizao.models.sales_review import SalesReview
from apps.kuaizhizao.models.sales_review_dept_opinion import SalesReviewDeptOpinion
from apps.kuaizhizao.models.sales_review_item import SalesReviewItem
from apps.kuaizhizao.schemas.sales_review import (
    SALES_REVIEW_DEPT_CODES,
    SalesReviewCreate,
    SalesReviewDeptOpinionResponse,
    SalesReviewDeptOpinionSubmit,
    SalesReviewItemCreate,
    SalesReviewItemResponse,
    SalesReviewListEnvelope,
    SalesReviewListItem,
    SalesReviewPushPreview,
    SalesReviewPushResult,
    SalesReviewResponse,
    SalesReviewUpdate,
)
from core.utils.timezone_utils import resolve_business_datetime, to_site_date
from apps.kuaizhizao.services.kuaizhizao_data_scope import (
    SALES_REVIEW_SCOPE_RESOURCE,
    apply_kuaizhizao_list_scope,
    assert_kuaizhizao_row_visible,
)
from infra.exceptions.exceptions import BusinessLogicError, NotFoundError, ValidationError
from infra.models.user import User

EDITABLE_STATUSES = frozenset({"draft", "rejected"})
SALES_REVIEW_SORTABLE_FIELDS = frozenset(
    {
        "id",
        "review_code",
        "customer_name",
        "project_name",
        "status",
        "review_date",
        "delivery_date",
        "created_at",
        "updated_at",
        "total_amount",
    }
)

def _audit_update_kwargs(user: User) -> Dict[str, Any]:
    """filter().update 用：写入 updated_by + updated_by_name。"""
    return {
        "updated_by": int(user.id),
        "updated_by_name": operator_name_from_user(user),
    }



class SalesReviewService(AppBaseService):
    async def _generate_review_code(self, tenant_id: int, review_date: Optional[date]) -> str:
        from core.config.code_rule_pages import get_canonical_rule_code
        from core.services.business.code_generation_service import CodeGenerationService
        from core.utils.timezone_utils import to_api_isoformat

        rule_code = get_canonical_rule_code("kuaizhizao-sales-review")
        if not rule_code:
            raise ValidationError("订单评审页面未配置编码规则")
        context = {}
        if review_date:
            context["review_date"] = (
                to_api_isoformat(review_date)
                if hasattr(review_date, "isoformat")
                else str(review_date)
            )
        return await CodeGenerationService.generate_code(
            tenant_id=tenant_id,
            rule_code=rule_code,
            context=context or None,
        )

    @staticmethod
    def _line_amount(qty: Decimal, price: Decimal) -> Decimal:
        return (qty * price).quantize(Decimal("0.01"), rounding=ROUND_HALF_UP)

    async def _replace_items(
        self,
        tenant_id: int,
        review_id: int,
        items: List[SalesReviewItemCreate],
        *,
        created_by: Optional[int],
    ) -> tuple[Decimal, Decimal]:
        await SalesReviewItem.filter(tenant_id=tenant_id, sales_review_id=review_id).delete()
        total_qty = Decimal("0")
        total_amt = Decimal("0")
        for idx, it in enumerate(items, start=1):
            qty = Decimal(str(it.quantity or 0))
            price = Decimal(str(it.unit_price or 0))
            amt = self._line_amount(qty, price)
            total_qty += qty
            total_amt += amt
            await SalesReviewItem.create(
                tenant_id=tenant_id,
                sales_review_id=review_id,
                line_no=idx,
                material_id=it.material_id,
                material_code=it.material_code,
                material_name=it.material_name,
                material_spec=it.material_spec,
                material_unit=it.material_unit,
                quantity=qty,
                unit_price=price,
                amount=amt,
                tech_requirements=it.tech_requirements,
                notes=it.notes,
                created_by=created_by,
            )
        return total_qty, total_amt

    async def _load_items(self, tenant_id: int, review_id: int) -> List[SalesReviewItemResponse]:
        rows = await SalesReviewItem.filter(
            tenant_id=tenant_id, sales_review_id=review_id
        ).order_by("line_no", "id")
        return [
            SalesReviewItemResponse(
                id=r.id,
                sales_review_id=r.sales_review_id,
                line_no=r.line_no,
                material_id=r.material_id,
                material_code=r.material_code,
                material_name=r.material_name,
                material_spec=r.material_spec,
                material_unit=r.material_unit,
                quantity=r.quantity,
                unit_price=r.unit_price,
                amount=r.amount,
                tech_requirements=r.tech_requirements,
                notes=r.notes,
            )
            for r in rows
        ]

    async def _load_dept_opinions(
        self, tenant_id: int, review_id: int, review_round: int
    ) -> List[SalesReviewDeptOpinionResponse]:
        if review_round <= 0:
            return []
        rows = await SalesReviewDeptOpinion.filter(
            tenant_id=tenant_id,
            sales_review_id=review_id,
            review_round=review_round,
        ).order_by("id")
        return [
            SalesReviewDeptOpinionResponse(
                id=r.id,
                sales_review_id=r.sales_review_id,
                review_round=r.review_round,
                dept_code=r.dept_code,
                result=r.result,
                opinion=r.opinion,
                reviewed_by=r.reviewed_by,
                reviewed_by_name=r.reviewed_by_name,
                reviewed_at=r.reviewed_at,
            )
            for r in rows
        ]

    def _to_response(
        self,
        row: SalesReview,
        items: List[SalesReviewItemResponse],
        opinions: List[SalesReviewDeptOpinionResponse],
    ) -> SalesReviewResponse:
        return SalesReviewResponse(
            id=row.id,
            uuid=row.uuid or "",
            tenant_id=row.tenant_id,
            review_code=row.review_code,
            customer_id=row.customer_id,
            customer_code=row.customer_code,
            customer_name=row.customer_name,
            customer_contact=row.customer_contact,
            customer_phone=row.customer_phone,
            project_name=row.project_name,
            review_date=row.review_date,
            delivery_date=row.delivery_date,
            urgency=row.urgency or "normal",
            risk_level=row.risk_level or "medium",
            settlement_method=row.settlement_method,
            payment_cycle=row.payment_cycle,
            delivery_location=row.delivery_location,
            transport_method=row.transport_method,
            material_desc=row.material_desc,
            spec_desc=row.spec_desc,
            process_desc=row.process_desc,
            packaging_req=row.packaging_req,
            production_notes=row.production_notes,
            sales_opinion=row.sales_opinion,
            final_conclusion=row.final_conclusion,
            remarks=row.remarks,
            attachments=row.attachments,
            quotation_id=row.quotation_id,
            quotation_code=row.quotation_code,
            customer_follow_up_id=row.customer_follow_up_id,
            salesman_id=row.salesman_id,
            salesman_name=row.salesman_name,
            status=row.status,
            review_round=row.review_round or 0,
            sales_order_id=row.sales_order_id,
            sales_order_code=row.sales_order_code,
            total_quantity=row.total_quantity or Decimal("0"),
            total_amount=row.total_amount or Decimal("0"),
            items=items,
            dept_opinions=opinions,
            created_at=row.created_at,
            updated_at=row.updated_at,
            created_by=row.created_by,
            updated_by=row.updated_by,
            created_by_name=row.created_by_name,
            updated_by_name=row.updated_by_name,
        )

    async def get(
        self,
        tenant_id: int,
        review_id: int,
        current_user: Optional[User] = None,
    ) -> SalesReviewResponse:
        row = await SalesReview.get_or_none(
            tenant_id=tenant_id, id=review_id, deleted_at__isnull=True
        )
        if not row:
            raise NotFoundError(f"订单评审单不存在: {review_id}")
        if current_user:
            await assert_kuaizhizao_row_visible(
                row,
                tenant_id=tenant_id,
                user=current_user,
                resource=SALES_REVIEW_SCOPE_RESOURCE,
            )
        items = await self._load_items(tenant_id, review_id)
        opinions = await self._load_dept_opinions(tenant_id, review_id, int(row.review_round or 0))
        return self._to_response(row, items, opinions)

    async def list_reviews(
        self,
        tenant_id: int,
        *,
        skip: int = 0,
        limit: int = 50,
        status: Optional[str] = None,
        customer_id: Optional[int] = None,
        keyword: Optional[str] = None,
        order_by: Optional[str] = None,
        pullable_only: Optional[bool] = None,
        current_user: Optional[User] = None,
    ) -> SalesReviewListEnvelope:
        qs = SalesReview.filter(tenant_id=tenant_id, deleted_at__isnull=True)
        qs = await apply_kuaizhizao_list_scope(
            qs,
            tenant_id=tenant_id,
            current_user=current_user,
            resource=SALES_REVIEW_SCOPE_RESOURCE,
        )
        if status:
            qs = qs.filter(status=status)
        if customer_id:
            qs = qs.filter(customer_id=customer_id)
        if pullable_only:
            qs = qs.filter(status="passed", sales_order_id__isnull=True)
        if keyword:
            kw = keyword.strip()
            if kw:
                qs = qs.filter(
                    Q(review_code__icontains=kw)
                    | Q(customer_name__icontains=kw)
                    | Q(project_name__icontains=kw)
                )
        total = await qs.count()
        sort = "-id"
        if order_by:
            field = order_by.lstrip("-")
            if field in SALES_REVIEW_SORTABLE_FIELDS:
                sort = order_by
        rows = await qs.order_by(sort).offset(skip).limit(limit)
        items = [
            SalesReviewListItem(
                id=r.id,
                review_code=r.review_code,
                customer_id=r.customer_id,
                customer_name=r.customer_name,
                project_name=r.project_name,
                status=r.status,
                review_round=r.review_round or 0,
                urgency=r.urgency or "normal",
                risk_level=r.risk_level or "medium",
                delivery_date=r.delivery_date,
                review_date=r.review_date,
                total_quantity=r.total_quantity or Decimal("0"),
                total_amount=r.total_amount or Decimal("0"),
                salesman_name=r.salesman_name,
                sales_order_code=r.sales_order_code,
                created_at=r.created_at,
                updated_at=r.updated_at,
                created_by=r.created_by,
                created_by_name=r.created_by_name,
                updated_by=r.updated_by,
                updated_by_name=r.updated_by_name,
            )
            for r in rows
        ]
        return SalesReviewListEnvelope(items=items, total=total, skip=skip, limit=limit)

    async def create(
        self, tenant_id: int, data: SalesReviewCreate, current_user: User
    ) -> SalesReviewResponse:
        code = (data.review_code or "").strip()
        if not code:
            code = await self._generate_review_code(tenant_id, data.review_date)
        exists = await SalesReview.filter(
            tenant_id=tenant_id, review_code=code, deleted_at__isnull=True
        ).exists()
        if exists:
            raise BusinessLogicError(f"评审单号已存在: {code}")

        salesman_id = data.salesman_id or current_user.id
        salesman_name = data.salesman_name or await self.get_user_name(salesman_id)

        async with in_transaction():
            create_payload: Dict[str, Any] = dict(
                tenant_id=tenant_id,
                review_code=code,
                customer_id=data.customer_id,
                customer_code=data.customer_code,
                customer_name=data.customer_name,
                customer_contact=data.customer_contact,
                customer_phone=data.customer_phone,
                project_name=data.project_name,
                review_date=data.review_date,
                delivery_date=data.delivery_date,
                urgency=data.urgency or "normal",
                risk_level=data.risk_level or "medium",
                settlement_method=data.settlement_method,
                payment_cycle=data.payment_cycle,
                delivery_location=data.delivery_location,
                transport_method=data.transport_method,
                material_desc=data.material_desc,
                spec_desc=data.spec_desc,
                process_desc=data.process_desc,
                packaging_req=data.packaging_req,
                production_notes=data.production_notes,
                sales_opinion=data.sales_opinion,
                final_conclusion=data.final_conclusion,
                remarks=data.remarks,
                attachments=data.attachments,
                quotation_id=data.quotation_id,
                quotation_code=data.quotation_code,
                customer_follow_up_id=data.customer_follow_up_id,
                salesman_id=salesman_id,
                salesman_name=salesman_name,
                status="draft",
                review_round=0,
            )
            apply_create_audit(create_payload, current_user)
            row = await SalesReview.create(**create_payload)
            total_qty, total_amt = await self._replace_items(
                tenant_id, row.id, data.items, created_by=current_user.id
            )
            await SalesReview.filter(id=row.id).update(
                total_quantity=total_qty, total_amount=total_amt
            )
            row.total_quantity = total_qty
            row.total_amount = total_amt

        return await self.get(tenant_id, row.id)

    async def update(
        self, tenant_id: int, review_id: int, data: SalesReviewUpdate, current_user: User
    ) -> SalesReviewResponse:
        row = await SalesReview.get_or_none(
            tenant_id=tenant_id, id=review_id, deleted_at__isnull=True
        )
        if not row:
            raise NotFoundError(f"订单评审单不存在: {review_id}")
        await assert_kuaizhizao_row_visible(
            row,
            tenant_id=tenant_id,
            user=current_user,
            resource=SALES_REVIEW_SCOPE_RESOURCE,
        )
        if (row.status or "") not in EDITABLE_STATUSES:
            raise BusinessLogicError("仅草稿或已驳回状态可编辑业务资料与明细")

        payload = data.model_dump(exclude_unset=True)
        items = payload.pop("items", None)
        for k, v in payload.items():
            setattr(row, k, v)
        apply_update_audit(row, current_user)
        async with in_transaction():
            if items is not None:
                item_models = [SalesReviewItemCreate(**it) for it in items]
                if not item_models:
                    raise BusinessLogicError("评审单必须至少包含一条明细")
                total_qty, total_amt = await self._replace_items(
                    tenant_id, review_id, item_models, created_by=current_user.id
                )
                row.total_quantity = total_qty
                row.total_amount = total_amt
            await row.save()
        return await self.get(tenant_id, review_id, current_user=current_user)

    async def delete(self, tenant_id: int, review_id: int, current_user: User) -> None:
        row = await SalesReview.get_or_none(
            tenant_id=tenant_id, id=review_id, deleted_at__isnull=True
        )
        if not row:
            raise NotFoundError(f"订单评审单不存在: {review_id}")
        await assert_kuaizhizao_row_visible(
            row,
            tenant_id=tenant_id,
            user=current_user,
            resource=SALES_REVIEW_SCOPE_RESOURCE,
        )
        if (row.status or "") not in {"draft", "cancelled", "rejected"}:
            raise BusinessLogicError("仅草稿、已驳回或已作废状态可删除")
        now = resolve_business_datetime()
        await SalesReview.filter(id=review_id).update(
            deleted_at=now,
            status="cancelled",
            **_audit_update_kwargs(current_user),
        )
        if row.quotation_id:
            from apps.kuaizhizao.models.quotation import Quotation

            await Quotation.filter(
                tenant_id=tenant_id,
                id=row.quotation_id,
                sales_review_id=review_id,
                deleted_at__isnull=True,
            ).update(
                sales_review_id=None,
                sales_review_code=None,
                updated_by=current_user.id,
            )

    async def pull_from_quotation(
        self, tenant_id: int, quotation_id: int, current_user: User
    ) -> Dict[str, Any]:
        """订单评审域加载建单：从报价单创建订单评审。"""
        if quotation_id <= 0:
            raise ValidationError("报价单ID无效")
        from apps.kuaizhizao.services.quotation_service import QuotationService

        review, quotation = await QuotationService().convert_to_sales_review(
            tenant_id=tenant_id,
            quotation_id=quotation_id,
            created_by=current_user.id,
            selected_item_ids=None,
        )
        return {
            "success": True,
            "message": f"已从报价单创建订单评审 {review.review_code}",
            "source_type": "quotation",
            "source_id": quotation_id,
            "sales_review": review.model_dump() if hasattr(review, "model_dump") else review,
            "quotation": quotation.model_dump() if hasattr(quotation, "model_dump") else quotation,
        }

    async def _seed_dept_opinions(
        self, tenant_id: int, review_id: int, review_round: int, created_by: int
    ) -> None:
        for code in SALES_REVIEW_DEPT_CODES:
            await SalesReviewDeptOpinion.create(
                tenant_id=tenant_id,
                sales_review_id=review_id,
                review_round=review_round,
                dept_code=code,
                result="pending",
                created_by=created_by,
            )

    async def _dispatch_notify(
        self,
        tenant_id: int,
        *,
        action: str,
        row: SalesReview,
        extra: Optional[Dict[str, Any]] = None,
    ) -> None:
        from apps.kuaizhizao.services.kuaizhizao_business_notification import (
            DOC_SALES_REVIEW,
            dispatch_kuaizhizao_notification,
        )

        variables = {
            "review_code": row.review_code,
            "customer_name": row.customer_name,
            "project_name": row.project_name,
            "status": row.status,
            "review_round": row.review_round,
            **(extra or {}),
        }
        context = {
            "creator_id": row.created_by,
            "salesman_id": row.salesman_id,
            "document_id": row.id,
            "document_code": row.review_code,
        }
        await dispatch_kuaizhizao_notification(
            tenant_id,
            trigger_document=DOC_SALES_REVIEW,
            trigger_action=action,
            variables=variables,
            context=context,
        )

    async def issue(self, tenant_id: int, review_id: int, current_user: User) -> SalesReviewResponse:
        row = await SalesReview.get_or_none(
            tenant_id=tenant_id, id=review_id, deleted_at__isnull=True
        )
        if not row:
            raise NotFoundError(f"订单评审单不存在: {review_id}")
        if (row.status or "") not in EDITABLE_STATUSES:
            raise BusinessLogicError("仅草稿或已驳回状态可下达评审")
        items = await SalesReviewItem.filter(tenant_id=tenant_id, sales_review_id=review_id).count()
        if items <= 0:
            raise BusinessLogicError("无明细，无法下达评审")

        new_round = int(row.review_round or 0) + 1
        async with in_transaction():
            await self._seed_dept_opinions(tenant_id, review_id, new_round, current_user.id)
            await SalesReview.filter(id=review_id).update(
                status="reviewing",
                review_round=new_round,
                **_audit_update_kwargs(current_user),
            )
        row = await SalesReview.get(id=review_id)
        await self._dispatch_notify(tenant_id, action="issued", row=row)
        return await self.get(tenant_id, review_id)

    async def withdraw(
        self, tenant_id: int, review_id: int, current_user: User
    ) -> SalesReviewResponse:
        row = await SalesReview.get_or_none(
            tenant_id=tenant_id, id=review_id, deleted_at__isnull=True
        )
        if not row:
            raise NotFoundError(f"订单评审单不存在: {review_id}")
        if (row.status or "") != "reviewing":
            raise BusinessLogicError("仅评审中状态可撤回下达")
        round_no = int(row.review_round or 0)
        answered = await SalesReviewDeptOpinion.filter(
            tenant_id=tenant_id,
            sales_review_id=review_id,
            review_round=round_no,
            result__not="pending",
        ).count()
        if answered > 0:
            raise BusinessLogicError("本轮已有部门提交意见，无法撤回；请使用驳回或等待评审完成")
        async with in_transaction():
            await SalesReviewDeptOpinion.filter(
                tenant_id=tenant_id, sales_review_id=review_id, review_round=round_no
            ).delete()
            await SalesReview.filter(id=review_id).update(
                status="draft",
                review_round=max(0, round_no - 1),
                **_audit_update_kwargs(current_user),
            )
        return await self.get(tenant_id, review_id)

    async def _assert_dept_binding(
        self, tenant_id: int, dept_code: str, current_user: User
    ) -> None:
        from infra.services.business_config_service import BusinessConfigService

        cfg = await BusinessConfigService().get_business_config(tenant_id)
        sales = ((cfg.get("parameters") or {}).get("sales") or {})
        review_cfg = sales.get("sales_review") or {}
        bindings = review_cfg.get("dept_bindings") or {}
        if not isinstance(bindings, dict) or not bindings:
            return
        slot = bindings.get(dept_code) or {}
        role_codes = slot.get("role_codes") or []
        department_ids = slot.get("department_ids") or []
        if not role_codes and not department_ids:
            return

        matched = False
        if role_codes:
            from core.models.role import Role
            from core.models.user_role import UserRole

            role_ids = await Role.filter(
                tenant_id=tenant_id, code__in=list(role_codes), is_active=True
            ).values_list("id", flat=True)
            if role_ids:
                matched = await UserRole.filter(
                    user_id=current_user.id, role_id__in=list(role_ids)
                ).exists()
        if not matched and department_ids:
            user_dept = getattr(current_user, "department_id", None)
            if user_dept is not None and int(user_dept) in {int(x) for x in department_ids}:
                matched = True
        if not matched:
            raise BusinessLogicError(f"当前用户无权提交「{dept_code}」部门评审意见")

    async def submit_dept_opinion(
        self,
        tenant_id: int,
        review_id: int,
        dept_code: str,
        body: SalesReviewDeptOpinionSubmit,
        current_user: User,
    ) -> SalesReviewResponse:
        code = (dept_code or "").strip().lower()
        if code not in SALES_REVIEW_DEPT_CODES:
            raise ValidationError(f"未知部门槽位: {dept_code}")
        row = await SalesReview.get_or_none(
            tenant_id=tenant_id, id=review_id, deleted_at__isnull=True
        )
        if not row:
            raise NotFoundError(f"订单评审单不存在: {review_id}")
        if (row.status or "") != "reviewing":
            raise BusinessLogicError("仅评审中状态可提交部门意见")
        await self._assert_dept_binding(tenant_id, code, current_user)

        round_no = int(row.review_round or 0)
        opinion = await SalesReviewDeptOpinion.get_or_none(
            tenant_id=tenant_id,
            sales_review_id=review_id,
            review_round=round_no,
            dept_code=code,
        )
        if not opinion:
            raise BusinessLogicError("本轮部门意见槽位不存在，请重新下达")

        now = resolve_business_datetime()
        reviewer_id = int(body.reviewed_by) if body.reviewed_by else int(current_user.id)
        reviewer = await User.get_or_none(
            id=reviewer_id, tenant_id=tenant_id, deleted_at__isnull=True
        )
        if not reviewer:
            raise ValidationError("所选评审人不存在或不属于当前租户")
        name = await self.get_user_name(reviewer_id)
        opinion.result = body.result
        opinion.opinion = body.opinion
        opinion.reviewed_by = reviewer_id
        opinion.reviewed_by_name = name
        opinion.reviewed_at = now
        apply_update_audit(opinion, current_user)
        await opinion.save()

        pending = await SalesReviewDeptOpinion.filter(
            tenant_id=tenant_id,
            sales_review_id=review_id,
            review_round=round_no,
            result="pending",
        ).count()
        fails = await SalesReviewDeptOpinion.filter(
            tenant_id=tenant_id,
            sales_review_id=review_id,
            review_round=round_no,
            result="fail",
        ).count()
        if pending == 0 and fails == 0:
            await SalesReview.filter(id=review_id).update(
                status="passed", **_audit_update_kwargs(current_user)
            )
            row = await SalesReview.get(id=review_id)
            await self._dispatch_notify(tenant_id, action="passed", row=row)

        return await self.get(tenant_id, review_id)

    async def reject(
        self,
        tenant_id: int,
        review_id: int,
        current_user: User,
        *,
        reason: Optional[str] = None,
    ) -> SalesReviewResponse:
        row = await SalesReview.get_or_none(
            tenant_id=tenant_id, id=review_id, deleted_at__isnull=True
        )
        if not row:
            raise NotFoundError(f"订单评审单不存在: {review_id}")
        if (row.status or "") != "reviewing":
            raise BusinessLogicError("仅评审中状态可驳回")
        note = (reason or "").strip()
        remarks = row.remarks or ""
        if note:
            remarks = (remarks + "\n" if remarks else "") + f"[驳回] {note}"
        await SalesReview.filter(id=review_id).update(
            status="rejected",
            remarks=remarks or None,
            **_audit_update_kwargs(current_user),
        )
        row = await SalesReview.get(id=review_id)
        await self._dispatch_notify(
            tenant_id, action="rejected", row=row, extra={"reject_reason": note}
        )
        return await self.get(tenant_id, review_id)

    async def preview_push_to_sales_order(
        self, tenant_id: int, review_id: int
    ) -> SalesReviewPushPreview:
        row = await SalesReview.get_or_none(
            tenant_id=tenant_id, id=review_id, deleted_at__isnull=True
        )
        if not row:
            raise NotFoundError(f"订单评审单不存在: {review_id}")
        items = await self._load_items(tenant_id, review_id)
        can_push = (row.status or "") == "passed" and not row.sales_order_id and bool(items)
        reason = None
        if row.sales_order_id:
            reason = f"已下推销售订单 {row.sales_order_code or row.sales_order_id}"
        elif (row.status or "") != "passed":
            reason = "仅评审已通过状态可下推销售订单"
        elif not items:
            reason = "无明细，无法下推"
        return SalesReviewPushPreview(
            can_push=can_push,
            blocking_reason=reason,
            review_code=row.review_code,
            customer_name=row.customer_name,
            item_count=len(items),
            total_quantity=row.total_quantity or Decimal("0"),
            total_amount=row.total_amount or Decimal("0"),
            items=[it.model_dump() for it in items],
        )

    async def push_to_sales_order(
        self, tenant_id: int, review_id: int, current_user: User
    ) -> SalesReviewPushResult:
        from apps.kuaizhizao.constants import DemandStatus, ReviewStatus
        from apps.kuaizhizao.constants.price_type import DEFAULT_SALES_PRICE_TYPE
        from apps.kuaizhizao.schemas.document_relation import DocumentRelationCreate
        from apps.kuaizhizao.schemas.sales_order import SalesOrderCreate, SalesOrderItemCreate
        from apps.kuaizhizao.services.document_relation_new_service import DocumentRelationNewService
        from apps.kuaizhizao.services.sales_order_service import SalesOrderService

        preview = await self.preview_push_to_sales_order(tenant_id, review_id)
        if not preview.can_push:
            raise BusinessLogicError(preview.blocking_reason or "不可下推销售订单")

        row = await SalesReview.get(id=review_id)
        items = await SalesReviewItem.filter(
            tenant_id=tenant_id, sales_review_id=review_id
        ).order_by("line_no", "id")
        order_date = to_site_date(resolve_business_datetime())
        delivery_date = row.delivery_date or order_date

        so_items = [
            SalesOrderItemCreate(
                material_id=it.material_id,
                material_code=it.material_code,
                material_name=it.material_name,
                material_spec=it.material_spec,
                material_unit=it.material_unit or "",
                required_quantity=it.quantity,
                delivery_date=delivery_date,
                unit_price=it.unit_price,
                tax_rate=Decimal("0"),
                item_amount=it.amount,
                notes=it.tech_requirements or it.notes,
            )
            for it in items
        ]
        so_create = SalesOrderCreate(
            order_date=order_date,
            delivery_date=delivery_date,
            customer_id=row.customer_id,
            customer_name=row.customer_name,
            customer_contact=row.customer_contact,
            customer_phone=(row.customer_phone or "")[:20] or None,
            total_quantity=row.total_quantity or Decimal("0"),
            discount_amount=Decimal("0"),
            price_type=DEFAULT_SALES_PRICE_TYPE,
            status=DemandStatus.DRAFT,
            review_status=ReviewStatus.PENDING,
            salesman_id=row.salesman_id,
            salesman_name=row.salesman_name,
            shipping_address=row.delivery_location,
            shipping_method=row.transport_method,
            payment_terms=row.payment_cycle or row.settlement_method,
            currency_code="CNY",
            notes=row.remarks or f"由订单评审 {row.review_code} 下推",
            items=so_items,
        )
        so_svc = SalesOrderService()
        sales_order = await so_svc.create_sales_order(
            tenant_id=tenant_id,
            sales_order_data=so_create,
            created_by=current_user.id,
        )
        sales_order = await so_svc.apply_push_default_mode_after_create(
            tenant_id=tenant_id,
            sales_order_id=int(sales_order.id),
            created_by=current_user.id,
        )
        await SalesReview.filter(id=review_id).update(
            status="closed",
            sales_order_id=sales_order.id,
            sales_order_code=sales_order.order_code,
            **_audit_update_kwargs(current_user),
        )
        if row.quotation_id:
            from apps.kuaizhizao.models.quotation import Quotation
            from apps.common.base_service import AppBaseService

            quotation = await Quotation.get_or_none(
                tenant_id=tenant_id, id=row.quotation_id, deleted_at__isnull=True
            )
            if quotation and not quotation.sales_order_id:
                prev_status = (quotation.status or "").strip() or "已发送"
                op_name = await AppBaseService().get_user_name(current_user.id)
                await Quotation.filter(id=row.quotation_id).update(
                    status="已转订单",
                    sales_order_id=sales_order.id,
                    sales_order_code=sales_order.order_code,
                    updated_by=current_user.id,
                )
                try:
                    from apps.kuaizhizao.services.quotation_service import QuotationService

                    await QuotationService()._log_quotation_state_transition(
                        tenant_id,
                        row.quotation_id,
                        prev_status,
                        "已转订单",
                        current_user.id,
                        op_name,
                        "订单评审下推销售订单",
                    )
                except Exception as exc:
                    logger.warning(
                        "报价单状态流转日志写入失败 quotation_id={}: {}",
                        row.quotation_id,
                        exc,
                    )
        try:
            await DocumentRelationNewService().create_relation(
                tenant_id=tenant_id,
                relation_data=DocumentRelationCreate(
                    source_type="sales_review",
                    source_id=review_id,
                    source_code=row.review_code,
                    source_name=row.project_name or row.review_code,
                    target_type="sales_order",
                    target_id=sales_order.id,
                    target_code=sales_order.order_code,
                    target_name=sales_order.order_code,
                    relation_type="source",
                    relation_mode="push",
                    relation_desc="订单评审下推销售订单",
                ),
                created_by=current_user.id,
            )
        except Exception as exc:
            logger.warning("订单评审下推关联写入失败 review_id={}: {}", review_id, exc)

        return SalesReviewPushResult(
            success=True,
            message=f"已下推销售订单 {sales_order.order_code}",
            sales_order_id=sales_order.id,
            sales_order_code=sales_order.order_code,
        )
