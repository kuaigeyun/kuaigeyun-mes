"""
报价单管理服务模块

提供报价单相关的业务逻辑处理。
报价单可转销售订单，建立 quotation -> sales_order 关联。

Author: RiverEdge Team
Date: 2026-02-19
"""

from typing import List, Optional
from datetime import datetime, date
from decimal import Decimal
from tortoise.transactions import in_transaction
from loguru import logger

from apps.kuaizhizao.models.quotation import Quotation
from apps.kuaizhizao.models.quotation_item import QuotationItem
from apps.kuaizhizao.models.sales_order import SalesOrder
from apps.kuaizhizao.models.sales_order_item import SalesOrderItem
from apps.kuaizhizao.schemas.quotation import (
    QuotationCreate,
    QuotationUpdate,
    QuotationResponse,
    QuotationListResponse,
    QuotationItemCreate,
    QuotationItemResponse,
)
from apps.kuaizhizao.schemas.sales_order import SalesOrderCreate, SalesOrderItemCreate
from apps.kuaizhizao.constants import DemandStatus, ReviewStatus
from infra.exceptions.exceptions import NotFoundError, BusinessLogicError


class QuotationService:
    """报价单管理服务"""

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
            "quotation_date": quotation.quotation_date,
            "valid_until": quotation.valid_until,
            "delivery_date": quotation.delivery_date,
            "customer_id": quotation.customer_id,
            "customer_name": quotation.customer_name,
            "customer_contact": quotation.customer_contact,
            "customer_phone": quotation.customer_phone,
            "total_quantity": quotation.total_quantity,
            "total_amount": quotation.total_amount,
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
        from pathlib import Path
        import json

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
        # #region agent log
        try:
            log_path = Path(__file__).resolve().parents[5] / "debug-f6a036.log"
            with open(log_path, "a", encoding="utf-8") as f:
                f.write(json.dumps({"sessionId": "f6a036", "hypothesisId": "H4", "location": "quotation_service:_generate_quotation_code", "message": "backend generate code", "data": {"rule_code": rule_code, "generated": generated}, "timestamp": __import__("time").time() * 1000}, ensure_ascii=False) + "\n")
        except Exception:
            pass
        # #endregion
        return generated

    async def create_quotation(
        self,
        tenant_id: int,
        quotation_data: QuotationCreate,
        created_by: int,
    ) -> QuotationResponse:
        """创建报价单"""
        from pathlib import Path
        import json
        received_code = getattr(quotation_data, "quotation_code", None) or (quotation_data.quotation_code if hasattr(quotation_data, "quotation_code") else None)
        will_generate = not received_code
        if not quotation_data.quotation_code:
            quotation_data.quotation_code = await self._generate_quotation_code(
                tenant_id, quotation_data.quotation_date
            )
        # #region agent log
        try:
            log_path = Path(__file__).resolve().parents[5] / "debug-f6a036.log"
            with open(log_path, "a", encoding="utf-8") as f:
                f.write(json.dumps({"sessionId": "f6a036", "hypothesisId": "H3_H4", "location": "quotation_service:create_quotation", "message": "create_quotation code", "data": {"received_code": received_code, "will_generate": will_generate, "final_code": quotation_data.quotation_code}, "timestamp": __import__("time").time() * 1000}, ensure_ascii=False) + "\n")
        except Exception:
            pass
        # #endregion

        async with in_transaction():
            q_dict = quotation_data.model_dump(exclude={"items"})
            q_dict["created_by"] = created_by
            q_dict["updated_by"] = created_by

            quotation = await Quotation.create(tenant_id=tenant_id, **q_dict)

            total_qty = Decimal("0")
            total_amt = Decimal("0")
            for item_data in quotation_data.items:
                qty = item_data.quote_quantity
                unit_pr = item_data.unit_price or Decimal("0")
                amt = item_data.total_amount or (qty * unit_pr)
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
                    total_amount=amt,
                    delivery_date=item_data.delivery_date,
                    notes=item_data.notes,
                )

            await Quotation.filter(id=quotation.id).update(
                total_quantity=total_qty,
                total_amount=total_amt,
            )
            quotation = await Quotation.get(id=quotation.id)
            items = await QuotationItem.filter(
                tenant_id=tenant_id, quotation_id=quotation.id
            ).order_by("id")
            return self._quotation_to_response(quotation, items=items)

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
        return self._quotation_to_response(quotation, items=items)

    async def list_quotations(
        self,
        tenant_id: int,
        skip: int = 0,
        limit: int = 100,
        status: Optional[str] = None,
        start_date: Optional[date] = None,
        end_date: Optional[date] = None,
    ) -> QuotationListResponse:
        """获取报价单列表"""
        query = Quotation.filter(tenant_id=tenant_id, deleted_at__isnull=True)
        if status:
            query = query.filter(status=status)
        if start_date:
            query = query.filter(quotation_date__gte=start_date)
        if end_date:
            query = query.filter(quotation_date__lte=end_date)
        total = await query.count()
        quotations = await query.offset(skip).limit(limit).order_by("-created_at")

        data = [
            self._quotation_to_response(q)
            for q in quotations
        ]
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
                for item_data in quotation_data.items:
                    qty = item_data.quote_quantity
                    unit_pr = item_data.unit_price or Decimal("0")
                    amt = item_data.total_amount or (qty * unit_pr)
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
                        total_amount=amt,
                        delivery_date=item_data.delivery_date,
                        notes=item_data.notes,
                    )
                await Quotation.filter(id=quotation_id).update(
                    total_quantity=total_qty,
                    total_amount=total_amt,
                )

        return await self.get_quotation_by_id(tenant_id, quotation_id, include_items=True)

    async def delete_quotation(
        self,
        tenant_id: int,
        quotation_id: int,
    ) -> None:
        """删除报价单（软删除）"""
        quotation = await Quotation.get_or_none(
            tenant_id=tenant_id, id=quotation_id, deleted_at__isnull=True
        )
        if not quotation:
            raise NotFoundError(f"报价单不存在: {quotation_id}")
        if quotation.status != "草稿":
            raise BusinessLogicError(
                f"只能删除草稿状态的报价单，当前状态: {quotation.status}"
            )
        await Quotation.filter(id=quotation_id).update(deleted_at=datetime.now())

    async def convert_to_sales_order(
        self,
        tenant_id: int,
        quotation_id: int,
        created_by: int,
    ):
        """
        将报价单转为销售订单

        创建销售订单及明细，更新报价单状态为「已转订单」，建立关联。
        返回 (sales_order_response, quotation_response)
        """
        quotation = await Quotation.get_or_none(
            tenant_id=tenant_id, id=quotation_id, deleted_at__isnull=True
        )
        if not quotation:
            raise NotFoundError(f"报价单不存在: {quotation_id}")
        if quotation.status == "已转订单":
            raise BusinessLogicError("该报价单已转为销售订单，无法重复转换")
        if quotation.sales_order_id:
            raise BusinessLogicError("该报价单已关联销售订单，无法重复转换")

        items = await QuotationItem.filter(
            tenant_id=tenant_id, quotation_id=quotation_id
        ).order_by("id")
        if not items:
            raise BusinessLogicError("报价单无明细，无法转为销售订单")

        # 构建 SalesOrderCreate
        order_date = quotation.quotation_date
        valid_dates = [it.delivery_date for it in items if it.delivery_date]
        delivery_date = quotation.delivery_date or (
            min(valid_dates) if valid_dates else order_date
        )

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
            status=DemandStatus.DRAFT,
            review_status=ReviewStatus.PENDING,
            salesman_id=quotation.salesman_id,
            salesman_name=quotation.salesman_name,
            shipping_address=quotation.shipping_address,
            shipping_method=quotation.shipping_method,
            payment_terms=quotation.payment_terms,
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

        async with in_transaction():
            await Quotation.filter(id=quotation_id).update(
                status="已转订单",
                sales_order_id=sales_order.id,
                sales_order_code=sales_order.order_code,
                updated_by=created_by,
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
