#!/usr/bin/env python3
"""Replace antd Modal static API with getAntdModal() from utils/antdAppApis."""
from __future__ import annotations

import os
import re
from pathlib import Path

ROOT = Path(__file__).resolve().parents[1] / "src"
TARGET = ROOT / "utils" / "antdAppApis.tsx"
IMPORT_RE = re.compile(
    r"import\s*\{[^}]*\bgetAntdModal\b[^}]*\}\s*from\s*['\"][^'\"]+['\"]\s*;?\s*\n"
)
STATIC_RE = re.compile(r"\bModal\.(confirm|warning|info|error)\s*\(")


def rel_import_path(from_file: Path) -> str:
    rel = os.path.relpath(TARGET.with_suffix(""), from_file.parent).replace("\\", "/")
    if not rel.startswith("."):
        rel = "./" + rel
    return rel


def ensure_import(text: str, from_file: Path) -> str:
    if IMPORT_RE.search(text):
        return text
    import_line = f"import {{ getAntdModal }} from '{rel_import_path(from_file)}';\n"
    lines = text.splitlines(keepends=True)
    # 跳过仍在进行中的多行 import（下一行不是完整 import 语句）
    last_import_idx = -1
    for i, line in enumerate(lines):
        if not line.startswith("import "):
            continue
        if line.rstrip().endswith(";") or (line.rstrip().endswith("'") or line.rstrip().endswith('"')):
            last_import_idx = i
            continue
        # 多行 import 块：向下找到对应的 `} from ...;`
        j = i
        while j < len(lines):
            if re.search(r"\}\s*from\s+['\"]", lines[j]):
                last_import_idx = j
                break
            j += 1
    if last_import_idx >= 0:
        lines.insert(last_import_idx + 1, import_line)
        return "".join(lines)
    return import_line + text


def migrate_file(path: Path) -> bool:
    text = path.read_text(encoding="utf-8")
    if not STATIC_RE.search(text):
        return False
    new_text = STATIC_RE.sub(r"getAntdModal().\1(", text)
    new_text = ensure_import(new_text, path)
    if new_text != text:
        path.write_text(new_text, encoding="utf-8")
        return True
    return False


def main() -> None:
    changed: list[str] = []
    for path in ROOT.rglob("*"):
        if path.suffix not in {".ts", ".tsx"}:
            continue
        if migrate_file(path):
            changed.append(str(path.relative_to(ROOT.parent)))
    print(f"migrated {len(changed)} files")
    for p in sorted(changed):
        print(p)


if __name__ == "__main__":
    main()
