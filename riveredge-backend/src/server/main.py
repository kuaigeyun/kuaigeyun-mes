"""
RiverEdge App - SaaS平台主服务

作为平台宿主的后端服务，整合 infra 和 core 模块提供平台级和系统级功能。
"""

import os
import sys
import asyncio
import uuid
from pathlib import Path
from contextlib import asynccontextmanager
from fastapi import FastAPI, APIRouter, Request, Response
from fastapi.middleware.cors import CORSMiddleware
from datetime import datetime
from loguru import logger

# 添加src目录到Python路径
src_path = Path(__file__).parent.parent
sys.path.insert(0, str(src_path))

from infra.config.infra_config import infra_settings
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
from infra.api.license_center.license_center import router as license_center_router
from infra.api.platform_settings.public import router as platform_settings_public_router
from infra.api.platform_settings.version import router as platform_version_router
from infra.api.business_config.business_config import router as business_config_router
from infra.api.application_dedicated.application_dedicated import router as application_dedicated_router

# 导入所有系统级 API 路由（core）
import sys
sys.path.insert(0, str(Path(__file__).parent))

from core.api.users.users import router as users_router
from core.api.reference.display import router as reference_display_router
from core.api.roles.roles import router as roles_router
from core.api.permissions.permissions import router as permissions_router
from core.api.permissions.permission_policies import router as permission_policies_router
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
from core.api.enums.enums import router as enums_router
from core.api.code_rules.material_code_rules import router as material_code_rules_router
from core.api.variant_attributes.variant_attributes import router as variant_attributes_router
from core.api.custom_fields.custom_fields import router as custom_fields_router
from core.api.site_settings.site_settings import router as site_settings_router
from core.api.invitation_codes.invitation_codes import router as invitation_codes_router
from core.api.languages.languages import router as languages_router
from core.api.applications.applications import router as applications_router
from core.api.application_dedicated_bindings.application_dedicated_bindings import (
    router as application_dedicated_bindings_core_router,
)
from core.api.menus.menus import router as menus_router
from core.api.ip_location import router as ip_location_router
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
from core.api.tenant_init.tenant_init import router as tenant_init_router
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
from core.api.logistics import router as logistics_router
from core.api.login_logs.login_logs import router as login_logs_router
from core.api.online_users.online_users import router as online_users_router
from core.api.help_documents.help_documents import router as help_documents_router
from core.api.onboarding.onboarding import router as onboarding_router
from core.api.data_quality.data_quality import router as data_quality_router
from core.api.operation_guide.operation_guide import router as operation_guide_router
from core.api.launch_progress.launch_progress import router as launch_progress_router
from core.api.launch_checklist.launch_checklist import router as launch_checklist_router
from core.api.usage_analysis.usage_analysis import router as usage_analysis_router
from core.api.optimization_suggestion.optimization_suggestion import router as optimization_suggestion_router
from core.api.performance.performance import router as performance_router
from core.api.dashboard.business_board_title import router as business_board_title_router

# 插件管理器API
from core.api.plugin_manager.plugin_manager import router as plugin_manager_router

# 应用路由现在通过 ApplicationRegistryService 动态注册
# 无需手动导入应用路由模块

# Taskiq broker 任务定义（API 仅投递；事件处理器在 Worker 中按已安装应用懒加载）
try:
    import core.tasks.taskiq_app  # noqa: F401 — 注册 Taskiq broker 任务（run_event_pipeline 等）
except Exception as e:
    logger.warning(f"⚠️ Taskiq 模块预加载失败: {e}")

# 获取运行模式 - 默认为SaaS模式
MODE = os.getenv("MODE", "saas")


