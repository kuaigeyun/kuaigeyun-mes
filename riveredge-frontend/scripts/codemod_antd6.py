#!/usr/bin/env python3
"""Mechanical Ant Design 5 → 6 codemods (run after scan_antd6_legacy.py).

Usage:
  python scripts/codemod_antd6.py
  python scripts/codemod_antd6.py --dry-run
"""
from __future__ import annotations

import argparse
import re
from collections import defaultdict
from pathlib import Path

ROOT = Path(__file__).resolve().parents[1] / "src"
EXTS = {".ts", ".tsx", ".js", ".jsx"}
SKIP_PARTS = {"locales", "node_modules", "__snapshots__"}


def iter_source_files() -> list[Path]:
    return [
        p
        for p in ROOT.rglob("*")
        if p.suffix in EXTS and not any(s in p.parts for s in SKIP_PARTS)
    ]


def apply_simple_replacements(text: str) -> tuple[str, dict[str, int]]:
    stats: dict[str, int] = defaultdict(int)

    def sub(name: str, pattern: str, repl: str, *, flags: int = 0) -> None:
        nonlocal text
        text, n = re.subn(pattern, repl, text, flags=flags)
        if n:
            stats[name] += n

    # --- size enum ---
    sub("size_middle", r"""size\s*=\s*(["'])middle\1""", r"size=\1medium\1")
    sub("size_default", r"""size\s*=\s*(["'])default\1""", r"size=\1medium\1")

    # --- Modal / Drawer / Tabs ---
    sub("destroyOnClose", r"\bdestroyOnClose\b", "destroyOnHidden")
    sub("destroyInactiveTabPane", r"\bdestroyInactiveTabPane\b", "destroyOnHidden")

    # --- Select / Dropdown ---
    sub("onDropdownVisibleChange", r"\bonDropdownVisibleChange\b", "onOpenChange")
    sub("dropdownRender", r"\bdropdownRender\b", "popupRender")
    sub("dropdownMatchSelectWidth", r"\bdropdownMatchSelectWidth\b", "popupMatchSelectWidth")
    sub("dropdownClassName", r"\bdropdownClassName\b", "classNames.popup.root")

    # --- misc renames ---
    sub("destroyPopupOnHide", r"\bdestroyPopupOnHide\b", "destroyOnHidden")
    sub("destroyTooltipOnHide", r"\bdestroyTooltipOnHide\b", "destroyOnHidden")
    sub("trailColor", r"\btrailColor\b", "railColor")
    sub("gapPosition", r"\bgapPosition\b", "gapPlacement")
    sub("tabPosition", r"\btabPosition\b", "tabPlacement")
    sub("iconPosition", r"\biconPosition\b", "iconPlacement")
    sub("dotPosition", r"\bdotPosition\b", "dotPlacement")

    # --- Divider / Steps ---
    sub("divider_type", r"(<Divider\b[^>]*?)\btype=", r"\1orientation=")
    sub("steps_direction", r"(<Steps\b[^>]*?)\bdirection=", r"\1orientation=")

    # --- Space split → separator ---
    sub("space_split", r"(<Space\b[^>]*?)\bsplit=", r"\1separator=")

    # --- Spin tip → description (opening tag, 400 char window) ---
    sub(
        "spin_tip",
        r"(<Spin\b[\s\S]{0,400}?)\btip(\s*=)",
        r"\1description\2",
    )

    # --- Alert message → title (opening tag window) ---
    sub(
        "alert_message",
        r"(<Alert\b[\s\S]{0,600}?)\bmessage(\s*=)",
        r"\1title\2",
    )

    # --- Tag bordered={false} ---
    sub("tag_bordered_false", r"(<Tag\b[^>]*?)\bbordered\s*=\s*\{?\s*false\s*\}?", r'\1variant="filled"')

    # --- Card bordered={false} → variant="borderless" ---
    sub(
        "card_bordered_false",
        r"(<Card\b[^>]*?)\bbordered\s*=\s*\{?\s*false\s*\}?",
        r'\1variant="borderless"',
    )

    # --- maskClosable={bool} → mask={{ closable: bool }} ---
    def mask_closable_repl(m: re.Match) -> str:
        return f"mask={{{{ closable: {m.group(1)} }}}}"

    sub("maskClosable_expr", r"\bmaskClosable\s*=\s*\{([^}]+)\}", mask_closable_repl)

    # --- popupClassName="..." | {expr} ---
    sub(
        "popupClassName_string",
        r'\bpopupClassName\s*=\s*"([^"]*)"',
        r'classNames={{ popup: "\1" }}',
    )
    sub(
        "popupClassName_expr",
        r"\bpopupClassName\s*=\s*\{([^}]+)\}",
        r"classNames={{ popup: \1 }}",
    )

    # --- overlayClassName → classNames.root ---
    sub(
        "overlayClassName_string",
        r'\boverlayClassName\s*=\s*"([^"]*)"',
        r'classNames={{ root: "\1" }}',
    )
    sub(
        "overlayClassName_expr",
        r"\boverlayClassName\s*=\s*\{([^}]+)\}",
        r"classNames={{ root: \1 }}",
    )

    # --- overlayStyle={{ ... }} → styles={{ root: { ... } }} ---
    sub(
        "overlayStyle",
        r"\boverlayStyle\s*=\s*\{(\{[^}]+\})\}",
        r"styles={{ root: \1 }}",
    )

    # --- bodyStyle / maskStyle / headStyle / footerStyle (simple inline objects) ---
    sub("bodyStyle", r"\bbodyStyle\s*=\s*\{(\{[^}]+\})\}", r"styles={{ body: \1 }}")
    sub("maskStyle", r"\bmaskStyle\s*=\s*\{(\{[^}]+\})\}", r"styles={{ mask: \1 }}")
    sub("headStyle", r"\bheadStyle\s*=\s*\{(\{[^}]+\})\}", r"styles={{ header: \1 }}")
    sub("footerStyle", r"\bfooterStyle\s*=\s*\{(\{[^}]+\})\}", r"styles={{ footer: \1 }}")

    # --- popupStyle ---
    sub("popupStyle", r"\bpopupStyle\s*=\s*\{(\{[^}]+\})\}", r"styles={{ popup: \1 }}")

    return text, dict(stats)


def main() -> None:
    parser = argparse.ArgumentParser()
    parser.add_argument("--dry-run", action="store_true")
    args = parser.parse_args()

    total_stats: dict[str, int] = defaultdict(int)
    changed_files = 0

    for path in iter_source_files():
        original = path.read_text(encoding="utf-8")
        updated, stats = apply_simple_replacements(original)
        if updated == original:
            continue
        changed_files += 1
        for k, v in stats.items():
            total_stats[k] += v
        if not args.dry_run:
            try:
                with path.open("w", encoding="utf-8", newline="\n") as f:
                    f.write(updated)
            except OSError as exc:
                print(f"WARN: skip write {path}: {exc}")
                continue

    mode = "DRY-RUN" if args.dry_run else "APPLIED"
    print(f"{mode}: {changed_files} files")
    for name, count in sorted(total_stats.items(), key=lambda x: -x[1]):
        print(f"  {name}: {count}")


if __name__ == "__main__":
    main()
