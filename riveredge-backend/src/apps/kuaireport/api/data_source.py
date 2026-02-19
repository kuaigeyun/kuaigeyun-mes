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
    # 自动确保护租户拥有一个默认的本地数据库数据源
    internal_exists = await DataSource.filter(
        tenant_id=tenant_id, 
        type=DataSourceType.INTERNAL
    ).exists()
    
    if not internal_exists:
        await DataSource.create(
            tenant_id=tenant_id,
            name="本地数据库",
            type=DataSourceType.INTERNAL,
            is_default=True,
            is_system=True,
            description="系统内置本地数据库"
        )

    records = await DataSource.filter(tenant_id=tenant_id).order_by("-is_default", "id").all()
    return {"data": records, "success": True}

@router.post("", summary="创建数据源")
async def create_data_source(
    data: dict,
    current_user: dict = Depends(get_current_user),
    tenant_id: int = Depends(get_current_tenant)
):
    # 如果新创建的数据源设为默认，则取消该租户下其他数据源的默认标识
    if data.get("is_default"):
        await DataSource.filter(tenant_id=tenant_id).update(is_default=False)
        
    record = await DataSource.create(
        tenant_id=tenant_id,
        created_by=current_user["id"],
        **data
    )
    return record

@router.put("/{id}", summary="修改数据源")
async def update_data_source(
    id: int,
    data: dict,
    current_user: dict = Depends(get_current_user),
    tenant_id: int = Depends(get_current_tenant)
):
    if data.get("is_default"):
        await DataSource.filter(tenant_id=tenant_id).update(is_default=False)
        
    await DataSource.filter(tenant_id=tenant_id, id=id).update(**data)
    return await DataSource.get(tenant_id=tenant_id, id=id)

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
    record = await DataSource.get_or_none(tenant_id=tenant_id, id=id)
    if record and record.is_system:
        return {"success": False, "message": "系统内置数据源不允许删除"}
        
    await DataSource.filter(tenant_id=tenant_id, id=id).delete()
    return {"success": True}

@router.post("/test-connection", summary="测试数据源连接")
async def test_connection(
    data: dict,
    current_user: dict = Depends(get_current_user),
    tenant_id: int = Depends(get_current_tenant)
):
    source_type = data.get("type")
    config = data.get("config", {})
    
    if source_type == DataSourceType.INTERNAL:
        return {"success": True, "message": "本地数据库连接正常"}
        
    try:
        if source_type in (DataSourceType.POSTGRESQL, DataSourceType.MYSQL):
            from tortoise.backends.asyncpg.client import AsyncpgDBClient
            client = AsyncpgDBClient(
                host=config.get("host"),
                port=int(config.get("port", 5432)),
                user=config.get("user"),
                password=config.get("password"),
                database=config.get("database")
            )
            await client.create_connection()
            await client.close()
            return {"success": True, "message": "数据库连接测试成功"}
            
        elif source_type == DataSourceType.API:
            import httpx
            url = config.get("url")
            headers = {}
            if config.get("token"):
                headers["Authorization"] = f"Bearer {config['token']}"
                
            async with httpx.AsyncClient(timeout=5.0) as client:
                # 尝试一个简单的 HEAD 或 GET 请求
                response = await client.get(url, headers=headers)
                if response.status_code < 500:
                    return {"success": True, "message": f"API 探测成功 (状态码: {response.status_code})"}
                else:
                    return {"success": False, "message": f"API 返回错误 (状态码: {response.status_code})"}
        
        return {"success": False, "message": f"暂不支持测试类型: {source_type}"}
    except Exception as e:
        return {"success": False, "message": f"连接失败: {str(e)}"}
