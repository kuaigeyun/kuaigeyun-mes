"""打印 HTML→PDF：体积上限与子进程隔离。"""

from __future__ import annotations

import subprocess
from unittest.mock import MagicMock, patch

import pytest

from apps.kuaizhizao.services.html_to_pdf_engine import (
    inject_base_href_for_playwright,
    parse_css_page_size,
)
from apps.kuaizhizao.services.print_service import (
    _MAX_PRINT_HTML_BYTES,
    _MAX_PRINT_INLINE_IMAGES,
    _inline_local_file_images_in_html,
    _run_html_to_pdf_subprocess,
)
from infra.exceptions.exceptions import BusinessLogicError, ValidationError


def test_inject_base_href_into_head():
    html = "<html><head></head><body>x</body></html>"
    out = inject_base_href_for_playwright(html, "http://localhost:8200")
    assert '<base href="http://localhost:8200/"' in out


def test_parse_css_page_size_a4():
    html = "@page { size: A4 portrait; }"
    assert parse_css_page_size(html) == ("210.0mm", "297.0mm")


def test_html_over_size_limit_raises():
    huge = "x" * (_MAX_PRINT_HTML_BYTES + 1)
    with pytest.raises(ValidationError, match="打印内容过大"):
        _run_html_to_pdf_subprocess(huge)


def test_print_subprocess_nonzero_raises():
    html = "<html><body>ok</body></html>"
    fake = MagicMock()
    fake.returncode = 1
    fake.stderr = b"chromium crashed"
    fake.stdout = b""
    with patch("apps.kuaizhizao.services.print_service.subprocess.run", return_value=fake):
        with pytest.raises(BusinessLogicError, match="打印 PDF 失败"):
            _run_html_to_pdf_subprocess(html)


def test_print_subprocess_timeout_raises():
    html = "<html><body>ok</body></html>"
    with patch(
        "apps.kuaizhizao.services.print_service.subprocess.run",
        side_effect=subprocess.TimeoutExpired(cmd="x", timeout=1),
    ):
        with pytest.raises(BusinessLogicError, match="打印 PDF 超时"):
            _run_html_to_pdf_subprocess(html)


@pytest.mark.asyncio
async def test_inline_too_many_images_raises():
    tags = []
    for i in range(_MAX_PRINT_INLINE_IMAGES + 1):
        uid = f"{i:032x}"
        tags.append(f'<img src="/api/v1/core/files/{uid}/download">')
    html = "<html><body>" + "".join(tags) + "</body></html>"
    with pytest.raises(ValidationError, match="打印图片超过"):
        await _inline_local_file_images_in_html(1, html)
