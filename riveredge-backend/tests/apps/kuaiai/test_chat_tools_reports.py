"""KU-AI 报表 ChatTools 单元测试。"""

from __future__ import annotations

import asyncio
import json
from types import SimpleNamespace
from unittest.mock import AsyncMock, patch

from apps.kuaiai.services.chat_tools import ChatToolExecutor


def _make_user(user_id: int = 1):
    return SimpleNamespace(id=user_id)


class TestReportChatTools:
    def test_list_reports_requires_permission(self):
        executor = ChatToolExecutor(tenant_id=1, user=_make_user())

        async def run():
            with patch(
                "apps.kuaiai.services.chat_tools.UserPermissionService.has_permission",
                new=AsyncMock(return_value=False),
            ):
                return await executor.execute("list_accessible_reports", {})

        raw = asyncio.run(run())
        payload = json.loads(raw)
        assert "error" in payload
        assert "无权" in payload["error"]

    def test_list_reports_returns_compact_catalog(self):
        executor = ChatToolExecutor(tenant_id=1, user=_make_user(), is_tenant_admin=True)
        from apps.kuaiai.services.chat_tools import _truncate_tool_result

        mock_result = _truncate_tool_result(
            {
                "reports": [
                    {
                        "id": 10,
                        "name": "销售汇总",
                        "description": "按客户汇总销售额",
                        "category": "system",
                        "classify": "销售",
                    }
                ],
                "total": 1,
            }
        )

        async def run():
            with patch.object(
                executor,
                "_list_accessible_reports",
                new=AsyncMock(return_value=mock_result),
            ):
                return await executor.execute("list_accessible_reports", {})

        raw = asyncio.run(run())
        payload = json.loads(raw)
        assert payload["total"] == 1
        assert payload["reports"][0]["id"] == 10

    def test_execute_report_truncates_rows(self):
        executor = ChatToolExecutor(tenant_id=1, user=_make_user(), is_tenant_admin=True)
        from apps.kuaiai.services.chat_tools import _truncate_tool_result
        from apps.kuaiai.services.markdown_table import rows_to_markdown_table

        rows = [{"客户": f"C{i}", "金额": i} for i in range(120)]
        rows_data = rows[:100]
        mock_result = _truncate_tool_result(
            {
                "report_id": 5,
                "columns": ["客户", "金额"],
                "total": 120,
                "returned_rows": 100,
                "truncated": True,
                "rows": rows_data,
                "markdown_table": rows_to_markdown_table(
                    ["客户", "金额"],
                    [[r["客户"], r["金额"]] for r in rows_data],
                ),
            }
        )

        async def run():
            with patch.object(
                executor,
                "_execute_report",
                new=AsyncMock(return_value=mock_result),
            ):
                return await executor.execute("execute_report", {"report_id": 5, "filters": {}})

        raw = asyncio.run(run())
        payload = json.loads(raw)
        assert payload["truncated"] is True
        assert payload["returned_rows"] == 100
        assert "markdown_table" in payload

    def test_execute_report_missing_id(self):
        executor = ChatToolExecutor(tenant_id=1, user=_make_user(), is_tenant_admin=True)
        raw = asyncio.run(executor.execute("execute_report", {}))
        payload = json.loads(raw)
        assert "error" in payload
