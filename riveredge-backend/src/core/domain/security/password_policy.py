"""租户登录密码策略（简易 / 加强，配置驱动）。"""

from __future__ import annotations

import re
import secrets
import string
from dataclasses import dataclass
from datetime import datetime, timedelta, timezone
from typing import Any, Mapping, Optional

from core.utils.timezone_utils import resolve_business_datetime

PASSWORD_MODE_SIMPLE = "simple"
PASSWORD_MODE_STRENGTHENED = "strengthened"

MIN_LENGTH_FLOOR = 6
MIN_LENGTH_CEILING = 128
MIN_CHAR_CLASSES_FLOOR = 1
MIN_CHAR_CLASSES_CEILING = 4
MAX_AGE_DAYS_FLOOR = 0
MAX_AGE_DAYS_CEILING = 365

_DEFAULT_PASSWORD_SECURITY: dict[str, Any] = {
    "password_mode": PASSWORD_MODE_SIMPLE,
    "password_min_length": 8,
    "password_min_char_classes": 3,
    "password_check_personal_weak": True,
    "password_max_age_days": 90,
    "password_reset_help": "",
}


@dataclass(frozen=True)
class PasswordPolicy:
    mode: str
    min_length: int
    min_char_classes: int
    check_personal_weak: bool
    max_age_days: int
    reset_help: str

    @property
    def is_strengthened(self) -> bool:
        return self.mode == PASSWORD_MODE_STRENGTHENED

    @property
    def expiry_enabled(self) -> bool:
        return self.is_strengthened and self.max_age_days > 0

    def to_public_dict(self) -> dict[str, Any]:
        return {
            "mode": self.mode,
            "min_length": self.min_length,
            "min_char_classes": self.min_char_classes if self.is_strengthened else 0,
            "check_personal_weak": self.check_personal_weak if self.is_strengthened else False,
            "max_age_days": self.max_age_days if self.is_strengthened else 0,
            "reset_help": self.reset_help.strip(),
        }


def default_password_security() -> dict[str, Any]:
    return dict(_DEFAULT_PASSWORD_SECURITY)


def merge_password_security(security: Optional[Mapping[str, Any]]) -> dict[str, Any]:
    merged = default_password_security()
    if not security:
        return merged
    for key in merged:
        if key in security and security[key] is not None:
            merged[key] = security[key]
    return normalize_password_security(merged)


def normalize_password_security(raw: Mapping[str, Any]) -> dict[str, Any]:
    data = dict(raw)
    mode = str(data.get("password_mode") or PASSWORD_MODE_SIMPLE).strip().lower()
    if mode not in {PASSWORD_MODE_SIMPLE, PASSWORD_MODE_STRENGTHENED}:
        raise ValueError("password_mode 仅支持 simple 或 strengthened")

    min_length = int(data.get("password_min_length", _DEFAULT_PASSWORD_SECURITY["password_min_length"]))
    min_char_classes = int(
        data.get("password_min_char_classes", _DEFAULT_PASSWORD_SECURITY["password_min_char_classes"])
    )
    max_age_days = int(data.get("password_max_age_days", _DEFAULT_PASSWORD_SECURITY["password_max_age_days"]))
    check_personal = data.get("password_check_personal_weak")
    if check_personal is None:
        check_personal = _DEFAULT_PASSWORD_SECURITY["password_check_personal_weak"]
    reset_help = str(data.get("password_reset_help") or "").strip()

    if not MIN_LENGTH_FLOOR <= min_length <= MIN_LENGTH_CEILING:
        raise ValueError(f"password_min_length 须在 {MIN_LENGTH_FLOOR}–{MIN_LENGTH_CEILING} 之间")
    if not MIN_CHAR_CLASSES_FLOOR <= min_char_classes <= MIN_CHAR_CLASSES_CEILING:
        raise ValueError(
            f"password_min_char_classes 须在 {MIN_CHAR_CLASSES_FLOOR}–{MIN_CHAR_CLASSES_CEILING} 之间"
        )
    if not MAX_AGE_DAYS_FLOOR <= max_age_days <= MAX_AGE_DAYS_CEILING:
        raise ValueError(f"password_max_age_days 须在 {MAX_AGE_DAYS_FLOOR}–{MAX_AGE_DAYS_CEILING} 之间")

    return {
        "password_mode": mode,
        "password_min_length": min_length,
        "password_min_char_classes": min_char_classes,
        "password_check_personal_weak": bool(check_personal),
        "password_max_age_days": max_age_days,
        "password_reset_help": reset_help,
    }


