"""
数据字典服务模块

提供数据字典的 CRUD 操作和字典项管理。
"""

from typing import List, Optional
from uuid import UUID
from tortoise.exceptions import IntegrityError

from tree_root.models.data_dictionary import DataDictionary
from tree_root.models.dictionary_item import DictionaryItem
from tree_root.schemas.data_dictionary import DataDictionaryCreate, DataDictionaryUpdate
from tree_root.schemas.dictionary_item import DictionaryItemCreate, DictionaryItemUpdate
from soil.exceptions.exceptions import NotFoundError, ValidationError


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
            return dictionary
        except IntegrityError:
            raise ValidationError(f"字典代码 {data.code} 已存在")
    
    @staticmethod
    async def get_dictionary_by_uuid(
        tenant_id: int,
        uuid: str
    ) -> DataDictionary:
        """
        根据UUID获取字典
        
        Args:
            tenant_id: 组织ID
            uuid: 字典UUID
            
        Returns:
            DataDictionary: 字典对象
            
        Raises:
            NotFoundError: 当字典不存在时抛出
        """
        dictionary = await DataDictionary.filter(
            tenant_id=tenant_id,
            uuid=uuid,
            deleted_at__isnull=True
        ).first()
        
        if not dictionary:
            raise NotFoundError("字典不存在")
        
        return dictionary
    
    @staticmethod
    async def get_dictionary_by_code(
        tenant_id: int,
        code: str
    ) -> Optional[DataDictionary]:
        """
        根据代码获取字典
        
        Args:
            tenant_id: 组织ID
            code: 字典代码
            
        Returns:
            DataDictionary: 字典对象，如果不存在返回 None
        """
        return await DataDictionary.filter(
            tenant_id=tenant_id,
            code=code,
            deleted_at__isnull=True,
            is_active=True
        ).first()
    
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
        if update_data:
            try:
                await dictionary.update_from_dict(update_data)
                await dictionary.save()
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
        
        # 软删除
        from datetime import datetime
        dictionary.deleted_at = datetime.utcnow()
        await dictionary.save()
    
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

