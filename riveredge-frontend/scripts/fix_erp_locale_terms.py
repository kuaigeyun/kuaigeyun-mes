#!/usr/bin/env python3
"""Fix common ERP mistranslations in locale files (vi-VN, ja-JP, en-US + generated)."""

from __future__ import annotations

import re
import sys
from pathlib import Path

ROOT = Path(__file__).resolve().parents[1]
LOCALES = ROOT / "src" / "locales"

# Keys whose values refer to manufacturing site (厂区), not botanical plant.
PLANT_KEY_RE = re.compile(
    r"(?:\.plants\.|field\.plant\.|\.plantCode|\.plantName|\.plantRequired|"
    r"\.plantImport|availablePlants|factory\.plants|path\.plants|quickAddPlant|"
    r"factoryPlants|Plant code|Plant name|Create Plant|Edit Plant|Delete plant|"
    r"master-data-factory-plant|field\.workshop\.plantId|importNoPlant|plantCodeNotFound|"
    r"plantImportHint|availablePlantsList)"
)

WORKSHOP_KEY_RE = re.compile(
    r"(?:workshop|Workshop|path\.workshops|factory\.workshops|master-data-factory-workshop)"
)

WORKSTATION_FACTORY_KEY_RE = re.compile(
    r"(?:path\.workstations|factory\.workstations|master-data-factory-workstation|"
    r"field\.workstation\.|\.workstations\.|colWorkstation|formWorkstation)"
)

REMARK_KEY_RE = re.compile(
    r"(?:\.remark|\.colRemark|formRemark|importColRemark|importHeaderRemark|"
    r"\.remarks|fieldRemark|traceColRemark|orderNotes|RemarksPlaceholder|"
    r"toolLedger\.fieldDescription|labelRemark|field\.[a-zA-Z]+\.description|"
    r"roles\.description|applicationConnections\.columnDescription|"
    r"detailColumnDescription|roles\.roleDescription)"
)

DESCRIPTION_KEY_RE = re.compile(
    r"(?:fieldDescription|colDescription|columnDescription|descLabel|"
    r"terms\.colDescription|labelDescription|columnDesc|descTitle|descFormLabel|"
    r"importHeaderDescription|pages\.system\.applicationConnections\.columnDescription|"
    r"columnFaultDesc|columnIssueDesc|templateDescription)"
)

ACTIVE_DISABLED_KEY_RE = re.compile(
    r"(?:\.active|\.disabled|isActive|IsActive|statusActive|statusDisabled|"
    r"statusEnabled|status\.enabled|status\.disabled|lifecycle\.stage\.active|"
    r"columnActive|statActive|labelActive|detailColumnActive|statInactive|"
    r"disableSuccess|configPushOff|actionDisable|unCheckedChildren|"
    r"components\.tenantSelection\.statusActive|templateSelect\.disabled)"
)

WORKSHOP_VALUE_KEY_RE = re.compile(
    r"(?:workshop|Workshop|path\.workshops|factory\.workshops|"
    r"master-data-factory-workshop|importNoPlant|plantId|onboardingWizard\.roleSupervisor|"
    r"onboardingWizard\.system\.task\.factoryData)"
)

IS_LEAF_KEY = "app.kuaicaiwu.glChartOfAccounts.col.isLeaf"

LINE_RE = re.compile(r"^(\s*)'((?:\\'|[^'])*)'\s*:\s*'((?:\\'|[^'])*)',?\s*$")


def unescape(s: str) -> str:
    return s.replace("\\'", "'").replace("\\n", "\n").replace("\\\\", "\\")


def escape(s: str) -> str:
    return s.replace("\\", "\\\\").replace("'", "\\'").replace("\n", "\\n")


