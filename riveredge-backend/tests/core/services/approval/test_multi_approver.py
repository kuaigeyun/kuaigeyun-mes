"""审批多审批人：标识解析与待办数据可见性。"""

from __future__ import annotations

from unittest.mock import AsyncMock, MagicMock, patch

import pytest

from core.services.approval.approval_data_scope import (
    list_pending_approver_entity_ids,
    user_is_pending_approver_for_entity,
)
from core.services.approval.approval_instance_service import ApprovalInstanceService


class TestResolveApproverIdentifiers:
    @pytest.mark.asyncio
    async def test_mixed_uuid_and_numeric_ids(self):
        uuid_a = "aaaaaaaa-bbbb-cccc-dddd-eeeeeeeeeeee"

        async def _first():
            return MagicMock(id=101)

        with patch(
            "core.services.approval.approval_instance_service.User.filter",
            new_callable=AsyncMock,
        ) as user_filter:
            user_mock = MagicMock()
            user_mock.first = _first
            user_filter.return_value = user_mock

            ids = await ApprovalInstanceService._resolve_approver_ids_from_identifiers(
                1,
                [uuid_a, 202],
                by_uuid=None,
            )
        assert ids == [101, 202]


class TestApprovalDataScope:
    @pytest.mark.asyncio
    async def test_list_pending_entity_ids_from_tasks(self):
        inst = MagicMock()
        inst.data = {"entity_type": "sales_order", "entity_id": 9001}
        task = MagicMock()
        task.approval_instance = inst

        with patch(
            "core.services.approval.approval_data_scope.ApprovalTask.filter",
            new_callable=AsyncMock,
        ) as task_filter:
            qs = MagicMock()
            qs.prefetch_related.return_value = qs
            qs.all = AsyncMock(return_value=[task])
            task_filter.return_value = qs

            ids = await list_pending_approver_entity_ids(1, 55, "sales_order")
        assert ids == {9001}

    @pytest.mark.asyncio
    async def test_user_is_pending_approver_for_entity(self):
        with patch(
            "core.services.approval.approval_data_scope.list_pending_approver_entity_ids",
            new_callable=AsyncMock,
            return_value={42, 43},
        ):
            assert await user_is_pending_approver_for_entity(1, 7, "sales_order", 42)
            assert not await user_is_pending_approver_for_entity(1, 7, "sales_order", 99)


class TestDepartmentManagerResolution:
    @pytest.mark.asyncio
    async def test_resolve_managers_for_department_uuids(self):
        dept = MagicMock(manager_id=88)
        with patch(
            "core.services.approval.approval_instance_service.Department.filter",
            new_callable=AsyncMock,
        ) as dept_filter:
            dept_filter.return_value.all = AsyncMock(return_value=[dept])
            with patch.object(
                ApprovalInstanceService,
                "_filter_active_user_ids",
                new_callable=AsyncMock,
                return_value=[88],
            ):
                ids = await ApprovalInstanceService._resolve_managers_for_department_uuids(
                    1, ["dept-uuid-1"]
                )
        assert ids == [88]
