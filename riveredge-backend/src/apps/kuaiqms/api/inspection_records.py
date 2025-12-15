"""
质量检验记录 API 模块

提供质量检验记录的 RESTful API 接口，支持多组织隔离。
注意：参数顺序为 路径参数 → Depends参数 → Query参数
"""

from fastapi import APIRouter, Depends, HTTPException, Query, status
from typing import List, Optional, Annotated

from core.api.deps.deps import get_current_user, get_current_tenant
from infra.models.user import User
from apps.kuaiqms.services.inspection_record_service import InspectionRecordService
from apps.kuaiqms.schemas.inspection_record_schemas import (
    InspectionRecordCreate, InspectionRecordUpdate, InspectionRecordResponse
)
from infra.exceptions.exceptions import NotFoundError, ValidationError

router = APIRouter(prefix="/inspection-records", tags=["InspectionRecords"])


@router.post("", response_model=InspectionRecordResponse, status_code=status.HTTP_201_CREATED, summary="创建质量检验记录")
async def create_inspection_record(
    data: InspectionRecordCreate,
    current_user: Annotated[User, Depends(get_current_user)],
    tenant_id: Annotated[int, Depends(get_current_tenant)]
):
    """创建质量检验记录"""
    try:
        return await InspectionRecordService.create_inspection_record(tenant_id, data)
    except ValidationError as e:
        raise HTTPException(status_code=status.HTTP_400_BAD_REQUEST, detail=str(e))


@router.get("", response_model=List[InspectionRecordResponse], summary="获取质量检验记录列表")
async def list_inspection_records(
    current_user: Annotated[User, Depends(get_current_user)],
    tenant_id: Annotated[int, Depends(get_current_tenant)],
    skip: int = Query(0, ge=0, description="跳过数量"),
    limit: int = Query(100, ge=1, le=1000, description="限制数量"),
    inspection_type: Optional[str] = Query(None, description="检验类型（过滤）"),
    inspection_result: Optional[str] = Query(None, description="检验结果（过滤）"),
    task_uuid: Optional[str] = Query(None, description="检验任务UUID（过滤）")
):
    """获取质量检验记录列表"""
    return await InspectionRecordService.list_inspection_records(tenant_id, skip, limit, inspection_type, inspection_result, task_uuid)


@router.get("/{record_uuid}", response_model=InspectionRecordResponse, summary="获取质量检验记录详情")
async def get_inspection_record(
    record_uuid: str,
    current_user: Annotated[User, Depends(get_current_user)],
    tenant_id: Annotated[int, Depends(get_current_tenant)]
):
    """根据UUID获取质量检验记录详情"""
    try:
        return await InspectionRecordService.get_inspection_record_by_uuid(tenant_id, record_uuid)
    except NotFoundError as e:
        raise HTTPException(status_code=status.HTTP_404_NOT_FOUND, detail=str(e))


@router.put("/{record_uuid}", response_model=InspectionRecordResponse, summary="更新质量检验记录")
async def update_inspection_record(
    record_uuid: str,
    data: InspectionRecordUpdate,
    current_user: Annotated[User, Depends(get_current_user)],
    tenant_id: Annotated[int, Depends(get_current_tenant)]
):
    """更新质量检验记录"""
    try:
        return await InspectionRecordService.update_inspection_record(tenant_id, record_uuid, data)
    except NotFoundError as e:
        raise HTTPException(status_code=status.HTTP_404_NOT_FOUND, detail=str(e))
    except ValidationError as e:
        raise HTTPException(status_code=status.HTTP_400_BAD_REQUEST, detail=str(e))


@router.delete("/{record_uuid}", status_code=status.HTTP_204_NO_CONTENT, summary="删除质量检验记录")
async def delete_inspection_record(
    record_uuid: str,
    current_user: Annotated[User, Depends(get_current_user)],
    tenant_id: Annotated[int, Depends(get_current_tenant)]
):
    """删除质量检验记录"""
    try:
        await InspectionRecordService.delete_inspection_record(tenant_id, record_uuid)
    except NotFoundError as e:
        raise HTTPException(status_code=status.HTTP_404_NOT_FOUND, detail=str(e))
