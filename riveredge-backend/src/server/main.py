"""
RiverEdge App - SaaS平台主服务

作为平台宿主的后端服务，整合 infra 和 core 模块提供平台级和系统级功能。
"""

import os
import sys
import asyncio
from pathlib import Path
from contextlib import asynccontextmanager
from fastapi import FastAPI, APIRouter, Request, Response
from fastapi.middleware.cors import CORSMiddleware
from fastapi.responses import HTMLResponse
from fastapi.staticfiles import StaticFiles
from datetime import datetime
from loguru import logger

# 添加src目录到Python路径
src_path = Path(__file__).parent.parent
sys.path.insert(0, str(src_path))

from infra.infrastructure.database.database import register_db
from tortoise import Tortoise
from core.services.application.application_registry_service import ApplicationRegistryService
from core.services.application.application_route_manager import init_route_manager
from core.services.interfaces.service_initializer import ServiceInitializer

# 导入所有平台级 API 路由
# 注意：SuperAdmin Auth已移除，使用Platform Admin Auth替代
from infra.api.tenants.tenants import router as tenants_router
from infra.api.tenants.public import router as tenants_public_router
from infra.api.packages.packages_config import router as packages_config_router
from infra.api.packages.packages import router as packages_router
from infra.api.infra_superadmin.infra_superadmin import router as infra_superadmin_router
from infra.api.infra_superadmin.auth import router as infra_superadmin_auth_router
from infra.api.auth.auth import router as auth_router
from infra.api.monitoring.statistics import router as monitoring_statistics_router
from infra.api.saved_searches.saved_searches import router as saved_searches_router
from infra.api.init.init_wizard import router as init_wizard_router
from infra.api.templates.templates import router as industry_template_router
from infra.api.platform_settings.platform_settings import router as platform_settings_router
from infra.api.platform_settings.public import router as platform_settings_public_router
from infra.api.business_config.business_config import router as business_config_router

# 导入所有系统级 API 路由（core）
import sys
sys.path.insert(0, str(Path(__file__).parent))

from core.api.users.users import router as users_router
from core.api.roles.roles import router as roles_router
from core.api.permissions.permissions import router as permissions_router
from core.api.access.policies import router as access_policies_router
from core.api.departments.departments import router as departments_router
from core.api.positions.positions import router as positions_router
# 设备管理已迁移到 apps/kuaizhizao
# from core.api.equipment.equipment import router as equipment_router
# from core.api.maintenance_plans.maintenance_plans import router as maintenance_plans_router
# from core.api.equipment_faults.equipment_faults import router as equipment_faults_router
# from core.api.molds.molds import router as molds_router
from core.api.data_dictionaries.data_dictionaries import router as data_dictionaries_router
from core.api.system_parameters.system_parameters import router as system_parameters_router
from core.api.code_rules.code_rules import router as code_rules_router
from core.api.code_rules.material_code_rules import router as material_code_rules_router
from core.api.variant_attributes.variant_attributes import router as variant_attributes_router
from core.api.custom_fields.custom_fields import router as custom_fields_router
from core.api.site_settings.site_settings import router as site_settings_router
from core.api.invitation_codes.invitation_codes import router as invitation_codes_router
from core.api.languages.languages import router as languages_router
from core.api.applications.applications import router as applications_router
from core.api.menus.menus import router as menus_router
from core.api.integration_configs.integration_configs import router as integration_configs_router
from core.api.files.files import router as files_router
from core.api.files.public import router as files_public_router
from core.api.apis.apis import router as apis_router
from core.api.data_sources.data_sources import router as data_sources_router
from core.api.application_connections.application_connections import router as application_connections_router
from core.api.connector_definitions.connector_definitions import router as connector_definitions_router
from core.api.datasets.datasets import router as datasets_router
from core.api.messages.message_configs import router as message_configs_router
from core.api.messages.message_templates import router as message_templates_router
from core.api.messages.messages import router as messages_router
from core.api.scheduled_tasks.scheduled_tasks import router as scheduled_tasks_router
from core.api.approval_processes import approval_processes_router, approval_instances_router
from core.api.scripts.scripts import router as scripts_router
from core.api.print_templates.print_templates import router as print_templates_router
from core.api.print_devices.print_devices import router as print_devices_router
from core.api.working_hours_configs.working_hours_configs import router as working_hours_configs_router
from core.api.reports.report_templates import router as report_templates_router
from core.api.qrcode import router as qrcode_router
from core.api.websocket import websocket_router
from core.api.user_profile.user_profile import router as user_profile_router
from core.api.user_preferences.user_preferences import router as user_preferences_router
from core.api.user_messages.user_messages import router as user_messages_router
from core.api.user_tasks.user_tasks import router as user_tasks_router
from core.api.data_backups.data_backups import router as data_backups_router
from core.api.operation_logs.operation_logs import router as operation_logs_router
from core.api.document_tracking import router as document_tracking_router
from core.api.login_logs.login_logs import router as login_logs_router
from core.api.online_users.online_users import router as online_users_router
from core.api.help_documents.help_documents import router as help_documents_router
from core.api.ai.suggestions import router as ai_suggestions_router
from core.api.onboarding.onboarding import router as onboarding_router
from core.api.data_quality.data_quality import router as data_quality_router
from core.api.operation_guide.operation_guide import router as operation_guide_router
from core.api.launch_progress.launch_progress import router as launch_progress_router
from core.api.launch_checklist.launch_checklist import router as launch_checklist_router
from core.api.usage_analysis.usage_analysis import router as usage_analysis_router
from core.api.optimization_suggestion.optimization_suggestion import router as optimization_suggestion_router
from core.api.performance.performance import router as performance_router

