"""
接口管理 API 路由

提供接口的 CRUD 操作和接口测试功能。
"""

from typing import Optional
from fastapi import APIRouter, Depends, HTTPException, status, Query
from uuid import UUID

from core.schemas.api import (
    APICreate,
    APIUpdate,
    APIResponse,
    APITestRequest,
    APITestResponse,
)
from core.services.application.api_service import APIService
from core.api.deps.deps import get_current_tenant
from infra.api.deps.deps import get_current_user as soil_get_current_user
from infra.models.user import User
from infra.exceptions.exceptions import NotFoundError, ValidationError

router = APIRouter(prefix="/apis", tags=["APIs"])


def model_to_response(model_obj, response_class, **extra_fields):
    """
    将模型对象转换为响应对象，自动排除id字段

    Args:
        model_obj: Tortoise模型实例
        response_class: 响应Schema类
        **extra_fields: 额外的字段

    Returns:
        响应对象实例
    """
    obj_dict = model_obj.__dict__.copy()
    # 移除内部ID字段，只保留UUID
    if 'id' in obj_dict:
        del obj_dict['id']

    # 创建响应对象
    response = response_class(**obj_dict)

    # 设置额外字段
    for key, value in extra_fields.items():
        setattr(response, key, value)

    return response


@router.post("", response_model=APIResponse, status_code=status.HTTP_201_CREATED)
async def create_api(
    data: APICreate,
    current_user: User = Depends(soil_get_current_user),
    tenant_id: int = Depends(get_current_tenant),
):
    """
    创建接口
    
    创建新的接口定义。
    
    Args:
        data: 接口创建数据
        current_user: 当前用户（依赖注入）
        tenant_id: 当前组织ID（依赖注入）
        
    Returns:
        APIResponse: 创建的接口信息
        
    Raises:
        HTTPException: 当创建失败时抛出
    """
    try:
        api = await APIService().create_api(
            tenant_id=tenant_id,
            api_data=data,
        )
        
        return APIResponse.model_validate(api)
    except ValidationError as e:
        raise HTTPException(
            status_code=status.HTTP_422_UNPROCESSABLE_ENTITY,
            detail=str(e)
        )
    except Exception as e:
        raise HTTPException(
            status_code=status.HTTP_500_INTERNAL_SERVER_ERROR,
            detail=f"创建接口失败: {str(e)}"
        )


@router.get("", response_model=dict)
async def list_apis(
    page: int = Query(1, ge=1, description="页码"),
    page_size: int = Query(20, ge=1, le=100, description="每页数量"),
    search: Optional[str] = Query(None, description="搜索关键词（名称、代码、路径）"),
    method: Optional[str] = Query(None, description="请求方法筛选"),
    is_active: Optional[bool] = Query(None, description="是否启用筛选"),
    current_user: User = Depends(soil_get_current_user),
    tenant_id: int = Depends(get_current_tenant),
):
    """
    获取接口列表
    
    支持分页、搜索和筛选。
    
    Args:
        page: 页码
        page_size: 每页数量
        search: 搜索关键词（名称、代码、路径）
        method: 请求方法筛选
        is_active: 是否启用筛选
        current_user: 当前用户（依赖注入）
        tenant_id: 当前组织ID（依赖注入）
        
    Returns:
        dict: 接口列表响应数据
        {
            "items": [...],
            "total": 100,
            "page": 1,
            "page_size": 20
        }
    """
    try:
        apis, total = await APIService().list_apis(
            tenant_id=tenant_id,
            page=page,
            page_size=page_size,
            search=search,
            method=method,
            is_active=is_active,
        )
        
        return {
            "items": [APIResponse.model_validate(api) for api in apis],
            "total": total,
            "page": page,
            "page_size": page_size,
        }
    except Exception as e:
        raise HTTPException(
            status_code=status.HTTP_500_INTERNAL_SERVER_ERROR,
            detail=f"获取接口列表失败: {str(e)}"
        )


