"""把明文词表打成 lexicon.pack。明文仅作本地输入，不要提交。"""

from __future__ import annotations

import sys
import urllib.request
from pathlib import Path

ROOT = Path(__file__).resolve().parents[1]
SRC = ROOT / "src"
if str(SRC) not in sys.path:
    sys.path.insert(0, str(SRC))

from core.services.content.lexicon_pack import (  # noqa: E402
    PACK_FILENAME,
    load_pack,
    read_source_lines,
    write_pack,
)

_LEXICON_DIR = SRC / "core" / "data" / "sensitive_words"
_SOURCE_FILES = ("insult.txt", "porn.txt", "porn_types.txt", "extra.txt")

_DOWNLOADS: dict[str, str] = {
    "insult.txt": "https://raw.githubusercontent.com/pokemonchw/Dirty/master/Insult.txt",
    "porn.txt": "https://raw.githubusercontent.com/konsheng/Sensitive-lexicon/main/Vocabulary/%E8%89%B2%E6%83%85%E8%AF%8D%E5%BA%93.txt",
    "porn_types.txt": "https://raw.githubusercontent.com/konsheng/Sensitive-lexicon/main/Vocabulary/%E8%89%B2%E6%83%85%E7%B1%BB%E5%9E%8B.txt",
}

# 国内机房直连 GitHub raw 常失败；按序尝试镜像（完整 URL 前缀）。
_URL_PREFIXES: tuple[str, ...] = (
    "",
    "https://mirror.ghproxy.com/",
    "https://ghfast.top/",
    "https://ghproxy.net/",
)


def _fetch_bytes(url: str) -> bytes:
    last_error: Exception | None = None
    candidates = [f"{prefix}{url}" for prefix in _URL_PREFIXES]
    for candidate in candidates:
        try:
            print(f"  尝试 {candidate}")
            with urllib.request.urlopen(candidate, timeout=60) as response:
                return response.read()
        except Exception as exc:  # noqa: BLE001 — 逐镜像重试，最后统一抛出
            last_error = exc
            print(f"  失败: {exc}")
    raise RuntimeError(f"无法下载词表: {url}") from last_error


def _download_sources() -> None:
    _LEXICON_DIR.mkdir(parents=True, exist_ok=True)
    for filename, url in _DOWNLOADS.items():
        target = _LEXICON_DIR / filename
        if target.is_file() and target.stat().st_size > 0:
            continue
        print(f"下载 {filename} ...")
        target.write_bytes(_fetch_bytes(url))
    extra = _LEXICON_DIR / "extra.txt"
    if not extra.is_file():
        extra.write_text(
            "# local supplement words\nshit\nasshole\nbastard\n",
            encoding="utf-8",
        )


def main() -> None:
    _download_sources()
    words: list[str] = []
    missing: list[str] = []
    for filename in _SOURCE_FILES:
        path = _LEXICON_DIR / filename
        if not path.is_file():
            missing.append(filename)
            continue
        words.extend(read_source_lines(path))
    if missing and not words:
        raise SystemExit(f"未找到明文词表: {', '.join(missing)}")
    if missing:
        print(f"跳过缺失文件: {', '.join(missing)}")
    destination = _LEXICON_DIR / PACK_FILENAME
    write_pack(destination, words)
    packed = load_pack(destination)
    print(f"已写入 {destination} 条目={len(packed)} 字节={destination.stat().st_size}")


if __name__ == "__main__":
    main()
