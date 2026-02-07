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
        logger.info("📋 === _get_active_models 方法被调用 ===")
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
            "core.models.material_code_rule",  # 物料编码规则模型
            "core.models.material_variant_attribute",  # 物料变体属性定义模型
            "core.models.custom_field",
            "core.models.custom_field_value",
            "core.models.site_setting",
            "core.models.invitation_code",
            "core.models.language",
            "core.models.integration_config",
            "core.models.file",
            "core.models.api",
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
            "infra.models.platform_settings",
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

        # 获取活跃应用的模型
        logger.info("📋 === 开始获取活跃应用模型列表 ===")

        try:
            # 尝试从数据库查询活跃应用
            logger.info("📋 尝试连接数据库查询活跃应用...")
            from infra.infrastructure.database.database import get_db_connection
            conn = await get_db_connection()
            logger.info("📋 数据库连接成功")

            try:
                rows = await conn.fetch("""
                    SELECT DISTINCT code
                    FROM core_applications
                    WHERE is_installed = TRUE
                      AND is_active = TRUE
                      AND deleted_at IS NULL
                """)

                active_app_codes = [row['code'] for row in rows]
                logger.info(f"📋 从数据库发现 {len(active_app_codes)} 个活跃应用: {active_app_codes}")

            finally:
                await conn.close()
                logger.info("📋 数据库连接已关闭")

        except Exception as e:
            logger.error(f"从数据库查询活跃应用失败: {e}", exc_info=True)
            # 回退方案：从文件系统扫描应用目录，自动发现应用
            active_app_codes = []
            try:
                from core.services.application.application_service import ApplicationService
                discovered_plugins = ApplicationService._scan_plugin_manifests()
                active_app_codes = [plugin.get('code') for plugin in discovered_plugins if plugin.get('code')]
                logger.info(f"📋 从文件系统扫描到 {len(active_app_codes)} 个应用: {active_app_codes}")
            except Exception as scan_error:
                logger.error(f"❌ 从文件系统扫描应用失败: {scan_error}")
                # 最后的回退：返回空列表，避免系统崩溃
                active_app_codes = []
                logger.warning("⚠️ 无法发现任何应用，系统可能无法正常工作")

        logger.info(f"📋 将处理的活跃应用代码: {active_app_codes}")

        # 根据应用代码生成模型模块路径
        active_app_models = []
        for app_code in active_app_codes:
            # 将连字符转换为下划线
            module_code = app_code.replace('-', '_')
            logger.info(f"📋 处理应用 {app_code} -> 模块代码 {module_code}")

            # 常见的应用模型模块
            potential_modules = [
                f"apps.{module_code}.models.factory",
                f"apps.{module_code}.models.warehouse",
                f"apps.{module_code}.models.material",
                f"apps.{module_code}.models.material_code_alias",
                f"apps.{module_code}.models.material_code_mapping",
                f"apps.{module_code}.models.material_batch",
                f"apps.{module_code}.models.material_serial",
                f"apps.{module_code}.models.process",
                f"apps.{module_code}.models.customer",
                f"apps.{module_code}.models.supplier",
                f"apps.{module_code}.models.performance",
                f"apps.{module_code}.models.product",
                f"apps.{module_code}.models.work_order",
                f"apps.{module_code}.models.work_order_operation",
                f"apps.{module_code}.models.reporting_record",
                f"apps.{module_code}.models.rework_order",  # 返工单模型
                f"apps.{module_code}.models.outsource_order",  # 工序委外模型
                f"apps.{module_code}.models.outsource_work_order",  # 工单委外模型
                f"apps.{module_code}.models.scrap_record",  # 报废记录模型
                f"apps.{module_code}.models.defect_record",  # 不良品记录模型
                f"apps.{module_code}.models.material_binding",  # 物料绑定模型
                f"apps.{module_code}.models.material_shortage_exception",  # 缺料异常模型
                f"apps.{module_code}.models.delivery_delay_exception",  # 延期异常模型
                f"apps.{module_code}.models.quality_exception",  # 质量异常模型
                f"apps.{module_code}.models.exception_process_record",  # 异常处理记录模型
                # 仓储管理模块
                f"apps.{module_code}.models.customer_material_registration",  # 客户来料登记模型（条码映射规则）
                f"apps.{module_code}.models.production_picking",
                f"apps.{module_code}.models.production_picking_item",
                f"apps.{module_code}.models.finished_goods_receipt",
                f"apps.{module_code}.models.finished_goods_receipt_item",
                f"apps.{module_code}.models.sales_delivery",
                f"apps.{module_code}.models.sales_delivery_item",
                f"apps.{module_code}.models.sales_return",
                f"apps.{module_code}.models.sales_return_item",
                f"apps.{module_code}.models.purchase_receipt",
                f"apps.{module_code}.models.purchase_receipt_item",
                f"apps.{module_code}.models.purchase_return",
                f"apps.{module_code}.models.purchase_return_item",
                f"apps.{module_code}.models.purchase_order",
                f"apps.{module_code}.models.purchase_order_item",
                # 质量管理模块
                f"apps.{module_code}.models.incoming_inspection",
                f"apps.{module_code}.models.process_inspection",
                f"apps.{module_code}.models.finished_goods_inspection",
                # 财务协同模块
                f"apps.{module_code}.models.payable",
                f"apps.{module_code}.models.purchase_invoice",
                f"apps.{module_code}.models.receivable",
                # 销售管理模块
                f"apps.{module_code}.models.sales_forecast",
                f"apps.{module_code}.models.sales_forecast_item",
                f"apps.{module_code}.models.sales_order",
                f"apps.{module_code}.models.sales_order_item",
                # 统一需求管理模块（第一阶段重构）
                f"apps.{module_code}.models.demand",
                f"apps.{module_code}.models.demand_item",
                f"apps.{module_code}.models.demand_computation",
                f"apps.{module_code}.models.demand_computation_item",
                f"apps.{module_code}.models.computation_config",  # 需求计算参数配置
                f"apps.{module_code}.models.document_relation",  # 单据关联关系
                f"apps.{module_code}.models.document_node_timing",  # 单据节点耗时记录
                # BOM管理模块
                # BOM管理已移至master_data APP，不再需要bill_of_materials模型
                # f"apps.{module_code}.models.bill_of_materials",
                # f"apps.{module_code}.models.bill_of_materials_item",
                # 生产计划模块
                f"apps.{module_code}.models.production_plan",
                f"apps.{module_code}.models.production_plan_item",
                f"apps.{module_code}.models.mrp_result",
                f"apps.{module_code}.models.lrp_result",
                # 审核流程和状态流转模块
                f"apps.{module_code}.models.approval_flow",  # 审核流程
                f"apps.{module_code}.models.state_transition",  # 状态流转
                # 设备管理模块
                f"apps.{module_code}.models.equipment",  # 设备模型
                f"apps.{module_code}.models.equipment_fault",  # 设备故障
                f"apps.{module_code}.models.equipment_status_monitor",  # 设备状态监控
                f"apps.{module_code}.models.maintenance_plan",  # 维护计划
                f"apps.{module_code}.models.maintenance_reminder",  # 维护提醒
                f"apps.{module_code}.models.mold",  # 模具模型
                # 成本管理模块
                f"apps.{module_code}.models.cost_calculation",  # 成本计算
                f"apps.{module_code}.models.cost_rule",  # 成本规则
                # 质量管理模块（补充）
                f"apps.{module_code}.models.quality_standard",  # 质量标准
                # 仓储管理模块（补充）
                f"apps.{module_code}.models.inventory_transfer",  # 库存调拨
                f"apps.{module_code}.models.inventory_alert",  # 库存预警
                f"apps.{module_code}.models.stocktaking",  # 库存盘点
                f"apps.{module_code}.models.packing_binding",  # 装箱绑定
                f"apps.{module_code}.models.replenishment_suggestion",  # 补货建议
                # 线边仓与倒冲模块
                f"apps.{module_code}.models.line_side_inventory",  # 线边仓库存
                f"apps.{module_code}.models.backflush_record",  # 物料倒冲记录
                # 上线倒计时模块
                f"apps.{module_code}.models.launch_countdown",  # 上线倒计时
                f"apps.{module_code}.models.report",  # 报表模型
                f"apps.{module_code}.models.dashboard",  # 大屏模型
            ]

            # 只添加存在的模块
            for module_path in potential_modules:
                if DynamicDatabaseConfigService._module_exists(module_path):
                    active_app_models.append(module_path)
                    logger.debug(f"✅ 发现应用模型模块: {module_path}")

        logger.info(f"📋 发现的总应用模型模块: {len(active_app_models)} 个")

        # 合并所有模型
        all_models = validated_base_models + active_app_models
        logger.info(f"📋 合并后总共 {len(all_models)} 个模型模块 (基础: {len(validated_base_models)}, 应用: {len(active_app_models)})")

        # 已在 validated_base_models 和 active_app_models 构建时验证，无需重复检查
        final_models = all_models
        logger.info(f"📝 最终加载 {len(final_models)} 个验证通过的模型模块")
        logger.info(f"📋 === 获取活跃应用模型列表结束，返回 {len(final_models)} 个模型 ===")
        return final_models

    @staticmethod
    async def _get_active_app_models() -> List[str]:
        """
        获取活跃应用的模型模块列表

        从数据库查询所有已安装且启用的应用，获取其模型模块路径。

        Returns:
            List[str]: 应用模型模块路径列表
        """
        logger.info("📋 === 开始获取活跃应用模型列表 ===")

        try:
            # 尝试从数据库查询活跃应用
            from infra.infrastructure.database.database import get_db_connection
            conn = await get_db_connection()

            try:
                rows = await conn.fetch("""
                    SELECT DISTINCT code
                    FROM core_applications
                    WHERE is_installed = TRUE
                      AND is_active = TRUE
                      AND deleted_at IS NULL
                """)

                active_app_codes = [row['code'] for row in rows]
                logger.info(f"📋 从数据库发现 {len(active_app_codes)} 个活跃应用: {active_app_codes}")

            finally:
                await conn.close()

        except Exception as e:
            logger.warning(f"从数据库查询活跃应用失败，尝试从文件系统扫描: {e}")
            # 回退方案：从文件系统扫描应用目录，自动发现应用
            active_app_codes = []
            try:
                from core.services.application.application_service import ApplicationService
                discovered_plugins = ApplicationService._scan_plugin_manifests()
                active_app_codes = [plugin.get('code') for plugin in discovered_plugins if plugin.get('code')]
                logger.info(f"📋 从文件系统扫描到 {len(active_app_codes)} 个应用: {active_app_codes}")
            except Exception as scan_error:
                logger.error(f"❌ 从文件系统扫描应用失败: {scan_error}")
                # 最后的回退：返回空列表，避免系统崩溃
                active_app_codes = []
                logger.warning("⚠️ 无法发现任何应用，系统可能无法正常工作")

        logger.info(f"📋 将处理的活跃应用代码: {active_app_codes}")

        # 根据应用代码生成模型模块路径
        active_app_models = []
        for app_code in active_app_codes:
            # 将连字符转换为下划线
            module_code = app_code.replace('-', '_')
            logger.info(f"📋 处理应用 {app_code} -> 模块代码 {module_code}")

            # 常见的应用模型模块
            potential_modules = [
                f"apps.{module_code}.models.factory",
                f"apps.{module_code}.models.warehouse",
                f"apps.{module_code}.models.material",
                f"apps.{module_code}.models.material_code_alias",
                f"apps.{module_code}.models.material_code_mapping",
                f"apps.{module_code}.models.material_batch",
                f"apps.{module_code}.models.material_serial",
                f"apps.{module_code}.models.process",
                f"apps.{module_code}.models.customer",
                f"apps.{module_code}.models.supplier",
                f"apps.{module_code}.models.performance",
                f"apps.{module_code}.models.product",
                f"apps.{module_code}.models.work_order",
                f"apps.{module_code}.models.work_order_operation",
                f"apps.{module_code}.models.reporting_record",
                f"apps.{module_code}.models.rework_order",  # 返工单模型
                f"apps.{module_code}.models.outsource_order",  # 工序委外模型
                f"apps.{module_code}.models.outsource_work_order",  # 工单委外模型
                f"apps.{module_code}.models.scrap_record",  # 报废记录模型
                f"apps.{module_code}.models.defect_record",  # 不良品记录模型
                f"apps.{module_code}.models.material_binding",  # 物料绑定模型
                f"apps.{module_code}.models.material_shortage_exception",  # 缺料异常模型
                f"apps.{module_code}.models.delivery_delay_exception",  # 延期异常模型
                f"apps.{module_code}.models.quality_exception",  # 质量异常模型
                f"apps.{module_code}.models.exception_process_record",  # 异常处理记录模型
                # 仓储管理模块
                f"apps.{module_code}.models.customer_material_registration",  # 客户来料登记模型（条码映射规则）
                f"apps.{module_code}.models.production_picking",
                f"apps.{module_code}.models.production_picking_item",
                f"apps.{module_code}.models.finished_goods_receipt",
                f"apps.{module_code}.models.finished_goods_receipt_item",
                f"apps.{module_code}.models.sales_delivery",
                f"apps.{module_code}.models.sales_delivery_item",
                f"apps.{module_code}.models.sales_return",
                f"apps.{module_code}.models.sales_return_item",
                f"apps.{module_code}.models.purchase_receipt",
                f"apps.{module_code}.models.purchase_receipt_item",
                f"apps.{module_code}.models.purchase_return",
                f"apps.{module_code}.models.purchase_return_item",
                f"apps.{module_code}.models.purchase_order",
                f"apps.{module_code}.models.purchase_order_item",
                # 质量管理模块
                f"apps.{module_code}.models.incoming_inspection",
                f"apps.{module_code}.models.process_inspection",
                f"apps.{module_code}.models.finished_goods_inspection",
                # 财务协同模块
                f"apps.{module_code}.models.payable",
                f"apps.{module_code}.models.purchase_invoice",
                f"apps.{module_code}.models.receivable",
                # 销售管理模块
                f"apps.{module_code}.models.sales_forecast",
                f"apps.{module_code}.models.sales_forecast_item",
                f"apps.{module_code}.models.sales_order",
                f"apps.{module_code}.models.sales_order_item",
                # 统一需求管理模块（第一阶段重构）
                f"apps.{module_code}.models.demand",
                f"apps.{module_code}.models.demand_item",
                f"apps.{module_code}.models.demand_computation",
                f"apps.{module_code}.models.demand_computation_item",
                f"apps.{module_code}.models.computation_config",  # 需求计算参数配置
                f"apps.{module_code}.models.document_relation",  # 单据关联关系
                f"apps.{module_code}.models.document_node_timing",  # 单据节点耗时记录
                # BOM管理模块
                # BOM管理已移至master_data APP，不再需要bill_of_materials模型
                # f"apps.{module_code}.models.bill_of_materials",
                # f"apps.{module_code}.models.bill_of_materials_item",
                # 生产计划模块
                f"apps.{module_code}.models.production_plan",
                f"apps.{module_code}.models.production_plan_item",
                f"apps.{module_code}.models.mrp_result",
                f"apps.{module_code}.models.lrp_result",
                # 审核流程和状态流转模块
                f"apps.{module_code}.models.approval_flow",  # 审核流程
                f"apps.{module_code}.models.state_transition",  # 状态流转
                # 设备管理模块
                f"apps.{module_code}.models.equipment",  # 设备模型
                f"apps.{module_code}.models.equipment_fault",  # 设备故障
                f"apps.{module_code}.models.equipment_status_monitor",  # 设备状态监控
                f"apps.{module_code}.models.maintenance_plan",  # 维护计划
                f"apps.{module_code}.models.maintenance_reminder",  # 维护提醒
                f"apps.{module_code}.models.mold",  # 模具模型
                # 成本管理模块
                f"apps.{module_code}.models.cost_calculation",  # 成本计算
                f"apps.{module_code}.models.cost_rule",  # 成本规则
                # 质量管理模块（补充）
                f"apps.{module_code}.models.quality_standard",  # 质量标准
                # 仓储管理模块（补充）
                f"apps.{module_code}.models.inventory_transfer",  # 库存调拨
                f"apps.{module_code}.models.inventory_alert",  # 库存预警
                f"apps.{module_code}.models.stocktaking",  # 库存盘点
                f"apps.{module_code}.models.packing_binding",  # 装箱绑定
                f"apps.{module_code}.models.replenishment_suggestion",  # 补货建议
                # 线边仓与倒冲模块
                f"apps.{module_code}.models.line_side_inventory",  # 线边仓库存
                f"apps.{module_code}.models.backflush_record",  # 物料倒冲记录
                # 上线倒计时模块
                f"apps.{module_code}.models.launch_countdown",  # 上线倒计时
                f"apps.{module_code}.models.report",  # 报表模型
                f"apps.{module_code}.models.dashboard",  # 大屏模型
            ]

            # 只添加存在的模块
            for module_path in potential_modules:
                if DynamicDatabaseConfigService._module_exists(module_path):
                    active_app_models.append(module_path)
                    logger.debug(f"✅ 发现应用模型模块: {module_path}")

        logger.info(f"📋 发现的总应用模型模块: {len(active_app_models)} 个")

        # 验证这些模块是否存在
        validated_models = []
        for module_path in active_app_models:
            if DynamicDatabaseConfigService._module_exists(module_path):
                validated_models.append(module_path)
                logger.debug(f"✅ 验证应用模型存在: {module_path}")
            else:
                logger.warning(f"⚠️ 应用模型不存在: {module_path}")

        logger.info(f"📦 验证通过的应用模型: {len(validated_models)} 个")
        logger.info(f"📋 === 获取活跃应用模型列表结束，返回 {len(validated_models)} 个模型 ===")
        return validated_models

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
