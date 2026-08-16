"""纸质 SOP 文控端到端：草稿→审核→生效→受控份→升版→回收，及工位匹配/确认。"""

from __future__ import annotations

import asyncio
from datetime import datetime, timezone
from types import SimpleNamespace
from typing import Any, Dict, List
from unittest.mock import AsyncMock, MagicMock, patch

import pytest

from apps.master_data.schemas.process_schemas import (
    SOPResponse,
    SopControlledCopyDispatchRequest,
    SopControlledCopyRecallRequest,
    SopReviseRequest,
)
from apps.master_data.services.process_service import ProcessService
from apps.master_data.services.sop_control_service import (
    SopControlService,
    _next_revision,
    _validate_carrier_content,
)
from infra.exceptions.exceptions import BusinessLogicError, ValidationError


def _make_user(name: str = "文控员") -> SimpleNamespace:
    return SimpleNamespace(id=1, name=name, username="doc_ctrl")


def _utc_now() -> datetime:
    return datetime(2026, 8, 15, 10, 0, 0, tzinfo=timezone.utc)


def _make_paper_sop(**overrides: Any) -> SimpleNamespace:
    base = dict(
        id=101,
        uuid="sop-paper-001",
        tenant_id=1,
        code="SOP-PAPER-001",
        name="装配纸质作业指导",
        version="1.0",
        current_revision="1.0",
        carrier="paper",
        control_status="draft",
        content=None,
        flow_config=None,
        form_config=None,
        attachments={"files": [{"uuid": "scan-file-001", "name": "SOP扫描件.pdf"}]},
        storage_location="3号线边柜 A-2",
        keeper_name="张保管",
        is_active=True,
        operation_id=10,
        material_uuids=None,
        material_group_uuids=None,
        bom_load_mode="by_material",
        approved_at=None,
        approved_by_name=None,
        effective_at=None,
        obsolete_at=None,
        change_reason=None,
        deleted_at=None,
        created_at=_utc_now(),
        updated_at=_utc_now(),
    )
    base.update(overrides)
    sop = SimpleNamespace(**base)
    sop.save = AsyncMock()
    return sop


class _FakeQuery:
    """最小 Tortoise QuerySet 桩，供文控 E2E 使用。"""

    def __init__(self, rows: List[Any]):
        self._rows = list(rows)
        self._filters: List[tuple[str, Any]] = []
        self._exclude: List[tuple[str, Any]] = []

    def filter(self, **kwargs: Any) -> "_FakeQuery":
        q = _FakeQuery(self._rows)
        q._filters = self._filters + list(kwargs.items())
        q._exclude = list(self._exclude)
        return q

    def exclude(self, **kwargs: Any) -> "_FakeQuery":
        q = _FakeQuery(self._rows)
        q._filters = list(self._filters)
        q._exclude = self._exclude + list(kwargs.items())
        return q

    def order_by(self, *_args: Any) -> "_FakeQuery":
        return self

    def _match(self, row: Any) -> bool:
        for key, expected in self._filters:
            if key.endswith("__isnull"):
                field = key[: -len("__isnull")]
                val = getattr(row, field, None)
                is_null = val is None
                if expected is True and not is_null:
                    return False
                if expected is False and is_null:
                    return False
                continue
            actual = getattr(row, key, None)
            if actual != expected:
                return False
        for key, expected in self._exclude:
            if getattr(row, key, None) == expected:
                return False
        return True

    def _filtered(self) -> List[Any]:
        return [r for r in self._rows if self._match(r)]

    async def first(self) -> Any:
        items = self._filtered()
        return items[0] if items else None

    async def all(self) -> List[Any]:
        return self._filtered()

    async def count(self) -> int:
        return len(self._filtered())

    async def update(self, **kwargs: Any) -> int:
        items = self._filtered()
        for row in items:
            for k, v in kwargs.items():
                setattr(row, k, v)
        return len(items)


