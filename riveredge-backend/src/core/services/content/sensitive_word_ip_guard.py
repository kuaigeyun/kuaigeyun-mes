"""敏感词违规计数与封禁：按账号 ID + IP 成对判断，避免局域网误封。"""

from __future__ import annotations

from dataclasses import dataclass
from typing import ClassVar, Optional

from loguru import logger

from infra.exceptions.exceptions import AuthorizationError, ValidationError
from infra.infrastructure.cache.cache import cache

MAX_STRIKES = 3
_CACHE_PREFIX = "content:sensitive_word"


async def tenant_has_sensitive_word_control(tenant_id: Optional[int]) -> bool:
    """组织未开启敏感词控制时返回 False（含无组织）。"""
    if tenant_id is None:
        return False
    try:
        parsed = int(tenant_id)
    except (TypeError, ValueError):
        return False
    if parsed <= 0:
        return False
    from infra.models.tenant import Tenant

    tenant = await Tenant.get_or_none(id=parsed)
    if tenant is None:
        return False
    return bool(tenant.sensitive_word_enabled)


@dataclass(frozen=True)
class SensitiveWordViolationResult:
    strike_count: int
    ip_banned: bool
    message: str


class SensitiveWordIpGuardService:
    """同一账号在同一 IP 累计敏感词命中；第 3 次封禁该账号在该 IP 的登录。"""

    _instance: Optional["SensitiveWordIpGuardService"] = None
    _memory_mode: ClassVar[bool] = False
    _memory_strikes: ClassVar[dict[str, int]] = {}
    _memory_banned: ClassVar[set[str]] = set()

    @classmethod
    def instance(cls) -> "SensitiveWordIpGuardService":
        if cls._instance is None:
            cls._instance = cls()
        return cls._instance

    @classmethod
    def use_memory_backend(cls) -> None:
        cls._memory_mode = True
        cls._memory_strikes.clear()
        cls._memory_banned.clear()

    @classmethod
    def reset_memory_backend(cls) -> None:
        cls._memory_strikes.clear()
        cls._memory_banned.clear()

    @staticmethod
    def _normalize_ip(ip: str) -> str:
        return (ip or "").strip() or "0.0.0.0"

    @staticmethod
    def _normalize_user_id(user_id: Optional[int]) -> Optional[int]:
        if user_id is None:
            return None
        try:
            parsed = int(user_id)
        except (TypeError, ValueError):
            return None
        return parsed if parsed > 0 else None

    @staticmethod
    def _ip_token(ip: str) -> str:
        return SensitiveWordIpGuardService._normalize_ip(ip).replace(":", "_")

    @classmethod
    def _subject_key(cls, ip: str, user_id: int) -> str:
        return f"u{user_id}:{cls._ip_token(ip)}"

    @classmethod
    def _strike_key(cls, ip: str, user_id: int) -> str:
        return f"{_CACHE_PREFIX}:strike:{cls._subject_key(ip, user_id)}"

    @classmethod
    def _ban_key(cls, ip: str, user_id: int) -> str:
        return f"{_CACHE_PREFIX}:banned:{cls._subject_key(ip, user_id)}"

    async def is_banned(self, ip: str, user_id: Optional[int] = None) -> bool:
        normalized_user = self._normalize_user_id(user_id)
        if normalized_user is None:
            return False
        normalized_ip = self._normalize_ip(ip)
        subject = self._subject_key(normalized_ip, normalized_user)
        if self._memory_mode:
            return subject in self._memory_banned
        return await cache.exists(self._ban_key(normalized_ip, normalized_user))

    async def ensure_ip_allowed(self, ip: str, user_id: Optional[int] = None) -> None:
        if await self.is_banned(ip, user_id):
            raise AuthorizationError("当前账号在此网络已被封禁，无法登录或使用系统")

    async def record_violation(
        self,
        ip: str,
        *,
        field: str,
        matched: str,
        user_id: Optional[int] = None,
    ) -> SensitiveWordViolationResult:
        normalized_ip = self._normalize_ip(ip)
        normalized_user = self._normalize_user_id(user_id)
        if normalized_user is None:
            logger.warning(
                "敏感词违规无账号身份，不累计封禁 ip={} field={} matched={}",
                normalized_ip,
                field,
                matched,
            )
            return SensitiveWordViolationResult(
                strike_count=0,
                ip_banned=False,
                message="内容包含不当用语，请修改后重试。",
            )

        strike_count = await self._increment_strike(normalized_ip, normalized_user)
        ip_banned = strike_count >= MAX_STRIKES
        if ip_banned:
            await self._ban_subject(normalized_ip, normalized_user)
            message = "内容包含不当用语，当前账号在此网络已被封禁，无法继续使用"
        else:
            message = (
                f"内容包含不当用语，请修改后重试。"
                f"这是第 {strike_count} 次违规，累计 {MAX_STRIKES} 次将封禁当前账号在此网络的访问。"
            )
        logger.warning(
            "敏感词违规 user_id={} ip={} strike={} banned={} field={} matched={}",
            normalized_user,
            normalized_ip,
            strike_count,
            ip_banned,
            field,
            matched,
        )
        return SensitiveWordViolationResult(
            strike_count=strike_count,
            ip_banned=ip_banned,
            message=message,
        )

    async def build_validation_error(
        self,
        ip: str,
        *,
        field: str,
        matched: str,
        user_id: Optional[int] = None,
    ) -> ValidationError:
        result = await self.record_violation(ip, field=field, matched=matched, user_id=user_id)
        return ValidationError(
            result.message,
            details={
                "matched": matched,
                "field": field,
                "strike_count": result.strike_count,
                "ip_banned": result.ip_banned,
                "user_id": self._normalize_user_id(user_id),
            },
        )

    async def _increment_strike(self, ip: str, user_id: int) -> int:
        subject = self._subject_key(ip, user_id)
        if self._memory_mode:
            current = self._memory_strikes.get(subject, 0) + 1
            self._memory_strikes[subject] = current
            return current
        key = self._strike_key(ip, user_id)
        raw = await cache.get(key)
        current = int(raw) + 1 if raw and raw.isdigit() else 1
        await cache.set(key, str(current))
        return current

    async def _ban_subject(self, ip: str, user_id: int) -> None:
        subject = self._subject_key(ip, user_id)
        if self._memory_mode:
            self._memory_banned.add(subject)
            return
        await cache.set(self._ban_key(ip, user_id), "1")
