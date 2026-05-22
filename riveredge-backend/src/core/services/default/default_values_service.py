"""
默认值服务模块

为新组织提供默认配置，包括编码规则、系统参数等。

Author: Luigi Lu
Date: 2025-01-15
"""

from typing import List, Dict, Any, Optional
from loguru import logger

import asyncio

from core.models.code_rule import CodeRule
from core.services.business.code_rule_service import CodeRuleService
from core.services.system.system_parameter_service import SystemParameterService
from core.schemas.code_rule import CodeRuleCreate
from core.schemas.system_parameter import SystemParameterCreate
from core.config.code_rule_pages import CODE_RULE_PAGES, PAGE_CODE_TO_FIXED_TEXT_PRESET


class DefaultValuesService:
    """
    默认值服务类
    
    为新组织提供默认配置。
    """
    
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
    
    # 页面功能缩写映射表（统一使用 code_rule_pages 的拼音缩写，确保主数据=拼音+4位流水，快格=拼音+YYYYMMDD+4位流水）
    # 与 PAGE_CODE_TO_FIXED_TEXT_PRESET 保持一致，单据缩写不重复
    PAGE_CODE_ABBREVIATIONS = PAGE_CODE_TO_FIXED_TEXT_PRESET
    
    @staticmethod
    def _is_business_document(page_code: str) -> bool:
        """
        判断页面是否为业务单据
        
        Args:
            page_code: 页面代码
            
        Returns:
            bool: 是否为业务单据
        """
        # 业务单据：快格轻制造 / 轻管理会计（格式：缩写 + YYYYMMDD + 流水）
        return page_code.startswith("kuaizhizao-") or page_code.startswith("kuaicaiwu-")
    
    @staticmethod
    def _build_rule_components(page_code: str, abbreviation: str, page_config: Dict[str, Any] = None) -> List[Dict[str, Any]]:
        """
        构建规则组件列表
        
        Args:
            page_code: 页面代码
            abbreviation: 功能缩写
            page_config: 页面配置（可选，用于 skip_date 等）
            
        Returns:
            List[Dict[str, Any]]: 规则组件列表
        """
        # 物料主编码：末级物料分组编号 + 流水（隔离字段 group_code = 末级分组编号）
        if page_code == "master-data-material":
            return [
                {"type": "form_field", "order": 0, "field_name": "group_code"},
                {
                    "type": "auto_counter",
                    "order": 1,
                    "digits": 4,
                    "fixed_width": True,
                    "reset_cycle": "never",
                    "initial_value": 1,
                    "scope_fields": ["group_code"],
                },
            ]

        # BOM编码：BOM-物料编码-版本号
        if page_code == "master-data-engineering-bom":
            return [
                {"type": "fixed_text", "order": 0, "text": "BOM"},
                {"type": "fixed_text", "order": 1, "text": "-"},
                {"type": "form_field", "order": 2, "field_name": "material_code"},
                {"type": "fixed_text", "order": 3, "text": "-"},
                {"type": "form_field", "order": 4, "field_name": "version"},
            ]

        components = []
        order = 0

        # 1. 固定文本（功能缩写）
        components.append({
            "type": "fixed_text",
            "order": order,
            "text": abbreviation,
        })
        order += 1

        pc = page_config or {}
        skip_date = pc.get("skip_date", False)
        # 2. 日期：快格等业务单据、或页面显式 include_date_in_code（如好力 GO 模具单据：简称+YYMMDD+流水）
        use_date = (
            DefaultValuesService._is_business_document(page_code) and not skip_date
        ) or (bool(pc.get("include_date_in_code")) and not skip_date)
        if use_date:
            preset_format = pc.get("code_date_preset_format", "YYYYMMDD")
            components.append({
                "type": "date",
                "order": order,
                "format_type": "preset",
                "preset_format": preset_format,
            })
            order += 1

        # 3. 自动计数（位数、重置周期可配置；默认 4 位、有日期则按日重置）
        digits = int(pc.get("code_counter_digits", 4))
        reset_cycle = "daily" if use_date else "never"
        components.append({
            "type": "auto_counter",
            "order": order,
            "digits": digits,
            "fixed_width": True,
            "reset_cycle": reset_cycle,
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
            rule_components = DefaultValuesService._build_rule_components(page_code, abbreviation, page_config)
            
            # 判断是否为业务单据（设备/模具/工装配置 skip_date 时按基础数据处理）
            skip_date = page_config.get("skip_date", False)
            is_business = DefaultValuesService._is_business_document(page_code) and not skip_date

            # 构建规则名称和描述（物料、BOM 使用自定义描述；页面可覆盖 code_rule_description）
            rule_name = f"{page_name}编码规则"
            if page_config.get("code_rule_description"):
                description = page_config["code_rule_description"]
            elif page_code == "master-data-material":
                description = "物料主编码规则，格式：分组编码 + 4位流水，不自动重置"
            elif page_code == "master-data-engineering-bom":
                description = "BOM编码规则，格式：BOM-物料编码-版本号"
            elif is_business:
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
    async def ensure_code_rule_for_page(tenant_id: int, page_code: str) -> bool:
        """
        确保指定页面的编码规则存在，若不存在则创建（用于已有组织补建缺失规则）。
        
        Returns:
            True 表示新建了规则，False 表示规则已存在未创建。
        """
        from core.schemas.code_rule import CodeRuleCreate

        page_config = next((p for p in CODE_RULE_PAGES if p.get("page_code") == page_code), None)
        if not page_config:
            return False
        rule_code = page_config.get("rule_code") or page_code.upper().replace("-", "_")
        existing = await CodeRuleService.get_rule_by_code(tenant_id, rule_code, active_only=False)
        if existing:
            return False
        page_name = page_config.get("page_name", page_code)
        abbreviation = DefaultValuesService.PAGE_CODE_ABBREVIATIONS.get(
            page_code
        ) or "".join([p[0].upper() for p in page_code.split("-")[-2:]])[:4]
        rule_components = DefaultValuesService._build_rule_components(page_code, abbreviation, page_config)
        skip_date = page_config.get("skip_date", False)
        is_business = DefaultValuesService._is_business_document(page_code) and not skip_date
        rule_name = f"{page_name}编码规则"
        if page_config.get("code_rule_description"):
            description = page_config["code_rule_description"]
        elif page_code == "master-data-material":
            description = "物料主编码规则，格式：分组编码 + 4位流水，不自动重置"
        elif page_code == "master-data-engineering-bom":
            description = "BOM编码规则，格式：BOM-物料编码-版本号"
        else:
            description = (
                f"{page_name}编码规则，格式：{abbreviation} + 日期（YYYYMMDD）+ 4位序号，每日重置"
                if is_business
                else f"{page_name}编码规则，格式：{abbreviation} + 4位序号"
            )
        try:
            rule_data = CodeRuleCreate(
                name=rule_name,
                code=rule_code,
                rule_components=rule_components,
                description=description,
                is_system=True,
                is_active=True,
            )
            await CodeRuleService.create_rule(tenant_id, rule_data)
            logger.info(f"为组织 {tenant_id} 补建编码规则: {rule_code} ({page_name})")
            return True
        except Exception as e:
            logger.warning(f"为组织 {tenant_id} 补建编码规则 {rule_code} 失败: {e}")
            return False

    @staticmethod
    async def restore_preset_for_page(
        tenant_id: int,
        page_code: str,
        *,
        cached_rule: Optional[CodeRule] = None,
    ) -> bool:
        """
        恢复指定页面的预设编码规则（创建或更新为预设格式）。
        主数据：拼音缩写+4位流水；快格轻制造：拼音缩写+YYYYMMDD+4位流水。
        
        Args:
            tenant_id: 租户 ID
            page_code: 页面代码
            cached_rule: 若已从批量查询带入则跳过按 code 查询（加速「加载预设」全量）
        
        Returns:
            True 表示创建或更新成功，False 表示页面不存在或失败。
        """
        from core.schemas.code_rule import CodeRuleCreate, CodeRuleUpdate

        page_config = next((p for p in CODE_RULE_PAGES if p.get("page_code") == page_code), None)
        if not page_config:
            return False
        rule_code = page_config.get("rule_code") or page_code.upper().replace("-", "_")
        page_name = page_config.get("page_name", page_code)
        abbreviation = DefaultValuesService.PAGE_CODE_ABBREVIATIONS.get(
            page_code
        ) or "".join([p[0].upper() for p in page_code.split("-")[-2:]])[:4]
        rule_components = DefaultValuesService._build_rule_components(page_code, abbreviation, page_config)
        skip_date = page_config.get("skip_date", False)
        is_business = DefaultValuesService._is_business_document(page_code) and not skip_date
        rule_name = f"{page_name}编码规则"
        # 物料、BOM 使用自定义描述；页面可覆盖 code_rule_description
        if page_config.get("code_rule_description"):
            description = page_config["code_rule_description"]
        elif page_code == "master-data-material":
            description = "物料主编码规则，格式：分组编码 + 4位流水，不自动重置"
        elif page_code == "master-data-engineering-bom":
            description = "BOM编码规则，格式：BOM-物料编码-版本号"
        else:
            description = (
                f"{page_name}编码规则，格式：{abbreviation} + 日期（YYYYMMDD）+ 4位序号，每日重置"
                if is_business
                else f"{page_name}编码规则，格式：{abbreviation} + 4位序号"
            )
        if cached_rule is not None:
            existing = cached_rule
        else:
            existing = await CodeRuleService.get_rule_by_code(tenant_id, rule_code, active_only=False)
        if existing:
            update_data = CodeRuleUpdate(
                name=rule_name,
                rule_components=rule_components,
                description=description,
                is_active=True,
            )
            await CodeRuleService.update_rule(tenant_id, existing.uuid, update_data)
            logger.info(f"为组织 {tenant_id} 恢复预设编码规则: {rule_code} ({page_name})")
        else:
            rule_data = CodeRuleCreate(
                name=rule_name,
                code=rule_code,
                rule_components=rule_components,
                description=description,
                is_system=True,
                is_active=True,
            )
            await CodeRuleService.create_rule(tenant_id, rule_data)
            logger.info(f"为组织 {tenant_id} 创建预设编码规则: {rule_code} ({page_name})")
        return True

    @staticmethod
    async def restore_all_preset_pages(tenant_id: int) -> List[str]:
        """
        为 CODE_RULE_PAGES 中全部页面批量恢复预设规则。
        一次查询现有规则 + 受控并发写入，缩短「加载预设」耗时。
        """
        entries: List[tuple[str, str]] = []
        for p in CODE_RULE_PAGES:
            pc = p.get("page_code")
            if not pc:
                continue
            rc = p.get("rule_code") or pc.upper().replace("-", "_")
            entries.append((pc, rc))
        if not entries:
            return []
        codes = [rc for _, rc in entries]
        existing_map = await CodeRuleService.map_rules_by_codes(tenant_id, codes)
        sem = asyncio.Semaphore(16)

        async def run(pc: str, rc: str) -> Optional[str]:
            async with sem:
                ok = await DefaultValuesService.restore_preset_for_page(
                    tenant_id,
                    pc,
                    cached_rule=existing_map.get(rc),
                )
                return pc if ok else None

        results = await asyncio.gather(*[run(pc, rc) for pc, rc in entries])
        return [pc for pc in results if pc]

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

