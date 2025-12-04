"""
打印模板管理 API 路由

提供打印模板的 CRUD 操作和模板渲染功能。
"""

from typing import Optional, List
from fastapi import APIRouter, Depends, HTTPException, status, Query

from core.schemas.print_template import (
    PrintTemplateCreate,
    PrintTemplateUpdate,
    PrintTemplateRenderRequest,
    PrintTemplateResponse,
    PrintTemplateRenderResponse,
)
from core.services.print_template_service import PrintTemplateService
from core.api.deps.deps import get_current_tenant
from infra.api.deps.deps import get_current_user as soil_get_current_user
from infra.models.user import User
from infra.exceptions.exceptions import NotFoundError, ValidationError

router = APIRouter(prefix="/print-templates", tags=["PrintTemplates"])


@router.post("", response_model=PrintTemplateResponse, status_code=status.HTTP_201_CREATED)
async def create_print_template(
    data: PrintTemplateCreate,
    current_user: User = Depends(soil_get_current_user),
    tenant_id: int = Depends(get_current_tenant),
):
    """
    创建打印模板
    
    创建新的打印模板。
    
    Args:
        data: 打印模板创建数据
        tenant_id: 当前组织ID（依赖注入）
        
    Returns:
        PrintTemplateResponse: 创建的打印模板对象
        
    Raises:
        HTTPException: 当模板代码已存在时抛出
    """
    try:
        print_template = await PrintTemplateService.create_print_template(
            tenant_id=tenant_id,
            data=data
        )
        return PrintTemplateResponse.model_validate(print_template)
    except ValidationError as e:
        raise HTTPException(
            status_code=status.HTTP_422_UNPROCESSABLE_ENTITY,
            detail=str(e)
        )


@router.get("", response_model=List[PrintTemplateResponse])
async def list_print_templates(
    skip: int = Query(0, ge=0, description="跳过数量"),
    limit: int = Query(100, ge=1, le=1000, description="限制数量"),
    type: Optional[str] = Query(None, description="模板类型（可选）"),
    is_active: Optional[bool] = Query(None, description="是否启用（可选）"),
    tenant_id: int = Depends(get_current_tenant),
):
    """
    获取打印模板列表
    
    获取当前组织的打印模板列表，支持分页和筛选。
    
    Args:
        skip: 跳过数量（默认 0）
        limit: 限制数量（默认 100，最大 1000）
        type: 模板类型（可选）
        is_active: 是否启用（可选）
        tenant_id: 当前组织ID（依赖注入）
        
    Returns:
        List[PrintTemplateResponse]: 打印模板列表
    """
    print_templates = await PrintTemplateService.list_print_templates(
        tenant_id=tenant_id,
        skip=skip,
        limit=limit,
        type=type,
        is_active=is_active
    )
    return [PrintTemplateResponse.model_validate(pt) for pt in print_templates]


@router.get("/{uuid}", response_model=PrintTemplateResponse)
async def get_print_template(
    uuid: str,
    tenant_id: int = Depends(get_current_tenant),
):
    """
    获取打印模板详情
    
    根据UUID获取打印模板详情。
    
    Args:
        uuid: 打印模板UUID
        tenant_id: 当前组织ID（依赖注入）
        
    Returns:
        PrintTemplateResponse: 打印模板对象
        
    Raises:
        HTTPException: 当打印模板不存在时抛出
    """
    try:
        print_template = await PrintTemplateService.get_print_template_by_uuid(
            tenant_id=tenant_id,
            uuid=uuid
        )
        return PrintTemplateResponse.model_validate(print_template)
    except NotFoundError as e:
        raise HTTPException(
            status_code=status.HTTP_404_NOT_FOUND,
            detail=str(e)
        )


@router.put("/{uuid}", response_model=PrintTemplateResponse)
async def update_print_template(
    uuid: str,
    data: PrintTemplateUpdate,
    current_user: User = Depends(soil_get_current_user),
    tenant_id: int = Depends(get_current_tenant),
):
    """
    更新打印模板
    
    更新打印模板信息。
    
    Args:
        uuid: 打印模板UUID
        data: 打印模板更新数据
        tenant_id: 当前组织ID（依赖注入）
        
    Returns:
        PrintTemplateResponse: 更新后的打印模板对象
        
    Raises:
        HTTPException: 当打印模板不存在时抛出
    """
    try:
        print_template = await PrintTemplateService.update_print_template(
            tenant_id=tenant_id,
            uuid=uuid,
            data=data
        )
        return PrintTemplateResponse.model_validate(print_template)
    except NotFoundError as e:
        raise HTTPException(
            status_code=status.HTTP_404_NOT_FOUND,
            detail=str(e)
        )


@router.delete("/{uuid}", status_code=status.HTTP_204_NO_CONTENT)
async def delete_print_template(
    uuid: str,
    current_user: User = Depends(soil_get_current_user),
    tenant_id: int = Depends(get_current_tenant),
):
    """
    删除打印模板
    
    软删除打印模板。
    
    Args:
        uuid: 打印模板UUID
        tenant_id: 当前组织ID（依赖注入）
        
    Raises:
        HTTPException: 当打印模板不存在时抛出
    """
    try:
        await PrintTemplateService.delete_print_template(
            tenant_id=tenant_id,
            uuid=uuid
        )
    except NotFoundError as e:
        raise HTTPException(
            status_code=status.HTTP_404_NOT_FOUND,
            detail=str(e)
        )


@router.post("/{uuid}/render", response_model=PrintTemplateRenderResponse)
async def render_print_template(
    uuid: str,
    data: PrintTemplateRenderRequest,
    current_user: User = Depends(soil_get_current_user),
    tenant_id: int = Depends(get_current_tenant),
):
    """
    渲染打印模板
    
    渲染打印模板（同步或异步）。
    
    Args:
        uuid: 打印模板UUID
        data: 渲染请求数据
        current_user: 当前用户（依赖注入）
        tenant_id: 当前组织ID（依赖注入）
        
    Returns:
        PrintTemplateRenderResponse: 渲染结果
        
    Raises:
        HTTPException: 当打印模板不存在或渲染失败时抛出
    """
    try:
        result = await PrintTemplateService.render_print_template(
            tenant_id=tenant_id,
            uuid=uuid,
            data=data
        )
        return PrintTemplateRenderResponse(**result)
    except (NotFoundError, ValidationError) as e:
        raise HTTPException(
            status_code=status.HTTP_422_UNPROCESSABLE_ENTITY,
            detail=str(e)
        )

