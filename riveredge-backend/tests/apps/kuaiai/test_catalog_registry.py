"""KU-AI catalog 注册表与 agent 工具过滤（轻量单测，避免全量 app 导入）。"""

from __future__ import annotations

from apps.kuaiai.catalog.agents import get_agent_spec, is_agent_enabled
from apps.kuaiai.catalog.capabilities import CAPABILITY_SPECS, get_capability_spec


class TestCatalogRegistry:
    def test_capability_count(self):
        assert len(CAPABILITY_SPECS) == 8

    def test_agent_count(self):
        from apps.kuaiai.catalog.agents import AGENT_SPECS

        assert len(AGENT_SPECS) == 6

    def test_get_capability_spec(self):
        assert get_capability_spec("ask") is not None
        assert get_capability_spec("missing") is None

    def test_get_agent_spec(self):
        assert get_agent_spec("inventory") is not None
        assert get_agent_spec("nope") is None


class TestIsAgentEnabled:
    def test_default_enabled(self):
        assert is_agent_enabled({}, "planner") is True

    def test_explicit_disabled(self):
        assert is_agent_enabled({"agents": {"planner": {"enabled": False}}}, "planner") is False
