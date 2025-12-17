"""
数据库连接和配置模块

配置 Tortoise ORM 数据库连接
使用 Tortoise ORM 官方推荐的 register_tortoise 方式自动管理连接池
"""

from tortoise.contrib.fastapi import register_tortoise
from tortoise.exceptions import OperationalError
from loguru import logger

from infra.config.infra_config import infra_settings as settings


# Tortoise ORM 配置
# 注意：Tortoise ORM 使用 asyncpg 作为 PostgreSQL 驱动
# 根据官方文档：https://tortoise.github.io/
# 使用 127.0.0.1 而不是 localhost，避免 DNS 解析问题
db_host = "127.0.0.1" if settings.DB_HOST == "localhost" else settings.DB_HOST

# Tortoise ORM 配置字典
# 使用官方推荐的方式配置连接池
# 时区配置统一从 Settings 中读取，确保整个项目配置一致
# 连接池配置参数（解决 "connection was closed in the middle of operation" 错误）：
# 使用字典配置方式，显式指定连接参数和连接池配置
# 注意：Tortoise ORM 0.20.1 支持在 credentials 中传递连接池参数
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
                "core.models.data_backup",
                # Aerich 模型
                "aerich.models",
                # 插件模型（从 src/apps 目录加载）
                "apps.kuaimes.models.order",  # 快格轻MES 订单模型
                # 主数据管理模型
                "apps.master_data.models.factory",  # 工厂数据模型（车间、产线、工位）
                "apps.master_data.models.warehouse",  # 仓库数据模型（仓库、库区、库位）
                "apps.master_data.models.material",  # 物料数据模型（物料分组、物料、BOM）
                "apps.master_data.models.process",  # 工艺数据模型（不良品、工序、工艺路线、SOP）
                "apps.master_data.models.customer",  # 供应链数据模型（客户）
                "apps.master_data.models.supplier",  # 供应链数据模型（供应商）
                "apps.master_data.models.performance",  # 绩效数据模型（假期、技能）
                "apps.master_data.models.product",  # 产品模型
                # CRM 模型
                "apps.kuaicrm.models.lead",  # 线索模型
                "apps.kuaicrm.models.opportunity",  # 商机模型
                "apps.kuaicrm.models.sales_order",  # 销售订单模型
                "apps.kuaicrm.models.service_workorder",  # 服务工单模型
                "apps.kuaicrm.models.warranty",  # 保修模型
                "apps.kuaicrm.models.complaint",  # 投诉模型
                "apps.kuaicrm.models.installation",  # 安装记录模型
                "apps.kuaicrm.models.service_contract",  # 服务合同模型
                "apps.kuaicrm.models.lead_followup",  # 线索跟进记录模型
                "apps.kuaicrm.models.opportunity_followup",  # 商机跟进记录模型
                # 快格轻PDM 模型
                "apps.kuaipdm.models.design_change",  # 设计变更模型
                "apps.kuaipdm.models.engineering_change",  # 工程变更模型
                "apps.kuaipdm.models.design_review",  # 设计评审模型
                "apps.kuaipdm.models.research_process",  # 研发流程模型
                "apps.kuaipdm.models.knowledge",  # 知识管理模型
                # 快格轻MRP 模型
                "apps.kuaimrp.models.mrp_plan",  # MRP计划模型
                "apps.kuaimrp.models.lrp_batch",  # LRP批次模型
                "apps.kuaimrp.models.material_requirement",  # 物料需求模型
                "apps.kuaimrp.models.requirement_traceability",  # 需求追溯模型
                "apps.kuaimrp.models.shortage_alert",  # 缺料预警模型
                # 快格轻SRM 模型
                "apps.kuaisrm.models.purchase_order",  # 采购订单模型
                "apps.kuaisrm.models.outsourcing_order",  # 委外订单模型
                "apps.kuaisrm.models.supplier_evaluation",  # 供应商评估模型
                "apps.kuaisrm.models.purchase_contract",  # 采购合同模型
                # 快格轻WMS 模型
                "apps.kuaiwms.models.inventory",  # 库存模型
                "apps.kuaiwms.models.inbound_order",  # 入库单模型
                "apps.kuaiwms.models.outbound_order",  # 出库单模型
                "apps.kuaiwms.models.stocktake",  # 盘点单模型
                "apps.kuaiwms.models.inventory_adjustment",  # 库存调整模型
                # 快格轻MES 模型
                "apps.kuaimes.models.order",  # 生产订单模型
                "apps.kuaimes.models.work_order",  # 工单模型
                # 快格轻QMS 模型
                "apps.kuaiqms.models.inspection_task",  # 质量检验任务模型
                "apps.kuaiqms.models.inspection_record",  # 质量检验记录模型
                "apps.kuaiqms.models.nonconforming_product",  # 不合格品记录模型
                "apps.kuaiqms.models.nonconforming_handling",  # 不合格品处理模型
                "apps.kuaiqms.models.quality_traceability",  # 质量追溯模型
                "apps.kuaiqms.models.iso_audit",  # ISO质量审核模型
                "apps.kuaiqms.models.capa",  # CAPA模型
                "apps.kuaiqms.models.continuous_improvement",  # 持续改进模型
                "apps.kuaiqms.models.quality_objective",  # 质量目标模型
                "apps.kuaiqms.models.quality_indicator",  # 质量指标模型
                # 快格轻EAM 模型
                "apps.kuaieam.models.maintenance_plan",  # 维护计划模型
                "apps.kuaieam.models.maintenance_workorder",  # 维护工单模型
                "apps.kuaieam.models.maintenance_execution",  # 维护执行记录模型
                "apps.kuaieam.models.failure_report",  # 故障报修模型
                "apps.kuaieam.models.failure_handling",  # 故障处理模型
                "apps.kuaieam.models.spare_part_demand",  # 备件需求模型
                "apps.kuaieam.models.spare_part_purchase",  # 备件采购模型
                "apps.kuaieam.models.tooling_usage",  # 工装夹具使用记录模型
                "apps.kuaieam.models.mold_usage",  # 模具使用记录模型
                "apps.kuaimes.models.production_report",  # 生产报工模型
                "apps.kuaimes.models.traceability",  # 生产追溯模型
                "apps.kuaimes.models.rework_order",  # 返修工单模型
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


def register_db(app) -> None:
    """
    注册数据库组件到 FastAPI 应用

    由于 Tortoise ORM 配置问题，暂时跳过注册，
    改为在需要时直接使用 asyncpg 创建连接

    Args:
        app: FastAPI 应用实例
    """
    logger.info("跳过 Tortoise ORM 注册，使用直接 asyncpg 连接")


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