class SopPaperControlHarness:
    """内存态 SOP / 修订 / 受控份，驱动文控服务 E2E。"""

    def __init__(self, sop: SimpleNamespace):
        self.sop = sop
        self.revisions: List[SimpleNamespace] = []
        self.copies: List[SimpleNamespace] = []
        self._copy_id = 0
        self._rev_id = 0

    def _sop_query(self) -> _FakeQuery:
        rows = [self.sop] if self.sop.deleted_at is None else []
        return _FakeQuery(rows)

    def _revision_query(self) -> _FakeQuery:
        return _FakeQuery(self.revisions)

    def _copy_query(self) -> _FakeQuery:
        return _FakeQuery(self.copies)

    async def _create_revision(self, **kwargs: Any) -> SimpleNamespace:
        self._rev_id += 1
        row = SimpleNamespace(id=self._rev_id, deleted_at=None, obsolete_at=None, **kwargs)
        row.save = AsyncMock()
        self.revisions.append(row)
        return row

    async def _create_copy(self, **kwargs: Any) -> SimpleNamespace:
        self._copy_id += 1
        row = SimpleNamespace(id=self._copy_id, deleted_at=None, **kwargs)
        row.save = AsyncMock()
        self.copies.append(row)
        return row

    def patches(self):
        harness = self

        async def fake_get_sop(tenant_id: int, sop_uuid: str):
            if tenant_id != harness.sop.tenant_id or sop_uuid != harness.sop.uuid:
                from infra.exceptions.exceptions import NotFoundError

                raise NotFoundError(f"SOP {sop_uuid} 不存在")
            return harness.sop

        async def fake_enrich(sop: SimpleNamespace) -> SOPResponse:
            data = SOPResponse.model_validate(sop).model_dump()
            issued = sum(1 for c in harness.copies if c.status == "issued")
            pending = sum(1 for c in harness.copies if c.status == "pending_retrieve")
            data["issued_copy_count"] = issued
            data["pending_retrieve_copy_count"] = pending
            return SOPResponse.model_validate(data)

        return [
            patch(
                "apps.master_data.services.sop_control_service.apply_update_audit",
                new=lambda *_a, **_k: None,
            ),
            patch(
                "apps.master_data.services.sop_control_service.enrich_sop_response",
                new=AsyncMock(side_effect=fake_enrich),
            ),
            patch(
                "apps.master_data.services.sop_control_service._get_sop",
                new=AsyncMock(side_effect=fake_get_sop),
            ),
            patch(
                "apps.master_data.services.sop_control_service.SOP.filter",
                side_effect=lambda **kw: harness._sop_query().filter(**kw),
            ),
            patch(
                "apps.master_data.services.sop_control_service.SopRevision.filter",
                side_effect=lambda **kw: harness._revision_query().filter(**kw),
            ),
            patch(
                "apps.master_data.services.sop_control_service.SopRevision.create",
                new=AsyncMock(side_effect=harness._create_revision),
            ),
            patch(
                "apps.master_data.services.sop_control_service.SopControlledCopy.filter",
                side_effect=lambda **kw: harness._copy_query().filter(**kw),
            ),
            patch(
                "apps.master_data.services.sop_control_service.SopControlledCopy.create",
                new=AsyncMock(side_effect=harness._create_copy),
            ),
        ]


