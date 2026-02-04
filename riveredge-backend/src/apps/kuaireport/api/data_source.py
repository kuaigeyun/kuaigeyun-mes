from fastapi import APIRouter, Depends, Query
from typing import Optional
from core.api.deps import get_current_user, get_current_tenant
from apps.kuaireport.models.data_source import DataSource
from apps.kuaireport.constants import DataSourceType

router = APIRouter(prefix="/data-sources", tags=["KuanReport - Data Sources"])

@router.get("", summary="获取数据源列表")
async def list_data_sources(
    current_user: dict = Depends(get_current_user),
    tenant_id: int = Depends(get_current_tenant)
):
    records = await DataSource.filter(tenant_id=tenant_id).all()
    return {"data": records, "success": True}

@router.post("", summary="创建数据源")
async def create_data_source(
    data: dict,
    current_user: dict = Depends(get_current_user),
    tenant_id: int = Depends(get_current_tenant)
):
    record = await DataSource.create(
        tenant_id=tenant_id,
        created_by=current_user["id"],
        **data
    )
    return record

@router.get("/{id}", summary="获取数据源详情")
async def get_data_source(
    id: int,
    current_user: dict = Depends(get_current_user),
    tenant_id: int = Depends(get_current_tenant)
):
    return await DataSource.get(tenant_id=tenant_id, id=id)

@router.delete("/{id}", summary="删除数据源")
async def delete_data_source(
    id: int,
    current_user: dict = Depends(get_current_user),
    tenant_id: int = Depends(get_current_tenant)
):
    await DataSource.filter(tenant_id=tenant_id, id=id).delete()
    return {"success": True}
