"""将结构化行数据格式化为 GFM Markdown 表格。"""

from __future__ import annotations

from typing import Any, Iterable, Sequence


def _escape_cell(value: Any) -> str:
    text = "" if value is None else str(value)
    return text.replace("|", "\\|").replace("\n", " ").strip()


def rows_to_markdown_table(headers: Sequence[str], rows: Iterable[Sequence[Any]]) -> str:
    header_cells = [_escape_cell(h) for h in headers]
    lines = [
        "| " + " | ".join(header_cells) + " |",
        "| " + " | ".join("---" for _ in header_cells) + " |",
    ]
    for row in rows:
        cells = [_escape_cell(cell) for cell in row]
        if len(cells) < len(header_cells):
            cells.extend([""] * (len(header_cells) - len(cells)))
        lines.append("| " + " | ".join(cells[: len(header_cells)]) + " |")
    return "\n".join(lines)
