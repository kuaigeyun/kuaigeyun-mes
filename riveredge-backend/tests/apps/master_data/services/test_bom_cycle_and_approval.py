"""BOM 循环检测与审批状态机单元测试（不依赖完整 DB fixture 时用逻辑桩）。"""

from __future__ import annotations

from collections import defaultdict
from typing import Dict, List, Optional, Set, Tuple


def _detect_cycle_from_edges(
    edges: List[Tuple[int, int]],
    material_id: int,
    component_id: int,
) -> Dict[str, object]:
    """与 MaterialService.detect_bom_cycle_detail 相同的图算法（父→子）。"""
    if material_id == component_id:
        return {"has_cycle": True, "path": [material_id, component_id]}

    graph: Dict[int, Set[int]] = defaultdict(set)
    for parent, child in edges:
        graph[int(parent)].add(int(child))
    graph[int(material_id)].add(int(component_id))

    def find_path(start: int, target: int) -> Optional[List[int]]:
        stack = [(start, [start])]
        visited: Set[int] = set()
        while stack:
            node, path = stack.pop()
            if node in visited:
                continue
            visited.add(node)
            for neighbor in graph.get(node, set()):
                next_path = path + [neighbor]
                if neighbor == target:
                    return next_path
                if neighbor not in visited:
                    stack.append((neighbor, next_path))
        return None

    path = find_path(int(component_id), int(material_id))
    if path:
        return {"has_cycle": True, "path": [int(material_id)] + path}
    return {"has_cycle": False, "path": []}


def test_detect_cycle_cross_level():
    # A→B→C，再加 C→A 应成环
    edges = [(1, 2), (2, 3)]
    result = _detect_cycle_from_edges(edges, 3, 1)
    assert result["has_cycle"] is True
    assert 1 in result["path"] and 3 in result["path"]


def test_detect_cycle_wrong_direction_would_miss_fixed():
    # C→A 已存在，加 A→C 应成环（旧实现 child→parent 会漏检）
    edges = [(3, 1)]
    result = _detect_cycle_from_edges(edges, 1, 3)
    assert result["has_cycle"] is True


def test_detect_cycle_no_cycle():
    edges = [(1, 2), (1, 3), (2, 4)]
    result = _detect_cycle_from_edges(edges, 1, 5)
    assert result["has_cycle"] is False


def test_approval_state_machine_sets():
    from apps.master_data.services.material_service import (
        _BOM_APPROVE_ALLOWED_FROM,
        _BOM_REVOKE_ALLOWED_FROM,
    )

    assert "draft" in _BOM_APPROVE_ALLOWED_FROM
    assert "pending" in _BOM_APPROVE_ALLOWED_FROM
    assert "approved" not in _BOM_APPROVE_ALLOWED_FROM
    assert "approved" in _BOM_REVOKE_ALLOWED_FROM
    assert "rejected" in _BOM_REVOKE_ALLOWED_FROM
    assert "draft" not in _BOM_REVOKE_ALLOWED_FROM
