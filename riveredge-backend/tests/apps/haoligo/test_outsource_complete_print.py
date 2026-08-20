"""外协维保完修单打印变量组装。"""

from datetime import datetime, timezone
from types import SimpleNamespace

import pytest

from apps.haoligo.services.print_service import (
    HaoligoDocumentPrintService,
    _fmt_dt,
    _line_get,
)


def test_fmt_dt_none():
    assert _fmt_dt(None) == "—"


def test_fmt_dt_aware_utc_uses_site_clock():
    dt = datetime(2026, 8, 20, 4, 0, tzinfo=timezone.utc)
    text = _fmt_dt(dt)
    assert text != "—"
    assert "2026-08-20" in text or "2026-08-19" in text


def test_line_get_dict_and_namespace():
    assert _line_get({"mold_code": "M1"}, "mold_code") == "M1"
    assert _line_get(SimpleNamespace(mold_code="M2"), "mold_code") == "M2"


@pytest.mark.asyncio
async def test_mold_sheet_print_payload_aliases_items_and_cost_total(monkeypatch):
    async def _company(_tenant_id: int) -> str:
        return "测试公司"

    monkeypatch.setattr(
        "apps.haoligo.services.print_service._tenant_display_name",
        _company,
    )
    svc = HaoligoDocumentPrintService()
    out = SimpleNamespace(
        id=420,
        sheet_no="WX-001",
        service_type="维修",
        source_order_no="OS-100",
        applicant_name="张三",
        department_name="模具课",
        clear_total_production=False,
        outsourced_unit_name="外协厂A",
        sheet_status="已通过",
        created_at=datetime(2026, 8, 20, 4, 0, tzinfo=timezone.utc),
        line_items=[
            SimpleNamespace(
                mold_code="MD-01",
                mold_name="壳体模",
                repair_reason="磨损",
                repair_content="更换镶件",
                repair_result="合格",
                repair_cost="120.50",
                upkeep_record_lines=[],
                clear_total_production=False,
                attachment_file_uuids=["aaaaaaaa-aaaa-4aaa-8aaa-aaaaaaaaaaaa"],
                source_attachment_file_uuids=[],
            )
        ],
        source_header_attachment_file_uuids=[],
        header_attachment_file_uuids=[],
    )
    payload = await svc._mold_sheet_print_payload(
        1,
        out,
        document_type="mold_outsource_maintenance_complete",
        print_user="李四",
        is_outsource=True,
    )
    assert payload["report_title"] == "模具外协维修完成报告"
    assert payload["items"] is payload["line_items"]
    assert payload["line_items"][0]["mold_code"] == "MD-01"
    assert payload["repair_cost_total"] == "120.5"
    assert payload["line_items"][0]["after_photos"]
    assert payload["is_outsource"] is True
    assert payload["print_user"] == "李四"
