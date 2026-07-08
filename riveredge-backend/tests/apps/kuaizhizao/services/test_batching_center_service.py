"""配料中心任务列表：builder 参数与排序。"""

from datetime import datetime, timezone

from apps.kuaizhizao.services.batching_center_service import BatchingCenterService


def test_builder_query_filters_strips_unsupported_keys():
    filters = {
        "keyword": "WO-001",
        "work_order_code": "WO-001",
        "priority": "high",
        "order_by": "-created_at",
    }
    assert BatchingCenterService._builder_query_filters(filters) == {
        "work_order_code": "WO-001",
        "priority": "high",
    }


def test_sort_tasks_handles_aware_created_at_without_type_error():
    from apps.kuaizhizao.schemas.batching_order import BatchingCenterTaskItem

    tasks = [
        BatchingCenterTaskItem(
            task_type="batching_draft",
            task_id=1,
            created_at=datetime(2026, 1, 1, tzinfo=timezone.utc),
        ),
        BatchingCenterTaskItem(
            task_type="batching_draft",
            task_id=2,
            created_at=datetime(2026, 6, 1, tzinfo=timezone.utc),
        ),
        BatchingCenterTaskItem(task_type="batching_draft", task_id=3, created_at=None),
    ]
    BatchingCenterService._sort_tasks(tasks)
    assert [t.task_id for t in tasks] == [1, 2, 3]
