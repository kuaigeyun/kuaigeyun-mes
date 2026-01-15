"""
状态流转管理 API 路由模块

提供状态流转相关的API接口。

Author: Luigi Lu
Date: 2025-01-14
"""

from typing import Optional, List
from fastapi import APIRouter, Depends, Query, Path, HTTPException, status, Body
from loguru import logger

from core.api.deps import get_current_user, get_current_tenant
from infra.models.user import User
from infra.exceptions.exceptions import NotFoundError, ValidationError, BusinessLogicError

from apps.kuaizhizao.services.state_transition_service import StateTransitionService

router = APIRouter(prefix="/state-transitions", tags=["状态流转管理"])

state_transition_service = StateTransitionService()


@router.post("/{entity_type}/{entity_id}", summary="执行状态流转")
async def transition_state(
    entity_type: str = Path(..., description="实体类型"),
    entity_id: int = Path(..., description="实体ID"),
    to_state: str = Body(..., description="目标状态"),
    transition_reason: Optional[str] = Body(None, description="流转原因"),
    transition_comment: Optional[str] = Body(None, description="流转备注"),
    current_user: User = Depends(get_current_user),
    tenant_id: int = Depends(get_current_tenant),
):
    """
    执行状态流转
    
    支持从当前状态流转到目标状态，并记录流转日志。
    """
    try:
        # 获取当前状态（需要根据实体类型查询）
        from apps.kuaizhizao.models.demand import Demand
        from apps.kuaizhizao.models.work_order import WorkOrder
        
        if entity_type == "demand":
            entity = await Demand.get_or_none(tenant_id=tenant_id, id=entity_id)
            if not entity:
                raise NotFoundError(f"需求不存在: {entity_id}")
            from_state = entity.status
        elif entity_type == "work_order":
            entity = await WorkOrder.get_or_none(tenant_id=tenant_id, id=entity_id)
            if not entity:
                raise NotFoundError(f"工单不存在: {entity_id}")
            from_state = entity.status
        else:
            raise ValidationError(f"不支持的实体类型: {entity_type}")
        
        log = await state_transition_service.transition_state(
            tenant_id=tenant_id,
            entity_type=entity_type,
            entity_id=entity_id,
            from_state=from_state,
            to_state=to_state,
            operator_id=current_user.id,
            operator_name=current_user.username or f"用户{current_user.id}",
            transition_reason=transition_reason,
            transition_comment=transition_comment
        )
        
        # 更新实体状态
        if entity_type == "demand":
            await Demand.filter(tenant_id=tenant_id, id=entity_id).update(status=to_state)
        elif entity_type == "work_order":
            # 工单状态流转时，需要更新相关时间字段
            update_data = {"status": to_state}
            if to_state == "in_progress" and not entity.actual_start_date:
                from datetime import datetime
                update_data["actual_start_date"] = datetime.now()
            elif to_state == "completed" and not entity.actual_end_date:
                from datetime import datetime
                update_data["actual_end_date"] = datetime.now()
            await WorkOrder.filter(tenant_id=tenant_id, id=entity_id).update(**update_data)
        
        return {
            "success": True,
            "transition_log_id": log.id,
            "from_state": from_state,
            "to_state": to_state,
            "transition_time": log.transition_time.isoformat() if log.transition_time else None
        }
    except NotFoundError as e:
        raise HTTPException(status_code=status.HTTP_404_NOT_FOUND, detail=str(e))
    except BusinessLogicError as e:
        raise HTTPException(status_code=status.HTTP_400_BAD_REQUEST, detail=str(e))
    except Exception as e:
        logger.error(f"执行状态流转失败: {e}")
        raise HTTPException(status_code=status.HTTP_500_INTERNAL_SERVER_ERROR, detail="执行状态流转失败")


@router.get("/history/{entity_type}/{entity_id}", summary="获取状态流转历史")
async def get_transition_history(
    entity_type: str = Path(..., description="实体类型"),
    entity_id: int = Path(..., description="实体ID"),
    current_user: User = Depends(get_current_user),
    tenant_id: int = Depends(get_current_tenant),
):
    """
    获取状态流转历史
    
    返回实体的所有状态流转记录。
    """
    try:
        return await state_transition_service.get_transition_history(
            tenant_id=tenant_id,
            entity_type=entity_type,
            entity_id=entity_id
        )
    except Exception as e:
        logger.error(f"获取状态流转历史失败: {e}")
        raise HTTPException(status_code=status.HTTP_500_INTERNAL_SERVER_ERROR, detail="获取状态流转历史失败")


@router.get("/available/{entity_type}", summary="获取可用状态流转选项")
async def get_available_transitions(
    entity_type: str = Path(..., description="实体类型"),
    current_state: str = Query(..., description="当前状态"),
    current_user: User = Depends(get_current_user),
    tenant_id: int = Depends(get_current_tenant),
):
    """
    获取可用状态流转选项
    
    返回从当前状态可以流转到的所有状态选项。
    """
    try:
        return await state_transition_service.get_available_transitions(
            tenant_id=tenant_id,
            entity_type=entity_type,
            current_state=current_state
        )
    except Exception as e:
        logger.error(f"获取可用状态流转选项失败: {e}")
        raise HTTPException(status_code=status.HTTP_500_INTERNAL_SERVER_ERROR, detail="获取可用状态流转选项失败")
