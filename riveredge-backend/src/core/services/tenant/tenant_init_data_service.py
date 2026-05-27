"""
租户初始化数据服务模块

统一管理数据字典、编码规则、部门/职位/角色、审批流程、消息模板等默认加载功能。
支持必选/可选划分，在新建租户初始化时按需选择。

Author: RiverEdge
"""

from typing import List, Dict, Any, Optional
from loguru import logger


class TenantInitDataService:
    """
    租户初始化数据服务类

    集中管理所有初始化项，支持必选/可选执行。
    """

    # 必选初始化项（系统级默认加载，新建组织时 100% 执行）
    INIT_ITEMS_REQUIRED: List[Dict[str, Any]] = [
        {
            "key": "data_dictionary",
            "name": "数据字典",
            "description": "CURRENCY、TIMEZONE 等基础字典（初始化向导依赖）",
        },
        {
            "key": "language",
            "name": "系统语言",
            "description": "简体中文、English 等系统语言",
        },
        {
            "key": "application",
            "name": "应用注册",
            "description": "扫描并自动安装、启用应用中心免费应用",
        },
        {
            "key": "system_parameter",
            "name": "系统参数",
            "description": "系统名称、时区、货币等参数（必选）",
        },
        {"key": "code_rule", "name": "编码规则", "description": "工单、物料、销售单等编码规则"},
        {"key": "approval_process_preset", "name": "审批流程预设", "description": "采购单、销售单等审批流程"},
        {"key": "message_template_preset", "name": "消息模板预设", "description": "审批通知、验证码等消息模板"},
        {"key": "print_template_preset", "name": "打印模板预设", "description": "通用标签、收据等打印模板"},
    ]

    # 可选初始化项（业务预设，新建组织时由用户勾选是否加载）
    INIT_ITEMS_OPTIONAL: List[Dict[str, Any]] = [
        {"key": "department_preset", "name": "部门预设", "description": "中国中小制造业极简部门结构"},
        {"key": "position_preset", "name": "职位预设", "description": "总经理、生产经理等常用职位"},
        {"key": "role_preset", "name": "角色预设", "description": "部门经理、普通员工等常用角色"},
        {"key": "warehouse_preset", "name": "仓库预设", "description": "原料仓、成品仓、半成品仓、不良品仓等"},
        {
            "key": "operation_preset",
            "name": "工序预设",
            "description": "已改为在「工序管理」中按行业加载；勾选此项不会自动写入数据，请到工序页选择行业与工序预设。",
        },
        {"key": "variant_attribute_preset", "name": "属性定义预设", "description": "颜色、规格、材质、等级、表面处理等"},
    ]

    # 行业预设模板（一键建账）
    INDUSTRY_PRESETS: Dict[str, Dict[str, Any]] = {
        "sme_manufacturing": {
            "name": "离散制造通用版",
            "description": "适用于一般的五金、机械、注塑等离散制造企业。",
            "keys": [
                "department_preset",
                "position_preset",
                "role_preset",
                "warehouse_preset",
                "operation_preset",
            ]
        },
        "electronics_assembly": {
            "name": "电子组装版",
            "description": "适用于 PCBA、3C 类电子产品组装与测试。",
            "keys": [
                "department_preset",
                "position_preset",
                "role_preset",
                "warehouse_preset",
                "operation_preset",
                "variant_attribute_preset",
            ]
        }
    }

    @classmethod
    def get_init_items_config(cls) -> Dict[str, Any]:
        """
        获取初始化项配置（供前端展示）

        Returns:
            dict: 包含 required 和 optional 的配置
        """
        return {
            "required": cls.INIT_ITEMS_REQUIRED,
            "optional": cls.INIT_ITEMS_OPTIONAL,
        }

    @classmethod
    async def run_required(cls, tenant_id: int) -> Dict[str, Any]:
        """
        执行必选初始化项

        Args:
            tenant_id: 组织ID

        Returns:
            dict: 执行结果
        """
        results = {}
        for item in cls.INIT_ITEMS_REQUIRED:
            key = item["key"]
            try:
                await cls.run_single(tenant_id, key)
                results[key] = {"success": True}
            except Exception as e:
                logger.error(f"必选初始化 {key} 失败: {e}")
                results[key] = {"success": False, "error": str(e)}
        return results

    @classmethod
    async def run_optional(
        cls,
        tenant_id: int,
        selected_keys: List[str],
        current_user_id: Optional[int] = None,
    ) -> Dict[str, Any]:
        """
        执行选中的可选初始化项

        Args:
            tenant_id: 组织ID
            selected_keys: 选中的初始化项 key 列表
            current_user_id: 当前用户ID（部门/职位/角色等需要）

        Returns:
            dict: 执行结果
        """
        valid_keys = {i["key"] for i in cls.INIT_ITEMS_OPTIONAL}
        results = {}
        for key in selected_keys:
            if key not in valid_keys:
                results[key] = {"success": False, "error": f"未知的初始化项: {key}"}
                continue
            try:
                count = await cls.run_single(tenant_id, key, current_user_id)
                results[key] = {"success": True, "created": count}
            except Exception as e:
                logger.error(f"可选初始化 {key} 失败: {e}")
                results[key] = {"success": False, "error": str(e)}
        return results

    @classmethod
    def get_industry_presets(cls) -> List[Dict[str, Any]]:
        """
        获取所有支持的行业预设模板
        
        Returns:
            List[Dict[str, Any]]: 行业预设列表
        """
        presets = []
        for code, config in cls.INDUSTRY_PRESETS.items():
            presets.append({
                "code": code,
                "name": config["name"],
                "description": config["description"],
                "keys": config["keys"]
            })
        return presets

    @classmethod
    async def run_industry_preset(
        cls, 
        tenant_id: int, 
        industry_code: str, 
        current_user_id: Optional[int] = None
    ) -> Dict[str, Any]:
        """
        根据行业代码执行一键预设初始化
        
        Args:
            tenant_id: 组织ID
            industry_code: 行业编码 (如 'sme_manufacturing')
            current_user_id: 当前操作用户ID
            
        Returns:
            Dict[str, Any]: 执行结果
            
        Raises:
            ValueError: 如果 industry_code 不存在
        """
        if industry_code not in cls.INDUSTRY_PRESETS:
            raise ValueError(f"不支持的行业预设代码: {industry_code}")
            
        preset_config = cls.INDUSTRY_PRESETS[industry_code]
        keys_to_run = preset_config["keys"]
        
        logger.info(f"开始执行行业预设初始化 [{industry_code}] -> {tenant_id}, 项: {keys_to_run}")
        
        return await cls.run_optional(
            tenant_id=tenant_id,
            selected_keys=keys_to_run,
            current_user_id=current_user_id
        )

    @classmethod
    async def run_single(
        cls,
        tenant_id: int,
        key: str,
        current_user_id: Optional[int] = None,
    ) -> int:
        """
        执行单个初始化项

        Args:
            tenant_id: 组织ID
            key: 初始化项 key
            current_user_id: 当前用户ID（部分项需要）

        Returns:
            int: 创建/更新的数量（部分项返回 0 表示成功）

        Raises:
            ValueError: 未知的 key
        """
        if key == "data_dictionary":
            from core.services.data.data_dictionary_service import DataDictionaryService
            result = await DataDictionaryService.initialize_system_dictionaries(tenant_id)
            return result.get("dictionaries_count", 0) + result.get("items_created_count", 0)

        if key == "language":
            from core.services.system.language_service import LanguageService
            result = await LanguageService.initialize_system_languages(tenant_id)
            return result.get("created_count", 0)

        if key == "application":
            from core.services.application.application_service import ApplicationService
            apps = await ApplicationService.scan_and_register_plugins(tenant_id=tenant_id)
            enabled = 0

            def _should_enable(app: dict) -> bool:
                app_code = str(app.get("code") or "")
                manifest = ApplicationService._get_manifest_by_code(app_code)
                is_pro = bool(manifest.get("is_pro", False)) if manifest else False
                return (
                    not is_pro
                    and app.get("is_installed")
                    and not app.get("is_active")
                    and app.get("uuid")
                )

            base_apps = [
                a for a in apps
                if ApplicationService.is_base_app_code(str(a.get("code") or ""))
            ]
            other_apps = [a for a in apps if a not in base_apps]

            for app in base_apps + other_apps:
                if not _should_enable(app):
                    continue
                try:
                    await ApplicationService.enable_application(
                        tenant_id, str(app["uuid"])
                    )
                    enabled += 1
                except Exception as e:
                    logger.error(
                        f"组织 {tenant_id} 启用应用 {app.get('code')} 失败: {e}"
                    )
            return len(apps) + enabled

        if key == "code_rule":
            from core.services.default.default_values_service import DefaultValuesService
            rules = await DefaultValuesService.create_default_code_rules(tenant_id)
            return len(rules)

        if key == "system_parameter":
            from core.services.default.default_values_service import DefaultValuesService
            params = await DefaultValuesService.create_default_system_parameters(tenant_id)
            return len(params)

        if key == "department_preset":
            from core.services.organization.department_service import DepartmentService
            return await DepartmentService.load_preset_sme(
                tenant_id, current_user_id or 0
            )

        if key == "position_preset":
            from core.services.authorization.position_service import PositionService
            return await PositionService.load_preset_sme(
                tenant_id, current_user_id or 0
            )

        if key == "role_preset":
            from core.services.authorization.role_service import RoleService
            return await RoleService.load_preset_sme(
                tenant_id, current_user_id or 0
            )

        if key == "approval_process_preset":
            from core.services.approval.approval_process_service import ApprovalProcessService
            from core.services.system.installed_feature_scope import (
                approval_process_codes_for_installed_apps,
                get_installed_application_codes,
            )
            installed = await get_installed_application_codes(tenant_id)
            return await ApprovalProcessService.load_preset_sme(
                tenant_id,
                only_codes=approval_process_codes_for_installed_apps(installed),
            )

        if key == "message_template_preset":
            from core.services.messaging.message_template_service import MessageTemplateService
            from core.services.system.installed_feature_scope import (
                get_installed_application_codes,
                message_template_codes_for_installed_apps,
            )
            installed = await get_installed_application_codes(tenant_id)
            count = await MessageTemplateService.load_preset_sme(
                tenant_id,
                only_codes=message_template_codes_for_installed_apps(installed),
            )
            if "haoligo" in installed:
                from apps.haoligo.services.haoligo_message_template_registry import (
                    load_haoligo_message_template_presets,
                )

                count += await load_haoligo_message_template_presets(tenant_id)
            return count

        if key == "print_template_preset":
            from core.services.print.print_template_service import PrintTemplateService
            from core.services.system.installed_feature_scope import get_installed_application_codes
            installed = await get_installed_application_codes(tenant_id)
            return await PrintTemplateService.load_preset_sme(
                tenant_id,
                installed_app_codes=installed,
            )

        if key == "warehouse_preset":
            from apps.master_data.services.warehouse_service import WarehouseService
            return await WarehouseService.load_preset_sme(tenant_id)

        if key == "operation_preset":
            from apps.master_data.services.process_service import ProcessService
            return await ProcessService.load_preset_operations_sme(tenant_id)

        if key == "variant_attribute_preset":
            from core.services.business.material_variant_attribute_service import MaterialVariantAttributeService
            return await MaterialVariantAttributeService.load_preset_sme(
                tenant_id, created_by=current_user_id
            )

        raise ValueError(f"未知的初始化项: {key}")
