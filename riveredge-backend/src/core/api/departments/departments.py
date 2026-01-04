"""
部门管理 API 路由

提供部门的 CRUD 操作和树形结构管理。
"""

from typing import Optional, List, Dict, Any
from fastapi import APIRouter, Depends, HTTPException, status, Query, Body
from pydantic import BaseModel, Field

from core.models.department import Department
from core.schemas.department import (
    DepartmentCreate,
    DepartmentUpdate,
    DepartmentResponse,
    DepartmentTreeResponse,
    DepartmentTreeItem,
    DepartmentImportRequest,
)
from core.services.organization.department_service import DepartmentService
from core.api.deps.deps import get_current_tenant
from infra.api.deps.deps import get_current_user as soil_get_current_user
from infra.models.user import User
from infra.exceptions.exceptions import NotFoundError, ValidationError, AuthorizationError

router = APIRouter(prefix="/departments", tags=["Core Departments"])


@router.post("", response_model=DepartmentResponse, status_code=status.HTTP_201_CREATED)
async def create_department(
    data: DepartmentCreate,
    current_user: User = Depends(soil_get_current_user),
    tenant_id: int = Depends(get_current_tenant),
):
    """
    创建部门
    
    创建新部门并保存到数据库。支持树形结构（父子部门关系）。
    
    Args:
        data: 部门创建数据
        current_user: 当前用户（依赖注入）
        tenant_id: 当前组织ID（依赖注入）
        
    Returns:
        DepartmentResponse: 创建的部门对象
        
    Raises:
        HTTPException: 当父部门不存在或数据验证失败时抛出
    """
    try:
        department = await DepartmentService.create_department(
            tenant_id=tenant_id,
            data=data,
            current_user_id=current_user.id
        )
        
        # 获取子部门数量和用户数量
        children_count = await Department.filter(
            tenant_id=tenant_id,
            parent_id=department.id,
            deleted_at__isnull=True
        ).count()
        
        from infra.models.user import User
        user_count = await User.filter(
            tenant_id=tenant_id,
            department_id=department.id,
            deleted_at__isnull=True
        ).count()
        
        # 转换为响应格式
        response = DepartmentResponse.model_validate(department)
        response.children_count = children_count
        response.user_count = user_count
        
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


@router.get("/tree", response_model=DepartmentTreeResponse)
async def get_department_tree(
    current_user: User = Depends(soil_get_current_user),
    tenant_id: int = Depends(get_current_tenant),
):
    """
    获取部门树形结构
    
    返回完整的部门树形结构，包含所有子部门。
    
    Args:
        current_user: 当前用户（依赖注入）
        tenant_id: 当前组织ID（依赖注入）
        
    Returns:
        DepartmentTreeResponse: 部门树形结构
    """
    tree_data = await DepartmentService.get_department_tree(
        tenant_id=tenant_id,
        parent_id=None
    )
    
    # 转换为树形响应格式
    def convert_to_tree_item(item: dict) -> DepartmentTreeItem:
        children = [convert_to_tree_item(child) for child in item.get("children", [])]
        return DepartmentTreeItem(
            id=item.get("id"),  # ⚠️ 修复：使用 get 方法，避免 KeyError
            uuid=item["uuid"],
            name=item["name"],
            code=item["code"],
            description=item.get("description"),
            parent_id=item.get("parent_id"),  # ⚠️ 修复：使用 get 方法
            manager_id=item.get("manager_id"),  # ⚠️ 修复：使用 get 方法
            sort_order=item.get("sort_order", 0),
            is_active=item.get("is_active", True),
            children_count=item.get("children_count", 0),
            user_count=item.get("user_count", 0),
            children=children,
        )
    
    items = [convert_to_tree_item(item) for item in tree_data]
    
    return DepartmentTreeResponse(items=items)


@router.get("/{department_uuid}", response_model=DepartmentResponse)
async def get_department(
    department_uuid: str,
    current_user: User = Depends(soil_get_current_user),
    tenant_id: int = Depends(get_current_tenant),
):
    """
    获取部门详情
    
    根据UUID获取部门详细信息。
    
    Args:
        department_uuid: 部门UUID
        current_user: 当前用户（依赖注入）
        tenant_id: 当前组织ID（依赖注入）
        
    Returns:
        DepartmentResponse: 部门详情响应
        
    Raises:
        HTTPException: 当部门不存在时抛出
    """
    try:
        department = await DepartmentService.get_department_by_uuid(
            tenant_id=tenant_id,
            department_uuid=department_uuid
        )
        
        # 获取子部门数量和用户数量
        children_count = await Department.filter(
            tenant_id=tenant_id,
            parent_id=department.id,
            deleted_at__isnull=True
        ).count()
        
        from infra.models.user import User
        user_count = await User.filter(
            tenant_id=tenant_id,
            department_id=department.id,
            deleted_at__isnull=True
        ).count()
        
        # 转换为响应格式
        response = DepartmentResponse.model_validate(department)
        response.children_count = children_count
        response.user_count = user_count
        
        return response
    except NotFoundError as e:
        raise HTTPException(
            status_code=status.HTTP_404_NOT_FOUND,
            detail=str(e)
        )


