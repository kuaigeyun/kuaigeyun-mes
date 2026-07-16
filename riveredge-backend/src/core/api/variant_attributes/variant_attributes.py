"""
属性定义 API 路由

提供属性定义的 CRUD 操作、版本管理、属性验证等功能。

Author: Luigi Lu
Date: 2026-01-08
"""

from typing import Optional, List
from fastapi import APIRouter, Depends, HTTPException, status, Query, Path, Body
from pydantic import BaseModel, Field

from core.schemas.material_variant_attribute import (
    MaterialVariantAttributeDefinitionCreate,
    MaterialVariantAttributeDefinitionUpdate,
    MaterialVariantAttributeDefinitionResponse,
    MaterialVariantAttributeDefinitionListResponse,
    MaterialVariantAttributeHistoryResponse,
    VariantAttributeValidationRequest,
    VariantAttributeValidationResponse,
)
from core.services.business.material_variant_attribute_service import MaterialVariantAttributeService
from core.api.deps.deps import get_current_tenant, get_current_user_id
from infra.exceptions.exceptions import NotFoundError, ValidationError

router = APIRouter(prefix="/variant-attributes", tags=["Core - Variant Attributes"])


# ==================== 预设 ====================


class LoadPresetRequest(BaseModel):
    """加载预设请求：可指定只创建选中的属性名称"""
    attribute_names: Optional[List[str]] = Field(None, description="要创建的预设属性名称列表，不传则创建全部")


@router.get("/preset-preview", summary="Preview variant-attribute preset definitions")
async def get_preset_preview():
    """
    返回预设属性定义列表，用于预览与勾选后再确认创建。
    """
    return list(MaterialVariantAttributeService.PRESET_ATTRIBUTE_DEFINITIONS)


@router.post("/load-preset", summary="Load variant-attribute preset definitions")
async def load_preset_attribute_definitions(
    body: Optional[LoadPresetRequest] = Body(None),
    tenant_id: int = Depends(get_current_tenant),
    user_id: Optional[int] = Depends(get_current_user_id),
):
    """
    加载中国中小制造业常见属性定义预设（颜色、规格、材质、等级、表面处理等）。
    仅创建不存在的属性（按 attribute_name 去重）。
    请求体可传 attribute_names 数组，只创建选中的预设项；不传则创建全部。
    """
    attribute_names = body.attribute_names if body else None
    count = await MaterialVariantAttributeService.load_preset_sme(
        tenant_id=tenant_id, created_by=user_id, attribute_names=attribute_names
    )
    return {"created": count, "message": f"已加载 {count} 个属性定义"}


# ==================== 属性定义 CRUD ====================

@router.post("", response_model=MaterialVariantAttributeDefinitionResponse, status_code=status.HTTP_201_CREATED)
async def create_attribute_definition(
    data: MaterialVariantAttributeDefinitionCreate,
    tenant_id: int = Depends(get_current_tenant),
    user_id: Optional[int] = Depends(get_current_user_id),
):
    """
    创建属性定义
    
    Args:
        data: 属性定义创建数据
        tenant_id: 当前组织ID（依赖注入）
        user_id: 当前用户ID（依赖注入）
        
    Returns:
        MaterialVariantAttributeDefinitionResponse: 创建的属性定义对象
        
    Raises:
        HTTPException: 当创建失败时抛出
    """
    try:
        attribute_def = await MaterialVariantAttributeService.create_attribute_definition(
            tenant_id=tenant_id,
            attribute_name=data.attribute_name,
            attribute_type=data.attribute_type,
            display_name=data.display_name,
            description=data.description,
            is_required=data.is_required,
            display_order=data.display_order,
            enum_values=data.enum_values,
            allow_multiple=getattr(data, 'allow_multiple', False),
            validation_rules=data.validation_rules,
            default_value=data.default_value,
            dependencies=data.dependencies,
            is_active=data.is_active,
            created_by=user_id,
        )
        return MaterialVariantAttributeDefinitionResponse.model_validate(attribute_def)
    except ValidationError as e:
        raise HTTPException(
            status_code=status.HTTP_400_BAD_REQUEST,
            detail=str(e)
        )
    except Exception as e:
        raise HTTPException(
            status_code=status.HTTP_500_INTERNAL_SERVER_ERROR,
            detail=f"创建属性定义失败: {str(e)}"
        )


