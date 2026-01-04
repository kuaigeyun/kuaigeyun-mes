"""
异常处理服务模块

提供异常处理相关的业务逻辑，包括缺料异常、延期异常、质量异常等。

Author: Luigi Lu
Date: 2025-01-15
"""

from datetime import datetime
from typing import List, Optional
from decimal import Decimal

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
from apps.kuaizhizao.services.base import AppBaseService
from apps.kuaizhizao.services.work_order_service import WorkOrderService
from apps.kuaizhizao.utils.bom_helper import calculate_material_requirements_from_bom
from apps.kuaizhizao.utils.inventory_helper import get_material_available_quantity
from infra.exceptions.exceptions import NotFoundError, ValidationError
from loguru import logger


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
        work_order_id: int,
    ) -> List[MaterialShortageExceptionResponse]:
        """
        检测工单缺料并创建缺料异常记录

        Args:
            tenant_id: 租户ID
            work_order_id: 工单ID

        Returns:
            List[MaterialShortageExceptionResponse]: 缺料异常记录列表
        """
        work_order = await WorkOrder.get_or_none(id=work_order_id, tenant_id=tenant_id)
        if not work_order:
            raise NotFoundError("工单不存在")

        # 获取BOM物料需求
        try:
            material_requirements = await calculate_material_requirements_from_bom(
                tenant_id=tenant_id,
                material_id=work_order.product_id,
                required_quantity=float(work_order.quantity),
                only_approved=True
            )
        except NotFoundError:
            # 如果没有BOM，返回空列表
            logger.warning(f"工单 {work_order.code} 的产品没有BOM，跳过缺料检测")
            return []

        # 检测缺料
        exceptions = []
        for req in material_requirements:
            material_id = req.get("material_id")
            required_qty = Decimal(str(req.get("required_quantity", 0)))
            
            # 获取可用库存
            available_qty = await get_material_available_quantity(
                tenant_id=tenant_id,
                material_id=material_id,
            )

            if available_qty < required_qty:
                shortage_qty = required_qty - available_qty
                
                # 计算预警级别
                shortage_rate = float(shortage_qty / required_qty) if required_qty > 0 else 0
                if shortage_rate >= 0.8:
                    alert_level = "critical"
                elif shortage_rate >= 0.5:
                    alert_level = "high"
                elif shortage_rate >= 0.3:
                    alert_level = "medium"
                else:
                    alert_level = "low"

                # 检查是否已存在异常记录
                existing = await MaterialShortageException.filter(
                    tenant_id=tenant_id,
                    work_order_id=work_order_id,
                    material_id=material_id,
                    status__in=["pending", "processing"],
                ).first()

                if not existing:
                    # 创建缺料异常记录
                    exception = await MaterialShortageException.create(
                        tenant_id=tenant_id,
                        work_order_id=work_order_id,
                        work_order_code=work_order.code,
                        material_id=material_id,
                        material_code=req.get("material_code", ""),
                        material_name=req.get("material_name", ""),
                        shortage_quantity=shortage_qty,
                        available_quantity=available_qty,
                        required_quantity=required_qty,
                        alert_level=alert_level,
                        status="pending",
                        suggested_action="purchase",  # 默认建议采购
                    )
                    exceptions.append(MaterialShortageExceptionResponse.model_validate(exception))

        return exceptions

    async def list_material_shortage_exceptions(
        self,
        tenant_id: int,
        work_order_id: Optional[int] = None,
        status: Optional[str] = None,
        alert_level: Optional[str] = None,
        skip: int = 0,
        limit: int = 100,
    ) -> List[MaterialShortageExceptionListResponse]:
        """
        获取缺料异常列表

        Args:
            tenant_id: 租户ID
            work_order_id: 工单ID筛选（可选）
            status: 状态筛选（可选）
            alert_level: 预警级别筛选（可选）
            skip: 跳过数量
            limit: 限制数量

        Returns:
            List[MaterialShortageExceptionListResponse]: 缺料异常记录列表
        """
        query = MaterialShortageException.filter(tenant_id=tenant_id)

        if work_order_id:
            query = query.filter(work_order_id=work_order_id)
        if status:
            query = query.filter(status=status)
        if alert_level:
            query = query.filter(alert_level=alert_level)

        exceptions = await query.order_by('-alert_level', '-created_at').offset(skip).limit(limit)
        return [MaterialShortageExceptionListResponse.model_validate(e) for e in exceptions]

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
        检测工单交期延期并创建延期异常记录

        Args:
            tenant_id: 租户ID
            work_order_id: 工单ID（可选，如果为None则检测所有延期工单）
            days_threshold: 延期天数阈值（默认0，即只要超过计划结束日期就算延期）

        Returns:
            List[DeliveryDelayExceptionResponse]: 延期异常记录列表
        """
        # 使用工单服务的延期检测方法
        delayed_orders = await self.work_order_service.check_delayed_work_orders(
            tenant_id=tenant_id,
            days_threshold=days_threshold,
        )

        # 如果指定了工单ID，只处理该工单
        if work_order_id:
            delayed_orders = [wo for wo in delayed_orders if wo["work_order_id"] == work_order_id]

        exceptions = []
        for order in delayed_orders:
            delay_days = order.get("delay_days", 0)
            
            # 计算预警级别
            if delay_days >= 7:
                alert_level = "critical"
            elif delay_days >= 3:
                alert_level = "high"
            elif delay_days >= 1:
                alert_level = "medium"
            else:
                alert_level = "low"

            # 分析延期原因并生成建议操作
            delay_reason = order.get("delay_reason", "未知原因")
            if "缺料" in delay_reason or "物料" in delay_reason:
                suggested_action = "expedite"
            elif "产能" in delay_reason or "资源" in delay_reason:
                suggested_action = "increase_resources"
            else:
                suggested_action = "adjust_plan"

            # 检查是否已存在异常记录
            existing = await DeliveryDelayException.filter(
                tenant_id=tenant_id,
                work_order_id=order["work_order_id"],
                status__in=["pending", "processing"],
            ).first()

            if not existing:
                # 创建延期异常记录
                exception = await DeliveryDelayException.create(
                    tenant_id=tenant_id,
                    work_order_id=order["work_order_id"],
                    work_order_code=order.get("work_order_code", ""),
                    planned_end_date=order.get("planned_end_date"),
                    delay_days=delay_days,
                    delay_reason=delay_reason,
                    alert_level=alert_level,
                    status="pending",
                    suggested_action=suggested_action,
                )
                exceptions.append(DeliveryDelayExceptionResponse.model_validate(exception))
            else:
                # 更新现有记录
                existing.delay_days = delay_days
                existing.delay_reason = delay_reason
                existing.alert_level = alert_level
                existing.suggested_action = suggested_action
                await existing.save()
                exceptions.append(DeliveryDelayExceptionResponse.model_validate(existing))

        return exceptions

    async def list_delivery_delay_exceptions(
        self,
        tenant_id: int,
        work_order_id: Optional[int] = None,
        status: Optional[str] = None,
        alert_level: Optional[str] = None,
        skip: int = 0,
        limit: int = 100,
    ) -> List[DeliveryDelayExceptionListResponse]:
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
            List[DeliveryDelayExceptionListResponse]: 延期异常记录列表
        """
        query = DeliveryDelayException.filter(tenant_id=tenant_id)

        if work_order_id:
            query = query.filter(work_order_id=work_order_id)
        if status:
            query = query.filter(status=status)
        if alert_level:
            query = query.filter(alert_level=alert_level)

        exceptions = await query.order_by('-alert_level', '-delay_days', '-created_at').offset(skip).limit(limit)
        return [DeliveryDelayExceptionListResponse.model_validate(e) for e in exceptions]

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
        severity: Optional[str] = None,
        skip: int = 0,
        limit: int = 100,
    ) -> List[QualityExceptionListResponse]:
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
            List[QualityExceptionListResponse]: 质量异常记录列表
        """
        query = QualityException.filter(tenant_id=tenant_id)

        if exception_type:
            query = query.filter(exception_type=exception_type)
        if work_order_id:
            query = query.filter(work_order_id=work_order_id)
        if status:
            query = query.filter(status=status)
        if severity:
            query = query.filter(severity=severity)

        exceptions = await query.order_by('-severity', '-created_at').offset(skip).limit(limit)
        return [QualityExceptionListResponse.model_validate(e) for e in exceptions]

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

