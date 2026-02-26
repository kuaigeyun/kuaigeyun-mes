"""
排程配置API模块

提供排程配置相关的API接口。

Author: Plan - 排程管理增强
Date: 2026-02-26
"""

from typing import Optional
from fastapi import APIRouter, Depends, Query, Path, HTTPException, status
from loguru import logger

from core.api.deps import get_current_user, get_current_tenant
from infra.models.user import User
from apps.kuaizhizao.services.scheduling_config_service import SchedulingConfigService
from apps.kuaizhizao.schemas.scheduling_config import (
    SchedulingConfigCreate,
    SchedulingConfigUpdate,
    SchedulingConfigResponse,
    SchedulingConfigListResponse,
)
from infra.exceptions.exceptions import NotFoundError, ValidationError

router = APIRouter(prefix="/scheduling-configs", tags=["排程配置"])

config_service = SchedulingConfigService()


@router.post("", response_model=SchedulingConfigResponse, summary="创建排程配置")
async def create_scheduling_config(
    config_data: SchedulingConfigCreate,
    current_user: User = Depends(get_current_user),
    tenant_id: int = Depends(get_current_tenant),
):
    """创建排程配置"""
    try:
        return await config_service.create_config(
            tenant_id=tenant_id,
            config_data=config_data,
            created_by=current_user.id,
        )
    except ValidationError as e:
        raise HTTPException(status_code=status.HTTP_400_BAD_REQUEST, detail=str(e))
    except Exception as e:
        logger.error(f"创建排程配置失败: {e}")
        raise HTTPException(status_code=status.HTTP_500_INTERNAL_SERVER_ERROR, detail="创建排程配置失败")


@router.get("", response_model=SchedulingConfigListResponse, summary="查询排程配置列表")
async def list_scheduling_configs(
    skip: int = Query(0, ge=0, description="跳过数量"),
    limit: int = Query(20, ge=1, le=100, description="限制数量"),
    is_active: Optional[bool] = Query(None, description="是否启用筛选"),
    current_user: User = Depends(get_current_user),
    tenant_id: int = Depends(get_current_tenant),
):
    """查询排程配置列表"""
    try:
        return await config_service.list_configs(
            tenant_id=tenant_id,
            skip=skip,
            limit=limit,
            is_active=is_active,
        )
    except Exception as e:
        logger.error(f"查询排程配置列表失败: {e}")
        raise HTTPException(status_code=status.HTTP_500_INTERNAL_SERVER_ERROR, detail="查询排程配置列表失败")


@router.get("/default", summary="获取默认排程配置")
async def get_default_scheduling_config(
    current_user: User = Depends(get_current_user),
    tenant_id: int = Depends(get_current_tenant),
):
    """获取默认排程配置（用于排程页面）"""
    try:
        config = await config_service.get_default_config(tenant_id=tenant_id)
        if config:
            return {"success": True, "data": config}
        return {"success": True, "data": None}
    except Exception as e:
        logger.error(f"获取默认排程配置失败: {e}")
        raise HTTPException(status_code=status.HTTP_500_INTERNAL_SERVER_ERROR, detail="获取默认排程配置失败")


@router.get("/{config_id}", response_model=SchedulingConfigResponse, summary="获取排程配置详情")
async def get_scheduling_config(
    config_id: int = Path(..., description="配置ID"),
    current_user: User = Depends(get_current_user),
    tenant_id: int = Depends(get_current_tenant),
):
    """获取排程配置详情"""
    try:
        return await config_service.get_config_by_id(tenant_id=tenant_id, config_id=config_id)
    except NotFoundError as e:
        raise HTTPException(status_code=status.HTTP_404_NOT_FOUND, detail=str(e))
    except Exception as e:
        logger.error(f"获取排程配置详情失败: {e}")
        raise HTTPException(status_code=status.HTTP_500_INTERNAL_SERVER_ERROR, detail="获取排程配置详情失败")


@router.put("/{config_id}", response_model=SchedulingConfigResponse, summary="更新排程配置")
async def update_scheduling_config(
    config_id: int = Path(..., description="配置ID"),
    config_data: SchedulingConfigUpdate = ...,
    current_user: User = Depends(get_current_user),
    tenant_id: int = Depends(get_current_tenant),
):
    """更新排程配置"""
    try:
        return await config_service.update_config(
            tenant_id=tenant_id,
            config_id=config_id,
            config_data=config_data,
            updated_by=current_user.id,
        )
    except NotFoundError as e:
        raise HTTPException(status_code=status.HTTP_404_NOT_FOUND, detail=str(e))
    except ValidationError as e:
        raise HTTPException(status_code=status.HTTP_400_BAD_REQUEST, detail=str(e))
    except Exception as e:
        logger.error(f"更新排程配置失败: {e}")
        raise HTTPException(status_code=status.HTTP_500_INTERNAL_SERVER_ERROR, detail="更新排程配置失败")


@router.delete("/{config_id}", summary="删除排程配置")
async def delete_scheduling_config(
    config_id: int = Path(..., description="配置ID"),
    current_user: User = Depends(get_current_user),
    tenant_id: int = Depends(get_current_tenant),
):
    """删除排程配置"""
    try:
        await config_service.delete_config(tenant_id=tenant_id, config_id=config_id)
        return {"success": True, "message": "删除成功"}
    except NotFoundError as e:
        raise HTTPException(status_code=status.HTTP_404_NOT_FOUND, detail=str(e))
    except Exception as e:
        logger.error(f"删除排程配置失败: {e}")
        raise HTTPException(status_code=status.HTTP_500_INTERNAL_SERVER_ERROR, detail="删除排程配置失败")
