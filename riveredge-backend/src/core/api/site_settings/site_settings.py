"""
站点设置管理 API 路由

提供站点设置的获取和更新操作。
"""

from fastapi import APIRouter, Depends, HTTPException, status

from core.schemas.site_setting import SiteSettingUpdate, SiteSettingResponse
from core.services.system.site_setting_service import SiteSettingService
from core.api.deps.deps import get_current_tenant

router = APIRouter(prefix="/site-settings", tags=["Site Settings"])


@router.get("", response_model=SiteSettingResponse)
async def get_settings(
    tenant_id: int = Depends(get_current_tenant),
):
    """
    获取站点设置
    
    获取当前组织的站点设置，如果不存在则自动创建。
    
    Args:
        tenant_id: 当前组织ID（依赖注入）
        
    Returns:
        SiteSettingResponse: 站点设置对象
    """
    settings = await SiteSettingService.get_settings(tenant_id)
    return SiteSettingResponse.model_validate(settings)


@router.put("", response_model=SiteSettingResponse)
async def update_settings(
    data: SiteSettingUpdate,
    tenant_id: int = Depends(get_current_tenant),
):
    """
    更新站点设置
    
    更新当前组织的站点设置。
    
    Args:
        data: 站点设置更新数据
        tenant_id: 当前组织ID（依赖注入）
        
    Returns:
        SiteSettingResponse: 更新后的站点设置对象
    """
    settings = await SiteSettingService.update_settings(tenant_id, data)
    return SiteSettingResponse.model_validate(settings)

