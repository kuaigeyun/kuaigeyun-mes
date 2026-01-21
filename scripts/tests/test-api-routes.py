"""
API路由测试工具（从scripts/tests目录运行）

Author: Auto (AI Assistant)
Date: 2026-01-19
"""

import sys
import asyncio
import importlib.util
from pathlib import Path

# 添加src目录到Python路径
backend_path = Path(__file__).parent.parent.parent / "riveredge-backend"
src_path = backend_path / "src"
if src_path.exists():
    sys.path.insert(0, str(src_path))
else:
    # 如果从backend目录运行，直接使用当前目录
    backend_path = Path(__file__).parent.parent.parent / "riveredge-backend"
    src_path = backend_path / "src"
    sys.path.insert(0, str(src_path))

# 导入主测试逻辑（使用importlib加载带连字符的文件名）
test_file = Path(__file__).parent / "test-all-api-routes.py"
spec = importlib.util.spec_from_file_location("test_all_api_routes", test_file)
test_all_api_routes = importlib.util.module_from_spec(spec)
spec.loader.exec_module(test_all_api_routes)

if __name__ == "__main__":
    exit_code = asyncio.run(test_all_api_routes.main())
    sys.exit(exit_code)