# 插件管理器API
from core.api.plugin_manager.plugin_manager import router as plugin_manager_router

# 应用路由现在通过 ApplicationRegistryService 动态注册
# 无需手动导入应用路由模块

# Inngest 集成
try:
    from core.inngest.client import inngest_client
    from inngest.fast_api import serve as inngest_serve
    INNGEST_AVAILABLE = True
except ImportError:
    inngest_client = None
    inngest_serve = None
    INNGEST_AVAILABLE = False
    logger.warning("⚠️ Inngest 模块不可用，已禁用 Inngest 集成")

# 获取运行模式 - 默认为SaaS模式
MODE = os.getenv("MODE", "saas")


@asynccontextmanager
async def lifespan(app: FastAPI):
    """应用生命周期管理"""
    # 注册 Tortoise ORM 数据库连接
    await register_db(app)
    logger.info("✅ Tortoise ORM 已注册")
    
    # 初始化 Redis 连接
    try:
        from infra.infrastructure.cache.cache import cache
        await cache.connect()
        logger.info("✅ Redis 连接已初始化")
    except Exception as e:
        logger.error(f"❌ Redis 连接初始化失败: {e}")
        # Redis 连接失败不影响应用启动，但会影响相关功能
        logger.warning("⚠️  在线用户等功能将不可用")

    # 初始化服务接口层（系统级）
    await ServiceInitializer.initialize_services()
    logger.info("✅ 系统级服务接口层已初始化")
    
    # ⚠️ 第三阶段改进：初始化平台级服务接口层
    from infra.services.interfaces.service_initializer import InfraServiceInitializer
    await InfraServiceInitializer.initialize_services()
    logger.info("✅ 平台级服务接口层已初始化")

    # ⚠️ 第一阶段改进：初始化应用路由管理器
    init_route_manager(app)
    logger.info("✅ 应用路由管理器已初始化")

    # 数据库连接建立后，重新初始化应用注册服务（使用真实的数据库数据）
    await ApplicationRegistryService.reload_apps()
    logger.info("✅ 应用注册服务已重新初始化")
    
    # 在lifespan中加载插件路由（确保路由管理器已初始化）
    # 注意：路由已经在 ApplicationRegistryService.reload_apps() 中注册到 ApplicationRouteManager
    # 这里只需要确保路由已经注册到 FastAPI app
    load_plugin_routes()
    logger.info("✅ 插件路由已加载")
    
    # 验证路由注册情况
    from core.services.application.application_route_manager import get_route_manager
    route_manager = get_route_manager()
    if route_manager:
        registered_apps = ApplicationRegistryService.get_registered_routes()
        logger.info(f"📊 路由注册验证: 已注册 {len(registered_apps)} 个应用的路由")
        for app_code, routers in registered_apps.items():
            # 检查路由是否真的在 FastAPI app 中
            app_routes = [route.path for route in app.routes if hasattr(route, 'path') and f'/apps/{app_code}' in route.path]
            logger.info(f"   - {app_code}: {len(routers)} 个路由器, {len(app_routes)} 个路由已注册到 FastAPI")
            if app_routes:
                logger.debug(f"      路由示例: {app_routes[:3]}")

    yield

    # 关闭 Redis 连接
    try:
        from infra.infrastructure.cache.cache import cache
        await cache.disconnect()
        logger.info("✅ Redis 连接已关闭")
    except Exception as e:
        logger.warning(f"关闭 Redis 连接时出错: {e}")
    
    # ⚠️ 注意：close_db_connections 已经在 register_db 中注册为 shutdown 事件
    # 这里不需要再次关闭，避免重复关闭导致错误
    # await Tortoise.close_connections()
    logger.info("✅ 应用关闭中...")

