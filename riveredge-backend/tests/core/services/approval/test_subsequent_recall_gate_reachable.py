"""撤回本级后续门禁：用可达集，不依赖条件选边键。"""

from __future__ import annotations

from types import SimpleNamespace
from unittest.mock import AsyncMock, patch

import pytest

from core.services.approval.approval_flow_policy import _subsequent_approval_has_human_pass


def _gm_branch_graph() -> dict:
    return {
        "nodes": [
            {"id": "start", "type": "start"},
            {"id": "n2", "type": "approval", "data": {"label": "二级上级"}},
            {
                "id": "cond",
                "type": "condition",
                "data": {"label": "是否总经理特批", "routeMode": "initiator"},
            },
            {"id": "n3", "type": "approval", "data": {"label": "总经理(特殊情况)"}},
            {"id": "n4", "type": "approval", "data": {"label": "采购副总"}},
            {"id": "end", "type": "end"},
        ],
        "edges": [
            {"source": "start", "target": "n2"},
            {"source": "n2", "target": "cond"},
            {"source": "cond", "target": "n3"},
            {"source": "cond", "target": "n4"},
            {"source": "n3", "target": "n4"},
            {"source": "n4", "target": "end"},
        ],
    }


@pytest.mark.asyncio
async def test_subsequent_blocks_when_gm_approved_even_without_branch_key():
    """缺选边时仍应识别总经理已通过，阻断二级上级撤回。"""
    instance = SimpleNamespace(id=3, data={})
    graph = _gm_branch_graph()

    with patch(
        "core.services.approval.approval_flow_policy.ApprovalTask.filter",
        return_value=SimpleNamespace(exists=AsyncMock(return_value=True)),
    ) as mock_filter:
        blocked = await _subsequent_approval_has_human_pass(
            tenant_id=1,
            instance=instance,
            process_nodes=graph,
            from_node_id="n2",
        )

    assert blocked is True
    kwargs = mock_filter.call_args.kwargs
    assert set(kwargs["node_id__in"]) == {"n3", "n4"}


@pytest.mark.asyncio
async def test_subsequent_allows_when_no_downstream_approved():
    instance = SimpleNamespace(id=3, data={})
    graph = _gm_branch_graph()

    with patch(
        "core.services.approval.approval_flow_policy.ApprovalTask.filter",
        return_value=SimpleNamespace(exists=AsyncMock(return_value=False)),
    ):
        blocked = await _subsequent_approval_has_human_pass(
            tenant_id=1,
            instance=instance,
            process_nodes=graph,
            from_node_id="n2",
        )

    assert blocked is False
