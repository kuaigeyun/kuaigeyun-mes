"""
产品数据 API 模块

提供产品数据的 RESTful API 接口，支持多组织隔离。
"""

from fastapi import APIRouter, Depends, HTTPException, Query, status
from typing import List, Optional, Annotated, Dict

from core.api.deps.deps import get_current_user, get_current_tenant
from infra.models.user import User
from apps.master_data.services.product_service import ProductService
from apps.master_data.schemas.product_schemas import (
    ProductCreate, ProductUpdate, ProductResponse,
    ProductBOMResponse, ProductGroupResponse
)
from infra.exceptions.exceptions import NotFoundError, ValidationError

router = APIRouter(prefix="/product", tags=["Product"])


# ==================== 产品相关接口 ====================

@router.post("", response_model=ProductResponse, summary="创建产品")
async def create_product(
    data: ProductCreate,
    current_user: Annotated[User, Depends(get_current_user)],
    tenant_id: Annotated[int, Depends(get_current_tenant)]
):
    """
    创建产品

    - **code**: 产品编码（必填，组织内唯一）
    - **name**: 产品名称（必填）
    - **specification**: 规格（可选）
    - **unit**: 单位（必填）
    - **bom_data**: BOM 数据（可选，JSON格式）
    - **version**: 版本号（可选）
    - **is_active**: 是否启用（默认：true）
    """
    try:
        return await ProductService.create_product(tenant_id, data)
    except ValidationError as e:
        raise HTTPException(status_code=status.HTTP_400_BAD_REQUEST, detail=str(e))


@router.get("", response_model=List[ProductResponse], summary="获取产品列表")
async def list_products(
    current_user: Annotated[User, Depends(get_current_user)],
    tenant_id: Annotated[int, Depends(get_current_tenant)],
    skip: int = Query(0, ge=0, description="跳过数量"),
    limit: int = Query(100, ge=1, le=1000, description="限制数量"),
    is_active: Optional[bool] = Query(None, description="是否启用")
):
    """
    获取产品列表

    - **skip**: 跳过数量（默认：0）
    - **limit**: 限制数量（默认：100，最大：1000）
    - **is_active**: 是否启用（可选）
    """
    return await ProductService.list_products(tenant_id, skip, limit, is_active)


@router.get("/{product_uuid}", response_model=ProductResponse, summary="获取产品详情")
async def get_product(
    product_uuid: str,
    current_user: Annotated[User, Depends(get_current_user)],
    tenant_id: Annotated[int, Depends(get_current_tenant)]
):
    """
    根据UUID获取产品详情

    - **product_uuid**: 产品UUID
    """
    try:
        return await ProductService.get_product_by_uuid(tenant_id, product_uuid)
    except NotFoundError as e:
        raise HTTPException(status_code=status.HTTP_404_NOT_FOUND, detail=str(e))


@router.put("/{product_uuid}", response_model=ProductResponse, summary="更新产品")
async def update_product(
    product_uuid: str,
    data: ProductUpdate,
    current_user: Annotated[User, Depends(get_current_user)],
    tenant_id: Annotated[int, Depends(get_current_tenant)]
):
    """
    更新产品

    - **product_uuid**: 产品UUID
    - **code**: 产品编码（可选）
    - **name**: 产品名称（可选）
    - **specification**: 规格（可选）
    - **unit**: 单位（可选）
    - **bom_data**: BOM 数据（可选，JSON格式）
    - **version**: 版本号（可选）
    - **is_active**: 是否启用（可选）
    """
    try:
        return await ProductService.update_product(tenant_id, product_uuid, data)
    except NotFoundError as e:
        raise HTTPException(status_code=status.HTTP_404_NOT_FOUND, detail=str(e))
    except ValidationError as e:
        raise HTTPException(status_code=status.HTTP_400_BAD_REQUEST, detail=str(e))


@router.delete("/{product_uuid}", summary="删除产品")
async def delete_product(
    product_uuid: str,
    current_user: Annotated[User, Depends(get_current_user)],
    tenant_id: Annotated[int, Depends(get_current_tenant)]
):
    """
    删除产品（软删除）

    - **product_uuid**: 产品UUID

    注意：删除产品前需要检查是否被其他业务使用
    """
    try:
        await ProductService.delete_product(tenant_id, product_uuid)
        return {"message": "产品删除成功"}
    except NotFoundError as e:
        raise HTTPException(status_code=status.HTTP_404_NOT_FOUND, detail=str(e))


# ==================== BOM相关接口 ====================

@router.get("/{product_uuid}/bom", response_model=ProductBOMResponse, summary="获取产品BOM结构")
async def get_product_bom(
    product_uuid: str,
    current_user: Annotated[User, Depends(get_current_user)],
    tenant_id: Annotated[int, Depends(get_current_tenant)]
):
    """
    获取产品的BOM结构

    返回产品的完整BOM信息，包括所有物料明细。

    - **product_uuid**: 产品UUID

    返回结构：
    ```json
    {
      "product_id": 1,
      "product_code": "P001",
      "product_name": "产品1",
      "product_version": "v1.0",
      "bom_items": [
        {
          "material_id": 1,
          "material_code": "M001",
          "material_name": "物料1",
          "quantity": 10.0,
          "unit": "kg",
          "version": "v1.0"
        }
      ]
    }
    ```
    """
    try:
        return await ProductService.get_product_bom(tenant_id, product_uuid)
    except NotFoundError as e:
        raise HTTPException(status_code=status.HTTP_404_NOT_FOUND, detail=str(e))


# ==================== 级联选择相关接口 ====================

@router.get("/grouped", response_model=Dict[str, List[ProductResponse]], summary="获取分组的产品列表")
async def get_products_grouped(
    current_user: Annotated[User, Depends(get_current_user)],
    tenant_id: Annotated[int, Depends(get_current_tenant)],
    is_active: Optional[bool] = Query(True, description="是否只查询启用的产品（默认：true）")
):
    """
    获取按首字母分组的产品列表

    用于前端级联选择组件，支持按首字母快速定位产品。

    - **is_active**: 是否只查询启用的产品（默认：true）

    返回结构：
    ```json
    {
      "A": [
        {
          "id": 1,
          "uuid": "...",
          "code": "A001",
          "name": "产品A001",
          "specification": "规格",
          "unit": "pcs",
          "version": "v1.0",
          "isActive": true
        }
      ],
      "B": [...],
      "#": [...]  // 非字母开头的编码
    }
    ```
    """
    return await ProductService.get_products_grouped(tenant_id, is_active)


@router.get("/by-category/{category_prefix}", response_model=List[ProductResponse], summary="根据分类前缀获取产品列表")
async def get_products_by_category(
    category_prefix: str,
    current_user: Annotated[User, Depends(get_current_user)],
    tenant_id: Annotated[int, Depends(get_current_tenant)],
    is_active: Optional[bool] = Query(True, description="是否只查询启用的产品（默认：true）")
):
    """
    根据分类前缀获取产品列表

    支持按产品编码前缀过滤，用于级联选择的子级查询。

    - **category_prefix**: 分类前缀（如"A"表示A开头的编码，"#"表示非字母开头）
    - **is_active**: 是否只查询启用的产品（默认：true）

    返回结构：
    ```json
    [
      {
        "id": 1,
        "uuid": "...",
        "code": "A001",
        "name": "产品A001",
        "specification": "规格",
        "unit": "pcs",
        "version": "v1.0",
        "isActive": true
      }
    ]
    ```
    """
    return await ProductService.get_products_by_category(tenant_id, category_prefix, is_active)
