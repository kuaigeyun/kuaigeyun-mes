"""
异常处理服务模块

提供异常处理相关的业务逻辑，包括缺料异常、延期异常、质量异常等。

Author: Luigi Lu
Date: 2025-01-15
"""

from datetime import date, datetime, time
from typing import List, Optional
from decimal import Decimal

from tortoise.queryset import Q

from apps.kuaizhizao.models.material_shortage_exception import MaterialShortageException
from apps.kuaizhizao.models.delivery_delay_exception import DeliveryDelayException
from apps.kuaizhizao.models.quality_exception import QualityException
from apps.kuaizhizao.models.work_order import WorkOrder
from apps.kuaizhizao.schemas.material_shortage_exception import (
    MaterialShortageExceptionCreate,
    MaterialShortageExceptionUpdate,
    MaterialShortageExceptionResponse,
    MaterialShortageExceptionListResponse,
)
from apps.kuaizhizao.schemas.quality_exception import (
    QualityExceptionResponse,
    QualityExceptionListResponse,
)
from apps.kuaizhizao.schemas.delivery_delay_exception import (
    DeliveryDelayExceptionResponse,
    DeliveryDelayExceptionListResponse,
)
from apps.common.base_service import AppBaseService
from apps.kuaizhizao.services.work_order_service import WorkOrderService, WORK_ORDER_IN_PROGRESS_STATUS
from infra.exceptions.exceptions import NotFoundError, ValidationError
from loguru import logger

# 待处理异常状态（与模型字段一致；勿使用 open）
ACTIVE_EXCEPTION_STATUSES = ("pending", "processing")
ACTIVE_QUALITY_EXCEPTION_STATUSES = ("pending", "investigating", "correcting")

MATERIAL_SHORTAGE_SORTABLE_FIELDS = frozenset({
    "work_order_code",
    "material_code",
    "material_name",
    "required_quantity",
    "available_quantity",
    "shortage_quantity",
    "alert_level",
    "status",
    "suggested_action",
    "created_at",
    "handled_at",
})

DELIVERY_DELAY_SORTABLE_FIELDS = frozenset({
    "work_order_code",
    "planned_end_date",
    "delay_days",
    "delay_reason",
    "alert_level",
    "status",
    "suggested_action",
    "created_at",
    "handled_at",
})

QUALITY_EXCEPTION_SORTABLE_FIELDS = frozenset({
    "exception_type",
    "work_order_code",
    "material_code",
    "material_name",
    "batch_no",
    "problem_description",
    "severity",
    "status",
    "responsible_person_name",
    "created_at",
    "handled_at",
})


def _material_shortage_alert_level(shortage_qty: Decimal, required_qty: Decimal) -> str:
    shortage_rate = float(shortage_qty / required_qty) if required_qty > 0 else 0
    if shortage_rate >= 0.8:
        return "critical"
    if shortage_rate >= 0.5:
        return "high"
    if shortage_rate >= 0.3:
        return "medium"
    return "low"


def apply_exception_status_filter(query, *, status: Optional[str], statuses: Optional[str]):
    if status and statuses:
        raise ValidationError("status 与 statuses 不能同时指定")
    if status:
        return query.filter(status=status)
    if statuses:
        parts = [part.strip() for part in statuses.split(",") if part.strip()]
        if not parts:
            raise ValidationError("statuses 不能为空")
        return query.filter(status__in=parts)
    return query


