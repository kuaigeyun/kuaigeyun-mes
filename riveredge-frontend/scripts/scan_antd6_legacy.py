#!/usr/bin/env python3
"""Scan riveredge-frontend for Ant Design 5.x APIs deprecated in v6."""
from __future__ import annotations

import json
import re
from collections import defaultdict
from pathlib import Path

ROOT = Path(__file__).resolve().parents[1] / "src"
EXTS = {".ts", ".tsx", ".js", ".jsx"}
SKIP_PARTS = {"locales", "node_modules", "__snapshots__"}


def near(*names: str):
    def ok(text: str, m: re.Match) -> bool:
        start = max(0, m.start() - 500)
        window = text[start : m.end() + 80]
        return any(n in window for n in names)

    return ok


PATTERNS: list[tuple[str, str, object | None, str, str]] = [
    ("destroyOnClose → destroyOnHidden", r"\bdestroyOnClose\b", None, "high", "Modal/Drawer"),
    ("destroyInactiveTabPane → destroyOnHidden", r"\bdestroyInactiveTabPane\b", None, "high", "Tabs"),
    ("maskClosable → mask.closable", r"\bmaskClosable\s*=", None, "high", "Modal/Drawer"),
    ("Space direction → orientation", r"<Space(?:\.Compact)?\b[^>]*\bdirection\s*=", None, "high", "Space"),
    ("Space split → separator", r"<Space\b[^>]*\bsplit\s*=", None, "high", "Space"),
    ('size="middle" → "medium"', r"size\s*=\s*['\"]middle['\"]", None, "high", "size enum"),
    ('size="default" → "medium"', r"size\s*=\s*['\"]default['\"]", None, "high", "size enum"),
    ("Spin tip → description", r"<Spin\b[\s\S]{0,200}?\btip\s*=", None, "high", "Spin"),
    (
        "bordered → variant",
        r"\bbordered\s*=\s*\{?(true|false|['\"]\w+['\"])\}?",
        near("Card", "Input", "Select", "Cascader", "DatePicker", "TreeSelect", "Tag", "InputNumber"),
        "med",
        "Card/Input/Select/Tag",
    ),
    ("Tag bordered={false} → variant filled", r"<Tag\b[^>]*\bbordered\s*=\s*\{?false", None, "high", "Tag"),
    ("Tag *-inverse → variant solid", r"color\s*=\s*['\"][\w]+-inverse['\"]", None, "high", "Tag"),
    ("popupClassName → classNames.popup", r"\bpopupClassName\s*=", None, "high", "Select/DatePicker"),
    ("dropdownClassName → classNames.popup.root", r"\bdropdownClassName\b", None, "high", "Select"),
    ("dropdownMatchSelectWidth → popupMatchSelectWidth", r"\bdropdownMatchSelectWidth\b", None, "high", "Select"),
    ("dropdownRender → popupRender", r"\bdropdownRender\s*=", None, "high", "Select/Dropdown"),
    ("onDropdownVisibleChange → onOpenChange", r"\bonDropdownVisibleChange\b", None, "high", "Select"),
    ("overlayClassName → classNames.root", r"\boverlayClassName\s*=", None, "high", "Dropdown/Tooltip"),
    ("overlayStyle → styles.root", r"\boverlayStyle\s*=", None, "high", "Dropdown/Tooltip"),
    ("bodyStyle → styles.body", r"\bbodyStyle\s*=", None, "high", "Modal/Drawer/Card"),
    ("headStyle → styles.header", r"\bheadStyle\s*=", None, "high", "Card"),
    ("footerStyle → styles.footer", r"\bfooterStyle\s*=", None, "high", "Drawer"),
    ("maskStyle → styles.mask", r"\bmaskStyle\s*=", None, "high", "Modal/Drawer"),
    ("contentWrapperStyle → styles.wrapper", r"\bcontentWrapperStyle\b", None, "high", "Drawer"),
    ("labelStyle → styles.label", r"\blabelStyle\s*=", near("Descriptions", "descriptions"), "med", "Descriptions"),
    ("contentStyle → styles.content", r"\bcontentStyle\s*=", near("Descriptions", "descriptions"), "med", "Descriptions"),
    ("valueStyle → styles.content", r"\bvalueStyle\s*=", near("Statistic", "Statistic."), "med", "Statistic"),
    ("Input.Group → Space.Compact", r"Input\.Group\b", None, "high", "Input"),
    ("Button.Group → Space.Compact", r"Button\.Group\b", None, "high", "Button"),
    ("Tabs.TabPane → items", r"Tabs\.TabPane\b|<TabPane\b", None, "high", "Tabs"),
    ("Timeline.Item → items", r"Timeline\.Item\b", None, "high", "Timeline"),
    ("Breadcrumb.Item → items", r"Breadcrumb\.Item\b", None, "high", "Breadcrumb"),
    ("BackTop → FloatButton.BackTop", r"\bBackTop\b", None, "high", "BackTop"),
    ("Statistic.Countdown → Timer", r"Statistic\.Countdown\b", None, "high", "Statistic"),
    ("Dropdown.Button deprecated", r"Dropdown\.Button\b", None, "high", "Dropdown"),
    (
        "addonBefore/After → Space.Compact",
        r"\baddon(Before|After)\s*=",
        near("InputNumber", "Input.", "<Input"),
        "med",
        "InputNumber",
    ),
    ("Alert message → title", r"<Alert\b[\s\S]{0,300}?\bmessage\s*=", None, "high", "Alert"),
    ("Alert closeText/onClose", r"<Alert\b[^>]*\b(closeText|onClose)\s*=", None, "high", "Alert"),
    ("Divider type → orientation", r"<Divider\b[^>]*\btype\s*=", None, "high", "Divider"),
    ("Steps direction → orientation", r"<Steps\b[^>]*\bdirection\s*=", None, "high", "Steps"),
    ("Steps labelPlacement → titlePlacement", r"\blabelPlacement\s*=", near("Steps", "<Step"), "med", "Steps"),
    ("Steps progressDot → type=dot", r"\bprogressDot\b", None, "high", "Steps"),
    ("Tabs tabPosition → tabPlacement", r"\btabPosition\s*=", None, "high", "Tabs"),
    ("Collapse expandIconPosition", r"\bexpandIconPosition\b", None, "high", "Collapse"),
    ("Calendar *CellRender", r"\b(date|month)(Full)?CellRender\b", None, "high", "Calendar"),
    ("Image onVisibleChange → onOpenChange", r"\bonVisibleChange\s*=", near("Image", "Preview"), "med", "Image"),
    ("Image wrapperStyle", r"\bwrapperStyle\s*=", near("Image"), "med", "Image"),
    ("Empty imageStyle", r"\bimageStyle\s*=", near("Empty"), "med", "Empty"),
    ("showArrow deprecated", r"\bshowArrow\s*=", None, "high", "Select/Cascader"),
    ("popupStyle → styles.popup", r"\bpopupStyle\s*=", None, "high", "DatePicker"),
    ("focusTriggerAfterClose", r"\bfocusTriggerAfterClose\b", None, "high", "Modal"),
    ("collapsibleIcon → collapsible.icon", r"\bcollapsibleIcon\b", None, "high", "Splitter"),
    ("destroyPopupOnHide", r"\bdestroyPopupOnHide\b", None, "high", "Dropdown"),
    ("destroyTooltipOnHide", r"\bdestroyTooltipOnHide\b", None, "high", "Tooltip"),
    ("trailColor → railColor", r"\btrailColor\s*=", None, "high", "Progress"),
    ("gapPosition → gapPlacement", r"\bgapPosition\b", None, "high", "Progress"),
    ("tipFormatter → tooltip.formatter", r"\btipFormatter\b", None, "high", "Slider"),
    ("onAfterChange → onChangeComplete", r"\bonAfterChange\s*=", near("Slider"), "med", "Slider"),
    ("filterDropdownOpen", r"\bfilterDropdownOpen\b", None, "high", "Table"),
    ("v5-patch-for-react-19", r"v5-patch-for-react-19", None, "high", "deps"),
    ("Drawer width= (prefer size)", r"<Drawer\b[^>]*\bwidth\s*=", None, "low", "Drawer"),
    ("iconPosition → iconPlacement", r"\biconPosition\s*=", None, "high", "Button"),
    ("dotPosition → dotPlacement", r"\bdotPosition\b", None, "high", "Carousel"),
    ("Spin wrapperClassName", r"\bwrapperClassName\s*=", near("Spin"), "med", "Spin"),
]


