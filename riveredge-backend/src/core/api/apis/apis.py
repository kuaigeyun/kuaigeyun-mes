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
    ApiLibraryListResponse,
    InstallApiLibraryPackRequest,
    InstallApiLibraryPackResponse,
)
from core.schemas.resource_category import (
    ResourceCategoryCreate,
    ResourceCategoryUpdate,
    ResourceCategoryResponse,
    ResourceCategoryListResponse,
)
from core.services.application.api_service import APIService
from core.services.resource.resource_category_service import ResourceCategoryService
from core.models.resource_category import RESOURCE_TYPE_API
from core.api.deps.deps import get_current_tenant
from core.api.deps.access import require_permission_codes
from infra.api.deps.deps import get_current_user as soil_get_current_user
from infra.models.user import User
from infra.exceptions.exceptions import NotFoundError, ValidationError

router = APIRouter(prefix="/apis", tags=["Core - APIs"])


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
        
        return APIService.build_api_response(api)
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
    sort_by: Optional[str] = Query(None, description="排序字段：name/code/path/method/created_at/updated_at/is_active"),
    sort_order: Optional[str] = Query(None, description="排序方向：asc 或 desc"),
    category_uuid: Optional[UUID] = Query(None, description="分类 UUID 筛选"),
    no_category: bool = Query(False, description="仅未分类"),
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
        if category_uuid and no_category:
            raise HTTPException(
                status_code=status.HTTP_422_UNPROCESSABLE_ENTITY,
                detail="category_uuid 与 no_category 不能同时使用",
            )
        apis, total = await APIService().list_apis(
            tenant_id=tenant_id,
            page=page,
            page_size=page_size,
            search=search,
            method=method,
            is_active=is_active,
            sort_by=sort_by,
            sort_order=sort_order,
            category_uuid=category_uuid,
            no_category=no_category,
        )
        
        return {
            "items": [APIService.build_api_response(api) for api in apis],
            "total": total,
            "page": page,
            "page_size": page_size,
        }
    except Exception as e:
        raise HTTPException(
            status_code=status.HTTP_500_INTERNAL_SERVER_ERROR,
            detail=f"获取接口列表失败: {str(e)}"
        )


@router.get("/categories", response_model=ResourceCategoryListResponse)
async def list_api_categories(
    current_user: User = Depends(soil_get_current_user),
    tenant_id: int = Depends(get_current_tenant),
):
    """获取接口分类列表"""
    try:
        result = await ResourceCategoryService().list_categories(tenant_id, RESOURCE_TYPE_API)
        return ResourceCategoryListResponse(**result)
    except ValidationError as e:
        raise HTTPException(status_code=status.HTTP_422_UNPROCESSABLE_ENTITY, detail=str(e))
    except Exception as e:
        raise HTTPException(
            status_code=status.HTTP_500_INTERNAL_SERVER_ERROR,
            detail=f"获取接口分类失败: {str(e)}",
        )


@router.post("/categories", response_model=ResourceCategoryResponse, status_code=status.HTTP_201_CREATED)
async def create_api_category(
    data: ResourceCategoryCreate,
    current_user: User = Depends(soil_get_current_user),
    tenant_id: int = Depends(get_current_tenant),
):
    """创建接口分类"""
    try:
        category = await ResourceCategoryService().create_category(
            tenant_id, RESOURCE_TYPE_API, data
        )
        return ResourceCategoryService()._build_response(category, 0)
    except ValidationError as e:
        raise HTTPException(status_code=status.HTTP_422_UNPROCESSABLE_ENTITY, detail=str(e))
    except Exception as e:
        raise HTTPException(
            status_code=status.HTTP_500_INTERNAL_SERVER_ERROR,
            detail=f"创建接口分类失败: {str(e)}",
        )


