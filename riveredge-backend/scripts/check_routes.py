"""
临时脚本：检查 FastAPI 应用的路由
"""

import asyncio
from fastapi import FastAPI
from server.main import app

def print_routes(app: FastAPI):
    """打印路由"""
    count = 0
    for route in app.routes:
        if hasattr(route, 'path'):
            if route.path.startswith('/apps/'):
                print(f"{route.methods} {route.path}")
                count += 1
                if count > 10:  # 只打印前10个
                    break
        elif hasattr(route, 'router'):
            # 检查包含的路由器
            if hasattr(route, 'prefix') and route.prefix.startswith('/apps/'):
                print(f"Included router with prefix: {route.prefix}")
                count += 1
                if count > 10:
                    break

if __name__ == "__main__":
    print("Checking routes starting with /apps/...")
    print(f"Total routes in app: {len(app.routes)}")
    print_routes(app)
