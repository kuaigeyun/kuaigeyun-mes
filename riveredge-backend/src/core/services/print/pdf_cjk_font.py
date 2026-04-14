"""
为 ReportLab / xhtml2pdf 提供中文显示能力，避免 PDF 中文字变为方块。

xhtml2pdf 只认其上下文里的字体映射：内置 **CID 字体 STSong-Light**
（reportlab + xhtml2pdf.util.set_asian_fonts）可稳定渲染简体中文。
仅 pdfmetrics.registerFont(TTFont(...)) 而不走 CID/ @font-face 映射时，段落仍可能回退到 Helvetica 导致方块。

优先：STSong-Light → 环境变量/系统 TTF 回退（RiverEdgeCJK）。
"""

from __future__ import annotations

import os
import platform
from pathlib import Path
from typing import List, Optional, Tuple

from loguru import logger

# ReportLab 内置简中 CID 名（与 xhtml2pdf asianFontList 一致）
_CID_SIMPLIFIED = "STSong-Light"
_TTF_FONT_NAME = "RiverEdgeCJK"
_registered_name: Optional[str] = None


def _ttf_candidates() -> List[Tuple[str, int]]:
    """返回 (路径, ttc_subfont_index)；.ttf 时 index 忽略。"""
    out: List[Tuple[str, int]] = []
    env = os.environ.get("RIVEREDGE_PDF_CJK_FONT", "").strip()
    if env and Path(env).is_file():
        out.append((env, 0))

    sys_name = platform.system()
    if sys_name == "Windows":
        windir = os.environ.get("WINDIR", r"C:\Windows")
        base = Path(windir) / "Fonts"
        for fname in (
            "msyh.ttc",
            "msyhbd.ttc",
            "msyhl.ttc",
            "simsun.ttc",
            "simfang.ttf",
            "msyh.ttf",
        ):
            p = base / fname
            if p.is_file():
                out.append((str(p), 0))
    else:
        for path, idx in (
            ("/usr/share/fonts/opentype/noto/NotoSansCJK-Regular.ttc", 0),
            ("/usr/share/fonts/truetype/noto/NotoSansCJK-Regular.ttc", 0),
            ("/usr/share/fonts/truetype/noto-cjk/NotoSansCJK-Regular.ttc", 0),
            ("/usr/share/fonts/truetype/wqy/wqy-zenhei.ttc", 0),
            ("/usr/share/fonts/truetype/wqy/wqy-microhei.ttc", 0),
        ):
            if Path(path).is_file():
                out.append((path, idx))
    return out


def ensure_reportlab_cjk_font() -> str:
    """
    注册中文字体（进程内一次），返回 CSS/font-family 应使用的名称。

    Raises:
        RuntimeError: 全部失败时
    """
    global _registered_name
    if _registered_name:
        return _registered_name

    # 1) xhtml2pdf 与 ReportLab 对简中最稳的路径：CID 字体
    try:
        from xhtml2pdf.util import set_asian_fonts

        set_asian_fonts(_CID_SIMPLIFIED)
        _registered_name = _CID_SIMPLIFIED
        logger.info("PDF 中文字体已注册（CID）: {}", _CID_SIMPLIFIED)
        return _CID_SIMPLIFIED
    except Exception as e:
        logger.warning("注册 CID 字体 {} 失败，尝试 TTF：{}", _CID_SIMPLIFIED, e)

    # 2) 回退：系统/环境 TTF，供 ReportLab 嵌入
    from reportlab.pdfbase import pdfmetrics
    from reportlab.pdfbase.ttfonts import TTFont

    for path, sub_idx in _ttf_candidates():
        try:
            lower = path.lower()
            if lower.endswith(".ttc"):
                pdfmetrics.registerFont(TTFont(_TTF_FONT_NAME, path, subfontIndex=sub_idx))
            else:
                pdfmetrics.registerFont(TTFont(_TTF_FONT_NAME, path))
            _registered_name = _TTF_FONT_NAME
            logger.info("PDF 中文字体已注册（TTF）: {} -> {}", _TTF_FONT_NAME, path)
            return _TTF_FONT_NAME
        except Exception as ex:
            logger.warning("注册 PDF TTF 失败，尝试下一候选: {} — {}", path, ex)

    raise RuntimeError(
        "未找到可用的中文字体。请确认 ReportLab 可用 STSong-Light，"
        "或设置 RIVEREDGE_PDF_CJK_FONT 指向 .ttf/.ttc。"
    )


def inject_cjk_font_css(html: str, font_family: Optional[str] = None) -> str:
    """在 <head> 内注入样式，强制正文使用已注册的中文字体。"""
    name = font_family or ensure_reportlab_cjk_font()
    # STSong-Light 为简体 CID；TTF 回退用 RiverEdgeCJK
    css = f"""<style type="text/css">
@page {{ margin: 12pt; }}
html, body, table, th, td, tr, div, p, span, h1, h2, h3, h4, li, pre {{
  font-family: "{name}", "STSong-Light", SimSun, serif !important;
}}
</style>"""
    import re

    if re.search(r"<head[^>]*>", html, flags=re.IGNORECASE):

        def _after_head(m) -> str:
            return m.group(1) + css

        return re.sub(r"(<head[^>]*>)", _after_head, html, count=1, flags=re.IGNORECASE)
    if re.search(r"<html[^>]*>", html, flags=re.IGNORECASE):

        def _after_html(m) -> str:
            return m.group(1) + '<head><meta charset="UTF-8"/>' + css + "</head>"

        return re.sub(r"(<html[^>]*>)", _after_html, html, count=1, flags=re.IGNORECASE)
    return f'<!DOCTYPE html><html><head><meta charset="UTF-8"/>{css}</head><body>{html}</body></html>'
