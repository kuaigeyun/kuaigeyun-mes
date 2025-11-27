"""
FastAPI 应用入口

创建 FastAPI 应用实例，配置路由、中间件等
"""

from contextlib import asynccontextmanager
import traceback
import asyncio
import sys

from fastapi import FastAPI, Request, status, HTTPException
from fastapi.middleware.cors import CORSMiddleware
from fastapi.responses import JSONResponse
from fastapi.exceptions import RequestValidationError
from loguru import logger
from asyncpg.exceptions import ConnectionDoesNotExistError
from tortoise.exceptions import OperationalError

from app.config import settings
from app.middleware import TenantContextMiddleware
from core.cache import cache
from core.database import register_db, TORTOISE_ORM
from core.exceptions import RiverEdgeException, create_error_response
from core.api_middleware import (
    APIVersionMiddleware,
    RateLimitMiddleware,
    APIMonitoringMiddleware
)
# 导入日志配置，确保日志系统已初始化
import utils.logger  # noqa: F401

# Windows 环境下修复异步网络兼容性问题
if sys.platform == 'win32':
    # 使用更稳定的 SelectorEventLoop 替代 ProactorEventLoop
    # 这解决了 asyncpg 在 Windows 下的连接问题
    asyncio.set_event_loop_policy(asyncio.WindowsSelectorEventLoopPolicy())


@asynccontextmanager
async def lifespan(app: FastAPI):
    """
    应用生命周期管理

    在应用启动和关闭时执行相应的初始化或清理操作

    Args:
        app: FastAPI 应用实例
    """
    # 启动时执行
    logger.info("应用启动中...")
    
    # 注意：数据库连接由 register_tortoise 自动管理，不需要手动初始化

    # 连接 Redis（如果连接失败，记录警告但不阻塞启动）
    try:
        await cache.connect()
        logger.info("Redis 连接成功")
    except Exception as e:
        logger.warning(f"Redis 连接失败，应用将继续运行（某些缓存功能可能不可用）: {e}")

    # 初始化插件系统
    try:
        from plugins import plugin_loader, plugin_registry
        loaded_count = plugin_loader.load_all_directories(plugin_registry)
        logger.info(f"插件系统初始化完成，共加载 {loaded_count} 个插件")

        # 激活所有插件
        plugin_registry.activate_all()
        logger.info("所有插件已激活")
    except Exception as e:
        logger.warning(f"插件系统初始化失败: {e}")

    yield

    # 关闭时执行
    logger.info("应用关闭中...")
    
    # 注意：数据库连接由 register_tortoise 自动关闭，不需要手动关闭

    # 断开 Redis 连接
    try:
        await cache.disconnect()
        logger.info("Redis 连接已关闭")
    except Exception as e:
        logger.warning(f"Redis 断开连接时出错: {e}")


# 创建 FastAPI 应用实例
app = FastAPI(
    title=settings.APP_NAME,
    version=settings.APP_VERSION,
    description="RiverEdge SaaS 多组织框架 - 后端核心系统",
    docs_url="/docs",
    redoc_url="/redoc",
    lifespan=lifespan,
)

# 配置 CORS 中间件
app.add_middleware(
    CORSMiddleware,
    allow_origins=settings.CORS_ORIGINS,
    allow_credentials=settings.CORS_ALLOW_CREDENTIALS,
    allow_methods=settings.CORS_ALLOW_METHODS,
    allow_headers=settings.CORS_ALLOW_HEADERS,
)

# 全局异常处理器（必须在注册路由之前注册）

@app.exception_handler(RiverEdgeException)
async def riveredge_exception_handler(request: Request, exc: RiverEdgeException):
    """
    RiverEdge 统一异常处理器

    处理所有自定义业务异常，返回标准化的错误响应
    """
    logger.error(f"业务异常: {exc.code} - {exc.message}")
    logger.error(f"请求路径: {request.url.path}")
    logger.error(f"请求方法: {request.method}")

    if exc.details:
        logger.error(f"异常详情: {exc.details}")

    return JSONResponse(
        status_code=exc.status_code,
        content=create_error_response(exc, request.url.path)
    )


