"""
绩效数据 API 模块

提供绩效数据的 RESTful API 接口（假期、技能），支持多组织隔离。
"""

from fastapi import APIRouter, Depends, HTTPException, Query, status
from typing import List, Optional, Annotated
from datetime import date

from core.api.deps.deps import get_current_user, get_current_tenant
from infra.models.user import User
from apps.master_data.services.performance_service import PerformanceService
from apps.master_data.schemas.performance_schemas import (
    HolidayCreate, HolidayUpdate, HolidayResponse,
    SkillCreate, SkillUpdate, SkillResponse
)
from infra.exceptions.exceptions import NotFoundError, ValidationError

router = APIRouter(prefix="/performance", tags=["Performance"])


# ==================== 假期相关接口 ====================

@router.post("/holidays", response_model=HolidayResponse, summary="创建假期")
async def create_holiday(
    data: HolidayCreate,
    current_user: Annotated[User, Depends(get_current_user)],
    tenant_id: Annotated[int, Depends(get_current_tenant)]
):
    """
    创建假期
    
    - **name**: 假期名称（必填）
    - **holiday_date**: 假期日期（必填，DATE类型）
    - **holiday_type**: 假期类型（可选，如：法定节假日、公司假期等）
    - **description**: 描述（可选）
    - **is_active**: 是否启用（默认：true）
    """
    try:
        return await PerformanceService.create_holiday(tenant_id, data)
    except ValidationError as e:
        raise HTTPException(status_code=status.HTTP_400_BAD_REQUEST, detail=str(e))


@router.get("/holidays", response_model=List[HolidayResponse], summary="获取假期列表")
async def list_holidays(
    current_user: Annotated[User, Depends(get_current_user)],
    tenant_id: Annotated[int, Depends(get_current_tenant)],
    skip: int = Query(0, ge=0, description="跳过数量"),
    limit: int = Query(100, ge=1, le=1000, description="限制数量"),
    holiday_type: Optional[str] = Query(None, description="假期类型（过滤）"),
    start_date: Optional[date] = Query(None, description="开始日期（过滤）"),
    end_date: Optional[date] = Query(None, description="结束日期（过滤）"),
    is_active: Optional[bool] = Query(None, description="是否启用")
):
    """
    获取假期列表
    
    - **skip**: 跳过数量（默认：0）
    - **limit**: 限制数量（默认：100，最大：1000）
    - **holiday_type**: 假期类型（可选，用于过滤）
    - **start_date**: 开始日期（可选，用于过滤）
    - **end_date**: 结束日期（可选，用于过滤）
    - **is_active**: 是否启用（可选）
    """
    return await PerformanceService.list_holidays(tenant_id, skip, limit, holiday_type, start_date, end_date, is_active)


@router.get("/holidays/{holiday_uuid}", response_model=HolidayResponse, summary="获取假期详情")
async def get_holiday(
    holiday_uuid: str,
    current_user: Annotated[User, Depends(get_current_user)],
    tenant_id: Annotated[int, Depends(get_current_tenant)]
):
    """
    根据UUID获取假期详情
    
    - **holiday_uuid**: 假期UUID
    """
    try:
        return await PerformanceService.get_holiday_by_uuid(tenant_id, holiday_uuid)
    except NotFoundError as e:
        raise HTTPException(status_code=status.HTTP_404_NOT_FOUND, detail=str(e))


@router.put("/holidays/{holiday_uuid}", response_model=HolidayResponse, summary="更新假期")
async def update_holiday(
    holiday_uuid: str,
    data: HolidayUpdate,
    current_user: Annotated[User, Depends(get_current_user)],
    tenant_id: Annotated[int, Depends(get_current_tenant)]
):
    """
    更新假期
    
    - **holiday_uuid**: 假期UUID
    - **name**: 假期名称（可选）
    - **holiday_date**: 假期日期（可选，DATE类型）
    - **holiday_type**: 假期类型（可选）
    - **description**: 描述（可选）
    - **is_active**: 是否启用（可选）
    """
    try:
        return await PerformanceService.update_holiday(tenant_id, holiday_uuid, data)
    except NotFoundError as e:
        raise HTTPException(status_code=status.HTTP_404_NOT_FOUND, detail=str(e))
    except ValidationError as e:
        raise HTTPException(status_code=status.HTTP_400_BAD_REQUEST, detail=str(e))


