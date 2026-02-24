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
            code = await self.generate_code(tenant_id, "SAMPLE_TRIAL_CODE", prefix=f"ST{today}")

            dump = trial_data.model_dump(exclude_unset=True, exclude={"items", "trial_code"})
            if trial_data.trial_code:
                code = trial_data.trial_code

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
                status="试用中" if trial.status == "草稿" or trial.status == "已审批" else trial.status,
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
