"""
帮助文档 API 路由

提供帮助文档的查询和管理功能。
"""

from typing import Optional, List
from fastapi import APIRouter, Depends, HTTPException, status, Query
from pydantic import BaseModel, Field

from core.services.help.help_document_service import HelpDocumentService
from core.api.deps.deps import get_current_tenant
from infra.models.user import User
from infra.api.deps.deps import get_current_user as soil_get_current_user
from infra.exceptions.exceptions import NotFoundError

router = APIRouter(prefix="/help-documents", tags=["Help Documents"])


class HelpSectionResponse(BaseModel):
    """帮助文档章节响应"""
    title: str = Field(..., description="章节标题")
    content: str = Field(..., description="章节内容")


class HelpDocumentResponse(BaseModel):
    """帮助文档响应"""
    key: str = Field(..., description="文档标识")
    title: str = Field(..., description="文档标题")
    sections: List[HelpSectionResponse] = Field(..., description="文档章节列表")


@router.get("/{document_key}", response_model=HelpDocumentResponse)
async def get_help_document(
    document_key: str,
    tenant_id: int = Depends(get_current_tenant),
):
    """
    获取帮助文档
    
    根据文档标识获取帮助文档内容。
    
    Args:
        document_key: 文档标识（如 'user_management', 'role_management' 等）
        tenant_id: 当前组织ID（依赖注入）
        
    Returns:
        HelpDocumentResponse: 帮助文档内容
        
    Raises:
        HTTPException: 当文档不存在时抛出
    """
    try:
        document = await HelpDocumentService.get_help_document(
            tenant_id=tenant_id,
            document_key=document_key
        )
        return HelpDocumentResponse.model_validate(document)
    except NotFoundError as e:
        raise HTTPException(
            status_code=status.HTTP_404_NOT_FOUND,
            detail=str(e)
        )


@router.get("", response_model=List[HelpDocumentResponse])
async def list_help_documents(
    keyword: Optional[str] = Query(None, description="搜索关键词（可选）"),
    tenant_id: int = Depends(get_current_tenant),
):
    """
    列出所有帮助文档或搜索帮助文档
    
    如果提供了 keyword 参数，则搜索匹配的文档；否则列出所有文档。
    
    Args:
        keyword: 搜索关键词（可选）
        tenant_id: 当前组织ID（依赖注入）
        
    Returns:
        List[HelpDocumentResponse]: 帮助文档列表
    """
    if keyword:
        documents = await HelpDocumentService.search_help_documents(
            tenant_id=tenant_id,
            keyword=keyword
        )
    else:
        documents = await HelpDocumentService.list_help_documents(tenant_id=tenant_id)
    
    return [HelpDocumentResponse.model_validate(doc) for doc in documents]