@asynccontextmanager
async def lifespan(app: FastAPI):
    """应用生命周期管理"""
    # 注册 Tortoise ORM 数据库连接（后续并行任务依赖此步骤）
    await register_db(app)
    logger.info("✅ Tortoise ORM 已注册")

    # 同步初始化：httpx 全局客户端与路由管理器不需要 await，放在早期避免被 gather 序列化
    try:
        from infra.infrastructure.http import init_http_client
        init_http_client()
    except Exception as e:
        logger.warning(f"⚠️ 初始化全局 httpx.AsyncClient 失败: {e}")

    init_route_manager(app)
    logger.info("✅ 应用路由管理器已初始化")

    # 并行初始化：cache、系统级服务、平台级服务互不依赖，一次 gather 替代 3 次 await
    async def _init_cache() -> None:
        try:
            from infra.infrastructure.cache.cache import cache
            await cache.connect()
            logger.info("✅ Cache(PG) 已就绪")
        except Exception as e:
            logger.error(f"❌ Cache 初始化失败: {e}")
            logger.warning("⚠️  依赖 cache 的功能（在线用户等）将不可用")

    async def _init_sys_services() -> None:
        await ServiceInitializer.initialize_services()
        logger.info("✅ 系统级服务接口层已初始化")

    async def _init_infra_services() -> None:
        from infra.services.interfaces.service_initializer import InfraServiceInitializer
        await InfraServiceInitializer.initialize_services()
        logger.info("✅ 平台级服务接口层已初始化")

    await asyncio.gather(
        _init_cache(),
        _init_sys_services(),
        _init_infra_services(),
        return_exceptions=False,
    )

    from core.services.authorization.data_scope_bootstrap import ensure_data_scope_framework
    from apps.haoligo.authorization.data_scope_setup import register_haoligo_data_scope_profiles
    from apps.kuaizhizao.authorization.data_scope_setup import (
        register_kuaizhizao_data_scope_profiles,
    )
    from apps.master_data.authorization.data_scope_setup import (
        register_master_data_data_scope_profiles,
    )

    ensure_data_scope_framework()
    register_haoligo_data_scope_profiles()
    register_kuaizhizao_data_scope_profiles()
    register_master_data_data_scope_profiles()
    from apps.master_data.reference_display.setup import register_master_data_reference_display_providers
    from apps.haoligo.reference_display.setup import register_haoligo_reference_display_providers
    from apps.kuaizhizao.reference_display.setup import register_kuaizhizao_reference_display_providers

    register_master_data_reference_display_providers()
    register_haoligo_reference_display_providers()
    register_kuaizhizao_reference_display_providers()
    logger.info("✅ 引用资源 DisplayProvider 已注册")
    logger.info("✅ 数据权限框架（DataScopeService）已注册")

    # 确保平台超级管理员存在（表为空时从 .env 创建；未登录过的账号可与 .env 同步密码）
    try:
        from infra.models.infra_superadmin import InfraSuperAdmin
        from infra.config.infra_config import infra_settings
        pwd = (infra_settings.infra_superadmin_PASSWORD or "").strip()
        if not pwd:
            logger.warning("PLATFORM_SUPERADMIN_PASSWORD 未设置，跳过平台超级管理员初始化")
        else:
            username = infra_settings.infra_superadmin_USERNAME
            email = infra_settings.infra_superadmin_EMAIL or f"{username}@riveredge.cn"
            full_name = infra_settings.infra_superadmin_FULL_NAME or "平台超级管理员"
            existing = await InfraSuperAdmin.get_or_none()
            if not existing:
                admin = await InfraSuperAdmin.create(
                    uuid=str(uuid.uuid4()),
                    username=username,
                    email=email,
                    password_hash=InfraSuperAdmin.hash_password(pwd),
                    full_name=full_name,
                    is_active=True,
                )
                logger.info(f"✅ 已创建平台超级管理员: {admin.username}")
            elif not existing.verify_password(pwd):
                if existing.last_login is None:
                    existing.password_hash = InfraSuperAdmin.hash_password(pwd)
                    if existing.username != username:
                        existing.username = username
                    existing.email = email
                    existing.full_name = full_name
                    await existing.save()
                    logger.info(f"✅ 已同步平台超级管理员密码: {existing.username}")
                else:
                    logger.info(
                        "平台超级管理员已登录过，不以 .env 覆盖密码；"
                        "若需重置请使用「修改配置」更新 .env 后手动改密，或清空 last_login 后重启"
                    )
    except Exception as e:
        logger.warning(f"确保平台超级管理员时出错: {e}")

    # 路由管理器已在 lifespan 早期与 httpx 客户端一同同步初始化

    # 若数据库无应用记录，自动扫描 riveredge-backend/src/apps 并注册（manifest 以后端为单一来源）
    try:
        from core.services.application.application_service import ApplicationService
        from infra.models.tenant import Tenant
        total_count = await ApplicationService.count_applications(deleted_at_is_null=True)
        if total_count == 0:
            logger.info("📋 数据库无应用记录，自动扫描并注册应用...")
            plugins_dir = ApplicationService._get_plugins_directory()
            if not plugins_dir.exists():
                logger.warning(f"⚠️ 应用 manifest 目录不存在: {plugins_dir}，请设置 APPS_MANIFEST_DIR")
            else:
                # 为所有租户扫描注册（解决非 tenant_id=1 的组织应用中心为空）
                tenants = await Tenant.all()
                tenant_ids = [t.id for t in tenants] if tenants else [1]
                for tid in tenant_ids:
                    await ApplicationService.scan_and_register_plugins(tenant_id=tid)
                logger.info(f"✅ 应用自动注册完成，已为 {len(tenant_ids)} 个组织注册")
    except Exception as e:
        logger.warning(f"⚠️ 应用自动扫描失败（可稍后在应用中心手动扫描）: {e}")

    # 数据库连接建立后，重新初始化应用注册服务（使用真实的数据库数据）
    try:
        await ApplicationRegistryService.reload_apps()
        logger.info("✅ 应用注册服务已重新初始化")
    except Exception as e:
        logger.exception(
            "❌ 应用注册服务 reload_apps 失败，进程仍以核心路由继续运行（请检查日志与插件路由）: {}",
            e,
        )

    # 在lifespan中加载插件路由（确保路由管理器已初始化）
    # 注意：路由已经在 ApplicationRegistryService.reload_apps() 中注册到 ApplicationRouteManager
    # 这里只需要确保路由已经注册到 FastAPI app
    load_plugin_routes()
    logger.info("✅ 插件路由已加载")

    # 启动 cache 过期清理后台任务：惰性过期已在 get 时生效，此处兜底"写入后从未再访问"的残留
    async def _cache_purge_loop():
        from infra.infrastructure.cache.cache import cache as _cache
        while True:
            try:
                await asyncio.sleep(600)
                removed = await _cache.purge_expired()
                if removed:
                    logger.debug(f"🧹 Cache 过期清理: 删除 {removed} 条")
            except asyncio.CancelledError:
                break
            except Exception as e:
                logger.warning(f"Cache 过期清理循环异常: {e}")

    app.state._cache_purge_task = asyncio.create_task(_cache_purge_loop())
    logger.info("✅ Cache 过期清理任务已启动（10 分钟/次）")

    # Taskiq：API 进程仅启动 broker（供 kiq 投递），实际消费由独立 worker 进程完成
    try:
        from core.tasks.taskiq_app import broker as taskiq_broker

        await taskiq_broker.startup()
        logger.info("✅ Taskiq PostgreSQL broker 已启动（API 可投递异步任务）")
    except Exception as e:
        logger.warning(f"⚠️ Taskiq broker 启动失败，异步任务投递将不可用: {e}")

    # OpenAPI schema 较大（约 MB 级）：启动时在后台线程预热，避免首个访问 /redoc 时在请求线程里卡数秒
    try:
        import time as _time

        _t0 = _time.perf_counter()
        await asyncio.to_thread(app.openapi)
        logger.info(
            "✅ OpenAPI schema 已预热（ReDoc 首次打开更快）：{:.2f}s",
            _time.perf_counter() - _t0,
        )
    except Exception as e:
        logger.warning("⚠️ OpenAPI 预热失败，首次 /openapi.json 仍将按需生成: {}", e)

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

    # 关闭 cache 过期清理后台任务
    purge_task = getattr(app.state, "_cache_purge_task", None)
    if purge_task is not None:
        purge_task.cancel()
        try:
            await purge_task
        except (asyncio.CancelledError, Exception):
            pass

    # 关闭缓存层
    try:
        from infra.infrastructure.cache.cache import cache
        await cache.disconnect()
        logger.info("✅ Cache(PG) 已关闭")
    except Exception as e:
        logger.warning(f"关闭 cache 时出错: {e}")

    # 关闭全局 httpx.AsyncClient
    try:
        from infra.infrastructure.http import close_http_client
        await close_http_client()
    except Exception as e:
        logger.warning(f"关闭全局 httpx.AsyncClient 时出错: {e}")

    try:
        from core.tasks.taskiq_app import broker as taskiq_broker

        await taskiq_broker.shutdown()
        logger.info("✅ Taskiq broker 已关闭")
    except Exception as e:
        logger.warning(f"关闭 Taskiq broker 时出错: {e}")

    # 关闭 Tortoise ORM 数据库连接（统一走 lifespan，不再使用已弃用的 @app.on_event("shutdown")）
    try:
        from tortoise import Tortoise
        await Tortoise.close_connections()
        logger.info("✅ Tortoise ORM 连接已关闭")
    except Exception as e:
        logger.warning(f"关闭 Tortoise ORM 连接时出错: {e}")

    logger.info("✅ 应用关闭中...")