# 创建FastAPI应用
app = FastAPI(
    title="RiverEdge SaaS Platform",
    description="RiverEdge SaaS 多组织框架 - 平台级后端服务",
    version="1.0.2",
    lifespan=lifespan,
    docs_url=None,  # 禁用默认docs，使用修复版本
    redoc_url="/redoc",
)

# 配置CORS（从配置文件读取）
from infra.config.infra_config import infra_settings
app.add_middleware(
    CORSMiddleware,
    allow_origins=infra_settings.get_cors_origins(),  # 从环境变量配置读取
    allow_credentials=infra_settings.CORS_ALLOW_CREDENTIALS,
    allow_methods=infra_settings.CORS_ALLOW_METHODS,
    allow_headers=infra_settings.CORS_ALLOW_HEADERS,
)

# 注册统一异常处理中间件（应该在其他中间件之前注册）
from core.middleware.exception_handler_middleware import ExceptionHandlerMiddleware
app.add_middleware(ExceptionHandlerMiddleware)

# 注册性能监控中间件（在操作日志中间件之前，以便记录性能指标）
from core.middleware.performance_middleware import PerformanceMiddleware
app.add_middleware(PerformanceMiddleware)

# 注册操作日志中间件
from core.middleware.operation_log_middleware import OperationLogMiddleware
app.add_middleware(OperationLogMiddleware)

# 动态加载插件路由
# 使用新的插件管理器进行动态插件加载
def load_plugin_routes():
    """
    动态加载插件路由

    使用ApplicationRegistryService注册应用路由。
    ⚠️ 第一阶段改进：路由现在通过 ApplicationRouteManager 管理
    """
    try:
        # 获取已注册的应用路由
        registered_routes = ApplicationRegistryService.get_registered_routes()

        # ⚠️ 第一阶段改进：通过路由管理器注册路由（如果已初始化）
        from core.services.application.application_route_manager import get_route_manager
        route_manager = get_route_manager()
        
        if route_manager:
            # 使用路由管理器注册路由
            for app_code, routers in registered_routes.items():
                route_manager.register_app_routes(app_code, routers)
                logger.info(f"✅ 通过路由管理器注册应用 {app_code} 的路由（{len(routers)} 个路由器）")
        else:
            # 向后兼容：如果路由管理器未初始化，使用旧方式
            logger.warning("⚠️ 路由管理器未初始化，使用兼容模式注册路由")
            for app_code, routers in registered_routes.items():
                for router in routers:
                    app.include_router(router, prefix="/api/v1")
                    logger.info(f"✅ 已注册应用 {app_code} 的路由（兼容模式）")

        total_routes = sum(len(routers) for routers in registered_routes.values())
        if total_routes > 0:
            logger.info(f"✅ 总共注册了 {total_routes} 个应用路由")
        else:
            logger.warning("⚠️ 没有注册任何应用路由 - 请检查应用是否被发现")
        logger.info(f"🎉 应用路由注册完成，共注册 {total_routes} 个路由对象")

    except Exception as e:
        logger.error(f"⚠️ 应用路由注册失败: {str(e)}")
        import traceback
        traceback.print_exc()

# 注意：插件路由现在在lifespan中加载，确保路由管理器和应用注册服务都已初始化
# load_plugin_routes()  # 已移至lifespan中调用

# 挂载静态文件目录
import os
static_dir = os.path.join(os.path.dirname(__file__), "..", "..", "static")
os.makedirs(static_dir, exist_ok=True)
app.mount("/static", StaticFiles(directory=static_dir), name="static")

