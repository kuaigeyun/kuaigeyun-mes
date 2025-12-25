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

# 添加src目录到Python路径
src_path = Path(__file__).parent.parent
sys.path.insert(0, str(src_path))

from infra.infrastructure.database.database import register_db
from tortoise import Tortoise

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

# 导入所有系统级 API 路由（core）
import sys
sys.path.insert(0, str(Path(__file__).parent))

from core.api.users.users import router as users_router
from core.api.roles.roles import router as roles_router
from core.api.permissions.permissions import router as permissions_router
from core.api.departments.departments import router as departments_router
from core.api.positions.positions import router as positions_router
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
from core.api.user_profile.user_profile import router as user_profile_router
from core.api.user_preferences.user_preferences import router as user_preferences_router
from core.api.user_messages.user_messages import router as user_messages_router
from core.api.user_tasks.user_tasks import router as user_tasks_router
from core.api.operation_logs.operation_logs import router as operation_logs_router
from core.api.login_logs.login_logs import router as login_logs_router
from core.api.online_users.online_users import router as online_users_router
from core.api.data_backups.data_backups import router as data_backups_router
from core.api.help_documents.help_documents import router as help_documents_router

# 导入应用级 API 路由（apps）
from apps.master_data.api.router import router as master_data_router
# 以下APP与MES完全无关，已暂时卸载：
# from apps.kuaicrm.api.router import router as kuaicrm_router
from apps.kuaipdm.api.router import router as kuaipdm_router
from apps.kuaimrp.api.router import router as kuaimrp_router
# from apps.kuaisrm.api.router import router as kuaisrm_router
from apps.kuaiwms.api.router import router as kuaiwms_router
from apps.kuaimes.api.router import router as kuaimes_router
from apps.kuaiqms.api.router import router as kuaiqms_router
from apps.kuaieam.api.router import router as kuaieam_router
# from apps.kuaitms.api.router import router as kuaitms_router
# from apps.kuaiacc.api.router import router as kuaiacc_router
# from apps.kuaihrm.api.router import router as kuaihrm_router
from apps.kuaipm.api.router import router as kuaipm_router
# from apps.kuaiehs.api.router import router as kuaiehs_router
from apps.kuaicert.api.router import router as kuaicert_router
from apps.kuaiepm.api.router import router as kuaiepm_router
# from apps.kuaioa.api.router import router as kuaioa_router
from apps.kuaiaps.api.router import router as kuaiaps_router
from apps.kuaiems.api.router import router as kuaiems_router
# from apps.kuailims.api.router import router as kuailims_router
from apps.kuaimi.api.router import router as kuaimi_router
# from apps.kuaiscm.api.router import router as kuaiscm_router
from apps.kuaiiot.api.router import router as kuaiiot_router

# Inngest 集成
from core.inngest.client import inngest_client
from inngest.fast_api import serve as inngest_serve

# 获取运行模式 - 默认为SaaS模式
MODE = os.getenv("MODE", "saas")


@asynccontextmanager
async def lifespan(app: FastAPI):
    """应用生命周期管理"""
    # 注册 Tortoise ORM 数据库连接
    await register_db(app)
    print("✅ Tortoise ORM 已注册")

    yield

    # ⚠️ 注意：close_db_connections 已经在 register_db 中注册为 shutdown 事件
    # 这里不需要再次关闭，避免重复关闭导致错误
    # await Tortoise.close_connections()
    print("✅ 应用关闭中...")

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
# 注意：插件路由需要在应用启动时或请求时动态加载
# 这里提供一个基础框架，实际使用时需要根据插件注册机制来实现

# 动态加载插件路由
# 插件后端代码现在放在 src/apps/插件名/ 目录下
# 自动扫描并注册所有已安装且启用的插件路由
def load_plugin_routes():
    """
    动态加载插件路由

    扫描 src/apps 目录下的所有插件，自动注册其路由。
    """
    apps_dir = Path(__file__).parent.parent / "apps"  # 插件目录
    if not apps_dir.exists():
        return

    # 快速上线模式：只保留主数据管理APP，其他APP全部停用并归档
    disabled_apps = {
        "kuaiacc",    # 财务会计系统
        "kuaiaps",    # 高级排产系统
        "kuaicert",   # 认证管理系统
        "kuaicrm",    # 客户关系管理系统
        "kuaieam",    # 设备资产管理系统
        "kuaiehs",    # 环境健康安全系统
        "kuaiems",    # 能源管理系统
        "kuaiepm",    # 企业绩效管理系统
        "kuaihrm",    # 人力资源管理系统
        "kuaiiot",    # 物联网系统
        "kuailims",   # 实验室信息管理系统
        "kuaimes",    # 制造执行系统
        "kuaimi",     # 制造智能系统
        "kuaimrp",    # 物料需求规划系统
        "kuaioa",     # 办公自动化系统
        "kuaipdm",    # 产品数据管理系统
        "kuaipm",     # 项目管理系统
        "kuaiqms",    # 质量管理系统
        "kuaiscm",    # 供应链协同系统
        "kuaisrm",    # 供应商关系管理系统
        "kuaitms",    # 运输管理系统
        "kuaiwms",    # 仓库管理系统
    }

    # 遍历 apps 目录下的所有插件
    for plugin_dir in apps_dir.iterdir():
        if not plugin_dir.is_dir():
            continue

        plugin_code = plugin_dir.name

        # 跳过与MES无关的APP
        if plugin_code in disabled_apps:
            print(f"⏸️ 跳过插件 {plugin_code} (与MES无关，已暂时卸载)")
            continue
        
        # 尝试导入插件的路由模块
        # 约定：插件路由应该在 apps.{plugin_code}.api 目录下
        try:
            # 动态导入插件路由
            # 注意：插件需要遵循约定，在 api 目录下定义 router
            import importlib
            api_module_path = f"apps.{plugin_code}.api"
            
            # 尝试导入 api 模块
            try:
                api_module = importlib.import_module(api_module_path)
                
                # 查找所有 router 对象
                for attr_name in dir(api_module):
                    attr = getattr(api_module, attr_name)
                    if isinstance(attr, APIRouter):
                        app.include_router(attr, prefix="/api/v1")
                        print(f"✅ 已注册插件 {plugin_code} 的路由: {attr_name}")
            except ImportError:
                # 如果 api 模块不存在，尝试导入具体的路由文件
                # 约定：插件路由文件应该在 apps.{plugin_code}.api.*.py
                import pkgutil
                api_package_dir = plugin_dir / "api"
                
                if api_package_dir.exists():
                    # 遍历 api 目录下的所有子目录（如 orders）
                    for subdir in api_package_dir.iterdir():
                        if not subdir.is_dir():
                            continue
                        
                        # 尝试导入子目录中的模块（如 orders.orders）
                        for py_file in subdir.glob("*.py"):
                            if py_file.name == "__init__.py":
                                continue
                            
                            module_name = py_file.stem
                            submodule_path = f"{api_module_path}.{subdir.name}.{module_name}"
                            
                            try:
                                module = importlib.import_module(submodule_path)
                                # 查找 router 对象
                                for attr_name in dir(module):
                                    attr = getattr(module, attr_name)
                                    if isinstance(attr, APIRouter):
                                        app.include_router(attr, prefix="/api/v1")
                                        print(f"✅ 已注册插件 {plugin_code} 的路由: {submodule_path}.{attr_name}")
                            except Exception as e:
                                print(f"⚠️ 加载插件 {plugin_code} 的路由模块 {submodule_path} 失败: {e}")
        except Exception as e:
            print(f"⚠️ 加载插件 {plugin_code} 失败: {e}")

