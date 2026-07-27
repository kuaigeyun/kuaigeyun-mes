"""
返工单业务服务模块

提供返工单相关的业务逻辑处理，包括CRUD操作、从工单创建返工单等。

Author: Luigi Lu
Date: 2026-01-05
"""

import uuid
from datetime import datetime, date, time
from typing import List, Optional, Dict, Any
from decimal import Decimal

from core.utils.timezone_utils import is_future_datetime, resolve_business_datetime, today_site_str

from tortoise.transactions import in_transaction
from tortoise.expressions import Q

from infra.exceptions.exceptions import NotFoundError, ValidationError, BusinessLogicError
from infra.services.business_config_service import BusinessConfigService

from apps.common.base_service import AppBaseService
from apps.kuaizhizao.models.rework_order import ReworkOrder
from apps.kuaizhizao.models.rework_order_operation import ReworkOrderOperation
from apps.kuaizhizao.models.work_order import WorkOrder
from apps.kuaizhizao.models.work_order_operation import WorkOrderOperation
from apps.kuaizhizao.models.reporting_record import ReportingRecord
from apps.kuaizhizao.schemas.rework_order import (
    ReworkOrderCreate,
    ReworkOrderUpdate,
    ReworkOrderResponse,
    ReworkOrderListResponse,
    ReworkOrderFromWorkOrderRequest,
    ReworkOrderOperationItem,
    ReworkReportingCreate,
    ReworkReportingOptionItem,
    ReworkReportingOptionsResponse,
)
from apps.kuaizhizao.schemas.reporting_record import ReportingRecordResponse
from loguru import logger


REWORK_ORDER_SORTABLE_FIELDS = frozenset({
    "code",
    "product_code",
    "product_name",
    "quantity",
    "rework_type",
    "status",
    "planned_start_date",
    "planned_end_date",
    "actual_start_date",
    "actual_end_date",
    "created_at",
    "updated_at",
})


