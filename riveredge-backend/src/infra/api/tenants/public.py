"""
组织公开 API 模块

提供不需要认证的组织相关公开接口，用于注册等功能。

Author: Luigi Lu
Date: 2025-12-27
"""

from fastapi import APIRouter, Query
from loguru import logger

from infra.schemas.tenant import TenantSearchResponse, TenantCheckResponse, TenantSearchOption
from infra.models.tenant import Tenant, TenantStatus

# 创建路由（公开接口，不需要认证）
router = APIRouter(prefix="/tenants", tags=["Public Tenants"])


@router.get("/search", response_model=TenantSearchResponse)
async def search_tenants(
    keyword: str = Query(..., min_length=1, description="搜索关键词（组织代码或组织名）"),
    page: int = Query(1, ge=1, description="页码"),
    page_size: int = Query(10, ge=1, le=100, description="每页数量")
):
    """
    搜索组织（公开接口）
    
    支持通过组织代码或组织名称进行模糊搜索，用于注册时查找组织。
    此接口不需要认证，任何人都可以搜索组织。
    
    Args:
        keyword: 搜索关键词（组织代码或组织名）
        page: 页码（从 1 开始）
        page_size: 每页数量（1-100）
        
    Returns:
        TenantSearchResponse: 组织搜索结果
        
    Example:
        GET /api/v1/tenants/search?keyword=测试&page=1&page_size=10
    """
    from tortoise.expressions import Q
    
    # 构建查询：只搜索激活状态的组织
    keyword_trimmed = keyword.strip()
    
    # 模糊搜索：支持组织名称或域名（使用 Q 对象实现 OR 查询）
    if keyword_trimmed:
        query = Tenant.filter(
            Q(status=TenantStatus.ACTIVE) &
            (Q(name__icontains=keyword_trimmed) | Q(domain__icontains=keyword_trimmed))
        )
    else:
        query = Tenant.filter(status=TenantStatus.ACTIVE)
    
    # 分页查询
    total = await query.count()
    offset = (page - 1) * page_size
    tenants = await query.offset(offset).limit(page_size).all()
    
    # 转换为响应格式
    items = [
        TenantSearchOption(
            tenant_id=tenant.id,
            tenant_name=tenant.name,
            tenant_domain=tenant.domain
        )
        for tenant in tenants
    ]
    
    return TenantSearchResponse(items=items, total=total)


@router.get("/check-domain/{domain}", response_model=TenantCheckResponse)
async def check_tenant_domain(domain: str):
    """
    检查组织域名是否存在（公开接口）
    
    检查指定的组织域名是否已被使用。
    此接口不需要认证，任何人都可以检查域名。
    
    Args:
        domain: 组织域名
        
    Returns:
        TenantCheckResponse: 组织检查结果
        
    Example:
        GET /api/v1/tenants/check-domain/test-org
    """
    tenant = await Tenant.get_or_none(domain=domain)
    
    if tenant:
        return TenantCheckResponse(
            exists=True,
            tenant_id=tenant.id,
            tenant_name=tenant.name
        )
    else:
        return TenantCheckResponse(exists=False)

