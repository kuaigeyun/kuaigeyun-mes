"""
默认值服务模块

为新组织提供默认配置，包括编码规则、系统参数等。

Author: Luigi Lu
Date: 2025-01-15
"""

from typing import List, Dict, Any
from loguru import logger

from core.services.business.code_rule_service import CodeRuleService
from core.services.system.system_parameter_service import SystemParameterService
from core.schemas.code_rule import CodeRuleCreate
from core.schemas.system_parameter import SystemParameterCreate


class DefaultValuesService:
    """
    默认值服务类
    
    为新组织提供默认配置。
    """
    
    # 默认编码规则配置
    DEFAULT_CODE_RULES = [
        {
            "name": "工单编码",
            "code": "work_order",
            "expression": "WO{YYYYMMDD}{SEQ:4}",
            "description": "工单编码规则，格式：WO + 日期（YYYYMMDD）+ 4位序号",
            "seq_start": 1,
            "seq_step": 1,
            "seq_reset_rule": "daily",
            "is_system": True,
            "is_active": True,
        },
        {
            "name": "物料编码",
            "code": "material",
            "expression": "MAT{SEQ:6}",
            "description": "物料编码规则，格式：MAT + 6位序号",
            "seq_start": 1,
            "seq_step": 1,
            "seq_reset_rule": "never",
            "is_system": True,
            "is_active": True,
        },
        {
            "name": "客户编码",
            "code": "customer",
            "expression": "CUST{SEQ:5}",
            "description": "客户编码规则，格式：CUST + 5位序号",
            "seq_start": 1,
            "seq_step": 1,
            "seq_reset_rule": "never",
            "is_system": True,
            "is_active": True,
        },
        {
            "name": "供应商编码",
            "code": "supplier",
            "expression": "SUP{SEQ:5}",
            "description": "供应商编码规则，格式：SUP + 5位序号",
            "seq_start": 1,
            "seq_step": 1,
            "seq_reset_rule": "never",
            "is_system": True,
            "is_active": True,
        },
        {
            "name": "生产任务编码",
            "code": "production_task",
            "expression": "PT{YYYYMMDD}{SEQ:4}",
            "description": "生产任务编码规则，格式：PT + 日期（YYYYMMDD）+ 4位序号",
            "seq_start": 1,
            "seq_step": 1,
            "seq_reset_rule": "daily",
            "is_system": True,
            "is_active": True,
        },
    ]
    
    # 默认系统参数配置
    DEFAULT_SYSTEM_PARAMETERS = [
        {
            "key": "system.name",
            "value": "RiverEdge制造管理系统",
            "type": "string",
            "description": "系统名称",
            "is_system": True,
            "is_active": True,
        },
        {
            "key": "system.timezone",
            "value": "Asia/Shanghai",
            "type": "string",
            "description": "系统时区（默认中国时区）",
            "is_system": True,
            "is_active": True,
        },
        {
            "key": "system.currency",
            "value": "CNY",
            "type": "string",
            "description": "系统货币（默认人民币）",
            "is_system": True,
            "is_active": True,
        },
        {
            "key": "system.language",
            "value": "zh-CN",
            "type": "string",
            "description": "系统语言（默认简体中文）",
            "is_system": True,
            "is_active": True,
        },
        {
            "key": "system.date_format",
            "value": "YYYY-MM-DD",
            "type": "string",
            "description": "日期格式（默认：YYYY-MM-DD）",
            "is_system": True,
            "is_active": True,
        },
        {
            "key": "system.time_format",
            "value": "HH:mm:ss",
            "type": "string",
            "description": "时间格式（默认：HH:mm:ss）",
            "is_system": True,
            "is_active": True,
        },
        {
            "key": "system.datetime_format",
            "value": "YYYY-MM-DD HH:mm:ss",
            "type": "string",
            "description": "日期时间格式（默认：YYYY-MM-DD HH:mm:ss）",
            "is_system": True,
            "is_active": True,
        },
        {
            "key": "work_order.auto_approve",
            "value": False,
            "type": "boolean",
            "description": "工单是否自动审批（默认：否）",
            "is_system": False,
            "is_active": True,
        },
        {
            "key": "work_order.default_priority",
            "value": "normal",
            "type": "string",
            "description": "工单默认优先级（默认：normal）",
            "is_system": False,
            "is_active": True,
        },
        {
            "key": "production.enable_quality_check",
            "value": True,
            "type": "boolean",
            "description": "是否启用质量检验（默认：是）",
            "is_system": False,
            "is_active": True,
        },
        {
            "key": "inventory.enable_low_stock_alert",
            "value": True,
            "type": "boolean",
            "description": "是否启用库存不足预警（默认：是）",
            "is_system": False,
            "is_active": True,
        },
        {
            "key": "inventory.low_stock_threshold",
            "value": 10,
            "type": "number",
            "description": "库存不足预警阈值（默认：10）",
            "is_system": False,
            "is_active": True,
        },
    ]
    
    @staticmethod
    async def create_default_code_rules(tenant_id: int) -> List[Dict[str, Any]]:
        """
        为新组织创建默认编码规则
        
        Args:
            tenant_id: 组织ID
            
        Returns:
            List[Dict[str, Any]]: 创建的编码规则列表
        """
        created_rules = []
        
        for rule_config in DefaultValuesService.DEFAULT_CODE_RULES:
            try:
                rule_data = CodeRuleCreate(**rule_config)
                rule = await CodeRuleService.create_rule(tenant_id, rule_data)
                created_rules.append({
                    "code": rule.code,
                    "name": rule.name,
                    "uuid": rule.uuid,
                })
                logger.debug(f"为组织 {tenant_id} 创建默认编码规则: {rule.code}")
            except Exception as e:
                # 如果规则已存在，跳过（避免重复创建）
                logger.warning(f"为组织 {tenant_id} 创建编码规则 {rule_config['code']} 失败: {e}")
                continue
        
        logger.info(f"为组织 {tenant_id} 创建了 {len(created_rules)} 个默认编码规则")
        return created_rules
    
    @staticmethod
    async def create_default_system_parameters(tenant_id: int) -> List[Dict[str, Any]]:
        """
        为新组织创建默认系统参数
        
        Args:
            tenant_id: 组织ID
            
        Returns:
            List[Dict[str, Any]]: 创建的系统参数列表
        """
        created_parameters = []
        
        for param_config in DefaultValuesService.DEFAULT_SYSTEM_PARAMETERS:
            try:
                param_data = SystemParameterCreate(**param_config)
                parameter = await SystemParameterService.create_parameter(tenant_id, param_data)
                created_parameters.append({
                    "key": parameter.key,
                    "value": parameter.get_value(),
                    "uuid": parameter.uuid,
                })
                logger.debug(f"为组织 {tenant_id} 创建默认系统参数: {parameter.key}")
            except Exception as e:
                # 如果参数已存在，跳过（避免重复创建）
                logger.warning(f"为组织 {tenant_id} 创建系统参数 {param_config['key']} 失败: {e}")
                continue
        
        logger.info(f"为组织 {tenant_id} 创建了 {len(created_parameters)} 个默认系统参数")
        return created_parameters
    
    @staticmethod
    async def initialize_tenant_defaults(tenant_id: int) -> Dict[str, Any]:
        """
        初始化组织的默认配置
        
        为新组织创建所有默认配置，包括：
        - 编码规则
        - 系统参数
        
        Args:
            tenant_id: 组织ID
            
        Returns:
            Dict[str, Any]: 初始化结果
        """
        logger.info(f"开始为组织 {tenant_id} 初始化默认配置")
        
        # 创建默认编码规则
        code_rules = await DefaultValuesService.create_default_code_rules(tenant_id)
        
        # 创建默认系统参数
        system_parameters = await DefaultValuesService.create_default_system_parameters(tenant_id)
        
        logger.info(f"组织 {tenant_id} 默认配置初始化完成")
        
        return {
            "tenant_id": tenant_id,
            "code_rules": code_rules,
            "system_parameters": system_parameters,
            "code_rules_count": len(code_rules),
            "system_parameters_count": len(system_parameters),
        }