# 创建FastAPI应用
app = FastAPI(
    title="RiverEdge SaaS Platform",
    description="RiverEdge SaaS 多组织框架 - 平台级后端服务",
    version="1.0.2",
    lifespan=lifespan,
    docs_url=None,  # 禁用默认docs，使用修复版本
    redoc_url=None,  # 使用下方自定义 /redoc（关闭 Google Fonts、可配置 JS CDN）
)


@app.get("/redoc", include_in_schema=False)
async def redoc_documentation(request: Request):
    """ReDoc：默认不加载 Google Fonts，避免国内首屏长时间空白；见 REDOC_* 环境变量。"""
    from fastapi.openapi.docs import get_redoc_html

    root_path = request.scope.get("root_path", "").rstrip("/")
    openapi_url = root_path + app.openapi_url
    js = (infra_settings.REDOC_JS_URL or "").strip()
    if not js:
        js = "/static/redoc/redoc.standalone.js"
    return get_redoc_html(
        openapi_url=openapi_url,
        title=f"{app.title} - ReDoc",
        redoc_js_url=js,
        with_google_fonts=infra_settings.REDOC_USE_GOOGLE_FONTS,
    )


_REDOC_STATIC_DIR = Path(__file__).resolve().parent / "doc_assets" / "redoc"
if (_REDOC_STATIC_DIR / "redoc.standalone.js").is_file():
    from starlette.staticfiles import StaticFiles

    app.mount(
        "/static/redoc",
        StaticFiles(directory=str(_REDOC_STATIC_DIR)),
        name="redoc_standalone",
    )
