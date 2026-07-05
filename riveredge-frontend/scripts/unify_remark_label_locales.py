#!/usr/bin/env python3
"""Unify remark-field UI copy: use 备注 / Remark / 備考 / Ghi chú instead of 描述 / Description forks."""

from __future__ import annotations

import re
import sys
from pathlib import Path

ROOT = Path(__file__).resolve().parents[1]
LOCALES = ROOT / "src" / "locales"

LANG_FILES = {
    "zh-CN": LOCALES / "zh-CN.ts",
    "zh-Hant": LOCALES / "zh-Hant.ts",
    "en-US": LOCALES / "en-US.ts",
    "ja-JP": LOCALES / "ja-JP.ts",
    "vi-VN": LOCALES / "vi-VN.ts",
}

REMARK_LABEL = {
    "zh-CN": "备注",
    "zh-Hant": "備註",
    "en-US": "Remark",
    "ja-JP": "備考",
    "vi-VN": "Ghi chú",
}

REMARK_LABEL_PLURAL = {
    "zh-CN": "备注",
    "zh-Hant": "備註",
    "en-US": "Remarks",
    "ja-JP": "備考",
    "vi-VN": "Ghi chú",
}

NO_REMARK = {
    "zh-CN": "暂无备注",
    "zh-Hant": "暫無備註",
    "en-US": "No remark",
    "ja-JP": "備考なし",
    "vi-VN": "Chưa có ghi chú",
}

REMARK_COLUMN = {
    "zh-CN": "备注列",
    "zh-Hant": "備註列",
    "en-US": "Remark column",
    "ja-JP": "備考列",
    "vi-VN": "Cột ghi chú",
}

EXCLUDE_KEY = re.compile(
    r"(?:"
    r"FaultDesc|faultDescription|repairDescription|abnormalityDescription|problemDescription|"
    r"templateDesc|templateDescription|platformDescription|loginContent|"
    r"applications\.(?:description|descriptionLabel|descriptionPlaceholder|noDescription|editHint)|"
    r"siteSettings\.description|businessConfig|importExample\.description|"
    r"sop\.nodeDesc|techStackModal|AbnormalDesc|colAbnormal|MaintenanceDesc|formMaintenanceDesc|"
    r"eightD|aiCreate|keywordCloud|patrol\.reports|scheduling\.prep\.description|"
    r"warehouse(?:Inbound|Outbound).*\.description|confirmPreview\.description|"
    r"equipmentFaults\.(?:columnFaultDesc|faultDesc)|dataQuality\.columnIssueDesc|"
    r"messageTemplate\.(?:templateDescription|descriptionPlaceholder)|"
    r"kuaiplm\.phase2\.fmea|kuaiplm\.rdProjects\.detail\.task|proUpgradePrompt|tenantBootstrap|"
    r"defaultHome\.description|parameters\.description|configCenter\.templateDescription|"
    r"varLabelPlaceholder|salesDashboard\.noFollowUpContent|placeholder\.description|"
    r"apis\.descriptionPlaceholder|dataSources\.descriptionPlaceholder"
    r")",
    re.I,
)

REMARK_KEY = re.compile(
    r"(?:"
    r"^field\.[^.]+\.description$|"
    r"\.fieldDescription$|"
    r"\.(?:colDescription|importHeaderDescription|labelDescription|columnDescription|"
    r"detailColumnDescription|descLabel|descTitle|descFormLabel)$|"
    r"\.col\.description$|"
    r"\.columns\.description$|"
    r"^app\.kuaicaiwu\.costCommon\.description$|"
    r"^app\.master-data\.formSchema\.description$|"
    r"^pages\.system\.messageConfig\.description$|"
    r"^pages\.infra\.package\.description$|"
    r"^common\.noDescription$|"
    r"^components\.dictionarySelect\.fieldDescription$|"
    r"^pages\.init\.templateSelect\.description$|"
    r"^app\.kuaiplm\.phase2\.requirements\.form\.description$|"
    r"^app\.kuaizhizao\.(?:equipment|mold)\.fieldDescription$|"
    r"^app\.kuaizhizao\.demandManagement\.colDescription$|"
    r"^pages\.system\.integrationConfigs\.(?:description|descLabel)$|"
    r"^pages\.system\.approvalProcesses\.(?:description|descLabel)$|"
    r"^pages\.system\.roles\.(?:description|noDescription)$|"
    r"^field\.department\.colDescription$|"
    r"^app\.master-data\.(?:seqRules|productionLines|workstations|warehouses|plants|"
    r"workshops|materials|variantAttributes|drawings|materialForm|codeMapping)\.description$|"
    r"^app\.master-data\.bom\.(?:descTitle|descLabel|descFormLabel)$|"
    r"^pages\.system\.pluginManager\.columnDesc$|"
    r"^pages\.system\.pluginManager\.noDesc$|"
    r"^pages\.system\.dataQuality\.columnDesc$|"
    r"^field\.scheduledTask\.description$|"
    r"^pages\.system\.applicationConnections\.columnDescription$|"
    r"^components\.dictionarySelect\.placeholderDescription$|"
    r"^app\.kuaizhizao\.(?:equipment|mold)\.phDescription$|"
    r"^app\.kuaicaiwu\.costCommon\.descriptionPlaceholder$|"
    r"^pages\.system\.integrationConfigs\.descPlaceholder$|"
    r"^pages\.system\.approvalProcesses\.descPlaceholder$|"
    r"\.descriptionPlaceholder$"
    r")",
    re.I,
)

