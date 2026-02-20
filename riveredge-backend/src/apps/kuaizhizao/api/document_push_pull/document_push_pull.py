"""
单据下推和上拉API模块

提供单据下推和上拉功能的API接口。

Author: Luigi Lu
Date: 2025-01-14
"""

from typing import Dict, Any, Optional
from fastapi import APIRouter, Depends, HTTPException
from pydantic import BaseModel, Field

from core.api.deps import get_current_user, get_current_tenant
from infra.models.user import User
from apps.kuaizhizao.services.document_push_pull_service import DocumentPushPullService
from apps.kuaizhizao.services.document_state_engine import DocumentStateEngine
from infra.exceptions.exceptions import NotFoundError, ValidationError, BusinessLogicError

router = APIRouter(prefix="/document-push-pull", tags=["单据下推和上拉"])


class PushDocumentRequest(BaseModel):
    """下推单据请求"""
    source_type: str = Field(..., description="源单据类型（如：demand、demand_computation）")
    source_id: int = Field(..., description="源单据ID")
    target_type: str = Field(..., description="目标单据类型（如：demand_computation、work_order、purchase_order、production_plan）")
    push_params: Optional[Dict[str, Any]] = Field(None, description="下推参数（可选）")


class PullDocumentRequest(BaseModel):
    """上拉单据请求"""
    target_type: str = Field(..., description="目标单据类型（下游单据，如：work_order、purchase_order）")
    target_id: int = Field(..., description="目标单据ID")
    source_type: str = Field(..., description="源单据类型（上游单据，如：demand_computation）")
    source_id: int = Field(..., description="源单据ID")


class ReverseDocumentRequest(BaseModel):
    """单据撤回请求"""
    document_type: str = Field(..., description="单据类型（demand、sales_order、work_order 等）")
    document_id: int = Field(..., description="单据ID")
    reverse_type: str = Field(
        ...,
        description="撤回类型: withdraw_submit=提交撤回, withdraw_push=下推撤回, revoke_state=状态撤回"
    )
    reason: Optional[str] = Field(None, description="撤回原因")


@router.post("/push", summary="单据下推")
async def push_document(
    request: PushDocumentRequest,
    current_user: User = Depends(get_current_user),
    tenant_id: int = Depends(get_current_tenant)
) -> Dict[str, Any]:
    """
    单据下推功能
    
    从上游单据下推到下游单据，自动创建下游单据并建立关联关系。
    
    支持的下推场景：
    - demand -> demand_computation: 从需求下推到需求计算
    - demand_computation -> work_order: 从需求计算下推到工单
    - demand_computation -> purchase_order: 从需求计算下推到采购单
    - demand_computation -> production_plan: 从需求计算下推到生产计划
    """
    try:
        service = DocumentPushPullService()
        result = await service.push_document(
            tenant_id=tenant_id,
            source_type=request.source_type,
            source_id=request.source_id,
            target_type=request.target_type,
            push_params=request.push_params,
            created_by=current_user.id
        )
        return result
    except NotFoundError as e:
        raise HTTPException(status_code=404, detail=str(e))
    except ValidationError as e:
        raise HTTPException(status_code=400, detail=str(e))
    except BusinessLogicError as e:
        raise HTTPException(status_code=400, detail=str(e))
    except Exception as e:
        raise HTTPException(status_code=500, detail=f"下推失败: {str(e)}")


@router.post("/pull", summary="单据上拉")
async def pull_document(
    request: PullDocumentRequest,
    current_user: User = Depends(get_current_user),
    tenant_id: int = Depends(get_current_tenant)
) -> Dict[str, Any]:
    """
    单据上拉功能
    
    从下游单据上拉到上游单据，建立关联关系。
    
    支持的上拉场景：
    - work_order -> demand_computation: 从工单上拉到需求计算
    - purchase_order -> demand_computation: 从采购单上拉到需求计算
    """
    try:
        service = DocumentPushPullService()
        result = await service.pull_document(
            tenant_id=tenant_id,
            target_type=request.target_type,
            target_id=request.target_id,
            source_type=request.source_type,
            source_id=request.source_id,
            created_by=current_user.id
        )
        return result
    except NotFoundError as e:
        raise HTTPException(status_code=404, detail=str(e))
    except ValidationError as e:
        raise HTTPException(status_code=400, detail=str(e))
    except BusinessLogicError as e:
        raise HTTPException(status_code=400, detail=str(e))
    except Exception as e:
        raise HTTPException(status_code=500, detail=f"上拉失败: {str(e)}")


@router.post("/reverse", summary="单据撤回")
async def reverse_document(
    request: ReverseDocumentRequest,
    current_user: User = Depends(get_current_user),
    tenant_id: int = Depends(get_current_tenant)
) -> Dict[str, Any]:
    """
    统一单据撤回入口
    
    - withdraw_submit: 提交撤回（待审核→草稿），支持 demand、sales_order
    - withdraw_push: 下推撤回（撤销需求计算），支持 demand、sales_order
    - revoke_state: 状态撤回（如工单 已下达→草稿），支持 work_order
    """
    try:
        engine = DocumentStateEngine()
        result = await engine.reverse_document(
            tenant_id=tenant_id,
            document_type=request.document_type,
            document_id=request.document_id,
            reverse_type=request.reverse_type,
            operator_id=current_user.id,
            reason=request.reason,
        )
        return result
    except NotFoundError as e:
        raise HTTPException(status_code=404, detail=str(e))
    except ValidationError as e:
        raise HTTPException(status_code=400, detail=str(e))
    except BusinessLogicError as e:
        raise HTTPException(status_code=400, detail=str(e))
    except Exception as e:
        raise HTTPException(status_code=500, detail=f"撤回失败: {str(e)}")


@router.get("/reverse/supported", summary="获取支持的撤回类型")
async def get_supported_reverses() -> Dict[str, list]:
    """返回各单据类型支持的撤回类型，供前端展示"""
    engine = DocumentStateEngine()
    return engine.get_supported_reverses()
