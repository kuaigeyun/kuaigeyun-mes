"""
仓库数据服务模块

提供仓库数据的业务逻辑处理（仓库、库区、库位），支持多组织隔离。
"""

from typing import List, Optional, TYPE_CHECKING
from tortoise.exceptions import IntegrityError
from tortoise.models import Q

from apps.master_data.models.warehouse import Warehouse, StorageArea, StorageLocation
from apps.master_data.models.factory import Workshop, WorkCenter, Workstation
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

_WAREHOUSE_LIST_SORT_FIELDS = {
    "code": "code",
    "name": "name",
    "createdAt": "created_at",
    "updatedAt": "updated_at",
    "isActive": "is_active",
    "warehouseType": "warehouse_type",
}

_STORAGE_AREA_LIST_SORT_FIELDS = {
    "code": "code",
    "name": "name",
    "createdAt": "created_at",
    "updatedAt": "updated_at",
    "isActive": "is_active",
    "warehouseId": "warehouse_id",
}

_STORAGE_LOCATION_LIST_SORT_FIELDS = {
    "code": "code",
    "name": "name",
    "createdAt": "created_at",
    "updatedAt": "updated_at",
    "isActive": "is_active",
    "storageAreaId": "storage_area_id",
}


def _warehouse_list_order(sort_field: Optional[str], sort_order: Optional[str], default_col: str = "code") -> str:
    key = (sort_field or "").strip()
    col = _WAREHOUSE_LIST_SORT_FIELDS.get(key, default_col)
    if (sort_order or "asc").lower() == "desc":
        return f"-{col}"
    return col


def _storage_area_list_order(sort_field: Optional[str], sort_order: Optional[str], default_col: str = "code") -> str:
    key = (sort_field or "").strip()
    col = _STORAGE_AREA_LIST_SORT_FIELDS.get(key, default_col)
    if (sort_order or "asc").lower() == "desc":
        return f"-{col}"
    return col


def _storage_location_list_order(sort_field: Optional[str], sort_order: Optional[str], default_col: str = "code") -> str:
    key = (sort_field or "").strip()
    col = _STORAGE_LOCATION_LIST_SORT_FIELDS.get(key, default_col)
    if (sort_order or "asc").lower() == "desc":
        return f"-{col}"
    return col


