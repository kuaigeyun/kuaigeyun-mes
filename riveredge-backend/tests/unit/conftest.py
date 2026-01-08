"""
单元测试配置

提供单元测试所需的配置和fixtures。

Author: Auto (AI Assistant)
Date: 2026-01-15
"""

import pytest
import sys
from pathlib import Path

# 添加src目录到路径（在pytest导入测试模块之前）
backend_root = Path(__file__).parent.parent.parent
src_path = backend_root / "src"
if str(src_path) not in sys.path:
    sys.path.insert(0, str(src_path))