class ExceptionService:
    """
    异常处理服务类

    处理各种异常相关的业务逻辑。
    """

    def __init__(self):
        self.work_order_service = WorkOrderService()

    async def detect_material_shortage(
        self,
        tenant_id: int,
        work_order_id: Optional[int] = None,
    ) -> List[MaterialShortageExceptionResponse]:
        """
        检测在制工单缺料并创建/更新缺料异常记录；不再缺料的开放记录自动结案。
        检测口径与 WorkOrderService.check_material_shortage 一致。
        """
        if work_order_id is not None:
            work_order_ids = [work_order_id]
        else:
            work_orders = await WorkOrder.filter(
                tenant_id=tenant_id,
                status__in=list(WORK_ORDER_IN_PROGRESS_STATUS),
                deleted_at__isnull=True,
            ).all()
            work_order_ids = [wo.id for wo in work_orders]

        exceptions: List[MaterialShortageExceptionResponse] = []
        current_shortage_keys: set[tuple[int, int]] = set()

        for wo_id in work_order_ids:
            try:
                result = await self.work_order_service.check_material_shortage(
                    tenant_id=tenant_id,
                    work_order_id=wo_id,
                )
            except NotFoundError:
                continue

            work_order_code = result.get("work_order_code", "")
            for item in result.get("shortage_items", []):
                material_id = int(item["material_id"])
                current_shortage_keys.add((wo_id, material_id))
                required_qty = Decimal(str(item["required_quantity"]))
                available_qty = Decimal(str(item["available_quantity"]))
                shortage_qty = Decimal(str(item["shortage_quantity"]))
                alert_level = _material_shortage_alert_level(shortage_qty, required_qty)

                existing = await MaterialShortageException.filter(
                    tenant_id=tenant_id,
                    work_order_id=wo_id,
                    material_id=material_id,
                    status__in=ACTIVE_EXCEPTION_STATUSES,
                    deleted_at__isnull=True,
                ).first()

                if not existing:
                    exception = await MaterialShortageException.create(
                        tenant_id=tenant_id,
                        work_order_id=wo_id,
                        work_order_code=work_order_code,
                        material_id=material_id,
                        material_code=item.get("material_code", ""),
                        material_name=item.get("material_name", ""),
                        shortage_quantity=shortage_qty,
                        available_quantity=available_qty,
                        required_quantity=required_qty,
                        alert_level=alert_level,
                        status="pending",
                        suggested_action="purchase",
                    )
                    exceptions.append(MaterialShortageExceptionResponse.model_validate(exception))
                else:
                    existing.shortage_quantity = shortage_qty
                    existing.available_quantity = available_qty
                    existing.required_quantity = required_qty
                    existing.alert_level = alert_level
                    existing.work_order_code = work_order_code
                    await existing.save()
                    exceptions.append(MaterialShortageExceptionResponse.model_validate(existing))

        stale_query = MaterialShortageException.filter(
            tenant_id=tenant_id,
            status__in=ACTIVE_EXCEPTION_STATUSES,
            deleted_at__isnull=True,
        )
        if work_order_id is not None:
            stale_query = stale_query.filter(work_order_id=work_order_id)
        for stale in await stale_query:
            if (stale.work_order_id, stale.material_id) not in current_shortage_keys:
                stale.status = "resolved"
                await stale.save()

        return exceptions

    async def list_material_shortage_exceptions(
        self,
        tenant_id: int,
        work_order_id: Optional[int] = None,
        status: Optional[str] = None,
        statuses: Optional[str] = None,
        alert_level: Optional[str] = None,
        skip: int = 0,
        limit: int = 100,
        keyword: Optional[str] = None,
        work_order_code: Optional[str] = None,
        material_code: Optional[str] = None,
        material_name: Optional[str] = None,
        created_start_date: Optional[date] = None,
        created_end_date: Optional[date] = None,
        order_by: Optional[str] = None,
    ) -> tuple[List[MaterialShortageExceptionListResponse], int]:
        """
        获取缺料异常列表（只读已持久化记录，不在列表请求中触发全量缺料检测）。

        缺料检测由定时任务 / 显式 detect API 写入；列表接口仅查询数据库。

        Args:
            tenant_id: 租户ID
            work_order_id: 工单ID筛选（可选）
            status: 状态筛选（可选）
            alert_level: 预警级别筛选（可选）
            skip: 跳过数量
            limit: 限制数量

        Returns:
            (列表, 总数)
        """
        query = MaterialShortageException.filter(
            tenant_id=tenant_id,
            deleted_at__isnull=True,
        )

        if work_order_id:
            query = query.filter(work_order_id=work_order_id)
        query = apply_exception_status_filter(query, status=status, statuses=statuses)
        if alert_level:
            query = query.filter(alert_level=alert_level)

        kw = (keyword or "").strip()
        if kw:
            query = query.filter(
                Q(work_order_code__icontains=kw)
                | Q(material_code__icontains=kw)
                | Q(material_name__icontains=kw)
            )
        woc = (work_order_code or "").strip()
        if woc:
            query = query.filter(work_order_code__icontains=woc)
        mc = (material_code or "").strip()
        if mc:
            query = query.filter(material_code__icontains=mc)
        mn = (material_name or "").strip()
        if mn:
            query = query.filter(material_name__icontains=mn)
        if created_start_date is not None:
            query = query.filter(created_at__gte=datetime.combine(created_start_date, time.min))
        if created_end_date is not None:
            query = query.filter(created_at__lte=datetime.combine(created_end_date, time.max))

        total = await query.count()
        order_clause = order_by if order_by else "-created_at"
        exceptions = await query.order_by(order_clause).offset(skip).limit(limit)
        rows = [MaterialShortageExceptionListResponse.model_validate(e) for e in exceptions]

        if rows:
            from apps.kuaizhizao.services.work_order_score_service import WorkOrderScoreService

            score_svc = WorkOrderScoreService()
            if await score_svc.is_score_enabled(tenant_id):
                wo_ids = list({r.work_order_id for r in rows if r.work_order_id})
                score_map = await score_svc.batch_ensure_scores(
                    tenant_id, wo_ids, "picking", include_kitting=True
                )
                enriched: List[MaterialShortageExceptionListResponse] = []
                for row in rows:
                    cached = score_map.get(row.work_order_id)
                    if cached:
                        enriched.append(
                            row.model_copy(
                                update={
                                    "picking_score": cached.composite_score,
                                    "picking_rank_band": cached.rank_band,
                                }
                            )
                        )
                    else:
                        enriched.append(row)
                return enriched, total

        return rows, total

    async def handle_material_shortage_exception(
        self,
        tenant_id: int,
        exception_id: int,
        handled_by: int,
        action: str,
        alternative_material_id: Optional[int] = None,
        remarks: Optional[str] = None,
    ) -> MaterialShortageExceptionResponse:
        """
        处理缺料异常

        Args:
            tenant_id: 租户ID
            exception_id: 异常记录ID
            handled_by: 处理人ID
            action: 处理操作（purchase/substitute/resolve/cancel）
            alternative_material_id: 替代物料ID（如果action为substitute）
            remarks: 备注

        Returns:
            MaterialShortageExceptionResponse: 更新后的异常记录
        """
        exception = await MaterialShortageException.get_or_none(
            id=exception_id,
            tenant_id=tenant_id,
        )
        if not exception:
            raise NotFoundError("缺料异常记录不存在")

        # 获取处理人信息
        user_info = await self.work_order_service.get_user_info(handled_by)

        # 更新异常记录
        if action == "substitute" and alternative_material_id:
            # TODO: 获取替代物料信息
            exception.alternative_material_id = alternative_material_id
            exception.suggested_action = "substitute"
        elif action == "purchase":
            exception.suggested_action = "purchase"
        elif action == "resolve":
            exception.status = "resolved"
        elif action == "cancel":
            exception.status = "cancelled"

        exception.handled_by = handled_by
        exception.handled_by_name = user_info["name"]
        exception.handled_at = datetime.now()
        if remarks:
            exception.remarks = remarks

        await exception.save()

        return MaterialShortageExceptionResponse.model_validate(exception)

    async def detect_delivery_delay(
        self,
        tenant_id: int,
        work_order_id: Optional[int] = None,
        days_threshold: int = 0,
    ) -> List[DeliveryDelayExceptionResponse]:
        """
        检测工单交期延期并创建/更新延期异常记录；不再延期的开放记录自动结案。
        """
        delayed_orders = await self.work_order_service.check_delayed_work_orders(
            tenant_id=tenant_id,
            days_threshold=days_threshold,
        )

        if work_order_id:
            delayed_orders = [wo for wo in delayed_orders if wo["work_order_id"] == work_order_id]

        delayed_ids = {order["work_order_id"] for order in delayed_orders}
        exceptions: List[DeliveryDelayExceptionResponse] = []

        for order in delayed_orders:
            delay_days = order.get("delay_days", 0)

            if delay_days >= 7:
                alert_level = "critical"
            elif delay_days >= 3:
                alert_level = "high"
            elif delay_days >= 1:
                alert_level = "medium"
            else:
                alert_level = "low"

            delay_reason = order.get("delay_reason") or "计划完工日期已过"
            if "缺料" in delay_reason or "物料" in delay_reason:
                suggested_action = "expedite"
            elif "产能" in delay_reason or "资源" in delay_reason:
                suggested_action = "increase_resources"
            else:
                suggested_action = "adjust_plan"

            existing = await DeliveryDelayException.filter(
                tenant_id=tenant_id,
                work_order_id=order["work_order_id"],
                status__in=ACTIVE_EXCEPTION_STATUSES,
                deleted_at__isnull=True,
            ).first()

            if not existing:
                exception = await DeliveryDelayException.create(
                    tenant_id=tenant_id,
                    work_order_id=order["work_order_id"],
                    work_order_code=order.get("work_order_code", ""),
                    planned_end_date=order["planned_end_date"],
                    actual_end_date=order.get("actual_end_date"),
                    delay_days=delay_days,
                    delay_reason=delay_reason,
                    alert_level=alert_level,
                    status="pending",
                    suggested_action=suggested_action,
                )
                exceptions.append(DeliveryDelayExceptionResponse.model_validate(exception))
            else:
                existing.delay_days = delay_days
                existing.delay_reason = delay_reason
                existing.alert_level = alert_level
                existing.suggested_action = suggested_action
                existing.planned_end_date = order["planned_end_date"]
                existing.actual_end_date = order.get("actual_end_date")
                await existing.save()
                exceptions.append(DeliveryDelayExceptionResponse.model_validate(existing))

        stale_query = DeliveryDelayException.filter(
            tenant_id=tenant_id,
            status__in=ACTIVE_EXCEPTION_STATUSES,
            deleted_at__isnull=True,
        )
        if work_order_id:
            stale_query = stale_query.filter(work_order_id=work_order_id)
        for stale in await stale_query:
            if stale.work_order_id not in delayed_ids:
                stale.status = "resolved"
                await stale.save()

        return exceptions

    async def list_delivery_delay_exceptions(
        self,
        tenant_id: int,
        work_order_id: Optional[int] = None,
        status: Optional[str] = None,
        statuses: Optional[str] = None,
        alert_level: Optional[str] = None,
        skip: int = 0,
        limit: int = 100,
        keyword: Optional[str] = None,
        work_order_code: Optional[str] = None,
        delay_reason: Optional[str] = None,
        created_start_date: Optional[date] = None,
        created_end_date: Optional[date] = None,
        order_by: Optional[str] = None,
    ) -> tuple[List[DeliveryDelayExceptionListResponse], int]:
        """
        获取延期异常列表

        Args:
            tenant_id: 租户ID
            work_order_id: 工单ID筛选（可选）
            status: 状态筛选（可选）
            alert_level: 预警级别筛选（可选）
            skip: 跳过数量
            limit: 限制数量

        Returns:
            (列表, 总数)
        """
        await self.detect_delivery_delay(
            tenant_id=tenant_id,
            work_order_id=work_order_id,
        )

        query = DeliveryDelayException.filter(tenant_id=tenant_id, deleted_at__isnull=True)

        if work_order_id:
            query = query.filter(work_order_id=work_order_id)
        query = apply_exception_status_filter(query, status=status, statuses=statuses)
        if alert_level:
            query = query.filter(alert_level=alert_level)

        kw = (keyword or "").strip()
        if kw:
            query = query.filter(
                Q(work_order_code__icontains=kw) | Q(delay_reason__icontains=kw)
            )
        woc = (work_order_code or "").strip()
        if woc:
            query = query.filter(work_order_code__icontains=woc)
        dr = (delay_reason or "").strip()
        if dr:
            query = query.filter(delay_reason__icontains=dr)
        if created_start_date is not None:
            query = query.filter(created_at__gte=datetime.combine(created_start_date, time.min))
        if created_end_date is not None:
            query = query.filter(created_at__lte=datetime.combine(created_end_date, time.max))

        total = await query.count()
        order_clause = order_by if order_by else "-created_at"
        exceptions = await query.order_by(order_clause).offset(skip).limit(limit)
        rows = [DeliveryDelayExceptionListResponse.model_validate(e) for e in exceptions]
        return rows, total

    async def handle_delivery_delay_exception(
        self,
        tenant_id: int,
        exception_id: int,
        handled_by: int,
        action: str,
        remarks: Optional[str] = None,
    ) -> DeliveryDelayExceptionResponse:
        """
        处理延期异常

        Args:
            tenant_id: 租户ID
            exception_id: 异常记录ID
            handled_by: 处理人ID
            action: 处理操作（adjust_plan/increase_resources/expedite/resolve/cancel）
            remarks: 备注

        Returns:
            DeliveryDelayExceptionResponse: 更新后的异常记录
        """
        exception = await DeliveryDelayException.get_or_none(
            id=exception_id,
            tenant_id=tenant_id,
        )
        if not exception:
            raise NotFoundError("延期异常记录不存在")

        # 获取处理人信息
        user_info = await self.work_order_service.get_user_info(handled_by)

        # 更新异常记录
        if action == "adjust_plan":
            exception.suggested_action = "adjust_plan"
            exception.status = "processing"
        elif action == "increase_resources":
            exception.suggested_action = "increase_resources"
            exception.status = "processing"
        elif action == "expedite":
            exception.suggested_action = "expedite"
            exception.status = "processing"
        elif action == "resolve":
            exception.status = "resolved"
        elif action == "cancel":
            exception.status = "cancelled"

        exception.handled_by = handled_by
        exception.handled_by_name = user_info["name"]
        exception.handled_at = datetime.now()
        if remarks:
            exception.remarks = remarks

        await exception.save()

        return DeliveryDelayExceptionResponse.model_validate(exception)

    async def list_quality_exceptions(
        self,
        tenant_id: int,
        exception_type: Optional[str] = None,
        work_order_id: Optional[int] = None,
        status: Optional[str] = None,
        statuses: Optional[str] = None,
        severity: Optional[str] = None,
        inspection_record_id: Optional[int] = None,
        inspection_source_type: Optional[str] = None,
        skip: int = 0,
        limit: int = 100,
        keyword: Optional[str] = None,
        work_order_code: Optional[str] = None,
        material_code: Optional[str] = None,
        material_name: Optional[str] = None,
        batch_no: Optional[str] = None,
        created_start_date: Optional[date] = None,
        created_end_date: Optional[date] = None,
        order_by: Optional[str] = None,
    ) -> tuple[List[QualityExceptionListResponse], int]:
        """
        获取质量异常列表

        Args:
            tenant_id: 租户ID
            exception_type: 异常类型筛选（可选）
            work_order_id: 工单ID筛选（可选）
            status: 状态筛选（可选）
            severity: 严重程度筛选（可选）
            skip: 跳过数量
            limit: 限制数量

        Returns:
            (列表, 总数)
        """
        query = QualityException.filter(tenant_id=tenant_id, deleted_at__isnull=True)

        if exception_type:
            query = query.filter(exception_type=exception_type)
        if work_order_id:
            query = query.filter(work_order_id=work_order_id)
        query = apply_exception_status_filter(query, status=status, statuses=statuses)
        if severity:
            query = query.filter(severity=severity)
        if inspection_record_id:
            query = query.filter(inspection_record_id=inspection_record_id)
        if inspection_source_type:
            query = query.filter(inspection_source_type=inspection_source_type)

        kw = (keyword or "").strip()
        if kw:
            query = query.filter(
                Q(work_order_code__icontains=kw)
                | Q(material_code__icontains=kw)
                | Q(material_name__icontains=kw)
                | Q(batch_no__icontains=kw)
                | Q(problem_description__icontains=kw)
            )
        woc = (work_order_code or "").strip()
        if woc:
            query = query.filter(work_order_code__icontains=woc)
        mc = (material_code or "").strip()
        if mc:
            query = query.filter(material_code__icontains=mc)
        mn = (material_name or "").strip()
        if mn:
            query = query.filter(material_name__icontains=mn)
        bn = (batch_no or "").strip()
        if bn:
            query = query.filter(batch_no__icontains=bn)
        if created_start_date is not None:
            query = query.filter(created_at__gte=datetime.combine(created_start_date, time.min))
        if created_end_date is not None:
            query = query.filter(created_at__lte=datetime.combine(created_end_date, time.max))

        total = await query.count()
        order_clause = order_by if order_by else "-created_at"
        exceptions = await query.order_by(order_clause).offset(skip).limit(limit)
        return [QualityExceptionListResponse.model_validate(e) for e in exceptions], total

    async def create_from_inspection(
        self,
        tenant_id: int,
        source_type: str,
        source_id: int,
        created_by: Optional[int] = None,
        problem_description: Optional[str] = None,
        severity: str = "major",
        remarks: Optional[str] = None,
    ) -> QualityExceptionResponse:
        """
        从检验单创建质量异常记录。

        source_type: incoming_inspection | process_inspection | finished_goods_inspection | oqc_inspection
        """
        import uuid

        work_order_id = None
        work_order_code = None
        material_id = None
        material_code = None
        material_name = None
        batch_no = None
        desc = problem_description

        if source_type == "incoming_inspection":
            from apps.kuaizhizao.models.incoming_inspection import IncomingInspection

            insp = await IncomingInspection.get_or_none(
                tenant_id=tenant_id, id=source_id, deleted_at__isnull=True
            )
            if not insp:
                raise NotFoundError(f"来料检验单不存在: {source_id}")
            material_id = insp.material_id
            material_code = insp.material_code
            material_name = insp.material_name
            if not desc:
                desc = insp.nonconformance_reason or f"来料检验不合格：{insp.inspection_code}"
        elif source_type == "process_inspection":
            from apps.kuaizhizao.models.process_inspection import ProcessInspection

            insp = await ProcessInspection.get_or_none(
                tenant_id=tenant_id, id=source_id, deleted_at__isnull=True
            )
            if not insp:
                raise NotFoundError(f"过程检验单不存在: {source_id}")
            work_order_id = insp.work_order_id
            work_order_code = insp.work_order_code
            material_id = insp.material_id
            material_code = insp.material_code
            material_name = insp.material_name
            batch_no = insp.batch_number
            if not desc:
                desc = insp.nonconformance_reason or f"过程检验不合格：{insp.inspection_code}"
        elif source_type == "finished_goods_inspection":
            from apps.kuaizhizao.models.finished_goods_inspection import FinishedGoodsInspection

            insp = await FinishedGoodsInspection.get_or_none(
                tenant_id=tenant_id, id=source_id, deleted_at__isnull=True
            )
            if not insp:
                raise NotFoundError(f"成品检验单不存在: {source_id}")
            work_order_id = insp.work_order_id
            work_order_code = insp.work_order_code
            material_id = insp.material_id
            material_code = insp.material_code
            material_name = insp.material_name
            batch_no = insp.batch_number
            if not desc:
                desc = insp.nonconformance_reason or f"成品检验不合格：{insp.inspection_code}"
        elif source_type == "oqc_inspection":
            from apps.kuaizhizao.models.oqc_inspection import OQCInspection

            insp = await OQCInspection.get_or_none(
                tenant_id=tenant_id, id=source_id, deleted_at__isnull=True
            )
            if not insp:
                raise NotFoundError(f"出货检验单不存在: {source_id}")
            material_id = insp.material_id
            material_code = insp.material_code
            material_name = insp.material_name
            batch_no = insp.batch_number
            if not desc:
                desc = f"出货检验不合格：{insp.inspection_code}"
        else:
            raise ValidationError(f"不支持的检验来源类型: {source_type}")

        exception = await QualityException.create(
            uuid=str(uuid.uuid4()),
            tenant_id=tenant_id,
            exception_type="inspection_failure",
            work_order_id=work_order_id,
            work_order_code=work_order_code,
            material_id=material_id,
            material_code=material_code,
            material_name=material_name,
            batch_no=batch_no,
            inspection_record_id=source_id,
            inspection_source_type=source_type,
            problem_description=desc,
            severity=severity,
            status="pending",
            remarks=remarks,
        )
        logger.info(
            "从检验单创建质量异常: source=%s#%s exception_id=%s",
            source_type,
            source_id,
            exception.id,
        )
        return QualityExceptionResponse.model_validate(exception)

    async def handle_quality_exception(
        self,
        tenant_id: int,
        exception_id: int,
        handled_by: int,
        action: str,
        root_cause: Optional[str] = None,
        corrective_action: Optional[str] = None,
        preventive_action: Optional[str] = None,
        responsible_person_id: Optional[int] = None,
        responsible_person_name: Optional[str] = None,
        planned_completion_date: Optional[datetime] = None,
        verification_result: Optional[str] = None,
        remarks: Optional[str] = None,
    ) -> QualityExceptionResponse:
        """
        处理质量异常

        Args:
            tenant_id: 租户ID
            exception_id: 异常记录ID
            handled_by: 处理人ID
            action: 处理操作（investigate/correct/close/cancel）
            root_cause: 根本原因（可选）
            corrective_action: 纠正措施（可选）
            preventive_action: 预防措施（可选）
            responsible_person_id: 责任人ID（可选）
            responsible_person_name: 责任人姓名（可选）
            planned_completion_date: 计划完成日期（可选）
            verification_result: 验证结果（可选）
            remarks: 备注（可选）

        Returns:
            QualityExceptionResponse: 更新后的异常记录
        """
        exception = await QualityException.get_or_none(
            id=exception_id,
            tenant_id=tenant_id,
        )
        if not exception:
            raise NotFoundError("质量异常记录不存在")

        # 获取处理人信息
        user_info = await self.work_order_service.get_user_info(handled_by)

        # 更新异常记录
        if action == "investigate":
            exception.status = "investigating"
            if root_cause:
                exception.root_cause = root_cause
        elif action == "correct":
            exception.status = "correcting"
            if corrective_action:
                exception.corrective_action = corrective_action
            if preventive_action:
                exception.preventive_action = preventive_action
            if responsible_person_id:
                exception.responsible_person_id = responsible_person_id
            if responsible_person_name:
                exception.responsible_person_name = responsible_person_name
            if planned_completion_date:
                exception.planned_completion_date = planned_completion_date
        elif action == "close":
            exception.status = "closed"
            exception.actual_completion_date = datetime.now()
            if verification_result:
                exception.verification_result = verification_result
        elif action == "cancel":
            exception.status = "cancelled"

        exception.handled_by = handled_by
        exception.handled_by_name = user_info["name"]
        exception.handled_at = datetime.now()
        if remarks:
            exception.remarks = remarks

        await exception.save()

        return QualityExceptionResponse.model_validate(exception)

    async def get_exception_statistics(
        self,
        tenant_id: int,
        date_start: Optional[datetime] = None,
        date_end: Optional[datetime] = None,
    ) -> dict:
        """
        获取异常统计分析

        Args:
            tenant_id: 租户ID
            date_start: 开始日期（可选）
            date_end: 结束日期（可选）

        Returns:
            dict: 异常统计数据
        """
        # 缺料异常统计
        material_shortage_query = MaterialShortageException.filter(tenant_id=tenant_id)
        if date_start:
            material_shortage_query = material_shortage_query.filter(created_at__gte=date_start)
        if date_end:
            material_shortage_query = material_shortage_query.filter(created_at__lte=date_end)
        
        material_shortage_total = await material_shortage_query.count()
        material_shortage_pending = await material_shortage_query.filter(status="pending").count()
        material_shortage_resolved = await material_shortage_query.filter(status="resolved").count()
        material_shortage_by_level = {}
        for level in ["low", "medium", "high", "critical"]:
            count = await material_shortage_query.filter(alert_level=level).count()
            if count > 0:
                material_shortage_by_level[level] = count

        # 延期异常统计
        delivery_delay_query = DeliveryDelayException.filter(tenant_id=tenant_id)
        if date_start:
            delivery_delay_query = delivery_delay_query.filter(created_at__gte=date_start)
        if date_end:
            delivery_delay_query = delivery_delay_query.filter(created_at__lte=date_end)
        
        delivery_delay_total = await delivery_delay_query.count()
        delivery_delay_pending = await delivery_delay_query.filter(status="pending").count()
        delivery_delay_resolved = await delivery_delay_query.filter(status="resolved").count()
        delivery_delay_by_level = {}
        for level in ["low", "medium", "high", "critical"]:
            count = await delivery_delay_query.filter(alert_level=level).count()
            if count > 0:
                delivery_delay_by_level[level] = count

        # 质量异常统计
        quality_query = QualityException.filter(tenant_id=tenant_id)
        if date_start:
            quality_query = quality_query.filter(created_at__gte=date_start)
        if date_end:
            quality_query = quality_query.filter(created_at__lte=date_end)
        
        quality_total = await quality_query.count()
        quality_pending = await quality_query.filter(status="pending").count()
        quality_closed = await quality_query.filter(status="closed").count()
        quality_by_severity = {}
        for severity in ["minor", "major", "critical"]:
            count = await quality_query.filter(severity=severity).count()
            if count > 0:
                quality_by_severity[severity] = count

        # 总体统计
        total_exceptions = material_shortage_total + delivery_delay_total + quality_total
        total_pending = material_shortage_pending + delivery_delay_pending + quality_pending
        total_resolved = material_shortage_resolved + delivery_delay_resolved + quality_closed

        return {
            "summary": {
                "total_exceptions": total_exceptions,
                "total_pending": total_pending,
                "total_resolved": total_resolved,
                "resolution_rate": round(total_resolved / total_exceptions * 100, 2) if total_exceptions > 0 else 0,
            },
            "material_shortage": {
                "total": material_shortage_total,
                "pending": material_shortage_pending,
                "resolved": material_shortage_resolved,
                "by_level": material_shortage_by_level,
            },
            "delivery_delay": {
                "total": delivery_delay_total,
                "pending": delivery_delay_pending,
                "resolved": delivery_delay_resolved,
                "by_level": delivery_delay_by_level,
            },
            "quality": {
                "total": quality_total,
                "pending": quality_pending,
                "closed": quality_closed,
                "by_severity": quality_by_severity,
            },
        }

