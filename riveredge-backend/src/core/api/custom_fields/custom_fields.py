"""
自定义字段管理 API 路由

提供自定义字段的 CRUD 操作和字段值管理。
"""

from typing import Optional, List, Dict, Any
from fastapi import APIRouter, Depends, HTTPException, status, Query, Body

from core.schemas.custom_field import (
    CustomFieldCreate,
    CustomFieldUpdate,
    CustomFieldResponse,
    CustomFieldListResponse,
    CustomFieldValueRequest,
    CustomFieldValueResponse,
    BatchSetFieldValuesRequest,
    CustomFieldPageConfigResponse,
)
from core.services.business.custom_field_service import CustomFieldService
from core.api.deps.deps import get_current_tenant
from infra.exceptions.exceptions import NotFoundError, ValidationError

router = APIRouter(prefix="/custom-fields", tags=["Custom Fields"])


@router.post("", response_model=CustomFieldResponse, status_code=status.HTTP_201_CREATED)
async def create_field(
    data: CustomFieldCreate,
    tenant_id: int = Depends(get_current_tenant),
):
    """
    创建自定义字段
    
    创建新自定义字段并保存到数据库。
    
    Args:
        data: 自定义字段创建数据
        tenant_id: 当前组织ID（依赖注入）
        
    Returns:
        CustomFieldResponse: 创建的自定义字段对象
        
    Raises:
        HTTPException: 当字段代码已存在时抛出
    """
    try:
        field = await CustomFieldService.create_field(
            tenant_id=tenant_id,
            data=data
        )
        return CustomFieldResponse.model_validate(field)
    except ValidationError as e:
        raise HTTPException(
            status_code=status.HTTP_422_UNPROCESSABLE_ENTITY,
            detail=str(e)
        )


@router.get("", response_model=CustomFieldListResponse)
async def list_fields(
    page: int = Query(1, ge=1, description="页码（从1开始）"),
    page_size: int = Query(20, ge=1, le=1000, description="每页数量（最大1000）"),
    table_name: Optional[str] = Query(None, description="表名（可选，用于筛选）"),
    is_active: Optional[bool] = Query(None, description="是否启用（可选）"),
    tenant_id: int = Depends(get_current_tenant),
):
    """
    获取自定义字段列表
    
    获取当前组织的自定义字段列表，支持分页和筛选。
    
    Args:
        page: 页码（从1开始，默认 1）
        page_size: 每页数量（默认 20，最大 1000）
        table_name: 表名（可选，用于筛选）
        is_active: 是否启用（可选）
        tenant_id: 当前组织ID（依赖注入）
        
    Returns:
        CustomFieldListResponse: 自定义字段列表响应（包含分页信息）
    """
    skip = (page - 1) * page_size
    fields, total = await CustomFieldService.list_fields(
        tenant_id=tenant_id,
        table_name=table_name,
        skip=skip,
        limit=page_size,
        is_active=is_active
    )
    return CustomFieldListResponse(
        items=[CustomFieldResponse.model_validate(f) for f in fields],
        total=total,
        page=page,
        page_size=page_size
    )


@router.get("/pages", response_model=List[CustomFieldPageConfigResponse])
async def list_custom_field_pages():
    """
    获取自定义字段功能页面配置列表
    
    返回系统中所有支持自定义字段的功能页面配置，用于在自定义字段页面展示和配置。
    通过服务发现机制自动从应用的 manifest.json 中提取页面配置。
    
    Returns:
        List[CustomFieldPageConfigResponse]: 功能页面配置列表
    """
    import logging
    logger = logging.getLogger(__name__)
    
    from core.services.custom_field.custom_field_page_discovery import CustomFieldPageDiscoveryService
    
    try:
        # 使用服务发现获取页面配置
        pages = CustomFieldPageDiscoveryService.get_all_pages()
        logger.info(f"🔍 自定义字段页面发现: 获取到 {len(pages)} 个页面配置")
        
        if not pages:
            logger.warning("⚠️ 自定义字段页面发现: 未发现任何页面配置")
        
        return [CustomFieldPageConfigResponse(**page) for page in pages]
    except Exception as e:
        logger.error(f"❌ 获取自定义字段页面配置失败: {e}", exc_info=True)
        # 返回空列表而不是抛出异常，避免前端崩溃
        return []


