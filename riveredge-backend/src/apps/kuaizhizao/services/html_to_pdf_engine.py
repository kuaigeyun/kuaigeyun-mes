"""HTML → PDF：仅在本模块的子进程里启动 Chromium。

API worker 通过 `python -m apps.kuaizhizao.services.html_to_pdf_engine` 调用，
Chromium / Playwright driver 崩溃或超内存时只杀死子进程，不带走 API。
"""

from __future__ import annotations

import asyncio
import os
import platform
import re
import sys
from pathlib import Path
from typing import Optional, Tuple

from loguru import logger

_CSS_PAGE_SIZE_RE = re.compile(
    r"@page\s*\{[^}]*?\bsize\s*:\s*"
    r"(?P<w>\d+(?:\.\d+)?(?:mm|cm|in|px))"
    r"\s+"
    r"(?P<h>\d+(?:\.\d+)?(?:mm|cm|in|px))"
    r"(?:\s+(?:portrait|landscape))?\s*;",
    re.IGNORECASE | re.DOTALL,
)

_CSS_PAGE_NAMED_SIZE_RE = re.compile(
    r"@page\s*\{[^}]*?\bsize\s*:\s*"
    r"(?P<name>A3|A4|A5|Letter|Legal)"
    r"(?:\s+(?P<orient>portrait|landscape))?\s*;",
    re.IGNORECASE | re.DOTALL,
)

_NAMED_PAPER_SIZE_MM: dict[str, tuple[float, float]] = {
    "A3": (297.0, 420.0),
    "A4": (210.0, 297.0),
    "A5": (148.0, 210.0),
    "Letter": (215.9, 279.4),
    "Legal": (215.9, 355.6),
}


def inject_base_href_for_playwright(html_string: str, base_url: str) -> str:
    if not base_url:
        return html_string
    base = base_url.rstrip("/") + "/"
    if re.search(r"<base\b", html_string, flags=re.IGNORECASE):
        return html_string
    if re.search(r"<head[^>]*>", html_string, flags=re.IGNORECASE):
        return re.sub(
            r"(<head[^>]*>)",
            lambda m: m.group(1) + f'<base href="{base}"/>',
            html_string,
            count=1,
            flags=re.IGNORECASE,
        )
    if re.search(r"<html[^>]*>", html_string, flags=re.IGNORECASE):
        return re.sub(
            r"(<html[^>]*>)",
            lambda m: m.group(1) + f'<head><base href="{base}"/></head>',
            html_string,
            count=1,
            flags=re.IGNORECASE,
        )
    return f'<!DOCTYPE html><html><head><base href="{base}"/></head><body>{html_string}</body></html>'


def parse_css_page_size(html_string: str) -> Optional[Tuple[str, str]]:
    if not html_string:
        return None
    m = _CSS_PAGE_SIZE_RE.search(html_string)
    if m:
        return m.group("w"), m.group("h")
    named = _CSS_PAGE_NAMED_SIZE_RE.search(html_string)
    if not named:
        return None
    name = named.group("name").upper()
    dims = _NAMED_PAPER_SIZE_MM.get(name)
    if not dims:
        return None
    w_mm, h_mm = dims
    orient = (named.group("orient") or "portrait").strip().lower()
    if orient == "landscape":
        w_mm, h_mm = h_mm, w_mm
    return f"{w_mm}mm", f"{h_mm}mm"


def _playwright_chromium_missing_hint(executable_path: str | None) -> str:
    browsers_path = os.environ.get("PLAYWRIGHT_BROWSERS_PATH") or "(未设置，默认 ~/.cache/ms-playwright)"
    return (
        f"未找到 Playwright Chromium（期望: {executable_path!r}）。"
        f"PLAYWRIGHT_BROWSERS_PATH={browsers_path}。"
        "请在后端目录执行：uv run --extra pdf python -m playwright install chromium；"
        "Linux 若仍启动失败再执行：uv run --extra pdf python -m playwright install-deps chromium。"
        "并确认 deploy.env 未关闭 PLAYWRIGHT_POSTINSTALL_ENABLE，且 API 进程带有同一 PLAYWRIGHT_BROWSERS_PATH。"
    )


