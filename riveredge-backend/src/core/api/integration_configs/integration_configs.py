"""
集成配置管理 API 路由

提供集成配置的 CRUD 操作和连接测试功能。
"""

from typing import Optional, Dict, Any
from fastapi import APIRouter, Depends, HTTPException, status, Query

from core.schemas.integration_config import (
    IntegrationConfigCreate,
    IntegrationConfigUpdate,
    IntegrationConfigResponse,
    TestConfigRequest,
    TestConnectionResponse,
)
from core.services.integration.integration_config_service import (
    IntegrationConfigService,
    build_integration_response,
)
from core.api.deps.deps import get_current_tenant
from infra.exceptions.exceptions import NotFoundError, ValidationError

router = APIRouter(prefix="/integration-configs", tags=["Core - Integration Configs"])


@router.post("/test-config", response_model=TestConnectionResponse)
async def test_config(
    data: TestConfigRequest,
    tenant_id: int = Depends(get_current_tenant),
):
    """
    保存前测试连接配置（不落库）
    
    用于新建/编辑数据源时，在保存前验证连接配置是否有效。
    
    Args:
        data: 包含 type 和 config 的测试请求
        tenant_id: 当前组织ID（依赖注入）
        
    Returns:
        TestConnectionResponse: 连接测试结果
    """
    result = await IntegrationConfigService.test_config(
        type_=data.type,
        config=data.config,
    )
    return TestConnectionResponse(**result)


@router.post("/ensure-system-default", status_code=status.HTTP_200_OK)
async def ensure_system_default(
    tenant_id: int = Depends(get_current_tenant),
):
    """
    加载/确保当前租户的系统默认数据源（应用主库）。

    不存在则创建；已软删除则恢复；已存在则原样返回。
    """
    try:
        result = await IntegrationConfigService.ensure_system_default(tenant_id=tenant_id)
        item = result["item"]
        return {
            "created": result["created"],
            "restored": result["restored"],
            "item": IntegrationConfigResponse(**build_integration_response(item)),
        }
    except Exception as e:
        raise HTTPException(
            status_code=status.HTTP_500_INTERNAL_SERVER_ERROR,
            detail=f"加载默认数据源失败: {str(e)}",
        )


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
        return IntegrationConfigResponse(**build_integration_response(integration))
    except ValidationError as e:
        raise HTTPException(
            status_code=status.HTTP_422_UNPROCESSABLE_ENTITY,
            detail=str(e)
        )


@router.get("", response_model=dict)
async def list_integrations(
    page: int = Query(1, ge=1, description="页码"),
    page_size: int = Query(20, ge=1, le=1000, description="每页数量"),
    type: Optional[str] = Query(None, description="集成类型（可选）"),
    is_active: Optional[bool] = Query(None, description="是否启用（可选）"),
    search: Optional[str] = Query(None, description="关键词（名称、代码、描述）"),
    sort_by: Optional[str] = Query(
        None,
        description="排序字段：name/code/type/created_at/updated_at/is_active/last_connected_at",
    ),
    sort_order: Optional[str] = Query(None, description="排序方向：asc 或 desc"),
    tenant_id: int = Depends(get_current_tenant),
):
    """
    获取集成配置列表（分页）

    Returns:
        dict: { items, total, page, page_size }
    """
    integrations, total = await IntegrationConfigService.list_integrations(
        tenant_id=tenant_id,
        page=page,
        page_size=page_size,
        type=type,
        is_active=is_active,
        search=search,
        sort_by=sort_by,
        sort_order=sort_order,
    )
    return {
        "items": [IntegrationConfigResponse(**build_integration_response(i)) for i in integrations],
        "total": total,
        "page": page,
        "page_size": page_size,
    }


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
        return IntegrationConfigResponse(**build_integration_response(integration))
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
        return IntegrationConfigResponse(**build_integration_response(integration))
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


@router.get("/{uuid}/schema", response_model=dict)
async def get_schema(
    uuid: str,
    tenant_id: int = Depends(get_current_tenant),
):
    """
    获取数据源的表/列元数据（用于图形化查询构建器）
    目前仅支持 PostgreSQL。
    """
    return await IntegrationConfigService.get_schema(tenant_id=tenant_id, uuid=uuid)


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

