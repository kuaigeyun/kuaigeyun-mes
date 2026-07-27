"""
装箱打包绑定业务服务模块

提供装箱打包绑定记录相关的业务逻辑处理，包括装箱绑定、产品序列号绑定、包装物料绑定等。

Author: Luigi Lu
Date: 2025-01-04
"""

import uuid
from datetime import date, datetime, time
from typing import List, Optional, Dict, Any
from decimal import Decimal

from tortoise.queryset import Q
from tortoise.transactions import in_transaction

from apps.kuaizhizao.models.packing_binding import PackingBinding
from apps.kuaizhizao.models.finished_goods_receipt import FinishedGoodsReceipt
from apps.kuaizhizao.models.sales_delivery import SalesDelivery
from apps.kuaizhizao.schemas.packing_binding import (
    PackingBindingCreateFromReceipt,
    PackingBindingCreateFromDelivery,
    PackingBindingUpdate,
    PackingBindingResponse,
    PackingBindingListResponse,
    PackingBindingPageResponse,
    PackingBindingStatisticsResponse,
    PackingBindingTaskPoolResponse,
    PackingBindingTaskPoolItemResponse,
)

from apps.common.base_service import AppBaseService
from apps.common.audit_actor import apply_create_audit, operator_name_from_user
from infra.models.user import User
from infra.exceptions.exceptions import NotFoundError, ValidationError, BusinessLogicError
from loguru import logger
from apps.kuaizhizao.services.document_action_policy.packing_binding import (
    assert_packing_binding_capability,
)
from core.utils.timezone_utils import resolve_business_datetime, today_site_str
from apps.kuaizhizao.services.document_action_policy.enricher import (
    enrich_packing_binding_capabilities_on_response,
    enrich_packing_binding_list_capabilities,
)

PACKING_BINDING_SORTABLE_FIELDS = frozenset({
    "box_no",
    "product_code",
    "product_name",
    "product_serial_no",
    "packing_quantity",
    "packing_material_code",
    "packing_material_name",
    "binding_method",
    "barcode",
    "bound_by_name",
    "bound_at",
    "created_at",
    "updated_at",
})


