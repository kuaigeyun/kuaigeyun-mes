"""
KU-AI 智能建议 API 路由

提供智能建议的 RESTful API 接口。
"""

import json
import uuid
from typing import Optional, Dict, Any

from fastapi import APIRouter, Depends, HTTPException as FastAPIHTTPException, status, Query

from apps.kuaiai.services.suggestion_service import SuggestionService
from core.api.deps.deps import get_current_tenant
from infra.api.deps.deps import get_current_user as soil_get_current_user
from infra.models.user import User
from loguru import logger

router = APIRouter(prefix="/suggestions", tags=["App · KU-AI · Suggestions"])


def _http_exception_with_trace(
    status_code: int,
    message: str,
    route: str = "/suggestions",
    tenant_id: Optional[int] = None,
) -> FastAPIHTTPException:
    trace_id = uuid.uuid4().hex
    logger.warning(
        "kuaiai_suggestions_api_error trace_id={} tenant_id={} route={} status_code={} message={}",
        trace_id,
        tenant_id,
        route,
        status_code,
        message,
    )
    return FastAPIHTTPException(
        status_code=status_code,
        detail={"message": message, "trace_id": trace_id},
    )


def HTTPException(*, status_code: int, detail: Any, **kwargs) -> FastAPIHTTPException:
    message = detail.get("message") if isinstance(detail, dict) else str(detail)
    return _http_exception_with_trace(status_code, message)


@router.get("/{scene}")
async def get_suggestions(
    scene: str,
    context: Optional[str] = Query(None, description="上下文信息（JSON字符串，可选）"),
    current_user: User = Depends(soil_get_current_user),
    tenant_id: int = Depends(get_current_tenant),
):
    """根据业务场景获取智能建议列表"""
    try:
        context_dict: Dict[str, Any] = {}
        if context:
            try:
                context_dict = json.loads(context)
            except json.JSONDecodeError:
                logger.warning(f"上下文信息格式错误: {context}")

        service = SuggestionService()
        suggestions = await service.get_suggestions(
            tenant_id=tenant_id,
            scene=scene,
            context=context_dict
        )
        return {
            "success": True,
            "data": suggestions,
            "total": len(suggestions),
        }
    except Exception as e:
        logger.error(f"获取建议失败: {scene}, 错误: {e}")
        raise HTTPException(
            status_code=status.HTTP_500_INTERNAL_SERVER_ERROR,
            detail=f"获取建议失败: {str(e)}"
        )


@router.get("/work-order/{work_order_id}")
async def get_work_order_suggestions(
    work_order_id: int,
    current_user: User = Depends(soil_get_current_user),
    tenant_id: int = Depends(get_current_tenant),
):
    """获取工单相关建议"""
    try:
        service = SuggestionService()
        suggestions = await service.get_suggestions_for_work_order(
            tenant_id=tenant_id,
            work_order_id=work_order_id
        )
        return {
            "success": True,
            "data": suggestions,
            "total": len(suggestions),
        }
    except Exception as e:
        logger.error(f"获取工单建议失败: {work_order_id}, 错误: {e}")
        raise HTTPException(
            status_code=status.HTTP_500_INTERNAL_SERVER_ERROR,
            detail=f"获取工单建议失败: {str(e)}"
        )


@router.get("/reporting/{reporting_id}")
async def get_reporting_suggestions(
    reporting_id: int,
    current_user: User = Depends(soil_get_current_user),
    tenant_id: int = Depends(get_current_tenant),
):
    """获取报工相关建议"""
    try:
        service = SuggestionService()
        suggestions = await service.get_suggestions_for_reporting(
            tenant_id=tenant_id,
            reporting_id=reporting_id
        )
        return {
            "success": True,
            "data": suggestions,
            "total": len(suggestions),
        }
    except Exception as e:
        logger.error(f"获取报工建议失败: {reporting_id}, 错误: {e}")
        raise HTTPException(
            status_code=status.HTTP_500_INTERNAL_SERVER_ERROR,
            detail=f"获取报工建议失败: {str(e)}"
        )


@router.get("/inventory/all")
async def get_inventory_suggestions(
    current_user: User = Depends(soil_get_current_user),
    tenant_id: int = Depends(get_current_tenant),
):
    """获取库存相关建议"""
    try:
        service = SuggestionService()
        suggestions = await service.get_suggestions_for_inventory(tenant_id=tenant_id)
        return {
            "success": True,
            "data": suggestions,
            "total": len(suggestions),
        }
    except Exception as e:
        logger.error(f"获取库存建议失败: {tenant_id}, 错误: {e}")
        raise HTTPException(
            status_code=status.HTTP_500_INTERNAL_SERVER_ERROR,
            detail=f"获取库存建议失败: {str(e)}"
        )


@router.get("/production/all")
async def get_production_suggestions(
    current_user: User = Depends(soil_get_current_user),
    tenant_id: int = Depends(get_current_tenant),
):
    """获取生产看板相关建议"""
    try:
        service = SuggestionService()
        suggestions = await service.get_suggestions_for_production(tenant_id=tenant_id)
        return {
            "success": True,
            "data": suggestions,
            "total": len(suggestions),
        }
    except Exception as e:
        logger.error(f"获取生产建议失败: {tenant_id}, 错误: {e}")
        raise HTTPException(
            status_code=status.HTTP_500_INTERNAL_SERVER_ERROR,
            detail=f"获取生产建议失败: {str(e)}"
        )
