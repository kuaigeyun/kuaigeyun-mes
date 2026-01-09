"""
物料编码规则配置服务模块

提供物料编码规则配置的 CRUD 操作、版本管理等功能。

Author: Luigi Lu
Date: 2026-01-08
"""

from typing import List, Optional, Dict, Any
from datetime import datetime
from tortoise.exceptions import IntegrityError
from loguru import logger

from core.models.material_code_rule import (
    MaterialCodeRuleMain,
    MaterialTypeConfig,
    MaterialCodeRuleAlias,
    MaterialCodeRuleHistory,
)
from core.services.business.material_code_rule_engine import MaterialCodeRuleEngine
from infra.exceptions.exceptions import NotFoundError, ValidationError


class MaterialCodeRuleService:
    """
    物料编码规则配置服务类
    
    提供物料编码规则配置的 CRUD 操作和版本管理。
    """
    
    @staticmethod
    async def get_active_main_rule(tenant_id: int) -> Optional[MaterialCodeRuleMain]:
        """
        获取当前生效的主编码规则
        
        Args:
            tenant_id: 组织ID
            
        Returns:
            Optional[MaterialCodeRuleMain]: 当前生效的主编码规则，如果不存在则返回None
        """
        rule = await MaterialCodeRuleMain.filter(
            tenant_id=tenant_id,
            is_active=True,
            deleted_at__isnull=True
        ).order_by("-version").first()
        
        return rule
    
    @staticmethod
    async def create_main_rule(
        tenant_id: int,
        rule_name: str,
        template: str,
        prefix: Optional[str] = None,
        sequence_config: Optional[Dict[str, Any]] = None,
        material_types: Optional[List[Dict[str, Any]]] = None,
        created_by: Optional[int] = None,
    ) -> MaterialCodeRuleMain:
        """
        创建主编码规则
        
        Args:
            tenant_id: 组织ID
            rule_name: 规则名称
            template: 格式模板
            prefix: 前缀
            sequence_config: 序号配置
            material_types: 物料类型列表
            created_by: 创建人ID
            
        Returns:
            MaterialCodeRuleMain: 创建的规则对象
            
        Raises:
            ValidationError: 当模板无效时抛出
        """
        # 验证模板
        MaterialCodeRuleEngine.validate_template(template)
        
        # 获取当前最大版本号
        max_version = await MaterialCodeRuleMain.filter(
            tenant_id=tenant_id,
            deleted_at__isnull=True
        ).order_by("-version").first()
        
        version = (max_version.version + 1) if max_version else 1
        
        # 创建主规则
        rule = await MaterialCodeRuleMain.create(
            tenant_id=tenant_id,
            rule_name=rule_name,
            template=template,
            prefix=prefix,
            sequence_config=sequence_config or {},
            is_active=False,  # 新建规则默认不启用，需要手动启用
            version=version,
            created_by=created_by,
        )
        
        # 创建物料类型配置
        if material_types:
            for type_config in material_types:
                await MaterialTypeConfig.create(
                    tenant_id=tenant_id,
                    rule_id=rule.id,
                    type_code=type_config.get("code"),
                    type_name=type_config.get("name"),
                    description=type_config.get("description"),
                    independent_sequence=type_config.get("independent_sequence", True),
                )
        
        # 记录版本历史
        rule_config = {
            "rule_name": rule.rule_name,
            "template": rule.template,
            "prefix": rule.prefix,
            "sequence_config": rule.sequence_config,
            "is_active": rule.is_active,
        }
        await MaterialCodeRuleService._save_rule_history(
            tenant_id=tenant_id,
            rule_type="main",
            rule_id=rule.id,
            version=version,
            rule_config=rule_config,
            changed_by=created_by,
        )
        
        logger.info(f"为组织 {tenant_id} 创建主编码规则: {rule_name} (v{version})")
        return rule
    
    @staticmethod
    async def update_main_rule(
        tenant_id: int,
        rule_id: int,
        rule_name: Optional[str] = None,
        template: Optional[str] = None,
        prefix: Optional[str] = None,
        sequence_config: Optional[Dict[str, Any]] = None,
        material_types: Optional[List[Dict[str, Any]]] = None,
        updated_by: Optional[int] = None,
    ) -> MaterialCodeRuleMain:
        """
        更新主编码规则
        
        Args:
            tenant_id: 组织ID
            rule_id: 规则ID
            rule_name: 规则名称
            template: 格式模板
            prefix: 前缀
            sequence_config: 序号配置
            material_types: 物料类型列表
            updated_by: 更新人ID
            
        Returns:
            MaterialCodeRuleMain: 更新后的规则对象
            
        Raises:
            NotFoundError: 当规则不存在时抛出
            ValidationError: 当模板无效时抛出
        """
        rule = await MaterialCodeRuleMain.filter(
            tenant_id=tenant_id,
            id=rule_id,
            deleted_at__isnull=True
        ).first()
        
        if not rule:
            raise NotFoundError(f"主编码规则 {rule_id} 不存在")
        
        # 验证模板（如果提供了新模板）
        if template:
            MaterialCodeRuleEngine.validate_template(template)
            rule.template = template
        
        # 更新其他字段
        if rule_name is not None:
            rule.rule_name = rule_name
        if prefix is not None:
            rule.prefix = prefix
        if sequence_config is not None:
            rule.sequence_config = sequence_config
        if updated_by is not None:
            rule.updated_by = updated_by
        
        await rule.save()
        
        # 更新物料类型配置（如果提供了）
        if material_types is not None:
            # 删除旧的类型配置
            await MaterialTypeConfig.filter(
                tenant_id=tenant_id,
                rule_id=rule_id,
                deleted_at__isnull=True
            ).update(deleted_at=datetime.now())
            
            # 创建新的类型配置
            for type_config in material_types:
                await MaterialTypeConfig.create(
                    tenant_id=tenant_id,
                    rule_id=rule_id,
                    type_code=type_config.get("code"),
                    type_name=type_config.get("name"),
                    description=type_config.get("description"),
                    independent_sequence=type_config.get("independent_sequence", True),
                )
        
        logger.info(f"更新主编码规则: {rule_id}")
        return rule
    
    @staticmethod
    async def activate_main_rule(
        tenant_id: int,
        rule_id: int,
        updated_by: Optional[int] = None,
    ) -> MaterialCodeRuleMain:
        """
        启用主编码规则（禁用其他规则）
        
        Args:
            tenant_id: 组织ID
            rule_id: 规则ID
            updated_by: 更新人ID
            
        Returns:
            MaterialCodeRuleMain: 启用后的规则对象
            
        Raises:
            NotFoundError: 当规则不存在时抛出
        """
        rule = await MaterialCodeRuleMain.filter(
            tenant_id=tenant_id,
            id=rule_id,
            deleted_at__isnull=True
        ).first()
        
        if not rule:
            raise NotFoundError(f"主编码规则 {rule_id} 不存在")
        
        # 禁用所有其他规则
        await MaterialCodeRuleMain.filter(
            tenant_id=tenant_id,
            deleted_at__isnull=True
        ).exclude(id=rule_id).update(is_active=False)
        
        # 启用当前规则
        rule.is_active = True
        if updated_by is not None:
            rule.updated_by = updated_by
        await rule.save()
        
        logger.info(f"启用主编码规则: {rule_id}")
        return rule
    
    @staticmethod
    async def get_alias_rule(
        tenant_id: int,
        code_type: str
    ) -> Optional[MaterialCodeRuleAlias]:
        """
        获取部门编码规则
        
        Args:
            tenant_id: 组织ID
            code_type: 编码类型代码
            
        Returns:
            Optional[MaterialCodeRuleAlias]: 部门编码规则，如果不存在则返回None
        """
        rule = await MaterialCodeRuleAlias.filter(
            tenant_id=tenant_id,
            code_type=code_type,
            is_active=True,
            deleted_at__isnull=True
        ).order_by("-version").first()
        
        return rule
    
    @staticmethod
    async def create_alias_rule(
        tenant_id: int,
        code_type: str,
        code_type_name: str,
        template: Optional[str] = None,
        prefix: Optional[str] = None,
        validation_pattern: Optional[str] = None,
        departments: Optional[List[str]] = None,
        created_by: Optional[int] = None,
    ) -> MaterialCodeRuleAlias:
        """
        创建部门编码规则
        
        Args:
            tenant_id: 组织ID
            code_type: 编码类型代码
            code_type_name: 编码类型名称
            template: 格式模板
            prefix: 前缀
            validation_pattern: 验证规则（正则表达式）
            departments: 关联部门列表
            created_by: 创建人ID
            
        Returns:
            MaterialCodeRuleAlias: 创建的规则对象
            
        Raises:
            ValidationError: 当编码类型已存在或模板无效时抛出
        """
        # 检查编码类型是否已存在
        existing = await MaterialCodeRuleAlias.filter(
            tenant_id=tenant_id,
            code_type=code_type,
            deleted_at__isnull=True
        ).first()
        
        if existing:
            raise ValidationError(f"编码类型 {code_type} 已存在")
        
        # 验证模板（如果提供了）
        if template:
            MaterialCodeRuleEngine.validate_template(template)
        
        # 获取当前最大版本号
        max_version = await MaterialCodeRuleAlias.filter(
            tenant_id=tenant_id,
            code_type=code_type,
            deleted_at__isnull=True
        ).order_by("-version").first()
        
        version = (max_version.version + 1) if max_version else 1
        
        # 创建规则
        rule = await MaterialCodeRuleAlias.create(
            tenant_id=tenant_id,
            code_type=code_type,
            code_type_name=code_type_name,
            template=template,
            prefix=prefix,
            validation_pattern=validation_pattern,
            departments=departments or [],
            is_active=True,  # 新建规则默认启用
            version=version,
            created_by=created_by,
        )
        
        # 记录版本历史
        rule_config = {
            "code_type": rule.code_type,
            "code_type_name": rule.code_type_name,
            "template": rule.template,
            "prefix": rule.prefix,
            "validation_pattern": rule.validation_pattern,
            "departments": rule.departments,
            "is_active": rule.is_active,
        }
        await MaterialCodeRuleService._save_rule_history(
            tenant_id=tenant_id,
            rule_type="alias",
            rule_id=rule.id,
            version=version,
            rule_config=rule_config,
            changed_by=created_by,
        )
        
        logger.info(f"为组织 {tenant_id} 创建部门编码规则: {code_type_name} ({code_type})")
        return rule
    
    @staticmethod
    async def preview_code(
        tenant_id: int,
        template: str,
        prefix: Optional[str] = None,
        material_type: str = "RAW",
        sample_sequence: int = 1,
    ) -> str:
        """
        预览编码生成效果
        
        Args:
            tenant_id: 组织ID
            template: 格式模板
            prefix: 前缀
            material_type: 物料类型代码
            sample_sequence: 示例序号
            
        Returns:
            str: 预览的编码
        """
        return await MaterialCodeRuleEngine.preview_code(
            tenant_id=tenant_id,
            template=template,
            prefix=prefix,
            material_type=material_type,
            sample_sequence=sample_sequence,
        )
    
    @staticmethod
    async def _save_rule_history(
        tenant_id: int,
        rule_type: str,
        rule_id: int,
        version: int,
        rule_config: Dict[str, Any],
        changed_by: Optional[int] = None,
        change_description: Optional[str] = None,
    ) -> MaterialCodeRuleHistory:
        """
        保存规则版本历史
        
        Args:
            tenant_id: 组织ID
            rule_type: 规则类型（main/alias）
            rule_id: 规则ID
            version: 版本号
            rule_config: 规则配置（完整JSON）
            changed_by: 变更人ID
            change_description: 变更说明
            
        Returns:
            MaterialCodeRuleHistory: 创建的历史记录
        """
        history = await MaterialCodeRuleHistory.create(
            tenant_id=tenant_id,
            rule_type=rule_type,
            rule_id=rule_id,
            version=version,
            rule_config=rule_config,
            change_description=change_description,
            changed_by=changed_by,
            changed_at=datetime.now(),
        )
        
        return history
