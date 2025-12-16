"""
系统参数管理 API 路由

提供系统参数的 CRUD 操作和批量更新功能。
"""

from typing import Optional, List, Dict, Any
from fastapi import APIRouter, Depends, HTTPException, status, Query, Body

from core.schemas.system_parameter import (
    SystemParameterCreate,
    SystemParameterUpdate,
    SystemParameterResponse,
)
from core.services.system_parameter_service import SystemParameterService
from core.api.deps.deps import get_current_tenant
from infra.exceptions.exceptions import NotFoundError, ValidationError

router = APIRouter(prefix="/system-parameters", tags=["Core Parameters"])


@router.post("", response_model=SystemParameterResponse, status_code=status.HTTP_201_CREATED)
async def create_parameter(
    data: SystemParameterCreate,
    tenant_id: int = Depends(get_current_tenant),
):
    """
    创建系统参数
    
    创建新系统参数并保存到数据库，同时写入 Redis 缓存。
    
    Args:
        data: 系统参数创建数据
        tenant_id: 当前组织ID（依赖注入）
        
    Returns:
        SystemParameterResponse: 创建的系统参数对象
        
    Raises:
        HTTPException: 当参数键已存在或数据验证失败时抛出
    """
    try:
        parameter = await SystemParameterService.create_parameter(
            tenant_id=tenant_id,
            data=data
        )
        return SystemParameterResponse.model_validate(parameter)
    except ValidationError as e:
        raise HTTPException(
            status_code=status.HTTP_422_UNPROCESSABLE_ENTITY,
            detail=str(e)
        )


@router.get("", response_model=List[SystemParameterResponse])
async def list_parameters(
    skip: int = Query(0, ge=0, description="跳过数量"),
    limit: int = Query(100, ge=1, le=1000, description="限制数量"),
    is_active: Optional[bool] = Query(None, description="是否启用（可选）"),
    tenant_id: int = Depends(get_current_tenant),
):
    """
    获取系统参数列表
    
    获取当前组织的系统参数列表，支持分页和筛选。
    
    Args:
        skip: 跳过数量（默认 0）
        limit: 限制数量（默认 100，最大 1000）
        is_active: 是否启用（可选）
        tenant_id: 当前组织ID（依赖注入）
        
    Returns:
        List[SystemParameterResponse]: 系统参数列表
    """
    parameters = await SystemParameterService.list_parameters(
        tenant_id=tenant_id,
        skip=skip,
        limit=limit,
        is_active=is_active
    )
    return [SystemParameterResponse.model_validate(p) for p in parameters]


@router.get("/{uuid}", response_model=SystemParameterResponse)
async def get_parameter(
    uuid: str,
    tenant_id: int = Depends(get_current_tenant),
):
    """
    获取系统参数详情
    
    根据UUID获取系统参数的详细信息。
    
    Args:
        uuid: 参数UUID
        tenant_id: 当前组织ID（依赖注入）
        
    Returns:
        SystemParameterResponse: 系统参数对象
        
    Raises:
        HTTPException: 当参数不存在时抛出
    """
    try:
        parameter = await SystemParameterService.get_parameter_by_uuid(
            tenant_id=tenant_id,
            uuid=uuid
        )
        return SystemParameterResponse.model_validate(parameter)
    except NotFoundError as e:
        raise HTTPException(
            status_code=status.HTTP_404_NOT_FOUND,
            detail=str(e)
        )


@router.get("/key/{key}", response_model=SystemParameterResponse)
async def get_parameter_by_key(
    key: str,
    tenant_id: int = Depends(get_current_tenant),
):
    """
    根据键获取系统参数（优先从缓存读取）
    
    根据参数键获取系统参数，优先从 Redis 缓存读取，提升性能。
    
    Args:
        key: 参数键
        tenant_id: 当前组织ID（依赖注入）
        
    Returns:
        SystemParameterResponse: 系统参数对象
        
    Raises:
        HTTPException: 当参数不存在时抛出
    """
    parameter = await SystemParameterService.get_parameter(
        tenant_id=tenant_id,
        key=key,
        use_cache=True
    )
    
    if not parameter:
        raise HTTPException(
            status_code=status.HTTP_404_NOT_FOUND,
            detail="参数不存在"
        )
    
    return SystemParameterResponse.model_validate(parameter)


@router.put("/{uuid}", response_model=SystemParameterResponse)
async def update_parameter(
    uuid: str,
    data: SystemParameterUpdate,
    tenant_id: int = Depends(get_current_tenant),
):
    """
    更新系统参数
    
    更新系统参数并同步更新 Redis 缓存。
    
    Args:
        uuid: 参数UUID
        data: 系统参数更新数据
        tenant_id: 当前组织ID（依赖注入）
        
    Returns:
        SystemParameterResponse: 更新后的系统参数对象
        
    Raises:
        HTTPException: 当参数不存在或数据验证失败时抛出
    """
    try:
        parameter = await SystemParameterService.update_parameter(
            tenant_id=tenant_id,
            uuid=uuid,
            data=data
        )
        return SystemParameterResponse.model_validate(parameter)
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


@router.delete("/{uuid}", status_code=status.HTTP_204_NO_CONTENT)
async def delete_parameter(
    uuid: str,
    tenant_id: int = Depends(get_current_tenant),
):
    """
    删除系统参数（软删除）
    
    删除系统参数（软删除），同时清除 Redis 缓存。
    系统参数不可删除。
    
    Args:
        uuid: 参数UUID
        tenant_id: 当前组织ID（依赖注入）
        
    Raises:
        HTTPException: 当参数不存在或是系统参数时抛出
    """
    try:
        await SystemParameterService.delete_parameter(
            tenant_id=tenant_id,
            uuid=uuid
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


@router.post("/batch-update", response_model=List[SystemParameterResponse])
async def batch_update_parameters(
    updates: Dict[str, Any] = Body(..., description="批量更新字典，key 为参数键，value 为参数值"),
    tenant_id: int = Depends(get_current_tenant),
):
    """
    批量更新系统参数
    
    批量更新多个系统参数，同时同步更新 Redis 缓存。
    
    Args:
        updates: 批量更新字典，key 为参数键，value 为参数值
        tenant_id: 当前组织ID（依赖注入）
        
    Returns:
        List[SystemParameterResponse]: 更新后的系统参数列表
    """
    parameters = await SystemParameterService.batch_update_parameters(
        tenant_id=tenant_id,
        updates=updates
    )
    return [SystemParameterResponse.model_validate(p) for p in parameters]

