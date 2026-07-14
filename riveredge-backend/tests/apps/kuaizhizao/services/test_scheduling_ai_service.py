"""Scheduling AI service unit tests."""

from apps.kuaizhizao.services.scheduling_ai_service import SchedulingAiService


def test_filter_ids_keeps_allowed_order_and_drops_unknown():
    service = SchedulingAiService()
    allowed = {1, 2, 3}
    assert service._filter_ids([3, 99, 1, "2", None, 4], allowed) == [3, 1, 2]


def test_parse_proposal_filters_hallucinated_ids():
    service = SchedulingAiService()
    data = {
        "summary": "move two orders",
        "warnings": ["note"],
        "workOrderAdjustments": [
            {
                "workOrderId": 10,
                "plannedStartDate": "2026-07-14T08:00:00",
                "plannedEndDate": "2026-07-14T18:00:00",
            },
            {
                "workOrderId": 999,
                "plannedStartDate": "2026-07-14T08:00:00",
                "plannedEndDate": "2026-07-14T18:00:00",
            },
        ],
        "operationAdjustments": [],
        "poolReorder": [10, 888, 11],
    }
    proposal = service._parse_proposal_data(
        data,
        allowed_ids={10, 11},
        allowed_op_ids=set(),
        allowed_station_ids=set(),
    )
    assert len(proposal.work_order_adjustments) == 1
    assert proposal.work_order_adjustments[0].work_order_id == 10
    assert proposal.pool_reorder == [10, 11]
    assert any("999" in w for w in proposal.warnings)
