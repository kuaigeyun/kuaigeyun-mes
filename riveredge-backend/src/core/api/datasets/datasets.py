"""
数据集管理 API 路由

提供数据集的 CRUD 操作和查询执行功能。
"""

from typing import Optional
from fastapi import APIRouter, Depends, HTTPException, status, Query
from uuid import UUID

from core.schemas.dataset import (
    DatasetCreate,
    DatasetUpdate,
    DatasetResponse,
    ExecuteQueryRequest,
    ExecuteQueryResponse,
)
from core.schemas.api import APITestResponse
from core.schemas.data_source import TestConnectionResponse
from core.services.data.dataset_service import DatasetService
from core.api.deps.deps import get_current_tenant
from infra.api.deps.deps import get_current_user as soil_get_current_user
from infra.models.user import User
from infra.exceptions.exceptions import NotFoundError, ValidationError

router = APIRouter(prefix="/datasets", tags=["Datasets"])


def model_to_response(dataset, data_source_uuid: UUID) -> DatasetResponse:
    """
    将数据集模型对象转换为响应对象
    
    Args:
        dataset: 数据集模型对象
        data_source_uuid: 数据源UUID
        
    Returns:
        DatasetResponse: 数据集响应对象
    """
    return DatasetResponse(
        uuid=dataset.uuid,
        tenant_id=dataset.tenant_id,
        name=dataset.name,
        code=dataset.code,
        description=dataset.description,
        query_type=dataset.query_type,
        query_config=dataset.query_config,
        is_active=dataset.is_active,
        data_source_uuid=data_source_uuid,
        last_executed_at=dataset.last_executed_at,
        last_error=dataset.last_error,
        created_at=dataset.created_at,
        updated_at=dataset.updated_at,
    )


@router.post("", response_model=DatasetResponse, status_code=status.HTTP_201_CREATED)
async def create_dataset(
    data: DatasetCreate,
    current_user: User = Depends(soil_get_current_user),
    tenant_id: int = Depends(get_current_tenant),
):
    """
    创建数据集
    
    创建新的数据集定义。
    
    Args:
        data: 数据集创建数据
        current_user: 当前用户（依赖注入）
        tenant_id: 当前组织ID（依赖注入）
        
    Returns:
        DatasetResponse: 创建的数据集信息
        
    Raises:
        HTTPException: 当创建失败时抛出
    """
    try:
        dataset = await DatasetService().create_dataset(
            tenant_id=tenant_id,
            dataset_data=data,
        )
        
        await dataset.fetch_related('integration_config')
        data_source_uuid = UUID(str(dataset.integration_config.uuid))
        return model_to_response(dataset, data_source_uuid)
    except ValidationError as e:
        raise HTTPException(
            status_code=status.HTTP_422_UNPROCESSABLE_ENTITY,
            detail=str(e)
        )
    except Exception as e:
        raise HTTPException(
            status_code=status.HTTP_500_INTERNAL_SERVER_ERROR,
            detail=f"创建数据集失败: {str(e)}"
        )


@router.get("", response_model=dict)
async def list_datasets(
    page: int = Query(1, ge=1, description="页码"),
    page_size: int = Query(20, ge=1, le=100, description="每页数量"),
    search: Optional[str] = Query(None, description="搜索关键词（名称、代码）"),
    query_type: Optional[str] = Query(None, description="查询类型筛选"),
    data_source_uuid: Optional[UUID] = Query(None, description="数据源UUID筛选"),
    is_active: Optional[bool] = Query(None, description="是否启用筛选"),
    current_user: User = Depends(soil_get_current_user),
    tenant_id: int = Depends(get_current_tenant),
):
    """
    获取数据集列表
    
    支持分页、搜索和筛选。
    
    Args:
        page: 页码
        page_size: 每页数量
        search: 搜索关键词（名称、代码）
        query_type: 查询类型筛选
        data_source_uuid: 数据源UUID筛选
        is_active: 是否启用筛选
        current_user: 当前用户（依赖注入）
        tenant_id: 当前组织ID（依赖注入）
        
    Returns:
        dict: 数据集列表响应数据
        {
            "items": [...],
            "total": 100,
            "page": 1,
            "page_size": 20
        }
    """
    try:
        datasets, total = await DatasetService().list_datasets(
            tenant_id=tenant_id,
            page=page,
            page_size=page_size,
            search=search,
            query_type=query_type,
            data_source_uuid=data_source_uuid,
            is_active=is_active,
        )
        
        # 转换为响应对象
        items = []
        for dataset in datasets:
            await dataset.fetch_related('integration_config')
            items.append(model_to_response(dataset, UUID(str(dataset.integration_config.uuid))))
        
        return {
            "items": items,
            "total": total,
            "page": page,
            "page_size": page_size,
        }
    except Exception as e:
        raise HTTPException(
            status_code=status.HTTP_500_INTERNAL_SERVER_ERROR,
            detail=f"获取数据集列表失败: {str(e)}"
        )


