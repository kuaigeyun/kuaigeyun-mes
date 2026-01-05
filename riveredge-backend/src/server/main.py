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

# 导入所有系统级 API 路由（core）
import sys
sys.path.insert(0, str(Path(__file__).parent))

from core.api.users.users import router as users_router
from core.api.roles.roles import router as roles_router
from core.api.permissions.permissions import router as permissions_router
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
from core.api.custom_fields.custom_fields import router as custom_fields_router
from core.api.site_settings.site_settings import router as site_settings_router
from core.api.invitation_codes.invitation_codes import router as invitation_codes_router
from core.api.languages.languages import router as languages_router
from core.api.applications.applications import router as applications_router
from core.api.menus.menus import router as menus_router
from core.api.integration_configs.integration_configs import router as integration_configs_router
from core.api.files.files import router as files_router
from core.api.apis.apis import router as apis_router
from core.api.data_sources.data_sources import router as data_sources_router
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
from core.api.user_profile.user_profile import router as user_profile_router
from core.api.user_preferences.user_preferences import router as user_preferences_router
from core.api.user_messages.user_messages import router as user_messages_router
from core.api.user_tasks.user_tasks import router as user_tasks_router
from core.api.operation_logs.operation_logs import router as operation_logs_router
from core.api.login_logs.login_logs import router as login_logs_router
from core.api.online_users.online_users import router as online_users_router
from core.api.help_documents.help_documents import router as help_documents_router
from core.api.ai.suggestions import router as ai_suggestions_router
from core.api.onboarding.onboarding import router as onboarding_router

# 插件管理器API
from core.api.plugin_manager.plugin_manager import router as plugin_manager_router

# 应用路由现在通过 ApplicationRegistryService 动态注册
# 无需手动导入应用路由模块

# Inngest 集成 - 暂时禁用以便测试
# from core.inngest.client import inngest_client
# from inngest.fast_api import serve as inngest_serve

# 获取运行模式 - 默认为SaaS模式
MODE = os.getenv("MODE", "saas")


@asynccontextmanager
async def lifespan(app: FastAPI):
    """应用生命周期管理"""
    # 注册 Tortoise ORM 数据库连接
    await register_db(app)
    logger.info("✅ Tortoise ORM 已注册")

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
try:
    from core.inngest.functions.test_function import test_integration_function
except ImportError:
    # 测试环境可能没有inngest，跳过导入
    test_integration_function = None
from core.inngest.functions import (
    message_sender_function,
    scheduled_task_executor_function,
    scheduled_task_scheduler_function,
    approval_workflow_function,
    approval_action_workflow_function,
    sop_execution_workflow_function,
    sop_node_complete_workflow_function,
)

# 挂载 Inngest 服务端点 - 暂时禁用
# serve() 函数需要 app, client, 和 functions 参数
# 必须注册所有 Inngest 函数，确保它们被 Inngest Dev Server 发现
try:
    # inngest_serve(
    #     app,
    #     inngest_client,
    #     [
    #         # 测试函数
    #         test_integration_function,
    #         # 消息发送
    #         message_sender_function,
    #         # 定时任务
    #         scheduled_task_executor_function,
    #         scheduled_task_scheduler_function,
    #         # 审批流程
    #         approval_workflow_function,
    #         approval_action_workflow_function,
    #         # SOP执行流程
    #         sop_execution_workflow_function,
    #         sop_node_complete_workflow_function,
    #     ]
    # )
    logger.info("ℹ️ Inngest 服务端点已暂时禁用")
    inngest_functions = [
        # test_integration_function,
        # message_sender_function,
        # scheduled_task_executor_function,
        # scheduled_task_scheduler_function,
        # approval_workflow_function,
        # approval_action_workflow_function,
        # sop_execution_workflow_function,
        # sop_node_complete_workflow_function,
    ]
    logger.info(f"ℹ️ Inngest 函数注册已暂时禁用，当前注册 {len(inngest_functions)} 个函数")
except Exception as e:
    logger.error(f"❌ Inngest 服务端点注册失败: {e}")
    import traceback
    traceback.print_exc()

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

# 手动重新加载应用路由（调试用）
@app.post("/debug/reload-apps")
async def debug_reload_apps():
    """
    手动重新加载应用路由（调试用）

    这是一个临时的调试端点，用于测试应用路由重新加载功能。
    """
    from core.services.application.application_registry_service import ApplicationRegistryService

    try:
        await ApplicationRegistryService.reload_apps()
        return {
            "status": "success",
            "message": "应用路由重新加载完成",
        }
    except Exception as e:
        logger.error(f"应用路由重新加载失败: {e}")
        return {
            "status": "error",
            "message": f"应用路由重新加载失败: {str(e)}",
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

# 系统级功能路由 (System Level APIs) - 对应 core/ 文件夹
app.include_router(users_router, prefix="/api/v1/core")
app.include_router(roles_router, prefix="/api/v1/core")
app.include_router(permissions_router, prefix="/api/v1/core")
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
app.include_router(user_profile_router, prefix="/api/v1/personal")
app.include_router(user_preferences_router, prefix="/api/v1/personal")
app.include_router(user_messages_router, prefix="/api/v1/personal")
app.include_router(user_tasks_router, prefix="/api/v1/personal")
app.include_router(operation_logs_router, prefix="/api/v1/core")
app.include_router(login_logs_router, prefix="/api/v1/core")
app.include_router(online_users_router, prefix="/api/v1/core")
app.include_router(help_documents_router, prefix="/api/v1/core")
app.include_router(ai_suggestions_router, prefix="/api/v1/core")
app.include_router(onboarding_router, prefix="/api/v1/core")

# 插件管理器路由 (Plugin Manager APIs)
app.include_router(plugin_manager_router, prefix="/api/v1/core")

# 应用级功能路由现在通过 ApplicationRegistryService 动态注册
# 无需手动注册应用路由

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
        reload_dirs=["src"]
    )