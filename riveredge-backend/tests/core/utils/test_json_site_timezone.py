"""SiteTimezoneJSONResponse：消化 jsonable_encoder 泄漏的 UTC ISO。"""

from datetime import datetime, timezone

from fastapi import FastAPI
from fastapi.encoders import jsonable_encoder
from fastapi.testclient import TestClient

from core.utils.json_site_timezone import SiteTimezoneJSONResponse, convert_datetimes_for_api
from core.schemas.base import BaseSchema
from typing import Optional


def test_convert_aware_datetime_to_site_wall():
    dt = datetime(2026, 8, 14, 2, 47, 0, tzinfo=timezone.utc)
    assert convert_datetimes_for_api(dt) == "2026-08-14 10:47:00"


def test_convert_leaked_iso_z_string():
    assert (
        convert_datetimes_for_api("2026-08-14T02:47:00+00:00") == "2026-08-14 10:47:00"
    )
    assert convert_datetimes_for_api("2026-08-14T02:47:00Z") == "2026-08-14 10:47:00"


def test_convert_leaked_naive_t_iso_as_utc():
    # jsonable_encoder(naive UTC) → 无偏移；按存储契约视为 UTC
    assert convert_datetimes_for_api("2026-08-14T02:47:00") == "2026-08-14 10:47:00"


def test_convert_keeps_existing_site_wall():
    assert convert_datetimes_for_api("2026-08-14 10:47:00") == "2026-08-14 10:47:00"


def test_jsonable_encoder_raw_dict_then_site_response():
    """复现工单等接口：裸 dict 先被 jsonable_encoder，再进 response_class。"""
    payload = {
        "actual_start_date": datetime(2026, 8, 14, 2, 47, 0, tzinfo=timezone.utc)
    }
    encoded = jsonable_encoder(payload)
    assert "+00:00" in encoded["actual_start_date"] or encoded["actual_start_date"].endswith("Z")
    fixed = convert_datetimes_for_api(encoded)
    assert fixed["actual_start_date"] == "2026-08-14 10:47:00"


class _Op(BaseSchema):
    actual_start_date: Optional[datetime] = None


def test_fastapi_raw_dict_route_returns_site_wall():
    app = FastAPI(default_response_class=SiteTimezoneJSONResponse)

    @app.get("/raw")
    def raw():
        return [
            {
                "actual_start_date": datetime(
                    2026, 8, 14, 2, 47, 0, tzinfo=timezone.utc
                )
            }
        ]

    @app.get("/schema")
    def schema():
        return [
            _Op(
                actual_start_date=datetime(
                    2026, 8, 14, 2, 47, 0, tzinfo=timezone.utc
                )
            )
        ]

    client = TestClient(app)
    assert client.get("/raw").json()[0]["actual_start_date"] == "2026-08-14 10:47:00"
    assert client.get("/schema").json()[0]["actual_start_date"] == "2026-08-14 10:47:00"
