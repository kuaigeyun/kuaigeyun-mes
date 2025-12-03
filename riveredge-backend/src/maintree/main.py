"""
RiverEdge MainTree - SaaS平台主服务

作为平台宿主的后端服务，整合soil模块提供平台级功能。
"""

import os
import sys
from pathlib import Path
from contextlib import asynccontextmanager
from fastapi import FastAPI
from fastapi.middleware.cors import CORSMiddleware
from fastapi.responses import HTMLResponse
from fastapi.staticfiles import StaticFiles
from datetime import datetime

# 添加src目录到Python路径
src_path = Path(__file__).parent.parent
sys.path.insert(0, str(src_path))

from src.soil.infrastructure.database.database import register_db

# 导入所有soil API路由
# 注意：SuperAdmin Auth已移除，使用Platform Admin Auth替代
from src.soil.api.tenants.tenants import router as tenants_router
from src.soil.api.packages.packages_config import router as packages_config_router
from src.soil.api.packages.packages import router as packages_router
from src.soil.api.platform_superadmin.platform_superadmin import router as platform_superadmin_router
from src.soil.api.platform_superadmin.auth import router as platform_superadmin_auth_router
from src.soil.api.auth.auth import router as auth_router
from src.soil.api.monitoring.statistics import router as monitoring_statistics_router
from src.soil.api.saved_searches.saved_searches import router as saved_searches_router

# 导入所有tree_root API路由（系统级功能）
import sys
sys.path.insert(0, str(Path(__file__).parent))

from tree_root.api.users.users import router as users_router
from tree_root.api.roles.roles import router as roles_router
from tree_root.api.permissions.permissions import router as permissions_router
from tree_root.api.departments.departments import router as departments_router
from tree_root.api.positions.positions import router as positions_router
from tree_root.api.data_dictionaries.data_dictionaries import router as data_dictionaries_router
from tree_root.api.system_parameters.system_parameters import router as system_parameters_router
from tree_root.api.code_rules.code_rules import router as code_rules_router
from tree_root.api.custom_fields.custom_fields import router as custom_fields_router
from tree_root.api.site_settings.site_settings import router as site_settings_router
from tree_root.api.invitation_codes.invitation_codes import router as invitation_codes_router
from tree_root.api.languages.languages import router as languages_router
from tree_root.api.applications.applications import router as applications_router
from tree_root.api.menus.menus import router as menus_router
from tree_root.api.integration_configs.integration_configs import router as integration_configs_router
from tree_root.api.files.files import router as files_router
from tree_root.api.apis.apis import router as apis_router
from tree_root.api.data_sources.data_sources import router as data_sources_router
from tree_root.api.datasets.datasets import router as datasets_router
from tree_root.api.messages.message_configs import router as message_configs_router
from tree_root.api.messages.message_templates import router as message_templates_router
from tree_root.api.messages.messages import router as messages_router
from tree_root.api.scheduled_tasks.scheduled_tasks import router as scheduled_tasks_router
from tree_root.api.approval_processes import approval_processes_router, approval_instances_router
from tree_root.api.electronic_records.electronic_records import router as electronic_records_router
from tree_root.api.scripts.scripts import router as scripts_router
from tree_root.api.print_templates.print_templates import router as print_templates_router
from tree_root.api.print_devices.print_devices import router as print_devices_router
from tree_root.api.user_profile.user_profile import router as user_profile_router
from tree_root.api.user_preferences.user_preferences import router as user_preferences_router
from tree_root.api.user_messages.user_messages import router as user_messages_router
from tree_root.api.user_tasks.user_tasks import router as user_tasks_router
from tree_root.api.operation_logs.operation_logs import router as operation_logs_router
from tree_root.api.login_logs.login_logs import router as login_logs_router
from tree_root.api.online_users.online_users import router as online_users_router
from tree_root.api.data_backups.data_backups import router as data_backups_router

# Inngest 集成
from tree_root.inngest.client import inngest_client
from inngest.fast_api import serve as inngest_serve

# 获取运行模式 - 默认为SaaS模式
MODE = os.getenv("MODE", "saas")


@asynccontextmanager
async def lifespan(app: FastAPI):
    """应用生命周期管理"""
    # 启动时初始化
    from tortoise import Tortoise
    from src.soil.infrastructure.database.database import TORTOISE_ORM
    
    # 先注册到 FastAPI（用于自动管理连接池）
    register_db(app)
    
    # 确保 Tortoise ORM 已初始化（显式初始化，避免路由器问题）
    if not Tortoise._inited:
        await Tortoise.init(config=TORTOISE_ORM)
    
    yield

    # 关闭时清理
    await Tortoise.close_connections()

# 创建FastAPI应用
app = FastAPI(
    title="RiverEdge SaaS Platform",
    description="RiverEdge SaaS 多组织框架 - 平台级后端服务",
    version="1.0.2",
    lifespan=lifespan,
    docs_url=None,  # 禁用默认docs，使用修复版本
    redoc_url="/redoc",
)

