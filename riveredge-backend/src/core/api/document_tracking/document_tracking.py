"""
单据跟踪中心API模块

提供按单据维度的操作记录时间线及关联关系查询。

Author: Luigi Lu
Date: 2026-02-20
"""

from fastapi import APIRouter, Depends, HTTPException

from core.api.deps import get_current_user, get_current_tenant
from core.services.document_tracking_service import DocumentTrackingService
from infra.exceptions.exceptions import NotFoundError

router = APIRouter(prefix="/document-tracking", tags=["单据跟踪中心"])


@router.get("/{document_type}/{document_id}", summary="获取单据跟踪信息")
async def get_document_tracking(
    document_type: str,
    document_id: int,
    tenant_id: int = Depends(get_current_tenant),
) -> dict:
    """
    获取单据的操作记录时间线及上下游关联关系

    聚合：StateTransitionLog、ApprovalRecord、DocumentRelation
    """
    try:
        service = DocumentTrackingService()
        result = await service.get_document_tracking(
            tenant_id=tenant_id,
            document_type=document_type,
            document_id=document_id,
        )
        return result
    except NotFoundError as e:
        raise HTTPException(status_code=404, detail=str(e))
    except Exception as e:
        raise HTTPException(status_code=500, detail=f"获取单据跟踪失败: {str(e)}")