# 注册 Inngest 服务
# 导入 Inngest 函数（确保函数被注册）
# 注意：函数导入已在__init__.py中处理导入错误和可用性检查
if INNGEST_AVAILABLE:
    try:
        # 定时任务调度器/执行器已从 Inngest 注册中移除（系统定时任务功能保留，仅不再通过 Inngest 自动执行）
        from core.inngest.functions import (
            test_integration_function,
            message_sender_function,
            approval_workflow_function,
            approval_action_workflow_function,
            sop_execution_workflow_function,
            sop_node_complete_workflow_function,
            material_ai_suggestion_workflow,
            material_change_notification_workflow,
            data_backup_workflow,
            data_restore_workflow,
        )
        
        # 准备所有 Inngest 函数列表（过滤掉 None 值）
        inngest_functions = [
            func for func in [
                test_integration_function,
                message_sender_function,
                approval_workflow_function,
                approval_action_workflow_function,
                sop_execution_workflow_function,
                sop_node_complete_workflow_function,
                material_ai_suggestion_workflow,
                material_change_notification_workflow,
                data_backup_workflow,
                data_restore_workflow,
            ] if func is not None
        ]
        
        # 注册 Inngest 服务端点（serve 会直接向 app 添加 /api/inngest 路由）
        if inngest_functions:
            inngest_serve(app, inngest_client, inngest_functions)
            logger.info(f"✅ Inngest 服务端点注册成功")
            logger.info(f"✅ 已注册 {len(inngest_functions)} 个 Inngest 函数")
            logger.info(f"✅ Inngest 端点路径: /api/inngest")
        else:
            logger.warning("⚠️ 没有可用的 Inngest 函数，跳过服务端点注册")
            
    except Exception as e:
        logger.error(f"❌ Inngest 服务端点注册失败: {e}")
        import traceback
        traceback.print_exc()
else:
    logger.info("ℹ️ Inngest 模块不可用，跳过 Inngest 服务端点注册")

# 健康检查端点
@app.get("/health")
async def health_check():
    """
    健康检查端点
    
    返回服务运行状态，用于监控和负载均衡器健康检查。
    """
    return {
        "status": "healthy",
        "service": "riveredge-backend"
    }

# 调试端点：仅开发环境可用，生产环境不注册
def _is_debug_allowed() -> bool:
    env = os.getenv("ENVIRONMENT", "development")
    debug = os.getenv("DEBUG", "false").lower() == "true"
    return env == "development" or debug


if _is_debug_allowed():
    @app.post("/debug/reload-apps")
    async def debug_reload_apps():
        """手动重新加载应用路由（仅开发环境可用）"""
        from core.services.application.application_registry_service import ApplicationRegistryService

        try:
            await ApplicationRegistryService.reload_apps()
            return {"status": "success", "message": "应用路由重新加载完成"}
        except Exception as e:
            logger.error(f"应用路由重新加载失败: {e}")
            return {"status": "error", "message": f"应用路由重新加载失败: {str(e)}"}

    @app.post("/debug/init-apps")
    async def debug_init_apps():
        """扫描插件目录并注册应用到数据库（仅开发环境可用）"""
        from core.services.application.application_service import ApplicationService
        from core.services.application.application_registry_service import ApplicationRegistryService

        try:
            tenant_id = 1
            apps = await ApplicationService.scan_and_register_plugins(tenant_id)
            await ApplicationRegistryService.reload_apps()
            return {
                "status": "success",
                "message": f"应用初始化完成，共注册了 {len(apps)} 个应用",
                "apps": [{"code": app["code"], "name": app["name"]} for app in apps]
            }
        except Exception as e:
            return {"status": "error", "message": f"应用初始化失败: {str(e)}"}

# 测试路由注册（调试用）
@app.post("/debug/test-route-registration")
async def debug_test_route_registration():
    """
    测试路由注册功能（调试用）
    """
    from core.services.application.application_registry_service import ApplicationRegistryService
    from core.services.application.application_route_manager import get_route_manager

    try:
        # 手动注册master-data应用
        success = await ApplicationRegistryService.register_single_app("master-data")
        route_manager = get_route_manager()

        return {
            "status": "success",
            "message": f"master-data注册结果: {success}",
            "route_manager": route_manager is not None,
            "registered_apps": list(ApplicationRegistryService._registered_apps.keys()),
            "registered_routes": list(ApplicationRegistryService._registered_routes.keys()),
            "route_manager_registered_routes": list(route_manager._registered_routes.keys()) if route_manager else [],
        }
    except Exception as e:
        return {
            "status": "error",
            "message": f"路由注册测试失败: {str(e)}",
        }

