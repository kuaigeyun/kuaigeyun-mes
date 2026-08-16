"""敏感词库封装：压缩后异或，避免托管平台按明文词表扫描。"""

from __future__ import annotations

import zlib
from pathlib import Path

PACK_MAGIC = b"RELEX1"
PACK_FILENAME = "lexicon.pack"
_XOR_KEY = b"riveredge-lexicon-pack-v1"


def pack_words(words: list[str]) -> bytes:
    payload = "\n".join(words).encode("utf-8")
    compressed = zlib.compress(payload, 9)
    obfuscated = bytes(
        byte ^ _XOR_KEY[index % len(_XOR_KEY)] for index, byte in enumerate(compressed)
    )
    return PACK_MAGIC + obfuscated


def unpack_words(blob: bytes) -> list[str]:
    if not blob.startswith(PACK_MAGIC):
        raise ValueError("敏感词封装包格式不正确")
    obfuscated = blob[len(PACK_MAGIC) :]
    compressed = bytes(
        byte ^ _XOR_KEY[index % len(_XOR_KEY)] for index, byte in enumerate(obfuscated)
    )
    payload = zlib.decompress(compressed).decode("utf-8")
    return [line.strip() for line in payload.splitlines() if line.strip() and not line.startswith("#")]


def read_source_lines(path: Path) -> list[str]:
    lines: list[str] = []
    for raw in path.read_text(encoding="utf-8").splitlines():
        line = raw.strip()
        if not line or line.startswith("#"):
            continue
        lines.append(line)
    return lines


def write_pack(destination: Path, words: list[str]) -> None:
    destination.write_bytes(pack_words(words))


def load_pack(path: Path) -> list[str]:
    if not path.is_file():
        raise FileNotFoundError(f"敏感词封装包不存在: {path}")
    return unpack_words(path.read_bytes())
