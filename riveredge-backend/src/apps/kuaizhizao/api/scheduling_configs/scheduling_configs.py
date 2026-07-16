"""
排程配置API模块

提供排程配置相关的API接口。

Author: Plan - 排程管理增强
Date: 2026-02-26
"""

import uuid
from typing import Any, Optional
from fastapi import APIRouter, Depends, Query, Path, HTTPException as FastAPIHTTPException, status
from loguru import logger

from core.api.deps import get_current_user, get_current_tenant
from core.api.deps.access import require_permission_codes
from infra.models.user import User
from apps.kuaizhizao.services.scheduling_config_service import SchedulingConfigService
from apps.kuaizhizao.schemas.scheduling_config import (
    SchedulingConfigCreate,
    SchedulingConfigUpdate,
    SchedulingConfigResponse,
    SchedulingConfigListResponse,
)
from apps.kuaizhizao.schemas.scheduling_constraints import SchedulingConstraints
from infra.exceptions.exceptions import NotFoundError, ValidationError

router = APIRouter(prefix="/scheduling-configs", tags=["App - Kuaige Zhizao - Scheduling Configuration"])

config_service = SchedulingConfigService()


def _http_exception_with_trace(
    status_code: int,
    message: str,
    route: str = "/scheduling-configs",
    tenant_id: Optional[int] = None,
) -> FastAPIHTTPException:
    trace_id = uuid.uuid4().hex
    logger.warning(
        "kuaizhizao_scheduling_configs_api_error trace_id={} tenant_id={} route={} status_code={} message={}",
        trace_id,
        tenant_id,
        route,
        status_code,
        message,
    )
    return FastAPIHTTPException(
        status_code=status_code,
        detail={"message": message, "trace_id": trace_id},
    )


def HTTPException(*, status_code: int, detail: Any, **kwargs) -> FastAPIHTTPException:
    message = detail.get("message") if isinstance(detail, dict) else str(detail)
    return _http_exception_with_trace(status_code, message)


@router.post("", response_model=SchedulingConfigResponse, summary="Create scheduling config")
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


@router.get("", response_model=SchedulingConfigListResponse, summary="List scheduling configs")
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


@router.get(
    "/default",
    summary="Get default scheduling config",
    dependencies=[Depends(require_permission_codes("kuaizhizao:plan-management-scheduling:read"))],
)
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


@router.put(
    "/default",
    response_model=SchedulingConfigResponse,
    summary="Upsert default scheduling config",
    dependencies=[Depends(require_permission_codes("kuaizhizao:plan-management-scheduling:update"))],
)
async def upsert_default_scheduling_config(
    constraints: SchedulingConstraints,
    current_user: User = Depends(get_current_user),
    tenant_id: int = Depends(get_current_tenant),
):
    """创建或更新默认排程配置（排程页快速保存）。"""
    try:
        return await config_service.upsert_default_config(
            tenant_id=tenant_id,
            constraints=constraints,
            updated_by=current_user.id,
        )
    except ValidationError as e:
        raise HTTPException(status_code=status.HTTP_400_BAD_REQUEST, detail=str(e))
    except Exception as e:
        logger.error(f"保存默认排程配置失败: {e}")
        raise HTTPException(status_code=status.HTTP_500_INTERNAL_SERVER_ERROR, detail="保存默认排程配置失败")


@router.get("/{config_id}", response_model=SchedulingConfigResponse, summary="Get scheduling config")
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


@router.put("/{config_id}", response_model=SchedulingConfigResponse, summary="Update scheduling config")
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


@router.delete("/{config_id}", summary="Delete scheduling config")
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
