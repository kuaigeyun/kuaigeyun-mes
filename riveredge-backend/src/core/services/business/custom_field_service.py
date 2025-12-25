"""
自定义字段服务模块

提供自定义字段的 CRUD 操作和字段值管理。
"""

from typing import Optional, List, Dict, Any, Tuple
from uuid import UUID
from tortoise.exceptions import IntegrityError

from core.models.custom_field import CustomField
from core.models.custom_field_value import CustomFieldValue
from core.models.data_dictionary import DataDictionary
from core.models.dictionary_item import DictionaryItem
from core.schemas.custom_field import CustomFieldCreate, CustomFieldUpdate
from core.services.data.data_dictionary_service import DataDictionaryService
from infra.exceptions.exceptions import NotFoundError, ValidationError


class CustomFieldService:
    """
    自定义字段服务类
    
    提供自定义字段的 CRUD 操作和字段值管理。
    """
    
    @staticmethod
    async def create_field(
        tenant_id: int,
        data: CustomFieldCreate
    ) -> CustomField:
        """
        创建自定义字段
        
        Args:
            tenant_id: 组织ID
            data: 字段创建数据
            
        Returns:
            CustomField: 创建的字段对象
            
        Raises:
            ValidationError: 当字段代码已存在时抛出
        """
        # 如果字段类型为 select 且配置中包含 dictionary_code，验证数据字典并自动填充选项
        field_data = data.model_dump()
        config = field_data.get("config", {}) or {}
        
        if data.field_type == "select" and config.get("dictionary_code"):
            dictionary_code = config["dictionary_code"]
            # 验证数据字典是否存在
            dictionary = await DataDictionaryService.get_dictionary_by_code(
                tenant_id=tenant_id,
                code=dictionary_code
            )
            
            if not dictionary:
                raise ValidationError(f"数据字典 {dictionary_code} 不存在或不属于当前组织")
            
            # 获取字典项并自动填充选项
            items = await DataDictionaryService.get_items_by_dictionary(
                tenant_id=tenant_id,
                dictionary_uuid=str(dictionary.uuid),
                is_active=True
            )
            
            # 将字典项转换为选项格式
            options = [
                {
                    "label": item.label,
                    "value": item.value,
                    "color": item.color,
                    "icon": item.icon
                }
                for item in items
            ]
            config["options"] = options
            field_data["config"] = config
        
        try:
            field = CustomField(
                tenant_id=tenant_id,
                **field_data
            )
            await field.save()
            return field
        except IntegrityError:
            raise ValidationError(f"字段代码 {data.code} 在表 {data.table_name} 中已存在")
    
    @staticmethod
    async def get_field_by_uuid(
        tenant_id: int,
        uuid: str
    ) -> CustomField:
        """
        根据UUID获取字段
        
        Args:
            tenant_id: 组织ID
            uuid: 字段UUID
            
        Returns:
            CustomField: 字段对象
            
        Raises:
            NotFoundError: 当字段不存在时抛出
        """
        field = await CustomField.filter(
            tenant_id=tenant_id,
            uuid=uuid,
            deleted_at__isnull=True
        ).first()
        
        if not field:
            raise NotFoundError("自定义字段不存在")
        
        return field
    
    @staticmethod
    async def list_fields(
        tenant_id: int,
        table_name: Optional[str] = None,
        skip: int = 0,
        limit: int = 100,
        is_active: Optional[bool] = None
    ) -> Tuple[List[CustomField], int]:
        """
        获取字段列表
        
        Args:
            tenant_id: 组织ID
            table_name: 表名（可选，用于筛选）
            skip: 跳过数量
            limit: 限制数量
            is_active: 是否启用（可选）
            
        Returns:
            Tuple[List[CustomField], int]: (字段列表, 总记录数)
        """
        query = CustomField.filter(
            tenant_id=tenant_id,
            deleted_at__isnull=True
        )
        
        if table_name:
            query = query.filter(table_name=table_name)
        
        if is_active is not None:
            query = query.filter(is_active=is_active)
        
        # 获取总数
        total = await query.count()
        
        # 获取分页数据
        items = await query.offset(skip).limit(limit).order_by("sort_order", "id")
        
        return items, total
    
    @staticmethod
    async def get_fields_by_table(
        tenant_id: int,
        table_name: str,
        is_active: Optional[bool] = None
    ) -> List[CustomField]:
        """
        获取指定表的所有自定义字段
        
        Args:
            tenant_id: 组织ID
            table_name: 表名
            is_active: 是否启用（可选）
            
        Returns:
            List[CustomField]: 字段列表
        """
        query = CustomField.filter(
            tenant_id=tenant_id,
            table_name=table_name,
            deleted_at__isnull=True
        )
        
        if is_active is not None:
            query = query.filter(is_active=is_active)
        
        return await query.order_by("sort_order", "id")
    
    @staticmethod
    async def update_field(
        tenant_id: int,
        uuid: str,
        data: CustomFieldUpdate
    ) -> CustomField:
        """
        更新字段
        
        Args:
            tenant_id: 组织ID
            uuid: 字段UUID
            data: 字段更新数据
            
        Returns:
            CustomField: 更新后的字段对象
            
        Raises:
            NotFoundError: 当字段不存在时抛出
        """
        field = await CustomFieldService.get_field_by_uuid(tenant_id, uuid)
        
        update_data = data.model_dump(exclude_unset=True)
        
        # 如果字段类型为 select 且配置中包含 dictionary_code，验证数据字典并自动填充选项
        if "field_type" in update_data or "config" in update_data:
            field_type = update_data.get("field_type", field.field_type)
            config = update_data.get("config", field.get_config()) or {}
            
            if field_type == "select" and config.get("dictionary_code"):
                dictionary_code = config["dictionary_code"]
                # 验证数据字典是否存在
                dictionary = await DataDictionaryService.get_dictionary_by_code(
                    tenant_id=tenant_id,
                    code=dictionary_code
                )
                
                if not dictionary:
                    raise ValidationError(f"数据字典 {dictionary_code} 不存在或不属于当前组织")
                
                # 获取字典项并自动填充选项
                items = await DataDictionaryService.get_items_by_dictionary(
                    tenant_id=tenant_id,
                    dictionary_uuid=str(dictionary.uuid),
                    is_active=True
                )
                
                # 将字典项转换为选项格式
                options = [
                    {
                        "label": item.label,
                        "value": item.value,
                        "color": item.color,
                        "icon": item.icon
                    }
                    for item in items
                ]
                config["options"] = options
                update_data["config"] = config
        
        for key, value in update_data.items():
            setattr(field, key, value)
        
        await field.save()
        return field
    
    @staticmethod
    async def delete_field(
        tenant_id: int,
        uuid: str
    ) -> None:
        """
        删除字段（软删除）
        
        Args:
            tenant_id: 组织ID
            uuid: 字段UUID
            
        Raises:
            NotFoundError: 当字段不存在时抛出
        """
        field = await CustomFieldService.get_field_by_uuid(tenant_id, uuid)
        
        # 软删除
        from datetime import datetime
        field.deleted_at = datetime.now()
        await field.save()
    
    @staticmethod
    async def set_field_value(
        tenant_id: int,
        field_uuid: str,
        record_table: str,
        record_id: int,
        value: Any
    ) -> CustomFieldValue:
        """
        设置字段值
        
        Args:
            tenant_id: 组织ID
            field_uuid: 字段UUID
            record_table: 关联表名
            record_id: 关联记录ID
            value: 字段值
            
        Returns:
            CustomFieldValue: 字段值对象
            
        Raises:
            NotFoundError: 当字段不存在时抛出
        """
        field = await CustomFieldService.get_field_by_uuid(tenant_id, field_uuid)
        
        # 获取或创建字段值
        field_value = await CustomFieldValue.get_or_none(
            custom_field_id=field.id,
            tenant_id=tenant_id,
            record_table=record_table,
            record_id=record_id,
            deleted_at__isnull=True
        )
        
        if not field_value:
            field_value = CustomFieldValue(
                custom_field_id=field.id,
                tenant_id=tenant_id,
                record_table=record_table,
                record_id=record_id
            )
        
        field_value.set_value(value, field.field_type)
        await field_value.save()
        
        return field_value
    
    @staticmethod
    async def get_field_values(
        tenant_id: int,
        record_table: str,
        record_id: int
    ) -> Dict[str, Any]:
        """
        获取记录的所有自定义字段值
        
        Args:
            tenant_id: 组织ID
            record_table: 关联表名
            record_id: 关联记录ID
            
        Returns:
            Dict[str, Any]: 字段值字典（key 为字段代码，value 为字段值）
        """
        fields = await CustomFieldService.get_fields_by_table(
            tenant_id, record_table, is_active=True
        )
        
        if not fields:
            return {}
        
        field_ids = [f.id for f in fields]
        values = await CustomFieldValue.filter(
            custom_field_id__in=field_ids,
            tenant_id=tenant_id,
            record_table=record_table,
            record_id=record_id,
            deleted_at__isnull=True
        )
        
        result = {}
        for field in fields:
            value_obj = next((v for v in values if v.custom_field_id == field.id), None)
            result[field.code] = value_obj.get_value() if value_obj else None
        
        return result
    
    @staticmethod
    async def batch_set_field_values(
        tenant_id: int,
        record_table: str,
        record_id: int,
        values: List[Dict[str, Any]]
    ) -> Dict[str, Any]:
        """
        批量设置字段值
        
        Args:
            tenant_id: 组织ID
            record_table: 关联表名
            record_id: 关联记录ID
            values: 字段值列表（每个元素包含 field_uuid 和 value）
            
        Returns:
            Dict[str, Any]: 设置结果
        """
        for item in values:
            await CustomFieldService.set_field_value(
                tenant_id=tenant_id,
                field_uuid=item["field_uuid"],
                record_table=record_table,
                record_id=record_id,
                value=item["value"]
            )
        
        return {"success": True, "count": len(values)}
    
    @staticmethod
    async def update_fields_by_dictionary_code(
        tenant_id: int,
        dictionary_code: str,
        is_active: Optional[bool] = None
    ) -> int:
        """
        根据数据字典代码更新关联的自定义字段
        
        当数据字典被删除或禁用时，自动更新关联的自定义字段。
        
        Args:
            tenant_id: 组织ID
            dictionary_code: 数据字典代码
            is_active: 是否启用（None 表示禁用）
            
        Returns:
            int: 更新的字段数量
        """
        # 查找所有使用该字典的自定义字段
        custom_fields = await CustomField.filter(
            tenant_id=tenant_id,
            deleted_at__isnull=True,
            field_type="select"
        ).all()
        
        updated_count = 0
        for field in custom_fields:
            config = field.get_config()
            if config and config.get("dictionary_code") == dictionary_code:
                if is_active is False:
                    # 禁用字段
                    field.is_active = False
                    updated_count += 1
                elif is_active is True:
                    # 重新启用字段并更新选项
                    field.is_active = True
                    # 重新获取字典项并更新选项
                    dictionary = await DataDictionaryService.get_dictionary_by_code(
                        tenant_id=tenant_id,
                        code=dictionary_code
                    )
                    if dictionary:
                        items = await DataDictionaryService.get_items_by_dictionary(
                            tenant_id=tenant_id,
                            dictionary_uuid=str(dictionary.uuid),
                            is_active=True
                        )
                        options = [
                            {
                                "label": item.label,
                                "value": item.value,
                                "color": item.color,
                                "icon": item.icon
                            }
                            for item in items
                        ]
                        config["options"] = options
                        field.set_config(config)
                        updated_count += 1
                await field.save()
        
        return updated_count

