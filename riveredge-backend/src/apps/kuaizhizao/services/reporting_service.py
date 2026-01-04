"""
报工业务服务模块

提供报工记录相关的业务逻辑处理，包括报工、审核等。

Author: Luigi Lu
Date: 2025-01-01
"""

import uuid
from datetime import datetime
from typing import List, Optional
from decimal import Decimal

from tortoise.queryset import Q
from tortoise.transactions import in_transaction

from apps.kuaizhizao.models.work_order import WorkOrder
from apps.kuaizhizao.models.reporting_record import ReportingRecord
from apps.kuaizhizao.schemas.reporting_record import (
    ReportingRecordCreate,
    ReportingRecordUpdate,
    ReportingRecordResponse,
    ReportingRecordListResponse
)

from apps.base_service import AppBaseService
from infra.exceptions.exceptions import NotFoundError, ValidationError


class ReportingService(AppBaseService[ReportingRecord]):
    """
    报工服务类

    处理报工记录相关的所有业务逻辑。
    """

    def __init__(self):
        super().__init__(ReportingRecord)

    async def create_reporting_record(
        self,
        tenant_id: int,
        reporting_data: ReportingRecordCreate,
        reported_by: int
    ) -> ReportingRecordResponse:
        """
        创建报工记录

        Args:
            tenant_id: 组织ID
            reporting_data: 报工创建数据
            reported_by: 报工人ID

        Returns:
            ReportingRecordResponse: 创建的报工记录信息

        Raises:
            ValidationError: 数据验证失败
            NotFoundError: 工单不存在
        """
        async with in_transaction():
            # 验证工单是否存在且状态正确
            work_order = await WorkOrder.get_or_none(
                id=reporting_data.work_order_id,
                tenant_id=tenant_id
            )

            if not work_order:
                raise NotFoundError(f"工单不存在: {reporting_data.work_order_id}")

            if work_order.status not in ['released', 'in_progress']:
                raise ValidationError("只能对已下达或进行中的工单进行报工")

            # 验证数量合理性
            if reporting_data.reported_quantity <= 0:
                raise ValidationError("报工数量必须大于0")

            if reporting_data.qualified_quantity + reporting_data.unqualified_quantity != reporting_data.reported_quantity:
                raise ValidationError("合格数量 + 不合格数量必须等于报工数量")

            # 创建报工记录
            reporting_record = await ReportingRecord.create(
                tenant_id=tenant_id,
                uuid=str(uuid.uuid4()),
                work_order_id=reporting_data.work_order_id,
                work_order_code=reporting_data.work_order_code,
                work_order_name=reporting_data.work_order_name,
                operation_id=reporting_data.operation_id,
                operation_code=reporting_data.operation_code,
                operation_name=reporting_data.operation_name,
                worker_id=reporting_data.worker_id,
                worker_name=reporting_data.worker_name,
                reported_quantity=reporting_data.reported_quantity,
                qualified_quantity=reporting_data.qualified_quantity,
                unqualified_quantity=reporting_data.unqualified_quantity,
                work_hours=reporting_data.work_hours,
                status=reporting_data.status,
                reported_at=reporting_data.reported_at,
                remarks=reporting_data.remarks,
                device_info=reporting_data.device_info,
            )

            # 更新工单状态为进行中（如果是从released变为in_progress）
            if work_order.status == 'released':
                work_order.status = 'in_progress'
                work_order.actual_start_date = work_order.actual_start_date or datetime.now()
                await work_order.save()

            return ReportingRecordResponse.model_validate(reporting_record)

    async def get_reporting_record_by_id(
        self,
        tenant_id: int,
        record_id: int
    ) -> ReportingRecordResponse:
        """
        根据ID获取报工记录

        Args:
            tenant_id: 组织ID
            record_id: 报工记录ID

        Returns:
            ReportingRecordResponse: 报工记录信息

        Raises:
            NotFoundError: 报工记录不存在
        """
        record = await ReportingRecord.get_or_none(
            id=record_id,
            tenant_id=tenant_id,
            deleted_at__isnull=True
        )

        if not record:
            raise NotFoundError(f"报工记录不存在: {record_id}")

        return ReportingRecordResponse.model_validate(record)

    async def list_reporting_records(
        self,
        tenant_id: int,
        skip: int = 0,
        limit: int = 100,
        work_order_code: Optional[str] = None,
        work_order_name: Optional[str] = None,
        operation_name: Optional[str] = None,
        worker_name: Optional[str] = None,
        status: Optional[str] = None,
        reported_at_start: Optional[datetime] = None,
        reported_at_end: Optional[datetime] = None,
    ) -> List[ReportingRecordListResponse]:
        """
        获取报工记录列表

        Args:
            tenant_id: 组织ID
            skip: 跳过数量
            limit: 限制数量
            work_order_code: 工单编码（模糊搜索）
            work_order_name: 工单名称（模糊搜索）
            operation_name: 工序名称（模糊搜索）
            worker_name: 操作工姓名（模糊搜索）
            status: 审核状态
            reported_at_start: 报工开始时间
            reported_at_end: 报工结束时间

        Returns:
            List[ReportingRecordListResponse]: 报工记录列表
        """
        query = ReportingRecord.filter(
            tenant_id=tenant_id,
            deleted_at__isnull=True
        )

        # 添加筛选条件
        if work_order_code:
            query = query.filter(work_order_code__icontains=work_order_code)
        if work_order_name:
            query = query.filter(work_order_name__icontains=work_order_name)
        if operation_name:
            query = query.filter(operation_name__icontains=operation_name)
        if worker_name:
            query = query.filter(worker_name__icontains=worker_name)
        if status:
            query = query.filter(status=status)
        if reported_at_start:
            query = query.filter(reported_at__gte=reported_at_start)
        if reported_at_end:
            query = query.filter(reported_at__lte=reported_at_end)

        records = await query.offset(skip).limit(limit).order_by("-reported_at").all()

        return [ReportingRecordListResponse.model_validate(record) for record in records]

    async def approve_reporting_record(
        self,
        tenant_id: int,
        record_id: int,
        approved_by: int,
        rejection_reason: Optional[str] = None
    ) -> ReportingRecordResponse:
        """
        审核报工记录

        Args:
            tenant_id: 组织ID
            record_id: 报工记录ID
            approved_by: 审核人ID
            rejection_reason: 驳回原因（驳回时填写）

        Returns:
            ReportingRecordResponse: 更新后的报工记录信息

        Raises:
            NotFoundError: 报工记录不存在
            ValidationError: 审核状态错误
        """
        async with in_transaction():
            record = await ReportingRecord.get_or_none(
                id=record_id,
                tenant_id=tenant_id,
                deleted_at__isnull=True
            )

            if not record:
                raise NotFoundError(f"报工记录不存在: {record_id}")

            if record.status != 'pending':
                raise ValidationError("只能审核待审核状态的报工记录")

            # 获取审核人信息
            approved_by_name = await self.get_user_name(approved_by)

            # 更新审核信息
            record.approved_at = datetime.now()
            record.approved_by = approved_by
            record.approved_by_name = approved_by_name

            # 根据是否有驳回原因设置状态
            if rejection_reason:
                record.status = 'rejected'
                record.rejection_reason = rejection_reason
            else:
                record.status = 'approved'

            await record.save()

            # 如果审核通过，更新工单完成数量
            if record.status == 'approved':
                await self._update_work_order_progress(tenant_id, record.work_order_id)

            return ReportingRecordResponse.model_validate(record)

    async def delete_reporting_record(
        self,
        tenant_id: int,
        record_id: int
    ) -> None:
        """
        删除报工记录（软删除）

        Args:
            tenant_id: 组织ID
            record_id: 报工记录ID

        Raises:
            NotFoundError: 报工记录不存在
            ValidationError: 不允许删除的记录状态
        """
        record = await ReportingRecord.get_or_none(
            id=record_id,
            tenant_id=tenant_id,
            deleted_at__isnull=True
        )

        if not record:
            raise NotFoundError(f"报工记录不存在: {record_id}")

        # 检查是否可以删除
        if record.status == 'approved':
            raise ValidationError("已审核通过的报工记录不允许删除")

        # 软删除
        record.deleted_at = datetime.now()
        await record.save()

    async def get_reporting_statistics(
        self,
        tenant_id: int,
        date_start: Optional[datetime] = None,
        date_end: Optional[datetime] = None,
    ) -> dict:
        """
        获取报工统计信息

        Args:
            tenant_id: 组织ID
            date_start: 开始日期
            date_end: 结束日期

        Returns:
            dict: 统计信息
        """
        query = ReportingRecord.filter(
            tenant_id=tenant_id,
            deleted_at__isnull=True
        )

        if date_start:
            query = query.filter(reported_at__gte=date_start)
        if date_end:
            query = query.filter(reported_at__lte=date_end)

        records = await query.all()

        total_count = len(records)
        pending_count = sum(1 for r in records if r.status == 'pending')
        approved_count = sum(1 for r in records if r.status == 'approved')
        rejected_count = sum(1 for r in records if r.status == 'rejected')

        total_reported_quantity = sum(r.reported_quantity for r in records)
        total_qualified_quantity = sum(r.qualified_quantity for r in records)
        total_work_hours = sum(r.work_hours for r in records)

        return {
            'total_count': total_count,
            'pending_count': pending_count,
            'approved_count': approved_count,
            'rejected_count': rejected_count,
            'total_reported_quantity': total_reported_quantity,
            'total_qualified_quantity': total_qualified_quantity,
            'total_work_hours': total_work_hours,
            'qualification_rate': (total_qualified_quantity / total_reported_quantity * 100) if total_reported_quantity > 0 else 0,
        }

    async def _update_work_order_progress(
        self,
        tenant_id: int,
        work_order_id: int
    ) -> None:
        """
        更新工单进度

        Args:
            tenant_id: 组织ID
            work_order_id: 工单ID
        """
        # 查询该工单的所有已审核通过的报工记录
        records = await ReportingRecord.filter(
            tenant_id=tenant_id,
            work_order_id=work_order_id,
            status='approved',
            deleted_at__isnull=True
        ).all()

        # 计算总完成数量
        total_completed = sum(r.qualified_quantity for r in records)
        total_work_hours = sum(r.work_hours for r in records)

        # 更新工单
        work_order = await WorkOrder.get_or_none(
            id=work_order_id,
            tenant_id=tenant_id,
            deleted_at__isnull=True
        )

        if work_order:
            work_order.completed_quantity = total_completed
            work_order.qualified_quantity = total_completed

            # 如果完成数量达到计划数量，更新状态为已完成
            if total_completed >= work_order.quantity:
                work_order.status = 'completed'
                work_order.actual_end_date = datetime.now()

            await work_order.save()
