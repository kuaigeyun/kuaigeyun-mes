"""审批节点概况：路径与跳过状态。"""

from core.services.approval.approval_instance_service import ApprovalInstanceService


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