def main() -> None:
    counts: dict[str, int] = defaultdict(int)
    file_hits: dict[str, set[str]] = defaultdict(set)
    samples: dict[str, list[dict]] = defaultdict(list)

    files = [
        p
        for p in ROOT.rglob("*")
        if p.suffix in EXTS and not any(s in p.parts for s in SKIP_PARTS)
    ]
    print(f"files={len(files)}")

    for path in files:
        text = path.read_text(encoding="utf-8", errors="ignore")
        rel = path.relative_to(ROOT.parent).as_posix()
        for name, pat, filt, _sev, _comp in PATTERNS:
            for m in re.finditer(pat, text):
                if filt and not filt(text, m):
                    continue
                line_start = text.rfind("\n", 0, m.start()) + 1
                line_end = text.find("\n", m.start())
                if line_end < 0:
                    line_end = len(text)
                line = text[line_start:line_end]
                stripped = line.strip()
                if stripped.startswith("//") or stripped.startswith("*"):
                    continue
                counts[name] += 1
                file_hits[name].add(rel)
                if len(samples[name]) < 5:
                    ln = text.count("\n", 0, m.start()) + 1
                    samples[name].append(
                        {"file": rel, "line": ln, "snippet": stripped[:140]}
                    )

    rows = []
    for name, _pat, _filt, sev, comp in PATTERNS:
        c = counts[name]
        if not c:
            continue
        rows.append(
            {
                "api": name,
                "component": comp,
                "severity": sev,
                "hits": c,
                "files": len(file_hits[name]),
                "samples": samples[name][:4],
            }
        )

    rows.sort(key=lambda r: (-r["hits"], r["api"]))

    file_score: dict[str, int] = defaultdict(int)
    for name, hits in file_hits.items():
        if counts[name] == 0:
            continue
        per = max(1, counts[name] // max(1, len(hits)))
        for f in hits:
            file_score[f] += per

    top_files = [
        {"file": f, "approx_hits": h}
        for f, h in sorted(file_score.items(), key=lambda x: -x[1])[:25]
    ]

    by_sev = defaultdict(lambda: {"hits": 0, "patterns": 0})
    for r in rows:
        by_sev[r["severity"]]["hits"] += r["hits"]
        by_sev[r["severity"]]["patterns"] += 1

    out = {
        "antd": "^6.4.4",
        "scanned_files": len(files),
        "pattern_types": len(rows),
        "total_hits": sum(r["hits"] for r in rows),
        "by_severity": dict(by_sev),
        "rows": rows,
        "top_files": top_files,
        "migration_ref": "https://ant.design/docs/react/migration-v6",
    }

    out_path = Path(__file__).resolve().parent / "antd6-legacy-scan.json"
    out_path.write_text(json.dumps(out, ensure_ascii=False, indent=2), encoding="utf-8")

    print(json.dumps(
        {
            "pattern_types": out["pattern_types"],
            "total_hits": out["total_hits"],
            "by_severity": out["by_severity"],
            "summary": [
                {
                    "api": r["api"],
                    "hits": r["hits"],
                    "files": r["files"],
                    "sev": r["severity"],
                    "component": r["component"],
                }
                for r in rows
            ],
            "top_files": top_files[:15],
        },
        ensure_ascii=False,
        indent=2,
    ))
    print("WROTE", out_path)


if __name__ == "__main__":
    main()
