"""
库存预警业务服务模块

提供库存预警规则和预警记录相关的业务逻辑处理，包括预警规则配置、预警触发、预警处理等。

Author: Luigi Lu
Date: 2025-01-04
"""

import uuid
from datetime import datetime
from typing import List, Optional, Dict, Any
from decimal import Decimal

from tortoise.queryset import Q
from tortoise.transactions import in_transaction

from apps.kuaizhizao.models.inventory_alert import InventoryAlertRule, InventoryAlert
from apps.kuaizhizao.schemas.inventory_alert import (
    InventoryAlertRuleCreate,
    InventoryAlertRuleUpdate,
    InventoryAlertRuleResponse,
    InventoryAlertRuleListResponse,
    InventoryAlertResponse,
    InventoryAlertListResponse,
    InventoryAlertHandleRequest,
)

from apps.base_service import AppBaseService
from infra.exceptions.exceptions import NotFoundError, ValidationError, BusinessLogicError


class InventoryAlertRuleService(AppBaseService[InventoryAlertRule]):
    """
    库存预警规则服务类

    处理库存预警规则相关的所有业务逻辑。
    """

    def __init__(self):
        super().__init__(InventoryAlertRule)

    async def create_alert_rule(
        self,
        tenant_id: int,
        rule_data: InventoryAlertRuleCreate,
        created_by: int
    ) -> InventoryAlertRuleResponse:
        """
        创建库存预警规则

        Args:
            tenant_id: 组织ID
            rule_data: 预警规则创建数据
            created_by: 创建人ID

        Returns:
            InventoryAlertRuleResponse: 创建的预警规则信息

        Raises:
            ValidationError: 数据验证失败
        """
        async with in_transaction():
            # 生成预警规则编码
            code = await self.generate_code(
                tenant_id=tenant_id,
                code_type="ALERT_RULE_CODE",
                prefix="AR"
            )

            # 获取创建人信息
            user_info = await self.get_user_info(created_by)

            # 创建预警规则
            alert_rule = await InventoryAlertRule.create(
                tenant_id=tenant_id,
                uuid=str(uuid.uuid4()),
                code=code,
                name=rule_data.name,
                alert_type=rule_data.alert_type,
                material_id=rule_data.material_id,
                material_code=rule_data.material_code,
                material_name=rule_data.material_name,
                warehouse_id=rule_data.warehouse_id,
                warehouse_name=rule_data.warehouse_name,
                threshold_type=rule_data.threshold_type,
                threshold_value=rule_data.threshold_value,
                is_enabled=rule_data.is_enabled,
                notify_users=rule_data.notify_users,
                notify_roles=rule_data.notify_roles,
                remarks=rule_data.remarks,
                created_by=created_by,
                created_by_name=user_info["name"],
                updated_by=created_by,
                updated_by_name=user_info["name"],
            )

            return InventoryAlertRuleResponse.model_validate(alert_rule)

    async def list_alert_rules(
        self,
        tenant_id: int,
        skip: int = 0,
        limit: int = 100,
        alert_type: Optional[str] = None,
        is_enabled: Optional[bool] = None,
    ) -> List[InventoryAlertRuleListResponse]:
        """
        获取库存预警规则列表

        Args:
            tenant_id: 组织ID
            skip: 跳过数量
            limit: 限制数量
            alert_type: 预警类型（可选）
            is_enabled: 是否启用（可选）

        Returns:
            List[InventoryAlertRuleListResponse]: 预警规则列表
        """
        query = InventoryAlertRule.filter(
            tenant_id=tenant_id,
            deleted_at__isnull=True
        )

        if alert_type:
            query = query.filter(alert_type=alert_type)
        if is_enabled is not None:
            query = query.filter(is_enabled=is_enabled)

        rules = await query.order_by('-created_at').offset(skip).limit(limit)

        return [InventoryAlertRuleListResponse.model_validate(rule) for rule in rules]


class InventoryAlertService(AppBaseService[InventoryAlert]):
    """
    库存预警记录服务类

    处理库存预警记录相关的所有业务逻辑。
    """

    def __init__(self):
        super().__init__(InventoryAlert)

    async def get_alerts(
        self,
        tenant_id: int,
        skip: int = 0,
        limit: int = 100,
        alert_type: Optional[str] = None,
        status: Optional[str] = None,
        alert_level: Optional[str] = None,
        material_id: Optional[int] = None,
        warehouse_id: Optional[int] = None,
    ) -> List[InventoryAlertListResponse]:
        """
        获取库存预警记录列表

        Args:
            tenant_id: 组织ID
            skip: 跳过数量
            limit: 限制数量
            alert_type: 预警类型（可选）
            status: 状态（可选）
            alert_level: 预警级别（可选）
            material_id: 物料ID（可选）
            warehouse_id: 仓库ID（可选）

        Returns:
            List[InventoryAlertListResponse]: 预警记录列表
        """
        query = InventoryAlert.filter(
            tenant_id=tenant_id,
            deleted_at__isnull=True
        )

        if alert_type:
            query = query.filter(alert_type=alert_type)
        if status:
            query = query.filter(status=status)
        if alert_level:
            query = query.filter(alert_level=alert_level)
        if material_id:
            query = query.filter(material_id=material_id)
        if warehouse_id:
            query = query.filter(warehouse_id=warehouse_id)

        alerts = await query.order_by('-triggered_at').offset(skip).limit(limit)

        return [InventoryAlertListResponse.model_validate(alert) for alert in alerts]

    async def handle_alert(
        self,
        tenant_id: int,
        alert_id: int,
        handle_data: InventoryAlertHandleRequest,
        handled_by: int
    ) -> InventoryAlertResponse:
        """
        处理库存预警

        Args:
            tenant_id: 组织ID
            alert_id: 预警记录ID
            handle_data: 处理数据
            handled_by: 处理人ID

        Returns:
            InventoryAlertResponse: 更新后的预警记录信息

        Raises:
            NotFoundError: 预警记录不存在
            ValidationError: 数据验证失败
        """
        async with in_transaction():
            # 获取预警记录
            alert = await InventoryAlert.get_or_none(
                id=alert_id,
                tenant_id=tenant_id,
                deleted_at__isnull=True
            )

            if not alert:
                raise NotFoundError(f"预警记录不存在: {alert_id}")

            # 获取处理人信息
            user_info = await self.get_user_info(handled_by)

            # 更新预警记录
            alert.status = handle_data.status
            alert.handled_by = handled_by
            alert.handled_by_name = user_info["name"]
            alert.handled_at = datetime.now()
            alert.handling_notes = handle_data.handling_notes

            if handle_data.status == "resolved":
                alert.resolved_at = datetime.now()

            alert.updated_by = handled_by
            alert.updated_by_name = user_info["name"]

            await alert.save()

            return InventoryAlertResponse.model_validate(alert)

    async def check_and_trigger_alerts(
        self,
        tenant_id: int,
        material_id: int,
        warehouse_id: int,
        current_quantity: Decimal
    ) -> List[InventoryAlertResponse]:
        """
        检查并触发库存预警

        Args:
            tenant_id: 组织ID
            material_id: 物料ID
            warehouse_id: 仓库ID
            current_quantity: 当前库存数量

        Returns:
            List[InventoryAlertResponse]: 触发的预警记录列表
        """
        # TODO: 从库存服务获取物料和仓库信息
        # TODO: 获取所有启用的预警规则
        # TODO: 根据规则检查是否触发预警
        # TODO: 如果触发，创建预警记录

        # 简化处理，返回空列表
        return []