@router.get("/{api_uuid}", response_model=APIResponse)
async def get_api(
    api_uuid: UUID,
    current_user: User = Depends(soil_get_current_user),
    tenant_id: int = Depends(get_current_tenant),
):
    """
    获取接口详情
    
    根据接口UUID获取接口详细信息。
    
    Args:
        api_uuid: 接口UUID
        current_user: 当前用户（依赖注入）
        tenant_id: 当前组织ID（依赖注入）
        
    Returns:
        APIResponse: 接口详情响应数据
        
    Raises:
        HTTPException: 当接口不存在时抛出
    """
    try:
        api = await APIService().get_api_by_uuid(
            tenant_id=tenant_id,
            api_uuid=api_uuid,
        )
        
        return APIResponse.model_validate(api)
    except NotFoundError as e:
        raise HTTPException(
            status_code=status.HTTP_404_NOT_FOUND,
            detail=str(e)
        )
    except Exception as e:
        raise HTTPException(
            status_code=status.HTTP_500_INTERNAL_SERVER_ERROR,
            detail=f"获取接口详情失败: {str(e)}"
        )


@router.put("/{api_uuid}", response_model=APIResponse)
async def update_api(
    api_uuid: UUID,
    data: APIUpdate,
    current_user: User = Depends(soil_get_current_user),
    tenant_id: int = Depends(get_current_tenant),
):
    """
    更新接口
    
    更新接口定义。
    
    Args:
        api_uuid: 接口UUID
        data: 接口更新数据
        current_user: 当前用户（依赖注入）
        tenant_id: 当前组织ID（依赖注入）
        
    Returns:
        APIResponse: 更新后的接口信息
        
    Raises:
        HTTPException: 当更新失败时抛出
    """
    try:
        api = await APIService().update_api(
            tenant_id=tenant_id,
            api_uuid=api_uuid,
            api_data=data,
        )
        
        return APIResponse.model_validate(api)
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
            detail=f"更新接口失败: {str(e)}"
        )


@router.delete("/{api_uuid}", status_code=status.HTTP_204_NO_CONTENT)
async def delete_api(
    api_uuid: UUID,
    current_user: User = Depends(soil_get_current_user),
    tenant_id: int = Depends(get_current_tenant),
):
    """
    删除接口（软删除）
    
    删除接口定义。系统接口不可删除。
    
    Args:
        api_uuid: 接口UUID
        current_user: 当前用户（依赖注入）
        tenant_id: 当前组织ID（依赖注入）
        
    Raises:
        HTTPException: 当删除失败时抛出
    """
    try:
        await APIService().delete_api(
            tenant_id=tenant_id,
            api_uuid=api_uuid,
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
    except Exception as e:
        raise HTTPException(
            status_code=status.HTTP_500_INTERNAL_SERVER_ERROR,
            detail=f"删除接口失败: {str(e)}"
        )


@router.post("/{api_uuid}/test", response_model=APITestResponse)
async def test_api(
    api_uuid: UUID,
    test_request: APITestRequest,
    timeout: float = Query(30.0, ge=1.0, le=300.0, description="请求超时时间（秒）"),
    current_user: User = Depends(soil_get_current_user),
    tenant_id: int = Depends(get_current_tenant),
):
    """
    测试接口调用
    
    调用接口并返回测试结果。
    
    Args:
        api_uuid: 接口UUID
        test_request: 测试请求数据（可覆盖接口定义的参数）
        timeout: 请求超时时间（秒）
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
        result = await APIService().test_api(
            tenant_id=tenant_id,
            api_uuid=api_uuid,
            test_request=test_request,
            timeout=timeout,
        )
        
        return APITestResponse(**result)
    except NotFoundError as e:
        raise HTTPException(
            status_code=status.HTTP_404_NOT_FOUND,
            detail=str(e)
        )
    except Exception as e:
        raise HTTPException(
            status_code=status.HTTP_500_INTERNAL_SERVER_ERROR,
            detail=f"测试接口失败: {str(e)}"
        )

