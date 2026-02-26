"""
排程配置服务模块

提供排程配置相关的业务逻辑处理。

Author: Plan - 排程管理增强
Date: 2026-02-26
"""

from typing import List, Optional
from tortoise.transactions import in_transaction

from apps.kuaizhizao.models.scheduling_config import SchedulingConfig
from apps.kuaizhizao.schemas.scheduling_config import (
    SchedulingConfigCreate,
    SchedulingConfigUpdate,
    SchedulingConfigResponse,
    SchedulingConfigListResponse,
)
from apps.base_service import AppBaseService
from infra.exceptions.exceptions import NotFoundError, ValidationError


class SchedulingConfigService(AppBaseService[SchedulingConfig]):
    """
    排程配置服务

    提供排程配置的管理功能，支持多套排程方案。
    """

    def __init__(self):
        super().__init__(SchedulingConfig)

    async def create_config(
        self,
        tenant_id: int,
        config_data: SchedulingConfigCreate,
        created_by: int
    ) -> SchedulingConfigResponse:
        """创建排程配置"""
        async with in_transaction():
            existing = await SchedulingConfig.get_or_none(
                tenant_id=tenant_id,
                config_code=config_data.config_code,
            )
            if existing:
                raise ValidationError(f"配置编码已存在: {config_data.config_code}")

            if config_data.is_default:
                await SchedulingConfig.filter(tenant_id=tenant_id).update(is_default=False)

            config_dict = config_data.model_dump(exclude_unset=True)
            config_dict["created_by"] = created_by
            config_dict["updated_by"] = created_by

            config = await SchedulingConfig.create(tenant_id=tenant_id, **config_dict)
            return SchedulingConfigResponse.model_validate(config)

    async def get_config_by_id(
        self,
        tenant_id: int,
        config_id: int
    ) -> SchedulingConfigResponse:
        """根据ID获取排程配置"""
        config = await SchedulingConfig.get_or_none(tenant_id=tenant_id, id=config_id)
        if not config:
            raise NotFoundError(f"排程配置不存在: {config_id}")
        return SchedulingConfigResponse.model_validate(config)

    async def get_default_config(
        self,
        tenant_id: int
    ) -> Optional[SchedulingConfigResponse]:
        """获取默认排程配置"""
        config = await SchedulingConfig.get_or_none(
            tenant_id=tenant_id,
            is_default=True,
            is_active=True,
        )
        if config:
            return SchedulingConfigResponse.model_validate(config)
        # 若无默认配置，返回第一个启用的
        config = await SchedulingConfig.filter(
            tenant_id=tenant_id,
            is_active=True,
        ).first()
        if config:
            return SchedulingConfigResponse.model_validate(config)
        return None

    async def list_configs(
        self,
        tenant_id: int,
        skip: int = 0,
        limit: int = 20,
        is_active: Optional[bool] = None,
    ) -> SchedulingConfigListResponse:
        """查询排程配置列表"""
        query = SchedulingConfig.filter(tenant_id=tenant_id)
        if is_active is not None:
            query = query.filter(is_active=is_active)

        total = await query.count()
        configs = await query.offset(skip).limit(limit).order_by("-is_default", "config_code")

        return SchedulingConfigListResponse(
            data=[SchedulingConfigResponse.model_validate(c) for c in configs],
            total=total,
        )

    async def update_config(
        self,
        tenant_id: int,
        config_id: int,
        config_data: SchedulingConfigUpdate,
        updated_by: int
    ) -> SchedulingConfigResponse:
        """更新排程配置"""
        config = await SchedulingConfig.get_or_none(tenant_id=tenant_id, id=config_id)
        if not config:
            raise NotFoundError(f"排程配置不存在: {config_id}")

        async with in_transaction():
            if config_data.is_default is True:
                await SchedulingConfig.filter(tenant_id=tenant_id).update(is_default=False)

            update_dict = config_data.model_dump(exclude_unset=True)
            update_dict["updated_by"] = updated_by

            await config.update_from_dict(update_dict)
            await config.save()
            return SchedulingConfigResponse.model_validate(config)

    async def delete_config(
        self,
        tenant_id: int,
        config_id: int
    ) -> None:
        """删除排程配置"""
        config = await SchedulingConfig.get_or_none(tenant_id=tenant_id, id=config_id)
        if not config:
            raise NotFoundError(f"排程配置不存在: {config_id}")
        await config.delete()
