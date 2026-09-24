"""
总入口登录：同名同密跨租户时，用手机号后四位区分是否为同一实体。
"""

from __future__ import annotations

import re
from typing import List, Optional, Sequence, Tuple, TypeVar

UserT = TypeVar("UserT")


def normalize_phone_digits(phone: Optional[str]) -> Optional[str]:
    """提取手机号数字；空串视为未绑定。"""
    if phone is None:
        return None
    digits = re.sub(r"\D", "", str(phone).strip())
    return digits or None


def phones_same_entity(phone_a: Optional[str], phone_b: Optional[str]) -> bool:
    """
    判定两账号是否视为同一登录实体。
    - 均未绑定手机号 → 同一实体
    - 均已绑定且号码相同 → 同一实体
    - 其余（一方无号、或号码不同）→ 不同实体
    """
    a = normalize_phone_digits(phone_a)
    b = normalize_phone_digits(phone_b)
    if a is None and b is None:
        return True
    if a is not None and b is not None and a == b:
        return True
    return False


def needs_phone_disambiguation(users: Sequence[UserT]) -> bool:
    """多租户验密通过后，是否需手机号后四位进一步区分。"""
    if len(users) <= 1:
        return False
    phones = {normalize_phone_digits(getattr(u, "phone", None)) for u in users}
    non_empty = {p for p in phones if p is not None}
    if not non_empty:
        return False
    if len(non_empty) == 1 and None not in phones:
        return False
    return True


def filter_users_by_phone_last4(users: Sequence[UserT], phone_last4: str) -> List[UserT]:
    """保留手机号后四位匹配的用户行；未绑定手机号的行不参与匹配。"""
    suffix = (phone_last4 or "").strip()
    if len(suffix) != 4 or not suffix.isdigit():
        return []
    matched: List[UserT] = []
    for user in users:
        digits = normalize_phone_digits(getattr(user, "phone", None))
        if digits and digits.endswith(suffix):
            matched.append(user)
    return matched


def apply_phone_disambiguation(
    users: Sequence[UserT],
    phone_last4: Optional[str],
) -> Tuple[List[UserT], Optional[UserT]]:
    """
    应用手机号后四位过滤。
    返回 (过滤后的用户列表, 首选用户)；过滤后为空则 user 为 None。
    """
    filtered = filter_users_by_phone_last4(users, phone_last4 or "")
    if not filtered:
        return [], None
    return filtered, filtered[0]


def filter_same_entity_users(reference: UserT, users: Sequence[UserT]) -> List[UserT]:
    """仅保留与 reference 同用户名且同登录实体（手机号规则）的用户行。"""
    ref_name = getattr(reference, "username", None)
    return [
        u
        for u in users
        if getattr(u, "username", None) == ref_name
        and phones_same_entity(getattr(reference, "phone", None), getattr(u, "phone", None))
    ]
