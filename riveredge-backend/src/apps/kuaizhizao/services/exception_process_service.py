"""
异常处理流程服务模块

提供异常处理流程相关的业务逻辑，包括异常处理流程启动、步骤流转、历史记录等。

Author: Luigi Lu
Date: 2026-01-16
"""

from datetime import datetime, date, time
from typing import List, Optional, Dict, Any
from loguru import logger

from apps.kuaizhizao.models.exception_process_record import (
    ExceptionProcessRecord,
    ExceptionProcessHistory,
)
from apps.kuaizhizao.models.material_shortage_exception import MaterialShortageException
from apps.kuaizhizao.models.delivery_delay_exception import DeliveryDelayException
from apps.kuaizhizao.models.quality_exception import QualityException
from apps.kuaizhizao.schemas.exception_process_record import (
    ExceptionProcessRecordCreate,
    ExceptionProcessRecordUpdate,
    ExceptionProcessRecordResponse,
    ExceptionProcessRecordListResponse,
    ExceptionProcessRecordDetailResponse,
    ExceptionProcessHistoryCreate,
    ExceptionProcessHistoryResponse,
    ExceptionProcessStepTransitionRequest,
    ExceptionProcessAssignRequest,
    ExceptionProcessResolveRequest,
)
from apps.common.base_service import AppBaseService
from apps.kuaizhizao.services.work_order_service import WorkOrderService
from apps.kuaizhizao.services.exception_service import ExceptionService
from apps.kuaizhizao.services.document_action_policy.exception_process_record import (
    assert_exception_process_record_capability,
)
from apps.kuaizhizao.services.document_action_policy.enricher import (
    enrich_exception_process_record_capabilities_on_response,
    enrich_exception_process_record_list_capabilities,
)
from infra.exceptions.exceptions import NotFoundError, ValidationError
from core.tasks.dispatcher import TaskEvent, dispatch_event
from tortoise.queryset import Q
from core.utils.timezone_utils import resolve_business_datetime

EXCEPTION_PROCESS_SORTABLE_FIELDS = frozenset({
    "exception_type",
    "exception_id",
    "process_status",
    "current_step",
    "assigned_to_name",
    "started_at",
    "completed_at",
    "created_at",
})


async def _load_work_order_ref_map(
    tenant_id: int,
    records: List[ExceptionProcessRecord],
) -> Dict[tuple[str, int], Dict[str, Any]]:
    """按异常类型批量解析源异常上的工单编号与工单ID。"""
    ids_by_type: Dict[str, List[int]] = {}
    for record in records:
        et = str(record.exception_type or "").strip()
        eid = record.exception_id
        if not et or eid is None:
            continue
        ids_by_type.setdefault(et, []).append(int(eid))

    ref_map: Dict[tuple[str, int], Dict[str, Any]] = {}
    for exception_type, ids in ids_by_type.items():
        unique_ids = list(dict.fromkeys(ids))
        if exception_type == "material_shortage":
            rows = await MaterialShortageException.filter(
                tenant_id=tenant_id, id__in=unique_ids
            ).values("id", "work_order_code", "work_order_id")
        elif exception_type == "delivery_delay":
            rows = await DeliveryDelayException.filter(
                tenant_id=tenant_id, id__in=unique_ids
            ).values("id", "work_order_code", "work_order_id")
        elif exception_type == "quality":
            rows = await QualityException.filter(
                tenant_id=tenant_id, id__in=unique_ids
            ).values("id", "work_order_code", "work_order_id")
        else:
            continue
        for row in rows:
            ref_map[(exception_type, int(row["id"]))] = {
                "work_order_code": row.get("work_order_code"),
                "work_order_id": row.get("work_order_id"),
            }
    return ref_map


