"""
ISO质量审核 API 模块

提供ISO质量审核的 RESTful API 接口，支持多组织隔离。
注意：参数顺序为 路径参数 → Depends参数 → Query参数
"""

from fastapi import APIRouter, Depends, HTTPException, Query, status
from typing import List, Optional, Annotated

from core.api.deps.deps import get_current_user, get_current_tenant
from infra.models.user import User
from apps.kuaiqms.services.iso_audit_service import ISOAuditService
from apps.kuaiqms.schemas.iso_audit_schemas import (
    ISOAuditCreate, ISOAuditUpdate, ISOAuditResponse
)
from infra.exceptions.exceptions import NotFoundError, ValidationError

router = APIRouter(prefix="/iso-audits", tags=["ISOAudits"])


@router.post("", response_model=ISOAuditResponse, status_code=status.HTTP_201_CREATED, summary="创建ISO质量审核")
async def create_iso_audit(
    data: ISOAuditCreate,
    current_user: Annotated[User, Depends(get_current_user)],
    tenant_id: Annotated[int, Depends(get_current_tenant)]
):
    """创建ISO质量审核"""
    try:
        return await ISOAuditService.create_iso_audit(tenant_id, data)
    except ValidationError as e:
        raise HTTPException(status_code=status.HTTP_400_BAD_REQUEST, detail=str(e))


@router.get("", response_model=List[ISOAuditResponse], summary="获取ISO质量审核列表")
async def list_iso_audits(
    current_user: Annotated[User, Depends(get_current_user)],
    tenant_id: Annotated[int, Depends(get_current_tenant)],
    skip: int = Query(0, ge=0, description="跳过数量"),
    limit: int = Query(100, ge=1, le=1000, description="限制数量"),
    audit_type: Optional[str] = Query(None, description="审核类型（过滤）"),
    iso_standard: Optional[str] = Query(None, description="ISO标准（过滤）"),
    status: Optional[str] = Query(None, description="审核状态（过滤）")
):
    """获取ISO质量审核列表"""
    return await ISOAuditService.list_iso_audits(tenant_id, skip, limit, audit_type, iso_standard, status)


@router.get("/{audit_uuid}", response_model=ISOAuditResponse, summary="获取ISO质量审核详情")
async def get_iso_audit(
    audit_uuid: str,
    current_user: Annotated[User, Depends(get_current_user)],
    tenant_id: Annotated[int, Depends(get_current_tenant)]
):
    """根据UUID获取ISO质量审核详情"""
    try:
        return await ISOAuditService.get_iso_audit_by_uuid(tenant_id, audit_uuid)
    except NotFoundError as e:
        raise HTTPException(status_code=status.HTTP_404_NOT_FOUND, detail=str(e))


@router.put("/{audit_uuid}", response_model=ISOAuditResponse, summary="更新ISO质量审核")
async def update_iso_audit(
    audit_uuid: str,
    data: ISOAuditUpdate,
    current_user: Annotated[User, Depends(get_current_user)],
    tenant_id: Annotated[int, Depends(get_current_tenant)]
):
    """更新ISO质量审核"""
    try:
        return await ISOAuditService.update_iso_audit(tenant_id, audit_uuid, data)
    except NotFoundError as e:
        raise HTTPException(status_code=status.HTTP_404_NOT_FOUND, detail=str(e))
    except ValidationError as e:
        raise HTTPException(status_code=status.HTTP_400_BAD_REQUEST, detail=str(e))


@router.delete("/{audit_uuid}", status_code=status.HTTP_204_NO_CONTENT, summary="删除ISO质量审核")
async def delete_iso_audit(
    audit_uuid: str,
    current_user: Annotated[User, Depends(get_current_user)],
    tenant_id: Annotated[int, Depends(get_current_tenant)]
):
    """删除ISO质量审核"""
    try:
        await ISOAuditService.delete_iso_audit(tenant_id, audit_uuid)
    except NotFoundError as e:
        raise HTTPException(status_code=status.HTTP_404_NOT_FOUND, detail=str(e))
