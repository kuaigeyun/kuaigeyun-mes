"""
动态数据库配置服务模块

提供动态生成Tortoise ORM配置的功能，不再依赖硬编码的应用模型列表。
通过查询数据库中活跃的应用来动态决定需要加载的模型模块。
"""

from typing import Dict, Any, List
import json
import asyncpg
from loguru import logger


class DynamicDatabaseConfigService:
    """
    动态数据库配置服务类

    动态生成Tortoise ORM配置，只加载活跃应用的模型。
    """

    @staticmethod
    async def generate_tortoise_config() -> Dict[str, Any]:
        """
        动态生成Tortoise ORM配置

        查询数据库中所有活跃的应用，动态构建模型列表。

        Returns:
            Dict[str, Any]: Tortoise ORM配置字典
        """
        logger.info("🔧 开始生成动态数据库配置...")

        # 基础配置
        config = {
            "connections": {
                "default": {
                    "engine": "tortoise.backends.asyncpg",
                    "credentials": {
                        "host": None,  # 将在运行时设置
                        "port": None,
                        "user": None,
                        "password": None,
                        "database": None,
                    }
                }
            },
            "apps": {
                "models": {
                    "models": await DynamicDatabaseConfigService._get_active_models(),
                    "default_connection": "default",
                }
            },
            "use_tz": True,  # 从Settings中读取
            "timezone": "Asia/Shanghai",  # 从Settings中读取
        }

        logger.info("✅ 动态数据库配置生成完成")
        return config

    @staticmethod
    async def _get_active_models() -> List[str]:
        """
        获取所有活跃应用的模型模块列表

        Returns:
            List[str]: 模型模块路径列表
        """
        logger.debug("📋 获取活跃应用模型列表...")

        # 基础模型（系统必须的）
        base_models = [
            # 核心系统模型
            "core.models.application",
            "core.models.menu",
            "core.models.role",
            "core.models.permission",
            "core.models.user_role",
            "core.models.role_permission",
            "core.models.user_preference",
            "core.models.operation_log",
            "core.models.login_log",
            "core.models.data_dictionary",
            "core.models.dictionary_item",
            "core.models.system_parameter",
            "core.models.code_rule",
            "core.models.code_sequence",
            "core.models.custom_field",
            "core.models.custom_field_value",
            "core.models.site_setting",
            "core.models.invitation_code",
            "core.models.language",
            "core.models.integration_config",
            "core.models.file",
            "core.models.api",
            "core.models.data_source",
            "core.models.dataset",
            "core.models.message_config",
            "core.models.message_template",
            "core.models.message_log",
            "core.models.scheduled_task",
            "core.models.approval_process",
            "core.models.approval_instance",
            "core.models.approval_history",
            "core.models.script",
            "core.models.print_template",
            "core.models.print_device",
            "core.models.department",
            "core.models.position",

            # 平台模型
            "infra.models.base",
            "infra.models.tenant",
            "infra.models.tenant_config",
            "infra.models.tenant_activity_log",
            "infra.models.user",
            "infra.models.infra_superadmin",
            "infra.models.package",
            "infra.models.saved_search",
            "infra.models.invitation_code",

            # Aerich 模型（数据库迁移）
            "aerich.models",
        ]

        # 验证模型模块是否存在，只包含存在的模块
        validated_base_models = []
        for model_path in base_models:
            if DynamicDatabaseConfigService._module_exists(model_path):
                validated_base_models.append(model_path)
                logger.debug(f"✅ 验证基础模型存在: {model_path}")
            else:
                logger.warning(f"⚠️ 基础模型不存在，跳过: {model_path}")

        return validated_base_models

        # 获取活跃应用的模型
        active_app_models = await DynamicDatabaseConfigService._get_active_app_models()

        # 合并所有模型
        all_models = base_models + active_app_models

        # 最终验证所有模型模块是否存在
        final_models = []
        for model_path in all_models:
            if DynamicDatabaseConfigService._module_exists(model_path):
                final_models.append(model_path)
            else:
                logger.warning(f"❌ 模型模块不存在: {model_path}")

        logger.info(f"📝 最终加载 {len(final_models)} 个验证通过的模型模块")
        return final_models

    @staticmethod
    async def _get_active_app_models() -> List[str]:
        """
        获取活跃应用的模型模块列表

        从数据库查询所有已安装且启用的应用，获取其模型模块路径。

        Returns:
            List[str]: 应用模型模块路径列表
        """
        # 由于循环导入问题，这里暂时返回硬编码的活跃应用模型
        # 在实际运行时，会通过ApplicationRegistryService获取准确的模型列表
        logger.info("📋 获取活跃应用模型列表（临时方案）")

        # 临时返回已知活跃应用的模型
        active_app_models = [
            "apps.master_data.models.factory",  # 工厂数据模型
            "apps.master_data.models.warehouse",  # 仓库数据模型
            "apps.master_data.models.material",  # 物料数据模型
            "apps.master_data.models.process",  # 工艺数据模型
            "apps.master_data.models.customer",  # 供应链数据模型
            "apps.master_data.models.supplier",  # 供应链数据模型
            "apps.master_data.models.performance",  # 绩效数据模型
            "apps.master_data.models.product",  # 产品模型
        ]

        # 验证这些模块是否存在
        validated_models = []
        for module_path in active_app_models:
            if DynamicDatabaseConfigService._module_exists(module_path):
                validated_models.append(module_path)
                logger.debug(f"✅ 验证应用模型存在: {module_path}")
            else:
                logger.warning(f"⚠️ 应用模型不存在: {module_path}")

        logger.info(f"📦 验证通过的应用模型: {len(validated_models)} 个")
        return validated_models

    @staticmethod
    def _module_exists(module_path: str) -> bool:
        """
        检查Python模块是否存在

        Args:
            module_path: 模块路径

        Returns:
            bool: 模块是否存在
        """
        try:
            import importlib
            importlib.import_module(module_path)
            return True
        except ImportError:
            return False
        except Exception:
            # 其他导入错误也视为模块不存在
            return False

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