@app.exception_handler(HTTPException)
async def http_exception_handler(request: Request, exc: HTTPException):
    """
    HTTP 异常处理器

    处理 FastAPI 的 HTTPException，返回标准化的错误响应
    """
    logger.error(f"HTTP 异常: {exc.status_code} - {exc.detail}")
    logger.error(f"请求路径: {request.url.path}")
    logger.error(f"请求方法: {request.method}")
    
    # 记录完整的错误信息（包括堆栈，如果有的话）
    import traceback
    logger.error(f"HTTP异常堆栈:\n{traceback.format_exc()}")

    return JSONResponse(
        status_code=exc.status_code,
        content={
            "success": False,
            "error": {
                "code": "HTTP_EXCEPTION",
                "message": exc.detail,  # 这里会包含我们设置的详细错误信息
                "details": {},
                "path": request.url.path,
            },
            "timestamp": "2025-11-18T00:00:00Z"
        },
        headers=exc.headers if hasattr(exc, 'headers') and exc.headers else None,
    )


@app.exception_handler(RequestValidationError)
async def validation_exception_handler(request: Request, exc: RequestValidationError):
    """
    请求验证异常处理器

    处理 Pydantic 验证错误，返回标准化的错误响应
    """
    logger.error(f"请求验证失败: {exc.errors()}")
    return JSONResponse(
        status_code=status.HTTP_422_UNPROCESSABLE_ENTITY,
        content={
            "success": False,
            "error": {
                "code": "VALIDATION_ERROR",
                "message": "请求参数验证失败",
                "details": {"validation_errors": exc.errors()},
                "path": request.url.path,
            },
            "timestamp": "2025-11-18T00:00:00Z"
        }
    )


@app.exception_handler(ConnectionDoesNotExistError)
async def connection_error_handler(request: Request, exc: ConnectionDoesNotExistError):
    """
    数据库连接错误处理器

    处理数据库连接中断错误，返回标准化的错误响应
    """
    logger.error(f"数据库连接错误: {exc}")
    logger.error(f"请求路径: {request.url.path}")
    logger.error(f"请求方法: {request.method}")

    return JSONResponse(
        status_code=status.HTTP_503_SERVICE_UNAVAILABLE,
        content={
            "success": False,
            "error": {
                "code": "DATABASE_ERROR",
                "message": "数据库连接中断，请稍后重试",
                "details": {"original_error": str(exc)},
                "path": request.url.path,
            },
            "timestamp": "2025-11-18T00:00:00Z"
        }
    )


@app.exception_handler(OperationalError)
async def operational_error_handler(request: Request, exc: OperationalError):
    """
    数据库操作错误处理器

    处理数据库操作错误，返回标准化的错误响应
    """
    logger.error(f"数据库操作错误: {exc}")
    logger.error(f"请求路径: {request.url.path}")
    logger.error(f"请求方法: {request.method}")

    return JSONResponse(
        status_code=status.HTTP_503_SERVICE_UNAVAILABLE,
        content={
            "success": False,
            "error": {
                "code": "DATABASE_ERROR",
                "message": "数据库操作失败，请稍后重试",
                "details": {"original_error": str(exc)},
                "path": request.url.path,
            },
            "timestamp": "2025-11-18T00:00:00Z"
        }
    )


@app.exception_handler(Exception)
async def global_exception_handler(request: Request, exc: Exception):
    """
    全局异常处理器

    捕获所有未处理的异常，记录日志并返回标准化的错误响应
    """
    # 记录详细的错误信息
    logger.error(f"未处理的异常: {exc}")
    logger.error(f"请求路径: {request.url.path}")
    logger.error(f"请求方法: {request.method}")
    logger.error(f"错误堆栈: {traceback.format_exc()}")

    # 返回标准化的错误响应
    # 在开发环境下返回详细的错误信息
    error_message = "服务器内部错误"
    if settings.DEBUG:
        error_message = f"服务器内部错误: {str(exc)}"
    
    return JSONResponse(
        status_code=status.HTTP_500_INTERNAL_SERVER_ERROR,
        content={
            "success": False,
            "error": {
                "code": "INTERNAL_SERVER_ERROR",
                "message": error_message,
                "details": {
                    "exception_type": type(exc).__name__,
                    "original_error": str(exc)
                },
                "path": request.url.path,
            },
            "timestamp": "2025-11-18T00:00:00Z"
        }
    )

# 配置中间件（顺序很重要：从外到内）
app.add_middleware(APIMonitoringMiddleware)  # API 监控（最外层）
app.add_middleware(RateLimitMiddleware)      # 请求限流
app.add_middleware(APIVersionMiddleware)     # API 版本控制
app.add_middleware(TenantContextMiddleware)  # 组织上下文（最内层）

