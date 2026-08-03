"""KU-AI capability_mode 与 ContextBroker 单元测试。"""

from __future__ import annotations

from apps.kuaiai.services.chat_tools import get_chat_tool_definitions_for_mode, resolve_capability_mode
from apps.kuaiai.services.context_broker import ContextBroker, KUAI_GUIDE_APPEND, KUAI_QUERY_APPEND


class TestResolveCapabilityMode:
    def test_default_ask(self):
        assert resolve_capability_mode(None) == "ask"
        assert resolve_capability_mode({}) == "ask"

    def test_top_level_mode(self):
        assert resolve_capability_mode({"capability_mode": "query"}) == "query"
        assert resolve_capability_mode({"capability_mode": "guide"}) == "guide"

    def test_extra_mode(self):
        assert resolve_capability_mode({"extra": {"capability_mode": "query"}}) == "query"

    def test_unknown_falls_back_ask(self):
        assert resolve_capability_mode({"capability_mode": "unknown"}) == "ask"


class TestToolDefinitionsForMode:
    def test_query_only_report_tools(self):
        names = {item["function"]["name"] for item in get_chat_tool_definitions_for_mode("query")}
        assert names == {"list_accessible_reports", "execute_report"}

    def test_ask_excludes_report_tools(self):
        names = {item["function"]["name"] for item in get_chat_tool_definitions_for_mode("ask")}
        assert "list_accessible_reports" not in names
        assert "execute_report" not in names
        assert "search_business_documents" in names

    def test_guide_has_no_tools(self):
        assert get_chat_tool_definitions_for_mode("guide") == []


class TestContextBrokerCapabilityAppend:
    def test_query_append(self):
        text = ContextBroker.build_capability_append({"capability_mode": "query"})
        assert KUAI_QUERY_APPEND.strip() in text

    def test_guide_append(self):
        text = ContextBroker.build_capability_append({"extra": {"capability_mode": "guide"}})
        assert KUAI_GUIDE_APPEND.strip() in text
