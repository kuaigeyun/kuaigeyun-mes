"""
文件公开API模块

提供不需要认证的文件访问接口，用于平台LOGO等公开资源。

Author: Auto (AI Assistant)
Date: 2026-01-06
"""

from fastapi import APIRouter, HTTPException, status, Query
from core.schemas.file import FilePreviewResponse
from core.services.file.file_service import FileService
from core.services.file.file_preview_service import FilePreviewService
from infra.exceptions.exceptions import NotFoundError
from loguru import logger

# 创建路由（公开接口，不需要认证）
router = APIRouter(prefix="/files", tags=["Files (Public)"])


@router.get("/{uuid}/preview/public", response_model=FilePreviewResponse)
async def get_file_preview_public(
    uuid: str,
    category: str = Query(..., description="文件分类（用于验证是否为公开资源）"),
):
    """
    获取文件预览信息（公开接口）
    
    用于平台LOGO等公开资源的预览。
    只允许访问特定分类的文件（如 platform-logo）。
    
    Args:
        uuid: 文件UUID
        category: 文件分类（必须是 'platform-logo' 等公开资源分类）
        
    Returns:
        FilePreviewResponse: 预览信息
        
    Raises:
        HTTPException: 当文件不存在或分类不匹配时抛出
    """
    try:
        # 只允许访问公开资源分类
        allowed_categories = ['platform-logo', 'site-logo', 'platform-favicon']
        if category not in allowed_categories:
            raise HTTPException(
                status_code=status.HTTP_403_FORBIDDEN,
                detail=f"不允许访问该分类的文件。允许的分类: {allowed_categories}"
            )
        
        # 获取文件（不依赖tenant_id，因为平台LOGO是全局资源）
        # 尝试从所有租户中查找文件（通过category和uuid过滤）
        from core.models.file import File
        
        # 查询文件（通过uuid和category，不限制tenant_id）
        file = await File.get_or_none(
            uuid=uuid,
            category=category
        )
        
        if not file:
            raise NotFoundError(f"文件不存在: {uuid} (category: {category})")
        
        # 生成预览URL（使用文件所属的tenant_id）
        # 对于平台LOGO，tenant_id应该已经设置（上传时自动设置）
        tenant_id = file.tenant_id
        if tenant_id is None:
            # 如果tenant_id为None，尝试使用默认租户
            from infra.services.tenant_service import TenantService
            try:
                tenant_service = TenantService()
                default_tenant = await tenant_service.get_tenant_by_domain(
                    "default",
                    skip_tenant_filter=True
                )
                tenant_id = default_tenant.id if default_tenant else 1
            except Exception:
                tenant_id = 1
        
        preview_info = await FilePreviewService.get_preview_info(
            file_uuid=uuid,
            tenant_id=tenant_id,
        )
        
        return FilePreviewResponse(**preview_info)
        
    except NotFoundError as e:
        raise HTTPException(
            status_code=status.HTTP_404_NOT_FOUND,
            detail=str(e)
        )
    except Exception as e:
        logger.error(f"获取文件预览失败: {e}")
        raise HTTPException(
            status_code=status.HTTP_500_INTERNAL_SERVER_ERROR,
            detail=f"获取文件预览失败: {str(e)}"
        )