class PackingBindingService(AppBaseService[PackingBinding]):
    """
    装箱打包绑定服务类

    处理装箱打包绑定记录相关的所有业务逻辑。
    """

    def __init__(self):
        super().__init__(PackingBinding)

    async def create_packing_binding_from_receipt(
        self,
        tenant_id: int,
        receipt_id: int,
        binding_data: PackingBindingCreateFromReceipt,
        bound_by: int
    ) -> PackingBindingResponse:
        """
        从成品入库单创建装箱绑定记录

        Args:
            tenant_id: 组织ID
            receipt_id: 成品入库单ID
            binding_data: 装箱绑定创建数据
            bound_by: 绑定人ID

        Returns:
            PackingBindingResponse: 创建的装箱绑定记录信息

        Raises:
            NotFoundError: 成品入库单不存在
            ValidationError: 数据验证失败
        """
        async with in_transaction():
            # 获取成品入库单
            receipt = await FinishedGoodsReceipt.get_or_none(
                id=receipt_id,
                tenant_id=tenant_id,
                deleted_at__isnull=True
            )

            if not receipt:
                raise NotFoundError(f"成品入库单不存在: {receipt_id}")

            # 获取产品信息
            product_code = binding_data.product_code or f"PROD{binding_data.product_id}"
            product_name = binding_data.product_name or f"产品{binding_data.product_id}"

            # 获取包装物料信息（如果提供了包装物料ID）
            packing_material_code = binding_data.packing_material_code
            packing_material_name = binding_data.packing_material_name
            if binding_data.packing_material_id and not packing_material_code:
                # TODO: 从物料服务获取包装物料信息
                packing_material_code = f"PACK{binding_data.packing_material_id}"
                packing_material_name = packing_material_name or f"包装物料{binding_data.packing_material_id}"

            # 获取绑定人信息
            user = await User.get_or_none(id=bound_by)
            bound_by_name = operator_name_from_user(user)

            # 如果未提供箱号，自动生成箱号
            box_no = binding_data.box_no
            if not box_no:
                # 使用编码生成服务生成箱号
                today = today_site_str()
                try:
                    box_no = await self.generate_code(
                        tenant_id=tenant_id,
                        code_type="BOX_CODE",
                        prefix=f"BOX{today}"
                    )
                except Exception:
                    # 如果编码规则不存在，使用简单格式生成
                    # 获取当前日期和序号
                    existing_count = await PackingBinding.filter(
                        tenant_id=tenant_id,
                        finished_goods_receipt_id=receipt_id,
                        deleted_at__isnull=True
                    ).count()
                    box_no = f"BOX{today}{str(existing_count + 1).zfill(4)}"

            # 创建装箱绑定记录
            create_payload = dict(
                tenant_id=tenant_id,
                uuid=str(uuid.uuid4()),
                finished_goods_receipt_id=receipt_id,
                sales_delivery_id=None,
                product_id=binding_data.product_id,
                product_code=product_code,
                product_name=product_name,
                product_serial_no=binding_data.product_serial_no,
                packing_material_id=binding_data.packing_material_id,
                packing_material_code=packing_material_code,
                packing_material_name=packing_material_name,
                packing_quantity=binding_data.packing_quantity,
                box_no=box_no,
                binding_method=binding_data.binding_method,
                barcode=binding_data.barcode,
                bound_by=bound_by,
                bound_by_name=bound_by_name,
                bound_at=binding_data.bound_at or resolve_business_datetime(),
                remarks=binding_data.remarks,
            )
            apply_create_audit(create_payload, user)
            packing_binding = await PackingBinding.create(**create_payload)

            # 建立成品入库→装箱绑定 的 DocumentRelation
            try:
                from apps.kuaizhizao.services.document_relation_new_service import DocumentRelationNewService
                from apps.kuaizhizao.schemas.document_relation import DocumentRelationCreate

                rel_svc = DocumentRelationNewService()
                await rel_svc.create_relation(
                    tenant_id=tenant_id,
                    relation_data=DocumentRelationCreate(
                        source_type="finished_goods_receipt",
                        source_id=receipt_id,
                        source_code=receipt.receipt_code,
                        source_name=None,
                        target_type="packing_binding",
                        target_id=packing_binding.id,
                        target_code=packing_binding.box_no,
                        target_name=None,
                        relation_type="source",
                        relation_mode="push",
                        relation_desc="成品入库创建装箱绑定",
                    ),
                    created_by=bound_by,
                )
            except Exception as e:
                logger.warning("建立成品入库→装箱绑定 单据关联失败: %s", e)

            return PackingBindingResponse.model_validate(packing_binding)

    async def create_packing_binding_from_delivery(
        self,
        tenant_id: int,
        delivery_id: int,
        binding_data: PackingBindingCreateFromDelivery,
        bound_by: int
    ) -> PackingBindingResponse:
        """
        从销售出库单创建装箱绑定记录（发货时按箱登记，用于出货追溯）
        """
        async with in_transaction():
            delivery = await SalesDelivery.get_or_none(
                id=delivery_id,
                tenant_id=tenant_id,
                deleted_at__isnull=True
            )
            if not delivery:
                raise NotFoundError(f"销售出库单不存在: {delivery_id}")

            product_code = binding_data.product_code or f"PROD{binding_data.product_id}"
            product_name = binding_data.product_name or f"产品{binding_data.product_id}"
            packing_material_code = binding_data.packing_material_code
            packing_material_name = binding_data.packing_material_name
            if binding_data.packing_material_id and not packing_material_code:
                packing_material_code = f"PACK{binding_data.packing_material_id}"
                packing_material_name = packing_material_name or f"包装物料{binding_data.packing_material_id}"

            user = await User.get_or_none(id=bound_by)
            bound_by_name = operator_name_from_user(user)
            box_no = binding_data.box_no
            if not box_no:
                today = today_site_str()
                try:
                    box_no = await self.generate_code(
                        tenant_id=tenant_id,
                        code_type="BOX_CODE",
                        prefix=f"BOX{today}"
                    )
                except Exception:
                    existing_count = await PackingBinding.filter(
                        tenant_id=tenant_id,
                        sales_delivery_id=delivery_id,
                        deleted_at__isnull=True
                    ).count()
                    box_no = f"BOX{today}{str(existing_count + 1).zfill(4)}"

            create_payload = dict(
                tenant_id=tenant_id,
                uuid=str(uuid.uuid4()),
                finished_goods_receipt_id=None,
                sales_delivery_id=delivery_id,
                product_id=binding_data.product_id,
                product_code=product_code,
                product_name=product_name,
                product_serial_no=binding_data.product_serial_no,
                packing_material_id=binding_data.packing_material_id,
                packing_material_code=packing_material_code,
                packing_material_name=packing_material_name,
                packing_quantity=binding_data.packing_quantity,
                box_no=box_no,
                binding_method=binding_data.binding_method,
                barcode=binding_data.barcode,
                bound_by=bound_by,
                bound_by_name=bound_by_name,
                bound_at=binding_data.bound_at or resolve_business_datetime(),
                remarks=binding_data.remarks,
            )
            apply_create_audit(create_payload, user)
            packing_binding = await PackingBinding.create(**create_payload)

            # 建立销售出库→装箱绑定 的 DocumentRelation
            try:
                from apps.kuaizhizao.services.document_relation_new_service import DocumentRelationNewService
                from apps.kuaizhizao.schemas.document_relation import DocumentRelationCreate

                rel_svc = DocumentRelationNewService()
                await rel_svc.create_relation(
                    tenant_id=tenant_id,
                    relation_data=DocumentRelationCreate(
                        source_type="sales_delivery",
                        source_id=delivery_id,
                        source_code=delivery.delivery_code,
                        source_name=None,
                        target_type="packing_binding",
                        target_id=packing_binding.id,
                        target_code=packing_binding.box_no,
                        target_name=None,
                        relation_type="source",
                        relation_mode="push",
                        relation_desc="销售出库创建装箱绑定",
                    ),
                    created_by=bound_by,
                )
            except Exception as e:
                logger.warning("建立销售出库→装箱绑定 单据关联失败: %s", e)

            return PackingBindingResponse.model_validate(packing_binding)

    async def get_packing_bindings_by_receipt(
        self,
        tenant_id: int,
        receipt_id: int
    ) -> List[PackingBindingListResponse]:
        """
        根据成品入库单ID获取装箱绑定记录列表

        Args:
            tenant_id: 组织ID
            receipt_id: 成品入库单ID

        Returns:
            List[PackingBindingListResponse]: 装箱绑定记录列表
        """
        bindings = await PackingBinding.filter(
            tenant_id=tenant_id,
            finished_goods_receipt_id=receipt_id,
            deleted_at__isnull=True
        ).order_by('-bound_at')
        responses = [PackingBindingListResponse.model_validate(binding) for binding in bindings]
        return enrich_packing_binding_list_capabilities(bindings, responses)

    async def get_packing_bindings_by_delivery(
        self,
        tenant_id: int,
        delivery_id: int
    ) -> List[PackingBindingListResponse]:
        """根据销售出库单ID获取装箱绑定记录列表"""
        bindings = await PackingBinding.filter(
            tenant_id=tenant_id,
            sales_delivery_id=delivery_id,
            deleted_at__isnull=True
        ).order_by('-bound_at')
        responses = [PackingBindingListResponse.model_validate(binding) for binding in bindings]
        return enrich_packing_binding_list_capabilities(bindings, responses)

    async def delete_packing_binding(
        self,
        tenant_id: int,
        binding_id: int
    ) -> None:
        """
        删除装箱绑定记录（软删除）

        Args:
            tenant_id: 组织ID
            binding_id: 装箱绑定记录ID

        Raises:
            NotFoundError: 装箱绑定记录不存在
        """
        binding = await PackingBinding.get_or_none(
            id=binding_id,
            tenant_id=tenant_id,
            deleted_at__isnull=True
        )

        if not binding:
            raise NotFoundError(f"装箱绑定记录不存在: {binding_id}")

        assert_packing_binding_capability(binding, "delete")

        # 软删除
        binding.deleted_at = resolve_business_datetime()
        await binding.save()

    def _build_packing_binding_list_query(
        self,
        tenant_id: int,
        receipt_id: Optional[int] = None,
        sales_delivery_id: Optional[int] = None,
        product_id: Optional[int] = None,
        box_no: Optional[str] = None,
        uuid_value: Optional[str] = None,
        keyword: Optional[str] = None,
        product_code: Optional[str] = None,
        product_name: Optional[str] = None,
        product_serial_no: Optional[str] = None,
        packing_material_name: Optional[str] = None,
        binding_method: Optional[str] = None,
        source_type: Optional[str] = None,
        bound_at_from: Optional[datetime] = None,
        bound_at_to: Optional[datetime] = None,
        created_start_date: Optional[date] = None,
        created_end_date: Optional[date] = None,
    ):
        query = PackingBinding.filter(
            tenant_id=tenant_id,
            deleted_at__isnull=True,
        )

        if receipt_id:
            query = query.filter(finished_goods_receipt_id=receipt_id)
        if sales_delivery_id:
            query = query.filter(sales_delivery_id=sales_delivery_id)
        if product_id:
            query = query.filter(product_id=product_id)
        bn = (box_no or "").strip()
        if bn:
            query = query.filter(box_no__icontains=bn)
        if uuid_value:
            query = query.filter(uuid=uuid_value)

        kw = (keyword or "").strip()
        if kw:
            query = query.filter(
                Q(box_no__icontains=kw)
                | Q(product_code__icontains=kw)
                | Q(product_name__icontains=kw)
                | Q(product_serial_no__icontains=kw)
                | Q(packing_material_name__icontains=kw)
                | Q(barcode__icontains=kw)
                | Q(bound_by_name__icontains=kw)
            )
        pc = (product_code or "").strip()
        if pc:
            query = query.filter(product_code__icontains=pc)
        pn = (product_name or "").strip()
        if pn:
            query = query.filter(product_name__icontains=pn)
        psn = (product_serial_no or "").strip()
        if psn:
            query = query.filter(product_serial_no__icontains=psn)
        pmn = (packing_material_name or "").strip()
        if pmn:
            query = query.filter(packing_material_name__icontains=pmn)
        if binding_method:
            query = query.filter(binding_method=binding_method)
        st = (source_type or "").strip()
        if st == "finished_goods_receipt":
            query = query.filter(finished_goods_receipt_id__isnull=False)
        elif st == "sales_delivery":
            query = query.filter(sales_delivery_id__isnull=False)
        if bound_at_from is not None:
            query = query.filter(bound_at__gte=bound_at_from)
        if bound_at_to is not None:
            query = query.filter(bound_at__lte=bound_at_to)
        if created_start_date is not None:
            query = query.filter(created_at__gte=datetime.combine(created_start_date, time.min))
        if created_end_date is not None:
            query = query.filter(created_at__lte=datetime.combine(created_end_date, time.max))
        return query

    async def list_packing_bindings(
        self,
        tenant_id: int,
        skip: int = 0,
        limit: int = 100,
        receipt_id: Optional[int] = None,
        sales_delivery_id: Optional[int] = None,
        product_id: Optional[int] = None,
        box_no: Optional[str] = None,
        uuid_value: Optional[str] = None,
        keyword: Optional[str] = None,
        product_code: Optional[str] = None,
        product_name: Optional[str] = None,
        product_serial_no: Optional[str] = None,
        packing_material_name: Optional[str] = None,
        binding_method: Optional[str] = None,
        source_type: Optional[str] = None,
        bound_at_from: Optional[datetime] = None,
        bound_at_to: Optional[datetime] = None,
        created_start_date: Optional[date] = None,
        created_end_date: Optional[date] = None,
        order_by: Optional[str] = None,
    ) -> List[PackingBindingListResponse]:
        """
        获取装箱绑定记录列表

        Args:
            tenant_id: 组织ID
            skip: 跳过数量
            limit: 限制数量
            receipt_id: 成品入库单ID（可选）
            product_id: 产品ID（可选）
            box_no: 箱号（可选，模糊搜索）

        Returns:
            List[PackingBindingListResponse]: 装箱绑定记录列表
        """
        query = self._build_packing_binding_list_query(
            tenant_id=tenant_id,
            receipt_id=receipt_id,
            sales_delivery_id=sales_delivery_id,
            product_id=product_id,
            box_no=box_no,
            uuid_value=uuid_value,
            keyword=keyword,
            product_code=product_code,
            product_name=product_name,
            product_serial_no=product_serial_no,
            packing_material_name=packing_material_name,
            binding_method=binding_method,
            source_type=source_type,
            bound_at_from=bound_at_from,
            bound_at_to=bound_at_to,
            created_start_date=created_start_date,
            created_end_date=created_end_date,
        )

        order_clause = order_by if order_by else "-bound_at"
        bindings = await query.order_by(order_clause).offset(skip).limit(limit)

        responses = [PackingBindingListResponse.model_validate(binding) for binding in bindings]
        return enrich_packing_binding_list_capabilities(bindings, responses)

    async def list_packing_bindings_page(
        self,
        tenant_id: int,
        skip: int = 0,
        limit: int = 100,
        receipt_id: Optional[int] = None,
        sales_delivery_id: Optional[int] = None,
        product_id: Optional[int] = None,
        box_no: Optional[str] = None,
        uuid_value: Optional[str] = None,
        keyword: Optional[str] = None,
        product_code: Optional[str] = None,
        product_name: Optional[str] = None,
        product_serial_no: Optional[str] = None,
        packing_material_name: Optional[str] = None,
        binding_method: Optional[str] = None,
        source_type: Optional[str] = None,
        bound_at_from: Optional[datetime] = None,
        bound_at_to: Optional[datetime] = None,
        created_start_date: Optional[date] = None,
        created_end_date: Optional[date] = None,
        order_by: Optional[str] = None,
    ) -> PackingBindingPageResponse:
        """分页获取装箱绑定记录（含 total）。"""
        query = self._build_packing_binding_list_query(
            tenant_id=tenant_id,
            receipt_id=receipt_id,
            sales_delivery_id=sales_delivery_id,
            product_id=product_id,
            box_no=box_no,
            uuid_value=uuid_value,
            keyword=keyword,
            product_code=product_code,
            product_name=product_name,
            product_serial_no=product_serial_no,
            packing_material_name=packing_material_name,
            binding_method=binding_method,
            source_type=source_type,
            bound_at_from=bound_at_from,
            bound_at_to=bound_at_to,
            created_start_date=created_start_date,
            created_end_date=created_end_date,
        )

        total = await query.count()
        order_clause = order_by if order_by else "-bound_at"
        rows = await query.order_by(order_clause).offset(skip).limit(limit)
        items = enrich_packing_binding_list_capabilities(
            rows,
            [PackingBindingListResponse.model_validate(r) for r in rows],
        )
        return PackingBindingPageResponse(
            data=items,
            total=total,
            success=True,
        )

    async def get_packing_binding_statistics(self, tenant_id: int) -> PackingBindingStatisticsResponse:
        """装箱绑定统计（总数/扫码/手动）。"""
        base = PackingBinding.filter(tenant_id=tenant_id, deleted_at__isnull=True)
        total = await base.count()
        scan = await base.filter(binding_method='scan').count()
        manual = await base.filter(binding_method='manual').count()
        return PackingBindingStatisticsResponse(total=total, scan=scan, manual=manual)

    async def get_task_pool_summary(self, tenant_id: int, limit: int = 20) -> PackingBindingTaskPoolResponse:
        """待装箱任务池（只读）：来自销售出库单。"""
        pending_review_qs = SalesDelivery.filter(
            tenant_id=tenant_id,
            deleted_at__isnull=True,
            review_status='待审核',
        ).exclude(status__in=["已完成", "COMPLETED", "已取消", "CANCELLED"])
        pending_outbound_qs = SalesDelivery.filter(
            tenant_id=tenant_id,
            deleted_at__isnull=True,
            status='待出库',
        ).exclude(review_status='待审核')

        pending_review = await pending_review_qs.count()
        pending_outbound = await pending_outbound_qs.count()
        rows = await SalesDelivery.filter(
            tenant_id=tenant_id,
            deleted_at__isnull=True,
        ).filter(
            Q(review_status='待审核') | Q(status='待出库')
        ).order_by('-updated_at').limit(limit)

        return PackingBindingTaskPoolResponse(
            pending_review=pending_review,
            pending_outbound=pending_outbound,
            total=pending_review + pending_outbound,
            items=[
                PackingBindingTaskPoolItemResponse(
                    id=row.id,
                    delivery_code=row.delivery_code,
                    customer_name=row.customer_name,
                    review_status=row.review_status,
                    status=row.status,
                    updated_at=row.updated_at,
                )
                for row in rows
            ],
        )

    async def get_packing_binding_by_id(
        self,
        tenant_id: int,
        binding_id: int
    ) -> PackingBindingResponse:
        """
        根据ID获取装箱绑定记录详情

        Args:
            tenant_id: 组织ID
            binding_id: 装箱绑定记录ID

        Returns:
            PackingBindingResponse: 装箱绑定记录详情

        Raises:
            NotFoundError: 装箱绑定记录不存在
        """
        binding = await PackingBinding.get_or_none(
            id=binding_id,
            tenant_id=tenant_id,
            deleted_at__isnull=True
        )

        if not binding:
            raise NotFoundError(f"装箱绑定记录不存在: {binding_id}")

        return enrich_packing_binding_capabilities_on_response(
            binding,
            PackingBindingResponse.model_validate(binding),
        )

    async def update_packing_binding(
        self,
        tenant_id: int,
        binding_id: int,
        binding_data: PackingBindingUpdate,
        updated_by: int
    ) -> PackingBindingResponse:
        """
        更新装箱绑定记录

        Args:
            tenant_id: 组织ID
            binding_id: 装箱绑定记录ID
            binding_data: 装箱绑定更新数据
            updated_by: 更新人ID

        Returns:
            PackingBindingResponse: 更新后的装箱绑定记录信息

        Raises:
            NotFoundError: 装箱绑定记录不存在
            ValidationError: 数据验证失败
        """
        async with in_transaction():
            # 获取装箱绑定记录
            binding = await PackingBinding.get_or_none(
                id=binding_id,
                tenant_id=tenant_id,
                deleted_at__isnull=True
            )

            if not binding:
                raise NotFoundError(f"装箱绑定记录不存在: {binding_id}")

            assert_packing_binding_capability(binding, "update")

            # 获取更新人信息
            user_info = await self.get_user_info(updated_by)

            # 更新字段
            if binding_data.packing_quantity is not None:
                binding.packing_quantity = binding_data.packing_quantity
            if binding_data.box_no is not None:
                binding.box_no = binding_data.box_no
            if binding_data.remarks is not None:
                binding.remarks = binding_data.remarks

            binding.updated_by = updated_by
            binding.updated_by_name = user_info["name"]

            await binding.save()

            return enrich_packing_binding_capabilities_on_response(
                binding,
                PackingBindingResponse.model_validate(binding),
            )