@router.get("/categories/{category_uuid}", response_model=ResourceCategoryResponse)
async def get_api_category(
    category_uuid: UUID,
    current_user: User = Depends(soil_get_current_user),
    tenant_id: int = Depends(get_current_tenant),
):
    """获取接口分类详情"""
    try:
        category = await ResourceCategoryService().get_category_by_uuid(
            tenant_id, RESOURCE_TYPE_API, category_uuid
        )
        count = await ResourceCategoryService()._count_items(
            tenant_id, RESOURCE_TYPE_API, category.id
        )
        return ResourceCategoryService()._build_response(category, count)
    except NotFoundError as e:
        raise HTTPException(status_code=status.HTTP_404_NOT_FOUND, detail=str(e))
    except Exception as e:
        raise HTTPException(
            status_code=status.HTTP_500_INTERNAL_SERVER_ERROR,
            detail=f"获取接口分类失败: {str(e)}",
        )


@router.put("/categories/{category_uuid}", response_model=ResourceCategoryResponse)
async def update_api_category(
    category_uuid: UUID,
    data: ResourceCategoryUpdate,
    current_user: User = Depends(soil_get_current_user),
    tenant_id: int = Depends(get_current_tenant),
):
    """更新接口分类"""
    try:
        category = await ResourceCategoryService().update_category(
            tenant_id, RESOURCE_TYPE_API, category_uuid, data
        )
        count = await ResourceCategoryService()._count_items(
            tenant_id, RESOURCE_TYPE_API, category.id
        )
        return ResourceCategoryService()._build_response(category, count)
    except NotFoundError as e:
        raise HTTPException(status_code=status.HTTP_404_NOT_FOUND, detail=str(e))
    except ValidationError as e:
        raise HTTPException(status_code=status.HTTP_422_UNPROCESSABLE_ENTITY, detail=str(e))
    except Exception as e:
        raise HTTPException(
            status_code=status.HTTP_500_INTERNAL_SERVER_ERROR,
            detail=f"更新接口分类失败: {str(e)}",
        )


@router.delete("/categories/{category_uuid}", status_code=status.HTTP_204_NO_CONTENT)
async def delete_api_category(
    category_uuid: UUID,
    current_user: User = Depends(soil_get_current_user),
    tenant_id: int = Depends(get_current_tenant),
):
    """删除接口分类（分类下接口变为未分类）"""
    try:
        await ResourceCategoryService().delete_category(
            tenant_id, RESOURCE_TYPE_API, category_uuid
        )
    except NotFoundError as e:
        raise HTTPException(status_code=status.HTTP_404_NOT_FOUND, detail=str(e))
    except Exception as e:
        raise HTTPException(
            status_code=status.HTTP_500_INTERNAL_SERVER_ERROR,
            detail=f"删除接口分类失败: {str(e)}",
        )


@router.get("/library", response_model=ApiLibraryListResponse)
async def list_api_library(
    current_user: User = Depends(soil_get_current_user),
    tenant_id: int = Depends(get_current_tenant),
):
    """获取系统接口库目录。"""
    try:
        result = await APIService().list_api_library()
        return ApiLibraryListResponse(**result)
    except Exception as e:
        raise HTTPException(
            status_code=status.HTTP_500_INTERNAL_SERVER_ERROR,
            detail=f"获取接口库失败: {str(e)}",
        )


@router.post(
    "/library/{pack_id}/install",
    response_model=InstallApiLibraryPackResponse,
    dependencies=[Depends(require_permission_codes("system:api:create"))],
)
async def install_api_library_pack(
    pack_id: str,
    data: InstallApiLibraryPackRequest,
    current_user: User = Depends(soil_get_current_user),
    tenant_id: int = Depends(get_current_tenant),
):
    """将接口库包加载到当前组织。"""
    try:
        result = await APIService().install_api_library_pack(
            tenant_id=tenant_id,
            pack_id=pack_id,
            connection_uuid=data.connection_uuid,
            item_keys=data.item_keys,
        )
        return InstallApiLibraryPackResponse(**result)
    except NotFoundError:
        raise HTTPException(status_code=status.HTTP_404_NOT_FOUND, detail="应用连接不存在")
    except ValidationError as e:
        raise HTTPException(status_code=status.HTTP_400_BAD_REQUEST, detail=str(e))
    except Exception as e:
        raise HTTPException(
            status_code=status.HTTP_500_INTERNAL_SERVER_ERROR,
            detail=f"加载接口库失败: {str(e)}",
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
        await api.fetch_related("integration_config", "category")
        
        return APIService.build_api_response(api)
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
        
        return APIService.build_api_response(api)
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

