#!/usr/bin/env python3
"""Scan for list/report pages missing help view wiring."""
from __future__ import annotations

import re
from pathlib import Path

ROOT = Path(__file__).resolve().parents[1]
SRC = ROOT / "src"

HELP_WIRED_MARKERS = (
    "helpViewConfig",
    "moduleHelpKey",
    "ApplicationHelpView",
    "ListPageHelpToggle",
    "pageView === 'help'",
    "centerView === 'help'",
    "RichDocumentHelpView",
    "RichListPageHelpView",
    "RichModuleCenterHelpView",
)

SKIP_PARTS = (
    "/detail/",
    "/components/",
    "/shared/",
    "PullEntryPage",
    "Popover",
    "MaterialForm",
    "MrpExceptionInboxTab",
    "WorkOrderReadiness",
    "inboundDetailColumns",
    "patrolReportChartRender",
    "PatrolReportLegacyRedirect",
)

# Apps in scope for batch3 help plan
IN_SCOPE_PREFIXES = (
    "apps/kuaizhizao/pages/",
    "apps/kuaicaiwu/pages/",
    "apps/master-data/pages/",
    "pages/system/",
    "pages/infra/",
    "pages/personal/",
    "pages/system/applications/",
)


def rel(path: Path) -> str:
    return path.relative_to(SRC).as_posix()


def skip(path: Path) -> bool:
    r = rel(path)
    return any(s in r for s in SKIP_PARTS)


def is_help_wired(text: str) -> bool:
    return any(m in text for m in HELP_WIRED_MARKERS)


def is_kz_report(text: str) -> bool:
    return "KuaizhizaoReport" in text


def has_unitable(text: str) -> bool:
    return "<UniTable" in text or "UniTable<" in text


def has_module_center(text: str) -> bool:
    return "ModuleCenterLayout" in text


def import_only_help(text: str) -> bool:
    return (
        ("buildDocumentListHelpViewConfig" in text or "buildListPageHelpViewConfig" in text)
        and not is_help_wired(text)
    )


def main() -> None:
    import_only: list[str] = []
    unitable_no_help: list[str] = []
    module_center_no_help: list[str] = []
    custom_page_no_help: list[str] = []

    for path in SRC.rglob("*.tsx"):
        if skip(path):
            continue
        r = rel(path)
        if not (path.name == "index.tsx" or path.name.endswith(".tsx") and "/reports/" in r):
            if path.name != "management.tsx":
                continue
        text = path.read_text(encoding="utf-8")

        if is_help_wired(text):
            continue
        if is_kz_report(text):
            continue  # UniReport shell

        if import_only_help(text):
            import_only.append(r)
            continue

        if has_module_center(text):
            module_center_no_help.append(r)
            continue

        if has_unitable(text):
            if not any(r.startswith(p) for p in IN_SCOPE_PREFIXES) and not r.startswith("apps/haoligo/"):
                # still count kuaizhizao batch3 adjacent
                pass
            unitable_no_help.append(r)
            continue

        # Calendar/card-only pages with help content key imported
        if "buildDocumentListHelpViewConfig" in text or "DOCUMENT_LIST_HELP_KEYS" in text:
            custom_page_no_help.append(r)

    # Dedupe and group
    def by_prefix(items: list[str], prefix: str) -> list[str]:
        return sorted(x for x in items if x.startswith(prefix))

    print("=== 帮助视图遗漏扫描（batch3 范围 + 关联遗漏）===\n")

    print(f"【A】已 import 帮助但未接入视图：{len(import_only)}")
    for p in sorted(import_only):
        print(f"  {p}")
    print()

    print(f"【B】ModuleCenterLayout 无 moduleHelpKey：{len(module_center_no_help)}")
    for p in sorted(module_center_no_help):
        print(f"  {p}")
    print()

    print(f"【C】UniTable 页面无帮助（含 batch3 外扩展域）：{len(unitable_no_help)}")
    groups = {
        "kuaizhizao-绩效/计划/质量/物流/售后": [x for x in unitable_no_help if "kuaizhizao/pages/performance" in x or "plan-management" in x or "quality-management" in x or "logistics" in x or "after-sales" in x or "exception-management" in x or "analysis-center" in x],
        "kuaizhizao-仓储/设备补充": [x for x in unitable_no_help if "warehouse-management" in x or "equipment-management/mold-maintenance-reminders" in x or "equipment-management/tool-maintenance-reminders" in x],
        "kuaicaiwu-未接入": [x for x in unitable_no_help if x.startswith("apps/kuaicaiwu/")],
        "haoligo": [x for x in unitable_no_help if x.startswith("apps/haoligo/")],
        "kuaiplm/kuaioa/kuaiiot/kuaiai": [x for x in unitable_no_help if any(x.startswith(f"apps/{a}/") for a in ("kuaiplm", "kuaioa", "kuaiiot", "kuaiai"))],
        "master-data补充": [x for x in unitable_no_help if x.startswith("apps/master-data/")],
        "system/infra补充": [x for x in unitable_no_help if x.startswith("pages/")],
    }
    for name, items in groups.items():
        if items:
            print(f"  -- {name} ({len(items)})")
            for p in sorted(items):
                print(f"     {p}")
    print()

    print(f"【D】非 UniTable 特殊页（有 doc key 但未接帮助 UI）：{len(custom_page_no_help)}")
    for p in sorted(custom_page_no_help):
        print(f"  {p}")
    print()

    batch3_doc_gaps = [p for p in import_only if "kuaicaiwu" in p or "equipment-status" in p]
    print(f"【重点】batch3 已写文案但漏接：{len(batch3_doc_gaps)}")
    for p in batch3_doc_gaps:
        print(f"  {p}")


if __name__ == "__main__":
    main()
