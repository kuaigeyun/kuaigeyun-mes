"""
报废记录业务服务模块

提供报废记录相关的业务逻辑处理，包括报废审批、统计分析等。

Author: Luigi Lu
Date: 2025-01-15
"""

from datetime import datetime
from typing import List, Optional, Dict, Any
from decimal import Decimal

from tortoise.queryset import Q
from tortoise.transactions import in_transaction
from loguru import logger

from apps.kuaizhizao.models.scrap_record import ScrapRecord
from apps.kuaizhizao.models.work_order import WorkOrder
from apps.kuaizhizao.schemas.scrap_record import (
    ScrapRecordResponse,
    ScrapRecordListResponse,
    ScrapRecordUpdate
)

from apps.base_service import AppBaseService
from infra.exceptions.exceptions import NotFoundError, ValidationError, BusinessLogicError


class ScrapRecordService(AppBaseService[ScrapRecord]):
    """
    报废记录服务类

    处理报废记录相关的所有业务逻辑，包括审批、统计分析等。
    """

    def __init__(self):
        super().__init__(ScrapRecord)

    async def approve_scrap_record(
        self,
        tenant_id: int,
        scrap_id: int,
        approved: bool,
        approved_by: int,
        rejection_reason: Optional[str] = None
    ) -> ScrapRecordResponse:
        """
        审批报废记录

        Args:
            tenant_id: 组织ID
            scrap_id: 报废记录ID
            approved: 是否同意（True=同意，False=不同意）
            approved_by: 审批人ID
            rejection_reason: 驳回原因（当approved=False时必填）

        Returns:
            ScrapRecordResponse: 更新后的报废记录信息

        Raises:
            NotFoundError: 报废记录不存在
            ValidationError: 数据验证失败
            BusinessLogicError: 业务逻辑错误
        """
        async with in_transaction():
            # 获取报废记录
            scrap_record = await ScrapRecord.get_or_none(
                id=scrap_id,
                tenant_id=tenant_id,
                deleted_at__isnull=True
            )

            if not scrap_record:
                raise NotFoundError(f"报废记录不存在: {scrap_id}")

            # 验证状态
            if scrap_record.status != 'draft':
                raise BusinessLogicError(f"只能审批草稿状态的报废记录，当前状态：{scrap_record.status}")

            # 获取审批人信息
            user_info = await self.get_user_info(approved_by)

            if approved:
                # 审批同意：更新状态为confirmed
                scrap_record.status = 'confirmed'
                scrap_record.confirmed_at = datetime.now()
                scrap_record.confirmed_by = approved_by
                scrap_record.confirmed_by_name = user_info["name"]
                await scrap_record.save()

                # 更新工单数量（扣减报废数量）
                work_order = await WorkOrder.get_or_none(
                    id=scrap_record.work_order_id,
                    tenant_id=tenant_id,
                    deleted_at__isnull=True
                )

                if work_order:
                    # 扣减工单完成数量（报废数量）
                    work_order.completed_quantity = max(
                        Decimal('0'),
                        (work_order.completed_quantity or Decimal('0')) - scrap_record.scrap_quantity
                    )
                    # 更新不合格数量（从报废记录统计）
                    await self._update_work_order_unqualified_quantity(
                        tenant_id=tenant_id,
                        work_order_id=work_order.id,
                        work_order=work_order
                    )
                    await work_order.save()

                # 更新库存（不良品库存）
                # TODO: 待库存服务实现后补充
                if scrap_record.warehouse_id:
                    logger.info(
                        f"报废记录 {scrap_record.code} 审批通过，需要更新库存，物料ID: {scrap_record.product_id}, "
                        f"仓库ID: {scrap_record.warehouse_id}, 数量: {scrap_record.scrap_quantity} "
                        f"（库存更新功能待库存服务实现后补充）"
                    )

                logger.info(f"报废记录 {scrap_record.code} 审批通过，审批人: {user_info['name']}")
            else:
                # 审批不同意：更新状态为cancelled
                if not rejection_reason or not rejection_reason.strip():
                    raise ValidationError("驳回时必须填写驳回原因")

                scrap_record.status = 'cancelled'
                scrap_record.remarks = (scrap_record.remarks or '') + f"\n[审批驳回] {datetime.now().strftime('%Y-%m-%d %H:%M:%S')} 由 {user_info['name']} 驳回，原因：{rejection_reason}"
                await scrap_record.save()

                logger.info(f"报废记录 {scrap_record.code} 审批驳回，审批人: {user_info['name']}, 原因: {rejection_reason}")

            return ScrapRecordResponse.model_validate(scrap_record)

    async def _update_work_order_unqualified_quantity(
        self,
        tenant_id: int,
        work_order_id: int,
        work_order: WorkOrder
    ) -> None:
        """
        更新工单的不合格数量（从报废记录统计）

        从该工单的所有报废记录中统计报废数量，更新工单的unqualified_quantity字段。
        统计所有confirmed状态的报废记录，不包括cancelled状态。
        """
        # 查询该工单的所有报废记录（不包括cancelled状态和已删除的）
        scrap_records = await ScrapRecord.filter(
            tenant_id=tenant_id,
            work_order_id=work_order_id,
            deleted_at__isnull=True,
            status='confirmed'  # 只统计已确认的报废记录
        ).all()

        # 累加报废数量
        total_scrap_quantity = sum(r.scrap_quantity for r in scrap_records)

        # 更新工单的不合格数量
        work_order.unqualified_quantity = total_scrap_quantity

    async def get_scrap_statistics(
        self,
        tenant_id: int,
        date_start: Optional[datetime] = None,
        date_end: Optional[datetime] = None,
        work_order_id: Optional[int] = None,
        operation_id: Optional[int] = None,
        product_id: Optional[int] = None,
        scrap_type: Optional[str] = None
    ) -> Dict[str, Any]:
        """
        获取报废统计分析

        Args:
            tenant_id: 组织ID
            date_start: 开始日期
            date_end: 结束日期
            work_order_id: 工单ID（可选）
            operation_id: 工序ID（可选）
            product_id: 产品ID（可选）
            scrap_type: 报废类型（可选）

        Returns:
            Dict[str, Any]: 统计分析结果
        """
        # 构建查询条件
        query = Q(tenant_id=tenant_id, deleted_at__isnull=True, status='confirmed')

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
        if scrap_type:
            query &= Q(scrap_type=scrap_type)

        # 查询报废记录
        scrap_records = await ScrapRecord.filter(query).all()

        # 统计总数
        total_count = len(scrap_records)
        total_scrap_quantity = sum(r.scrap_quantity for r in scrap_records)
        total_cost = sum(r.total_cost or Decimal('0') for r in scrap_records)

        # 按工单统计
        work_order_stats: Dict[int, Dict[str, Any]] = {}
        for record in scrap_records:
            if record.work_order_id not in work_order_stats:
                work_order_stats[record.work_order_id] = {
                    'work_order_id': record.work_order_id,
                    'work_order_code': record.work_order_code,
                    'count': 0,
                    'scrap_quantity': Decimal('0'),
                    'total_cost': Decimal('0')
                }
            work_order_stats[record.work_order_id]['count'] += 1
            work_order_stats[record.work_order_id]['scrap_quantity'] += record.scrap_quantity
            work_order_stats[record.work_order_id]['total_cost'] += (record.total_cost or Decimal('0'))

        # 按工序统计
        operation_stats: Dict[int, Dict[str, Any]] = {}
        for record in scrap_records:
            if record.operation_id not in operation_stats:
                operation_stats[record.operation_id] = {
                    'operation_id': record.operation_id,
                    'operation_name': record.operation_name,
                    'count': 0,
                    'scrap_quantity': Decimal('0'),
                    'total_cost': Decimal('0')
                }
            operation_stats[record.operation_id]['count'] += 1
            operation_stats[record.operation_id]['scrap_quantity'] += record.scrap_quantity
            operation_stats[record.operation_id]['total_cost'] += (record.total_cost or Decimal('0'))

        # 按物料统计
        product_stats: Dict[int, Dict[str, Any]] = {}
        for record in scrap_records:
            if record.product_id not in product_stats:
                product_stats[record.product_id] = {
                    'product_id': record.product_id,
                    'product_code': record.product_code,
                    'product_name': record.product_name,
                    'count': 0,
                    'scrap_quantity': Decimal('0'),
                    'total_cost': Decimal('0')
                }
            product_stats[record.product_id]['count'] += 1
            product_stats[record.product_id]['scrap_quantity'] += record.scrap_quantity
            product_stats[record.product_id]['total_cost'] += (record.total_cost or Decimal('0'))

        # 按报废类型统计
        type_stats: Dict[str, Dict[str, Any]] = {}
        for record in scrap_records:
            if record.scrap_type not in type_stats:
                type_stats[record.scrap_type] = {
                    'scrap_type': record.scrap_type,
                    'count': 0,
                    'scrap_quantity': Decimal('0'),
                    'total_cost': Decimal('0')
                }
            type_stats[record.scrap_type]['count'] += 1
            type_stats[record.scrap_type]['scrap_quantity'] += record.scrap_quantity
            type_stats[record.scrap_type]['total_cost'] += (record.total_cost or Decimal('0'))

        return {
            'summary': {
                'total_count': total_count,
                'total_scrap_quantity': float(total_scrap_quantity),
                'total_cost': float(total_cost),
                'avg_cost_per_unit': float(total_cost / total_scrap_quantity) if total_scrap_quantity > 0 else 0
            },
            'by_work_order': list(work_order_stats.values()),
            'by_operation': list(operation_stats.values()),
            'by_product': list(product_stats.values()),
            'by_type': list(type_stats.values())
        }

    async def list_scrap_records(
        self,
        tenant_id: int,
        skip: int = 0,
        limit: int = 100,
        work_order_id: Optional[int] = None,
        operation_id: Optional[int] = None,
        status: Optional[str] = None,
        scrap_type: Optional[str] = None,
        date_start: Optional[datetime] = None,
        date_end: Optional[datetime] = None
    ) -> List[ScrapRecordListResponse]:
        """
        查询报废记录列表

        Args:
            tenant_id: 组织ID
            skip: 跳过数量
            limit: 限制数量
            work_order_id: 工单ID（可选）
            operation_id: 工序ID（可选）
            status: 状态（可选）
            scrap_type: 报废类型（可选）
            date_start: 开始日期（可选）
            date_end: 结束日期（可选）

        Returns:
            List[ScrapRecordListResponse]: 报废记录列表
        """
        # 构建查询条件
        query = Q(tenant_id=tenant_id, deleted_at__isnull=True)

        if work_order_id:
            query &= Q(work_order_id=work_order_id)
        if operation_id:
            query &= Q(operation_id=operation_id)
        if status:
            query &= Q(status=status)
        if scrap_type:
            query &= Q(scrap_type=scrap_type)
        if date_start:
            query &= Q(created_at__gte=date_start)
        if date_end:
            query &= Q(created_at__lte=date_end)

        # 查询报废记录
        scrap_records = await ScrapRecord.filter(query).order_by('-created_at').offset(skip).limit(limit).all()

        return [ScrapRecordListResponse.model_validate(record) for record in scrap_records]
