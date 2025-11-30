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

# 添加src目录到Python路径
src_path = Path(__file__).parent.parent
sys.path.insert(0, str(src_path))

from src.soil.infrastructure.database.database import register_db

# 导入所有soil API路由
from src.soil.api.auth.auth import router as auth_router
from src.soil.api.tenants.tenants import router as tenants_router
from src.soil.api.packages.packages_config import router as packages_config_router
from src.soil.api.packages.packages import router as packages_router
from src.soil.api.platform_superadmin.platform_superadmin import router as platform_superadmin_router
from src.soil.api.platform_superadmin.auth import router as platform_superadmin_auth_router
from src.soil.api.monitoring.statistics import router as monitoring_statistics_router
from src.soil.api.saved_searches.saved_searches import router as saved_searches_router

# 获取运行模式
MODE = os.getenv("MODE", "monolithic")

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
    version="1.0.0",
    lifespan=lifespan,
)

# 配置CORS
app.add_middleware(
    CORSMiddleware,
    allow_origins=["*"],  # 在生产环境中应该限制为具体域名
    allow_credentials=True,
    allow_methods=["*"],
    allow_headers=["*"],
)

# 健康检查端点
@app.get("/health")
async def health_check():
    """健康检查"""
    return {"status": "healthy", "service": "maintree", "mode": MODE}

# 测试端点
@app.get("/test")
async def test_endpoint():
    """测试端点"""
    return {"message": "Test endpoint works"}

# 注册API路由
app.include_router(packages_config_router, prefix="/api/v1/platform")
app.include_router(packages_router, prefix="/api/v1/platform")
app.include_router(monitoring_statistics_router, prefix="/api/v1/platform")
app.include_router(auth_router, prefix="/api/v1/superadmin")
app.include_router(tenants_router, prefix="/api/v1/platform")
app.include_router(platform_superadmin_auth_router, prefix="/api/v1/platform")
app.include_router(platform_superadmin_router, prefix="/api/v1/platform")
app.include_router(saved_searches_router, prefix="/api/v1")

if __name__ == "__main__":
    import uvicorn
    uvicorn.run(
        "main:app",
        host="0.0.0.0",
        port=9000,
        reload=True,
        reload_dirs=["src"]
    )