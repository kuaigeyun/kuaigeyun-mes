"""
消息配置管理 API 路由

提供消息配置的 CRUD 操作。
"""

from typing import Optional, List
from fastapi import APIRouter, Depends, HTTPException, status, Query

from core.schemas.message_config import (
    MessageConfigCreate,
    MessageConfigUpdate,
    MessageConfigResponse,
    MessageConfigTestRequest,
    MessageConfigTestResponse,
)
from core.services.messaging.message_config_service import MessageConfigService
from core.api.deps.deps import get_current_tenant
from infra.api.deps.deps import get_current_user as soil_get_current_user
from infra.models.user import User
from infra.exceptions.exceptions import NotFoundError, ValidationError

router = APIRouter(prefix="/message-configs", tags=["MessageConfigs"])


@router.post("/test-connection", response_model=MessageConfigTestResponse)
async def test_message_config_connection(
    data: MessageConfigTestRequest,
    tenant_id: int = Depends(get_current_tenant),
):
    """
    测试消息配置连接
    
    在保存配置前验证参数是否正确。
    """
    return await MessageConfigService.test_connection(tenant_id, data)


@router.post("", response_model=MessageConfigResponse, status_code=status.HTTP_201_CREATED)
async def create_message_config(
    data: MessageConfigCreate,
    current_user: User = Depends(soil_get_current_user),
    tenant_id: int = Depends(get_current_tenant),
):
    """
    创建消息配置
    
    创建新的消息配置并保存到数据库。
    
    Args:
        data: 消息配置创建数据
        tenant_id: 当前组织ID（依赖注入）
        
    Returns:
        MessageConfigResponse: 创建的消息配置对象
        
    Raises:
        HTTPException: 当配置代码已存在时抛出
    """
    try:
        message_config = await MessageConfigService.create_message_config(
            tenant_id=tenant_id,
            data=data
        )
        return MessageConfigResponse.model_validate(message_config)
    except ValidationError as e:
        raise HTTPException(
            status_code=status.HTTP_422_UNPROCESSABLE_ENTITY,
            detail=str(e)
        )


@router.get("", response_model=List[MessageConfigResponse])
async def list_message_configs(
    skip: int = Query(0, ge=0, description="跳过数量"),
    limit: int = Query(100, ge=1, le=1000, description="限制数量"),
    type: Optional[str] = Query(None, description="消息类型（可选）"),
    is_active: Optional[bool] = Query(None, description="是否启用（可选）"),
    tenant_id: int = Depends(get_current_tenant),
):
    """
    获取消息配置列表
    
    获取当前组织的消息配置列表，支持分页和筛选。
    
    Args:
        skip: 跳过数量（默认 0）
        limit: 限制数量（默认 100，最大 1000）
        type: 消息类型（可选）
        is_active: 是否启用（可选）
        tenant_id: 当前组织ID（依赖注入）
        
    Returns:
        List[MessageConfigResponse]: 消息配置列表
    """
    message_configs = await MessageConfigService.list_message_configs(
        tenant_id=tenant_id,
        skip=skip,
        limit=limit,
        type=type,
        is_active=is_active
    )
    return [MessageConfigResponse.model_validate(mc) for mc in message_configs]


@router.get("/{uuid}", response_model=MessageConfigResponse)
async def get_message_config(
    uuid: str,
    tenant_id: int = Depends(get_current_tenant),
):
    """
    获取消息配置详情
    
    根据UUID获取消息配置的详细信息。
    
    Args:
        uuid: 消息配置UUID
        tenant_id: 当前组织ID（依赖注入）
        
    Returns:
        MessageConfigResponse: 消息配置对象
        
    Raises:
        HTTPException: 当消息配置不存在时抛出
    """
    try:
        message_config = await MessageConfigService.get_message_config_by_uuid(
            tenant_id=tenant_id,
            uuid=uuid
        )
        return MessageConfigResponse.model_validate(message_config)
    except NotFoundError as e:
        raise HTTPException(
            status_code=status.HTTP_404_NOT_FOUND,
            detail=str(e)
        )


@router.put("/{uuid}", response_model=MessageConfigResponse)
async def update_message_config(
    uuid: str,
    data: MessageConfigUpdate,
    tenant_id: int = Depends(get_current_tenant),
):
    """
    更新消息配置
    
    更新消息配置信息。
    
    Args:
        uuid: 消息配置UUID
        data: 消息配置更新数据
        tenant_id: 当前组织ID（依赖注入）
        
    Returns:
        MessageConfigResponse: 更新后的消息配置对象
        
    Raises:
        HTTPException: 当消息配置不存在时抛出
    """
    try:
        message_config = await MessageConfigService.update_message_config(
            tenant_id=tenant_id,
            uuid=uuid,
            data=data
        )
        return MessageConfigResponse.model_validate(message_config)
    except NotFoundError as e:
        raise HTTPException(
            status_code=status.HTTP_404_NOT_FOUND,
            detail=str(e)
        )


@router.delete("/{uuid}", status_code=status.HTTP_204_NO_CONTENT)
async def delete_message_config(
    uuid: str,
    tenant_id: int = Depends(get_current_tenant),
):
    """
    删除消息配置（软删除）
    
    删除消息配置。
    
    Args:
        uuid: 消息配置UUID
        tenant_id: 当前组织ID（依赖注入）
        
    Raises:
        HTTPException: 当消息配置不存在时抛出
    """
    try:
        await MessageConfigService.delete_message_config(
            tenant_id=tenant_id,
            uuid=uuid
        )
    except NotFoundError as e:
        raise HTTPException(
            status_code=status.HTTP_404_NOT_FOUND,
            detail=str(e)
        )

