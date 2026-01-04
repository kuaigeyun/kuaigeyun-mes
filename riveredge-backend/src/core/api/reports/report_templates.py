"""
报表模板管理 API 路由模块

提供报表模板的CRUD操作API接口。

Author: Luigi Lu
Date: 2025-01-15
"""

from typing import List, Optional
from fastapi import APIRouter, Depends, Query, Path, status
from fastapi.responses import StreamingResponse
from loguru import logger

from core.api.deps import get_current_user, get_current_tenant
from core.schemas.report import (
    ReportTemplateCreate,
    ReportTemplateUpdate,
    ReportTemplateResponse,
    ReportTemplateListResponse,
)
from core.services.report_template_service import ReportTemplateService
from infra.models.user import User
from infra.exceptions.exceptions import NotFoundError, ValidationError

# 初始化服务实例
report_template_service = ReportTemplateService()

# 创建路由
router = APIRouter(prefix="/reports/templates", tags=["报表模板"])


@router.post("", response_model=ReportTemplateResponse, status_code=status.HTTP_201_CREATED, summary="创建报表模板")
async def create_report_template(
    template_data: ReportTemplateCreate,
    current_user: User = Depends(get_current_user),
    tenant_id: int = Depends(get_current_tenant),
) -> ReportTemplateResponse:
    """
    创建报表模板

    - **name**: 模板名称
    - **code**: 模板编码
    - **type**: 报表类型
    - **config**: 报表配置（JSON格式）
    """
    return await report_template_service.create_template(
        tenant_id=tenant_id,
        template_data=template_data,
        created_by=current_user.id,
    )


@router.get("", response_model=List[ReportTemplateListResponse], summary="获取报表模板列表")
async def list_report_templates(
    type: Optional[str] = Query(None, description="报表类型"),
    category: Optional[str] = Query(None, description="分类"),
    status: Optional[str] = Query(None, description="状态"),
    skip: int = Query(0, ge=0, description="跳过数量"),
    limit: int = Query(100, ge=1, le=1000, description="限制数量"),
    current_user: User = Depends(get_current_user),
    tenant_id: int = Depends(get_current_tenant),
) -> List[ReportTemplateListResponse]:
    """
    获取报表模板列表

    支持按类型、分类、状态筛选。
    """
    return await report_template_service.list_templates(
        tenant_id=tenant_id,
        type=type,
        category=category,
        status=status,
        skip=skip,
        limit=limit,
    )


@router.get("/{template_id}", response_model=ReportTemplateResponse, summary="获取报表模板详情")
async def get_report_template(
    template_id: int = Path(..., description="模板ID"),
    current_user: User = Depends(get_current_user),
    tenant_id: int = Depends(get_current_tenant),
) -> ReportTemplateResponse:
    """
    获取报表模板详情

    - **template_id**: 模板ID
    """
    return await report_template_service.get_template(
        tenant_id=tenant_id,
        template_id=template_id,
    )


@router.put("/{template_id}", response_model=ReportTemplateResponse, summary="更新报表模板")
async def update_report_template(
    template_id: int = Path(..., description="模板ID"),
    template_data: ReportTemplateUpdate = ...,
    current_user: User = Depends(get_current_user),
    tenant_id: int = Depends(get_current_tenant),
) -> ReportTemplateResponse:
    """
    更新报表模板

    - **template_id**: 模板ID
    - **template_data**: 更新数据
    """
    return await report_template_service.update_template(
        tenant_id=tenant_id,
        template_id=template_id,
        template_data=template_data,
        updated_by=current_user.id,
    )


@router.delete("/{template_id}", status_code=status.HTTP_204_NO_CONTENT, summary="删除报表模板")
async def delete_report_template(
    template_id: int = Path(..., description="模板ID"),
    current_user: User = Depends(get_current_user),
    tenant_id: int = Depends(get_current_tenant),
):
    """
    删除报表模板（软删除）

    - **template_id**: 模板ID
    """
    await report_template_service.delete_template(
        tenant_id=tenant_id,
        template_id=template_id,
    )


@router.post("/{template_id}/generate", summary="生成报表")
async def generate_report(
    template_id: int = Path(..., description="模板ID"),
    format: str = Query("excel", description="输出格式（excel/pdf）"),
    current_user: User = Depends(get_current_user),
    tenant_id: int = Depends(get_current_tenant),
):
    """
    生成报表文件

    - **template_id**: 模板ID
    - **format**: 输出格式（excel/pdf）
    """
    file_content = await report_template_service.generate_report(
        tenant_id=tenant_id,
        template_id=template_id,
        format=format,
    )

    # 确定文件扩展名和MIME类型
    if format == "excel":
        filename = "report.xlsx"
        media_type = "application/vnd.openxmlformats-officedocument.spreadsheetml.sheet"
    else:
        filename = "report.pdf"
        media_type = "application/pdf"

    return StreamingResponse(
        iter([file_content]),
        media_type=media_type,
        headers={"Content-Disposition": f'attachment; filename="{filename}"'},
    )

