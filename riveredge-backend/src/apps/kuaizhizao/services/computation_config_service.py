"""
需求计算参数配置服务模块

提供需求计算参数配置相关的业务逻辑处理。

Author: Luigi Lu
Date: 2025-01-14
"""

from typing import List, Optional, Dict, Any
from datetime import datetime
from tortoise.transactions import in_transaction
from tortoise.expressions import Q
from loguru import logger

from apps.kuaizhizao.models.computation_config import ComputationConfig
from apps.kuaizhizao.schemas.computation_config import (
    ComputationConfigCreate,
    ComputationConfigUpdate,
    ComputationConfigResponse,
    ComputationConfigListResponse,
)
from apps.base_service import AppBaseService
from infra.exceptions.exceptions import NotFoundError, ValidationError, BusinessLogicError


class ComputationConfigService(AppBaseService[ComputationConfig]):
    """
    需求计算参数配置服务
    
    提供需求计算参数配置的管理功能，支持按不同维度配置参数。
    """
    
    def __init__(self):
        super().__init__(ComputationConfig)
    
    async def create_config(
        self,
        tenant_id: int,
        config_data: ComputationConfigCreate,
        created_by: int
    ) -> ComputationConfigResponse:
        """
        创建参数配置
        
        Args:
            tenant_id: 租户ID
            config_data: 配置数据
            created_by: 创建人ID
            
        Returns:
            ComputationConfigResponse: 创建的配置响应
        """
        async with in_transaction():
            # 验证配置编码唯一性
            existing = await ComputationConfig.get_or_none(
                tenant_id=tenant_id,
                config_code=config_data.config_code,
                deleted_at__isnull=True
            )
            if existing:
                raise ValidationError(f"配置编码已存在: {config_data.config_code}")
            
            # 验证配置维度要求
            if config_data.config_scope in ["material", "material_warehouse"] and not config_data.material_id:
                raise ValidationError(f"配置维度为{config_data.config_scope}时，必须提供物料ID")
            
            if config_data.config_scope in ["warehouse", "material_warehouse"] and not config_data.warehouse_id:
                raise ValidationError(f"配置维度为{config_data.config_scope}时，必须提供仓库ID")
            
            # 创建配置
            config_dict = config_data.model_dump(exclude_unset=True)
            config_dict['created_by'] = created_by
            config_dict['updated_by'] = created_by
            
            config = await ComputationConfig.create(
                tenant_id=tenant_id,
                **config_dict
            )
            
            return ComputationConfigResponse.model_validate(config)
    
    async def get_config_by_id(
        self,
        tenant_id: int,
        config_id: int
    ) -> ComputationConfigResponse:
        """
        根据ID获取参数配置
        
        Args:
            tenant_id: 租户ID
            config_id: 配置ID
            
        Returns:
            ComputationConfigResponse: 配置响应
        """
        config = await ComputationConfig.get_or_none(
            tenant_id=tenant_id,
            id=config_id,
            deleted_at__isnull=True
        )
        
        if not config:
            raise NotFoundError(f"参数配置不存在: {config_id}")
        
        return ComputationConfigResponse.model_validate(config)
    
    async def list_configs(
        self,
        tenant_id: int,
        skip: int = 0,
        limit: int = 20,
        config_scope: Optional[str] = None,
        material_id: Optional[int] = None,
        warehouse_id: Optional[int] = None,
        is_template: Optional[bool] = None,
        is_active: Optional[bool] = None,
        keyword: Optional[str] = None
    ) -> ComputationConfigListResponse:
        """
        查询参数配置列表
        
        Args:
            tenant_id: 租户ID
            skip: 跳过数量
            limit: 限制数量
            config_scope: 配置维度筛选
            material_id: 物料ID筛选
            warehouse_id: 仓库ID筛选
            is_template: 是否模板筛选
            is_active: 是否启用筛选
            keyword: 关键词搜索（配置编码、配置名称）
            
        Returns:
            ComputationConfigListResponse: 配置列表响应
        """
        query = ComputationConfig.filter(
            tenant_id=tenant_id,
            deleted_at__isnull=True
        )
        
        # 应用筛选条件
        if config_scope:
            query = query.filter(config_scope=config_scope)
        if material_id:
            query = query.filter(material_id=material_id)
        if warehouse_id:
            query = query.filter(warehouse_id=warehouse_id)
        if is_template is not None:
            query = query.filter(is_template=is_template)
        if is_active is not None:
            query = query.filter(is_active=is_active)
        if keyword:
            query = query.filter(
                Q(config_code__icontains=keyword) |
                Q(config_name__icontains=keyword)
            )
        
        # 排序：优先级降序，创建时间降序
        configs = await query.order_by("-priority", "-created_at").offset(skip).limit(limit).all()
        total = await query.count()
        
        return ComputationConfigListResponse(
            data=[ComputationConfigResponse.model_validate(c) for c in configs],
            total=total
        )
    
    async def update_config(
        self,
        tenant_id: int,
        config_id: int,
        config_data: ComputationConfigUpdate,
        updated_by: int
    ) -> ComputationConfigResponse:
        """
        更新参数配置
        
        Args:
            tenant_id: 租户ID
            config_id: 配置ID
            config_data: 更新数据
            updated_by: 更新人ID
            
        Returns:
            ComputationConfigResponse: 更新后的配置响应
        """
        async with in_transaction():
            config = await ComputationConfig.get_or_none(
                tenant_id=tenant_id,
                id=config_id,
                deleted_at__isnull=True
            )
            
            if not config:
                raise NotFoundError(f"参数配置不存在: {config_id}")
            
            # 更新字段
            update_data = config_data.model_dump(exclude_unset=True)
            update_data['updated_by'] = updated_by
            
            for key, value in update_data.items():
                setattr(config, key, value)
            
            await config.save()
            
            return ComputationConfigResponse.model_validate(config)
    
    async def delete_config(
        self,
        tenant_id: int,
        config_id: int
    ) -> None:
        """
        删除参数配置（软删除）
        
        Args:
            tenant_id: 租户ID
            config_id: 配置ID
        """
        config = await ComputationConfig.get_or_none(
            tenant_id=tenant_id,
            id=config_id,
            deleted_at__isnull=True
        )
        
        if not config:
            raise NotFoundError(f"参数配置不存在: {config_id}")
        
        await config.soft_delete()
    
    async def get_config_for_computation(
        self,
        tenant_id: int,
        material_id: Optional[int] = None,
        warehouse_id: Optional[int] = None
    ) -> Dict[str, Any]:
        """
        获取用于计算的参数配置（按优先级合并）
        
        优先级：material_warehouse > material > warehouse > global
        
        Args:
            tenant_id: 租户ID
            material_id: 物料ID
            warehouse_id: 仓库ID
            
        Returns:
            Dict: 合并后的计算参数
        """
        # 按优先级查询配置
        configs = []
        
        # 1. 物料+仓库配置（最高优先级）
        if material_id and warehouse_id:
            config = await ComputationConfig.filter(
                tenant_id=tenant_id,
                config_scope="material_warehouse",
                material_id=material_id,
                warehouse_id=warehouse_id,
                is_active=True,
                deleted_at__isnull=True
            ).order_by("-priority").first()
            if config:
                configs.append(config)
        
        # 2. 物料配置
        if material_id:
            config = await ComputationConfig.filter(
                tenant_id=tenant_id,
                config_scope="material",
                material_id=material_id,
                is_active=True,
                deleted_at__isnull=True
            ).order_by("-priority").first()
            if config:
                configs.append(config)
        
        # 3. 仓库配置
        if warehouse_id:
            config = await ComputationConfig.filter(
                tenant_id=tenant_id,
                config_scope="warehouse",
                warehouse_id=warehouse_id,
                is_active=True,
                deleted_at__isnull=True
            ).order_by("-priority").first()
            if config:
                configs.append(config)
        
        # 4. 全局配置（最低优先级）
        config = await ComputationConfig.filter(
            tenant_id=tenant_id,
            config_scope="global",
            is_active=True,
            deleted_at__isnull=True
        ).order_by("-priority").first()
        if config:
            configs.append(config)
        
        # 合并参数（后面的覆盖前面的）
        merged_params: Dict[str, Any] = {}
        for config in configs:
            if config.computation_params:
                merged_params.update(config.computation_params)
        
        return merged_params
