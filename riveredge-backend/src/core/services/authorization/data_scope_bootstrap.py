"""应用启动时注册框架级数据范围解析器（幂等）。"""

from core.services.authorization.data_scope_resolvers import register_builtin_scope_resolvers

_bootstrapped = False


def ensure_data_scope_framework() -> None:
    global _bootstrapped
    if _bootstrapped:
        return
    register_builtin_scope_resolvers()
    _bootstrapped = True
