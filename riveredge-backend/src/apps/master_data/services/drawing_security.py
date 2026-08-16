"""图档密级：等级定义、用户授权、可见性。"""

from __future__ import annotations

from typing import List, Optional

from apps.master_data.models.drawing import DrawingUserClearance, EngineeringDrawing
from core.services.authorization.user_permission_service import UserPermissionService
from infra.exceptions.exceptions import AuthorizationError, ValidationError
from infra.models.user import User

SECURITY_LEVEL_RANK = {
    "public": 0,
    "internal": 1,
    "secret": 2,
    "confidential": 3,
}
SECURITY_LEVELS = frozenset(SECURITY_LEVEL_RANK)
DEFAULT_DRAWING_SECURITY_LEVEL = "internal"
DEFAULT_USER_CLEARANCE = "public"
PRINT_LOAN_REQUIRED_LEVELS = frozenset({"secret", "confidential"})
SECURITY_LEVEL_LABELS = {
    "public": "公开",
    "internal": "内部",
    "secret": "秘密",
    "confidential": "机密",
}


def normalize_security_level(value: Optional[str], *, field: str = "密级") -> str:
    level = (value or "").strip().lower()
    if level not in SECURITY_LEVELS:
        raise ValidationError(f"{field}无效，允许: {', '.join(sorted(SECURITY_LEVELS))}")
    return level


class DrawingSecurityService:
    @staticmethod
    async def allowed_security_levels(
        tenant_id: int, user: Optional[User]
    ) -> Optional[List[str]]:
        """管理员不过滤；其余返回 rank ≤ 授权的密级列表。无授权行按 public。"""
        if user is not None and await UserPermissionService.is_admin_bypass(user, tenant_id):
            return None
        rank = await DrawingSecurityService.user_clearance_rank(tenant_id, user)
        return [level for level, item_rank in SECURITY_LEVEL_RANK.items() if item_rank <= rank]

    @staticmethod
    async def user_clearance_rank(tenant_id: int, user: Optional[User]) -> int:
        if user is None:
            return SECURITY_LEVEL_RANK[DEFAULT_USER_CLEARANCE]
        row = await DrawingUserClearance.get_or_none(tenant_id=tenant_id, user_id=int(user.id))
        if not row:
            return SECURITY_LEVEL_RANK[DEFAULT_USER_CLEARANCE]
        if row.security_level not in SECURITY_LEVEL_RANK:
            raise ValidationError(f"密级授权配置无效: {row.security_level}")
        return SECURITY_LEVEL_RANK[row.security_level]

    @staticmethod
    async def assert_can_view(
        tenant_id: int, user: Optional[User], drawing: EngineeringDrawing
    ) -> None:
        allowed = await DrawingSecurityService.allowed_security_levels(tenant_id, user)
        level = drawing.security_level
        if level not in SECURITY_LEVELS:
            raise ValidationError(f"图纸密级配置无效: {level}")
        if allowed is not None and level not in allowed:
            raise AuthorizationError("无权查看该密级图纸")

    @staticmethod
    def sql_in_clause(allowed: Optional[List[str]], start_param: int) -> tuple[str, List[str], int]:
        """返回 (sql片段, 参数, 下一占位符序号)。allowed is None 表示不过滤。"""
        if allowed is None:
            return "", [], start_param
        if not allowed:
            return "1 = 0", [], start_param
        placeholders = ", ".join(f"${start_param + i}" for i in range(len(allowed)))
        return f"security_level IN ({placeholders})", list(allowed), start_param + len(allowed)