@router.get("/{dataset_uuid}", response_model=DatasetResponse)
async def get_dataset(
    dataset_uuid: UUID,
    current_user: User = Depends(soil_get_current_user),
    tenant_id: int = Depends(get_current_tenant),
):
    """
    获取数据集详情
    
    根据数据集UUID获取数据集详细信息。
    
    Args:
        dataset_uuid: 数据集UUID
        current_user: 当前用户（依赖注入）
        tenant_id: 当前组织ID（依赖注入）
        
    Returns:
        DatasetResponse: 数据集详情响应数据
        
    Raises:
        HTTPException: 当数据集不存在时抛出
    """
    try:
        dataset = await DatasetService().get_dataset_by_uuid(
            tenant_id=tenant_id,
            dataset_uuid=dataset_uuid,
        )
        
        await dataset.fetch_related('integration_config')
        data_source_uuid = UUID(str(dataset.integration_config.uuid))
        return model_to_response(dataset, data_source_uuid)
    except NotFoundError as e:
        raise HTTPException(
            status_code=status.HTTP_404_NOT_FOUND,
            detail=str(e)
        )
    except Exception as e:
        raise HTTPException(
            status_code=status.HTTP_500_INTERNAL_SERVER_ERROR,
            detail=f"获取数据集详情失败: {str(e)}"
        )


@router.put("/{dataset_uuid}", response_model=DatasetResponse)
async def update_dataset(
    dataset_uuid: UUID,
    data: DatasetUpdate,
    current_user: User = Depends(soil_get_current_user),
    tenant_id: int = Depends(get_current_tenant),
):
    """
    更新数据集
    
    更新数据集定义。
    
    Args:
        dataset_uuid: 数据集UUID
        data: 数据集更新数据
        current_user: 当前用户（依赖注入）
        tenant_id: 当前组织ID（依赖注入）
        
    Returns:
        DatasetResponse: 更新后的数据集信息
        
    Raises:
        HTTPException: 当更新失败时抛出
    """
    try:
        dataset = await DatasetService().update_dataset(
            tenant_id=tenant_id,
            dataset_uuid=dataset_uuid,
            dataset_data=data,
        )
        
        await dataset.fetch_related('integration_config')
        data_source_uuid = UUID(str(dataset.integration_config.uuid))
        return model_to_response(dataset, data_source_uuid)
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
            detail=f"更新数据集失败: {str(e)}"
        )


@router.delete("/{dataset_uuid}", status_code=status.HTTP_204_NO_CONTENT)
async def delete_dataset(
    dataset_uuid: UUID,
    current_user: User = Depends(soil_get_current_user),
    tenant_id: int = Depends(get_current_tenant),
):
    """
    删除数据集（软删除）
    
    删除数据集定义。
    
    Args:
        dataset_uuid: 数据集UUID
        current_user: 当前用户（依赖注入）
        tenant_id: 当前组织ID（依赖注入）
        
    Raises:
        HTTPException: 当删除失败时抛出
    """
    try:
        await DatasetService().delete_dataset(
            tenant_id=tenant_id,
            dataset_uuid=dataset_uuid,
        )
    except NotFoundError as e:
        raise HTTPException(
            status_code=status.HTTP_404_NOT_FOUND,
            detail=str(e)
        )
    except Exception as e:
        raise HTTPException(
            status_code=status.HTTP_500_INTERNAL_SERVER_ERROR,
            detail=f"删除数据集失败: {str(e)}"
        )