@router.get("", response_model=MaterialVariantAttributeDefinitionListResponse)
async def list_attribute_definitions(
    tenant_id: int = Depends(get_current_tenant),
    skip: int = Query(0, ge=0, description="跳过数量"),
    limit: int = Query(100, ge=1, le=1000, description="限制数量"),
    is_active: Optional[bool] = Query(None, description="是否启用（用于筛选）"),
    attribute_type: Optional[str] = Query(None, description="属性类型（用于筛选）"),
    keyword: Optional[str] = Query(None, description="模糊匹配属性名、显示名、备注"),
    attribute_name: Optional[str] = Query(None, description="属性名（模糊匹配）"),
    display_name: Optional[str] = Query(None, description="显示名（模糊匹配）"),
    created_start_date: Optional[str] = Query(None, description="创建开始日期 YYYY-MM-DD"),
    created_end_date: Optional[str] = Query(None, description="创建结束日期 YYYY-MM-DD"),
    updated_start_date: Optional[str] = Query(None, description="更新开始日期 YYYY-MM-DD"),
    updated_end_date: Optional[str] = Query(None, description="更新结束日期 YYYY-MM-DD"),
    sort_by: Optional[str] = Query(
        None,
        description="排序字段：display_order,attribute_name,display_name,created_at,updated_at",
    ),
    sort_order: Optional[str] = Query(None, description="asc 或 desc"),
):
    """
    列出属性定义（分页）
    """
    attributes, total = await MaterialVariantAttributeService.list_attribute_definitions(
        tenant_id=tenant_id,
        skip=skip,
        limit=limit,
        is_active=is_active,
        attribute_type=attribute_type,
        keyword=keyword,
        attribute_name=attribute_name,
        display_name=display_name,
        created_start_date=created_start_date,
        created_end_date=created_end_date,
        updated_start_date=updated_start_date,
        updated_end_date=updated_end_date,
        sort_by=sort_by,
        sort_order=sort_order,
    )
    return MaterialVariantAttributeDefinitionListResponse(
        items=[MaterialVariantAttributeDefinitionResponse.model_validate(attr) for attr in attributes],
        total=total,
    )


@router.get("/{uuid}", response_model=MaterialVariantAttributeDefinitionResponse)
async def get_attribute_definition(
    uuid: str = Path(..., description="属性定义的UUID"),
    tenant_id: int = Depends(get_current_tenant),
):
    """
    根据UUID获取属性定义
    
    Args:
        uuid: 属性定义的UUID
        tenant_id: 当前组织ID（依赖注入）
        
    Returns:
        MaterialVariantAttributeDefinitionResponse: 属性定义对象
        
    Raises:
        HTTPException: 当属性定义不存在时抛出
    """
    try:
        attribute_def = await MaterialVariantAttributeService.get_attribute_definition(
            tenant_id=tenant_id,
            uuid=uuid,
        )
        return MaterialVariantAttributeDefinitionResponse.model_validate(attribute_def)
    except NotFoundError as e:
        raise HTTPException(
            status_code=status.HTTP_404_NOT_FOUND,
            detail=str(e)
        )


