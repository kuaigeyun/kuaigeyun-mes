"""
需求计算参数配置API模块

提供需求计算参数配置相关的API接口。

Author: Luigi Lu
Date: 2025-01-14
"""

from typing import Optional
from fastapi import APIRouter, Depends, Query, Path, HTTPException, status
from loguru import logger

from core.dependencies import get_current_user, get_current_tenant
from infra.models.user import User
from apps.kuaizhizao.services.computation_config_service import ComputationConfigService
from apps.kuaizhizao.schemas.computation_config import (
    ComputationConfigCreate,
    ComputationConfigUpdate,
    ComputationConfigResponse,
    ComputationConfigListResponse,
)
from infra.exceptions.exceptions import NotFoundError, ValidationError, BusinessLogicError

router = APIRouter(prefix="/computation-configs", tags=["需求计算参数配置"])

# 初始化服务实例
config_service = ComputationConfigService()


@router.post("", response_model=ComputationConfigResponse, summary="创建参数配置")
async def create_computation_config(
    config_data: ComputationConfigCreate,
    current_user: User = Depends(get_current_user),
    tenant_id: int = Depends(get_current_tenant),
):
    """
    创建需求计算参数配置
    
    支持按不同维度配置参数：
    - global: 全局配置
    - material: 按物料配置
    - warehouse: 按仓库配置
    - material_warehouse: 按物料+仓库配置
    """
    try:
        result = await config_service.create_config(
            tenant_id=tenant_id,
            config_data=config_data,
            created_by=current_user.id
        )
        return result
    except ValidationError as e:
        raise HTTPException(status_code=status.HTTP_400_BAD_REQUEST, detail=str(e))
    except Exception as e:
        logger.error(f"创建参数配置失败: {e}")
        raise HTTPException(status_code=status.HTTP_500_INTERNAL_SERVER_ERROR, detail="创建参数配置失败")


@router.get("", response_model=ComputationConfigListResponse, summary="查询参数配置列表")
async def list_computation_configs(
    skip: int = Query(0, ge=0, description="跳过数量"),
    limit: int = Query(20, ge=1, le=100, description="限制数量"),
    config_scope: Optional[str] = Query(None, description="配置维度筛选"),
    material_id: Optional[int] = Query(None, description="物料ID筛选"),
    warehouse_id: Optional[int] = Query(None, description="仓库ID筛选"),
    is_template: Optional[bool] = Query(None, description="是否模板筛选"),
    is_active: Optional[bool] = Query(None, description="是否启用筛选"),
    keyword: Optional[str] = Query(None, description="关键词搜索"),
    current_user: User = Depends(get_current_user),
    tenant_id: int = Depends(get_current_tenant),
):
    """
    查询需求计算参数配置列表
    
    支持按配置维度、物料、仓库、模板等条件筛选。
    """
    try:
        result = await config_service.list_configs(
            tenant_id=tenant_id,
            skip=skip,
            limit=limit,
            config_scope=config_scope,
            material_id=material_id,
            warehouse_id=warehouse_id,
            is_template=is_template,
            is_active=is_active,
            keyword=keyword
        )
        return result
    except Exception as e:
        logger.error(f"查询参数配置列表失败: {e}")
        raise HTTPException(status_code=status.HTTP_500_INTERNAL_SERVER_ERROR, detail="查询参数配置列表失败")


@router.get("/{config_id}", response_model=ComputationConfigResponse, summary="获取参数配置详情")
async def get_computation_config(
    config_id: int = Path(..., description="配置ID"),
    current_user: User = Depends(get_current_user),
    tenant_id: int = Depends(get_current_tenant),
):
    """
    获取需求计算参数配置详情
    """
    try:
        result = await config_service.get_config_by_id(
            tenant_id=tenant_id,
            config_id=config_id
        )
        return result
    except NotFoundError as e:
        raise HTTPException(status_code=status.HTTP_404_NOT_FOUND, detail=str(e))
    except Exception as e:
        logger.error(f"获取参数配置详情失败: {e}")
        raise HTTPException(status_code=status.HTTP_500_INTERNAL_SERVER_ERROR, detail="获取参数配置详情失败")


@router.put("/{config_id}", response_model=ComputationConfigResponse, summary="更新参数配置")
async def update_computation_config(
    config_id: int = Path(..., description="配置ID"),
    config_data: ComputationConfigUpdate = ...,
    current_user: User = Depends(get_current_user),
    tenant_id: int = Depends(get_current_tenant),
):
    """
    更新需求计算参数配置
    """
    try:
        result = await config_service.update_config(
            tenant_id=tenant_id,
            config_id=config_id,
            config_data=config_data,
            updated_by=current_user.id
        )
        return result
    except NotFoundError as e:
        raise HTTPException(status_code=status.HTTP_404_NOT_FOUND, detail=str(e))
    except ValidationError as e:
        raise HTTPException(status_code=status.HTTP_400_BAD_REQUEST, detail=str(e))
    except Exception as e:
        logger.error(f"更新参数配置失败: {e}")
        raise HTTPException(status_code=status.HTTP_500_INTERNAL_SERVER_ERROR, detail="更新参数配置失败")


@router.delete("/{config_id}", summary="删除参数配置")
async def delete_computation_config(
    config_id: int = Path(..., description="配置ID"),
    current_user: User = Depends(get_current_user),
    tenant_id: int = Depends(get_current_tenant),
):
    """
    删除需求计算参数配置（软删除）
    """
    try:
        await config_service.delete_config(
            tenant_id=tenant_id,
            config_id=config_id
        )
        return {"success": True, "message": "删除成功"}
    except NotFoundError as e:
        raise HTTPException(status_code=status.HTTP_404_NOT_FOUND, detail=str(e))
    except Exception as e:
        logger.error(f"删除参数配置失败: {e}")
        raise HTTPException(status_code=status.HTTP_500_INTERNAL_SERVER_ERROR, detail="删除参数配置失败")


@router.get("/for-computation/params", summary="获取用于计算的参数配置")
async def get_computation_params(
    material_id: Optional[int] = Query(None, description="物料ID"),
    warehouse_id: Optional[int] = Query(None, description="仓库ID"),
    current_user: User = Depends(get_current_user),
    tenant_id: int = Depends(get_current_tenant),
):
    """
    获取用于计算的参数配置（按优先级合并）
    
    优先级：material_warehouse > material > warehouse > global
    """
    try:
        result = await config_service.get_config_for_computation(
            tenant_id=tenant_id,
            material_id=material_id,
            warehouse_id=warehouse_id
        )
        return {"success": True, "params": result}
    except Exception as e:
        logger.error(f"获取计算参数失败: {e}")
        raise HTTPException(status_code=status.HTTP_500_INTERNAL_SERVER_ERROR, detail="获取计算参数失败")