else:
    logger.warning(
        "未找到 ReDoc 静态资源 {} ，请放置文件或设置 REDOC_JS_URL 为 CDN",
        _REDOC_STATIC_DIR / "redoc.standalone.js",
    )


@app.get("/api/debug/batches")
async def debug_batches():
    try:
        from apps.master_data.models.material_batch import MaterialBatch
        batches = await MaterialBatch.all().values("id", "material_id", "batch_no", "quantity", "status", "deleted_at")
        return {"batches": batches}
    except Exception as e:
        return {"error": str(e)}

@app.get("/api/debug/materials")
async def debug_materials():
    try:
        from apps.master_data.models.material import Material
        mats = await Material.all().values("id", "uuid", "name", "code", "deleted_at")
        return {"materials": mats}
    except Exception as e:
        return {"error": str(e)}

# 配置CORS（从配置文件读取）
app.add_middleware(
    CORSMiddleware,
    allow_origins=infra_settings.get_cors_origins(),  # 从环境变量配置读取
    allow_credentials=infra_settings.CORS_ALLOW_CREDENTIALS,
    allow_methods=infra_settings.CORS_ALLOW_METHODS,
    allow_headers=infra_settings.CORS_ALLOW_HEADERS,
)

# ReDoc / OpenAPI 文档：可选 HTTP Basic（DOCS_BASIC_AUTH_USER + DOCS_BASIC_AUTH_PASSWORD 均配置时生效）
from core.middleware.docs_auth_middleware import DocsBasicAuthMiddleware
app.add_middleware(DocsBasicAuthMiddleware)

# 启用 GZip 压缩（Caddy 透明代理时也会压缩，直连后端时生效）
from starlette.middleware.gzip import GZipMiddleware
app.add_middleware(GZipMiddleware, minimum_size=500)

# 注册统一异常处理中间件（应该在其他中间件之前注册）
from core.middleware.exception_handler_middleware import ExceptionHandlerMiddleware
app.add_middleware(ExceptionHandlerMiddleware)

# 注册性能监控中间件（在操作日志中间件之前，以便记录性能指标）
from core.middleware.performance_middleware import PerformanceMiddleware
app.add_middleware(PerformanceMiddleware)

# 注册操作日志中间件
from core.middleware.operation_log_middleware import OperationLogMiddleware
app.add_middleware(OperationLogMiddleware)

