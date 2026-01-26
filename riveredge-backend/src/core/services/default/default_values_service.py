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
from core.config.code_rule_pages import CODE_RULE_PAGES


class DefaultValuesService:
    """
    默认值服务类
    
    为新组织提供默认配置。
    """
    
    # 默认编码规则配置（符合中国制造业通用实践）
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
            "name": "产品编码",
            "code": "product",
            "expression": "PRD{SEQ:6}",
            "description": "产品编码规则，格式：PRD + 6位序号",
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
            "name": "采购单编码",
            "code": "purchase_order",
            "expression": "PO{YYYYMMDD}{SEQ:4}",
            "description": "采购单编码规则，格式：PO + 日期（YYYYMMDD）+ 4位序号",
            "seq_start": 1,
            "seq_step": 1,
            "seq_reset_rule": "daily",
            "is_system": True,
            "is_active": True,
        },
        {
            "name": "销售单编码",
            "code": "sales_order",
            "expression": "SO{YYYYMMDD}{SEQ:4}",
            "description": "销售单编码规则，格式：SO + 日期（YYYYMMDD）+ 4位序号",
            "seq_start": 1,
            "seq_step": 1,
            "seq_reset_rule": "daily",
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
    
    # 默认系统参数配置（符合中国制造业通用实践）
    DEFAULT_SYSTEM_PARAMETERS = [
        # 系统基本信息
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
        # 工单相关参数
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
            "description": "工单默认优先级（默认：normal，可选值：low/normal/high/urgent）",
            "is_system": False,
            "is_active": True,
        },
        # 生产相关参数
        {
            "key": "production.enable_quality_check",
            "value": True,
            "type": "boolean",
            "description": "是否启用质量检验（默认：是）",
            "is_system": False,
            "is_active": True,
        },
        {
            "key": "production.default_workshop_id",
            "value": None,
            "type": "number",
            "description": "默认车间ID（可选，创建工单时的默认车间）",
            "is_system": False,
            "is_active": True,
        },
        # 库存相关参数
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
        {
            "key": "inventory.default_warehouse_id",
            "value": None,
            "type": "number",
            "description": "默认仓库ID（可选，库存操作的默认仓库）",
            "is_system": False,
            "is_active": True,
        },
        {
            "key": "inventory.enable_batch_management",
            "value": False,
            "type": "boolean",
            "description": "是否启用批次管理（默认：否，根据行业需要启用）",
            "is_system": False,
            "is_active": True,
        },
        # 质量相关参数
        {
            "key": "quality.default_qualification_rate",
            "value": 0.95,
            "type": "number",
            "description": "默认合格率（默认：95%，即0.95）",
            "is_system": False,
            "is_active": True,
        },
        {
            "key": "quality.enable_auto_reject",
            "value": False,
            "type": "boolean",
            "description": "是否启用自动拒收（默认：否，质量检验不合格时自动拒收）",
            "is_system": False,
            "is_active": True,
        },
        # 采购相关参数
        {
            "key": "purchase.require_approval",
            "value": True,
            "type": "boolean",
            "description": "采购单是否需要审批（默认：是）",
            "is_system": False,
            "is_active": True,
        },
        {
            "key": "purchase.default_payment_term",
            "value": "月结30天",
            "type": "string",
            "description": "默认付款条件（默认：月结30天）",
            "is_system": False,
            "is_active": True,
        },
        # 销售相关参数
        {
            "key": "sales.require_approval",
            "value": True,
            "type": "boolean",
            "description": "销售单是否需要审批（默认：是）",
            "is_system": False,
            "is_active": True,
        },
        {
            "key": "sales.default_payment_term",
            "value": "月结30天",
            "type": "string",
            "description": "默认收款条件（默认：月结30天）",
            "is_system": False,
            "is_active": True,
        },
    ]
    
    # 页面功能缩写映射表
    PAGE_CODE_ABBREVIATIONS = {
        # 主数据管理 - 工厂建模
        "master-data-factory-plant": "PLANT",
        "master-data-factory-workshop": "WS",
        "master-data-factory-production-line": "PL",
        "master-data-factory-workstation": "WST",
        # 主数据管理 - 仓库管理
        "master-data-warehouse-warehouse": "WH",
        "master-data-warehouse-storage-area": "SA",
        "master-data-warehouse-storage-location": "SL",
        # 主数据管理 - 物料管理
        "master-data-material-group": "MG",
        "master-data-material": "MAT",
        # 主数据管理 - 工艺管理
        "master-data-process-operation": "OP",
        "master-data-process-route": "PR",
        "master-data-defect-type": "DF",
        # 主数据管理 - 供应链
        "master-data-supply-chain-customer": "CUST",
        "master-data-supply-chain-supplier": "SUP",
        # 主数据管理 - 绩效管理
        "master-data-performance-skill": "SK",
        # 快格轻制造 - 生产执行
        "kuaizhizao-production-work-order": "WO",
        "kuaizhizao-production-rework-order": "RWO",
        "kuaizhizao-production-outsource-order": "OO",
        "kuaizhizao-production-outsource-work-order": "OWO",
        # 快格轻制造 - 采购管理
        "kuaizhizao-purchase-order": "PO",
        "kuaizhizao-purchase-receipt": "PREC",
        "kuaizhizao-purchase-return": "PRT",
        # 快格轻制造 - 销售管理
        "kuaizhizao-sales-order": "SO",
        "kuaizhizao-sales-delivery": "SD",
        "kuaizhizao-sales-forecast": "SF",
        "kuaizhizao-sales-return": "SRT",
        # 快格轻制造 - 仓储管理
        "kuaizhizao-warehouse-inbound": "PM",  # Production Material (生产领料)
        "kuaizhizao-warehouse-finished-goods-inbound": "FGR",  # Finished Goods Receipt (成品入库)
        "kuaizhizao-warehouse-sales-outbound": "SOB",
        # 快格轻制造 - 质量管理
        "kuaizhizao-quality-incoming-inspection": "II",
        "kuaizhizao-quality-process-inspection": "QI",  # Quality Inspection (过程检验)
        "kuaizhizao-quality-finished-goods-inspection": "FGI",  # Finished Goods Inspection (成品检验)
        # 快格轻制造 - 计划管理
        "kuaizhizao-plan-production-plan": "PP",
    }
    
    @staticmethod
    def _is_business_document(page_code: str) -> bool:
        """
        判断页面是否为业务单据
        
        Args:
            page_code: 页面代码
            
        Returns:
            bool: 是否为业务单据
        """
        # 业务单据通常以 kuaizhizao- 开头（除了物料管理）
        return page_code.startswith("kuaizhizao-")
    
    @staticmethod
    def _build_rule_components(page_code: str, abbreviation: str) -> List[Dict[str, Any]]:
        """
        构建规则组件列表
        
        Args:
            page_code: 页面代码
            abbreviation: 功能缩写
            
        Returns:
            List[Dict[str, Any]]: 规则组件列表
        """
        components = []
        order = 0
        
        # 1. 固定文本（功能缩写）
        components.append({
            "type": "fixed_text",
            "order": order,
            "text": abbreviation,
        })
        order += 1
        
        # 2. 如果是业务单据，添加日期组件
        if DefaultValuesService._is_business_document(page_code):
            components.append({
                "type": "date",
                "order": order,
                "format_type": "preset",
                "preset_format": "YYYYMMDD",
            })
            order += 1
        
        # 3. 自动计数组件（必选）
        components.append({
            "type": "auto_counter",
            "order": order,
            "digits": 4,
            "fixed_width": True,
            "reset_cycle": "daily" if DefaultValuesService._is_business_document(page_code) else "never",
            "initial_value": 1,
        })
        
        return components
    
    @staticmethod
    async def create_default_code_rules(tenant_id: int) -> List[Dict[str, Any]]:
        """
        为新组织创建默认编码规则
        
        根据CODE_RULE_PAGES配置，为每个页面创建预设的编码规则：
        - 基础数据：功能缩写+流水号
        - 业务单据：功能缩写+年月日+流水号
        
        Args:
            tenant_id: 组织ID
            
        Returns:
            List[Dict[str, Any]]: 创建的编码规则列表
        """
        created_rules = []
        
        # 1. 创建旧的默认编码规则（向后兼容）
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
        
        # 2. 为每个页面创建预设编码规则（使用新的组件格式）
        for page_config in CODE_RULE_PAGES:
            page_code = page_config.get("page_code")
            page_name = page_config.get("page_name", page_code)
            rule_code = page_config.get("rule_code")
            
            # 如果没有指定rule_code，使用page_code作为rule_code
            if not rule_code:
                rule_code = page_code.upper().replace("-", "_")
            
            # 获取功能缩写
            abbreviation = DefaultValuesService.PAGE_CODE_ABBREVIATIONS.get(page_code)
            if not abbreviation:
                # 如果没有定义缩写，从page_code提取
                parts = page_code.split("-")
                abbreviation = "".join([p[0].upper() for p in parts[-2:]])[:4]
            
            # 构建规则组件
            rule_components = DefaultValuesService._build_rule_components(page_code, abbreviation)
            
            # 判断是否为业务单据
            is_business = DefaultValuesService._is_business_document(page_code)
            
            # 构建规则名称和描述
            rule_name = f"{page_name}编码规则"
            if is_business:
                description = f"{page_name}编码规则，格式：{abbreviation} + 日期（YYYYMMDD）+ 4位序号，每日重置"
            else:
                description = f"{page_name}编码规则，格式：{abbreviation} + 4位序号"
            
            try:
                rule_data = CodeRuleCreate(
                    name=rule_name,
                    code=rule_code,
                    rule_components=rule_components,
                    description=description,
                    is_system=True,
                    is_active=True,
                )
                rule = await CodeRuleService.create_rule(tenant_id, rule_data)
                created_rules.append({
                    "code": rule.code,
                    "name": rule.name,
                    "uuid": rule.uuid,
                })
                logger.debug(f"为组织 {tenant_id} 创建页面编码规则: {rule.code} ({page_name})")
            except Exception as e:
                # 如果规则已存在，跳过（避免重复创建）
                logger.warning(f"为组织 {tenant_id} 创建页面编码规则 {rule_code} 失败: {e}")
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

