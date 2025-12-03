"""
数据源管理 API 路由

提供数据源的 CRUD 操作和连接测试功能。
"""

from typing import Optional
from fastapi import APIRouter, Depends, HTTPException, status, Query
from uuid import UUID

from tree_root.schemas.data_source import (
    DataSourceCreate,
    DataSourceUpdate,
    DataSourceResponse,
    TestConnectionResponse,
)
from tree_root.services.data_source_service import DataSourceService
from tree_root.api.deps.deps import get_current_tenant
from soil.api.deps.deps import get_current_user as soil_get_current_user
from soil.models.user import User
from soil.exceptions.exceptions import NotFoundError, ValidationError

router = APIRouter(prefix="/data-sources", tags=["DataSources"])


@router.post("", response_model=DataSourceResponse, status_code=status.HTTP_201_CREATED)
async def create_data_source(
    data: DataSourceCreate,
    current_user: User = Depends(soil_get_current_user),
    tenant_id: int = Depends(get_current_tenant),
):
    """
    创建数据源
    
    创建新的数据源定义。
    
    Args:
        data: 数据源创建数据
        current_user: 当前用户（依赖注入）
        tenant_id: 当前组织ID（依赖注入）
        
    Returns:
        DataSourceResponse: 创建的数据源信息
        
    Raises:
        HTTPException: 当创建失败时抛出
    """
    try:
        data_source = await DataSourceService().create_data_source(
            tenant_id=tenant_id,
            data_source_data=data,
        )
        
        return DataSourceResponse.model_validate(data_source)
    except ValidationError as e:
        raise HTTPException(
            status_code=status.HTTP_422_UNPROCESSABLE_ENTITY,
            detail=str(e)
        )
    except Exception as e:
        raise HTTPException(
            status_code=status.HTTP_500_INTERNAL_SERVER_ERROR,
            detail=f"创建数据源失败: {str(e)}"
        )


@router.get("", response_model=dict)
async def list_data_sources(
    page: int = Query(1, ge=1, description="页码"),
    page_size: int = Query(20, ge=1, le=100, description="每页数量"),
    search: Optional[str] = Query(None, description="搜索关键词（名称、代码）"),
    type: Optional[str] = Query(None, description="数据源类型筛选"),
    is_active: Optional[bool] = Query(None, description="是否启用筛选"),
    current_user: User = Depends(soil_get_current_user),
    tenant_id: int = Depends(get_current_tenant),
):
    """
    获取数据源列表
    
    支持分页、搜索和筛选。
    
    Args:
        page: 页码
        page_size: 每页数量
        search: 搜索关键词（名称、代码）
        type: 数据源类型筛选
        is_active: 是否启用筛选
        current_user: 当前用户（依赖注入）
        tenant_id: 当前组织ID（依赖注入）
        
    Returns:
        dict: 数据源列表响应数据
        {
            "items": [...],
            "total": 100,
            "page": 1,
            "page_size": 20
        }
    """
    try:
        data_sources, total = await DataSourceService().list_data_sources(
            tenant_id=tenant_id,
            page=page,
            page_size=page_size,
            search=search,
            type=type,
            is_active=is_active,
        )
        
        return {
            "items": [DataSourceResponse.model_validate(ds) for ds in data_sources],
            "total": total,
            "page": page,
            "page_size": page_size,
        }
    except Exception as e:
        raise HTTPException(
            status_code=status.HTTP_500_INTERNAL_SERVER_ERROR,
            detail=f"获取数据源列表失败: {str(e)}"
        )


