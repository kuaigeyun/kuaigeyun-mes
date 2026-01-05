"""
集成测试配置

提供集成测试所需的fixtures，直接导入e2e的fixtures。

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

# 直接导入e2e的fixtures（不使用pytest_plugins，避免路径问题）
# 这些fixtures会在pytest发现时自动注册
import importlib.util
e2e_conftest_path = backend_root / "tests" / "e2e" / "conftest.py"
spec = importlib.util.spec_from_file_location("tests.e2e.conftest", e2e_conftest_path)
if spec and spec.loader:
    e2e_conftest = importlib.util.module_from_spec(spec)
    spec.loader.exec_module(e2e_conftest)
    # 导入所有fixtures
    for name in dir(e2e_conftest):
        if name.startswith('test_') or name in ['db_setup', 'auth_headers']:
            globals()[name] = getattr(e2e_conftest, name)
