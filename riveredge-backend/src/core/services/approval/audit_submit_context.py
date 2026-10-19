"""提交审核请求内暂存发起人分支选择（供 start_approval 读取）。"""

from __future__ import annotations

from contextvars import ContextVar
from typing import Dict, Optional

_submit_branch_by_node: ContextVar[Optional[Dict[str, int]]] = ContextVar(
    "_submit_branch_by_node",
    default=None,
)


def set_submit_branch_by_node(branch_by_node: Optional[Dict[str, int]]):
    return _submit_branch_by_node.set(branch_by_node or None)


def reset_submit_branch_by_node(token) -> None:
    _submit_branch_by_node.reset(token)


def get_submit_branch_by_node() -> Dict[str, int]:
    raw = _submit_branch_by_node.get()
    return dict(raw) if isinstance(raw, dict) else {}
