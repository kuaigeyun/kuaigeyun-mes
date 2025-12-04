"""
数据字典服务模块

提供数据字典的 CRUD 操作和字典项管理。
"""

from typing import List, Optional
from uuid import UUID
from tortoise.exceptions import IntegrityError
import json

from core.models.data_dictionary import DataDictionary
from core.models.dictionary_item import DictionaryItem
from core.schemas.data_dictionary import DataDictionaryCreate, DataDictionaryUpdate
from core.schemas.dictionary_item import DictionaryItemCreate, DictionaryItemUpdate
from infra.exceptions.exceptions import NotFoundError, ValidationError
from infra.infrastructure.cache.cache_manager import cache_manager


class DataDictionaryService:
    """
    数据字典服务类
    
    提供数据字典的 CRUD 操作和字典项管理。
    """
    
    @staticmethod
    async def create_dictionary(
        tenant_id: int,
        data: DataDictionaryCreate
    ) -> DataDictionary:
        """
        创建数据字典
        
        Args:
            tenant_id: 组织ID
            data: 字典创建数据
            
        Returns:
            DataDictionary: 创建的字典对象
            
        Raises:
            ValidationError: 当字典代码已存在时抛出
        """
        try:
            dictionary = await DataDictionary.create(
                tenant_id=tenant_id,
                **data.model_dump()
            )
            # 清除列表缓存
            await DataDictionaryService._clear_dictionary_cache(tenant_id)
            return dictionary
        except IntegrityError:
            raise ValidationError(f"字典代码 {data.code} 已存在")
    
    @staticmethod
    async def get_dictionary_by_uuid(
        tenant_id: int,
        uuid: str,
        use_cache: bool = True
    ) -> DataDictionary:
        """
        根据UUID获取字典
        
        Args:
            tenant_id: 组织ID
            uuid: 字典UUID
            use_cache: 是否使用缓存（默认True）
            
        Returns:
            DataDictionary: 字典对象
            
        Raises:
            NotFoundError: 当字典不存在时抛出
        """
        cache_key = DataDictionaryService._get_cache_key(tenant_id, "uuid", uuid)
        
        # 尝试从缓存获取
        if use_cache:
            try:
                cached = await cache_manager.get("data_dictionary", cache_key)
                if cached:
                    # 从缓存数据重建字典对象
                    dictionary = await DataDictionary.get(id=cached["id"])
                    return dictionary
            except Exception:
                # 缓存失败不影响主流程
                pass
        
        # 从数据库获取
        dictionary = await DataDictionary.filter(
            tenant_id=tenant_id,
            uuid=uuid,
            deleted_at__isnull=True
        ).first()
        
        if not dictionary:
            raise NotFoundError("字典不存在")
        
        # 缓存结果
        if use_cache:
            try:
                await cache_manager.set(
                    "data_dictionary",
                    cache_key,
                    {"id": dictionary.id, "uuid": str(dictionary.uuid), "code": dictionary.code},
                    ttl=3600  # 缓存1小时
                )
            except Exception:
                # 缓存失败不影响主流程
                pass
        
        return dictionary
    
    @staticmethod
    def _get_cache_key(tenant_id: int, key_type: str, key_value: str) -> str:
        """
        生成缓存键
        
        Args:
            tenant_id: 组织ID
            key_type: 键类型（code、uuid、list）
            key_value: 键值
            
        Returns:
            str: 缓存键
        """
        return f"{tenant_id}:{key_type}:{key_value}"
    
    @staticmethod
    async def _clear_dictionary_cache(tenant_id: int, dictionary_code: Optional[str] = None, dictionary_uuid: Optional[str] = None) -> None:
        """
        清除字典缓存
        
        Args:
            tenant_id: 组织ID
            dictionary_code: 字典代码（可选）
            dictionary_uuid: 字典UUID（可选）
        """
        try:
            if dictionary_code:
                cache_key = DataDictionaryService._get_cache_key(tenant_id, "code", dictionary_code)
                await cache_manager.delete("data_dictionary", cache_key)
            if dictionary_uuid:
                cache_key = DataDictionaryService._get_cache_key(tenant_id, "uuid", dictionary_uuid)
                await cache_manager.delete("data_dictionary", cache_key)
            # 清除列表缓存（使用通配符）
            await cache_manager.delete("data_dictionary", f"{tenant_id}:list:*")
        except Exception:
            # 缓存清除失败不影响主流程
            pass
    
    @staticmethod
    async def get_dictionary_by_code(
        tenant_id: int,
        code: str,
        use_cache: bool = True
    ) -> Optional[DataDictionary]:
        """
        根据代码获取字典
        
        Args:
            tenant_id: 组织ID
            code: 字典代码
            use_cache: 是否使用缓存（默认True）
            
        Returns:
            DataDictionary: 字典对象，如果不存在返回 None
        """
        cache_key = DataDictionaryService._get_cache_key(tenant_id, "code", code)
        
        # 尝试从缓存获取
        if use_cache:
            try:
                cached = await cache_manager.get("data_dictionary", cache_key)
                if cached:
                    # 从缓存数据重建字典对象
                    dictionary = await DataDictionary.get(id=cached["id"])
                    return dictionary
            except Exception:
                # 缓存失败不影响主流程
                pass
        
        # 从数据库获取
        dictionary = await DataDictionary.filter(
            tenant_id=tenant_id,
            code=code,
            deleted_at__isnull=True,
            is_active=True
        ).first()
        
        # 缓存结果
        if dictionary and use_cache:
            try:
                await cache_manager.set(
                    "data_dictionary",
                    cache_key,
                    {"id": dictionary.id, "uuid": str(dictionary.uuid), "code": dictionary.code},
                    ttl=3600  # 缓存1小时
                )
            except Exception:
                # 缓存失败不影响主流程
                pass
        
        return dictionary
    
    @staticmethod
    async def list_dictionaries(
        tenant_id: int,
        skip: int = 0,
        limit: int = 100,
        is_active: Optional[bool] = None
    ) -> List[DataDictionary]:
        """
        获取字典列表
        
        Args:
            tenant_id: 组织ID
            skip: 跳过数量
            limit: 限制数量
            is_active: 是否启用（可选）
            
        Returns:
            List[DataDictionary]: 字典列表
        """
        query = DataDictionary.filter(
            tenant_id=tenant_id,
            deleted_at__isnull=True
        )
        
        if is_active is not None:
            query = query.filter(is_active=is_active)
        
        return await query.order_by("-created_at").offset(skip).limit(limit)
    
    @staticmethod
    async def update_dictionary(
        tenant_id: int,
        uuid: str,
        data: DataDictionaryUpdate
    ) -> DataDictionary:
        """
        更新字典
        
        Args:
            tenant_id: 组织ID
            uuid: 字典UUID
            data: 更新数据
            
        Returns:
            DataDictionary: 更新后的字典对象
            
        Raises:
            NotFoundError: 当字典不存在时抛出
            ValidationError: 当字典代码冲突时抛出
        """
        dictionary = await DataDictionaryService.get_dictionary_by_uuid(
            tenant_id, uuid
        )
        
        # 检查是否为系统字典
        if dictionary.is_system and data.code and data.code != dictionary.code:
            raise ValidationError("系统字典的代码不可修改")
        
        update_data = data.model_dump(exclude_unset=True)
        
        # 如果字典被禁用，自动更新关联的自定义字段
        if "is_active" in update_data and not update_data["is_active"]:
            import asyncio
            from core.services.custom_field_service import CustomFieldService
            
            # 异步更新关联的自定义字段（不阻塞主流程）
            asyncio.create_task(
                CustomFieldService.update_fields_by_dictionary_code(
                    tenant_id=tenant_id,
                    dictionary_code=dictionary.code,
                    is_active=False
                )
            )
        
        if update_data:
            try:
                old_code = dictionary.code
                old_uuid = str(dictionary.uuid)
                await dictionary.update_from_dict(update_data)
                await dictionary.save()
                # 清除相关缓存
                await DataDictionaryService._clear_dictionary_cache(tenant_id, dictionary_code=old_code, dictionary_uuid=old_uuid)
                # 如果代码或UUID变更，也清除新的缓存键
                if "code" in update_data and update_data["code"] != old_code:
                    await DataDictionaryService._clear_dictionary_cache(tenant_id, dictionary_code=update_data["code"])
                if "uuid" in update_data and str(update_data["uuid"]) != old_uuid:
                    await DataDictionaryService._clear_dictionary_cache(tenant_id, dictionary_uuid=str(update_data["uuid"]))
            except IntegrityError:
                raise ValidationError("字典代码已存在")
        
        return dictionary
    
    @staticmethod
    async def delete_dictionary(
        tenant_id: int,
        uuid: str
    ) -> None:
        """
        删除字典（软删除）
        
        Args:
            tenant_id: 组织ID
            uuid: 字典UUID
            
        Raises:
            NotFoundError: 当字典不存在时抛出
            ValidationError: 当字典是系统字典时抛出
        """
        dictionary = await DataDictionaryService.get_dictionary_by_uuid(
            tenant_id, uuid
        )
        
        if dictionary.is_system:
            raise ValidationError("系统字典不可删除")
        
        # 自动更新关联的自定义字段（禁用或清空 dictionary_code）
        from core.models.custom_field import CustomField
        import json
        
        # 查找所有使用该字典的自定义字段
        custom_fields = await CustomField.filter(
            tenant_id=tenant_id,
            deleted_at__isnull=True,
            field_type="select"
        ).all()
        
        for field in custom_fields:
            config = field.get_config()
            if config and config.get("dictionary_code") == dictionary.code:
                # 清空 dictionary_code 并禁用字段
                config.pop("dictionary_code", None)
                config.pop("options", None)
                field.set_config(config)
                field.is_active = False
                await field.save()
        
        # 记录字典代码和UUID，用于清除缓存
        dictionary_code = dictionary.code
        dictionary_uuid = str(dictionary.uuid)
        
        # 软删除
        from datetime import datetime
        dictionary.deleted_at = datetime.utcnow()
        await dictionary.save()
        
        # 清除相关缓存
        await DataDictionaryService._clear_dictionary_cache(tenant_id, dictionary_code=dictionary_code, dictionary_uuid=dictionary_uuid)
    
    # 字典项相关方法
    @staticmethod
    async def create_item(
        tenant_id: int,
        data: DictionaryItemCreate
    ) -> DictionaryItem:
        """
        创建字典项
        
        Args:
            tenant_id: 组织ID
            data: 字典项创建数据
            
        Returns:
            DictionaryItem: 创建的字典项对象
            
        Raises:
            NotFoundError: 当字典不存在时抛出
            ValidationError: 当字典项值已存在时抛出
        """
        dictionary = await DataDictionaryService.get_dictionary_by_uuid(
            tenant_id, data.dictionary_uuid
        )
        
        try:
            item = await DictionaryItem.create(
                tenant_id=tenant_id,
                dictionary_id=dictionary.id,
                **{k: v for k, v in data.model_dump().items() if k != "dictionary_uuid"}
            )
            return item
        except IntegrityError:
            raise ValidationError(f"字典项值 {data.value} 已存在")
    
    @staticmethod
    async def get_item_by_uuid(
        tenant_id: int,
        uuid: str
    ) -> DictionaryItem:
        """
        根据UUID获取字典项
        
        Args:
            tenant_id: 组织ID
            uuid: 字典项UUID
            
        Returns:
            DictionaryItem: 字典项对象
            
        Raises:
            NotFoundError: 当字典项不存在时抛出
        """
        item = await DictionaryItem.filter(
            tenant_id=tenant_id,
            uuid=uuid,
            deleted_at__isnull=True
        ).first()
        
        if not item:
            raise NotFoundError("字典项不存在")
        
        return item
    
    @staticmethod
    async def get_items_by_dictionary(
        tenant_id: int,
        dictionary_uuid: str,
        is_active: Optional[bool] = None
    ) -> List[DictionaryItem]:
        """
        获取字典的所有字典项
        
        Args:
            tenant_id: 组织ID
            dictionary_uuid: 字典UUID
            is_active: 是否启用（可选）
            
        Returns:
            List[DictionaryItem]: 字典项列表
            
        Raises:
            NotFoundError: 当字典不存在时抛出
        """
        dictionary = await DataDictionaryService.get_dictionary_by_uuid(
            tenant_id, dictionary_uuid
        )
        
        query = DictionaryItem.filter(
            tenant_id=tenant_id,
            dictionary_id=dictionary.id,
            deleted_at__isnull=True
        )
        
        if is_active is not None:
            query = query.filter(is_active=is_active)
        
        return await query.order_by("sort_order", "id")
    
    @staticmethod
    async def update_item(
        tenant_id: int,
        uuid: str,
        data: DictionaryItemUpdate
    ) -> DictionaryItem:
        """
        更新字典项
        
        Args:
            tenant_id: 组织ID
            uuid: 字典项UUID
            data: 更新数据
            
        Returns:
            DictionaryItem: 更新后的字典项对象
            
        Raises:
            NotFoundError: 当字典项不存在时抛出
            ValidationError: 当字典项值冲突时抛出
        """
        item = await DataDictionaryService.get_item_by_uuid(tenant_id, uuid)
        
        update_data = data.model_dump(exclude_unset=True)
        if update_data:
            try:
                await item.update_from_dict(update_data)
                await item.save()
            except IntegrityError:
                raise ValidationError("字典项值已存在")
        
        return item
    
    @staticmethod
    async def delete_item(
        tenant_id: int,
        uuid: str
    ) -> None:
        """
        删除字典项（软删除）
        
        Args:
            tenant_id: 组织ID
            uuid: 字典项UUID
            
        Raises:
            NotFoundError: 当字典项不存在时抛出
        """
        item = await DataDictionaryService.get_item_by_uuid(tenant_id, uuid)
        
        # 软删除
        from datetime import datetime
        item.deleted_at = datetime.utcnow()
        await item.save()

