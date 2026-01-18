"""
补货建议业务服务模块

提供补货建议相关的业务逻辑处理，包括生成补货建议、处理补货建议等。

Author: Auto (AI Assistant)
Date: 2026-01-17
"""

import uuid
from datetime import datetime, timedelta
from typing import List, Optional, Dict, Any
from decimal import Decimal

from tortoise.queryset import Q
from tortoise.transactions import in_transaction

from apps.kuaizhizao.models.replenishment_suggestion import ReplenishmentSuggestion
from apps.kuaizhizao.models.inventory_alert import InventoryAlert
from apps.kuaizhizao.schemas.replenishment_suggestion import (
    ReplenishmentSuggestionResponse,
    ReplenishmentSuggestionListResponse,
    ReplenishmentSuggestionProcessRequest,
)

from apps.base_service import AppBaseService
from infra.exceptions.exceptions import NotFoundError, ValidationError, BusinessLogicError


class ReplenishmentSuggestionService(AppBaseService[ReplenishmentSuggestion]):
    """
    补货建议服务类

    处理补货建议相关的所有业务逻辑。
    """

    def __init__(self):
        super().__init__(ReplenishmentSuggestion)

    async def generate_suggestions_from_alerts(
        self,
        tenant_id: int,
        alert_ids: Optional[List[int]] = None
    ) -> List[ReplenishmentSuggestionResponse]:
        """
        基于库存预警生成补货建议

        Args:
            tenant_id: 组织ID
            alert_ids: 预警ID列表（可选，如果不提供则处理所有待处理的低库存预警）

        Returns:
            List[ReplenishmentSuggestionResponse]: 生成的补货建议列表
        """
        async with in_transaction():
            # 获取待处理的低库存预警
            if alert_ids:
                alerts = await InventoryAlert.filter(
                    tenant_id=tenant_id,
                    id__in=alert_ids,
                    alert_type="low_stock",
                    status="pending",
                    deleted_at__isnull=True
                ).all()
            else:
                alerts = await InventoryAlert.filter(
                    tenant_id=tenant_id,
                    alert_type="low_stock",
                    status="pending",
                    deleted_at__isnull=True
                ).all()

            suggestions = []
            for alert in alerts:
                # 检查是否已经存在未处理的补货建议
                existing = await ReplenishmentSuggestion.filter(
                    tenant_id=tenant_id,
                    material_id=alert.material_id,
                    warehouse_id=alert.warehouse_id,
                    status="pending",
                    deleted_at__isnull=True
                ).first()

                if existing:
                    continue  # 跳过已存在的未处理建议

                # 计算建议补货数量
                # TODO: 从物料主数据获取安全库存、最低库存、最高库存等信息
                safety_stock = alert.threshold_value or Decimal(0)
                current_quantity = alert.current_quantity or Decimal(0)
                
                # 基础补货数量 = 安全库存 - 当前库存
                suggested_quantity = safety_stock - current_quantity
                
                # 如果安全库存小于当前库存，说明预警阈值可能设置不合理，使用固定值
                if suggested_quantity <= 0:
                    suggested_quantity = safety_stock * Decimal("2")  # 建议补货量为安全库存的2倍

                # 确定优先级
                if current_quantity <= safety_stock * Decimal("0.2"):
                    priority = "high"
                elif current_quantity <= safety_stock * Decimal("0.5"):
                    priority = "medium"
                else:
                    priority = "low"

                # 创建补货建议
                suggestion = await ReplenishmentSuggestion.create(
                    tenant_id=tenant_id,
                    uuid=str(uuid.uuid4()),
                    material_id=alert.material_id,
                    material_code=alert.material_code,
                    material_name=alert.material_name,
                    warehouse_id=alert.warehouse_id,
                    warehouse_name=alert.warehouse_name,
                    current_quantity=current_quantity,
                    safety_stock=safety_stock,
                    min_stock=None,  # TODO: 从物料主数据获取
                    max_stock=None,  # TODO: 从物料主数据获取
                    suggested_quantity=suggested_quantity,
                    priority=priority,
                    suggestion_type="low_stock",
                    estimated_delivery_days=None,  # TODO: 从供应商信息获取
                    suggested_order_date=datetime.now(),  # TODO: 根据预计交货天数计算
                    supplier_id=None,  # TODO: 从物料主数据或供应商信息获取
                    supplier_name=None,
                    alert_id=alert.id,
                    related_demand_id=None,
                    related_demand_code=None,
                    remarks=f"基于库存预警生成：{alert.alert_message}",
                )

                suggestions.append(ReplenishmentSuggestionResponse.model_validate(suggestion))

            return suggestions

    async def get_suggestions(
        self,
        tenant_id: int,
        skip: int = 0,
        limit: int = 100,
        status: Optional[str] = None,
        priority: Optional[str] = None,
        suggestion_type: Optional[str] = None,
        material_id: Optional[int] = None,
        warehouse_id: Optional[int] = None,
    ) -> List[ReplenishmentSuggestionListResponse]:
        """
        获取补货建议列表

        Args:
            tenant_id: 组织ID
            skip: 跳过数量
            limit: 限制数量
            status: 状态（可选）
            priority: 优先级（可选）
            suggestion_type: 建议类型（可选）
            material_id: 物料ID（可选）
            warehouse_id: 仓库ID（可选）

        Returns:
            List[ReplenishmentSuggestionListResponse]: 补货建议列表
        """
        query = ReplenishmentSuggestion.filter(
            tenant_id=tenant_id,
            deleted_at__isnull=True
        )

        if status:
            query = query.filter(status=status)
        if priority:
            query = query.filter(priority=priority)
        if suggestion_type:
            query = query.filter(suggestion_type=suggestion_type)
        if material_id:
            query = query.filter(material_id=material_id)
        if warehouse_id:
            query = query.filter(warehouse_id=warehouse_id)

        suggestions = await query.order_by('-priority', '-created_at').offset(skip).limit(limit)

        return [ReplenishmentSuggestionListResponse.model_validate(suggestion) for suggestion in suggestions]

    async def get_suggestion_by_id(
        self,
        tenant_id: int,
        suggestion_id: int
    ) -> ReplenishmentSuggestionResponse:
        """
        根据ID获取补货建议详情

        Args:
            tenant_id: 组织ID
            suggestion_id: 补货建议ID

        Returns:
            ReplenishmentSuggestionResponse: 补货建议详情

        Raises:
            NotFoundError: 补货建议不存在
        """
        suggestion = await ReplenishmentSuggestion.get_or_none(
            id=suggestion_id,
            tenant_id=tenant_id,
            deleted_at__isnull=True
        )

        if not suggestion:
            raise NotFoundError(f"补货建议不存在: {suggestion_id}")

        return ReplenishmentSuggestionResponse.model_validate(suggestion)

    async def process_suggestion(
        self,
        tenant_id: int,
        suggestion_id: int,
        process_data: ReplenishmentSuggestionProcessRequest,
        processed_by: int
    ) -> ReplenishmentSuggestionResponse:
        """
        处理补货建议

        Args:
            tenant_id: 组织ID
            suggestion_id: 补货建议ID
            process_data: 处理数据
            processed_by: 处理人ID

        Returns:
            ReplenishmentSuggestionResponse: 更新后的补货建议信息

        Raises:
            NotFoundError: 补货建议不存在
            ValidationError: 数据验证失败
        """
        async with in_transaction():
            # 获取补货建议
            suggestion = await ReplenishmentSuggestion.get_or_none(
                id=suggestion_id,
                tenant_id=tenant_id,
                deleted_at__isnull=True
            )

            if not suggestion:
                raise NotFoundError(f"补货建议不存在: {suggestion_id}")

            # 获取处理人信息
            user_info = await self.get_user_info(processed_by)

            # 更新补货建议
            suggestion.status = process_data.status
            suggestion.processed_by = processed_by
            suggestion.processed_by_name = user_info["name"]
            suggestion.processed_at = datetime.now()
            suggestion.processing_notes = process_data.processing_notes

            await suggestion.save()

            return ReplenishmentSuggestionResponse.model_validate(suggestion)

    async def get_suggestion_statistics(
        self,
        tenant_id: int
    ) -> Dict[str, Any]:
        """
        获取补货建议统计信息

        Args:
            tenant_id: 组织ID

        Returns:
            Dict[str, Any]: 补货建议统计信息（按状态、优先级统计）
        """
        # 统计待处理建议数量
        pending_count = await ReplenishmentSuggestion.filter(
            tenant_id=tenant_id,
            status="pending",
            deleted_at__isnull=True
        ).count()

        # 统计按优先级分组的建议数量
        high_count = await ReplenishmentSuggestion.filter(
            tenant_id=tenant_id,
            priority="high",
            status="pending",
            deleted_at__isnull=True
        ).count()

        medium_count = await ReplenishmentSuggestion.filter(
            tenant_id=tenant_id,
            priority="medium",
            status="pending",
            deleted_at__isnull=True
        ).count()

        low_count = await ReplenishmentSuggestion.filter(
            tenant_id=tenant_id,
            priority="low",
            status="pending",
            deleted_at__isnull=True
        ).count()

        return {
            "pending_count": pending_count,
            "by_priority": {
                "high": high_count,
                "medium": medium_count,
                "low": low_count,
            },
        }