async def _paper_sop_control_lifecycle_e2e() -> None:
    """纸质 SOP：提交审核→发布→发放→升版再发布→待回收→回收；打印水印。"""
    user = _make_user()
    sop = _make_paper_sop()
    harness = SopPaperControlHarness(sop)
    ctx = harness.patches()

    for p in ctx:
        p.start()
    try:
        # 1) 缺扫描件不得提交
        sop_bad = _make_paper_sop(attachments=None)
        with pytest.raises(ValidationError, match="受控扫描件"):
            _validate_carrier_content(sop_bad)

        # 2) 提交 → 审核 → 发布生效
        submitted = await SopControlService.submit(1, sop.uuid, current_user=user)
        assert submitted.control_status == "in_review"

        approved = await SopControlService.approve(1, sop.uuid, current_user=user)
        assert approved.approved_by_name == "文控员"

        published = await SopControlService.publish(1, sop.uuid, current_user=user)
        assert published.control_status == "effective"
        assert published.current_revision == "1.0"
        assert len(harness.revisions) == 1
        assert harness.revisions[0].carrier == "paper"
        assert harness.revisions[0].storage_location == "3号线边柜 A-2"

        # 3) 发放受控份
        dispatched = await SopControlService.dispatch_copy(
            1,
            sop.uuid,
            SopControlledCopyDispatchRequest(
                location_type="workshop",
                location_note="装配车间公告栏",
            ),
            current_user=user,
        )
        assert dispatched.copy_no == "C-001"
        assert dispatched.status == "issued"
        assert dispatched.revision == "1.0"

        # 4) 打印水印
        uncontrolled = await SopControlService.get_print_data(1, sop.uuid, controlled=False)
        assert uncontrolled.watermark == "非受控副本 不得现场使用"
        controlled = await SopControlService.get_print_data(
            1, sop.uuid, controlled=True, copy_id=dispatched.id
        )
        assert "受控副本 C-001" in controlled.watermark
        assert "1.0" in controlled.watermark

        # 5) 升版 → 再发布；旧受控份应变待回收
        revised = await SopControlService.revise(
            1,
            sop.uuid,
            SopReviseRequest(change_reason="换版扫描件"),
            current_user=user,
        )
        assert revised.control_status == "draft"
        assert revised.current_revision == "1.1"

        await SopControlService.submit(1, sop.uuid, current_user=user)
        await SopControlService.approve(1, sop.uuid, current_user=user)
        await SopControlService.publish(1, sop.uuid, current_user=user)

        assert harness.copies[0].status == "pending_retrieve"
        assert sop.control_status == "effective"
        assert sop.current_revision == "1.1"
        assert len(harness.revisions) == 2

        # 6) 回收旧份
        recalled = await SopControlService.recall_copy(
            1,
            sop.uuid,
            SopControlledCopyRecallRequest(copy_id=dispatched.id),
            current_user=user,
        )
        assert recalled.status == "retrieved"
        assert recalled.retrieved_by_name == "文控员"
    finally:
        for p in reversed(ctx):
            p.stop()


def test_paper_sop_control_lifecycle_e2e():
    asyncio.run(_paper_sop_control_lifecycle_e2e())


async def _get_sop_for_material_only_effective() -> None:
    """工位/报工匹配：仅 control_status=effective 的 SOP 可命中。"""
    effective = SimpleNamespace(
        id=1,
        uuid="sop-eff",
        tenant_id=1,
        code="SOP-EFF",
        name="生效SOP",
        version="1.0",
        control_status="effective",
        is_active=True,
        operation_id=10,
        material_uuids=["mat-001"],
        material_group_uuids=None,
        bom_load_mode="by_material",
        carrier="electronic",
        deleted_at=None,
        created_at=_utc_now(),
        updated_at=_utc_now(),
    )
    filter_kwargs: List[Dict[str, Any]] = []

    def sop_filter_side_effect(**kwargs: Any) -> MagicMock:
        filter_kwargs.append(kwargs)
        q = MagicMock()
        q.filter.return_value = q
        q.order_by.return_value = q
        q.prefetch_related.return_value = q
        q.first = AsyncMock(return_value=effective if kwargs.get("control_status") == "effective" else None)
        return q

    material_q = MagicMock()
    material_q.first = AsyncMock(return_value=None)

    with patch(
        "apps.master_data.services.process_service.SOP.filter",
        side_effect=sop_filter_side_effect,
    ), patch(
        "apps.master_data.services.process_service.Material.filter",
        return_value=material_q,
    ):
        matched = await ProcessService.get_sop_for_material(1, "mat-001", operation_uuid=None)

    assert matched is not None
    assert matched.uuid == "sop-eff"
    assert any(k.get("control_status") == "effective" for k in filter_kwargs)

    filter_kwargs.clear()

    def empty_sop_filter(**kwargs: Any) -> MagicMock:
        filter_kwargs.append(kwargs)
        q = MagicMock()
        q.filter.return_value = q
        q.order_by.return_value = q
        q.prefetch_related.return_value = q
        q.first = AsyncMock(return_value=None)
        return q

    with patch(
        "apps.master_data.services.process_service.SOP.filter",
        side_effect=empty_sop_filter,
    ), patch(
        "apps.master_data.services.process_service.Material.filter",
        return_value=material_q,
    ):
        none = await ProcessService.get_sop_for_material(1, "mat-001")

    assert none is None
    assert filter_kwargs
    assert all(k.get("control_status") == "effective" for k in filter_kwargs)