@router.get("/by-table/{table_name}", response_model=List[CustomFieldResponse])
async def get_fields_by_table(
    table_name: str,
    is_active: Optional[bool] = Query(None, description="是否启用（可选）"),
    tenant_id: int = Depends(get_current_tenant),
):
    """
    获取指定表的所有自定义字段
    
    获取指定表的所有自定义字段，用于动态表单渲染。
    
    Args:
        table_name: 表名
        is_active: 是否启用（可选）
        tenant_id: 当前组织ID（依赖注入）
        
    Returns:
        List[CustomFieldResponse]: 自定义字段列表
    """
    fields = await CustomFieldService.get_fields_by_table(
        tenant_id=tenant_id,
        table_name=table_name,
        is_active=is_active
    )
    return [CustomFieldResponse.model_validate(f) for f in fields]


@router.get("/{uuid}", response_model=CustomFieldResponse)
async def get_field(
    uuid: str,
    tenant_id: int = Depends(get_current_tenant),
):
    """
    获取自定义字段详情
    
    根据UUID获取自定义字段的详细信息。
    
    Args:
        uuid: 字段UUID
        tenant_id: 当前组织ID（依赖注入）
        
    Returns:
        CustomFieldResponse: 自定义字段对象
        
    Raises:
        HTTPException: 当字段不存在时抛出
    """
    try:
        field = await CustomFieldService.get_field_by_uuid(
            tenant_id=tenant_id,
            uuid=uuid
        )
        return CustomFieldResponse.model_validate(field)
    except NotFoundError as e:
        raise HTTPException(
            status_code=status.HTTP_404_NOT_FOUND,
            detail=str(e)
        )


@router.put("/{uuid}", response_model=CustomFieldResponse)
async def update_field(
    uuid: str,
    data: CustomFieldUpdate,
    tenant_id: int = Depends(get_current_tenant),
):
    """
    更新自定义字段
    
    更新自定义字段信息。
    
    Args:
        uuid: 字段UUID
        data: 自定义字段更新数据
        tenant_id: 当前组织ID（依赖注入）
        
    Returns:
        CustomFieldResponse: 更新后的自定义字段对象
        
    Raises:
        HTTPException: 当字段不存在时抛出
    """
    try:
        field = await CustomFieldService.update_field(
            tenant_id=tenant_id,
            uuid=uuid,
            data=data
        )
        return CustomFieldResponse.model_validate(field)
    except NotFoundError as e:
        raise HTTPException(
            status_code=status.HTTP_404_NOT_FOUND,
            detail=str(e)
        )


@router.delete("/{uuid}", status_code=status.HTTP_204_NO_CONTENT)
async def delete_field(
    uuid: str,
    tenant_id: int = Depends(get_current_tenant),
):
    """
    删除自定义字段（软删除）
    
    删除自定义字段（软删除）。
    
    Args:
        uuid: 字段UUID
        tenant_id: 当前组织ID（依赖注入）
        
    Raises:
        HTTPException: 当字段不存在时抛出
    """
    try:
        await CustomFieldService.delete_field(
            tenant_id=tenant_id,
            uuid=uuid
        )
    except NotFoundError as e:
        raise HTTPException(
            status_code=status.HTTP_404_NOT_FOUND,
            detail=str(e)
        )


@router.post("/values", response_model=Dict[str, Any])
async def batch_set_field_values(
    data: BatchSetFieldValuesRequest,
    tenant_id: int = Depends(get_current_tenant),
):
    """
    批量设置字段值
    
    批量设置多个自定义字段的值。
    
    Args:
        data: 批量设置字段值请求数据
        tenant_id: 当前组织ID（依赖注入）
        
    Returns:
        Dict[str, Any]: 设置结果
    """
    values = [{"field_uuid": v.field_uuid, "value": v.value} for v in data.values]
    result = await CustomFieldService.batch_set_field_values(
        tenant_id=tenant_id,
        record_table=data.record_table,
        record_id=data.record_id,
        values=values
    )
    return result


@router.get("/values/{record_table}/{record_id}", response_model=Dict[str, Any])
async def get_field_values(
    record_table: str,
    record_id: int,
    tenant_id: int = Depends(get_current_tenant),
):
    """
    获取记录的所有自定义字段值
    
    获取指定记录的所有自定义字段值。
    
    Args:
        record_table: 关联表名
        record_id: 关联记录ID
        tenant_id: 当前组织ID（依赖注入）
        
    Returns:
        Dict[str, Any]: 字段值字典（key 为字段代码，value 为字段值）
    """
    values = await CustomFieldService.get_field_values(
        tenant_id=tenant_id,
        record_table=record_table,
        record_id=record_id
    )
    return values

