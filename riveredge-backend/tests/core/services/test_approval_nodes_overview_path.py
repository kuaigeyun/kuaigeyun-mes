"""审批节点概况：路径与跳过状态。"""

from core.services.approval.approval_instance_service import ApprovalInstanceService


def _branch_after_n2_graph():
    """二级上级 → 条件 → 总经理特批 / 采购副总（与现场流程同构）。"""
    return {
        "nodes": [
            {"id": "start", "type": "start"},
            {"id": "n1", "type": "approval", "data": {"label": "直接上级"}},
            {"id": "n2", "type": "approval", "data": {"label": "二级上级"}},
            {"id": "cond", "type": "condition", "data": {"label": "是否总经理特批"}},
            {"id": "n3", "type": "approval", "data": {"label": "总经理(特殊情况)"}},
            {"id": "n4", "type": "approval", "data": {"label": "采购副总"}},
            {"id": "end", "type": "end"},
        ],
        "edges": [
            {"source": "start", "target": "n1"},
            {"source": "n1", "target": "n2"},
            {"source": "n2", "target": "cond"},
            {"source": "cond", "target": "n3"},
            {"source": "cond", "target": "n4"},
            {"source": "n3", "target": "n4"},
            {"source": "n4", "target": "end"},
        ],
    }


def test_graph_node_ids_on_some_path_to_target_linear():
    graph = {
        "nodes": [
            {"id": "start", "type": "start"},
            {"id": "n1", "type": "approval"},
            {"id": "n2", "type": "approval"},
            {"id": "n3", "type": "approval"},
            {"id": "end", "type": "end"},
        ],
        "edges": [
            {"source": "start", "target": "n1"},
            {"source": "n1", "target": "n2"},
            {"source": "n2", "target": "n3"},
            {"source": "n3", "target": "end"},
        ],
    }
    on_path = ApprovalInstanceService._graph_node_ids_on_some_path_to_target(graph, "n3")
    assert on_path == {"start", "n1", "n2", "n3"}


def test_graph_node_ids_on_some_path_when_branch_skips_middle():
    """节点1同时连到 n2 与 n3 时，当前在 n3 则 n2 不在 start→n3 的必经路径上。"""
    graph = {
        "nodes": [
            {"id": "start", "type": "start"},
            {"id": "n1", "type": "approval"},
            {"id": "n2", "type": "approval"},
            {"id": "n3", "type": "approval"},
            {"id": "end", "type": "end"},
        ],
        "edges": [
            {"source": "start", "target": "n1"},
            {"source": "n1", "target": "n3"},
            {"source": "n1", "target": "n2"},
            {"source": "n2", "target": "end"},
            {"source": "n3", "target": "end"},
        ],
    }
    on_path = ApprovalInstanceService._graph_node_ids_on_some_path_to_target(graph, "n3")
    assert "n2" not in on_path
    assert "n3" in on_path
    assert "n1" in on_path


def test_future_nodes_reachable_from_current_must_not_count_as_dead_branch():
    """当前停在 n2 时，条件/总经理/采购副总仍可达，不得标已跳过。"""
    graph = _branch_after_n2_graph()
    on_path = ApprovalInstanceService._graph_node_ids_on_some_path_to_target(graph, "n2")
    reachable = ApprovalInstanceService._graph_node_ids_reachable_from(graph, "n2")
    assert on_path == {"start", "n1", "n2"}
    assert {"cond", "n3", "n4", "end"}.issubset(reachable)
    for nid in ("cond", "n3", "n4"):
        assert nid not in on_path
        assert nid in reachable


def test_dead_branch_not_reachable_after_route_chosen():
    """已走到采购副总（绕过总经理）时，总经理节点才是死支。"""
    graph = _branch_after_n2_graph()
    on_path = ApprovalInstanceService._graph_node_ids_on_some_path_to_target(graph, "n4")
    reachable = ApprovalInstanceService._graph_node_ids_reachable_from(graph, "n4")
    # n3 仍可能在「某条」start→n4 路径上（经 cond→n3→n4），故用可达性区分真死支需结合实际路由历史；
    # 当边仅为 cond→n4（否支）时 n3 不在 on_path。这里构造已选否支后的有效边等价：从 n4 出发不可达 n3。
    assert "n3" not in reachable
    assert "end" in reachable
