"""审批多审批人：标识解析、或签/会签完成判定与待办数据可见性。"""

from __future__ import annotations

from unittest.mock import AsyncMock, MagicMock, patch

import pytest

from core.services.approval.approval_data_scope import (
    list_pending_approver_entity_ids,
    user_is_pending_approver_for_entity,
)
from core.services.approval.approval_instance_service import ApprovalInstanceService


def _make_instance(*, approval_type: str = "OR", node_id: str = "approval-1") -> MagicMock:
    instance = MagicMock()
    instance.current_node = node_id
    instance.process = MagicMock()
    instance.process.nodes = {
        "nodes": [
            {
                "id": node_id,
                "type": "approval",
                "data": {"approvalType": approval_type, "label": "审核"},
            }
        ],
        "edges": [],
    }
    return instance


def _task(*, status: str, sign_type: str | None = None) -> MagicMock:
    t = MagicMock()
    t.status = status
    t.sign_type = sign_type
    return t


class TestCheckNodeCompletion:
    @pytest.mark.asyncio
    async def test_or_sign_completes_when_one_approved_and_peer_still_pending(self):
        """或签：一人通过即完成，不等待其他指定人。"""
        instance = _make_instance(approval_type="OR")
        qs = MagicMock()
        qs.all = AsyncMock(
            return_value=[
                _task(status="approved"),
                _task(status="pending"),
            ]
        )
        with patch(
            "core.services.approval.approval_instance_service.ApprovalTask.filter",
            return_value=qs,
        ):
            done, status = await ApprovalInstanceService._check_node_completion(instance)
        assert done is True
        assert status == "approved"

    @pytest.mark.asyncio
    async def test_or_sign_waits_for_after_sign_pending(self):
        """或签后加签：须等后加签人处理完。"""
        instance = _make_instance(approval_type="OR")
        qs = MagicMock()
        qs.all = AsyncMock(
            return_value=[
                _task(status="approved"),
                _task(status="pending", sign_type="after"),
            ]
        )
        with patch(
            "core.services.approval.approval_instance_service.ApprovalTask.filter",
            return_value=qs,
        ):
            done, status = await ApprovalInstanceService._check_node_completion(instance)
        assert done is False
        assert status == "pending"

    @pytest.mark.asyncio
    async def test_or_sign_reject_completes_immediately(self):
        instance = _make_instance(approval_type="OR")
        qs = MagicMock()
        qs.all = AsyncMock(
            return_value=[
                _task(status="rejected"),
                _task(status="pending"),
            ]
        )
        with patch(
            "core.services.approval.approval_instance_service.ApprovalTask.filter",
            return_value=qs,
        ):
            done, status = await ApprovalInstanceService._check_node_completion(instance)
        assert done is True
        assert status == "rejected"

    @pytest.mark.asyncio
    async def test_and_sign_waits_until_all_approved(self):
        """会签：一人通过、另一人仍 pending 时不完成。"""
        instance = _make_instance(approval_type="AND")
        qs = MagicMock()
        qs.all = AsyncMock(
            return_value=[
                _task(status="approved"),
                _task(status="pending"),
            ]
        )
        with patch(
            "core.services.approval.approval_instance_service.ApprovalTask.filter",
            return_value=qs,
        ):
            done, status = await ApprovalInstanceService._check_node_completion(instance)
        assert done is False
        assert status == "pending"

    @pytest.mark.asyncio
    async def test_and_sign_completes_when_all_approved(self):
        instance = _make_instance(approval_type="AND")
        qs = MagicMock()
        qs.all = AsyncMock(
            return_value=[
                _task(status="approved"),
                _task(status="approved"),
            ]
        )
        with patch(
            "core.services.approval.approval_instance_service.ApprovalTask.filter",
            return_value=qs,
        ):
            done, status = await ApprovalInstanceService._check_node_completion(instance)
        assert done is True
        assert status == "approved"


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