@router.delete("/holidays/{holiday_uuid}", summary="删除假期")
async def delete_holiday(
    holiday_uuid: str,
    current_user: Annotated[User, Depends(get_current_user)],
    tenant_id: Annotated[int, Depends(get_current_tenant)]
):
    """
    删除假期（软删除）
    
    - **holiday_uuid**: 假期UUID
    """
    try:
        await PerformanceService.delete_holiday(tenant_id, holiday_uuid)
        return {"message": "假期删除成功"}
    except NotFoundError as e:
        raise HTTPException(status_code=status.HTTP_404_NOT_FOUND, detail=str(e))


# ==================== 技能相关接口 ====================

@router.post("/skills", response_model=SkillResponse, summary="创建技能")
async def create_skill(
    data: SkillCreate,
    current_user: Annotated[User, Depends(get_current_user)],
    tenant_id: Annotated[int, Depends(get_current_tenant)]
):
    """
    创建技能
    
    - **code**: 技能编码（必填，组织内唯一）
    - **name**: 技能名称（必填）
    - **category**: 技能分类（可选）
    - **description**: 描述（可选）
    - **is_active**: 是否启用（默认：true）
    """
    try:
        return await PerformanceService.create_skill(tenant_id, data)
    except ValidationError as e:
        raise HTTPException(status_code=status.HTTP_400_BAD_REQUEST, detail=str(e))


@router.get("/skills", response_model=List[SkillResponse], summary="获取技能列表")
async def list_skills(
    current_user: Annotated[User, Depends(get_current_user)],
    tenant_id: Annotated[int, Depends(get_current_tenant)],
    skip: int = Query(0, ge=0, description="跳过数量"),
    limit: int = Query(100, ge=1, le=1000, description="限制数量"),
    category: Optional[str] = Query(None, description="技能分类（过滤）"),
    is_active: Optional[bool] = Query(None, description="是否启用")
):
    """
    获取技能列表
    
    - **skip**: 跳过数量（默认：0）
    - **limit**: 限制数量（默认：100，最大：1000）
    - **category**: 技能分类（可选，用于过滤）
    - **is_active**: 是否启用（可选）
    """
    return await PerformanceService.list_skills(tenant_id, skip, limit, category, is_active)


@router.get("/skills/{skill_uuid}", response_model=SkillResponse, summary="获取技能详情")
async def get_skill(
    skill_uuid: str,
    current_user: Annotated[User, Depends(get_current_user)],
    tenant_id: Annotated[int, Depends(get_current_tenant)]
):
    """
    根据UUID获取技能详情
    
    - **skill_uuid**: 技能UUID
    """
    try:
        return await PerformanceService.get_skill_by_uuid(tenant_id, skill_uuid)
    except NotFoundError as e:
        raise HTTPException(status_code=status.HTTP_404_NOT_FOUND, detail=str(e))


@router.put("/skills/{skill_uuid}", response_model=SkillResponse, summary="更新技能")
async def update_skill(
    skill_uuid: str,
    data: SkillUpdate,
    current_user: Annotated[User, Depends(get_current_user)],
    tenant_id: Annotated[int, Depends(get_current_tenant)]
):
    """
    更新技能
    
    - **skill_uuid**: 技能UUID
    - **code**: 技能编码（可选）
    - **name**: 技能名称（可选）
    - **category**: 技能分类（可选）
    - **description**: 描述（可选）
    - **is_active**: 是否启用（可选）
    """
    try:
        return await PerformanceService.update_skill(tenant_id, skill_uuid, data)
    except NotFoundError as e:
        raise HTTPException(status_code=status.HTTP_404_NOT_FOUND, detail=str(e))
    except ValidationError as e:
        raise HTTPException(status_code=status.HTTP_400_BAD_REQUEST, detail=str(e))


@router.delete("/skills/{skill_uuid}", summary="删除技能")
async def delete_skill(
    skill_uuid: str,
    current_user: Annotated[User, Depends(get_current_user)],
    tenant_id: Annotated[int, Depends(get_current_tenant)]
):
    """
    删除技能（软删除）
    
    - **skill_uuid**: 技能UUID
    """
    try:
        await PerformanceService.delete_skill(tenant_id, skill_uuid)
        return {"message": "技能删除成功"}
    except NotFoundError as e:
        raise HTTPException(status_code=status.HTTP_404_NOT_FOUND, detail=str(e))

