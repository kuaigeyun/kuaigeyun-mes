"""
缺料预警 API 模块

提供缺料预警的 RESTful API 接口，支持多组织隔离。
注意：参数顺序为 路径参数 → Depends参数 → Query参数
"""

from fastapi import APIRouter, Depends, HTTPException, Query, status
from typing import List, Optional, Annotated
from pydantic import BaseModel

from core.api.deps.deps import get_current_user, get_current_tenant
from infra.models.user import User
from apps.kuaimrp.services.shortage_alert_service import ShortageAlertService
from apps.kuaimrp.schemas.shortage_alert_schemas import (
    ShortageAlertCreate, ShortageAlertUpdate, ShortageAlertResponse
)
from infra.exceptions.exceptions import NotFoundError, ValidationError

router = APIRouter(prefix="/shortage-alerts", tags=["Shortage Alerts"])


@router.post("", response_model=ShortageAlertResponse, status_code=status.HTTP_201_CREATED, summary="创建缺料预警")
async def create_shortage_alert(
    data: ShortageAlertCreate,
    current_user: Annotated[User, Depends(get_current_user)],
    tenant_id: Annotated[int, Depends(get_current_tenant)]
):
    """
    创建缺料预警
    
    - **alert_no**: 预警编号（必填，组织内唯一）
    - **material_id**: 物料ID（必填）
    - **shortage_qty**: 缺料数量（必填）
    - **shortage_date**: 缺料日期（必填）
    """
    try:
        return await ShortageAlertService.create_shortage_alert(tenant_id, data)
    except ValidationError as e:
        raise HTTPException(status_code=status.HTTP_400_BAD_REQUEST, detail=str(e))


@router.get("", response_model=List[ShortageAlertResponse], summary="获取缺料预警列表")
async def list_shortage_alerts(
    current_user: Annotated[User, Depends(get_current_user)],
    tenant_id: Annotated[int, Depends(get_current_tenant)],
    skip: int = Query(0, ge=0, description="跳过数量"),
    limit: int = Query(100, ge=1, le=1000, description="限制数量"),
    alert_level: Optional[str] = Query(None, description="预警等级（过滤）"),
    alert_status: Optional[str] = Query(None, description="预警状态（过滤）"),
    material_id: Optional[int] = Query(None, description="物料ID（过滤）")
):
    """
    获取缺料预警列表
    
    - **skip**: 跳过数量（默认：0）
    - **limit**: 限制数量（默认：100，最大：1000）
    - **alert_level**: 预警等级（可选，用于过滤）
    - **alert_status**: 预警状态（可选）
    - **material_id**: 物料ID（可选）
    """
    return await ShortageAlertService.list_shortage_alerts(
        tenant_id, skip, limit, alert_level, alert_status, material_id
    )


@router.get("/{alert_uuid}", response_model=ShortageAlertResponse, summary="获取缺料预警详情")
async def get_shortage_alert(
    alert_uuid: str,
    current_user: Annotated[User, Depends(get_current_user)],
    tenant_id: Annotated[int, Depends(get_current_tenant)]
):
    """
    根据UUID获取缺料预警详情
    
    - **alert_uuid**: 预警UUID
    """
    try:
        return await ShortageAlertService.get_shortage_alert_by_uuid(tenant_id, alert_uuid)
    except NotFoundError as e:
        raise HTTPException(status_code=status.HTTP_404_NOT_FOUND, detail=str(e))


@router.put("/{alert_uuid}", response_model=ShortageAlertResponse, summary="更新缺料预警")
async def update_shortage_alert(
    alert_uuid: str,
    data: ShortageAlertUpdate,
    current_user: Annotated[User, Depends(get_current_user)],
    tenant_id: Annotated[int, Depends(get_current_tenant)]
):
    """
    更新缺料预警
    
    - **alert_uuid**: 预警UUID
    - **data**: 预警更新数据
    """
    try:
        return await ShortageAlertService.update_shortage_alert(tenant_id, alert_uuid, data)
    except NotFoundError as e:
        raise HTTPException(status_code=status.HTTP_404_NOT_FOUND, detail=str(e))


@router.delete("/{alert_uuid}", status_code=status.HTTP_204_NO_CONTENT, summary="删除缺料预警")
async def delete_shortage_alert(
    alert_uuid: str,
    current_user: Annotated[User, Depends(get_current_user)],
    tenant_id: Annotated[int, Depends(get_current_tenant)]
):
    """
    删除缺料预警（软删除）
    
    - **alert_uuid**: 预警UUID
    """
    try:
        await ShortageAlertService.delete_shortage_alert(tenant_id, alert_uuid)
    except NotFoundError as e:
        raise HTTPException(status_code=status.HTTP_404_NOT_FOUND, detail=str(e))


class HandleShortageAlertRequest(BaseModel):
    """处理缺料预警请求"""
    handle_result: str = Query(..., description="处理结果")


@router.post("/{alert_uuid}/handle", response_model=ShortageAlertResponse, summary="处理缺料预警")
async def handle_shortage_alert(
    alert_uuid: str,
    current_user: Annotated[User, Depends(get_current_user)],
    tenant_id: Annotated[int, Depends(get_current_tenant)],
    handle_result: str = Query(..., description="处理结果")
):
    """
    处理缺料预警
    
    - **alert_uuid**: 预警UUID
    - **handle_result**: 处理结果
    """
    try:
        return await ShortageAlertService.handle_shortage_alert(tenant_id, alert_uuid, current_user.id, handle_result)
    except NotFoundError as e:
        raise HTTPException(status_code=status.HTTP_404_NOT_FOUND, detail=str(e))
