"""
样品试用单服务模块

客户申请样品试用，可转正式销售订单，样品出库可通过其他出库（原因：样品）。

Author: RiverEdge Team
Date: 2026-02-19
"""

from typing import List, Optional
from datetime import datetime, date
from decimal import Decimal
from tortoise.transactions import in_transaction
from loguru import logger

from apps.base_service import AppBaseService
from apps.kuaizhizao.models.sample_trial import SampleTrial
from apps.kuaizhizao.models.sample_trial_item import SampleTrialItem
from apps.kuaizhizao.models.sales_order import SalesOrder
from apps.kuaizhizao.models.other_outbound import OtherOutbound
from apps.kuaizhizao.models.other_outbound_item import OtherOutboundItem
from apps.kuaizhizao.schemas.sample_trial import (
    SampleTrialCreate,
    SampleTrialUpdate,
    SampleTrialResponse,
    SampleTrialListResponse,
    SampleTrialWithItemsResponse,
    SampleTrialItemCreate,
    SampleTrialItemResponse,
)
from apps.kuaizhizao.schemas.sales_order import SalesOrderCreate, SalesOrderItemCreate
from apps.kuaizhizao.schemas.warehouse import (
    OtherOutboundCreate,
    OtherOutboundItemCreate,
    OtherOutboundResponse,
)
from apps.kuaizhizao.constants import DemandStatus, ReviewStatus
from infra.exceptions.exceptions import NotFoundError, BusinessLogicError
from infra.services.business_config_service import BusinessConfigService