# 检查路由管理器状态（调试用）
@app.get("/debug/route-manager-status")
async def debug_route_manager_status():
    """
    检查路由管理器状态（调试用）
    """
    from core.services.application.application_route_manager import get_route_manager

    route_manager = get_route_manager()
    if not route_manager:
        return {"status": "error", "message": "路由管理器未初始化"}

    return {
        "status": "success",
        "route_manager_id": id(route_manager),
        "app_id": id(route_manager.app),
        "registered_routes_count": {app_code: len(routers) for app_code, routers in route_manager._registered_routes.items()},
        "total_fastapi_routes": len(route_manager.app.routes),
    }

# 查看FastAPI路由表（调试用）
@app.get("/debug/fastapi-routes")
async def debug_fastapi_routes():
    """
    查看FastAPI路由表（调试用）
    """
    routes = []
    for route in app.routes:
        if hasattr(route, 'path'):
            routes.append({
                "path": route.path,
                "methods": getattr(route, 'methods', []),
                "name": getattr(route, 'name', ''),
            })

    # 过滤出应用路由
    app_routes = [r for r in routes if '/apps/' in r['path']]

    return {
        "total_routes": len(routes),
        "app_routes": len(app_routes),
        "sample_app_routes": app_routes[:10] if app_routes else [],
        "all_app_route_paths": [r['path'] for r in app_routes]
    }

# 检查数据库中的应用（调试用）
@app.get("/debug/db-apps")
async def debug_db_apps():
    """
    检查数据库中的应用记录（调试用）
    """
    from infra.infrastructure.database.database import get_db_connection
    import json

    try:
        conn = await get_db_connection()
        rows = await conn.fetch("""
            SELECT code, name, is_active, is_installed
            FROM core_applications
            WHERE tenant_id = 1 AND deleted_at IS NULL
            ORDER BY code
        """)
        await conn.close()

        apps = []
        for row in rows:
            apps.append(dict(row))

        return {
            "status": "success",
            "apps": apps,
            "count": len(apps)
        }
    except Exception as e:
        return {
            "status": "error",
            "message": f"数据库查询失败: {str(e)}",
        }

# 查看已注册的应用和路由（调试用，简化输出）
@app.get("/debug/registered-routes")
async def debug_registered_routes():
    """
    查看已注册的应用和路由（调试用）

    返回已注册的应用列表和路由数量。
    """
    from core.services.application.application_registry_service import ApplicationRegistryService
    from core.services.application.application_route_manager import get_route_manager
    
    try:
        registered_routes = ApplicationRegistryService.get_registered_routes()
        route_manager = get_route_manager()
        registered_apps = ApplicationRegistryService._registered_apps
        
        return {
            "status": "success",
            "registered_apps": list(registered_apps.keys()),
            "registered_routes_count": {app_code: len(routers) for app_code, routers in registered_routes.items()},
            "route_manager_initialized": route_manager is not None,
        }
    except Exception as e:
        logger.error(f"获取已注册路由失败: {e}")
        return {
            "status": "error",
            "message": f"获取已注册路由失败: {str(e)}",
        }

# ⚠️ 第二阶段改进：服务健康检查端点
@app.get("/health/services")
async def health_check_services():
    """
    服务健康检查端点
    
    检查所有已注册服务的健康状态。
    """
    try:
        from core.services.interfaces.service_registry import service_registry
        health_info = await service_registry.health_check_all()
        return {
            "status": "healthy",
            "services": health_info
        }
    except Exception as e:
        return {
            "status": "error",
            "error": str(e),
            "message": "服务健康检查失败，请检查服务注册状态"
        }

# 修复的FastAPI原生文档
@app.get("/docs", include_in_schema=False)
async def docs():
    """修复的Swagger UI文档"""
    html_content = """<!DOCTYPE html>
<html>
<head>
<link type="text/css" rel="stylesheet" href="/static/swagger-ui/swagger-ui.css">
<link rel="shortcut icon" href="https://fastapi.tiangolo.com/img/favicon.png">
<title>RiverEdge SaaS Platform - Swagger UI</title>
</head>
<body>
<div id="swagger-ui"></div>
<script src="/static/swagger-ui/swagger-ui-bundle.js"></script>
<script>
const ui = SwaggerUIBundle({
    url: '/openapi.json',
    dom_id: '#swagger-ui',
    layout: 'BaseLayout',
    deepLinking: true,
    showExtensions: true,
    showCommonExtensions: true,
    oauth2RedirectUrl: window.location.origin + '/docs/oauth2-redirect',
    presets: [
        SwaggerUIBundle.presets.apis,
        SwaggerUIBundle.SwaggerUIStandalonePreset
    ]
});
</script>
</body>
</html>"""
    return HTMLResponse(content=html_content)