# 加载插件路由
load_plugin_routes()

# 挂载静态文件目录
app.mount("/static", StaticFiles(directory="static"), name="static")

# 注册 Inngest 服务
# 导入 Inngest 函数（确保函数被注册）
from core.inngest.functions.test_function import test_integration_function
from core.inngest.functions import (
    message_sender_function,
    scheduled_task_executor_function,
    scheduled_task_scheduler_function,
    approval_workflow_function,
    approval_action_workflow_function,
    data_backup_executor_function,
    scheduled_backup_scheduler_function,
    sop_execution_workflow_function,
    sop_node_complete_workflow_function,
)

# 挂载 Inngest 服务端点
# serve() 函数需要 app, client, 和 functions 参数
try:
    inngest_serve(
        app,
        inngest_client,
        [
            test_integration_function,
        ]
    )
    print("✅ Inngest 服务端点注册成功")
except Exception as e:
    print(f"❌ Inngest 服务端点注册失败: {e}")
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

# 系统级功能路由 (System Level APIs) - 对应 core/ 文件夹
app.include_router(users_router, prefix="/api/v1/core")
app.include_router(roles_router, prefix="/api/v1/core")
app.include_router(permissions_router, prefix="/api/v1/core")
app.include_router(departments_router, prefix="/api/v1/core")
app.include_router(positions_router, prefix="/api/v1/core")
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
app.include_router(user_profile_router, prefix="/api/v1/personal")
app.include_router(user_preferences_router, prefix="/api/v1/personal")
app.include_router(user_messages_router, prefix="/api/v1/personal")
app.include_router(user_tasks_router, prefix="/api/v1/personal")
app.include_router(operation_logs_router, prefix="/api/v1/core")
app.include_router(login_logs_router, prefix="/api/v1/core")
app.include_router(online_users_router, prefix="/api/v1/core")
app.include_router(data_backups_router, prefix="/api/v1/core")
app.include_router(help_documents_router, prefix="/api/v1/core")

# 应用级功能路由 (App Level APIs)
app.include_router(master_data_router, prefix="/api/v1")
# 以下APP与MES完全无关，已暂时卸载：
# app.include_router(kuaicrm_router, prefix="/api/v1")
app.include_router(kuaipdm_router, prefix="/api/v1")
app.include_router(kuaimrp_router, prefix="/api/v1")
# app.include_router(kuaisrm_router, prefix="/api/v1")
app.include_router(kuaiwms_router, prefix="/api/v1")
app.include_router(kuaimes_router, prefix="/api/v1")
app.include_router(kuaiqms_router, prefix="/api/v1")
app.include_router(kuaieam_router, prefix="/api/v1")
# app.include_router(kuaitms_router, prefix="/api/v1")
# app.include_router(kuaiacc_router, prefix="/api/v1")
# app.include_router(kuaihrm_router, prefix="/api/v1")
app.include_router(kuaipm_router, prefix="/api/v1")
# app.include_router(kuaiehs_router, prefix="/api/v1")
app.include_router(kuaicert_router, prefix="/api/v1")
app.include_router(kuaiepm_router, prefix="/api/v1")
# app.include_router(kuaioa_router, prefix="/api/v1")
app.include_router(kuaiaps_router, prefix="/api/v1")
app.include_router(kuaiems_router, prefix="/api/v1")
# app.include_router(kuailims_router, prefix="/api/v1")
app.include_router(kuaimi_router, prefix="/api/v1")
# app.include_router(kuaiscm_router, prefix="/api/v1")
app.include_router(kuaiiot_router, prefix="/api/v1")

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
        result = await inngest_client.send(
            Event(
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
    from infra.config.infra_config import infra_settings
    uvicorn.run(
        "main:app",
        host=infra_settings.HOST,  # 从环境变量读取
        port=infra_settings.PORT,  # 从环境变量读取
        reload=True,
        reload_dirs=["src"]
    )