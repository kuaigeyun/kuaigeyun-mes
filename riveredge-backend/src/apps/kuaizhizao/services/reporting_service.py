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
from loguru import logger

from apps.kuaizhizao.models.work_order import WorkOrder
from apps.kuaizhizao.models.reporting_record import ReportingRecord
from apps.kuaizhizao.models.scrap_record import ScrapRecord
from apps.kuaizhizao.models.defect_record import DefectRecord
from apps.kuaizhizao.schemas.reporting_record import (
    ReportingRecordCreate,
    ReportingRecordUpdate,
    ReportingRecordResponse,
    ReportingRecordListResponse
)
from apps.kuaizhizao.schemas.scrap_record import (
    ScrapRecordCreateFromReporting,
    ScrapRecordResponse
)
from apps.kuaizhizao.schemas.defect_record import (
    DefectRecordCreateFromReporting,
    DefectRecordResponse
)

from apps.base_service import AppBaseService
from infra.exceptions.exceptions import NotFoundError, ValidationError, BusinessLogicError


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

            # 检查工单是否冻结
            if work_order.is_frozen:
                raise BusinessLogicError(f"工单已冻结，不能报工。冻结原因：{work_order.freeze_reason or '无'}")

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

        total_reported_quantity = sum(r.reported_quantity for r in records) or Decimal("0")
        total_qualified_quantity = sum(r.qualified_quantity for r in records) or Decimal("0")
        total_unqualified_quantity = sum(r.unqualified_quantity for r in records) or Decimal("0")
        total_work_hours = sum(r.work_hours for r in records) or Decimal("0")

        # 计算合格率
        qualification_rate = float((total_qualified_quantity / total_reported_quantity * 100)) if total_reported_quantity > 0 else 0

        # 效率分析：平均每小时报工数量
        avg_quantity_per_hour = float(total_reported_quantity / total_work_hours) if total_work_hours > 0 else 0

        # 异常分析：统计不合格率
        unqualified_rate = float((total_unqualified_quantity / total_reported_quantity * 100)) if total_reported_quantity > 0 else 0

        # 按工序统计（前10个）
        operation_stats = {}
        for r in records:
            op_name = r.operation_name
            if op_name not in operation_stats:
                operation_stats[op_name] = {
                    'count': 0,
                    'reported_quantity': Decimal("0"),
                    'qualified_quantity': Decimal("0"),
                    'work_hours': Decimal("0"),
                }
            operation_stats[op_name]['count'] += 1
            operation_stats[op_name]['reported_quantity'] += r.reported_quantity
            operation_stats[op_name]['qualified_quantity'] += r.qualified_quantity
            operation_stats[op_name]['work_hours'] += r.work_hours

        # 转换为列表并计算合格率
        operation_stats_list = []
        for op_name, stats in sorted(operation_stats.items(), key=lambda x: x[1]['count'], reverse=True)[:10]:
            op_rate = float((stats['qualified_quantity'] / stats['reported_quantity'] * 100)) if stats['reported_quantity'] > 0 else 0
            operation_stats_list.append({
                'operation_name': op_name,
                'count': stats['count'],
                'reported_quantity': float(stats['reported_quantity']),
                'qualified_quantity': float(stats['qualified_quantity']),
                'work_hours': float(stats['work_hours']),
                'qualification_rate': op_rate,
            })

        # 按操作工统计（前10个）
        worker_stats = {}
        for r in records:
            worker_name = r.worker_name
            if worker_name not in worker_stats:
                worker_stats[worker_name] = {
                    'count': 0,
                    'reported_quantity': Decimal("0"),
                    'qualified_quantity': Decimal("0"),
                    'work_hours': Decimal("0"),
                }
            worker_stats[worker_name]['count'] += 1
            worker_stats[worker_name]['reported_quantity'] += r.reported_quantity
            worker_stats[worker_name]['qualified_quantity'] += r.qualified_quantity
            worker_stats[worker_name]['work_hours'] += r.work_hours

        worker_stats_list = []
        for worker_name, stats in sorted(worker_stats.items(), key=lambda x: x[1]['count'], reverse=True)[:10]:
            worker_rate = float((stats['qualified_quantity'] / stats['reported_quantity'] * 100)) if stats['reported_quantity'] > 0 else 0
            worker_stats_list.append({
                'worker_name': worker_name,
                'count': stats['count'],
                'reported_quantity': float(stats['reported_quantity']),
                'qualified_quantity': float(stats['qualified_quantity']),
                'work_hours': float(stats['work_hours']),
                'qualification_rate': worker_rate,
            })

        return {
            'total_count': total_count,
            'pending_count': pending_count,
            'approved_count': approved_count,
            'rejected_count': rejected_count,
            'total_reported_quantity': float(total_reported_quantity),
            'total_qualified_quantity': float(total_qualified_quantity),
            'total_unqualified_quantity': float(total_unqualified_quantity),
            'total_work_hours': float(total_work_hours),
            'qualification_rate': qualification_rate,
            'unqualified_rate': unqualified_rate,
            'avg_quantity_per_hour': avg_quantity_per_hour,
            'operation_stats': operation_stats_list,
            'worker_stats': worker_stats_list,
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
            
            # 更新不合格数量（从报废记录统计）
            await self._update_work_order_unqualified_quantity(tenant_id, work_order_id, work_order)

            # 如果完成数量达到计划数量，更新状态为已完成
            if total_completed >= work_order.quantity:
                work_order.status = 'completed'
                work_order.actual_end_date = datetime.now()

            await work_order.save()

    async def record_scrap(
        self,
        tenant_id: int,
        reporting_record_id: int,
        scrap_data: ScrapRecordCreateFromReporting,
        created_by: int
    ) -> ScrapRecordResponse:
        """
        从报工记录创建报废记录

        Args:
            tenant_id: 组织ID
            reporting_record_id: 报工记录ID
            scrap_data: 报废记录创建数据
            created_by: 创建人ID

        Returns:
            ScrapRecordResponse: 创建的报废记录信息

        Raises:
            NotFoundError: 报工记录不存在
            ValidationError: 数据验证失败
        """
        async with in_transaction():
            # 获取报工记录
            reporting_record = await ReportingRecord.get_or_none(
                id=reporting_record_id,
                tenant_id=tenant_id,
                deleted_at__isnull=True
            )

            if not reporting_record:
                raise NotFoundError(f"报工记录不存在: {reporting_record_id}")

            # 获取工单信息
            work_order = await WorkOrder.get_or_none(
                id=reporting_record.work_order_id,
                tenant_id=tenant_id,
                deleted_at__isnull=True
            )

            if not work_order:
                raise NotFoundError(f"工单不存在: {reporting_record.work_order_id}")

            # 验证报废数量不能超过报工记录的不合格数量
            if scrap_data.scrap_quantity > reporting_record.unqualified_quantity:
                raise ValidationError(
                    f"报废数量({scrap_data.scrap_quantity})不能超过报工记录的不合格数量({reporting_record.unqualified_quantity})"
                )

            # 生成报废单编码
            today = datetime.now().strftime("%Y%m%d")
            code = await self.generate_code(
                tenant_id=tenant_id,
                code_type="SCRAP_RECORD_CODE",
                prefix=f"SC{today}"
            )

            # 获取创建人信息
            user_info = await self.get_user_info(created_by)

            # 计算总成本
            total_cost = Decimal("0")
            if scrap_data.unit_cost:
                total_cost = scrap_data.unit_cost * scrap_data.scrap_quantity

            # 创建报废记录
            scrap_record = await ScrapRecord.create(
                tenant_id=tenant_id,
                uuid=str(uuid.uuid4()),
                code=code,
                reporting_record_id=reporting_record_id,
                work_order_id=reporting_record.work_order_id,
                work_order_code=reporting_record.work_order_code,
                operation_id=reporting_record.operation_id,
                operation_code=reporting_record.operation_code,
                operation_name=reporting_record.operation_name,
                product_id=work_order.product_id,
                product_code=work_order.product_code,
                product_name=work_order.product_name,
                scrap_quantity=scrap_data.scrap_quantity,
                unit_cost=scrap_data.unit_cost,
                total_cost=total_cost,
                scrap_reason=scrap_data.scrap_reason,
                scrap_type=scrap_data.scrap_type,
                warehouse_id=scrap_data.warehouse_id,
                warehouse_name=scrap_data.warehouse_name,
                status="draft",
                remarks=scrap_data.remarks,
                created_by=created_by,
                created_by_name=user_info["name"],
                updated_by=created_by,
                updated_by_name=user_info["name"],
            )

            # 更新工单的不合格数量（从报废记录统计）
            await self._update_work_order_unqualified_quantity(
                tenant_id=tenant_id,
                work_order_id=work_order.id,
                work_order=work_order
            )
            await work_order.save()
            
            # 库存扣减（需要调用库存服务，待库存服务实现后补充）
            # 注意：由于系统中暂无独立的库存服务，库存扣减功能待后续实现
            # 如果需要立即实现，可以通过调用仓储管理服务或创建库存变动记录来实现
            if scrap_data.warehouse_id:
                logger.info(
                    f"报废记录 {code} 需要扣减库存，物料ID: {work_order.product_id}, "
                    f"仓库ID: {scrap_data.warehouse_id}, 数量: {scrap_data.scrap_quantity} "
                    f"（库存扣减功能待库存服务实现后补充）"
                )

            logger.info(f"创建报废记录成功: {code}, 工单: {work_order.code}, 报废数量: {scrap_data.scrap_quantity}")
            return ScrapRecordResponse.model_validate(scrap_record)

    async def record_defect(
        self,
        tenant_id: int,
        reporting_record_id: int,
        defect_data: DefectRecordCreateFromReporting,
        created_by: int
    ) -> DefectRecordResponse:
        """
        从报工记录创建不良品记录

        Args:
            tenant_id: 组织ID
            reporting_record_id: 报工记录ID
            defect_data: 不良品记录创建数据
            created_by: 创建人ID

        Returns:
            DefectRecordResponse: 创建的不良品记录信息

        Raises:
            NotFoundError: 报工记录不存在
            ValidationError: 数据验证失败
        """
        async with in_transaction():
            # 获取报工记录
            reporting_record = await ReportingRecord.get_or_none(
                id=reporting_record_id,
                tenant_id=tenant_id,
                deleted_at__isnull=True
            )

            if not reporting_record:
                raise NotFoundError(f"报工记录不存在: {reporting_record_id}")

            # 获取工单信息
            work_order = await WorkOrder.get_or_none(
                id=reporting_record.work_order_id,
                tenant_id=tenant_id,
                deleted_at__isnull=True
            )

            if not work_order:
                raise NotFoundError(f"工单不存在: {reporting_record.work_order_id}")

            # 验证不良品数量不能超过报工记录的不合格数量
            if defect_data.defect_quantity > reporting_record.unqualified_quantity:
                raise ValidationError(
                    f"不良品数量({defect_data.defect_quantity})不能超过报工记录的不合格数量({reporting_record.unqualified_quantity})"
                )

            # 生成不良品记录编码
            today = datetime.now().strftime("%Y%m%d")
            code = await self.generate_code(
                tenant_id=tenant_id,
                code_type="DEFECT_RECORD_CODE",
                prefix=f"DF{today}"
            )

            # 获取创建人信息
            user_info = await self.get_user_info(created_by)

            # 创建不良品记录
            defect_record = await DefectRecord.create(
                tenant_id=tenant_id,
                uuid=str(uuid.uuid4()),
                code=code,
                reporting_record_id=reporting_record_id,
                work_order_id=reporting_record.work_order_id,
                work_order_code=reporting_record.work_order_code,
                operation_id=reporting_record.operation_id,
                operation_code=reporting_record.operation_code,
                operation_name=reporting_record.operation_name,
                product_id=work_order.product_id,
                product_code=work_order.product_code,
                product_name=work_order.product_name,
                defect_quantity=defect_data.defect_quantity,
                defect_type=defect_data.defect_type,
                defect_reason=defect_data.defect_reason,
                disposition=defect_data.disposition,
                quarantine_location=defect_data.quarantine_location,
                status="draft",
                remarks=defect_data.remarks,
                created_by=created_by,
                created_by_name=user_info["name"],
                updated_by=created_by,
                updated_by_name=user_info["name"],
            )

            # TODO: 根据处理方式执行相应操作
            # - 如果处理方式为返工，创建返工单
            # - 如果处理方式为报废，创建报废记录
            # - 如果处理方式为隔离，记录隔离位置
            # - 更新工单的不合格数量

            return DefectRecordResponse.model_validate(defect_record)

    async def correct_reporting_data(
        self,
        tenant_id: int,
        record_id: int,
        correct_data: ReportingRecordUpdate,
        corrected_by: int,
        correction_reason: str
    ) -> ReportingRecordResponse:
        """
        修正报工数据

        用于修正已提交的报工记录数据，需要记录修正原因和修正历史。

        Args:
            tenant_id: 组织ID
            record_id: 报工记录ID
            correct_data: 修正数据
            corrected_by: 修正人ID
            correction_reason: 修正原因（必填）

        Returns:
            ReportingRecordResponse: 修正后的报工记录信息

        Raises:
            NotFoundError: 报工记录不存在
            ValidationError: 数据验证失败
            BusinessLogicError: 业务逻辑错误（如已审核的记录不允许修正等）
        """
        if not correction_reason or not correction_reason.strip():
            raise ValidationError("修正原因不能为空")

        async with in_transaction():
            # 获取报工记录
            reporting_record = await ReportingRecord.get_or_none(
                id=record_id,
                tenant_id=tenant_id,
                deleted_at__isnull=True
            )

            if not reporting_record:
                raise NotFoundError(f"报工记录不存在: {record_id}")

            # 获取修正人信息
            user_info = await self.get_user_info(corrected_by)

            # 检查是否可以修正（可以根据业务需求调整规则）
            # 例如：只有待审核或已驳回的记录可以修正，或者所有记录都可以修正但需要审核
            # 这里假设所有记录都可以修正，但会在备注中记录修正历史
            if reporting_record.status == 'approved':
                # 已审核的记录也可以修正，但需要记录修正历史
                pass

            # 构建修正备注（记录修正历史）
            correction_note = f"\n[数据修正] {datetime.now().strftime('%Y-%m-%d %H:%M:%S')} 由 {user_info['name']} 修正，原因：{correction_reason}"
            if reporting_record.remarks:
                updated_remarks = reporting_record.remarks + correction_note
            else:
                updated_remarks = correction_note

            # 更新报工记录
            update_data = correct_data.model_dump(exclude_unset=True)
            update_data['remarks'] = updated_remarks
            update_data['updated_by'] = corrected_by
            update_data['updated_by_name'] = user_info['name']

            await ReportingRecord.filter(
                tenant_id=tenant_id,
                id=record_id
            ).update(**update_data)

            # 重新获取更新后的记录
            updated_record = await ReportingRecord.get_or_none(
                id=record_id,
                tenant_id=tenant_id,
                deleted_at__isnull=True
            )

            # TODO: 如果修正了数量相关字段，可能需要重新计算工单进度
            # TODO: 记录详细的修正历史（可以创建单独的修正历史表）

            return ReportingRecordResponse.model_validate(updated_record)
