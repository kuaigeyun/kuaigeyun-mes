"""
不良品记录业务服务模块

提供不良品记录相关的业务逻辑处理，包括让步接收审批、统计分析等。

Author: Luigi Lu
Date: 2025-01-15
"""

from datetime import datetime
from typing import List, Optional, Dict, Any
from decimal import Decimal

from tortoise.queryset import Q
from tortoise.transactions import in_transaction
from loguru import logger

from apps.kuaizhizao.models.defect_record import DefectRecord
from apps.kuaizhizao.models.work_order import WorkOrder
from apps.kuaizhizao.models.work_order_operation import WorkOrderOperation
from apps.kuaizhizao.schemas.defect_record import (
    DefectRecordResponse,
    DefectRecordListResponse,
    DefectRecordUpdate
)

from apps.base_service import AppBaseService
from infra.exceptions.exceptions import NotFoundError, ValidationError, BusinessLogicError


class DefectRecordService(AppBaseService[DefectRecord]):
    """
    不良品记录服务类

    处理不良品记录相关的所有业务逻辑，包括让步接收审批、统计分析等。
    """

    def __init__(self):
        super().__init__(DefectRecord)

    async def approve_defect_acceptance(
        self,
        tenant_id: int,
        defect_id: int,
        approved: bool,
        approved_by: int,
        rejection_reason: Optional[str] = None
    ) -> DefectRecordResponse:
        """
        审批不良品让步接收

        Args:
            tenant_id: 组织ID
            defect_id: 不良品记录ID
            approved: 是否同意（True=同意，False=不同意）
            approved_by: 审批人ID
            rejection_reason: 驳回原因（当approved=False时必填）

        Returns:
            DefectRecordResponse: 更新后的不良品记录信息

        Raises:
            NotFoundError: 不良品记录不存在
            ValidationError: 数据验证失败
            BusinessLogicError: 业务逻辑错误
        """
        async with in_transaction():
            # 获取不良品记录
            defect_record = await DefectRecord.get_or_none(
                id=defect_id,
                tenant_id=tenant_id,
                deleted_at__isnull=True
            )

            if not defect_record:
                raise NotFoundError(f"不良品记录不存在: {defect_id}")

            # 验证处理方式必须是accept（让步接收）
            if defect_record.disposition != 'accept':
                raise BusinessLogicError(f"只能审批处理方式为'让步接收'的不良品记录，当前处理方式：{defect_record.disposition}")

            # 验证状态
            if defect_record.status != 'draft':
                raise BusinessLogicError(f"只能审批草稿状态的不良品记录，当前状态：{defect_record.status}")

            # 获取审批人信息
            user_info = await self.get_user_info(approved_by)

            if approved:
                # 审批同意：更新状态为processed，允许继续下一工序
                defect_record.status = 'processed'
                defect_record.processed_at = datetime.now()
                defect_record.processed_by = approved_by
                defect_record.processed_by_name = user_info["name"]
                await defect_record.save()

                # 获取工单和工序信息
                work_order = await WorkOrder.get_or_none(
                    id=defect_record.work_order_id,
                    tenant_id=tenant_id,
                    deleted_at__isnull=True
                )

                if work_order:
                    # 让步接收后，允许继续下一工序（不需要特殊处理，因为不良品已经记录）
                    # 可以在这里添加日志记录或其他业务逻辑
                    logger.info(
                        f"不良品记录 {defect_record.code} 让步接收审批通过，"
                        f"工单: {work_order.code}, 工序: {defect_record.operation_name}, "
                        f"允许继续下一工序"
                    )

                logger.info(f"不良品记录 {defect_record.code} 让步接收审批通过，审批人: {user_info['name']}")
            else:
                # 审批不同意：更新状态为cancelled
                if not rejection_reason or not rejection_reason.strip():
                    raise ValidationError("驳回时必须填写驳回原因")

                defect_record.status = 'cancelled'
                defect_record.remarks = (defect_record.remarks or '') + f"\n[让步接收审批驳回] {datetime.now().strftime('%Y-%m-%d %H:%M:%S')} 由 {user_info['name']} 驳回，原因：{rejection_reason}"
                await defect_record.save()

                logger.info(f"不良品记录 {defect_record.code} 让步接收审批驳回，审批人: {user_info['name']}, 原因: {rejection_reason}")

            return DefectRecordResponse.model_validate(defect_record)

    async def get_defect_statistics(
        self,
        tenant_id: int,
        date_start: Optional[datetime] = None,
        date_end: Optional[datetime] = None,
        work_order_id: Optional[int] = None,
        operation_id: Optional[int] = None,
        product_id: Optional[int] = None,
        defect_type: Optional[str] = None,
        disposition: Optional[str] = None
    ) -> Dict[str, Any]:
        """
        获取不良品统计分析

        Args:
            tenant_id: 组织ID
            date_start: 开始日期
            date_end: 结束日期
            work_order_id: 工单ID（可选）
            operation_id: 工序ID（可选）
            product_id: 产品ID（可选）
            defect_type: 不良品类型（可选）
            disposition: 处理方式（可选）

        Returns:
            Dict[str, Any]: 统计分析结果
        """
        # 构建查询条件
        query = Q(tenant_id=tenant_id, deleted_at__isnull=True)

        if date_start:
            query &= Q(created_at__gte=date_start)
        if date_end:
            query &= Q(created_at__lte=date_end)
        if work_order_id:
            query &= Q(work_order_id=work_order_id)
        if operation_id:
            query &= Q(operation_id=operation_id)
        if product_id:
            query &= Q(product_id=product_id)
        if defect_type:
            query &= Q(defect_type=defect_type)
        if disposition:
            query &= Q(disposition=disposition)

        # 查询不良品记录
        defect_records = await DefectRecord.filter(query).all()

        # 统计总数
        total_count = len(defect_records)
        total_defect_quantity = sum(r.defect_quantity for r in defect_records)

        # 获取报工记录总数和报工数量（用于计算不良品率）
        from apps.kuaizhizao.models.reporting_record import ReportingRecord
        reporting_query = Q(tenant_id=tenant_id, deleted_at__isnull=True)
        if date_start:
            reporting_query &= Q(created_at__gte=date_start)
        if date_end:
            reporting_query &= Q(created_at__lte=date_end)
        if work_order_id:
            reporting_query &= Q(work_order_id=work_order_id)
        if operation_id:
            reporting_query &= Q(operation_id=operation_id)
        if product_id:
            reporting_query &= Q(work_order__product_id=product_id)

        reporting_records = await ReportingRecord.filter(reporting_query).all()
        total_reported_quantity = sum(r.reported_quantity for r in reporting_records)
        defect_rate = (float(total_defect_quantity) / float(total_reported_quantity) * 100) if total_reported_quantity > 0 else 0

        # 按工单统计
        work_order_stats: Dict[int, Dict[str, Any]] = {}
        for record in defect_records:
            if record.work_order_id not in work_order_stats:
                work_order_stats[record.work_order_id] = {
                    'work_order_id': record.work_order_id,
                    'work_order_code': record.work_order_code,
                    'count': 0,
                    'defect_quantity': Decimal('0')
                }
            work_order_stats[record.work_order_id]['count'] += 1
            work_order_stats[record.work_order_id]['defect_quantity'] += record.defect_quantity

        # 按工序统计
        operation_stats: Dict[int, Dict[str, Any]] = {}
        for record in defect_records:
            if record.operation_id not in operation_stats:
                operation_stats[record.operation_id] = {
                    'operation_id': record.operation_id,
                    'operation_name': record.operation_name,
                    'count': 0,
                    'defect_quantity': Decimal('0')
                }
            operation_stats[record.operation_id]['count'] += 1
            operation_stats[record.operation_id]['defect_quantity'] += record.defect_quantity

        # 按物料统计
        product_stats: Dict[int, Dict[str, Any]] = {}
        for record in defect_records:
            if record.product_id not in product_stats:
                product_stats[record.product_id] = {
                    'product_id': record.product_id,
                    'product_code': record.product_code,
                    'product_name': record.product_name,
                    'count': 0,
                    'defect_quantity': Decimal('0')
                }
            product_stats[record.product_id]['count'] += 1
            product_stats[record.product_id]['defect_quantity'] += record.defect_quantity

        # 按不良品类型统计
        type_stats: Dict[str, Dict[str, Any]] = {}
        for record in defect_records:
            if record.defect_type not in type_stats:
                type_stats[record.defect_type] = {
                    'defect_type': record.defect_type,
                    'count': 0,
                    'defect_quantity': Decimal('0')
                }
            type_stats[record.defect_type]['count'] += 1
            type_stats[record.defect_type]['defect_quantity'] += record.defect_quantity

        # 按处理方式统计
        disposition_stats: Dict[str, Dict[str, Any]] = {}
        for record in defect_records:
            if record.disposition not in disposition_stats:
                disposition_stats[record.disposition] = {
                    'disposition': record.disposition,
                    'count': 0,
                    'defect_quantity': Decimal('0')
                }
            disposition_stats[record.disposition]['count'] += 1
            disposition_stats[record.disposition]['defect_quantity'] += record.defect_quantity

        return {
            'summary': {
                'total_count': total_count,
                'total_defect_quantity': float(total_defect_quantity),
                'total_reported_quantity': float(total_reported_quantity),
                'defect_rate': defect_rate
            },
            'by_work_order': list(work_order_stats.values()),
            'by_operation': list(operation_stats.values()),
            'by_product': list(product_stats.values()),
            'by_type': list(type_stats.values()),
            'by_disposition': list(disposition_stats.values())
        }

    async def list_defect_records(
        self,
        tenant_id: int,
        skip: int = 0,
        limit: int = 100,
        work_order_id: Optional[int] = None,
        operation_id: Optional[int] = None,
        status: Optional[str] = None,
        defect_type: Optional[str] = None,
        disposition: Optional[str] = None,
        date_start: Optional[datetime] = None,
        date_end: Optional[datetime] = None
    ) -> List[DefectRecordListResponse]:
        """
        查询不良品记录列表

        Args:
            tenant_id: 组织ID
            skip: 跳过数量
            limit: 限制数量
            work_order_id: 工单ID（可选）
            operation_id: 工序ID（可选）
            status: 状态（可选）
            defect_type: 不良品类型（可选）
            disposition: 处理方式（可选）
            date_start: 开始日期（可选）
            date_end: 结束日期（可选）

        Returns:
            List[DefectRecordListResponse]: 不良品记录列表
        """
        # 构建查询条件
        query = Q(tenant_id=tenant_id, deleted_at__isnull=True)

        if work_order_id:
            query &= Q(work_order_id=work_order_id)
        if operation_id:
            query &= Q(operation_id=operation_id)
        if status:
            query &= Q(status=status)
        if defect_type:
            query &= Q(defect_type=defect_type)
        if disposition:
            query &= Q(disposition=disposition)
        if date_start:
            query &= Q(created_at__gte=date_start)
        if date_end:
            query &= Q(created_at__lte=date_end)

        # 查询不良品记录
        defect_records = await DefectRecord.filter(query).order_by('-created_at').offset(skip).limit(limit).all()

        return [DefectRecordListResponse.model_validate(record) for record in defect_records]
