"""
职位管理 API 路由

提供职位的 CRUD 操作。
"""

from typing import Optional
from fastapi import APIRouter, Depends, HTTPException, status, Query

from core.models.position import Position
from core.schemas.position import (
    PositionCreate,
    PositionUpdate,
    PositionResponse,
    PositionListResponse,
    PositionListItem,
)
from core.services.position_service import PositionService
from core.api.deps.deps import get_current_tenant
from infra.api.deps.deps import get_current_user as soil_get_current_user
from infra.models.user import User
from infra.exceptions.exceptions import NotFoundError, ValidationError, AuthorizationError

router = APIRouter(prefix="/positions", tags=["Core Positions"])


@router.post("", response_model=PositionResponse, status_code=status.HTTP_201_CREATED)
async def create_position(
    data: PositionCreate,
    current_user: User = Depends(soil_get_current_user),
    tenant_id: int = Depends(get_current_tenant),
):
    """
    创建职位
    
    创建新职位并保存到数据库。职位可以关联到部门。
    
    Args:
        data: 职位创建数据
        current_user: 当前用户（依赖注入）
        tenant_id: 当前组织ID（依赖注入）
        
    Returns:
        PositionResponse: 创建的职位对象
        
    Raises:
        HTTPException: 当部门不存在或数据验证失败时抛出
    """
    try:
        position = await PositionService.create_position(
            tenant_id=tenant_id,
            data=data,
            current_user_id=current_user.id
        )
        
        # 获取关联的部门信息
        department_info = None
        if position.department_id:
            from core.models.department import Department
            department = await Department.filter(
                id=position.department_id,
                tenant_id=tenant_id,
                deleted_at__isnull=True
            ).first()
            
            if department:
                department_info = {
                    "id": department.id,
                    "uuid": department.uuid,
                    "name": department.name,
                    "code": department.code,
                }
        
        # 转换为响应格式
        response = PositionResponse.model_validate(position)
        response.department = department_info
        
        return response
    except ValidationError as e:
        raise HTTPException(
            status_code=status.HTTP_422_UNPROCESSABLE_ENTITY,
            detail=str(e)
        )
    except AuthorizationError as e:
        raise HTTPException(
            status_code=status.HTTP_403_FORBIDDEN,
            detail=str(e)
        )


@router.get("", response_model=PositionListResponse)
async def get_position_list(
    page: int = Query(1, ge=1, description="页码"),
    page_size: int = Query(20, ge=1, le=100, description="每页数量"),
    keyword: Optional[str] = Query(None, description="关键词搜索"),
    department_uuid: Optional[str] = Query(None, description="部门UUID筛选"),
    is_active: Optional[bool] = Query(None, description="是否启用筛选"),
    current_user: User = Depends(soil_get_current_user),
    tenant_id: int = Depends(get_current_tenant),
):
    """
    获取职位列表
    
    支持分页、关键词搜索和筛选。
    
    Args:
        page: 页码
        page_size: 每页数量
        keyword: 关键词搜索（搜索职位名称、代码、描述）
        department_uuid: 部门UUID筛选
        is_active: 是否启用筛选
        current_user: 当前用户（依赖注入）
        tenant_id: 当前组织ID（依赖注入）
        
    Returns:
        PositionListResponse: 职位列表响应
    """
    result = await PositionService.get_position_list(
        tenant_id=tenant_id,
        page=page,
        page_size=page_size,
        keyword=keyword,
        department_uuid=department_uuid,
        is_active=is_active,
    )
    
    # 转换为响应格式
    items = [PositionListItem.model_validate(item) for item in result["items"]]
    
    return PositionListResponse(
        items=items,
        total=result["total"],
        page=result["page"],
        page_size=result["page_size"],
    )


