"""
API路由测试工具（从backend目录运行）

Author: Auto (AI Assistant)
Date: 2026-01-19
"""

import sys
import asyncio
from pathlib import Path

# 添加src目录到Python路径
src_path = Path(__file__).parent / "src"
sys.path.insert(0, str(src_path))

# 导入主测试逻辑
sys.path.insert(0, str(Path(__file__).parent.parent))
from test_all_api_routes import main

if __name__ == "__main__":
    exit_code = asyncio.run(main())
    sys.exit(exit_code)