class SampleTrialService(AppBaseService[SampleTrial]):
    """样品试用单服务"""

    def __init__(self):
        super().__init__(SampleTrial)
        self.business_config_service = BusinessConfigService()

    async def _log_sample_trial_state_transition(
        self,
        tenant_id: int,
        trial_id: int,
        from_state: str,
        to_state: str,
        operator_id: int,
        operator_name: str,
        reason: Optional[str] = None,
        comment: Optional[str] = None,
    ) -> None:
        """写入样品试用单状态流转日志，供单据跟踪操作记录展示。"""
        try:
            from apps.kuaizhizao.models.state_transition import StateTransitionLog

            await StateTransitionLog.create(
                tenant_id=tenant_id,
                entity_type="sample_trial",
                entity_id=trial_id,
                from_state=(from_state or "")[:50],
                to_state=(to_state or "")[:50],
                transition_reason=(reason[:200] if reason else None),
                transition_comment=comment,
                operator_id=operator_id,
                operator_name=(operator_name or str(operator_id))[:100],
                transition_time=datetime.now(),
            )
        except Exception as e:
            logger.warning("样品试用单状态流转日志写入失败，跳过: %s", e)

    async def _submit_sample_trial_from_draft(
        self,
        tenant_id: int,
        trial_id: int,
        operator_id: int,
        *,
        auto_approved: bool,
    ) -> None:
        """草稿提交：根据蓝图决定进入已提交或自动已审核。"""
        op_name = await self.get_user_name(operator_id)
        now = datetime.now()
        if auto_approved:
            await SampleTrial.filter(tenant_id=tenant_id, id=trial_id).update(
                status="已审核",
                updated_by=operator_id,
            )
            await self._log_sample_trial_state_transition(
                tenant_id=tenant_id,
                trial_id=trial_id,
                from_state="草稿",
                to_state="已审核",
                operator_id=operator_id,
                operator_name=op_name,
                reason="自动审核",
            )
        else:
            await SampleTrial.filter(tenant_id=tenant_id, id=trial_id).update(
                status="已提交",
                updated_by=operator_id,
            )
            await self._log_sample_trial_state_transition(
                tenant_id=tenant_id,
                trial_id=trial_id,
                from_state="草稿",
                to_state="已提交",
                operator_id=operator_id,
                operator_name=op_name,
                reason="提交",
                comment=f"submitted_at={now.isoformat()}",
            )

    async def create_sample_trial(
        self,
        tenant_id: int,
        trial_data: SampleTrialCreate,
        created_by: int
    ) -> SampleTrialResponse:
        """创建样品试用单"""
        is_enabled = await self.business_config_service.check_node_enabled(tenant_id, "sample_trial")
        if not is_enabled:
            raise BusinessLogicError("样品试用单节点未启用，无法创建样品试用单")
        async with in_transaction():
            today = datetime.now().strftime("%Y%m%d")
            if trial_data.trial_code:
                code = trial_data.trial_code
            else:
                code = None
                try:
                    code = await self.generate_code(tenant_id, "SAMPLE_TRIAL_CODE", prefix=f"ST{today}")
                except Exception as e:
                    from infra.exceptions.exceptions import ValidationError
                    if isinstance(e, ValidationError) and ("不存在" in str(e) or "未启用" in str(e)):
                        from core.services.default.default_values_service import DefaultValuesService
                        created = await DefaultValuesService.ensure_code_rule_for_page(
                            tenant_id, "kuaizhizao-sample-trial"
                        )
                        if created:
                            try:
                                code = await self.generate_code(tenant_id, "SAMPLE_TRIAL_CODE", prefix=f"ST{today}")
                            except Exception as e2:
                                logger.warning("样品试用单编码规则补建后生成仍失败: %s", e2)
                        else:
                            logger.warning("样品试用单编码规则生成失败: %s", e)
                    else:
                        logger.warning("样品试用单编码规则生成失败: %s", e)
                if code is None:
                    import uuid
                    code = f"ST{today}{uuid.uuid4().hex[:6].upper()}"

            dump = trial_data.model_dump(exclude_unset=True, exclude={"items", "trial_code"})

            trial = await SampleTrial.create(
                tenant_id=tenant_id,
                trial_code=code,
                created_by=created_by,
                **dump
            )

            items = getattr(trial_data, "items", None) or []
            total_quantity = Decimal(0)
            total_amount = Decimal(0)
            for item_data in items:
                qty = Decimal(str(item_data.trial_quantity))
                amt = item_data.total_amount if item_data.total_amount is not None else qty * Decimal(str(item_data.unit_price or 0))
                await SampleTrialItem.create(
                    tenant_id=tenant_id,
                    trial_id=trial.id,
                    trial_quantity=qty,
                    unit_price=Decimal(str(item_data.unit_price or 0)),
                    total_amount=amt,
                    **item_data.model_dump(exclude_unset=True, exclude={"trial_quantity", "unit_price", "total_amount"})
                )
                total_quantity += qty
                total_amount += amt

            await SampleTrial.filter(tenant_id=tenant_id, id=trial.id).update(
                total_quantity=total_quantity,
                total_amount=total_amount
            )
            trial = await SampleTrial.get(tenant_id=tenant_id, id=trial.id)
            # 与报价单一致：蓝图 nodes.sample_trial.auditRequired=False 时，创建后自动审核通过
            audit_required = await self.business_config_service.check_audit_required(
                tenant_id, "sample_trial"
            )
            if not audit_required and (trial.status or "").strip() == "草稿":
                await self._submit_sample_trial_from_draft(
                    tenant_id=tenant_id,
                    trial_id=trial.id,
                    operator_id=created_by,
                    auto_approved=True,
                )
                trial = await SampleTrial.get(tenant_id=tenant_id, id=trial.id)
            return SampleTrialResponse.model_validate(trial)

    async def get_sample_trial_by_id(
        self,
        tenant_id: int,
        trial_id: int
    ) -> SampleTrialWithItemsResponse:
        """根据ID获取样品试用单（含明细）"""
        trial = await SampleTrial.get_or_none(tenant_id=tenant_id, id=trial_id, deleted_at__isnull=True)
        if not trial:
            raise NotFoundError(f"样品试用单不存在: {trial_id}")

        items = await SampleTrialItem.filter(tenant_id=tenant_id, trial_id=trial_id).all()
        response = SampleTrialWithItemsResponse.model_validate(trial)
        response.items = [SampleTrialItemResponse.model_validate(i) for i in items]
        return response

    async def list_sample_trials(
        self,
        tenant_id: int,
        skip: int = 0,
        limit: int = 20,
        **filters
    ) -> List[SampleTrialListResponse]:
        """获取样品试用单列表"""
        query = SampleTrial.filter(tenant_id=tenant_id, deleted_at__isnull=True)
        if filters.get("status"):
            query = query.filter(status=filters["status"])
        if filters.get("customer_id"):
            query = query.filter(customer_id=filters["customer_id"])
        if filters.get("customer_name"):
            query = query.filter(customer_name__icontains=filters["customer_name"])
        if filters.get("trial_code"):
            query = query.filter(trial_code__icontains=filters["trial_code"])
        if filters.get("trial_period_start"):
            query = query.filter(trial_period_start__gte=filters["trial_period_start"])
        if filters.get("trial_period_end"):
            query = query.filter(trial_period_end__lte=filters["trial_period_end"])

        trials = await query.offset(skip).limit(limit).order_by("-created_at")
        return [SampleTrialListResponse.model_validate(r) for r in trials]

    async def update_sample_trial(
        self,
        tenant_id: int,
        trial_id: int,
        trial_data: SampleTrialUpdate,
        updated_by: int
    ) -> SampleTrialResponse:
        """更新样品试用单"""
        trial = await self.get_sample_trial_by_id(tenant_id, trial_id)
        if trial.status != "草稿":
            raise BusinessLogicError("只能更新草稿状态的样品试用单")

        async with in_transaction():
            dump = trial_data.model_dump(exclude_unset=True, exclude={"trial_code", "items"})
            dump["updated_by"] = updated_by
            items = getattr(trial_data, "items", None)
            if items is not None:
                await SampleTrialItem.filter(tenant_id=tenant_id, trial_id=trial_id).delete()
                total_quantity = Decimal(0)
                total_amount = Decimal(0)
                for item_data in items:
                    qty = Decimal(str(item_data.trial_quantity))
                    amt = item_data.total_amount if item_data.total_amount is not None else qty * Decimal(str(item_data.unit_price or 0))
                    await SampleTrialItem.create(
                        tenant_id=tenant_id,
                        trial_id=trial_id,
                        trial_quantity=qty,
                        unit_price=Decimal(str(item_data.unit_price or 0)),
                        total_amount=amt,
                        **item_data.model_dump(exclude_unset=True, exclude={"trial_quantity", "unit_price", "total_amount"})
                    )
                    total_quantity += qty
                    total_amount += amt
                dump["total_quantity"] = total_quantity
                dump["total_amount"] = total_amount

            await SampleTrial.filter(tenant_id=tenant_id, id=trial_id).update(**dump)
            return SampleTrialResponse.model_validate(
                await SampleTrial.get(tenant_id=tenant_id, id=trial_id)
            )

    async def delete_sample_trial(self, tenant_id: int, trial_id: int) -> bool:
        """删除样品试用单"""
        trial = await SampleTrial.get_or_none(tenant_id=tenant_id, id=trial_id, deleted_at__isnull=True)
        if not trial:
            raise NotFoundError(f"样品试用单不存在: {trial_id}")
        if trial.status != "草稿":
            raise BusinessLogicError("只能删除草稿状态的样品试用单")

        await SampleTrial.filter(tenant_id=tenant_id, id=trial_id).update(deleted_at=datetime.now())
        return True

    async def convert_to_sales_order(
        self,
        tenant_id: int,
        trial_id: int,
        created_by: int
    ):
        """
        将样品试用单转为销售订单

        创建销售订单及明细，更新试用单状态为「已转订单」，建立关联。
        返回 (sales_order_response, sample_trial_response)
        """
        trial = await SampleTrial.get_or_none(
            tenant_id=tenant_id, id=trial_id, deleted_at__isnull=True
        )
        if not trial:
            raise NotFoundError(f"样品试用单不存在: {trial_id}")
        if trial.status in ("草稿", "已提交"):
            raise BusinessLogicError("样品试用单需审核通过后方可转订单")
        if trial.status == "已转订单":
            raise BusinessLogicError("该样品试用单已转为销售订单，无法重复转换")
        if trial.sales_order_id:
            raise BusinessLogicError("该样品试用单已关联销售订单，无法重复转换")

        items = await SampleTrialItem.filter(
            tenant_id=tenant_id, trial_id=trial_id
        ).order_by("id")
        if not items:
            raise BusinessLogicError("样品试用单无明细，无法转为销售订单")

        order_date = date.today()
        delivery_date = trial.trial_period_end or trial.trial_period_start or order_date

        so_items = [
            SalesOrderItemCreate(
                material_id=it.material_id,
                material_code=it.material_code,
                material_name=it.material_name,
                material_spec=it.material_spec,
                material_unit=it.material_unit,
                required_quantity=it.trial_quantity,
                delivery_date=delivery_date,
                unit_price=it.unit_price,
                item_amount=it.total_amount,
                notes=it.notes,
            )
            for it in items
        ]

        so_create = SalesOrderCreate(
            order_date=order_date,
            delivery_date=delivery_date,
            customer_id=trial.customer_id,
            customer_name=trial.customer_name,
            customer_contact=trial.customer_contact,
            customer_phone=trial.customer_phone,
            total_quantity=trial.total_quantity,
            total_amount=trial.total_amount,
            status=DemandStatus.DRAFT,
            review_status=ReviewStatus.PENDING,
            notes=trial.notes or f"由样品试用单 {trial.trial_code} 转入",
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
            await SampleTrial.filter(id=trial_id).update(
                status="已转订单",
                sales_order_id=sales_order.id,
                sales_order_code=sales_order.order_code,
                updated_by=created_by,
            )

        try:
            from apps.kuaizhizao.services.document_relation_new_service import DocumentRelationNewService
            from apps.kuaizhizao.schemas.document_relation import DocumentRelationCreate
            rel_svc = DocumentRelationNewService()
            await rel_svc.create_relation(
                tenant_id=tenant_id,
                relation_data=DocumentRelationCreate(
                    source_type="sample_trial",
                    source_id=trial_id,
                    source_code=trial.trial_code,
                    source_name=trial.trial_code,
                    target_type="sales_order",
                    target_id=sales_order.id,
                    target_code=sales_order.order_code,
                    target_name=sales_order.order_code,
                    relation_type="source",
                    relation_mode="push",
                    relation_desc="样品试用单转销售订单",
                ),
                created_by=created_by,
            )
        except BusinessLogicError:
            pass
        except Exception as e:
            logger.warning("建立样品试用单-销售订单关联失败: %s", e)

        trial_updated = await self.get_sample_trial_by_id(tenant_id, trial_id)
        return sales_order, trial_updated

    async def create_sample_outbound(
        self,
        tenant_id: int,
        trial_id: int,
        warehouse_id: int,
        warehouse_name: str,
        created_by: int
    ) -> OtherOutboundResponse:
        """
        根据样品试用单创建样品出库（其他出库，原因：样品）

        创建其他出库单，关联试用单，更新试用单的 other_outbound_id。
        """
        trial = await self.get_sample_trial_by_id(tenant_id, trial_id)
        if trial.status in ("草稿", "已提交"):
            raise BusinessLogicError("样品试用单需审核通过后方可创建样品出库")
        if trial.other_outbound_id:
            raise BusinessLogicError("该样品试用单已创建样品出库，无法重复创建")
        if not trial.items:
            raise BusinessLogicError("样品试用单无明细，无法创建样品出库")

        items = [
            OtherOutboundItemCreate(
                material_id=it.material_id,
                material_code=it.material_code,
                material_name=it.material_name,
                material_spec=it.material_spec,
                material_unit=it.material_unit,
                outbound_quantity=float(it.trial_quantity),
                unit_price=float(it.unit_price or 0),
                total_amount=float(it.total_amount or 0),
                notes=it.notes,
            )
            for it in trial.items
        ]

        outbound_data = OtherOutboundCreate(
            reason_type="样品",
            reason_desc=f"样品试用单 {trial.trial_code} 样品出库",
            warehouse_id=warehouse_id,
            warehouse_name=warehouse_name,
            status="待出库",
            items=items,
        )

        from apps.kuaizhizao.services.warehouse_service import OtherOutboundService
        outbound_svc = OtherOutboundService()
        outbound = await outbound_svc.create_other_outbound(
            tenant_id=tenant_id,
            outbound_data=outbound_data,
            created_by=created_by,
        )

        async with in_transaction():
            await SampleTrial.filter(tenant_id=tenant_id, id=trial_id).update(
                other_outbound_id=outbound.id,
                other_outbound_code=outbound.outbound_code,
                status="试用中" if trial.status in ("草稿", "已审核", "已审批") else trial.status,
                updated_by=created_by,
            )

        try:
            from apps.kuaizhizao.services.document_relation_new_service import DocumentRelationNewService
            from apps.kuaizhizao.schemas.document_relation import DocumentRelationCreate
            rel_svc = DocumentRelationNewService()
            await rel_svc.create_relation(
                tenant_id=tenant_id,
                relation_data=DocumentRelationCreate(
                    source_type="sample_trial",
                    source_id=trial_id,
                    source_code=trial.trial_code,
                    source_name=trial.trial_code,
                    target_type="other_outbound",
                    target_id=outbound.id,
                    target_code=outbound.outbound_code,
                    target_name=outbound.outbound_code,
                    relation_type="source",
                    relation_mode="push",
                    relation_desc="样品试用单创建样品出库",
                ),
                created_by=created_by,
            )
        except BusinessLogicError:
            pass
        except Exception as e:
            logger.warning("建立样品试用单-其他出库关联失败: %s", e)

        return outbound

    async def submit_sample_trial(
        self,
        tenant_id: int,
        trial_id: int,
        submitted_by: int,
    ) -> SampleTrialResponse:
        """提交样品试用单（草稿 -> 已提交/已审核）。"""
        trial = await SampleTrial.get_or_none(tenant_id=tenant_id, id=trial_id, deleted_at__isnull=True)
        if not trial:
            raise NotFoundError(f"样品试用单不存在: {trial_id}")
        if trial.status != "草稿":
            raise BusinessLogicError(f"仅草稿状态可提交，当前状态: {trial.status}")
        audit_required = await self.business_config_service.check_audit_required(tenant_id, "sample_trial")
        async with in_transaction():
            await self._submit_sample_trial_from_draft(
                tenant_id=tenant_id,
                trial_id=trial_id,
                operator_id=submitted_by,
                auto_approved=not audit_required,
            )
        return SampleTrialResponse.model_validate(await SampleTrial.get(tenant_id=tenant_id, id=trial_id))

    async def withdraw_sample_trial(
        self,
        tenant_id: int,
        trial_id: int,
        withdrawn_by: int,
    ) -> SampleTrialResponse:
        """撤回提交（已提交 -> 草稿）。"""
        trial = await SampleTrial.get_or_none(tenant_id=tenant_id, id=trial_id, deleted_at__isnull=True)
        if not trial:
            raise NotFoundError(f"样品试用单不存在: {trial_id}")
        if trial.status != "已提交":
            raise BusinessLogicError(f"仅已提交状态可撤回，当前状态: {trial.status}")
        op_name = await self.get_user_name(withdrawn_by)
        async with in_transaction():
            await SampleTrial.filter(tenant_id=tenant_id, id=trial_id).update(
                status="草稿",
                updated_by=withdrawn_by,
            )
            await self._log_sample_trial_state_transition(
                tenant_id=tenant_id,
                trial_id=trial_id,
                from_state="已提交",
                to_state="草稿",
                operator_id=withdrawn_by,
                operator_name=op_name,
                reason="撤回提交",
            )
        return SampleTrialResponse.model_validate(await SampleTrial.get(tenant_id=tenant_id, id=trial_id))

    async def approve_sample_trial(
        self,
        tenant_id: int,
        trial_id: int,
        operator_id: int,
        review_remarks: Optional[str] = None,
    ) -> SampleTrialResponse:
        """审核通过（已提交 -> 已审核）。"""
        trial = await SampleTrial.get_or_none(tenant_id=tenant_id, id=trial_id, deleted_at__isnull=True)
        if not trial:
            raise NotFoundError(f"样品试用单不存在: {trial_id}")
        if trial.status != "已提交":
            raise BusinessLogicError(f"仅已提交状态可审核通过，当前状态: {trial.status}")
        op_name = await self.get_user_name(operator_id)
        async with in_transaction():
            await SampleTrial.filter(tenant_id=tenant_id, id=trial_id).update(
                status="已审核",
                updated_by=operator_id,
            )
            await self._log_sample_trial_state_transition(
                tenant_id=tenant_id,
                trial_id=trial_id,
                from_state="已提交",
                to_state="已审核",
                operator_id=operator_id,
                operator_name=op_name,
                reason="审核通过",
                comment=review_remarks,
            )
        return SampleTrialResponse.model_validate(await SampleTrial.get(tenant_id=tenant_id, id=trial_id))

    async def reject_sample_trial(
        self,
        tenant_id: int,
        trial_id: int,
        operator_id: int,
        review_remarks: Optional[str] = None,
    ) -> SampleTrialResponse:
        """审核驳回（已提交 -> 草稿）。"""
        trial = await SampleTrial.get_or_none(tenant_id=tenant_id, id=trial_id, deleted_at__isnull=True)
        if not trial:
            raise NotFoundError(f"样品试用单不存在: {trial_id}")
        if trial.status != "已提交":
            raise BusinessLogicError(f"仅已提交状态可驳回，当前状态: {trial.status}")
        op_name = await self.get_user_name(operator_id)
        async with in_transaction():
            await SampleTrial.filter(tenant_id=tenant_id, id=trial_id).update(
                status="草稿",
                updated_by=operator_id,
            )
            await self._log_sample_trial_state_transition(
                tenant_id=tenant_id,
                trial_id=trial_id,
                from_state="已提交",
                to_state="草稿",
                operator_id=operator_id,
                operator_name=op_name,
                reason="审核驳回",
                comment=review_remarks,
            )
        return SampleTrialResponse.model_validate(await SampleTrial.get(tenant_id=tenant_id, id=trial_id))
