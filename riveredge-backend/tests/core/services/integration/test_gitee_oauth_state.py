import time

import pytest
from fastapi import HTTPException

from core.services.integration.gitee_oauth_service import (
    decode_gitee_oauth_state,
    encode_gitee_oauth_state,
)


def test_gitee_oauth_state_is_signed_and_round_trips():
    state = encode_gitee_oauth_state(
        tenant_id=7,
        redirect_uri="https://example.test/oauth",
        redirect="/dashboard",
    )

    decoded = decode_gitee_oauth_state(state)

    assert decoded["tenant_id"] == 7
    assert decoded["redirect_uri"] == "https://example.test/oauth"
    assert decoded["redirect"] == "/dashboard"


def test_gitee_oauth_state_rejects_tampering():
    state = encode_gitee_oauth_state(
        tenant_id=7,
        redirect_uri="https://example.test/oauth",
    )
    body, signature = state.rsplit(".", 1)
    tampered = f"{body[:-1]}A.{signature}"

    with pytest.raises(HTTPException):
        decode_gitee_oauth_state(tampered)


def test_gitee_oauth_state_rejects_expired(monkeypatch):
    now = int(time.time())
    monkeypatch.setattr(time, "time", lambda: now - 601)
    state = encode_gitee_oauth_state(
        tenant_id=7,
        redirect_uri="https://example.test/oauth",
    )
    monkeypatch.setattr(time, "time", lambda: now)

    with pytest.raises(HTTPException):
        decode_gitee_oauth_state(state)
