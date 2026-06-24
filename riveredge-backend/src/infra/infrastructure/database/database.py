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
import os
import sys

from infra.config.infra_config import infra_settings as settings


def _is_aerich_migration_process() -> bool:
    """
    aerich CLI 连接数据库时使用较小连接池，降低「too many clients」概率。
    优先读 AERICH_MIGRATE=1（面板/CI 可显式设置）；否则根据进程参数推断（避免面板忘记导出变量）。
    """
    if os.environ.get("AERICH_MIGRATE") == "1":
        return True
    try:
        argv = " ".join(sys.argv).lower()
    except Exception:
        return False
    if not argv.strip():
        return False
    # 正常运行 API 时不要误判
    if "uvicorn" in argv or "gunicorn" in argv:
        return False
    return "aerich" in argv


_is_aerich = _is_aerich_migration_process()


def _int_env(name: str, default: int) -> int:
    """读取整型 ENV；值非法时回落默认，不阻塞启动。"""
    raw = os.environ.get(name)
    if raw is None or raw == "":
        return default
    try:
        return int(raw)
    except (TypeError, ValueError):
        logger.warning(f"环境变量 {name}={raw!r} 非法整数，回退默认 {default}")
        return default


# 应用运行态连接池（运行期 & aerich 迁移期分别读 ENV，缺省值与旧行为一致）
# - RIVEREDGE_DB_POOL_MIN / RIVEREDGE_DB_POOL_MAX：普通进程
# - RIVEREDGE_DB_POOL_MIN_AERICH / RIVEREDGE_DB_POOL_MAX_AERICH：aerich migrate
if _is_aerich:
    _pool_min = _int_env("RIVEREDGE_DB_POOL_MIN_AERICH", 1)
    _pool_max = _int_env("RIVEREDGE_DB_POOL_MAX_AERICH", 2)