# 配置CORS
app.add_middleware(
    CORSMiddleware,
    allow_origins=["*"],  # 在生产环境中应该限制为具体域名
    allow_credentials=True,
    allow_methods=["*"],
    allow_headers=["*"],
)

# 注册操作日志中间件
from tree_root.middleware.operation_log_middleware import OperationLogMiddleware
app.add_middleware(OperationLogMiddleware)

# 挂载静态文件目录
app.mount("/static", StaticFiles(directory="src/static"), name="static")

# 注册 Inngest 服务
# 导入 Inngest 函数（确保函数被注册）
from tree_root.inngest.functions.test_function import test_integration_function

# 挂载 Inngest 服务端点
# serve() 函数需要 app, client, 和 functions 参数
inngest_serve(
    app,
    inngest_client,
    [test_integration_function]
)

# 健康检查端点
@app.get("/health")
async def health_check():
    """
    健康检查端点
    
    返回服务运行状态，用于监控和负载均衡器健康检查。
    """
    return {
        "status": "healthy",
        "service": "maintree"
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

# 平台级功能路由 (Platform Level APIs)
app.include_router(packages_config_router, prefix="/api/v1/platform")
app.include_router(packages_router, prefix="/api/v1/platform")
app.include_router(monitoring_statistics_router, prefix="/api/v1/platform")
# 注意：SuperAdmin Auth路由已移除，使用Platform Admin Auth (/api/v1/platform/auth) 替代
app.include_router(tenants_router, prefix="/api/v1/platform")
app.include_router(platform_superadmin_auth_router, prefix="/api/v1/platform")
app.include_router(platform_superadmin_router, prefix="/api/v1/platform")
app.include_router(saved_searches_router, prefix="/api/v1")

# 系统级功能路由 (System Level APIs)
app.include_router(users_router, prefix="/api/v1/system")
app.include_router(roles_router, prefix="/api/v1/system")
app.include_router(permissions_router, prefix="/api/v1/system")
app.include_router(departments_router, prefix="/api/v1/system")
app.include_router(positions_router, prefix="/api/v1/system")
app.include_router(data_dictionaries_router, prefix="/api/v1/system")
app.include_router(system_parameters_router, prefix="/api/v1/system")
app.include_router(code_rules_router, prefix="/api/v1/system")
app.include_router(custom_fields_router, prefix="/api/v1/system")
app.include_router(site_settings_router, prefix="/api/v1/system")
app.include_router(invitation_codes_router, prefix="/api/v1/system")
app.include_router(languages_router, prefix="/api/v1/system")
app.include_router(applications_router, prefix="/api/v1/system")
app.include_router(menus_router, prefix="/api/v1/system")
app.include_router(integration_configs_router, prefix="/api/v1/system")
app.include_router(files_router, prefix="/api/v1/system")
app.include_router(apis_router, prefix="/api/v1/system")
app.include_router(data_sources_router, prefix="/api/v1/system")
app.include_router(datasets_router, prefix="/api/v1/system")
app.include_router(message_configs_router, prefix="/api/v1/system")
app.include_router(message_templates_router, prefix="/api/v1/system")
app.include_router(messages_router, prefix="/api/v1/system")
app.include_router(scheduled_tasks_router, prefix="/api/v1/system")
app.include_router(approval_processes_router, prefix="/api/v1/system")
app.include_router(approval_instances_router, prefix="/api/v1/system")
app.include_router(electronic_records_router, prefix="/api/v1/system")
app.include_router(scripts_router, prefix="/api/v1/system")
app.include_router(print_templates_router, prefix="/api/v1/system")
app.include_router(print_devices_router, prefix="/api/v1/system")
app.include_router(user_profile_router, prefix="/api/v1/personal")
app.include_router(user_preferences_router, prefix="/api/v1/personal")
app.include_router(user_messages_router, prefix="/api/v1/personal")
app.include_router(user_tasks_router, prefix="/api/v1/personal")
app.include_router(operation_logs_router, prefix="/api/v1/system")
app.include_router(login_logs_router, prefix="/api/v1/system")
app.include_router(online_users_router, prefix="/api/v1/system")
app.include_router(data_backups_router, prefix="/api/v1/system")

# Inngest 测试端点
@app.post("/api/v1/test/inngest")
async def test_inngest_integration(message: str = "Hello from RiverEdge!"):
    """
    测试 Inngest 集成
    
    发送测试事件到 Inngest，验证集成是否正常工作。
    """
    from inngest import Event
    
    try:
        # 发送测试事件
        result = await inngest_client.send_event(
            event=Event(
                name="test/integration",
                data={
                    "message": message,
                    "timestamp": str(datetime.now()),
                }
            )
        )
        
        return {
            "success": True,
            "message": "事件已发送到 Inngest",
            "event_ids": result.ids if hasattr(result, "ids") else None,
        }
    except Exception as e:
        return {
            "success": False,
            "error": str(e),
            "message": "发送事件到 Inngest 失败",
        }

if __name__ == "__main__":
    import uvicorn
    uvicorn.run(
        "main:app",
        host="0.0.0.0",
        port=9000,
        reload=True,
        reload_dirs=["src"]
    )