"""
仓库数据服务模块

提供仓库数据的业务逻辑处理（仓库、库区、库位），支持多组织隔离。
"""

from typing import List, Optional, TYPE_CHECKING
from tortoise.exceptions import IntegrityError

from apps.master_data.models.warehouse import Warehouse, StorageArea, StorageLocation
from apps.master_data.schemas.warehouse_schemas import (
    WarehouseCreate, WarehouseUpdate, WarehouseResponse,
    StorageAreaCreate, StorageAreaUpdate, StorageAreaResponse,
    StorageLocationCreate, StorageLocationUpdate, StorageLocationResponse
)
from infra.exceptions.exceptions import NotFoundError, ValidationError

if TYPE_CHECKING:
    from apps.master_data.schemas.warehouse_schemas import (
        WarehouseTreeResponse,
        StorageAreaTreeResponse,
        StorageLocationTreeResponse
    )


class WarehouseService:
    """仓库数据服务"""
    
    # ==================== 仓库相关方法 ====================
    
    @staticmethod
    async def create_warehouse(
        tenant_id: int,
        data: WarehouseCreate
    ) -> WarehouseResponse:
        """
        创建仓库
        
        Args:
            tenant_id: 租户ID
            data: 仓库创建数据
            
        Returns:
            WarehouseResponse: 创建的仓库对象
            
        Raises:
            ValidationError: 当编码已存在时抛出
        """
        # 检查编码是否已存在
        existing = await Warehouse.filter(
            tenant_id=tenant_id,
            code=data.code,
            deleted_at__isnull=True
        ).first()
        
        if existing:
            raise ValidationError(f"仓库编码 {data.code} 已存在")
        
        # 创建仓库
        try:
            warehouse = await Warehouse.create(
                tenant_id=tenant_id,
                **data.dict()
            )
        except IntegrityError as e:
            # 捕获数据库唯一约束错误，提供友好提示
            if "unique" in str(e).lower() or "duplicate" in str(e).lower():
                raise ValidationError(f"仓库编码 {data.code} 已存在（可能已被软删除，请检查）")
            raise
        
        return WarehouseResponse.model_validate(warehouse)
    
    @staticmethod
    async def get_warehouse_by_uuid(
        tenant_id: int,
        warehouse_uuid: str
    ) -> WarehouseResponse:
        """
        根据UUID获取仓库
        
        Args:
            tenant_id: 租户ID
            warehouse_uuid: 仓库UUID
            
        Returns:
            WarehouseResponse: 仓库对象
            
        Raises:
            NotFoundError: 当仓库不存在时抛出
        """
        warehouse = await Warehouse.filter(
            tenant_id=tenant_id,
            uuid=warehouse_uuid,
            deleted_at__isnull=True
        ).first()
        
        if not warehouse:
            raise NotFoundError(f"仓库 {warehouse_uuid} 不存在")
        
        return WarehouseResponse.model_validate(warehouse)
    
    @staticmethod
    async def list_warehouses(
        tenant_id: int,
        skip: int = 0,
        limit: int = 100,
        is_active: Optional[bool] = None
    ) -> List[WarehouseResponse]:
        """
        获取仓库列表
        
        Args:
            tenant_id: 租户ID
            skip: 跳过数量
            limit: 限制数量
            is_active: 是否启用（可选）
            
        Returns:
            List[WarehouseResponse]: 仓库列表
        """
        query = Warehouse.filter(
            tenant_id=tenant_id,
            deleted_at__isnull=True
        )
        
        if is_active is not None:
            query = query.filter(is_active=is_active)
        
        warehouses = await query.offset(skip).limit(limit).order_by("code").all()
        
        return [WarehouseResponse.model_validate(w) for w in warehouses]
    
    @staticmethod
    async def update_warehouse(
        tenant_id: int,
        warehouse_uuid: str,
        data: WarehouseUpdate
    ) -> WarehouseResponse:
        """
        更新仓库
        
        Args:
            tenant_id: 租户ID
            warehouse_uuid: 仓库UUID
            data: 仓库更新数据
            
        Returns:
            WarehouseResponse: 更新后的仓库对象
            
        Raises:
            NotFoundError: 当仓库不存在时抛出
            ValidationError: 当编码已存在时抛出
        """
        warehouse = await Warehouse.filter(
            tenant_id=tenant_id,
            uuid=warehouse_uuid,
            deleted_at__isnull=True
        ).first()
        
        if not warehouse:
            raise NotFoundError(f"仓库 {warehouse_uuid} 不存在")
        
        # 如果更新编码，检查是否已存在
        if data.code and data.code != warehouse.code:
            existing = await Warehouse.filter(
                tenant_id=tenant_id,
                code=data.code,
                deleted_at__isnull=True
            ).first()
            
            if existing:
                raise ValidationError(f"仓库编码 {data.code} 已存在")
        
        # 更新字段
        update_data = data.dict(exclude_unset=True)
        for key, value in update_data.items():
            setattr(warehouse, key, value)
        
        try:
            await warehouse.save()
        except IntegrityError as e:
            # 捕获数据库唯一约束错误，提供友好提示
            if "unique" in str(e).lower() or "duplicate" in str(e).lower():
                raise ValidationError(f"仓库编码 {data.code or warehouse.code} 已存在（可能已被软删除，请检查）")
            raise
        
        return WarehouseResponse.model_validate(warehouse)
    
    @staticmethod
    async def delete_warehouse(
        tenant_id: int,
        warehouse_uuid: str
    ) -> None:
        """
        删除仓库（软删除）
        
        Args:
            tenant_id: 租户ID
            warehouse_uuid: 仓库UUID
            
        Raises:
            NotFoundError: 当仓库不存在时抛出
            ValidationError: 当仓库下有关联的库区时抛出
        """
        warehouse = await Warehouse.filter(
            tenant_id=tenant_id,
            uuid=warehouse_uuid,
            deleted_at__isnull=True
        ).first()
        
        if not warehouse:
            raise NotFoundError(f"仓库 {warehouse_uuid} 不存在")
        
        # 检查是否有关联的库区
        storage_areas_count = await StorageArea.filter(
            tenant_id=tenant_id,
            warehouse_id=warehouse.id,
            deleted_at__isnull=True
        ).count()
        
        if storage_areas_count > 0:
            raise ValidationError(f"仓库下存在 {storage_areas_count} 个库区，无法删除")
        
        # 软删除
        from tortoise import timezone
        warehouse.deleted_at = timezone.now()
        await warehouse.save()
    
    @staticmethod
    async def batch_delete_warehouses(
        tenant_id: int,
        warehouse_uuids: List[str]
    ) -> dict:
        """
        批量删除仓库（软删除）
        
        Args:
            tenant_id: 租户ID
            warehouse_uuids: 仓库UUID列表
            
        Returns:
            dict: 包含成功和失败记录的字典
        """
        from tortoise import timezone
        from loguru import logger
        
        success_records = []
        failed_records = []
        
        for warehouse_uuid in warehouse_uuids:
            try:
                warehouse = await Warehouse.filter(
                    tenant_id=tenant_id,
                    uuid=warehouse_uuid,
                    deleted_at__isnull=True
                ).first()
                
                if not warehouse:
                    failed_records.append({
                        "uuid": warehouse_uuid,
                        "reason": f"仓库 {warehouse_uuid} 不存在"
                    })
                    continue
                
                # 检查是否有关联的库区
                storage_areas_count = await StorageArea.filter(
                    tenant_id=tenant_id,
                    warehouse_id=warehouse.id,
                    deleted_at__isnull=True
                ).count()
                
                if storage_areas_count > 0:
                    failed_records.append({
                        "uuid": warehouse_uuid,
                        "code": warehouse.code,
                        "name": warehouse.name,
                        "reason": f"仓库下存在 {storage_areas_count} 个库区，无法删除"
                    })
                    continue
                
                # 软删除
                warehouse.deleted_at = timezone.now()
                await warehouse.save()
                
                success_records.append({
                    "uuid": warehouse_uuid,
                    "code": warehouse.code,
                    "name": warehouse.name
                })
            except Exception as e:
                logger.exception(f"批量删除仓库失败 (uuid: {warehouse_uuid}): {str(e)}")
                failed_records.append({
                    "uuid": warehouse_uuid,
                    "reason": f"删除失败: {str(e)}"
                })
        
        return {
            "success_count": len(success_records),
            "failed_count": len(failed_records),
            "success_records": success_records,
            "failed_records": failed_records
        }
    
    # ==================== 库区相关方法 ====================
    
    @staticmethod
    async def create_storage_area(
        tenant_id: int,
        data: StorageAreaCreate
    ) -> StorageAreaResponse:
        """
        创建库区
        
        Args:
            tenant_id: 租户ID
            data: 库区创建数据
            
        Returns:
            StorageAreaResponse: 创建的库区对象
            
        Raises:
            ValidationError: 当编码已存在或仓库不存在时抛出
        """
        # 检查仓库是否存在
        warehouse = await Warehouse.filter(
            tenant_id=tenant_id,
            id=data.warehouse_id,
            deleted_at__isnull=True
        ).first()
        
        if not warehouse:
            raise ValidationError(f"仓库 {data.warehouse_id} 不存在")
        
        # 检查编码是否已存在
        existing = await StorageArea.filter(
            tenant_id=tenant_id,
            code=data.code,
            deleted_at__isnull=True
        ).first()
        
        if existing:
            raise ValidationError(f"库区编码 {data.code} 已存在")
        
        # 创建库区
        try:
            storage_area = await StorageArea.create(
                tenant_id=tenant_id,
                **data.dict()
            )
        except IntegrityError as e:
            # 捕获数据库唯一约束错误，提供友好提示
            if "unique" in str(e).lower() or "duplicate" in str(e).lower():
                raise ValidationError(f"库区编码 {data.code} 已存在（可能已被软删除，请检查）")
            raise
        
        return StorageAreaResponse.model_validate(storage_area)
    
    @staticmethod
    async def get_storage_area_by_uuid(
        tenant_id: int,
        storage_area_uuid: str
    ) -> StorageAreaResponse:
        """
        根据UUID获取库区
        
        Args:
            tenant_id: 租户ID
            storage_area_uuid: 库区UUID
            
        Returns:
            StorageAreaResponse: 库区对象
            
        Raises:
            NotFoundError: 当库区不存在时抛出
        """
        storage_area = await StorageArea.filter(
            tenant_id=tenant_id,
            uuid=storage_area_uuid,
            deleted_at__isnull=True
        ).prefetch_related("warehouse").first()
        
        if not storage_area:
            raise NotFoundError(f"库区 {storage_area_uuid} 不存在")
        
        return StorageAreaResponse.model_validate(storage_area)
    
    @staticmethod
    async def list_storage_areas(
        tenant_id: int,
        skip: int = 0,
        limit: int = 100,
        warehouse_id: Optional[int] = None,
        is_active: Optional[bool] = None
    ) -> List[StorageAreaResponse]:
        """
        获取库区列表
        
        Args:
            tenant_id: 租户ID
            skip: 跳过数量
            limit: 限制数量
            warehouse_id: 仓库ID（可选，用于过滤）
            is_active: 是否启用（可选）
            
        Returns:
            List[StorageAreaResponse]: 库区列表
        """
        query = StorageArea.filter(
            tenant_id=tenant_id,
            deleted_at__isnull=True
        )
        
        if warehouse_id is not None:
            query = query.filter(warehouse_id=warehouse_id)
        
        if is_active is not None:
            query = query.filter(is_active=is_active)
        
        storage_areas = await query.offset(skip).limit(limit).order_by("code").all()
        
        return [StorageAreaResponse.model_validate(sa) for sa in storage_areas]
    
    @staticmethod
    async def update_storage_area(
        tenant_id: int,
        storage_area_uuid: str,
        data: StorageAreaUpdate
    ) -> StorageAreaResponse:
        """
        更新库区
        
        Args:
            tenant_id: 租户ID
            storage_area_uuid: 库区UUID
            data: 库区更新数据
            
        Returns:
            StorageAreaResponse: 更新后的库区对象
            
        Raises:
            NotFoundError: 当库区不存在时抛出
            ValidationError: 当编码已存在或仓库不存在时抛出
        """
        storage_area = await StorageArea.filter(
            tenant_id=tenant_id,
            uuid=storage_area_uuid,
            deleted_at__isnull=True
        ).first()
        
        if not storage_area:
            raise NotFoundError(f"库区 {storage_area_uuid} 不存在")
        
        # 如果更新仓库ID，检查仓库是否存在
        if data.warehouse_id and data.warehouse_id != storage_area.warehouse_id:
            warehouse = await Warehouse.filter(
                tenant_id=tenant_id,
                id=data.warehouse_id,
                deleted_at__isnull=True
            ).first()
            
            if not warehouse:
                raise ValidationError(f"仓库 {data.warehouse_id} 不存在")
        
        # 如果更新编码，检查是否已存在
        if data.code and data.code != storage_area.code:
            existing = await StorageArea.filter(
                tenant_id=tenant_id,
                code=data.code,
                deleted_at__isnull=True
            ).first()
            
            if existing:
                raise ValidationError(f"库区编码 {data.code} 已存在")
        
        # 更新字段
        update_data = data.dict(exclude_unset=True)
        for key, value in update_data.items():
            setattr(storage_area, key, value)
        
        try:
            await storage_area.save()
        except IntegrityError as e:
            # 捕获数据库唯一约束错误，提供友好提示
            if "unique" in str(e).lower() or "duplicate" in str(e).lower():
                raise ValidationError(f"库区编码 {data.code or storage_area.code} 已存在（可能已被软删除，请检查）")
            raise
        
        return StorageAreaResponse.model_validate(storage_area)
    
    @staticmethod
    async def delete_storage_area(
        tenant_id: int,
        storage_area_uuid: str
    ) -> None:
        """
        删除库区（软删除）
        
        Args:
            tenant_id: 租户ID
            storage_area_uuid: 库区UUID
            
        Raises:
            NotFoundError: 当库区不存在时抛出
            ValidationError: 当库区下有关联的库位时抛出
        """
        storage_area = await StorageArea.filter(
            tenant_id=tenant_id,
            uuid=storage_area_uuid,
            deleted_at__isnull=True
        ).first()
        
        if not storage_area:
            raise NotFoundError(f"库区 {storage_area_uuid} 不存在")
        
        # 检查是否有关联的库位
        storage_locations_count = await StorageLocation.filter(
            tenant_id=tenant_id,
            storage_area_id=storage_area.id,
            deleted_at__isnull=True
        ).count()
        
        if storage_locations_count > 0:
            raise ValidationError(f"库区下存在 {storage_locations_count} 个库位，无法删除")
        
        # 软删除
        from tortoise import timezone
        storage_area.deleted_at = timezone.now()
        await storage_area.save()
    
    @staticmethod
    async def batch_delete_storage_areas(
        tenant_id: int,
        storage_area_uuids: List[str]
    ) -> dict:
        """
        批量删除库区（软删除）
        
        Args:
            tenant_id: 租户ID
            storage_area_uuids: 库区UUID列表
            
        Returns:
            dict: 包含成功和失败记录的字典
        """
        from tortoise import timezone
        from loguru import logger
        
        success_records = []
        failed_records = []
        
        for storage_area_uuid in storage_area_uuids:
            try:
                storage_area = await StorageArea.filter(
                    tenant_id=tenant_id,
                    uuid=storage_area_uuid,
                    deleted_at__isnull=True
                ).first()
                
                if not storage_area:
                    failed_records.append({
                        "uuid": storage_area_uuid,
                        "reason": f"库区 {storage_area_uuid} 不存在"
                    })
                    continue
                
                # 检查是否有关联的库位
                storage_locations_count = await StorageLocation.filter(
                    tenant_id=tenant_id,
                    storage_area_id=storage_area.id,
                    deleted_at__isnull=True
                ).count()
                
                if storage_locations_count > 0:
                    failed_records.append({
                        "uuid": storage_area_uuid,
                        "code": storage_area.code,
                        "name": storage_area.name,
                        "reason": f"库区下存在 {storage_locations_count} 个库位，无法删除"
                    })
                    continue
                
                # 软删除
                storage_area.deleted_at = timezone.now()
                await storage_area.save()
                
                success_records.append({
                    "uuid": storage_area_uuid,
                    "code": storage_area.code,
                    "name": storage_area.name
                })
            except Exception as e:
                logger.exception(f"批量删除库区失败 (uuid: {storage_area_uuid}): {str(e)}")
                failed_records.append({
                    "uuid": storage_area_uuid,
                    "reason": f"删除失败: {str(e)}"
                })
        
        return {
            "success_count": len(success_records),
            "failed_count": len(failed_records),
            "success_records": success_records,
            "failed_records": failed_records
        }
    
    # ==================== 库位相关方法 ====================
    
    @staticmethod
    async def create_storage_location(
        tenant_id: int,
        data: StorageLocationCreate
    ) -> StorageLocationResponse:
        """
        创建库位
        
        Args:
            tenant_id: 租户ID
            data: 库位创建数据
            
        Returns:
            StorageLocationResponse: 创建的库位对象
            
        Raises:
            ValidationError: 当编码已存在或库区不存在时抛出
        """
        # 检查库区是否存在
        storage_area = await StorageArea.filter(
            tenant_id=tenant_id,
            id=data.storage_area_id,
            deleted_at__isnull=True
        ).first()
        
        if not storage_area:
            raise ValidationError(f"库区 {data.storage_area_id} 不存在")
        
        # 检查编码是否已存在
        existing = await StorageLocation.filter(
            tenant_id=tenant_id,
            code=data.code,
            deleted_at__isnull=True
        ).first()
        
        if existing:
            raise ValidationError(f"库位编码 {data.code} 已存在")
        
        # 创建库位
        try:
            storage_location = await StorageLocation.create(
                tenant_id=tenant_id,
                **data.dict()
            )
        except IntegrityError as e:
            # 捕获数据库唯一约束错误，提供友好提示
            if "unique" in str(e).lower() or "duplicate" in str(e).lower():
                raise ValidationError(f"库位编码 {data.code} 已存在（可能已被软删除，请检查）")
            raise
        
        return StorageLocationResponse.model_validate(storage_location)
    
    @staticmethod
    async def get_storage_location_by_uuid(
        tenant_id: int,
        storage_location_uuid: str
    ) -> StorageLocationResponse:
        """
        根据UUID获取库位
        
        Args:
            tenant_id: 租户ID
            storage_location_uuid: 库位UUID
            
        Returns:
            StorageLocationResponse: 库位对象
            
        Raises:
            NotFoundError: 当库位不存在时抛出
        """
        storage_location = await StorageLocation.filter(
            tenant_id=tenant_id,
            uuid=storage_location_uuid,
            deleted_at__isnull=True
        ).prefetch_related("storage_area").first()
        
        if not storage_location:
            raise NotFoundError(f"库位 {storage_location_uuid} 不存在")
        
        return StorageLocationResponse.model_validate(storage_location)
    
    @staticmethod
    async def list_storage_locations(
        tenant_id: int,
        skip: int = 0,
        limit: int = 100,
        storage_area_id: Optional[int] = None,
        is_active: Optional[bool] = None
    ) -> List[StorageLocationResponse]:
        """
        获取库位列表
        
        Args:
            tenant_id: 租户ID
            skip: 跳过数量
            limit: 限制数量
            storage_area_id: 库区ID（可选，用于过滤）
            is_active: 是否启用（可选）
            
        Returns:
            List[StorageLocationResponse]: 库位列表
        """
        query = StorageLocation.filter(
            tenant_id=tenant_id,
            deleted_at__isnull=True
        )
        
        if storage_area_id is not None:
            query = query.filter(storage_area_id=storage_area_id)
        
        if is_active is not None:
            query = query.filter(is_active=is_active)
        
        storage_locations = await query.offset(skip).limit(limit).order_by("code").all()
        
        return [StorageLocationResponse.model_validate(sl) for sl in storage_locations]
    
    @staticmethod
    async def update_storage_location(
        tenant_id: int,
        storage_location_uuid: str,
        data: StorageLocationUpdate
    ) -> StorageLocationResponse:
        """
        更新库位
        
        Args:
            tenant_id: 租户ID
            storage_location_uuid: 库位UUID
            data: 库位更新数据
            
        Returns:
            StorageLocationResponse: 更新后的库位对象
            
        Raises:
            NotFoundError: 当库位不存在时抛出
            ValidationError: 当编码已存在或库区不存在时抛出
        """
        storage_location = await StorageLocation.filter(
            tenant_id=tenant_id,
            uuid=storage_location_uuid,
            deleted_at__isnull=True
        ).first()
        
        if not storage_location:
            raise NotFoundError(f"库位 {storage_location_uuid} 不存在")
        
        # 如果更新库区ID，检查库区是否存在
        if data.storage_area_id and data.storage_area_id != storage_location.storage_area_id:
            storage_area = await StorageArea.filter(
                tenant_id=tenant_id,
                id=data.storage_area_id,
                deleted_at__isnull=True
            ).first()
            
            if not storage_area:
                raise ValidationError(f"库区 {data.storage_area_id} 不存在")
        
        # 如果更新编码，检查是否已存在
        if data.code and data.code != storage_location.code:
            existing = await StorageLocation.filter(
                tenant_id=tenant_id,
                code=data.code,
                deleted_at__isnull=True
            ).first()
            
            if existing:
                raise ValidationError(f"库位编码 {data.code} 已存在")
        
        # 更新字段
        update_data = data.dict(exclude_unset=True)
        for key, value in update_data.items():
            setattr(storage_location, key, value)
        
        try:
            await storage_location.save()
        except IntegrityError as e:
            # 捕获数据库唯一约束错误，提供友好提示
            if "unique" in str(e).lower() or "duplicate" in str(e).lower():
                raise ValidationError(f"库位编码 {data.code or storage_location.code} 已存在（可能已被软删除，请检查）")
            raise
        
        return StorageLocationResponse.model_validate(storage_location)
    
    @staticmethod
    async def delete_storage_location(
        tenant_id: int,
        storage_location_uuid: str
    ) -> None:
        """
        删除库位（软删除）
        
        Args:
            tenant_id: 租户ID
            storage_location_uuid: 库位UUID
            
        Raises:
            NotFoundError: 当库位不存在时抛出
        """
        storage_location = await StorageLocation.filter(
            tenant_id=tenant_id,
            uuid=storage_location_uuid,
            deleted_at__isnull=True
        ).first()
        
        if not storage_location:
            raise NotFoundError(f"库位 {storage_location_uuid} 不存在")
        
        # 软删除
        from tortoise import timezone
        storage_location.deleted_at = timezone.now()
        await storage_location.save()
    
    @staticmethod
    async def batch_delete_storage_locations(
        tenant_id: int,
        storage_location_uuids: List[str]
    ) -> dict:
        """
        批量删除库位（软删除）
        
        Args:
            tenant_id: 租户ID
            storage_location_uuids: 库位UUID列表
            
        Returns:
            dict: 包含成功和失败记录的字典
        """
        from tortoise import timezone
        from loguru import logger
        
        success_records = []
        failed_records = []
        
        for storage_location_uuid in storage_location_uuids:
            try:
                storage_location = await StorageLocation.filter(
                    tenant_id=tenant_id,
                    uuid=storage_location_uuid,
                    deleted_at__isnull=True
                ).first()
                
                if not storage_location:
                    failed_records.append({
                        "uuid": storage_location_uuid,
                        "reason": f"库位 {storage_location_uuid} 不存在"
                    })
                    continue
                
                # 软删除（库位没有下级关联，可以直接删除）
                storage_location.deleted_at = timezone.now()
                await storage_location.save()
                
                success_records.append({
                    "uuid": storage_location_uuid,
                    "code": storage_location.code,
                    "name": storage_location.name
                })
            except Exception as e:
                logger.exception(f"批量删除库位失败 (uuid: {storage_location_uuid}): {str(e)}")
                failed_records.append({
                    "uuid": storage_location_uuid,
                    "reason": f"删除失败: {str(e)}"
                })
        
        return {
            "success_count": len(success_records),
            "failed_count": len(failed_records),
            "success_records": success_records,
            "failed_records": failed_records
        }
    
    # ==================== 级联查询相关方法 ====================
    
    @staticmethod
    async def get_warehouse_tree(
        tenant_id: int,
        is_active: Optional[bool] = None
    ) -> List["WarehouseTreeResponse"]:
        """
        获取仓库数据树形结构（仓库→库区→库位）
        
        返回完整的仓库层级结构，用于级联选择等场景。
        
        Args:
            tenant_id: 租户ID
            is_active: 是否只查询启用的数据（可选）
            
        Returns:
            List[WarehouseTreeResponse]: 仓库树形列表，每个仓库包含库区列表，每个库区包含库位列表
        """
        # 延迟导入避免循环依赖
        from apps.master_data.schemas.warehouse_schemas import (
            WarehouseTreeResponse,
            StorageAreaTreeResponse,
            StorageLocationTreeResponse
        )
        
        # 查询所有仓库
        warehouse_query = Warehouse.filter(
            tenant_id=tenant_id,
            deleted_at__isnull=True
        )
        if is_active is not None:
            warehouse_query = warehouse_query.filter(is_active=is_active)
        
        warehouses = await warehouse_query.order_by("code").all()
        
        # 查询所有库区
        storage_area_query = StorageArea.filter(
            tenant_id=tenant_id,
            deleted_at__isnull=True
        )
        if is_active is not None:
            storage_area_query = storage_area_query.filter(is_active=is_active)
        
        storage_areas = await storage_area_query.prefetch_related("warehouse").order_by("code").all()
        
        # 查询所有库位
        storage_location_query = StorageLocation.filter(
            tenant_id=tenant_id,
            deleted_at__isnull=True
        )
        if is_active is not None:
            storage_location_query = storage_location_query.filter(is_active=is_active)
        
        storage_locations = await storage_location_query.prefetch_related("storage_area").order_by("code").all()
        
        # 构建库位映射（按库区ID分组）
        storage_location_map: dict[int, List[StorageLocationTreeResponse]] = {}
        for storage_location in storage_locations:
            area_id = storage_location.storage_area_id
            if area_id not in storage_location_map:
                storage_location_map[area_id] = []
            storage_location_map[area_id].append(StorageLocationTreeResponse.model_validate(storage_location))
        
        # 构建库区映射（按仓库ID分组）
        storage_area_map: dict[int, List[StorageAreaTreeResponse]] = {}
        for storage_area in storage_areas:
            warehouse_id = storage_area.warehouse_id
            if warehouse_id not in storage_area_map:
                storage_area_map[warehouse_id] = []
            
            # 获取该库区的库位列表
            area_storage_locations = storage_location_map.get(storage_area.id, [])
            
            # 创建库区响应对象（包含库位列表）
            area_response = StorageAreaTreeResponse.model_validate(storage_area)
            area_response.storage_locations = area_storage_locations
            storage_area_map[warehouse_id].append(area_response)
        
        # 构建仓库树形结构
        result: List[WarehouseTreeResponse] = []
        for warehouse in warehouses:
            # 获取该仓库的库区列表
            warehouse_storage_areas = storage_area_map.get(warehouse.id, [])
            
            # 创建仓库响应对象（包含库区列表）
            warehouse_response = WarehouseTreeResponse.model_validate(warehouse)
            warehouse_response.storage_areas = warehouse_storage_areas
            result.append(warehouse_response)
        
        return result

