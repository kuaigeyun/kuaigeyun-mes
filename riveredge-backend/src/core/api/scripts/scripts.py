"""
脚本管理 API 路由

提供脚本的 CRUD 操作和脚本执行功能。
"""

from typing import Optional, List
from fastapi import APIRouter, Depends, HTTPException, status, Query

from core.schemas.script import (
    ScriptCreate,
    ScriptUpdate,
    ScriptExecuteRequest,
    ScriptResponse,
    ScriptExecuteResponse,
)
from core.services.scheduling.script_service import ScriptService
from core.api.deps.deps import get_current_tenant
from infra.api.deps.deps import get_current_user as soil_get_current_user
from infra.models.user import User
from infra.exceptions.exceptions import NotFoundError, ValidationError

router = APIRouter(prefix="/scripts", tags=["Scripts"])


@router.post("", response_model=ScriptResponse, status_code=status.HTTP_201_CREATED)
async def create_script(
    data: ScriptCreate,
    current_user: User = Depends(soil_get_current_user),
    tenant_id: int = Depends(get_current_tenant),
):
    """
    创建脚本
    
    创建新的脚本。
    
    Args:
        data: 脚本创建数据
        tenant_id: 当前组织ID（依赖注入）
        
    Returns:
        ScriptResponse: 创建的脚本对象
        
    Raises:
        HTTPException: 当脚本代码已存在时抛出
    """
    try:
        script = await ScriptService.create_script(
            tenant_id=tenant_id,
            data=data
        )
        return ScriptResponse.model_validate(script)
    except ValidationError as e:
        raise HTTPException(
            status_code=status.HTTP_422_UNPROCESSABLE_ENTITY,
            detail=str(e)
        )


@router.get("", response_model=List[ScriptResponse])
async def list_scripts(
    skip: int = Query(0, ge=0, description="跳过数量"),
    limit: int = Query(100, ge=1, le=1000, description="限制数量"),
    type: Optional[str] = Query(None, description="脚本类型（可选）"),
    is_active: Optional[bool] = Query(None, description="是否启用（可选）"),
    tenant_id: int = Depends(get_current_tenant),
):
    """
    获取脚本列表
    
    获取当前组织的脚本列表，支持分页和筛选。
    
    Args:
        skip: 跳过数量（默认 0）
        limit: 限制数量（默认 100，最大 1000）
        type: 脚本类型（可选）
        is_active: 是否启用（可选）
        tenant_id: 当前组织ID（依赖注入）
        
    Returns:
        List[ScriptResponse]: 脚本列表
    """
    scripts = await ScriptService.list_scripts(
        tenant_id=tenant_id,
        skip=skip,
        limit=limit,
        type=type,
        is_active=is_active
    )
    return [ScriptResponse.model_validate(s) for s in scripts]


@router.get("/{uuid}", response_model=ScriptResponse)
async def get_script(
    uuid: str,
    tenant_id: int = Depends(get_current_tenant),
):
    """
    获取脚本详情
    
    根据UUID获取脚本详情。
    
    Args:
        uuid: 脚本UUID
        tenant_id: 当前组织ID（依赖注入）
        
    Returns:
        ScriptResponse: 脚本对象
        
    Raises:
        HTTPException: 当脚本不存在时抛出
    """
    try:
        script = await ScriptService.get_script_by_uuid(
            tenant_id=tenant_id,
            uuid=uuid
        )
        return ScriptResponse.model_validate(script)
    except NotFoundError as e:
        raise HTTPException(
            status_code=status.HTTP_404_NOT_FOUND,
            detail=str(e)
        )


@router.put("/{uuid}", response_model=ScriptResponse)
async def update_script(
    uuid: str,
    data: ScriptUpdate,
    current_user: User = Depends(soil_get_current_user),
    tenant_id: int = Depends(get_current_tenant),
):
    """
    更新脚本
    
    更新脚本信息。
    
    Args:
        uuid: 脚本UUID
        data: 脚本更新数据
        tenant_id: 当前组织ID（依赖注入）
        
    Returns:
        ScriptResponse: 更新后的脚本对象
        
    Raises:
        HTTPException: 当脚本不存在时抛出
    """
    try:
        script = await ScriptService.update_script(
            tenant_id=tenant_id,
            uuid=uuid,
            data=data
        )
        return ScriptResponse.model_validate(script)
    except NotFoundError as e:
        raise HTTPException(
            status_code=status.HTTP_404_NOT_FOUND,
            detail=str(e)
        )


@router.delete("/{uuid}", status_code=status.HTTP_204_NO_CONTENT)
async def delete_script(
    uuid: str,
    current_user: User = Depends(soil_get_current_user),
    tenant_id: int = Depends(get_current_tenant),
):
    """
    删除脚本
    
    软删除脚本。
    
    Args:
        uuid: 脚本UUID
        tenant_id: 当前组织ID（依赖注入）
        
    Raises:
        HTTPException: 当脚本不存在时抛出
    """
    try:
        await ScriptService.delete_script(
            tenant_id=tenant_id,
            uuid=uuid
        )
    except NotFoundError as e:
        raise HTTPException(
            status_code=status.HTTP_404_NOT_FOUND,
            detail=str(e)
        )


@router.post("/{uuid}/execute", response_model=ScriptExecuteResponse)
async def execute_script(
    uuid: str,
    data: ScriptExecuteRequest,
    current_user: User = Depends(soil_get_current_user),
    tenant_id: int = Depends(get_current_tenant),
):
    """
    执行脚本
    
    执行脚本（同步或异步）。
    
    Args:
        uuid: 脚本UUID
        data: 执行请求数据
        current_user: 当前用户（依赖注入）
        tenant_id: 当前组织ID（依赖注入）
        
    Returns:
        ScriptExecuteResponse: 执行结果
        
    Raises:
        HTTPException: 当脚本不存在或执行失败时抛出
    """
    try:
        result = await ScriptService.execute_script(
            tenant_id=tenant_id,
            uuid=uuid,
            data=data
        )
        return ScriptExecuteResponse(**result)
    except (NotFoundError, ValidationError) as e:
        raise HTTPException(
            status_code=status.HTTP_422_UNPROCESSABLE_ENTITY,
            detail=str(e)
        )

