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
from tree_root.api.integration_configs.integration_configs import router as integration_configs_router

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

# 挂载静态文件目录
app.mount("/static", StaticFiles(directory="src/static"), name="static")

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
app.include_router(integration_configs_router, prefix="/api/v1/system")

if __name__ == "__main__":
    import uvicorn
    uvicorn.run(
        "main:app",
        host="0.0.0.0",
        port=9000,
        reload=True,
        reload_dirs=["src"]
    )