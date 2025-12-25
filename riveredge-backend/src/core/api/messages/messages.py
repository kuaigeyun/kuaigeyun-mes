"""
消息发送 API 路由

提供消息发送和消息记录查询功能。
"""

from typing import Optional, List
from fastapi import APIRouter, Depends, HTTPException, status, Query

from core.schemas.message_template import SendMessageRequest, SendMessageResponse
from core.schemas.message_log import MessageLogResponse
from core.services.messaging.message_service import MessageService
from core.api.deps.deps import get_current_tenant
from infra.api.deps.deps import get_current_user as soil_get_current_user
from infra.models.user import User
from infra.exceptions.exceptions import NotFoundError, ValidationError

router = APIRouter(prefix="/messages", tags=["Messages"])


@router.post("/send", response_model=SendMessageResponse)
async def send_message(
    request: SendMessageRequest,
    current_user: User = Depends(soil_get_current_user),
    tenant_id: int = Depends(get_current_tenant),
):
    """
    发送消息
    
    通过 Inngest 事件触发消息发送。
    
    Args:
        request: 发送消息请求
        tenant_id: 当前组织ID（依赖注入）
        
    Returns:
        SendMessageResponse: 发送消息响应
        
    Raises:
        HTTPException: 当发送失败时抛出
    """
    try:
        result = await MessageService.send_message(
            tenant_id=tenant_id,
            request=request
        )
        return result
    except (NotFoundError, ValidationError) as e:
        raise HTTPException(
            status_code=status.HTTP_422_UNPROCESSABLE_ENTITY,
            detail=str(e)
        )
    except Exception as e:
        raise HTTPException(
            status_code=status.HTTP_500_INTERNAL_SERVER_ERROR,
            detail=f"发送消息失败: {str(e)}"
        )


@router.get("/logs", response_model=List[MessageLogResponse])
async def list_message_logs(
    skip: int = Query(0, ge=0, description="跳过数量"),
    limit: int = Query(100, ge=1, le=1000, description="限制数量"),
    type: Optional[str] = Query(None, description="消息类型（可选）"),
    status: Optional[str] = Query(None, description="发送状态（可选）"),
    tenant_id: int = Depends(get_current_tenant),
):
    """
    获取消息发送记录列表
    
    获取当前组织的消息发送记录列表，支持分页和筛选。
    
    Args:
        skip: 跳过数量（默认 0）
        limit: 限制数量（默认 100，最大 1000）
        type: 消息类型（可选）
        status: 发送状态（可选）
        tenant_id: 当前组织ID（依赖注入）
        
    Returns:
        List[MessageLogResponse]: 消息发送记录列表
    """
    message_logs = await MessageService.list_message_logs(
        tenant_id=tenant_id,
        skip=skip,
        limit=limit,
        type=type,
        status=status
    )
    return [MessageLogResponse.model_validate(ml) for ml in message_logs]

