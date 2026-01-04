"""
数据库连接和配置模块

配置 Tortoise ORM 数据库连接
使用 Tortoise ORM 官方推荐的 register_tortoise 方式自动管理连接池
"""

from tortoise.contrib.fastapi import register_tortoise
from tortoise import Tortoise
from tortoise.exceptions import OperationalError
from loguru import logger
import asyncio

from infra.config.infra_config import infra_settings as settings


# Tortoise ORM 配置
# 注意：Tortoise ORM 使用 asyncpg 作为 PostgreSQL 驱动
# 根据官方文档：https://tortoise.github.io/
# 使用 127.0.0.1 而不是 localhost，避免 DNS 解析问题
db_host = "127.0.0.1" if settings.DB_HOST == "localhost" else settings.DB_HOST

# 动态生成 Tortoise ORM 配置
# 不再使用硬编码的模型列表，通过数据库查询动态决定加载哪些应用模型
async def get_dynamic_tortoise_config() -> dict:
    """
    动态生成 Tortoise ORM 配置

    通过查询数据库中活跃的应用来动态决定需要加载的模型模块。
    """
    logger.info("🔧 生成动态 Tortoise ORM 配置...")

    # 延迟导入，避免循环依赖
    from .dynamic_config_service import DynamicDatabaseConfigService

    # 获取动态配置
    dynamic_config = await DynamicDatabaseConfigService.generate_tortoise_config()

    # 合并连接配置
    config = {
        "connections": {
            "default": {
                "engine": "tortoise.backends.asyncpg",
                "credentials": {
                    "host": db_host,
                    "port": settings.DB_PORT,
                    "user": settings.DB_USER,
                    "password": settings.DB_PASSWORD,
                    "database": settings.DB_NAME,
                    # 连接池配置（解决连接中断问题）
                    "min_size": 5,  # 最小连接池大小
                    "max_size": 20,  # 最大连接池大小（增加以支持并发请求）
                    "max_queries": 50000,  # 每个连接最大查询次数
                    "max_inactive_connection_lifetime": 300.0,  # 非活跃连接最大生存时间（秒）
                    "command_timeout": 60,  # 命令超时（秒）
                    "server_settings": {
                        "application_name": "riveredge_asyncpg",
                        "timezone": settings.TIMEZONE
                    }
                }
            },
        },
        # 注意：Tortoise ORM 期望 routers 是一个列表，不能是 None
        "routers": [],
        "apps": dynamic_config["apps"],
        "use_tz": dynamic_config["use_tz"],
        "timezone": dynamic_config["timezone"],
    }

    logger.info("✅ 动态 Tortoise ORM 配置生成完成")
    return config

