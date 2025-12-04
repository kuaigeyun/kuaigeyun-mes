"""
Aerich 配置文件
独立配置文件，避免 Python platform 模块冲突

策略：
1. 在添加 src 到路径之前，先预加载 asyncpg（此时 platform 是内置模块）
2. 然后加载配置（需要临时切换 platform 为项目包）
3. 加载完成后，恢复项目 platform 包
"""

import sys
import importlib.util
import importlib.machinery
import os
from pathlib import Path

# ============================================
# 第一步：从标准库直接加载内置 platform 模块
# ============================================
stdlib_platform_path = os.path.join(os.path.dirname(os.__file__), 'platform.py')
if os.path.exists(stdlib_platform_path):
    stdlib_platform_spec = importlib.util.spec_from_file_location('platform', stdlib_platform_path)
    _builtin_platform = importlib.util.module_from_spec(stdlib_platform_spec)
    stdlib_platform_spec.loader.exec_module(_builtin_platform)
else:
    import platform as _builtin_platform

_builtin_platform_ref = _builtin_platform

# 锁定内置 platform 模块到 sys.modules（用于 asyncpg）
sys.modules['platform'] = _builtin_platform_ref

# ============================================
# 第二步：在添加 src 到路径之前，预加载 asyncpg
# ============================================
# 这样 asyncpg 在导入时会使用内置 platform 模块
try:
    import asyncpg
    # asyncpg 已成功导入，platform 已锁定为内置模块
    _asyncpg_loaded = True
except Exception:
    # 如果导入失败，继续（可能在后续导入）
    _asyncpg_loaded = False

# ============================================
# 第三步：添加 src 到路径，准备加载配置
# ============================================
# 文件在项目根目录，需要访问 src/ 目录
project_root = Path(__file__).parent
src_path = project_root / "src"
if str(src_path) not in sys.path:
    sys.path.insert(0, str(src_path))

# ============================================
# 第四步：加载配置（需要临时切换 platform 为项目包）
# ============================================
# 创建命名空间，让 database.py 可以导入 platform.config
_platform_ns = type(sys)('platform')
_platform_config_ns = type(sys)('platform.config')
sys.modules['platform.config'] = _platform_config_ns

# 加载 platform.config.platform_config 模块
config_spec = importlib.util.spec_from_file_location(
    "platform_config",
    src_path / "platform" / "config" / "platform_config.py"
)
config_module = importlib.util.module_from_spec(config_spec)
sys.modules['platform.config.platform_config'] = config_module

# 在执行模块前，临时设置 platform 命名空间
_original_platform = sys.modules['platform']
sys.modules['platform'] = _platform_ns
try:
    config_spec.loader.exec_module(config_module)
finally:
    # 恢复内置 platform 模块
    sys.modules['platform'] = _original_platform

# 创建 platform.infrastructure 命名空间
_platform_infrastructure_ns = type(sys)('platform.infrastructure')
_platform_infrastructure_database_ns = type(sys)('platform.infrastructure.database')
sys.modules['platform.infrastructure'] = _platform_infrastructure_ns
sys.modules['platform.infrastructure.database'] = _platform_infrastructure_database_ns

# 加载 database 模块
database_spec = importlib.util.spec_from_file_location(
    "database_module",
    src_path / "platform" / "infrastructure" / "database" / "database.py"
)
database_module = importlib.util.module_from_spec(database_spec)

# 在执行模块前，临时设置 platform 命名空间
sys.modules['platform'] = _platform_ns
try:
    database_spec.loader.exec_module(database_module)
finally:
    # 恢复内置 platform 模块
    sys.modules['platform'] = _original_platform

# 获取 TORTOISE_ORM
TORTOISE_ORM = database_module.TORTOISE_ORM

# ============================================
# 第五步：恢复项目 platform 包（Tortoise ORM 需要它）
# ============================================
# 清除所有 platform 相关的模块缓存（除了我们创建的命名空间和已加载的 asyncpg）
_modules_to_remove = [k for k in list(sys.modules.keys()) 
                     if k == 'platform' or (k.startswith('platform.') and k not in ['platform.config', 'platform.config.platform_config', 'platform.infrastructure', 'platform.infrastructure.database'])]
for mod_name in _modules_to_remove:
    sys.modules.pop(mod_name, None)

# 现在导入项目的 platform 包
try:
    import platform as _our_platform
    sys.modules['platform'] = _our_platform
except ImportError:
    # 如果导入失败，保持内置 platform
    sys.modules['platform'] = _original_platform

# 最终：确保 platform 是项目包（Tortoise ORM 需要）
# asyncpg 已经在导入时使用了内置 platform，所以现在可以安全地切换
if '_our_platform' in locals() and _our_platform:
    sys.modules['platform'] = _our_platform

# 导出给 Aerich 使用
__all__ = ['TORTOISE_ORM']

