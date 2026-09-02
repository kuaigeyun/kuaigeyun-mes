"""
动态数据库配置服务模块

提供动态生成Tortoise ORM配置的功能，不再依赖硬编码的应用模型列表。
通过查询数据库中活跃的应用来动态决定需要加载的模型模块。
时区配置统一从 infra.config.infra_config 读取。
"""

from typing import Dict, Any, List

from infra.config.infra_config import infra_settings as settings
from loguru import logger


class DynamicDatabaseConfigService:
    """
    动态数据库配置服务类

    动态生成Tortoise ORM配置，只加载活跃应用的模型。
    """

    @staticmethod
    async def generate_tortoise_config(
        enabled_codes: frozenset[str] | None = None,
    ) -> Dict[str, Any]:
        """
        动态生成 Tortoise ORM 配置。

        enabled_codes 为 None 时仅含平台基线模型（启动引导阶段，用于查应用中心）；
        传入 frozenset 时并入对应应用的 ORM 声明。
        """
        logger.info("🔧 开始生成动态数据库配置...")

        config = {
            "connections": {
                "default": {
                    "engine": "tortoise.backends.asyncpg",
                    "credentials": {
                        "host": None,
                        "port": None,
                        "user": None,
                        "password": None,
                        "database": None,
                    }
                }
            },
            "apps": {
                "models": {
                    "models": await DynamicDatabaseConfigService._get_active_models(
                        enabled_codes
                    ),
                    "default_connection": "default",
                }
            },
            "use_tz": settings.USE_TZ,
            "timezone": settings.TIMEZONE,
        }

        logger.info("✅ 动态数据库配置生成完成")
        return config

    @staticmethod
    async def _get_base_model_paths() -> List[str]:
        """平台基线模型（core + infra + aerich），不含任何业务应用 ORM。"""
        base_models = [
            "core.models.application",
            "core.models.menu",
            "core.models.tenant_backend_home",
            "core.models.role",
            "core.models.permission",
            "core.models.permission_alias",
            "core.models.field_name_alias",
            "core.models.data_permission_policy",
            "core.models.user_data_scope_binding",
            "core.models.field_permission_policy",
            "core.models.access_policy",
            "core.models.policy_binding",
            "core.models.permission_version",
            "core.models.user_role",
            "core.models.role_permission",
            "core.models.user_preference",
            "core.models.operation_log",
            "core.models.login_log",
            "core.models.ai_audit_log",
            "core.models.user_activity",
            "core.models.cache_entry",
            "core.models.data_dictionary",
            "core.models.dictionary_item",
            "core.models.system_parameter",
            "core.models.code_rule",
            "core.models.code_sequence",
            "core.models.batch_rule",
            "core.models.batch_rule_sequence",
            "core.models.serial_rule",
            "core.models.serial_rule_sequence",
            "core.models.material_code_rule",
            "core.models.material_variant_attribute",
            "core.models.custom_field",
            "core.models.custom_field_value",
            "core.models.site_setting",
            "core.models.invitation_code",
            "core.models.language",
            "core.models.client_product",
            "core.models.client_release",
            "core.models.integration_config",
            "core.models.file",
            "core.models.file_preview_markup",
            "core.models.resource_category",
            "core.models.api",
            "core.models.dataset",
            "core.models.page_metric_config",
            "core.models.message_config",
            "core.models.message_template",
            "core.models.message_log",
            "core.models.mobile_push_device",
            "core.models.scheduled_task",
            "core.models.approval_process",
            "core.models.audit_document_binding",
            "core.models.approval_instance",
            "core.models.approval_task",
            "core.models.data_backup",
            "core.models.approval_history",
            "core.models.script",
            "core.models.print_template",
            "core.models.print_device",
            "core.models.department",
            "core.models.department_dataset_binding",
            "core.models.position",
            "infra.models.base",
            "infra.models.tenant",
            "infra.models.tenant_config",
            "infra.models.tenant_activity_log",
            "infra.models.user",
            "infra.models.infra_superadmin",
            "infra.models.package",
            "infra.models.sensitive_word_control",
            "infra.models.saved_search",
            "infra.models.industry_template",
            "infra.models.platform_settings",
            "infra.models.install_registration",
            "infra.models.official_api_library",
            "infra.models.invitation_code",
            "infra.models.biometric",
            "infra.models.face_template",
            "aerich.models",
        ]
        validated: List[str] = []
        for model_path in base_models:
            if DynamicDatabaseConfigService._module_exists(model_path):
                validated.append(model_path)
            else:
                logger.warning(f"⚠️ 基础模型不存在，跳过: {model_path}")
        return validated

    @staticmethod
    async def _get_active_models(
        enabled_codes: frozenset[str] | None = None,
    ) -> List[str]:
        """
        获取运行时模型模块列表。

        enabled_codes 为 None：仅平台基线（启动引导）。
        enabled_codes 为 frozenset：基线 + 启用集 ORM 声明。
        """
        validated_base_models = await DynamicDatabaseConfigService._get_base_model_paths()

        if enabled_codes is None:
            logger.info(
                f"📋 启动引导：仅平台基线 {len(validated_base_models)} 个模型模块"
            )
            return validated_base_models

        from infra.infrastructure.database.plugin_orm import discover_plugin_orm_modules

        plugin_orm = discover_plugin_orm_modules(enabled_codes)
        logger.info(f"📋 启用应用（含依赖）: {sorted(enabled_codes)}")
        logger.info(f"📋 启用应用 ORM 声明: {len(plugin_orm)} 个模块")

        merged: List[str] = []
        seen: set = set()
        for path in validated_base_models + plugin_orm:
            if path in seen:
                continue
            seen.add(path)
            merged.append(path)
        logger.info(
            f"📋 运行时 ORM 合并 {len(merged)} 个模块 "
            f"(基线: {len(validated_base_models)}, 启用应用: {len(plugin_orm)})"
        )
        return merged

    # 模块存在性缓存，避免重复 import 或 find_spec 调用
    _module_exists_cache: Dict[str, bool] = {}

    @staticmethod
    def _module_exists(module_path: str) -> bool:
        """
        检查Python模块是否存在。

        使用 find_spec 代替 import_module，仅解析模块路径不执行模块体，显著加快应用级模型的发现。
        结果缓存避免重复检查。

        Args:
            module_path: 模块路径

        Returns:
            bool: 模块是否存在
        """
        cache = DynamicDatabaseConfigService._module_exists_cache
        if module_path in cache:
            return cache[module_path]
        try:
            import importlib.util
            spec = importlib.util.find_spec(module_path)
            result = spec is not None
        except (ImportError, ValueError, AttributeError):
            result = False
        except Exception:
            result = False
        cache[module_path] = result
        return result

    @staticmethod
    async def validate_app_models(app_code: str) -> Dict[str, Any]:
        """
        验证应用的所有模型模块是否正确

        Args:
            app_code: 应用代码

        Returns:
            Dict[str, Any]: 验证结果
        """
        logger.info(f"🔍 验证应用 {app_code} 的模型模块...")

        result = {
            "app_code": app_code,
            "valid_models": [],
            "invalid_models": [],
            "total_models": 0,
            "is_valid": True
        }

        # 检查主模型模块
        main_model_path = f"apps.{app_code}.models"
        if DynamicDatabaseConfigService._module_exists(main_model_path):
            result["valid_models"].append(main_model_path)
        else:
            result["invalid_models"].append(main_model_path)
            result["is_valid"] = False

        # 检查可能的子模块
        possible_submodules = [
            "factory", "warehouse", "material", "process",
            "customer", "supplier", "performance", "product"
        ]

        for submodule in possible_submodules:
            submodule_path = f"apps.{app_code}.models.{submodule}"
            if DynamicDatabaseConfigService._module_exists(submodule_path):
                result["valid_models"].append(submodule_path)
            # 子模块不存在是正常的，不算错误

        result["total_models"] = len(result["valid_models"])

        if result["is_valid"]:
            logger.info(f"✅ 应用 {app_code} 模型验证通过，共 {result['total_models']} 个有效模块")
        else:
            logger.error(f"❌ 应用 {app_code} 模型验证失败，缺少主模型模块")

        return result

    @staticmethod
    async def get_model_dependencies() -> Dict[str, List[str]]:
        """
        获取模型依赖关系

        分析应用间的模型依赖，确保正确的加载顺序。

        Returns:
            Dict[str, List[str]]: 应用代码 -> 依赖应用列表 的映射
        """
        # 简化实现：假设没有复杂的依赖关系
        # 在实际项目中，可以通过分析模型的ForeignKey关系来确定依赖
        logger.info("🔗 分析模型依赖关系...")

        from .database import get_db_connection
        conn = await get_db_connection()
        try:
            # 查询所有活跃应用
            rows = await conn.fetch("""
                SELECT code, name
                FROM core_applications
                WHERE is_installed = TRUE
                  AND is_active = TRUE
                  AND deleted_at IS NULL
                ORDER BY sort_order, created_at
            """)

            # 简单的依赖关系：master_data 应该在其他应用之前加载
            dependencies = {}
            master_data_loaded = False

            for row in rows:
                app_code = row['code']
                if app_code == 'master_data':
                    dependencies[app_code] = []  # master_data 没有依赖
                    master_data_loaded = True
                else:
                    # 其他应用可能依赖 master_data
                    deps = []
                    if master_data_loaded:
                        deps.append('master_data')
                    dependencies[app_code] = deps

            logger.debug(f"📋 模型依赖关系: {dependencies}")
            return dependencies

        finally:
            await conn.close()