# 注册 Tortoise ORM（使用官方推荐的 register_tortoise，自动管理连接池）
register_db(app)

# 注册路由（延迟导入避免循环依赖）
def register_routes():
    """注册所有路由"""

    from api.v1.tenants import router as tenants_router
    from api.v1.auth import router as auth_router
    from api.v1.register import router as register_router
    from api.v1.users import router as users_router
    from api.v1.roles import router as roles_router
    from api.v1.permissions import router as permissions_router
    from api.v1.saved_searches import router as saved_searches_router
    from api.v1.superadmin.auth import router as superadmin_auth_router
    from api.v1.superadmin.tenants import router as superadmin_tenants_router
    from api.v1.superadmin.monitoring import router as superadmin_monitoring_router
    from api.v1.superadmin.plugins import router as superadmin_plugins_router

    app.include_router(tenants_router, prefix="/api/v1")
    app.include_router(auth_router, prefix="/api/v1")
    app.include_router(register_router, prefix="/api/v1")
    app.include_router(users_router, prefix="/api/v1")
    app.include_router(roles_router, prefix="/api/v1")
    app.include_router(permissions_router, prefix="/api/v1")
    app.include_router(saved_searches_router, prefix="/api/v1")
    app.include_router(superadmin_auth_router, prefix="/api/v1")
    app.include_router(superadmin_tenants_router, prefix="/api/v1")
    app.include_router(superadmin_monitoring_router, prefix="/api/v1")
    app.include_router(superadmin_plugins_router, prefix="/api/v1")

register_routes()


@app.get("/")
async def root():
    """
    根路径

    Returns:
        dict: 欢迎信息
    """
    return {
        "message": "欢迎使用 RiverEdge SaaS 多组织框架",
        "version": settings.APP_VERSION,
        "docs": "/docs",
    }


@app.get("/health")
async def health():
    """
    基础健康检查接口

    Returns:
        dict: 健康状态
    """
    return {
        "status": "healthy",
        "app": settings.APP_NAME,
        "version": settings.APP_VERSION,
        "timestamp": "2025-11-18T00:00:00Z"
    }


@app.get("/health/detailed")
async def detailed_health():
    """
    详细健康检查接口

    检查数据库、Redis等关键组件的连接状态

    Returns:
        dict: 详细健康状态
    """
    import time
    from core.database import check_db_connection
    from core.cache import check_redis_connection

    start_time = time.time()
    checks = {}

    # 数据库健康检查
    try:
        db_healthy = await check_db_connection()
        checks["database"] = {
            "status": "healthy" if db_healthy else "unhealthy",
            "details": "PostgreSQL connection OK" if db_healthy else "Database connection failed"
        }
    except Exception as e:
        checks["database"] = {
            "status": "unhealthy",
            "details": f"Database check failed: {str(e)}"
        }

    # Redis 健康检查
    try:
        redis_healthy = await check_redis_connection()
        checks["redis"] = {
            "status": "healthy" if redis_healthy else "unhealthy",
            "details": "Redis connection OK" if redis_healthy else "Redis connection failed"
        }
    except Exception as e:
        checks["redis"] = {
            "status": "unhealthy",
            "details": f"Redis check failed: {str(e)}"
        }

    # 系统信息
    checks["system"] = {
        "status": "healthy",
        "details": f"Python {sys.version.split()[0]} on {sys.platform}"
    }

    # 计算响应时间
    response_time = time.time() - start_time

    # 判断整体健康状态
    overall_status = "healthy" if all(check["status"] == "healthy" for check in checks.values()) else "unhealthy"

    return {
        "status": overall_status,
        "app": settings.APP_NAME,
        "version": settings.APP_VERSION,
        "timestamp": "2025-11-18T00:00:00Z",
        "response_time": f"{response_time:.3f}s",
        "checks": checks
    }


@app.get("/test-error")
async def test_error():
    """
    测试异常处理器
    
    用于测试异常处理器是否正常工作
    """
    raise HTTPException(status_code=500, detail="测试异常处理器")


if __name__ == "__main__":
    import uvicorn

    uvicorn.run(
        "app.main:app",
        host=settings.HOST,
        port=settings.PORT,
        reload=settings.DEBUG,
    )