async def html_to_pdf_bytes_playwright_async(html_string: str) -> bytes:
    try:
        from playwright.async_api import async_playwright
    except Exception as e:
        raise RuntimeError(
            "Playwright 不可用，请先安装依赖：uv sync --extra pdf "
            "并执行：uv run --extra pdf python -m playwright install chromium。"
        ) from e

    launch_args: list[str] = []
    if platform.system() == "Linux":
        launch_args.extend(["--no-sandbox", "--disable-dev-shm-usage"])

    from infra.config.infra_config import infra_settings as settings

    base_url = settings.BASE_URL
    if not base_url:
        host = "localhost" if settings.HOST == "0.0.0.0" else settings.HOST
        base_url = f"http://{host}:{settings.PORT}"
    html_for_playwright = inject_base_href_for_playwright(html_string, base_url)
    page_size = parse_css_page_size(html_for_playwright)

    async with async_playwright() as p:
        exe = p.chromium.executable_path
        if not exe or not os.path.isfile(exe):
            raise RuntimeError(_playwright_chromium_missing_hint(exe))
        try:
            browser = await p.chromium.launch(headless=True, args=launch_args)
        except Exception as e:
            msg = str(e)
            if "Executable doesn't exist" in msg or "executable doesn't exist" in msg.lower():
                raise RuntimeError(_playwright_chromium_missing_hint(exe)) from e
            raise RuntimeError(
                f"启动 Chromium 失败: {msg}。"
                "常见原因：PLAYWRIGHT_BROWSERS_PATH 与安装目录不一致、缺系统库（install-deps）、"
                "或低配模式关闭了 PLAYWRIGHT_POSTINSTALL_ENABLE。"
            ) from e
        try:
            page = await browser.new_page()
            if os.environ.get("RIVEREDGE_PRINT_DEBUG", "").strip().lower() in ("1", "true", "yes"):
                debug_path = os.path.join(os.getcwd(), "debug_last_print.html")
                with open(debug_path, "w", encoding="utf-8") as f:
                    f.write(html_for_playwright)
                logger.info("DEBUG: Final HTML captured to {}", debug_path)

            await page.set_content(html_for_playwright, wait_until="networkidle")
            await page.emulate_media(media="print")
            await page.evaluate(
                "() => (document.fonts && document.fonts.ready) ? document.fonts.ready : null"
            )

            pdf_kwargs: dict = {
                "print_background": True,
                "prefer_css_page_size": True,
                "display_header_footer": False,
                "margin": {"top": "0", "right": "0", "bottom": "0", "left": "0"},
            }
            if page_size:
                pdf_kwargs["width"] = page_size[0]
                pdf_kwargs["height"] = page_size[1]
                logger.info("PDF 按模板尺寸导出: {} x {}", page_size[0], page_size[1])
            else:
                logger.warning("未解析到 @page size，PDF 将依赖 Chromium 默认纸张")

            return await page.pdf(**pdf_kwargs)
        finally:
            await browser.close()


def run_playwright_with_dedicated_loop(html_string: str) -> bytes:
    if platform.system() == "Windows":
        loop = asyncio.ProactorEventLoop()
    else:
        loop = asyncio.new_event_loop()
    try:
        asyncio.set_event_loop(loop)
        return loop.run_until_complete(html_to_pdf_bytes_playwright_async(html_string))
    finally:
        loop.run_until_complete(loop.shutdown_asyncgens())
        asyncio.set_event_loop(None)
        loop.close()


def _cli(argv: list[str]) -> int:
    if len(argv) != 3:
        print("usage: html_to_pdf_engine <in.html> <out.pdf>", file=sys.stderr)
        return 2
    html_path = Path(argv[1])
    pdf_path = Path(argv[2])
    html = html_path.read_text(encoding="utf-8")
    pdf_path.write_bytes(run_playwright_with_dedicated_loop(html))
    return 0


if __name__ == "__main__":
    raise SystemExit(_cli(sys.argv))