@router.get("/{position_uuid}", response_model=PositionResponse)
async def get_position(
    position_uuid: str,
    current_user: User = Depends(soil_get_current_user),
    tenant_id: int = Depends(get_current_tenant),
):
    """
    获取职位详情
    
    根据UUID获取职位详细信息，包括关联的部门信息。
    
    Args:
        position_uuid: 职位UUID
        current_user: 当前用户（依赖注入）
        tenant_id: 当前组织ID（依赖注入）
        
    Returns:
        PositionResponse: 职位详情响应
        
    Raises:
        HTTPException: 当职位不存在时抛出
    """
    try:
        position = await PositionService.get_position_by_uuid(
            tenant_id=tenant_id,
            position_uuid=position_uuid
        )
        
        # 获取关联的部门信息
        department_info = None
        if position.department_id:
            from core.models.department import Department
            department = await Department.filter(
                id=position.department_id,
                tenant_id=tenant_id,
                deleted_at__isnull=True
            ).first()
            
            if department:
                department_info = {
                    "id": department.id,
                    "uuid": department.uuid,
                    "name": department.name,
                    "code": department.code,
                }
        
        # 转换为响应格式
        response = PositionResponse.model_validate(position)
        response.department = department_info
        
        return response
    except NotFoundError as e:
        raise HTTPException(
            status_code=status.HTTP_404_NOT_FOUND,
            detail=str(e)
        )


@router.put("/{position_uuid}", response_model=PositionResponse)
async def update_position(
    position_uuid: str,
    data: PositionUpdate,
    current_user: User = Depends(soil_get_current_user),
    tenant_id: int = Depends(get_current_tenant),
):
    """
    更新职位
    
    更新职位的基本信息。支持修改关联部门。
    
    Args:
        position_uuid: 职位UUID
        data: 职位更新数据
        current_user: 当前用户（依赖注入）
        tenant_id: 当前组织ID（依赖注入）
        
    Returns:
        PositionResponse: 更新后的职位对象
        
    Raises:
        HTTPException: 当职位不存在或数据验证失败时抛出
    """
    try:
        position = await PositionService.update_position(
            tenant_id=tenant_id,
            position_uuid=position_uuid,
            data=data,
            current_user_id=current_user.id
        )
        
        # 获取关联的部门信息
        department_info = None
        if position.department_id:
            from core.models.department import Department
            department = await Department.filter(
                id=position.department_id,
                tenant_id=tenant_id,
                deleted_at__isnull=True
            ).first()
            
            if department:
                department_info = {
                    "id": department.id,
                    "uuid": department.uuid,
                    "name": department.name,
                    "code": department.code,
                }
        
        # 转换为响应格式
        response = PositionResponse.model_validate(position)
        response.department = department_info
        
        return response
    except NotFoundError as e:
        raise HTTPException(
            status_code=status.HTTP_404_NOT_FOUND,
            detail=str(e)
        )
    except ValidationError as e:
        raise HTTPException(
            status_code=status.HTTP_422_UNPROCESSABLE_ENTITY,
            detail=str(e)
        )
    except AuthorizationError as e:
        raise HTTPException(
            status_code=status.HTTP_403_FORBIDDEN,
            detail=str(e)
        )


@router.delete("/{position_uuid}", status_code=status.HTTP_204_NO_CONTENT)
async def delete_position(
    position_uuid: str,
    current_user: User = Depends(soil_get_current_user),
    tenant_id: int = Depends(get_current_tenant),
):
    """
    删除职位
    
    软删除职位。有关联用户的职位不可删除。
    
    Args:
        position_uuid: 职位UUID
        current_user: 当前用户（依赖注入）
        tenant_id: 当前组织ID（依赖注入）
        
    Raises:
        HTTPException: 当职位不存在或不可删除时抛出
    """
    try:
        await PositionService.delete_position(
            tenant_id=tenant_id,
            position_uuid=position_uuid,
            current_user_id=current_user.id
        )
    except NotFoundError as e:
        raise HTTPException(
            status_code=status.HTTP_404_NOT_FOUND,
            detail=str(e)
        )
    except ValidationError as e:
        raise HTTPException(
            status_code=status.HTTP_422_UNPROCESSABLE_ENTITY,
            detail=str(e)
        )
    except AuthorizationError as e:
        raise HTTPException(
            status_code=status.HTTP_403_FORBIDDEN,
            detail=str(e)
        )

