"""
使用 uvicorn 启动后端服务

直接使用 uvicorn 命令行方式启动，支持更多配置选项
"""

import sys
import os
from pathlib import Path

# 添加 src 目录到 Python 路径
src_path = Path(__file__).parent.parent / "src"
sys.path.insert(0, str(src_path))

# 加载环境变量
from dotenv import load_dotenv
project_root = Path(__file__).parent.parent
env_file = project_root / ".env"
if env_file.exists():
    load_dotenv(env_file)
    print(f"已加载环境变量文件: {env_file}")
else:
    print(f"警告: 未找到环境变量文件: {env_file}")

# 切换到 src 目录
os.chdir(src_path)

# Windows 环境下强制使用 SelectorEventLoop
if sys.platform == 'win32':
    import asyncio
    asyncio.set_event_loop_policy(asyncio.WindowsSelectorEventLoopPolicy())

# 导入配置
from app.config import settings

# 使用 uvicorn 启动
if __name__ == "__main__":
    import uvicorn
    
    # 从配置获取端口和主机
    host = settings.HOST
    port = int(os.getenv('PORT', settings.PORT))
    
    print(f"启动后端服务...")
    print(f"主机: {host}")
    print(f"端口: {port}")
    print(f"环境: {settings.ENVIRONMENT}")
    print(f"调试模式: {settings.DEBUG}")
    print("-" * 50)
    
    # 使用 uvicorn 启动
    # 注意：app 需要从 app.main 导入，因为需要先初始化环境
    uvicorn.run(
        "app.main:app",  # 使用字符串形式，让 uvicorn 自动导入
        host=host,
        port=port,
        log_level="info" if not settings.DEBUG else "debug",
        reload=settings.DEBUG,  # 开发模式下启用自动重载
        loop="asyncio",  # 强制使用 asyncio 循环（Windows 兼容）
        timeout_keep_alive=30,
        limit_concurrency=100,
        access_log=True,  # 启用访问日志
    )

