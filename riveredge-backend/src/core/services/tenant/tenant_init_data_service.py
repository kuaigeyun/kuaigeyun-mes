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

    # 必选初始化项（租户「初始项加载」与新建组织 run_required 执行；不含应用注册）
    INIT_ITEMS_REQUIRED: List[Dict[str, Any]] = [
        {
            "key": "language",
            "name": "系统语言",
            "description": "简体中文、English 等系统语言",
        },
        {
            "key": "data_dictionary",
            "name": "数据字典",
            "description": "CURRENCY、TIMEZONE 及已安装应用归属的系统字典",
        },
        {
            "key": "system_parameter",
            "name": "系统参数",
            "description": "系统名称、时区、货币等参数（必选）",
        },
        {"key": "code_rule", "name": "编码规则", "description": "工单、物料、销售单等编码规则"},
        {"key": "approval_process_preset", "name": "审核设置绑定行", "description": "为可审核单据初始化配置行（流程在启用开关时按需创建）"},
        {"key": "message_template_preset", "name": "消息模板预设", "description": "审批通知、验证码等消息模板"},
        {"key": "print_template_preset", "name": "打印模板预设", "description": "通用标签、收据等打印模板"},
        {
            "key": "menu_sync",
            "name": "应用菜单同步",
            "description": "按已安装应用将 manifest 菜单写入侧栏（不安装/启用应用，由平台管理员处理）",
        },
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
        {
            "key": "kuaiai_faq_preset",
            "name": "KU-AI 默认 FAQ",
            "description": "生产工单、报工、委外、库存等 15 条出厂操作问答",
        },
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
                "kuaiai_faq_preset",
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
                "kuaiai_faq_preset",
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
                count = await cls.run_single(tenant_id, key)
                results[key] = {"success": True, "created": count}
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
            result = await DataDictionaryService.initialize_system_dictionaries_for_installed_apps(
                tenant_id
            )
            return result.get("dictionaries_count", 0) + result.get("items_created_count", 0)

        if key == "language":
            from core.services.system.language_service import LanguageService
            result = await LanguageService.initialize_system_languages(tenant_id)
            return result.get("created_count", 0)

        if key == "application":
            from core.services.application.application_service import ApplicationService
            apps = await ApplicationService.scan_and_register_plugins(tenant_id=tenant_id)
            return len(apps)

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
            from core.services.approval.audit_binding_service import AuditBindingService

            return await AuditBindingService.ensure_binding_rows(tenant_id)

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
                from apps.haoligo.services.haoligo_notification_rule_presets import (
                    load_haoligo_notification_rule_presets,
                )

                preset_rules = await load_haoligo_notification_rule_presets(tenant_id)
                count += int(preset_rules.get("created") or 0)
            return count

        if key == "print_template_preset":
            from core.services.print.print_template_service import PrintTemplateService

            return await PrintTemplateService.load_all_preset_print_templates(tenant_id)

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

        if key == "menu_sync":
            from core.services.system.menu_service import MenuService
            return await MenuService.sync_all_menus_from_applications(tenant_id)

        if key == "kuaiai_faq_preset":
            from apps.kuaiai.services.faq_seed_service import FaqSeedService

            return await FaqSeedService.seed_default_faqs(
                tenant_id,
                user_id=current_user_id,
            )

        raise ValueError(f"未知的初始化项: {key}")

    BOOTSTRAP_APPLICATION_STEP: Dict[str, str] = {
        "key": "application",
        "name": "应用注册与启用",
        "description": "扫描并安装默认基础应用（快制造、快研发、快财务、主数据等）",
    }

    @classmethod
    def bootstrap_step_keys(cls) -> List[str]:
        return [cls.BOOTSTRAP_APPLICATION_STEP["key"]] + [
            item["key"] for item in cls.INIT_ITEMS_REQUIRED
        ]

    @classmethod
    def get_bootstrap_steps(cls) -> List[Dict[str, str]]:
        return [cls.BOOTSTRAP_APPLICATION_STEP, *cls.INIT_ITEMS_REQUIRED]

    @classmethod
    async def get_bootstrap_status(cls, tenant_id: int) -> Dict[str, Any]:
        from infra.models.tenant import Tenant

        tenant = await Tenant.get_or_none(id=tenant_id)
        settings = (tenant.settings or {}) if tenant else {}
        completed = bool(settings.get("bootstrap_completed") or settings.get("init_completed"))
        return {
            "pending": not completed,
            "bootstrap_completed": completed,
            "steps": cls.get_bootstrap_steps(),
        }

    @classmethod
    async def run_bootstrap_step(
        cls,
        tenant_id: int,
        key: str,
        current_user_id: Optional[int] = None,
    ) -> Dict[str, Any]:
        if key not in cls.bootstrap_step_keys():
            raise ValueError(f"不支持的引导步骤: {key}")
        count = await cls.run_single(tenant_id, key, current_user_id)
        return {"success": True, "created": count}

    @classmethod
    async def complete_bootstrap(cls, tenant_id: int) -> None:
        from datetime import datetime

        from infra.models.tenant import Tenant
        from infra.services.init_wizard_service import InitWizardService

        tenant = await Tenant.get_or_none(id=tenant_id)
        if not tenant:
            raise ValueError("组织不存在")

        settings = dict(tenant.settings or {})
        if settings.get("bootstrap_completed"):
            return

        if tenant.name:
            from core.schemas.site_setting import SiteSettingUpdate
            from core.services.system.site_setting_service import SiteSettingService

            await SiteSettingService.update_settings(
                tenant_id,
                SiteSettingUpdate(settings={"site_name": tenant.name}),
            )

        await InitWizardService().apply_default_init_settings(tenant_id)

        tenant = await Tenant.get_or_none(id=tenant_id)
        settings = dict((tenant.settings or {}) if tenant else {})
        settings["bootstrap_completed"] = True
        settings["bootstrap_completed_at"] = datetime.now().isoformat()
        await Tenant.filter(id=tenant_id).update(settings=settings)
        logger.info(f"组织 {tenant_id} 首次引导初始化完成")