# 注册API路由

# 用户认证路由 (User Authentication APIs)
app.include_router(auth_router, prefix="/api/v1")

# 公开的组织接口（不需要认证，用于注册等功能）
app.include_router(tenants_public_router, prefix="/api/v1")
# 公开的平台设置接口（不需要认证，用于登录页等）
app.include_router(platform_settings_public_router, prefix="/api/v1/infra")
# 公开的文件接口（不需要认证，用于平台LOGO等公开资源）
app.include_router(files_public_router, prefix="/api/v1/core")

# 平台级功能路由 (Platform Level APIs) - 对应 infra/ 文件夹
app.include_router(packages_config_router, prefix="/api/v1/infra")
app.include_router(packages_router, prefix="/api/v1/infra")
app.include_router(monitoring_statistics_router, prefix="/api/v1/infra")
# 注意：SuperAdmin Auth路由已移除，使用Platform Admin Auth (/api/v1/infra/auth) 替代
app.include_router(tenants_router, prefix="/api/v1/infra")
app.include_router(infra_superadmin_auth_router, prefix="/api/v1/infra")
app.include_router(infra_superadmin_router, prefix="/api/v1/infra")
app.include_router(saved_searches_router, prefix="/api/v1")
app.include_router(init_wizard_router, prefix="/api/v1/infra")
app.include_router(industry_template_router, prefix="/api/v1/infra")
app.include_router(platform_settings_router, prefix="/api/v1/infra")
app.include_router(business_config_router, prefix="/api/v1/infra")

# 系统级功能路由 (System Level APIs) - 对应 core/ 文件夹
app.include_router(users_router, prefix="/api/v1/core")
app.include_router(roles_router, prefix="/api/v1/core")
app.include_router(permissions_router, prefix="/api/v1/core")
app.include_router(access_policies_router, prefix="/api/v1/core")
app.include_router(departments_router, prefix="/api/v1/core")
app.include_router(positions_router, prefix="/api/v1/core")
# 设备管理已迁移到 apps/kuaizhizao，通过 ApplicationRegistryService 自动注册
# app.include_router(equipment_router, prefix="/api/v1/core")
# app.include_router(maintenance_plans_router, prefix="/api/v1/core")
# app.include_router(equipment_faults_router, prefix="/api/v1/core")
# app.include_router(molds_router, prefix="/api/v1/core")
app.include_router(data_dictionaries_router, prefix="/api/v1/core")
app.include_router(system_parameters_router, prefix="/api/v1/core")
app.include_router(code_rules_router, prefix="/api/v1/core")
app.include_router(material_code_rules_router, prefix="/api/v1/core")
app.include_router(variant_attributes_router, prefix="/api/v1/core")
app.include_router(custom_fields_router, prefix="/api/v1/core")
app.include_router(site_settings_router, prefix="/api/v1/core")
app.include_router(invitation_codes_router, prefix="/api/v1/core")
app.include_router(languages_router, prefix="/api/v1/core")
app.include_router(applications_router, prefix="/api/v1/core")
app.include_router(menus_router, prefix="/api/v1/core")
app.include_router(integration_configs_router, prefix="/api/v1/core")
app.include_router(files_router, prefix="/api/v1/core")
app.include_router(apis_router, prefix="/api/v1/core")
app.include_router(data_sources_router, prefix="/api/v1/core")
app.include_router(application_connections_router, prefix="/api/v1/core")
app.include_router(connector_definitions_router, prefix="/api/v1/core")
app.include_router(datasets_router, prefix="/api/v1/core")
app.include_router(message_configs_router, prefix="/api/v1/core")
app.include_router(message_templates_router, prefix="/api/v1/core")
app.include_router(messages_router, prefix="/api/v1/core")
app.include_router(scheduled_tasks_router, prefix="/api/v1/core")
app.include_router(approval_processes_router, prefix="/api/v1/core")
app.include_router(approval_instances_router, prefix="/api/v1/core")
app.include_router(scripts_router, prefix="/api/v1/core")
app.include_router(print_templates_router, prefix="/api/v1/core")
app.include_router(print_devices_router, prefix="/api/v1/core")
app.include_router(working_hours_configs_router, prefix="/api/v1/core")
app.include_router(report_templates_router, prefix="/api/v1/core")
app.include_router(qrcode_router, prefix="/api/v1/core")
app.include_router(websocket_router, prefix="/api/v1/core")
app.include_router(user_profile_router, prefix="/api/v1/personal")
app.include_router(user_preferences_router, prefix="/api/v1/personal")
app.include_router(user_messages_router, prefix="/api/v1/personal")
app.include_router(user_tasks_router, prefix="/api/v1/personal")
app.include_router(data_backups_router, prefix="/api/v1/core")
app.include_router(operation_logs_router, prefix="/api/v1/core")
app.include_router(document_tracking_router, prefix="/api/v1/core")
app.include_router(login_logs_router, prefix="/api/v1/core")
app.include_router(online_users_router, prefix="/api/v1/core")
app.include_router(help_documents_router, prefix="/api/v1/core")
app.include_router(ai_suggestions_router, prefix="/api/v1/core")
app.include_router(onboarding_router, prefix="/api/v1/core")
app.include_router(data_quality_router, prefix="/api/v1/core")
app.include_router(operation_guide_router, prefix="/api/v1/core")
app.include_router(launch_progress_router, prefix="/api/v1/core")
app.include_router(launch_checklist_router, prefix="/api/v1/core")
app.include_router(usage_analysis_router, prefix="/api/v1/core")
app.include_router(optimization_suggestion_router, prefix="/api/v1/core")
app.include_router(performance_router, prefix="/api/v1/core")

