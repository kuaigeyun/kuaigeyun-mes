"""
集成测试配置

提供集成测试所需的fixtures，复用E2E测试的fixtures。

Author: Auto (AI Assistant)
Date: 2026-01-15
"""

import pytest
import sys
from pathlib import Path

# 添加src目录到路径
backend_root = Path(__file__).parent.parent.parent
src_path = backend_root / "src"
if str(src_path) not in sys.path:
    sys.path.insert(0, str(src_path))

# 使用pytest_plugins导入e2e的fixtures（使用相对路径）
# pytest会自动发现并注册这些fixtures
pytest_plugins = ["tests.e2e.conftest"]
