"""
异常处理流程服务模块

提供异常处理流程相关的业务逻辑，包括异常处理流程启动、步骤流转、历史记录等。

Author: Luigi Lu
Date: 2026-01-16
"""

from datetime import datetime
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
from apps.base_service import AppBaseService
from apps.kuaizhizao.services.work_order_service import WorkOrderService
from apps.kuaizhizao.services.exception_service import ExceptionService
from infra.exceptions.exceptions import NotFoundError, ValidationError
from core.inngest.client import inngest_client
from inngest import Event


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

        # 获取分配给的用户信息
        assigned_to_name = None
        if data.assigned_to:
            user_info = await self.work_order_service.get_user_info(data.assigned_to)
            assigned_to_name = user_info.get("name")

        # 创建处理记录
        process_record = await ExceptionProcessRecord.create(
            tenant_id=tenant_id,
            exception_type=data.exception_type,
            exception_id=data.exception_id,
            process_status="pending",
            current_step="detected",
            assigned_to=data.assigned_to,
            assigned_to_name=assigned_to_name,
            assigned_at=datetime.now() if data.assigned_to else None,
            process_config=data.process_config,
            started_at=datetime.now(),
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

        # 发送Inngest事件启动工作流
        await inngest_client.send_event(
            event=Event(
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
        process_record.assigned_at = datetime.now()
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
        process_record.completed_at = datetime.now()
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

        if process_record.process_status in ["resolved", "cancelled"]:
            raise ValidationError("该异常处理流程已结束，无法取消")

        # 记录原步骤
        from_step = process_record.current_step

        # 更新处理记录
        process_record.process_status = "cancelled"
        process_record.current_step = "cancelled"
        process_record.completed_at = datetime.now()
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

        return ExceptionProcessRecordDetailResponse(
            **ExceptionProcessRecordResponse.model_validate(process_record).model_dump(),
            histories=[ExceptionProcessHistoryResponse.model_validate(h) for h in histories],
        )

    async def list_process_records(
        self,
        tenant_id: int,
        exception_type: Optional[str] = None,
        exception_id: Optional[int] = None,
        process_status: Optional[str] = None,
        assigned_to: Optional[int] = None,
        skip: int = 0,
        limit: int = 100,
    ) -> List[ExceptionProcessRecordListResponse]:
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
            List[ExceptionProcessRecordListResponse]: 处理记录列表
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

        records = await query.order_by("-created_at").offset(skip).limit(limit)
        return [ExceptionProcessRecordListResponse.model_validate(r) for r in records]

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
                action_at=datetime.now(),
                from_step=from_step,
                to_step=to_step,
                comment=comment,
            )
        except Exception as e:
            # 记录历史失败不影响主流程
            logger.error(f"创建异常处理历史记录失败: {e}")
