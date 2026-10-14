"""提交审核时解析发起人自选审批人（与 start_approval 快照契约一致）。"""

from __future__ import annotations

from typing import Any, Dict, List, Optional, Tuple


def parse_submit_approver_selection(
    payload: Optional[Dict[str, Any]],
) -> Tuple[Optional[List[int]], Optional[Dict[str, List[int]]]]:
    """
    从 uni-audit submit body 解析 selected_approver_user_ids / selected_approver_by_node。
    节点键为流程图 node id；值为用户 id 列表（正整数）。
    """
    if not payload:
        return None, None

    def _clean_ids(raw: Any) -> List[int]:
        if raw is None:
            return []
        items = raw if isinstance(raw, list) else [raw]
        out: List[int] = []
        for x in items:
            try:
                uid = int(x)
            except (TypeError, ValueError):
                continue
            if uid > 0:
                out.append(uid)
        return list(dict.fromkeys(out))

    user_ids: Optional[List[int]] = None
    if "selected_approver_user_ids" in payload:
        cleaned = _clean_ids(payload.get("selected_approver_user_ids"))
        user_ids = cleaned or None

    by_node: Optional[Dict[str, List[int]]] = None
    raw_by_node = payload.get("selected_approver_by_node")
    if isinstance(raw_by_node, dict):
        mapped: Dict[str, List[int]] = {}
        for node_id, ids in raw_by_node.items():
            key = str(node_id or "").strip()
            if not key:
                continue
            cleaned = _clean_ids(ids)
            if cleaned:
                mapped[key] = cleaned
        by_node = mapped or None

    if not user_ids and not by_node:
        return None, None
    return user_ids, by_node