@router.put("/{uuid}", response_model=MaterialVariantAttributeDefinitionResponse)
async def update_attribute_definition(
    uuid: str = Path(..., description="属性定义的UUID"),
    data: MaterialVariantAttributeDefinitionUpdate = Body(...),
    tenant_id: int = Depends(get_current_tenant),
    user_id: Optional[int] = Depends(get_current_user_id),
):
    """
    更新属性定义
    
    Args:
        uuid: 属性定义的UUID
        data: 属性定义更新数据
        tenant_id: 当前组织ID（依赖注入）
        user_id: 当前用户ID（依赖注入）
        
    Returns:
        MaterialVariantAttributeDefinitionResponse: 更新后的属性定义对象
        
    Raises:
        HTTPException: 当更新失败时抛出
    """
    try:
        attribute_def = await MaterialVariantAttributeService.update_attribute_definition(
            tenant_id=tenant_id,
            uuid=uuid,
            attribute_name=data.attribute_name,
            attribute_type=data.attribute_type,
            display_name=data.display_name,
            description=data.description,
            is_required=data.is_required,
            display_order=data.display_order,
            enum_values=data.enum_values,
            allow_multiple=data.allow_multiple,
            validation_rules=data.validation_rules,
            default_value=data.default_value,
            dependencies=data.dependencies,
            is_active=data.is_active,
            updated_by=user_id,
        )
        return MaterialVariantAttributeDefinitionResponse.model_validate(attribute_def)
    except NotFoundError as e:
        raise HTTPException(
            status_code=status.HTTP_404_NOT_FOUND,
            detail=str(e)
        )
    except ValidationError as e:
        raise HTTPException(
            status_code=status.HTTP_400_BAD_REQUEST,
            detail=str(e)
        )
    except Exception as e:
        raise HTTPException(
            status_code=status.HTTP_500_INTERNAL_SERVER_ERROR,
            detail=f"更新属性定义失败: {str(e)}"
        )


@router.delete("/{uuid}", status_code=status.HTTP_204_NO_CONTENT)
async def delete_attribute_definition(
    uuid: str = Path(..., description="属性定义的UUID"),
    tenant_id: int = Depends(get_current_tenant),
    user_id: Optional[int] = Depends(get_current_user_id),
):
    """
    删除属性定义（软删除）
    
    Args:
        uuid: 属性定义的UUID
        tenant_id: 当前组织ID（依赖注入）
        user_id: 当前用户ID（依赖注入）
        
    Returns:
        None
        
    Raises:
        HTTPException: 当删除失败时抛出
    """
    try:
        await MaterialVariantAttributeService.delete_attribute_definition(
            tenant_id=tenant_id,
            uuid=uuid,
            deleted_by=user_id,
        )
    except NotFoundError as e:
        raise HTTPException(
            status_code=status.HTTP_404_NOT_FOUND,
            detail=str(e)
        )
    except Exception as e:
        raise HTTPException(
            status_code=status.HTTP_500_INTERNAL_SERVER_ERROR,
            detail=f"删除属性定义失败: {str(e)}"
        )


# ==================== 版本历史 ====================

@router.get("/{uuid}/history", response_model=List[MaterialVariantAttributeHistoryResponse])
async def get_attribute_history(
    uuid: str = Path(..., description="属性定义的UUID"),
    tenant_id: int = Depends(get_current_tenant),
):
    """
    获取属性定义的版本历史
    
    Args:
        uuid: 属性定义的UUID
        tenant_id: 当前组织ID（依赖注入）
        
    Returns:
        List[MaterialVariantAttributeHistoryResponse]: 版本历史列表
        
    Raises:
        HTTPException: 当属性定义不存在时抛出
    """
    try:
        history = await MaterialVariantAttributeService.get_attribute_history(
            tenant_id=tenant_id,
            attribute_definition_uuid=uuid,
        )
        return [MaterialVariantAttributeHistoryResponse.model_validate(h) for h in history]
    except NotFoundError as e:
        raise HTTPException(
            status_code=status.HTTP_404_NOT_FOUND,
            detail=str(e)
        )


# ==================== 属性验证 ====================

@router.post("/validate", response_model=VariantAttributeValidationResponse)
async def validate_attribute_value(
    data: VariantAttributeValidationRequest,
    tenant_id: int = Depends(get_current_tenant),
):
    """
    验证属性值是否符合定义
    
    Args:
        data: 属性验证请求数据
        tenant_id: 当前组织ID（依赖注入）
        
    Returns:
        VariantAttributeValidationResponse: 验证结果
    """
    is_valid, error_message = await MaterialVariantAttributeService.validate_attribute_value(
        tenant_id=tenant_id,
        attribute_name=data.attribute_name,
        attribute_value=data.attribute_value,
    )
    return VariantAttributeValidationResponse(
        is_valid=is_valid,
        error_message=error_message,
    )