PLACEHOLDER_KEY = re.compile(
    r"(?:Placeholder|placeholderDescription|phDescription|descriptionPlaceholder|"
    r"descPlaceholder|roles\.descriptionPlaceholder)$",
    re.I,
)

LINE_RE = re.compile(r"^(\s*)'((?:\\'|[^'])*)'\s*:\s*'((?:\\'|[^'])*)',?\s*$")


def unescape(s: str) -> str:
    return s.replace("\\'", "'").replace("\\n", "\n").replace("\\\\", "\\")


def escape(s: str) -> str:
    return s.replace("\\", "\\\\").replace("'", "\\'").replace("\n", "\\n")


def detect_lang(path: Path) -> str | None:
    for lang, p in LANG_FILES.items():
        if p.resolve() == path.resolve():
            return lang
    return None


def normalize_value(key: str, value: str, lang: str) -> str:
    if EXCLUDE_KEY.search(key):
        return value
    if not REMARK_KEY.search(key):
        return value

    if key == "field.department.colDescription":
        return REMARK_COLUMN[lang]

    if key.endswith("noDescription") or key == "common.noDescription" or key.endswith(".noDesc"):
        return NO_REMARK[lang]

    if PLACEHOLDER_KEY.search(key):
        return normalize_placeholder(value, lang)

    if key == "app.master-data.sop.remarkLabel":
        return REMARK_LABEL_PLURAL[lang]

    if key == "app.master-data.formSchema.fieldDescription":
        if lang.startswith("zh"):
            return REMARK_LABEL[lang]
        if lang == "en-US":
            return "Remark"
        if lang == "ja-JP":
            return "備考"
        if lang == "vi-VN":
            return "Ghi chú"

    if key == "app.master-data.formSchema.fieldDescriptionPlaceholder":
        return normalize_placeholder(value, lang)

    # Short field/column labels
    if len(value) <= 24:
        return REMARK_LABEL[lang]

    return normalize_inline(value, lang)


def normalize_placeholder(value: str, lang: str) -> str:
    optional_suffix = {
        "zh-CN": "（可选）",
        "zh-Hant": "（可選）",
        "en-US": " (optional)",
        "ja-JP": "（任意）",
        "vi-VN": " (tùy chọn)",
    }
    base = {
        "zh-CN": "请输入备注",
        "zh-Hant": "請輸入備註",
        "en-US": "Enter remark",
        "ja-JP": "備考を入力してください",
        "vi-VN": "Nhập ghi chú",
    }
    opt = optional_suffix[lang]
    if lang.startswith("zh"):
        if "可选" in value or "可選" in value:
            return base[lang] + opt
        return base[lang]
    if lang == "en-US":
        if "optional" in value.lower():
            return base[lang] + opt
        return base[lang]
    if lang == "ja-JP":
        if "任意" in value or "オプション" in value:
            return base[lang] + opt
        return base[lang]
    if lang == "vi-VN":
        if "tùy chọn" in value.lower() or "optional" in value.lower():
            return base[lang] + opt
        return base[lang]
    return base[lang]


def normalize_inline(value: str, lang: str) -> str:
    if lang == "zh-CN":
        return (
            value.replace("描述", "备注")
            .replace("说明", "备注")
            .replace("备注/描述", "备注")
        )
    if lang == "zh-Hant":
        return (
            value.replace("描述", "備註")
            .replace("說明", "備註")
            .replace("備註/描述", "備註")
        )
    if lang == "en-US":
        v = re.sub(r"\bDescriptions?\b", "Remark", value)
        v = re.sub(r"\bRemarks?\s*/\s*description\b", "Remark", v, flags=re.I)
        return v
    if lang == "ja-JP":
        return value.replace("説明", "備考").replace("描述", "備考")
    if lang == "vi-VN":
        return (
            value.replace("Mô tả", "Ghi chú")
            .replace("Nhận xét", "Ghi chú")
            .replace("Bình luận", "Ghi chú")
        )
    return value


def process_file(path: Path) -> int:
    lang = detect_lang(path)
    if not lang:
        return 0

    text = path.read_text(encoding="utf-8")
    changed = 0
    out: list[str] = []

    for line in text.splitlines(keepends=True):
        m = LINE_RE.match(line.rstrip("\n\r"))
        if not m:
            out.append(line)
            continue
        indent, key, raw = m.group(1), m.group(2), m.group(3)
        value = unescape(raw)
        new_value = normalize_value(key, value, lang)
        if new_value != value:
            changed += 1
            nl = "\n" if line.endswith("\n") else ""
            out.append(f"{indent}'{key}': '{escape(new_value)}',{nl}")
        else:
            out.append(line)

    if changed:
        path.write_text("".join(out), encoding="utf-8")
    return changed


def main() -> int:
    total = 0
    for lang, path in LANG_FILES.items():
        n = process_file(path)
        if n:
            print(f"{path.name}: {n}")
            total += n
    print(f"Total: {total}")
    return 0


if __name__ == "__main__":
    sys.exit(main())
