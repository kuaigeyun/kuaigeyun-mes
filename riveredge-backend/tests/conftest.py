"""
Pytest 配置与 fixtures

确保 tests 能正确导入 src 下的模块。
集成测试需设置 TEST_DATABASE_URL 或 RUN_INTEGRATION_TESTS=1 并配置测试数据库。
"""

import os
import sys
from pathlib import Path

import pytest

# 将 src 目录加入 Python 路径（apps 位于 src/apps 下）
backend_root = Path(__file__).resolve().parent.parent
src_path = backend_root / "src"
if str(src_path) not in sys.path:
    sys.path.insert(0, str(src_path))


def _integration_tests_enabled() -> bool:
    """检查是否启用集成测试（需配置测试数据库）"""
    return bool(os.environ.get("TEST_DATABASE_URL") or os.environ.get("RUN_INTEGRATION_TESTS"))


@pytest.fixture(scope="session")
def integration_db_available():
    """
    集成测试数据库可用性检查。
    若未设置 TEST_DATABASE_URL 或 RUN_INTEGRATION_TESTS，集成测试将跳过。
    运行方式: TEST_DATABASE_URL=postgres://... uv run pytest tests/ -m integration
    """
    if not _integration_tests_enabled():
        pytest.skip(
            "集成测试已跳过。请设置 TEST_DATABASE_URL 或 RUN_INTEGRATION_TESTS=1 以运行。"
        )
