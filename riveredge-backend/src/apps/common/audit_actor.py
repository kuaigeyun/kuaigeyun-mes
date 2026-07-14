"""统一审计操作人写入（创建/更新）。

列表展示依赖反范式字段 created_by_name / updated_by_name。
禁止在 list API 做用户名 enrich；历史数据用一次性迁移回填。
"""

from __future__ import annotations

from typing import Any, Mapping, MutableMapping, Optional, Union

from core.models.model_fields import model_has_field
from infra.models.user import User

AuditTarget = Union[MutableMapping[str, Any], Any]


def operator_name_from_user(user: Optional[User]) -> str:
    """从 User 解析展示名：full_name 优先，否则 username。"""
    if user is None:
        return ""
    full_name = getattr(user, "full_name", None)
    if isinstance(full_name, str) and full_name.strip():
        return full_name.strip()
    username = getattr(user, "username", None)
    if isinstance(username, str) and username.strip():
        return username.strip()
    return ""


def _set_attr(target: AuditTarget, key: str, value: Any) -> None:
    if isinstance(target, MutableMapping):
        target[key] = value
        return
    setattr(target, key, value)


def _model_type_for(target: AuditTarget) -> Optional[type]:
    if isinstance(target, type):
        return target
    if isinstance(target, Mapping):
        return None
    return type(target)


def apply_create_audit(target: AuditTarget, user: Optional[User]) -> AuditTarget:
    """创建时写入 created/updated 四字段。user 为空则不写。"""
    if user is None:
        return target
    model_cls = _model_type_for(target)
    user_id = int(user.id)
    name = operator_name_from_user(user)
    pairs = (
        ("created_by", user_id),
        ("created_by_name", name),
        ("updated_by", user_id),
        ("updated_by_name", name),
    )
    for key, value in pairs:
        if model_cls is not None and not model_has_field(model_cls, key):
            continue
        _set_attr(target, key, value)
    return target


def apply_update_audit(target: AuditTarget, user: Optional[User]) -> AuditTarget:
    """更新时写入 updated_by / updated_by_name。user 为空则不写。"""
    if user is None:
        return target
    model_cls = _model_type_for(target)
    user_id = int(user.id)
    name = operator_name_from_user(user)
    pairs = (
        ("updated_by", user_id),
        ("updated_by_name", name),
    )
    for key, value in pairs:
        if model_cls is not None and not model_has_field(model_cls, key):
            continue
        _set_attr(target, key, value)
    return target


def _get_attr(target: AuditTarget, key: str) -> Any:
    if isinstance(target, Mapping):
        return target.get(key)
    return getattr(target, key, None)


def audit_response_fields(obj: Any) -> dict[str, Any]:
    """从 ORM/Mapping 取出列表响应所需的审计字段（禁止手写 dict 时漏掉人名）。"""
    return {
        "created_by": _get_attr(obj, "created_by"),
        "created_by_name": _get_attr(obj, "created_by_name"),
        "updated_by": _get_attr(obj, "updated_by"),
        "updated_by_name": _get_attr(obj, "updated_by_name"),
    }


def apply_restore_audit(target: AuditTarget, user: Optional[User]) -> AuditTarget:
    """软删恢复：仅在创建人为空时补 created_*，并始终写 updated_*。"""
    if user is None:
        return target
    model_cls = _model_type_for(target)
    user_id = int(user.id)
    name = operator_name_from_user(user)

    def _allowed(key: str) -> bool:
        return model_cls is None or model_has_field(model_cls, key)

    if _allowed("created_by") and not _get_attr(target, "created_by"):
        _set_attr(target, "created_by", user_id)
    if _allowed("created_by_name"):
        existing_name = _get_attr(target, "created_by_name")
        if not (isinstance(existing_name, str) and existing_name.strip()):
            _set_attr(target, "created_by_name", name)
    return apply_update_audit(target, user)
