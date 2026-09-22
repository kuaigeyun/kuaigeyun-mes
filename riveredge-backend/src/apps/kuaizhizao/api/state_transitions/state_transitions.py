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
from core.api.deps.access import require_permission_codes
from infra.models.user import User
from infra.exceptions.exceptions import NotFoundError, ValidationError, BusinessLogicError

from apps.kuaizhizao.services.state_transition_service import StateTransitionService

router = APIRouter(prefix="/state-transitions", tags=["App - Kuaige Zhizao - State Transitions"])

state_transition_service = StateTransitionService()


@router.post(
    "/{entity_type}/{entity_id}",
    summary="Run state transition",
)
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
    工单/需求状态更新走领域 service，禁止路由层直写 filter.update。
    """
    try:
        # 按实体类型挂权限码（须先鉴权再改状态）
        if entity_type == "work_order":
            # FastAPI Depends 无法按 path 动态挂载，此处显式校验
            from core.api.deps.access import get_auth_context, ensure_permission_codes
            from fastapi import Request
            # ensure via UserPermissionService
            from core.services.authorization.user_permission_service import UserPermissionService

            has = await UserPermissionService.has_permission(
                user_id=current_user.id,
                tenant_id=tenant_id,
                permission_code="kuaizhizao:work-order:execute",
            )
            if not has:
                # 兼容：持有 update 也可执行流转（向后兼容存量角色）
                has = await UserPermissionService.has_permission(
                    user_id=current_user.id,
                    tenant_id=tenant_id,
                    permission_code="kuaizhizao:work-order:update",
                )
            if not has and not (
                getattr(current_user, "is_tenant_admin", False)
                or getattr(current_user, "is_infra_admin", False)
            ):
                raise HTTPException(
                    status_code=status.HTTP_403_FORBIDDEN,
                    detail="缺少权限: kuaizhizao:work-order:execute",
                )
        elif entity_type == "demand":
            from core.services.authorization.user_permission_service import UserPermissionService

            has = await UserPermissionService.has_permission(
                user_id=current_user.id,
                tenant_id=tenant_id,
                permission_code="kuaizhizao:plan-management-demand-management:update",
            )
            if not has and not (
                getattr(current_user, "is_tenant_admin", False)
                or getattr(current_user, "is_infra_admin", False)
            ):
                raise HTTPException(
                    status_code=status.HTTP_403_FORBIDDEN,
                    detail="缺少权限: 需求状态流转",
                )
        else:
            raise ValidationError(f"不支持的实体类型: {entity_type}")

        result = await state_transition_service.apply_entity_transition(
            tenant_id=tenant_id,
            entity_type=entity_type,
            entity_id=entity_id,
            to_state=to_state,
            operator_id=current_user.id,
            operator_name=current_user.username or f"用户{current_user.id}",
            transition_reason=transition_reason,
            transition_comment=transition_comment,
        )
        return result
    except NotFoundError as e:
        raise HTTPException(status_code=status.HTTP_404_NOT_FOUND, detail=str(e))
    except BusinessLogicError as e:
        raise HTTPException(status_code=status.HTTP_400_BAD_REQUEST, detail=str(e))
    except ValidationError as e:
        raise HTTPException(status_code=status.HTTP_400_BAD_REQUEST, detail=str(e))
    except HTTPException:
        raise
    except Exception as e:
        logger.error(f"执行状态流转失败: {e}")
        raise HTTPException(status_code=status.HTTP_500_INTERNAL_SERVER_ERROR, detail="执行状态流转失败")


@router.get("/history/{entity_type}/{entity_id}", summary="List state transition history")
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


@router.get("/available/{entity_type}", summary="List available state transitions")
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
