"""
物料编码规则引擎模块

提供物料编码规则解析、执行、验证等功能，支持动态生成编码。

Author: Luigi Lu
Date: 2026-01-08
"""

import re
from typing import Dict, Any, Optional, List
from datetime import datetime
from loguru import logger

from core.models.material_code_rule import (
    MaterialCodeRuleMain,
    MaterialTypeConfig,
    MaterialCodeRuleAlias,
    MaterialSequenceCounter,
)
from infra.exceptions.exceptions import NotFoundError, ValidationError


class MaterialCodeRuleEngine:
    """
    物料编码规则引擎
    
    负责解析编码格式模板、执行规则生成编码、验证编码格式等。
    """
    
    # 支持的占位符类型
    PLACEHOLDERS = {
        "PREFIX": "前缀",
        "TYPE": "物料类型代码",
        "SEQUENCE": "序号",
        "DATE": "日期（年月日）",
        "YEAR": "年份（4位）",
        "MONTH": "月份（2位）",
        "DAY": "日期（2位）",
        "ORG": "组织代码",
        "DEPT": "部门代码",
    }
    
    @staticmethod
    def parse_template(template: str) -> List[Dict[str, Any]]:
        """
        解析格式模板，提取占位符信息
        
        Args:
            template: 格式模板（如：{PREFIX}-{TYPE}-{SEQUENCE}）
            
        Returns:
            List[Dict[str, Any]]: 占位符列表，每个占位符包含类型和位置信息
        """
        pattern = r'\{([A-Z0-9_]+)\}'
        matches = re.finditer(pattern, template)
        
        placeholders = []
        for match in matches:
            placeholder_type = match.group(1)
            placeholders.append({
                "type": placeholder_type,
                "start": match.start(),
                "end": match.end(),
                "full_match": match.group(0),
            })
        
        return placeholders
    
    @staticmethod
    def validate_template(template: str) -> bool:
        """
        验证格式模板是否有效
        
        Args:
            template: 格式模板
            
        Returns:
            bool: 模板是否有效
            
        Raises:
            ValidationError: 当模板无效时抛出
        """
        if not template or not template.strip():
            raise ValidationError("格式模板不能为空")
        
        # 检查是否有占位符
        placeholders = MaterialCodeRuleEngine.parse_template(template)
        if not placeholders:
            raise ValidationError("格式模板必须包含至少一个占位符")
        
        # 验证占位符类型是否支持
        for placeholder in placeholders:
            placeholder_type = placeholder["type"]
            if placeholder_type not in MaterialCodeRuleEngine.PLACEHOLDERS:
                raise ValidationError(f"不支持的占位符类型: {placeholder_type}")
        
        return True
    
    @staticmethod
    async def generate_main_code(
        tenant_id: int,
        material_type: str,
        rule_id: Optional[int] = None
    ) -> str:
        """
        生成主编码
        
        根据配置的主编码规则生成物料主编码。
        
        Args:
            tenant_id: 组织ID
            material_type: 物料类型代码（如：FIN, SEMI, RAW）
            rule_id: 规则ID（可选，如果未提供则使用当前启用的规则）
            
        Returns:
            str: 生成的主编码
            
        Raises:
            NotFoundError: 当找不到规则或类型配置时抛出
            ValidationError: 当规则配置无效时抛出
        """
        # 获取当前生效的主编码规则
        if rule_id:
            rule = await MaterialCodeRuleMain.filter(
                tenant_id=tenant_id,
                id=rule_id,
                deleted_at__isnull=True
            ).first()
        else:
            rule = await MaterialCodeRuleMain.filter(
                tenant_id=tenant_id,
                is_active=True,
                deleted_at__isnull=True
            ).order_by("-version").first()
        
        if not rule:
            raise NotFoundError(f"未找到组织 {tenant_id} 的主编码规则配置")
        
        # 验证模板
        MaterialCodeRuleEngine.validate_template(rule.template)
        
        # 获取物料类型配置
        type_config = await MaterialTypeConfig.filter(
            tenant_id=tenant_id,
            rule_id=rule.id,
            type_code=material_type,
            deleted_at__isnull=True
        ).first()
        
        if not type_config:
            raise NotFoundError(f"未找到物料类型 {material_type} 的配置")
        
        # 解析模板
        placeholders = MaterialCodeRuleEngine.parse_template(rule.template)
        
        # 替换占位符
        code = rule.template
        sequence_config = rule.sequence_config or {}
        independent_by_type = sequence_config.get("independent_by_type", True)
        
        for placeholder in reversed(placeholders):  # 从后往前替换，避免位置偏移
            placeholder_type = placeholder["type"]
            start = placeholder["start"]
            end = placeholder["end"]
            full_match = placeholder["full_match"]
            
            # 根据占位符类型获取值
            value = await MaterialCodeRuleEngine._get_placeholder_value(
                tenant_id=tenant_id,
                rule_id=rule.id,
                placeholder_type=placeholder_type,
                prefix=rule.prefix,
                material_type=material_type,
                type_config=type_config,
                sequence_config=sequence_config,
                independent_by_type=independent_by_type,
            )
            
            # 替换占位符
            code = code[:start] + value + code[end:]
        
        logger.info(f"为组织 {tenant_id} 生成主编码: {code} (类型: {material_type})")
        return code
    
    @staticmethod
    async def _get_placeholder_value(
        tenant_id: int,
        rule_id: int,
        placeholder_type: str,
        prefix: Optional[str],
        material_type: str,
        type_config: MaterialTypeConfig,
        sequence_config: Dict[str, Any],
        independent_by_type: bool,
    ) -> str:
        """
        获取占位符的值
        
        Args:
            tenant_id: 组织ID
            rule_id: 规则ID
            placeholder_type: 占位符类型
            prefix: 前缀
            material_type: 物料类型代码
            type_config: 物料类型配置
            sequence_config: 序号配置
            independent_by_type: 是否按类型独立计数
            
        Returns:
            str: 占位符的值
        """
        if placeholder_type == "PREFIX":
            return prefix or ""
        
        elif placeholder_type == "TYPE":
            return material_type
        
        elif placeholder_type == "SEQUENCE":
            # 获取序号
            sequence_key = f"{rule_id}:{material_type}" if independent_by_type else str(rule_id)
            sequence = await MaterialCodeRuleEngine._get_next_sequence(
                tenant_id=tenant_id,
                rule_id=rule_id,
                type_code=material_type if independent_by_type else None,
                sequence_config=sequence_config,
            )
            
            # 格式化序号
            length = sequence_config.get("length", 4)
            padding_char = sequence_config.get("padding", {}).get("char", "0")
            padding_direction = sequence_config.get("padding", {}).get("direction", "left")
            
            sequence_str = str(sequence)
            if padding_direction == "left":
                sequence_str = sequence_str.rjust(length, padding_char)
            else:
                sequence_str = sequence_str.ljust(length, padding_char)
            
            return sequence_str
        
        elif placeholder_type == "DATE":
            return datetime.now().strftime("%Y%m%d")
        
        elif placeholder_type == "YEAR":
            return datetime.now().strftime("%Y")
        
        elif placeholder_type == "MONTH":
            return datetime.now().strftime("%m")
        
        elif placeholder_type == "DAY":
            return datetime.now().strftime("%d")
        
        else:
            raise ValidationError(f"不支持的占位符类型: {placeholder_type}")
    
    @staticmethod
    async def _get_next_sequence(
        tenant_id: int,
        rule_id: int,
        type_code: Optional[str],
        sequence_config: Dict[str, Any],
    ) -> int:
        """
        获取下一个序号
        
        Args:
            tenant_id: 组织ID
            rule_id: 规则ID
            type_code: 物料类型代码（如果独立计数）
            sequence_config: 序号配置
            
        Returns:
            int: 下一个序号值
        """
        # 查找或创建序号计数器
        counter = await MaterialSequenceCounter.filter(
            tenant_id=tenant_id,
            rule_id=rule_id,
            type_code=type_code,
            deleted_at__isnull=True
        ).first()
        
        if not counter:
            # 创建新的计数器
            start_value = sequence_config.get("start_value", 1)
            step = sequence_config.get("step", 1)
            counter = await MaterialSequenceCounter.create(
                tenant_id=tenant_id,
                rule_id=rule_id,
                type_code=type_code,
                current_value=start_value - step,  # 减掉步长，因为下面会加上
            )
        
        # 更新序号
        step = sequence_config.get("step", 1)
        counter.current_value += step
        await counter.save()
        
        return counter.current_value
    
    @staticmethod
    async def validate_alias_code(
        tenant_id: int,
        code_type: str,
        code: str
    ) -> bool:
        """
        验证部门编码格式
        
        根据配置的部门编码规则验证编码格式。
        
        Args:
            tenant_id: 组织ID
            code_type: 编码类型（如：SALE, DES, SUP）
            code: 编码
            
        Returns:
            bool: 编码是否有效
            
        Raises:
            ValidationError: 当编码无效时抛出
        """
        # 获取部门编码规则
        rule = await MaterialCodeRuleAlias.filter(
            tenant_id=tenant_id,
            code_type=code_type,
            is_active=True,
            deleted_at__isnull=True
        ).order_by("-version").first()
        
        if not rule:
            # 如果没有配置规则，默认通过
            return True
        
        # 如果有验证规则，进行验证
        if rule.validation_pattern:
            pattern = rule.validation_pattern
            if not re.match(pattern, code):
                raise ValidationError(
                    f"编码 {code} 不符合规则 {code_type} 的格式要求。"
                    f"验证规则: {pattern}"
                )
        
        return True
    
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
        
        用于在配置规则时预览编码生成效果。
        
        Args:
            tenant_id: 组织ID
            template: 格式模板
            prefix: 前缀
            material_type: 物料类型代码
            sample_sequence: 示例序号
            
        Returns:
            str: 预览的编码
        """
        # 验证模板
        MaterialCodeRuleEngine.validate_template(template)
        
        # 解析模板
        placeholders = MaterialCodeRuleEngine.parse_template(template)
        
        # 替换占位符
        code = template
        for placeholder in reversed(placeholders):
            placeholder_type = placeholder["type"]
            start = placeholder["start"]
            end = placeholder["end"]
            
            # 根据占位符类型获取示例值
            if placeholder_type == "PREFIX":
                value = prefix or ""
            elif placeholder_type == "TYPE":
                value = material_type
            elif placeholder_type == "SEQUENCE":
                value = str(sample_sequence).rjust(4, "0")
            elif placeholder_type == "DATE":
                value = datetime.now().strftime("%Y%m%d")
            elif placeholder_type == "YEAR":
                value = datetime.now().strftime("%Y")
            elif placeholder_type == "MONTH":
                value = datetime.now().strftime("%m")
            elif placeholder_type == "DAY":
                value = datetime.now().strftime("%d")
            else:
                value = f"{{{placeholder_type}}}"
            
            code = code[:start] + value + code[end:]
        
        return code