@router.post("/{dataset_uuid}/execute", response_model=ExecuteQueryResponse)
async def execute_dataset_query(
    dataset_uuid: UUID,
    execute_request: ExecuteQueryRequest,
    current_user: User = Depends(soil_get_current_user),
    tenant_id: int = Depends(get_current_tenant),
):
    """
    执行数据集查询
    
    执行数据集查询并返回查询结果。
    
    Args:
        dataset_uuid: 数据集UUID
        execute_request: 执行查询请求
        current_user: 当前用户（依赖注入）
        tenant_id: 当前组织ID（依赖注入）
        
    Returns:
        ExecuteQueryResponse: 查询结果
        {
            "success": true,
            "data": [...],
            "total": 100,
            "columns": ["col1", "col2"],
            "elapsed_time": 0.123,
            "error": null
        }
        
    Raises:
        HTTPException: 当查询失败时抛出
    """
    try:
        result = await DatasetService().execute_query(
            tenant_id=tenant_id,
            dataset_uuid=dataset_uuid,
            execute_request=execute_request,
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
            detail=f"执行数据集查询失败: {str(e)}"
        )


@router.post("/{dataset_uuid}/test-api", response_model=APITestResponse)
async def test_api_for_dataset(
    dataset_uuid: UUID,
    test_parameters: Optional[dict] = None,
    current_user: User = Depends(soil_get_current_user),
    tenant_id: int = Depends(get_current_tenant),
):
    """
    使用接口管理的测试功能测试数据集关联的 API
    
    仅当数据集的 query_type 为 'api' 且 query_config 中包含 api_uuid 或 api_code 时可用。
    
    Args:
        dataset_uuid: 数据集UUID
        test_parameters: 测试参数（可选，覆盖数据集定义的参数）
        current_user: 当前用户（依赖注入）
        tenant_id: 当前组织ID（依赖注入）
        
    Returns:
        APITestResponse: 测试结果
        {
            "status_code": 200,
            "headers": {...},
            "body": {...},
            "elapsed_time": 0.123
        }
        
    Raises:
        HTTPException: 当测试失败时抛出
    """
    try:
        result = await DatasetService().test_api_for_dataset(
            tenant_id=tenant_id,
            dataset_uuid=dataset_uuid,
            test_parameters=test_parameters,
        )
        
        return APITestResponse(**result)
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
            detail=f"测试数据集 API 失败: {str(e)}"
        )


@router.post("/{dataset_uuid}/test-data-source", response_model=TestConnectionResponse)
async def test_data_source_for_dataset(
    dataset_uuid: UUID,
    current_user: User = Depends(soil_get_current_user),
    tenant_id: int = Depends(get_current_tenant),
):
    """
    使用数据源管理的测试功能测试数据集关联的数据源连接
    
    测试数据集关联的数据源连接，并返回测试结果。
    
    Args:
        dataset_uuid: 数据集UUID
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
        result = await DatasetService().test_data_source_for_dataset(
            tenant_id=tenant_id,
            dataset_uuid=dataset_uuid,
        )
        
        return TestConnectionResponse(**result)
    except NotFoundError as e:
        raise HTTPException(
            status_code=status.HTTP_404_NOT_FOUND,
            detail=str(e)
        )
    except Exception as e:
        raise HTTPException(
            status_code=status.HTTP_500_INTERNAL_SERVER_ERROR,
            detail=f"测试数据集数据源连接失败: {str(e)}"
        )


@router.post("/code/{dataset_code}/query", response_model=ExecuteQueryResponse)
async def query_dataset_by_code(
    dataset_code: str,
    execute_request: ExecuteQueryRequest,
    current_user: User = Depends(soil_get_current_user),
    tenant_id: int = Depends(get_current_tenant),
):
    """
    通过数据集代码查询数据集数据（供业务模块使用）
    
    这是一个便捷端点，供业务模块通过数据集代码快速获取数据。
    仅返回已启用且未删除的数据集数据。
    
    Args:
        dataset_code: 数据集代码
        execute_request: 执行查询请求
        current_user: 当前用户（依赖注入）
        tenant_id: 当前组织ID（依赖注入）
        
    Returns:
        ExecuteQueryResponse: 查询结果
        {
            "success": true,
            "data": [...],
            "total": 100,
            "columns": ["col1", "col2"],
            "elapsed_time": 0.123,
            "error": null
        }
        
    Raises:
        HTTPException: 当查询失败时抛出
    """
    try:
        result = await DatasetService.query_dataset_by_code(
            tenant_id=tenant_id,
            dataset_code=dataset_code,
            parameters=execute_request.parameters,
            limit=execute_request.limit or 100,
            offset=execute_request.offset or 0,
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
            detail=f"查询数据集失败: {str(e)}"
        )

