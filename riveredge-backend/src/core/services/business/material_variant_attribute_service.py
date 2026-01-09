"""
变体属性定义服务模块

提供变体属性定义的 CRUD 操作、版本管理、属性验证等功能。

Author: Luigi Lu
Date: 2026-01-08
"""

from typing import List, Optional, Dict, Any
from datetime import datetime
from tortoise.exceptions import IntegrityError
from loguru import logger

from core.models.material_variant_attribute import (
    MaterialVariantAttributeDefinition,
    MaterialVariantAttributeHistory,
)
from infra.exceptions.exceptions import NotFoundError, ValidationError


class MaterialVariantAttributeService:
    """
    变体属性定义服务类
    
    提供变体属性定义的 CRUD 操作和版本管理。
    """
    
    @staticmethod
    async def create_attribute_definition(
        tenant_id: int,
        attribute_name: str,
        attribute_type: str,
        display_name: str,
        description: Optional[str] = None,
        is_required: bool = False,
        display_order: int = 0,
        enum_values: Optional[List[str]] = None,
        validation_rules: Optional[Dict[str, Any]] = None,
        default_value: Optional[str] = None,
        dependencies: Optional[Dict[str, Any]] = None,
        is_active: bool = True,
        created_by: Optional[int] = None,
    ) -> MaterialVariantAttributeDefinition:
        """
        创建变体属性定义
        
        Args:
            tenant_id: 组织ID
            attribute_name: 属性名称
            attribute_type: 属性类型
            display_name: 显示名称
            description: 属性描述
            is_required: 是否必填
            display_order: 显示顺序
            enum_values: 枚举值列表
            validation_rules: 验证规则
            default_value: 默认值
            dependencies: 依赖关系
            is_active: 是否启用
            created_by: 创建人ID
            
        Returns:
            MaterialVariantAttributeDefinition: 创建的属性定义对象
            
        Raises:
            ValidationError: 当属性名称已存在或配置无效时抛出
        """
        # 检查属性名称是否已存在
        existing = await MaterialVariantAttributeDefinition.filter(
            tenant_id=tenant_id,
            attribute_name=attribute_name,
            deleted_at__isnull=True
        ).first()
        
        if existing:
            raise ValidationError(f"属性名称 '{attribute_name}' 已存在")
        
        # 验证枚举值（如果类型为 enum）
        if attribute_type == "enum" and (not enum_values or len(enum_values) == 0):
            raise ValidationError("属性类型为 enum 时，枚举值列表不能为空")
        
        try:
            # 创建属性定义
            attribute_def = await MaterialVariantAttributeDefinition.create(
                tenant_id=tenant_id,
                attribute_name=attribute_name,
                attribute_type=attribute_type,
                display_name=display_name,
                description=description,
                is_required=is_required,
                display_order=display_order,
                enum_values=enum_values,
                validation_rules=validation_rules,
                default_value=default_value,
                dependencies=dependencies,
                is_active=is_active,
                version=1,
                created_by=created_by,
            )
            
            # 保存版本历史
            await MaterialVariantAttributeService._save_attribute_history(
                tenant_id=tenant_id,
                attribute_definition_id=attribute_def.id,
                version=1,
                attribute_config=attribute_def.__dict__,
                change_description="初始创建",
                changed_by=created_by,
            )
            
            logger.info(f"创建变体属性定义成功: {attribute_name} (tenant_id={tenant_id})")
            return attribute_def
            
        except IntegrityError as e:
            logger.error(f"创建变体属性定义失败: {e}")
            raise ValidationError(f"创建变体属性定义失败: {str(e)}")
    
    @staticmethod
    async def get_attribute_definition(
        tenant_id: int,
        uuid: str,
    ) -> MaterialVariantAttributeDefinition:
        """
        根据UUID获取变体属性定义
        
        Args:
            tenant_id: 组织ID
            uuid: 属性定义的UUID
            
        Returns:
            MaterialVariantAttributeDefinition: 属性定义对象
            
        Raises:
            NotFoundError: 当属性定义不存在时抛出
        """
        attribute_def = await MaterialVariantAttributeDefinition.filter(
            tenant_id=tenant_id,
            uuid=uuid,
            deleted_at__isnull=True
        ).first()
        
        if not attribute_def:
            raise NotFoundError(f"变体属性定义不存在: {uuid}")
        
        return attribute_def
    
    @staticmethod
    async def list_attribute_definitions(
        tenant_id: int,
        is_active: Optional[bool] = None,
        attribute_type: Optional[str] = None,
    ) -> List[MaterialVariantAttributeDefinition]:
        """
        列出变体属性定义
        
        Args:
            tenant_id: 组织ID
            is_active: 是否启用（可选，用于筛选）
            attribute_type: 属性类型（可选，用于筛选）
            
        Returns:
            List[MaterialVariantAttributeDefinition]: 属性定义列表
        """
        query = MaterialVariantAttributeDefinition.filter(
            tenant_id=tenant_id,
            deleted_at__isnull=True
        )
        
        if is_active is not None:
            query = query.filter(is_active=is_active)
        
        if attribute_type:
            query = query.filter(attribute_type=attribute_type)
        
        attributes = await query.order_by("display_order", "attribute_name").all()
        return attributes
    
    @staticmethod
    async def update_attribute_definition(
        tenant_id: int,
        uuid: str,
        attribute_name: Optional[str] = None,
        attribute_type: Optional[str] = None,
        display_name: Optional[str] = None,
        description: Optional[str] = None,
        is_required: Optional[bool] = None,
        display_order: Optional[int] = None,
        enum_values: Optional[List[str]] = None,
        validation_rules: Optional[Dict[str, Any]] = None,
        default_value: Optional[str] = None,
        dependencies: Optional[Dict[str, Any]] = None,
        is_active: Optional[bool] = None,
        updated_by: Optional[int] = None,
    ) -> MaterialVariantAttributeDefinition:
        """
        更新变体属性定义
        
        Args:
            tenant_id: 组织ID
            uuid: 属性定义的UUID
            attribute_name: 属性名称（可选）
            attribute_type: 属性类型（可选）
            display_name: 显示名称（可选）
            description: 属性描述（可选）
            is_required: 是否必填（可选）
            display_order: 显示顺序（可选）
            enum_values: 枚举值列表（可选）
            validation_rules: 验证规则（可选）
            default_value: 默认值（可选）
            dependencies: 依赖关系（可选）
            is_active: 是否启用（可选）
            updated_by: 更新人ID
            
        Returns:
            MaterialVariantAttributeDefinition: 更新后的属性定义对象
            
        Raises:
            NotFoundError: 当属性定义不存在时抛出
            ValidationError: 当更新数据无效时抛出
        """
        attribute_def = await MaterialVariantAttributeService.get_attribute_definition(
            tenant_id=tenant_id,
            uuid=uuid,
        )
        
        # 如果更新属性名称，检查是否与其他定义冲突
        if attribute_name and attribute_name != attribute_def.attribute_name:
            existing = await MaterialVariantAttributeDefinition.filter(
                tenant_id=tenant_id,
                attribute_name=attribute_name,
                deleted_at__isnull=True
            ).exclude(id=attribute_def.id).first()
            
            if existing:
                raise ValidationError(f"属性名称 '{attribute_name}' 已存在")
        
        # 验证枚举值（如果类型为 enum）
        final_attribute_type = attribute_type or attribute_def.attribute_type
        final_enum_values = enum_values if enum_values is not None else attribute_def.enum_values
        
        if final_attribute_type == "enum" and (not final_enum_values or len(final_enum_values) == 0):
            raise ValidationError("属性类型为 enum 时，枚举值列表不能为空")
        
        # 更新字段
        update_data = {}
        if attribute_name is not None:
            update_data["attribute_name"] = attribute_name
        if attribute_type is not None:
            update_data["attribute_type"] = attribute_type
        if display_name is not None:
            update_data["display_name"] = display_name
        if description is not None:
            update_data["description"] = description
        if is_required is not None:
            update_data["is_required"] = is_required
        if display_order is not None:
            update_data["display_order"] = display_order
        if enum_values is not None:
            update_data["enum_values"] = enum_values
        if validation_rules is not None:
            update_data["validation_rules"] = validation_rules
        if default_value is not None:
            update_data["default_value"] = default_value
        if dependencies is not None:
            update_data["dependencies"] = dependencies
        if is_active is not None:
            update_data["is_active"] = is_active
        if updated_by is not None:
            update_data["updated_by"] = updated_by
        
        # 如果有更新，增加版本号
        if update_data:
            update_data["version"] = attribute_def.version + 1
            await MaterialVariantAttributeDefinition.filter(id=attribute_def.id).update(**update_data)
            
            # 重新加载对象
            attribute_def = await MaterialVariantAttributeDefinition.get(id=attribute_def.id)
            
            # 保存版本历史
            await MaterialVariantAttributeService._save_attribute_history(
                tenant_id=tenant_id,
                attribute_definition_id=attribute_def.id,
                version=attribute_def.version,
                attribute_config=attribute_def.__dict__,
                change_description="更新属性定义",
                changed_by=updated_by,
            )
            
            logger.info(f"更新变体属性定义成功: {uuid} (tenant_id={tenant_id})")
        
        return attribute_def
    
    @staticmethod
    async def delete_attribute_definition(
        tenant_id: int,
        uuid: str,
        deleted_by: Optional[int] = None,
    ) -> bool:
        """
        删除变体属性定义（软删除）
        
        Args:
            tenant_id: 组织ID
            uuid: 属性定义的UUID
            deleted_by: 删除人ID
            
        Returns:
            bool: 是否删除成功
            
        Raises:
            NotFoundError: 当属性定义不存在时抛出
        """
        attribute_def = await MaterialVariantAttributeService.get_attribute_definition(
            tenant_id=tenant_id,
            uuid=uuid,
        )
        
        # 软删除
        await MaterialVariantAttributeDefinition.filter(id=attribute_def.id).update(
            deleted_at=datetime.now(),
            updated_by=deleted_by,
        )
        
        logger.info(f"删除变体属性定义成功: {uuid} (tenant_id={tenant_id})")
        return True
    
    @staticmethod
    async def get_attribute_history(
        tenant_id: int,
        attribute_definition_uuid: str,
    ) -> List[MaterialVariantAttributeHistory]:
        """
        获取变体属性定义的版本历史
        
        Args:
            tenant_id: 组织ID
            attribute_definition_uuid: 属性定义的UUID
            
        Returns:
            List[MaterialVariantAttributeHistory]: 版本历史列表
        """
        attribute_def = await MaterialVariantAttributeService.get_attribute_definition(
            tenant_id=tenant_id,
            uuid=attribute_definition_uuid,
        )
        
        history = await MaterialVariantAttributeHistory.filter(
            tenant_id=tenant_id,
            attribute_definition_id=attribute_def.id,
            deleted_at__isnull=True
        ).order_by("-version").all()
        
        return history
    
    @staticmethod
    async def validate_attribute_value(
        tenant_id: int,
        attribute_name: str,
        attribute_value: Any,
    ) -> tuple[bool, Optional[str]]:
        """
        验证变体属性值是否符合定义
        
        Args:
            tenant_id: 组织ID
            attribute_name: 属性名称
            attribute_value: 属性值
            
        Returns:
            tuple[bool, Optional[str]]: (是否有效, 错误信息)
        """
        attribute_def = await MaterialVariantAttributeDefinition.filter(
            tenant_id=tenant_id,
            attribute_name=attribute_name,
            is_active=True,
            deleted_at__isnull=True
        ).first()
        
        if not attribute_def:
            return False, f"属性定义不存在: {attribute_name}"
        
        # 必填验证
        if attribute_def.is_required and (attribute_value is None or attribute_value == ""):
            return False, f"属性 '{attribute_def.display_name}' 是必填项"
        
        # 类型验证
        if attribute_def.attribute_type == "enum":
            enum_values = attribute_def.get_enum_values()
            if attribute_value not in enum_values:
                return False, f"属性值 '{attribute_value}' 不在枚举值列表中: {enum_values}"
        
        elif attribute_def.attribute_type == "number":
            try:
                num_value = float(attribute_value)
                validation_rules = attribute_def.get_validation_rules()
                if "min" in validation_rules and num_value < validation_rules["min"]:
                    return False, f"属性值 '{attribute_value}' 小于最小值 {validation_rules['min']}"
                if "max" in validation_rules and num_value > validation_rules["max"]:
                    return False, f"属性值 '{attribute_value}' 大于最大值 {validation_rules['max']}"
            except (ValueError, TypeError):
                return False, f"属性值 '{attribute_value}' 不是有效的数字"
        
        elif attribute_def.attribute_type == "text":
            validation_rules = attribute_def.get_validation_rules()
            if "max_length" in validation_rules:
                if len(str(attribute_value)) > validation_rules["max_length"]:
                    return False, f"属性值长度超过最大长度 {validation_rules['max_length']}"
            if "min_length" in validation_rules:
                if len(str(attribute_value)) < validation_rules["min_length"]:
                    return False, f"属性值长度小于最小长度 {validation_rules['min_length']}"
        
        elif attribute_def.attribute_type == "date":
            # 日期验证（简单验证，可以根据需要扩展）
            if not isinstance(attribute_value, str):
                return False, f"属性值 '{attribute_value}' 不是有效的日期字符串"
        
        elif attribute_def.attribute_type == "boolean":
            if not isinstance(attribute_value, bool):
                return False, f"属性值 '{attribute_value}' 不是有效的布尔值"
        
        return True, None
    
    @staticmethod
    async def _save_attribute_history(
        tenant_id: int,
        attribute_definition_id: int,
        version: int,
        attribute_config: Dict[str, Any],
        change_description: Optional[str] = None,
        changed_by: Optional[int] = None,
    ) -> MaterialVariantAttributeHistory:
        """
        保存变体属性定义版本历史（内部方法）
        
        Args:
            tenant_id: 组织ID
            attribute_definition_id: 属性定义ID
            version: 版本号
            attribute_config: 属性配置（完整配置字典）
            change_description: 变更说明
            changed_by: 变更人ID
            
        Returns:
            MaterialVariantAttributeHistory: 版本历史对象
        """
        # 清理配置字典，移除不需要的字段
        clean_config = {
            k: v for k, v in attribute_config.items()
            if k not in ["id", "uuid", "tenant_id", "created_at", "updated_at", "deleted_at", "_saved_in_db"]
        }
        
        history = await MaterialVariantAttributeHistory.create(
            tenant_id=tenant_id,
            attribute_definition_id=attribute_definition_id,
            version=version,
            attribute_config=clean_config,
            change_description=change_description,
            changed_by=changed_by,
            changed_at=datetime.now(),
        )
        
        return history
