"""
会计科目 API 模块

提供会计科目的 RESTful API 接口，支持多组织隔离。
"""

from fastapi import APIRouter, Depends, HTTPException, Query, status
from typing import List, Optional, Annotated

from core.api.deps.deps import get_current_user, get_current_tenant
from infra.models.user import User
from apps.kuaiacc.services.account_subject_service import AccountSubjectService
from apps.kuaiacc.schemas.account_subject_schemas import (
    AccountSubjectCreate, AccountSubjectUpdate, AccountSubjectResponse
)
from infra.exceptions.exceptions import NotFoundError, ValidationError

router = APIRouter(prefix="/account-subjects", tags=["会计科目"])


@router.post("", response_model=AccountSubjectResponse, summary="创建会计科目")
async def create_account_subject(
    data: AccountSubjectCreate,
    current_user: Annotated[User, Depends(get_current_user)],
    tenant_id: Annotated[int, Depends(get_current_tenant)]
):
    """
    创建会计科目
    
    - **subject_code**: 科目编码（必填，组织内唯一，按中国会计准则4-2-2-2结构）
    - **subject_name**: 科目名称（必填）
    - **subject_type**: 科目类型（必填：资产、负债、所有者权益、收入、费用）
    - **parent_id**: 父科目ID（可选，用于科目层级）
    - **level**: 科目层级（1-4级，按中国会计准则）
    - **direction**: 余额方向（借方、贷方）
    - **status**: 状态（启用、停用）
    """
    try:
        return await AccountSubjectService.create_account_subject(tenant_id, data)
    except ValidationError as e:
        raise HTTPException(status_code=status.HTTP_400_BAD_REQUEST, detail=str(e))


@router.get("", response_model=List[AccountSubjectResponse], summary="获取会计科目列表")
async def list_account_subjects(
    current_user: Annotated[User, Depends(get_current_user)],
    tenant_id: Annotated[int, Depends(get_current_tenant)],
    skip: int = Query(0, ge=0, description="跳过数量"),
    limit: int = Query(100, ge=1, le=1000, description="限制数量"),
    subject_type: Optional[str] = Query(None, description="科目类型（过滤）"),
    status: Optional[str] = Query(None, description="状态（过滤）"),
    parent_id: Optional[int] = Query(None, description="父科目ID（过滤）")
):
    """
    获取会计科目列表
    
    - **skip**: 跳过数量（默认：0）
    - **limit**: 限制数量（默认：100，最大：1000）
    - **subject_type**: 科目类型（可选，用于过滤）
    - **status**: 状态（可选，用于过滤）
    - **parent_id**: 父科目ID（可选，用于过滤）
    """
    return await AccountSubjectService.list_account_subjects(
        tenant_id, skip, limit, subject_type, status, parent_id
    )


@router.get("/{subject_uuid}", response_model=AccountSubjectResponse, summary="获取会计科目详情")
async def get_account_subject(
    subject_uuid: str,
    current_user: Annotated[User, Depends(get_current_user)],
    tenant_id: Annotated[int, Depends(get_current_tenant)]
):
    """
    根据UUID获取会计科目详情
    
    - **subject_uuid**: 科目UUID
    """
    try:
        return await AccountSubjectService.get_account_subject_by_uuid(tenant_id, subject_uuid)
    except NotFoundError as e:
        raise HTTPException(status_code=status.HTTP_404_NOT_FOUND, detail=str(e))


@router.put("/{subject_uuid}", response_model=AccountSubjectResponse, summary="更新会计科目")
async def update_account_subject(
    subject_uuid: str,
    data: AccountSubjectUpdate,
    current_user: Annotated[User, Depends(get_current_user)],
    tenant_id: Annotated[int, Depends(get_current_tenant)]
):
    """
    更新会计科目
    
    - **subject_uuid**: 科目UUID
    """
    try:
        return await AccountSubjectService.update_account_subject(tenant_id, subject_uuid, data)
    except NotFoundError as e:
        raise HTTPException(status_code=status.HTTP_404_NOT_FOUND, detail=str(e))
    except ValidationError as e:
        raise HTTPException(status_code=status.HTTP_400_BAD_REQUEST, detail=str(e))


@router.delete("/{subject_uuid}", status_code=status.HTTP_204_NO_CONTENT, summary="删除会计科目")
async def delete_account_subject(
    subject_uuid: str,
    current_user: Annotated[User, Depends(get_current_user)],
    tenant_id: Annotated[int, Depends(get_current_tenant)]
):
    """
    删除会计科目（软删除）
    
    - **subject_uuid**: 科目UUID
    """
    try:
        await AccountSubjectService.delete_account_subject(tenant_id, subject_uuid)
    except NotFoundError as e:
        raise HTTPException(status_code=status.HTTP_404_NOT_FOUND, detail=str(e))
    except ValidationError as e:
        raise HTTPException(status_code=status.HTTP_400_BAD_REQUEST, detail=str(e))

