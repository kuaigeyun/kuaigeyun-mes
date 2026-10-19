"""提交审核时解析发起人自选审批人（与 start_approval 快照契约一致）。"""

from __future__ import annotations

from typing import Any, Dict, List, Optional, Tuple

from infra.exceptions.exceptions import ValidationError


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


def parse_submit_branch_selection(
    payload: Optional[Dict[str, Any]],
) -> Dict[str, int]:
    """
    从 submit body 解析发起人条件分支下标。
    支持 initiator_branch_by_node 或 instance_data_patch 内 __branch_index_{条件节点id}。
    """
    if not payload:
        return {}

    def _parse_index(raw: Any) -> Optional[int]:
        if raw is None:
            return None
        if isinstance(raw, bool):
            return 0 if raw else None
        try:
            idx = int(raw)
        except (TypeError, ValueError):
            return None
        return idx if idx >= 0 else None

    out: Dict[str, int] = {}
    raw_map = payload.get("initiator_branch_by_node")
    if isinstance(raw_map, dict):
        for node_id, raw_idx in raw_map.items():
            key = str(node_id or "").strip()
            if not key:
                continue
            idx = _parse_index(raw_idx)
            if idx is not None:
                out[key] = idx

    patch = payload.get("instance_data_patch")
    if isinstance(patch, dict):
        for key, raw_idx in patch.items():
            sk = str(key)
            if not sk.startswith("__branch_index_"):
                continue
            cond_id = sk[len("__branch_index_") :]
            if not cond_id.strip():
                continue
            idx = _parse_index(raw_idx)
            if idx is not None:
                out[cond_id] = idx
    return out


def merge_branch_selection_into_instance_data(
    data: Dict[str, Any],
    branch_by_condition_node: Dict[str, int],
) -> Dict[str, Any]:
    merged = dict(data or {})
    for cond_id, idx in (branch_by_condition_node or {}).items():
        key = str(cond_id or "").strip()
        if not key:
            continue
        try:
            edge_index = int(idx)
        except (TypeError, ValueError) as exc:
            raise ValidationError(f"条件节点 {key} 分支下标非法") from exc
        if edge_index < 0:
            raise ValidationError(f"条件节点 {key} 分支下标不可为负")
        merged[f"__branch_index_{key}"] = edge_index
    return merged
