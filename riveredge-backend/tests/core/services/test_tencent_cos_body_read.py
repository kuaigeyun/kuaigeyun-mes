"""COS 对象 Body 必须整段读完，禁止 StreamBody.read() 默认 1KB。"""

import pytest

from core.services.file.storage.tencent_cos import _read_cos_object_body
from infra.exceptions.exceptions import ValidationError


class _FakeStreamBody:
    def __init__(self, data: bytes):
        self._data = data

    def read(self, chunk_size=1024, auto_decompress=False):
        return self._data[:chunk_size]

    def get_stream(self, chunk_size=1024):
        data = self._data
        for i in range(0, len(data), chunk_size):
            yield data[i : i + chunk_size]

    def __len__(self):
        return len(self._data)


def test_read_cos_body_returns_full_object_not_first_chunk():
    payload = b"ISO-10303-21;" + (b"X" * 5000)
    body = _FakeStreamBody(payload)
    assert len(body.read()) == 1024
    assert _read_cos_object_body(body) == payload


def test_read_cos_body_rejects_incomplete_stream():
    class ShortBody(_FakeStreamBody):
        def get_stream(self, chunk_size=1024):
            yield self._data[:100]

        def __len__(self):
            return 5000

    with pytest.raises(ValidationError, match="下载不完整"):
        _read_cos_object_body(ShortBody(b"Y" * 5000))