def password_policy_from_security(security: Optional[Mapping[str, Any]]) -> PasswordPolicy:
    merged = merge_password_security(security)
    return PasswordPolicy(
        mode=merged["password_mode"],
        min_length=merged["password_min_length"],
        min_char_classes=merged["password_min_char_classes"],
        check_personal_weak=merged["password_check_personal_weak"],
        max_age_days=merged["password_max_age_days"],
        reset_help=merged["password_reset_help"],
    )


def count_password_char_classes(password: str) -> int:
    classes = 0
    if re.search(r"[a-z]", password):
        classes += 1
    if re.search(r"[A-Z]", password):
        classes += 1
    if re.search(r"\d", password):
        classes += 1
    if re.search(r"[^A-Za-z0-9]", password):
        classes += 1
    return classes


def _personal_weak_tokens(user_context: Optional[Mapping[str, Any]]) -> list[str]:
    if not user_context:
        return []
    tokens: list[str] = []
    for key in ("username", "full_name", "phone", "employee_code"):
        raw = user_context.get(key)
        if raw is None:
            continue
        text = str(raw).strip()
        if len(text) >= 2:
            tokens.append(text.lower())
        digits = re.sub(r"\D", "", text)
        if len(digits) >= 4:
            tokens.append(digits)
    return tokens


def validate_login_password(
    password: str,
    policy: PasswordPolicy,
    *,
    user_context: Optional[Mapping[str, Any]] = None,
) -> None:
    if password is None or not str(password).strip():
        raise ValueError("密码不能为空")
    pwd = str(password)
    if len(pwd) < policy.min_length:
        raise ValueError(f"密码长度不能少于 {policy.min_length} 位")
    if not policy.is_strengthened:
        return
    if count_password_char_classes(pwd) < policy.min_char_classes:
        raise ValueError(
            f"密码须包含大写字母、小写字母、数字及特殊符号中的至少 {policy.min_char_classes} 类"
        )
    if policy.check_personal_weak:
        lowered = pwd.lower()
        for token in _personal_weak_tokens(user_context):
            if token and token in lowered:
                raise ValueError("密码不得包含与本人姓名、工号或手机号相关的弱口令片段")


def generate_temporary_password(policy: PasswordPolicy) -> str:
    """加强模式下管理员重置用的临时密码。"""
    length = max(policy.min_length, 12)
    pools = [
        string.ascii_lowercase,
        string.ascii_uppercase,
        string.digits,
        "!@#$%^&*()-_=+",
    ]
    required = min(policy.min_char_classes, len(pools)) if policy.is_strengthened else 1
    chars: list[str] = []
    for pool in pools[:required]:
        chars.append(secrets.choice(pool))
    alphabet = "".join(pools)
    while len(chars) < length:
        chars.append(secrets.choice(alphabet))
    secrets.SystemRandom().shuffle(chars)
    candidate = "".join(chars)
    validate_login_password(candidate, policy)
    return candidate


def _as_utc(dt: datetime) -> datetime:
    if dt.tzinfo is None:
        return dt.replace(tzinfo=timezone.utc)
    return dt.astimezone(timezone.utc)


def password_is_expired(changed_at: Optional[datetime], policy: PasswordPolicy) -> bool:
    if not policy.expiry_enabled or changed_at is None:
        return False
    age = resolve_business_datetime() - _as_utc(changed_at)
    return age > timedelta(days=policy.max_age_days)


def user_requires_password_change(
    *,
    must_change_password: bool,
    password_changed_at: Optional[datetime],
    policy: PasswordPolicy,
) -> bool:
    if not policy.is_strengthened:
        return False
    if must_change_password:
        return True
    return password_is_expired(password_changed_at, policy)


def apply_password_security_patch(
    current_security: Optional[Mapping[str, Any]],
    patch: Mapping[str, Any],
) -> dict[str, Any]:
    base = dict(current_security or {})
    merged = {**base, **patch}
    normalized = normalize_password_security(merge_password_security(merged))
    return normalized
