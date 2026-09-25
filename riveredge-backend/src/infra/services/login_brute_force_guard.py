"""
登录防暴力破解守卫

PG Cache（CacheEntry）为跨进程失败计数与锁定真源；禁止进程内 limiter 或前端长按冒充防护。
"""

from __future__ import annotations

from infra.config.infra_config import infra_settings
from infra.exceptions.exceptions import login_brute_force_blocked
from infra.infrastructure.cache.cache import Cache

_FAIL_PREFIX = "auth:login:fail"
_LOCK_PREFIX = "auth:login:lock"


def normalize_login_identity(username_or_phone: str, tenant_id: int | None) -> str:
    """规范化登录标识，含租户上下文时拼 tenant_id。"""
    raw = (username_or_phone or "").strip().lower()
    if tenant_id is not None:
        return f"t{tenant_id}:{raw}"
    return f"global:{raw}"


def _retry_minutes() -> int:
    seconds = infra_settings.LOGIN_BRUTE_FORCE_LOCK_SECONDS
    return max(1, seconds // 60)


def _fail_key(kind: str, value: str) -> str:
    return f"{_FAIL_PREFIX}:{kind}:{value}"


def _lock_key(kind: str, value: str) -> str:
    return f"{_LOCK_PREFIX}:{kind}:{value}"


class LoginBruteForceGuard:
    """登录失败计数与临时锁定（IP + 账号双闸）。"""

    @staticmethod
    async def check(client_ip: str, identity: str) -> None:
        """密码校验前调用；任一维度已锁定则拒绝。"""
        await LoginBruteForceGuard._ensure_not_locked("ident", identity)
        ip = (client_ip or "").strip()
        if ip:
            await LoginBruteForceGuard._ensure_not_locked("ip", ip)

    @staticmethod
    async def record_failure(
        client_ip: str,
        identity: str,
        *,
        ident_max_failures: int | None = None,
        ip_max_failures: int | None = None,
    ) -> None:
        """密码错误后累加失败次数，达阈值则写入锁定键。"""
        await LoginBruteForceGuard._increment_failure(
            "ident",
            identity,
            ident_max_failures
            if ident_max_failures is not None
            else infra_settings.LOGIN_BRUTE_FORCE_IDENT_MAX_FAILURES,
        )
        ip = (client_ip or "").strip()
        if ip:
            await LoginBruteForceGuard._increment_failure(
                "ip",
                ip,
                ip_max_failures
                if ip_max_failures is not None
                else infra_settings.LOGIN_BRUTE_FORCE_IP_MAX_FAILURES,
            )

    @staticmethod
    async def clear_identity(identity: str) -> None:
        """登录成功后清除该账号维度的失败计数与锁定。"""
        await Cache.delete(_fail_key("ident", identity))
        await Cache.delete(_lock_key("ident", identity))

    @staticmethod
    async def _ensure_not_locked(kind: str, value: str) -> None:
        locked = await Cache.get(_lock_key(kind, value))
        if locked is not None:
            raise login_brute_force_blocked(_retry_minutes())

    @staticmethod
    async def _increment_failure(kind: str, value: str, max_failures: int) -> None:
        window = infra_settings.LOGIN_BRUTE_FORCE_WINDOW_SECONDS
        lock_seconds = infra_settings.LOGIN_BRUTE_FORCE_LOCK_SECONDS
        fail_key = _fail_key(kind, value)
        raw = await Cache.get(fail_key)
        count = (int(raw) if raw is not None else 0) + 1
        await Cache.set(fail_key, str(count), expire=window)
        if count >= max_failures:
            await Cache.set(_lock_key(kind, value), "1", expire=lock_seconds)