# ReDoc / openapi.json 缓存头（缩小重复加载时的等待）
from core.middleware.docs_asset_cache_middleware import DocsAssetCacheMiddleware
app.add_middleware(DocsAssetCacheMiddleware)

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
            # initialize() 内 _register_app_routes 已调用过 register_app_routes；此处若再注册会 unregister 后二次 include_router，
            # FastAPI 无法卸载旧路由，导致重复挂载。已注册则跳过。
            for app_code, routers in registered_routes.items():
                if route_manager.is_app_registered(app_code):
                    logger.debug(
                        "应用 {} 路由已在路由管理器中注册，跳过 load_plugin_routes 重复注册",
                        app_code,
                    )
                    continue
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

logger.info("ℹ️ 事件任务处理器在 Taskiq Worker 启动时按已安装应用注册（API 进程不预加载 workflow）")

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
    """检查数据库中的应用记录（调试用）"""
    from core.models.application import Application

    try:
        rows = (
            await Application.filter(tenant_id=1, deleted_at__isnull=True)
            .order_by("code")
            .values("code", "name", "is_active", "is_installed")
        )
        return {"status": "success", "apps": rows, "count": len(rows)}
    except Exception as e:  # noqa: BLE001
        return {"status": "error", "message": f"数据库查询失败: {e}"}

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

# 注册API路由

# 用户认证路由 (User Authentication APIs)
app.include_router(auth_router, prefix="/api/v1")

# 公开的组织接口（不需要认证，用于注册等功能）
app.include_router(tenants_public_router, prefix="/api/v1")
# 公开的平台设置接口（不需要认证，用于登录页等）
app.include_router(platform_settings_public_router, prefix="/api/v1/infra")
# 公开的平台版本接口（用于悬浮按钮展示迭代信息）
app.include_router(platform_version_router, prefix="/api/v1/infra")
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
app.include_router(license_center_router, prefix="/api/v1/infra")
app.include_router(business_config_router, prefix="/api/v1/infra")
app.include_router(application_dedicated_router, prefix="/api/v1/infra")

# 系统级功能路由 (System Level APIs) - 对应 core/ 文件夹
app.include_router(users_router, prefix="/api/v1/core")
app.include_router(reference_display_router, prefix="/api/v1/core")
app.include_router(roles_router, prefix="/api/v1/core")
app.include_router(permissions_router, prefix="/api/v1/core")
app.include_router(permission_policies_router, prefix="/api/v1/core")
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
app.include_router(enums_router, prefix="/api/v1/core")
app.include_router(material_code_rules_router, prefix="/api/v1/core")
app.include_router(variant_attributes_router, prefix="/api/v1/core")
app.include_router(custom_fields_router, prefix="/api/v1/core")
app.include_router(site_settings_router, prefix="/api/v1/core")
app.include_router(invitation_codes_router, prefix="/api/v1/core")
app.include_router(languages_router, prefix="/api/v1/core")
app.include_router(applications_router, prefix="/api/v1/core")
app.include_router(application_dedicated_bindings_core_router, prefix="/api/v1/core")
app.include_router(menus_router, prefix="/api/v1/core")
app.include_router(ip_location_router, prefix="/api/v1/core")
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
app.include_router(tenant_init_router, prefix="/api/v1/core")
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
app.include_router(logistics_router, prefix="/api/v1/core")
app.include_router(login_logs_router, prefix="/api/v1/core")
app.include_router(online_users_router, prefix="/api/v1/core")
app.include_router(help_documents_router, prefix="/api/v1/core")
# 智能建议已迁移至 KU-AI 应用 (apps/kuaiai)，通过 ApplicationRegistryService 注册
app.include_router(onboarding_router, prefix="/api/v1/core")
app.include_router(data_quality_router, prefix="/api/v1/core")
app.include_router(operation_guide_router, prefix="/api/v1/core")
app.include_router(launch_progress_router, prefix="/api/v1/core")
app.include_router(launch_checklist_router, prefix="/api/v1/core")
app.include_router(usage_analysis_router, prefix="/api/v1/core")
app.include_router(optimization_suggestion_router, prefix="/api/v1/core")
app.include_router(performance_router, prefix="/api/v1/core")
app.include_router(business_board_title_router, prefix="/api/v1/core")

# 插件管理器路由 (Plugin Manager APIs)
app.include_router(plugin_manager_router, prefix="/api/v1/core")

# 应用级 API 路由由 ApplicationRegistryService + ApplicationRouteManager 在 lifespan 中按 DB 已安装应用动态注册

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