def fix_en_value(key: str, value: str) -> str:
    v = value
    if PLANT_KEY_RE.search(key):
        v = re.sub(r"\bPlants\b", "Sites", v)
        v = re.sub(r"\bPlant\b", "Site", v)
        v = re.sub(r"\bplants\b", "sites", v)
        v = re.sub(r"\bplant\b", "site", v)
    if "onboardingWizard" in key:
        v = v.replace("plant-wide", "site-wide")
        v = v.replace("the plant's", "the site's")
        v = v.replace("full plant", "full site")
        v = v.replace("across the plant", "across the site")
        v = v.replace("all plant equipment", "all site equipment")
        v = re.sub(r"\bplant\b", "site", v)
    return v


def fix_vi_value(key: str, value: str) -> str:
    v = value

    if PLANT_KEY_RE.search(key):
        replacements = [
            ("Thực vật", "Khu sản xuất"),
            ("Thực vật", "Khu sản xuất"),
            ("Mã thực vật", "Mã khu sản xuất"),
            ("Tên cây", "Tên khu sản xuất"),
            ("Tạo cây", "Tạo khu sản xuất"),
            ("Chỉnh sửa cây", "Chỉnh sửa khu sản xuất"),
            ("cây trồng", "khu sản xuất"),
            ("Nhập khẩu cây", "Nhập khu sản xuất"),
            ("xóa cây", "xóa khu sản xuất"),
            ("cây này", "khu sản xuất này"),
            ("cây đã", "khu sản xuất đã"),
            ("cây sẽ", "khu sản xuất sẽ"),
            ("cây_current", "site_current"),
            ("thực vật_", "sites_"),
            ("{{count}} cây ", "{{count}} khu sản xuất "),
            ("Cây có sẵn", "Khu sản xuất có sẵn"),
            ("tạo cây trước", "tạo khu sản xuất trước"),
            ("CÂY-", "SITE-"),
            ("mã nhà máy", "mã khu sản xuất"),
            ("tên cây", "tên khu sản xuất"),
        ]
        for old, new in replacements:
            v = v.replace(old, new)

    if WORKSHOP_KEY_RE.search(key) or WORKSHOP_VALUE_KEY_RE.search(key):
        v = v.replace("Hội thảo", "Phân xưởng")
        v = v.replace("hội thảo", "phân xưởng")

    if WORKSTATION_FACTORY_KEY_RE.search(key):
        v = v.replace("Máy trạm", "Trạm làm việc")

    if REMARK_KEY_RE.search(key) and "Nhận xét" in v:
        v = v.replace("Nhận xét", "Ghi chú")

    if DESCRIPTION_KEY_RE.search(key):
        v = v.replace("Sự miêu tả", "Mô tả")

    if key == "pages.system.roles.roleDescription":
        v = v.replace("Sự miêu tả", "Ghi chú").replace("Mô tả", "Ghi chú")

    if ACTIVE_DISABLED_KEY_RE.search(key):
        v = v.replace("Tích cực", "Kích hoạt")
        v = v.replace("Tàn tật", "Vô hiệu hóa")

    if key == "app.kuaizhizao.purchaseOrder.approvalComment":
        v = v.replace("Ghi chú", "Ý kiến phê duyệt").replace("Nhận xét", "Ý kiến phê duyệt")

    if key == IS_LEAF_KEY:
        v = "Cấp cuối"

    if re.search(r"workCenter|work-center|WorkCenter", key):
        v = v.replace("Trung tâm làm việc", "Trung tâm sản xuất")

    if re.search(r"workGroup|work-group|WorkGroup", key):
        v = v.replace("Nhóm làm việc", "Tổ sản xuất")

    if "Trung tâm làm việc" in v:
        v = v.replace("Trung tâm làm việc", "Trung tâm sản xuất")

    if key in ("pages.system.apis.detailColumnDescription", "pages.system.dataSources.detailColumnDescription"):
        v = v.replace("Sự miêu tả", "Ghi chú")

    return v


