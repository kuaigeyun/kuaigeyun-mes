"""
产品数据服务模块

提供产品数据的业务逻辑处理，支持多组织隔离。
"""

from typing import List, Optional, Dict, Any

from apps.master_data.models.product import Product
from apps.master_data.models.material import Material
from apps.master_data.schemas.product_schemas import (
    ProductCreate, ProductUpdate, ProductResponse,
    ProductBOMResponse, BOMItemResponse
)
from infra.exceptions.exceptions import NotFoundError, ValidationError


class ProductService:
    """产品数据服务"""

    # ==================== 产品相关方法 ====================

    @staticmethod
    async def create_product(
        tenant_id: int,
        data: ProductCreate
    ) -> ProductResponse:
        """
        创建产品

        Args:
            tenant_id: 租户ID
            data: 产品创建数据

        Returns:
            ProductResponse: 创建的产品对象

        Raises:
            ValidationError: 当编码已存在时抛出
        """
        # 检查编码是否已存在
        existing = await Product.filter(
            tenant_id=tenant_id,
            code=data.code,
            deleted_at__isnull=True
        ).first()

        if existing:
            raise ValidationError(f"产品编码 {data.code} 已存在")

        # 创建产品
        product = await Product.create(
            tenant_id=tenant_id,
            **data.dict()
        )

        return ProductResponse.model_validate(product)

    @staticmethod
    async def get_product_by_uuid(
        tenant_id: int,
        product_uuid: str
    ) -> ProductResponse:
        """
        根据UUID获取产品

        Args:
            tenant_id: 租户ID
            product_uuid: 产品UUID

        Returns:
            ProductResponse: 产品对象

        Raises:
            NotFoundError: 当产品不存在时抛出
        """
        product = await Product.filter(
            tenant_id=tenant_id,
            uuid=product_uuid,
            deleted_at__isnull=True
        ).first()

        if not product:
            raise NotFoundError(f"产品 {product_uuid} 不存在")

        return ProductResponse.model_validate(product)

    @staticmethod
    async def list_products(
        tenant_id: int,
        skip: int = 0,
        limit: int = 100,
        is_active: Optional[bool] = None
    ) -> List[ProductResponse]:
        """
        获取产品列表

        Args:
            tenant_id: 租户ID
            skip: 跳过数量
            limit: 限制数量
            is_active: 是否启用（可选）

        Returns:
            List[ProductResponse]: 产品列表
        """
        query = Product.filter(
            tenant_id=tenant_id,
            deleted_at__isnull=True
        )

        if is_active is not None:
            query = query.filter(is_active=is_active)

        products = await query.offset(skip).limit(limit).order_by("code").all()

        return [ProductResponse.model_validate(p) for p in products]

    @staticmethod
    async def update_product(
        tenant_id: int,
        product_uuid: str,
        data: ProductUpdate
    ) -> ProductResponse:
        """
        更新产品

        Args:
            tenant_id: 租户ID
            product_uuid: 产品UUID
            data: 产品更新数据

        Returns:
            ProductResponse: 更新后的产品对象

        Raises:
            NotFoundError: 当产品不存在时抛出
            ValidationError: 当编码已存在时抛出
        """
        product = await Product.filter(
            tenant_id=tenant_id,
            uuid=product_uuid,
            deleted_at__isnull=True
        ).first()

        if not product:
            raise NotFoundError(f"产品 {product_uuid} 不存在")

        # 如果更新编码，检查是否已存在
        if data.code and data.code != product.code:
            existing = await Product.filter(
                tenant_id=tenant_id,
                code=data.code,
                deleted_at__isnull=True
            ).first()

            if existing:
                raise ValidationError(f"产品编码 {data.code} 已存在")

        # 更新字段
        update_data = data.dict(exclude_unset=True)
        for key, value in update_data.items():
            setattr(product, key, value)

        await product.save()

        return ProductResponse.model_validate(product)

    @staticmethod
    async def delete_product(
        tenant_id: int,
        product_uuid: str
    ) -> None:
        """
        删除产品（软删除）

        Args:
            tenant_id: 租户ID
            product_uuid: 产品UUID

        Raises:
            NotFoundError: 当产品不存在时抛出
        """
        product = await Product.filter(
            tenant_id=tenant_id,
            uuid=product_uuid,
            deleted_at__isnull=True
        ).first()

        if not product:
            raise NotFoundError(f"产品 {product_uuid} 不存在")

        # 软删除
        from tortoise import timezone
        product.deleted_at = timezone.now()
        await product.save()

    # ==================== BOM相关方法 ====================

    @staticmethod
    async def get_product_bom(
        tenant_id: int,
        product_uuid: str
    ) -> ProductBOMResponse:
        """
        获取产品的BOM结构

        Args:
            tenant_id: 租户ID
            product_uuid: 产品UUID

        Returns:
            ProductBOMResponse: 产品BOM响应对象

        Raises:
            NotFoundError: 当产品不存在时抛出
        """
        product = await Product.filter(
            tenant_id=tenant_id,
            uuid=product_uuid,
            deleted_at__isnull=True
        ).first()

        if not product:
            raise NotFoundError(f"产品 {product_uuid} 不存在")

        # 解析BOM数据
        bom_items = []
        if product.bom_data:
            # BOM数据格式假设为：
            # {
            #   "items": [
            #     {"material_id": 1, "quantity": 10.0, "unit": "kg", "version": "v1.0"},
            #     ...
            #   ]
            # }
            items_data = product.bom_data.get("items", [])

            for item_data in items_data:
                material_id = item_data.get("material_id")
                if material_id:
                    # 获取物料信息
                    material = await Material.filter(
                        tenant_id=tenant_id,
                        id=material_id,
                        deleted_at__isnull=True
                    ).first()

                    if material:
                        bom_item = BOMItemResponse(
                            material_id=material.id,
                            material_code=material.code,
                            material_name=material.name,
                            quantity=item_data.get("quantity", 0.0),
                            unit=item_data.get("unit", ""),
                            version=item_data.get("version")
                        )
                        bom_items.append(bom_item)

        return ProductBOMResponse(
            product_id=product.id,
            product_code=product.code,
            product_name=product.name,
            product_version=product.version,
            bom_items=bom_items
        )

    @staticmethod
    async def get_products_grouped(
        tenant_id: int,
        is_active: Optional[bool] = True
    ) -> Dict[str, List[ProductResponse]]:
        """
        获取分组的产品列表（按首字母分组）

        用于前端级联选择组件，支持按首字母快速定位产品。

        Args:
            tenant_id: 租户ID
            is_active: 是否只查询启用的产品（默认：True）

        Returns:
            Dict[str, List[ProductResponse]]: 按首字母分组的产品字典
        """
        query = Product.filter(
            tenant_id=tenant_id,
            deleted_at__isnull=True
        )

        if is_active is not None:
            query = query.filter(is_active=is_active)

        products = await query.order_by("code").all()

        # 按首字母分组
        grouped_products: Dict[str, List[ProductResponse]] = {}
        for product in products:
            # 获取产品编码的首字母（大写）
            first_char = product.code[0].upper() if product.code else "#"

            # 如果不是字母，则归类为"#"
            if not first_char.isalpha():
                first_char = "#"

            if first_char not in grouped_products:
                grouped_products[first_char] = []

            grouped_products[first_char].append(ProductResponse.model_validate(product))

        return grouped_products

    @staticmethod
    async def get_products_by_category(
        tenant_id: int,
        category_prefix: str,
        is_active: Optional[bool] = True
    ) -> List[ProductResponse]:
        """
        根据分类前缀获取产品列表

        支持按产品编码前缀过滤，用于级联选择的子级查询。

        Args:
            tenant_id: 租户ID
            category_prefix: 分类前缀（如"A"表示A开头的编码）
            is_active: 是否只查询启用的产品（默认：True）

        Returns:
            List[ProductResponse]: 符合条件的产品列表
        """
        query = Product.filter(
            tenant_id=tenant_id,
            deleted_at__isnull=True
        )

        if is_active is not None:
            query = query.filter(is_active=is_active)

        # 如果提供了前缀，则按编码前缀过滤
        if category_prefix and category_prefix != "#":
            query = query.filter(code__startswith=category_prefix.upper())

        products = await query.order_by("code").all()

        return [ProductResponse.model_validate(p) for p in products]