class ExceptionProcessService(AppBaseService[ExceptionProcessRecord]):
    """
    异常处理流程服务类

    处理异常处理流程相关的业务逻辑。
    """

    def __init__(self):
        super().__init__(ExceptionProcessRecord)
        self.work_order_service = WorkOrderService()
        self.exception_service = ExceptionService()

    async def start_process(
        self,
        tenant_id: int,
        data: ExceptionProcessRecordCreate,
        current_user_id: int,
    ) -> ExceptionProcessRecordResponse:
        """
        启动异常处理流程

        Args:
            tenant_id: 租户ID
            data: 创建数据
            current_user_id: 当前用户ID

        Returns:
            ExceptionProcessRecordResponse: 处理记录响应
        """
        # 验证异常记录是否存在
        await self._validate_exception_exists(
            tenant_id=tenant_id,
            exception_type=data.exception_type,
            exception_id=data.exception_id,
        )

        # 检查是否已有处理记录
        existing = await ExceptionProcessRecord.filter(
            tenant_id=tenant_id,
            exception_type=data.exception_type,
            exception_id=data.exception_id,
            process_status__in=["pending", "processing"],
        ).first()

        if existing:
            raise ValidationError("该异常已有处理流程正在进行中")

        # 获取分配给的用户信息；创建时已指定处理人则直接进入执行中
        assigned_to_name = None
        if data.assigned_to:
            user_info = await self.work_order_service.get_user_info(data.assigned_to)
            assigned_to_name = user_info.get("name")
        has_assignee = bool(data.assigned_to)
        process_status = "processing" if has_assignee else "pending"
        current_step = "assigned" if has_assignee else "detected"

        # 创建处理记录
        process_record = await ExceptionProcessRecord.create(
            tenant_id=tenant_id,
            exception_type=data.exception_type,
            exception_id=data.exception_id,
            process_status=process_status,
            current_step=current_step,
            assigned_to=data.assigned_to,
            assigned_to_name=assigned_to_name,
            assigned_at=resolve_business_datetime() if has_assignee else None,
            process_config=data.process_config,
            started_at=resolve_business_datetime(),
            remarks=data.remarks,
        )

        # 创建历史记录
        await self._create_history(
            tenant_id=tenant_id,
            process_record_id=process_record.id,
            action="start",
            action_by=current_user_id,
            comment=f"启动异常处理流程：{data.exception_type}",
        )

        await dispatch_event(
            TaskEvent(
                name="exception/process/start",
                data={
                    "tenant_id": tenant_id,
                    "process_record_id": process_record.id,
                    "exception_type": data.exception_type,
                    "exception_id": data.exception_id,
                },
            )
        )

        logger.info(f"异常处理流程已启动: {process_record.id}, 异常类型: {data.exception_type}")

        if data.exception_type == "quality" and data.assigned_to:
            await self._notify_quality_exception_assigned(
                tenant_id,
                exception_id=data.exception_id,
                assigned_to=int(data.assigned_to),
                assigned_to_name=assigned_to_name or "",
                creator_user_id=current_user_id,
            )

        return ExceptionProcessRecordResponse.model_validate(process_record)

    async def assign_process(
        self,
        tenant_id: int,
        process_record_id: int,
        data: ExceptionProcessAssignRequest,
        current_user_id: int,
    ) -> ExceptionProcessRecordResponse:
        """
        分配异常处理流程

        Args:
            tenant_id: 租户ID
            process_record_id: 处理记录ID
            data: 分配数据
            current_user_id: 当前用户ID

        Returns:
            ExceptionProcessRecordResponse: 处理记录响应
        """
        process_record = await ExceptionProcessRecord.get_or_none(
            id=process_record_id,
            tenant_id=tenant_id,
        )
        if not process_record:
            raise NotFoundError("异常处理记录不存在")

        if process_record.process_status not in ["pending", "processing"]:
            raise ValidationError("该异常处理流程已结束，无法重新分配")

        # 获取分配给的用户信息
        user_info = await self.work_order_service.get_user_info(data.assigned_to)
        assigned_to_name = user_info.get("name")

        # 记录原步骤
        from_step = process_record.current_step

        # 更新处理记录
        process_record.assigned_to = data.assigned_to
        process_record.assigned_to_name = assigned_to_name
        process_record.assigned_at = resolve_business_datetime()
        if process_record.process_status == "pending":
            process_record.process_status = "processing"
            process_record.current_step = "assigned"
        await process_record.save()

        # 创建历史记录
        await self._create_history(
            tenant_id=tenant_id,
            process_record_id=process_record.id,
            action="assign",
            action_by=current_user_id,
            from_step=from_step,
            to_step=process_record.current_step,
            comment=data.comment or f"分配给：{assigned_to_name}",
        )

        logger.info(f"异常处理流程已分配: {process_record.id}, 分配给: {assigned_to_name}")

        if process_record.exception_type == "quality" and process_record.exception_id:
            start_history = await ExceptionProcessHistory.filter(
                tenant_id=tenant_id,
                process_record_id=process_record.id,
                action="start",
            ).order_by("id").first()
            creator_user_id = start_history.action_by if start_history else current_user_id
            await self._notify_quality_exception_assigned(
                tenant_id,
                exception_id=int(process_record.exception_id),
                assigned_to=int(data.assigned_to),
                assigned_to_name=assigned_to_name or "",
                creator_user_id=creator_user_id,
            )

        return ExceptionProcessRecordResponse.model_validate(process_record)

    async def transition_step(
        self,
        tenant_id: int,
        process_record_id: int,
        data: ExceptionProcessStepTransitionRequest,
        current_user_id: int,
    ) -> ExceptionProcessRecordResponse:
        """
        步骤流转

        Args:
            tenant_id: 租户ID
            process_record_id: 处理记录ID
            data: 流转数据
            current_user_id: 当前用户ID

        Returns:
            ExceptionProcessRecordResponse: 处理记录响应
        """
        process_record = await ExceptionProcessRecord.get_or_none(
            id=process_record_id,
            tenant_id=tenant_id,
        )
        if not process_record:
            raise NotFoundError("异常处理记录不存在")

        if process_record.process_status not in ["pending", "processing"]:
            raise ValidationError("该异常处理流程已结束，无法进行步骤流转")

        # 记录原步骤
        from_step = process_record.current_step

        # 更新处理记录
        process_record.current_step = data.to_step
        if process_record.process_status == "pending":
            process_record.process_status = "processing"
        await process_record.save()

        # 创建历史记录
        await self._create_history(
            tenant_id=tenant_id,
            process_record_id=process_record.id,
            action="step_transition",
            action_by=current_user_id,
            from_step=from_step,
            to_step=data.to_step,
            comment=data.comment,
        )

        logger.info(f"异常处理流程步骤流转: {process_record.id}, {from_step} -> {data.to_step}")

        return ExceptionProcessRecordResponse.model_validate(process_record)

    async def resolve_process(
        self,
        tenant_id: int,
        process_record_id: int,
        data: ExceptionProcessResolveRequest,
        current_user_id: int,
    ) -> ExceptionProcessRecordResponse:
        """
        解决异常处理流程

        Args:
            tenant_id: 租户ID
            process_record_id: 处理记录ID
            data: 解决数据
            current_user_id: 当前用户ID

        Returns:
            ExceptionProcessRecordResponse: 处理记录响应
        """
        process_record = await ExceptionProcessRecord.get_or_none(
            id=process_record_id,
            tenant_id=tenant_id,
        )
        if not process_record:
            raise NotFoundError("异常处理记录不存在")

        if process_record.process_status == "resolved":
            raise ValidationError("该异常处理流程已解决")

        # 记录原步骤
        from_step = process_record.current_step

        # 更新处理记录
        process_record.process_status = "resolved"
        process_record.current_step = "closed"
        process_record.completed_at = resolve_business_datetime()
        if data.comment:
            process_record.remarks = data.comment
        await process_record.save()

        # 更新异常记录状态
        await self._update_exception_status(
            tenant_id=tenant_id,
            exception_type=process_record.exception_type,
            exception_id=process_record.exception_id,
            status="resolved",
        )

        # 创建历史记录
        await self._create_history(
            tenant_id=tenant_id,
            process_record_id=process_record.id,
            action="resolve",
            action_by=current_user_id,
            from_step=from_step,
            to_step="closed",
            comment=data.comment or "异常已解决",
        )

        logger.info(f"异常处理流程已解决: {process_record.id}")

        return ExceptionProcessRecordResponse.model_validate(process_record)

    async def cancel_process(
        self,
        tenant_id: int,
        process_record_id: int,
        current_user_id: int,
        comment: Optional[str] = None,
    ) -> ExceptionProcessRecordResponse:
        """
        取消异常处理流程

        Args:
            tenant_id: 租户ID
            process_record_id: 处理记录ID
            current_user_id: 当前用户ID
            comment: 取消说明

        Returns:
            ExceptionProcessRecordResponse: 处理记录响应
        """
        process_record = await ExceptionProcessRecord.get_or_none(
            id=process_record_id,
            tenant_id=tenant_id,
        )
        if not process_record:
            raise NotFoundError("异常处理记录不存在")

        assert_exception_process_record_capability(process_record, "cancel")

        if process_record.process_status in ["resolved", "cancelled"]:
            raise ValidationError("该异常处理流程已结束，无法取消")

        # 记录原步骤
        from_step = process_record.current_step

        # 更新处理记录
        process_record.process_status = "cancelled"
        process_record.current_step = "cancelled"
        process_record.completed_at = resolve_business_datetime()
        if comment:
            process_record.remarks = comment
        await process_record.save()

        # 创建历史记录
        await self._create_history(
            tenant_id=tenant_id,
            process_record_id=process_record.id,
            action="cancel",
            action_by=current_user_id,
            from_step=from_step,
            to_step="cancelled",
            comment=comment or "异常处理流程已取消",
        )

        logger.info(f"异常处理流程已取消: {process_record.id}")

        return ExceptionProcessRecordResponse.model_validate(process_record)

    async def get_process_record(
        self,
        tenant_id: int,
        process_record_id: int,
    ) -> ExceptionProcessRecordDetailResponse:
        """
        获取异常处理记录详情

        Args:
            tenant_id: 租户ID
            process_record_id: 处理记录ID

        Returns:
            ExceptionProcessRecordDetailResponse: 处理记录详情响应
        """
        process_record = await ExceptionProcessRecord.get_or_none(
            id=process_record_id,
            tenant_id=tenant_id,
        )
        if not process_record:
            raise NotFoundError("异常处理记录不存在")

        # 获取历史记录
        histories = await ExceptionProcessHistory.filter(
            tenant_id=tenant_id,
            process_record_id=process_record_id,
            deleted_at__isnull=True,
        ).order_by("action_at")

        # 获取里程碑数据
        from apps.kuaizhizao.services.document_lifecycle_service import get_exception_process_lifecycle, get_document_milestones
        milestones = await get_document_milestones(process_record.tenant_id, "exception_process", process_record.id)
        
        ref_map = await _load_work_order_ref_map(tenant_id, [process_record])
        base = ExceptionProcessRecordResponse.model_validate(process_record)
        ref = ref_map.get(
            (str(process_record.exception_type or "").strip(), int(process_record.exception_id))
        ) or {}
        base.work_order_code = ref.get("work_order_code")
        base.work_order_id = ref.get("work_order_id")
        detail = ExceptionProcessRecordDetailResponse(
            **base.model_dump(),
            histories=[ExceptionProcessHistoryResponse.model_validate(h) for h in histories],
        )
        detail.lifecycle = get_exception_process_lifecycle(process_record, milestones=milestones)
        return detail

    async def list_process_records(
        self,
        tenant_id: int,
        exception_type: Optional[str] = None,
        exception_id: Optional[int] = None,
        process_status: Optional[str] = None,
        assigned_to: Optional[int] = None,
        skip: int = 0,
        limit: int = 100,
        keyword: Optional[str] = None,
        assigned_to_name: Optional[str] = None,
        created_start_date: Optional[date] = None,
        created_end_date: Optional[date] = None,
        order_by: Optional[str] = None,
    ) -> tuple[List[ExceptionProcessRecordListResponse], int]:
        """
        获取异常处理记录列表

        Args:
            tenant_id: 租户ID
            exception_type: 异常类型筛选（可选）
            exception_id: 异常记录ID筛选（可选）
            process_status: 处理状态筛选（可选）
            assigned_to: 分配给筛选（可选）
            skip: 跳过数量
            limit: 限制数量

        Returns:
            (列表, 总数)
        """
        query = ExceptionProcessRecord.filter(tenant_id=tenant_id, deleted_at__isnull=True)

        if exception_type:
            query = query.filter(exception_type=exception_type)
        if exception_id:
            query = query.filter(exception_id=exception_id)
        if process_status:
            query = query.filter(process_status=process_status)
        if assigned_to:
            query = query.filter(assigned_to=assigned_to)

        kw = (keyword or "").strip()
        if kw:
            query = query.filter(
                Q(assigned_to_name__icontains=kw) | Q(current_step__icontains=kw)
            )
        atn = (assigned_to_name or "").strip()
        if atn:
            query = query.filter(assigned_to_name__icontains=atn)
        if created_start_date is not None:
            query = query.filter(created_at__gte=datetime.combine(created_start_date, time.min))
        if created_end_date is not None:
            query = query.filter(created_at__lte=datetime.combine(created_end_date, time.max))

        total = await query.count()
        order_clause = order_by if order_by else "-created_at"
        records = await query.order_by(order_clause).offset(skip).limit(limit)
        ref_map = await _load_work_order_ref_map(tenant_id, list(records))
        responses: List[ExceptionProcessRecordListResponse] = []
        for r in records:
            item = ExceptionProcessRecordListResponse.model_validate(r)
            ref = ref_map.get((str(r.exception_type or "").strip(), int(r.exception_id))) or {}
            item.work_order_code = ref.get("work_order_code")
            item.work_order_id = ref.get("work_order_id")
            responses.append(item)
        return enrich_exception_process_record_list_capabilities(records, responses), total

    async def _validate_exception_exists(
        self,
        tenant_id: int,
        exception_type: str,
        exception_id: int,
    ) -> None:
        """
        验证异常记录是否存在

        Args:
            tenant_id: 租户ID
            exception_type: 异常类型
            exception_id: 异常记录ID

        Raises:
            NotFoundError: 异常记录不存在
        """
        if exception_type == "material_shortage":
            exception = await MaterialShortageException.get_or_none(
                id=exception_id,
                tenant_id=tenant_id,
            )
        elif exception_type == "delivery_delay":
            exception = await DeliveryDelayException.get_or_none(
                id=exception_id,
                tenant_id=tenant_id,
            )
        elif exception_type == "quality":
            exception = await QualityException.get_or_none(
                id=exception_id,
                tenant_id=tenant_id,
            )
        else:
            raise ValidationError(f"不支持的异常类型: {exception_type}")

        if not exception:
            raise NotFoundError(f"异常记录不存在: {exception_type} - {exception_id}")

    async def _update_exception_status(
        self,
        tenant_id: int,
        exception_type: str,
        exception_id: int,
        status: str,
    ) -> None:
        """
        更新异常记录状态

        Args:
            tenant_id: 租户ID
            exception_type: 异常类型
            exception_id: 异常记录ID
            status: 状态
        """
        if exception_type == "material_shortage":
            exception = await MaterialShortageException.get_or_none(
                id=exception_id,
                tenant_id=tenant_id,
            )
        elif exception_type == "delivery_delay":
            exception = await DeliveryDelayException.get_or_none(
                id=exception_id,
                tenant_id=tenant_id,
            )
        elif exception_type == "quality":
            exception = await QualityException.get_or_none(
                id=exception_id,
                tenant_id=tenant_id,
            )
        else:
            return

        if exception:
            exception.status = status
            await exception.save()

    async def _notify_quality_exception_assigned(
        self,
        tenant_id: int,
        *,
        exception_id: int,
        assigned_to: int,
        assigned_to_name: str,
        creator_user_id: Optional[int],
    ) -> None:
        from apps.kuaizhizao.services.kuaizhizao_business_notification import (
            ACTION_ASSIGNED,
            DOC_QUALITY_EXCEPTION,
            dispatch_kuaizhizao_notification,
        )

        exception = await QualityException.get_or_none(
            tenant_id=tenant_id,
            id=exception_id,
        )
        if not exception:
            return
        code = str(getattr(exception, "uuid", None) or exception.id)
        try:
            await dispatch_kuaizhizao_notification(
                tenant_id,
                trigger_document=DOC_QUALITY_EXCEPTION,
                trigger_action=ACTION_ASSIGNED,
                variables={
                    "exception_code": code,
                    "assigned_to_name": assigned_to_name or "—",
                    "material_name": exception.material_name or exception.material_code or "—",
                    "severity": exception.severity or "",
                    "problem_description": (exception.problem_description or "")[:500],
                    "detail_path": (
                        f"/apps/kuaizhizao/production-execution/quality-exceptions?highlight={exception.id}"
                    ),
                    "quality_exception_id": str(exception.id),
                },
                context={
                    "creator_user_id": creator_user_id,
                    "form_notify_user_ids": [assigned_to],
                },
            )
        except Exception as exc:
            logger.warning(
                "质量异常分派消息提醒失败 tenant={} exception={}: {}",
                tenant_id,
                exception_id,
                exc,
            )

    async def _create_history(
        self,
        tenant_id: int,
        process_record_id: int,
        action: str,
        action_by: int,
        from_step: Optional[str] = None,
        to_step: Optional[str] = None,
        comment: Optional[str] = None,
    ) -> None:
        """
        创建历史记录

        Args:
            tenant_id: 租户ID
            process_record_id: 处理记录ID
            action: 操作类型
            action_by: 操作人ID
            from_step: 来源步骤
            to_step: 目标步骤
            comment: 操作说明
        """
        try:
            # 获取操作人信息
            user_info = await self.work_order_service.get_user_info(action_by)
            action_by_name = user_info.get("name", "")

            await ExceptionProcessHistory.create(
                tenant_id=tenant_id,
                process_record_id=process_record_id,
                action=action,
                action_by=action_by,
                action_by_name=action_by_name,
                action_at=resolve_business_datetime(),
                from_step=from_step,
                to_step=to_step,
                comment=comment,
            )
        except Exception as e:
            # 记录历史失败不影响主流程
            logger.error(f"创建异常处理历史记录失败: {e}")
