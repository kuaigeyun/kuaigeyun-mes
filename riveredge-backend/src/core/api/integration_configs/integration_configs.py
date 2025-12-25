"""
集成配置管理 API 路由

提供集成配置的 CRUD 操作和连接测试功能。
"""

from typing import Optional, List, Dict, Any
from fastapi import APIRouter, Depends, HTTPException, status, Query

from core.schemas.integration_config import (
    IntegrationConfigCreate,
    IntegrationConfigUpdate,
    IntegrationConfigResponse,
    TestConnectionResponse,
)
from core.services.integration.integration_config_service import IntegrationConfigService
from core.api.deps.deps import get_current_tenant
from infra.exceptions.exceptions import NotFoundError, ValidationError

router = APIRouter(prefix="/integration-configs", tags=["IntegrationConfigs"])


@router.post("", response_model=IntegrationConfigResponse, status_code=status.HTTP_201_CREATED)
async def create_integration(
    data: IntegrationConfigCreate,
    tenant_id: int = Depends(get_current_tenant),
):
    """
    创建集成配置
    
    创建新的集成配置并保存到数据库。
    
    Args:
        data: 集成配置创建数据
        tenant_id: 当前组织ID（依赖注入）
        
    Returns:
        IntegrationConfigResponse: 创建的集成配置对象
        
    Raises:
        HTTPException: 当集成代码已存在时抛出
    """
    try:
        integration = await IntegrationConfigService.create_integration(
            tenant_id=tenant_id,
            data=data
        )
        return IntegrationConfigResponse.model_validate(integration)
    except ValidationError as e:
        raise HTTPException(
            status_code=status.HTTP_422_UNPROCESSABLE_ENTITY,
            detail=str(e)
        )


@router.get("", response_model=List[IntegrationConfigResponse])
async def list_integrations(
    skip: int = Query(0, ge=0, description="跳过数量"),
    limit: int = Query(100, ge=1, le=1000, description="限制数量"),
    type: Optional[str] = Query(None, description="集成类型（可选）"),
    is_active: Optional[bool] = Query(None, description="是否启用（可选）"),
    tenant_id: int = Depends(get_current_tenant),
):
    """
    获取集成配置列表
    
    获取当前组织的集成配置列表，支持分页和筛选。
    
    Args:
        skip: 跳过数量（默认 0）
        limit: 限制数量（默认 100，最大 1000）
        type: 集成类型（可选）
        is_active: 是否启用（可选）
        tenant_id: 当前组织ID（依赖注入）
        
    Returns:
        List[IntegrationConfigResponse]: 集成配置列表
    """
    integrations = await IntegrationConfigService.list_integrations(
        tenant_id=tenant_id,
        skip=skip,
        limit=limit,
        type=type,
        is_active=is_active
    )
    return [IntegrationConfigResponse.model_validate(integration) for integration in integrations]


@router.get("/{uuid}", response_model=IntegrationConfigResponse)
async def get_integration(
    uuid: str,
    tenant_id: int = Depends(get_current_tenant),
):
    """
    获取集成配置详情
    
    根据UUID获取集成配置的详细信息。
    
    Args:
        uuid: 集成配置UUID
        tenant_id: 当前组织ID（依赖注入）
        
    Returns:
        IntegrationConfigResponse: 集成配置对象
        
    Raises:
        HTTPException: 当集成配置不存在时抛出
    """
    try:
        integration = await IntegrationConfigService.get_integration_by_uuid(
            tenant_id=tenant_id,
            uuid=uuid
        )
        return IntegrationConfigResponse.model_validate(integration)
    except NotFoundError as e:
        raise HTTPException(
            status_code=status.HTTP_404_NOT_FOUND,
            detail=str(e)
        )


@router.put("/{uuid}", response_model=IntegrationConfigResponse)
async def update_integration(
    uuid: str,
    data: IntegrationConfigUpdate,
    tenant_id: int = Depends(get_current_tenant),
):
    """
    更新集成配置
    
    更新集成配置信息。
    
    Args:
        uuid: 集成配置UUID
        data: 集成配置更新数据
        tenant_id: 当前组织ID（依赖注入）
        
    Returns:
        IntegrationConfigResponse: 更新后的集成配置对象
        
    Raises:
        HTTPException: 当集成配置不存在时抛出
    """
    try:
        integration = await IntegrationConfigService.update_integration(
            tenant_id=tenant_id,
            uuid=uuid,
            data=data
        )
        return IntegrationConfigResponse.model_validate(integration)
    except NotFoundError as e:
        raise HTTPException(
            status_code=status.HTTP_404_NOT_FOUND,
            detail=str(e)
        )


@router.delete("/{uuid}", status_code=status.HTTP_204_NO_CONTENT)
async def delete_integration(
    uuid: str,
    tenant_id: int = Depends(get_current_tenant),
):
    """
    删除集成配置（软删除）
    
    删除集成配置（软删除）。
    
    Args:
        uuid: 集成配置UUID
        tenant_id: 当前组织ID（依赖注入）
        
    Raises:
        HTTPException: 当集成配置不存在时抛出
    """
    try:
        await IntegrationConfigService.delete_integration(
            tenant_id=tenant_id,
            uuid=uuid
        )
    except NotFoundError as e:
        raise HTTPException(
            status_code=status.HTTP_404_NOT_FOUND,
            detail=str(e)
        )


@router.post("/{uuid}/test", response_model=TestConnectionResponse)
async def test_connection(
    uuid: str,
    tenant_id: int = Depends(get_current_tenant),
):
    """
    测试连接
    
    测试集成配置的连接状态。
    
    Args:
        uuid: 集成配置UUID
        tenant_id: 当前组织ID（依赖注入）
        
    Returns:
        TestConnectionResponse: 连接测试结果
        
    Raises:
        HTTPException: 当集成配置不存在时抛出
    """
    try:
        result = await IntegrationConfigService.test_connection(
            tenant_id=tenant_id,
            uuid=uuid
        )
        return TestConnectionResponse(**result)
    except NotFoundError as e:
        raise HTTPException(
            status_code=status.HTTP_404_NOT_FOUND,
            detail=str(e)
        )

