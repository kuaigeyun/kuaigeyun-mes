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

    # 必选初始化项（系统运行必需，100% 加载）
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
            "description": "扫描并注册应用插件",
        },
        {
            "key": "system_parameter",
            "name": "系统参数",
            "description": "系统名称、时区、货币等参数（必选）",
        },
    ]

    # 可选初始化项（业务预设）
    INIT_ITEMS_OPTIONAL: List[Dict[str, Any]] = [
        {"key": "code_rule", "name": "编码规则", "description": "工单、物料、销售单等编码规则"},
        {"key": "department_preset", "name": "部门预设", "description": "中国中小制造业极简部门结构"},
        {"key": "position_preset", "name": "职位预设", "description": "总经理、生产经理等常用职位"},
        {"key": "role_preset", "name": "角色预设", "description": "部门经理、普通员工等常用角色"},
        {"key": "approval_process_preset", "name": "审批流程预设", "description": "采购单、销售单等审批流程"},
        {"key": "message_template_preset", "name": "消息模板预设", "description": "审批通知、验证码等消息模板"},
        {"key": "print_template_preset", "name": "打印模板预设", "description": "通用标签、收据等打印模板"},
    ]

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
            from core.services.approval.approval_process_service import ApprovalProcessService
            return await ApprovalProcessService.load_preset_sme(tenant_id)

        if key == "message_template_preset":
            from core.services.messaging.message_template_service import MessageTemplateService
            return await MessageTemplateService.load_preset_sme(tenant_id)

        if key == "print_template_preset":
            from core.services.print.print_template_service import PrintTemplateService
            return await PrintTemplateService.load_preset_sme(tenant_id)

        raise ValueError(f"未知的初始化项: {key}")
