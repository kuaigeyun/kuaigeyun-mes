"""
工作时间段配置管理 API 路由

提供工作时间段配置的 CRUD 操作。

Author: Luigi Lu
Date: 2025-01-15
"""

from typing import Optional, List
from fastapi import APIRouter, Depends, HTTPException, status, Query, Path
from loguru import logger

from core.schemas.working_hours_config import (
    WorkingHoursConfigCreate,
    WorkingHoursConfigUpdate,
    WorkingHoursConfigResponse,
    WorkingHoursConfigListResponse,
)
from core.services.system.working_hours_config_service import WorkingHoursConfigService
from core.api.deps.deps import get_current_tenant, get_current_user
from infra.exceptions.exceptions import NotFoundError, ValidationError
from infra.models.user import User

router = APIRouter(prefix="/working-hours-configs", tags=["Core Working Hours"])

working_hours_config_service = WorkingHoursConfigService()


@router.post("", response_model=WorkingHoursConfigResponse, status_code=status.HTTP_201_CREATED, summary="创建工作时间段配置")
async def create_working_hours_config(
    data: WorkingHoursConfigCreate,
    tenant_id: int = Depends(get_current_tenant),
    current_user: User = Depends(get_current_user),
) -> WorkingHoursConfigResponse:
    """
    创建工作时间段配置

    创建新的工作时间段配置。

    - **data**: 工作时间段配置创建数据
    """
    try:
        return await working_hours_config_service.create_config(
            tenant_id=tenant_id,
            config_data=data,
        )
    except ValidationError as e:
        raise HTTPException(
            status_code=status.HTTP_422_UNPROCESSABLE_ENTITY,
            detail=str(e)
        )


@router.get("", response_model=List[WorkingHoursConfigListResponse], summary="获取工作时间段配置列表")
async def list_working_hours_configs(
    scope_type: Optional[str] = Query(None, description="适用范围类型"),
    scope_id: Optional[int] = Query(None, description="适用范围ID"),
    is_enabled: Optional[bool] = Query(None, description="是否启用"),
    tenant_id: int = Depends(get_current_tenant),
) -> List[WorkingHoursConfigListResponse]:
    """
    获取工作时间段配置列表

    支持按适用范围类型、适用范围ID、启用状态筛选。

    - **scope_type**: 适用范围类型（可选）
    - **scope_id**: 适用范围ID（可选）
    - **is_enabled**: 是否启用（可选）
    """
    return await working_hours_config_service.list_configs(
        tenant_id=tenant_id,
        scope_type=scope_type,
        scope_id=scope_id,
        is_enabled=is_enabled,
    )


@router.get("/{config_id}", response_model=WorkingHoursConfigResponse, summary="获取工作时间段配置详情")
async def get_working_hours_config(
    config_id: int = Path(..., description="配置ID"),
    tenant_id: int = Depends(get_current_tenant),
) -> WorkingHoursConfigResponse:
    """
    获取工作时间段配置详情

    - **config_id**: 配置ID
    """
    config = await working_hours_config_service.get_by_id(config_id)
    if not config or config.tenant_id != tenant_id:
        raise NotFoundError("工作时间段配置不存在")
    return WorkingHoursConfigResponse.model_validate(config)


@router.put("/{config_id}", response_model=WorkingHoursConfigResponse, summary="更新工作时间段配置")
async def update_working_hours_config(
    config_id: int = Path(..., description="配置ID"),
    data: WorkingHoursConfigUpdate = ...,
    tenant_id: int = Depends(get_current_tenant),
) -> WorkingHoursConfigResponse:
    """
    更新工作时间段配置

    - **config_id**: 配置ID
    - **data**: 工作时间段配置更新数据
    """
    try:
        return await working_hours_config_service.update_config(
            tenant_id=tenant_id,
            config_id=config_id,
            config_data=data,
        )
    except NotFoundError as e:
        raise HTTPException(
            status_code=status.HTTP_404_NOT_FOUND,
            detail=str(e)
        )
    except ValidationError as e:
        raise HTTPException(
            status_code=status.HTTP_422_UNPROCESSABLE_ENTITY,
            detail=str(e)
        )


@router.delete("/{config_id}", status_code=status.HTTP_204_NO_CONTENT, summary="删除工作时间段配置")
async def delete_working_hours_config(
    config_id: int = Path(..., description="配置ID"),
    tenant_id: int = Depends(get_current_tenant),
):
    """
    删除工作时间段配置

    - **config_id**: 配置ID
    """
    config = await working_hours_config_service.get_by_id(config_id)
    if not config or config.tenant_id != tenant_id:
        raise NotFoundError("工作时间段配置不存在")
    await working_hours_config_service.delete(config_id)

