"""
变体属性定义 API 路由

提供变体属性定义的 CRUD 操作、版本管理、属性验证等功能。

Author: Luigi Lu
Date: 2026-01-08
"""

from typing import Optional, List
from fastapi import APIRouter, Depends, HTTPException, status, Query, Path, Body

from core.schemas.material_variant_attribute import (
    MaterialVariantAttributeDefinitionCreate,
    MaterialVariantAttributeDefinitionUpdate,
    MaterialVariantAttributeDefinitionResponse,
    MaterialVariantAttributeHistoryResponse,
    VariantAttributeValidationRequest,
    VariantAttributeValidationResponse,
)
from core.services.business.material_variant_attribute_service import MaterialVariantAttributeService
from core.api.deps.deps import get_current_tenant, get_current_user_id
from infra.exceptions.exceptions import NotFoundError, ValidationError

router = APIRouter(prefix="/variant-attributes", tags=["Variant Attributes"])


# ==================== 变体属性定义 CRUD ====================

@router.post("", response_model=MaterialVariantAttributeDefinitionResponse, status_code=status.HTTP_201_CREATED)
async def create_attribute_definition(
    data: MaterialVariantAttributeDefinitionCreate,
    tenant_id: int = Depends(get_current_tenant),
    user_id: Optional[int] = Depends(get_current_user_id),
):
    """
    创建变体属性定义
    
    Args:
        data: 变体属性定义创建数据
        tenant_id: 当前组织ID（依赖注入）
        user_id: 当前用户ID（依赖注入）
        
    Returns:
        MaterialVariantAttributeDefinitionResponse: 创建的变体属性定义对象
        
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
            detail=f"创建变体属性定义失败: {str(e)}"
        )


@router.get("", response_model=List[MaterialVariantAttributeDefinitionResponse])
async def list_attribute_definitions(
    tenant_id: int = Depends(get_current_tenant),
    is_active: Optional[bool] = Query(None, description="是否启用（用于筛选）"),
    attribute_type: Optional[str] = Query(None, description="属性类型（用于筛选）"),
):
    """
    列出变体属性定义
    
    Args:
        tenant_id: 当前组织ID（依赖注入）
        is_active: 是否启用（可选，用于筛选）
        attribute_type: 属性类型（可选，用于筛选）
        
    Returns:
        List[MaterialVariantAttributeDefinitionResponse]: 变体属性定义列表
    """
    attributes = await MaterialVariantAttributeService.list_attribute_definitions(
        tenant_id=tenant_id,
        is_active=is_active,
        attribute_type=attribute_type,
    )
    return [MaterialVariantAttributeDefinitionResponse.model_validate(attr) for attr in attributes]


@router.get("/{uuid}", response_model=MaterialVariantAttributeDefinitionResponse)
async def get_attribute_definition(
    uuid: str = Path(..., description="属性定义的UUID"),
    tenant_id: int = Depends(get_current_tenant),
):
    """
    根据UUID获取变体属性定义
    
    Args:
        uuid: 属性定义的UUID
        tenant_id: 当前组织ID（依赖注入）
        
    Returns:
        MaterialVariantAttributeDefinitionResponse: 变体属性定义对象
        
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
    更新变体属性定义
    
    Args:
        uuid: 属性定义的UUID
        data: 变体属性定义更新数据
        tenant_id: 当前组织ID（依赖注入）
        user_id: 当前用户ID（依赖注入）
        
    Returns:
        MaterialVariantAttributeDefinitionResponse: 更新后的变体属性定义对象
        
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
            detail=f"更新变体属性定义失败: {str(e)}"
        )


@router.delete("/{uuid}", status_code=status.HTTP_204_NO_CONTENT)
async def delete_attribute_definition(
    uuid: str = Path(..., description="属性定义的UUID"),
    tenant_id: int = Depends(get_current_tenant),
    user_id: Optional[int] = Depends(get_current_user_id),
):
    """
    删除变体属性定义（软删除）
    
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
            detail=f"删除变体属性定义失败: {str(e)}"
        )


# ==================== 版本历史 ====================

@router.get("/{uuid}/history", response_model=List[MaterialVariantAttributeHistoryResponse])
async def get_attribute_history(
    uuid: str = Path(..., description="属性定义的UUID"),
    tenant_id: int = Depends(get_current_tenant),
):
    """
    获取变体属性定义的版本历史
    
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
    验证变体属性值是否符合定义
    
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
