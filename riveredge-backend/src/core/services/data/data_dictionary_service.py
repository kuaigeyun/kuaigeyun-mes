"""
数据字典服务模块

提供数据字典的 CRUD 操作和字典项管理。
"""

from typing import List, Optional, Dict, Any, Tuple, Set
from functools import lru_cache
from uuid import UUID
from tortoise.exceptions import IntegrityError
from tortoise.expressions import Q
import json

from core.models.data_dictionary import DataDictionary
from core.models.dictionary_item import DictionaryItem
from core.schemas.data_dictionary import DataDictionaryCreate, DataDictionaryUpdate
from core.schemas.dictionary_item import (
    DictionaryItemCreate,
    DictionaryItemUpdate,
    DictionaryItemResponse,
)
from infra.exceptions.exceptions import NotFoundError, ValidationError
from infra.infrastructure.cache.cache_manager import cache_manager
from core.utils.timezone_utils import now_utc


def normalize_dictionary_item_token(value: Any) -> str:
    return str(value or "").strip()


def dictionary_item_duplicate_message(
    *,
    candidate_value: str,
    candidate_label: str,
    existing_value: str,
    existing_label: str,
) -> Optional[str]:
    """同字典项 value/label（去空白）冲突时返回错误文案，否则 None。"""
    cv = normalize_dictionary_item_token(candidate_value)
    cl = normalize_dictionary_item_token(candidate_label)
    ev = normalize_dictionary_item_token(existing_value)
    el = normalize_dictionary_item_token(existing_label)
    if cv and cv == ev:
        return f"字典项值 {cv} 已存在"
    if cl and cl == el:
        return f"字典项标签 {cl} 已存在"
    return None


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
        page: int = 1,
        page_size: int = 20,
        is_active: Optional[bool] = None,
        name: Optional[str] = None,
        code: Optional[str] = None,
        keyword: Optional[str] = None,
        installed_app_codes: Optional[Set[str]] = None,
    ) -> tuple[List[DataDictionary], int]:
        """
        获取字典列表
        
        Args:
            tenant_id: 组织ID
            page: 页码（从1开始）
            page_size: 每页数量
            is_active: 是否启用（可选）
            name: 字典名称（模糊搜索，可选）
            code: 字典代码（模糊搜索，可选）
            keyword: 顶栏模糊搜索（名称/代码/备注 OR，可选）
            installed_app_codes: 已安装应用；传入时按字典归属应用过滤系统字典列表
            
        Returns:
            tuple[List[DataDictionary], int]: (字典列表, 总数)
        """
        from core.services.system.installed_feature_scope import (
            data_dictionary_list_visibility_q,
        )
        
        query = DataDictionary.filter(
            tenant_id=tenant_id,
            deleted_at__isnull=True
        )

        if installed_app_codes is not None:
            query = query.filter(data_dictionary_list_visibility_q(installed_app_codes))
        
        # 启用状态筛选
        if is_active is not None:
            query = query.filter(is_active=is_active)

        keyword_text = (keyword or "").strip()
        if keyword_text:
            query = query.filter(
                Q(name__icontains=keyword_text)
                | Q(code__icontains=keyword_text)
                | Q(description__icontains=keyword_text)
            )
        else:
            # 高级搜索：名称、代码独立模糊条件
            if name:
                query = query.filter(name__icontains=name)
            if code:
                query = query.filter(code__icontains=code)
        
        # 获取总数
        total = await query.count()
        
        # 分页查询
        offset = (page - 1) * page_size
        dictionaries = await query.order_by("-created_at").offset(offset).limit(page_size).all()
        
        return dictionaries, total
    
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
            from core.services.business.custom_field_service import CustomFieldService
            
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
        dictionary.deleted_at = now_utc()
        await dictionary.save()
        
        # 清除相关缓存
        await DataDictionaryService._clear_dictionary_cache(tenant_id, dictionary_code=dictionary_code, dictionary_uuid=dictionary_uuid)
    
    # 字典项相关方法
    @staticmethod
    @lru_cache(maxsize=1)
    def _system_preset_values_by_code() -> Dict[str, Set[str]]:
        """SYSTEM_DICTIONARIES 中各字典 code -> 预置 value 集合（用于识别不可删项）。"""
        from core.config.system_dictionaries import SYSTEM_DICTIONARIES

        mapping: Dict[str, Set[str]] = {}
        for dict_config in SYSTEM_DICTIONARIES:
            code = str(dict_config.get("code") or "").strip()
            if not code:
                continue
            mapping[code] = {
                str(item.get("value") or "").strip()
                for item in dict_config.get("items", [])
                if str(item.get("value") or "").strip()
            }
        return mapping

    @staticmethod
    def is_system_managed_item(dictionary: DataDictionary, item: DictionaryItem) -> bool:
        """
        系统预置字典项：字典 is_system 且 value 在 SYSTEM_DICTIONARIES 预置列表中。
        非系统（APP/租户自定义）字典的字典项均返回 False。
        """
        if not dictionary.is_system:
            return False
        presets = DataDictionaryService._system_preset_values_by_code().get(dictionary.code, set())
        return str(item.value or "").strip() in presets

    @staticmethod
    def build_item_response(item: DictionaryItem, dictionary: DataDictionary) -> DictionaryItemResponse:
        """ORM 无 dictionary_uuid 字段，需显式组装响应（与 list_items API 一致）。"""
        return DictionaryItemResponse.model_validate(
            {
                "uuid": str(item.uuid),
                "tenant_id": item.tenant_id,
                "dictionary_uuid": str(dictionary.uuid),
                "label": item.label,
                "value": item.value,
                "description": item.description,
                "color": item.color,
                "icon": item.icon,
                "sort_order": item.sort_order,
                "is_active": item.is_active,
                "is_system_managed": DataDictionaryService.is_system_managed_item(dictionary, item),
                "created_at": item.created_at,
                "updated_at": item.updated_at,
            }
        )

    @staticmethod
    async def get_dictionary_for_item(tenant_id: int, item: DictionaryItem) -> DataDictionary:
        dictionary = await DataDictionary.filter(
            tenant_id=tenant_id,
            id=item.dictionary_id,
            deleted_at__isnull=True,
        ).first()
        if not dictionary:
            raise NotFoundError("字典不存在")
        return dictionary

    @staticmethod
    def _normalize_item_update_payload(update_data: Dict[str, Any]) -> Dict[str, Any]:
        for key in ("color", "icon", "description"):
            if key in update_data and update_data[key] == "":
                update_data[key] = None
        if "sort_order" in update_data and update_data["sort_order"] is not None:
            update_data["sort_order"] = int(update_data["sort_order"])
        return update_data

    @staticmethod
    async def _assert_dictionary_item_unique(
        tenant_id: int,
        dictionary_id: int,
        *,
        value: str,
        label: str,
        exclude_item_id: Optional[int] = None,
    ) -> None:
        """同字典内 value / label（去空白）不可重复。"""
        value = str(value or "").strip()
        label = str(label or "").strip()
        query = DictionaryItem.filter(
            tenant_id=tenant_id,
            dictionary_id=dictionary_id,
            deleted_at__isnull=True,
        )
        if exclude_item_id is not None:
            query = query.exclude(id=exclude_item_id)
        for item in await query.all():
            message = dictionary_item_duplicate_message(
                candidate_value=value,
                candidate_label=label,
                existing_value=item.value,
                existing_label=item.label,
            )
            if message:
                raise ValidationError(message)

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

        payload = {k: v for k, v in data.model_dump().items() if k != "dictionary_uuid"}
        payload["value"] = str(payload.get("value") or "").strip()
        payload["label"] = str(payload.get("label") or "").strip()
        if not payload["value"]:
            raise ValidationError("字典项值不能为空")
        if not payload["label"]:
            raise ValidationError("字典项标签不能为空")

        await DataDictionaryService._assert_dictionary_item_unique(
            tenant_id,
            int(dictionary.id),
            value=payload["value"],
            label=payload["label"],
        )

        try:
            item = await DictionaryItem.create(
                tenant_id=tenant_id,
                dictionary_id=dictionary.id,
                **payload
            )
            return item
        except IntegrityError:
            raise ValidationError(f"字典项值 {payload['value']} 已存在")
    
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
        
        update_data = DataDictionaryService._normalize_item_update_payload(
            data.model_dump(exclude_unset=True)
        )
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

        - 系统预置项（SYSTEM_DICTIONARIES 同步项）：不可删除
        - 系统字典下租户新增项、非系统（APP/自定义）字典项：可删除

        Args:
            tenant_id: 组织ID
            uuid: 字典项UUID

        Raises:
            NotFoundError: 当字典项不存在时抛出
            ValidationError: 当字典项为系统预置项时抛出
        """
        item = await DataDictionaryService.get_item_by_uuid(tenant_id, uuid)
        await item.fetch_related("dictionary")
        if DataDictionaryService.is_system_managed_item(item.dictionary, item):
            raise ValidationError("系统预置字典项不允许删除")
        
        # 软删除
        from datetime import datetime
        item.deleted_at = now_utc()
        await item.save()
    
    @staticmethod
    async def _sync_single_system_dictionary_config(
        tenant_id: int, dict_config: Dict[str, Any]
    ) -> Tuple[DataDictionary, int, int]:
        """
        按 SYSTEM_DICTIONARIES 中单条配置：创建或复用字典，并同步其预置字典项。
        返回 (字典, 新建项数, 更新项数)。
        """
        from core.schemas.data_dictionary import DataDictionaryCreate
        from core.schemas.dictionary_item import DictionaryItemCreate

        existing_dict = await DataDictionary.filter(
            tenant_id=tenant_id,
            code=dict_config["code"],
            deleted_at__isnull=True,
        ).first()

        if existing_dict:
            dictionary = existing_dict
        else:
            dictionary_data = DataDictionaryCreate(
                name=dict_config["name"],
                code=dict_config["code"],
                description=dict_config.get("description"),
                is_system=True,
                is_active=True,
            )
            dictionary = await DataDictionaryService.create_dictionary(
                tenant_id=tenant_id,
                data=dictionary_data
            )

        dictionary_uuid = str(dictionary.uuid)
        items_created = 0
        items_updated = 0

        for item_config in dict_config.get("items", []):
            existing_item = await DictionaryItem.filter(
                tenant_id=tenant_id,
                dictionary_id=dictionary.id,
                value=item_config["value"],
                deleted_at__isnull=True,
            ).first()

            if existing_item:
                existing_item.label = item_config["label"]
                existing_item.description = item_config.get("description")
                existing_item.color = item_config.get("color")
                existing_item.icon = item_config.get("icon")
                existing_item.sort_order = item_config["sort_order"]
                existing_item.is_active = True
                await existing_item.save()
                items_updated += 1
            else:
                item_create_data = DictionaryItemCreate(
                    dictionary_uuid=dictionary_uuid,
                    label=item_config["label"],
                    value=item_config["value"],
                    description=item_config.get("description"),
                    color=item_config.get("color"),
                    icon=item_config.get("icon"),
                    sort_order=item_config["sort_order"],
                    is_active=True,
                )
                await DataDictionaryService.create_item(
                    tenant_id=tenant_id,
                    data=item_create_data
                )
                items_created += 1

        return dictionary, items_created, items_updated

    @staticmethod
    async def ensure_system_dictionary_exists(tenant_id: int, code: str) -> Optional[DataDictionary]:
        """
        若 code 在 SYSTEM_DICTIONARIES 中定义但当前租户尚未落库，则同步该字典及预置项。
        用于业务页按 code 拉取字典（如 CUSTOMER_CATEGORY）时自动修复，无需手工点「初始化系统字典」。
        """
        from loguru import logger
        from core.config.system_dictionaries import SYSTEM_DICTIONARIES

        dict_config = next((d for d in SYSTEM_DICTIONARIES if d.get("code") == code), None)
        if not dict_config:
            return None
        try:
            await DataDictionaryService._sync_single_system_dictionary_config(tenant_id, dict_config)
            await DataDictionaryService._clear_dictionary_cache(tenant_id, dictionary_code=code)
            return await DataDictionaryService.get_dictionary_by_code(
                tenant_id, code, use_cache=False
            )
        except ValidationError as e:
            # 并发下可能重复创建字典代码
            logger.warning(f"按需同步系统字典 {code} 遇校验提示（可能已存在）: {e}")
            return await DataDictionaryService.get_dictionary_by_code(
                tenant_id, code, use_cache=False
            )
        except Exception as e:
            logger.error(f"按需同步系统字典 {code} 失败: {e}")
            return None

    @staticmethod
    async def initialize_system_dictionaries_for_installed_apps(
        tenant_id: int,
    ) -> Dict[str, Any]:
        """按租户已安装应用，初始化全局 + 归属应用的系统字典。"""
        from core.services.system.installed_feature_scope import (
            get_installed_application_codes,
            system_dictionary_codes_for_installed_apps,
        )

        installed = await get_installed_application_codes(tenant_id)
        codes = system_dictionary_codes_for_installed_apps(installed)
        return await DataDictionaryService.initialize_system_dictionaries(
            tenant_id,
            only_codes=codes,
        )

    @staticmethod
    async def initialize_system_dictionaries_for_app_code(
        tenant_id: int,
        app_code: str,
    ) -> Dict[str, Any]:
        """应用启用后，补同步该应用归属的系统字典（含全局字典）。"""
        from core.services.system.installed_feature_scope import (
            system_dictionary_codes_for_app_code,
        )

        codes = system_dictionary_codes_for_app_code(app_code)
        return await DataDictionaryService.initialize_system_dictionaries(
            tenant_id,
            only_codes=codes,
        )

    @staticmethod
    async def initialize_system_dictionaries(
        tenant_id: int,
        *,
        only_codes: Optional[Set[str]] = None,
    ) -> Dict[str, Any]:
        """
        初始化系统字典
        
        为新租户创建所有系统字典及其字典项。
        
        Args:
            tenant_id: 组织ID
            only_codes: 仅初始化这些字典 code（None 表示全部）
            
        Returns:
            Dict[str, Any]: 初始化结果
        """
        from loguru import logger
        from core.config.system_dictionaries import SYSTEM_DICTIONARIES
        
        logger.info(f"开始为组织 {tenant_id} 初始化系统字典")
        
        created_dictionaries = []
        created_items_count = 0
        updated_items_count = 0
        
        for dict_config in SYSTEM_DICTIONARIES:
            code = str(dict_config.get("code") or "").strip()
            if not code:
                continue
            if only_codes is not None and code not in only_codes:
                continue
            try:
                dictionary, items_created, items_updated = (
                    await DataDictionaryService._sync_single_system_dictionary_config(tenant_id, dict_config)
                )
                created_dictionaries.append({
                    "code": code,
                    "name": dict_config["name"],
                    "uuid": str(dictionary.uuid),
                    "items_created": items_created,
                    "items_updated": items_updated,
                })
                created_items_count += items_created
                updated_items_count += items_updated
                logger.info(
                    f"系统字典 {code} 初始化完成：创建 {items_created} 个字典项，更新 {items_updated} 个字典项"
                )
            except Exception as e:
                logger.error(f"初始化系统字典 {code} 失败: {e}")
                import traceback
                logger.error(traceback.format_exc())
        
        logger.info(f"组织 {tenant_id} 系统字典初始化完成！创建 {len(created_dictionaries)} 个字典，创建 {created_items_count} 个字典项，更新 {updated_items_count} 个字典项")
        
        return {
            "tenant_id": tenant_id,
            "dictionaries": created_dictionaries,
            "dictionaries_count": len(created_dictionaries),
            "items_created_count": created_items_count,
            "items_updated_count": updated_items_count,
        }