def fix_ja_value(key: str, value: str) -> str:
    v = value

    if PLANT_KEY_RE.search(key):
        replacements = [
            ("植物名", "拠点名"),
            ("植物の", "拠点の"),
            ("植物を", "拠点を"),
            ("植物リスト", "拠点リスト"),
            ("植物データ", "拠点データ"),
            ("植物コード", "拠点コード"),
            ("植物選択", "拠点選択"),
            ("植物_すべて", "拠点_すべて"),
            ("植物の現在", "拠点の現在"),
            ("利用可能な植物", "利用可能な拠点"),
            ("植物は", "拠点は"),
            ("植物が", "拠点が"),
            ("個の植物", "件の拠点"),
            ("植物", "拠点"),
        ]
        for old, new in replacements:
            v = v.replace(old, new)

    if WORKSHOP_KEY_RE.search(key) or WORKSHOP_VALUE_KEY_RE.search(key):
        v = v.replace("作業場", "製造課")
        v = v.replace("工房", "製造課")

    if key in ("field.workshop.plantId", "field.workshop.plantIdPlaceholder"):
        v = v.replace("植物", "拠点")

    if key == "app.master-data.workshops.importNoPlant":
        v = v.replace("植物", "拠点")

    if REMARK_KEY_RE.search(key):
        v = v.replace("述べる", "備考")

    if "quickAddWorkstation" in key or "quickAddWorkstation" in v:
        v = v.replace("作業場を追加", "工位を追加")
        v = v.replace("作業場を", "工位を")

    if "作業場" in v and "quickAddWorkstation" not in key:
        v = v.replace("作業場", "製造課")

    if key == "pages.system.onboardingWizard.roleSupervisor":
        v = v.replace("作業場開催ガイド", "製造現場監督ガイド")

    if key == IS_LEAF_KEY:
        v = "末級"

    if re.search(r"workCenter|work-center|WorkCenter", key):
        v = v.replace("ワークセンター", "ワークセンター")  # keep if already correct
        v = v.replace("作業中心", "ワークセンター")

    return v


def process_file(path: Path, lang: str) -> int:
    text = path.read_text(encoding="utf-8")
    lines = text.splitlines(keepends=True)
    changed = 0
    out: list[str] = []

    for line in lines:
        m = LINE_RE.match(line.rstrip("\n\r"))
        if not m:
            out.append(line)
            continue
        indent, key, raw_value = m.group(1), m.group(2), m.group(3)
        value = unescape(raw_value)
        if lang == "en":
            new_value = fix_en_value(key, value)
        elif lang == "vi":
            new_value = fix_vi_value(key, value)
        elif lang == "ja":
            new_value = fix_ja_value(key, value)
        else:
            out.append(line)
            continue

        if new_value != value:
            changed += 1
            newline = "\n" if line.endswith("\n") else ""
            out.append(f"{indent}'{key}': '{escape(new_value)}',{newline}")
        else:
            out.append(line)

    if changed:
        path.write_text("".join(out), encoding="utf-8")
    return changed


def main() -> int:
    targets: list[tuple[Path, str]] = []

    for lang_file, lang in [
        ("en-US.ts", "en"),
        ("vi-VN.ts", "vi"),
        ("ja-JP.ts", "ja"),
    ]:
        p = LOCALES / lang_file
        if p.exists():
            targets.append((p, lang))

    for sub in ("customFieldPage", "codeRulePage"):
        for lang_file, lang in [
            ("en-US.ts", "en"),
            ("vi-VN.ts", "vi"),
            ("ja-JP.ts", "ja"),
        ]:
            p = LOCALES / "generated" / sub / lang_file
            if p.exists():
                targets.append((p, lang))

    total = 0
    for path, lang in targets:
        n = process_file(path, lang)
        if n:
            print(f"{path.relative_to(ROOT)}: {n} fixes")
            total += n

    print(f"Total: {total} string fixes")
    return 0


if __name__ == "__main__":
    sys.exit(main())
