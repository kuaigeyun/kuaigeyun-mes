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
    BatchGetFieldValuesRequest,
    CustomFieldPageConfigResponse,
)
from core.services.business.custom_field_service import CustomFieldService
from core.api.deps.deps import get_current_tenant
from core.api.deps.custom_field_access import require_custom_field_definitions_read
from core.api.deps.system_module_access import (
    require_custom_field_create,
    require_custom_field_delete,
    require_custom_field_read,
    require_custom_field_update,
)
from core.services.system.installed_feature_scope import (
    get_installed_application_codes,
    is_page_path_in_installed_apps,
)
from core.services.custom_field.custom_field_page_discovery import apply_manifest_display_overlay
from infra.api.deps.deps import get_current_user
from infra.exceptions.exceptions import NotFoundError, ValidationError
from infra.models.user import User

router = APIRouter(prefix="/custom-fields", tags=["Core - Custom Fields"])


@router.post("", response_model=CustomFieldResponse, status_code=status.HTTP_201_CREATED)
async def create_field(
    data: CustomFieldCreate,
    tenant_id: int = Depends(get_current_tenant),
    _auth: object = Depends(require_custom_field_create),
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
    _auth: object = Depends(require_custom_field_read),
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
    installed = await get_installed_application_codes(tenant_id)
    fields, total = await CustomFieldService.list_fields(
        tenant_id=tenant_id,
        table_name=table_name,
        skip=skip,
        limit=page_size,
        is_active=is_active,
        installed_app_codes=installed,
    )
    return CustomFieldListResponse(
        items=[CustomFieldResponse.model_validate(f) for f in fields],
        total=total,
        page=page,
        page_size=page_size
    )


@router.get("/associated-options", response_model=List[Dict[str, Any]])
async def get_associated_options(
    table: str = Query(..., description="关联表名"),
    display_field: str = Query("name", description="显示字段（id/name/code/title/label/description）"),
    limit: int = Query(500, ge=1, le=1000, description="最大返回数量"),
    host_resource: Optional[str] = Query(None, description="宿主 {app}:{module}，引用 display 隐式鉴权"),
    tenant_id: int = Depends(get_current_tenant),
    current_user: User = Depends(get_current_user),
    _auth: object = Depends(require_custom_field_read),
):
    """
    获取关联对象类型的下拉选项

    已注册 reference_resources 的表走 ReferenceDisplayService（含 DataScope）；
    其余表需 custom-field:read，且仅返回租户内 id/label（遗留表逐步迁入 registry）。
    """
    from core.config.associated_table_registry import reference_resource_for_table
    from core.services.reference.reference_display_service import ReferenceDisplayService

    resource_key = reference_resource_for_table(table)
    if resource_key:
        result = await ReferenceDisplayService.search(
            tenant_id=tenant_id,
            user=current_user,
            resource_key=resource_key,
            page=1,
            page_size=limit,
            host_resource=host_resource,
            is_infra_admin=bool(getattr(current_user, "is_infra_admin", False)),
            is_tenant_admin=bool(getattr(current_user, "is_tenant_admin", False)),
        )
        return [{"value": item.id, "label": item.label} for item in result["items"] if item.id is not None]

    raise HTTPException(
        status_code=status.HTTP_422_UNPROCESSABLE_ENTITY,
        detail=f"关联表 {table!r} 未注册 reference_resources，禁止裸 ORM 查询",
    )


@router.get("/associated-lookup", response_model=Dict[str, Any])
async def lookup_associated_value(
    table: str = Query(..., description="关联表名"),
    match_field: str = Query("code", description="匹配字段"),
    match_value: str = Query(..., description="匹配值（来自当前表单字段）"),
    return_field: str = Query("id", description="返回字段"),
    tenant_id: int = Depends(get_current_tenant),
    _auth: object = Depends(require_custom_field_read),
):
    """
    关联对象 VLOOKUP：用当前表单字段值在关联表中查找并返回指定字段值。
    """
    from core.config.associated_table_registry import lookup_associated_record

    result = await lookup_associated_record(
        table_name=table,
        match_field=match_field,
        match_value=match_value,
        return_field=return_field,
        tenant_id=tenant_id,
    )
    if result is None:
        return {"value": None, "recordId": None, "label": ""}
    return result


@router.get("/associated-attribute", response_model=Dict[str, Any])
async def get_associated_attribute(
    table: str = Query(..., description="关联表名"),
    record_id: int = Query(..., description="关联记录 ID（来自关联对象字段）"),
    attribute_field: str = Query("name", description="读取的属性字段"),
    tenant_id: int = Depends(get_current_tenant),
    _auth: object = Depends(require_custom_field_read),
):
    """
    关联属性：按关联记录 ID 读取关联表指定字段的值。
    """
    from core.config.associated_table_registry import get_associated_attribute_value

    result = await get_associated_attribute_value(
        table_name=table,
        record_id=record_id,
        attribute_field=attribute_field,
        tenant_id=tenant_id,
    )
    if result is None:
        return {"value": None, "label": ""}
    return result


@router.get("/system-link-fields/{table_name}", response_model=List[Dict[str, Any]])
async def list_system_link_fields(
    table_name: str,
    _auth: object = Depends(require_custom_field_read),
):
    """获取指定表可用于关联属性「关联对象字段」的系统字段列表（多为外键 ID）。"""
    from core.config.custom_field_system_fields import get_system_link_fields

    return get_system_link_fields(table_name)


@router.get("/associated-attribute-options", response_model=List[Dict[str, Any]])
async def get_associated_attribute_options(
    table: str = Query(..., description="关联表名"),
    attribute_field: str = Query("name", description="属性字段（模型列名）"),
    limit: int = Query(500, ge=1, le=1000, description="最大返回数量"),
    tenant_id: int = Depends(get_current_tenant),
    _auth: object = Depends(require_custom_field_read),
):
    """关联属性（无关联对象字段时）：列出关联表指定属性字段的全部可选值。"""
    from core.config.associated_table_registry import get_associated_attribute_options as fetch_options

    return await fetch_options(
        table_name=table,
        attribute_field=attribute_field,
        tenant_id=tenant_id,
        limit=limit,
    )


@router.get("/system-fields/{table_name}", response_model=List[Dict[str, Any]])
async def list_system_source_fields(
    table_name: str,
    _auth: object = Depends(require_custom_field_read),
):
    """获取指定表可用于关联对象源字段的系统字段列表。"""
    from core.config.custom_field_system_fields import get_system_source_fields

    return get_system_source_fields(table_name)


@router.get("/table-model-fields/{table_name}", response_model=List[Dict[str, Any]])
async def list_associated_table_model_fields(
    table_name: str,
    _auth: object = Depends(require_custom_field_read),
):
    """获取关联表真实模型字段，用于匹配字段 / 返回字段 / 属性字段配置。"""
    from core.config.custom_field_system_fields import get_associated_table_model_fields

    return get_associated_table_model_fields(table_name)


@router.get("/pages", response_model=List[CustomFieldPageConfigResponse])
async def list_custom_field_pages(
    tenant_id: int = Depends(get_current_tenant),
    _auth: object = Depends(require_custom_field_read),
):
    """
    获取自定义字段功能页面配置列表
    
    返回系统中所有支持自定义字段的功能页面配置，用于在自定义字段页面展示和配置。
    以 core.config.custom_field_pages 为完整数据源（含 table_name 等技术字段），
    展示名称（page_name、table_name_label、module）优先与各应用 manifest.custom_field_pages 对齐。
    仅返回路由归属应用已在当前租户安装并启用的页面。
    
    Returns:
        List[CustomFieldPageConfigResponse]: 功能页面配置列表
    """
    from core.config.custom_field_pages import CUSTOM_FIELD_PAGES

    installed = await get_installed_application_codes(tenant_id)
    return [
        CustomFieldPageConfigResponse(**apply_manifest_display_overlay(dict(p)))
        for p in CUSTOM_FIELD_PAGES
        if is_page_path_in_installed_apps(p.get("page_path"), installed)
    ]


@router.get("/by-table/{table_name}", response_model=List[CustomFieldResponse])
async def get_fields_by_table(
    table_name: str,
    is_active: Optional[bool] = Query(None, description="是否启用（可选）"),
    host_resource: Optional[str] = Query(None, description="宿主 {app}:{module}，业务页读取字段定义"),
    tenant_id: int = Depends(get_current_tenant),
    _auth: object = Depends(require_custom_field_definitions_read()),
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
    _auth: object = Depends(require_custom_field_read),
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
    _auth: object = Depends(require_custom_field_update),
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
    _auth: object = Depends(require_custom_field_delete),
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
    _auth: object = Depends(require_custom_field_update),
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


@router.post("/values/batch-get", response_model=Dict[str, Dict[str, Any]])
async def batch_get_field_values(
    data: BatchGetFieldValuesRequest,
    tenant_id: int = Depends(get_current_tenant),
    _auth: object = Depends(require_custom_field_read),
):
    """批量获取多条记录的自定义字段值（列表页列展示）。"""
    return await CustomFieldService.batch_get_field_values(
        tenant_id=tenant_id,
        record_table=data.record_table,
        record_ids=data.record_ids,
    )


@router.get("/values/{record_table}/{record_id}", response_model=Dict[str, Any])
async def get_field_values(
    record_table: str,
    record_id: int,
    tenant_id: int = Depends(get_current_tenant),
    _auth: object = Depends(require_custom_field_read),
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

