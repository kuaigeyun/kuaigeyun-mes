"""
语言管理服务模块

提供语言的 CRUD 操作和翻译管理。
"""

import uuid
from typing import Optional, List, Dict, Any
from tortoise.exceptions import IntegrityError

from core.models.language import Language
from core.schemas.language import LanguageCreate, LanguageUpdate
from infra.exceptions.exceptions import NotFoundError, ValidationError


class LanguageService:
    """
    语言管理服务类
    
    提供语言的 CRUD 操作和翻译管理。
    """
    
    @staticmethod
    async def create_language(
        tenant_id: int,
        data: LanguageCreate
    ) -> Language:
        """
        创建语言
        
        Args:
            tenant_id: 组织ID
            data: 语言创建数据
            
        Returns:
            Language: 创建的语言对象
            
        Raises:
            ValidationError: 当语言代码已存在时抛出
        """
        try:
            language = Language(
                uuid=str(uuid.uuid4()),
                tenant_id=tenant_id,
                **data.model_dump()
            )
            await language.save()
            
            # 如果设置为默认语言，取消其他语言的默认标记
            if data.is_default:
                await Language.filter(
                    tenant_id=tenant_id,
                    is_default=True,
                    deleted_at__isnull=True
                ).exclude(id=language.id).update(is_default=False)
            
            return language
        except IntegrityError:
            raise ValidationError(f"语言代码 {data.code} 已存在")
    
    @staticmethod
    async def get_language_by_uuid(
        tenant_id: int,
        uuid: str
    ) -> Language:
        """
        根据UUID获取语言
        
        Args:
            tenant_id: 组织ID
            uuid: 语言UUID
            
        Returns:
            Language: 语言对象
            
        Raises:
            NotFoundError: 当语言不存在时抛出
        """
        language = await Language.filter(
            tenant_id=tenant_id,
            uuid=uuid,
            deleted_at__isnull=True
        ).first()
        
        if not language:
            raise NotFoundError("语言不存在")
        
        return language
    
    @staticmethod
    async def get_language_by_code(
        tenant_id: int,
        code: str
    ) -> Optional[Language]:
        """
        根据代码获取语言
        
        Args:
            tenant_id: 组织ID
            code: 语言代码
            
        Returns:
            Language: 语言对象，如果不存在返回 None
        """
        return await Language.filter(
            tenant_id=tenant_id,
            code=code,
            deleted_at__isnull=True,
            is_active=True
        ).first()
    
    @staticmethod
    async def get_default_language(tenant_id: int) -> Optional[Language]:
        """
        获取默认语言
        
        Args:
            tenant_id: 组织ID
            
        Returns:
            Language: 默认语言对象，如果不存在返回 None
        """
        return await Language.filter(
            tenant_id=tenant_id,
            is_default=True,
            deleted_at__isnull=True,
            is_active=True
        ).first()
    
    @staticmethod
    async def list_languages(
        tenant_id: int,
        page: int = 1,
        page_size: int = 20,
        skip: int = 0,
        limit: int = 100,
        is_active: Optional[bool] = None,
        code: Optional[str] = None,
        name: Optional[str] = None
    ) -> tuple[List[Language], int]:
        """
        获取语言列表（支持分页和筛选）

        Args:
            tenant_id: 组织ID
            page: 页码（与 skip 二选一）
            page_size: 每页数量（与 limit 二选一）
            skip: 跳过数量（兼容旧参数）
            limit: 限制数量（兼容旧参数）
            is_active: 是否启用（可选）
            code: 语言代码模糊搜索（可选）
            name: 语言名称模糊搜索（可选）

        Returns:
            tuple[List[Language], int]: (语言列表, 总数)
        """
        query = Language.filter(
            tenant_id=tenant_id,
            deleted_at__isnull=True
        )

        if is_active is not None:
            query = query.filter(is_active=is_active)
        if code:
            query = query.filter(code__icontains=code)
        if name:
            query = query.filter(name__icontains=name)

        total = await query.count()

        # 优先使用 page/page_size
        if page >= 1 and page_size >= 1:
            skip_val = (page - 1) * page_size
            limit_val = page_size
        else:
            skip_val = skip
            limit_val = limit

        items = await query.offset(skip_val).limit(limit_val).order_by("sort_order", "id")
        return list(items), total
    
    @staticmethod
    async def update_language(
        tenant_id: int,
        uuid: str,
        data: LanguageUpdate
    ) -> Language:
        """
        更新语言
        
        Args:
            tenant_id: 组织ID
            uuid: 语言UUID
            data: 语言更新数据
            
        Returns:
            Language: 更新后的语言对象
            
        Raises:
            NotFoundError: 当语言不存在时抛出
        """
        language = await LanguageService.get_language_by_uuid(tenant_id, uuid)
        
        update_data = data.model_dump(exclude_unset=True)
        
        # 如果设置为默认语言，取消其他语言的默认标记
        if 'is_default' in update_data and update_data['is_default']:
            await Language.filter(
                tenant_id=tenant_id,
                is_default=True,
                deleted_at__isnull=True
            ).exclude(id=language.id).update(is_default=False)
        
        # 记录变更前的状态（用于通知前端）
        old_code = language.code
        old_is_active = language.is_active
        old_is_default = language.is_default
        
        for key, value in update_data.items():
            setattr(language, key, value)
        
        await language.save()
        
        # 如果语言代码、状态或默认语言标记变更，通知前端（异步，不阻塞主流程）
        code_changed = old_code != language.code
        status_changed = old_is_active != language.is_active
        default_changed = old_is_default != language.is_default
        
        if code_changed or status_changed or default_changed:
            import asyncio
            # 异步通知前端语言变更
            asyncio.create_task(
                LanguageService._notify_frontend(
                    tenant_id=tenant_id,
                    language_code=old_code if code_changed else language.code,
                    new_language_code=language.code if code_changed else None,
                    is_active=language.is_active,
                    is_default=language.is_default
                )
            )
        
        return language
    
    @staticmethod
    async def delete_language(
        tenant_id: int,
        uuid: str
    ) -> None:
        """
        删除语言（软删除）
        
        Args:
            tenant_id: 组织ID
            uuid: 语言UUID
            
        Raises:
            NotFoundError: 当语言不存在时抛出
            ValidationError: 当语言是默认语言时抛出
        """
        language = await LanguageService.get_language_by_uuid(tenant_id, uuid)
        
        if language.is_default:
            raise ValidationError("默认语言不可删除")
        
        # 软删除
        from datetime import datetime
        language.deleted_at = datetime.now()
        await language.save()
    
    @staticmethod
    async def get_translations(
        tenant_id: int,
        code: str
    ) -> Dict[str, str]:
        """
        获取翻译内容
        
        Args:
            tenant_id: 组织ID
            code: 语言代码
            
        Returns:
            Dict[str, str]: 翻译内容字典
        """
        language = await LanguageService.get_language_by_code(tenant_id, code)
        if not language:
            # 如果语言不存在，返回默认语言的翻译
            default_language = await LanguageService.get_default_language(tenant_id)
            if default_language:
                return default_language.translations or {}
            return {}
        
        return language.translations or {}
    
    @staticmethod
    async def update_translations(
        tenant_id: int,
        uuid: str,
        translations: Dict[str, str]
    ) -> Language:
        """
        更新翻译内容
        
        Args:
            tenant_id: 组织ID
            uuid: 语言UUID
            translations: 翻译内容字典
            
        Returns:
            Language: 更新后的语言对象
            
        Raises:
            NotFoundError: 当语言不存在时抛出
        """
        language = await LanguageService.get_language_by_uuid(tenant_id, uuid)
        language.update_translations(translations)
        await language.save()
        
        # 翻译内容更新，通知前端（异步，不阻塞主流程）
        import asyncio
        asyncio.create_task(
            LanguageService._notify_frontend(
                tenant_id=tenant_id,
                language_code=language.code,
                translations_updated=True
            )
        )
        
        return language
    
    @staticmethod
    async def initialize_system_languages(tenant_id: int) -> Dict[str, Any]:
        """
        初始化系统语言

        为当前租户创建默认系统语言（简体中文、English）。
        如果语言已存在则跳过；若不存在则创建。

        Args:
            tenant_id: 组织ID

        Returns:
            Dict[str, Any]: 初始化结果
        """
        from loguru import logger
        from core.schemas.language import LanguageCreate

        logger.info(f"开始为组织 {tenant_id} 初始化系统语言")

        # 系统预设语言配置：code, name, native_name, is_default, sort_order
        SYSTEM_LANGUAGES = [
            {
                "code": "zh-CN",
                "name": "简体中文",
                "native_name": "中文",
                "is_default": True,
                "sort_order": 0,
            },
            {
                "code": "en-US",
                "name": "English",
                "native_name": "English",
                "is_default": False,
                "sort_order": 1,
            },
        ]

        created_count = 0
        skipped_count = 0
        created_languages = []

        for lang_config in SYSTEM_LANGUAGES:
            try:
                existing = await Language.filter(
                    tenant_id=tenant_id,
                    code=lang_config["code"],
                    deleted_at__isnull=True,
                ).first()

                if existing:
                    logger.info(f"系统语言 {lang_config['code']} 已存在，UUID: {existing.uuid}")
                    skipped_count += 1
                    continue

                data = LanguageCreate(
                    code=lang_config["code"],
                    name=lang_config["name"],
                    native_name=lang_config["native_name"],
                    is_default=lang_config["is_default"],
                    is_active=True,
                    sort_order=lang_config["sort_order"],
                    translations={},
                )
                language = await LanguageService.create_language(tenant_id=tenant_id, data=data)
                created_languages.append({"code": language.code, "name": language.name, "uuid": str(language.uuid)})
                created_count += 1
                logger.info(f"系统语言 {lang_config['code']} 创建成功，UUID: {language.uuid}")

            except Exception as e:
                logger.error(f"初始化系统语言 {lang_config['code']} 失败: {e}")
                import traceback
                logger.error(traceback.format_exc())
                # 将首次异常向外抛出，便于前端展示真实错误（如：表不存在、权限问题等）
                if created_count == 0 and skipped_count == 0:
                    raise

        logger.info(f"组织 {tenant_id} 系统语言初始化完成！创建 {created_count} 个，跳过 {skipped_count} 个已存在")
        return {
            "tenant_id": tenant_id,
            "languages": created_languages,
            "languages_created_count": created_count,
            "languages_skipped_count": skipped_count,
        }

    @staticmethod
    async def _notify_frontend(
        tenant_id: int,
        language_code: str,
        new_language_code: Optional[str] = None,
        is_active: bool = True,
        is_default: bool = False,
        translations_updated: bool = False
    ) -> None:
        """
        通知前端语言变更
        
        这是一个预留方法，用于将来实现前端的语言变更通知。
        目前只是记录变更，不执行具体操作。
        
        Args:
            tenant_id: 组织ID
            language_code: 语言代码
            new_language_code: 新语言代码（如果语言代码变更）
            is_active: 是否启用
            is_default: 是否默认语言
            translations_updated: 翻译内容是否更新
        """
        # TODO: 如果将来需要前端自动刷新翻译，可以在这里实现
        # 例如：
        # 1. 通过 WebSocket 推送语言变更通知
        # 2. 前端监听通知，自动重新加载翻译内容
        # 3. 更新 i18next 的资源
        
        # 注意：翻译内容更新时，前端应该自动重新加载翻译
        # 可以通过 WebSocket 或轮询机制实现
        pass

