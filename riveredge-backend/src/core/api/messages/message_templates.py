"""
消息模板管理 API 路由

提供消息模板的 CRUD 操作。
"""

from typing import Optional, List
from fastapi import APIRouter, Depends, HTTPException, status, Query

from core.schemas.message_template import (
    MessageTemplateCreate,
    MessageTemplateUpdate,
    MessageTemplateResponse,
)
from core.services.messaging.message_template_service import MessageTemplateService
from core.api.deps.deps import get_current_tenant
from core.services.system.installed_feature_scope import get_installed_application_codes
from core.services.system.installed_feature_scope import message_template_codes_for_installed_apps
from infra.api.deps.deps import get_current_user as soil_get_current_user
from infra.models.user import User
from infra.exceptions.exceptions import NotFoundError, ValidationError

router = APIRouter(prefix="/message-templates", tags=["Core - Message Templates"])


@router.post("", response_model=MessageTemplateResponse, status_code=status.HTTP_201_CREATED)
async def create_message_template(
    data: MessageTemplateCreate,
    current_user: User = Depends(soil_get_current_user),
    tenant_id: int = Depends(get_current_tenant),
):
    """
    创建消息模板
    
    创建新的消息模板并保存到数据库。
    
    Args:
        data: 消息模板创建数据
        tenant_id: 当前组织ID（依赖注入）
        
    Returns:
        MessageTemplateResponse: 创建的消息模板对象
        
    Raises:
        HTTPException: 当模板代码已存在时抛出
    """
    try:
        message_template = await MessageTemplateService.create_message_template(
            tenant_id=tenant_id,
            data=data
        )
        return MessageTemplateResponse.model_validate(message_template)
    except ValidationError as e:
        raise HTTPException(
            status_code=status.HTTP_422_UNPROCESSABLE_ENTITY,
            detail=str(e)
        )


@router.get("", response_model=List[MessageTemplateResponse])
async def list_message_templates(
    skip: int = Query(0, ge=0, description="跳过数量"),
    limit: int = Query(100, ge=1, le=1000, description="限制数量"),
    type: Optional[str] = Query(None, description="消息类型（可选）"),
    is_active: Optional[bool] = Query(None, description="是否启用（可选）"),
    keyword: Optional[str] = Query(None, description="模糊搜索（名称、代码、描述、主题）"),
    tenant_id: int = Depends(get_current_tenant),
):
    """
    获取消息模板列表
    
    获取当前组织的消息模板列表，支持分页和筛选。
    
    Args:
        skip: 跳过数量（默认 0）
        limit: 限制数量（默认 100，最大 1000）
        type: 消息类型（可选）
        is_active: 是否启用（可选）
        tenant_id: 当前组织ID（依赖注入）
        
    Returns:
        List[MessageTemplateResponse]: 消息模板列表
    """
    message_templates = await MessageTemplateService.list_message_templates(
        tenant_id=tenant_id,
        skip=skip,
        limit=limit,
        type=type,
        is_active=is_active,
        keyword=keyword,
        installed_app_codes=await get_installed_application_codes(tenant_id),
    )
    return [MessageTemplateResponse.model_validate(mt) for mt in message_templates]


@router.get("/{uuid}", response_model=MessageTemplateResponse)
async def get_message_template(
    uuid: str,
    tenant_id: int = Depends(get_current_tenant),
):
    """
    获取消息模板详情
    
    根据UUID获取消息模板的详细信息。
    
    Args:
        uuid: 消息模板UUID
        tenant_id: 当前组织ID（依赖注入）
        
    Returns:
        MessageTemplateResponse: 消息模板对象
        
    Raises:
        HTTPException: 当消息模板不存在时抛出
    """
    try:
        message_template = await MessageTemplateService.get_message_template_by_uuid(
            tenant_id=tenant_id,
            uuid=uuid
        )
        return MessageTemplateResponse.model_validate(message_template)
    except NotFoundError as e:
        raise HTTPException(
            status_code=status.HTTP_404_NOT_FOUND,
            detail=str(e)
        )


@router.put("/{uuid}", response_model=MessageTemplateResponse)
async def update_message_template(
    uuid: str,
    data: MessageTemplateUpdate,
    tenant_id: int = Depends(get_current_tenant),
):
    """
    更新消息模板
    
    更新消息模板信息。
    
    Args:
        uuid: 消息模板UUID
        data: 消息模板更新数据
        tenant_id: 当前组织ID（依赖注入）
        
    Returns:
        MessageTemplateResponse: 更新后的消息模板对象
        
    Raises:
        HTTPException: 当消息模板不存在时抛出
    """
    try:
        message_template = await MessageTemplateService.update_message_template(
            tenant_id=tenant_id,
            uuid=uuid,
            data=data
        )
        return MessageTemplateResponse.model_validate(message_template)
    except NotFoundError as e:
        raise HTTPException(
            status_code=status.HTTP_404_NOT_FOUND,
            detail=str(e)
        )


@router.delete("/{uuid}", status_code=status.HTTP_204_NO_CONTENT)
async def delete_message_template(
    uuid: str,
    tenant_id: int = Depends(get_current_tenant),
):
    """
    删除消息模板（软删除）
    
    删除消息模板。
    
    Args:
        uuid: 消息模板UUID
        tenant_id: 当前组织ID（依赖注入）
        
    Raises:
        HTTPException: 当消息模板不存在时抛出
    """
    try:
        await MessageTemplateService.delete_message_template(
            tenant_id=tenant_id,
            uuid=uuid
        )
    except NotFoundError as e:
        raise HTTPException(
            status_code=status.HTTP_404_NOT_FOUND,
            detail=str(e)
        )


@router.post("/load-preset")
async def load_preset_message_templates(
    current_user: User = Depends(soil_get_current_user),
    tenant_id: int = Depends(get_current_tenant),
):
    """
    加载消息模板预设

    为当前组织加载中国中小制造业极简消息模板预设（审批通知、验证码、欢迎邮件等）。
    """
    installed_app_codes = await get_installed_application_codes(tenant_id)
    visible_codes = message_template_codes_for_installed_apps(installed_app_codes)
    count = await MessageTemplateService.load_preset_sme(
        tenant_id,
        only_codes=visible_codes,
    )
    if "haoligo" in installed_app_codes:
        from apps.haoligo.services.haoligo_message_template_registry import (
            load_haoligo_message_template_presets,
        )

        count += await load_haoligo_message_template_presets(tenant_id)
    return {"created": count, "message": f"成功加载 {count} 个消息模板预设"}