# 插件管理器路由 (Plugin Manager APIs)
app.include_router(plugin_manager_router, prefix="/api/v1/core")

# 应用级功能路由现在通过 ApplicationRegistryService 动态注册
# kuaireport 静态注册，确保报表/大屏 API 始终可用（动态注册可能因应用未安装而失败）
try:
    from apps.kuaireport.api.router import router as kuaireport_router
    app.include_router(kuaireport_router, prefix="/api/v1/apps/kuaireport")
except ImportError as e:
    logger.warning(f"⚠️ 无法加载 kuaireport 路由: {e}")

# Inngest 测试端点 - 暂时禁用
# @app.post("/api/v1/test/inngest")
# async def test_inngest_integration(message: str = "Hello from RiverEdge!"):
#     """
#     测试 Inngest 集成
#
#     发送测试事件到 Inngest，验证集成是否正常工作。
#     """
#     from inngest import Event
#
#     try:
#         # 发送测试事件
#         result = await inngest_client.send(
#             Event(
#                 name="test/integration",
#                 data={
#                     "message": message,
#                     "timestamp": str(datetime.now()),
#                 }
#             )
#         )
#
#         return {
#             "success": True,
#             "message": "事件已发送到 Inngest",
#             "event_ids": result.ids if hasattr(result, "ids") else None,
#         }
#     except Exception as e:
#         return {
#             "success": False,
#             "error": str(e),
#             "message": "发送事件到 Inngest 失败",
#         }

if __name__ == "__main__":
    import uvicorn
    from infra.config.infra_config import infra_settings
    uvicorn.run(
        "main:app",
        host=infra_settings.HOST,  # 从环境变量读取
        port=infra_settings.PORT,  # 从环境变量读取
        reload=True,
        reload_dirs=["src"],
        reload_includes=["*.py"],  # 只监听 Python 文件
        reload_excludes=[
            "**/__pycache__/**",
            "**/*.pyc",
            "**/*.pyo",
            "**/*.pyd",
            "**/.git/**",
            "**/.venv/**",
            "**/venv*/**",
            "**/node_modules/**",
            "**/.mypy_cache/**",
            "**/.pytest_cache/**",
            "**/.ruff_cache/**",
            "**/*.log",
            "**/*.tmp",
            "**/.DS_Store",
            "**/Thumbs.db",
            "**/.vscode/**",
            "**/.idea/**",
            "**/migrations/**",
            "**/tests/**",
            "**/test_*.py",
            "**/*_test.py",
            "**/conftest.py",
            "**/.logs/**",
            "**/logs/**",
            "**/static/**",
            "**/templates/**",
            "**/*.sql",
            "**/*.sqlite",
            "**/*.db",
            "**/scripts/**",
        ],
        reload_delay=1.0,  # 增加检测间隔到 1 秒
    )
