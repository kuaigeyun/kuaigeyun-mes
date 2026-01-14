"""
审核流程管理 API 路由模块

提供审核流程配置和审核记录查询相关的API接口。

Author: Luigi Lu
Date: 2025-01-14
"""

from typing import Optional, List
from fastapi import APIRouter, Depends, Query, Path, HTTPException, status
from loguru import logger

from core.api.deps import get_current_user, get_current_tenant
from infra.models.user import User
from infra.exceptions.exceptions import NotFoundError, ValidationError, BusinessLogicError

from apps.kuaizhizao.services.approval_flow_service import ApprovalFlowService
from apps.kuaizhizao.schemas.approval_flow import (
    ApprovalFlowCreate,
    ApprovalFlowUpdate,
    ApprovalFlowResponse,
    ApprovalRecordResponse,
)

router = APIRouter(prefix="/approval-flows", tags=["审核流程管理"])

approval_flow_service = ApprovalFlowService()


@router.post("", response_model=ApprovalFlowResponse, summary="创建审核流程")
async def create_approval_flow(
    flow_data: ApprovalFlowCreate,
    current_user: User = Depends(get_current_user),
    tenant_id: int = Depends(get_current_tenant),
):
    """
    创建审核流程
    
    支持配置多级审核、会签、或签等审核模式。
    """
    try:
        return await approval_flow_service.create_approval_flow(
            tenant_id=tenant_id,
            flow_data=flow_data,
            created_by=current_user.id
        )
    except ValidationError as e:
        raise HTTPException(status_code=status.HTTP_400_BAD_REQUEST, detail=str(e))
    except Exception as e:
        logger.error(f"创建审核流程失败: {e}")
        raise HTTPException(status_code=status.HTTP_500_INTERNAL_SERVER_ERROR, detail="创建审核流程失败")


@router.get("", response_model=List[ApprovalFlowResponse], summary="获取审核流程列表")
async def list_approval_flows(
    entity_type: Optional[str] = Query(None, description="实体类型"),
    is_active: Optional[bool] = Query(None, description="是否启用"),
    current_user: User = Depends(get_current_user),
    tenant_id: int = Depends(get_current_tenant),
):
    """
    获取审核流程列表
    
    支持按实体类型和启用状态筛选。
    """
    try:
        return await approval_flow_service.list_approval_flows(
            tenant_id=tenant_id,
            entity_type=entity_type,
            is_active=is_active
        )
    except Exception as e:
        logger.error(f"获取审核流程列表失败: {e}")
        raise HTTPException(status_code=status.HTTP_500_INTERNAL_SERVER_ERROR, detail="获取审核流程列表失败")


@router.get("/{flow_id}", response_model=ApprovalFlowResponse, summary="获取审核流程详情")
async def get_approval_flow(
    flow_id: int = Path(..., description="流程ID"),
    current_user: User = Depends(get_current_user),
    tenant_id: int = Depends(get_current_tenant),
):
    """
    获取审核流程详情
    """
    try:
        return await approval_flow_service.get_approval_flow_by_id(
            tenant_id=tenant_id,
            flow_id=flow_id
        )
    except NotFoundError as e:
        raise HTTPException(status_code=status.HTTP_404_NOT_FOUND, detail=str(e))
    except Exception as e:
        logger.error(f"获取审核流程详情失败: {e}")
        raise HTTPException(status_code=status.HTTP_500_INTERNAL_SERVER_ERROR, detail="获取审核流程详情失败")


@router.get("/records/{entity_type}/{entity_id}", summary="获取审核记录")
async def get_approval_records(
    entity_type: str = Path(..., description="实体类型"),
    entity_id: int = Path(..., description="实体ID"),
    current_user: User = Depends(get_current_user),
    tenant_id: int = Depends(get_current_tenant),
):
    """
    获取审核历史记录
    """
    try:
        return await approval_flow_service.get_approval_records(
            tenant_id=tenant_id,
            entity_type=entity_type,
            entity_id=entity_id
        )
    except Exception as e:
        logger.error(f"获取审核记录失败: {e}")
        raise HTTPException(status_code=status.HTTP_500_INTERNAL_SERVER_ERROR, detail="获取审核记录失败")


@router.get("/status/{entity_type}/{entity_id}", summary="获取审核状态")
async def get_approval_status(
    entity_type: str = Path(..., description="实体类型"),
    entity_id: int = Path(..., description="实体ID"),
    current_user: User = Depends(get_current_user),
    tenant_id: int = Depends(get_current_tenant),
):
    """
    获取审核状态
    """
    try:
        return await approval_flow_service.get_approval_status(
            tenant_id=tenant_id,
            entity_type=entity_type,
            entity_id=entity_id
        )
    except Exception as e:
        logger.error(f"获取审核状态失败: {e}")
        raise HTTPException(status_code=status.HTTP_500_INTERNAL_SERVER_ERROR, detail="获取审核状态失败")