class WarehouseService:
    """仓库数据服务"""

    @staticmethod
    async def _resolve_line_side_names(
        tenant_id: int,
        workshop_id: Optional[int],
        workstation_id: Optional[int],
        work_center_id: Optional[int],
    ) -> tuple[Optional[str], Optional[str], Optional[str]]:
        """解析 workshop_name、workstation_name、work_center_name"""
        workshop_name = None
        workstation_name = None
        work_center_name = None
        if workshop_id:
            ws = await Workshop.filter(
                id=workshop_id, tenant_id=tenant_id, deleted_at__isnull=True
            ).first()
            if ws:
                workshop_name = ws.name
        if workstation_id:
            wst = await Workstation.filter(
                id=workstation_id, tenant_id=tenant_id, deleted_at__isnull=True
            ).first()
            if wst:
                workstation_name = wst.name
        if work_center_id:
            wc = await WorkCenter.filter(
                id=work_center_id, tenant_id=tenant_id, deleted_at__isnull=True
            ).first()
            if wc:
                work_center_name = wc.name
        return workshop_name, workstation_name, work_center_name

    @staticmethod
    async def _storage_area_to_response(sa: StorageArea) -> StorageAreaResponse:
        """组装库区响应（带出仓库编码/名称，避免前端异步字典闪烁）"""
        await sa.fetch_related("warehouse")
        resp = StorageAreaResponse.model_validate(sa)
        wh = sa.warehouse
        if wh:
            return resp.model_copy(update={"warehouse_code": wh.code, "warehouse_name": wh.name})
        return resp

    @staticmethod
    async def _storage_location_to_response(sl: StorageLocation) -> StorageLocationResponse:
        """组装库位响应（带出库区编码/名称，避免前端异步字典闪烁）"""
        await sl.fetch_related("storage_area")
        resp = StorageLocationResponse.model_validate(sl)
        area = sl.storage_area
        if area:
            return resp.model_copy(
                update={"storage_area_code": area.code, "storage_area_name": area.name}
            )
        return resp

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
        # 检查编码是否已存在（包括软删除的记录）
        existing_active = await Warehouse.filter(
            tenant_id=tenant_id,
            code=data.code,
            deleted_at__isnull=True
        ).first()
        
        if existing_active:
            raise ValidationError(f"仓库编码 {data.code} 已存在")
        
        # 检查是否存在相同编码的软删除记录
        existing_deleted = await Warehouse.filter(
            tenant_id=tenant_id,
            code=data.code,
            deleted_at__isnull=False
        ).first()
        
        if existing_deleted:
            # 恢复软删除的记录，更新其数据
            create_data = data.model_dump(by_alias=False) if hasattr(data, "model_dump") else data.dict()
            workshop_name, workstation_name, work_center_name = await WarehouseService._resolve_line_side_names(
                tenant_id, create_data.get("workshop_id"), create_data.get("workstation_id"), create_data.get("work_center_id")
            )
            existing_deleted.deleted_at = None
            for k, v in create_data.items():
                setattr(existing_deleted, k, v)
            existing_deleted.workshop_name = workshop_name
            existing_deleted.workstation_name = workstation_name
            existing_deleted.work_center_name = work_center_name
            await existing_deleted.save()
            return WarehouseResponse.model_validate(existing_deleted)

        # 创建新仓库
        create_data = data.model_dump(by_alias=False) if hasattr(data, "model_dump") else data.dict()
        workshop_name, workstation_name, work_center_name = await WarehouseService._resolve_line_side_names(
            tenant_id, create_data.get("workshop_id"), create_data.get("workstation_id"), create_data.get("work_center_id")
        )
        create_data["workshop_name"] = workshop_name
        create_data["workstation_name"] = workstation_name
        create_data["work_center_name"] = work_center_name
        try:
            warehouse = await Warehouse.create(
                tenant_id=tenant_id,
                **create_data
            )
        except IntegrityError as e:
            # 捕获数据库唯一约束或主键冲突错误
            error_str = str(e).lower()
            if "unique" in error_str or "duplicate" in error_str or "pkey" in error_str:
                # 再次检查是否有软删除记录（可能在并发情况下被创建）
                existing_deleted_retry = await Warehouse.filter(
                    tenant_id=tenant_id,
                    code=data.code,
                    deleted_at__isnull=False
                ).first()
                
                if existing_deleted_retry:
                    # 恢复软删除的记录
                    create_data_retry = data.model_dump(by_alias=False) if hasattr(data, "model_dump") else data.dict()
                    workshop_name_r, workstation_name_r, work_center_name_r = await WarehouseService._resolve_line_side_names(
                        tenant_id, create_data_retry.get("workshop_id"), create_data_retry.get("workstation_id"), create_data_retry.get("work_center_id")
                    )
                    existing_deleted_retry.deleted_at = None
                    for k, v in create_data_retry.items():
                        setattr(existing_deleted_retry, k, v)
                    existing_deleted_retry.workshop_name = workshop_name_r
                    existing_deleted_retry.workstation_name = workstation_name_r
                    existing_deleted_retry.work_center_name = work_center_name_r
                    await existing_deleted_retry.save()
                    return WarehouseResponse.model_validate(existing_deleted_retry)
                
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
        is_active: Optional[bool] = None,
        warehouse_type: Optional[str] = None,
        keyword: Optional[str] = None,
        sort_field: Optional[str] = None,
        sort_order: Optional[str] = None,
    ) -> dict:
        """
        获取仓库列表

        Args:
            tenant_id: 租户ID
            skip: 跳过数量
            limit: 限制数量
            is_active: 是否启用（可选）
            warehouse_type: 仓库类型（可选）
            keyword: 关键词（编码或名称模糊匹配）
            sort_field: 排序字段（前端 camelCase）
            sort_order: asc / desc

        Returns:
            dict: 包含 items (仓库列表) 和 total (总数) 的字典
        """
        query = Warehouse.filter(
            tenant_id=tenant_id,
            deleted_at__isnull=True
        )

        if is_active is not None:
            query = query.filter(is_active=is_active)
        if warehouse_type:
            query = query.filter(warehouse_type=warehouse_type)
        if keyword:
            kw = keyword.strip()
            if kw:
                query = query.filter(Q(code__icontains=kw) | Q(name__icontains=kw))

        total = await query.count()
        order_expr = _warehouse_list_order(sort_field, sort_order, "code")
        warehouses = await query.offset(skip).limit(limit).order_by(order_expr).all()

        return {
            "items": [WarehouseResponse.model_validate(w) for w in warehouses],
            "total": total
        }
    
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

        # 若更新为线边仓，需确保 workshop_id 已设置（来自本次更新或已有值）
        update_data = data.model_dump(exclude_unset=True, by_alias=False) if hasattr(data, "model_dump") else data.dict(exclude_unset=True)
        if update_data.get("warehouse_type") == "line_side":
            new_workshop_id = update_data.get("workshop_id", warehouse.workshop_id)
            if not new_workshop_id:
                raise ValidationError("线边仓必须关联车间")

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
        for key, value in update_data.items():
            setattr(warehouse, key, value)

        # 若更新了 workshop_id、workstation_id 或 work_center_id，解析并更新名称
        if "workshop_id" in update_data or "workstation_id" in update_data or "work_center_id" in update_data:
            workshop_name, workstation_name, work_center_name = await WarehouseService._resolve_line_side_names(
                tenant_id, warehouse.workshop_id, warehouse.workstation_id, warehouse.work_center_id
            )
            warehouse.workshop_name = workshop_name
            warehouse.workstation_name = workstation_name
            warehouse.work_center_name = work_center_name

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
        
        unique_uuids = list(dict.fromkeys(warehouse_uuids))

        for warehouse_uuid in unique_uuids:
            try:
                warehouse = await Warehouse.filter(
                    tenant_id=tenant_id,
                    uuid=warehouse_uuid,
                    deleted_at__isnull=True
                ).first()
                
                if not warehouse:
                    # 幂等删除：记录不存在时视作已完成，无需计入失败
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
        
        # 检查编码是否已存在（包括软删除的记录）
        existing_active = await StorageArea.filter(
            tenant_id=tenant_id,
            code=data.code,
            deleted_at__isnull=True
        ).first()
        
        if existing_active:
            raise ValidationError(f"库区编码 {data.code} 已存在")
        
        # 检查是否存在相同编码的软删除记录
        existing_deleted = await StorageArea.filter(
            tenant_id=tenant_id,
            code=data.code,
            deleted_at__isnull=False
        ).first()
        
        if existing_deleted:
            # 恢复软删除的记录，更新其数据
            existing_deleted.deleted_at = None
            existing_deleted.name = data.name
            existing_deleted.description = data.description
            existing_deleted.warehouse_id = data.warehouse_id
            existing_deleted.is_active = data.is_active if hasattr(data, 'is_active') else True
            await existing_deleted.save()
            return await WarehouseService._storage_area_to_response(existing_deleted)
        
        # 创建新库区
        try:
            storage_area = await StorageArea.create(
                tenant_id=tenant_id,
                **(data.model_dump(by_alias=False) if hasattr(data, "model_dump") else data.dict())
            )
        except IntegrityError as e:
            # 捕获数据库唯一约束或主键冲突错误
            error_str = str(e).lower()
            if "unique" in error_str or "duplicate" in error_str or "pkey" in error_str:
                # 再次检查是否有软删除记录（可能在并发情况下被创建）
                existing_deleted_retry = await StorageArea.filter(
                    tenant_id=tenant_id,
                    code=data.code,
                    deleted_at__isnull=False
                ).first()
                
                if existing_deleted_retry:
                    # 恢复软删除的记录
                    existing_deleted_retry.deleted_at = None
                    existing_deleted_retry.name = data.name
                    existing_deleted_retry.description = data.description
                    existing_deleted_retry.warehouse_id = data.warehouse_id
                    existing_deleted_retry.is_active = data.is_active if hasattr(data, 'is_active') else True
                    await existing_deleted_retry.save()
                    return await WarehouseService._storage_area_to_response(existing_deleted_retry)
                
                raise ValidationError(f"库区编码 {data.code} 已存在（可能已被软删除，请检查）")
            raise
        
        return await WarehouseService._storage_area_to_response(storage_area)
    
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
        
        return await WarehouseService._storage_area_to_response(storage_area)
    
    @staticmethod
    async def list_storage_areas(
        tenant_id: int,
        skip: int = 0,
        limit: int = 100,
        warehouse_id: Optional[int] = None,
        is_active: Optional[bool] = None,
        keyword: Optional[str] = None,
        sort_field: Optional[str] = None,
        sort_order: Optional[str] = None,
    ) -> dict:
        """
        获取库区列表
        
        Args:
            tenant_id: 租户ID
            skip: 跳过数量
            limit: 限制数量
            warehouse_id: 仓库ID（可选，用于过滤）
            is_active: 是否启用（可选）
            keyword: 关键词（编码或名称模糊匹配）
            sort_field: 排序字段（前端 camelCase）
            sort_order: asc / desc
            
        Returns:
            dict: 包含 items (库区列表) 和 total (总数) 的字典
        """
        query = StorageArea.filter(
            tenant_id=tenant_id,
            deleted_at__isnull=True
        )
        
        if warehouse_id is not None:
            query = query.filter(warehouse_id=warehouse_id)
        
        if is_active is not None:
            query = query.filter(is_active=is_active)
        if keyword:
            kw = keyword.strip()
            if kw:
                query = query.filter(Q(code__icontains=kw) | Q(name__icontains=kw))
        
        total = await query.count()
        order_expr = _storage_area_list_order(sort_field, sort_order, "code")
        storage_areas = await query.offset(skip).limit(limit).order_by(order_expr).all()

        items: List[StorageAreaResponse] = []
        for sa in storage_areas:
            items.append(await WarehouseService._storage_area_to_response(sa))

        return {
            "items": items,
            "total": total
        }
    
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
        update_data = data.model_dump(exclude_unset=True, by_alias=False) if hasattr(data, "model_dump") else data.dict(exclude_unset=True)
        for key, value in update_data.items():
            setattr(storage_area, key, value)
        
        try:
            await storage_area.save()
        except IntegrityError as e:
            # 捕获数据库唯一约束错误，提供友好提示
            if "unique" in str(e).lower() or "duplicate" in str(e).lower():
                raise ValidationError(f"库区编码 {data.code or storage_area.code} 已存在（可能已被软删除，请检查）")
            raise
        
        return await WarehouseService._storage_area_to_response(storage_area)
    
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
        
        unique_uuids = list(dict.fromkeys(storage_area_uuids))

        for storage_area_uuid in unique_uuids:
            try:
                storage_area = await StorageArea.filter(
                    tenant_id=tenant_id,
                    uuid=storage_area_uuid,
                    deleted_at__isnull=True
                ).first()
                
                if not storage_area:
                    # 幂等删除：记录不存在时视作已完成，无需计入失败
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
        
        # 检查编码是否已存在（包括软删除的记录）
        existing_active = await StorageLocation.filter(
            tenant_id=tenant_id,
            code=data.code,
            deleted_at__isnull=True
        ).first()
        
        if existing_active:
            raise ValidationError(f"库位编码 {data.code} 已存在")
        
        # 检查是否存在相同编码的软删除记录
        existing_deleted = await StorageLocation.filter(
            tenant_id=tenant_id,
            code=data.code,
            deleted_at__isnull=False
        ).first()
        
        if existing_deleted:
            # 恢复软删除的记录，更新其数据
            existing_deleted.deleted_at = None
            existing_deleted.name = data.name
            existing_deleted.description = data.description
            existing_deleted.storage_area_id = data.storage_area_id
            existing_deleted.is_active = data.is_active if hasattr(data, 'is_active') else True
            await existing_deleted.save()
            return await WarehouseService._storage_location_to_response(existing_deleted)
        
        # 创建新库位
        try:
            storage_location = await StorageLocation.create(
                tenant_id=tenant_id,
                **(data.model_dump(by_alias=False) if hasattr(data, "model_dump") else data.dict())
            )
        except IntegrityError as e:
            # 捕获数据库唯一约束或主键冲突错误
            error_str = str(e).lower()
            if "unique" in error_str or "duplicate" in error_str or "pkey" in error_str:
                # 再次检查是否有软删除记录（可能在并发情况下被创建）
                existing_deleted_retry = await StorageLocation.filter(
                    tenant_id=tenant_id,
                    code=data.code,
                    deleted_at__isnull=False
                ).first()
                
                if existing_deleted_retry:
                    # 恢复软删除的记录
                    existing_deleted_retry.deleted_at = None
                    existing_deleted_retry.name = data.name
                    existing_deleted_retry.description = data.description
                    existing_deleted_retry.storage_area_id = data.storage_area_id
                    existing_deleted_retry.is_active = data.is_active if hasattr(data, 'is_active') else True
                    await existing_deleted_retry.save()
                    return await WarehouseService._storage_location_to_response(existing_deleted_retry)
                
                raise ValidationError(f"库位编码 {data.code} 已存在（可能已被软删除，请检查）")
            raise
        
        return await WarehouseService._storage_location_to_response(storage_location)
    
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
        
        return await WarehouseService._storage_location_to_response(storage_location)
    
    @staticmethod
    async def list_storage_locations(
        tenant_id: int,
        skip: int = 0,
        limit: int = 100,
        storage_area_id: Optional[int] = None,
        is_active: Optional[bool] = None,
        keyword: Optional[str] = None,
        sort_field: Optional[str] = None,
        sort_order: Optional[str] = None,
    ) -> dict:
        """
        获取库位列表
        
        Args:
            tenant_id: 租户ID
            skip: 跳过数量
            limit: 限制数量
            storage_area_id: 库区ID（可选，用于过滤）
            is_active: 是否启用（可选）
            keyword: 关键词（编码或名称模糊匹配）
            sort_field: 排序字段（前端 camelCase）
            sort_order: asc / desc
            
        Returns:
            dict: 包含 items (库位列表) 和 total (总数) 的字典
        """
        query = StorageLocation.filter(
            tenant_id=tenant_id,
            deleted_at__isnull=True
        )
        
        if storage_area_id is not None:
            query = query.filter(storage_area_id=storage_area_id)
        
        if is_active is not None:
            query = query.filter(is_active=is_active)
        if keyword:
            kw = keyword.strip()
            if kw:
                query = query.filter(Q(code__icontains=kw) | Q(name__icontains=kw))
        
        total = await query.count()
        order_expr = _storage_location_list_order(sort_field, sort_order, "code")
        storage_locations = await query.offset(skip).limit(limit).order_by(order_expr).all()

        loc_items: List[StorageLocationResponse] = []
        for sl in storage_locations:
            loc_items.append(await WarehouseService._storage_location_to_response(sl))

        return {
            "items": loc_items,
            "total": total
        }
    
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
        update_data = data.model_dump(exclude_unset=True, by_alias=False) if hasattr(data, "model_dump") else data.dict(exclude_unset=True)
        for key, value in update_data.items():
            setattr(storage_location, key, value)
        
        try:
            await storage_location.save()
        except IntegrityError as e:
            # 捕获数据库唯一约束错误，提供友好提示
            if "unique" in str(e).lower() or "duplicate" in str(e).lower():
                raise ValidationError(f"库位编码 {data.code or storage_location.code} 已存在（可能已被软删除，请检查）")
            raise
        
        return await WarehouseService._storage_location_to_response(storage_location)
    
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
        
        unique_uuids = list(dict.fromkeys(storage_location_uuids))

        for storage_location_uuid in unique_uuids:
            try:
                storage_location = await StorageLocation.filter(
                    tenant_id=tenant_id,
                    uuid=storage_location_uuid,
                    deleted_at__isnull=True
                ).first()
                
                if not storage_location:
                    # 幂等删除：记录不存在时视作已完成，无需计入失败
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
            sl_full = await WarehouseService._storage_location_to_response(storage_location)
            storage_location_map[area_id].append(
                StorageLocationTreeResponse.model_validate(sl_full.model_dump(mode="python"))
            )
        
        # 构建库区映射（按仓库ID分组）
        storage_area_map: dict[int, List[StorageAreaTreeResponse]] = {}
        for storage_area in storage_areas:
            warehouse_id = storage_area.warehouse_id
            if warehouse_id not in storage_area_map:
                storage_area_map[warehouse_id] = []
            
            # 获取该库区的库位列表
            area_storage_locations = storage_location_map.get(storage_area.id, [])
            
            # 创建库区响应对象（包含库位列表）
            sa_full = await WarehouseService._storage_area_to_response(storage_area)
            area_response = StorageAreaTreeResponse.model_validate(sa_full.model_dump(mode="python"))
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

    # ==================== 预设数据 ====================

    # 常见制造业仓库预设（原料仓、成品仓、半成品仓、不良品仓），编码按编码规则生成
    PRESET_WAREHOUSES = [
        {"name": "原料仓", "description": "原材料存储", "warehouse_type": "normal"},
        {"name": "成品仓", "description": "成品存储", "warehouse_type": "normal"},
        {"name": "半成品仓", "description": "在制品/半成品存储", "warehouse_type": "wip"},
        {"name": "不良品仓", "description": "不良品隔离存储", "warehouse_type": "defect"},
    ]

    @staticmethod
    async def load_preset_sme(tenant_id: int, names: Optional[List[str]] = None) -> int:
        """
        加载中国中小制造业常见仓库预设数据。
        仅创建不存在的仓库（按 name 去重），仓库编码根据编码规则生成。
        names: 若指定则只创建这些名称的预设，否则创建全部。
        """
        from core.services.business.code_generation_service import CodeGenerationService
        from core.services.default.default_values_service import DefaultValuesService

        await DefaultValuesService.ensure_code_rule_for_page(tenant_id, "master-data-warehouse-warehouse")

        items = WarehouseService.PRESET_WAREHOUSES
        if names is not None:
            names_set = set(names)
            items = [x for x in items if x["name"] in names_set]
        created = 0
        for item in items:
            exists = await Warehouse.filter(
                tenant_id=tenant_id,
                name=item["name"],
                deleted_at__isnull=True,
            ).exists()
            if not exists:
                try:
                    code = await CodeGenerationService.generate_code(
                        tenant_id, "MASTER_DATA_WAREHOUSE_WAREHOUSE"
                    )
                    await Warehouse.create(
                        tenant_id=tenant_id,
                        code=code,
                        name=item["name"],
                        description=item.get("description"),
                        warehouse_type=item.get("warehouse_type", "normal"),
                        is_active=True,
                    )
                    created += 1
                except IntegrityError:
                    pass
        return created

    @staticmethod
    async def sync_line_side_warehouses(tenant_id: int) -> dict:
        """
        根据车间/工位/工作中心自动建立线边仓。
        为每个车间、工位、工作中心创建对应的线边仓（若不存在）。
        编码规则：LBX-CJ-{车间编码}、LBX-GW-{工位编码}、LBX-GZZX-{工作中心编码}
        """
        created = 0
        skipped = 0

        # 1. 车间级线边仓
        workshops = await Workshop.filter(
            tenant_id=tenant_id, is_active=True, deleted_at__isnull=True
        ).all()
        for ws in workshops:
            code = f"LBX-CJ-{ws.code}"
            exists = await Warehouse.filter(
                tenant_id=tenant_id, code=code, deleted_at__isnull=True
            ).exists()
            if not exists:
                try:
                    await Warehouse.create(
                        tenant_id=tenant_id,
                        code=code,
                        name=f"{ws.name}线边仓",
                        warehouse_type="line_side",
                        workshop_id=ws.id,
                        workshop_name=ws.name,
                        is_active=True,
                    )
                    created += 1
                except IntegrityError:
                    skipped += 1

        # 2. 工位级线边仓（工位 -> 产线 -> 车间）
        workstations = await Workstation.filter(
            tenant_id=tenant_id, is_active=True, deleted_at__isnull=True
        ).prefetch_related("production_line")
        for wst in workstations:
            code = f"LBX-GW-{wst.code}"
            exists = await Warehouse.filter(
                tenant_id=tenant_id, code=code, deleted_at__isnull=True
            ).exists()
            if not exists and wst.production_line:
                workshop_id = wst.production_line.workshop_id
                workshop = await Workshop.filter(
                    id=workshop_id, tenant_id=tenant_id, deleted_at__isnull=True
                ).first()
                workshop_name = workshop.name if workshop else None
                try:
                    await Warehouse.create(
                        tenant_id=tenant_id,
                        code=code,
                        name=f"{wst.name}线边仓",
                        warehouse_type="line_side",
                        workshop_id=workshop_id,
                        workshop_name=workshop_name,
                        workstation_id=wst.id,
                        workstation_name=wst.name,
                        is_active=True,
                    )
                    created += 1
                except IntegrityError:
                    skipped += 1

        # 3. 工作中心级线边仓（从关联工位反推车间）
        work_centers = await WorkCenter.filter(
            tenant_id=tenant_id, is_active=True, deleted_at__isnull=True
        ).all()
        for wc in work_centers:
            code = f"LBX-GZZX-{wc.code}"
            exists = await Warehouse.filter(
                tenant_id=tenant_id, code=code, deleted_at__isnull=True
            ).exists()
            if exists:
                continue
            # 从该工作中心下第一个工位获取车间
            first_ws = await Workstation.filter(
                tenant_id=tenant_id,
                work_center_id=wc.id,
                deleted_at__isnull=True,
            ).prefetch_related("production_line").first()
            if not first_ws or not first_ws.production_line:
                skipped += 1
                continue
            workshop_id = first_ws.production_line.workshop_id
            workshop = await Workshop.filter(
                id=workshop_id, tenant_id=tenant_id, deleted_at__isnull=True
            ).first()
            workshop_name = workshop.name if workshop else None
            try:
                await Warehouse.create(
                    tenant_id=tenant_id,
                    code=code,
                    name=f"{wc.name}线边仓",
                    warehouse_type="line_side",
                    workshop_id=workshop_id,
                    workshop_name=workshop_name,
                    work_center_id=wc.id,
                    work_center_name=wc.name,
                    is_active=True,
                )
                created += 1
            except IntegrityError:
                skipped += 1

        return {"created": created, "skipped": skipped}