@router.get("/{data_source_uuid}", response_model=DataSourceResponse)
async def get_data_source(
    data_source_uuid: UUID,
    current_user: User = Depends(soil_get_current_user),
    tenant_id: int = Depends(get_current_tenant),
):
    """
    获取数据源详情
    
    根据数据源UUID获取数据源详细信息。
    
    Args:
        data_source_uuid: 数据源UUID
        current_user: 当前用户（依赖注入）
        tenant_id: 当前组织ID（依赖注入）
        
    Returns:
        DataSourceResponse: 数据源详情响应数据
        
    Raises:
        HTTPException: 当数据源不存在时抛出
    """
    try:
        data_source = await DataSourceService().get_data_source_by_uuid(
            tenant_id=tenant_id,
            data_source_uuid=data_source_uuid,
        )
        
        return DataSourceResponse.model_validate(data_source)
    except NotFoundError as e:
        raise HTTPException(
            status_code=status.HTTP_404_NOT_FOUND,
            detail=str(e)
        )
    except Exception as e:
        raise HTTPException(
            status_code=status.HTTP_500_INTERNAL_SERVER_ERROR,
            detail=f"获取数据源详情失败: {str(e)}"
        )


@router.put("/{data_source_uuid}", response_model=DataSourceResponse)
async def update_data_source(
    data_source_uuid: UUID,
    data: DataSourceUpdate,
    current_user: User = Depends(soil_get_current_user),
    tenant_id: int = Depends(get_current_tenant),
):
    """
    更新数据源
    
    更新数据源定义。
    
    Args:
        data_source_uuid: 数据源UUID
        data: 数据源更新数据
        current_user: 当前用户（依赖注入）
        tenant_id: 当前组织ID（依赖注入）
        
    Returns:
        DataSourceResponse: 更新后的数据源信息
        
    Raises:
        HTTPException: 当更新失败时抛出
    """
    try:
        data_source = await DataSourceService().update_data_source(
            tenant_id=tenant_id,
            data_source_uuid=data_source_uuid,
            data_source_data=data,
        )
        
        return DataSourceResponse.model_validate(data_source)
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
    except Exception as e:
        raise HTTPException(
            status_code=status.HTTP_500_INTERNAL_SERVER_ERROR,
            detail=f"更新数据源失败: {str(e)}"
        )


@router.delete("/{data_source_uuid}", status_code=status.HTTP_204_NO_CONTENT)
async def delete_data_source(
    data_source_uuid: UUID,
    current_user: User = Depends(soil_get_current_user),
    tenant_id: int = Depends(get_current_tenant),
):
    """
    删除数据源（软删除）
    
    删除数据源定义。
    
    Args:
        data_source_uuid: 数据源UUID
        current_user: 当前用户（依赖注入）
        tenant_id: 当前组织ID（依赖注入）
        
    Raises:
        HTTPException: 当删除失败时抛出
    """
    try:
        await DataSourceService().delete_data_source(
            tenant_id=tenant_id,
            data_source_uuid=data_source_uuid,
        )
    except NotFoundError as e:
        raise HTTPException(
            status_code=status.HTTP_404_NOT_FOUND,
            detail=str(e)
        )
    except Exception as e:
        raise HTTPException(
            status_code=status.HTTP_500_INTERNAL_SERVER_ERROR,
            detail=f"删除数据源失败: {str(e)}"
        )


@router.post("/{data_source_uuid}/test", response_model=TestConnectionResponse)
async def test_data_source_connection(
    data_source_uuid: UUID,
    current_user: User = Depends(soil_get_current_user),
    tenant_id: int = Depends(get_current_tenant),
):
    """
    测试数据源连接
    
    测试数据源连接并返回测试结果。
    
    Args:
        data_source_uuid: 数据源UUID
        current_user: 当前用户（依赖注入）
        tenant_id: 当前组织ID（依赖注入）
        
    Returns:
        TestConnectionResponse: 测试结果
        {
            "success": true,
            "message": "连接成功",
            "elapsed_time": 0.123
        }
        
    Raises:
        HTTPException: 当测试失败时抛出
    """
    try:
        result = await DataSourceService().test_connection(
            tenant_id=tenant_id,
            data_source_uuid=data_source_uuid,
        )
        
        return result
    except NotFoundError as e:
        raise HTTPException(
            status_code=status.HTTP_404_NOT_FOUND,
            detail=str(e)
        )
    except Exception as e:
        raise HTTPException(
            status_code=status.HTTP_500_INTERNAL_SERVER_ERROR,
            detail=f"测试数据源连接失败: {str(e)}"
        )

