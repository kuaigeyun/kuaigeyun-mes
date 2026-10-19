"""用户登录密码写入（策略校验 + 生命周期字段）。"""

from __future__ import annotations

from typing import Any, Mapping, Optional

from core.domain.security.password_policy import PasswordPolicy, validate_login_password
from core.utils.timezone_utils import resolve_business_datetime
from infra.models.user import User


def build_password_user_context(user: User) -> dict[str, Any]:
    return {
        "username": user.username,
        "full_name": user.full_name,
        "phone": user.phone,
        "employee_code": None,
    }


async def apply_login_password_to_user(
    user: User,
    password: str,
    policy: PasswordPolicy,
    *,
    must_change_password: bool = False,
    user_context: Optional[Mapping[str, Any]] = None,
) -> None:
    ctx = dict(user_context or build_password_user_context(user))
    validate_login_password(password, policy, user_context=ctx)
    user.password_hash = User.hash_password(password)
    user.password_changed_at = resolve_business_datetime()
    user.must_change_password = must_change_password
