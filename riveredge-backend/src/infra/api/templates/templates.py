"""
行业模板 API 模块

提供行业模板相关的 RESTful API 接口。

Author: Luigi Lu
Date: 2025-01-15
"""

from fastapi import APIRouter, Depends, HTTPException, status, Path, Query
from loguru import logger
from typing import Optional

from infra.schemas.industry_template import (
    IndustryTemplateCreate,
    IndustryTemplateUpdate,
    IndustryTemplateResponse,
    IndustryTemplateListResponse,
    ApplyTemplateRequest,
)
from infra.services.industry_template_service import IndustryTemplateService
from infra.api.deps.deps import get_current_user
from infra.models.user import User

# 创建路由
router = APIRouter(prefix="/templates", tags=["Industry Templates"])


def get_industry_template_service() -> IndustryTemplateService:
    """获取行业模板服务实例"""
    return IndustryTemplateService()


@router.get("", response_model=IndustryTemplateListResponse)
async def get_template_list(
    industry: Optional[str] = Query(None, description="行业类型筛选"),
    is_active: Optional[bool] = Query(True, description="是否只返回启用的模板"),
    current_user: User = Depends(get_current_user),
    template_service: IndustryTemplateService = Depends(get_industry_template_service)
) -> IndustryTemplateListResponse:
    """
    获取行业模板列表
    
    返回所有可用的行业模板列表，支持按行业类型和启用状态筛选。
    
    Args:
        industry: 行业类型筛选（可选）
        is_active: 是否只返回启用的模板（可选，默认True）
        current_user: 当前用户（通过依赖注入获取）
        template_service: 行业模板服务（通过依赖注入获取）
        
    Returns:
        IndustryTemplateListResponse: 模板列表响应
    """
    return await template_service.get_template_list(
        industry=industry,
        is_active=is_active
    )


@router.get("/{template_id}", response_model=IndustryTemplateResponse)
async def get_template_by_id(
    template_id: int = Path(..., description="模板ID"),
    current_user: User = Depends(get_current_user),
    template_service: IndustryTemplateService = Depends(get_industry_template_service)
) -> IndustryTemplateResponse:
    """
    根据ID获取行业模板详情
    
    Args:
        template_id: 模板ID（路径参数）
        current_user: 当前用户（通过依赖注入获取）
        template_service: 行业模板服务（通过依赖注入获取）
        
    Returns:
        IndustryTemplateResponse: 模板详情响应
    """
    template = await template_service.get_template_by_id(template_id)
    
    return IndustryTemplateResponse(
        id=template.id,
        uuid=template.uuid,
        name=template.name,
        code=template.code,
        industry=template.industry,
        description=template.description,
        config=template.config,
        is_active=template.is_active,
        is_default=template.is_default,
        sort_order=template.sort_order,
        usage_count=template.usage_count,
        last_used_at=template.last_used_at,
        created_at=template.created_at,
        updated_at=template.updated_at,
    )


@router.post("/{template_id}/apply")
async def apply_template(
    template_id: int = Path(..., description="模板ID"),
    tenant_id: int = Query(..., description="组织ID"),
    current_user: User = Depends(get_current_user),
    template_service: IndustryTemplateService = Depends(get_industry_template_service)
) -> dict:
    """
    应用行业模板到指定组织
    
    将模板配置应用到组织，包括编码规则、系统参数、默认角色等。
    
    Args:
        template_id: 模板ID（路径参数）
        tenant_id: 组织ID（查询参数）
        current_user: 当前用户（通过依赖注入获取）
        template_service: 行业模板服务（通过依赖注入获取）
        
    Returns:
        dict: 应用结果
    """
    # 验证用户是否有权限访问该组织
    if current_user.tenant_id != tenant_id:
        raise HTTPException(
            status_code=status.HTTP_403_FORBIDDEN,
            detail="无权访问该组织"
        )
    
    return await template_service.apply_template_to_tenant(template_id, tenant_id)

