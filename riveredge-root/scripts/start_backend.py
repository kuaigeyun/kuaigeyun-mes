"""
启动后端服务脚本

直接启动后端服务，捕获所有错误输出
"""

import sys
import os
import asyncio
from pathlib import Path

# 添加 src 目录到 Python 路径
src_path = Path(__file__).parent.parent / "src"
sys.path.insert(0, str(src_path))

# 在切换目录之前加载环境变量
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
# 这解决了 asyncpg 在 uvicorn 下的连接问题
if sys.platform == 'win32':
    asyncio.set_event_loop_policy(asyncio.WindowsSelectorEventLoopPolicy())

try:
    import uvicorn
    from app.main import app
    
    # 获取端口配置，支持环境变量
    port = int(os.getenv('PORT', '9001'))

    # 优化 uvicorn 配置，解决 Windows 环境下 asyncpg 连接问题
    # 强制使用 asyncio 循环，避免 ProactorEventLoop 的网络兼容性问题
    uvicorn.run(
        app,
        host="0.0.0.0",
        port=port,
        log_level="info",
        loop="asyncio",  # 强制使用 asyncio 循环
        timeout_keep_alive=30,  # 保持连接 30 秒
        limit_concurrency=100,  # 降低并发限制，避免资源竞争
    )
except KeyboardInterrupt:
    print("\n\n服务已停止")
except Exception as e:
    print(f"\n✗ 启动失败: {e}")
    import traceback
    traceback.print_exc()
    sys.exit(1)

