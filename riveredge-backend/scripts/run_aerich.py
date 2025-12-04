#!/usr/bin/env python3
"""
Aerich 包装脚本
在运行 Aerich 之前，确保 Python 内置的 platform 模块可用
"""

import sys
import importlib.util
import importlib.machinery
import subprocess

# 在导入任何其他东西之前，先锁定内置 platform 模块
# 使用 PathFinder 从标准库直接查找，避免路径冲突
stdlib_platform_spec = importlib.machinery.PathFinder.find_spec('platform', None)
if stdlib_platform_spec and stdlib_platform_spec.origin:
    # 从标准库直接加载 platform 模块
    _builtin_platform = importlib.util.module_from_spec(stdlib_platform_spec)
    stdlib_platform_spec.loader.exec_module(_builtin_platform)
    # 锁定内置 platform 模块到 sys.modules
    sys.modules['platform'] = _builtin_platform
else:
    # 备用方案：直接导入
    import platform as _builtin_platform
    sys.modules['platform'] = _builtin_platform

# 现在可以安全地运行 Aerich
if __name__ == '__main__':
    # 传递所有命令行参数给 Aerich
    import aerich.cli
    aerich.cli.main()