else:
    _pool_min = _int_env("RIVEREDGE_DB_POOL_MIN", 2)
    _pool_max = _int_env("RIVEREDGE_DB_POOL_MAX", 10)


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
                    # 连接池配置（与静态 TORTOISE_ORM 保持一致，均走 _pool_min/_pool_max）
                    "min_size": _pool_min,
                    "max_size": _pool_max,
                    "max_queries": 50000,  # 每个连接最大查询次数
                    "max_inactive_connection_lifetime": 60.0,  # 非活跃连接最大生存时间（秒，防止空闲连接由于远程防火墙断开而失效）
                    "command_timeout": 300,  # 命令超时（秒），增加以处理可能的慢查询
                    "server_settings": {
                        "application_name": "riveredge_asyncpg",
                        "timezone": dynamic_config.get("timezone", "UTC"),
                        # ⚠️ 关键修复：增加更多 server_settings 以保持连接稳定性
                        "tcp_user_timeout": "30000",  # TCP用户超时（毫秒）
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
                "min_size": _pool_min,  # aerich 迁移时仅 1 个连接，避免 too many clients
                "max_size": _pool_max,
                "max_queries": 50000,  # 每个连接最大查询次数
                "max_inactive_connection_lifetime": 60.0,  # 非活跃连接最大生存时间（秒，必须是浮点数）
                "command_timeout": 300,  # 命令超时（秒），aerich 迁移需更长时间
                "server_settings": {
                    "application_name": "riveredge_asyncpg",
                    "tcp_user_timeout": "30000",  # TCP用户超时（毫秒）
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
                "infra.models.tenant",
                "infra.models.tenant_config",
                "infra.models.tenant_activity_log",
                "infra.models.user",
                "infra.models.biometric",  # 生物识别信息模型
                "infra.models.infra_superadmin",  # 平台超级管理员模型
                "infra.models.package",
                "infra.models.saved_search",  # 保存搜索条件模型
                "infra.models.industry_template",  # 行业模板模型
                "infra.models.platform_settings",  # 平台设置模型
                # 系统级模型（core）
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
                "core.models.role_permission",
                "core.models.user_role",
                "core.models.department",
                "core.models.department_dataset_binding",
                "core.models.position",
                "core.models.data_dictionary",
                "core.models.dictionary_item",
                "core.models.system_parameter",
                "core.models.code_rule",
                "core.models.code_sequence",
                "core.models.batch_rule",
                "core.models.batch_rule_sequence",
                "core.models.serial_rule",
                "core.models.serial_rule_sequence",
                "core.models.material_code_rule",  # 物料编码规则模型
                "core.models.material_variant_attribute",  # 物料属性定义模型
                "core.models.custom_field",
                "core.models.custom_field_value",
                "core.models.site_setting",
                "core.models.invitation_code",
                "core.models.language",
                "core.models.application",
                "core.models.client_product",
                "core.models.client_release",
                "core.models.menu",
                "core.models.tenant_backend_home",
                "core.models.integration_config",
                "core.models.file",
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
                "core.models.user_preference",
                "core.models.operation_log",
                "core.models.login_log",
                "core.models.user_activity",
                # Aerich 模型
                "aerich.models",
                # 主数据管理模型
                "apps.master_data.models.factory",  # 工厂数据模型（车间、产线、工位）
                "apps.master_data.models.warehouse",  # 仓库数据模型（仓库、库区、库位）
                "apps.master_data.models.material",  # 物料数据模型（物料分组、物料、BOM）
                "apps.master_data.models.material_product_process",  # 物料产品工艺（单表）
                "apps.master_data.models.material_code_alias",  # 物料编码别名模型（主编码和部门编码映射）
                "apps.master_data.models.material_code_mapping",  # 物料编码映射模型（外部编码映射到内部编码）
                "apps.master_data.models.material_batch",  # 物料批号模型
                "apps.master_data.models.material_serial",  # 物料序列号模型
                "apps.master_data.models.process",  # 工艺数据模型（不良品、工序、工艺路线、SOP）
                "apps.master_data.models.customer",  # 供应链数据模型（客户）
                "apps.master_data.models.supplier",  # 供应链数据模型（供应商）
                "apps.master_data.models.partner_price_book",  # 客户供应商价格本
                "apps.master_data.models.performance",  # 绩效数据模型（假期、技能）
                "apps.master_data.models.employee_performance",  # 员工绩效模型（配置、计件单价、工时单价、KPI、汇总）
                "apps.master_data.models.product",  # 产品模型
                "apps.master_data.models.bom_change",  # BOM变更记录
                "apps.master_data.models.process_route_change",  # 工艺路线变更记录
                "apps.master_data.models.drawing",  # 工程图纸
                # 快格轻制造模型
                "apps.kuaizhizao.models.work_order",  # 工单模型
                "apps.kuaizhizao.models.work_order_group",  # 工单组模型
                "apps.kuaizhizao.models.work_order_operation",  # 工单工序模型
                "apps.kuaizhizao.models.reporting_record",  # 报工记录模型
                "apps.kuaizhizao.models.rework_order",  # 返工单模型
                "apps.kuaizhizao.models.rework_order_operation",  # 返工单关联工序
                "apps.kuaizhizao.models.outsource_order",  # 委外单模型
                "apps.kuaizhizao.models.scrap_record",  # 报废记录模型
                "apps.kuaizhizao.models.defect_record",  # 不良品记录模型
                "apps.kuaizhizao.models.material_binding",  # 物料绑定模型
                "apps.kuaizhizao.models.production_picking",  # 生产领料模型
                "apps.kuaizhizao.models.production_picking_item",  # 生产领料明细模型
                "apps.kuaizhizao.models.production_return",  # 生产退料模型
                "apps.kuaizhizao.models.production_return_item",  # 生产退料明细模型
                "apps.kuaizhizao.models.finished_goods_receipt",  # 成品入库模型
                "apps.kuaizhizao.models.finished_goods_receipt_item",  # 成品入库明细模型
                "apps.kuaizhizao.models.semi_finished_goods_receipt",  # 半成品入库模型
                "apps.kuaizhizao.models.semi_finished_goods_receipt_item",  # 半成品入库明细模型
                "apps.kuaizhizao.models.packing_binding",  # 装箱绑定模型
                "apps.kuaizhizao.models.sales_delivery",  # 销售发货模型
                "apps.kuaizhizao.models.sales_delivery_item",  # 销售发货明细模型
                "apps.kuaizhizao.models.sales_return",  # 销售退货模型
                "apps.kuaizhizao.models.sales_return_item",  # 销售退货明细模型
                "apps.kuaizhizao.models.purchase_receipt",  # 采购收货模型
                "apps.kuaizhizao.models.purchase_receipt_item",  # 采购收货明细模型
                "apps.kuaizhizao.models.purchase_return",  # 采购退货模型
                "apps.kuaizhizao.models.purchase_return_item",  # 采购退货明细模型
                "apps.kuaizhizao.models.purchase_order",  # 采购订单模型
                "apps.kuaizhizao.models.purchase_requisition",  # 采购申请模型
                "apps.kuaizhizao.models.incoming_inspection",  # 来料检验模型
                "apps.kuaizhizao.models.process_inspection",  # 过程检验模型
                "apps.kuaizhizao.models.finished_goods_inspection",  # 成品检验模型
                # Payable/Receivable/PurchaseInvoice 已迁移至 kuaicaiwu
                "apps.kuaicaiwu.models.payable",  # 应付账款模型
                "apps.kuaicaiwu.models.receivable",  # 应收账款模型
                "apps.kuaicaiwu.models.purchase_invoice",  # 采购发票模型
                "apps.kuaicaiwu.models.invoice",  # 销项/进项发票模型（从快制造迁移）
                "apps.kuaicaiwu.models.receipt",  # 收款单
                "apps.kuaicaiwu.models.payment",  # 付款单
                "apps.kuaicaiwu.models.settlement",  # 核销单
                "apps.kuaicaiwu.models.partner_statement",  # 往来对账单
                "apps.kuaicaiwu.models.accounting_event",  # 会计事件链路
                "apps.kuaicaiwu.models.standard_cost",  # 标准成本
                # 快研发 kuaiplm
                "apps.kuaiplm.models.rd_project",
                "apps.kuaiplm.models.knowledge_base",
                "apps.kuaiplm.models.phase2",
                "apps.kuaizhizao.models.sales_forecast",  # 销售预测模型
                "apps.kuaizhizao.models.sales_forecast_item",  # 销售预测明细模型
                "apps.kuaizhizao.models.sales_order",  # 销售订单模型
                "apps.kuaizhizao.models.sales_order_item",  # 销售订单明细模型
                # 统一需求管理模型（第一阶段重构）
                "apps.kuaizhizao.models.demand",  # 统一需求模型
                "apps.kuaizhizao.models.demand_item",  # 统一需求明细模型
                "apps.kuaizhizao.models.demand_computation",  # 需求计算模型
                "apps.kuaizhizao.models.demand_computation_item",  # 需求计算明细模型
                "apps.kuaizhizao.models.demand_snapshot",  # 需求快照
                "apps.kuaizhizao.models.demand_recalc_history",  # 需求重算历史
                "apps.kuaizhizao.models.demand_computation_snapshot",  # 需求计算快照
                "apps.kuaizhizao.models.demand_computation_recalc_history",  # 需求计算重算历史
                # BOM管理已移至master_data APP，不再需要bill_of_materials模型
                # "apps.kuaizhizao.models.bill_of_materials",  # BOM模型
                # "apps.kuaizhizao.models.bill_of_materials_item",  # BOM明细模型
                "apps.kuaizhizao.models.production_plan",  # 生产计划模型
                "apps.kuaizhizao.models.production_plan_item",  # 生产计划明细模型
                "apps.kuaizhizao.models.mrp_result",  # MRP结果模型
                "apps.kuaizhizao.models.lrp_result",  # LRP结果模型
                "apps.kuaizhizao.models.outsource_work_order",  # 委外工单模型（OutsourceWorkOrder、OutsourceMaterialIssue、OutsourceMaterialReceipt）
                "apps.kuaizhizao.models.document_relation",  # 单据关联模型
                "apps.kuaizhizao.models.assembly_order",  # 装配单模型
                "apps.kuaizhizao.models.assembly_material_binding",  # 装配物料绑定模型
                "apps.kuaizhizao.models.backflush_record",  # 物料倒冲记录模型
                "apps.kuaizhizao.models.batching_order",  # 备料单模型
                "apps.kuaizhizao.models.customer_material_registration",  # 客户来料登记模型
                "apps.kuaizhizao.models.delivery_delay_exception",  # 延期异常模型
                "apps.kuaizhizao.models.delivery_notice",  # 送货通知模型
                "apps.kuaizhizao.models.disassembly_order",  # 拆解单模型
                "apps.kuaizhizao.models.document_node_timing",  # 单据节点耗时模型
                "apps.kuaizhizao.models.equipment",  # 设备基础模型
                "apps.kuaizhizao.models.equipment_fault",  # 设备故障模型
                "apps.kuaizhizao.models.equipment_point_inspection",  # 设备点检模型
                "apps.kuaizhizao.models.equipment_status_monitor",  # 设备状态监控模型
                "apps.kuaizhizao.models.exception_process_record",  # 异常处理记录模型
                "apps.kuaizhizao.models.inspection_plan",  # 质检方案模型
                "apps.kuaizhizao.models.inventory_alert",  # 库存预警模型
                "apps.kuaizhizao.models.inventory_transfer",  # 库存调拨模型
                "apps.kuaizhizao.models.launch_countdown",  # 上线倒计时模型
                "apps.kuaizhizao.models.line_side_inventory",  # 线边仓库存模型
                "apps.kuaizhizao.models.maintenance_plan",  # 维护计划模型
                "apps.kuaizhizao.models.maintenance_reminder",  # 维护提醒模型
                "apps.kuaizhizao.models.material_borrow",  # 物料借出模型
                "apps.kuaizhizao.models.material_borrow_item",  # 物料借出明细模型
                "apps.kuaizhizao.models.material_call_request",  # 叫料请求模型
                "apps.kuaizhizao.models.material_call_request_item",  # 叫料单明细模型
                "apps.kuaizhizao.models.station_andon_call",  # 工位安灯
                "apps.kuaizhizao.models.station_sop_acknowledgment",  # 工位SOP确认
                "apps.kuaizhizao.models.station_operation_downtime",  # 工位停机
                "apps.kuaizhizao.models.material_return",  # 物料退回（非生产）模型
                "apps.kuaizhizao.models.material_return_item",  # 物料退回明细模型
                "apps.kuaizhizao.models.material_shortage_exception",  # 缺料异常模型
                "apps.kuaizhizao.models.mold",  # 模具模型
                "apps.kuaizhizao.models.other_inbound",  # 其他入库模型
                "apps.kuaizhizao.models.other_inbound_item",  # 其他入库明细模型
                "apps.kuaizhizao.models.other_outbound",  # 其他出库模型
                "apps.kuaizhizao.models.other_outbound_item",  # 其他出库明细模型
                "apps.kuaizhizao.models.quality_exception",  # 质量异常模型
                "apps.kuaizhizao.models.quality_standard",  # 质量标准模型
                "apps.kuaizhizao.models.quotation",  # 报价单模型
                "apps.kuaizhizao.models.receipt_notice",  # 收货通知模型
                "apps.kuaizhizao.models.replenishment_suggestion",  # 补货建议模型
                "apps.kuaizhizao.models.customer_follow_up",  # 客户跟进记录模型
                "apps.kuaizhizao.models.scheduling_config",  # 排程配置模型
                "apps.kuaizhizao.models.work_order_score",  # 工单综合打分快照
                "apps.kuaizhizao.models.shipment_notice",  # 发货通知模型
                "apps.kuaizhizao.models.spare_part",  # 备品备件模型
                "apps.kuaizhizao.models.state_transition",  # 状态流转规则模型
                "apps.kuaizhizao.models.stocktaking",  # 库存盘点模型
                "apps.kuaizhizao.models.tool",  # 工装器具模型
                # 好力 GO（客户专用，表前缀 haoligo_，与快制造设备/模具逻辑隔离）
                "apps.haoligo.models.equipment",
                "apps.haoligo.models.equipment_operations",
                "apps.haoligo.models.equipment_upkeep",
                "apps.haoligo.models.equipment_upkeep_param",
                "apps.haoligo.models.equipment_status_log",
                "apps.haoligo.models.mold",
                "apps.haoligo.models.mold_upkeep",
                "apps.haoligo.models.mold_warehouse",
                "apps.haoligo.models.mold_borrow_sheet",
                "apps.haoligo.models.mold_borrow_dataset_binding",
                "apps.haoligo.models.mold_return_sheet",
                "apps.haoligo.models.mold_trial_sheet",
                "apps.haoligo.models.mold_trial_dataset_binding",
                "apps.haoligo.models.mold_ledger_dataset_binding",
                "apps.haoligo.models.mold_maintenance_complete_sheet",
                "apps.haoligo.models.mold_maintenance_sheet",
                "apps.haoligo.models.mold_outsource_maintenance_complete_sheet",
                "apps.haoligo.models.mold_outsource_maintenance_sheet",
                "apps.haoligo.models.patrol",
                "apps.haoligo.models.quality",
                "apps.haoligo.models.quality_dataset_binding",
                # KU-AI
                "apps.kuaiai.models.knowledge",
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


async def init_tortoise_dynamic() -> None:
    """
    使用动态配置初始化 Tortoise（API 与 Taskiq worker 共用）。

    若已初始化则直接返回，避免重复 init。
    """
    if Tortoise._inited:
        return

    # 使用动态配置生成器获取配置
    config = await get_dynamic_tortoise_config()

    # 确保 routers 字段存在且是列表（不能是 None）
    if "routers" not in config or config["routers"] is None:
        config["routers"] = []

    # 确保 use_tz 和 timezone 字段存在
    if "use_tz" not in config:
        config["use_tz"] = settings.USE_TZ if hasattr(settings, "USE_TZ") else False
    if "timezone" not in config:
        config["timezone"] = settings.TIMEZONE if hasattr(settings, "TIMEZONE") else "UTC"

    logger.debug(
        f"Tortoise ORM 配置: routers={config.get('routers')}, "
        f"use_tz={config.get('use_tz')}, timezone={config.get('timezone')}"
    )

    await Tortoise.init(config=config)
    logger.info("Tortoise ORM 初始化完成")

    from tortoise import connections

    try:
        connections.get("default")
        logger.debug("Tortoise ORM 连接验证成功")

        if hasattr(Tortoise, "_router") and Tortoise._router is not None:
            if hasattr(Tortoise._router, "_routers"):
                routers = Tortoise._router._routers
                if routers is None:
                    logger.warning("⚠️ Tortoise ORM router._routers 是 None，尝试修复...")
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


async def init_tortoise_for_worker_process() -> None:
    """
    Taskiq worker 独立进程：在消费任务前初始化 Tortoise。

    FastAPI 通过 lifespan 调用 init_tortoise_dynamic()；worker 不会走 lifespan，
    必须在 broker 的 WORKER_STARTUP 中调用本函数，否则依赖 ORM 的任务（如数据备份）
    会在首次查询前失败，业务状态会一直保持 pending。
    """
    logger.info("🔧 Taskiq worker: 初始化 Tortoise ORM ...")
    await init_tortoise_dynamic()
    logger.info("✅ Taskiq worker: Tortoise ORM 已就绪")


async def register_db(app) -> None:
    """
    注册数据库组件到 FastAPI 应用

    使用动态配置生成Tortoise ORM配置，只加载活跃应用的模型

    Args:
        app: FastAPI 应用实例
    """
    logger.info("🔧 注册动态 Tortoise ORM 到 FastAPI 应用")

    try:
        await init_tortoise_dynamic()
        # 连接关闭改由 main.py 的 lifespan (yield 之后) 统一管理，
        # 避免与已弃用的 @app.on_event("shutdown") 并存。

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