# 兼容性：保留静态配置用于初始化前的访问
# 实际运行时会使用 get_dynamic_tortoise_config() 生成的动态配置
TORTOISE_ORM = {
    "connections": {
        "default": {
            "engine": "tortoise.backends.asyncpg",
            "credentials": {
                "host": db_host,
                "port": settings.DB_PORT,
                "user": settings.DB_USER,
                "password": settings.DB_PASSWORD,
                "database": settings.DB_NAME,
                # 连接池配置（解决连接中断问题）
                # 这些参数会传递给 asyncpg.create_pool()
                "min_size": 5,  # 最小连接池大小
                "max_size": 20,  # 最大连接池大小（增加以支持并发请求）
                "max_queries": 50000,  # 每个连接最大查询次数
                "max_inactive_connection_lifetime": 300.0,  # 非活跃连接最大生存时间（秒，必须是浮点数）
                "command_timeout": 60,  # 命令超时（秒）
                "server_settings": {
                    "application_name": "riveredge_asyncpg",
                    "timezone": settings.TIMEZONE  # 使用与Tortoise ORM相同的时区
                }
            }
        },
    },
    # 注意：Tortoise ORM 期望 routers 是一个列表，不能是 None
    "routers": [],
    "apps": {
        "models": {
            "models": [
                # 平台级模型（infra）
                "infra.models.base",
                "infra.models.tenant",
                "infra.models.tenant_config",
                "infra.models.tenant_activity_log",
                "infra.models.user",
                "infra.models.infra_superadmin",  # 平台超级管理员模型
                "infra.models.package",
                "infra.models.saved_search",  # 保存搜索条件模型
                # 系统级模型（core）
                "core.models.role",
                "core.models.permission",
                "core.models.role_permission",
                "core.models.user_role",
                "core.models.department",
                "core.models.position",
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
                "core.models.application",
                "core.models.menu",
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
                "core.models.user_preference",
                "core.models.operation_log",
                "core.models.login_log",
                # Aerich 模型
                "aerich.models",
                # 主数据管理模型
                "apps.master_data.models.factory",  # 工厂数据模型（车间、产线、工位）
                "apps.master_data.models.warehouse",  # 仓库数据模型（仓库、库区、库位）
                "apps.master_data.models.material",  # 物料数据模型（物料分组、物料、BOM）
                "apps.master_data.models.process",  # 工艺数据模型（不良品、工序、工艺路线、SOP）
                "apps.master_data.models.customer",  # 供应链数据模型（客户）
                "apps.master_data.models.supplier",  # 供应链数据模型（供应商）
                "apps.master_data.models.performance",  # 绩效数据模型（假期、技能）
                "apps.master_data.models.product",  # 产品模型
                # 快格轻制造模型
                "apps.kuaizhizao.models.work_order",  # 工单模型
                "apps.kuaizhizao.models.reporting_record",  # 报工记录模型
                "apps.kuaizhizao.models.production_picking",  # 生产领料模型
                "apps.kuaizhizao.models.production_picking_item",  # 生产领料明细模型
                "apps.kuaizhizao.models.finished_goods_receipt",  # 成品入库模型
                "apps.kuaizhizao.models.finished_goods_receipt_item",  # 成品入库明细模型
                "apps.kuaizhizao.models.sales_delivery",  # 销售发货模型
                "apps.kuaizhizao.models.sales_delivery_item",  # 销售发货明细模型
                "apps.kuaizhizao.models.purchase_receipt",  # 采购收货模型
                "apps.kuaizhizao.models.purchase_receipt_item",  # 采购收货明细模型
                "apps.kuaizhizao.models.purchase_order",  # 采购订单模型
                "apps.kuaizhizao.models.incoming_inspection",  # 来料检验模型
                "apps.kuaizhizao.models.process_inspection",  # 过程检验模型
                "apps.kuaizhizao.models.finished_goods_inspection",  # 成品检验模型
                "apps.kuaizhizao.models.payable",  # 应付账款模型
                "apps.kuaizhizao.models.purchase_invoice",  # 采购发票模型
                "apps.kuaizhizao.models.receivable",  # 应收账款模型
                "apps.kuaizhizao.models.sales_forecast",  # 销售预测模型
                "apps.kuaizhizao.models.sales_forecast_item",  # 销售预测明细模型
                "apps.kuaizhizao.models.sales_order",  # 销售订单模型
                "apps.kuaizhizao.models.sales_order_item",  # 销售订单明细模型
                # BOM管理已移至master_data APP，不再需要bill_of_materials模型
                # "apps.kuaizhizao.models.bill_of_materials",  # BOM模型
                # "apps.kuaizhizao.models.bill_of_materials_item",  # BOM明细模型
                "apps.kuaizhizao.models.production_plan",  # 生产计划模型
                "apps.kuaizhizao.models.production_plan_item",  # 生产计划明细模型
                "apps.kuaizhizao.models.mrp_result",  # MRP结果模型
                "apps.kuaizhizao.models.lrp_result",  # LRP结果模型
            ],
            "default_connection": "default",
        },
    },
    # 时区配置统一从 Settings 中读取（不硬编码）
    "use_tz": settings.USE_TZ,
    "timezone": settings.TIMEZONE,
}

# 全局数据库连接参数
DB_CONFIG = {
    "host": db_host,
    "port": settings.DB_PORT,
    "user": settings.DB_USER,
    "password": settings.DB_PASSWORD,
    "database": settings.DB_NAME,
    "ssl": False,  # 禁用 SSL 连接
    "command_timeout": 30,  # 命令超时（秒）
    "server_settings": {
        'application_name': 'riveredge_asyncpg',
        'timezone': settings.TIMEZONE  # 使用与Tortoise ORM相同的时区
    }
}


