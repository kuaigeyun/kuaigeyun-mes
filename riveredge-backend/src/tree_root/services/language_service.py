"""
语言管理服务模块

提供语言的 CRUD 操作和翻译管理。
"""

from typing import Optional, List, Dict, Any
from tortoise.exceptions import IntegrityError

from tree_root.models.language import Language
from tree_root.schemas.language import LanguageCreate, LanguageUpdate
from soil.exceptions.exceptions import NotFoundError, ValidationError


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
                tenant_id=tenant_id,
                **data.model_dump()
            )
            await language.save()
            
            # 如果设置为默认语言，取消其他语言的默认标记
            if data.is_default:
                await Language.filter(
                    tenant_id=tenant_id,
                    is_default=True,
                    id__ne=language.id,
                    deleted_at__isnull=True
                ).update(is_default=False)
            
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
        skip: int = 0,
        limit: int = 100,
        is_active: Optional[bool] = None
    ) -> List[Language]:
        """
        获取语言列表
        
        Args:
            tenant_id: 组织ID
            skip: 跳过数量
            limit: 限制数量
            is_active: 是否启用（可选）
            
        Returns:
            List[Language]: 语言列表
        """
        query = Language.filter(
            tenant_id=tenant_id,
            deleted_at__isnull=True
        )
        
        if is_active is not None:
            query = query.filter(is_active=is_active)
        
        return await query.offset(skip).limit(limit).order_by("sort_order", "id")
    
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
                id__ne=language.id,
                deleted_at__isnull=True
            ).update(is_default=False)
        
        for key, value in update_data.items():
            setattr(language, key, value)
        
        await language.save()
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
        return language

