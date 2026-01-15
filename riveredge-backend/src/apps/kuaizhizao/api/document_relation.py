"""
单据关联关系API模块

提供单据关联关系查询的API接口。

Author: Luigi Lu
Date: 2025-01-14
"""

from fastapi import APIRouter, Depends, HTTPException
from typing import Dict, Any

from core.dependencies import get_current_user, get_current_tenant
from infra.models.user import User
from apps.kuaizhizao.services.document_relation_new_service import DocumentRelationNewService
from apps.kuaizhizao.schemas.document_relation import DocumentRelationListResponse
from infra.exceptions.exceptions import NotFoundError, ValidationError

router = APIRouter(prefix="/document-relations", tags=["单据关联关系"])


@router.get("/{document_type}/{document_id}", response_model=DocumentRelationListResponse, summary="获取单据关联关系")
async def get_document_relations(
    document_type: str,
    document_id: int,
    current_user: User = Depends(get_current_user),
    tenant_id: int = Depends(get_current_tenant)
) -> DocumentRelationListResponse:
    """
    获取单据的关联关系（上游和下游单据）
    
    Args:
        document_type: 单据类型（如：demand、work_order等）
        document_id: 单据ID
        
    Returns:
        DocumentRelationListResponse: 包含上游和下游单据的响应
    """
    try:
        service = DocumentRelationNewService()
        result = await service.get_relations(
            tenant_id=tenant_id,
            document_type=document_type,
            document_id=document_id
        )
        return result
    except NotFoundError as e:
        raise HTTPException(status_code=404, detail=str(e))
    except ValidationError as e:
        raise HTTPException(status_code=400, detail=str(e))
    except Exception as e:
        raise HTTPException(status_code=500, detail=f"获取单据关联关系失败: {str(e)}")