@router.put("/{department_uuid}", response_model=DepartmentResponse)
async def update_department(
    department_uuid: str,
    data: DepartmentUpdate,
    current_user: User = Depends(soil_get_current_user),
    tenant_id: int = Depends(get_current_tenant),
):
    """
    更新部门
    
    更新部门的基本信息。支持修改父部门（树形结构调整）。
    
    Args:
        department_uuid: 部门UUID
        data: 部门更新数据
        current_user: 当前用户（依赖注入）
        tenant_id: 当前组织ID（依赖注入）
        
    Returns:
        DepartmentResponse: 更新后的部门对象
        
    Raises:
        HTTPException: 当部门不存在或数据验证失败时抛出
    """
    try:
        department = await DepartmentService.update_department(
            tenant_id=tenant_id,
            department_uuid=department_uuid,
            data=data,
            current_user_id=current_user.id
        )
        
        # 获取子部门数量和用户数量
        children_count = await Department.filter(
            tenant_id=tenant_id,
            parent_id=department.id,
            deleted_at__isnull=True
        ).count()
        
        from infra.models.user import User
        user_count = await User.filter(
            tenant_id=tenant_id,
            department_id=department.id,
            deleted_at__isnull=True
        ).count()
        
        # 转换为响应格式
        response = DepartmentResponse.model_validate(department)
        response.children_count = children_count
        response.user_count = user_count
        
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


@router.delete("/{department_uuid}", status_code=status.HTTP_204_NO_CONTENT)
async def delete_department(
    department_uuid: str,
    current_user: User = Depends(soil_get_current_user),
    tenant_id: int = Depends(get_current_tenant),
):
    """
    删除部门
    
    软删除部门。有子部门或关联用户的部门不可删除。
    
    Args:
        department_uuid: 部门UUID
        current_user: 当前用户（依赖注入）
        tenant_id: 当前组织ID（依赖注入）
        
    Raises:
        HTTPException: 当部门不存在或不可删除时抛出
    """
    try:
        await DepartmentService.delete_department(
            tenant_id=tenant_id,
            department_uuid=department_uuid,
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


@router.put("/sort", status_code=status.HTTP_200_OK)
async def update_department_order(
    department_orders: List[Dict[str, Any]] = Body(..., description="部门排序列表"),
    current_user: User = Depends(soil_get_current_user),
    tenant_id: int = Depends(get_current_tenant),
):
    """
    批量更新部门排序
    
    用于前端拖拽排序后批量更新多个部门的排序顺序。
    
    Args:
        department_orders: 部门排序列表，格式：[{"uuid": "...", "sort_order": 1}, ...]
        current_user: 当前用户（依赖注入）
        tenant_id: 当前组织ID（依赖注入）
        
    Returns:
        dict: 成功响应
        
    Raises:
        HTTPException: 当数据验证失败时抛出
    """
    try:
        await DepartmentService.update_department_order(
            tenant_id=tenant_id,
            department_orders=department_orders
        )
        return {"success": True, "message": "排序更新成功"}
    except ValidationError as e:
        raise HTTPException(
            status_code=status.HTTP_422_UNPROCESSABLE_ENTITY,
            detail=str(e)
        )


class DepartmentImportRequestSchema(BaseModel):
    """部门导入请求 Schema（API层）"""
    data: List[List[Any]] = Field(..., description="二维数组数据（第一行为表头，第二行为示例数据，从第三行开始为实际数据）")


@router.post("/batch-import")
async def import_departments(
    request: DepartmentImportRequestSchema,
    current_user: User = Depends(soil_get_current_user),
    tenant_id: int = Depends(get_current_tenant),
):
    """
    批量导入部门
    
    接收前端 uni_import 组件传递的二维数组数据，批量创建部门。
    数据格式：第一行为表头，第二行为示例数据（跳过），从第三行开始为实际数据。
    
    Args:
        request: 导入请求数据（包含二维数组）
        current_user: 当前用户（依赖注入）
        tenant_id: 当前组织ID（依赖注入）
        
    Returns:
        dict: 导入结果（成功数、失败数、错误列表）
        
    Raises:
        HTTPException: 当数据格式错误或导入失败时抛出
    """
    try:
        result = await DepartmentService.import_departments_from_data(
            tenant_id=tenant_id,
            data=request.data,
            current_user_id=current_user.id
        )
        return result
    except ValidationError as e:
        raise HTTPException(
            status_code=status.HTTP_422_UNPROCESSABLE_ENTITY,
            detail=str(e)
        )
    except Exception as e:
        raise HTTPException(
            status_code=status.HTTP_500_INTERNAL_SERVER_ERROR,
            detail=f"导入失败: {str(e)}"
        )

