"""
工作时间段配置服务模块

提供工作时间段配置的CRUD操作和耗时计算功能。

Author: Luigi Lu
Date: 2025-01-15
"""

from datetime import datetime, date, time, timedelta
from typing import List, Optional
from decimal import Decimal

from core.models.working_hours_config import WorkingHoursConfig
from core.schemas.working_hours_config import (
    WorkingHoursConfigCreate,
    WorkingHoursConfigUpdate,
    WorkingHoursConfigResponse,
    WorkingHoursConfigListResponse,
)
from core.services.base import BaseService
from infra.exceptions.exceptions import NotFoundError, ValidationError


class WorkingHoursConfigService(BaseService[WorkingHoursConfig]):
    """
    工作时间段配置服务类

    提供工作时间段配置的CRUD操作和耗时计算功能。
    """

    def __init__(self):
        super().__init__(WorkingHoursConfig)

    async def create_config(
        self,
        tenant_id: int,
        config_data: WorkingHoursConfigCreate,
    ) -> WorkingHoursConfigResponse:
        """
        创建工作时间段配置

        Args:
            tenant_id: 租户ID
            config_data: 配置创建数据

        Returns:
            WorkingHoursConfigResponse: 创建的配置信息
        """
        config = await WorkingHoursConfig.create(
            tenant_id=tenant_id,
            **config_data.model_dump()
        )
        return WorkingHoursConfigResponse.model_validate(config)

    async def update_config(
        self,
        tenant_id: int,
        config_id: int,
        config_data: WorkingHoursConfigUpdate,
    ) -> WorkingHoursConfigResponse:
        """
        更新工作时间段配置

        Args:
            tenant_id: 租户ID
            config_id: 配置ID
            config_data: 配置更新数据

        Returns:
            WorkingHoursConfigResponse: 更新后的配置信息
        """
        config = await WorkingHoursConfig.get_or_none(
            id=config_id,
            tenant_id=tenant_id,
        )
        if not config:
            raise NotFoundError("工作时间段配置不存在")

        update_data = config_data.model_dump(exclude_unset=True)
        await config.update_from_dict(update_data).save()

        return WorkingHoursConfigResponse.model_validate(config)

    async def list_configs(
        self,
        tenant_id: int,
        scope_type: Optional[str] = None,
        scope_id: Optional[int] = None,
        is_enabled: Optional[bool] = None,
    ) -> List[WorkingHoursConfigListResponse]:
        """
        获取工作时间段配置列表

        Args:
            tenant_id: 租户ID
            scope_type: 适用范围类型筛选
            scope_id: 适用范围ID筛选
            is_enabled: 是否启用筛选

        Returns:
            List[WorkingHoursConfigListResponse]: 配置列表
        """
        query = WorkingHoursConfig.filter(tenant_id=tenant_id)

        if scope_type:
            query = query.filter(scope_type=scope_type)
        if scope_id is not None:
            query = query.filter(scope_id=scope_id)
        if is_enabled is not None:
            query = query.filter(is_enabled=is_enabled)

        configs = await query.order_by('-priority', 'id')
        return [WorkingHoursConfigListResponse.model_validate(c) for c in configs]

    async def calculate_working_hours(
        self,
        tenant_id: int,
        start_time: datetime,
        end_time: datetime,
        scope_type: Optional[str] = None,
        scope_id: Optional[int] = None,
    ) -> Decimal:
        """
        计算两个时间点之间的工作时间（小时）

        Args:
            tenant_id: 租户ID
            start_time: 开始时间
            end_time: 结束时间
            scope_type: 适用范围类型（可选）
            scope_id: 适用范围ID（可选）

        Returns:
            Decimal: 工作时间（小时）
        """
        # 获取适用的工作时间段配置
        configs = await self.list_configs(
            tenant_id=tenant_id,
            scope_type=scope_type,
            scope_id=scope_id,
            is_enabled=True,
        )

        if not configs:
            # 如果没有配置，返回总时间
            duration = end_time - start_time
            return Decimal(str(duration.total_seconds() / 3600))

        # TODO: 实现复杂的工作时间计算逻辑
        # 这里先返回简单实现：总时间减去非工作时间
        # 实际应该根据配置的工作时间段来计算

        duration = end_time - start_time
        return Decimal(str(duration.total_seconds() / 3600))

