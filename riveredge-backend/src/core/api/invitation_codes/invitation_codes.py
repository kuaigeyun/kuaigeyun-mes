"""
邀请码管理 API 路由

提供邀请码的 CRUD 操作和验证功能。
"""

from typing import Optional, List
from fastapi import APIRouter, Depends, HTTPException, status, Query

from core.schemas.invitation_code import (
    InvitationCodeCreate,
    InvitationCodeUpdate,
    InvitationCodeResponse,
    InvitationCodeVerifyRequest,
    InvitationCodeVerifyResponse,
)
from core.services.invitation.invitation_code_service import InvitationCodeService
from core.api.deps.deps import get_current_tenant
from infra.exceptions.exceptions import NotFoundError, ValidationError

router = APIRouter(prefix="/invitation-codes", tags=["Invitation Codes"])


@router.post("", response_model=InvitationCodeResponse, status_code=status.HTTP_201_CREATED)
async def create_invitation_code(
    data: InvitationCodeCreate,
    tenant_id: int = Depends(get_current_tenant),
):
    """
    创建邀请码
    
    创建新邀请码并保存到数据库。
    
    Args:
        data: 邀请码创建数据
        tenant_id: 当前组织ID（依赖注入）
        
    Returns:
        InvitationCodeResponse: 创建的邀请码对象
        
    Raises:
        HTTPException: 当创建失败时抛出
    """
    try:
        invitation_code = await InvitationCodeService.create_invitation_code(
            tenant_id=tenant_id,
            data=data
        )
        return InvitationCodeResponse.model_validate(invitation_code)
    except ValidationError as e:
        raise HTTPException(
            status_code=status.HTTP_422_UNPROCESSABLE_ENTITY,
            detail=str(e)
        )


@router.get("", response_model=List[InvitationCodeResponse])
async def list_invitation_codes(
    skip: int = Query(0, ge=0, description="跳过数量"),
    limit: int = Query(100, ge=1, le=1000, description="限制数量"),
    is_active: Optional[bool] = Query(None, description="是否启用（可选）"),
    tenant_id: int = Depends(get_current_tenant),
):
    """
    获取邀请码列表
    
    获取当前组织的邀请码列表，支持分页和筛选。
    
    Args:
        skip: 跳过数量（默认 0）
        limit: 限制数量（默认 100，最大 1000）
        is_active: 是否启用（可选）
        tenant_id: 当前组织ID（依赖注入）
        
    Returns:
        List[InvitationCodeResponse]: 邀请码列表
    """
    codes = await InvitationCodeService.list_invitation_codes(
        tenant_id=tenant_id,
        skip=skip,
        limit=limit,
        is_active=is_active
    )
    return [InvitationCodeResponse.model_validate(c) for c in codes]


@router.get("/{uuid}", response_model=InvitationCodeResponse)
async def get_invitation_code(
    uuid: str,
    tenant_id: int = Depends(get_current_tenant),
):
    """
    获取邀请码详情
    
    根据UUID获取邀请码的详细信息。
    
    Args:
        uuid: 邀请码UUID
        tenant_id: 当前组织ID（依赖注入）
        
    Returns:
        InvitationCodeResponse: 邀请码对象
        
    Raises:
        HTTPException: 当邀请码不存在时抛出
    """
    try:
        invitation_code = await InvitationCodeService.get_invitation_code_by_uuid(
            tenant_id=tenant_id,
            uuid=uuid
        )
        return InvitationCodeResponse.model_validate(invitation_code)
    except NotFoundError as e:
        raise HTTPException(
            status_code=status.HTTP_404_NOT_FOUND,
            detail=str(e)
        )


@router.put("/{uuid}", response_model=InvitationCodeResponse)
async def update_invitation_code(
    uuid: str,
    data: InvitationCodeUpdate,
    tenant_id: int = Depends(get_current_tenant),
):
    """
    更新邀请码
    
    更新邀请码信息。
    
    Args:
        uuid: 邀请码UUID
        data: 邀请码更新数据
        tenant_id: 当前组织ID（依赖注入）
        
    Returns:
        InvitationCodeResponse: 更新后的邀请码对象
        
    Raises:
        HTTPException: 当邀请码不存在时抛出
    """
    try:
        invitation_code = await InvitationCodeService.update_invitation_code(
            tenant_id=tenant_id,
            uuid=uuid,
            data=data
        )
        return InvitationCodeResponse.model_validate(invitation_code)
    except NotFoundError as e:
        raise HTTPException(
            status_code=status.HTTP_404_NOT_FOUND,
            detail=str(e)
        )


@router.delete("/{uuid}", status_code=status.HTTP_204_NO_CONTENT)
async def delete_invitation_code(
    uuid: str,
    tenant_id: int = Depends(get_current_tenant),
):
    """
    删除邀请码（软删除）
    
    删除邀请码（软删除）。
    
    Args:
        uuid: 邀请码UUID
        tenant_id: 当前组织ID（依赖注入）
        
    Raises:
        HTTPException: 当邀请码不存在时抛出
    """
    try:
        await InvitationCodeService.delete_invitation_code(
            tenant_id=tenant_id,
            uuid=uuid
        )
    except NotFoundError as e:
        raise HTTPException(
            status_code=status.HTTP_404_NOT_FOUND,
            detail=str(e)
        )


@router.post("/verify", response_model=InvitationCodeVerifyResponse)
async def verify_invitation_code(
    request: InvitationCodeVerifyRequest,
):
    """
    验证邀请码（不增加使用次数）
    
    验证邀请码是否有效，不增加使用次数。
    
    Args:
        request: 邀请码验证请求数据
        
    Returns:
        InvitationCodeVerifyResponse: 验证结果
        
    Raises:
        HTTPException: 当邀请码无效时抛出
    """
    try:
        invitation_code = await InvitationCodeService.validate_invitation_code(request.code)
        return InvitationCodeVerifyResponse(
            valid=True,
            message="邀请码有效",
            invitation_code=InvitationCodeResponse.model_validate(invitation_code)
        )
    except ValidationError as e:
        return InvitationCodeVerifyResponse(
            valid=False,
            message=str(e),
            invitation_code=None
        )


@router.post("/use", response_model=InvitationCodeResponse)
async def use_invitation_code(
    request: InvitationCodeVerifyRequest,
):
    """
    使用邀请码（增加使用次数）
    
    使用邀请码，会增加使用次数。
    
    Args:
        request: 邀请码验证请求数据
        
    Returns:
        InvitationCodeResponse: 邀请码对象
        
    Raises:
        HTTPException: 当邀请码无效时抛出
    """
    try:
        invitation_code = await InvitationCodeService.use_invitation_code(request.code)
        return InvitationCodeResponse.model_validate(invitation_code)
    except ValidationError as e:
        raise HTTPException(
            status_code=status.HTTP_422_UNPROCESSABLE_ENTITY,
            detail=str(e)
        )

