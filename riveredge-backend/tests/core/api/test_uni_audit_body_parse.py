"""uni-audit POST Body：扁平 instance_data_patch 不得被双 Body 参数吞掉。"""

from typing import Optional

from fastapi import Body, FastAPI
from fastapi.testclient import TestClient


def _mount_like_production(app: FastAPI):
    """与 uni_audit.execute_audit_action 相同的 Body 声明（单 dict）。"""

    @app.post("/uni-audit/{entity_type}/{entity_id}/{action}")
    async def execute_audit_action(
        entity_type: str,
        entity_id: int,
        action: str,
        body: Optional[dict] = Body(default=None),
    ):
        payload = dict(body or {})
        reason = payload.pop("reason", None) or payload.pop("comment", None)
        return {
            "entity_type": entity_type,
            "entity_id": entity_id,
            "action": action,
            "payload": payload,
            "reason": reason,
        }


def test_flat_instance_data_patch_is_preserved():
    app = FastAPI()
    _mount_like_production(app)
    client = TestClient(app)
    r = client.post(
        "/uni-audit/purchase_request/1/approve",
        json={"instance_data_patch": {"__branch_true_cond": True}},
    )
    assert r.status_code == 200
    data = r.json()
    assert data["payload"]["instance_data_patch"]["__branch_true_cond"] is True
    assert data["reason"] is None


def test_reason_inside_same_body_still_works():
    app = FastAPI()
    _mount_like_production(app)
    client = TestClient(app)
    r = client.post(
        "/uni-audit/purchase_request/1/reject",
        json={"reason": "不符", "instance_data_patch": {"x": False}},
    )
    assert r.status_code == 200
    data = r.json()
    assert data["reason"] == "不符"
    assert data["payload"] == {"instance_data_patch": {"x": False}}