class ReworkOrderService(AppBaseService[ReworkOrder]):
    """
    返工单服务类

    处理返工单相关的所有业务逻辑。
    """

    def __init__(self):
        super().__init__(ReworkOrder)
        self.business_config_service = BusinessConfigService()

    async def _compute_reworkable_quantity(
        self,
        tenant_id: int,
        work_order_id: int,
        original_work_order: WorkOrder,
    ) -> Decimal:
        """原工单数量减去未取消返工单已占用数量。"""
        wo_qty = Decimal(str(original_work_order.quantity or 0))
        existing_rows = await ReworkOrder.filter(
            tenant_id=tenant_id,
            original_work_order_id=work_order_id,
            deleted_at__isnull=True,
        ).exclude(status="cancelled").all()
        already = sum(Decimal(str(row.quantity or 0)) for row in existing_rows)
        reworkable = wo_qty - already
        return reworkable if reworkable > 0 else Decimal("0")

    async def _validate_rework_quantity(
        self,
        tenant_id: int,
        work_order_id: int,
        original_work_order: WorkOrder,
        quantity: Decimal,
    ) -> None:
        if quantity <= 0:
            raise ValidationError("返工数量必须大于 0")
        reworkable = await self._compute_reworkable_quantity(
            tenant_id, work_order_id, original_work_order
        )
        if quantity > reworkable:
            raise ValidationError(
                f"返工数量({quantity})不能超过可返工数量({reworkable})"
            )

    async def _validate_rework_operation_ids(
        self,
        tenant_id: int,
        work_order_id: int,
        operation_ids: Optional[List[int]],
    ) -> None:
        if not operation_ids:
            return
        ops = await WorkOrderOperation.filter(
            tenant_id=tenant_id,
            work_order_id=work_order_id,
            id__in=operation_ids,
            deleted_at__isnull=True,
        ).all()
        found_ids = {op.id for op in ops}
        missing = [op_id for op_id in operation_ids if op_id not in found_ids]
        if missing:
            raise ValidationError(f"工序不属于该工单或不存在: {missing}")

    async def _resolve_start_work_order_operation_id(
        self,
        tenant_id: int,
        work_order_id: int,
        explicit_start_id: Optional[int],
    ) -> int:
        if explicit_start_id is not None:
            await self._validate_rework_operation_ids(tenant_id, work_order_id, [explicit_start_id])
            return explicit_start_id
        first_op = await WorkOrderOperation.filter(
            tenant_id=tenant_id,
            work_order_id=work_order_id,
            deleted_at__isnull=True,
        ).order_by("sequence", "id").first()
        if not first_op or first_op.id is None:
            raise ValidationError("原工单没有工序，无法创建返工单")
        return first_op.id

    async def _sync_start_operation_link(
        self,
        tenant_id: int,
        rework_order_id: int,
        start_work_order_operation_id: int,
    ) -> None:
        await ReworkOrderOperation.filter(
            tenant_id=tenant_id,
            rework_order_id=rework_order_id,
        ).delete()
        await ReworkOrderOperation.create(
            tenant_id=tenant_id,
            rework_order_id=rework_order_id,
            work_order_operation_id=start_work_order_operation_id,
            sequence=0,
        )

    async def _get_rework_operations(
        self, tenant_id: int, rework_order_id: int
    ) -> List[ReworkOrderOperationItem]:
        """获取返工单起始工序（创建时指定的第一道）"""
        rework_order = await ReworkOrder.get_or_none(
            tenant_id=tenant_id,
            id=rework_order_id,
            deleted_at__isnull=True,
        )
        start_id = rework_order.start_work_order_operation_id if rework_order else None
        if not start_id:
            return []
        op = await WorkOrderOperation.get_or_none(
            tenant_id=tenant_id,
            id=start_id,
            deleted_at__isnull=True,
        )
        if not op:
            return []
        return [
            ReworkOrderOperationItem(
                work_order_operation_id=start_id,
                operation_code=op.operation_code,
                operation_name=op.operation_name,
                sequence=op.sequence,
                is_start=True,
            )
        ]

    async def _load_original_work_order_code_map(
        self,
        tenant_id: int,
        original_work_order_ids: List[int],
    ) -> dict[int, str]:
        unique_ids = [wo_id for wo_id in dict.fromkeys(original_work_order_ids) if wo_id]
        if not unique_ids:
            return {}
        rows = await WorkOrder.filter(
            tenant_id=tenant_id,
            id__in=unique_ids,
            deleted_at__isnull=True,
        ).values("id", "code")
        return {row["id"]: row["code"] for row in rows}

    @staticmethod
    def _attach_original_work_order_code(
        resp: ReworkOrderResponse | ReworkOrderListResponse,
        code_map: dict[int, str],
        original_work_order_id: Optional[int],
    ) -> None:
        if original_work_order_id and original_work_order_id in code_map:
            resp.original_work_order_code = code_map[original_work_order_id]

    async def _create_rework_document_relation(
        self,
        tenant_id: int,
        original_work_order_id: int,
        rework_order: ReworkOrder,
        created_by: int,
    ) -> None:
        """在返工单已提交后建立单据关联，避免与主事务嵌套 in_transaction 导致挂起。"""
        try:
            from apps.kuaizhizao.services.document_relation_new_service import DocumentRelationNewService
            from apps.kuaizhizao.schemas.document_relation import DocumentRelationCreate

            original_work_order = await WorkOrder.get_or_none(
                tenant_id=tenant_id,
                id=original_work_order_id,
                deleted_at__isnull=True,
            )
            if not original_work_order:
                return
            rel_svc = DocumentRelationNewService()
            await rel_svc.create_relation(
                tenant_id=tenant_id,
                relation_data=DocumentRelationCreate(
                    source_type="work_order",
                    source_id=original_work_order_id,
                    source_code=original_work_order.code,
                    source_name=original_work_order.name,
                    target_type="rework_order",
                    target_id=rework_order.id,
                    target_code=rework_order.code,
                    target_name=rework_order.product_name,
                    relation_type="source",
                    relation_mode="push",
                    relation_desc="工单创建返工单",
                ),
                created_by=created_by,
            )
        except BusinessLogicError:
            pass  # 关联已存在，忽略
        except Exception as e:
            logger.warning("建立工单→返工单关联失败: %s", e)

    async def create_rework_order(
        self,
        tenant_id: int,
        rework_order_data: ReworkOrderCreate,
        created_by: int
    ) -> ReworkOrderResponse:
        """
        创建返工单

        Args:
            tenant_id: 组织ID
            rework_order_data: 返工单创建数据
            created_by: 创建人ID

        Returns:
            ReworkOrderResponse: 创建的返工单信息

        Raises:
            ValidationError: 数据验证失败
        """
        is_enabled = await self.business_config_service.check_node_enabled(tenant_id, "rework_order")
        if not is_enabled:
            raise BusinessLogicError("返工工单节点未启用，无法创建返工工单")

        # 编码生成、校验、用户信息查询均放在事务外，避免长事务与嵌套事务
        if not rework_order_data.code:
            today = today_site_str()
            code = await self.generate_code(
                tenant_id=tenant_id,
                code_type="REWORK_ORDER_CODE",
                prefix=f"返工-{today}"
            )
        else:
            code = rework_order_data.code
            existing = await ReworkOrder.filter(
                tenant_id=tenant_id,
                code=code,
                deleted_at__isnull=True
            ).first()
            if existing:
                raise ValidationError(f"返工单编码 {code} 已存在")

        user_info = await self.get_user_info(created_by)

        original_work_order = None
        if rework_order_data.original_work_order_id:
            original_work_order = await WorkOrder.get_or_none(
                tenant_id=tenant_id,
                id=rework_order_data.original_work_order_id,
                deleted_at__isnull=True
            )
            if not original_work_order:
                raise NotFoundError(f"原工单不存在: {rework_order_data.original_work_order_id}")

        start_work_order_operation_id = None
        if rework_order_data.original_work_order_id:
            start_work_order_operation_id = await self._resolve_start_work_order_operation_id(
                tenant_id,
                rework_order_data.original_work_order_id,
                rework_order_data.start_work_order_operation_id,
            )

        async with in_transaction():
            rework_order = await ReworkOrder.create(
                tenant_id=tenant_id,
                uuid=str(uuid.uuid4()),
                code=code,
                original_work_order_id=rework_order_data.original_work_order_id,
                original_work_order_uuid=rework_order_data.original_work_order_uuid,
                start_work_order_operation_id=start_work_order_operation_id,
                product_id=rework_order_data.product_id,
                product_code=rework_order_data.product_code,
                product_name=rework_order_data.product_name,
                quantity=rework_order_data.quantity,
                rework_reason=rework_order_data.rework_reason,
                rework_type=rework_order_data.rework_type,
                route_id=rework_order_data.route_id,
                route_name=rework_order_data.route_name,
                status="draft",
                planned_start_date=rework_order_data.planned_start_date,
                planned_end_date=rework_order_data.planned_end_date,
                work_center_id=rework_order_data.work_center_id,
                work_center_name=rework_order_data.work_center_name,
                operator_id=rework_order_data.operator_id,
                operator_name=rework_order_data.operator_name,
                cost=Decimal("0"),
                remarks=rework_order_data.remarks,
                created_by=created_by,
                created_by_name=user_info["name"],
                updated_by=created_by,
                updated_by_name=user_info["name"],
            )

            if start_work_order_operation_id is not None:
                await self._sync_start_operation_link(
                    tenant_id,
                    rework_order.id,
                    start_work_order_operation_id,
                )

        if rework_order_data.original_work_order_id:
            await self._create_rework_document_relation(
                tenant_id,
                rework_order_data.original_work_order_id,
                rework_order,
                created_by,
            )

        resp = ReworkOrderResponse.model_validate(rework_order)
        resp.rework_operations = await self._get_rework_operations(tenant_id, rework_order.id)
        if original_work_order:
            resp.original_work_order_code = original_work_order.code
        return resp

    async def create_rework_order_from_work_order(
        self,
        tenant_id: int,
        work_order_id: int,
        request_data: ReworkOrderFromWorkOrderRequest,
        created_by: int
    ) -> ReworkOrderResponse:
        """
        从工单创建返工单

        Args:
            tenant_id: 组织ID
            work_order_id: 原工单ID
            request_data: 创建返工单请求数据
            created_by: 创建人ID

        Returns:
            ReworkOrderResponse: 创建的返工单信息

        Raises:
            NotFoundError: 原工单不存在
            ValidationError: 数据验证失败
        """
        # 勿在此处再包 in_transaction：create_rework_order 内部已有事务，嵌套会导致 PostgreSQL 挂起
        original_work_order = await WorkOrder.get_or_none(
            tenant_id=tenant_id,
            id=work_order_id,
            deleted_at__isnull=True
        )
        if not original_work_order:
            raise NotFoundError(f"工单不存在: {work_order_id}")

        if original_work_order.status not in ["completed", "in_progress"]:
            raise BusinessLogicError(f"只有已完成或进行中的工单才能创建返工单，当前工单状态: {original_work_order.status}")

        existing_count = await ReworkOrder.filter(
            tenant_id=tenant_id,
            original_work_order_id=work_order_id,
            deleted_at__isnull=True
        ).count()
        sequence = existing_count + 1

        code = await self.generate_code(
            tenant_id=tenant_id,
            code_type="REWORK_ORDER_CODE",
            prefix=f"返工-{original_work_order.code}-{sequence:03d}"
        )

        if request_data.quantity is not None:
            quantity = request_data.quantity
        else:
            quantity = await self._compute_reworkable_quantity(
                tenant_id, work_order_id, original_work_order
            )
            if quantity <= 0:
                raise ValidationError("该工单已无可返工数量")

        await self._validate_rework_quantity(
            tenant_id, work_order_id, original_work_order, quantity
        )
        if request_data.start_work_order_operation_id is not None:
            await self._validate_rework_operation_ids(
                tenant_id,
                work_order_id,
                [request_data.start_work_order_operation_id],
            )

        rework_order_data = ReworkOrderCreate(
            code=code,
            original_work_order_id=work_order_id,
            original_work_order_uuid=original_work_order.uuid,
            product_id=original_work_order.product_id,
            product_code=original_work_order.product_code,
            product_name=original_work_order.product_name,
            quantity=quantity,
            rework_reason=request_data.rework_reason,
            rework_type=request_data.rework_type,
            route_id=request_data.route_id,
            planned_start_date=request_data.planned_start_date,
            planned_end_date=request_data.planned_end_date,
            work_center_id=request_data.work_center_id or original_work_order.work_center_id,
            work_center_name=original_work_order.work_center_name if not request_data.work_center_id else None,
            start_work_order_operation_id=request_data.start_work_order_operation_id,
            remarks=request_data.remarks,
        )

        return await self.create_rework_order(
            tenant_id=tenant_id,
            rework_order_data=rework_order_data,
            created_by=created_by
        )

    async def get_rework_order_by_id(
        self,
        tenant_id: int,
        rework_order_id: int
    ) -> ReworkOrderResponse:
        """
        根据ID获取返工单

        Args:
            tenant_id: 组织ID
            rework_order_id: 返工单ID

        Returns:
            ReworkOrderResponse: 返工单信息

        Raises:
            NotFoundError: 返工单不存在
        """
        rework_order = await self.get_by_id(tenant_id, rework_order_id, raise_if_not_found=True)
        resp = ReworkOrderResponse.model_validate(rework_order)
        from apps.kuaizhizao.services.document_lifecycle_service import get_rework_order_lifecycle
        resp.lifecycle = get_rework_order_lifecycle(rework_order)
        resp.rework_operations = await self._get_rework_operations(tenant_id, rework_order_id)
        if rework_order.original_work_order_id:
            code_map = await self._load_original_work_order_code_map(
                tenant_id, [rework_order.original_work_order_id]
            )
            self._attach_original_work_order_code(
                resp, code_map, rework_order.original_work_order_id
            )
        return resp

    async def get_rework_order_by_uuid(
        self,
        tenant_id: int,
        rework_order_uuid: str
    ) -> ReworkOrderResponse:
        """
        根据UUID获取返工单

        Args:
            tenant_id: 组织ID
            rework_order_uuid: 返工单UUID

        Returns:
            ReworkOrderResponse: 返工单信息

        Raises:
            NotFoundError: 返工单不存在
        """
        rework_order = await ReworkOrder.get_or_none(
            tenant_id=tenant_id,
            uuid=rework_order_uuid,
            deleted_at__isnull=True
        )
        if not rework_order:
            raise NotFoundError(f"返工单不存在: {rework_order_uuid}")
        resp = ReworkOrderResponse.model_validate(rework_order)
        from apps.kuaizhizao.services.document_lifecycle_service import get_rework_order_lifecycle
        resp.lifecycle = get_rework_order_lifecycle(rework_order)
        if rework_order.original_work_order_id:
            code_map = await self._load_original_work_order_code_map(
                tenant_id, [rework_order.original_work_order_id]
            )
            self._attach_original_work_order_code(
                resp, code_map, rework_order.original_work_order_id
            )
        return resp

    async def list_rework_orders(
        self,
        tenant_id: int,
        skip: int = 0,
        limit: int = 100,
        code: Optional[str] = None,
        original_work_order_id: Optional[int] = None,
        original_work_order_code: Optional[str] = None,
        product_name: Optional[str] = None,
        status: Optional[str] = None,
        rework_type: Optional[str] = None,
        keyword: Optional[str] = None,
        planned_start_from: Optional[date] = None,
        planned_start_to: Optional[date] = None,
        created_start_date: Optional[date] = None,
        created_end_date: Optional[date] = None,
        order_by: Optional[str] = None,
    ) -> Dict[str, Any]:
        """
        获取返工单列表

        Args:
            tenant_id: 组织ID
            skip: 跳过数量
            limit: 限制数量
            code: 返工单编码（模糊搜索）
            original_work_order_id: 原工单ID
            product_name: 产品名称（模糊搜索）
            status: 返工单状态
            rework_type: 返工类型

        Returns:
            List[ReworkOrderListResponse]: 返工单列表
        """
        query = ReworkOrder.filter(
            tenant_id=tenant_id,
            deleted_at__isnull=True
        )

        # 应用过滤条件
        kw = (keyword or "").strip()
        if kw:
            query = query.filter(
                Q(code__icontains=kw)
                | Q(product_name__icontains=kw)
                | Q(product_code__icontains=kw)
            )
        c = (code or "").strip()
        if c:
            query = query.filter(code__icontains=c)
        if original_work_order_id:
            query = query.filter(original_work_order_id=original_work_order_id)
        owc = (original_work_order_code or "").strip()
        if owc:
            matching_ids = await WorkOrder.filter(
                tenant_id=tenant_id,
                deleted_at__isnull=True,
                code__icontains=owc,
            ).values_list("id", flat=True)
            query = query.filter(original_work_order_id__in=list(matching_ids))
        pn = (product_name or "").strip()
        if pn:
            query = query.filter(product_name__icontains=pn)
        if status:
            query = query.filter(status=status)
        if rework_type:
            query = query.filter(rework_type=rework_type)
        if planned_start_from is not None:
            query = query.filter(planned_start_date__gte=planned_start_from)
        if planned_start_to is not None:
            query = query.filter(planned_start_date__lte=planned_start_to)
        if created_start_date is not None:
            query = query.filter(created_at__gte=datetime.combine(created_start_date, time.min))
        if created_end_date is not None:
            query = query.filter(created_at__lte=datetime.combine(created_end_date, time.max))

        total = await query.count()
        order_clause = order_by if order_by else "-created_at"
        rework_orders = await query.offset(skip).limit(limit).order_by(order_clause)
        from apps.kuaizhizao.services.document_lifecycle_service import get_rework_order_lifecycle
        original_ids = [
            ro.original_work_order_id for ro in rework_orders if ro.original_work_order_id
        ]
        code_map = await self._load_original_work_order_code_map(tenant_id, original_ids)
        result = []
        for ro in rework_orders:
            resp = ReworkOrderListResponse.model_validate(ro)
            resp.lifecycle = get_rework_order_lifecycle(ro)
            self._attach_original_work_order_code(resp, code_map, ro.original_work_order_id)
            result.append(resp)
        return {
            "data": [r.model_dump() for r in result],
            "total": total,
            "success": True,
        }

    async def update_rework_order(
        self,
        tenant_id: int,
        rework_order_id: int,
        rework_order_data: ReworkOrderUpdate,
        updated_by: int
    ) -> ReworkOrderResponse:
        """
        更新返工单

        Args:
            tenant_id: 组织ID
            rework_order_id: 返工单ID
            rework_order_data: 返工单更新数据
            updated_by: 更新人ID

        Returns:
            ReworkOrderResponse: 更新后的返工单信息

        Raises:
            NotFoundError: 返工单不存在
            ValidationError: 数据验证失败
        """
        async with in_transaction():
            # 获取返工单
            rework_order = await self.get_by_id(tenant_id, rework_order_id, raise_if_not_found=True)

            # 验证状态（已完成的返工单不允许修改）
            if rework_order.status == "completed":
                raise BusinessLogicError("已完成的返工单不允许修改")

            # 获取更新人信息
            user_info = await self.get_user_info(updated_by)

            # 更新字段
            update_data = rework_order_data.model_dump(exclude_unset=True)
            update_data["updated_by"] = updated_by
            update_data["updated_by_name"] = user_info["name"]

            # 如果状态变更为in_progress，记录实际开始时间
            if "status" in update_data and update_data["status"] == "in_progress" and not rework_order.actual_start_date:
                update_data["actual_start_date"] = resolve_business_datetime()

            # 如果状态变更为completed，记录实际结束时间
            if "status" in update_data and update_data["status"] == "completed" and not rework_order.actual_end_date:
                update_data["actual_end_date"] = resolve_business_datetime()

            await ReworkOrder.filter(
                tenant_id=tenant_id,
                id=rework_order_id
            ).update(**update_data)

            if "start_work_order_operation_id" in update_data:
                start_id = update_data.get("start_work_order_operation_id")
                if rework_order.original_work_order_id and start_id is not None:
                    await self._validate_rework_operation_ids(
                        tenant_id,
                        rework_order.original_work_order_id,
                        [start_id],
                    )
                    await self._sync_start_operation_link(tenant_id, rework_order_id, start_id)

            # 返回更新后的返工单
            updated_rework_order = await self.get_rework_order_by_id(tenant_id, rework_order_id)
            return updated_rework_order

    async def delete_rework_order(
        self,
        tenant_id: int,
        rework_order_id: int
    ) -> bool:
        """
        删除返工单（软删除）

        Args:
            tenant_id: 组织ID
            rework_order_id: 返工单ID

        Returns:
            bool: 删除是否成功

        Raises:
            NotFoundError: 返工单不存在
            BusinessLogicError: 已完成的返工单不允许删除
        """
        async with in_transaction():
            # 获取返工单
            rework_order = await self.get_by_id(tenant_id, rework_order_id, raise_if_not_found=True)

            # 验证状态（已完成的返工单不允许删除）
            if rework_order.status == "completed":
                raise BusinessLogicError("已完成的返工单不允许删除")

            # 软删除
            await ReworkOrder.filter(
                tenant_id=tenant_id,
                id=rework_order_id
            ).update(deleted_at=resolve_business_datetime())

            return True

    async def _get_rework_reporting_summary(
        self,
        tenant_id: int,
        rework_order: ReworkOrder,
    ) -> tuple[bool, Decimal, Decimal]:
        reports = await ReportingRecord.filter(
            tenant_id=tenant_id,
            rework_order_id=rework_order.id,
            deleted_at__isnull=True,
            status__in=["pending", "approved"],
        ).all()
        has_start_report = any(
            r.operation_id == rework_order.start_work_order_operation_id for r in reports
        )
        total_qualified = sum(
            Decimal(str(r.qualified_quantity or 0))
            for r in reports
            if r.status == "approved"
        )
        remaining = max(Decimal("0"), Decimal(str(rework_order.quantity or 0)) - total_qualified)
        return has_start_report, total_qualified, remaining

    async def get_rework_reporting_options(
        self,
        tenant_id: int,
        rework_order_id: int,
    ) -> ReworkReportingOptionsResponse:
        rework_order = await self.get_by_id(tenant_id, rework_order_id, raise_if_not_found=True)
        if not rework_order.original_work_order_id or not rework_order.start_work_order_operation_id:
            raise BusinessLogicError("返工单未配置起始工序，无法报工")
        if rework_order.status in ("draft", "cancelled", "completed"):
            raise BusinessLogicError(f"返工单状态为 {rework_order.status}，无法报工")

        ops = await WorkOrderOperation.filter(
            tenant_id=tenant_id,
            work_order_id=rework_order.original_work_order_id,
            deleted_at__isnull=True,
        ).order_by("sequence", "id").all()

        reports = await ReportingRecord.filter(
            tenant_id=tenant_id,
            rework_order_id=rework_order_id,
            deleted_at__isnull=True,
            status__in=["pending", "approved"],
        ).all()
        reported_by_op: dict[int, Decimal] = {}
        for record in reports:
            op_id = record.operation_id
            reported_by_op[op_id] = reported_by_op.get(op_id, Decimal("0")) + Decimal(
                str(record.reported_quantity or 0)
            )

        has_start_report, total_qualified, remaining = await self._get_rework_reporting_summary(
            tenant_id, rework_order
        )
        start_op = next(
            (op for op in ops if op.id == rework_order.start_work_order_operation_id),
            None,
        )
        operation_items: List[ReworkReportingOptionItem] = []
        for op in ops:
            if op.id is None:
                continue
            selectable = (
                (not has_start_report and op.id == rework_order.start_work_order_operation_id)
                or has_start_report
            )
            operation_items.append(
                ReworkReportingOptionItem(
                    work_order_operation_id=op.id,
                    operation_code=op.operation_code,
                    operation_name=op.operation_name,
                    sequence=op.sequence,
                    is_start_operation=op.id == rework_order.start_work_order_operation_id,
                    reported_quantity=reported_by_op.get(op.id, Decimal("0")),
                    selectable=selectable,
                )
            )

        return ReworkReportingOptionsResponse(
            rework_order_id=rework_order.id,
            rework_order_code=rework_order.code,
            rework_quantity=rework_order.quantity,
            start_work_order_operation_id=rework_order.start_work_order_operation_id,
            start_operation_name=start_op.operation_name if start_op else None,
            has_start_report=has_start_report,
            total_qualified_quantity=total_qualified,
            remaining_rework_quantity=remaining,
            operations=operation_items,
        )

    async def create_rework_reporting(
        self,
        tenant_id: int,
        rework_order_id: int,
        reporting_data: ReworkReportingCreate,
        reported_by: int,
    ) -> ReportingRecordResponse:
        rework_order = await self.get_by_id(tenant_id, rework_order_id, raise_if_not_found=True)
        if not rework_order.original_work_order_id or not rework_order.start_work_order_operation_id:
            raise BusinessLogicError("返工单未配置起始工序，无法报工")
        if rework_order.status in ("draft", "cancelled", "completed"):
            raise BusinessLogicError(f"返工单状态为 {rework_order.status}，无法报工")

        work_order = await WorkOrder.get_or_none(
            tenant_id=tenant_id,
            id=rework_order.original_work_order_id,
            deleted_at__isnull=True,
        )
        if not work_order:
            raise NotFoundError(f"原工单不存在: {rework_order.original_work_order_id}")

        work_order_operation = await WorkOrderOperation.get_or_none(
            tenant_id=tenant_id,
            id=reporting_data.work_order_operation_id,
            work_order_id=rework_order.original_work_order_id,
            deleted_at__isnull=True,
        )
        if not work_order_operation:
            raise ValidationError("所选工序不属于原工单或不存在")

        has_start_report, total_qualified, remaining = await self._get_rework_reporting_summary(
            tenant_id, rework_order
        )
        if not has_start_report and reporting_data.work_order_operation_id != rework_order.start_work_order_operation_id:
            raise BusinessLogicError("首次报工必须在返工起始工序上进行")

        reported_qty = Decimal(str(reporting_data.reported_quantity))
        qualified_qty = Decimal(str(reporting_data.qualified_quantity))
        unqualified_qty = Decimal(str(reporting_data.unqualified_quantity))
        if reported_qty <= 0:
            raise ValidationError("报工数量必须大于 0")
        if qualified_qty + unqualified_qty != reported_qty:
            raise ValidationError("合格数量 + 不合格数量必须等于报工数量")
        if total_qualified + qualified_qty > Decimal(str(rework_order.quantity or 0)):
            raise BusinessLogicError(
                f"返工合格数量不能超过返工数量（{rework_order.quantity}）"
            )

        wh = Decimal(str(reporting_data.work_hours or 0))
        if wh < 0:
            raise ValidationError("报工工时不能为负数")

        if reporting_data.reported_at:
            if is_future_datetime(reporting_data.reported_at):
                raise ValidationError("报工时间不能晚于当前时间")

        user_info = await self.get_user_info(reported_by)
        recorder_name = user_info.get("name")

        biz_config = await self.business_config_service.get_business_config(tenant_id)
        reporting_params = biz_config.get("parameters", {}).get("reporting", {})
        reporting_audit_required = await self.business_config_service.check_audit_required(
            tenant_id, "reporting_record"
        )
        auto_approve = reporting_params.get("auto_approve", False)
        should_auto_approve = (not reporting_audit_required) or bool(auto_approve)

        status = "pending"
        approved_at = None
        approved_by = None
        approved_by_name = None
        if should_auto_approve:
            status = "approved"
            approved_at = resolve_business_datetime()
            approved_by = reported_by
            approved_by_name = recorder_name or reporting_data.worker_name

        async with in_transaction():
            reporting_record = await ReportingRecord.create(
                tenant_id=tenant_id,
                uuid=str(uuid.uuid4()),
                work_order_id=work_order.id,
                rework_order_id=rework_order.id,
                work_order_code=work_order.code,
                work_order_name=work_order.name,
                operation_id=work_order_operation.id,
                operation_code=work_order_operation.operation_code,
                operation_name=work_order_operation.operation_name,
                worker_id=reporting_data.worker_id,
                worker_name=reporting_data.worker_name,
                recorded_by=int(reported_by),
                recorded_by_name=recorder_name,
                reported_quantity=reported_qty,
                qualified_quantity=qualified_qty,
                unqualified_quantity=unqualified_qty,
                work_hours=wh,
                status=status,
                reported_at=reporting_data.reported_at,
                remarks=reporting_data.remarks,
                approved_at=approved_at,
                approved_by=approved_by,
                approved_by_name=approved_by_name,
            )

            if rework_order.status == "released":
                rework_order.status = "in_progress"
                rework_order.actual_start_date = rework_order.actual_start_date or resolve_business_datetime()
            new_total_qualified = total_qualified + (
                qualified_qty if status == "approved" else Decimal("0")
            )
            if new_total_qualified >= Decimal(str(rework_order.quantity or 0)):
                rework_order.status = "completed"
                rework_order.actual_end_date = rework_order.actual_end_date or resolve_business_datetime()
            rework_order.updated_by = reported_by
            rework_order.updated_by_name = recorder_name
            await rework_order.save()

        return ReportingRecordResponse.model_validate(reporting_record)