async def register_db(app) -> None:
    """
    注册数据库组件到 FastAPI 应用

    使用动态配置生成Tortoise ORM配置，只加载活跃应用的模型

    Args:
        app: FastAPI 应用实例
    """
    logger.info("🔧 注册动态 Tortoise ORM 到 FastAPI 应用")

    try:
        # 使用动态配置生成器获取配置
        config = await get_dynamic_tortoise_config()
        
        # 确保 routers 字段存在且是列表（不能是 None）
        if "routers" not in config or config["routers"] is None:
            config["routers"] = []
        
        # 确保 use_tz 和 timezone 字段存在
        if "use_tz" not in config:
            config["use_tz"] = settings.USE_TZ if hasattr(settings, 'USE_TZ') else False
        if "timezone" not in config:
            config["timezone"] = settings.TIMEZONE if hasattr(settings, 'TIMEZONE') else "UTC"
        
        logger.debug(f"Tortoise ORM 配置: routers={config.get('routers')}, use_tz={config.get('use_tz')}, timezone={config.get('timezone')}")
        
        # ⚠️ 关键修复：直接使用 Tortoise.init() 而不是 register_tortoise
        # register_tortoise 在某些情况下可能不会正确设置 router
        # 先手动初始化 Tortoise ORM，确保 router 正确设置
        await Tortoise.init(config=config)
        logger.info("Tortoise ORM 初始化完成")
        
        # ⚠️ 关键修复：验证 Tortoise ORM 是否正确初始化
        # 检查 router 是否正确设置
        from tortoise import connections
        try:
            # 尝试获取连接，验证配置是否正确
            conn = connections.get("default")
            logger.debug("Tortoise ORM 连接验证成功")
            
            # ⚠️ 关键修复：验证 router 是否正确设置
            # 检查 Tortoise 的内部 router 是否正确初始化
            if hasattr(Tortoise, '_router') and Tortoise._router is not None:
                if hasattr(Tortoise._router, '_routers'):
                    routers = Tortoise._router._routers
                    if routers is None:
                        logger.warning("⚠️ Tortoise ORM router._routers 是 None，尝试修复...")
                        # 如果 routers 是 None，手动设置为空列表
                        Tortoise._router._routers = []
                        logger.info("✅ Tortoise ORM router._routers 已修复为空列表")
                    else:
                        logger.debug(f"Tortoise ORM router._routers 正确设置: {type(routers)}")
                else:
                    logger.warning("⚠️ Tortoise ORM router 没有 _routers 属性")
            else:
                logger.warning("⚠️ Tortoise ORM 没有 _router 属性或 _router 是 None")
                
        except Exception as conn_error:
            logger.warning(f"Tortoise ORM 连接验证失败: {conn_error}")
        
        # ⚠️ 关键修复：注册关闭事件，确保应用关闭时数据库连接也关闭
        @app.on_event("shutdown")
        async def close_db_connections():
            logger.info("关闭 Tortoise ORM 数据库连接...")
            await Tortoise.close_connections()
            logger.info("数据库连接已关闭")
            
    except Exception as e:
        logger.error(f"Tortoise ORM 注册失败: {e}")
        import traceback
        logger.error(f"详细错误信息: {traceback.format_exc()}")
        # 失败时不抛出异常，继续运行
        pass


async def get_db_connection():
    """
    获取数据库连接

    返回一个新的 asyncpg 连接，用于直接数据库操作

    Returns:
        asyncpg.Connection: 数据库连接对象

    Raises:
        OperationalError: 当连接失败时抛出
    """
    try:
        import asyncpg
        conn = await asyncpg.connect(**DB_CONFIG)
        return conn
    except Exception as e:
        logger.error(f"获取数据库连接失败: {e}")
        raise OperationalError(f"数据库连接失败: {e}")


async def check_db_connection() -> bool:
    """
    检查数据库连接状态

    用于健康检查，验证数据库是否可连接

    Returns:
        bool: True 如果连接正常，False 如果连接失败
    """
    try:
        import asyncpg
        conn = await asyncpg.connect(**DB_CONFIG)
        await conn.close()
        return True
    except Exception as e:
        logger.warning(f"数据库连接检查失败: {e}")
        return False


# 注意：使用 register_tortoise 后，连接池会自动管理，不需要手动检查或重新初始化
# Tortoise ORM 会自动处理连接池的生命周期，包括：
# - 应用启动时自动初始化连接池
# - 应用关闭时自动关闭连接池
# - 连接池中的连接会自动恢复和重用


# 注意：使用 register_tortoise 后，不需要手动重试机制
# Tortoise ORM 的连接池会自动处理连接恢复和错误重试
