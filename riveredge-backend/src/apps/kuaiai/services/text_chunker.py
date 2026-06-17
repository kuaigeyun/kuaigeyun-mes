"""知识库分块工具。"""

from __future__ import annotations

CHUNK_SIZE = 600
CHUNK_OVERLAP = 100


def split_text_chunks(text: str, *, chunk_size: int = CHUNK_SIZE, overlap: int = CHUNK_OVERLAP) -> list[str]:
    raw = (text or "").replace("\r\n", "\n").strip()
    if not raw:
        return []
    if len(raw) <= chunk_size:
        return [raw]

    chunks: list[str] = []
    start = 0
    length = len(raw)
    while start < length:
        end = min(start + chunk_size, length)
        piece = raw[start:end].strip()
        if piece:
            chunks.append(piece)
        if end >= length:
            break
        start = max(0, end - overlap)
    return chunks