def test_get_sop_for_material_only_effective():
    asyncio.run(_get_sop_for_material_only_effective())


class _StationAckQuery:
    """工位 SOP 确认记录最小 QuerySet 桩。"""

    def __init__(self, rows: List[SimpleNamespace]):
        self._rows = list(rows)
        self._filters: List[tuple[str, Any]] = []

    def filter(self, **kwargs: Any) -> "_StationAckQuery":
        q = _StationAckQuery(self._rows)
        q._filters = self._filters + list(kwargs.items())
        return q

    def order_by(self, *_args: Any) -> "_StationAckQuery":
        return self

    def _match(self, row: SimpleNamespace) -> bool:
        for key, expected in self._filters:
            if key.endswith("__isnull"):
                field = key[: -len("__isnull")]
                val = getattr(row, field, None)
                is_null = val is None
                if expected is True and not is_null:
                    return False
                if expected is False and is_null:
                    return False
                continue
            if getattr(row, key, None) != expected:
                return False
        return True

    async def first(self) -> Any:
        items = [r for r in self._rows if self._match(r)]
        if not items:
            return None
        return max(items, key=lambda r: getattr(r, "acknowledged_at", _utc_now()))


async def _station_sop_ack_binds_revision() -> None:
    """工位确认须绑定现行修订号，换版后同一工单须重新确认。"""
    from apps.kuaizhizao.services.station_service import StationService

    sop_row = SimpleNamespace(
        uuid="sop-paper-001",
        tenant_id=1,
        current_revision="1.1",
        version="1.1",
        deleted_at=None,
    )
    stored: List[SimpleNamespace] = []

    async def fake_get_or_none(**kwargs):
        q = _StationAckQuery(stored)
        return await q.filter(**kwargs).first()

    async def fake_create(**kwargs):
        row = SimpleNamespace(**kwargs)
        stored.append(row)
        return row

    def fake_filter(**kwargs):
        return _StationAckQuery(stored).filter(**kwargs)

    service = StationService()
    with patch(
        "apps.master_data.models.process.SOP.filter",
        return_value=MagicMock(
            first=AsyncMock(return_value=sop_row),
        ),
    ), patch(
        "apps.kuaizhizao.models.station_sop_acknowledgment.StationSopAcknowledgment.get_or_none",
        new=AsyncMock(side_effect=fake_get_or_none),
    ), patch(
        "apps.kuaizhizao.models.station_sop_acknowledgment.StationSopAcknowledgment.create",
        new=AsyncMock(side_effect=fake_create),
    ), patch(
        "apps.kuaizhizao.models.station_sop_acknowledgment.StationSopAcknowledgment.filter",
        side_effect=fake_filter,
    ):
        from apps.kuaizhizao.schemas.station import StationSopAckCreate

        ack_v1 = await service.acknowledge_sop(
            tenant_id=1,
            data=StationSopAckCreate(
                sop_uuid="sop-paper-001",
                work_order_id=100,
                operation_id=20,
                worker_id=5,
                worker_name="操作工甲",
            ),
            user_id=5,
            user_name="操作工甲",
        )
        assert ack_v1.sop_revision == "1.1"

        check = await service.check_sop_acknowledged(
            tenant_id=1,
            work_order_id=100,
            operation_id=20,
            sop_uuid="sop-paper-001",
            worker_id=5,
            sop_revision="1.1",
        )
        assert check["acknowledged"] is True

        check_old = await service.check_sop_acknowledged(
            tenant_id=1,
            work_order_id=100,
            operation_id=20,
            sop_uuid="sop-paper-001",
            worker_id=5,
            sop_revision="1.0",
        )
        assert check_old["acknowledged"] is False


def test_station_sop_ack_binds_revision():
    asyncio.run(_station_sop_ack_binds_revision())


def test_next_revision_increments_minor():
    assert _next_revision("1.0") == "1.1"
    assert _next_revision("A1") == "A2"
